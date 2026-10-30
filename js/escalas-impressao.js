/* ============================================================
   ESCALAS — Imprimir escala (painel → PDF)
   O botão do sub-cabeçalho abre o painel direito "Imprimir escala",
   em caixas numeradas: 1. datas De/Até (já com o dia exibido) +
   atalhos; 2. a árvore de unidades (as marcas de começo e o recorte
   na companhia: escalas-impressao-unidades.js); 3. o resumo, o
   aviso de erro grave do período e a prévia (o próprio PDF, no
   leitor do navegador), refeita a cada mudança (a última pedida
   vale). O arquivo busca a escala no banco em blocos pequenos
   (escala_impressao) e o escalas-impressao-pdf.js monta; o Gerar
   PDF baixa o mesmo arquivo da prévia. No celular, sem a prévia (o
   navegador não mostra PDF dentro da página).
   Limite: 31 dias por arquivo (o banco confere de novo).
   O Imprimir do painel do dia (subcabeçalho da aba Dia, só na
   Escala) abre o mesmo formulário numa sub-tela, no lugar da lista,
   marcado com o dia e a unidade do painel; desligado enquanto há
   alteração não salva (o PDF sai do que está gravado).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var LIMITE_DIAS = 31;
  var UNIDADE_DIAS_POR_BLOCO = 28;   // cada chamada ao banco cobre até ~28 unidade×dia (fica em poucos segundos)
  var BLOCOS_SIMULTANEOS = 3;
  var ESPERA_AVISO = 400;            // ms sem mexer antes de conferir o erro grave
  var ESPERA_PREVIA = 400;           // ms sem mexer antes de refazer a prévia
  var TIPOS_COM_ESCALA = ['CIA', 'CIBM', 'PEL'];

  var form = null;        // as peças do formulário aberto, o seletor, a saída (aoSair), o arquivo pedido e a url da prévia
  var tokenAviso = 0;     // latest-wins da conferência de erro grave
  var esperaAviso = null;
  var tokenPrevia = 0;    // latest-wins da prévia
  var esperaPrevia = null;

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
  /* devolve { inicio, fim, ids, unidades } ou { erro } (o primeiro problema, que a prévia mostra); com mostrar=true
     marca os erros nos campos */
  function lerFormulario(mostrar) {
    var m = msg();
    var inicio = RW.data.paraData(form.inicio.value);
    var fim = RW.data.paraData(form.fim.value);
    var primeiro = '';
    function erro(el, texto) { if (!primeiro) primeiro = texto || ' '; if (mostrar && RW.campos) RW.campos.marcarErro(el, texto); }
    if (mostrar && RW.campos) RW.campos.limparErros(form.raiz);
    if (!inicio) erro(form.inicio, m.dataInvalida);
    if (!fim) erro(form.fim, m.dataInvalida);
    if (inicio && fim && diasEntre(inicio, fim) < 0) erro(form.fim, m.fimAntesInicio);
    if (inicio && fim && diasEntre(inicio, fim) >= LIMITE_DIAS) erro(form.fim, m.limiteDias);
    var unidades = unidadesComEscala();
    if (!unidades.length) erro(form.arvore, (RW.mensagens.distribuicao && RW.mensagens.distribuicao.selecioneUnidade) || '');
    if (primeiro) return { erro: primeiro };
    return { inicio: inicio, fim: fim, ids: unidades.map(function (u) { return u.unidade_id; }), unidades: unidades };
  }

  /* resumo "3 dias · 2 unidades", a prévia e a conferência do erro grave (com espera; a última pedida vale) */
  function atualizar() {
    var v = lerFormulario(false);
    form.resumo.textContent = v.erro ? '' : msg().resumo(diasEntre(v.inicio, v.fim) + 1, v.ids.length);
    form.aviso.classList.add('oculto');
    agendarPrevia(v);
    var token = ++tokenAviso;
    clearTimeout(esperaAviso);
    if (v.erro || !RW.escalasDados) return;
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

  /* o arquivo das escolhas ({ arquivo, nome }): busca a escala em blocos e monta o PDF. As mesmas escolhas reaproveitam
     o arquivo já pedido (a prévia e o Gerar PDF são o mesmo arquivo); o que falhou é pedido de novo */
  function pedirArquivo(v) {
    var inicio = RW.data.paraIsoDeData(v.inicio), fim = RW.data.paraIsoDeData(v.fim);
    var chave = v.ids.join(',') + '|' + inicio + '|' + fim;
    if (form.arquivo && form.arquivo.chave === chave) return form.arquivo.promessa;
    var ref = form;
    var promessa = buscarPeriodo(v.ids, blocosDoPeriodo(v.inicio, v.fim, v.ids.length)).then(function (dados) {
      dados.inicio = inicio;
      dados.fim = fim;
      return RW.escalasImpressaoPdf.montar(dados);
    });
    ref.arquivo = { chave: chave, promessa: promessa };
    promessa.catch(function () { if (ref.arquivo && ref.arquivo.promessa === promessa) ref.arquivo = null; });
    return promessa;
  }

  /* ---------- prévia: o próprio PDF, no leitor do navegador (no celular não aparece) ---------- */
  function mostrarCarregandoPrevia(sim) {
    form.carregando.classList.toggle('carregando-veu--visivel', sim);
  }

  function mostrarAvisoPrevia(texto) {
    form.previaAviso.textContent = texto;
    form.previaAviso.classList.remove('oculto');
    mostrarCarregandoPrevia(false);
  }

  /* refeita depois de uma pausa sem mexer; a última pedida vale. Formulário incompleto: o motivo no lugar da prévia */
  function agendarPrevia(v) {
    var token = ++tokenPrevia;
    clearTimeout(esperaPrevia);
    if (RW.celular && RW.celular()) return;
    if (v.erro) { mostrarAvisoPrevia(v.erro); return; }
    mostrarCarregandoPrevia(true);
    esperaPrevia = setTimeout(function () { fazerPrevia(token, v); }, ESPERA_PREVIA);
  }

  function fazerPrevia(token, v) {
    if (!form || token !== tokenPrevia) return;
    var ref = form;
    pedirArquivo(v).then(function (r) {
      if (form !== ref || token !== tokenPrevia) return;
      if (form.url) URL.revokeObjectURL(form.url);
      form.url = URL.createObjectURL(r.arquivo);
      /* o leitor do navegador sem a barra dele, na largura do quadro */
      form.previa.src = form.url + '#toolbar=0&navpanes=0&view=FitH';
      form.previaAviso.classList.add('oculto');
      mostrarCarregandoPrevia(false);
    }, function () {
      if (form !== ref || token !== tokenPrevia) return;
      mostrarAvisoPrevia(msg().falhaPrevia);
    });
  }

  /* ---------- gerar: baixa o arquivo da prévia (ou monta agora, se ela ainda não saiu) ---------- */
  function gerar() {
    var v = lerFormulario(true);
    if (v.erro) return;
    var ref = form;
    var botao = form.gerar;
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    function terminar() { if (RW.pararCarregando && botao.isConnected) RW.pararCarregando(botao); }
    pedirArquivo(v).then(function (r) {
      terminar();
      RW.escalasImpressaoPdf.baixar(r.arquivo, r.nome);
      if (form === ref) sair();   // o formulário ainda está na tela: o painel fecha (ou a sub-tela volta ao dia)
    }).catch(function () {
      terminar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().falhaGerar });
    });
  }

  /* ---------- abrir ---------- */
  /* o formulário saiu da tela (o painel fechou, ou a sub-tela voltou ao dia): para a conferência de erro grave e a
     prévia */
  function esquecer() {
    if (form && form.url) URL.revokeObjectURL(form.url);
    form = null;
    tokenAviso++;
    clearTimeout(esperaAviso);
    tokenPrevia++;
    clearTimeout(esperaPrevia);
  }

  /* Cancelar e o fim do Gerar PDF: o painel próprio fecha; a sub-tela do painel do dia volta à lista */
  function sair() {
    var aoSair = form && form.aoSair;
    esquecer();
    if (aoSair) aoSair();
  }

  /* põe o formulário em corpo e rodape. opcoes: { data, ids, aoSair } = a data padrão, as unidades já marcadas e a
     saída (Cancelar e o fim do Gerar PDF) */
  function montarFormulario(corpo, rodape, opcoes) {
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
      seta: raiz.querySelector('[data-impressao-toggle]'),
      previa: raiz.querySelector('[data-impressao-previa]'),
      previaAviso: raiz.querySelector('[data-impressao-previa-aviso]'),
      carregando: raiz.querySelector('[data-impressao-previa-carregando]'),
      gerar: raiz.querySelector('[data-impressao-gerar]'),
      seletor: null,
      aoSair: opcoes.aoSair,
      arquivo: null,
      url: null
    };

    form.inicio.value = RW.data.paraBR(opcoes.data);
    form.fim.value = RW.data.paraBR(opcoes.data);
    if (RW.campos) { RW.campos.ligarData(form.inicio); RW.campos.ligarData(form.fim); }
    [form.inicio, form.fim].forEach(function (el) {
      el.addEventListener('input', function () { if (RW.campos) RW.campos.limparErro(el); atualizar(); });
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-impressao-atalho]'), function (b) {
      b.addEventListener('click', function () { aplicarAtalho(b.getAttribute('data-impressao-atalho')); });
    });
    raiz.querySelector('[data-impressao-cancelar]').addEventListener('click', sair);
    form.gerar.addEventListener('click', gerar);

    /* a mesma árvore do seletor do cabeçalho, solta no painel: marcada com opcoes.ids e a companhia de cada pelotão e,
       para quem é de companhia ou pelotão, começando na companhia (escalas-impressao-unidades.js) */
    if (RW.seletorUnidades && RW.escalasImpressaoUnidades) {
      var ref = form;
      form.seletor = RW.seletorUnidades.criar({
        modo: 'multi',
        arvoreEl: form.arvore,
        aoMudar: function () { if (RW.campos) RW.campos.limparErro(form.arvore); atualizar(); }
      });
      RW.escalasImpressaoUnidades.montar(form.seletor, form.seta, opcoes.ids).then(function () {
        /* o formulário saiu ou reabriu enquanto carregava (na sub-tela, também a troca de aba do painel) */
        if (form !== ref || !ref.inicio.isConnected) return;
        atualizar();
      });
    }
  }

  /* o painel próprio (o Imprimir da barra no Militares). opcoes: { data } = o dia que a escala mostra (a data padrão);
     as unidades vêm marcadas com a seleção do cabeçalho (e a companhia de cada pelotão) */
  function abrir(opcoes) {
    if (!RW.painel) return;
    var m = msg();
    RW.painel.abrir({ titulo: m.titulo, subtitulo: m.subtitulo, aoFechar: esquecer });
    montarFormulario(RW.painel.corpo(), RW.painel.rodape(), {
      data: (opcoes && opcoes.data) || new Date(),
      ids: idsAplicados(),
      aoSair: function () { RW.painel.fechar(); }
    });
  }

  /* ---------- o Imprimir do painel do dia (subcabeçalho da aba Dia; escalas-painel-editar.js) ---------- */

  /* com alteração não salva (o rodapé largo da página à vista, também enquanto grava), o PDF sairia sem ela: o botão
     fica desligado e a dica diz o motivo */
  function atualizarBotaoDoDia(botao) {
    var b = botao || document.querySelector('#painel .escala-dia-imprimir');
    if (!b) return;
    if (!b.dataset.dicaPadrao) b.dataset.dicaPadrao = b.getAttribute('data-dica') || '';
    var pendente = !!(RW.escalasPainelSalvar && RW.escalasPainelSalvar.contar());
    b.disabled = pendente;
    b.setAttribute('data-dica', pendente ? msg().salveAntes : b.dataset.dicaPadrao);
  }

  /* o botão do subcabeçalho; null fora da Escala (o formulário mora no escalas.html). aoClicar abre a sub-tela */
  function botaoDoDia(aoClicar) {
    if (!document.getElementById('tpl-escala-impressao')) return null;
    var b = RW.tpl('tpl-escala-dia-imprimir');
    if (!b) return null;
    atualizarBotaoDoDia(b);
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* a sub-tela, no lugar da lista do dia: o Voltar ao dia, o formulário marcado com o dia e a unidade do painel e o
     Cancelar · Gerar PDF. opcoes: { unidadeId, iso, aoSair } (aoSair: o Voltar ao dia, o Cancelar e o fim do Gerar
     PDF; a lista volta a desenhar o corpo e o rodapé, que sai limpo daqui) */
  function abrirNoDia(corpo, rodape, opcoes) {
    if (!corpo) return;
    corpo.textContent = '';
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    var voltar = RW.tpl('tpl-escala-sub-voltar');
    if (voltar) { voltar.addEventListener('click', sair); corpo.appendChild(voltar); }
    montarFormulario(corpo, rodape, {
      data: RW.data.paraData(RW.data.isoParaBR(opcoes.iso)),
      ids: [opcoes.unidadeId],
      aoSair: function () {
        if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
        opcoes.aoSair();
      }
    });
  }

  /* o rascunho do painel do dia mudou, ou foi salvo: o Imprimir liga ou desliga */
  ['rosterwork_escala_rascunho', 'rosterwork_extra_rascunho', 'rosterwork_escala_salva'].forEach(function (nome) {
    window.addEventListener(nome, function () { atualizarBotaoDoDia(); });
  });

  RW.escalasImpressao = { abrir: abrir, botaoDoDia: botaoDoDia, abrirNoDia: abrirNoDia };
})();
