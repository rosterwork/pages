(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* coleta os valores (folhas) de um nó da definição da árvore */
  function folhasDe(no, acc) {
    if (no.filhos && no.filhos.length) {
      no.filhos.forEach(function (f) { folhasDe(f, acc); });
    } else if (no.valor != null) {
      acc.push(no.valor);
    }
    return acc;
  }

  /* Cria um filtro em árvore de checkbox. Grupos marcam/desmarcam o grupo (com parcial);
     folhas marcam 1 valor. O interruptor mestre "Todos" (fora da árvore, acima de uma
     divisória) vale para as opções NORMAIS: marcado = todas elas (nada escolhido).
     Opção com `separado: true` (ex.: Inativos, Afastamentos) fica depois de uma divisória,
     fora do "Todos", e é um ACRÉSCIMO: "Todos" + ela = tudo e mais ela. Desmarcar o "Todos"
     com uma separada marcada = só as separadas. A seleção nunca fica vazia: sem nada,
     volta ao "Todos".
     Só com opções separadas (ex.: Escala completa, da Extrajornada), o "Todos" e as divisórias somem e fica só a caixa
     de cada uma.
     Usado pelo botão Filtros (geral-filtros), uma coluna por filtro.
     config: { arvoreEl, mestreEl, colapsarTudo, onChange }
     Devolve { definir(arvore), passa(valor), temFiltro(), desmarcar(valores), limpar(), resumo() }. */
  function criar(config) {
    var arvoreEl = config.arvoreEl;
    var mestreEl = config.mestreEl || null;
    var onChange = config.onChange || function () {};

    var selecionados = new Set();   /* as normais escolhidas (vazio = "Todos") e as separadas marcadas */
    var semNormais = false;         /* "Todos" desmarcado com só separadas: nenhuma normal passa */
    var pintores = [];     /* repintam as caixas da árvore conforme a seleção */
    var totalFolhas = 0;   /* folhas normais (as que contam para "Todos") */
    var separadas = new Set();   /* valores fora do "Todos" (ex.: Inativos) — divisória acima */
    var colapsarTudo = !!config.colapsarTudo;   /* marcar todas as normais = "Todos" (elas se desmarcam) */
    var assinatura = '';   /* evita reconstruir o DOM quando a árvore não muda */
    var arvoreAtual = [];  /* a última árvore definida (o resumo agrupa por ela) */

    function normaisMarcadas() {
      var n = 0;
      selecionados.forEach(function (v) { if (!separadas.has(v)) n++; });
      return n;
    }

    function separadasMarcadas() {
      var n = 0;
      selecionados.forEach(function (v) { if (separadas.has(v)) n++; });
      return n;
    }

    function tirarNormais() {
      Array.from(selecionados).forEach(function (v) { if (!separadas.has(v)) selecionados.delete(v); });
    }

    /* "Todos" (as normais todas): nada escolhido entre as normais (ou todas, fora do modo colapsar) */
    function todosNormais() {
      if (semNormais) return false;
      var n = normaisMarcadas();
      return n === 0 || (!colapsarTudo && n === totalFolhas);
    }

    /* depois de cada mudança: todas as normais marcadas viram "Todos" (modo colapsar); escolher uma
       normal desfaz o "só separadas"; e sem separada marcada não há "só separadas" (nunca vazio) */
    function arrumar() {
      if (colapsarTudo && totalFolhas > 0 && normaisMarcadas() === totalFolhas) tirarNormais();
      if (semNormais && (normaisMarcadas() > 0 || separadasMarcadas() === 0)) semNormais = false;
    }

    function molde() {
      var tpl = document.getElementById('tpl-filtro-no');
      return tpl ? tpl.content.cloneNode(true).firstElementChild : null;
    }

    /* há filtro de fato quando não é o padrão ("Todos", sem separada) */
    function temFiltro() {
      return !(todosNormais() && separadasMarcadas() === 0);
    }

    /* um valor passa no filtro? (separada: só marcada; normal: "Todos" ou escolhida) */
    function passa(valor) {
      if (separadas.has(valor)) return selecionados.has(valor);
      if (semNormais) return false;
      if (todosNormais()) return true;
      return selecionados.has(valor);
    }

    /* o que está marcado, para as etiquetas da linha "Filtros:": um grupo inteiro marcado vira um
       item só (ex.: "Praças"); as separadas vêm por último ("só Afastamentos" quando só elas valem).
       [{ rotulo, valores }] na ordem da árvore */
    function resumo() {
      var lista = [];
      function visitar(no) {
        if (no.filhos && no.filhos.length) {
          var folhas = folhasDe(no, []);
          if (folhas.length && folhas.every(function (v) { return selecionados.has(v); })) {
            lista.push({ rotulo: no.rotulo, valores: folhas });
          } else {
            no.filhos.forEach(visitar);
          }
        } else if (no.valor != null && selecionados.has(no.valor)) {
          lista.push({ rotulo: no.rotulo, valores: [no.valor] });
        }
      }
      if (!todosNormais()) arvoreAtual.forEach(function (no) { if (!no.separado) visitar(no); });
      arvoreAtual.forEach(function (no) {
        if (!no.separado || !selecionados.has(no.valor)) return;
        lista.push({ rotulo: semNormais ? RosterWork.mensagens.geral.filtroSo(no.rotulo) : no.rotulo, valores: [no.valor] });
      });
      return lista;
    }

    /* mestre "Todos": marcado quando valem todas as normais */
    function pintarMestre() {
      if (!mestreEl) return;
      var caixa = mestreEl.querySelector('.caixa-selecao');
      if (!caixa) return;
      caixa.classList.toggle('caixa-selecao--marcada', todosNormais());
      caixa.setAttribute('aria-checked', todosNormais() ? 'true' : 'false');
    }

    function pintar() {
      pintores.forEach(function (p) { p(); });
      pintarMestre();
    }

    function mudou() {
      arrumar();
      pintar();
      onChange();
    }

    function alternarValores(valores) {
      var todos = valores.every(function (v) { return selecionados.has(v); });
      valores.forEach(function (v) {
        if (todos) selecionados.delete(v); else selecionados.add(v);
      });
      mudou();
    }

    /* clique no "Todos": desmarcado → volta a todas as normais (as separadas ficam);
       marcado → com separada marcada, passa a "só as separadas"; sem separada, não muda (nunca vazio) */
    function alternarTodos() {
      if (todosNormais()) {
        if (separadasMarcadas() === 0) return;
        tirarNormais();
        semNormais = true;
      } else {
        tirarNormais();
        semNormais = false;
      }
      mudou();
    }

    /* volta ao padrão: "Todos", sem separada */
    function limpar() {
      if (!temFiltro()) return;
      selecionados.clear();
      semNormais = false;
      pintar();
      onChange();
    }

    /* desmarca os valores (o "x" da etiqueta na linha "Filtros:") */
    function desmarcar(valores) {
      var tirou = false;
      (valores || []).forEach(function (v) { if (selecionados.delete(v)) tirou = true; });
      if (tirou) mudou();
    }

    /* monta um filho (grupo ou folha), recursivo */
    function montarFilho(no) {
      var el = molde();
      if (!el) return null;
      var linha = el.querySelector('.arvore-linha');
      var caixa = el.querySelector('.caixa-selecao');
      el.querySelector('.arvore-nome').textContent = no.rotulo;

      if (no.filhos && no.filhos.length) {
        el.classList.add('arvore-grupo--aberto');
        var folhas = folhasDe(no, []);
        linha.addEventListener('click', function () { el.classList.toggle('arvore-grupo--aberto'); });
        caixa.addEventListener('click', function (evento) { evento.stopPropagation(); alternarValores(folhas); });
        pintores.push(function () {
          var marc = folhas.filter(function (v) { return selecionados.has(v); }).length;
          var tudo = folhas.length > 0 && marc === folhas.length;
          caixa.classList.toggle('caixa-selecao--marcada', tudo);
          caixa.classList.toggle('caixa-selecao--parcial', marc > 0 && !tudo);
          caixa.setAttribute('aria-checked', tudo ? 'true' : (marc > 0 ? 'mixed' : 'false'));
        });
        var filhosEl = el.querySelector('.arvore-filhos');
        no.filhos.forEach(function (f) {
          var fe = montarFilho(f);
          if (fe) filhosEl.appendChild(fe);
        });
      } else {
        el.querySelector('.arvore-seta').classList.add('arvore-seta--oculta');
        linha.addEventListener('click', function () { alternarValores([no.valor]); });
        pintores.push(function () {
          var sel = selecionados.has(no.valor);
          caixa.classList.toggle('caixa-selecao--marcada', sel);
          caixa.setAttribute('aria-checked', sel ? 'true' : 'false');
        });
      }
      return el;
    }

    /* (re)define a árvore; só reconstrói o DOM se a estrutura mudou */
    function definir(arvore) {
      arvore = arvore || [];
      arvoreAtual = arvore;
      var ass = JSON.stringify(arvore);
      if (ass !== assinatura) {
        assinatura = ass;
        var folhas = folhasDe({ filhos: arvore }, []);
        separadas = new Set();
        arvore.forEach(function (no) { if (no.separado && no.valor != null) separadas.add(no.valor); });
        totalFolhas = folhas.filter(function (v) { return !separadas.has(v); }).length;
        var validos = {};
        folhas.forEach(function (v) { validos[v] = true; });
        var podou = false;
        Array.from(selecionados).forEach(function (v) {
          if (!validos[v]) { selecionados.delete(v); podou = true; }
        });
        if (podou) arrumar();
        pintores = [];
        arvoreEl.textContent = '';
        /* só com opções separadas: sem o "Todos", sem a divisória dele e sem a das separadas */
        var soSeparadas = totalFolhas === 0;
        if (mestreEl) {
          mestreEl.classList.toggle('oculto', soSeparadas);
          var divisorMestre = mestreEl.nextElementSibling;
          if (divisorMestre && divisorMestre.classList.contains('dropdown-divisor')) divisorMestre.classList.toggle('oculto', soSeparadas);
        }
        var divisorPosto = soSeparadas;
        arvore.forEach(function (no) {
          /* uma divisória antes das opções separadas (ex.: Inativos) */
          if (no.separado && !divisorPosto) {
            var tplD = document.getElementById('tpl-filtro-divisor');
            if (tplD) arvoreEl.appendChild(tplD.content.cloneNode(true));
            divisorPosto = true;
          }
          var fe = montarFilho(no);
          if (fe) arvoreEl.appendChild(fe);
        });
        pintar();
        if (podou) onChange();   /* a seleção mudou: a página re-renderiza com o filtro já podado */
        return;
      }
      pintar();
    }

    /* liga uma vez o mestre "Todos" */
    if (mestreEl) mestreEl.addEventListener('click', alternarTodos);

    return {
      definir: definir,
      passa: passa,
      temFiltro: temFiltro,
      desmarcar: desmarcar,
      limpar: limpar,
      resumo: resumo
    };
  }

  window.RosterWork.filtroArvore = { criar: criar };
})();
