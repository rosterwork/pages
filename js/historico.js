/* ============================================================
   HISTÓRICO — página de auditoria (só admin)
   Reusa o componente geral-arvore-unidades: os eventos vêm da RPC
   listar_historico (admin + período via corpoRpc) e são agrupados
   por unidade na árvore, mostrando só as unidades marcadas no
   seletor do cabeçalho. Cada evento = cartão (a página [ícone+nome]
   como título + o assunto como subtítulo + autor · verbo · data) +
   as mudanças desenhadas pelo geral-resumo.
   Filtros: Período (rebusca, à esquerda) e o botão Filtros (componente
   geral-filtros) com Tipo e Autor, em memória e de escolha múltipla,
   populados dos eventos carregados. A busca (componente geral-busca)
   esconde, em memória, os eventos sem o texto: procura no que o cartão
   mostra e nas mudanças. Moldes em historico.html.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var periodo = '30';     // padrão: últimos 30 dias (persiste entre navegações)
  var filtros = null;     // o botão Filtros (Tipo e Autor), criado no iniciar
  var termoBusca = '';    // o texto da busca (fica ao trocar o período; volta vazio a cada visita)


  /* atalho de período -> data de início (ISO) ou null (Tudo) */
  function dataInicioDoPeriodo() {
    if (periodo === 'tudo') return null;
    var d = new Date();
    d.setHours(0, 0, 0, 0);                          // começo do dia de hoje
    if (periodo === '7') d.setDate(d.getDate() - 6);  // hoje + 6 dias atrás = 7 dias
    else if (periodo === '30') d.setDate(d.getDate() - 29);
    return d.toISOString();
  }

  /* corpo da RPC listar_historico (o período; o admin vem da sessão) — função: reavaliada a cada (re)carga */
  function corpoRpc() {
    return { p_data_inicio: dataInicioDoPeriodo() };
  }

  function rotuloAcao(acao) {
    var m = RosterWork.mensagens.historico.acoes;
    return (m && m[acao]) || acao || '';
  }
  function rotuloTipo(entidade) {
    var m = RosterWork.mensagens.historico.tipos;
    return (m && m[entidade]) || entidade || '';
  }

  /* aplica os filtros de tipo e autor e a busca (em memória) a uma lista de eventos */
  function aplicarFiltros(itens) {
    return (itens || []).filter(function (e) {
      return (!filtros || (filtros.passa('tipo', e.entidade) && filtros.passa('autor', e.autor_cpf))) && casaBusca(e);
    });
  }

  /* selo da unidade na árvore: "N registros" (já contando os filtros) */
  function textoContagem(itens) {
    var n = aplicarFiltros(itens).length;
    return n === 1 ? '1 registro' : n + ' registros';
  }

  /* aba do sidebar (tag) + ícone, por entidade do evento */
  var ABAS = {
    instalacao: { aba: 'Postos', icone: 'icone-postos' },
    viatura: { aba: 'Postos', icone: 'icone-postos' },
    usuario: { aba: 'Usuários', icone: 'icone-usuarios' },
    antiguidade: { aba: 'Usuários', icone: 'icone-usuarios' },
    escala: { aba: 'Escala', icone: 'icone-escalas' },
    distribuicao: { aba: 'Distribuição', icone: 'icone-distribuicao' },
    regra: { aba: 'Distribuição', icone: 'icone-distribuicao' },
    folga: { aba: 'Folgas', icone: 'icone-folgas' },
    extra_cota: { aba: 'Extrajornada', icone: 'icone-extrajornada' },
    extra_alocacao: { aba: 'Extrajornada', icone: 'icone-extrajornada' },
    extra_disponibilidade: { aba: 'Extrajornada', icone: 'icone-extrajornada' },
    extra_prazos: { aba: 'Extrajornada', icone: 'icone-extrajornada' },
    extra_regras: { aba: 'Ajustes', icone: 'icone-ajustes' },
    pontuacao: { aba: 'Ajustes', icone: 'icone-ajustes' },
    atestado: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    ferias: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    licenca: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    dispensa: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    missao: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    afastamento: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    unidade: { aba: 'Ajustes', icone: 'icone-ajustes' }
  };

  /* título do evento = assunto (resumo.titulo); fallback p/ eventos antigos sem título */
  function tituloEvento(ev) {
    var r = ev.resumo || {};
    if (r.titulo) return r.titulo;
    var alvos = r.alvos || [];
    if (alvos.length && alvos[0].onde) return alvos[0].onde;
    return '-';
  }

  /* ---------- busca (em memória, sobre o período carregado) ---------- */

  /* qualquer valor do resumo (texto, número, lista ou objeto) vira texto para a busca */
  function textoDe(valor) {
    if (valor == null) return '';
    if (typeof valor !== 'object') return String(valor);
    return Object.keys(valor).map(function (k) { return textoDe(valor[k]); }).join(' ');
  }

  /* o que o cabeçalho do cartão mostra: a página, o assunto, quem fez, o que fez, a data e a unidade */
  function textoCabecalho(ev) {
    var quando = (RosterWork.resumo && RosterWork.resumo.formatarQuando) ? RosterWork.resumo.formatarQuando(ev.criado_em) : '';
    return [(ABAS[ev.entidade] || {}).aba, tituloEvento(ev), ev.autor, rotuloAcao(ev.acao), ev.unidade, ev.cidade, quando].join(' ');
  }

  /* o que só aparece com o cartão aberto: as mudanças (onde, o rótulo, o de e o para) */
  function textoDetalhes(ev) {
    return ((ev.resumo || {}).alvos || []).map(function (alvo) {
      return [alvo.onde].concat((alvo.mudancas || []).map(function (m) {
        return [m.rotulo, textoDe(m.de), textoDe(m.para)].join(' ');
      })).join(' ');
    }).join(' ');
  }

  function contem(texto) {
    return RosterWork.busca.normalizar(texto).indexOf(RosterWork.busca.normalizar(termoBusca)) !== -1;
  }
  function casaBusca(ev) { return !termoBusca || contem(textoCabecalho(ev)) || contem(textoDetalhes(ev)); }

  /* o texto está só nos detalhes: o cartão abre sozinho, senão a pessoa não vê o que achou */
  function casaSoNosDetalhes(ev) { return !!termoBusca && !contem(textoCabecalho(ev)) && contem(textoDetalhes(ev)); }

  /* monta o cartão: título = página (ícone + nome) · subtítulo = assunto · autor · verbo · data · mudanças */
  function montarEvento(ev) {
    var card = RosterWork.tpl('tpl-historico-evento');
    if (!card) return null;

    var info = ABAS[ev.entidade] || { aba: ev.entidade || '', icone: null };
    card.querySelector('.historico-evento-aba').textContent = info.aba;
    var icone = card.querySelector('.historico-evento-icone');
    var uso = card.querySelector('.historico-evento-icone use');
    if (info.icone && uso) uso.setAttribute('href', 'icones/todos.svg#' + info.icone);
    else if (!info.icone && icone) icone.classList.add('oculto');

    card.querySelector('.historico-evento-assunto').textContent = tituloEvento(ev);
    card.querySelector('.historico-evento-autor').textContent = ev.autor || '-';
    card.querySelector('.historico-evento-acao').textContent = rotuloAcao(ev.acao);
    var quando = card.querySelector('.historico-evento-quando');
    if (RosterWork.resumo && RosterWork.resumo.formatarQuando) quando.textContent = RosterWork.resumo.formatarQuando(ev.criado_em);

    var corpo = card.querySelector('.historico-evento-corpo');
    if (RosterWork.resumo && RosterWork.resumo.desenhar) {
      var no = RosterWork.resumo.desenhar(ev.resumo, { mostrarAssunto: false, mostrarQuando: false });
      if (no) corpo.appendChild(no);
    }
    /* recolhido por padrão: o cabeçalho mostra só o resumo; clicar revela o corpo */
    var cabecalho = card.querySelector('.historico-evento-cabecalho');
    if (cabecalho) {
      cabecalho.addEventListener('click', function () {
        var aberto = cabecalho.getAttribute('aria-expanded') === 'true';
        cabecalho.setAttribute('aria-expanded', aberto ? 'false' : 'true');
        corpo.classList.toggle('oculto', aberto);
      });
    }
    /* na busca: marca o achado (o Enter vai até ele) e abre o cartão quando o texto está só nos detalhes */
    if (termoBusca) card.classList.add('busca-achado');
    if (casaSoNosDetalhes(ev) && cabecalho) {
      cabecalho.setAttribute('aria-expanded', 'true');
      corpo.classList.remove('oculto');
    }
    return card;
  }

  /* a árvore chama isto por unidade marcada: monta os eventos (filtrados) daquela unidade */
  function renderConteudo(container, unidade, itens) {
    var lista = aplicarFiltros(itens).sort(function (a, b) {
      return String(b.criado_em || '').localeCompare(String(a.criado_em || ''));
    });
    if (lista.length === 0) {
      /* havia eventos e os filtros (ou a busca) esconderam todos: a frase diz que é dos filtros */
      var peloFiltro = (itens || []).length > 0 && ((!!filtros && filtros.temFiltro()) || !!termoBusca);
      var vazio = RosterWork.tpl(peloFiltro ? 'tpl-historico-vazio-filtro' : 'tpl-historico-vazio');
      if (vazio) container.appendChild(vazio);
      return;
    }
    var wrap = RosterWork.tpl('tpl-historico-eventos') || container;
    lista.forEach(function (ev) { var c = montarEvento(ev); if (c) wrap.appendChild(c); });
    if (wrap !== container) container.appendChild(wrap);
  }

  /* ---------- filtros Tipo / Autor (em memória, no botão Filtros) ---------- */

  /* valores distintos de uma chave nos eventos, como opções do filtro, ordenadas pelo rótulo */
  function distintos(eventos, chave, rotuloDe) {
    var vistos = {}, lista = [];
    (eventos || []).forEach(function (e) {
      var v = e[chave];
      if (v == null || vistos[v]) return;
      vistos[v] = true;
      lista.push({ valor: v, rotulo: rotuloDe(e) });
    });
    lista.sort(function (a, b) { return String(a.rotulo).localeCompare(String(b.rotulo)); });
    return lista;
  }

  /* os tipos nos grupos dos cartões (ABAS: Postos, Extrajornada, Afastamentos...), em ordem alfabética; grupo com um
     tipo só fica só com o tipo */
  function tiposEmGrupos(eventos) {
    var grupos = {};
    distintos(eventos, 'entidade', function (e) { return rotuloTipo(e.entidade); }).forEach(function (opcao) {
      var grupo = (ABAS[opcao.valor] || {}).aba || opcao.rotulo;
      (grupos[grupo] = grupos[grupo] || []).push(opcao);
    });
    return Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b); }).map(function (grupo) {
      return grupos[grupo].length === 1 ? grupos[grupo][0] : { rotulo: grupo, filhos: grupos[grupo] };
    });
  }

  /* a árvore avisa quais eventos estão nas unidades marcadas → alimenta as colunas Tipo e Autor */
  function aoRenderizar(eventos) {
    if (!filtros) return;
    filtros.definir('tipo', tiposEmGrupos(eventos));
    filtros.definir('autor', distintos(eventos, 'autor_cpf', function (e) { return e.autor || e.autor_cpf; }));
  }

  /* ---------- período ---------- */

  function ligarPeriodo(conteudo) {
    var texto = conteudo.querySelector('#historico-periodo-texto');
    var itens = conteudo.querySelectorAll('#historico-periodo .dropdown-item');
    for (var i = 0; i < itens.length; i++) {
      (function (item) {
        item.addEventListener('click', function () {
          periodo = item.getAttribute('data-periodo');
          if (texto) texto.textContent = item.textContent;
          if (filtros) filtros.limpar();   /* nova busca → Tipo e Autor voltam a "Todos" */
          if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
        });
      })(itens[i]);
    }
  }

  /* reflete o período atual (persiste entre navegações) no rótulo do botão */
  function sincronizarLabelPeriodo(conteudo) {
    var texto = conteudo.querySelector('#historico-periodo-texto');
    var item = conteudo.querySelector('#historico-periodo .dropdown-item[data-periodo="' + periodo + '"]');
    if (texto && item) texto.textContent = item.textContent;
  }

  /* a navegação chama iniciar() toda vez que a página é exibida */
  function iniciar(conteudo) {
    /* Tipo e Autor vêm dos eventos carregados: o botão Filtros é novo a cada visita e volta com a escolha guardada na
       sessão (o Período também persiste; trocar o período limpa Tipo e Autor) */
    var caixa = conteudo.querySelector('#historico-filtros');
    filtros = (caixa && RosterWork.filtros) ? RosterWork.filtros.criar(caixa, {
      aoMudar: function () { if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.atualizar(); },
      guardar: 'historico'
    }) : null;
    /* a busca: o texto fica ao trocar o período (para achar algo mais antigo, basta passar para Tudo) */
    termoBusca = '';
    var caixaBusca = conteudo.querySelector('#historico-busca');
    if (caixaBusca && RosterWork.busca) RosterWork.busca.criar({
      caixa: caixaBusca,
      aoBuscar: function (termo) { termoBusca = termo || ''; if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.atualizar(); }
    });
    ligarPeriodo(conteudo);
    sincronizarLabelPeriodo(conteudo);
    var container = conteudo.querySelector('#arvore-historico');
    if (!container || !RosterWork.arvoreUnidades) return;
    return RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: 'listar_historico',
      chaveUnidade: 'unidade_id',
      corpoRpc: corpoRpc,
      textoContagem: textoContagem,
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizar,
      etapas: 'historicoAbrir'
    });
  }

  window.RosterWork.paginas.historico = { iniciar: iniciar };
})();
