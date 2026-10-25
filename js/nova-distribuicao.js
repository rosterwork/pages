/* ============================================================
   NOVA DISTRIBUIÇÃO — entrada da página (protótipo, só programador)
   Carrega a unidade (a distribuição em vigor ou a mudança agendada),
   guarda as respostas em edição, pede as contas ao banco a cada
   mudança (a resposta mais nova vence; com a outra versão para
   comparar, o banco diz o que muda) e desenha o menu dos 9 blocos,
   o corpo e o rodapé. Os blocos moram em -postos (1), -efetivo (2),
   -funcoes (3), -blocos (4 a 7), -militares (8) e -conferir (9); as
   peças comuns em -pecas; o aviso da mudança agendada, o Salvar com
   a data e o começo da unidade em -versoes. Cancelar e a unidade
   moram aqui. Não grava no Histórico.
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
      sujo: false, sujoCia: false, bloco: 0, aberto: null,
      vendoAgendada: false,                       /* a tela mostra a mudança agendada */
      renomeadas: { unidade: [], companhia: [] },  /* prefixos trocados ainda não salvos: [[velho, novo]] */
      focar: null                                  /* o campo que ganha o foco depois do redesenho */
    };
  }

  function D() { return RosterWork.novaDistribuicaoDados; }
  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function G() { return RosterWork.mensagens.geral; }
  function B() { return RosterWork.mensagens.botoes; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function C() { return RosterWork.novaDistribuicaoConferir; }
  function V() { return RosterWork.novaDistribuicaoVersoes; }
  function el(id) { return document.getElementById(id); }
  function copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function ehPelotao() { return !!(E.dados && E.dados.unidade.tipo === 'PEL'); }
  function montada() { return !!el('nova-distribuicao-corpo'); }

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

  /* ---------- carregar e calcular ---------- */

  /* versaoId = a mudança agendada; sem ela, a distribuição em vigor */
  function carregar(unidadeId, versaoId) {
    var meu = ++tokenCarga;
    P().mostrarNoCorpo('carregando');
    return D().ler(unidadeId, versaoId).then(function (r) {
      if (meu !== tokenCarga || !montada()) return;
      if (!r || !r.success) { P().mostrarNoCorpo('falha', (r && r.error) || G().falhaCarregar); return; }
      var bloco = E.bloco;
      E = novoEstado();
      E.bloco = bloco;
      E.dados = r;
      E.unidadeId = r.unidade.id;
      E.periodo = r.atual;
      E.vendoAgendada = !!(r.atual && r.atual.agendada);
      E.resp = r.atual ? copia(r.atual.respostas) : null;
      E.companhia = r.companhia;
      E.respCia = r.companhia && r.companhia.periodo ? copia(r.companhia.periodo.respostas) : null;
      invalidos = {};
      desenharBarra();
      if (!E.periodo) { desenharSemRespostas(); return; }
      return recalcular();
    }, function () {
      if (meu === tokenCarga && montada()) P().mostrarNoCorpo('falha', G().semConexao);
    });
  }

  /* a outra versão, para o banco dizer o que muda: vendo a em vigor, a agendada; vendo a agendada, a em vigor */
  function outraVersao() {
    if (E.vendoAgendada) return E.dados.em_vigor ? E.dados.em_vigor.respostas : null;
    return E.dados.agendada ? E.dados.agendada.respostas : null;
  }

  function recalcular() {
    var meu = ++tokenConta;
    var par = C().parametros(E.unidadeId);
    var conta = D().calcular(E.unidadeId, E.resp, par.efetivos, par.simulacao, outraVersao());
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
     escolher e onde ficam as funções especiais) vão junto; o banco recebe a troca no Salvar (para
     as substituições dela e a mudança agendada irem junto) */
  function renomear(lado, indice, velho, novo) {
    if (velho) {
      var lista = E.renomeadas[lado];
      var antes = lista.filter(function (p) { return p[1] === velho; })[0];
      if (antes) antes[1] = novo; else lista.push([velho, novo]);
      E.renomeadas[lado] = lista.filter(function (p) { return p[0] !== p[1]; });
    }
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
    unidadeId: function () { return E.unidadeId; },
    focarDepois: function (seletor) { E.focar = seletor; },
    abrir: function (id) { E.aberto = E.aberto === id ? null : id; desenhar(); },
    aberto: function () { return E.aberto; },
    dados: function () { return E.dados; },
    copiarCompanhia: function (botao) { V().comecar(contextoVersoes(), E.companhia.unidade.id, botao); },
    /* a viatura está gravada com esse prefixo (a nova ou a de prefixo trocado espera o Salvar) */
    viaturaGravada: function (nome) {
      return !!nome && ((E.periodo.respostas && E.periodo.respostas.viaturas) || []).some(function (v) { return v.nome === nome; });
    },
    /* as substituições da viatura (também as do prefixo de antes, se ele foi trocado e ainda não salvo) */
    substituicoesDe: function (nome) {
      var nomes = [nome].concat(E.renomeadas.unidade.filter(function (p) { return p[1] === nome; }).map(function (p) { return p[0]; }));
      return (E.dados.substituicoes || []).filter(function (s) { return nomes.indexOf(s.viatura) >= 0; });
    },
    /* depois de gravar uma substituição: só a lista delas é lida de novo (o que não foi salvo continua) */
    recarregarSubstituicoes: function () {
      D().ler(E.unidadeId, E.periodo.id).then(function (r) {
        if (!r || !r.success || !montada()) return;
        E.dados.substituicoes = r.substituicoes;
        desenhar();
      }, avisarSemConexao);
    },
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
    var agenda = E.dados.agendada ? { data: RosterWork.data.isoParaBR(E.dados.agendada.inicio), vendo: E.vendoAgendada } : null;
    var u = {
      lado: 'unidade', ehCia: !ehPelotao(), nome: E.dados.unidade.nome, resp: E.resp, calc: E.calc,
      soLeitura: !!E.periodo.somente_leitura, agenda: agenda
    };
    if (!ehPelotao()) return [u];
    var c = E.companhia || {};
    /* vendo a mudança agendada do pelotão, a parte da companhia só se lê */
    return [{
      lado: 'companhia', ehCia: true, nome: c.unidade ? c.unidade.nome : '', resp: E.respCia, calc: E.calcCia,
      soLeitura: E.vendoAgendada || !!(c.periodo && c.periodo.somente_leitura), semDados: !c.periodo || !E.calcCia
    }, u];
  }

  /* blocos prontos; no pelotão, Funções especiais e Conferir dependem também da companhia */
  function prontos() {
    var r = ((E.calc && E.calc.prontos) || []).slice(0, 9);
    if (ehPelotao()) {
      var daCia = !!(E.calcCia && E.calcCia.prontos && E.calcCia.prontos[2]);
      r[2] = !!(r[2] && daCia);
      r[8] = !!(r[8] && daCia);
    }
    if (Object.keys(invalidos).length) { r[0] = false; r[8] = false; }
    return r;
  }

  /* o menu: o sinal de pronto ou de falta e, no bloco que muda na mudança agendada, o calendário */
  function desenharMenu() {
    var pr = prontos();
    var lista = el('nova-distribuicao-blocos');
    var blocosMudam = ((E.calc && E.calc.diferencas) || []).map(function (d) { return d.bloco; });
    var dica = E.dados && E.dados.agendada
      ? (E.vendoAgendada ? M().blocoDiferente : P().texto(M().blocoMuda, { data: RosterWork.data.isoParaBR(E.dados.agendada.inicio) })) : '';
    lista.classList.toggle('oculto', !E.periodo);
    lista.querySelectorAll('.nova-distribuicao-bloco').forEach(function (botao) {
      var n = Number(botao.getAttribute('data-bloco'));
      var muda = botao.querySelector('.nova-distribuicao-bloco-muda');
      botao.classList.toggle('lista-item--ativo', n === E.bloco);
      botao.querySelector('.nova-distribuicao-bloco-pronto').classList.toggle('oculto', !pr[n]);
      botao.querySelector('.nova-distribuicao-bloco-falta').classList.toggle('oculto', !!pr[n]);
      muda.classList.toggle('oculto', blocosMudam.indexOf(n) < 0);
      muda.setAttribute('data-dica', dica);
    });
    el('nova-distribuicao-contagem').textContent = E.periodo ? P().texto(M().contagem, { n: pr.filter(Boolean).length }) : '';
  }

  /* o resumo dos erros no alto (cada um aparece também no campo dele) */
  function resumoErros(conteudo) {
    var erros = ((E.calc && E.calc.erros) || []).concat(ehPelotao() && E.calcCia ? E.calcCia.erros || [] : [])
      .map(function (e) { return e.texto; });
    if (Object.keys(invalidos).length) erros.unshift(M().prefixoInvalido);
    P().resumoErros(conteudo, erros);
  }

  function desenharCorpo() {
    var corpo = el('nova-distribuicao-corpo');
    var rolagem = corpo.scrollTop;
    corpo.textContent = '';
    var conteudo = P().tpl('conteudo');
    var ctxs = contextos();
    var ctx = ctxs[ctxs.length - 1];
    V().aviso(conteudo, contextoVersoes());
    resumoErros(conteudo);
    var R = RosterWork;
    [
      function () { R.novaDistribuicaoPostos.postos(conteudo, ctx, api); },
      function () { R.novaDistribuicaoEfetivo.efetivo(conteudo, ctx, api); },
      function () { R.novaDistribuicaoFuncoes.funcoes(conteudo, ctxs, api); },
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
    if (E.focar) {
      var alvo = document.querySelector(E.focar);
      E.focar = null;
      if (alvo) alvo.focus();
    }
  }

  /* sem respostas: com postos ou modelos hoje, copia; sem nada hoje, começa em branco */
  function desenharSemRespostas() {
    desenharMenu();
    desenharRodape();
    V().semRespostas(contextoVersoes(), P().mostrarNoCorpo('sem-respostas'));
  }

  /* a barra: a unidade (seletor) */
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
  }

  /* ---------- gravar ---------- */

  /* o que vai para o banco: a unidade e, no pelotão vendo a em vigor, a parte da companhia quando mudou */
  function itensParaSalvar() {
    var itens = [];
    if (E.sujo) itens.push({ periodo_id: E.periodo.id, respostas: E.resp, renomeadas: E.renomeadas.unidade });
    if (E.sujoCia && E.companhia && E.companhia.periodo && !E.vendoAgendada) {
      itens.push({ periodo_id: E.companhia.periodo.id, respostas: E.respCia, renomeadas: E.renomeadas.companhia });
    }
    return itens;
  }

  /* grava com respostas faltando (pendências); valor errado o banco recusa. A data e a prévia: -versoes */
  function salvar() {
    if (!E.periodo || (!E.sujo && !E.sujoCia)) return;
    if (Object.keys(invalidos).length) { RosterWork.avisar({ tipo: 'erro', mensagem: M().corrigirAntes }); return; }
    V().salvar(contextoVersoes(), el('nova-distribuicao-salvar'));
  }

  function cancelar() {
    confirmarDescarte(function () { E.aberto = null; carregar(E.unidadeId, E.vendoAgendada ? E.periodo.id : null); });
  }

  /* o contexto que o aviso, o Salvar e o começo da unidade usam (-versoes) */
  function contextoVersoes() {
    return {
      dados: E.dados, unidadeId: E.unidadeId, vendoAgendada: E.vendoAgendada, itens: itensParaSalvar,
      carregar: function (versaoId) { E.aberto = null; carregar(E.unidadeId, versaoId); },
      confirmar: confirmarDescarte, falha: avisarFalha, semConexao: avisarSemConexao
    };
  }

  /* ---------- ligar (o fragmento vem novo a cada visita: liga uma vez por elemento) ---------- */

  function ligarUmaVez(elemento, evento, fn) {
    if (!elemento || elemento.dataset.ligado) return;
    elemento.dataset.ligado = '1';
    elemento.addEventListener(evento, fn);
  }

  function ligar() {
    ligarUmaVez(el('nova-distribuicao-salvar'), 'click', salvar);
    ligarUmaVez(el('nova-distribuicao-cancelar'), 'click', cancelar);
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
      P().mostrarNoCorpo('bloqueado');
      return Promise.resolve();
    }
    ligar();
    if (!guardaLigada && RosterWork.guardaSaida) {
      guardaLigada = true;
      RosterWork.guardaSaida.registrar(function () {
        if (!montada()) return false;
        return E.sujo || E.sujoCia || RosterWork.novaDistribuicaoPostos.sujo();
      });
    }
    E.aberto = null;
    return carregar(E.unidadeId);   /* volta para a última unidade vista (na 1ª vez, a do programador) */
  }

  window.RosterWork.paginas['nova-distribuicao'] = { iniciar: iniciar };
})();
