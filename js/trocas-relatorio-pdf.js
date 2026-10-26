/* ============================================================
   TROCAS — os PDFs Lista e Alterações do painel Imprimir trocas (no
   formato dos relatórios do sistema)
   Um bloco cinza por unidade (a do dia do serviço, com quantas
   trocas ou alterações) e, dentro, um bloquinho branco por registro.
   Na Lista, uma linha por troca: o número RW, os dias (o serviço e a
   devolução, cada um com quem cumpre no lugar de quem), a Parte, os
   aceites e a aprovação, com a data e a hora. Nas Alterações, o
   número RW e os dias, e uma linha por alteração do livro de
   ocorrências (correção, alteração do pedido, substituição,
   cancelamento e expiração), com o detalhe, o motivo, quem fez e
   quando. No fim, a nota de quando foi gerado. Usa as peças do PDF
   da escala (escalas-impressao-pdf.js: biblioteca, cores do tema,
   medidas, blocos arredondados e download).
   RosterWork.trocasRelatorioPdf.{ arquivo, alteracoes }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var COLUNAS = { lista: [50, '*', 42, 112, 100],    // RW nº · serviço e devolução · parte · aceites · aprovação
                  alteracoes: [50, '*', 150, 112] };  // RW nº · serviço e devolução · alteração · quem e quando
  var FONTE = { celula: 8.5, numero: 9.5 };
  var LINHA = { entreTrocas: 0.5 };
  var RESPIRO = { cabecalho: 2, troca: 5, entreDias: 3, entreAlteracoes: 8 };
  var ACEITES = ['solicitacao', 'aceite'];
  var APROVACOES = ['aprovacao', 'registro_aprovacao', 'recusa'];
  var ALTERACOES = ['correcao', 'alteracao_pedido', 'substituicao', 'cancelamento', 'expiracao'];

  function P() { return RW.escalasImpressaoPdf; }
  function M() { return P().medidas; }
  function txt() { return RW.mensagens.trocas.imprimir.pdf; }
  function txtAlteracoes() { return RW.mensagens.trocas.imprimir.alteracoes; }
  function hora(t) { return String(t || '08:00').slice(0, 5); }
  function comPonto(t) { t = String(t || '').trim(); return /[.!?]$/.test(t) ? t : t + '.'; }

  /* ---------- peças (as do PDF da escala) ---------- */
  /* o bloco cinza da unidade: o título, o cabeçalho das colunas e um bloquinho por registro, sem vão entre eles
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
  /* o bloquinho branco de um registro (papel: 'cabecalho', 'primeira', 'troca', 'ultima' ou 'unica'): a linha fina
     em cima, menos no primeiro; uma linha de tabela por troca (Lista) ou por alteração (Alterações) */
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
      paddingTop: function (i) { return papel === 'cabecalho' ? B.topo : i ? RESPIRO.entreAlteracoes : RESPIRO.troca; },
      paddingBottom: function (i, no) {
        if (papel === 'cabecalho') return RESPIRO.cabecalho;
        return i < no.table.body.length - 1 ? 0 : fim ? B.base : RESPIRO.troca;
      },
      fillColor: function () { return preencher ? c.papel : null; }
    };
  }
  function bloquinho(linhas, larguras, c, preencher, papel) {
    return { table: { widths: larguras, body: linhas }, layout: layoutBloquinho(c, preencher, papel) };
  }
  function cabecalhoColunas(colunas, c) {
    return colunas.map(function (t) {
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
  function numeroRw(r, c) { return texto(txt().numero(r.registro.numero, r.registro.ano), c.forte, { bold: true, fontSize: FONTE.numero, noWrap: true }); }

  /* os dias do registro: o serviço e a devolução de cada troca, com quem cumpre no lugar de quem; o dia cancelado
     fica riscado */
  function diasDoRegistro(r, c) {
    var t = txt();
    return { stack: (r.itens || []).map(function (it, i, todos) {
      var inteiro = hora(it.inicio) === '08:00' && hora(it.fim) === '08:00';
      var periodo = inteiro ? t.servicoInteiro : t.trecho(RW.horario.curta(hora(it.inicio)), RW.horario.curta(hora(it.fim)));
      var risco = it.cancelada ? { decoration: 'lineThrough' } : null;
      return { stack: [texto(t.dia(RW.trocasFormato.dataLonga(it.data), periodo), it.cancelada ? c.suave : c.forte, risco),
                       texto(t.noLugar(it.cumpre, it.no_lugar_de), c.suave, risco)],
        margin: [0, 0, 0, i === todos.length - 1 ? 0 : RESPIRO.entreDias] };
    }) };
  }

  /* ---------- Lista: uma linha por troca ---------- */
  function linhaDaTroca(r, c) {
    var t = txt();
    var acoes = r.acoes || [];
    var aceites = acoes.filter(function (a) { return ACEITES.indexOf(a.acao) >= 0; }).map(function (a, i, todos) {
      return { stack: [texto(a.militar, c.forte), texto(a.quando ? quando(a.quando) : t.pendente, c.suave)],
        margin: [0, 0, 0, i === todos.length - 1 ? 0 : RESPIRO.entreDias] };
    });
    var aprovacao = acoes.filter(function (a) { return APROVACOES.indexOf(a.acao) >= 0 && a.quando; })[0];
    var colunaAprovacao = !aprovacao ? texto(t.aguardando, c.suave) : { stack: [texto(aprovacao.militar, c.forte), texto(quando(aprovacao.quando), c.suave)]
      .concat(aprovacao.acao === 'registro_aprovacao' ? [texto(t.registrou, c.suave)] : aprovacao.acao === 'recusa' ? [texto(t.recusou, c.suave)] : []) };
    return [
      numeroRw(r, c),
      diasDoRegistro(r, c),
      texto(r.parte ? t.parte(r.parte.numero, r.parte.ano) : t.semParte, r.parte ? c.forte : c.suave),
      { stack: aceites },
      colunaAprovacao
    ];
  }

  /* ---------- Alterações: uma linha por alteração do registro, em ordem de data ---------- */
  function alteracoesDe(r) { return (r.acoes || []).filter(function (a) { return ALTERACOES.indexOf(a.acao) >= 0; }); }

  /* o número e os dias ocupam as linhas do registro inteiro; em cada linha, o que aconteceu (o rótulo do registro
     técnico), o detalhe, o motivo, quem fez (a expiração é da rotina) e quando */
  function linhasDasAlteracoes(r, c) {
    var t = txtAlteracoes(), rotulos = RW.mensagens.trocas.registroPdf.acoes, lista = alteracoesDe(r);
    return lista.map(function (a, i) {
      var alteracao = [texto(rotulos[a.acao], c.forte, { bold: true })];
      if (a.detalhe) alteracao.push(texto(a.detalhe, c.suave));
      if (a.motivo) alteracao.push(texto(t.motivo(comPonto(a.motivo)), c.texto));
      var numero = i ? {} : numeroRw(r, c), dias = i ? {} : diasDoRegistro(r, c);
      if (!i) numero.rowSpan = dias.rowSpan = lista.length;
      return [numero, dias, { stack: alteracao }, { stack: [texto(a.militar || t.rotina, c.forte), texto(quando(a.quando), c.suave)] }];
    });
  }

  /* as duas formas: os textos, as colunas, as linhas de cada registro e as contagens */
  var FORMAS = {
    lista: {
      textos: txt, larguras: COLUNAS.lista,
      linhas: function (r, c) { return [linhaDaTroca(r, c)]; },
      detalhe: function (lista) { return txt().unidadeDetalhe(lista.length); },
      subtitulo: function (mes, registros) { return txt().subtitulo(mes, registros.length); }
    },
    alteracoes: {
      textos: txtAlteracoes, larguras: COLUNAS.alteracoes,
      linhas: linhasDasAlteracoes,
      detalhe: function (lista) { return txtAlteracoes().unidadeDetalhe(contarAlteracoes(lista)); },
      subtitulo: function (mes, registros) { return txtAlteracoes().subtitulo(mes, contarAlteracoes(registros)); }
    }
  };
  function contarAlteracoes(registros) { return registros.reduce(function (n, r) { return n + alteracoesDe(r).length; }, 0); }

  /* ---------- o documento ---------- */
  function montar(registros, mes, c, preencher, forma) {
    var t = forma.textos(), F = M().FONTE, pdf = RW.mensagens.escala.impressao.pdf;
    /* os registros agrupados pela unidade do dia do serviço */
    var grupos = {};
    registros.forEach(function (r) { (grupos[r.unidade || ''] = grupos[r.unidade || ''] || []).push(r); });
    var blocos = Object.keys(grupos).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }).map(function (unidade) {
      var lista = grupos[unidade];
      var titulo = { columns: [{ text: unidade, bold: true, fontSize: F.unidade, color: c.forte },
        { text: forma.detalhe(lista), alignment: 'right', width: 'auto', fontSize: F.detalhe, color: c.suave, margin: [0, 2, 0, 0] }], margin: M().CELULA.titulo };
      /* o título e o cabeçalho repetem em cada folha; o registro não se parte entre duas folhas */
      var corpo = [[titulo], [bloquinho([cabecalhoColunas(t.colunas, c)], forma.larguras, c, preencher, 'cabecalho')]].concat(lista.map(function (r, i) {
        var papel = lista.length === 1 ? 'unica' : i === 0 ? 'primeira' : i === lista.length - 1 ? 'ultima' : 'troca';
        return [bloquinho(forma.linhas(r, c), forma.larguras, c, preencher, papel)];
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
        { text: forma.subtitulo(mes, registros), fontSize: F.data, color: c.suave, margin: [0, 2, 0, M().ESPACO.aposData] }
      ].concat(blocos, [{ text: txt().nota(gerado[0], (gerado[1] || '').slice(0, 5)), fontSize: F.detalhe, color: c.suave, margin: [0, 4, 0, 0] }])
    };
  }

  /* desenha com fundos quadrados, lê onde ficou cada bloco e redesenha arredondado (se o texto não bate, fica o 1º) */
  function desenhar(registros, mes, forma) {
    return P().preparar().then(function (c) {
      return P().desenhar(montar(registros, mes, c, true, forma), c).then(function (reto) {
        var doc = montar(registros, mes, c, false, forma);
        doc.background = function (folha) { return P().blocosArredondados(reto.caixas[folha - 1], c); };
        return P().desenhar(doc, c).then(function (redondo) {
          return redondo.assinatura === reto.assinatura ? redondo.arquivo : reto.arquivo;
        }, function () { return reto.arquivo; });
      });
    });
  }

  function arquivo(registros, mes) { return desenhar(registros, mes, FORMAS.lista); }
  function alteracoes(registros, mes) { return desenhar(registros, mes, FORMAS.alteracoes); }

  RW.trocasRelatorioPdf = { arquivo: arquivo, alteracoes: alteracoes };
})();
