/* ============================================================
   MEU PERFIL — página do usuário logado (o item "Meu perfil" do
   menu do cabeçalho navega para cá). Este arquivo vem no shell:
   liga o botão do cabeçalho, registra RosterWork.paginas.perfil,
   liga as abas do subcabeçalho e preenche a aba "Perfil" (leitura)
   e o seletor do tema (RosterWork.tema, em geral-tema.js). A aba
   "Meus dados" fica em perfil-dados.js e a de "Segurança" em
   perfil-senha.js (carregados pela página). Aqui o
   militar só SOLICITA: quem aprova é o administrador, em Usuários.
   Só preenche espaços que já existem no HTML; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  function sessao() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_user')); } catch (e) { return null; }
  }

  /* 00000000000 -> 000.000.000-00 (só exibição) */
  function formatarCpf(cpf) {
    var d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '';
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  function preencher(id, valor) {
    var el = document.getElementById(id);
    if (el) el.textContent = valor || '-';
  }

  /* Tema: o seletor mostra a ESCOLHA (Automático, Claro ou Escuro), não a cor da tela */
  function marcarTema() {
    var trilho = document.getElementById('perfil-tema');
    if (!trilho) return;
    var atual = RosterWork.tema.escolha();
    var abas = trilho.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      var ativa = abas[i].getAttribute('data-valor') === atual;
      abas[i].classList.toggle('aba--ativa', ativa);
      abas[i].setAttribute('aria-selected', ativa ? 'true' : 'false');
    }
  }

  function ligarTema() {
    var trilho = document.getElementById('perfil-tema');
    if (!trilho || !RosterWork.abas) return;
    marcarTema();
    RosterWork.abas.ligar(trilho, function (aba) {
      var valor = aba.getAttribute('data-valor');
      if (valor !== RosterWork.tema.escolha()) RosterWork.tema.escolher(valor);
      marcarTema();
    });
  }

  /* Notificações neste aparelho: o seletor mostra a situação de verdade do aparelho; nos casos
     em que não dá para ligar (bloqueado, iPhone fora do app, navegador sem notificações) fica
     desligado e a ajuda explica o caminho */
  var ajudaPadrao = null;           /* a frase do HTML, para voltar a ela */
  var ehAdministrador = false;      /* administrador: a ajuda cita também os pedidos que esperam a aprovação dele */
  var situacaoAparelho = null;

  function marcarAbas(trilho, valor, travado) {
    Array.prototype.forEach.call(trilho.querySelectorAll('.aba'), function (aba) {
      var ativa = aba.getAttribute('data-valor') === valor;
      aba.classList.toggle('aba--ativa', ativa);
      aba.setAttribute('aria-selected', ativa ? 'true' : 'false');
      aba.disabled = !!travado;
    });
  }

  function marcarNotificacoes(trilho, situacao) {
    var M = RosterWork.mensagens.notificacoesCelular;
    var travado = situacao !== 'ativado' && situacao !== 'desativado';
    situacaoAparelho = situacao;
    marcarAbas(trilho, situacao, travado);
    var ajuda = document.getElementById('perfil-notificacoes-ajuda');
    if (!ajuda) return;
    if (ajudaPadrao === null) ajudaPadrao = ajuda.textContent;
    ajuda.textContent = travado ? (M.ajuda[situacao] || '') : (ehAdministrador ? M.ajudaAdmin : ajudaPadrao);
  }

  function ligarNotificacoes() {
    var trilho = document.getElementById('perfil-notificacoes');
    var N = RosterWork.notificacoesCelular;
    if (!trilho || !N || !RosterWork.abas) return;
    N.situacao().then(function (s) { marcarNotificacoes(trilho, s); });
    RosterWork.abas.ligar(trilho, function (aba) {
      var querLigar = aba.getAttribute('data-valor') === 'ativado';
      if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(aba);
      (querLigar ? N.ativar() : N.desativar()).then(function (s) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(aba);
        marcarNotificacoes(trilho, s);
      }, function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(aba);
        N.situacao().then(function (s) { marcarNotificacoes(trilho, s); });
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.notificacoesCelular.falhaAtivar });
      });
    });
  }

  /* Avisos de administração no celular: só para administradores (o banco diz quem é); a escolha mora
     no banco e vale em todos os aparelhos da pessoa */
  function ligarAvisosAdmin() {
    var campo = document.getElementById('perfil-avisos-admin-campo');
    var trilho = document.getElementById('perfil-avisos-admin');
    if (!campo || !trilho || !RosterWork.abas || !RosterWork.rpc) return;
    ehAdministrador = false;
    function ler() {
      return RosterWork.rpc('notificacoes_admin_celular_ler').then(function (r) {
        if (!r || !r.ok || !r.administrador) return;
        ehAdministrador = true;
        campo.classList.remove('oculto');
        marcarAbas(trilho, r.ligado ? 'ativado' : 'desativado');
        var aparelho = document.getElementById('perfil-notificacoes');
        if (aparelho && situacaoAparelho) marcarNotificacoes(aparelho, situacaoAparelho);
      }).catch(function () {});
    }
    ler();
    RosterWork.abas.ligar(trilho, function (aba) {
      var ligar = aba.getAttribute('data-valor') === 'ativado';
      if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(aba);
      RosterWork.rpc('notificacoes_admin_celular_definir', { p_ligado: ligar }).then(function (r) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(aba);
        if (r && r.ok) { marcarAbas(trilho, ligar ? 'ativado' : 'desativado'); return; }
        throw new Error('não salvou');
      }).catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(aba);
        ler();
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.notificacoesCelular.falhaAdmin });
      });
    });
  }

  /* Privacidade: a ciência dos Termos de uso e privacidade (a leitura mora no index-termos.js) */
  function ligarTermos() {
    if (!RosterWork.termos) return;
    var ler = document.getElementById('perfil-ler-termos');
    if (ler) ler.addEventListener('click', RosterWork.termos.abrirPagina);
    RosterWork.termos.situacao().then(function (s) {
      var M = RosterWork.mensagens.termos;
      preencher('perfil-ver-termos', s ? (s.pendente ? M.pendente : M.ciente(s.versao_ciente, s.ciente_em_br)) : null);
    });
  }

  /* abas do subcabeçalho: mesmo mecanismo das outras páginas */
  function ligarAbas() {
    var trilho = document.getElementById('perfil-abas');
    if (!trilho || !RosterWork.abas) return;
    var paineis = document.querySelectorAll('[data-aba-painel]');
    RosterWork.abas.ligar(trilho, function (aba) {
      var alvo = aba.getAttribute('data-aba');
      for (var i = 0; i < paineis.length; i++) {
        paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== alvo);
      }
    });
  }

  /* aba Perfil: o cartão de identificação e as duas grades de leitura */
  function preencherPerfil(usuario, ficha) {
    var pessoais = (ficha && ficha.pessoais) || {};
    var institucionais = (ficha && ficha.institucionais) || {};
    var C = RosterWork.campos;
    var celular = C ? C.mascararCelular(C.soDigitos(pessoais.celular)) : pessoais.celular;
    var rg = C ? C.mascararRg(C.soDigitos(pessoais.rg)) : pessoais.rg;

    preencher('perfil-cartao-grad', usuario.grau_abreviacao);
    preencher('perfil-cartao-nome', usuario.nome_de_guerra);
    preencher('perfil-cartao-lotacao', institucionais.lotacao_nome || usuario.lotacao_path);
    /* o papel de administração (o da ficha, senão o do login); sem papel, Usuário */
    var adm = (ficha && ficha.administracao && ficha.administracao.papel) ? ficha.administracao : usuario.administracao;
    preencher('perfil-cartao-papel', (adm && adm.rotulo) || (usuario.is_administrador ? 'Administrador' : 'Usuário'));

    preencher('perfil-ver-nome-completo', pessoais.nome_completo);
    preencher('perfil-ver-cpf', formatarCpf(usuario.cpf));
    preencher('perfil-ver-rg', rg);
    preencher('perfil-ver-nascimento', RosterWork.data.isoParaBR(pessoais.data_de_nascimento));
    preencher('perfil-ver-celular', celular);
    preencher('perfil-ver-email', pessoais.email);

    preencher('perfil-ver-quadro', institucionais.quadro);
    preencher('perfil-ver-inclusao', RosterWork.data.isoParaBR(institucionais.data_de_inclusao));
    preencher('perfil-ver-posto', institucionais.grau_nome);
    preencher('perfil-ver-nome-guerra', institucionais.nome_de_guerra);
    preencher('perfil-ver-setor', institucionais.tipo);
    /* "0000" = sem colocação: aparece "-" */
    preencher('perfil-ver-colocacao', parseInt(String(institucionais.classificacao || '').replace(/\D/g, ''), 10) ? institucionais.classificacao : '');
    /* o rótulo da colocação diz o curso (CFO, CHOE ou CFP), pelo quadro */
    var rotuloColocacao = C ? C.nomeColocacao(institucionais.quadro) : 'Colocação';
    preencher('perfil-ver-colocacao-rotulo', rotuloColocacao);
    preencher('perfil-f-colocacao-rotulo', rotuloColocacao);
    preencher('perfil-ver-cnh', pessoais.cnh);
  }

  /* renderiza a página (chamado pela navegação SPA) */
  function iniciar() {
    var usuario = sessao();
    if (!usuario) return;

    ligarAbas();
    ligarTema();
    ligarNotificacoes();
    ligarAvisosAdmin();
    ligarTermos();
    if (RosterWork.perfilSenha) RosterWork.perfilSenha.iniciar(usuario);

    /* uma leitura da ficha alimenta a aba Perfil e o formulário de Meus dados */
    return RosterWork.apiFetch('/rest/v1/rpc/buscar_ficha_militar', {
      metodo: 'POST',
      corpo: { p_usuario_id: usuario.cpf }
    })
      .then(function (resposta) { return resposta.ok ? resposta.json() : null; })
      .then(function (ficha) {
        if (!ficha && RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaCarregar });   // falha: avisa em vez de mostrar "-" em silêncio
        preencherPerfil(usuario, ficha);
        if (RosterWork.perfilDados) RosterWork.perfilDados.iniciar(ficha);
      })
      .catch(function () { if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.erroConexao }); });
  }

  /* o item "Meu perfil" do menu do cabeçalho navega para a página */
  function inicializar() {
    var botao = document.getElementById('btn-meu-perfil');
    if (botao) botao.addEventListener('click', function () {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      if (RosterWork.irParaPagina) RosterWork.irParaPagina('perfil');
    });
    /* o botão lua/sol do topo também muda a escolha: o seletor acompanha (com a página aberta) */
    window.addEventListener('rosterwork_tema', marcarTema);
  }

  RosterWork.paginas.perfil = { iniciar: iniciar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
