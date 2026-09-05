/* ============================================================
   EXTRAJORNADA — camada de dados (só chama as RPCs)
   Toda a lógica mora no banco; aqui só empacota a chamada.
   RosterWork.extrajornadaDados
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};


  RW.extrajornadaDados = {
    /* limites do seletor de mês (compartilhado pelas duas abas): mês anterior com
       dados no contexto + atual + próximo; para trás só com dados, para frente para no próximo */
    carregarNavMeses: function (competenciaISO) {
      return RosterWork.rpc('extra_nav_meses', { p_competencia: competenciaISO });
    },

    /* disponibilidade do militar logado (o banco identifica pelo login) */
    carregarDisponibilidade: function (competenciaISO) {
      return RosterWork.rpc('extra_disponibilidade_carregar', { p_competencia: competenciaISO });
    },
    salvarDisponibilidade: function (dados) {
      return RosterWork.rpc('extra_disponibilidade_salvar', {
        p_competencia: dados.competencia,
        p_voluntario: dados.voluntario,
        p_cotas: dados.cotas,
        p_fecha_24h: dados.fecha24h,
        p_datas: dados.datas
      });
    },

    /* Cotas (admin): repartição justa por escopo. p_config = null carrega o salvo;
       { modo:'grupo', bolo } ou { modo:'por_unidade', bolos:{unidadeId:n} } simula sem gravar */
    carregarCotas: function (competenciaISO, config) {
      return RosterWork.rpc('extra_cotas_carregar', {
        p_competencia: competenciaISO,
        p_config: config || null
      });
    },
    salvarCotas: function (dados) {
      return RosterWork.rpc('extra_cotas_salvar', {
        p_competencia: dados.competencia,
        p_config: dados.config,
        p_alocacoes: dados.alocacoes
      });
    },

    /* Escala (admin): organiza a extra do mês */
    carregarEscala: function (competenciaISO) {
      return RosterWork.rpc('extra_escala_carregar', { p_competencia: competenciaISO });
    },
    definirEscala: function (usuario, dataISO, blocos, por, unidade) {
      return RosterWork.rpc('extra_escala_definir', {
        p_usuario: usuario, p_data: dataISO, p_blocos: blocos, p_por: por,
        p_unidade_destino: (unidade === undefined || unidade === null) ? null : unidade
      });
    },
    /* efetiva os extras do mês na escala (linhas is_extra em escalas_quando + o motor refaz o "onde") */
    inserirEscala: function (competenciaISO) {
      return RosterWork.rpc('extra_escala_inserir', { p_competencia: competenciaISO });
    },
    /* análise de impacto ANTES de remover um extra inserido (avisa se abrir furo) */
    analisarRemocao: function (usuario, dataISO) {
      return RosterWork.rpc('extra_analisar_remocao', { p_usuario: usuario, p_data: dataISO });
    },
    /* ENSAIO no motor real de UM dia: avisos verdadeiros (pós-motor) dos extras pendentes daquele dia */
    analisarDia: function (dataISO) {
      return RosterWork.rpc('extra_analisar_dia', { p_data: dataISO });
    },
    /* painel do dia (gaveta): distribuição "depois" (com os extras) + avisos antes/depois de UMA unidade */
    distribuicaoDia: function (unidadeId, dataISO) {
      return RosterWork.rpc('extra_distribuicao_dia', { p_unidade_id: unidadeId, p_data: dataISO });
    }
  };
})();
