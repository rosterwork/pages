/* ============================================================
   NOVA EXTRA — passo 3: Por militar (a grade dos 31 dias)
   Os dias do mês nas colunas, separados por linhas. Um bloco por
   pelotão: na linha dele, as 4 bolinhas de cada dia dizem se o horário
   está coberto (verde), se ainda falta gente (vermelho) ou o ideal
   (amarelo), já com as extras do rascunho; embaixo, uma linha por
   militar, com as cotas e as micro bolinhas dos horários de extra em
   cada dia (a sigla quando é em outro pelotão). Clicar no quadrado
   abre a caixa do dia, colada a ele (geral-flutuante): os selos, os
   4 horários deste dia para marcar e os outros dias dele, que também
   se desmarcam ali. Lê e muda o rascunho por RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraMilitares.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  var el = null;
  var caixa = null;        // a caixa do quadrado aberta: { cpf, data, uid, no, desligar }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }
  function fds(k) { var s = G().dataDe(k).getDay(); return s === 0 || s === 6; }

  /* as 4 bolinhas: cada uma recebe a classe do horário (on, ok, falta, ideal, sem) */
  function bolinhas(classes) {
    var b = RW.tpl('tpl-ne-bol');
    Array.prototype.forEach.call(b.children, function (i, j) { if (classes[j]) i.classList.add('nova-extra-bol--' + classes[j]); });
    return b;
  }

  function desenhar(conteudo) {
    el = conteudo;
    var d = G().dados(), alocs = G().efetivas(), dias = G().diasDoMes();
    var alvo = el.querySelector('#p3-gm');
    alvo.textContent = '';
    var tabela = RW.tpl('tpl-ne-gm-tabela');
    var cab = tabela.querySelector('.ne-gm-cab');
    dias.forEach(function (k) {
      var th = RW.tpl('tpl-ne-gm-th');
      th.querySelector('.ne-sem').textContent = LETRA[G().dataDe(k).getDay()];
      th.querySelector('.ne-num').textContent = +k.slice(8, 10);
      th.classList.toggle('nova-extra-gm-dia--fds', fds(k));
      cab.appendChild(th);
    });
    var corpo = tabela.querySelector('tbody');
    var vols = G().voluntarios();
    var ordem = d.unidades.map(function (x) { return x.id; });
    d.unidades.forEach(function (un) {
      var daqui = vols.filter(function (m) { return m.unidade_id === un.id; }).sort(function (x, y) { return (x.ordem || 0) - (y.ordem || 0); });
      if (!daqui.length && un.pelotao === false) return;
      corpo.appendChild(linhaPelotao(un, dias, alocs, daqui));
      daqui.forEach(function (m) { corpo.appendChild(linhaMilitar(m, dias, alocs)); });
    });
    /* quem é de uma unidade fora da lista (ex.: transferido) vai no fim, sem bloco */
    vols.filter(function (m) { return ordem.indexOf(m.unidade_id) < 0; }).forEach(function (m) { corpo.appendChild(linhaMilitar(m, dias, alocs)); });
    alvo.appendChild(tabela);
    el.querySelector('#p3-mil-vazio').classList.toggle('oculto', vols.length > 0);
    tabela.classList.toggle('oculto', !vols.length);
    if (caixa) reabrirCaixa();
  }

  function linhaPelotao(un, dias, alocs, daqui) {
    var tr = RW.tpl('tpl-ne-gm-pel');
    tr.querySelector('.ne-pel-nome').textContent = un.nome + (un.cidade ? ' · ' + un.cidade : '');
    var usadas = daqui.reduce(function (s, m) { return s + G().usadas(m.cpf, alocs); }, 0);
    var tem = daqui.reduce(function (s, m) { return s + (m.concedidas || 0); }, 0);
    tr.querySelector('.ne-pel-info').textContent = msg().pelCotas(usadas, tem);
    dias.forEach(function (k) {
      var td = RW.tpl('tpl-ne-gm-td');
      td.classList.toggle('nova-extra-gm-dia--fds', fds(k));
      if (un.pelotao !== false) td.appendChild(bolinhas(G().situacao(un.id, k, alocs)));
      tr.appendChild(td);
    });
    return tr;
  }

  function linhaMilitar(m, dias, alocs) {
    var tr = RW.tpl('tpl-ne-gm-linha');
    tr.querySelector('small').textContent = m.grad;
    tr.querySelector('b').textContent = m.nome;
    var usou = G().usadas(m.cpf, alocs);
    var cota = tr.querySelector('.ne-gm-cota');
    cota.textContent = msg().deCotas(usou, m.concedidas);
    cota.classList.toggle('nova-extra-gm-cota--sobra', usou < m.concedidas);
    cota.classList.toggle('nova-extra-gm-cota--cheia', usou === m.concedidas);
    cota.classList.toggle('nova-extra-negativo', usou > m.concedidas);
    dias.forEach(function (k) {
      var td = RW.tpl('tpl-ne-gm-cel');
      td.classList.toggle('nova-extra-gm-dia--fds', fds(k));
      var casa = td.querySelector('.nova-extra-gm-casa');
      casa.setAttribute('data-cpf', m.cpf);
      casa.setAttribute('data-dia', k);
      casa.setAttribute('aria-label', m.grad + ' ' + m.nome + ', ' + u().br(k));
      var a = G().alocDe(m.cpf, k);
      if (a) {
        var b = G().blocos(a);
        casa.appendChild(bolinhas([1, 2, 3, 4].map(function (x) { return b.indexOf(x) >= 0 ? 'on' : ''; })));
        if (+a.unidade !== m.unidade_id) {
          casa.classList.add('nova-extra-gm-casa--fora');
          var s = RW.tpl('tpl-ne-gm-sigla');
          s.textContent = (u().unidade(a.unidade) || {}).nome || '';
          casa.appendChild(s);
        }
      }
      casa.addEventListener('click', function () { abrirCaixa(m, k, casa); });
      tr.appendChild(td);
    });
    return tr;
  }

  /* ---------- a caixa do quadrado ---------- */
  function abrirCaixa(m, k, casa) {
    fecharCaixa();
    var a = G().alocDe(m.cpf, k);
    caixa = { cpf: m.cpf, data: k, uid: a ? +a.unidade : m.unidade_id, no: RW.tpl('tpl-ne-caixa-dia'), desligar: null };
    el.querySelector('#p3-militares').appendChild(caixa.no);
    caixa.no.querySelector('.ne-cx-fechar').addEventListener('click', fecharCaixa);
    ancorar(casa);
    preencherCaixa();
    document.addEventListener('mousedown', foraDaCaixa, true);
    document.addEventListener('keydown', escDaCaixa);
  }

  function ancorar(casa) {
    if (caixa.desligar) caixa.desligar();
    el.querySelectorAll('.nova-extra-gm-casa--aberta').forEach(function (c) { c.classList.remove('nova-extra-gm-casa--aberta'); });
    casa.classList.add('nova-extra-gm-casa--aberta');
    caixa.desligar = RW.flutuante.ancorar(casa, caixa.no, { limitarAltura: true, aoSair: fecharCaixa });
  }

  function preencherCaixa() {
    var m = u().militar(caixa.cpf), k = caixa.data, uid = caixa.uid, alocs = G().efetivas(), no = caixa.no;
    var a = G().alocDe(m.cpf, k), marcados = a ? G().blocos(a) : [];
    var usou = G().usadas(m.cpf, alocs);
    no.querySelector('.ne-cx-nome').textContent = m.grad + ' ' + m.nome;
    no.querySelector('.ne-cx-sub').textContent = msg().caixaSub(G().dataLonga(k), (u().unidade(uid) || {}).nome || '', usou, m.concedidas);
    var selos = no.querySelector('.ne-cx-selos');
    selos.textContent = '';
    selos.appendChild(RW.novaExtraDia.selosDoDia(m, uid, k, marcados, true));
    var este = no.querySelector('.ne-cx-este');
    este.textContent = '';
    este.appendChild(linhaDia(m, k, marcados, uid, true));
    var outros = alocs.filter(function (x) { return x.cpf === m.cpf && x.data !== k; }).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    var lista = no.querySelector('.ne-cx-outros');
    lista.textContent = '';
    outros.forEach(function (x) { lista.appendChild(linhaDia(m, x.data, G().blocos(x), +x.unidade, false)); });
    no.querySelector('.ne-cx-outros-titulo').classList.toggle('oculto', !outros.length);
    var aviso = no.querySelector('.ne-cx-aviso');
    var sobra = G().sobra(m.cpf);
    aviso.textContent = usou > m.concedidas ? msg().passouCota(usou - m.concedidas)
      : (sobra && usou < m.concedidas ? msg().sobraMotivo(m.concedidas - usou, sobra.motivo) : '');
    aviso.classList.toggle('oculto', !aviso.textContent);
    aviso.classList.toggle('nova-extra-falta-sobra', usou > m.concedidas);
  }

  /* um dia na caixa: o dia, a unidade quando é outra e os 4 horários (os mesmos do painel do dia) */
  function linhaDia(m, k, marcados, uid, este) {
    var o = RW.tpl('tpl-escala-extra-outro');
    var outra = uid !== m.unidade_id ? ' · ' + ((u().unidade(uid) || {}).nome || '') : '';
    o.querySelector('.escala-extra-outro-dia').textContent = msg().diaSemana(k.slice(8, 10), G().SEM_CURTA[G().dataDe(k).getDay()]) + outra;
    o.classList.toggle('nova-extra-caixa-dia-este', este);
    RW.novaExtraDia.ligarMarcas(o.querySelector('.escala-extra-marcas'), m, k, marcados, uid);
    return o;
  }

  /* depois de mudar, a grade é refeita: a caixa volta para o quadrado novo, com o conteúdo atualizado */
  function reabrirCaixa() {
    var casa = el.querySelector('.nova-extra-gm-casa[data-cpf="' + caixa.cpf + '"][data-dia="' + caixa.data + '"]');
    if (!casa) { fecharCaixa(); return; }
    ancorar(casa);
    preencherCaixa();
  }

  function foraDaCaixa(ev) {
    if (!caixa || caixa.no.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest('.nova-extra-gm-casa')) return;
    fecharCaixa();
  }
  function escDaCaixa(ev) { if (ev.key === 'Escape') fecharCaixa(); }

  function fecharCaixa() {
    if (!caixa) return;
    if (caixa.desligar) caixa.desligar();
    if (caixa.no.parentNode) caixa.no.parentNode.removeChild(caixa.no);
    if (el) el.querySelectorAll('.nova-extra-gm-casa--aberta').forEach(function (c) { c.classList.remove('nova-extra-gm-casa--aberta'); });
    caixa = null;
    document.removeEventListener('mousedown', foraDaCaixa, true);
    document.removeEventListener('keydown', escDaCaixa);
  }

  RW.novaExtraMilitares = { desenhar: desenhar, fecharCaixa: fecharCaixa };
})();
