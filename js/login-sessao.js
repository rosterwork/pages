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
        return;
      }
    } catch (e) {}
  }

  /* login lembrado no aparelho (Manter-me conectado): a tela já nasce "entrando", só com a logo e o
     giratório, sem o formulário piscar; o login-auth.js entra ou mostra o que houve */
  var conectado = window.RosterWork && window.RosterWork.conectado;
  if (conectado && conectado.lembrado()) document.documentElement.setAttribute('data-entrando', '');
})();
