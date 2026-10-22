/* ============================================================
   TROCAS — Imprimir trocas (o botão Imprimir da barra → painel)
   O painel direito largo, em três caixas: 1. as trocas do mês (as do
   militar e, para o administrador, também as da área dele; todas já
   marcadas), 2. o texto para a Parte (Informo, no passado, ou
   Solicito, no futuro), pronto para copiar, e 3. o PDF (Lista ou
   Registro técnico) com a prévia, refeita a cada mudança (a última
   pedida vale). Os registros das marcadas vêm do banco
   (fn_trocas_impressao), que confere troca a troca quem pode ver.
   No celular o painel fica sem a prévia (o navegador não mostra PDF
   dentro da página). RosterWork.trocasImprimir.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* o mês na data da Parte: três letras com ponto; maio não abrevia */
  var MESES_PARTE = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var LETRAS = 'abcdefghijklmnopqrstuvwxyz';
  var SITUACOES = ['pendente_confirmacao', 'pendente_aprovacao', 'aprovada'];   // as trocas que entram na lista
  var ESPERA = 300;               // ms sem mexer antes de buscar os registros e refazer a prévia
  var LINHAS_TEXTO = { minimo: 4, maximo: 16 };   // a caixa do texto cresce com ele até o máximo (depois rola)

  var form = null;          // o painel aberto: escolhas, dados e peças
  var token = 0;            // latest-wins dos registros e da prévia
  var espera = null;

  function msg() { return RW.mensagens.trocas.imprimir; }
  function fmt() { return RW.trocasFormato; }
  function doisDig(n) { return n < 10 ? '0' + n : '' + n; }
  function hora(t) { return String(t || '08:00').slice(0, 5); }

  function unidades() {
    try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); return p && Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas : []; } catch (e) { return []; }
  }

  /* ---------- o texto para a Parte ---------- */
  /* "2026-10-03" → "3 out. 26" */
  function diaDaParte(iso) {
    var p = String(iso).split('-');
    return Number(p[2]) + ' ' + MESES_PARTE[Number(p[1]) - 1] + ' ' + p[0].slice(2);
  }

  /* a., b., ... z., aa., ab. */
  function letra(i) { return (i < LETRAS.length ? '' : LETRAS[Math.floor(i / LETRAS.length) - 1]) + LETRAS[i % LETRAS.length]; }

  /* "A", "A e B", "A, B e C" */
  function juntar(lista) {
    if (lista.length < 2) return lista.join('');
    return lista.slice(0, -1).join(', ') + msg().parte.e + lista[lista.length - 1];
  }

  /* uma linha por dia de serviço (o serviço e a devolução de cada troca), em ordem de data */
  function itensDosRegistros() {
    var itens = [];
    form.registros.forEach(function (r) { itens = itens.concat(r.itens || []); });
    return itens.sort(function (a, b) {
      return String(a.data).localeCompare(String(b.data)) || hora(a.inicio).localeCompare(hora(b.inicio));
    });
  }

  /* o corpo da Parte: uma linha só vira frase corrida; mais de uma, subitens "a." que terminam em ";" e o último em "." */
  function textoDaParte() {
    var p = msg().parte, tipo = form.texto;
    var frases = itensDosRegistros().map(function (it) {
      var inteiro = hora(it.inicio) === '08:00' && hora(it.fim) === '08:00';
      return p.linha(it.cumpre, p.verbo[tipo], it.no_lugar_de, diaDaParte(it.data),
        inteiro ? '' : p.periodo(RW.horario.curta(hora(it.inicio)), RW.horario.curta(hora(it.fim))));
    });
    if (!frases.length) return '';
    if (frases.length === 1) return tipo === 'informo' ? p.informoUma(frases[0]) : p.solicitoUma(frases[0]);
    var abertura = tipo === 'informo' ? p.informoAbertura(juntar(form.militares)) : p.solicitoAbertura(form.registros.length === 1);
    return [abertura].concat(frases.map(function (f, i) { return letra(i) + '. ' + f + (i === frases.length - 1 ? '.' : ';'); })).join('\n');
  }

  function escreverTexto() {
    var texto = textoDaParte();
    var caixa = form.caixaTexto;
    caixa.value = texto;
    caixa.rows = LINHAS_TEXTO.minimo;
    while (caixa.rows < LINHAS_TEXTO.maximo && caixa.scrollHeight > caixa.clientHeight) caixa.rows++;
  }

  function copiar() {
    var area = form.caixaTexto, botao = form.copiar;
    function falhou() {
      area.select();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().falhaCopiar });
    }
    if (!area.value) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().nenhumaMarcada }); return; }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { falhou(); return; }
    navigator.clipboard.writeText(area.value).then(function () {
      botao.textContent = msg().textoCopiado;
      setTimeout(function () { botao.textContent = msg().copiarTexto; }, 2000);
    }).catch(falhou);
  }

  /* ---------- a lista do mês ---------- */
  /* as do mês, nas situações que entram, que a pessoa troca ou administra; em ordem de data */
  function trocasDoMes() {
    var cpf = RW.sessao.cpf();
    var mes = form.mes.getFullYear() + '-' + doisDig(form.mes.getMonth() + 1);
    return form.todas.filter(function (t) {
      if (SITUACOES.indexOf(t.status) < 0 || String(t.data_servico_solicitante).slice(0, 7) !== mes) return false;
      return t.solicitante_cpf === cpf || t.parceiro_cpf === cpf || RW.sessao.podeAdministrar('pelotao', t.solicitante_lotacao);
    }).sort(function (a, b) {
      return String(a.data_servico_solicitante).localeCompare(String(b.data_servico_solicitante)) || hora(a.horario_inicio).localeCompare(hora(b.horario_inicio));
    });
  }

  function marcarCaixa(botao, sim) {
    botao.setAttribute('aria-checked', sim ? 'true' : 'false');
    botao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', sim);
  }

  function montarItem(t) {
    var item = RW.tpl('tpl-troca-imprimir-item');
    if (!item) return null;
    item.querySelector('.troca-item-a').textContent = fmt().nomeMilitar(t.solicitante_grau, t.solicitante_nome);
    item.querySelector('.troca-item-b').textContent = fmt().nomeMilitar(t.parceiro_grau, t.parceiro_nome);
    item.querySelector('.troca-item-meta').textContent = fmt().metaLista(t);
    var info = fmt().situacao(t.status, !!t.substitui_troca_id);
    var selo = item.querySelector('.troca-item-situacao');
    selo.textContent = info.texto;
    selo.classList.add(info.classe);
    item.addEventListener('click', function () {
      form.marcadas[t.troca_id] = !form.marcadas[t.troca_id];
      marcarCaixa(item, form.marcadas[t.troca_id]);
      contar();
      mudou();
    });
    return item;
  }

  /* a contagem e o "Marcar todas" (marcado quando todas estão) */
  function contar() {
    var ids = idsMarcados();
    form.contagem.textContent = msg().contagem(ids.length, form.doMes.length);
    marcarCaixa(form.todasBotao, ids.length === form.doMes.length);
  }

  function idsMarcados() { return form.doMes.filter(function (t) { return form.marcadas[t.troca_id]; }).map(function (t) { return t.troca_id; }); }

  function mostrarNaLista(molde, texto, pontos) {
    form.lista.textContent = '';
    var el = RW.tpl(molde);
    if (!el) return;
    if (texto) el.textContent = texto;
    var pts = pontos && document.getElementById('carregando-pontos');
    if (pts) el.appendChild(pts.content.cloneNode(true));
    form.lista.appendChild(el);
  }

  /* o mês da tela: todas já marcadas */
  function montarMes() {
    form.nomeMes.textContent = msg().mes(MESES[form.mes.getMonth()], form.mes.getFullYear());
    form.doMes = trocasDoMes();
    form.marcadas = {};
    form.doMes.forEach(function (t) { form.marcadas[t.troca_id] = true; });
    form.todasBotao.classList.toggle('oculto', !form.doMes.length);
    form.contagem.classList.toggle('oculto', !form.doMes.length);
    if (!form.doMes.length) mostrarNaLista('tpl-troca-vazio', msg().vazio);
    else {
      form.lista.textContent = '';
      form.doMes.forEach(function (t) { var el = montarItem(t); if (el) form.lista.appendChild(el); });
    }
    contar();
    mudou();
  }

  function andarMes(n) {
    if (!form.todas) return;
    form.mes = new Date(form.mes.getFullYear(), form.mes.getMonth() + n, 1);
    montarMes();
  }

  /* ---------- os registros, o texto e a prévia ---------- */
  /* cada mudança espera uma pausa, busca os registros das marcadas, escreve o texto e refaz a prévia; a última pedida vale */
  function mudou() {
    var meu = ++token;
    form.pedido = null;
    clearTimeout(espera);
    mostrarCarregando(true);
    espera = setTimeout(function () { buscar(meu); }, ESPERA);
  }

  /* um registro com várias trocas vem uma vez por troca: fica uma vez só */
  function guardarRegistros(r) {
    if (!r || !r.ok) throw new Error('impressao');
    var vistos = {};
    form.registros = (r.registros || []).filter(function (x) {
      var chave = x.registro.numero + '/' + x.registro.ano;
      if (vistos[chave]) return false;
      vistos[chave] = true;
      return true;
    });
    form.militares = r.militares || [];
  }

  function buscar(meu) {
    if (!form || meu !== token) return;
    var ref = form, ids = idsMarcados();
    var promessa = ids.length ? RW.rpc('fn_trocas_impressao', { p_troca_ids: ids }) : Promise.resolve({ ok: true, registros: [], militares: [] });
    promessa.then(function (r) {
      if (form !== ref || meu !== token) return;
      guardarRegistros(r);
      escreverTexto();
      fazerPrevia(meu);
    }).catch(function () {
      if (form !== ref || meu !== token) return;
      form.registros = [];
      form.militares = [];
      escreverTexto();
      mostrarAviso(msg().falhaPrevia);
    });
  }

  /* o PDF das marcadas, no formato escolhido: { arquivo, nome } */
  function pedirArquivo() {
    var regs = form.registros, mes = doisDig(form.mes.getMonth() + 1), ano = form.mes.getFullYear();
    if (!regs.length) return Promise.reject({ nenhuma: true });
    if (form.formato === 'lista') {
      return RW.trocasRelatorioPdf.arquivo(regs, form.nomeMes.textContent).then(function (arq) { return { arquivo: arq, nome: msg().pdf.arquivo(mes, ano) }; });
    }
    var t = RW.mensagens.trocas.registroPdf;
    return RW.trocasRegistroPdf.arquivo(regs).then(function (arq) {
      return { arquivo: arq, nome: regs.length === 1 ? t.arquivo(regs[0].registro.numero, regs[0].registro.ano) : t.arquivoVarios(mes, ano) };
    });
  }

  function mostrarCarregando(sim) { form.carregando.classList.toggle('carregando-veu--visivel', sim); }

  function mostrarAviso(texto) {
    form.aviso.textContent = texto;
    form.aviso.classList.remove('oculto');
    mostrarCarregando(false);
  }

  function fazerPrevia(meu) {
    if (RW.celular && RW.celular()) { mostrarCarregando(false); return; }
    var ref = form;
    form.pedido = { token: meu, promessa: pedirArquivo() };
    form.pedido.promessa.then(function (r) {
      if (form !== ref || meu !== token) return;
      if (form.url) URL.revokeObjectURL(form.url);
      form.url = URL.createObjectURL(r.arquivo);
      /* o leitor do navegador sem a barra dele, na largura do quadro */
      form.previa.src = form.url + '#toolbar=0&navpanes=0&view=FitH';
      form.aviso.classList.add('oculto');
      mostrarCarregando(false);
    }, function (e) {
      if (form !== ref || meu !== token) return;
      mostrarAviso(e && e.nenhuma ? msg().nenhumaMarcada : msg().falhaPrevia);
    });
  }

  /* troca o formato sem buscar de novo (os registros são os mesmos) */
  function trocarFormato(formato) {
    form.formato = formato;
    form.ajudaFormato.textContent = msg().ajudaFormato[formato];
    if (form.registros) { var meu = ++token; mostrarCarregando(true); fazerPrevia(meu); }
  }

  /* ---------- gerar ---------- */
  /* baixa o arquivo da prévia (ou monta agora, se a prévia ainda não saiu) e fecha o painel */
  function gerar() {
    var botao = form.gerar;
    if (!idsMarcados().length) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().nenhumaMarcada }); return; }
    var pronto = form.pedido && form.pedido.token === token;
    var promessa = pronto ? form.pedido.promessa : RW.rpc('fn_trocas_impressao', { p_troca_ids: idsMarcados() }).then(function (r) {
      guardarRegistros(r);
      return pedirArquivo();
    });
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    function terminar() { if (RW.pararCarregando && botao.isConnected) RW.pararCarregando(botao); }
    promessa.then(function (r) {
      terminar();
      RW.escalasImpressaoPdf.baixar(r.arquivo, r.nome);
      if (RW.painel) RW.painel.fechar();
    }).catch(function (e) {
      terminar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: e && e.nenhuma ? msg().nenhumaMarcada : msg().falhaGerar });
    });
  }

  /* ---------- abrir ---------- */
  function fecharLimpo() {
    token++;
    clearTimeout(espera);
    if (form && form.url) URL.revokeObjectURL(form.url);
    form = null;
  }

  function abrir() {
    if (!RW.painel) return;
    fecharLimpo();
    RW.painel.abrir({ titulo: msg().titulo, subtitulo: msg().subtitulo, largo: true, aoFechar: fecharLimpo });
    var corpo = RW.painel.corpo();
    var rodape = RW.painel.rodape();
    var molde = document.getElementById('tpl-troca-imprimir');
    var acoes = document.getElementById('tpl-troca-imprimir-acoes');
    if (!corpo || !molde) return;
    corpo.appendChild(molde.content.cloneNode(true));
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }

    var raiz = document.getElementById('painel');
    function peca(nome) { return raiz.querySelector('[data-imprimir-' + nome + ']'); }
    var hoje = new Date();
    /* as escolhas (mês, marcadas, texto, formato), os dados e as peças do painel */
    form = {
      mes: new Date(hoje.getFullYear(), hoje.getMonth(), 1), texto: 'informo', formato: 'lista',
      todas: null, doMes: [], marcadas: {}, registros: null, militares: [], pedido: null, url: null,
      nomeMes: peca('mes'), todasBotao: peca('todas'), lista: peca('lista'), contagem: peca('contagem'),
      ajudaTexto: peca('texto-ajuda'), caixaTexto: peca('texto-caixa'), copiar: peca('copiar'),
      ajudaFormato: peca('formato-ajuda'), previa: peca('previa'), aviso: peca('previa-aviso'),
      carregando: peca('previa-carregando'), gerar: peca('gerar')
    };
    form.nomeMes.textContent = msg().mes(MESES[form.mes.getMonth()], form.mes.getFullYear());
    form.ajudaTexto.textContent = msg().ajudaTexto.informo;
    form.ajudaFormato.textContent = msg().ajudaFormato.lista;
    form.todasBotao.classList.add('oculto');
    form.contagem.classList.add('oculto');

    peca('mes-anterior').addEventListener('click', function () { andarMes(-1); });
    peca('mes-proximo').addEventListener('click', function () { andarMes(1); });
    form.todasBotao.addEventListener('click', function () {
      var todas = idsMarcados().length !== form.doMes.length;
      form.doMes.forEach(function (t) { form.marcadas[t.troca_id] = todas; });
      Array.prototype.forEach.call(form.lista.querySelectorAll('[role="checkbox"]'), function (item) { marcarCaixa(item, todas); });
      contar();
      mudou();
    });
    RW.abas.ligar(peca('texto'), function (aba) {
      form.texto = aba.getAttribute('data-texto');
      form.ajudaTexto.textContent = msg().ajudaTexto[form.texto];
      if (form.registros) escreverTexto();
    });
    form.copiar.addEventListener('click', copiar);
    RW.abas.ligar(peca('formato'), function (aba) { trocarFormato(aba.getAttribute('data-formato')); });
    peca('cancelar').addEventListener('click', function () { RW.painel.fechar(); });
    form.gerar.addEventListener('click', gerar);

    /* as trocas das unidades da tela, uma vez; o mês filtra aqui */
    var ref = form;
    mostrarNaLista('tpl-troca-vazio', '', true);
    RW.trocasDados.listar(unidades()).then(function (todas) {
      if (form !== ref) return;
      if (!Array.isArray(todas)) throw new Error('lista');
      form.todas = todas;
      montarMes();
    }).catch(function () {
      if (form !== ref) return;
      mostrarNaLista('tpl-troca-vazio', msg().falhaLista);
      mostrarAviso(msg().falhaLista);
    });
  }

  RW.trocasImprimir = { abrir: abrir };
})();
