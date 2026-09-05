(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var unidades = null;          // cache da hierarquia (lista plana)
  var conteudoPorRpc = {};      // cache do conteúdo por RPC: { 'buscar_efetivo': [...], 'listar_instalacoes': [...] }
  var carregando = false;
  var houveFalha = false;       // a última carga da hierarquia falhou (rede/servidor) → mostra erro, não branco
  var containerAtual = null;    // onde a árvore é desenhada na página atual
  var opcoesAtuais = null;      // { renderConteudo, rpcConteudo, chaveUnidade, textoContagem, aoRenderizar, aoMudarTitulos }
  var ouvinteRegistrado = false;
  var titulosOcultos = 0;       // níveis do topo da árvore recolhidos pelos botões +/− (usuários)

  /* A página escolhe a fonte de conteúdo; o padrão é o efetivo (usuários).
     Postos passa rpcConteudo:'listar_instalacoes' e chaveUnidade:'unidade_id'. */
  function rpcConteudo() { return (opcoesAtuais && opcoesAtuais.rpcConteudo) || 'buscar_efetivo'; }
  function chaveUnidade() { return (opcoesAtuais && opcoesAtuais.chaveUnidade) || 'lotacao_atual'; }
  function textoContagem(itens) {
    if (opcoesAtuais && opcoesAtuais.textoContagem) return opcoesAtuais.textoContagem(itens);
    return itens.length === 1 ? '1 militar' : itens.length + ' militares';
  }

  function obterToken() {
    try {
      var sessao = JSON.parse(sessionStorage.getItem('rosterwork_session'));
      return sessao && sessao.access_token ? sessao.access_token : null;
    } catch (e) { return null; }
  }

  /* seleção aplicada (confirmada no "Aplicar"): a fonte da verdade é o sessionStorage,
     não o estado em memória do seletor (que pode ter marcações ainda não aplicadas) */
  function idsSelecionados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* lista plana -> mapa unidade_id -> nó e lista de raízes */
  function construirArvore(lista) {
    var mapa = {};
    var raizes = [];
    lista.forEach(function (u) { mapa[u.unidade_id] = { unidade: u, filhos: [] }; });
    lista.forEach(function (u) {
      if (u.unidade_pai_id && mapa[u.unidade_pai_id]) {
        mapa[u.unidade_pai_id].filhos.push(mapa[u.unidade_id]);
      } else if (!u.unidade_pai_id) {
        raizes.push(mapa[u.unidade_id]);
      }
    });
    return { mapa: mapa, raizes: raizes };
  }

  /* ids dos ancestrais de uma unidade (a trilha até a raiz) */
  function ancestrais(mapa, id) {
    var ids = [];
    var no = mapa[id];
    if (!no) return ids;
    var u = no.unidade;
    while (u.unidade_pai_id && mapa[u.unidade_pai_id]) {
      ids.push(u.unidade_pai_id);
      u = mapa[u.unidade_pai_id].unidade;
    }
    return ids;
  }

  /* clona o molde e monta um nó (recursivo); só entra quem está na estrutura
     (marcadas + ancestrais), todos com o mesmo título escuro. Preenche a contagem
     (visível só na marcada) e, na marcada, o conteúdo (pessoas/instalações) via renderConteudo */
  function montarNo(no, marcadas, naEstrutura, porUnidade, profundidade) {
    var id = String(no.unidade.unidade_id);
    if (!naEstrutura.has(id)) return null;

    var tpl = document.getElementById('tpl-arvore-unidade');
    if (!tpl) return null;
    var elemento = tpl.content.cloneNode(true).firstElementChild;

    elemento.classList.add('arvore-grupo--aberto');

    /* profundidade visível do título: alimenta o empilhamento dos títulos fixos
       (--nivel-titulo → top no CSS). É posição calculada, não aparência. */
    var linha = elemento.querySelector('.arvore-linha');
    if (linha) linha.style.setProperty('--nivel-titulo', String(profundidade));

    elemento.querySelector('.arvore-nome').textContent = no.unidade.nome_completo || no.unidade.nome;
    elemento.querySelector('.arvore-detalhe').textContent = no.unidade.cidade || '';

    /* contagem: visível na unidade marcada; nas ancestrais fica reservada (invisível) */
    var itens = porUnidade[no.unidade.unidade_id] || [];
    var ehMarcada = marcadas.has(id);
    var contagem = elemento.querySelector('.arvore-contagem');
    if (contagem) {
      contagem.textContent = textoContagem(itens);
      if (!ehMarcada) contagem.classList.add('arvore-contagem--oculta');
    }

    /* conteúdo: só nas marcadas, montado pela página via renderConteudo */
    if (ehMarcada && opcoesAtuais && opcoesAtuais.renderConteudo) {
      var conteudo = elemento.querySelector('.arvore-conteudo');
      if (conteudo) opcoesAtuais.renderConteudo(conteudo, no.unidade, itens);
    }

    var filhos = elemento.querySelector('.arvore-filhos');
    no.filhos.forEach(function (filho) {
      var elementoFilho = montarNo(filho, marcadas, naEstrutura, porUnidade, profundidade + 1);
      if (elementoFilho) filhos.appendChild(elementoFilho);
    });

    return elemento;
  }

  /* clona um molde de estado (carregando/vazio/erro) no container; o carregando
     centraliza o giratório na área toda (o wrapper rolável vira flex centrado) */
  function mostrarEstado(idTemplate) {
    var tpl = document.getElementById(idTemplate);
    if (!tpl) return;
    containerAtual.appendChild(tpl.content.cloneNode(true));
    var rolagem = containerAtual.closest('.pagina-corpo-rolagem');
    if (rolagem) rolagem.classList.toggle('pagina-corpo-rolagem--centrado', idTemplate === 'tpl-arvore-carregando');
  }

  /* avisa a página (se ela quiser) quais itens estão nas unidades marcadas — base de filtros próprios */
  function notificarPagina(itens) {
    if (opcoesAtuais && opcoesAtuais.aoRenderizar) opcoesAtuais.aoRenderizar(itens);
  }

  var btnMais = null, btnMenos = null;   /* botões de recolher/expandir, injetados na camada da página */

  /* garante os botões +/− no canto superior direito da camada da página atual
     (toda página com .pagina-corpo--camada ganha; ex.: ajustes, sem camada, não tem) */
  function garantirControles(container) {
    var camada = (container && container.closest) ? container.closest('.pagina-corpo--camada') : null;
    btnMais = btnMenos = null;
    if (!camada) return;
    var nivel = camada.querySelector('.titulos-niveis');
    if (!nivel) {
      var tpl = document.getElementById('tpl-titulos-niveis');
      if (!tpl) return;
      nivel = tpl.content.cloneNode(true).firstElementChild;
      camada.insertBefore(nivel, camada.firstChild);
      nivel.querySelector('.titulos-niveis-mais').addEventListener('click', expandir);
      nivel.querySelector('.titulos-niveis-menos').addEventListener('click', encolher);
    }
    btnMais = nivel.querySelector('.titulos-niveis-mais');
    btnMenos = nivel.querySelector('.titulos-niveis-menos');
  }

  /* liga/desliga os botões +/− e (compat) avisa a página, se ela quiser saber */
  function notificarTitulos(podeEncolher, podeExpandir) {
    if (btnMenos) btnMenos.disabled = !podeEncolher;
    if (btnMais) btnMais.disabled = !podeExpandir;
    if (opcoesAtuais && opcoesAtuais.aoMudarTitulos) {
      opcoesAtuais.aoMudarTitulos({ podeEncolher: podeEncolher, podeExpandir: podeExpandir });
    }
  }

  function renderizar() {
    if (!containerAtual || !document.contains(containerAtual)) return;
    containerAtual.textContent = '';
    /* volta o wrapper ao fluxo normal; só o estado de carregando o centraliza (mostrarEstado) */
    var rolagem = containerAtual.closest('.pagina-corpo-rolagem');
    if (rolagem) rolagem.classList.remove('pagina-corpo-rolagem--centrado');

    if (carregando) { mostrarEstado('tpl-arvore-carregando'); notificarPagina([]); notificarTitulos(false, false); return; }
    if (houveFalha) { mostrarEstado('tpl-arvore-erro'); notificarPagina([]); notificarTitulos(false, false); return; }
    if (!unidades) { notificarPagina([]); notificarTitulos(false, false); return; }

    var ids = idsSelecionados();
    if (ids.length === 0) { mostrarEstado('tpl-arvore-vazio'); notificarPagina([]); notificarTitulos(false, false); return; }

    var arvore = construirArvore(unidades);
    var marcadas = new Set(ids.map(String));
    var naEstrutura = new Set();
    ids.forEach(function (id) {
      naEstrutura.add(String(id));
      ancestrais(arvore.mapa, Number(id)).forEach(function (aid) { naEstrutura.add(String(aid)); });
    });
    var porUnidade = agrupar(conteudoPorRpc[rpcConteudo()] || [], chaveUnidade());

    /* a unidade marcada mais funda define até onde dá para recolher: o topo some,
       mas o pai dela (ex.: a Cia/Cibm de um pelotão) e o que tem gente nunca somem */
    var profMax = -1;
    var profMin = Infinity;
    var idMaisFundo = null;
    ids.forEach(function (id) {
      var prof = ancestrais(arvore.mapa, Number(id)).length;
      if (prof > profMax) { profMax = prof; idMaisFundo = String(id); }
      if (prof < profMin) profMin = prof;
    });
    /* não recolher além do pai da mais funda (profMax−1) nem esconder a marcada mais rasa (profMin) */
    var maximo = Math.max(0, Math.min(profMin, profMax - 1));
    if (titulosOcultos > maximo) titulosOcultos = maximo;
    if (titulosOcultos < 0) titulosOcultos = 0;

    /* com níveis recolhidos, a árvore começa no nó da trilha que sobrou no topo;
       sem recolhimento, desenha as raízes como antes */
    var raizVisivel = null;
    if (titulosOcultos > 0 && idMaisFundo) {
      raizVisivel = arvore.mapa[idMaisFundo];
      for (var p = 0; p < profMax - titulosOcultos; p++) {
        var paiId = raizVisivel.unidade.unidade_pai_id;
        if (paiId && arvore.mapa[paiId]) raizVisivel = arvore.mapa[paiId];
      }
    }
    if (raizVisivel) {
      var elementoRaiz = montarNo(raizVisivel, marcadas, naEstrutura, porUnidade, 0);
      if (elementoRaiz) containerAtual.appendChild(elementoRaiz);
    } else {
      arvore.raizes.forEach(function (raiz) {
        var elemento = montarNo(raiz, marcadas, naEstrutura, porUnidade, 0);
        if (elemento) containerAtual.appendChild(elemento);
      });
    }

    /* informa a página quem está visível (itens das unidades marcadas) — base do filtro de graus */
    var visiveis = [];
    marcadas.forEach(function (id) { visiveis.push.apply(visiveis, porUnidade[id] || []); });
    notificarPagina(visiveis);

    /* botões +/−: pode recolher enquanto houver topo; pode expandir se algo já foi recolhido */
    notificarTitulos(titulosOcultos < maximo, titulosOcultos > 0);
  }

  /* agrupa a lista por uma chave de unidade (lotacao_atual p/ efetivo, unidade_id p/ instalações) */
  function agrupar(lista, chave) {
    var mapa = {};
    lista.forEach(function (item) {
      var u = item[chave];
      if (!mapa[u]) mapa[u] = [];
      mapa[u].push(item);
    });
    return mapa;
  }

  /* chama uma RPC do Supabase (POST) e devolve a lista (ou null); aceita um corpo opcional */
  async function buscarRpc(nome, corpo) {
    try {
      var resposta = await RosterWork.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} });
      if (!resposta.ok) return null;
      var lista = await resposta.json();
      return Array.isArray(lista) ? lista : null;
    } catch (e) { return null; }
  }

  /* carrega a hierarquia de unidades e o conteúdo da página (em cache; o conteúdo por RPC) */
  /* corpo opcional para a RPC de conteúdo (a página pode mandar p_admin_cpf, período, etc.);
     se for função, é reavaliada a cada busca — permite filtros dinâmicos (ex.: o período do histórico) */
  function corpoConteudo() {
    var c = opcoesAtuais && opcoesAtuais.corpoRpc;
    if (typeof c === 'function') return c();
    return c || {};
  }

  /* silencioso=true: revalidação em 2º plano (sem giratório) — mostra o cache enquanto rebusca */
  async function carregarDados(silencioso) {
    if (!obterToken()) return;

    var rpc = rpcConteudo();
    var temCache = !!(unidades && conteudoPorRpc[rpc]);   // já há dado bom na tela
    if (!silencioso) { carregando = true; renderizar(); }
    var resultados = await Promise.all([
      buscarRpc('buscar_unidades_ordenadas'),
      buscarRpc(rpc, corpoConteudo())
    ]);
    if (resultados[0]) unidades = resultados[0];
    if (resultados[1]) conteudoPorRpc[rpc] = resultados[1];
    /* falha de QUALQUER uma das RPCs vira erro — mas uma revalidação de 2º plano que falha
       mantém o cache bom que já está na tela (não apaga a árvore com erro) */
    houveFalha = (!resultados[0] || !resultados[1]) && !temCache;
    if (!silencioso) carregando = false;
    renderizar();
  }

  /* recolhe ou expande um nível de título do topo; o render aplica os limites */
  function encolher() { titulosOcultos++; renderizar(); }
  function expandir() { if (titulosOcultos > 0) titulosOcultos--; renderizar(); }

  /* API pública: a página chama isto passando o container e (opcional)
     { renderConteudo, rpcConteudo, chaveUnidade, textoContagem, aoRenderizar, aoMudarTitulos } */
  function montar(container, opcoes) {
    containerAtual = container;
    opcoesAtuais = opcoes || {};
    titulosOcultos = 0;
    garantirControles(container);
    if (!ouvinteRegistrado) {
      ouvinteRegistrado = true;
      /* nova seleção aplicada no seletor: volta a mostrar a árvore inteira (desde o topo) */
      window.addEventListener('rosterwork_units_changed', function () {
        titulosOcultos = 0;
        renderizar();
      });
    }
    if (unidades && conteudoPorRpc[rpcConteudo()]) {
      renderizar();          // mostra o cache na hora (sem piscar)
      carregarDados(true);   // revalida em 2º plano; re-renderiza quando o dado fresco chega
      return Promise.resolve();
    }
    return carregarDados();
  }

  /* rebusca a hierarquia e o conteúdo da página atual e re-renderiza (ex.: após cadastrar) */
  function recarregar() { conteudoPorRpc[rpcConteudo()] = null; return carregarDados(); }

  /* nó da unidade por id, na hierarquia em cache (ou null) */
  function acharUnidade(id) {
    if (!unidades || id == null) return null;
    for (var i = 0; i < unidades.length; i++) {
      if (String(unidades[i].unidade_id) === String(id)) return unidades[i];
    }
    return null;
  }

  /* unidade pai de uma unidade (ou null) — ex.: o painel mostra "companhia / pelotão" */
  function pai(unidadeId) {
    var u = acharUnidade(unidadeId);
    return u ? acharUnidade(u.unidade_pai_id) : null;
  }

  window.RosterWork.arvoreUnidades = { montar: montar, atualizar: renderizar, recarregar: recarregar, encolher: encolher, expandir: expandir, pai: pai };
})();
