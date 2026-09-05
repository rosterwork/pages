/* ============================================================
   DISTRIBUIÇÃO — dados (RPCs)
   Único lugar que fala com o banco nesta página. O resto só exibe.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function rpc(nome, corpo) {
    return RosterWork.rpc(nome, corpo).catch(function () { return null; });   /* engole a queda de rede (devolve null); o chamador mostra o erro */
  }

  var grausCache = null;

  window.RosterWork.distribuicaoDados = {
    /* hierarquia de unidades (para o sub-cabeçalho de colunas e o grupo CIA+PELs) */
    buscarUnidades: function () { return rpc('buscar_unidades_ordenadas', {}); },
    /* modelos do contexto: composição (of/pç) e contagem de vagas por unidade */
    listarModelos: function (contextoId) { return rpc('dist_listar_modelos', { p_contexto_id: contextoId }); },
    /* postos e vagas de um modelo (para o corpo) */
    lerModelo: function (idGrupoCompleto) { return rpc('dist_ler_modelo', { p_grupo_completo_id: idGrupoCompleto }); },
    /* graus hierárquicos (para o "Grau ideal" das vagas) — cache de sessão */
    buscarGraus: function () {
      if (grausCache) return Promise.resolve(grausCache);
      return rpc('buscar_graus_hierarquicos', {}).then(function (lista) {
        grausCache = Array.isArray(lista) ? lista : [];
        return grausCache;
      });
    },
    /* grava um modelo (RPC cirúrgica: não mexe nos outros modelos do contexto) */
    salvar: function (payload) { return rpc('dist_salvar_modelo', { p_payload: payload }); },
    /* estrutura do grupo (CIA+PELs) com os postos, sem vagas — para criar um modelo novo */
    estruturaGrupo: function (contextoId) { return rpc('dist_estrutura_grupo', { p_contexto_id: contextoId }); },
    /* exclui um modelo (e poda os parciais que ficaram órfãos) */
    excluirModelo: function (id, autor, recalcularDesde) { return rpc('dist_excluir_modelo', { p_grupo_completo_id: id, p_autor: autor || null, p_recalcular_desde: recalcularDesde || null }); },
    /* pré-preenche um modelo recém-criado, copiando as vagas de um modelo que caiba (por unidade) */
    prefill: function (id) { return rpc('dist_prefill_modelo', { p_grupo_completo: id }); }
  };
})();
