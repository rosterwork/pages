/* ============================================================
   DISTRIBUIÇÃO — salvar um modelo (Rodada 2A)
   Monta o payload (vagas agrupadas por chave de composição) e grava
   pela RPC cirúrgica dist_salvar_modelo (não mexe nos outros modelos).
   Salvar com erro vermelho pede confirmação num modal.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};


  function montarPayload(estado, ctx, user) {
    /* mapa tempId → unidade_id */
    var vagaUnidade = {};
    estado.unidades.forEach(function (u) {
      u.postos.forEach(function (p) { p.vagas.forEach(function (v) { vagaUnidade[v.tempId] = u.unidade_id; }); });
    });

    /* union-find: une as unidades ligadas por acúmulo ENTRE unidades */
    var pai = {};
    function find(x) { x = String(x); if (pai[x] == null) pai[x] = x; return pai[x] === x ? x : (pai[x] = find(pai[x])); }
    function union(a, b) { pai[find(a)] = find(b); }
    estado.unidades.forEach(function (u) { find(u.unidade_id); });
    estado.unidades.forEach(function (u) {
      u.postos.forEach(function (p) {
        p.vagas.forEach(function (v) {
          if (v.acumuloTempId && vagaUnidade[v.acumuloTempId] != null &&
              String(vagaUnidade[v.tempId]) !== String(vagaUnidade[v.acumuloTempId])) {
            union(vagaUnidade[v.tempId], vagaUnidade[v.acumuloTempId]);
          }
        });
      });
    });

    /* chave de cada componente: chaves simples das unidades, ordenadas, unidas por "+" */
    var chaveSimples = {};
    estado.unidades.forEach(function (u) { chaveSimples[u.unidade_id] = u.chave; });
    var comp = {};
    estado.unidades.forEach(function (u) { var r = find(u.unidade_id); (comp[r] = comp[r] || []).push(u.unidade_id); });
    var chaveComp = {};
    Object.keys(comp).forEach(function (r) {
      var ids = comp[r].slice().sort(function (a, b) { return a - b; });
      chaveComp[r] = ids.map(function (id) { return chaveSimples[id]; }).join('+');
    });

    /* agrupa os slots por chave do componente */
    var porChave = {};
    estado.unidades.forEach(function (u) {
      var ch = chaveComp[find(u.unidade_id)];
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

    /* reforço ("Vem de"): mora na unidade que RECEBE, mas entra no parcial da ORIGEM (o militar sai de lá).
       unidade_id = origem (de onde sai) · reforco_unidade_id = destino (onde concorre); sem posto nem função. */
    estado.unidades.forEach(function (u) {   /* u = destino (recebe o reforço) */
      (u.vemDe || []).forEach(function (vd) {
        if (vd.origemUnidadeId == null) return;
        var ch = chaveComp[find(vd.origemUnidadeId)];
        if (!porChave[ch]) porChave[ch] = [];
        porChave[ch].push({
          temp_id: vd.tempId, acumulo_temp_id: '',
          unidade_id: vd.origemUnidadeId,
          reforco_unidade_id: u.unidade_id,
          viatura_id: '', instalacao_id: '',
          nome_funcao: '', tipo_contador: vd.tipo_contador,
          base: '', ideal: vd.ideal || '', ideal_calc: vd.ideal_calc || '',
          ordem: vd.ordem || '', ordem_sentido: vd.ordemSentido || '',
          rodizio: !!vd.rodizio, papel_especial: '',
          posto_numero: 0, slot_numero: 0, acumulo_ordem: 0
        });
      });
    });

    /* TODAS as chaves de composição (unidades com efetivo), mesmo sem vagas: garante que a composição
       persista e mantém a sincronização (parcial compartilhado por chave). Os slots de cada chave
       refletem o estado atual do editor (vazio = esvaziar de propósito; o editor sempre carrega o real). */
    var chavesSet = {};
    estado.unidades.forEach(function (u) {
      if ((u.oficiais || 0) > 0 || (u.pracas || 0) > 0) chavesSet[chaveComp[find(u.unidade_id)]] = true;
    });
    var chaves = Object.keys(chavesSet);
    return {
      ctx: ctx,
      user: user || 'sistema',
      id_grupo_completo: (estado.modeloId && String(estado.modeloId).indexOf('novo') !== 0) ? estado.modeloId : null,
      nome: '',
      chaves: chaves,
      grupos_parciais: chaves.map(function (ch) { return { chave: ch, slots: porChave[ch] || [] }; })
    };
  }

  function gravar(estado, recalcularDesde) {
    var ctx = RosterWork.distribuicaoModelos.contextoId();
    var payload = montarPayload(estado, ctx, RosterWork.sessao.cpf());
    if (recalcularDesde) payload.recalcular_desde = recalcularDesde;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    return RosterWork.distribuicaoDados.salvar(payload).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r.ok) {
        RosterWork.distribuicaoEditar.limpoAposSalvar();
        RosterWork.distribuicaoModelos.recarregar();
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Distribuição' });
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
     grava e o banco recalcula as unidades do modelo a partir da data escolhida. */
  function salvar(estado, unidadesContagem) {
    var st = RosterWork.distribuicaoModelos.validar(unidadesContagem);
    var temVermelho = st.itens.some(function (i) { return i.nivel === 'erro'; });
    RosterWork.pedirData({
      mensagem: temVermelho ? RosterWork.mensagens.distribuicao.salvarComErro
                            : RosterWork.mensagens.distribuicao.salvarImpacto,
      textoConfirmar: RosterWork.mensagens.botoes.salvar,
      aoConfirmar: function (iso) { gravar(estado, iso); }
    });
  }

  window.RosterWork.distribuicaoSalvar = { salvar: salvar };
})();
