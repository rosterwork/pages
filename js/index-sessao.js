(function () {
  'use strict';

  /* o tema é aplicado antes, pelo componentes/js/geral-tema.js (também síncrono no <head>) */

  /* celular (para todos): no aparelho de tela pequena (o lado menor abaixo de 768px),
     troca a largura da página para a do aparelho e marca o <html> com data-celular,
     que liga o bloco do celular nos CSS (@media até 767px). Tablet e computador seguem
     com a página de 1920px. Roda antes da primeira pintura, como o tema */
  function ligarCelular() {
    try {
      if (!window.RosterWork.aplicativo.celular()) return;   /* a conta do celular mora no geral-aplicativo.js */
      var viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      document.documentElement.setAttribute('data-celular', '');
    } catch (e) {}
  }

  /* chegada depois do login (a marca vem do login-auth.js): a tela de chegada (logo e giratório)
     cobre o sistema até a primeira tela ficar pronta, tirada pelo index-navegacao.js, ou até o
     limite, para nunca travar */
  var LIMITE_CHEGADA_MS = 15000;
  function marcarChegada() {
    try {
      if (!sessionStorage.getItem('rosterwork_chegada')) return;
      sessionStorage.removeItem('rosterwork_chegada');
      document.documentElement.setAttribute('data-chegando', '');
      setTimeout(function () { document.documentElement.removeAttribute('data-chegando'); }, LIMITE_CHEGADA_MS);
    } catch (e) {}
  }

  var sessao = null;
  try { sessao = JSON.parse(sessionStorage.getItem('rosterwork_session')); } catch (e) {}

  if (sessao && sessao.access_token) {
    try {
      var payload = JSON.parse(atob(sessao.access_token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        ligarCelular();
        marcarChegada();
        return;
      }
    } catch (e) {}
  }

  sessionStorage.removeItem('rosterwork_session');
  sessionStorage.removeItem('rosterwork_user');
  sessionStorage.removeItem('rosterwork_preferencias');
  sessionStorage.removeItem('rosterwork_extra_mes');   // mês da Extrajornada não sobrevive a uma sessão nova
  window.location.replace('login.html');
})();
