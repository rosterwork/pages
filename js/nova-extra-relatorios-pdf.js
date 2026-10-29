/* ============================================================
   NOVA EXTRA — os PDFs dos relatórios (Pedidos, Termos e cotas,
   Relatório inicial e Relatório final), no padrão do registro RW das
   trocas (trocas-registro-pdf.js): o título em caixa alta, o Mês, a
   Unidade e o Gerado em no alto, as seções numeradas com a linha
   embaixo, a ajuda em cinza, as tabelas sem fundo só com a linha fina
   entre as linhas e as Observações numeradas no fim.
   Nas tabelas: o militar com o nome completo (o posto e o nome de
   guerra em negrito) na 1ª coluna, que ocupa o espaço que sobra; o
   CPF; as outras colunas no centro (também na altura da linha); as
   datas com o ano; a ordem de antiguidade; a linha de total em cada
   tabela. As opções de quem imprime: um pelotão ou todos e, com todos,
   uma tabela por pelotão (2.1, 2.2...) ou a lista única (com a coluna
   Pelotão). O Relatório final tem como ficou no fim do mês e o que
   mudou desde o lançamento (era, ficou, motivo e quem ajustou).
   Usa as peças do PDF da escala (escalas-impressao-pdf.js: biblioteca,
   fontes, logo, cores do tema e download). O PDF é desenhado aqui
   (exceção REGRAS §3/§4).
   RosterWork.novaExtraRelatoriosPdf.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var INI = ['', '08h', '14h', '20h', '02h'];
  var FIM = ['', '14h', '20h', '02h', '08h'];
  /* as medidas do registro RW das trocas (pontos) */
  var FONTE = { titulo: 13, rotulo: 8, valor: 10, secao: 9.5, texto: 9.5, celula: 9, cabecalho: 8.5, ajuda: 8 };
  var MARGEM = { cabecalho: [0, 10, 0, 0], secao: [0, 16, 0, 4], ajuda: [0, 4, 0, 2], observacoes: [0, 6, 0, 0], subsecao: [0, 10, 0, 0] };
  var LINHA = { secao: 0.75, tabela: 0.5 };
  var CELULA = { lado: 6, vertical: 5 };
  var ESPACAMENTO_CAIXA_ALTA = { titulo: 0.4, secao: 0.6 };
  var ALTURA_LINHA = FONTE.celula * 1.22 * 1.15;   // uma linha de texto da célula (a fonte e o lineHeight do documento)
  var LETRA = 0.52;                                // a largura média de uma letra, em vezes a fonte (estimativa das linhas)
  var LINHAS_INTEIRAS = 30;                        // até aqui a tabela não se parte entre duas folhas
  var LARGURA = { cpf: 72, pelotao: 40, pedidoEm: 62, cotasPedidas: 70, termo: 40, pediu: 34, recebeu: 44, data: 58, horario: 86, cotas: 36,
                  era: 58, ficou: 58, motivo: 92, ajustadoPor: 80, campoRotulo: 150 };

  function P() { return RW.escalasImpressaoPdf; }
  function txt() { return RW.mensagens.novaExtra.relatoriosPdf; }
  function dois(n) { return String(n).padStart(2, '0'); }
  function dataBr(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function rotuloMes(comp) { var p = String(comp).split('-'); var n = MESES[Number(p[1]) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + p[0]; }
  function horario(x) { return txt().horario(INI[x.b_ini], FIM[x.b_fim]); }
  function soma(l) { return (l || []).reduce(function (s, x) { return s + (x.b_fim - x.b_ini + 1); }, 0); }
  function cpfFormatado(c) { var d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : c || ''; }

  /* as extras { cpf, data, unidade, blocos } em trechos contínuos { cpf, data, uid, b_ini, b_fim } */
  function trechos(lista) {
    var saida = [];
    (lista || []).forEach(function (a) {
      var b = (a.blocos || []).map(Number).sort(function (x, y) { return x - y; });
      if (!b.length) return;
      var ini = b[0], ant = b[0];
      for (var i = 1; i <= b.length; i++) {
        if (b[i] === ant + 1) { ant = b[i]; continue; }
        saida.push({ cpf: a.cpf, data: a.data, uid: +a.unidade, b_ini: ini, b_fim: ant });
        ini = b[i]; ant = b[i];
      }
    });
    return saida;
  }

  /* ---------- as peças do registro RW ---------- */
  function pecas(c) {
    var largura = 595 - P().medidas.MARGENS[0] - P().medidas.MARGENS[2];
    var numero = 0;
    var linhasFinas = {
      hLineWidth: function (i) { return i === 0 ? 0 : LINHA.tabela; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return c.borda; },
      paddingLeft: function (i) { return i === 0 ? 0 : CELULA.lado; },
      paddingRight: function () { return CELULA.lado; },
      paddingTop: function () { return CELULA.vertical; },
      paddingBottom: function () { return CELULA.vertical; }
    };
    function linhasDe(t, l) { return typeof t !== 'string' || typeof l !== 'number' ? 1 : Math.max(1, Math.ceil(t.length * FONTE.celula * LETRA / l)); }
    return {
      largura: largura,
      numero: function () { return numero; },
      /* o título da seção (numerado pela ordem em que aparece) com a linha embaixo */
      secao: function (titulo) {
        numero++;
        return [
          { text: txt().secao(numero, titulo), bold: true, fontSize: FONTE.secao, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.secao, margin: MARGEM.secao },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: LINHA.secao, lineColor: c.forte }] }
        ];
      },
      ajuda: function (texto) { return { text: texto, fontSize: FONTE.ajuda, color: c.suave, margin: MARGEM.ajuda }; },
      topo: function (rotulo, valor, negrito) {
        return { stack: [{ text: rotulo, fontSize: FONTE.rotulo, color: c.suave }, { text: valor, fontSize: FONTE.valor, bold: !!negrito, color: c.forte }] };
      },
      /* o resumo: o rótulo em cinza e o valor */
      campos: function (lista) {
        return { table: { widths: [LARGURA.campoRotulo, '*'], body: lista.map(function (x) {
          return [{ text: x[0], fontSize: FONTE.celula, color: c.suave }, { text: x[1], fontSize: FONTE.texto, color: c.forte }];
        }) }, layout: linhasFinas };
      },
      /* uma linha: a 1ª célula à esquerda, as outras no centro, todas descidas para o meio da altura da linha; a célula
         é um texto, uma lista de linhas ou { v, plano, negrito, junta } (plano = o texto simples do nome, para contar as
         linhas; junta = quantas colunas ela ocupa) */
      linha: function (celulas, larguras, negrito) {
        function valor(x) { return x && x.v !== undefined ? x.v : x; }
        var conta = celulas.map(function (x, i) {
          if (x === null) return 0;
          var v = valor(x);
          return Array.isArray(v) ? v.length : linhasDe(x && x.plano ? x.plano : v, larguras[i]);
        });
        var n = Math.max.apply(null, conta);
        return celulas.map(function (x, i) {
          if (x === null) return {};
          var v = valor(x);
          var cel = { stack: (Array.isArray(v) ? v : [v]).map(function (t) { return typeof t === 'object' ? t : { text: t }; }),
            alignment: i === 0 ? 'left' : 'center', fontSize: FONTE.celula, color: c.forte, bold: !!(negrito || (x && x.negrito)),
            margin: [0, (n - conta[i]) * ALTURA_LINHA / 2, 0, 0] };
          if (x && x.junta) cel.colSpan = x.junta;
          return cel;
        });
      },
      tabela: function (larguras, titulos, linhas) {
        var cab = titulos.map(function (t, i) { return { text: t, bold: true, fontSize: FONTE.cabecalho, color: c.suave, alignment: i === 0 ? 'left' : 'center' }; });
        return { table: { headerRows: 1, dontBreakRows: true, widths: larguras, body: [cab].concat(linhas) }, layout: linhasFinas };
      },
      /* o pelotão dentro da seção (2.1, 2.2...) */
      subsecao: function (n, u) {
        return { text: [{ text: n + '   ' + u.nome, bold: true }, { text: u.cidade ? '   ' + u.cidade : '', color: c.suave }],
          fontSize: FONTE.celula, color: c.forte, margin: MARGEM.subsecao };
      },
      /* as Observações com o título (não se separam) */
      observacoes: function (lista) {
        var t = this.secao(txt().secoes.observacoes);
        return { unbreakable: true, stack: t.concat([{ ol: lista, fontSize: FONTE.celula, color: c.texto, margin: MARGEM.observacoes }]) };
      }
    };
  }

  function documento(qual, r, opc, conteudo, c) {
    var M = P().medidas, pdf = RW.mensagens.escala.impressao.pdf, p = pecas(c), t = txt();
    return {
      pageSize: 'A4', pageMargins: M.MARGENS,
      defaultStyle: { font: 'Montserrat', fontSize: FONTE.celula, color: c.texto, lineHeight: 1.15 },
      info: { title: t.titulos[qual], author: 'Roster Work', creator: 'Roster Work', producer: 'Roster Work' },
      header: function () { return { svg: c.logo, width: M.LOGO_LARGURA, margin: M.LOGO_MARGEM }; },
      footer: function (pagina, total) {
        return { columns: [{ text: pdf.site }, { text: pdf.pagina(pagina, total), alignment: 'right' }], fontSize: M.FONTE.rodape, color: c.suave, margin: M.RODAPE_MARGEM };
      },
      content: [
        { text: t.titulos[qual], bold: true, fontSize: FONTE.titulo, color: c.forte, characterSpacing: ESPACAMENTO_CAIXA_ALTA.titulo },
        { columns: [p.topo(t.rotuloMes, rotuloMes(r.competencia), true), p.topo(t.rotuloUnidade, opc.unidade ? unidade(r, opc.unidade).nome : t.todos, true),
          p.topo(t.rotuloGerado, r.geradoEm)], margin: MARGEM.cabecalho }
      ].concat(conteudo)
    };
  }

  /* ---------- quem entra e como se agrupa ---------- */
  function unidade(r, id) { return r.unidades.filter(function (u) { return u.unidade_id === id; })[0] || { nome: '' }; }
  function unidades(r, opc) { return r.unidades.filter(function (u) { return !opc.unidade || u.unidade_id === opc.unidade; }); }
  function daqui(r, opc) { var us = unidades(r, opc); return function (m) { return us.some(function (u) { return u.unidade_id === m.unidade_id; }); }; }
  /* os voluntários das unidades escolhidas, do mais antigo ao mais moderno */
  function voluntarios(r, opc) {
    var eh = daqui(r, opc);
    return r.militares.filter(function (m) { return m.voluntario && eh(m); }).sort(function (a, b) {
      return (a.grau_ordem || 0) - (b.grau_ordem || 0) || (a.antig == null) - (b.antig == null) || (a.antig || 0) - (b.antig || 0) || String(a.nome).localeCompare(b.nome, 'pt-BR');
    });
  }
  /* o nome completo com o posto e o nome de guerra em negrito */
  function nome(m) {
    var completo = m.nome_completo || m.nome || '', guerra = m.nome || '';
    var i = completo.toLocaleLowerCase('pt-BR').indexOf(guerra.toLocaleLowerCase('pt-BR'));
    var partes = [{ text: (m.grad || '') + ' ', bold: true }];
    if (guerra && i >= 0) partes.push({ text: completo.slice(0, i) }, { text: completo.slice(i, i + guerra.length), bold: true }, { text: completo.slice(i + guerra.length) });
    else partes.push({ text: completo });
    return { v: { text: partes }, plano: (m.grad || '') + ' ' + completo };
  }
  /* as tabelas de uma seção: uma por pelotão (n.1, n.2...) ou uma só; a coluna Pelotão entra na lista única, na posição
     pos (2 = depois do CPF); antes = o título da seção e a ajuda, que vão junto com a 1ª tabela */
  function quadros(p, r, opc, lista, colunas, linhaDe, totalDe, pos, antes) {
    var unica = opc.modo === 'unica' && !opc.unidade;
    var cols = colunas.slice();
    if (unica) cols.splice(pos, 0, { titulo: txt().colunas.pelotao, largura: LARGURA.pelotao });
    var larguras = cols.map(function (x) { return x.largura; });
    var fixas = larguras.reduce(function (s, l) { return s + (typeof l === 'number' ? l : 0); }, 0);
    /* a largura que sobra para o militar (só para contar as linhas do nome; a tabela continua com '*') */
    var estimar = larguras.map(function (l) { return typeof l === 'number' ? l : p.largura - fixas - CELULA.lado - 2 * CELULA.lado * (larguras.length - 1); });
    var n = p.numero();
    var grupos = unica || opc.unidade ? [{ u: null, ms: lista }]
      : unidades(r, opc).map(function (u) { return { u: u, ms: lista.filter(function (m) { return m.unidade_id === u.unidade_id; }) }; }).filter(function (g) { return g.ms.length; });
    if (!grupos.length || !grupos[0].ms.length) return [{ stack: antes || [] }];
    return grupos.map(function (g, i) {
      var linhas = g.ms.map(function (m) {
        var cel = linhaDe(m);
        if (unica) cel.splice(pos, 0, unidade(r, m.unidade_id).nome);
        return p.linha(cel, estimar);
      });
      var t = totalDe(g.ms), juntas = cols.length - t.contas.length, cel = [{ v: t.rotulo, junta: juntas }];
      for (var k = 1; k < juntas; k++) cel.push(null);
      linhas.push(p.linha(cel.concat(t.contas), estimar, true));
      var bloco = (i === 0 && antes ? antes : []).concat(g.u ? [p.subsecao(n + '.' + (i + 1), g.u)] : [], [p.tabela(larguras, cols.map(function (x) { return x.titulo; }), linhas)]);
      return { stack: bloco, unbreakable: linhas.length <= LINHAS_INTEIRAS };
    });
  }
  function porCpf(lista) { var o = {}; (lista || []).forEach(function (x) { (o[x.cpf] = o[x.cpf] || []).push(x); }); return o; }
  function dosVoluntarios(vols, lista) { return lista.filter(function (x) { return vols.some(function (m) { return m.cpf === x.cpf; }); }); }
  function somaDe(ms, campo) { return ms.reduce(function (s, m) { return s + (campo(m) || 0); }, 0); }

  /* ---------- Pedidos: a data do pedido e as cotas pedidas ---------- */
  function pedidos(r, opc, c) {
    var p = pecas(c), t = txt(), vols = voluntarios(r, opc), eh = daqui(r, opc), C = t.colunas;
    var cotasDe = function (m) { return m.cotas; };
    var conteudo = p.secao(t.secoes.resumo).concat([p.campos([
      [t.campos.periodo, t.periodo(dataBr(r.abre), dataBr(r.fecha))],
      [t.campos.voluntarios, String(vols.length)],
      [t.campos.cotasPedidas, t.cotas(somaDe(vols, cotasDe))],
      [t.campos.naoQuerem, t.militares(r.militares.filter(function (m) { return eh(m) && m.respondeu && !m.voluntario; }).length)],
      [t.campos.naoResponderam, t.militares(r.militares.filter(function (m) { return eh(m) && !m.respondeu; }).length)]
    ])]);
    conteudo = conteudo.concat(quadros(p, r, opc, vols,
      [{ titulo: C.militar, largura: '*' }, { titulo: C.cpf, largura: LARGURA.cpf }, { titulo: C.pedidoEm, largura: LARGURA.pedidoEm }, { titulo: C.cotasPedidas, largura: LARGURA.cotasPedidas }],
      function (m) { return [nome(m), cpfFormatado(m.cpf), m.pedido_em || '', String(m.cotas || 0)]; },
      function (ms) { return { rotulo: t.total(ms.length), contas: [String(somaDe(ms, cotasDe))] }; },
      2, p.secao(t.secoes.pedidos).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo.push(p.observacoes([t.obs.cota, t.obs.reproduz]));
    return documento('pedidos', r, opc, conteudo, c);
  }

  /* ---------- Termos e cotas: o termo, quantas pediu e quantas recebeu; o total de cada pelotão ---------- */
  function termos(r, opc, c) {
    var p = pecas(c), t = txt(), vols = voluntarios(r, opc), C = t.colunas;
    var recebeu = function (m) { return m.termo ? (m.concedidas || 0) : 0; };
    var com = vols.filter(function (m) { return m.termo; }).length;
    var conteudo = p.secao(t.secoes.resumo).concat([p.campos([
      [t.campos.recebidas, t.cotas(r.cotasRecebidas)],
      [t.campos.repartidas, t.cotas(somaDe(vols, recebeu))],
      [t.campos.comTermo, t.voluntarios(com)],
      [t.campos.semTermo, t.voluntarios(vols.length - com)]
    ])]);
    conteudo = conteudo.concat(quadros(p, r, opc, vols,
      [{ titulo: C.militar, largura: '*' }, { titulo: C.cpf, largura: LARGURA.cpf }, { titulo: C.termo, largura: LARGURA.termo }, { titulo: C.pediu, largura: LARGURA.pediu }, { titulo: C.recebeu, largura: LARGURA.recebeu }],
      function (m) { return [nome(m), cpfFormatado(m.cpf), m.termo ? t.sim : t.nao, String(m.cotas || 0), String(recebeu(m))]; },
      function (ms) { return { rotulo: t.total(ms.length), contas: [String(somaDe(ms, function (m) { return m.cotas; })), String(somaDe(ms, recebeu))] }; },
      2, p.secao(t.secoes.termos).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo.push(p.observacoes([t.obs.semTermo, t.obs.cota, t.obs.reproduz]));
    return documento('termos', r, opc, conteudo, c);
  }

  /* ---------- as extras de cada militar (o inicial e o como ficou do final) ---------- */
  function extras(p, r, opc, lista, antes) {
    var t = txt(), C = t.colunas, por = porCpf(lista);
    return quadros(p, r, opc, voluntarios(r, opc).filter(function (m) { return por[m.cpf]; }),
      [{ titulo: C.militar, largura: '*' }, { titulo: C.cpf, largura: LARGURA.cpf }, { titulo: C.data, largura: LARGURA.data }, { titulo: C.horario, largura: LARGURA.horario }, { titulo: C.cotas, largura: LARGURA.cotas }],
      function (m) {
        var xs = por[m.cpf].slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : a.b_ini - b.b_ini; });
        return [nome(m), cpfFormatado(m.cpf), xs.map(function (x) { return dataBr(x.data); }),
          xs.map(function (x) { return x.uid !== m.unidade_id ? t.outraUnidade(horario(x), unidade(r, x.uid).nome) : horario(x); }), String(soma(xs))];
      },
      function (ms) { return { rotulo: t.total(ms.length), contas: [String(ms.reduce(function (s, m) { return s + soma(por[m.cpf]); }, 0))] }; },
      2, antes);
  }

  function inicial(r, opc, c) {
    var p = pecas(c), t = txt(), base = dosVoluntarios(voluntarios(r, opc), r.base);
    var conteudo = p.secao(t.secoes.resumo).concat([p.campos([
      [t.campos.lancadoEm, r.lancado], [t.campos.lancadoPor, r.lancadoPor],
      [t.campos.comExtra, String(Object.keys(porCpf(base)).length)], [t.campos.lancadas, t.cotas(soma(base))]
    ])]);
    conteudo = conteudo.concat(extras(p, r, opc, r.base, p.secao(t.secoes.lancadas).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo.push(p.observacoes([t.obs.inicial, t.obs.cota, t.obs.reproduz]));
    return documento('inicial', r, opc, conteudo, c);
  }

  /* ---------- Relatório final: como ficou no fim do mês e o que mudou desde o lançamento ---------- */
  function chave(x) { return x.cpf + '|' + x.data + '|' + x.uid + '|' + x.b_ini + '|' + x.b_fim; }
  function datas(lista, vazio) {
    if (!lista.length) return [vazio];
    var saida = [];
    lista.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).forEach(function (x) { saida.push(dataBr(x.data)); saida.push(horario(x)); });
    return saida;
  }
  function final(r, opc, c) {
    var p = pecas(c), t = txt(), C = t.colunas, vols = voluntarios(r, opc);
    var base = dosVoluntarios(vols, r.base), atual = dosVoluntarios(vols, r.atual);
    var naBase = {}, noAtual = {}, mud = {}, ajuste = {};
    base.forEach(function (x) { naBase[chave(x)] = true; });
    atual.forEach(function (x) { noAtual[chave(x)] = true; });
    base.forEach(function (x) { if (!noAtual[chave(x)]) (mud[x.cpf] = mud[x.cpf] || { era: [], ficou: [] }).era.push(x); });
    atual.forEach(function (x) { if (!naBase[chave(x)]) (mud[x.cpf] = mud[x.cpf] || { era: [], ficou: [] }).ficou.push(x); });
    /* os ajustes vêm do mais novo para o mais velho: o primeiro de cada militar é o último que ele teve */
    (r.ajustes || []).forEach(function (a) { if (!ajuste[a.cpf]) ajuste[a.cpf] = a; });
    var mudaram = vols.filter(function (m) { return mud[m.cpf]; });
    var conteudo = p.secao(t.secoes.resumo).concat([p.campos([
      [t.campos.lancadoEm, r.lancado], [t.campos.noLancamento, t.cotas(soma(base))],
      [t.campos.noFim, t.cotas(soma(atual))], [t.campos.ajustadas, String(mudaram.length)]
    ])]);
    conteudo = conteudo.concat(extras(p, r, opc, r.atual, p.secao(t.secoes.comoFicou).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo = conteudo.concat(quadros(p, r, opc, mudaram,
      [{ titulo: C.militar, largura: '*' }, { titulo: C.era, largura: LARGURA.era }, { titulo: C.ficou, largura: LARGURA.ficou }, { titulo: C.motivo, largura: LARGURA.motivo }, { titulo: C.ajustadoPor, largura: LARGURA.ajustadoPor }],
      function (m) {
        var x = mud[m.cpf], a = ajuste[m.cpf];
        return [nome(m), datas(x.era, t.extraNova), datas(x.ficou, t.retirada), (a && a.motivo) || t.semMotivo, a ? [a.autor || '', a.em || ''] : ''];
      },
      function (ms) { return { rotulo: t.totalAjustadas(ms.length), contas: [] }; },
      1, p.secao(t.secoes.mudou).concat([p.ajuda(t.ajudaMudou)])));
    conteudo.push(p.observacoes([t.obs.cota, t.obs.reproduz]));
    return documento('final', r, opc, conteudo, c);
  }

  /* ---------- os dados do mês (nova_extra_mes) no formato dos relatórios ---------- */
  function dados(d) {
    var agora = new Date(), mes = d.mes;
    var recebidas = mes.repartir_por === 'por_unidade'
      ? Object.keys(mes.cotas_unidades || {}).reduce(function (s, k) { return s + (+mes.cotas_unidades[k] || 0); }, 0) : (mes.cotas_recebidas || 0);
    return {
      competencia: d.competencia, abre: mes.abre, fecha: mes.fecha, cotasRecebidas: recebidas,
      lancado: d.lancamento ? d.lancamento.lancado_em : '', lancadoPor: d.lancamento ? d.lancamento.por || '' : '',
      geradoEm: txt().gerado(dois(agora.getDate()) + '/' + dois(agora.getMonth() + 1) + '/' + agora.getFullYear(), dois(agora.getHours()) + ':' + dois(agora.getMinutes())),
      unidades: d.unidades.map(function (u) { return { unidade_id: u.id, nome: u.nome, cidade: u.cidade }; }),
      militares: d.militares,
      base: trechos(d.lancamento ? d.lancamento.foto : []), atual: trechos(d.alocacoes), ajustes: d.ajustes || []
    };
  }

  var MONTAR = { pedidos: pedidos, termos: termos, inicial: inicial, final: final };

  /* o arquivo de um relatório: qual ('pedidos', 'termos', 'inicial' ou 'final'), o mês (nova_extra_mes) e as opções
     { unidade: id ou null (todos), modo: 'separar' ou 'unica' } → a promessa do arquivo */
  function arquivo(qual, d, opc) {
    return P().preparar().then(function (c) { return P().desenhar(MONTAR[qual](dados(d), opc, c), c); }).then(function (r) { return r.arquivo; });
  }

  /* o nome do arquivo: "extrajornada-pedidos-12-2026.pdf" (com o pelotão, se for só um) */
  function nomeArquivo(qual, d, opc) {
    var u = opc.unidade ? (d.unidades.filter(function (x) { return x.id === opc.unidade; })[0] || {}).nome : '';
    return txt().arquivo(txt().arquivos[qual], d.competencia.slice(5, 7), d.competencia.slice(0, 4), u ? String(u).normalize('NFD').replace(/[^\w]/g, '') : '');
  }

  RW.novaExtraRelatoriosPdf = { arquivo: arquivo, nomeArquivo: nomeArquivo, trechos: trechos };
})();
