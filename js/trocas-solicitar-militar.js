/* ============================================================
   TROCAS — o campo Militar (Solicitar, Registrar e Várias trocas)
   Combobox: no computador, digita para filtrar OU escolhe no menu
   (↑↓ andam pela lista, Enter escolhe, Esc fecha pelo
   geral-dropdown); no celular, só escolhe (o campo fica somente
   leitura e o toque não abre o teclado). Quem está ocupado aparece
   apagado no lugar dele, com o motivo; quem ainda não tem conta
   aparece marcado e pode ser escolhido.
   Completa RosterWork.trocasCampos com comboMilitar (carrega
   depois do trocas-solicitar-campos.js).
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  function C() { return RW.trocasCampos; }
  function txt(chave) { return RW.mensagens.trocas[chave]; }

  /* O estado mostrado fica no próprio input: value = o militar escolhido; placeholder = os estados
     ("Escolha o dia antes", "Selecione", "Carregando…"). Quem guarda a escolha é o formulário:
     opcoes = { atual(), aoEscolher(mil), aoPerder(), ignorar() → [cpf] } */
  function comboMilitar(inp, menu, opcoes) {
    if (!inp || !menu) return null;
    var dropdown = inp.closest('.dropdown');
    var realce = null;   // a opção realçada pelas setas

    function definir(texto, vazio) { if (vazio) { inp.value = ''; inp.placeholder = texto || ''; } else { inp.value = texto || ''; } }
    function habilitar(ligado) { inp.disabled = !ligado; }
    function mostrarAtual() { var m = opcoes.atual(); if (m) definir(C().nomeMil(m), false); else definir(txt('modalSelecione'), true); }
    /* no celular o campo só escolhe: somente leitura, então o toque não abre o teclado */
    function ajustarAoAparelho() { inp.readOnly = !!(RW.celular && RW.celular()); }
    function aberto() { return !!dropdown && dropdown.classList.contains('dropdown--aberto'); }
    function abrir() { if (dropdown && !aberto() && RW.abrirDropdown) RW.abrirDropdown(dropdown); }
    function escolhiveis() { return Array.prototype.slice.call(menu.querySelectorAll('.dropdown-item:not(.dropdown-item--inativo):not(.oculto)')); }
    function realcar(item) {
      if (realce) realce.classList.remove('dropdown-item--realce');
      realce = item || null;
      if (!realce) { inp.removeAttribute('aria-activedescendant'); return; }
      realce.classList.add('dropdown-item--realce');
      inp.setAttribute('aria-activedescendant', realce.id);
      realce.scrollIntoView({ block: 'nearest' });
    }
    /* ↑↓: a primeira seta abre a lista; pula os apagados e para nas pontas */
    function andar(passo) {
      abrir();
      var lista = escolhiveis();
      if (!lista.length) return;
      var i = lista.indexOf(realce);
      i = i < 0 ? (passo > 0 ? 0 : lista.length - 1) : Math.min(lista.length - 1, Math.max(0, i + passo));
      realcar(lista[i]);
    }
    function filtrar() {
      var termo = RosterWork.busca.normalizar(inp.value.trim());
      var visiveis = 0;
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) {
        var casa = !termo || (it.getAttribute('data-busca') || '').indexOf(termo) !== -1;
        it.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      var vazio = menu.querySelector('.troca-parceiro-vazio');   /* aviso quando o filtro não casa com ninguém */
      if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
      realcar(null);
    }
    function mostrarTodos() {
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) { it.classList.remove('oculto'); });
      var vazio = menu.querySelector('.troca-parceiro-vazio');
      if (vazio) vazio.classList.add('oculto');
      realcar(null);
    }
    function escolher(mil) {
      definir(C().nomeMil(mil), false);
      C().limparErro(inp);
      mostrarTodos();   /* o filtro digitado não fica para a próxima vez que a lista abrir */
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      opcoes.aoEscolher(mil);
    }

    /* liga o input UMA vez por elemento (a marca fica no elemento) */
    if (!inp.dataset.ligado) {
      inp.dataset.ligado = '1';
      /* 1º clique seleciona tudo, então digitar substitui o nome (em vez de acrescentar) */
      inp.addEventListener('mousedown', function (e) {
        ajustarAoAparelho();
        if (!inp.disabled && document.activeElement !== inp) { e.preventDefault(); inp.focus(); }
      });
      inp.addEventListener('focus', function () { mostrarTodos(); if (!inp.readOnly) inp.select(); });
      inp.addEventListener('input', function () { filtrar(); abrir(); });
      inp.addEventListener('blur', function () { realcar(null); mostrarAtual(); });   /* saiu sem escolher: volta ao escolhido (ou ao placeholder) */
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); andar(e.key === 'ArrowDown' ? 1 : -1); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();   /* Enter escolhe a realçada; sem realce, a 1ª visível */
        var alvo = realce && !realce.classList.contains('oculto') ? realce : escolhiveis()[0];
        if (alvo) alvo.click();
      });
    }
    ajustarAoAparelho();

    /* monta a lista; devolve quantos podem ser escolhidos. A escolha que sumiu da lista é desfeita (aoPerder) */
    function preencher(lista) {
      realcar(null);
      menu.textContent = '';
      var ignorar = opcoes.ignorar ? opcoes.ignorar() : [];
      var atual = opcoes.atual();
      var disponiveis = 0, aindaEscolhido = false;
      lista.forEach(function (mil, indice) {
        if (!mil || ignorar.indexOf(mil.cpf) >= 0) return;
        var nome = C().nomeMil(mil), item;
        if (mil.ocupado) {
          item = document.getElementById('tpl-troca-parceiro-ocupado').content.cloneNode(true).firstElementChild;
          item.querySelector('.troca-parceiro-nome').textContent = nome;
          /* afastado (férias/licença/dispensa) diz o motivo; senão, já está de serviço no horário */
          item.querySelector('.troca-parceiro-motivo').textContent =
            (mil.afastamento && txt('parceiroAfastado')[mil.afastamento]) || txt('parceiroOcupado');
        } else {
          if (mil.tem_conta === false) {
            item = document.getElementById('tpl-troca-militar-sem-conta').content.cloneNode(true).firstElementChild;
            item.querySelector('.troca-parceiro-nome').textContent = nome;
          } else {
            item = document.getElementById('tpl-troca-opcao').content.cloneNode(true).firstElementChild;
            item.setAttribute('role', 'option');   /* o molde é o mesmo das listas de Unidade, que não são listbox */
            item.textContent = nome;
          }
          item.addEventListener('click', function () { escolher(mil); });
          disponiveis++;
          if (atual && atual.cpf === mil.cpf) { aindaEscolhido = true; item.setAttribute('aria-selected', 'true'); }
        }
        item.id = inp.id + '-opcao-' + indice;   /* o leitor de tela acompanha a realçada (aria-activedescendant) */
        item.setAttribute('data-busca', RosterWork.busca.normalizar(nome));
        menu.appendChild(item);
      });
      var tplVazio = document.getElementById('tpl-troca-parceiro-vazio');   /* aviso do filtro, oculto até zerar */
      if (tplVazio) { var vm = tplVazio.content.cloneNode(true).firstElementChild; vm.textContent = txt('modalFiltroVazio'); vm.classList.add('oculto'); menu.appendChild(vm); }
      if (atual && !aindaEscolhido && opcoes.aoPerder) opcoes.aoPerder();
      if (disponiveis === 0) { habilitar(false); definir(txt('modalParceiroVazio'), true); }
      else { habilitar(true); mostrarAtual(); }
      return disponiveis;
    }

    return {
      preencher: preencher, definir: definir, habilitar: habilitar, mostrarAtual: mostrarAtual,
      esvaziar: function () { realcar(null); menu.textContent = ''; }
    };
  }

  RW.trocasCampos = RW.trocasCampos || {};
  RW.trocasCampos.comboMilitar = comboMilitar;
})();
