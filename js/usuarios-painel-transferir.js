/* ============================================================
   USUÁRIOS — transferência de unidade (aba Carreira, só admin)
   Sub-tela Transferir: 1. Para (o seletor de unidades, modo único)
   e 2. A partir de (até uma semana para trás ou no futuro; a
   transferência vale a partir dela). Confirma por modal, com a
   lista do que vai acontecer (trocas, folgas e extras que a saída
   cancela), e grava por transferir_militar. A transferência futura
   já marcada aparece como nota no topo da Carreira, com Cancelar
   (cancelar_transferencia_militar); enquanto ela existe, o
   Transferir da barra fica desligado. Orquestração no
   usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, ctl, destino, dataEl }

  function nomePessoa(c) {
    var ins = (c.ficha && c.ficha.institucionais) || {};
    var grad = ins.grau_abreviacao || (c.pessoa && c.pessoa.grau_abreviacao) || '';
    var guerra = ins.nome_de_guerra || (c.pessoa && c.pessoa.nome_de_guerra) || '';
    return (grad + ' ' + guerra).trim();
  }

  /* hoje em DD/MM/AAAA (valor inicial do campo) */
  function hojeBR() { return RosterWork.data.paraBR(new Date()); }

  /* a transferência marcada (data depois de hoje), se houver */
  function marcadaDe(ficha) {
    return ((ficha && ficha.transferencias) || []).filter(function (t) { return t.marcada; })[0] || null;
  }

  function erroData(msg) {
    if (!ctx || !ctx.dataEl) return;
    if (msg) RosterWork.campos.marcarErro(ctx.dataEl, msg); else RosterWork.campos.limparErro(ctx.dataEl);
  }

  /* confirmação (altera a escala: sempre passa por modal, com a lista do que vai acontecer) */
  function confirmar() {
    if (!ctx || !ctx.destino || !RosterWork.confirmar) return;
    var atual = ctx;
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
    var mensagem = M.usuarios.confirmarTransferencia(nomePessoa(ctx), origem, destino, ctx.dataEl.value);
    var escala = M.saida.escalaTransferencia(origem, destino);
    var dataIso = V.paraISO(ctx.dataEl.value);
    /* a lista das trocas, folgas e extras que a transferência cancela; sem ela, não transfere */
    RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_retirar_analisar', {
      metodo: 'POST',
      corpo: { p_unidade_id: Number(ins.lotacao_id) || null, p_cpf: (ctx.pessoa && ctx.pessoa.usuario_id) || null, p_data: dataIso }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (a) {
        if (ctx !== atual) return;
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
          aoConfirmar: function () {
            gravar(atual.ctl, 'transferir_militar', {
              p_cpf: atual.pessoa.usuario_id,
              p_unidade_destino: atual.destino.unidade_id,
              p_data_vigencia: dataIso
            }, RosterWork.mensagens.usuarios.falhaTransferencia);
          }
        });
      });
  }

  /* "Transferência para 2ºPEL a partir de 07/10/2026" */
  function textoMarcada(t) {
    return RosterWork.mensagens.postos.transferenciaAPartir
      .replace('{unidade}', t.destino || '')
      .replace('{data}', RosterWork.data.isoParaBR(t.data));
  }

  /* grava (transferir ou cancelar a marcada): véu enquanto a escala é refeita; no fim, a ficha relê e o resumo abre */
  function gravar(ctl, rpc, corpo, falha) {
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
          ctx = null;
          if (ctl) ctl.concluir(r);
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || falha });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* a nota da transferência marcada, no topo da Carreira, com o Cancelar (confirma por modal: refaz a escala) */
  function montarMarcada(corpo, ficha, ctl) {
    var marcada = marcadaDe(ficha);
    if (!corpo || !marcada) return;
    var nota = RosterWork.tpl('tpl-ficha-marcada');
    if (!nota) return;
    nota.querySelector('[data-marcada-texto]').textContent = textoMarcada(marcada);
    nota.querySelector('[data-marcada-cancelar]').addEventListener('click', function () {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.postos.confirmarCancelarMudanca.replace('{mudanca}', textoMarcada(marcada)),
        textoConfirmar: RosterWork.mensagens.botoes.cancelarMudanca,
        textoCancelar: RosterWork.mensagens.botoes.manter,
        aoConfirmar: function () {
          gravar(ctl, 'cancelar_transferencia_militar', { p_transferencia_id: marcada.id },
            RosterWork.mensagens.postos.falhaCancelarMudanca);
        }
      });
    });
    corpo.appendChild(nota);
  }

  /* a sub-tela Transferir no corpo; devolve o que o rodapé usa */
  function montarSubtela(corpo, ficha, pessoa, ctl) {
    if (!corpo || !ficha || !RosterWork.seletorUnidades || marcadaDe(ficha)) return null;
    var subtela = RosterWork.tpl('tpl-ficha-sub-transferir');
    if (!subtela) return null;
    var ins = ficha.institucionais || {};
    ctx = { ficha: ficha, pessoa: pessoa, ctl: ctl, destino: null, dataEl: subtela.querySelector('[data-transferir-data]') };
    subtela.querySelector('[data-sub-valor]').textContent = ins.lotacao_nome || '-';

    /* data "A partir de": padrão hoje, com máscara + calendário (reusa o cadastro) */
    if (ctx.dataEl) {
      RosterWork.campos.ligarData(ctx.dataEl);
      ctx.dataEl.value = hojeBR();
      ctx.dataEl.addEventListener('input', function () { erroData(''); ctl.aoMudar(); });
    }
    corpo.appendChild(subtela);

    var atual = ctx;
    var textoEl = subtela.querySelector('[data-transferir-texto]');
    var seletor = RosterWork.seletorUnidades.criar({
      modo: 'unico',
      todasUnidades: true,
      dropdownEl: subtela.querySelector('[data-transferir-dropdown]'),
      arvoreEl: subtela.querySelector('[data-transferir-arvore]'),
      textoEl: textoEl,
      aoSelecionar: function (unidade) {
        if (ctx !== atual) return;
        if (textoEl) textoEl.classList.remove('campo-selecao-texto--vazio');
        atual.destino = (unidade && unidade.unidade_id !== ins.lotacao_id) ? unidade : null;
        ctl.aoMudar();
      }
    });
    seletor.montarArvore();

    return {
      textoAplicar: RosterWork.mensagens.botoes.transferir,
      podeAplicar: function () { return ctx === atual && !!atual.destino; },
      /* um destino escolhido ou a data mudada, e ainda não transferido */
      sujo: function () { return ctx === atual && !!(atual.destino || (atual.dataEl && atual.dataEl.value !== hojeBR())); },
      aplicar: confirmar
    };
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelTransferir = {
    montarSubtela: montarSubtela, montarMarcada: montarMarcada, reset: reset,
    temMarcada: function (ficha) { return !!marcadaDe(ficha); }
  };
})();
