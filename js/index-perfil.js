/* ============================================================
   MEU PERFIL — página do usuário logado (o item "Meu perfil" do
   menu do cabeçalho navega para cá). Este arquivo vem no shell:
   liga o botão do cabeçalho, registra RosterWork.paginas.perfil,
   liga as abas do subcabeçalho e preenche a aba "Perfil" (leitura)
   e o tema. A aba "Meus dados" fica em perfil-dados.js e a de
   "Segurança" em perfil-senha.js (carregados pela página). Aqui o
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

  function temaAtual() {
    return document.documentElement.getAttribute('data-tema') === 'escuro' ? 'escuro' : 'claro';
  }

  function marcarTema(trilho) {
    var atual = temaAtual();
    var abas = trilho.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      abas[i].classList.toggle('aba--ativa', abas[i].getAttribute('data-valor') === atual);
    }
  }

  function ligarTema() {
    var trilho = document.getElementById('perfil-tema');
    if (!trilho || !RosterWork.abas) return;
    marcarTema(trilho);
    RosterWork.abas.ligar(trilho, function (aba) {
      if (aba.getAttribute('data-valor') !== temaAtual()) {
        var botao = document.getElementById('cabecalho-btn-tema');
        if (botao) botao.click();   /* reusa o handler do cabeçalho (salva no banco) */
      }
      marcarTema(trilho);
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
    preencher('perfil-cartao-papel', usuario.is_administrador ? 'Administrador' : 'Usuário');

    preencher('perfil-ver-nome-completo', pessoais.nome_completo);
    preencher('perfil-ver-cpf', formatarCpf(usuario.cpf));
    preencher('perfil-ver-rg', rg);
    preencher('perfil-ver-nascimento', RosterWork.data.isoParaBR(pessoais.data_de_nascimento));
    preencher('perfil-ver-celular', celular);
    preencher('perfil-ver-email', pessoais.email);

    preencher('perfil-ver-nome-guerra', institucionais.nome_de_guerra);
    preencher('perfil-ver-quadro', institucionais.quadro);
    preencher('perfil-ver-setor', institucionais.tipo);
    preencher('perfil-ver-inclusao', RosterWork.data.isoParaBR(institucionais.data_de_inclusao));
    preencher('perfil-ver-colocacao', institucionais.classificacao);
    preencher('perfil-ver-cnh', pessoais.cnh);
  }

  /* renderiza a página (chamado pela navegação SPA) */
  function iniciar() {
    var usuario = sessao();
    if (!usuario) return;

    var subtitulo = document.getElementById('perfil-subtitulo');
    if (subtitulo) {
      subtitulo.textContent = ((usuario.grau_abreviacao || '') + ' ' + (usuario.nome_de_guerra || '')).trim();
    }

    ligarAbas();
    ligarTema();
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
  }

  RosterWork.paginas.perfil = { iniciar: iniciar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
