/* ============================================================
   NOVA EXTRA — os passos do mês e a aba Extras do mês
   Lê o mês inteiro (nova_extra_mes) e desenha a aba aberta: os passos
   1 Pedidos (prazo e termo), 2 Cotas (nova-extra-cotas.js), 3
   Distribuição e 4 Ajustes (a mesma tela, nova-extra-montar.js) e 5
   Relatórios (nova-extra-relatorio.js), ou a aba Extras do mês (as
   extras de cada unidade na Agenda ou no Calendário). O menu Ações da
   barra fica no nova-extra-acoes.js. Pinta o número de
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
  var passoAberto = null; // o passo desenhado por último (ao trocar de passo, o painel direito fecha)
  var vez = 1;            // o passo da vez (o primeiro ainda não feito)
  var pedido = 0;         // latest-wins
  var lendo = null;       // o mês com a leitura no ar (AAAA-MM-01)
  var falhou = false;     // a última leitura falhou (abrir a aba de novo tenta outra vez)
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
      v.insertBefore(util.origem(a), bol);
      return v;
    },
    /* quem pôs a extra: o ícone do sistema (o Preencher refaz) ou o cadeado (o administrador pôs ou mudou; o sistema nunca
       muda) */
    origem: function (a) {
      var i = RW.tpl('tpl-ne-origem');
      i.querySelector('use').setAttribute('href', 'icones/todos.svg#' + (a.origem === 'sugestao' ? 'icone-origem-sistema' : 'icone-cadeado'));
      return i;
    },
    /* as unidades da página: todas as da companhia (o seletor de unidades do topo não filtra a Nova extra) */
    escolhidas: function () { return d ? d.unidades.map(function (un) { return un.id; }) : []; },
    /* uma leitura do banco (RPC): devolve o JSON ou, se o banco recusar, null, com a mensagem técnica (o código, o texto
       e o lugar do erro) anotada no console para achar a causa */
    chamar: function (nome, corpo) {
      return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} }).then(function (resp) {
        if (resp.ok) return resp.json();
        return resp.text().then(function (texto) {
          console.error('[Nova extra] ' + nome + ' falhou (' + resp.status + '): ' + texto);
          return null;
        });
      });
    },
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
  /* lê o mês e desenha a aba aberta. Com outro mês na tela (ou depois de uma falha), a área do Calendário e do Organizar
     o mês mostra o círculo até ele chegar e a frase se falhar (RosterWork.novaExtra.leitura; na Minha extra, nada
     aparece); a releitura do mesmo mês deixa a tela à vista */
  function carregar() {
    var meu = ++pedido;
    var comp = RW.novaExtra.comp();
    var naDistribuicao = function () { return aba === 'passo' && (passo === 3 || passo === 4); };
    lendo = comp;
    if (!d || d.competencia !== comp || falhou) RW.novaExtra.leitura('mes', 'lendo');
    /* na Distribuição e nos Ajustes, a escala do mês começa a ser lida junto com o mês (as mesmas unidades) */
    if (d && naDistribuicao() && RW.escalasDados && RW.escalasDados.antecipar) {
      var fim = new Date(+comp.slice(0, 4), +comp.slice(5, 7), 0);
      RW.escalasDados.antecipar(d.unidades.map(function (x) { return x.id; }), comp,
        fim.getFullYear() + '-' + String(fim.getMonth() + 1).padStart(2, '0') + '-' + String(fim.getDate()).padStart(2, '0'));
    }
    /* a falha fica no lugar da área (a frase), com a mensagem técnica no console */
    function falha(texto, tecnico) {
      if (meu !== pedido || !el.isConnected) return;
      lendo = null;
      falhou = true;
      if (tecnico) console.error('[Nova extra] nova_extra_mes falhou: ' + tecnico);
      RW.novaExtra.leitura('mes', 'falha', texto || msg().falhaMes);
    }
    return util.chamar('nova_extra_mes', { p_competencia: comp }).then(function (r) {
      if (meu !== pedido || !el.isConnected) return;
      if (!r || !r.ok) { falha(r && r.error); return; }
      lendo = null;
      falhou = false;
      d = r;
      p1 = null;
      if (RW.novaExtraCotas) RW.novaExtraCotas.reiniciar();
      RW.novaExtra.leitura('mes', 'ok');
      desenharAba();
    }, function (e) { falha(null, (e && e.message) || 'sem conexão'); });
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
     passo. Um passo só fica feito depois do anterior: o pedido fechou; as cotas foram todas entregues (ou sobraram
     porque todos já receberam o que pediram); a distribuição foi lançada (e não reaberta); o mês terminou (os Ajustes seguem do
     lançamento ao fim do mês). Os Relatórios nunca ficam feitos */
  function passosTopo() {
    var comTermo = vols().filter(function (m) { return m.termo; });
    var recebido = d.mes.cotas_recebidas || 0, entregues = totalConcedidas();
    var cotasOk = entregues > 0 && (entregues >= recebido || comTermo.every(function (m) { return (m.concedidas || 0) >= (m.cotas || 0); }));
    var c = d.competencia, proximo = new Date(+c.slice(0, 4), +c.slice(5, 7), 1);
    var terminou = d.hoje >= proximo.getFullYear() + '-' + String(proximo.getMonth() + 1).padStart(2, '0') + '-01';
    var ok = [d.mes.estado === 'encerrado', cotasOk, !!d.lancamento && !d.lancamento.reaberto, terminou, false];
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
      5: d.lancamento ? msg().p5(d.ajustes.length) : msg().p4Nao
    };
    todos('[data-passo-resumo]', function (r) { r.textContent = textos[r.getAttribute('data-passo-resumo')]; });
  }

  function abrirPasso(n) {
    passo = n;
    /* ao trocar de passo, o painel direito aberto (o do dia ou o do lançamento) fecha */
    if (n !== passoAberto && RW.painel.estaAberto()) RW.painel.fechar();
    passoAberto = n;
    var calendario = n === 3 || n === 4;
    /* a Legenda de cada etapa (as regras), menos nos Relatórios */
    RW.novaExtra.legenda({ 1: 'tpl-ne-legenda-pedidos', 2: 'tpl-ne-legenda-cotas', 3: 'tpl-ne-legenda-dist', 4: 'tpl-ne-legenda-ajustes' }[n] || null);
    if (n === 1) passo1();
    else if (n === 2 && RW.novaExtraCotas) RW.novaExtraCotas.mostrar(d, el, carregar, function (novo) { if (novo) d = novo; passosTopo(); });
    else if (calendario && RW.novaExtraMontar) RW.novaExtraMontar.mostrar(d, el, carregar, n === 4 ? 'ajustes' : 'distribuicao');
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
    /* fechados pelo Ações › Fechar os pedidos agora: quando e quem */
    q('#p1-fechados').classList.toggle('oculto', !d.mes.fechado_em);
    q('#p1-fechados .nota-texto').textContent = d.mes.fechado_em ? msg().fechadosEm(d.mes.fechado_em, d.mes.fechado_por || '') : '';
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

  function chave(a) { return a.cpf + '|' + a.data; }

  /* ---------- passo 5: as etapas do mês e a prévia (nova-extra-relatorio.js) ---------- */
  function passo5() { if (RW.novaExtraRelatorio) RW.novaExtraRelatorio.mostrar(d, el); }

  /* ---------- aba Extras do mês ---------- */
  /* as unidades que têm extra no mês: na Agenda, uma coluna por unidade; no Calendário, o bloco da Escala, cada uma na
     mesma altura em todos os dias (a vazia fica invisível); sem nenhuma, o vazio no lugar. Só para ler */
  function desenharCalendario() {
    q('#nova-extra-cal-aviso').classList.toggle('oculto', !!d.lancamento);
    var alocs = d.alocacoes;
    var unidades = util.doCalendario(alocs).filter(function (un) { return alocs.some(function (a) { return +a.unidade === un.id; }); });
    q('#nova-extra-cal-vazio').classList.toggle('oculto', unidades.length > 0);
    q('#nova-extra-cal-mes').classList.toggle('oculto', !unidades.length);
    RW.novaExtra.grade.unidades(unidades.length ? unidades : null);
    if (!unidades.length) return;
    var comp = d.competencia;
    if (RW.novaExtra.modo() === 'agenda') {
      var wrap = RW.novaExtraPorDia.agenda(q('#nova-extra-cal-mes'), comp, unidades, function (un, k) {
        var cel = RW.novaExtraPorDia.celulaVazia(un, k);
        cel.classList.add('nova-extra-cal-leitura');
        alocs.filter(function (a) { return a.data === k && +a.unidade === un.id; }).forEach(function (a) { cel.appendChild(util.vaga(a, un.id)); });
        return cel;
      });
      RW.novaExtra.grade.aplicar(wrap);
      return;
    }
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
    d = null; passo = null; passoAberto = null; aba = null; lendo = null; falhou = false;
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
    RW.novaExtraAcoes.ligar(el);
  }

  /* fora do passo: fecha o painel e a caixa abertos e some a Legenda */
  function sair() {
    if (RW.novaExtraMontar) RW.novaExtraMontar.fecharPainel();
    RW.novaExtra.legenda(null);
  }

  /* abre a aba Extras do mês ('calendario'), um passo (1 a 5) ou o Organizar o mês (null: o passo escolhido antes ou, na
     primeira vez, o da vez); o mês já lido não é lido de novo (os rascunhos ficam), e o que já está sendo lido só
     espera, com o círculo */
  function mostrar(nome) {
    sair();
    aba = nome === 'calendario' ? 'calendario' : 'passo';
    if (typeof nome === 'number') passo = nome;
    var comp = RW.novaExtra.comp();
    if (d && d.competencia === comp && !falhou) desenharAba();
    else if (lendo !== comp) carregar();
  }

  RW.novaExtraOrg = {
    resumo: resumo, montar: montar, mostrar: mostrar,
    /* o que o menu Ações (nova-extra-acoes.js) lê do mês */
    dados: function () { return d; },
    vols: vols, totalConcedidas: totalConcedidas, naGrade: naGrade, mudancasDesdeLancamento: mudancasDesdeLancamento,
    sair: function () { aba = null; sair(); },
    recarregar: carregar,
    desenharAba: function () { if (d) desenharAba(); },
    sujo: function () { return aba === 'passo' && (passo === 3 || passo === 4) && RW.novaExtraMontar && RW.novaExtraMontar.sujo(); }
  };
})();
