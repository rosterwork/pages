/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1 (Postos) e a substituição por tempo
   Postos: as instalações (caixas de marcar) e as viaturas, uma
   por linha: Nº, prefixo (vale ao sair do campo; fora do formato
   fica só no campo, em vermelho), CNH de A a E alinhadas, setas,
   Substituir por tempo determinado e excluir; embaixo, as
   substituições da viatura, os erros e o que muda na mudança
   agendada. A substituição abre no painel da direita (prefixo e
   CNH da viatura que entra, de e até) e grava na hora, com as
   datas dela; o resto da página continua como está até o Salvar.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var formTroca = null;   /* a substituição aberta no painel */

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function G() { return RosterWork.mensagens.geral; }
  function B() { return RosterWork.mensagens.botoes; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function D() { return RosterWork.novaDistribuicaoDados; }
  function br(iso) { return RosterWork.data.isoParaBR(iso); }

  function textoTroca(s) {
    return P().texto(M().trocaTexto, { prefixo: s.prefixo, cnh: s.cnh || '?', inicio: br(s.inicio), fim: br(s.fim) });
  }

  function falhou(r) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || G().falhaServidor }); }
  function semConexao() { RosterWork.avisar({ tipo: 'erro', mensagem: G().semConexao }); }

  /* ---------- a substituição no painel da direita (s nulo = nova) ---------- */

  function erro(alvo, frase) {
    var campo = alvo.closest('.campo');
    campo.classList.toggle('campo--erro', !!frase);
    campo.querySelector('.campo-erro-texto').textContent = frase || '';
    return !!frase;
  }

  function abrirTroca(api, viatura, s) {
    var painel = RosterWork.painel;
    var atual = s || {};
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
    inicio.disabled = !!atual.comecou_antes;   /* a que começou antes do limite dos 7 dias só muda o fim */
    cnh.querySelectorAll('.aba').forEach(function (aba) { aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === formTroca.cnh); });

    painel.abrir({ titulo: M().trocaTitulo, subtitulo: P().texto(M().trocaSubtitulo, { viatura: viatura }), aoFechar: function () { formTroca = null; } });
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
    var salvar = rodape.querySelector('.nova-distribuicao-painel-aplicar');
    salvar.addEventListener('click', function () {
      var novo = prefixo.value.trim().toUpperCase();
      var de = RosterWork.data.paraISO(inicio.value);
      var ate = RosterWork.data.paraISO(fim.value);
      var comErro = false;
      if (!P().FORMATO_PREFIXO.test(novo)) comErro = erro(prefixo, M().prefixoInvalido) || comErro;
      else if (novo === viatura) comErro = erro(prefixo, M().trocaMesmoPrefixo) || comErro;
      if (!formTroca.cnh) comErro = erro(cnh, M().trocaEscolhaCnh) || comErro;
      if (!de) comErro = erro(inicio, M().erroInicio) || comErro;
      if (!ate) comErro = erro(fim, M().trocaErroFim) || comErro;
      else if (de && ate < de) comErro = erro(fim, M().erroOrdemDatas) || comErro;
      if (comErro) return;
      RosterWork.iniciarCarregando(salvar);
      D().substituicaoSalvar(api.unidadeId(), atual.id, viatura, novo, formTroca.cnh, de, ate).then(function (r) {
        RosterWork.pararCarregando(salvar);
        if (!r || !r.success) { falhou(r); return; }
        formTroca = null;
        painel.fechar();
        RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
        api.recarregarSubstituicoes();
      }, function () {
        RosterWork.pararCarregando(salvar);
        semConexao();
      });
    });
  }

  function excluirTroca(api, viatura, s) {
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: P().texto(M().excluirSubstituicao, { viatura: viatura, texto: textoTroca(s) }),
      textoConfirmar: M().botaoExcluir, textoCancelar: B().cancelar,
      aoConfirmar: function () {
        RosterWork.bloquearTela();
        D().substituicaoExcluir(s.id).then(function (r) {
          RosterWork.liberarTela();
          if (!r || !r.success) { falhou(r); return; }
          RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
          api.recarregarSubstituicoes();
        }, function () {
          RosterWork.liberarTela();
          semConexao();
        });
      }
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
    /* substituir: a viatura precisa estar gravada (a nova ou com o prefixo trocado espera o Salvar) */
    var gravada = api.viaturaGravada(v.nome);
    var trocar = linha.querySelector('.nova-distribuicao-trocar');
    trocar.disabled = ctx.soLeitura || !gravada || digitado != null;
    trocar.addEventListener('click', function () { abrirTroca(api, v.nome, null); });
    var remover = linha.querySelector('.nova-distribuicao-remover');
    remover.disabled = ctx.soLeitura;
    remover.addEventListener('click', function () {
      api.esquecerInvalidos(ctx.lado);
      api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); });
    });

    var extra = linha.querySelector('.nova-distribuicao-viatura-extra');
    api.substituicoesDe(v.nome).forEach(function (s) {
      var lt = P().tpl('troca');
      lt.querySelector('.nova-distribuicao-troca-texto').textContent = textoTroca(s);
      var editar = lt.querySelector('.nova-distribuicao-editar');
      var tirar = lt.querySelector('.nova-distribuicao-remover');
      editar.disabled = ctx.soLeitura || !gravada;
      tirar.disabled = ctx.soLeitura || !gravada || s.comecou_antes;
      editar.addEventListener('click', function () { abrirTroca(api, s.viatura, s); });
      tirar.addEventListener('click', function () { excluirTroca(api, s.viatura, s); });
      extra.appendChild(lt);
    });
    erros.forEach(function (e) { P().erroCampo(extra, e); });
    if (faltaCnh) P().erroCampo(extra, M().cnhEscolha);
    if (v.nome) P().marcarMuda(extra, ctx, 'viatura:' + v.nome);
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
    }, ctx, 'instalacoes');

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
        api.mudar(ctx.lado, function (x) { x.viaturas.push({ nome: '', cnh: null, efetivo: [null, null, null] }); });
      });
      lugar.appendChild(nova);
    }, ctx, 'viaturas');
  }

  window.RosterWork.novaDistribuicaoPostos = {
    postos: postos,
    /* o painel da substituição tem algo digitado (para o guarda de saída) */
    sujo: function () { return !!(formTroca && formTroca.sujo && RosterWork.painel.estaAberto()); }
  };
})();
