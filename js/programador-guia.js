/* ============================================================
   PROGRAMADOR — GUIA VISUAL (só programador)
   A aba Guia visual: o índice à esquerda escolhe a seção (uma por
   vez). As medidas azuis são lidas do tamanho REAL de cada peça
   marcada com data-cota; as tabelas leem os valores do próprio tema
   (o :root, o bloco do modo escuro e o bloco do celular); a
   prancheta Celular recebe a mesma troca de papéis que o bloco do
   celular faz no tema. Não cria HTML: clona os moldes das medidas
   e preenche com textContent; a posição vai por custom property.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var raiz = null;
  var secaoAtual = null;
  var tema = { computador: {}, escuro: {}, celular: {}, corte: '' };
  var observador = null;
  var agendado = false;

  /* ---------- leitura do tema (as regras escritas nos arquivos de CSS) ---------- */
  function copiarPapeis(estilo, destino) {
    for (var i = 0; i < estilo.length; i++) {
      var nome = estilo[i];
      if (nome.indexOf('--') === 0) destino[nome] = estilo.getPropertyValue(nome).trim();
    }
  }

  /* :root = computador (tema claro); html[data-tema="escuro"] = escuro;
     @media com max-width que redefine o :root ou o html (html[data-celular]) = celular */
  function lerTema() {
    var lido = { computador: {}, escuro: {}, celular: {}, corte: '' };
    var folhas = document.styleSheets;
    for (var i = 0; i < folhas.length; i++) {
      var regras = null;
      try { regras = folhas[i].cssRules; } catch (e) { regras = null; }
      if (!regras) continue;
      for (var j = 0; j < regras.length; j++) {
        var regra = regras[j];
        if (regra.selectorText === ':root') copiarPapeis(regra.style, lido.computador);
        else if (regra.selectorText === 'html[data-tema="escuro"]') copiarPapeis(regra.style, lido.escuro);
        else if (regra.media && regra.cssRules && /max-width/.test(regra.media.mediaText)) {
          for (var k = 0; k < regra.cssRules.length; k++) {
            if (!/^(:root|html|html\[data-celular\])$/.test(regra.cssRules[k].selectorText || '')) continue;
            copiarPapeis(regra.cssRules[k].style, lido.celular);
            lido.corte = regra.media.mediaText;
          }
        }
      }
    }
    return lido;
  }

  /* troca cada var(--x) pelo valor escrito de --x: primeiro no próprio bloco, depois no :root */
  function resolver(valor, bloco, profundidade) {
    if (profundidade > 6) return valor;
    return valor.replace(/var\((--[a-z0-9-]+)\)/g, function (trecho, nome) {
      var achado = (nome in bloco) ? bloco[nome] : tema.computador[nome];
      return achado == null ? trecho : resolver(achado, bloco, profundidade + 1);
    });
  }

  /* valor de um papel num aparelho/tema; sem redefinição, vale o do computador */
  function valorDoPapel(nome, coluna) {
    var bloco = tema[coluna] || tema.computador;
    var bruto = (nome in bloco) ? bloco[nome] : tema.computador[nome];
    if (bruto == null) return '';
    return resolver(bruto, bloco, 0);
  }

  function preencherTabelas() {
    var celulas = raiz.querySelectorAll('[data-guia-valor]');
    for (var i = 0; i < celulas.length; i++) {
      var nome = celulas[i].getAttribute('data-guia-valor');
      var coluna = celulas[i].getAttribute('data-guia-coluna') || 'computador';
      var valor = valorDoPapel(nome, coluna);
      celulas[i].textContent = valor;
      /* no celular, 100% é a largura da tela (o texto vem do molde) */
      var porExtenso = coluna === 'celular' && valor === '100%' ? RosterWork.tpl('tpl-guia-largura-tela') : null;
      if (porExtenso) {
        celulas[i].textContent = '';
        celulas[i].appendChild(porExtenso);
      }
      celulas[i].classList.toggle('guia-muda', coluna === 'celular' && valor !== valorDoPapel(nome, 'computador'));
    }
    var cortes = raiz.querySelectorAll('[data-guia-corte]');
    var largura = (tema.corte.match(/max-width:\s*(\d+px)/) || [])[1] || '';
    for (var c = 0; c < cortes.length; c++) cortes[c].textContent = largura;
  }

  /* a prancheta Celular troca os papéis como o bloco do celular faz no :root
     (só custom properties de tamanho, lidas do tema; nenhum número escrito aqui) */
  function aplicarCelular() {
    var pranchetas = raiz.querySelectorAll('.guia-prancheta--celular');
    var nomes = Object.keys(tema.celular);
    for (var i = 0; i < pranchetas.length; i++) {
      for (var j = 0; j < nomes.length; j++) pranchetas[i].style.setProperty(nomes[j], tema.celular[nomes[j]]);
    }
  }

  /* ---------- medidas azuis ---------- */
  function caixa(elemento, palco) {
    var r = elemento.getBoundingClientRect();
    var p = palco.getBoundingClientRect();
    /* o palco que rola para o lado leva a medida junto (soma o quanto rolou) */
    var x0 = p.left + palco.clientLeft - palco.scrollLeft, y0 = p.top + palco.clientTop - palco.scrollTop;
    return { esquerda: r.left - x0, topo: r.top - y0, direita: r.right - x0, base: r.bottom - y0, largura: r.width, altura: r.height };
  }

  function px(numero) { return Math.round(numero) + 'px'; }

  function colocar(palco, idMolde, classes, x, y, tamanho, texto) {
    var cota = RosterWork.tpl(idMolde);
    if (!cota) return null;
    for (var i = 0; i < classes.length; i++) cota.classList.add(classes[i]);
    cota.style.setProperty('--cota-x', Math.round(x) + 'px');
    cota.style.setProperty('--cota-y', Math.round(y) + 'px');
    if (tamanho != null) cota.style.setProperty('--cota-tamanho', Math.round(tamanho) + 'px');
    cota.querySelector('.guia-cota-valor').textContent = texto;
    palco.appendChild(cota);
    return cota;
  }

  /* o número saiu do palco por esse lado? (tela estreita, peça encostada na borda) */
  function saiDoPalco(cota, palco) {
    var n = cota.querySelector('.guia-cota-pilula').getBoundingClientRect();
    var p = palco.getBoundingClientRect();
    return n.left < p.left || n.right > p.right;
  }

  /* traço vertical do lado pedido; se o número não couber ao lado (tela estreita),
     ele sobe para cima do traço, no vão livre acima da peça */
  function vertical(palco, c, naDireita, topo, tamanho, texto) {
    var classes = naDireita ? ['guia-cota--vertical', 'guia-cota--direita'] : ['guia-cota--vertical'];
    var cota = colocar(palco, 'tpl-guia-cota', classes, naDireita ? c.direita + 10 : c.esquerda - 10, topo, tamanho, texto);
    if (cota && !palco.classList.contains('guia-palco--rolavel') && saiDoPalco(cota, palco)) cota.classList.add('guia-cota--numero-acima');
  }

  /* os dois primeiros filhos visíveis (para medir o vão entre eles) */
  function doisFilhos(elemento) {
    var filhos = [];
    for (var i = 0; i < elemento.children.length && filhos.length < 2; i++) {
      if (elemento.children[i].getClientRects().length) filhos.push(elemento.children[i]);
    }
    return filhos.length === 2 ? filhos : null;
  }

  /* nos desenhos em miniatura (as telas), o número vem do papel do tema
     (data-cota-papel) ou da peça real da casca (data-cota-real), não do desenho */
  function textoDaMedida(elemento, tipo, medido) {
    var papel = elemento.getAttribute('data-cota-papel');
    if (papel) return valorDoPapel(papel, elemento.closest('.guia-prancheta--celular') ? 'celular' : 'computador');
    var real = elemento.getAttribute('data-cota-real');
    var alvo = real ? document.querySelector(real) : null;
    if (alvo) return px(tipo === 'altura' ? alvo.getBoundingClientRect().height : alvo.getBoundingClientRect().width);
    return px(medido);
  }

  function medir(elemento, tipo, palco) {
    var c = caixa(elemento, palco);
    var lado = elemento.getAttribute('data-cota-lado') || '';
    var estilo = getComputedStyle(elemento);
    var filhos, a, b;
    /* o tamanho sem giro nem escala (o círculo de carregando gira); svg não tem offset* */
    var alturaPropria = elemento.offsetHeight != null ? elemento.offsetHeight : c.altura;
    var larguraPropria = elemento.offsetWidth != null ? elemento.offsetWidth : c.largura;
    var topoProprio = c.topo + (c.altura - alturaPropria) / 2;
    var esquerdaPropria = c.esquerda + (c.largura - larguraPropria) / 2;
    if (tipo === 'altura') {
      vertical(palco, c, lado === 'direita', topoProprio, alturaPropria, textoDaMedida(elemento, tipo, alturaPropria));
    } else if (tipo === 'largura') {
      var largo = textoDaMedida(elemento, tipo, larguraPropria);
      if (lado === 'acima') colocar(palco, 'tpl-guia-cota', ['guia-cota--horizontal', 'guia-cota--acima'], esquerdaPropria, c.topo - 10, larguraPropria, largo);
      else colocar(palco, 'tpl-guia-cota', ['guia-cota--horizontal'], esquerdaPropria, c.base + 10, larguraPropria, largo);
    } else if (tipo === 'respiro') {
      var inicio = c.esquerda + parseFloat(estilo.borderLeftWidth);
      var respiro = parseFloat(estilo.paddingLeft);
      colocar(palco, 'tpl-guia-cota', ['guia-cota--horizontal'], inicio, c.base + 10, respiro, px(respiro));
    } else if (tipo === 'vao') {
      filhos = doisFilhos(elemento);
      if (!filhos) return;
      a = caixa(filhos[0], palco); b = caixa(filhos[1], palco);
      colocar(palco, 'tpl-guia-cota', ['guia-cota--horizontal', 'guia-cota--acima'], a.direita, c.topo - 10, b.esquerda - a.direita, px(b.esquerda - a.direita));
    } else if (tipo === 'vao-vertical') {
      filhos = doisFilhos(elemento);
      if (!filhos) return;
      a = caixa(filhos[0], palco); b = caixa(filhos[1], palco);
      vertical(palco, c, true, a.base, b.topo - a.base, px(b.topo - a.base));
    } else if (tipo === 'letra') {
      if (lado === 'direita') colocar(palco, 'tpl-guia-cota-letra', ['guia-cota--ao-lado'], c.direita + 8, c.topo + c.altura / 2, null, px(parseFloat(estilo.fontSize)));
      else colocar(palco, 'tpl-guia-cota-letra', [], c.direita, c.base + 8, null, px(parseFloat(estilo.fontSize)));
    } else if (tipo === 'raio') {
      colocar(palco, 'tpl-guia-cota-raio', [], c.direita, c.topo - 24, null, estilo.borderTopLeftRadius);
    }
  }

  function desenhar() {
    agendado = false;
    if (!raiz || !secaoAtual) return;
    var antigas = raiz.querySelectorAll('.guia-cota');
    for (var i = 0; i < antigas.length; i++) antigas[i].parentNode.removeChild(antigas[i]);
    var secao = raiz.querySelector('.guia-secao[data-secao="' + secaoAtual + '"]');
    if (!secao || !secao.getClientRects().length) return;
    var marcadas = secao.querySelectorAll('[data-cota]');
    for (var j = 0; j < marcadas.length; j++) {
      var elemento = marcadas[j];
      var palco = elemento.closest('.guia-palco');
      if (!palco || !elemento.getClientRects().length) continue;
      var tipos = elemento.getAttribute('data-cota').split(' ');
      for (var t = 0; t < tipos.length; t++) if (tipos[t]) medir(elemento, tipos[t], palco);
    }
  }

  function agendarDesenho() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(desenhar);
  }

  /* ---------- índice: uma seção por vez ---------- */
  function mostrarSecao(nome) {
    secaoAtual = nome;
    var secoes = raiz.querySelectorAll('.guia-secao');
    for (var i = 0; i < secoes.length; i++) secoes[i].classList.toggle('oculto', secoes[i].getAttribute('data-secao') !== nome);
    var itens = raiz.querySelectorAll('.guia-item');
    for (var j = 0; j < itens.length; j++) itens[j].classList.toggle('lista-item--ativo', itens[j].getAttribute('data-secao') === nome);
    var documento = raiz.querySelector('.guia-documento');
    if (documento) documento.scrollTop = 0;
    agendarDesenho();
  }

  function ligarIndice() {
    var itens = raiz.querySelectorAll('.guia-item');
    for (var i = 0; i < itens.length; i++) {
      itens[i].addEventListener('click', function (evento) {
        mostrarSecao(evento.currentTarget.getAttribute('data-secao'));
      });
    }
  }

  /* os trilhos de abas dos exemplos ganham o traço da aba ativa */
  function ligarAbasDosExemplos() {
    if (!RosterWork.abas) return;
    var trilhos = raiz.querySelectorAll('.guia-secao .abas');
    for (var i = 0; i < trilhos.length; i++) RosterWork.abas.ligar(trilhos[i], function () {});
  }

  /* ---------- exemplos de verdade: os componentes montam as peças; os valores vêm do HTML ---------- */
  function nada() {}

  function numeros(texto) {
    return String(texto || '').split(' ').filter(Boolean).map(Number);
  }

  var montadores = {
    calendario: function (lugar) {
      if (!RosterWork.calendario) return;
      lugar.querySelectorAll('[data-guia-modo]').forEach(function (botao) {
        var modo = botao.getAttribute('data-guia-modo');
        RosterWork.calendario.ligar(botao, { obterModo: function () { return modo; }, aoEscolher: nada });
      });
    },
    horario: function (lugar) {
      if (!RosterWork.horario) return;
      var acoes = lugar.hasAttribute('data-acoes');
      var linha = RosterWork.horario.linha({
        hi: lugar.getAttribute('data-hi'), hf: lugar.getAttribute('data-hf'),
        erro: lugar.hasAttribute('data-erro'), fixo: lugar.hasAttribute('data-fixo'), desligado: lugar.hasAttribute('data-desligado'),
        aoRemover: acoes ? nada : null, aoAdicionar: acoes ? nada : null
      });
      if (linha) lugar.appendChild(linha);
    },
    'horario-leitura': function (lugar) {
      if (!RosterWork.horario) return;
      var leitura = RosterWork.horario.leitura(lugar.getAttribute('data-hi'), lugar.getAttribute('data-hf'));
      if (leitura) lugar.appendChild(leitura);
    },
    /* data-pedacos="08:00 20:00 classe texto; ..." (classe "-" = sem classe) */
    regua: function (lugar) {
      if (!RosterWork.horario) return;
      var regua = RosterWork.horario.criarRegua(lugar.getAttribute('data-variante'));
      if (!regua) return;
      var pedacos = (lugar.getAttribute('data-pedacos') || '').split(';').map(function (trecho) {
        var partes = trecho.trim().split(' ');
        return { hi: partes[0], hf: partes[1], classe: partes[2] && partes[2] !== '-' ? partes[2] : null, texto: partes.slice(3).join(' ') };
      });
      lugar.appendChild(regua);
      RosterWork.horario.regua(regua, pedacos);
    },
    'mini-calendario': function (lugar) {
      if (!RosterWork.miniCalendario) return;
      var estados = ['quer', 'nao', 'ocupado', 'hoje', 'selecionado', 'afastado'];
      RosterWork.miniCalendario.renderizar(lugar, {
        aoDia: function (botao, iso, data) {
          estados.forEach(function (estado) {
            if (numeros(lugar.getAttribute('data-' + estado)).indexOf(data.getDate()) < 0) return;
            botao.classList.add('mini-calendario-dia--' + estado);
            var texto = lugar.getAttribute('data-texto-' + estado);
            if (texto != null) botao.querySelector('.mini-calendario-texto').textContent = texto;
          });
        }
      });
    },
    /* cada lugar de filtro traz as opções em data-guia-opcoes="A;B" */
    filtros: function (lugar) {
      if (!RosterWork.filtros) return;
      var opcoes = {};
      lugar.querySelectorAll('[data-filtro]').forEach(function (filtro) {
        opcoes[filtro.getAttribute('data-filtro')] = (filtro.getAttribute('data-guia-opcoes') || '').split(';').map(function (rotulo) {
          return { rotulo: rotulo, valor: rotulo };
        });
      });
      var api = RosterWork.filtros.criar(lugar, {});
      if (!api) return;
      Object.keys(opcoes).forEach(function (chave) { api.definir(chave, opcoes[chave]); });
    },
    busca: function (lugar) {
      if (RosterWork.busca) RosterWork.busca.criar({ caixa: lugar });
    },
    legenda: function (lugar) {
      if (!RosterWork.legenda) return;
      var legenda = RosterWork.legenda.montar(lugar);
      var conteudo = legenda && legenda.querySelector('[data-legenda-conteudo]');
      var texto = RosterWork.tpl('tpl-guia-legenda');
      if (conteudo && texto) conteudo.appendChild(texto);
    }
  };

  function montarExemplos() {
    var lugares = raiz.querySelectorAll('[data-guia-exemplo]');
    for (var i = 0; i < lugares.length; i++) {
      var montar = montadores[lugares[i].getAttribute('data-guia-exemplo')];
      if (montar) montar(lugares[i]);
    }
  }

  /* ---------- entrada ---------- */
  function iniciar(conteudo) {
    raiz = conteudo.querySelector('[data-aba-painel="guia"]');
    if (!raiz) return;
    tema = lerTema();
    preencherTabelas();
    aplicarCelular();
    ligarIndice();
    montarExemplos();
    ligarAbasDosExemplos();
    if (observador) observador.disconnect();
    var documento = raiz.querySelector('.guia-documento');
    if (documento && window.ResizeObserver) {
      observador = new ResizeObserver(agendarDesenho);
      observador.observe(documento);
    }
    var primeiro = raiz.querySelector('.guia-item');
    if (primeiro) mostrarSecao(primeiro.getAttribute('data-secao'));
  }

  /* a aba ficou visível: mede de novo (e de novo quando a fonte terminar de carregar) */
  function mostrar() {
    agendarDesenho();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(agendarDesenho);
  }

  window.RosterWork.programadorGuia = { iniciar: iniciar, mostrar: mostrar };
})();
