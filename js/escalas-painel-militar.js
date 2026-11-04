/* ============================================================
   ESCALAS — a folga no dia (o lápis da caixa De folga; só admin)
   Sub-tela do painel do dia: quem está de folga, o horário e a
   pergunta Folga (Manter a folga, já marcada, ou Cancelar a folga,
   com o efeito embaixo). Cancelar entra no rascunho do dia ao vivo
   (escalas-painel-editar.js › aoVivo; grava no Salvar do rodapé
   largo); a saída é o Voltar ao dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* id = a folga (lancamento_id); as linhas dela no dia dão o horário */
  function abrirFolga(id) {
    var api = ed(), H = api.horas;
    var linhas = ((api.dados() || {}).folgas || []).filter(function (f) { return f.lancamento_id === id; });
    if (!linhas.length) return;
    var f = linhas[0];
    var contabilizada = !!f.contabilizada;

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-folga-dia');
      if (!tela) return;
      tela.querySelector('.escala-distribuicao-grad').textContent = f.grad || '';
      tela.querySelector('.escala-militar-nome-texto').textContent = f.nome || '';
      tela.querySelector('.escala-folga-dia-periodo').textContent =
        msg().folgaNoDia(f.dia_inteiro ? '' : H.textoPeriodos(linhas), contabilizada);
      var efeito = tela.querySelector('.escala-folga-dia-efeito');
      efeito.querySelector('.nota-texto').textContent = msg().cancelarFolgaEfeito(nomeDe(f), contabilizada);
      var nome = 'escala-folga-dia-' + (++conta);
      [].forEach.call(tela.querySelectorAll('.escala-folga-dia-pergunta input[type="radio"]'), function (r) {
        r.name = nome;
        r.checked = r.value === 'manter';
        r.addEventListener('change', function () {
          if (!r.checked) return;
          var cancelar = r.value === 'cancelar';
          efeito.classList.toggle('oculto', !cancelar);
          api.aoVivo(cancelar ? function () { api.cancelarFolga(id); } : null, false);
        });
      });
      corpo.appendChild(tela);
    }

    api.abrir(montar);
  }

  window.RosterWork.escalasPainelMilitar = { abrirFolga: abrirFolga };
})();
