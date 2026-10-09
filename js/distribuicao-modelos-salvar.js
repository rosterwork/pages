/* ============================================================
   DISTRIBUIÇÃO — salvar um modelo
   Monta o payload (as vagas da composição da unidade do modelo) e grava
   pela RPC cirúrgica dist_salvar_modelo (não mexe nos outros modelos).
   Salvar com erro vermelho pede confirmação num modal.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};


  /* um modelo = a composição de UMA unidade (chave "143_0OFC_7PRC") e as vagas dela */
  function montarPayload(estado, ctx) {
    var porChave = {};
    estado.unidades.forEach(function (u) {
      var ch = u.chave;
      u.postos.forEach(function (p) {
        p.vagas.forEach(function (vg) {
          if (!porChave[ch]) porChave[ch] = [];
          porChave[ch].push({
            temp_id: vg.tempId,
            acumulo_temp_id: vg.acumuloTempId || '',
            unidade_id: u.unidade_id,
            viatura_id: p.tipo === 'viatura' ? p.posto_id : '',
            instalacao_id: p.tipo === 'instalacao' ? p.posto_id : '',
            nome_funcao: vg.nome_funcao,
            tipo_contador: vg.tipo_contador,
            base: vg.base || '',
            ideal: vg.ideal || '',
            ideal_calc: vg.ideal_calc || '',
            ordem: vg.ordem || '',
            ordem_sentido: vg.ordemSentido || '',
            rodizio: !!vg.rodizio,
            papel_especial: vg.papel_especial || '',
            posto_numero: p._num,
            slot_numero: vg.slot_numero || 0,
            acumulo_ordem: (vg.acumuloOrdem != null ? vg.acumuloOrdem : 0)
          });
        });
      });
    });

    /* a chave da composição vai mesmo sem vagas (garante que a composição persista); os slots refletem
       o estado atual do editor (vazio = esvaziar de propósito; o editor sempre carrega o real) */
    var chaves = estado.unidades.filter(function (u) { return (u.oficiais || 0) > 0 || (u.pracas || 0) > 0; })
      .map(function (u) { return u.chave; });
    return {
      ctx: ctx,
      id_grupo_completo: (estado.modeloId && String(estado.modeloId).indexOf('novo') !== 0) ? estado.modeloId : null,
      nome: '',
      chaves: chaves,
      grupos_parciais: chaves.map(function (ch) { return { chave: ch, slots: porChave[ch] || [] }; })
    };
  }

  function gravar(estado, recalcularDesde) {
    var ctx = RosterWork.distribuicaoModelos.contextoId();
    var payload = montarPayload(estado, ctx);
    payload.data = RosterWork.distribuicaoPeriodos.data();   /* grava no período escolhido */
    if (recalcularDesde) payload.recalcular_desde = recalcularDesde;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    return RosterWork.distribuicaoDados.salvar(payload).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r.ok) {
        RosterWork.distribuicaoEditar.limpoAposSalvar();
        RosterWork.distribuicaoModelos.recarregar();
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Distribuição' });
        /* períodos seguintes já revisados não recebem a mudança: avisa quais são */
        var naoAtualizados = r.periodos_nao_atualizados || [];
        if (naoAtualizados.length) {
          RosterWork.avisar({ tipo: 'aviso', mensagem: RosterWork.mensagens.distribuicao.naoAtualizados(
            naoAtualizados.map(RosterWork.distribuicaoPeriodos.textoNaFrase)) });
        }
      } else {
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.distribuicao.falhaSalvar });
      }
    }).catch(function () {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  /* salvar pede a data de recálculo (modal padrão, começa amanhã): com erro vermelho
     avisa do erro; sem erro, avisa do impacto nas escalas já distribuídas. Ao confirmar,
     grava e o banco recalcula as unidades do modelo a partir da data escolhida. A gravação vale no
     período escolhido no seletor (distribuicao-periodos). */
  function salvar(estado, unidadesContagem) {
    var st = RosterWork.distribuicaoModelos.validar(unidadesContagem);
    var temVermelho = st.itens.some(function (i) { return i.nivel === 'erro'; });
    var mensagem = temVermelho ? RosterWork.mensagens.distribuicao.salvarComErro
                               : RosterWork.mensagens.distribuicao.salvarImpacto;
    var P = RosterWork.distribuicaoPeriodos;
    /* período que ainda vai começar: a escala é refeita a partir do início dele, sem perguntar a data */
    if (P.futuro()) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: mensagem,
        textoConfirmar: RosterWork.mensagens.botoes.salvar,
        textoCancelar: RosterWork.mensagens.botoes.cancelar,
        aoConfirmar: function () { gravar(estado, P.periodo().inicio); }
      });
      return;
    }
    RosterWork.pedirData({
      mensagem: mensagem,
      textoConfirmar: RosterWork.mensagens.botoes.salvar,
      aoConfirmar: function (iso) { gravar(estado, iso); }
    });
  }

  window.RosterWork.distribuicaoSalvar = { salvar: salvar };
})();
