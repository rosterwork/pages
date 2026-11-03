/* ============================================================
   TREINO › EXEMPLOS DO BANCO — o exemplo que o banco monta (RosterWork.treinoBanco)
   Alguns treinos precisam de um registro que os dados de verdade podem
   não ter: uma troca pedida a você, uma esperando a aprovação, um
   saldo, um pedido de folga, a CNH sem resposta, uma correção de
   dados. No treino (o roteiro com data-cenario="troca-…", "folga-…",
   "cnh-…" ou "dados-…", ligado pelo geral-treino-cenarios.js), o banco
   monta o exemplo a cada chamada (treino_cenario, num ensaio que
   desfaz tudo), com as funções e os militares de verdade da companhia,
   e faz ali as leituras da página. Os ids do exemplo são sempre os
   mesmos; no roteiro, {exemplo} vira o id dele (a troca, a folga ou o
   pedido de correção; geral-guia-roteiros.js).
   As leituras que chegam no mesmo instante vão numa chamada só e
   ficam guardadas enquanto o exemplo vale (no treino nada muda: nada
   é gravado). Sem o exemplo (o banco não achou um dia que sirva, ou a
   pessoa não está na escala), as leituras vão ao banco de verdade.
   API: ativar(nome | null), cuida(nome, corpo), responder(nome, corpo, buscar), exemplo().
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  /* as leituras que veem o exemplo (as trocas, as folgas, as pendências e as correções de dados); o Editar das trocas
     só no ensaio (a Análise antes de salvar) */
  var LEITURAS = ['fn_trocas_listar', 'pendencias_listar', 'fn_trocas_pendencias_listar', 'fn_trocas_historico_par',
    'fn_trocas_saldo_entre', 'fn_trocas_registro', 'fn_trocas_analisar_impacto', 'pedido_escala_comparar', 'fn_trocas_impressao',
    'fn_trocas_varias_plano', 'fn_trocas_varias_dias', 'fn_trocas_varias_montar', 'fn_trocas_listar_militares', 'fn_trocas_meus_servicos',
    'pendencias_meus_pedidos', 'folgas_extrato', 'folgas_listar_lancamentos', 'folgas_listar_saldos', 'folgas_servicos_militar',
    'fn_folgas_analisar_impacto', 'perfil_solicitacoes_listar', 'perfil_solicitacoes_minhas', 'buscar_efetivo', 'buscar_ficha_militar'];
  var JUNTAR = 30;   // ms esperando outras leituras, para irem numa chamada só

  var est = null;    // { nome, exemplo, semExemplo, guardadas, fila, timer }

  function resposta(dados) { return new Response(JSON.stringify(dados), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  function chave(nome, corpo) { return nome + '|' + JSON.stringify(corpo || {}); }
  function chamar(nome, ler) {
    return RW.apiFetch('/rest/v1/rpc/treino_cenario', { metodo: 'POST', corpo: { p_cenario: nome, p_ler: ler } })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; });
  }

  /* começa (ou termina, com null) o exemplo; uma chamada leve, antes de a pessoa chegar à página, já traz os ids */
  function ativar(nome) {
    if (est && est.timer) clearTimeout(est.timer);
    if (!nome) { est = null; return; }
    var meu = est = { nome: nome, exemplo: null, semExemplo: false, guardadas: {}, fila: [], timer: null };
    chamar(nome, []).then(function (r) {
      if (est !== meu) return;
      if (r && r.ok) meu.exemplo = r.exemplo; else meu.semExemplo = true;
    });
  }

  function cuida(nome, corpo) {
    if (!est || est.semExemplo) return false;
    if (nome === 'fn_trocas_varias_editar') return !!corpo && corpo.p_ensaio === true;
    return LEITURAS.indexOf(nome) >= 0;
  }

  /* as leituras que chegaram juntas vão numa chamada só; sem o exemplo, cada uma vai ao banco de verdade */
  function descarregar() {
    var meu = est, fila = est.fila;
    meu.fila = [];
    meu.timer = null;
    chamar(meu.nome, fila.map(function (f) { return { rpc: f.rpc, args: f.args }; })).then(function (r) {
      if (!r || !r.ok) {
        if (est === meu) meu.semExemplo = true;
        fila.forEach(function (f) { f.resolver(f.buscar(f.args)); });
        return;
      }
      if (est === meu && !meu.exemplo) meu.exemplo = r.exemplo;
      fila.forEach(function (f, i) {
        if (est === meu) meu.guardadas[f.chave] = r.leituras[i];
        f.resolver(resposta(r.leituras[i]));
      });
    });
  }
  function responder(nome, corpo, buscar) {
    var k = chave(nome, corpo);
    if (Object.prototype.hasOwnProperty.call(est.guardadas, k)) return Promise.resolve(resposta(est.guardadas[k]));
    return new Promise(function (resolver) {
      est.fila.push({ rpc: nome, args: corpo || {}, chave: k, buscar: buscar, resolver: resolver });
      if (!est.timer) est.timer = setTimeout(descarregar, JUNTAR);
    });
  }

  RW.treinoBanco = {
    ativar: ativar, cuida: cuida, responder: responder,
    exemplo: function () { return est && est.exemplo ? est.exemplo.id || null : null; }
  };
})();
