/* ============================================================
   RELATÓRIO EM PDF — as peças do formato dos relatórios (o padrão
   do registro RW): o título em caixa alta, a linha do alto com o
   rótulo em cinza e o valor, as seções numeradas com o traço preto
   embaixo, a ajuda em cinza, as tabelas sem fundo só com a linha
   fina entre as linhas, as subseções (n.1, n.2...) e as
   Observações numeradas. A URL e "Página X de Y" no pé.
   Usado pela escala do Dia (escalas-impressao-pdf.js) e pelos
   relatórios e cópias da tela da Extrajornada
   (extrajornada-relatorios-pdf.js e extrajornada-tela-pdf.js). A
   biblioteca, as fontes, as cores e o desenho vêm do PDF da escala
   (RosterWork.escalasImpressaoPdf). O PDF é desenhado aqui
   (exceção REGRAS §3/§4). Medidas em pontos.
   RosterWork.relatorioPdf.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var FONTE = { titulo: 13, rotulo: 8, valor: 10, secao: 9.5, texto: 9.5, celula: 9, cabecalho: 8.5, ajuda: 8 };
  var MARGEM = { cabecalho: [0, 10, 0, 0], secao: [0, 16, 0, 4], ajuda: [0, 4, 0, 2], observacoes: [0, 6, 0, 0], subsecao: [0, 10, 0, 0] };
  var LINHA = { secao: 0.75, tabela: 0.5 };
  var CELULA = { lado: 6, vertical: 5 };
  var ESPACAMENTO_CAIXA_ALTA = { titulo: 0.4, secao: 0.6 };
  var ALTURA_LINHA = FONTE.celula * 1.22 * 1.15;   // uma linha de texto da célula (a fonte e o lineHeight do documento)
  var LETRA = 0.52;                                // a largura média de uma letra, em vezes a fonte (estimativa das linhas)
  var A4 = { largura: 595, altura: 842 };          // a folha em retrato (pontos)
  var FOLGA_INTEIRA = 120;                         // o que a folha leva além da tabela inteira (o título da seção, a ajuda...)
  var CAMPO_ROTULO = 150;                          // a coluna do rótulo no resumo (campos)

  function P() { return RW.escalasImpressaoPdf; }
  function txt() { return RW.mensagens.escala.impressao.pdf; }
  function dois(n) { return String(n).padStart(2, '0'); }

  /* larga: a folha em paisagem (as cópias da tela que pedem; os relatórios saem em retrato) */
  function pecas(c, larga) {
    var M = P().medidas.MARGENS;
    var largura = (larga ? A4.altura : A4.largura) - M[0] - M[2];
    /* até essa altura a tabela pode ir inteira para a folha seguinte; mais alta que a folha, o pdfmake some com ela */
    var alturaInteira = (larga ? A4.largura : A4.altura) - M[1] - M[3] - FOLGA_INTEIRA;
    var numero = 0;
    var linhasFinas = {
      hLineWidth: function (i) { return i === 0 ? 0 : LINHA.tabela; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return c.borda; },
      paddingLeft: function (i) { return i === 0 ? 0 : CELULA.lado; },
      paddingRight: function () { return CELULA.lado; },
      paddingTop: function () { return CELULA.vertical; },
      paddingBottom: function () { return CELULA.vertical; }
    };
    function linhasDe(t, l) { return typeof t !== 'string' || typeof l !== 'number' ? 1 : Math.max(1, Math.ceil(t.length * FONTE.celula * LETRA / l)); }
    return {
      largura: largura,
      alturaInteira: alturaInteira,
      numero: function () { return numero; },
      /* o título da seção (numerado pela ordem em que aparece) com o traço embaixo */
      secao: function (titulo) {
        numero++;
        return [
          { text: txt().secao(numero, titulo), bold: true, fontSize: FONTE.secao, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.secao, margin: MARGEM.secao },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: LINHA.secao, lineColor: c.forte }] }
        ];
      },
      ajuda: function (texto) { return { text: texto, fontSize: FONTE.ajuda, color: c.suave, margin: MARGEM.ajuda }; },
      topo: function (rotulo, valor, negrito) {
        return { stack: [{ text: rotulo, fontSize: FONTE.rotulo, color: c.suave }, { text: valor, fontSize: FONTE.valor, bold: !!negrito, color: c.forte }] };
      },
      /* o resumo: o rótulo em cinza e o valor */
      campos: function (lista) {
        return { table: { widths: [CAMPO_ROTULO, '*'], body: lista.map(function (x) {
          return [{ text: x[0], fontSize: FONTE.celula, color: c.suave }, { text: x[1], fontSize: FONTE.texto, color: c.forte }];
        }) }, layout: linhasFinas };
      },
      /* uma linha: a 1ª célula à esquerda, as outras no centro, todas descidas para o meio da altura da linha; a célula
         é um texto, uma lista de linhas ou { v, plano, negrito, junta } (plano = o texto simples do nome, para contar as
         linhas; junta = quantas colunas ela ocupa). jeito (opcional, as cópias da tela): { noAlto (todas no alto da
         linha), esquerda (quantas colunas à esquerda; o padrão é 1) }. A linha leva quantas linhas de texto a mais alta
         tem (linhas: a altura da tabela, em quadros) */
      linha: function (celulas, larguras, negrito, jeito) {
        var esquerda = (jeito && jeito.esquerda) || 1, noAlto = !!(jeito && jeito.noAlto);
        function valor(x) { return x && x.v !== undefined ? x.v : x; }
        var conta = celulas.map(function (x, i) {
          if (x === null) return 0;
          var v = valor(x);
          return Array.isArray(v) ? v.length : linhasDe(x && x.plano ? x.plano : v, larguras[i]);
        });
        var n = Math.max.apply(null, conta);
        var saida = celulas.map(function (x, i) {
          if (x === null) return {};
          var v = valor(x);
          var cel = { stack: (Array.isArray(v) ? v : [v]).map(function (t) { return typeof t === 'object' ? t : { text: t }; }),
            alignment: i < esquerda ? 'left' : 'center', fontSize: FONTE.celula, color: c.forte, bold: !!(negrito || (x && x.negrito)),
            margin: [0, noAlto ? 0 : (n - conta[i]) * ALTURA_LINHA / 2, 0, 0] };
          if (x && x.junta) cel.colSpan = x.junta;
          return cel;
        });
        saida.linhas = n;
        return saida;
      },
      /* esquerda: quantas colunas à esquerda (o padrão é 1); titulos null = sem a linha dos títulos das colunas */
      tabela: function (larguras, titulos, linhas, esquerda) {
        var cab = titulos ? [titulos.map(function (t, i) { return { text: t, bold: true, fontSize: FONTE.cabecalho, color: c.suave, alignment: i < (esquerda || 1) ? 'left' : 'center' }; })] : [];
        return { table: { headerRows: cab.length, dontBreakRows: true, widths: larguras, body: cab.concat(linhas) }, layout: linhasFinas };
      },
      /* a subseção (n.1, n.2...): o número e o nome em negrito, a cidade (opcional) em cinza */
      subsecao: function (n, u) {
        return { text: [{ text: n + '   ' + u.nome, bold: true }, { text: u.cidade ? '   ' + u.cidade : '', color: c.suave }],
          fontSize: FONTE.celula, color: c.forte, margin: MARGEM.subsecao };
      },
      /* a lista numerada das Observações (os itens em texto) */
      lista: function (itens) { return { ol: itens, fontSize: FONTE.celula, color: c.texto, margin: MARGEM.observacoes }; },
      /* as Observações com o título (não se separam) */
      observacoes: function (lista) {
        var t = this.secao(txt().observacoes);
        return { unbreakable: true, stack: t.concat([this.lista(lista)]) };
      }
    };
  }

  /* o alto do relatório: o título em caixa alta e a linha dos campos (topo: as colunas feitas com pecas().topo) */
  function cabecalho(titulo, topo, c) {
    return [
      { text: titulo, bold: true, fontSize: FONTE.titulo, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.titulo },
      { columns: topo, margin: MARGEM.cabecalho }
    ];
  }

  /* a folha: o alto (sem título, só o conteúdo, quando quem monta põe os altos) e o conteúdo; a URL e a página no pé;
     larga = em paisagem (as cópias da tela, extrajornada-tela-pdf.js) */
  function folha(titulo, topo, conteudo, c, larga) {
    var M = P().medidas, t = txt();
    return {
      pageSize: 'A4', pageOrientation: larga ? 'landscape' : 'portrait', pageMargins: M.MARGENS,
      defaultStyle: { font: 'Montserrat', fontSize: FONTE.celula, color: c.texto, lineHeight: 1.15 },
      info: { title: titulo || '', author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' },
      footer: function (pagina, total) {
        return { columns: [{ text: t.site }, { text: t.pagina(pagina, total), alignment: 'right' }], fontSize: M.FONTE.rodape, color: c.suave, margin: M.RODAPE_MARGEM };
      },
      content: (titulo ? cabecalho(titulo, topo, c) : []).concat(conteudo)
    };
  }

  /* a data e a hora de agora ("24/11/2026" e "20:39"), para o "Gerado em" */
  function agora() {
    var d = new Date();
    return { data: dois(d.getDate()) + '/' + dois(d.getMonth() + 1) + '/' + d.getFullYear(), hora: dois(d.getHours()) + ':' + dois(d.getMinutes()) };
  }

  RW.relatorioPdf = {
    pecas: pecas, cabecalho: cabecalho, folha: folha, agora: agora,
    medidas: { FONTE: FONTE, CELULA: CELULA, ALTURA_LINHA: ALTURA_LINHA }
  };
})();
