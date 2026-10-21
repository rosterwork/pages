/* ============================================================
   EXTRAJORNADA — aba Distribuição › A escalar (painel esquerdo)
   Quem tem o termo recebido e cota concedida no mês, por unidade,
   com quanto já está na grade ("2 de 4", já com o rascunho do mês) e
   a barrinha. Clicar no militar avisa a grade (evento
   rosterwork_extra_militar), que pinta as células pela preferência
   dele e põe a vaga dele nos dias livres; em cima da grade, a barra
   "Escalando ...: 2 de 4 cotas". Clicar de novo, numa área vazia ou no
   Soltar da barra tira a seleção. As cotas se repartem na aba
   Voluntários (extra_cotas_carregar, o que está salvo). No celular a
   lista fica em cima da grade, recolhida: a seta do cabeçalho abre e
   fecha, e escolher um militar fecha.
   Não cria HTML (clona moldes) nem escreve estilo (só classList,
   textContent e a custom property --fill).
   RosterWork.extrajornadaEscalar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var naAba = false;
  var el = {};
  var comp = null;
  var cargaSeq = 0;
  var selecionado = null;   // cpf do militar que pinta a grade
  var itens = [];           // [{ v, it }] os militares da lista (para refazer as contas com o rascunho)
  var ouvinteLigado = false;

  function msg() { return RW.mensagens.extrajornada.voluntarios; }
  function ativo() { return naAba && el.lista && el.lista.isConnected; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }

  function avisarGrade() {
    window.dispatchEvent(new CustomEvent('rosterwork_extra_militar', { detail: { cpf: selecionado } }));
  }
  function marcar() {
    if (!el.lista) return;
    Array.prototype.forEach.call(el.lista.querySelectorAll('.extra-escalar-item'), function (b) {
      b.classList.toggle('lista-item--ativo', !!selecionado && b.dataset.cpf === selecionado);
    });
  }
  function selecionar(cpf) {
    selecionado = selecionado === cpf ? null : cpf;
    marcar();
    atualizarPincel();
    avisarGrade();
    abrirLista(false);
  }
  /* no celular o A escalar fica recolhido em cima da grade: a seta abre e fecha a lista (no computador ela está sempre à vista) */
  function abrirLista(abrir) {
    if (!el.painel || !el.alternar) return;
    el.painel.classList.toggle('extra-escalar--aberto', abrir);
    el.alternar.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }

  /* as cotas na grade de cada militar com o rascunho por cima (o que ele ganhou ou perdeu sem salvar) */
  function saldoRascunho(cpf) {
    var R = RW.escalasExtraRascunho;
    return R ? R.doMilitar(cpf).reduce(function (s, m) { return s + m.blocos.length - ((m.antes && m.antes.blocos) ? m.antes.blocos.length : 0); }, 0) : 0;
  }
  function atualizarContas() {
    var faltam = 0;
    itens.forEach(function (x) {
      var feito = (x.v.preenchido || 0) + saldoRascunho(x.v.cpf), total = x.v.concedido_salvo;
      faltam += Math.max(0, total - feito);
      x.it.querySelector('.extra-escalar-conta').textContent = msg().naEscala(feito, total);
      /* a largura da barrinha é dado calculado: custom property, o CSS desenha */
      x.it.querySelector('.extra-escalar-barra-fill').style.setProperty('--fill', Math.max(0, Math.min(100, Math.round(feito / total * 100))) + '%');
      x.it.classList.toggle('extra-escalar-item--completo', feito >= total);
    });
    if (el.faltando) el.faltando.textContent = itens.length ? msg().faltando(faltam) : '';
    atualizarPincel();
  }
  /* a barra em cima da grade: quem está sendo escalado e as cotas dele (vermelha quando passa da cota) */
  function atualizarPincel() {
    if (!el.pincel) return;
    var x = selecionado && itens.filter(function (i) { return i.v.cpf === selecionado; })[0];
    el.pincel.classList.toggle('oculto', !x);
    if (!x) return;
    var feito = (x.v.preenchido || 0) + saldoRascunho(x.v.cpf), total = x.v.concedido_salvo;
    el.pincelTitulo.textContent = RW.mensagens.extrajornada.distribuicao.escalando(((x.v.grad || '') + ' ' + (x.v.nome || '')).trim(), feito, total);
    el.pincel.classList.toggle('nota--erro', feito > total);
  }

  function desenhar(r) {
    el.lista.textContent = '';
    itens = [];
    /* só quem tem o termo recebido e cota salva no mês */
    var vols = [];
    (r.grupos || []).forEach(function (g) {
      (g.voluntarios || []).forEach(function (v) { if (v.termo && (v.concedido_salvo || 0) > 0) vols.push(v); });
    });
    if (!vols.length) {
      if (el.faltando) el.faltando.textContent = '';
      var p = RosterWork.tpl('tpl-extra-estado');
      if (p) { p.textContent = msg().semEscalar; el.lista.appendChild(p); }
      return;
    }
    (r.unidades || []).forEach(function (u) {
      var deles = vols.filter(function (v) { return v.unidade_id === u.unidade_id; });
      if (!deles.length) return;
      var faixa = RosterWork.tpl('tpl-extra-escalar-grupo');
      if (faixa) {
        faixa.querySelector('.extra-escalar-grupo-nome').textContent = u.nome;
        faixa.querySelector('.extra-escalar-grupo-cidade').textContent = u.cidade || '';
        el.lista.appendChild(faixa);
      }
      deles.forEach(function (v) {
        var it = RosterWork.tpl('tpl-extra-escalar-item');
        if (!it) return;
        it.dataset.cpf = v.cpf;
        it.querySelector('.extra-vol-grad').textContent = v.grad || '';
        it.querySelector('.extra-vol-nome').textContent = v.nome || '';
        itens.push({ v: v, it: it });
        it.addEventListener('click', function (e) { e.stopPropagation(); selecionar(v.cpf); });
        el.lista.appendChild(it);
      });
    });
    atualizarContas();
    marcar();
  }

  function carregar() {
    if (!RW.extrajornadaDados || !ativo()) return;
    var req = ++cargaSeq;
    if (!el.lista.querySelector('.extra-escalar-item')) {
      el.lista.textContent = '';
      var c = RosterWork.tpl('tpl-painel-carregando');
      if (c) el.lista.appendChild(c);
    }
    RW.extrajornadaDados.carregarCotas(iso(comp), null).then(function (r) {
      if (!ativo() || req !== cargaSeq) return;
      if (!r || !r.ok) {
        el.lista.textContent = '';
        var p = RosterWork.tpl('tpl-extra-estado');
        if (p) { p.textContent = (r && r.error) || RW.mensagens.extrajornada.falhaCotas; el.lista.appendChild(p); }
        return;
      }
      desenhar(r);
    });
  }

  function montar(cont) {
    el.lista = cont.querySelector('#extra-escalar-lista');
    el.faltando = cont.querySelector('#extra-escalar-faltando');
    selecionado = null;
    itens = [];
    el.pincel = cont.querySelector('#extra-pincel');
    el.pincelTitulo = cont.querySelector('#extra-pincel-titulo');
    var soltarBtn = cont.querySelector('#extra-pincel-soltar');
    if (soltarBtn) soltarBtn.addEventListener('click', soltar);
    el.painel = cont.querySelector('#extra-escalar');
    el.alternar = cont.querySelector('#extra-escalar-alternar');
    if (el.alternar) el.alternar.addEventListener('click', function () {
      abrirLista(!el.painel.classList.contains('extra-escalar--aberto'));
    });
    if (!ouvinteLigado) {
      ouvinteLigado = true;
      window.addEventListener('rosterwork_extra_rascunho', function () { if (ativo()) atualizarContas(); });
    }
    /* clicar numa área vazia do painel tira a seleção */
    if (el.lista) el.lista.addEventListener('click', function (e) {
      if (e.target.closest('.extra-escalar-item')) return;
      if (selecionado) selecionar(selecionado);
    });
  }

  function ativar() {
    naAba = true;
    var m = RW.extrajornadaMes.obter();
    comp = new Date(m.getFullYear(), m.getMonth(), 1);
    carregar();
  }
  function desativar() { naAba = false; }
  /* a grade mudou de mês: segue o mesmo mês e solta a seleção */
  function sincronizarMes(nova) {
    if (!nova) return;
    comp = new Date(nova.getFullYear(), nova.getMonth(), 1);
    if (selecionado) { selecionado = null; atualizarPincel(); avisarGrade(); }
    carregar();
  }

  /* o Soltar da barra da grade */
  function soltar() { if (selecionado) selecionar(selecionado); }

  RW.extrajornadaEscalar = { montar: montar, ativar: ativar, desativar: desativar, sincronizarMes: sincronizarMes,
    recarregar: carregar };
})();
