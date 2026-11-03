/* ============================================================
   TREINO › EXTRAJORNADA — o mês de treino (RosterWork.treinoExtra)
   No treino da Extrajornada (o roteiro com data-cenario="extra-<etapa>",
   ligado pelo geral-treino-cenarios.js), a página mostra o mês de treino:
   o banco o monta a cada chamada (nova_extra_treino, num ensaio que
   desfaz tudo), com os números de novembro e quem está na companhia
   hoje, na etapa do roteiro (pedido, cotas, distribuicao, lancar ou
   lancado). A página abre nele, com as setas do mês paradas
   (nova-extra.js pergunta mes()).
   As leituras da Extrajornada (o mês, a Minha extra, a sugestão e, com
   o mês lançado, a escala dele) vão ao banco por aqui, juntas quando
   chegam no mesmo instante, e ficam guardadas até a próxima gravação.
   As gravações (prazo, termos, fechar os pedidos, cotas, distribuição,
   lançar, reabrir e o pedido) entram na lista do treino e voltam com a
   resposta de verdade, que o banco dá no ensaio; a recusada não entra
   na lista. A gravação já traz a leitura que a tela faz depois (o mês,
   ou a Minha extra no pedido). Com o mês lançado, as extras vêm antes
   numa chamada leve (a etapa lancar) e voltam nas outras, para nenhuma
   passar do limite de tempo do banco. Nada fica gravado.
   API: ativar(etapa | null), mes(), cuida(nome, corpo), responder(nome, corpo).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var LEITURAS = ['nova_extra_mes', 'nova_extra_minha', 'nova_extra_sugerir', 'ler_escala_mes'];
  var GRAVACOES = ['nova_extra_prazo_salvar', 'nova_extra_termos_salvar', 'nova_extra_pedidos_fechar', 'nova_extra_cotas_salvar',
    'nova_extra_distribuicao_salvar', 'nova_extra_lancar', 'nova_extra_reabrir', 'nova_extra_pedido_salvar'];
  var JUNTAR = 30;   // ms esperando outras leituras, para irem numa chamada só

  var est = null;    // { etapa, mes, acoes, extras, guardadas, fila, timer }

  function primeiroDia(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01'; }
  function resposta(dados) { return new Response(JSON.stringify(dados), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  function falhou(r) { return (r && r.error) || RW.mensagens.treino.mesFalhou; }
  /* a chave da leitura guardada: a competência é sempre a do mês de treino (o banco usa a dele) */
  function chave(nome, corpo) {
    var args = Object.assign({}, corpo || {});
    delete args.p_competencia;
    return nome + '|' + JSON.stringify(args);
  }
  function chamar(etapa, acoes, ler, extras) {
    return RW.apiFetch('/rest/v1/rpc/nova_extra_treino', { metodo: 'POST',
      corpo: { p_etapa: etapa, p_acoes: acoes, p_ler: ler, p_extras: extras || null } })
      .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; });
  }

  /* começa (ou termina, com null) o mês de treino; pergunta ao banco qual é o mês (o que vem; já lançado de verdade, o
     seguinte), numa chamada leve, antes de a pessoa chegar à página */
  function ativar(etapa) {
    if (est && est.timer) clearTimeout(est.timer);
    if (!etapa) { est = null; return; }
    var h = new Date();
    var meu = est = { etapa: etapa, mes: new Date(h.getFullYear(), h.getMonth() + 1, 1), acoes: [], extras: null, guardadas: {}, fila: [], timer: null };
    chamar('pedido', [], [], null).then(function (r) {
      if (est !== meu || !r || !r.ok || !r.competencia) return;
      meu.mes = new Date(+r.competencia.slice(0, 4), +r.competencia.slice(5, 7) - 1, 1);
    });
  }

  function lancado() { return est.etapa === 'lancado' || est.acoes.some(function (a) { return a.rpc === 'nova_extra_lancar'; }); }

  /* a chamada é do mês de treino? As gravações e as leituras da Extrajornada; a escala, só com o mês lançado (antes
     disso, a escala do mês de treino é a de verdade) e no período dele */
  function cuida(nome, corpo) {
    if (!est) return false;
    if (GRAVACOES.indexOf(nome) >= 0) return true;
    if (LEITURAS.indexOf(nome) < 0) return false;
    if (nome !== 'ler_escala_mes') return true;
    if (!lancado() || !corpo) return false;
    var ini = primeiroDia(est.mes), fim = primeiroDia(new Date(est.mes.getFullYear(), est.mes.getMonth() + 1, 1));
    return String(corpo.p_inicio) < fim && String(corpo.p_fim) >= ini;
  }

  /* com o mês lançado, as extras vêm antes (a etapa lancar, sem leitura nenhuma) */
  function garantirExtras(meu) {
    if (meu.extras || !lancado()) return Promise.resolve();
    return chamar('lancar', [], [], null).then(function (r) { if (r && r.ok && r.extras) meu.extras = r.extras; });
  }

  /* as leituras que chegaram juntas vão numa chamada só e ficam guardadas */
  function descarregar() {
    var meu = est, fila = est.fila;
    meu.fila = [];
    meu.timer = null;
    garantirExtras(meu).then(function () {
      return chamar(meu.etapa, meu.acoes, fila.map(function (f) { return { rpc: f.rpc, args: f.args }; }), meu.extras);
    }).then(function (r) {
      if (r && r.ok && r.extras && !meu.extras) meu.extras = r.extras;
      fila.forEach(function (f, i) {
        var dado = r && r.ok ? r.leituras[i] : { ok: false, error: falhou(r) };
        if (r && r.ok && est === meu) meu.guardadas[f.chave] = dado;
        f.resolver(resposta(dado));
      });
    });
  }
  function ler(nome, corpo) {
    var k = chave(nome, corpo);
    if (est.guardadas[k]) return Promise.resolve(resposta(est.guardadas[k]));
    return new Promise(function (resolver) {
      est.fila.push({ rpc: nome, args: corpo || {}, chave: k, resolver: resolver });
      if (!est.timer) est.timer = setTimeout(descarregar, JUNTAR);
    });
  }

  /* a gravação: o banco a aplica no ensaio, depois de todas as anteriores, e já devolve a leitura que a tela faz em
     seguida; deu certo, entra na lista do treino e as leituras guardadas valem de novo só a partir dela */
  function gravar(nome, corpo) {
    var meu = est, acao = { rpc: nome, args: corpo || {} };
    var depois = nome === 'nova_extra_pedido_salvar' ? [{ rpc: 'nova_extra_minha', args: { p_cpf: null } }] : [{ rpc: 'nova_extra_mes', args: {} }];
    return garantirExtras(meu).then(function () {
      return chamar(meu.etapa, meu.acoes.concat([acao]), depois, meu.extras);
    }).then(function (r) {
      if (!r || !r.ok) return resposta({ success: false, error: falhou(r) });
      if (r.extras && !meu.extras) meu.extras = r.extras;
      var dado = r.acoes[r.acoes.length - 1];
      if (dado && (dado.success === true || dado.ok === true) && est === meu) {
        meu.acoes.push(acao);
        meu.guardadas = {};
        depois.forEach(function (d, i) { meu.guardadas[chave(d.rpc, d.args)] = r.leituras[i]; });
      }
      return resposta(dado);
    });
  }

  function responder(nome, corpo) { return GRAVACOES.indexOf(nome) >= 0 ? gravar(nome, corpo) : ler(nome, corpo); }

  RW.treinoExtra = {
    ativar: ativar, cuida: cuida, responder: responder,
    mes: function () { return est ? est.mes : null; }
  };
})();
