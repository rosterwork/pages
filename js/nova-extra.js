/* ============================================================
   NOVA EXTRA — protótipo da extrajornada em etapas (só programador)
   Abas Minha extra · Calendário | Pedidos · Cotas · Distribuição ·
   Lançar · Ajustes, num grupo de traço único (nova-extra-organizar.js
   desenha o Calendário e os passos). A Minha extra mostra o pedido
   do mês (nova_extra_minha) e a barra abre o painel do pedido
   (nova-extra-pedido.js). A barra é igual em todas as abas: a ação
   do militar, o mês e a Legenda (o molde que o passo pedir,
   RosterWork.novaExtra.legenda).
   Para o teste, a seta do mês só anda entre dezembro de 2026 (o
   administrador) e janeiro de 2027 (o militar). Grava em tabelas
   próprias: a Extrajornada de verdade e a escala não mudam.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   Registra RosterWork.paginas['nova-extra'].
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* os dois meses do teste: dezembro (o administrador reparte, distribui e lança) e janeiro (o militar faz o pedido) */
  var PRIMEIRO = new Date(2026, 11, 1), ULTIMO = new Date(2027, 0, 1);

  var el = {};
  var comp = null;      // o mês do pedido (Date, dia 1)
  var estado = null;    // a resposta do nova_extra_minha
  var pedido = 0;       // latest-wins
  var aba = 'minha';    // a aba aberta (data-aba)
  var conteudoPagina = null;

  function msg() { return RW.mensagens.novaExtra; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function nomeMes(d) { return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' '); }
  function br(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }

  /* ---------- Minha extra ---------- */
  /* relê o mês: a Minha extra e, junto, os passos e os números das abas (RosterWork.novaExtraOrg) */
  function carregar() {
    var meu = ++pedido;
    el.mes.textContent = nomeMes(comp);
    el.anterior.disabled = comp <= PRIMEIRO;
    el.proximo.disabled = comp >= ULTIMO;
    RW.novaExtraOrg.recarregar();
    RW.rpc('nova_extra_minha', { p_competencia: iso(comp), p_cpf: null }).then(function (r) {
      if (meu !== pedido || !el.titulo.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      estado = r;
      desenhar();
    }, function (e) { if (meu === pedido) RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao }); });
  }

  function desenhar() {
    var r = estado, p = r.prazo, ped = r.pedido;
    var mes = nomeMes(comp);
    el.titulo.textContent = mes.charAt(0).toUpperCase() + mes.slice(1);
    el.prazo.textContent = p.estado === 'aberto' ? msg().prazoAberto(p.faltam_dias) : p.estado === 'antes' ? msg().prazoAntes(br(p.abre)) : msg().prazoFechado(br(p.fecha));
    el.prazo.classList.toggle('selo--alerta', p.estado === 'aberto');
    if (ped) el.pedidoTexto.textContent = ped.voluntario ? msg().pediu(ped) : msg().naoQuer(ped.enviado_em);
    else el.pedidoTexto.textContent = p.estado === 'aberto' ? msg().semPedido(br(p.fecha)) : p.estado === 'antes' ? msg().naoAbriu(br(p.abre)) : msg().naoPediu;
    el.pedir.textContent = p.estado === 'aberto' ? (ped ? msg().mudar : msg().fazer) : msg().ver;
    /* a extra é só para praças: o oficial vê o aviso no lugar do pedido */
    if (r.militar && r.militar.praca === false) el.pedidoTexto.textContent = msg().soPraca;
    atualizarBarra();
    el.cotasTexto.textContent = ped && ped.concedidas != null ? msg().concedidas(ped.concedidas) : msg().cotasDepois(br(p.fecha));
    el.diasTexto.textContent = r.extras && r.extras.length
      ? r.extras.map(function (x) { return br(x.data) + ' ' + RW.novaExtraUtil.horas(x.blocos) + ' (' + x.unidade + ')'; }).join('; ') + (r.lancado ? '.' : ' ' + msg().aindaNaoLancado)
      : msg().semDias;
  }

  /* ---------- a barra: igual em todas as abas ---------- */
  /* o pedido (a ação do militar) aparece com o pedido aberto ou já feito, e só para praças */
  function atualizarBarra() {
    var r = estado, pode = !!r && !(r.militar && r.militar.praca === false) && (r.prazo.estado === 'aberto' || !!r.pedido);
    el.pedir.classList.toggle('oculto', !pode);
  }

  /* ---------- as abas: dois grupos que valem como uma escolha só ---------- */
  /* marca a escolhida e desmarca a do outro grupo (o traço único vai para ela) */
  function marcarAba(nome) {
    Array.prototype.forEach.call(el.abas.querySelectorAll('.aba'), function (a) {
      var ativa = a.getAttribute('data-aba') === nome;
      a.classList.toggle('aba--ativa', ativa);
      a.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
  }

  function aoTrocarAba(botao) {
    aba = botao.getAttribute('data-aba');
    marcarAba(aba);
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-corpo [data-aba-painel]'), function (s) {
      s.classList.toggle('oculto', s.getAttribute('data-aba-painel') !== aba);
    });
    atualizarBarra();
    if (aba === 'minha') RW.novaExtraOrg.sair();
    else RW.novaExtraOrg.mostrar(aba === 'calendario' ? 'calendario' : +botao.getAttribute('data-passo'));
  }

  /* a Legenda e o traço antes dela: aparecem com o conteúdo do molde (id) ou somem (null) */
  function legenda(id) {
    if (!el.legenda) return;
    el.legenda.classList.toggle('oculto', !id);
    el.legendaDivisor.classList.toggle('oculto', !id);
    var alvo = el.legenda.querySelector('[data-legenda-conteudo]');
    if (!alvo) return;
    alvo.textContent = '';
    var t = id && document.getElementById(id);
    if (t) alvo.appendChild(t.content.cloneNode(true));
  }

  /* trocar de mês (só entre os dois do teste): com a distribuição não salva, pergunta antes */
  function trocarMes(n) {
    var alvo = new Date(comp.getFullYear(), comp.getMonth() + n, 1);
    if (alvo < PRIMEIRO || alvo > ULTIMO) return;
    function ir() { comp = alvo; carregar(); }
    if (!RW.novaExtraOrg.sujo()) { ir(); return; }
    RW.confirmar({ tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar, textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando, aoConfirmar: function () { RW.novaExtraMontar.descartar(); ir(); } });
  }

  /* ---------- entrada ---------- */
  function iniciar(conteudo) {
    conteudoPagina = conteudo;
    aba = 'minha';
    el.abas = conteudo.querySelector('#nova-extra-abas');
    el.titulo = conteudo.querySelector('#nova-extra-titulo');
    el.prazo = conteudo.querySelector('#nova-extra-prazo');
    el.pedidoTexto = conteudo.querySelector('#nova-extra-pedido-texto');
    el.cotasTexto = conteudo.querySelector('#nova-extra-cotas-texto');
    el.pedir = conteudo.querySelector('#nova-extra-pedir');
    el.mes = conteudo.querySelector('#nova-extra-mes');
    el.anterior = conteudo.querySelector('#nova-extra-mes-anterior');
    el.proximo = conteudo.querySelector('#nova-extra-mes-proximo');
    el.diasTexto = conteudo.querySelector('#nova-extra-dias-texto');
    el.legenda = RW.legenda.montar(conteudo.querySelector('#nova-extra-legenda'));
    el.legendaDivisor = conteudo.querySelector('#nova-extra-legenda-divisor');
    comp = new Date(ULTIMO);

    /* sair da Distribuição com mudanças não salvas: confirma o descarte antes de trocar.
       Captura: roda antes de o geral-abas trocar. */
    el.abas.addEventListener('click', function (e) {
      var b = e.target.closest('.aba');
      if (!b || b.getAttribute('data-aba') === aba || !RW.novaExtraOrg.sujo()) return;
      e.preventDefault();
      e.stopPropagation();
      RW.confirmar({ tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar, textoConfirmar: RW.mensagens.botoes.descartar,
        textoCancelar: RW.mensagens.botoes.continuarEditando, aoConfirmar: function () { RW.novaExtraMontar.descartar(); b.click(); } });
    }, true);
    Array.prototype.forEach.call(el.abas.querySelectorAll('.abas'), function (trilho) { RW.abas.ligar(trilho, aoTrocarAba); });
    el.anterior.addEventListener('click', function () { trocarMes(-1); });
    el.proximo.addEventListener('click', function () { trocarMes(1); });
    RW.novaExtraOrg.montar(conteudo);
    el.pedir.addEventListener('click', function () {
      if (estado && RW.novaExtraPedido) RW.novaExtraPedido.abrir(estado, comp, null, carregar);
    });
    marcarAba('minha');
    carregar();
    return Promise.resolve();
  }

  RW.novaExtra = { comp: function () { return iso(comp); }, legenda: legenda, recarregar: function () { carregar(); } };
  RW.paginas['nova-extra'] = { iniciar: iniciar };
})();
