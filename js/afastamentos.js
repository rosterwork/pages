/* ============================================================
   AFASTAMENTOS — página (abas Férias · Licenças · Atestados)
   Alterna as abas e monta a árvore de unidades da aba ativa
   (Atestados = listar_atestados · Férias = listar_ferias;
   Licenças = casca). Como geral-arvore-unidades é único por página,
   a árvore da aba ativa é (re)montada na troca de aba. Os botões
   "Novo atestado"/"Nova férias" (só admin) abrem o painel de criação.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* ISO (AAAA-MM-DD) -> DD/MM */
  function formatarDataCurta(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }

  /* ---------- Atestados: lista + contagem ---------- */
  function renderAtestados(container, unidade, atestados) {
    if (!atestados || atestados.length === 0) {
      var tplVazio = document.getElementById('tpl-atestados-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
      return;
    }
    var tplLista = document.getElementById('tpl-atestados-lista');
    var tplItem = document.getElementById('tpl-atestado-item');
    if (!tplLista || !tplItem) return;
    var lista = tplLista.content.cloneNode(true).firstElementChild;
    atestados.forEach(function (a) {
      var item = tplItem.content.cloneNode(true).firstElementChild;
      item.querySelector('.atestado-grad').textContent = a.grau_abreviacao || '';
      item.querySelector('.atestado-nome').textContent = a.nome_de_guerra || '';
      var detalhe = formatarDataCurta(a.data_inicio) + ' a ' + formatarDataCurta(a.data_fim);
      if (a.cid) detalhe += ' · CID ' + a.cid;
      item.querySelector('.atestado-detalhe').textContent = detalhe;
      item.querySelector('.atestado-dias').textContent = a.dias + (a.dias === 1 ? ' dia' : ' dias');
      var selo = item.querySelector('.atestado-fluxo-selo');
      if (a.fora_do_fluxo) { selo.textContent = 'Fora do fluxo'; selo.classList.add('selo--erro'); }
      else { selo.textContent = 'Segue no fluxo'; selo.classList.add('selo--sucesso'); }
      lista.appendChild(item);
    });
    container.appendChild(lista);
  }
  function contagemAtestados(itens) {
    return itens.length === 1 ? '1 atestado' : itens.length + ' atestados';
  }

  /* ---------- Férias: lista + contagem (reusa o CSS dos atestados) ---------- */
  function renderFerias(container, unidade, ferias) {
    if (!ferias || ferias.length === 0) {
      var tplVazio = document.getElementById('tpl-ferias-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
      return;
    }
    var tplLista = document.getElementById('tpl-ferias-lista');
    var tplItem = document.getElementById('tpl-ferias-item');
    if (!tplLista || !tplItem) return;
    var lista = tplLista.content.cloneNode(true).firstElementChild;
    ferias.forEach(function (f) {
      var item = tplItem.content.cloneNode(true).firstElementChild;
      item.querySelector('.atestado-grad').textContent = f.grau_abreviacao || '';
      item.querySelector('.atestado-nome').textContent = f.nome_de_guerra || '';
      item.querySelector('.atestado-detalhe').textContent = formatarDataCurta(f.data_inicio) + ' a ' + formatarDataCurta(f.data_fim);
      item.querySelector('.atestado-dias').textContent = f.dias + (f.dias === 1 ? ' dia' : ' dias');
      lista.appendChild(item);
    });
    container.appendChild(lista);
  }
  function contagemFerias(itens) {
    return itens.length === 1 ? '1 em férias' : itens.length + ' em férias';
  }

  /* ---------- Licenças: lista + contagem (reusa o CSS dos atestados) ---------- */
  function renderLicencas(container, unidade, licencas) {
    if (!licencas || licencas.length === 0) {
      var tplVazio = document.getElementById('tpl-licencas-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
      return;
    }
    var tplLista = document.getElementById('tpl-licencas-lista');
    var tplItem = document.getElementById('tpl-licenca-item');
    if (!tplLista || !tplItem) return;
    var lista = tplLista.content.cloneNode(true).firstElementChild;
    licencas.forEach(function (l) {
      var item = tplItem.content.cloneNode(true).firstElementChild;
      item.querySelector('.atestado-grad').textContent = l.grau_abreviacao || '';
      item.querySelector('.atestado-nome').textContent = l.nome_de_guerra || '';
      item.querySelector('.atestado-detalhe').textContent = formatarDataCurta(l.data_inicio) + ' a ' + formatarDataCurta(l.data_fim);
      item.querySelector('.atestado-dias').textContent = l.dias + (l.dias === 1 ? ' dia' : ' dias');
      lista.appendChild(item);
    });
    container.appendChild(lista);
  }
  function contagemLicencas(itens) {
    return itens.length === 1 ? '1 em licença' : itens.length + ' em licença';
  }

  /* abas com árvore de unidades */
  var ABAS = {
    atestados: { container: '#arvore-atestados', rpc: 'listar_atestados', render: renderAtestados, contagem: contagemAtestados, botao: '#btn-novo-atestado', modulo: 'atestados' },
    ferias:    { container: '#arvore-ferias',    rpc: 'listar_ferias',    render: renderFerias,    contagem: contagemFerias,    botao: '#btn-nova-ferias',   modulo: 'ferias' },
    licencas:  { container: '#arvore-licencas',  rpc: 'listar_licencas',  render: renderLicencas,  contagem: contagemLicencas,  botao: '#btn-nova-licenca',  modulo: 'licencas' }
  };

  /* (re)monta a árvore da aba (o componente é único por página) */
  function montarArvore(conteudo, aba) {
    var def = ABAS[aba];
    if (!def) return;
    var container = conteudo.querySelector(def.container);
    if (!container || !window.RosterWork.arvoreUnidades) return;
    return window.RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: def.rpc,
      chaveUnidade: 'unidade_id',
      textoContagem: def.contagem,
      renderConteudo: def.render
    });
  }

  /* mostra só o botão "Novo ..." da aba ativa, e só para admin */
  function ajustarBotoes(conteudo, aba) {
    Object.keys(ABAS).forEach(function (nome) {
      var btn = conteudo.querySelector(ABAS[nome].botao);
      if (btn) btn.classList.toggle('oculto', !(nome === aba && RosterWork.sessao.ehAdmin()));
    });
  }

  function ligarAbas(conteudo) {
    var trilho = conteudo.querySelector('#afastamentos-abas');
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    if (!trilho || !window.RosterWork.abas) return;
    window.RosterWork.abas.ligar(trilho, function (aba) {
      var alvo = aba.getAttribute('data-aba');
      for (var i = 0; i < paineis.length; i++) {
        paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== alvo);
      }
      ajustarBotoes(conteudo, alvo);
      if (ABAS[alvo]) montarArvore(conteudo, alvo);
    });
  }

  function iniciar(conteudo) {
    ligarAbas(conteudo);
    /* liga cada botão "Novo ..." ao abrirNovo do seu módulo */
    Object.keys(ABAS).forEach(function (nome) {
      var btn = conteudo.querySelector(ABAS[nome].botao);
      var modulo = ABAS[nome].modulo;
      if (btn) btn.addEventListener('click', function () {
        var mod = window.RosterWork[modulo];
        if (mod && mod.abrirNovo) mod.abrirNovo();
      });
    });
    /* a aba Atestados começa ativa (ver afastamentos.html) */
    ajustarBotoes(conteudo, 'atestados');
    return montarArvore(conteudo, 'atestados');
  }

  window.RosterWork.paginas.afastamentos = { iniciar: iniciar };
})();
