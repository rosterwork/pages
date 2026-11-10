/* ============================================================
   EXTRAJORNADA — a edição rápida na célula do calendário
   No Calendário e na Agenda da Distribuição e dos Ajustes, o que é
   rápido se faz no próprio bloco do pelotão, sem abrir o painel do
   dia. O clique no nome abre o cartão dele ali, com a barra de
   horário colada embaixo (com horário, também os campos, o cadeado e
   a lixeira): o mesmo cartão do militar em foco. O clique no
   pelotão, fora dos nomes, marca o bloco e mostra Adicionar militar
   e Abrir o painel do dia; o Adicionar vira o campo de militar (os
   grupos do painel, a bolinha do pedido, o pelotão e as cotas) e,
   escolhido o nome, o cartão dele abre com a barra vazia: só o
   clique no horário põe a extra no rascunho (a função na escala fica
   com a distribuição automática). Quem passa da cota vê no cartão a
   nota e os outros dias dele, para tirar horário (a mesma peça do
   painel do dia). Um aberto por vez; o clique fora e
   o Esc fecham. Com o painel do dia já aberto, ou sem nada a pôr na
   célula (o pedido aberto, a Distribuição lançada ou o dia de mais
   de 7 dias atrás), o clique no pelotão abre o painel, como sempre.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaCelula.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var marcado = null;       // o bloco marcado, com as ações: { uid, k }
  var adicionando = false;  // no bloco marcado, o Adicionar militar virou o campo de militar
  var pendente = null;      // o escolhido no campo, à espera do horário: { uid, k, cpf }
  var aberto = null;        // o cartão aberto: { uid, k, cpf } (a barra dele é a escolhida até outra ser mexida)
  var ligado = false;       // o clique fora e o Esc, ligados uma vez

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function G() { return RW.extrajornadaGrade; }
  function B() { return RW.extrajornadaBarra; }
  function dia() { return RW.extrajornadaDia; }
  function porDia() { return RW.extrajornadaPorDia; }
  function chave(k, cpf) { return cpf + '|' + k + '|calendario'; }
  function noCalendario() { return B().escolhida().split('|')[2] === 'calendario'; }

  /* pela célula: tirar e mudar o horário; pôr, só sem o pedido aberto */
  function editavel(k) { return !G().soLeitura() && !G().antigo(k); }
  function podePor(k) { return editavel(k) && !G().travado(); }

  /* o clique e o Enter (ou o espaço) num cartão ou numa bolinha */
  function ligarClique(el, fazer) {
    el.classList.add('extrajornada-escolhivel');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', fazer);
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fazer(); } });
  }

  function estaAberto(uid, k, cpf) { return !!aberto && aberto.uid === uid && aberto.k === k && aberto.cpf === cpf; }
  function temAlgo() { return !!marcado || !!pendente || !!aberto; }

  /* fecha tudo (o bloco marcado, o campo, o escolhido sem horário e o cartão aberto) e refaz os dias que mudaram */
  function fechar() {
    var dias = [];
    [marcado, pendente, aberto].forEach(function (x) { if (x && dias.indexOf(x.k) < 0) dias.push(x.k); });
    marcado = null; adicionando = false; pendente = null; aberto = null;
    /* a barra escolhida no calendário (a do cartão ou a de um dos outros dias dele) deixa de ser a escolhida */
    if (noCalendario()) B().escolher('');
    dias.forEach(function (k) { porDia().atualizarDia(k); });
  }

  /* o cartão do militar no bloco abre, com a barra embaixo (o de antes fecha) */
  function abrir(uid, k, cpf) {
    fechar();
    aberto = { uid: uid, k: k, cpf: cpf };
    B().escolher(chave(k, cpf));
    porDia().atualizarDia(k);
  }

  /* a barra de horário colada embaixo do cartão aberto (a vaga ou a bolinha do foco), na cor do pedido; onde ele tem
     horário, também os campos, o cadeado e a lixeira (mexida a barra de outro dia, o clique no cartão volta a escolher a
     dele). Passou da cota: embaixo, a nota e os outros dias dele, para tirar horário (a mesma peça do painel do dia).
     desligado: só para ver. Devolve a linha da barra */
  function barraEmbaixo(cartao, m, k, uid, blocos, desligado) {
    cartao.classList.add('extrajornada-cartao--aberto');
    var linha = RW.tpl('tpl-extrajornada-cartao-barra'), pref = u().pref(m, k);
    if (pref !== 'sem') linha.classList.add('extrajornada-cartao-barra--' + pref);
    dia().ligarMarcas(linha.querySelector('.extrajornada-painel-marcas'), m, k, blocos, uid, { desligado: !!desligado, campos: true, lugar: 'calendario', linha: cartao });
    var passou = G().usadas(m.cpf) - (m.concedidas || 0);
    if (passou > 0 && !desligado) RW.extrajornadaDiaOutros.listar(linha, m, k, passou, true);
    cartao.parentNode.insertBefore(linha, cartao.nextSibling);
    return linha;
  }

  /* o clique no pelotão, fora dos nomes: marca o bloco e mostra as ações. Com o painel do dia aberto, ele troca de dia;
     sem nada a pôr na célula, abre o painel */
  function cliqueNoBloco(uid, k) {
    if (dia().aberto() || !podePor(k)) { fechar(); dia().abrir(uid, k); return; }
    if (marcado && marcado.uid === uid && marcado.k === k && !adicionando) return;
    fechar();
    marcado = { uid: uid, k: k };
    porDia().atualizarDia(k);
  }

  /* um nome da lista do campo: a bolinha do pedido, o posto e o nome; à direita, o pelotão e as cotas */
  function item(x) {
    var el = RW.tpl('tpl-extrajornada-adicionar-item');
    var ponto = el.querySelector('.extrajornada-painel-ponto');
    if (x.grupo === 'querem') ponto.classList.add('extrajornada-painel-ponto--quer');
    if (x.grupo === 'naoQuerem') ponto.classList.add('extrajornada-painel-ponto--nao');
    el.querySelector('.combo-militar-grad').textContent = x.grad || '';
    el.querySelector('.combo-militar-guerra').textContent = x.nome || '';
    el.querySelector('.combo-militar-info').textContent = x.info;
    return el;
  }

  /* o campo do Adicionar militar: os grupos do painel do dia (quem já está no dia ou não pode fica fora), todos abertos;
     em cada grupo, quem ainda tem cota primeiro, depois o pelotão do bloco, depois o nome */
  function campo(uid, k) {
    var caixa = RW.tpl('tpl-extrajornada-adicionar');
    var inp = caixa.querySelector('input'), menu = caixa.querySelector('.dropdown-menu');
    var alocs = G().efetivas(), grupos = { querem: [], disp: [], naoQuerem: [] }, lista = [];
    G().voluntarios().forEach(function (m) {
      var g = dia().grupoDe(m, uid, k).nome;
      if (grupos[g]) grupos[g].push({ cpf: m.cpf, grad: m.grad, nome: m.nome, grupo: g, m: m, usou: G().usadas(m.cpf, alocs) });
    });
    ['querem', 'disp', 'naoQuerem'].forEach(function (g) {
      if (!grupos[g].length) return;
      grupos[g].sort(function (a, b) {
        var temA = a.usou < (a.m.concedidas || 0), temB = b.usou < (b.m.concedidas || 0);
        return (temB - temA) || ((b.m.unidade_id === uid) - (a.m.unidade_id === uid)) || a.nome.localeCompare(b.nome);
      });
      lista.push({ titulo: msg().grupos[g], aberto: true });
      grupos[g].forEach(function (x) {
        x.info = ((u().unidade(x.m.unidade_id) || {}).nome || '') + ' · ' + msg().deCotas(x.usou, x.m.concedidas || 0);
        lista.push(x);
      });
    });
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return null; },
      aoEscolher: function (x) { escolher(uid, k, x.cpf); },
      criarItem: item,
      textos: { selecione: msg().pesquisarMilitar, semNinguem: msg().ninguemParaPor, filtroVazio: msg().ninguemEncontrado }
    });
    combo.preencher(lista);
    /* o campo abre com a lista depois que o bloco volta à tela */
    requestAnimationFrame(function () { if (!inp.isConnected || inp.disabled) return; inp.focus(); combo.abrir(); });
    return caixa;
  }

  /* as ações do bloco marcado: Adicionar militar (ou o campo, já aberto) e Abrir o painel do dia */
  function acoes(cel, uid, k) {
    var caixa = RW.tpl('tpl-extrajornada-bloco-acoes');
    var adicionar = caixa.querySelector('[data-acao="adicionar"]');
    caixa.querySelector('[data-acao="painel"]').addEventListener('click', function () { fechar(); dia().abrir(uid, k); });
    if (adicionando) caixa.replaceChild(campo(uid, k), adicionar);
    else adicionar.addEventListener('click', function () { adicionando = true; porDia().atualizarDia(k); });
    cel.appendChild(caixa);
  }

  /* escolhido o nome: o cartão dele entra no bloco e abre com a barra vazia; nada muda até o clique no horário */
  function escolher(uid, k, cpf) {
    fechar();
    pendente = { uid: uid, k: k, cpf: cpf };
    aberto = { uid: uid, k: k, cpf: cpf };
    B().escolher(chave(k, cpf));
    porDia().atualizarDia(k);
  }

  /* o clique fora dos blocos do calendário e o Esc fecham tudo (ligados uma vez; só com algo aberto na página). O clique
     num bloco fica com ele (o pelotão, os cartões e as ações); a lista do campo, o aviso e o passo a passo não fecham */
  function ligar() {
    if (ligado) return;
    ligado = true;
    document.addEventListener('click', function (ev) {
      if (!temAlgo() || !document.querySelector('#p3-cal')) return;
      if (ev.target.closest('#p3-cal [data-uid], .dropdown-menu, .modal-veu, .guia-balao, .guia-vidro, .treino-barra')) return;
      fechar();
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || !temAlgo() || !document.querySelector('#p3-cal')) return;
      if (document.querySelector('.dropdown--aberto, .modal-veu--aberto') || dia().aberto()) return;
      fechar();
    });
  }

  /* a célula do bloco (extrajornada-por-dia.js, depois das vagas, fora do foco): os nomes que abrem o cartão, o cartão
     aberto com a barra, o escolhido à espera do horário e, no bloco marcado, a marca e as ações. curto: o posto curto
     da célula pequena do Calendário */
  function decorar(cel, uid, k, curto) {
    ligar();
    if (editavel(k)) {
      Array.prototype.forEach.call(cel.querySelectorAll('.extrajornada-vaga[data-cpf]'), function (cartao) {
        var cpf = cartao.getAttribute('data-cpf'), m = u().militar(cpf), v = G().vagaDe(cpf, k);
        if (!m) return;
        if (estaAberto(uid, k, cpf)) barraEmbaixo(cartao, m, k, uid, v ? G().blocos(v) : [], false);
        else ligarClique(cartao, function () { abrir(uid, k, cpf); });
      });
      if (pendente && pendente.uid === uid && pendente.k === k) {
        var m = u().militar(pendente.cpf);
        if (!m || G().vagaDe(pendente.cpf, k)) pendente = null;
        else {
          var novo = u().vaga({ cpf: m.cpf, unidade: uid, data: k, blocos: [], origem: 'admin' }, uid, curto);
          novo.classList.remove('extrajornada-vaga--sai');
          novo.removeAttribute('data-dica');
          cel.appendChild(novo);
          barraEmbaixo(novo, m, k, uid, [], false);
        }
      }
    }
    if (marcado && marcado.uid === uid && marcado.k === k) {
      cel.classList.add('escala-mes-celula--selecionada');
      acoes(cel, uid, k);
    }
  }

  RW.extrajornadaCelula = {
    decorar: decorar,
    cliqueNoBloco: cliqueNoBloco,
    abrir: abrir,
    estaAberto: estaAberto,
    barraEmbaixo: barraEmbaixo,
    ligarClique: ligarClique,
    marcado: function (uid, k) { return !!marcado && marcado.uid === uid && marcado.k === k; },
    /* o bloco marcado ou o do cartão aberto, que fica à vista quando cresce (extrajornada-por-dia.js) */
    ativo: function () {
      if (marcado) return { uid: marcado.uid, data: marcado.k };
      return aberto ? { uid: aberto.uid, data: aberto.k } : null;
    },
    /* outro dia no painel, o Salvar, o Cancelar ou a sugestão: nada fica marcado nem aberto (quem chama refaz a tela) */
    esquecer: function () { marcado = null; adicionando = false; pendente = null; aberto = null; }
  };
})();
