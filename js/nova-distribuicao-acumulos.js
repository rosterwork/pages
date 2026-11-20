/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 5 do questionário: Acúmulos
   Um cartão por acúmulo: a função (um lugar ou, só no Sempre, todos os
   lugares da função no posto: "ABT-41 · Efetivo, todos"), a regra
   (Sempre: é sempre da mesma pessoa; Se faltar: quem cobre quando ela
   fica sem gente) e quem, em ordem, com as setas e a lixeira; a última
   linha é sempre a "Fica vazia", e escolher alguém nela abre outra
   embaixo. A função de vários lugares de outro posto aparece como "o
   mais antigo" e "o mais moderno" (a antiguidade de verdade); com
   todos, só a mesma função de outro posto com pelo menos tantos lugares
   (o 1º com o 1º...). Os dados seguem na lista respostas.acumulos
   ([{ regra: 'sempre' | 'se_faltar', funcao, opcoes }]); sem ela no
   rascunho, vale a da conta do banco, copiada ao mexer. As regras
   automáticas vêm do banco, travadas; a do Condutor aceita as outras
   opções do admin. Toda mudança passa pelo api.mudar
   (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  /* o cartão novo antes de escolher a regra: fica fora das respostas ({ unidade, lado, funcao }) */
  var novo = null;
  /* quantos acúmulos havia ao abrir a unidade (por lado), quando o gravado ainda é o jeito de antes */
  var abertura = { dados: null, n: {} };

  /* ---------- a lista ---------- */

  function daConta(ctx) { return (ctx.calc && ctx.calc.respostas && ctx.calc.respostas.acumulos) || []; }
  function lista(ctx) { return (ctx.resp && ctx.resp.acumulos) || daConta(ctx); }

  /* muda a lista no rascunho; na primeira vez, copia a da conta (o jeito novo) */
  function mudarLista(api, ctx, fn, abrirId) {
    api.mudar(ctx.lado, function (x) {
      if (!x.acumulos) x.acumulos = JSON.parse(JSON.stringify(daConta(ctx)));
      fn(x.acumulos);
    }, abrirId);
  }

  /* quantos acúmulos estão salvos: o novo (ainda não salvo) não acusa o que falta antes do Salvar */
  function gravadas(api, ctx) {
    var salvas = ((((api.dados() || {}).atual || {}).respostas) || {}).acumulos;
    if (salvas) return salvas.length;
    if (abertura.dados !== api.dados()) abertura = { dados: api.dados(), n: {} };
    if (abertura.n[ctx.lado] == null) abertura.n[ctx.lado] = lista(ctx).length;
    return abertura.n[ctx.lado];
  }

  /* o acúmulo como linha: [função, 1ª, 2ª...] (as linhas de quem andam por ela) */
  function linhaDe(e) { return [(e && e.funcao) || ''].concat((e && e.opcoes) || []); }
  function tipoDe(e) { return e.regra === 'se_faltar' ? 'cobre' : (e.regra === 'sempre' ? 'sempre' : ''); }
  function regraDe(tipo) { return tipo === 'cobre' ? 'se_faltar' : 'sempre'; }

  /* ---------- as funções de vários lugares ---------- */

  /* cada função de cada posto pelo nome sem número ("Efetivo · ABT-41" → { base, posto, lugares }), sem as especiais, na
     ordem dos postos e do lugar */
  function grupos(ctx) {
    var mapa = {};
    ((ctx.calc && ctx.calc.funcoes) || []).forEach(function (f) {
      if (f.papel) return;
      var base = f.funcao.replace(/ \d+$/, '');
      var chave = base + ' · ' + f.posto;
      (mapa[chave] = mapa[chave] || { base: base, posto: f.posto, lugares: [] }).lugares.push(f.nome);
    });
    return mapa;
  }
  function nomeGrupo(g, qual) { return g.base + ':' + qual + ' · ' + g.posto; }

  /* os lugares de uma função do acúmulo (o lugar, ou todos os da função no posto) */
  function lugaresDe(gs, nome) {
    var g = P().grupoDe(nome);
    return g ? ((gs[g.base + ' · ' + g.posto] || {}).lugares || []) : [nome];
  }

  /* "o mais antigo" ↔ "o mais moderno" da mesma função (os dois não vão na mesma linha) */
  function gemeo(nome) {
    var g = P().grupoDe(nome);
    if (!g || g.qual === 'todos') return null;
    return g.base + ':' + (g.qual === 'antigo' ? 'moderno' : 'antigo') + ' · ' + g.posto;
  }

  /* ---------- as regras automáticas ---------- */

  function automaticas(ctx, tipo) { return (ctx.calc && ctx.calc.automaticas && ctx.calc.automaticas[tipo]) || []; }

  /* a regra automática: a frase (uma ou duas linhas) e a trava (molde) */
  function automatica(destino, frase) {
    var caixa = P().tpl('automatica');
    var linhas = [].concat(frase);
    caixa.querySelectorAll('.nova-distribuicao-automatica-texto').forEach(function (el, k) {
      el.textContent = linhas[k] || '';
      el.classList.toggle('oculto', !linhas[k]);
    });
    caixa.appendChild(P().tpl('trava-funcoes'));
    destino.appendChild(caixa);
  }

  /* a regra automática do Condutor aceita as outras opções do admin: elas ficam num acúmulo com a mesma função, junto com
     a função especial (no Sempre, sempre a 1ª; no Se faltar, onde o admin puser) */
  function condutorAuto(ctx) { return (ctx.calc && ctx.calc.automaticas && ctx.calc.automaticas.condutor) || ''; }

  function indiceAuto(acs, nome) {
    for (var k = 0; k < acs.length; k++) if (acs[k] && acs[k].funcao === nome) return k;
    return -1;
  }

  /* movel = a função especial sobe e desce (Se faltar); sem ela na linha, entra na 1ª */
  function linhaAuto(acs, a, movel) {
    var k = indiceAuto(acs, a[0]);
    if (k < 0) return a.slice();
    var resto = (acs[k].opcoes || []).slice();
    if (movel && resto.indexOf(a[1]) >= 0) return [a[0]].concat(resto);
    return [a[0], a[1]].concat(resto.filter(function (x) { return x !== a[1]; }));
  }

  /* muda as outras opções da regra automática; sem nenhuma, o acúmulo sai da lista */
  function mudarAuto(api, ctx, tipo, a) {
    return function (fn) {
      mudarLista(api, ctx, function (acs) {
        var k = indiceAuto(acs, a[0]);
        var l = linhaAuto(acs, a, tipo === 'cobre');
        fn(l);
        var e = { regra: regraDe(tipo), funcao: a[0], opcoes: l.slice(1) };
        if (k < 0) { if (l.length > 2) acs.push(e); }
        else if (l.length > 2) acs[k] = e;
        else acs.splice(k, 1);
      });
    };
  }

  /* ---------- a função e quem ---------- */

  /* as funções que o cartão pode escolher: as da unidade (fora as especiais, as das regras automáticas e as que já têm
     cartão; fica a dele, i) e, depois dos lugares de uma função de vários lugares, "todos" */
  function funcoesLivres(ctx, atual, i) {
    var gs = grupos(ctx);
    var usadas = automaticas(ctx, 'sempre').concat(automaticas(ctx, 'cobre')).map(function (a) { return a[0]; });
    lista(ctx).forEach(function (e, k) { if (k !== i) usadas = usadas.concat(lugaresDe(gs, e.funcao)); });
    var livres = [];
    Object.keys(gs).forEach(function (chave) {
      var g = gs[chave];
      g.lugares.forEach(function (n) { if (n === atual || usadas.indexOf(n) < 0) livres.push(n); });
      var todos = nomeGrupo(g, 'todos');
      if (g.lugares.length >= 2 && (todos === atual || g.lugares.every(function (n) { return usadas.indexOf(n) < 0; }))) livres.push(todos);
    });
    return livres;
  }

  /* quem pode cobrir a função: só de outro posto; a especial e as funções de um lugar só pelo nome, as de vários lugares em
     "o mais antigo" e "o mais moderno"; com todos, a mesma função de outro posto com pelo menos tantos lugares (fora a que é
     de outra pessoa pelo Sempre) */
  function escolhas(ctx, funcao) {
    var gs = grupos(ctx);
    var g = P().grupoDe(funcao);
    if (g) {
      var n = lugaresDe(gs, funcao).length;
      var deOutro = automaticas(ctx, 'sempre').map(function (a) { return a[0]; });
      lista(ctx).forEach(function (e) { if (e.regra === 'sempre' && e.funcao !== funcao) deOutro = deOutro.concat(lugaresDe(gs, e.funcao)); });
      return Object.keys(gs).map(function (k) { return gs[k]; }).filter(function (x) {
        return x.base === g.base && x.posto !== g.posto && x.lugares.length >= n
          && x.lugares.every(function (l) { return deOutro.indexOf(l) < 0; });
      }).map(function (x) { return nomeGrupo(x, 'todos'); });
    }
    var posto = P().partes(funcao).posto;
    var papel = P().papel(ctx);
    var saida = [];
    P().proprias(ctx).forEach(function (nome) {
      if (posto && P().partes(nome).posto === posto) return;
      var f = P().funcaoDe(ctx, nome);
      var x = f && !f.papel ? gs[f.funcao.replace(/ \d+$/, '') + ' · ' + f.posto] : null;
      if (nome === papel || !x || x.lugares.length < 2) { saida.push(nome); return; }
      if (saida.indexOf(nomeGrupo(x, 'antigo')) < 0) saida.push(nomeGrupo(x, 'antigo'), nomeGrupo(x, 'moderno'));
    });
    return saida;
  }

  /* as linhas de quem: as escolhidas e, no fim, a vaga (a "Fica vazia"; sem nenhuma escolhida, a 1ª pede a escolha) */
  function vagas(linha) {
    var v = linha.slice(1);
    if (!v.length || v[v.length - 1]) v.push('');
    return v;
  }

  /* as linhas de quem (linha = [função, 1ª, 2ª...]), com as setas e a lixeira; mudar(fn) muda a linha nas respostas.
     auto = a regra automática: a função especial travada e sem lixeira, no Sempre sempre a 1ª ({ fixa }), no Se faltar
     sobe e desce ({ papel }) */
  function opcoes(caixa, ctx, linha, tipo, falta, mudar, auto) {
    auto = auto || {};
    var destino = caixa.querySelector('.nova-distribuicao-regra-lista');
    var linhas = vagas(linha);
    var total = linhas.length - 1;   /* as escolhidas (a última é a vaga) */
    var inicio = auto.fixa ? 1 : 0;  /* as que andam começam depois da fixa */
    var todas = escolhas(ctx, linha[0]);
    linhas.forEach(function (s, j) {
      var item = P().tpl('opcao');
      var rotulo = j === 0 ? (tipo === 'sempre' ? M().rotuloMesmo : M().rotuloCobre) : (j === 1 ? M().rotuloSeFaltar : M().rotuloTambem);
      var presa = (!!auto.fixa && j === 0) || (!!auto.papel && s === auto.papel);
      var vaga = j === total;
      item.querySelector('.nova-distribuicao-regra-rotulo').textContent = rotulo;
      var outros = linha.slice(1).filter(function (x, k) { return k !== j; });
      var podem = presa ? [s] : todas.filter(function (nome) { return outros.indexOf(nome) < 0 && outros.indexOf(gemeo(nome)) < 0; });
      item.querySelector('.nova-distribuicao-espaco').appendChild(P().selecaoFuncoes(ctx, podem, s, function (v) {
        mudar(function (l) { while (l.length < j + 1) l.push(''); l[j + 1] = v; });
      }, { rotulo: rotulo, vazio: vaga && j > 0 ? M().ficaVazia : '', travado: ctx.soLeitura || presa, erro: falta && j === 0 && !s }));
      item.querySelector('.nova-distribuicao-opcao-setas').classList.toggle('oculto', vaga || j < inicio || total - inicio < 2);
      P().setas(item, j - inicio, total - inicio, function (passo) {
        mudar(function (l) { P().mover(l, j + 1, passo); });
      }, ctx.soLeitura);
      var tirar = item.querySelector('.nova-distribuicao-remover');
      tirar.disabled = ctx.soLeitura;
      tirar.classList.toggle('oculto', vaga || presa || total < 2);
      tirar.addEventListener('click', function () { mudar(function (l) { l.splice(j + 1, 1); }); });
      destino.appendChild(item);
    });
  }

  /* ---------- o cartão ---------- */

  function postoDe(nome) { var g = P().grupoDe(nome); return g ? g.posto : P().partes(nome).posto; }

  /* a frase do cartão fechado: uma linha por quem (todos: os Efetivos de um posto são os mesmos do outro, o 1º com o 1º...,
     só os pares que existem; o que falta o banco acusa) */
  function frases(ctx, tipo, funcao, quem) {
    var g = P().grupoDe(funcao);
    if (g) {
      var gs = grupos(ctx);
      var n = Math.min(lugaresDe(gs, funcao).length, P().grupoDe(quem[0]) ? lugaresDe(gs, quem[0]).length : 1);
      return [P().texto(M().fraseTodos, {
        plural: M().plurais[g.base] || g.base, de: M().daPosto(g.posto), posto: g.posto,
        de2: M().daPosto(postoDe(quem[0])), quem: postoDe(quem[0]), pares: M().paresTodos(n)
      })].concat(quem.slice(1).map(function (q) { return P().texto(M().fraseReservaTodos, { de: M().daPosto(postoDe(q)), quem: postoDe(q) }); }));
    }
    return [P().texto(tipo === 'sempre' ? M().fraseSempre : M().fraseFalta, { funcao: P().completo(ctx, funcao), quem: P().completo(ctx, quem[0]) })]
      .concat(quem.slice(1).map(function (s) { return P().texto(M().fraseReserva, { quem: P().completo(ctx, s) }); }));
  }

  /* fechado, a função no título e a regra em frase; aberto, a função, a regra (Sempre ou Se faltar; com todos, só Sempre),
     quem e o Remover acúmulo. A regra automática tem a função, a regra e a função especial travadas, a trava e não tem
     Remover acúmulo. d = { id, tipo ('sempre' | 'cobre'; '' no novo), linha, chave, falta, auto (o das opções), mudar,
     funcao, trocar, remover, muda } */
  function cartaoAcumulo(u, api, ctx, d) {
    var erros = d.chave ? P().erros(ctx, d.chave) : [];
    var quem = d.linha.slice(1).filter(Boolean);
    var linhas = (d.linha[0] && quem.length && d.tipo ? frases(ctx, d.tipo, d.linha[0], quem) : [{ texto: M().opcoesIncompletas, falta: d.falta }])
      .concat(erros.map(function (e) { return { texto: e, falta: true }; }));
    var titulo = d.linha[0] ? P().completo(ctx, d.linha[0]) : M().semFuncao;
    P().cartao(u, api, ctx, d.id, titulo, linhas, function (lugar) {
      var conteudo = P().tpl('acumulo');
      conteudo.querySelector('[data-espaco="funcao"]').appendChild(d.funcao());
      var regras = conteudo.querySelector('.nova-distribuicao-opcoes--lado');
      P().bolinhas(regras, ctx.lado + '-regra-' + d.id, function (v) { return v === d.tipo; }, d.trocar || function () {}, ctx.soLeitura || !!d.auto);
      /* todos os lugares: só no Sempre */
      if (P().grupoDe(d.linha[0])) {
        var seFaltar = regras.querySelector('input[data-valor="cobre"]');
        seFaltar.disabled = true;
        seFaltar.closest('label').setAttribute('data-dica', M().seFaltarUmLugar);
      }
      if (d.tipo) opcoes(conteudo, ctx, d.linha, d.tipo, d.falta, d.mudar, d.auto);
      var tirarTudo = conteudo.querySelector('.nova-distribuicao-remover-acumulo');
      tirarTudo.classList.toggle('oculto', !!d.auto);
      tirarTudo.disabled = ctx.soLeitura;
      if (d.remover) tirarTudo.addEventListener('click', d.remover);
      var avisos = erros.slice();
      if (d.falta) avisos.unshift(d.auto ? M().opcoesVazias : M().opcoesIncompletas);
      avisos.forEach(function (e) { P().erroCampo(conteudo, e); });
      if (d.auto) conteudo.appendChild(P().tpl('trava-funcoes'));
      lugar.appendChild(conteudo);
    }, d.falta || erros.length > 0, d.muda ? { muda: d.muda } : null);
  }

  /* a função travada da regra automática */
  function funcaoPresa(ctx, nome) {
    return function () { return P().selecaoFuncoes(ctx, [nome], nome, function () {}, { rotulo: M().rotuloFuncao, travado: true }); };
  }

  /* um cartão do admin: o acúmulo i da lista */
  function cartaoDoAdmin(u, api, ctx, i) {
    var e = lista(ctx)[i];
    var falta = i < gravadas(api, ctx) && P().pendente(ctx, 'acumulo:' + i);
    cartaoAcumulo(u, api, ctx, {
      id: 'acumulo-' + i, tipo: tipoDe(e), linha: linhaDe(e), chave: 'acumulo:' + i, falta: falta, auto: null,
      muda: e.funcao ? 'acumulo:' + e.funcao : '',
      mudar: function (fn) {
        mudarLista(api, ctx, function (acs) {
          var l = linhaDe(acs[i]);
          fn(l);
          acs[i].funcao = l[0];
          acs[i].opcoes = l.slice(1);
        });
      },
      funcao: function () {
        return P().selecaoFuncoes(ctx, funcoesLivres(ctx, e.funcao, i), e.funcao, function (v) {
          mudarLista(api, ctx, function (acs) {
            /* entre um lugar e todos, quem começa de novo (todos só escolhe todos); todos é só no Sempre */
            if (!!P().grupoDe(acs[i].funcao) !== !!P().grupoDe(v)) acs[i].opcoes = [];
            if (P().grupoDe(v)) acs[i].regra = 'sempre';
            acs[i].funcao = v;
          });
        }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura, erro: falta && !e.funcao });
      },
      trocar: function (v) {
        if (v === tipoDe(e)) return;
        mudarLista(api, ctx, function (acs) { acs[i].regra = regraDe(v); });
      },
      /* fecha o cartão antes de tirar o acúmulo: os de baixo sobem de posição */
      remover: function () {
        api.abrir(ctx.lado + ':acumulo-' + i);
        mudarLista(api, ctx, function (acs) { acs.splice(i, 1); });
      }
    });
  }

  /* o cartão novo: aberto, a função e a regra; ao escolher a regra, o acúmulo entra na lista */
  function cartaoNovo(u, api, ctx) {
    if (!novo) return;
    if (novo.unidade !== api.unidadeId() || novo.lado !== ctx.lado || api.aberto() !== ctx.lado + ':novo') { novo = null; return; }
    cartaoAcumulo(u, api, ctx, {
      id: 'novo', tipo: '', linha: [novo.funcao], chave: '', falta: false, auto: null,
      funcao: function () {
        return P().selecaoFuncoes(ctx, funcoesLivres(ctx, novo.funcao, -1), novo.funcao, function (v) {
          novo.funcao = v;
          api.redesenhar();
        }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura });
      },
      trocar: function (v) {
        var n = lista(ctx).length;
        var funcao = novo.funcao;
        novo = null;
        mudarLista(api, ctx, function (acs) { acs.push({ regra: regraDe(v), funcao: funcao, opcoes: [] }); }, ctx.lado + ':acumulo-' + n);
      },
      remover: function () { novo = null; api.abrir(ctx.lado + ':novo'); }
    });
  }

  /* ---------- 5. Acúmulos ---------- */
  function acumulos(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-acumulos'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'sempre');
    P().marcarMuda(u, ctx, 'cobre');
    var condutor = condutorAuto(ctx);
    var acs = lista(ctx);
    var unidas = [];

    /* as regras automáticas: as frases travadas e o cartão do Condutor */
    automaticas(ctx, 'sempre').forEach(function (a) {
      if (a[0] !== condutor) {
        automatica(u, P().texto(M().automaticaSempre, { funcao: P().completo(ctx, a[0]), quem: P().completo(ctx, a[1]) }));
        return;
      }
      var k = indiceAuto(acs, a[0]);
      if (k >= 0) unidas.push(k);
      cartaoAcumulo(u, api, ctx, {
        id: 'sempre-auto', tipo: 'sempre', linha: linhaAuto(acs, a),
        chave: k >= 0 ? 'acumulo:' + k : '', falta: k >= 0 && k < gravadas(api, ctx) && P().pendente(ctx, 'acumulo:' + k),
        auto: { fixa: true }, mudar: mudarAuto(api, ctx, 'sempre', a), funcao: funcaoPresa(ctx, a[0]), muda: 'acumulo:' + a[0]
      });
    });
    automaticas(ctx, 'cobre').forEach(function (a) {
      var k = indiceAuto(acs, a[0]);
      if (k >= 0) unidas.push(k);
      cartaoAcumulo(u, api, ctx, {
        id: 'cobre-auto', tipo: 'cobre', linha: linhaAuto(acs, a, true),
        chave: k >= 0 ? 'acumulo:' + k : '', falta: k >= 0 && k < gravadas(api, ctx) && P().pendente(ctx, 'acumulo:' + k),
        auto: { papel: a[1] }, mudar: mudarAuto(api, ctx, 'cobre', a), funcao: funcaoPresa(ctx, a[0]), muda: 'acumulo:' + a[0]
      });
    });

    /* os do admin, na ordem da lista; no fim, o novo */
    acs.forEach(function (e, i) { if (unidas.indexOf(i) < 0) cartaoDoAdmin(u, api, ctx, i); });
    cartaoNovo(u, api, ctx);
    P().erros(ctx, 'sempre').concat(P().erros(ctx, 'cobre')).forEach(function (e) { P().erroCampo(u, e); });

    /* o acúmulo novo já abre, só com a função e a regra */
    var botao = P().tpl('novo-acumulo');
    botao.disabled = ctx.soLeitura || !!novo;
    botao.addEventListener('click', function () {
      novo = { unidade: api.unidadeId(), lado: ctx.lado, funcao: '' };
      api.abrir(ctx.lado + ':novo');
    });
    u.appendChild(botao);
  }

  window.RosterWork.novaDistribuicaoAcumulos = {
    acumulos: acumulos,
    /* as regras automáticas do banco (a Ordem de importância põe as acumuladas na linha de quem acumula) */
    automaticas: automaticas
  };
})();
