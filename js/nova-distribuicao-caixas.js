/* ============================================================
   NOVA DISTRIBUIÇÃO — as mudanças dos postos com data
   A substituição temporária (só a viatura: outra viatura no lugar,
   com o prefixo e a CNH dela), o fora de serviço (o posto sai da
   escala de uma data até outra) e a exclusão (o posto sai a partir
   da data; até lá, continua na lista com o aviso). Cada uma abre
   numa caixa no lugar do posto (o Nº fora da linha, o posto como
   título fixo, os campos nas mesmas colunas), com Cancelar e
   Concluir, e fica no rascunho, como o resto da página: vai no
   Salvar e sai no Cancelar do rodapé. Embaixo do posto, as linhas
   fechadas, com editar e excluir. Só do posto gravado (com o
   código); a substituição, uma por viatura enquanto não terminou;
   a exclusão, uma por posto.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  /* as mudanças mudadas e ainda não salvas (vão no Salvar da página), uma entrada por mudança:
     { chave, tipo (substituicao, fora ou exclusao), id (nulo = nova), posto_id, posto, prefixo, cnh, inicio,
     fim (dd/mm/aaaa), comecou_antes, excluir, original (a gravada), antes (os campos quando a caixa abriu),
     concluida (a nova já concluída), erros } */
  var rascunho = [];
  var novas = 0;
  var aberta = null;   /* a chave da mudança aberta na caixa (uma por vez) */
  var CAMPOS = { substituicao: ['prefixo', 'cnh', 'inicio', 'fim'], fora: ['inicio', 'fim'], exclusao: ['inicio'] };

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function br(iso) { return iso ? RosterWork.data.isoParaBR(iso) : ''; }
  function vazio(x) { return x == null || x === ''; }

  /* as gravadas do posto, lidas do banco, como entradas (vão para o rascunho quando abrem ou saem) */
  function gravadas(dados, postoId) {
    var d = dados || {};
    return (d.substituicoes || []).map(function (s) {
      return { tipo: 'substituicao', id: s.id, posto_id: s.posto_id, posto: s.viatura, prefixo: s.prefixo, cnh: s.cnh,
               inicio: br(s.inicio), fim: br(s.fim), comecou_antes: !!s.comecou_antes, original: s };
    }).concat((d.fora || []).map(function (f) {
      return { tipo: 'fora', id: f.id, posto_id: f.posto_id, posto: f.posto, inicio: br(f.inicio), fim: br(f.fim),
               comecou_antes: !!f.comecou_antes, original: f };
    })).concat((d.exclusoes || []).map(function (x) {
      return { tipo: 'exclusao', id: x.id, posto_id: x.posto_id, posto: x.posto, inicio: br(x.data), fim: '',
               comecou_antes: !!x.comecou_antes, original: x };
    })).filter(function (e) { return e.posto_id === postoId; }).map(function (e) {
      e.chave = e.id;
      e.excluir = false;
      e.erros = {};
      return rascunho.filter(function (r) { return r.id === e.id; })[0] || e;
    });
  }
  function entrar(e) {
    if (rascunho.indexOf(e) < 0) rascunho.push(e);
    return e;
  }

  /* mudou em relação à gravada (a nova, quando tem algo digitado) */
  function mudou(e) {
    if (e.excluir) return true;
    var campos = CAMPOS[e.tipo];
    if (!e.id) return campos.some(function (c) { return !vazio(e[c]); });
    var o = { prefixo: e.original.prefixo, cnh: e.original.cnh, inicio: br(e.original.inicio || e.original.data), fim: br(e.original.fim) };
    return campos.some(function (c) { return (e[c] || '') !== (o[c] || ''); });
  }

  function texto(e) {
    var v = { prefixo: e.prefixo || '?', cnh: e.cnh || '?', inicio: e.inicio || '?', fim: e.fim || '?' };
    if (e.tipo === 'substituicao') return P().texto(M().trocaTexto, v);
    if (e.tipo === 'fora') return P().texto(e.id && !e.fim ? M().foraSemFim : M().foraTexto, v);
    return P().texto(M().exclusaoTexto, v);
  }

  /* abre uma por vez (a que estava aberta sem mudança sai do rascunho); guarda os campos de agora para o Cancelar */
  function abrirCaixa(api, e) {
    rascunho = rascunho.filter(function (x) { return x === e || mudou(x); });
    entrar(e);
    e.antes = { prefixo: e.prefixo, cnh: e.cnh, inicio: e.inicio, fim: e.fim };
    aberta = e.chave;
    api.focarDepois(e.tipo === 'substituicao' ? '#nova-distribuicao-troca-prefixo' : '.nova-distribuicao-troca-inicio');
    api.redesenhar();
  }

  /* Cancelar: desfaz o que foi digitado desde que a caixa abriu (a nova ainda não concluída sai) e fecha */
  function cancelarCaixa(api, e) {
    if (!e.id && !e.concluida) rascunho = rascunho.filter(function (x) { return x !== e; });
    else Object.keys(e.antes).forEach(function (c) { e[c] = e.antes[c]; });
    e.erros = {};
    aberta = null;
    rascunho = rascunho.filter(mudou);
    api.redesenhar();
  }

  /* Concluir: confere os campos; com erro, as frases aparecem e a caixa continua aberta; sem erro, fecha
     (o que foi digitado fica no rascunho até o Salvar da página) */
  function concluirCaixa(api, e) {
    e.erros = errosDe(e, api.dados().limite);
    if (!Object.keys(e.erros).length) {
      e.concluida = true;
      aberta = null;
      rascunho = rascunho.filter(mudou);
    }
    api.redesenhar();
  }

  /* a lixeira (só na linha fechada): a nova sai do rascunho; a gravada fica marcada e sai no Salvar */
  function excluirLinha(api, e) {
    if (e.id) entrar(e).excluir = true;
    else rascunho = rascunho.filter(function (x) { return x !== e; });
    if (aberta === e.chave) aberta = null;
    api.redesenhar();
  }

  /* as frases de uma mudança, por campo; edições voltam no máximo até o limite */
  function errosDe(f, limite) {
    var e = {};
    var trava = P().texto(M().trocaLimite, { data: br(limite) });
    var de = RosterWork.data.paraISO(f.inicio);
    var ate = RosterWork.data.paraISO(f.fim);
    if (f.tipo === 'substituicao') {
      if (!P().FORMATO_PREFIXO.test(f.prefixo || '')) e.prefixo = f.prefixo ? M().prefixoInvalido : M().prefixoVazio;
      else if (f.prefixo === f.posto) e.prefixo = M().trocaMesmoPrefixo;
      if (!f.cnh) e.cnh = M().trocaEscolhaCnh;
    }
    if (!de) e.inicio = M().erroInicio;
    else if (de < limite && !f.comecou_antes) e.inicio = trava;
    if (f.tipo === 'exclusao') return e;
    if (!ate) e.fim = M().trocaErroFim;
    else if (de && ate < de) e.fim = M().erroOrdemDatas;
    else if (ate < limite) e.fim = trava;
    return e;
  }

  /* a caixa no lugar do posto: o Nº, o posto como título fixo e os campos com os rótulos (a substituição com a
     substituta e a CNH; a exclusão só com a data); as frases de erro embaixo (somem do campo que muda) */
  function caixa(destino, api, ctx, posto, numero, f) {
    var no = P().tpl('troca-caixa');
    var tipo = f.tipo;
    no.querySelector('.nova-distribuicao-linha-ordem').textContent = numero ? numero + 'º' : '';
    no.querySelector('.nova-distribuicao-troca-viatura').textContent = posto.cnh ? P().texto(M().tituloViatura, { nome: posto.nome, cnh: posto.cnh }) : posto.nome;
    no.querySelector('.nova-distribuicao-troca-tipo-gravada').classList.toggle('oculto', tipo !== 'substituicao' || !f.id);
    no.querySelector('.nova-distribuicao-troca-tipo-nova').classList.toggle('oculto', tipo !== 'substituicao' || !!f.id);
    no.querySelector('.nova-distribuicao-troca-tipo-fora').classList.toggle('oculto', tipo !== 'fora');
    no.querySelector('.nova-distribuicao-troca-tipo-exclusao').classList.toggle('oculto', tipo !== 'exclusao');
    no.querySelectorAll('.nova-distribuicao-troca-so-substituicao').forEach(function (x) { x.classList.toggle('oculto', tipo !== 'substituicao'); });
    no.querySelectorAll('.nova-distribuicao-troca-com-fim').forEach(function (x) { x.classList.toggle('oculto', tipo === 'exclusao'); });
    no.querySelector('.nova-distribuicao-troca-rotulo-desde').classList.toggle('oculto', tipo !== 'exclusao');
    no.querySelectorAll('[data-ajuda]').forEach(function (x) { x.classList.toggle('oculto', x.getAttribute('data-ajuda') !== tipo); });
    var campos = {
      prefixo: no.querySelector('.nova-distribuicao-troca-prefixo'),
      cnh: no.querySelector('.nova-distribuicao-troca-cnh'),
      inicio: no.querySelector('.nova-distribuicao-troca-inicio'),
      fim: no.querySelector('.nova-distribuicao-troca-fim')
    };
    var lista = no.querySelector('.nova-distribuicao-troca-erros');
    var frases = {};
    CAMPOS[tipo].forEach(function (c) {
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

    var concluir = no.querySelector('.nova-distribuicao-troca-concluir');
    concluir.disabled = ctx.soLeitura;
    no.querySelector('.nova-distribuicao-troca-cancelar').addEventListener('click', function () { cancelarCaixa(api, f); });
    concluir.addEventListener('click', function () { concluirCaixa(api, f); });
    destino.appendChild(no);
  }

  /* embaixo do posto: as mudanças dele (as gravadas e as do rascunho) em linhas fechadas e a aberta na caixa.
     posto = { id, nome, cnh }; devolve se a linha do posto some (a caixa aberta toma o lugar), se há uma
     substituição que não terminou e se a exclusão já está marcada */
  function listar(destino, api, ctx, posto, numero) {
    var hoje = api.dados().hoje;
    var todas = gravadas(api.dados(), posto.id)
      .concat(rascunho.filter(function (e) { return !e.id && e.posto_id === posto.id; }));
    var vivas = todas.filter(function (e) { return !e.excluir; });
    var aberto = vivas.filter(function (e) { return e.chave === aberta; })[0];
    if (aberto) caixa(destino, api, ctx, posto, numero, aberto);
    vivas.forEach(function (e) {
      if (e === aberto) return;
      var lt = P().tpl('troca');
      lt.querySelectorAll('[data-icone]').forEach(function (x) { x.classList.toggle('oculto', x.getAttribute('data-icone') !== e.tipo); });
      lt.querySelector('.nova-distribuicao-troca-texto').textContent = texto(e);
      var editar = lt.querySelector('.nova-distribuicao-editar');
      var tirar = lt.querySelector('.nova-distribuicao-remover');
      editar.disabled = ctx.soLeitura;
      tirar.disabled = ctx.soLeitura || e.comecou_antes;
      editar.addEventListener('click', function () { abrirCaixa(api, e); });
      tirar.addEventListener('click', function () { excluirLinha(api, e); });
      destino.appendChild(lt);
    });
    return {
      aberta: !!aberto,
      substituindo: vivas.some(function (e) {
        var fim = RosterWork.data.paraISO(e.fim);
        return e.tipo === 'substituicao' && (!fim || fim >= hoje);
      }),
      excluindo: vivas.some(function (e) { return e.tipo === 'exclusao'; })
    };
  }

  /* uma nova, aberta na caixa: posto = { id, nome } */
  function nova(api, tipo, posto) {
    abrirCaixa(api, {
      chave: 'nova:' + (++novas), tipo: tipo, id: null, posto_id: posto.id, posto: posto.nome,
      prefixo: '', cnh: null, inicio: '', fim: '', comecou_antes: false, excluir: false, erros: {}
    });
  }

  /* antes do Salvar: confere as mudadas (as frases ficam em cada uma e a 1ª com erro abre) */
  function conferir(dados) {
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
      if (e.excluir) return { tipo: e.tipo, id: e.id, excluir: true };
      return {
        tipo: e.tipo, id: e.id, posto_id: e.posto_id, prefixo: e.tipo === 'substituicao' ? e.prefixo : null,
        cnh: e.tipo === 'substituicao' ? e.cnh : null,
        inicio: RosterWork.data.paraISO(e.inicio), fim: e.tipo === 'exclusao' ? null : RosterWork.data.paraISO(e.fim)
      };
    });
  }

  /* as frases das mudanças do posto, para o cartão fechado (sem as que vão sair no Salvar) */
  function frases(api, posto) {
    return gravadas(api.dados(), posto.id).concat(rascunho.filter(function (e) { return !e.id && e.posto_id === posto.id; }))
      .filter(function (e) { return !e.excluir; }).map(texto);
  }

  window.RosterWork.novaDistribuicaoCaixas = {
    listar: listar,
    nova: nova,
    frases: frases,
    /* o posto (id) da mudança aberta na caixa, ou nulo: o cartão dele fica aberto */
    postoAberto: function () {
      var e = rascunho.filter(function (x) { return x.chave === aberta; })[0];
      return e ? e.posto_id : null;
    },
    /* as mudanças ainda não salvas: se há, o que vai para o banco, a conferência antes do Salvar e o descarte
       (Salvar, Cancelar, outra unidade ou outra versão) */
    temRascunho: function () { return rascunho.some(mudou); },
    operacoes: operacoes,
    conferir: conferir,
    descartar: function () { rascunho = []; aberta = null; }
  };
})();
