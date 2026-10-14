/* ============================================================
   FOLGAS — lista do Histórico (aba Equipe)
   Todas as folgas já decididas, com o filtro de período. Os pedidos
   pendentes se decidem na página Pendências.
   Expõe RosterWork.folgasListas.{ ligar, carregarHistorico }.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var ctx = null;
  var periodo = '30';
  var seqHist = 0;    // token do Histórico: ignora resposta antiga ao trocar de período rápido

  function fmt() { return RW.folgasFormato; }
  function msg() { return RW.mensagens.folgas; }

  function desdeDoPeriodo() {
    if (periodo === 'tudo') return null;
    var d = new Date(); d.setHours(0, 0, 0, 0);
    if (periodo === '30') d.setDate(d.getDate() - 29);
    else if (periodo === '90') d.setDate(d.getDate() - 89);
    else if (periodo === 'ano') d.setFullYear(d.getFullYear() - 1);
    var m = d.getMonth() + 1, dia = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dia < 10 ? '0' + dia : dia);
  }

  function limpar(el) { if (el) el.textContent = ''; }
  function carregandoEm(el) {
    limpar(el);
    var v = RosterWork.tpl('tpl-folga-lista-vazio');
    var pts = document.getElementById('carregando-pontos');
    if (v && pts) { v.appendChild(pts.content.cloneNode(true)); el.appendChild(v); }
  }
  function vazioEm(el, texto) { limpar(el); var v = RosterWork.tpl('tpl-folga-lista-vazio'); if (v) { v.textContent = texto; el.appendChild(v); } }

  function renderHistorico(el, lista) {
    if (!lista.length) { vazioEm(el, msg().vazioLancamentos); return; }
    limpar(el);
    lista.forEach(function (l) {
      var item = RosterWork.tpl('tpl-folga-linha'); if (!item) return;
      item.querySelector('.folga-linha-titulo').textContent = l.nome || '';
      var meta = fmt().dataNumerica(l.data_ref) + ' · ' + fmt().horasAbs(l.minutos);
      if (l.decidido_por_nome) meta += ' · ' + msg().porNome(l.decidido_por_nome);
      item.querySelector('.folga-linha-meta').textContent = meta;
      var selo = RosterWork.tpl('tpl-folga-selo');
      if (selo) { selo.classList.add(fmt().situacaoClasse(l.situacao)); selo.textContent = msg().situacao[l.situacao] || l.situacao; item.querySelector('.folga-linha-fim').appendChild(selo); }
      el.appendChild(item);
    });
  }

  function carregarHistorico() {
    var el = document.getElementById('folgas-historico');
    if (!el || !document.contains(el)) return;
    carregandoEm(el);
    var req = ++seqHist;
    RW.folgasDados.lancamentos('todos', desdeDoPeriodo()).then(function (lista) {
      if (!document.contains(el) || req !== seqHist) return;
      if (lista == null) { vazioEm(el, msg().falhaCarregar); return; }   // null = falha
      renderHistorico(el, Array.isArray(lista) ? lista : []);
    }).catch(function () { if (document.contains(el) && req === seqHist) vazioEm(el, msg().falhaCarregar); });
  }

  function ligarControles(conteudo) {
    var texto = conteudo.querySelector('#folgas-periodo-texto');
    var itens = conteudo.querySelectorAll('#folgas-periodo .dropdown-item');
    for (var i = 0; i < itens.length; i++) {
      (function (it) {
        it.addEventListener('click', function () { periodo = it.getAttribute('data-periodo'); if (texto) texto.textContent = it.textContent; carregarHistorico(); });
      })(itens[i]);
    }
  }

  function ligar(conteudo, contexto) { ctx = contexto || {}; periodo = '30'; ligarControles(conteudo); }

  RW.folgasListas = { ligar: ligar, carregarHistorico: carregarHistorico };
})();
