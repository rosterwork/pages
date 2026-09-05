/* ============================================================
   GERAL-PAINEL — painel lateral de detalhes (a "gaveta" direita)
   Casca compartilhada: abre/fecha, alterna Ver/Editar e entrega à
   página os pontos onde montar o conteúdo (corpo, sub-cabeçalho e
   rodapé) e as peças prontas (seção, caixa, linha rótulo/valor).
   Só liga/desliga classe e clona moldes — não inventa estrutura.
   Estrutura no index.html (#painel); estilos em geral-painel.css.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var painel, elTitulo, elTituloExtra, elSubtitulo, elAbas, elSubcabecalho, elCorpo, elRodape, elFechar;
  var aoFecharAtual = null;       // callback da página, disparado ao fechar
  var aoTentarFecharAtual = null; // interceptador opcional do fechar por gesto (Esc/X): devolve true para segurar
  var aoMudarModoAtual = null;    // callback da página, disparado ao trocar Ver/Editar
  var modoAtual = 'ver';

  function pegarReferencias() {
    painel = document.getElementById('painel');
    elTitulo = document.getElementById('painel-titulo');
    elTituloExtra = document.getElementById('painel-titulo-extra');
    elSubtitulo = document.getElementById('painel-subtitulo');
    elAbas = document.getElementById('painel-abas');
    elSubcabecalho = document.getElementById('painel-subcabecalho');
    elCorpo = document.getElementById('painel-corpo');
    elRodape = document.getElementById('painel-rodape');
    elFechar = document.getElementById('painel-fechar');
  }


  function estaAberto() {
    return !!painel && painel.classList.contains('painel-lateral--aberto');
  }

  function ativarAba(modo) {
    var botoes = elAbas.querySelectorAll('.aba');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.toggle('aba--ativa', botoes[i].getAttribute('data-painel-modo') === modo);
    }
    modoAtual = modo;
  }

  function limparConteudo() {
    elCorpo.textContent = '';
    elSubcabecalho.textContent = '';
    elSubcabecalho.classList.add('oculto');
    elRodape.textContent = '';
    elRodape.classList.add('oculto');
  }

  /* abre o painel. config = { titulo, tituloExtra?, subtitulo, editavel?, modoFixo?, largo?, aoMudarModo?(modo), aoFechar?(), aoTentarFechar?()->bool }
     o corpo/sub-cabeçalho/rodapé nascem vazios; a página preenche pelos getters abaixo */
  function abrir(config) {
    if (!painel) return;
    config = config || {};

    /* outro dono assumindo a gaveta sem fechar: dispara a limpeza (aoFechar) do
       anterior, senão o estado dele vaza (ex.: "sujo" preso no guarda de saída).
       Mesma referência = o próprio módulo reabrindo — ele já se limpa no abrir. */
    if (estaAberto() && aoFecharAtual && aoFecharAtual !== config.aoFechar) {
      var cbAnterior = aoFecharAtual;
      aoFecharAtual = null;
      cbAnterior();
    }

    elTitulo.textContent = config.titulo || '';
    if (elTituloExtra) {
      elTituloExtra.textContent = config.tituloExtra || '';
      elTituloExtra.classList.toggle('oculto', !config.tituloExtra);
    }
    elSubtitulo.textContent = config.subtitulo || '';

    /* modoFixo ('ver'/'editar'): mostra as abas já nesse modo e TRAVADAS (não clicáveis) */
    var modoFixo = config.modoFixo || null;
    var editavel = !!config.editavel || !!modoFixo;
    elAbas.classList.toggle('oculto', !editavel);
    elAbas.classList.toggle('painel-abas--fixo', !!modoFixo);
    aoMudarModoAtual = config.aoMudarModo || null;
    ativarAba(modoFixo || 'ver');

    limparConteudo();
    aoFecharAtual = config.aoFechar || null;
    aoTentarFecharAtual = config.aoTentarFechar || null;
    painel.classList.toggle('painel-lateral--largo', !!config.largo);  // 400px (padrão) ou 560px
    painel.classList.add('painel-lateral--aberto');
  }

  function fechar() {
    if (!estaAberto()) return;
    painel.classList.remove('painel-lateral--aberto');
    painel.classList.remove('painel-lateral--largo');
    limparConteudo();
    var cb = aoFecharAtual;
    aoFecharAtual = null;
    aoTentarFecharAtual = null;
    aoMudarModoAtual = null;
    if (cb) cb();
  }

  /* fechar pedido por gesto do usuário (Esc / X): a página pode interceptar
     (ex.: confirmar descarte de rascunho) devolvendo true; aí o painel não fecha agora.
     O fechar() direto (chamado pela própria página ao navegar) segue sem guarda. */
  function solicitarFechar() {
    if (!estaAberto()) return;
    if (aoTentarFecharAtual && aoTentarFecharAtual()) return;
    fechar();
  }

  function definirTitulos(titulo, subtitulo) {
    if (typeof titulo === 'string') elTitulo.textContent = titulo;
    if (typeof subtitulo === 'string') elSubtitulo.textContent = subtitulo;
  }

  /* ----- peças reutilizáveis (clonam os moldes do shell) ----- */
  function criarSecao(titulo) {
    var secao = RosterWork.tpl('tpl-painel-secao');
    if (secao) secao.querySelector('.rotulo-secao').textContent = titulo || '';
    return secao;
  }

  function criarCaixa(titulo, ehErro) {
    var caixa = RosterWork.tpl('tpl-grupo-caixa');
    if (!caixa) return null;
    caixa.querySelector('.rotulo-secao').textContent = titulo || '';
    if (ehErro) caixa.classList.add('grupo-caixa--erro');
    return caixa;
  }

  function criarLinha(rotulo, valor) {
    var linha = RosterWork.tpl('tpl-linha-info');
    if (!linha) return null;
    linha.querySelector('.linha-info-rotulo').textContent = rotulo || '';
    linha.querySelector('.linha-info-valor').textContent = (valor == null ? '' : String(valor));
    return linha;
  }

  /* seção colapsável: o título é um botão (rótulo + chevron) que mostra/oculta
     o corpo. A página adiciona as linhas no .painel-secao-corpo. opcoes.aberta
     define o estado inicial (padrão: aberta). */
  function criarSecaoColapsavel(titulo, opcoes) {
    var secao = RosterWork.tpl('tpl-painel-secao-colapsavel');
    if (!secao) return null;
    secao.querySelector('.rotulo-secao').textContent = titulo || '';
    var cabecalho = secao.querySelector('.painel-secao-cabecalho');
    var aberta = !opcoes || opcoes.aberta !== false;
    cabecalho.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    /* o clique que recolhe/expande é delegado no corpo do painel (ver inicializar) —
       vale para seções criadas aqui e para as clonadas de <template> (ex.: Novo usuário) */
    return secao;
  }

  /* estado do corpo (texto centralizado): vazio ou erro */
  function criarEstado(texto) {
    var el = RosterWork.tpl('tpl-painel-estado');
    if (el) el.textContent = texto || '';
    return el;
  }

  /* carregando do corpo: o painel é um container, então usa o círculo (MANUAL §8) */
  function criarCarregando() {
    return RosterWork.tpl('tpl-painel-carregando');
  }

  function inicializar() {
    pegarReferencias();
    if (!painel) return;

    elFechar.addEventListener('click', solicitarFechar);

    /* recolher/expandir seções colapsáveis: clique delegado no corpo cobre todas as
       seções (.painel-secao-cabecalho), criadas por JS ou clonadas de <template> */
    elCorpo.addEventListener('click', function (evento) {
      var cab = evento.target.closest('.painel-secao-cabecalho');
      if (!cab) return;
      var abrir = cab.getAttribute('aria-expanded') !== 'true';
      cab.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });

    /* as abas Ver/Editar usam o componente geral de abas (geral-abas.js já cuida do
       visual por delegação); aqui só reagimos à troca: guardamos o modo e avisamos a página */
    if (window.RosterWork.abas) {
      window.RosterWork.abas.ligar(elAbas, function (aba) {
        var modo = aba.getAttribute('data-painel-modo');
        if (!modo) return;
        modoAtual = modo;
        if (aoMudarModoAtual) aoMudarModoAtual(modo);
      });
    }

    /* Esc fecha — mas o modal tem precedência (não vaza para o painel atrás) */
    document.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Escape') return;
      if (document.querySelector('.modal-veu--aberto')) return;
      solicitarFechar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }

  window.RosterWork.painel = {
    abrir: abrir,
    fechar: fechar,
    estaAberto: estaAberto,
    definirTitulos: definirTitulos,
    corpo: function () { return elCorpo; },
    subcabecalho: function () { return elSubcabecalho; },
    rodape: function () { return elRodape; },
    modo: function () { return modoAtual; },
    criarSecao: criarSecao,
    criarCaixa: criarCaixa,
    criarLinha: criarLinha,
    criarSecaoColapsavel: criarSecaoColapsavel,
    criarEstado: criarEstado,
    criarCarregando: criarCarregando
  };
})();
