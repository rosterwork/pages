/* ============================================================
   EXTRAJORNADA — camada de dados (só chama as RPCs)
   Toda a lógica mora no banco; aqui só empacota a chamada.
   RosterWork.extrajornadaDados
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};


  RW.extrajornadaDados = {
    /* limites do seletor de mês (compartilhado pelas abas): mês anterior com
       dados no contexto + atual + próximo; para trás só com dados, para frente para no próximo */
    carregarNavMeses: function (competenciaISO) {
      return RosterWork.rpc('extra_nav_meses', { p_competencia: competenciaISO });
    },

    /* a solicitação do militar logado num mês (o banco identifica pelo login) */
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
       { modo:'grupo', total } ou { modo:'por_unidade', totais:{unidadeId:n} } simula sem gravar */
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

    /* Distribuição (admin): a grade do mês (extras salvas, candidatos e unidades) */
    carregarEscala: function (competenciaISO) {
      return RosterWork.rpc('extra_escala_carregar', { p_competencia: competenciaISO });
    },
    /* ENSAIO no motor real de UM dia: a cobertura sem e com as extras, com o rascunho do dia por cima
       (a grade da Distribuição). mudancas = [{ cpf, data, unidade, blocos }] */
    analisarDia: function (dataISO, mudancas) {
      return RosterWork.rpc('extra_analisar_dia', { p_data: dataISO, p_mudancas: mudancas || [] });
    },
    /* Lançar na escala: o que mudou desde o último lançamento (dias que serão redistribuídos) e o lançamento */
    previaLancamento: function (competenciaISO) {
      return RosterWork.rpc('extra_lancamento_previa', { p_competencia: competenciaISO });
    },
    lancar: function (competenciaISO) {
      return RosterWork.rpc('extra_lancar', { p_competencia: competenciaISO });
    },

    /* Calendário (todos): o lançado e, depois que o mês começou, o atual (para os riscados); usa a leitura já
       começada pelo deslize do mês (celular) quando é a do mesmo mês */
    carregarCalendario: function (competenciaISO) {
      var antecipada = RosterWork.deslizarMes && RosterWork.deslizarMes.usarAntecipada('extra_calendario|' + competenciaISO);
      return antecipada || RosterWork.rpc('extra_calendario', { p_competencia: competenciaISO });
    },
    /* o deslize do mês (geral-deslizar-mes.js): o dedo passou do ponto, a leitura do mês vizinho já começa */
    anteciparCalendario: function (competenciaISO) {
      if (!RosterWork.deslizarMes) return;
      RosterWork.deslizarMes.antecipar('extra_calendario|' + competenciaISO, function () {
        return RosterWork.rpc('extra_calendario', { p_competencia: competenciaISO });
      });
    },

    /* Relatórios (admin): as etapas do mês, o lançado e os ajustes */
    carregarRelatorios: function (competenciaISO) {
      return RosterWork.rpc('extra_relatorios', { p_competencia: competenciaISO });
    }
  };
})();
