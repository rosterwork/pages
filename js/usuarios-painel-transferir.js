/* ============================================================
   USUÁRIOS — transferência de unidade (aba Carreira, modo Editar)
   Só admin. Seção "Transferir": lotação atual (origem), seletor de
   unidade de destino (reusa geral-seletor-unidades, modo único) e
   a data "A partir de" (até uma semana para trás ou no futuro; a
   transferência vale a partir dela). Com uma transferência futura
   marcada, a seção mostra só ela, com Cancelar (cancelar_transferencia_militar):
   para marcar outra, é preciso cancelar a marcada antes. Confirma por
   modal, com a lista do que vai acontecer (trocas, folgas e extras que
   a saída cancela), e grava por transferir_militar. Recarrega a ficha.
   Orquestração no usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, aoConcluir, destino, botao, dataEl, marcada }

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

  /* confirmação (altera a escala -> sempre passa por modal, com a lista do que vai acontecer) */
  function confirmar() {
    if (!ctx || !ctx.destino || !RosterWork.confirmar) return;
    var V = RosterWork.validacoes;
    erroData('');
    var dt = ctx.dataEl ? V.parseData(ctx.dataEl.value) : null;
    if (!dt) { erroData(RosterWork.mensagens.cadastro.dataInvalida); return; }
    var limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - 7);
    if (dt < limite) { erroData(RosterWork.mensagens.geral.dataMuitoAntiga); return; }

    var ins = (ctx.ficha && ctx.ficha.institucionais) || {};
    var M = RosterWork.mensagens;
    /* no aviso, a origem vai pelo nome da unidade (a lotação vem como "2ªCIBM / 2ºPEL"), igual ao destino */
    var origem = (ins.lotacao_nome || '').split(' / ').pop();
    var destino = ctx.destino.nome || '-';
    var mensagem = M.usuarios.confirmarTransferencia(nomePessoa(), origem, destino, ctx.dataEl.value);
    var escala = M.saida.escalaTransferencia(origem, destino);
    var dataIso = V.paraISO(ctx.dataEl.value);
    /* a lista das trocas, folgas e extras que a transferência cancela; sem ela, não transfere */
    RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_retirar_analisar', {
      metodo: 'POST',
      corpo: { p_unidade_id: Number(ins.lotacao_id) || null, p_cpf: (ctx.pessoa && ctx.pessoa.usuario_id) || null, p_data: dataIso }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (a) {
        if (!a || !a.success) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (a && a.error) || M.saida.falhaLista });
          return;
        }
        var aviso = RosterWork.avisoSaida(a.pendencias, { tipo: 'transferencia', escala: escala });
        RosterWork.confirmar({
          tipo: 'aviso',
          mensagem: mensagem,
          itens: aviso.itens,
          nota: aviso.nota,
          textoConfirmar: RosterWork.mensagens.botoes.transferir,
          textoCancelar: RosterWork.mensagens.botoes.cancelar,
          aoConfirmar: function () { transferir(dataIso); }
        });
      });
  }

  function transferir(dataIso) {
    if (!ctx || !ctx.destino) return;
    gravar('transferir_militar', {
      p_cpf: ctx.pessoa.usuario_id,
      p_unidade_destino: ctx.destino.unidade_id,
      p_data_vigencia: dataIso
    }, RosterWork.mensagens.usuarios.falhaTransferencia);
  }

  /* "Transferência para 2ºPEL a partir de 07/10/2026" */
  function textoMarcada(t) {
    return RosterWork.mensagens.postos.transferenciaAPartir
      .replace('{unidade}', t.destino || '')
      .replace('{data}', RosterWork.data.isoParaBR(t.data));
  }

  /* Cancelar da transferência marcada (confirma por modal: refaz a escala) */
  function confirmarCancelar() {
    if (!ctx || !ctx.marcada || !RosterWork.confirmar) return;
    var marcada = ctx.marcada;
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.postos.confirmarCancelarMudanca.replace('{mudanca}', textoMarcada(marcada)),
      textoConfirmar: RosterWork.mensagens.botoes.cancelarMudanca,
      textoCancelar: RosterWork.mensagens.botoes.manter,
      aoConfirmar: function () {
        gravar('cancelar_transferencia_militar', { p_transferencia_id: marcada.id },
          RosterWork.mensagens.postos.falhaCancelarMudanca);
      }
    });
  }

  /* grava (transferir ou cancelar a marcada): véu enquanto a escala é refeita, depois
     recarrega a ficha e abre o resumo */
  function gravar(rpc, corpo, falha) {
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/' + rpc, { metodo: 'POST', corpo: corpo })
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
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || falha });
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
    /* a transferência marcada (data depois de hoje), se houver; com ela, a seção já abre */
    var marcada = (ficha.transferencias || []).filter(function (t) { return t.marcada; })[0] || null;
    ctx = { ficha: ficha, pessoa: pessoa, aoConcluir: opcoes && opcoes.aoConcluir, destino: null, botao: null, dataEl: null, marcada: marcada };

    var secao = RosterWork.painel.criarSecaoColapsavel('Transferir', { aberta: !!marcada });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    var tpl = document.getElementById('tpl-usuarios-transferir');
    if (!alvo || !tpl) return;
    alvo.appendChild(tpl.content.cloneNode(true));
    corpo.appendChild(secao);

    /* com uma marcada, a seção mostra só ela: para marcar outra, é preciso cancelá-la antes */
    if (marcada) {
      var caixa = alvo.querySelector('[data-transferir-marcada]');
      caixa.querySelector('[data-transferir-marcada-texto]').textContent = textoMarcada(marcada);
      caixa.querySelector('[data-transferir-cancelar]').addEventListener('click', confirmarCancelar);
      caixa.classList.remove('oculto');
      alvo.querySelectorAll('[data-transferir-campo]').forEach(function (el) { el.classList.add('oculto'); });
      return;
    }

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

  /* um destino escolhido ou a data mudada, e ainda não transferido */
  function temRascunho() {
    return !!(ctx && (ctx.destino || (ctx.dataEl && ctx.dataEl.value !== hojeBR())));
  }

  window.RosterWork.usuariosPainelTransferir = { montar: montar, reset: reset, temRascunho: temRascunho };
})();
