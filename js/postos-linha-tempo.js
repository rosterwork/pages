/* ============================================================
   POSTOS — seção "Linha do tempo" do painel do posto (instalação
   e viatura, só leitura). Um trecho por linha, em ordem: as datas,
   a situação num selo (Ativo, Em manutenção, Inativo, Excluída) e,
   na viatura que mudou de unidade, a unidade de cada trecho. O
   trecho de hoje ganha o selo "Hoje"; os que já passaram ficam no
   grupo "Anteriores" (componente geral-anteriores). As mudanças
   continuam nos lugares de sempre (Estado, Manutenções, Transferir,
   Excluir). Dados: RPC posto_linha_do_tempo. Molde em postos.html.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* selo de cada situação (as mesmas cores do card) */
  var SELO = { 'Ativo': 'selo--sucesso', 'Em manutenção': 'selo--alerta', 'Excluída': 'selo--erro' };

  function br(iso) { return RosterWork.data.isoParaBR(iso); }

  /* "Permanente", "desde 05/10/2026", "até 06/10/2026" ou "05/10/2026 a 06/10/2026" */
  function textoDatas(t) {
    var M = RosterWork.mensagens.postos;
    if (!t.inicio && !t.fim) return M.periodoPermanente;
    if (!t.inicio) return M.periodoAte.replace('{data}', br(t.fim));
    if (!t.fim) return M.periodoDesde.replace('{data}', br(t.inicio));
    return M.periodoIntervalo.replace('{inicio}', br(t.inicio)).replace('{fim}', br(t.fim));
  }

  function montarTrecho(t, mostrarUnidade) {
    var el = RosterWork.tpl('tpl-posto-trecho');
    el.querySelector('.posto-trecho-datas').textContent = textoDatas(t);
    var unidade = el.querySelector('.posto-trecho-unidade');
    if (mostrarUnidade && t.unidade) { unidade.textContent = t.unidade; unidade.classList.remove('oculto'); }
    var selo = el.querySelector('.posto-trecho-situacao');
    selo.textContent = t.situacao || '';
    if (SELO[t.situacao]) selo.classList.add(SELO[t.situacao]);
    if (t.atual) {
      el.classList.add('posto-trecho--atual');
      el.querySelector('.posto-trecho-hoje').classList.remove('oculto');
    }
    return el;
  }

  function preencher(alvo, trechos) {
    alvo.textContent = '';
    if (!trechos.length) { alvo.appendChild(RosterWork.painel.criarEstado(RosterWork.mensagens.postos.semLinhaTempo)); return; }
    /* a unidade só aparece quando a viatura passou por mais de uma */
    var unidades = {};
    trechos.forEach(function (t) { if (t.unidade) unidades[t.unidade] = true; });
    var mostrarUnidade = Object.keys(unidades).length > 1;
    var passados = trechos.filter(function (t) { return t.passado; });
    var vigentes = trechos.filter(function (t) { return !t.passado; });
    if (passados.length) {
      var itens = passados.map(function (t) { return montarTrecho(t, mostrarUnidade); });
      var grupo = RosterWork.anteriores.montar(itens, false);
      if (grupo) alvo.appendChild(grupo);
      itens.forEach(function (el) { alvo.appendChild(el); });
    }
    vigentes.forEach(function (t) { alvo.appendChild(montarTrecho(t, mostrarUnidade)); });
  }

  /* monta a seção (fechada) no corpo do painel e carrega os trechos do posto */
  function montar(corpo, viaturaId, instalacaoId) {
    if (!corpo || !RosterWork.painel) return;
    var secao = RosterWork.painel.criarSecaoColapsavel('Linha do tempo', { aberta: false });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    alvo.appendChild(RosterWork.painel.criarCarregando());
    corpo.appendChild(secao);
    RosterWork.apiFetch('/rest/v1/rpc/posto_linha_do_tempo', {
      metodo: 'POST',
      corpo: { p_viatura_id: viaturaId || null, p_instalacao_id: instalacaoId || null }
    })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (trechos) {
        if (!Array.isArray(trechos)) throw new Error('falha');
        preencher(alvo, trechos);
      })
      .catch(function () {
        alvo.textContent = '';
        alvo.appendChild(RosterWork.painel.criarEstado(RosterWork.mensagens.postos.falhaLinhaTempo));
      });
  }

  window.RosterWork.postosLinhaTempo = { montar: montar };
})();
