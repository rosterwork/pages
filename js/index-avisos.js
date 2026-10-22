/* ============================================================
   SINO do cabeçalho — os AVISOS do usuário
   Um sino só: a pessoa é uma só,
   e mais um sino seria mais um lugar para esquecer de olhar. A
   separação por papel acontece DENTRO da gaveta, em dois blocos:
   "Para você" e "Administração".
   A gaveta mostra só os avisos EM ABERTO: nem lidos nem resolvidos
   (o pedido que outro administrador decidiu sai sozinho). O número
   conta esses e zera quando você lê; o que foi lido fica no
   histórico da página Avisos.
   O que falta fazer (pedidos, prazos e o que corrigir) não mora
   aqui: fica na página Pendências, e a mesma leitura escreve o
   número do item dela no menu. Os avisos de decisão levam para lá.
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
    var el = RosterWork.tpl('dropdown-item-aviso');
    if (!el) return;
    el.classList.add('aviso-item--vazio');
    el.disabled = true;
    el.querySelector('.aviso-item-titulo').textContent = texto;
    lista.appendChild(el);
  }

  function montarItem(n) {
    var el = RosterWork.tpl('dropdown-item-aviso');
    if (!el) return null;
    el.classList.toggle('aviso-item--nao-lida', !n.lida);
    el.querySelector('.aviso-item-titulo').textContent = n.titulo || '';
    el.querySelector('.aviso-item-mensagem').textContent = n.texto || '';
    el.querySelector('.aviso-item-meta').textContent = metaTexto(n);
    el.addEventListener('click', function () { abrir(n); });
    return el;
  }

  /* o que falta fazer mora na página Pendências, com o número no item do menu. Quanto
     cada item de pendencias_listar soma nele: um pedido vale 1 (o grupo traz quantos);
     uma situação vale 1 por assunto ("fora da escala" é um problema só, com a lista de
     militares dentro; a CNH que falta é uma). Tipo fora das duas listas não soma */
  var DECISAO = { troca: true, troca_aceite: true, folga: true, dados: true };
  var SITUACAO = { fora_escala: true, retorno_afastamento: true, distribuicao: true, distribuicao_erro: true, extra_prazo: true, cnh: true };

  function quantoSoma(p) {
    var n = Number(p.contagem) || 0;
    if (DECISAO[p.tipo]) return n;
    return SITUACAO[p.tipo] && n ? 1 : 0;
  }

  function atualizarMenu(quantos) {
    var item = document.querySelector('.menu-item[data-pagina="pendencias"]');
    var selo = item ? item.querySelector('.menu-item-selo') : null;
    if (!selo) return;
    selo.textContent = quantos > 99 ? '99+' : String(quantos);
    selo.classList.toggle('oculto', !quantos);
  }

  /* um bloco com título, só quando ele tem algo */
  function montarGrupo(titulo, itens) {
    if (!itens.length) return;
    var cabecalho = RosterWork.tpl('dropdown-grupo-aviso');
    if (cabecalho) { cabecalho.textContent = titulo; lista.appendChild(cabecalho); }
    itens.forEach(function (n) {
      var el = montarItem(n);
      if (el) lista.appendChild(el);
    });
  }

  function montar(caixa, pendencias) {
    if (!lista) return;
    var abertos = (caixa && caixa.abertos) || { total: 0, pessoal: 0, administracao: 0 };
    var itens = (caixa && caixa.itens) || [];   /* a leitura já traz só os em aberto */

    atualizarBadge(abertos.total || 0);
    atualizarMenu((pendencias || []).reduce(function (s, p) { return s + quantoSoma(p); }, 0));

    /* "Marcar todas como lidas" enquanto houver aviso em aberto (o pedido continua na Pendências) */
    if (btnMarcarTodas) btnMarcarTodas.classList.toggle('oculto', !abertos.total);

    lista.textContent = '';
    if (!itens.length) {
      mostrarVazio(RW.mensagens.avisos.semAbertos);
      return;
    }

    var T = RW.mensagens.avisos;
    var pessoais = itens.filter(function (n) { return n.escopo !== 'administracao'; });
    var deAdmin = itens.filter(function (n) { return n.escopo === 'administracao'; });
    /* com os dois blocos, os títulos ajudam; com um só, seriam ruído */
    if (pessoais.length && deAdmin.length) {
      montarGrupo(T.grupoPessoal, pessoais);
      montarGrupo(T.grupoAdministracao, deAdmin);
    } else {
      itens.forEach(function (n) {
        var el = montarItem(n);
        if (el) lista.appendChild(el);
      });
    }
  }

  /* marca como lida e vai para a tela do assunto, já na aba onde se resolve.
     O aviso de uma decisão (troca, folga, correção) leva à Pendências,
     já com o pedido aberto; o pedido continua lá até alguém decidir. */
  function abrir(n) {
    function irPara() {
      if (!RW.irParaPagina) return;
      if (n.acao && DECISAO[n.tipo]) RW.irParaPagina('pendencias', n.escopo === 'administracao' ? 'administracao' : 'paramim', n.referencia_id);
      else if (n.pagina) RW.irParaPagina(n.pagina, n.aba, n.referencia_id);
    }
    if (RW.fecharDropdowns) RW.fecharDropdowns();
    if (n.lida) { irPara(); return; }
    RW.apiFetch('/rest/v1/rpc/notificacoes_marcar_lidas', { metodo: 'POST', corpo: { p_ids: [n.id] } })
      .then(function () { carregar(); irPara(); })
      .catch(irPara);
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

  /* quem mexe em aviso (a página Avisos) pede o refresco do sino; a página
     Pendências soma os selos das abas pela mesma regra do número do menu */
  RW.avisosSino = { recarregar: carregar, quantoSoma: quantoSoma };

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
    if (aviso && aviso.id) abrir(aviso);
  }
  (RW.sistemaPronto || Promise.resolve()).then(abrirAvisoDaNotificacao);

  carregar();
})();
