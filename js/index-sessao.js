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

  var sessao = null;
  try { sessao = JSON.parse(sessionStorage.getItem('rosterwork_session')); } catch (e) {}

  if (sessao && sessao.access_token) {
    try {
      var payload = JSON.parse(atob(sessao.access_token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        ligarCelular();
        return;
      }
    } catch (e) {}
  }

  sessionStorage.removeItem('rosterwork_session');
  sessionStorage.removeItem('rosterwork_user');
  sessionStorage.removeItem('rosterwork_preferencias');
  sessionStorage.removeItem('rosterwork_extra_mes');   // mês da Extrajornada não sobrevive a uma sessão nova
  /* veio de uma notificação do celular (?aviso=…): guarda para abrir o assunto depois da entrada (index-avisos.js) */
  try {
    var aviso = new URLSearchParams(location.search).get('aviso');
    if (aviso) sessionStorage.setItem('rosterwork_aviso_pendente', aviso);
  } catch (e) {}
  window.location.replace('login.html');
})();
