/* ============================================================
   GUIA — a ajuda de cada tela (RosterWork.guia)
   O botão ? (.pagina-ajuda) da linha do título abre a lista dos passo
   a passo escritos na própria página (<template data-guia
   data-titulo>, um <p> por passo) e o link do manual (data-manual =
   o id da seção do manual).
   Cada passo destaca o data-alvo (seletores separados por vírgula;
   data-anel="campo" envolve o campo inteiro, com o rótulo), rola até
   ele e avança pelo data-avanca:
     clique     — a pessoa clicou no alvo
     preenchido — o campo (data-condicao, ou o alvo) ganhou valor
     proximo    — o botão Próximo do balão (campo opcional ou já marcado)
     some       — o data-condicao saiu da tela (ex.: o formulário enviado)
   data-pular-se pula o passo quando o seletor existe na tela. O
   <p data-fim> é o balão final, que espera os modais fecharem.
   Sem o alvo por 3 s (a pessoa saiu do caminho), o guia termina.
   Com menu, calendário ou modal aberto, o guia espera escondido.
   A dica da primeira vez aponta o ? e some com Entendi ou com o
   próprio ?. O que a pessoa já viu fica em preferencias_usuario.ajuda
   ({ dica_vista, vistos }), gravado pelo fn_preferencias_salvar.
   Moldes: #tpl-guia-menu, #tpl-guia-menu-item, #tpl-guia-anel,
   #tpl-guia-balao, #tpl-guia-dica (index.html).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var TIQUE = 200;          // ms entre as conferências do passo (o alvo, o valor e a posição)
  var ESPERA_ALVO = 15;     // tiques sem o alvo até o guia terminar (3 s)
  var MARGEM = 4;           // folga do destaque em volta do campo (px)
  var DISTANCIA = 12;       // distância do balão ao campo e às bordas da tela (px)
  var ESPERAR = '.dropdown--aberto, .calendario--aberto, .modal-veu--aberto';
  var BOTAO_DA_PAGINA = '.conteudo > .pagina > .pagina-cabecalho > .pagina-ajuda > .botao';   // o ? da página (não os exemplos do Guia visual)

  var guia = null;          // o passo a passo em curso: { id, titulo, passos, fim, i, fase, mostrado, semAlvo, pagina }
  var anel = null, balao = null, dica = null;   // as peças, clonadas dos moldes uma vez só
  var timer = null;

  function conteudo() { return document.querySelector('.conteudo'); }
  function paginaAtual() { var c = conteudo(); return c ? c.querySelector('.pagina') : null; }
  /* a mesma condição do bloco de celular do CSS: a marca no <html> e a tela até 767px */
  function celular() {
    return document.documentElement.hasAttribute('data-celular') && !!window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  }
  function visivel(el) { return !!el && el.getClientRects().length > 0; }
  function limitar(v, min, max) { return Math.max(min, Math.min(v, max)); }
  function clonar(id) { var t = document.getElementById(id); return t ? t.content.firstElementChild.cloneNode(true) : null; }
  function pecas() {
    if (anel) return;
    anel = clonar('tpl-guia-anel');
    balao = clonar('tpl-guia-balao');
    dica = clonar('tpl-guia-dica');
    document.body.appendChild(anel);
    document.body.appendChild(balao);
    document.body.appendChild(dica);
  }
  function esconderPecas() { if (anel) { anel.classList.add('oculto'); balao.classList.add('oculto'); } }

  /* ---------- o que a pessoa já viu (preferencias_usuario.ajuda) ---------- */
  function lerPrefs() { try { return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {}; } catch (e) { return {}; } }
  function lerAjuda() { var a = lerPrefs().ajuda; return (a && typeof a === 'object') ? a : {}; }
  function gravarAjuda(mudar) {
    var atual = lerAjuda();
    var nova = { dica_vista: !!atual.dica_vista, vistos: Array.isArray(atual.vistos) ? atual.vistos.slice() : [] };
    mudar(nova);
    var prefs = lerPrefs();
    prefs.ajuda = nova;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    if (RW.apiFetch) {
      RW.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', { metodo: 'POST', corpo: { p_ajuda: nova } })
        .catch(function () {});   // falhou: vale nesta sessão, só não lembra em outro aparelho
    }
  }
  function marcarVisto(id) { gravarAjuda(function (a) { a.dica_vista = true; if (a.vistos.indexOf(id) < 0) a.vistos.push(id); }); }

  /* ---------- a lista do ?: os passo a passo da página e o manual ---------- */
  function montarMenu(ajuda) {
    var menu = ajuda.querySelector('.pagina-ajuda-menu');
    var molde = document.getElementById('tpl-guia-menu');
    if (!menu || !molde) return;
    menu.textContent = '';
    menu.appendChild(molde.content.cloneNode(true));
    var lista = menu.querySelector('.guia-menu-lista');
    var guias = conteudo() ? conteudo().querySelectorAll('template[data-guia]') : [];
    var vistos = lerAjuda().vistos || [];
    Array.prototype.forEach.call(guias, function (t) {
      var item = clonar('tpl-guia-menu-item');
      if (!item) return;
      item.setAttribute('data-guia', t.getAttribute('data-guia'));
      item.querySelector('.guia-menu-nome').textContent = t.getAttribute('data-titulo');
      item.querySelector('.guia-menu-visto').classList.toggle('oculto', vistos.indexOf(t.getAttribute('data-guia')) < 0);
      lista.appendChild(item);
    });
    /* página sem passo a passo: só o link do manual */
    var sem = !guias.length;
    menu.querySelector('.guia-menu-titulo').classList.toggle('oculto', sem);
    lista.classList.toggle('oculto', sem);
    menu.querySelector('.guia-menu-divisor').classList.toggle('oculto', sem);
  }

  /* ---------- o passo a passo ---------- */
  function iniciar(id) {
    var c = conteudo();
    var t = c ? c.querySelector('template[data-guia="' + id + '"]') : null;
    if (!t) return;
    pecas();
    encerrar();
    esconderDica(true);
    var todos = Array.prototype.slice.call(t.content.querySelectorAll('p'));
    guia = {
      id: id, titulo: t.getAttribute('data-titulo'),
      passos: todos.filter(function (p) { return !p.hasAttribute('data-fim'); }),
      fim: todos.filter(function (p) { return p.hasAttribute('data-fim'); })[0] || null,
      i: 0, fase: 'passo', mostrado: false, semAlvo: 0, pagina: paginaAtual()
    };
    ligarTimer();
  }
  function encerrar() {
    guia = null;
    esconderPecas();
    desligarTimerSeParado();
  }
  function avancar() {
    if (!guia) return;
    guia.i++;
    guia.mostrado = false;
    guia.semAlvo = 0;
    esconderPecas();
    if (guia.i >= guia.passos.length) concluir();
  }
  /* chegou ao fim: conta como visto e espera os modais (ex.: o resumo do pedido) para o balão final */
  function concluir() {
    marcarVisto(guia.id);
    guia.fase = 'esperaFim';
    esconderPecas();
  }

  function alvosDo(p) {
    var lista = [];
    (p.getAttribute('data-alvo') || '').split(',').forEach(function (seletor) {
      var el = seletor.trim() ? document.querySelector(seletor.trim()) : null;
      if (el && p.getAttribute('data-anel') === 'campo') el = el.closest('.campo') || el;
      if (visivel(el)) lista.push(el);
    });
    return lista;
  }
  function caixaDe(els) {
    var rs = els.map(function (e) { return e.getBoundingClientRect(); });
    return {
      x0: Math.min.apply(null, rs.map(function (r) { return r.left; })), y0: Math.min.apply(null, rs.map(function (r) { return r.top; })),
      x1: Math.max.apply(null, rs.map(function (r) { return r.right; })), y1: Math.max.apply(null, rs.map(function (r) { return r.bottom; }))
    };
  }
  /* rola a área do campo para ele ficar a 1/4 do alto dela (o balão fica do outro lado) */
  function rolarAte(el) {
    var area = el.parentElement;
    while (area && area !== document.body) {
      var rolagem = getComputedStyle(area).overflowY;
      if ((rolagem === 'auto' || rolagem === 'scroll') && area.scrollHeight > area.clientHeight) break;
      area = area.parentElement;
    }
    if (!area || area === document.body) return;
    area.scrollTop += (el.getBoundingClientRect().top - area.getBoundingClientRect().top) - area.clientHeight / 4;
  }

  function mostrarPasso() {
    var p = guia.passos[guia.i];
    balao.classList.add('guia-balao--passo');
    balao.querySelector('.guia-balao-titulo').textContent = guia.titulo;
    balao.querySelector('.guia-balao-contador').textContent = RW.mensagens.guia.contador(guia.i + 1, guia.passos.length);
    balao.querySelector('.guia-balao-separador').classList.remove('oculto');
    balao.querySelector('.guia-balao-sair').classList.remove('oculto');
    preencherTexto(p);
    var comProximo = p.getAttribute('data-avanca') === 'proximo';
    balao.querySelector('.guia-balao-rodape').classList.toggle('oculto', !comProximo);
    balao.querySelector('.guia-balao-proximo').classList.toggle('oculto', !comProximo);
    balao.querySelector('.guia-balao-concluir').classList.add('oculto');
  }
  /* o texto do passo vem da página (o <p> do molde, com os destaques em <strong>) */
  function preencherTexto(p) {
    var texto = balao.querySelector('.guia-balao-texto');
    texto.textContent = '';
    Array.prototype.forEach.call(p.childNodes, function (n) { texto.appendChild(n.cloneNode(true)); });
  }
  function posicionar(els) {
    var c = caixaDe(els);
    anel.style.setProperty('--guia-x', (c.x0 - MARGEM) + 'px');
    anel.style.setProperty('--guia-y', (c.y0 - MARGEM) + 'px');
    anel.style.setProperty('--guia-largura', (c.x1 - c.x0 + MARGEM * 2) + 'px');
    anel.style.setProperty('--guia-altura', (c.y1 - c.y0 + MARGEM * 2) + 'px');
    if (celular()) {
      var embaixo = (c.y0 + c.y1) / 2 < window.innerHeight / 2;
      balao.classList.toggle('guia-balao--baixo', embaixo);
      balao.classList.toggle('guia-balao--cima', !embaixo);
      return;
    }
    /* no computador: ao lado do campo (direita, senão esquerda); sem espaço dos lados, embaixo ou em cima */
    var W = window.innerWidth, H = window.innerHeight, bw = balao.offsetWidth, bh = balao.offsetHeight, x, y;
    if (W - c.x1 >= bw + DISTANCIA * 2) { x = c.x1 + DISTANCIA; y = c.y0; }
    else if (c.x0 >= bw + DISTANCIA * 2) { x = c.x0 - bw - DISTANCIA; y = c.y0; }
    else { x = c.x0; y = (c.y1 + DISTANCIA + bh <= H - DISTANCIA) ? c.y1 + DISTANCIA : c.y0 - bh - DISTANCIA; }
    balao.style.setProperty('--guia-balao-x', limitar(x, DISTANCIA, W - bw - DISTANCIA) + 'px');
    balao.style.setProperty('--guia-balao-y', limitar(y, DISTANCIA, H - bh - DISTANCIA) + 'px');
  }
  function mostrarFim() {
    if (!guia.fim) { encerrar(); return; }
    anel.classList.add('oculto');
    balao.classList.add('guia-balao--passo');
    balao.querySelector('.guia-balao-titulo').textContent = guia.titulo;
    balao.querySelector('.guia-balao-contador').textContent = '';
    balao.querySelector('.guia-balao-separador').classList.add('oculto');
    balao.querySelector('.guia-balao-sair').classList.add('oculto');
    preencherTexto(guia.fim);
    balao.querySelector('.guia-balao-rodape').classList.remove('oculto');
    balao.querySelector('.guia-balao-proximo').classList.add('oculto');
    balao.querySelector('.guia-balao-concluir').classList.remove('oculto');
    balao.classList.remove('oculto');
    /* no meio da tela (no celular, preso embaixo) */
    balao.classList.add('guia-balao--baixo');
    balao.classList.remove('guia-balao--cima');
    balao.style.setProperty('--guia-balao-x', Math.max(DISTANCIA, (window.innerWidth - balao.offsetWidth) / 2) + 'px');
    balao.style.setProperty('--guia-balao-y', Math.max(DISTANCIA, (window.innerHeight - balao.offsetHeight) / 2) + 'px');
  }

  /* a cada tique: confere o passo (pular, sumir, valor) e acompanha o alvo na tela */
  function tique() {
    conferirDica();
    if (!guia) { desligarTimerSeParado(); return; }
    if (guia.pagina !== paginaAtual()) { encerrar(); return; }   // a pessoa trocou de página
    if (guia.fase === 'fim') return;
    var p = guia.fase === 'passo' ? guia.passos[guia.i] : null;
    var avanca = p ? p.getAttribute('data-avanca') : null;
    var condicao = p ? p.getAttribute('data-condicao') : null;
    /* passo "some": o formulário saiu da tela; com o resumo aberto, foi enviado; sem ele, a pessoa desistiu */
    if (avanca === 'some' && guia.mostrado && condicao && !document.querySelector(condicao)) {
      if (document.querySelector('.modal-veu--aberto')) concluir(); else encerrar();
      return;
    }
    if (document.querySelector(ESPERAR)) { esconderPecas(); return; }
    if (guia.fase === 'esperaFim') { guia.fase = 'fim'; mostrarFim(); return; }
    var pular = p.getAttribute('data-pular-se');
    if (pular && document.querySelector(pular)) { avancar(); return; }
    var els = alvosDo(p);
    if (!els.length) {
      esconderPecas();
      if (++guia.semAlvo > ESPERA_ALVO) encerrar();
      return;
    }
    guia.semAlvo = 0;
    if (!guia.mostrado) { rolarAte(els[0]); mostrarPasso(); guia.mostrado = true; }
    anel.classList.remove('oculto');
    balao.classList.remove('oculto');
    posicionar(els);
    if (avanca === 'preenchido') {
      /* o valor é o do próprio campo (o data-condicao, ou o 1º seletor do alvo), não o da moldura do anel */
      var campo = document.querySelector(condicao || (p.getAttribute('data-alvo') || '').split(',')[0].trim());
      if (campo && typeof campo.value === 'string' && campo.value.trim() !== '') avancar();
    }
  }
  function ligarTimer() { if (!timer) timer = setInterval(tique, TIQUE); }
  function desligarTimerSeParado() {
    if (timer && !guia && !(dica && !dica.classList.contains('oculto'))) { clearInterval(timer); timer = null; }
  }

  /* ---------- a dica da primeira vez: aponta o ? da página ---------- */
  function conferirDica() {
    if (!dica) return;
    var botao = document.querySelector(BOTAO_DA_PAGINA);
    var mostrar = visivel(botao) && !guia && !lerAjuda().dica_vista && !document.querySelector(ESPERAR);
    dica.classList.toggle('oculto', !mostrar);
    if (!mostrar) return;
    var r = botao.getBoundingClientRect(), W = window.innerWidth;
    dica.style.setProperty('--guia-balao-x', limitar(r.right - dica.offsetWidth, DISTANCIA, W - dica.offsetWidth - DISTANCIA) + 'px');
    dica.style.setProperty('--guia-balao-y', (r.bottom + DISTANCIA / 2) + 'px');
  }
  function talvezDica() {
    if (lerAjuda().dica_vista || !document.querySelector(BOTAO_DA_PAGINA)) return;
    pecas();
    ligarTimer();
  }
  function esconderDica(gravar) {
    if (dica) dica.classList.add('oculto');
    if (gravar && !lerAjuda().dica_vista) gravarAjuda(function (a) { a.dica_vista = true; });
  }

  /* ---------- cliques (na captura: o menu do ? se monta antes de o dropdown abrir) ---------- */
  document.addEventListener('click', function (evento) {
    var alvo = evento.target;
    var gatilho = alvo.closest('.pagina-ajuda > .botao');
    if (gatilho) { esconderDica(true); montarMenu(gatilho.parentElement); return; }
    var item = alvo.closest('.guia-menu-item');
    if (item) { iniciar(item.getAttribute('data-guia')); return; }
    if (alvo.closest('.guia-menu-manual')) {
      var ajuda = alvo.closest('.pagina-ajuda');
      if (RW.irParaPagina) RW.irParaPagina('manual', null, ajuda ? ajuda.getAttribute('data-manual') : null);
      return;
    }
    if (alvo.closest('.guia-dica-entendi')) { esconderDica(true); return; }
    if (alvo.closest('.guia-balao-sair') || alvo.closest('.guia-balao-concluir')) { encerrar(); return; }
    if (alvo.closest('.guia-balao-proximo')) { avancar(); return; }
    /* passo "clique": avança depois que o clique fizer o efeito dele na página */
    if (guia && guia.fase === 'passo' && guia.mostrado) {
      var p = guia.passos[guia.i];
      if (p.getAttribute('data-avanca') !== 'clique') return;
      var acertou = (p.getAttribute('data-alvo') || '').split(',').some(function (s) { return s.trim() && alvo.closest(s.trim()); });
      if (acertou) setTimeout(avancar, 0);
    }
  }, true);

  /* a página trocou: o guia em curso termina (no tique) e a dica confere a página nova */
  function vigiarPaginas() {
    var c = conteudo();
    if (!c || !window.MutationObserver) return;
    new MutationObserver(function () { talvezDica(); if (guia) ligarTimer(); }).observe(c, { childList: true });
    talvezDica();
  }

  RW.guia = { iniciar: iniciar, encerrar: encerrar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigiarPaginas);
  else vigiarPaginas();
})();
