/* ============================================================
   CAIXA FLUTUANTE — a peça escolhida e as caixas ao lado dela
   (compartilhado; hoje, a célula da grade da Escala:
   js/escalas-celula-editar.js).
   A peça clicada (o nome, ou o pelotão) e o que vai junto com ela (o
   pelotão do nome) ganham a classe .caixa-flutuante-escolhida (a
   borda forte, desenhada por dentro: nada muda de tamanho nem de
   lugar; a página pode dar o desenho dela). No computador, a caixa 1
   abre ao lado, a 4px da peça, com o primeiro item na altura do nome
   (ou, no bloco, com o topo a opcoes.topo do topo dele); com
   opcoes.esperar, ela só aparece quando o conteúdo chega (ou quando a
   página mostra os pontos), já no lugar e no tamanho dela. Um item
   escolhido abre a caixa 2 ao lado da caixa 1, cobrindo 4px da borda
   dela, com a primeira linha na altura do item, e o item fica cinza.
   No celular, a folha de baixo, sobre o véu, com a alça e o título; a
   caixa 2 troca o conteúdo da folha, com a seta de voltar.
   Fecham: o clique fora (fora do que a página pede para ignorar, que
   é dela), o Esc, a peça que sai da tela ou da página e o Voltar do
   navegador. Uma caixa por vez. A posição vem do geral-flutuante.js
   (que acompanha a rolagem e o tamanho da peça) e a animação do CSS;
   aqui, só as classes. Não cria HTML (clona os moldes do index.html).
   O dia que não muda: aviso(opcoes) abre a caixa com a nota e o Abrir o
   painel do dia (o painel só abre por ele).
   API: RosterWork.caixaFlutuante.abrir(opcoes) -> caixa
        opcoes = { peca, junto (o que é marcado com ela), topo (o bloco: o topo da caixa, em px, abaixo do topo dele;
                   sem ele, o primeiro item no meio da peça), titulo (o da folha), conteudo, esperar (a caixa só aparece
                   com o conteúdo), ignorar (o seletor dos cliques da página), aoFechar() (fechou pelo clique fora, pelo
                   Esc ou pela peça que saiu), aoVoltar() (o Voltar da folha) }
        caixa = { conteudo(el), espera(sim), segunda(item, el, titulo), fecharSegunda(), trocarPeca(peca, junto),
                  fechar(), aberta() }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var SAIDA = 100;   // a saída do CSS (0.1s): depois dela, as caixas saem da página
  var ESCOLHIDA = 'caixa-flutuante-escolhida';
  /* o que é da caixa (o clique ali não fecha): ela, as listas que abrem dentro dela, o aviso e o passo a passo */
  var DENTRO = '.caixa-flutuante, .dropdown-menu, .modal-veu, .guia-balao, .guia-vidro, .treino-barra';

  var atual = null;    // a caixa aberta
  var ligado = false;  // o clique fora, o Esc e o Voltar, ligados uma vez

  function celular() { return !!(RW.celular && RW.celular()); }
  function menosMovimento() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /* depois do primeiro quadro: a classe de aberto entra depois, para a animação sair do jeito de fechado */
  function depois(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  /* a saída: as classes de aberto saem já; as caixas, depois da animação. O lugar fixo delas só se desliga (soltar) na
     hora de sair da página: soltas antes, elas cairiam no fim da página e a barra de rolagem do navegador piscaria */
  function tirar(els, soltar) {
    var fim = function () {
      if (soltar) soltar();
      els.forEach(function (e) { if (e && e.parentNode) e.remove(); });
    };
    if (menosMovimento()) fim(); else setTimeout(fim, SAIDA);
  }

  /* o primeiro item à vista do corpo (ou os pontos, enquanto espera): a caixa 1 o põe na altura do nome */
  function primeiraLinha(caixa) {
    var espera = caixa.querySelector('.caixa-flutuante-espera');
    if (espera && !espera.classList.contains('oculto')) return espera;
    var itens = caixa.querySelectorAll('.caixa-flutuante-corpo .dropdown-item');
    for (var i = 0; i < itens.length; i++) if (itens[i].offsetHeight) return itens[i];
    return caixa.querySelector('.caixa-flutuante-corpo');
  }

  function novaCaixa(titulo) {
    var el = RW.tpl('tpl-caixa-flutuante');
    if (!el) return null;
    el.querySelector('.caixa-flutuante-titulo').textContent = titulo || '';
    return el;
  }

  /* ---------- a peça escolhida ---------- */

  function marcar(c, sim) {
    [c.peca].concat(c.junto || []).forEach(function (e) { if (e) e.classList.toggle(ESCOLHIDA, sim); });
  }

  /* ---------- a posição (no computador) ---------- */

  /* a peça saiu da tela ou da página: a página refeita pode dar a peça nova (trocarPeca) no quadro seguinte; só fecha se,
     dois quadros depois, a peça continua fora */
  function sair(c) {
    return function () {
      depois(function () {
        if (atual !== c) return;
        var r = c.peca.getBoundingClientRect(), doc = document.documentElement;
        if (c.peca.isConnected && r.bottom >= 0 && r.top <= doc.clientHeight) return;
        fecharDe(c, true);
      });
    };
  }

  function ancorarPeca(c) {
    var opcoes = { aoSair: sair(c), lado: 'direita' };
    /* o bloco: o topo da caixa a opcoes.topo do topo dele; o nome: o meio do primeiro item no meio dele */
    opcoes.deslocar = c.opcoes.topo != null ? function () { return c.opcoes.topo; } : function (ref) {
      var linha = primeiraLinha(c.c1);
      return ref.height / 2 - (linha.offsetTop + c.c1.clientTop + linha.offsetHeight / 2);
    };
    c.lado1 = opcoes;
    c.desligar1 = RW.flutuante.ancorar(c.peca, c.c1, opcoes);
  }

  function reposicionar(c) {
    if (c.folha || !c.lado1) return;
    RW.flutuante.posicionar(c.peca, c.c1, true, c.lado1);
    if (c.c2 && c.lado2) RW.flutuante.posicionar(c.c1, c.c2, true, c.lado2);
  }

  function desligarTudo(c) {
    ['desligar1', 'desligar2'].forEach(function (k) { if (c[k]) { c[k](); c[k] = null; } });
  }

  /* ---------- abrir ---------- */

  function abrir(opcoes) {
    if (atual) fecharDe(atual, false);
    ligar();
    var c = { opcoes: opcoes, peca: opcoes.peca, junto: opcoes.junto || [], folha: celular(), c1: novaCaixa(opcoes.titulo),
      c2: null, item: null, veu: null, guardado: null };
    if (!c.c1 || !c.peca) return null;
    if (opcoes.conteudo) c.c1.querySelector('.caixa-flutuante-corpo').appendChild(opcoes.conteudo);
    atual = c;
    marcar(c, true);
    /* esperando o conteúdo, a caixa fica no lugar, sem aparecer (a peça já fica escolhida) */
    c.esperando = !!opcoes.esperar && !opcoes.conteudo;
    if (c.esperando) c.c1.classList.add('caixa-flutuante--esperando');
    if (c.folha) {
      c.c1.classList.add('caixa-flutuante--folha');
      c.veu = RW.tpl('tpl-caixa-flutuante-veu');
      c.c1.querySelector('.caixa-flutuante-voltar').addEventListener('click', function () { fecharSegunda(c); });
      if (c.veu) document.body.appendChild(c.veu);
      document.body.appendChild(c.c1);
    } else {
      document.body.appendChild(c.c1);
      ancorarPeca(c);
    }
    depois(function () {
      if (atual !== c) return;
      if (!c.esperando) c.c1.classList.add('caixa-flutuante--aberta');
      if (c.veu) c.veu.classList.add('caixa-flutuante-veu--aberto');
    });
    return api(c);
  }

  /* a caixa que esperava aparece (o conteúdo chegou, ou a página mostrou os pontos): já está no lugar e no tamanho */
  function revelar(c) {
    if (!c.esperando) return;
    c.esperando = false;
    c.c1.classList.remove('caixa-flutuante--esperando');
    /* o lugar com o conteúdo já dentro, antes de aparecer (sem esperar o quadro seguinte) */
    reposicionar(c);
    depois(function () { if (atual === c) c.c1.classList.add('caixa-flutuante--aberta'); });
  }

  /* ---------- a caixa 2 ---------- */

  function segunda(c, item, el, titulo) {
    if (atual !== c) return;
    if (c.folha) {
      /* a folha troca o conteúdo: o menu fica guardado para o Voltar */
      var corpoF = c.c1.querySelector('.caixa-flutuante-corpo');
      if (!c.guardado) {
        c.guardado = { filhos: [].slice.call(corpoF.childNodes), titulo: c.c1.querySelector('.caixa-flutuante-titulo').textContent };
        c.guardado.filhos.forEach(function (f) { f.remove(); });
      }
      corpoF.textContent = '';
      corpoF.appendChild(el);
      c.c1.querySelector('.caixa-flutuante-titulo').textContent = titulo || '';
      c.c1.querySelector('.caixa-flutuante-voltar').classList.remove('oculto');
      c.item = item;
      return;
    }
    /* o mesmo item: só o conteúdo muda (sem animar de novo) */
    if (c.c2 && c.item === item) {
      var corpo = c.c2.querySelector('.caixa-flutuante-corpo');
      corpo.textContent = '';
      corpo.appendChild(el);
      return;
    }
    fecharSegunda(c);
    var c2 = novaCaixa('');
    if (!c2) return;
    c2.classList.add('caixa-flutuante--segunda');
    c2.querySelector('.caixa-flutuante-corpo').appendChild(el);
    document.body.appendChild(c2);
    c.c2 = c2;
    c.item = item;
    if (item) item.classList.add('caixa-flutuante-item--escolhido');
    /* cobre 4px da borda da caixa 1, com a primeira linha na altura do item; do lado em que a caixa 1 abriu */
    c.lado2 = {
      lado: 'direita', distancia: -4, alinhar: item || c.c1,
      deslocar: function () { var primeira = c2.querySelector('.caixa-flutuante-corpo'); return -(primeira.offsetTop + c2.clientTop); },
      preferirEsquerda: function () { return c.c1.classList.contains('flutuante--esquerda'); },
      aoSair: sair(c)
    };
    c.desligar2 = RW.flutuante.ancorar(c.c1, c2, c.lado2);
    depois(function () { if (c.c2 === c2) c2.classList.add('caixa-flutuante--aberta'); });
  }

  function fecharSegunda(c) {
    if (c.folha) {
      if (!c.guardado) return;
      var corpo = c.c1.querySelector('.caixa-flutuante-corpo');
      corpo.textContent = '';
      c.guardado.filhos.forEach(function (f) { corpo.appendChild(f); });
      c.c1.querySelector('.caixa-flutuante-titulo').textContent = c.guardado.titulo;
      c.c1.querySelector('.caixa-flutuante-voltar').classList.add('oculto');
      c.guardado = null;
      c.item = null;
      if (c.opcoes.aoVoltar) c.opcoes.aoVoltar();
      return;
    }
    if (c.item) c.item.classList.remove('caixa-flutuante-item--escolhido');
    c.item = null;
    var soltar2 = c.desligar2;
    c.desligar2 = null;
    c.lado2 = null;
    if (c.c2) {
      c.c2.classList.remove('caixa-flutuante--aberta');
      tirar([c.c2], soltar2);
      c.c2 = null;
    } else if (soltar2) soltar2();
  }

  /* ---------- a peça refeita (a página refez a linha ou o bloco) ---------- */

  /* a marca passa para a peça nova (e para o que vai junto); a caixa vai atrás dela */
  function trocarPeca(c, nova, junto) {
    if (atual !== c || !nova) return;
    marcar(c, false);
    var outra = nova !== c.peca;
    c.peca = nova;
    if (junto) c.junto = junto;
    marcar(c, true);
    if (c.folha) return;
    if (!outra) { reposicionar(c); return; }
    if (c.desligar1) { c.desligar1(); c.desligar1 = null; }
    ancorarPeca(c);
  }

  /* ---------- fechar ---------- */

  /* avisar: fechou pelo clique fora, pelo Esc ou pela peça que saiu (a página fecha o que é dela) */
  function fecharDe(c, avisar) {
    if (atual !== c) return;
    atual = null;
    marcar(c, false);
    [c.c1, c.c2, c.veu].forEach(function (e) {
      if (e) e.classList.remove('caixa-flutuante--aberta', 'caixa-flutuante-veu--aberto');
    });
    if (c.item) c.item.classList.remove('caixa-flutuante-item--escolhido');
    tirar([c.c1, c.c2, c.veu], function () { desligarTudo(c); });
    if (avisar && c.opcoes.aoFechar) c.opcoes.aoFechar();
  }

  function ligar() {
    if (ligado) return;
    ligado = true;
    document.addEventListener('click', function (ev) {
      var c = atual, t = ev.target;
      if (!c || !t || !t.closest) return;
      if (t.closest(DENTRO)) return;
      if (c.opcoes.ignorar && t.closest(c.opcoes.ignorar)) return;
      fecharDe(c, true);
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !atual) return;
      if (document.querySelector('.dropdown--aberto, .modal-veu--aberto')) return;
      fecharDe(atual, true);
    });
    window.addEventListener('popstate', function () { if (atual) fecharDe(atual, true); });
  }

  function api(c) {
    return {
      conteudo: function (el) {
        if (atual !== c) return;
        var corpo = c.c1.querySelector('.caixa-flutuante-corpo');
        if (c.guardado) { c.guardado.filhos = el ? [el] : []; return; }
        corpo.textContent = '';
        if (el) corpo.appendChild(el);
        if (el) revelar(c);
      },
      /* os pontos (a página os mostra quando o conteúdo demora): com eles, a caixa que esperava aparece */
      espera: function (sim) {
        if (atual !== c) return;
        c.c1.querySelector('.caixa-flutuante-espera').classList.toggle('oculto', !sim);
        if (sim) revelar(c);
      },
      segunda: function (item, el, titulo) { segunda(c, item, el, titulo); },
      fecharSegunda: function () { if (atual === c) fecharSegunda(c); },
      trocarPeca: function (nova, junto) { trocarPeca(c, nova, junto); },
      fechar: function () { fecharDe(c, false); },
      aberta: function () { return atual === c; },
      /* a peça de agora (a página acha a linha nova por ela) */
      peca: function () { return c.peca; },
      item: function () { return c.item; },
      folha: function () { return c.folha; }
    };
  }

  /* a caixa do dia que não muda (a célula da Escala e a da Extrajornada): o aviso (a nota, com a frase das mensagens) e,
     embaixo do traço, o Abrir o painel do dia; o painel só abre por ele. opcoes = { peca, junto, topo, titulo, texto,
     aoPainel() } */
  function aviso(opcoes) {
    var el = RW.tpl('tpl-caixa-flutuante-aviso'), nota = RW.tpl('tpl-escala-nota');
    if (!el || !nota) return null;
    nota.querySelector('.nota-texto').textContent = opcoes.texto || '';
    el.insertBefore(nota, el.firstChild);
    var caixa = abrir({ peca: opcoes.peca, junto: opcoes.junto || [], topo: opcoes.topo, titulo: opcoes.titulo, conteudo: el });
    el.querySelector('[data-acao="painel"]').addEventListener('click', function () { if (caixa) caixa.fechar(); opcoes.aoPainel(); });
    return caixa;
  }

  RW.caixaFlutuante = { abrir: abrir, aviso: aviso, aberta: function () { return !!atual; } };
})();
