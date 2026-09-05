(function () {
  'use strict';

  /* ---------- BLOQUEIO DE CLIQUE (enquanto a ação está no ar) ----------
     Camada transparente sobre a tela: o botão da ação já desabilita, mas o resto
     da página continuaria clicável e o usuário poderia disparar outra coisa por
     engano no meio de uma gravação. Contador porque pode haver ações simultâneas. */
  var acoesNoAr = 0;

  function bloqueio() { return document.getElementById('carregando-bloqueio'); }

  function bloquearTela() {
    acoesNoAr++;
    var el = bloqueio();
    if (el) el.classList.remove('oculto');
  }

  function liberarTela() {
    acoesNoAr = Math.max(0, acoesNoAr - 1);
    if (acoesNoAr > 0) return;
    var el = bloqueio();
    if (el) el.classList.add('oculto');
  }

  /* ---------- PONTOS (dentro de botões e linhas de texto) ---------- */
  function iniciarCarregando(elemento) {
    var template = document.getElementById('carregando-pontos');
    if (!template) return;
    /* trava a largura/altura atuais: os pontinhos são menores que o rótulo e, sem isto,
       o botão encolhe no meio da ação (a custom property é o canal permitido) */
    elemento.style.setProperty('--carregando-largura', elemento.offsetWidth + 'px');
    elemento.style.setProperty('--carregando-altura', elemento.offsetHeight + 'px');
    elemento.classList.add('carregando-travado');
    elemento.dataset.textoOriginal = elemento.textContent;
    elemento.textContent = '';
    elemento.appendChild(template.content.cloneNode(true));
    elemento.disabled = true;
    bloquearTela();
  }

  function pararCarregando(elemento) {
    elemento.textContent = elemento.dataset.textoOriginal || '';
    delete elemento.dataset.textoOriginal;
    elemento.classList.remove('carregando-travado');
    elemento.style.removeProperty('--carregando-largura');
    elemento.style.removeProperty('--carregando-altura');
    elemento.disabled = false;
    liberarTela();
  }

  /* ---------- VÉU (spinner .giratorio cobrindo um container) ----------
     O véu é fixo dentro do container (escrito no HTML), começando visível. Aqui só
     ligamos/desligamos a classe `--visivel`; o mínimo evita que ele pisque. */
  var MINIMO_VEU = 600;
  var veuMostradoEm = Date.now();   /* o véu já nasce visível no shell (carga inicial) */
  var timerEsconder = 0;

  function veuDe(container) {
    return container ? container.querySelector('.carregando-veu') : null;
  }

  function mostrarVeu(container) {
    var veu = veuDe(container);
    if (!veu) return;
    clearTimeout(timerEsconder);
    veu.classList.add('carregando-veu--visivel');
    veuMostradoEm = Date.now();
  }

  function esconderVeu(container) {
    var veu = veuDe(container);
    if (!veu) return;
    clearTimeout(timerEsconder);
    var restante = Math.max(0, MINIMO_VEU - (Date.now() - veuMostradoEm));
    timerEsconder = setTimeout(function () {
      veu.classList.remove('carregando-veu--visivel');
    }, restante);
  }

  /* ---------- VÉU GLOBAL (círculo sobre o conteúdo + tela travada) ----------
     Padrão dos "Salvar" que disparam recálculo da escala (leva alguns segundos):
     cobre o conteúdo principal com o giratório e bloqueia o clique da tela toda. */
  function mostrarVeuGlobal() {
    var alvo = document.querySelector('.conteudo');
    if (alvo) mostrarVeu(alvo);
    bloquearTela();
  }
  function esconderVeuGlobal() {
    var alvo = document.querySelector('.conteudo');
    if (alvo) esconderVeu(alvo);
    liberarTela();
    /* completa em segundo plano os dias distantes do recálculo (fila em blocos),
       para que nenhuma requisição carregue a escala inteira. A pendência garante
       que, ao abrir a Escala, ela espere o esvaziar antes de mostrar (dado fresco). */
    if (window.RosterWork.marcarRecalculoPendente) window.RosterWork.marcarRecalculoPendente();
    if (window.RosterWork.drenarRecalculo) window.RosterWork.drenarRecalculo();
  }

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.iniciarCarregando = iniciarCarregando;
  window.RosterWork.pararCarregando = pararCarregando;
  /* bloqueio de tela avulso (para ações que mostram o véu numa área, sem botão de pontos) */
  window.RosterWork.bloquearTela = bloquearTela;
  window.RosterWork.liberarTela = liberarTela;
  window.RosterWork.mostrarVeu = mostrarVeu;
  window.RosterWork.esconderVeu = esconderVeu;
  window.RosterWork.mostrarVeuGlobal = mostrarVeuGlobal;
  window.RosterWork.esconderVeuGlobal = esconderVeuGlobal;
})();
