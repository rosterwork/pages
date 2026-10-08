/* ============================================================
   ESCALAS — PDF da escala (biblioteca pdfmake, carregada só aqui)
   Monta e baixa o PDF que o painel "Imprimir escala" pede: uma
   folha por dia, as unidades em sequência, só a logo no alto e o
   site + "Página X de Y" no rodapé. O conteúdo é o do modo Dia
   (postos, funções, militares, horários, sem função, observações),
   no padrão de blocos (MANUAL §11): a unidade é um bloco cinza com o
   título dentro e cada posto um bloquinho branco com contorno fino.
   O PDF é desenhado aqui, como o canvas do gráfico (exceção REGRAS
   §3/§4): cores lidas do tema (--impressao-*), medidas em pontos
   (A4 = 595 × 842) nas constantes abaixo.
   Quebra de folha, em passadas (nunca perde ninguém):
     1) mede: só as unidades que, pela altura estimada, podem passar
        de uma folha, cada uma numa folha própria; a que passa é
        "grande" (no caso comum não há nenhuma e não se mede nada);
     2) monta: a pequena nunca se divide (vai inteira para a folha
        seguinte); a grande quebra só entre postos, com o título
        repetido; lê em que folha cada posto caiu;
     3) final: a grande é cortada nesses pontos e a folha seguinte
        ganha "(continuação)" e a data.
   Cada desenho é conferido (todo posto saiu, no lugar certo) e o
   desenho conferido é o próprio arquivo; se algo não bate, fica o
   anterior, e no último caso o jeito simples (quebra livre).
   Cantos arredondados (a biblioteca não arredonda tabela): os desenhos
   acima pintam os blocos com fundo quadrado; o escolhido é redesenhado
   sem esses fundos e com os blocos arredondados na camada de fundo de
   cada folha, nas posições lidas dele. O texto tem de cair no mesmo
   lugar; se não cair, fica o desenho de cantos retos.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var BIBLIOTECA = 'bibliotecas/pdfmake.min.js';
  var FONTE_NORMAL = 'fontes/montserrat-400.woff';
  var FONTE_NEGRITO = 'fontes/montserrat-600.woff';
  var ICONE_LOGO = 'icones/icone-logo.svg';
  var ICONE_SETA = 'icones/icone-seta-direita-longa.svg';

  /* medidas em pontos */
  var MARGENS = [40, 70, 40, 44];         // esquerda, topo (logo), direita, base (rodapé)
  var LOGO_LARGURA = 74;
  var LOGO_MARGEM = [40, 22, 0, 0];
  var RODAPE_MARGEM = [40, 16, 40, 0];
  var COLUNAS = [110, '*', 90];           // função · militar · horário
  var SETA_LARGURA = 8;
  var SETA_MARGEM = [0, 0.5, 0, 0];      // alinha a seta ao meio do texto do horário
  var LINHA_FINA = 0.5;                   // contorno do bloquinho branco
  var RAIO = { unidade: 6, posto: 3.5 };  // cantos arredondados do bloco da unidade e do bloquinho
  var ESPACAMENTO_CAIXA_ALTA = 0.6;       // entre letras do título do posto (caixa alta)
  var FONTE = { titulo: 16, data: 11, unidade: 12, detalhe: 9, posto: 8.5, funcao: 8.5, grad: 8.5, nome: 10, hora: 9, texto: 9, rodape: 8 };
  /* margens dentro das células: o deslocamento no topo alinha as letras menores à linha do nome */
  var CELULA = { titulo: [3, 0, 3, 3], funcao: [0, 1.5, 0, 0], militar: [0, 0, 0, 0], hora: [0, 1, 0, 0], vazio: [3, 2, 3, 2] };
  /* respiros dos blocos: a unidade (lado, topo, entre bloquinhos, base) e o bloquinho (lado, entre colunas, topo, entre linhas, base) */
  var BLOCO = { lado: 5, topo: 7, vao: 2.5, base: 5 };
  var BLOQUINHO = { lado: 7, entreColunas: 4, topo: 6, linha: 2, base: 6 };
  var ESPACO = { aposData: 16, entreUnidades: 9 };
  var A4_ALTURA = 842;
  var ALTURA_UTIL = A4_ALTURA - MARGENS[1] - MARGENS[3] - 50;   // menos o topo, o rodapé e o título do dia
  /* estimativa da altura de uma unidade (pt), com folga de 30%: só as que passam de ALTURA_UTIL são medidas */
  var ESTIMATIVA = { titulo: 40, posto: 22, linha: 21, linhaTexto: 12, letrasPorLinha: 80, folga: 1.3 };

  var recursos = null;   // promessa única: biblioteca + fontes + ícones (carregados no 1º uso)

  function txt() { return RW.mensagens.escala.impressao.pdf; }
  function pecas() { return (RW.escalasPainel && RW.escalasPainel.pecas) || {}; }

  /* ---------- recursos ---------- */
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      if (window.pdfMake) { ok(); return; }
      var s = document.createElement('script');   // a biblioteca só entra quando alguém imprime (REGRAS §1)
      s.src = src; s.onload = ok; s.onerror = falha;
      document.head.appendChild(s);
    });
  }

  function base64(buffer) {
    var bytes = new Uint8Array(buffer), partes = [];
    for (var i = 0; i < bytes.length; i += 0x8000) partes.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
    return btoa(partes.join(''));
  }

  function buscar(url, comoTexto) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url);
      return comoTexto ? r.text() : r.arrayBuffer();
    });
  }

  /* "rgb(14, 14, 14)" do tema → "#0e0e0e" (o pdfmake não lê rgb()) */
  function cor(token) {
    var n = getComputedStyle(document.documentElement).getPropertyValue(token).match(/\d+/g);
    return n && n.length >= 3 ? '#' + n.slice(0, 3).map(function (x) { return ('0' + Number(x).toString(16)).slice(-2); }).join('') : undefined;
  }

  /* o símbolo do arquivo de ícone vira um <svg> solto (o PDF não lê o CSS da classe .icone) */
  function svgDoIcone(texto, aberto) {
    var m = texto.match(/<symbol[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/);
    if (!m) return null;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + m[1] + '">' + aberto + m[2] + '</g></svg>';
  }

  function carregarRecursos() {
    if (recursos) return recursos;
    recursos = Promise.all([carregarScript(BIBLIOTECA), buscar(FONTE_NORMAL), buscar(FONTE_NEGRITO), buscar(ICONE_LOGO, true), buscar(ICONE_SETA, true)])
      .then(function (r) {
        window.pdfMake.vfs = { 'montserrat-400.woff': base64(r[1]), 'montserrat-600.woff': base64(r[2]) };
        window.pdfMake.fonts = { Montserrat: { normal: 'montserrat-400.woff', bold: 'montserrat-600.woff', italics: 'montserrat-400.woff', bolditalics: 'montserrat-600.woff' } };
        return { logo: r[3], seta: r[4] };
      })
      .catch(function (e) { recursos = null; throw e; });
    return recursos;
  }

  /* ---------- peças do documento ---------- */
  function montarEstilo(icones) {
    var c = {
      forte: cor('--impressao-texto-forte'), texto: cor('--impressao-texto'), suave: cor('--impressao-texto-suave'),
      borda: cor('--impressao-borda'), fundo: cor('--impressao-fundo'), papel: cor('--impressao-papel')
    };
    var traco = getComputedStyle(document.documentElement).getPropertyValue('--icone-traco').trim() || '1.5';
    c.logo = svgDoIcone(icones.logo.replace(/currentColor/g, c.forte), '<g>');
    c.seta = svgDoIcone(icones.seta, '<g fill="none" stroke="' + c.suave + '" stroke-width="' + traco + '" stroke-linecap="round" stroke-linejoin="round">');
    return c;
  }

  function horarios(periodos, c) {
    var hora = pecas().formatarHora || function (h) { return h || ''; };
    return {
      stack: (periodos || []).map(function (p) {
        return { columns: [{ text: hora(p.hi), width: 'auto' }, { svg: c.seta, width: SETA_LARGURA, margin: SETA_MARGEM }, { text: hora(p.hf), width: 'auto' }], columnGap: 4 };
      }),
      fontSize: FONTE.hora, color: c.texto, margin: CELULA.hora
    };
  }

  function celulaMilitar(m, c) {
    return { text: [{ text: (m.grad || '') + ' ', fontSize: FONTE.grad, color: c.suave }, { text: m.nome || '', bold: true, fontSize: FONTE.nome, color: c.forte }], margin: CELULA.militar };
  }

  function semLinha() { return 0; }

  /* bloquinho branco (posto, sem função, observações): tabela sem linhas; o fundo branco quadrado só
     quando "preencher" (o desenho de cantos retos, que também é a medida dos blocos arredondados) */
  function layoutBloquinho(c, preencher) {
    return {
      hLineWidth: semLinha,
      vLineWidth: semLinha,
      paddingLeft: function (i) { return i === 0 ? BLOQUINHO.lado : 0; },
      paddingRight: function (i, no) { return i === no.table.widths.length - 1 ? BLOQUINHO.lado : BLOQUINHO.entreColunas; },
      paddingTop: function (i) { return i === 0 ? BLOQUINHO.topo : BLOQUINHO.linha; },
      paddingBottom: function (i, no) { return i === no.table.body.length - 1 ? BLOQUINHO.base : BLOQUINHO.linha; },
      fillColor: function () { return preencher ? c.papel : null; }
    };
  }

  /* título de bloquinho em caixa alta, como o rótulo da caixa na tela (o mesmo texto é o marcador da folha) */
  function tituloBloquinho(texto) { return texto.toLocaleUpperCase('pt-BR'); }

  /* um posto = um bloquinho (título do posto + uma linha por militar); é a "linha" que nunca se parte */
  function tabelaPosto(titulo, linhas, c, preencher) {
    var corpo = [[{ text: titulo, colSpan: 3, bold: true, fontSize: FONTE.posto, characterSpacing: ESPACAMENTO_CAIXA_ALTA, color: c.forte }, {}, {}]].concat(linhas);
    return { table: { widths: COLUNAS, body: corpo }, layout: layoutBloquinho(c, preencher) };
  }

  function linhasDoPosto(posto, c) {
    var mesclar = pecas().mesclarFuncoes || function (p) { return p.funcoes || []; };
    var linhas = [];
    mesclar(posto).forEach(function (f) {
      var daFuncao = [];
      if (f.vazio && RW.mensagens.escala.vagaVazia) {
        daFuncao.push([{ text: RW.mensagens.escala.vagaVazia(f.vazio_motivo), italics: true, fontSize: FONTE.texto, color: c.suave, margin: CELULA.militar }, { text: '' }]);
      }
      (f.militares || []).forEach(function (m) { daFuncao.push([celulaMilitar(m, c), horarios(m.periodos, c)]); });
      /* o rótulo da função só na 1ª linha dela (mescla Chefe + Condutor = dois rótulos empilhados) */
      var rotulo = ((f.nomes && f.nomes.length) ? f.nomes : [f.nome]).join('\n');
      daFuncao.forEach(function (resto, i) {
        linhas.push([{ text: i === 0 ? rotulo : '', fontSize: FONTE.funcao, color: c.suave, margin: CELULA.funcao }].concat(resto));
      });
    });
    return linhas;
  }

  /* as "linhas" de uma unidade (cada uma inteira): sem função, postos, observações; cada uma com o seu marcador
     (o 1º texto dela), para achar depois em que folha caiu */
  function linhasDaUnidade(item, c, preencher) {
    var t = txt(), linhas = [];
    var semFuncao = item.sem_funcao || [];
    if (semFuncao.length) {
      var tituloSem = tituloBloquinho(t.semFuncao);
      linhas.push({ marcador: tituloSem, no: tabelaPosto(tituloSem, semFuncao.map(function (m) { return [{ text: '' }, celulaMilitar(m, c), horarios(m.periodos, c)]; }), c, preencher) });
    }
    var temAlguem = pecas().temAlguem || function () { return true; };
    (item.postos || []).filter(temAlguem).forEach(function (p) {
      var nome = tituloBloquinho(p.nome + (p.em_manutencao && RW.mensagens.escala.emManutencao ? ' · ' + RW.mensagens.escala.emManutencao : ''));
      linhas.push({ marcador: nome, no: tabelaPosto(nome, linhasDoPosto(p, c), c, preencher) });
    });
    if (!linhas.length) linhas.push({ marcador: t.semDistribuicao, no: { text: t.semDistribuicao, fontSize: FONTE.texto, color: c.suave, margin: CELULA.vazio } });
    if ((item.observacoes || []).length) {
      var tituloObs = tituloBloquinho(t.observacoes);
      linhas.push({ marcador: tituloObs, no: { table: { widths: ['*'], body: [
        [{ text: tituloObs, bold: true, fontSize: FONTE.posto, characterSpacing: ESPACAMENTO_CAIXA_ALTA, color: c.forte }],
        [{ ul: item.observacoes.map(RW.mensagens.escala.observacaoTexto), fontSize: FONTE.texto, color: c.texto }]
      ] }, layout: layoutBloquinho(c, preencher) } });
    }
    return linhas;
  }

  function tituloUnidade(u, item, iso, continuacao, c) {
    var t = txt();
    var sigla = (u.tipo === 'PEL' && u.pai ? u.pai + ' / ' : '') + u.nome + (u.cidade ? ' · ' + u.cidade : '') + (continuacao ? ' · ' + RW.data.isoParaBR(iso) : '');
    return { stack: [
      { text: (u.nome_completo || u.nome) + (continuacao ? ' ' + t.continuacao : ''), bold: true, fontSize: FONTE.unidade, color: c.forte },
      { columns: [{ text: sigla }, { text: t.deServico(item.ritmo, item.efetivo || 0), alignment: 'right', width: 'auto' }], fontSize: FONTE.detalhe, color: c.suave, margin: [0, 1, 0, 0] }
    ], margin: CELULA.titulo };
  }

  /* a unidade = bloco cinza: tabela de uma coluna, título (repete na folha seguinte) + as linhas, cada
     uma inteira; o cinza quadrado só quando "preencher" */
  function tabelaUnidade(titulo, linhas, quebraLivre, c, preencher) {
    var corpo = [[titulo]].concat(linhas.map(function (l) { return [l.no]; }));
    var tabela = { widths: ['*'], headerRows: 1, body: corpo };
    if (!quebraLivre) { tabela.keepWithHeaderRows = 1; tabela.dontBreakRows = true; }
    return { table: tabela, layout: {
      hLineWidth: semLinha,
      vLineWidth: semLinha,
      paddingLeft: function () { return BLOCO.lado; },
      paddingRight: function () { return BLOCO.lado; },
      paddingTop: function (i) { return i === 0 ? BLOCO.topo : BLOCO.vao; },
      paddingBottom: function (i, no) { return i === no.table.body.length - 1 ? BLOCO.base : BLOCO.vao; },
      fillColor: function () { return preencher ? c.fundo : null; }
    } };
  }

  /* camada de fundo de uma folha: os blocos arredondados nas posições lidas do desenho de cantos retos
     (cinza da unidade embaixo; bloquinhos brancos com contorno por cima) */
  function blocosArredondados(caixas, c) {
    if (!caixas) return null;
    var formas = caixas.cinza.map(function (b) {
      return { type: 'rect', x: b.x1, y: b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1, r: RAIO.unidade, color: c.fundo };
    }).concat(caixas.papel.map(function (b) {
      var meia = LINHA_FINA / 2;   // o contorno fica por dentro do bloquinho
      return { type: 'rect', x: b.x1 + meia, y: b.y1 + meia, w: b.x2 - b.x1 - LINHA_FINA, h: b.y2 - b.y1 - LINHA_FINA, r: RAIO.posto, color: c.papel, lineColor: c.borda, lineWidth: LINHA_FINA };
    }));
    return formas.length ? { canvas: formas } : null;
  }

  /* ---------- documento ---------- */
  /* plano: { modo: 'medir' | 'montar' | 'final' | 'simples', so: {chave:true} (medir), grandes: {chave:true}, cortes: {chave:[índices]},
     caixas: [por folha {cinza, papel}] (só no redesenho de cantos arredondados: sem os fundos quadrados) } */
  function montarDocumento(dados, c, plano) {
    var t = txt(), conteudo = [], marcadores = [];
    var preencher = !plano.caixas;
    var porDia = {};
    dados.dias.forEach(function (it) { (porDia[it.data] = porDia[it.data] || {})[it.unidade_id] = it; });
    /* título do dia; ao medir, vai em cima de CADA unidade (cabe = cabe numa folha junto do título) */
    function tituloDoDia(iso, quebra) {
      conteudo.push({ text: t.titulo, bold: true, fontSize: FONTE.titulo, color: c.forte, pageBreak: quebra ? 'before' : undefined });
      conteudo.push({ text: pecas().dataPorExtenso(iso), fontSize: FONTE.data, color: c.suave, margin: [0, 2, 0, ESPACO.aposData] });
    }
    var primeiro = true;
    Object.keys(porDia).sort().forEach(function (iso) {
      if (plano.modo !== 'medir') { tituloDoDia(iso, !primeiro); primeiro = false; }
      dados.unidades.forEach(function (u) {
        var item = porDia[iso][u.unidade_id];
        if (!item) return;
        var chave = iso + '|' + u.unidade_id;
        if (plano.so && !plano.so[chave]) return;   // ao medir, só as que podem passar de uma folha
        var linhas = linhasDaUnidade(item, c, preencher);
        linhas.forEach(function (l, j) { marcadores.push({ texto: l.marcador, chave: chave, j: j }); });
        var simples = plano.modo === 'simples';
        var grande = !!(plano.grandes && plano.grandes[chave]);
        var bloco;
        if (plano.modo === 'medir') { tituloDoDia(iso, !primeiro); primeiro = false; }
        if (plano.modo === 'final' && plano.cortes[chave]) {
          /* grande: um pedaço por folha; do 2º em diante, "(continuação)" e começa em folha nova */
          var inicios = [0].concat(plano.cortes[chave]);
          inicios.forEach(function (ini, k) {
            var fim = k + 1 < inicios.length ? inicios[k + 1] : linhas.length;
            var pedaco = tabelaUnidade(tituloUnidade(u, item, iso, k > 0, c), linhas.slice(ini, fim), false, c, preencher);
            /* só o último pedaço leva o espaço de baixo (num pedaço que enche a folha, ele abriria uma folha vazia) */
            pedaco.margin = [0, 0, 0, k === inicios.length - 1 ? ESPACO.entreUnidades : 0];
            if (k > 0) pedaco.pageBreak = 'before';
            conteudo.push(pedaco);
          });
          return;
        }
        bloco = tabelaUnidade(tituloUnidade(u, item, iso, false, c), linhas, simples, c, preencher);
        /* a pequena nunca se divide: vai inteira para a folha seguinte (a grande quebra entre postos) */
        if (plano.modo !== 'medir' && !simples && !grande) bloco = { stack: [bloco], unbreakable: true };
        bloco.margin = [0, 0, 0, ESPACO.entreUnidades];
        conteudo.push(bloco);
      });
    });
    var doc = {
      pageSize: 'A4',
      pageMargins: MARGENS,
      defaultStyle: { font: 'Montserrat', fontSize: FONTE.texto, color: c.texto },
      info: { title: t.titulo + ' ' + RW.data.isoParaBR(dados.inicio) + (dados.fim !== dados.inicio ? ' a ' + RW.data.isoParaBR(dados.fim) : ''), author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' },
      header: function () { return { svg: c.logo, width: LOGO_LARGURA, margin: LOGO_MARGEM }; },
      footer: function (pagina, total) {
        return { columns: [{ text: t.site }, { text: t.pagina(pagina, total), alignment: 'right' }], fontSize: FONTE.rodape, color: c.suave, margin: RODAPE_MARGEM };
      },
      content: conteudo
    };
    if (plano.caixas) doc.background = function (folha) { return blocosArredondados(plano.caixas[folha - 1], c); };
    return { doc: doc, marcadores: marcadores };
  }

  /* em que folha cada marcador saiu (na ordem); null se algum sumiu */
  function lerMarcadores(paginas, lista) {
    var achados = [], k = 0;
    paginas.forEach(function (pg, i) {
      pg.items.forEach(function (it) {
        if (k >= lista.length || it.type !== 'line') return;
        var texto = (it.item.inlines || []).map(function (x) { return x.text; }).join('');
        if (texto === lista[k].texto) { achados.push(i + 1); k++; }
      });
    });
    return k === lista.length ? achados : null;
  }

  /* une os retângulos que se tocam (as células de um bloco viram uma caixa só) */
  function unirTocantes(lista) {
    var rs = lista.slice(), uniu = true, folga = 0.6;
    while (uniu) {
      uniu = false;
      for (var i = 0; i < rs.length && !uniu; i++) {
        for (var j = i + 1; j < rs.length && !uniu; j++) {
          var a = rs[i], b = rs[j];
          if (a.x1 <= b.x2 + folga && b.x1 <= a.x2 + folga && a.y1 <= b.y2 + folga && b.y1 <= a.y2 + folga) {
            rs[i] = { x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) };
            rs.splice(j, 1);
            uniu = true;
          }
        }
      }
    }
    return rs;
  }

  /* onde ficou cada bloco, por folha: os fundos quadrados (cinza = unidade, branco = bloquinho) unidos */
  function lerCaixas(paginas, c) {
    return paginas.map(function (pg) {
      var cinza = [], papel = [];
      pg.items.forEach(function (it) {
        if (it.type !== 'vector' || it.item.type !== 'rect') return;
        var r = { x1: it.item.x, y1: it.item.y, x2: it.item.x + it.item.w, y2: it.item.y + it.item.h };
        if (it.item.color === c.fundo) cinza.push(r);
        else if (it.item.color === c.papel) papel.push(r);
      });
      return { cinza: unirTocantes(cinza), papel: unirTocantes(papel) };
    });
  }

  /* posição de cada linha de texto, folha a folha: dois desenhos com a mesma assinatura têm o texto no mesmo lugar */
  function assinaturaTexto(paginas) {
    return paginas.map(function (pg, i) {
      return pg.items.filter(function (it) { return it.type === 'line'; })
        .map(function (it) { return i + ':' + it.item.x.toFixed(1) + ':' + it.item.y.toFixed(1); }).join('|');
    }).join('#');
  }

  /* desenha o documento UMA vez e devolve o arquivo pronto + em que folha cada marcador caiu, onde ficou
     cada bloco e a assinatura do texto (o mesmo desenho que foi conferido é o que vai para o arquivo) */
  function desenhar(montado, c) {
    return new Promise(function (ok, falha) {
      try {
        var documento = window.pdfMake.createPdf(montado.doc);
        documento._createDoc({}, function (pdfDoc) {
          documento._flushDoc(pdfDoc, function (buffer, paginas) {
            ok({
              arquivo: documento._bufferToBlob(buffer),
              folhas: lerMarcadores(paginas, montado.marcadores),
              marcadores: montado.marcadores,
              caixas: lerCaixas(paginas, c),
              assinatura: assinaturaTexto(paginas)
            });
          });
        });
      } catch (e) { falha(e); }
    });
  }

  /* agrupa as folhas por unidade: { chave: [folha da linha 0, folha da linha 1, ...] } */
  function folhasPorUnidade(marcadores, folhas) {
    var r = {};
    marcadores.forEach(function (m, i) { (r[m.chave] = r[m.chave] || [])[m.j] = folhas[i]; });
    return r;
  }

  /* altura estimada de uma unidade (pt), com folga: só quem pode passar de uma folha é medido de verdade */
  function alturaEstimada(item) {
    var linha = function (m) { return ESTIMATIVA.linha * Math.max(1, (m.periodos || []).length); };
    var h = ESTIMATIVA.titulo;
    var semFuncao = item.sem_funcao || [];
    if (semFuncao.length) h += ESTIMATIVA.posto + semFuncao.reduce(function (s, m) { return s + linha(m); }, 0);
    (item.postos || []).forEach(function (p) {
      h += ESTIMATIVA.posto;
      (p.funcoes || []).forEach(function (f) {
        h += (f.vazio ? ESTIMATIVA.linha : 0) + (f.militares || []).reduce(function (s, m) { return s + linha(m); }, 0);
      });
    });
    var obs = item.observacoes || [];
    if (obs.length) {
      h += ESTIMATIVA.posto + obs.reduce(function (s, o) {
        return s + ESTIMATIVA.linhaTexto * Math.ceil(((RW.mensagens.escala.observacaoTexto(o) || '').length + 1) / ESTIMATIVA.letrasPorLinha);
      }, 0);
    }
    return h * ESTIMATIVA.folga;
  }

  /* as passadas → o arquivo:
     1) mede só as unidades que podem passar de uma folha (pela altura estimada);
     2) monta: a pequena inteira, a grande quebrando entre postos com o título repetido;
     3) se há grande, corta nos pontos medidos e põe "(continuação)" + a data;
     4) redesenha o escolhido com os cantos arredondados.
     Cada desenho é conferido; se algo não bate, fica o anterior (ou o jeito simples). */
  function desenharArquivo(dados, c) {
    /* um desenho com o plano que o gerou (o redesenho de cantos arredondados repete o plano) */
    function desenharPlano(plano) {
      return desenhar(montarDocumento(dados, c, plano), c).then(function (d) { return { plano: plano, desenho: d }; });
    }
    function simples() { return desenharPlano({ modo: 'simples' }); }
    var candidatas = {};
    dados.dias.forEach(function (it) { if (alturaEstimada(it) > ALTURA_UTIL) candidatas[it.data + '|' + it.unidade_id] = true; });
    var medir = Object.keys(candidatas).length ? desenhar(montarDocumento(dados, c, { modo: 'medir', so: candidatas }), c) : Promise.resolve(null);
    var escolhido = medir.then(function (m) {
      if (m && !m.folhas) return simples();
      var grandes = {};
      if (m) {
        var porUnidade = folhasPorUnidade(m.marcadores, m.folhas);
        Object.keys(porUnidade).forEach(function (k) { var f = porUnidade[k]; if (f[f.length - 1] > f[0]) grandes[k] = true; });
      }
      return desenharPlano({ modo: 'montar', grandes: grandes }).then(function (montado) {
        var b = montado.desenho;
        if (!b.folhas) return simples();
        var cortes = {}, porUnidadeB = folhasPorUnidade(b.marcadores, b.folhas);
        Object.keys(grandes).forEach(function (k) {
          var f = porUnidadeB[k], lista = [];
          for (var j = 1; j < f.length; j++) if (f[j] !== f[j - 1]) lista.push(j);
          if (lista.length) cortes[k] = lista;
        });
        if (!Object.keys(cortes).length) return montado;
        return desenharPlano({ modo: 'final', grandes: grandes, cortes: cortes }).then(function (final) {
          var f = final.desenho;
          if (!f.folhas) return montado;
          /* cada pedaço da grande cabe na folha dele e começa na folha seguinte à do anterior (sem folha
             vazia no meio); senão fica a montagem com o título repetido */
          var porUnidadeC = folhasPorUnidade(f.marcadores, f.folhas);
          var certo = Object.keys(cortes).every(function (k) {
            var fl = porUnidadeC[k], inicios = [0].concat(cortes[k]);
            return inicios.every(function (ini, n) {
              var fim = n + 1 < inicios.length ? inicios[n + 1] : fl.length;
              var inteiro = fl.slice(ini, fim).every(function (pg) { return pg === fl[ini]; });
              return inteiro && (n === 0 || fl[ini] === fl[inicios[n - 1]] + 1);
            });
          });
          return certo ? final : montado;
        });
      });
    });
    /* cantos arredondados: o mesmo plano, sem os fundos quadrados e com os blocos na camada de fundo de cada
       folha, nas posições lidas do escolhido; o texto tem de cair no mesmo lugar, senão fica o de cantos retos */
    return escolhido.then(function (e) {
      var p = e.plano;
      var plano = { modo: p.modo, so: p.so, grandes: p.grandes, cortes: p.cortes, caixas: e.desenho.caixas };
      return desenhar(montarDocumento(dados, c, plano), c).then(function (r) {
        return r.assinatura === e.desenho.assinatura ? r.arquivo : e.desenho.arquivo;
      }, function () { return e.desenho.arquivo; });
    });
  }

  /* baixa o arquivo (link escondido do molde, clicado e retirado) */
  function baixar(arquivo, nome) {
    var link = RW.tpl('tpl-escala-impressao-baixar');
    if (!link) return;
    var url = URL.createObjectURL(arquivo);
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function nomeArquivo(dados) {
    function curta(iso) { return iso.slice(8, 10) + '-' + iso.slice(5, 7); }
    var ano = function (iso) { return iso.slice(0, 4); };
    var periodo = dados.inicio === dados.fim ? curta(dados.inicio) + '-' + ano(dados.inicio)
      : (ano(dados.inicio) === ano(dados.fim) ? curta(dados.inicio) + ' a ' + curta(dados.fim) + '-' + ano(dados.fim)
        : curta(dados.inicio) + '-' + ano(dados.inicio) + ' a ' + curta(dados.fim) + '-' + ano(dados.fim));
    return txt().arquivo(periodo, dados.unidades.length === 1 ? dados.unidades[0].nome : '');
  }

  /* dados: { unidades, dias, inicio, fim } (do banco, escala_impressao) → baixa o PDF */
  function gerar(dados) {
    return carregarRecursos().then(function (icones) {
      var c = montarEstilo(icones);
      return desenharArquivo(dados, c);
    }).then(function (arquivo) {
      baixar(arquivo, nomeArquivo(dados));
    });
  }

  RW.escalasImpressaoPdf = { gerar: gerar };
})();
