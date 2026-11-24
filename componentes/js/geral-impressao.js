/* ============================================================
   COMPONENTE geral-impressao — o painel de impressão, um só para
   todas as impressões (o Imprimir escala e o das grades da Escala,
   o Imprimir trocas e, na Extrajornada, o Imprimir relatório e as cópias
   da tela; com a caixa "O que imprimir" no alto, cfg.escolha). A casca
   é do shell (#tpl-impressao e #tpl-impressao-acoes do index.html):
   no alto, a nota "Será impresso:" com o resumo e, embaixo dela, o
   aviso (o erro grave da escala); no meio, as caixas da impressão
   (o molde da página); por último, a Prévia (o próprio PDF, no
   leitor do navegador, cada folha inteira num quadro do formato dela,
   refeita a cada mudança, a última pedida vale,
   com as folhas embaixo; no celular não aparece) e o rodapé
   Cancelar · Imprimir · Gerar PDF (o Imprimir abre a janela de
   imprimir do navegador com o PDF da Prévia, na mesma aba, e não
   aparece no celular; o Gerar PDF baixa o mesmo arquivo). Aqui também: a
   numeração das caixas à vista (refeita a cada mudança, para a
   caixa que aparece ou some), o Mostrar (data-mostrar) e, quando o
   molde tem a árvore ([data-impressao-arvore]), as Unidades
   (geral-impressao-unidades.js).
   Cada impressão diz só o que é dela.
   API: RosterWork.impressao.montar(corpo, rodape, cfg), .esquecer(),
        .atualizar(), .contarFolhas(arquivo), .marcar(marcas) (troca o
        que vale do molde com o painel aberto; a numeração refaz no
        atualizar)
   cfg = { molde: o id do <template> com as caixas da impressão,
           marcas: o que vale do molde (data-impressao-so), opcional,
           ids: as unidades marcadas no começo (a companhia de cada pelotão entra junto), só com a árvore,
           mostrar: o começo do Mostrar ({ icones } ou { grafico, icones, faixa }), opcional,
           escolha: a caixa "O que imprimir" no alto (#tpl-impressao-escolha), opcional: { relatorio (o nome do
             relatório da tela), motivo (o que ainda o impede; vazio = pode), atual ('tela' ou 'relatorio'),
             aoTrocar(escolha) (quem abriu troca o painel) },
           aoSair: o Cancelar e o fim do Gerar PDF,
           ligar(peca, atualizar): liga as peças da impressão,
           estado(escolhas, marcarErros): { erro, avisar } ou { resumo, chave, montar, inicio, fim },
           conferir(escolhas, estado): opcional, resolve em { titulo, descricao } (o aviso) ou null }
   escolhas = { unidades (as marcadas que têm escala, na ordem da árvore), ids, mostrar };
   montar() resolve em { arquivo, nome, folhas (o texto da contagem) }; a falha pode trazer { mensagem }.
   estado.avisar: o erro também abre o aviso no Imprimir e no Gerar PDF (quando não há campo para marcar)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ESPERA = 400;   // ms sem mexer antes da prévia e da conferência
  var A4 = 297 / 210;  // a altura da folha A4 em vezes a largura (retrato; em paisagem, o inverso)
  var ESPERA_QUADRO = 10000;   // ms: o quadro da Prévia que não carrega nesse tempo conta como recusa do navegador

  /* o painel aberto: o cfg, o corpo e o rodapé, o seletor, o Mostrar, o arquivo pedido, a url da prévia, a chave do
     arquivo que está no quadro dela (e se ele já carregou) e o Imprimir que espera por ele */
  var form = null;
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

  /* a caixa "O que imprimir" (cfg.escolha): a Cópia da tela ou o relatório da tela, este apagado com o motivo na dica
     enquanto não libera; trocar devolve a escolha a quem abriu, que troca o painel */
  function ligarEscolha(caixa, escolha) {
    var seletor = caixa.querySelector('[data-impressao-escolha]');
    var relatorio = seletor.querySelector('[data-escolha="relatorio"]');
    relatorio.textContent = escolha.relatorio;
    relatorio.disabled = !!escolha.motivo;
    if (escolha.motivo) relatorio.setAttribute('data-dica', escolha.motivo);
    Array.prototype.forEach.call(seletor.querySelectorAll('[data-escolha]'), function (b) {
      b.classList.toggle('aba--ativa', b.getAttribute('data-escolha') === escolha.atual);
    });
    RW.abas.ligar(seletor, function (b) {
      var valor = b.getAttribute('data-escolha');
      if (valor !== escolha.atual) escolha.aoTrocar(valor);
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
        /* o que ainda pode mudar é amarelo; o erro grave segue vermelho */
        el.classList.toggle('impacto-aviso--alerta', aviso.nivel === 'alerta');
        el.classList.toggle('impacto-aviso--problema', aviso.nivel !== 'alerta');
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

  /* o formato da 1ª folha, lido no próprio PDF: 'paisagem', 'retrato' ou null (a página contínua, que não é folha A4) */
  function formatoDaFolha(arquivo) {
    return arquivo.text().then(function (texto) {
      var medida = texto.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
      if (!medida) return null;
      var proporcao = Number(medida[2]) / Number(medida[1]);
      if (Math.abs(proporcao - A4) < 0.02) return 'retrato';
      if (Math.abs(proporcao - 1 / A4) < 0.02) return 'paisagem';
      return null;
    }, function () { return null; });
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
      return formatoDaFolha(a.arquivo).then(function (folha) { a.folha = folha; return a; });
    }).then(function (a) {
      if (form !== ref || token !== tokenPrevia) return;
      if (form.url) URL.revokeObjectURL(form.url);
      form.url = URL.createObjectURL(a.arquivo);
      /* o leitor do navegador sem a barra dele: a folha A4 inteira, num quadro do formato dela (view para o Chrome,
         zoom para o Firefox); a página contínua, na largura do quadro */
      var quadro = peca('previa');
      quadro.parentNode.classList.toggle('impressao-previa--paisagem', a.folha === 'paisagem');
      quadro.parentNode.classList.toggle('impressao-previa--retrato', a.folha === 'retrato');
      /* o arquivo novo no quadro: o Imprimir que espera por ele conta o tempo a partir daqui */
      form.quadroChave = est.chave;
      form.quadroPronto = false;
      quadro.src = form.url + '#toolbar=0&navpanes=0&' + (a.folha ? 'view=Fit&zoom=page-fit' : 'view=FitH');
      if (form.aguardando && form.aguardando.chave === est.chave) vigiarQuadro();
      peca('previa-aviso').classList.add('oculto');
      peca('folhas').textContent = a.folhas || '';
      mostrarCarregandoPrevia(false);
    }, function (e) {
      if (form !== ref || token !== tokenPrevia) return;
      mostrarAvisoPrevia((e && e.mensagem) || msg().falhaPrevia);
      responderEspera(est.chave, e || {});
    });
  }

  /* o Imprimir pedido antes de a Prévia mostrar estas escolhas: espera o quadro carregar o arquivo delas. Se ele ainda
     não está no quadro, a prévia sai agora, sem a pausa (o mesmo arquivo, se já foi pedido) */
  function esperarQuadro(est) {
    return new Promise(function (ok, falha) {
      form.aguardando = { chave: est.chave, ok: ok, falha: falha, relogio: null };
      if (form.quadroChave === est.chave) { vigiarQuadro(); return; }
      clearTimeout(esperaPrevia);
      mostrarCarregandoPrevia(true);
      fazerPrevia(++tokenPrevia, est);
    });
  }

  /* o quadro que não carrega o arquivo em ESPERA_QUADRO conta como recusa do navegador */
  function vigiarQuadro() {
    var espera = form.aguardando;
    if (!espera || espera.relogio) return;
    espera.relogio = setTimeout(function () { responderEspera(espera.chave, { recusa: true }); }, ESPERA_QUADRO);
  }

  /* responde ao Imprimir que espera o arquivo desta chave: sem erro, o quadro carregou */
  function responderEspera(chave, erro) {
    var espera = form && form.aguardando;
    if (!espera || espera.chave !== chave) return;
    clearTimeout(espera.relogio);
    form.aguardando = null;
    if (erro) espera.falha(erro);
    else espera.ok();
  }

  /* ---------- imprimir, gerar e sair ---------- */
  /* as escolhas, com os erros marcados; null quando falta algo (o erro sem campo para marcar abre o aviso) */
  function validas() {
    var r = ler(true);
    if (!r.estado.erro) return r;
    if (r.estado.avisar && RW.avisar) RW.avisar({ tipo: 'erro', mensagem: r.estado.erro });
    return null;
  }

  /* a janela de imprimir do navegador com o PDF da Prévia, na mesma aba; o painel continua aberto (o navegador não
     conta se imprimiu ou cancelou). Com a Prévia ainda sem estas escolhas: os pontinhos no Imprimir na hora e o cartão
     das etapas só se passar de 1,5 s, até o quadro carregar o arquivo */
  function imprimir() {
    var r = validas();
    if (!r) return;
    if (form.quadroChave === r.estado.chave && form.quadroPronto) { mandarImprimir(); return; }
    var ref = form;
    var espera = RW.etapas.acao('pdfGerar', null, { doServidor: 1, botao: peca('imprimir'), atraso: true });
    esperarQuadro(r.estado).then(function () {
      return espera.parar().then(function () { if (form === ref) mandarImprimir(); });
    }, function (e) {
      espera.parar();
      if (form !== ref || !e) return;   // o formulário saiu da tela enquanto esperava
      if (e.recusa) abrirNaAba();
      else if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: e.mensagem || msg().falhaGerar });
    });
  }

  /* imprime o quadro da Prévia; o navegador que recusa abre o PDF numa aba nova, onde se imprime pelo leitor dele */
  function mandarImprimir() {
    try { peca('previa').contentWindow.print(); }
    catch (e) { abrirNaAba(); }
  }

  function abrirNaAba() {
    window.open(form.url, '_blank');
  }

  /* baixa o arquivo da prévia (ou monta agora, se ela ainda não saiu) */
  function gerar() {
    var r = validas();
    if (!r) return;
    var ref = form;
    var botao = peca('gerar');
    /* os pontinhos no Gerar PDF na hora e o cartão das etapas só se passar de 1,5 s */
    var espera = RW.etapas.acao('pdfGerar', null, { doServidor: 1, botao: botao, atraso: true });
    function terminar() { espera.parar(); }
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
    /* o Imprimir que esperava a Prévia desiste (os pontinhos saem) */
    if (form && form.aguardando) { clearTimeout(form.aguardando.relogio); form.aguardando.falha(null); }
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

  /* o Imprimir imprime a Prévia: sem ela (no celular), não aparece. O quadro avisa quando carregou o arquivo da vez */
  function ligarImprimir() {
    var ref = form;
    var quadro = peca('previa');
    var botao = peca('imprimir');
    botao.classList.toggle('oculto', !!(RW.celular && RW.celular()));
    botao.addEventListener('click', imprimir);
    quadro.addEventListener('load', function () {
      if (form !== ref || !form.url || quadro.src.indexOf(form.url) !== 0) return;
      form.quadroPronto = true;
      responderEspera(form.quadroChave);
    });
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
    var lugar = corpo.querySelector('[data-impressao-caixas]');
    var escolha = cfg.escolha ? RW.tpl('tpl-impressao-escolha') : null;
    if (escolha) lugar.parentNode.insertBefore(escolha, lugar);
    lugar.replaceWith(molde.content.cloneNode(true));
    if (escolha) ligarEscolha(escolha, cfg.escolha);
    if (rodape && acoes) { rodape.appendChild(acoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }
    var mostrar = {};
    Object.keys(cfg.mostrar || {}).forEach(function (k) { mostrar[k] = cfg.mostrar[k]; });
    form = { cfg: cfg, corpo: corpo, rodape: rodape, mostrar: mostrar, seletor: null, arquivo: null, url: null,
      quadroChave: null, quadroPronto: false, aguardando: null };
    form.arvore = peca('arvore');
    if (cfg.marcas) aplicarMarcas(cfg.marcas);
    numerarCaixas();
    ligarMostrar();
    peca('cancelar').addEventListener('click', sair);
    peca('gerar').addEventListener('click', gerar);
    ligarImprimir();
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

  /* com o painel aberto, outra escolha muda o que vale do molde (a orientação das grades troca a caixa do período) */
  function marcar(marcas) {
    if (form) aplicarMarcas(marcas);
  }

  RW.impressao = { montar: montar, esquecer: esquecer, atualizar: atualizar, contarFolhas: contarFolhas, marcar: marcar };
})();
