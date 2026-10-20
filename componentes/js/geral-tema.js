/* ============================================================
   TEMA — Automático (segue o aparelho), Claro ou Escuro.
   Roda SÍNCRONO no <head>, antes do CSS e do corpo, na casca e
   nas telas de antes do login: sem isso a tela pinta clara e
   "salta" para escura. Escuro = data-tema="escuro" no <html>.
   A escolha vem de rosterwork_preferencias.tema (o login traz
   do banco); sem escolha (antes do login) vale o Automático, que
   acompanha a troca do aparelho na hora. Ao imprimir, o papel
   sai sempre claro.
   API: RosterWork.tema.escolha() / .escuro() / .escolher(valor)
   Cada mudança avisa pelo evento rosterwork_tema (window).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var aparelhoEscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var imprimindo = false;   /* o papel é sempre claro: durante a impressão vale o tema claro */

  function lerPreferencias() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; }
    catch (e) { return {}; }
  }

  /* 'automatico' (padrão), 'claro' ou 'escuro' */
  function escolha() {
    var tema = lerPreferencias().tema;
    return tema === 'claro' || tema === 'escuro' ? tema : 'automatico';
  }

  function escuro() {
    return document.documentElement.getAttribute('data-tema') === 'escuro';
  }

  function aplicar() {
    var atual = escolha();
    var ficaEscuro = !imprimindo && (atual === 'escuro' || (atual === 'automatico' && !!aparelhoEscuro && aparelhoEscuro.matches));
    if (ficaEscuro) document.documentElement.setAttribute('data-tema', 'escuro');
    else document.documentElement.removeAttribute('data-tema');
    window.dispatchEvent(new CustomEvent('rosterwork_tema'));
  }

  /* troca a escolha: aplica na hora, guarda na sessão e grava no banco (só com alguém logado) */
  function escolher(valor) {
    var prefs = lerPreferencias();
    prefs.tema = valor;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    aplicar();
    var R = window.RosterWork;
    if (R.apiFetch && R.obterToken && R.obterToken()) {
      R.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
        metodo: 'POST',
        corpo: { p_tema: valor }
      }).catch(function () {});
    }
  }

  aplicar();

  /* no Automático, a tela acompanha o aparelho quando ele troca de claro para escuro */
  if (aparelhoEscuro) {
    var aoTrocarAparelho = function () { if (escolha() === 'automatico') aplicar(); };
    if (aparelhoEscuro.addEventListener) aparelhoEscuro.addEventListener('change', aoTrocarAparelho);
    else if (aparelhoEscuro.addListener) aparelhoEscuro.addListener(aoTrocarAparelho);
  }

  /* imprimir (Ctrl+P ou menu do navegador): sai no tema claro e a tela volta à escolha depois */
  window.addEventListener('beforeprint', function () { imprimindo = true; aplicar(); });
  window.addEventListener('afterprint', function () { imprimindo = false; aplicar(); });

  window.RosterWork.tema = { escolha: escolha, escuro: escuro, escolher: escolher };
})();
