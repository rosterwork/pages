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
    if (cardSelecionado) { cardSelecionado.classList.remove('linha-militar--selecionada'); cardSelecionado = null; }
  }

  function abrir(card, militar) {
    if (cardSelecionado) cardSelecionado.classList.remove('linha-militar--selecionada');
    cardSelecionado = card;
    card.classList.add('linha-militar--selecionada');
    if (RW.folgasPainel) RW.folgasPainel.abrirDetalhe(militar, limparSelecao);
  }

  /* a árvore chama isto por unidade marcada: monta os militares com o saldo num bloquinho branco
     (unidade sem ninguém fica só com o título) */
  function renderConteudo(container, unidade, itens) {
    var tpl = document.getElementById('tpl-folga-saldo-item');
    var bloquinho = RW.tpl('tpl-arvore-bloquinho');
    if (!tpl || !bloquinho) return;
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
      if (termoBusca) item.classList.add('busca-achado');   // filtrada, a lista só tem quem casa: o que o Enter percorre (geral-busca.js)
      item.addEventListener('click', function () { abrir(item, m); });
      bloquinho.appendChild(item);
      adicionou++;
    });
    if (itens.length > 0 && adicionou === 0) {
      var tplV = document.getElementById('tpl-folga-lista-vazio');
      if (tplV) {
        var v = tplV.content.cloneNode(true).firstElementChild;
        v.textContent = RW.mensagens.folgas.vazioSaldos;
        bloquinho.appendChild(v);
      }
    }
    if (itens.length) container.appendChild(bloquinho);
  }

  /* a árvore avisa quais militares estão nas unidades marcadas (base do picker de "Dar folga") */
  function aoRenderizar(visiveis) { militaresVisiveis = visiveis || []; }

  /* liga a busca pelo componente geral (espera da digitação, limpar e Enter); aqui ela só filtra, sem modo */
  function ligarBusca(conteudo) {
    var caixa = conteudo.querySelector('#busca-folgas');
    if (!caixa || !RW.busca) return;
    RW.busca.criar({
      caixa: caixa,
      aoBuscar: function (termo) {
        termoBusca = termo;
        if (RW.arvoreUnidades) RW.arvoreUnidades.atualizar();
      }
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
