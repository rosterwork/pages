/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1 (Postos) e a substituição temporária
   Postos: as instalações (caixas de marcar) e as viaturas, uma
   por linha: Nº, prefixo (vale ao sair do campo; fora do formato
   fica só no campo, em vermelho), CNH de A a E alinhadas, setas,
   Substituir temporariamente e excluir; embaixo, os erros, o que
   muda na mudança agendada e as substituições da viatura. A
   substituição abre numa caixa no lugar da viatura (o Nº fora da
   linha, a viatura como título fixo, os campos da substituta nas
   mesmas colunas), com Cancelar e Concluir, e fica no rascunho,
   como o resto da página: vai no Salvar e sai no Cancelar do
   rodapé. Uma por viatura: enquanto uma não terminou, o Substituir
   temporariamente dela fica inativo.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* as substituições mudadas e ainda não salvas (vão no Salvar da página), uma entrada por substituição:
     { chave, id (nulo = nova), unidade_id, viatura, prefixo, cnh, inicio, fim (dd/mm/aaaa), comecou_antes,
     excluir, original (a gravada), antes (os campos quando a caixa abriu), concluida (a nova já concluída), erros } */
  var rascunho = [];
  var novas = 0;
  var aberta = null;   /* a chave da substituição aberta na caixa (uma por vez) */

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function br(iso) { return RosterWork.data.isoParaBR(iso); }
  function vazio(x) { return x == null || x === ''; }

  /* ---------- a substituição temporária, no rascunho da página ---------- */

  /* a gravada como entrada (vai para o rascunho quando abre ou sai) */
  function comoEntrada(s) {
    return {
      chave: s.id, id: s.id, unidade_id: null, viatura: s.viatura, prefixo: s.prefixo, cnh: s.cnh,
      inicio: br(s.inicio), fim: br(s.fim), comecou_antes: !!s.comecou_antes, excluir: false, original: s, erros: {}
    };
  }
  function entradaDe(s) {
    var e = rascunho.filter(function (x) { return x.id === s.id; })[0];
    if (!e) { e = comoEntrada(s); rascunho.push(e); }
    return e;
  }

  /* mudou em relação à gravada (a nova, quando tem algo digitado) */
  function mudou(e) {
    if (e.excluir) return true;
    if (!e.id) return !vazio(e.prefixo) || !vazio(e.cnh) || !vazio(e.inicio) || !vazio(e.fim);
    var o = e.original;
    return e.prefixo !== o.prefixo || e.cnh !== o.cnh || e.inicio !== br(o.inicio) || e.fim !== br(o.fim);
  }

  function textoTroca(e) {
    return P().texto(M().trocaTexto, { prefixo: e.prefixo || '?', cnh: e.cnh || '?', inicio: e.inicio || '?', fim: e.fim || '?' });
  }

  /* abre uma por vez (a que estava aberta sem mudança sai do rascunho); guarda os campos de agora para o Cancelar */
  function abrirTroca(api, e) {
    rascunho = rascunho.filter(function (x) { return x === e || mudou(x); });
    if (rascunho.indexOf(e) < 0) rascunho.push(e);
    e.antes = { prefixo: e.prefixo, cnh: e.cnh, inicio: e.inicio, fim: e.fim };
    aberta = e.chave;
    api.focarDepois('#nova-distribuicao-troca-prefixo');
    api.redesenhar();
  }

  /* Cancelar: desfaz o que foi digitado desde que a caixa abriu (a nova ainda não concluída sai) e fecha */
  function cancelarTroca(api, e) {
    if (!e.id && !e.concluida) rascunho = rascunho.filter(function (x) { return x !== e; });
    else Object.keys(e.antes).forEach(function (c) { e[c] = e.antes[c]; });
    e.erros = {};
    aberta = null;
    rascunho = rascunho.filter(mudou);
    api.redesenhar();
  }

  /* Concluir: confere os campos; com erro, as frases aparecem e a caixa continua aberta; sem erro, fecha
     (o que foi digitado fica no rascunho até o Salvar da página) */
  function concluirTroca(api, e) {
    e.erros = errosDe(e, api.dados().limite);
    if (!Object.keys(e.erros).length) {
      e.concluida = true;
      aberta = null;
      rascunho = rascunho.filter(mudou);
    }
    api.redesenhar();
  }

  /* a lixeira (só na linha fechada): a nova sai do rascunho; a gravada fica marcada e sai no Salvar */
  function excluirTroca(api, e) {
    if (e.id) entradaDe(e.original).excluir = true;
    else rascunho = rascunho.filter(function (x) { return x !== e; });
    if (aberta === e.chave) aberta = null;
    api.redesenhar();
  }

  /* as frases de uma substituição, por campo; edições voltam no máximo até o limite */
  function errosDe(f, limite) {
    var e = {};
    var trava = P().texto(M().trocaLimite, { data: br(limite) });
    var de = RosterWork.data.paraISO(f.inicio);
    var ate = RosterWork.data.paraISO(f.fim);
    if (!P().FORMATO_PREFIXO.test(f.prefixo || '')) e.prefixo = f.prefixo ? M().prefixoInvalido : M().prefixoVazio;
    else if (f.prefixo === f.viatura) e.prefixo = M().trocaMesmoPrefixo;
    if (!f.cnh) e.cnh = M().trocaEscolhaCnh;
    if (!de) e.inicio = M().erroInicio;
    else if (de < limite && !f.comecou_antes) e.inicio = trava;
    if (!ate) e.fim = M().trocaErroFim;
    else if (de && ate < de) e.fim = M().erroOrdemDatas;
    else if (ate < limite) e.fim = trava;
    return e;
  }

  /* antes do Salvar: confere as mudadas (as frases ficam em cada uma e a 1ª com erro abre) */
  function conferirTrocas(dados) {
    var primeira = null;
    rascunho.forEach(function (f) {
      f.erros = mudou(f) && !f.excluir ? errosDe(f, dados.limite) : {};
      if (!primeira && Object.keys(f.erros).length) primeira = f;
    });
    if (primeira) aberta = primeira.chave;
    return !primeira;
  }

  /* o que vai para o banco no Salvar */
  function operacoes() {
    return rascunho.filter(mudou).map(function (e) {
      if (e.excluir) return { id: e.id, excluir: true };
      return {
        id: e.id, unidade_id: e.unidade_id, viatura: e.viatura, prefixo: e.prefixo, cnh: e.cnh,
        inicio: RosterWork.data.paraISO(e.inicio), fim: RosterWork.data.paraISO(e.fim)
      };
    });
  }

  /* a caixa no lugar da viatura: o Nº, a viatura como título fixo e os campos da substituta com os rótulos;
     as frases de erro embaixo (somem do campo que muda); Cancelar e Concluir no pé */
  function caixaTroca(destino, api, ctx, v, numero, f) {
    var caixa = P().tpl('troca-caixa');
    caixa.querySelector('.nova-distribuicao-linha-ordem').textContent = numero + 'º';
    caixa.querySelector('.nova-distribuicao-troca-viatura').textContent = v.cnh ? P().texto(M().tituloViatura, { nome: v.nome, cnh: v.cnh }) : v.nome;
    caixa.querySelector('.nova-distribuicao-troca-tipo-gravada').classList.toggle('oculto', !f.id);
    caixa.querySelector('.nova-distribuicao-troca-tipo-nova').classList.toggle('oculto', !!f.id);
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
    /* mudou um campo: o rodapé mostra "Alterações não salvas" e a frase desse campo sai */
    function marcar(c) {
      api.atualizarRodape();
      if (!f.erros[c]) return;
      delete f.erros[c];
      campos[c].classList.remove(c === 'cnh' ? 'nova-distribuicao-espaco--erro' : 'nova-distribuicao-entrada--erro');
      frases[c].remove();
      lista.classList.toggle('oculto', !lista.children.length);
    }

    campos.prefixo.value = f.prefixo || '';
    campos.prefixo.disabled = ctx.soLeitura;
    campos.prefixo.addEventListener('input', function () {
      var pos = campos.prefixo.selectionStart;
      campos.prefixo.value = campos.prefixo.value.toUpperCase();
      try { campos.prefixo.setSelectionRange(pos, pos); } catch (e) {}
      f.prefixo = campos.prefixo.value.trim();
      marcar('prefixo');
    });
    campos.cnh.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === f.cnh);
      aba.disabled = ctx.soLeitura;
    });
    RosterWork.abas.ligar(campos.cnh, function (aba) { f.cnh = aba.getAttribute('data-valor'); marcar('cnh'); });
    ['inicio', 'fim'].forEach(function (c) {
      campos[c].value = f[c] || '';
      campos[c].disabled = ctx.soLeitura;
      RosterWork.campos.ligarData(campos[c]);
      campos[c].addEventListener('input', function () { f[c] = campos[c].value; marcar(c); });
    });
    if (f.comecou_antes) campos.inicio.disabled = true;   /* a que começou antes do limite dos 7 dias só muda o fim */

    var cancelar = caixa.querySelector('.nova-distribuicao-troca-cancelar');
    var concluir = caixa.querySelector('.nova-distribuicao-troca-concluir');
    concluir.disabled = ctx.soLeitura;
    cancelar.addEventListener('click', function () { cancelarTroca(api, f); });
    concluir.addEventListener('click', function () { concluirTroca(api, f); });
    destino.appendChild(caixa);
  }

  /* a viatura mudou de prefixo ou saiu: a caixa dela fecha (e, se ela saiu, as novas dela também saem) */
  function fecharTrocaDe(nome, saiu) {
    var e = rascunho.filter(function (x) { return x.chave === aberta; })[0];
    if (e && e.viatura === nome) aberta = null;
    if (saiu) rascunho = rascunho.filter(function (x) { return x.id || x.viatura !== nome; });
  }

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
    trocar.addEventListener('click', function () {
      abrirTroca(api, {
        chave: 'nova:' + (++novas), id: null, unidade_id: api.unidadeId(), viatura: v.nome,
        prefixo: '', cnh: null, inicio: '', fim: '', comecou_antes: false, excluir: false, erros: {}
      });
    });
    var remover = linha.querySelector('.nova-distribuicao-remover');
    remover.disabled = ctx.soLeitura;
    remover.addEventListener('click', function () {
      api.esquecerInvalidos(ctx.lado);
      fecharTrocaDe(v.nome, true);
      api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); });
    });

    var extra = linha.querySelector('.nova-distribuicao-viatura-extra');
    erros.forEach(function (e) { P().erroCampo(extra, e); });
    if (faltaCnh) P().erroCampo(extra, M().cnhEscolha);
    if (v.nome) P().marcarMuda(extra, ctx, 'viatura:' + v.nome);
    extra.classList.toggle('oculto', !extra.children.length);

    var subs = linha.querySelector('.nova-distribuicao-viatura-substituicoes');
    var nomes = api.nomesDe(v.nome);
    var daViatura = ((api.dados() && api.dados().substituicoes) || [])
      .filter(function (s) { return nomes.indexOf(s.viatura) >= 0; })
      .map(function (s) { return rascunho.filter(function (e) { return e.id === s.id; })[0] || comoEntrada(s); })
      .concat(rascunho.filter(function (e) { return !e.id && nomes.indexOf(e.viatura) >= 0; }))
      .filter(function (e) { return !e.excluir; });
    var aberto = daViatura.filter(function (e) { return e.chave === aberta; })[0];
    var hoje = api.dados().hoje;
    var temAtiva = daViatura.some(function (e) { var fim = RosterWork.data.paraISO(e.fim); return !fim || fim >= hoje; });
    trocar.disabled = trocar.disabled || temAtiva;
    if (temAtiva) trocar.setAttribute('data-dica', P().texto(M().trocaUmaPorVez, { viatura: v.nome }));
    linha.classList.toggle('nova-distribuicao-viatura--substituindo', !!aberto);
    if (aberto) caixaTroca(subs, api, ctx, v, i + 1, aberto);
    daViatura.forEach(function (e) {
      if (e === aberto) return;
      var lt = P().tpl('troca');
      lt.querySelector('.nova-distribuicao-troca-texto').textContent = textoTroca(e);
      var editar = lt.querySelector('.nova-distribuicao-editar');
      var tirar = lt.querySelector('.nova-distribuicao-remover');
      editar.disabled = ctx.soLeitura || !gravada;
      tirar.disabled = ctx.soLeitura || !gravada || e.comecou_antes;
      editar.addEventListener('click', function () { abrirTroca(api, e.id ? entradaDe(e.original) : e); });
      tirar.addEventListener('click', function () { excluirTroca(api, e); });
      subs.appendChild(lt);
    });
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
    /* as substituições mudadas e ainda não salvas: se há, o que vai para o banco, a conferência antes do Salvar
       e o descarte (Salvar, Cancelar, outra unidade ou outra versão) */
    temRascunho: function () { return rascunho.some(mudou); },
    operacoes: operacoes,
    conferir: conferirTrocas,
    descartar: function () { rascunho = []; aberta = null; }
  };
})();
