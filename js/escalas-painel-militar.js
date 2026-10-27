/* ============================================================
   ESCALAS — a folga no dia (o lápis da caixa De folga; só admin)
   Sub-tela do painel do dia: quem está de folga, o horário, o efeito
   de cancelar e o Cancelar folga, que confirma e grava na hora
   (escalas-painel-editar.js); sem rodapé, a saída é o Voltar ao dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

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
      tela.querySelector('.nota-texto').textContent = msg().cancelarFolgaEfeito(nomeDe(f), contabilizada);
      tela.querySelector('.escala-folga-dia-cancelar').addEventListener('click', cancelar);
      corpo.appendChild(tela);
    }

    function cancelar() {
      var botoes = RosterWork.mensagens.botoes;
      RosterWork.confirmar({ tipo: 'aviso', mensagem: msg().confirmarCancelarFolga(nomeDe(f), diaMes(api.iso())),
        textoConfirmar: botoes.cancelarFolga, textoCancelar: botoes.manter, confirmarPerigo: true,
        aoConfirmar: function () { api.cancelarFolga(id); api.concluir(); } });
    }

    api.abrir(null, montar, null);
  }

  window.RosterWork.escalasPainelMilitar = { abrirFolga: abrirFolga };
})();
