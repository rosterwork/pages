/* ============================================================
   ESCALAS — o Salvar do painel do dia (as abas Funções, Militares,
   Ciclo e Extrajornada) e da célula da grade, com o painel fechado
   (escalas-celula-editar.js, no rascunho do Dia; o dia do rodapé é o
   dela). As mudanças de cada aba ficam no rascunho dela
   (as Funções e a Militares, um rascunho só, em
   escalas-painel-editar.js, o Ciclo em escalas-painel-ciclo.js, a
   Extrajornada no rascunho do mês, escalas-painel-extra.js, e o
   sobreaviso da companhia, no bloco dele da aba Funções,
   escalas-painel-sobreaviso.js); trocar de aba não perde nada, e
   trocar de dia também: o rascunho de cada dia fica guardado na gaveta
   (escalas-rascunho-dias.js). O rodapé largo da página
   (.escala-rodape-salvar) mostra "N alterações não
   salvas" (com mais de um dia, "em M dias"), o Desfazer e o Refazer
   (nas Funções, na Militares e na célula, os passos do Dia e do
   Sobreaviso de todos os dias numa ordem só; nas Guarnições e na
   Extrajornada, os delas; também o Ctrl+Z e o
   Ctrl+Y; o rodapé fica enquanto há o que refazer), o Cancelar (descarta
   todos os dias, com a confirmação) e o Salvar, que grava tudo de uma
   vez, tudo ou nada: um dia pelo escala_painel_salvar, vários pelo
   escala_painel_salvar_dias (o cartão das etapas, o período lido de
   novo e um resumo só, cada bloco com o dia dele). O dia que mudou no
   banco depois da leitura tira só o rascunho daquele dia, e o aviso
   diz qual foi. Só o Dia que não muda a escala
   (as observações): as etapas no rodapé, e só aquele dia é lido de
   novo na grade (escalas-dia-na-grade.js); com o Ciclo ou a
   Extrajornada, e com o Dia que muda a escala (o banco refaz também
   os dias seguintes, porque o rodízio conta o que cada um fez no dia),
   o cartão das etapas sobre a tela (geral-etapas.js), e o período é
   lido de novo, com a grade na tela; nessa leitura, o dia salvo (e o
   outro dia da mudança de dia, e o dia da extra mexida na célula) vem
   com o dado real, nunca com a cópia guardada velha, e sem a borda
   amarela, em todas as unidades dele na tela (os dias certos,
   escalas-dados.js e escalas-atualizando.js).
   Depois, o resumo com o que cada parte gravou. Enquanto há mudança,
   as telas da Escala mostram o rascunho
   (a prévia, escala_previa, pela escalas-dados.js) e o dia mudado
   leva a borda tracejada (na mudança de dia, os dois dias, e a grade
   lê o período); quando o rascunho muda de verdade, as telas são
   avisadas meio segundo depois do último clique
   (rosterwork_escala_previa, com os dias que mudam); abrir, fechar ou
   trocar de dia ou de
   aba sem mudança não as faz ler de novo. As sub-telas e o lápis põem
   a mudança no rascunho enquanto se responde; com uma pergunta pela
   metade, um conflito ou alguém acima da cota da extra, o Salvar fica
   desligado. A página tem um
   rodapé só: o do painel (fora dele, na largura toda) só aparece no
   que grava na hora (o Remover › por troca), e enquanto aparece o da
   página some; as alterações manuais do dia ficam no fim do corpo do
   Dia.
   API: RosterWork.escalasPainelSalvar.rodape(rodape) limpa e
   esconde o rodapé do painel ao entrar numa aba;
   .atualizar() redesenha o rodapé da página; .contar() soma as
   mudanças de todos os dias e da Extrajornada; .pendente() diz se há
   mudança em algum dia; .descartar() tira o rascunho carregado em cada
   parte; .descartarTudo() tira também o dos dias guardados;
   .paraPrevia() dá o rascunho para a prévia das
   telas (null sem mudança); .marcado(unidade, dia) diz se o dia leva a
   borda; .mostrarRelendo(sim) diz no rodapé que a escala está sendo
   lida com o rascunho.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var salvando = false;
  var espera = null;   // o aviso às telas, meio segundo depois do último clique
  var mostrado = '';   // o rascunho que as telas mostram (marcaDaPrevia; vazio: o gravado)
  var linhaNoRodape = null;   // as etapas no lugar do texto do rodapé (o Salvar só do Dia, a prévia que lê o período)

  function msg() { return RW.mensagens.escala; }
  function E() { return RW.escalasPainelEditar; }
  function C() { return RW.escalasPainelCiclo; }
  function X() { return RW.escalasPainelExtra; }
  function S() { return RW.escalasPainelSobreaviso; }
  /* a gaveta dos dias (escalas-rascunho-dias.js): o rascunho de cada dia */
  function G() { return RW.escalasRascunhoDias || null; }
  /* o dia do rodapé: o do painel aberto ou, com ele fechado, o da célula da grade (escalas-celula-editar.js) ou o da que
     mexeu na extra (escalas-celula-extra.js) */
  function contexto() {
    var p = RW.escalasPainel && RW.escalasPainel.contexto ? RW.escalasPainel.contexto() : null;
    return p || (RW.escalasCelulaEditar ? RW.escalasCelulaEditar.contexto() : null) || (X() ? X().naCelula() : null);
  }
  function celula() { return RW.escalasCelulaEditar || null; }

  /* ---------- o que falta salvar ---------- */

  /* os dias com mudança (o carregado em cada parte e os guardados na gaveta): [{ unidadeId, iso, dia, ciclo, sobreaviso }]
     (o item de cada parte, ou null). A conta é feita uma vez por vez de trabalho do navegador (a grade pergunta a borda de
     cada célula) e de novo a cada mudança do rascunho */
  var diasNaVez = null;
  function dias() {
    if (!G()) return [];
    if (!diasNaVez) {
      diasNaVez = G().porDia();
      Promise.resolve().then(function () { diasNaVez = null; });
    }
    return diasNaVez;
  }
  function mesmo(d, unidadeId, iso) { return !!d && String(d.unidadeId) === String(unidadeId) && d.iso === iso; }
  /* as contas de um item do Dia (o carregado ou um guardado na gaveta) e a lista de um item do Ciclo */
  function noDia(item, fn) { return E().noDia(item, fn); }
  function listaCiclo(item) { return C().gaveta.lista(item); }
  /* o Dia de um item para a prévia: o do Salvar, as funções abertas e o "antes" (com outros dias, o banco junta a camada
     manual de cada um sobre a do outro) */
  function previaDe(item) {
    return noDia(item, function () { var r = E().previaDia(); r.antes = E().antesDoDia(); return r; });
  }

  function contar() { return (G() ? G().contar() : 0) + (contexto() && X() ? X().contar() : 0); }
  /* o Dia, o Ciclo e o Sobreaviso de todos os dias (trocar de dia não perde nada; fechar o painel, trocar de mês e sair da
     página perguntam antes); a Extrajornada é do mês */
  function pendente() { return !!G() && G().contar() > 0; }
  /* o rascunho carregado em cada parte sai (o dia mudou no banco); o Salvar e o Cancelar tiram também os guardados */
  function descartar() {
    if (E()) E().descartar();
    if (S()) S().descartar();
    if (C()) C().limpar();
  }
  /* o Cancelar, fechar o painel e trocar de mês: todos os dias */
  function descartarTudo() {
    if (G()) G().descartar(false);
    descartar();
  }

  /* o rascunho para a prévia das telas: { unidadeId, iso, dia, ciclo, extra, outros, dias } (cada parte nula sem mudança),
     ou null. O dia aberto (o do painel ou o da célula; sem ele, o primeiro com mudança) vai com o dia e o ciclo dele;
     outros = os outros dias que o Dia dele muda (a mudança de dia); dias = os outros dias com mudança, no formato do
     escala_painel_salvar_dias. Quem passou da cota fica fora: o banco recusaria */
  function paraPrevia() {
    var lista = dias(), c = contexto() || lista[0];
    var extra = X() ? X().paraPrevia() : null;
    if (!c || (!lista.length && !extra)) return null;
    var dia = null, ciclo = null, outros = [], resto = [];
    lista.forEach(function (d) {
      var esteDia = d.dia ? previaDe(d.dia) : null, esteCiclo = d.ciclo ? C().envio(listaCiclo(d.ciclo)) : null;
      if (mesmo(d, c.unidadeId, c.iso)) {
        dia = esteDia;
        ciclo = esteCiclo;
        outros = d.dia ? noDia(d.dia, E().outrosDias) : [];
      } else if (esteDia || esteCiclo) {
        resto.push({ unidade_id: Number(d.unidadeId), data: d.iso, dia: esteDia, ciclo: esteCiclo });
      }
    });
    if (!dia && !ciclo && !extra && !resto.length) return null;
    return { unidadeId: c.unidadeId, iso: c.iso, dia: dia, ciclo: ciclo, extra: extra, outros: outros, dias: resto };
  }
  /* a borda tracejada: cada dia com mudança, o outro dia da mudança de dia, os dias da unidade que o rascunho das
     guarnições muda (da primeira data dele em diante) e os dias do rascunho da Extrajornada; sem a unidade (null), em
     qualquer unidade (a Minha escala) */
  function marcado(unidadeId, iso) {
    var achou = dias().some(function (d) {
      if (unidadeId != null && String(d.unidadeId) !== String(unidadeId)) return false;
      if (d.iso === iso) return true;
      if (d.dia && noDia(d.dia, E().outrosDias).indexOf(iso) >= 0) return true;
      return unidadeId != null && !!d.ciclo && listaCiclo(d.ciclo).some(function (x) { return iso >= (x.data || d.iso); });
    });
    return achou || !!(X() && X().marcado(unidadeId, iso));
  }

  /* ---------- os rodapés ---------- */

  /* o rodapé do painel ao entrar numa aba: limpo e escondido (o painel não tem rodapé próprio; ele só aparece no que grava
     na hora, e o Salvar é o rodapé largo da página) */
  function rodape(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('oculto');
  }

  /* o Desfazer e o Refazer da aba aberta: nas Funções e na Militares (e na célula da grade), os passos do Dia e do
     Sobreaviso de todos os dias, numa ordem só (escalas-rascunho-dias.js; com uma sub-tela aberta, esperam); as Guarnições
     e a Extrajornada, os delas. Devolve { podeDesfazer(), podeRefazer(), desfazer(), refazer() }, ou null */
  function daAba() {
    var c = contexto(), s = c && c.secao;
    var x = X() ? { podeDesfazer: X().podeDesfazer, podeRefazer: X().podeRefazer, desfazer: X().desfazer, refazer: X().refazer } : null;
    var dosDias = G() && E() && !E().emSub() ? { podeDesfazer: G().podeDesfazer, podeRefazer: G().podeRefazer, desfazer: G().desfazer, refazer: G().refazer } : null;
    /* com o painel fechado (a célula da grade, a extra mexida nela, ou nada aberto, com o rascunho esperando o Salvar), os
       passos dos dias; sem nada a desfazer neles, a extra */
    if (!RW.painel.estaAberto()) return dosDias && (dosDias.podeDesfazer() || dosDias.podeRefazer()) ? dosDias : x;
    if (s === 'distribuicao' || s === 'militares') return dosDias;
    if ((s === 'continuos' || s === 'volta') && C()) {
      return { podeDesfazer: function () { return C().podeDesfazer(c.unidadeId, c.iso); }, podeRefazer: function () { return C().podeRefazer(c.unidadeId, c.iso); },
        desfazer: C().desfazer, refazer: C().refazer };
    }
    return s === 'extra' ? x : null;
  }
  /* o Desfazer (ou o Refazer) do rodapé e do teclado: um passo na aba aberta */
  function voltar(desfazer) {
    var h = daAba();
    if (!h || salvando || !(desfazer ? h.podeDesfazer() : h.podeRefazer())) return;
    if (desfazer) h.desfazer(); else h.refazer();
    atualizar();
  }

  /* o rodapé largo da página (o primeiro da página aberta); os botões ligam uma vez só */
  function rodapePagina() {
    var el = document.querySelector('.conteudo .escala-rodape-salvar');
    if (el && !el.hasAttribute('data-ligado')) {
      el.setAttribute('data-ligado', '');
      el.querySelector('.escala-painel-cancelar').addEventListener('click', perguntarCancelar);
      el.querySelector('.escala-painel-desfazer').addEventListener('click', function () { voltar(true); });
      el.querySelector('.escala-painel-refazer').addEventListener('click', function () { voltar(false); });
      var salvar = el.querySelector('.escala-painel-salvar');
      salvar.addEventListener('click', function () { gravar(salvar); });
    }
    return el;
  }

  /* depois de uma mudança em qualquer aba: o rodapé da página mostra a conta ou some */
  function atualizar() {
    var el = rodapePagina();
    if (!el) return;
    var n = contar(), h = daAba();
    var passou = X() ? X().passou() : null;
    /* enquanto grava, o rodapé fica (a conta das mudanças já pode ter zerado), e também enquanto há o que refazer */
    el.classList.toggle('oculto', !n && !salvando && !(h && h.podeRefazer()));
    el.querySelector('.escala-painel-desfazer').disabled = salvando || !h || !h.podeDesfazer();
    el.querySelector('.escala-painel-refazer').disabled = salvando || !h || !h.podeRefazer();
    /* com as etapas no lugar do texto, ele volta quando elas terminam */
    if (!linhaNoRodape) {
      var texto = el.querySelector('.escala-rodape-salvar-texto');
      /* o que o rascunho da extra faz com as cotas, em amarelo; quem passou da cota vem primeiro */
      var frase = !passou && X() && X().contar() ? RW.extrajornadaGrade.fraseDasCotas() : '';
      /* com mais de um dia, quantos: "5 alterações não salvas em 3 dias" */
      var m = G() ? G().datas() : 0;
      texto.textContent = passou ? RW.mensagens.extrajornada.org.passouRodape(passou.nome, passou.n)
        : n ? msg().alteracoesNaoSalvas(n) + (m > 1 ? ' ' + msg().emDias(m) : '') + (frase ? '. ' + frase : '') : '';
      texto.classList.toggle('extrajornada-painel-rodape-erro', !!passou);
      texto.classList.toggle('extrajornada-painel-rodape-alerta', !!frase);
    }
    el.querySelector('.escala-painel-cancelar').disabled = salvando;
    el.querySelector('.escala-painel-salvar').disabled = salvando || !!passou || !!(E() && E().travado());
  }

  /* o que as telas mostram do rascunho (vazio sem mudança): o Dia e o Ciclo de cada dia com mudança (unidade|dia: { dia,
     ciclo, outros }) e a Extrajornada, do mês (abrir ou trocar de dia sem mudança não muda as telas) */
  function marcaDaPrevia() {
    var porDia = {}, extra = X() ? X().marca() : '';
    dias().forEach(function (d) {
      if (!d.dia && !d.ciclo) return;
      porDia[d.unidadeId + '|' + d.iso] = { dia: d.dia ? previaDe(d.dia) : null, ciclo: d.ciclo ? C().envio(listaCiclo(d.ciclo)) : null,
        outros: d.dia ? noDia(d.dia, E().outrosDias) : [] };
    });
    if (!Object.keys(porDia).length && !extra) return '';
    return JSON.stringify([porDia, extra]);
  }

  /* os dias que mudam nas telas de uma marca para a outra: [{ unidadeId, iso }] (só os dias cujo rascunho mudou, com o
     outro dia da mudança de dia); com o Ciclo ou a Extrajornada, que mexem em muitos dias, null (o período todo) */
  function diasDaPrevia(antes, agora) {
    var a = antes ? JSON.parse(antes) : [{}, ''], b = agora ? JSON.parse(agora) : [{}, ''];
    if (a[1] || b[1]) return null;
    var lista = [], muitos = false;
    function por(unidadeId, iso) {
      if (!lista.some(function (d) { return d.unidadeId === unidadeId && d.iso === iso; })) lista.push({ unidadeId: unidadeId, iso: iso });
    }
    Object.keys(a[0]).concat(Object.keys(b[0])).forEach(function (k) {
      var x = a[0][k] || null, y = b[0][k] || null;
      if (JSON.stringify(x) === JSON.stringify(y)) return;
      if ((x && x.ciclo) || (y && y.ciclo)) muitos = true;
      var p = k.split('|');
      por(p[0], p[1]);
      ((x && x.outros) || []).concat((y && y.outros) || []).forEach(function (iso) { por(p[0], iso); });
    });
    return muitos ? null : lista;
  }

  /* o rascunho mudou: o rodapé na hora, e as telas meio segundo depois do último clique (cada uma pede a prévia), só se
     o que elas mostram mudou. O dia mexido já mostra a espera no clique (escalas-dia-na-grade.js), também quando a grade
     relê o período todo; se o rascunho voltou ao que a tela mostra, a espera sai. Durante a gravação as telas esperam:
     elas leem no fim dela, e a recusa volta a passar aqui */
  function mudou() {
    diasNaVez = null;   // a conta dos dias é feita de novo
    atualizar();
    if (espera) clearTimeout(espera);
    var c = contexto(), D = RW.escalasDiaNaGrade;
    if (!salvando && c && D && marcaDaPrevia() !== mostrado) D.refazendo(c.unidadeId, c.iso);
    espera = setTimeout(function () {
      espera = null;
      if (salvando) return;
      var marca = marcaDaPrevia();
      if (marca === mostrado) { if (c && D && !linhaNoRodape) D.semMudanca(c.unidadeId, c.iso); return; }
      var dias = diasDaPrevia(mostrado, marca);
      mostrado = marca;
      window.dispatchEvent(new CustomEvent('rosterwork_escala_previa', { detail: { dias: dias } }));
    }, 500);
  }

  /* a prévia lê o período todo: o rodapé diz o que está acontecendo no lugar da conta, que volta quando a grade chega */
  function mostrarRelendo(sim) {
    if (salvando) return;
    if (!sim) {
      if (!linhaNoRodape) return;
      linhaNoRodape.parar();
      linhaNoRodape = null;
      atualizar();
      return;
    }
    var el = rodapePagina();
    if (linhaNoRodape || !el || !contar()) return;
    linhaNoRodape = linhaDasEtapas(el, 'previaPeriodo');
  }

  /* as etapas no lugar do texto do rodapé */
  function linhaDasEtapas(el, chave, valores, opcoes) {
    var texto = el.querySelector('.escala-rodape-salvar-texto');
    texto.classList.remove('extrajornada-painel-rodape-erro', 'extrajornada-painel-rodape-alerta');
    return RW.etapas.linha(texto, chave, valores, opcoes);
  }

  /* ---------- Cancelar e Salvar ---------- */

  function perguntarCancelar() {
    if (salvando) return;
    RW.confirmar({
      tipo: 'aviso',
      mensagem: msg().painelDescartar(contar()),
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () {
        if (celula()) celula().esquecer();
        descartarTudo();
        if (X()) X().descartar();
        redesenharAba();
        mudou();
      }
    });
  }

  /* a aba Ciclo ou Extrajornada aberta lê de novo (o Dia se redesenha sozinho); a volta de férias, que é a sugestão desse
     rascunho, fecha (escalas-painel-volta.js) */
  function redesenharAba() {
    var c = contexto();
    if (c && c.secao === 'volta' && RW.painel.estaAberto()) { RW.painel.fechar(); return; }
    if (c && (c.secao === 'continuos' || c.secao === 'extra') && RW.escalasPainel.recarregarSecao) RW.escalasPainel.recarregarSecao();
  }

  /* os registros das partes num resumo só: as mudanças de todas, com o autor e a hora do primeiro. Com vários dias, cada
     bloco leva o título do registro dele na frente ("Escala de 20/11 · ABTR-14462"), e o resumo fica sem o título geral.
     A linha "Escala do 1ºPEL refeita a partir de" vem de todos os registros, uma por unidade, com a data mais cedo */
  function juntarLogs(logs, variosDias) {
    if (!logs.length) return null;
    if (logs.length === 1) return logs[0];
    var log = JSON.parse(JSON.stringify(logs[0]));
    log.resumo = { titulo: variosDias ? '' : logs[0].resumo && logs[0].resumo.titulo, alvos: [] };
    var refeitas = {}, ordem = [];
    logs.forEach(function (l) {
      var titulo = (l.resumo && l.resumo.titulo) || '';
      ((l.resumo && l.resumo.alvos) || []).forEach(function (alvo) {
        log.resumo.alvos.push(variosDias && titulo ? Object.assign({}, alvo, { onde: titulo + ' · ' + (alvo.onde || '') }) : alvo);
      });
      ((l.resumo && l.resumo.escalas_refeitas) || []).forEach(function (r) {
        var chave = String(r.unidade_id);
        if (!refeitas[chave]) { refeitas[chave] = Object.assign({}, r); ordem.push(chave); }
        else if (r.desde < refeitas[chave].desde) refeitas[chave].desde = r.desde;
      });
    });
    if (ordem.length) log.resumo.escalas_refeitas = ordem.map(function (chave) { return refeitas[chave]; });
    return log;
  }

  /* o nome da unidade nas etapas: "1ªCIBM / 2ºPEL" vira "2ºPEL" */
  function nomeCurto(c) { return (c.unidadeNome || '').split('/').pop().trim(); }

  /* o que aparece enquanto grava: só o Dia, as etapas no rodapé, com o dia sendo refeito na grade ("Refazendo a
     distribuição" só quando o banco refaz); com o Ciclo ou a Extrajornada, que mudam muitos dias, e com o Dia que refaz
     os dias seguintes, o cartão sobre a tela. refaz = o Dia refaz a distribuição do dia */
  function mostrarEtapas(c, ciclo, soDoDia, extra, seguintes, refaz) {
    if (linhaNoRodape) linhaNoRodape.parar();
    linhaNoRodape = null;
    if (ciclo) return RW.etapas.acao('salvarCiclo', { unidade: nomeCurto(c) }, { doServidor: 2 });
    if (!soDoDia && extra) return RW.etapas.acao('salvarExtra', null, { doServidor: 2 });
    if (seguintes) {
      return RW.etapas.acao('salvarDiaSeguintes', { dia: RW.data.isoParaBR(c.iso).slice(0, 5), unidade: nomeCurto(c), refaz: refaz },
        { doServidor: refaz ? 3 : 2 });
    }
    /* o sobreaviso refaz a fila dos dias seguintes: o período é lido de novo */
    if (!soDoDia) return RW.etapas.acao('salvarSobreaviso', null, { doServidor: 2 });
    linhaNoRodape = linhaDasEtapas(rodapePagina(), 'salvarDia',
      { dia: RW.data.isoParaBR(c.iso).slice(0, 5), unidade: nomeCurto(c), refaz: refaz },
      { doServidor: refaz ? 2 : 1, atraso: refaz ? 0 : 300 });
    RW.escalasDiaNaGrade.refazendo(c.unidadeId, c.iso);
    return linhaNoRodape;
  }
  /* vários dias: o cartão, com as datas ("Refazendo os dias seguintes" só quando um deles refaz) */
  function mostrarEtapasDias(ds, refaz) {
    if (linhaNoRodape) linhaNoRodape.parar();
    linhaNoRodape = null;
    var datas = [];
    ds.forEach(function (d) { var t = RW.data.isoParaBR(d.iso).slice(0, 5); if (datas.indexOf(t) < 0) datas.push(t); });
    return RW.etapas.acao('salvarDias', { dias: datas, refaz: refaz }, { doServidor: refaz ? 2 : 1 });
  }

  /* as telas leem de novo: só o Dia, só aquele dia nas colunas à vista; senão (a mudança de dia, que muda dois dias, ou
     numa grade sem célula por dia), o período, com a grade na tela, e os dias salvos já certos (lerCertos). A promessa
     se cumpre com a tela nova, e nunca falha */
  function telasLeem(c, soDoDia, doisDias, salvos) {
    var grade = RW.escalasDiaNaGrade, umDia = soDoDia && !doisDias && grade.temCelulas();
    var certos = !umDia && grade.temCelulas() && lerCertos(salvos);
    window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: c.unidadeId, iso: c.iso, soDoDia: umDia, certos: certos } }));
    return umDia ? grade.salvou(c.unidadeId, c.iso) : grade.relerPeriodo();
  }

  /* os dias que o Salvar grava e a tela já mostra mudados: o dia de cada Dia e o outro dia da mudança de dia, e o dia da
     extra mexida na célula (a da aba Extrajornada e o Ciclo mudam muitos dias e ficam de fora) */
  function diasSalvos(ds, extra) {
    var lista = [];
    ds.forEach(function (d) {
      if (!d.dia) return;
      [d.iso].concat(noDia(d.dia, E().outrosDias)).forEach(function (iso) { if (lista.indexOf(iso) < 0) lista.push(iso); });
    });
    var naCelula = extra && X() ? X().naCelula() : null;
    if (naCelula && lista.indexOf(naCelula.iso) < 0) lista.push(naCelula.iso);
    return lista;
  }

  /* o que vai ao banco, um item por unidade e dia (o formato do escala_painel_salvar_dias); ler: o dia carregado no Dia (o
     painel ou a célula põem o dia gravado na tela) */
  function paraGravar(ds) {
    return ds.map(function (d) {
      return { unidade_id: Number(d.unidadeId), data: d.iso, dia: d.dia ? noDia(d.dia, E().paraGravar) : null,
        ciclo: d.ciclo ? C().envio(listaCiclo(d.ciclo)) : null, sobreaviso: d.sobreaviso ? S().gaveta.envio(d.sobreaviso) : null,
        ler: !!(d.dia && d.dia.vivo) };
    });
  }
  /* o dia de um item do Salvar ({ unidadeId, iso, unidadeNome }): o aberto, se for ele; senão, com o nome da célula dele */
  function diaDoItem(e, c) {
    if (c && mesmo(c, e.unidade_id, e.data)) return c;
    var cel = document.querySelector('.conteudo .escala-mes-celula[data-unidade-id="' + e.unidade_id + '"]');
    return { unidadeId: String(e.unidade_id), iso: e.data, unidadeNome: cel ? cel.getAttribute('data-unidade-nome') || '' : '' };
  }

  /* gravou: os guardados saem, e cada parte recomeça do gravado; o Dia carregado, do dia lido de volta (o aberto que não
     foi gravado é lido de novo: os dias de antes podem tê-lo mudado) */
  function aposGravar(lido) {
    var vivo = E() ? E().gaveta.vivo() : null;
    if (G()) G().descartar(true);
    if (celula()) celula().esquecer();
    if (S()) S().aposGravar();
    if (E()) {
      if (lido && vivo && mesmo(vivo, lido.unidadeId, lido.iso)) E().aposGravar({ dia: lido.dia, mudou: lido.mudou });
      else E().descartar();
    }
    if (C()) C().limpar();
    if (X()) X().descartar();   // gravou: a extra é lida de novo, com o que mudou
  }
  /* o dia que mudou no banco depois da leitura: o rascunho dele sai (o carregado lê o dia de novo); os outros dias ficam */
  function tirarDia(unidadeId, iso) {
    var d = dias().filter(function (x) { return mesmo(x, unidadeId, iso); })[0];
    if (!d) return;
    ['dia', 'ciclo', 'sobreaviso'].forEach(function (parte) {
      var item = d[parte];
      if (!item) return;
      if (!item.vivo) { G().soltar(parte, item.chave, false); return; }
      if (parte === 'dia') { if (celula()) celula().esquecer(); E().descartar(); }
      else if (parte === 'ciclo') C().limpar();
      else S().descartar();
    });
  }

  /* a grade relida inteira: os dias salvos são lidos com o dado real, em todas as unidades deles na tela, para entrar no
     lugar da cópia guardada velha (escalas-dados.js), e ficam sem a borda amarela (escalas-atualizando.js). Devolve se
     pediu algum */
  function lerCertos(dias) {
    var chaves = [];
    dias.forEach(function (iso) {
      var ids = RW.escalasDiaNaGrade.unidadesDoDia(iso);
      if (!ids.length) return;
      RW.escalasDados.lerCerto(ids, iso);
      ids.forEach(function (id) { chaves.push(id + '|' + iso); });
    });
    if (chaves.length && RW.escalaAtualizando) RW.escalaAtualizando.certos(chaves);
    return chaves.length > 0;
  }

  /* grava mostrando as etapas e, gravado, põe o dia gravado no painel e avisa as telas: um dia pelo escala_painel_salvar
     (o resumo traz a linha das escalas refeitas); vários dias pelo escala_painel_salvar_dias, tudo ou nada, com o cartão e o
     período lido de novo. ds = os dias (dias()), lista = o que vai ao banco (paraGravar). O clique fica travado até as
     telas lerem (iniciarCarregando). Devolve uma Promise com { ok, r } ou { ok: false, erro, desatualizado } (quem chama
     avisa). O dia que mudou depois da leitura (outro administrador ou o sistema) tira o rascunho daquele dia e lê de novo */
  function enviar(c, ds, lista, extra, botao) {
    var umDia = lista.length <= 1, e = lista[0] || null, d = ds[0] || null;
    var alvo = e ? diaDoItem(e, c) : c;
    var dia = e && e.dia, ciclo = e && e.ciclo, sobreaviso = e && e.sobreaviso;
    /* o Dia que muda a escala: o banco refaz também os dias seguintes (o rodízio conta o que cada um fez no dia); como o
       Ciclo, o cartão na hora e o período lido de novo */
    var seguintes = umDia && !ciclo && !extra && !sobreaviso && !!dia && noDia(d.dia, E().refazDiasSeguintes);
    var soDoDia = umDia && !ciclo && !extra && !sobreaviso && !seguintes;
    /* a mudança de dia (a gravação muda outro dia também) e vários dias: o período é lido de novo */
    var doisDias = !umDia || (!!dia && noDia(d.dia, E().outrosDias).length > 0);
    var salvos = diasSalvos(ds, extra);   // antes de o rascunho sair
    salvando = true;
    var etapas = umDia ? mostrarEtapas(alvo, !!ciclo, soDoDia, extra, seguintes, !!dia && noDia(d.dia, E().refazDistribuicao))
      : mostrarEtapasDias(ds, lista.some(function (x) { return x.ciclo || x.sobreaviso; })
          || ds.some(function (x) { return x.dia && noDia(x.dia, E().refazDiasSeguintes); }));
    atualizar();
    if (botao) RW.iniciarCarregando(botao);
    /* o fim: a linha do rodapé completa em segundo plano os dias distantes do recálculo (a fila em blocos), como o cartão */
    function terminar() {
      salvando = false;
      etapas.parar();
      if (soDoDia) {
        linhaNoRodape = null;
        RW.escalasDiaNaGrade.parou(alvo.unidadeId, alvo.iso);
        RW.marcarRecalculoPendente();
        RW.drenarRecalculo();
      }
      if (botao) RW.pararCarregando(botao);
    }
    var pedido = umDia ? RW.escalasDados.painelSalvar(alvo.unidadeId, alvo.iso, dia, ciclo, extra, sobreaviso)
      : RW.escalasDados.painelSalvarDias(lista, extra);
    return pedido.then(function (r) {
      var geral = RW.mensagens.geral;
      if (r && r._falha) { terminar(); mudou(); return { ok: false, erro: r._falha === 'conexao' ? geral.semConexao : geral.falhaServidor }; }
      if (!r || !r.success) {
        terminar();
        if (r && r.desatualizado) {
          var qual = umDia ? alvo : { unidadeId: String(r.unidade_id), iso: r.data };
          tirarDia(qual.unidadeId, qual.iso);
          redesenharAba();
          mudou();
          return { ok: false, desatualizado: true, erro: umDia ? msg().diaDesatualizado
            : msg().diaDesatualizadoDe(RW.data.isoParaBR(qual.iso).slice(0, 5), nomeCurto(diaDoItem({ unidade_id: qual.unidadeId, data: qual.iso }, c))) };
        }
        mudou();
        return { ok: false, erro: msg().painelRecusado((r && r.error) || msg().falhaSalvar) };
      }
      /* o dia lido de volta: o do Salvar de um dia, ou o pedido (ler) entre os vários */
      var volta = umDia ? (r.dia ? { unidadeId: alvo.unidadeId, iso: alvo.iso, dia: r.dia, mudou: r.mudou } : null)
        : (r.dias || []).filter(function (x) { return x.dia; }).map(function (x) {
          return { unidadeId: String(x.unidade_id), iso: x.data, dia: x.dia, mudou: x.mudou };
        })[0] || null;
      aposGravar(volta);
      if (espera) { clearTimeout(espera); espera = null; }
      mostrado = marcaDaPrevia();   // as telas leem de novo logo abaixo, já sem o que foi gravado
      atualizar();
      etapas.ultima();
      return telasLeem(alvo, soDoDia, doisDias, salvos).then(function () {
        terminar();
        atualizar();
        redesenharAba();
        return { ok: true, r: r };
      });
    });
  }

  function avisarFalha(res) { RW.avisar({ tipo: res.desatualizado ? 'aviso' : 'erro', mensagem: res.erro }); }

  function gravar(botao) {
    var c = contexto();
    if (salvando || (E() && E().travado())) return;
    var ds = dias(), lista = paraGravar(ds), extra = X() ? X().envio() : null;
    if (!lista.length && (!extra || !c)) return;   // a extra sozinha vai pelo dia aberto
    var datas = G() ? G().datas() : 0;
    enviar(c, ds, lista, extra, botao).then(function (res) {
      if (!res.ok) { avisarFalha(res); return; }
      var log = juntarLogs(res.r.logs || [], datas > 1);
      if (log && RW.resumo) RW.resumo.abrirModal(log, { pagina: 'Escala' });
    });
  }

  /* o Ctrl+Z desfaz e o Ctrl+Y (ou o Ctrl+Shift+Z) refaz o que o Desfazer e o Refazer do rodapé fariam (na aba aberta do
     painel do dia, no dia da célula da grade ou, com o painel fechado, no rascunho que espera o Salvar): fora dos campos de
     texto, sem a edição de uma linha aberta e sem janela de aviso aberta. O cartão aberto na célula fecha antes (o que
     estava concluído vira o passo que se desfaz) */
  document.addEventListener('keydown', function (e) {
    var rod = document.querySelector('.conteudo .escala-rodape-salvar');
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !rod) return;
    var noPainel = !!(RW.painel && RW.painel.estaAberto());
    var naCelula = !noPainel && !!((celula() && celula().contexto()) || (X() && X().naCelula()));
    /* sem o painel e sem a célula, só com o rodapé à vista (há o que salvar ou refazer) */
    if (!noPainel && !naCelula && rod.classList.contains('oculto')) return;
    if ((RW.escalasPainelLinha && RW.escalasPainelLinha.aberta()) || (S() && S().aberta())) return;
    var alvo = e.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
    if (document.querySelector('.modal-veu--aberto')) return;
    var tecla = (e.key || '').toLowerCase();
    var desfazer = tecla === 'z' && !e.shiftKey, refazer = tecla === 'y' || (tecla === 'z' && e.shiftKey);
    if (!desfazer && !refazer) return;
    e.preventDefault();
    if (naCelula) celula().fechar();
    voltar(desfazer);
  });

  /* qualquer aviso dos rascunhos (também o painel que abre ou fecha) redesenha o rodapé; as telas, só com mudança */
  window.addEventListener('rosterwork_escala_rascunho', mudou);
  /* fechar ou recarregar o navegador, ou ir para outra página, com mudança no Dia ou no Ciclo: o aviso (só com a Escala na
     tela: saindo dela, a mudança fica para trás, e a célula da grade começa limpa na volta) */
  if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return !!document.querySelector('.conteudo #escala-modos') && pendente(); });

  RW.escalasPainelSalvar = { rodape: rodape, atualizar: atualizar, contar: contar, pendente: pendente,
    descartar: descartar, descartarTudo: descartarTudo, paraPrevia: paraPrevia, marcado: marcado, mostrarRelendo: mostrarRelendo };
})();
