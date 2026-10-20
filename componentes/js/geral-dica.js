(function () {
  'use strict';

  var espacoMinimoAcima = 40;
  var espacoMinimoDireita = 120;

  /* escolhe o lado da dica pelo espaço que há na janela */
  function posicionar(elemento) {
    var rect = elemento.getBoundingClientRect();
    elemento.classList.toggle('dica--baixo', rect.top < espacoMinimoAcima);
    elemento.classList.toggle('dica--esquerda', window.innerWidth - rect.right < espacoMinimoDireita);
  }

  document.addEventListener('mouseover', function (e) {
    var elemento = e.target.closest('[data-dica]');
    if (!elemento) return;
    posicionar(elemento);
  });

  document.addEventListener('mouseout', function (e) {
    var elemento = e.target.closest('[data-dica]');
    if (!elemento) return;
    elemento.classList.remove('dica--baixo', 'dica--esquerda');
  });

  /* ---------- no toque (celular, marca data-celular no <html>) ----------
     Pressionar e segurar mostra a dica (classe .dica--toque), que some pouco depois de
     soltar; aí o botão não é acionado ao soltar. Toque rápido aciona o botão como sempre.
     O tempo de segurar é o mesmo atraso da dica no mouse (--dica-atraso, geral-dica.css) */
  var TEMPO_VISIVEL = 1500;   /* quanto a dica fica à vista depois de soltar (ms) */
  var esperaToque = null;
  var esperaSumir = null;
  var comDica = null;
  var segurarClique = false;

  /* celular = a marca no <html> e a tela até 767px (o mesmo corte do bloco do celular nos CSS) */
  var telaCelular = window.matchMedia ? window.matchMedia('(max-width: 767px)') : null;
  function celular() {
    return document.documentElement.hasAttribute('data-celular') && !!telaCelular && telaCelular.matches;
  }

  /* --dica-atraso em milissegundos (aceita "500ms" ou "0.5s") */
  function atrasoDica(elemento) {
    var texto = getComputedStyle(elemento).getPropertyValue('--dica-atraso').trim();
    var numero = parseFloat(texto);
    if (isNaN(numero)) return 0;
    return /ms$/.test(texto) ? numero : numero * 1000;
  }

  function esconderDicaToque() {
    clearTimeout(esperaSumir);
    esperaSumir = null;
    if (comDica) comDica.classList.remove('dica--toque');
    comDica = null;
    segurarClique = false;
  }

  function pararEspera() {
    clearTimeout(esperaToque);
    esperaToque = null;
  }

  document.addEventListener('pointerdown', function (e) {
    if (!celular()) return;
    pararEspera();
    esconderDicaToque();
    if (e.pointerType !== 'touch') return;
    var elemento = e.target.closest('[data-dica]');
    if (!elemento || !elemento.getAttribute('data-dica')) return;
    esperaToque = setTimeout(function () {
      esperaToque = null;
      posicionar(elemento);
      elemento.classList.add('dica--toque');
      comDica = elemento;
      segurarClique = true;
    }, atrasoDica(elemento));
  });

  /* soltou o dedo, ou o navegador assumiu o gesto (rolagem): para a espera; a dica à vista some depois */
  function aoSoltar(e) {
    if (e.pointerType !== 'touch') return;
    pararEspera();
    if (!comDica) return;
    clearTimeout(esperaSumir);
    esperaSumir = setTimeout(esconderDicaToque, TEMPO_VISIVEL);
  }
  document.addEventListener('pointerup', aoSoltar);
  document.addEventListener('pointercancel', aoSoltar);

  /* o clique que vem ao soltar depois de segurar não aciona o botão */
  document.addEventListener('click', function (e) {
    if (!segurarClique) return;
    segurarClique = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  /* segurar sobre um elemento com dica não abre o menu do navegador */
  document.addEventListener('contextmenu', function (e) {
    if (celular() && e.target.closest && e.target.closest('[data-dica]')) e.preventDefault();
  });

})();
