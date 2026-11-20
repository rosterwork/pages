/* ============================================================
   ESCALAS — Mudar de unidade neste dia › o Como fica (as perguntas
   ficam em escalas-painel-remanejar.js). Com a resposta completa,
   meio segundo depois da última, o banco roda a mudança num ensaio
   (escala_previa): a prévia desta unidade, com a recusa, e a da
   outra. O Como fica diz, uma linha por militar, quem muda de lugar
   nas duas unidades, com as frases do O que mudou
   (escalas-painel-editar.js › diferenca e fraseMudou): quem sai de
   uma unidade e entra na outra fica numa linha só. A recusa fica em
   vermelho (quem chama desliga o Salvar). A conta da outra unidade
   vai para o painel (sub.outraUnidade): a nota O que mudou da lista e
   a do Salvar mostram a outra unidade e acham os postos dela.
   API: RosterWork.escalasPainelRemanejarComo.criar(cfg) devolve
     { resultado(chave) (o que o banco conferiu desta resposta, ou null),
       mostrar(c) (o Como fica de um resultado; nulo, a espera),
       agendar(chave) };
   cfg = { el ({ como, comoLista, conferindo, erro }), dados (a leitura
     do dia desta unidade), iso, outra() (a outra unidade: { unidade_id }),
     outraDados() (a leitura do dia dela), vivo() (a sub-tela na tela),
     aoConferir() (redesenha) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ESPERA_CONFERIR = 600;   // ms depois da última resposta, o banco confere a mudança

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }

  function criar(cfg) {
    var el = cfg.el;
    var conferido = null;    // o que o banco conferiu da resposta de agora: { chave, erro, dA, dB, antesOutra }
    var pedido = 0, espera = null;

    /* ---------- o Como fica ---------- */

    /* uma frase por militar que mudou de lugar: as duas unidades juntas (sem a prévia da outra, só esta) */
    function frases(c) {
      var api = ed();
      var antes = c.dB ? [cfg.dados, c.antesOutra] : [cfg.dados], depois = c.dB ? [c.dA, c.dB] : [c.dA];
      return api.diferenca(antes, depois)
        .map(function (x) { return api.fraseMudou(x, depois.concat(antes)); })
        .filter(Boolean);
    }

    /* c nulo: a conta ainda vem (as linhas da resposta de antes saem, fica o Conferindo a mudança); com a recusa, a
       nota vermelha no lugar do Como fica */
    function mostrar(c) {
      mostra(el.erro, false);
      if (c && c.erro) {
        el.erro.querySelector('.nota-texto').textContent = c.erro;
        mostra(el.erro, true);
        mostra(el.como, false);
        return;
      }
      var linhas = c && c.dA ? frases(c) : [];
      el.comoLista.textContent = '';
      linhas.forEach(function (texto) {
        var li = RosterWork.tpl('tpl-escala-remanejar-como-item');
        if (li) { li.textContent = texto; el.comoLista.appendChild(li); }
      });
      mostra(el.comoLista, linhas.length > 0);
      mostra(el.conferindo, !c);
      mostra(el.como, !c || linhas.length > 0);
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
        if (!dA) { conferido = { chave: chave, dA: null }; cfg.aoConferir(); return; }
        if (dA.erro_simulacao) { conferido = { chave: chave, erro: dA.erro_simulacao }; cfg.aoConferir(); return; }
        var pB = D.lerPrevia('escala_dia_arvore', { p_unidade_ids: [Number(u.unidade_id)], p_data: cfg.iso });
        (pB || Promise.resolve(null)).then(function (linhas) {
          if (!vale()) return;
          var dB = (Array.isArray(linhas) ? linhas : []).filter(function (l) { return l && String(l.unidade_id) === String(u.unidade_id); })
            .map(function (l) { return l.distribuicao; })[0] || null;
          conferido = { chave: chave, dA: dA, dB: dB && antesOutra ? dB : null, antesOutra: antesOutra };
          if (conferido.dB) ed().outraUnidade(antesOutra, dB, marca);
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

  window.RosterWork.escalasPainelRemanejarComo = { criar: criar };
})();
