/* ============================================================
   ESCALAS — modo Mês / Calendário (dados)
   Busca a escala do mês (RPC ler_escala_mes) e desenha o calendário
   pelo componente compartilhado geral-calendario-mes, preenchendo
   cada dia — via o gancho aoDia — com, por unidade, a MESMA célula
   do Mês → Agenda (escalas-celula.js: gráfico de cobertura + lista).
   A célula reusa `.escala-mes-celula`, então o painel (escalas-painel.js)
   abre e realça sem mudança. Não escreve estilo CSS.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var maxGlobalAtual = 0;   // pico de cobertura da renderização atual (reusado no refresh de uma célula)
  var reqSeq = 0;           // token de requisição: ignora resposta antiga quando outra render começou


  function dataISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function mostrarEstado(corpo, texto) {
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-estado');
    if (!no) return;
    no.textContent = texto;
    corpo.appendChild(no);
  }

  function mostrarCarregando(corpo) {
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-carregando');
    if (no) corpo.appendChild(no);
  }

  /* preenche a célula de UM dia (calendário) com, por unidade, a célula do Mês */
  function preencherDia(celulaDia, iso, colunas, dados, cobertura, erro, conflito, maxGlobal) {
    colunas.forEach(function (c) {
      var bloco = RosterWork.tpl('tpl-escala-calendario-unidade');
      if (!bloco) return;
      bloco.querySelector('.escala-calendario-unidade-nome').textContent = c.nome;
      var cel = bloco.querySelector('.escala-mes-celula');
      cel.dataset.iso = iso;
      cel.dataset.unidadeId = c.id;
      cel.dataset.unidadeNome = c.nomePainel || c.nome;
      cel.dataset.unidadeCidade = c.cidade || '';
      var pessoas = (dados[c.id] && dados[c.id][iso]) || [];
      var cobDia = (cobertura[c.id] && cobertura[c.id][iso]) || null;
      var erroDia = (erro[c.id] && erro[c.id][iso]) || null;
      var conflitoDia = !!(conflito[c.id] && conflito[c.id][iso]);
      if (RosterWork.escalasCelula) RosterWork.escalasCelula.preencherCelula(cel, cobDia, erroDia, conflitoDia, pessoas, maxGlobal);
      celulaDia.appendChild(bloco);
    });
  }

  /* desenha o mês de opcoes.dataRef como calendário, com a escala em cada dia */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    var colunas = (opcoes && opcoes.colunas) || [];
    var dataRef = (opcoes && opcoes.dataRef) || new Date();

    if (!colunas.length) {
      mostrarEstado(corpo, 'Selecione uma companhia ou pelotão no seletor de unidades.');
      return;
    }
    if (!window.RosterWork.escalasDados || !window.RosterWork.geralCalendarioMes) {
      mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
      return;
    }

    mostrarCarregando(corpo);

    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var inicio = dataISO(new Date(ano, mes, 1));
    var fim = dataISO(new Date(ano, mes + 1, 0));
    var ids = colunas.map(function (c) { return c.id; });

    var req = ++reqSeq;
    window.RosterWork.escalasDados.carregar(ids, inicio, fim).then(function (resultado) {
      if (!document.contains(corpo) || req !== reqSeq || (opcoes.vigente && !opcoes.vigente())) return;   // saiu da página, outra render começou, ou trocou de modo
      var dados = resultado.militares;
      var cobertura = resultado.cobertura || {};
      var erro = resultado.erro || {};
      var conflito = resultado.conflito || {};
      var maxGlobal = RosterWork.escalasCelula ? RosterWork.escalasCelula.calcularMaxGlobal(cobertura, ids) : 0;
      maxGlobalAtual = maxGlobal;

      /* o componente monta a grade e chama aoDia por dia; só preenchemos os dias do mês exibido
         (os de outro mês ficam só com o número apagado, como calendário tradicional) */
      RosterWork.geralCalendarioMes.renderizar(corpo, {
        dataRef: dataRef,
        aoDia: function (celulaDia, data, noMes) {
          if (!noMes) return;
          preencherDia(celulaDia, dataISO(data), colunas, dados, cobertura, erro, conflito, maxGlobal);
        }
      });

      var wrap = corpo.querySelector('.geral-calendario-mes');
      if (wrap && RosterWork.escalasCelula) RosterWork.escalasCelula.ativarGraficos(wrap);
    }, function () {
      if (document.contains(corpo) && req === reqSeq && (!opcoes.vigente || opcoes.vigente())) mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  /* refresh de uma única célula (unidade × dia) após salvar no painel — igual ao Mês/Semana,
     mas na grade do calendário; só age se o calendário estiver na tela */
  function atualizarCelula(unidadeId, iso) {
    if (!window.RosterWork.escalasDados || !window.RosterWork.escalasCelula) return;
    var wrap = document.querySelector('.geral-calendario-mes');
    if (!wrap) return;
    var celula = wrap.querySelector('.escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]');
    if (!celula) return;
    window.RosterWork.escalasDados.carregar([unidadeId], iso, iso).then(function (r) {
      if (!document.contains(celula)) return;
      var cobDia = (r.cobertura[unidadeId] && r.cobertura[unidadeId][iso]) || null;
      var erroDia = (r.erro[unidadeId] && r.erro[unidadeId][iso]) || null;
      var conflitoDia = !!(r.conflito[unidadeId] && r.conflito[unidadeId][iso]);
      var pessoas = (r.militares[unidadeId] && r.militares[unidadeId][iso]) || [];
      RosterWork.escalasCelula.preencherCelula(celula, cobDia, erroDia, conflitoDia, pessoas, maxGlobalAtual);
      RosterWork.escalasCelula.desenharGraficos(celula);
    }).catch(function () {});   // refresh de 1 célula falhou: mantém a célula atual (o salvamento já avisou)
  }

  function limpar(corpo) {
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    if (corpo) corpo.textContent = '';
  }

  window.RosterWork.escalasCalendario = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar };
})();
