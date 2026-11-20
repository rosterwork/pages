/* ============================================================
   EXTRAJORNADA — os níveis do Preencher pela sugestão
   O placar em níveis de verdade: cada nível é uma conta do HiGHS, com
   os de cima fixados no melhor deles (o de cima sempre vale mais que
   todos os de baixo juntos). Recebe o modelo do
   extrajornada-otimizador.js ({ niveis, base }) e devolve as extras
   escolhidas. Roda no trabalhador em segundo plano
   (extrajornada-otimizador-trabalho.js) e, sem ele, na tela.
   Cuidados do HiGHS em WebAssembly: uma instância nova por conta (a
   mesma, depois de umas contas, corrompe a memória) e o lado direito
   das regras sempre inteiro (com fração, ele cai).
   RosterWork.extrajornadaNiveis.
   ============================================================ */
(function (raiz) {
  'use strict';

  var RW = raiz.RosterWork = raiz.RosterWork || {};
  /* o maior peso que ainda deixa a conta exata ao juntar dois níveis vizinhos numa conta só */
  var TETO = 2e5;

  function num(v) { return Number.isInteger(v) ? String(v) : v.toFixed(4); }

  /* os níveis em contas, juntando os vizinhos pequenos enquanto o peso exato cabe; o de baixo de tudo (a balança, com
     frações) e a falta (por pelotão) ficam sozinhos */
  function etapas(niveis) {
    var lista = [], atual = null;
    for (var i = niveis.length - 1; i >= 0; i--) {
      var n = niveis[i], teto = n.termos.reduce(function (s, t) { return s + Math.abs(t[0]) * t[2]; }, 0);
      var inteiro = n.termos.every(function (t) { return Number.isInteger(t[0]); });
      if (atual && inteiro && atual.inteiro && !n.partes && !atual.partes && (atual.teto + 1) * teto + atual.teto <= TETO) {
        var w = atual.teto + 1;
        atual.termos = n.termos.map(function (t) { return [t[0] * w, t[1], t[2]]; }).concat(atual.termos);
        atual.teto = w * teto + atual.teto;
        atual.nomes.unshift(n.nome);
        atual.melhorPossivel = undefined;
      } else {
        atual = { termos: n.termos.slice(), teto: teto, inteiro: inteiro, nomes: [n.nome], partes: n.partes, melhorPossivel: n.teto };
        lista.unshift(atual);
      }
    }
    return lista;
  }

  /* a expressão do objetivo (os termos da mesma variável somados) */
  function expressao(termos) {
    var soma = {};
    termos.forEach(function (t) { soma[t[1]] = (soma[t[1]] || 0) + t[0]; });
    return Object.keys(soma).filter(function (v) { return soma[v]; })
      .map(function (v) { return num(soma[v]) + ' ' + v; }).join(' + ').replace(/\+ -/g, '- ');
  }

  function valorEm(termos, colunas) {
    return termos.reduce(function (t, x) { return t + x[0] * (((colunas || {})[x[1]] || {}).Primal || 0); }, 0);
  }

  /* as contas em sequência: cada uma maximiza o seu nível com os de cima fixados no melhor deles. novoHighs() devolve
     (a promessa de) uma instância nova do HiGHS; aoEtapa(nomes) avisa a etapa que começa (as frases da janela) */
  function resolver(novoHighs, modelo, opcoes, aoEtapa) {
    var lista = etapas(modelo.niveis), fixas = [], r = null, valores = [];
    /* os limites de cada variável: a falta coberta por inteiro fica fixa no teto */
    var limites = {}, outros = [];
    modelo.base.lim.forEach(function (l) { var m = l.match(/^0 <= (\S+) <= (\S+)$/); if (m) limites[m[1]] = l; else outros.push(l); });

    function etapa(i) {
      if (i >= lista.length) {
        var marcadas = Object.keys(r.Columns).filter(function (nome) { return nome.charAt(0) === 'x' && r.Columns[nome].Primal > 0.5; });
        return Promise.resolve({ marcadas: marcadas, valores: valores });
      }
      var e = lista[i], obj = expressao(e.termos) || '0 x0';
      if (aoEtapa) aoEtapa(e.nomes);
      /* a conta de cima já deixou este nível no melhor possível: ele fica como está, sem outra conta */
      var maximo = e.melhorPossivel != null ? e.melhorPossivel : e.termos.reduce(function (t, x) { return t + Math.max(0, x[0]) * x[2]; }, 0);
      if (r && valorEm(e.termos, r.Columns) >= maximo - 1e-6) {
        valores.push({ nomes: e.nomes, valor: maximo, pulado: true });
        if (i < lista.length - 1) fixas.push('f' + i + ': ' + obj + ' >= ' + Math.round(maximo));
        return etapa(i + 1);
      }
      var lp = 'Maximize\n obj: ' + obj + '\nSubject To\n ' + modelo.base.cons.concat(fixas).join('\n ') +
               '\nBounds\n ' + outros.concat(Object.keys(limites).map(function (v) { return limites[v]; })).join('\n ') +
               '\nBinary\n ' + modelo.base.bins.join(' ') + '\nEnd\n';
      return Promise.resolve(novoHighs()).then(function (highs) {
        r = highs.solve(lp, opcoes);
        /* passando do tempo da conta, vale a melhor achada (ela vira a regra das de baixo do mesmo jeito) */
        if (r.Status !== 'Optimal' && !(r.Status === 'Time limit reached' && isFinite(r.ObjectiveValue))) throw { motivo: 'falha', detalhe: r.Status };
        valores.push({ nomes: e.nomes, valor: r.ObjectiveValue });
        if (i < lista.length - 1) {
          if (e.partes) {
            /* a falta, pelotão por pelotão: coberta por inteiro, cada pedaço fica no teto; senão, a soma do pelotão não cai */
            e.partes.forEach(function (parte, j) {
              var feito = 0, teto = 0;
              parte.forEach(function (t) { feito += (r.Columns[t[1]] || {}).Primal || 0; teto += t[2]; });
              if (feito >= teto - 0.5) parte.forEach(function (t) { limites[t[1]] = t[1] + ' = ' + t[2]; });
              else fixas.push('p' + i + '_' + j + ': ' + parte.map(function (t) { return t[1]; }).join(' + ') + ' >= ' + Math.round(feito));
            });
          } else {
            /* o melhor desta conta vira regra das de baixo */
            fixas.push('f' + i + ': ' + obj + ' >= ' + Math.round(r.ObjectiveValue));
          }
        }
        return etapa(i + 1);
      });
    }
    return etapa(0);
  }

  RW.extrajornadaNiveis = { etapas: etapas, resolver: resolver };
})(typeof self !== 'undefined' ? self : window);
