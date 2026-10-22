/* ============================================================
   TROCAS — o calendário da aba Várias trocas
   O mês em miniatura (geral-mini-calendario) com os dias da troca:
   aceso = um militar da troca de serviço e outro livre (o banco diz,
   fn_trocas_varias_dias, de amanhã em diante); marcado = verde, com
   quem trabalha em cima e quem folga embaixo, riscado.
   Clicar num dia aceso: com uma opção só em "Quem trabalha?" e em
   "Quem folga?", marca direto; senão abre o quadro do dia (um
   .dropdown: o botão do dia é o gatilho), com as duas perguntas em
   bolinhas e, no dia marcado, os pares com Tirar. Cada militar
   entra uma vez por dia.
   Expõe RosterWork.trocasVariasCalendario.{ iniciar, recarregar, desenhar }
     iniciar(est, aoMudar) — est = o estado da aba (militares, pares,
       mes); aoMudar() avisa que os pares mudaram
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var est = null, aoMudar = null;
  var disp = {};      // iso -> { folga: [cpf], trabalha: [cpf] }
  var req = 0;        // token: só a resposta mais recente do banco vale

  function q(sel) { return est && est.raiz ? est.raiz.querySelector(sel) : null; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function militar(cpf) { return est.militares.filter(function (m) { return m.cpf === cpf; })[0] || null; }
  function paresDoDia(dia) { return est.pares.filter(function (p) { return p.data === dia; }); }
  function mesAtual() { var h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); }

  /* quem ainda pode entrar num par novo do dia: tira quem já está num par dele (cada militar entra uma vez por dia) */
  function opcoesDoDia(dia) {
    var usados = [];
    paresDoDia(dia).forEach(function (p) { usados.push(p.trabalha, p.folga); });
    var d = disp[dia] || { folga: [], trabalha: [] };
    var livre = function (c) { return usados.indexOf(c) < 0 && !!militar(c); };
    return { trabalha: (d.trabalha || []).filter(livre), folga: (d.folga || []).filter(livre) };
  }

  /* ---------- os dias do mês, do banco ---------- */
  function recarregar() {
    if (!est) return;
    var meu = ++req;
    disp = {};
    var espera = q('#tv-dias-espera');
    if (espera) espera.classList.toggle('oculto', est.militares.length > 1);
    if (est.militares.length < 2) { desenhar(); return; }
    var ini = est.mes, fim = new Date(est.mes.getFullYear(), est.mes.getMonth() + 1, 0);
    RW.trocasDados.variasDias(est.militares.map(function (m) { return m.cpf; }), iso(ini), iso(fim)).then(function (r) {
      if (meu !== req || !est) return;
      if (!r || !r.ok) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || RW.mensagens.trocas.varias.falhaDias }); }
      else (r.dias || []).forEach(function (d) { disp[String(d.data).slice(0, 10)] = d; });
      desenhar();
    }).catch(function () {
      if (meu !== req || !est) return;
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      desenhar();
    });
  }

  /* ---------- o desenho do mês ---------- */
  function desenhar() {
    if (!est || !q('#tv-calendario')) return;
    q('#tv-mes-nome').textContent = RW.mensagens.trocas.imprimir.mes(MESES[est.mes.getMonth()], est.mes.getFullYear());
    q('#tv-mes-anterior').disabled = est.mes.getTime() <= mesAtual().getTime();
    var dias = [];
    RW.miniCalendario.renderizar(q('#tv-calendario'), {
      dataRef: est.mes,
      aoDia: function (botao, dia) {
        var pares = paresDoDia(dia), op = opcoesDoDia(dia);
        var aceso = pares.length > 0 || (op.trabalha.length > 0 && op.folga.length > 0);
        if (pares.length) botao.classList.add('mini-calendario-dia--quer');
        else if (!aceso) botao.classList.add('mini-calendario-dia--inativo');
        botao.disabled = !aceso;
        pares.forEach(function (p) {
          var par = RW.tpl('tpl-troca-varias-par');
          par.querySelector('.trocas-dia-trabalha').textContent = militar(p.trabalha) ? militar(p.trabalha).nomeGuerra : '';
          par.querySelector('.trocas-dia-folga').textContent = militar(p.folga) ? militar(p.folga).nomeGuerra : '';
          botao.insertBefore(par, botao.querySelector('.mini-calendario-texto'));   // logo abaixo do número
        });
        if (aceso) dias.push({ botao: botao, dia: dia });
      }
    });
    /* cada dia aceso vira o gatilho do quadro dele */
    dias.forEach(function (x) {
      var ancora = RW.tpl('tpl-troca-varias-dia');
      x.botao.parentNode.insertBefore(ancora, x.botao);
      ancora.insertBefore(x.botao, ancora.firstChild);
      x.botao.addEventListener('click', function (ev) { aoClicarDia(ev, x.dia, ancora.querySelector('.dropdown-menu')); });
    });
  }

  /* ---------- o clique no dia ---------- */
  function marcar(dia, trabalha, folga) {
    if (RW.fecharDropdowns) RW.fecharDropdowns();
    est.pares.push({ data: dia, trabalha: trabalha, folga: folga });
    desenhar();
    if (aoMudar) aoMudar();
  }
  function tirar(par) {
    est.pares = est.pares.filter(function (p) { return p !== par; });
    desenhar();
    if (aoMudar) aoMudar();
  }
  function aoClicarDia(ev, dia, menu) {
    var pares = paresDoDia(dia), op = opcoesDoDia(dia);
    /* uma opção só em cada pergunta, no dia ainda sem par: marca direto (o quadro nem abre) */
    if (!pares.length && op.trabalha.length === 1 && op.folga.length === 1) {
      ev.stopPropagation();
      marcar(dia, op.trabalha[0], op.folga[0]);
      return;
    }
    montarQuadro(menu, dia, pares, op);   // o clique segue e o geral-dropdown abre o quadro
  }

  function montarQuadro(menu, dia, pares, op) {
    var c = RW.tpl('tpl-troca-varias-quadro');
    c.querySelector('.trocas-dia-quadro-data').textContent = RW.data.comDiaCurto(dia);
    var lista = c.querySelector('.trocas-dia-pares');
    pares.forEach(function (p) {
      var linha = RW.tpl('tpl-troca-varias-quadro-par');
      linha.querySelector('.trocas-dia-quadro-par-texto').textContent =
        RW.mensagens.trocas.varias.noLugarDe(militar(p.trabalha) ? militar(p.trabalha).nome : '', militar(p.folga) ? militar(p.folga).nome : '');
      linha.querySelector('.trocas-dia-tirar').addEventListener('click', function () { tirar(p); });
      lista.appendChild(linha);
    });
    var cabeNovo = op.trabalha.length > 0 && op.folga.length > 0;
    lista.classList.toggle('oculto', !pares.length);
    c.querySelector('.trocas-dia-quadro-divisor').classList.toggle('oculto', !pares.length || !cabeNovo);
    c.querySelector('.trocas-dia-novo').classList.toggle('oculto', !cabeNovo);
    if (cabeNovo) {
      var escolha = { trabalha: null, folga: null };
      var nomeGrupo = 'tv-' + dia + '-' + Date.now();
      ['trabalha', 'folga'].forEach(function (papel) {
        var alvo = c.querySelector('.trocas-dia-opcoes[data-papel="' + papel + '"]');
        op[papel].forEach(function (cpf) {
          var o = RW.tpl('tpl-troca-varias-opcao');
          var inp = o.querySelector('input');
          inp.name = nomeGrupo + '-' + papel;
          o.querySelector('span').textContent = militar(cpf).nome;
          /* com uma opção só, ela já vem marcada e falta um clique na outra pergunta
             (com uma só nas duas, nenhuma vem marcada: o clique nas duas marca o par) */
          var outro = papel === 'trabalha' ? 'folga' : 'trabalha';
          if (op[papel].length === 1 && op[outro].length > 1) { inp.checked = true; escolha[papel] = cpf; }
          inp.addEventListener('change', function () {
            escolha[papel] = cpf;
            if (escolha.trabalha && escolha.folga) marcar(dia, escolha.trabalha, escolha.folga);
          });
          alvo.appendChild(o);
        });
      });
    }
    menu.textContent = '';
    menu.appendChild(c);
  }

  /* ---------- o mês: as setas (não volta antes do mês de hoje) ---------- */
  function mudarMes(delta) {
    est.mes = new Date(est.mes.getFullYear(), est.mes.getMonth() + delta, 1);
    if (est.mes.getTime() < mesAtual().getTime()) est.mes = mesAtual();
    recarregar();
  }

  function iniciar(estado, cb) {
    est = estado; aoMudar = cb;
    est.mes = mesAtual();
    q('#tv-mes-anterior').addEventListener('click', function () { mudarMes(-1); });
    q('#tv-mes-proximo').addEventListener('click', function () { mudarMes(1); });
    recarregar();
  }
  function encerrar() { est = null; aoMudar = null; disp = {}; req++; }

  RW.trocasVariasCalendario = { iniciar: iniciar, recarregar: recarregar, desenhar: desenhar, encerrar: encerrar };
})();
