(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Popula um .dropdown-menu com opções numéricas (estilo estreito, rolável) e
     liga a escolha. O gatilho fica por conta de quem chama (via aoEscolher):
     nas horas é o campo do criar(); no modal de postos é um .campo-selecao.
     config = { opcoes, valor, formato, aoEscolher } */
  function preencher(menu, config) {
    config = config || {};
    var opcoes = config.opcoes || [];
    var valor = config.valor;
    var formato = config.formato || function (v) { return String(v); };
    var aoEscolher = config.aoEscolher;
    if (!menu) return;
    menu.classList.add('dropdown-numeros-menu');
    menu.textContent = '';
    var tplOp = document.getElementById('tpl-dropdown-numeros-opcao');
    opcoes.forEach(function (op) {
      var item = tplOp ? tplOp.content.cloneNode(true).firstElementChild : null;
      if (!item) return;
      item.textContent = formato(op);
      if (op === valor) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () {
        var ativos = menu.querySelectorAll('.dropdown-item--ativo');
        for (var i = 0; i < ativos.length; i++) ativos[i].classList.remove('dropdown-item--ativo');
        item.classList.add('dropdown-item--ativo');
        if (aoEscolher) aoEscolher(op);
      });
      menu.appendChild(item);
    });
  }

  /* o que foi escrito, só os números (os 2 primeiros): "15h" e "15:00" -> "15" */
  function digitos(texto) { return String(texto || '').replace(/\D/g, '').slice(0, 2); }
  /* a opção casa com o escrito pelo começo, com o zero ("08") ou sem ele ("8"): "1" -> 01, 10 a 19 */
  function casa(op, termo) {
    var s = String(op);
    return !termo || s.indexOf(termo) === 0 || String(parseInt(s, 10)).indexOf(termo) === 0;
  }

  var contaCampos = 0;   // nome único da lista de cada campo (o leitor de tela acompanha a opção realçada)

  /* Cria o campo de números completo (o campo + o menu) e o devolve (um .dropdown).
     Usado nas horas (geral-horario). Clica e escolhe na lista, ou escreve para filtrar
     (↑↓ andam, Enter escolhe, Esc volta ao de antes; sair do campo com um número que
     está na lista escolhe ele, senão volta). No celular, só escolhe (somente leitura).
     O geral-dropdown cuida de abrir/fechar/posicionar. config = { opcoes, valor, formato, aoEscolher } */
  function criar(config) {
    config = config || {};
    var RW = window.RosterWork;
    var formato = config.formato || function (v) { return String(v); };
    var opcoes = config.opcoes || [];
    var atual = config.valor;
    var tpl = document.getElementById('tpl-dropdown-numeros');
    if (!tpl) return null;
    var drop = tpl.content.cloneNode(true).firstElementChild;
    var inp = drop.querySelector('.dropdown-numeros-btn');
    var menu = drop.querySelector('.dropdown-menu');
    var vazio = menu.querySelector('.dropdown-numeros-vazio');
    var realce = null;   // a opção realçada pelas setas
    inp.value = formato(atual);
    preencher(menu, {
      opcoes: opcoes,
      valor: atual,
      formato: formato,
      aoEscolher: function (op) {
        atual = op;
        inp.value = formato(op);
        mostrarTodas();   // o filtro escrito não fica para a próxima vez que a lista abrir
        if (config.aoEscolher) config.aoEscolher(op);
      }
    });
    if (vazio) menu.appendChild(vazio);   // o preencher esvazia o menu: a linha do "nada casa" volta para o fim
    var itens = Array.prototype.slice.call(menu.querySelectorAll('.dropdown-item:not(.dropdown-numeros-vazio)'));
    menu.id = 'dropdown-numeros-' + (++contaCampos);
    inp.setAttribute('aria-controls', menu.id);
    itens.forEach(function (item, i) { item.id = menu.id + '-opcao-' + i; });

    function aberto() { return drop.classList.contains('dropdown--aberto'); }
    function abrir() { if (!aberto() && RW.abrirDropdown) RW.abrirDropdown(drop); }
    function fechar() { if (aberto() && RW.fecharDropdowns) RW.fecharDropdowns(); }
    function visiveis() { return itens.filter(function (it) { return !it.classList.contains('oculto'); }); }
    function realcar(item) {
      if (realce) realce.classList.remove('dropdown-item--realce');
      realce = item || null;
      if (!realce) { inp.removeAttribute('aria-activedescendant'); return; }
      realce.classList.add('dropdown-item--realce');
      inp.setAttribute('aria-activedescendant', realce.id);
      realce.scrollIntoView({ block: 'nearest' });
    }
    /* ↑↓: a primeira seta abre a lista; para nas pontas */
    function andar(passo) {
      abrir();
      var lista = visiveis();
      if (!lista.length) return;
      var i = lista.indexOf(realce);
      i = i < 0 ? (passo > 0 ? 0 : lista.length - 1) : Math.min(lista.length - 1, Math.max(0, i + passo));
      realcar(lista[i]);
    }
    function filtrar(termo) {
      itens.forEach(function (it, i) { it.classList.toggle('oculto', !casa(opcoes[i], termo)); });
      if (vazio) vazio.classList.toggle('oculto', visiveis().length > 0);
      realcar(null);
    }
    function mostrarTodas() { filtrar(''); }
    /* desiste do escrito: o campo volta ao escolhido */
    function voltar() { realcar(null); inp.value = formato(atual); mostrarTodas(); }

    /* no celular o campo só escolhe: somente leitura, então o toque não abre o teclado */
    function ajustarAoAparelho() { inp.readOnly = !!(RW.celular && RW.celular()); }
    /* o clique que abre a lista seleciona tudo, então escrever substitui o número (em vez de acrescentar) */
    inp.addEventListener('mousedown', function (e) {
      ajustarAoAparelho();
      if (inp.disabled) return;
      if (document.activeElement !== inp) { e.preventDefault(); inp.focus(); }
      else if (!aberto()) { e.preventDefault(); if (!inp.readOnly) inp.select(); }
    });
    inp.addEventListener('focus', function () { mostrarTodas(); if (!inp.readOnly) inp.select(); });
    inp.addEventListener('input', function () { filtrar(digitos(inp.value)); abrir(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); andar(e.key === 'ArrowDown' ? 1 : -1); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();   /* Enter escolhe a realçada; sem realce, a 1ª que sobrou */
      var alvo = realce || visiveis()[0];
      if (alvo) alvo.click();
    });
    /* o Esc (no soltar: o apertar fica com o geral-dropdown, que fecha a lista) volta ao escolhido */
    inp.addEventListener('keyup', function (e) { if (e.key === 'Escape') voltar(); });
    /* clicar na lista não tira o foco do campo: o escrito só vale ao sair do campo */
    menu.addEventListener('mousedown', function (e) { e.preventDefault(); });
    /* saiu do campo: um número escrito que está na lista ("15") é escolhido pelo mesmo clique da lista; senão, volta */
    inp.addEventListener('blur', function () {
      var termo = inp.value === formato(atual) ? '' : digitos(inp.value);
      var i = termo ? opcoes.map(function (op) { return parseInt(op, 10); }).indexOf(parseInt(termo, 10)) : -1;
      if (i >= 0 && opcoes[i] !== atual) { itens[i].click(); return; }
      voltar();
      fechar();
    });
    ajustarAoAparelho();
    return drop;
  }

  window.RosterWork.dropdownNumeros = { criar: criar, preencher: preencher };
})();
