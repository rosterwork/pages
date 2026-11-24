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

  /* com mais opções que isto, os grupos começam fechados e aparece o campo Procurar */
  var OPCOES_PARA_PROCURAR = 10;

  /* Cria um filtro em árvore de checkbox. Grupos marcam/desmarcam o grupo (com parcial);
     folhas marcam 1 valor. O interruptor mestre "Todos" (fora da árvore, acima de uma
     divisória) vale para as opções NORMAIS: marcado = todas elas (nada escolhido).
     Opção com `separado: true` (ex.: Incluir afastados, Incluir inativos) fica depois de uma
     divisória, fora do "Todos", e é um ACRÉSCIMO: "Todos" + ela = tudo e mais ela. O "Todos"
     marcado não se desmarca: a seleção nunca fica vazia.
     Só com opções separadas, o "Todos" e as divisórias somem e fica só a caixa de cada uma.
     A separada com `padrao: true` (ex.: Incluir operação verão, na Escala) começa marcada e
     marcada é o normal: não conta como filtro; desmarcada, a etiqueta diz `rotuloSem` (ex.: "Sem
     operação verão") e o "x" dela e o Limpar a marcam de novo. A escolha guardada na sessão
     (restaurar) vale no lugar do padrão.
     Com mais de OPCOES_PARA_PROCURAR opções, os grupos começam fechados e o campo Procurar
     (procurarEl) aparece no alto.
     Usado pelo botão Filtros (geral-filtros), uma coluna por filtro.
     config: { arvoreEl, mestreEl, procurarEl, colapsarTudo, onChange }
     Devolve { definir(arvore), passa(valor), temFiltro(), tirar(valores), limpar(), resumo(),
     selecao(), restaurar(valores) }. */
  function criar(config) {
    var arvoreEl = config.arvoreEl;
    var mestreEl = config.mestreEl || null;
    var procurarEl = config.procurarEl || null;
    var onChange = config.onChange || function () {};

    var selecionados = new Set();   /* as normais escolhidas (vazio = "Todos") e as separadas marcadas */
    var gruposAbertos = true;       /* os grupos nascem abertos, menos com muitas opções */
    var pintores = [];     /* repintam as caixas da árvore conforme a seleção */
    var totalFolhas = 0;   /* folhas normais (as que contam para "Todos") */
    var separadas = new Set();   /* valores fora do "Todos" (ex.: Incluir inativos) — divisória acima */
    var padroes = new Set();     /* as separadas marcadas por padrão (padrao: true) */
    var escolhida = false;       /* a escolha guardada já veio (restaurar) ou o padrão já entrou: o padrão não entra de novo */
    var colapsarTudo = !!config.colapsarTudo;   /* marcar todas as normais = "Todos" (elas se desmarcam) */
    var assinatura = '';   /* evita reconstruir o DOM quando a árvore não muda */
    var arvoreAtual = [];  /* a última árvore definida (o resumo agrupa por ela) */

    function normaisMarcadas() {
      var n = 0;
      selecionados.forEach(function (v) { if (!separadas.has(v)) n++; });
      return n;
    }

    /* as separadas estão como o padrão (as de padrão marcadas, as outras não) */
    function separadasNoPadrao() {
      return Array.from(separadas).every(function (v) { return selecionados.has(v) === padroes.has(v); });
    }

    function tirarNormais() {
      Array.from(selecionados).forEach(function (v) { if (!separadas.has(v)) selecionados.delete(v); });
    }

    /* "Todos" (as normais todas): nada escolhido entre as normais (ou todas, fora do modo colapsar) */
    function todosNormais() {
      var n = normaisMarcadas();
      return n === 0 || (!colapsarTudo && n === totalFolhas);
    }

    /* depois de cada mudança: todas as normais marcadas viram "Todos" (modo colapsar) */
    function arrumar() {
      if (colapsarTudo && totalFolhas > 0 && normaisMarcadas() === totalFolhas) tirarNormais();
    }

    function molde() {
      var tpl = document.getElementById('tpl-filtro-no');
      return tpl ? tpl.content.cloneNode(true).firstElementChild : null;
    }

    /* há filtro de fato quando não é o padrão ("Todos", só com as separadas de padrão marcadas) */
    function temFiltro() {
      return !(todosNormais() && separadasNoPadrao());
    }

    /* um valor passa no filtro? (separada: só marcada; normal: "Todos" ou escolhida) */
    function passa(valor) {
      if (separadas.has(valor)) return selecionados.has(valor);
      if (todosNormais()) return true;
      return selecionados.has(valor);
    }

    /* o que está marcado, para as etiquetas da linha "Filtros:": um grupo inteiro marcado vira um
       item só (ex.: "Praças"); as separadas vêm por último (a de padrão, só desmarcada, com o rotuloSem).
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
        if (!no.separado || selecionados.has(no.valor) === padroes.has(no.valor)) return;
        lista.push({ rotulo: padroes.has(no.valor) ? (no.rotuloSem || no.rotulo) : no.rotulo, valores: [no.valor] });
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

    /* clique no "Todos": desmarcado → volta a todas as normais (as separadas ficam); marcado → não muda (nunca vazio) */
    function alternarTodos() {
      if (todosNormais()) return;
      tirarNormais();
      mudou();
    }

    /* volta ao padrão: "Todos", só com as separadas de padrão marcadas */
    function limpar() {
      if (!temFiltro()) return;
      selecionados = new Set(padroes);
      pintar();
      onChange();
    }

    /* o que está escolhido, para guardar na sessão (geral-filtros) */
    function selecao() {
      return Array.from(selecionados);
    }

    /* põe de volta a escolha guardada, antes ou depois de as opções chegarem (o que não existir mais sai no
       próximo definir com opções) */
    function restaurar(valores) {
      selecionados = new Set(valores || []);
      escolhida = true;
      pintar();
    }

    /* abre ou fecha um grupo; a seta diz ao leitor de tela se ele está aberto */
    function abrirGrupo(el, aberto) {
      el.classList.toggle('arvore-grupo--aberto', aberto);
      var seta = el.querySelector('.arvore-seta');
      if (seta) seta.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    }

    /* o Procurar: fica a opção cujo nome casa com o texto (sem acento e sem maiúscula, a regra da busca da barra);
       o grupo que casa mostra os filhos, e o que tem filho que casa abre */
    function procurar() {
      if (!procurarEl) return;
      var termo = procurarEl.value.trim();
      var busca = window.RosterWork.busca;
      function casa(nome) { return !termo || !busca || busca.casaTexto(termo, busca.normalizar(nome)); }
      function visitar(el, paiCasa) {
        var proprio = paiCasa || casa(el.querySelector('.arvore-nome').textContent);
        var algum = false;
        Array.prototype.forEach.call(el.querySelectorAll(':scope > .arvore-filhos > .arvore-grupo'), function (filho) {
          if (visitar(filho, proprio)) algum = true;
        });
        el.classList.toggle('oculto', !(proprio || algum));
        if (termo && algum) abrirGrupo(el, true);
        return proprio || algum;
      }
      Array.prototype.forEach.call(arvoreEl.querySelectorAll(':scope > .arvore-grupo'), function (el) { visitar(el, false); });
    }

    /* tira o filtro da etiqueta (o "x" na linha "Filtros:"): desmarca os valores; a separada de padrão desmarcada volta a
       ficar marcada */
    function tirar(valores) {
      var tirou = false;
      (valores || []).forEach(function (v) {
        if (padroes.has(v) && !selecionados.has(v)) { selecionados.add(v); tirou = true; }
        else if (selecionados.delete(v)) tirou = true;
      });
      if (tirou) mudou();
    }

    /* monta um filho (grupo ou folha), recursivo */
    function montarFilho(no) {
      var el = molde();
      if (!el) return null;
      var linha = el.querySelector('.arvore-linha');
      var caixa = el.querySelector('.caixa-selecao');
      var seta = el.querySelector('.arvore-seta');
      el.querySelector('.arvore-nome').textContent = no.rotulo;
      caixa.setAttribute('aria-label', no.rotulo);   // o nome da opção para o leitor de tela
      if (no.valor != null) el.setAttribute('data-filtro-valor', no.valor);   // por onde o treino acha a opção

      if (no.filhos && no.filhos.length) {
        abrirGrupo(el, gruposAbertos);
        var folhas = folhasDe(no, []);
        linha.addEventListener('click', function () { abrirGrupo(el, !el.classList.contains('arvore-grupo--aberto')); });
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
        seta.classList.add('arvore-seta--oculta');
        seta.removeAttribute('aria-expanded');
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
        padroes = new Set();
        arvore.forEach(function (no) {
          if (no.separado && no.valor != null) separadas.add(no.valor);
          if (no.separado && no.padrao && no.valor != null) padroes.add(no.valor);
        });
        /* as primeiras opções: sem escolha guardada, as separadas de padrão entram marcadas */
        if (folhas.length && !escolhida) {
          padroes.forEach(function (v) { selecionados.add(v); });
          escolhida = true;
        }
        totalFolhas = folhas.filter(function (v) { return !separadas.has(v); }).length;
        var validos = {};
        folhas.forEach(function (v) { validos[v] = true; });
        /* sai da escolha o que não está entre as opções; a árvore vazia (sem dados ainda) não tira nada, para a
           escolha guardada esperar as opções chegarem */
        var podou = false;
        if (folhas.length) {
          Array.from(selecionados).forEach(function (v) {
            if (!validos[v]) { selecionados.delete(v); podou = true; }
          });
        }
        if (podou) arrumar();
        gruposAbertos = folhas.length <= OPCOES_PARA_PROCURAR;
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
          /* uma divisória antes das opções separadas (ex.: Incluir inativos) */
          if (no.separado && !divisorPosto) {
            var tplD = document.getElementById('tpl-filtro-divisor');
            if (tplD) arvoreEl.appendChild(tplD.content.cloneNode(true));
            divisorPosto = true;
          }
          var fe = montarFilho(no);
          if (fe) arvoreEl.appendChild(fe);
        });
        /* o Procurar só com muitas opções; o texto que já estava continua valendo na árvore nova */
        if (procurarEl) {
          procurarEl.classList.toggle('oculto', gruposAbertos);
          if (gruposAbertos) procurarEl.value = '';
          procurar();
        }
        pintar();
        if (podou) onChange();   /* a seleção mudou: a página re-renderiza com o filtro já podado */
        return;
      }
      pintar();
    }

    /* liga uma vez o mestre "Todos" e o Procurar */
    if (mestreEl) mestreEl.addEventListener('click', alternarTodos);
    if (procurarEl) procurarEl.addEventListener('input', procurar);

    return {
      definir: definir,
      passa: passa,
      temFiltro: temFiltro,
      tirar: tirar,
      limpar: limpar,
      resumo: resumo,
      selecao: selecao,
      restaurar: restaurar
    };
  }

  window.RosterWork.filtroArvore = { criar: criar };
})();
