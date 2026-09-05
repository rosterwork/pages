/* ============================================================
   TECLADO — ativa por Enter/Espaço os elementos "clicáveis" que
   não são <button>/<a> nativos. Cards, linhas de lista e células
   de grade são <div> com clique (para não herdar o estilo do
   botão); marcados com role="button" + tabindex="0", eles ficam
   focáveis pelo teclado e esta ponte transforma Enter/Espaço em
   clique — assim o mesmo handler de clique serve mouse e teclado.
   (Botões/links nativos já fazem isso sozinhos e são ignorados.)
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('keydown', function (evento) {
    if (evento.key !== 'Enter' && evento.key !== ' ' && evento.key !== 'Spacebar') return;
    var alvo = evento.target;
    if (!alvo || alvo.getAttribute('role') !== 'button') return;
    var tag = alvo.tagName;
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    evento.preventDefault();   /* Espaço não rola a página; Enter não dispara ação nativa */
    alvo.click();
  });
})();
