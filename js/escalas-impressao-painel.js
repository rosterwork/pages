/* ============================================================
   ESCALAS — o painel de impressão, um só para as duas impressões
   O Imprimir escala (escalas-impressao.js: o painel do dia e o
   Militares) e o das grades (escalas-impressao-grade.js: Agenda,
   Calendário, Colunas) usam o mesmo molde (#tpl-escala-impressao) e
   esta parte comum: a nota "Será impresso:" com o resumo e o aviso
   de erro grave do período; a numeração das caixas à vista; a caixa
   Unidades (escalas-impressao-unidades.js); o Mostrar; a prévia (o
   próprio PDF, no leitor do navegador, refeita a cada mudança; a
   última pedida vale; no celular não aparece) e o rodapé Cancelar ·
   Gerar PDF (baixa o arquivo da prévia). Cada impressão diz só o que
   é dela: as marcas do molde, o período, o formato e o arquivo.
   API: RosterWork.escalasImpressaoPainel.montar(corpo, rodape, cfg),
        .esquecer(), .atualizar()
   cfg = { marcas: ['dia'] ou ['grade', 'semanas' | 'dias' | 'semana'],
           ids: as unidades marcadas no começo (a companhia de cada pelotão entra junto),
           mostrar: o começo do Mostrar ({ icones } ou { grafico, icones, faixa }),
           aoSair: o Cancelar e o fim do Gerar PDF,
           ligar(peca, atualizar): liga as peças da impressão (o período, o formato),
           estado(escolhas, marcarErros): { erro } ou { resumo, inicio, fim, chave, montar } }
   escolhas = { unidades (as marcadas que têm escala, na ordem da árvore), ids, mostrar };
   montar() resolve em { arquivo, nome, folhas (o texto da contagem) }; a falha pode trazer { mensagem }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ESPERA = 400;                                // ms sem mexer antes da prévia e da conferência do erro grave
  var TIPOS_COM_ESCALA = ['CIA', 'CIBM', 'PEL'];   // as outras unidades marcadas na árvore são só o caminho

  var form = null;   // o painel aberto: o cfg, o corpo e o rodapé, o seletor, o Mostrar, o arquivo pedido e a url da prévia
  var tokenAviso = 0, esperaAviso = null;     // latest-wins da conferência de erro grave
  var tokenPrevia = 0, esperaPrevia = null;   // latest-wins da prévia

  function msg() { return RW.mensagens.escala.impressao; }

  function peca(nome) {
    var sel = '[data-impressao-' + nome + ']';
    return form.corpo.querySelector(sel) || (form.rodape ? form.rodape.querySelector(sel) : null);
  }

  /* ---------- o molde ---------- */
  /* só o que vale para esta impressão: a peça com data-impressao-so aparece se tiver uma das marcas */
  function aplicarMarcas(marcas) {
    Array.prototype.forEach.call(form.corpo.querySelectorAll('[data-impressao-so]'), function (el) {
      var vale = el.getAttribute('data-impressao-so').split(' ').some(function (m) { return marcas.indexOf(m) >= 0; });
      el.classList.toggle('oculto', !vale);
    });
  }

  /* as caixas à vista, numeradas em ordem */
  function numerarCaixas() {
    var n = 0;
    Array.prototype.forEach.call(form.corpo.querySelectorAll(':scope > .grupo-caixa'), function (caixa) {
      if (caixa.classList.contains('oculto')) return;
      n++;
      Array.prototype.forEach.call(caixa.querySelectorAll('[data-impressao-num]'), function (el) { el.textContent = String(n); });
    });
  }

  /* o Mostrar: cada caixa de marcar liga ou desliga a sua peça (as que não são da impressão ficam ocultas) */
  function pintarOpcao(opcao, sim) {
    opcao.setAttribute('aria-checked', sim ? 'true' : 'false');
    opcao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', sim);
  }

  function ligarMostrar() {
    Array.prototype.forEach.call(form.corpo.querySelectorAll('[data-mostrar]'), function (opcao) {
      var chave = opcao.getAttribute('data-mostrar');
      if (!(chave in form.mostrar)) return;
      pintarOpcao(opcao, form.mostrar[chave]);
      opcao.addEventListener('click', function () {
        form.mostrar[chave] = !form.mostrar[chave];
        pintarOpcao(opcao, form.mostrar[chave]);
        atualizar();
      });
    });
  }

  /* ---------- as escolhas ---------- */
  function escolhas() {
    var unidades = form.seletor
      ? form.seletor.unidadesSelecionadas().filter(function (u) { return TIPOS_COM_ESCALA.indexOf(u.tipo) >= 0; })
      : [];
    var mostrar = {};
    Object.keys(form.mostrar).forEach(function (k) { mostrar[k] = form.mostrar[k]; });
    return { unidades: unidades, ids: unidades.map(function (u) { return u.unidade_id; }), mostrar: mostrar };
  }

  /* o estado da impressão (o período) e, sem unidade, o aviso da árvore; marcarErros marca os campos */
  function ler(marcarErros) {
    if (marcarErros && RW.campos) RW.campos.limparErros(form.corpo);
    var e = escolhas();
    var estado = form.cfg.estado(e, marcarErros) || {};
    if (!e.unidades.length) {
      var texto = (RW.mensagens.distribuicao && RW.mensagens.distribuicao.selecioneUnidade) || '';
      if (marcarErros && RW.campos) RW.campos.marcarErro(form.arvore, texto);
      if (!estado.erro) estado = { erro: texto };
    }
    return { escolhas: e, estado: estado };
  }

  /* a cada mudança: a nota com o resumo, a prévia e a conferência do erro grave */
  function atualizar() {
    if (!form) return;
    var r = ler(false), est = r.estado;
    peca('nota').classList.toggle('oculto', !!est.erro);
    peca('resumo').textContent = est.erro ? '' : est.resumo;
    peca('aviso').classList.add('oculto');
    agendarPrevia(est);
    var token = ++tokenAviso;
    clearTimeout(esperaAviso);
    if (est.erro || !RW.escalasDados) return;
    var ids = r.escolhas.ids;
    esperaAviso = setTimeout(function () {
      RW.escalasDados.lerImpressaoErros(ids, est.inicio, est.fim).then(function (lista) {
        if (token !== tokenAviso || !form || !Array.isArray(lista) || !lista.length) return;
        mostrarAviso(lista);
      });
    }, ESPERA);
  }

  /* "13/10 (2ºPEL), 14/10 (2ºPEL e 3ºPEL)": agrupa por dia */
  function mostrarAviso(lista) {
    var porDia = {}, ordem = [];
    lista.forEach(function (e) {
      if (!porDia[e.data]) { porDia[e.data] = []; ordem.push(e.data); }
      porDia[e.data].push(e.unidade);
    });
    var partes = ordem.map(function (iso) {
      var nomes = porDia[iso];
      var unidades = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
      return iso.slice(8, 10) + '/' + iso.slice(5, 7) + ' (' + unidades + ')';
    });
    var aviso = peca('aviso');
    aviso.querySelector('.impacto-aviso-titulo').textContent = msg().avisoTitulo(ordem.length);
    aviso.querySelector('.impacto-aviso-desc').textContent = msg().avisoDescricao(partes.join(', '));
    aviso.classList.remove('oculto');
  }

  /* ---------- o arquivo e a prévia ---------- */
  /* as mesmas escolhas reaproveitam o arquivo já pedido (a prévia e o Gerar PDF são o mesmo arquivo); o que falhou é
     pedido de novo */
  function pedirArquivo(est) {
    if (form.arquivo && form.arquivo.chave === est.chave) return form.arquivo.promessa;
    var ref = form;
    var promessa = est.montar();
    ref.arquivo = { chave: est.chave, promessa: promessa };
    promessa.catch(function () { if (ref.arquivo && ref.arquivo.promessa === promessa) ref.arquivo = null; });
    return promessa;
  }

  function mostrarCarregandoPrevia(sim) {
    peca('previa-carregando').classList.toggle('carregando-veu--visivel', sim);
  }

  function mostrarAvisoPrevia(texto) {
    var aviso = peca('previa-aviso');
    aviso.textContent = texto;
    aviso.classList.remove('oculto');
    peca('folhas').textContent = '';
    mostrarCarregandoPrevia(false);
  }

  /* refeita depois de uma pausa sem mexer; a última pedida vale. Escolha incompleta: o motivo no lugar da prévia */
  function agendarPrevia(est) {
    var token = ++tokenPrevia;
    clearTimeout(esperaPrevia);
    if (RW.celular && RW.celular()) return;
    if (est.erro) { mostrarAvisoPrevia(est.erro); return; }
    mostrarCarregandoPrevia(true);
    esperaPrevia = setTimeout(function () { fazerPrevia(token, est); }, ESPERA);
  }

  function fazerPrevia(token, est) {
    if (!form || token !== tokenPrevia) return;
    var ref = form;
    pedirArquivo(est).then(function (a) {
      if (form !== ref || token !== tokenPrevia) return;
      if (form.url) URL.revokeObjectURL(form.url);
      form.url = URL.createObjectURL(a.arquivo);
      /* o leitor do navegador sem a barra dele, na largura do quadro */
      peca('previa').src = form.url + '#toolbar=0&navpanes=0&view=FitH';
      peca('previa-aviso').classList.add('oculto');
      peca('folhas').textContent = a.folhas || '';
      mostrarCarregandoPrevia(false);
    }, function (e) {
      if (form !== ref || token !== tokenPrevia) return;
      mostrarAvisoPrevia((e && e.mensagem) || msg().falhaPrevia);
    });
  }

  /* ---------- gerar e sair ---------- */
  /* baixa o arquivo da prévia (ou monta agora, se ela ainda não saiu) */
  function gerar() {
    var r = ler(true);
    if (r.estado.erro) return;
    var ref = form;
    var botao = peca('gerar');
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    function terminar() { if (RW.pararCarregando && botao.isConnected) RW.pararCarregando(botao); }
    pedirArquivo(r.estado).then(function (a) {
      terminar();
      RW.escalasImpressaoPdf.baixar(a.arquivo, a.nome);
      if (form === ref) sair();   // o painel ainda mostra este formulário: fecha (ou a sub-tela volta ao dia)
    }).catch(function (e) {
      terminar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (e && e.mensagem) || msg().falhaGerar });
    });
  }

  /* o formulário saiu da tela (o painel fechou, ou a sub-tela voltou ao dia): para a prévia e a conferência */
  function esquecer() {
    if (form && form.url) URL.revokeObjectURL(form.url);
    form = null;
    tokenAviso++;
    clearTimeout(esperaAviso);
    tokenPrevia++;
    clearTimeout(esperaPrevia);
  }

  /* o Cancelar e o fim do Gerar PDF */
  function sair() {
    var aoSair = form && form.cfg.aoSair;
    esquecer();
    if (aoSair) aoSair();
  }

  /* ---------- montar ---------- */
  /* põe o molde em corpo e o rodapé em rodape, só com o que vale para a impressão (cfg: ver o topo) */
  function montar(corpo, rodape, cfg) {
    var molde = document.getElementById('tpl-escala-impressao');
    var acoes = document.getElementById('tpl-escala-impressao-acoes');
    if (!corpo || !molde) return;
    esquecer();
    corpo.appendChild(molde.content.cloneNode(true));
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }
    var mostrar = {};
    Object.keys(cfg.mostrar || {}).forEach(function (k) { mostrar[k] = cfg.mostrar[k]; });
    form = { cfg: cfg, corpo: corpo, rodape: rodape, mostrar: mostrar, seletor: null, arquivo: null, url: null };
    form.arvore = peca('arvore');
    aplicarMarcas(cfg.marcas);
    numerarCaixas();
    ligarMostrar();
    peca('cancelar').addEventListener('click', sair);
    peca('gerar').addEventListener('click', gerar);
    if (!(RW.celular && RW.celular())) mostrarCarregandoPrevia(true);
    cfg.ligar(peca, atualizar);

    /* a árvore do seletor do cabeçalho, solta no painel: marcada com cfg.ids e a companhia de cada pelotão e, para
       quem é de companhia ou pelotão, começando na companhia */
    if (RW.seletorUnidades && RW.escalasImpressaoUnidades) {
      var ref = form;
      form.seletor = RW.seletorUnidades.criar({
        modo: 'multi',
        arvoreEl: form.arvore,
        aoMudar: function () {
          if (form !== ref) return;
          if (RW.campos) RW.campos.limparErro(ref.arvore);
          atualizar();
        }
      });
      RW.escalasImpressaoUnidades.montar(form.seletor, peca('toggle'), cfg.ids || []).then(function () {
        /* o formulário saiu ou reabriu enquanto carregava (na sub-tela, também a troca de aba do painel) */
        if (form !== ref || !ref.arvore.isConnected) return;
        atualizar();
      });
    }
  }

  RW.escalasImpressaoPainel = { montar: montar, esquecer: esquecer, atualizar: atualizar };
})();
