/* ============================================================
   EXTRAJORNADA — os PDFs dos relatórios (Pedidos, Termos e cotas,
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
   Pelotão). O Relatório inicial é a foto do encerramento da
   distribuição; o final tem como ficou no fim do mês e o que mudou
   desde o encerramento (era, ficou e quem ajustou).
   A tabela vai inteira para a folha seguinte só quando cabe numa folha;
   mais alta, ela se parte, com os títulos das colunas repetidos.
   Usa as peças do formato dos relatórios (geral-relatorio-pdf.js: a
   folha, as seções, as tabelas) e as do PDF da escala
   (escalas-impressao-pdf.js: biblioteca, fontes, cores do tema e
   download), e empresta as tabelas por pelotão às cópias da tela
   (extrajornada-tela-pdf.js). O PDF é desenhado aqui
   (exceção REGRAS §3/§4).
   RosterWork.extrajornadaRelatoriosPdf.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var INI = ['', '08h', '14h', '20h', '02h'];
  var FIM = ['', '14h', '20h', '02h', '08h'];
  var LINHAS_INTEIRAS = 30;                        // até aqui a tabela não se parte entre duas folhas (se couber numa folha)
  var LARGURA = { cpf: 72, pelotao: 40, pedidoEm: 62, cotasPedidas: 70, termo: 40, pediu: 34, recebeu: 44, data: 58, horario: 86, cotas: 36,
                  era: 58, ficou: 58, ajustadoPor: 80 };

  function P() { return RW.escalasImpressaoPdf; }
  /* as peças do formato dos relatórios (a folha, as seções, as tabelas): geral-relatorio-pdf.js */
  function relatorio() { return RW.relatorioPdf; }
  function txt() { return RW.mensagens.extrajornada.relatoriosPdf; }
  function dataBr(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function rotuloMes(comp) { var p = String(comp).split('-'); var n = MESES[Number(p[1]) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' de ' + p[0]; }
  /* o horário do trecho; o da extra que começa no fim do expediente (inicio) dura 6 h por cota */
  function horario(x) {
    if (!x.inicio) return txt().horario(INI[x.b_ini], FIM[x.b_fim]);
    var h = +x.inicio.slice(0, 2), fim = (h + 6 * (x.b_fim - x.b_ini + 1)) % 24;
    return txt().horario(String(h).padStart(2, '0') + 'h', String(fim).padStart(2, '0') + 'h');
  }
  function soma(l) { return (l || []).reduce(function (s, x) { return s + (x.b_fim - x.b_ini + 1); }, 0); }
  function cpfFormatado(c) { var d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9) : c || ''; }

  /* as extras { cpf, data, unidade, blocos, inicio } em trechos contínuos { cpf, data, uid, b_ini, b_fim, inicio } (a que
     começa no fim do expediente é sempre um trecho só) */
  function trechos(lista) {
    var saida = [];
    (lista || []).forEach(function (a) {
      var b = (a.blocos || []).map(Number).sort(function (x, y) { return x - y; });
      if (!b.length) return;
      var ini = b[0], ant = b[0];
      for (var i = 1; i <= b.length; i++) {
        if (b[i] === ant + 1) { ant = b[i]; continue; }
        saida.push({ cpf: a.cpf, data: a.data, uid: +a.unidade, b_ini: ini, b_fim: ant, inicio: a.inicio || null });
        ini = b[i]; ant = b[i];
      }
    });
    return saida;
  }

  function documento(qual, r, opc, conteudo, c) {
    var p = relatorio().pecas(c), t = txt();
    return relatorio().folha(t.titulos[qual], [p.topo(t.rotuloMes, rotuloMes(r.competencia), true),
      p.topo(t.rotuloUnidade, opc.unidade ? unidade(r, opc.unidade).nome : t.todos, true), p.topo(t.rotuloGerado, r.geradoEm)], conteudo, c, false);
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
     pos (2 = depois do CPF); antes = o título da seção e a ajuda, que vão junto com a 1ª tabela; jeito = o das linhas
     (p.linha). A tabela vai inteira para a folha seguinte só quando cabe numa folha; mais alta, ela se parte, com os
     títulos das colunas repetidos */
  function quadros(p, r, opc, lista, colunas, linhaDe, totalDe, pos, antes, jeito) {
    var unica = opc.modo === 'unica' && !opc.unidade;
    var cols = colunas.slice();
    if (unica) cols.splice(pos, 0, { titulo: txt().colunas.pelotao, largura: LARGURA.pelotao });
    var larguras = cols.map(function (x) { return x.largura; });
    var fixas = larguras.reduce(function (s, l) { return s + (typeof l === 'number' ? l : 0); }, 0);
    var celula = relatorio().medidas.CELULA, alturaLinha = relatorio().medidas.ALTURA_LINHA;
    /* a largura que sobra para o militar (só para contar as linhas do nome; a tabela continua com '*') */
    var estimar = larguras.map(function (l) { return typeof l === 'number' ? l : p.largura - fixas - celula.lado - 2 * celula.lado * (larguras.length - 1); });
    var n = p.numero();
    var grupos = unica || opc.unidade ? [{ u: null, ms: lista }]
      : unidades(r, opc).map(function (u) { return { u: u, ms: lista.filter(function (m) { return m.unidade_id === u.unidade_id; }) }; }).filter(function (g) { return g.ms.length; });
    if (!grupos.length || !grupos[0].ms.length) return [{ stack: antes || [] }];
    return grupos.map(function (g, i) {
      var linhas = g.ms.map(function (m) {
        var cel = linhaDe(m);
        if (unica) cel.splice(pos, 0, unidade(r, m.unidade_id).nome);
        return p.linha(cel, estimar, false, jeito);
      });
      var t = totalDe(g.ms), juntas = cols.length - t.contas.length, cel = [{ v: t.rotulo, junta: juntas }];
      for (var k = 1; k < juntas; k++) cel.push(null);
      linhas.push(p.linha(cel.concat(t.contas), estimar, true, jeito));
      var bloco = (i === 0 && antes ? antes : []).concat(g.u ? [p.subsecao(n + '.' + (i + 1), g.u)] : [], [p.tabela(larguras, cols.map(function (x) { return x.titulo; }), linhas)]);
      var altura = linhas.reduce(function (s, l) { return s + l.linhas * alturaLinha + 2 * celula.vertical; }, 0);
      return { stack: bloco, unbreakable: linhas.length <= LINHAS_INTEIRAS && altura <= p.alturaInteira };
    });
  }
  function porCpf(lista) { var o = {}; (lista || []).forEach(function (x) { (o[x.cpf] = o[x.cpf] || []).push(x); }); return o; }
  function dosVoluntarios(vols, lista) { return lista.filter(function (x) { return vols.some(function (m) { return m.cpf === x.cpf; }); }); }
  function somaDe(ms, campo) { return ms.reduce(function (s, m) { return s + (campo(m) || 0); }, 0); }

  /* ---------- Pedidos: a data do pedido e as cotas pedidas ---------- */
  function pedidos(r, opc, c) {
    var p = relatorio().pecas(c), t = txt(), vols = voluntarios(r, opc), eh = daqui(r, opc), C = t.colunas;
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
      /* o pedido lançado pelo sistema (a carga da planilha) sai sem data: "Pelo sistema" */
      function (m) { return [nome(m), cpfFormatado(m.cpf), m.pelo_sistema ? C.peloSistema : (m.pedido_em || ''), String(m.cotas || 0)]; },
      function (ms) { return { rotulo: t.total(ms.length), contas: [String(somaDe(ms, cotasDe))] }; },
      2, p.secao(t.secoes.pedidos).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo.push(p.observacoes([t.obs.cota, t.obs.reproduz]));
    return documento('pedidos', r, opc, conteudo, c);
  }

  /* ---------- Termos e cotas: o termo, quantas pediu e quantas recebeu; o total de cada pelotão ---------- */
  function termos(r, opc, c) {
    var p = relatorio().pecas(c), t = txt(), vols = voluntarios(r, opc), C = t.colunas;
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
    var p = relatorio().pecas(c), t = txt(), base = dosVoluntarios(voluntarios(r, opc), r.base);
    var conteudo = p.secao(t.secoes.resumo).concat([p.campos([
      [t.campos.encerradoEm, r.encerrado], [t.campos.encerradoPor, r.encerradoPor],
      [t.campos.comExtra, String(Object.keys(porCpf(base)).length)], [t.campos.distribuidas, t.cotas(soma(base))]
    ])]);
    conteudo = conteudo.concat(extras(p, r, opc, r.base, p.secao(t.secoes.distribuidas).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo.push(p.observacoes([t.obs.inicial, t.obs.cota, t.obs.reproduz]));
    return documento('inicial', r, opc, conteudo, c);
  }

  /* ---------- Relatório final: como ficou no fim do mês e o que mudou desde o encerramento ---------- */
  function chave(x) { return x.cpf + '|' + x.data + '|' + x.uid + '|' + x.b_ini + '|' + x.b_fim; }
  function datas(lista, vazio) {
    if (!lista.length) return [vazio];
    var saida = [];
    lista.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).forEach(function (x) { saida.push(dataBr(x.data)); saida.push(horario(x)); });
    return saida;
  }
  function final(r, opc, c) {
    var p = relatorio().pecas(c), t = txt(), C = t.colunas, vols = voluntarios(r, opc);
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
      [t.campos.encerradoEm, r.encerrado], [t.campos.noEncerramento, t.cotas(soma(base))],
      [t.campos.noFim, t.cotas(soma(atual))], [t.campos.ajustadas, String(mudaram.length)]
    ])]);
    conteudo = conteudo.concat(extras(p, r, opc, r.atual, p.secao(t.secoes.comoFicou).concat([p.ajuda(t.ajudaOrdem)])));
    conteudo = conteudo.concat(quadros(p, r, opc, mudaram,
      [{ titulo: C.militar, largura: '*' }, { titulo: C.era, largura: LARGURA.era }, { titulo: C.ficou, largura: LARGURA.ficou }, { titulo: C.ajustadoPor, largura: LARGURA.ajustadoPor }],
      function (m) {
        var x = mud[m.cpf], a = ajuste[m.cpf];
        return [nome(m), datas(x.era, t.extraNova), datas(x.ficou, t.retirada), a ? [a.autor || '', a.em || ''] : ''];
      },
      function (ms) { return { rotulo: t.totalAjustadas(ms.length), contas: [] }; },
      1, p.secao(t.secoes.mudou).concat([p.ajuda(t.ajudaMudou)])));
    conteudo.push(p.observacoes([t.obs.cota, t.obs.reproduz]));
    return documento('final', r, opc, conteudo, c);
  }

  /* ---------- os dados do mês (extrajornada_mes) no formato dos relatórios ---------- */
  /* o "Gerado em" do alto: a data e a hora de agora */
  function geradoAgora() {
    var agora = relatorio().agora();
    return txt().gerado(agora.data, agora.hora);
  }

  function dados(d) {
    var mes = d.mes, enc = RW.extrajornadaUtil.encerrada(d) ? d.encerramento : null;
    var recebidas = mes.repartir_por === 'por_unidade'
      ? Object.keys(mes.cotas_unidades || {}).reduce(function (s, k) { return s + (+mes.cotas_unidades[k] || 0); }, 0) : (mes.cotas_recebidas || 0);
    return {
      competencia: d.competencia, abre: mes.abre, fecha: mes.fecha, cotasRecebidas: recebidas,
      encerrado: enc ? enc.encerrado_em : '', encerradoPor: enc ? enc.por || '' : '',
      geradoEm: geradoAgora(),
      unidades: d.unidades.map(function (u) { return { unidade_id: u.id, nome: u.nome, cidade: u.cidade }; }),
      militares: d.militares,
      base: trechos(enc ? enc.foto : []), atual: trechos(d.alocacoes), ajustes: d.ajustes || []
    };
  }

  var MONTAR = { pedidos: pedidos, termos: termos, inicial: inicial, final: final };

  /* o arquivo de um relatório: qual ('pedidos', 'termos', 'inicial' ou 'final'), o mês (extrajornada_mes) e as opções
     { unidade: id ou null (todos), modo: 'separar' ou 'unica' } → a promessa do arquivo */
  function arquivo(qual, d, opc) {
    return P().preparar().then(function (c) { return P().desenhar(MONTAR[qual](dados(d), opc, c), c); }).then(function (r) { return r.arquivo; });
  }

  /* o nome do arquivo: "extrajornada-pedidos-12-2026.pdf" (com o pelotão, se for só um) */
  function nomeArquivo(qual, d, opc) {
    var u = opc.unidade ? (d.unidades.filter(function (x) { return x.id === opc.unidade; })[0] || {}).nome : '';
    return txt().arquivo(txt().arquivos[qual], d.competencia.slice(5, 7), d.competencia.slice(0, 4), u ? String(u).normalize('NFD').replace(/[^\w]/g, '') : '');
  }

  RW.extrajornadaRelatoriosPdf = {
    arquivo: arquivo, nomeArquivo: nomeArquivo, trechos: trechos,
    /* para as cópias da tela (extrajornada-tela-pdf.js): as tabelas por pelotão, os dados do mês e os textos de data,
       mês e horário */
    quadros: quadros, dados: dados, geradoAgora: geradoAgora, dataBr: dataBr, rotuloMes: rotuloMes,
    horario: horario
  };
})();
