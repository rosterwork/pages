/* ============================================================
   HORÁRIO EM CAMPOS e RÉGUA DO DIA — componente compartilhado
   (painel do dia da Escala e formulários da Folgas e das Trocas).
   O dia de serviço vai das 08h às 08h: as contas usam minutos
   desde as 08h (0 a 1440). linha() monta início → fim em campos
   (geral-dropdown-numeros) com o ✕ e o Adicionar horário;
   criarRegua() e regua() desenham a régua do dia com os pedaços;
   periodoServico() junta tudo no "Serviço inteiro / Parte do
   serviço" (Folgas e Trocas); leitura() é o "08h → 08h" só para
   ler (painel de decisão). Clona os moldes do index.html
   (#tpl-horario, -fixo, -leitura, #tpl-regua, -pedaco, #tpl-periodo-servico).
   RosterWork.horario.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* ---------- horas no dia de serviço (minutos desde as 08h) ---------- */

  function emMin(t) {
    var p = String(t || '08:00').split(':');
    return ((parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10)) - 480 + 1440) % 1440;
  }
  /* período {hi, hf} -> [início, fim]; o fim às 08h (ou antes do início) passa para o dia seguinte */
  function faixa(per) { var s = emMin(per.hi), e = emMin(per.hf); if (e <= s) e += 1440; return [s, e]; }
  /* minutos desde as 08h -> "HH:MM" */
  function hhmm(min) {
    var t = (min + 480) % 1440;
    return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + (t % 60)).slice(-2);
  }
  function periodo(f) { return { hi: hhmm(f[0]), hf: hhmm(f[1]) }; }
  /* "08:00" -> "08h"; "08:30" -> "08h30" */
  function curta(t) {
    var s = String(t || '08:00'), m = s.slice(3, 5);
    return s.slice(0, 2) + 'h' + (m && m !== '00' ? m : '');
  }
  function cruza(a, b) { var s = Math.max(a[0], b[0]), e = Math.min(a[1], b[1]); return s < e ? [s, e] : null; }
  /* as faixas de a que sobram depois de tirar as de b */
  function menos(a, b) {
    var res = a.slice();
    b.forEach(function (y) {
      var prox = [];
      res.forEach(function (x) {
        if (!cruza(x, y)) { prox.push(x); return; }
        if (x[0] < y[0]) prox.push([x[0], y[0]]);
        if (y[1] < x[1]) prox.push([y[1], x[1]]);
      });
      res = prox;
    });
    return res;
  }
  /* junta as faixas que se tocam ou se cruzam: [[0,360],[360,720]] -> [[0,720]] */
  function uniao(fs) {
    var res = [];
    fs.slice().sort(function (a, b) { return a[0] - b[0]; }).forEach(function (f) {
      var ult = res[res.length - 1];
      if (ult && f[0] <= ult[1]) ult[1] = Math.max(ult[1], f[1]);
      else res.push([f[0], f[1]]);
    });
    return res;
  }

  /* horas cheias dos campos ("08".."07"): as das janelas dadas (início nunca na última hora,
     fim nunca na primeira); sem janelas, as 24 horas do dia */
  function opcoesHoras(janelas) {
    var lista = (janelas && janelas.length) ? janelas : [{ hi: '08:00', hf: '08:00' }];
    var inis = {}, fins = {};
    lista.forEach(function (j) {
      var f = faixa(j);
      for (var m = Math.ceil(f[0] / 60) * 60; m <= f[1]; m += 60) {
        var h = hhmm(m).slice(0, 2);
        if (m < f[1]) inis[h] = true;
        if (m > f[0]) fins[h] = true;
      }
    });
    function ordem(h, fim) { var m = emMin(h + ':00'); return (fim && m === 0) ? 1440 : m; }
    return {
      inicios: Object.keys(inis).sort(function (a, b) { return ordem(a) - ordem(b); }),
      fins: Object.keys(fins).sort(function (a, b) { return ordem(a, true) - ordem(b, true); })
    };
  }

  /* ---------- horário só para ler ---------- */

  /* "08h → 08h" (molde #tpl-horario-leitura), sem campos */
  function leitura(hi, hf) {
    var el = RosterWork.tpl('tpl-horario-leitura');
    if (!el) return null;
    el.querySelector('.horario-leitura-ini').textContent = curta(hi);
    el.querySelector('.horario-leitura-fim').textContent = curta(hf);
    return el;
  }

  /* ---------- régua ---------- */

  /* a régua vazia do molde; variante 'afastada' (abaixo de campos) ou 'grande' (com os nomes) */
  function criarRegua(variante) {
    var r = RosterWork.tpl('tpl-regua');
    if (r && variante) r.classList.add('regua-dia--' + variante);
    return r;
  }

  /* desenha os pedaços: [{ hi, hf, classe, texto, dica }]; posição e largura em porcentagem do dia */
  function regua(el, lista) {
    if (!el) return;
    var barra = el.classList.contains('regua') ? el : el.querySelector('.regua');
    if (!barra) return;
    barra.textContent = '';
    (lista || []).forEach(function (pd) {
      var f = faixa(pd);
      var no = RosterWork.tpl('tpl-regua-pedaco');
      if (!no) return;
      no.style.setProperty('--pedaco-ini', String(f[0] / 14.4));
      no.style.setProperty('--pedaco-tam', String((f[1] - f[0]) / 14.4));
      if (pd.classe) no.classList.add('regua-pedaco--' + pd.classe);
      if (pd.texto) no.textContent = pd.texto;
      if (pd.dica) no.setAttribute('data-dica', pd.dica);
      barra.appendChild(no);
    });
  }

  /* ---------- uma linha de horário ---------- */

  /* cfg = { hi, hf, opcoes {inicios, fins}, fixo, desligado, erro, aoInicio(hora), aoFim(hora), aoRemover, aoAdicionar,
     adicionarDesligado, semAcoes }: sem aoRemover / aoAdicionar, o botão guarda o lugar escondido; com
     adicionarDesligado (o texto da dica), o Adicionar horário aparece apagado e a dica diz o porquê; semAcoes tira os
     dois; erro = campos vermelhos */
  function linha(cfg) {
    var el = RosterWork.tpl('tpl-horario');
    if (!el) return null;
    if (cfg.erro) el.classList.add('horario--erro');
    var par = el.querySelector('.horario-par');
    var seta = par.querySelector('.horario-seta');
    if (cfg.fixo) {
      var a = RosterWork.tpl('tpl-horario-fixo'), b = RosterWork.tpl('tpl-horario-fixo');
      a.textContent = curta(cfg.hi); b.textContent = curta(cfg.hf);
      par.insertBefore(a, seta);
      par.appendChild(b);
    } else {
      var opc = cfg.opcoes || opcoesHoras(null);
      var formato = function (h) { return curta(h + ':00'); };
      var ini = RosterWork.dropdownNumeros.criar({ opcoes: opc.inicios, valor: String(cfg.hi).slice(0, 2), formato: formato,
        aoEscolher: function (h) { if (cfg.aoInicio) cfg.aoInicio(h + ':00'); } });
      var fim = RosterWork.dropdownNumeros.criar({ opcoes: opc.fins, valor: String(cfg.hf).slice(0, 2), formato: formato,
        aoEscolher: function (h) { if (cfg.aoFim) cfg.aoFim(h + ':00'); } });
      if (!ini || !fim) return null;
      if (cfg.desligado) {
        ini.querySelector('.dropdown-numeros-btn').disabled = true;
        fim.querySelector('.dropdown-numeros-btn').disabled = true;
      }
      par.insertBefore(ini, seta);
      par.appendChild(fim);
    }
    var remover = el.querySelector('.horario-remover');
    var adicionar = el.querySelector('.horario-adicionar');
    if (cfg.semAcoes) {
      remover.remove();
      adicionar.remove();
      return el;
    }
    if (cfg.aoRemover) remover.addEventListener('click', cfg.aoRemover);
    else remover.classList.add('horario-acao--vazia');
    if (cfg.aoAdicionar) adicionar.addEventListener('click', cfg.aoAdicionar);
    else if (cfg.adicionarDesligado) {
      adicionar.setAttribute('aria-disabled', 'true');
      adicionar.setAttribute('data-dica', cfg.adicionarDesligado);
      adicionar.classList.add('horario-acao--desligada');
    } else adicionar.classList.add('horario-acao--vazia');
    return el;
  }

  /* ---------- período dentro de um serviço: Serviço inteiro ou Parte do serviço ---------- */

  var contaPeriodos = 0;   // nome único para os rádios de cada período na tela

  /* monta em container o molde #tpl-periodo-servico (as opções, os campos da parte e a régua).
     opcoes = { aoMudar(valor) }, chamado só quando a pessoa mexe.
     Devolve { definirServico(servico|null), definirParte(hi, hf), valor(), limpar() };
     valor() = null sem serviço, senão { hi, hf, minutos, total, valido } (total = o serviço inteiro) */
  function periodoServico(container, opcoes) {
    opcoes = opcoes || {};
    var el = RosterWork.tpl('tpl-periodo-servico');
    if (!container || !el) return null;
    var nome = 'periodo-servico-' + (++contaPeriodos);
    var radios = el.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) { r.name = nome; });
    var caixaHorario = el.querySelector('.periodo-servico-horario');
    var reguaEl = criarRegua('afastada');
    if (reguaEl) el.appendChild(reguaEl);
    container.textContent = '';
    container.appendChild(el);
    var st = { servico: null, parte: false, hi: null, hf: null };

    /* o serviço em minutos, sem passar das 08h do dia seguinte */
    function janela() { var f = faixa(st.servico); if (f[1] > 1440) f[1] = 1440; return f; }
    function parteValida() {
      var f = faixa({ hi: st.hi, hf: st.hf }), w = janela();
      return f[1] > f[0] && f[0] >= w[0] && f[1] <= w[1];
    }
    function valor() {
      if (!st.servico) return null;
      if (!st.parte) { var w = janela(), p = periodo(w); return { hi: p.hi, hf: p.hf, minutos: w[1] - w[0], total: true, valido: true }; }
      var ok = parteValida(), f = faixa({ hi: st.hi, hf: st.hf });
      return { hi: st.hi, hf: st.hf, minutos: ok ? f[1] - f[0] : 0, total: false, valido: ok };
    }
    function desenhar() {
      [].forEach.call(radios, function (r) { r.disabled = !st.servico; r.checked = (r.value === 'parte') === st.parte; });
      caixaHorario.textContent = '';
      caixaHorario.classList.toggle('oculto', !(st.servico && st.parte));
      var pedacos = [];
      if (st.servico) {
        var w = periodo(janela());
        if (st.parte) {
          var l = linha({ hi: st.hi, hf: st.hf, opcoes: opcoesHoras([w]), semAcoes: true,
            aoInicio: function (h) { st.hi = h; mudou(); },
            aoFim: function (h) { st.hf = h; mudou(); } });
          if (l) caixaHorario.appendChild(l);
        }
        /* a régua: o serviço e, por cima, o trecho escolhido */
        pedacos.push({ hi: w.hi, hf: w.hf });
        var v = valor();
        if (v.valido) pedacos.push({ hi: v.hi, hf: v.hf, classe: 'novo' });
      }
      regua(reguaEl, pedacos);
    }
    function mudou() { desenhar(); if (opcoes.aoMudar) opcoes.aoMudar(valor()); }
    [].forEach.call(radios, function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        st.parte = r.value === 'parte';
        if (st.parte) { var w = periodo(janela()); st.hi = w.hi; st.hf = w.hf; }
        mudou();
      });
    });
    desenhar();
    return {
      definirServico: function (servico) {
        st.servico = servico ? { hi: String(servico.hi || '08:00').slice(0, 5), hf: String(servico.hf || '08:00').slice(0, 5) } : null;
        st.parte = false; st.hi = null; st.hf = null;
        desenhar();
      },
      definirParte: function (hi, hf) { if (!st.servico) return; st.parte = true; st.hi = hi; st.hf = hf; desenhar(); },
      valor: valor,
      limpar: function () { st.servico = null; st.parte = false; st.hi = null; st.hf = null; desenhar(); }
    };
  }

  window.RosterWork.horario = {
    emMin: emMin, faixa: faixa, hhmm: hhmm, periodo: periodo, curta: curta, cruza: cruza, menos: menos, uniao: uniao,
    opcoesHoras: opcoesHoras, leitura: leitura, criarRegua: criarRegua, regua: regua, linha: linha, periodoServico: periodoServico
  };
})();
