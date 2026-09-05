/* ============================================================
   ESCALAS — modo Semana (visão por unidade)
   Monta a grade unidades (linhas) × 7 dias da semana (colunas) e
   preenche cada célula com o componente compartilhado
   escalas-celula.js (gráfico de cobertura + lista de militares) —
   é o Mês transposto, numa janela de 7 dias. A célula reusa
   `tpl-escala-mes-celula`/`.escala-mes-celula`, então o painel
   (escalas-painel.js) abre e realça sem mudança. Dados:
   escalas-dados.js (RPC ler_escala_mes). Não escreve estilo CSS.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var maxGlobalAtual = 0;   // pico de cobertura da renderização atual (reusado no refresh de uma célula)
  var reqSeq = 0;           // token de requisição: ignora resposta antiga quando outra render começou


  function dataISO(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* domingo da semana da data (a semana vai de domingo a sábado) */
  function inicioSemana(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - x.getDay());
    return x;
  }

  /* os 7 dias (domingo→sábado) a partir da referência */
  function diasDaSemana(dataRef) {
    var dom = inicioSemana(dataRef);
    var hojeISO = dataISO(new Date());
    var dias = [];
    for (var i = 0; i < 7; i++) {
      var dt = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate() + i);
      var sem = dt.getDay();
      dias.push({ iso: dataISO(dt), numero: dt.getDate(), semana: sem, fds: (sem === 0 || sem === 6), hoje: dataISO(dt) === hojeISO });
    }
    return dias;
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

  /* desenha a semana de opcoes.dataRef para as unidades (linhas) recebidas */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    var colunas = (opcoes && opcoes.colunas) || [];   // unidades = linhas
    var dataRef = (opcoes && opcoes.dataRef) || new Date();

    if (!colunas.length) {
      mostrarEstado(corpo, 'Selecione uma companhia ou pelotão no seletor de unidades.');
      return;
    }
    if (!window.RosterWork.escalasDados) {
      mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
      return;
    }

    mostrarCarregando(corpo);

    var dias = diasDaSemana(dataRef);
    var inicio = dias[0].iso, fim = dias[6].iso;
    var ids = colunas.map(function (c) { return c.id; });

    var req = ++reqSeq;
    window.RosterWork.escalasDados.carregar(ids, inicio, fim).then(function (resultado) {
      var dados = resultado.militares;
      var cobertura = resultado.cobertura || {};
      var erro = resultado.erro || {};
      var conflito = resultado.conflito || {};
      if (!document.contains(corpo) || req !== reqSeq) return;   // saiu da página, ou outra render começou
      corpo.textContent = '';

      var wrap = RosterWork.tpl('tpl-escala-semana');
      var grade = wrap.querySelector('.escala-semana-grade');

      /* cabeçalho: canto vazio + os 7 dias */
      var cab = RosterWork.tpl('tpl-escala-semana-cabecalho');
      dias.forEach(function (info) {
        var cel = RosterWork.tpl('tpl-escala-semana-dia');
        cel.querySelector('.escala-semana-dia-semana').textContent = DIAS_ABREV[info.semana];
        cel.querySelector('.escala-semana-dia-numero').textContent = String(info.numero);
        if (info.fds) cel.classList.add('escala-semana-dia--fds');
        if (info.hoje) cel.classList.add('escala-semana-dia--hoje');
        cab.appendChild(cel);
      });
      grade.appendChild(cab);

      /* pico global de cobertura (escala comum a todos os gráficos da semana) */
      var maxGlobal = RosterWork.escalasCelula ? RosterWork.escalasCelula.calcularMaxGlobal(cobertura, ids) : 0;
      maxGlobalAtual = maxGlobal;

      /* uma linha por unidade */
      colunas.forEach(function (c) {
        var linha = RosterWork.tpl('tpl-escala-semana-linha');
        linha.querySelector('.escala-semana-unidade-nome').textContent = c.nome;
        var cidadeEl = linha.querySelector('.escala-semana-unidade-cidade');
        if (cidadeEl) cidadeEl.textContent = c.cidade || '';
        dias.forEach(function (info) {
          var celula = RosterWork.tpl('tpl-escala-mes-celula');   // reusa a célula do Mês (o painel casa por .escala-mes-celula)
          celula.dataset.iso = info.iso;
          celula.dataset.unidadeId = c.id;
          celula.dataset.unidadeNome = c.nomePainel || c.nome;
          celula.dataset.unidadeCidade = c.cidade || '';
          var pessoas = (dados[c.id] && dados[c.id][info.iso]) || [];
          var cobDia = (cobertura[c.id] && cobertura[c.id][info.iso]) || null;
          var erroDia = (erro[c.id] && erro[c.id][info.iso]) || null;
          var conflitoDia = !!(conflito[c.id] && conflito[c.id][info.iso]);
          if (RosterWork.escalasCelula) RosterWork.escalasCelula.preencherCelula(celula, cobDia, erroDia, conflitoDia, pessoas, maxGlobal);
          linha.appendChild(celula);
        });
        grade.appendChild(linha);
      });

      corpo.appendChild(wrap);
      if (RosterWork.escalasCelula) RosterWork.escalasCelula.ativarGraficos(wrap);
      if (RosterWork.gradeTeclado) RosterWork.gradeTeclado.ativar(grade, { celula: '.escala-mes-celula', linha: '.escala-semana-linha' });
    }, function () {
      if (document.contains(corpo) && req === reqSeq) mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  /* refresh de uma única célula (unidade × dia) após salvar no painel — igual ao Mês, mas na
     grade da Semana; só age se a grade da Semana estiver na tela (senão o Mês cuida) */
  function atualizarCelula(unidadeId, iso) {
    if (!window.RosterWork.escalasDados || !window.RosterWork.escalasCelula) return;
    var grade = document.querySelector('.escala-semana-grade');
    if (!grade) return;
    var celula = grade.querySelector('.escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]');
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

  window.RosterWork.escalasSemana = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar };
})();
