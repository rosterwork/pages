/* ============================================================
   ESCALAS — PDF da escala (biblioteca pdfmake, carregada só aqui)
   Monta e baixa o PDF que o painel "Imprimir escala" pede, no
   formato dos relatórios (geral-relatorio-pdf.js): cada unidade de
   cada dia começa numa folha nova, com o alto ("ESCALA DE SERVIÇO",
   o Dia, a Unidade e quantos estão de serviço), e o conteúdo do
   painel do dia na mesma ordem (Funções especiais, as instalações,
   Extrajornada, Estagiários, Sobreaviso, as viaturas, sem função,
   observações), cada parte uma seção numerada com o traço embaixo.
   As tabelas não têm os títulos das colunas: a função (que ocupa as
   linhas dela), o militar e o horário; Extrajornada, Estagiários,
   Sobreaviso e Sem função só com o militar e o horário. A seção vai
   inteira para a folha seguinte quando não cabe; só a maior que uma
   folha se parte entre as linhas. No pé, o site, o "Gerado em" e
   "Página X de Y" (com os ícones de origem, que o Mostrar do painel
   liga, a legenda deles logo acima: escalas-impressao-legenda.js).
   O PDF é desenhado aqui, como o canvas do gráfico (exceção REGRAS
   §3/§4): cores lidas do tema (--impressao-*), medidas em pontos.
   As peças (recursos, medidas, desenho, blocos arredondados e
   download) também servem aos relatórios (geral-relatorio-pdf.js,
   os da Extrajornada e os das trocas) e aos PDFs das grades
   (escalas-impressao-grade-pdf.js) e dos Afastamentos.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var BIBLIOTECA = 'bibliotecas/pdfmake.min.js';
  var FONTE_NORMAL = 'fontes/montserrat-400.woff';
  var FONTE_NEGRITO = 'fontes/montserrat-600.woff';
  var ICONE_SETA = 'icones/icone-seta-direita-longa.svg';

  /* medidas em pontos */
  var MARGENS = [40, 40, 40, 44];         // esquerda, topo, direita, base (rodapé)
  var RODAPE_MARGEM = [40, 16, 40, 0];
  var ICONE = 7;                          // ícone de origem antes do nome (o Mostrar), no tamanho do PDF das grades
  var ICONE_MARGEM = [0, 2, 0, 0];       // alinha o ícone ao meio do nome
  var LINHA_FINA = 0.5;                   // o contorno dos blocos arredondados (as grades e o relatório de trocas)
  var RAIO = { unidade: 6, posto: 3.5 };  // cantos arredondados do bloco da unidade e do bloquinho
  var ESPACAMENTO_CAIXA_ALTA = 0.6;       // entre letras do título do posto (caixa alta)
  var FONTE = { titulo: 16, data: 11, unidade: 12, detalhe: 9, posto: 8.5, funcao: 8.5, grad: 8.5, nome: 10, hora: 9, texto: 9, rodape: 8 };
  /* os blocos do relatório de trocas (trocas-relatorio-pdf.js): as margens dentro das células, os respiros da unidade
     (lado, topo, entre bloquinhos, base) e do bloquinho (lado, entre colunas, topo, entre linhas, base, em cima e embaixo
     da linha do título) e os espaços */
  var CELULA = { titulo: [3, 0, 3, 3], funcao: [0, 1.5, 0, 0], militar: [0, 0, 0, 0], hora: [0, 1, 0, 0], vazio: [3, 2, 3, 2] };
  var BLOCO = { lado: 5, topo: 7, vao: 2.5, base: 5 };
  var BLOQUINHO = { lado: 7, entreColunas: 4, topo: 6, linha: 2, base: 6, titulo: 4 };
  var ESPACO = { aposData: 16, entreUnidades: 9 };
  /* a escala do Dia (no formato dos relatórios): as larguras da função e do horário (o militar fica com o resto), o vão
     entre os campos do alto, a altura útil da folha (A4 menos as margens e o alto da unidade), para saber se a seção
     cabe inteira, e quantas letras cabem numa linha da folha (a conta da altura das observações) */
  var COLUNAS = { funcao: 100, horario: 86 };
  var VAO_TOPO = 32;
  var ALTURA_UTIL = 842 - MARGENS[1] - MARGENS[3] - 60;
  var LETRAS_POR_LINHA = 95;

  var recursos = null;   // promessa única: biblioteca + fontes + ícones (carregados no 1º uso)

  function txt() { return RW.mensagens.escala.impressao.pdf; }
  function pecas() { return (RW.escalasPainel && RW.escalasPainel.pecas) || {}; }
  /* as observações nos grupos da tela (a mesma peça do painel do dia) */
  function gruposObservacoes(obs) { return pecas().agruparObservacoes ? pecas().agruparObservacoes(obs) : [{ titulo: '', itens: obs || [] }]; }

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
    recursos = Promise.all([carregarScript(BIBLIOTECA), buscar(FONTE_NORMAL), buscar(FONTE_NEGRITO), buscar(ICONE_SETA, true)])
      .then(function (r) {
        window.pdfMake.vfs = { 'montserrat-400.woff': base64(r[1]), 'montserrat-600.woff': base64(r[2]) };
        window.pdfMake.fonts = { Montserrat: { normal: 'montserrat-400.woff', bold: 'montserrat-600.woff', italics: 'montserrat-400.woff', bolditalics: 'montserrat-600.woff' } };
        return { seta: r[3] };
      })
      .catch(function (e) { recursos = null; throw e; });
    return recursos;
  }

  /* um arquivo de ícone de icones/ (o texto), buscado uma vez; usado pelo PDF das grades (os ícones de origem) */
  var arquivosIcone = {};
  function buscarIcone(nome) {
    if (!arquivosIcone[nome]) {
      arquivosIcone[nome] = buscar('icones/' + nome + '.svg', true).catch(function (e) { delete arquivosIcone[nome]; throw e; });
    }
    return arquivosIcone[nome];
  }

  /* o ícone de traço como <svg> solto, na cor dada e com o traço do tema */
  function svgDeTraco(texto, corTraco) {
    var traco = getComputedStyle(document.documentElement).getPropertyValue('--icone-traco').trim() || '1.5';
    return svgDoIcone(texto, '<g fill="none" stroke="' + corTraco + '" stroke-width="' + traco + '" stroke-linecap="round" stroke-linejoin="round">');
  }

  /* ---------- peças do documento ---------- */
  function montarEstilo(icones) {
    var c = {
      forte: cor('--impressao-texto-forte'), texto: cor('--impressao-texto'), suave: cor('--impressao-texto-suave'),
      borda: cor('--impressao-borda'), fundo: cor('--impressao-fundo'), papel: cor('--impressao-papel')
    };
    c.seta = svgDeTraco(icones.seta, c.suave);
    return c;
  }

  /* ---------- a escala do Dia ---------- */
  /* as peças do formato dos relatórios (a folha, as seções, as tabelas): geral-relatorio-pdf.js */
  function relatorio() { return RW.relatorioPdf; }
  /* uma linha de texto da célula da tabela (pontos) */
  function alturaTexto() { return relatorio().medidas.ALTURA_LINHA; }

  /* os horários do militar, um embaixo do outro ("08h às 08h") */
  function horarios(m) {
    var hora = pecas().formatarHora || function (h) { return h || ''; };
    return (m.periodos || []).map(function (p) { return txt().horario(hora(p.hi), hora(p.hf)); });
  }

  /* os ícones do militar, como no painel do dia: a origem do serviço e, fixado na função, o cadeado */
  function iconesDoMilitar(m) {
    if (m.origem === 'sobreaviso') return m.fixado ? ['icone-sobreaviso', 'icone-cadeado'] : ['icone-sobreaviso'];
    var origem = pecas().iconeOrigem || {};
    var nomes = [origem[m.estagio ? 'estagio' : m.origem] || origem.sistema || 'icone-origem-sistema'];
    if (m.fixado) nomes.push('icone-cadeado');
    return nomes;
  }

  /* os ícones que aparecem no arquivo ({ icone: true }), para a legenda do pé da folha */
  function iconesDoArquivo(dados) {
    var usados = {};
    function marcar(m) { iconesDoMilitar(m).forEach(function (n) { usados[n] = true; }); }
    dados.dias.forEach(function (it) {
      (it.sem_funcao || []).forEach(marcar);
      (it.postos || []).forEach(function (p) {
        (p.funcoes || []).concat(p.exibir || []).forEach(function (f) { (f.militares || []).forEach(marcar); });
      });
      sobreavisoDoItem(it).forEach(marcar);
    });
    return usados;
  }

  /* sem acento e em minúsculas, letra por letra (o mesmo tamanho do original, para achar a posição) */
  function semAcento(s) {
    return Array.from(s).map(function (ch) { return ch.normalize('NFD').charAt(0).toLowerCase(); }).join('');
  }

  /* o posto e o nome completo (c.nomes, do banco), com o posto e o nome de guerra em negrito: a palavra inteira, sem
     olhar acento nem maiúscula, com as letras do nome completo; sem o nome completo ou sem o nome de guerra dentro dele,
     só o nome de guerra */
  function partesDoNome(m, c) {
    var guerra = m.nome || '', completo = (c.nomes && m.cpf && c.nomes[m.cpf]) || '';
    var posto = { text: (m.grad || '') + ' ', bold: true };
    var procura = semAcento(guerra).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var achou = guerra && completo ? new RegExp('(^|[^a-z0-9])(' + procura + ')(?=$|[^a-z0-9])').exec(semAcento(completo)) : null;
    if (!achou) return [posto, { text: guerra, bold: true }];
    var letras = Array.from(completo), ini = achou.index + achou[1].length, fim = ini + achou[2].length;
    return [posto, { text: letras.slice(0, ini).join('') }, { text: letras.slice(ini, fim).join(''), bold: true },
      { text: letras.slice(fim).join('') }];
  }

  /* o militar, descido para o meio das linhas dele (n = quantos horários ele tem); com os ícones ligados (c.comIcones),
     os ícones de origem antes do nome */
  function celulaMilitar(m, c, n) {
    var margem = [0, (n - 1) * alturaTexto() / 2, 0, 0];
    var texto = { text: partesDoNome(m, c) };
    if (!c.comIcones) return Object.assign(texto, { margin: margem });
    texto.width = '*';
    return { columns: iconesDoMilitar(m).map(function (nome) {
      return { svg: c.icones[nome], width: ICONE, height: ICONE, margin: ICONE_MARGEM };
    }).concat([texto]), columnGap: 2, margin: margem };
  }

  function celulaHorario(m) { return { stack: horarios(m).map(function (h) { return { text: h }; }), alignment: 'center' }; }

  /* a tabela com a função (função · militar · horário): a função ocupa as linhas dela, no meio da altura (a mescla Chefe
     + Condutor, dois rótulos empilhados); o lugar sem ninguém, com a frase → { linhas, comFuncao, altura } */
  function tabelaComFuncao(funcoes, c) {
    var M = RW.mensagens.escala, h = alturaTexto(), vertical = relatorio().medidas.CELULA.vertical, linhas = [], total = 0;
    funcoes.forEach(function (f) {
      var daFuncao = [];
      (f.militares || []).forEach(function (m) {
        var n = Math.max(1, (m.periodos || []).length);
        daFuncao.push({ n: n, celulas: [celulaMilitar(m, c, n), celulaHorario(m)] });
      });
      /* o grupo sem número (f.partes, do mesclarFuncoes): as pessoas na ordem de antiguidade e depois os lugares sem
         ninguém, com as horas em que fazem falta (vazio_periodos) */
      (f.partes || [f]).forEach(function (pt) {
        if (!pt.vazio || (f.partes && (pt.militares || []).length) || !M.vagaVazia) return;
        var horas = pt.vazio_periodos || [];
        daFuncao.push({ n: Math.max(1, horas.length), celulas: [{ text: M.vagaVazia(pt.vazio_motivo), italics: true, color: c.suave },
          horas.length ? celulaHorario({ periodos: horas }) : { text: '' }] });
      });
      if (!daFuncao.length) return;
      var rotulos = (f.nomes && f.nomes.length) ? f.nomes : [f.nome];
      /* a biblioteca não centraliza na vertical: a margem de cima do rótulo vem da altura das linhas da função */
      var altura = daFuncao.reduce(function (s, x) { return s + x.n * h; }, 0) + (daFuncao.length - 1) * 2 * vertical;
      daFuncao.forEach(function (x, i) {
        var funcao = i ? {} : { text: rotulos.join('\n'), rowSpan: daFuncao.length,
          margin: [0, Math.max(0, (altura - rotulos.length * h) / 2), 0, 0] };
        linhas.push([funcao].concat(x.celulas));
      });
      total += altura + 2 * vertical;
    });
    return { linhas: linhas, comFuncao: true, altura: total };
  }

  /* a tabela só com o militar e o horário (Extrajornada, Estagiários, Sobreaviso e Sem função) */
  function tabelaSoNomes(militares, c) {
    var h = alturaTexto(), vertical = relatorio().medidas.CELULA.vertical, total = 0;
    var linhas = militares.map(function (m) {
      var n = Math.max(1, (m.periodos || []).length);
      total += n * h + 2 * vertical;
      return [celulaMilitar(m, c, n), celulaHorario(m)];
    });
    return { linhas: linhas, comFuncao: false, altura: total };
  }

  /* o dia da unidade em blocos, como no painel (escalas-painel.js › blocosDoDia; o Cabo de Dia sem ninguém não sai no
     papel); sem as peças, os postos na ordem do banco */
  function blocosDoItem(item) {
    if (pecas().blocosDoDia) return pecas().blocosDoDia(item.postos, false);
    return { especiais: [], instalacoes: item.postos || [], extra: [], estagiarios: [], viaturas: [] };
  }

  /* o sobreaviso da companhia de um dia da unidade, no lugar em que ele aparece (o mesmo "exibe" da grade), como militares
     do bloquinho; o que o administrador pôs ou mudou, com o cadeado */
  function sobreavisoDoItem(item) {
    var s = item.sobreaviso;
    if (!s || !s.exibe) return [];
    return (s.militares || []).map(function (m) {
      return { cpf: m.cpf, grad: m.grad, nome: m.nome, origem: 'sobreaviso', fixado: m.origem === 'administrador',
        periodos: [{ hi: m.horaInicio, hf: m.horaFim }] };
    });
  }

  /* a altura que a seção pode ter para ir inteira (a legenda do pé da folha toma o seu espaço) */
  function alturaUtil(c) { return ALTURA_UTIL - (c.legendaAltura || 0); }

  /* a seção: o título numerado com o traço e a tabela, sem os títulos das colunas; vai inteira para a folha seguinte
     quando não cabe, e só a maior que uma folha se parte entre as linhas. false = sem linhas (não sai) */
  function secao(p, titulo, tabela, conteudo, c) {
    if (!tabela.linhas.length) return false;
    var larguras = tabela.comFuncao ? [COLUNAS.funcao, '*', COLUNAS.horario] : ['*', COLUNAS.horario];
    conteudo.push({ stack: p.secao(titulo.toLocaleUpperCase('pt-BR')).concat([p.tabela(larguras, null, tabela.linhas)]),
      unbreakable: tabela.altura <= alturaUtil(c) });
    return true;
  }

  /* as Observações nos grupos da tela (Administração, Trocas, Folgas, De outra unidade): cada grupo uma subseção (n.1,
     n.2...) com a lista numerada */
  function observacoes(p, item, conteudo, c) {
    var obs = item.observacoes || [];
    if (!obs.length) return;
    var titulo = p.secao(txt().observacoes), n = p.numero(), corpo = [], linhas = 0;
    gruposObservacoes(obs).forEach(function (g, i) {
      var itens = g.itens.map(RW.mensagens.escala.observacaoTexto);
      if (g.titulo) corpo.push(p.subsecao(n + '.' + (i + 1), { nome: g.titulo }));
      corpo.push(p.lista(itens));
      linhas += 2 + itens.reduce(function (s, x) { return s + Math.ceil(((x || '').length + 1) / LETRAS_POR_LINHA); }, 0);
    });
    conteudo.push({ stack: titulo.concat(corpo), unbreakable: linhas * alturaTexto() <= alturaUtil(c) });
  }

  /* o Dia de uma unidade: o alto (o título, o Dia, a Unidade e quantos estão de serviço) e as seções na ordem do painel
     do dia (Funções especiais, as instalações, Extrajornada, Estagiários, Sobreaviso, as viaturas, sem função,
     observações); quebra = começa numa folha nova */
  function conteudoDaUnidade(u, item, iso, c, quebra) {
    var t = txt(), M = RW.mensagens.escala, p = relatorio().pecas(c), conteudo = [], alguem = false;
    var unidade = (u.tipo === 'PEL' && u.pai ? u.pai + ' / ' : '') + u.nome + (u.cidade ? ' · ' + u.cidade : '');
    var campos = [p.topo(t.rotuloDia, RW.data.comDiaSemana(iso), true), p.topo(t.rotuloUnidade, unidade, true),
      p.topo(t.rotuloDeServico, t.militares(item.efetivo || 0))];
    campos.forEach(function (x) { x.width = 'auto'; });
    var alto = relatorio().cabecalho(t.tituloDia, campos, c);
    alto[1].columnGap = VAO_TOPO;
    if (quebra) alto[0].pageBreak = 'before';
    function deServico(titulo, tabela) { if (secao(p, titulo, tabela, conteudo, c)) alguem = true; }
    var temAlguem = pecas().temAlguem || function () { return true; };
    var mesclar = pecas().mesclarFuncoes || function (po) { return po.funcoes || []; };
    function postos(lista) { lista.filter(temAlguem).forEach(function (po) { deServico(po.nome, tabelaComFuncao(mesclar(po), c)); }); }
    var blocos = blocosDoItem(item);
    deServico(M.blocoEspeciais, tabelaComFuncao(blocos.especiais, c));
    postos(blocos.instalacoes);
    deServico(M.blocoExtra, tabelaSoNomes([].concat.apply([], blocos.extra.map(function (f) { return f.militares || []; })), c));
    deServico(M.blocoEstagiarios, tabelaSoNomes(blocos.estagiarios, c));
    secao(p, M.sobreaviso.dica, tabelaSoNomes(sobreavisoDoItem(item), c), conteudo, c);
    postos(blocos.viaturas);
    deServico(t.semFuncao, tabelaSoNomes(item.sem_funcao || [], c));
    if (!alguem) conteudo.push(p.ajuda(t.semDistribuicao));
    observacoes(p, item, conteudo, c);
    return alto.concat(conteudo);
  }

  /* camada de fundo de uma folha: os blocos arredondados nas posições lidas do desenho de cantos retos
     (cinza da unidade embaixo; bloquinhos brancos com contorno por cima); com "contorno" (o PDF do dia e, com as
     unidades lado a lado, a página contínua das grades), o cinza também ganha o contorno fino, por dentro dele: o limite
     da unidade (ou do dia) no papel */
  function blocosArredondados(caixas, c, contorno) {
    if (!caixas) return null;
    var formas = caixas.cinza.map(function (b) {
      if (!contorno) return { type: 'rect', x: b.x1, y: b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1, r: RAIO.unidade, color: c.fundo };
      var meia = LINHA_FINA / 2;
      return { type: 'rect', x: b.x1 + meia, y: b.y1 + meia, w: b.x2 - b.x1 - LINHA_FINA, h: b.y2 - b.y1 - LINHA_FINA, r: RAIO.unidade, color: c.fundo, lineColor: c.borda, lineWidth: LINHA_FINA };
    }).concat(caixas.papel.map(function (b) {
      var meia = LINHA_FINA / 2;   // o contorno fica por dentro do bloquinho
      return { type: 'rect', x: b.x1 + meia, y: b.y1 + meia, w: b.x2 - b.x1 - LINHA_FINA, h: b.y2 - b.y1 - LINHA_FINA, r: RAIO.posto, color: c.papel, lineColor: c.borda, lineWidth: LINHA_FINA };
    }));
    return formas.length ? { canvas: formas } : null;
  }

  /* ---------- documento ---------- */
  /* cada unidade de cada dia, na ordem dos dias e das unidades, começando numa folha nova; no pé, o site, o "Gerado em"
     e a página (com os ícones, a legenda deles logo acima) */
  function montarDocumento(dados, c) {
    var t = txt(), conteudo = [], porDia = {};
    dados.dias.forEach(function (it) { (porDia[it.data] = porDia[it.data] || {})[it.unidade_id] = it; });
    Object.keys(porDia).sort().forEach(function (iso) {
      dados.unidades.forEach(function (u) {
        var item = porDia[iso][u.unidade_id];
        if (item) conteudo = conteudo.concat(conteudoDaUnidade(u, item, iso, c, conteudo.length > 0));
      });
    });
    var agora = relatorio().agora(), gerado = t.gerado(agora.data, agora.hora);
    var doc = relatorio().folha(null, null, conteudo, c, false);
    /* com os ícones, a base cresce para a legenda (escalas-impressao-legenda.js) */
    doc.pageMargins = [MARGENS[0], MARGENS[1], MARGENS[2], MARGENS[3] + (c.legendaAltura || 0)];
    doc.info.title = t.titulo + ' ' + RW.data.isoParaBR(dados.inicio) + (dados.fim !== dados.inicio ? ' a ' + RW.data.isoParaBR(dados.fim) : '');
    doc.footer = function (pagina, total) {
      var linha = { columns: [{ text: t.site }, { text: gerado, alignment: 'center' }, { text: t.pagina(pagina, total), alignment: 'right' }] };
      /* a legenda é montada a cada folha (a biblioteca anota medidas em cada peça) */
      var legenda = c.legendaUsados && RW.escalasImpressaoLegenda ? RW.escalasImpressaoLegenda.peca(c, c.legendaUsados) : null;
      var pe = legenda ? { stack: [legenda, linha] } : linha;
      pe.fontSize = FONTE.rodape;
      pe.color = c.suave;
      pe.margin = RODAPE_MARGEM;
      return pe;
    };
    return { doc: doc, marcadores: [] };
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
        /* no modo treino, todo PDF sai com a marca, em todas as folhas */
        if (RW.treino && RW.treino.ligado()) montado.doc.watermark = { text: RW.mensagens.treino.marcaPdf, font: 'Montserrat', bold: true, color: cor('--anotacao'), opacity: 0.12 };
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

  /* dados: { unidades, dias, nomes, inicio, fim } (do banco, escala_impressao; nomes = os nomes completos por CPF);
     opcoes: { icones } (o Mostrar: os ícones de origem antes do nome e a legenda deles no pé da folha) → { arquivo,
     nome, folhas }, sem baixar (a prévia do painel mostra o arquivo; o Gerar PDF baixa o mesmo) */
  function montar(dados, opcoes) {
    var comIcones = !!(opcoes && opcoes.icones && RW.escalasImpressaoLegenda);
    return carregarRecursos().then(function (icones) {
      var c = montarEstilo(icones);
      c.nomes = dados.nomes || {};
      if (!comIcones) return c;
      var usados = iconesDoArquivo(dados);
      return RW.escalasImpressaoLegenda.carregarIcones(c, Object.keys(usados)).then(function () {
        c.comIcones = true;
        c.legendaUsados = usados;
        c.legendaAltura = RW.escalasImpressaoLegenda.altura(usados);
        return c;
      });
    }).then(function (c) {
      return desenhar(montarDocumento(dados, c), c);
    }).then(function (r) {
      return { arquivo: r.arquivo, nome: nomeArquivo(dados), folhas: r.caixas.length };
    });
  }

  /* monta e baixa o PDF (sem os ícones) */
  function gerar(dados) {
    return montar(dados).then(function (r) { baixar(r.arquivo, r.nome); });
  }

  RW.escalasImpressaoPdf = {
    gerar: gerar,
    montar: montar,
    /* peças para outros relatórios no mesmo formato (os da Extrajornada): as cores e ícones do tema
       (carrega a biblioteca no 1º uso), as medidas, o desenho conferido, os blocos arredondados e o download */
    preparar: function () { return carregarRecursos().then(montarEstilo); },
    medidas: { MARGENS: MARGENS, RODAPE_MARGEM: RODAPE_MARGEM,
      FONTE: FONTE, BLOCO: BLOCO, BLOQUINHO: BLOQUINHO, ESPACO: ESPACO,
      ESPACAMENTO_CAIXA_ALTA: ESPACAMENTO_CAIXA_ALTA, CELULA: CELULA },
    /* marcadores (opcional): [{ texto }] em ordem; o resultado diz em que folha caiu cada um (null se algum sumiu) */
    desenhar: function (doc, c, marcadores) { return desenhar({ doc: doc, marcadores: marcadores || [] }, c); },
    blocosArredondados: blocosArredondados,
    baixar: baixar,
    /* para o PDF das grades: uma cor do tema (em hex), um arquivo de ícone e o ícone de traço como <svg> solto */
    cor: cor,
    buscarIcone: buscarIcone,
    svgDeTraco: svgDeTraco
  };
})();
