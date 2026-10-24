/* ============================================================
   NOVA DISTRIBUIÇÃO — entrada da página (protótipo, só programador)
   Carrega a unidade e o período, guarda as respostas em edição,
   pede as contas ao banco a cada mudança (a resposta mais nova
   vence) e desenha o menu de blocos, o corpo (blocos 1 a 6 em
   nova-distribuicao-blocos.js, o 7 em nova-distribuicao-conferir.js)
   e o rodapé. Salvar, Cancelar, a unidade, o período, o Novo período
   (painel da direita) e o Excluir período moram aqui.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var E = novoEstado();
  var tokenCarga = 0;
  var tokenConta = 0;
  var guardaLigada = false;
  var formPeriodo = null;   /* o Novo período aberto no painel */

  function novoEstado() {
    return {
      dados: null, unidadeId: null, periodo: null, resp: null, calc: null,
      companhia: null, respCia: null, calcCia: null,
      sujo: false, sujoCia: false, bloco: 0, aberto: null, efetivo: {}
    };
  }

  function D() { return RosterWork.novaDistribuicaoDados; }
  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function G() { return RosterWork.mensagens.geral; }
  function B() { return RosterWork.mensagens.botoes; }
  function P() { return RosterWork.novaDistribuicaoBlocos.pecas; }
  function el(id) { return document.getElementById(id); }
  function copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function ehPelotao() { return !!(E.dados && E.dados.unidade.tipo === 'PEL'); }
  function montada() { return !!el('nova-distribuicao-corpo'); }

  function rotuloPeriodo(p) {
    if (!p) return '';
    var br = RosterWork.data.isoParaBR;
    return p.fim ? P().texto(M().periodoIntervalo, { inicio: br(p.inicio), fim: br(p.fim) })
                 : P().texto(M().periodoDesde, { inicio: br(p.inicio) });
  }

  /* as falhas: o banco recusou (com a frase dele) ou não respondeu (servidor); a rede caiu (sem conexão) */
  function avisarFalha(r) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || G().falhaServidor }); }
  function avisarSemConexao() { RosterWork.avisar({ tipo: 'erro', mensagem: G().semConexao }); }

  /* com edição não salva, confirma o descarte antes de seguir */
  function confirmarDescarte(seguir, aoCancelar) {
    if (!E.sujo && !E.sujoCia) { seguir(); return; }
    RosterWork.confirmar({
      tipo: 'aviso', mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: B().descartar, textoCancelar: B().continuarEditando,
      aoConfirmar: seguir, aoCancelar: aoCancelar
    });
  }

  function mostrarNoCorpo(molde, frase) {
    var corpo = el('nova-distribuicao-corpo');
    if (!corpo) return null;
    corpo.textContent = '';
    var no = RosterWork.tpl('tpl-nova-distribuicao-' + molde);
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
      var guardado = { efetivo: E.efetivo, bloco: E.bloco };
      E = novoEstado();
      E.efetivo = guardado.efetivo;
      E.bloco = guardado.bloco;
      E.dados = r;
      E.unidadeId = r.unidade.id;
      E.periodo = r.atual;
      E.resp = r.atual ? copia(r.atual.respostas) : null;
      E.companhia = r.companhia;
      E.respCia = r.companhia && r.companhia.periodo ? copia(r.companhia.periodo.respostas) : null;
      desenharBarra();
      if (!E.periodo) { desenharSemRespostas(); return; }
      return recalcular();
    }, function () {
      if (meu === tokenCarga && montada()) mostrarNoCorpo('falha', G().semConexao);
    });
  }

  /* quantos de serviço a conferência mostra de início: as cadeiras próprias que dão erro vermelho */
  function efetivoPadrao() {
    var g = E.resp.gravidade || {};
    var n = E.calc.papel ? 1 : 0;
    (E.resp.ordem || []).forEach(function (c) { if (g[c] === 0) n++; });
    return Math.max(n, 1);
  }

  function recalcular() {
    var meu = ++tokenConta;
    var conta = D().calcular(E.unidadeId, E.resp, E.efetivo[E.unidadeId]);
    var contaCia = ehPelotao() && E.respCia ? D().calcular(E.companhia.unidade.id, E.respCia, null) : Promise.resolve(null);
    return Promise.all([conta, contaCia]).then(function (rs) {
      if (meu !== tokenConta || !montada()) return;
      if (!rs[0] || !rs[0].success) { avisarFalha(rs[0]); return; }
      E.calc = rs[0];
      E.resp = rs[0].respostas;
      if (rs[1] && rs[1].success) { E.calcCia = rs[1]; E.respCia = rs[1].respostas; }
      if (E.efetivo[E.unidadeId] == null) {
        E.efetivo[E.unidadeId] = efetivoPadrao();
        return recalcular();
      }
      desenhar();
    }, function () {
      if (meu === tokenConta && montada()) avisarSemConexao();
    });
  }

  /* ---------- o que os blocos pedem ---------- */

  function mudar(lado, fn) {
    var alvo = lado === 'companhia' ? E.respCia : E.resp;
    if (!alvo) return;
    fn(alvo);
    if (lado === 'companhia') E.sujoCia = true; else E.sujo = true;
    desenharRodape();
    recalcular();
  }

  /* a viatura mudou de nome: as cadeiras dela (nas regras, na ordem, na gravidade e em quem escolher) vão junto */
  function renomear(lado, velho, novo) {
    mudar(lado, function (x) {
      var r = JSON.parse(JSON.stringify(x).split('· ' + velho + '"').join('· ' + novo + '"'));
      r.viaturas.forEach(function (v) { if (v.nome === velho) v.nome = novo; });
      if (r.papel && r.papel.posto === velho) r.papel.posto = novo;
      Object.keys(r).forEach(function (k) { x[k] = r[k]; });
    });
  }

  var api = {
    mudar: mudar,
    renomear: renomear,
    abrir: function (id) { E.aberto = E.aberto === id ? null : id; desenhar(); },
    aberto: function () { return E.aberto; },
    copiarCompanhia: function () { copiar(E.companhia.unidade.id); },
    definirEfetivo: function (n) { E.efetivo[E.unidadeId] = n; recalcular(); }
  };

  /* ---------- desenhar ---------- */

  function contextos() {
    var u = {
      lado: 'unidade', ehCia: !ehPelotao(), nome: E.dados.unidade.nome, resp: E.resp, calc: E.calc,
      soLeitura: !!E.periodo.somente_leitura, nomeCompanhia: E.companhia ? E.companhia.unidade.nome : ''
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
    var r = ((E.calc && E.calc.prontos) || []).slice(0, 7);
    if (ehPelotao()) {
      var pc = (E.calcCia && E.calcCia.prontos) || [];
      r[1] = !!(r[1] && pc[1]);
      r[6] = !!(r[6] && pc[6]);
    }
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
    el('nova-distribuicao-contagem').textContent = E.periodo
      ? P().texto(M().contagem, { n: pr.filter(Boolean).length }) : '';
  }

  function desenharCorpo() {
    var corpo = el('nova-distribuicao-corpo');
    var rolagem = corpo.scrollTop;
    corpo.textContent = '';
    var conteudo = RosterWork.tpl('tpl-nova-distribuicao-conteudo');
    var ctxs = contextos();
    if (E.periodo.somente_leitura) conteudo.appendChild(RosterWork.tpl('tpl-nova-distribuicao-somente-leitura'));
    var erros = ((E.calc && E.calc.erros) || []).concat(ehPelotao() && E.calcCia ? E.calcCia.erros || [] : []);
    if (erros.length) {
      var nota = RosterWork.tpl('tpl-nova-distribuicao-erros');
      erros.forEach(function (frase) {
        var linha = RosterWork.tpl('tpl-nova-distribuicao-erro');
        linha.textContent = frase;
        nota.querySelector('.nova-distribuicao-erros-lista').appendChild(linha);
      });
      conteudo.appendChild(nota);
    }
    if (E.bloco === 6) RosterWork.novaDistribuicaoConferir.desenhar(conteudo, ctxs[ctxs.length - 1], api);
    else RosterWork.novaDistribuicaoBlocos.desenhar(E.bloco, conteudo, ctxs, api);
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

  function desenharSemRespostas() {
    desenharMenu();
    desenharRodape();
    var vazio = mostrarNoCorpo('sem-respostas');
    vazio.querySelector('.nova-distribuicao-copiar').addEventListener('click', function () { copiar(E.unidadeId, this); });
  }

  /* a barra: a unidade (seletor), o período (setas e lista) e o grupo Administração */
  function desenharBarra() {
    el('nova-distribuicao-barra').classList.remove('oculto');
    var trilho = el('nova-distribuicao-unidades');
    trilho.textContent = '';
    E.dados.unidades.forEach(function (u) {
      var aba = RosterWork.tpl('tpl-nova-distribuicao-unidade');
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', u.id);
      aba.classList.toggle('aba--ativa', u.id === E.unidadeId);
      trilho.appendChild(aba);
    });

    var periodos = E.dados.periodos || [];
    var i = E.periodo ? periodos.map(function (p) { return p.id; }).indexOf(E.periodo.id) : -1;
    el('nova-distribuicao-periodo').classList.toggle('oculto', !E.periodo);
    el('nova-distribuicao-periodo-nome').textContent = rotuloPeriodo(E.periodo);
    el('nova-distribuicao-periodo-anterior').disabled = i <= 0;
    el('nova-distribuicao-periodo-proximo').disabled = i < 0 || i >= periodos.length - 1;
    var lista = el('nova-distribuicao-periodo-lista');
    lista.textContent = '';
    periodos.forEach(function (p) {
      var item = RosterWork.tpl('tpl-nova-distribuicao-periodo-item');
      item.textContent = rotuloPeriodo(p);
      if (E.periodo && p.id === E.periodo.id) item.classList.add('dropdown-item--ativo');
      item.addEventListener('click', function () { trocarPeriodo(p); });
      lista.appendChild(item);
    });
    el('nova-distribuicao-novo-periodo').disabled = !E.periodo;
    el('nova-distribuicao-excluir-periodo').disabled = !E.periodo || periodos.length < 2;
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

  function salvar() {
    if (!E.periodo || (!E.sujo && !E.sujoCia)) return;
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

  function excluirPeriodo() {
    if (!E.periodo) return;
    confirmarDescarte(function () {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: P().texto(M().excluirPeriodo, { periodo: rotuloPeriodo(E.periodo) }),
        textoConfirmar: M().botaoExcluirPeriodo, textoCancelar: B().cancelar,
        aoConfirmar: function () {
          RosterWork.bloquearTela();
          D().excluirPeriodo(E.periodo.id).then(function (r) {
            RosterWork.liberarTela();
            if (!r || !r.success) { avisarFalha(r); return; }
            RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
            carregar(E.unidadeId);
          }, function () {
            RosterWork.liberarTela();
            avisarSemConexao();
          });
        }
      });
    });
  }

  /* Novo período, no painel da direita: começo, fim (ou sem fim) e de qual período copiar as respostas */
  function abrirNovoPeriodo() {
    if (!E.periodo) return;
    confirmarDescarte(function () {
      var painel = RosterWork.painel;
      var caixa = RosterWork.tpl('tpl-nova-distribuicao-novo-periodo');
      var rodape = RosterWork.tpl('tpl-nova-distribuicao-novo-periodo-rodape');
      var campos = {
        inicio: caixa.querySelector('.nova-distribuicao-inicio'),
        fim: caixa.querySelector('.nova-distribuicao-fim')
      };
      var semFim = caixa.querySelector('.nova-distribuicao-sem-fim');
      var origens = E.dados.periodos.map(function (p) { return { valor: p.id, texto: rotuloPeriodo(p) }; });
      formPeriodo = { inicio: null, fim: null, semFim: true, origem: E.periodo.id, sujo: false };

      function erro(campo, frase) {
        var c = campo.closest('.campo');
        c.classList.toggle('campo--erro', !!frase);
        c.querySelector('.campo-erro-texto').textContent = frase || '';
      }
      function ligarData(chave) {
        RosterWork.calendario.ligar(campos[chave], {
          obterData: function () { return formPeriodo[chave] ? new Date(formPeriodo[chave] + 'T12:00:00') : new Date(); },
          permiteDia: function (d) { return RosterWork.data.paraIsoDeData(d) >= E.dados.limite; },
          aoEscolher: function (d) {
            formPeriodo[chave] = RosterWork.data.paraIsoDeData(d);
            formPeriodo.sujo = true;
            campos[chave].value = RosterWork.data.isoParaBR(formPeriodo[chave]);
            erro(campos[chave], '');
          }
        });
      }
      function montarOrigem() {
        var lugar = caixa.querySelector('[data-espaco="origem"]');
        lugar.textContent = '';
        lugar.appendChild(P().selecao(origens, formPeriodo.origem, function (v) { formPeriodo.origem = v; montarOrigem(); }, M().novoPeriodoOrigem));
      }

      painel.abrir({ titulo: M().novoPeriodoTitulo, subtitulo: E.dados.unidade.nome, aoFechar: function () { formPeriodo = null; } });
      painel.corpo().appendChild(caixa);
      painel.rodape().appendChild(rodape);
      painel.rodape().classList.remove('oculto');
      ligarData('inicio');
      ligarData('fim');
      montarOrigem();
      semFim.addEventListener('change', function () {
        formPeriodo.semFim = semFim.checked;
        formPeriodo.sujo = true;
        caixa.querySelector('.nova-distribuicao-fim-campo').classList.toggle('oculto', semFim.checked);
      });
      rodape.querySelector('.nova-distribuicao-painel-cancelar').addEventListener('click', function () { painel.fechar(); });
      var criar = rodape.querySelector('.nova-distribuicao-painel-criar');
      criar.addEventListener('click', function () {
        var f = formPeriodo;
        if (!f.inicio) { erro(campos.inicio, M().erroInicio); return; }
        if (!f.semFim && !f.fim) { erro(campos.fim, M().erroFim); return; }
        if (!f.semFim && f.fim < f.inicio) { erro(campos.fim, M().erroOrdemDatas); return; }
        RosterWork.iniciarCarregando(criar);
        D().criarPeriodo(E.unidadeId, f.inicio, f.semFim ? null : f.fim, f.origem).then(function (r) {
          RosterWork.pararCarregando(criar);
          if (!r || !r.success) { avisarFalha(r); return; }
          painel.fechar();
          RosterWork.resumo.abrirModal(r.log, { pagina: M().pagina });
          carregar(E.unidadeId, r.periodo_id);
        }, function () {
          RosterWork.pararCarregando(criar);
          avisarSemConexao();
        });
      });
    });
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
    ligarUmaVez(el('nova-distribuicao-novo-periodo'), 'click', abrirNovoPeriodo);
    ligarUmaVez(el('nova-distribuicao-excluir-periodo'), 'click', excluirPeriodo);
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
        var painelSujo = !!(formPeriodo && formPeriodo.sujo && RosterWork.painel.estaAberto());
        return E.sujo || E.sujoCia || painelSujo;
      });
    }
    E.aberto = null;
    return carregar(E.unidadeId);   /* volta para a última unidade vista (na 1ª vez, a do programador) */
  }

  window.RosterWork.paginas['nova-distribuicao'] = { iniciar: iniciar };
})();
