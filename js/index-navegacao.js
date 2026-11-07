(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  /* cada página registra aqui um objeto com .iniciar(conteudo); a navegação o
     chama toda vez que a página é exibida (carrega seus dados / monta a tela) */
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* manifesto: cada página declara seu fragmento e os arquivos que carrega.
     Páginas fora do manifesto ficam inertes (o item de menu não navega). */
  var manifesto = {
    pendencias: { html: 'pendencias.html', css: ['css/pendencias.css', 'css/escalas-painel.css', 'css/escalas-painel-edicao.css'], js: ['js/escalas-dados.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/trocas-dados.js', 'js/trocas-painel-situacao.js', 'js/trocas-painel.js', 'js/trocas-painel-varias.js', 'js/escalas-impressao-pdf.js', 'js/trocas-registro-pdf.js', 'js/folgas-dados.js', 'js/folgas-aprovacao-painel.js', 'js/usuarios-correcao-painel.js', 'js/pendencias.js'] },   /* os painéis de decisão da Trocas, da Folga e da correção de dados vêm junto */
    perfil: { html: 'perfil.html', cobrirAteOsDados: true, css: [], js: ['js/perfil-dados-promocoes.js', 'js/perfil-dados.js', 'js/perfil-senha.js'] },   /* index-perfil.js já vem no shell (liga o botão do cabeçalho) */
    manual: { html: 'manual.html', css: ['css/manual.css'], js: [] },   /* index-manual.js já vem no shell (liga o botão + registra a página) */
    avisos: { html: 'avisos.html', css: ['css/avisos.css'], js: ['js/avisos-comunicado.js', 'js/avisos-notificacoes.js', 'js/avisos.js'] },
    escalas: { html: 'escalas.html', css: ['css/escalas-controles.css', 'css/escalas-mes.css', 'css/escalas-semana.css', 'css/escalas-dia.css', 'css/escalas-colunas.css', 'css/escalas-calendario.css', 'css/escalas-militares.css', 'css/escalas-painel.css', 'css/escalas-painel-secoes.css', 'css/escalas-painel-edicao.css', 'css/escalas-minha.css', 'css/trocas-formulario.css', 'css/nova-extra-dia.css'], js: ['js/escalas-dados.js', 'js/trocas-dados.js', 'js/escalas-celula.js', 'js/escalas-mes.js', 'js/escalas-semana.js', 'js/escalas-dia.js', 'js/escalas-minha.js', 'js/escalas-colunas.js', 'js/escalas-calendario.js', 'js/escalas-militares.js', 'js/escalas-militares-painel.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/escalas-painel-quem.js', 'js/escalas-painel-funcoes.js', 'js/escalas-painel-ciclo.js', 'js/escalas-painel-salvar.js', 'js/escalas-painel-remover-listas.js', 'js/escalas-painel-remover.js', 'js/escalas-painel-remover-troca.js', 'js/escalas-painel-linha-aplicar.js', 'js/escalas-painel-linha.js', 'js/escalas-painel-adicionar-listas.js', 'js/escalas-painel-onde.js', 'js/escalas-painel-adicionar.js', 'js/escalas-painel-remanejar-listas.js', 'js/escalas-painel-remanejar.js', 'js/trocas-solicitar-campos.js', 'js/trocas-solicitar-militar.js', 'js/trocas-varias-calendario.js', 'js/trocas-varias-registrar.js', 'js/trocas-varias-resumo.js', 'js/trocas-varias.js', 'js/trocas-solicitar.js', 'js/escalas-painel-troca.js', 'js/escalas-painel-militar.js', 'js/escalas-painel-continuos.js', 'js/nova-extra-util.js', 'js/nova-extra-falta.js', 'js/nova-extra-grade.js', 'js/nova-extra-dia-outros.js', 'js/nova-extra-dia.js', 'js/escalas-painel-extra.js', 'js/escalas-legenda.js', 'js/escalas-impressao-pdf.js', 'js/escalas-impressao-legenda.js', 'js/escalas-impressao.js', 'js/escalas-impressao-grade-celula.js', 'js/escalas-impressao-grade-pdf.js', 'js/escalas-impressao-grade.js', 'js/escalas-sysbm.js', 'js/escalas-filtros.js', 'js/escalas-atualizando.js', 'js/escalas-dia-na-grade.js', 'js/escalas-esqueleto.js', 'js/escalas.js'] },
    usuarios: { html: 'usuarios.html', css: ['css/usuarios-cards.css', 'css/usuarios-exibir.css', 'css/usuarios-antiguidade.css', 'css/usuarios-administradores.css', 'css/usuarios-painel.css', 'css/usuarios-afastamentos.css'], js: ['js/usuarios-exibir.js', 'js/usuarios-painel.js', 'js/usuarios-painel-leitura.js', 'js/usuarios-painel-editar.js', 'js/usuarios-painel-datas.js', 'js/usuarios-painel-transferir.js', 'js/usuarios-painel-promover.js', 'js/usuarios-painel-baixa.js', 'js/usuarios-painel-acesso.js', 'js/usuarios-afastamentos-dados.js', 'js/usuarios-painel-afastamentos.js', 'js/usuarios-painel-afastamentos-editar.js', 'js/usuarios-novo-usuario-dados.js', 'js/usuarios-novo-usuario-envio.js', 'js/usuarios-novo-usuario.js', 'js/usuarios-correcao-painel.js', 'js/usuarios-antiguidade.js', 'js/usuarios-administradores.js', 'js/usuarios-afastamentos-caixa.js', 'js/usuarios-afastamentos.js', 'js/usuarios.js'] },
    trocas: { html: 'trocas.html', css: ['css/trocas.css', 'css/trocas-formulario.css', 'css/escalas-painel.css', 'css/escalas-painel-edicao.css'], js: ['js/escalas-dados.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/trocas-dados.js', 'js/trocas-painel-situacao.js', 'js/trocas-painel.js', 'js/trocas-painel-varias.js', 'js/escalas-impressao-pdf.js', 'js/trocas-registro-pdf.js', 'js/trocas-relatorio-pdf.js', 'js/trocas-imprimir-alteracoes.js', 'js/trocas-imprimir.js', 'js/trocas-pendencia-painel.js', 'js/trocas-solicitar-campos.js', 'js/trocas-solicitar-militar.js', 'js/trocas-varias-calendario.js', 'js/trocas-varias-registrar.js', 'js/trocas-varias-resumo.js', 'js/trocas-varias.js', 'js/trocas-varias-editar.js', 'js/trocas-solicitar.js', 'js/trocas-editar.js', 'js/trocas.js'] },
    folgas: { html: 'folgas.html', css: ['css/folgas.css', 'css/folgas-painel.css', 'css/escalas-painel.css', 'css/escalas-painel-edicao.css'], js: ['js/escalas-dados.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/folgas-dados.js', 'js/folgas-minhas.js', 'js/folgas-saldos.js', 'js/folgas-listas.js', 'js/folgas-painel.js', 'js/folgas-aprovacao-painel.js', 'js/folgas.js'] },
    historico: { html: 'historico.html', css: ['css/historico.css'], js: ['js/historico.js'] },
    /* o Treinamento (para todos): a lista dos roteiros do passo a passo; o modo treino e os roteiros vêm no shell
       (geral-treino.js, geral-guia*.js e os <template data-roteiro> do index.html) */
    treinamento: { html: 'treinamento.html', css: ['css/treinamento.css'], js: ['js/treinamento.js'] },
    /* os Ajustes (só administrador): a Distribuição (o ritmo, os postos, o efetivo e como a escala se
       monta), o Horário de expediente e os Feriados */
    ajustes: { html: 'ajustes.html', css: ['css/nova-distribuicao.css', 'css/ajustes.css'], js: ['js/nova-distribuicao-pecas.js', 'js/nova-distribuicao-dados.js', 'js/nova-distribuicao-caixas.js', 'js/nova-distribuicao-ritmo.js', 'js/nova-distribuicao-postos.js', 'js/nova-distribuicao-efetivo.js', 'js/nova-distribuicao-funcoes.js', 'js/nova-distribuicao-acumulos.js', 'js/nova-distribuicao-blocos.js', 'js/nova-distribuicao-militares.js', 'js/nova-distribuicao-graduacao.js', 'js/nova-distribuicao-conferir.js', 'js/nova-distribuicao-versoes.js', 'js/nova-distribuicao.js', 'js/ajustes-horario.js', 'js/ajustes-feriados.js', 'js/ajustes.js'] },
    programador: { html: 'programador.html', cobrirAteOsDados: true, css: ['css/programador.css', 'css/programador-guia.css'], js: ['js/programador-telas.js', 'js/programador-bugs-formulario.js', 'js/programador-bugs.js', 'js/programador-bug-ligado.js', 'js/programador-guia.js', 'js/programador.js'] },
    'nova-extra': { html: 'nova-extra.html', css: ['css/escalas-mes.css', 'css/escalas-calendario.css', 'css/escalas-painel.css', 'css/escalas-controles.css', 'css/nova-extra-dia.css', 'css/nova-extra-cotas.css', 'css/nova-extra.css'], js: ['js/escalas-dados.js', 'js/escalas-celula.js', 'js/escalas-esqueleto.js', 'js/escalas-impressao-pdf.js', 'js/escalas-impressao-legenda.js', 'js/escalas-impressao-grade-celula.js', 'js/escalas-impressao-grade-pdf.js', 'js/escalas-impressao-grade.js', 'js/nova-extra-util.js', 'js/nova-extra-pedido.js', 'js/nova-extra-minimo.js', 'js/nova-extra-organizar.js', 'js/nova-extra-acoes.js', 'js/nova-extra-cotas.js', 'js/nova-extra-otimizador.js', 'js/nova-extra-falta.js', 'js/nova-extra-grade.js', 'js/nova-extra-montar.js', 'js/nova-extra-por-dia.js', 'js/nova-extra-dia-outros.js', 'js/nova-extra-dia.js', 'js/nova-extra-lista.js', 'js/nova-extra-filtros.js', 'js/nova-extra-relatorios-pdf.js', 'js/nova-extra-imprimir.js', 'js/nova-extra-imprimir-grade.js', 'js/nova-extra-relatorio.js', 'js/nova-extra.js'] }   /* a Extrajornada (o menu "Extrajornada"); as barras, o bloco do calendário, o desenho do painel do dia, a Legenda e o Imprimir da grade vêm da Escala */
  };

  var conteudo;
  var itens = [];
  var jsCarregados = {};   /* src → promessa da carga: quem pedir de novo enquanto baixa espera a mesma (o arquivo roda uma vez só) */
  var cssCarregados = {};

  /* senha de navegação (latest-wins): cada clique/rota incrementa; depois de cada
     espera (baixar o fragmento, carregar os scripts) a navegação confere se ainda é
     a mais recente e, se outra assumiu, aborta em silêncio. Sem isto, dois cliques
     rápidos deixam duas navegações escrevendo na mesma tela (menu numa página,
     conteúdo em outra). O AbortController ainda cancela o download abandonado. */
  var navToken = 0;
  var navAbort = null;
  var paginaAtual = null;   /* a tela da navegação mais recente */
  var paginaNaTela = null;  /* a tela que está de fato à vista */
  var navegacaoNoAr = true; /* a troca de tela ainda não terminou (o passo a passo espera; RosterWork.navegando) */

  /* a casca da página (#casca-pagina): até CASCA_MS a tela antiga fica, sem responder; passando disso, a casca no lugar dela */
  var CASCA_MS = 300;
  var relogioCasca = 0;

  function mostrarCasca(sim) {
    var casca = document.getElementById('casca-pagina');
    if (casca) casca.classList.toggle('oculto', !sim);
    /* o cartão é só da abertura do sistema */
    var cartao = !sim && document.getElementById('abertura-cartao');
    if (cartao) cartao.remove();
  }

  function marcarAtivo(pagina) {
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.toggle('menu-item--selecionado', itens[i].getAttribute('data-pagina') === pagina);
    }
  }

  /* a promessa se cumpre com o estilo pronto (a tela nova só entra com ele); com falha também */
  function carregarCss(href) {
    if (cssCarregados[href]) return cssCarregados[href];
    cssCarregados[href] = new Promise(function (resolver) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = function () { resolver(); };
      link.onerror = function () { delete cssCarregados[href]; resolver(); };
      document.head.appendChild(link);
    });
    return cssCarregados[href];
  }

  /* async = false: os arquivos pedidos juntos baixam ao mesmo tempo e rodam na ordem em que
     foram pedidos (a do manifesto). Falhou: esquece, para a próxima navegação tentar de novo */
  function carregarJs(src) {
    if (jsCarregados[src]) return jsCarregados[src];
    jsCarregados[src] = new Promise(function (resolver) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function () { resolver(); };
      script.onerror = function () { delete jsCarregados[src]; resolver(); };
      document.body.appendChild(script);
    });
    return jsCarregados[src];
  }

  /* tira a página que sai, preservando o véu de carregamento, a casca, a camada do cartão das etapas, o painel lateral e o
     rodapé dele (o rodapé único da página, fora do painel no computador) — vivem no shell */
  function limparConteudo() {
    var filhos = Array.prototype.slice.call(conteudo.children);
    for (var i = 0; i < filhos.length; i++) {
      if (!filhos[i].classList.contains('carregando-veu') &&
          !filhos[i].classList.contains('casca-pagina') &&
          !filhos[i].classList.contains('etapas-camada') &&
          !filhos[i].classList.contains('painel-lateral') &&
          !filhos[i].classList.contains('painel-rodape')) conteudo.removeChild(filhos[i]);
    }
  }

  /* insere um fragmento de HTML já escrito à mão no container de conteúdo;
     o roteador apenas posiciona o arquivo — não inventa estrutura */
  function inserirFragmento(html) {
    limparConteudo();   /* troca a página, preservando um eventual véu de carregamento já exibido */
    var faixa = document.createRange();
    var fragmento = faixa.createContextualFragment(html);
    if (window.RosterWork.limparComentarios) window.RosterWork.limparComentarios(fragmento);   // tira os comentários HTML antes de entrar no DOM
    conteudo.insertBefore(fragmento, conteudo.firstChild);
  }

  /* aba pedida por quem mandou navegar (um aviso, uma pendência): guardada até a
     página montar. Vale uma vez só. */
  var abaPedida = null;
  var referenciaPedida = null;

  /* clica na aba escolhida depois que a página montou — o resto acontece pelo
     mesmo caminho de sempre (o ouvinte de .aba avisa a página) */
  function abrirAbaPedida(pagina) {
    if (!abaPedida || abaPedida.pagina !== pagina) return;
    var alvo = conteudo.querySelector('.abas .aba[data-aba="' + abaPedida.aba + '"]');
    abaPedida = null;
    if (alvo && !alvo.classList.contains('oculto')) alvo.click();
  }

  /* telas que não existem no celular: o item do menu diz (data-lugar-celular="fora") */
  function foraDoCelular(pagina) {
    if (!(window.RosterWork.celular && window.RosterWork.celular())) return false;
    return !!document.querySelector('.menu-item[data-pagina="' + pagina + '"][data-lugar-celular="fora"]');
  }

  /* um aviso no lugar da tela, com o nome dela tirado do item do menu: "Esta tela só funciona no
     computador." (molde #tpl-pagina-so-computador; no celular, quem chega a uma dessas telas por um aviso,
     um link ou o endereço; o CSS e o JS da tela nem carregam) ou o bloqueio de manutenção (#tpl-pagina-manutencao) */
  function mostrarNoLugarDaTela(molde, pagina) {
    var tela = window.RosterWork.tpl ? window.RosterWork.tpl(molde) : null;
    if (!tela) return;
    var nome = document.querySelector('.menu-item[data-pagina="' + pagina + '"] .menu-item-label');
    tela.querySelector('h1').textContent = nome ? nome.textContent : '';
    limparConteudo();
    conteudo.insertBefore(tela, conteudo.firstChild);
  }

  async function navegar(pagina, empurrar) {
    var def = manifesto[pagina];
    if (!def) return;

    /* versão nova do app esperando (geral-aplicativo.js): a troca de tela recarrega já na versão
       nova, sem misturar a velha com a nova; com aba ou registro pedido, ou edição não salva,
       fica para a próxima troca */
    var app = window.RosterWork.aplicativo;
    var guarda = window.RosterWork.guardaSaida;
    if (app && app.temVersaoNova() && !abaPedida && !referenciaPedida && !(guarda && guarda.temPendencia())) {
      app.irPara('index.html?pagina=' + encodeURIComponent(pagina));
      return;
    }

    var meu = ++navToken;   /* esta navegação assume; qualquer anterior fica obsoleta */
    /* cancela o download da navegação anterior que ainda esteja no ar */
    if (navAbort) navAbort.abort();
    navAbort = ('AbortController' in window) ? new AbortController() : null;
    paginaAtual = pagina;
    navegacaoNoAr = true;

    var manutencao = window.RosterWork.manutencao;
    if (manutencao) manutencao.parar();

    /* o menu marca na hora; a tela antiga fica, sem responder, enquanto a nova não chega */
    marcarAtivo(pagina);
    if (window.RosterWork.fecharDropdowns) window.RosterWork.fecharDropdowns();
    conteudo.inert = true;
    clearTimeout(relogioCasca);
    relogioCasca = setTimeout(function () { mostrarCasca(true); }, CASCA_MS);

    /* a tela nova entra: o painel e a camada aberta (o painel ou a folha "Mais", no celular) saem junto com a antiga; a
       entrada da camada no histórico vira a da página nova, sem voltar antes */
    var trocarEntrada = false;
    function tirarATelaAntiga() {
      trocarEntrada = !!camada;
      camada = null;
      if (window.RosterWork.painel) window.RosterWork.painel.fechar();
      conteudo.inert = false;
      paginaNaTela = pagina;
    }
    function registrarEndereco() {
      if (!empurrar) return;
      if (trocarEntrada) history.replaceState({ pagina: pagina }, '', '?pagina=' + pagina);
      else history.pushState({ pagina: pagina }, '', '?pagina=' + pagina);
    }
    function terminar() {
      if (meu !== navToken) return;
      clearTimeout(relogioCasca);
      mostrarCasca(false);
      navegacaoNoAr = false;
    }
    /* a tela não chegou (sem internet): a antiga continua, e o menu volta a ela */
    function naoChegou() {
      if (meu !== navToken) return;
      conteudo.inert = false;
      paginaAtual = paginaNaTela;
      marcarAtivo(paginaNaTela);
      terminar();
    }

    if (foraDoCelular(pagina)) {
      tirarATelaAntiga();
      mostrarNoLugarDaTela('tpl-pagina-so-computador', pagina);
      if (window.RosterWork.chamada) window.RosterWork.chamada.porNaPagina();
      terminar();
      registrarEndereco();
      return;
    }

    /* na abertura do sistema, a barra acompanha a página e o código desta tela (index-carregar.js) */
    var abrindo = !!document.getElementById('abertura-cartao') && !!window.RosterWork.abertura;
    var arquivos = def.js || [], aChegar = arquivos.length + 1, feitos = 0;
    if (abrindo) window.RosterWork.abertura.etapa(2);
    function chegouUm(valor) {
      feitos++;
      if (abrindo) window.RosterWork.abertura.telaChegando(feitos, aChegar);
      return valor;
    }

    /* tudo o que a tela nova precisa chega junto: a página, os estilos, o código e o aviso de manutenção (geral-manutencao.js).
       O download pode falhar no começo (fetch) ou no meio da leitura (text): cancelado por uma navegação mais nova, sai quieto */
    var chegou;
    try {
      chegou = await Promise.all([
        fetch(def.html, navAbort ? { signal: navAbort.signal } : undefined).then(function (r) { return r.ok ? r.text() : null; }).then(chegouUm),
        manutencao ? manutencao.ler(pagina) : Promise.resolve(null),
        Promise.all((def.css || []).map(carregarCss)),
        Promise.all(arquivos.map(function (src) { return carregarJs(src).then(chegouUm); }))
      ]);
    } catch (e) {
      naoChegou();
      return;
    }
    if (meu !== navToken) return;                 /* outra navegação assumiu enquanto a tela chegava */
    var html = chegou[0], aviso = chegou[1];
    if (html === null) { naoChegou(); return; }

    /* tela em manutenção: o bloqueio entra no lugar dela, que só abre quando liberar; a faixa fica acima do título */
    if (aviso && aviso.nivel === 'bloqueio') {
      tirarATelaAntiga();
      mostrarNoLugarDaTela('tpl-pagina-manutencao', pagina);
      if (window.RosterWork.chamada) window.RosterWork.chamada.porNaPagina();
      manutencao.vigiarBloqueio(pagina, function () { navegar(pagina, false); });
      terminar();
      registrarEndereco();
      return;
    }

    /* a tela nova entra montada: a página e o iniciar rodam juntos, sem pintar no meio (o iniciar esconde o que não é de
       quem está vendo). Quem só faz sentido com os dados (Meu perfil, Programador, a tela aberta numa aba pedida) fica
       coberto pela casca até eles chegarem */
    var cobrir = !!def.cobrirAteOsDados || !!(abaPedida && abaPedida.pagina === pagina);
    tirarATelaAntiga();
    if (cobrir) { clearTimeout(relogioCasca); mostrarCasca(true); }
    inserirFragmento(html);
    /* a faixa "Esperando a sua resposta" entra acima do título da página nova (geral-chamada.js) */
    if (window.RosterWork.chamada) window.RosterWork.chamada.porNaPagina();
    if (aviso) manutencao.porFaixa(aviso);

    var registro = window.RosterWork.paginas[pagina];
    var pronto = null;
    try {
      pronto = (registro && registro.iniciar) ? registro.iniciar(conteudo) : null;
    } catch (erro) {
      console.error(erro);
    }
    if (!cobrir) { clearTimeout(relogioCasca); mostrarCasca(false); }
    registrarEndereco();

    /* só a navegação vigente conclui (o iniciar pode ser assíncrono) */
    Promise.resolve(pronto).then(function () {
      if (meu !== navToken) return;
      abrirAbaPedida(pagina);
      terminar();
    }, terminar);
  }

  function rotaDaUrl() {
    var encontrado = location.search.match(/[?&]pagina=([^&]+)/);
    return encontrado ? decodeURIComponent(encontrado[1]) : null;
  }

  /* guarda de saída ao trocar de página: se há edição não salva, confirma com o nosso modal.
     Devolve uma Promise que resolve true (pode sair) ou false (continuar na página). */
  function podeNavegar() {
    var g = window.RosterWork.guardaSaida;
    if (!(g && g.temPendencia && g.temPendencia())) return Promise.resolve(true);
    return new Promise(function (resolver) {
      if (!window.RosterWork.confirmar) { resolver(true); return; }
      window.RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: window.RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: window.RosterWork.mensagens.botoes.sairSemSalvar,
        textoCancelar: window.RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { resolver(true); },
        aoCancelar: function () { resolver(false); }
      });
    });
  }

  function inicializar() {
    conteudo = document.querySelector('.conteudo');
    if (!conteudo) return;

    itens = Array.prototype.slice.call(document.querySelectorAll('.menu-item[data-pagina]'));
    for (var i = 0; i < itens.length; i++) {
      (function (item) {
        item.addEventListener('click', function () {
          var pagina = item.getAttribute('data-pagina');
          if (!manifesto[pagina]) return;   /* inerte: sem página ainda */
          podeNavegar().then(function (ok) { if (ok) navegar(pagina, true); });
        });
      })(itens[i]);
    }

    window.addEventListener('popstate', function (evento) {
      if (popsIgnorados) { popsIgnorados--; return; }    /* volta feita pelo sistema ao tirar a entrada de uma camada */
      /* no treino com passo a passo, o Voltar do navegador não muda nada: a entrada de agora volta para o alto do histórico */
      if (window.RosterWork.treino && window.RosterWork.treino.ligado() && !window.RosterWork.treino.livre()) {
        history.pushState(camada ? { pagina: paginaAtual, camada: true } : { pagina: paginaAtual }, '', '?pagina=' + paginaAtual);
        return;
      }
      if (camada) {                                        /* o voltar fecha a camada aberta; a tela fica */
        var aoVoltar = camada;
        camada = null;
        aoVoltar();
        return;
      }
      var pagina = (evento.state && evento.state.pagina) || rotaDaUrl();
      /* entrada de uma camada que já fechou (ex.: o avançar depois de fechar o painel), na mesma tela: pula */
      if (evento.state && evento.state.camada && pagina === paginaAtual) {
        popsIgnorados++;
        history.back();
        return;
      }
      if (pagina && manifesto[pagina]) navegar(pagina, false);
    });

    /* recarregou na entrada de uma camada: a camada não existe mais, volta à entrada da tela */
    if (history.state && history.state.camada) {
      popsIgnorados++;
      history.back();
    }

    /* rota inicial = a da URL; sem ela (ex.: logo após o login, que abre index.html
       sem ?pagina, ou F5 na raiz) cai na Escala — a rota padrão */
    var inicial = rotaDaUrl();
    /* o endereço da antiga tela Afastamentos abre Usuários na aba Licenças */
    if (inicial === 'afastamentos') {
      inicial = 'usuarios';
      abaPedida = { pagina: 'usuarios', aba: 'licencas' };
      history.replaceState({ pagina: 'usuarios' }, '', '?pagina=usuarios');
    }
    /* o endereço da antiga tela Distribuição abre os Ajustes (a Distribuição é a 1ª aba) */
    if (inicial === 'distribuicao') {
      inicial = 'ajustes';
      history.replaceState({ pagina: 'ajustes' }, '', '?pagina=ajustes');
    }
    if (!inicial || !manifesto[inicial]) inicial = 'escalas';
    navegar(inicial, false);
  }

  /* os arquivos de outra página, sem abrir a página (ex.: a faixa "Esperando a sua resposta" usa os painéis
     da troca da Pendências em qualquer tela); os já carregados não baixam de novo */
  window.RosterWork.carregarPecas = function (pagina) {
    var def = manifesto[pagina];
    if (!def) return Promise.resolve();
    return Promise.all((def.css || []).map(carregarCss).concat((def.js || []).map(carregarJs)));
  };

  /* navegação programática (ex.: "Ver todos" do sino → página de avisos) —
     respeita o guarda de saída e marca o menu; páginas sem item de menu funcionam */
  /* aba: opcional — abre a página já na aba pedida (ex.: um aviso de correção
     leva a Usuários › Correções, não à página inteira) */
  /* referencia (opcional): o registro que a página deve abrir ao chegar (ex.: o aviso de pedido
     de nova senha leva o CPF, e Usuários abre a ficha); a página lê uma vez por referenciaPedida */
  window.RosterWork.irParaPagina = function (pagina, aba, referencia) {
    if (!manifesto[pagina]) return;
    podeNavegar().then(function (ok) {
      if (!ok) return;
      abaPedida = aba ? { pagina: pagina, aba: aba } : null;
      referenciaPedida = referencia ? { pagina: pagina, valor: String(referencia) } : null;
      navegar(pagina, true);
    });
  };

  /* ---------- voltar do navegador: fecha a camada aberta (celular) ----------
     A camada que cobre a tela no celular (o painel, a folha "Mais") ganha uma entrada no
     histórico, no mesmo endereço: o voltar (o do Android) gasta essa entrada e a camada fecha,
     em vez de a tela trocar. empilhar(aoVoltar): cria a entrada (uma só por vez; reabrir só
     troca quem atende). desempilhar(aoVoltar): a camada fechou por outro caminho (X, Salvar,
     tocar fora): tira a entrada, sem trocar de tela (a volta que isso causa é ignorada). */
  var camada = null;        /* quem atende o voltar agora */
  var popsIgnorados = 0;    /* voltas feitas pelo próprio sistema */

  window.RosterWork.voltar = {
    empilhar: function (aoVoltar) {
      if (!camada) history.pushState(Object.assign({}, history.state, { camada: true }), '');
      camada = aoVoltar;
    },
    desempilhar: function (aoVoltar) {
      if (!camada || camada !== aoVoltar) return;
      camada = null;
      popsIgnorados++;
      history.back();
    }
  };

  /* a tela da navegação mais recente (o passo a passo segue de uma tela para outra por ela) */
  window.RosterWork.paginaAtual = function () { return paginaAtual; };
  /* a troca de tela ainda não terminou */
  window.RosterWork.navegando = function () { return navegacaoNoAr; };

  /* entrega à página a referência pedida por quem mandou navegar (vale uma vez só) */
  window.RosterWork.referenciaPedida = function (pagina) {
    if (!referenciaPedida || referenciaPedida.pagina !== pagina) return null;
    var valor = referenciaPedida.valor;
    referenciaPedida = null;
    return valor;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
