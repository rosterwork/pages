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
    /* a companhia e os pelotões, a distribuição em vigor, a mudança agendada e as substituições
       (sem unidade: a lotação do programador; com versaoId = a da mudança agendada, ela) */
    ler: function (unidadeId, versaoId) {
      return rpc('nova_distribuicao_ler', { p_unidade_id: unidadeId || null, p_periodo_id: versaoId || null });
    },
    /* as contas, sem gravar: respostas arrumadas, funções, blocos prontos, erros, pendências, a
       conferência (efetivos = [n, n+1...] para a tabela; simulacao = { grau: quantos } para simular)
       e, com comparar (as respostas da outra versão), as diferenças campo a campo */
    calcular: function (unidadeId, respostas, efetivos, simulacao, comparar) {
      return rpc('nova_distribuicao_calcular', {
        p_unidade_id: unidadeId, p_respostas: respostas, p_efetivos: efetivos || null,
        p_simulacao: simulacao || null, p_comparar: comparar || null
      });
    },
    /* a 1ª versão da unidade, com os postos e o modelo de hoje (sem nada hoje, em branco) */
    copiarHoje: function (unidadeId) {
      return rpc('nova_distribuicao_copiar_hoje', { p_unidade_id: unidadeId });
    },
    /* grava [{ periodo_id, respostas, renomeadas }] a partir de aPartirDe (a em vigor; a mudança agendada
       não pede data); levar = os conflitos que vão do conserto para a agendada; previa = só mostra, não grava */
    salvar: function (itens, aPartirDe, levar, previa) {
      return rpc('nova_distribuicao_salvar', {
        p_itens: itens, p_a_partir_de: aPartirDe || null, p_levar: levar && levar.length ? levar : null, p_previa: !!previa
      });
    },
    agendadaData: function (unidadeId, inicio) {
      return rpc('nova_distribuicao_agendada_data', { p_unidade_id: unidadeId, p_inicio: inicio });
    },
    agendadaCancelar: function (unidadeId) {
      return rpc('nova_distribuicao_agendada_cancelar', { p_unidade_id: unidadeId });
    },
    /* a substituição temporária grava na hora (id nulo = nova) */
    substituicaoSalvar: function (unidadeId, id, viatura, prefixo, cnh, inicio, fim) {
      return rpc('nova_distribuicao_substituicao_salvar', {
        p_unidade_id: unidadeId, p_id: id || null, p_viatura: viatura, p_prefixo: prefixo, p_cnh: cnh, p_inicio: inicio, p_fim: fim
      });
    },
    substituicaoExcluir: function (id) {
      return rpc('nova_distribuicao_substituicao_excluir', { p_id: id });
    }
  };
})();
