/* ============================================================
   USUÁRIOS — transferência de unidade (aba Carreira, modo Editar)
   Só admin. Seção "Transferir": lotação atual (origem), seletor de
   unidade de destino (reusa geral-seletor-unidades, modo único) e
   a data "A partir de" (apenas hoje ou anterior — o admin pode
   registrar fora do dia, mas não no futuro). Confirma por modal
   (altera a escala) e grava por transferir_militar. Recarrega a
   ficha. Orquestração no usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, aoConcluir, destino, botao, dataEl }

  function nomePessoa() {
    var ins = (ctx.ficha && ctx.ficha.institucionais) || {};
    var grad = ins.grau_abreviacao || (ctx.pessoa && ctx.pessoa.grau_abreviacao) || '';
    var guerra = ins.nome_de_guerra || (ctx.pessoa && ctx.pessoa.nome_de_guerra) || '';
    return (grad + ' ' + guerra).trim();
  }

  /* hoje em DD/MM/AAAA (valor inicial do campo) */
  function hojeBR() {
    var d = new Date();
    var dia = String(d.getDate()); if (dia.length < 2) dia = '0' + dia;
    var mes = String(d.getMonth() + 1); if (mes.length < 2) mes = '0' + mes;
    return dia + '/' + mes + '/' + d.getFullYear();
  }

  function erroData(msg) {
    var campo = ctx.dataEl ? ctx.dataEl.closest('.campo') : null;
    if (!campo) return;
    if (msg) { campo.classList.add('campo--erro'); } else { campo.classList.remove('campo--erro'); }
    var alvo = campo.querySelector('.campo-erro-texto');
    if (alvo) alvo.textContent = msg || '';
  }

  /* confirmação (altera a escala -> sempre passa por modal) */
  function confirmar() {
    if (!ctx || !ctx.destino || !RosterWork.confirmar) return;
    var V = RosterWork.validacoes;
    erroData('');
    var dt = ctx.dataEl ? V.parseData(ctx.dataEl.value) : null;
    if (!dt) { erroData(RosterWork.mensagens.cadastro.dataInvalida); return; }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (dt > hoje) { erroData(RosterWork.mensagens.usuarios.dataFutura); return; }

    var ins = (ctx.ficha && ctx.ficha.institucionais) || {};
    var msgBase = RosterWork.mensagens.usuarios.confirmarTransferencia
      .replace('{pessoa}', nomePessoa())
      .replace('{origem}', ins.lotacao_nome || '-')
      .replace('{destino}', ctx.destino.nome || '-');
    var dataIso = V.paraISO(ctx.dataEl.value);
    /* avisa também das trocas/folgas da origem que a transferência vai cancelar (best-effort) */
    RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_retirar_analisar', {
      metodo: 'POST',
      corpo: { p_admin_cpf: RosterWork.sessao.cpf(), p_unidade_id: Number(ins.lotacao_id) || null, p_cpf: (ctx.pessoa && ctx.pessoa.usuario_id) || null, p_data: dataIso }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (a) {
        var pend = (a && a.success && a.pendencias) || null;
        var msg = msgBase + (RosterWork.textoImpactoSaida ? RosterWork.textoImpactoSaida(pend) : '');
        RosterWork.confirmar({
          tipo: 'aviso',
          mensagem: msg,
          textoConfirmar: RosterWork.mensagens.botoes.transferir,
          textoCancelar: RosterWork.mensagens.botoes.cancelar,
          aoConfirmar: function () { transferir(dataIso); }
        });
      });
  }

  function transferir(dataIso) {
    if (!ctx || !ctx.destino) return;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/transferir_militar', {
      metodo: 'POST',
      corpo: {
        p_admin_cpf: RosterWork.sessao.cpf(),
        p_cpf: ctx.pessoa.usuario_id,
        p_unidade_destino: ctx.destino.unidade_id,
        p_data_vigencia: dataIso
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
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Usuários' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaTransferencia });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* monta a seção "Transferir" no corpo. opcoes = { aoConcluir } */
  function montar(corpo, ficha, pessoa, opcoes) {
    if (!corpo || !ficha || !RosterWork.seletorUnidades || !RosterWork.painel) return;
    ctx = { ficha: ficha, pessoa: pessoa, aoConcluir: opcoes && opcoes.aoConcluir, destino: null, botao: null, dataEl: null };

    var secao = RosterWork.painel.criarSecaoColapsavel('Transferir', { aberta: false });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    var tpl = document.getElementById('tpl-usuarios-transferir');
    if (!alvo || !tpl) return;
    alvo.appendChild(tpl.content.cloneNode(true));
    corpo.appendChild(secao);

    var ins = ficha.institucionais || {};
    var origemEl = alvo.querySelector('[data-origem]');
    if (origemEl) origemEl.textContent = ins.lotacao_nome || '-';

    var dropdownEl = alvo.querySelector('[data-transferir-dropdown]');
    var arvoreEl = alvo.querySelector('[data-transferir-arvore]');
    var textoEl = alvo.querySelector('[data-transferir-texto]');
    ctx.dataEl = alvo.querySelector('[data-transferir-data]');
    ctx.botao = alvo.querySelector('[data-transferir-botao]');

    /* data "A partir de": padrão hoje, com máscara + calendário (reusa o cadastro) */
    if (ctx.dataEl && RosterWork.campos) {
      RosterWork.campos.ligarMascara(ctx.dataEl, RosterWork.campos.mascararData);
      RosterWork.campos.ligarCalendario(ctx.dataEl);
      ctx.dataEl.value = hojeBR();
    }

    var seletor = RosterWork.seletorUnidades.criar({
      modo: 'unico',
      dropdownEl: dropdownEl,
      arvoreEl: arvoreEl,
      textoEl: textoEl,
      aoSelecionar: function (unidade) {
        if (textoEl) textoEl.classList.remove('campo-selecao-texto--vazio');
        ctx.destino = (unidade && unidade.unidade_id !== ins.lotacao_id) ? unidade : null;
        if (ctx.botao) ctx.botao.disabled = !ctx.destino;
      }
    });
    seletor.montarArvore();

    if (ctx.botao) ctx.botao.addEventListener('click', confirmar);
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelTransferir = { montar: montar, reset: reset };
})();
