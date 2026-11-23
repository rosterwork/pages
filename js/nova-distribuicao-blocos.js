/* ============================================================
   NOVA DISTRIBUIÇÃO — blocos 7 e 8 do questionário
   Ordem de importância (tabela sempre aberta, uma linha por pessoa
   com os acúmulos dela) e Quem escolher (as quatro formas, o aviso
   e o rodízio). Os acúmulos moram em nova-distribuicao-acumulos.js.
   Toda mudança passa pelo api.mudar (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* a linha movida por último na ordem ({ lado, nome, passo }): a seta clicada fica marcada no desenho seguinte
     da ordem, depois some */
  var movida = null;

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function A() { return RosterWork.novaDistribuicaoAcumulos; }

  /* ---------- 6. Ordem de importância ---------- */

  /* as funções de quem está na linha: a própria e as que acumulam com ela */
  function daPessoa(ctx, nome) {
    var lista = [nome];
    A().automaticas(ctx, 'sempre').concat(ctx.resp.sempre || []).forEach(function (s) {
      if (s[1] === nome && s[0] && lista.indexOf(s[0]) < 0) lista.push(s[0]);
    });
    return lista;
  }

  function celulas(linha, ctx, nomes, primeiroExtra) {
    var postos = linha.querySelector('.nova-distribuicao-col-posto');
    var funcoes = linha.querySelector('.nova-distribuicao-col-funcao');
    nomes.forEach(function (nome, k) {
      var p = P().partes(nome);
      var lp = P().tpl('celula-linha');
      lp.textContent = P().postoCurto(p.posto);
      if (P().postoCurto(p.posto) !== p.posto) lp.setAttribute('data-dica', p.posto);
      postos.appendChild(lp);
      var lf = P().tpl('celula-linha');
      lf.textContent = P().rotulo(ctx, nome, true);
      if (k === 0 && primeiroExtra) lf.appendChild(primeiroExtra);
      funcoes.appendChild(lf);
    });
  }

  function ordem(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-ordem'));
    var u = P().unidade(corpo, ctx);
    var tabela = P().tpl('ordem');
    var corpoTabela = tabela.querySelector('tbody');
    var papel = P().papel(ctx);
    var n = 0;
    if (papel) {
      var lp = P().tpl('ordem-linha');
      lp.querySelector('.nova-distribuicao-col-n').textContent = (++n) + 'º';
      celulas(lp, ctx, daPessoa(ctx, papel), P().tpl('ordem-papel'));
      marcarLinha(lp, ctx, papel);
      lp.querySelector('.nova-distribuicao-col-acoes').textContent = '';
      corpoTabela.appendChild(lp);
    }
    var lista = ctx.resp.ordem || [];
    var marcada = movida && movida.lado === ctx.lado ? movida : null;
    movida = null;
    /* dentro do mesmo posto a ordem segue o lugar: o banco diz que seta não anda e por quê */
    var setasDe = {};
    ((ctx.calc && ctx.calc.ordem_setas) || []).forEach(function (s) { setasDe[s.nome] = s; });
    lista.forEach(function (nome, i) {
      var linha = P().tpl('ordem-linha');
      var s = setasDe[nome] || {};
      linha.querySelector('.nova-distribuicao-col-n').textContent = (++n) + 'º';
      celulas(linha, ctx, daPessoa(ctx, nome));
      marcarLinha(linha, ctx, nome);
      P().setas(linha, i, lista.length, function (passo) {
        movida = { lado: ctx.lado, nome: nome, passo: passo };
        api.mudar(ctx.lado, function (x) { P().mover(x.ordem, i, passo); });
      }, ctx.soLeitura, { sobe: s.sobe === false ? s.sobe_motivo : null, desce: s.desce === false ? s.desce_motivo : null });
      if (marcada && marcada.nome === nome) mostrarMovida(linha, n, marcada.passo, api);
      corpoTabela.appendChild(linha);
    });
    P().marcarMuda(tabela, ctx, 'ordem', tabela);
    u.appendChild(tabela);
    P().erros(ctx, 'ordem').forEach(function (e) { P().erroCampo(u, e); });
  }

  /* a linha movida: a borda na seta clicada (fica nela mesmo se ficou inativa), o foco na mesma seta (se ela
     ficou inativa, na outra; a página rola até ela) e o aviso ao leitor de tela */
  function mostrarMovida(linha, numero, passo, api) {
    var subir = linha.querySelector('.nova-distribuicao-subir');
    var descer = linha.querySelector('.nova-distribuicao-descer');
    var seta = passo < 0 ? (subir.disabled ? descer : subir) : (descer.disabled ? subir : descer);
    (passo < 0 ? subir : descer).classList.add('nova-distribuicao-seta--clicada');
    if (!seta.disabled) {
      seta.id = 'nova-distribuicao-ordem-foco';
      api.focarDepois('#nova-distribuicao-ordem-foco');
    }
    var anuncio = document.getElementById('nova-distribuicao-anuncio');
    if (anuncio) anuncio.textContent = P().texto(M().ordemMovida, { n: numero });
  }

  /* a linha da ordem cuja posição muda na mudança agendada: o calendário no Nº, com a frase na dica */
  function marcarLinha(linha, ctx, nome) {
    var marca = P().marcaMuda(ctx, 'ordem:' + nome);
    if (marca) linha.querySelector('.nova-distribuicao-col-n').appendChild(marca);
  }

  /* ---------- 7. Quem escolher ---------- */
  /* por função e posto (Efetivo · ABTR-14462): a regra de todos os lugares e as exceções de um lugar (o 1º, o 2º...). O
     Quem escolher vem do rascunho (quem_escolher) ou, sem ele, da conta do banco; mexer copia o da conta para o rascunho,
     e a tela manda só o quem_escolher (nova-distribuicao-dados.js tira o critério de cada lugar, que é o jeito de antes) */

  /* uma linha do cartão fechado por informação: o critério, o aviso, a CNH (Condutor) e o rodízio */
  function resumoCriterio(k, base) {
    var linhas = [];
    if (k && k.tipo != null) {
      linhas.push(P().texto(M().criterios[k.tipo], {
        perfil: k.perfil || '', grau: k.grau || '', sentido: k.sentido == null ? '' : M().sentidos[k.sentido]
      }));
      if (k.tipo >= 2 && k.aviso != null) linhas.push(M().avisoLinha[k.aviso]);
      if (base === 'Condutor') linhas.push(M().comCarteira);
      if (k.rodizio) linhas.push(M().comRodizio);
    }
    return linhas;
  }

  function minuscula(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : ''; }

  /* a exceção numa linha só: "Exceção: o 1º Rádio Operador é um Sd.1ªCl. ou o mais próximo mais antigo, com aviso
     amarelo, com rodízio" */
  function linhaExcecao(e, rotulo, base) {
    return P().texto(M().quemExcecao, { lugar: rotulo, escolha: resumoCriterio(e, base).map(minuscula).join(', ') });
  }

  /* as escolhas de um critério (a regra de todos ou uma exceção); mudar(fn) muda o critério no rascunho; nome = o grupo
     das bolinhas (um por critério, porque o cartão pode ter vários) */
  function opcoesCriterio(lugar, ctx, k, mudar, falta, nome) {
    var graus = (ctx.calc && ctx.calc.graus) || {};
    var listaGraus = ctx.ehCia ? (graus['praça'] || []).concat(graus.oficial || []) : (graus['praça'] || []);
    var opcoes = P().bolinhas(P().tpl('criterio'), nome, function (v) { return Number(v) === k.tipo; }, function (v) {
      mudar(function (c) {
        c.tipo = Number(v);
        if (c.tipo <= 1 && !c.perfil && !ctx.ehCia) c.perfil = 'praça';
      });
    }, ctx.soLeitura);
    opcoes.querySelectorAll('[data-espaco="perfil"]').forEach(function (lugarPerfil) {
      lugarPerfil.appendChild(P().selecaoFixa('perfil', k.perfil, function (v) { mudar(function (c) { c.perfil = v; }); },
        ctx.soLeitura, falta && k.tipo <= 1 && !k.perfil));
    });
    opcoes.querySelectorAll('[data-espaco="grau"]').forEach(function (lugarGrau) {
      lugarGrau.appendChild(P().selecao(listaGraus.map(function (g) { return { valor: g, texto: g }; }), k.grau, function (v) {
        mudar(function (c) { c.grau = v; c.perfil = (graus.oficial || []).indexOf(v) >= 0 ? 'oficial' : 'praça'; });
      }, { rotulo: M().rotuloGrau, travado: ctx.soLeitura, erro: falta && k.tipo >= 2 && !k.grau }));
    });
    opcoes.querySelector('[data-espaco="sentido"]').appendChild(P().selecaoFixa('sentido', k.sentido, function (v) {
      mudar(function (c) { c.sentido = Number(v); });
    }, ctx.soLeitura, falta && k.tipo === 2 && k.sentido == null));
    var linhaAviso = opcoes.querySelector('.nova-distribuicao-criterio-aviso');
    linhaAviso.classList.toggle('oculto', !(k.tipo >= 2));
    linhaAviso.querySelector('[data-espaco="aviso"]').appendChild(P().selecaoFixa('aviso', k.aviso, function (v) {
      mudar(function (c) { c.aviso = Number(v); });
    }, ctx.soLeitura, falta && k.tipo >= 2 && k.aviso == null));
    P().marcar(opcoes.querySelector('.nova-distribuicao-rodizio'), !!k.rodizio, function (marcado) {
      mudar(function (c) { c.rodizio = marcado; });
    }, ctx.soLeitura);
    lugar.appendChild(opcoes);
  }

  /* as funções com pessoa própria, por função e posto, na sequência da Ordem de importância:
     [{ grupo: 'Efetivo · ABTR-14462', base, posto, lugares: [{ nome, k, rotulo }] }]; k = o 1º, o 2º... na ordem do lugar
     (o mesmo dos nomes da tela e do banco) */
  function grupos(ctx) {
    var porNome = {};
    var contas = {};
    ((ctx.calc && ctx.calc.funcoes) || []).forEach(function (f) {
      if (f.papel) return;
      var base = f.funcao.replace(/ \d+$/, '');
      var chave = f.posto + '|' + base;
      contas[chave] = (contas[chave] || 0) + 1;   // as funções vêm na ordem do lugar dentro do posto
      porNome[f.nome] = { base: base, posto: f.posto, k: contas[chave], rotulo: f.tela || f.funcao };
    });
    var lista = [];
    var vistos = {};
    ((ctx.calc && ctx.calc.respostas && ctx.calc.respostas.ordem) || ctx.resp.ordem || []).forEach(function (nome) {
      var f = porNome[nome];
      if (!f) return;
      var grupo = f.base + ' · ' + f.posto;
      if (!vistos[grupo]) {
        vistos[grupo] = { grupo: grupo, base: f.base, posto: f.posto, lugares: [] };
        lista.push(vistos[grupo]);
      }
      vistos[grupo].lugares.push({ nome: nome, k: f.k, rotulo: f.rotulo });
    });
    lista.forEach(function (g) { g.lugares.sort(function (a, b) { return a.k - b.k; }); });
    return lista;
  }

  function quemDaConta(ctx) { return (ctx.calc && ctx.calc.respostas && ctx.calc.respostas.quem_escolher) || {}; }

  /* o Quem escolher de um grupo: o do rascunho ou, sem ele, o da conta */
  function quemDe(ctx, grupo) {
    var q = (ctx.resp.quem_escolher || quemDaConta(ctx))[grupo] || {};
    return { regra: q.regra || {}, excecoes: q.excecoes || [] };
  }

  /* muda o Quem escolher de um grupo no rascunho; na primeira vez, copia o da conta (o jeito novo) */
  function mudarQuem(ctx, api, grupo, fn) {
    api.mudar(ctx.lado, function (x) {
      if (!x.quem_escolher) x.quem_escolher = JSON.parse(JSON.stringify(quemDaConta(ctx)));
      var q = x.quem_escolher[grupo] = x.quem_escolher[grupo] || {};
      q.regra = q.regra || {};
      q.excecoes = q.excecoes || [];
      fn(q);
    });
  }

  /* o cartão aberto: a função de um lugar só tem só as escolhas; com dois ou mais lugares, "Todos os Efetivos" e as
     exceções (cada uma com o lugar, a lixeira e as escolhas dela) */
  function montarQuem(lugar, ctx, api, g, q, faltaRegra) {
    var nome = 'nova-distribuicao-criterio-' + g.grupo;
    var mudarRegra = function (fn) { mudarQuem(ctx, api, g.grupo, function (x) { fn(x.regra); }); };
    if (g.lugares.length < 2) {
      opcoesCriterio(lugar, ctx, q.regra, mudarRegra, faltaRegra, nome);
      return;
    }
    var titulo = P().tpl('quem-todos');
    titulo.textContent = P().texto(M().quemTodos, { plural: M().plurais[g.base] || g.base });
    lugar.appendChild(titulo);
    opcoesCriterio(lugar, ctx, q.regra, mudarRegra, faltaRegra, nome);
    var bloco = P().tpl('quem-excecoes');
    bloco.querySelector('.nova-distribuicao-quem-ajuda').textContent = P().texto(M().quemAjuda, { funcao: g.base });
    var lista = bloco.querySelector('.nova-distribuicao-quem-lista');
    var usados = q.excecoes.map(function (e) { return e.lugar; });
    q.excecoes.forEach(function (e, i) {
      var caixa = P().tpl('quem-excecao');
      var livres = g.lugares.filter(function (l) { return l.k === e.lugar || usados.indexOf(l.k) < 0; });
      caixa.querySelector('[data-espaco="lugar"]').appendChild(P().selecao(livres.map(function (l) { return { valor: l.k, texto: l.rotulo }; }),
        e.lugar, function (v) { mudarQuem(ctx, api, g.grupo, function (x) { x.excecoes[i].lugar = v; }); },
        { rotulo: M().rotuloLugar, travado: ctx.soLeitura }));
      var remover = caixa.querySelector('.nova-distribuicao-remover');
      if (ctx.soLeitura) remover.classList.add('oculto');
      else remover.addEventListener('click', function () { mudarQuem(ctx, api, g.grupo, function (x) { x.excecoes.splice(i, 1); }); });
      opcoesCriterio(caixa.querySelector('.nova-distribuicao-quem-escolha'), ctx, e, function (fn) {
        mudarQuem(ctx, api, g.grupo, function (x) { fn(x.excecoes[i]); });
      }, P().pendente(ctx, 'criterio:' + g.grupo + ':' + e.lugar), nome + '-' + i);
      lista.appendChild(caixa);
    });
    P().erros(ctx, 'criterio:' + g.grupo).forEach(function (frase) { P().erroCampo(lista, frase); });
    bloco.querySelector('.nova-distribuicao-quem-nenhuma').classList.toggle('oculto', q.excecoes.length > 0);
    var adicionar = bloco.querySelector('.nova-distribuicao-quem-adicionar');
    var livre = g.lugares.filter(function (l) { return usados.indexOf(l.k) < 0; })[0];
    if (ctx.soLeitura || !livre) adicionar.classList.add('oculto');
    else adicionar.addEventListener('click', function () {
      /* a exceção nova: o primeiro lugar livre, com uma cópia da regra de todos */
      mudarQuem(ctx, api, g.grupo, function (x) { x.excecoes.push(Object.assign(JSON.parse(JSON.stringify(x.regra)), { lugar: livre.k })); });
    });
    lugar.appendChild(bloco);
  }

  function escolher(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-escolher'));
    var u = P().unidade(corpo, ctx);
    var papel = P().papel(ctx);
    if (papel) {
      P().fixo(u, P().texto(M().quemSenta, { funcao: P().completo(ctx, papel) }), function (lugar) {
        P().trava(lugar, P().texto(M().papelFixo, { perfil: ctx.ehCia ? 'oficial' : 'praça' }));
      });
    }
    grupos(ctx).forEach(function (g) {
      var q = quemDe(ctx, g.grupo);
      var chave = 'criterio:' + g.grupo;
      var faltaRegra = P().pendente(ctx, chave);
      var comErro = faltaRegra || P().erros(ctx, chave).length > 0
        || ((ctx.calc && ctx.calc.pendencias) || []).some(function (p) { return p.indexOf(chave + ':') === 0; });
      var linhas = resumoCriterio(q.regra, g.base);
      if (g.lugares.length > 1) {
        q.excecoes.forEach(function (e) {
          var l = g.lugares.filter(function (x) { return x.k === e.lugar; })[0];
          if (l) linhas.push(linhaExcecao(e, l.rotulo, g.base));
        });
      }
      if (comErro) linhas.push({ texto: M().faltaResponder, falta: true });
      P().cartao(u, api, ctx, 'criterio-' + g.grupo, P().texto(M().quemSenta, { funcao: P().postoCurto(g.posto) + ' · ' + g.base }),
        linhas, function (lugar) { montarQuem(lugar, ctx, api, g, q, faltaRegra); }, comErro, { muda: 'quem:' + g.grupo });
    });
  }

  window.RosterWork.novaDistribuicaoBlocos = {
    ordem: ordem, escolher: escolher
  };
})();
