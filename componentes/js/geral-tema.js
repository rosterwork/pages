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
   Cada mudança avisa pelo evento rosterwork_tema (window) e pinta
   a faixa do Android no app instalado (<meta name="theme-color">).
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

  /* app no celular: a faixa do Android (relógio, bateria) com o fundo do tema em uso, pela etiqueta
     theme-color do <head>. A cor vem do papel --fundo-pagina (o manifesto só tem a do tema claro);
     antes de o CSS carregar ela ainda não existe, e a faixa é pintada no DOMContentLoaded */
  function pintarFaixa() {
    var etiqueta = document.querySelector('meta[name="theme-color"]');
    if (!etiqueta) return;
    var cor = getComputedStyle(document.documentElement).getPropertyValue('--fundo-pagina').trim();
    if (cor) etiqueta.setAttribute('content', cor);
  }

  function aplicar() {
    var atual = escolha();
    var ficaEscuro = !imprimindo && (atual === 'escuro' || (atual === 'automatico' && !!aparelhoEscuro && aparelhoEscuro.matches));
    if (ficaEscuro) document.documentElement.setAttribute('data-tema', 'escuro');
    else document.documentElement.removeAttribute('data-tema');
    pintarFaixa();
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
  document.addEventListener('DOMContentLoaded', pintarFaixa);

  /* no Automático, a tela acompanha o aparelho quando ele troca de claro para escuro */
  if (aparelhoEscuro) {
    var aoTrocarAparelho = function () { if (escolha() === 'automatico') aplicar(); };
    if (aparelhoEscuro.addEventListener) aparelhoEscuro.addEventListener('change', aoTrocarAparelho);
    else if (aparelhoEscuro.addListener) aparelhoEscuro.addListener(aoTrocarAparelho);
  }

  /* imprimir (Ctrl+P ou menu do navegador): sai no tema claro e a tela volta à escolha depois */
  window.addEventListener('beforeprint', function () { imprimindo = true; aplicar(); });
  window.addEventListener('afterprint', function () { imprimindo = false; aplicar(); });

  /* aplicar: refaz o tema pelas preferências da sessão (o js/index-carregar.js chama quando elas chegam
     depois da renovação do login lembrado) */
  window.RosterWork.tema = { escolha: escolha, escuro: escuro, escolher: escolher, aplicar: aplicar };
})();
