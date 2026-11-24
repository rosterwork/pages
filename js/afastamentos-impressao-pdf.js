/* ============================================================
   AFASTAMENTOS — a folha do Ano e do Mês
   (RosterWork.afastamentosImpressaoPdf.gerar)
   A grade da tela em A4 paisagem, no padrão dos PDFs da escala: a logo,
   "Afastamentos" e o período no alto; o site e "Página X de Y" no pé.
   Um bloco por unidade: o nome, a sigla e a cidade e a contagem no
   alto e a linha dos meses (Ano) ou dos dias (Mês: a sigla e o número,
   sábado e domingo sombreados); embaixo, uma linha por militar (posto,
   nome, CPF e os dias afastado no período, sem a autorização de
   viagem) e cada afastamento numa barra listrada com o nome e as datas
   (no Ano, as datas inteiras; o que fica num mês só, os dias); a
   autorização de viagem sem o listrado. Dois que se cruzam ficam um
   embaixo do outro. O nome da barra que não cabe sai cortado com "…"
   e as datas só quando cabem. O alto da unidade e a linha dos dias
   repetem na folha seguinte e o militar nunca se parte entre folhas
   (a linha dele é uma só: as faixas das barras ficam numa tabela por
   dentro, nas mesmas colunas). Página contínua: uma página só.
   As peças (biblioteca, cores, logo, desenho e o medidor do texto) são
   as do escalas-impressao-pdf.js e do escalas-impressao-grade-celula.js.
   Desenhado com a biblioteca do PDF (exceção REGRAS §3/§4): medidas
   em pontos nas constantes abaixo, cores --impressao-* do tema.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  /* medidas em pontos */
  var A4 = { largura: 841.89, altura: 595.28 };   // paisagem
  var LADO = 28, TOPO = 66, BASE = 36;            // margens da folha
  var CONTINUA = { topo: 20, base: 20 };          // margens da página contínua (logo e títulos vão no conteúdo)
  var CABECALHO = { logo: 74, topo: 20, titulo: 15, subtitulo: 9.5 };
  var MILITAR = 128;                               // a coluna do militar, com o respiro dos lados
  var RESPIRO = { militar: 5, dia: 1.5, alto: 5 };
  var LINHA = 0.5;
  var FONTE = { unidade: 9, sigla: 6.5, contagem: 6.5, diaSemana: 5, dia: 7.5, mes: 7, grad: 6.5, nome: 7.5, cpf: 5.5, total: 7,
    barra: 6.5, datas: 5.5 };
  var ALTURA = { faixa: 20, dias: 20, militar: 17 };   // a faixa de barras, a linha dos dias e o texto do militar (nome e CPF)
  var BARRA_TOPO = 2.5;                                // do alto da faixa ao nome da barra
  var ENTRE_UNIDADES = 12;
  var LISTRA = { boundingBox: [1, 1, 4, 4], xStep: 3, yStep: 3, pattern: '0.6 w 0 1 m 4 5 l s 2 0 m 5 3 l s' };

  function M() { return RW.mensagens.afastamentos; }
  function G() { return RW.afastamentosGrade; }
  function txt() { return RW.mensagens.escala.impressao.pdf; }
  function celula() { return RW.escalasImpressaoGradeCelula; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- o texto que cabe ---------- */
  /* a largura do texto na fonte do PDF (o medidor da célula das grades); sem ele, uma conta aproximada */
  function largura(texto, tamanho, negrito) {
    var medida = celula() && celula().medirTexto ? celula().medirTexto(texto, tamanho, negrito) : null;
    return medida == null ? texto.length * tamanho * 0.6 : medida;
  }
  /* inteiro ou cortado com "…"; vazio se nem a primeira letra cabe */
  function queCabe(texto, tamanho, negrito, livre) {
    if (largura(texto, tamanho, negrito) <= livre) return texto;
    for (var n = texto.length - 1; n > 0; n--) {
      var cortado = texto.slice(0, n).replace(/[\s.]+$/, '') + '…';
      if (largura(cortado, tamanho, negrito) <= livre) return cortado;
    }
    return '';
  }

  /* ---------- o período ---------- */
  function periodoDe(cfg) {
    if (cfg.aba === 'ano') return { inicio: cfg.ano + '-01-01', fim: cfg.ano + '-12-31' };
    var prefixo = cfg.ano + '-' + p2(cfg.mes + 1) + '-';
    return { inicio: prefixo + '01', fim: prefixo + p2(new Date(cfg.ano, cfg.mes + 1, 0).getDate()) };
  }

  /* as colunas: no Ano os meses; no Mês os dias, com o fim de semana */
  function colunas(cfg) {
    var lista = [];
    if (cfg.aba === 'ano') {
      M().meses.forEach(function (nome) { lista.push({ mes: nome, fds: false }); });
      return lista;
    }
    var n = new Date(cfg.ano, cfg.mes + 1, 0).getDate();
    for (var d = 1; d <= n; d++) {
      var s = new Date(cfg.ano, cfg.mes, d).getDay();
      lista.push({ sigla: SEMANA[s], numero: d, fds: s === 0 || s === 6 });
    }
    return lista;
  }

  /* a largura de cada coluna do período (a de fora, com o respiro e a linha; a tabela de dentro das faixas tem a mesma) */
  function geometria(n) {
    var util = A4.largura - 2 * LADO;
    var coluna = (util - MILITAR - 2 * LINHA) / n;
    var fora = [MILITAR - 2 * RESPIRO.militar];
    var dentro = [];
    for (var i = 0; i < n; i++) { fora.push(coluna); dentro.push(coluna - 2 * RESPIRO.dia - LINHA); }
    return { coluna: coluna, fora: fora, dentro: dentro };
  }

  /* as barras do militar (de e ate contam as colunas a partir de 1), cada uma na primeira faixa em que não cruza com a
     de antes, como na tela */
  function barras(cfg, afastamentos) {
    var ini = cfg.periodo.inicio, fim = cfg.periodo.fim;
    var lista = afastamentos.map(function (af) {
      var de = af.inicio > ini ? af.inicio : ini, ate = af.fim < fim ? af.fim : fim;
      if (cfg.aba === 'ano') {
        var datas = af.inicio.slice(0, 7) === af.fim.slice(0, 7)
          ? M().diasDoMes(af.inicio.slice(8, 10), af.fim.slice(8, 10)) : G().textoDatas(af.inicio, af.fim, cfg.ano);
        return { af: af, de: Number(de.slice(5, 7)), ate: Number(ate.slice(5, 7)), datas: datas };
      }
      return { af: af, de: Number(de.slice(8, 10)), ate: Number(ate.slice(8, 10)), datas: M().diasDoMes(de.slice(8, 10), ate.slice(8, 10)) };
    }).filter(function (b) { return b.ate >= b.de; }).sort(function (a, b) { return a.de - b.de; });
    var fins = [];
    lista.forEach(function (b) {
      var f = 0;
      while (fins[f] !== undefined && fins[f] >= b.de) f++;
      fins[f] = b.ate;
      b.faixa = f;
    });
    return { lista: lista, faixas: Math.max(1, fins.length) };
  }

  /* ---------- as peças ---------- */
  /* a tabela de dentro, nas colunas do período: a linha dos dias ou as faixas de barras de um militar. linhas = [[célula
     ou {} de colSpan]], fds = o sombreado de cada célula vazia */
  function tabelaDentro(geo, linhas, altura, fundo, c) {
    return {
      table: { widths: geo.dentro, body: linhas, heights: altura },
      layout: {
        hLineWidth: function () { return 0; },
        vLineWidth: function (i) { return i === 0 ? 0 : LINHA; },
        vLineColor: function () { return c.borda; },
        paddingLeft: function () { return RESPIRO.dia; },
        paddingRight: function () { return RESPIRO.dia; },
        paddingTop: function () { return 0; },
        paddingBottom: function () { return 0; },
        fillColor: function (i, no, col) {
          var cel = no.table.body[i][col];
          if (fundo) return fundo;
          return cel && cel.fds ? c.fds : null;
        }
      }
    };
  }

  /* a linha dos meses ou dos dias */
  function linhaDosDias(cfg, cols, geo, c) {
    var linha = cols.map(function (col) {
      if (cfg.aba === 'ano') return { text: col.mes, bold: true, fontSize: FONTE.mes, color: c.forte, alignment: 'center', margin: [0, 6, 0, 0] };
      return { stack: [
        { text: col.sigla.toLocaleUpperCase('pt-BR'), fontSize: FONTE.diaSemana, color: c.suave, characterSpacing: 0.3 },
        { text: String(col.numero), bold: true, fontSize: FONTE.dia, color: c.forte }
      ], alignment: 'center', margin: [0, 2, 0, 0] };
    });
    return tabelaDentro(geo, [linha], ALTURA.dias, c.fundo, c);
  }

  /* uma barra: o nome (cortado com "…" se não cabe) e as datas, só se cabem; a autorização de viagem sem o listrado */
  function celulaBarra(b, geo, c) {
    var span = b.ate - b.de + 1;
    var livre = span * geo.coluna - 2 * RESPIRO.dia - LINHA - 1;
    var linhas = [{ text: queCabe(b.af.nome || '', FONTE.barra, true, livre) || ' ', bold: true, fontSize: FONTE.barra, color: c.forte }];
    if (largura(b.datas, FONTE.datas, false) <= livre) linhas.push({ text: b.datas, fontSize: FONTE.datas, color: c.texto });
    return { colSpan: span, stack: linhas, margin: [0, BARRA_TOPO, 0, 0],
      fillColor: G().afastado(b.af) ? ['listra', c.listra] : c.papel };
  }

  /* as faixas de barras do militar, numa tabela de dentro */
  function faixasDoMilitar(r, cols, geo, c) {
    var linhas = [];
    for (var f = 0; f < r.faixas; f++) {
      var linha = [];
      for (var col = 1; col <= cols.length; col++) {
        var b = r.lista.filter(function (x) { return x.faixa === f && x.de === col; })[0];
        if (!b) { linha.push({ text: '', fds: cols[col - 1].fds }); continue; }
        linha.push(celulaBarra(b, geo, c));
        for (var s = b.de; s < b.ate; s++) linha.push({});
        col = b.ate;
      }
      linhas.push(linha);
    }
    return tabelaDentro(geo, linhas, ALTURA.faixa, null, c);
  }

  /* a coluna do militar: posto e nome, o CPF e os dias afastado, no meio da altura das faixas */
  function celulaMilitar(p, total, faixas, c) {
    var cpf = String(p.usuario_id || '');
    if (cpf.length === 11) cpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return {
      columns: [
        { stack: [
          { text: [{ text: (p.grau_abreviacao || '') + ' ', fontSize: FONTE.grad, color: c.suave },
            { text: p.nome_de_guerra || '', bold: true, fontSize: FONTE.nome, color: c.forte }] },
          { text: cpf, fontSize: FONTE.cpf, color: c.suave, margin: [0, 1, 0, 0] }
        ], width: '*' },
        { text: total ? String(total) : '', bold: true, fontSize: FONTE.total, color: c.texto, width: 'auto', margin: [0, 3, 0, 0] }
      ],
      margin: [0, Math.max(1.5, (faixas * ALTURA.faixa - ALTURA.militar) / 2), 0, 0]
    };
  }

  /* a unidade: o alto (nome, sigla e cidade, contagem) e a linha dos dias, que repetem em cada folha, e uma linha por
     militar (a linha nunca se parte) */
  function tabelaUnidade(cfg, u, geo, cols, c) {
    var n = cols.length;
    function vazias(k) { var l = []; for (var i = 0; i < k; i++) l.push({}); return l; }
    var corpo = [];
    corpo.push([{
      colSpan: n + 1,
      columns: [
        { stack: [
          { text: u.unidade.nome_completo || u.unidade.nome || '', bold: true, fontSize: FONTE.unidade, color: c.forte },
          { text: (u.unidade.nome || '') + (u.unidade.cidade ? ' · ' + u.unidade.cidade : ''), fontSize: FONTE.sigla, color: c.suave, margin: [0, 1, 0, 0] }
        ], width: '*' },
        { text: u.contagem || '', fontSize: FONTE.contagem, color: c.suave, width: 'auto', noWrap: true, margin: [0, 3, RESPIRO.militar, 0] }
      ]
    }].concat(vazias(n)));
    corpo.push([{ text: '' }, Object.assign({ colSpan: n }, linhaDosDias(cfg, cols, geo, c))].concat(vazias(n - 1)));
    u.pessoas.forEach(function (item) {
      var r = barras(cfg, item.afastamentos);
      var total = G().diasNoPeriodo(item.afastamentos.filter(G().afastado), cfg.periodo.inicio, cfg.periodo.fim);
      corpo.push([celulaMilitar(item.pessoa, total, r.faixas, c), Object.assign({ colSpan: n }, faixasDoMilitar(r, cols, geo, c))].concat(vazias(n - 1)));
    });
    var ultima = corpo.length;
    return {
      table: { widths: geo.fora, headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, body: corpo },
      layout: {
        hLineWidth: function (i) { return i >= 2 && i <= ultima ? LINHA : 0; },
        vLineWidth: function (i) { return i <= 1 ? LINHA : 0; },
        hLineColor: function () { return c.borda; },
        vLineColor: function (i, no, linha) { return linha === 0 ? c.fundo : c.borda; },
        paddingLeft: function (i) { return i === 0 ? RESPIRO.militar : 0; },
        paddingRight: function (i) { return i === 0 ? RESPIRO.militar : 0; },
        paddingTop: function (i) { return i === 0 ? RESPIRO.alto : 0; },
        paddingBottom: function (i) { return i === 0 ? RESPIRO.alto : 0; },
        fillColor: function (i) { return i <= 1 ? c.fundo : null; }
      },
      margin: [0, 0, 0, ENTRE_UNIDADES]
    };
  }

  /* o alto da folha: a logo, o título e a grade com o período */
  function cabecalho(cfg, c) {
    return { columns: [
      { svg: c.logo, width: CABECALHO.logo },
      { stack: [
        { text: M().impressao.titulo, bold: true, fontSize: CABECALHO.titulo, color: c.forte },
        { text: cfg.nome + ' · ' + cfg.texto, fontSize: CABECALHO.subtitulo, color: c.suave, margin: [0, 2, 0, 0] }
      ], alignment: 'right' }
    ] };
  }

  /* cfg: { aba ('ano' | 'mes'), ano, mes, continua, texto (o período: "dezembro de 2026" ou "2026"), nome (a grade: "Mês"
     ou "Ano"), unidades: [{ unidade, contagem, pessoas: [{ pessoa, afastamentos }] }] } → { arquivo, folhas } */
  function gerar(cfg) {
    var pdf = RW.escalasImpressaoPdf;
    cfg.periodo = periodoDe(cfg);
    return pdf.preparar().then(function (c) {
      return celula().preparar(c);
    }).then(function (c) {
      c.listra = pdf.cor('--impressao-listra');
      c.fds = pdf.cor('--impressao-fundo');
      var cols = colunas(cfg);
      var geo = geometria(cols.length);
      var conteudo = cfg.unidades.map(function (u) { return tabelaUnidade(cfg, u, geo, cols, c); });
      var rodape = pdf.medidas.FONTE.rodape;
      var doc = {
        defaultStyle: { font: 'Montserrat', fontSize: 8, color: c.texto },
        patterns: { listra: LISTRA },
        info: { title: M().impressao.titulo + ' · ' + cfg.nome + ' · ' + cfg.texto, author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' }
      };
      if (cfg.continua) {
        doc.pageSize = { width: A4.largura, height: 'auto' };
        doc.pageMargins = [LADO, CONTINUA.topo, LADO, CONTINUA.base];
        var topo = cabecalho(cfg, c);
        topo.margin = [0, 0, 0, 12];
        doc.content = [topo].concat(conteudo, [{ text: txt().site, fontSize: rodape, color: c.suave, margin: [0, 8, 0, 0] }]);
      } else {
        doc.pageSize = 'A4';
        doc.pageOrientation = 'landscape';
        doc.pageMargins = [LADO, TOPO, LADO, BASE];
        doc.header = function () {
          var topoFolha = cabecalho(cfg, c);
          topoFolha.margin = [LADO, CABECALHO.topo, LADO, 0];
          return topoFolha;
        };
        doc.footer = function (pagina, total) {
          return { columns: [{ text: txt().site }, { text: txt().pagina(pagina, total), alignment: 'right' }],
            fontSize: rodape, color: c.suave, margin: [LADO, 14, LADO, 0] };
        };
        doc.content = conteudo;
      }
      return pdf.desenhar(doc, c, []);
    }).then(function (d) {
      return { arquivo: d.arquivo, folhas: (d.caixas || []).length };
    });
  }

  RW.afastamentosImpressaoPdf = { gerar: gerar };
})();
