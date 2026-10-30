/* ============================================================
   NOVA EXTRA — o otimizador do "Preencher pela sugestão"
   Pede ao banco os dados (nova_extra_sugerir com p_so_dados), monta o
   placar das prioridades como um problema de programação inteira e o
   resolve com o HiGHS (bibliotecas/), num trabalhador em segundo plano
   (nova-extra-otimizador-trabalho.js; sem ele, na própria tela). As
   escolhas voltam ao banco, que confere as regras e devolve o porquê
   (p_escolhidas). Se o cálculo falhar, passar de 1 minuto ou o banco
   recusar alguma escolha, vale o cálculo simples do banco (o motor
   reserva). Enquanto calcula, o véu cobre a tela, com o Cancelar.
   Não cria HTML (o véu está na página) nem escreve estilo (só classList).
   RosterWork.novaExtraOtimizador.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TRABALHADOR = 'js/nova-extra-otimizador-trabalho.js';
  var BIBLIOTECA = 'bibliotecas/highs.js';
  var LIMITE_MS = 60000;
  /* presolve desligado: com ele, o HiGHS em WebAssembly cai em alguns meses; a folga mínima evita a outra queda */
  var OPCOES = { presolve: 'off', time_limit: 55, mip_rel_gap: 0.000001 };
  var JANELAS = [{ ini: 1, tam: 4 }, { ini: 1, tam: 3 }, { ini: 2, tam: 3 }, { ini: 1, tam: 2 }, { ini: 2, tam: 2 }, { ini: 3, tam: 2 }];
  var GRUPOS = ['sargento', 'cabo', 'soldado'];
  /* o placar (maior vale mais): o vermelho de fora da cidade da companhia, o dela, o amarelo de fora, o dela; depois as
     penalidades e os bônus de cada extra, na ordem das prioridades; e a equalização da sobra (graduação e gente) */
  var P = { vermFora: 10000000, vermSede: 1000000, amarFora: 100000, amarSede: 10000, foraDoPelotao: 2000, passa: 1000,
            hora: 200, fila: 10, bloco: 150, emenda: 80, quer: 15, grupo: 5, gente: 2 };

  var atual = null;        // o cálculo no ar: { cancelar }
  var pedido = 0;          // latest-wins: só vale o resultado do último Preencher
  var calculando = false;

  function chave(u, d, b) { return u + '|' + d + '|' + b; }
  function blocos(x) { var l = []; for (var b = x.ini; b < x.ini + x.tam; b++) l.push(b); return l; }
  function num(v) { return Number.isInteger(v) ? String(v) : v.toFixed(3); }

  /* ---------- o modelo: as extras possíveis e o placar ---------- */
  function montarModelo(D) {
    var sede = D.sede || [], N = D.mil.length || 1;
    var dia = {}, fixaNoDia = {}, fixas = {}, fixasGrupo = {}, cap = {}, esc = {}, nec = {};
    D.dia.forEach(function (x) { dia[x.cpf + '|' + x.data] = x; });
    (D.fixas || []).forEach(function (f) {
      fixaNoDia[f.cpf + '|' + f.data] = true;
      (f.blocos || []).forEach(function (b) {
        var k = chave(f.uid, f.data, b);
        fixas[k] = (fixas[k] || 0) + 1;
        if (f.grupo) fixasGrupo[k + '|' + f.grupo] = (fixasGrupo[k + '|' + f.grupo] || 0) + 1;
      });
    });
    (D.cap || []).forEach(function (c) { cap[c.uid + '|' + c.data] = c.n; });
    (D.escala || []).forEach(function (e) { esc[chave(e.uid, e.data, e.b)] = e; });
    function necDe(k) { return nec[k] || (nec[k] = { vg: 0, ag: 0, vc: [], ac: [] }); }
    D.falta.forEach(function (f) { var x = necDe(chave(f.uid, f.data, f.b)); if (f.nivel === 1) x.vg += f.n; else x.ag += f.n; });
    (D.condutor || []).forEach(function (c) { var x = necDe(chave(c.uid, c.data, c.b)); (c.nivel === 1 ? x.vc : x.ac).push(c.cnh); });
    function vaga(k, u, d) { return (cap[u + '|' + d] || 0) - ((esc[k] || {}).mx || 0) - (fixas[k] || 0); }
    function conduz(m, lista) { return lista.length > 0 && (m.conduz || []).indexOf(lista[0]) >= 0; }
    var datas = Object.keys(D.dia.reduce(function (o, x) { o[x.data] = 1; return o; }, {})).sort();

    /* as extras possíveis: dia livre e sem extra fixa, a janela que cabe na cota (só 24 h: inteira) e no expediente, e
       cada horário com falta que ele cobre ou vaga até o máximo; fora da cidade da companhia, ao menos um com falta */
    var xs = [], cobre = {};
    D.mil.forEach(function (m) {
      datas.forEach(function (d) {
        var x = dia[m.cpf + '|' + d];
        if (!x || !x.livre || fixaNoDia[m.cpf + '|' + d]) return;
        D.pelotoes.forEach(function (u) {
          var ehSede = sede.indexOf(u) >= 0;
          JANELAS.forEach(function (w) {
            if (m.so24 ? w.tam !== 4 : w.tam > m.resta) return;
            var bs = blocos(w), util = false;
            if (x.livres && bs.some(function (b) { return x.livres.indexOf(b) < 0; })) return;
            for (var i = 0; i < bs.length; i++) {
              var k = chave(u, d, bs[i]), n = nec[k];
              var serve = !!n && (n.vg + n.ag > 0 || conduz(m, n.vc) || conduz(m, n.ac));
              if (serve) util = true;
              else if (vaga(k, u, d) <= 0) return;
            }
            if (!util && !ehSede) return;
            var j = xs.length;
            xs.push({ m: m, u: u, d: d, ini: w.ini, tam: w.tam, quer: !!x.quer, emenda: (x.ant && w.ini === 1) || (x.prox && w.ini + w.tam - 1 === 4) });
            bs.forEach(function (b) { var k = chave(u, d, b); (cobre[k] = cobre[k] || []).push(j); });
          });
        });
      });
    });

    var obj = [], cons = [], lim = [], bins = [], c = 0;
    xs.forEach(function (x, i) {
      var v = -P.bloco + (x.emenda ? P.emenda : 0) + x.tam * (P.hora + P.fila * (N - x.m.ordem + 1) / N + (x.quer ? P.quer : 0));
      if (x.u !== x.m.uid) v -= P.foraDoPelotao * x.tam;
      obj.push(num(v) + ' x' + i); bins.push('x' + i);
    });
    /* cada horário de cada pelotão: o que as extras cobrem (condutor e gente, vermelho e amarelo) e o que passa (s), até
       a vaga do máximo; na cidade da companhia, a equalização pela graduação e pela gente */
    Object.keys(cobre).forEach(function (k, s) {
      var p = k.split('|'), u = +p[0], d = p[1], ehSede = sede.indexOf(u) >= 0, n = nec[k] || { vg: 0, ag: 0, vc: [], ac: [] };
      var lista = cobre[k], soma = lista.map(function (i) { return 'x' + i; }).join(' + ');
      var partes = [];
      [['cv', n.vc.length, ehSede ? P.vermSede : P.vermFora], ['gv', n.vg, ehSede ? P.vermSede : P.vermFora],
       ['ca', n.ac.length, ehSede ? P.amarSede : P.amarFora], ['ga', n.ag, ehSede ? P.amarSede : P.amarFora]].forEach(function (t) {
        if (t[1] <= 0) return;
        obj.push(t[2] + ' ' + t[0] + s); lim.push('0 <= ' + t[0] + s + ' <= ' + t[1]); partes.push(t[0] + s);
      });
      /* o condutor só com a CNH da viatura */
      [['cv', n.vc], ['ca', n.ac]].forEach(function (t) {
        if (!t[1].length) return;
        var comp = lista.filter(function (i) { return conduz(xs[i].m, t[1]); });
        cons.push('c' + (c++) + ': ' + t[0] + s + (comp.length ? ' - ' + comp.map(function (i) { return 'x' + i; }).join(' - ') : '') + ' <= 0');
      });
      var vg = Math.max(0, vaga(k, u, d));
      lim.push('0 <= s' + s + ' <= ' + vg); partes.push('s' + s);
      if (!ehSede) obj.push('-' + P.passa + ' s' + s);
      cons.push('c' + (c++) + ': ' + soma + ' - ' + partes.join(' - ') + ' = 0');
      if (!ehSede) return;
      var teto = n.vg + n.ag + n.vc.length + n.ac.length + vg, e = esc[k] || { n: 0, grupos: {} };
      GRUPOS.forEach(function (g, gi) {
        var doGrupo = lista.filter(function (i) { return xs[i].m.grupo === g; });
        var kmax = Math.min(doGrupo.length, teto);
        if (!kmax) return;
        var base = ((e.grupos || {})[g] || 0) + (fixasGrupo[k + '|' + g] || 0), nomes = [];
        for (var j = 1; j <= kmax; j++) { var nome = 'w' + s + '_' + gi + '_' + j; nomes.push(nome); bins.push(nome); obj.push('-' + P.grupo * (base + j) + ' ' + nome); }
        cons.push('c' + (c++) + ': ' + doGrupo.map(function (i) { return 'x' + i; }).join(' + ') + ' - ' + nomes.join(' - ') + ' = 0');
      });
      var kt = Math.min(lista.length, teto);
      if (kt) {
        var baseT = (e.n || 0) + (fixas[k] || 0), nt = [];
        for (var j2 = 1; j2 <= kt; j2++) { var nm = 'z' + s + '_' + j2; nt.push(nm); bins.push(nm); obj.push('-' + P.gente * (baseT + j2) + ' ' + nm); }
        cons.push('c' + (c++) + ': ' + soma + ' - ' + nt.join(' - ') + ' = 0');
      }
    });
    /* cada militar: a cota que resta e uma extra por dia */
    var porMil = {}, porDia = {};
    xs.forEach(function (x, i) {
      (porMil[x.m.cpf] = porMil[x.m.cpf] || []).push(x.tam + ' x' + i);
      (porDia[x.m.cpf + '|' + x.d] = porDia[x.m.cpf + '|' + x.d] || []).push('x' + i);
    });
    D.mil.forEach(function (m) { if (porMil[m.cpf]) cons.push('c' + (c++) + ': ' + porMil[m.cpf].join(' + ') + ' <= ' + m.resta); });
    Object.keys(porDia).forEach(function (k) { if (porDia[k].length > 1) cons.push('c' + (c++) + ': ' + porDia[k].join(' + ') + ' <= 1'); });
    var lp = 'Maximize\n obj: ' + obj.join(' + ').replace(/\+ -/g, '- ') + '\nSubject To\n ' + cons.join('\n ') +
             '\nBounds\n ' + lim.join('\n ') + '\nBinary\n ' + bins.join(' ') + '\nEnd\n';
    return { lp: lp, xs: xs };
  }

  /* ---------- a conta: no trabalhador; sem ele, na tela ---------- */
  var biblioteca = null;
  function carregarBiblioteca() {
    if (!biblioteca) {
      biblioteca = new Promise(function (aceitar, rejeitar) {
        if (window.Module) { aceitar(); return; }
        var s = document.createElement('script');
        s.src = BIBLIOTECA;
        s.onload = function () { aceitar(); };
        s.onerror = function () { biblioteca = null; rejeitar(new Error('biblioteca')); };
        document.head.appendChild(s);
      }).then(function () { return window.Module({ locateFile: function (arquivo) { return 'bibliotecas/' + arquivo; } }); });
    }
    return biblioteca;
  }
  function resolverNaTela(lp) {
    return carregarBiblioteca().then(function (highs) {
      var r = highs.solve(lp, OPCOES);
      if (r.Status !== 'Optimal') throw { motivo: 'falha', detalhe: r.Status };
      return Object.keys(r.Columns).filter(function (nome) { return nome.charAt(0) === 'x' && r.Columns[nome].Primal > 0.5; });
    });
  }
  function resolver(lp) {
    return new Promise(function (aceitar, rejeitar) {
      var t;
      try { t = new Worker(TRABALHADOR); } catch (e) { resolverNaTela(lp).then(aceitar, rejeitar); return; }
      var timer = setTimeout(function () { encerrar(); rejeitar({ motivo: 'tempo' }); }, LIMITE_MS);
      function encerrar() { clearTimeout(timer); t.terminate(); atual = null; }
      atual = { cancelar: function () { encerrar(); rejeitar({ motivo: 'cancelado' }); } };
      t.onmessage = function (ev) {
        encerrar();
        var r = ev.data || {};
        if (r.ok && r.status === 'Optimal') aceitar(r.marcadas);
        else rejeitar({ motivo: 'falha', detalhe: r.erro || r.status });
      };
      /* o trabalhador não abriu (ex.: aberto do disco): a conta vai para a tela */
      t.onerror = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); encerrar(); resolverNaTela(lp).then(aceitar, rejeitar); };
      t.postMessage({ lp: lp, opcoes: OPCOES });
    });
  }

  /* as extras escolhidas pelo otimizador: [{ cpf, data, unidade, blocos }] */
  function calcular(competencia, fixas) {
    return RW.novaExtraUtil.chamar('nova_extra_sugerir', { p_competencia: competencia, p_atuais: fixas, p_so_dados: true }).then(function (D) {
      if (!D || !D.ok) throw { motivo: 'falha', detalhe: D && D.error };
      if (!D.mil.length) return [];
      var modelo = montarModelo(D);
      if (!modelo.xs.length) return [];
      return resolver(modelo.lp).then(function (marcadas) {
        return marcadas.map(function (nome) {
          var x = modelo.xs[+nome.slice(1)];
          return { cpf: x.m.cpf, data: x.d, unidade: x.u, blocos: blocos(x) };
        });
      });
    });
  }

  /* ---------- o Preencher pela sugestão: o véu, o otimizador, a conferência do banco e a reserva ---------- */
  function preencher(competencia, fixas, veu, aoTerminar) {
    var meu = ++pedido;
    var cancelar = veu.querySelector('#p3-calculo-cancelar');
    if (!cancelar.dataset.ligado) {
      cancelar.dataset.ligado = '1';
      cancelar.addEventListener('click', function () {
        pedido++;
        if (atual) atual.cancelar();
        fim(veu);
      });
    }
    calculando = true;
    veu.classList.remove('oculto');
    cancelar.focus();
    function banco(escolhidas) {
      var corpo = { p_competencia: competencia, p_atuais: fixas };
      if (escolhidas) corpo.p_escolhidas = escolhidas;
      return RW.novaExtraUtil.chamar('nova_extra_sugerir', corpo);
    }
    /* um instante para o véu aparecer antes da conta (que pode rodar na tela) */
    new Promise(function (aceitar) { setTimeout(aceitar, 50); })
      .then(function () { return calcular(competencia, fixas); })
      .then(function (escolhidas) {
        return banco(escolhidas).then(function (r) {
          if (r && r.ok && r.recusadas && r.recusadas.length) throw { motivo: 'recusada' };
          return { r: r, reserva: false };
        });
      })
      .catch(function (e) {
        if (meu !== pedido || (e && e.motivo === 'cancelado')) return null;
        return banco(null).then(function (r) { return { r: r, reserva: true }; });
      })
      .then(function (res) {
        if (meu !== pedido) return;
        fim(veu);
        if (!res) return;
        if (!res.r || !res.r.ok) { RW.avisar({ tipo: 'erro', mensagem: (res.r && res.r.error) || RW.mensagens.novaExtra.org.falhaSugestao }); return; }
        aoTerminar(res.r, res.reserva);
      }, function () {
        if (meu !== pedido) return;
        fim(veu);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }
  function fim(veu) {
    calculando = false;
    veu.classList.add('oculto');
  }

  RW.novaExtraOtimizador = {
    preencher: preencher,
    calcular: calcular,
    /* para o guarda de saída: o navegador avisa ao fechar no meio da conta */
    calculando: function () { return calculando; },
    montarModelo: montarModelo
  };
})();
