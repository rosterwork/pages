/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1 (Postos) e a substituição temporária
   Postos: as instalações (caixas de marcar) e as viaturas, uma
   por linha: Nº, prefixo (vale ao sair do campo; fora do formato
   fica só no campo, em vermelho), CNH de A a E alinhadas, setas,
   Substituir temporariamente e excluir; embaixo, os erros, o que
   muda na mudança agendada e as substituições da viatura. A
   substituição abre numa caixa embaixo da viatura, nas mesmas
   colunas (prefixo e CNH da que entra, início e fim), e grava na
   hora, com as datas dela; o resto da página continua como está
   até o Salvar.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* a substituição aberta embaixo da viatura: { viatura, s (nulo = nova), prefixo, cnh, inicio, fim, erros, sujo } */
  var formTroca = null;

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

  /* ---------- a substituição aberta embaixo da viatura (s nulo = nova); grava na hora ---------- */

  /* com algo digitado, confirma antes de largar a substituição aberta */
  function largarTroca(seguir) {
    if (!formTroca || !formTroca.sujo) { formTroca = null; seguir(); return; }
    RosterWork.confirmar({
      tipo: 'aviso', mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: B().descartar, textoCancelar: B().continuarEditando,
      aoConfirmar: function () { formTroca = null; seguir(); }
    });
  }

  /* abre uma por vez */
  function abrirTroca(api, viatura, s) {
    largarTroca(function () {
      formTroca = {
        viatura: viatura, s: s, prefixo: s ? s.prefixo : '', cnh: s ? s.cnh : null,
        inicio: s ? br(s.inicio) : '', fim: s ? br(s.fim) : '', erros: {}, sujo: false
      };
      api.focarDepois('#nova-distribuicao-troca-prefixo');
      api.redesenhar();
    });
  }

  /* confere os campos (as frases ficam em formTroca.erros, por campo); edições voltam no máximo até o limite */
  function conferirTroca(api) {
    var f = formTroca;
    var e = {};
    var limite = api.dados().limite;
    var trava = P().texto(M().trocaLimite, { data: br(limite) });
    var de = RosterWork.data.paraISO(f.inicio);
    var ate = RosterWork.data.paraISO(f.fim);
    if (!P().FORMATO_PREFIXO.test(f.prefixo)) e.prefixo = f.prefixo ? M().prefixoInvalido : M().prefixoVazio;
    else if (f.prefixo === f.viatura) e.prefixo = M().trocaMesmoPrefixo;
    if (!f.cnh) e.cnh = M().trocaEscolhaCnh;
    if (!de) e.inicio = M().erroInicio;
    else if (de < limite && !(f.s && f.s.comecou_antes)) e.inicio = trava;
    if (!ate) e.fim = M().trocaErroFim;
    else if (de && ate < de) e.fim = M().erroOrdemDatas;
    else if (ate < limite) e.fim = trava;
    f.erros = e;
    return !Object.keys(e).length;
  }

  function salvarTroca(api, botao) {
    var f = formTroca;
    if (!conferirTroca(api)) { api.redesenhar(); return; }
    RosterWork.iniciarCarregando(botao);
    D().substituicaoSalvar(api.unidadeId(), f.s && f.s.id, f.viatura, f.prefixo, f.cnh,
      RosterWork.data.paraISO(f.inicio), RosterWork.data.paraISO(f.fim)).then(function (r) {
      RosterWork.pararCarregando(botao);
      if (!r || !r.success) { falhou(r); return; }
      formTroca = null;
      RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
      api.recarregarSubstituicoes();
    }, function () {
      RosterWork.pararCarregando(botao);
      semConexao();
    });
  }

  /* a caixa: o prefixo e a CNH da que entra nas colunas da viatura, o início e o fim; as frases embaixo
     (somem do campo que muda) */
  function caixaTroca(destino, api, ctx) {
    var f = formTroca;
    var caixa = P().tpl('troca-caixa');
    var campos = {
      prefixo: caixa.querySelector('.nova-distribuicao-troca-prefixo'),
      cnh: caixa.querySelector('.nova-distribuicao-troca-cnh'),
      inicio: caixa.querySelector('.nova-distribuicao-troca-inicio'),
      fim: caixa.querySelector('.nova-distribuicao-troca-fim')
    };
    var lista = caixa.querySelector('.nova-distribuicao-troca-erros');
    var frases = {};
    Object.keys(campos).forEach(function (c) {
      campos[c].classList.toggle(c === 'cnh' ? 'nova-distribuicao-espaco--erro' : 'nova-distribuicao-entrada--erro', !!f.erros[c]);
      if (f.erros[c]) frases[c] = P().erroCampo(lista, f.erros[c]);
    });
    lista.classList.toggle('oculto', !lista.children.length);
    function mudou(c) {
      f.sujo = true;
      if (!f.erros[c]) return;
      delete f.erros[c];
      campos[c].classList.remove(c === 'cnh' ? 'nova-distribuicao-espaco--erro' : 'nova-distribuicao-entrada--erro');
      frases[c].remove();
      lista.classList.toggle('oculto', !lista.children.length);
    }

    campos.prefixo.value = f.prefixo;
    campos.prefixo.addEventListener('input', function () {
      var pos = campos.prefixo.selectionStart;
      campos.prefixo.value = campos.prefixo.value.toUpperCase();
      try { campos.prefixo.setSelectionRange(pos, pos); } catch (e) {}
      f.prefixo = campos.prefixo.value.trim();
      mudou('prefixo');
    });
    campos.cnh.querySelectorAll('.aba').forEach(function (aba) { aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === f.cnh); });
    RosterWork.abas.ligar(campos.cnh, function (aba) { f.cnh = aba.getAttribute('data-valor'); mudou('cnh'); });
    ['inicio', 'fim'].forEach(function (c) {
      campos[c].value = f[c];
      RosterWork.campos.ligarData(campos[c]);
      campos[c].addEventListener('input', function () { f[c] = campos[c].value; mudou(c); });
    });
    campos.inicio.disabled = !!(f.s && f.s.comecou_antes);   /* a que começou antes do limite dos 7 dias só muda o fim */

    var excluir = caixa.querySelector('.nova-distribuicao-remover');
    excluir.classList.toggle('oculto', !f.s);
    excluir.disabled = ctx.soLeitura || !!(f.s && f.s.comecou_antes);
    excluir.addEventListener('click', function () { excluirTroca(api, f.viatura, f.s); });
    caixa.querySelector('.nova-distribuicao-troca-cancelar').addEventListener('click', function () { formTroca = null; api.redesenhar(); });
    var salvar = caixa.querySelector('.nova-distribuicao-troca-salvar');
    salvar.addEventListener('click', function () { salvarTroca(api, salvar); });
    destino.appendChild(caixa);
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
          if (formTroca && formTroca.s && formTroca.s.id === s.id) formTroca = null;
          RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
          api.recarregarSubstituicoes();
        }, function () {
          RosterWork.liberarTela();
          semConexao();
        });
      }
    });
  }

  /* a viatura mudou de prefixo ou saiu: a substituição aberta dela fecha */
  function fecharTrocaDe(nome) { if (formTroca && formTroca.viatura === nome) formTroca = null; }

  /* ---------- 1. Postos ---------- */

  function linhaViatura(lista, ctx, api, v, i, total) {
    var linha = P().tpl('viatura');
    var chave = ctx.lado + ':viatura:' + i;
    var digitado = api.invalido(chave);
    /* a viatura nova sem prefixo só acusa quando o campo fica vazio ao sair (ou no Salvar) */
    var erros = digitado != null ? [digitado ? M().prefixoInvalido : M().prefixoVazio] : (v.nome ? P().erros(ctx, 'viatura:' + i) : []);
    /* a falta da CNH é desta linha (com prefixo repetido, a outra viatura não acende) */
    var faltaCnh = !!v.nome && !v.cnh && P().pendente(ctx, 'carteira:' + v.nome);

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
      if (novo && novo === v.nome) { api.invalido(chave, null); api.redesenhar(); return; }
      if (!P().FORMATO_PREFIXO.test(novo)) { api.invalido(chave, inp.value.trim()); api.redesenhar(); return; }
      api.invalido(chave, null);
      fecharTrocaDe(v.nome);
      api.renomear(ctx.lado, i, v.nome, novo);
    });
    /* saiu do campo vazio sem digitar: acusa só nesta linha, sem redesenhar (o clique que tirou o foco
       não se perde); o campo tirado da tela por um redesenho não acusa */
    inp.addEventListener('blur', function () {
      setTimeout(function () {
        if (!inp.isConnected || v.nome || inp.value.trim() || api.invalido(chave) != null) return;
        api.invalido(chave, '');
        inp.classList.add('nova-distribuicao-entrada--erro');
        P().erroCampo(extra, M().prefixoVazio);
        extra.classList.remove('oculto');
      }, 0);
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
      fecharTrocaDe(v.nome);
      api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); });
    });

    var extra = linha.querySelector('.nova-distribuicao-viatura-extra');
    erros.forEach(function (e) { P().erroCampo(extra, e); });
    if (faltaCnh) P().erroCampo(extra, M().cnhEscolha);
    if (v.nome) P().marcarMuda(extra, ctx, 'viatura:' + v.nome);
    extra.classList.toggle('oculto', !extra.children.length);

    var subs = linha.querySelector('.nova-distribuicao-viatura-substituicoes');
    var aberta = formTroca && formTroca.viatura === v.nome ? formTroca : null;
    api.substituicoesDe(v.nome).forEach(function (s) {
      if (aberta && aberta.s && aberta.s.id === s.id) { caixaTroca(subs, api, ctx); return; }
      var lt = P().tpl('troca');
      lt.querySelector('.nova-distribuicao-troca-texto').textContent = textoTroca(s);
      var editar = lt.querySelector('.nova-distribuicao-editar');
      var tirar = lt.querySelector('.nova-distribuicao-remover');
      editar.disabled = ctx.soLeitura || !gravada;
      tirar.disabled = ctx.soLeitura || !gravada || s.comecou_antes;
      editar.addEventListener('click', function () { abrirTroca(api, s.viatura, s); });
      tirar.addEventListener('click', function () { excluirTroca(api, s.viatura, s); });
      subs.appendChild(lt);
    });
    if (aberta && !aberta.s) caixaTroca(subs, api, ctx);
    subs.classList.toggle('oculto', !subs.children.length);
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
    /* as viaturas ainda sem prefixo da unidade e da companhia, na chave dos digitados ('lado:viatura:i') */
    semPrefixo: function (resp, respCia) {
      return [['unidade', resp], ['companhia', respCia]].reduce(function (lista, par) {
        return lista.concat(((par[1] && par[1].viaturas) || []).map(function (v, i) { return v.nome ? null : par[0] + ':viatura:' + i; }));
      }, []).filter(Boolean);
    },
    /* a substituição aberta tem algo digitado (o descarte e o guarda de saída) */
    sujo: function () { return !!(formTroca && formTroca.sujo); },
    /* larga a substituição aberta (descarte confirmado ou outra unidade) */
    descartar: function () { formTroca = null; }
  };
})();
