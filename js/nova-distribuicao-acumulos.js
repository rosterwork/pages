/* ============================================================
   NOVA DISTRIBUIÇÃO — blocos 4 e 5 do questionário
   Acúmulos fixos e Acúmulos por falta: um cartão por acúmulo
   (fechado, as opções em texto; aberto, a função, de 1 a 5 opções
   de outro posto com as setas, Adicionar opção e Remover acúmulo).
   As regras automáticas vêm do banco, travadas; a do Condutor
   aceita as outras opções do admin. Toda mudança passa pelo
   api.mudar (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

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

  /* ---------- as opções dos acúmulos (fixos e por falta) ---------- */

  /* a regra automática do Condutor aceita as outras opções do admin: elas ficam na linha das respostas com a
     mesma função, junto com a função especial (no acúmulo fixo, sempre a 1ª; no por falta, onde o admin puser) */
  function condutorAuto(ctx) { return (ctx.calc && ctx.calc.automaticas && ctx.calc.automaticas.condutor) || ''; }

  function indiceAuto(lista, nome) {
    for (var k = 0; k < (lista || []).length; k++) if ((lista[k] || [])[0] === nome) return k;
    return -1;
  }

  /* movel = a função especial sobe e desce (por falta); sem ela na linha, entra na 1ª */
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

  /* as linhas 1ª, 2ª... (até 5), com as setas, e o Adicionar opção; linha = [função, 1ª, 2ª...]; mudar(fn) muda
     a linha nas respostas. Só funções de outro posto; a 1ª opção não tem lixeira. auto = a regra automática: a
     função especial fica travada e sem lixeira, no acúmulo fixo sempre a 1ª ({ fixa }), no por falta sobe e
     desce ({ papel }) */
  function opcoes(caixa, ctx, linha, falta, mudar, auto) {
    auto = auto || {};
    var lista = caixa.querySelector('.nova-distribuicao-regra-lista');
    var escolhas = linha.slice(1);
    if (!escolhas.length) escolhas = [''];
    var posto = linha[0] ? P().partes(linha[0]).posto : '';
    var inicio = auto.fixa ? 1 : 0;   /* as que andam começam depois da fixa */
    escolhas.forEach(function (s, j) {
      var item = P().tpl('opcao');
      var rotulo = P().texto(M().opcaoN, { n: j + 1 });
      var presa = (!!auto.fixa && j === 0) || (!!auto.papel && s === auto.papel);
      item.querySelector('.nova-distribuicao-regra-rotulo').textContent = rotulo;
      var outros = linha.filter(function (x, k) { return k !== j + 1; });
      var podem = presa ? [s] : P().proprias(ctx).filter(function (nome) {
        return outros.indexOf(nome) < 0 && (!posto || P().partes(nome).posto !== posto);
      });
      item.querySelector('.nova-distribuicao-espaco').appendChild(P().selecaoFuncoes(ctx, podem, s, function (v) {
        mudar(function (l) { l[j + 1] = v; });
      }, { rotulo: rotulo, travado: ctx.soLeitura || presa, erro: falta && !s }));
      item.querySelector('.nova-distribuicao-opcao-setas').classList.toggle('oculto', j < inicio || escolhas.length - inicio < 2);
      P().setas(item, j - inicio, escolhas.length - inicio, function (passo) {
        mudar(function (l) { P().mover(l, j + 1, passo); });
      }, ctx.soLeitura);
      var tirar = item.querySelector('.nova-distribuicao-remover');
      tirar.disabled = ctx.soLeitura;
      tirar.classList.toggle('oculto', presa || j === 0);
      tirar.addEventListener('click', function () { mudar(function (l) { l.splice(j + 1, 1); }); });
      lista.appendChild(item);
    });
    var mais = caixa.querySelector('.nova-distribuicao-adicionar');
    mais.disabled = ctx.soLeitura || escolhas.length >= 5;
    mais.addEventListener('click', function () {
      mudar(function (l) { while (l.length < escolhas.length + 1) l.push(''); l.push(''); });
    });
  }

  /* o cartão de um acúmulo, fechado com as opções em texto (e os erros); aberto, o molde com a função, as opções,
     Adicionar opção e Remover acúmulo. A regra automática tem a função e a 1ª opção travadas, a trava e não tem
     Remover acúmulo. d = { id, molde, titulo, linha, chave, falta, auto (o das opções), mudar, funcao, remover, muda } */
  function cartaoAcumulo(u, api, ctx, d) {
    var erros = d.chave ? P().erros(ctx, d.chave) : [];
    var escolhas = d.linha.slice(1);
    if (!escolhas.length) escolhas = [''];
    var linhas = escolhas.map(function (s, j) {
      return s ? P().texto(M().opcaoLinha, { n: j + 1, quem: P().completo(ctx, s) })
               : { texto: P().texto(M().opcaoSemResposta, { n: j + 1 }), falta: d.falta };
    }).concat(erros.map(function (e) { return { texto: e, falta: true }; }));
    P().cartao(u, api, ctx, d.id, d.titulo, linhas, function (lugar) {
      var conteudo = P().tpl(d.molde);
      conteudo.querySelector('[data-espaco="funcao"]').appendChild(d.funcao());
      opcoes(conteudo, ctx, d.linha, d.falta, d.mudar, d.auto);
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

  /* o título do cartão fechado: a frase com a função, ou "Escolha a função" */
  function titulo(ctx, modelo, nome) { return nome ? P().texto(modelo, { funcao: P().completo(ctx, nome) }) : M().semFuncao; }

  /* ---------- 4. Acúmulos fixos ---------- */
  function acumulos(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-acumulos'));
    var u = P().unidade(corpo, ctx);
    var salvos = gravadas(api, 'sempre');
    var condutor = condutorAuto(ctx);
    var unida = -1;
    var autos = automaticas(ctx, 'sempre');
    autos.forEach(function (a) {
      if (a[0] !== condutor) {
        automatica(u, P().texto(M().automaticaSempre, { funcao: P().completo(ctx, a[0]), quem: P().completo(ctx, a[1]) }));
        return;
      }
      unida = indiceAuto(ctx.resp.sempre, a[0]);
      cartaoAcumulo(u, api, ctx, {
        id: 'sempre-auto', molde: 'acumulo', titulo: titulo(ctx, M().tituloFixo, a[0]), linha: linhaAuto(ctx.resp.sempre, a),
        chave: unida >= 0 ? 'sempre:' + unida : '', falta: unida >= 0 && unida < salvos && P().pendente(ctx, 'sempre:' + unida),
        auto: { fixa: true }, mudar: mudarAuto(api, ctx, 'sempre', a), funcao: funcaoPresa(ctx, a[0])
      });
    });
    P().marcarMuda(u, ctx, 'sempre');
    var travadas = autos.map(function (a) { return a[0]; });
    var podem = ((ctx.calc && ctx.calc.funcoes) || []).filter(function (f) {
      return !f.papel && travadas.indexOf(f.nome) < 0;
    }).map(function (f) { return f.nome; });

    (ctx.resp.sempre || []).forEach(function (s, i) {
      if (i === unida) return;
      var falta = i < salvos && P().pendente(ctx, 'sempre:' + i);
      cartaoAcumulo(u, api, ctx, {
        id: 'sempre-' + i, molde: 'acumulo', titulo: titulo(ctx, M().tituloFixo, s[0]), linha: s,
        chave: 'sempre:' + i, falta: falta, auto: null,
        mudar: function (fn) { api.mudar(ctx.lado, function (x) { fn(x.sempre[i]); }); },
        funcao: function () {
          return P().selecaoFuncoes(ctx, podem, s[0], function (v) {
            api.mudar(ctx.lado, function (x) { x.sempre[i][0] = v; });
          }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura, erro: falta && !s[0] });
        },
        /* fecha o cartão antes de tirar a linha: os de baixo sobem de posição */
        remover: function () {
          api.abrir(ctx.lado + ':sempre-' + i);
          api.mudar(ctx.lado, function (x) { x.sempre.splice(i, 1); });
        }
      });
    });
    P().erros(ctx, 'sempre').forEach(function (e) { P().erroCampo(u, e); });

    /* o acúmulo novo já abre */
    var novo = P().tpl('novo-acumulo');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () {
      var n = (ctx.resp.sempre || []).length;
      api.mudar(ctx.lado, function (x) { x.sempre.push(['', '']); }, ctx.lado + ':sempre-' + n);
    });
    u.appendChild(novo);
  }

  /* ---------- 5. Acúmulos por falta ---------- */
  function porFalta(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-por-falta'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'cobre');
    var salvos = gravadas(api, 'cobre');
    var unidas = [];
    var autos = automaticas(ctx, 'cobre');
    autos.forEach(function (a) {
      var k = indiceAuto(ctx.resp.cobre, a[0]);
      if (k >= 0) unidas.push(k);
      cartaoAcumulo(u, api, ctx, {
        id: 'cobre-auto', molde: 'por-falta', titulo: titulo(ctx, M().tituloPorFalta, a[0]), linha: linhaAuto(ctx.resp.cobre, a, true),
        chave: k >= 0 ? 'cobre:' + k : '', falta: k >= 0 && k < salvos && P().pendente(ctx, 'cobre:' + k),
        auto: { papel: a[1] }, mudar: mudarAuto(api, ctx, 'cobre', a), funcao: funcaoPresa(ctx, a[0]), muda: 'cobre:' + a[0]
      });
    });
    var travadas = autos.map(function (a) { return a[0]; });
    var podem = (ctx.resp.ordem || []).filter(function (nome) { return travadas.indexOf(nome) < 0; });
    (ctx.resp.cobre || []).forEach(function (regra, i) {
      if (unidas.indexOf(i) >= 0) return;
      var falta = i < salvos && P().pendente(ctx, 'cobre:' + i);
      cartaoAcumulo(u, api, ctx, {
        id: 'cobre-' + i, molde: 'por-falta', titulo: titulo(ctx, M().tituloPorFalta, regra[0]), linha: regra,
        chave: 'cobre:' + i, falta: falta, auto: null, muda: regra[0] ? 'cobre:' + regra[0] : '',
        mudar: function (fn) { api.mudar(ctx.lado, function (x) { fn(x.cobre[i]); }); },
        funcao: function () {
          return P().selecaoFuncoes(ctx, podem, regra[0], function (v) {
            api.mudar(ctx.lado, function (x) { x.cobre[i][0] = v; });
          }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura, erro: falta && !regra[0] });
        },
        remover: function () {
          api.abrir(ctx.lado + ':cobre-' + i);
          api.mudar(ctx.lado, function (x) { x.cobre.splice(i, 1); });
        }
      });
    });
    var novo = P().tpl('novo-por-falta');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () {
      var n = (ctx.resp.cobre || []).length;
      api.mudar(ctx.lado, function (x) { x.cobre.push(['', '']); }, ctx.lado + ':cobre-' + n);
    });
    u.appendChild(novo);
  }

  window.RosterWork.novaDistribuicaoAcumulos = {
    acumulos: acumulos, porFalta: porFalta,
    /* as regras automáticas do banco (a Ordem de importância põe as acumuladas na linha de quem acumula) */
    automaticas: automaticas
  };
})();
