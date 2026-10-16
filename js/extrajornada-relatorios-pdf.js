/* ============================================================
   EXTRAJORNADA — os PDFs dos relatórios (no formato do PDF da escala)
   Relatório inicial ("Extrajornada: planejamento"): o que foi lançado
   na escala, por unidade (bloco cinza com o nome por extenso), cada
   militar com o RG, as cotas e as datas e horários; no fim, o total.
   Relatório de ajustes ("Extrajornada: ajustes do mês"): só quem mudou
   desde o lançamento, com o que era (riscado), o que ficou e o motivo;
   no fim, quantas extras e se as cotas mudaram. Sem assinatura.
   Usa as peças do PDF da escala (escalas-impressao-pdf.js: biblioteca,
   cores do tema, medidas, blocos arredondados e download). O PDF é
   desenhado aqui, como o da escala (exceção REGRAS §3/§4).
   RosterWork.extrajornadaRelatoriosPdf.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var INI = ['', '08', '14', '20', '02'];
  var FIM = ['', '14', '20', '02', '08'];
  var COLUNAS_INICIAL = [140, 40, '*'];          // militar · cotas · datas e horários
  var COLUNAS_AJUSTES = [130, 92, 92, '*'];      // militar · era · ficou · motivo
  var LARGURA_DIA = 62;

  function P() { return RW.escalasImpressaoPdf; }
  function M() { return P().medidas; }
  function txt() { return RW.mensagens.extrajornada.relatorios.pdf; }
  function rotuloMes(comp) { var p = String(comp).split('-'); var n = MESES[Number(p[1]) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + p[0]; }
  function dia(iso) { var p = String(iso).split('-'); return SEMANA[new Date(+p[0], +p[1] - 1, +p[2]).getDay()] + ' ' + p[2] + '/' + p[1]; }
  function chave(r) { return r.cpf + '|' + r.data + '|' + r.uid + '|' + r.b_ini + '|' + r.b_fim; }

  /* ---------- peças (as mesmas do PDF da escala) ---------- */
  function layoutBloquinho(c, preencher) {
    var B = M().BLOQUINHO;
    return {
      hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; },
      paddingLeft: function (i) { return i === 0 ? B.lado : 0; },
      paddingRight: function (i, no) { return i === no.table.widths.length - 1 ? B.lado : B.entreColunas; },
      paddingTop: function (i) { return i === 0 ? B.topo : B.linha; },
      paddingBottom: function (i, no) { return i === no.table.body.length - 1 ? B.base : B.linha; },
      fillColor: function () { return preencher ? c.papel : null; }
    };
  }
  function layoutBloco(c, preencher) {
    var B = M().BLOCO;
    return {
      hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; },
      paddingLeft: function () { return B.lado; }, paddingRight: function () { return B.lado; },
      paddingTop: function (i) { return i === 0 ? B.topo : B.vao; },
      paddingBottom: function (i, no) { return i === no.table.body.length - 1 ? B.base : B.vao; },
      fillColor: function () { return preencher ? c.fundo : null; }
    };
  }
  function cabecalhoColunas(titulos, c) {
    return titulos.map(function (t) {
      return { text: t.toLocaleUpperCase('pt-BR'), bold: true, fontSize: M().FONTE.posto, characterSpacing: M().ESPACAMENTO_CAIXA_ALTA, color: c.forte };
    });
  }
  function militar(m, c) {
    var F = M().FONTE;
    return { stack: [
      { text: [{ text: (m.grad || '') + ' ', fontSize: F.grad, color: c.suave }, { text: m.nome || '', bold: true, fontSize: F.nome, color: c.forte }] },
      { text: txt().rg(m.rg || ''), fontSize: F.detalhe, color: c.suave, margin: [0, 1, 0, 0] }
    ] };
  }
  function hora(r, c, riscar) {
    var F = M().FONTE;
    var risco = riscar ? 'lineThrough' : undefined;
    return { columns: [
      { text: INI[r.b_ini] + 'h', width: 'auto', decoration: risco },
      { svg: c.seta, width: M().SETA_LARGURA, margin: M().SETA_MARGEM },
      { text: FIM[r.b_fim] + 'h', width: 'auto', decoration: risco }
    ], columnGap: 4, fontSize: F.hora, color: riscar ? c.suave : c.texto };
  }
  /* uma data na linha: o dia, o horário e, se a extra é em outra unidade, a sigla dela */
  function dataEmLinha(r, c, outraUnidade) {
    var F = M().FONTE;
    var col = [{ text: dia(r.data), width: LARGURA_DIA, fontSize: F.hora, color: c.texto }, hora(r, c, false)];
    if (outraUnidade) col.push({ text: outraUnidade, width: 'auto', fontSize: F.detalhe, color: c.suave });
    return { columns: col, columnGap: 4, margin: [0, 0, 0, 1.5] };
  }
  /* uma data empilhada (Era e Ficou): o dia em cima e o horário embaixo */
  function dataEmpilhada(r, c, riscar) {
    var F = M().FONTE;
    return { stack: [
      { text: dia(r.data), fontSize: F.hora, color: riscar ? c.suave : c.texto, decoration: riscar ? 'lineThrough' : undefined, margin: [0, 0, 0, 1.5] },
      hora(r, c, riscar)
    ], margin: [0, 0, 0, 3] };
  }
  function tituloUnidade(u, detalhe, c) {
    var F = M().FONTE;
    var sigla = (u.tipo === 'PEL' && u.pai ? u.pai + ' / ' : '') + u.nome + (u.cidade ? ' · ' + u.cidade : '');
    return { stack: [
      { text: u.nome_completo || u.nome, bold: true, fontSize: F.unidade, color: c.forte },
      { columns: [{ text: sigla }, { text: detalhe, alignment: 'right', width: 'auto' }], fontSize: F.detalhe, color: c.suave, margin: [0, 1, 0, 0] }
    ], margin: M().CELULA.titulo };
  }
  function blocoUnidade(titulo, bloquinho, c, preencher) {
    return { table: { widths: ['*'], body: [[titulo], [bloquinho]] }, layout: layoutBloco(c, preencher),
      margin: [0, 0, 0, M().ESPACO.entreUnidades], unbreakable: true };
  }
  function documento(titulo, subtitulo, conteudo, c) {
    var F = M().FONTE, t = RW.mensagens.escala.impressao.pdf;
    return {
      pageSize: 'A4', pageMargins: M().MARGENS,
      defaultStyle: { font: 'Montserrat', fontSize: F.texto, color: c.texto },
      info: { title: titulo + ' ' + subtitulo, author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' },
      header: function () { return { svg: c.logo, width: M().LOGO_LARGURA, margin: M().LOGO_MARGEM }; },
      footer: function (pagina, total) {
        return { columns: [{ text: t.site }, { text: t.pagina(pagina, total), alignment: 'right' }], fontSize: F.rodape, color: c.suave, margin: M().RODAPE_MARGEM };
      },
      content: [
        { text: titulo, bold: true, fontSize: F.titulo, color: c.forte },
        { text: subtitulo, fontSize: F.data, color: c.suave, margin: [0, 2, 0, M().ESPACO.aposData] }
      ].concat(conteudo)
    };
  }
  function totalLinha(texto, c, margem) {
    return { text: texto, bold: true, fontSize: M().FONTE.nome, color: c.forte, margin: margem || [0, 4, 0, 0] };
  }

  /* ---------- os dados de cada relatório ---------- */
  function porCpf(lista) {
    var m = {};
    (lista || []).forEach(function (x) { m[x.cpf] = x; });
    return m;
  }
  function unidadesDe(r) {
    var m = {};
    (r.unidades || []).forEach(function (u) { m[u.unidade_id] = u; });
    return m;
  }
  /* os militares agrupados pela unidade deles, na ordem das unidades */
  function agrupar(r, cpfs) {
    var mils = porCpf(r.militares);
    var grupos = (r.unidades || []).map(function (u) { return { u: u, ms: [] }; });
    var idx = {};
    grupos.forEach(function (g, i) { idx[g.u.unidade_id] = i; });
    (r.militares || []).forEach(function (m) {
      if (!cpfs[m.cpf]) return;
      var i = idx[m.unidade_id];
      if (i == null) { grupos.push({ u: { unidade_id: m.unidade_id, nome: '', nome_completo: '' }, ms: [] }); i = idx[m.unidade_id] = grupos.length - 1; }
      grupos[i].ms.push(mils[m.cpf]);
    });
    return grupos.filter(function (g) { return g.ms.length; });
  }

  function montarInicial(r, c, preencher) {
    var unidades = unidadesDe(r);
    var runs = {};
    (r.base || []).forEach(function (x) { (runs[x.cpf] = runs[x.cpf] || []).push(x); });
    var totalMil = 0, totalCotas = 0;
    var conteudo = agrupar(r, runs).map(function (g) {
      var cotasUn = 0;
      var linhas = g.ms.map(function (m) {
        var lista = runs[m.cpf] || [];
        var cotas = lista.reduce(function (s, x) { return s + (x.b_fim - x.b_ini + 1); }, 0);
        cotasUn += cotas;
        return [militar(m, c), { text: String(cotas), bold: true, fontSize: M().FONTE.nome, color: c.forte },
          { stack: lista.map(function (x) { return dataEmLinha(x, c, x.uid !== m.unidade_id && unidades[x.uid] ? unidades[x.uid].nome : ''); }) }];
      });
      totalMil += g.ms.length;
      totalCotas += cotasUn;
      var corpo = [cabecalhoColunas([txt().colMilitar, txt().colCotas, txt().colDatas], c)].concat(linhas);
      return blocoUnidade(tituloUnidade(g.u, txt().unidadeInicial(g.ms.length, cotasUn), c),
        { table: { widths: COLUNAS_INICIAL, body: corpo }, layout: layoutBloquinho(c, preencher) }, c, preencher);
    });
    conteudo.push(totalLinha(txt().totalInicial(totalMil, totalCotas), c));
    return documento(txt().tituloInicial, txt().subInicial(rotuloMes(r.competencia), r.lancamento.data), conteudo, c);
  }

  /* quem mudou desde o lançamento: o que saiu (era) e o que entrou (ficou), por militar */
  function mudancas(r) {
    var naBase = {}, noAtual = {}, por = {};
    (r.base || []).forEach(function (x) { naBase[chave(x)] = true; });
    (r.atual || []).forEach(function (x) { noAtual[chave(x)] = true; });
    (r.base || []).forEach(function (x) { if (!noAtual[chave(x)]) (por[x.cpf] = por[x.cpf] || { era: [], ficou: [] }).era.push(x); });
    (r.atual || []).forEach(function (x) { if (!naBase[chave(x)]) (por[x.cpf] = por[x.cpf] || { era: [], ficou: [] }).ficou.push(x); });
    return por;
  }
  function somaCotas(lista) { return (lista || []).reduce(function (s, x) { return s + (x.b_fim - x.b_ini + 1); }, 0); }

  function montarAjustes(r, c, preencher) {
    var mud = mudancas(r);
    var motivos = porCpf(r.ajustes);
    var F = M().FONTE;
    var total = 0;
    var conteudo = agrupar(r, mud).map(function (g) {
      var linhas = g.ms.map(function (m) {
        var x = mud[m.cpf];
        total++;
        var era = x.era.length ? { stack: x.era.map(function (e) { return dataEmpilhada(e, c, true); }) } : { text: txt().nova, fontSize: F.texto, color: c.suave };
        var ficou = x.ficou.length ? { stack: x.ficou.map(function (f) { return dataEmpilhada(f, c, false); }) } : { text: txt().retirada, fontSize: F.texto, color: c.suave };
        var a = motivos[m.cpf];
        return [militar(m, c), era, ficou, { text: (a && a.motivo) || txt().semMotivo, fontSize: F.texto, color: c.texto }];
      });
      var corpo = [cabecalhoColunas([txt().colMilitar, txt().colEra, txt().colFicou, txt().colMotivo], c)].concat(linhas);
      return blocoUnidade(tituloUnidade(g.u, txt().unidadeAjustes(g.ms.length), c),
        { table: { widths: COLUNAS_AJUSTES, body: corpo }, layout: layoutBloquinho(c, preencher) }, c, preencher);
    });
    if (!total) conteudo.push({ text: txt().semAjustes, fontSize: F.texto, color: c.texto, margin: [0, 0, 0, 4] });
    conteudo.push(totalLinha(txt().totalAjustes(total, somaCotas(r.base), somaCotas(r.atual)), c, [0, 4, 0, 2]));
    conteudo.push({ text: txt().quemNaoAparece(r.lancamento.data), fontSize: F.texto, color: c.suave });
    return documento(txt().tituloAjustes, txt().subAjustes(rotuloMes(r.competencia), r.lancamento.data), conteudo, c);
  }

  /* ---------- o arquivo: desenha com fundos quadrados, lê onde ficou cada bloco e redesenha arredondado ---------- */
  function gerarArquivo(montar, r) {
    return P().preparar().then(function (c) {
      return P().desenhar(montar(r, c, true), c).then(function (reto) {
        var doc = montar(r, c, false);
        doc.background = function (folha) { return P().blocosArredondados(reto.caixas[folha - 1], c); };
        return P().desenhar(doc, c).then(function (redondo) {
          return redondo.assinatura === reto.assinatura ? redondo.arquivo : reto.arquivo;
        }, function () { return reto.arquivo; });
      });
    });
  }

  function nomeArquivo(prefixo, comp) { return prefixo + '-' + String(comp).slice(5, 7) + '-' + String(comp).slice(0, 4) + '.pdf'; }

  function inicial(r) {
    return gerarArquivo(montarInicial, r).then(function (arq) { P().baixar(arq, nomeArquivo(txt().arquivoInicial, r.competencia)); });
  }
  function ajustes(r) {
    return gerarArquivo(montarAjustes, r).then(function (arq) { P().baixar(arq, nomeArquivo(txt().arquivoAjustes, r.competencia)); });
  }

  RW.extrajornadaRelatoriosPdf = { inicial: inicial, ajustes: ajustes, mudancas: mudancas };
})();
