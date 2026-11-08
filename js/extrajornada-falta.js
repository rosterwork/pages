/* ============================================================
   EXTRAJORNADA — a conta da falta de um dia
   O que falta numa unidade num dia, por horário de 6 h, o vermelho e
   o amarelo, e o que as extras cobrem. A falta vem do banco
   (extrajornada_mes), lida na escala sem as extras que já estão nela:
   a gente que falta, o condutor que falta e o chefe que dirige (com
   a CNH que a viatura pede) e o ideal dos postos. Cada extra cobre um
   condutor vermelho que ele conduz; senão, tira o chefe da direção
   se conduz a viatura e conta como uma das pessoas que faltam (a
   vermelha e depois a amarela). No dia de verdade (o mês
   lançado sem mudança por salvar no dia), o que sobra é o da escala
   de hoje: a falta "real" do banco e a cor da barra da Escala.
   Só conta: não cria HTML nem escreve estilo.
   RosterWork.extrajornadaFalta.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function u() { return RW.extrajornadaUtil; }
  function blocos(a) { return a.blocos.map(Number); }
  /* a CNH que a viatura pede ('' = qualquer uma) está entre as que ele conduz (o banco diz quais) */
  function conduz(m, cnh) { return !cnh || (m.conduz || []).indexOf(cnh) >= 0; }
  /* a cor de um horário na barra da Escala: o vermelho (1) vence o amarelo (2) */
  function corDoHorario(erro, b) {
    var h = erro.slice((b - 1) * 6, b * 6).map(Number);
    return h.indexOf(1) >= 0 ? 1 : h.indexOf(2) >= 0 ? 2 : 0;
  }

  /* a falta de uma unidade num dia, por horário, a vermelha e a amarela (a que começa com "a"): base (a da escala sem as
     extras), cond (condutor que sobra) e total (o que sobra com as extras). d: o mês; alocs: as extras; erroReal: no dia
     de verdade, a cor de cada hora da escala de hoje (24), e então o que sobra vem dela e da falta "real" */
  function doDia(d, uid, k, alocs, erroReal) {
    function ler(mapa) { return ((mapa || {})[String(uid)] || {})[k] || {}; }
    function tira(lista, m) { for (var i = 0; i < lista.length; i++) { if (conduz(m, lista[i])) { lista.splice(i, 1); return true; } } return false; }
    var base = ler(d.falta), pede = ler(d.falta_condutor), abase = ler(d.falta_amarela), apede = ler(d.falta_amarela_condutor);
    var aqui = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k; });
    var r = { base: {}, cond: {}, total: {}, cnh: [], abase: {}, acond: {}, atotal: {}, acnh: [], cobre: {} };
    /* o que cada extra cobriu (condutor, gente, chefe, ideal), para o relatório do dia */
    function cobriu(a, o) { var l = r.cobre[a.cpf] = r.cobre[a.cpf] || []; if (l.indexOf(o) < 0) l.push(o); }
    [1, 2, 3, 4].forEach(function (b) {
      var conds = (pede[String(b)] || []).slice(), aconds = (apede[String(b)] || []).slice();
      conds.forEach(function (c) { if (c && r.cnh.indexOf(c) < 0) r.cnh.push(c); });
      aconds.forEach(function (c) { if (c && r.acnh.indexOf(c) < 0) r.acnh.push(c); });
      var gente = (base[String(b)] || 0) - conds.length, agente = (abase[String(b)] || 0) - aconds.length;
      aqui.forEach(function (a) {
        if (blocos(a).indexOf(b) < 0) return;
        var m = u().militar(a.cpf) || {};
        if (tira(conds, m)) { cobriu(a, 'condutor'); return; }
        /* quem conduz a viatura em que o chefe dirige tira o chefe da direção e ainda conta como uma das pessoas */
        if (tira(aconds, m)) cobriu(a, 'chefe');
        if (gente > 0) { gente--; cobriu(a, 'gente'); return; }
        if (agente > 0) { agente--; cobriu(a, 'ideal'); }
      });
      r.base[b] = base[String(b)] || 0;
      r.cond[b] = conds.length;
      r.total[b] = Math.max(0, gente) + conds.length;
      r.abase[b] = abase[String(b)] || 0;
      r.acond[b] = aconds.length;
      r.atotal[b] = Math.max(0, agente) + aconds.length;
    });
    if (erroReal) deVerdade(d.real || {}, r, ler, erroReal);
    return r;
  }
  /* o dia de verdade: o que sobra é o da escala de hoje (a falta "real" do banco, com a CNH) e a cor de cada horário é
     a da barra da Escala (niveis: 1 vermelho, 2 amarelo, 0 nada) */
  function deVerdade(real, r, ler, erroReal) {
    var rb = ler(real.falta), rp = ler(real.falta_condutor), ra = ler(real.falta_amarela), rap = ler(real.falta_amarela_condutor);
    r.cnh = []; r.acnh = []; r.niveis = {};
    [1, 2, 3, 4].forEach(function (b) {
      var c = rp[String(b)] || [], ac = rap[String(b)] || [];
      c.forEach(function (x) { if (x && r.cnh.indexOf(x) < 0) r.cnh.push(x); });
      ac.forEach(function (x) { if (x && r.acnh.indexOf(x) < 0) r.acnh.push(x); });
      r.cond[b] = c.length;
      r.total[b] = Math.max(rb[String(b)] || 0, c.length);
      r.acond[b] = ac.length;
      r.atotal[b] = Math.max(ra[String(b)] || 0, ac.length);
      r.niveis[b] = corDoHorario(erroReal, b);
    });
  }
  function soma(f) { return f.total[1] + f.total[2] + f.total[3] + f.total[4]; }
  /* a cor do dia de um pelotão: 'erro' ou 'alerta' se ainda sobra; 'ok' se tinha erro e as extras cobriram. No dia de
     verdade, a cor da barra da Escala */
  function cor(f) {
    function tem(o) { return [1, 2, 3, 4].some(function (b) { return o[b] > 0; }); }
    function nivel(n) { return [1, 2, 3, 4].some(function (b) { return f.niveis[b] === n; }); }
    if (f.niveis) return nivel(1) ? 'erro' : nivel(2) ? 'alerta' : (tem(f.base) || tem(f.abase)) ? 'ok' : '';
    return tem(f.total) ? 'erro' : tem(f.atotal) ? 'alerta' : (tem(f.base) || tem(f.abase)) ? 'ok' : '';
  }
  /* a situação de cada horário: 'falta' (vermelho que sobra), 'ideal' (amarelo que sobra) ou 'ok' */
  function situacao(f) {
    return [1, 2, 3, 4].map(function (b) {
      if (f.niveis) return f.niveis[b] === 1 ? 'falta' : f.niveis[b] === 2 ? 'ideal' : 'ok';
      return f.total[b] > 0 ? 'falta' : f.atotal[b] > 0 ? 'ideal' : 'ok';
    });
  }

  RW.extrajornadaFalta = { doDia: doDia, soma: soma, cor: cor, situacao: situacao, conduz: conduz };
})();
