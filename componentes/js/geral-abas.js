(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Acessibilidade: aplica a semântica de aba uma vez por trilho (só single-select;
     o multi é botão de alternância, não um tablist). O leitor passa a anunciar
     "aba, selecionada". Idempotente (marca no próprio elemento, que é recriado a
     cada navegação no SPA). */
  function prepararAria(trilho) {
    if (trilho.hasAttribute('data-abas-multi') || trilho.dataset.ariaPronto) return;
    trilho.dataset.ariaPronto = '1';
    trilho.setAttribute('role', 'tablist');
    var abas = trilho.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      abas[i].setAttribute('role', 'tab');
      abas[i].setAttribute('aria-selected', abas[i].classList.contains('aba--ativa') ? 'true' : 'false');
    }
  }

  /* seleção única: marca como ativa só a aba clicada, dentro do trilho */
  function ativarUnica(trilho, aba) {
    var abas = trilho.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      var ativa = abas[i] === aba;
      abas[i].classList.toggle('aba--ativa', ativa);
      abas[i].setAttribute('aria-selected', ativa ? 'true' : 'false');
    }
  }

  /* multi-seleção: alterna a aba, mas nunca deixa o trilho sem nenhuma ativa */
  function alternarMulti(trilho, aba) {
    if (aba.classList.contains('aba--ativa')) {
      if (trilho.querySelectorAll('.aba--ativa').length > 1) aba.classList.remove('aba--ativa');
    } else {
      aba.classList.add('aba--ativa');
    }
  }

  /* ---------- o traço das abas (o menu) ----------
     Mede a aba ativa e grava a posição e a largura no trilho (dado calculado,
     REGRAS §5); o CSS desenha o traço. Um grupo [data-abas-grupo] tem um traço
     só, no contêiner. O seletor (.abas--seletor) e a multi-seleção não têm traço. */
  var agendados = new WeakSet();
  var observadorTamanho = window.ResizeObserver
    ? new ResizeObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) agendarTraco(donoDoTraco(entradas[i].target));
    })
    : null;

  function ehMenu(trilho) {
    return !trilho.classList.contains('abas--seletor') && !trilho.hasAttribute('data-abas-multi');
  }

  /* quem desenha o traço: o grupo, se houver; senão, o próprio trilho */
  function donoDoTraco(elemento) {
    return elemento.closest('[data-abas-grupo]') || elemento.closest('.abas');
  }

  function posicionarTraco(dono) {
    if (!dono.isConnected) return;
    var ativa = dono.querySelector('.aba--ativa:not(.oculto)');
    /* largura exata (com fração de pixel): o traço termina junto com o texto */
    var caixa = ativa ? ativa.getBoundingClientRect() : null;
    var largura = caixa ? caixa.width : 0;
    if (!largura) {
      dono.style.setProperty('--indicador-largura', '0px');
      return;
    }
    /* o traço anda junto com as abas quando o trilho rola (no celular): conta a rolagem */
    var deslocamento = caixa.left - dono.getBoundingClientRect().left + dono.scrollLeft;
    dono.style.setProperty('--indicador-x', deslocamento + 'px');
    dono.style.setProperty('--indicador-largura', largura + 'px');
    mostrarAtiva(dono, deslocamento, largura);
    /* o deslize liga só depois do primeiro desenho: a página abre com o traço no lugar */
    if (!dono.classList.contains('abas--deslizar')) {
      requestAnimationFrame(function () { dono.classList.add('abas--deslizar'); });
    }
  }

  /* no celular, as abas que não cabem rolam para o lado: a escolhida fica à vista, com o
     espaço entre as abas de folga para a vizinha aparecer */
  function mostrarAtiva(dono, inicio, largura) {
    if (!(window.RosterWork.celular && window.RosterWork.celular())) return;
    if (dono.scrollWidth <= dono.clientWidth) return;
    var folga = parseFloat(getComputedStyle(dono).columnGap) || 0;
    if (inicio - folga < dono.scrollLeft) {
      dono.scrollLeft = inicio - folga;
    } else if (inicio + largura + folga > dono.scrollLeft + dono.clientWidth) {
      dono.scrollLeft = inicio + largura + folga - dono.clientWidth;
    }
  }

  /* junta várias mudanças do mesmo quadro numa medida só */
  function agendarTraco(dono) {
    if (!dono || agendados.has(dono)) return;
    agendados.add(dono);
    requestAnimationFrame(function () {
      agendados.delete(dono);
      posicionarTraco(dono);
    });
  }

  /* liga o traço uma vez por dono (marca no elemento, recriado a cada navegação no SPA):
     acompanha a troca de aba (por clique ou pela própria página), o .oculto e o tamanho */
  function prepararTraco(trilho) {
    if (!ehMenu(trilho)) return;
    var dono = donoDoTraco(trilho);
    if (!dono.dataset.tracoPronto) {
      dono.dataset.tracoPronto = '1';
      new MutationObserver(function () { agendarTraco(dono); })
        .observe(dono, { attributes: true, attributeFilter: ['class'], subtree: true });
      if (observadorTamanho) {
        observadorTamanho.observe(dono);
        var abas = dono.querySelectorAll('.aba');
        for (var i = 0; i < abas.length; i++) observadorTamanho.observe(abas[i]);
      }
    }
    agendarTraco(dono);
  }

  /* um único ouvinte para as abas de todo o site (delegação no documento) —
     funciona inclusive nos fragmentos de página carregados depois */
  document.addEventListener('click', function (evento) {
    var aba = evento.target.closest('.aba');
    if (!aba) return;
    var trilho = aba.closest('.abas');
    if (!trilho) return;
    prepararAria(trilho);
    prepararTraco(trilho);
    if (trilho.hasAttribute('data-abas-multi')) {
      alternarMulti(trilho, aba);
    } else {
      ativarUnica(trilho, aba);
    }
    /* avisa quem quiser reagir (carregar o conteúdo da aba escolhida) */
    trilho.dispatchEvent(new CustomEvent('rosterwork:aba', { detail: { aba: aba } }));
  });

  /* ---------- no celular: o seletor da barra vira menu ----------
     Na barra de controles, o seletor de escolha única vira o menu suspenso "Opção ▾" (moldes
     #tpl-seletor-menu e #tpl-seletor-menu-item), logo depois dele. O seletor fica escondido
     (.abas--em-menu, geral-abas.css) e continua dono da escolha: tocar num item clica a aba
     dele, e a página reage como sempre. O menu acompanha o seletor: a opção escolhida, as
     opções escondidas e os números delas. A multisseleção fica como está. */

  /* o texto que a aba mostra, sem as partes escondidas (ex.: a contagem com .oculto) */
  function textoVisivel(elemento) {
    var texto = '';
    for (var i = 0; i < elemento.childNodes.length; i++) {
      var filho = elemento.childNodes[i];
      if (filho.nodeType === Node.TEXT_NODE) texto += filho.textContent;
      else if (filho.nodeType === Node.ELEMENT_NODE && !filho.classList.contains('oculto')) texto += ' ' + textoVisivel(filho) + ' ';
    }
    return texto.replace(/\s+/g, ' ').trim();
  }

  function prepararMenuDoCelular(trilho) {
    if (!trilho.classList.contains('abas--seletor') || trilho.hasAttribute('data-abas-multi')) return;
    if (trilho.dataset.menuPronto || !trilho.closest('.pagina-subcabecalho')) return;
    if (!(window.RosterWork.celular && window.RosterWork.celular())) return;
    var menu = window.RosterWork.tpl ? window.RosterWork.tpl('tpl-seletor-menu') : null;
    if (!menu) return;
    trilho.dataset.menuPronto = '1';
    var gatilho = menu.querySelector('.seletor');
    var texto = menu.querySelector('.seletor-texto');
    var lista = menu.querySelector('.dropdown-menu');

    function desenhar() {
      var ativa = trilho.querySelector('.aba--ativa');
      texto.textContent = ativa ? textoVisivel(ativa) : '';
      lista.textContent = '';
      Array.prototype.forEach.call(trilho.querySelectorAll('.aba'), function (aba) {
        if (aba.classList.contains('oculto')) return;
        var item = window.RosterWork.tpl('tpl-seletor-menu-item');
        item.textContent = textoVisivel(aba);
        item.classList.toggle('dropdown-item--ativo', aba === ativa);
        item.addEventListener('click', function () {
          aba.click();
          gatilho.focus();
        });
        lista.appendChild(item);
      });
    }

    trilho.classList.add('abas--em-menu');
    trilho.after(menu);
    new MutationObserver(desenhar).observe(trilho, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class']
    });
    desenhar();
  }

  /* açúcar para a página reagir à troca: aoTrocar(abaAtiva) roda quando a aba muda */
  function ligar(trilho, aoTrocar) {
    if (!trilho || !aoTrocar) return;
    prepararAria(trilho);
    prepararTraco(trilho);
    prepararMenuDoCelular(trilho);
    trilho.addEventListener('rosterwork:aba', function (evento) { aoTrocar(evento.detail.aba); });
  }

  window.RosterWork.abas = { ligar: ligar };
})();
