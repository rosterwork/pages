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
    'componentes/js/geral-limpar-comentarios.js',
    'componentes/js/geral-carregando.js',
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
    'componentes/js/geral-guia.js',
    'componentes/js/geral-horario.js',
    'componentes/js/geral-modal.js',
    'componentes/js/geral-aviso.js',
    'componentes/js/geral-data-modal.js',
    'componentes/js/geral-resumo.js',
    'componentes/js/geral-alteracoes.js',
    'componentes/js/geral-guarda-saida.js',
    'componentes/js/geral-api.js',
    'componentes/js/geral-notificacoes-celular.js',
    'componentes/js/geral-recalculo.js',
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
    'componentes/js/geral-calendario.js',
    'componentes/js/geral-calendario-mes.js',
    'componentes/js/geral-periodo.js',
    'componentes/js/geral-visao-grade.js',
    'componentes/js/geral-seletor-unidade.js',
    'componentes/js/geral-mini-calendario.js',
    'componentes/js/geral-abas.js',
    'componentes/js/geral-painel.js',
    'componentes/js/geral-anteriores.js',
    'componentes/js/geral-posto-editar.js',
    'componentes/js/geral-impacto.js',
    'componentes/js/geral-decisao.js',
    'componentes/js/geral-fila.js',
    'componentes/js/geral-fila-resumo.js',
    'componentes/js/geral-chamada.js',
    'js/index-navegacao.js',
    'js/index-fale-conosco.js',
    'js/index-termos.js',
    'js/index-dados-pendentes.js',
    'js/index-cnh-painel.js'
  ];
  var MENSAGENS = 'componentes/js/geral-mensagens.js';   /* a frase da falha, antes do resto */

  var pedidos = {};   /* arquivo → promessa da carga: cada um roda uma vez só */
  function carregar(src) {
    if (pedidos[src]) return pedidos[src];
    pedidos[src] = new Promise(function (resolver) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function () { resolver(); };
      script.onerror = function () { resolver(); };
      document.body.appendChild(script);
    });
    return pedidos[src];
  }

  function paginaLida() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise(function (resolver) { document.addEventListener('DOMContentLoaded', resolver); });
  }

  /* a sessão ficou pronta: entra (na versão nova do app, se houver uma esperando).
     RosterWork.sistemaPronto: todo o código do sistema rodou e a página terminou de ser lida; quem age
     sobre a primeira tela (o aviso aberto pela notificação, a oferta das notificações no app) espera por ela */
  function rodarSistema(veioDaRenovacao) {
    if (veioDaRenovacao && RW.aplicativo && RW.aplicativo.temVersaoNova()) {
      RW.aplicativo.irPara(location.href);
      return;
    }
    /* as preferências chegaram com a renovação: o tema da pessoa antes de o sistema aparecer */
    if (veioDaRenovacao && RW.tema) RW.tema.aplicar();
    RW.sistemaPronto = Promise.all(ARQUIVOS.map(carregar)).then(paginaLida);
    RW.sistemaPronto.then(function () {
      document.documentElement.removeAttribute('data-entrando');
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
    var veioDaRenovacao = document.documentElement.hasAttribute('data-entrando');
    Promise.resolve(RW.sessaoPronta).then(function (r) {
      if (r && r.ok) { rodarSistema(veioDaRenovacao); return; }
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
      RW.sessaoPronta = RW.entrada.renovarLembrado();
      esperarSessao();
    });
  }

  esperarSessao();
})();
