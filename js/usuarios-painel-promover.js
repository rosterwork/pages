/* ============================================================
   USUÁRIOS — promoção (aba Carreira, modo Editar)
   Só admin. Seção "Promover": escolhe o Tipo (Oficial / Praça /
   Oficial Especial) e o sistema define a Hierarquia resultante —
   se manteve o tipo, a PRÓXIMA da carreira; se mudou, a PRIMEIRA
   do novo tipo (o admin não pula graus). A data tem que ser
   posterior à última promoção. Confirma por modal e grava por
   promover_militar (o banco recalcula o grau e a antiguidade).
   O grau resultante é só um preview — a fonte de verdade é a RPC.
   Reusa a lista de graus do cadastro (novoUsuarioDados.buscarGraus).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, aoConcluir, graus, atual, novoGrau, tipoEl, hierEl, dataEl, botao }

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

  /* grau resultante conforme o tipo escolhido (regra do usuário) */
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
       (antiguidade menor); senão seria um rebaixamento — bloqueia */
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

  /* recalcula a hierarquia mostrada e habilita/desabilita o botão */
  function atualizarHierarquia() {
    var tipo = ctx.tipoEl ? ctx.tipoEl.getAttribute('data-valor') : null;
    ctx.novoGrau = calcularNovoGrau(ctx.graus, ctx.atual, tipo);
    if (ctx.hierEl) {
      ctx.hierEl.textContent = ctx.novoGrau ? ctx.novoGrau.grau_nome : textoSemGrau(tipo);
    }
    if (ctx.botao) ctx.botao.disabled = !ctx.novoGrau;
  }

  /* a data tem que ser posterior à última promoção (ou à inclusão, se não houver) */
  function dataLimite() {
    var promos = (ctx.ficha && ctx.ficha.promocoes) || [];
    if (promos.length) return promos[promos.length - 1].data;   // vêm em ordem crescente
    return (ctx.ficha.institucionais || {}).data_de_inclusao;
  }

  function erroData(msg) {
    var campo = ctx.dataEl ? ctx.dataEl.closest('.campo') : null;
    if (!campo) return;
    if (msg) campo.classList.add('campo--erro'); else campo.classList.remove('campo--erro');
    var alvo = campo.querySelector('.campo-erro-texto');
    if (alvo) alvo.textContent = msg || '';
  }

  function confirmar() {
    if (!ctx || !ctx.novoGrau || !RosterWork.confirmar) return;
    var V = RosterWork.validacoes;
    if (!V) return;
    erroData('');
    var dt = ctx.dataEl ? V.parseData(ctx.dataEl.value) : null;
    if (!dt) { erroData(RosterWork.mensagens.cadastro.dataInvalida); return; }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (dt > hoje) { erroData(RosterWork.mensagens.usuarios.dataFutura); return; }
    var lim = dataLimite();
    if (lim) {
      var ld = new Date(String(lim).slice(0, 10) + 'T00:00:00');
      if (dt <= ld) { erroData(RosterWork.mensagens.usuarios.promocaoDataAnterior); return; }
    }
    var tipo = ctx.tipoEl.getAttribute('data-valor');
    var dataIso = V.paraISO(ctx.dataEl.value);
    var msg = RosterWork.mensagens.usuarios.confirmarPromocao
      .replace('{pessoa}', nomePessoa())
      .replace('{grau}', ctx.novoGrau.grau_nome)
      .replace('{data}', ctx.dataEl.value);
    /* promover não é perigo nem alerta: é ato positivo — confirma com o check, não com o "!" */
    RosterWork.confirmar({
      tipo: 'sucesso',
      mensagem: msg,
      textoConfirmar: RosterWork.mensagens.botoes.promover,
      textoCancelar: RosterWork.mensagens.botoes.cancelar,
      aoConfirmar: function () { promover(tipo, dataIso); }
    });
  }

  function promover(tipo, dataIso) {
    if (!ctx) return;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/promover_militar', {
      metodo: 'POST',
      corpo: { p_admin_cpf: RosterWork.sessao.cpf(), p_cpf: ctx.pessoa.usuario_id, p_tipo: tipo, p_data: dataIso }
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
          if (ctx && ctx.aoConcluir) ctx.aoConcluir();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Usuários' });
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

  /* monta a seção "Promover" no corpo. opcoes = { aoConcluir } */
  function montar(corpo, ficha, pessoa, opcoes) {
    if (!corpo || !ficha || !RosterWork.painel || !RosterWork.novoUsuarioDados) return;
    ctx = { ficha: ficha, pessoa: pessoa, aoConcluir: opcoes && opcoes.aoConcluir,
            graus: [], atual: null, novoGrau: null, tipoEl: null, hierEl: null, dataEl: null, botao: null };

    var secao = RosterWork.painel.criarSecaoColapsavel('Promover', { aberta: false });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    var tpl = document.getElementById('tpl-usuarios-promover');
    if (!alvo || !tpl) return;
    alvo.appendChild(tpl.content.cloneNode(true));
    corpo.appendChild(secao);

    ctx.tipoEl = alvo.querySelector('[data-promover-tipo]');
    ctx.hierEl = alvo.querySelector('[data-promover-hierarquia]');
    ctx.dataEl = alvo.querySelector('[data-promover-data]');
    ctx.botao = alvo.querySelector('[data-promover-botao]');

    if (ctx.dataEl && RosterWork.campos) {
      RosterWork.campos.ligarMascara(ctx.dataEl, RosterWork.campos.mascararData);
      RosterWork.campos.ligarCalendario(ctx.dataEl);
    }

    RosterWork.novoUsuarioDados.buscarGraus().then(function (graus) {
      if (!ctx || !ctx.tipoEl) return;
      ctx.graus = graus || [];
      ctx.atual = grauAtual(ctx.graus, ficha.institucionais || {});

      var tipos = [], vistos = {};
      ctx.graus.forEach(function (g) { if (!vistos[g.tipo]) { vistos[g.tipo] = true; tipos.push(g.tipo); } });
      var menu = ctx.tipoEl.closest('.dropdown').querySelector('.dropdown-menu');
      if (menu && RosterWork.campos) RosterWork.campos.popularOpcoes(menu, tipos.map(function (t) { return { rotulo: t, valor: t }; }));
      if (RosterWork.campos) RosterWork.campos.ligarSelecao(ctx.tipoEl, atualizarHierarquia);

      /* começa no tipo atual do militar (mostra a próxima hierarquia por padrão) */
      if (ctx.atual) definirTipo(ctx.atual.tipo);
    });

    if (ctx.botao) ctx.botao.addEventListener('click', confirmar);
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelPromover = { montar: montar, reset: reset };
})();
