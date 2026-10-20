/* ============================================================
   NOVO USUÁRIO — formulário no painel direito (modo criação)
   Abre o painel (geral-painel) clonando o formulário, aplica as
   máscaras dos campos, liga os campos de seleção (CNH, Setor fixos;
   Tipo, Posto do banco — dependentes) e a Lotação (seletor de
   unidades, modo único). Banco em usuarios-novo-usuario-dados.js.
   Validação e envio em usuarios-novo-usuario-envio.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* máscaras, nome, datas com calendário e campo de seleção vivem em
     componentes/js/geral-campos.js (RosterWork.campos) — compartilhados. */
  var C = RosterWork.campos;
  var soDigitos = C.soDigitos, mascararCpf = C.mascararCpf, mascararRg = C.mascararRg;
  var mascararCelular = C.mascararCelular, mascararData = C.mascararData;
  var capitalizarNome = C.capitalizarNome, filtrarLetras = C.filtrarLetras;
  var ligarMascara = C.ligarMascara, ligarNome = C.ligarNome;
  var ligarCalendario = C.ligarCalendario, ligarSelecao = C.ligarSelecao;
  var popularOpcoes = C.popularOpcoes, nomeColocacao = C.nomeColocacao;

  /* ---------- graus (Tipo -> Posto -> Colocação) ---------- */

  var graus = [];   /* lista vinda do banco (cache em -dados.js) */

  /* popula o campo Tipo com os tipos distintos (na ordem em que aparecem) */
  function popularTipos(raiz) {
    var vistos = {};
    var itens = [];
    graus.forEach(function (g) {
      if (vistos[g.tipo]) return;
      vistos[g.tipo] = true;
      itens.push({ rotulo: g.tipo, valor: g.tipo });
    });
    popularOpcoes(raiz.querySelector('#nu-tipo-menu'), itens);
  }

  var tipoEscolhido = null;   /* o Tipo escolhido */

  /* ao escolher o Tipo: habilita a Colocação, ajusta o rótulo dela pelo quadro e recomeça o
     Posto (que só libera com a data de inclusão) */
  function aoEscolherTipo(tipo, raiz) {
    tipoEscolhido = tipo;
    var doTipo = graus.filter(function (g) { return g.tipo === tipo; });
    var posto = raiz.querySelector('#nu-posto');
    if (posto) posto.removeAttribute('data-valor');

    var quadro = doTipo.length ? doTipo[0].quadro : null;
    var colocacao = raiz.querySelector('#nu-colocacao');
    var colocacaoRotulo = raiz.querySelector('#nu-colocacao-rotulo');
    if (colocacao) {
      colocacao.disabled = false;
      colocacao.value = '';
      colocacao.placeholder = 'Ex.: 0001';
    }
    if (colocacaoRotulo) colocacaoRotulo.textContent = nomeColocacao(quadro);

    /* trocar o tipo reseta o posto: as datas somem até escolher um novo posto */
    limparPromocoes(raiz);
    atualizarPostos(raiz);
  }

  /* o Posto segue o Tipo e a data de inclusão: sem a inclusão ele fica travado (é ela que diz se
     existe o Sd 3ª Classe); a lista traz só os postos que valem para a inclusão, e o escolhido que
     deixou de valer volta a "Selecione" */
  function atualizarPostos(raiz) {
    var posto = raiz.querySelector('#nu-posto');
    if (!posto || !tipoEscolhido) return;
    var texto = posto.querySelector('.campo-selecao-texto');
    var campoInclusao = raiz.querySelector('#nu-inclusao');
    var inclusao = RosterWork.validacoes.parseData(campoInclusao ? campoInclusao.value : '');
    if (!inclusao) {
      posto.disabled = true;
      if (!postoEscolhido) {
        texto.textContent = RosterWork.mensagens.cadastro.postoAntesInclusao;
        texto.classList.add('campo-selecao-texto--vazio');
      }
      atualizarPromocoes(raiz);
      return;
    }
    var validos = graus.filter(function (g) { return g.tipo === tipoEscolhido && C.grauValeNaInclusao(g.grau_nome, inclusao); });
    popularOpcoes(raiz.querySelector('#nu-posto-menu'), validos.map(function (g) {
      return { rotulo: g.grau_nome, valor: String(g.grau_id) };
    }));
    posto.disabled = false;
    var vale = validos.some(function (g) { return String(g.grau_id) === String(postoEscolhido); });
    if (postoEscolhido && !vale) {
      postoEscolhido = null;
      posto.removeAttribute('data-valor');
    }
    if (!postoEscolhido) {
      texto.textContent = 'Selecione';
      texto.classList.add('campo-selecao-texto--vazio');
    }
    atualizarPromocoes(raiz);
  }

  /* ---------- datas de promoção (um campo por posto depois do primeiro, todos opcionais) ---------- */

  var postoEscolhido = null;   /* grau_id do Posto escolhido */
  var datasDigitadas = {};     /* o que foi digitado em cada posto (por grau_id): volta se o campo some e reaparece */

  /* os campos seguem o Posto e a data de inclusão (que diz o primeiro posto da praça): as Datas de
     promoções da carreira e, do oficial, a parte recolhida das datas como praça */
  function atualizarPromocoes(raiz) {
    var inclusao = raiz.querySelector('#nu-inclusao');
    var postos = C.postosComData(graus, postoEscolhido, RosterWork.validacoes.parseData(inclusao ? inclusao.value : ''), []);
    montarDatas(raiz.querySelector('#nu-promocoes-secao'), raiz.querySelector('#nu-promocoes'), postos.carreira);
    montarDatas(raiz.querySelector('#nu-promocoes-praca-secao'), raiz.querySelector('#nu-promocoes-praca'), postos.praca);
  }

  /* refaz os campos de uma seção só quando a lista de postos muda (digitar a inclusão não refaz à toa) */
  function montarDatas(secao, lista, postos) {
    if (!secao || !lista) return;
    var chave = postos.map(function (g) { return g.grau_id; }).join(',');
    if (lista.getAttribute('data-postos') === chave) return;
    lista.setAttribute('data-postos', chave);
    lista.textContent = '';
    postos.forEach(function (g) {
      var campo = RosterWork.tpl('tpl-nu-promocao');
      if (!campo) return;
      campo.querySelector('.campo-rotulo').textContent = g.grau_abreviacao;
      var input = campo.querySelector('.campo-entrada');
      input.setAttribute('data-grau', g.grau_id);
      input.value = datasDigitadas[g.grau_id] || '';
      ligarMascara(input, mascararData);
      ligarCalendario(input);
      input.addEventListener('input', function () { datasDigitadas[g.grau_id] = input.value; });
      lista.appendChild(campo);
    });
    secao.classList.toggle('oculto', !postos.length);
  }

  function limparPromocoes(raiz) {
    postoEscolhido = null;
    datasDigitadas = {};
    atualizarPromocoes(raiz);
  }

  function carregarGraus(raiz) {
    if (!window.RosterWork.novoUsuarioDados) return Promise.resolve();
    return window.RosterWork.novoUsuarioDados.buscarGraus().then(function (lista) {
      graus = lista || [];
      popularTipos(raiz);
    });
  }

  /* ---------- lotação (seletor de unidades, modo único) ---------- */

  function prepararLotacao(raiz) {
    if (!window.RosterWork.seletorUnidades) return null;
    var dropdown = raiz.querySelector('#nu-lotacao-dropdown');
    var arvore = raiz.querySelector('#nu-lotacao-arvore');
    var texto = raiz.querySelector('#nu-lotacao-texto');
    var gatilho = raiz.querySelector('#nu-lotacao');
    if (!dropdown || !arvore || !texto) return null;

    return window.RosterWork.seletorUnidades.criar({
      modo: 'unico',
      dropdownEl: dropdown,
      arvoreEl: arvore,
      textoEl: texto,
      aoSelecionar: function (unidade) {
        if (gatilho) gatilho.setAttribute('data-valor', unidade.unidade_id);
        texto.classList.remove('campo-selecao-texto--vazio');
        sujo = true;
      }
    });
  }

  /* ---------- alterações / limpeza / fechamento ---------- */

  var sujo = false;          /* há alterações não salvas no formulário? */
  var guardaLigado = false;  /* o beforeunload já foi registrado? (uma vez só) */

  /* fecha o painel; se houver alterações, confirma antes (descarta ao confirmar) */
  function tentarFechar() {
    if (sujo && window.RosterWork.confirmar) {
      window.RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: window.RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: window.RosterWork.mensagens.botoes.sairSemSalvar,
        textoCancelar: window.RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () {
          sujo = false;
          if (window.RosterWork.painel) window.RosterWork.painel.fechar();
        }
      });
      return;
    }
    sujo = false;
    if (window.RosterWork.painel) window.RosterWork.painel.fechar();
  }

  /* ---------- abertura no painel + ligação da página ---------- */

  /* abre o Novo usuário no painel direito: clona o formulário e o rodapé, liga
     máscaras/seleções/lotação/graus e as ações. Nasce novo a cada abertura. */
  function abrirPainel() {
    var painel = window.RosterWork.painel;
    if (!painel) return;
    if (window.RosterWork.fecharDropdowns) window.RosterWork.fecharDropdowns();   // o botão mora no grupo Administração (no celular, um menu)
    painel.abrir({
      titulo: 'Novo usuário',
      aoFechar: function () { sujo = false; },
      aoTentarFechar: function () { if (!sujo) return false; tentarFechar(); return true; }   // Esc/X confirmam o descarte
    });
    var corpo = painel.corpo();
    var rodape = painel.rodape();
    if (corpo) corpo.textContent = '';
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    sujo = false;
    tipoEscolhido = null;
    postoEscolhido = null;
    datasDigitadas = {};
    montarFormulario(corpo);
    montarRodape();
  }

  function montarFormulario(corpo) {
    var tplForm = document.getElementById('tpl-novo-usuario');
    var secoesForm = [];
    if (corpo && tplForm) {
      var frag = tplForm.content.cloneNode(true);
      secoesForm = Array.prototype.slice.call(frag.children);
      corpo.appendChild(frag);
    }

    var raiz = document.getElementById('painel');   // contém o corpo e o rodapé clonados
    if (!raiz) return;

    ligarMascara(raiz.querySelector('#nu-cpf'), mascararCpf);
    ligarMascara(raiz.querySelector('#nu-rg'), mascararRg);
    ligarMascara(raiz.querySelector('#nu-celular'), mascararCelular);
    ligarMascara(raiz.querySelector('#nu-nascimento'), mascararData);
    ligarCalendario(raiz.querySelector('#nu-nascimento'));
    ligarMascara(raiz.querySelector('#nu-inclusao'), mascararData);
    ligarCalendario(raiz.querySelector('#nu-inclusao'));
    ligarNome(raiz.querySelector('#nu-nome-completo'));

    /* a inclusão libera o Posto e diz o primeiro posto da praça: o Posto e as datas acompanham */
    var inclusao = raiz.querySelector('#nu-inclusao');
    if (inclusao) inclusao.addEventListener('input', function () { atualizarPostos(raiz); });

    ligarSelecao(raiz.querySelector('#nu-cnh'));
    ligarSelecao(raiz.querySelector('#nu-setor'));
    ligarSelecao(raiz.querySelector('#nu-tipo'), function (valor) { aoEscolherTipo(valor, raiz); });
    ligarSelecao(raiz.querySelector('#nu-posto'), function (valor) { postoEscolhido = valor; atualizarPromocoes(raiz); });

    var lotacao = prepararLotacao(raiz);
    if (lotacao) lotacao.montarArvore();

    carregarGraus(raiz);

    /* marca alterações não salvas: digitação e escolha de opções. Ligado nos nós
       clonados (descartados ao fechar), não no corpo do painel — que é compartilhado
       com a ficha e acumularia/contaminaria o estado a cada abertura */
    secoesForm.forEach(function (no) {
      no.addEventListener('input', function () { sujo = true; });
      no.addEventListener('click', function (evento) {
        if (evento.target.closest('.dropdown-item')) sujo = true;
      });
    });

    if (window.RosterWork.novoUsuarioEnvio) window.RosterWork.novoUsuarioEnvio.ligarLimpeza(secoesForm);

    var nome = raiz.querySelector('#nu-nome-completo');
    if (nome) nome.focus();
  }

  /* rodapé: Cancelar / Salvar */
  function montarRodape() {
    var rodape = window.RosterWork.painel.rodape();
    var tplAcoes = document.getElementById('tpl-novo-usuario-acoes');
    if (!rodape || !tplAcoes) return;
    rodape.appendChild(tplAcoes.content.cloneNode(true));
    rodape.classList.remove('oculto');

    var raiz = document.getElementById('painel');
    var btnCancelar = rodape.querySelector('#nu-cancelar');
    var btnSalvar = rodape.querySelector('#nu-salvar');

    /* Cancelar fecha com confirmação se houver alterações (o ✕/Esc do painel
       descartam; o guarda-de-saída cobre fechar/recarregar do navegador) */
    if (btnCancelar) btnCancelar.addEventListener('click', tentarFechar);
    if (!btnSalvar || !window.RosterWork.novoUsuarioEnvio) return;

    /* valida, envia e, no sucesso, fecha o painel e atualiza a lista */
    btnSalvar.addEventListener('click', function () {
      window.RosterWork.novoUsuarioEnvio.enviar(raiz, function () {
        sujo = false;
        if (window.RosterWork.painel) window.RosterWork.painel.fechar();
        if (window.RosterWork.arvoreUnidades && window.RosterWork.arvoreUnidades.recarregar) {
          window.RosterWork.arvoreUnidades.recarregar();
        }
      });
    });
  }

  /* chamado pelo usuarios.js a cada vez que a página de usuários é exibida
     (o fragmento é recriado, então o botão e o listener são sempre novos) */
  function ligar(conteudo) {
    var raiz = conteudo || document;
    sujo = false;   /* cada exibição da página começa sem alterações */

    var botaoAbrir = raiz.querySelector('#btn-novo-usuario');
    if (botaoAbrir) botaoAbrir.addEventListener('click', abrirPainel);

    /* protege contra fechar/recarregar/sair do navegador com edição não salva
       (aviso nativo do navegador); registra uma vez só */
    if (!guardaLigado && window.RosterWork.guardaSaida) {
      window.RosterWork.guardaSaida.registrar(function () { return sujo; });
      guardaLigado = true;
    }
  }

  /* a página Usuários liga o botão Novo usuário a cada exibição */
  window.RosterWork.novoUsuario = { ligar: ligar };
})();
