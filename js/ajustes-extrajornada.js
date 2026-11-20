/* ============================================================
   AJUSTES — aba Extrajornada: as regras da extrajornada da companhia
   As perguntas (extrajornada_regras_ler): como repartir as cotas, a
   ordem dos pelotões para a falta (as setas), quem fica com o lugar
   quando dois querem o mesmo (a fila ou o mais antigo), quem vai para
   outro pelotão (de cada pelotão: o mais moderno ou em rodízio), onde
   as bombeiras tiram extra e a balança (Pouco, Normal, Muito). O que
   nunca quebra, a ordem das regras e as caixas fixas estão no
   ajustes.html; os pelotões vêm dos moldes tpl-regras-extra-*.
   Edita na própria tela; o Salvar do rodapé largo grava tudo, sem
   data (vale no próximo Preencher pela sugestão):
   extrajornada_regras_salvar → Histórico → resumo. Todo administrador
   vê a aba; quem não administra a companhia só lê (o cadeado).
   RosterWork.ajustesExtrajornada.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var dados = null;      // a resposta do extrajornada_regras_ler
  var regras = null;     // as respostas em edição: { repartir, ordem, primeiro, sai, sem_bombeiras, balanca }
  var inicial = '';      // as gravadas, para saber se mudou
  var pedido = 0;        // latest-wins
  var guardaLigada = false;
  var CHAVES = ['seguidos', 'bloco', 'colado', 'quer', 'igual'];

  function msg() { return RW.mensagens.ajustes.extrajornada; }
  /* as respostas sempre na mesma forma, para comparar */
  function texto(r) {
    return JSON.stringify({ repartir: r.repartir, ordem: r.ordem, primeiro: r.primeiro,
      sai: pelotoes().reduce(function (o, p) { o[p.id] = r.sai[p.id]; return o; }, {}),
      sem_bombeiras: pelotoes().map(function (p) { return p.id; }).filter(function (id) { return r.sem_bombeiras.indexOf(id) >= 0; }),
      balanca: CHAVES.reduce(function (o, k) { o[k] = r.balanca[k]; return o; }, {}) });
  }
  function sujo() { return !!regras && texto(regras) !== inicial; }
  function montada() { return !!(el.conteudo && el.conteudo.isConnected); }
  function pode() { return !!(dados && dados.pode_editar); }
  function pelotoes() { return (dados && dados.pelotoes) || []; }
  function pelotao(id) { return pelotoes().filter(function (p) { return p.id === id; })[0]; }

  /* as regras gravadas na forma da tela (o banco já completa o que falta com o padrão) */
  function daLeitura(r) {
    r = r || {};
    var sai = {};
    pelotoes().forEach(function (p) { sai[p.id] = (r.sai || {})[String(p.id)] === 'rodizio' ? 'rodizio' : 'moderno'; });
    var balanca = {};
    CHAVES.forEach(function (k) { balanca[k] = ((r.balanca || {})[k]) || 'normal'; });
    return {
      repartir: r.repartir === 'por_unidade' ? 'por_unidade' : 'grupo',
      ordem: (r.ordem || []).map(Number),
      primeiro: r.primeiro === 'antiguidade' ? 'antiguidade' : 'fila',
      sai: sai,
      sem_bombeiras: (r.sem_bombeiras || []).map(Number),
      balanca: balanca
    };
  }

  /* ---------- ler ---------- */
  /* gravou: a leitura depois do Salvar, com o cartão das etapas na frente: o que está na tela fica até o novo chegar */
  function carregar(gravou) {
    var meu = ++pedido;
    var leitura = RW.rpc('extrajornada_regras_ler', {});
    if (!gravou) {
      el.carregando.classList.remove('oculto');
      el.conteudo.classList.add('oculto');
      el.rodape.classList.add('oculto');
      leitura = RW.etapas.segurarDesde(performance.now(), leitura);
    }
    return leitura.then(function (r) {
      if (meu !== pedido || !montada()) return;
      el.carregando.classList.add('oculto');
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      dados = r;
      regras = daLeitura(r.regras);
      inicial = texto(regras);
      montarPelotoes();
      desenhar();
    }, function () {
      if (meu !== pedido) return;
      el.carregando.classList.add('oculto');
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- os pelotões: as linhas da ordem, do "quem vai" e das bombeiras (a cada leitura) ---------- */
  function montarPelotoes() {
    el.ordem.textContent = '';
    el.sai.textContent = '';
    el.bombeiras.querySelectorAll('[role="checkbox"][data-pelotao]').forEach(function (b) { b.remove(); });
    pelotoes().forEach(function (p) {
      var nome = msg().pelotao(p.nome, p.cidade);
      /* a linha do "quem vai para outro pelotão": o campo de escolher */
      var linha = RW.tpl('tpl-regras-extra-sai');
      if (linha) {
        linha.setAttribute('data-pelotao', String(p.id));
        linha.querySelector('.ajustes-extra-linha-nome').textContent = msg().sai(p.nome, p.cidade);
        var gatilho = linha.querySelector('.campo-selecao');
        gatilho.setAttribute('aria-label', msg().sai(p.nome, p.cidade));
        RW.campos.ligarSelecao(gatilho, function (valor) { regras.sai[p.id] = valor; desenhar(); });
        el.sai.appendChild(linha);
      }
      /* a caixa de marcar das bombeiras */
      var caixa = RW.tpl('tpl-regras-extra-bombeira');
      if (caixa) {
        caixa.setAttribute('data-pelotao', String(p.id));
        caixa.querySelector('.nova-distribuicao-marca-texto').textContent = nome;
        caixa.addEventListener('click', function () {
          var sem = regras.sem_bombeiras.indexOf(p.id) >= 0;
          regras.sem_bombeiras = pelotoes().map(function (x) { return x.id; })
            .filter(function (id) { return id === p.id ? !sem : regras.sem_bombeiras.indexOf(id) >= 0; });
          desenhar();
        });
        el.bombeiras.appendChild(caixa);
      }
    });
  }

  /* as linhas da ordem, refeitas a cada mudança (o número e as setas acompanham a posição) */
  function desenharOrdem(travado) {
    el.ordem.textContent = '';
    regras.ordem.forEach(function (id, i) {
      var p = pelotao(id);
      var linha = RW.tpl('tpl-regras-extra-pelotao');
      if (!p || !linha) return;
      var nome = msg().pelotao(p.nome, p.cidade);
      linha.querySelector('.ajustes-extra-pelotao-n').textContent = (i + 1) + '.';
      linha.querySelector('.ajustes-extra-pelotao-nome').textContent = nome;
      var subir = linha.querySelector('.nova-distribuicao-subir'), descer = linha.querySelector('.nova-distribuicao-descer');
      subir.setAttribute('aria-label', msg().subir(p.nome));
      descer.setAttribute('aria-label', msg().descer(p.nome));
      subir.disabled = travado || i === 0;
      descer.disabled = travado || i === regras.ordem.length - 1;
      subir.addEventListener('click', function () { mover(i, -1); });
      descer.addEventListener('click', function () { mover(i, 1); });
      el.ordem.appendChild(linha);
    });
  }

  function mover(i, passo) {
    var j = i + passo;
    if (j < 0 || j >= regras.ordem.length) return;
    var nova = regras.ordem.slice();
    nova[i] = regras.ordem[j];
    nova[j] = regras.ordem[i];
    regras.ordem = nova;
    desenhar();
    /* o foco fica na mesma seta, agora na posição nova */
    var linhas = el.ordem.children;
    var alvo = linhas[j] && linhas[j].querySelector(passo < 0 ? '.nova-distribuicao-subir' : '.nova-distribuicao-descer');
    if (alvo && !alvo.disabled) alvo.focus();
    else if (linhas[j]) { var outra = linhas[j].querySelector('button:not(:disabled)'); if (outra) outra.focus(); }
  }

  /* ---------- desenhar: as respostas, a trava e o rodapé ---------- */
  function desenhar() {
    var travado = !pode();
    el.companhia.textContent = dados.companhia.nome;
    el.trava.classList.toggle('oculto', !travado);
    el.conteudo.classList.remove('oculto');
    marcarBolinhas(el.repartir, function (v) { return v === regras.repartir; }, travado);
    desenharOrdem(travado);
    marcarBolinhas(el.primeiro, function (v) { return v === regras.primeiro; }, travado);
    el.sai.querySelectorAll('[data-pelotao]').forEach(function (linha) {
      escolher(linha.querySelector('.campo-selecao'), regras.sai[Number(linha.getAttribute('data-pelotao'))], travado);
    });
    el.bombeiras.querySelectorAll('[role="checkbox"][data-pelotao]').forEach(function (b) {
      var podem = regras.sem_bombeiras.indexOf(Number(b.getAttribute('data-pelotao'))) < 0;
      b.setAttribute('aria-checked', podem ? 'true' : 'false');
      b.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', podem);
      b.disabled = travado;
    });
    el.balanca.querySelectorAll('.ajustes-balanca-item[data-chave]').forEach(function (item) {
      escolher(item.querySelector('.campo-selecao'), regras.balanca[item.getAttribute('data-chave')], travado);
    });
    el.rodape.classList.toggle('oculto', !(pode() && sujo()));
  }

  /* o campo de escolher mostra o item do valor */
  function escolher(gatilho, valor, travado) {
    if (!gatilho) return;
    var menu = gatilho.closest('.dropdown').querySelector('.dropdown-menu');
    var item = menu.querySelector('.dropdown-item[data-valor="' + valor + '"]');
    gatilho.querySelector('.campo-selecao-texto').textContent = item ? item.textContent : '';
    gatilho.setAttribute('data-valor', valor || '');
    menu.querySelectorAll('.dropdown-item').forEach(function (i) { i.classList.toggle('dropdown-item--ativo', i === item); });
    gatilho.disabled = travado;
  }

  function marcarBolinhas(caixa, marcado, travado) {
    caixa.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.checked = marcado(inp.getAttribute('data-valor'));
      inp.disabled = travado;
    });
  }

  /* ---------- editar (as peças fixas no HTML: liga uma vez por visita) ---------- */
  function ligar() {
    el.repartir.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.addEventListener('change', function () { regras.repartir = inp.getAttribute('data-valor'); desenhar(); });
    });
    el.primeiro.querySelectorAll('input[type="radio"][data-valor]').forEach(function (inp) {
      inp.addEventListener('change', function () { regras.primeiro = inp.getAttribute('data-valor'); desenhar(); });
    });
    el.balanca.querySelectorAll('.ajustes-balanca-item[data-chave]').forEach(function (item) {
      RW.campos.ligarSelecao(item.querySelector('.campo-selecao'), function (valor) {
        regras.balanca[item.getAttribute('data-chave')] = valor;
        desenhar();
      });
    });
    el.cancelar.addEventListener('click', function () { confirmarDescarte(function () {}); });
    el.salvar.addEventListener('click', salvar);
  }

  /* volta ao que está gravado */
  function descartar() {
    regras = daLeitura(JSON.parse(inicial));
    desenhar();
  }

  /* com edição não salva, pergunta antes de seguir; descartando, volta ao gravado */
  function confirmarDescarte(seguir, ficar) {
    if (!sujo()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { descartar(); seguir(); }, aoCancelar: ficar
    });
  }

  /* o Salvar: grava as respostas (sem data: valem no próximo Preencher pela sugestão); no fim, o resumo */
  function salvar() {
    if (!sujo()) return;
    var etapas = RW.etapas.acao('ajustesExtrajornada', null, { doServidor: 1, atraso: true, semFila: true, botao: el.salvar });
    RW.rpc('extrajornada_regras_salvar', { p_regras: JSON.parse(texto(regras)) }).then(function (r) {
      if (!r || !r.success) {
        etapas.parar();
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
        return;
      }
      etapas.ultima();
      function fim() {
        etapas.parar();
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: msg().pagina });
      }
      carregar(true).then(fim, fim);
    }, function () {
      etapas.parar();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- entrada (a cada visita à página) e a aba ---------- */
  function montar(cont) {
    ['conteudo', 'carregando', 'companhia', 'trava', 'rodape', 'cancelar', 'salvar', 'repartir', 'ordem', 'primeiro', 'sai',
     'bombeiras', 'balanca'].forEach(function (nome) {
      el[nome] = cont.querySelector('#regras-extra-' + nome);
    });
    dados = null;
    regras = null;
    inicial = '';
    ligar();
    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return montada() && sujo(); });
      guardaLigada = true;
    }
  }

  /* a 1ª vez que a aba abre na visita, lê */
  function ativar() { return dados ? Promise.resolve() : carregar(); }

  RW.ajustesExtrajornada = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte };
})();
