/* ============================================================
   NOVA EXTRA — o trabalhador do otimizador (em segundo plano)
   Roda o HiGHS (bibliotecas/highs.js e highs.wasm) fora da tela, para
   ela não travar durante a conta. Recebe { lp, opcoes } e devolve
   { ok, status, marcadas } (os nomes das variáveis escolhidas) ou
   { ok: false, erro }. Quem cria e encerra é o nova-extra-otimizador.js.
   ============================================================ */
(function () {
  'use strict';

  var pronto = null;

  /* a biblioteca carrega uma vez só; o .wasm vem da mesma pasta */
  function carregar() {
    if (!pronto) {
      self.importScripts('../bibliotecas/highs.js');
      pronto = self.Module({ locateFile: function (arquivo) { return new URL('../bibliotecas/' + arquivo, self.location.href).href; } });
    }
    return pronto;
  }

  self.onmessage = function (evento) {
    var pedido = evento.data || {};
    Promise.resolve().then(carregar).then(function (highs) {
      var r = highs.solve(pedido.lp, pedido.opcoes || {});
      var marcadas = Object.keys(r.Columns || {}).filter(function (nome) {
        return nome.charAt(0) === 'x' && r.Columns[nome].Primal > 0.5;
      });
      self.postMessage({ ok: true, status: r.Status, marcadas: marcadas });
    }).catch(function (e) {
      self.postMessage({ ok: false, erro: String((e && e.message) || e) });
    });
  };
})();
