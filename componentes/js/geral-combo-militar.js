/* ============================================================
   COMPONENTE — o campo de militar (combobox): digitar e escolher
   No computador, digita para filtrar OU escolhe no menu (↑↓ andam
   pela lista, Enter escolhe, Esc fecha pelo geral-dropdown); no
   celular, só escolhe (o campo fica somente leitura e o toque não
   abre o teclado). A lista pode ter títulos de grupo, que abrem e
   fecham a lista deles (a seta e quantos tem, o desenho dos pelotões
   do painel da Extrajornada): o primeiro começa aberto e os outros
   fechados, ou como o item do título pedir ({ titulo, aberto });
   digitar abre os grupos de quem casa, e some o título do grupo que o
   filtro esvaziou. Quem não pode ser escolhido fica
   apagado no lugar dele, com o motivo. Usado nas Trocas (que
   desenham os itens delas) e no painel do dia da Escala (o molde
   daqui: o nome e, à direita, o que ele faz hoje ou o motivo; com
   o ícone de origem do serviço à esquerda, quando o item o traz,
   na lista e no campo já escolhido).
   O campo é o .dropdown.campo-combo com o input e o .dropdown-menu.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* o ícone de origem do serviço (icone = o nome do ícone; sem ele, o ícone some) */
  function definirIcone(svg, icone) {
    if (!svg) return;
    svg.classList.toggle('oculto', !icone);
    if (icone) svg.querySelector('use').setAttribute('href', 'icones/todos.svg#' + icone);
  }

  /* o item do molde geral: { cpf, grad, nome, info, inativo, icone, situacao } (situacao: a marca data-situacao, por onde o treino acha o exemplo) */
  function itemPadrao(m) {
    var el = RW.tpl('tpl-combo-militar-item');
    if (!el) return null;
    definirIcone(el.querySelector('.combo-militar-icone'), m.icone);
    el.querySelector('.combo-militar-grad').textContent = m.grad || '';
    el.querySelector('.combo-militar-guerra').textContent = m.nome || '';
    el.querySelector('.combo-militar-info').textContent = m.info || '';
    if (m.inativo) { el.classList.add('dropdown-item--inativo'); el.setAttribute('aria-disabled', 'true'); }
    if (m.situacao) el.setAttribute('data-situacao', m.situacao);
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

    /* o campo com o ícone de origem (.campo-combo-icone no molde): o do escolhido, à esquerda do nome */
    var icone = dropdown && dropdown.querySelector('.campo-combo-icone');
    function mostrarIcone(m) {
      if (!icone) return;
      var qual = m && m.icone;
      definirIcone(icone, qual);
      dropdown.classList.toggle('campo-combo--com-icone', !!qual);
    }
    function definir(texto, vazio) {
      if (vazio) { inp.value = ''; inp.placeholder = texto || ''; mostrarIcone(null); } else { inp.value = texto || ''; }
    }
    function habilitar(ligado) { inp.disabled = !ligado; }
    function mostrarAtual() { var m = opcoes.atual(); mostrarIcone(m); if (m) definir(nome(m), false); else definir(textos.selecione, true); }
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
    /* o que fica à vista. termo = o filtro digitado (vazio, sem filtro): quem casa, só nos grupos abertos; o grupo com
       alguém que casa abre, e o título some quando ninguém do grupo casa */
    function aplicar(termo) {
      var titulo = null, grupos = [];
      Array.prototype.forEach.call(menu.children, function (el) {
        if (el.hasAttribute('data-combo-titulo')) { titulo = { el: el, itens: [] }; grupos.push(titulo); return; }
        if (!el.hasAttribute('data-busca')) return;
        if (!titulo) { titulo = { el: null, itens: [] }; grupos.push(titulo); }
        titulo.itens.push(el);
      });
      var visiveis = 0;
      grupos.forEach(function (g) {
        var casam = g.itens.filter(function (it) { return !termo || (it.getAttribute('data-busca') || '').indexOf(termo) !== -1; });
        if (g.el) {
          g.el.classList.toggle('oculto', !casam.length);
          if (termo && casam.length) abrirGrupo(g.el, true);
        }
        var aberto = !g.el || g.el.getAttribute('aria-expanded') === 'true';
        g.itens.forEach(function (it) { it.classList.toggle('oculto', !aberto || casam.indexOf(it) < 0); });
        visiveis += casam.length;
      });
      var vazio = menu.querySelector('[data-combo-vazio]');   /* aviso quando o filtro não casa com ninguém */
      if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
      realcar(null);
    }
    function filtrar() { aplicar(RW.busca.normalizar(inp.value.trim())); }
    function mostrarTodos() { aplicar(''); }

    /* os grupos abertos e fechados pela pessoa (pelo título), guardados enquanto o campo existe: a lista refeita volta
       como estava */
    var gruposAbertos = {};
    function abrirGrupo(el, aberto) {
      el.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      gruposAbertos[el.getAttribute('data-combo-titulo')] = aberto;
    }
    function escolher(m) {
      definir(nome(m), false);
      mostrarIcone(m);
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

    /* o título de um grupo: o nome, quantos tem e a seta, que abre e fecha a lista dele. Começa como a pessoa deixou;
       senão, como o item pede (aberto) ou, sem pedir, o primeiro aberto e os outros fechados */
    function criarTitulo(m, quantos, primeiro) {
      var t = RW.tpl('tpl-combo-militar-titulo');
      if (!t) return null;
      t.querySelector('.combo-militar-titulo-nome').textContent = m.titulo;
      t.querySelector('.combo-militar-titulo-conta').textContent = '(' + quantos + ')';
      t.setAttribute('data-combo-titulo', m.titulo);
      var aberto = m.titulo in gruposAbertos ? gruposAbertos[m.titulo] : typeof m.aberto === 'boolean' ? m.aberto : primeiro;
      t.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      /* o clique no título não tira o foco do campo (o filtro digitado continua) */
      t.addEventListener('mousedown', function (e) { e.preventDefault(); });
      t.addEventListener('click', function () {
        abrirGrupo(t, t.getAttribute('aria-expanded') !== 'true');
        aplicar(RW.busca.normalizar(document.activeElement === inp ? inp.value.trim() : ''));
      });
      return t;
    }

    /* monta a lista; devolve quantos podem ser escolhidos. A escolha que sumiu da lista é desfeita (aoPerder) */
    function preencher(lista) {
      realcar(null);
      menu.textContent = '';
      var ignorar = opcoes.ignorar ? opcoes.ignorar() : [];
      var atual = opcoes.atual();
      var disponiveis = 0, aindaEscolhido = false, titulos = 0;
      lista.forEach(function (m, indice) {
        if (!m) return;
        if (m.titulo) {
          var quantos = 0;
          for (var i = indice + 1; i < lista.length && lista[i] && !lista[i].titulo; i++) if (ignorar.indexOf(lista[i].cpf) < 0) quantos++;
          var t = criarTitulo(m, quantos, titulos++ === 0);
          if (t) menu.appendChild(t);
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
      aplicar('');
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
