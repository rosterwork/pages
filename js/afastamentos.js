/* ============================================================
   AFASTAMENTOS — página (abas Férias · Licenças · Dispensas)
   Alterna as abas e monta a árvore de unidades da aba ativa
   (listar_ferias · listar_licencas · listar_dispensas). Como a
   geral-arvore-unidades é única por página, a árvore da aba ativa é
   (re)montada na troca de aba. Os botões "Novas férias / Nova licença
   / Nova dispensa" (só admin) abrem o painel de criação. Ao trocar de
   aba com o painel aberto, ele é fechado (com aviso se houver dados).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  /* rótulos dos tipos por categoria (fonte única de exibição na lista) */
  var TIPO_LICENCA = {
    propria_saude: 'Tratamento da própria saúde', saude_familiar: 'Saúde de familiar',
    interesses: 'Interesses particulares', especial: 'Licença especial', capacitacao: 'Licença capacitação'
  };
  var TIPO_DISPENSA = { gala: 'Gala (casamento)', nojo: 'Nojo (falecimento)', comum: 'Comum' };

  /* ISO (AAAA-MM-DD) -> DD/MM */
  function formatarDataCurta(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : iso;
  }

  function preencheSeloFluxo(selo, fora) {
    if (fora) { selo.textContent = 'Fora do fluxo'; selo.classList.add('selo--erro'); }
    else { selo.textContent = 'Segue no fluxo'; selo.classList.add('selo--sucesso'); }
  }

  /* ---------- Férias: lista + contagem ---------- */
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
  function contagemFerias(itens) { return itens.length === 1 ? '1 em férias' : itens.length + ' em férias'; }

  /* ---------- Licenças: lista + contagem (Tipo + fora do fluxo) ---------- */
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
      var tipo = TIPO_LICENCA[l.tipo] || 'Licença';
      item.querySelector('.atestado-detalhe').textContent = tipo + ' · ' + formatarDataCurta(l.data_inicio) + ' a ' + formatarDataCurta(l.data_fim);
      item.querySelector('.atestado-dias').textContent = l.dias + (l.dias === 1 ? ' dia' : ' dias');
      preencheSeloFluxo(item.querySelector('.atestado-fluxo-selo'), l.fora_do_fluxo);
      lista.appendChild(item);
    });
    container.appendChild(lista);
  }
  function contagemLicencas(itens) { return itens.length === 1 ? '1 em licença' : itens.length + ' em licença'; }

  /* ---------- Dispensas: lista + contagem (Tipo + fora do fluxo) ---------- */
  function renderDispensas(container, unidade, dispensas) {
    if (!dispensas || dispensas.length === 0) {
      var tplVazio = document.getElementById('tpl-dispensas-vazio');
      if (tplVazio) container.appendChild(tplVazio.content.cloneNode(true));
      return;
    }
    var tplLista = document.getElementById('tpl-dispensas-lista');
    var tplItem = document.getElementById('tpl-dispensa-item');
    if (!tplLista || !tplItem) return;
    var lista = tplLista.content.cloneNode(true).firstElementChild;
    dispensas.forEach(function (d) {
      var item = tplItem.content.cloneNode(true).firstElementChild;
      item.querySelector('.atestado-grad').textContent = d.grau_abreviacao || '';
      item.querySelector('.atestado-nome').textContent = d.nome_de_guerra || '';
      var tipo = TIPO_DISPENSA[d.tipo] || 'Dispensa';
      item.querySelector('.atestado-detalhe').textContent = tipo + ' · ' + formatarDataCurta(d.data_inicio) + ' a ' + formatarDataCurta(d.data_fim);
      item.querySelector('.atestado-dias').textContent = d.dias + (d.dias === 1 ? ' dia' : ' dias');
      preencheSeloFluxo(item.querySelector('.atestado-fluxo-selo'), d.fora_do_fluxo);
      lista.appendChild(item);
    });
    container.appendChild(lista);
  }
  function contagemDispensas(itens) { return itens.length === 1 ? '1 em dispensa' : itens.length + ' em dispensa'; }

  /* abas com árvore de unidades */
  var ABAS = {
    ferias:    { container: '#arvore-ferias',    rpc: 'listar_ferias',    render: renderFerias,    contagem: contagemFerias,    botao: '#btn-nova-ferias',   modulo: 'ferias' },
    licencas:  { container: '#arvore-licencas',  rpc: 'listar_licencas',  render: renderLicencas,  contagem: contagemLicencas,  botao: '#btn-nova-licenca',  modulo: 'licencas' },
    dispensas: { container: '#arvore-dispensas', rpc: 'listar_dispensas', render: renderDispensas, contagem: contagemDispensas, botao: '#btn-nova-dispensa', modulo: 'dispensas' }
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

  /* mostra só o botão "Novo/Nova ..." da aba ativa, e só para admin */
  function ajustarBotoes(conteudo, aba) {
    Object.keys(ABAS).forEach(function (nome) {
      var btn = conteudo.querySelector(ABAS[nome].botao);
      if (btn) btn.classList.toggle('oculto', !(nome === aba && RosterWork.sessao.ehAdmin()));
    });
  }

  function aplicarAba(conteudo, alvo) {
    var paineis = conteudo.querySelectorAll('[data-aba-painel]');
    for (var i = 0; i < paineis.length; i++) {
      paineis[i].classList.toggle('oculto', paineis[i].getAttribute('data-aba-painel') !== alvo);
    }
    ajustarBotoes(conteudo, alvo);
    if (ABAS[alvo]) montarArvore(conteudo, alvo);
  }

  function ligarAbas(conteudo) {
    var trilho = conteudo.querySelector('#afastamentos-abas');
    if (!trilho || !window.RosterWork.abas) return;

    /* guarda: com o painel de criação aberto, trocar de aba fecha o painel
       (confirma o descarte se houver dados). Captura: roda antes do geral-abas. */
    trilho.addEventListener('click', function (e) {
      if (!RosterWork.painel || !RosterWork.painel.estaAberto()) return;
      var aba = e.target.closest('.aba');
      if (!aba) return;
      e.preventDefault();
      e.stopPropagation();
      var sujo = !!(RosterWork.afastamentoSujo && RosterWork.afastamentoSujo());
      if (!sujo || !RosterWork.confirmar) {
        RosterWork.painel.fechar();
        aba.click();   // painel fechado: agora o geral-abas troca normalmente
        return;
      }
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RosterWork.mensagens.botoes.sairSemSalvar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { RosterWork.painel.fechar(); aba.click(); }
      });
    }, true);

    window.RosterWork.abas.ligar(trilho, function (aba) {
      aplicarAba(conteudo, aba.getAttribute('data-aba'));
    });
  }

  function iniciar(conteudo) {
    ligarAbas(conteudo);
    /* liga cada botão "Novo/Nova ..." ao abrirNovo do seu módulo */
    Object.keys(ABAS).forEach(function (nome) {
      var btn = conteudo.querySelector(ABAS[nome].botao);
      var modulo = ABAS[nome].modulo;
      if (btn) btn.addEventListener('click', function () {
        var mod = window.RosterWork[modulo];
        if (mod && mod.abrirNovo) mod.abrirNovo();
      });
    });
    /* a aba Licenças começa ativa (ver afastamentos.html) */
    ajustarBotoes(conteudo, 'licencas');
    return montarArvore(conteudo, 'licencas');
  }

  window.RosterWork.paginas.afastamentos = { iniciar: iniciar };
})();
