/* ============================================================
   ESCALAS — modo Mês / Calendário (dados)
   Busca a escala do mês (RPC ler_escala_mes) e desenha o calendário
   pelo componente compartilhado geral-calendario-mes, preenchendo
   cada dia — via o gancho aoDia — com, por unidade, a MESMA célula
   do Mês → Agenda (escalas-celula.js: gráfico de cobertura + lista).
   A célula reusa `.escala-mes-celula`, então o painel (escalas-painel.js)
   abre e realça sem mudança. Não escreve estilo CSS.
   Também desenha o Colunas → Dias: o mesmo calendário com a opção
   diasPorLinha (N colunas em sequência contínua; ver o componente).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var maxPorUnidadeAtual = {};   // pico de cobertura de cada unidade na renderização atual (reusado no refresh de uma célula)
  var celulaAtual = {};          // as opções da célula na renderização atual: o posto curto só no Calendário (não no Colunas › Dias)
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

  /* preenche a célula de UM dia (calendário) com, por unidade, a célula do Mês */
  function preencherDia(celulaDia, iso, colunas, dados, cobertura, erro, maxPorUnidade, afastados, opcoesCelula) {
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
      if (RosterWork.escalasCelula) RosterWork.escalasCelula.preencherCelula(cel, cobDia, erroDia, pessoas, maxPorUnidade[c.id], (afastados[c.id] && afastados[c.id][iso]) || [], opcoesCelula);
      celulaDia.appendChild(bloco);
    });
  }

  /* matriz da navegação por teclado. Uma embaixo da outra: cada linha do calendário vira uma linha por unidade, com a
     célula dela em cada dia (null nos dias de fora do mês); ↑/↓ passam pelas unidades do dia e seguem para a linha de
     baixo, ←/→ andam entre os dias, na mesma unidade. Lado a lado: cada linha do calendário é uma linha só, com as
     unidades de cada dia em sequência; ←/→ passam pelas unidades e seguem para o dia seguinte, ↑/↓ vão à mesma unidade do
     mesmo dia da semana na linha de cima ou de baixo */
  function matrizTeclado(wrap) {
    var m = [];
    var lado = wrap.classList.contains('geral-calendario-mes--lado-a-lado');
    Array.prototype.forEach.call(wrap.querySelectorAll('.geral-calendario-mes-semana'), function (linha) {
      var dias = Array.prototype.map.call(linha.children, function (d) { return d.querySelectorAll('.escala-mes-celula'); });
      var porDia = 0;
      dias.forEach(function (cels) { porDia = Math.max(porDia, cels.length); });
      if (lado) {
        var corrida = [];
        dias.forEach(function (cels) { for (var i = 0; i < porDia; i++) corrida.push(cels[i] || null); });
        m.push(corrida);
        return;
      }
      for (var u = 0; u < porDia; u++) {
        m.push(dias.map(function (cels) { return cels[u] || null; }));
      }
    });
    return m;
  }

  /* desenha o mês de opcoes.dataRef como calendário, com a escala em cada dia
     (opcoes.diasPorLinha: N colunas contínuas, o Colunas → Dias; ausente = semana dom→sáb); a promessa se
     cumpre com o mês desenhado (ou o aviso de falha no lugar) */
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

    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var inicio = dataISO(new Date(ano, mes, 1));
    var fim = dataISO(new Date(ano, mes + 1, 0));
    var ids = colunas.map(function (c) { return c.id; });

    /* o mesmo mês lido de novo: o calendário fica até o novo chegar, na mesma rolagem (escalas-dia-na-grade.js) */
    var Dia = window.RosterWork.escalasDiaNaGrade;
    /* as unidades lado a lado ou uma embaixo da outra (a escolha da pessoa; geral-visao-grade.js) */
    var ladoALado = !!(RosterWork.visaoGrade && RosterWork.visaoGrade.disposicao() === 'lado');
    var chaveGrade = 'calendario|' + (opcoes.diasPorLinha || 0) + '|' + (ladoALado ? 'lado' : 'empilhadas') + '|' + inicio + '|' + ids.join(',');
    var rolagem = Dia ? Dia.mesmaGrade(corpo, chaveGrade) : null;
    /* outro mês: o que está na tela fica 0,5 s; depois, a forma do novo, que fica o mínimo na tela (escalas-esqueleto.js) */
    var Esqueleto = window.RosterWork.escalasEsqueleto;
    var esperaDaGrade = rolagem ? null : Esqueleto.abrirMes(corpo, dataRef, function (lugar) {
      Esqueleto.calendario(lugar, colunas, dataRef, opcoes.diasPorLinha);
    });

    var req = ++reqSeq;
    return Esqueleto.segurar(esperaDaGrade, window.RosterWork.escalasDados.carregar(ids, inicio, fim, { daTela: true })).then(function (resultado) {
      if (!document.contains(corpo) || req !== reqSeq || (opcoes.vigente && !opcoes.vigente())) return;   // saiu da página, outra render começou, ou trocou de modo
      Esqueleto.parar();
      var dados = resultado.militares;
      var afastados = resultado.afastados || {};
      var cobertura = resultado.cobertura || {};
      var erro = resultado.erro || {};
      /* pico de cada unidade no mês (a régua dos gráficos da unidade) */
      var maxPorUnidade = RosterWork.escalasCelula ? RosterWork.escalasCelula.calcularMaxPorUnidade(cobertura, ids) : {};
      maxPorUnidadeAtual = maxPorUnidade;
      var opcoesCelula = { postoCurto: !opcoes.diasPorLinha };
      celulaAtual = opcoesCelula;

      /* o componente monta a grade e chama aoDia por dia; só preenchemos os dias do mês exibido
         (os de outro mês ficam só com o número apagado, como calendário tradicional) */
      RosterWork.geralCalendarioMes.renderizar(corpo, {
        dataRef: dataRef,
        diasPorLinha: opcoes.diasPorLinha,
        unidadesPorDia: colunas.length,   // um bloco por unidade em cada dia, alinhados por linha (ou lado a lado)
        ladoALado: ladoALado,
        aoDia: function (celulaDia, data, noMes) {
          if (!noMes) return;
          var iso = dataISO(data);
          preencherDia(celulaDia, iso, colunas, dados, cobertura, erro, maxPorUnidade, afastados, opcoesCelula);
          /* o Oficial de Área do dia, no meio do título */
          if (RosterWork.escalasCelula) RosterWork.escalasCelula.preencherOficial(celulaDia.querySelector('.geral-calendario-mes-dia-centro'), resultado.oficial, iso);
        }
      });

      var wrap = corpo.querySelector('.geral-calendario-mes');
      /* gancho: quem usa ajusta antes de pintar */
      if (wrap && opcoes.aoTerminar) opcoes.aoTerminar(wrap);
      if (wrap && RosterWork.escalasCelula) RosterWork.escalasCelula.ativarGraficos(wrap);
      if (wrap && RosterWork.gradeTeclado) RosterWork.gradeTeclado.ativar(wrap, { celula: '.escala-mes-celula', matriz: matrizTeclado });
      if (wrap && Dia) Dia.desenhou(corpo, chaveGrade, wrap, rolagem);
      /* rolarHoje: abre em hoje, com a linha anterior (a semana, ou os N dias do Colunas) à vista acima e,
         quando os dias não cabem na largura (celular), o dia anterior à esquerda (geral-periodo.js);
         hoje num dia de outro mês não conta */
      var diaHoje = (opcoes.rolarHoje && !rolagem && wrap) ? wrap.querySelector('.geral-calendario-mes-dia--hoje:not(.geral-calendario-mes-dia--fora)') : null;
      if (diaHoje && RosterWork.periodo) {
        var linhaHoje = diaHoje.closest('.geral-calendario-mes-semana');
        RosterWork.periodo.rolarAteHoje(wrap, linhaHoje, linhaHoje.previousElementSibling, { fixo: wrap.querySelector('.geral-calendario-mes-cabecalho') });
        RosterWork.periodo.rolarAteHoje(wrap, diaHoje, diaHoje.previousElementSibling, { horizontal: true });
      }
    }, function () {
      if (!document.contains(corpo) || req !== reqSeq || (opcoes.vigente && !opcoes.vigente())) return;
      Esqueleto.parar();
      mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  /* refresh de uma única célula (unidade × dia) após salvar no painel — igual ao Mês/Semana,
     mas na grade do calendário; só age se o calendário estiver na tela */
  function atualizarCelula(unidadeId, iso, leitura) {
    if (!window.RosterWork.escalasDados || !window.RosterWork.escalasCelula) return;
    var wrap = document.querySelector('.geral-calendario-mes');
    if (!wrap) return;
    var celula = wrap.querySelector('.escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]');
    if (!celula) return;
    (leitura || window.RosterWork.escalasDados.carregar([unidadeId], iso, iso)).then(function (r) {
      if (!document.contains(celula)) return;
      var cobDia = (r.cobertura[unidadeId] && r.cobertura[unidadeId][iso]) || null;
      var erroDia = (r.erro[unidadeId] && r.erro[unidadeId][iso]) || null;
      var pessoas = (r.militares[unidadeId] && r.militares[unidadeId][iso]) || [];
      RosterWork.escalasCelula.preencherCelula(celula, cobDia, erroDia, pessoas, maxPorUnidadeAtual[unidadeId], (r.afastados[unidadeId] && r.afastados[unidadeId][iso]) || [], celulaAtual);
      RosterWork.escalasCelula.desenharGraficos(celula);
      /* o Oficial de Área do dia pode ter mudado (a mesma leitura traz o dele) */
      var dia = celula.closest('.geral-calendario-mes-dia');
      RosterWork.escalasCelula.preencherOficial(dia && dia.querySelector('.geral-calendario-mes-dia-centro'), r.oficial, iso);
    }).catch(function () {});   // refresh de 1 célula falhou: mantém a célula atual (o salvamento já avisou)
  }

  function limpar(corpo) {
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    if (corpo) corpo.textContent = '';
  }

  window.RosterWork.escalasCalendario = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar };
})();
