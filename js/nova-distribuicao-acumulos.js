/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 5 do questionário: Acúmulos
   Um cartão por função: a função, a regra (Sempre: é sempre da mesma
   pessoa; Se faltar: quem cobre quando ela fica sem gente) e quem, em
   ordem, com as setas e a lixeira; a última linha é sempre a "Fica
   vazia", e escolher alguém nela abre outra embaixo. Os dados seguem
   em duas listas (respostas.sempre e respostas.cobre): trocar a regra
   passa a linha de uma para a outra. As regras automáticas vêm do
   banco, travadas; a do Condutor aceita as outras opções do admin.
   Toda mudança passa pelo api.mudar (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  /* o cartão novo antes de escolher a regra: fica fora das respostas ({ unidade, lado, funcao }) */
  var novo = null;

  /* quantos itens da lista estão salvos: o novo (ainda não salvo) não acusa o que falta antes do Salvar */
  function gravadas(api, chave) { return ((((api.dados() || {}).atual || {}).respostas || {})[chave] || []).length; }

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

  /* ---------- a regra automática do Condutor ---------- */

  /* a regra automática do Condutor aceita as outras opções do admin: elas ficam na linha das respostas com a
     mesma função, junto com a função especial (no Sempre, sempre a 1ª; no Se faltar, onde o admin puser) */
  function condutorAuto(ctx) { return (ctx.calc && ctx.calc.automaticas && ctx.calc.automaticas.condutor) || ''; }

  function indiceAuto(lista, nome) {
    for (var k = 0; k < (lista || []).length; k++) if ((lista[k] || [])[0] === nome) return k;
    return -1;
  }

  /* movel = a função especial sobe e desce (Se faltar); sem ela na linha, entra na 1ª */
  function linhaAuto(lista, a, movel) {
    var k = indiceAuto(lista, a[0]);
    if (k < 0) return a.slice();
    var resto = lista[k].slice(1);
    if (movel && resto.indexOf(a[1]) >= 0) return [a[0]].concat(resto);
    return [a[0], a[1]].concat(resto.filter(function (x) { return x !== a[1]; }));
  }

  /* muda as outras opções da regra automática; sem nenhuma, a linha sai das respostas */
  function mudarAuto(api, ctx, tipo, a) {
    return function (fn) {
      api.mudar(ctx.lado, function (x) {
        var k = indiceAuto(x[tipo], a[0]);
        var linha = linhaAuto(x[tipo], a, tipo === 'cobre');
        fn(linha);
        if (k < 0) { if (linha.length > 2) x[tipo].push(linha); }
        else if (linha.length > 2) x[tipo][k] = linha;
        else x[tipo].splice(k, 1);
      });
    };
  }

  /* ---------- quem: as linhas do cartão ---------- */

  /* as funções que o cartão pode escolher: as da unidade, fora as especiais, as das regras automáticas e as que já
     têm cartão (fica a dele) */
  function funcoesLivres(ctx, atual) {
    var usadas = automaticas(ctx, 'sempre').concat(automaticas(ctx, 'cobre'), ctx.resp.sempre || [], ctx.resp.cobre || [])
      .map(function (s) { return s[0]; });
    return ((ctx.calc && ctx.calc.funcoes) || []).filter(function (f) {
      return !f.papel && (f.nome === atual || usadas.indexOf(f.nome) < 0);
    }).map(function (f) { return f.nome; });
  }

  /* as linhas de quem: as escolhidas e, no fim, a vaga (a "Fica vazia"; sem nenhuma escolhida, a 1ª pede a escolha) */
  function vagas(linha) {
    var v = linha.slice(1);
    if (!v.length || v[v.length - 1]) v.push('');
    return v;
  }

  /* as linhas de quem (linha = [função, 1ª, 2ª...]), com as setas e a lixeira; mudar(fn) muda a linha nas respostas.
     Só funções de outro posto. auto = a regra automática: a função especial travada e sem lixeira, no Sempre sempre a
     1ª ({ fixa }), no Se faltar sobe e desce ({ papel }) */
  function opcoes(caixa, ctx, linha, tipo, falta, mudar, auto) {
    auto = auto || {};
    var lista = caixa.querySelector('.nova-distribuicao-regra-lista');
    var linhas = vagas(linha);
    var total = linhas.length - 1;   /* as escolhidas (a última é a vaga) */
    var posto = linha[0] ? P().partes(linha[0]).posto : '';
    var inicio = auto.fixa ? 1 : 0;  /* as que andam começam depois da fixa */
    linhas.forEach(function (s, j) {
      var item = P().tpl('opcao');
      var rotulo = j === 0 ? (tipo === 'sempre' ? M().rotuloMesmo : M().rotuloCobre) : (j === 1 ? M().rotuloSeFaltar : M().rotuloTambem);
      var presa = (!!auto.fixa && j === 0) || (!!auto.papel && s === auto.papel);
      var vaga = j === total;
      item.querySelector('.nova-distribuicao-regra-rotulo').textContent = rotulo;
      var outros = linha.filter(function (x, k) { return k !== j + 1; });
      var podem = presa ? [s] : P().proprias(ctx).filter(function (nome) {
        return outros.indexOf(nome) < 0 && (!posto || P().partes(nome).posto !== posto);
      });
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
      lista.appendChild(item);
    });
  }

  /* ---------- o cartão ---------- */

  /* fechado, a função no título e a regra em frase; aberto, a função, a regra (Sempre ou Se faltar), quem e o Remover
     acúmulo. A regra automática tem a função, a regra e a função especial travadas, a trava e não tem Remover acúmulo.
     d = { id, tipo ('sempre' | 'cobre'; '' no novo), linha, chave, falta, auto (o das opções), mudar, funcao, trocar,
     remover, muda } */
  function cartaoAcumulo(u, api, ctx, d) {
    var erros = d.chave ? P().erros(ctx, d.chave) : [];
    var quem = d.linha.slice(1).filter(Boolean);
    var linhas = (d.linha[0] && quem.length
      ? [P().texto(d.tipo === 'sempre' ? M().fraseSempre : M().fraseFalta,
                   { funcao: P().completo(ctx, d.linha[0]), quem: P().completo(ctx, quem[0]) })]
          .concat(quem.slice(1).map(function (s) { return P().texto(M().fraseReserva, { quem: P().completo(ctx, s) }); }))
      : [{ texto: M().opcoesIncompletas, falta: d.falta }])
      .concat(erros.map(function (e) { return { texto: e, falta: true }; }));
    var titulo = d.linha[0] ? P().completo(ctx, d.linha[0]) : M().semFuncao;
    P().cartao(u, api, ctx, d.id, titulo, linhas, function (lugar) {
      var conteudo = P().tpl('acumulo');
      conteudo.querySelector('[data-espaco="funcao"]').appendChild(d.funcao());
      P().bolinhas(conteudo.querySelector('.nova-distribuicao-opcoes--lado'), ctx.lado + '-regra-' + d.id,
        function (v) { return v === d.tipo; }, d.trocar || function () {}, ctx.soLeitura || !!d.auto);
      if (d.tipo) opcoes(conteudo, ctx, d.linha, d.tipo, d.falta, d.mudar, d.auto);
      var tirarTudo = conteudo.querySelector('.nova-distribuicao-remover-acumulo');
      tirarTudo.classList.toggle('oculto', !!d.auto);
      tirarTudo.disabled = ctx.soLeitura;
      if (d.remover) tirarTudo.addEventListener('click', d.remover);
      var frases = erros.slice();
      if (d.falta) frases.unshift(d.auto ? M().opcoesVazias : M().opcoesIncompletas);
      frases.forEach(function (e) { P().erroCampo(conteudo, e); });
      if (d.auto) conteudo.appendChild(P().tpl('trava-funcoes'));
      lugar.appendChild(conteudo);
    }, d.falta || erros.length > 0, d.muda ? { muda: d.muda } : null);
  }

  /* a função travada da regra automática */
  function funcaoPresa(ctx, nome) {
    return function () { return P().selecaoFuncoes(ctx, [nome], nome, function () {}, { rotulo: M().rotuloFuncao, travado: true }); };
  }

  /* um cartão do admin: a linha i da lista do tipo */
  function cartaoDoAdmin(u, api, ctx, tipo, i) {
    var s = ctx.resp[tipo][i];
    var falta = i < gravadas(api, tipo) && P().pendente(ctx, tipo + ':' + i);
    cartaoAcumulo(u, api, ctx, {
      id: tipo + '-' + i, tipo: tipo, linha: s, chave: tipo + ':' + i, falta: falta, auto: null,
      muda: tipo === 'cobre' && s[0] ? 'cobre:' + s[0] : '',
      mudar: function (fn) { api.mudar(ctx.lado, function (x) { fn(x[tipo][i]); }); },
      funcao: function () {
        return P().selecaoFuncoes(ctx, funcoesLivres(ctx, s[0]), s[0], function (v) {
          api.mudar(ctx.lado, function (x) { x[tipo][i][0] = v; });
        }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura, erro: falta && !s[0] });
      },
      /* a outra regra: a linha passa para a outra lista, e o cartão continua aberto */
      trocar: function (v) {
        if (v === tipo) return;
        var n = (ctx.resp[v] || []).length;
        api.mudar(ctx.lado, function (x) {
          var linha = x[tipo].splice(i, 1)[0];
          x[v] = x[v] || [];
          x[v].push(linha);
        }, ctx.lado + ':' + v + '-' + n);
      },
      /* fecha o cartão antes de tirar a linha: os de baixo sobem de posição */
      remover: function () {
        api.abrir(ctx.lado + ':' + tipo + '-' + i);
        api.mudar(ctx.lado, function (x) { x[tipo].splice(i, 1); });
      }
    });
  }

  /* o cartão novo: aberto, a função e a regra; ao escolher a regra, a linha entra nas respostas */
  function cartaoNovo(u, api, ctx) {
    if (!novo) return;
    if (novo.unidade !== api.unidadeId() || novo.lado !== ctx.lado || api.aberto() !== ctx.lado + ':novo') { novo = null; return; }
    cartaoAcumulo(u, api, ctx, {
      id: 'novo', tipo: '', linha: [novo.funcao], chave: '', falta: false, auto: null,
      funcao: function () {
        return P().selecaoFuncoes(ctx, funcoesLivres(ctx, novo.funcao), novo.funcao, function (v) {
          novo.funcao = v;
          api.redesenhar();
        }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura });
      },
      trocar: function (v) {
        var n = (ctx.resp[v] || []).length;
        var funcao = novo.funcao;
        novo = null;
        api.mudar(ctx.lado, function (x) { x[v] = x[v] || []; x[v].push([funcao]); }, ctx.lado + ':' + v + '-' + n);
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
    var unidas = { sempre: [], cobre: [] };

    /* as regras automáticas: as frases travadas e o cartão do Condutor */
    automaticas(ctx, 'sempre').forEach(function (a) {
      if (a[0] !== condutor) {
        automatica(u, P().texto(M().automaticaSempre, { funcao: P().completo(ctx, a[0]), quem: P().completo(ctx, a[1]) }));
        return;
      }
      var k = indiceAuto(ctx.resp.sempre, a[0]);
      if (k >= 0) unidas.sempre.push(k);
      cartaoAcumulo(u, api, ctx, {
        id: 'sempre-auto', tipo: 'sempre', linha: linhaAuto(ctx.resp.sempre, a),
        chave: k >= 0 ? 'sempre:' + k : '', falta: k >= 0 && k < gravadas(api, 'sempre') && P().pendente(ctx, 'sempre:' + k),
        auto: { fixa: true }, mudar: mudarAuto(api, ctx, 'sempre', a), funcao: funcaoPresa(ctx, a[0])
      });
    });
    automaticas(ctx, 'cobre').forEach(function (a) {
      var k = indiceAuto(ctx.resp.cobre, a[0]);
      if (k >= 0) unidas.cobre.push(k);
      cartaoAcumulo(u, api, ctx, {
        id: 'cobre-auto', tipo: 'cobre', linha: linhaAuto(ctx.resp.cobre, a, true),
        chave: k >= 0 ? 'cobre:' + k : '', falta: k >= 0 && k < gravadas(api, 'cobre') && P().pendente(ctx, 'cobre:' + k),
        auto: { papel: a[1] }, mudar: mudarAuto(api, ctx, 'cobre', a), funcao: funcaoPresa(ctx, a[0]), muda: 'cobre:' + a[0]
      });
    });

    /* os do admin: os de Sempre e depois os de Se faltar; no fim, o novo */
    ['sempre', 'cobre'].forEach(function (tipo) {
      (ctx.resp[tipo] || []).forEach(function (s, i) {
        if (unidas[tipo].indexOf(i) < 0) cartaoDoAdmin(u, api, ctx, tipo, i);
      });
    });
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
