/* ============================================================
   ESCALAS — as escolhas do painel do dia: a lista Quem e o Onde
   Quem: a busca e os grupos que abrem e fecham (o título com o
   número de cada um); quem não pode fica apagado, com o motivo. Quem
   usa monta os grupos (a edição da linha, com a lista do banco para a
   vaga, pelo gruposDaVaga daqui; o Adicionar militar, com os de folga
   ou com o ciclo).
   Com texto na busca, todo grupo com alguém que casa abre sozinho.
   Onde: o posto e a função, cada um numa lista; a função traz a
   situação dela no horário ("vazia", "Sd. Godoy sai").
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa: não entram na lista de funções */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function msg() { return RosterWork.mensagens.escala; }

  /* ---------- Quem ---------- */

  /* o grupo abre ou fecha (com busca, a busca manda) */
  function abrirGrupo(g, aberto) {
    g.aberto = aberto;
    g.el.classList.toggle('escala-quem-grupo--aberto', aberto);
    g.cab.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    g.itensEl.classList.toggle('oculto', !aberto);
  }

  function filtrar(est) {
    var termo = est.entrada ? est.entrada.value.trim() : '';
    if (est.pilula) est.pilula.classList.toggle('busca--com-texto', !!termo);
    var visiveis = 0;
    est.grupos.forEach(function (g) {
      var casam = 0;
      g.itens.forEach(function (it) {
        var casa = RosterWork.busca.casaTexto(termo, it.el.getAttribute('data-busca'));
        it.el.classList.toggle('oculto', !casa);
        if (casa) casam++;
      });
      visiveis += casam;
      g.el.classList.toggle('oculto', !casam);
      g.itensEl.classList.toggle('oculto', termo ? !casam : !g.aberto);
      g.qtd.textContent = '(' + casam + ')';
    });
    if (est.vazio) est.vazio.classList.toggle('oculto', visiveis > 0);
  }

  /* lugar = onde a lista entra; cfg = { grupos: [{ rotulo, aberto, erro, itens: [{ cpf, grad, nome, info, pode }] }],
     aoEscolher(item), escolhido: cpf }. Devolve { marcar(cpf) } */
  function montar(lugar, cfg) {
    lugar.textContent = '';
    var el = RosterWork.tpl('tpl-escala-quem');
    if (!el) return null;
    var est = { grupos: [], entrada: null, pilula: null, vazio: null, botoes: [] };
    var pilula = RosterWork.tpl('tpl-escala-secao-busca');
    if (pilula) {
      est.pilula = pilula;
      est.entrada = pilula.querySelector('.busca-entrada');
      est.entrada.addEventListener('input', function () { filtrar(est); });
      pilula.querySelector('.busca-limpar').addEventListener('click', function () { est.entrada.value = ''; est.entrada.focus(); filtrar(est); });
      el.querySelector('.escala-quem-busca').appendChild(pilula);
    }
    var lista = el.querySelector('.escala-quem-lista');
    (cfg.grupos || []).forEach(function (gr) {
      if (!gr.itens.length) return;
      var gEl = RosterWork.tpl('tpl-escala-quem-grupo');
      if (!gEl) return;
      var g = { el: gEl, cab: gEl.querySelector('.escala-quem-grupo-cab'), itensEl: gEl.querySelector('.escala-quem-grupo-itens'),
        qtd: gEl.querySelector('.escala-quem-grupo-qtd'), itens: [], aberto: false };
      gEl.querySelector('.escala-quem-grupo-nome').textContent = gr.rotulo;
      if (gr.erro) gEl.classList.add('escala-quem-grupo--erro');
      g.cab.addEventListener('click', function () { abrirGrupo(g, !g.aberto); filtrar(est); });
      gr.itens.forEach(function (c) {
        var item = RosterWork.tpl('tpl-escala-quem-item');
        if (!item) return;
        item.querySelector('.escala-distribuicao-grad').textContent = c.grad || '';
        item.querySelector('.escala-distribuicao-nome').textContent = c.nome || '';
        item.querySelector('.escala-quem-info').textContent = c.info || '';
        item.setAttribute('data-busca', RosterWork.busca.chave(c) + ' ' + RosterWork.busca.normalizar(c.grad));
        if (c.pode === false) {
          item.disabled = true;
          item.classList.add('escala-quem-item--apagado');
        } else {
          item.addEventListener('click', function () { marcar(c.cpf); if (cfg.aoEscolher) cfg.aoEscolher(c); });
        }
        g.itensEl.appendChild(item);
        g.itens.push({ cpf: c.cpf, el: item });
        est.botoes.push({ cpf: c.cpf, el: item });
      });
      abrirGrupo(g, !!gr.aberto);
      lista.appendChild(gEl);
      est.grupos.push(g);
    });
    var vazio = RosterWork.tpl('tpl-escala-secao-vazio');
    if (vazio) {
      vazio.classList.add('escala-quem-vazio');
      vazio.textContent = msg().ninguemEncontrado;
      lista.appendChild(vazio);
      est.vazio = vazio;
    }
    function marcar(cpf) {
      est.botoes.forEach(function (b) { b.el.classList.toggle('escala-quem-item--escolhido', !!cpf && b.cpf === cpf); });
    }
    lugar.appendChild(el);
    filtrar(est);
    marcar(cfg.escolhido || null);
    /* no computador, a busca já recebe o foco (no celular, abriria o teclado) */
    if (est.entrada && cfg.foco && !document.documentElement.hasAttribute('data-celular')) est.entrada.focus();
    return { marcar: marcar };
  }

  /* ---------- os grupos da vaga (a edição da linha) ---------- */

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function juntar(lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); }

  /* as funções de quem já está na escala, em texto: ["Efetivo 3 da ABT-01"] */
  function lugares(funcoes) {
    var api = ed(), nomes = [];
    (funcoes || []).forEach(function (f) {
      var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
      var t = posto ? api.funcaoNoPosto(f.funcao, posto) : f.funcao;
      if (nomes.indexOf(t) < 0) nomes.push(t);
    });
    return nomes;
  }

  /* o motivo de quem não pode, do código que o banco manda (sai = quem está na linha) */
  function motivoTexto(c, sai) {
    var mm = msg().seletorMotivo, H = ed().horas, mo = c.motivo || {};
    if (mo.codigo === 'papel') return mm.papel(mo.funcao);
    if (mo.codigo === 'horario') return mm.horario(H.textoPeriodos(mo.servico || []));
    if (mo.codigo === 'ocupado') {
      var ocupado = (mo.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
      return ocupado.length ? msg().ocupadoNoDia(ocupado) : '';
    }
    if (mo.codigo === 'regra') return mm.regra(mo.funcao);
    if (mo.codigo === 'cnh') return mm.cnh(mo.cnh);
    if (mo.codigo === 'troca_regra') return mm.trocaRegra(sai, mo.funcao);
    if (mo.codigo === 'troca_cnh') return mm.trocaCnh(sai, mo.cnh, mo.posto);
    return '';
  }

  /* o que já ocupa o dia de quem está de folga ("Extra das 08h às 02h"), ou o dia livre */
  function infoFolga(c) {
    var H = ed().horas;
    if (c.assume) return msg().seletorAssume[c.assume] || '';
    var ocupado = (c.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
    return ocupado.length ? msg().ocupadoNoDia(ocupado) : L().infoLivre;
  }

  /* a lista do banco (escala_dia_disponiveis com a vaga) em grupos: na escala de hoje (aberto), de folga por
     unidade e quem não pode (fechados); militar = quem está na linha (fica de fora) */
  function gruposDaVaga(resp, militar) {
    var naEscala = [], folgas = {}, unidades = [], naoPodem = [];
    var sai = militar ? nomeDe(militar) : '';
    (resp || []).forEach(function (c) {
      if (militar && c.cpf === militar.cpf) return;
      var item = { cpf: c.cpf, grad: c.grad, nome: c.nome, pode: !!c.pode, c: c };
      if (!c.pode) { item.info = motivoTexto(c, sai); naoPodem.push(item); return; }
      if (c.grupo === 'folga') {
        item.info = infoFolga(c);
        var u = c.unidade || '';
        if (!folgas[u]) { folgas[u] = []; unidades.push(u); }
        folgas[u].push(item);
        return;
      }
      item.info = c.grupo === 'sem_funcao' ? L().infoSemFuncao : juntar(lugares(c.funcoes));
      naEscala.push(item);
    });
    return [{ rotulo: L().grupoNaEscala, aberto: true, itens: naEscala }]
      .concat(unidades.map(function (u, i) { return { rotulo: L().grupoFolga(u), aberto: !naEscala.length && i === 0, itens: folgas[u] }; }))
      .concat([{ rotulo: L().grupoNaoPodem, erro: true, itens: naoPodem }]);
  }

  /* enquanto lê, o giratório; se a leitura falhou, o texto */
  function carregando(lugar) {
    lugar.textContent = '';
    var giro = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (giro) lugar.appendChild(giro);
  }
  function falha(lugar) {
    lugar.textContent = '';
    var t = RosterWork.tpl('tpl-escala-secao-vazio');
    if (t) { t.classList.add('escala-quem-vazio'); t.textContent = msg().falhaCarregar; lugar.appendChild(t); }
  }

  /* ---------- Onde ---------- */

  /* lugar = onde as duas listas entram; cfg = { postos, posto, funcao, situacao(posto, nomeFuncao) -> texto,
     aoMudar(posto, funcao) }. Devolve { valor() -> { posto, funcao } } */
  function onde(lugar, cfg) {
    lugar.textContent = '';
    var el = RosterWork.tpl('tpl-escala-onde');
    if (!el) return null;
    var est = { posto: cfg.posto || null, funcao: cfg.funcao || null };
    var dPosto = el.querySelector('.escala-onde-posto'), dFuncao = el.querySelector('.escala-onde-funcao');
    var vazioPosto = dPosto.querySelector('.campo-selecao-texto').textContent;
    var vazioFuncao = dFuncao.querySelector('.campo-selecao-texto').textContent;

    function item(menu, texto, situacao, aoEscolher) {
      var it = RosterWork.tpl('tpl-escala-onde-item');
      if (!it) return;
      it.querySelector('.escala-onde-item-nome').textContent = texto;
      it.querySelector('.escala-onde-item-situacao').textContent = situacao || '';
      it.addEventListener('click', aoEscolher);
      menu.appendChild(it);
    }
    function texto(dropdown, valor, vazio) {
      var t = dropdown.querySelector('.campo-selecao-texto');
      t.textContent = valor || vazio;
      t.classList.toggle('campo-selecao-texto--vazio', !valor);
    }
    /* a "Nova função" é a próxima numeração do posto, quando ele ainda cabe gente */
    function eNova(nome) {
      return !!(est.posto && est.posto.adicionar && nome === est.posto.adicionar.nome_funcao
        && !(est.posto.funcoes || []).some(function (f) { return f.nome === nome; }));
    }
    function desenhar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var menu = dFuncao.querySelector('.dropdown-menu');
      menu.textContent = '';
      if (est.posto) {
        var nomes = [];
        (est.posto.funcoes || []).forEach(function (f) { if (!BLOQUEADAS.test(f.nome) && nomes.indexOf(f.nome) < 0) nomes.push(f.nome); });
        nomes.forEach(function (nm) { item(menu, nm, cfg.situacao(est.posto, nm), function () { est.funcao = nm; mudou(); }); });
        var nova = est.posto.adicionar && est.posto.adicionar.nome_funcao;
        if (nova && !est.posto.cheio && nomes.indexOf(nova) < 0) {
          item(menu, msg().novaFuncao(nova), msg().itemVazia, function () { est.funcao = nova; mudou(); });
        }
      }
      texto(dPosto, est.posto && est.posto.nome, vazioPosto);
      texto(dFuncao, est.funcao && (eNova(est.funcao) ? msg().novaFuncao(est.funcao) : est.funcao), vazioFuncao);
    }
    function mudou() { desenhar(); if (cfg.aoMudar) cfg.aoMudar(est.posto, est.funcao); }

    var menuPosto = dPosto.querySelector('.dropdown-menu');
    (cfg.postos || []).forEach(function (po) {
      item(menuPosto, po.nome, '', function () { est.posto = po; est.funcao = null; mudou(); });
    });
    lugar.appendChild(el);
    desenhar();
    return { valor: function () { return { posto: est.posto, funcao: est.funcao }; } };
  }

  window.RosterWork.escalasPainelQuem = { montar: montar, carregando: carregando, falha: falha, onde: onde, gruposDaVaga: gruposDaVaga, lugares: lugares };
})();
