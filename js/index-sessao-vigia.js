/* ============================================================
   VIGIA DE SESSÃO — renovação e expiração por inatividade
   Mantém a sessão viva enquanto o usuário trabalha: renova o token
   em segundo plano (RosterWork.renovarSessao) e zera um relógio de
   inatividade a cada ação. Após 2h sem ação, abre um aviso com
   contagem de 60s (anel pintado em <canvas>); sem resposta, encerra
   a sessão. Só roda no shell (index.html).
   CSS: css/index-sessao-vigia.css · markup: #veu-sessao no index.html
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* ⚠️⚠️ TEMPORÁRIO — SÓ PARA OS TESTES. REVERTER PARA false QUANDO OS TESTES ACABAREM.
     Enquanto true, a sessão não cai no meio dos testes: o timer de inatividade vai a 12h
     e o token é renovado ao voltar o foco/visibilidade da aba — isso resolve o caso das
     3 abas simultâneas, em que as de 2º plano têm o timer estrangulado pelo navegador e o
     token de 1h vence antes de renovar. NÃO é a segurança de produção: o vencimento de 1h
     do token em si é o "JWT expiry" no dashboard do Supabase (esse não muda por aqui).
     Ver DOCUMENTACAO.md › Login/Sessão (nota "MODO DE TESTE"). */
  var MODO_TESTE = true;

  var INATIVIDADE_MS = (MODO_TESTE ? 12 : 2) * 60 * 60 * 1000;   /* sem ação encerram a sessão (2h em produção) */
  var AVISO_MS = 60 * 1000;                    /* o aviso aparece nos últimos 60s (contagem de 1:00) */
  var FOLGA_RENOVAR_MS = 2 * 60 * 1000;        /* renova o token quando falta menos que isto para vencer */
  var ANEL_TRACO = 3;                          /* espessura do anel, em px CSS */

  var timerInatividade = null;   /* dispara o aviso */
  var timerExpiracao = null;     /* dispara a expiração durante o aviso */
  var intervaloRenovar = null;   /* renovação proativa do token */
  var quadroAnel = null;         /* requestAnimationFrame do anel */
  var inicioAviso = 0;           /* performance.now() na abertura do aviso */
  var avisoAberto = false;

  var veu, canvas, tempoEl, btnContinuar, btnSair;

  function pegarElementos() {
    veu = document.getElementById('veu-sessao');
    if (!veu) return false;
    canvas = veu.querySelector('.sessao-anel-canvas');
    tempoEl = veu.querySelector('.sessao-anel-tempo');
    btnContinuar = veu.querySelector('.sessao-continuar');
    btnSair = veu.querySelector('.sessao-sair');
    return true;
  }

  /* ---------- relógio de inatividade ---------- */

  function reiniciarInatividade() {
    if (MODO_TESTE) return;    /* ⚠️ TESTE: sem expiração por inatividade (não agenda o aviso) */
    if (avisoAberto) return;   /* durante o aviso, só "Continuar" reinicia */
    clearTimeout(timerInatividade);
    timerInatividade = setTimeout(mostrarAviso, INATIVIDADE_MS - AVISO_MS);
  }

  /* ---------- renovação proativa do token ---------- */

  function tokenVenceEmMs() {
    var token = RW.obterToken ? RW.obterToken() : null;
    if (!token) return 0;
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? (payload.exp * 1000 - Date.now()) : 0;
    } catch (e) { return 0; }
  }

  function talvezRenovar() {
    if (RW.renovarSessao && tokenVenceEmMs() < FOLGA_RENOVAR_MS) {
      RW.renovarSessao().catch(function () {});   /* falha definitiva cai no 401/aviso */
    }
  }

  /* ---------- anel da contagem (canvas; cores lidas do tema) ---------- */

  function formatarTempo(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var resto = s % 60;
    return Math.floor(s / 60) + ':' + (resto < 10 ? '0' + resto : resto);
  }

  function pintarAnel() {
    if (!canvas || !canvas.getContext) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    var dpr = window.devicePixelRatio || 1;
    var lado = Math.round(rect.width * dpr);
    if (canvas.width !== lado) canvas.width = lado;
    if (canvas.height !== lado) canvas.height = lado;

    var decorrido = performance.now() - inicioAviso;
    var fracao = Math.min(1, decorrido / AVISO_MS);

    /* o canvas não herda o CSS: lê os papéis de cor do tema (ver REGRAS §3/§4) */
    var cs = getComputedStyle(document.documentElement);
    var corProgresso = (cs.getPropertyValue('--alerta') || '').trim();
    var corTrilho = (cs.getPropertyValue('--fundo-medio') || '').trim();

    var ctx = canvas.getContext('2d');
    var centro = lado / 2;
    var esp = Math.max(1, Math.round(ANEL_TRACO * dpr));
    var raio = centro - esp;

    ctx.clearRect(0, 0, lado, lado);
    ctx.lineWidth = esp;
    ctx.lineCap = 'round';

    /* trilho de fundo (anel completo, discreto) */
    ctx.beginPath();
    ctx.strokeStyle = corTrilho;
    ctx.arc(centro, centro, raio, 0, Math.PI * 2);
    ctx.stroke();

    /* progresso: preenche do topo, no sentido horário, conforme o tempo passa */
    if (fracao > 0) {
      ctx.beginPath();
      ctx.strokeStyle = corProgresso;
      ctx.arc(centro, centro, raio, -Math.PI / 2, -Math.PI / 2 + fracao * Math.PI * 2);
      ctx.stroke();
    }

    if (tempoEl) tempoEl.textContent = formatarTempo(AVISO_MS - decorrido);

    if (avisoAberto && fracao < 1) {
      quadroAnel = window.requestAnimationFrame(pintarAnel);
    }
  }

  /* ---------- aviso ---------- */

  function mostrarAviso() {
    if (avisoAberto) return;
    avisoAberto = true;
    inicioAviso = performance.now();
    if (RW.abrirModal) RW.abrirModal('veu-sessao');
    if (btnContinuar) btnContinuar.focus();
    quadroAnel = window.requestAnimationFrame(pintarAnel);
    clearTimeout(timerExpiracao);
    timerExpiracao = setTimeout(expirarPorInatividade, AVISO_MS);
  }

  function fecharAviso() {
    avisoAberto = false;
    if (quadroAnel) window.cancelAnimationFrame(quadroAnel);
    quadroAnel = null;
    clearTimeout(timerExpiracao);
    if (RW.fecharModais) RW.fecharModais();
  }

  function continuar() {
    fecharAviso();
    if (RW.renovarSessao) RW.renovarSessao().catch(function () {});
    reiniciarInatividade();
  }

  function expirarPorInatividade() {
    fecharAviso();
    pararTudo();
    if (RW.expirarSessao) RW.expirarSessao(RW.mensagens.sessao.expiradaInatividade);
  }

  function pararTudo() {
    clearTimeout(timerInatividade);
    clearTimeout(timerExpiracao);
    clearInterval(intervaloRenovar);
  }

  /* ---------- início (só no shell) ---------- */

  function iniciar() {
    if (!pegarElementos()) return;
    btnContinuar.addEventListener('click', continuar);
    btnSair.addEventListener('click', function () {
      pararTudo();
      if (RW.sair) RW.sair();
    });
    /* só ação real do usuário reinicia o relógio (mouse à toa não conta) */
    document.addEventListener('click', reiniciarInatividade, true);
    document.addEventListener('keydown', reiniciarInatividade, true);
    reiniciarInatividade();
    intervaloRenovar = setInterval(talvezRenovar, 60 * 1000);

    /* MODO DE TESTE: renova ao voltar o foco/visibilidade da aba (a de 2º plano tem o
       timer estrangulado; ao voltar, o token pode estar vencido → renova antes da ação).
       ⚠️ TEMPORÁRIO — some junto com MODO_TESTE. */
    if (MODO_TESTE) {
      document.addEventListener('visibilitychange', function () { if (!document.hidden) talvezRenovar(); });
      window.addEventListener('focus', talvezRenovar);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
