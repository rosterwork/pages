/* ============================================================
   FOLGAS — aba "Minhas folgas" (autosserviço do militar)
   A porta da frente: o próprio saldo em destaque, o botão
   Solicitar folga, os pedidos em aberto e o extrato pessoal.
   Lê o extrato do próprio CPF (folgas_extrato). O formulário de
   solicitar abre na gaveta (folgas-painel).
   Expõe RosterWork.folgasMinhas.{ montar, carregar }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var raizConteudo = null;
  var ctx = null;
  var ultimoSaldo = 0;   // último saldo carregado, p/ o botão "Solicitar folga" do cabeçalho

  function fmt() { return RW.folgasFormato; }
  function msg() { return RW.mensagens.folgas; }
  function meuMilitar() {
    var u = RosterWork.sessao.perfil() || {};
    return { usuario_id: u.cpf, grau_abreviacao: u.grau_abreviacao, nome_de_guerra: u.nome_de_guerra, lotacao_atual: u.lotacao_id };
  }
  function alvo() { return raizConteudo ? raizConteudo.querySelector('#folgas-minhas') : document.getElementById('folgas-minhas'); }

  function carregando(el) {
    el.textContent = '';
    var box = RosterWork.tpl('tpl-folga-lista-vazio');
    var pts = document.getElementById('carregando-pontos');
    if (box && pts) { box.appendChild(pts.content.cloneNode(true)); el.appendChild(box); }
  }

  function renderizar(el, dados) {
    el.textContent = '';
    var raiz = RosterWork.tpl('tpl-folga-minhas'); if (!raiz) return;
    var saldo = dados ? (dados.saldo_minutos || 0) : 0;
    ultimoSaldo = saldo;
    var valor = raiz.querySelector('.folga-saldo-bloco-valor');
    valor.textContent = fmt().saldoTexto(saldo);
    if (saldo > 0) valor.classList.add('folga-saldo-bloco-valor--positivo');
    else if (saldo < 0) valor.classList.add('folga-saldo-bloco-valor--negativo');

    var linhas = (dados && Array.isArray(dados.linhas)) ? dados.linhas : [];
    var pedidos = linhas.filter(function (l) { return l.situacao === 'pendente'; });
    var extrato = linhas.filter(function (l) { return l.situacao !== 'pendente'; });

    var secPedidos = raiz.querySelector('[data-secao="pedidos"]');
    var listaPedidos = raiz.querySelector('[data-lista="pedidos"]');
    if (pedidos.length && secPedidos && listaPedidos) {
      secPedidos.classList.remove('oculto');
      pedidos.forEach(function (l) { var e = RW.folgasPainel && RW.folgasPainel.linhaExtrato(l); if (e) listaPedidos.appendChild(e); });
    }

    var listaExtrato = raiz.querySelector('[data-lista="extrato"]');
    if (listaExtrato) {
      if (!extrato.length) {
        var vazio = RosterWork.tpl('tpl-folga-lista-vazio'); if (vazio) { vazio.textContent = msg().extratoVazio; listaExtrato.appendChild(vazio); }
      } else {
        extrato.forEach(function (l) { var e = RW.folgasPainel && RW.folgasPainel.linhaExtrato(l); if (e) listaExtrato.appendChild(e); });
      }
    }
    el.appendChild(raiz);
  }

  function falharExtrato(el) {
    el.textContent = '';
    var v = RosterWork.tpl('tpl-folga-lista-vazio'); if (v) { v.textContent = msg().falhaExtrato; el.appendChild(v); }
  }

  function carregar() {
    var el = alvo();
    if (!el || !document.contains(el)) return;
    var u = RosterWork.sessao.perfil();
    if (!u || !u.cpf) return;
    carregando(el);
    RW.folgasDados.extrato(u.cpf).then(function (r) {
      if (!document.contains(el)) return;
      if (r == null) { falharExtrato(el); return; }   // null = falha (não confundir com saldo 0 real)
      renderizar(el, r);
    }).catch(function () {
      if (!document.contains(el)) return;
      falharExtrato(el);
    });
  }

  function montar(conteudo, contexto) {
    raizConteudo = conteudo;
    ctx = contexto || {};
    carregar();
  }

  /* aberto pelo botão "Solicitar folga" do cabeçalho (o militar pede a própria folga) */
  function solicitar() {
    if (RW.folgasPainel) RW.folgasPainel.abrirFormFolga({ modo: 'solicitar', militar: meuMilitar(), saldoAtual: ultimoSaldo });
  }

  RW.folgasMinhas = { montar: montar, carregar: carregar, solicitar: solicitar };
})();
