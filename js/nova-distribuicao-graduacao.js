/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 10, Regras por graduação
   Um cartão por regra (fechado, a graduação no título e a regra em
   texto; aberto, os campos): a graduação nas bolinhas, no jeito das
   do Quem escolher (Apenas, Igual ou mais antigo que, Igual ou mais
   moderno que, De … a …, com a graduação dentro da frase), Não pode |
   Só pode e a função. A regra por militar vale mais que esta, e o
   banco põe fora da regra só quando não há outro que possa.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  function completa(r) { return !!(r.forma && r.grau && (r.forma !== 'entre' || r.ate)); }

  /* os campos da regra aberta: Graduação (as bolinhas), Regra (Não pode | Só pode), Função e o Remover regra */
  function campos(lugar, ctx, api, r, i, falta, erros) {
    var graus = (ctx.calc && ctx.calc.graus) || {};
    var listaGraus = ctx.ehCia ? (graus['praça'] || []).concat(graus.oficial || []) : (graus['praça'] || []);
    var itensGrau = listaGraus.map(function (g) { return { valor: g, texto: g }; });
    function mudar(fn) { api.mudar(ctx.lado, function (x) { fn(x.regras_graduacao[i]); }); }
    var conteudo = P().tpl('regra-graduacao');

    var opcoes = P().bolinhas(conteudo.querySelector('.nova-distribuicao-opcoes'), 'nova-distribuicao-graduacao-' + i, function (v) {
      return v === r.forma;
    }, function (v) { mudar(function (g) { g.forma = v; if (v !== 'entre') g.ate = null; }); }, ctx.soLeitura);
    opcoes.querySelectorAll('[data-espaco="grau"]').forEach(function (lugarGrau) {
      lugarGrau.appendChild(P().selecao(itensGrau, r.grau, function (v) { mudar(function (g) { g.grau = v; }); },
        { rotulo: M().rotuloGrau, travado: ctx.soLeitura, erro: falta && !!r.forma && !r.grau }));
    });
    opcoes.querySelector('[data-espaco="ate"]').appendChild(P().selecao(itensGrau, r.ate, function (v) { mudar(function (g) { g.ate = v; }); },
      { rotulo: M().rotuloGrau, travado: ctx.soLeitura, erro: falta && r.forma === 'entre' && !r.ate }));

    var tipo = conteudo.querySelector('.nova-distribuicao-regra-tipo');
    tipo.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === r.tipo);
      aba.disabled = ctx.soLeitura;
    });
    tipo.classList.toggle('nova-distribuicao-espaco--erro', falta && !r.tipo);
    RosterWork.abas.ligar(tipo, function (aba) {
      var v = aba.getAttribute('data-valor');
      if (v !== r.tipo) mudar(function (g) { g.tipo = v; });
    });

    conteudo.querySelector('[data-espaco="funcao"]').appendChild(P().selecaoFixa('regra-funcao', r.funcao, function (v) {
      mudar(function (g) { g.funcao = v; });
    }, ctx.soLeitura, falta && !r.funcao));

    /* fecha o cartão antes de tirar a regra: as de baixo sobem de posição */
    var remover = conteudo.querySelector('.nova-distribuicao-remover-regra');
    remover.disabled = ctx.soLeitura;
    remover.addEventListener('click', function () {
      api.abrir(ctx.lado + ':graduacao-' + i);
      api.mudar(ctx.lado, function (x) { x.regras_graduacao.splice(i, 1); });
    });

    var frases = erros.slice();
    if (falta) frases.unshift(M().graduacaoIncompleta);
    frases.forEach(function (e) { P().erroCampo(conteudo, e); });
    lugar.appendChild(conteudo);
  }

  /* uma regra por cartão: fechado, a graduação no título e a regra embaixo ("Não pode Rancheiro"); aberto, os campos */
  function regras(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-graduacao'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'regras_graduacao');
    var todas = ctx.resp.regras_graduacao || [];
    if (!todas.length) u.appendChild(P().tpl('regras-vazio'));

    /* a regra nova (ainda não salva) não acusa o que falta antes do Salvar */
    var gravadas = ((((api.dados() || {}).atual || {}).respostas || {}).regras_graduacao || []).length;
    todas.forEach(function (r, i) {
      var falta = i < gravadas && P().pendente(ctx, 'regra_graduacao:' + i);
      var erros = P().erros(ctx, 'regra_graduacao:' + i);
      var linhas = [r.tipo && r.funcao ? P().texto(M().regraTexto[r.tipo], { funcao: r.funcao }) : { texto: M().faltaResponder, falta: falta }]
        .concat(erros.map(function (e) { return { texto: e, falta: true }; }));
      var titulo = completa(r) ? P().texto(M().graduacaoTitulo[r.forma], { grau: r.grau, ate: r.ate }) : M().semGraduacao;
      P().cartao(u, api, ctx, 'graduacao-' + i, titulo, linhas, function (lugar) {
        campos(lugar, ctx, api, r, i, falta, erros);
      }, falta || erros.length > 0);
    });

    /* a regra nova já abre */
    var novo = P().tpl('nova-regra');
    novo.disabled = ctx.soLeitura;
    novo.addEventListener('click', function () {
      api.mudar(ctx.lado, function (x) {
        x.regras_graduacao = x.regras_graduacao || [];
        x.regras_graduacao.push({ forma: null, grau: null, ate: null, tipo: null, funcao: null });
      }, ctx.lado + ':graduacao-' + todas.length);
    });
    u.appendChild(novo);
  }

  window.RosterWork.novaDistribuicaoGraduacao = { regras: regras };
})();
