/* ============================================================
   COMPONENTE geral-mini-calendario — o mês em miniatura
   Grade de 7 colunas (dom a sáb) só com os dias do mês, para marcar
   ou escolher dias dentro de um painel (Solicitar extra, na
   Extrajornada), e o calendário pessoal da Minha escala (Escala).
   Cada dia é um botão com o número, um número pequeno no canto e um
   texto embaixo; quem usa pinta (classes mini-calendario-dia--*),
   escreve e liga o clique pelo gancho aoDia.
   Opção comDiasDeFora (Minha escala, Várias trocas, Mudar o dia, Cobrir):
   no lugar das casas em branco, os dias do mês anterior e do seguinte
   até fechar a semana, com a marca --fora (o número no cinza do texto
   fraco); quem usa lê os dados do período inteiro (periodo). Sem ela,
   só os dias do mês (Solicitar extra).
   Clona os moldes do index.html (#tpl-mini-calendario, -dia, -vazio).
   API: RosterWork.miniCalendario.renderizar(alvo, { dataRef, aoDia(botao, iso, data, doMes), comDiasDeFora })
        RosterWork.miniCalendario.periodo(dataRef) -> { inicio, fim } (o domingo da 1ª semana e o sábado da última)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* o domingo da semana do dia 1º e o sábado da semana do último dia */
  function periodo(ref) {
    var primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    var ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return {
      inicio: new Date(primeiro.getFullYear(), primeiro.getMonth(), 1 - primeiro.getDay()),
      fim: new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 6 - ultimo.getDay())
    };
  }

  function renderizar(alvo, opcoes) {
    if (!alvo) return null;
    opcoes = opcoes || {};
    var ref = opcoes.dataRef || new Date();
    var mes = ref.getMonth();
    var grade = RosterWork.tpl('tpl-mini-calendario');
    if (!grade) return null;
    var faixa = periodo(ref);
    var inicioDoMes = new Date(ref.getFullYear(), mes, 1);
    for (var dia = new Date(faixa.inicio); dia <= faixa.fim; dia.setDate(dia.getDate() + 1)) {
      var doMes = dia.getMonth() === mes;
      /* sem os dias de fora: os de antes do dia 1º ficam vazios e os de depois do último não entram */
      if (!doMes && !opcoes.comDiasDeFora) {
        var vazio = dia < inicioDoMes ? RosterWork.tpl('tpl-mini-calendario-vazio') : null;
        if (vazio) grade.appendChild(vazio);
        continue;
      }
      var data = new Date(dia);
      var botao = RosterWork.tpl('tpl-mini-calendario-dia');
      if (!botao) continue;
      botao.querySelector('.mini-calendario-numero').textContent = String(data.getDate());
      botao.dataset.iso = iso(data);
      if (!doMes) botao.classList.add('mini-calendario-dia--fora');
      if (typeof opcoes.aoDia === 'function') opcoes.aoDia(botao, iso(data), data, doMes);
      grade.appendChild(botao);
    }
    alvo.textContent = '';
    alvo.appendChild(grade);
    return grade;
  }

  window.RosterWork.miniCalendario = { renderizar: renderizar, periodo: periodo };
})();
