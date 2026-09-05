/* ============================================================
   HISTÓRICO — página de auditoria (só admin)
   Reusa o componente geral-arvore-unidades: os eventos vêm da RPC
   listar_historico (admin + período via corpoRpc) e são agrupados
   por unidade na árvore, mostrando só as unidades marcadas no
   seletor do cabeçalho. Cada evento = cartão (a página [ícone+nome]
   como título + o assunto como subtítulo + autor · verbo · data) +
   as mudanças desenhadas pelo geral-resumo.
   Filtros: Período (rebusca), Tipo e Autor (em memória, populados
   dos eventos carregados). Moldes em historico.html.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var periodo = '30';     // padrão: últimos 30 dias (persiste entre navegações)
  var filtroTipo = null;  // { valor, rotulo } ou null = todos
  var filtroAutor = null; // { valor, rotulo } ou null = todos


  /* atalho de período -> data de início (ISO) ou null (Tudo) */
  function dataInicioDoPeriodo() {
    if (periodo === 'tudo') return null;
    var d = new Date();
    d.setHours(0, 0, 0, 0);                          // começo do dia de hoje
    if (periodo === '7') d.setDate(d.getDate() - 6);  // hoje + 6 dias atrás = 7 dias
    else if (periodo === '30') d.setDate(d.getDate() - 29);
    return d.toISOString();
  }

  /* corpo da RPC listar_historico (admin + período) — função: reavaliada a cada (re)carga */
  function corpoRpc() {
    return { p_admin_cpf: RosterWork.sessao.cpf(), p_data_inicio: dataInicioDoPeriodo() };
  }

  function rotuloAcao(acao) {
    var m = RosterWork.mensagens.historico.acoes;
    return (m && m[acao]) || acao || '';
  }
  function rotuloTipo(entidade) {
    var m = RosterWork.mensagens.historico.tipos;
    return (m && m[entidade]) || entidade || '';
  }

  /* aplica os filtros de tipo e autor (em memória) a uma lista de eventos */
  function aplicarFiltros(itens) {
    return (itens || []).filter(function (e) {
      if (filtroTipo && e.entidade !== filtroTipo.valor) return false;
      if (filtroAutor && e.autor_cpf !== filtroAutor.valor) return false;
      return true;
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
    escala: { aba: 'Escala', icone: 'icone-escalas' },
    distribuicao: { aba: 'Distribuição', icone: 'icone-distribuicao' },
    regra: { aba: 'Distribuição', icone: 'icone-distribuicao' },
    folga: { aba: 'Folgas', icone: 'icone-folgas' },
    extra_cota: { aba: 'Extrajornada', icone: 'icone-extrajornada' },
    extra_alocacao: { aba: 'Extrajornada', icone: 'icone-extrajornada' },
    atestado: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    ferias: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
    licenca: { aba: 'Afastamentos', icone: 'icone-afastamentos' },
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

  /* monta o cartão: título = página (ícone + nome) · subtítulo = assunto · autor · verbo · data · mudanças */
  function montarEvento(ev) {
    var card = RosterWork.tpl('tpl-historico-evento');
    if (!card) return null;

    var info = ABAS[ev.entidade] || { aba: ev.entidade || '', icone: null };
    card.querySelector('.historico-evento-aba').textContent = info.aba;
    var icone = card.querySelector('.historico-evento-icone');
    var uso = card.querySelector('.historico-evento-icone use');
    if (info.icone && uso) uso.setAttribute('href', 'icones/' + info.icone + '.svg#' + info.icone);
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
    return card;
  }

  /* a árvore chama isto por unidade marcada: monta os eventos (filtrados) daquela unidade */
  function renderConteudo(container, unidade, itens) {
    var lista = aplicarFiltros(itens).sort(function (a, b) {
      return String(b.criado_em || '').localeCompare(String(a.criado_em || ''));
    });
    if (lista.length === 0) {
      var vazio = RosterWork.tpl('tpl-historico-vazio');
      if (vazio) container.appendChild(vazio);
      return;
    }
    var wrap = RosterWork.tpl('tpl-historico-eventos') || container;
    lista.forEach(function (ev) { var c = montarEvento(ev); if (c) wrap.appendChild(c); });
    if (wrap !== container) container.appendChild(wrap);
  }

  /* ---------- filtros Tipo / Autor (em memória) ---------- */

  /* valores distintos de uma chave nos eventos, com rótulo, ordenados */
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

  /* reflete a seleção no gatilho (texto + "x" de limpar) */
  function aplicarSelecao(idBase, textoTodos, sel) {
    var texto = document.getElementById(idBase + '-texto');
    var gatilho = document.getElementById(idBase + '-seletor');
    if (texto) texto.textContent = sel ? sel.rotulo : textoTodos;
    if (gatilho) gatilho.classList.toggle('seletor--com-filtro', !!sel);
  }

  /* (re)monta o menu de um filtro: "Todos" + as opções distintas */
  function popularFiltro(idBase, textoTodos, opcoes, definir) {
    var menu = document.getElementById(idBase + '-menu');
    if (!menu) return;
    menu.textContent = '';
    function add(sel) {
      var b = RosterWork.tpl('tpl-historico-opcao');
      if (!b) return;
      b.textContent = sel ? sel.rotulo : textoTodos;
      b.addEventListener('click', function () {
        definir(sel);
        aplicarSelecao(idBase, textoTodos, sel);
        if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.atualizar();
      });
      menu.appendChild(b);
    }
    add(null);
    opcoes.forEach(function (o) { add(o); });
  }

  /* a árvore avisa quais eventos estão nas unidades marcadas → alimenta os dropdowns */
  function aoRenderizar(eventos) {
    popularFiltro('historico-tipo', 'Todos os tipos',
      distintos(eventos, 'entidade', function (e) { return rotuloTipo(e.entidade); }),
      function (sel) { filtroTipo = sel; });
    popularFiltro('historico-autor', 'Todos os autores',
      distintos(eventos, 'autor_cpf', function (e) { return e.autor || e.autor_cpf; }),
      function (sel) { filtroAutor = sel; });
  }

  /* o "x" de limpar de um filtro volta para "Todos" */
  function ligarLimpar(idBase, textoTodos, definir) {
    var limpar = document.getElementById(idBase + '-limpar');
    if (limpar) limpar.addEventListener('click', function (ev) {
      ev.stopPropagation();   // não abre o dropdown
      definir(null);
      aplicarSelecao(idBase, textoTodos, null);
      if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.atualizar();
    });
  }

  /* trocar o período é uma nova busca → tipo/autor voltam a "Todos" */
  function limparFiltrosSecundarios() {
    filtroTipo = null;
    filtroAutor = null;
    aplicarSelecao('historico-tipo', 'Todos os tipos', null);
    aplicarSelecao('historico-autor', 'Todos os autores', null);
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
          limparFiltrosSecundarios();
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
    /* os filtros de Tipo/Autor são derivados dos eventos carregados: ao reentrar na página,
       zera para não filtrar em silêncio com o gatilho mostrando "Todos" (o Período persiste de propósito) */
    filtroTipo = null;
    filtroAutor = null;
    ligarPeriodo(conteudo);
    sincronizarLabelPeriodo(conteudo);
    ligarLimpar('historico-tipo', 'Todos os tipos', function (s) { filtroTipo = s; });
    ligarLimpar('historico-autor', 'Todos os autores', function (s) { filtroAutor = s; });
    var container = conteudo.querySelector('#arvore-historico');
    if (!container || !RosterWork.arvoreUnidades) return;
    return RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: 'listar_historico',
      chaveUnidade: 'unidade_id',
      corpoRpc: corpoRpc,
      textoContagem: textoContagem,
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizar
    });
  }

  window.RosterWork.paginas.historico = { iniciar: iniciar };
})();
