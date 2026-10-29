/* ============================================================
   NOVA EXTRA — os passos do mês e o Calendário
   Lê o mês inteiro (nova_extra_mes) e desenha a aba aberta: os passos
   1 Pedidos (prazo e termo), 2 Cotas (nova-extra-cotas.js), 3
   Distribuição (nova-extra-montar.js), 4 Lançar (simulado) e 5
   Ajustes (nova-extra-relatorio.js), ou o Calendário (o mês no
   calendário do site, as extras de cada unidade). Pinta o número de
   cada passo nas abas (verde feito, preto o primeiro ainda não feito,
   branco os que não começaram) e escreve a linha de resumo de cada
   passo. Mostra sempre todas as unidades da companhia (o seletor de
   unidades do topo não filtra esta página). A Legenda da barra
   explica a sugestão do passo aberto (2 e 3).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraOrg (e RosterWork.novaExtraUtil).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var INI = ['08h', '14h', '20h', '02h'], FIM = ['14h', '20h', '02h', '08h'];

  var el = null;          // a página
  var d = null;           // a resposta do nova_extra_mes
  var aba = null;         // 'passo', 'calendario' ou null (na Minha extra)
  var passo = null;       // o passo aberto (1 a 5)
  var vez = 1;            // o passo da vez (o primeiro ainda não feito)
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
    /* o que o militar marcou no pedido para o dia: 'quer', 'nao' (Não quero) ou 'sem' (sem preferência) */
    pref: function (m, k) { return (m.quer || []).indexOf(k) >= 0 ? 'quer' : (m.nao_posso || []).indexOf(k) >= 0 ? 'nao' : 'sem'; },
    /* a extra no bloco do dia, só para ler (marcar é no painel do dia e na lista): o posto e o nome e as 4 bolinhas
       pequenas dos horários, sem clique, na cor do que ele marcou no pedido; na dica, o nome inteiro e o horário
       escrito; embaixo, o pelotão quando é de outro */
    vaga: function (a, uid) {
      var m = util.militar(a.cpf) || {}, blocos = a.blocos.map(Number);
      var v = RW.tpl('tpl-ne-vaga');
      v.querySelector('.extra-vaga-grad').textContent = m.grad || '';
      v.querySelector('.extra-vaga-nome').textContent = m.nome || a.cpf;
      var horas = blocos.length === 4 ? msg().horasN(24) : blocos.length ? util.horas(blocos) : '';
      /* sem nenhum horário: em cinza até o Salvar (marcar uma bolinha traz de volta) */
      v.classList.toggle('nova-extra-vaga--sai', !blocos.length);
      v.setAttribute('data-dica', ((m.grad || '') + ' ' + (m.nome || a.cpf)).trim() + (horas ? ', ' + horas : ' · ' + msg().saiAoSalvar));
      v.setAttribute('data-busca', RW.busca ? RW.busca.chave(m) : '');
      var outro = !!m.unidade_id && m.unidade_id !== uid;
      if (outro) {
        var pel = v.querySelector('.extra-vaga-pelotao');
        pel.textContent = (util.unidade(m.unidade_id) || {}).nome || '';
        pel.classList.remove('oculto');
      }
      /* a cor das marcadas é a do que ele marcou no pedido para o dia: verde quer, vermelho não quer, neutra sem preferência */
      var bol = v.querySelector('.nova-extra-vaga-bol'), pref = util.pref(m, a.data);
      bol.classList.toggle('nova-extra-vaga-bol--quer', pref === 'quer');
      bol.classList.toggle('nova-extra-vaga-bol--nao', pref === 'nao');
      Array.prototype.forEach.call(bol.children, function (b, i) {
        b.classList.toggle('nova-extra-vaga-bol--on', blocos.indexOf(i + 1) >= 0);
      });
      v.querySelector('.nova-extra-vaga-baixo').classList.toggle('oculto', !outro);
      return v;
    },
    /* as unidades da página: todas as da companhia (o seletor de unidades do topo não filtra a Nova extra) */
    escolhidas: function () { return d ? d.unidades.map(function (un) { return un.id; }) : []; },
    /* as unidades do calendário: todas; a companhia só quando tem extra (a falta é só dos pelotões) */
    doCalendario: function (alocs) {
      var sel = util.escolhidas();
      return d.unidades.filter(function (un) {
        return sel.indexOf(un.id) >= 0 && (un.pelotao !== false || alocs.some(function (a) { return +a.unidade === un.id; }));
      });
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
      /* na Minha extra a leitura é só para as marcas das abas: a falha fica quieta */
      if (!r || !r.ok) { if (aba) RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      d = r;
      p1 = null;
      if (RW.novaExtraCotas) RW.novaExtraCotas.reiniciar();
      desenharAba();
    }, function () { if (meu === pedido && aba) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* a aba aberta (na Minha extra, só os números dos passos); no Organizar o mês sem passo escolhido, abre o da vez */
  function desenharAba() {
    passosTopo();
    if (aba === 'calendario') desenharCalendario();
    else if (aba === 'passo') {
      if (!passo) passo = vez;
      RW.novaExtra.passo(passo);
      abrirPasso(passo);
    }
  }

  function vols() { return d.militares.filter(function (m) { return m.voluntario; }); }
  function totalConcedidas() { return vols().reduce(function (s, m) { return s + (m.concedidas || 0); }, 0); }
  function naGrade() { return d.alocacoes.reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  /* os militares da companhia */
  function daqui() { var sel = util.escolhidas(); return d.militares.filter(function (m) { return sel.indexOf(m.unidade_id) >= 0; }); }

  /* o que mudou na distribuição desde o lançamento (as chaves cpf|dia) */
  function mudancasDesdeLancamento() {
    var lanc = d.lancamento, antes = {}, agora = {};
    if (!lanc) return [];
    lanc.foto.forEach(function (a) { antes[chave(a)] = a; });
    d.alocacoes.forEach(function (a) { agora[chave(a)] = a; });
    return Object.keys(Object.assign({}, antes, agora)).filter(function (k) {
      return JSON.stringify(antes[k] && [antes[k].unidade, antes[k].blocos]) !== JSON.stringify(agora[k] && [agora[k].unidade, agora[k].blocos]);
    });
  }

  /* os números dos passos na barra (e o passo da vez: o primeiro ainda não feito) e a linha de resumo do alto de cada
     passo. Um passo só fica feito depois do
     anterior: o pedido fechou; as cotas foram todas entregues (ou sobraram porque todos já receberam o que pediram);
     as entregues estão todas na distribuição; foi lançado e nada mudou depois. Os Ajustes seguem enquanto o mês corre */
  function passosTopo() {
    var comTermo = vols().filter(function (m) { return m.termo; });
    var recebido = d.mes.cotas_recebidas || 0, entregues = totalConcedidas();
    var cotasOk = entregues > 0 && (entregues >= recebido || comTermo.every(function (m) { return (m.concedidas || 0) >= (m.cotas || 0); }));
    var ok = [d.mes.estado === 'encerrado', cotasOk, entregues > 0 && naGrade() >= entregues, !!d.lancamento && !mudancasDesdeLancamento().length, false];
    var feito = [], agora = -1;
    ok.forEach(function (x, i) { feito[i] = x && (i === 0 || feito[i - 1]); if (!feito[i] && agora < 0) agora = i; });
    vez = agora + 1;
    todos('#nova-extra-passos [data-passo]', function (b) {
      var i = +b.getAttribute('data-passo') - 1, num = b.querySelector('.nova-extra-aba-num');
      num.classList.toggle('nova-extra-aba-num--feito', feito[i]);
      num.classList.toggle('nova-extra-aba-num--agora', i === agora);
    });
    var lista = daqui();
    var resp = lista.filter(function (m) { return m.respondeu; }).length;
    var textos = {
      1: msg().p1(br(d.mes.abre), br(d.mes.fecha), resp, lista.length),
      4: d.lancamento ? msg().p4Lancado(d.lancamento.lancado_em) : msg().p4Nao,
      5: d.iniciado ? msg().p5(d.ajustes.length) : msg().p5Depois
    };
    todos('[data-passo-resumo]', function (r) { r.textContent = textos[r.getAttribute('data-passo-resumo')]; });
  }

  function abrirPasso(n) {
    passo = n;
    if (n !== 3 && RW.novaExtraMontar) RW.novaExtraMontar.fecharPainel();
    RW.novaExtra.legenda(n === 2 ? 'tpl-ne-legenda-cotas' : n === 3 ? 'tpl-ne-legenda-dist' : null);
    if (n === 1) passo1();
    else if (n === 2 && RW.novaExtraCotas) RW.novaExtraCotas.mostrar(d, el, carregar, function (novo) { if (novo) d = novo; passosTopo(); });
    else if (n === 3 && RW.novaExtraMontar) RW.novaExtraMontar.mostrar(d, el, carregar);
    else if (n === 4) passo4();
    else passo5();
  }

  /* ---------- passo 1: prazo, respostas e termos ---------- */
  function passo1() {
    if (!p1) p1 = { lista: 'vol', termos: {} };
    q('#p1-abre').value = RW.data.isoParaBR(d.mes.abre); q('#p1-fecha').value = RW.data.isoParaBR(d.mes.fecha); q('#p1-aviso').value = d.mes.aviso_dias;
    /* as unidades da companhia */
    var todosDaqui = daqui();
    var resp = todosDaqui.filter(function (m) { return m.respondeu; });
    var nVol = todosDaqui.filter(function (m) { return m.voluntario; }).length;
    q('#p1-respostas').textContent = msg().responderam(resp.length, todosDaqui.length);
    q('#p1-n-vol').textContent = nVol;
    q('#p1-n-nao').textContent = resp.length - nVol;
    q('#p1-n-sem').textContent = todosDaqui.length - resp.length;
    todos('#p1-filtro [data-lista]', function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-lista') === p1.lista); });
    var lista = todosDaqui.filter(function (m) {
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
    /* o rodapé de salvar aparece só com alteração */
    q('#p1-rodape').classList.toggle('oculto', !n);
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
      var mudas = mudancasDesdeLancamento();
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
  /* as unidades que têm extra no mês, no bloco da Escala, cada uma na mesma altura em todos os dias
     (a vazia fica invisível); sem nenhuma, o vazio no lugar */
  function desenharCalendario() {
    q('#nova-extra-cal-aviso').classList.toggle('oculto', !!d.lancamento);
    var alocs = d.alocacoes;
    var unidades = util.doCalendario(alocs).filter(function (un) { return alocs.some(function (a) { return +a.unidade === un.id; }); });
    q('#nova-extra-cal-vazio').classList.toggle('oculto', unidades.length > 0);
    q('#nova-extra-cal-mes').classList.toggle('oculto', !unidades.length);
    if (!unidades.length) return;
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
    d = null; passo = null; aba = null;
    todos('#p1-filtro [data-lista]', function (b) { b.addEventListener('click', function () { p1.lista = b.getAttribute('data-lista'); passo1(); }); });
    /* o prazo nos campos de data do site (DD/MM/AAAA, com o calendário do site) */
    RW.campos.ligarData(q('#p1-abre'));
    RW.campos.ligarData(q('#p1-fecha'));
    q('#p1-salvar-prazo').addEventListener('click', function () {
      RW.rpc('nova_extra_prazo_salvar', { p_competencia: d.competencia, p_abre: RW.data.paraISO(q('#p1-abre').value), p_fecha: RW.data.paraISO(q('#p1-fecha').value), p_aviso: +q('#p1-aviso').value }).then(function (r) {
        if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
        RW.novaExtra.recarregar();
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
  }

  /* fora do passo: fecha o painel e a caixa abertos e some a Legenda */
  function sair() {
    if (RW.novaExtraMontar) RW.novaExtraMontar.fecharPainel();
    RW.novaExtra.legenda(null);
  }

  /* abre o Calendário ('calendario'), um passo (1 a 5) ou o Organizar o mês (null: o passo escolhido antes ou, na
     primeira vez, o da vez); o mês já lido não é lido de novo (os rascunhos ficam) */
  function mostrar(nome) {
    sair();
    aba = nome === 'calendario' ? 'calendario' : 'passo';
    if (typeof nome === 'number') passo = nome;
    if (!d || d.competencia !== RW.novaExtra.comp()) carregar();
    else desenharAba();
  }

  RW.novaExtraOrg = {
    resumo: resumo, montar: montar, mostrar: mostrar,
    sair: function () { aba = null; sair(); },
    recarregar: carregar,
    desenharAba: function () { if (d) desenharAba(); },
    sujo: function () { return aba === 'passo' && passo === 3 && RW.novaExtraMontar && RW.novaExtraMontar.sujo(); }
  };
})();
