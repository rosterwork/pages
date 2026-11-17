/* ============================================================
   ESCALAS — o que a caixa da célula da grade usa, lido antes do
   clique (a caixa: escalas-celula-editar.js). Quando a grade aparece,
   para quem edita: as unidades da companhia (uma vez por sessão) e o
   mês da Extrajornada (uma vez por mês, escalas-celula-extra.js), e o
   1º clique não espera por eles. O dia da célula que abre a caixa
   começa a ser lido com o mouse parado nela (0,15 s), no aperto do
   botão (na hora) e no toque (um por vez: o dedo pode só rolar a
   grade); escalas-dados.js guarda a leitura e a caixa abre com ela.
   Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaAdiantar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var PARADO_MS = 150;   // o mouse parado na célula por isto: o dia começa a ser lido
  var adiantados = {};   // o que já foi pedido ao aparecer a grade: 'unidades' e cada mês ('AAAA-MM')
  var mira = null;       // a célula com o mouse em cima: { cel, relogio }

  function E() { return RW.escalasCelulaEditar; }

  /* a célula da grade em que a pessoa edita apareceu (escalas-celula-editar.js › decorar): o que serve a todas as caixas
     já começa a ser lido; se a leitura falha, o clique tenta de novo. d = { unidadeId, iso } */
  function aoEntrar(d) {
    var R = RW.escalasPainelRemanejar, X = RW.escalasCelulaExtra, mes = d.iso.slice(0, 7);
    if (R && !adiantados.unidades && !R.unidadesProntas()) { adiantados.unidades = true; R.prepararUnidades(); }
    if (X && !adiantados[mes] && X.falta(d)) { adiantados[mes] = true; X.adiantar(d); }
  }

  /* a célula do alvo (no Calendário, o bloco da unidade vale como a célula dele, como no clique) */
  function celulaDo(alvo) {
    var bloco = alvo && alvo.closest ? alvo.closest('.escala-mes-celula, .escala-calendario-unidade') : null;
    return bloco && bloco.classList.contains('escala-calendario-unidade') ? bloco.querySelector('.escala-mes-celula') : bloco;
  }

  /* só a célula que abre a caixa (não a que abre o painel ou o aviso do dia antigo), num dia que a caixa ainda não tem */
  function adiantarDia(cel, agora) {
    if (!cel || !cel.isConnected || !E() || E().podeNaCelula(cel) !== true || !RW.escalasDados) return;
    var uid = cel.dataset.unidadeId, iso = cel.dataset.iso;
    if (!E().ehDia(uid, iso)) RW.escalasDados.adiantarDia(uid, iso, agora);
  }

  document.addEventListener('pointerover', function (ev) {
    if (ev.pointerType !== 'mouse') return;
    var cel = celulaDo(ev.target);
    if (mira && mira.cel === cel) return;
    if (mira) clearTimeout(mira.relogio);
    mira = cel ? { cel: cel, relogio: setTimeout(function () { adiantarDia(cel, false); }, PARADO_MS) } : null;
  });
  /* o aperto do mouse é quase sempre o clique: na hora; o dedo pode só rolar a grade: um por vez */
  document.addEventListener('pointerdown', function (ev) {
    if (ev.button !== 0) return;
    adiantarDia(celulaDo(ev.target), ev.pointerType === 'mouse');
  });

  RW.escalasCelulaAdiantar = { aoEntrar: aoEntrar };
})();
