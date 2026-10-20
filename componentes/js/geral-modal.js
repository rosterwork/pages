/* ============================================================
   MODAL — comportamento compartilhado entre páginas
   Abre/fecha qualquer ".modal-veu" via RosterWork.abrirModal /
   fecharModais (as páginas chamam quando querem). NÃO fecha por
   clique fora nem por Esc (decisão de projeto: o fechamento é
   sempre intencional). Cuida da acessibilidade por teclado: ao
   abrir, leva o foco para dentro do modal; prende o Tab no modal
   aberto (não escapa para o fundo); ao fechar, devolve o foco a
   quem o abriu. O JS só liga/desliga a classe — não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var focoAnterior = null;   /* quem tinha o foco antes de abrir (para devolver) */

  /* elementos que podem receber foco dentro do modal (visíveis e habilitados) */
  function focaveis(modal) {
    var lista = modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]');
    var resultado = [];
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
      if (el.disabled) continue;
      if (el.getAttribute('tabindex') === '-1') continue;
      if (el.offsetParent === null) continue;   /* oculto (display:none) */
      resultado.push(el);
    }
    return resultado;
  }

  /* o modal "do topo" é o último véu aberto no DOM (o aviso fica sobre os demais) */
  function modalDoTopo() {
    var abertos = document.querySelectorAll('.modal-veu--aberto');
    if (!abertos.length) return null;
    return abertos[abertos.length - 1].querySelector('.modal');
  }

  /* leva o foco para dentro da janela que acabou de abrir: o alvo pedido ou o primeiro elemento
     focável. O véu entra com transição de visibilidade (0.15s, geral-modal.css) e, até ela
     começar a valer, o navegador recusa o foco; por isso o foco espera. Não tira o foco de quem
     já entrou na janela nesse meio-tempo. depois(): o que fazer com o foco já dentro */
  var ESPERA_FOCO = 200;
  function focarJanela(veu, alvo, depois) {
    var modal = veu && veu.querySelector('.modal');
    if (!modal) return;
    setTimeout(function () {
      if (!veu.classList.contains('modal-veu--aberto') || modal.contains(document.activeElement)) return;
      var destino = (alvo && modal.contains(alvo)) ? alvo : focaveis(modal)[0];
      if (!destino) return;
      destino.focus();
      if (typeof depois === 'function') depois();
    }, ESPERA_FOCO);
  }

  /* abre o véu pelo id do elemento ".modal-veu" e leva o foco para dentro (alvo: opcional) */
  function abrir(idVeu, alvo) {
    var veu = document.getElementById(idVeu);
    if (!veu) return;
    focoAnterior = document.activeElement;
    veu.classList.add('modal-veu--aberto');
    focarJanela(veu, alvo);
  }

  /* fecha todos os modais abertos e devolve o foco para quem abriu */
  function fecharTodos() {
    var abertos = document.querySelectorAll('.modal-veu--aberto');
    for (var i = 0; i < abertos.length; i++) {
      abertos[i].classList.remove('modal-veu--aberto');
    }
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
    focoAnterior = null;
  }

  /* prende o Tab dentro do modal do topo (não deixa o foco escapar para o fundo) */
  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Tab') return;
    var modal = modalDoTopo();
    if (!modal) return;
    var alvos = focaveis(modal);
    if (!alvos.length) return;
    var primeiro = alvos[0];
    var ultimo = alvos[alvos.length - 1];
    var ativo = document.activeElement;
    if (evento.shiftKey) {
      if (ativo === primeiro || !modal.contains(ativo)) {
        ultimo.focus();
        evento.preventDefault();
      }
    } else {
      if (ativo === ultimo || !modal.contains(ativo)) {
        primeiro.focus();
        evento.preventDefault();
      }
    }
  });

  /* Enter → ação principal do modal do topo (como nos grandes sites). Dispara o botão
     `--primario` (nunca o perigoso/Desfazer). Ressalvas: em textarea o Enter é quebra de
     linha; se o foco já está num botão ou num link do modal, deixa o Enter nativo agir (evita
     disparo duplo; o link abre). Assim Resumo/Aviso/Data confirmam com Enter, com foco em
     qualquer lugar do modal. */
  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter') return;
    var modal = modalDoTopo();
    if (!modal) return;
    var ativo = document.activeElement;
    if (ativo && ativo.tagName === 'TEXTAREA') return;
    if (ativo && (ativo.tagName === 'BUTTON' || ativo.tagName === 'A') && modal.contains(ativo)) return;
    var principal = modal.querySelector('.botao--primario');
    if (principal && !principal.disabled && principal.offsetParent !== null) {
      evento.preventDefault();
      principal.click();
    }
  });

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.abrirModal = abrir;
  window.RosterWork.fecharModais = fecharTodos;
  window.RosterWork.focarJanela = focarJanela;   /* para as janelas que abrem o próprio véu (aviso, data) */
})();
