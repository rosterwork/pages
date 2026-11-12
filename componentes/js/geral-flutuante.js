/* ============================================================
   FLUTUANTE — posicionamento de painéis flutuantes (compartilhado)
   Coloca um painel ancorado num gatilho: abre no lado com mais espaço
   (flip), desliza para caber (shift), respeita o limite (o modal que
   contém o gatilho, ou a janela) e — opcionalmente — limita a altura
   ao espaço (o conteúdo rola por dentro). Mantém a posição ao rolar/
   redimensionar e quando o painel ou o gatilho mudam de tamanho, e
   avisa (aoSair) se o gatilho sair da tela.

   Usado por geral-dropdown.js, geral-calendario.js e
   geral-caixa-flutuante.js. Cada componente cuida do próprio
   abrir/fechar; aqui é só a posição.

   Os lados (opcoes.lado):
   - 'baixo' (o padrão): embaixo do gatilho, ou em cima sem espaço;
   - 'direita': ao lado, à direita (à esquerda sem espaço, ou de
     começo com preferirEsquerda), a opcoes.distancia do gatilho
     (negativa: cobre a borda dele); o alto na altura do
     opcoes.alinhar (ou do gatilho), mais o opcoes.deslocar (um
     número, ou uma função que recebe o retângulo do alinhar);
     opcoes.retangulo() troca o retângulo do gatilho (o tamanho
     final da peça que cresce);
   - 'sobre': por cima do gatilho, com o centro no dele;
   - 'ponto': o canto no opcoes.ponto ({ dx, dy } a partir do canto
     do gatilho), virando para o outro lado sem espaço.
   Fora o 'baixo', o painel cabe inteiro na janela (desliza para
   dentro) e marca .flutuante--esquerda quando abre à esquerda.

   API: RosterWork.flutuante.ancorar(gatilho, painel, opcoes) -> desligar()
        opcoes = { limitarAltura (padrão true), aoSair(), lado, distancia, alinhar, deslocar, retangulo, ponto,
                   preferirEsquerda (booleano ou função) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* só escreve a variável se mudou — evita disparos extras do ResizeObserver */
  function setVar(el, nome, valor) {
    if (el.style.getPropertyValue(nome) !== valor) el.style.setProperty(nome, valor);
  }

  /* limite onde o painel pode aparecer: o modal que contém o gatilho, ou a janela */
  function obterLimite(gatilho) {
    var modal = gatilho.closest('.modal');
    if (modal) {
      var r = modal.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }
    var doc = document.documentElement;
    return { top: 0, bottom: doc.clientHeight, left: 0, right: doc.clientWidth };
  }

  /* ao lado, por cima ou num ponto (ver o alto do arquivo) */
  function posicionarFora(gatilho, painel, opcoes) {
    var rect = opcoes.retangulo ? opcoes.retangulo() : gatilho.getBoundingClientRect();
    var lim = obterLimite(gatilho);
    var folga = 4;
    var largura = painel.offsetWidth, altura = painel.offsetHeight;
    var x, y, esquerda = false;
    setVar(painel, '--flutuante-w', rect.width + 'px');
    painel.classList.remove('flutuante--acima');
    if (opcoes.lado === 'sobre') {
      x = rect.left + (rect.width - largura) / 2;
      y = rect.top + (rect.height - altura) / 2;
    } else if (opcoes.lado === 'ponto') {
      var px = rect.left + opcoes.ponto.dx, py = rect.top + opcoes.ponto.dy;
      esquerda = px + largura > lim.right - folga;
      x = esquerda ? px - largura : px;
      y = py + altura > lim.bottom - folga ? py - altura : py;
    } else {
      var dist = opcoes.distancia != null ? opcoes.distancia : folga;
      var prefere = typeof opcoes.preferirEsquerda === 'function' ? opcoes.preferirEsquerda() : !!opcoes.preferirEsquerda;
      var cabeDireita = rect.right + dist + largura <= lim.right - folga;
      var cabeEsquerda = rect.left - dist - largura >= lim.left + folga;
      esquerda = prefere ? cabeEsquerda || !cabeDireita : !cabeDireita && cabeEsquerda;
      x = esquerda ? rect.left - dist - largura : rect.right + dist;
      var ref = opcoes.alinhar ? opcoes.alinhar.getBoundingClientRect() : rect;
      y = ref.top + (typeof opcoes.deslocar === 'function' ? opcoes.deslocar(ref) : (opcoes.deslocar || 0));
    }
    if (opcoes.lado !== 'sobre') {
      setVar(painel, '--flutuante-max-h', Math.round(lim.bottom - lim.top - 2 * folga) + 'px');
      if (x + largura > lim.right - folga) x = lim.right - largura - folga;
      if (x < lim.left + folga) x = lim.left + folga;
      if (y + altura > lim.bottom - folga) y = lim.bottom - altura - folga;
      if (y < lim.top + folga) y = lim.top + folga;
    }
    painel.classList.toggle('flutuante--esquerda', esquerda);
    setVar(painel, '--flutuante-x', Math.round(x) + 'px');
    setVar(painel, '--flutuante-top', Math.round(y) + 'px');
  }

  function posicionar(gatilho, painel, limitarAltura, opcoes) {
    if (opcoes && opcoes.lado && opcoes.lado !== 'baixo') { posicionarFora(gatilho, painel, opcoes); return; }
    var rect = gatilho.getBoundingClientRect();
    var lim = obterLimite(gatilho);
    var folga = 4;

    /* a largura do gatilho fica disponível (campos de seleção a usam) */
    setVar(painel, '--flutuante-w', rect.width + 'px');

    /* prefere ABAIXO; só abre para cima se não couber embaixo E couber melhor acima */
    var espacoAbaixo = lim.bottom - rect.bottom - folga;
    var espacoAcima = rect.top - lim.top - folga;
    var alturaDesejada = painel.scrollHeight;   /* altura natural do conteúdo (ignora o teto de rolagem) */
    /* abre para cima quando o conteúdo não cabe embaixo E há mais espaço em cima — vale com ou sem
       limite de altura */
    var acima = espacoAbaixo < alturaDesejada && espacoAcima > espacoAbaixo;

    /* altura máxima = espaço daquele lado (só quando o componente quer rolar por dentro) */
    if (limitarAltura) {
      var espaco = Math.max(80, Math.round(acima ? espacoAcima : espacoAbaixo));
      setVar(painel, '--flutuante-max-h', espaco + 'px');
    }

    /* horizontal: alinha pela esquerda do gatilho; desliza para caber no limite */
    var largura = painel.offsetWidth;
    var x = rect.left;
    if (x + largura > lim.right - folga) x = lim.right - largura - folga;
    if (x < lim.left + folga) x = lim.left + folga;
    setVar(painel, '--flutuante-x', Math.round(x) + 'px');

    /* âncora vertical: colada ao gatilho, no lado escolhido */
    if (acima) {
      painel.classList.add('flutuante--acima');
      setVar(painel, '--flutuante-bottom', Math.round(window.innerHeight - rect.top + folga) + 'px');
    } else {
      painel.classList.remove('flutuante--acima');
      setVar(painel, '--flutuante-top', Math.round(rect.bottom + folga) + 'px');
    }
  }

  function ancorar(gatilho, painel, opcoes) {
    opcoes = opcoes || {};
    var limitarAltura = opcoes.limitarAltura !== false;   /* padrão: limita a altura */

    painel.classList.add('flutuante');
    posicionar(gatilho, painel, limitarAltura, opcoes);

    /* reposiciona ao rolar/redimensionar; fecha (aoSair) se o gatilho saiu da tela (ou da página) */
    function aoMexer(evento) {
      /* rolar dentro do próprio painel não mexe na posição */
      if (evento && evento.target && evento.target.closest && evento.target.closest('.flutuante') === painel) return;
      var rect = gatilho.getBoundingClientRect();
      var doc = document.documentElement;
      if (!gatilho.isConnected || rect.bottom < 0 || rect.top > doc.clientHeight) {
        if (typeof opcoes.aoSair === 'function') opcoes.aoSair();
        return;
      }
      posicionar(gatilho, painel, limitarAltura, opcoes);
    }

    document.addEventListener('scroll', aoMexer, true);
    window.addEventListener('resize', aoMexer);
    var observador = window.ResizeObserver
      ? new ResizeObserver(function () { if (gatilho.isConnected) posicionar(gatilho, painel, limitarAltura, opcoes); })
      : null;
    /* o painel e o gatilho: o conteúdo que muda e a grade que se acomoda (o gatilho muda de tamanho) */
    if (observador) { observador.observe(painel); observador.observe(gatilho); }

    return function desligar() {
      document.removeEventListener('scroll', aoMexer, true);
      window.removeEventListener('resize', aoMexer);
      if (observador) observador.disconnect();
      painel.classList.remove('flutuante', 'flutuante--acima', 'flutuante--esquerda');
    };
  }

  window.RosterWork.flutuante = { ancorar: ancorar, posicionar: posicionar };
})();
