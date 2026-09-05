/* ============================================================
   AVISOS — três abas, cada uma com um dono claro:
     · Para mim    — o que espera VOCÊ (pendências suas) e, abaixo,
                     o histórico do que aconteceu com você
     · Administração — só administrador: o que espera a decisão
                      dele, com a contagem no selo da aba
     · Comunicados — o mural; o admin publica e remove aqui
   A separação segue a regra que vale em qualquer caixa de avisos:
   o que PEDE AÇÃO não se mistura com o que só INFORMA.
   Este arquivo liga as abas, cuida dos comunicados e decide quais
   botões do cabeçalho aparecem em cada aba. O admin cria pelo
   "Novo comunicado" e remove pela lixeira, reusando o módulo
   RosterWork.inicioAviso (com auditoria).
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var abaAtual = 'paramim';


  /* timestamp ISO -> "6 jul 2026, 16:02" */
  function dataHora(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hh + ':' + mm;
  }

  /* meta = "autor · destinatário · data" */
  function metaTexto(aviso) {
    var autor = ((aviso.criado_por_grau || '') + ' ' + (aviso.criado_por_nome || '')).trim();
    var para = aviso.destinatario ? 'Para: ' + aviso.destinatario : '';
    return [autor, para, dataHora(aviso.criado_em)].filter(Boolean).join(' · ');
  }

  function vazio(lista, texto) {
    lista.textContent = '';
    var el = RosterWork.tpl('tpl-avisos-vazio');
    if (el) { el.textContent = texto; lista.appendChild(el); }
  }

  function montarComunicados(lista, avisos, recarregar) {
    if (!avisos.length) { vazio(lista, RW.mensagens.avisos.semComunicados); return; }
    lista.textContent = '';
    var admin = RosterWork.sessao.ehAdmin();
    avisos.forEach(function (a) {
      var el = RosterWork.tpl('tpl-aviso-cartao');
      if (!el) return;
      el.querySelector('.aviso-cartao-titulo').textContent = a.titulo || 'Comunicado';
      el.querySelector('.aviso-cartao-msg').textContent = a.mensagem || '';
      el.querySelector('.aviso-cartao-meta').textContent = metaTexto(a);
      var remover = el.querySelector('.aviso-cartao-remover');
      if (remover && admin && a.aviso_id) {
        remover.classList.remove('oculto');
        remover.addEventListener('click', function () { RW.inicioAviso.desativar(a.aviso_id, recarregar, 'Avisos'); });
      }
      lista.appendChild(el);
    });
  }

  function iniciar(conteudo) {
    var listaComunicados = conteudo.querySelector('#avisos-lista');
    var listaNotificacoes = conteudo.querySelector('#avisos-notificacoes');
    var minhasPendencias = conteudo.querySelector('#avisos-minhas-pendencias');
    var pendenciasAdministracao = conteudo.querySelector('#avisos-pendencias');
    var subtitulo = conteudo.querySelector('#avisos-subtitulo');
    var btnNovo = conteudo.querySelector('#btn-novo-aviso-pagina');
    var btnLidas = conteudo.querySelector('#avisos-marcar-lidas');
    var abaAdministracao = conteudo.querySelector('#avisos-aba-administracao');
    var seloAdministracao = conteudo.querySelector('#avisos-administracao-contagem');
    if (!listaComunicados || !RW.apiFetch) return Promise.resolve();

    var emAberto = 0;

    function escreverSubtitulo() {
      if (!subtitulo) return;
      subtitulo.textContent = !emAberto ? ''
        : (emAberto === 1 ? '1 em aberto' : emAberto + ' em aberto');
    }

    /* os botões do cabeçalho mudam conforme a aba */
    function ajustarCabecalho() {
      if (btnNovo) btnNovo.classList.toggle('oculto', !(RosterWork.sessao.ehAdmin() && abaAtual === 'comunicados'));
      if (btnLidas) btnLidas.classList.toggle('oculto', !(abaAtual === 'paramim' && emAberto > 0));
    }

    function carregarComunicados() {
      RW.apiFetch('/rest/v1/rpc/fn_avisos_listar', { metodo: 'POST', corpo: {} })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (a) { montarComunicados(listaComunicados, Array.isArray(a) ? a : [], carregarComunicados); })
        .catch(function () { vazio(listaComunicados, RW.mensagens.avisos.falhaCarregar); });
    }

    function carregarNotificacoes() {
      if (!RW.avisosNotificacoes) return Promise.resolve();
      return RW.avisosNotificacoes.carregar(listaNotificacoes, carregarNotificacoes)
        .then(function (n) { emAberto = n; escreverSubtitulo(); ajustarCabecalho(); });
    }

    /* uma leitura enche "Precisa de você" e a aba Administração, e devolve
       quantas são de administração (para o selo da aba) */
    function carregarPendencias() {
      if (!RW.avisosPendencias) return Promise.resolve();
      return RW.avisosPendencias.carregar(minhasPendencias, pendenciasAdministracao)
        .then(function (quantas) {
          if (!seloAdministracao) return;
          seloAdministracao.textContent = quantas ? String(quantas) : '';
          seloAdministracao.classList.toggle('oculto', !quantas);
        });
    }

    if (btnNovo && RosterWork.sessao.ehAdmin()) {
      btnNovo.addEventListener('click', function () { RW.inicioAviso.abrirNovo(carregarComunicados, 'Avisos'); });
    }
    if (btnLidas && RW.avisosNotificacoes) {
      btnLidas.addEventListener('click', function () {
        RW.avisosNotificacoes.marcarTodas().then(function () {
          carregarNotificacoes();
          if (RW.avisosSino) RW.avisosSino.recarregar();
        });
      });
    }

    /* a aba Administração é só do administrador */
    if (abaAdministracao) abaAdministracao.classList.toggle('oculto', !RosterWork.sessao.ehAdmin());

    /* abas do subcabeçalho (mesmo mecanismo das outras páginas) */
    var trilho = conteudo.querySelector('#avisos-abas');
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    if (trilho && RW.abas) {
      RW.abas.ligar(trilho, function (aba) {
        abaAtual = aba.getAttribute('data-aba');
        for (var i = 0; i < paineis.length; i++) {
          paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== abaAtual);
        }
        ajustarCabecalho();
        if (abaAtual === 'administracao') carregarPendencias();
      });
    }

    abaAtual = 'paramim';
    vazio(listaComunicados, RW.mensagens.avisos.carregando);
    carregarComunicados();
    carregarPendencias();
    return carregarNotificacoes();
  }

  RW.paginas.avisos = { iniciar: iniciar };
})();
