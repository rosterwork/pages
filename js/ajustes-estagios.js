/* ============================================================
   AJUSTES — aba Estágios: as regras de cada estágio de uma unidade
   A unidade do seletor da barra (a companhia e os pelotões, como nos
   Feriados) e os estágios dela (estagios_listar). À esquerda, a
   lista dos estágios; à direita, as regras do escolhido em cartões
   que abrem no clique (ajustes-estagios-cartoes.js), editadas na
   própria tela, como a Distribuição. Tudo fica num rascunho (a lista
   inteira): o Novo estágio, cada resposta e o Remover estágio. O
   Desfazer e o Refazer (também Ctrl+Z e Ctrl+Y) andam por ele, e o
   Salvar do rodapé largo grava a lista inteira (estagios_salvar).
   A mudança num estágio que já começou pergunta a data (pedirData,
   já sugerida); a do que ainda não começou vale da data dele.
   Trocar de unidade ou de aba com mudança pergunta antes.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.ajustesEstagios.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var unidadeId = null;   // a unidade do seletor (null: a do administrador, escolhida pelo banco)
  var dados = null;       // a resposta do estagios_listar
  var pedido = 0;         // latest-wins
  var rascunho = [];      // os estágios como estão na tela (cada um com a _chave)
  var inicial = '[]';     // os gravados, para saber se mudou
  var escolhida = null;   // a _chave do estágio aberto à direita
  var aberto = null;      // o cartão aberto ('nome', 'periodo', 'quem', 'funcoes', 'fora', 'acumulos')
  var antes = [];         // o Desfazer: as fotos do rascunho
  var depois = [];        // o Refazer
  var juntando = null;    // o campo que está sendo digitado: a digitação seguida vira um passo só do Desfazer
  var novos = 0;
  var guardaLigada = false;

  function msg() { return RW.mensagens.ajustes.estagios; }
  function P() { return RW.novaDistribuicaoPecas; }
  function copia(x) { return JSON.parse(JSON.stringify(x)); }

  /* o que vai para o banco (e o que se compara): sem a _chave */
  function limpos(lista) {
    return lista.map(function (e) { var c = copia(e); delete c._chave; return c; });
  }
  function sujo() { return !!dados && JSON.stringify(limpos(rascunho)) !== inicial; }
  function atual() { return rascunho.filter(function (e) { return e._chave === escolhida; })[0] || null; }

  /* ---------- carregar ---------- */
  /* gravou: a leitura depois do Salvar, com o cartão das etapas na frente: o que está na tela fica até o novo chegar */
  function carregar(reescolher, gravou) {
    var meu = ++pedido;
    if (!gravou) {
      el.corpo.textContent = '';
      el.corpo.appendChild(P().tpl('carregando'));
    }
    return RW.rpc('estagios_listar', { p_unidade: unidadeId }).then(function (r) {
      if (meu !== pedido || !el.corpo.isConnected) return;
      if (!r || !r.ok) {
        el.corpo.textContent = '';
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
        return;
      }
      dados = r;
      unidadeId = r.unidade.id;
      rascunho = copia(r.estagios || []).map(function (e) { e._chave = e.id; return e; });
      inicial = JSON.stringify(limpos(rascunho));
      antes = [];
      depois = [];
      juntando = null;
      /* depois do Salvar, o mesmo estágio continua aberto (pelo nome) */
      var achado = reescolher ? rascunho.filter(function (e) { return e.nome === reescolher; })[0] : null;
      escolhida = achado ? achado._chave : (rascunho[0] ? rascunho[0]._chave : null);
      aberto = null;
      desenharBarra();
      desenhar();
    }, function () {
      if (meu !== pedido) return;
      el.corpo.textContent = '';
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* o seletor da barra: as unidades que o administrador muda, com a da tela marcada (o molde dos Feriados) */
  function desenharBarra() {
    el.unidades.textContent = '';
    dados.unidades.filter(function (u) { return u.pode_editar; }).forEach(function (u) {
      var aba = RW.tpl('tpl-feriados-unidade');
      aba.textContent = u.nome;
      aba.setAttribute('data-unidade', u.id);
      aba.classList.toggle('aba--ativa', u.id === unidadeId);
      el.unidades.appendChild(aba);
    });
  }

  function trocarUnidade(id) {
    if (id === unidadeId) return;
    confirmarDescarte(function () { unidadeId = id; carregar(); }, desenharBarra);
  }

  /* ---------- desenhar: a lista, as regras do escolhido e o rodapé ---------- */
  function desenharLista() {
    el.lista.textContent = '';
    rascunho.forEach(function (e) {
      var item = RW.tpl('tpl-estagios-item');
      item.querySelector('.ajustes-estagios-item-nome').textContent = e.nome.trim() || msg().estagioNovo;
      item.classList.toggle('lista-item--ativo', e._chave === escolhida);
      item.addEventListener('click', function () {
        if (e._chave === escolhida) return;
        escolhida = e._chave;
        aberto = null;
        juntando = null;
        desenhar();
      });
      el.lista.appendChild(item);
    });
    el.contagem.textContent = msg().contagem(rascunho.length);
  }

  function desenhar() {
    desenharLista();
    el.corpo.textContent = '';
    var conteudo = P().tpl('conteudo');
    var semPostos = !(dados.postos || []).length;
    el.novo.disabled = semPostos;
    if (semPostos) conteudo.appendChild(RW.tpl('tpl-estagios-sem-postos'));
    else if (!atual()) conteudo.appendChild(RW.tpl('tpl-estagios-vazio'));
    else RW.ajustesEstagiosCartoes.montar(conteudo, { estagio: atual(), dados: dados, api: api });
    el.corpo.appendChild(conteudo);
    atualizarRodape();
  }

  /* o rodapé largo aparece com alteração e enquanto há o que refazer */
  function atualizarRodape() {
    var mudou = sujo();
    el.rodape.classList.toggle('oculto', !mudou && !depois.length);
    el.pendente.classList.toggle('oculto', !mudou);
    el.salvar.disabled = !mudou;
    el.cancelar.disabled = !mudou;
    el.desfazer.disabled = !antes.length;
    el.refazer.disabled = !depois.length;
  }

  /* ---------- o rascunho, o Desfazer e o Refazer ---------- */
  function foto() { return JSON.stringify({ r: rascunho, e: escolhida, a: aberto }); }
  function voltarA(f) {
    var o = JSON.parse(f);
    rascunho = o.r;
    escolhida = o.e;
    aberto = o.a;
    juntando = null;
    desenhar();
  }
  function guardarPasso() { antes.push(foto()); depois = []; }

  function desfazer() { if (!antes.length) return; depois.push(foto()); voltarA(antes.pop()); }
  function refazer() { if (!depois.length) return; antes.push(foto()); voltarA(depois.pop()); }

  /* o que os cartões pedem (o mesmo contrato da Distribuição: aberto, abrir e mudar) */
  var api = {
    aberto: function () { return aberto ? 'e:' + aberto : null; },
    abrir: function (id) {
      var c = String(id).slice(2);
      aberto = aberto === c ? null : c;
      juntando = null;
      desenhar();
    },
    /* op = { campo: a digitação seguida desse campo é um passo só; redesenhar: false (o campo que se digita
       continua na tela); abrir: o cartão que fica aberto } */
    mudar: function (fn, op) {
      op = op || {};
      var e = atual();
      if (!e) return;
      if (!op.campo || juntando !== op.campo) guardarPasso();
      juntando = op.campo || null;
      fn(e);
      if (op.abrir) aberto = op.abrir;
      if (op.redesenhar === false) { desenharLista(); atualizarRodape(); } else desenhar();
    },
    /* o Remover estágio: sai do rascunho (o Desfazer o traz de volta; some do banco no Salvar) */
    remover: function () {
      var i = rascunho.indexOf(atual());
      if (i < 0) return;
      guardarPasso();
      rascunho.splice(i, 1);
      var prox = rascunho[i] || rascunho[i - 1] || null;
      escolhida = prox ? prox._chave : null;
      aberto = null;
      juntando = null;
      desenhar();
    }
  };

  /* o Novo estágio: entra no alto da lista, já aberto no nome */
  function novo() {
    if (!dados || el.novo.disabled) return;
    guardarPasso();
    var e = { id: null, nome: '', inicio: '', fim: null, quem: 'graduacao', graus: [], militares: [], funcoes: [],
              viatura_fora: 'sem_funcao', sobra: null, acumulos: [], _chave: 'novo-' + (++novos) };
    rascunho.unshift(e);
    escolhida = e._chave;
    aberto = 'nome';
    juntando = null;
    desenhar();
    var campo = el.corpo.querySelector('.ajustes-estagios-nome');
    if (campo) campo.focus();
  }

  /* ---------- descartar, cancelar e salvar ---------- */

  /* com alteração não salva, pergunta antes de seguir (Descartar / Continuar editando); descartando, volta ao gravado */
  function confirmarDescarte(seguir, ficar) {
    if (!sujo()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { inicial = JSON.stringify(limpos(rascunho)); antes = []; depois = []; seguir(); },
      aoCancelar: ficar
    });
  }

  function cancelar() {
    if (!sujo()) return;
    var nome = atual() ? atual().nome : null;
    confirmarDescarte(function () { carregar(nome); });
  }

  /* o começo do que mudou em cada estágio (o novo, o mudado e o que saiu): algum já começou? */
  function mudouAlgoQueComecou(lista) {
    var gravados = {};
    limpos(dados.estagios || []).forEach(function (g) { gravados[g.id] = g; });
    var comecos = [];
    lista.forEach(function (e) {
      var g = e.id ? gravados[e.id] : null;
      if (g && JSON.stringify(g) === JSON.stringify(e)) return;
      comecos.push(e.inicio);
      if (g) comecos.push(g.inicio);
    });
    Object.keys(gravados).forEach(function (id) {
      if (!lista.some(function (e) { return e.id === id; })) comecos.push(gravados[id].inicio);
    });
    return comecos.some(function (d) { return !!d && d <= dados.hoje; });
  }

  function salvar() {
    if (!sujo()) return;
    var lista = limpos(rascunho);
    if (!mudouAlgoQueComecou(lista)) { enviar(lista, null); return; }
    RW.pedirData({
      sugerida: true, titulo: msg().salvarTitulo, sugestaoAntes: msg().salvarAntes, sugestaoDepois: msg().salvarDepois,
      textoConfirmar: msg().botaoSalvar,
      aoConfirmar: function (iso) { enviar(lista, iso); }
    });
  }

  /* grava a lista inteira; a escala da unidade é refeita (o cartão das etapas enquanto grava e a tela lê de novo; a fila
     do recálculo segue depois); no fim, o resumo */
  function enviar(lista, desde) {
    var nome = atual() ? atual().nome.trim() : null;
    var etapas = RW.etapas.acao('estagiosSalvar', { unidade: (dados && dados.unidade && dados.unidade.nome) || '' }, { doServidor: 2 });
    RW.rpc('estagios_salvar', { p_unidade: unidadeId, p_estagios: lista, p_desde: desde }).then(function (r) {
      if (!r || !r.success) {
        etapas.parar();
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
        return;
      }
      etapas.ultima();
      function fim() {
        etapas.parar();
        if (r.sem_alteracoes) RW.avisar({ tipo: 'aviso', mensagem: msg().nadaMudou });
        else if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: msg().pagina });
      }
      carregar(nome, true).then(fim, fim);
    }, function () {
      etapas.parar();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* Ctrl+Z e Ctrl+Y com a aba à mostra (no campo que se digita, ficam com o campo) */
  function teclas(ev) {
    if (!el.layout || !el.layout.isConnected || el.layout.classList.contains('oculto')) return;
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    var alvo = ev.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.modal-veu--aberto')) return;
    var tecla = ev.key.toLowerCase();
    if (tecla === 'z' && !ev.shiftKey) { ev.preventDefault(); desfazer(); }
    else if (tecla === 'y' || (tecla === 'z' && ev.shiftKey)) { ev.preventDefault(); refazer(); }
  }

  /* ---------- entrada (a cada visita à página; a unidade escolhida fica para a próxima) ---------- */
  function montar(cont) {
    el.layout = cont.querySelector('#estagios-layout');
    el.novo = cont.querySelector('#estagios-novo');
    el.unidades = cont.querySelector('#estagios-unidades');
    el.lista = cont.querySelector('#estagios-lista');
    el.contagem = cont.querySelector('#estagios-contagem');
    el.corpo = cont.querySelector('#estagios-corpo');
    el.rodape = cont.querySelector('#estagios-rodape');
    el.pendente = cont.querySelector('#estagios-pendente');
    el.desfazer = cont.querySelector('#estagios-desfazer');
    el.refazer = cont.querySelector('#estagios-refazer');
    el.cancelar = cont.querySelector('#estagios-cancelar');
    el.salvar = cont.querySelector('#estagios-salvar');
    dados = null;
    rascunho = [];
    inicial = '[]';
    antes = [];
    depois = [];
    el.novo.addEventListener('click', novo);
    RW.abas.ligar(el.unidades, function (aba) { trocarUnidade(Number(aba.getAttribute('data-unidade'))); });
    el.desfazer.addEventListener('click', desfazer);
    el.refazer.addEventListener('click', refazer);
    el.cancelar.addEventListener('click', cancelar);
    el.salvar.addEventListener('click', salvar);
    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return !!el.corpo && el.corpo.isConnected && sujo(); });
      document.addEventListener('keydown', teclas);
      guardaLigada = true;
    }
  }

  function ativar() { carregar(); }

  /* sair da aba com mudança não salva pergunta antes */
  RW.ajustesEstagios = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte };
})();
