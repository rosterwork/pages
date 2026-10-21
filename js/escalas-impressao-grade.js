/* ============================================================
   ESCALAS — Imprimir as grades (painel → PDF)
   Nas grades (Agenda, Calendário, Colunas), o botão Imprimir abre o
   painel direito largo: o formato (Folhas A4 ou Página contínua), o
   período (semanas no Calendário e no Colunas › Unidades; dias na
   Agenda e no Colunas › Dias), o que mostrar em cada célula, a prévia
   (o próprio PDF, no leitor do navegador) e as unidades. A prévia é
   refeita a cada mudança (a última pedida vale) e o Gerar PDF baixa o
   mesmo arquivo. Os dados são os da tela (ler_escala_mes) e seguem os
   filtros da barra; o desenho fica no escalas-impressao-grade-pdf.js.
   No celular o painel fica sem a prévia (o navegador não mostra PDF
   dentro da página).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var TIPOS_COM_ESCALA = ['CIA', 'CIBM', 'PEL'];
  var ESPERA_PREVIA = 400;   // ms sem mexer antes de refazer a prévia
  /* o período de cada grade (semanas ou dias) e a folha (paisagem ou retrato) */
  var FORMATOS = {
    agenda: { periodo: 'dias', paisagem: false },
    calendario: { periodo: 'semanas', paisagem: true },
    'colunas-dias': { periodo: 'dias', paisagem: true },
    'colunas-unidades': { periodo: 'semanas', paisagem: false }
  };

  var form = null;          // o painel aberto: escolhas e elementos
  var tokenPrevia = 0;      // latest-wins da prévia
  var esperaPrevia = null;
  var cacheDados = null;    // { chave, promessa }: mudar só o formato ou o Mostrar não busca de novo

  function msg() { return RW.mensagens.escala.impressao.grade; }

  /* ---------- datas ---------- */
  function somarDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function ultimoDia(mes) { return new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate(); }
  function curta(d) { return RW.data.paraBR(d).slice(0, 5); }

  /* as linhas do calendário do mês (domingo a sábado), da semana do dia 1º à do último dia */
  function semanasDoMes(mes) {
    var inicio = somarDias(mes, -mes.getDay());
    var fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    var lista = [];
    for (var d = inicio; d <= fim; d = somarDias(d, 7)) lista.push({ inicio: d, fim: somarDias(d, 6) });
    return lista;
  }

  /* "27/09 a 31/10/2026" ou, com vários trechos, "04/10 a 10/10 e 18/10 a 24/10/2026" */
  function textoTrechos(trechos) {
    var ultimo = trechos[trechos.length - 1][1];
    var mesmoAno = trechos[0][0].getFullYear() === ultimo.getFullYear();
    var partes = trechos.map(function (t, i) {
      var fim = (i === trechos.length - 1 || !mesmoAno) ? RW.data.paraBR(t[1]) : curta(t[1]);
      var inicio = mesmoAno ? curta(t[0]) : RW.data.paraBR(t[0]);
      if (t[0].getTime() === t[1].getTime()) inicio = fim;
      return msg().trecho(inicio, fim);
    });
    return msg().juntar(partes);
  }

  /* ---------- o período escolhido ---------- */
  /* { dias: [{ data, fora }] em ordem, trechos, inicio, fim (o que buscar), texto, quantos } */
  function periodoEscolhido() {
    var mes = form.mes;
    var nomeMes = msg().mes(MESES[mes.getMonth()], mes.getFullYear());
    var dias = [], trechos = [];
    if (FORMATOS[form.formato].periodo === 'semanas') {
      var semanas = semanasDoMes(mes);
      form.semanas.forEach(function (i) {
        var s = semanas[i];
        for (var k = 0; k < 7; k++) dias.push({ data: somarDias(s.inicio, k), fora: false });
        var anterior = trechos[trechos.length - 1];
        if (anterior && somarDias(anterior[1], 1).getTime() === s.inicio.getTime()) anterior[1] = s.fim;
        else trechos.push([s.inicio, s.fim]);
      });
      return { dias: dias, inicio: dias[0].data, fim: dias[dias.length - 1].data, quantos: dias.length,
        texto: form.mesTodo ? nomeMes : textoTrechos(trechos) };
    }
    var de = new Date(mes.getFullYear(), mes.getMonth(), form.de);
    var ate = new Date(mes.getFullYear(), mes.getMonth(), form.ate);
    var inicio = de, fim = ate;
    /* Colunas › Dias: as linhas saem inteiras, nas mesmas colunas da tela (os dias de fora ficam vazios) */
    if (form.formato === 'colunas-dias' && RW.geralCalendarioMes) {
      var n = form.diasPorLinha;
      inicio = somarDias(de, -RW.geralCalendarioMes.colunaContinua(de, n));
      fim = somarDias(ate, n - 1 - RW.geralCalendarioMes.colunaContinua(ate, n));
    }
    for (var d = inicio; d <= fim; d = somarDias(d, 1)) dias.push({ data: d, fora: d < de || d > ate });
    var todos = form.de === 1 && form.ate === ultimoDia(mes);
    return { dias: dias, inicio: inicio, fim: fim, quantos: form.ate - form.de + 1, texto: todos ? nomeMes : textoTrechos([[de, ate]]) };
  }

  /* só CIA/CIBM/PEL têm escala; as outras marcadas na árvore são só o caminho */
  function unidadesComEscala() {
    if (!form || !form.seletor) return [];
    return form.seletor.unidadesSelecionadas().filter(function (u) { return TIPOS_COM_ESCALA.indexOf(u.tipo) >= 0; });
  }

  /* ---------- semanas ---------- */
  function montarSemanas() {
    var total = semanasDoMes(form.mes).length;
    form.lista.textContent = '';
    for (var i = 0; i < total; i++) {
      var aba = RW.tpl('tpl-escala-aba-unidade');
      if (!aba) return;
      aba.textContent = String(i + 1);
      aba.setAttribute('data-semana', i);
      form.lista.appendChild(aba);
    }
    marcarSemanas();
  }

  function marcarSemanas() {
    form.mesTodoBotao.classList.toggle('aba--ativa', form.mesTodo);
    form.mesTodoBotao.setAttribute('aria-pressed', form.mesTodo ? 'true' : 'false');
    Array.prototype.forEach.call(form.lista.querySelectorAll('[data-semana]'), function (aba) {
      var marcada = form.semanas.indexOf(Number(aba.getAttribute('data-semana'))) >= 0;
      aba.classList.toggle('aba--ativa', marcada);
      aba.setAttribute('aria-pressed', marcada ? 'true' : 'false');
    });
  }

  function todasAsSemanas() {
    var lista = [];
    for (var i = 0; i < semanasDoMes(form.mes).length; i++) lista.push(i);
    return lista;
  }

  /* com o Mês todo marcado, a semana clicada fica sozinha; depois, cada clique põe ou tira uma (nunca zera);
     com todas marcadas, volta o Mês todo */
  function escolherSemana(i) {
    if (form.mesTodo) {
      form.mesTodo = false;
      form.semanas = [i];
    } else if (form.semanas.indexOf(i) >= 0) {
      if (form.semanas.length > 1) form.semanas.splice(form.semanas.indexOf(i), 1);
    } else {
      form.semanas.push(i);
      form.semanas.sort(function (a, b) { return a - b; });
    }
    if (form.semanas.length === semanasDoMes(form.mes).length) form.mesTodo = true;
    marcarSemanas();
    mudou();
  }

  /* ---------- dias ---------- */
  /* as listas só oferecem os dias que o mês tem; o "ao dia", do "Do dia" em diante */
  function montarDias() {
    var ultimo = ultimoDia(form.mes);
    function faixa(a, b) { var l = []; for (var n = a; n <= b; n++) l.push(n); return l; }
    [['de', faixa(1, ultimo), form.de], ['ate', faixa(form.de, ultimo), form.ate]].forEach(function (item) {
      var caixa = form.raiz.querySelector('[data-impressao-dia="' + item[0] + '"]');
      caixa.querySelector('.campo-selecao-texto').textContent = String(item[2]);
      RW.dropdownNumeros.preencher(caixa.querySelector('.dropdown-menu'), {
        opcoes: item[1],
        valor: item[2],
        aoEscolher: function (valor) {
          if (item[0] === 'de') { form.de = valor; if (form.ate < valor) form.ate = valor; } else form.ate = valor;
          montarDias();
          mudou();
        }
      });
    });
  }

  /* ---------- mês ---------- */
  /* trocar o mês volta para o mês todo (todas as semanas, ou do dia 1º ao último) */
  function mudarMes(data) {
    form.mes = new Date(data.getFullYear(), data.getMonth(), 1);
    form.mesNome.textContent = MESES[form.mes.getMonth()] + ' ' + form.mes.getFullYear();
    form.mesTodo = true;
    form.semanas = todasAsSemanas();
    form.de = 1;
    form.ate = ultimoDia(form.mes);
    if (FORMATOS[form.formato].periodo === 'semanas') montarSemanas(); else montarDias();
    mudou();
  }

  /* ---------- prévia ---------- */
  function mudou() {
    var p = periodoEscolhido();
    form.periodo.textContent = msg().periodo(p.quantos, p.texto);
    agendarPrevia();
  }

  /* dados da tela (ler_escala_mes) do período; o mesmo pedido não busca de novo */
  function carregarDados(ids, inicio, fim) {
    var chave = ids.join(',') + '|' + inicio + '|' + fim;
    if (cacheDados && cacheDados.chave === chave) return cacheDados.promessa;
    var promessa = RW.escalasDados.carregar(ids, inicio, fim);
    cacheDados = { chave: chave, promessa: promessa };
    promessa.catch(function () { if (cacheDados && cacheDados.promessa === promessa) cacheDados = null; });
    return promessa;
  }

  /* monta o PDF das escolhas atuais: { arquivo, folhas, nome } */
  function pedirArquivo() {
    var unidades = unidadesComEscala();
    if (!unidades.length) return Promise.reject({ semUnidade: true });
    var p = periodoEscolhido();
    var ids = unidades.map(function (u) { return u.unidade_id; });
    return carregarDados(ids, RW.data.paraIsoDeData(p.inicio), RW.data.paraIsoDeData(p.fim)).then(function (dados) {
      return RW.escalasImpressaoGradePdf.gerar({
        formato: form.formato,
        paisagem: FORMATOS[form.formato].paisagem,
        continua: form.continua,
        mostrar: form.mostrar,
        diasPorLinha: form.diasPorLinha,
        unidades: unidades,
        dias: p.dias,
        texto: p.texto,
        dados: dados
      });
    });
  }

  function mostrarCarregando(sim) {
    form.carregando.classList.toggle('carregando-veu--visivel', sim);
  }

  function avisoDaFalha(e) {
    if (e && e.semUnidade) return (RW.mensagens.distribuicao && RW.mensagens.distribuicao.selecioneUnidade) || '';
    if (e && e.longaDemais) return msg().longaDemais;
    return msg().falhaPrevia;
  }

  /* a prévia é refeita depois de uma pausa sem mexer; a última pedida vale */
  function agendarPrevia() {
    var token = ++tokenPrevia;
    form.pedido = null;
    clearTimeout(esperaPrevia);
    if (RW.celular && RW.celular()) return;
    mostrarCarregando(true);
    esperaPrevia = setTimeout(function () { fazerPrevia(token); }, ESPERA_PREVIA);
  }

  function fazerPrevia(token) {
    if (!form || token !== tokenPrevia) return;
    var ref = form;
    form.pedido = { token: token, promessa: pedirArquivo() };
    form.pedido.promessa.then(function (r) {
      if (form !== ref || token !== tokenPrevia) return;
      if (form.url) URL.revokeObjectURL(form.url);
      form.url = URL.createObjectURL(r.arquivo);
      /* o leitor do navegador sem a barra dele, na largura do quadro */
      form.previa.src = form.url + '#toolbar=0&navpanes=0&view=FitH';
      form.aviso.classList.add('oculto');
      form.folhas.textContent = msg().folhas(r.folhas, form.continua);
      mostrarCarregando(false);
    }, function (e) {
      if (form !== ref || token !== tokenPrevia) return;
      form.aviso.textContent = avisoDaFalha(e);
      form.aviso.classList.remove('oculto');
      form.folhas.textContent = '';
      mostrarCarregando(false);
    });
  }

  /* ---------- gerar ---------- */
  /* baixa o arquivo da prévia (ou monta agora, se a prévia ainda não saiu) e fecha o painel */
  function gerar() {
    if (RW.campos) RW.campos.limparErro(form.arvore);
    if (!unidadesComEscala().length) {
      if (RW.campos) RW.campos.marcarErro(form.arvore, avisoDaFalha({ semUnidade: true }));
      return;
    }
    var botao = form.gerar;
    var promessa = (form.pedido && form.pedido.token === tokenPrevia) ? form.pedido.promessa : pedirArquivo();
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    function terminar() { if (RW.pararCarregando && botao.isConnected) RW.pararCarregando(botao); }
    promessa.then(function (r) {
      terminar();
      RW.escalasImpressaoPdf.baixar(r.arquivo, r.nome);
      if (RW.painel) RW.painel.fechar();
    }).catch(function (e) {
      terminar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: e && e.longaDemais ? msg().longaDemais : RW.mensagens.escala.impressao.falhaGerar });
    });
  }

  /* ---------- abrir ---------- */
  function fecharLimpo() {
    tokenPrevia++;
    clearTimeout(esperaPrevia);
    if (form && form.url) URL.revokeObjectURL(form.url);
    form = null;
    cacheDados = null;
  }

  function subtitulo() { return msg().subtitulo(FORMATOS[form.formato].paisagem, form.continua); }

  /* opcoes: { formato, data (a data da tela), unidades (ids da tela), diasPorLinha } */
  function abrir(opcoes) {
    if (!RW.painel || !FORMATOS[opcoes.formato]) return;
    fecharLimpo();
    var formato = opcoes.formato;
    RW.painel.abrir({ titulo: msg().titulos[formato], subtitulo: msg().subtitulo(FORMATOS[formato].paisagem, false), largo: true, aoFechar: fecharLimpo });
    var corpo = RW.painel.corpo();
    var rodape = RW.painel.rodape();
    var molde = document.getElementById('tpl-escala-impressao-grade');
    var acoes = document.getElementById('tpl-escala-impressao-acoes');
    if (!corpo || !molde) return;
    corpo.appendChild(molde.content.cloneNode(true));
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }

    var raiz = document.getElementById('painel');
    var data = opcoes.data || new Date();
    form = {
      raiz: raiz,
      formato: formato,
      continua: false,
      mostrar: { grafico: true, icones: true, faixa: true },
      diasPorLinha: opcoes.diasPorLinha || 3,
      mes: new Date(data.getFullYear(), data.getMonth(), 1),
      mesTodo: true,
      semanas: [],
      de: 1,
      ate: 1,
      mesNome: raiz.querySelector('[data-impressao-mes-nome]'),
      mesTodoBotao: raiz.querySelector('[data-impressao-mes-todo]'),
      lista: raiz.querySelector('[data-impressao-semanas]'),
      periodo: raiz.querySelector('[data-impressao-periodo]'),
      previa: raiz.querySelector('[data-impressao-previa]'),
      aviso: raiz.querySelector('[data-impressao-previa-aviso]'),
      carregando: raiz.querySelector('[data-impressao-previa-carregando]'),
      folhas: raiz.querySelector('[data-impressao-folhas]'),
      arvore: raiz.querySelector('[data-impressao-arvore]'),
      gerar: raiz.querySelector('[data-impressao-gerar]'),
      seletor: null,
      pedido: null,
      url: null
    };

    /* só as peças do período desta grade (semanas ou dias) */
    var periodo = FORMATOS[formato].periodo;
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-impressao-so]'), function (el) {
      el.classList.toggle('oculto', el.getAttribute('data-impressao-so') !== periodo);
    });

    /* formato: Folhas A4 ou Página contínua */
    RW.abas.ligar(raiz.querySelector('[data-impressao-formato]'), function (aba) {
      form.continua = aba.getAttribute('data-formato') === 'continua';
      RW.painel.definirTitulos(null, subtitulo());
      agendarPrevia();
    });

    /* mês: as setas e o calendário do rótulo */
    raiz.querySelector('[data-impressao-mes-anterior]').addEventListener('click', function () { mudarMes(new Date(form.mes.getFullYear(), form.mes.getMonth() - 1, 1)); });
    raiz.querySelector('[data-impressao-mes-proximo]').addEventListener('click', function () { mudarMes(new Date(form.mes.getFullYear(), form.mes.getMonth() + 1, 1)); });
    if (RW.calendario) {
      RW.calendario.ligar(form.mesNome, {
        ancora: form.mesNome.parentNode,
        obterModo: function () { return 'mes'; },
        obterData: function () { return form.mes; },
        aoEscolher: mudarMes
      });
    }

    /* semanas: o Mês todo e cada semana (o componente de abas marca primeiro; a regra daqui vale por cima) */
    RW.abas.ligar(raiz.querySelector('[data-impressao-mes-todo-trilho]'), function () {
      form.mesTodo = true;
      form.semanas = todasAsSemanas();
      marcarSemanas();
      mudou();
    });
    RW.abas.ligar(form.lista, function (aba) { escolherSemana(Number(aba.getAttribute('data-semana'))); });

    /* Mostrar: cada caixa liga ou desliga a sua peça da célula */
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-mostrar]'), function (opcao) {
      opcao.addEventListener('click', function () {
        var chave = opcao.getAttribute('data-mostrar');
        form.mostrar[chave] = !form.mostrar[chave];
        opcao.setAttribute('aria-checked', form.mostrar[chave] ? 'true' : 'false');
        opcao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', form.mostrar[chave]);
        agendarPrevia();
      });
    });

    raiz.querySelector('[data-impressao-cancelar]').addEventListener('click', function () { RW.painel.fechar(); });
    form.gerar.addEventListener('click', gerar);

    /* o período começa no mês da tela: semanas = o mês todo (no Colunas › Unidades, a semana da tela);
       dias = do 1º ao último */
    form.mesNome.textContent = MESES[form.mes.getMonth()] + ' ' + form.mes.getFullYear();
    form.semanas = todasAsSemanas();
    form.ate = ultimoDia(form.mes);
    if (formato === 'colunas-unidades') {
      var domingo = somarDias(data, -data.getDay());
      var semanaDaTela = semanasDoMes(form.mes).findIndex(function (s) { return s.inicio.getTime() === domingo.getTime(); });
      if (semanaDaTela >= 0 && form.semanas.length > 1) { form.mesTodo = false; form.semanas = [semanaDaTela]; }
    }
    if (periodo === 'semanas') montarSemanas(); else montarDias();

    /* a árvore do seletor, solta no painel e já marcada com as unidades da tela */
    if (RW.seletorUnidades) {
      var ref = form;
      form.seletor = RW.seletorUnidades.criar({
        modo: 'multi',
        arvoreEl: form.arvore,
        aoMudar: function () { if (RW.campos) RW.campos.limparErro(form.arvore); mudou(); }
      });
      mostrarCarregando(true);
      form.seletor.montarArvore().then(function () {
        if (form !== ref) return;   // o painel fechou ou reabriu enquanto carregava
        form.seletor.aplicarSelecaoPorIds(opcoes.unidades || []);
        mudou();
      });
    }
  }

  RW.escalasImpressaoGrade = { abrir: abrir };
})();
