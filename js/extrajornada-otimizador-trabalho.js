/* ============================================================
   EXTRAJORNADA — o trabalhador do otimizador (em segundo plano)
   Roda o HiGHS (bibliotecas/highs.js e highs.wasm) fora da tela, para
   ela não travar durante a conta, nível por nível
   (extrajornada-otimizador-niveis.js). Recebe { modelo, opcoes };
   avisa cada etapa que começa ({ tipo: 'etapa', nomes }) e, no fim,
   devolve { tipo: 'fim', ok, marcadas, valores } ou
   { tipo: 'fim', ok: false, erro }. Quem cria e encerra é o
   extrajornada-otimizador.js.
   ============================================================ */
(function () {
  'use strict';

  var carregado = false;

  /* a biblioteca e os níveis carregam uma vez só; o .wasm vem da mesma pasta */
  function carregar() {
    if (!carregado) {
      self.importScripts('../bibliotecas/highs.js', 'extrajornada-otimizador-niveis.js');
      carregado = true;
    }
  }
  /* uma instância nova do HiGHS por conta */
  function novoHighs() {
    return self.Module({ locateFile: function (arquivo) { return new URL('../bibliotecas/' + arquivo, self.location.href).href; } });
  }

  self.onmessage = function (evento) {
    var pedido = evento.data || {};
    Promise.resolve().then(function () {
      carregar();
      return self.RosterWork.extrajornadaNiveis.resolver(novoHighs, pedido.modelo, pedido.opcoes || {}, function (nomes) {
        self.postMessage({ tipo: 'etapa', nomes: nomes });
      });
    }).then(function (r) {
      self.postMessage({ tipo: 'fim', ok: true, marcadas: r.marcadas, valores: r.valores });
    }).catch(function (e) {
      self.postMessage({ tipo: 'fim', ok: false, erro: String((e && (e.detalhe || e.message)) || e) });
    });
  };
})();
