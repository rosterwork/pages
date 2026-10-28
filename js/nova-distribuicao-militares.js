/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 7, Regras por militar
   Um cartão por regra (fechado, o militar e a regra em texto; aberto,
   os campos): o militar (campo de digitar e escolher, no
   jeito do campo Militar das Trocas), Não pode | Só pode e a função.
   Os militares vêm do nova_distribuicao_ler (ativos da unidade, do
   mais antigo ao mais moderno). As regras ficam só nas respostas do
   protótipo; as da página Distribuição não mudam.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  function nomeMil(m) { return (m.grau ? m.grau + ' ' : '') + m.nome; }

  /* combobox: no computador, digita para filtrar ou escolhe na lista (↑↓ andam, Enter escolhe,
     Esc fecha pelo geral-dropdown); no celular, só escolhe (o campo fica somente leitura) */
  function combo(caixa, id, militares, atualCpf, aoEscolher, travado, comErro) {
    var dropdown = caixa.querySelector('.campo-combo');
    var inp = dropdown.querySelector('input');
    var menu = dropdown.querySelector('.dropdown-menu');
    var atual = militares.filter(function (m) { return m.cpf === atualCpf; })[0];
    var realce = null;

    inp.id = id;
    menu.id = id + '-menu';
    inp.setAttribute('aria-controls', menu.id);
    inp.disabled = !!travado;
    inp.readOnly = !!(RosterWork.celular && RosterWork.celular());
    dropdown.classList.toggle('nova-distribuicao-espaco--erro', !!comErro);
    function mostrarAtual() { inp.value = atual ? nomeMil(atual) : ''; }
    mostrarAtual();

    function itens() { return Array.prototype.slice.call(menu.querySelectorAll('[data-busca]:not(.oculto)')); }
    function realcar(item) {
      if (realce) realce.classList.remove('dropdown-item--realce');
      realce = item || null;
      if (!realce) { inp.removeAttribute('aria-activedescendant'); return; }
      realce.classList.add('dropdown-item--realce');
      inp.setAttribute('aria-activedescendant', realce.id);
      realce.scrollIntoView({ block: 'nearest' });
    }
    function abrir() { if (!dropdown.classList.contains('dropdown--aberto')) RosterWork.abrirDropdown(dropdown); }
    function filtrar(termo) {
      var visiveis = 0;
      menu.querySelectorAll('[data-busca]').forEach(function (item) {
        var casa = !termo || item.getAttribute('data-busca').indexOf(termo) >= 0;
        item.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      vazio.classList.toggle('oculto', visiveis > 0);
      realcar(null);
    }

    militares.forEach(function (m, k) {
      var item = P().tpl('militar');
      item.id = id + '-opcao-' + k;
      item.textContent = nomeMil(m);
      item.setAttribute('data-busca', RosterWork.busca.normalizar(nomeMil(m)));
      if (atual && atual.cpf === m.cpf) item.setAttribute('aria-selected', 'true');
      item.addEventListener('click', function () { if (!atual || atual.cpf !== m.cpf) aoEscolher(m.cpf); });
      menu.appendChild(item);
    });
    var vazio = P().tpl('militar-vazio');
    menu.appendChild(vazio);

    /* 1º clique seleciona tudo, então digitar substitui o nome (em vez de acrescentar) */
    inp.addEventListener('mousedown', function (e) {
      if (!inp.disabled && document.activeElement !== inp) { e.preventDefault(); inp.focus(); }
    });
    inp.addEventListener('focus', function () { filtrar(''); if (!inp.readOnly) inp.select(); });
    inp.addEventListener('input', function () { filtrar(RosterWork.busca.normalizar(inp.value.trim())); abrir(); });
    inp.addEventListener('blur', function () { realcar(null); mostrarAtual(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        abrir();
        var lista = itens();
        if (!lista.length) return;
        var i = lista.indexOf(realce);
        var passo = e.key === 'ArrowDown' ? 1 : -1;
        i = i < 0 ? (passo > 0 ? 0 : lista.length - 1) : Math.min(lista.length - 1, Math.max(0, i + passo));
        realcar(lista[i]);
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();   /* Enter escolhe o realçado; sem realce, o 1º visível */
      var alvo = realce || itens()[0];
      if (alvo) alvo.click();
    });
  }

  /* os campos da regra aberta: Militar, Regra (Não pode | Só pode), Função e o Remover regra */
  function campos(lugar, ctx, api, militares, r, i, falta, erros) {
    var conteudo = P().tpl('regra');
    combo(conteudo, 'nova-distribuicao-militar-' + i, militares, r.cpf, function (cpf) {
      api.mudar(ctx.lado, function (x) { x.regras[i].cpf = cpf; });
    }, ctx.soLeitura, falta && !r.cpf);

    var tipo = conteudo.querySelector('.nova-distribuicao-regra-tipo');
    tipo.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === r.tipo);
      aba.disabled = ctx.soLeitura;
    });
    tipo.classList.toggle('nova-distribuicao-espaco--erro', falta && !r.tipo);
    RosterWork.abas.ligar(tipo, function (aba) {
      var v = aba.getAttribute('data-valor');
      if (v !== r.tipo) api.mudar(ctx.lado, function (x) { x.regras[i].tipo = v; });
    });

    conteudo.querySelector('[data-espaco="funcao"]').appendChild(P().selecaoFixa('regra-funcao', r.funcao, function (v) {
      api.mudar(ctx.lado, function (x) { x.regras[i].funcao = v; });
    }, ctx.soLeitura, falta && !r.funcao));

    /* fecha o cartão antes de tirar a regra: as de baixo sobem de posição */
    var remover = conteudo.querySelector('.nova-distribuicao-remover-regra');
    remover.disabled = ctx.soLeitura;
    remover.addEventListener('click', function () {
      api.abrir(ctx.lado + ':regra-' + i);
      api.mudar(ctx.lado, function (x) { x.regras.splice(i, 1); });
    });

    var frases = erros.slice();
    if (falta) frases.unshift(M().regraIncompleta);
    frases.forEach(function (e) { P().erroCampo(conteudo, e); });
    lugar.appendChild(conteudo);
  }

  /* uma regra por cartão: fechado, o militar no título e a regra embaixo ("Não pode Condutor"); aberto, os campos */
  function regras(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-regras'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'regras');
    var militares = (api.dados() && api.dados().militares) || [];
    var todas = ctx.resp.regras || [];
    if (!todas.length) u.appendChild(P().tpl('regras-vazio'));

    /* a regra nova (ainda não salva) não acusa o que falta antes do Salvar */
    var gravadas = ((((api.dados() || {}).atual || {}).respostas || {}).regras || []).length;
    todas.forEach(function (r, i) {
      var falta = i < gravadas && P().pendente(ctx, 'regra:' + i);
      var erros = P().erros(ctx, 'regra:' + i);
      var m = militares.filter(function (x) { return x.cpf === r.cpf; })[0];
      var linhas = [r.tipo && r.funcao ? P().texto(M().regraTexto[r.tipo], { funcao: r.funcao }) : { texto: M().faltaResponder, falta: falta }]
        .concat(erros.map(function (e) { return { texto: e, falta: true }; }));
      P().cartao(u, api, ctx, 'regra-' + i, m ? nomeMil(m) : M().semMilitar, linhas, function (lugar) {
        campos(lugar, ctx, api, militares, r, i, falta, erros);
      }, falta || erros.length > 0);
    });

    /* a regra nova já abre */
    var novo = P().tpl('nova-regra');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () {
      api.mudar(ctx.lado, function (x) { x.regras = x.regras || []; x.regras.push({ cpf: null, tipo: null, funcao: null }); }, ctx.lado + ':regra-' + todas.length);
    });
    u.appendChild(novo);
  }

  window.RosterWork.novaDistribuicaoMilitares = { regras: regras };
})();
