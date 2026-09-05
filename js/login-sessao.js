/* ============================================================
   LOGIN — guarda de sessão (roda síncrono no <head>, antes do
   corpo pintar): se já há sessão válida, redireciona para o
   sistema na hora — sem a tela de login "piscar" antes.
   Espelha o index-sessao.js (o inverso: index → login).
   ============================================================ */
(function () {
  'use strict';

  var sessao = null;
  try { sessao = JSON.parse(sessionStorage.getItem('rosterwork_session')); } catch (e) {}

  if (sessao && sessao.access_token) {
    try {
      var payload = JSON.parse(atob(sessao.access_token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 > Date.now()) {
        window.location.replace('index.html');
      }
    } catch (e) {}
  }
})();
