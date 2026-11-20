/* ============================================================
   SESSÃO — dados do usuário logado (lê o sessionStorage)
   Fonte única para o perfil (rosterwork_user), o CPF, se é
   administrador, onde ele pode administrar e o que chega para ele.
   API: RosterWork.sessao.perfil() / .cpf() / .ehAdmin() /
        .podeAdministrar(nivel, unidadeId) / .temPapel(nivel) /
        .acompanha(unidadeId)
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* os papéis, do menor para o maior: quem tem um nível pode o que os de baixo podem */
  var NIVEIS = ['pelotao', 'companhia', 'geral'];

  /* o nível com que o papel age: o de pelotão age como o de companhia (a mesma régua do banco, _admin_pode) */
  function nivelDoPapel(papel) { return NIVEIS.indexOf(papel === 'pelotao' ? 'companhia' : papel); }

  function perfil() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_user')); }
    catch (e) { return null; }
  }
  function cpf() { var u = perfil(); return u && u.cpf ? u.cpf : null; }
  function ehAdmin() { var u = perfil(); return !!(u && u.is_administrador); }
  function ehProgramador() { var u = perfil(); return !!(u && u.is_programador); }

  /* as unidades com estágio em vigor ou marcado na companhia dele ou na área que ele administra (o perfil); a página
     Estágios lê de novo ao abrir e guarda a lista nova (js/estagios.js) */
  function estagioUnidades() { var u = perfil(); return (u && u.estagio_unidades) || []; }
  function guardarEstagioUnidades(lista) {
    var u = perfil();
    if (!u) return;
    u.estagio_unidades = lista || [];
    try { sessionStorage.setItem('rosterwork_user', JSON.stringify(u)); } catch (e) { /* sem o armazenamento, vale no próximo login */ }
  }

  /* o papel tem o nível pedido e a unidade está na área dele? (a mesma régua do banco, que confere de novo).
     Sessão aberta antes de o login trazer a área: vale o "é administrador" até o próximo login */
  function podeAdministrar(nivel, unidadeId) {
    var u = perfil();
    if (!u) return false;
    var adm = u.administracao;
    if (adm === undefined || (adm && !adm.unidades)) return !!u.is_administrador;
    if (!adm || NIVEIS.indexOf(nivel) < 0 || nivelDoPapel(adm.papel) < NIVEIS.indexOf(nivel)) return false;
    return adm.unidades.indexOf(Number(unidadeId)) >= 0;
  }

  /* o papel chega ao nível pedido, em alguma área? (para o que é da página inteira: menu, abas, botões de criar) */
  function temPapel(nivel) {
    var u = perfil();
    if (!u) return false;
    var adm = u.administracao;
    if (adm === undefined || (adm && !adm.unidades)) return !!u.is_administrador;
    return !!adm && NIVEIS.indexOf(nivel) >= 0 && nivelDoPapel(adm.papel) >= NIVEIS.indexOf(nivel);
  }

  /* a unidade chega para ele (selos e notas de lembrete)? a unidade do papel e tudo abaixo; o de pelotão, só o
     pelotão dele (a mesma régua do banco, _admin_acompanha). Sessão aberta antes de o login trazer o campo: vale a área */
  function acompanha(unidadeId) {
    var u = perfil();
    if (!u) return false;
    var adm = u.administracao;
    if (adm === undefined || (adm && !adm.unidades)) return !!u.is_administrador;
    if (!adm) return false;
    return (adm.acompanha || adm.unidades).indexOf(Number(unidadeId)) >= 0;
  }

  window.RosterWork.sessao = { perfil: perfil, cpf: cpf, ehAdmin: ehAdmin, ehProgramador: ehProgramador,
    podeAdministrar: podeAdministrar, temPapel: temPapel, acompanha: acompanha, estagioUnidades: estagioUnidades,
    guardarEstagioUnidades: guardarEstagioUnidades };
})();
