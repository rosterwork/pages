/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 10, Regras por graduação
   Um cartão por regra (fechado, a graduação no título e a regra em
   texto; aberto, os campos): a graduação nas bolinhas, no jeito das
   do Quem escolher (Apenas, Igual ou mais antigo que, Igual ou mais
   moderno que, De … a …, com a graduação dentro da frase), Não pode |
   Só pode, o posto (desta unidade) e a função, com os mesmos campos da
   regra por militar. A regra por militar vale mais que esta. No Não
   pode, "Se só houver [graduação]": põe um deles, com aviso amarelo
   (sem resposta, o padrão), ou deixa a função vazia, com erro
   vermelho (se_so_houver = 'vazio').
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  function completa(r) { return !!(r.forma && r.grau && (r.forma !== 'entre' || r.ate)); }

  /* a graduação da regra numa frase: "Cb. ou mais antigo", "de Cb. a 3ºSgt." */
  function graduacao(r) { return P().texto(M().graduacaoFrase[r.forma], { grau: r.grau, ate: r.ate }); }

  /* a pergunta "Se só houver [graduação]" vale no Não pode com a regra completa (alvo = a função em texto) */
  function comPergunta(r, alvo) { return r.tipo === 'proibido' && completa(r) && !!alvo; }

  /* a resposta fechada da pergunta: põe um deles (o padrão) ou deixa vazio */
  function fraseSeSoHouver(r, alvo) {
    var frases = M().seSoHouverFechado;
    var molde = r.se_so_houver !== 'vazio' ? frases.poe : (r.funcao === '*' ? frases.vazioPosto : frases.vazio);
    return P().texto(molde, { graduacao: graduacao(r), funcao: alvo });
  }

  /* a pergunta aberta: as duas bolinhas, com a graduação e a função da regra (a regra de qualquer função do posto sem ela) */
  function seSoHouver(conteudo, ctx, r, i, alvo, mudar) {
    var linha = conteudo.querySelector('.nova-distribuicao-se-so-houver');
    linha.classList.toggle('oculto', !comPergunta(r, alvo));
    if (!comPergunta(r, alvo)) return;
    var opcoes = M().seSoHouverOpcoes;
    var doPosto = r.funcao === '*';
    linha.querySelector('.nova-distribuicao-se-so-houver-titulo').textContent = P().texto(M().seSoHouver, { graduacao: graduacao(r) });
    linha.querySelector('.nova-distribuicao-se-so-houver-poe').textContent = P().texto(doPosto ? opcoes.poePosto : opcoes.poe, { funcao: alvo });
    linha.querySelector('.nova-distribuicao-se-so-houver-vazio').textContent = P().texto(doPosto ? opcoes.vazioPosto : opcoes.vazio, { funcao: alvo });
    P().bolinhas(linha.querySelector('.nova-distribuicao-opcoes'), 'nova-distribuicao-se-so-houver-' + i, function (v) {
      return v === (r.se_so_houver === 'vazio' ? 'vazio' : 'poe');
    }, function (v) {
      mudar(function (g) { if (v === 'vazio') g.se_so_houver = 'vazio'; else delete g.se_so_houver; });
    }, ctx.soLeitura);
  }

  /* os campos da regra aberta: Graduação (as bolinhas), Regra (Não pode | Só pode), Posto, Função, Se só houver e o
     Remover regra */
  function campos(lugar, ctx, api, r, i, falta, erros, alvo) {
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

    RosterWork.novaDistribuicaoMilitares.ondeEFuncao(conteudo, ctx, r, mudar, { travado: ctx.soLeitura, falta: falta });
    seSoHouver(conteudo, ctx, r, i, alvo, mudar);

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

  /* uma regra por cartão: fechado, a graduação no título e a regra embaixo ("Não pode Rancheiro", "Não pode
     ABTR-14462 · Condutor"); aberto, os campos */
  function regras(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-graduacao'));
    var u = P().unidade(corpo, ctx);
    P().marcarMuda(u, ctx, 'regras_graduacao');
    var todas = ctx.resp.regras_graduacao || [];
    if (!todas.length) u.appendChild(P().tpl('regras-vazio'));

    /* a regra nova (ainda não salva) não acusa o que falta antes do Salvar */
    var gravadas = ((((api.dados() || {}).atual || {}).respostas || {}).regras_graduacao || []).length;
    var alvos = ((ctx.calc && ctx.calc.regra_textos) || {}).graduacao || [];
    todas.forEach(function (r, i) {
      var falta = i < gravadas && P().pendente(ctx, 'regra_graduacao:' + i);
      var erros = P().erros(ctx, 'regra_graduacao:' + i);
      var linhas = [RosterWork.novaDistribuicaoMilitares.textoDaRegra(r, alvos[i], falta)]
        .concat(comPergunta(r, alvos[i]) ? [fraseSeSoHouver(r, alvos[i])] : [])
        .concat(erros.map(function (e) { return { texto: e, falta: true }; }));
      var titulo = completa(r) ? P().texto(M().graduacaoTitulo[r.forma], { grau: r.grau, ate: r.ate }) : M().semGraduacao;
      P().cartao(u, api, ctx, 'graduacao-' + i, titulo, linhas, function (lugar) {
        campos(lugar, ctx, api, r, i, falta, erros, alvos[i]);
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
