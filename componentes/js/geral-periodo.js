/* ============================================================
   COMPONENTE geral-periodo — abrir as grades de datas em hoje
   Regra comum das grades com datas (computador e celular): quando o
   período da tela contém hoje, a área abre rolada até hoje, com o
   começo de hoje encostado no alto (ou na esquerda) e só uma ponta
   do que vem antes à vista (o dia, a semana ou os dias anteriores),
   que mostra que há mais para trás. Com muitos dados, o começo de
   hoje continua à vista e o resto se lê rolando. O visual do
   período (‹ rótulo › Hoje) mora no geral-periodo.css; cada página
   liga o seu. Componente compartilhado (Escala, Extrajornada e o
   calendário do Início, que também rola até o dia clicado).
   API: RosterWork.periodo.rolarAteHoje(area, hoje, anterior, opcoes)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var PONTA_ANTERIOR = 32;   // quanto do que vem antes de hoje fica à vista (px)

  /* rola a `area` (o contêiner que rola, ainda no começo) até `hoje` (a linha, a semana ou a coluna de
     hoje), com uma ponta da peça `anterior` à vista antes dele; sem `anterior` (hoje é o primeiro), a área fica no
     começo. opcoes.horizontal: rola para o lado (colunas); opcoes.fixo: a parte que gruda no começo da
     área (o cabeçalho, ou a coluna da esquerda), que tapa o começo da rolagem e não conta como visível */
  function rolarAteHoje(area, hoje, anterior, opcoes) {
    if (!area || !hoje || !anterior) return;
    var horizontal = !!(opcoes && opcoes.horizontal);
    var fixo = opcoes && opcoes.fixo;

    function inicio(el) {
      var caixa = el.getBoundingClientRect();
      return horizontal ? caixa.left : caixa.top;
    }

    var tamanhoFixo = 0;
    if (fixo && fixo.getClientRects().length) {
      var caixaFixo = fixo.getBoundingClientRect();
      tamanhoFixo = horizontal ? caixaFixo.width : caixaFixo.height;
    }
    var comecoVisivel = inicio(area) + (horizontal ? area.clientLeft : area.clientTop) + tamanhoFixo;
    var visivel = (horizontal ? area.clientWidth : area.clientHeight) - tamanhoFixo;
    var caixaHoje = hoje.getBoundingClientRect();
    var tamanhoHoje = horizontal ? caixaHoje.width : caixaHoje.height;
    /* o que vem antes aparece só na ponta, e só até onde hoje ainda cabe inteiro; hoje maior que a área
       encosta no começo */
    var limite = Math.max(0, Math.min(PONTA_ANTERIOR, visivel - tamanhoHoje));
    var antes = inicio(hoje) - inicio(anterior);
    var deslocamento = inicio(hoje) - comecoVisivel - Math.min(antes, limite);
    if (horizontal) area.scrollLeft += deslocamento;
    else area.scrollTop += deslocamento;
  }

  window.RosterWork.periodo = { rolarAteHoje: rolarAteHoje };
})();
