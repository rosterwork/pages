/* ============================================================
   AVISOS — duas abas, cada uma com um dono claro:
     · Para mim    — o histórico do que aconteceu com você
     · Comunicados — o mural; o admin publica e remove aqui
   O que PEDE DECISÃO não mora aqui: fica na página Pendências
   (Avisos é o que se lê; Pendências, o que se decide).
   Este arquivo liga as abas, cuida dos comunicados e decide quais
   botões da barra aparecem (os mesmos em todas as abas). O admin cria
   pelo "Novo comunicado" (grupo Administração) e remove pela lixeira,
   reusando o módulo RosterWork.inicioAviso (com auditoria).
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
    avisos.forEach(function (a) {
      var el = RosterWork.tpl('tpl-aviso-cartao');
      if (!el) return;
      el.querySelector('.aviso-cartao-titulo').textContent = a.titulo || 'Comunicado';
      el.querySelector('.aviso-cartao-msg').textContent = a.mensagem || '';
      el.querySelector('.aviso-cartao-meta').textContent = metaTexto(a);
      var remover = el.querySelector('.aviso-cartao-remover');
      if (remover && RW.inicioAviso && RW.inicioAviso.podeDesativar(a)) {
        remover.classList.remove('oculto');
        remover.addEventListener('click', function () { RW.inicioAviso.desativar(a.aviso_id, recarregar, 'Avisos'); });
      }
      lista.appendChild(el);
    });
  }

  function iniciar(conteudo) {
    var listaComunicados = conteudo.querySelector('#avisos-lista');
    var listaNotificacoes = conteudo.querySelector('#avisos-notificacoes');
    var contagem = conteudo.querySelector('#avisos-contagem');
    var btnNovo = conteudo.querySelector('#btn-novo-aviso-pagina');
    var btnLidas = conteudo.querySelector('#avisos-marcar-lidas');
    var btnMais = conteudo.querySelector('#avisos-mais-antigos');
    if (!listaComunicados || !RW.apiFetch) return Promise.resolve();

    var emAberto = 0;   // o mesmo número do sino

    function escreverContagem() {
      if (!contagem) return;
      contagem.textContent = !emAberto ? ''
        : (emAberto === 1 ? '1 em aberto' : emAberto + ' em aberto');
    }

    /* "Marcar todas como lidas" aparece em todas as abas enquanto houver aviso em aberto */
    function ajustarBarra() {
      if (btnLidas) btnLidas.classList.toggle('oculto', !emAberto);
    }

    function mostrarMais(mais) {
      if (btnMais) btnMais.classList.toggle('oculto', !mais);
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
        .then(function (r) {
          if (!r) return;   /* uma leitura mais nova já está a caminho */
          emAberto = r.emAberto;
          escreverContagem();
          ajustarBarra();
          mostrarMais(r.mais);
        });
    }

    /* o grupo Administração (Novo comunicado) só para o admin, em todas as abas;
       no celular é um menu (fecha antes de abrir o painel) */
    var grupoAdmin = conteudo.querySelector('.acoes-admin');
    var publica = !!(RW.inicioAviso && RW.inicioAviso.ehAdmin());   // qualquer papel publica para a própria área
    if (grupoAdmin) grupoAdmin.classList.toggle('oculto', !publica);
    if (btnNovo && publica) {
      btnNovo.addEventListener('click', function () {
        if (RW.fecharDropdowns) RW.fecharDropdowns();
        RW.inicioAviso.abrirNovo(carregarComunicados, 'Avisos');
      });
    }
    if (btnLidas && RW.avisosNotificacoes) {
      btnLidas.addEventListener('click', function () {
        RW.avisosNotificacoes.marcarTodas().then(function () {
          carregarNotificacoes();
          if (RW.avisosSino) RW.avisosSino.recarregar();
        });
      });
    }
    /* o lote seguinte do Histórico (os pontinhos no botão enquanto lê) */
    if (btnMais && RW.avisosNotificacoes) {
      btnMais.addEventListener('click', function () {
        RW.iniciarCarregando(btnMais);
        RW.avisosNotificacoes.maisAntigos().then(function (r) {
          RW.pararCarregando(btnMais);
          if (r) mostrarMais(r.mais);
        });
      });
    }

    /* abas embaixo do título (mesmo mecanismo das outras páginas) */
    var trilho = conteudo.querySelector('#avisos-abas');
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    if (trilho && RW.abas) {
      RW.abas.ligar(trilho, function (aba) {
        abaAtual = aba.getAttribute('data-aba');
        for (var i = 0; i < paineis.length; i++) {
          paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== abaAtual);
        }
      });
    }

    abaAtual = 'paramim';
    vazio(listaComunicados, RW.mensagens.avisos.carregando);
    carregarComunicados();
    return carregarNotificacoes();
  }

  RW.paginas.avisos = { iniciar: iniciar };
})();
