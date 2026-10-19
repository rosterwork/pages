/* ============================================================
   CRIAR CONTA — a tela aberta pelo link de cadastro que o
   administrador gera na ficha. Fica fora do sistema (não é
   fragmento da SPA): quem chega aqui ainda não tem acesso.
   O link e o CPF são conferidos no criar-conta-link.js; aqui a
   ficha que o administrador cadastrou aparece para conferir:
   e-mail e celular são da pessoa e valem na hora; o resto que
   ela corrigir vai para a aprovação de um administrador; CPF,
   posto, lotação e as datas de promoção já gravadas ficam só
   para conferência (as datas vazias ela pode preencher, e elas
   também vão para a aprovação).

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

  var contexto = { cpf: '', codigo: '' };   /* o CPF conferido e o código do link, que o envio reenvia (e se a ficha veio sem colocação) */

  /* as funções desta tela são públicas (anon); o apiFetch manda a
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

  /* ---------- datas de promoção: um campo por posto depois do primeiro (a regra do Novo usuário) ---------- */

  var postoEscolhido = null;   /* grau_id do Posto */
  var datasFicha = {};         /* as datas já gravadas, por grau_id (ISO): ficam travadas */
  var datasDigitadas = {};     /* o que a pessoa digitou nas vazias: volta se o campo some e reaparece */

  function limparPromocoes() {
    postoEscolhido = null;
    datasDigitadas = {};
    atualizarPromocoes();
  }

  /* os graus no formato de buscar_graus_hierarquicos, que a regra dos postos lê */
  function grausDaRegra() {
    return graus.map(function (g) {
      return { grau_id: g.grau_id, grau_nome: g.nome, grau_abreviacao: g.abreviacao, quadro: g.quadro, grau_antiguidade: g.antiguidade };
    });
  }

  /* os campos seguem o Posto e a data de inclusão (que diz o primeiro posto da praça): os da carreira
     e, do oficial, as datas como praça */
  function atualizarPromocoes() {
    var inclusao = RW.validacoes.parseData(document.getElementById('cc-inclusao').value);
    var postos = C.postosComData(grausDaRegra(), postoEscolhido, inclusao, Object.keys(datasFicha));
    montarDatas('cc-promocoes-secao', 'cc-promocoes', postos.carreira);
    montarDatas('cc-promocoes-praca-secao', 'cc-promocoes-praca', postos.praca);
  }

  /* refaz os campos de uma seção só quando a lista de postos muda; a data gravada vem travada */
  function montarDatas(idSecao, idLista, postos) {
    var lista = document.getElementById(idLista);
    var chave = postos.map(function (g) { return g.grau_id; }).join(',');
    if (lista.getAttribute('data-postos') === chave) return;
    lista.setAttribute('data-postos', chave);
    lista.textContent = '';
    var tpl = document.getElementById('tpl-cc-promocao');
    if (!tpl) return;
    postos.forEach(function (g) {
      var campo = tpl.content.cloneNode(true).firstElementChild;
      campo.querySelector('.campo-rotulo').textContent = g.grau_abreviacao;
      var input = campo.querySelector('.campo-entrada');
      input.setAttribute('data-grau', g.grau_id);
      var gravada = datasFicha[String(g.grau_id)];
      if (gravada) {
        input.value = isoParaBR(gravada);
        input.disabled = true;
      } else {
        input.value = datasDigitadas[g.grau_id] || '';
        C.ligarData(input);
        C.ligarValidacao(input, function (v) { return RW.validacoes.parseData(v) ? null : RW.mensagens.cadastro.dataInvalida; });
        input.addEventListener('input', function () { datasDigitadas[g.grau_id] = input.value; });
      }
      lista.appendChild(campo);
    });
    document.getElementById(idSecao).classList.toggle('oculto', !postos.length);
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

    /* a inclusão diz o primeiro posto da praça: as datas acompanham */
    document.getElementById('cc-inclusao').addEventListener('input', atualizarPromocoes);

    C.ligarSelecao(document.getElementById('cc-cnh'));
    C.ligarSelecao(document.getElementById('cc-setor'));
    C.ligarSelecao(document.getElementById('cc-tipo'), aoEscolherTipo);
    C.ligarSelecao(document.getElementById('cc-posto'), function (valor) { postoEscolhido = valor; atualizarPromocoes(); });
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

  /* ---------- preencher / alternar passos ---------- */

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

  /* joga os dados da ficha nos campos do passo 2 */
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

    /* as datas de promoção já gravadas, por posto: entram travadas */
    datasFicha = {};
    (dados.datas || []).forEach(function (d) { datasFicha[String(d.grau_id)] = d.data; });

    /* Tipo -> Posto -> Colocação -> datas de promoção (a mesma cascata do preenchimento manual) */
    var grau = grauPorId(dados.grau_hierarquico);
    if (grau) {
      C.definirSelecao(document.getElementById('cc-tipo'), grau.tipo);
      aoEscolherTipo(grau.tipo);
      selecaoComRotulo(document.getElementById('cc-posto'), String(grau.grau_id), grau.nome);
      postoEscolhido = grau.grau_id;
      atualizarPromocoes();
    }
    /* "0000" = sem colocação: o campo abre vazio */
    var colocacao = parseInt(dados.classificacao, 10);
    document.getElementById('cc-colocacao').value = colocacao ? String(colocacao) : '';

    /* lotação: a mesma árvore; marca a unidade e reflete no gatilho */
    if (lotacao && dados.lotacao_atual) {
      lotacao.aplicarSelecaoPorIds([dados.lotacao_atual]);
      document.getElementById('cc-lotacao').setAttribute('data-valor', dados.lotacao_atual);
      document.getElementById('cc-lotacao-texto').classList.remove('campo-selecao-texto--vazio');
    }
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

  /* ---------- o que a pessoa confere, não edita ----------
     CPF é a identidade que casou com o link; posto e lotação mudam por evento
     (Promover/Transferir), então aqui ficam só para conferência. As datas de
     promoção já gravadas vêm travadas do montarDatas */
  function travarConferencia() {
    ['cc-cpf', 'cc-tipo', 'cc-posto', 'cc-lotacao'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.disabled = true;
    });
  }
  /* entra no passo 2: a ficha carregada, a conferência travada */
  function abrirFicha(cpf, codigo, dados) {
    contexto = { cpf: cpf, codigo: codigo, semColocacao: !(parseInt(dados.classificacao, 10) > 0) };
    preencher(dados);
    travarConferencia();
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
    abrirFicha: abrirFicha,
    aguardarOpcoes: function () { return opcoesProntas; },
    contexto: function () { return contexto; },
    /* o nome do posto da ficha (o Sd 3ª Classe só vale para inclusão a partir de 01/11/2024) */
    nomeDoPosto: function () { var g = grauPorId(postoEscolhido); return g ? g.nome : ''; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
