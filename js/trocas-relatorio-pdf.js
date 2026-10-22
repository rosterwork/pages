/* ============================================================
   TROCAS — o PDF Lista do painel Imprimir trocas (no formato dos
   relatórios do sistema)
   Um bloco cinza por unidade (a do dia do serviço, com quantas
   trocas) e, dentro, uma linha por troca: o número RW, os dias (o
   serviço e a devolução, cada um com quem cumpre no lugar de quem),
   a Parte, os aceites e a aprovação, com a data e a hora. No fim, a
   nota de quando foi gerado. Usa as peças do PDF da escala
   (escalas-impressao-pdf.js: biblioteca, cores do tema, medidas,
   blocos arredondados e download). RosterWork.trocasRelatorioPdf.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var COLUNAS = [50, '*', 42, 112, 100];       // RW nº · serviço e devolução · parte · aceites · aprovação
  var FONTE = { celula: 8.5, numero: 9.5 };
  var LINHA = { entreTrocas: 0.5 };
  var RESPIRO = { cabecalho: 2, troca: 5, entreDias: 3 };
  var ACEITES = ['solicitacao', 'aceite'];
  var APROVACOES = ['aprovacao', 'registro_aprovacao', 'recusa'];

  function P() { return RW.escalasImpressaoPdf; }
  function M() { return P().medidas; }
  function txt() { return RW.mensagens.trocas.imprimir.pdf; }
  function hora(t) { return String(t || '08:00').slice(0, 5); }

  /* ---------- peças (as do PDF da escala) ---------- */
  /* o bloco cinza da unidade: o título, o cabeçalho das colunas e uma linha por troca, sem vão entre as linhas
     (os bloquinhos brancos se encostam e viram uma caixa só) */
  function layoutBloco(c, preencher) {
    var B = M().BLOCO;
    return {
      hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; },
      paddingLeft: function () { return B.lado; }, paddingRight: function () { return B.lado; },
      paddingTop: function (i) { return i === 0 ? B.topo : i === 1 ? B.vao : 0; },
      paddingBottom: function (i, no) { return i === 0 ? B.vao : i === no.table.body.length - 1 ? B.base : 0; },
      fillColor: function () { return preencher ? c.fundo : null; }
    };
  }
  /* uma linha do bloquinho branco (papel: 'cabecalho', 'primeira', 'troca', 'ultima' ou 'unica'): a linha fina em
     cima de cada troca, menos da primeira */
  function layoutBloquinho(c, preencher, papel) {
    var B = M().BLOQUINHO;
    var linhaEmCima = papel === 'troca' || papel === 'ultima';
    var fim = papel === 'ultima' || papel === 'unica';
    return {
      hLineWidth: function (i) { return i === 0 && linhaEmCima ? LINHA.entreTrocas : 0; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return c.borda; },
      paddingLeft: function (i) { return i === 0 ? B.lado : 0; },
      paddingRight: function (i, no) { return i === no.table.widths.length - 1 ? B.lado : B.entreColunas; },
      paddingTop: function () { return papel === 'cabecalho' ? B.topo : RESPIRO.troca; },
      paddingBottom: function () { return papel === 'cabecalho' ? RESPIRO.cabecalho : fim ? B.base : RESPIRO.troca; },
      fillColor: function () { return preencher ? c.papel : null; }
    };
  }
  function bloquinho(linha, c, preencher, papel) {
    return { table: { widths: COLUNAS, body: [linha] }, layout: layoutBloquinho(c, preencher, papel) };
  }
  function cabecalhoColunas(c) {
    return txt().colunas.map(function (t) {
      return { text: t.toLocaleUpperCase('pt-BR'), bold: true, fontSize: M().FONTE.posto, characterSpacing: M().ESPACAMENTO_CAIXA_ALTA, color: c.forte };
    });
  }
  function texto(valor, cor, extra) {
    var no = { text: valor || '', fontSize: FONTE.celula, color: cor };
    Object.keys(extra || {}).forEach(function (k) { no[k] = extra[k]; });
    return no;
  }
  /* "08/10/2026, 14:32" (o banco manda com os segundos) */
  function quando(valor) {
    var p = String(valor).split(' ');
    return txt().quando(p[0], (p[1] || '').slice(0, 5));
  }

  /* ---------- uma troca ---------- */
  function linhaDaTroca(r, c) {
    var t = txt();
    var dias = (r.itens || []).map(function (it, i, todos) {
      var inteiro = hora(it.inicio) === '08:00' && hora(it.fim) === '08:00';
      var periodo = inteiro ? t.servicoInteiro : t.trecho(RW.horario.curta(hora(it.inicio)), RW.horario.curta(hora(it.fim)));
      return { stack: [texto(t.dia(RW.trocasFormato.dataLonga(it.data), periodo), c.forte), texto(t.noLugar(it.cumpre, it.no_lugar_de), c.suave)],
        margin: [0, 0, 0, i === todos.length - 1 ? 0 : RESPIRO.entreDias] };
    });
    var acoes = r.acoes || [];
    var aceites = acoes.filter(function (a) { return ACEITES.indexOf(a.acao) >= 0; }).map(function (a, i, todos) {
      return { stack: [texto(a.militar, c.forte), texto(a.quando ? quando(a.quando) : t.pendente, c.suave)],
        margin: [0, 0, 0, i === todos.length - 1 ? 0 : RESPIRO.entreDias] };
    });
    var aprovacao = acoes.filter(function (a) { return APROVACOES.indexOf(a.acao) >= 0 && a.quando; })[0];
    var colunaAprovacao = !aprovacao ? texto(t.aguardando, c.suave) : { stack: [texto(aprovacao.militar, c.forte), texto(quando(aprovacao.quando), c.suave)]
      .concat(aprovacao.acao === 'registro_aprovacao' ? [texto(t.registrou, c.suave)] : aprovacao.acao === 'recusa' ? [texto(t.recusou, c.suave)] : []) };
    return [
      texto(t.numero(r.registro.numero, r.registro.ano), c.forte, { bold: true, fontSize: FONTE.numero, noWrap: true }),
      { stack: dias },
      texto(r.parte ? t.parte(r.parte.numero, r.parte.ano) : t.semParte, r.parte ? c.forte : c.suave),
      { stack: aceites },
      colunaAprovacao
    ];
  }

  /* ---------- o documento ---------- */
  function montar(registros, mes, c, preencher) {
    var t = txt(), F = M().FONTE, pdf = RW.mensagens.escala.impressao.pdf;
    /* as trocas agrupadas pela unidade do dia do serviço */
    var grupos = {};
    registros.forEach(function (r) { (grupos[r.unidade || ''] = grupos[r.unidade || ''] || []).push(r); });
    var blocos = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (unidade) {
      var lista = grupos[unidade];
      var titulo = { columns: [{ text: unidade, bold: true, fontSize: F.unidade, color: c.forte },
        { text: t.unidadeDetalhe(lista.length), alignment: 'right', width: 'auto', fontSize: F.detalhe, color: c.suave, margin: [0, 2, 0, 0] }], margin: M().CELULA.titulo };
      /* o título e o cabeçalho repetem em cada folha; a troca não se parte entre duas folhas */
      var corpo = [[titulo], [bloquinho(cabecalhoColunas(c), c, preencher, 'cabecalho')]].concat(lista.map(function (r, i) {
        var papel = lista.length === 1 ? 'unica' : i === 0 ? 'primeira' : i === lista.length - 1 ? 'ultima' : 'troca';
        return [bloquinho(linhaDaTroca(r, c), c, preencher, papel)];
      }));
      return { table: { widths: ['*'], headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, body: corpo },
        layout: layoutBloco(c, preencher), margin: [0, 0, 0, M().ESPACO.entreUnidades] };
    });
    var gerado = String((registros[0] && registros[0].gerado_em) || '').split(' ');
    return {
      pageSize: 'A4', pageMargins: M().MARGENS,
      defaultStyle: { font: 'Montserrat', fontSize: F.texto, color: c.texto },
      info: { title: t.titulo + ' ' + mes, author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' },
      header: function () { return { svg: c.logo, width: M().LOGO_LARGURA, margin: M().LOGO_MARGEM }; },
      footer: function (pagina, total) {
        return { columns: [{ text: pdf.site }, { text: pdf.pagina(pagina, total), alignment: 'right' }], fontSize: F.rodape, color: c.suave, margin: M().RODAPE_MARGEM };
      },
      content: [
        { text: t.titulo, bold: true, fontSize: F.titulo, color: c.forte },
        { text: t.subtitulo(mes, registros.length), fontSize: F.data, color: c.suave, margin: [0, 2, 0, M().ESPACO.aposData] }
      ].concat(blocos, [{ text: t.nota(gerado[0], (gerado[1] || '').slice(0, 5)), fontSize: F.detalhe, color: c.suave, margin: [0, 4, 0, 0] }])
    };
  }

  /* desenha com fundos quadrados, lê onde ficou cada bloco e redesenha arredondado (se o texto não bate, fica o 1º) */
  function arquivo(registros, mes) {
    return P().preparar().then(function (c) {
      return P().desenhar(montar(registros, mes, c, true), c).then(function (reto) {
        var doc = montar(registros, mes, c, false);
        doc.background = function (folha) { return P().blocosArredondados(reto.caixas[folha - 1], c); };
        return P().desenhar(doc, c).then(function (redondo) {
          return redondo.assinatura === reto.assinatura ? redondo.arquivo : reto.arquivo;
        }, function () { return reto.arquivo; });
      });
    });
  }

  RW.trocasRelatorioPdf = { arquivo: arquivo };
})();
