/* ============================================================
   USUÁRIOS — afastamentos: acesso ao banco
   (RosterWork.usuariosAfastamentosDados)
   Camada única das abas Férias · Licenças · Dispensas e das mesmas
   abas da ficha: a lista do ano (afastamentos_listar, de todos ou de
   um militar) e a gravação dos períodos (ferias_salvar e
   licencas_salvar). A UI não fala com o banco.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* os afastamentos de uma categoria ('ferias' | 'licenca' | 'dispensa') que tocam o ano (sem ano,
     todos os anos), de todos ou de um militar, em ordem de data. Falha resolve null (não confundir
     com lista vazia) */
  function listar(categoria, ano, usuarioId) {
    var corpo = { p_categoria: categoria, p_ano: ano || null, p_usuario_id: usuarioId || null };
    return RosterWork.apiFetch('/rest/v1/rpc/afastamentos_listar', { metodo: 'POST', corpo: corpo })
      .then(function (resp) { if (!resp.ok) return null; return resp.json(); })
      .then(function (lista) { return Array.isArray(lista) ? lista : null; })
      .catch(function () { return null; });
  }

  /* uma RPC de gravação; devolve o JSON do banco ({ _falha } no erro de servidor) */
  function rpc(nome, corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); });
  }

  window.RosterWork.usuariosAfastamentosDados = {
    listar:         listar,
    salvarFerias:   function (corpo) { return rpc('ferias_salvar', corpo); },
    salvarLicencas: function (corpo) { return rpc('licencas_salvar', corpo); }
  };
})();
