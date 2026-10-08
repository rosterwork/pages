/* ============================================================
   COMPONENTE geral-calendario-mes — grade de mês (calendário)
   Clona os moldes e desenha o mês como calendário mensal: da
   semana do dia 1º (começando no domingo) até a semana do último
   dia (terminando no sábado). Cada célula recebe o número do dia;
   "hoje" e dias de outro mês ganham sua classe. O conteúdo dentro
   de cada dia é responsabilidade de quem usa.
   Opção diasPorLinha (2–5, Escala → Colunas → Dias): em vez da
   semana, linhas de N dias numa SEQUÊNCIA CONTÍNUA — a coluna de
   cada dia vem da contagem desde 01/01/2000 (não reinicia no dia 1º),
   então o mesmo dia do ciclo cai sempre na mesma coluna, mês após
   mês. Sem o cabeçalho dom…sáb; cada dia mostra a sigla + o número.
   Opção unidadesPorDia (N ≥ 1, Escala e Extrajornada): cada dia empilha
   um bloco por unidade; o dia vira um bloco cinza e os blocos de cada
   unidade se alinham na mesma altura em toda a linha do calendário.
   Componente compartilhado (Escala e Extrajornada).
   API: RosterWork.geralCalendarioMes.renderizar(corpo, { dataRef, aoDia, diasPorLinha, unidadesPorDia })
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var ANCORA_CONTINUA = Date.UTC(2000, 0, 1);   // início fixo da contagem contínua (igual para todos)
  var MS_DIA = 86400000;


  /* coluna (0 a n−1) do dia na sequência contínua de n colunas: dias desde a âncora, módulo n
     (conta em UTC, então a mudança de horário não desloca a contagem) */
  function colunaContinua(d, n) {
    var dias = Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - ANCORA_CONTINUA) / MS_DIA);
    return ((dias % n) + n) % n;
  }

  /* mesmo dia do calendário (ignora a hora) */
  function mesmoDia(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  /* desenha o mês de opcoes.dataRef como calendário (domingo → sábado, ou N dias contínuos) */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    var dataRef = (opcoes && opcoes.dataRef) || new Date();
    var continuo = !!(opcoes && opcoes.diasPorLinha >= 2);
    var n = continuo ? opcoes.diasPorLinha : 7;

    var wrap = RosterWork.tpl('tpl-geral-calendario-mes');
    if (!wrap) return;
    var grade = wrap.querySelector('.geral-calendario-mes-grade');
    if (continuo) {
      wrap.classList.add('geral-calendario-mes--continuo');
      /* nº de colunas orientado a dados → custom property (o grid-template lê) */
      wrap.style.setProperty('--calendario-colunas', String(n));
    }
    var unidades = (opcoes && opcoes.unidadesPorDia) || 0;
    if (unidades >= 1) {
      wrap.classList.add('geral-calendario-mes--unidades');
      /* nº de unidades por dia orientado a dados → custom property (as linhas da grade de cada semana) */
      wrap.style.setProperty('--calendario-unidades', String(unidades));
    }

    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var primeiro = new Date(ano, mes, 1);
    var ultimo = new Date(ano, mes + 1, 0);

    /* recua até o início da 1ª linha e avança até o fim da última
       (semana: domingo e sábado; contínuo: a coluna 1 e a coluna N da contagem) */
    var inicio = new Date(primeiro);
    inicio.setDate(inicio.getDate() - (continuo ? colunaContinua(primeiro, n) : primeiro.getDay()));
    var fim = new Date(ultimo);
    fim.setDate(fim.getDate() + (continuo ? (n - 1 - colunaContinua(ultimo, n)) : (6 - ultimo.getDay())));

    var hoje = new Date();
    var dia = new Date(inicio);
    while (dia <= fim) {
      var semana = RosterWork.tpl('tpl-geral-calendario-mes-semana');
      for (var i = 0; i < n; i++) {
        var celula = RosterWork.tpl('tpl-geral-calendario-mes-dia');
        celula.querySelector('.geral-calendario-mes-numero').textContent = String(dia.getDate());
        if (continuo) celula.querySelector('.geral-calendario-mes-sigla').textContent = DIAS_ABREV[dia.getDay()];
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
