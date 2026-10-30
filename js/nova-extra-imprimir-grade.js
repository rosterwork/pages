/* ============================================================
   NOVA EXTRA — Imprimir a grade (o botão da barra)
   Nas Extras do mês, na Distribuição e nos Ajustes, abre o painel de
   impressão das grades da Escala (escalas-impressao-grade.js) na grade
   da tela (Agenda ou Calendário), no mês da tela e com os pelotões da
   tela marcados. O que sai em cada dia é o que a tela mostra: as
   extras (o posto, o nome, o horário e o ícone de quem inseriu) e, na
   Distribuição e nos Ajustes, o gráfico da cobertura com as extras e,
   com a Escala completa, quem está de serviço. A leitura é a da tela
   (o rascunho também), sem buscar nada no banco, no formato da leitura
   da escala (RosterWork.escalasDados.carregar).
   RosterWork.novaExtraImprimirGrade.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08:00', '14:00', '20:00', '02:00'], FIM = ['14:00', '20:00', '02:00', '08:00'];

  function G() { return RW.novaExtraGrade; }
  function u() { return RW.novaExtraUtil; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function primeiro(a) { return Math.min.apply(null, a.blocos.map(Number)); }

  /* a extra como uma linha da escala: o posto, o nome, os horários (um trecho por horários seguidos) e quem inseriu */
  function pessoa(a) {
    var m = u().militar(a.cpf) || { grad: '', nome: a.cpf };
    var b = a.blocos.map(Number).sort(), periodos = [], ini = b[0];
    for (var i = 1; i <= b.length; i++) {
      if (b[i] === b[i - 1] + 1) continue;
      periodos.push({ inicio: INI[ini - 1], fim: FIM[b[i - 1] - 1] });
      ini = b[i];
    }
    return { cpf: a.cpf, grad: m.grad, nome: m.nome, origem: a.origem === 'sugestao' ? 'extra_sistema' : 'extra_admin', periodos: periodos };
  }

  /* a leitura da grade da tela, por unidade e dia: { militares, afastados, cobertura, erro } (como a da escala) */
  function leitura(extrasDoMes) {
    return function (ids, inicio, fim) {
      var r = { militares: {}, afastados: {}, cobertura: {}, erro: {} };
      var alocs = (extrasDoMes ? RW.novaExtraOrg.dados().alocacoes : G().vagas()).filter(function (a) { return a.blocos.length; });
      var efetivas = extrasDoMes ? null : G().efetivas(), completa = !extrasDoMes && RW.novaExtraFiltros.escalaCompleta();
      ids.forEach(function (uid) {
        r.militares[uid] = {}; r.afastados[uid] = {}; r.cobertura[uid] = {}; r.erro[uid] = {};
        for (var d = new Date(+inicio.slice(0, 4), +inicio.slice(5, 7) - 1, +inicio.slice(8, 10)); iso(d) <= fim; d.setDate(d.getDate() + 1)) {
          var k = iso(d);
          var aqui = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k; })
            .sort(function (x, y) { return primeiro(x) - primeiro(y) || u().nome(x.cpf).localeCompare(u().nome(y.cpf)); });
          var pessoas = aqui.map(pessoa);
          /* na Distribuição e nos Ajustes, o gráfico do dia com as extras e, com a Escala completa, quem está de serviço */
          if (!extrasDoMes) {
            var antes = G().antesDe(uid, k);
            if (antes) {
              var dep = aqui.length ? G().depoisDe(uid, k, efetivas, G().faltaDoDia(uid, k, efetivas)) : null;
              r.cobertura[uid][k] = dep ? dep.cobertura : antes;
              r.erro[uid][k] = dep ? dep.erro : G().erroAntes(uid, k);
            }
            if (completa) pessoas = G().deServico(uid, k).concat(pessoas);
          }
          r.militares[uid][k] = pessoas;
        }
      });
      return Promise.resolve(r);
    };
  }

  /* extrasDoMes: a aba Extras do mês (senão, a Distribuição ou os Ajustes); modo: 'agenda' ou 'calendario' */
  function abrir(extrasDoMes, modo) {
    var d = extrasDoMes ? RW.novaExtraOrg.dados() : G().dados();
    if (!d || !RW.escalasImpressaoGrade) return;
    var comp = d.competencia, unidades;
    if (extrasDoMes) {
      unidades = u().doCalendario(d.alocacoes).filter(function (un) { return d.alocacoes.some(function (a) { return +a.unidade === un.id; }); });
    } else unidades = RW.novaExtraPorDia.unidades();
    RW.escalasImpressaoGrade.abrir({
      formato: modo,
      data: new Date(+comp.slice(0, 4), +comp.slice(5, 7) - 1, 1),
      unidades: unidades.map(function (un) { return { unidade_id: un.id, nome: un.nome }; }),
      filtros: !extrasDoMes && RW.novaExtraFiltros.escalaCompleta() ? [RW.mensagens.novaExtra.imprimir.grade.escalaCompleta] : [],
      dados: leitura(extrasDoMes),
      titulo: RW.mensagens.novaExtra.imprimir.grade.titulo,
      prefixo: RW.mensagens.novaExtra.imprimir.grade.arquivo,
      conferir: null
    });
  }

  RW.novaExtraImprimirGrade = { abrir: abrir };
})();
