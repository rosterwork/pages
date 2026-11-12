/* ============================================================
   ESCALAS — painel do dia › aba EXTRAJORNADA
   O mesmo painel dos Ajustes (extrajornada-dia.js), para o mês já
   lançado: quem está no dia, quem quer, quem não quer e quem não pode.
   Mês não lançado: só a mensagem. Unidade de fora da companhia de quem
   entrou: a frase. O rascunho é do mês (extrajornada-grade.js): trocar de
   dia não perde nada, e os dias mudados levam a borda tracejada. O
   Salvar é o rodapé largo da página, junto com o Dia e o Ciclo
   (escalas-painel-salvar.js, p_extra do escala_painel_salvar). A
   célula da grade, com o painel fechado, usa o mesmo mês e o mesmo
   rascunho (escalas-celula-extra.js: carregar, pronto, usarNaCelula).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.escalasPainelExtra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var mes = null;      // a resposta do extrajornada_mes do mês aberto
  var ctx = null;      // a aba aberta: { corpo, uid, iso }
  var pedido = 0;      // latest-wins
  var lendo = null;    // a leitura da célula em curso: { comp, promessa }
  var onde = null;     // o dia da célula que mexe na extra, com a aba fechada: { unidadeId, iso, unidadeNome }

  function msg() { return RW.mensagens.extrajornada.org; }
  function G() { return RW.extrajornadaGrade; }
  function lancada() { return !!mes && !!mes.lancamento && !mes.lancamento.reaberto; }
  function sujo() { return lancada() && G().alteracoes().length > 0; }

  function frase(corpo, texto) {
    corpo.textContent = '';
    var e = RW.tpl('tpl-escala-distribuicao-estado');
    if (e) { e.textContent = texto; corpo.appendChild(e); }
  }

  /* o mês lido na aba: o painel do dia, ou a mensagem */
  function mostrar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    if (mes.admin === false || !mes.unidades.some(function (un) { return un.id === ctx.uid; })) { frase(corpo, msg().outraCompanhia); return; }
    if (!lancada()) {
      corpo.textContent = '';
      var caixa = RW.tpl('tpl-extrajornada-painel-nao-lancada');
      caixa.querySelector('.extrajornada-painel-nao-lancada-mes').textContent = G().nomeDoMes(mes.competencia);
      corpo.appendChild(caixa);
      return;
    }
    RW.extrajornadaDia.mostrarEm(ctx.uid, ctx.iso);
  }

  /* o rascunho mudou: o painel e a caixa da célula na hora, e o rodapé e as telas pelo aviso dos rascunhos
     (escalas-painel-salvar.js) */
  function aoMudar() {
    G().calcularPicos(G().efetivas());
    RW.extrajornadaDia.redesenhar();
    if (RW.extrajornadaCelula) RW.extrajornadaCelula.redesenhar();
    window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho'));
  }

  /* o mês lido: o rascunho dele começa vazio */
  function usarMes(r) {
    mes = r;
    RW.extrajornadaUtil.usar(r);
    G().iniciar(r, 'ajustes', aoMudar);
    G().limpar();
    G().escalaDoMes();
    G().calcularPicos(G().efetivas());
  }

  /* a célula da grade (o painel fechado): o mês do dia, lido uma vez (o já lido fica, com ou sem mudança). A Promise diz
     se ele está aqui (false: a leitura falhou, ou há mudança não salva em outro mês) */
  function carregar(iso) {
    var comp = iso.slice(0, 8) + '01';
    if (mes && mes.competencia === comp) return Promise.resolve(true);
    if (sujo()) return Promise.resolve(false);
    if (lendo && lendo.comp === comp) return lendo.promessa;
    var p = RW.extrajornadaUtil.chamar('extrajornada_mes', { p_competencia: comp }).then(function (r) {
      if (lendo && lendo.promessa === p) lendo = null;
      if (!r || !r.ok || sujo()) return false;
      usarMes(r);
      return true;
    }, function () { if (lendo && lendo.promessa === p) lendo = null; return false; });
    lendo = { comp: comp, promessa: p };
    return p;
  }

  function montar(corpo, rodape, unidadeId, iso) {
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    var comp = iso.slice(0, 8) + '01';
    ctx = { corpo: corpo, uid: +unidadeId, iso: iso };
    /* com mudança não salva, o mês já lido fica (o rascunho é do mês) */
    if (sujo()) {
      if (mes.competencia === comp) mostrar();
      else frase(corpo, msg().salvarOutroMes(G().nomeDoMes(mes.competencia)));
      return;
    }
    corpo.textContent = '';
    var c = RW.painel.criarCarregando();
    if (c) corpo.appendChild(c);
    var meu = ++pedido;
    RW.painel.segurar(RW.extrajornadaUtil.chamar('extrajornada_mes', { p_competencia: comp })).then(function (r) {
      if (meu !== pedido || !ctx) return;
      if (!r || !r.ok) { frase(corpo, (r && r.error) || msg().falhaMes); return; }
      usarMes(r);
      mostrar();
    }, function () { if (meu === pedido && ctx) frase(corpo, msg().falhaMes); });
  }

  /* a aba saiu da tela (o rascunho fica até o Salvar) */
  function reset() {
    ctx = null;
    pedido++;
    if (RW.extrajornadaDia) RW.extrajornadaDia.soltar();
  }

  /* o rascunho vazio; o mês é lido de novo na próxima vez que a aba abrir */
  function descartar() {
    if (mes) G().limpar();
    mes = null;
    onde = null;
    if (RW.extrajornadaDia) RW.extrajornadaDia.reorganizar();
  }

  function mudancas() { return G().alteracoes().map(function (k) { return G().rascunho()[k]; }); }

  /* fechar ou recarregar o navegador, ou ir para outra página, com o rascunho: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(sujo);

  RW.escalasPainelExtra = {
    montar: montar,
    reset: reset,
    descartar: descartar,
    sujo: sujo,
    contar: function () { return sujo() ? G().alteracoes().length : 0; },
    /* o primeiro que passou da cota no rascunho: { nome, n } (o Salvar espera), ou null */
    passou: function () {
      var m = sujo() ? G().passaram()[0] : null;
      return m ? { nome: (m.grad + ' ' + m.nome).trim(), n: G().usadas(m.cpf) - m.concedidas } : null;
    },
    /* a célula da grade: o mês do dia, se a extra do pelotão se mexe nele (lançado e da companhia de quem entrou), e o
       dia dela para o rodapé; com a aba fechada e mudança na extra, o dia do rodapé é esse (escalas-painel-salvar.js) */
    carregar: carregar,
    pronto: function (uid, iso) {
      return !!mes && mes.competencia === iso.slice(0, 8) + '01' && lancada() && mes.admin !== false
        && mes.unidades.some(function (un) { return un.id === +uid; });
    },
    usarNaCelula: function (d) { onde = { unidadeId: d.unidadeId, iso: d.iso, unidadeNome: d.unidadeNome || '' }; },
    naCelula: function () { return !ctx && onde && sujo() ? { unidadeId: onde.unidadeId, iso: onde.iso, secao: 'extra', unidadeNome: onde.unidadeNome } : null; },
    /* o Desfazer e o Refazer do rodapé largo (escalas-painel-salvar.js): um passo do rascunho do mês, e o painel refeito
       como numa mudança (na aba, ou na célula que mexeu na extra) */
    podeDesfazer: function () { return (!!ctx || !!onde) && lancada() && G().podeDesfazer(); },
    podeRefazer: function () { return (!!ctx || !!onde) && lancada() && G().podeRefazer(); },
    desfazer: function () { if (G().desfazer()) { RW.extrajornadaDia.reorganizar(); aoMudar(); } },
    refazer: function () { if (G().refazer()) { RW.extrajornadaDia.reorganizar(); aoMudar(); } },
    /* o que o Salvar leva (null sem mudança; o banco aceita o ajuste sem motivo) */
    envio: function () {
      return sujo() ? { competencia: mes.competencia, mudancas: mudancas(), motivo: null } : null;
    },
    /* o que as telas mostram: a prévia não leva quem passou da cota, que o banco recusaria. No mês de treino, o mês é de
       exemplo e o banco não o conhece: as telas ficam como estão, só com a borda tracejada */
    paraPrevia: function () {
      if (!mes || (RW.treinoExtra && RW.treinoExtra.mes() && RW.treinoExtra.ehDoTreino(mes.competencia))) return null;
      return sujo() && !G().passaram().length ? { competencia: mes.competencia, mudancas: mudancas(), motivo: null } : null;
    },
    /* o rascunho inteiro, para saber se ele mudou */
    marca: function () { return sujo() ? JSON.stringify(mudancas()) : ''; },
    /* a borda tracejada; sem a unidade (null), em qualquer unidade (a Minha escala) */
    marcado: function (unidadeId, iso) {
      if (!sujo()) return false;
      var marcados = G().naoSalvos();
      if (unidadeId != null) return !!marcados[+unidadeId + '|' + iso];
      return Object.keys(marcados).some(function (k) { return k.split('|')[1] === iso; });
    }
  };
})();
