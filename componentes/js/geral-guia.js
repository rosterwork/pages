/* ============================================================
   GUIA — o passo a passo (RosterWork.guia)
   O botão ? (.pagina-ajuda) da linha do título abre a lista dos
   roteiros que passam pela tela, cada um a partir do passo desta
   tela, e o link do manual (data-manual = o id da seção). O
   Treinamento (geral-treino.js) começa os roteiros do início, no
   modo treino. Os roteiros e os atributos de cada passo estão em
   geral-guia-roteiros.js; o balão, em geral-guia-balao.js; o véu, em
   geral-guia-veu.js; os alvos do passo, em geral-guia-alvos.js. Aqui, a cada 200 ms, o passo em curso: pular,
   acender os alvos, pôr o balão e avançar. Tela ou painel carregando: o balão espera (até 30 s); outra tela que
   não é a do passo, ou 5 s sem o alvo: o roteiro termina (no treino, 10 s, fora o tempo de uma resposta do banco
   a caminho; o balão diz que ele parou, com Recomeçar e Voltar aos treinos). O passo com data-sem-alvo não
   termina: sem o alvo (ou sem o data-requer, a situação que ele pede), o balão diz por que o passo não dá ali e
   espera a situação aparecer (ex.: outro dia aberto). Com menu, calendário ou modal aberto sem o alvo dentro,
   espera escondido; o menu aberto pelo alvo acende junto. No passo, responde só o que é
   do roteiro: no de olhar (Próximo), nada do aceso; no livre
   (data-livre), o aceso inteiro; no de clique e no de gravar (some),
   só o botão que ele pede; na escolha, só os caminhos; nos de
   preencher, o aceso inteiro. O balão e a rolagem sempre. No treino,
   quem decide o que responde é o geral-guia-vidro.js; a situação que
   falta (data-sem-alvo) para o treino com a frase dela
   (data-sem-alvo-treino, quando a frase é outra); o menu aberto que o
   passo seguinte não usa fecha sozinho; e o passo de escrever
   (data-escrever) anda pelo Próximo, que aparece quando o campo tem
   texto ou, no passo "aparece", quando a condição dele aparece. A dica
   da primeira vez acende o ?. O que a pessoa já viu e a lista do ?
   ficam no geral-guia-ajuda.js. Moldes: #tpl-guia-balao e #tpl-guia-dica.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TIQUE = 200;          // ms entre as conferências do passo (o alvo, o valor e a posição)
  var ESPERA_ALVO = 25;     // tiques sem o alvo até o guia terminar (5 s)
  var ESPERA_OPCIONAL = 4;  // tiques sem o alvo até pular o passo opcional
  var ESPERA_AVISO = 20;    // tiques sem o alvo até o balão dizer por que o passo não dá (data-sem-alvo; 4 s: a lista que chega devagar, sem carregamento à vista, não mostra a frase antes da hora)
  var ESPERA_TREINO = 50;   // no treino, tiques sem o alvo do passo até parar o treino, com a frase dele (10 s, fora o tempo de uma resposta do banco a caminho)
  var ESPERA_TELA = 150;    // tiques esperando a tela do passo carregar (30 s: o mês de treino lançado da Extrajornada leva uns 15 s)
  var CALMA_FIM = 3;        // tiques sem aviso e sem carregamento até o balão final do treino (a resposta do Salvar chega antes dele)
  var DISTANCIA = 12;       // distância da dica ao ? e às bordas da tela (px)
  var ESPERAR = '.dropdown--aberto, .calendario--aberto, .modal-veu--aberto';
  var BOTAO_DA_PAGINA = '.conteudo > .pagina > .pagina-cabecalho > .pagina-ajuda > .botao';   // o ? da página (não os exemplos do Guia visual)

  var guia = null;          // o roteiro em curso: { id, titulo, passos, fim, treino, i, fase, mostrado, andando, semAlvo, avisando, pagina }
  var dica = null;          // a dica, clonada do molde uma vez só
  var timer = null;

  function R() { return RW.guiaRoteiros; }
  function V() { return RW.guiaVeu; }
  function B() { return RW.guiaBalao; }
  function A() { return RW.guiaAjuda; }
  function Vidro() { return RW.guiaVidro; }
  function G() { return RW.guiaAlvos; }
  function conteudo() { return document.querySelector('.conteudo'); }
  function paginaAtual() { var c = conteudo(); return c ? c.querySelector('.pagina') : null; }
  function nomeDaPagina() { return RW.paginaAtual ? RW.paginaAtual() : null; }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  function limitar(v, min, max) { return Math.max(min, Math.min(v, max)); }
  function alvosDo(passo) { return G().alvosDo(passo, guia); }
  function carregando() { return G().carregando(guia); }
  function pecas() {
    if (dica) return;
    B().peca();
    var molde = document.getElementById('tpl-guia-dica');
    dica = molde.content.firstElementChild.cloneNode(true);
    V().porNaTela(dica);
  }
  function esconderPecas() { if (guia) guia.avisando = false; B().esconder(); }

  /* ---------- o roteiro ---------- */
  /* opcoes: { pagina } começa no passo desta tela (o ?); { treino } no modo treino */
  function iniciar(id, opcoes) {
    opcoes = opcoes || {};
    var t = R().roteiro(id);
    var passos = t ? R().passos(id, opcoes.pagina || null) : null;
    if (!passos || !passos.length) return;
    pecas();
    encerrar();
    esconderDica(true);
    var treino = !!opcoes.treino || !!(RW.treino && RW.treino.ligado());
    guia = {
      id: id, titulo: t.getAttribute('data-titulo'), passos: doModo(passos, treino), treino: treino,
      fim: (treino && R().fimDe(t.content, true)) || R().fimDe(t.content, false),
      i: 0, fase: 'passo', mostrado: false, semAlvo: 0, avisando: false, esperaTela: 0, pagina: paginaAtual(),
      avisosVistos: [], esperaBanco: 0
    };
    if (treino) Vidro().ligar(guia, { alvosDo: alvosDo, elementos: G().elementos, carregando: carregando, parar: parar, balaoFinal: balaoFinal, esconderPecas: esconderPecas });
    ligarTimer();
  }
  /* os passos que valem neste modo: <p data-so-treino> só no treino; <p data-so-ajuda> só no ? */
  function doModo(lista, treino) {
    return lista.filter(function (passo) { return !passo.p.hasAttribute(treino ? 'data-so-ajuda' : 'data-so-treino'); });
  }
  function encerrar() {
    guia = null;
    Vidro().desligar();
    esconderPecas();
    desligarTimerSeParado();
  }
  function proximoPasso() {
    guia.mostrado = false;
    guia.semAlvo = guia.esperaBanco = 0;
    guia.avisosVistos = [];
    esconderPecas();
    if (guia.i >= guia.passos.length) concluir();
  }
  function avancar() { if (guia) { guia.i++; proximoPasso(); } }
  /* o clique do passo: anda depois do efeito dele na página. Até lá o tique não olha o passo: o efeito pode já valer como
     o data-pular-se dele, e o passo seguinte se perderia */
  function avancarDepois() {
    guia.mostrado = false;
    guia.andando = true;
    setTimeout(function () { if (guia) guia.andando = false; avancar(); }, 0);
  }
  /* o passo pulado sai da fila (a contagem diminui) */
  function pular() { guia.passos.splice(guia.i, 1); proximoPasso(); }
  /* chegou ao fim: no treino, conta como visto (o ? é ajuda, não treino); espera os modais (ex.: o resumo do pedido)
     para o balão final */
  function concluir() {
    if (guia.treino) A().marcarVisto(guia.id);
    guia.fase = 'esperaFim';
    guia.calma = 0;
    guia.esperaTela = 0;
    esconderPecas();
  }
  /* o roteiro não pode seguir: fora do treino, só termina; no treino, a tela fica no véu e o balão oferece recomeçar
     (frase: o que faltou, quando o passo diz) */
  function parar(frase) {
    if (!guia.treino) { encerrar(); return; }
    guia.fase = 'parado';
    guia.frase = frase || null;
    guia.mostrado = false;
    esconderPecas();
    B().parado(guia);
  }
  function balaoFinal() { if (guia.fase === 'parado') B().parado(guia); else B().fim(guia); }
  /* a tela final do treino, parada: o aviso que chega depois dela passa à frente, e o balão volta quando ele fechar */
  function manterFinal() {
    if (guia.treino && Vidro().avisoNaFrente()) return;
    var aviso = !!document.querySelector('.modal-veu--aberto');
    if (aviso && !guia.finalAtras) { guia.finalAtras = true; esconderPecas(); }
    else if (!aviso && guia.finalAtras) { guia.finalAtras = false; balaoFinal(); }
    else if (!aviso) V().mostrar([]);
  }

  /* o passo é desta tela (ou do menu, que está em todas)? */
  function naTela(passo) { return !passo.pagina || passo.pagina === 'qualquer' || passo.pagina === nomeDaPagina(); }

  /* o passo pede para ser pulado agora? */
  function pulaAgora(p) {
    var pular = p.getAttribute('data-pular-se');
    if (pular && G().um(pular)) return true;
    var cel = R().celular();
    return (cel && p.hasAttribute('data-so-computador')) || (!cel && p.hasAttribute('data-so-celular'));
  }

  /* sem o alvo: o passo com data-sem-alvo diz por que não dá e espera (mesmo com um menu aberto); o opcional é pulado;
     com menu ou modal aberto, os outros esperam sem contar; os demais terminam o roteiro */
  function semAlvo(p) {
    var opcional = p.hasAttribute('data-opcional'), texto = p.getAttribute('data-sem-alvo');
    if (!guia.treino && !opcional && !texto && document.querySelector(ESPERAR)) { esconderPecas(); return; }
    if (!guia.avisando) esconderPecas();
    guia.semAlvo++;
    if (guia.treino && !opcional) {
      if (RW.treino.noAr() && ++guia.esperaBanco <= ESPERA_TELA) { guia.semAlvo = 0; return; }
      if (guia.semAlvo > ESPERA_TREINO) parar(p.getAttribute('data-sem-alvo-treino') || texto);
      return;
    }
    if (texto) {
      if (guia.semAlvo > ESPERA_AVISO && !guia.avisando) { B().aviso(texto, guia); guia.avisando = true; guia.mostrado = false; }
      return;
    }
    if (guia.semAlvo > (opcional ? ESPERA_OPCIONAL : ESPERA_ALVO)) { if (opcional) pular(); else parar(); }
  }

  /* a cada tique: confere a tela e o passo (pular, sumir, valor) e acompanha os alvos na tela */
  function tique() {
    conferirDica();
    if (!guia) { desligarTimerSeParado(); return; }
    if (guia.andando) return;
    if (guia.fase === 'parado') { manterFinal(); return; }
    var passo = guia.fase === 'passo' ? guia.passos[guia.i] : null;
    var pagina = paginaAtual();
    /* trocou de tela: segue quando o passo é da tela nova (ou quando o treino já chegou ao fim); senão, a pessoa saiu do
       caminho */
    if (pagina && guia.pagina !== pagina) {
      if ((passo && naTela(passo)) || (guia.treino && guia.fase === 'esperaFim')) guia.pagina = pagina;
      else { parar(); return; }
    }
    if (guia.fase === 'fim') { if (guia.treino) manterFinal(); return; }
    var p = passo ? passo.p : null;
    var avanca = p ? p.getAttribute('data-avanca') : null;
    var condicao = p ? p.getAttribute('data-condicao') : null;
    /* passo "some": o formulário saiu da tela; com o resumo aberto, foi enviado; sem ele, a pessoa desistiu */
    if (avanca === 'some' && guia.mostrado && condicao && !G().um(condicao)) {
      if (document.querySelector('.modal-veu--aberto')) concluir(); else parar();
      return;
    }
    if (guia.treino && Vidro().avisoNaFrente()) return;
    if (guia.fase === 'esperaFim') {
      /* no treino, o balão final vem depois da resposta do Salvar e do aviso dela */
      if (guia.treino && RW.fecharDropdowns) RW.fecharDropdowns();
      if (document.querySelector(ESPERAR) || (guia.treino && carregando())) {
        esconderPecas();
        guia.calma = 0;
        if (guia.treino && ++guia.esperaTela > ESPERA_TELA) parar();
        return;
      }
      if (guia.treino && ++guia.calma < CALMA_FIM) return;
      guia.fase = 'fim';
      if (guia.treino) guia.seguinte = A().proximoTreino(guia.id);
      if (guia.fim) B().fim(guia); else encerrar();
      return;
    }
    /* a tela ainda carregando (o véu dela): o passo espera, para o clique não chegar antes de a tela estar pronta */
    if (!naTela(passo) || carregando()) {
      esconderPecas();
      guia.semAlvo = 0;
      if (++guia.esperaTela > ESPERA_TELA) parar();
      return;
    }
    guia.esperaTela = 0;
    if (pulaAgora(p)) { pular(); return; }
    var els = alvosDo(passo);
    /* no treino, a porta do passo "aparece" pode sumir com o clique (o item do menu que fechou), antes de a condição chegar */
    if (!els.length && guia.treino && avanca === 'aparece' && !p.hasAttribute('data-escrever') && Array.prototype.some.call(G().todos(condicao), visivel)) { avancar(); return; }
    if (!els.length) { semAlvo(p); return; }
    /* no treino, ninguém fecharia o menu que o passo não usa: ele fecha sozinho */
    if (G().esperando(els)) { if (guia.treino && RW.fecharDropdowns) RW.fecharDropdowns(); esconderPecas(); return; }
    guia.semAlvo = 0;
    guia.avisando = false;
    if (!guia.mostrado) { G().rolarAte(els); B().passo(guia); guia.mostrado = true; }
    B().posicionar(els);
    if (avanca === 'aparece') {
      var apareceu = Array.prototype.some.call(G().todos(condicao), visivel);
      if (guia.treino && p.hasAttribute('data-escrever')) B().mostrarProximo(apareceu);
      else if (apareceu) avancar();
      return;
    }
    if (avanca !== 'preenchido') return;
    /* o valor é o do próprio campo (o data-condicao, ou o 1º seletor do alvo), não o da moldura do campo */
    var campo = G().um(condicao || G().seletoresDo(passo)[0]);
    var marcavel = campo && (campo.type === 'radio' || campo.type === 'checkbox');
    var preenchido = !!campo && (marcavel ? campo.checked : (typeof campo.value === 'string' && campo.value.trim() !== ''));
    /* no treino, quem escreve termina no Próximo: o passo não anda na primeira letra */
    if (guia.treino && p.hasAttribute('data-escrever')) { B().mostrarProximo(preenchido); return; }
    if (preenchido) avancar();
  }
  function ligarTimer() { if (!timer) timer = setInterval(tique, TIQUE); }
  function desligarTimerSeParado() {
    if (timer && !guia && !(dica && !dica.classList.contains('oculto'))) { clearInterval(timer); timer = null; }
  }

  /* ---------- a dica da primeira vez: o ? aceso, com o resto da tela no véu ---------- */
  function conferirDica() {
    if (!dica) return;
    var botao = document.querySelector(BOTAO_DA_PAGINA);
    var mostrar = visivel(botao) && !guia && !A().dicaVista() && !document.querySelector(ESPERAR);
    var estava = !dica.classList.contains('oculto');
    dica.classList.toggle('oculto', !mostrar);
    if (!mostrar) { if (estava && !guia) V().esconder(); return; }
    var r = botao.getBoundingClientRect(), W = window.innerWidth;
    V().mostrar([V().caixaDe(botao)]);
    dica.style.setProperty('--guia-balao-x', limitar(r.right - dica.offsetWidth, DISTANCIA, W - dica.offsetWidth - DISTANCIA) + 'px');
    dica.style.setProperty('--guia-balao-y', (r.bottom + DISTANCIA / 2) + 'px');
  }
  function talvezDica() {
    if (A().dicaVista() || !document.querySelector(BOTAO_DA_PAGINA)) return;
    pecas();
    ligarTimer();
  }
  function esconderDica(gravar) {
    if (dica && !dica.classList.contains('oculto')) { dica.classList.add('oculto'); if (!guia) V().esconder(); }
    if (gravar) A().marcarDica();
  }

  /* o que o clique do passo pede: o data-clique ou, sem ele, o alvo (na escolha, as entradas dos caminhos); no treino,
     também o data-treino-alvo */
  function seletoresDoClique(passo) {
    var clique = passo.p.getAttribute('data-clique'), doTreino = guia.treino && passo.p.getAttribute('data-treino-alvo');
    var lista = clique ? R().seletores(clique) : G().seletoresDo(passo);
    return doTreino ? lista.concat(R().seletores(doTreino)) : lista;
  }
  function casa(el, seletores) { return seletores.some(function (s) { try { return !!el.closest(s); } catch (e) { return false; } }); }

  /* ---------- no ? (no treino, quem cuida é o vidro), durante um passo, responde só o que é do roteiro, dentro do aceso
     (os alvos e os menus abertos por eles): no de olhar (Próximo), nada; no livre (data-livre), o aceso inteiro; no de
     clique, no de gravar (some: o Salvar, não o Cancelar ao lado) e na escolha, só o que eles pedem; nos de preencher
     (preenchido, aparece), o aceso inteiro. O balão sempre. O toque e o mouse valem pelo ponto (cai num buraco do véu?);
     o clique do teclado, pelo elemento. Rolar a tela continua ---------- */
  function bloqueado(evento) {
    if (!guia || guia.treino) return false;
    var alvo = evento.target;
    if (!alvo.closest || alvo.closest('.guia-balao, .treino-barra')) return false;
    if (guia.fase !== 'passo' || !guia.mostrado || !V().visivel()) return false;
    var noAceso = evento.type === 'click' && evento.detail === 0
      ? B().acesos().some(function (el) { return el.contains(alvo); })
      : V().aceso(evento.clientX, evento.clientY);
    if (!noAceso) return true;
    var passo = guia.passos[guia.i], p = passo.p, avanca = p.getAttribute('data-avanca');
    if (p.hasAttribute('data-livre')) return false;
    if (avanca === 'proximo') return true;
    if (avanca === 'clique' || avanca === 'escolha' || avanca === 'some') return !casa(alvo, seletoresDoClique(passo));
    return false;
  }
  function segurar(evento) {
    if (!bloqueado(evento)) return false;
    evento.preventDefault();
    evento.stopPropagation();
    return true;
  }
  document.addEventListener('mousedown', segurar, true);
  /* o dedo: só para a propagação (sem preventDefault, para a rolagem continuar) */
  ['pointerdown', 'touchstart'].forEach(function (tipo) {
    document.addEventListener(tipo, function (evento) {
      var toque = evento.touches && evento.touches[0];
      var ponto = toque ? { type: tipo, target: evento.target, clientX: toque.clientX, clientY: toque.clientY } : evento;
      if (bloqueado(ponto)) evento.stopPropagation();
    }, { capture: true, passive: true });
  });

  /* ---------- cliques (na captura: o menu do ? se monta antes de o dropdown abrir, e o clique segurado do treino
     não chega à tela) ---------- */
  document.addEventListener('click', function (evento) {
    if (segurar(evento)) return;
    var alvo = evento.target;
    var gatilho = alvo.closest('.pagina-ajuda > .botao');
    if (gatilho) { esconderDica(true); A().montarMenu(gatilho.parentElement); return; }
    var item = alvo.closest('.guia-menu-item');
    if (item) { iniciar(item.getAttribute('data-guia'), { pagina: nomeDaPagina() }); return; }
    if (alvo.closest('.guia-menu-manual')) {
      var ajuda = alvo.closest('.pagina-ajuda');
      if (RW.irParaPagina) RW.irParaPagina('manual', null, ajuda ? A().secaoDoManual(ajuda) : null);
      return;
    }
    if (alvo.closest('.guia-dica-entendi')) { esconderDica(true); return; }
    if (alvo.closest('.guia-balao-sair') || alvo.closest('.guia-balao-concluir')) { encerrar(); return; }
    if (alvo.closest('.guia-balao-treinos')) { encerrar(); if (RW.treino) RW.treino.voltarAosTreinos(); return; }
    if (alvo.closest('.guia-balao-seguinte-botao')) {
      var seguinte = guia && guia.seguinte;
      encerrar();
      if (seguinte && RW.treino) RW.treino.seguir(seguinte);
      return;
    }
    /* o Recomeçar do balão e o da barra azul; o da barra espera o aviso aberto fechar */
    if (alvo.closest('.guia-balao-recomecar') || (alvo.closest('.treino-barra-recomecar') && !document.querySelector('.modal-veu--aberto'))) {
      var deNovo = guia && guia.id;
      encerrar();
      if (deNovo && RW.treino) RW.treino.seguir(deNovo);
      return;
    }
    if (alvo.closest('.guia-balao-proximo')) { avancar(); return; }
    if (!guia || guia.fase !== 'passo' || !guia.mostrado) return;
    var passo = guia.passos[guia.i];
    var acertou = casa(alvo, seletoresDoClique(passo));
    /* no treino, o clique que gravaria fica com o guia: o roteiro vai ao fim (o menu e o aviso abertos fecham, como o
       clique faria) */
    if (acertou && guia.treino && passo.p.hasAttribute('data-segurar')) {
      evento.preventDefault();
      evento.stopPropagation();
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      if (alvo.closest('.modal-veu') && RW.fecharModais) RW.fecharModais();
      concluir();
      return;
    }
    var avanca = passo.p.getAttribute('data-avanca');
    /* escolha: o caminho clicado entra na fila, logo depois deste passo. O passo deixa de ouvir na hora: o clique no
       rótulo de uma bolinha chega de novo, pela própria bolinha */
    if (avanca === 'escolha') {
      var caminho = R().caminho(passo, alvo);
      if (!caminho) return;
      guia.passos = guia.passos.slice(0, guia.i + 1).concat(doModo(caminho.passos, guia.treino), guia.passos.slice(guia.i + 1));
      var fim = (guia.treino && caminho.fimTreino) || caminho.fim;
      if (fim) guia.fim = fim;
      /* no treino, a entrada do caminho que já grava fica com o guia, como o clique segurado */
      if (guia.treino && caminho.segurar) { evento.preventDefault(); evento.stopPropagation(); concluir(); return; }
      avancarDepois();
      return;
    }
    if (avanca === 'clique' && acertou) avancarDepois();
  }, true);

  /* a página trocou: o roteiro confere a tela nova (no tique) e a dica também */
  function vigiarPaginas() {
    var c = conteudo();
    if (!c || !window.MutationObserver) return;
    new MutationObserver(function () { talvezDica(); if (guia) ligarTimer(); }).observe(c, { childList: true });
    talvezDica();
  }

  RW.guia = {
    iniciar: iniciar, encerrar: encerrar, visto: function (id) { return A().visto(id); },
    emCurso: function () { return guia ? guia.id : null; },
    proximo: function (id) { return A().proximoTreino(id || null); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigiarPaginas);
  else vigiarPaginas();
})();
