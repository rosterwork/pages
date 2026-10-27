/* ============================================================
   COMPONENTE — o campo de militar (combobox): digitar e escolher
   No computador, digita para filtrar OU escolhe no menu (↑↓ andam
   pela lista, Enter escolhe, Esc fecha pelo geral-dropdown); no
   celular, só escolhe (o campo fica somente leitura e o toque não
   abre o teclado). A lista pode ter títulos de grupo (some o título
   do grupo que o filtro esvaziou); quem não pode ser escolhido fica
   apagado no lugar dele, com o motivo. Usado nas Trocas (que
   desenham os itens delas) e no painel do dia da Escala (o molde
   daqui: o nome e, à direita, o que ele faz hoje ou o motivo).
   O campo é o .dropdown.campo-combo com o input e o .dropdown-menu.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* o item do molde geral: { cpf, grad, nome, info, inativo } */
  function itemPadrao(m) {
    var el = RW.tpl('tpl-combo-militar-item');
    if (!el) return null;
    el.querySelector('.combo-militar-grad').textContent = m.grad || '';
    el.querySelector('.combo-militar-guerra').textContent = m.nome || '';
    el.querySelector('.combo-militar-info').textContent = m.info || '';
    if (m.inativo) { el.classList.add('dropdown-item--inativo'); el.setAttribute('aria-disabled', 'true'); }
    return el;
  }
  function nomePadrao(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* O estado mostrado fica no próprio input: value = o militar escolhido; placeholder = os estados.
     opcoes = { atual(), aoEscolher(item), aoPerder(), ignorar() -> [cpf], nome(item), criarItem(item),
     escolhivel(item), criarVazio(), limparErro(inp), textos: { selecione, semNinguem, filtroVazio } }.
     Na lista, { titulo } é o título de um grupo */
  function criar(inp, menu, opcoes) {
    if (!inp || !menu) return null;
    var dropdown = inp.closest('.dropdown');
    var realce = null;   // a opção realçada pelas setas
    var textos = opcoes.textos || {};
    var nome = opcoes.nome || nomePadrao;
    var criarItem = opcoes.criarItem || itemPadrao;
    var escolhivel = opcoes.escolhivel || function (m) { return !m.inativo; };

    function definir(texto, vazio) { if (vazio) { inp.value = ''; inp.placeholder = texto || ''; } else { inp.value = texto || ''; } }
    function habilitar(ligado) { inp.disabled = !ligado; }
    function mostrarAtual() { var m = opcoes.atual(); if (m) definir(nome(m), false); else definir(textos.selecione, true); }
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
    /* o título some quando o filtro esvazia o grupo dele */
    function ajustarTitulos() {
      var titulo = null, visiveis = 0;
      Array.prototype.forEach.call(menu.children, function (el) {
        if (el.hasAttribute('data-combo-titulo')) {
          if (titulo) titulo.classList.toggle('oculto', !visiveis);
          titulo = el; visiveis = 0;
        } else if (el.hasAttribute('data-busca') && !el.classList.contains('oculto')) {
          visiveis++;
        }
      });
      if (titulo) titulo.classList.toggle('oculto', !visiveis);
    }
    function filtrar() {
      var termo = RW.busca.normalizar(inp.value.trim());
      var visiveis = 0;
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) {
        var casa = !termo || (it.getAttribute('data-busca') || '').indexOf(termo) !== -1;
        it.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      var vazio = menu.querySelector('[data-combo-vazio]');   /* aviso quando o filtro não casa com ninguém */
      if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
      ajustarTitulos();
      realcar(null);
    }
    function mostrarTodos() {
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca], [data-combo-titulo]'), function (it) { it.classList.remove('oculto'); });
      var vazio = menu.querySelector('[data-combo-vazio]');
      if (vazio) vazio.classList.add('oculto');
      realcar(null);
    }
    function escolher(m) {
      definir(nome(m), false);
      if (opcoes.limparErro) opcoes.limparErro(inp);
      mostrarTodos();   /* o filtro digitado não fica para a próxima vez que a lista abrir */
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      opcoes.aoEscolher(m);
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
      lista.forEach(function (m, indice) {
        if (!m) return;
        if (m.titulo) {
          var t = RW.tpl('tpl-combo-militar-titulo');
          if (t) { t.textContent = m.titulo; t.setAttribute('data-combo-titulo', ''); menu.appendChild(t); }
          return;
        }
        if (ignorar.indexOf(m.cpf) >= 0) return;
        var item = criarItem(m);
        if (!item) return;
        if (escolhivel(m)) {
          item.addEventListener('click', function () { escolher(m); });
          disponiveis++;
          if (atual && atual.cpf === m.cpf) { aindaEscolhido = true; item.setAttribute('aria-selected', 'true'); }
        }
        item.id = inp.id + '-opcao-' + indice;   /* o leitor de tela acompanha a realçada (aria-activedescendant) */
        item.setAttribute('data-busca', RW.busca.normalizar(nome(m)));
        menu.appendChild(item);
      });
      var vm = opcoes.criarVazio ? opcoes.criarVazio() : RW.tpl('tpl-combo-militar-vazio');   /* aviso do filtro, oculto até zerar */
      if (vm) { vm.textContent = textos.filtroVazio || ''; vm.setAttribute('data-combo-vazio', ''); vm.classList.add('oculto'); menu.appendChild(vm); }
      ajustarTitulos();
      if (atual && !aindaEscolhido && opcoes.aoPerder) opcoes.aoPerder();
      if (disponiveis === 0) { habilitar(false); definir(textos.semNinguem, true); }
      else { habilitar(true); mostrarAtual(); }
      return disponiveis;
    }

    return {
      preencher: preencher, definir: definir, habilitar: habilitar, mostrarAtual: mostrarAtual, abrir: abrir,
      esvaziar: function () { realcar(null); menu.textContent = ''; }
    };
  }

  RW.comboMilitar = { criar: criar };
})();
