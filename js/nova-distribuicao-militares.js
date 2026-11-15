/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 9, Regras por militar
   Um cartão por regra (fechado, o militar e a regra em texto; aberto,
   os campos): o militar (campo de digitar e escolher, no
   jeito do campo Militar das Trocas), Não pode | Só pode, a unidade
   (esta, outra da companhia ou qualquer uma), o posto e a função.
   Os militares vêm do nova_distribuicao_ler (ativos da unidade, do
   mais antigo ao mais moderno); as unidades, os postos de cada uma e o
   texto de cada regra, da conta (regra_unidades, regra_textos). Os
   campos Posto e Função também servem às Regras por graduação.
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

  /* ---------- onde e a função (aqui e nas Regras por graduação) ---------- */

  /* as unidades da companhia e os postos de cada uma (a conta); a desta unidade é a "propria" */
  function unidades(ctx) { return (ctx.calc && ctx.calc.regra_unidades) || []; }
  function propria(ctx) { return unidades(ctx).filter(function (u) { return u.propria; })[0] || { id: null, postos: [] }; }

  /* a unidade da regra: sem unidade, esta; '*' (qualquer), nula; a que não existe mais, undefined */
  function unidadeDa(ctx, r, comUnidade) {
    if (!comUnidade || r.unidade == null) return propria(ctx);
    if (r.unidade === '*') return null;
    return unidades(ctx).filter(function (u) { return String(u.id) === String(r.unidade); })[0];
  }

  /* as funções que a regra pode escolher: as do posto escolhido ou, sem posto, as cinco do molde (lista nula). Qualquer
     função só com o posto ou, na regra por militar, com uma unidade no "não pode" (a unidade inteira) */
  function funcoesDa(ctx, r, comUnidade) {
    var un = unidadeDa(ctx, r, comUnidade);
    var posto = un && r.posto ? un.postos.filter(function (p) { return p.id === r.posto; })[0] : null;
    return { lista: posto ? posto.funcoes : null, qualquer: !!posto || (comUnidade && r.unidade !== '*' && r.tipo !== 'exclusivo') };
  }

  /* depois de mudar a unidade, o posto ou a regra, a função que não vale mais sai */
  function acertarFuncao(ctx, r, comUnidade) {
    if (!r.funcao) return;
    var f = funcoesDa(ctx, r, comUnidade);
    if (r.funcao === '*' ? !f.qualquer : (f.lista && f.lista.indexOf(r.funcao) < 0)) r.funcao = null;
  }

  /* os campos Unidade (só na regra por militar), Posto e Função; mudar(fn) muda a regra no rascunho;
     op = { unidade, travado, falta } */
  function ondeEFuncao(conteudo, ctx, r, mudar, op) {
    var comUnidade = !!op.unidade;
    var un = unidadeDa(ctx, r, comUnidade);
    if (comUnidade) {
      var lista = unidades(ctx);
      conteudo.querySelector('[data-espaco="unidade"]').appendChild(P().selecaoFixa('regra-unidade',
        r.unidade == null ? String(propria(ctx).id) : String(r.unidade), function (v) {
          mudar(function (g) {
            if (v === '*') g.unidade = '*';
            else if (Number(v) === propria(ctx).id) delete g.unidade;
            else g.unidade = Number(v);
            delete g.posto;
            acertarFuncao(ctx, g, true);
          });
        }, op.travado, op.falta && un === undefined, function (caixa) {
          var menu = caixa.querySelector('.dropdown-menu');
          menu.querySelector('[data-titulo="companhia"]').textContent = (lista[0] || {}).nome || '';
          lista.forEach(function (u) {
            var item = P().tpl('selecao-funcao');
            item.setAttribute('data-valor', String(u.id));
            item.textContent = u.nome;
            menu.appendChild(item);
          });
        }));
    }

    var postos = un ? un.postos : [];
    var achado = r.posto ? postos.filter(function (p) { return p.id === r.posto; })[0] : null;
    conteudo.querySelector('[data-espaco="posto"]').appendChild(P().selecaoFixa('regra-posto', r.posto == null ? 'qualquer' : r.posto, function (v) {
      mudar(function (g) {
        if (v === 'qualquer') delete g.posto; else g.posto = v;
        acertarFuncao(ctx, g, comUnidade);
      });
    }, op.travado || !un, op.falta && r.posto != null && !achado, function (caixa) {
      var menu = caixa.querySelector('.dropdown-menu');
      var antesDe = { instalacao: menu.querySelector('[data-titulo="viatura"]'), viatura: null };
      ['instalacao', 'viatura'].forEach(function (tipo) {
        var doTipo = postos.filter(function (p) { return p.tipo === tipo; });
        menu.querySelector('[data-titulo="' + tipo + '"]').classList.toggle('oculto', !doTipo.length);
        doTipo.forEach(function (p) {
          var item = P().tpl('selecao-funcao');
          item.setAttribute('data-valor', p.id);
          item.textContent = p.nome;
          menu.insertBefore(item, antesDe[tipo]);
        });
      });
    }));

    var f = funcoesDa(ctx, r, comUnidade);
    conteudo.querySelector('[data-espaco="funcao"]').appendChild(P().selecaoFixa('regra-funcao', r.funcao, function (v) {
      mudar(function (g) { g.funcao = v; });
    }, op.travado, op.falta && !r.funcao, function (caixa) {
      caixa.querySelectorAll('.dropdown-item').forEach(function (item) {
        var v = item.getAttribute('data-valor');
        item.classList.toggle('oculto', v === '*' ? !f.qualquer : !!(f.lista && f.lista.indexOf(v) < 0));
      });
    }));
  }

  /* o texto da regra no cartão fechado ("Não pode ABTR-14462 · Condutor"), com o alvo que a conta escreve */
  function textoDaRegra(r, alvo, falta) {
    return r.tipo && alvo ? P().texto(M().regraTexto[r.tipo], { funcao: alvo }) : { texto: M().faltaResponder, falta: falta };
  }

  /* ---------- a regra por militar ---------- */

  /* os campos da regra aberta: Militar, Regra (Não pode | Só pode), Unidade, Posto, Função e o Remover regra */
  function campos(lugar, ctx, api, militares, r, i, falta, erros) {
    var conteudo = P().tpl('regra');
    function mudar(fn) { api.mudar(ctx.lado, function (x) { fn(x.regras[i]); }); }
    combo(conteudo, 'nova-distribuicao-militar-' + i, militares, r.cpf, function (cpf) {
      mudar(function (g) { g.cpf = cpf; });
    }, ctx.soLeitura, falta && !r.cpf);

    var tipo = conteudo.querySelector('.nova-distribuicao-regra-tipo');
    tipo.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === r.tipo);
      aba.disabled = ctx.soLeitura;
    });
    tipo.classList.toggle('nova-distribuicao-espaco--erro', falta && !r.tipo);
    RosterWork.abas.ligar(tipo, function (aba) {
      var v = aba.getAttribute('data-valor');
      if (v !== r.tipo) mudar(function (g) { g.tipo = v; acertarFuncao(ctx, g, true); });
    });

    ondeEFuncao(conteudo, ctx, r, mudar, { unidade: true, travado: ctx.soLeitura, falta: falta });

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

  /* uma regra por cartão: fechado, o militar no título e a regra embaixo ("Não pode ABTR-14462 · Condutor"); aberto,
     os campos */
  function regras(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-regras'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'regras');
    var militares = (api.dados() && api.dados().militares) || [];
    var todas = ctx.resp.regras || [];
    if (!todas.length) u.appendChild(P().tpl('regras-vazio'));

    /* a regra nova (ainda não salva) não acusa o que falta antes do Salvar */
    var gravadas = ((((api.dados() || {}).atual || {}).respostas || {}).regras || []).length;
    var alvos = ((ctx.calc && ctx.calc.regra_textos) || {}).militar || [];
    todas.forEach(function (r, i) {
      var falta = i < gravadas && P().pendente(ctx, 'regra:' + i);
      var erros = P().erros(ctx, 'regra:' + i);
      var m = militares.filter(function (x) { return x.cpf === r.cpf; })[0];
      var linhas = [textoDaRegra(r, alvos[i], falta)].concat(erros.map(function (e) { return { texto: e, falta: true }; }));
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

  window.RosterWork.novaDistribuicaoMilitares = { regras: regras, ondeEFuncao: ondeEFuncao, textoDaRegra: textoDaRegra };
})();
