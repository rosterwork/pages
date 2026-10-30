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
   populados dos eventos carregados. Moldes em historico.html.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var periodo = '30';     // padrão: últimos 30 dias (persiste entre navegações)
  var filtros = null;     // o botão Filtros (Tipo e Autor), criado no iniciar


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

  /* aplica os filtros de tipo e autor (em memória) a uma lista de eventos */
  function aplicarFiltros(itens) {
    return (itens || []).filter(function (e) {
      return !filtros || (filtros.passa('tipo', e.entidade) && filtros.passa('autor', e.autor_cpf));
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
    atestado: { aba: 'Usuários', icone: 'icone-usuarios' },
    ferias: { aba: 'Usuários', icone: 'icone-usuarios' },
    licenca: { aba: 'Usuários', icone: 'icone-usuarios' },
    dispensa: { aba: 'Usuários', icone: 'icone-usuarios' },
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

  /* a árvore avisa quais eventos estão nas unidades marcadas → alimenta as colunas Tipo e Autor */
  function aoRenderizar(eventos) {
    if (!filtros) return;
    filtros.definir('tipo', distintos(eventos, 'entidade', function (e) { return rotuloTipo(e.entidade); }));
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
    /* Tipo e Autor vêm dos eventos carregados: o botão Filtros é novo a cada visita (volta a "Todos";
       o Período persiste de propósito) */
    var caixa = conteudo.querySelector('#historico-filtros');
    filtros = (caixa && RosterWork.filtros) ? RosterWork.filtros.criar(caixa, {
      aoMudar: function () { if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.atualizar(); }
    }) : null;
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
      aoRenderizar: aoRenderizar
    });
  }

  window.RosterWork.paginas.historico = { iniciar: iniciar };
})();
