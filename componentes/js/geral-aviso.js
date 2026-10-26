/* ============================================================
   AVISO — modal de aviso e confirmação (compartilhado)
   RosterWork.avisar({ tipo, mensagem, textoOk, aoConfirmar })  -> 1 botão (OK)
   RosterWork.confirmar({ tipo, mensagem, textoConfirmar, textoCancelar,
                          aoConfirmar, aoCancelar })             -> 2 botões
   + textoAlternativo/aoAlternativo (opcional)                   -> 3 botões
     (o do meio é a outra forma de confirmar, ex.: "Não contabilizar")
   + itens: [{ titulo, texto }] e nota (opcionais, no confirmar)  -> lista
     embaixo da mensagem e nota no fim; com lista, o ícone vai para o alto
   + semIcone (opcional, no confirmar)                            -> sem o
     ícone (ex.: o termo de responsabilidade, que é leitura, não alerta)
   tipo: 'sucesso' | 'aviso' | 'erro'. Aparece sobre qualquer modal e
   só fecha pelos botões (nunca por clique fora nem Esc). O elemento
   #veu-aviso é fixo no shell; aqui só preenchemos e mostramos/escondemos.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var veu, caixa, corpoEl, mensagemEl, listaEl, notaEl, iconeSucesso, iconeAlerta, btnConfirmar, btnCancelar, btnAlternativo;
  var aoConfirmar = null;
  var aoCancelar = null;
  var aoAlternativo = null;
  var focoAnterior = null;   /* quem tinha o foco antes do aviso (para devolver) */

  function preparar() {
    if (veu) return true;
    veu = document.getElementById('veu-aviso');
    if (!veu) return false;
    caixa = veu.querySelector('.modal--aviso');
    corpoEl = veu.querySelector('.aviso-corpo');
    mensagemEl = veu.querySelector('.aviso-mensagem');
    listaEl = veu.querySelector('.aviso-lista');
    notaEl = veu.querySelector('.aviso-nota');
    iconeSucesso = veu.querySelector('.aviso-icone--sucesso');
    iconeAlerta = veu.querySelector('.aviso-icone--alerta');
    btnConfirmar = veu.querySelector('.aviso-confirmar');
    btnCancelar = veu.querySelector('.aviso-cancelar');
    btnAlternativo = veu.querySelector('.aviso-alternativo');
    btnAlternativo.addEventListener('click', function () {
      var fn = aoAlternativo;
      fechar();
      if (fn) fn();
    });
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

  /* a lista (título curto + texto, um item por linha) e a nota do fim */
  function preencherLista(itens, nota) {
    listaEl.textContent = '';
    itens.forEach(function (it) {
      var li = RosterWork.tpl('tpl-aviso-lista-item');
      if (!li) return;
      li.querySelector('.aviso-lista-titulo').textContent = it.titulo || '';
      li.querySelector('.aviso-lista-texto').textContent = it.texto || '';
      listaEl.appendChild(li);
    });
    listaEl.classList.toggle('oculto', !itens.length);
    corpoEl.classList.toggle('aviso-corpo--lista', itens.length > 0);
    notaEl.textContent = nota;
    notaEl.classList.toggle('oculto', !nota);
  }

  function mostrar(opcoes) {
    if (!preparar()) return;
    var tipo = opcoes.tipo || 'aviso';
    caixa.classList.remove('aviso--sucesso', 'aviso--aviso', 'aviso--erro');
    caixa.classList.add('aviso--' + tipo);

    /* sucesso usa a curtida; aviso e erro usam o triângulo; semIcone, nenhum */
    iconeSucesso.classList.toggle('oculto', !!opcoes.semIcone || tipo !== 'sucesso');
    iconeAlerta.classList.toggle('oculto', !!opcoes.semIcone || tipo === 'sucesso');

    mensagemEl.textContent = opcoes.mensagem || '';
    preencherLista(opcoes.itens || [], opcoes.nota || '');
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
    if (opcoes.textoAlternativo) {
      btnAlternativo.textContent = opcoes.textoAlternativo;
      btnAlternativo.classList.remove('oculto');
    } else {
      btnAlternativo.classList.add('oculto');
    }

    aoConfirmar = opcoes.aoConfirmar || null;
    aoCancelar = opcoes.aoCancelar || null;
    aoAlternativo = opcoes.aoAlternativo || null;

    focoAnterior = document.activeElement;
    veu.classList.add('modal-veu--aberto');
    if (RosterWork.focarJanela) RosterWork.focarJanela(veu, btnConfirmar); else btnConfirmar.focus();
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
      textoAlternativo: opcoes.textoAlternativo,
      confirmarPerigo: opcoes.confirmarPerigo,
      aoConfirmar: opcoes.aoConfirmar,
      aoCancelar: opcoes.aoCancelar,
      aoAlternativo: opcoes.aoAlternativo,
      itens: opcoes.itens,
      nota: opcoes.nota,
      semIcone: opcoes.semIcone
    });
  }

  window.RosterWork.avisar = avisar;
  window.RosterWork.confirmar = confirmar;
})();
