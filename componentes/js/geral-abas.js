(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Acessibilidade: aplica a semântica de aba uma vez por trilho (só single-select;
     o multi é botão de alternância, não um tablist). O leitor passa a anunciar
     "aba, selecionada". Idempotente (marca no próprio elemento, que é recriado a
     cada navegação no SPA). */
  function prepararAria(trilho) {
    if (trilho.hasAttribute('data-abas-multi') || trilho.dataset.ariaPronto) return;
    trilho.dataset.ariaPronto = '1';
    trilho.setAttribute('role', 'tablist');
    var abas = trilho.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      abas[i].setAttribute('role', 'tab');
      abas[i].setAttribute('aria-selected', abas[i].classList.contains('aba--ativa') ? 'true' : 'false');
    }
  }

  /* seleção única: marca como ativa só a aba clicada, dentro do trilho */
  function ativarUnica(trilho, aba) {
    var abas = trilho.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      var ativa = abas[i] === aba;
      abas[i].classList.toggle('aba--ativa', ativa);
      abas[i].setAttribute('aria-selected', ativa ? 'true' : 'false');
    }
  }

  /* multi-seleção: alterna a aba, mas nunca deixa o trilho sem nenhuma ativa */
  function alternarMulti(trilho, aba) {
    if (aba.classList.contains('aba--ativa')) {
      if (trilho.querySelectorAll('.aba--ativa').length > 1) aba.classList.remove('aba--ativa');
    } else {
      aba.classList.add('aba--ativa');
    }
  }

  /* um único ouvinte para as abas de todo o site (delegação no documento) —
     funciona inclusive nos fragmentos de página carregados depois */
  document.addEventListener('click', function (evento) {
    var aba = evento.target.closest('.aba');
    if (!aba) return;
    var trilho = aba.closest('.abas');
    if (!trilho) return;
    prepararAria(trilho);
    if (trilho.hasAttribute('data-abas-multi')) {
      alternarMulti(trilho, aba);
    } else {
      ativarUnica(trilho, aba);
    }
    /* avisa quem quiser reagir (carregar o conteúdo da aba escolhida) */
    trilho.dispatchEvent(new CustomEvent('rosterwork:aba', { detail: { aba: aba } }));
  });

  /* açúcar para a página reagir à troca: aoTrocar(abaAtiva) roda quando a aba muda */
  function ligar(trilho, aoTrocar) {
    if (!trilho || !aoTrocar) return;
    prepararAria(trilho);
    trilho.addEventListener('rosterwork:aba', function (evento) { aoTrocar(evento.detail.aba); });
  }

  window.RosterWork.abas = { ligar: ligar };
})();
