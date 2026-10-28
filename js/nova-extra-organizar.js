/* ============================================================
   NOVA EXTRA — Organizar o mês e o Calendário
   Lê o mês inteiro (nova_extra_mes) e desenha os passos: 1 Pedidos
   e termos (prazo e termo), 2 Cotas (nova-extra-cotas.js), 3
   Distribuição (nova-extra-montar.js), 4 Lançar (simulado) e 5
   Ajustes e relatório (nova-extra-relatorio.js); e a aba Calendário
   (o mês no calendário do site, as extras de cada unidade). A Legenda
   da barra explica a sugestão do passo aberto (2 e 3). O "Mês já
   começou" do grupo TESTE finge o início do mês.
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
  var p1 = null;          // edição do passo 1

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
    /* o que o militar marcou no pedido para o dia: 'quer', 'nao' (Não posso) ou 'sem' (sem preferência) */
    pref: function (m, k) { return (m.quer || []).indexOf(k) >= 0 ? 'quer' : (m.nao_posso || []).indexOf(k) >= 0 ? 'nao' : 'sem'; },
    /* a extra no bloco do dia, como a vaga da Extrajornada antiga: o ponto da preferência, posto e nome, o Tirar
       deste dia, o pelotão quando é de outro, o 24h e os 4 horários. Sem op.aoMarcar é só leitura (aba Calendário);
       op.travado (pedido aberto) só deixa desmarcar */
    vaga: function (a, uid, op) {
      op = op || {};
      var m = util.militar(a.cpf) || {}, blocos = a.blocos.map(Number);
      var v = RW.tpl('tpl-ne-vaga');
      v.querySelector('.extra-vaga-origem').classList.add({ quer: 'extra-dia-ponto--quer', nao: 'extra-dia-ponto--nao', sem: 'extra-dia-ponto--neutro' }[util.pref(m, a.data)]);
      v.querySelector('.extra-vaga-grad').textContent = m.grad || '';
      v.querySelector('.extra-vaga-nome').textContent = m.nome || a.cpf;
      if (m.unidade_id && m.unidade_id !== uid) {
        var pel = v.querySelector('.extra-vaga-pelotao');
        pel.textContent = (util.unidade(m.unidade_id) || {}).nome || '';
        pel.classList.remove('oculto');
      }
      v.querySelector('.extra-vaga-24h').classList.toggle('oculto', blocos.length !== 4);
      Array.prototype.forEach.call(v.querySelectorAll('.escala-extra-marca'), function (bt) {
        var b = +bt.getAttribute('data-bloco'), on = blocos.indexOf(b) >= 0;
        bt.classList.toggle('escala-extra-marca--on', on);
        bt.setAttribute('aria-pressed', on ? 'true' : 'false');
        bt.disabled = !op.aoMarcar || (op.travado && !on);
        bt.addEventListener('click', function (ev) { ev.stopPropagation(); if (op.aoMarcar) op.aoMarcar(b); });
      });
      var tirar = v.querySelector('.extra-vaga-tirar');
      tirar.classList.toggle('oculto', !op.aoTirar);
      tirar.addEventListener('click', function (ev) { ev.stopPropagation(); if (op.aoTirar) op.aoTirar(); });
      return v;
    },
    br: br
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
      p1 = null;
      if (RW.novaExtraCotas) RW.novaExtraCotas.reiniciar();
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
    /* cada unidade com as suas: o recebido é a soma das unidades */
    var uni = d.mes.cotas_unidades || {};
    var recebidas = d.mes.cotas_recebidas || Object.keys(uni).reduce(function (s, k) { return s + (+uni[k] || 0); }, 0);
    var textos = [
      msg().p1(br(d.mes.abre), br(d.mes.fecha), resp, d.militares.length),
      recebidas ? msg().p2(recebidas, totalConcedidas()) : msg().p2Depois,
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
    if (n !== 3 && RW.novaExtraMontar) RW.novaExtraMontar.fecharPainel();
    RW.novaExtra.legenda(n === 2 ? 'tpl-ne-legenda-cotas' : n === 3 ? 'tpl-ne-legenda-dist' : null);
    todos('[data-passo-painel]', function (p) { p.classList.toggle('oculto', +p.getAttribute('data-passo-painel') !== n); });
    passosTopo();
    if (n === 1) passo1();
    else if (n === 2 && RW.novaExtraCotas) RW.novaExtraCotas.mostrar(d, el, carregar, function (novo) { if (novo) d = novo; passosTopo(); });
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
      /* sem termo não tira extra: embaixo dele, as extras que saem ao salvar */
      var dias = p1.termos[m.cpf] === false ? diasDe(m.cpf) : [];
      if (dias.length) {
        var av = RW.tpl('tpl-ne-p1-aviso');
        av.querySelector('.nova-extra-aviso-linha').textContent = msg().retiraTermo(dias, d.iniciado && !!d.lancamento);
        tb.appendChild(av);
      }
    });
    q('#p1-vazio').classList.toggle('oculto', lista.length > 0);
    var n = Object.keys(p1.termos).length;
    q('#p1-mudancas').textContent = n ? msg().termosMudados(n) : '';
    q('#p1-salvar').disabled = !n;
  }

  /* os dias de extra de um militar na distribuição salva (DD/MM) */
  function diasDe(cpf) {
    return d.alocacoes.filter(function (a) { return a.cpf === cpf; }).map(function (a) { return a.data; }).sort().map(br);
  }

  /* depois de salvar: o resumo padrão (o que mudou e as extras que saíram) */
  function resumo(r) {
    if (r && r.log && r.log.resumo && r.log.resumo.alvos && r.log.resumo.alvos.length) RW.resumo.abrirModal(r.log, { pagina: 'Nova extra' });
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

  /* ---------- passo 5: as etapas do mês e a prévia (nova-extra-relatorio.js) ---------- */
  function passo5() { if (RW.novaExtraRelatorio) RW.novaExtraRelatorio.mostrar(d, el); }

  /* ---------- aba Calendário ---------- */
  /* as unidades com extra no mês, no bloco da Escala, cada uma na mesma altura em todos os dias (a vazia fica invisível) */
  function desenharCalendario() {
    q('#nova-extra-cal-aviso').classList.toggle('oculto', !!d.lancamento);
    var alocs = d.alocacoes;
    var unidades = d.unidades.filter(function (un) { return alocs.some(function (a) { return +a.unidade === un.id; }); });
    var comp = d.competencia;
    RW.geralCalendarioMes.renderizar(q('#nova-extra-cal-mes'), { dataRef: new Date(+comp.slice(0, 4), +comp.slice(5, 7) - 1, 1), unidadesPorDia: Math.max(1, unidades.length), aoDia: function (cel, data, noMes) {
      if (!noMes) return;
      var k = comp.slice(0, 8) + String(data.getDate()).padStart(2, '0');
      unidades.forEach(function (un) {
        var b = RW.tpl('tpl-escala-calendario-unidade');
        b.classList.add('nova-extra-cal-leitura');
        b.querySelector('.escala-calendario-unidade-nome').textContent = un.nome;
        var aqui = alocs.filter(function (a) { return a.data === k && +a.unidade === un.id; });
        b.classList.toggle('nova-extra-cal-uni--vazia', !aqui.length);
        aqui.forEach(function (a) { b.querySelector('.escala-mes-celula').appendChild(util.vaga(a, un.id)); });
        cel.appendChild(b);
      });
    } });
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
        resumo(r);
        carregar();
      });
    });
    q('#p4-lancar').addEventListener('click', lancar);
    q('#nova-extra-iniciado').addEventListener('click', function () {
      var v = q('#nova-extra-iniciado').getAttribute('aria-checked') !== 'true';
      RW.rpc('nova_extra_simular_inicio', { p_competencia: RW.novaExtra.comp(), p_iniciado: v }).then(function () { passo = null; carregar(); });
    });
  }

  /* fora do Organizar: fecha o painel e a caixa abertos e some a Legenda */
  function sair() {
    if (RW.novaExtraMontar) RW.novaExtraMontar.fecharPainel();
    RW.novaExtra.legenda(null);
  }

  function mostrar(nome) {
    if (nome !== 'organizar') sair();
    aba = nome; carregar();
  }

  RW.novaExtraOrg = { resumo: resumo, montar: montar, mostrar: mostrar, sair: function () { aba = null; sair(); }, recarregar: function () { if (aba) carregar(); }, sujo: function () { return passo === 3 && RW.novaExtraMontar && RW.novaExtraMontar.sujo(); } };
})();
