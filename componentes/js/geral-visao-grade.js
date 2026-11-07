/* ============================================================
   COMPONENTE geral-visao-grade — a visão das grades, lembrada por
   usuário no banco (como o tema): a última visão da Escala e a
   escolha Agenda | Calendário. Essa escolha é uma só para a Escala
   (Mês) e a Extrajornada (Calendário e Distribuição): trocar numa
   tela vale nas outras. Cada tipo de aparelho (o celular, pela tela
   de celular, e o computador) lembra a sua visão, a sua Agenda |
   Calendário e a sua quantidade de colunas. Tudo fica no objeto
   escala_visao das preferências (fn_preferencias_salvar): { modo,
   modo_celular, mes, mes_celular, colunas_tipo, colunas_qtd,
   colunas_qtd_celular }; a chave com _celular é a do celular, e
   `mes` é a Agenda | Calendário do computador.
   API: RosterWork.visaoGrade.ler() · modo() · agendaOuCalendario() ·
   quantasColunas() · gravar(mudancas)
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

  function noCelular() {
    return !!(window.RosterWork.celular && window.RosterWork.celular());
  }

  /* as escolhas de cada tipo de aparelho: [a chave no computador, a chave no celular] */
  var POR_APARELHO = {
    modo: ['modo', 'modo_celular'],
    agendaOuCalendario: ['mes', 'mes_celular'],
    colunas_qtd: ['colunas_qtd', 'colunas_qtd_celular']
  };

  function chaveDoAparelho(nome) {
    return POR_APARELHO[nome][noCelular() ? 1 : 0];
  }

  /* 'agenda' ou 'calendario', a do tipo de aparelho em uso; sem escolha, a Agenda */
  function agendaOuCalendario() {
    return ler()[chaveDoAparelho('agendaOuCalendario')] === 'calendario' ? 'calendario' : 'agenda';
  }

  /* a última visão da Escala no tipo de aparelho em uso. O celular que ainda não escolheu segue o computador só na Minha
     escala; as grades largas (Militares e Colunas) só abrem no celular de quem as escolheu lá */
  function modo() {
    var visao = ler();
    var escolhido = visao[chaveDoAparelho('modo')];
    if (escolhido || !noCelular()) return escolhido;
    return visao.modo === 'minha' ? 'minha' : 'mes';
  }

  /* quantas colunas o Colunas › Dias mostra no tipo de aparelho em uso; sem escolha, o celular abre com 2, as que cabem
     por tela */
  function quantasColunas() {
    return ler()[chaveDoAparelho('colunas_qtd')] || (noCelular() ? 2 : undefined);
  }

  /* junta as mudanças à visão guardada (o que é do tipo de aparelho vai para a chave dele; a do outro fica como está) e
     grava na sessão e no banco (só com alguém logado) */
  function gravar(mudancas) {
    var prefs = lerPreferencias();
    var visao = ler();
    Object.keys(mudancas).forEach(function (nome) {
      visao[POR_APARELHO[nome] ? chaveDoAparelho(nome) : nome] = mudancas[nome];
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

  window.RosterWork.visaoGrade = { ler: ler, modo: modo, agendaOuCalendario: agendaOuCalendario, quantasColunas: quantasColunas, gravar: gravar };
})();
