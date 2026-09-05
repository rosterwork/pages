/* ============================================================
   LIMPAR COMENTÁRIOS — tira os nós de comentário HTML do DOM.
   Os comentários continuam no código-fonte (navegação para o
   programador), mas não aparecem no Elements do navegador.
   Roda no documento ao carregar (index.html) e o roteador do SPA
   chama em cada fragmento de página antes de inserir. O app é
   vanilla e não usa nós de comentário como âncora, então remover
   todos é seguro. Remoção por nó (mais robusta que regex).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* remove todos os nós de comentário sob 'raiz' (elemento ou fragmento) */
  function limparComentarios(raiz) {
    if (!raiz) return;
    var it = document.createNodeIterator(raiz, NodeFilter.SHOW_COMMENT, null);
    var mortos = [], n;
    while ((n = it.nextNode())) mortos.push(n);
    for (var i = 0; i < mortos.length; i++) {
      if (mortos[i].parentNode) mortos[i].parentNode.removeChild(mortos[i]);
    }
  }

  window.RosterWork.limparComentarios = limparComentarios;

  /* ao carregar a página: limpa os comentários já presentes no documento */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { limparComentarios(document.documentElement); });
  } else {
    limparComentarios(document.documentElement);
  }
})();
