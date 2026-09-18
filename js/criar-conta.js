/* ============================================================
   CRIAR CONTA — a tela pública onde o militar se cadastra.
   Fica fora do sistema (não é fragmento da SPA): quem chega aqui
   ainda não tem acesso. O cadastro NÃO cria conta nenhuma — vira
   um pedido, e a conta só nasce quando um administrador aprova.
   A tela nunca diz se um CPF já existe: a resposta é sempre a
   mesma, para ninguém varrer CPFs por aqui.

   Reusa o que o sistema já tem, para o cadastro ser IGUAL ao
   "Novo usuário": RosterWork.campos (máscaras, calendário,
   erro no campo), RosterWork.seletorUnidades (a MESMA árvore de
   lotação), RosterWork.apiFetch (fonte única das credenciais) e
   RosterWork.guardaSaida (não perder o formulário sem querer).
   Monta os campos; o envio fica em criar-conta-envio.js.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var C = RW.campos;

  var graus = [];
  var lotacao = null;                           /* instância do seletor de unidades (modo único) */
  var opcoesProntas = Promise.resolve(false);   /* resolve quando postos + árvore terminam de carregar */

  /* dois caminhos de cadastro:
       'novo'  — CPF inédito: ficha em branco, vira pedido para o admin aprovar
       'token' — CPF já pré-cadastrado: dados carregados por token para conferir e criar a senha */
  var modo = 'novo';
  var contextoToken = { cpf: '', token: '' };   /* guarda o par que o envio por token precisa reenviar */

  /* as duas funções do cadastro são públicas (anon); o apiFetch manda a
     chave publicável quando não há sessão, então serve aqui também */
  function rpc(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  function opcoes(menu, itens) {
    if (!menu) return;
    menu.textContent = '';
    var tpl = document.getElementById('tpl-cc-opcao');
    if (!tpl) return;
    itens.forEach(function (item) {
      var botao = tpl.content.cloneNode(true).firstElementChild;
      botao.textContent = item.rotulo;
      botao.setAttribute('data-valor', item.valor);
      menu.appendChild(botao);
    });
  }

  /* ---------- Tipo → Posto → Colocação → promoções ---------- */

  function montarTipos() {
    var vistos = {}, itens = [];
    graus.forEach(function (g) {
      if (vistos[g.tipo]) return;
      vistos[g.tipo] = true;
      itens.push({ rotulo: g.tipo, valor: g.tipo });
    });
    opcoes(document.getElementById('cc-tipo-menu'), itens);
  }

  function aoEscolherTipo(tipo) {
    var doTipo = graus.filter(function (g) { return g.tipo === tipo; });
    opcoes(document.getElementById('cc-posto-menu'), doTipo.map(function (g) {
      return { rotulo: g.nome, valor: String(g.grau_id) };
    }));

    var posto = document.getElementById('cc-posto');
    posto.disabled = false;
    posto.removeAttribute('data-valor');
    var textoPosto = posto.querySelector('.campo-selecao-texto');
    textoPosto.textContent = 'Selecione';
    textoPosto.classList.add('campo-selecao-texto--vazio');

    var colocacao = document.getElementById('cc-colocacao');
    colocacao.disabled = false;
    colocacao.value = '';
    colocacao.placeholder = 'Ex.: 0001';
    document.getElementById('cc-colocacao-rotulo').textContent =
      C.nomeColocacao(doTipo.length ? doTipo[0].quadro : null);

    limparPromocoes();
  }

  function limparPromocoes() {
    document.getElementById('cc-promocoes').textContent = '';
    document.getElementById('cc-promocoes-secao').classList.add('oculto');
  }

  /* um campo de data por grau já percorrido, do mais antigo até o posto escolhido */
  function atualizarPromocoes(grauId) {
    var container = document.getElementById('cc-promocoes');
    container.textContent = '';

    var escolhido = null;
    for (var i = 0; i < graus.length; i++) {
      if (String(graus[i].grau_id) === String(grauId)) { escolhido = graus[i]; break; }
    }
    if (!escolhido) { limparPromocoes(); return; }

    var promos = graus.filter(function (g) {
      return g.quadro === escolhido.quadro && g.antiguidade >= escolhido.antiguidade;
    });
    promos.sort(function (a, b) { return b.antiguidade - a.antiguidade; });

    var tpl = document.getElementById('tpl-cc-promocao');
    if (!tpl) return;
    promos.forEach(function (g) {
      var campo = tpl.content.cloneNode(true).firstElementChild;
      campo.querySelector('.campo-rotulo').textContent = g.abreviacao;
      var input = campo.querySelector('.campo-entrada');
      input.setAttribute('data-grau', g.grau_id);
      C.ligarData(input);
      container.appendChild(campo);
    });
    document.getElementById('cc-promocoes-secao').classList.toggle('oculto', !promos.length);
  }

  /* ---------- lotação: a MESMA árvore do Novo usuário ---------- */
  function prepararLotacao() {
    if (!RW.seletorUnidades) return null;
    var gatilho = document.getElementById('cc-lotacao');
    var texto = document.getElementById('cc-lotacao-texto');
    return RW.seletorUnidades.criar({
      modo: 'unico',
      dropdownEl: document.getElementById('cc-lotacao-dropdown'),
      arvoreEl: document.getElementById('cc-lotacao-arvore'),
      textoEl: texto,
      aoSelecionar: function (unidade) {
        gatilho.setAttribute('data-valor', unidade.unidade_id);
        texto.classList.remove('campo-selecao-texto--vazio');
      }
    });
  }

  /* ---------- máscaras e ligações ---------- */
  function ligarCampos() {
    C.ligarNome(document.getElementById('cc-nome-completo'));
    C.ligarMascara(document.getElementById('cc-cpf'), C.mascararCpf);
    C.ligarMascara(document.getElementById('cc-rg'), C.mascararRg);
    C.ligarMascara(document.getElementById('cc-celular'), C.mascararCelular);
    C.ligarData(document.getElementById('cc-nascimento'));
    C.ligarData(document.getElementById('cc-inclusao'));
    C.ligarNomeDeGuerra(document.getElementById('cc-nome-guerra'));

    C.ligarSelecao(document.getElementById('cc-cnh'));
    C.ligarSelecao(document.getElementById('cc-setor'));
    C.ligarSelecao(document.getElementById('cc-tipo'), aoEscolherTipo);
    C.ligarSelecao(document.getElementById('cc-posto'), atualizarPromocoes);
  }

  /* ---------- há algo digitado? (guarda de saída) ---------- */
  var enviado = false;   /* depois do envio não há mais o que proteger */

  function temAlgoDigitado() {
    if (enviado) return false;
    var campos = document.querySelectorAll('#cc-corpo .campo-entrada');
    for (var i = 0; i < campos.length; i++) {
      if (campos[i].tagName === 'INPUT' && campos[i].value.trim()) return true;
      if (campos[i].tagName === 'BUTTON' && campos[i].getAttribute('data-valor')) return true;
    }
    return false;
  }

  /* ---------- preencher / alternar passos (fluxo "assumir conta") ---------- */

  /* "2018-02-15" -> "15/02/2018" (sem passar por Date, evita fuso) */
  function isoParaBR(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
  }

  /* escreve num campo de seleção o valor E o rótulo (o posto tem valor = id e
     texto = nome, então definirSelecao sozinho não serve) */
  function selecaoComRotulo(gatilho, valor, rotulo) {
    if (!gatilho) return;
    gatilho.setAttribute('data-valor', valor);
    var texto = gatilho.querySelector('.campo-selecao-texto');
    if (!texto) return;
    texto.textContent = rotulo;
    texto.classList.toggle('campo-selecao-texto--vazio', !valor);
  }

  function grauPorId(grauId) {
    for (var i = 0; i < graus.length; i++) {
      if (String(graus[i].grau_id) === String(grauId)) return graus[i];
    }
    return null;
  }

  /* joga os dados da ficha nos campos do passo 2, deixando tudo editável */
  function preencher(dados) {
    if (!dados) return;
    document.getElementById('cc-nome-completo').value = dados.nome_completo || '';
    document.getElementById('cc-cpf').value = C.mascararCpf(C.soDigitos(dados.cpf || ''));
    document.getElementById('cc-rg').value = C.mascararRg(C.soDigitos(dados.rg || ''));
    document.getElementById('cc-nascimento').value = isoParaBR(dados.data_nascimento);
    document.getElementById('cc-celular').value = C.mascararCelular(C.soDigitos(dados.celular || ''));
    document.getElementById('cc-email').value = dados.email || '';
    document.getElementById('cc-nome-guerra').value = dados.nome_de_guerra || '';
    document.getElementById('cc-inclusao').value = isoParaBR(dados.data_de_inclusao);

    C.definirSelecao(document.getElementById('cc-cnh'), dados.cnh);
    C.definirSelecao(document.getElementById('cc-setor'), dados.tipo);

    /* Tipo -> Posto -> Colocação -> promoções (a mesma cascata do preenchimento manual) */
    var grau = grauPorId(dados.grau_hierarquico);
    if (grau) {
      C.definirSelecao(document.getElementById('cc-tipo'), grau.tipo);
      aoEscolherTipo(grau.tipo);
      selecaoComRotulo(document.getElementById('cc-posto'), String(grau.grau_id), grau.nome);
      atualizarPromocoes(grau.grau_id);
    }
    document.getElementById('cc-colocacao').value =
      dados.classificacao ? String(parseInt(dados.classificacao, 10)) : '';

    /* as datas de promoção, na mesma ordem em que a tela as coleta */
    var proms = dados.promocoes || [];
    var camposProm = document.getElementById('cc-promocoes').querySelectorAll('.campo-entrada');
    for (var i = 0; i < camposProm.length && i < proms.length; i++) {
      camposProm[i].value = isoParaBR(proms[i]);
    }

    /* lotação: a mesma árvore; marca a unidade e reflete no gatilho */
    if (lotacao && dados.lotacao_atual) {
      lotacao.aplicarSelecaoPorIds([dados.lotacao_atual]);
      document.getElementById('cc-lotacao').setAttribute('data-valor', dados.lotacao_atual);
      document.getElementById('cc-lotacao-texto').classList.remove('campo-selecao-texto--vazio');
    }
  }

  /* zera o passo 2 (cadastro do zero, quando não há ficha) */
  function limparFormulario() {
    var entradas = document.querySelectorAll('#cc-corpo .campo-entrada');
    for (var i = 0; i < entradas.length; i++) {
      if (entradas[i].tagName === 'INPUT') entradas[i].value = '';
    }
    C.definirSelecao(document.getElementById('cc-cnh'), '');
    C.definirSelecao(document.getElementById('cc-setor'), '');
    C.definirSelecao(document.getElementById('cc-tipo'), '');
    var posto = document.getElementById('cc-posto');
    selecaoComRotulo(posto, '', 'Selecione o tipo antes');
    posto.disabled = true;
    var coloc = document.getElementById('cc-colocacao');
    coloc.value = ''; coloc.disabled = true; coloc.placeholder = 'Selecione o tipo antes';
    document.getElementById('cc-colocacao-rotulo').textContent = 'Colocação';
    limparPromocoes();
    if (C.limparErros) C.limparErros(document.getElementById('cc-corpo'));
  }

  /* ---------- alternar entre os passos ---------- */
  function mostrarPasso2() {
    document.getElementById('cc-passo1').classList.add('oculto');
    document.getElementById('cc-corpo').classList.remove('oculto');
  }
  function voltarPasso1() {
    document.getElementById('cc-corpo').classList.add('oculto');
    document.getElementById('cc-passo1').classList.remove('oculto');
  }

  /* ---------- resgate por token: o que a pessoa confere, não edita ----------
     CPF é a identidade que casou com o token; posto, lotação e promoções mudam
     por evento (Promover/Transferir), então aqui ficam só para conferência */
  function travarConferencia() {
    ['cc-cpf', 'cc-tipo', 'cc-posto', 'cc-lotacao'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.disabled = true;
    });
    var proms = document.getElementById('cc-promocoes').querySelectorAll('.campo-entrada');
    for (var i = 0; i < proms.length; i++) proms[i].disabled = true;
  }
  /* volta a liberar o que o token havia travado (posto segue a cargo da cascata do Tipo) */
  function destravarConferencia() {
    ['cc-cpf', 'cc-tipo', 'cc-lotacao'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.disabled = false;
    });
  }

  function trocarNota(mostrarToken) {
    document.getElementById('cc-nota-novo').classList.toggle('oculto', mostrarToken);
    document.getElementById('cc-nota-token').classList.toggle('oculto', !mostrarToken);
  }
  function rotularEnvio(chave) {
    var b = document.getElementById('cc-enviar');
    if (b) b.textContent = RW.mensagens.botoes[chave];
  }

  /* entra no passo 2 no caminho do token: ficha carregada, conferência travada */
  function iniciarModoToken(cpf, token, dados) {
    modo = 'token';
    contextoToken = { cpf: cpf, token: token };
    preencher(dados);
    travarConferencia();
    trocarNota(true);
    rotularEnvio('criarConta');
    mostrarPasso2();
  }

  /* entra no passo 2 no caminho do cadastro novo: tudo em branco */
  function iniciarModoNovo(cpf) {
    modo = 'novo';
    contextoToken = { cpf: '', token: '' };
    limparFormulario();
    destravarConferencia();
    document.getElementById('cc-cpf').value = C.mascararCpf(C.soDigitos(cpf || ''));
    trocarNota(false);
    rotularEnvio('enviarCadastro');
    mostrarPasso2();
  }

  /* ---------- entrada ----------
     quem já está logado nem chega aqui: o criar-conta-sessao.js (head)
     desviou para o sistema antes do corpo pintar */
  function iniciar() {
    document.getElementById('cc-voltar-login').addEventListener('click', function () {
      window.location.href = 'login.html';
    });
    ligarCampos();
    lotacao = prepararLotacao();
    var arvoreP = lotacao ? Promise.resolve(lotacao.montarArvore()) : Promise.resolve();

    /* fechar ou recarregar com o formulário preenchido avisa antes */
    if (RW.guardaSaida) RW.guardaSaida.registrar(temAlgoDigitado);

    var voltar2 = document.getElementById('cc-p2-voltar');
    if (voltar2) voltar2.addEventListener('click', voltarPasso1);

    /* postos e árvore carregam em segundo plano; o passo 1 não fica preso esperando */
    var opcoesP = rpc('cadastro_opcoes')
      .then(function (dados) {
        if (!dados || !dados.graus) { falharOpcoes(); return false; }
        graus = dados.graus;
        montarTipos();
        return true;
      })
      .catch(function () { falharOpcoes(); return false; });
    opcoesProntas = Promise.all([opcoesP, arvoreP]).then(function () { return true; });

    if (RW.criarContaEnvio) RW.criarContaEnvio.ligar(rpc);
  }

  /* sem os postos não dá para cadastrar: avisa em vez de deixar o seletor vazio */
  function falharOpcoes() {
    RW.avisar({
      tipo: 'erro',
      mensagem: RW.mensagens.criarConta.falhaOpcoes,
      aoConfirmar: function () { window.location.reload(); }
    });
  }

  RW.criarConta = {
    marcarEnviado: function () { enviado = true; },
    iniciarModoToken: iniciarModoToken,
    iniciarModoNovo: iniciarModoNovo,
    voltarPasso1: voltarPasso1,
    aguardarOpcoes: function () { return opcoesProntas; },
    modo: function () { return modo; },
    contextoToken: function () { return contextoToken; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
