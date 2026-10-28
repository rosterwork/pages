/* ============================================================
   GERAL-PAINEL — painel lateral de detalhes (a "gaveta" direita)
   Casca compartilhada: abre/fecha, alterna Ver/Editar (pelo seletor ou
   pelo Editar que a página põe no rodapé) e entrega à
   página os pontos onde montar o conteúdo (linha das abas de seção,
   corpo, sub-cabeçalho e rodapé) e as peças prontas (seção, caixa, linha rótulo/valor).
   No celular, puxar o corpo para o lado troca para a aba vizinha da linha das abas
   (geral-deslizar.js), como tocar nela; nas sub-telas, não.
   Só liga/desliga classe e clona moldes — não inventa estrutura.
   Estrutura no index.html (#painel); estilos em geral-painel.css.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var painel, elTitulo, elTituloExtra, elSubtitulo, elAbas, elLinhaAbas, elSubcabecalho, elCorpo, elRodape, elFechar;
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
    elLinhaAbas = document.getElementById('painel-linha-abas');
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

  /* o Editar que a página põe no rodapé da leitura: entra na edição e avisa a página para montar o formulário */
  function editar() {
    ativarAba('editar');
    if (aoMudarModoAtual) aoMudarModoAtual('editar');
  }

  /* Salvar/Cancelar da edição: volta para a leitura e avisa a página para redesenhar */
  function voltarParaLeitura() {
    ativarAba('ver');
    if (aoMudarModoAtual) aoMudarModoAtual('ver');
  }

  function limparConteudo() {
    elCorpo.textContent = '';
    elLinhaAbas.textContent = '';
    elLinhaAbas.classList.add('oculto');
    elSubcabecalho.textContent = '';
    elSubcabecalho.classList.add('oculto');
    elRodape.textContent = '';
    elRodape.classList.add('oculto');
  }

  /* abre o painel. config = { titulo, tituloExtra?, subtitulo, editavel?, modoFixo?, largo?, aoMudarModo?(modo), aoFechar?(), aoTentarFechar?()->bool }
     a linha das abas/corpo/sub-cabeçalho/rodapé nascem vazios; a página preenche pelos getters abaixo */
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
    if (window.RosterWork.voltar && window.RosterWork.celular && window.RosterWork.celular()) {
      window.RosterWork.voltar.empilhar(aoVoltar);
    }
  }

  /* no celular o painel cobre a tela: o voltar do navegador (o do Android) fecha o painel em vez
     de trocar de tela. Ao abrir, o painel ganha uma entrada no histórico (RosterWork.voltar, no
     roteador); o voltar a gasta e pede para fechar como o X. Com dados não salvos (a pergunta
     abre) ou com um aviso aberto, o painel fica e a entrada volta. */
  function aoVoltar() {
    if (!estaAberto()) return;
    if (document.querySelector('.modal-veu--aberto') || (aoTentarFecharAtual && aoTentarFecharAtual())) {
      window.RosterWork.voltar.empilhar(aoVoltar);
      return;
    }
    fechar();
  }

  function fechar() {
    if (!estaAberto()) return;
    if (window.RosterWork.voltar) window.RosterWork.voltar.desempilhar(aoVoltar);   /* fechou pelo X, Salvar etc.: tira a entrada do voltar */
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

  /* troca os títulos depois de aberto; extra = o complemento ao lado do título (vazio some) */
  function definirTitulos(titulo, subtitulo, extra) {
    if (typeof titulo === 'string') elTitulo.textContent = titulo;
    if (typeof subtitulo === 'string') elSubtitulo.textContent = subtitulo;
    if (typeof extra === 'string' && elTituloExtra) {
      elTituloExtra.textContent = extra;
      elTituloExtra.classList.toggle('oculto', !extra);
    }
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

  /* caixa que abre e fecha: o desenho da caixa, com o título num botão com a seta. A página adiciona os itens no
     .grupo-caixa-corpo; opcoes.aberta define o estado inicial (padrão: fechada). O clique é delegado no corpo do
     painel, como nas seções colapsáveis */
  function criarCaixaRecolhivel(titulo, opcoes) {
    var caixa = RosterWork.tpl('tpl-grupo-caixa-recolhivel');
    if (!caixa) return null;
    caixa.querySelector('.rotulo-secao').textContent = titulo || '';
    caixa.querySelector('.grupo-caixa-cabecalho').setAttribute('aria-expanded', opcoes && opcoes.aberta ? 'true' : 'false');
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

  /* carregando do corpo: o painel é um container, então usa o círculo (Guia visual › Vazio e carregando) */
  function criarCarregando() {
    return RosterWork.tpl('tpl-painel-carregando');
  }

  /* ----- celular: puxar o corpo para o lado troca para a aba vizinha (geral-deslizar.js) ----- */
  function abasVisiveis() {
    return Array.prototype.filter.call(elLinhaAbas.querySelectorAll('.aba'), function (aba) { return aba.getClientRects().length > 0; });
  }

  /* a aba ao lado da escolhida (direcao -1: a de antes; 1: a de depois); null na ponta */
  function abaVizinha(direcao) {
    var abas = abasVisiveis();
    for (var i = 0; i < abas.length; i++) {
      if (abas[i].classList.contains('aba--ativa')) return abas[i + direcao] || null;
    }
    return null;
  }

  function emSubtela() {
    return Array.prototype.some.call(elCorpo.querySelectorAll('.subtela'), function (s) { return s.getClientRects().length > 0; });
  }

  /* vale com duas abas ou mais, fora das sub-telas. Trocar pelo dedo é tocar na aba vizinha: a pergunta de
     descartar o rascunho, que a página põe no clique da aba, vale também; se ela segura a troca, o conteúdo volta */
  function ligarDeslize() {
    if (!window.RosterWork.deslizar) return;
    window.RosterWork.deslizar.ligar(elCorpo, {
      ativo: function () {
        return !!(window.RosterWork.celular && window.RosterWork.celular()) && estaAberto()
          && !elLinhaAbas.classList.contains('oculto') && abasVisiveis().length > 1 && !emSubtela();
      },
      destino: function (direcao) {
        var aba = abaVizinha(direcao);
        return aba ? aba.textContent.trim() : null;
      },
      ir: function (direcao) {
        var aba = abaVizinha(direcao);
        if (!aba) return null;
        aba.click();
        return aba.classList.contains('aba--ativa') ? Promise.resolve() : null;
      }
    });
  }

  function inicializar() {
    pegarReferencias();
    if (!painel) return;

    elFechar.addEventListener('click', solicitarFechar);

    /* recolher/expandir seções colapsáveis e caixas que abrem e fecham: clique delegado no corpo cobre todas
       (.painel-secao-cabecalho e .grupo-caixa-cabecalho), criadas por JS ou clonadas de <template> */
    elCorpo.addEventListener('click', function (evento) {
      var cab = evento.target.closest('.painel-secao-cabecalho, .grupo-caixa-cabecalho');
      if (!cab) return;
      var abrir = cab.getAttribute('aria-expanded') !== 'true';
      cab.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });

    /* o seletor Ver/Editar usa o componente geral de abas (geral-abas.js já cuida do
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

    ligarDeslize();
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
    /* muda a largura com o painel aberto (a aba que precisa de espaço: ex., Várias trocas do Solicitar troca) */
    largo: function (sim) { if (painel) painel.classList.toggle('painel-lateral--largo', !!sim); },
    linhaAbas: function () { return elLinhaAbas; },
    corpo: function () { return elCorpo; },
    subcabecalho: function () { return elSubcabecalho; },
    rodape: function () { return elRodape; },
    modo: function () { return modoAtual; },
    editar: editar,
    voltarParaLeitura: voltarParaLeitura,
    criarSecao: criarSecao,
    criarCaixa: criarCaixa,
    criarCaixaRecolhivel: criarCaixaRecolhivel,
    criarLinha: criarLinha,
    criarSecaoColapsavel: criarSecaoColapsavel,
    criarEstado: criarEstado,
    criarCarregando: criarCarregando
  };
})();
