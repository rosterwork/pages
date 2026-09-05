/* ============================================================
   DISTRIBUIÇÃO — entrada da página
   Liga as abas (Modelos/Regras), descobre o grupo (CIA + PELs) a partir
   da seleção de unidades do cabeçalho, monta o cabeçalho de colunas do
   painel e dispara a carga dos modelos. Reage à troca de unidades.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var mapaUnidades = null;
  var ouvinteLigado = false;

  /* ids das unidades aplicadas no seletor do cabeçalho */
  function idsSelecionados() {
    if (window.RosterWork.seletorUnidadesCabecalho) {
      try { return window.RosterWork.seletorUnidadesCabecalho.idsSelecionados() || []; } catch (e) {}
    }
    try {
      var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias'));
      return (p && p.unidades_selecionadas) || [];
    } catch (e) { return []; }
  }

  function carregarMapa() {
    if (mapaUnidades) return Promise.resolve(mapaUnidades);
    return RosterWork.distribuicaoDados.buscarUnidades().then(function (lista) {
      mapaUnidades = {};
      (lista || []).forEach(function (u) { mapaUnidades[u.unidade_id] = u; });
      return mapaUnidades;
    });
  }

  /* a partir da seleção, acha a CIA/CIBM do grupo e lista CIA + PELs filhos */
  function obterGrupo(ids, mapa) {
    var cia = null;
    for (var i = 0; i < ids.length; i++) {
      var u = mapa[ids[i]];
      if (!u) continue;
      if (u.tipo === 'PEL') { cia = mapa[u.unidade_pai_id] || null; if (cia) break; }
      if (u.tipo === 'CIA' || u.tipo === 'CIBM') { cia = u; break; }
    }
    if (!cia) return null;
    var pels = [];
    for (var id in mapa) {
      if (Object.prototype.hasOwnProperty.call(mapa, id) &&
          mapa[id].unidade_pai_id === cia.unidade_id && mapa[id].tipo === 'PEL') {
        pels.push(mapa[id]);
      }
    }
    pels.sort(function (a, b) { return (a.nome || '').localeCompare(b.nome || ''); });
    return { cia: cia, unidades: [cia].concat(pels) };
  }

  /* cabeçalho de colunas do painel: 1ª célula (alinha com o status) + uma por unidade */
  function montarColunas(grupo) {
    var cab = document.getElementById('distribuicao-colunas');
    if (!cab) return;
    cab.textContent = '';
    var marca = RosterWork.tpl('tpl-distribuicao-coluna');
    if (marca) { marca.classList.add('distribuicao-col--marca'); marca.textContent = ''; cab.appendChild(marca); }
    grupo.unidades.forEach(function (u) {
      var c = RosterWork.tpl('tpl-distribuicao-coluna');
      if (c) { c.textContent = u.nome || ''; cab.appendChild(c); }
    });
    /* reserva, à direita, o espaço do botão "⋯" que cada linha de modelo tem (alinha as colunas) */
    var menu = RosterWork.tpl('tpl-distribuicao-coluna');
    if (menu) { menu.classList.add('distribuicao-col--menu'); menu.textContent = ''; cab.appendChild(menu); }
  }

  /* aviso (nada selecionado): limpa painel/corpo/rodapé e mostra a mensagem */
  function mostrarAviso(texto) {
    ['distribuicao-colunas', 'distribuicao-corpo', 'distribuicao-rodape'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    var lista = document.getElementById('distribuicao-lista-modelos');
    if (lista) {
      lista.textContent = '';
      var est = RosterWork.tpl('tpl-distribuicao-estado');
      if (est) { est.textContent = texto; lista.appendChild(est); }
    }
    var btn = document.getElementById('distribuicao-novo-modelo');
    if (btn) btn.disabled = true;
  }

  var carregadoModelos = null;   // id da CIA já carregada na aba Modelos
  var carregadoRegras = null;    // id da CIA já carregada na aba Regras

  function abaAtiva() {
    var a = document.querySelector('#distribuicao-abas .aba--ativa');
    return a ? a.getAttribute('data-aba') : 'modelos';
  }

  /* carrega o conteúdo de uma aba só se ainda não estiver na tela p/ o grupo atual
     (assim alternar Modelos↔Regras não recarrega — preserva a edição de modelos) */
  function carregarAba(aba, grupo) {
    var gid = grupo ? grupo.cia.unidade_id : null;
    if (aba === 'regras') {
      if (carregadoRegras === gid) return;
      carregadoRegras = gid;
      if (window.RosterWork.distribuicaoRegras) return window.RosterWork.distribuicaoRegras.carregar(grupo);
    } else {
      if (carregadoModelos === gid) return;
      carregadoModelos = gid;
      montarColunas(grupo);
      /* o botão "Novo modelo" é ligado na Rodada 2 (criação) */
      if (window.RosterWork.distribuicaoModelos) return window.RosterWork.distribuicaoModelos.carregar(grupo);
    }
  }

  function atualizar() {
    /* antes de (re)carregar, exclui um modelo RASCUNHO deixado sem salvar — cobre atualizar a página
       (refresh) e trocar de unidade. Cancelar e Salvar já tratam o rascunho por conta própria. */
    var M = window.RosterWork.distribuicaoModelos;
    var limpar = (M && M.rascunhoId && M.rascunhoId()) ? M.excluirRascunho() : Promise.resolve();
    return limpar.then(function () {
      return carregarMapa().then(function (mapa) {
        var grupo = obterGrupo(idsSelecionados(), mapa);
        carregadoModelos = null; carregadoRegras = null;   // unidades podem ter mudado → recarrega
        if (!grupo) {
          mostrarAviso(RosterWork.mensagens.distribuicao.selecioneUnidade);
          if (window.RosterWork.distribuicaoRegras) window.RosterWork.distribuicaoRegras.carregar(null);
          return;
        }
        return carregarAba(abaAtiva(), grupo);
      });
    });
  }

  function ligarAbas(conteudo) {
    var trilho = conteudo.querySelector('#distribuicao-abas');
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    if (!trilho || !window.RosterWork.abas) return;
    window.RosterWork.abas.ligar(trilho, function (aba) {
      var alvo = aba.getAttribute('data-aba');
      for (var i = 0; i < paineis.length; i++) {
        paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== alvo);
      }
      /* carrega a aba recém-mostrada (só se ainda não estiver montada p/ este grupo) */
      carregarMapa().then(function (mapa) { carregarAba(alvo, obterGrupo(idsSelecionados(), mapa)); });
    });
  }

  /* confirma o descarte de edição não salva (Modelos OU Regras) antes de abandonar (ou segue direto) */
  function pedirSaida(aoSair) {
    var ed = window.RosterWork.distribuicaoEditar;
    var rg = window.RosterWork.distribuicaoRegras;
    var passo2 = function () { if (rg && rg.confirmarSaida) rg.confirmarSaida(aoSair); else aoSair(); };
    if (ed && ed.confirmarSaida) ed.confirmarSaida(passo2); else passo2();
  }

  function iniciar(conteudo) {
    ligarAbas(conteudo);
    if (!ouvinteLigado) {
      window.addEventListener('rosterwork_units_changed', function () {
        if (!document.getElementById('distribuicao-painel')) return;
        pedirSaida(function () { atualizar(); });   /* trocar de unidades com edição aberta → confirma */
      });
      if (window.RosterWork.guardaSaida) {
        /* só conta como pendência quando a página da distribuição está montada (evita falso aviso depois de sair).
           Pendência = edição não salva (estaSujo) OU um modelo RASCUNHO ainda não confirmado (nunca salvo). */
        window.RosterWork.guardaSaida.registrar(function () {
          if (!document.getElementById('distribuicao-painel')) return false;
          var M = window.RosterWork.distribuicaoModelos;
          var temRascunho = !!(M && M.rascunhoId && M.rascunhoId());
          var editando = !!(window.RosterWork.distribuicaoEditar && window.RosterWork.distribuicaoEditar.estaSujo());
          var regrasSujo = !!(window.RosterWork.distribuicaoRegras && window.RosterWork.distribuicaoRegras.estaSujo && window.RosterWork.distribuicaoRegras.estaSujo());
          return temRascunho || editando || regrasSujo;
        });
      }
      ouvinteLigado = true;
    }
    return atualizar();
  }

  window.RosterWork.paginas.distribuicao = { iniciar: iniciar };
})();
