/* ============================================================
   CRIAR CONTA — guarda de sessão (roda SÍNCRONO no <head>, antes
   do corpo pintar). Espelha o login-sessao.js: quem já tem sessão
   válida vai direto para o sistema — cadastro é coisa de quem
   ainda não entrou, e o desvio é o mesmo do login. O tema (segue
   o aparelho) vem antes, do componentes/js/geral-tema.js.
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
