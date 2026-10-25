/* ============================================================
   MODAL DE DATA — pergunta "a partir de qual data recalcular"
   RosterWork.pedirData({ mensagem, textoConfirmar, confirmarPerigo, sugerida,
                          titulo, sugestaoAntes, sugestaoDepois, data, conteudo,
                          aoConfirmar(iso), aoCancelar })
   Campo de data (máscara + calendário). Padrão = o próximo dia de
   serviço (o dia vira às 08h; por padrão o plantão em curso não muda;
   escolher hoje muda desde hoje). titulo e sugestaoAntes/Depois trocam
   o título e a frase em volta da data (sem eles, os da escala); data
   (AAAA-MM-DD) já vem escrita no campo; conteudo (um elemento) entra
   embaixo do campo e sai ao fechar.
   sugerida: a data vem escrita numa frase e o campo só aparece em
   "Escolher outra data" (configuração sem data própria). Mínimo =
   hoje − 7 dias (permite passado recente e futuro, sem teto). Fecha
   só pelos botões. O #veu-data é fixo no shell; aqui só preenchemos
   e mostramos/escondemos (o geral-modal cuida do Tab preso/foco).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var veu, tituloEl, mensagemEl, sugestaoEl, sugestaoAntesEl, sugestaoDataEl, sugestaoDepoisEl, btnOutra, input, campoEl, erroEl,
    conteudoEl, btnConfirmar, btnCancelar;
  var padrao = {};   /* os textos do HTML (os da escala), para voltar a eles */
  var aoConfirmar = null;
  var aoCancelar = null;
  var focoAnterior = null;

  function preparar() {
    if (veu) return true;
    veu = document.getElementById('veu-data');
    if (!veu) return false;
    tituloEl = veu.querySelector('.modal-titulo');
    mensagemEl = veu.querySelector('.data-modal-mensagem');
    sugestaoEl = veu.querySelector('.data-modal-sugestao');
    sugestaoAntesEl = veu.querySelector('.data-modal-sugestao-antes');
    sugestaoDataEl = veu.querySelector('.data-modal-sugestao-data');
    sugestaoDepoisEl = veu.querySelector('.data-modal-sugestao-depois');
    conteudoEl = veu.querySelector('.data-modal-conteudo');
    padrao = { titulo: tituloEl.textContent, antes: sugestaoAntesEl.textContent, depois: sugestaoDepoisEl.textContent };
    btnOutra = veu.querySelector('.data-modal-outra');
    input = veu.querySelector('[data-recalculo-data]');
    campoEl = input.closest('.campo');
    erroEl = veu.querySelector('.campo-erro-texto');
    btnConfirmar = veu.querySelector('.data-modal-confirmar');
    btnCancelar = veu.querySelector('.data-modal-cancelar');
    if (RosterWork.campos) RosterWork.campos.ligarData(input);
    btnConfirmar.addEventListener('click', confirmar);
    btnOutra.addEventListener('click', mostrarCampo);
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
    if (conteudoEl) { conteudoEl.textContent = ''; conteudoEl.classList.add('oculto'); }
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

  /* "Escolher outra data": troca a frase pelo campo, já com a data sugerida */
  function mostrarCampo() {
    sugestaoEl.classList.add('oculto');
    btnOutra.classList.add('oculto');
    campoEl.classList.remove('oculto');
    input.focus();
    if (input.select) input.select();
  }

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
    var sugerida = !!opcoes.sugerida;
    /* no modo sugerido a frase da data já explica; sem mensagem própria, o espaço some */
    var mensagem = opcoes.mensagem || (sugerida ? '' : RosterWork.mensagens.geral.recalcularDesde);
    mensagemEl.textContent = mensagem;
    mensagemEl.classList.toggle('oculto', !mensagem);
    btnConfirmar.textContent = opcoes.textoConfirmar || 'Confirmar';
    /* botão de confirmação em vermelho para ações destrutivas (ex.: excluir modelo) */
    btnConfirmar.classList.toggle('botao--perigo', !!opcoes.confirmarPerigo);
    btnConfirmar.classList.toggle('botao--primario', !opcoes.confirmarPerigo);
    limparErro();
    tituloEl.textContent = opcoes.titulo || padrao.titulo;
    sugestaoAntesEl.textContent = opcoes.sugestaoAntes != null ? opcoes.sugestaoAntes : padrao.antes;
    sugestaoDepoisEl.textContent = opcoes.sugestaoDepois != null ? opcoes.sugestaoDepois : padrao.depois;
    conteudoEl.textContent = '';
    if (opcoes.conteudo) conteudoEl.appendChild(opcoes.conteudo);
    conteudoEl.classList.toggle('oculto', !opcoes.conteudo);
    veu.querySelector('.modal--data').classList.toggle('modal--data-largo', !!opcoes.conteudo);
    /* padrão: o próximo dia de serviço (amanhã, virando às 08h); com data, a que veio */
    var dia = RosterWork.data.diaDeServico();
    dia.setDate(dia.getDate() + 1);
    input.value = opcoes.data ? RosterWork.data.isoParaBR(opcoes.data) : RosterWork.data.paraBR(dia);
    sugestaoDataEl.textContent = input.value;
    sugestaoEl.classList.toggle('oculto', !sugerida);
    btnOutra.classList.toggle('oculto', !sugerida);
    campoEl.classList.toggle('oculto', sugerida);
    aoConfirmar = opcoes.aoConfirmar || null;
    aoCancelar = opcoes.aoCancelar || null;
    focoAnterior = document.activeElement;
    veu.classList.add('modal-veu--aberto');
    RosterWork.focarJanela(veu, sugerida ? btnConfirmar : input, function () {
      if (!sugerida && input.select) input.select();
    });
  }

  window.RosterWork.pedirData = pedirData;
})();
