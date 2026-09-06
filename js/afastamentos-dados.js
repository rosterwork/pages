/* ============================================================
   AFASTAMENTOS — acesso ao banco (RosterWork.afastamentosDados)
   Camada única: o efetivo por unidade (cache de sessão, para o
   seletor de militar dos painéis) e a criação de férias, licença e
   dispensa. As listas são lidas pela árvore (listar_ferias /
   listar_licencas / listar_dispensas). A UI não fala com o banco.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var efetivoCache = null;   // buscar_efetivo() é o mesmo para todas as unidades

  /* efetivo completo (todas as unidades), com cache — filtrado por lotação no painel.
     Falha resolve null (NÃO cacheia): senão um erro pontual envenenaria o cache com vazio */
  function buscarEfetivo() {
    if (efetivoCache) return Promise.resolve(efetivoCache);
    return RosterWork.apiFetch('/rest/v1/rpc/buscar_efetivo', { metodo: 'POST', corpo: {} })
      .then(function (resp) { if (!resp.ok) return null; return resp.json(); })
      .then(function (lista) { if (!Array.isArray(lista)) return null; efetivoCache = lista; return efetivoCache; })
      .catch(function () { return null; });
  }

  /* uma RPC de criação; devolve o JSON do banco ({ _falha } no erro de servidor) */
  function rpc(nome, corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); });
  }

  window.RosterWork.afastamentosDados = {
    buscarEfetivo:   buscarEfetivo,
    inserirFerias:   function (corpo) { return rpc('inserir_ferias', corpo); },
    inserirLicenca:  function (corpo) { return rpc('inserir_licenca', corpo); },
    inserirDispensa: function (corpo) { return rpc('inserir_dispensa', corpo); }
  };
})();
