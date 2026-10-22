/* ============================================================
   TROCAS — PDF do registro técnico (o botão Imprimir registro do
   rodapé do painel da troca e o Registro técnico do painel
   Imprimir trocas, com uma folha nova por troca)
   Lê o registro no banco (fn_trocas_registro) e monta o documento
   técnico, sem fundos e com linhas finas: o título, o número RW, o
   código verificador e a hora em que foi gerado; as seções
   numeradas (Identificação, Escalas trocadas, Saldo de horas só
   quando a conta não fecha, Registro das ações e Observações; a
   numeração acompanha as que aparecem). Usa o motor do PDF da
   escala (RW.escalasImpressaoPdf: a biblioteca, as fontes, a logo,
   as cores do tema e o download).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* medidas em pontos (A4 = 595 de largura) */
  var FONTE = { titulo: 13, rotulo: 8, valor: 10, secao: 9.5, texto: 9.5, celula: 9, cabecalho: 8.5, ajuda: 8 };
  var MARGEM = { cabecalho: [0, 10, 0, 0], secao: [0, 16, 0, 4], ajuda: [0, 4, 0, 2], observacoes: [0, 6, 0, 0] };
  var LINHA = { secao: 0.75, tabela: 0.5 };
  var CELULA = { lado: 6, vertical: 5 };
  var COLUNAS = { campos: [130, '*'], escalas: [24, 150, '*'], acoes: [100, 125, '*', 75] };
  var ESPACAMENTO_CAIXA_ALTA = { titulo: 0.4, secao: 0.6 };

  function P() { return RW.escalasImpressaoPdf; }
  function txt() { return RW.mensagens.trocas.registroPdf; }

  /* "08/10/2026 (quinta-feira), serviço inteiro, das 08h às 08h" */
  function dataDoItem(it) {
    var partes = RW.data.comDiaSemana(it.data).split(', ');   // ["Quinta-feira", "08/10/2026"]
    var inteiro = it.inicio === '08:00' && it.fim === '08:00';
    var periodo = inteiro ? txt().servicoInteiro : txt().trecho(RW.horario.curta(it.inicio), RW.horario.curta(it.fim));
    return txt().itemDia(partes[1], (partes[0] || '').toLowerCase(), periodo);
  }

  /* as seções de um registro (a 1ª peça é o título, onde começa a folha nova de cada um) */
  function conteudoDoRegistro(r, c) {
    var t = txt(), M = P().medidas;
    var largura = 595 - M.MARGENS[0] - M.MARGENS[2];
    var numero = 0;
    /* o título da seção (numerado pela ordem em que aparece) com a linha embaixo */
    function secao(titulo) {
      numero++;
      return [
        { text: t.secao(numero, titulo), bold: true, fontSize: FONTE.secao, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.secao, margin: MARGEM.secao },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: LINHA.secao, lineColor: c.forte }] }
      ];
    }
    /* tabela sem fundo: só a linha fina entre as linhas */
    var linhasFinas = {
      hLineWidth: function (i) { return i === 0 ? 0 : LINHA.tabela; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return c.borda; },
      paddingLeft: function (i) { return i === 0 ? 0 : CELULA.lado; },
      paddingRight: function () { return CELULA.lado; },
      paddingTop: function () { return CELULA.vertical; },
      paddingBottom: function () { return CELULA.vertical; }
    };
    function campo(rotulo, valor) { return [{ text: rotulo, fontSize: FONTE.celula, color: c.suave }, { text: valor, fontSize: FONTE.texto, color: c.forte }]; }
    function ajuda(texto) { return { text: texto, fontSize: FONTE.ajuda, color: c.suave, margin: MARGEM.ajuda }; }
    function topo(rotulo, valor, negrito) {
      return { stack: [{ text: rotulo, fontSize: FONTE.rotulo, color: c.suave }, { text: valor, fontSize: FONTE.valor, bold: !!negrito, color: c.forte }] };
    }

    var reg = r.registro;
    var conteudo = [
      { text: t.titulo, bold: true, fontSize: FONTE.titulo, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.titulo },
      { columns: [topo(t.rotuloRegistro, t.numero(reg.numero, reg.ano), true), topo(t.rotuloCodigo, reg.codigo, true), topo(t.rotuloGerado, r.gerado_em)],
        margin: MARGEM.cabecalho }
    ];

    /* identificação */
    var campos = [campo(t.origem, t.origens[reg.origem] || ''), campo(t.situacao, RW.trocasFormato.situacao(r.situacao, !!r.altera).texto)];
    if (r.altera) campos.push(campo(t.altera, t.alteraRegistro(r.altera.numero, r.altera.ano)));
    campos.push(campo(t.unidade, r.unidade || ''));
    campos.push(campo(t.documentos, r.parte ? t.parte(r.parte.numero, r.parte.ano) : t.semDocumento));
    conteudo = conteudo.concat(secao(t.secaoIdentificacao), [{ table: { widths: COLUNAS.campos, body: campos }, layout: linhasFinas }]);

    /* as escalas trocadas: 2.1, 2.2... */
    conteudo = conteudo.concat(secao(t.secaoEscalas));
    var numeroEscalas = numero;
    conteudo.push(ajuda(t.escalasAjuda));
    conteudo.push({ table: { widths: COLUNAS.escalas, body: (r.itens || []).map(function (it, i) {
      return [{ text: numeroEscalas + '.' + (i + 1), fontSize: FONTE.celula, color: c.suave },
              { text: dataDoItem(it), fontSize: FONTE.texto, color: c.forte },
              { text: t.itemFrase(it.cumpre, it.no_lugar_de), fontSize: FONTE.texto, color: c.forte }];
    }) }, layout: linhasFinas });

    /* o saldo de horas, só quando a conta entre dois militares não fecha */
    if ((r.saldo || []).length) {
      conteudo = conteudo.concat(secao(t.secaoSaldo), (r.saldo || []).map(function (s) {
        return { text: t.saldoFrase(s.deve, RW.tempo.horas(s.minutos), s.a), fontSize: FONTE.texto, color: c.forte, margin: MARGEM.observacoes };
      }));
    }

    /* as ações, em ordem de data (os aceites que faltam no fim, como Pendente) */
    conteudo = conteudo.concat(secao(t.secaoAcoes), [ajuda(t.acoesAjuda), { table: { headerRows: 1, widths: COLUNAS.acoes,
      body: [t.colunas.map(function (h) { return { text: h, bold: true, fontSize: FONTE.cabecalho, color: c.suave }; })].concat((r.acoes || []).map(function (a) {
        return [{ text: a.quando || t.pendente, fontSize: FONTE.celula, color: a.quando ? c.forte : c.suave },
                { text: t.acoes[a.acao] || '', fontSize: FONTE.celula, color: c.forte },
                { text: a.militar || '', fontSize: FONTE.celula, color: c.forte },
                { text: a.cpf || '', fontSize: FONTE.celula, color: c.forte }];
      })) }, layout: linhasFinas }]);

    /* uma cópia da lista: a biblioteca do PDF mexe na que recebe, e o próximo registro do arquivo sairia sem ela */
    return conteudo.concat(secao(t.secaoObservacoes), [{ ol: t.observacoes.slice(), fontSize: FONTE.celula, color: c.texto, margin: MARGEM.observacoes }]);
  }

  function documento(conteudo, titulo, c) {
    var M = P().medidas, pdf = RW.mensagens.escala.impressao.pdf;
    return {
      pageSize: 'A4', pageMargins: M.MARGENS,
      defaultStyle: { font: 'Montserrat', fontSize: FONTE.celula, color: c.texto, lineHeight: 1.15 },
      info: { title: titulo, author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' },
      header: function () { return { svg: c.logo, width: M.LOGO_LARGURA, margin: M.LOGO_MARGEM }; },
      footer: function (pagina, total) {
        return { columns: [{ text: pdf.site }, { text: pdf.pagina(pagina, total), alignment: 'right' }], fontSize: M.FONTE.rodape, color: c.suave, margin: M.RODAPE_MARGEM };
      },
      content: conteudo
    };
  }

  function montar(r, c) { return documento(conteudoDoRegistro(r, c), txt().numero(r.registro.numero, r.registro.ano), c); }

  /* vários registros num arquivo só (o painel Imprimir trocas): cada um começa numa folha nova */
  function arquivo(registros) {
    return P().preparar().then(function (c) {
      var conteudo = [];
      registros.forEach(function (r, i) {
        var partes = conteudoDoRegistro(r, c);
        if (i) partes[0].pageBreak = 'before';
        conteudo = conteudo.concat(partes);
      });
      var titulo = registros.length === 1 ? txt().numero(registros[0].registro.numero, registros[0].registro.ano) : txt().titulo;
      return P().desenhar(documento(conteudo, titulo, c), c);
    }).then(function (desenho) { return desenho.arquivo; });
  }

  /* o clique do botão: pontinhos no botão, lê o registro, desenha e baixa; a recusa do banco ou a falha vira aviso */
  function imprimir(trocaId, botao) {
    var m = RW.mensagens.trocas;
    function parar() { if (botao && RW.pararCarregando) RW.pararCarregando(botao); }
    function avisar(texto) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: texto }); }
    if (botao && RW.iniciarCarregando) RW.iniciarCarregando(botao);
    return RW.rpc('fn_trocas_registro', { p_troca_id: trocaId }).then(function (r) {
      if (!r || !r.ok) { parar(); avisar((r && r.erro) || m.falhaRegistro); return; }
      return P().preparar().then(function (c) { return P().desenhar(montar(r, c), c); }).then(function (desenho) {
        parar();
        P().baixar(desenho.arquivo, txt().arquivo(r.registro.numero, r.registro.ano));
      });
    }).catch(function () { parar(); avisar(m.falhaRegistro); });
  }

  RW.trocasRegistroPdf = { imprimir: imprimir, arquivo: arquivo };
})();
