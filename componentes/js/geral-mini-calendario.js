/* ============================================================
   COMPONENTE geral-mini-calendario — o mês em miniatura
   Grade de 7 colunas (dom a sáb) só com os dias do mês, para marcar
   ou escolher dias dentro de um painel (Solicitar extra, na
   Extrajornada).
   Cada dia é um botão com o número, um número pequeno no canto e um
   texto embaixo; quem usa pinta (classes mini-calendario-dia--*),
   escreve e liga o clique pelo gancho aoDia.
   Clona os moldes do index.html (#tpl-mini-calendario, -dia, -vazio).
   API: RosterWork.miniCalendario.renderizar(alvo, { dataRef, aoDia(botao, iso, data) })
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderizar(alvo, opcoes) {
    if (!alvo) return null;
    opcoes = opcoes || {};
    var ref = opcoes.dataRef || new Date();
    var ano = ref.getFullYear(), mes = ref.getMonth();
    var grade = RosterWork.tpl('tpl-mini-calendario');
    if (!grade) return null;
    /* os dias antes do dia 1º (desde o domingo) ficam vazios */
    var primeiro = new Date(ano, mes, 1).getDay();
    for (var v = 0; v < primeiro; v++) {
      var vazio = RosterWork.tpl('tpl-mini-calendario-vazio');
      if (vazio) grade.appendChild(vazio);
    }
    var ultimo = new Date(ano, mes + 1, 0).getDate();
    for (var d = 1; d <= ultimo; d++) {
      var data = new Date(ano, mes, d);
      var botao = RosterWork.tpl('tpl-mini-calendario-dia');
      if (!botao) continue;
      botao.querySelector('.mini-calendario-numero').textContent = String(d);
      botao.dataset.iso = iso(data);
      if (typeof opcoes.aoDia === 'function') opcoes.aoDia(botao, iso(data), data);
      grade.appendChild(botao);
    }
    alvo.textContent = '';
    alvo.appendChild(grade);
    return grade;
  }

  window.RosterWork.miniCalendario = { renderizar: renderizar };
})();
