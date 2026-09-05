/* ============================================================
   ESCALAS — modo Mês / Agenda (montagem da grade)
   Monta a grade dias (linhas) × unidades (colunas) e preenche cada
   célula com o componente compartilhado escalas-celula.js (gráfico
   de cobertura + lista de militares). Dados: escalas-dados.js.
   Não busca no banco nem escreve estilo CSS.
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

  function mostrarEstado(corpo, texto) {
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-estado');
    if (!no) return;
    no.textContent = texto;
    corpo.appendChild(no);
  }

  /* carregando: o giratório centralizado no corpo (sem texto) */
  function mostrarCarregando(corpo) {
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-carregando');
    if (no) corpo.appendChild(no);
  }

  /* desenha o mês de opcoes.dataRef para as colunas (unidades) recebidas */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    var colunas = (opcoes && opcoes.colunas) || [];
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

    var ano = dataRef.getFullYear(), mes = dataRef.getMonth();
    var ultimo = new Date(ano, mes + 1, 0);
    var inicio = dataISO(new Date(ano, mes, 1));
    var fim = dataISO(ultimo);
    var ids = colunas.map(function (c) { return c.id; });

    var req = ++reqSeq;
    window.RosterWork.escalasDados.carregar(ids, inicio, fim).then(function (resultado) {
      var dados = resultado.militares;
      var cobertura = resultado.cobertura || {};
      var erro = resultado.erro || {};
      var conflito = resultado.conflito || {};
      if (!document.contains(corpo) || req !== reqSeq) return;   // saiu da página, ou outra render começou
      corpo.textContent = '';

      var wrap = RosterWork.tpl('tpl-escala-mes');
      var grade = wrap.querySelector('.escala-mes-grade');
      grade.classList.add('escala-mes-grade--' + Math.min(8, colunas.length));

      /* cabeçalho: canto vazio + nome de cada unidade */
      var cabecalho = RosterWork.tpl('tpl-escala-mes-cabecalho');
      colunas.forEach(function (c) {
        var titulo = RosterWork.tpl('tpl-escala-mes-titulo');
        titulo.textContent = c.nome;
        cabecalho.appendChild(titulo);
      });
      grade.appendChild(cabecalho);

      /* pico global de cobertura (escala comum a todos os gráficos do mês) */
      var maxGlobal = RosterWork.escalasCelula ? RosterWork.escalasCelula.calcularMaxGlobal(cobertura, ids) : 0;
      maxGlobalAtual = maxGlobal;   // guarda p/ o refresh de uma célula (atualizarCelula)

      /* uma linha por dia do mês */
      var hojeISO = dataISO(new Date());
      for (var dia = 1; dia <= ultimo.getDate(); dia++) {
        var d = new Date(ano, mes, dia);
        var iso = dataISO(d);
        var diaSemana = d.getDay();

        var linha = RosterWork.tpl('tpl-escala-mes-linha');
        linha.querySelector('.escala-mes-data-semana').textContent = DIAS_ABREV[diaSemana];
        linha.querySelector('.escala-mes-data-numero').textContent = String(dia);
        if (diaSemana === 0 || diaSemana === 6) linha.classList.add('escala-mes-linha--fds');
        if (iso === hojeISO) linha.classList.add('escala-mes-linha--hoje');

        colunas.forEach(function (c) {
          var celula = RosterWork.tpl('tpl-escala-mes-celula');
          celula.dataset.iso = iso;
          celula.dataset.unidadeId = c.id;
          celula.dataset.unidadeNome = c.nomePainel || c.nome;
          celula.dataset.unidadeCidade = c.cidade || '';
          /* soCobertura (ex.: Extrajornada): desenha só o gráfico de cobertura, sem a lista de militares */
          var pessoas = opcoes.soCobertura ? [] : ((dados[c.id] && dados[c.id][iso]) || []);
          var cobDia = (cobertura[c.id] && cobertura[c.id][iso]) || null;
          var erroDia = (erro[c.id] && erro[c.id][iso]) || null;
          var conflitoDia = !!(conflito[c.id] && conflito[c.id][iso]);
          if (RosterWork.escalasCelula) RosterWork.escalasCelula.preencherCelula(celula, cobDia, erroDia, conflitoDia, pessoas, maxGlobal);
          /* gancho opcional: quem reusa a grade (ex.: Extrajornada) sobrepõe algo na célula (a Escala não passa) */
          if (opcoes.aoCelula) opcoes.aoCelula(celula, c.id, iso, { cobertura: cobDia, erro: erroDia, maxGlobal: maxGlobal });
          linha.appendChild(celula);
        });
        grade.appendChild(linha);
      }

      corpo.appendChild(wrap);
      /* gancho: quem reusa a grade (ex.: Extrajornada) ajusta a escala das barras ANTES de pintar (a Escala não passa) */
      if (opcoes.aoTerminar) opcoes.aoTerminar(wrap);
      if (RosterWork.escalasCelula) RosterWork.escalasCelula.ativarGraficos(wrap);
      if (RosterWork.gradeTeclado) RosterWork.gradeTeclado.ativar(grade, { celula: '.escala-mes-celula', linha: '.escala-mes-linha' });
    }, function () {
      if (document.contains(corpo) && req === reqSeq) mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  /* refresh de uma única célula (unidade × dia) após salvar no painel — sem re-renderizar a
     grade toda, preservando rolagem, realce e hover. Editar a distribuição não muda quem está
     de serviço (isso vem do QUANDO, intocado), então a cobertura e o maxGlobal seguem válidos. */
  function atualizarCelula(unidadeId, iso) {
    if (!window.RosterWork.escalasDados || !window.RosterWork.escalasCelula) return;
    var grade = document.querySelector('.escala-mes-grade');
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

  window.RosterWork.escalasMes = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar };
})();
