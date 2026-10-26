/* ============================================================
   TROCAS — camada de dados (RPC) e formatadores compartilhados
   Expõe:
     RosterWork.trocasDados   — chamadas às funções do banco
     RosterWork.trocasFormato — helpers de exibição (data, nome,
                                situação e veredito) usados pela
                                lista e pelo painel, e a área do
                                administrador (daMinhaArea).
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};


  RW.trocasDados = {
    listar: function (contextoIds) { return RosterWork.rpc('fn_trocas_listar', { p_contexto_ids: contextoIds }); },
    analisar: function (trocaId) { return RosterWork.rpc('fn_trocas_analisar_impacto', { p_troca_id: trocaId }); },
    pendencias: function () { return RosterWork.rpc('fn_trocas_pendencias_listar', {}); },
    militares: function (unidadeId, dia, hi, hf) { return RosterWork.rpc('fn_trocas_listar_militares', { p_unidade_id: unidadeId, p_data: dia || null, p_hi: hi || null, p_hf: hf || null }); },
    /* ultimos7Dias (só admin, no Registrar): inclui os serviços de até 7 dias atrás;
       trocaId (Editar): os serviços como se essa troca não existisse */
    meusServicos: function (cpf, contextoId, ultimos7Dias, trocaId) { return RosterWork.rpc('fn_trocas_meus_servicos', { p_cpf: cpf, p_contexto_id: contextoId, p_ultimos_7_dias: !!ultimos7Dias, p_troca_id: trocaId || null }); },
    solicitar: function (corpo) { return RosterWork.rpc('fn_trocas_solicitar', corpo); },
    /* Editar: muda o dia, o período, a devolução e a parte; com corpo.p_ensaio = true só devolve a análise de impacto */
    editar: function (corpo) { return RosterWork.rpc('fn_trocas_editar', corpo); },
    /* Registrar (só admin): grava já aprovada; com corpo.p_ensaio = true só devolve a análise de impacto */
    registrar: function (corpo) { return RosterWork.rpc('fn_trocas_registrar', corpo); },
    confirmar: function (trocaId, aceitar, motivo) { return RosterWork.rpc('fn_trocas_confirmar', { p_troca_id: trocaId, p_aceitar: aceitar, p_motivo: motivo || null }); },
    /* o aceite que falta no registro (só entra no registro, não mexe na escala) */
    aceitar: function (trocaId) { return RosterWork.rpc('fn_trocas_aceitar', { p_troca_id: trocaId }); },
    /* forcar (só admin): aprova direto de "aguardando confirmação", sem o solicitado confirmar */
    aprovar: function (trocaId, aceitar, forcar, motivo) { return RosterWork.rpc('fn_trocas_aprovar', { p_troca_id: trocaId, p_aceitar: aceitar, p_forcar: !!forcar, p_motivo: motivo || null }); },
    /* motivo: obrigatório para cancelar a troca aprovada (fica no livro de ocorrências do registro) */
    cancelar: function (trocaId, desfazer, motivo) { return RosterWork.rpc('fn_trocas_cancelar', { p_troca_id: trocaId, p_desfazer: !!desfazer, p_motivo: motivo || null }); },
    /* saldo líquido de horas entre o logado e outroCpf (> 0 = o outro me deve; < 0 = eu devo) */
    saldoEntre: function (outroCpf) { return RosterWork.rpc('fn_trocas_saldo_entre', { p_outro_cpf: outroCpf }); },
    /* extrato paginado dos lançamentos (serviço/devolução) entre dois militares */
    historicoPar: function (aCpf, bCpf, limite, deslocamento) { return RosterWork.rpc('fn_trocas_historico_par', { p_a_cpf: aCpf, p_b_cpf: bCpf, p_limite: limite, p_deslocamento: deslocamento }); },
    /* várias trocas: o calendário (quem pode folgar e trabalhar em cada dia; registrar = o do Registrar, de 7 dias atrás em diante),
       o resumo (duplas, rodas, sem devolução), o pedido, o Registrar (só admin: grava já aprovado; ensaio = só a Análise)
       e o cancelamento do registro inteiro (desfazer = apaga o pedido em aberto ou o registro feito pela administração);
       registroId (Editar): o calendário e o resumo como se esse registro não existisse */
    variasDias: function (cpfs, inicio, fim, registrar, registroId) { return RosterWork.rpc('fn_trocas_varias_dias', { p_cpfs: cpfs, p_inicio: inicio, p_fim: fim, p_registrar: !!registrar, p_registro_id: registroId || null }); },
    variasMontar: function (dias, registroId) { return RosterWork.rpc('fn_trocas_varias_montar', { p_dias: dias, p_registro_id: registroId || null }); },
    variasSolicitar: function (dias, parte, ano) { return RosterWork.rpc('fn_trocas_varias_solicitar', { p_dias: dias, p_parte_numero: parte, p_parte_ano: ano }); },
    variasRegistrar: function (dias, parte, ano, ensaio) { return RosterWork.rpc('fn_trocas_varias_registrar', { p_dias: dias, p_parte_numero: parte, p_parte_ano: ano, p_ensaio: !!ensaio }); },
    variasCancelar: function (registroId, desfazer, motivo) { return RosterWork.rpc('fn_trocas_varias_cancelar', { p_registro_id: registroId, p_desfazer: !!desfazer, p_motivo: motivo || null }); },
    /* o registro de várias trocas: a resposta de cada militar, a decisão da administração e os dados do registro */
    variasResponder: function (registroId, aceitar, motivo) { return RosterWork.rpc('fn_trocas_varias_responder', { p_registro_id: registroId, p_aceitar: aceitar, p_motivo: motivo || null }); },
    variasAprovar: function (registroId, aceitar, forcar, motivo) { return RosterWork.rpc('fn_trocas_varias_aprovar', { p_registro_id: registroId, p_aceitar: aceitar, p_forcar: !!forcar, p_motivo: motivo || null }); },
    /* o Editar do registro: o plano que vale hoje (os dias, os militares e a Parte) e a gravação do plano novo
       (ensaio = só a Análise, do administrador de fora) */
    variasPlano: function (registroId) { return RosterWork.rpc('fn_trocas_varias_plano', { p_registro_id: registroId }); },
    variasEditar: function (registroId, dias, parte, ano, ensaio, motivo) { return RosterWork.rpc('fn_trocas_varias_editar', { p_registro_id: registroId, p_dias: dias, p_parte_numero: parte, p_parte_ano: ano, p_ensaio: !!ensaio, p_motivo: motivo || null }); },
    registro: function (trocaId) { return RosterWork.rpc('fn_trocas_registro', { p_troca_id: trocaId }); }
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

  /* "RW nº 1/2026 · Serviço 12/07 · 24h" — linha de apoio na lista */
  function metaLista(troca) {
    var m = RW.mensagens.trocas;
    var partes = troca.registro_numero ? [m.registroNumero(troca.registro_numero, troca.registro_ano)] : [];
    partes.push(m.metaServico(dataCurta(troca.data_servico_solicitante)));
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
    cancelada: 'selo--escuro',
    substituida: 'selo--escuro',
    expirada: 'selo--escuro'
  };

  /* alteracao = a troca é a alteração de outra (substitui_troca_id): o selo diz que é alteração */
  function situacao(status, alteracao) {
    var m = RW.mensagens.trocas;
    var texto = (alteracao && m.situacaoAlteracao[status]) || (m.situacao && m.situacao[status]) || status || '';
    return { texto: texto, classe: CLASSE_SITUACAO[status] || 'selo--escuro' };
  }

  /* quem está logado administra algum militar da troca (no registro de várias, de qualquer troca dele)?
     os aceites trazem a unidade de cada militar; sem eles, vale a de quem pediu (o banco confere de novo) */
  function daMinhaArea(troca) {
    var podeAdministrar = function (lotacao) { return RW.sessao.podeAdministrar('pelotao', lotacao); };
    var aceites = (troca && troca.aceites) || [];
    if (!aceites.length) return podeAdministrar(troca && troca.solicitante_lotacao);
    return aceites.some(function (a) { return podeAdministrar(a.lotacao); });
  }

  RW.trocasFormato = {
    dataLonga: dataLonga,
    dataCurta: dataCurta,
    dataNumerica: dataNumerica,
    nomeMilitar: nomeMilitar,
    metaLista: metaLista,
    situacao: situacao,
    daMinhaArea: daMinhaArea
  };
})();
