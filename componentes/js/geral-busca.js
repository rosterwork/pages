(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* ============================================================
     BUSCA — componente compartilhado do campo .busca (usado em
     Usuários, Extrajornada e Escala). Liga o alternador marcar ↔
     filtrar, o input (com debounce) e o limpar, e chama de volta
     `aoBuscar(termo, modo)`. Casa por nome de guerra, nome completo,
     CPF e RG (helper `casaMilitar`). NÃO decide o que fazer com o
     resultado — cada página aplica o marcar/filtrar do seu jeito.
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
    var botaoModo = caixa.querySelector('.busca-modo');
    var iconeMarcar = caixa.querySelector('.busca-modo-marcar');
    var iconeFiltrar = caixa.querySelector('.busca-modo-filtrar');
    var limpar = caixa.querySelector('.busca-limpar');
    if (!entrada) return null;

    var termo = '';
    var modo = 'marcar';   /* 'marcar' (realça) | 'filtrar' (esconde quem não casa) */
    var timer = null;

    function avisar() { if (config.aoBuscar) config.aoBuscar(termo, modo); }

    if (botaoModo) {
      botaoModo.addEventListener('click', function () {
        modo = (modo === 'marcar') ? 'filtrar' : 'marcar';
        if (iconeMarcar) iconeMarcar.classList.toggle('oculto', modo !== 'marcar');
        if (iconeFiltrar) iconeFiltrar.classList.toggle('oculto', modo !== 'filtrar');
        botaoModo.setAttribute('data-dica', modo === 'marcar' ? 'Marcar' : 'Filtrar');
        avisar();
      });
    }

    entrada.addEventListener('input', function () {
      var valor = entrada.value.trim();
      caixa.classList.toggle('busca--com-texto', valor !== '');
      clearTimeout(timer);
      timer = setTimeout(function () { termo = valor; avisar(); }, config.debounce || 250);
    });

    if (limpar) {
      limpar.addEventListener('click', function () {
        entrada.value = '';
        termo = '';
        caixa.classList.remove('busca--com-texto');
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
        entrada.value = '';
        termo = '';
        caixa.classList.remove('busca--com-texto', 'busca--aberta');
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

  window.RosterWork.busca = { criar: criar, normalizar: normalizar, casaMilitar: casaMilitar, chave: chave, casaTexto: casaTexto };
})();
