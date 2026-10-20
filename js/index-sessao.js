(function () {
  'use strict';

  /* aplica o tema salvo ANTES do primeiro render (este script roda síncrono no <head>,
     antes do CSS e do corpo) — sem isso a tela pinta clara e "salta" para escura */
  function aplicarTemaInicial() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      if (prefs && prefs.tema === 'escuro') {
        document.documentElement.setAttribute('data-tema', 'escuro');
      } else {
        document.documentElement.removeAttribute('data-tema');
      }
    } catch (e) {}
  }

  /* celular (por enquanto só para o programador): troca a largura da página para a do
     aparelho e marca o <html> com data-celular, que liga o bloco do celular nos CSS
     (@media até 767px). Roda antes da primeira pintura, como o tema; no computador a
     etiqueta viewport não muda nada */
  function ligarCelular() {
    try {
      var usuario = JSON.parse(sessionStorage.getItem('rosterwork_user'));
      if (!usuario || !usuario.is_programador) return;
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
        aplicarTemaInicial();
        ligarCelular();
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
