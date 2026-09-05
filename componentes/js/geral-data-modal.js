/* ============================================================
   MODAL DE DATA — pergunta "a partir de qual data recalcular"
   RosterWork.pedirData({ mensagem, textoConfirmar, aoConfirmar(iso), aoCancelar })
   Campo de data (máscara + calendário). Padrão = amanhã; mínimo =
   hoje − 7 dias (permite passado recente e futuro, sem teto). Fecha
   só pelos botões. O #veu-data é fixo no shell; aqui só preenchemos
   e mostramos/escondemos (o geral-modal cuida do Tab preso/foco).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var veu, mensagemEl, input, campoEl, erroEl, btnConfirmar, btnCancelar;
  var aoConfirmar = null;
  var aoCancelar = null;
  var focoAnterior = null;

  function preparar() {
    if (veu) return true;
    veu = document.getElementById('veu-data');
    if (!veu) return false;
    mensagemEl = veu.querySelector('.data-modal-mensagem');
    input = veu.querySelector('[data-recalculo-data]');
    campoEl = input.closest('.campo');
    erroEl = veu.querySelector('.campo-erro-texto');
    btnConfirmar = veu.querySelector('.data-modal-confirmar');
    btnCancelar = veu.querySelector('.data-modal-cancelar');
    if (RosterWork.campos) RosterWork.campos.ligarData(input);
    btnConfirmar.addEventListener('click', confirmar);
    btnCancelar.addEventListener('click', function () {
      var fn = aoCancelar;
      fechar();
      if (fn) fn();
    });
    input.addEventListener('keydown', function (evento) {
      /* Enter confirma aqui mesmo (vale também para o botão perigoso de excluir); o
         stopPropagation evita que o Enter global do geral-modal dispare em dobro */
      if (evento.key === 'Enter') { evento.preventDefault(); evento.stopPropagation(); confirmar(); }
    });
    return true;
  }

  function fechar() {
    if (veu) veu.classList.remove('modal-veu--aberto');
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
    focoAnterior = null;
  }

  function limparErro() {
    if (campoEl) campoEl.classList.remove('campo--erro');
    if (erroEl) erroEl.textContent = '';
  }
  function marcarErro(texto) {
    if (campoEl) campoEl.classList.add('campo--erro');
    if (erroEl) erroEl.textContent = texto;
  }

  /* meia-noite de hoje */
  function meiaNoiteHoje() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  function confirmar() {
    var D = RosterWork.data;
    var M = RosterWork.mensagens;
    limparErro();
    var dt = D.paraData(input.value);
    if (!dt) { marcarErro(M.cadastro.dataInvalida); return; }
    dt.setHours(0, 0, 0, 0);
    var minimo = meiaNoiteHoje();
    minimo.setDate(minimo.getDate() - 7);
    if (dt < minimo) { marcarErro(M.geral.dataMuitoAntiga); return; }
    var iso = D.paraISO(input.value);
    var fn = aoConfirmar;
    fechar();
    if (fn) fn(iso);
  }

  function pedirData(opcoes) {
    if (!preparar()) return;
    opcoes = opcoes || {};
    mensagemEl.textContent = opcoes.mensagem || RosterWork.mensagens.geral.recalcularDesde;
    btnConfirmar.textContent = opcoes.textoConfirmar || 'Confirmar';
    /* botão de confirmação em vermelho para ações destrutivas (ex.: excluir modelo) */
    btnConfirmar.classList.toggle('botao--perigo', !!opcoes.confirmarPerigo);
    btnConfirmar.classList.toggle('botao--primario', !opcoes.confirmarPerigo);
    limparErro();
    /* padrão: amanhã */
    var amanha = meiaNoiteHoje();
    amanha.setDate(amanha.getDate() + 1);
    input.value = RosterWork.data.paraBR(amanha);
    aoConfirmar = opcoes.aoConfirmar || null;
    aoCancelar = opcoes.aoCancelar || null;
    focoAnterior = document.activeElement;
    veu.classList.add('modal-veu--aberto');
    input.focus();
    if (input.select) input.select();
  }

  window.RosterWork.pedirData = pedirData;
})();
