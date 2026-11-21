/* ============================================================
   ESCALAS — Mudar de unidade neste dia › a conferência do banco (as
   perguntas ficam em escalas-painel-remanejar.js). Com a resposta
   completa, meio segundo depois da última, o banco roda a mudança
   num ensaio (escala_previa): a prévia desta unidade, com a recusa,
   e a da outra. Enquanto confere, a linha Conferindo a mudança; a
   recusa fica em vermelho (quem chama desliga o Salvar). A conta da
   outra unidade vai para o painel (sub.outraUnidade): a nota O que
   mudou da lista e a do Salvar mostram a outra unidade e acham os
   postos dela.
   API: RosterWork.escalasPainelRemanejarConferir.criar(cfg) devolve
     { resultado(chave) (o que o banco conferiu desta resposta, ou null),
       mostrar(c) (o que o banco conferiu; c nulo, a espera),
       agendar(chave) };
   cfg = { el ({ conferindo, erro }), iso, outra() (a outra unidade:
     { unidade_id }), outraDados() (a leitura do dia dela), vivo() (a
     sub-tela na tela), aoConferir() (redesenha) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ESPERA_CONFERIR = 600;   // ms depois da última resposta, o banco confere a mudança

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }

  function criar(cfg) {
    var el = cfg.el;
    var conferido = null;    // o que o banco conferiu da resposta de agora: { chave, erro }
    var pedido = 0, espera = null;

    /* ---------- o que o banco conferiu ---------- */

    /* c nulo: a conta ainda vem (fica o Conferindo a mudança); com a recusa, a nota vermelha */
    function mostrar(c) {
      mostra(el.conferindo, !c);
      mostra(el.erro, !!c && !!c.erro);
      if (c && c.erro) el.erro.querySelector('.nota-texto').textContent = c.erro;
    }

    /* ---------- o banco confere ---------- */

    /* a resposta completa: meio segundo depois da última, o banco roda a mudança num ensaio (a prévia desta unidade, com
       a recusa, e a da outra) */
    function agendar(chave) {
      if (espera) clearTimeout(espera);
      espera = setTimeout(function () { espera = null; conferir(chave); }, ESPERA_CONFERIR);
    }
    function conferir(chave) {
      var meu = ++pedido, D = RosterWork.escalasDados, u = cfg.outra(), antesOutra = cfg.outraDados();
      var marca = ed().marcaDaPrevia();
      var pA = D.lerPrevia('ler_distribuicao_dia', {});
      if (!pA || !u) return;
      function vale() { return meu === pedido && cfg.vivo(); }
      pA.then(function (dA) {
        if (!vale()) return;
        if (!dA) { conferido = { chave: chave }; cfg.aoConferir(); return; }
        if (dA.erro_simulacao) { conferido = { chave: chave, erro: dA.erro_simulacao }; cfg.aoConferir(); return; }
        var pB = D.lerPrevia('escala_dia_arvore', { p_unidade_ids: [Number(u.unidade_id)], p_data: cfg.iso });
        (pB || Promise.resolve(null)).then(function (linhas) {
          if (!vale()) return;
          var dB = (Array.isArray(linhas) ? linhas : []).filter(function (l) { return l && String(l.unidade_id) === String(u.unidade_id); })
            .map(function (l) { return l.distribuicao; })[0] || null;
          conferido = { chave: chave };
          if (dB && antesOutra) ed().outraUnidade(antesOutra, dB, marca);
          cfg.aoConferir();
        });
      });
    }

    return {
      resultado: function (chave) { return conferido && conferido.chave === chave ? conferido : null; },
      mostrar: mostrar,
      agendar: agendar
    };
  }

  window.RosterWork.escalasPainelRemanejarConferir = { criar: criar };
})();
