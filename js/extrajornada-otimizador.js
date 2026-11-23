/* ============================================================
   EXTRAJORNADA — o otimizador do "Preencher pela sugestão"
   Pede ao banco os dados (extrajornada_sugerir com p_so_dados, com as
   regras da companhia dos Ajustes › Extrajornada), monta as extras
   possíveis e as regras fixas como um problema de programação inteira
   e o placar em níveis de verdade: a falta vermelha (na ordem dos
   pelotões), onde falta mais primeiro (no mesmo pelotão, o horário que
   falta 2 antes do que falta 1), a amarela, colocar as cotas, a extra
   inteira fora da cidade da companhia (quem é de outro pelotão só
   quebra sem outro jeito), cada um no próprio pelotão,
   quem vai para outro pelotão (o mais moderno ou em rodízio), o que
   passa do necessário, quem fica com o lugar (a fila das Cotas ou a
   antiguidade) e a balança (Pouco, Normal ou Muito). Nunca a mais: a
   extra só entra nos horários com falta, e a cota que não fecha falta
   fica para o administrador. Fora da cidade da companhia, só até o
   mínimo (o amarelo de lá só junto com o vermelho, na mesma extra);
   enquanto sobrar vermelho no mês, o mesmo em todos os pelotões (uma
   conta só do vermelho decide antes). Cada nível é uma conta do HiGHS,
   com os de cima fixados no melhor deles
   (extrajornada-otimizador-niveis.js), num trabalhador em segundo plano
   (extrajornada-otimizador-trabalho.js; sem ele, ou aberto do disco,
   na própria tela, com o .wasm de bibliotecas/highs-wasm.js). Se a
   biblioteca cair, tenta de novo com outra semente. As escolhas voltam
   ao banco, que confere as regras e devolve o porquê (p_escolhidas); a
   recusada fica de fora e a tela diz quantas. Regra fixa do
   administrativo, igual à do banco: as cotas que faltam no menor número
   de dias, cada extra deixando o resto caber nos dias que sobram (o que
   não couber fica para o administrador). A extra nunca vai para o pelotão
   e o dia em que a regra do militar não deixa nenhuma cadeira para ele
   nem para a bombeira onde ela não tira extra (D.regra; o
   administrador põe mesmo assim). Enquanto calcula, a janela das
   etapas (uma por nível) fica na tela escurecida, com o Cancelar, e o
   Voltar pergunta antes. Não cria HTML nem escreve estilo.
   RosterWork.extrajornadaOtimizador.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TRABALHADOR = 'js/extrajornada-otimizador-trabalho.js';
  var BIBLIOTECA = 'bibliotecas/highs.js';
  var WASM_NO_DISCO = 'bibliotecas/highs-wasm.js';   /* o .wasm em texto, só para a página aberta do disco */
  var DEMORA_MS = 180000;  /* passando disso, a frase de demora no cartão */
  var TENTATIVAS = 3;      /* a biblioteca que cai tenta de novo, cada vez com outra semente */
  /* presolve desligado e a folga mínima (cada conta tem o seu tempo e, passando dele, fica com a melhor achada) */
  var OPCOES = { presolve: 'off', time_limit: 60, mip_rel_gap: 0.000001 };
  var JANELAS = [{ ini: 1, tam: 4 }, { ini: 1, tam: 3 }, { ini: 2, tam: 3 }, { ini: 1, tam: 2 }, { ini: 2, tam: 2 }, { ini: 3, tam: 2 }];
  var ADMINISTRATIVO = 'Administrativo';   // o Setor da ficha
  /* os níveis, do que vale mais ao que vale menos (a ordem fixa dos Ajustes), e a etapa da janela de cada um */
  var NIVEIS = ['verm', 'fundo', 'amar', 'cotas', 'inteira', 'fora', 'quem', 'passa', 'prio', 'balanca'];
  var ETAPA = { verm: 1, fundo: 2, amar: 3, cotas: 4, inteira: 5, fora: 6, quem: 7, passa: 8, prio: 9, balanca: 10 };
  var CONFERINDO = 11;
  /* a balança (Normal = os pesos de antes do placar novo): três dias seguidos, cada extra (menos extras = blocos maiores),
     colado ao serviço, o administrativo que sai à meia-noite (vai com o colado) e o dia que ele quer (por horário); Pouco
     é a metade e Muito, o dobro */
  var BALANCA = { seguidos: 200, bloco: 150, colado: 80, cedo: 300, quer: 15 };
  var DA_RESPOSTA = { seguidos: 'seguidos', bloco: 'bloco', colado: 'colado', cedo: 'colado', quer: 'quer' };
  var MULT = { pouco: 0.5, normal: 1, muito: 2 };

  var atual = null;        // o cálculo no ar: { cancelar }
  var pedido = 0;          // latest-wins: só vale o resultado do último Preencher
  var calculando = false;

  function chave(u, d, b) { return u + '|' + d + '|' + b; }
  function blocos(x) { var l = []; for (var b = x.ini; b < x.ini + x.tam; b++) l.push(b); return l; }
  /* os dias do mês com n dias antes e n depois (AAAA-MM-DD) */
  function diasEmVolta(datas, n) {
    if (!datas.length) return [];
    var a = datas[0].split('-'), z = datas[datas.length - 1].split('-'), lista = [];
    var d = new Date(Date.UTC(+a[0], +a[1] - 1, +a[2] - n)), fim = new Date(Date.UTC(+z[0], +z[1] - 1, +z[2] + n));
    for (; d <= fim; d.setUTCDate(d.getUTCDate() + 1)) lista.push(d.toISOString().slice(0, 10));
    return lista;
  }
  /* administrativo: a extra que começa no primeiro horário livre depois do expediente do dia (como o colado ao serviço) */
  function depoisDoExpediente(x, w) {
    if (!x.livres || !x.livres.length || x.livres.length >= 4) return false;
    var expediente = [1, 2, 3, 4].filter(function (b) { return x.livres.indexOf(b) < 0; });
    return w.ini === Math.max.apply(null, expediente) + 1;
  }
  /* o horário de 6 h, contado das 08h (0 a 23), de uma hora 'HH:MM' */
  function horaDe(t) { return (+t.slice(0, 2) + 16) % 24; }

  /* ---------- o modelo: as extras possíveis, as regras fixas e os níveis do placar ---------- */
  /* soVermelho: sobra vermelho no mês, e o amarelo só entra junto com o vermelho em todos os pelotões */
  function montarModelo(D, soVermelho) {
    var R = D.regras || { ordem: D.pelotoes, primeiro: 'fila', sai: {}, balanca: {} };
    function peso(k) { return BALANCA[k] * (MULT[(R.balanca || {})[DA_RESPOSTA[k]]] || 1); }
    var sede = D.sede || [], N = D.mil.length || 1;
    var dia = {}, fixaNoDia = {}, fixas = {}, cap = {}, esc = {}, nec = {}, regra = {};
    D.dia.forEach(function (x) { dia[x.cpf + '|' + x.data] = x; });
    (D.regra || []).forEach(function (r) { regra[r.cpf + '|' + r.uid + '|' + r.data] = true; });
    (D.fixas || []).forEach(function (f) {
      fixaNoDia[f.cpf + '|' + f.data] = true;
      (f.blocos || []).forEach(function (b) { var k = chave(f.uid, f.data, b); fixas[k] = (fixas[k] || 0) + 1; });
      /* a que começa no fim do expediente ocupa também o horário de antes, pela metade */
      if (f.inicio && f.blocos && f.blocos.length) { var k0 = chave(f.uid, f.data, f.blocos[0] - 1); fixas[k0] = (fixas[k0] || 0) + 1; }
    });
    (D.cap || []).forEach(function (c) { cap[c.uid + '|' + c.data] = c.n; });
    (D.escala || []).forEach(function (e) { esc[chave(e.uid, e.data, e.b)] = e; });
    function necDe(k) { return nec[k] || (nec[k] = { vg: 0, ag: 0, vc: [], ac: [] }); }
    D.falta.forEach(function (f) { var x = necDe(chave(f.uid, f.data, f.b)); if (f.nivel === 1) x.vg += f.n; else x.ag += f.n; });
    (D.condutor || []).forEach(function (c) { var x = necDe(chave(c.uid, c.data, c.b)); (c.nivel === 1 ? x.vc : x.ac).push(c.cnh); });
    /* fora da cidade da companhia, só até o mínimo: o amarelo de lá não conta sozinho; fica só o do chefe que dirige, no
       horário com vermelho, para quem completa o mínimo e conduz a viatura. Sobrando vermelho no mês, o mesmo em todos */
    Object.keys(nec).forEach(function (k) {
      if (!soVermelho && sede.indexOf(+k.split('|')[0]) >= 0) return;
      nec[k].ag = 0;
      if (!nec[k].vg && !nec[k].vc.length) nec[k].ac = [];
    });
    function vaga(k, u, d) { return (cap[u + '|' + d] || 0) - ((esc[k] || {}).mx || 0) - (fixas[k] || 0); }
    function conduz(m, lista) { return lista.length > 0 && (m.conduz || []).indexOf(lista[0]) >= 0; }
    var datas = Object.keys(D.dia.reduce(function (o, x) { o[x.data] = 1; return o; }, {})).sort();
    /* a antiguidade (1 = o mais antigo) */
    var NA = Math.max.apply(null, D.mil.map(function (m) { return m.antig || 1; }));
    /* quem vem primeiro quando dois querem o mesmo lugar: a fila das Cotas ou a antiguidade (o primeiro vale N) */
    var prio = {};
    D.mil.slice().sort(function (a, b) {
      return R.primeiro === 'antiguidade' ? (a.antig || NA) - (b.antig || NA) : (a.ordem || N) - (b.ordem || N);
    }).forEach(function (m, i) { prio[m.cpf] = N - i; });
    /* quanto custa mandar cada um para outro pelotão: o mais antigo custa mais (sai o mais moderno); em rodízio, antes
       conta quantas vezes ele já foi nos últimos 12 meses */
    function custoSair(m) {
      var antigo = NA - (m.antig || NA) + 1;
      return (R.sai || {})[String(m.uid)] === 'rodizio' ? (m.fora12 || 0) * (NA + 1) + antigo : antigo;
    }
    var rank = {};
    (R.ordem || D.pelotoes).forEach(function (u, i) { rank[u] = i + 1; });

    /* as extras possíveis: dia livre e sem extra fixa, a janela que cabe na cota (só 24 h: inteira) e no expediente, e
       falta em cada horário que ele cobre (nunca a mais). O administrativo, no dia em que o expediente termina antes da
       primeira bolinha livre (x.desde, a quarta), tem também as janelas que começam no fim do expediente: elas só fecham a
       falta dos horários de 6 h que cobrem inteiros e ocupam vaga nos dois que tocam pela metade */
    var xs = [], cobre = {}, meio = {};
    D.mil.forEach(function (m) {
      datas.forEach(function (d) {
        var x = dia[m.cpf + '|' + d];
        if (!x || !x.livre || fixaNoDia[m.cpf + '|' + d]) return;
        var primeira = x.livres && x.livres.length ? Math.min.apply(null, x.livres) : 1;
        D.pelotoes.forEach(function (u) {
          if (regra[m.cpf + '|' + u + '|' + d]) return;   /* a regra não deixa cadeira para ele neste pelotão no dia */
          var ehSede = sede.indexOf(u) >= 0;
          function tentar(w, cedo) {
            if (m.so24 ? w.tam !== 4 : w.tam > m.resta) return;
            var bs = blocos(w);
            if (x.livres && bs.some(function (b) { return x.livres.indexOf(b) < 0; })) return;
            var cheios = cedo ? bs.slice(0, -1) : bs, metades = cedo ? [w.ini - 1, w.ini + w.tam - 1] : [];
            for (var i = 0; i < cheios.length; i++) {
              var n = nec[chave(u, d, cheios[i])];
              if (!n || !(n.vg + n.ag > 0 || conduz(m, n.vc) || conduz(m, n.ac))) return;
            }
            for (var h = 0; h < metades.length; h++) if (vaga(chave(u, d, metades[h]), u, d) <= 0) return;
            var j = xs.length;
            /* colado ao expediente: na quarta, com 2 cotas a que sai à meia-noite e com 3 a das 14h (emenda no
               expediente do dia seguinte); nos outros dias, a que começa no primeiro horário livre depois dele */
            xs.push({ m: m, u: u, d: d, ini: w.ini, tam: w.tam, quer: !!x.quer, inicio: cedo ? x.desde : null, sede: ehSede,
                      emenda: (x.ant && w.ini === 1) || (x.prox && w.ini + w.tam - 1 === 4) || (cedo ? w.tam === 2 : depoisDoExpediente(x, w)) });
            cheios.forEach(function (b) { var k = chave(u, d, b); (cobre[k] = cobre[k] || []).push(j); });
            metades.forEach(function (b) { var k = chave(u, d, b); (meio[k] = meio[k] || []).push(j); });
          }
          JANELAS.forEach(function (w) {
            tentar(w, false);
            if (x.desde && horaDe(x.desde) < (primeira - 1) * 6 && w.ini === primeira && w.tam <= 3) tentar(w, true);
          });
        });
      });
    });

    /* os níveis: cada termo é [coeficiente, variável, teto da variável] (maior vale mais) */
    var L = { verm: [], fundo: [], amar: [], cotas: [], inteira: [], fora: [], quem: [], passa: [], prio: [], balanca: [] };
    var cons = [], lim = [], bins = [], c = 0, vermPel = {}, amarPel = {};
    xs.forEach(function (x, i) {
      var v = 'x' + i;
      bins.push(v);
      L.cotas.push([x.tam, v, 1]);
      if (x.u !== x.m.uid) {
        L.fora.push([-x.tam, v, 1]);
        L.quem.push([-x.tam * custoSair(x.m), v, 1]);
        /* fora da cidade da companhia, quem é de outro pelotão vai com a extra inteira (24 h): a quebrada só sem outro jeito */
        if (!x.sede && x.tam < 4) L.inteira.push([-1, v, 1]);
      }
      /* a que começa no fim do expediente: fora da cidade da companhia, as duas metades passam do necessário */
      if (x.inicio && !x.sede) L.passa.push([-2, v, 1]);
      L.prio.push([x.tam * prio[x.m.cpf], v, 1]);
      /* na balança, o dia que ele quer vale um pouco mais para quem vem primeiro */
      var b = -peso('bloco') + (x.emenda ? peso('colado') : 0) + (x.inicio && x.tam === 2 ? peso('cedo') : 0) +
              (x.quer ? x.tam * peso('quer') * (1 + 0.5 * prio[x.m.cpf] / N) : 0);
      if (b) L.balanca.push([b, v, 1]);
    });
    /* cada horário de cada pelotão: o que as extras cobrem (condutor e gente, vermelho e amarelo), nunca mais que a falta */
    Object.keys(cobre).forEach(function (k, s) {
      var p = k.split('|'), u = +p[0], d = p[1], ehSede = sede.indexOf(u) >= 0, n = nec[k] || { vg: 0, ag: 0, vc: [], ac: [] };
      var lista = cobre[k], soma = lista.map(function (i) { return 'x' + i; }).join(' + ');
      var partes = [];
      [['cv', n.vc.length, vermPel], ['gv', n.vg, vermPel], ['ca', n.ac.length, amarPel], ['ga', n.ag, amarPel]].forEach(function (t) {
        if (t[1] <= 0) return;
        var nome = t[0] + s;
        /* fora da cidade da companhia (ou sobrando vermelho no mês), o chefe que sai da direção junto com o vermelho
           vale no nível do passar do necessário, abaixo do pelotão dele */
        if (t[0] === 'ca' && (!ehSede || soVermelho)) L.passa.push([1, nome, t[1]]);
        else (t[2][u] = t[2][u] || []).push([1, nome, t[1]]);
        lim.push('0 <= ' + nome + ' <= ' + t[1]);
        /* o chefe que dirige sai da direção com quem conduz a viatura, que ainda conta como uma das pessoas (sem falta
           de gente no horário, quem conduz é a pessoa) */
        if (t[0] !== 'ca' || n.vg + n.ag === 0) partes.push(nome);
      });
      /* no vermelho, onde falta mais vem primeiro: cada pessoa que falta é um pedaço, e o que leva a falta de n para n - 1
         vale 2n - 1 (o resto ao quadrado). No mesmo pelotão, cobrir o horário que falta 2 vale mais que o que falta 1 */
      var nv = n.vc.length + n.vg;
      if (nv > 0) {
        var pedacos = [];
        for (var j = 0; j < nv; j++) {
          pedacos.push('fd' + s + '_' + j);
          lim.push('0 <= fd' + s + '_' + j + ' <= 1');
          L.fundo.push([2 * (nv - j) - 1, 'fd' + s + '_' + j, 1]);
        }
        var cobertos = (n.vc.length ? ['cv' + s] : []).concat(n.vg ? ['gv' + s] : []);
        cons.push('c' + (c++) + ': ' + pedacos.join(' + ') + ' - ' + cobertos.join(' - ') + ' = 0');
      }
      /* quem conduz a viatura sem condutor não tira, ao mesmo tempo, o chefe da direção de outra */
      if (n.vc.length && n.ac.length) {
        var algum = lista.filter(function (i) { return conduz(xs[i].m, n.vc) || conduz(xs[i].m, n.ac); });
        cons.push('c' + (c++) + ': cv' + s + ' + ca' + s + (algum.length ? ' - ' + algum.map(function (i) { return 'x' + i; }).join(' - ') : '') + ' <= 0');
      }
      /* o condutor só com a CNH da viatura */
      [['cv', n.vc], ['ca', n.ac]].forEach(function (t) {
        if (!t[1].length) return;
        var comp = lista.filter(function (i) { return conduz(xs[i].m, t[1]); });
        cons.push('c' + (c++) + ': ' + t[0] + s + (comp.length ? ' - ' + comp.map(function (i) { return 'x' + i; }).join(' - ') : '') + ' <= 0');
      });
      /* nunca a mais: as extras do horário são exatamente o que elas cobrem da falta */
      cons.push('c' + (c++) + ': ' + soma + (partes.length ? ' - ' + partes.join(' - ') + ' = 0' : ' <= 0'));
    });
    /* a que começa no fim do expediente ocupa vaga nos dois horários que toca pela metade (sem fechar a falta deles),
       junto com as extras que cobrem o horário inteiro */
    Object.keys(meio).forEach(function (k) {
      var p = k.split('|'), soma = meio[k].concat(cobre[k] || []).map(function (i) { return 'x' + i; }).join(' + ');
      cons.push('c' + (c++) + ': ' + soma + ' <= ' + Math.max(0, vaga(k, +p[0], p[1])));
    });
    /* cada militar: a cota que resta e uma extra por dia */
    var porMil = {}, porDia = {}, folgaMil = {};
    xs.forEach(function (x, i) {
      (porMil[x.m.cpf] = porMil[x.m.cpf] || []).push(x.tam + ' x' + i);
      (porDia[x.m.cpf + '|' + x.d] = porDia[x.m.cpf + '|' + x.d] || []).push('x' + i);
      if (x.tam < 4) (folgaMil[x.m.cpf] = folgaMil[x.m.cpf] || []).push((4 - x.tam) + ' x' + i);
    });
    D.mil.forEach(function (m) { if (porMil[m.cpf]) cons.push('c' + (c++) + ': ' + porMil[m.cpf].join(' + ') + ' <= ' + m.resta); });
    /* o administrativo tira as cotas que faltam no menor número de dias (cotas ÷ 4, arredondado para cima), como o banco
       confere: cada extra deixa o resto caber nos dias que sobram, ou seja, os horários vazios dos dias usados não passam
       de 4 × dias − cotas (8 cotas = 24 h + 24 h; 6 = 24 h + 12 h, 18 h + 18 h ou só uma delas) */
    D.mil.forEach(function (m) {
      if (m.setor !== ADMINISTRATIVO || !porMil[m.cpf] || !folgaMil[m.cpf]) return;
      cons.push('c' + (c++) + ': ' + folgaMil[m.cpf].join(' + ') + ' <= ' + (4 * Math.ceil(m.resta / 4) - m.resta));
    });
    Object.keys(porDia).forEach(function (k) { if (porDia[k].length > 1) cons.push('c' + (c++) + ': ' + porDia[k].join(' + ') + ' <= 1'); });
    /* os dias seguidos no quartel (serviço e troca assumida, de 3 dias antes a 3 depois do mês, a extra fixa e a nova):
       em 4 dias seguidos, no máximo 3 (nunca 4); em 3, no máximo 2, ou paga na balança */
    var quartel = {}, dias = diasEmVolta(datas, 3), tres = 0;
    (D.quartel || []).forEach(function (q) { quartel[q.cpf + '|' + q.data] = true; });
    Object.keys(fixaNoDia).forEach(function (k) { quartel[k] = true; });
    D.mil.forEach(function (m) {
      [[4, 3], [3, 2]].forEach(function (janela) {
        for (var i = 0; i + janela[0] <= dias.length; i++) {
          var fixos = 0, comExtra = 0, vars = [];
          for (var j = i; j < i + janela[0]; j++) {
            var k = m.cpf + '|' + dias[j];
            if (quartel[k]) fixos++;
            else if (porDia[k]) { comExtra++; vars = vars.concat(porDia[k]); }
          }
          if (!comExtra || fixos + comExtra <= janela[1]) continue;
          var teto = Math.max(0, janela[1] - fixos);
          if (janela[0] === 4) { cons.push('c' + (c++) + ': ' + vars.join(' + ') + ' <= ' + teto); continue; }
          var nome = 'tr' + (tres++);
          bins.push(nome); L.balanca.push([-peso('seguidos'), nome, 1]);
          cons.push('c' + (c++) + ': ' + vars.join(' + ') + ' - ' + nome + ' <= ' + teto);
        }
      });
    });

    /* a falta pela ordem dos pelotões, dentro de cada cor: o pelotão de cima vale mais que todos os de baixo juntos */
    function pelaOrdem(porPel) {
      var us = Object.keys(porPel).map(Number).sort(function (a, b) { return (rank[a] || 99) - (rank[b] || 99); });
      var termos = [], partes = [], w = 1;
      for (var i = us.length - 1; i >= 0; i--) {
        var t = porPel[us[i]], teto = t.reduce(function (s, x) { return s + x[2]; }, 0);
        t.forEach(function (x) { termos.push([w, x[1], x[2]]); });
        partes.unshift(t);
        w = w * (teto + 1);
      }
      return { termos: termos, partes: partes };
    }
    var pv = pelaOrdem(vermPel), pa = pelaOrdem(amarPel);
    L.verm = pv.termos;
    L.amar = pa.termos;
    var partesDe = { verm: pv.partes, amar: pa.partes };
    /* o melhor que cada nível pode chegar: nenhuma quebrada, ninguém fora, nada passando, todas as cotas; com todas colocadas, a soma da
       fila não muda (os outros, a soma dos positivos; no passar do necessário, com o chefe liberado) */
    var total = D.mil.reduce(function (t, m) { return t + m.resta; }, 0);
    var melhor = { inteira: 0, fora: 0, quem: 0, cotas: total, prio: D.mil.reduce(function (t, m) { return t + m.resta * prio[m.cpf]; }, 0) };
    if (!L.passa.some(function (t) { return t[0] > 0; })) melhor.passa = 0;
    var niveis = NIVEIS.map(function (nome) { return { nome: nome, termos: L[nome], partes: partesDe[nome], teto: melhor[nome] }; })
                       .filter(function (n) { return n.termos.length; });
    /* o vermelho todo coberto (o valor do nível do vermelho com cada falta no teto) */
    var vermTodo = pv.termos.reduce(function (t, x) { return t + x[0] * x[2]; }, 0);
    return { niveis: niveis, base: { cons: cons, lim: lim, bins: bins }, xs: xs, vermTodo: vermTodo };
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
      });
    }
    return biblioteca;
  }
  /* a página aberta do disco: o navegador não deixa ler o .wasm, que vem em texto num script (base64), compilado uma vez e
     entregue a cada conta pelo instantiateWasm da biblioteca */
  var noDisco = window.location.protocol === 'file:';
  var wasm = null;
  function carregarWasm() {
    if (!wasm) {
      wasm = new Promise(function (aceitar, rejeitar) {
        var s = document.createElement('script');
        s.src = WASM_NO_DISCO;
        s.onload = function () {
          var texto = atob(RW.highsWasm || ''), bytes = new Uint8Array(texto.length);
          for (var i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
          RW.highsWasm = null;
          WebAssembly.compile(bytes).then(aceitar, rejeitar);
        };
        s.onerror = function () { rejeitar(new Error('wasm')); };
        document.head.appendChild(s);
      }).catch(function (e) { wasm = null; throw e; });
    }
    return wasm;
  }
  function resolverNaTela(modelo, aoEtapa, opcoes) {
    return carregarBiblioteca().then(function () { return noDisco ? carregarWasm() : null; }).then(function (compilado) {
      return RW.extrajornadaNiveis.resolver(function () {
        return window.Module(compilado ? {
          instantiateWasm: function (importacoes, receber) {
            WebAssembly.instantiate(compilado, importacoes).then(function (instancia) { receber(instancia); });
            return {};
          }
        } : { locateFile: function (arquivo) { return 'bibliotecas/' + arquivo; } });
      }, modelo, opcoes, aoEtapa);
    }).catch(function (e) { throw e && e.motivo ? e : { motivo: 'falha', detalhe: String((e && e.message) || e) }; });
  }
  /* uma rodada da conta: { marcadas, valores } */
  function resolverUmaVez(modelo, aoEtapa, opcoes) {
    if (noDisco) return resolverNaTela(modelo, aoEtapa, opcoes);
    return new Promise(function (aceitar, rejeitar) {
      var t;
      try { t = new Worker(TRABALHADOR); } catch (e) { resolverNaTela(modelo, aoEtapa, opcoes).then(aceitar, rejeitar); return; }
      function encerrar() { t.terminate(); atual = null; }
      atual = { cancelar: function () { encerrar(); rejeitar({ motivo: 'cancelado' }); } };
      t.onmessage = function (ev) {
        var r = ev.data || {};
        if (r.tipo === 'etapa') { if (aoEtapa) aoEtapa(r.nomes); return; }
        encerrar();
        if (r.ok) aceitar({ marcadas: r.marcadas, valores: r.valores || [] });
        else rejeitar({ motivo: 'falha', detalhe: r.erro });
      };
      /* o trabalhador não abriu: a conta vai para a tela */
      t.onerror = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); encerrar(); resolverNaTela(modelo, aoEtapa, opcoes).then(aceitar, rejeitar); };
      t.postMessage({ modelo: { niveis: modelo.niveis, base: modelo.base }, opcoes: opcoes });
    });
  }
  /* a biblioteca que cai tenta de novo, até TENTATIVAS vezes, cada vez com outra semente (o Cancelar para na hora) */
  function resolver(modelo, aoEtapa) {
    var vez = 0;
    function tentar() {
      var opcoes = {};
      Object.keys(OPCOES).forEach(function (k) { opcoes[k] = OPCOES[k]; });
      if (vez) opcoes.random_seed = vez * 7;
      return resolverUmaVez(modelo, aoEtapa, opcoes).catch(function (e) {
        if (!e || e.motivo !== 'falha' || ++vez >= TENTATIVAS) throw e;
        console.warn('[Extrajornada] a conta caiu, tentando de novo (' + (vez + 1) + ' de ' + TENTATIVAS + '): ' + e.detalhe);
        return tentar();
      });
    }
    return tentar();
  }

  /* as extras escolhidas pelo otimizador: [{ cpf, data, unidade, blocos }]; aoLer: os dados chegaram; aoEtapa(nomes): o
     nível que começa; vivo(): o pedido ainda vale (cancelado entre as duas contas, a segunda nem começa). Primeiro, só o
     nível do vermelho: fechando todo o vermelho do mês, entra o amarelo; senão, a conta só do vermelho (soVermelho), sem
     extra de amarelo sozinho */
  function calcular(competencia, fixas, aoLer, aoEtapa, vivo) {
    return RW.extrajornadaUtil.chamar('extrajornada_sugerir', { p_competencia: competencia, p_atuais: fixas, p_so_dados: true }).then(function (D) {
      if (!D) throw { motivo: 'falha', detalhe: 'dados' };
      if (!D.ok) throw { motivo: 'recusado', detalhe: D.error };
      if (aoLer) aoLer();
      if (!D.mil.length) return [];
      var completo = montarModelo(D, false);
      if (!completo.xs.length) return [];
      var vermelho = completo.niveis[0] && completo.niveis[0].nome === 'verm' ? completo.niveis[0] : null;
      var teste = vermelho ? resolver({ niveis: [vermelho], base: completo.base }, aoEtapa) : Promise.resolve(null);
      return teste.then(function (t) {
        if (vivo && !vivo()) throw { motivo: 'cancelado' };
        var todo = !t || ((t.valores[0] || {}).valor || 0) >= completo.vermTodo - 0.5;
        var modelo = todo ? completo : montarModelo(D, true);
        if (!modelo.xs.length) return [];
        return resolver(modelo, aoEtapa).then(function (r) {
          return r.marcadas.map(function (nome) {
            var x = modelo.xs[+nome.slice(1)];
            return { cpf: x.m.cpf, data: x.d, unidade: x.u, blocos: blocos(x), inicio: x.inicio };
          });
        });
      });
    });
  }

  /* ---------- o Preencher pela sugestão: a janela das etapas (lendo 0, um nível por etapa, o banco conferindo no fim),
     o otimizador e a conferência do banco; o Cancelar e o "Sair e cancelar" do Voltar param na hora. A conta que não sai
     pergunta se tenta de novo; a extra que o banco recusa fica de fora (aoTerminar recebe quantas) ---------- */
  function preencher(competencia, fixas, aoTerminar) {
    var meu = ++pedido;
    var M = RW.mensagens;
    var cartao = null;
    function fim(naHora) {
      calculando = false;
      if (RW.voltar) RW.voltar.soltar();
      if (cartao) cartao.parar(naHora);
    }
    function cancelar() {
      pedido++;
      if (atual) atual.cancelar();
      fim(true);
    }
    function passo(n) { if (meu === pedido) cartao.ir(n); }
    calculando = true;
    cartao = RW.etapas.janela('sugestao', null, { doServidor: 1, demoraMs: DEMORA_MS, aoCancelar: cancelar });
    if (RW.voltar) RW.voltar.segurar({ mensagem: M.extrajornada.org.sairDoCalculo, textoSair: M.botoes.sairECancelar,
      textoFicar: M.botoes.continuarOCalculo, aoSair: cancelar });
    /* a conta ou a leitura que não saiu: pergunta se tenta de novo (a recusa do banco, com o motivo dele, só avisa) */
    function falhou(e) {
      if (e && e.motivo === 'recusado' && e.detalhe) { RW.avisar({ tipo: 'erro', mensagem: e.detalhe }); return; }
      if (e && e.detalhe) console.error('[Extrajornada] a sugestão não saiu: ' + e.detalhe);
      RW.confirmar({ tipo: 'erro', mensagem: RW.falha.frase(M.extrajornada.org.falhaSugestao), textoConfirmar: M.botoes.tentarDeNovo,
        textoCancelar: M.botoes.fechar, aoConfirmar: function () { preencher(competencia, fixas, aoTerminar); } });
    }
    /* um instante para o cartão aparecer antes da conta (que pode rodar na tela) */
    new Promise(function (aceitar) { setTimeout(aceitar, 50); })
      .then(function () {
        return calcular(competencia, fixas, null, function (nomes) { passo(ETAPA[nomes[0]] || 1); }, function () { return meu === pedido; });
      })
      .then(function (escolhidas) {
        passo(CONFERINDO);
        return RW.extrajornadaUtil.chamar('extrajornada_sugerir', { p_competencia: competencia, p_atuais: fixas, p_escolhidas: escolhidas });
      })
      .then(function (r) {
        if (meu !== pedido) return;
        fim();
        if (!r) { falhou({ motivo: 'falha', detalhe: 'conferência' }); return; }
        if (!r.ok) { falhou({ motivo: 'recusado', detalhe: r.error }); return; }
        aoTerminar(r, (r.recusadas || []).length);
      }, function (e) {
        if (meu !== pedido || (e && e.motivo === 'cancelado')) return;
        fim();
        falhou(e);
      });
  }

  RW.extrajornadaOtimizador = {
    preencher: preencher,
    calcular: calcular,
    /* para o guarda de saída: o navegador avisa ao fechar no meio da conta */
    calculando: function () { return calculando; },
    montarModelo: montarModelo
  };
})();
