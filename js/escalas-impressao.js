/* ============================================================
   ESCALAS — Imprimir escala (painel → PDF)
   O botão do sub-cabeçalho abre o painel direito "Imprimir escala":
   datas De/Até (já com o dia exibido) + atalhos, a árvore de
   unidades (já marcada com o seletor do cabeçalho), o resumo e o
   aviso de erro grave do período. "Gerar PDF" busca a escala no
   banco em blocos pequenos (escala_impressao) e entrega ao
   escalas-impressao-pdf.js, que monta e baixa o arquivo.
   Limite: 31 dias por arquivo (o banco confere de novo).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var LIMITE_DIAS = 31;
  var UNIDADE_DIAS_POR_BLOCO = 28;   // cada chamada ao banco cobre até ~28 unidade×dia (fica em poucos segundos)
  var BLOCOS_SIMULTANEOS = 3;
  var ESPERA_AVISO = 400;            // ms sem mexer antes de conferir o erro grave
  var TIPOS_COM_ESCALA = ['CIA', 'CIBM', 'PEL'];

  var form = null;        // { raiz, inicio, fim, arvore, resumo, aviso, gerar, seletor }
  var tokenAviso = 0;     // latest-wins da conferência de erro grave
  var esperaAviso = null;

  function msg() { return (RW.mensagens.escala && RW.mensagens.escala.impressao) || {}; }

  /* ---------- datas ---------- */
  function somarDias(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function diasEntre(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); }

  /* ---------- unidades ---------- */
  function idsAplicados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  /* só CIA/CIBM/PEL têm escala; as outras marcadas na árvore são só o caminho */
  function unidadesComEscala() {
    if (!form || !form.seletor) return [];
    return form.seletor.unidadesSelecionadas().filter(function (u) { return TIPOS_COM_ESCALA.indexOf(u.tipo) >= 0; });
  }

  /* ---------- leitura e validação do formulário ---------- */
  /* devolve { inicio, fim, ids } ou null; com mostrar=true marca os erros nos campos */
  function lerFormulario(mostrar) {
    var m = msg();
    var inicio = RW.data.paraData(form.inicio.value);
    var fim = RW.data.paraData(form.fim.value);
    var ok = true;
    function erro(el, texto) { ok = false; if (mostrar && RW.campos) RW.campos.marcarErro(el, texto); }
    if (mostrar && RW.campos) RW.campos.limparErros(form.raiz);
    if (!inicio) erro(form.inicio, m.dataInvalida);
    if (!fim) erro(form.fim, m.dataInvalida);
    if (inicio && fim && diasEntre(inicio, fim) < 0) erro(form.fim, m.fimAntesInicio);
    if (inicio && fim && diasEntre(inicio, fim) >= LIMITE_DIAS) erro(form.fim, m.limiteDias);
    var unidades = unidadesComEscala();
    if (!unidades.length) erro(form.arvore, (RW.mensagens.distribuicao && RW.mensagens.distribuicao.selecioneUnidade) || '');
    if (!ok) return null;
    return { inicio: inicio, fim: fim, ids: unidades.map(function (u) { return u.unidade_id; }), unidades: unidades };
  }

  /* resumo "3 dias · 2 unidades" + conferência do erro grave (com espera; a última pedida vale) */
  function atualizar() {
    var v = lerFormulario(false);
    form.resumo.textContent = v ? msg().resumo(diasEntre(v.inicio, v.fim) + 1, v.ids.length) : '';
    form.aviso.classList.add('oculto');
    var token = ++tokenAviso;
    clearTimeout(esperaAviso);
    if (!v || !RW.escalasDados) return;
    esperaAviso = setTimeout(function () {
      RW.escalasDados.lerImpressaoErros(v.ids, RW.data.paraIsoDeData(v.inicio), RW.data.paraIsoDeData(v.fim)).then(function (lista) {
        if (token !== tokenAviso || !form || !Array.isArray(lista) || !lista.length) return;
        mostrarAviso(lista);
      });
    }, ESPERA_AVISO);
  }

  /* "13/10 (2ºPEL), 14/10 (2ºPEL e 3ºPEL)": agrupa por dia */
  function mostrarAviso(lista) {
    var porDia = {}, ordem = [];
    lista.forEach(function (e) {
      if (!porDia[e.data]) { porDia[e.data] = []; ordem.push(e.data); }
      porDia[e.data].push(e.unidade);
    });
    var partes = ordem.map(function (iso) {
      var nomes = porDia[iso];
      var unidades = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
      return iso.slice(8, 10) + '/' + iso.slice(5, 7) + ' (' + unidades + ')';
    });
    form.aviso.querySelector('.impacto-aviso-titulo').textContent = msg().avisoTitulo(ordem.length);
    form.aviso.querySelector('.impacto-aviso-desc').textContent = msg().avisoDescricao(partes.join(', '));
    form.aviso.classList.remove('oculto');
  }

  /* atalhos: o período sempre parte da data "De" */
  function aplicarAtalho(tipo) {
    var inicio = RW.data.paraData(form.inicio.value);
    if (!inicio) return;
    var fim = inicio;
    if (tipo === 'semana') fim = somarDias(inicio, 6);
    if (tipo === 'mes') fim = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
    form.fim.value = RW.data.paraBR(fim);
    if (RW.campos) RW.campos.limparErros(form.raiz);
    atualizar();
  }

  /* ---------- gerar: busca em blocos e entrega ao PDF ---------- */
  function blocosDoPeriodo(inicio, fim, nUnidades) {
    var porBloco = Math.max(1, Math.floor(UNIDADE_DIAS_POR_BLOCO / Math.max(1, nUnidades)));
    var blocos = [];
    for (var d = inicio; diasEntre(d, fim) >= 0; d = somarDias(d, porBloco)) {
      var f = somarDias(d, porBloco - 1);
      if (diasEntre(f, fim) < 0) f = fim;
      blocos.push([RW.data.paraIsoDeData(d), RW.data.paraIsoDeData(f)]);
    }
    return blocos;
  }

  /* busca os blocos (no máximo BLOCOS_SIMULTANEOS ao mesmo tempo); rejeita se algum falhar */
  function buscarPeriodo(ids, blocos) {
    var resultados = new Array(blocos.length);
    var proximo = 0;
    function trabalhar() {
      if (proximo >= blocos.length) return Promise.resolve();
      var i = proximo++;
      return RW.escalasDados.lerImpressao(ids, blocos[i][0], blocos[i][1]).then(function (r) {
        if (!r || !Array.isArray(r.dias)) throw new Error('falha');
        resultados[i] = r;
        return trabalhar();
      });
    }
    var filas = [];
    for (var k = 0; k < Math.min(BLOCOS_SIMULTANEOS, blocos.length); k++) filas.push(trabalhar());
    return Promise.all(filas).then(function () {
      return {
        unidades: resultados[0].unidades || [],
        dias: resultados.reduce(function (acc, r) { return acc.concat(r.dias); }, [])
      };
    });
  }

  function gerar() {
    var v = lerFormulario(true);
    if (!v) return;
    var botao = form.gerar;
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    function terminar() { if (RW.pararCarregando && botao.isConnected) RW.pararCarregando(botao); }
    buscarPeriodo(v.ids, blocosDoPeriodo(v.inicio, v.fim, v.ids.length)).then(function (dados) {
      dados.inicio = RW.data.paraIsoDeData(v.inicio);
      dados.fim = RW.data.paraIsoDeData(v.fim);
      return RW.escalasImpressaoPdf.gerar(dados);
    }).then(function () {
      terminar();
      if (RW.painel) RW.painel.fechar();
    }).catch(function () {
      terminar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().falhaGerar });
    });
  }

  /* ---------- abrir ---------- */
  /* opcoes: { data } = o dia que a escala mostra (a data padrão) */
  function abrir(opcoes) {
    if (!RW.painel) return;
    var m = msg();
    RW.painel.abrir({ titulo: m.titulo, subtitulo: m.subtitulo, aoFechar: function () { form = null; tokenAviso++; clearTimeout(esperaAviso); } });
    var corpo = RW.painel.corpo();
    var rodape = RW.painel.rodape();
    var molde = document.getElementById('tpl-escala-impressao');
    var acoes = document.getElementById('tpl-escala-impressao-acoes');
    if (!corpo || !molde) return;
    corpo.appendChild(molde.content.cloneNode(true));
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }

    var raiz = document.getElementById('painel');
    form = {
      raiz: raiz,
      inicio: raiz.querySelector('[data-impressao-inicio]'),
      fim: raiz.querySelector('[data-impressao-fim]'),
      arvore: raiz.querySelector('[data-impressao-arvore]'),
      resumo: raiz.querySelector('[data-impressao-resumo]'),
      aviso: raiz.querySelector('[data-impressao-aviso]'),
      gerar: raiz.querySelector('[data-impressao-gerar]'),
      seletor: null
    };

    var data = (opcoes && opcoes.data) || new Date();
    form.inicio.value = RW.data.paraBR(data);
    form.fim.value = RW.data.paraBR(data);
    if (RW.campos) { RW.campos.ligarData(form.inicio); RW.campos.ligarData(form.fim); }
    [form.inicio, form.fim].forEach(function (el) {
      el.addEventListener('input', function () { if (RW.campos) RW.campos.limparErro(el); atualizar(); });
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-impressao-atalho]'), function (b) {
      b.addEventListener('click', function () { aplicarAtalho(b.getAttribute('data-impressao-atalho')); });
    });
    raiz.querySelector('[data-impressao-cancelar]').addEventListener('click', function () { RW.painel.fechar(); });
    form.gerar.addEventListener('click', gerar);

    /* a mesma árvore do seletor do cabeçalho, solta no painel e já marcada com a seleção aplicada */
    if (RW.seletorUnidades) {
      var ref = form;
      form.seletor = RW.seletorUnidades.criar({
        modo: 'multi',
        arvoreEl: form.arvore,
        aoMudar: function () { if (RW.campos) RW.campos.limparErro(form.arvore); atualizar(); }
      });
      form.seletor.montarArvore().then(function () {
        if (form !== ref) return;   // o painel fechou ou reabriu enquanto carregava
        form.seletor.aplicarSelecaoPorIds(idsAplicados());
        atualizar();
      });
    }
  }

  RW.escalasImpressao = { abrir: abrir };
})();
