/* ============================================================
   NOVA EXTRA — Organizar o mês e o Calendário
   Lê o mês inteiro (nova_extra_mes) e desenha os passos: 1 Pedidos
   e termos (prazo e termo), 2 Cotas (repartição justa), 3
   Distribuição (nova-extra-montar.js), 4 Lançar (simulado) e 5
   Ajustes e relatório; e a aba Calendário (o mês por unidade). O
   "Mês já começou" do grupo TESTE finge o início do mês.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraOrg (e RosterWork.novaExtraUtil).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'], FIM = ['14h', '20h', '02h', '08h'];

  var el = null;          // a página
  var d = null;           // a resposta do nova_extra_mes
  var aba = null;         // 'organizar' ou 'calendario'
  var passo = null;       // o passo aberto
  var pedido = 0;         // latest-wins
  var p1 = null, p2 = null;   // edições dos passos 1 e 2

  function msg() { return RW.mensagens.novaExtra.org; }
  function br(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }
  function todos(sel, f) { Array.prototype.forEach.call(el.querySelectorAll(sel), f); }
  function q(sel) { return el.querySelector(sel); }

  /* ---------- peças comuns (também do passo 3) ---------- */
  var util = {
    horas: function (blocos) {
      var b = blocos.slice().map(Number).sort(), partes = [], ini = b[0], ant = b[0];
      for (var i = 1; i <= b.length; i++) {
        if (b[i] === ant + 1) { ant = b[i]; continue; }
        partes.push(INI[ini - 1] + ' às ' + FIM[ant - 1]);
        ini = b[i]; ant = b[i];
      }
      return partes.join(' e ');
    },
    militar: function (cpf) { return (d && d.militares.filter(function (m) { return m.cpf === cpf; })[0]) || null; },
    unidade: function (id) { return (d && d.unidades.filter(function (u) { return u.id === +id; })[0]) || null; },
    nome: function (cpf) { var m = util.militar(cpf); return m ? m.grad + ' ' + m.nome : cpf; },
    br: br,
    /* o mês em semanas, um bloco por unidade em cada dia, com quem tira extra (e, em comBarras, os 4 horários da falta) */
    mesCalendario: function (cont, alocs, comBarras, faltaRestante) {
      cont.textContent = '';
      var comp = new Date(+d.competencia.slice(0, 4), +d.competencia.slice(5, 7) - 1, 1);
      var ultimo = new Date(comp.getFullYear(), comp.getMonth() + 1, 0).getDate();
      ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(function (l) { var s = RW.tpl('tpl-ne-sem'); s.textContent = l; cont.appendChild(s); });
      for (var i = 0; i < comp.getDay(); i++) cont.appendChild(RW.tpl('tpl-ne-vazio'));
      for (var dia = 1; dia <= ultimo; dia++) {
        var k = d.competencia.slice(0, 8) + String(dia).padStart(2, '0');
        var cel = RW.tpl('tpl-ne-dia-cal');
        cel.querySelector('.nova-extra-dia-cal-num').textContent = dia;
        d.unidades.forEach(function (u) {
          var daqui = alocs.filter(function (a) { return a.data === k && +a.unidade === u.id; });
          if (!daqui.length && !comBarras) return;
          var bloco = RW.tpl('tpl-ne-dia-uni');
          bloco.querySelector('.ne-unome').textContent = u.nome;
          if (comBarras) {
            var f4 = RW.tpl('tpl-ne-f4');
            var falta = faltaRestante(u.id, k);
            Array.prototype.forEach.call(f4.children, function (b, j) { b.classList.toggle('nova-extra-f4--falta', (falta[j + 1] || 0) > 0); b.classList.add('nova-extra-f4--ok'); });
            bloco.querySelector('.nova-extra-dia-uni-cab').appendChild(f4);
          }
          daqui.forEach(function (a) {
            var m = util.militar(a.cpf) || {};
            var p = RW.tpl('tpl-ne-dia-pessoa');
            p.querySelector('small').textContent = m.grad || '';
            p.querySelector('b').textContent = m.nome || a.cpf;
            p.querySelector('.ne-de').textContent = m.unidade_id && m.unidade_id !== u.id ? msg().de((util.unidade(m.unidade_id) || {}).nome || '') : '';
            p.querySelector('.ne-hora').textContent = util.horas(a.blocos);
            bloco.appendChild(p);
          });
          cel.appendChild(bloco);
        });
        cont.appendChild(cel);
      }
    }
  };
  RW.novaExtraUtil = util;

  /* ---------- carregar ---------- */
  function carregar() {
    var meu = ++pedido;
    var comp = RW.novaExtra.comp();
    RW.rpc('nova_extra_mes', { p_competencia: comp }).then(function (r) {
      if (meu !== pedido || !el.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      d = r;
      p1 = null; p2 = null;
      var ini = q('#nova-extra-iniciado');
      ini.setAttribute('aria-checked', d.mes.simular_inicio ? 'true' : 'false');
      ini.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', !!d.mes.simular_inicio);
      if (aba === 'calendario') desenharCalendario();
      else { passosTopo(); abrirPasso(passo || passoAtual()); }
    }, function () { if (meu === pedido) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function vols() { return d.militares.filter(function (m) { return m.voluntario; }); }
  function totalConcedidas() { return vols().reduce(function (s, m) { return s + (m.concedidas || 0); }, 0); }
  function naGrade() { return d.alocacoes.reduce(function (s, a) { return s + a.blocos.length; }, 0); }

  function passoAtual() {
    if (d.iniciado) return 5;
    if (d.mes.estado !== 'encerrado') return 1;
    if (!totalConcedidas()) return 2;
    if (naGrade() < totalConcedidas()) return 3;
    return 4;
  }

  function passosTopo() {
    var atual = passoAtual();
    var resp = d.militares.filter(function (m) { return m.respondeu; }).length;
    var textos = [
      msg().p1(br(d.mes.abre), br(d.mes.fecha), resp, d.militares.length),
      d.mes.cotas_recebidas ? msg().p2(d.mes.cotas_recebidas, totalConcedidas()) : msg().p2Depois,
      msg().p3(naGrade(), totalConcedidas()),
      d.lancamento ? msg().p4Lancado(d.lancamento.lancado_em) : msg().p4Nao,
      d.iniciado ? msg().p5(d.ajustes.length) : msg().p5Depois
    ];
    todos('.nova-extra-passo-cartao', function (b) {
      var n = +b.getAttribute('data-passo');
      b.querySelector('.nova-extra-passo-status').textContent = textos[n - 1];
      b.classList.toggle('nova-extra-passo-cartao--feito', n < atual);
      b.classList.toggle('nova-extra-passo-cartao--agora', n === atual);
      b.classList.toggle('nova-extra-passo-cartao--aberto', n === passo);
    });
  }

  function abrirPasso(n) {
    if (passo === 3 && n !== 3 && RW.novaExtraMontar && RW.novaExtraMontar.sujo()) {
      RW.confirmar({ tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar, textoConfirmar: RW.mensagens.botoes.descartar,
        textoCancelar: RW.mensagens.botoes.continuarEditando, aoConfirmar: function () { RW.novaExtraMontar.descartar(); abrirPasso(n); } });
      return;
    }
    passo = n;
    todos('[data-passo-painel]', function (p) { p.classList.toggle('oculto', +p.getAttribute('data-passo-painel') !== n); });
    passosTopo();
    if (n === 1) passo1();
    else if (n === 2) passo2();
    else if (n === 3 && RW.novaExtraMontar) RW.novaExtraMontar.mostrar(d, el, carregar);
    else if (n === 4) passo4();
    else passo5();
  }

  /* ---------- passo 1: prazo, respostas e termos ---------- */
  function passo1() {
    if (!p1) p1 = { lista: 'vol', termos: {} };
    q('#p1-abre').value = d.mes.abre; q('#p1-fecha').value = d.mes.fecha; q('#p1-aviso').value = d.mes.aviso_dias;
    var resp = d.militares.filter(function (m) { return m.respondeu; });
    q('#p1-respostas').textContent = msg().responderam(resp.length, d.militares.length);
    q('#p1-n-vol').textContent = vols().length;
    q('#p1-n-nao').textContent = resp.length - vols().length;
    q('#p1-n-sem').textContent = d.militares.length - resp.length;
    todos('#p1-filtro [data-lista]', function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-lista') === p1.lista); });
    var lista = d.militares.filter(function (m) {
      return p1.lista === 'vol' ? m.voluntario : p1.lista === 'nao' ? m.respondeu && !m.voluntario : !m.respondeu;
    });
    var tb = q('#p1-lista');
    tb.textContent = '';
    lista.forEach(function (m) {
      var tr = RW.tpl('tpl-ne-p1-linha');
      tr.querySelector('small').textContent = m.grad;
      tr.querySelector('b').textContent = m.nome;
      tr.querySelector('.ne-uni').textContent = (util.unidade(m.unidade_id) || {}).nome || '';
      tr.querySelector('.ne-cotas').textContent = m.voluntario ? msg().cotas(m.cotas, m.so24) : '';
      tr.querySelector('.ne-quer').textContent = m.voluntario ? msg().dias(m.quer.length) : '';
      tr.querySelector('.ne-nao').textContent = m.voluntario ? msg().dias(m.nao_posso.length) : '';
      tr.querySelector('.ne-em').textContent = m.enviado_em || '';
      var t = tr.querySelector('.ne-termo');
      if (!m.voluntario) { t.classList.add('oculto'); } else {
        var marcado = m.cpf in p1.termos ? p1.termos[m.cpf] : m.termo;
        t.setAttribute('aria-checked', marcado ? 'true' : 'false');
        t.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', marcado);
        t.addEventListener('click', function () {
          var v = !(m.cpf in p1.termos ? p1.termos[m.cpf] : m.termo);
          if (v === m.termo) delete p1.termos[m.cpf]; else p1.termos[m.cpf] = v;
          passo1();
        });
      }
      tb.appendChild(tr);
    });
    q('#p1-vazio').classList.toggle('oculto', lista.length > 0);
    var n = Object.keys(p1.termos).length;
    q('#p1-mudancas').textContent = n ? msg().termosMudados(n) : '';
    q('#p1-salvar').disabled = !n;
  }

  /* ---------- passo 2: cotas ---------- */
  function conc(m) { return m.cpf in p2.conc ? p2.conc[m.cpf] : (m.concedidas || 0); }
  function comTermo() { return vols().filter(function (m) { return m.termo; }).sort(function (a, b) { return a.ordem - b.ordem; }); }
  function passo2() {
    if (!p2) p2 = { recebidas: d.mes.cotas_recebidas, modo: d.mes.repartir_por || 'grupo', unidades: Object.assign({}, d.mes.cotas_unidades || {}), conc: {}, sujo: false };
    q('#p2-recebidas').value = p2.recebidas == null ? '' : p2.recebidas;
    q('#p2-recebidas').disabled = p2.modo === 'por_unidade';
    todos('input[name="p2-modo"]', function (r) { r.checked = r.value === p2.modo; });
    var uni = q('#p2-unidades');
    uni.classList.toggle('oculto', p2.modo !== 'por_unidade');
    uni.textContent = '';
    d.unidades.forEach(function (u) {
      var c = RW.tpl('tpl-ne-p2-unidade');
      c.querySelector('span').textContent = u.nome;
      var inp = c.querySelector('input');
      inp.value = p2.unidades[u.id] == null ? '' : p2.unidades[u.id];
      inp.addEventListener('change', function () { p2.unidades[u.id] = inp.value === '' ? 0 : +inp.value; p2.sujo = true; passo2(); });
      uni.appendChild(c);
    });
    var total = p2.modo === 'por_unidade' ? Object.keys(p2.unidades).reduce(function (s, k) { return s + (+p2.unidades[k] || 0); }, 0) : (+p2.recebidas || 0);
    var lista = comTermo();
    var rep = lista.reduce(function (s, m) { return s + conc(m); }, 0);
    q('#p2-repartidas').textContent = rep;
    q('#p2-sobram').textContent = total - rep;
    q('#p2-sobram').classList.toggle('nova-extra-negativo', total - rep < 0);
    var tb = q('#p2-lista');
    tb.textContent = '';
    lista.forEach(function (m, i) {
      var tr = RW.tpl('tpl-ne-p2-linha');
      tr.querySelector('.nova-extra-fila').textContent = i + 1;
      tr.querySelector('small').textContent = m.grad;
      tr.querySelector('b').textContent = m.nome;
      tr.querySelector('.ne-uni').textContent = (util.unidade(m.unidade_id) || {}).nome || '';
      tr.querySelector('.ne-pediu').textContent = msg().cotas(m.cotas, m.so24);
      var taxa = Math.round((m.taxa == null ? 1 : +m.taxa) * 100);
      tr.querySelector('.nova-extra-trilho i').classList.add('nova-extra-trilho--' + Math.min(10, Math.round(taxa / 10)));
      tr.querySelector('.ne-taxa').textContent = taxa + '%';
      tr.querySelector('.ne-hist').textContent = m.pediu12 ? msg().recebeu(m.recebeu12, m.pediu12) : msg().semHistorico;
      tr.querySelector('.ne-sug').textContent = m.sugerido;
      var inp = tr.querySelector('.nova-extra-conc');
      inp.value = conc(m);
      inp.max = m.cotas;
      inp.step = m.so24 ? 4 : 1;
      inp.addEventListener('change', function () {
        var v = Math.max(0, Math.min(m.cotas, +inp.value || 0));
        if (m.so24) v = v >= 8 ? 8 : v >= 4 ? 4 : 0;
        p2.conc[m.cpf] = v; p2.sujo = true; passo2();
      });
      tb.appendChild(tr);
    });
    q('#p2-vazio').classList.toggle('oculto', lista.length > 0);
    q('#p2-mudancas').textContent = p2.sujo ? msg().naoSalvo : '';
    q('#p2-salvar').disabled = !p2.sujo;
  }

  function salvarCotas(depois) {
    var concedidas = {};
    comTermo().forEach(function (m) { concedidas[m.cpf] = conc(m); });
    RW.rpc('nova_extra_cotas_salvar', {
      p_competencia: d.competencia, p_cotas_recebidas: p2.modo === 'por_unidade' ? null : (p2.recebidas === '' ? null : +p2.recebidas),
      p_repartir_por: p2.modo, p_cotas_unidades: p2.modo === 'por_unidade' ? p2.unidades : null, p_concedidas: concedidas
    }).then(function (r) {
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      if (depois) depois(); else carregar();
    });
  }

  /* ---------- passo 4: conferir e lançar ---------- */
  function item(cont, ok, titulo, texto) {
    var it = RW.tpl('tpl-ne-item');
    it.classList.add(ok ? 'nova-extra-item--ok' : 'nova-extra-item--alerta');
    it.querySelector('b').textContent = titulo;
    it.querySelector('.nova-extra-item-texto span').textContent = texto || '';
    cont.appendChild(it);
  }

  function chave(a) { return a.cpf + '|' + a.data; }

  function passo4() {
    var conf = q('#p4-conferencia');
    conf.textContent = '';
    var v = vols(), termos = v.filter(function (m) { return m.termo; }).length;
    item(conf, d.mes.estado === 'encerrado', d.mes.estado === 'encerrado' ? msg().c1ok(br(d.mes.fecha)) : msg().c1aberto(br(d.mes.fecha)), msg().c1texto(v.length, termos));
    item(conf, totalConcedidas() > 0, msg().c2(totalConcedidas(), d.mes.cotas_recebidas || 0), '');
    item(conf, naGrade() >= totalConcedidas() && totalConcedidas() > 0, msg().c3(naGrade(), totalConcedidas()), '');
    var falta = RW.novaExtraMontar ? RW.novaExtraMontar.diasComFalta(d) : [];
    item(conf, !falta.length, falta.length ? msg().c4(falta.length) : msg().c4ok, falta.slice(0, 6).join(', ') + (falta.length > 6 ? '…' : ''));

    var lanc = d.lancamento;
    q('#p4-titulo').textContent = lanc ? msg().lancadoTitulo(lanc.lancado_em, lanc.por || '') : msg().aoLancar;
    var btn = q('#p4-lancar');
    var mud = q('#p4-mudancas');
    mud.textContent = '';
    if (d.iniciado) {
      q('#p4-texto').textContent = msg().jaComecou;
      btn.classList.add('oculto');
      return;
    }
    btn.classList.remove('oculto');
    btn.textContent = lanc ? msg().lancarDeNovo : msg().lancar;
    if (lanc) {
      var antes = {}, agora = {};
      lanc.foto.forEach(function (a) { antes[chave(a)] = a; });
      d.alocacoes.forEach(function (a) { agora[chave(a)] = a; });
      var mudas = Object.keys(Object.assign({}, antes, agora)).filter(function (k) {
        return JSON.stringify(antes[k] && [antes[k].unidade, antes[k].blocos]) !== JSON.stringify(agora[k] && [agora[k].unidade, agora[k].blocos]);
      });
      q('#p4-texto').textContent = mudas.length ? msg().mudouDesde(mudas.length) : msg().nadaMudou;
      mudas.slice(0, 12).forEach(function (k) {
        var a = antes[k], b = agora[k], x = a || b;
        item(mud, false, util.nome(x.cpf) + ', ' + br(x.data), (a ? util.horas(a.blocos) : msg().nada) + ' para ' + (b ? util.horas(b.blocos) : msg().tirado));
      });
      btn.disabled = !mudas.length;
    } else {
      q('#p4-texto').textContent = msg().lancarTexto(d.alocacoes.length);
      btn.disabled = !d.alocacoes.length;
    }
  }

  function lancar() {
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().confirmarLancar, textoConfirmar: msg().lancar,
      aoConfirmar: function () {
        RW.rpc('nova_extra_lancar', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
          RW.avisar({ tipo: 'sucesso', mensagem: msg().lancado(r.extras, r.dias) });
          carregar();
        });
      }
    });
  }

  /* ---------- passo 5: ajustes e relatório inicial ---------- */
  function passo5() {
    var aj = q('#p5-ajustes');
    aj.textContent = '';
    if (!d.ajustes.length) item(aj, true, msg().semAjustes, d.iniciado ? '' : msg().ajustesDepois);
    d.ajustes.forEach(function (j) {
      var era = j.era ? util.horas(j.era.blocos) + ' (' + ((util.unidade(j.era.unidade) || {}).nome || '') + ')' : msg().nada;
      var ficou = j.ficou ? util.horas(j.ficou.blocos) + ' (' + ((util.unidade(j.ficou.unidade) || {}).nome || '') + ')' : msg().tirado;
      item(aj, false, util.nome(j.cpf) + ', ' + br(j.data) + ': ' + era + ' para ' + ficou, msg().ajusteFeito(j.em, j.autor || '', j.motivo));
    });
    var ini = q('#p5-inicial');
    ini.textContent = '';
    if (!d.lancamento) { item(ini, true, msg().semLancamento, ''); return; }
    var porDia = {};
    d.lancamento.foto.forEach(function (a) { (porDia[a.data] = porDia[a.data] || []).push(a); });
    Object.keys(porDia).sort().forEach(function (k) {
      item(ini, true, br(k), porDia[k].map(function (a) { return util.nome(a.cpf) + ' (' + ((util.unidade(a.unidade) || {}).nome || '') + ', ' + util.horas(a.blocos) + ')'; }).join('; '));
    });
  }

  /* ---------- aba Calendário ---------- */
  function desenharCalendario() {
    q('#nova-extra-cal-aviso').classList.toggle('oculto', !!d.lancamento);
    util.mesCalendario(q('#nova-extra-cal-mes'), d.alocacoes, false);
  }

  /* ---------- entrada ---------- */
  function montar(conteudo) {
    el = conteudo;
    d = null; passo = null;
    todos('.nova-extra-passo-cartao', function (b) { b.addEventListener('click', function () { if (d) abrirPasso(+b.getAttribute('data-passo')); }); });
    todos('#p1-filtro [data-lista]', function (b) { b.addEventListener('click', function () { p1.lista = b.getAttribute('data-lista'); passo1(); }); });
    q('#p1-salvar-prazo').addEventListener('click', function () {
      RW.rpc('nova_extra_prazo_salvar', { p_competencia: d.competencia, p_abre: q('#p1-abre').value, p_fecha: q('#p1-fecha').value, p_aviso: +q('#p1-aviso').value }).then(function (r) {
        if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
        carregar();
      });
    });
    q('#p1-cancelar').addEventListener('click', function () { p1.termos = {}; passo1(); });
    q('#p1-salvar').addEventListener('click', function () {
      RW.rpc('nova_extra_termos_salvar', { p_competencia: d.competencia, p_termos: p1.termos }).then(function (r) {
        if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
        carregar();
      });
    });
    q('#p2-recebidas').addEventListener('change', function () { p2.recebidas = q('#p2-recebidas').value; p2.sujo = true; passo2(); });
    todos('input[name="p2-modo"]', function (r) { r.addEventListener('change', function () { p2.modo = r.value; p2.sujo = true; passo2(); }); });
    q('#p2-cancelar').addEventListener('click', function () { p2 = null; passo2(); });
    q('#p2-salvar').addEventListener('click', function () { salvarCotas(); });
    q('#p2-sugestao').addEventListener('click', function () {
      salvarCotas(function () {
        RW.rpc('nova_extra_mes', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.ok) return;
          d = r; p2 = null; passo2();
          comTermo().forEach(function (m) { p2.conc[m.cpf] = m.sugerido; });
          p2.sujo = true; passo2(); passosTopo();
        });
      });
    });
    q('#p4-lancar').addEventListener('click', lancar);
    q('#nova-extra-iniciado').addEventListener('click', function () {
      var v = q('#nova-extra-iniciado').getAttribute('aria-checked') !== 'true';
      RW.rpc('nova_extra_simular_inicio', { p_competencia: RW.novaExtra.comp(), p_iniciado: v }).then(function () { passo = null; carregar(); });
    });
  }

  function mostrar(nome) { aba = nome; carregar(); }

  RW.novaExtraOrg = { montar: montar, mostrar: mostrar, recarregar: function () { if (aba) carregar(); }, sujo: function () { return passo === 3 && RW.novaExtraMontar && RW.novaExtraMontar.sujo(); } };
})();
