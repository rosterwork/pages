(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* ============================================================
     BUSCA — componente compartilhado do campo .busca (toda busca da
     barra: Escala, Extrajornada, Usuários e Folgas). Liga o
     alternador marcar ↔ filtrar, o input (com debounce), o limpar e,
     na barra, o Enter que vai ao achado, e chama de volta
     `aoBuscar(termo, modo)`. Casa por nome de guerra, nome completo,
     CPF e RG (helper `casaMilitar`). NÃO decide o que fazer com o
     resultado — cada página aplica o marcar/filtrar do seu jeito e
     marca o que casa com .busca-achado.
     ============================================================ */

  /* tira acentos e caixa para comparar sem diferença de acentuação */
  function normalizar(texto) {
    return String(texto || '').toLowerCase()
      .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c');
  }

  /* o militar casa com o termo? nome de guerra / nome completo (texto) ou CPF / RG (dígitos).
     `m` traz {nome|nome_de_guerra, nome_completo, cpf, rg} — os que não existirem são ignorados. */
  function casaMilitar(termo, m) {
    if (!termo || !m) return false;
    var alvo = normalizar(termo);
    if (normalizar(m.nome || m.nome_de_guerra).indexOf(alvo) !== -1) return true;
    if (m.nome_completo && normalizar(m.nome_completo).indexOf(alvo) !== -1) return true;
    var dig = String(termo).replace(/\D/g, '');
    if (dig) {
      if (String(m.cpf || '').replace(/\D/g, '').indexOf(dig) !== -1) return true;
      if (m.rg && String(m.rg).replace(/\D/g, '').indexOf(dig) !== -1) return true;
    }
    return false;
  }

  /* cria a busca a partir da caixa .busca (com input, botão de modo e limpar).
     config: { caixa, aoBuscar(termo, modo), debounce }
     Devolve { modo(), limpar() }. */
  function criar(config) {
    config = config || {};
    var caixa = config.caixa;
    if (!caixa) return null;
    var entrada = caixa.querySelector('.busca-entrada');
    var botaoModo = caixa.querySelector('button.busca-modo');   // só a busca com o alternador; a lupa sozinha (span) não troca o modo
    var limpar = caixa.querySelector('.busca-limpar');
    if (!entrada) return null;

    var termo = '';
    var modo = 'marcar';   /* 'marcar' (realça) | 'filtrar' (esconde quem não casa) */
    var timer = null;

    function avisar() { if (config.aoBuscar) config.aoBuscar(termo, modo); }

    if (botaoModo) {
      botaoModo.addEventListener('click', function () {
        modo = (modo === 'marcar') ? 'filtrar' : 'marcar';
        /* o ícone (lupa ou funil) acompanha a marca, no geral-busca.css */
        caixa.classList.toggle('busca--filtrando', modo === 'filtrar');
        botaoModo.setAttribute('data-dica', modo === 'marcar' ? 'Marcar' : 'Filtrar');
        zerarIda(caixa);
        avisar();
      });
    }

    entrada.addEventListener('input', function () {
      var valor = entrada.value.trim();
      caixa.classList.toggle('busca--com-texto', valor !== '');
      zerarIda(caixa);
      clearTimeout(timer);
      timer = setTimeout(function () { timer = null; termo = valor; avisar(); }, config.debounce || 250);
    });

    /* Enter, só na busca da barra: aplica já o que foi digitado (sem esperar a pausa) e vai ao próximo
       achado; Shift+Enter, ao anterior */
    entrada.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Enter' || !buscaDaBarra(caixa)) return;
      evento.preventDefault();
      var valor = entrada.value.trim();
      if (timer || valor !== termo) {
        clearTimeout(timer);
        timer = null;
        termo = valor;
        avisar();
      }
      if (termo) irAoAchado(caixa, evento.shiftKey ? -1 : 1);
    });

    if (limpar) {
      limpar.addEventListener('click', function () {
        entrada.value = '';
        termo = '';
        caixa.classList.remove('busca--com-texto');
        zerarIda(caixa);
        entrada.focus();
        avisar();
      });
    }

    /* limpar pedido pela página (ex.: ao sair da aba): zera sem pôr o cursor no campo e sem a
       pesquisa digitada antes voltar depois; vazia, a busca da barra fica recolhida no celular */
    return {
      modo: function () { return modo; },
      limpar: function () {
        clearTimeout(timer);
        timer = null;
        entrada.value = '';
        termo = '';
        caixa.classList.remove('busca--com-texto', 'busca--aberta');
        zerarIda(caixa);
        avisar();
      }
    };
  }

  /* string de busca de um militar, para pré-computar no atributo data-busca de uma linha:
     nome de guerra + nome completo (normalizados) + dígitos de CPF e RG */
  function chave(m) {
    if (!m) return '';
    return normalizar((m.nome || m.nome_de_guerra || '') + ' ' + (m.nome_completo || '')) + ' '
         + String(m.cpf || m.usuario_id || '').replace(/\D/g, '') + ' ' + String(m.rg || '').replace(/\D/g, '');
  }
  /* casa o termo contra uma string data-busca pré-computada (texto p/ nomes, dígitos p/ CPF/RG) */
  function casaTexto(termo, db) {
    if (!termo) return true;
    db = db || '';
    if (db.indexOf(normalizar(termo)) !== -1) return true;
    var dig = String(termo).replace(/\D/g, '');
    return !!dig && db.indexOf(dig) !== -1;
  }

  /* ---------- no celular: a busca da barra recolhida num botão de ícone ----------
     Na barra de controles a busca aparece como o quadrado da lupa (geral-busca.css). Tocar
     nela (ou chegar ao campo pelo Tab) abre o campo numa linha só dela, com o cursor dentro.
     Sem texto, recolhe ao sair do campo; com texto, fica aberta (a pesquisa continua valendo).
     Vale para toda busca de barra, ligada por criar() ou pela página. */
  function buscaDaBarra(elemento) {
    var caixa = elemento && elemento.closest ? elemento.closest('.busca') : null;
    return (caixa && caixa.closest('.pagina-subcabecalho')) ? caixa : null;
  }

  function noCelular() {
    return !!(window.RosterWork.celular && window.RosterWork.celular());
  }

  /* o toque na busca recolhida só abre: não troca o modo marcar/filtrar. Só o toque (ou clique)
     de verdade abre: clique feito por código não abre a busca */
  document.addEventListener('click', function (evento) {
    if (!evento.isTrusted) return;
    var caixa = buscaDaBarra(evento.target);
    if (!caixa || !noCelular() || caixa.classList.contains('busca--aberta')) return;
    evento.preventDefault();
    evento.stopPropagation();
    caixa.classList.add('busca--aberta');
    var entrada = caixa.querySelector('.busca-entrada');
    if (entrada) entrada.focus();
  }, true);

  document.addEventListener('focusin', function (evento) {
    var caixa = buscaDaBarra(evento.target);
    if (caixa && noCelular() && evento.target.classList.contains('busca-entrada')) caixa.classList.add('busca--aberta');
  });

  /* espera o foco chegar ao próximo: tocar no limpar ou no modo, dentro da busca, não recolhe */
  document.addEventListener('focusout', function (evento) {
    var caixa = buscaDaBarra(evento.target);
    if (!caixa || !caixa.classList.contains('busca--aberta')) return;
    setTimeout(function () {
      if (caixa.contains(document.activeElement)) return;
      var entrada = caixa.querySelector('.busca-entrada');
      if (!entrada || !entrada.value) caixa.classList.remove('busca--aberta');
    }, 0);
  });

  /* ---------- na barra: o Enter vai ao achado (como a busca de um PDF) ----------
     A tela marca o que casa com .busca-achado (sem visual próprio; no marcar e no filtrar). Enter vai ao
     próximo, Shift+Enter ao anterior, e depois do último volta ao primeiro. O da vez ganha
     .busca-achado--atual e a área rola até ele: o começo dele no alto, logo abaixo do que gruda, com a
     conta do abrir em hoje (RosterWork.periodo.rolarAteHoje). O contador (molde #tpl-busca-contador) diz
     "2 de 7" ou "Nenhum". Na Agenda do celular (uma unidade por tela), percorre as unidades na ordem do
     seletor, a começar pela da tela. Digitar, limpar ou trocar o modo recomeça. */
  var idas = new WeakMap();   // por busca: o achado da vez e a posição dele na lista

  /* os achados à vista na página da busca; na Agenda do celular, também os das outras unidades (escondidos
     só pela unidade), na ordem do seletor */
  function listarAchados(caixa) {
    var pagina = caixa.closest('.pagina');
    if (!pagina) return [];
    var seletor = window.RosterWork.seletorUnidade;
    var lista = [];
    Array.prototype.forEach.call(pagina.querySelectorAll('.busca-achado'), function (el, i) {
      var unidade = seletor ? seletor.unidadeDe(el) : null;
      if (el.getClientRects().length || (unidade !== null && !el.closest('.oculto'))) lista.push({ el: el, unidade: unidade, ordem: i });
    });
    if (seletor) {
      lista.sort(function (a, b) {
        var ua = a.unidade === null ? -1 : seletor.ordem(a.unidade);
        var ub = b.unidade === null ? -1 : seletor.ordem(b.unidade);
        return (ua - ub) || (a.ordem - b.ordem);
      });
    }
    return lista;
  }

  /* onde o primeiro Enter começa: no primeiro achado da unidade da tela (ou da seguinte que tiver); sem o
     seletor, no primeiro da página */
  function inicioDaLista(lista) {
    var seletor = window.RosterWork.seletorUnidade;
    var escolhida = seletor ? seletor.escolhida() : null;
    if (escolhida === null) return 0;
    var posicao = seletor.ordem(escolhida);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].unidade !== null && seletor.ordem(lista[i].unidade) >= posicao) return i;
    }
    return 0;
  }

  /* a área que rola o elemento num sentido: o ancestral mais perto com rolagem nesse sentido */
  function areaQueRola(el, horizontal) {
    for (var no = el.parentElement; no && no !== document.body; no = no.parentElement) {
      var estilo = getComputedStyle(no);
      var rolagem = horizontal ? estilo.overflowX : estilo.overflowY;
      var sobra = horizontal ? no.scrollWidth - no.clientWidth : no.scrollHeight - no.clientHeight;
      if ((rolagem === 'auto' || rolagem === 'scroll') && sobra > 0) return no;
    }
    return null;
  }

  /* do achado até a área, o que gruda no começo dela (as peças "sticky" ao lado do caminho: o cabeçalho,
     a coluna da esquerda, os títulos empilhados da árvore) e a peça de antes, cuja ponta fica à vista */
  function arredores(el, area, horizontal) {
    var lado = horizontal ? 'left' : 'top';
    var comeco = el.getBoundingClientRect()[lado];
    var fixos = [];
    var anterior = null;
    for (var no = el; no !== area && no.parentElement; no = no.parentElement) {
      for (var irmao = no.parentElement.firstElementChild; irmao; irmao = irmao.nextElementSibling) {
        var estilo = (irmao !== no && irmao.getClientRects().length) ? getComputedStyle(irmao) : null;
        if (estilo && estilo.position === 'sticky' && estilo[lado] !== 'auto') fixos.push(irmao);
      }
      /* a peça de antes: a mais perto, entre as que ficam antes dele nesse sentido (não a do lado) */
      for (var antes = no.previousElementSibling; antes && !anterior; antes = antes.previousElementSibling) {
        if (antes.getClientRects().length && getComputedStyle(antes).position !== 'sticky'
          && antes.getBoundingClientRect()[lado] < comeco - 1) anterior = antes;
      }
    }
    return { fixos: fixos, anterior: anterior };
  }

  /* rola até o achado: no alto (logo abaixo do que gruda) e, se ele não aparece inteiro, para o lado */
  function rolarAte(el) {
    if (!window.RosterWork.periodo) return;
    var area = areaQueRola(el, false);
    if (area) {
      var vertical = arredores(el, area, false);
      window.RosterWork.periodo.rolarAteHoje(area, el, vertical.anterior || el, { fixo: vertical.fixos });
    }
    var areaLado = areaQueRola(el, true);
    if (!areaLado) return;
    var lado = arredores(el, areaLado, true);
    var caixa = el.getBoundingClientRect();
    var caixaArea = areaLado.getBoundingClientRect();
    var coberto = 0;
    lado.fixos.forEach(function (peca) { coberto = Math.max(coberto, peca.getBoundingClientRect().right - caixaArea.left - areaLado.clientLeft); });
    var inicioVisivel = caixaArea.left + areaLado.clientLeft + coberto;
    var fimVisivel = caixaArea.left + areaLado.clientLeft + areaLado.clientWidth;
    if (caixa.left >= inicioVisivel && caixa.right <= fimVisivel) return;
    window.RosterWork.periodo.rolarAteHoje(areaLado, el, lado.anterior || el, { horizontal: true, fixo: lado.fixos });
  }

  /* "2 de 7" ou "Nenhum": o contador entra na busca, antes do limpar, no primeiro Enter */
  function mostrarContador(caixa, posicao, total) {
    var contador = caixa.querySelector('.busca-contador');
    if (!contador) {
      contador = window.RosterWork.tpl ? window.RosterWork.tpl('tpl-busca-contador') : null;
      if (!contador) return;
      caixa.insertBefore(contador, caixa.querySelector('.busca-limpar'));
    }
    contador.classList.remove('oculto');
    contador.querySelector('.busca-contador-achados').classList.toggle('oculto', !total);
    contador.querySelector('.busca-contador-nenhum').classList.toggle('oculto', !!total);
    contador.querySelector('.busca-contador-atual').textContent = String(posicao);
    contador.querySelector('.busca-contador-total').textContent = String(total);
  }

  /* vai ao achado seguinte (sentido 1) ou anterior (-1). Se a tela redesenhou e o da vez sumiu, segue pela
     posição dele */
  function irAoAchado(caixa, sentido) {
    var lista = listarAchados(caixa);
    var estado = idas.get(caixa) || { atual: null, posicao: -1 };
    if (estado.atual) estado.atual.classList.remove('busca-achado--atual');
    if (!lista.length) {
      idas.delete(caixa);
      mostrarContador(caixa, 0, 0);
      return;
    }
    var total = lista.length;
    var atual = -1;
    for (var i = 0; i < total; i++) {
      if (lista[i].el === estado.atual) { atual = i; break; }
    }
    if (atual === -1 && estado.posicao >= 0) atual = Math.min(estado.posicao, total - 1);
    var proximo = atual === -1
      ? (sentido > 0 ? inicioDaLista(lista) : (inicioDaLista(lista) - 1 + total) % total)
      : (atual + sentido + total) % total;
    var achado = lista[proximo];
    if (achado.unidade !== null) window.RosterWork.seletorUnidade.escolher(achado.unidade);
    achado.el.classList.add('busca-achado--atual');
    idas.set(caixa, { atual: achado.el, posicao: proximo });
    rolarAte(achado.el);
    mostrarContador(caixa, proximo + 1, total);
  }

  /* recomeça: tira o realce do achado da vez e esconde o contador */
  function zerarIda(caixa) {
    var estado = idas.get(caixa);
    if (estado && estado.atual) estado.atual.classList.remove('busca-achado--atual');
    idas.delete(caixa);
    var contador = caixa.querySelector('.busca-contador');
    if (contador) contador.classList.add('oculto');
  }

  window.RosterWork.busca = { criar: criar, normalizar: normalizar, casaMilitar: casaMilitar, chave: chave, casaTexto: casaTexto };
})();
