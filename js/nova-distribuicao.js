/* ============================================================
   NOVA DISTRIBUIÇÃO — entrada da página (protótipo, só programador)
   Carrega a unidade e o período, guarda as respostas em edição,
   pede as contas ao banco a cada mudança (a resposta mais nova
   vence) e desenha o menu dos 8 blocos, o corpo e o rodapé. Os
   blocos moram em -postos (1 e 2), -blocos (3 a 6), -militares (7)
   e -conferir (8); as peças comuns em -pecas; o Novo e o Excluir
   período em -periodo. Salvar, Cancelar, a unidade e o período
   moram aqui. Não grava no Histórico (página de teste).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var E = novoEstado();
  var tokenCarga = 0;
  var tokenConta = 0;
  var guardaLigada = false;
  /* prefixos digitados fora do formato: ficam só no campo, em vermelho ({ 'lado:viatura:i': texto }) */
  var invalidos = {};

  function novoEstado() {
    return {
      dados: null, unidadeId: null, periodo: null, resp: null, calc: null,
      companhia: null, respCia: null, calcCia: null,
      sujo: false, sujoCia: false, bloco: 0, aberto: null
    };
  }

  function D() { return RosterWork.novaDistribuicaoDados; }
  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function G() { return RosterWork.mensagens.geral; }
  function B() { return RosterWork.mensagens.botoes; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function el(id) { return document.getElementById(id); }
  function copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function ehPelotao() { return !!(E.dados && E.dados.unidade.tipo === 'PEL'); }
  function montada() { return !!el('nova-distribuicao-corpo'); }

  function C() { return RosterWork.novaDistribuicaoConferir; }

  /* as falhas: o banco recusou (com a frase dele) ou não respondeu (servidor); a rede caiu (sem conexão) */
  function avisarFalha(r) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || G().falhaServidor }); }
  function avisarSemConexao() { RosterWork.avisar({ tipo: 'erro', mensagem: G().semConexao }); }

  /* com edição não salva, confirma o descarte antes de seguir */
  function confirmarDescarte(seguir, aoCancelar) {
    if (!E.sujo && !E.sujoCia) { seguir(); return; }
    RosterWork.confirmar({
      tipo: 'aviso', mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: B().descartar, textoCancelar: B().continuarEditando,
      aoConfirmar: function () { invalidos = {}; seguir(); }, aoCancelar: aoCancelar
    });
  }

  function mostrarNoCorpo(molde, frase) {
    var corpo = el('nova-distribuicao-corpo');
    if (!corpo) return null;
    corpo.textContent = '';
    var no = P().tpl(molde);
    if (no && frase) no.textContent = frase;
    if (no) corpo.appendChild(no);
    return no;
  }

  /* ---------- carregar e calcular ---------- */

  function carregar(unidadeId, periodoId) {
    var meu = ++tokenCarga;
    mostrarNoCorpo('carregando');
    return D().ler(unidadeId, periodoId).then(function (r) {
      if (meu !== tokenCarga || !montada()) return;
      if (!r || !r.success) { mostrarNoCorpo('falha', (r && r.error) || G().falhaCarregar); return; }
      var bloco = E.bloco;
      E = novoEstado();
      E.bloco = bloco;
      E.dados = r;
      E.unidadeId = r.unidade.id;
      E.periodo = r.atual;
      E.resp = r.atual ? copia(r.atual.respostas) : null;
      E.companhia = r.companhia;
      E.respCia = r.companhia && r.companhia.periodo ? copia(r.companhia.periodo.respostas) : null;
      invalidos = {};
      desenharBarra();
      if (!E.periodo) { desenharSemRespostas(); return; }
      return recalcular();
    }, function () {
      if (meu === tokenCarga && montada()) mostrarNoCorpo('falha', G().semConexao);
    });
  }

  function recalcular() {
    var meu = ++tokenConta;
    var par = C().parametros(E.unidadeId);
    var conta = D().calcular(E.unidadeId, E.resp, par.efetivos, par.simulacao);
    var contaCia = ehPelotao() && E.respCia ? D().calcular(E.companhia.unidade.id, E.respCia, null, null) : Promise.resolve(null);
    return Promise.all([conta, contaCia]).then(function (rs) {
      if (meu !== tokenConta || !montada()) return;
      if (!rs[0] || !rs[0].success) { avisarFalha(rs[0]); return; }
      E.calc = rs[0];
      E.resp = rs[0].respostas;
      if (rs[1] && rs[1].success) { E.calcCia = rs[1]; E.respCia = rs[1].respostas; }
      if (C().definirInicioPadrao(E.unidadeId, { calc: E.calc, resp: E.resp }, ehPelotao())) return recalcular();
      desenhar();
    }, function () {
      if (meu === tokenConta && montada()) avisarSemConexao();
    });
  }

  /* ---------- o que os blocos pedem ---------- */

  /* muda as respostas de um lado (a unidade ou a companhia), marca como não salvo e recalcula;
     abrirId abre esse cartão no redesenho */
  function mudar(lado, fn, abrirId) {
    var alvo = lado === 'companhia' ? E.respCia : E.resp;
    if (!alvo) return;
    fn(alvo);
    if (abrirId) E.aberto = abrirId;
    if (lado === 'companhia') E.sujoCia = true; else E.sujo = true;
    desenharRodape();
    recalcular();
  }

  /* a viatura mudou de prefixo: as funções dela (nos acúmulos, na ordem, nos substitutos, em quem
     escolher e onde ficam as funções especiais) vão junto */
  function renomear(lado, indice, velho, novo) {
    mudar(lado, function (x) {
      var r = velho ? JSON.parse(JSON.stringify(x).split('· ' + velho + '"').join('· ' + novo + '"')) : x;
      function trocar(n) { return n === velho ? novo : n; }
      r.viaturas[indice].nome = novo;
      if (velho && r.papel && r.papel.postos) r.papel.postos = r.papel.postos.map(trocar);
      if (velho && r.oficial_postos) r.oficial_postos = r.oficial_postos.map(trocar);
      Object.keys(r).forEach(function (k) { x[k] = r[k]; });
    });
  }

  var api = {
    mudar: mudar,
    renomear: renomear,
    redesenhar: function () { desenhar(); },
    abrir: function (id) { E.aberto = E.aberto === id ? null : id; desenhar(); },
    aberto: function () { return E.aberto; },
    dados: function () { return E.dados; },
    copiarCompanhia: function (botao) { copiar(E.companhia.unidade.id, botao); },
    /* com um argumento, lê o texto guardado; com dois, guarda (null apaga) */
    invalido: function (chave, valor) {
      if (arguments.length < 2) return invalidos.hasOwnProperty(chave) ? invalidos[chave] : null;
      if (valor == null) delete invalidos[chave]; else invalidos[chave] = valor;
      return null;
    },
    /* a lista de viaturas mudou de ordem ou de tamanho: o que foi digitado fora do formato sai */
    esquecerInvalidos: function (lado) {
      Object.keys(invalidos).forEach(function (k) { if (k.indexOf(lado + ':') === 0) delete invalidos[k]; });
    },
    conferir: RosterWork.novaDistribuicaoConferir.api(function () { return E.unidadeId; }, function () { recalcular(); })
  };

  /* ---------- desenhar ---------- */

  function contextos() {
    var u = {
      lado: 'unidade', ehCia: !ehPelotao(), nome: E.dados.unidade.nome, resp: E.resp, calc: E.calc,
      soLeitura: !!E.periodo.somente_leitura
    };
    if (!ehPelotao()) return [u];
    var c = E.companhia || {};
    return [{
      lado: 'companhia', ehCia: true, nome: c.unidade ? c.unidade.nome : '', resp: E.respCia, calc: E.calcCia,
      soLeitura: !!(c.periodo && c.periodo.somente_leitura), semDados: !c.periodo || !E.calcCia
    }, u];
  }

  /* blocos prontos; no pelotão, Funções especiais e Conferir dependem também da companhia */
  function prontos() {
    var r = ((E.calc && E.calc.prontos) || []).slice(0, 8);
    if (ehPelotao()) {
      var daCia = !!(E.calcCia && E.calcCia.prontos && E.calcCia.prontos[1]);
      r[1] = !!(r[1] && daCia);
      r[7] = !!(r[7] && daCia);
    }
    if (Object.keys(invalidos).length) { r[0] = false; r[7] = false; }
    return r;
  }

  function desenharMenu() {
    var pr = prontos();
    var lista = el('nova-distribuicao-blocos');
    lista.classList.toggle('oculto', !E.periodo);
    lista.querySelectorAll('.nova-distribuicao-bloco').forEach(function (botao) {
      var n = Number(botao.getAttribute('data-bloco'));
      botao.classList.toggle('lista-item--ativo', n === E.bloco);
      botao.querySelector('.nova-distribuicao-bloco-pronto').classList.toggle('oculto', !pr[n]);
      botao.querySelector('.nova-distribuicao-bloco-falta').classList.toggle('oculto', !!pr[n]);
    });
    el('nova-distribuicao-contagem').textContent = E.periodo ? P().texto(M().contagem, { n: pr.filter(Boolean).length }) : '';
  }

  /* o resumo dos erros no alto (cada um aparece também no campo dele) */
  function resumoErros(conteudo) {
    var erros = ((E.calc && E.calc.erros) || []).concat(ehPelotao() && E.calcCia ? E.calcCia.erros || [] : [])
      .map(function (e) { return e.texto; });
    if (Object.keys(invalidos).length) erros.unshift(M().prefixoInvalido);
    if (!erros.length) return;
    var nota = P().tpl('erros');
    erros.forEach(function (frase) {
      var linha = P().tpl('erro');
      linha.textContent = frase;
      nota.querySelector('.nova-distribuicao-erros-lista').appendChild(linha);
    });
    conteudo.appendChild(nota);
  }

  function desenharCorpo() {
    var corpo = el('nova-distribuicao-corpo');
    var rolagem = corpo.scrollTop;
    corpo.textContent = '';
    var conteudo = P().tpl('conteudo');
    var ctxs = contextos();
    var ctx = ctxs[ctxs.length - 1];
    if (E.periodo.somente_leitura) conteudo.appendChild(P().tpl('somente-leitura'));
    resumoErros(conteudo);
    var R = RosterWork;
    [
      function () { R.novaDistribuicaoPostos.postos(conteudo, ctx, api); },
      function () { R.novaDistribuicaoPostos.funcoes(conteudo, ctxs, api); },
      function () { R.novaDistribuicaoBlocos.acumulos(conteudo, ctx, api); },
      function () { R.novaDistribuicaoBlocos.ordem(conteudo, ctx, api); },
      function () { R.novaDistribuicaoBlocos.substitutos(conteudo, ctx, api); },
      function () { R.novaDistribuicaoBlocos.escolher(conteudo, ctx, api); },
      function () { R.novaDistribuicaoMilitares.regras(conteudo, ctx, api); },
      function () { R.novaDistribuicaoConferir.desenhar(conteudo, ctx, api); }
    ][E.bloco]();
    corpo.appendChild(conteudo);
    corpo.scrollTop = rolagem;
  }

  function desenharRodape() {
    var rodape = el('nova-distribuicao-rodape');
    if (!rodape) return;
    var sujo = E.sujo || E.sujoCia;
    rodape.classList.toggle('oculto', !E.periodo);
    el('nova-distribuicao-pendente').classList.toggle('oculto', !sujo);
    el('nova-distribuicao-salvar').disabled = !sujo;
    el('nova-distribuicao-cancelar').disabled = !sujo;
  }

  function desenhar() {
    if (!montada() || !E.periodo || !E.calc) return;
    desenharMenu();
    desenharCorpo();
    desenharRodape();
  }

  /* sem respostas: com postos ou modelos hoje, copia; sem nada hoje, começa em branco */
  function desenharSemRespostas() {
    desenharMenu();
    desenharRodape();
    var vazio = mostrarNoCorpo('sem-respostas');
    var hoje = !!E.dados.tem_dados_hoje;
    vazio.querySelectorAll('.nova-distribuicao-sem-respostas-copiar').forEach(function (n) { n.classList.toggle('oculto', !hoje); });
    vazio.querySelectorAll('.nova-distribuicao-sem-respostas-branco').forEach(function (n) { n.classList.toggle('oculto', hoje); });
    vazio.querySelector('.nova-distribuicao-copiar').addEventListener('click', function () { copiar(E.unidadeId, this); });
  }

  /* a barra: a unidade (seletor), o período (setas e lista) e o grupo Administração */
  function desenharBarra() {
    el('nova-distribuicao-barra').classList.remove('oculto');
    var trilho = el('nova-distribuicao-unidades');
    trilho.textContent = '';
    E.dados.unidades.forEach(function (u) {
      var aba = P().tpl('unidade');
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', u.id);
      aba.classList.toggle('aba--ativa', u.id === E.unidadeId);
      trilho.appendChild(aba);
    });

    RosterWork.novaDistribuicaoPeriodo.desenharBarra(E.dados.periodos || [], E.periodo, trocarPeriodo);
  }

  function trocarPeriodo(p) {
    if (!p || (E.periodo && p.id === E.periodo.id)) return;
    confirmarDescarte(function () { E.aberto = null; carregar(E.unidadeId, p.id); });
  }

  function andarPeriodo(passo) {
    var periodos = E.dados.periodos || [];
    var i = periodos.map(function (p) { return p.id; }).indexOf(E.periodo && E.periodo.id);
    trocarPeriodo(periodos[i + passo]);
  }

  /* ---------- gravar ---------- */

  function copiar(unidadeId, botao) {
    confirmarDescarte(function () {
      if (botao) RosterWork.iniciarCarregando(botao);
      D().copiarHoje(unidadeId).then(function (r) {
        if (botao) RosterWork.pararCarregando(botao);
        if (!r || !r.success) { avisarFalha(r); return; }
        RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
        carregar(E.unidadeId, E.periodo && E.periodo.id);
      }, function () {
        if (botao) RosterWork.pararCarregando(botao);
        avisarSemConexao();
      });
    });
  }

  /* grava com respostas faltando (pendências); valor errado o banco recusa */
  function salvar() {
    if (!E.periodo || (!E.sujo && !E.sujoCia)) return;
    if (Object.keys(invalidos).length) { RosterWork.avisar({ tipo: 'erro', mensagem: M().corrigirAntes }); return; }
    var itens = [];
    if (E.sujo) itens.push({ periodo_id: E.periodo.id, respostas: E.resp });
    if (E.sujoCia && E.companhia && E.companhia.periodo) itens.push({ periodo_id: E.companhia.periodo.id, respostas: E.respCia });
    var botao = el('nova-distribuicao-salvar');
    RosterWork.iniciarCarregando(botao);
    D().salvar(itens).then(function (r) {
      RosterWork.pararCarregando(botao);
      if (!r || !r.success) { avisarFalha(r); return; }
      E.sujo = false;
      E.sujoCia = false;
      if (r.log) RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
      carregar(E.unidadeId, E.periodo.id);
    }, function () {
      RosterWork.pararCarregando(botao);
      avisarSemConexao();
    });
  }

  function cancelar() {
    confirmarDescarte(function () { E.aberto = null; carregar(E.unidadeId, E.periodo && E.periodo.id); });
  }

  /* o contexto que o Novo e o Excluir período usam */
  function contextoPeriodo() {
    return {
      dados: E.dados, periodo: E.periodo, unidadeId: E.unidadeId,
      aoTerminar: function (periodoId) { carregar(E.unidadeId, periodoId); },
      falha: avisarFalha, semConexao: avisarSemConexao
    };
  }

  /* ---------- ligar (o fragmento vem novo a cada visita: liga uma vez por elemento) ---------- */

  function ligarUmaVez(elemento, evento, fn) {
    if (!elemento || elemento.dataset.ligado) return;
    elemento.dataset.ligado = '1';
    elemento.addEventListener(evento, fn);
  }

  function ligar() {
    var periodo = RosterWork.novaDistribuicaoPeriodo;
    ligarUmaVez(el('nova-distribuicao-salvar'), 'click', salvar);
    ligarUmaVez(el('nova-distribuicao-cancelar'), 'click', cancelar);
    ligarUmaVez(el('nova-distribuicao-novo-periodo'), 'click', function () {
      if (E.periodo) confirmarDescarte(function () { periodo.abrirNovo(contextoPeriodo()); });
    });
    ligarUmaVez(el('nova-distribuicao-excluir-periodo'), 'click', function () {
      if (E.periodo) confirmarDescarte(function () { periodo.excluir(contextoPeriodo()); });
    });
    ligarUmaVez(el('nova-distribuicao-periodo-anterior'), 'click', function () { andarPeriodo(-1); });
    ligarUmaVez(el('nova-distribuicao-periodo-proximo'), 'click', function () { andarPeriodo(1); });
    ligarUmaVez(el('nova-distribuicao-unidades'), 'rosterwork:aba', function (ev) {
      var id = Number(ev.detail.aba.getAttribute('data-unidade'));
      if (id === E.unidadeId) return;
      confirmarDescarte(function () { E.aberto = null; carregar(id); }, desenharBarra);
    });
    document.querySelectorAll('.nova-distribuicao-bloco').forEach(function (botao) {
      ligarUmaVez(botao, 'click', function () {
        E.bloco = Number(botao.getAttribute('data-bloco'));
        E.aberto = null;
        desenhar();
      });
    });
  }

  function iniciar() {
    if (!(RosterWork.sessao.ehProgramador && RosterWork.sessao.ehProgramador())) {
      mostrarNoCorpo('bloqueado');
      return Promise.resolve();
    }
    ligar();
    if (!guardaLigada && RosterWork.guardaSaida) {
      guardaLigada = true;
      RosterWork.guardaSaida.registrar(function () {
        if (!montada()) return false;
        return E.sujo || E.sujoCia || RosterWork.novaDistribuicaoPeriodo.sujo();
      });
    }
    E.aberto = null;
    return carregar(E.unidadeId);   /* volta para a última unidade vista (na 1ª vez, a do programador) */
  }

  window.RosterWork.paginas['nova-distribuicao'] = { iniciar: iniciar };
})();
