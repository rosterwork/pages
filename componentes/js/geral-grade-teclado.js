/* ============================================================
   GRADE — navegação por teclado (roving tabindex)
   Uma grade de muitas células não deve ter uma parada de Tab por
   célula (seriam centenas). O padrão certo: o Tab entra na grade
   UMA vez (na célula ativa) e as SETAS movem entre as células.
   Enter/Espaço ativa (dispara o clique que já existe).
   Uso: RosterWork.gradeTeclado.ativar(grade, { celula, linha })
   ou, para leiaute próprio (ex.: o calendário, com várias células por
   dia): { celula, matriz } — matriz(grade) devolve as linhas de
   células prontas, com null nos buracos (dias de fora do mês).
   Chamar após cada render (a grade é reconstruída; setup idempotente
   por elemento — a grade nova recebe o listener; a antiga é descartada).
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  function matriz(grade, op) {
    var linhas = Array.prototype.filter.call(
      grade.querySelectorAll(op.linha),
      function (l) { return l.querySelector(op.celula); }
    );
    return linhas.map(function (l) { return Array.prototype.slice.call(l.querySelectorAll(op.celula)); });
  }

  function focar(grade, op, celula) {
    if (!celula) return;
    var todas = grade.querySelectorAll(op.celula);
    for (var i = 0; i < todas.length; i++) todas[i].setAttribute('tabindex', '-1');
    celula.setAttribute('tabindex', '0');
    celula.focus();
  }

  /* primeira / última célula existente da linha (pula os buracos null) */
  function primeiraDaLinha(linha) {
    for (var i = 0; i < linha.length; i++) if (linha[i]) return linha[i];
    return null;
  }

  function ultimaDaLinha(linha) {
    for (var i = linha.length - 1; i >= 0; i--) if (linha[i]) return linha[i];
    return null;
  }

  function ativar(grade, op) {
    if (!grade || !op || !op.celula || (!op.linha && !op.matriz)) return;
    var celulas = grade.querySelectorAll(op.celula);
    if (!celulas.length) return;

    /* roving inicial: todas -1, a primeira 0 (o ponto de entrada do Tab) */
    for (var i = 0; i < celulas.length; i++) celulas[i].setAttribute('tabindex', '-1');
    celulas[0].setAttribute('tabindex', '0');

    if (grade.dataset.gradeTeclado) return;   /* listener no próprio container (persiste enquanto a grade viver) */
    grade.dataset.gradeTeclado = '1';

    grade.addEventListener('keydown', function (evento) {
      var c = evento.target.closest(op.celula);
      if (!c || !grade.contains(c)) return;

      if (evento.key === 'Enter' || evento.key === ' ' || evento.key === 'Spacebar') {
        evento.preventDefault(); c.click(); return;
      }
      var seta = { ArrowRight: 1, ArrowLeft: 1, ArrowDown: 1, ArrowUp: 1, Home: 1, End: 1 };
      if (!seta[evento.key]) return;

      var m = op.matriz ? op.matriz(grade) : matriz(grade, op);
      var r = -1, col = -1;
      for (var i = 0; i < m.length && r === -1; i++) {
        var j = m[i].indexOf(c);
        if (j !== -1) { r = i; col = j; }
      }
      if (r === -1) return;

      var destino = null;
      if (evento.key === 'ArrowRight') destino = m[r][col + 1];
      else if (evento.key === 'ArrowLeft') destino = m[r][col - 1];
      else if (evento.key === 'ArrowDown') destino = m[r + 1] && m[r + 1][col];
      else if (evento.key === 'ArrowUp') destino = m[r - 1] && m[r - 1][col];
      else if (evento.key === 'Home') destino = primeiraDaLinha(m[r]);
      else if (evento.key === 'End') destino = ultimaDaLinha(m[r]);

      if (destino) { evento.preventDefault(); focar(grade, op, destino); }
    });
  }

  RW.gradeTeclado = { ativar: ativar };
})();
