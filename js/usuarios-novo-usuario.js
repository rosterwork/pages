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

  /* ao escolher o Tipo: popula o Posto com os graus daquele tipo,
     habilita Posto e Colocação e ajusta o rótulo da Colocação pelo quadro */
  function aoEscolherTipo(tipo, raiz) {
    var doTipo = graus.filter(function (g) { return g.tipo === tipo; });

    popularOpcoes(raiz.querySelector('#nu-posto-menu'), doTipo.map(function (g) {
      return { rotulo: g.grau_nome, valor: String(g.grau_id) };
    }));

    var posto = raiz.querySelector('#nu-posto');
    if (posto) {
      posto.disabled = false;
      posto.removeAttribute('data-valor');
      var postoTexto = posto.querySelector('.campo-selecao-texto');
      postoTexto.textContent = 'Selecione';
      postoTexto.classList.add('campo-selecao-texto--vazio');
    }

    var quadro = doTipo.length ? doTipo[0].quadro : null;
    var colocacao = raiz.querySelector('#nu-colocacao');
    var colocacaoRotulo = raiz.querySelector('#nu-colocacao-rotulo');
    if (colocacao) {
      colocacao.disabled = false;
      colocacao.value = '';
      colocacao.placeholder = 'Ex.: 0001';
    }
    if (colocacaoRotulo) colocacaoRotulo.textContent = nomeColocacao(quadro);

    /* trocar o tipo reseta o posto: as promoções somem até escolher um novo posto */
    limparPromocoes(raiz);
  }

  /* ---------- promoções (datas por grau da carreira) ---------- */

  /* ao escolher o Posto: um campo de data por grau do mesmo quadro, do posto
     escolhido para baixo, do mais antigo até o posto (regra do site antigo) */
  function atualizarPromocoes(grauId, raiz) {
    var secao = raiz.querySelector('#nu-promocoes-secao');
    var container = raiz.querySelector('#nu-promocoes');
    if (!container) return;
    container.textContent = '';

    var grauSel = null;
    for (var i = 0; i < graus.length; i++) {
      if (String(graus[i].grau_id) === String(grauId)) { grauSel = graus[i]; break; }
    }
    if (!grauSel) { limparPromocoes(raiz); return; }

    var promos = graus.filter(function (g) {
      return g.quadro === grauSel.quadro && g.grau_antiguidade >= grauSel.grau_antiguidade;
    });
    promos.sort(function (a, b) { return b.grau_antiguidade - a.grau_antiguidade; });

    var tpl = document.getElementById('tpl-nu-promocao');
    if (!tpl) return;
    promos.forEach(function (g) {
      var campo = tpl.content.cloneNode(true).firstElementChild;
      campo.querySelector('.campo-rotulo').textContent = g.grau_abreviacao;
      var input = campo.querySelector('.campo-entrada');
      input.setAttribute('data-grau', g.grau_id);
      ligarMascara(input, mascararData);
      ligarCalendario(input);
      container.appendChild(campo);
    });

    if (secao) secao.classList.remove('oculto');
  }

  function limparPromocoes(raiz) {
    var secao = raiz.querySelector('#nu-promocoes-secao');
    var container = raiz.querySelector('#nu-promocoes');
    if (container) container.textContent = '';
    if (secao) secao.classList.add('oculto');
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

  /* abre o Novo usuário no painel direito (modo criação): clona o formulário e o
     rodapé, liga máscaras/seleções/lotação/graus e as ações. Nasce novo a cada abertura. */
  /* config (opcional) abre o MESMO formulário em modo revisão de cadastro:
     { titulo, dados, rotuloSalvar, rotuloRecusar, aoVer(corpo), aoSalvar(raiz), aoRecusar(raiz) }.
     Com aoVer o painel ganha as abas Ver | Editar e começa no Ver: o administrador
     confere o pedido primeiro e só entra no formulário se for corrigir algo. */
  function abrirPainel(config) {
    config = (config && config.titulo) ? config : null;
    if (!window.RosterWork.painel) return;

    var revisao = !!(config && config.aoVer);
    window.RosterWork.painel.abrir({
      titulo: config ? config.titulo : 'Novo usuário',
      editavel: revisao,
      aoMudarModo: revisao ? function () { montarConteudo(config); } : null,
      aoFechar: function () { sujo = false; }
    });
    montarConteudo(config);
  }

  /* desenha o painel conforme o modo do momento: no Ver o corpo é montado por
     quem abriu (a fila de cadastros), no Editar vem o formulário. O rodapé é o
     mesmo nos dois — dá para aprovar sem precisar passar pelo formulário. */
  function montarConteudo(config) {
    var painel = window.RosterWork.painel;
    var corpo = painel.corpo();
    var rodape = painel.rodape();
    if (corpo) corpo.textContent = '';
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    sujo = false;

    if (config && config.aoVer && painel.modo() === 'ver') {
      if (corpo) config.aoVer(corpo);
    } else {
      montarFormulario(config, corpo);
    }
    montarRodape(config);
  }

  function montarFormulario(config, corpo) {
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

    ligarSelecao(raiz.querySelector('#nu-cnh'));
    ligarSelecao(raiz.querySelector('#nu-setor'));
    ligarSelecao(raiz.querySelector('#nu-tipo'), function (valor) { aoEscolherTipo(valor, raiz); });
    ligarSelecao(raiz.querySelector('#nu-posto'), function (valor) { atualizarPromocoes(valor, raiz); });

    var lotacao = prepararLotacao(raiz);
    if (lotacao) lotacao.montarArvore();

    /* modo revisão: o formulário abre com o que o militar mandou. Espera os
       graus, porque é o Posto que cria os campos de promoção. */
    Promise.resolve(carregarGraus(raiz)).then(function () {
      if (config && config.dados) preencher(raiz, config.dados, lotacao);
    });

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

  /* rodapé: Cancelar/Salvar na criação, Recusar/Aprovar na revisão */
  function montarRodape(config) {
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
    if (btnCancelar) {
      if (config && config.rotuloRecusar) btnCancelar.textContent = config.rotuloRecusar;
      btnCancelar.addEventListener('click',
        (config && config.aoRecusar) ? function () { config.aoRecusar(raiz); } : tentarFechar);
    }
    if (!btnSalvar) return;

    /* revisão: quem decide o que fazer com o pedido é a fila de cadastros */
    if (config && config.aoSalvar) {
      if (config.rotuloSalvar) btnSalvar.textContent = config.rotuloSalvar;
      btnSalvar.addEventListener('click', function () { config.aoSalvar(raiz); });
      return;
    }

    /* criação: valida, envia e, no sucesso, fecha o painel e atualiza a lista */
    if (!window.RosterWork.novoUsuarioEnvio) return;
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


  /* ---------- modo revisão: joga o pedido dentro do formulário ----------
     A ordem importa: Tipo habilita o Posto, e o Posto é quem cria os
     campos de promoção — só depois dá para preenchê-los. */
  function preencher(raiz, d, lotacao) {
    function texto(id, valor) { var e = raiz.querySelector(id); if (e) e.value = valor || ''; }
    texto('#nu-nome-completo', d.nome_completo);
    texto('#nu-cpf', mascararCpf(String(d.cpf || '')));
    texto('#nu-rg', mascararRg(String(d.rg || '')));
    texto('#nu-nascimento', RosterWork.data.isoParaBR(d.data_nascimento));
    texto('#nu-celular', mascararCelular(String(d.celular || '')));
    texto('#nu-email', d.email);
    texto('#nu-nome-guerra', d.nome_de_guerra);
    texto('#nu-inclusao', RosterWork.data.isoParaBR(d.data_de_inclusao));
    texto('#nu-colocacao', d.classificacao);
    C.definirSelecao(raiz.querySelector('#nu-cnh'), d.cnh);
    C.definirSelecao(raiz.querySelector('#nu-setor'), d.tipo);

    var grau = null;
    for (var i = 0; i < graus.length; i++) {
      if (String(graus[i].grau_id) === String(d.grau_hierarquico)) { grau = graus[i]; break; }
    }
    if (grau) {
      C.definirSelecao(raiz.querySelector('#nu-tipo'), grau.tipo);
      aoEscolherTipo(grau.tipo, raiz);
      C.definirSelecao(raiz.querySelector('#nu-posto'), grau.grau_nome);
      raiz.querySelector('#nu-posto').setAttribute('data-valor', String(grau.grau_id));
      atualizarPromocoes(grau.grau_id, raiz);
      var campos = raiz.querySelectorAll('#nu-promocoes .campo-entrada');
      var datas = d.promocoes || [];
      for (var j = 0; j < campos.length && j < datas.length; j++) {
        campos[j].value = RosterWork.data.isoParaBR(datas[j]);
      }
    }
    /* a colocação só habilita depois do Tipo — reescreve por último */
    texto('#nu-colocacao', d.classificacao);
    /* a lotação pedida já vem escolhida; o administrador troca pela árvore se quiser */
    var gatilhoLot = raiz.querySelector('#nu-lotacao');
    var textoLot = raiz.querySelector('#nu-lotacao-texto');
    if (gatilhoLot && d.lotacao_atual) gatilhoLot.setAttribute('data-valor', String(d.lotacao_atual));
    if (textoLot && d.lotacao_nome) {
      textoLot.textContent = d.lotacao_nome;
      textoLot.classList.remove('campo-selecao-texto--vazio');
    }
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

  /* máscaras e helpers de campo reaproveitados pela ficha do militar (usuarios-painel.js) */
  window.RosterWork.novoUsuario = { ligar: ligar, abrirPainel: abrirPainel, marcarLimpo: function () { sujo = false; } };
})();
