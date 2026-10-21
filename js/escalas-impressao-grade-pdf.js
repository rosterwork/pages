/* ============================================================
   ESCALAS — PDF das grades (Agenda, Calendário, Colunas)
   Monta o PDF que o painel das grades pede (escalas-impressao-grade.js),
   no formato da tela e no padrão de blocos do PDF do Dia: a logo, o
   título e o período no alto; o site e "Página X de Y" no pé.
   - Calendário e Colunas › Dias (A4 paisagem): uma linha por semana
     (ou de N dias), cada dia um bloco cinza com o número e, embaixo,
     uma célula por unidade. A linha nunca se parte: a que não cabe vai
     inteira para a folha seguinte. A que é maior que uma folha quebra
     entre unidades (a célula nunca se parte) e a folha seguinte repete
     os dias com "(continuação)".
   - Agenda e Colunas › Unidades (A4 retrato): um dia por faixa, as
     unidades lado a lado (até 4; com mais, os dias se repetem com o
     grupo seguinte); o dia nunca se parte e os nomes das unidades se
     repetem no alto de cada folha.
   - Página contínua: uma página só, na largura da A4, da altura do
     conteúdo, sem quebras.
   Quebra das linhas do calendário, em passadas conferidas (como no PDF
   do Dia; nunca perde ninguém): 1) mede, cada linha numa folha própria,
   em que folha caiu cada unidade; 2) monta: a que cabe numa folha vai
   inteira (passa para a seguinte se não couber no resto), a maior é
   partida nas unidades medidas; 3) confere que todas as células saíram
   (o nome da unidade de cada uma, em ordem); se algo não bate, fica o
   jeito simples (a linha quebra livre entre unidades).
   A célula vem do escalas-impressao-grade-celula.js; a biblioteca, as
   cores, os blocos arredondados e o download, do escalas-impressao-pdf.js.
   Cantos arredondados como no PDF do Dia: o desenho de cantos retos é
   refeito com os blocos na camada de fundo; se o texto não cair no
   mesmo lugar, fica o de cantos retos.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  /* medidas em pontos */
  var A4 = { largura: 595.28, altura: 841.89 };
  var LADO = 28;                                  // margem dos lados
  var TOPO = 66, TOPO_COM_DIAS = 78, BASE = 36;   // margens de cima (com a linha dom…sáb no calendário) e de baixo
  var CONTINUA = { topo: 20, base: 20 };          // margens da página contínua (logo e títulos vão no conteúdo)
  var LIMITE_CONTINUA = 14400;                    // altura máxima de página que os leitores de PDF abrem
  var CABECALHO = { logo: 74, topo: 20, titulo: 15, subtitulo: 9.5, dias: 6.5 };
  var DIA = { numero: 8, sigla: 6, vao: 4, lado: 2.5, topo: 3, entre: 1.25, base: 2.5 };
  var AGENDA = { data: 28, vao: 3, lado: 2.5, topo: 2.5, base: 2.5, numero: 10, sigla: 6, unidade: 6.5, entreDias: 5, porGrupo: 4 };
  var ESPACO = { entreLinhas: 5, entreGrupos: 12 };
  var ESPACAMENTO_CAIXA_ALTA = 0.6;

  function txt() { return RW.mensagens.escala.impressao.pdf; }
  function msg() { return RW.mensagens.escala.impressao.grade; }
  function celula() { return RW.escalasImpressaoGradeCelula; }
  function semLinha() { return 0; }
  function iso(d) { return RW.data.paraIsoDeData(d); }

  /* ---------- o que vai em cada célula ---------- */
  /* quem aparece no dia (de serviço e, com o filtro Afastamentos, os afastados), pelos filtros da tela */
  function pessoasDoDia(dados, uid, dia) {
    var passa = RW.escalasFiltros ? RW.escalasFiltros.passaPessoa : function (p) { return p.origem !== 'afastamento'; };
    var lista = ((dados.militares[uid] || {})[dia] || []).concat((dados.afastados[uid] || {})[dia] || []);
    return lista.filter(passa);
  }

  function blocoDoDia(cfg, c, u, dia, largura, preencher, comNome) {
    var uid = u.unidade_id;
    return celula().bloco({
      largura: largura,
      unidade: comNome ? u.nome : null,
      cobertura: (cfg.dados.cobertura[uid] || {})[dia] || null,
      erro: (cfg.dados.erro[uid] || {})[dia] || null,
      max: cfg.max[uid],
      pessoas: pessoasDoDia(cfg.dados, uid, dia),
      mostrar: cfg.mostrar,
      c: c,
      preencher: preencher
    });
  }

  /* o nome da unidade como sai no alto da célula (é o marcador que diz em que folha a célula caiu) */
  function nomeNaCelula(u) { return u.nome.toLocaleUpperCase('pt-BR'); }

  /* ---------- calendário (Calendário e Colunas › Dias) ---------- */
  /* o número do dia; no Colunas, com a sigla; o dia de fora do período, apagado */
  function numeroDoDia(cfg, c, d, continuacao) {
    var partes = [];
    if (cfg.formato !== 'calendario') partes.push({ text: DIAS[d.data.getDay()].toLocaleUpperCase('pt-BR') + ' ', fontSize: DIA.sigla, color: c.suave, characterSpacing: ESPACAMENTO_CAIXA_ALTA });
    partes.push({ text: String(d.data.getDate()), fontSize: DIA.numero, bold: true, color: d.fora ? c.suave : c.forte });
    if (continuacao) partes.push({ text: '  ' + txt().continuacao, fontSize: DIA.sigla, color: c.suave });
    return { text: partes };
  }

  /* uma linha do calendário (os dias e, por unidade, as células); so = as unidades desta parte (a linha
     maior que uma folha sai em partes); continuacao = a parte não é a primeira. Põe em marcadores, em
     ordem, o nome da unidade de cada célula */
  function linhaCalendario(cfg, c, geo, linha, indice, so, continuacao, preencher, marcadores) {
    var corpo = [], cabecalho = [];
    linha.forEach(function (d, col) {
      if (col > 0) cabecalho.push('');
      cabecalho.push(numeroDoDia(cfg, c, d, continuacao && col === 0));
    });
    corpo.push(cabecalho);
    so.forEach(function (k) {
      var u = cfg.unidades[k];
      var fila = [];
      linha.forEach(function (d, col) {
        if (col > 0) fila.push('');
        if (d.fora) { fila.push(''); return; }
        fila.push(blocoDoDia(cfg, c, u, iso(d.data), geo.dia, preencher, true));
        marcadores.push({ texto: nomeNaCelula(u), linha: indice, unidade: k });
      });
      corpo.push(fila);
    });
    var ultima = corpo.length - 1;
    return {
      table: { widths: geo.larguras, body: corpo, headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true },
      layout: {
        hLineWidth: semLinha,
        vLineWidth: semLinha,
        paddingLeft: function (i) { return i % 2 === 0 ? DIA.lado : 0; },
        paddingRight: function (i) { return i % 2 === 0 ? DIA.lado : 0; },
        paddingTop: function (i) { return i === 0 ? DIA.topo : DIA.entre; },
        paddingBottom: function (i) { return i === ultima ? DIA.base : DIA.entre; },
        /* o dia de fora do período (Colunas › Dias) fica sem o bloco cinza, só com o número apagado */
        fillColor: function (i, no, col) { return preencher && col % 2 === 0 && !linha[col / 2].fora ? c.fundo : null; }
      }
    };
  }

  function linhasDoPeriodo(cfg) {
    var n = cfg.formato === 'calendario' ? 7 : cfg.diasPorLinha;
    var linhas = [];
    for (var i = 0; i < cfg.dias.length; i += n) linhas.push(cfg.dias.slice(i, i + n));
    return { n: n, linhas: linhas };
  }

  /* o conteúdo do calendário, conforme o plano:
     medir   = cada linha numa folha própria (quebra livre, para ver em que folha caiu cada unidade);
     montar  = a linha que cabe, inteira (passa para a folha seguinte se não couber no resto); a maior,
               nas partes medidas (plano.partes), cada uma inteira e a partir da 2ª numa folha nova;
     simples = quebra livre entre unidades (o desenho que nunca perde ninguém) */
  function conteudoCalendario(cfg, c, geo, plano, marcadores) {
    var todas = cfg.unidades.map(function (u, k) { return k; });
    var conteudo = [];
    geo.periodo.linhas.forEach(function (linha, indice) {
      var pedacos = (plano.modo === 'montar' && plano.partes[indice]) || [todas];
      pedacos.forEach(function (so, p) {
        var no = { stack: [linhaCalendario(cfg, c, geo, linha, indice, so, p > 0, plano.preencher, marcadores)], margin: [0, 0, 0, ESPACO.entreLinhas] };
        if (plano.modo === 'montar') no.unbreakable = true;
        if ((plano.modo === 'medir' && indice > 0) || p > 0) no.pageBreak = 'before';
        conteudo.push(no);
      });
    });
    return conteudo;
  }

  /* as partes de cada linha maior que uma folha, pela folha em que caiu cada unidade ao medir:
     { índice da linha: [[unidades da parte 1], [da parte 2], ...] } */
  function partesPelaFolha(marcadores, folhas) {
    var porLinha = {};
    marcadores.forEach(function (m, i) {
      var l = porLinha[m.linha] = porLinha[m.linha] || {};
      if (l[m.unidade] == null) l[m.unidade] = folhas[i];   // a folha da 1ª célula da unidade
    });
    var partes = {};
    Object.keys(porLinha).forEach(function (linha) {
      var pedacos = [], anterior = null;
      Object.keys(porLinha[linha]).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
        var folha = porLinha[linha][k];
        if (!pedacos.length || folha !== anterior) pedacos.push([]);
        pedacos[pedacos.length - 1].push(k);
        anterior = folha;
      });
      partes[linha] = pedacos.length > 1 ? pedacos : null;
    });
    return partes;
  }

  /* a linha dom…sáb no alto de cada folha do calendário (no Colunas › Dias, cada dia traz a sigla) */
  function linhaDosDias(c, geo) {
    var linha = [];
    DIAS.forEach(function (d, i) {
      if (i > 0) linha.push('');
      linha.push({ text: d.toLocaleUpperCase('pt-BR'), alignment: 'center', bold: true, fontSize: CABECALHO.dias, characterSpacing: 0.8, color: c.suave });
    });
    return {
      table: { widths: geo.larguras, body: [linha] },
      layout: {
        hLineWidth: semLinha,
        vLineWidth: semLinha,
        paddingLeft: function (i) { return i % 2 === 0 ? DIA.lado : 0; },
        paddingRight: function (i) { return i % 2 === 0 ? DIA.lado : 0; },
        paddingTop: semLinha,
        paddingBottom: semLinha
      },
      margin: [0, 6, 0, 4]
    };
  }

  /* ---------- agenda (Agenda e Colunas › Unidades) ---------- */
  function conteudoAgenda(cfg, c, geo, preencher) {
    var grupos = [];
    for (var g = 0; g < cfg.unidades.length; g += AGENDA.porGrupo) grupos.push(cfg.unidades.slice(g, g + AGENDA.porGrupo));
    return grupos.map(function (grupo, gi) {
      var m = grupo.length;
      var largura = (geo.largura - AGENDA.data - m * AGENDA.vao - 2 * AGENDA.lado) / m;
      var larguras = [AGENDA.data];
      grupo.forEach(function () { larguras.push(AGENDA.vao, largura); });
      /* nomes das unidades no alto (repetem em cada folha); depois, por dia, a faixa e o vão até o próximo */
      var cabecalho = [''];
      grupo.forEach(function (u) {
        cabecalho.push('', { text: u.nome.toLocaleUpperCase('pt-BR'), bold: true, fontSize: AGENDA.unidade, characterSpacing: ESPACAMENTO_CAIXA_ALTA, color: c.suave });
      });
      var corpo = [cabecalho], tipos = ['cabecalho'];
      cfg.dias.forEach(function (d, i) {
        if (i > 0) {
          corpo.push(larguras.map(function () { return { text: '', fontSize: 1 }; }));
          tipos.push('vao');
        }
        var dia = iso(d.data);
        var fila = [{ stack: [
          { text: DIAS[d.data.getDay()].toLocaleUpperCase('pt-BR'), fontSize: AGENDA.sigla, color: c.suave, characterSpacing: ESPACAMENTO_CAIXA_ALTA },
          { text: String(d.data.getDate()), fontSize: AGENDA.numero, bold: true, color: c.forte }
        ], alignment: 'center' }];
        grupo.forEach(function (u) { fila.push('', blocoDoDia(cfg, c, u, dia, largura, preencher, false)); });
        corpo.push(fila);
        tipos.push('dia');
      });
      var ultima = larguras.length - 1;
      var no = {
        table: { widths: larguras, body: corpo, headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true },
        layout: {
          hLineWidth: semLinha,
          vLineWidth: semLinha,
          paddingLeft: function (i) { return i === 0 ? AGENDA.lado : 0; },
          paddingRight: function (i) { return i === ultima ? AGENDA.lado : 0; },
          paddingTop: function (i) { return tipos[i] === 'dia' ? AGENDA.topo : (tipos[i] === 'vao' ? AGENDA.entreDias / 2 - 0.6 : 0); },
          paddingBottom: function (i) { return tipos[i] === 'dia' ? AGENDA.base : (tipos[i] === 'vao' ? AGENDA.entreDias / 2 - 0.6 : 4); },
          fillColor: function (i) { return preencher && tipos[i] === 'dia' ? c.fundo : null; }
        }
      };
      if (gi > 0) {
        if (cfg.continua) no.margin = [0, ESPACO.entreGrupos, 0, 0];
        else no.pageBreak = 'before';
      }
      return no;
    });
  }

  /* ---------- documento ---------- */
  function cabecalho(cfg, c) {
    return { columns: [
      { svg: c.logo, width: CABECALHO.logo },
      { stack: [
        { text: txt().titulo, bold: true, fontSize: CABECALHO.titulo, color: c.forte },
        { text: msg().nomes[cfg.formato] + ' · ' + cfg.texto, fontSize: CABECALHO.subtitulo, color: c.suave, margin: [0, 2, 0, 0] }
      ], alignment: 'right' }
    ] };
  }

  /* a geometria da folha: larguras do conteúdo e, no calendário, das colunas dos dias (com os vãos).
     A largura de cada coluna é a de dentro: a biblioteca soma o respiro (DIA.lado) dos dois lados */
  function geometria(cfg) {
    var largura = (cfg.paisagem ? A4.altura : A4.largura) - 2 * LADO;
    var geo = { largura: largura, paginaLargura: largura + 2 * LADO };
    if (cfg.formato === 'calendario' || cfg.formato === 'colunas-dias') {
      geo.periodo = linhasDoPeriodo(cfg);
      var n = geo.periodo.n;
      geo.dia = (largura - (n - 1) * DIA.vao) / n - 2 * DIA.lado;
      geo.larguras = [];
      for (var i = 0; i < n; i++) { if (i > 0) geo.larguras.push(DIA.vao); geo.larguras.push(geo.dia); }
    }
    return geo;
  }

  /* plano: { modo ('medir' | 'montar' | 'simples'), preencher, partes, caixas (os blocos arredondados por folha) }
     → { doc, marcadores } */
  function montarDocumento(cfg, c, geo, plano) {
    var calendario = !!geo.periodo;
    var comDias = cfg.formato === 'calendario';
    var marcadores = [];
    var conteudo = calendario ? conteudoCalendario(cfg, c, geo, plano, marcadores) : conteudoAgenda(cfg, c, geo, plano.preencher);
    var doc = {
      defaultStyle: { font: 'Montserrat', fontSize: 9, color: c.texto },
      info: { title: txt().titulo + ' · ' + msg().nomes[cfg.formato] + ' · ' + cfg.texto, author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' }
    };
    if (cfg.continua) {
      doc.pageSize = { width: geo.paginaLargura, height: 'auto' };
      doc.pageMargins = [LADO, CONTINUA.topo, LADO, CONTINUA.base];
      var topo = [cabecalho(cfg, c)];
      topo[0].margin = [0, 0, 0, 12];
      if (comDias) topo.push(linhaDosDias(c, geo));
      doc.content = topo.concat(conteudo, [{ text: txt().site, fontSize: RW.escalasImpressaoPdf.medidas.FONTE.rodape, color: c.suave, margin: [0, 8, 0, 0] }]);
    } else {
      doc.pageSize = 'A4';
      doc.pageOrientation = cfg.paisagem ? 'landscape' : 'portrait';
      var margemTopo = comDias ? TOPO_COM_DIAS : TOPO;
      doc.pageMargins = [LADO, margemTopo, LADO, BASE];
      doc.header = function () {
        var topoFolha = cabecalho(cfg, c);
        if (!comDias) { topoFolha.margin = [LADO, CABECALHO.topo, LADO, 0]; return topoFolha; }
        return { stack: [topoFolha, linhaDosDias(c, geo)], margin: [LADO, CABECALHO.topo, LADO, 0] };
      };
      doc.footer = function (pagina, total) {
        return { columns: [{ text: txt().site }, { text: txt().pagina(pagina, total), alignment: 'right' }],
          fontSize: RW.escalasImpressaoPdf.medidas.FONTE.rodape, color: c.suave, margin: [LADO, 14, LADO, 0] };
      };
      doc.content = conteudo;
    }
    if (plano.caixas) doc.background = function (folha) { return RW.escalasImpressaoPdf.blocosArredondados(plano.caixas[folha - 1], c); };
    return { doc: doc, marcadores: marcadores };
  }

  /* as passadas → o arquivo. Calendário em folhas: mede, monta com as linhas inteiras (as maiores que
     uma folha partidas nas unidades medidas) e confere que todas as células saíram; se algo não bate,
     fica o jeito simples. Agenda e página contínua: o simples (a faixa do dia nunca se parte).
     Por fim, redesenha com os cantos arredondados, se o texto cair no mesmo lugar */
  function desenharArquivo(cfg, c) {
    var pdf = RW.escalasImpressaoPdf;
    var geo = geometria(cfg);
    function desenharPlano(plano) {
      var m = montarDocumento(cfg, c, geo, plano);
      return pdf.desenhar(m.doc, c, m.marcadores).then(function (d) { return { plano: plano, desenho: d }; });
    }
    function simples() { return desenharPlano({ modo: 'simples', preencher: true }); }
    var escolhido;
    if (!geo.periodo || cfg.continua) {
      escolhido = simples();
    } else {
      escolhido = desenharPlano({ modo: 'medir', preencher: true }).then(function (medido) {
        if (!medido.desenho.folhas) return simples();
        var partes = partesPelaFolha(medido.desenho.marcadores, medido.desenho.folhas);
        return desenharPlano({ modo: 'montar', preencher: true, partes: partes }).then(function (montado) {
          return montado.desenho.folhas ? montado : simples();
        });
      });
    }
    return escolhido.then(function (e) {
      if (cfg.continua && alturaDoDesenho(e.desenho) > LIMITE_CONTINUA) throw { longaDemais: true };
      var plano = { modo: e.plano.modo, partes: e.plano.partes, preencher: false, caixas: e.desenho.caixas };
      return desenharPlano(plano).then(function (r) {
        return r.desenho.assinatura === e.desenho.assinatura ? r.desenho : e.desenho;
      }, function () { return e.desenho; });
    });
  }

  /* a altura do que foi desenhado na página contínua (o fim do último bloco) */
  function alturaDoDesenho(d) {
    var fim = 0;
    (d.caixas || []).forEach(function (folha) { folha.cinza.forEach(function (b) { if (b.y2 > fim) fim = b.y2; }); });
    return fim + CONTINUA.base;
  }

  /* "27-09 a 31-10-2026" (o primeiro e o último dia que saem) */
  function periodoDoArquivo(cfg) {
    var dentro = cfg.dias.filter(function (d) { return !d.fora; });
    var a = iso(dentro[0].data), b = iso(dentro[dentro.length - 1].data);
    function curta(x) { return x.slice(8, 10) + '-' + x.slice(5, 7); }
    if (a === b) return curta(a) + '-' + a.slice(0, 4);
    return a.slice(0, 4) === b.slice(0, 4) ? curta(a) + ' a ' + curta(b) + '-' + b.slice(0, 4) : curta(a) + '-' + a.slice(0, 4) + ' a ' + curta(b) + '-' + b.slice(0, 4);
  }

  /* cfg: { formato, paisagem, continua, mostrar, diasPorLinha, unidades, dias: [{data, fora}], texto, dados }
     → { arquivo, folhas, nome } */
  function gerar(cfg) {
    var ids = cfg.unidades.map(function (u) { return u.unidade_id; });
    cfg.max = RW.escalasCelula ? RW.escalasCelula.calcularMaxPorUnidade(cfg.dados.cobertura, ids) : {};
    return RW.escalasImpressaoPdf.preparar().then(function (c) {
      return celula().preparar(c);
    }).then(function (c) {
      return desenharArquivo(cfg, c);
    }).then(function (d) {
      return {
        arquivo: d.arquivo,
        folhas: (d.caixas || []).length,
        nome: msg().arquivo(msg().nomes[cfg.formato], periodoDoArquivo(cfg), cfg.unidades.length === 1 ? cfg.unidades[0].nome : '')
      };
    });
  }

  RW.escalasImpressaoGradePdf = { gerar: gerar };
})();
