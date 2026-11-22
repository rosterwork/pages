/* ============================================================
   ESCALAS — a célula no PDF das grades (unidade × dia)
   O bloquinho branco de uma unidade num dia, como na tela: o nome da
   unidade (só no calendário), o gráfico de cobertura (24 barras, na
   cor do estado), e uma linha por militar com os ícones de origem, a
   graduação (no calendário, o posto curto), o nome (riscado na folga,
   na troca, no remanejado e na mudança de dia; sem caber, cortado com
   "…", como na tela) e o horário. O "Mostrar" do painel liga e
   desliga o gráfico e os ícones. As origens, a situação e a hora vêm
   do escalas-celula.js (a mesma fonte da tela). Também diz quem
   aparece no dia (pelos filtros da tela) e que ícones saem no arquivo
   (para a legenda do pé da folha).
   Desenhado com a biblioteca do PDF (exceção REGRAS §3/§4):
   medidas em pontos nas constantes abaixo, cores --impressao-* do tema.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* medidas em pontos */
  var FONTE = { unidade: 6, grad: 6, nome: 7, hora: 6 };
  var ESPACAMENTO_CAIXA_ALTA = 0.4;        // entre letras do nome da unidade (caixa alta)
  var BLOQUINHO = { lado: 2.5, topo: 2.5, linha: 0.6, base: 3 };
  var ICONE = 7;                           // ícone de origem
  var ENTRE_ICONES = 1;                    // entre os ícones de uma linha
  var SETA = 4.5;                          // seta do horário (largura)
  var ENTRE_HORA = 1.5;                    // início · seta · fim
  var ENTRE_COLUNAS = 2.5;                 // ícones · nome · horário
  var FOLGA_CORTE = 1;                     // sobra na conta do corte do nome (a medida do canvas × a da biblioteca)
  var MARGEM = { icone: [0, 0.8, 0, 0], hora: [0, 0.9, 0, 0], seta: [0, 0.6, 0, 0] };   // alinham ao nome
  var GRAFICO = { altura: 10, vao: 0.6, linha: 1, minima: 1.2, corpo: 0.3, corpoProblema: 0.4, raio: 1 };

  var FONTE_MEDIDA = 'Montserrat PDF';     // a fonte do PDF, para medir o nome
  var medidor = null;                      // o canvas fora da tela que mede o texto (sem ele, o nome não é cortado)
  var fontesMedida = null;                 // a promessa da carga da fonte de medida (uma vez)

  function escalasCelula() { return RW.escalasCelula || {}; }

  /* ---------- o corte do nome com "…" ---------- */
  /* a fonte de medida: os mesmos arquivos da fonte do PDF (já carregados pelo escalas-impressao-pdf.js), para a conta
     sair igual à da biblioteca; sem o canvas fora da tela ou a carga, fica sem medidor */
  function carregarFontesMedida() {
    if (fontesMedida) return fontesMedida;
    var pdfMake = window.pdfMake || {};
    var familia = (pdfMake.fonts || {}).Montserrat;
    if (!familia || !pdfMake.vfs || !window.OffscreenCanvas || !window.FontFace || !document.fonts) return Promise.resolve();
    function carregar(arquivo, peso) {
      var binario = atob(pdfMake.vfs[arquivo] || ''), bytes = new Uint8Array(binario.length);
      for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
      return new FontFace(FONTE_MEDIDA, bytes.buffer, { weight: peso }).load().then(function (fonte) { document.fonts.add(fonte); });
    }
    fontesMedida = Promise.all([carregar(familia.normal, '400'), carregar(familia.bold, '600')]).then(function () {
      medidor = new OffscreenCanvas(1, 1).getContext('2d');
    }, function () { fontesMedida = null; });
    return fontesMedida;
  }

  /* a largura (pt) do texto no tamanho da fonte do PDF (medida em 100 e proporcional) */
  function larguraTexto(texto, tamanho, negrito) {
    medidor.font = (negrito ? '600' : '400') + ' 100px "' + FONTE_MEDIDA + '"';
    return medidor.measureText(texto).width * tamanho / 100;
  }

  /* o nome que cabe no espaço livre da linha depois da graduação: inteiro ou cortado com "…" (a graduação nunca) */
  function nomeQueCabe(grad, nome, livre, negrito) {
    if (!medidor || !nome) return nome;
    var limite = livre - FOLGA_CORTE - larguraTexto(grad + ' ', FONTE.grad, false);
    if (larguraTexto(nome, FONTE.nome, negrito) <= limite) return nome;
    for (var n = nome.length - 1; n > 0; n--) {
      var cortado = nome.slice(0, n).replace(/\s+$/, '') + '…';
      if (larguraTexto(cortado, FONTE.nome, negrito) <= limite) return cortado;
    }
    return '…';
  }

  /* as cores das grades, os ícones de origem (e o cadeado), no traço do tema, e a fonte de medida; uma vez por PDF */
  function preparar(c) {
    var pdf = RW.escalasImpressaoPdf;
    c.sucesso = pdf.cor('--impressao-sucesso');
    c.alerta = pdf.cor('--impressao-alerta');
    c.erro = pdf.cor('--impressao-erro');
    var nomes = (escalasCelula().iconesDasOrigens ? escalasCelula().iconesDasOrigens() : []).concat(['icone-cadeado']);
    return Promise.all([Promise.all(nomes.map(pdf.buscarIcone)), carregarFontesMedida()]).then(function (r) {
      c.icones = {};
      nomes.forEach(function (nome, i) { c.icones[nome] = pdf.svgDeTraco(r[0][i], c.suave); });
      return c;
    });
  }

  /* a hora com erro vermelho (1); o 2 é a ressalva amarela */
  function vermelho(marca) { return !!marca && marca !== 2 && marca !== '2'; }

  /* o gráfico de cobertura: 24 barras (uma por hora, a partir das 08h), corpo claro e a linha forte no topo; a hora sem
     ninguém de serviço não tem barra, e com erro vermelho (a companhia sem Oficial de Área) tem a barra baixinha */
  function grafico(cobertura, erro, max, largura, c) {
    var passo = (largura + GRAFICO.vao) / 24;
    /* a linha invisível no pé dá ao gráfico a altura inteira, mesmo num dia sem ninguém */
    var formas = [{ type: 'line', x1: 0, y1: GRAFICO.altura, x2: largura, y2: GRAFICO.altura, lineWidth: 0.1, lineColor: c.papel, strokeOpacity: 0 }];
    for (var h = 0; h < 24; h++) {
      var n = Number(cobertura[h]) || 0;
      var marca = erro && erro[h];
      if (n <= 0 && !vermelho(marca)) continue;
      var altura = n > 0 ? Math.max(GRAFICO.minima, Math.min(n, max) / max * (GRAFICO.altura - 0.5)) : GRAFICO.minima;
      var problema = marca === 1 || marca === 2 || marca === '1' || marca === '2';
      var corBarra = (marca === 2 || marca === '2') ? c.alerta : (marca ? c.erro : c.sucesso);
      var x = h * passo, w = passo - GRAFICO.vao, y = GRAFICO.altura - altura;
      formas.push({ type: 'rect', x: x, y: y, w: w, h: altura, r: GRAFICO.raio, color: corBarra, fillOpacity: problema ? GRAFICO.corpoProblema : GRAFICO.corpo });
      formas.push({ type: 'rect', x: x, y: y, w: w, h: Math.min(GRAFICO.linha, altura), color: corBarra });
    }
    return { canvas: formas, margin: [0, 0, 0, 2] };
  }

  function soHora(h) { return escalasCelula().soHora ? escalasCelula().soHora(h) : (h || ''); }
  function comInicio(p) { return (p.periodos || []).filter(function (per) { return per.inicio; }); }

  /* afastado (com o filtro Afastamentos): "Férias até DD/MM" no lugar do horário; a autorização de viagem (com o filtro
     dela): "Viagem até DD/MM" */
  function textoAfastado(p) {
    if (p.origem === 'viagem') return RW.mensagens.escala.viagemAte(RW.data.isoParaBR(p.ate).slice(0, 5));
    return RW.mensagens.geral.afastadoAte(p.afastamento || '', RW.data.isoParaBR(p.ate).slice(0, 5));
  }
  function semHorario(p) { return p.origem === 'afastamento' || p.origem === 'viagem'; }

  /* quem está fora da escala, no lugar do horário, como na tela (escalas-celula-fora.js): "Fora da escala" no amarelo (a
     volta de um afastamento há até 5 dias); "Entra em DD/MM", a entrada marcada; sem ela, "Fora da escala" no vermelho */
  function textoFora(p) {
    var E = RW.mensagens.escala, br = function (iso) { return RW.data.isoParaBR(iso).slice(0, 5); };
    return p.aviso ? E.foraDaEscala : p.entra_em ? E.entraEm(br(p.entra_em)) : p.vermelho ? E.foraDaEscala : '';
  }

  function horarios(p, c) {
    if (semHorario(p)) {
      return { text: textoAfastado(p), fontSize: FONTE.hora, color: c.texto, width: 'auto', margin: MARGEM.hora };
    }
    if (p.origem === 'fora') {
      return { text: textoFora(p), fontSize: FONTE.hora, color: c.texto, width: 'auto', margin: MARGEM.hora };
    }
    return {
      stack: comInicio(p).map(function (per) {
        var partes = [{ text: soHora(per.inicio), width: 'auto' }];
        if (per.fim) partes.push({ svg: c.seta, width: SETA, margin: MARGEM.seta }, { text: soHora(per.fim), width: 'auto' });
        return { columns: partes, columnGap: ENTRE_HORA };
      }),
      fontSize: FONTE.hora, color: c.texto, width: 'auto', margin: MARGEM.hora
    };
  }

  /* a largura (pt) da coluna do horário: o par mais largo (ou o texto do afastado) */
  function larguraHorarios(p) {
    if (semHorario(p)) return larguraTexto(textoAfastado(p), FONTE.hora, false);
    if (p.origem === 'fora') return textoFora(p) ? larguraTexto(textoFora(p), FONTE.hora, false) : 0;
    var maior = 0;
    comInicio(p).forEach(function (per) {
      var w = larguraTexto(soHora(per.inicio), FONTE.hora, false);
      if (per.fim) w += 2 * ENTRE_HORA + SETA + larguraTexto(soHora(per.fim), FONTE.hora, false);
      maior = Math.max(maior, w);
    });
    return maior;
  }

  /* os ícones de uma pessoa na célula: a origem de base (por baixo de uma troca), a origem, o cadeado e o remanejado */
  function iconesDaPessoa(p) {
    var nomes = [];
    if (p.origem_base) nomes.push(escalasCelula().iconeDaOrigem(p.origem_base));
    nomes.push(escalasCelula().iconeDaOrigem(escalasCelula().origemDoIcone(p)));
    if (p.fixado) nomes.push('icone-cadeado');
    if (p.remanejado) nomes.push('icone-remanejado');
    return nomes;
  }

  /* quem aparece no dia, nos grupos da tela (escalas-celula-grupos.js): os de serviço, o sobreaviso da companhia, no lugar
     em que ele aparece, a autorização de viagem (com o filtro dela) e o Fora da escala (os afastados dele, com o filtro
     Afastamentos), pelos filtros da tela */
  function pessoasDoDia(dados, uid, dia) {
    var passa = RW.escalasFiltros ? RW.escalasFiltros.passaPessoa : function (p) { return !semHorario(p); };
    function noGrupo(lista, grupo) { return lista.map(function (p) { return Object.assign({}, p, { grupo: grupo }); }); }
    var sobreaviso = RW.escalasCelulaSobreaviso ? RW.escalasCelulaSobreaviso.pessoas(uid, dia) : [];
    var fora = ((dados.fora || {})[uid] || {})[dia] || [];
    var lista = ((dados.militares[uid] || {})[dia] || []).concat(noGrupo(sobreaviso, 'sobreaviso'),
      noGrupo(fora.filter(function (p) { return p.origem === 'viagem'; }), 'viagem'),
      noGrupo(fora.filter(function (p) { return p.origem !== 'viagem'; }), 'fora'));
    return lista.filter(passa);
  }

  /* a linha tracejada entre dois grupos da célula (a mesma da tela) */
  function separador(largura, c) {
    return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: 0.4, dash: { length: 1.5, space: 1 }, lineColor: c.borda }],
      margin: [0, 1, 0, 1] };
  }

  /* os ícones que aparecem no arquivo ({ icone: true }), para a legenda do pé da folha: as pessoas dos dias do período
     (os de fora do mês saem vazios), em cada unidade. cfg: o do escalas-impressao-grade-pdf.js */
  function iconesDoArquivo(cfg) {
    var usados = {};
    cfg.dias.forEach(function (d) {
      if (d.fora) return;
      var dia = RW.data.paraIsoDeData(d.data);
      cfg.unidades.forEach(function (u) {
        pessoasDoDia(cfg.dados, u.unidade_id, dia).forEach(function (p) {
          iconesDaPessoa(p).forEach(function (n) { usados[n] = true; });
        });
      });
    });
    return usados;
  }

  /* uma linha de militar: ícones · graduação e nome · horário. curto: o posto curto (calendário);
     o nome que não cabe no meio sai cortado com "…", numa linha só */
  function linha(p, largura, mostrar, c, curto) {
    var riscada = p.origem === 'folga' || p.origem === 'troca_saida' || p.origem === 'remanejado_saida' || p.origem === 'mudanca_saida' || p.origem === 'saida_guarnicao'
      || p.origem === 'afastamento';
    var colunas = [];
    var livre = largura;
    if (mostrar.icones) {
      var icones = iconesDaPessoa(p);
      colunas.push({ columns: icones.map(function (n) { return { svg: c.icones[n], width: ICONE, height: ICONE }; }), columnGap: ENTRE_ICONES, width: 'auto', margin: MARGEM.icone });
      livre -= icones.length * ICONE + (icones.length - 1) * ENTRE_ICONES + ENTRE_COLUNAS;
    }
    var grad = curto && escalasCelula().postoCurto ? escalasCelula().postoCurto(p.grad) : (p.grad || '');
    if (medidor) livre -= larguraHorarios(p) + ENTRE_COLUNAS;
    colunas.push({ text: [
      { text: grad + ' ', fontSize: FONTE.grad, color: c.suave },
      { text: nomeQueCabe(grad, p.nome || '', livre, !riscada), fontSize: FONTE.nome, bold: !riscada,
        color: riscada ? c.suave : (p.vermelho ? c.erro : p.aviso ? c.alerta : c.forte), decoration: riscada ? 'lineThrough' : undefined }
    ], width: '*' });
    colunas.push(horarios(p, c));
    return { columns: colunas, columnGap: ENTRE_COLUNAS };
  }

  /* o Oficial de Área do dia no título (as linhas da tela, escalas-celula.js › linhasDoOficial): uma linha por Oficial, o
     posto e o nome e, quando não é o dia todo, o horário; o dia com escala e ninguém na função, e cada pedaço do dia sem
     ninguém, "Sem Oficial de Área" em vermelho; sem a chave (o dia sem escala), null */
  function oficial(oficiais, dia, c, tamanho) {
    if (!oficiais || !Object.prototype.hasOwnProperty.call(oficiais, dia)) return null;
    var linhas = RW.escalasCelula ? RW.escalasCelula.linhasDoOficial(oficiais[dia]) : [{ pessoa: oficiais[dia], hora: '' }];
    var partes = [];
    linhas.forEach(function (l, i) {
      if (i) partes.push({ text: '\n', fontSize: tamanho });
      if (l.pessoa) {
        partes.push({ text: (l.pessoa.grad || '') + ' ', color: c.suave, fontSize: tamanho },
          { text: l.pessoa.nome || '', bold: true, color: c.forte, fontSize: tamanho });
      } else partes.push({ text: RW.mensagens.escala.semOficial, bold: true, color: c.erro, fontSize: tamanho });
      if (l.hora) partes.push({ text: '  ' + l.hora, color: l.pessoa ? c.suave : c.erro, fontSize: tamanho });
    });
    return partes;
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
     pessoas, postoCurto (só no calendário), mostrar, c, preencher } */
  function bloco(o) {
    var interna = o.largura - 2 * BLOQUINHO.lado;
    var corpo = [];
    if (o.unidade) {
      corpo.push([{ text: o.unidade.toLocaleUpperCase('pt-BR'), fontSize: FONTE.unidade, bold: true, characterSpacing: ESPACAMENTO_CAIXA_ALTA, color: o.c.suave }]);
    }
    /* a unidade sem ninguém de serviço no período: o gráfico só com erro vermelho, na régua de 1 (como na tela) */
    var comVermelho = (o.erro || []).some(vermelho);
    if (o.mostrar.grafico && o.cobertura && (o.max > 0 || comVermelho)) corpo.push([grafico(o.cobertura, o.erro, o.max > 0 ? o.max : 1, interna, o.c)]);
    /* um grupo novo depois de outro: a linha tracejada entre eles */
    var antes = null;
    (o.pessoas || []).forEach(function (p) {
      if (antes && p.grupo && antes.grupo && p.grupo !== antes.grupo) corpo.push([separador(interna, o.c)]);
      corpo.push([linha(p, interna, o.mostrar, o.c, o.postoCurto)]);
      antes = p;
    });
    if (!corpo.length) corpo.push([{ text: ' ', fontSize: FONTE.nome }]);
    return { table: { widths: [interna], body: corpo, dontBreakRows: true }, layout: layoutBloquinho(o.c, o.preencher) };
  }

  RW.escalasImpressaoGradeCelula = { preparar: preparar, bloco: bloco, pessoasDoDia: pessoasDoDia, iconesDoArquivo: iconesDoArquivo, oficial: oficial };
})();
