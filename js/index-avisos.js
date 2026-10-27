/* ============================================================
   SINO do cabeçalho — os AVISOS do usuário
   Um sino só: a pessoa é uma só,
   e mais um sino seria mais um lugar para esquecer de olhar. A
   gaveta é uma lista só, o mais novo em cima; o aviso de
   administração leva a etiqueta ADM (o campo adm do banco).
   A gaveta mostra só os avisos EM ABERTO: nem lidos nem resolvidos
   (o pedido que outro administrador decidiu sai sozinho). O número
   conta esses e zera quando você lê; o que foi lido fica no
   histórico da página Avisos. Cada aviso é o componente
   geral-notificacao (o mesmo da página), que também abre.
   O que falta fazer (pedidos, prazos e o que corrigir) não mora
   aqui: fica na página Pendências, e a mesma leitura escreve o
   número do item dela no menu (a soma que o banco manda em cada
   grupo). Os avisos de decisão levam para lá.
   Estrutura e moldes vivem no index.html.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var perfil = null;
  try { perfil = JSON.parse(sessionStorage.getItem('rosterwork_user')); } catch (e) {}
  if (!perfil || !perfil.ok) return;

  var wrap = document.getElementById('dropdown-avisos');
  if (!wrap) return;
  var lista = wrap.querySelector('.dropdown-lista-avisos');
  var botao = wrap.querySelector('.cabecalho-btn');
  var badge = botao ? botao.querySelector('.cabecalho-badge') : null;
  var btnMarcarTodas = document.getElementById('avisos-marcar-todas');


  /* "3ºSgt. Meireles · 21/07/2026" (sem autor quando foi o sistema) */
  function metaTexto(n) {
    var quando = '';
    if (n.criado_em && RW.data) {
      var d = new Date(n.criado_em);
      if (!isNaN(d.getTime())) quando = RW.data.paraBR(d);
    }
    return [n.autor, quando].filter(Boolean).join(' · ');
  }

  function atualizarBadge(quantos) {
    if (!badge) return;
    badge.textContent = quantos > 9 ? '9+' : String(quantos);
    badge.classList.toggle('oculto', !quantos);
  }

  function mostrarVazio(texto) {
    if (!lista) return;
    lista.textContent = '';
    var el = RW.notificacao.vazio(texto);
    if (el) lista.appendChild(el);
  }

  function atualizarMenu(quantos) {
    var item = document.querySelector('.menu-item[data-pagina="pendencias"]');
    var selo = item ? item.querySelector('.menu-item-selo') : null;
    if (!selo) return;
    selo.textContent = quantos > 99 ? '99+' : String(quantos);
    selo.classList.toggle('oculto', !quantos);
  }

  function montar(caixa, pendencias) {
    /* a faixa "Esperando a sua resposta" usa a mesma leitura (geral-chamada.js) */
    if (RW.chamada) RW.chamada.definir(pendencias || []);
    if (!lista) return;
    var abertos = (caixa && caixa.abertos) || { total: 0, pessoal: 0, administracao: 0 };
    var itens = (caixa && caixa.itens) || [];   /* a leitura já traz só os em aberto */

    atualizarBadge(abertos.total || 0);
    /* quanto cada grupo soma no número do menu vem do banco (pendencias_listar: soma) */
    atualizarMenu((pendencias || []).reduce(function (s, p) { return s + (Number(p.soma) || 0); }, 0));

    /* "Marcar todas como lidas" enquanto houver aviso em aberto (o pedido continua na Pendências) */
    if (btnMarcarTodas) btnMarcarTodas.classList.toggle('oculto', !abertos.total);

    lista.textContent = '';
    if (!itens.length) {
      mostrarVazio(RW.mensagens.avisos.semAbertos);
      return;
    }

    /* uma lista só, na ordem do banco (o mais novo em cima); o clique marca como lida e abre
       (o componente relê o sino depois de marcar) */
    itens.forEach(function (n) {
      var el = RW.notificacao.montar(n, { modo: 'gaveta', meta: metaTexto(n) });
      if (el) lista.appendChild(el);
    });
  }

  function carregar() {
    if (!RW.apiFetch || !RW.obterToken || !RW.obterToken()) return;
    function corpoJson(r) { return r.ok ? r.json() : null; }
    function nulo() { return null; }
    /* uma leitura de cada fonte: os avisos em aberto (o sino) + as pendências (o número do menu) */
    Promise.all([
      RW.apiFetch('/rest/v1/rpc/notificacoes_listar', { metodo: 'POST', corpo: { p_limite: 20, p_so_abertos: true } }).then(corpoJson).catch(nulo),
      RW.apiFetch('/rest/v1/rpc/pendencias_listar', { metodo: 'POST', corpo: {} }).then(corpoJson).catch(nulo)
    ]).then(function (res) {
      montar(res[0], Array.isArray(res[1]) ? res[1] : []);
    }).catch(function () {});
  }

  if (btnMarcarTodas) {
    btnMarcarTodas.addEventListener('click', function () {
      RW.apiFetch('/rest/v1/rpc/notificacoes_marcar_lidas', { metodo: 'POST', corpo: { p_ids: null } })
        .then(function () { carregar(); })
        .catch(function () {});
    });
  }

  /* abrir o sino relê a lista: o que você vê é sempre o estado de agora */
  if (botao) botao.addEventListener('click', function () { carregar(); });

  /* "Ver todos" → página Avisos (o dropdown fecha sozinho ao clicar num .dropdown-item) */
  var verTodos = document.getElementById('avisos-ver-todos');
  if (verTodos) {
    verTodos.addEventListener('click', function () {
      if (RW.irParaPagina) RW.irParaPagina('avisos');
    });
  }

  /* quem mexe em aviso (a página Avisos, o componente da notificação) pede o refresco do sino */
  RW.avisosSino = { recarregar: carregar };

  /* veio de uma notificação do celular (index.html?aviso=…, ou guardado pelo index-sessao.js antes
     da entrada): abre o aviso como o clique no sino, depois que todo o código do sistema rodou
     (RosterWork.sistemaPronto, do js/index-carregar.js) */
  function abrirAvisoDaNotificacao() {
    var bruto = null;
    try {
      bruto = new URLSearchParams(location.search).get('aviso') || sessionStorage.getItem('rosterwork_aviso_pendente');
      sessionStorage.removeItem('rosterwork_aviso_pendente');
    } catch (e) {}
    if (!bruto) return;
    if (/[?&]aviso=/.test(location.search)) history.replaceState(history.state, '', location.pathname);
    var aviso = null;
    try { aviso = JSON.parse(bruto); } catch (e) {}
    if (aviso && aviso.id && RW.notificacao) RW.notificacao.abrir(aviso);
  }
  (RW.sistemaPronto || Promise.resolve()).then(abrirAvisoDaNotificacao);

  carregar();
})();
