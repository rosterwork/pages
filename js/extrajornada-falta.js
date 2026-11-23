/* ============================================================
   EXTRAJORNADA — a conta da falta de um dia
   O que falta numa unidade num dia, por horário de 6 h, o vermelho e
   o amarelo, e o que as extras cobrem. A falta vem do banco
   (extrajornada_mes), lida na escala sem as extras que já estão nela:
   o número é só de pessoas (as que faltam para o mínimo e, no
   amarelo, para o ideal); o condutor que falta e o chefe que dirige
   (com a CNH que a viatura pede) ficam à parte, fora do número. Cada
   extra conta como uma pessoa (a vermelha e depois a amarela) e,
   se conduz a viatura, cobre o condutor que falta; senão, tira o
   chefe da direção. O horário continua vermelho enquanto faltar
   pessoa ou condutor. No dia de verdade (o mês lançado sem mudança
   por salvar no dia), o que sobra é o da escala de hoje: a falta
   "real" do banco e a cor da barra da Escala.
   A linha da Falta de gente (o Exibir) usa a base e o total daqui
   (só pessoas) no componente geral-falta-gente (horarios: a mesma
   conta para a tela, extrajornada-por-dia.js, e para a folha,
   extrajornada-imprimir-grade.js).
   Só conta: não cria HTML nem escreve estilo.
   RosterWork.extrajornadaFalta.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function u() { return RW.extrajornadaUtil; }
  /* os horários de 6 h em que a extra fecha falta: os que ela cobre inteiros (a que começa no fim do expediente não
     cobre o último) */
  function blocos(a) { return u().cheios(a); }
  /* a CNH que a viatura pede ('' = qualquer uma) está entre as que ele conduz (o banco diz quais) */
  function conduz(m, cnh) { return !cnh || (m.conduz || []).indexOf(cnh) >= 0; }
  /* a cor de um horário na barra da Escala: o vermelho (1) vence o amarelo (2) */
  function corDoHorario(erro, b) {
    var h = erro.slice((b - 1) * 6, b * 6).map(Number);
    return h.indexOf(1) >= 0 ? 1 : h.indexOf(2) >= 0 ? 2 : 0;
  }

  /* a falta de uma unidade num dia, por horário, a vermelha e a amarela (a que começa com "a"): base (as pessoas que
     faltam na escala sem as extras), total (as pessoas que sobram com as extras), cbase e cond (os condutores que
     faltam, antes e com as extras; no amarelo, o chefe que dirige). d: o mês; alocs: as extras; erroReal: no dia de
     verdade, a cor de cada hora da escala de hoje (24), e então o que sobra vem dela e da falta "real" */
  function doDia(d, uid, k, alocs, erroReal) {
    function ler(mapa) { return ((mapa || {})[String(uid)] || {})[k] || {}; }
    function tira(lista, m) { for (var i = 0; i < lista.length; i++) { if (conduz(m, lista[i])) { lista.splice(i, 1); return true; } } return false; }
    var base = ler(d.falta), pede = ler(d.falta_condutor), abase = ler(d.falta_amarela), apede = ler(d.falta_amarela_condutor);
    var aqui = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k; });
    var r = { base: {}, cbase: {}, cond: {}, total: {}, cnh: [], abase: {}, acbase: {}, acond: {}, atotal: {}, acnh: [], cobre: {} };
    /* o que cada extra cobriu (condutor, gente, chefe, ideal), para o relatório do dia */
    function cobriu(a, o) { var l = r.cobre[a.cpf] = r.cobre[a.cpf] || []; if (l.indexOf(o) < 0) l.push(o); }
    [1, 2, 3, 4].forEach(function (b) {
      var conds = (pede[String(b)] || []).slice(), aconds = (apede[String(b)] || []).slice();
      r.cbase[b] = conds.length;
      r.acbase[b] = aconds.length;
      conds.forEach(function (c) { if (c && r.cnh.indexOf(c) < 0) r.cnh.push(c); });
      aconds.forEach(function (c) { if (c && r.acnh.indexOf(c) < 0) r.acnh.push(c); });
      var gente = base[String(b)] || 0, agente = abase[String(b)] || 0;
      aqui.forEach(function (a) {
        if (blocos(a).indexOf(b) < 0) return;
        var m = u().militar(a.cpf) || {};
        /* o condutor fica à parte: quem conduz a viatura cobre o condutor que falta ou tira o chefe da direção */
        if (tira(conds, m)) cobriu(a, 'condutor');
        else if (tira(aconds, m)) cobriu(a, 'chefe');
        /* e conta como uma das pessoas que faltam: a vermelha e depois a amarela */
        if (gente > 0) { gente--; cobriu(a, 'gente'); }
        else if (agente > 0) { agente--; cobriu(a, 'ideal'); }
      });
      r.base[b] = base[String(b)] || 0;
      r.cond[b] = conds.length;
      r.total[b] = gente;
      r.abase[b] = abase[String(b)] || 0;
      r.acond[b] = aconds.length;
      r.atotal[b] = agente;
    });
    if (erroReal) deVerdade(d.real || {}, r, ler, erroReal);
    return r;
  }
  /* o dia de verdade: o que sobra é o da escala de hoje (a falta "real" do banco: as pessoas e, à parte, a CNH) e a cor
     de cada horário é a da barra da Escala (niveis: 1 vermelho, 2 amarelo, 0 nada) */
  function deVerdade(real, r, ler, erroReal) {
    var rb = ler(real.falta), rp = ler(real.falta_condutor), ra = ler(real.falta_amarela), rap = ler(real.falta_amarela_condutor);
    r.cnh = []; r.acnh = []; r.niveis = {};
    [1, 2, 3, 4].forEach(function (b) {
      var c = rp[String(b)] || [], ac = rap[String(b)] || [];
      c.forEach(function (x) { if (x && r.cnh.indexOf(x) < 0) r.cnh.push(x); });
      ac.forEach(function (x) { if (x && r.acnh.indexOf(x) < 0) r.acnh.push(x); });
      r.cond[b] = c.length;
      r.total[b] = rb[String(b)] || 0;
      r.acond[b] = ac.length;
      r.atotal[b] = ra[String(b)] || 0;
      r.niveis[b] = corDoHorario(erroReal, b);
    });
  }
  /* a linha da Falta de gente de um pelotão no dia (a conta de cada horário de 6 h do geral-falta-gente): a falta do dia
     (f, de doDia), as extras de cada horário (as do pelotão no dia, só os horários que cada uma cobre inteiros) e a cor de
     cada hora do gráfico (erro) */
  function horarios(f, uid, k, alocs, erro) {
    var extras = { 1: 0, 2: 0, 3: 0, 4: 0 };
    alocs.forEach(function (a) { if (+a.unidade === +uid && a.data === k) blocos(a).forEach(function (b) { extras[b]++; }); });
    return RW.faltaGente.porHorario(f.base, f.total, extras, erro);
  }
  /* o vermelho que sobra (pessoas e condutor), para a conferência do lançamento */
  function soma(f) { return [1, 2, 3, 4].reduce(function (s, b) { return s + f.total[b] + f.cond[b]; }, 0); }
  /* tinha falta antes das extras (pessoas ou condutor; no amarelo, ideal ou chefe dirigindo) */
  function tinha(f, b) { return f.base[b] + (f.cbase ? f.cbase[b] : 0) + f.abase[b] + (f.acbase ? f.acbase[b] : 0) > 0; }
  /* a cor do dia de um pelotão: 'erro' ou 'alerta' se ainda sobra pessoa ou condutor; 'ok' se tinha falta e as extras
     cobriram. No dia de verdade, a cor da barra da Escala */
  function cor(f) {
    function tem(o) { return [1, 2, 3, 4].some(function (b) { return o[b] > 0; }); }
    function nivel(n) { return [1, 2, 3, 4].some(function (b) { return f.niveis[b] === n; }); }
    var antes = [1, 2, 3, 4].some(function (b) { return tinha(f, b); });
    if (f.niveis) return nivel(1) ? 'erro' : nivel(2) ? 'alerta' : antes ? 'ok' : '';
    return tem(f.total) || tem(f.cond) ? 'erro' : tem(f.atotal) || tem(f.acond) ? 'alerta' : antes ? 'ok' : '';
  }
  /* a situação de cada horário: 'falta' (vermelho que sobra: pessoa ou condutor), 'ideal' (amarelo que sobra) ou 'ok' */
  function situacao(f) {
    return [1, 2, 3, 4].map(function (b) {
      if (f.niveis) return f.niveis[b] === 1 ? 'falta' : f.niveis[b] === 2 ? 'ideal' : 'ok';
      return f.total[b] + f.cond[b] > 0 ? 'falta' : f.atotal[b] + f.acond[b] > 0 ? 'ideal' : 'ok';
    });
  }

  RW.extrajornadaFalta = { doDia: doDia, horarios: horarios, soma: soma, tinha: tinha, cor: cor, situacao: situacao, conduz: conduz };
})();
