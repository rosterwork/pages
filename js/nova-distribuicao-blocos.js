/* ============================================================
   NOVA DISTRIBUIÇÃO — blocos 3 a 6 do questionário
   Acúmulos fixos, Ordem de importância (tabela sempre aberta, uma
   linha por pessoa com os acúmulos dela), Substitutos (de 1 a 5,
   em linhas) e Quem escolher (as quatro formas, o aviso e o
   rodízio). As regras automáticas vêm do banco, travadas. Toda
   mudança passa pelo api.mudar (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* a linha movida por último na ordem ({ lado, nome, passo }): a seta clicada fica marcada no desenho seguinte
     da ordem, depois some */
  var movida = null;

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
    destino.appendChild(caixa);
  }

  function remover(caixa, ctx, fn) {
    var botao = caixa.querySelector('.nova-distribuicao-remover');
    botao.disabled = ctx.soLeitura;
    botao.addEventListener('click', fn);
  }

  /* ---------- 3. Acúmulos fixos ---------- */
  function acumulos(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-acumulos'));
    var u = P().unidade(corpo, ctx);
    var autos = automaticas(ctx, 'sempre');
    autos.forEach(function (a) {
      automatica(u, P().texto(M().automaticaSempre, { funcao: P().completo(ctx, a[0]), quem: P().completo(ctx, a[1]) }));
    });
    P().marcarMuda(u, ctx, 'sempre');
    var travadas = autos.map(function (a) { return a[0]; });
    var podem = ((ctx.calc && ctx.calc.funcoes) || []).filter(function (f) {
      return !f.papel && travadas.indexOf(f.nome) < 0;
    }).map(function (f) { return f.nome; });

    var salvos = gravadas(api, 'sempre');
    (ctx.resp.sempre || []).forEach(function (s, i) {
      var caixa = P().tpl('acumulo');
      var falta = i < salvos && P().pendente(ctx, 'sempre:' + i);
      caixa.querySelector('[data-espaco="funcao"]').appendChild(P().selecaoFuncoes(ctx, podem, s[0], function (v) {
        api.mudar(ctx.lado, function (x) { x.sempre[i][0] = v; });
      }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura, erro: falta && !s[0] }));
      caixa.querySelector('[data-espaco="quem"]').appendChild(P().selecaoFuncoes(ctx, P().proprias(ctx).filter(function (n) { return n !== s[0]; }), s[1], function (v) {
        api.mudar(ctx.lado, function (x) { x.sempre[i][1] = v; });
      }, { rotulo: M().rotuloQuem, travado: ctx.soLeitura, erro: falta && !s[1] }));
      remover(caixa, ctx, function () { api.mudar(ctx.lado, function (x) { x.sempre.splice(i, 1); }); });
      var errosAqui = P().erros(ctx, 'sempre:' + i);
      if (falta) errosAqui.unshift(M().acumuloIncompleto);
      errosAqui.forEach(function (e) { P().erroCampo(caixa, e); });
      caixa.classList.toggle('nova-distribuicao-cartao--erro', errosAqui.length > 0);
      u.appendChild(caixa);
    });
    P().erros(ctx, 'sempre').forEach(function (e) { P().erroCampo(u, e); });

    var novo = P().tpl('novo-acumulo');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.sempre.push(['', '']); }); });
    u.appendChild(novo);
  }

  /* ---------- 4. Ordem de importância ---------- */

  /* as funções de quem está na linha: a própria e as que acumulam com ela */
  function daPessoa(ctx, nome) {
    var lista = [nome];
    automaticas(ctx, 'sempre').concat(ctx.resp.sempre || []).forEach(function (s) {
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

  /* ---------- 5. Substitutos ---------- */
  function substitutos(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-substitutos'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'cobre');
    automaticas(ctx, 'cobre').forEach(function (c) {
      var valores = { funcao: P().completo(ctx, c[0]), quem: P().completo(ctx, c[1]) };
      automatica(u, M().automaticaCobre.map(function (t) { return P().texto(t, valores); }));
    });
    var salvos = gravadas(api, 'cobre');
    (ctx.resp.cobre || []).forEach(function (regra, i) {
      var caixa = P().tpl('substitutos');
      var falta = i < salvos && P().pendente(ctx, 'cobre:' + i);
      caixa.querySelector('[data-espaco="funcao"]').appendChild(P().selecaoFuncoes(ctx, ctx.resp.ordem || [], regra[0], function (v) {
        api.mudar(ctx.lado, function (x) { x.cobre[i][0] = v; });
      }, { rotulo: M().rotuloFuncao, travado: ctx.soLeitura, erro: falta && !regra[0] }));
      remover(caixa, ctx, function () { api.mudar(ctx.lado, function (x) { x.cobre.splice(i, 1); }); });

      var lista = caixa.querySelector('.nova-distribuicao-regra-lista');
      var subs = regra.slice(1);
      if (!subs.length) subs = [''];
      subs.forEach(function (s, j) {
        var linha = P().tpl('substituto');
        linha.querySelector('.nova-distribuicao-regra-rotulo').textContent = P().texto(M().substitutoN, { n: j + 1 });
        var outros = regra.filter(function (x, k) { return k !== j + 1; });
        var podem = P().proprias(ctx).filter(function (nome) { return outros.indexOf(nome) < 0; });
        linha.querySelector('.nova-distribuicao-espaco').appendChild(P().selecaoFuncoes(ctx, podem, s, function (v) {
          api.mudar(ctx.lado, function (x) { x.cobre[i][j + 1] = v; });
        }, { rotulo: P().texto(M().substitutoN, { n: j + 1 }), travado: ctx.soLeitura, erro: falta && j === 0 && !s }));
        var tirar = linha.querySelector('.nova-distribuicao-remover');
        tirar.disabled = ctx.soLeitura;
        tirar.classList.toggle('oculto', subs.length < 2);
        tirar.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.cobre[i].splice(j + 1, 1); }); });
        lista.appendChild(linha);
      });
      var mais = caixa.querySelector('.nova-distribuicao-adicionar');
      mais.disabled = ctx.soLeitura || subs.length >= 5;
      mais.addEventListener('click', function () {
        api.mudar(ctx.lado, function (x) { while (x.cobre[i].length < subs.length + 1) x.cobre[i].push(''); x.cobre[i].push(''); });
      });
      var errosAqui = P().erros(ctx, 'cobre:' + i);
      if (falta) errosAqui.unshift(M().substitutoIncompleto);
      errosAqui.forEach(function (e) { P().erroCampo(caixa, e); });
      if (regra[0]) P().marcarMuda(caixa, ctx, 'cobre:' + regra[0], caixa);
      caixa.classList.toggle('nova-distribuicao-cartao--erro', errosAqui.length > 0);
      u.appendChild(caixa);
    });
    var novo = P().tpl('novo-substitutos');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.cobre.push(['', '']); }); });
    u.appendChild(novo);
  }

  /* ---------- 6. Quem escolher ---------- */
  function resumoCriterio(k, nome, falta) {
    var linhas = [];
    if (k && k.tipo != null) {
      /* uma informação por linha: o critério, o aviso, a CNH (Condutor) e o rodízio */
      linhas.push(P().texto(M().criterios[k.tipo], {
        perfil: k.perfil || '', grau: k.grau || '', sentido: k.sentido == null ? '' : M().sentidos[k.sentido]
      }));
      if (k.tipo >= 2 && k.aviso != null) linhas.push(M().avisoLinha[k.aviso]);
      if (P().partes(nome).funcao === 'Condutor') linhas.push(M().comCarteira);
      if (k.rodizio) linhas.push(M().comRodizio);
    }
    if (falta) linhas.push({ texto: M().faltaResponder, falta: true });
    return linhas;
  }

  function opcoesCriterio(lugar, ctx, api, nome, k) {
    var graus = (ctx.calc && ctx.calc.graus) || {};
    var listaGraus = ctx.ehCia ? (graus['praça'] || []).concat(graus.oficial || []) : (graus['praça'] || []);
    var falta = P().pendente(ctx, 'criterio:' + nome);
    function mudar(fn) { api.mudar(ctx.lado, function (x) { x.criterios[nome] = x.criterios[nome] || {}; fn(x.criterios[nome]); }); }

    var opcoes = P().bolinhas(P().tpl('criterio'), 'nova-distribuicao-criterio', function (v) { return Number(v) === k.tipo; }, function (v) {
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

  function escolher(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-escolher'));
    var u = P().unidade(corpo, ctx);
    var papel = P().papel(ctx);
    if (papel) {
      P().fixo(u, P().texto(M().quemSenta, { funcao: P().completo(ctx, papel) }), function (lugar) {
        P().trava(lugar, P().texto(M().papelFixo, { perfil: ctx.ehCia ? 'oficial' : 'praça' }));
      });
    }
    /* na mesma sequência da Ordem de importância */
    (ctx.resp.ordem || []).forEach(function (nome) {
      var k = (ctx.resp.criterios || {})[nome] || {};
      var falta = P().pendente(ctx, 'criterio:' + nome);
      P().cartao(u, api, ctx, 'criterio-' + nome, P().texto(M().quemSenta, { funcao: P().completo(ctx, nome) }),
        resumoCriterio(k, nome, falta), function (lugar) { opcoesCriterio(lugar, ctx, api, nome, k); }, falta, { muda: 'criterio:' + nome });
    });
  }

  window.RosterWork.novaDistribuicaoBlocos = {
    acumulos: acumulos, ordem: ordem, substitutos: substitutos, escolher: escolher
  };
})();
