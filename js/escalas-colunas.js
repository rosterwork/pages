/* ============================================================
   ESCALAS — modo Colunas → Unidades (grade flexível)
   Os 7 dias da semana nas linhas × as unidades ligadas nas colunas
   (o Mês numa janela de semana), reusando a célula compartilhada
   escalas-celula.js (mesmo miolo do Mês/Semana), então o painel
   (escalas-painel.js) casa por `.escala-mes-celula` sem mudança.
   O Colunas → Dias é o calendário contínuo (escalas-calendario.js
   com diasPorLinha).
   Dados: escalas-dados.js (RPC ler_escala_mes). Não escreve estilo
   (só a custom property --n-colunas, orientada a dados).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var maxPorUnidadeAtual = {};   // pico de cobertura de cada unidade na renderização atual (reusado no refresh de uma célula)
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

  function infoDia(d) {
    var sem = d.getDay();
    return { iso: dataISO(d), numero: d.getDate(), semana: sem, fds: (sem === 0 || sem === 6), hoje: dataISO(d) === dataISO(new Date()) };
  }

  /* os 7 dias (domingo→sábado) a partir da referência */
  function diasDaSemana(dataRef) {
    var dom = inicioSemana(dataRef);
    var dias = [];
    for (var i = 0; i < 7; i++) {
      dias.push(infoDia(new Date(dom.getFullYear(), dom.getMonth(), dom.getDate() + i)));
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

  /* uma célula (unidade × dia), reusando a célula do Mês (o painel casa por .escala-mes-celula) */
  function montarCelula(unidade, iso, dados, cobertura, erro, maxPorUnidade) {
    var celula = RosterWork.tpl('tpl-escala-mes-celula');
    celula.dataset.iso = iso;
    celula.dataset.unidadeId = unidade.id;
    celula.dataset.unidadeNome = unidade.nomePainel || unidade.nome;
    celula.dataset.unidadeCidade = unidade.cidade || '';
    var pessoas = (dados[unidade.id] && dados[unidade.id][iso]) || [];
    var cobDia = (cobertura[unidade.id] && cobertura[unidade.id][iso]) || null;
    var erroDia = (erro[unidade.id] && erro[unidade.id][iso]) || null;
    if (RosterWork.escalasCelula) RosterWork.escalasCelula.preencherCelula(celula, cobDia, erroDia, pessoas, maxPorUnidade[unidade.id]);
    return celula;
  }

  /* cabeçalho de coluna = uma unidade */
  function cabecalhoUnidade(unidade) {
    var cel = RosterWork.tpl('tpl-escala-colunas-cab-unidade');
    cel.textContent = unidade.nome;
    return cel;
  }

  /* rótulo de linha = um dia */
  function rotuloDia(info) {
    var r = RosterWork.tpl('tpl-escala-colunas-rotulo-dia');
    r.querySelector('.escala-colunas-rotulo-semana').textContent = DIAS_ABREV[info.semana];
    r.querySelector('.escala-colunas-rotulo-numero').textContent = String(info.numero);
    if (info.hoje) r.classList.add('escala-colunas-rotulo--hoje');
    if (info.fds) r.classList.add('escala-colunas-rotulo--fds');
    return r;
  }

  /* desenha a grade: os 7 dias da semana (linhas) × as unidades ligadas (colunas) */
  function renderizar(corpo, opcoes) {
    if (!corpo) return;
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    var colunas = (opcoes && opcoes.colunas) || [];   // as unidades ligadas
    var dataRef = (opcoes && opcoes.dataRef) || new Date();

    if (!colunas.length) {
      mostrarEstado(corpo, 'Ligue ao menos uma unidade nas abas acima.');
      return;
    }
    if (!window.RosterWork.escalasDados) {
      mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
      return;
    }

    mostrarCarregando(corpo);

    var dias = diasDaSemana(dataRef);
    var inicio = dias[0].iso, fim = dias[dias.length - 1].iso;
    var ids = colunas.map(function (c) { return c.id; });

    var req = ++reqSeq;
    window.RosterWork.escalasDados.carregar(ids, inicio, fim).then(function (resultado) {
      var dados = resultado.militares;
      var cobertura = resultado.cobertura || {};
      var erro = resultado.erro || {};
      if (!document.contains(corpo) || req !== reqSeq || (opcoes.vigente && !opcoes.vigente())) return;   // saiu da página, outra render começou, ou trocou de modo
      corpo.textContent = '';

      var wrap = RosterWork.tpl('tpl-escala-colunas');
      var grade = wrap.querySelector('.escala-colunas-grade');

      /* pico de cada unidade no período (a régua dos gráficos da unidade) */
      var maxPorUnidade = RosterWork.escalasCelula ? RosterWork.escalasCelula.calcularMaxPorUnidade(cobertura, ids) : {};
      maxPorUnidadeAtual = maxPorUnidade;

      /* nº de colunas da grade (as unidades) — orienta o grid-template via custom property */
      grade.style.setProperty('--n-colunas', String(colunas.length));

      var cabecalho = RosterWork.tpl('tpl-escala-colunas-cabecalho');
      colunas.forEach(function (c) { cabecalho.appendChild(cabecalhoUnidade(c)); });
      grade.appendChild(cabecalho);

      /* uma linha por dia; as colunas são as unidades ligadas */
      dias.forEach(function (info) {
        var linha = RosterWork.tpl('tpl-escala-colunas-linha');
        linha.appendChild(rotuloDia(info));
        colunas.forEach(function (c) {
          linha.appendChild(montarCelula(c, info.iso, dados, cobertura, erro, maxPorUnidade));
        });
        grade.appendChild(linha);
      });

      corpo.appendChild(wrap);
      if (RosterWork.escalasCelula) RosterWork.escalasCelula.ativarGraficos(wrap);
      if (RosterWork.gradeTeclado) RosterWork.gradeTeclado.ativar(grade, { celula: '.escala-mes-celula', linha: '.escala-colunas-linha' });
    }, function () {
      if (document.contains(corpo) && req === reqSeq && (!opcoes.vigente || opcoes.vigente())) mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
    });
  }

  /* refresh de uma única célula (unidade × dia) após salvar no painel — só age se a grade de
     Colunas estiver na tela (senão o modo ativo cuida da sua própria grade) */
  function atualizarCelula(unidadeId, iso) {
    if (!window.RosterWork.escalasDados || !window.RosterWork.escalasCelula) return;
    var grade = document.querySelector('.escala-colunas-grade');
    if (!grade) return;
    var celula = grade.querySelector('.escala-mes-celula[data-unidade-id="' + unidadeId + '"][data-iso="' + iso + '"]');
    if (!celula) return;
    window.RosterWork.escalasDados.carregar([unidadeId], iso, iso).then(function (r) {
      if (!document.contains(celula)) return;
      var cobDia = (r.cobertura[unidadeId] && r.cobertura[unidadeId][iso]) || null;
      var erroDia = (r.erro[unidadeId] && r.erro[unidadeId][iso]) || null;
      var pessoas = (r.militares[unidadeId] && r.militares[unidadeId][iso]) || [];
      RosterWork.escalasCelula.preencherCelula(celula, cobDia, erroDia, pessoas, maxPorUnidadeAtual[unidadeId]);
      RosterWork.escalasCelula.desenharGraficos(celula);
    }).catch(function () {});   // refresh de 1 célula falhou: mantém a célula atual (o salvamento já avisou)
  }

  function limpar(corpo) {
    if (window.RosterWork.escalasCelula) RosterWork.escalasCelula.limparObservadores();
    if (corpo) corpo.textContent = '';
  }

  window.RosterWork.escalasColunas = { renderizar: renderizar, atualizarCelula: atualizarCelula, limpar: limpar };
})();
