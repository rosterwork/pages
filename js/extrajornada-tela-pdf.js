/* ============================================================
   EXTRAJORNADA — as folhas da cópia da tela (o Imprimir da Minha
   extra, dos Pedidos e das Cotas; o painel é o
   extrajornada-imprimir-tela.js), no padrão dos relatórios, com as
   peças deles (geral-relatorio-pdf.js: a folha, as seções, as tabelas;
   extrajornada-relatorios-pdf.js: as tabelas por pelotão e a que se
   parte quando não cabe numa folha):
   - Pedidos: o Resumo (o prazo e as contas da tela) e a lista aberta
     na tela (Voluntários, Não querem ou Sem resposta), na ordem da
     tela, com o termo como está na tela; o Não pode com o motivo (no
     papel não há a dica); em retrato ou paisagem;
   - Cotas: os números do alto e um bloco por pelotão, na ordem da
     fila, com o que ainda não foi salvo; em retrato ou paisagem;
   - Minha extra: o cartão do mês (o pedido, a repartição das cotas e
     os dias), em retrato.
   Os dados da tela vêm de quem desenha a tela (extrajornada-organizar.js,
   extrajornada-cotas.js); a Minha extra, do extrajornada_minha.
   O PDF é desenhado aqui (exceção REGRAS §3/§4).
   RosterWork.extrajornadaTelaPdf.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* as larguras das colunas (pontos), na folha em retrato e em paisagem */
  var LARGURA = {
    pedidos: { retrato: { cotas: 34, quer: 84, naoQuer: 84, naoPode: 76, termo: 34 }, paisagem: { cotas: 40, quer: 160, naoQuer: 160, naoPode: 110, termo: 40 } },
    cotas: { retrato: [28, '*', 36, 110, 50, 44, 54], paisagem: [34, '*', 50, 130, 64, 56, 70] },
    minha: ['*', 90, 100, 70, 50],
    estimarMilitar: 120
  };
  var POSTO = 7.5;          // o posto antes do nome, menor (como na tela)
  var LINHA_DA_TABELA = 22; // a altura de cada linha de texto de uma linha da tabela, com o respiro (a conta da tabela inteira)

  function R() { return RW.extrajornadaRelatoriosPdf; }
  /* as peças do formato dos relatórios (a folha, as seções, as tabelas): geral-relatorio-pdf.js */
  function relatorio() { return RW.relatorioPdf; }
  function P() { return RW.escalasImpressaoPdf; }
  function rel() { return RW.mensagens.extrajornada.relatoriosPdf; }
  function txt() { return RW.mensagens.extrajornada.imprimir.tela; }
  function org() { return RW.mensagens.extrajornada.org; }

  /* o posto e o nome de guerra em negrito, como na tela */
  function militar(grad, nome) {
    return { v: { text: [{ text: (grad || '') + ' ', fontSize: POSTO }, { text: nome || '', bold: true }] }, plano: (grad || '') + ' ' + (nome || '') };
  }
  function topoDoMes(p, competencia, geradoEm) {
    return [p.topo(rel().rotuloMes, R().rotuloMes(competencia), true), p.topo(rel().rotuloUnidade, rel().todos, true), p.topo(rel().rotuloGerado, geradoEm)];
  }

  /* ---------- Pedidos ---------- */
  function pedidos(d, opc, c) {
    var larga = opc.orientacao === 'paisagem', p = relatorio().pecas(c, larga), r = R().dados(d), t = txt(), T = opc.tela, o = org();
    var W = LARGURA.pedidos[larga ? 'paisagem' : 'retrato'];
    var responderam = T.todos.filter(function (m) { return m.respondeu; }).length;
    var voluntarios = T.todos.filter(function (m) { return m.voluntario; }).length;
    var conteudo = p.secao(rel().secoes.resumo).concat([p.campos([
      [rel().campos.periodo, rel().periodo(R().dataBr(r.abre), R().dataBr(r.fecha))],
      [t.campos.responderam, t.responderam(responderam, T.todos.length)],
      [rel().campos.voluntarios, String(voluntarios)],
      [rel().campos.naoQuerem, rel().militares(responderam - voluntarios)],
      [rel().campos.naoResponderam, rel().militares(T.todos.length - responderam)]
    ])]);
    var antes = p.secao(t.secoes[T.lista]).concat([p.ajuda(t.ajudaTela)]);
    /* os dias em que não pode, um período por linha, com o motivo */
    function naoPode(m) {
      if (m.sem_dia_livre) return o.semDiaLivre;
      var periodos = T.naoPode(m);
      return periodos.length ? periodos.map(function (x) { return t.naoPode(o.periodoDoMes(x.inicio, x.fim), RW.mensagens.extrajornada.motivos[x.motivo]); }) : '';
    }
    var observacoes = [t.obs.copia];
    if (T.lista === 'vol') {
      var C = t.colunas;
      conteudo = conteudo.concat(R().quadros(p, r, opc, T.militares,
        [{ titulo: rel().colunas.militar, largura: '*' }, { titulo: rel().colunas.cotas, largura: W.cotas }, { titulo: C.quer, largura: W.quer },
          { titulo: C.naoQuer, largura: W.naoQuer }, { titulo: C.naoPode, largura: W.naoPode }, { titulo: rel().colunas.termo, largura: W.termo }],
        function (m) {
          return [militar(m.grad, m.nome), o.cotas(m.cotas, m.so24), o.diasDoMes(m.quer || []), o.diasDoMes(m.nao_posso || []), naoPode(m),
            T.termo(m) ? rel().sim : rel().nao];
        },
        function (ms) { return { rotulo: rel().total(ms.length), contas: [String(ms.reduce(function (s, m) { return s + (m.cotas || 0); }, 0)), '', '', '', ''] }; },
        1, antes, { noAlto: true }));
      observacoes = [t.obs.dias, t.obs.naoPode, t.obs.copia];
    } else {
      conteudo = conteudo.concat(R().quadros(p, r, opc, T.militares, [{ titulo: rel().colunas.militar, largura: '*' }],
        function (m) { return [militar(m.grad, m.nome)]; },
        function (ms) { return { rotulo: rel().militares(ms.length), contas: [] }; },
        1, antes, { noAlto: true }));
    }
    conteudo.push(p.observacoes(observacoes));
    return relatorio().folha(t.folhas.pedidos, topoDoMes(p, d.competencia, r.geradoEm), conteudo, c, larga);
  }

  /* ---------- Cotas ---------- */
  function cotas(d, opc, c) {
    var larga = opc.orientacao === 'paisagem', p = relatorio().pecas(c, larga), t = txt(), T = opc.tela, C = t.colunas;
    var larguras = LARGURA.cotas[larga ? 'paisagem' : 'retrato'];
    var estimar = larguras.map(function (l) { return typeof l === 'number' ? l : LARGURA.estimarMilitar; });
    var conteudo = p.secao(rel().secoes.resumo).concat([p.campos([
      [t.cotasDa(T.cia), String(T.recebidas)], [t.campos.entregues, String(T.entregues)], [t.campos.sobram, String(T.sobram)],
      [t.campos.naEscala, String(T.naEscala)]
    ])]);
    var n = p.numero() + 1;
    conteudo = conteudo.concat(p.secao(t.secoes.cotas), [p.ajuda(t.ajudaFila)]);
    T.blocos.forEach(function (b, i) {
      var linhas = b.linhas.map(function (x) {
        var atendido = x.primeira ? t.primeiraVez : { text: [{ text: x.porcento + ' ', bold: true }, { text: x.deCotas, color: c.suave }] };
        return p.linha([x.fila, militar(x.grad, x.nome + (x.so24 ? t.do24h : '')), String(x.pediu), { v: atendido }, String(x.sugestao), String(x.recebe),
          x.naEscala], estimar, false, { esquerda: 2 });
      });
      /* o bloco vai inteiro para a folha seguinte só quando cabe numa folha; mais alto, ele se parte */
      var altura = linhas.reduce(function (s, l) { return s + l.linhas * LINHA_DA_TABELA; }, 0);
      conteudo.push({ stack: [p.subsecao(n + '.' + (i + 1), { nome: b.nome, cidade: b.cidade }),
        p.ajuda(t.noPelotao(b.recebeu, b.entregues, b.sobram)),
        p.tabela(larguras, [C.fila, rel().colunas.militar, C.pediu, C.atendido, C.sugestao, C.recebe, C.naEscala], linhas, 2)],
        unbreakable: altura <= p.alturaInteira });
    });
    conteudo.push(p.observacoes([t.obs.atendido, t.obs.copia]));
    return relatorio().folha(t.folhas.cotas, topoDoMes(p, d.competencia, R().geradoAgora()), conteudo, c, larga);
  }

  /* ---------- Minha extra ---------- */
  function minha(e, opc, c) {
    var p = relatorio().pecas(c, false), t = txt(), o = org(), ped = e.pedido, C = t.colunas;
    var conteudo = p.secao(t.secoes.pedido);
    if (!ped || !ped.voluntario) conteudo.push(p.ajuda(ped ? t.naoQuer : t.semPedido));
    else conteudo.push(p.campos([
      [t.campos.enviadoEm, ped.pelo_sistema ? t.peloSistema : ped.enviado_em],
      [t.campos.cotasPedidas, t.cotasPedidas(ped.cotas, ped.so_24h)],
      [t.campos.diasQuer, o.diasDoMes(ped.quer || []) || t.nenhum],
      [t.campos.diasNaoQuer, o.diasDoMes(ped.nao_posso || []) || t.nenhum],
      [t.campos.termo, t.termo(ped.termo, ped.termo_pelo_sistema ? '' : ped.termo_em)]
    ]));
    conteudo = conteudo.concat(p.secao(t.secoes.reparticao));
    conteudo.push(ped && ped.voluntario && ped.termo ? p.campos([[t.campos.recebeu, t.recebeu(ped.concedidas || 0, ped.cotas)]]) : p.ajuda(t.semCotas));
    conteudo = conteudo.concat(p.secao(t.secoes.dias));
    /* cada trecho de horas seguidas numa linha (a extra do fim do expediente é um trecho só) */
    var linhas = [];
    (e.extras || []).slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; }).forEach(function (x) {
      R().trechos([{ cpf: '', data: x.data, unidade: 0, blocos: x.blocos, inicio: x.inicio }]).forEach(function (tr) {
        var dia = new Date(+x.data.slice(0, 4), +x.data.slice(5, 7) - 1, +x.data.slice(8, 10));
        linhas.push({ data: x.data, dia: t.semana[dia.getDay()], horario: R().horario(tr), unidade: x.unidade, cotas: tr.b_fim - tr.b_ini + 1 });
      });
    });
    if (!linhas.length) conteudo.push(p.ajuda(e.lancado ? t.semExtra : t.diasDepois));
    else {
      var est = LARGURA.minha.map(function (l) { return typeof l === 'number' ? l : LARGURA.estimarMilitar; });
      var corpo = linhas.map(function (l) { return p.linha([R().dataBr(l.data), l.dia, l.horario, l.unidade, String(l.cotas)], est); });
      var total = linhas.reduce(function (s, l) { return s + l.cotas; }, 0);
      corpo.push(p.linha([{ v: t.totalExtras(linhas.length), junta: 4 }, null, null, null, String(total)], est, true));
      conteudo.push(p.tabela(LARGURA.minha, [C.data, C.dia, C.horario, rel().colunas.pelotao, rel().colunas.cotas], corpo));
    }
    conteudo.push(p.observacoes([rel().obs.cota, t.obs.copia]));
    var m = e.militar || {};
    return relatorio().folha(t.folhas.minha, [p.topo(t.campos.militar, t.militar(m.grad, m.nome, m.unidade), true), p.topo(rel().rotuloMes, R().rotuloMes(e.competencia), true),
      p.topo(rel().rotuloGerado, R().geradoAgora())], conteudo, c, false);
  }

  var FOLHAS = { pedidos: pedidos, cotas: cotas, minha: minha };

  /* o arquivo da cópia: qual ('pedidos', 'cotas' ou 'minha'), os dados (o mês, extrajornada_mes; na Minha extra, o pedido
     dele, extrajornada_minha) e as opções { orientacao, modo, unidade: null, tela (o que a tela mostra) } → a promessa do
     arquivo */
  function arquivo(qual, d, opc) {
    return P().preparar().then(function (c) { return P().desenhar(FOLHAS[qual](d, opc, c), c); }).then(function (r) { return r.arquivo; });
  }

  /* o nome do arquivo: "extrajornada-pedidos-tela-12-2026.pdf" */
  function nomeArquivo(qual, competencia) {
    return rel().arquivo(txt().arquivos[qual], competencia.slice(5, 7), competencia.slice(0, 4), '');
  }

  RW.extrajornadaTelaPdf = { arquivo: arquivo, nomeArquivo: nomeArquivo };
})();
