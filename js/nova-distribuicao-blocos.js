/* ============================================================
   NOVA DISTRIBUIÇÃO — blocos 6 e 7 do questionário
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
    ordem: ordem, escolher: escolher
  };
})();
