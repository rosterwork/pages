/* ============================================================
   USUÁRIOS — administração (sub-tela da aba Carreira)
   1. Papel: os que quem está logado pode dar a este militar
   (administracao.opcoes, vindos da ficha) e 2. Vale para: onde o
   papel vale, que o banco calcula pela lotação. A nota diz o que o
   papel escolhido faz. Grava por administracao_definir (o banco
   confere quem pode conceder e registra no Histórico); ao salvar,
   volta à ficha e abre o resumo.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { pessoa, ctl, opcoes, atual, papelEl, valeEl, notaEl }

  /* a opção escolhida na lista (papel, rótulo e onde vale) */
  function escolhida() {
    var valor = ctx.papelEl.getAttribute('data-valor');
    for (var i = 0; i < ctx.opcoes.length; i++) {
      if (ctx.opcoes[i].papel === valor) return ctx.opcoes[i];
    }
    return null;
  }

  /* escolheu um papel diferente do atual */
  function mudou() {
    var op = escolhida();
    return !!op && op.papel !== ctx.atual;
  }

  /* mostra onde o papel escolhido vale e a nota do que ele faz (Sem administração não tem nota) */
  function atualizar() {
    var op = escolhida();
    ctx.valeEl.textContent = (op && op.vale_para) || '-';
    var temNota = false;
    Array.prototype.forEach.call(ctx.notaEl.querySelectorAll('[data-nota-papel]'), function (texto) {
      var mostra = !!op && texto.getAttribute('data-nota-papel') === op.papel;
      texto.classList.toggle('oculto', !mostra);
      if (mostra) temNota = true;
    });
    ctx.notaEl.classList.toggle('oculto', !temNota);
    ctx.ctl.aoMudar();
  }

  function salvar(botao) {
    var atual = ctx;
    var op = atual ? escolhida() : null;
    if (!op) return;
    if (botao && RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    function parar() { if (botao && RosterWork.pararCarregando) RosterWork.pararCarregando(botao); }
    RosterWork.apiFetch('/rest/v1/rpc/administracao_definir', {
      metodo: 'POST',
      corpo: { p_cpf: atual.pessoa.usuario_id, p_papel: op.papel }
    })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        parar();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          ctx = null;
          atual.ctl.concluir(r);
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaAdministracao });
        }
      })
      .catch(function () {
        parar();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* a sub-tela Administração no corpo; devolve o que o rodapé usa */
  function montarSubtela(corpo, ficha, pessoa, ctl) {
    var adm = ficha && ficha.administracao;
    if (!corpo || !adm || !adm.pode_definir) return null;
    var subtela = RosterWork.tpl('tpl-ficha-sub-administracao');
    if (!subtela) return null;
    ctx = { pessoa: pessoa, ctl: ctl, opcoes: adm.opcoes || [], atual: adm.papel || 'nenhum',
            papelEl: subtela.querySelector('[data-administracao-papel]'),
            valeEl: subtela.querySelector('[data-administracao-vale]'),
            notaEl: subtela.querySelector('[data-administracao-nota]') };
    subtela.querySelector('[data-sub-valor]').textContent = adm.rotulo || '-';

    var menu = ctx.papelEl.closest('.dropdown').querySelector('.dropdown-menu');
    RosterWork.campos.popularOpcoes(menu, ctx.opcoes.map(function (o) { return { rotulo: o.rotulo, valor: o.papel }; }));
    RosterWork.campos.ligarSelecao(ctx.papelEl, atualizar);
    corpo.appendChild(subtela);

    var atual = ctx;
    return {
      textoAplicar: RosterWork.mensagens.botoes.salvar,
      podeAplicar: function () { return ctx === atual && mudou(); },
      sujo: function () { return ctx === atual && mudou(); },
      aplicar: salvar
    };
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelAdministracao = { montarSubtela: montarSubtela, reset: reset };
})();
