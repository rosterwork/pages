/* ============================================================
   NOVA EXTRA — passo 3: Por dia (o calendário)
   O mês no calendário do site (geral-calendario-mes) com, em cada
   dia, o bloco de cada pelotão (a companhia só quando tem extra) igual ao do Calendário da Escala: o
   nome com a cor do dia (verde, vermelho, amarelo), as barras antes
   e depois (a régua de cada unidade no mês) e as extras na vaga da
   Extrajornada antiga, que marca e tira ali mesmo. Clicar no bloco
   abre o painel do dia. Lê e muda o rascunho por
   RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraPorDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var alvo = null;         // o lugar do calendário (#p3-cal)
  var picos = {};          // a régua das barras de cada unidade no mês (antes e depois)
  var diasCal = {};        // a célula de cada dia no calendário { data: celula }
  var desenhadas = '';     // as unidades do calendário desenhado (ids), para saber quando refazer o mês

  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }
  function dia() { return RW.novaExtraDia; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

  function calcularPicos(alocs) {
    var d = G().dados(), cob = G().coberturaEscala();
    picos = {};
    d.unidades.forEach(function (un) {
      var pico = 0;
      Object.keys(cob[un.id] || {}).forEach(function (k) {
        (cob[un.id][k] || []).forEach(function (n) { if (+n > pico) pico = +n; });
      });
      alocs.forEach(function (a) {
        if (+a.unidade !== un.id) return;
        var dep = G().depoisDe(un.id, a.data, alocs, G().faltaDoDia(un.id, a.data, alocs));
        if (dep) dep.cobertura.forEach(function (n) { if (n > pico) pico = n; });
      });
      picos[un.id] = pico;
    });
  }
  function grafico(cob, uid, erro) { return RW.escalasCelula ? RW.escalasCelula.montarGrafico(cob, picos[uid] || 1, erro) : null; }

  function desenhar(lugar) {
    alvo = lugar;
    var d = G().dados(), alocs = G().efetivas(), unidades = u().doCalendario(alocs);
    diasCal = {};
    desenhadas = unidades.map(function (un) { return un.id; }).join(',');
    calcularPicos(alocs);
    RW.geralCalendarioMes.renderizar(alvo, { dataRef: G().dataDe(d.competencia), unidadesPorDia: Math.max(1, unidades.length), aoDia: function (cel, data, noMes) {
      if (!noMes) return;
      var k = iso(data);
      diasCal[k] = cel;
      unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs)); });
    } });
    var wrap = alvo.querySelector('.geral-calendario-mes');
    if (wrap && RW.escalasCelula) RW.escalasCelula.ativarGraficos(wrap);
  }

  /* o bloco do pelotão no dia, o mesmo do Calendário da Escala: o nome com a cor do dia, as barras antes e depois
     e as extras na vaga da Extrajornada antiga (marcar e tirar ali mesmo); clicar no bloco abre o painel do dia */
  function blocoUnidade(un, k, alocs) {
    var b = RW.tpl('tpl-escala-calendario-unidade');
    var ab = dia().aberto();
    var cel = b.querySelector('.escala-mes-celula');
    b.setAttribute('data-uid', un.id);
    b.setAttribute('data-dia', k);
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', un.nome + ', ' + u().br(k));
    cel.classList.toggle('escala-mes-celula--selecionada', !!ab && ab.uid === un.id && ab.data === k);
    var falta = G().faltaDoDia(un.id, k, alocs);
    var nome = b.querySelector('.escala-calendario-unidade-nome');
    nome.textContent = un.nome;
    var cor = G().corDe(falta);
    if (cor) nome.classList.add('nova-extra-uni-nome', 'nova-extra-uni-nome--' + cor);
    var aqui = alocs.filter(function (a) { return +a.unidade === un.id && a.data === k; })
      .sort(function (x, y) { return Math.min.apply(null, G().blocos(x)) - Math.min.apply(null, G().blocos(y)) || u().nome(x.cpf).localeCompare(u().nome(y.cpf)); });
    var antes = G().antesDe(un.id, k);
    if (antes) {
      var caixa = RW.tpl('tpl-ne-cel-barras');
      var gA = grafico(antes, un.id, G().erroAntes(un.id, k));
      if (gA) caixa.insertBefore(gA, caixa.querySelector('.ne-cel-depois'));
      var gD = null;
      if (aqui.length) { var dep = G().depoisDe(un.id, k, alocs, falta); gD = grafico(dep.cobertura, un.id, dep.erro); }
      caixa.appendChild(gD || RW.tpl('tpl-ne-cel-sem-extra'));
      cel.appendChild(caixa);
    }
    aqui.forEach(function (a) {
      var m = u().militar(a.cpf) || { cpf: a.cpf };
      cel.appendChild(u().vaga(a, un.id, {
        travado: G().travado(),
        aoMarcar: function (bl) {
          var tem = G().blocos(a), novos = m.so24 ? (tem.length ? [] : [1, 2, 3, 4]) : (tem.indexOf(bl) >= 0 ? tem.filter(function (x) { return x !== bl; }) : tem.concat([bl]));
          G().mudar(m, k, novos, un.id);
        },
        aoTirar: function () { G().mudar(m, k, [], un.id); }
      }));
    });
    b.addEventListener('click', function () { dia().abrir(un.id, k); });
    b.addEventListener('keydown', function (ev) { if (ev.target === b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); dia().abrir(un.id, k); } });
    return b;
  }

  /* refaz só os blocos de um dia (a régua das barras muda ou a companhia entra ou sai do calendário: refaz o mês) */
  function atualizarDia(k) {
    var cel = diasCal[k];
    if (!cel || !cel.isConnected) return;
    var alocs = G().efetivas(), unidades = u().doCalendario(alocs), cresceu = false;
    unidades.forEach(function (un) {
      var dep = G().depoisDe(un.id, k, alocs, G().faltaDoDia(un.id, k, alocs));
      if (dep && dep.cobertura.some(function (n) { return n > (picos[un.id] || 0); })) cresceu = true;
    });
    if (cresceu || unidades.map(function (un) { return un.id; }).join(',') !== desenhadas) { desenhar(alvo); return; }
    Array.prototype.forEach.call(cel.querySelectorAll('[data-uid]'), function (b) { b.parentNode.removeChild(b); });
    unidades.forEach(function (un) { cel.appendChild(blocoUnidade(un, k, alocs)); });
    if (RW.escalasCelula) RW.escalasCelula.desenharGraficos(cel);
  }

  /* o bloco do dia aberto no painel fica em destaque */
  function marcarAberto() {
    if (!alvo) return;
    var ab = dia().aberto();
    Array.prototype.forEach.call(alvo.querySelectorAll('[data-uid][data-dia]'), function (b) {
      b.querySelector('.escala-mes-celula').classList.toggle('escala-mes-celula--selecionada', !!ab && +b.getAttribute('data-uid') === ab.uid && b.getAttribute('data-dia') === ab.data);
    });
  }

  RW.novaExtraPorDia = { desenhar: desenhar, atualizarDia: atualizarDia, marcarAberto: marcarAberto, grafico: grafico };
})();
