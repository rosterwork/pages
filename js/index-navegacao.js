(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  /* cada página registra aqui um objeto com .iniciar(conteudo); a navegação o
     chama toda vez que a página é exibida (carrega seus dados / monta a tela) */
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* manifesto: cada página declara seu fragmento e os arquivos que carrega.
     Páginas fora do manifesto ficam inertes (o item de menu não navega). */
  var manifesto = {
    pendencias: { html: 'pendencias.html', css: ['css/pendencias.css', 'css/escalas-painel.css', 'css/escalas-painel-edicao.css'], js: ['js/escalas-dados.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/trocas-dados.js', 'js/trocas-painel.js', 'js/trocas-painel-varias.js', 'js/escalas-impressao-pdf.js', 'js/trocas-registro-pdf.js', 'js/folgas-dados.js', 'js/folgas-aprovacao-painel.js', 'js/usuarios-correcao-painel.js', 'js/pendencias.js'] },   /* os painéis de decisão da Trocas, da Folga e da correção de dados vêm junto */
    perfil: { html: 'perfil.html', css: [], js: ['js/perfil-dados-promocoes.js', 'js/perfil-dados.js', 'js/perfil-senha.js'] },   /* index-perfil.js já vem no shell (liga o botão do cabeçalho) */
    manual: { html: 'manual.html', css: ['css/manual.css'], js: [] },   /* index-manual.js já vem no shell (liga o botão + registra a página) */
    avisos: { html: 'avisos.html', css: ['css/avisos.css'], js: ['js/avisos-comunicado.js', 'js/avisos-notificacoes.js', 'js/avisos.js'] },
    escalas: { html: 'escalas.html', css: ['css/escalas-controles.css', 'css/escalas-mes.css', 'css/escalas-semana.css', 'css/escalas-dia.css', 'css/escalas-colunas.css', 'css/escalas-calendario.css', 'css/escalas-militares.css', 'css/escalas-painel.css', 'css/escalas-painel-secoes.css', 'css/escalas-painel-edicao.css', 'css/escalas-painel-extra.css', 'css/escalas-minha.css'], js: ['js/escalas-dados.js', 'js/escalas-celula.js', 'js/escalas-mes.js', 'js/escalas-semana.js', 'js/escalas-dia.js', 'js/escalas-minha.js', 'js/escalas-colunas.js', 'js/escalas-calendario.js', 'js/escalas-militares.js', 'js/escalas-militares-painel.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/escalas-painel-formulario.js', 'js/escalas-painel-militar.js', 'js/escalas-painel-posto.js', 'js/escalas-painel-continuos.js', 'js/escalas-extra-rascunho.js', 'js/escalas-painel-extra-cobertura.js', 'js/escalas-painel-extra.js', 'js/escalas-legenda.js', 'js/escalas-impressao-pdf.js', 'js/escalas-impressao.js', 'js/escalas-impressao-grade-celula.js', 'js/escalas-impressao-grade-pdf.js', 'js/escalas-impressao-grade.js', 'js/escalas-sysbm.js', 'js/escalas-filtros.js', 'js/escalas.js'] },
    usuarios: { html: 'usuarios.html', css: ['css/usuarios-cards.css', 'css/usuarios-exibir.css', 'css/usuarios-antiguidade.css', 'css/usuarios-painel.css', 'css/usuarios-afastamentos.css'], js: ['js/usuarios-exibir.js', 'js/usuarios-painel.js', 'js/usuarios-painel-leitura.js', 'js/usuarios-painel-editar.js', 'js/usuarios-painel-datas.js', 'js/usuarios-painel-transferir.js', 'js/usuarios-painel-promover.js', 'js/usuarios-painel-baixa.js', 'js/usuarios-painel-acesso.js', 'js/usuarios-painel-administracao.js', 'js/usuarios-afastamentos-dados.js', 'js/usuarios-painel-afastamentos.js', 'js/usuarios-painel-afastamentos-editar.js', 'js/usuarios-novo-usuario-dados.js', 'js/usuarios-novo-usuario-envio.js', 'js/usuarios-novo-usuario.js', 'js/usuarios-correcao-painel.js', 'js/usuarios-antiguidade.js', 'js/usuarios-afastamentos.js', 'js/usuarios.js'] },
    postos: { html: 'postos.html', css: ['css/postos-cards.css'], js: ['js/postos-mudancas.js', 'js/postos-painel.js', 'js/postos-viaturas-transferir.js', 'js/postos-viaturas-painel.js', 'js/postos-viaturas.js', 'js/postos.js'] },
    trocas: { html: 'trocas.html', css: ['css/trocas.css', 'css/escalas-painel.css', 'css/escalas-painel-edicao.css'], js: ['js/escalas-dados.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/trocas-dados.js', 'js/trocas-painel.js', 'js/trocas-painel-varias.js', 'js/escalas-impressao-pdf.js', 'js/trocas-registro-pdf.js', 'js/trocas-relatorio-pdf.js', 'js/trocas-imprimir.js', 'js/trocas-pendencia-painel.js', 'js/trocas-solicitar-campos.js', 'js/trocas-solicitar-militar.js', 'js/trocas-varias-calendario.js', 'js/trocas-varias-registrar.js', 'js/trocas-varias-resumo.js', 'js/trocas-varias.js', 'js/trocas-varias-editar.js', 'js/trocas-solicitar.js', 'js/trocas-editar.js', 'js/trocas.js'] },
    folgas: { html: 'folgas.html', css: ['css/folgas.css', 'css/folgas-painel.css', 'css/escalas-painel.css', 'css/escalas-painel-edicao.css'], js: ['js/escalas-dados.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/folgas-dados.js', 'js/folgas-minhas.js', 'js/folgas-saldos.js', 'js/folgas-listas.js', 'js/folgas-painel.js', 'js/folgas-aprovacao-painel.js', 'js/folgas.js'] },
    extrajornada: { html: 'extrajornada.html', css: ['css/extrajornada.css', 'css/escalas-controles.css', 'css/escalas-mes.css', 'css/escalas-semana.css', 'css/escalas-painel.css', 'css/escalas-painel-secoes.css', 'css/escalas-painel-edicao.css', 'css/escalas-painel-extra.css'], js: ['js/extrajornada-dados.js', 'js/escalas-dados.js', 'js/escalas-celula.js', 'js/escalas-mes.js', 'js/escalas-painel.js', 'js/escalas-painel-editar.js', 'js/escalas-painel-formulario.js', 'js/escalas-painel-militar.js', 'js/escalas-painel-continuos.js', 'js/escalas-extra-rascunho.js', 'js/escalas-painel-extra-cobertura.js', 'js/escalas-painel-extra.js', 'js/extrajornada-calendario.js', 'js/extrajornada-solicitar.js', 'js/extrajornada-escala-celula.js', 'js/extrajornada-escala.js', 'js/extrajornada-lancar.js', 'js/extrajornada-voluntarios-lista.js', 'js/extrajornada-voluntarios.js', 'js/extrajornada-escalar.js', 'js/escalas-impressao-pdf.js', 'js/extrajornada-relatorios-pdf.js', 'js/extrajornada-relatorios.js', 'js/extrajornada.js'] },   /* o painel do dia é o mesmo da Escala (Dia, Ciclo e Extrajornada) */
    distribuicao: { html: 'distribuicao.html', css: ['css/distribuicao.css', 'css/distribuicao-regras.css'], js: ['js/distribuicao-modelos-dados.js', 'js/distribuicao-periodos.js', 'js/distribuicao-modelos.js', 'js/distribuicao-modelos-editar.js', 'js/distribuicao-modelos-salvar.js', 'js/distribuicao-modelos-criar.js', 'js/distribuicao-regras-dados.js', 'js/distribuicao-regras.js', 'js/distribuicao.js'] },
    historico: { html: 'historico.html', css: ['css/historico.css'], js: ['js/historico.js'] },
    ajustes: { html: 'ajustes.html', css: ['css/ajustes.css'], js: ['js/ajustes-extrajornada.js', 'js/ajustes.js'] },
    programador: { html: 'programador.html', css: ['css/programador.css', 'css/programador-guia.css'], js: ['js/programador-bugs-formulario.js', 'js/programador-bugs.js', 'js/programador-bug-ligado.js', 'js/programador-guia.js', 'js/programador.js'] },
    'nova-distribuicao': { html: 'nova-distribuicao.html', css: ['css/nova-distribuicao.css'], js: ['js/nova-distribuicao-pecas.js', 'js/nova-distribuicao-dados.js', 'js/nova-distribuicao-postos.js', 'js/nova-distribuicao-efetivo.js', 'js/nova-distribuicao-funcoes.js', 'js/nova-distribuicao-blocos.js', 'js/nova-distribuicao-militares.js', 'js/nova-distribuicao-conferir.js', 'js/nova-distribuicao-versoes.js', 'js/nova-distribuicao.js'] }   /* protótipo, só programador */
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

  /* tira a página que sai, preservando o véu de carregamento e o painel lateral — ambos vivem no shell */
  function limparConteudo() {
    var filhos = Array.prototype.slice.call(conteudo.children);
    for (var i = 0; i < filhos.length; i++) {
      if (!filhos[i].classList.contains('carregando-veu') &&
          !filhos[i].classList.contains('painel-lateral')) conteudo.removeChild(filhos[i]);
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

  /* no celular, quem chega a uma dessas telas (por um aviso, um link ou o endereço) vê o vazio
     "Esta tela só funciona no computador." (molde #tpl-pagina-so-computador), com o nome da tela
     tirado do item do menu, no lugar da tela quebrada; o CSS e o JS da tela nem carregam */
  function mostrarSoComputador(pagina) {
    var tela = window.RosterWork.tpl ? window.RosterWork.tpl('tpl-pagina-so-computador') : null;
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

    function esconderVeu() { if (window.RosterWork.esconderVeu) window.RosterWork.esconderVeu(conteudo); }

    /* a camada aberta (o painel ou a folha "Mais", no celular) sai junto com a página: a entrada
       dela no histórico vira a da página nova, sem voltar antes */
    var trocarEntrada = !!camada;
    camada = null;
    function registrarEndereco() {
      if (!empurrar) return;
      if (trocarEntrada) history.replaceState({ pagina: pagina }, '', '?pagina=' + pagina);
      else history.pushState({ pagina: pagina }, '', '?pagina=' + pagina);
    }

    marcarAtivo(pagina);
    if (window.RosterWork.fecharDropdowns) window.RosterWork.fecharDropdowns();
    if (window.RosterWork.painel) window.RosterWork.painel.fechar();   /* a gaveta é da página que sai */
    if (window.RosterWork.mostrarVeu) window.RosterWork.mostrarVeu(conteudo);

    if (foraDoCelular(pagina)) {
      mostrarSoComputador(pagina);
      if (window.RosterWork.chamada) window.RosterWork.chamada.porNaPagina();
      esconderVeu();
      registrarEndereco();
      return;
    }

    /* o download pode falhar no começo (fetch) ou no meio da leitura (text): cancelado por uma
       navegação mais nova, sai quieto (a nova cuida do véu); falha de rede na vigente, some o véu */
    var resposta, html;
    try {
      resposta = await fetch(def.html, navAbort ? { signal: navAbort.signal } : undefined);
      if (meu !== navToken) return;               /* outra navegação assumiu enquanto baixava */
      if (!resposta.ok) { esconderVeu(); return; }
      html = await resposta.text();
    } catch (e) {
      if (meu === navToken) esconderVeu();
      return;
    }
    if (meu !== navToken) return;
    inserirFragmento(html);
    /* a faixa "Esperando a sua resposta" entra acima do título da página nova (geral-chamada.js) */
    if (window.RosterWork.chamada) window.RosterWork.chamada.porNaPagina();

    for (var i = 0; i < (def.css || []).length; i++) carregarCss(def.css[i]);
    /* os arquivos da página baixam todos juntos (cada um roda na ordem do manifesto) */
    await Promise.all((def.js || []).map(carregarJs));
    if (meu !== navToken) return;                 /* outra navegação assumiu enquanto os scripts carregavam */

    /* o véu some quando a página termina de carregar (iniciar pode ser assíncrono),
       respeitando o tempo mínimo; páginas síncronas escondem logo (pelo mínimo) */
    var registro = window.RosterWork.paginas[pagina];
    var pronto = (registro && registro.iniciar) ? registro.iniciar(conteudo) : null;
    Promise.resolve(pronto).then(function () {
      if (meu !== navToken) return;               /* só a navegação vigente conclui e revela a tela */
      abrirAbaPedida(pagina); esconderVeu();
    }, function () { if (meu === navToken) esconderVeu(); });

    registrarEndereco();
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
    if (!inicial || !manifesto[inicial]) inicial = 'escalas';
    navegar(inicial, false);
  }

  /* os arquivos de outra página, sem abrir a página (ex.: a faixa "Esperando a sua resposta" usa os painéis
     da troca da Pendências em qualquer tela); os já carregados não baixam de novo */
  window.RosterWork.carregarPecas = function (pagina) {
    var def = manifesto[pagina];
    if (!def) return Promise.resolve();
    (def.css || []).forEach(carregarCss);
    return Promise.all((def.js || []).map(carregarJs));
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
