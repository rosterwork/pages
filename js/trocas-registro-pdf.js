/* ============================================================
   TROCAS — PDF do registro técnico (o botão Imprimir registro do
   rodapé do painel da troca e o Registro técnico do painel
   Imprimir trocas, com uma folha nova por troca)
   Lê o registro no banco (fn_trocas_registro) e monta o documento
   técnico, sem fundos e com linhas finas: o título, o número RW, o
   código verificador e a hora em que foi gerado; as seções
   numeradas (Identificação, Escalas trocadas, Saldo de horas só
   quando a conta não fecha, Registro das ações e Observações; a
   numeração acompanha as que aparecem). O registro que não vale
   mais (substituído, cancelado ou expirado) ganha o quadro no alto
   (o que aconteceu, quando, quem e o motivo) e a marca d'água grande
   em todas as folhas dele; as ocorrências do livro (correção,
   alteração, substituição, cancelamento, expiração) entram nas
   ações, com o detalhe e o motivo; o dia cancelado sozinho sai
   riscado. O Imprimir registro de um substituído sai com a
   sequência: ele e, em folha nova, cada um que veio depois, até o
   que vale. Usa o motor do PDF da escala (RW.escalasImpressaoPdf: a
   biblioteca, as fontes, a logo, as cores do tema e o download).
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
  /* o quadro do registro que não vale mais e a marca d'água das folhas dele */
  var QUADRO = { linha: 1, lado: 8, vertical: 7, margem: [0, 12, 0, 0], titulo: 10, texto: 9 };
  var MARCA = { tamanho: { substituicao: 84, cancelamento: 96, expiracao: 96 }, opacidade: 0.07, descer: 30 };
  var SEQUENCIA_MAXIMA = 10;   // o Imprimir registro segue até 10 registros (o substituído e os que vieram depois)

  function P() { return RW.escalasImpressaoPdf; }
  function txt() { return RW.mensagens.trocas.registroPdf; }
  function comPonto(t) { t = String(t || '').trim(); return /[.!?]$/.test(t) ? t : t + '.'; }

  /* o quadro do alto: SUBSTITUÍDO PELO RW nº Y / CANCELADO / EXPIRADO, quando, quem, o motivo e se ainda vale */
  function quadro(f, c) {
    var e = txt().encerramento;
    var titulo = f.tipo === 'substituicao' ? e.titulo.substituicao(f.numero, f.ano) : e.titulo[f.tipo];
    var linhas = [f.tipo === 'expiracao' ? e.pelaRotina(f.quando) : (f.militar ? e.porQuem(f.quando, f.militar) : e.semQuem(f.quando))];
    if (f.motivo && f.tipo !== 'expiracao') linhas.push(comPonto(e.motivo(f.motivo)));
    linhas.push(f.tipo === 'substituicao' ? e.fim.substituicao(f.numero, f.ano) : e.fim[f.tipo]);
    return { table: { widths: ['*'], body: [[{ stack: [{ text: titulo, bold: true, fontSize: QUADRO.titulo, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.secao, margin: [0, 0, 0, 3] }]
      .concat(linhas.map(function (l) { return { text: l, fontSize: QUADRO.texto, color: c.forte, margin: [0, 1, 0, 0] }; })) }]] },
      layout: { hLineWidth: function () { return QUADRO.linha; }, vLineWidth: function () { return QUADRO.linha; },
        hLineColor: function () { return c.forte; }, vLineColor: function () { return c.forte; },
        paddingLeft: function () { return QUADRO.lado; }, paddingRight: function () { return QUADRO.lado; },
        paddingTop: function () { return QUADRO.vertical; }, paddingBottom: function () { return QUADRO.vertical; } },
      margin: QUADRO.margem };
  }

  /* a marca d'água grande e clara, na diagonal da folha (um desenho de fundo, só nas folhas do registro que não vale) */
  function marca(f, tamanho, c) {
    var w = tamanho.width, h = tamanho.height, angulo = -Math.atan2(h, w) * 180 / Math.PI;
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
      + '<text x="' + (w / 2) + '" y="' + (h / 2 + MARCA.descer) + '" text-anchor="middle" font-family="Helvetica" font-weight="bold"'
      + ' font-size="' + MARCA.tamanho[f.tipo] + '" fill="' + c.forte + '" fill-opacity="' + MARCA.opacidade + '"'
      + ' transform="rotate(' + angulo + ' ' + (w / 2) + ' ' + (h / 2) + ')">' + txt().encerramento.marca[f.tipo] + '</text></svg>',
      width: w, absolutePosition: { x: 0, y: 0 } };
  }

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
    var fim = r.encerramento && t.encerramento.titulo[r.encerramento.tipo] ? r.encerramento : null;
    if (fim) conteudo.push(quadro(fim, c));

    /* identificação */
    var campos = [campo(t.origem, t.origens[reg.origem] || ''), campo(t.situacao, RW.trocasFormato.situacao(r.situacao, !!r.altera).texto)];
    if (r.altera) campos.push(campo(t.altera, t.alteraRegistro(r.altera.numero, r.altera.ano)));
    if (r.altera && r.altera.motivo) campos.push(campo(t.motivoAlteracao, comPonto(r.altera.motivo)));
    campos.push(campo(t.unidade, r.unidade || ''));
    campos.push(campo(t.documentos, r.parte ? t.parte(r.parte.numero, r.parte.ano) : t.semDocumento));
    conteudo = conteudo.concat(secao(t.secaoIdentificacao), [{ table: { widths: COLUNAS.campos, body: campos }, layout: linhasFinas }]);

    /* as escalas trocadas: 2.1, 2.2... */
    conteudo = conteudo.concat(secao(t.secaoEscalas));
    var numeroEscalas = numero;
    conteudo.push(ajuda(t.escalasAjuda));
    /* o dia que saiu sozinho (as várias trocas com um dia cancelado) fica riscado; com o registro inteiro cancelado, o quadro diz */
    var riscar = !(fim && fim.tipo === 'cancelamento');
    conteudo.push({ table: { widths: COLUNAS.escalas, body: (r.itens || []).map(function (it, i) {
      var saiu = riscar && it.cancelada;
      var estilo = saiu ? { decoration: 'lineThrough', color: c.suave } : { color: c.forte };
      var frase = Object.assign({ text: t.itemFrase(it.cumpre, it.no_lugar_de), fontSize: FONTE.texto }, estilo);
      return [{ text: numeroEscalas + '.' + (i + 1), fontSize: FONTE.celula, color: c.suave },
              Object.assign({ text: dataDoItem(it), fontSize: FONTE.texto }, estilo),
              saiu && it.cancelada_em ? { stack: [frase, { text: t.canceladaEm(it.cancelada_em), fontSize: FONTE.ajuda, color: c.suave, margin: [0, 2, 0, 0] }] } : frase];
    }) }, layout: linhasFinas });

    /* o saldo de horas, só quando a conta entre dois militares não fecha */
    if ((r.saldo || []).length) {
      conteudo = conteudo.concat(secao(t.secaoSaldo), (r.saldo || []).map(function (s) {
        return { text: t.saldoFrase(s.deve, RW.tempo.horas(s.minutos), s.a), fontSize: FONTE.texto, color: c.forte, margin: MARGEM.observacoes };
      }));
    }

    /* as ações, em ordem de data (os aceites que faltam no fim, como Pendente); as ocorrências com o detalhe e o motivo
       embaixo; a linha não se parte entre duas folhas */
    conteudo = conteudo.concat(secao(t.secaoAcoes), [ajuda(t.acoesAjuda), { table: { headerRows: 1, dontBreakRows: true, widths: COLUNAS.acoes,
      body: [t.colunas.map(function (h) { return { text: h, bold: true, fontSize: FONTE.cabecalho, color: c.suave }; })].concat((r.acoes || []).map(function (a) {
        var rotulo = a.acao === 'aprovacao' && r.altera ? t.acoes.aprovacao_alteracao : (t.acoes[a.acao] || '');
        var acao = [{ text: rotulo, fontSize: FONTE.celula, color: c.forte }];
        if (a.detalhe) acao.push({ text: a.detalhe, fontSize: FONTE.celula, color: c.suave, margin: [0, 1, 0, 0] });
        if (a.motivo) acao.push({ text: comPonto(t.motivoAcao(a.motivo)), fontSize: FONTE.celula, color: c.suave, margin: [0, 1, 0, 0] });
        return [{ text: a.quando || t.pendente, fontSize: FONTE.celula, color: a.quando ? c.forte : c.suave },
                { stack: acao },
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

  /* um ou mais registros num arquivo só (cada um começa numa folha nova). Com algum que não vale mais, desenha duas vezes:
     a 1ª acha em que folha começa cada registro (pelo título), a 2ª põe a marca d'água nas folhas dele. O conteúdo é
     montado de novo a cada desenho (a biblioteca do PDF mexe no que recebe) */
  function arquivo(registros) {
    return P().preparar().then(function (c) {
      function conteudo() {
        var todo = [];
        registros.forEach(function (r, i) {
          var partes = conteudoDoRegistro(r, c);
          if (i) partes[0].pageBreak = 'before';
          todo = todo.concat(partes);
        });
        return todo;
      }
      var titulo = registros.length === 1 ? txt().numero(registros[0].registro.numero, registros[0].registro.ano) : txt().titulo;
      var comMarca = registros.some(function (r) { return r.encerramento && txt().encerramento.marca[r.encerramento.tipo]; });
      if (!comMarca) return P().desenhar(documento(conteudo(), titulo, c), c).then(function (d) { return d.arquivo; });
      var marcadores = registros.map(function () { return { texto: txt().titulo }; });
      return P().desenhar(documento(conteudo(), titulo, c), c, marcadores).then(function (primeiro) {
        var inicios = primeiro.folhas;
        if (!inicios) return primeiro.arquivo;   // não achou onde cada registro começa: sai sem a marca
        var doc = documento(conteudo(), titulo, c);
        doc.background = function (folha, tamanho) {
          var i = -1;
          inicios.forEach(function (inicio, k) { if (folha >= inicio) i = k; });
          var f = i >= 0 ? registros[i].encerramento : null;
          return f && txt().encerramento.marca[f.tipo] ? marca(f, tamanho, c) : null;
        };
        return P().desenhar(doc, c).then(function (d) { return d.arquivo; }, function () { return primeiro.arquivo; });
      });
    });
  }

  /* o registro e, quando ele foi substituído, cada um que veio depois, até o que vale (no máximo SEQUENCIA_MAXIMA) */
  function sequencia(trocaId) {
    var lidos = [];
    function ler(id) {
      return RW.rpc('fn_trocas_registro', { p_troca_id: id }).then(function (r) {
        if (!r || !r.ok) { if (!lidos.length) throw r || {}; return lidos; }
        lidos.push(r);
        var f = r.encerramento;
        return f && f.tipo === 'substituicao' && f.troca_id && lidos.length < SEQUENCIA_MAXIMA ? ler(f.troca_id) : lidos;
      });
    }
    return ler(trocaId);
  }

  /* o clique do botão: pontinhos no botão, lê o registro (e a sequência), desenha e baixa; a recusa do banco ou a falha vira aviso */
  function imprimir(trocaId, botao) {
    var m = RW.mensagens.trocas;
    function parar() { if (botao && RW.pararCarregando) RW.pararCarregando(botao); }
    function avisar(texto) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: texto }); }
    if (botao && RW.iniciarCarregando) RW.iniciarCarregando(botao);
    return sequencia(trocaId).then(function (registros) {
      return arquivo(registros).then(function (arq) {
        parar();
        P().baixar(arq, txt().arquivo(registros[0].registro.numero, registros[0].registro.ano));
      });
    }).catch(function (r) { parar(); avisar((r && r.erro) || m.falhaRegistro); });
  }

  RW.trocasRegistroPdf = { imprimir: imprimir, arquivo: arquivo };
})();
