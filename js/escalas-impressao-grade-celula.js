/* ============================================================
   ESCALAS — a célula no PDF das grades (unidade × dia)
   O bloquinho branco de uma unidade num dia, como na tela: o nome da
   unidade (só no calendário), o gráfico de cobertura (24 barras, na
   cor do estado), e uma linha por militar com os ícones de origem, a
   graduação, o nome (riscado na folga e na troca), o horário e a faixa
   do horário (cinza fora do turno). O "Mostrar" do painel liga e
   desliga o gráfico, os ícones e a faixa. As origens, a situação, a
   hora e os trechos do turno vêm do escalas-celula.js (a mesma fonte
   da tela). Desenhado com a biblioteca do PDF (exceção REGRAS §3/§4):
   medidas em pontos nas constantes abaixo, cores --impressao-* do tema.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* medidas em pontos */
  var FONTE = { unidade: 6, grad: 6, nome: 7, hora: 6 };
  var ALTURA_LINHA = 1.22;                 // altura de uma linha de texto da Montserrat, em vezes o tamanho da fonte
  var ESPACAMENTO_CAIXA_ALTA = 0.4;        // entre letras do nome da unidade (caixa alta)
  var BLOQUINHO = { lado: 2.5, topo: 2.5, linha: 0.6, base: 3 };
  var ICONE = 7;                           // ícone de origem
  var SETA = 4.5;                          // seta do horário (largura)
  var ENTRE_COLUNAS = 2.5;                 // ícones · nome · horário
  var MARGEM = { icone: [0, 0.8, 0, 0], hora: [0, 0.9, 0, 0], seta: [0, 0.6, 0, 0] };   // alinham ao nome
  var GRAFICO = { altura: 10, vao: 0.6, linha: 1, minima: 1.2, corpo: 0.3, corpoProblema: 0.4, raio: 1 };
  var FAIXA_RAIO = 1;

  function escalasCelula() { return RW.escalasCelula || {}; }

  /* as cores das grades e os ícones de origem (e o cadeado), no traço do tema; uma vez por PDF */
  function preparar(c) {
    var pdf = RW.escalasImpressaoPdf;
    c.sucesso = pdf.cor('--impressao-sucesso');
    c.alerta = pdf.cor('--impressao-alerta');
    c.erro = pdf.cor('--impressao-erro');
    c.faixa = pdf.cor('--impressao-faixa');
    var nomes = (escalasCelula().iconesDasOrigens ? escalasCelula().iconesDasOrigens() : []).concat(['icone-cadeado']);
    return Promise.all(nomes.map(pdf.buscarIcone)).then(function (textos) {
      c.icones = {};
      nomes.forEach(function (nome, i) { c.icones[nome] = pdf.svgDeTraco(textos[i], c.suave); });
      return c;
    });
  }

  /* o gráfico de cobertura: 24 barras (uma por hora, a partir das 08h), corpo claro e a linha forte no topo */
  function grafico(cobertura, erro, max, largura, c) {
    var passo = (largura + GRAFICO.vao) / 24;
    /* a linha invisível no pé dá ao gráfico a altura inteira, mesmo num dia sem ninguém */
    var formas = [{ type: 'line', x1: 0, y1: GRAFICO.altura, x2: largura, y2: GRAFICO.altura, lineWidth: 0.1, lineColor: c.papel, strokeOpacity: 0 }];
    for (var h = 0; h < 24; h++) {
      var n = Number(cobertura[h]) || 0;
      if (n <= 0) continue;
      var altura = Math.max(GRAFICO.minima, Math.min(n, max) / max * (GRAFICO.altura - 0.5));
      var marca = erro && erro[h];
      var problema = marca === 1 || marca === 2 || marca === '1' || marca === '2';
      var corBarra = (marca === 2 || marca === '2') ? c.alerta : (marca ? c.erro : c.sucesso);
      var x = h * passo, w = passo - GRAFICO.vao, y = GRAFICO.altura - altura;
      formas.push({ type: 'rect', x: x, y: y, w: w, h: altura, r: GRAFICO.raio, color: corBarra, fillOpacity: problema ? GRAFICO.corpoProblema : GRAFICO.corpo });
      formas.push({ type: 'rect', x: x, y: y, w: w, h: Math.min(GRAFICO.linha, altura), color: corBarra });
    }
    return { canvas: formas, margin: [0, 0, 0, 2] };
  }

  /* altura aproximada (pt) de uma linha: o nome ou os horários empilhados, o que for maior */
  function alturaLinha(p) {
    return Math.max(FONTE.nome * ALTURA_LINHA, Math.max(1, (p.periodos || []).length) * FONTE.hora * ALTURA_LINHA);
  }

  /* a faixa do horário atrás da linha: cinza fora do turno (na folga e na troca, dentro do trecho) */
  function faixa(p, riscada, largura, c) {
    var trechos = escalasCelula().trechosTurno ? escalasCelula().trechosTurno(p.periodos) : [];
    if (!trechos.length) return null;
    var cinzas = [];
    if (riscada) {
      cinzas = trechos;
    } else {
      var desde = 0;
      trechos.forEach(function (t) { if (t[0] > desde) cinzas.push([desde, t[0]]); desde = Math.max(desde, t[1]); });
      if (desde < 100) cinzas.push([desde, 100]);
    }
    if (!cinzas.length) return null;
    var altura = alturaLinha(p) + 2 * BLOQUINHO.linha;
    return {
      canvas: cinzas.map(function (t) {
        return { type: 'rect', x: largura * t[0] / 100, y: -BLOQUINHO.linha, w: largura * (t[1] - t[0]) / 100, h: altura, r: FAIXA_RAIO, color: c.faixa };
      }),
      relativePosition: { x: 0, y: 0 }   // não ocupa lugar: o texto da linha vem por cima
    };
  }

  function horarios(p, c) {
    var soHora = escalasCelula().soHora || function (h) { return h || ''; };
    /* afastado (com o filtro Afastamentos): "Férias até DD/MM" no lugar do horário */
    if (p.origem === 'afastamento') {
      return { text: RW.mensagens.geral.afastadoAte(p.afastamento || '', RW.data.isoParaBR(p.ate).slice(0, 5)), fontSize: FONTE.hora, color: c.texto, width: 'auto', margin: MARGEM.hora };
    }
    return {
      stack: (p.periodos || []).filter(function (per) { return per.inicio; }).map(function (per) {
        var partes = [{ text: soHora(per.inicio), width: 'auto' }];
        if (per.fim) partes.push({ svg: c.seta, width: SETA, margin: MARGEM.seta }, { text: soHora(per.fim), width: 'auto' });
        return { columns: partes, columnGap: 1.5 };
      }),
      fontSize: FONTE.hora, color: c.texto, width: 'auto', margin: MARGEM.hora
    };
  }

  /* uma linha de militar: ícones · graduação e nome · horário (a faixa por trás) */
  function linha(p, largura, mostrar, c) {
    var riscada = p.origem === 'folga' || p.origem === 'troca_saida' || p.origem === 'remanejado_saida';
    var colunas = [];
    if (mostrar.icones) {
      var nomes = [];
      if (p.origem_base) nomes.push(escalasCelula().iconeDaOrigem(p.origem_base));
      nomes.push(escalasCelula().iconeDaOrigem(p.origem));
      if (p.fixado) nomes.push('icone-cadeado');
      if (p.remanejado) nomes.push('icone-remanejado');
      colunas.push({ columns: nomes.map(function (n) { return { svg: c.icones[n], width: ICONE, height: ICONE }; }), columnGap: 1, width: 'auto', margin: MARGEM.icone });
    }
    colunas.push({ text: [
      { text: (p.grad || '') + ' ', fontSize: FONTE.grad, color: c.suave },
      { text: p.nome || '', fontSize: FONTE.nome, bold: !riscada, color: riscada ? c.suave : c.forte, decoration: riscada ? 'lineThrough' : undefined }
    ], width: '*' });
    colunas.push(horarios(p, c));
    var conteudo = { columns: colunas, columnGap: ENTRE_COLUNAS };
    var fundo = mostrar.faixa ? faixa(p, riscada, largura, c) : null;
    return fundo ? { stack: [fundo, conteudo] } : conteudo;
  }

  /* o bloquinho branco: tabela de uma coluna sem linhas; o branco quadrado só quando "preencher"
     (o desenho de cantos retos, que também é a medida dos cantos arredondados) */
  function layoutBloquinho(c, preencher) {
    return {
      hLineWidth: function () { return 0; },
      vLineWidth: function () { return 0; },
      paddingLeft: function () { return BLOQUINHO.lado; },
      paddingRight: function () { return BLOQUINHO.lado; },
      paddingTop: function (i) { return i === 0 ? BLOQUINHO.topo : BLOQUINHO.linha; },
      paddingBottom: function (i, no) { return i === no.table.body.length - 1 ? BLOQUINHO.base : BLOQUINHO.linha; },
      fillColor: function () { return preencher ? c.papel : null; }
    };
  }

  /* o bloquinho de uma unidade num dia. o = { largura, unidade (nome, só no calendário), cobertura, erro, max,
     pessoas, mostrar, c, preencher } */
  function bloco(o) {
    var interna = o.largura - 2 * BLOQUINHO.lado;
    var corpo = [];
    if (o.unidade) {
      corpo.push([{ text: o.unidade.toLocaleUpperCase('pt-BR'), fontSize: FONTE.unidade, bold: true, characterSpacing: ESPACAMENTO_CAIXA_ALTA, color: o.c.suave }]);
    }
    if (o.mostrar.grafico && o.cobertura && o.max > 0) corpo.push([grafico(o.cobertura, o.erro, o.max, interna, o.c)]);
    (o.pessoas || []).forEach(function (p) { corpo.push([linha(p, interna, o.mostrar, o.c)]); });
    if (!corpo.length) corpo.push([{ text: ' ', fontSize: FONTE.nome }]);
    return { table: { widths: [interna], body: corpo, dontBreakRows: true }, layout: layoutBloquinho(o.c, o.preencher) };
  }

  RW.escalasImpressaoGradeCelula = { preparar: preparar, bloco: bloco };
})();
