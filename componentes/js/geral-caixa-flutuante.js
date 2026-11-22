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
   opcoes.esperar, a caixa espera o conteúdo no lugar, sem aparecer: o
   que chega em até 0,2 s aparece direto; passando disso, a forma (as
   faixas do esqueleto, molde #tpl-caixa-flutuante-forma) aparece e fica
   o mínimo na tela (0,2 s; atrasoCaixa e faltaCaixa, geral-etapas.js).
   Enquanto ela não apareceu, o clique fora fecha e segue para onde foi
   (ninguém viu a caixa), e, no celular, o véu espera com a folha. Um item
   escolhido abre a caixa 2 ao lado da caixa 1, cobrindo 4px da borda
   dela, com a primeira linha na altura do item, e o item fica cinza.
   No celular, a folha de baixo, sobre o véu, com a alça e o título; a
   caixa 2 troca o conteúdo da folha, com a seta de voltar.
   Fecham: o clique fora, o Esc, a peça que sai da tela ou da página
   e o Voltar do navegador. Com a caixa à vista, o clique fora só fecha,
   como num menu: ele não chega ao que está embaixo (outra célula, um botão, um link); o
   rodapé largo da página (.rodape--largo) é a exceção: fecha e faz o
   que o botão diz no mesmo clique. Com a resposta pela metade, a página
   segura o clique fora (aoClicarFora devolve false): a caixa fica e o
   clique não faz mais nada (no celular, o toque no véu também). A
   caixa 2, no computador, tem o X no alto, que fecha as duas como o
   Esc; a página pode segurar os dois também (aoTentarFechar devolve
   false). Na linha do alto fica também a espera da página: a linha
   do conteúdo da caixa 2 marcada no molde com .caixa-flutuante-no-alto
   (o Conferindo a mudança) vem para a direita da linha, antes do X (na
   folha, no fim da linha do título); só a barra aparece, a frase fica
   para o leitor de tela (.texto-leitor), e a caixa não muda de tamanho
   quando ela aparece ou some. O Esc fecha só a caixa (o painel
   lateral atrás dela fica); com a lista ou o calendário de um campo
   dela aberto, fecha só ele. Uma caixa por vez. A posição vem do geral-flutuante.js
   (que acompanha a rolagem e o tamanho da peça) e a animação do CSS;
   aqui, só as classes. Não cria HTML (clona os moldes do index.html).
   O dia que não muda: aviso(opcoes) abre a caixa com a nota e o Abrir o
   painel do dia (o painel só abre por ele).
   API: RosterWork.caixaFlutuante.abrir(opcoes) -> caixa
        opcoes = { peca, junto (o que é marcado com ela), topo (o bloco: o topo da caixa, em px, abaixo do topo dele;
                   sem ele, o primeiro item no meio da peça), titulo (o da folha), conteudo, esperar (sem o conteúdo no
                   quadro seguinte, a forma), aoFechar(como) (fechou pelo clique fora, pelo Esc, pelo X, pelo Voltar
                   do navegador ou pela peça que saiu: como = 'fora', 'esc', 'x', 'voltar' ou 'peca'), aoVoltar() (o Voltar da folha), aoClicarFora(alvo) (false: a caixa fica, e o clique não faz
                   mais nada; o alvo é o que foi clicado, também no rodapé largo), aoTentarFechar(alvo) (o mesmo para o
                   X e o Esc; o alvo é o X, ou null no Esc), preferirEsquerda (a caixa 1 abre à
                   esquerda da peça quando cabe: booleano ou função, como no geral-flutuante) }
        caixa = { conteudo(el), faltaForma() (quantos ms a forma à vista ainda fica), segunda(item, el, titulo),
                  fecharSegunda(), trocarPeca(peca, junto), fechar(), aberta() }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var SAIDA = 100;   // a saída do CSS (0.1s): depois dela, as caixas saem da página
  var ESCOLHIDA = 'caixa-flutuante-escolhida';
  /* o que é da caixa (o clique ali não fecha): ela, as listas que abrem dentro dela, o aviso e o passo a passo */
  var DENTRO = '.caixa-flutuante, .dropdown-menu, .modal-veu, .guia-balao, .guia-vidro, .treino-barra';
  /* o clique fora que fecha e segue para o botão: o rodapé largo (o Salvar, o Cancelar, o Desfazer e o Refazer) */
  var PASSA = '.rodape--largo';

  var atual = null;    // a caixa aberta
  var ligado = false;  // o clique fora, o Esc e o Voltar, ligados uma vez

  function celular() { return !!(RW.celular && RW.celular()); }
  function menosMovimento() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /* depois do primeiro quadro: a classe de aberto entra depois, para a animação sair do jeito de fechado */
  function depois(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  /* o véu do celular entra com a folha (a que espera o conteúdo, só quando aparece), atrás dela */
  function porVeu(c) {
    if (!c.veu || c.veu.isConnected) return;
    document.body.insertBefore(c.veu, c.c1);
    depois(function () { if (atual === c) c.veu.classList.add('caixa-flutuante-veu--aberto'); });
  }
  /* a saída: as classes de aberto saem já; as caixas, depois da animação. O lugar fixo delas só se desliga (soltar) na
     hora de sair da página: soltas antes, elas cairiam no fim da página e a barra de rolagem do navegador piscaria */
  function tirar(els, soltar) {
    var fim = function () {
      if (soltar) soltar();
      els.forEach(function (e) { if (e && e.parentNode) e.remove(); });
    };
    if (menosMovimento()) fim(); else setTimeout(fim, SAIDA);
  }

  /* o primeiro item à vista do corpo (ou a 1ª faixa da forma, enquanto espera): a caixa 1 o põe na altura do nome */
  function primeiraLinha(caixa) {
    var faixa = caixa.querySelector('.caixa-flutuante-corpo > .caixa-flutuante-forma .caixa-flutuante-forma-fila');
    if (faixa) return faixa;
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

  /* a espera da página (a linha marcada com .caixa-flutuante-no-alto no conteúdo da caixa 2) vai para a linha do alto, à
     direita (antes do X; na folha, no fim da linha do título): só a barra aparece, a frase fica para o leitor de tela. Sem
     el, o lugar fica vazio (a folha voltou ao menu) */
  function subirEspera(caixa, el) {
    var lugar = caixa.querySelector('.caixa-flutuante-espera');
    if (!lugar) return;
    lugar.textContent = '';
    var linha = el && el.querySelector ? el.querySelector('.caixa-flutuante-no-alto') : null;
    if (!linha) return;
    var frase = linha.querySelector('.etapas-linha-texto');
    if (frase) frase.classList.add('texto-leitor');
    lugar.appendChild(linha);
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
        fecharDe(c, 'peca');
      });
    };
  }

  function ancorarPeca(c) {
    var opcoes = { aoSair: sair(c), lado: 'direita' };
    /* a página pode pedir a esquerda (cabendo): a do calendário das Trocas, para não cobrir os outros dias da troca */
    if (c.opcoes.preferirEsquerda) opcoes.preferirEsquerda = c.opcoes.preferirEsquerda;
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
    /* esperando o conteúdo, a caixa fica no lugar, sem aparecer (a peça já fica escolhida), com a forma dentro: o que
       chega em até 0,2 s (a leitura guardada, a rápida) aparece direto; passando disso, a forma aparece */
    c.esperando = !!opcoes.esperar && !opcoes.conteudo;
    if (c.esperando) {
      c.c1.classList.add('caixa-flutuante--esperando');
      var forma = RW.tpl('tpl-caixa-flutuante-forma');
      if (forma) c.c1.querySelector('.caixa-flutuante-corpo').appendChild(forma);
      c.relogioForma = setTimeout(function () {
        if (atual !== c || !c.esperando || !forma) return;
        c.formaEm = performance.now();
        revelar(c);
      }, RW.etapas ? RW.etapas.atrasoCaixa : 0);
    }
    if (c.folha) {
      c.c1.classList.add('caixa-flutuante--folha');
      c.veu = RW.tpl('tpl-caixa-flutuante-veu');
      c.c1.querySelector('.caixa-flutuante-voltar').addEventListener('click', function () { fecharSegunda(c); });
      document.body.appendChild(c.c1);
      if (!c.esperando) porVeu(c);
    } else {
      document.body.appendChild(c.c1);
      ancorarPeca(c);
    }
    depois(function () {
      if (atual !== c) return;
      if (!c.esperando) c.c1.classList.add('caixa-flutuante--aberta');
    });
    return api(c);
  }

  /* a caixa que esperava aparece (o conteúdo chegou ou a forma passou do tempo): já está no lugar e no tamanho; no
     celular, com o véu */
  function revelar(c) {
    if (!c.esperando) return;
    c.esperando = false;
    clearTimeout(c.relogioForma);
    c.c1.classList.remove('caixa-flutuante--esperando');
    /* o lugar com o conteúdo já dentro, antes de aparecer (sem esperar o quadro seguinte) */
    reposicionar(c);
    if (c.folha) porVeu(c);
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
      subirEspera(c.c1, el);
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
      subirEspera(c.c2, el);
      return;
    }
    fecharSegunda(c);
    var c2 = novaCaixa('');
    if (!c2) return;
    c2.classList.add('caixa-flutuante--segunda');
    c2.querySelector('.caixa-flutuante-corpo').appendChild(el);
    subirEspera(c2, el);
    /* o X no alto (no computador): fecha as duas, como o Esc (a página decide o que fica, aoFechar) */
    var x = c2.querySelector('.caixa-flutuante-fechar');
    if (x) {
      x.classList.remove('oculto');
      x.addEventListener('click', function () { if (podeFechar(c, x)) fecharDe(c, 'x'); });
    }
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
      subirEspera(c.c1, null);
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

  /* a marca passa para a peça nova (e para o que vai junto); a caixa vai atrás dela, e a caixa 2 atrás da caixa 1 (a peça
     nova pode ter outro tamanho, como o título que ganha o horário, e a caixa 1 anda sem mudar de tamanho) */
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
    if (c.c2 && c.lado2) RW.flutuante.posicionar(c.c1, c.c2, true, c.lado2);
  }

  /* ---------- fechar ---------- */

  /* o X e o Esc: a página pode segurar a caixa (aoTentarFechar devolve false: a resposta pela metade) */
  function podeFechar(c, alvo) {
    return !c.opcoes.aoTentarFechar || c.opcoes.aoTentarFechar(alvo) !== false;
  }

  /* como (a página fecha o que é dela, aoFechar): 'fora' (o clique fora), 'x', 'esc', 'voltar' (o Voltar do navegador)
     ou 'peca' (a peça que saiu); sem ele, a página mesma fechou, e não é avisada */
  function fecharDe(c, como) {
    if (atual !== c) return;
    atual = null;
    clearTimeout(c.relogioForma);
    marcar(c, false);
    [c.c1, c.c2, c.veu].forEach(function (e) {
      if (e) e.classList.remove('caixa-flutuante--aberta', 'caixa-flutuante-veu--aberto');
    });
    if (c.item) c.item.classList.remove('caixa-flutuante-item--escolhido');
    tirar([c.c1, c.c2, c.veu], function () { desligarTudo(c); });
    if (como && c.opcoes.aoFechar) c.opcoes.aoFechar(como);
  }

  function ligar() {
    if (ligado) return;
    ligado = true;
    document.addEventListener('click', function (ev) {
      var c = atual, t = ev.target;
      if (!c || !t || !t.closest) return;
      if (t.closest(DENTRO)) return;
      /* a caixa que ainda não apareceu (esperando o conteúdo): o clique fecha e segue para onde foi */
      if (c.esperando) { fecharDe(c, 'fora'); return; }
      /* a resposta pela metade (a página diz, aoClicarFora): a caixa fica, e o clique não faz mais nada */
      if (c.opcoes.aoClicarFora && c.opcoes.aoClicarFora(t) === false) {
        ev.stopPropagation();
        ev.preventDefault();
        return;
      }
      fecharDe(c, 'fora');
      /* o primeiro clique fora só fecha: não chega ao que está embaixo (os outros ouvintes do documento seguem) */
      if (t.closest(PASSA)) return;
      ev.stopPropagation();
      ev.preventDefault();
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !atual) return;
      if (document.querySelector('.dropdown--aberto, .modal-veu--aberto')) return;
      ev.preventDefault();   // o Esc foi da caixa: o painel atrás dela fica (geral-painel.js)
      if (podeFechar(atual, null)) fecharDe(atual, 'esc');
    });
    window.addEventListener('popstate', function () { if (atual) fecharDe(atual, 'voltar'); });
  }

  function api(c) {
    return {
      conteudo: function (el) {
        if (atual !== c) return;
        var corpo = c.c1.querySelector('.caixa-flutuante-corpo');
        c.formaEm = null;   // a forma sai com o conteúdo (o lugar se acerta pelo tamanho novo, geral-flutuante.js)
        if (c.guardado) { c.guardado.filhos = el ? [el] : []; return; }
        corpo.textContent = '';
        if (el) corpo.appendChild(el);
        if (el) revelar(c);
      },
      /* a forma que apareceu fica o mínimo na tela (não pisca): quantos ms ainda faltam (0: o conteúdo pode entrar) */
      faltaForma: function () { return c.formaEm != null && RW.etapas ? RW.etapas.faltaCaixa(c.formaEm) : 0; },
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
