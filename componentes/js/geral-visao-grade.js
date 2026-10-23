/* ============================================================
   COMPONENTE geral-visao-grade — a visão das grades, lembrada por
   usuário no banco (como o tema): a última visão da Escala e a
   escolha Agenda | Calendário. Essa escolha é uma só para a Escala
   (Mês) e a Extrajornada (Calendário e Distribuição): trocar numa
   tela vale nas outras. Cada tipo de aparelho lembra a sua (o
   celular, pela tela de celular, e o computador). Tudo fica no
   objeto escala_visao das preferências (fn_preferencias_salvar):
   { modo, mes, mes_celular, colunas_tipo, colunas_qtd }, com `mes`
   = Agenda | Calendário do computador e `mes_celular` = a do celular.
   API: RosterWork.visaoGrade.ler() · agendaOuCalendario() · gravar(mudancas)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function lerPreferencias() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; }
    catch (e) { return {}; }
  }

  /* a visão guardada; vazia = nunca escolheu */
  function ler() {
    var visao = lerPreferencias().escala_visao;
    return (visao && typeof visao === 'object') ? visao : {};
  }

  /* onde fica a escolha Agenda | Calendário do tipo de aparelho em uso */
  function chaveDoAparelho() {
    return (window.RosterWork.celular && window.RosterWork.celular()) ? 'mes_celular' : 'mes';
  }

  /* 'agenda' ou 'calendario', a do tipo de aparelho em uso; sem escolha, a Agenda */
  function agendaOuCalendario() {
    return ler()[chaveDoAparelho()] === 'calendario' ? 'calendario' : 'agenda';
  }

  /* junta as mudanças à visão guardada (a escolha `agendaOuCalendario` vai para a chave do tipo de
     aparelho em uso; a do outro fica como está) e grava na sessão e no banco (só com alguém logado) */
  function gravar(mudancas) {
    var prefs = lerPreferencias();
    var visao = ler();
    Object.keys(mudancas).forEach(function (nome) {
      visao[nome === 'agendaOuCalendario' ? chaveDoAparelho() : nome] = mudancas[nome];
    });
    prefs.escala_visao = visao;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    var R = window.RosterWork;
    if (R.apiFetch && R.obterToken && R.obterToken()) {
      R.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
        metodo: 'POST',
        corpo: { p_escala_visao: visao }
      }).catch(function () {});   // falhou: só não lembra desta vez (a tela já está certa)
    }
  }

  window.RosterWork.visaoGrade = { ler: ler, agendaOuCalendario: agendaOuCalendario, gravar: gravar };
})();
