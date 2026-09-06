/* ============================================================
   SINO do cabeçalho — os AVISOS do usuário
   Um sino só, como em qualquer sistema sério: a pessoa é uma só,
   e mais um sino seria mais um lugar para esquecer de olhar. A
   separação por papel acontece DENTRO da gaveta, em dois blocos:
   "Para você" e "Administração".
   A gaveta mostra só o que está EM ABERTO — o que já foi resolvido
   ou lido sai daqui e fica no histórico da página Avisos:
     · pede ação  → sai quando o assunto é resolvido, por qualquer administrador
     · só informa → sai quando você lê
   O número do sino conta os em aberto (não é "não lidas").
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

  /* pendência da administração no sino: estado que espera decisão, sem "lida" — fica
     até ser resolvido. Bolinha colorida por gravidade; clicar abre Avisos › Administração.
     (só os dois tipos que viviam no antigo selo da Escala: fora_escala e manutencao) */
  function montarItemPendencia(p) {
    var el = RosterWork.tpl('dropdown-item-aviso');
    if (!el) return null;
    el.classList.add(p.tipo === 'fora_escala' ? 'aviso-item--erro' : 'aviso-item--alerta');
    var contagem = (p.contagem != null) ? String(p.contagem) + ' · ' : '';
    el.querySelector('.aviso-item-titulo').textContent = contagem + (p.texto || '');
    el.addEventListener('click', function () {
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      if (RW.irParaPagina) RW.irParaPagina('avisos', 'administracao');
    });
    return el;
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
    /* só as pendências que moravam no antigo selo da Escala vão para o sino */
    var pend = (pendencias || []).filter(function (p) {
      return p.tipo === 'fora_escala' || p.tipo === 'manutencao';
    });
    var abertos = (caixa && caixa.abertos) || { total: 0, pessoal: 0, administracao: 0 };
    var itens = ((caixa && caixa.itens) || []).filter(function (n) { return n.aberto; });

    /* o número do sino soma as notificações em aberto + as pendências (estado que fica até resolver) */
    var totalPend = pend.reduce(function (s, p) { return s + (Number(p.contagem) || 0); }, 0);
    atualizarBadge((abertos.total || 0) + totalPend);

    /* "Marcar todas como lidas" só faz sentido para o que informa —
       decisão pendente não se apaga declarando que foi vista */
    if (btnMarcarTodas) {
      var informativasAbertas = itens.some(function (n) { return !n.acao; });
      btnMarcarTodas.classList.toggle('oculto', !informativasAbertas);
    }

    lista.textContent = '';
    /* pendências primeiro: fixas no topo, sem "lida", até serem resolvidas */
    pend.forEach(function (p) { var el = montarItemPendencia(p); if (el) lista.appendChild(el); });

    if (!itens.length) {
      if (!pend.length) mostrarVazio(RW.mensagens.avisos.semAbertos);
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
     O que pede ação continua em aberto até alguém decidir — ler não resolve. */
  function abrir(n) {
    function irPara() { if (n.pagina && RW.irParaPagina) RW.irParaPagina(n.pagina, n.aba); }
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
    /* uma leitura de cada fonte: notificações (eventos) + pendências (estado do admin) */
    Promise.all([
      RW.apiFetch('/rest/v1/rpc/notificacoes_listar', { metodo: 'POST', corpo: { p_limite: 15 } }).then(corpoJson).catch(nulo),
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

  /* quem mexe em aviso (a página Avisos) pede o refresco do sino */
  RW.avisosSino = { recarregar: carregar };

  carregar();
})();
