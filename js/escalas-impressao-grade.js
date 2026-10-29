/* ============================================================
   ESCALAS — Imprimir as grades (painel → PDF)
   Nas grades (Agenda, Calendário, Colunas), o botão Imprimir abre o
   painel direito, e sai o que está na tela: a grade, o mês (no
   Colunas › Unidades, a semana), as unidades e os filtros, resumidos
   na nota do alto. Nas caixas numeradas: o formato (Folhas A4 ou
   Página contínua), o período (no Calendário, o "Mês todo" ou as
   semanas escolhidas; na Agenda e no Colunas › Dias, do dia ao dia),
   o que mostrar em cada célula e a prévia (o próprio PDF, no leitor do
   navegador), refeita a cada mudança (a última pedida vale). O Gerar
   PDF baixa o mesmo arquivo; o desenho fica no escalas-impressao-grade-pdf.js.
   No celular o painel fica sem a prévia (o navegador não mostra PDF
   dentro da página).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var ESPERA_PREVIA = 400;   // ms sem mexer antes de refazer a prévia
  /* o período de cada grade (semanas, dias ou a semana da tela) e a folha (paisagem ou retrato) */
  var FORMATOS = {
    agenda: { periodo: 'dias', paisagem: false },
    calendario: { periodo: 'semanas', paisagem: true },
    'colunas-dias': { periodo: 'dias', paisagem: true },
    'colunas-unidades': { periodo: 'semana', paisagem: false }
  };

  var form = null;          // o painel aberto: escolhas e peças
  var tokenPrevia = 0;      // latest-wins da prévia
  var esperaPrevia = null;
  var cacheDados = null;    // { chave, promessa }: mudar o formato, o Mostrar ou o período não busca de novo

  function msg() { return RW.mensagens.escala.impressao.grade; }

  /* ---------- datas ---------- */
  function somarDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function ultimoDia(mes) { return new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate(); }

  /* "4 a 10 de outubro" ou, entre dois meses, "27 de setembro a 3 de outubro" */
  function intervalo(a, b) {
    if (a.getMonth() === b.getMonth()) return msg().doMes(msg().trecho(String(a.getDate()), String(b.getDate())), MESES[b.getMonth()]);
    return msg().trecho(msg().doMes(String(a.getDate()), MESES[a.getMonth()]), msg().doMes(String(b.getDate()), MESES[b.getMonth()]));
  }

  /* trechos do mesmo mês: "1 a 3, 11 a 17 e 25 a 31 de outubro" */
  function trechosDoMes(trechos) {
    var dias = trechos.map(function (t) { return msg().trecho(String(t[0].getDate()), String(t[1].getDate())); });
    return msg().doMes(msg().juntar(dias), MESES[trechos[0][0].getMonth()]);
  }

  /* as linhas do calendário do mês (domingo a sábado) e, em cada uma, o primeiro e o último dia que são do mês */
  function semanasDoMes(mes) {
    var fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    var lista = [];
    for (var d = somarDias(mes, -mes.getDay()); d <= fimMes; d = somarDias(d, 7)) {
      var fim = somarDias(d, 6);
      lista.push({ inicio: d, primeiro: d < mes ? mes : d, ultimo: fim > fimMes ? fimMes : fim });
    }
    return lista;
  }

  /* a semana de hoje, se o mês da tela tem hoje; senão a 1ª */
  function semanaDeHoje() {
    var agora = new Date();
    var hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    var i = semanasDoMes(form.mes).map(function (s) { return s.primeiro <= hoje && hoje <= s.ultimo; }).indexOf(true);
    return i >= 0 ? i : 0;
  }

  /* ---------- o período ---------- */
  /* { dias: [{ data, fora }] em ordem, busca: { inicio, fim } (o que a tela carrega), texto (no PDF),
     frase (no painel; vazia quando sai o mês todo) } */
  function periodoEscolhido() {
    var mes = form.mes;
    var fimMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    var nomeMes = msg().comAno(MESES[mes.getMonth()], mes.getFullYear());
    var dias = [];
    var periodo = FORMATOS[form.formato].periodo;
    if (periodo === 'semana') {
      /* Colunas › Unidades: a semana da tela (domingo a sábado), como ela está */
      var domingo = somarDias(form.data, -form.data.getDay());
      for (var k = 0; k < 7; k++) dias.push({ data: somarDias(domingo, k), fora: false });
      var sabado = dias[6].data;
      return { dias: dias, busca: { inicio: domingo, fim: sabado }, texto: msg().comAno(intervalo(domingo, sabado), sabado.getFullYear()), frase: '' };
    }
    if (periodo === 'semanas') {
      /* as semanas inteiras, com os dias de outro mês vazios, como na tela */
      var semanas = semanasDoMes(mes);
      var escolhidas = form.mesTodo ? semanas.map(function (s, i) { return i; }) : form.semanas;
      var trechos = [];
      escolhidas.forEach(function (i) {
        var s = semanas[i];
        for (var j = 0; j < 7; j++) { var d = somarDias(s.inicio, j); dias.push({ data: d, fora: d.getMonth() !== mes.getMonth() }); }
        var anterior = trechos[trechos.length - 1];
        if (anterior && somarDias(anterior[1], 1).getTime() === s.primeiro.getTime()) anterior[1] = s.ultimo;
        else trechos.push([s.primeiro, s.ultimo]);
      });
      return { dias: dias, busca: { inicio: mes, fim: fimMes },
        texto: form.mesTodo ? nomeMes : msg().comAno(trechosDoMes(trechos), mes.getFullYear()),
        frase: form.mesTodo ? '' : msg().semanas(escolhidas.map(function (i) { return String(i + 1); }), trechosDoMes(trechos)) };
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
    for (var d2 = inicio; d2 <= fim; d2 = somarDias(d2, 1)) dias.push({ data: d2, fora: d2 < de || d2 > ate });
    var todos = form.de === 1 && form.ate === ultimoDia(mes);
    return { dias: dias, busca: { inicio: mes, fim: fimMes },
      texto: todos ? nomeMes : msg().comAno(intervalo(de, ate), mes.getFullYear()),
      frase: todos ? '' : msg().dias(form.ate - form.de + 1, intervalo(de, ate)) };
  }

  /* ---------- semanas ---------- */
  /* "Mês todo" marcado: só ele. Desmarcado: os botões das semanas do mês (cada um com as datas na dica),
     já com a semana de hoje */
  function marcarMesTodo(sim) {
    form.mesTodo = sim;
    form.mesTodoBotao.setAttribute('aria-checked', sim ? 'true' : 'false');
    form.mesTodoBotao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', sim);
    form.lista.classList.toggle('oculto', sim);
    form.lista.textContent = '';
    form.semanas = [];
    if (sim) return;
    form.semanas = [semanaDeHoje()];
    semanasDoMes(form.mes).forEach(function (s, i) {
      var aba = RW.tpl('tpl-escala-aba-unidade');
      if (!aba) return;
      var datas = intervalo(s.primeiro, s.ultimo);
      aba.textContent = String(i + 1);
      aba.setAttribute('data-semana', i);
      aba.setAttribute('data-dica', datas);
      aba.setAttribute('aria-label', msg().semanaRotulo(i + 1, datas));
      if (i === form.semanas[0]) aba.classList.add('aba--ativa');
      form.lista.appendChild(aba);
    });
    pintarSemanas();
  }

  /* o componente de abas já marcou ou desmarcou (de marcar vários, nunca zera); aqui a escolha vem da tela */
  function pintarSemanas() {
    form.semanas = [];
    Array.prototype.forEach.call(form.lista.querySelectorAll('[data-semana]'), function (aba) {
      var marcada = aba.classList.contains('aba--ativa');
      aba.setAttribute('aria-pressed', marcada ? 'true' : 'false');
      if (marcada) form.semanas.push(Number(aba.getAttribute('data-semana')));
    });
  }

  /* ---------- dias ---------- */
  /* as listas só oferecem os dias que o mês tem; o "ao dia", do "Do dia" em diante */
  function montarDias() {
    var ultimo = ultimoDia(form.mes);
    function faixa(a, b) { var l = []; for (var n = a; n <= b; n++) l.push(n); return l; }
    [['de', faixa(1, ultimo), form.de], ['ate', faixa(form.de, ultimo), form.ate]].forEach(function (item) {
      var caixa = form.raiz.querySelector('[data-impressao-dia="' + item[0] + '"]');
      caixa.querySelector('.campo-selecao-texto').textContent = String(item[2]);
      RW.dropdownNumeros.preencher(caixa.querySelector('.dropdown-menu'), { opcoes: item[1], valor: item[2], aoEscolher: function (valor) {
        if (item[0] === 'de') { form.de = valor; if (form.ate < valor) form.ate = valor; } else form.ate = valor;
        montarDias();
        mudou();
      } });
    });
  }

  /* ---------- prévia ---------- */
  function mudou() {
    var p = periodoEscolhido();
    form.periodo.textContent = p.frase;
    form.periodo.classList.toggle('oculto', !p.frase);
    agendarPrevia();
  }

  /* os dados da tela (ler_escala_mes) do mês ou da semana; o mesmo pedido não busca de novo */
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
    if (!form.unidades.length) return Promise.reject({ semUnidade: true });
    var p = periodoEscolhido();
    var ids = form.unidades.map(function (u) { return u.unidade_id; });
    return carregarDados(ids, RW.data.paraIsoDeData(p.busca.inicio), RW.data.paraIsoDeData(p.busca.fim)).then(function (dados) {
      return RW.escalasImpressaoGradePdf.gerar({
        formato: form.formato,
        paisagem: FORMATOS[form.formato].paisagem,
        continua: form.continua,
        mostrar: form.mostrar,
        diasPorLinha: form.diasPorLinha,
        unidades: form.unidades,
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
      form.folhas.textContent = msg().folhas(r.folhas, form.continua, FORMATOS[form.formato].paisagem);
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
      var mensagem = (e && (e.semUnidade || e.longaDemais)) ? avisoDaFalha(e) : RW.mensagens.escala.impressao.falhaGerar;
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: mensagem });
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

  /* a nota do alto: "Calendário de outubro de 2026, 2ªCIBM, 1ºPEL e 2ºPEL, sem filtros." */
  function resumoDaTela() {
    var periodo = FORMATOS[form.formato].periodo === 'semana'
      ? msg().daSemana(periodoEscolhido().texto)
      : msg().doMesDaTela(msg().comAno(MESES[form.mes.getMonth()], form.mes.getFullYear()));
    var unidades = msg().juntar(form.unidades.map(function (u) { return u.nome; }));
    return msg().resumo(msg().nomes[form.formato], periodo, unidades, form.filtros);
  }

  /* as caixas visíveis, numeradas em ordem (o Colunas › Unidades não tem a do período) */
  function numerarCaixas() {
    var n = 0;
    Array.prototype.forEach.call(form.raiz.querySelectorAll('.painel-corpo > .grupo-caixa'), function (caixa) {
      if (caixa.classList.contains('oculto')) return;
      n++;
      Array.prototype.forEach.call(caixa.querySelectorAll('[data-impressao-num]'), function (el) { el.textContent = String(n); });
    });
  }

  /* opcoes: { formato, data (a da tela), unidades ([{ unidade_id, nome }] da tela, na ordem dela), diasPorLinha,
     filtros (os ligados na tela, em texto) } */
  function abrir(opcoes) {
    if (!RW.painel || !FORMATOS[opcoes.formato]) return;
    fecharLimpo();
    var formato = opcoes.formato;
    RW.painel.abrir({ titulo: msg().titulos[formato], subtitulo: msg().subtitulo(FORMATOS[formato].paisagem, false), aoFechar: fecharLimpo });
    var corpo = RW.painel.corpo();
    var rodape = RW.painel.rodape();
    var molde = document.getElementById('tpl-escala-impressao-grade');
    var acoes = document.getElementById('tpl-escala-impressao-acoes');
    if (!corpo || !molde) return;
    corpo.appendChild(molde.content.cloneNode(true));
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }

    var raiz = document.getElementById('painel');
    var data = opcoes.data || new Date();
    function peca(nome) { return raiz.querySelector('[data-impressao-' + nome + ']'); }
    /* as escolhas (formato, Mostrar, semanas, dias), o que vem da tela e as peças do painel */
    form = {
      raiz: raiz, formato: formato, continua: false, mostrar: { grafico: true, icones: true, faixa: true },
      diasPorLinha: opcoes.diasPorLinha || 3, unidades: opcoes.unidades || [], filtros: opcoes.filtros || [],
      data: new Date(data.getFullYear(), data.getMonth(), data.getDate()), mes: new Date(data.getFullYear(), data.getMonth(), 1),
      mesTodo: true, semanas: [], de: 1, ate: 1,
      mesTodoBotao: peca('mes-todo'), lista: peca('semanas'), periodo: peca('periodo'), previa: peca('previa'),
      aviso: peca('previa-aviso'), carregando: peca('previa-carregando'), folhas: peca('folhas'), gerar: peca('gerar'),
      pedido: null, url: null
    };

    /* só as peças do período desta grade (semanas ou dias); o Colunas › Unidades fica sem a caixa */
    var periodo = FORMATOS[formato].periodo;
    peca('periodo-caixa').classList.toggle('oculto', periodo === 'semana');
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-impressao-so]'), function (el) {
      el.classList.toggle('oculto', el.getAttribute('data-impressao-so') !== periodo);
    });
    numerarCaixas();
    peca('resumo').textContent = resumoDaTela();

    /* formato: Folhas A4 ou Página contínua */
    RW.abas.ligar(raiz.querySelector('[data-impressao-formato]'), function (aba) {
      form.continua = aba.getAttribute('data-formato') === 'continua';
      RW.painel.definirTitulos(null, subtitulo());
      agendarPrevia();
    });

    /* semanas: o Mês todo (caixa de marcar) e, quando desmarcado, os botões de cada semana */
    form.mesTodoBotao.addEventListener('click', function () { marcarMesTodo(!form.mesTodo); mudou(); });
    RW.abas.ligar(form.lista, function () { pintarSemanas(); mudou(); });

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

    /* o período começa no mês todo da tela (semanas: o Mês todo marcado; dias: do 1º ao último) */
    form.ate = ultimoDia(form.mes);
    if (periodo === 'dias') montarDias();
    mudou();
  }

  RW.escalasImpressaoGrade = { abrir: abrir };
})();
