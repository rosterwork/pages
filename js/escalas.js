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

  /* busca do sub-cabeçalho (nome/CPF/RG) nos modos de grade; o modo Militares tem a sua própria */
  var buscaCtrl = null;
  var buscaTermo = '';
  var buscaModo = 'marcar';     // 'marcar' (realça) | 'filtrar' (esconde quem não casa)
  var buscaObserver = null;     // reaplica a busca quando o corpo muda (render assíncrono, célula atualizada)
  var buscaAgendada = false;

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

  /* ids das unidades aplicadas (a fonte da verdade é o sessionStorage, como no resto do site) */
  function idsAplicados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* liga/desliga a classe .oculto de um elemento do sub-cabeçalho */
  function mostrar(seletor, condicao) {
    var el = conteudo.querySelector(seletor);
    if (el) el.classList.toggle('oculto', !condicao);
  }

  /* ---------- abas de modo e subgrupos ---------- */

  function modoAtual() {
    var ativo = conteudo.querySelector('#escala-modos .aba--ativa');
    return ativo ? ativo.getAttribute('data-modo') : 'mes';
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
    /* a busca do sub-cabeçalho vale nos modos de grade; o modo Militares usa a sua própria */
    mostrar('#escala-busca-geral', modo !== 'militares');
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

  /* ---------- corpo da grade (por enquanto, só Mês → Agenda) ---------- */

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

  /* estado simples no corpo (vazio, em construção), clonando o molde */
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

  /* desenha o corpo conforme o modo ativo; prontos: Mês → Agenda (dados) e Mês → Calendário (estrutura) */
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
    /* Mês → Calendário: escala do mês em cada dia do calendário (mesma célula do Mês → Agenda) */
    if (modoAtual() === 'mes' && subMesAtual() === 'calendario') {
      if (!window.RosterWork.escalasCalendario) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      window.RosterWork.escalasCalendario.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente });
      return;
    }
    /* modo Militares: grade militares × dias da quinzena (navegação por semana, ±7) */
    if (modoAtual() === 'militares') {
      if (!window.RosterWork.escalasMilitares) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      window.RosterWork.escalasMilitares.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente });
      return;
    }
    /* modo Semana: grade unidades × 7 dias (visão por unidade) */
    if (modoAtual() === 'semana') {
      if (!window.RosterWork.escalasSemana) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      window.RosterWork.escalasSemana.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente });
      return;
    }
    /* modo Dia: árvore de unidades com a distribuição por posto/função */
    if (modoAtual() === 'dia') {
      if (!window.RosterWork.escalasDia) { mostrarEstado(corpo, 'Em construção.'); return; }
      window.RosterWork.escalasDia.renderizar(corpo, { dataRef: refData });
      return;
    }
    /* modo Colunas: grade flexível — Dias (unidades×N dias) ou Unidades (7 dias×unidades ligadas) */
    if (modoAtual() === 'colunas') {
      if (!window.RosterWork.escalasColunas) { mostrarEstado(corpo, 'Em construção.'); return; }
      if (!unidades && idsAplicados().length) { mostrarCarregando(corpo); return; }
      if (tipoColunasAtual() === 'unidades') {
        window.RosterWork.escalasColunas.renderizar(corpo, { tipo: 'unidades', colunas: colunasUnidadesLigadas(), dataRef: refData, vigente: vigente });
      } else {
        window.RosterWork.escalasColunas.renderizar(corpo, { tipo: 'dias', colunas: unidadesColuna(), dataRef: refData, quantidade: quantidadeColunas(), vigente: vigente });
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
    window.RosterWork.escalasMes.renderizar(corpo, { colunas: unidadesColuna(), dataRef: refData, vigente: vigente });
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
    if (modo === 'mes') return formatarMes(refData);
    if (modo === 'militares') {
      /* quinzena: 14 dias a partir do domingo da semana (navega ±7, mostra 14) */
      var domQ = inicioSemana(refData);
      var fimQ = new Date(domQ);
      fimQ.setDate(fimQ.getDate() + 13);
      return formatarIntervalo(domQ, fimQ);
    }
    if (modo === 'colunas' && tipoColunasAtual() === 'dias') {
      var fim = new Date(refData);
      fim.setDate(fim.getDate() + quantidadeColunas() - 1);
      return formatarIntervalo(refData, fim);
    }
    /* semana e colunas→unidades: a semana de domingo a sábado */
    var dom = inicioSemana(refData);
    var sab = new Date(dom);
    sab.setDate(sab.getDate() + 6);
    return formatarIntervalo(dom, sab);
  }

  function atualizarPeriodo() {
    var el = conteudo.querySelector('#escala-periodo-nome');
    if (el) el.textContent = textoPeriodo();
  }

  function navegar(direcao) {
    var modo = modoAtual();
    if (modo === 'dia') {
      refData.setDate(refData.getDate() + direcao);
    } else if (modo === 'mes') {
      /* navega por mês inteiro sem transbordar: em dia 29-31, setMonth sozinho pularia para o mês seguinte */
      var diaMes = refData.getDate();
      refData.setDate(1);
      refData.setMonth(refData.getMonth() + direcao);
      var ultimoDiaMes = new Date(refData.getFullYear(), refData.getMonth() + 1, 0).getDate();
      refData.setDate(Math.min(diaMes, ultimoDiaMes));
    } else if (modo === 'colunas' && tipoColunasAtual() === 'dias') {
      refData.setDate(refData.getDate() + direcao * quantidadeColunas());
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

  /* ---------- busca do sub-cabeçalho (nome/CPF/RG) nos modos de grade ---------- */

  /* aplica a busca ativa nas linhas de militar da grade: no modo Militares não age
     (ele tem a sua própria busca). 'marcar' realça a linha casada e acende a célula;
     'filtrar' esconde as linhas que não casam. */
  function aplicarBuscaEscala() {
    if (!conteudo || !window.RosterWork.busca || modoAtual() === 'militares') return;
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (!corpo) return;
    var RW = window.RosterWork;
    /* limpa o anel das células antes de recolocá-lo nas que casam agora */
    Array.prototype.forEach.call(corpo.querySelectorAll('.escala-mes-celula--busca'), function (cel) {
      cel.classList.remove('escala-mes-celula--busca');
    });
    Array.prototype.forEach.call(corpo.querySelectorAll('.linha-escalado'), function (linha) {
      var casa = RW.busca.casaTexto(buscaTermo, linha.getAttribute('data-busca'));
      linha.classList.toggle('linha-escalado--busca', !!buscaTermo && casa && buscaModo === 'marcar');
      linha.classList.toggle('oculto', !!buscaTermo && !casa && buscaModo === 'filtrar');
      if (buscaTermo && casa) {
        var cel = linha.closest('.escala-mes-celula');
        if (cel) cel.classList.add('escala-mes-celula--busca');
      }
    });
    /* modo Dia: a árvore usa a linha do painel (não há célula de grade); só realça/esconde a linha */
    Array.prototype.forEach.call(corpo.querySelectorAll('.escala-distribuicao-escalado'), function (linha) {
      var casa = RW.busca.casaTexto(buscaTermo, linha.getAttribute('data-busca'));
      linha.classList.toggle('escala-distribuicao-escalado--busca', !!buscaTermo && casa && buscaModo === 'marcar');
      linha.classList.toggle('oculto', !!buscaTermo && !casa && buscaModo === 'filtrar');
    });
  }

  /* reaplica a busca depois que o corpo muda (nova grade, célula atualizada, re-render);
     agenda no próximo quadro para não reprocessar a cada mutação isolada */
  function agendarBuscaEscala() {
    if (buscaAgendada || !buscaTermo) return;
    buscaAgendada = true;
    requestAnimationFrame(function () { buscaAgendada = false; aplicarBuscaEscala(); });
  }

  /* liga a busca do sub-cabeçalho: cria o controle .busca e observa o corpo para reaplicar.
     Observa só childList (a busca só troca classes) para não entrar em laço. */
  function ligarBuscaGeral() {
    var caixa = conteudo.querySelector('#escala-busca-geral');
    if (!caixa || !window.RosterWork.busca) return;
    buscaTermo = '';
    buscaModo = 'marcar';
    buscaCtrl = window.RosterWork.busca.criar({
      caixa: caixa,
      aoBuscar: function (termo, modo) { buscaTermo = termo; buscaModo = modo; aplicarBuscaEscala(); }
    });
    if (buscaObserver) buscaObserver.disconnect();
    var corpo = conteudo.querySelector('.pagina-corpo');
    if (corpo && window.MutationObserver) {
      buscaObserver = new MutationObserver(agendarBuscaEscala);
      buscaObserver.observe(corpo, { childList: true, subtree: true });
    }
  }

  /* a navegação chama isto toda vez que a página de escalas é exibida */
  function iniciar(fragmento) {
    conteudo = fragmento;
    refData = new Date();

    RosterWork.abas.ligar(conteudo.querySelector('#escala-modos'), aplicarModo);
    RosterWork.abas.ligar(conteudo.querySelector('#escala-sub-mes'), renderizarCorpo);
    RosterWork.abas.ligar(conteudo.querySelector('#escala-colunas-tipo'), function () { aplicarTipoColunas(); renderizarCorpo(); });
    RosterWork.abas.ligar(conteudo.querySelector('#escala-colunas-qtd'), function () { atualizarPeriodo(); renderizarCorpo(); });
    /* Colunas → Unidades: ligar/desligar uma unidade muda as colunas → re-renderiza */
    RosterWork.abas.ligar(conteudo.querySelector('#escala-unidades-abas'), renderizarCorpo);

    /* clicar numa célula da grade abre a gaveta de detalhes */
    if (window.RosterWork.escalasPainel) RosterWork.escalasPainel.ligar(conteudo);

    /* busca do modo Militares (menu lateral) e busca do sub-cabeçalho (grade) */
    ligarBuscaMilitares();
    ligarBuscaGeral();

    var btnAnterior = conteudo.querySelector('#escala-periodo-anterior');
    var btnProximo = conteudo.querySelector('#escala-periodo-proximo');
    if (btnAnterior) btnAnterior.addEventListener('click', function () { navegar(-1); });
    if (btnProximo) btnProximo.addEventListener('click', function () { navegar(1); });

    /* clicar no rótulo do período abre o calendário; o dia escolhido vira a referência */
    var rotuloPeriodo = conteudo.querySelector('#escala-periodo-nome');
    if (rotuloPeriodo && window.RosterWork.calendario) {
      window.RosterWork.calendario.ligar(rotuloPeriodo, {
        ancora: conteudo.querySelector('.geral-periodo'),
        obterModo: function () {
          var modo = modoAtual();
          if (modo === 'mes') return 'mes';
          if (modo === 'semana' || modo === 'militares') return 'semana';
          if (modo === 'colunas') return tipoColunasAtual() === 'unidades' ? 'semana' : 'dia';
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
    }

    /* Escala sempre fresca para QUALQUER pessoa: ao entrar, completa no servidor
       qualquer recálculo pendente (a fila) ANTES de montar, para nunca mostrar dado
       velho de um salvamento feito por outro (ou de quem fechou o navegador antes de
       terminar). Fila vazia = verificação rápida. */
    function montarInicial() {
      aplicarModo();        // estado inicial (Mês já vem ativo no HTML) + preenche o período
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
