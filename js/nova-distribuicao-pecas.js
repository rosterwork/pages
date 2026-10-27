/* ============================================================
   NOVA DISTRIBUIÇÃO — as peças comuns dos blocos
   Moldes de nova-distribuicao.html montados com os dados: o bloco
   cinza da unidade, o cartão que abre (resposta embaixo) e o sempre
   aberto, a caixa de marcar, a bolinha, os campos de seleção (os de
   função em Posto | Função, alinhados), o número, as setas, a trava,
   o erro no campo e o que muda na mudança agendada (a borda escura e
   a frase com o calendário). Também os nomes: uma função é sempre
   "Função · Posto"; na tela vira "Posto · Função", com a Central de
   Operações curta nas listas de escolha (o nome inteiro na dica).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var FORMATO_PREFIXO = /^[A-Z]+-[0-9]+$/;
  var CURTOS = { 'Central de Operações': 'Central' };

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function tpl(nome) { return RosterWork.tpl('tpl-nova-distribuicao-' + nome); }

  function texto(modelo, valores) {
    return Object.keys(valores || {}).reduce(function (t, k) { return t.split('{' + k + '}').join(valores[k]); }, modelo || '');
  }

  function mover(arr, i, passo) {
    var j = i + passo;
    if (j < 0 || j >= arr.length) return;
    var guardado = arr[i];
    arr[i] = arr[j];
    arr[j] = guardado;
  }

  /* ---------- nomes ---------- */

  /* "Efetivo 2 · ABT-14935" → { funcao: 'Efetivo 2', posto: 'ABT-14935' } */
  function partes(nome) {
    var i = (nome || '').indexOf(' · ');
    return i < 0 ? { funcao: nome || '', posto: '' } : { funcao: nome.slice(0, i), posto: nome.slice(i + 3) };
  }

  function postoCurto(posto) { return CURTOS[posto] || posto; }

  function funcaoDe(ctx, nome) {
    return ((ctx.calc && ctx.calc.funcoes) || []).filter(function (f) { return f.nome === nome; })[0] || null;
  }

  /* a função como aparece: o banco diz pelo lugar na viatura. Inteiro ("Efetivo 1 · Chefe de Socorro",
     "Efetivo 2 · Condutor") só na Ordem de importância; nos demais, o curto ("Chefe de Socorro",
     "Condutor"). O nome guardado não muda */
  function rotulo(ctx, nome, inteiro) {
    var f = funcaoDe(ctx, nome);
    if (f && f.rotulo) return inteiro ? f.rotulo : (f.curto || f.rotulo);
    var p = partes(nome);
    return f && f.papel ? p.funcao + ' · ' + f.papel : p.funcao;
  }

  /* "Posto · Função" (o posto curto) */
  function completo(ctx, nome, inteiro) {
    if (!nome) return '';
    return postoCurto(partes(nome).posto) + ' · ' + rotulo(ctx, nome, inteiro);
  }

  function papel(ctx) { return (ctx.calc && ctx.calc.papel) || ''; }
  function proprias(ctx) { return (papel(ctx) ? [papel(ctx)] : []).concat((ctx.resp && ctx.resp.ordem) || []); }

  /* ---------- erros e pendências do banco ---------- */

  function erros(ctx, chave) {
    return ((ctx.calc && ctx.calc.erros) || []).filter(function (e) { return e.chave === chave; }).map(function (e) { return e.texto; });
  }
  function pendente(ctx, chave) { return ((ctx.calc && ctx.calc.pendencias) || []).indexOf(chave) >= 0; }

  function erroCampo(destino, frase) {
    var p = tpl('erro-campo');
    p.textContent = frase;
    destino.appendChild(p);
    return p;
  }

  /* ---------- o que muda na mudança agendada (as diferenças do banco) ---------- */

  function diferenca(ctx, chave) {
    return ((ctx.calc && ctx.calc.diferencas) || []).filter(function (d) { return d.chave === chave; })[0] || null;
  }

  /* vendo a em vigor: "Muda em 10/11/2026: ..."; vendo a mudança agendada: "Antes: ..." */
  function fraseMuda(ctx, d) {
    return ctx.agenda && ctx.agenda.vendo ? texto(M().antes, { texto: d.la })
                                          : texto(M().mudaEm, { data: ctx.agenda ? ctx.agenda.data : '', texto: d.la });
  }

  /* a frase embaixo do que muda, em destino; com cartao, também a borda escura nele. Devolve se mudou */
  function marcarMuda(destino, ctx, chave, cartao) {
    var d = diferenca(ctx, chave);
    if (!d) return false;
    var linha = tpl('muda');
    linha.querySelector('.nova-distribuicao-muda-texto').textContent = fraseMuda(ctx, d);
    destino.appendChild(linha);
    if (cartao) cartao.classList.add('nova-distribuicao-cartao--muda');
    return true;
  }

  /* a marca pequena (na linha da ordem): o calendário, com a frase na dica */
  function marcaMuda(ctx, chave) {
    var d = diferenca(ctx, chave);
    if (!d) return null;
    var marca = tpl('muda-marca');
    marca.setAttribute('data-dica', fraseMuda(ctx, d));
    return marca;
  }

  /* troca o corpo da página por um molde (carregando, falha, vazio); frase = o texto dele */
  function mostrarNoCorpo(molde, frase) {
    var corpo = document.getElementById('nova-distribuicao-corpo');
    if (!corpo) return null;
    corpo.textContent = '';
    var no = tpl(molde);
    if (no && frase) no.textContent = frase;
    if (no) corpo.appendChild(no);
    return no;
  }

  /* o resumo dos erros no alto da página (frases) */
  function resumoErros(conteudo, frases) {
    if (!frases.length) return;
    var nota = tpl('erros');
    frases.forEach(function (frase) {
      var linha = tpl('erro');
      linha.textContent = frase;
      nota.querySelector('.nova-distribuicao-erros-lista').appendChild(linha);
    });
    conteudo.appendChild(nota);
  }

  /* ---------- estrutura ---------- */

  /* o bloco cinza da unidade, com o título dentro; devolve onde vão os cartões */
  function unidade(corpo, ctx) {
    var bloco = tpl('unidade-bloco');
    bloco.querySelector('.nova-distribuicao-unidade-nome').textContent = ctx.nome;
    bloco.querySelector('.nova-distribuicao-unidade-alcance').textContent = ctx.ehCia ? M().compartilhado : M().soDeste;
    corpo.appendChild(bloco);
    return bloco.querySelector('.nova-distribuicao-unidade-corpo');
  }

  /* as linhas da resposta: textos, ou { texto, falta, dica } */
  function respostas(lugar, linhas) {
    lugar.textContent = '';
    linhas.forEach(function (l) {
      var p = tpl('resposta-linha');
      var item = typeof l === 'string' ? { texto: l } : l;
      p.textContent = item.texto;
      if (item.falta) p.classList.add('nova-distribuicao-resposta-linha--falta');
      lugar.appendChild(p);
    });
  }

  /* cartão fechado com a resposta embaixo; ao clicar, abre as opções (montar).
     extra = { numeros, reserva, muda }: os números do efetivo ([mín., ideal, máx.] ou uma frase) e o selo
     Reserva no cabeçalho; muda = a chave
     (ou as chaves) da diferença que marca o cartão, fechado e aberto */
  function cartao(destino, api, ctx, id, titulo, linhas, montar, comErro, extra) {
    var caixa = tpl('cartao');
    var cab = caixa.querySelector('.nova-distribuicao-cartao-cabecalho');
    var aberto = api.aberto() === ctx.lado + ':' + id;
    caixa.querySelector('.nova-distribuicao-cartao-titulo').textContent = titulo;
    var numeros = caixa.querySelector('.nova-distribuicao-cartao-numeros');
    var valores = extra && extra.numeros;
    if (Array.isArray(valores)) {
      var colunas = tpl('numeros');
      colunas.querySelectorAll('[data-numero]').forEach(function (el) { el.textContent = String(valores[Number(el.getAttribute('data-numero'))]); });
      numeros.appendChild(colunas);
    } else numeros.textContent = valores || '';
    caixa.querySelector('.nova-distribuicao-cartao-reserva').classList.toggle('oculto', !(extra && extra.reserva));
    caixa.classList.toggle('nova-distribuicao-cartao--erro', !!comErro);
    var res = caixa.querySelector('.nova-distribuicao-cartao-resposta');
    respostas(res, linhas);
    cab.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    cab.addEventListener('click', function () { api.abrir(ctx.lado + ':' + id); });
    if (aberto) {
      var opcoes = caixa.querySelector('.nova-distribuicao-cartao-opcoes');
      opcoes.classList.remove('oculto');
      res.classList.add('oculto');
      montar(opcoes);
    }
    [].concat((extra && extra.muda) || []).forEach(function (chave) { marcarMuda(caixa, ctx, chave, caixa); });
    destino.appendChild(caixa);
    return caixa;
  }

  /* cartão sempre aberto; ctx e muda (a chave da diferença) marcam o que muda */
  function fixo(destino, titulo, montar, ctx, muda) {
    var caixa = tpl('cartao-fixo');
    var tit = caixa.querySelector('.nova-distribuicao-cartao-titulo');
    if (titulo) tit.textContent = titulo; else tit.classList.add('oculto');
    montar(caixa.querySelector('.nova-distribuicao-cartao-conteudo'));
    if (ctx && muda) marcarMuda(caixa, ctx, muda, caixa);
    destino.appendChild(caixa);
    return caixa;
  }

  function trava(destino, frase) {
    var t = tpl('trava');
    t.querySelector('.nova-distribuicao-trava-texto').textContent = frase;
    destino.appendChild(t);
    return t;
  }

  /* bloqueio = { sobe, desce }: o motivo de a seta ficar inativa (vira a dica dela) */
  function setas(linha, indice, total, aoMover, travado, bloqueio) {
    var subir = linha.querySelector('.nova-distribuicao-subir');
    var descer = linha.querySelector('.nova-distribuicao-descer');
    var motivos = bloqueio || {};
    subir.disabled = !!travado || indice === 0 || !!motivos.sobe;
    descer.disabled = !!travado || indice === total - 1 || !!motivos.desce;
    if (motivos.sobe && indice > 0) subir.setAttribute('data-dica', motivos.sobe);
    if (motivos.desce && indice < total - 1) descer.setAttribute('data-dica', motivos.desce);
    subir.addEventListener('click', function () { aoMover(-1); });
    descer.addEventListener('click', function () { aoMover(1); });
  }

  /* ---------- escolhas ---------- */

  /* caixa de marcar (botão role=checkbox com a .caixa-selecao dentro) */
  function marcar(botao, marcado, aoMudar, travado) {
    botao.setAttribute('aria-checked', marcado ? 'true' : 'false');
    botao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', !!marcado);
    botao.disabled = !!travado;
    if (aoMudar) botao.addEventListener('click', function () { aoMudar(!marcado); });
    return botao;
  }

  /* bolinhas do molde: marca a atual e avisa a escolhida */
  function bolinhas(caixa, nomeGrupo, marcado, aoMudar, travado) {
    caixa.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      var valor = inp.getAttribute('data-valor');
      inp.name = nomeGrupo;
      inp.checked = marcado(valor);
      inp.disabled = !!travado;
      inp.addEventListener('change', function () { aoMudar(valor); });
    });
    return caixa;
  }

  function prepararGatilho(caixa, textoAtual, vazio, rotuloCampo, travado, comErro) {
    var gatilho = caixa.querySelector('.campo-selecao');
    var alvo = gatilho.querySelector('.campo-selecao-texto');
    if (rotuloCampo) gatilho.setAttribute('aria-label', rotuloCampo);
    alvo.textContent = textoAtual || vazio || M().escolha;
    alvo.classList.toggle('campo-selecao-texto--vazio', !textoAtual);
    gatilho.disabled = !!travado;
    caixa.classList.toggle('nova-distribuicao-espaco--erro', !!comErro);
    return gatilho;
  }

  /* seleção com opções dos dados: itens = [{ valor, texto }]; op = { vazio, rotulo, travado, erro } */
  function selecao(itens, atual, aoEscolher, op) {
    op = op || {};
    var caixa = tpl('selecao');
    var menu = caixa.querySelector('.dropdown-menu');
    var escolhido = itens.filter(function (o) { return o.valor === atual; })[0];
    prepararGatilho(caixa, escolhido ? escolhido.texto : '', op.vazio, op.rotulo, op.travado, op.erro);
    itens.forEach(function (o) {
      var item = tpl('selecao-item');
      item.textContent = o.texto;
      if (o.valor === atual) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () { if (o.valor !== atual) aoEscolher(o.valor); });
      menu.appendChild(item);
    });
    return caixa;
  }

  /* seleção de função: a lista agrupada por posto, na ordem das funções do banco (os postos na ordem do
     bloco Postos e, dentro de cada um, o lugar); o título do posto com o nome inteiro e, embaixo, as funções */
  function selecaoFuncoes(ctx, nomes, atual, aoEscolher, op) {
    op = op || {};
    var caixa = tpl('selecao');
    var menu = caixa.querySelector('.dropdown-menu');
    menu.classList.add('nova-distribuicao-selecao-menu--funcoes');
    var gatilho = prepararGatilho(caixa, atual && nomes.indexOf(atual) >= 0 ? completo(ctx, atual) : '', op.vazio, op.rotulo, op.travado, op.erro);
    var cheio = partes(atual).posto;
    if (atual && CURTOS[cheio]) gatilho.setAttribute('data-dica', cheio);
    var ordem = ((ctx.calc && ctx.calc.funcoes) || []).map(function (f) { return f.nome; });
    var lugar = function (nome) { var k = ordem.indexOf(nome); return k < 0 ? ordem.length : k; };
    var postoAnterior = null;
    nomes.slice().sort(function (a, b) { return lugar(a) - lugar(b); }).forEach(function (nome) {
      var posto = partes(nome).posto;
      if (posto !== postoAnterior) {
        var titulo = tpl('selecao-posto');
        titulo.textContent = posto;
        menu.appendChild(titulo);
        postoAnterior = posto;
      }
      var item = tpl('selecao-funcao');
      item.textContent = rotulo(ctx, nome);
      if (nome === atual) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () { if (nome !== atual) aoEscolher(nome); });
      menu.appendChild(item);
    });
    return caixa;
  }

  /* seleção com as opções escritas no molde (praça/oficial, sentido, aviso) */
  function selecaoFixa(nome, atual, aoEscolher, travado, comErro) {
    var caixa = tpl(nome);
    var gatilho = caixa.querySelector('.campo-selecao');
    var alvo = gatilho.querySelector('.campo-selecao-texto');
    gatilho.disabled = !!travado;
    caixa.classList.toggle('nova-distribuicao-espaco--erro', !!comErro);
    caixa.querySelectorAll('.dropdown-item').forEach(function (item) {
      var valor = item.getAttribute('data-valor');
      if (atual != null && valor === String(atual)) {
        item.classList.add('dropdown-item--ativo');
        alvo.textContent = item.textContent;
        alvo.classList.remove('campo-selecao-texto--vazio');
      }
      item.addEventListener('click', function () { if (valor !== String(atual)) aoEscolher(valor); });
    });
    return caixa;
  }

  /* número (geral-dropdown-numeros) */
  function numero(de, ate, atual, aoEscolher, rotuloCampo, travado) {
    var caixa = tpl('numero');
    var opcoes = [];
    for (var n = de; n <= ate; n++) opcoes.push(n);
    prepararGatilho(caixa, String(atual), '', rotuloCampo, travado, false);
    RosterWork.dropdownNumeros.preencher(caixa.querySelector('.dropdown-menu'), {
      opcoes: opcoes, valor: atual, aoEscolher: function (v) { if (v !== atual) aoEscolher(v); }
    });
    return caixa;
  }

  window.RosterWork.novaDistribuicaoPecas = {
    FORMATO_PREFIXO: FORMATO_PREFIXO,
    tpl: tpl, texto: texto, mover: mover,
    partes: partes, postoCurto: postoCurto, funcaoDe: funcaoDe, rotulo: rotulo, completo: completo,
    papel: papel, proprias: proprias,
    erros: erros, pendente: pendente, erroCampo: erroCampo, resumoErros: resumoErros, mostrarNoCorpo: mostrarNoCorpo,
    diferenca: diferenca, marcarMuda: marcarMuda, marcaMuda: marcaMuda,
    unidade: unidade, respostas: respostas, cartao: cartao, fixo: fixo, trava: trava, setas: setas,
    marcar: marcar, bolinhas: bolinhas, selecao: selecao, selecaoFuncoes: selecaoFuncoes,
    selecaoFixa: selecaoFixa, numero: numero
  };
})();
