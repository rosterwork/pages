/* ============================================================
   FOLGAS — aba Saldos (o placar)
   Reusa o componente geral-arvore-unidades: os militares vêm da
   RPC folgas_listar_saldos (agrupados por lotação) e cada linha
   mostra o saldo em horas (selo verde +, vermelho −, neutro 0).
   Clicar num militar abre o extrato na gaveta. Busca no topo.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var termoBusca = '';
  var cardSelecionado = null;
  var militaresVisiveis = [];
  var ctx = null;

  function fmt() { return RW.folgasFormato; }

  function casaBusca(m) {
    if (!termoBusca) return true;
    var alvo = RosterWork.busca.normalizar(termoBusca);
    if (RosterWork.busca.normalizar(m.nome_de_guerra).indexOf(alvo) !== -1) return true;
    if (RosterWork.busca.normalizar(m.nome_completo).indexOf(alvo) !== -1) return true;
    var dig = termoBusca.replace(/\D/g, '');
    if (dig && String(m.usuario_id || '').indexOf(dig) !== -1) return true;
    return false;
  }

  function limparSelecao() {
    if (cardSelecionado) { cardSelecionado.classList.remove('folga-saldo-item--selecionada'); cardSelecionado = null; }
  }

  function abrir(card, militar) {
    if (cardSelecionado) cardSelecionado.classList.remove('folga-saldo-item--selecionada');
    cardSelecionado = card;
    card.classList.add('folga-saldo-item--selecionada');
    if (RW.folgasPainel) RW.folgasPainel.abrirDetalhe(militar, limparSelecao);
  }

  /* a árvore chama isto por unidade marcada: monta os militares com o saldo */
  function renderConteudo(container, unidade, itens) {
    var tpl = document.getElementById('tpl-folga-saldo-item');
    if (!tpl) return;
    var adicionou = 0;
    itens.forEach(function (m) {
      if (!casaBusca(m)) return;
      var item = tpl.content.cloneNode(true).firstElementChild;
      item.querySelector('.folga-saldo-grad').textContent = m.grau_abreviacao || '';
      item.querySelector('.folga-saldo-nome').textContent = m.nome_de_guerra || '';
      var selo = item.querySelector('.folga-saldo-selo');
      selo.textContent = fmt().saldoTexto(m.saldo_minutos);
      var classe = fmt().saldoSeloClasse(m.saldo_minutos);
      if (classe) selo.classList.add(classe);
      item.addEventListener('click', function () { abrir(item, m); });
      container.appendChild(item);
      adicionou++;
    });
    if (itens.length > 0 && adicionou === 0) {
      var tplV = document.getElementById('tpl-folga-lista-vazio');
      if (tplV) {
        var v = tplV.content.cloneNode(true).firstElementChild;
        v.textContent = RW.mensagens.folgas.vazioSaldos;
        container.appendChild(v);
      }
    }
  }

  /* a árvore avisa quais militares estão nas unidades marcadas (base do picker de "Dar folga") */
  function aoRenderizar(visiveis) { militaresVisiveis = visiveis || []; }

  function ligarBusca(conteudo) {
    var caixa = conteudo.querySelector('#busca-folgas');
    var entrada = conteudo.querySelector('#busca-folgas-entrada');
    var limpar = conteudo.querySelector('#busca-folgas-limpar');
    if (!entrada) return;
    var tmr = null;
    entrada.addEventListener('input', function () {
      var v = entrada.value.trim();
      if (caixa) caixa.classList.toggle('busca--com-texto', v !== '');
      clearTimeout(tmr);
      tmr = setTimeout(function () {
        termoBusca = v;
        if (RW.arvoreUnidades) RW.arvoreUnidades.atualizar();
      }, 250);
    });
    if (limpar) limpar.addEventListener('click', function () {
      entrada.value = ''; termoBusca = '';
      if (caixa) caixa.classList.remove('busca--com-texto');
      entrada.focus();
      if (RW.arvoreUnidades) RW.arvoreUnidades.atualizar();
    });
  }

  function montar(conteudo, contexto) {
    ctx = contexto || {};
    termoBusca = '';
    cardSelecionado = null;
    militaresVisiveis = [];
    ligarBusca(conteudo);
    var container = conteudo.querySelector('#arvore-folgas');
    if (!container || !RW.arvoreUnidades) return Promise.resolve();
    return RW.arvoreUnidades.montar(container, {
      rpcConteudo: 'folgas_listar_saldos',
      chaveUnidade: 'lotacao_atual',
      renderConteudo: renderConteudo,
      aoRenderizar: aoRenderizar
    });
  }

  RW.folgasSaldos = {
    montar: montar,
    militares: function () { return militaresVisiveis; },
    limparSelecao: limparSelecao
  };
})();
