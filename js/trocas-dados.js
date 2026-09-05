/* ============================================================
   TROCAS — camada de dados (RPC) e formatadores compartilhados
   Expõe:
     RosterWork.trocasDados   — chamadas às funções do banco
     RosterWork.trocasFormato — helpers de exibição (data, nome,
                                situação e veredito) usados pela
                                lista e pelo painel.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};


  RW.trocasDados = {
    listar: function (contextoIds) { return RosterWork.rpc('fn_trocas_listar', { p_contexto_ids: contextoIds }); },
    analisar: function (trocaId) { return RosterWork.rpc('fn_trocas_analisar_impacto', { p_troca_id: trocaId }); },
    pendencias: function () { return RosterWork.rpc('fn_trocas_pendencias_listar', {}); },
    militares: function (unidadeId, dia, hi, hf) { return RosterWork.rpc('fn_trocas_listar_militares', { p_unidade_id: unidadeId, p_data: dia || null, p_hi: hi || null, p_hf: hf || null }); },
    meusServicos: function (cpf, contextoId) { return RosterWork.rpc('fn_trocas_meus_servicos', { p_cpf: cpf, p_contexto_id: contextoId }); },
    solicitar: function (corpo) { return RosterWork.rpc('fn_trocas_solicitar', corpo); },
    confirmar: function (trocaId, aceitar) { return RosterWork.rpc('fn_trocas_confirmar', { p_troca_id: trocaId, p_aceitar: aceitar }); },
    /* forcar (só admin): aprova direto de "aguardando confirmação", sem o solicitado confirmar */
    aprovar: function (trocaId, aceitar, aprovadoPor, forcar) { return RosterWork.rpc('fn_trocas_aprovar', { p_troca_id: trocaId, p_aceitar: aceitar, p_aprovado_por: aprovadoPor, p_forcar: !!forcar }); },
    cancelar: function (trocaId, canceladoPor) { return RosterWork.rpc('fn_trocas_cancelar', { p_troca_id: trocaId, p_cancelado_por: canceladoPor }); }
  };

  /* ---------- formatadores ---------- */
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  function doisDig(n) { return n < 10 ? '0' + n : '' + n; }

  /* 'AAAA-MM-DD' -> '12/07/2026 (qui)' */
  function dataLonga(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return doisDig(d.getDate()) + '/' + doisDig(d.getMonth() + 1) + '/' + d.getFullYear() + ' (' + DIAS[d.getDay()] + ')';
  }

  /* 'AAAA-MM-DD' -> '12/07' */
  function dataCurta(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    return p[2] + '/' + p[1];
  }

  /* 'AAAA-MM-DD' -> '12/07/2026' (sem dia da semana — campos do formulário) */
  function dataNumerica(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function nomeMilitar(grau, nome) { return ((grau || '') + ' ' + (nome || '')).trim(); }

  function horario(troca) {
    if (!troca.horario_inicio || !troca.horario_fim) return RW.mensagens.trocas.servicoTotal;
    return RW.mensagens.trocas.faixaHorario(troca.horario_inicio, troca.horario_fim);
  }

  /* "Serviço 12/07 · 24h" — linha de apoio na lista */
  function metaLista(troca) {
    var m = RW.mensagens.trocas;
    var partes = [m.metaServico(dataCurta(troca.data_servico_solicitante))];
    partes.push(troca.horario_inicio && troca.horario_fim ? m.metaParcial : m.meta24h);
    if (troca.data_servico_parceiro) partes.push(m.metaDevolve(dataCurta(troca.data_servico_parceiro)));
    return partes.join(' · ');
  }

  /* a cor do selo é visual (fica no JS); o texto vem de mensagens */
  var CLASSE_SITUACAO = {
    pendente_confirmacao: 'selo--alerta',
    pendente_aprovacao: 'selo--alerta',
    aprovada: 'selo--sucesso',
    rejeitada_parceiro: 'selo--erro',
    rejeitada_admin: 'selo--erro',
    cancelada: 'selo--escuro'
  };

  function situacao(status) {
    var textos = RW.mensagens.trocas.situacao;
    return { texto: (textos && textos[status]) || status || '', classe: CLASSE_SITUACAO[status] || 'selo--escuro' };
  }

  /* selo de veredito para as abas A confirmar / A aprovar */
  function vereditoSelo(troca) {
    var m = RW.mensagens.trocas.veredito;
    if (troca.veredito === 'problema') return { texto: m.problema(troca.veredito_problemas || 0), classe: 'selo--erro' };
    if (troca.veredito === 'alerta') return { texto: m.alerta(troca.veredito_alertas || 0), classe: 'selo--alerta' };
    if (troca.veredito === 'ok') return { texto: m.ok, classe: 'selo--sucesso' };
    return situacao(troca.status);
  }

  RW.trocasFormato = {
    dataLonga: dataLonga,
    dataCurta: dataCurta,
    dataNumerica: dataNumerica,
    nomeMilitar: nomeMilitar,
    horario: horario,
    metaLista: metaLista,
    situacao: situacao,
    vereditoSelo: vereditoSelo
  };
})();
