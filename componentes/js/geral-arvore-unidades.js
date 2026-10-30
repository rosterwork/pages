/* ============================================================
   ÁRVORE DE UNIDADES — componente compartilhado
   Cada unidade marcada no seletor vira um bloco cinza com o título
   dentro (nome completo, sigla · cidade e a contagem) e o conteúdo
   da página; os blocos ficam um embaixo do outro, na ordem da
   hierarquia (o pai antes dos filhos). No alto, a trilha com as
   siglas das unidades de cima, sempre inteira: ela acompanha o
   bloco que está passando embaixo dela (quando o bloco da companhia
   sai e chega o do pelotão, a companhia entra na trilha).
   Moldes no index.html: #tpl-arvore-bloco, #tpl-arvore-trilha,
   #tpl-arvore-trilha-item e #tpl-arvore-bloquinho (para as páginas).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var unidades = null;          // cache da hierarquia (lista plana)
  var conteudoPorRpc = {};      // cache do conteúdo por RPC: { 'buscar_efetivo': [...], 'listar_instalacoes': [...] }
  var carregando = false;
  var pedidoAtual = 0;          // senha da carga (latest-wins): só a resposta do pedido mais novo entra na tela
  var houveFalha = false;       // a última carga da hierarquia falhou (rede/servidor) → mostra erro, não branco
  var containerAtual = null;    // onde a árvore é desenhada na página atual
  var opcoesAtuais = null;      // { renderConteudo, rpcConteudo, chaveUnidade, textoContagem, corpoRpc, aoRenderizar }
  var ouvintesRegistrados = false;
  var trilhaAtual = null;       // a trilha desenhada na página atual
  var idTrilha = null;          // a unidade cujo caminho a trilha mostra agora
  var quadroPedido = false;     // uma atualização da trilha por quadro de rolagem
  var observadorTrilha = null;  // refaz a trilha quando ela volta a aparecer (troca de aba)

  /* A página escolhe a fonte de conteúdo; o padrão é o efetivo (usuários).
     Postos passa rpcConteudo:'listar_instalacoes' e chaveUnidade:'unidade_id'. Pode ser uma função, lida a cada carga
     (o Dia da Escala: a leitura de sempre ou a prévia do rascunho), como o corpoRpc */
  function rpcConteudo() {
    var r = opcoesAtuais && opcoesAtuais.rpcConteudo;
    if (typeof r === 'function') r = r();
    return r || 'buscar_efetivo';
  }
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

  /* ---------- trilha: as siglas das unidades de cima, da raiz até o pai ---------- */
  function preencherTrilha(elemento, unidadeId) {
    elemento.textContent = '';
    var cadeia = [];
    var u = pai(unidadeId);
    while (u) { cadeia.unshift(u); u = pai(u.unidade_id); }
    cadeia.forEach(function (unidade) {
      var item = RosterWork.tpl('tpl-arvore-trilha-item');
      if (!item) return;
      item.querySelector('.arvore-trilha-nome').textContent = unidade.nome || '';
      elemento.appendChild(item);
    });
  }

  /* o bloco embaixo da trilha é o primeiro cujo fim ainda não passou por ela.
     Escondida (aba fechada), a trilha fica como estava: o observador a refaz ao voltar */
  function atualizarTrilha() {
    quadroPedido = false;
    if (!trilhaAtual || !containerAtual || !document.contains(trilhaAtual)) return;
    if (!trilhaAtual.getClientRects().length) return;
    var limite = trilhaAtual.getBoundingClientRect().bottom;
    var blocos = containerAtual.querySelectorAll('.arvore-bloco');
    var atual = blocos.length ? blocos[0] : null;
    for (var i = 0; i < blocos.length; i++) {
      if (blocos[i].getBoundingClientRect().bottom > limite) { atual = blocos[i]; break; }
    }
    var id = atual ? atual.getAttribute('data-unidade-id') : null;
    if (id === idTrilha) return;
    idTrilha = id;
    preencherTrilha(trilhaAtual, id);
  }

  /* qualquer rolagem (a área da árvore muda de página para página): uma atualização por quadro */
  function aoRolar() {
    if (quadroPedido || !trilhaAtual) return;
    quadroPedido = true;
    window.requestAnimationFrame(atualizarTrilha);
  }

  /* ---------- bloco: a unidade marcada, com o título dentro e o conteúdo da página ---------- */
  function montarBloco(unidade, itens) {
    var bloco = RosterWork.tpl('tpl-arvore-bloco');
    if (!bloco) return null;
    bloco.setAttribute('data-unidade-id', unidade.unidade_id);
    bloco.querySelector('.arvore-bloco-nome').textContent = unidade.nome_completo || unidade.nome;
    bloco.querySelector('[data-sigla]').textContent = unidade.nome || '';
    bloco.querySelector('[data-cidade]').textContent = unidade.cidade || '';
    var contagem = bloco.querySelector('.arvore-contagem');
    var texto = textoContagem(itens);
    contagem.textContent = texto;
    contagem.classList.toggle('oculto', !texto);
    if (opcoesAtuais && opcoesAtuais.renderConteudo) {
      opcoesAtuais.renderConteudo(bloco.querySelector('.arvore-conteudo'), unidade, itens);
    }
    return bloco;
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

  function renderizar() {
    if (!containerAtual || !document.contains(containerAtual)) return;
    containerAtual.textContent = '';
    trilhaAtual = null;
    idTrilha = null;
    if (observadorTrilha) observadorTrilha.disconnect();
    /* volta o wrapper ao fluxo normal; só o estado de carregando o centraliza (mostrarEstado) */
    var rolagem = containerAtual.closest('.pagina-corpo-rolagem');
    if (rolagem) rolagem.classList.remove('pagina-corpo-rolagem--centrado');

    if (carregando) { mostrarEstado('tpl-arvore-carregando'); notificarPagina([]); return; }
    if (houveFalha) { mostrarEstado('tpl-arvore-erro'); notificarPagina([]); return; }
    if (!unidades) { notificarPagina([]); return; }

    var ids = idsSelecionados();
    if (ids.length === 0) { mostrarEstado('tpl-arvore-vazio'); notificarPagina([]); return; }

    var arvore = construirArvore(unidades);
    var marcadas = new Set(ids.map(String));
    var porUnidade = agrupar(conteudoPorRpc[rpcConteudo()] || [], chaveUnidade());

    /* a trilha no alto e, embaixo, os blocos das marcadas na ordem da hierarquia */
    trilhaAtual = RosterWork.tpl('tpl-arvore-trilha');
    if (trilhaAtual) containerAtual.appendChild(trilhaAtual);
    function percorrer(no) {
      if (marcadas.has(String(no.unidade.unidade_id))) {
        var bloco = montarBloco(no.unidade, porUnidade[no.unidade.unidade_id] || []);
        if (bloco) containerAtual.appendChild(bloco);
      }
      no.filhos.forEach(percorrer);
    }
    arvore.raizes.forEach(percorrer);
    atualizarTrilha();
    if (trilhaAtual && observadorTrilha) observadorTrilha.observe(trilhaAtual);

    /* informa a página quem está visível (itens das unidades marcadas) — base do filtro de graus */
    var visiveis = [];
    marcadas.forEach(function (id) { visiveis.push.apply(visiveis, porUnidade[id] || []); });
    notificarPagina(visiveis);
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

  /* corpo opcional para a RPC de conteúdo (a página pode mandar o período, etc.);
     se for função, é reavaliada a cada busca — permite filtros dinâmicos (ex.: o período do histórico) */
  function corpoConteudo() {
    var c = opcoesAtuais && opcoesAtuais.corpoRpc;
    if (typeof c === 'function') return c();
    return c || {};
  }

  /* carrega a hierarquia de unidades e o conteúdo da página (em cache; o conteúdo por RPC).
     silencioso=true: revalidação em 2º plano (sem giratório) — mostra o cache enquanto rebusca.
     A resposta de um pedido que um mais novo substituiu (outra página, outro dia, outro período)
     é descartada: nunca desenha nem entra no cache. Resolve true (desenhou) ou false (descartada) */
  async function carregarDados(silencioso) {
    if (!obterToken()) return;

    var meu = ++pedidoAtual;
    var rpc = rpcConteudo();
    var temCache = !!(unidades && conteudoPorRpc[rpc]);   // já há dado bom na tela
    if (!silencioso) { carregando = true; renderizar(); }
    var resultados = await Promise.all([
      buscarRpc('buscar_unidades_ordenadas'),
      buscarRpc(rpc, corpoConteudo())
    ]);
    if (meu !== pedidoAtual) return false;
    if (resultados[0]) unidades = resultados[0];
    if (resultados[1]) conteudoPorRpc[rpc] = resultados[1];
    /* falha de QUALQUER uma das RPCs vira erro — mas uma revalidação de 2º plano que falha
       mantém o cache bom que já está na tela (não apaga a árvore com erro) */
    houveFalha = (!resultados[0] || !resultados[1]) && !temCache;
    carregando = false;   // a resposta mais nova encerra o carregando, mesmo que a dela fosse silenciosa
    renderizar();
    return true;
  }

  /* ouvintes de uma vez só: nova seleção no seletor, rolagem (a trilha) e a volta da trilha à tela */
  function registrarOuvintes() {
    if (ouvintesRegistrados) return;
    ouvintesRegistrados = true;
    window.addEventListener('rosterwork_units_changed', renderizar);
    document.addEventListener('scroll', aoRolar, true);
    if (window.IntersectionObserver) observadorTrilha = new IntersectionObserver(aoRolar);
  }

  /* API pública: a página chama isto passando o container e (opcional)
     { renderConteudo, rpcConteudo, chaveUnidade, textoContagem, corpoRpc, aoRenderizar, buscaPelaPagina }.
     buscaPelaPagina: a página busca logo em seguida (recarregar); aqui só monta, com o carregando,
     e descarta a carga que ainda esteja no ar (ex.: o Dia da Escala ao trocar de dia) */
  function montar(container, opcoes) {
    containerAtual = container;
    opcoesAtuais = opcoes || {};
    registrarOuvintes();
    if (opcoesAtuais.buscaPelaPagina) {
      pedidoAtual++;
      carregando = true;
      renderizar();
      return Promise.resolve();
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

  /* trilha fora da árvore (ex.: a aba Antiguidade, com uma unidade só): carrega a hierarquia se ainda não veio */
  function trilha(elemento, unidadeId) {
    if (unidades) { preencherTrilha(elemento, unidadeId); return; }
    buscarRpc('buscar_unidades_ordenadas').then(function (lista) {
      if (lista) unidades = lista;
      if (document.contains(elemento)) preencherTrilha(elemento, unidadeId);
    });
  }

  window.RosterWork.arvoreUnidades = { montar: montar, atualizar: renderizar, recarregar: recarregar, pai: pai, trilha: trilha };
})();
