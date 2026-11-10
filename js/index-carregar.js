/* ============================================================
   CARREGADOR DO SISTEMA — o código do shell roda quando a sessão
   está pronta: na hora, quando a aba já tem sessão; depois da
   renovação do login lembrado, quando o sistema abre direto pelo
   Manter-me conectado (js/index-sessao.js põe RosterWork.sessaoPronta).
   Os arquivos são pedidos juntos e rodam na ordem da lista
   (async = false, como o roteador faz com as páginas). Enquanto a
   renovação corre, a tela "entrando" cobre o sistema
   (html[data-entrando], .entrando no index.html); na falha, a frase e
   o Tentar de novo; o login recusado volta ao login com o aviso.
   Fica no corpo do index.html, no lugar onde ficavam os <script>.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* o código do sistema, na ordem em que roda */
  var ARQUIVOS = [
    'componentes/js/geral-erros.js',
    'componentes/js/geral-limpar-comentarios.js',
    'componentes/js/geral-carregando.js',
    'componentes/js/geral-etapas.js',
    'componentes/js/geral-teclado.js',
    'componentes/js/geral-grade-teclado.js',
    'componentes/js/geral-sessao.js',
    'componentes/js/geral-tpl.js',
    'componentes/js/geral-celular.js',
    'componentes/js/geral-recolher-topo.js',
    'componentes/js/geral-deslizar.js',
    'componentes/js/geral-tempo.js',
    'componentes/js/geral-mensagens.js',
    'componentes/js/geral-data.js',
    'componentes/js/geral-campos.js',
    'componentes/js/geral-dica.js',
    'componentes/js/geral-flutuante.js',
    'componentes/js/geral-dropdown.js',
    'componentes/js/geral-dropdown-numeros.js',
    'componentes/js/geral-guia-veu.js',
    'componentes/js/geral-guia-alvos.js',
    'componentes/js/geral-guia-vidro.js',
    'componentes/js/geral-guia-roteiros.js',
    'componentes/js/geral-guia-ajuda.js',
    'componentes/js/geral-guia-balao.js',
    'componentes/js/geral-guia.js',
    'componentes/js/geral-treino.js',
    'componentes/js/geral-treino-cenarios.js',
    'componentes/js/geral-treino-extra.js',
    'componentes/js/geral-treino-banco.js',
    'componentes/js/geral-treino-livre.js',
    'componentes/js/geral-horario.js',
    'componentes/js/geral-regua.js',
    'componentes/js/geral-modal.js',
    'componentes/js/geral-aviso.js',
    'componentes/js/geral-data-modal.js',
    'componentes/js/geral-resumo.js',
    'componentes/js/geral-alteracoes.js',
    'componentes/js/geral-guarda-saida.js',
    'componentes/js/geral-api.js',
    'componentes/js/geral-notificacoes-celular.js',
    'componentes/js/geral-recalculo.js',
    'componentes/js/geral-notificacao.js',
    'componentes/js/geral-cotas-aviso.js',
    'js/index-sidebar.js',
    'js/index-cabecalho.js',
    'js/index-avisos.js',
    'js/index-perfil.js',
    'js/index-manual.js',
    'js/index-sessao-vigia.js',
    'componentes/js/geral-seletor-unidades.js',
    'componentes/js/geral-arvore-unidades.js',
    'componentes/js/geral-filtro-arvore.js',
    'componentes/js/geral-filtros.js',
    'componentes/js/geral-legenda.js',
    'componentes/js/geral-busca.js',
    'componentes/js/geral-combo-militar.js',
    'componentes/js/geral-calendario.js',
    'componentes/js/geral-calendario-mes.js',
    'componentes/js/geral-periodo.js',
    'componentes/js/geral-visao-grade.js',
    'componentes/js/geral-seletor-unidade.js',
    'componentes/js/geral-mini-calendario.js',
    'componentes/js/geral-abas.js',
    'componentes/js/geral-painel.js',
    'componentes/js/geral-impressao-unidades.js',
    'componentes/js/geral-impressao.js',
    'componentes/js/geral-anteriores.js',
    'componentes/js/geral-posto-editar.js',
    'componentes/js/geral-impacto.js',
    'componentes/js/geral-decisao.js',
    'componentes/js/geral-fila.js',
    'componentes/js/geral-fila-resumo.js',
    'componentes/js/geral-chamada.js',
    'componentes/js/geral-manutencao.js',
    'js/index-navegacao.js',
    'js/index-fale-conosco.js',
    'js/index-termos.js',
    'js/index-dados-pendentes.js',
    'js/index-cnh-painel.js'
  ];
  var MENSAGENS = 'componentes/js/geral-mensagens.js';   /* a frase da falha, antes do resto */

  /* ---------- as etapas da abertura ----------
     O mesmo cartão na tela "entrando" e na casca da página (.etapas--abertura, no index.html): a etapa de agora e a barra,
     que acompanha os arquivos do sistema e, depois, os da primeira tela (RosterWork.abertura, pela navegação) */
  var PARTE_DO_SISTEMA = 0.6;   // o quanto da barra é do sistema; o resto é da primeira tela

  function cartoesDaAbertura() { return Array.prototype.slice.call(document.querySelectorAll('.etapas--abertura')); }

  function etapaDaAbertura(n) {
    cartoesDaAbertura().forEach(function (cartao) {
      Array.prototype.forEach.call(cartao.querySelectorAll('.etapa'), function (etapa, i) {
        etapa.classList.toggle('etapa--feita', i < n);
        etapa.classList.toggle('etapa--agora', i === n);
      });
    });
  }

  function barraDaAbertura(progresso) {
    cartoesDaAbertura().forEach(function (cartao) {
      cartao.querySelector('.cobertura-viva').style.setProperty('--progresso', String(progresso));
    });
  }

  /* a 3ª etapa diz a tela que vai abrir, e o menu já nasce marcado nela (no F5 de outra tela, a Escala não fica marcada
     até o código chegar); o HTML traz a Escala, a tela de quem não pediu outra. Tela fora do menu (Meu perfil, Manual,
     Avisos): o nome marcado com data-nome-da-tela no texto que a abre, e nenhum item marcado, como a navegação faz */
  function nomearTela() {
    var rota = location.search.match(/[?&]pagina=([^&]+)/);
    if (!rota || rota[1] === 'escalas') return;
    var pagina = decodeURIComponent(rota[1]);
    var nome = document.querySelector('.menu-item[data-pagina="' + pagina + '"] .menu-item-label') ||
      document.querySelector('[data-nome-da-tela="' + pagina + '"]');
    Array.prototype.forEach.call(document.querySelectorAll('[data-abertura-tela]'), function (lugar) {
      lugar.textContent = nome ? nome.textContent : lugar.getAttribute('data-tela-sem-nome');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.menu-item[data-pagina]'), function (outro) {
      outro.classList.toggle('menu-item--selecionado', outro.getAttribute('data-pagina') === pagina);
    });
  }

  RW.abertura = {
    etapa: etapaDaAbertura,
    telaChegando: function (feitos, total) { barraDaAbertura(PARTE_DO_SISTEMA + (1 - PARTE_DO_SISTEMA) * (total ? feitos / total : 1)); },
    cartaoEm: null   // quando o cartão apareceu (o CSS mostra passando de 1,5 s): a casca só sai depois do mínimo dele
  };
  var cartaoDaCasca = document.getElementById('abertura-cartao');
  if (cartaoDaCasca) cartaoDaCasca.addEventListener('animationstart', function () { RW.abertura.cartaoEm = performance.now(); });

  var chegaram = 0;
  var pedidos = {};   /* arquivo → promessa da carga: cada um roda uma vez só */
  function carregar(src) {
    if (pedidos[src]) return pedidos[src];
    pedidos[src] = new Promise(function (resolver) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      function chegou() {
        chegaram++;
        barraDaAbertura(PARTE_DO_SISTEMA * chegaram / ARQUIVOS.length);
        resolver();
      }
      script.onload = chegou;
      script.onerror = chegou;
      document.body.appendChild(script);
    });
    return pedidos[src];
  }

  function paginaLida() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(function (resolver) { document.addEventListener('DOMContentLoaded', resolver); });
  }

  /* a sessão ficou pronta: entra (na versão nova do app, se houver uma esperando; até a 1ª tela
     aparecer, a que chegar também entra sozinha).
     RosterWork.sistemaPronto: todo o código do sistema rodou e a página terminou de ser lida; quem age
     sobre a primeira tela (o aviso aberto pela notificação, a oferta das notificações no app) espera por ela */
  function rodarSistema(veioDaRenovacao) {
    if (RW.aplicativo && RW.aplicativo.trocarSeChegou()) return;
    /* as preferências chegaram com a renovação: o tema da pessoa antes de o sistema aparecer */
    if (veioDaRenovacao && RW.tema) RW.tema.aplicar();
    RW.sistemaPronto = Promise.all(ARQUIVOS.map(carregar)).then(paginaLida);
    RW.sistemaPronto.then(function () {
      document.documentElement.removeAttribute('data-entrando');
      if (RW.aplicativo) RW.aplicativo.trocarSozinho(null);   /* a 1ª tela apareceu: só numa troca de página */
    });
  }

  /* sem internet, servidor fora ou passou do limite: a frase e o Tentar de novo (o aparelho continua lembrando) */
  function mostrarFalha(motivo) {
    carregar(MENSAGENS).then(function () {
      var M = RW.mensagens.login;
      var frase = document.getElementById('entrando-mensagem');
      if (frase) frase.textContent = motivo === 'sem_internet' ? M.entrandoSemInternet : M.entrandoTenteDepois;
      document.documentElement.setAttribute('data-entrando', 'falhou');
    });
  }

  function esperarSessao() {
    if (!RW.sessaoPronta) return;   /* sem sessão e sem login lembrado: o index-sessao.js já mandou para o login */
    /* na abertura, antes da 1ª tela, a versão nova que chegar entra sozinha */
    if (RW.aplicativo) RW.aplicativo.trocarSozinho(function () { return true; });
    var veioDaRenovacao = document.documentElement.hasAttribute('data-entrando');
    Promise.resolve(RW.sessaoPronta).then(function (r) {
      if (r && r.ok) { etapaDaAbertura(1); rodarSistema(veioDaRenovacao); return; }
      /* o login lembrado deixou de valer (saiu de todos os aparelhos, baixa, senha trocada): o login, com o aviso */
      if (r && r.falha === 'recusado') {
        try { sessionStorage.setItem('rosterwork_aviso_login', 'sessao_terminou'); } catch (e) {}
        window.location.replace('login.html');
        return;
      }
      mostrarFalha(r && r.falha);
    });
  }

  var tentar = document.getElementById('entrando-tentar');
  if (tentar) {
    tentar.addEventListener('click', function () {
      document.documentElement.setAttribute('data-entrando', '');
      etapaDaAbertura(0);
      RW.sessaoPronta = RW.entrada.renovarLembrado();
      esperarSessao();
    });
  }

  nomearTela();
  esperarSessao();
})();
