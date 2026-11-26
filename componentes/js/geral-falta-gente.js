/* ============================================================
   COMPONENTE geral-falta-gente — a linha da Falta de gente
   Embaixo do gráfico de uma unidade num dia (a Escala, na última
   opção dos Filtros; a Extrajornada, no Exibir), uma casinha por
   horário de 6 h, embaixo das barras dele: quantos ainda faltam para
   o mínimo (o vermelho; "1 de 2" quando as extras cobriram parte), o
   certo quando não falta ninguém e, pequeno no canto direito, o "+1"
   das extras a mais do que faltava. A dica diz o horário, os números
   e, quando falta só numa parte do horário, as horas (as vermelhas
   do gráfico).
   porHorario(antes, resta, extras, erro): a conta de cada horário;
   linha(grafico, horarios): o molde #tpl-falta-gente logo depois do
   gráfico (sempre, com a casinha vazia no horário sem nada); carregando(grafico):
   a mesma linha, cinza e respirando, enquanto a conta não chega; rotulos(horario):
   o que vai escrito na casinha (a tela e a folha das grades,
   escalas-impressao-grade-celula.js).
   Não cria HTML (clona o molde) nem escreve estilo.
   RosterWork.faltaGente.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'], FIM = ['14h', '20h', '02h', '08h'];

  function msg() { return RW.mensagens.faltaGente; }
  /* a hora do dia de serviço (0 a 23, contada das 08h) escrita: 23 = '07h' */
  function hh(h) { return String((h + 8) % 24).padStart(2, '0') + 'h'; }

  /* horas soltas do dia (0 a 23, contadas das 08h) em trechos seguidos: 'das 07h às 08h e das 10h às 11h' */
  function trechos(lista) {
    var t = [];
    lista.slice().sort(function (x, y) { return x - y; }).forEach(function (h) {
      var ult = t[t.length - 1];
      if (ult && h === ult[1]) ult[1] = h + 1; else t.push([h, h + 1]);
    });
    return t.map(function (x) { return 'das ' + hh(x[0]) + ' às ' + hh(x[1]); }).join(' e ');
  }

  /* a hora vermelha do gráfico, como o gráfico a pinta (escalas-celula.js › montarGrafico): nem o amarelo (2) nem o
     verde (0) */
  function vermelha(marca) { return !!marca && marca !== 2 && marca !== '2' && marca !== '0'; }

  /* a conta de cada horário de 6 h (1 a 4; só o vermelho, onde falta gente para o mínimo): antes = quantos faltavam sem
     as extras; resta = quantos ainda faltam; extras = quantas extras cobrem o horário inteiro; erro = a cor de cada hora do
     gráfico (o data-erro dele, ou a lista da leitura; vermelho = 1). Devolve, por horário, { horario, antes, falta, cobriu, mais, estado, so }:
     estado 'falta' (ainda falta), 'coberta' (não falta ninguém: as extras cobriram, ou há extra a mais, em mais) ou ''
     (nada no horário); so = as horas vermelhas quando ainda falta só numa parte do horário (a extra que só completa o
     ideal conta como a mais) */
  function porHorario(antes, resta, extras, erro) {
    return [1, 2, 3, 4].map(function (b) {
      var a = +((antes || {})[b] || 0), r = +((resta || {})[b] || 0), cobriu = Math.max(0, a - r);
      var mais = Math.max(0, +((extras || {})[b] || 0) - cobriu);
      var so = [];
      if (r > 0 && erro) {
        for (var h = (b - 1) * 6; h < b * 6; h++) if (vermelha(erro[h])) so.push(h);
        if (so.length === 6) so = [];
      }
      return { horario: b, antes: a, falta: r, cobriu: cobriu, mais: mais, so: so,
               estado: r > 0 ? 'falta' : (a > 0 || mais > 0) ? 'coberta' : '' };
    });
  }

  /* o que vai escrito na casinha de um horário: o número (quantos faltam; "1 de 2" quando as extras cobriram parte) e o
     "+1" das extras a mais */
  function rotulos(h) {
    var M = msg();
    return { numero: h.estado === 'falta' ? (h.cobriu ? M.de(h.falta, h.antes) : String(h.falta)) : '',
             mais: h.estado === 'coberta' && h.mais ? M.mais(h.mais) : '' };
  }

  /* a linha logo depois do gráfico, com o número, o certo, o "+1" e a dica de cada horário; o horário sem nada fica com a
     casinha vazia, e a linha entra mesmo sem nada no dia (as colunas do dia ficam alinhadas). Devolve a linha ou null */
  function linha(grafico, horarios) {
    if (!grafico || !grafico.parentNode) return null;
    var faixa = RW.tpl('tpl-falta-gente'), M = msg();
    if (!faixa) return null;
    Array.prototype.forEach.call(faixa.querySelectorAll('.falta-gente-hora'), function (casa, i) {
      var h = horarios[i];
      if (!h || !h.estado) return;
      var r = rotulos(h);
      casa.classList.add('falta-gente-hora--' + h.estado);
      casa.querySelector('.falta-gente-numero').textContent = r.numero;
      casa.querySelector('.falta-gente-mais').textContent = r.mais;
      casa.setAttribute('data-dica', M.dica[h.estado](INI[h.horario - 1] + ' às ' + FIM[h.horario - 1], h, h.so.length ? trechos(h.so) : ''));
    });
    grafico.parentNode.insertBefore(faixa, grafico.nextSibling);
    return faixa;
  }

  /* a linha enquanto a conta não chega: as quatro casinhas cinzas, respirando (o esqueleto-conjunto, geral-esqueleto.css),
     sem número nem dica, logo depois do gráfico (ou da forma dele, escalas-esqueleto.js). Devolve a linha ou null */
  function carregando(grafico) {
    if (!grafico || !grafico.parentNode) return null;
    var faixa = RW.tpl('tpl-falta-gente');
    if (!faixa) return null;
    faixa.classList.add('falta-gente--carregando', 'esqueleto-conjunto');
    faixa.setAttribute('aria-hidden', 'true');
    grafico.parentNode.insertBefore(faixa, grafico.nextSibling);
    return faixa;
  }

  RW.faltaGente = { porHorario: porHorario, linha: linha, carregando: carregando, rotulos: rotulos, trechos: trechos };
})();
