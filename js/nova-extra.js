/* ============================================================
   EXTRAJORNADA — a página, em etapas
   Abas Minha extra · Extras do mês · Organizar o mês (só do
   administrador da companhia; nova-extra-organizar.js desenha as
   Extras do mês e os passos). A Minha extra
   mostra o pedido do mês (nova_extra_minha), com o botão que abre o
   painel do pedido (nova-extra-pedido.js) no passo Pedido. A barra: o
   mês, os passos Pedidos · Cotas · Distribuição · Ajustes · Relatórios
   (só no Organizar o mês), o seletor Agenda | Calendário (nas Extras
   do mês, na Distribuição e nos Ajustes; com o seletor de unidade na
   Agenda do celular), o menu Ações do passo aberto e a Legenda (o
   molde que o passo pedir, RosterWork.novaExtra.legenda).
   Abre no mês de hoje (ou no que o aviso pedir); a seta do mês anda
   de outubro de 2026 até o mês do pedido que já abriu mais à frente.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   Registra RosterWork.paginas['nova-extra'].
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* as setas do mês: de outubro de 2026 (o começo da Extrajornada no sistema) até o mês do pedido que já abriu mais à
     frente (o ultimo_mes do nova_extra_minha; antes de ele chegar, o mês que vem) */
  var PRIMEIRO = new Date(2026, 9, 1);
  var ultimo = null;

  var el = {};
  var comp = null;      // o mês do pedido (Date, dia 1)
  var estado = null;    // a resposta do nova_extra_minha
  var pedido = 0;       // latest-wins
  var aba = 'minha';    // a aba aberta (data-aba)
  var conteudoPagina = null;
  var desenhado = null; // o mês desenhado na Minha extra (AAAA-MM-01)
  var passoVisivel = null;   // o passo da área à vista (Organizar o mês)
  /* a leitura de cada área: 'lendo', 'ok' ou 'falha' (com a frase). A Minha extra espera a dela (nova_extra_minha); as
     Extras do mês e o Organizar o mês, a do mês (nova_extra_mes, RosterWork.novaExtraOrg) */
  var leituras = null;

  function msg() { return RW.mensagens.novaExtra; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function nomeMes(d) { return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' '); }
  function br(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }

  /* ---------- Minha extra ---------- */
  /* relê o mês: a Minha extra e, junto, os passos e os números das abas (RosterWork.novaExtraOrg). Como na Escala, o
     nome do mês muda na hora e só a área da aba aberta espera o mês novo, com o círculo (as setas, as abas e os passos
     continuam usáveis; só o último mês pedido aparece). A releitura do mesmo mês deixa a tela à vista */
  function carregar() {
    var meu = ++pedido, mes = iso(comp);
    el.mes.textContent = nomeMes(comp);
    el.anterior.disabled = comp <= PRIMEIRO;
    el.proximo.disabled = comp >= ultimo;
    if (desenhado !== mes || leituras.minha.situacao === 'falha') leitura('minha', 'lendo');
    RW.novaExtraOrg.recarregar();
    /* a falha fica no lugar da área (a frase), com a mensagem técnica no console */
    function falhou(texto, tecnico) {
      if (meu !== pedido || !el.titulo.isConnected) return;
      if (tecnico) console.error('[Nova extra] nova_extra_minha falhou: ' + tecnico);
      leitura('minha', 'falha', texto || RW.mensagens.novaExtra.org.falhaMes);
    }
    RW.novaExtraUtil.chamar('nova_extra_minha', { p_competencia: mes, p_cpf: null }).then(function (r) {
      if (meu !== pedido || !el.titulo.isConnected) return;
      if (!r || !r.ok) { falhou(r && r.error); return; }
      estado = r;
      desenhado = mes;
      if (r.ultimo_mes) {
        ultimo = new Date(+r.ultimo_mes.slice(0, 4), +r.ultimo_mes.slice(5, 7) - 1, 1);
        el.proximo.disabled = comp >= ultimo;
      }
      leitura('minha', 'ok');
      desenhar();
    }, function (e) { falhou(null, (e && e.message) || 'sem conexão'); });
  }

  /* a leitura de uma área mudou (RosterWork.novaExtra.leitura): a área à vista é refeita */
  function leitura(nome, situacao, texto) {
    leituras[nome] = { situacao: situacao, texto: texto || '' };
    if (conteudoPagina && conteudoPagina.isConnected) mostrarArea(passoVisivel);
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
     são a mesma área). Enquanto a leitura dela não chega, o círculo no lugar; se falhou, a frase (os moldes da Escala).
     O menu Ações fica desligado enquanto o mês não chega, para nada agir sobre o mês antigo */
  function mostrarArea(n) {
    passoVisivel = n;
    var l = leituras[aba === 'minha' ? 'minha' : 'mes'], pronta = l.situacao === 'ok';
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-corpo [data-aba-painel]'), function (s) {
      var ve = aba === 'organizar' ? doPasso(s, 'data-passo-painel', n) : s.getAttribute('data-aba-painel') === aba;
      s.classList.toggle('oculto', !ve || !pronta);
    });
    el.estado.classList.toggle('oculto', pronta);
    el.estado.textContent = '';
    if (!pronta) {
      var no = RW.tpl(l.situacao === 'lendo' ? 'tpl-escala-carregando' : 'tpl-escala-estado');
      if (no && l.situacao === 'falha') no.textContent = l.texto;
      if (no) el.estado.appendChild(no);
    }
    el.acoes.disabled = leituras.mes.situacao !== 'ok';
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
     "Filtros:") mostra e esconde pelo nova-extra-filtros.js. O seletor Agenda | Calendário e o Imprimir ficam nas Extras
     do mês, na Distribuição e nos Ajustes; fora deles, o seletor de unidade do celular some */
  function barraDoPasso(n) {
    var comModos = aba === 'calendario' || n === 3 || n === 4;
    el.modos.classList.toggle('oculto', !comModos);
    el.imprimir.classList.toggle('oculto', !comModos);
    divisor();
    if (!comModos && RW.seletorUnidade) RW.seletorUnidade.mostrar(null);
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-subcabecalho [data-passo-barra]'), function (e) {
      e.classList.toggle('oculto', !doPasso(e, 'data-passo-barra', n));
    });
    Array.prototype.forEach.call(conteudoPagina.querySelectorAll('.pagina-subcabecalho [data-passo-acao]'), function (e) {
      e.classList.toggle('oculto', !doPasso(e, 'data-passo-acao', n));
    });
    if (RW.novaExtraFiltros) RW.novaExtraFiltros.mostrar(n === 3 || n === 4);
  }

  /* ---------- Agenda | Calendário ---------- */
  function marcarModo(valor) {
    Array.prototype.forEach.call(el.modos.querySelectorAll('.aba'), function (a) {
      var ativa = a.getAttribute('data-modo') === valor;
      a.classList.toggle('aba--ativa', ativa);
      a.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });
  }
  /* a escolha do seletor da barra: 'agenda' ou 'calendario' */
  function modo() {
    var a = el.modos && el.modos.querySelector('.aba--ativa');
    return (a && a.getAttribute('data-modo')) || 'agenda';
  }
  /* a Agenda do celular mostra uma unidade por tela, pelo seletor de unidade; o Calendário mostra todas no dia */
  function agendaNoCelular() { return !!(RW.celular && RW.celular()) && modo() === 'agenda'; }

  /* o traço antes das ferramentas (a Legenda e o Imprimir): aparece com uma delas à vista */
  function divisor() {
    el.legendaDivisor.classList.toggle('oculto', el.legenda.classList.contains('oculto') && el.imprimir.classList.contains('oculto'));
  }

  /* a Legenda: aparece com o conteúdo do molde (id) ou some (null) */
  function legenda(id) {
    if (!el.legenda) return;
    el.legenda.classList.toggle('oculto', !id);
    divisor();
    var alvo = el.legenda.querySelector('[data-legenda-conteudo]');
    if (!alvo) return;
    alvo.textContent = '';
    var t = id && document.getElementById(id);
    if (t) alvo.appendChild(t.content.cloneNode(true));
  }

  /* trocar de mês (dentro das setas): o painel do dia aberto é do mês antigo e fecha antes; com a distribuição não
     salva, o aviso de sempre e o mês só muda no Descartar */
  function trocarMes(n) {
    var alvo = new Date(comp.getFullYear(), comp.getMonth() + n, 1);
    if (alvo < PRIMEIRO || alvo > ultimo) return;
    function ir() { comp = alvo; RW.novaExtraMontar.fecharPainel(); carregar(); }
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
    el.estado = conteudo.querySelector('#nova-extra-estado');
    el.acoes = conteudo.querySelector('#nova-extra-acoes > .botao');
    el.modos = conteudo.querySelector('#nova-extra-modos');
    el.imprimir = conteudo.querySelector('#nova-extra-imprimir');
    /* abre no mês de hoje ou no mês que o aviso pediu (o do pedido, no aviso do prazo) */
    var hoje = new Date(), pedida = RW.referenciaPedida ? RW.referenciaPedida('nova-extra') : null;
    ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    comp = pedida ? new Date(+pedida.slice(0, 4), +pedida.slice(5, 7) - 1, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    if (comp < PRIMEIRO) comp = new Date(PRIMEIRO);
    if (comp > ultimo) ultimo = new Date(comp);
    desenhado = null;
    /* o Organizar o mês é do administrador da companhia (qualquer um dela, inclusive o de um pelotão): para os outros,
       o grupo dele sai (e o traço entre os grupos junto) */
    if (!RW.sessao.temPapel('pelotao')) {
      Array.prototype.forEach.call(el.abas.querySelectorAll('[data-so-admin]'), function (g) { g.remove(); });
    }
    passoVisivel = null;
    leituras = { minha: { situacao: 'ok', texto: '' }, mes: { situacao: 'ok', texto: '' } };

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
    /* celular: o seletor de unidade da Agenda, na barra da página */
    if (RW.seletorUnidade) RW.seletorUnidade.iniciar(conteudo);
    /* Agenda | Calendário: abre na escolha do tipo de aparelho, a mesma da Escala e da Extrajornada, e a troca fica
       lembrada (geral-visao-grade); a área aberta redesenha no modo escolhido */
    marcarModo(RW.visaoGrade ? RW.visaoGrade.agendaOuCalendario() : 'agenda');
    RW.abas.ligar(el.modos, function (b) {
      if (RW.visaoGrade) RW.visaoGrade.gravar({ agendaOuCalendario: b.getAttribute('data-modo') });
      if (aba === 'calendario') RW.novaExtraOrg.desenharAba();
      else if (aba === 'organizar') RW.novaExtraMontar.redesenhar();
    });
    /* Imprimir: a grade da tela, no painel de impressão das grades da Escala */
    el.imprimir.addEventListener('click', function () { RW.novaExtraImprimirGrade.abrir(aba === 'calendario', modo()); });
    RW.novaExtraOrg.montar(conteudo);
    el.pedir.addEventListener('click', function () {
      if (estado && RW.novaExtraPedido) RW.novaExtraPedido.abrir(estado, comp, null, carregar);
    });
    marcarAba('minha');
    carregar();
    return Promise.resolve();
  }

  RW.novaExtra = { comp: function () { return iso(comp); }, legenda: legenda, passo: mostrarPasso, recarregar: function () { carregar(); }, leitura: leitura,
    modo: modo,
    /* as grades do mês: antes de desenhar a Agenda, as unidades dela (no celular, o seletor de unidade); depois de montar,
       uma unidade por tela no celular */
    grade: {
      unidades: function (lista) { if (RW.seletorUnidade) RW.seletorUnidade.mostrar(agendaNoCelular() ? lista : null); },
      aplicar: function (wrap) { if (RW.seletorUnidade && agendaNoCelular()) RW.seletorUnidade.aplicar(wrap); }
    } };
  RW.paginas['nova-extra'] = { iniciar: iniciar };
})();
