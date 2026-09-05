/* ============================================================
   SESSÃO — dados do usuário logado (lê o sessionStorage)
   Fonte única para o perfil (rosterwork_user), o CPF e se é
   administrador. Antes cada página redeclarava perfil()/cpf()/
   ehAdmin(); agora todas usam RosterWork.sessao.
   API: RosterWork.sessao.perfil() / .cpf() / .ehAdmin()
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function perfil() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_user')); }
    catch (e) { return null; }
  }
  function cpf() { var u = perfil(); return u && u.cpf ? u.cpf : null; }
  function ehAdmin() { var u = perfil(); return !!(u && u.is_administrador); }

  window.RosterWork.sessao = { perfil: perfil, cpf: cpf, ehAdmin: ehAdmin };
})();
