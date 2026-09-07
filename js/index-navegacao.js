(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  /* cada página registra aqui um objeto com .iniciar(conteudo); a navegação o
     chama toda vez que a página é exibida (carrega seus dados / monta a tela) */
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* manifesto: cada página declara seu fragmento e os arquivos que carrega.
     Páginas fora do manifesto ficam inertes (o item de menu não navega). */
  var manifesto = {
    inicio: { html: 'inicio.html', css: ['css/inicio.css'], js: ['js/inicio-aviso.js', 'js/inicio.js'] },
    perfil: { html: 'perfil.html', css: [], js: ['js/perfil-dados.js', 'js/perfil-senha.js'] },   /* index-perfil.js já vem no shell (liga o botão do cabeçalho) */
    avisos: { html: 'avisos.html', css: ['css/avisos.css'], js: ['js/inicio-aviso.js', 'js/avisos-notificacoes.js', 'js/avisos-pendencias.js', 'js/avisos.js'] },
    escalas: { html: 'escalas.html', css: ['css/escalas-controles.css', 'css/escalas-mes.css', 'css/escalas-semana.css', 'css/escalas-dia.css', 'css/escalas-colunas.css', 'css/escalas-calendario.css', 'css/escalas-militares.css', 'css/escalas-painel.css', 'css/escalas-painel-secoes.css'], js: ['js/escalas-dados.js', 'js/escalas-celula.js', 'js/escalas-mes.js', 'js/escalas-semana.js', 'js/escalas-dia.js', 'js/escalas-colunas.js', 'js/escalas-calendario.js', 'js/escalas-militares.js', 'js/escalas-militares-painel.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/escalas-painel-continuos.js', 'js/escalas-painel-pontuais.js', 'js/escalas.js'] },
    usuarios: { html: 'usuarios.html', css: ['css/usuarios-cards.css', 'css/usuarios-filtros.css'], js: ['js/usuarios-exibir.js', 'js/usuarios-painel.js', 'js/usuarios-painel-editar.js', 'js/usuarios-painel-transferir.js', 'js/usuarios-painel-promover.js', 'js/usuarios-novo-usuario-dados.js', 'js/usuarios-novo-usuario-envio.js', 'js/usuarios-novo-usuario.js', 'js/usuarios-correcoes.js', 'js/usuarios-cadastros.js', 'js/usuarios.js'] },
    postos: { html: 'postos.html', css: ['css/postos-cards.css'], js: ['js/postos-painel.js', 'js/postos-viaturas-transferir.js', 'js/postos-viaturas-manutencao.js', 'js/postos-viaturas-painel.js', 'js/postos-viaturas.js', 'js/postos.js'] },
    trocas: { html: 'trocas.html', css: ['css/trocas.css'], js: ['js/trocas-dados.js', 'js/trocas-painel.js', 'js/trocas-solicitar.js', 'js/trocas.js'] },
    folgas: { html: 'folgas.html', css: ['css/folgas.css', 'css/folgas-painel.css'], js: ['js/folgas-dados.js', 'js/folgas-minhas.js', 'js/folgas-saldos.js', 'js/folgas-listas.js', 'js/folgas-painel.js', 'js/folgas-aprovacao-painel.js', 'js/folgas.js'] },
    extrajornada: { html: 'extrajornada.html', css: ['css/extrajornada.css', 'css/escalas-mes.css', 'css/escalas-semana.css', 'css/escalas-painel.css'], js: ['js/extrajornada-dados.js', 'js/escalas-dados.js', 'js/escalas-celula.js', 'js/escalas-mes.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/extrajornada-escala.js', 'js/extrajornada-disponibilidade.js', 'js/extrajornada-cotas-painel.js', 'js/extrajornada-painel-dia.js', 'js/extrajornada.js'] },
    afastamentos: { html: 'afastamentos.html', css: ['css/afastamentos-atestados.css'], js: ['js/afastamentos-dados.js', 'js/afastamentos-ferias.js', 'js/afastamentos-licencas.js', 'js/afastamentos-dispensas.js', 'js/afastamentos.js'] },
    distribuicao: { html: 'distribuicao.html', css: ['css/distribuicao.css', 'css/distribuicao-regras.css'], js: ['js/distribuicao-modelos-dados.js', 'js/distribuicao-modelos.js', 'js/distribuicao-modelos-editar.js', 'js/distribuicao-modelos-salvar.js', 'js/distribuicao-modelos-criar.js', 'js/distribuicao-regras-dados.js', 'js/distribuicao-regras.js', 'js/distribuicao.js'] },
    historico: { html: 'historico.html', css: ['css/historico.css'], js: ['js/historico.js'] },
    ajustes: { html: 'ajustes.html', css: ['css/ajustes.css'], js: ['js/ajustes.js'] },
    programador: { html: 'programador.html', css: ['css/programador.css'], js: ['js/programador.js'] }
  };

  var conteudo;
  var itens = [];
  var jsCarregados = {};
  var cssCarregados = {};

  /* senha de navegação (latest-wins): cada clique/rota incrementa; depois de cada
     espera (baixar o fragmento, carregar os scripts) a navegação confere se ainda é
     a mais recente e, se outra assumiu, aborta em silêncio. Sem isto, dois cliques
     rápidos deixam duas navegações escrevendo na mesma tela (menu numa página,
     conteúdo em outra). O AbortController ainda cancela o download abandonado. */
  var navToken = 0;
  var navAbort = null;

  function marcarAtivo(pagina) {
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.toggle('menu-item--selecionado', itens[i].getAttribute('data-pagina') === pagina);
    }
  }

  function carregarCss(href) {
    if (cssCarregados[href]) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    cssCarregados[href] = true;
  }

  function carregarJs(src) {
    return new Promise(function (resolver) {
      if (jsCarregados[src]) { resolver(); return; }
      var script = document.createElement('script');
      script.src = src;
      script.onload = function () { jsCarregados[src] = true; resolver(); };
      script.onerror = function () { resolver(); };
      document.body.appendChild(script);
    });
  }

  /* insere um fragmento de HTML já escrito à mão no container de conteúdo;
     o roteador apenas posiciona o arquivo — não inventa estrutura */
  function inserirFragmento(html) {
    /* troca a página, preservando um eventual véu de carregamento já exibido */
    var filhos = Array.prototype.slice.call(conteudo.children);
    for (var i = 0; i < filhos.length; i++) {
      /* preserva o véu de carregamento e o painel lateral — ambos vivem no shell */
      if (!filhos[i].classList.contains('carregando-veu') &&
          !filhos[i].classList.contains('painel-lateral')) conteudo.removeChild(filhos[i]);
    }
    var faixa = document.createRange();
    var fragmento = faixa.createContextualFragment(html);
    if (window.RosterWork.limparComentarios) window.RosterWork.limparComentarios(fragmento);   // tira os comentários HTML antes de entrar no DOM
    conteudo.insertBefore(fragmento, conteudo.firstChild);
  }

  /* aba pedida por quem mandou navegar (um aviso, uma pendência, um card do
     Início): guardada até a página montar. Vale uma vez só. */
  var abaPedida = null;

  /* clica na aba escolhida depois que a página montou — o resto acontece pelo
     mesmo caminho de sempre (o ouvinte de .aba avisa a página) */
  function abrirAbaPedida(pagina) {
    if (!abaPedida || abaPedida.pagina !== pagina) return;
    var alvo = conteudo.querySelector('.abas .aba[data-aba="' + abaPedida.aba + '"]');
    abaPedida = null;
    if (alvo && !alvo.classList.contains('oculto')) alvo.click();
  }

  async function navegar(pagina, empurrar) {
    var def = manifesto[pagina];
    if (!def) return;

    var meu = ++navToken;   /* esta navegação assume; qualquer anterior fica obsoleta */
    /* cancela o download da navegação anterior que ainda esteja no ar */
    if (navAbort) navAbort.abort();
    navAbort = ('AbortController' in window) ? new AbortController() : null;

    function esconderVeu() { if (window.RosterWork.esconderVeu) window.RosterWork.esconderVeu(conteudo); }

    marcarAtivo(pagina);
    if (window.RosterWork.fecharDropdowns) window.RosterWork.fecharDropdowns();
    if (window.RosterWork.painel) window.RosterWork.painel.fechar();   /* a gaveta é da página que sai */
    if (window.RosterWork.mostrarVeu) window.RosterWork.mostrarVeu(conteudo);

    var resposta;
    try {
      resposta = await fetch(def.html, navAbort ? { signal: navAbort.signal } : undefined);
    } catch (e) {
      /* download cancelado por uma navegação mais nova: sai quieto (a nova cuida do véu) */
      return;
    }
    if (meu !== navToken) return;                 /* outra navegação assumiu enquanto baixava */
    if (!resposta.ok) { esconderVeu(); return; }
    var html = await resposta.text();
    if (meu !== navToken) return;
    inserirFragmento(html);

    var i;
    for (i = 0; i < (def.css || []).length; i++) carregarCss(def.css[i]);
    for (i = 0; i < (def.js || []).length; i++) {
      await carregarJs(def.js[i]);
      if (meu !== navToken) return;               /* abandonou no meio do carregamento dos scripts */
    }

    /* o véu some quando a página termina de carregar (iniciar pode ser assíncrono),
       respeitando o tempo mínimo; páginas síncronas escondem logo (pelo mínimo) */
    var registro = window.RosterWork.paginas[pagina];
    var pronto = (registro && registro.iniciar) ? registro.iniciar(conteudo) : null;
    Promise.resolve(pronto).then(function () {
      if (meu !== navToken) return;               /* só a navegação vigente conclui e revela a tela */
      abrirAbaPedida(pagina); esconderVeu();
    }, function () { if (meu === navToken) esconderVeu(); });

    if (empurrar) history.pushState({ pagina: pagina }, '', '?pagina=' + pagina);
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
      var pagina = (evento.state && evento.state.pagina) || rotaDaUrl();
      if (pagina && manifesto[pagina]) navegar(pagina, false);
    });

    /* rota inicial = a da URL; sem ela (ex.: logo após o login, que abre index.html
       sem ?pagina, ou F5 na raiz) cai no Início — a home é a rota padrão */
    var inicial = rotaDaUrl();
    if (!inicial || !manifesto[inicial]) inicial = 'inicio';
    navegar(inicial, false);
  }

  /* navegação programática (ex.: "Ver todos" do sino → página de avisos) —
     respeita o guarda de saída e marca o menu; páginas sem item de menu funcionam */
  /* aba: opcional — abre a página já na aba pedida (ex.: um aviso de correção
     leva a Usuários › Correções, não à página inteira) */
  window.RosterWork.irParaPagina = function (pagina, aba) {
    if (!manifesto[pagina]) return;
    podeNavegar().then(function (ok) {
      if (!ok) return;
      abaPedida = aba ? { pagina: pagina, aba: aba } : null;
      navegar(pagina, true);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
