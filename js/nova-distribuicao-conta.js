/* ============================================================
   NOVA DISTRIBUIÇÃO — as contas (a aba Distribuição dos Ajustes)
   Abre a unidade (a leitura com a forma e as etapas) e pede ao banco
   a conta das respostas a cada mudança: a mais nova vence. A tabela
   do Conferir (as colunas de efetivo, a simulação ou o dia) vai só
   com o bloco Conferir aberto; nos outros blocos a conta vem sem
   ela, bem mais leve, e abrir o Conferir pede a conta com a tabela
   (a forma, como na abertura). Enquanto a conta de uma mudança não
   chega, passando de 0,3 s, o rodapé largo diz "Fazendo as contas".
   A resposta redesenha a tela; com uma lista aberta, um campo de
   texto em uso ou o botão do mouse apertado no corpo, espera ficar
   livre (a lista não some na mão de quem a abriu, o que se digita e
   o clique não se perdem). A página (nova-distribuicao.js) se liga
   uma vez: ligar(pagina).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var BLOCO_CONFERIR = 8;   // o data-bloco do Conferir
  var LINHA_MS = 300;       // a conta de uma mudança que passa disso mostra a frase no rodapé

  var pagina = null;                          // o que a página empresta (ligar)
  var tokenCarga = 0, tokenConta = 0;
  var espera = null, corpoEsperando = null;   // a leitura na tela (geral-etapas.js)
  var comTabela = false;                      // a última conta veio com a tabela do Conferir
  var linha = null, relogioLinha = null;      // a frase do rodapé
  var esperandoLivre = false;                 // a resposta espera o corpo ficar livre para desenhar
  var apertado = false;                       // o botão do mouse está apertado

  function D() { return RosterWork.novaDistribuicaoDados; }
  function C() { return RosterWork.novaDistribuicaoConferir; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function G() { return RosterWork.mensagens.geral; }
  function E() { return pagina.estado(); }
  function el(id) { return document.getElementById(id); }

  /* ---------- abrir a unidade ---------- */

  /* versaoId = a mudança agendada; sem ela, a distribuição em vigor. O ritmo vem junto (o bloco 1). gravou: a leitura
     depois de gravar, com o cartão das etapas na frente (-versoes): o que está na tela fica até o novo chegar */
  function carregar(unidadeId, versaoId, gravou) {
    var meu = ++tokenCarga;
    pararLinha();
    esperandoLivre = false;
    comTabela = false;
    /* o que está na tela fica 0,5 s, sem responder; depois, a forma e, de 1,5 s, as etapas (geral-etapas.js); o que for
       desenhado espera o que apareceu cumprir o mínimo na tela */
    pararEspera();
    corpoEsperando = el('nova-distribuicao-corpo');
    corpoEsperando.inert = true;
    el('nova-distribuicao-blocos').classList.add('nova-distribuicao-blocos--lendo');
    espera = RosterWork.etapas.area(corpoEsperando, gravou ? {}
      : { forma: 'tpl-nova-distribuicao-carregando', etapas: 'ajustesAbrir', valores: { unidade: nomeDaUnidade(unidadeId) }, doServidor: 1 });
    function terminou() { if (meu === tokenCarga) pararEspera(); }
    function depois(desenhar) {
      var esta = espera;
      return (esta ? esta.segurar() : Promise.resolve()).then(function () { if (meu === tokenCarga && pagina.montada()) desenhar(); });
    }
    return Promise.all([D().ler(unidadeId, versaoId), D().ritmos()]).then(function (rs) {
      var r = rs[0];
      if (meu !== tokenCarga || !pagina.montada()) return;
      if (!r || !r.success) return depois(function () { pararEspera(); P().mostrarNoCorpo('falha', (r && r.error) || G().falhaCarregar); });
      /* as contas de cada posto, a 2ª etapa */
      espera.ir(1);
      if (!pagina.receber(r, rs[1])) return depois(function () { pararEspera(); pagina.desenharSemRespostas(); });
      return recalcular();
    }, function () {
      if (meu === tokenCarga && pagina.montada()) return depois(function () { pararEspera(); P().mostrarNoCorpo('falha', G().semConexao); });
    }).then(terminou, terminou);
  }

  function pararEspera() {
    if (espera) espera.parar();
    espera = null;
    if (corpoEsperando) corpoEsperando.inert = false;
    corpoEsperando = null;
  }

  /* o nome da unidade nas etapas: a que já está lida ou, na 1ª vez, a do administrador */
  function nomeDaUnidade(unidadeId) {
    var lista = (E().dados && E().dados.unidades) || [];
    var u = lista.filter(function (x) { return String(x.id) === String(unidadeId); })[0];
    if (u) return u.nome;
    if (unidadeId != null) return '';
    var perfil = RosterWork.sessao.perfil();
    return perfil && perfil.lotacao_path ? perfil.lotacao_path.split('/').pop().trim() : '';
  }

  /* ---------- a conta ---------- */

  /* a outra versão, para o banco dizer o que muda: vendo a em vigor, a agendada; vendo a agendada, a em vigor */
  function outraVersao() {
    var e = E();
    if (e.vendoAgendada) return e.dados.em_vigor ? e.dados.em_vigor.respostas : null;
    return e.dados.agendada ? e.dados.agendada.respostas : null;
  }

  /* pede a conta das respostas (no pelotão, também a da companhia); a tabela do Conferir só com ele aberto. Na abertura
     (e ao abrir o Conferir) a conta espera a forma cumprir o mínimo e desenha; numa mudança, mostra a frase no rodapé e
     desenha quando o corpo estiver livre */
  function recalcular() {
    var meu = ++tokenConta;
    var e = E();
    var tabela = e.bloco === BLOCO_CONFERIR;
    var par = tabela ? C().parametros(e.unidadeId) : { efetivos: null, simulacao: null };
    var conta = D().calcular(e.unidadeId, e.resp, par.efetivos, par.simulacao, outraVersao());
    var contaCia = pagina.ehPelotao() && e.respCia ? D().calcular(e.companhia.unidade.id, e.respCia, null, null) : Promise.resolve(null);
    var contas = Promise.all([conta, contaCia]);
    var naLeitura = !!espera;
    if (!naLeitura) mostrarLinha();
    return (naLeitura ? espera.segurar(contas) : contas).then(function (rs) {
      if (meu !== tokenConta || !pagina.montada()) return;
      pararLinha();
      var agora = E();
      if (!rs[0] || !rs[0].success) { pagina.avisarFalha(rs[0]); if (naLeitura) pagina.desenhar(); return; }
      comTabela = tabela;
      agora.calc = rs[0];
      agora.resp = rs[0].respostas;
      if (agora.base == null) agora.base = pagina.emTexto(agora.resp);
      if (rs[1] && rs[1].success) {
        agora.calcCia = rs[1];
        agora.respCia = rs[1].respostas;
        if (agora.baseCia == null) agora.baseCia = pagina.emTexto(agora.respCia);
      }
      /* a tabela começa nas funções de mínimo com pessoa própria; com o Conferir aberto (também o que abriu durante a
         conta), ela vem de novo, com a tabela */
      var definiu = C().definirInicioPadrao(agora.unidadeId, { calc: agora.calc, resp: agora.resp }, pagina.ehPelotao());
      if (agora.bloco === BLOCO_CONFERIR && (definiu || !tabela)) return recalcular();
      if (naLeitura) pagina.desenhar(); else desenharQuandoLivre();
    }, function () {
      if (meu !== tokenConta) return;
      pararLinha();
      if (!pagina.montada()) return;
      pagina.avisarSemConexao();
      if (naLeitura) pagina.desenhar();
    });
  }

  /* o Conferir aberto pede a tabela que a última conta não trouxe */
  function faltaTabela() { return E().bloco === BLOCO_CONFERIR && !comTabela && !!E().calc; }

  /* abre o Conferir: a conta com a tabela, com a forma no corpo (até 0,5 s nada muda); o bloco começa do alto. Com a
     abertura em curso, ela mesma pede a tabela */
  function pedirTabela() {
    if (espera) return;
    var meu = ++tokenCarga;
    pararLinha();
    corpoEsperando = el('nova-distribuicao-corpo');
    corpoEsperando.inert = true;
    espera = RosterWork.etapas.area(corpoEsperando, { forma: 'tpl-nova-distribuicao-carregando' });
    function terminou() { if (meu === tokenCarga) pararEspera(); }
    recalcular().then(function () {
      if (meu === tokenCarga && pagina.montada()) el('nova-distribuicao-corpo').scrollTop = 0;
    }).then(terminou, terminou);
  }

  /* ---------- a frase do rodapé ---------- */

  /* no lugar do "Alterações não salvas.", só se a conta passar de LINHA_MS; a conta mais nova continua a mesma frase */
  function mostrarLinha() {
    if (linha || relogioLinha) return;
    relogioLinha = setTimeout(function () {
      relogioLinha = null;
      var pendente = el('nova-distribuicao-pendente'), lugar = el('nova-distribuicao-contando');
      if (!pendente || !lugar) return;
      pendente.classList.add('oculto');
      lugar.classList.remove('oculto');
      linha = RosterWork.etapas.linha(lugar, 'ajustesConta');
    }, LINHA_MS);
  }

  function pararLinha() {
    clearTimeout(relogioLinha);
    relogioLinha = null;
    if (linha) linha.parar();
    linha = null;
    var pendente = el('nova-distribuicao-pendente'), lugar = el('nova-distribuicao-contando');
    if (pendente) pendente.classList.remove('oculto');
    if (lugar) lugar.classList.add('oculto');
  }

  /* ---------- desenhar com o corpo livre ---------- */

  /* alguém mexe no corpo: uma lista aberta, um campo de texto com o foco ou o botão do mouse apertado */
  function corpoOcupado() {
    var corpo = el('nova-distribuicao-corpo');
    if (!corpo) return false;
    if (apertado || corpo.querySelector('.dropdown--aberto')) return true;
    var ativo = document.activeElement;
    return !!(ativo && corpo.contains(ativo) && ativo.matches('input:not([type="radio"]):not([type="checkbox"]), textarea'));
  }

  function desenharQuandoLivre() {
    if (corpoOcupado()) { esperandoLivre = true; return; }
    esperandoLivre = false;
    pagina.desenhar();
  }

  /* depois do gesto (o clique, a tecla, o foco que sai), confere de novo; o foco pedido antes já não vale (quem mexia
     seguiu adiante) */
  function tentarDesenhar() {
    if (!esperandoLivre) return;
    setTimeout(function () {
      if (!esperandoLivre || !pagina.montada() || corpoOcupado()) return;
      esperandoLivre = false;
      pagina.esquecerFoco();
      pagina.desenhar();
    }, 0);
  }

  document.addEventListener('pointerdown', function () { apertado = true; }, true);
  ['pointerup', 'pointercancel'].forEach(function (tipo) {
    document.addEventListener(tipo, function () { apertado = false; tentarDesenhar(); }, true);
  });
  ['click', 'keyup', 'focusout'].forEach(function (tipo) { document.addEventListener(tipo, tentarDesenhar); });

  window.RosterWork.novaDistribuicaoConta = {
    ligar: function (p) { pagina = p; },
    carregar: carregar,
    recalcular: recalcular,
    faltaTabela: faltaTabela,
    pedirTabela: pedirTabela
  };
})();
