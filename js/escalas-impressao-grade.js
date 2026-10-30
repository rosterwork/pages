/* ============================================================
   ESCALAS — Imprimir as grades (painel → PDF)
   Nas grades (Agenda, Calendário, Colunas), o botão Imprimir abre o
   painel de impressão comum (componentes/js/geral-impressao.js, com
   as caixas do molde #tpl-escala-impressao do escalas.html), com o que
   é desta impressão: a grade e o mês da tela (no Colunas › Unidades,
   a semana) e os filtros ligados, no resumo da nota do alto; o
   período (no Calendário, o "Mês todo" ou as semanas escolhidas; na
   Agenda e no Colunas › Dias, do dia ao dia); o formato (Folhas A4
   ou Página contínua) e o arquivo, desenhado no
   escalas-impressao-grade-pdf.js. As unidades começam marcadas com as
   da tela (e a companhia de cada pelotão); o Mostrar (gráfico,
   ícones, faixa), a prévia e o Gerar PDF são do painel comum.
   Quem imprime outra grade (a Extrajornada) passa a leitura dela no
   lugar da escala (dados, no mesmo formato), o título do arquivo e
   a conferência (null: sem o aviso do erro grave da escala).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* o período de cada grade (semanas, dias ou a semana da tela) e a folha (paisagem ou retrato) */
  var FORMATOS = {
    agenda: { periodo: 'dias', paisagem: false },
    calendario: { periodo: 'semanas', paisagem: true },
    'colunas-dias': { periodo: 'dias', paisagem: true },
    'colunas-unidades': { periodo: 'semana', paisagem: false }
  };

  var form = null;          // o painel aberto: as escolhas desta impressão (formato e período) e as peças delas
  var cacheDados = null;    // { chave, promessa }: mudar o formato, o Mostrar ou o período não busca de novo

  function msg() { return RW.mensagens.escala.impressao.grade; }

  /* ---------- datas ---------- */
  function somarDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function ultimoDia(mes) { return new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate(); }

  /* "4 a 10 de outubro" ou, entre dois meses, "27 de setembro a 3 de outubro" */
  function intervalo(a, b) {
    if (a.getMonth() === b.getMonth()) return msg().doMes(msg().trecho(String(a.getDate()), String(b.getDate())), MESES[b.getMonth()]);
    return msg().trecho(msg().doMes(String(a.getDate()), MESES[a.getMonth()]), msg().doMes(String(b.getDate()), MESES[b.getMonth()]));
  }

  /* trechos do mesmo mês: "1 a 3, 11 a 17 e 25 a 31 de outubro" */
  function trechosDoMes(trechos) {
    var dias = trechos.map(function (t) { return msg().trecho(String(t[0].getDate()), String(t[1].getDate())); });
    return msg().doMes(msg().juntar(dias), MESES[trechos[0][0].getMonth()]);
  }

  /* as linhas do calendário do mês (domingo a sábado) e, em cada uma, o primeiro e o último dia que são do mês */
  function semanasDoMes(mes) {
    var fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    var lista = [];
    for (var d = somarDias(mes, -mes.getDay()); d <= fimMes; d = somarDias(d, 7)) {
      var fim = somarDias(d, 6);
      lista.push({ inicio: d, primeiro: d < mes ? mes : d, ultimo: fim > fimMes ? fimMes : fim });
    }
    return lista;
  }

  /* a semana de hoje, se o mês da tela tem hoje; senão a 1ª */
  function semanaDeHoje() {
    var agora = new Date();
    var hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    var i = semanasDoMes(form.mes).map(function (s) { return s.primeiro <= hoje && hoje <= s.ultimo; }).indexOf(true);
    return i >= 0 ? i : 0;
  }

  /* ---------- o período ---------- */
  /* { dias: [{ data, fora }] em ordem, busca: { inicio, fim } (o que a tela carrega), texto (no PDF),
     frase (no painel; vazia quando sai o mês todo) } */
  function periodoEscolhido() {
    var mes = form.mes;
    var fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    var nomeMes = msg().comAno(MESES[mes.getMonth()], mes.getFullYear());
    var dias = [];
    var periodo = FORMATOS[form.formato].periodo;
    if (periodo === 'semana') {
      /* Colunas › Unidades: a semana da tela (domingo a sábado), como ela está */
      var domingo = somarDias(form.data, -form.data.getDay());
      for (var k = 0; k < 7; k++) dias.push({ data: somarDias(domingo, k), fora: false });
      var sabado = dias[6].data;
      return { dias: dias, busca: { inicio: domingo, fim: sabado }, texto: msg().comAno(intervalo(domingo, sabado), sabado.getFullYear()), frase: '' };
    }
    if (periodo === 'semanas') {
      /* as semanas inteiras, com os dias de outro mês vazios, como na tela */
      var semanas = semanasDoMes(mes);
      var escolhidas = form.mesTodo ? semanas.map(function (s, i) { return i; }) : form.semanas;
      var trechos = [];
      escolhidas.forEach(function (i) {
        var s = semanas[i];
        for (var j = 0; j < 7; j++) { var d = somarDias(s.inicio, j); dias.push({ data: d, fora: d.getMonth() !== mes.getMonth() }); }
        var anterior = trechos[trechos.length - 1];
        if (anterior && somarDias(anterior[1], 1).getTime() === s.primeiro.getTime()) anterior[1] = s.ultimo;
        else trechos.push([s.primeiro, s.ultimo]);
      });
      return { dias: dias, busca: { inicio: mes, fim: fimMes },
        texto: form.mesTodo ? nomeMes : msg().comAno(trechosDoMes(trechos), mes.getFullYear()),
        frase: form.mesTodo ? '' : msg().semanas(escolhidas.map(function (i) { return String(i + 1); }), trechosDoMes(trechos)) };
    }
    var de = new Date(mes.getFullYear(), mes.getMonth(), form.de);
    var ate = new Date(mes.getFullYear(), mes.getMonth(), form.ate);
    var inicio = de, fim = ate;
    /* Colunas › Dias: as linhas saem inteiras, nas mesmas colunas da tela (os dias de fora ficam vazios) */
    if (form.formato === 'colunas-dias' && RW.geralCalendarioMes) {
      var n = form.diasPorLinha;
      inicio = somarDias(de, -RW.geralCalendarioMes.colunaContinua(de, n));
      fim = somarDias(ate, n - 1 - RW.geralCalendarioMes.colunaContinua(ate, n));
    }
    for (var d2 = inicio; d2 <= fim; d2 = somarDias(d2, 1)) dias.push({ data: d2, fora: d2 < de || d2 > ate });
    var todos = form.de === 1 && form.ate === ultimoDia(mes);
    return { dias: dias, busca: { inicio: mes, fim: fimMes },
      texto: todos ? nomeMes : msg().comAno(intervalo(de, ate), mes.getFullYear()),
      frase: todos ? '' : msg().dias(form.ate - form.de + 1, intervalo(de, ate)) };
  }

  /* ---------- semanas ---------- */
  /* "Mês todo" marcado: só ele. Desmarcado: os botões das semanas do mês (cada um com as datas na dica),
     já com a semana de hoje */
  function marcarMesTodo(sim) {
    form.mesTodo = sim;
    form.mesTodoBotao.setAttribute('aria-checked', sim ? 'true' : 'false');
    form.mesTodoBotao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', sim);
    form.lista.classList.toggle('oculto', sim);
    form.lista.textContent = '';
    form.semanas = [];
    if (sim) return;
    form.semanas = [semanaDeHoje()];
    semanasDoMes(form.mes).forEach(function (s, i) {
      var aba = RW.tpl('tpl-escala-aba-unidade');
      if (!aba) return;
      var datas = intervalo(s.primeiro, s.ultimo);
      aba.textContent = String(i + 1);
      aba.setAttribute('data-semana', i);
      aba.setAttribute('data-dica', datas);
      aba.setAttribute('aria-label', msg().semanaRotulo(i + 1, datas));
      if (i === form.semanas[0]) aba.classList.add('aba--ativa');
      form.lista.appendChild(aba);
    });
    pintarSemanas();
  }

  /* o componente de abas já marcou ou desmarcou (de marcar vários, nunca zera); aqui a escolha vem da tela */
  function pintarSemanas() {
    form.semanas = [];
    Array.prototype.forEach.call(form.lista.querySelectorAll('[data-semana]'), function (aba) {
      var marcada = aba.classList.contains('aba--ativa');
      aba.setAttribute('aria-pressed', marcada ? 'true' : 'false');
      if (marcada) form.semanas.push(Number(aba.getAttribute('data-semana')));
    });
  }

  /* ---------- dias ---------- */
  /* as listas só oferecem os dias que o mês tem; o "ao dia", do "Do dia" em diante */
  function montarDias() {
    var ultimo = ultimoDia(form.mes);
    function faixa(a, b) { var l = []; for (var n = a; n <= b; n++) l.push(n); return l; }
    [['de', faixa(1, ultimo), form.de], ['ate', faixa(form.de, ultimo), form.ate]].forEach(function (item) {
      var caixa = form.raiz.querySelector('[data-impressao-dia="' + item[0] + '"]');
      caixa.querySelector('.campo-selecao-texto').textContent = String(item[2]);
      RW.dropdownNumeros.preencher(caixa.querySelector('.dropdown-menu'), { opcoes: item[1], valor: item[2], aoEscolher: function (valor) {
        if (item[0] === 'de') { form.de = valor; if (form.ate < valor) form.ate = valor; } else form.ate = valor;
        montarDias();
        mudou();
      } });
    });
  }

  /* ---------- o período mudou: a frase das datas e o painel (o resumo, a prévia) ---------- */
  function mudou() {
    var p = periodoEscolhido();
    form.periodo.textContent = p.frase;
    form.periodo.classList.toggle('oculto', !p.frase);
    RW.impressao.atualizar();
  }

  /* os dados da tela (ler_escala_mes, ou a leitura de quem abriu) do mês ou da semana; o mesmo pedido não busca de novo */
  function carregarDados(ids, inicio, fim) {
    var chave = ids.join(',') + '|' + inicio + '|' + fim;
    if (cacheDados && cacheDados.chave === chave) return cacheDados.promessa;
    var promessa = (form && form.dados ? form.dados : RW.escalasDados.carregar)(ids, inicio, fim);
    cacheDados = { chave: chave, promessa: promessa };
    promessa.catch(function () { if (cacheDados && cacheDados.promessa === promessa) cacheDados = null; });
    return promessa;
  }

  /* a nota do alto: "Calendário de outubro de 2026, 2ªCIBM e 2ºPEL, sem filtros." */
  function resumo(unidades) {
    var periodo = FORMATOS[form.formato].periodo === 'semana'
      ? msg().daSemana(periodoEscolhido().texto)
      : msg().doMesDaTela(msg().comAno(MESES[form.mes.getMonth()], form.mes.getFullYear()));
    return msg().resumo(msg().nomes[form.formato], periodo, msg().juntar(unidades.map(function (u) { return u.nome; })), form.filtros);
  }

  /* o estado das escolhas para o painel comum: o resumo, o período (para o erro grave) e o arquivo */
  function estado(escolhas) {
    var p = periodoEscolhido();
    var dentro = p.dias.filter(function (d) { return !d.fora; });
    var iso = RW.data.paraIsoDeData;
    var formato = form.formato, continua = form.continua, paisagem = FORMATOS[formato].paisagem, diasPorLinha = form.diasPorLinha, titulo = form.titulo, prefixo = form.prefixo;
    var unidades = escolhas.unidades.map(function (u) { return { unidade_id: u.unidade_id, nome: u.nome }; });
    var mostrar = escolhas.mostrar;
    return {
      resumo: resumo(escolhas.unidades),
      inicio: iso(dentro[0].data),
      fim: iso(dentro[dentro.length - 1].data),
      chave: [escolhas.ids.join(','), formato, continua, mostrar.grafico, mostrar.icones, mostrar.faixa, p.dias.length,
        iso(p.dias[0].data), iso(p.dias[p.dias.length - 1].data), p.texto].join('|'),
      montar: function () {
        return carregarDados(escolhas.ids, iso(p.busca.inicio), iso(p.busca.fim)).then(function (dados) {
          return RW.escalasImpressaoGradePdf.gerar({ formato: formato, paisagem: paisagem, continua: continua, mostrar: mostrar,
            diasPorLinha: diasPorLinha, unidades: unidades, dias: p.dias, texto: p.texto, dados: dados, titulo: titulo, prefixo: prefixo });
        }).then(function (r) {
          return { arquivo: r.arquivo, nome: r.nome, folhas: RW.mensagens.impressao.folhas(r.folhas, continua, paisagem) };
        }, function (e) {
          throw { mensagem: e && e.longaDemais ? msg().longaDemais : null };
        });
      }
    };
  }

  /* ---------- abrir ---------- */
  function subtitulo() { return msg().subtitulo(FORMATOS[form.formato].paisagem, form.continua); }

  /* opcoes: { formato, data (a da tela), unidades ([{ unidade_id, nome }] da tela: as marcadas no começo), diasPorLinha,
     filtros (os ligados na tela, em texto); de outra grade: dados(ids, inicio, fim) (a promessa no formato do
     RosterWork.escalasDados.carregar), titulo (o do alto da folha), prefixo (o começo do nome do arquivo) e conferir
     (null: sem a conferência da escala) } */
  function abrir(opcoes) {
    if (!RW.painel || !RW.impressao || !FORMATOS[opcoes.formato]) return;
    var formato = opcoes.formato;
    var periodo = FORMATOS[formato].periodo;
    var data = opcoes.data || new Date();
    cacheDados = null;
    RW.painel.abrir({ titulo: msg().titulos[formato], subtitulo: msg().subtitulo(FORMATOS[formato].paisagem, false),
      aoFechar: function () { RW.impressao.esquecer(); form = null; cacheDados = null; } });
    /* as escolhas desta impressão (o formato e o período) e o que vem da tela */
    form = {
      formato: formato, continua: false, diasPorLinha: opcoes.diasPorLinha || 3, filtros: opcoes.filtros || [],
      dados: opcoes.dados || null, titulo: opcoes.titulo || null, prefixo: opcoes.prefixo || null,
      data: new Date(data.getFullYear(), data.getMonth(), data.getDate()), mes: new Date(data.getFullYear(), data.getMonth(), 1),
      mesTodo: true, semanas: [], de: 1, ate: 1
    };
    var meu = form;
    RW.impressao.montar(RW.painel.corpo(), RW.painel.rodape(), {
      molde: 'tpl-escala-impressao',
      marcas: ['grade', periodo],
      conferir: 'conferir' in opcoes ? opcoes.conferir : (RW.escalasImpressao ? RW.escalasImpressao.conferirErros : null),
      ids: (opcoes.unidades || []).map(function (u) { return u.unidade_id; }),
      mostrar: { grafico: true, icones: true, faixa: true },
      aoSair: function () { RW.painel.fechar(); },
      ligar: function (peca) {
        form.raiz = RW.painel.corpo();
        form.mesTodoBotao = peca('mes-todo');
        form.lista = peca('semanas');
        form.periodo = peca('periodo');
        /* formato: Folhas A4 ou Página contínua */
        RW.abas.ligar(peca('formato'), function (aba) {
          form.continua = aba.getAttribute('data-formato') === 'continua';
          RW.painel.definirTitulos(null, subtitulo());
          RW.impressao.atualizar();
        });
        /* semanas: o Mês todo (caixa de marcar) e, quando desmarcado, os botões de cada semana */
        form.mesTodoBotao.addEventListener('click', function () { marcarMesTodo(!form.mesTodo); mudou(); });
        RW.abas.ligar(form.lista, function () { pintarSemanas(); mudou(); });
        /* o período começa no mês todo da tela (semanas: o Mês todo marcado; dias: do 1º ao último) */
        form.ate = ultimoDia(form.mes);
        if (periodo === 'dias') montarDias();
      },
      estado: function (escolhas) { return form === meu ? estado(escolhas) : { erro: ' ' }; }
    });
  }

  RW.escalasImpressaoGrade = { abrir: abrir };
})();
