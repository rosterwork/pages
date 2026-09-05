/* ============================================================
   FOLGAS — camada de dados (RPC) e formatadores compartilhados
   Expõe:
     RosterWork.folgasDados   — chamadas às funções do banco
     RosterWork.folgasFormato — helpers de exibição (horas, datas,
                                selos de saldo e de situação)
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};


  RW.folgasDados = {
    saldos: function () { return RosterWork.rpc('folgas_listar_saldos', {}); },
    extrato: function (cpf) { return RosterWork.rpc('folgas_extrato', { p_usuario_id: cpf }); },
    servicos: function (cpf) { return RosterWork.rpc('folgas_servicos_militar', { p_usuario_id: cpf }); },
    solicitacoes: function (cpf) { return RosterWork.rpc('folgas_listar_solicitacoes', { p_cpf: cpf }); },
    lancamentos: function (cpf, escopo, desde) { return RosterWork.rpc('folgas_listar_lancamentos', { p_cpf: cpf, p_escopo: escopo, p_desde: desde }); },
    solicitar: function (corpo) { return RosterWork.rpc('folgas_solicitar', corpo); },
    decidir: function (id, aprovar, por) { return RosterWork.rpc('folgas_decidir', { p_lancamento_id: id, p_aprovar: aprovar, p_decidido_por: por }); },
    analisar: function (id) { return RosterWork.rpc('fn_folgas_analisar_impacto', { p_lancamento_id: id }); },
    dar: function (corpo) { return RosterWork.rpc('folgas_dar', corpo); },
    ajustar: function (cpf, minutos, motivo, por) { return RosterWork.rpc('folgas_ajustar_saldo', { p_usuario_id: cpf, p_minutos: minutos, p_motivo: motivo, p_por: por }); },
    cancelar: function (id, por) { return RosterWork.rpc('folgas_cancelar', { p_lancamento_id: id, p_por: por }); }
  };

  /* ---------- formatadores ---------- */
  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  /* saldo com sinal: '+8h', '−4h', '0h' */
  function saldoTexto(min) {
    min = min || 0;
    if (min > 0) return '+' + RosterWork.tempo.horas(min);
    if (min < 0) return '−' + RosterWork.tempo.horas(min);
    return '0h';
  }
  /* valor de uma linha do extrato pelo sinal do banco ('+' ou '-') */
  function valorTexto(sinal, min) {
    return (sinal === '-' ? '−' : '+') + RosterWork.tempo.horas(min);
  }
  /* classe do selo do saldo: verde (+), vermelho (−), neutro (0) */
  function saldoSeloClasse(min) {
    min = min || 0;
    return min > 0 ? 'selo--sucesso' : (min < 0 ? 'selo--erro' : '');
  }

  var SIT_CLASSE = {
    pendente: 'selo--alerta', aprovada: 'selo--sucesso', concedida: 'selo--sucesso',
    recusada: 'selo--erro', cancelada: 'selo--escuro'
  };
  function situacaoClasse(s) { return SIT_CLASSE[s] || 'selo--escuro'; }

  /* 'AAAA-MM-DD' -> '12/07/2026' */
  function dataNumerica(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length < 3 ? iso : p[2] + '/' + p[1] + '/' + p[0];
  }
  /* 'AAAA-MM-DD' -> '12/07/2026 (qui)' */
  function dataLonga(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length < 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return RosterWork.tempo.doisDig(d.getDate()) + '/' + RosterWork.tempo.doisDig(d.getMonth() + 1) + '/' + d.getFullYear() + ' (' + DIAS[d.getDay()] + ')';
  }

  /* nós de exibição — a seta é o ícone (tpl-folga-de-para), nunca o caractere → */
  function dePara(de, para) {
    var el = RosterWork.tpl('tpl-folga-de-para');
    if (!el) return document.createTextNode((de == null ? '' : de) + ' ' + (para == null ? '' : para));
    el.querySelector('.folga-de-para-de').textContent = de == null ? '' : String(de);
    el.querySelector('.folga-de-para-para').textContent = para == null ? '' : String(para);
    return el;
  }
  function periodoNo(hi, hf) {
    if (!hi || !hf || hi === hf) return document.createTextNode(RW.mensagens.folgas.diaInteiro);
    return dePara(hi, hf);
  }

  RW.folgasFormato = {
    horasAbs: RosterWork.tempo.horas,
    saldoTexto: saldoTexto,
    valorTexto: valorTexto,
    saldoSeloClasse: saldoSeloClasse,
    situacaoClasse: situacaoClasse,
    dataNumerica: dataNumerica,
    dataLonga: dataLonga,
    dePara: dePara,
    periodoNo: periodoNo
  };
})();
