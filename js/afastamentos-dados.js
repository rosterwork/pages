/* ============================================================
   AFASTAMENTOS — acesso ao banco (RosterWork.afastamentosDados)
   Camada única: o efetivo por unidade (cache de sessão, para o
   seletor de militar dos painéis), as férias de um militar (o painel
   Férias) e a criação de licença e dispensa. As listas são lidas pela
   árvore (listar_ferias / listar_licencas / listar_dispensas). A UI
   não fala com o banco.
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

  /* uma RPC de gravação; devolve o JSON do banco ({ _falha } no erro de servidor) */
  function rpc(nome, corpo) {
    return RosterWork.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo })
      .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); });
  }

  /* os períodos de férias de um militar, do mais antigo ao mais novo (sem cache: o painel precisa
     do que está gravado agora). Falha resolve null (não confundir com militar sem férias) */
  function feriasDoMilitar(usuarioId) {
    return RosterWork.apiFetch('/rest/v1/rpc/listar_ferias', { metodo: 'POST', corpo: {} })
      .then(function (resp) { if (!resp.ok) return null; return resp.json(); })
      .then(function (lista) {
        if (!Array.isArray(lista)) return null;
        return lista.filter(function (f) { return f.usuario_id === usuarioId; })
          .sort(function (a, b) { return String(a.data_inicio).localeCompare(String(b.data_inicio)); });
      })
      .catch(function () { return null; });
  }

  window.RosterWork.afastamentosDados = {
    buscarEfetivo:   buscarEfetivo,
    feriasDoMilitar: feriasDoMilitar,
    salvarFerias:    function (corpo) { return rpc('ferias_salvar', corpo); },
    inserirLicenca:  function (corpo) { return rpc('inserir_licenca', corpo); },
    inserirDispensa: function (corpo) { return rpc('inserir_dispensa', corpo); }
  };
})();
