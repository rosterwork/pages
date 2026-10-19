/* ============================================================
   ALTERAÇÕES — o rodapé retrátil com o que foi mudado
   (quem, quando e o resumo no formato do modal de resumo).
   Usado nas Alterações manuais do dia (Escala) e nas Alterações
   na ficha (Usuários). Sempre começa fechado; abre e fecha pelo
   chevron. O molde do bloco (com o título) é de cada tela; o de
   cada alteração (#tpl-alteracao) fica no shell.
   Expõe RosterWork.alteracoes.montar(idMolde, lista).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function aplicarRetratil(toggle, conteudo, aberto) {
    toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    conteudo.classList.toggle('oculto', !aberto);
  }

  /* devolve o bloco pronto para o rodapé (ou null, sem alterações): o título com a
     quantidade e, aberto, cada alteração com o autor, o quando e o resumo */
  function montar(idMolde, lista) {
    if (!lista || !lista.length) return null;
    var bloco = RosterWork.tpl(idMolde);
    if (!bloco) return null;
    bloco.querySelector('.alteracoes-qtd').textContent = '(' + lista.length + ')';
    var conteudo = bloco.querySelector('.alteracoes-lista');
    lista.forEach(function (alt) {
      var item = RosterWork.tpl('tpl-alteracao');
      if (!item) return;
      item.querySelector('.alteracao-autor').textContent = alt.autor || '';
      var quando = item.querySelector('.alteracao-quando');
      if (RosterWork.resumo && RosterWork.resumo.formatarQuando) quando.textContent = RosterWork.resumo.formatarQuando(alt.criado_em);
      if (RosterWork.resumo && RosterWork.resumo.desenhar) {
        var no = RosterWork.resumo.desenhar(alt.resumo, { mostrarQuando: false });
        if (no) item.querySelector('.alteracao-resumo').appendChild(no);
      }
      conteudo.appendChild(item);
    });
    var toggle = bloco.querySelector('.alteracoes-toggle');
    aplicarRetratil(toggle, conteudo, false);
    toggle.addEventListener('click', function () {
      aplicarRetratil(toggle, conteudo, toggle.getAttribute('aria-expanded') !== 'true');
    });
    return bloco;
  }

  window.RosterWork.alteracoes = { montar: montar };
})();
