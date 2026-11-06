/* ============================================================
   ESCALAS — painel do dia › aba EXTRAJORNADA
   O mesmo painel dos Ajustes (nova-extra-dia.js), para o mês já
   lançado: quem está no dia, quem quer, quem não quer e quem não pode.
   Mês não lançado: só a mensagem. Unidade de fora da companhia de quem
   entrou: a frase. O rascunho é do mês (nova-extra-grade.js): trocar de
   dia não perde nada, e os dias mudados levam a borda tracejada. O
   Salvar é o rodapé largo da página, junto com o Dia e o Ciclo
   (escalas-painel-salvar.js, p_extra do escala_painel_salvar).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.escalasPainelExtra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var mes = null;      // a resposta do nova_extra_mes do mês aberto
  var ctx = null;      // a aba aberta: { corpo, uid, iso }
  var pedido = 0;      // latest-wins

  function msg() { return RW.mensagens.novaExtra.org; }
  function G() { return RW.novaExtraGrade; }
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
      var caixa = RW.tpl('tpl-escala-extra-nao-lancada');
      caixa.querySelector('.escala-extra-nao-lancada-mes').textContent = G().nomeDoMes(mes.competencia);
      corpo.appendChild(caixa);
      return;
    }
    RW.novaExtraDia.mostrarEm(ctx.uid, ctx.iso);
  }

  /* o rascunho mudou: o painel na hora, e o rodapé e as telas pelo aviso dos rascunhos (escalas-painel-salvar.js) */
  function aoMudar() {
    G().calcularPicos(G().efetivas());
    RW.novaExtraDia.redesenhar();
    window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho'));
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
    var c = RW.tpl('tpl-escala-distribuicao-carregando');
    if (c) corpo.appendChild(c);
    var meu = ++pedido;
    RW.novaExtraUtil.chamar('nova_extra_mes', { p_competencia: comp }).then(function (r) {
      if (meu !== pedido || !ctx) return;
      if (!r || !r.ok) { frase(corpo, (r && r.error) || msg().falhaMes); return; }
      mes = r;
      RW.novaExtraUtil.usar(r);
      G().iniciar(r, 'ajustes', aoMudar);
      G().limpar();
      G().escalaDoMes();
      G().calcularPicos(G().efetivas());
      mostrar();
    }, function () { if (meu === pedido && ctx) frase(corpo, msg().falhaMes); });
  }

  /* a aba saiu da tela (o rascunho fica até o Salvar) */
  function reset() {
    ctx = null;
    pedido++;
    if (RW.novaExtraDia) RW.novaExtraDia.soltar();
  }

  /* o rascunho vazio; o mês é lido de novo na próxima vez que a aba abrir */
  function descartar() {
    if (mes) G().limpar();
    mes = null;
    if (RW.novaExtraDia) RW.novaExtraDia.reorganizar();
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
    /* o que o Salvar leva (null sem mudança) */
    envio: function (motivo) {
      return sujo() ? { competencia: mes.competencia, mudancas: mudancas(), motivo: motivo || null } : null;
    },
    /* o que as telas mostram: a prévia não leva quem passou da cota, que o banco recusaria. No treino, o mês é de exemplo
       e o banco não o conhece: as telas ficam como estão, só com a borda tracejada */
    paraPrevia: function () {
      if (RW.treinoExtra && RW.treinoExtra.mes()) return null;
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
