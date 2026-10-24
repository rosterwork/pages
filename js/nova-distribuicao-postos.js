/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1 (Postos) e a troca de viatura
   Postos: as instalações (caixas de marcar) e as viaturas, uma
   por linha: Nº, prefixo (vale ao sair do campo; fora do formato
   fica só no campo, em vermelho), CNH de A a E alinhadas, setas,
   Trocar por um tempo e excluir; embaixo, as trocas da viatura.
   A troca abre no painel da direita (prefixo e CNH da viatura que
   entra, de e até, dentro do período) e vai para a tela com o
   Aplicar; o Salvar da página grava. Toda mudança passa pelo
   api.mudar (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var formTroca = null;   /* a troca aberta no painel */

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function br(iso) { return RosterWork.data.isoParaBR(iso); }

  function textoTroca(t) {
    return P().texto(M().trocaTexto, { prefixo: t.prefixo, cnh: t.cnh || '?', inicio: br(t.inicio), fim: br(t.fim) });
  }

  /* ---------- a troca no painel da direita (k nulo = nova) ---------- */

  function erro(alvo, frase) {
    var campo = alvo.closest('.campo');
    campo.classList.toggle('campo--erro', !!frase);
    campo.querySelector('.campo-erro-texto').textContent = frase || '';
    return !!frase;
  }

  function abrirTroca(ctx, api, i, k) {
    var painel = RosterWork.painel;
    var v = ctx.resp.viaturas[i];
    var atual = k == null ? {} : v.trocas[k];
    var per = api.periodo();
    var caixa = P().tpl('troca-painel');
    var rodape = P().tpl('troca-rodape');
    var prefixo = caixa.querySelector('.nova-distribuicao-troca-prefixo');
    var cnh = caixa.querySelector('.nova-distribuicao-troca-cnh');
    var inicio = caixa.querySelector('.nova-distribuicao-troca-inicio');
    var fim = caixa.querySelector('.nova-distribuicao-troca-fim');
    formTroca = { cnh: atual.cnh || null, sujo: false };

    prefixo.value = atual.prefixo || '';
    inicio.value = atual.inicio ? br(atual.inicio) : '';
    fim.value = atual.fim ? br(atual.fim) : '';
    cnh.querySelectorAll('.aba').forEach(function (aba) { aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === formTroca.cnh); });
    caixa.querySelector('.nova-distribuicao-troca-ajuda').textContent = per.fim
      ? P().texto(M().trocaDentro, { inicio: br(per.inicio), fim: br(per.fim) })
      : P().texto(M().trocaDentroSemFim, { inicio: br(per.inicio) });

    painel.abrir({ titulo: M().trocaTitulo, subtitulo: P().texto(M().trocaSubtitulo, { viatura: v.nome }), aoFechar: function () { formTroca = null; } });
    painel.corpo().appendChild(caixa);
    painel.rodape().appendChild(rodape);
    painel.rodape().classList.remove('oculto');

    prefixo.addEventListener('input', function () {
      var pos = prefixo.selectionStart;
      prefixo.value = prefixo.value.toUpperCase();
      try { prefixo.setSelectionRange(pos, pos); } catch (e) {}
      formTroca.sujo = true;
      erro(prefixo, '');
    });
    RosterWork.abas.ligar(cnh, function (aba) { formTroca.cnh = aba.getAttribute('data-valor'); formTroca.sujo = true; erro(cnh, ''); });
    [inicio, fim].forEach(function (input) {
      RosterWork.campos.ligarData(input);
      input.addEventListener('input', function () { formTroca.sujo = true; erro(input, ''); });
    });

    rodape.querySelector('.nova-distribuicao-painel-cancelar').addEventListener('click', function () { painel.fechar(); });
    rodape.querySelector('.nova-distribuicao-painel-aplicar').addEventListener('click', function () {
      var novo = prefixo.value.trim().toUpperCase();
      var de = RosterWork.data.paraISO(inicio.value);
      var ate = RosterWork.data.paraISO(fim.value);
      var falhou = false;
      if (!P().FORMATO_PREFIXO.test(novo)) falhou = erro(prefixo, M().prefixoInvalido) || falhou;
      else if (novo === v.nome) falhou = erro(prefixo, M().trocaMesmoPrefixo) || falhou;
      if (!formTroca.cnh) falhou = erro(cnh, M().trocaEscolhaCnh) || falhou;
      if (!de) falhou = erro(inicio, M().erroInicio) || falhou;
      if (!ate) falhou = erro(fim, M().trocaErroFim) || falhou;
      else if (de && ate < de) falhou = erro(fim, M().erroOrdemDatas) || falhou;
      if (de && ate && (de < per.inicio || (per.fim && ate > per.fim))) falhou = erro(inicio, M().trocaForaPeriodo) || falhou;
      if (falhou) return;
      var troca = { prefixo: novo, cnh: formTroca.cnh, inicio: de, fim: ate };
      formTroca = null;
      painel.fechar();
      api.mudar(ctx.lado, function (x) {
        var lista = x.viaturas[i].trocas = x.viaturas[i].trocas || [];
        if (k == null) lista.push(troca); else lista[k] = troca;
      });
    });
  }

  /* ---------- 1. Postos ---------- */

  function linhaViatura(lista, ctx, api, v, i, total) {
    var linha = P().tpl('viatura');
    var chave = ctx.lado + ':viatura:' + i;
    var digitado = api.invalido(chave);
    var erros = digitado != null ? [M().prefixoInvalido] : P().erros(ctx, 'viatura:' + i);
    var faltaCnh = !!v.nome && P().pendente(ctx, 'carteira:' + v.nome);

    linha.querySelector('.nova-distribuicao-linha-ordem').textContent = (i + 1) + 'º';
    var inp = linha.querySelector('.nova-distribuicao-prefixo');
    inp.id = 'nova-distribuicao-prefixo-' + ctx.lado + '-' + i;
    inp.value = digitado != null ? digitado : v.nome;
    inp.disabled = ctx.soLeitura;
    inp.classList.toggle('nova-distribuicao-entrada--erro', erros.length > 0);
    inp.addEventListener('input', function () {
      var pos = inp.selectionStart;
      inp.value = inp.value.toUpperCase();
      try { inp.setSelectionRange(pos, pos); } catch (e) {}
    });
    inp.addEventListener('change', function () {
      var novo = inp.value.trim().toUpperCase();
      if (novo === v.nome) { api.invalido(chave, null); api.redesenhar(); return; }
      if (!P().FORMATO_PREFIXO.test(novo)) { api.invalido(chave, inp.value); api.redesenhar(); return; }
      api.invalido(chave, null);
      api.renomear(ctx.lado, i, v.nome, novo);
    });

    var cnh = linha.querySelector('.nova-distribuicao-cnh');
    cnh.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === v.cnh);
      aba.disabled = ctx.soLeitura;
    });
    cnh.classList.toggle('nova-distribuicao-espaco--erro', faltaCnh);
    RosterWork.abas.ligar(cnh, function (aba) {
      var c = aba.getAttribute('data-valor');
      if (c !== v.cnh) api.mudar(ctx.lado, function (x) { x.viaturas[i].cnh = c; });
    });

    P().setas(linha, i, total, function (passo) {
      api.esquecerInvalidos(ctx.lado);
      api.mudar(ctx.lado, function (x) { P().mover(x.viaturas, i, passo); });
    }, ctx.soLeitura);
    var trocar = linha.querySelector('.nova-distribuicao-trocar');
    trocar.disabled = ctx.soLeitura || !v.nome || digitado != null;
    trocar.addEventListener('click', function () { abrirTroca(ctx, api, i, null); });
    var remover = linha.querySelector('.nova-distribuicao-remover');
    remover.disabled = ctx.soLeitura;
    remover.addEventListener('click', function () {
      api.esquecerInvalidos(ctx.lado);
      api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); });
    });

    var extra = linha.querySelector('.nova-distribuicao-viatura-extra');
    (v.trocas || []).forEach(function (t, k) {
      var lt = P().tpl('troca');
      lt.querySelector('.nova-distribuicao-troca-texto').textContent = textoTroca(t);
      var editar = lt.querySelector('.nova-distribuicao-editar');
      var tirar = lt.querySelector('.nova-distribuicao-remover');
      editar.disabled = ctx.soLeitura;
      tirar.disabled = ctx.soLeitura;
      editar.addEventListener('click', function () { abrirTroca(ctx, api, i, k); });
      tirar.addEventListener('click', function () { api.mudar(ctx.lado, function (x) { x.viaturas[i].trocas.splice(k, 1); }); });
      extra.appendChild(lt);
      P().erros(ctx, 'troca:' + i + ':' + k).forEach(function (e) { P().erroCampo(extra, e); });
    });
    erros.forEach(function (e) { P().erroCampo(extra, e); });
    if (faltaCnh) P().erroCampo(extra, M().cnhEscolha);
    extra.classList.toggle('oculto', !extra.children.length);
    lista.appendChild(linha);
  }

  function postos(corpo, ctx, api) {
    var r = ctx.resp;
    var nomesInst = (r.instalacoes || []).map(function (i) { return i.nome; });
    var vtrs = r.viaturas || [];
    corpo.appendChild(P().tpl('nota-postos'));
    var u = P().unidade(corpo, ctx);

    P().fixo(u, ctx.ehCia ? M().instalacoesCompanhia : M().instalacoesPelotao, function (lugar) {
      var opcoes = P().tpl('instalacoes');
      opcoes.querySelectorAll('[data-valor]').forEach(function (botao) {
        var nome = botao.getAttribute('data-valor');
        P().marcar(botao, nomesInst.indexOf(nome) >= 0, function (marcado) {
          api.mudar(ctx.lado, function (x) {
            if (marcado) x.instalacoes.push({ nome: nome, efetivo: [null, null, null] });
            else x.instalacoes = x.instalacoes.filter(function (o) { return o.nome !== nome; });
          });
        }, ctx.soLeitura);
      });
      lugar.appendChild(opcoes);
    });

    P().fixo(u, ctx.ehCia ? M().viaturasCompanhia : M().viaturasPelotao, function (lugar) {
      lugar.appendChild(P().tpl('nota-viaturas'));
      var tabela = P().tpl('viaturas');
      var lista = tabela.querySelector('.nova-distribuicao-viaturas-lista');
      tabela.querySelector('.nova-distribuicao-viaturas-cabecalho').classList.toggle('oculto', !vtrs.length);
      if (!vtrs.length) P().respostas(lista, [M().nenhuma]);
      vtrs.forEach(function (v, i) { linhaViatura(lista, ctx, api, v, i, vtrs.length); });
      lugar.appendChild(tabela);
      var nova = P().tpl('nova-viatura');
      nova.disabled = ctx.soLeitura;
      nova.addEventListener('click', function () {
        api.focarDepois('#nova-distribuicao-prefixo-' + ctx.lado + '-' + vtrs.length);
        api.mudar(ctx.lado, function (x) { x.viaturas.push({ nome: '', cnh: null, efetivo: [null, null, null], trocas: [] }); });
      });
      lugar.appendChild(nova);
    });
  }

  window.RosterWork.novaDistribuicaoPostos = {
    postos: postos,
    /* o painel da troca tem algo digitado (para o guarda de saída) */
    sujo: function () { return !!(formTroca && formTroca.sujo && RosterWork.painel.estaAberto()); }
  };
})();
