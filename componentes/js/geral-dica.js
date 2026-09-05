(function () {
  'use strict';

  var espacoMinimoAcima = 40;
  var espacoMinimoDireita = 120;

  document.addEventListener('mouseover', function (e) {
    var elemento = e.target.closest('[data-dica]');
    if (!elemento) return;

    var rect = elemento.getBoundingClientRect();
    elemento.classList.toggle('dica--baixo', rect.top < espacoMinimoAcima);
    elemento.classList.toggle('dica--esquerda', window.innerWidth - rect.right < espacoMinimoDireita);
  });

  document.addEventListener('mouseout', function (e) {
    var elemento = e.target.closest('[data-dica]');
    if (!elemento) return;
    elemento.classList.remove('dica--baixo', 'dica--esquerda');
  });

})();
