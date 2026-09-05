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

  /* Cria um filtro em árvore de checkbox. O interruptor mestre "Todos" (fora da
     árvore, acima de uma divisória) fica marcado quando NADA ou TUDO está selecionado;
     clicar nele limpa. Grupos marcam/desmarcam o grupo (com parcial); folhas marcam 1 valor.
     config: { arvoreEl, mestreEl, gatilhoEl, triggerEl, limparEl, rotuloVazio, plural, onChange }
     Devolve { definir(arvore), selecionados(), temFiltro() }. */
  function criar(config) {
    var arvoreEl = config.arvoreEl;
    var mestreEl = config.mestreEl || null;
    var gatilho = config.gatilhoEl || null;
    var triggerEl = config.triggerEl || null;
    var limparEl = config.limparEl || null;
    var rotuloVazio = config.rotuloVazio || 'Todos';
    var plural = config.plural || 'itens';
    var onChange = config.onChange || function () {};

    var selecionados = new Set();
    var rotulos = {};      /* valor -> rótulo (resumo de 1 selecionado) */
    var pintores = [];     /* repintam as caixas da árvore conforme a seleção */
    var totalFolhas = 0;   /* folhas que contam para "Todos" (exclui as separadas) */
    var separadas = new Set();   /* valores fora do "Todos" (ex.: Inativos) — divisória acima */
    var colapsarTudo = !!config.colapsarTudo;   /* marcar todos os normais = limpar (só "Todos" fica) */
    var assinatura = '';   /* evita reconstruir o DOM quando a árvore não muda */

    /* quantos dos NORMAIS (não separados) estão selecionados */
    function normaisSelecionados() {
      var n = 0;
      selecionados.forEach(function (v) { if (!separadas.has(v)) n++; });
      return n;
    }

    function molde() {
      var tpl = document.getElementById('tpl-filtro-no');
      return tpl ? tpl.content.cloneNode(true).firstElementChild : null;
    }

    /* "mostra tudo" (sem filtro): no modo colapsar, só quando nada está selecionado
       (marcar todos os normais colapsa para vazio); senão, vazio ou tudo selecionado */
    function mostraTudo() {
      return colapsarTudo ? (selecionados.size === 0) : (selecionados.size === 0 || selecionados.size === totalFolhas);
    }

    /* há filtro de fato quando a seleção não é "mostra tudo" */
    function temFiltro() {
      return !mostraTudo();
    }

    function atualizarGatilho() {
      if (gatilho) {
        var n = selecionados.size;
        if (mostraTudo()) gatilho.textContent = rotuloVazio;
        else if (n === 1) gatilho.textContent = rotulos[Array.from(selecionados)[0]] || (n + ' ' + plural);
        else gatilho.textContent = n + ' ' + plural;
      }
      if (triggerEl) triggerEl.classList.toggle('seletor--com-filtro', temFiltro());
    }

    /* mestre "Todos": marcado quando mostra tudo */
    function pintarMestre() {
      if (!mestreEl) return;
      var caixa = mestreEl.querySelector('.caixa-selecao');
      if (!caixa) return;
      caixa.classList.toggle('caixa-selecao--marcada', mostraTudo());
      caixa.setAttribute('aria-checked', mostraTudo() ? 'true' : 'false');
    }

    function pintar() {
      pintores.forEach(function (p) { p(); });
      pintarMestre();
      atualizarGatilho();
    }

    function alternarValores(valores) {
      var todos = valores.every(function (v) { return selecionados.has(v); });
      valores.forEach(function (v) {
        if (todos) selecionados.delete(v); else selecionados.add(v);
      });
      /* colapsar: selecionou todos os normais = igual a "Todos" → limpa os normais
         (mantém os separados, ex.: Inativos, que são um acréscimo independente) */
      if (colapsarTudo && totalFolhas > 0 && normaisSelecionados() === totalFolhas) {
        Array.from(selecionados).forEach(function (v) { if (!separadas.has(v)) selecionados.delete(v); });
      }
      pintar();
      onChange();
    }

    function limpar() {
      if (selecionados.size === 0) return;
      selecionados.clear();
      pintar();
      onChange();
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
        rotulos[no.valor] = no.rotulo;
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
        pintores = [];
        rotulos = {};
        arvoreEl.textContent = '';
        var divisorPosto = false;
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

    /* liga uma vez os controles fixos: o mestre "Todos" e o "x" do gatilho (ambos limpam) */
    if (mestreEl) mestreEl.addEventListener('click', function () { limpar(); });
    if (limparEl) limparEl.addEventListener('click', function (evento) {
      evento.stopPropagation();
      limpar();
    });

    return {
      definir: definir,
      selecionados: function () { return selecionados; },
      temFiltro: temFiltro
    };
  }

  window.RosterWork.filtroArvore = { criar: criar };
})();
