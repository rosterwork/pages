(function () {
  'use strict';

  /* botão lua/sol: fixa claro ou escuro (o tema já foi aplicado pelo geral-tema.js; o
     Automático se escolhe em Meu perfil). O ícone acompanha também a troca do aparelho */
  var btnTema = document.getElementById('cabecalho-btn-tema');
  var iconeLua = document.getElementById('cabecalho-icone-lua');
  var iconeSol = document.getElementById('cabecalho-icone-sol');

  function atualizarIconeTema() {
    var escuro = RosterWork.tema.escuro();
    if (iconeLua) iconeLua.classList.toggle('oculto', escuro);
    if (iconeSol) iconeSol.classList.toggle('oculto', !escuro);
    if (btnTema) btnTema.setAttribute('data-dica', escuro ? 'Tema claro' : 'Tema escuro');
  }

  atualizarIconeTema();
  window.addEventListener('rosterwork_tema', atualizarIconeTema);

  if (btnTema) {
    btnTema.addEventListener('click', function () {
      RosterWork.tema.escolher(RosterWork.tema.escuro() ? 'claro' : 'escuro');
    });
  }

  /* tela cheia (só no computador; no celular o CSS esconde): tira as barras do navegador e do sistema do
     aparelho. O ícone e a dica acompanham a troca venha de onde vier (o botão, o Esc, o navegador) */
  var btnTelaCheia = document.getElementById('cabecalho-btn-tela-cheia');
  var iconeTelaCheia = document.getElementById('cabecalho-icone-tela-cheia');
  var iconeTelaCheiaSair = document.getElementById('cabecalho-icone-tela-cheia-sair');

  function atualizarTelaCheia() {
    var cheia = !!document.fullscreenElement;
    var textos = RosterWork.mensagens.aplicativo;
    iconeTelaCheia.classList.toggle('oculto', cheia);
    iconeTelaCheiaSair.classList.toggle('oculto', !cheia);
    btnTelaCheia.setAttribute('aria-pressed', cheia ? 'true' : 'false');
    btnTelaCheia.setAttribute('data-dica', cheia ? textos.sairTelaCheia : textos.telaCheia);
  }

  if (btnTelaCheia) {
    btnTelaCheia.classList.toggle('oculto', !document.fullscreenEnabled);
    document.addEventListener('fullscreenchange', atualizarTelaCheia);
    btnTelaCheia.addEventListener('click', function () {
      var pedido = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      if (pedido && pedido.catch) pedido.catch(function () {});   // recusado pelo navegador: fica como está
    });
  }

  var btnSair = document.getElementById('btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', function () {
      RosterWork.sair();
    });
  }

  /* Instalar no celular: aparece no celular, fora do app instalado. No Android abre a janela do
     navegador; sem ela (iPhone, outro navegador, app já instalado), o aviso com o passo a passo */
  var btnInstalar = document.getElementById('btn-instalar-app');

  function atualizarInstalar() {
    btnInstalar.classList.toggle('oculto', !RosterWork.aplicativo.podeInstalar());
  }

  if (btnInstalar && RosterWork.aplicativo) {
    atualizarInstalar();
    window.addEventListener('rosterwork_instalacao', atualizarInstalar);
    btnInstalar.addEventListener('click', function () {
      RosterWork.aplicativo.pedirInstalacao().then(function (abriu) {
        if (abriu) return;
        var textos = RosterWork.mensagens.aplicativo;
        RosterWork.avisar({ tipo: 'aviso', mensagem: RosterWork.aplicativo.iphone() ? textos.instalarIphone : textos.instalarAndroid });
      });
    });
  }

  var perfil = null;
  try { perfil = JSON.parse(sessionStorage.getItem('rosterwork_user')); } catch (e) {}
  if (!perfil || !perfil.ok) return;

  var elAvatar = document.querySelector('.cabecalho-usuario-avatar');
  var elNome = document.querySelector('.cabecalho-usuario-nome');
  var elLotacao = document.querySelector('.cabecalho-usuario-lotacao');

  if (elAvatar) {
    elAvatar.textContent = perfil.nome_de_guerra ? perfil.nome_de_guerra.slice(0, 2).toUpperCase() : '';
  }

  if (elNome) {
    elNome.textContent = ((perfil.grau_abreviacao || '') + ' ' + (perfil.nome_de_guerra || '')).trim();
  }

  if (elLotacao) {
    var segmentos = typeof perfil.lotacao_path === 'string' ? perfil.lotacao_path.split(' / ') : [];
    var unidade = segmentos.length > 0 ? segmentos[segmentos.length - 1] : '';
    var cidade = perfil.lotacao_cidade || '';
    elLotacao.textContent = unidade ? (cidade ? unidade + ' - ' + cidade : unidade) : '';
  }
})();
