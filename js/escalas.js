(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* tipos de unidade que viram subgrupo na régua (companhias e pelotões) */
  var TIPOS_UNIDADE = { CIA: true, CIBM: true, PEL: true };

  /* rótulos de data em pt-BR (a semana começa no domingo) */
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var DIAS_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  var unidades = null;          // cache da hierarquia (lista plana), buscada uma vez
  var conteudo = null;          // o fragmento da página atual (recriado a cada visita)
  var refData = null;           // data de referência da navegação de período
  var ouvinteRegistrado = false;

  /* senha compartilhada dos modos de grade (latest-wins): cada render (trocar de
     aba, navegar período, aplicar unidades) incrementa; a resposta atrasada de um
     modo confere se ainda é a vigente antes de pintar. Sem isto, a busca do Mês
     que volta tarde sobrescreve a tela da Semana (todos escrevem no mesmo corpo). */
  var renderToken = 0;

  function obterToken() {
    try {
      var sessao = JSON.parse(sessionStorage.getItem('rosterwork_session'));
      return sessao && sessao.access_token ? sessao.access_token : null;
    } catch (e) { return null; }
  }

  /* preferências da sessão (o login grava o que vem do banco: tema, menu, unidades, visão da Escala) */
  function lerPreferencias() {
    try {
      return JSON.parse(sessionStorage.getItem('rosterwork_preferencias')) || {};
    } catch (e) { return {}; }
  }

  /* ids das unidades aplicadas (a fonte da verdade é o sessionStorage, como no resto do site) */
  function idsAplicados() {
    var prefs = lerPreferencias();
    return Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
  }

  /* liga/desliga a classe .oculto de um elemento do sub-cabeçalho */
  function mostrar(seletor, condicao) {
    var el = conteudo.querySelector(seletor);
    if (el) el.classList.toggle('oculto', !condicao);
  }

  /* ---------- abas de modo e subgrupos ---------- */

  /* os modos ficam em dois grupos ([Dia] e as demais visões) dentro de #escala-modos */
  function modoAtual() {
    var ativo = conteudo.querySelector('#escala-modos .aba--ativa');
    return ativo ? ativo.getAttribute('data-modo') : 'dia';
  }

  /* marca, entre as abas de `trilhos`, a que tem `atributo` = valor (e desmarca as demais);
     valor que não existe na tela é ignorado */
  function marcarAba(trilhos, atributo, valor) {
    var abas = conteudo.querySelectorAll(trilhos + ' .aba');
    var alvo = null;
    for (var i = 0; i < abas.length; i++) {
      if (abas[i].getAttribute(atributo) === String(valor)) alvo = abas[i];
    }
    if (!alvo) return;
    for (var j = 0; j < abas.length; j++) {
      var ativa = abas[j] === alvo;
      abas[j].classList.toggle('aba--ativa', ativa);
      abas[j].setAttribute('aria-selected', ativa ? 'true' : 'false');
    }
  }

  /* os dois grupos de modo valem como uma escolha só: a aba clicada fica marcada e a do outro grupo se desmarca */
  function trocarModo(aba) {
    marcarAba('#escala-modos', 'data-modo', aba.getAttribute('data-modo'));
    aplicarModo();
    salvarVisao();
  }

  /* ---------- última visão usada (lembrada no banco por usuário, como o tema) ---------- */

  /* reabre a Escala na última visão (modo + escolhas do subgrupo); sem nada salvo, fica o Dia do HTML.
     A data não é lembrada: a Escala sempre abre em hoje. A Semana está oculta: quem a usava abre no Mês */
  function restaurarVisao() {
    var visao = lerPreferencias().escala_visao;
    if (!visao || typeof visao !== 'object') return;
    marcarAba('#escala-modos', 'data-modo', visao.modo === 'semana' ? 'mes' : visao.modo);
    marcarAba('#escala-sub-mes', 'data-mes', visao.mes);
    marcarAba('#escala-colunas-tipo', 'data-colunas-tipo', visao.colunas_tipo);
    marcarAba('#escala-colunas-qtd', 'data-colunas', visao.colunas_qtd);
    caberNoCelular();
  }

  /* no celular só existem o Dia e o Mês (Agenda e Calendário): a visão que só existe no computador
     (Militares, Semana, Colunas) cai no Mês, a visão de vários dias que fica */
  function caberNoCelular() {
    if (!(RosterWork.celular && RosterWork.celular())) return;
    var modo = modoAtual();
    if (modo === 'dia' || modo === 'mes') return;
    marcarAba('#escala-modos', 'data-modo', 'mes');
  }

  /* guarda a visão atual na sessão e no banco (só quando a pessoa troca; vale em qualquer computador) */
  function salvarVisao() {
    var visao = { modo: modoAtual(), mes: subMesAtual(), colunas_tipo: tipoColunasAtual(), colunas_qtd: quantidadeColunas() };
    var prefs = lerPreferencias();
    prefs.escala_visao = visao;
    try { sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs)); } catch (e) {}
    if (obterToken() && RosterWork.apiFetch) {
      RosterWork.apiFetch('/rest/v1/rpc/fn_preferencias_salvar', {
        metodo: 'POST',
        corpo: { p_escala_visao: visao }
      }).catch(function () {});   // falhou: só não lembra desta vez (a tela já está certa)
    }
  }

  /* subgrupo do modo Mês: 'agenda' ou 'calendario' */
  function subMesAtual() {
    var ativo = conteudo.querySelector('#escala-sub-mes .aba--ativa');
    return ativo ? ativo.getAttribute('data-mes') : 'agenda';
  }

  function tipoColunasAtual() {
    var ativo = conteudo.querySelector('#escala-colunas-tipo .aba--ativa');
    return ativo ? ativo.getAttribute('data-colunas-tipo') : 'dias';
  }

  function quantidadeColunas() {
    var ativo = conteudo.querySelector('#escala-colunas-qtd .aba--ativa');
    return ativo ? parseInt(ativo.getAttribute('data-colunas'), 10) : 3;
  }

  /* modos que mostram o mês inteiro (período = mês, setas ±1 mês): Mês e Colunas → Dias */
  function periodoMensal() {
    var modo = modoAtual();
    return modo === 'mes' || (modo === 'colunas' && tipoColunasAtual() === 'dias');
  }

  /* dentro de Colunas: "Dias" mostra a quantidade (2–5); "Unidades" mostra as unidades */
  function aplicarTipoColunas() {
    var tipo = tipoColunasAtual();
    mostrar('#escala-colunas-qtd', tipo === 'dias');
    mostrar('#escala-sub-unidades', tipo === 'unidades');
    atualizarPeriodo();
  }

  /* mostra os subgrupos do modo ativo (Dia e Militares não têm subgrupo) */
  function aplicarModo() {
    var modo = modoAtual();
    mostrar('#escala-sub-mes', modo === 'mes');
    mostrar('#escala-sub-colunas', modo === 'colunas');
    mostrar('#escala-sub-militares', modo === 'militares');
    /* a busca vale fora do Militares (que usa a sua própria); os filtros, só nas grades (escalas-filtros.js) */
    if (RosterWork.escalasFiltros) RosterWork.escalasFiltros.aplicarModo(modo);
    /* a legenda do sub-cabeçalho acompanha o modo */
    if (RosterWork.escalasLegenda) RosterWork.escalasLegenda.atualizar(conteudo, modo);
    if (modo === 'colunas') {
      aplicarTipoColunas();
    } else {
      /* Semana não tem filtro de unidade: as linhas são as unidades aplicadas no seletor.
         O #escala-sub-unidades fica só para Colunas → Unidades (revelado em aplicarTipoColunas) */
      mostrar('#escala-sub-unidades', false);
      atualizarPeriodo();
    }
    renderizarCorpo();
  }

  /* ---------- abas de unidade (multi-seleção pelo geral-abas: trilho com data-abas-multi) ---------- */

  /* monta uma aba por unidade aplicada (CIA/CIBM/PEL), todas marcadas; sem unidades = esconde o trilho */
  function montarUnidades() {
    if (!conteudo || !document.contains(conteudo)) return;
    var trilho = conteudo.querySelector('#escala-unidades-abas');
    if (!trilho) return;

    var ids = idsAplicados();
    var lista = [];
    if (unidades) {
      var porId = {};
      unidades.forEach(function (u) { porId[u.unidade_id] = u; });
      ids.forEach(function (id) {
        var u = porId[id];
        if (u && TIPOS_UNIDADE[u.tipo]) lista.push(u);
      });
    }

    trilho.textContent = '';
    var tpl = document.getElementById('tpl-escala-aba-unidade');
    if (tpl) {
      lista.forEach(function (u) {
        var aba = tpl.content.cloneNode(true).firstElementChild;
        aba.textContent = u.nome;
        aba.setAttribute('data-unidade', u.unidade_id);
        aba.classList.add('aba--ativa');
        trilho.appendChild(aba);
      });
    }
    trilho.classList.toggle('oculto', lista.length === 0);
    renderizarCorpo();
  }

  /* ---------- corpo da grade ---------- */

  /* unidades que viram coluna: as aplicadas no seletor que são CIA/CIBM/PEL (ordem da hierarquia) */
  function unidadesColuna() {
    var ids = idsAplicados();
    var lista = [];
    if (unidades) {
      var porId = {};
      unidades.forEach(function (u) { porId[u.unidade_id] = u; });
      unidades.forEach(function (u) {
        if (ids.indexOf(u.unidade_id) !== -1 && TIPOS_UNIDADE[u.tipo]) {
          /* no painel, o pelotão mostra a companhia acima: "1ªCIBM / 2ºPEL" */
          var nomePainel = u.nome;
          var pai = u.unidade_pai_id && porId[u.unidade_pai_id];
          if (u.tipo === 'PEL' && pai) nomePainel = pai.nome + ' / ' + u.nome;
          lista.push({ id: u.unidade_id, nome: u.nome, nomeCompleto: u.nome_completo || u.nome, cidade: u.cidade, nomePainel: nomePainel });
        }
      });
    }
    return lista;
  }

  /* Colunas → Unidades: as unidades ligadas nas abas de unidade (subconjunto das aplicadas) */
  function colunasUnidadesLigadas() {
    var ligadas = {};
    if (conteudo) {
      var abas = conteudo.querySelectorAll('#escala-unidades-abas .aba--ativa');
      Array.prototype.forEach.call(abas, function (a) { ligadas[a.getAttribute('data-unidade')] = true; });
    }
    return unidadesColuna().filter(function (c) { return ligadas[String(c.id)]; });
  }

  /* estado simples no corpo (vazio), clonando o molde */
  function mostrarEstado(corpo, texto) {
    corpo.textContent = '';
    var tpl = document.getElementById('tpl-escala-estado');
    if (!tpl) return;
    var no = tpl.content.cloneNode(true).firstElementChild;
    no.textContent = texto;
    corpo.appendChild(no);
  }

  /* carregando: o giratório centralizado no corpo (sem texto) */
  function mostrarCarregando(corpo) {
    corpo.textContent = '';
    var tpl = document.getElementById('tpl-escala-carregando');
    if (!tpl) return;
    corpo.appendChild(tpl.content.cloneNode(true));
  }

  /* desenha o corpo conforme o modo ativo */
  function renderizarCorpo() {
    /* Escala sempre fresca: se um salvamento deixou recálculo a completar,
       esvazia a fila (1º plano) antes de mostrar, para nunca exibir dado velho */
    if (window.RosterWork.temRecalculoPendente && window.RosterWork.temRecalculoPendente()
        && window.RosterWork.drenarRecalculo) {
      var corpoEspera = conteudo && conteudo.querySelector('.pagina-corpo');
      if (corpoEspera) mostrarCarregando(corpoEspera);
      window.RosterWork.drenarRecalculo().then(renderizarCorpoAgora);
      return;
    }
    renderizarCorpoAgora();
  }

  function renderizarCorpoAgora() {
    if (!conteudo) return;
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (!corpo) return;
    /* esta renderização assume a senha; o modo confere vigente() antes de pintar (latest-wins) */
    var token = ++renderToken;
    function vigente() { return token === renderToken; }
    /* o Dia usa a árvore de unidades (corpo em camada, como Postos); os demais, o corpo colado */
    var ehDia = modoAtual() === 'dia';
    corpo.classList.toggle('pagina-corpo--camada', ehDia);
    corpo.classList.toggle('pagina-corpo--colado', !ehDia);
    /* celular, Mês › Agenda: uma unidade por tela, trocada pelo seletor de unidade (geral-seletor-unidade.js);
       fora disso o seletor some (o Calendário mostra todas as unidades no dia, como no computador) */
    var agendaNoCelular = !!(RosterWork.celular && RosterWork.celular()) && modoAtual() === 'mes' && subMesAtual() !== 'calendario';
    if (RosterWork.seletorUnidade) RosterWork.seletorUnidade.mostrar(agendaNoCelular ? unidadesColuna() : null);
    var aplicarSeletor = (agendaNoCelular && RosterWork.seletorUnidade) ? RosterWork.seletorUnidade.aplicar : null;
    /* as grades abrem roladas em hoje quando o período contém hoje (rolarHoje; geral-periodo.js) */
    /* Mês → Calendário: escala do mês em cada dia do calendário (mesma célula do Mês → Agenda) */
    if (modoAtual() === 'mes' && subMesAtual() === 'calendario') {
      if (!window.RosterWork.escalasCalendario) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      window.RosterWork.escalasCalendario.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente, rolarHoje: true });
      return;
    }
    /* modo Militares: grade militares × dias da quinzena (navegação por semana, ±7) */
    if (modoAtual() === 'militares') {
      if (!window.RosterWork.escalasMilitares) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      window.RosterWork.escalasMilitares.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente, rolarHoje: true });
      return;
    }
    /* modo Semana: grade unidades × 7 dias (visão por unidade) */
    if (modoAtual() === 'semana') {
      if (!window.RosterWork.escalasSemana) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      window.RosterWork.escalasSemana.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente, rolarHoje: true });
      return;
    }
    /* modo Dia: árvore de unidades com a distribuição por posto/função */
    if (modoAtual() === 'dia') {
      if (!window.RosterWork.escalasDia) { mostrarEstado(corpo, 'Em construção.'); return; }
      window.RosterWork.escalasDia.renderizar(corpo, { dataRef: refData });
      return;
    }
    /* modo Colunas: Dias = o calendário do mês em N colunas contínuas (mesma montagem do Mês → Calendário);
       Unidades = grade 7 dias × unidades ligadas */
    if (modoAtual() === 'colunas') {
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      if (tipoColunasAtual() === 'unidades') {
        if (!window.RosterWork.escalasColunas) { mostrarEstado(corpo, 'Em construção.'); return; }
        window.RosterWork.escalasColunas.renderizar(corpo, { colunas: colunasUnidadesLigadas(), dataRef: refData, vigente: vigente, rolarHoje: true });
      } else {
        if (!window.RosterWork.escalasCalendario) { mostrarEstado(corpo, 'Em construção.'); return; }
        window.RosterWork.escalasCalendario.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, diasPorLinha: quantidadeColunas(), vigente: vigente, rolarHoje: true });
      }
      return;
    }
    if (modoAtual() !== 'mes' || subMesAtual() !== 'agenda' || !window.RosterWork.escalasMes) {
      mostrarEstado(corpo, 'Em construção.');
      return;
    }
    /* unidades ainda carregando: evita piscar "selecione" quando há seleção aplicada */
    if (!unidades && idsAplicados().length) {
      mostrarCarregando(corpo);
      return;
    }
    window.RosterWork.escalasMes.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente, rolarHoje: true, aoTerminar: aplicarSeletor });
  }

  /* ---------- navegação de período (datas reais; semana de domingo a sábado) ---------- */

  function inicioSemana(d) {
    var x = new Date(d);
    x.setDate(x.getDate() - x.getDay());   /* getDay: 0 = domingo */
    return x;
  }

  function formatarDia(d) {
    return DIAS_ABREV[d.getDay()] + ', ' + d.getDate() + ' ' + MESES_ABREV[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatarMes(d) {
    return MESES[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatarIntervalo(ini, fim) {
    if (ini.getFullYear() !== fim.getFullYear()) {
      return ini.getDate() + ' ' + MESES_ABREV[ini.getMonth()] + ' ' + ini.getFullYear() + ' – ' + fim.getDate() + ' ' + MESES_ABREV[fim.getMonth()] + ' ' + fim.getFullYear();
    }
    if (ini.getMonth() !== fim.getMonth()) {
      return ini.getDate() + ' ' + MESES_ABREV[ini.getMonth()] + ' – ' + fim.getDate() + ' ' + MESES_ABREV[fim.getMonth()] + ' ' + fim.getFullYear();
    }
    return ini.getDate() + ' – ' + fim.getDate() + ' ' + MESES_ABREV[fim.getMonth()] + ' ' + fim.getFullYear();
  }

  function textoPeriodo() {
    var modo = modoAtual();
    if (modo === 'dia') return formatarDia(refData);
    if (periodoMensal()) return formatarMes(refData);
    if (modo === 'militares') {
      /* quinzena: 14 dias a partir do domingo da semana (navega ±7, mostra 14) */
      var domQ = inicioSemana(refData);
      var fimQ = new Date(domQ);
      fimQ.setDate(fimQ.getDate() + 13);
      return formatarIntervalo(domQ, fimQ);
    }
    /* semana e colunas→unidades: a semana de domingo a sábado */
    var dom = inicioSemana(refData);
    var sab = new Date(dom);
    sab.setDate(sab.getDate() + 6);
    return formatarIntervalo(dom, sab);
  }

  /* os dias que a tela mostra (sem a hora): no Dia, o dia; no Mês e no Colunas → Dias, o mês; no Militares,
     a quinzena; na Semana e no Colunas → Unidades, a semana de domingo a sábado */
  function intervaloExibido() {
    var modo = modoAtual();
    if (modo === 'dia') {
      var dia = new Date(refData.getFullYear(), refData.getMonth(), refData.getDate());
      return { inicio: dia, fim: dia };
    }
    if (periodoMensal()) {
      return { inicio: new Date(refData.getFullYear(), refData.getMonth(), 1), fim: new Date(refData.getFullYear(), refData.getMonth() + 1, 0) };
    }
    var dom = inicioSemana(refData);
    var inicio = new Date(dom.getFullYear(), dom.getMonth(), dom.getDate());
    var fim = new Date(inicio);
    fim.setDate(fim.getDate() + (modo === 'militares' ? 13 : 6));
    return { inicio: inicio, fim: fim };
  }

  function hojeSemHora() {
    var agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }

  function periodoContemHoje() {
    var periodo = intervaloExibido();
    var hoje = hojeSemHora();
    return hoje >= periodo.inicio && hoje <= periodo.fim;
  }

  /* data padrão da impressão: no Dia, o dia exibido; nos outros modos, hoje se aparece na tela,
     senão o primeiro dia exibido */
  function dataPadraoImpressao() {
    return periodoContemHoje() ? hojeSemHora() : intervaloExibido().inicio;
  }

  /* o PDF das grades conforme a tela (null = o PDF do Dia, que vale no Dia e no Militares) */
  function formatoImpressao() {
    var modo = modoAtual();
    if (modo === 'mes') return subMesAtual() === 'calendario' ? 'calendario' : 'agenda';
    if (modo === 'colunas') return tipoColunasAtual() === 'unidades' ? 'colunas-unidades' : 'colunas-dias';
    return null;
  }

  /* Imprimir: as grades abrem o painel delas, que imprime o que está na tela (o mês ou a semana, as unidades
     na ordem da tela, as colunas e os filtros ligados); o Dia e o Militares, o "Imprimir escala" com a data
     padrão do que está na tela */
  function abrirImpressao() {
    var formato = formatoImpressao();
    if (formato && RosterWork.escalasImpressaoGrade) {
      var daTela = formato === 'colunas-unidades' ? colunasUnidadesLigadas() : unidadesColuna();
      RosterWork.escalasImpressaoGrade.abrir({
        formato: formato,
        data: new Date(refData.getFullYear(), refData.getMonth(), refData.getDate()),
        unidades: daTela.map(function (u) { return { unidade_id: u.id, nome: u.nome }; }),
        diasPorLinha: quantidadeColunas(),
        filtros: RosterWork.escalasFiltros ? RosterWork.escalasFiltros.resumo() : []
      });
      return;
    }
    if (RosterWork.escalasImpressao) RosterWork.escalasImpressao.abrir({ data: dataPadraoImpressao() });
  }

  /* Enviar para o SYSBM: os pelotões da Escala (aplicados no seletor ou da companhia aplicada)
     que a pessoa administra; o dia padrão é o mesmo da impressão */
  function pelotoesSysbm() {
    var ids = idsAplicados();
    return (unidades || []).filter(function (u) {
      return u.tipo === 'PEL'
        && (ids.indexOf(u.unidade_id) !== -1 || ids.indexOf(u.unidade_pai_id) !== -1)
        && RosterWork.sessao.podeAdministrar('pelotao', u.unidade_id);
    }).map(function (u) { return { id: u.unidade_id, nome: u.nome, cidade: u.cidade }; });
  }

  /* no celular o grupo Administração é um menu: fecha antes de abrir o painel */
  function abrirSysbm() {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (RosterWork.escalasSysbm) RosterWork.escalasSysbm.abrir({ data: dataPadraoImpressao(), pelotoes: pelotoesSysbm() });
  }

  /* o rótulo do período e o "Hoje", que só aparece quando o período da tela não contém hoje */
  function atualizarPeriodo() {
    var el = conteudo.querySelector('#escala-periodo-nome');
    if (el) el.textContent = textoPeriodo();
    mostrar('#escala-periodo-hoje', !periodoContemHoje());
  }

  /* "Hoje": volta ao período atual; a grade abre rolada em hoje */
  function voltarParaHoje() {
    refData = new Date();
    atualizarPeriodo();
    renderizarCorpo();
  }

  function navegar(direcao) {
    var modo = modoAtual();
    if (modo === 'dia') {
      refData.setDate(refData.getDate() + direcao);
    } else if (periodoMensal()) {
      /* navega por mês inteiro sem transbordar: em dia 29-31, setMonth sozinho pularia para o mês seguinte */
      var diaMes = refData.getDate();
      refData.setDate(1);
      refData.setMonth(refData.getMonth() + direcao);
      var ultimoDiaMes = new Date(refData.getFullYear(), refData.getMonth() + 1, 0).getDate();
      refData.setDate(Math.min(diaMes, ultimoDiaMes));
    } else {
      refData.setDate(refData.getDate() + direcao * 7);
    }
    atualizarPeriodo();
    renderizarCorpo();
  }

  /* ---------- dados das unidades ---------- */

  async function carregarUnidades() {
    if (unidades) { montarUnidades(); return; }
    if (!obterToken()) return;
    var falhou = false;
    try {
      var resp = await RosterWork.apiFetch('/rest/v1/rpc/buscar_unidades_ordenadas', {
        metodo: 'POST',
        corpo: {}
      });
      if (!resp.ok) { falhou = true; }
      else {
        var lista = await resp.json();
        if (Array.isArray(lista)) unidades = lista;
      }
    } catch (e) { falhou = true; }
    /* falha na leitura das unidades: mostra erro em vez de deixar o giratório preso para sempre */
    if (falhou && !unidades) {
      var corpo = conteudo && conteudo.querySelector('.pagina-corpo');
      if (corpo) mostrarEstado(corpo, window.RosterWork.mensagens.escala.falhaCarregarMes);
      return;
    }
    montarUnidades();
  }

  /* busca do modo Militares: filtra as linhas da grade (o filtro em si vive no escalas-militares.js) */
  function ligarBuscaMilitares() {
    var caixa = conteudo.querySelector('#escala-busca-militares');
    var entrada = conteudo.querySelector('#escala-busca-entrada');
    var limpar = conteudo.querySelector('#escala-busca-limpar');
    /* a caixa de busca volta vazia a cada visita: zera o filtro que persiste no módulo, senão a grade abre filtrada com a busca em branco */
    if (window.RosterWork.escalasMilitares) RosterWork.escalasMilitares.filtrar('');
    if (!entrada) return;

    entrada.addEventListener('input', function () {
      var valor = entrada.value.trim();
      if (caixa) caixa.classList.toggle('busca--com-texto', valor !== '');
      if (window.RosterWork.escalasMilitares) RosterWork.escalasMilitares.filtrar(valor);
    });

    if (limpar) {
      limpar.addEventListener('click', function () {
        entrada.value = '';
        if (caixa) caixa.classList.remove('busca--com-texto');
        entrada.focus();
        if (window.RosterWork.escalasMilitares) RosterWork.escalasMilitares.filtrar('');
      });
    }
  }

  /* a navegação chama isto toda vez que a página de escalas é exibida */
  function iniciar(fragmento) {
    conteudo = fragmento;
    refData = new Date();
    if (RosterWork.escalasExtraRascunho) RosterWork.escalasExtraRascunho.zerar();   // a extra do painel do dia começa sem rascunho

    RosterWork.abas.ligar(conteudo.querySelector('#escala-modo-principal'), trocarModo);
    RosterWork.abas.ligar(conteudo.querySelector('#escala-modo-visoes'), trocarModo);
    RosterWork.abas.ligar(conteudo.querySelector('#escala-sub-mes'), function () { renderizarCorpo(); salvarVisao(); });
    RosterWork.abas.ligar(conteudo.querySelector('#escala-colunas-tipo'), function () { aplicarTipoColunas(); renderizarCorpo(); salvarVisao(); });
    RosterWork.abas.ligar(conteudo.querySelector('#escala-colunas-qtd'), function () { atualizarPeriodo(); renderizarCorpo(); salvarVisao(); });
    /* reabre na última visão usada antes de montar (sem piscar o Dia) */
    restaurarVisao();
    /* Colunas → Unidades: ligar/desligar uma unidade muda as colunas → re-renderiza */
    RosterWork.abas.ligar(conteudo.querySelector('#escala-unidades-abas'), renderizarCorpo);

    /* clicar numa célula da grade abre a gaveta de detalhes */
    if (window.RosterWork.escalasPainel) RosterWork.escalasPainel.ligar(conteudo);

    /* celular: o seletor de unidade da Agenda (componente geral-seletor-unidade.js) */
    if (window.RosterWork.seletorUnidade) RosterWork.seletorUnidade.iniciar(conteudo);

    /* busca do modo Militares; filtros e busca da grade (escalas-filtros.js); o botão Legenda (molde geral) */
    ligarBuscaMilitares();
    if (window.RosterWork.escalasFiltros) RosterWork.escalasFiltros.iniciar(conteudo, modoAtual);
    if (window.RosterWork.legenda) RosterWork.legenda.montar(conteudo.querySelector('#escala-legenda-grade'));

    var btnAnterior = conteudo.querySelector('#escala-periodo-anterior');
    var btnProximo = conteudo.querySelector('#escala-periodo-proximo');
    var btnHoje = conteudo.querySelector('#escala-periodo-hoje');
    if (btnAnterior) btnAnterior.addEventListener('click', function () { navegar(-1); });
    if (btnProximo) btnProximo.addEventListener('click', function () { navegar(1); });
    if (btnHoje) {
      btnHoje.addEventListener('click', function () {
        voltarParaHoje();
        /* o botão some: o foco continua no período (quem usa o teclado não volta ao começo da página) */
        if (document.activeElement === btnHoje) {
          var nome = conteudo.querySelector('#escala-periodo-nome');
          if (nome) nome.focus();
        }
      });
    }

    /* Imprimir: abre o painel conforme a aba (abrirImpressao) */
    var btnImprimir = conteudo.querySelector('#escala-imprimir');
    if (btnImprimir) btnImprimir.addEventListener('click', abrirImpressao);

    /* grupo Administração, só para quem administra: Enviar para o SYSBM */
    var grupoAdmin = conteudo.querySelector('#escala-acoes-admin');
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', !RosterWork.sessao.temPapel('pelotao'));
    var btnSysbm = conteudo.querySelector('#escala-enviar-sysbm');
    if (btnSysbm) btnSysbm.addEventListener('click', abrirSysbm);

    /* clicar no rótulo do período abre o calendário; o dia escolhido vira a referência */
    var rotuloPeriodo = conteudo.querySelector('#escala-periodo-nome');
    if (rotuloPeriodo && window.RosterWork.calendario) {
      window.RosterWork.calendario.ligar(rotuloPeriodo, {
        ancora: conteudo.querySelector('.geral-periodo'),
        obterModo: function () {
          var modo = modoAtual();
          if (periodoMensal()) return 'mes';
          if (modo === 'semana' || modo === 'militares' || modo === 'colunas') return 'semana';
          return 'dia';
        },
        obterData: function () { return refData; },
        aoEscolher: function (data) {
          refData = data;
          atualizarPeriodo();
          renderizarCorpo();
        }
      });
    }

    /* re-monta as abas de unidade quando o seletor aplica uma nova seleção */
    if (!ouvinteRegistrado) {
      ouvinteRegistrado = true;
      window.addEventListener('rosterwork_units_changed', montarUnidades);
      /* salvou no painel → atualiza só a célula afetada na grade ativa (Mês ou Semana);
         cada grade só age se estiver na tela naquele momento */
      window.addEventListener('rosterwork_escala_salva', function (e) {
        var d = e.detail || {};
        if (d.unidadeId == null || !d.iso) return;
        if (window.RosterWork.escalasMes && RosterWork.escalasMes.atualizarCelula) RosterWork.escalasMes.atualizarCelula(String(d.unidadeId), d.iso);
        if (window.RosterWork.escalasSemana && RosterWork.escalasSemana.atualizarCelula) RosterWork.escalasSemana.atualizarCelula(String(d.unidadeId), d.iso);
        if (window.RosterWork.escalasCalendario && RosterWork.escalasCalendario.atualizarCelula) RosterWork.escalasCalendario.atualizarCelula(String(d.unidadeId), d.iso);
        if (window.RosterWork.escalasDia && RosterWork.escalasDia.atualizarCelula) RosterWork.escalasDia.atualizarCelula(String(d.unidadeId), d.iso);
        if (window.RosterWork.escalasColunas && RosterWork.escalasColunas.atualizarCelula) RosterWork.escalasColunas.atualizarCelula(String(d.unidadeId), d.iso);
      });
      /* mudança de ciclo (Contínuos) afeta muitos dias → re-renderiza a grade inteira */
      window.addEventListener('rosterwork_escala_recarregar', function () { renderizarCorpo(); });
      /* o celular girou e passou do corte (ou voltou): a visão e a faixa se refazem para a largura nova */
      var eraCelular = !!(RosterWork.celular && RosterWork.celular());
      window.addEventListener('resize', function () {
        var ehCelular = !!(RosterWork.celular && RosterWork.celular());
        if (ehCelular === eraCelular) return;
        eraCelular = ehCelular;
        if (!conteudo || !document.contains(conteudo)) return;
        caberNoCelular();
        aplicarModo();
      });
    }

    /* Escala sempre fresca para QUALQUER pessoa: ao entrar, completa no servidor
       qualquer recálculo pendente (a fila) ANTES de montar, para nunca mostrar dado
       velho de um salvamento feito por outro (ou de quem fechou o navegador antes de
       terminar). Fila vazia = verificação rápida. */
    function montarInicial() {
      aplicarModo();        // estado inicial (a última visão usada, ou o Dia do HTML) + preenche o período
      carregarUnidades();   // popula as abas de unidade em segundo plano
    }
    if (window.RosterWork.drenarRecalculo) {
      var corpoInicial = conteudo.querySelector('.pagina-corpo');
      if (corpoInicial) mostrarCarregando(corpoInicial);
      window.RosterWork.drenarRecalculo().then(montarInicial, montarInicial);
    } else {
      montarInicial();
    }
  }

  window.RosterWork.paginas.escalas = { iniciar: iniciar };
})();
