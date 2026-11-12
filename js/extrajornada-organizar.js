/* ============================================================
   EXTRAJORNADA — os passos do mês e a aba Extras do mês
   Lê o mês inteiro (extrajornada_mes) e desenha a aba aberta: os passos
   1 Pedidos (termo; o prazo e o mínimo no extrajornada-minimo.js), 2 Cotas (extrajornada-cotas.js), 3
   Distribuição e 4 Ajustes (a mesma tela, extrajornada-montar.js) e 5
   Relatórios (extrajornada-relatorio.js), ou a aba Extras do mês (as
   extras de cada unidade na Agenda ou no Calendário). O menu Ações da
   barra fica no extrajornada-acoes.js. Pinta o número de
   cada passo nas abas (verde feito, preto o primeiro ainda não feito,
   branco os que não começaram) e escreve a linha de resumo de cada
   passo. Mostra sempre todas as unidades da companhia (o seletor de
   unidades do topo não filtra esta página). A Legenda da barra
   explica a sugestão do passo aberto (2 e 3).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaOrg.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = null;          // a página
  var d = null;           // a resposta do extrajornada_mes
  var aba = null;         // 'passo', 'calendario' ou null (na Minha extra)
  var passo = null;       // o passo aberto (1 a 5)
  var passoAberto = null; // o passo desenhado por último (ao trocar de passo, o painel direito fecha)
  var vez = 1;            // o passo da vez (o primeiro ainda não feito)
  var pedido = 0;         // latest-wins
  var lendo = null;       // o mês com a leitura no ar (AAAA-MM-01)
  var falhou = false;     // a última leitura falhou (abrir a aba de novo tenta outra vez)
  var p1 = null;          // edição do passo 1
  var guardaLigada = false;

  function msg() { return RW.mensagens.extrajornada.org; }
  function br(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }
  function todos(sel, f) { Array.prototype.forEach.call(el.querySelectorAll(sel), f); }
  function q(sel) { return el.querySelector(sel); }

  var util = RW.extrajornadaUtil;

  /* ---------- carregar ---------- */
  /* lê o mês e desenha a aba aberta. Com outro mês na tela (ou depois de uma falha), a área do Calendário e do Organizar
     o mês mostra o círculo até ele chegar e a frase se falhar (RosterWork.extrajornada.leitura; na Minha extra, nada
     aparece); a releitura do mesmo mês deixa a tela à vista */
  function carregar() {
    var meu = ++pedido;
    var comp = RW.extrajornada.comp();
    lendo = comp;
    if (!d || d.competencia !== comp || falhou) RW.extrajornada.leitura('mes', 'lendo');
    /* a falha fica no lugar da área (a frase), com a mensagem técnica no console */
    function falha(texto, tecnico) {
      if (meu !== pedido || !el.isConnected) return;
      lendo = null;
      falhou = true;
      if (tecnico) console.error('[Extrajornada] extrajornada_mes falhou: ' + tecnico);
      RW.extrajornada.leitura('mes', 'falha', texto || msg().falhaMes);
    }
    return util.chamar('extrajornada_mes', { p_competencia: comp }).then(function (r) {
      if (meu !== pedido || !el.isConnected) return;
      if (!r || !r.ok) { falha(r && r.error); return; }
      lendo = null;
      falhou = false;
      d = r;
      util.usar(d);
      p1 = null;
      if (RW.extrajornadaCotas) RW.extrajornadaCotas.reiniciar();
      RW.extrajornada.leitura('mes', 'ok');
      desenharAba();
    }, function (e) { falha(null, (e && e.message) || 'sem conexão'); });
  }

  /* a aba aberta (na Minha extra, só os números dos passos); no Organizar o mês sem passo escolhido, abre o da vez.
     Quem não administra a companhia não tem os passos (o mês dele vem só com as extras que estão na escala) */
  function desenharAba() {
    if (d.admin !== false) passosTopo();
    if (aba === 'calendario') desenharCalendario();
    else if (aba === 'passo') {
      /* o Abrir na Extrajornada da Escala: os Ajustes */
      if (RW.extrajornada.diaPedido()) passo = 4;
      else if (!passo) passo = vez;
      RW.extrajornada.passo(passo);
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
    todos('#extrajornada-passos [data-passo]', function (b) {
      var i = +b.getAttribute('data-passo') - 1, num = b.querySelector('.extrajornada-aba-num');
      num.classList.toggle('extrajornada-aba-num--feito', feito[i]);
      num.classList.toggle('extrajornada-aba-num--agora', i === agora);
    });
    var lista = daqui();
    var resp = lista.filter(function (m) { return m.respondeu; }).length;
    var vol = lista.filter(function (m) { return m.voluntario; }).length;
    var textos = {
      1: msg().p1(br(d.mes.abre), br(d.mes.fecha), resp, lista.length, vol, resp - vol, lista.length - resp),
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
    RW.extrajornada.legenda({ 1: 'tpl-extrajornada-legenda-pedidos', 2: 'tpl-extrajornada-legenda-cotas', 3: 'tpl-extrajornada-legenda-dist', 4: 'tpl-extrajornada-legenda-ajustes' }[n] || null);
    if (n === 1) passo1();
    else if (n === 2 && RW.extrajornadaCotas) RW.extrajornadaCotas.mostrar(d, el, carregar, function (novo) { if (novo) { d = novo; util.usar(d); } passosTopo(); });
    else if (calendario && RW.extrajornadaMontar) RW.extrajornadaMontar.mostrar(d, el, carregar, n === 4 ? 'ajustes' : 'distribuicao');
    else passo5();
  }

  /* os períodos do mês em que o militar não pode tirar extra: os dias que vêm travados no pedido (serviço e troca ele pode
     marcar), juntos quando são seguidos e do mesmo motivo */
  function periodosNaoPode(m) {
    var ocupado = m.ocupado || {}, mes = d.competencia.slice(0, 8), periodos = [];
    Object.keys(ocupado).sort().forEach(function (k) {
      if (k.slice(0, 8) !== mes || ['ferias', 'licenca', 'dispensa'].indexOf(ocupado[k]) < 0) return;
      var dia = +k.slice(8, 10), ultimo = periodos[periodos.length - 1];
      if (ultimo && ultimo.fim === dia - 1 && ultimo.motivo === ocupado[k]) ultimo.fim = dia;
      else periodos.push({ inicio: dia, fim: dia, motivo: ocupado[k] });
    });
    return periodos;
  }

  /* ---------- passo 1: prazo, mínimo e termos ---------- */
  function passo1() {
    if (!p1) { p1 = { lista: 'vol', termos: {} }; RW.extrajornadaMinimo.iniciar(d); }
    /* as unidades da companhia */
    var todosDaqui = daqui();
    /* fechados pelo Ações › Fechar os pedidos agora: quando e quem */
    q('#p1-fechados').classList.toggle('oculto', !d.mes.fechado_em);
    q('#p1-fechados .nota-texto').textContent = d.mes.fechado_em ? msg().fechadosEm(d.mes.fechado_em, d.mes.fechado_por || '') : '';
    todos('#p1-filtro [data-lista]', function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-lista') === p1.lista); });
    var lista = todosDaqui.filter(function (m) {
      return p1.lista === 'vol' ? m.voluntario : p1.lista === 'nao' ? m.respondeu && !m.voluntario : !m.respondeu;
    });
    var tb = q('#p1-lista');
    tb.textContent = '';
    lista.forEach(function (m) {
      var tr = RW.tpl('tpl-extrajornada-p1-linha');
      tr.querySelector('small').textContent = m.grad;
      tr.querySelector('b').textContent = m.nome;
      tr.querySelector('.extrajornada-p1-unidade').textContent = (util.unidade(m.unidade_id) || {}).nome || '';
      tr.querySelector('.extrajornada-p1-cotas').textContent = m.voluntario ? msg().cotas(m.cotas, m.so24) : '';
      tr.querySelector('.extrajornada-p1-quer').textContent = m.voluntario ? msg().diasDoMes(m.quer) : '';
      tr.querySelector('.extrajornada-p1-nao-quer').textContent = m.voluntario ? msg().diasDoMes(m.nao_posso) : '';
      var naoPode = tr.querySelector('.extrajornada-p1-nao-pode');
      if (m.sem_dia_livre) naoPode.textContent = msg().semDiaLivre;
      else if (m.voluntario) periodosNaoPode(m).forEach(function (p) {
        var item = RW.tpl('tpl-extrajornada-nao-pode-periodo'), periodo = item.querySelector('.extrajornada-nao-pode-dia');
        periodo.textContent = msg().periodoDoMes(p.inicio, p.fim);
        periodo.setAttribute('data-dica', RW.mensagens.extrajornada.motivos[p.motivo]);
        naoPode.appendChild(item);
      });
      var t = tr.querySelector('.extrajornada-p1-termo');
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
        var av = RW.tpl('tpl-extrajornada-p1-aviso');
        av.querySelector('.extrajornada-aviso-linha').textContent = msg().retiraTermo(dias, d.iniciado && !!d.lancamento);
        tb.appendChild(av);
      }
    });
    q('#p1-vazio').classList.toggle('oculto', lista.length > 0);
    RW.extrajornadaMinimo.desenhar();
    rodapeP1();
  }

  /* há alteração não salva nos Pedidos: no prazo, no mínimo ou nos termos */
  function pedidosSujo() {
    return !!p1 && (Object.keys(p1.termos).length > 0 || RW.extrajornadaMinimo.prazoMudou() || RW.extrajornadaMinimo.regraMudou());
  }

  /* o rodapé de salvar aparece só com alteração; com algo pela metade, o Salvar fica desligado */
  function rodapeP1() {
    var sujo = pedidosSujo();
    q('#p1-rodape').classList.toggle('oculto', !sujo);
    q('#p1-mudancas').textContent = sujo ? msg().pedidosMudados(RW.extrajornadaMinimo.prazoMudou(), RW.extrajornadaMinimo.regraMudou(), Object.keys(p1.termos).length) : '';
    q('#p1-salvar').disabled = !sujo || RW.extrajornadaMinimo.incompleto();
  }

  function salvarP1() {
    var botao = q('#p1-salvar');
    RW.iniciarCarregando(botao);
    RW.rpc('extrajornada_pedidos_salvar', Object.assign({ p_competencia: d.competencia, p_termos: p1.termos }, RW.extrajornadaMinimo.parametros())).then(function (r) {
      RW.pararCarregando(botao);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      resumo(r);
      RW.extrajornada.recarregar();
    }, function (e) {
      RW.pararCarregando(botao);
      RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao });
    });
  }

  /* os dias de extra de um militar na distribuição salva (DD/MM) */
  function diasDe(cpf) {
    return d.alocacoes.filter(function (a) { return a.cpf === cpf; }).map(function (a) { return a.data; }).sort().map(br);
  }

  /* depois de salvar: o resumo padrão (o que mudou e as extras que saíram) */
  function resumo(r) {
    if (r && r.log && r.log.resumo && r.log.resumo.alvos && r.log.resumo.alvos.length) RW.resumo.abrirModal(r.log, { pagina: 'Extrajornada' });
  }

  function chave(a) { return a.cpf + '|' + a.data; }

  /* ---------- passo 5: as etapas do mês e a prévia (extrajornada-relatorio.js) ---------- */
  function passo5() { if (RW.extrajornadaRelatorio) RW.extrajornadaRelatorio.mostrar(d, el); }

  /* ---------- aba Extras do mês ---------- */
  /* as unidades que têm extra no mês: na Agenda, uma coluna por unidade; no Calendário, o bloco da Escala, cada uma na
     mesma altura em todos os dias (a vazia fica invisível); sem nenhuma, o vazio no lugar. Só para ler */
  function desenharCalendario() {
    q('#extrajornada-cal-aviso').classList.toggle('oculto', !!d.lancamento);
    var alocs = d.alocacoes;
    var unidades = util.doCalendario(alocs).filter(function (un) { return alocs.some(function (a) { return +a.unidade === un.id; }); });
    q('#extrajornada-cal-vazio').classList.toggle('oculto', unidades.length > 0);
    q('#extrajornada-cal-mes').classList.toggle('oculto', !unidades.length);
    RW.extrajornada.grade.unidades(unidades.length ? unidades : null);
    if (!unidades.length) return;
    var comp = d.competencia;
    if (RW.extrajornada.modo() === 'agenda') {
      var wrap = RW.extrajornadaPorDia.agenda(q('#extrajornada-cal-mes'), comp, unidades, function (un, k) {
        var cel = RW.extrajornadaPorDia.celulaVazia(un, k);
        cel.classList.add('extrajornada-cal-leitura');
        alocs.filter(function (a) { return a.data === k && +a.unidade === un.id; }).forEach(function (a) { cel.appendChild(util.vaga(a, un.id)); });
        return cel;
      });
      RW.extrajornada.grade.aplicar(wrap);
      return;
    }
    /* os pelotões lado a lado ou um embaixo do outro: a escolha da pessoa, a mesma da Escala (geral-visao-grade.js) */
    var ladoALado = !!(RW.visaoGrade && RW.visaoGrade.disposicao() === 'lado');
    RW.geralCalendarioMes.renderizar(q('#extrajornada-cal-mes'), { dataRef: new Date(+comp.slice(0, 4), +comp.slice(5, 7) - 1, 1), unidadesPorDia: Math.max(1, unidades.length), ladoALado: ladoALado, aoDia: function (cel, data, noMes) {
      if (!noMes) return;
      var k = comp.slice(0, 8) + String(data.getDate()).padStart(2, '0');
      unidades.forEach(function (un) {
        var b = RW.tpl('tpl-escala-calendario-unidade');
        b.classList.add('extrajornada-cal-leitura');
        b.querySelector('.escala-calendario-unidade-nome').textContent = un.nome;
        var aqui = alocs.filter(function (a) { return a.data === k && +a.unidade === un.id; });
        b.classList.toggle('extrajornada-cal-uni--vazia', !aqui.length);
        aqui.forEach(function (a) { b.querySelector('.escala-mes-celula').appendChild(util.vaga(a, un.id, true)); });
        cel.appendChild(b);
      });
    } });
  }

  /* ---------- entrada ---------- */
  function montar(conteudo) {
    el = conteudo;
    d = null; util.usar(null); p1 = null; passo = null; passoAberto = null; aba = null; lendo = null; falhou = false;
    todos('#p1-filtro [data-lista]', function (b) { b.addEventListener('click', function () { p1.lista = b.getAttribute('data-lista'); passo1(); }); });
    RW.extrajornadaMinimo.ligar(el, passo1, rodapeP1);
    q('#p1-cancelar').addEventListener('click', function () { p1.termos = {}; RW.extrajornadaMinimo.iniciar(d); passo1(); });
    q('#p1-salvar').addEventListener('click', salvarP1);
    /* com alteração não salva nos Pedidos, o navegador avisa ao fechar ou recarregar */
    if (RW.guardaSaida && !guardaLigada) {
      guardaLigada = true;
      RW.guardaSaida.registrar(function () { return !!el && !!q('#p1-abre') && pedidosSujo(); });
    }
    RW.extrajornadaAcoes.ligar(el);
  }

  /* fora do passo: fecha o painel e a caixa abertos e some a Legenda */
  function sair() {
    if (RW.extrajornadaMontar) RW.extrajornadaMontar.fecharPainel();
    RW.extrajornada.legenda(null);
  }

  /* abre a aba Extras do mês ('calendario'), um passo (1 a 5) ou o Organizar o mês (null: o passo escolhido antes ou, na
     primeira vez, o da vez); o mês já lido não é lido de novo (os rascunhos ficam), e o que já está sendo lido só
     espera, com o círculo */
  function mostrar(nome) {
    sair();
    aba = nome === 'calendario' ? 'calendario' : 'passo';
    if (typeof nome === 'number') passo = nome;
    /* veio da nota das cotas ou da linha da Pendências: os Ajustes, mesmo depois do fim do mês */
    else if (nome === null && RW.cotasAviso && RW.cotasAviso.pediuAjustes()) passo = 4;
    var comp = RW.extrajornada.comp();
    if (d && d.competencia === comp && !falhou) desenharAba();
    else if (lendo !== comp) carregar();
  }

  RW.extrajornadaOrg = {
    resumo: resumo, montar: montar, mostrar: mostrar,
    /* o que o menu Ações (extrajornada-acoes.js) lê do mês */
    dados: function () { return d; },
    vols: vols, totalConcedidas: totalConcedidas, naGrade: naGrade, mudancasDesdeLancamento: mudancasDesdeLancamento,
    sair: function () { aba = null; sair(); },
    recarregar: carregar,
    desenharAba: function () { if (d) desenharAba(); },
    sujo: function () { return pedidosSujo() || (aba === 'passo' && (passo === 3 || passo === 4) && RW.extrajornadaMontar && RW.extrajornadaMontar.sujo()); },
    /* joga fora o rascunho dos Pedidos e o da Distribuição */
    descartar: function () { p1 = null; if (RW.extrajornadaMontar) RW.extrajornadaMontar.descartar(); }
  };
})();
