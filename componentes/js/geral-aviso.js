/* ============================================================
   AVISO — modal de aviso e confirmação (compartilhado)
   RosterWork.avisar({ tipo, mensagem, textoOk, aoConfirmar })  -> 1 botão (OK)
   RosterWork.confirmar({ tipo, mensagem, textoConfirmar, textoCancelar,
                          aoConfirmar, aoCancelar })             -> 2 botões
   tipo: 'sucesso' | 'aviso' | 'erro'. Aparece sobre qualquer modal e
   só fecha pelos botões (nunca por clique fora nem Esc). O elemento
   #veu-aviso é fixo no shell; aqui só preenchemos e mostramos/escondemos.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var veu, caixa, mensagemEl, iconeSucesso, iconeAlerta, btnConfirmar, btnCancelar;
  var aoConfirmar = null;
  var aoCancelar = null;
  var focoAnterior = null;   /* quem tinha o foco antes do aviso (para devolver) */

  function preparar() {
    if (veu) return true;
    veu = document.getElementById('veu-aviso');
    if (!veu) return false;
    caixa = veu.querySelector('.modal--aviso');
    mensagemEl = veu.querySelector('.aviso-mensagem');
    iconeSucesso = veu.querySelector('.aviso-icone--sucesso');
    iconeAlerta = veu.querySelector('.aviso-icone--alerta');
    btnConfirmar = veu.querySelector('.aviso-confirmar');
    btnCancelar = veu.querySelector('.aviso-cancelar');
    btnConfirmar.addEventListener('click', function () {
      var fn = aoConfirmar;
      fechar();
      if (fn) fn();
    });
    btnCancelar.addEventListener('click', function () {
      var fn = aoCancelar;
      fechar();
      if (fn) fn();
    });
    return true;
  }

  function fechar() {
    if (veu) veu.classList.remove('modal-veu--aberto');
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
    focoAnterior = null;
  }

  function mostrar(opcoes) {
    if (!preparar()) return;
    var tipo = opcoes.tipo || 'aviso';
    caixa.classList.remove('aviso--sucesso', 'aviso--aviso', 'aviso--erro');
    caixa.classList.add('aviso--' + tipo);

    /* sucesso usa a curtida; aviso e erro usam o triângulo */
    iconeSucesso.classList.toggle('oculto', tipo !== 'sucesso');
    iconeAlerta.classList.toggle('oculto', tipo === 'sucesso');

    mensagemEl.textContent = opcoes.mensagem || '';
    btnConfirmar.textContent = opcoes.textoConfirmar || 'OK';
    /* botão de confirmação em vermelho para ações destrutivas (ex.: excluir do sistema) */
    btnConfirmar.classList.toggle('botao--perigo', !!opcoes.confirmarPerigo);
    btnConfirmar.classList.toggle('botao--primario', !opcoes.confirmarPerigo);
    if (opcoes.textoCancelar) {
      btnCancelar.textContent = opcoes.textoCancelar;
      btnCancelar.classList.remove('oculto');
    } else {
      btnCancelar.classList.add('oculto');
    }

    aoConfirmar = opcoes.aoConfirmar || null;
    aoCancelar = opcoes.aoCancelar || null;

    focoAnterior = document.activeElement;
    veu.classList.add('modal-veu--aberto');
    btnConfirmar.focus();
  }

  function avisar(opcoes) {
    opcoes = opcoes || {};
    mostrar({
      tipo: opcoes.tipo || 'aviso',
      mensagem: opcoes.mensagem,
      textoConfirmar: opcoes.textoOk || 'OK',
      aoConfirmar: opcoes.aoConfirmar
    });
  }

  function confirmar(opcoes) {
    opcoes = opcoes || {};
    mostrar({
      tipo: opcoes.tipo || 'aviso',
      mensagem: opcoes.mensagem,
      textoConfirmar: opcoes.textoConfirmar || 'Confirmar',
      textoCancelar: opcoes.textoCancelar || 'Cancelar',
      confirmarPerigo: opcoes.confirmarPerigo,
      aoConfirmar: opcoes.aoConfirmar,
      aoCancelar: opcoes.aoCancelar
    });
  }

  window.RosterWork.avisar = avisar;
  window.RosterWork.confirmar = confirmar;
})();
