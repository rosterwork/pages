/* ============================================================
   AFASTAMENTOS / ATESTADOS — acesso ao banco
   Camada isolada (RosterWork.atestadosDados): o efetivo por unidade
   (cache de sessão, para o seletor de militar do painel) e a criação
   de um atestado. A leitura da lista é feita pelo componente da
   árvore (rpcConteudo: 'listar_atestados'). A UI não fala com o
   banco direto.
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

  /* lança um atestado; devolve o JSON do banco ({ _falha } no erro de servidor) */
  function inserirAtestado(corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/inserir_atestado', { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      });
  }

  window.RosterWork.atestadosDados = {
    buscarEfetivo: buscarEfetivo,
    inserirAtestado: inserirAtestado
  };
})();
