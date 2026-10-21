/* ============================================================
   SESSÃO — dados do usuário logado (lê o sessionStorage)
   Fonte única para o perfil (rosterwork_user), o CPF, se é
   administrador e onde ele pode administrar.
   API: RosterWork.sessao.perfil() / .cpf() / .ehAdmin() /
        .podeAdministrar(nivel, unidadeId) / .temPapel(nivel)
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* os papéis, do menor para o maior: quem tem um nível pode o que os de baixo podem */
  var NIVEIS = ['pelotao', 'companhia', 'geral'];

  function perfil() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_user')); }
    catch (e) { return null; }
  }
  function cpf() { var u = perfil(); return u && u.cpf ? u.cpf : null; }
  function ehAdmin() { var u = perfil(); return !!(u && u.is_administrador); }
  function ehProgramador() { var u = perfil(); return !!(u && u.is_programador); }

  /* o papel tem o nível pedido e a unidade está na área dele? (a mesma régua do banco, que confere de novo).
     Sessão aberta antes de o login trazer a área: vale o "é administrador" até o próximo login */
  function podeAdministrar(nivel, unidadeId) {
    var u = perfil();
    if (!u) return false;
    var adm = u.administracao;
    if (adm === undefined || (adm && !adm.unidades)) return !!u.is_administrador;
    if (!adm || NIVEIS.indexOf(nivel) < 0 || NIVEIS.indexOf(adm.papel) < NIVEIS.indexOf(nivel)) return false;
    return adm.unidades.indexOf(Number(unidadeId)) >= 0;
  }

  /* o papel chega ao nível pedido, em alguma área? (para o que é da página inteira: menu, abas, botões de criar) */
  function temPapel(nivel) {
    var u = perfil();
    if (!u) return false;
    var adm = u.administracao;
    if (adm === undefined || (adm && !adm.unidades)) return !!u.is_administrador;
    return !!adm && NIVEIS.indexOf(nivel) >= 0 && NIVEIS.indexOf(adm.papel) >= NIVEIS.indexOf(nivel);
  }

  window.RosterWork.sessao = { perfil: perfil, cpf: cpf, ehAdmin: ehAdmin, ehProgramador: ehProgramador,
    podeAdministrar: podeAdministrar, temPapel: temPapel };
})();
