/* ============================================================
   COMPONENTE geral-impressao — o painel de impressão, um só para
   todas as impressões (o Imprimir escala e o das grades da Escala,
   o Imprimir trocas e o Imprimir relatório da Extrajornada). A casca
   é do shell (#tpl-impressao e #tpl-impressao-acoes do index.html):
   no alto, a nota "Será impresso:" com o resumo e, embaixo dela, o
   aviso (o erro grave da escala); no meio, as caixas da impressão
   (o molde da página); por último, a Prévia (o próprio PDF, no
   leitor do navegador, refeita a cada mudança, a última pedida vale,
   com as folhas embaixo; no celular não aparece) e o rodapé
   Cancelar · Gerar PDF (baixa o arquivo da prévia). Aqui também: a
   numeração das caixas à vista (refeita a cada mudança, para a
   caixa que aparece ou some), o Mostrar (data-mostrar) e, quando o
   molde tem a árvore ([data-impressao-arvore]), as Unidades
   (geral-impressao-unidades.js).
   Cada impressão diz só o que é dela.
   API: RosterWork.impressao.montar(corpo, rodape, cfg), .esquecer(),
        .atualizar(), .contarFolhas(arquivo)
   cfg = { molde: o id do <template> com as caixas da impressão,
           marcas: o que vale do molde (data-impressao-so), opcional,
           ids: as unidades marcadas no começo (a companhia de cada pelotão entra junto), só com a árvore,
           mostrar: o começo do Mostrar ({ icones } ou { grafico, icones, faixa }), opcional,
           aoSair: o Cancelar e o fim do Gerar PDF,
           ligar(peca, atualizar): liga as peças da impressão,
           estado(escolhas, marcarErros): { erro, avisar } ou { resumo, chave, montar, inicio, fim },
           conferir(escolhas, estado): opcional, resolve em { titulo, descricao } (o aviso) ou null }
   escolhas = { unidades (as marcadas que têm escala, na ordem da árvore), ids, mostrar };
   montar() resolve em { arquivo, nome, folhas (o texto da contagem) }; a falha pode trazer { mensagem }.
   estado.avisar: o erro também abre o aviso no Gerar PDF (quando não há campo para marcar)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ESPERA = 400;   // ms sem mexer antes da prévia e da conferência

  var form = null;   // o painel aberto: o cfg, o corpo e o rodapé, o seletor, o Mostrar, o arquivo pedido e a url da prévia
  var tokenAviso = 0, esperaAviso = null;     // latest-wins da conferência
  var tokenPrevia = 0, esperaPrevia = null;   // latest-wins da prévia

  function msg() { return RW.mensagens.impressao; }

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
    var unidades = form.seletor && RW.impressaoUnidades ? RW.impressaoUnidades.escolhidas(form.seletor) : [];
    var mostrar = {};
    Object.keys(form.mostrar).forEach(function (k) { mostrar[k] = form.mostrar[k]; });
    return { unidades: unidades, ids: unidades.map(function (u) { return u.unidade_id; }), mostrar: mostrar };
  }

  /* o estado da impressão e, com a árvore e sem unidade, o aviso dela; marcarErros marca os campos */
  function ler(marcarErros) {
    if (marcarErros && RW.campos) RW.campos.limparErros(form.corpo);
    var e = escolhas();
    var estado = form.cfg.estado(e, marcarErros) || {};
    if (form.seletor && !e.unidades.length) {
      var texto = (RW.mensagens.distribuicao && RW.mensagens.distribuicao.selecioneUnidade) || '';
      if (marcarErros && RW.campos) RW.campos.marcarErro(form.arvore, texto);
      if (!estado.erro) estado = { erro: texto };
    }
    return { escolhas: e, estado: estado };
  }

  /* a cada mudança: a numeração, a nota com o resumo, a prévia e a conferência da impressão (o aviso) */
  function atualizar() {
    if (!form) return;
    numerarCaixas();
    var r = ler(false), est = r.estado;
    peca('nota').classList.toggle('oculto', !!est.erro);
    peca('resumo').textContent = est.erro ? '' : est.resumo;
    peca('aviso').classList.add('oculto');
    agendarPrevia(est);
    var token = ++tokenAviso;
    clearTimeout(esperaAviso);
    if (est.erro || !form.cfg.conferir) return;
    var conferir = form.cfg.conferir;
    esperaAviso = setTimeout(function () {
      Promise.resolve(conferir(r.escolhas, est)).then(function (aviso) {
        if (token !== tokenAviso || !form || !aviso) return;
        var el = peca('aviso');
        el.querySelector('.impacto-aviso-titulo').textContent = aviso.titulo || '';
        el.querySelector('.impacto-aviso-desc').textContent = aviso.descricao || '';
        el.classList.remove('oculto');
      }, function () {});
    }, ESPERA);
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

  /* quantas folhas o PDF tem, contadas no próprio arquivo (para a impressão que não traz a contagem) */
  function contarFolhas(arquivo) {
    return arquivo.text().then(function (texto) { return (texto.match(/\/Type\s*\/Page[^s]/g) || []).length; });
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
    if (r.estado.erro) {
      if (r.estado.avisar && RW.avisar) RW.avisar({ tipo: 'erro', mensagem: r.estado.erro });
      return;
    }
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
  /* põe a casca com as caixas da impressão em corpo e o rodapé em rodape, só com o que vale (cfg: ver o topo) */
  function montar(corpo, rodape, cfg) {
    var casca = document.getElementById('tpl-impressao');
    var molde = document.getElementById(cfg.molde);
    var acoes = document.getElementById('tpl-impressao-acoes');
    if (!corpo || !casca || !molde) return;
    esquecer();
    corpo.appendChild(casca.content.cloneNode(true));
    corpo.querySelector('[data-impressao-caixas]').replaceWith(molde.content.cloneNode(true));
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }
    var mostrar = {};
    Object.keys(cfg.mostrar || {}).forEach(function (k) { mostrar[k] = cfg.mostrar[k]; });
    form = { cfg: cfg, corpo: corpo, rodape: rodape, mostrar: mostrar, seletor: null, arquivo: null, url: null };
    form.arvore = peca('arvore');
    if (cfg.marcas) aplicarMarcas(cfg.marcas);
    numerarCaixas();
    ligarMostrar();
    peca('cancelar').addEventListener('click', sair);
    peca('gerar').addEventListener('click', gerar);
    if (!(RW.celular && RW.celular())) mostrarCarregandoPrevia(true);
    cfg.ligar(peca, atualizar);

    /* com a árvore no molde: a do seletor do cabeçalho, solta no painel, marcada com cfg.ids e a companhia de cada
       pelotão e, para quem é de companhia ou pelotão, começando na companhia */
    if (form.arvore && RW.seletorUnidades && RW.impressaoUnidades) {
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
      RW.impressaoUnidades.montar(form.seletor, peca('toggle'), cfg.ids || []).then(function () {
        /* o formulário saiu ou reabriu enquanto carregava (na sub-tela, também a troca de aba do painel) */
        if (form !== ref || !ref.arvore.isConnected) return;
        atualizar();
      });
    }
  }

  RW.impressao = { montar: montar, esquecer: esquecer, atualizar: atualizar, contarFolhas: contarFolhas };
})();
