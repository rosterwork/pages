/* ============================================================
   NOVA EXTRA — protótipo da extrajornada em etapas (só programador)
   Abas Minha extra · Calendário | Organizar o mês. A Minha extra
   mostra o pedido do mês (nova_extra_minha) e abre o painel do
   pedido (nova-extra-pedido.js). O grupo TESTE da barra escolhe de
   quem é o pedido ("Pedido de") e copia, gera ou apaga pedidos de
   teste (nova_extra_pedidos_teste). Grava em tabelas próprias:
   a Extrajornada de verdade e a escala não mudam.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   Registra RosterWork.paginas['nova-extra'].
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var el = {};
  var comp = null;      // o mês do pedido (Date, dia 1)
  var cpf = null;       // de quem é o pedido (null = o próprio)
  var estado = null;    // a resposta do nova_extra_minha
  var pedido = 0;       // latest-wins

  function msg() { return RW.mensagens.novaExtra; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function nomeMes(d) { return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' '); }
  function br(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) : ''; }

  /* ---------- Minha extra ---------- */
  /* procurar: na entrada, se o pedido do próximo mês já fechou, abre no mês seguinte (o pedido aberto ou o que vai abrir) */
  function carregar(procurar) {
    var meu = ++pedido;
    el.mes.textContent = nomeMes(comp);
    RW.rpc('nova_extra_minha', { p_competencia: iso(comp), p_cpf: cpf }).then(function (r) {
      if (meu !== pedido || !el.titulo.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      if (procurar === true && r.prazo.estado === 'encerrado') { comp = new Date(comp.getFullYear(), comp.getMonth() + 1, 1); carregar(); return; }
      estado = r;
      desenhar();
    }, function (e) { if (meu === pedido) RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao }); });
  }

  function desenhar() {
    var r = estado, p = r.prazo, ped = r.pedido;
    var mes = nomeMes(comp);
    el.titulo.textContent = r.em_nome ? msg().titulo(mes, r.militar.grad + ' ' + r.militar.nome) : mes.charAt(0).toUpperCase() + mes.slice(1);
    el.prazo.textContent = p.estado === 'aberto' ? msg().prazoAberto(p.faltam_dias) : p.estado === 'antes' ? msg().prazoAntes(br(p.abre)) : msg().prazoFechado(br(p.fecha));
    el.prazo.classList.toggle('selo--alerta', p.estado === 'aberto');
    if (ped) el.pedidoTexto.textContent = ped.voluntario ? msg().pediu(ped) : msg().naoQuer(ped.enviado_em);
    else el.pedidoTexto.textContent = p.estado === 'aberto' ? msg().semPedido(br(p.fecha)) : p.estado === 'antes' ? msg().naoAbriu(br(p.abre)) : msg().naoPediu;
    el.pedir.textContent = p.estado === 'aberto' ? (ped ? msg().mudar : msg().fazer) : msg().ver;
    el.pedir.classList.toggle('oculto', p.estado !== 'aberto' && !ped);
    el.cotasTexto.textContent = ped && ped.concedidas != null ? msg().concedidas(ped.concedidas) : msg().cotasDepois(br(p.fecha));
  }

  /* ---------- TESTE: de quem é o pedido, copiar, gerar e apagar ---------- */
  function idsSelecionados() {
    try {
      var prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return prefs && Array.isArray(prefs.unidades_selecionadas) ? prefs.unidades_selecionadas : [];
    } catch (e) { return []; }
  }

  function escolher(novo, texto) {
    cpf = novo;
    el.pedidoDe.textContent = texto;
    carregar();
  }

  function carregarMilitares() {
    var eu = RW.sessao.perfil() || {};
    var meuNome = msg().eu((eu.grau_abreviacao || '') + ' ' + (eu.nome_de_guerra || ''));
    el.pedidoDe.textContent = meuNome;
    var item = RW.tpl('tpl-nova-extra-militar');
    item.textContent = meuNome;
    item.addEventListener('click', function () { escolher(null, meuNome); });
    el.militares.appendChild(item);
    RW.rpc('buscar_efetivo', {}).then(function (lista) {
      if (!Array.isArray(lista) || !el.militares.isConnected) return;
      var unidades = idsSelecionados();
      lista.filter(function (m) { return m.situacao !== 'Inativo' && m.usuario_id !== eu.cpf && (!unidades.length || unidades.indexOf(m.lotacao_atual) >= 0); })
        .forEach(function (m) {
          var it = RW.tpl('tpl-nova-extra-militar');
          var nome = m.grau_abreviacao + ' ' + m.nome_de_guerra;
          it.textContent = msg().militar(nome, m.tipo);
          it.addEventListener('click', function () { escolher(m.usuario_id, nome); });
          el.militares.appendChild(it);
        });
    });
  }

  function teste(acao, botao) {
    function rodar() {
      RW.iniciarCarregando(botao);
      RW.rpc('nova_extra_pedidos_teste', { p_competencia: iso(comp), p_acao: acao, p_cpfs: null, p_quantidade: 20 }).then(function (r) {
        RW.pararCarregando(botao);
        if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
        RW.avisar({ tipo: 'sucesso', mensagem: msg().feito[acao](r.copiados || r.gerados || r.apagados || 0) });
        carregar();
      }, function (e) { RW.pararCarregando(botao); RW.avisar({ tipo: 'erro', mensagem: (e && e.message) || RW.mensagens.geral.semConexao }); });
    }
    if (acao !== 'apagar') { rodar(); return; }
    RW.confirmar({ tipo: 'aviso', mensagem: msg().confirmarApagar(nomeMes(comp)), textoConfirmar: msg().apagar, aoConfirmar: rodar });
  }

  /* ---------- entrada ---------- */
  function iniciar(conteudo) {
    el.titulo = conteudo.querySelector('#nova-extra-titulo');
    el.prazo = conteudo.querySelector('#nova-extra-prazo');
    el.pedidoTexto = conteudo.querySelector('#nova-extra-pedido-texto');
    el.cotasTexto = conteudo.querySelector('#nova-extra-cotas-texto');
    el.pedir = conteudo.querySelector('#nova-extra-pedir');
    el.mes = conteudo.querySelector('#nova-extra-mes');
    el.pedidoDe = conteudo.querySelector('#nova-extra-pedido-de-texto');
    el.militares = conteudo.querySelector('#nova-extra-militares');
    var hoje = new Date();
    comp = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    cpf = null;

    Array.prototype.forEach.call(conteudo.querySelectorAll('#nova-extra-abas .abas'), function (trilho) {
      RW.abas.ligar(trilho, function (aba) {
        var nome = aba.getAttribute('data-aba');
        Array.prototype.forEach.call(conteudo.querySelectorAll('.pagina-corpo [data-aba-painel]'), function (s) {
          s.classList.toggle('oculto', s.getAttribute('data-aba-painel') !== nome);
        });
      });
    });
    conteudo.querySelector('#nova-extra-mes-anterior').addEventListener('click', function () { comp = new Date(comp.getFullYear(), comp.getMonth() - 1, 1); carregar(); });
    conteudo.querySelector('#nova-extra-mes-proximo').addEventListener('click', function () { comp = new Date(comp.getFullYear(), comp.getMonth() + 1, 1); carregar(); });
    el.pedir.addEventListener('click', function () {
      if (estado && RW.novaExtraPedido) RW.novaExtraPedido.abrir(estado, comp, cpf, carregar);
    });
    Array.prototype.forEach.call(conteudo.querySelectorAll('[data-teste]'), function (b) {
      b.addEventListener('click', function () { teste(b.getAttribute('data-teste'), b); });
    });
    carregarMilitares();
    carregar(true);
    return Promise.resolve();
  }

  RW.paginas['nova-extra'] = { iniciar: iniciar };
})();
