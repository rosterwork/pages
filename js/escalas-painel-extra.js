/* ============================================================
   ESCALA — painel do dia › aba EXTRAJORNADA
   A mesma aba no painel do dia da Escala e da Extrajornada.
   No topo, a nota (lançado ou não) e a COBERTURA DO DIA (barras sem
   extra e com extra, por ensaio no motor, já com o rascunho; em
   escalas-painel-extra-cobertura.js). Depois, a LISTA DO DIA em grupos: Neste dia, Querem este dia, Disponíveis,
   Não querem este dia (fechado) e Indisponíveis (com o motivo). Cada
   militar é uma linha: o nome, os outros dias dele com as horas, as
   cotas do mês ("6 de 6") e os 4 horários de 6 h, que o administrador
   marca e desmarca. Clicar nos outros dias abre, embaixo do nome, os
   horários daqueles dias, para mudar de data sem sair daqui; quem
   passa da cota abre sozinho, com o aviso. As mudanças vão para o
   rascunho do mês (escalas-extra-rascunho.js) e só gravam no Salvar.
   Embaixo, o motivo (depois que o mês começa) e os ajustes do dia.
   Quem não é administrador vê só quem tira extra no dia.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.escalasPainelExtra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var ctx = null;   // { corpo, rodape, uid, iso, admin, ativo, lista, painel, seqLista, seqPainel, abertos, mostrar, timer, ... }
  var ouvinteLigado = false;

  function msg() { return RW.mensagens.escala.extraPainel; }
  function R() { return RW.escalasExtraRascunho; }
  function Cob() { return RW.escalasPainelExtraCobertura; }
  function ddmm(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function dd(s) { return String(s || '').slice(8, 10); }
  function mesmo(a, b) { return String(a) === String(b); }

  /* ---------- o estado de cada militar (o salvo com o rascunho por cima) ---------- */
  function efetivas(m) { return R() ? R().aplicar(m.cpf, m.extras || []) : (m.extras || []); }
  function doDia(lista, iso) { for (var i = 0; i < lista.length; i++) if (lista[i].data === iso) return lista[i]; return null; }
  function totalCotas(lista) { return lista.reduce(function (s, e) { return s + (e.blocos || []).length; }, 0); }

  /* o grupo vem do que está salvo (a linha não pula de grupo enquanto se marca; o Salvar reorganiza) */
  function grupoDe(m) {
    var salvoHoje = doDia(m.extras || [], ctx.iso);
    if (salvoHoje && mesmo(salvoHoje.unidade_id, ctx.uid)) return 'neste';
    if (salvoHoje) return 'indisponiveis';
    if (m.ocupado) return 'indisponiveis';
    if (m.pref === 'quer') return 'querem';
    if (m.pref === 'nao_quer') return 'naoQuerem';
    return 'disponiveis';
  }
  function motivoDe(m) {
    var salvoHoje = doDia(m.extras || [], ctx.iso);
    if (salvoHoje) return msg().extraEm(salvoHoje.unidade_nome || '');
    var o = m.ocupado || {};
    var texto = msg().ocupado[o.motivo] || '';
    return o.ate ? msg().ate(texto, ddmm(o.ate)) : texto;
  }

  /* marca ou desmarca um horário de um militar num dia (fecha 24 h: os 4 juntos) */
  function marcar(m, iso, uid, bloco) {
    var atual = doDia(efetivas(m), iso);
    var blocos = atual ? atual.blocos.slice() : [];
    var unidade = atual ? atual.unidade_id : uid;
    var i = blocos.indexOf(bloco);
    if (m.fecha24) blocos = blocos.length ? [] : [1, 2, 3, 4];
    else if (i >= 0) blocos.splice(i, 1);
    else blocos.push(bloco);
    var salvo = doDia(m.extras || [], iso);
    R().definir({ cpf: m.cpf, data: iso, unidade: unidade, blocos: blocos,
      antes: salvo ? { unidade: salvo.unidade_id, blocos: salvo.blocos } : null, militar: { grad: m.grad, nome: m.nome } });
  }

  /* os 4 horários; o que um pontual do militar ocupa (bloqueados) fica desligado, com a dica (se ainda não marcado) */
  function pintarMarcas(caixa, blocos, ligar, bloqueados) {
    Array.prototype.forEach.call(caixa.querySelectorAll('.escala-extra-marca'), function (b) {
      var k = +b.getAttribute('data-bloco');
      var on = (blocos || []).indexOf(k) >= 0;
      var pontual = !on && (bloqueados || []).indexOf(k) >= 0;
      b.classList.toggle('escala-extra-marca--on', on);
      b.classList.toggle('escala-extra-marca--pontual', pontual);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (!ligar || pontual) b.disabled = true;
      if (pontual) b.setAttribute('data-dica', msg().blocoPontual);
    });
  }

  /* ---------- uma linha da lista ---------- */
  function linhaMilitar(m, grupo) {
    var indisponivel = grupo === 'indisponiveis';
    var l = RW.tpl(indisponivel ? 'tpl-escala-extra-indisponivel' : 'tpl-escala-extra-militar');
    if (!l) return null;
    l.dataset.cpf = m.cpf;
    if (RW.busca) l.setAttribute('data-busca', RW.busca.chave(m));
    l.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    l.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    l.querySelector('.escala-extra-ponto').classList.add(m.pref === 'quer' ? 'escala-extra-ponto--quer' : (m.pref === 'nao_quer' ? 'escala-extra-ponto--nao' : 'escala-extra-ponto--neutro'));
    var un = l.querySelector('.escala-extra-quem-unidade');
    if (m.unidade_id && !mesmo(m.unidade_id, ctx.uid)) { un.textContent = m.unidade_nome || ''; un.classList.remove('oculto'); }
    if (indisponivel) { l.querySelector('.escala-extra-motivo-texto').textContent = motivoDe(m); return l; }
    preencherLinha(l, m);
    if (ctx.admin) {
      Array.prototype.forEach.call(l.querySelectorAll(':scope > .escala-extra-marcas .escala-extra-marca'), function (b) {
        b.addEventListener('click', function () { marcar(m, ctx.iso, ctx.uid, +b.getAttribute('data-bloco')); });
      });
      l.querySelector('.escala-extra-dias').addEventListener('click', function () {
        if (!l.querySelector('.escala-extra-dia')) return;
        ctx.abertos[m.cpf] = !ctx.abertos[m.cpf];
        preencherLinha(l, m);
      });
    }
    return l;
  }

  /* o que muda com o rascunho: os outros dias, as cotas, os horários de hoje e a parte aberta */
  function preencherLinha(l, m) {
    var lista = efetivas(m);
    var hoje = doDia(lista, ctx.iso);
    var outros = lista.filter(function (e) { return e.data !== ctx.iso; });
    var total = totalCotas(lista);
    var passou = total - (m.cota || 0);

    var dias = l.querySelector('.escala-extra-dias');
    dias.textContent = '';
    outros.forEach(function (e) {
      var d = RW.tpl('tpl-escala-extra-dia');
      if (!d) return;
      d.querySelector('.escala-extra-dia-texto').textContent = msg().dia(dd(e.data));
      d.querySelector('.escala-extra-dia-horas').textContent = msg().horas(e.blocos.length * 6);
      dias.appendChild(d);
    });
    dias.disabled = !outros.length || !ctx.admin;

    var cota = l.querySelector('.escala-extra-cota');
    cota.textContent = msg().cota(total, m.cota || 0);
    cota.classList.toggle('escala-extra-cota--erro', passou > 0);

    pintarMarcas(l.querySelector(':scope > .escala-extra-marcas'), hoje ? hoje.blocos : [], ctx.admin, m.blocos_pontual);

    /* a parte aberta embaixo do nome: o aviso (passou da cota) e os horários dos outros dias;
       passar da cota abre e deixa aberta (o administrador acerta ali e fecha quando quiser) */
    if (passou > 0) ctx.abertos[m.cpf] = true;
    var aberto = ctx.admin && outros.length > 0 && !!ctx.abertos[m.cpf];
    dias.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    l.classList.toggle('escala-extra-militar--aberto', aberto);
    var area = l.querySelector('.escala-extra-outros');
    area.textContent = '';
    area.classList.toggle('oculto', !aberto);
    if (!aberto) return;
    if (passou > 0) {
      var nota = RW.tpl('tpl-escala-nota');
      if (nota) {
        nota.classList.add('nota--erro');
        nota.querySelector('.nota-texto').textContent = msg().passou(passou) + msg().passouTexto(passou);
        area.appendChild(nota);
      }
    }
    outros.forEach(function (e) {
      var o = RW.tpl('tpl-escala-extra-outro');
      if (!o) return;
      var p = e.data.split('-');
      o.querySelector('.escala-extra-outro-dia').textContent = msg().diaSemana(dd(e.data), SEMANA[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]);
      pintarMarcas(o, e.blocos, true);
      Array.prototype.forEach.call(o.querySelectorAll('.escala-extra-marca'), function (b) {
        b.addEventListener('click', function () { marcar(m, e.data, e.unidade_id, +b.getAttribute('data-bloco')); });
      });
      area.appendChild(o);
    });
  }

  /* ---------- os grupos ---------- */
  function caixaGrupo(chave, itens, fechavel) {
    var g = RW.tpl('tpl-escala-extra-grupo');
    if (!g) return null;
    g.dataset.grupo = chave;
    g.querySelector('.escala-extra-grupo-nome').textContent = msg().grupos[chave];
    g.querySelector('.escala-extra-grupo-conta').textContent = String(itens.length);
    var linhas = g.querySelector('.escala-extra-grupo-linhas');
    var horas = g.querySelector('.escala-extra-horas');
    var mostrar = g.querySelector('.escala-extra-mostrar');
    var fechado = fechavel && !ctx.mostrar[chave];
    if (chave === 'indisponiveis' || !ctx.admin) horas.classList.add('oculto');
    if (fechado) {
      horas.classList.add('oculto');
      mostrar.classList.remove('oculto');
      mostrar.addEventListener('click', function () { ctx.mostrar[chave] = true; desenharLista(); });
      return g;
    }
    if (!itens.length) {
      var v = RW.tpl('tpl-escala-distribuicao-estado');
      if (v) { v.textContent = msg().ninguemNeste; linhas.appendChild(v); }
    }
    itens.forEach(function (m) { var l = linhaMilitar(m, chave); if (l) linhas.appendChild(l); });
    return g;
  }

  function desenharLista() {
    if (!ctx || !ctx.listaEl) return;
    var alvo = ctx.listaEl;
    alvo.textContent = '';
    var d = ctx.lista;
    if (!d || !d.ok) { estado(alvo, (d && d.error) || msg().falha); return; }
    var por = { neste: [], querem: [], disponiveis: [], naoQuerem: [], indisponiveis: [] };
    (d.militares || []).forEach(function (m) { por[grupoDe(m)].push(m); });
    if (!ctx.admin) {
      var g0 = caixaGrupo('neste', por.neste, false);
      if (g0) alvo.appendChild(g0);
      return;
    }
    if (!(d.militares || []).length) { estado(alvo, msg().semVoluntarios); return; }
    [['neste', false], ['querem', false], ['disponiveis', false], ['naoQuerem', true], ['indisponiveis', false]].forEach(function (par) {
      if (par[0] !== 'neste' && !por[par[0]].length) return;
      var g = caixaGrupo(par[0], por[par[0]], par[1]);
      if (g) alvo.appendChild(g);
    });
    aplicarBusca();
  }

  /* o rascunho mudou: só redesenha as linhas dos militares mexidos (a lista não pula) */
  function aoMudarRascunho(e) {
    if (!ctx || !ctx.listaEl || !ctx.listaEl.isConnected) return;
    var det = (e && e.detail) || {};
    if (det.salvou) { carregar(); return; }
    if (det.limpou) { desenharLista(); Cob().carregar(ctx); montarRodape(); return; }
    var m = ((ctx.lista && ctx.lista.militares) || []).filter(function (x) { return x.cpf === det.cpf; })[0];
    var l = m && ctx.listaEl.querySelector('.escala-extra-militar[data-cpf="' + det.cpf + '"]');
    if (l && !l.classList.contains('escala-extra-militar--indisponivel')) preencherLinha(l, m);
    if (det.data === ctx.iso) Cob().agendar(ctx);
    montarRodape();
  }

  /* ---------- busca ---------- */
  function aplicarBusca() {
    if (!ctx || !ctx.listaEl || !RW.busca) return;
    var termo = ctx.buscaTermo || '', modo = ctx.buscaModo || 'marcar';
    Array.prototype.forEach.call(ctx.listaEl.querySelectorAll('.escala-extra-militar'), function (l) {
      var casa = RW.busca.casaTexto(termo, l.getAttribute('data-busca'));
      l.classList.toggle('escala-extra-militar--busca', !!termo && casa && modo === 'marcar');
      l.classList.toggle('oculto', !!termo && !casa && modo === 'filtrar');
    });
  }

  function estado(alvo, texto) {
    var e = RW.tpl('tpl-escala-distribuicao-estado');
    if (e) { e.textContent = texto; alvo.appendChild(e); }
  }

  /* ---------- rodapé ---------- */
  function montarRodape() {
    var rodape = ctx && ctx.rodape;
    if (!rodape) return;
    rodape.textContent = '';
    if (!ctx.admin) { rodape.classList.add('oculto'); return; }
    var n = R() ? R().contar() : 0;
    var info = RW.tpl('tpl-escala-edicao-info');
    if (info) { info.textContent = msg().alteracoes(n, R() ? R().dias() : 0); rodape.appendChild(info); }
    var t = document.getElementById('tpl-escala-painel-acoes');
    if (t) rodape.appendChild(t.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-painel-cancelar');
    var salvarBtn = rodape.querySelector('.escala-painel-salvar');
    if (cancelar) { cancelar.disabled = !n; cancelar.addEventListener('click', function () { R().cancelar(); }); }
    if (salvarBtn) { salvarBtn.disabled = !n; salvarBtn.addEventListener('click', function () { R().salvar(salvarBtn); }); }
  }

  /* ---------- a aba ---------- */
  function montarSubcab() {
    var sub = RW.painel.subcabecalho();
    if (!sub) return;
    sub.textContent = '';
    if (!ctx.admin) { sub.classList.add('oculto'); return; }
    var b = RW.tpl('tpl-escala-extra-busca');
    if (b && RW.busca) {
      sub.appendChild(b);
      RW.busca.criar({ caixa: b, aoBuscar: function (t, modo) { if (!ctx) return; ctx.buscaTermo = t || ''; ctx.buscaModo = modo || 'marcar'; aplicarBusca(); } });
    }
    sub.classList.remove('oculto');
  }

  function desenharTudo() {
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var d = ctx.lista;
    if (!d || !d.ok) { estado(corpo, (d && d.error) || msg().falha); montarRodape(); return; }
    var areas = RW.tpl('tpl-escala-extra-corpo');
    if (!areas) return;
    if (ctx.admin) {
      var nota = RW.tpl('tpl-escala-nota');
      if (nota) { nota.querySelector('.nota-texto').textContent = Cob().textoNota(ctx, d); areas.insertBefore(nota, areas.firstChild); }
    }
    ctx.coberturaEl = areas.querySelector('.escala-extra-area-cobertura');
    ctx.listaEl = areas.querySelector('.escala-extra-lista');
    ctx.ajustesEl = areas.querySelector('.escala-extra-area-ajustes');
    corpo.appendChild(areas);
    desenharLista();
    if (ctx.admin && d.iniciado) {
      var mot = RW.tpl('tpl-escala-extra-motivo');
      if (mot) {
        var inp = mot.querySelector('input');
        inp.value = R().motivo();
        inp.addEventListener('input', function () { R().motivo(inp.value); });
        areas.querySelector('.escala-extra-area-motivo').appendChild(mot);
      }
    }
    if (ctx.painel) Cob().desenhar(ctx);
    montarRodape();
  }

  function carregar() {
    if (!ctx) return;
    var meu = ctx, seq = ++meu.seqLista;
    if (!meu.lista) {
      meu.corpo.textContent = '';
      var c = RW.tpl('tpl-escala-distribuicao-carregando');
      if (c) meu.corpo.appendChild(c);
    }
    RW.escalasDados.extraLista(meu.uid, meu.iso).then(function (r) {
      if (ctx !== meu || seq !== meu.seqLista) return;
      meu.lista = r || { ok: false };
      if (meu.lista.ok && R()) R().mes(meu.lista.competencia);
      desenharTudo();
    });
    Cob().carregar(meu);
  }

  function montar(corpo, rodape, unidadeId, iso) {
    if (ctx) reset();
    ctx = { corpo: corpo, rodape: rodape, uid: unidadeId, iso: iso, admin: RosterWork.sessao.ehAdmin(), ativo: true,
      lista: null, painel: null, seqLista: 0, seqPainel: 0, abertos: {}, mostrar: {}, timer: null,
      listaEl: null, coberturaEl: null, ajustesEl: null, buscaTermo: '', buscaModo: 'marcar' };
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    montarSubcab();
    carregar();
    if (!ouvinteLigado) { ouvinteLigado = true; window.addEventListener('rosterwork_extra_rascunho', aoMudarRascunho); }
  }

  function reset() {
    if (ctx) { ctx.ativo = false; if (ctx.timer) clearTimeout(ctx.timer); }
    ctx = null;
  }

  /* trocar de dia ou de aba não descarta nada (o rascunho é do mês) */
  function estaSujo() { return false; }
  /* fechar o painel onde a grade da Distribuição não está à vista (a Escala, o Calendário) pede para descartar */
  function fecharSujo() {
    var grade = document.getElementById('extra-escala-cal');
    return !!(R() && R().sujo()) && (!grade || !!grade.closest('.oculto'));
  }

  RW.escalasPainelExtra = { montar: montar, reset: reset, estaSujo: estaSujo, fecharSujo: fecharSujo };
})();
