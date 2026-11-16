/* ============================================================
   DISTRIBUIÇÃO (nova-distribuicao) — a aba Distribuição dos Ajustes
   (só administrador; o ajustes.js chama o iniciar e o sairDaAba)
   Guarda a unidade lida (a em vigor ou a mudança agendada), o ritmo
   e as respostas em edição; cada mudança aparece na hora e pede a
   conta ao banco (-conta: abrir a unidade, a conta a cada mudança, a
   resposta mais nova vence; com a outra versão, o banco diz o que
   muda); desenha o menu dos 11 blocos, o corpo e o rodapé.
   Blocos: -ritmo (1), -postos (2), -efetivo (3), -funcoes
   (4), -acumulos (5 e 6), -blocos (7 e 8), -militares (9),
   -graduacao (10), -conferir (11); peças comuns em -pecas; as
   mudanças dos postos com data em -caixas; o aviso, o Salvar com a
   data e o começo da unidade em -versoes. Cancelar e a unidade
   moram aqui. O banco grava no Histórico a cada Salvar.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var E = novoEstado();
  var guardaLigada = false;
  /* prefixos digitados fora do formato: ficam só no campo, em vermelho ({ 'lado:viatura:i': texto }) */
  var invalidos = {};

  function novoEstado() {
    return {
      dados: null, unidadeId: null, periodo: null, resp: null, calc: null,
      companhia: null, respCia: null, calcCia: null,
      sujo: false, sujoCia: false, bloco: 9, aberto: null,   /* abre no 1º da lista, o Ritmo (data-bloco 9) */
      base: null, baseCia: null,   /* as respostas de abertura (as arrumadas pela 1ª conta), em texto, para saber se mudou */
      vendoAgendada: false,                       /* a tela mostra a mudança agendada */
      renomeadas: { unidade: [], companhia: [] },  /* prefixos trocados ainda não salvos: [[velho, novo]] */
      focar: null                                  /* o campo que ganha o foco depois do redesenho */
    };
  }

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function G() { return RosterWork.mensagens.geral; }
  function B() { return RosterWork.mensagens.botoes; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function V() { return RosterWork.novaDistribuicaoVersoes; }
  function Rt() { return RosterWork.novaDistribuicaoRitmo; }
  function Conta() { return RosterWork.novaDistribuicaoConta; }
  function el(id) { return document.getElementById(id); }
  function copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function ehPelotao() { return !!(E.dados && E.dados.unidade.tipo === 'PEL'); }
  function montada() { return !!el('nova-distribuicao-corpo'); }

  /* as falhas: o banco recusou (com a frase dele) ou não respondeu (servidor); a rede caiu (sem conexão) */
  function avisarFalha(r) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || G().falhaServidor }); }
  function avisarSemConexao() { RosterWork.avisar({ tipo: 'erro', mensagem: G().semConexao }); }

  /* as respostas em texto, sem depender da ordem das chaves (as listas mantêm a ordem) */
  function emTexto(v) {
    function ordenar(x) {
      if (Array.isArray(x)) return x.map(ordenar);
      if (x && typeof x === 'object') return Object.keys(x).sort().reduce(function (o, k) { o[k] = ordenar(x[k]); return o; }, {});
      return x;
    }
    return JSON.stringify(ordenar(v));
  }

  /* as respostas de um lado (a unidade ou a companhia) estão diferentes das de abertura? Desfazer tudo volta a "não" */
  function mudouLado(lado) {
    var cia = lado === 'companhia';
    if (!(cia ? E.sujoCia : E.sujo)) return false;   /* nunca mexeu */
    var base = cia ? E.baseCia : E.base;
    return base == null || emTexto(cia ? E.respCia : E.resp) !== base;
  }

  /* edição não salva: as respostas da unidade, as da companhia, as substituições ou o ritmo */
  function temEdicao() {
    return mudouLado('unidade') || mudouLado('companhia') || RosterWork.novaDistribuicaoCaixas.temRascunho() || Rt().mudou();
  }

  /* com edição não salva, confirma o descarte antes de seguir */
  function confirmarDescarte(seguir, aoCancelar) {
    if (!temEdicao()) { seguir(); return; }
    RosterWork.confirmar({
      tipo: 'aviso', mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: B().descartar, textoCancelar: B().continuarEditando,
      aoConfirmar: function () { invalidos = {}; RosterWork.novaDistribuicaoCaixas.descartar(); Rt().descartar(); seguir(); }, aoCancelar: aoCancelar
    });
  }

  /* ---------- a unidade lida e as contas (-conta) ---------- */

  function carregar(unidadeId, versaoId, gravou) { return Conta().carregar(unidadeId, versaoId, gravou); }
  function recalcular() { return Conta().recalcular(); }

  /* a leitura chegou: o estado novo (o bloco aberto fica), o rascunho das substituições e o ritmo escolhido (salvos ou
     descartados) saem, e a barra mostra a unidade; devolve se a unidade tem respostas */
  function receber(r, ritmos) {
    var bloco = E.bloco;
    RosterWork.novaDistribuicaoCaixas.descartar();
    Rt().iniciar(ritmos, r.unidade.id);
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
    return !!E.periodo;
  }

  /* ---------- o que os blocos pedem ---------- */

  /* muda as respostas de um lado (a unidade ou a companhia), marca como não salvo e recalcula; abrirId abre esse cartão.
     naHora: a tela mostra a mudança já (a conta completa depois); o prefixo digitado, que muda ao sair do campo, espera a
     conta, para o clique que tirou o foco não se perder */
  function alterar(lado, fn, abrirId, naHora) {
    var alvo = lado === 'companhia' ? E.respCia : E.resp;
    if (!alvo) return;
    fn(alvo);
    if (abrirId) E.aberto = abrirId;
    if (lado === 'companhia') E.sujoCia = true; else E.sujo = true;
    if (naHora) desenhar(true); else desenharRodape();
    recalcular();
  }

  function mudar(lado, fn, abrirId) { alterar(lado, fn, abrirId, true); }

  /* a viatura mudou de prefixo: as funções dela (nos acúmulos fixos e por falta, na ordem, em quem
     escolher e onde ficam as funções especiais) vão junto; o banco recebe a troca no Salvar (para
     as substituições dela e a mudança agendada irem junto) */
  function renomear(lado, indice, velho, novo) {
    if (velho) {
      var lista = E.renomeadas[lado];
      var antes = lista.filter(function (p) { return p[1] === velho; })[0];
      if (antes) antes[1] = novo; else lista.push([velho, novo]);
      E.renomeadas[lado] = lista.filter(function (p) { return p[0] !== p[1]; });
    }
    alterar(lado, function (x) {
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
    /* mudou algo que não redesenha a página (a substituição aberta): só o rodapé */
    atualizarRodape: function () { desenharRodape(); },
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
    /* vendo a mudança agendada do pelotão, ou sem ser administrador da companhia, a parte da companhia só se lê */
    return [{
      lado: 'companhia', ehCia: true, nome: c.unidade ? c.unidade.nome : '', resp: E.respCia, calc: E.calcCia,
      soLeitura: E.vendoAgendada || !E.dados.pode_companhia || !!(c.periodo && c.periodo.somente_leitura), semDados: !c.periodo || !E.calcCia
    }, u];
  }

  /* blocos prontos (o Ritmo, data-bloco 9, sempre; as Regras por graduação, data-bloco 10, vêm do banco depois do de
     tudo); no pelotão, Funções especiais e Conferir dependem também da companhia */
  function prontos() {
    var r = ((E.calc && E.calc.prontos) || []).slice(0, 9);
    r[9] = true;
    r[10] = !!(E.calc && E.calc.prontos && E.calc.prontos[9]);
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
    lista.classList.remove('nova-distribuicao-blocos--lendo');
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
    /* o botão do menu dos blocos (no celular) diz o bloco aberto */
    var ativo = lista.querySelector('.lista-item--ativo > span');
    el('nova-distribuicao-bloco-atual').textContent = ativo ? ativo.textContent : '';
    el('nova-distribuicao-blocos-menu').classList.toggle('oculto', !E.periodo);
  }

  /* no celular, os blocos (o painel esquerdo inteiro) moram no menu da barra; fora dele, na lateral. O celular pode girar
     e passar do corte: o resize chama de novo */
  function arrumarBlocos() {
    var lado = el('nova-distribuicao-lado');
    if (!lado) return;   /* a página já saiu */
    var destino = RosterWork.celular && RosterWork.celular()
      ? el('nova-distribuicao-blocos-menu').querySelector('.dropdown-menu')
      : el('nova-distribuicao-layout');
    if (lado.parentElement !== destino) destino.insertBefore(lado, destino.firstChild);
  }

  /* as viaturas novas ainda sem prefixo ('lado:viatura:i'): só acusam quando o campo fica vazio ao sair
     ou no Salvar (então entram nos invalidos) */
  function semPrefixo() { return RosterWork.novaDistribuicaoPostos.semPrefixo(E.resp, ehPelotao() ? E.respCia : null); }

  /* o resumo dos erros no alto (cada um aparece também no campo dele) */
  function resumoErros(conteudo) {
    var vazias = semPrefixo();
    var erros = [['unidade', E.calc]].concat(ehPelotao() ? [['companhia', E.calcCia]] : []).reduce(function (lista, par) {
      return lista.concat(((par[1] && par[1].erros) || []).filter(function (e) { return vazias.indexOf(par[0] + ':' + e.chave) < 0; }));
    }, []).map(function (e) { return e.texto; });
    var digitados = Object.keys(invalidos).map(function (k) { return invalidos[k]; });
    if (digitados.some(Boolean)) erros.unshift(M().prefixoInvalido);
    if (digitados.some(function (d) { return !d; })) erros.unshift(M().prefixoVazio);
    P().resumoErros(conteudo, erros);
  }

  function desenharCorpo() {
    var corpo = el('nova-distribuicao-corpo');
    var rolagem = corpo.scrollTop;
    /* a lista aberta no corpo fecha antes de sair da página (o vigia da rolagem dela se desliga junto) */
    if (corpo.querySelector('.dropdown--aberto') && RosterWork.fecharDropdowns) RosterWork.fecharDropdowns(null);
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
      function () { R.novaDistribuicaoAcumulos.acumulos(conteudo, ctx, api); },
      function () { R.novaDistribuicaoBlocos.ordem(conteudo, ctx, api); },
      function () { R.novaDistribuicaoAcumulos.porFalta(conteudo, ctx, api); },
      function () { R.novaDistribuicaoBlocos.escolher(conteudo, ctx, api); },
      function () { R.novaDistribuicaoMilitares.regras(conteudo, ctx, api); },
      function () { R.novaDistribuicaoConferir.desenhar(conteudo, ctx, api); },
      function () { R.novaDistribuicaoRitmo.ritmo(conteudo, ctx, api); },
      function () { R.novaDistribuicaoGraduacao.regras(conteudo, ctx, api); }
    ][E.bloco]();
    corpo.appendChild(conteudo);
    corpo.scrollTop = rolagem;
  }

  function desenharRodape() {
    var rodape = el('nova-distribuicao-rodape');
    if (!rodape) return;
    rodape.classList.toggle('oculto', !E.periodo || !temEdicao());   /* o rodapé largo aparece só com alteração */
  }

  /* manterFoco: o desenho na hora de uma mudança; o foco pedido vale também no desenho da conta, que vem depois */
  function desenhar(manterFoco) {
    if (!montada() || !E.periodo || !E.calc) return;
    desenharMenu();
    desenharCorpo();
    desenharRodape();
    if (E.focar) {
      var alvo = document.querySelector(E.focar);
      if (!manterFoco) E.focar = null;
      if (alvo) alvo.focus();
    }
  }

  /* sem respostas: com postos ou modelos hoje, copia; sem nada hoje, começa em branco */
  function desenharSemRespostas() {
    desenharMenu();
    desenharRodape();
    V().semRespostas(contextoVersoes(), P().mostrarNoCorpo('sem-respostas'));
  }

  /* a barra: a unidade (seletor), só as da área do administrador */
  function desenharBarra() {
    el('nova-distribuicao-barra').classList.remove('oculto');
    var trilho = el('nova-distribuicao-unidades');
    trilho.textContent = '';
    E.dados.unidades.filter(function (u) { return u.pode; }).forEach(function (u) {
      var aba = P().tpl('unidade');
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', u.id);
      aba.classList.toggle('aba--ativa', u.id === E.unidadeId);
      trilho.appendChild(aba);
    });
  }

  /* ---------- gravar ---------- */

  /* o que vai para o banco: a unidade e, no pelotão vendo a em vigor, a parte da companhia, cada uma só quando mudou */
  function itensParaSalvar() {
    var itens = [];
    if (mudouLado('unidade')) itens.push({ periodo_id: E.periodo.id, respostas: E.resp, renomeadas: E.renomeadas.unidade });
    if (mudouLado('companhia') && E.companhia && E.companhia.periodo && !E.vendoAgendada) {
      itens.push({ periodo_id: E.companhia.periodo.id, respostas: E.respCia, renomeadas: E.renomeadas.companhia });
    }
    return itens;
  }

  /* grava com respostas faltando (pendências); valor errado o banco recusa. As substituições vão junto,
     conferidas antes. A data e a prévia: -versoes */
  function salvar() {
    var Pt = RosterWork.novaDistribuicaoCaixas;
    if (!E.periodo || !temEdicao()) return;
    semPrefixo().forEach(function (k) { if (!invalidos.hasOwnProperty(k)) invalidos[k] = ''; });
    if (!Pt.conferir(E.dados) || Object.keys(invalidos).length) { desenhar(); RosterWork.avisar({ tipo: 'erro', mensagem: M().corrigirAntes }); return; }
    V().salvar(contextoVersoes(), el('nova-distribuicao-salvar'));
  }

  function cancelar() {
    confirmarDescarte(function () { E.aberto = null; carregar(E.unidadeId, E.vendoAgendada ? E.periodo.id : null); });
  }

  /* o contexto que o aviso, o Salvar e o começo da unidade usam (-versoes) */
  function contextoVersoes() {
    return {
      dados: E.dados, unidadeId: E.unidadeId, vendoAgendada: E.vendoAgendada, itens: itensParaSalvar,
      substituicoes: RosterWork.novaDistribuicaoCaixas.operacoes, ritmo: Rt().paraSalvar, guarnicao: Rt().guarnicaoParaSalvar,
      carregar: function (versaoId, gravou) { E.aberto = null; return carregar(E.unidadeId, versaoId, gravou); },
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
    /* pelo abas.ligar, a unidade vira o menu "Opção ▾" no celular (geral-abas) */
    var unidades = el('nova-distribuicao-unidades');
    if (!unidades.dataset.ligado) {
      unidades.dataset.ligado = '1';
      RosterWork.abas.ligar(unidades, function (aba) {
        var id = Number(aba.getAttribute('data-unidade'));
        if (id === E.unidadeId) return;
        confirmarDescarte(function () { E.aberto = null; carregar(id); }, desenharBarra);
      });
    }
    document.querySelectorAll('.nova-distribuicao-bloco').forEach(function (botao) {
      ligarUmaVez(botao, 'click', function () {
        if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns(null);   /* no celular, o bloco mora num menu */
        E.bloco = Number(botao.getAttribute('data-bloco'));
        E.aberto = null;
        /* o Conferir sem a tabela na última conta: o menu marca ele já e a conta vem com a tabela */
        if (Conta().faltaTabela()) { desenharMenu(); Conta().pedirTabela(); return; }
        desenhar();
        el('nova-distribuicao-corpo').scrollTop = 0;   /* o bloco novo começa do alto */
      });
    });
  }

  function iniciar() {
    var S = RosterWork.sessao;
    arrumarBlocos();
    if (!((S.temPapel && S.temPapel('pelotao')) || (S.ehProgramador && S.ehProgramador()))) {
      P().mostrarNoCorpo('bloqueado');
      return Promise.resolve();
    }
    ligar();
    if (!guardaLigada && RosterWork.guardaSaida) {
      guardaLigada = true;
      RosterWork.guardaSaida.registrar(function () { return montada() && temEdicao(); });
    }
    E.aberto = null;
    return carregar(E.unidadeId);   /* volta para a última unidade vista (na 1ª vez, a do administrador) */
  }

  /* sair da aba: com edição não salva, pergunta; descartando, volta ao que está gravado e segue; senão, fica */
  function sairDaAba(seguir, ficar) {
    if (!temEdicao()) { seguir(); return; }
    confirmarDescarte(function () { E.aberto = null; carregar(E.unidadeId, E.vendoAgendada ? E.periodo.id : null); seguir(); }, ficar);
  }

  window.addEventListener('resize', arrumarBlocos);

  /* o que as contas (-conta) usam da página */
  Conta().ligar({
    estado: function () { return E; },
    receber: receber,
    montada: montada,
    ehPelotao: ehPelotao,
    emTexto: emTexto,
    desenhar: function () { desenhar(); },
    desenharSemRespostas: desenharSemRespostas,
    esquecerFoco: function () { E.focar = null; },
    avisarFalha: avisarFalha,
    avisarSemConexao: avisarSemConexao
  });

  window.RosterWork.novaDistribuicao ={ iniciar: iniciar, sairDaAba: sairDaAba };
})();
