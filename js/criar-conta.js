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
  var lotacao = null;   /* instância do seletor de unidades (modo único) */

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

  /* ---------- entrada ----------
     quem já está logado nem chega aqui: o criar-conta-sessao.js (head)
     desviou para o sistema antes do corpo pintar */
  function iniciar() {
    document.getElementById('cc-voltar-login').addEventListener('click', function () {
      window.location.href = 'login.html';
    });
    ligarCampos();
    lotacao = prepararLotacao();
    if (lotacao) lotacao.montarArvore();

    /* fechar ou recarregar com o formulário preenchido avisa antes */
    if (RW.guardaSaida) RW.guardaSaida.registrar(temAlgoDigitado);

    var botao = document.getElementById('cc-enviar');
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    rpc('cadastro_opcoes')
      .then(function (dados) {
        if (RW.pararCarregando) RW.pararCarregando(botao);
        if (!dados || !dados.graus) { falharOpcoes(); return; }
        graus = dados.graus;
        montarTipos();
      })
      .catch(function () {
        if (RW.pararCarregando) RW.pararCarregando(botao);
        falharOpcoes();
      });

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

  RW.criarConta = { marcarEnviado: function () { enviado = true; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
