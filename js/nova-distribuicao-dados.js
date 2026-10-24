/* ============================================================
   NOVA DISTRIBUIÇÃO — dados (RPCs)
   Único lugar que fala com o banco nesta página. As contas moram
   no banco (nova_distribuicao_calcular); aqui só as chamadas.
   Cada chamada devolve o JSON da função, null quando o banco recusa
   e rejeita quando a rede cai (o chamador separa os dois avisos).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function rpc(nome, corpo) {
    return RosterWork.rpc(nome, corpo);
  }

  window.RosterWork.novaDistribuicaoDados = {
    /* a companhia e os pelotões, os períodos e as respostas (sem unidade: a lotação do programador) */
    ler: function (unidadeId, periodoId) {
      return rpc('nova_distribuicao_ler', { p_unidade_id: unidadeId || null, p_periodo_id: periodoId || null });
    },
    /* as contas, sem gravar: respostas arrumadas, cadeiras, blocos prontos, erros e a conferência */
    calcular: function (unidadeId, respostas, efetivo) {
      return rpc('nova_distribuicao_calcular', { p_unidade_id: unidadeId, p_respostas: respostas, p_efetivo: efetivo == null ? null : efetivo });
    },
    /* o 1º período da unidade, com os postos e o modelo de hoje */
    copiarHoje: function (unidadeId) {
      return rpc('nova_distribuicao_copiar_hoje', { p_unidade_id: unidadeId });
    },
    /* grava [{ periodo_id, respostas }] (no pelotão, a parte da companhia vai junto) */
    salvar: function (itens) {
      return rpc('nova_distribuicao_salvar', { p_itens: itens });
    },
    criarPeriodo: function (unidadeId, inicio, fim, copiarDe) {
      return rpc('nova_distribuicao_periodo_salvar', {
        p_unidade_id: unidadeId, p_periodo_id: null, p_inicio: inicio, p_fim: fim || null, p_copiar_de: copiarDe || null
      });
    },
    excluirPeriodo: function (periodoId) {
      return rpc('nova_distribuicao_periodo_excluir', { p_periodo_id: periodoId });
    }
  };
})();
