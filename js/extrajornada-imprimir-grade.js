/* ============================================================
   EXTRAJORNADA — Imprimir a grade (o botão da barra)
   Nas Extras do mês, na Distribuição e nos Ajustes, abre o painel de
   impressão das grades da Escala (escalas-impressao-grade.js) na grade
   da tela (Agenda ou Calendário), no mês da tela e com os pelotões da
   tela marcados. O que sai em cada dia é o que a tela mostra: as
   extras (o posto, o nome, o horário e o cadeado na que o administrador pôs) e, na
   Distribuição e nos Ajustes, o gráfico da cobertura com as extras e,
   com a Escala completa, quem está de serviço; com a Falta de gente
   marcada no Exibir, a linha dela embaixo do gráfico (a conta da
   tela, extrajornada-falta.js). A leitura é a da tela
   (o rascunho também), sem buscar nada no banco, no formato da leitura
   da escala (RosterWork.escalasDados.carregar). Na Distribuição e nos
   Ajustes, a caixa "O que imprimir" no alto (o relatório inicial ou o
   final) e a lista dos voluntários (o painel esquerdo) na folha
   seguinte, com a caixa dela no Mostrar.
   RosterWork.extrajornadaImprimirGrade.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08:00', '14:00', '20:00', '02:00'], FIM = ['14:00', '20:00', '02:00', '08:00'];

  function G() { return RW.extrajornadaGrade; }
  function u() { return RW.extrajornadaUtil; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function primeiro(a) { return Math.min.apply(null, a.blocos.map(Number)); }

  /* a extra como uma linha da escala: o posto, o nome, os horários (um trecho por horários seguidos) e quem inseriu (a do
     sistema sai sem ícone; a do administrador, com o cadeado: escalas-celula.js) */
  function pessoa(a) {
    var m = u().militar(a.cpf) || { grad: '', nome: a.cpf };
    var b = a.blocos.map(Number).sort(), periodos = [], ini = b[0];
    /* a que começa no fim do expediente: 6 h por cota, desde o início */
    if (a.inicio && b.length) {
      var fim = (+a.inicio.slice(0, 2) + 6 * b.length) % 24;
      periodos.push({ inicio: a.inicio, fim: String(fim).padStart(2, '0') + ':00' });
      b = [];
    }
    for (var i = 1; i <= b.length; i++) {
      if (b[i] === b[i - 1] + 1) continue;
      periodos.push({ inicio: INI[ini - 1], fim: FIM[b[i - 1] - 1] });
      ini = b[i];
    }
    return { cpf: a.cpf, grad: m.grad, nome: m.nome, origem: a.origem === 'sugestao' ? 'extra_sistema' : 'extra_admin', periodos: periodos };
  }

  /* a leitura da grade da tela, por unidade e dia: { militares, fora, cobertura, erro } (como a da escala) e, com a Falta
     de gente (comFalta), falta: a conta de cada horário (geral-falta-gente) */
  function leitura(extrasDoMes, comFalta) {
    return function (ids, inicio, fim) {
      var r = { militares: {}, fora: {}, cobertura: {}, erro: {}, falta: {} };
      var alocs = (extrasDoMes ? RW.extrajornadaOrg.dados().alocacoes : G().vagas()).filter(function (a) { return a.blocos.length; });
      var efetivas = extrasDoMes ? null : G().efetivas(), completa = !extrasDoMes && RW.extrajornadaFiltros.escalaCompleta();
      ids.forEach(function (uid) {
        r.militares[uid] = {}; r.fora[uid] = {}; r.cobertura[uid] = {}; r.erro[uid] = {}; r.falta[uid] = {};
        for (var d = new Date(+inicio.slice(0, 4), +inicio.slice(5, 7) - 1, +inicio.slice(8, 10)); iso(d) <= fim; d.setDate(d.getDate() + 1)) {
          var k = iso(d);
          var aqui = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k; })
            .sort(function (x, y) { return primeiro(x) - primeiro(y) || u().nome(x.cpf).localeCompare(u().nome(y.cpf)); });
          var pessoas = aqui.map(pessoa);
          /* na Distribuição e nos Ajustes, o gráfico do dia com as extras (com a Falta de gente, a linha dela) e, com a
             Escala completa, quem está de serviço */
          if (!extrasDoMes) {
            var antes = G().antesDe(uid, k);
            if (antes) {
              var falta = aqui.length || comFalta ? G().faltaDoDia(uid, k, efetivas) : null;
              var dep = aqui.length ? G().depoisDe(uid, k, efetivas, falta) : null;
              r.cobertura[uid][k] = dep ? dep.cobertura : antes;
              r.erro[uid][k] = dep ? dep.erro : G().erroAntes(uid, k);
              if (comFalta) r.falta[uid][k] = RW.extrajornadaFalta.horarios(falta, uid, k, efetivas, r.erro[uid][k]);
            }
            if (completa) pessoas = G().deServico(uid, k).concat(pessoas);
          }
          r.militares[uid][k] = pessoas;
        }
      });
      return Promise.resolve(r);
    };
  }

  /* a folha da lista dos voluntários (Distribuição e Ajustes), como o painel esquerdo da tela: as cotas colocadas no alto
     e os grupos Faltam e Completos, cada um com a faixa cinza e os nomes em colunas (o posto e o nome, o pelotão, as
     cotas colocadas de recebidas e, embaixo, o motivo): duas no retrato, três no paisagem e até quatro na página
     contínua larga. lista: a da tela (RosterWork.extrajornadaLista.paraImprimir); c: as cores da folha; largura: a do
     conteúdo */
  var LISTA = { colunasMinimo: 2, colunasMaximo: 4, larguraColuna: 250, vao: 18, pelotao: 34, cotas: 46, titulo: 11, faixa: 7.5, nome: 8.5,
    posto: 7, miudo: 7, linha: 0.5 };
  function semLinha() { return 0; }
  function folhaDaLista(lista, c, largura) {
    var M = RW.mensagens.extrajornada.imprimir.lista, L = LISTA;
    var colunas = Math.max(L.colunasMinimo, Math.min(L.colunasMaximo, Math.floor(largura / L.larguraColuna)));
    var w = (largura - (colunas - 1) * L.vao) / colunas;
    var saida = [{ text: [{ text: M.titulo, bold: true, color: c.forte }, { text: '    ' + lista.total, color: c.suave }], fontSize: L.titulo, margin: [0, 0, 0, 6] }];
    function linha(x) {
      var pilha = [{ columns: [
        { width: '*', text: [{ text: x.grad + ' ', fontSize: L.posto, color: c.suave }, { text: x.nome, bold: true, color: c.forte }], fontSize: L.nome },
        { width: L.pelotao, text: x.pelotao, fontSize: L.miudo, color: c.suave, alignment: 'right' },
        { width: L.cotas, text: x.cotas, fontSize: L.nome, color: x.passou ? c.erro : c.texto, alignment: 'right' }
      ], margin: [4, 4, 4, 0] }];
      if (x.motivo) pilha.push({ text: x.motivo, fontSize: L.miudo, color: c.suave, margin: [4, 1, 4, 0] });
      pilha.push({ canvas: [{ type: 'line', x1: 0, y1: 4, x2: w, y2: 4, lineWidth: L.linha, lineColor: c.borda }] });
      return { stack: pilha, unbreakable: true };
    }
    ['faltam', 'completos'].forEach(function (g) {
      var itens = lista.grupos[g];
      saida.push({ table: { widths: ['*'], body: [[{ text: [{ text: M.grupos[g], bold: true, characterSpacing: 0.6 }, { text: '    ' + itens.length }], fontSize: L.faixa, color: c.suave }]] },
        layout: { fillColor: function () { return c.fundo; }, hLineWidth: semLinha, vLineWidth: semLinha, paddingLeft: function () { return 6; },
          paddingTop: function () { return 4; }, paddingBottom: function () { return 4; } }, margin: [0, 8, 0, 2] });
      if (!itens.length) { saida.push({ text: M.vazio[g], fontSize: L.nome, color: c.suave, margin: [6, 4, 0, 2] }); return; }
      /* de cima para baixo em cada coluna, na ordem da tela */
      var porColuna = Math.ceil(itens.length / colunas), blocos = [];
      for (var i = 0; i < colunas; i++) blocos.push({ width: w, stack: itens.slice(i * porColuna, (i + 1) * porColuna).map(linha) });
      saida.push({ columns: blocos, columnGap: L.vao });
    });
    return saida;
  }

  /* extrasDoMes: a aba Extras do mês (senão, a Distribuição ou os Ajustes); modo: 'agenda' ou 'calendario'; escolha: a
     caixa "O que imprimir" da Distribuição e dos Ajustes (extrajornada-imprimir-tela.js) */
  function abrir(extrasDoMes, modo, escolha) {
    var d = extrasDoMes ? RW.extrajornadaOrg.dados() : G().dados();
    if (!d || !RW.escalasImpressaoGrade) return;
    var comp = d.competencia, unidades;
    if (extrasDoMes) {
      unidades = u().doCalendario(d.alocacoes).filter(function (un) { return d.alocacoes.some(function (a) { return +a.unidade === un.id; }); });
    } else unidades = RW.extrajornadaPorDia.unidades();
    /* a Falta de gente sai como na tela: só com ela marcada no Exibir (a aba Extras do mês não a tem). As opções marcadas
       do Exibir entram na nota do painel, na ordem dele */
    var M = RW.mensagens.extrajornada.imprimir.grade;
    var comFalta = !extrasDoMes && RW.extrajornadaFiltros.faltaDeGente();
    var filtros = [];
    if (!extrasDoMes && RW.extrajornadaFiltros.escalaCompleta()) filtros.push(M.escalaCompleta);
    if (comFalta) filtros.push(M.faltaDeGente);
    /* na Distribuição e nos Ajustes, a lista dos voluntários na folha seguinte (a caixa no Mostrar começa marcada com a
       lista aberta na tela), tirada da tela agora */
    var lista = !extrasDoMes && RW.extrajornadaLista ? RW.extrajornadaLista.paraImprimir() : null;
    RW.escalasImpressaoGrade.abrir({
      formato: modo,
      data: new Date(+comp.slice(0, 4), +comp.slice(5, 7) - 1, 1),
      unidades: unidades.map(function (un) { return { unidade_id: un.id, nome: un.nome }; }),
      filtros: filtros,
      dados: leitura(extrasDoMes, comFalta),
      titulo: M.titulo,
      prefixo: M.arquivo,
      conferir: null,
      escolha: escolha || null,
      marcas: lista ? ['grade', 'lista-voluntarios'] : undefined,
      mostrar: lista ? { grafico: true, icones: true, lista: RW.extrajornadaLista.aberta() } : undefined,
      anexo: lista ? { resumo: RW.mensagens.extrajornada.imprimir.lista.resumo, conteudo: function (c, largura) { return folhaDaLista(lista, c, largura); } } : null
    });
  }

  RW.extrajornadaImprimirGrade = { abrir: abrir };
})();
