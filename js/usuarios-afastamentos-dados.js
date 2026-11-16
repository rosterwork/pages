/* ============================================================
   USUÁRIOS — afastamentos: acesso ao banco
   (RosterWork.usuariosAfastamentosDados)
   Camada única da aba Afastamentos e da aba da ficha: a lista do
   ano (afastamentos_ano_listar, de todos ou de um militar; sem ano,
   todos os anos) e a gravação de um ou mais militares, tudo ou nada
   (afastamentos_salvar). A UI não fala com o banco.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* os afastamentos que tocam o ano, de todos ou de um militar, em ordem de data. Falha resolve null (não
     confundir com lista vazia) */
  function listarAno(ano, usuarioId) {
    var corpo = { p_ano: ano || null, p_usuario_id: usuarioId || null };
    return RosterWork.apiFetch('/rest/v1/rpc/afastamentos_ano_listar', { metodo: 'POST', corpo: corpo })
      .then(function (resp) { if (!resp.ok) return null; return resp.json(); })
      .then(function (lista) { return Array.isArray(lista) ? lista : null; })
      .catch(function () { return null; });
  }

  /* militares = [{ usuario_id, afastamentos: [...], remover: [ids] }]; devolve o JSON do banco ({ _falha } no erro de
     servidor) */
  function salvar(militares, confirmar) {
    return RosterWork.apiFetch('/rest/v1/rpc/afastamentos_salvar', {
      metodo: 'POST', corpo: { p_militares: militares, p_confirmar: !!confirmar }
    }).then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); });
  }

  window.RosterWork.usuariosAfastamentosDados = { listarAno: listarAno, salvar: salvar };
})();
