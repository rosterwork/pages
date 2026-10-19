/* ============================================================
   USUÁRIOS — promoção (sub-tela da aba Carreira, só admin)
   1. Tipo (Oficial / Praça / Oficial Especialista) e o sistema
   define a hierarquia (2. Promovido a): se manteve o tipo, a
   PRÓXIMA da carreira; se mudou, a PRIMEIRA do novo tipo (o admin
   não pula graus). 3. Data da promoção, posterior à última data
   gravada e à data de inclusão (a nota diz qual). Confirma por
   modal e grava por promover_militar (o banco recalcula o grau e a
   antiguidade; o grau mostrado é só um preview). Reusa a lista de
   graus do cadastro (novoUsuarioDados.buscarGraus).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, ctl, graus, atual, novoGrau, tipoEl, hierEl, dataEl, notaEl }

  function nomePessoa() {
    var ins = (ctx.ficha && ctx.ficha.institucionais) || {};
    var grad = ins.grau_abreviacao || (ctx.pessoa && ctx.pessoa.grau_abreviacao) || '';
    var guerra = ins.nome_de_guerra || (ctx.pessoa && ctx.pessoa.nome_de_guerra) || '';
    return (grad + ' ' + guerra).trim();
  }

  /* grau atual do militar na lista de graus (por id) */
  function grauAtual(graus, ins) {
    for (var i = 0; i < graus.length; i++) {
      if (graus[i].grau_id === ins.grau_id) return graus[i];
    }
    return null;
  }

  /* grau resultante conforme o tipo escolhido */
  function calcularNovoGrau(graus, atual, tipo) {
    if (!atual || !tipo) return null;
    if (tipo === atual.tipo) {
      /* manteve o tipo: a PRÓXIMA hierarquia (a imediatamente acima = maior
         grau_antiguidade que ainda é menor que a atual) */
      var melhor = null;
      for (var i = 0; i < graus.length; i++) {
        if (graus[i].tipo !== tipo || graus[i].grau_antiguidade >= atual.grau_antiguidade) continue;
        if (!melhor || graus[i].grau_antiguidade > melhor.grau_antiguidade) melhor = graus[i];
      }
      return melhor;   // null = já está no topo desta carreira
    }
    /* mudou o tipo: a PRIMEIRA do novo tipo (entrada = maior grau_antiguidade) */
    var primeiro = null;
    for (var j = 0; j < graus.length; j++) {
      if (graus[j].tipo !== tipo) continue;
      if (!primeiro || graus[j].grau_antiguidade > primeiro.grau_antiguidade) primeiro = graus[j];
    }
    /* só vale como promoção se o grau de entrada for SUPERIOR ao atual
       (antiguidade menor); senão seria um rebaixamento: bloqueia */
    if (primeiro && primeiro.grau_antiguidade >= atual.grau_antiguidade) return null;
    return primeiro;
  }

  /* texto quando não há grau resultante: sem tipo, topo da carreira, ou mudança
     de tipo que não é promoção (rebaixamento) */
  function textoSemGrau(tipo) {
    var M = RosterWork.mensagens.usuarios;
    if (!ctx.atual) return M.postoAtualDesconhecido;
    if (!tipo) return '-';
    if (tipo === ctx.atual.tipo) return M.topoCarreira;
    return M.promocaoTipoInvalida;
  }

  /* recalcula a hierarquia mostrada (o rodapé liga o Promover quando há uma) */
  function atualizarHierarquia() {
    var tipo = ctx.tipoEl ? ctx.tipoEl.getAttribute('data-valor') : null;
    ctx.novoGrau = calcularNovoGrau(ctx.graus, ctx.atual, tipo);
    if (ctx.hierEl) ctx.hierEl.textContent = ctx.novoGrau ? ctx.novoGrau.grau_nome : textoSemGrau(tipo);
    if (ctx.ctl) ctx.ctl.aoMudar();
  }

  /* a data tem que ser posterior à última data gravada e à data de inclusão (a regra do banco);
     devolve { data: ISO, inclusao: é a de inclusão? } */
  function dataLimite() {
    var ins = (ctx.ficha && ctx.ficha.institucionais) || {};
    var datas = ((ctx.ficha && ctx.ficha.promocoes) || []).map(function (pr) { return String(pr.data || '').slice(0, 10); }).filter(Boolean).sort();
    var ultima = datas.length ? datas[datas.length - 1] : null;
    var inclusao = ins.data_de_inclusao ? String(ins.data_de_inclusao).slice(0, 10) : null;
    if (ultima && (!inclusao || ultima >= inclusao)) return { data: ultima, inclusao: false };   // ISO: a ordem do texto é a das datas
    return inclusao ? { data: inclusao, inclusao: true } : null;
  }

  function erroData(msg) {
    if (!ctx.dataEl) return;
    if (msg) RosterWork.campos.marcarErro(ctx.dataEl, msg); else RosterWork.campos.limparErro(ctx.dataEl);
  }

  function confirmar() {
    if (!ctx || !ctx.novoGrau || !RosterWork.confirmar) return;
    var V = RosterWork.validacoes;
    erroData('');
    var dt = ctx.dataEl ? V.parseData(ctx.dataEl.value) : null;
    if (!dt) { erroData(RosterWork.mensagens.cadastro.dataInvalida); return; }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (dt > hoje) { erroData(RosterWork.mensagens.usuarios.dataFutura); return; }
    var lim = dataLimite();
    if (lim && dt <= new Date(lim.data + 'T00:00:00')) { erroData(RosterWork.mensagens.usuarios.promocaoDataAnterior); return; }
    var tipo = ctx.tipoEl.getAttribute('data-valor');
    var dataIso = V.paraISO(ctx.dataEl.value);
    var msg = RosterWork.mensagens.usuarios.confirmarPromocao
      .replace('{pessoa}', nomePessoa())
      .replace('{grau}', ctx.novoGrau.grau_nome)
      .replace('{data}', ctx.dataEl.value);
    /* promover não é perigo nem alerta: é ato positivo, confirma com o check, não com o "!" */
    RosterWork.confirmar({
      tipo: 'sucesso',
      mensagem: msg,
      textoConfirmar: RosterWork.mensagens.botoes.promover,
      textoCancelar: RosterWork.mensagens.botoes.cancelar,
      aoConfirmar: function () { promover(tipo, dataIso); }
    });
  }

  function promover(tipo, dataIso) {
    var atual = ctx;
    if (!atual) return;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/promover_militar', {
      metodo: 'POST',
      corpo: { p_cpf: atual.pessoa.usuario_id, p_tipo: tipo, p_data: dataIso }
    })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          ctx = null;
          atual.ctl.concluir(r);
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaPromocao });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* define o Tipo no gatilho (texto + data-valor) e recalcula a hierarquia */
  function definirTipo(tipo) {
    if (!ctx.tipoEl || !tipo) return;
    ctx.tipoEl.setAttribute('data-valor', tipo);
    var texto = ctx.tipoEl.querySelector('.campo-selecao-texto');
    if (texto) { texto.textContent = tipo; texto.classList.remove('campo-selecao-texto--vazio'); }
    atualizarHierarquia();
  }

  /* algo escolhido e ainda não promovido: a data preenchida ou um tipo diferente do atual */
  function temRascunho() {
    if (!ctx) return false;
    var tipo = ctx.tipoEl ? ctx.tipoEl.getAttribute('data-valor') : null;
    return !!((ctx.dataEl && ctx.dataEl.value.trim()) || (tipo && ctx.atual && tipo !== ctx.atual.tipo));
  }

  /* a sub-tela Promover no corpo; devolve o que o rodapé usa */
  function montarSubtela(corpo, ficha, pessoa, ctl) {
    if (!corpo || !ficha || !RosterWork.novoUsuarioDados) return null;
    var subtela = RosterWork.tpl('tpl-ficha-sub-promover');
    if (!subtela) return null;
    var ins = ficha.institucionais || {};
    ctx = { ficha: ficha, pessoa: pessoa, ctl: ctl, graus: [], atual: null, novoGrau: null,
            tipoEl: subtela.querySelector('[data-promover-tipo]'), hierEl: subtela.querySelector('[data-promover-hierarquia]'),
            dataEl: subtela.querySelector('[data-promover-data]'), notaEl: subtela.querySelector('[data-promover-nota]') };
    subtela.querySelector('[data-sub-valor]').textContent = ins.grau_nome || '-';

    /* a nota diz de quando a data tem que ser depois: a última data gravada ou a inclusão */
    var lim = dataLimite();
    if (lim && ctx.notaEl) {
      var M = RosterWork.mensagens.usuarios;
      var br = RosterWork.data.isoParaBR(lim.data);
      ctx.notaEl.querySelector('.nota-texto').textContent = lim.inclusao ? M.promocaoDepoisInclusao(br) : M.promocaoDepoisUltima(br);
      ctx.notaEl.classList.remove('oculto');
    }

    if (ctx.dataEl) {
      RosterWork.campos.ligarData(ctx.dataEl);
      ctx.dataEl.addEventListener('input', function () { erroData(''); ctl.aoMudar(); });
    }
    corpo.appendChild(subtela);

    var atual = ctx;
    RosterWork.novoUsuarioDados.buscarGraus().then(function (graus) {
      if (ctx !== atual || !ctx.tipoEl) return;
      ctx.graus = graus || [];
      ctx.atual = grauAtual(ctx.graus, ins);
      var tipos = [], vistos = {};
      ctx.graus.forEach(function (g) { if (!vistos[g.tipo]) { vistos[g.tipo] = true; tipos.push(g.tipo); } });
      var menu = ctx.tipoEl.closest('.dropdown').querySelector('.dropdown-menu');
      RosterWork.campos.popularOpcoes(menu, tipos.map(function (t) { return { rotulo: t, valor: t }; }));
      RosterWork.campos.ligarSelecao(ctx.tipoEl, atualizarHierarquia);
      /* começa no tipo atual do militar (mostra a próxima hierarquia por padrão) */
      if (ctx.atual) definirTipo(ctx.atual.tipo); else atualizarHierarquia();
    });

    return {
      textoAplicar: RosterWork.mensagens.botoes.promover,
      podeAplicar: function () { return ctx === atual && !!atual.novoGrau; },
      sujo: function () { return ctx === atual && temRascunho(); },
      aplicar: confirmar
    };
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelPromover = { montarSubtela: montarSubtela, reset: reset };
})();
