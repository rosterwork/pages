/* ============================================================
   NOVA DISTRIBUIÇÃO — blocos 1 a 6 do questionário
   Monta as perguntas a partir dos moldes de nova-distribuicao.html,
   com as respostas da unidade e o que o banco calculou (cadeiras,
   postos, regras automáticas, graus). Toda mudança passa pelo
   api.mudar (nova-distribuicao.js), que recalcula e redesenha.
   As peças (pergunta, campo de seleção, número) ficam em
   RosterWork.novaDistribuicaoBlocos.pecas para o Conferir.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }

  /* ---------- peças ---------- */

  function tpl(nome) { return RosterWork.tpl('tpl-nova-distribuicao-' + nome); }

  function texto(modelo, valores) {
    return Object.keys(valores || {}).reduce(function (t, k) { return t.split('{' + k + '}').join(valores[k]); }, modelo || '');
  }

  /* "a, b e c" */
  function lista(itens) {
    if (itens.length < 2) return itens[0] || '';
    return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
  }

  function mover(arr, i, passo) {
    var j = i + passo;
    if (j < 0 || j >= arr.length) return;
    var guardado = arr[i];
    arr[i] = arr[j];
    arr[j] = guardado;
  }

  /* campo de seleção com opções que vêm dos dados: itens = [{ valor, texto }] */
  function selecao(itens, atual, aoEscolher, rotulo, vazio, travado) {
    var caixa = tpl('selecao');
    var gatilho = caixa.querySelector('.campo-selecao');
    var menu = caixa.querySelector('.dropdown-menu');
    var escolhido = itens.filter(function (o) { return o.valor === atual; })[0];
    gatilho.setAttribute('aria-label', rotulo || '');
    gatilho.querySelector('.campo-selecao-texto').textContent = escolhido ? escolhido.texto : (vazio || '');
    gatilho.querySelector('.campo-selecao-texto').classList.toggle('campo-selecao-texto--vazio', !escolhido);
    gatilho.disabled = !!travado;
    itens.forEach(function (o) {
      var item = tpl('selecao-item');
      item.textContent = o.texto;
      if (o.valor === atual) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () { if (o.valor !== atual) aoEscolher(o.valor); });
      menu.appendChild(item);
    });
    return caixa;
  }

  /* campo de seleção com as opções escritas no molde (gravidade, praça/oficial, sentido) */
  function selecaoFixa(nome, atual, aoEscolher, travado) {
    var caixa = tpl(nome);
    var gatilho = caixa.querySelector('.campo-selecao');
    gatilho.disabled = !!travado;
    caixa.querySelectorAll('.dropdown-item').forEach(function (item) {
      var valor = item.getAttribute('data-valor');
      if (valor === String(atual)) {
        item.classList.add('dropdown-item--ativo');
        gatilho.querySelector('.campo-selecao-texto').textContent = item.textContent;
      }
      item.addEventListener('click', function () { if (valor !== String(atual)) aoEscolher(valor); });
    });
    return caixa;
  }

  /* campo de número (componente geral-dropdown-numeros) */
  function numero(de, ate, atual, aoEscolher, rotulo, travado) {
    var caixa = tpl('numero');
    var gatilho = caixa.querySelector('.campo-selecao');
    var opcoes = [];
    for (var n = de; n <= ate; n++) opcoes.push(n);
    gatilho.setAttribute('aria-label', rotulo || '');
    gatilho.querySelector('.campo-selecao-texto').textContent = String(atual);
    gatilho.disabled = !!travado;
    RosterWork.dropdownNumeros.preencher(caixa.querySelector('.dropdown-menu'), {
      opcoes: opcoes, valor: atual, aoEscolher: function (v) { if (v !== atual) aoEscolher(v); }
    });
    return caixa;
  }

  /* bolinhas (ou quadrados) do molde: marca a atual e avisa a escolhida */
  function marcarOpcoes(caixa, nomeGrupo, marcado, aoMudar, travado) {
    caixa.querySelectorAll('input[data-valor]').forEach(function (inp) {
      var valor = inp.getAttribute('data-valor');
      if (inp.type === 'radio') inp.name = nomeGrupo;
      inp.checked = marcado(valor);
      inp.disabled = !!travado;
      inp.addEventListener('change', function () { aoMudar(valor, inp.checked); });
    });
    return caixa;
  }

  /* pergunta fechada (resposta embaixo) que abre as opções ao clicar */
  function pergunta(corpo, api, ctx, id, titulo, resposta, vazia, montar) {
    var caixa = tpl('pergunta');
    var cab = caixa.querySelector('.nova-distribuicao-pergunta-cabecalho');
    var aberta = api.aberto() === ctx.lado + ':' + id;
    caixa.querySelector('.nova-distribuicao-pergunta-titulo').textContent = titulo;
    var res = caixa.querySelector('.nova-distribuicao-pergunta-resposta');
    res.textContent = resposta;
    res.classList.toggle('nova-distribuicao-pergunta-resposta--vazia', !!vazia);
    cab.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    cab.addEventListener('click', function () { api.abrir(ctx.lado + ':' + id); });
    if (aberta) {
      var opcoes = caixa.querySelector('.nova-distribuicao-pergunta-opcoes');
      opcoes.classList.remove('oculto');
      res.classList.add('oculto');
      montar(opcoes);
    }
    corpo.appendChild(caixa);
    return caixa;
  }

  /* pergunta que não abre: a resposta é escolhida na própria frase */
  function fixa(corpo, titulo, montar) {
    var caixa = tpl('pergunta-fixa');
    var tit = caixa.querySelector('.nova-distribuicao-pergunta-titulo');
    if (titulo) tit.textContent = titulo; else tit.classList.add('oculto');
    montar(caixa.querySelector('.nova-distribuicao-pergunta-conteudo'));
    corpo.appendChild(caixa);
    return caixa;
  }

  function grupo(corpo, ctx, separado) {
    var g = tpl('grupo');
    g.querySelector('.nova-distribuicao-grupo-nome').textContent = ctx.nome;
    g.querySelector(ctx.ehCia ? '.nova-distribuicao-grupo-compartilhado' : '.nova-distribuicao-grupo-proprio').classList.remove('oculto');
    if (separado) g.classList.add('nova-distribuicao-grupo--separado');
    corpo.appendChild(g);
  }

  function posto(corpo, nome) {
    var p = tpl('posto');
    p.textContent = nome;
    corpo.appendChild(p);
  }

  function setas(linha, indice, total, aoMover, travado) {
    var subir = linha.querySelector('.nova-distribuicao-subir');
    var descer = linha.querySelector('.nova-distribuicao-descer');
    subir.disabled = !!travado || indice === 0;
    descer.disabled = !!travado || indice === total - 1;
    subir.addEventListener('click', function () { aoMover(-1); });
    descer.addEventListener('click', function () { aoMover(1); });
  }

  function trava(caixa, frase) {
    var t = tpl('trava');
    t.querySelector('.nova-distribuicao-trava-texto').textContent = frase;
    caixa.appendChild(t);
  }

  function gravidade(api, ctx, nome) {
    var g = ctx.resp.gravidade || {};
    var linha = tpl('gravidade-linha');
    linha.querySelector('.nova-distribuicao-espaco').appendChild(selecaoFixa('gravidade', g[nome] == null ? 2 : g[nome], function (v) {
      api.mudar(ctx.lado, function (x) { x.gravidade[nome] = Number(v); });
    }, ctx.soLeitura));
    return linha;
  }

  function itensDe(nomes) { return nomes.map(function (n) { return { valor: n, texto: n }; }); }
  function papel(ctx) { return (ctx.calc && ctx.calc.papel) || ''; }
  function proprias(ctx) { return (papel(ctx) ? [papel(ctx)] : []).concat(ctx.resp.ordem || []); }

  /* ---------- 1. Postos ---------- */
  function postos(corpo, ctx, api) {
    var r = ctx.resp;
    var calc = ctx.calc || {};
    var nomesInst = (r.instalacoes || []).map(function (i) { return i.nome; });
    grupo(corpo, ctx);

    pergunta(corpo, api, ctx, 'instalacoes', ctx.ehCia ? M().instalacoesCompanhia : M().instalacoesPelotao,
      lista(nomesInst) || M().nenhuma, false, function (caixa) {
        caixa.appendChild(marcarOpcoes(tpl('instalacoes'), '', function (v) { return nomesInst.indexOf(v) >= 0; }, function (nome, marcado) {
          api.mudar(ctx.lado, function (x) {
            if (marcado) x.instalacoes.push({ nome: nome, efetivo: [1, 1, 1] });
            else x.instalacoes = x.instalacoes.filter(function (i) { return i.nome !== nome; });
          });
        }, ctx.soLeitura));
      });

    pergunta(corpo, api, ctx, 'viaturas', ctx.ehCia ? M().viaturasCompanhia : M().viaturasPelotao,
      (r.viaturas || []).map(function (v, i) { return texto(M().ordemItem, { n: i + 1, cadeira: v.nome }); }).join(' · ') || M().nenhuma,
      !(r.viaturas || []).length, function (caixa) {
        caixa.appendChild(tpl('nota-viaturas'));
        r.viaturas.forEach(function (v, i) {
          var linha = tpl('viatura');
          var campo = linha.querySelector('.nova-distribuicao-viatura-nome');
          linha.querySelector('.nova-distribuicao-linha-ordem').textContent = (i + 1) + 'º';
          campo.value = v.nome;
          campo.disabled = ctx.soLeitura;
          campo.addEventListener('change', function () {
            var novo = campo.value.trim();
            if (!novo || novo === v.nome) { campo.value = v.nome; return; }
            api.renomear(ctx.lado, v.nome, novo);
          });
          setas(linha, i, r.viaturas.length, function (passo) {
            api.mudar(ctx.lado, function (x) { mover(x.viaturas, i, passo); });
          }, ctx.soLeitura);
          var remover = linha.querySelector('.nova-distribuicao-remover');
          remover.disabled = ctx.soLeitura;
          remover.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); }); });
          caixa.appendChild(linha);
        });
        var nova = tpl('nova-viatura');
        nova.disabled = ctx.soLeitura;
        nova.addEventListener('click', function () {
          api.mudar(ctx.lado, function (x) {
            var k = 1;
            while (x.viaturas.some(function (o) { return o.nome === texto(M().novaViatura, { n: k }); })) k++;
            x.viaturas.push({ nome: texto(M().novaViatura, { n: k }), cnh: 'B', efetivo: [1, 1, 2] });
          });
        });
        caixa.appendChild(nova);
      });

    /* o efetivo de cada posto (frase com os números) e as cadeiras que saem dele */
    function efetivo(caixa, item, achar) {
      var frase = tpl('efetivo');
      [0, 1, 2].forEach(function (k) {
        frase.querySelector('[data-espaco="' + k + '"]').appendChild(numero(k === 0 ? 0 : 1, 10, item.efetivo[k], function (v) {
          api.mudar(ctx.lado, function (x) { var alvo = achar(x); if (alvo) alvo.efetivo[k] = v; });
        }, '', ctx.soLeitura));
      });
      frase.querySelector('.nova-distribuicao-cadeiras').textContent = lista((calc.cadeiras || [])
        .filter(function (c) { return c.posto === item.nome; }).map(function (c) { return c.funcao; }));
      caixa.appendChild(frase);
    }

    (r.instalacoes || []).forEach(function (inst) {
      posto(corpo, inst.nome);
      fixa(corpo, M().instalacaoQuantos[inst.nome] || inst.nome, function (caixa) {
        efetivo(caixa, inst, function (x) { return x.instalacoes.filter(function (o) { return o.nome === inst.nome; })[0]; });
      });
    });
    (r.viaturas || []).forEach(function (v, i) {
      posto(corpo, v.nome);
      pergunta(corpo, api, ctx, 'carteira-' + i, texto(M().carteira, { posto: v.nome }), texto(M().carteiraResposta, { cnh: v.cnh }), false, function (caixa) {
        caixa.appendChild(marcarOpcoes(tpl('carteira'), 'nova-distribuicao-carteira', function (c) { return c === v.cnh; }, function (c) {
          api.mudar(ctx.lado, function (x) { x.viaturas[i].cnh = c; });
        }, ctx.soLeitura));
      });
      fixa(corpo, texto(M().efetivoViatura, { posto: v.nome }), function (caixa) {
        efetivo(caixa, v, function (x) { return x.viaturas[i]; });
      });
    });
  }

  /* ---------- 2. Funções especiais (no pelotão, a companhia vem junto) ---------- */
  function funcoes(corpo, ctxs, api) {
    corpo.appendChild(tpl('nota-funcoes'));
    ctxs.forEach(function (ctx, n) {
      grupo(corpo, ctx, n > 0);
      if (ctx.semDados) {
        var vazio = tpl('companhia-sem-respostas');
        vazio.querySelector('.nova-distribuicao-copiar').addEventListener('click', function () { api.copiarCompanhia(); });
        corpo.appendChild(vazio);
        return;
      }
      var r = ctx.resp;
      var lugares = (ctx.calc && ctx.calc.postos) || [];
      var funcao = ctx.calc.papel_funcao;
      var onde = r.papel && r.papel.posto;
      pergunta(corpo, api, ctx, 'papel', texto(M().ondeFica, { papel: funcao }), onde || M().semResposta, !onde, function (caixa) {
        lugares.forEach(function (p) {
          var op = tpl('opcao');
          var inp = op.querySelector('input');
          inp.name = 'nova-distribuicao-papel-' + ctx.lado;
          inp.checked = p.nome === onde;
          inp.disabled = ctx.soLeitura;
          op.querySelector('.nova-distribuicao-opcao-texto').textContent = p.nome;
          inp.addEventListener('change', function () { api.mudar(ctx.lado, function (x) { x.papel.posto = p.nome; }); });
          caixa.appendChild(op);
        });
      });
      var ehViatura = lugares.some(function (p) { return p.nome === onde && p.tipo === 'viatura'; });
      if (ehViatura) {
        pergunta(corpo, api, ctx, 'condutor', texto(M().podeConduzir, { papel: funcao }), M().condutor[r.papel.condutor], false, function (caixa) {
          caixa.appendChild(marcarOpcoes(tpl('condutor'), 'nova-distribuicao-condutor-' + ctx.lado, function (v) { return Number(v) === r.papel.condutor; }, function (v) {
            api.mudar(ctx.lado, function (x) { x.papel.condutor = Number(v); });
          }, ctx.soLeitura));
        });
      }
      if (ctx.ehCia) {
        var sem = r.sem_oficial;
        pergunta(corpo, api, ctx, 'sem-oficial', M().semOficial, sem == null ? M().semResposta : M().semOficialOpcoes[sem], sem == null, function (caixa) {
          caixa.appendChild(marcarOpcoes(tpl('sem-oficial'), 'nova-distribuicao-sem-oficial', function (v) { return Number(v) === sem; }, function (v) {
            api.mudar(ctx.lado, function (x) { x.sem_oficial = Number(v); });
          }, ctx.soLeitura));
        });
      }
    });
  }

  /* regra automática: a frase, a trava e (no acúmulo) a gravidade */
  function automatica(corpo, frase, extra) {
    var caixa = tpl('automatica');
    caixa.querySelector('.nova-distribuicao-automatica-texto').textContent = frase;
    var lugar = caixa.querySelector('.nova-distribuicao-automatica-extra');
    if (extra) lugar.appendChild(extra);
    trava(lugar, M().trava);
    corpo.appendChild(caixa);
  }

  /* ---------- 3. Acúmulos fixos ---------- */
  function acumulos(corpo, ctx, api) {
    var calc = ctx.calc || {};
    grupo(corpo, ctx);
    corpo.appendChild(tpl('nota-acumulos'));
    ((calc.automaticas && calc.automaticas.sempre) || []).forEach(function (r) {
      automatica(corpo, texto(M().sempreAutomatica, { cadeira: r[0], quem: r[1] }), gravidade(api, ctx, r[0]));
    });
    var cadeiras = (calc.cadeiras || []).map(function (c) { return c.nome; }).filter(function (n) { return n !== papel(ctx); });
    (ctx.resp.sempre || []).forEach(function (r, i) {
      var caixa = tpl('sempre');
      caixa.querySelector('[data-espaco="cadeira"]').appendChild(selecao(itensDe(cadeiras), r[0], function (v) {
        api.mudar(ctx.lado, function (x) { x.sempre[i][0] = v; });
      }, '', M().escolha, ctx.soLeitura));
      caixa.querySelector('[data-espaco="quem"]').appendChild(selecao(itensDe(proprias(ctx).filter(function (n) { return n !== r[0]; })), r[1], function (v) {
        api.mudar(ctx.lado, function (x) { x.sempre[i][1] = v; });
      }, '', M().escolha, ctx.soLeitura));
      var remover = caixa.querySelector('.nova-distribuicao-remover');
      remover.disabled = ctx.soLeitura;
      remover.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.sempre.splice(i, 1); }); });
      if (r[0]) caixa.querySelector('.nova-distribuicao-sempre-gravidade').appendChild(gravidade(api, ctx, r[0]));
      caixa.querySelector('.nova-distribuicao-incompleto').classList.toggle('oculto', !!(r[0] && r[1]));
      corpo.appendChild(caixa);
    });
    var novo = tpl('novo-sempre');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.sempre.push(['', '']); }); });
    corpo.appendChild(novo);
  }

  /* ---------- 4. Ordem de importância ---------- */
  function ordem(corpo, ctx, api) {
    var todas = proprias(ctx);
    var resumo = todas.slice(0, 3).map(function (n, i) { return texto(M().ordemItem, { n: i + 1, cadeira: n }); }).join(', ');
    if (todas.length > 3) resumo = texto(M().ordemMais, { lista: resumo, n: todas.length - 3 });
    grupo(corpo, ctx);
    corpo.appendChild(tpl('nota-ordem'));
    pergunta(corpo, api, ctx, 'ordem', M().ordem, resumo || M().nenhuma, !todas.length, function (caixa) {
      if (papel(ctx)) {
        var linhaPapel = tpl('ordem-papel');
        linhaPapel.querySelector('.nova-distribuicao-linha-nome').textContent = papel(ctx);
        caixa.appendChild(linhaPapel);
      }
      var lista = ctx.resp.ordem || [];
      lista.forEach(function (nome, i) {
        var linha = tpl('ordem');
        linha.querySelector('.nova-distribuicao-linha-ordem').textContent = (i + (papel(ctx) ? 2 : 1)) + 'º';
        linha.querySelector('.nova-distribuicao-linha-nome').textContent = nome;
        var g = ctx.resp.gravidade || {};
        linha.querySelector('.nova-distribuicao-espaco').appendChild(selecaoFixa('gravidade', g[nome] == null ? 2 : g[nome], function (v) {
          api.mudar(ctx.lado, function (x) { x.gravidade[nome] = Number(v); });
        }, ctx.soLeitura));
        setas(linha, i, lista.length, function (passo) {
          api.mudar(ctx.lado, function (x) { mover(x.ordem, i, passo); });
        }, ctx.soLeitura);
        caixa.appendChild(linha);
      });
    });
  }

  /* ---------- 5. Quando faltar gente ---------- */
  function faltar(corpo, ctx, api) {
    var calc = ctx.calc || {};
    grupo(corpo, ctx);
    corpo.appendChild(tpl('nota-faltar'));
    ((calc.automaticas && calc.automaticas.cobre) || []).forEach(function (r) {
      automatica(corpo, texto(M().cobreAutomatica, { cadeira: r[0], quem: r[1] }));
    });
    (ctx.resp.cobre || []).forEach(function (r, i) {
      var caixa = tpl('cobre');
      var quem = proprias(ctx).filter(function (n) { return n !== r[0]; });
      caixa.querySelector('[data-espaco="cadeira"]').appendChild(selecao(itensDe(ctx.resp.ordem || []), r[0], function (v) {
        api.mudar(ctx.lado, function (x) { x.cobre[i][0] = v; });
      }, '', M().escolha, ctx.soLeitura));
      caixa.querySelector('[data-espaco="primeiro"]').appendChild(selecao(itensDe(quem), r[1], function (v) {
        api.mudar(ctx.lado, function (x) { x.cobre[i][1] = v; });
      }, '', M().escolha, ctx.soLeitura));
      caixa.querySelector('[data-espaco="segundo"]').appendChild(selecao([{ valor: '', texto: M().ninguem }].concat(itensDe(quem.filter(function (n) { return n !== r[1]; }))), r[2] || '', function (v) {
        api.mudar(ctx.lado, function (x) { x.cobre[i][2] = v; });
      }, '', M().ninguem, ctx.soLeitura));
      var remover = caixa.querySelector('.nova-distribuicao-remover');
      remover.disabled = ctx.soLeitura;
      remover.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.cobre.splice(i, 1); }); });
      caixa.querySelector('.nova-distribuicao-incompleto').classList.toggle('oculto', !!(r[0] && r[1]));
      corpo.appendChild(caixa);
    });
    var novo = tpl('novo-cobre');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.cobre.push(['', '', '']); }); });
    corpo.appendChild(novo);
  }

  /* ---------- 6. Quem escolher ---------- */
  function resumoCriterio(k, nome) {
    return texto(M().criterios[k.tipo] || M().criterios[0], { perfil: k.perfil, grau: k.grau, sentido: M().sentidos[k.sentido] || M().sentidos[0] })
      + (nome.indexOf('Condutor') === 0 ? M().comCarteira : '') + (k.rodizio ? M().comRodizio : '');
  }

  function escolher(corpo, ctx, api) {
    var calc = ctx.calc || {};
    var graus = calc.graus || {};
    grupo(corpo, ctx);
    corpo.appendChild(tpl('nota-escolher'));
    if (papel(ctx)) {
      fixa(corpo, texto(M().quemSentaPapel, { cadeira: papel(ctx) }), function (caixa) {
        trava(caixa, texto(M().papelFixo, { perfil: ctx.ehCia ? 'oficial' : 'praça' }));
      });
    }
    (calc.postos || []).forEach(function (p) {
      var daqui = (ctx.resp.ordem || []).filter(function (n) { return n.slice(-(p.nome.length + 3)) === ' · ' + p.nome; });
      if (!daqui.length) return;
      posto(corpo, p.nome);
      daqui.forEach(function (nome) {
        var k = (ctx.resp.criterios || {})[nome];
        if (!k) return;
        pergunta(corpo, api, ctx, 'criterio-' + nome, texto(M().quemSenta, { funcao: nome.split(' · ')[0] }), resumoCriterio(k, nome), false, function (caixa) {
          var mudar = function (fn) { api.mudar(ctx.lado, function (x) { fn(x.criterios[nome]); }); };
          var opcoes = marcarOpcoes(tpl('criterio'), 'nova-distribuicao-criterio', function (v) { return Number(v) === k.tipo; }, function (v) {
            mudar(function (c) { c.tipo = Number(v); });
          }, ctx.soLeitura);
          opcoes.querySelectorAll('[data-espaco="perfil"]').forEach(function (lugar) {
            lugar.appendChild(selecaoFixa('perfil', k.perfil, function (v) {
              mudar(function (c) { c.perfil = v; c.grau = (graus[v] || [])[0] || c.grau; });
            }, ctx.soLeitura));
          });
          opcoes.querySelectorAll('[data-espaco="grau"]').forEach(function (lugar) {
            lugar.appendChild(selecao(itensDe(graus[k.perfil] || []), k.grau, function (v) {
              mudar(function (c) { c.grau = v; });
            }, '', '', ctx.soLeitura));
          });
          opcoes.querySelector('[data-espaco="sentido"]').appendChild(selecaoFixa('sentido', k.sentido, function (v) {
            mudar(function (c) { c.sentido = Number(v); });
          }, ctx.soLeitura));
          var rodizio = opcoes.querySelector('.nova-distribuicao-rodizio input');
          rodizio.checked = !!k.rodizio;
          rodizio.disabled = ctx.soLeitura;
          rodizio.addEventListener('change', function () { mudar(function (c) { c.rodizio = rodizio.checked; }); });
          caixa.appendChild(opcoes);
        });
      });
    });
  }

  window.RosterWork.novaDistribuicaoBlocos = {
    /* bloco 0 a 5; o 1 (funções especiais) recebe a companhia e o pelotão juntos */
    desenhar: function (bloco, corpo, ctxs, api) {
      var ctx = ctxs[ctxs.length - 1];
      if (bloco === 0) postos(corpo, ctx, api);
      else if (bloco === 1) funcoes(corpo, ctxs, api);
      else if (bloco === 2) acumulos(corpo, ctx, api);
      else if (bloco === 3) ordem(corpo, ctx, api);
      else if (bloco === 4) faltar(corpo, ctx, api);
      else if (bloco === 5) escolher(corpo, ctx, api);
    },
    pecas: { tpl: tpl, texto: texto, grupo: grupo, posto: posto, numero: numero, selecao: selecao }
  };
})();
