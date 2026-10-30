/* ============================================================
   NOVA EXTRA — protótipo da extrajornada em etapas (só programador)
   Abas Minha extra · Calendário · Organizar o mês (nova-extra-
   organizar.js desenha o Calendário e os passos). A Minha extra mostra
   o pedido do mês (nova_extra_minha), com o botão que abre o painel
   do pedido (nova-extra-pedido.js) no passo Pedido. A barra: o mês,
   os passos Pedidos · Cotas · Distribuição · Ajustes · Relatórios (só
   no Organizar o mês), o menu Ações do passo aberto e a Legenda (o
   molde que o passo pedir, RosterWork.novaExtra.legenda).
   Para o teste, a seta do mês só anda entre novembro de 2026 e
   janeiro de 2027 (o militar). Grava em tabelas
   próprias: a Extrajornada de verdade e a escala não mudam.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   Registra RosterWork.paginas['nova-extra'].
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* os meses do teste: novembro e dezembro (o administrador reparte, distribui e lança) e janeiro (o militar faz o pedido) */
  var PRIMEIRO = new Date(2026, 10, 1), ULTIMO = new Date(2027, 0, 1);

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
  /* relê o mês: a Minha extra e, junto, os passos e os números das abas (RosterWork.novaExtraOrg). Na troca de mês
     (comVeu), o véu de carregamento cobre a página e a tela fica travada até o mês novo chegar (o antigo não fica à vista) */
  function carregar(comVeu) {
    var meu = ++pedido;
    el.mes.textContent = nomeMes(comp);
    el.anterior.disabled = comp <= PRIMEIRO;
    el.proximo.disabled = comp >= ULTIMO;
    var conteudo = document.querySelector('.conteudo');
    if (comVeu) { RW.mostrarVeu(conteudo); RW.bloquearTela(); }
    var org = RW.novaExtraOrg.recarregar();
    var minha = RW.novaExtraUtil.chamar('nova_extra_minha', { p_competencia: iso(comp), p_cpf: null }).then(function (r) {
      if (meu !== pedido || !el.titulo.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.novaExtra.org.falhaMes }); return; }
      estado = r;
      desenhar();
    }, function (e) { if (meu === pedido) RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao }); });
    if (comVeu) {
      var fim = function () { RW.esconderVeu(conteudo); RW.liberarTela(); };
      Promise.all([org, minha]).then(fim, fim);
    }
  }

  function desenhar() {
    var r = estado, p = r.prazo, ped = r.pedido;
    var mes = nomeMes(comp);
    el.titulo.textContent = mes.charAt(0).toUpperCase() + mes.slice(1);
    el.prazo.textContent = p.estado === 'aberto' ? msg().prazoAberto(p.faltam_dias) : p.estado === 'antes' ? msg().prazoAntes(br(p.abre)) : msg().prazoFechado(br(p.fecha));
    el.prazo.classList.toggle('selo--alerta', p.estado === 'aberto');
    if (ped) el.pedidoTexto.textContent = ped.voluntario ? msg().pediu(ped) : msg().naoQuer(ped.enviado_em);
    else el.pedidoTexto.textContent = p.estado === 'aberto' ? msg().semPedido(br(p.fecha)) : p.estado === 'antes' ? msg().naoAbriu(br(p.abre)) : msg().naoPediu;
    /* a extra é só para praças: o oficial vê o aviso no lugar do pedido */
    if (r.militar && r.militar.praca === false) el.pedidoTexto.textContent = msg().soPraca;
    botaoPedido();
    el.cotasTexto.textContent = ped && ped.concedidas != null ? msg().concedidas(ped.concedidas) : msg().cotasDepois(br(p.fecha));
    el.diasTexto.textContent = r.extras && r.extras.length
      ? r.extras.map(function (x) { return br(x.data) + ' ' + RW.novaExtraUtil.horas(x.blocos) + ' (' + x.unidade + ')'; }).join('; ') + (r.lancado ? '.' : ' ' + msg().aindaNaoLancado)
      : msg().semDias;
  }

  /* o botão do pedido (a ação do militar), no passo Pedido: aparece com o pedido aberto ou já feito, e só para praças.
     Aberto, Fazer ou Mudar o pedido (escuro); fechado, Ver o pedido (branco) com a data em que fechou ao lado */
  function botaoPedido() {
    var r = estado, p = r.prazo, aberto = p.estado === 'aberto', fechado = !aberto && p.estado !== 'antes';
    var pode = !(r.militar && r.militar.praca === false) && (aberto || !!r.pedido);
    el.pedir.classList.toggle('oculto', !pode);
    el.pedir.classList.toggle('botao--primario', aberto);
    el.pedir.textContent = aberto ? (r.pedido ? msg().mudar : msg().fazer) : msg().ver;
    el.fechado.textContent = fechado ? msg().fechadoEm(br(p.fecha)) : '';
    el.fechado.classList.toggle('oculto', !pode || !fechado);
  }

  /* ---------- as abas e os passos da barra ---------- */
  /* marca a aba escolhida e desmarca as outras, nos dois grupos (o traço único vai para ela) */
  function marcarAba(nome) {
    Array.prototype.forEach.call(el.abas.querySelectorAll('.aba'), function (a) {
      var ativa = a.getAttribute('data-aba') === nome;
      a.classList.toggle('aba--ativa', ativa);
      a.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
  }

  /* o passo n está na lista do atributo ("3 4" = nos passos 3 e 4) */
  function doPasso(e, atributo, n) { return (e.getAttribute(atributo) || '').split(' ').indexOf(String(n)) >= 0; }

  /* a área à vista: a da aba (Minha extra, Calendário) ou a do passo (Organizar o mês; a Distribuição e os Ajustes
     são a mesma área) */
  function mostrarArea(n) {
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-corpo [data-aba-painel]'), function (s) {
      var ve = aba === 'organizar' ? doPasso(s, 'data-passo-painel', n) : s.getAttribute('data-aba-painel') === aba;
      s.classList.toggle('oculto', !ve);
    });
  }

  /* o Organizar o mês abre o passo escolhido antes ou, na primeira vez, o da vez (quem escolhe é o novaExtraOrg,
     que chama RosterWork.novaExtra.passo) */
  function aoTrocarAba(botao) {
    aba = botao.getAttribute('data-aba');
    marcarAba(aba);
    el.passos.classList.toggle('oculto', aba !== 'organizar');
    barraDoPasso(null);
    if (aba === 'organizar') { mostrarArea(null); RW.novaExtraOrg.mostrar(null); return; }
    mostrarArea();
    if (aba === 'minha') RW.novaExtraOrg.sair();
    else RW.novaExtraOrg.mostrar('calendario');
  }

  /* o passo aberto: o botão dele marcado na barra, o que é só dele na barra e a área dele */
  function mostrarPasso(n) {
    Array.prototype.forEach.call(el.passos.querySelectorAll('[data-passo]'), function (b) {
      b.classList.toggle('aba--ativa', +b.getAttribute('data-passo') === n);
    });
    barraDoPasso(n);
    mostrarArea(n);
  }

  /* na barra, o que é só de alguns passos (data-passo-barra) aparece só neles e, no menu Ações, só os itens do passo
     aberto (data-passo-acao); fora do Organizar o mês, nenhum. O filtro da Distribuição e dos Ajustes (com a linha
     "Filtros:") mostra e esconde pelo nova-extra-filtros.js */
  function barraDoPasso(n) {
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-subcabecalho [data-passo-barra]'), function (e) {
      e.classList.toggle('oculto', !doPasso(e, 'data-passo-barra', n));
    });
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-subcabecalho [data-passo-acao]'), function (e) {
      e.classList.toggle('oculto', !doPasso(e, 'data-passo-acao', n));
    });
    if (RW.novaExtraFiltros) RW.novaExtraFiltros.mostrar(n === 3 || n === 4);
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

  /* trocar de mês (só entre os do teste): com a distribuição não salva, pergunta antes */
  function trocarMes(n) {
    var alvo = new Date(comp.getFullYear(), comp.getMonth() + n, 1);
    if (alvo < PRIMEIRO || alvo > ULTIMO) return;
    function ir() { comp = alvo; carregar(true); }
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
    el.fechado = conteudo.querySelector('#nova-extra-fechado');
    el.passos = conteudo.querySelector('#nova-extra-passos');
    el.mes = conteudo.querySelector('#nova-extra-mes');
    el.anterior = conteudo.querySelector('#nova-extra-mes-anterior');
    el.proximo = conteudo.querySelector('#nova-extra-mes-proximo');
    el.diasTexto = conteudo.querySelector('#nova-extra-dias-texto');
    el.legenda = RW.legenda.montar(conteudo.querySelector('#nova-extra-legenda'));
    el.legendaDivisor = conteudo.querySelector('#nova-extra-legenda-divisor');
    comp = new Date(ULTIMO);

    /* sair da Distribuição com mudanças não salvas (pelas abas ou pelos passos da barra): confirma o descarte antes de
       trocar. Captura: roda antes de o geral-abas trocar. */
    [el.abas, el.passos].forEach(function (grupo) {
      grupo.addEventListener('click', function (e) {
        var b = e.target.closest('.aba');
        if (!b || b.classList.contains('aba--ativa') || !RW.novaExtraOrg.sujo()) return;
        e.preventDefault();
        e.stopPropagation();
        RW.confirmar({ tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar, textoConfirmar: RW.mensagens.botoes.descartar,
          textoCancelar: RW.mensagens.botoes.continuarEditando, aoConfirmar: function () { RW.novaExtraMontar.descartar(); b.click(); } });
      }, true);
    });
    Array.prototype.forEach.call(el.abas.querySelectorAll('.abas'), function (trilho) { RW.abas.ligar(trilho, aoTrocarAba); });
    RW.abas.ligar(el.passos, function (b) { RW.novaExtraOrg.mostrar(+b.getAttribute('data-passo')); });
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

  RW.novaExtra = { comp: function () { return iso(comp); }, legenda: legenda, passo: mostrarPasso, recarregar: function () { carregar(); } };
  RW.paginas['nova-extra'] = { iniciar: iniciar };
})();
