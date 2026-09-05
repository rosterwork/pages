/* ============================================================
   COMPONENTE geral-calendario-mes — grade de mês (calendário)
   Clona os moldes e desenha o mês como calendário mensal: da
   semana do dia 1º (começando no domingo) até a semana do último
   dia (terminando no sábado). Cada célula recebe o número do dia;
   "hoje" e dias de outro mês ganham sua classe. O conteúdo dentro
   de cada dia é responsabilidade de quem usa.
   Componente compartilhado (Escala e Extrajornada).
   API: RosterWork.geralCalendarioMes.renderizar(corpo, { dataRef })
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};


  /* mesmo dia do calendário (ignora a hora) */
  function mesmoDia(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  /* desenha o mês de opcoes.dataRef como calendário (domingo → sábado) */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    var dataRef = (opcoes && opcoes.dataRef) || new Date();

    var wrap = RosterWork.tpl('tpl-geral-calendario-mes');
    if (!wrap) return;
    var grade = wrap.querySelector('.geral-calendario-mes-grade');

    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var primeiro = new Date(ano, mes, 1);
    var ultimo = new Date(ano, mes + 1, 0);

    /* recua até o domingo da 1ª semana e avança até o sábado da última */
    var inicio = new Date(primeiro);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    var fim = new Date(ultimo);
    fim.setDate(fim.getDate() + (6 - fim.getDay()));

    var hoje = new Date();
    var dia = new Date(inicio);
    while (dia <= fim) {
      var semana = RosterWork.tpl('tpl-geral-calendario-mes-semana');
      for (var i = 0; i < 7; i++) {
        var celula = RosterWork.tpl('tpl-geral-calendario-mes-dia');
        celula.querySelector('.geral-calendario-mes-numero').textContent = String(dia.getDate());
        if (dia.getMonth() !== mes) celula.classList.add('geral-calendario-mes-dia--fora');
        if (mesmoDia(dia, hoje)) celula.classList.add('geral-calendario-mes-dia--hoje');
        /* gancho opcional: quem usa pode pintar/preencher/ligar clique em cada dia
           (recebe a célula, a data do dia e se é do mês exibido). A Escala não passa. */
        if (opcoes && typeof opcoes.aoDia === 'function') opcoes.aoDia(celula, new Date(dia), dia.getMonth() === mes);
        semana.appendChild(celula);
        dia.setDate(dia.getDate() + 1);
      }
      grade.appendChild(semana);
    }

    corpo.textContent = '';
    corpo.appendChild(wrap);
  }

  window.RosterWork.geralCalendarioMes = { renderizar: renderizar };
})();
