/* ============================================================
   EXTRAJORNADA — a grade do mês: o rascunho e as contas
   O rascunho das extras do mês, a falta de cada pelotão (vermelha e
   amarela, com e sem as extras, e o que cada extra cobriu), a escala
   do mês (a mesma leitura da Escala) e a régua das barras. Quem abre
   entrega o mês por iniciar: a Distribuição e os Ajustes
   (extrajornada-montar.js) e a aba Extrajornada do painel do dia da
   Escala (escalas-painel-extra.js). O calendário, a lista dos
   voluntários e o painel do dia leem e mudam por aqui.
   Tudo fica no rascunho até o Salvar; o militar sem nenhum horário
   continua no dia até lá. O rascunho aceita passar da cota: quem
   passou aparece em passaram e o Salvar espera acertar.
   Não desenha nada. RosterWork.extrajornadaGrade.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'];
  var SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var SEM_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var d = null;
  var modo = 'distribuicao';   // 'distribuicao' (passo 3) ou 'ajustes' (passo 4 e a aba da Escala)
  var aoMudar = null;      // quem abriu redesenha: aoMudar(dia que mudou)
  var mud = {};            // rascunho: 'cpf|data' -> { cpf, data, unidade, blocos, origem, porque } (blocos [] = sai ao salvar)
  var escala = null;       // a escala do mês, a mesma da Escala: { comp, cobertura, erro, militares }
  var picos = {};          // a régua das barras de cada unidade no mês (antes e depois)

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function F() { return RW.extrajornadaFalta; }
  function chave(cpf, data) { return cpf + '|' + data; }
  function dataDe(k) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)); }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function somaDia(k, n) { var x = dataDe(k); x.setDate(x.getDate() + n); return iso(x); }
  function ultimoDia() { var c = d.competencia; return iso(new Date(+c.slice(0, 4), +c.slice(5, 7), 0)); }
  function diasDoMes() {
    var lista = [], k = d.competencia, fim = ultimoDia();
    while (k <= fim) { lista.push(k); k = somaDia(k, 1); }
    return lista;
  }
  function dataLonga(k) { var x = dataDe(k); return SEMANA[x.getDay()] + ', ' + x.getDate() + ' de ' + MESES[x.getMonth()]; }
  function nomeDoMes(k) { return MESES[dataDe(k).getMonth()]; }

  /* as vagas como ficam com o rascunho, inclusive as sem nenhum horário (o militar fica no dia até o Salvar) */
  function vagas() {
    var mapa = {};
    d.alocacoes.forEach(function (a) { mapa[chave(a.cpf, a.data)] = a; });
    Object.keys(mud).forEach(function (k) { mapa[k] = mud[k]; });
    return Object.keys(mapa).map(function (k) { return mapa[k]; });
  }
  /* as alocações como ficam com o rascunho: só as que têm horário */
  function efetivas() { return vagas().filter(function (a) { return a.blocos && a.blocos.length; }); }
  function base(cpf, data) { return d.alocacoes.filter(function (a) { return a.cpf === cpf && a.data === data; })[0] || null; }
  function vagaDe(cpf, data) { var k = chave(cpf, data); return k in mud ? mud[k] : base(cpf, data); }
  function alocDe(cpf, data) { var v = vagaDe(cpf, data); return v && v.blocos.length ? v : null; }
  /* as mudanças do rascunho que mexem na escala (a data nova ainda sem horário não mexe) */
  function alteracoes() {
    return Object.keys(mud).filter(function (k) { return mud[k].blocos.length || !!base(mud[k].cpf, mud[k].data); });
  }
  /* os blocos (pelotão|dia) com mudança ainda não salva, para a borda tracejada (como na Escala): a extra nova, mudada ou
     tirada marca o pelotão onde ela fica e o de onde ela saiu */
  function naoSalvos() {
    var r = {};
    alteracoes().forEach(function (k) {
      var v = mud[k], b = base(v.cpf, v.data);
      r[+v.unidade + '|' + v.data] = true;
      if (b) r[+b.unidade + '|' + b.data] = true;
    });
    return r;
  }
  function blocos(a) { return a.blocos.map(Number); }
  function mesmosBlocos(a, b) { return blocos(a).sort().join() === blocos(b).sort().join(); }
  function usadas(cpf, alocs) { return (alocs || efetivas()).filter(function (a) { return a.cpf === cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  /* a distribuição só é salva depois que o pedido fecha: antes disso, só dá para tirar extra */
  function travado() { return d.mes.estado !== 'encerrado'; }
  /* lançada e não reaberta: o lançamento vale e as mudanças vão pelos Ajustes */
  function lancada() { return !!d.lancamento && !d.lancamento.reaberto; }
  /* a Distribuição depois do lançamento: só para ver (as bolinhas sem clique) */
  function soLeitura() { return modo === 'distribuicao' && lancada(); }
  /* lançada, os Ajustes mudam a escala: o dia de mais de 7 dias atrás fica só para ver (o banco trava igual) */
  function antigo(k) { return modo === 'ajustes' && lancada() && k < somaDia(d.hoje, -7); }
  function voluntarios() { return d.militares.filter(function (m) { return m.voluntario && m.termo && (m.concedidas || 0) > 0; }); }
  /* quem passou da cota no rascunho: o Salvar espera acertar */
  function passaram() {
    var alocs = efetivas();
    return voluntarios().filter(function (m) { return usadas(m.cpf, alocs) > (m.concedidas || 0); });
  }
  /* o que o rascunho faz com as cotas, para o rodapé do Salvar: nos Ajustes do mês lançado, de quem muda de número. Quem
     fica com cotas a menos vem antes de quem completou; quem passou da cota é o aviso de passaram() */
  function fraseDasCotas() {
    if (modo !== 'ajustes' || !lancada()) return '';
    var c = RW.mensagens.cotasAviso, alocs = efetivas(), aMenos = [], completos = [];
    voluntarios().forEach(function (m) {
      var agora = usadas(m.cpf, alocs), total = m.concedidas || 0;
      if (agora === usadas(m.cpf, d.alocacoes)) return;
      if (agora < total) aMenos.push({ m: m, n: agora });
      else if (agora === total) completos.push({ m: m, n: agora });
    });
    var lista = aMenos.length ? aMenos : completos;
    if (!lista.length) return '';
    if (lista.length > 1) return aMenos.length ? c.aoSalvarFicam(lista.length) : c.aoSalvarCompletam(lista.length);
    return c.aoSalvarFica((lista[0].m.grad + ' ' + lista[0].m.nome).trim(), lista[0].n, lista[0].m.concedidas || 0);
  }
  function conduz(m, cnh) { return F().conduz(m, cnh); }
  /* o que impede o militar de tirar extra no dia pela escala dele (serviço, folga, afastamento ou expediente o dia
     todo); null se nada impede */
  function impedimento(m, k) {
    var oc = (m.ocupado || {})[k];
    if (oc) return RW.mensagens.extrajornada.motivos[oc] || oc;
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && !livres.length) return msg().expedienteDiaTodo;
    return null;
  }

  /* o dia de verdade: no mês lançado, sem mudança por salvar no dia, a escala de hoje já tem as extras e diz o que sobra */
  function real(k) { return lancada() && !!d.real && !alteracoes().some(function (c) { return mud[c].data === k; }); }
  /* a falta de uma unidade num dia e o que as extras cobrem (extrajornada-falta.js); no dia de verdade, com a cor da escala */
  function faltaDoDia(uid, k, alocs) {
    var e = real(k) && escala && (escala.erro[uid] || {})[k];
    return F().doDia(d, uid, k, alocs, e && e.length === 24 ? e : null);
  }
  function somaFalta(f) { return F().soma(f); }
  function corDe(f) { return F().cor(f); }
  /* as unidades que entram na conta da falta: os pelotões (na companhia, a extra entra só manualmente) */
  function pelotoes(lista) { return (lista || d.unidades).filter(function (x) { return x.pelotao !== false; }); }

  /* ---------- as barras: a escala do mês (a mesma leitura da Escala) e a conta do depois ---------- */
  /* a escala do mês que veio com o mês (extrajornada_mes, da conta guardada no banco) */
  function escalaDoMes() {
    if (!d.escala || !RW.escalasDados) return;
    var r = RW.escalasDados.reorganizar(d.escala);
    escala = { comp: d.competencia, cobertura: r.cobertura, erro: r.erro, militares: r.militares };
  }
  function escalaPronta() { return !!escala && escala.comp === d.competencia; }
  /* o antes: com extra na escala (mês lançado ou reaberto), a escala sem elas, do banco (sem_extra); senão, a da Escala */
  function antesDoDia(uid, k) { return ((d.sem_extra || {})[uid] || {})[k] || { cobertura: escala && (escala.cobertura[uid] || {})[k], erro: escala && (escala.erro[uid] || {})[k] }; }
  function antesDe(uid, k) { var c = antesDoDia(uid, k).cobertura; return c && c.length === 24 ? c : null; }
  /* o depois: a escala com as extras (+1 por extra nas horas dele) e o vermelho e o amarelo só onde a falta sobra; no
     dia de verdade, a barra da Escala */
  function depoisDe(uid, k, alocs, falta) {
    var rc = real(k) && escala && (escala.cobertura[uid] || {})[k];
    if (rc && rc.length === 24) return { cobertura: rc.map(Number), erro: ((escala.erro[uid] || {})[k] || []).map(Number) };
    var cob = antesDe(uid, k);
    if (!cob) return null;
    var err = antesDoDia(uid, k).erro || [], c = cob.map(Number), e = [];
    alocs.forEach(function (a) {
      if (+a.unidade !== +uid || a.data !== k) return;
      blocos(a).forEach(function (b) { for (var h = (b - 1) * 6; h < b * 6; h++) c[h]++; });
    });
    for (var h = 0; h < 24; h++) {
      var b = Math.floor(h / 6) + 1, v = Number(err[h]) || 0;
      if (v === 1 && falta.base[b] > 0 && falta.total[b] === 0) v = 0;
      else if (v === 2 && falta.abase[b] > 0 && falta.atotal[b] === 0) v = 0;
      e.push(v);
    }
    return { cobertura: c, erro: e };
  }
  /* a situação de cada horário de um pelotão num dia, com as extras: 'falta' (vermelho que sobra), 'ideal'
     (amarelo que sobra), 'ok' ou 'sem' (o dia sem escala) */
  function situacao(uid, k, alocs) {
    if (!antesDe(uid, k)) return ['sem', 'sem', 'sem', 'sem'];
    return F().situacao(faltaDoDia(uid, k, alocs));
  }
  /* a régua das barras de cada unidade no mês, antes e depois das extras */
  function calcularPicos(alocs) {
    picos = {};
    d.unidades.forEach(function (un) {
      var pico = 0;
      diasDoMes().forEach(function (k) {
        (antesDe(un.id, k) || []).forEach(function (n) { if (+n > pico) pico = +n; });
      });
      alocs.forEach(function (a) {
        if (+a.unidade !== un.id) return;
        var dep = depoisDe(un.id, a.data, alocs, faltaDoDia(un.id, a.data, alocs));
        if (dep) dep.cobertura.forEach(function (n) { if (n > pico) pico = n; });
      });
      picos[un.id] = pico;
    });
  }
  function grafico(cob, uid, erro) { return RW.escalasCelula ? RW.escalasCelula.montarGrafico(cob, picos[uid] || 1, erro) : null; }

  /* muda os horários do militar no dia (o mesmo para o calendário, a lista e o painel do dia). Passar da cota fica no
     rascunho, e o Salvar espera acertar; sem nenhum horário, ele continua no dia até o Salvar */
  function mudar(m, k, novos, unidade) {
    if (soLeitura() || antigo(k)) return;
    var antes = base(m.cpf, k);
    var novo = { cpf: m.cpf, data: k, unidade: +unidade, blocos: novos.slice().sort(), origem: 'admin', porque: null };
    if (antes && +antes.unidade === novo.unidade && JSON.stringify(blocos(antes).sort()) === JSON.stringify(novo.blocos)) delete mud[chave(m.cpf, k)];
    else mud[chave(m.cpf, k)] = novo;
    if (aoMudar) aoMudar(k);
  }

  /* os dias com falta que sobram (para a conferência do lançamento) */
  function diasComFalta(dados) {
    var guarda = d; d = dados;
    var alocs = efetivas(), lista = [];
    diasDoMes().forEach(function (k) {
      pelotoes(dados.unidades).forEach(function (x) { if (somaFalta(faltaDoDia(x.id, k, alocs)) > 0) lista.push(u().br(k) + ' ' + x.nome); });
    });
    d = guarda || dados;
    return lista;
  }

  /* o que o calendário, a lista, o painel do dia e quem abriu leem e mudam */
  RW.extrajornadaGrade = {
    INI: INI, SEM_CURTA: SEM_CURTA,
    /* quem abre entrega o mês, o modo ('distribuicao' ou 'ajustes') e o que fazer quando o rascunho muda */
    iniciar: function (dados, modoNovo, quandoMudar) { d = dados; modo = modoNovo || 'distribuicao'; aoMudar = quandoMudar || null; },
    dados: function () { return d; },
    modo: function () { return modo; },
    rascunho: function () { return mud; },
    limpar: function () { mud = {}; },
    chave: chave, base: base, alteracoes: alteracoes, passaram: passaram, fraseDasCotas: fraseDasCotas, lancada: lancada, mesmosBlocos: mesmosBlocos,
    vagas: vagas, vagaDe: vagaDe, efetivas: efetivas, alocDe: alocDe, usadas: usadas, voluntarios: voluntarios, blocos: blocos, naoSalvos: naoSalvos,
    conduz: conduz, impedimento: impedimento,
    faltaDoDia: faltaDoDia, situacao: situacao, antesDe: antesDe, depoisDe: depoisDe, corDe: corDe, travado: travado, soLeitura: soLeitura, antigo: antigo,
    escalaDoMes: escalaDoMes, escalaPronta: escalaPronta,
    /* a escala lida à parte (com o rascunho do painel do dia da Escala); null: ler de novo */
    usarEscala: function (e) { escala = e; },
    calcularPicos: calcularPicos, pico: function (uid) { return picos[uid] || 0; }, grafico: grafico,
    erroAntes: function (uid, k) { return antesDoDia(uid, k).erro; },
    /* quem está de serviço no dia, na escala (sem as extras já lançadas, que aparecem nas vagas) */
    deServico: function (uid, k) { return ((escala.militares[uid] || {})[k] || []).filter(function (p) { return p.origem !== 'extra'; }); },
    pelotoes: pelotoes, diasDoMes: diasDoMes, ultimoDia: ultimoDia, dataDe: dataDe, dataLonga: dataLonga, nomeDoMes: nomeDoMes, somaDia: somaDia,
    mudar: mudar, diasComFalta: diasComFalta
  };
})();
