/* ============================================================
   POSTOS — transferência de viatura entre unidades (painel de
   edição, modo Editar; só admin). Seção "Transferir": unidade de
   origem (a atual, leitura), seletor de unidade de destino (reusa
   geral-seletor-unidades, modo único) e o botão Transferir. A
   transferência é imediata (a tabela não tem data de vigência) e
   altera a escala → passa por modal de confirmação. Grava pelo RPC
   transferir_viatura e devolve o log (modal de resumo). A
   orquestração (fechar/recarregar) fica em postos-viaturas-painel.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { viatura, unidade, aoConcluir, destino, botao }

  /* confirmação (altera a escala -> sempre passa por modal) */
  function confirmar() {
    if (!ctx || !ctx.destino || !RosterWork.confirmar) return;
    var msg = RosterWork.mensagens.postos.confirmarTransferirViatura
      .replace('{prefixo}', ctx.viatura.nome || '')
      .replace('{origem}', ctx.unidade.nome || ctx.unidade.nome_completo || '-')
      .replace('{destino}', ctx.destino.nome || '-')
      + ' ' + RosterWork.mensagens.postos.impactoDistribuicao;
    RosterWork.pedirData({
      mensagem: msg,
      textoConfirmar: RosterWork.mensagens.botoes.transferir,
      aoConfirmar: function (iso) { transferir(iso); }
    });
  }

  function transferir(recalcularDesde) {
    if (!ctx || !ctx.destino) return;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/transferir_viatura', {
      metodo: 'POST',
      corpo: {
        p_admin_cpf: RosterWork.sessao.cpf(),
        p_viatura_id: ctx.viatura.id_viatura,
        p_unidade_destino: ctx.destino.unidade_id,
        p_recalcular_desde: recalcularDesde || null
      }
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
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaTransferir });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* monta a seção "Transferir" no corpo do painel. opcoes = { aoConcluir } */
  function montar(corpo, viatura, unidade, opcoes) {
    if (!corpo || !viatura || !RosterWork.seletorUnidades || !RosterWork.painel) return;
    ctx = { viatura: viatura, unidade: unidade, aoConcluir: opcoes && opcoes.aoConcluir, destino: null, botao: null };

    var secao = RosterWork.painel.criarSecaoColapsavel('Transferir', { aberta: false });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    var tpl = document.getElementById('tpl-viatura-transferir');
    if (!alvo || !tpl) return;
    alvo.appendChild(tpl.content.cloneNode(true));
    corpo.appendChild(secao);

    var origemEl = alvo.querySelector('[data-origem]');
    if (origemEl) origemEl.textContent = unidade.nome || unidade.nome_completo || '-';

    var dropdownEl = alvo.querySelector('[data-transferir-dropdown]');
    var arvoreEl = alvo.querySelector('[data-transferir-arvore]');
    var textoEl = alvo.querySelector('[data-transferir-texto]');
    ctx.botao = alvo.querySelector('[data-transferir-botao]');

    var seletor = RosterWork.seletorUnidades.criar({
      modo: 'unico',
      dropdownEl: dropdownEl,
      arvoreEl: arvoreEl,
      textoEl: textoEl,
      aoSelecionar: function (u) {
        if (textoEl) textoEl.classList.remove('campo-selecao-texto--vazio');
        ctx.destino = (u && u.unidade_id !== unidade.unidade_id) ? u : null;
        if (ctx.botao) ctx.botao.disabled = !ctx.destino;
      }
    });
    seletor.montarArvore();

    if (ctx.botao) ctx.botao.addEventListener('click', confirmar);
  }

  function reset() { ctx = null; }

  window.RosterWork.postosViaturasTransferir = { montar: montar, reset: reset };
})();
