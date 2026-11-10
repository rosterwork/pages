/* ============================================================
   ESCALAS — a forma da grade enquanto os dados chegam
   Trocou de mês ou de visão: o que está na tela fica 0,5 s, sem
   responder; depois, a forma da grade nova, com as datas e os
   pelotões de verdade e só as linhas que cabem na tela; passando de
   1,5 s, o cartão das etapas (geral-etapas.js). Uma espera por vez.
   Quem desenha a grade começa aqui, segura a leitura (a forma que
   apareceu fica o mínimo na tela) e para ao receber os dados.
   API: RosterWork.escalasEsqueleto.{ comecar, abrirMes, segurar, parar,
   agenda, calendario, colunas, militares, nomeDoMes }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var ALTURA_DIA = 88;       // a altura de um dia na Agenda, para desenhar só as linhas que cabem
  var ALTURA_MILITAR = 44;   // a altura de um militar no modo Militares
  var DIAS_PERTO = 21;       // no calendário, os dias em volta do que abre: os outros ficam só com o número

  var espera = null, corpoEsperando = null;

  function nomeDoMes(data) { return MESES[data.getMonth()]; }

  /* a espera de uma grade em corpo: opcoes = { forma(lugar), etapas, valores }; devolve a espera, que segura a leitura */
  function comecar(corpo, opcoes) {
    parar();
    corpoEsperando = corpo;
    corpo.inert = true;
    espera = RW.etapas.area(corpo, opcoes);
    return espera;
  }

  function abrirMes(corpo, dataRef, forma) {
    return comecar(corpo, { forma: forma, etapas: 'escalaAbrir', valores: { mes: nomeDoMes(dataRef) } });
  }

  /* a leitura da grade, segura pela espera dela; sem espera (a grade de antes ficou na tela), nada a segurar */
  function segurar(esperaDaGrade, leitura) {
    return esperaDaGrade ? esperaDaGrade.segurar(leitura) : leitura;
  }

  function parar() {
    if (espera) espera.parar();
    espera = null;
    if (corpoEsperando) corpoEsperando.inert = false;
    corpoEsperando = null;
  }

  /* ---------- as peças ---------- */

  /* o miolo de uma célula: o lugar do gráfico e as linhas dos militares; quem está numa grade com muitas células anima a
     grade inteira, não cada uma */
  function preencherCelula(celula, linhas, semAnimar) {
    var miolo = RW.tpl('tpl-esqueleto-miolo');
    for (var i = 0; i < linhas; i++) miolo.appendChild(RW.tpl('tpl-esqueleto-pessoa'));
    if (semAnimar) miolo.classList.remove('esqueleto-conjunto');
    celula.classList.add('esqueleto-celula');
    celula.appendChild(miolo);
    return celula;
  }

  function celulaFalsa(unidadeId, n) {
    var celula = RW.tpl('tpl-escala-mes-celula');
    celula.dataset.unidadeId = unidadeId;
    return preencherCelula(celula, 3 + (n % 3));
  }

  function mesmoDia(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ---------- Mês › Agenda: de ontem em diante (é onde a grade abre) ou do dia 1º ---------- */
  function agenda(corpo, colunas, dataRef, aoTerminar) {
    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var ultimo = new Date(ano, mes + 1, 0).getDate();
    var hoje = new Date();
    var primeiro = (hoje.getFullYear() === ano && hoje.getMonth() === mes) ? Math.max(1, hoje.getDate() - 1) : 1;
    var fim = Math.min(ultimo, primeiro + Math.ceil(corpo.clientHeight / ALTURA_DIA));

    var wrap = RW.tpl('tpl-escala-mes');
    var grade = wrap.querySelector('.escala-mes-grade');
    grade.classList.add('escala-mes-grade--' + Math.min(8, colunas.length));
    var cabecalho = RW.tpl('tpl-escala-mes-cabecalho');
    colunas.forEach(function (c) {
      var titulo = RW.tpl('tpl-escala-mes-titulo');
      titulo.textContent = c.nome;
      cabecalho.appendChild(titulo);
    });
    grade.appendChild(cabecalho);

    for (var dia = primeiro; dia <= fim; dia++) {
      var d = new Date(ano, mes, dia);
      var linha = RW.tpl('tpl-escala-mes-linha');
      linha.querySelector('.escala-mes-data-semana').textContent = DIAS_ABREV[d.getDay()];
      linha.querySelector('.escala-mes-data-numero').textContent = String(dia);
      if (d.getDay() === 0 || d.getDay() === 6) linha.classList.add('escala-mes-linha--fds');
      if (mesmoDia(d, hoje)) linha.classList.add('escala-mes-linha--hoje');
      colunas.forEach(function (c, n) { linha.appendChild(celulaFalsa(c.id, dia + n)); });
      grade.appendChild(linha);
    }
    corpo.textContent = '';
    corpo.appendChild(wrap);
    /* o celular mostra uma unidade por tela: o mesmo gancho da grade de verdade */
    if (aoTerminar) aoTerminar(wrap);
  }

  /* ---------- Mês › Calendário e Colunas › Dias: rolado como a grade vai abrir (lado a lado ou uma embaixo da outra,
     como a escolha da pessoa) ---------- */
  function calendario(corpo, colunas, dataRef, diasPorLinha) {
    var hoje = new Date();
    var ancora = (hoje.getFullYear() === dataRef.getFullYear() && hoje.getMonth() === dataRef.getMonth()) ? hoje : new Date(dataRef.getFullYear(), dataRef.getMonth(), 1);
    RW.geralCalendarioMes.renderizar(corpo, {
      dataRef: dataRef,
      diasPorLinha: diasPorLinha,
      unidadesPorDia: colunas.length,
      ladoALado: !!(RW.visaoGrade && RW.visaoGrade.disposicao() === 'lado'),
      aoDia: function (celulaDia, data, noMes) {
        if (!noMes || Math.abs(data - ancora) / 86400000 > DIAS_PERTO) return;
        colunas.forEach(function (c, n) {
          var bloco = RW.tpl('tpl-escala-calendario-unidade');
          bloco.querySelector('.escala-calendario-unidade-nome').textContent = c.nome;
          preencherCelula(bloco.querySelector('.escala-mes-celula'), 2 + ((data.getDate() + n) % 2), true);
          celulaDia.appendChild(bloco);
        });
      }
    });
    var wrap = corpo.querySelector('.geral-calendario-mes');
    if (wrap) wrap.querySelector('.geral-calendario-mes-grade').classList.add('esqueleto-conjunto');
    var diaHoje = wrap ? wrap.querySelector('.geral-calendario-mes-dia--hoje:not(.geral-calendario-mes-dia--fora)') : null;
    if (diaHoje && RW.periodo) {
      var linhaHoje = diaHoje.closest('.geral-calendario-mes-semana');
      RW.periodo.rolarAteHoje(wrap, linhaHoje, linhaHoje.previousElementSibling, { fixo: wrap.querySelector('.geral-calendario-mes-cabecalho') });
      RW.periodo.rolarAteHoje(wrap, diaHoje, diaHoje.previousElementSibling, { horizontal: true });
    }
  }

  /* ---------- Colunas › Unidades: os 7 dias da semana ---------- */
  function colunas(corpo, unidades, dataRef) {
    var pecas = RW.escalasColunas.pecas;
    var wrap = RW.tpl('tpl-escala-colunas');
    var grade = wrap.querySelector('.escala-colunas-grade');
    grade.style.setProperty('--n-colunas', String(unidades.length));
    var cabecalho = RW.tpl('tpl-escala-colunas-cabecalho');
    unidades.forEach(function (u) { cabecalho.appendChild(pecas.cabecalhoUnidade(u)); });
    grade.appendChild(cabecalho);
    pecas.diasDaSemana(dataRef).forEach(function (info, i) {
      var linha = RW.tpl('tpl-escala-colunas-linha');
      linha.appendChild(pecas.rotuloDia(info));
      unidades.forEach(function (u, n) { linha.appendChild(celulaFalsa(u.id, i + n)); });
      grade.appendChild(linha);
    });
    corpo.textContent = '';
    corpo.appendChild(wrap);
  }

  /* ---------- Militares: as unidades de verdade e as linhas que cabem ---------- */
  function militares(corpo, unidades, dias) {
    var wrap = RW.tpl('tpl-escala-mil');
    var grade = wrap.querySelector('.escala-mil-grade');
    var cab = RW.tpl('tpl-escala-mil-cabecalho');
    dias.forEach(function (info) {
      var cel = RW.tpl('tpl-escala-mil-dia');
      cel.querySelector('.escala-mil-dia-semana').textContent = DIAS_ABREV[info.semana];
      cel.querySelector('.escala-mil-dia-numero').textContent = String(info.dia);
      if (info.fds) cel.classList.add('escala-mil-dia--fds');
      if (info.hoje) cel.classList.add('escala-mil-dia--hoje');
      cab.appendChild(cel);
    });
    grade.appendChild(cab);
    var restam = Math.ceil(corpo.clientHeight / ALTURA_MILITAR);
    unidades.forEach(function (u) {
      if (restam <= 0) return;
      var bloco = RW.tpl('tpl-escala-mil-unidade');
      bloco.querySelector('.escala-mil-unidade-nome').textContent = u.nomeCompleto || u.nome;
      bloco.querySelector('.escala-mil-unidade-cidade').textContent = u.cidade || '';
      var corpoUnidade = bloco.querySelector('.escala-mil-unidade-corpo');
      for (var i = 0; i < 6 && restam > 0; i++, restam--) {
        var linha = RW.tpl('tpl-esqueleto-mil-pessoa');
        dias.forEach(function (info, n) {
          var cel = RW.tpl('tpl-escala-mil-celula');
          if (info.fds) cel.classList.add('escala-mil-celula--fds');
          if ((n + i) % 3 === 0) cel.appendChild(RW.tpl('tpl-esqueleto-mil-servico'));
          linha.appendChild(cel);
        });
        corpoUnidade.appendChild(linha);
      }
      grade.appendChild(bloco);
    });
    corpo.textContent = '';
    corpo.appendChild(wrap);
  }

  RW.escalasEsqueleto = {
    comecar: comecar, abrirMes: abrirMes, segurar: segurar, parar: parar, nomeDoMes: nomeDoMes,
    agenda: agenda, calendario: calendario, colunas: colunas, militares: militares
  };
})();
