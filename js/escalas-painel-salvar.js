/* ============================================================
   ESCALAS — o Salvar do painel do dia (as abas Dia, Ciclo e
   Extrajornada). As mudanças de cada aba ficam no rascunho dela (o Dia
   em escalas-painel-editar.js, o Ciclo em escalas-painel-ciclo.js, a
   Extrajornada no rascunho do mês, escalas-painel-extra.js); trocar de
   aba não perde nada. O rodapé largo da página
   (.escala-rodape-salvar) mostra "N alterações não
   salvas" (com mudança na extra, também o motivo), o Cancelar (descarta
   tudo, com a confirmação) e o Salvar, que grava as três de uma vez,
   tudo ou nada (escala_painel_salvar). Só o Dia: as etapas no rodapé,
   e só aquele dia é lido de novo na grade (escalas-dia-na-grade.js);
   com o Ciclo ou a Extrajornada, o cartão das etapas sobre a tela
   (geral-etapas.js), e o período é lido de novo, com a grade na tela.
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
   mudanças das três; .contarDoDia() só as do Dia e do Ciclo;
   .pendente() diz se há mudança no Dia ou no Ciclo; .descartar() tira
   as do Dia e do Ciclo; .paraPrevia() dá o rascunho para a prévia das
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
  function contexto() { return RW.escalasPainel && RW.escalasPainel.contexto ? RW.escalasPainel.contexto() : null; }

  /* ---------- o que falta salvar ---------- */

  function doCiclo(c) { return c && C() ? C().doDia(c.unidadeId, c.iso) : []; }
  function contarDoDia() {
    var c = contexto();
    if (!c) return 0;
    return (E() ? E().pendentes() : 0) + doCiclo(c).length;
  }
  function contar() { return contarDoDia() + (contexto() && X() ? X().contar() : 0); }
  /* o Dia e o Ciclo são do dia aberto (trocar de dia, fechar o painel e sair da página perguntam antes); a Extrajornada
     é do mês (trocar de dia não perde nada; fechar o painel e sair da página perguntam) */
  function pendente() { return (E() ? E().pendentes() : 0) > 0 || doCiclo(contexto()).length > 0; }
  function descartar() {
    if (E()) E().descartar();
    if (C()) C().limpar();
  }

  /* o rascunho para a prévia das telas: { unidadeId, iso, dia, ciclo, extra, outros } (cada parte nula sem mudança), ou
     null. outros = os outros dias que o Dia muda (a mudança de dia). Quem passou da cota fica fora: o banco recusaria */
  function paraPrevia() {
    var c = contexto();
    if (!c || !contar()) return null;
    var dia = E() && E().pendentes() ? E().previaDia() : null;
    var ciclo = doCiclo(c).length ? C().envio() : null;
    var extra = X() ? X().paraPrevia() : null;
    if (!dia && !ciclo && !extra) return null;
    return { unidadeId: c.unidadeId, iso: c.iso, dia: dia, ciclo: ciclo, extra: extra, outros: dia ? E().outrosDias() : [] };
  }
  /* a borda tracejada: o dia aberto no painel (com mudança no Dia ou no Ciclo), o outro dia da mudança de dia e os dias do
     rascunho da Extrajornada; sem a unidade (null), em qualquer unidade (a Minha escala) */
  function marcado(unidadeId, iso) {
    var c = contexto();
    if (!c) return false;
    if (pendente() && (unidadeId == null || String(c.unidadeId) === String(unidadeId))) {
      if (c.iso === iso) return true;
      if (E() && E().pendentes() && E().outrosDias().indexOf(iso) >= 0) return true;
    }
    return !!(X() && X().marcado(unidadeId, iso));
  }

  /* ---------- os rodapés ---------- */

  /* o rodapé do painel ao entrar numa aba: limpo e escondido (o painel não tem rodapé próprio; ele só aparece no que grava
     na hora, e o Salvar é o rodapé largo da página) */
  function rodape(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('oculto');
  }

  /* o rodapé largo da página (o primeiro da página aberta); os botões ligam uma vez só */
  function rodapePagina() {
    var el = document.querySelector('.conteudo .escala-rodape-salvar');
    if (el && !el.hasAttribute('data-ligado')) {
      el.setAttribute('data-ligado', '');
      el.querySelector('.escala-painel-cancelar').addEventListener('click', perguntarCancelar);
      var salvar = el.querySelector('.escala-painel-salvar');
      salvar.addEventListener('click', function () { gravar(salvar); });
    }
    return el;
  }

  /* depois de uma mudança em qualquer aba: o rodapé da página mostra a conta ou some */
  function atualizar() {
    var el = rodapePagina();
    if (!el) return;
    var n = contar();
    var passou = X() ? X().passou() : null;
    /* enquanto grava, o rodapé fica (a conta das mudanças já pode ter zerado) */
    el.classList.toggle('oculto', !n && !salvando);
    /* com as etapas no lugar do texto, ele volta quando elas terminam */
    if (!linhaNoRodape) {
      var texto = el.querySelector('.escala-rodape-salvar-texto');
      /* o que o rascunho da extra faz com as cotas, em amarelo; quem passou da cota vem primeiro */
      var frase = !passou && X() && X().contar() ? RW.extrajornadaGrade.fraseDasCotas() : '';
      texto.textContent = passou ? RW.mensagens.extrajornada.org.passouRodape(passou.nome, passou.n)
        : n ? msg().alteracoesNaoSalvas(n) + (frase ? '. ' + frase : '') : '';
      texto.classList.toggle('extrajornada-painel-rodape-erro', !!passou);
      texto.classList.toggle('extrajornada-painel-rodape-alerta', !!frase);
    }
    var motivo = el.querySelector('.escala-rodape-motivo'), comExtra = !!(X() && X().contar());
    motivo.classList.toggle('oculto', !comExtra);
    if (!comExtra) motivo.querySelector('input').value = '';
    el.querySelector('.escala-painel-cancelar').disabled = salvando;
    el.querySelector('.escala-painel-salvar').disabled = salvando || !!passou || !!(E() && E().travado());
  }

  /* o que as telas mostram do rascunho (vazio sem mudança): o Dia e o Ciclo do dia aberto e a Extrajornada, do mês
     (trocar de dia com ela esperando não muda as telas) */
  function marcaDaPrevia() {
    var p = paraPrevia(), extra = X() ? X().marca() : '';
    if (!(p && (p.dia || p.ciclo)) && !extra) return '';
    return JSON.stringify([p && (p.dia || p.ciclo) ? [p.unidadeId, p.iso, p.dia, p.ciclo, p.outros] : null, extra]);
  }

  /* os dias que mudam nas telas de uma marca para a outra: [{ unidadeId, iso }] (com o outro dia da mudança de dia); com o
     Ciclo ou a Extrajornada, que mexem em muitos dias, null (o período todo) */
  function diasDaPrevia(antes, agora) {
    var dias = [], muitos = false;
    function por(unidadeId, iso) {
      if (!dias.some(function (d) { return d.unidadeId === unidadeId && d.iso === iso; })) dias.push({ unidadeId: unidadeId, iso: iso });
    }
    [antes, agora].forEach(function (marca) {
      if (!marca) return;
      var partes = JSON.parse(marca), dia = partes[0];
      if (partes[1] || (dia && dia[3])) { muitos = true; return; }
      if (!dia) return;
      por(dia[0], dia[1]);
      (dia[4] || []).forEach(function (iso) { por(dia[0], iso); });
    });
    return muitos ? null : dias;
  }

  /* o rascunho mudou: o rodapé na hora, e as telas meio segundo depois do último clique (cada uma pede a prévia), só se
     o que elas mostram mudou. Durante a gravação as telas esperam: elas leem no fim dela, e a recusa volta a passar aqui */
  function mudou() {
    atualizar();
    if (espera) clearTimeout(espera);
    espera = setTimeout(function () {
      espera = null;
      if (salvando) return;
      var marca = marcaDaPrevia();
      if (marca === mostrado) return;
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
        descartar();
        if (X()) X().descartar();
        redesenharAba();
        mudou();
      }
    });
  }

  /* a aba Ciclo ou Extrajornada aberta lê de novo (o Dia se redesenha sozinho) */
  function redesenharAba() {
    var c = contexto();
    if (c && (c.secao === 'continuos' || c.secao === 'extra') && RW.escalasPainel.recarregarSecao) RW.escalasPainel.recarregarSecao();
  }

  /* os registros das partes num resumo só: as mudanças de todas, com o autor e a hora do primeiro */
  function juntarLogs(logs) {
    if (!logs.length) return null;
    if (logs.length === 1) return logs[0];
    var log = JSON.parse(JSON.stringify(logs[0]));
    log.resumo = { titulo: logs[0].resumo && logs[0].resumo.titulo, alvos: [] };
    logs.forEach(function (l) { log.resumo.alvos = log.resumo.alvos.concat((l.resumo && l.resumo.alvos) || []); });
    return log;
  }

  /* o nome da unidade nas etapas: "1ªCIBM / 2ºPEL" vira "2ºPEL" */
  function nomeCurto(c) { return (c.unidadeNome || '').split('/').pop().trim(); }

  /* o que aparece enquanto grava: só o Dia, as etapas no rodapé, com o dia sendo refeito na grade ("Refazendo a
     distribuição" só quando o banco refaz); com o Ciclo ou a Extrajornada, que mudam muitos dias, o cartão sobre a tela */
  function mostrarEtapas(c, ciclo, soDoDia) {
    if (linhaNoRodape) linhaNoRodape.parar();
    linhaNoRodape = null;
    if (ciclo) return RW.etapas.acao('salvarCiclo', { unidade: nomeCurto(c) }, { doServidor: 2 });
    if (!soDoDia) return RW.etapas.acao('salvarExtra', null, { doServidor: 1 });
    var refaz = !!(E() && E().refazDistribuicao());
    linhaNoRodape = linhaDasEtapas(rodapePagina(), 'salvarDia',
      { dia: RW.data.isoParaBR(c.iso).slice(0, 5), unidade: nomeCurto(c), refaz: refaz },
      { doServidor: refaz ? 2 : 1, atraso: refaz ? 0 : 300 });
    RW.escalasDiaNaGrade.refazendo(c.unidadeId, c.iso);
    return linhaNoRodape;
  }

  /* as telas leem de novo: só o Dia, só aquele dia nas colunas à vista; senão (a mudança de dia, que muda dois dias, ou
     numa grade sem célula por dia), o período, com a grade na tela. A promessa se cumpre com a tela nova, e nunca falha */
  function telasLeem(c, soDoDia, doisDias) {
    var grade = RW.escalasDiaNaGrade, umDia = soDoDia && !doisDias && grade.temCelulas();
    window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: c.unidadeId, iso: c.iso, soDoDia: umDia } }));
    return umDia ? grade.salvou(c.unidadeId, c.iso) : grade.relerPeriodo();
  }

  /* grava (escala_painel_salvar) mostrando as etapas e, gravado, põe o dia gravado no painel e avisa as telas. O clique fica
     travado até as telas lerem (iniciarCarregando). Devolve uma Promise com { ok, r } ou { ok: false, erro, desatualizado }
     (quem chama avisa). O dia que mudou depois da leitura (outro administrador ou o sistema) tira o rascunho do Dia e lê o
     dia de novo */
  function enviar(c, dia, ciclo, extra, botao) {
    var soDoDia = !ciclo && !extra;
    var doisDias = !!(dia && E() && E().outrosDias().length);   // a mudança de dia: a gravação muda outro dia também
    salvando = true;
    var etapas = mostrarEtapas(c, ciclo, soDoDia);
    atualizar();
    if (botao) RW.iniciarCarregando(botao);
    /* o fim: a linha do rodapé completa em segundo plano os dias distantes do recálculo (a fila em blocos), como o cartão */
    function terminar() {
      salvando = false;
      etapas.parar();
      if (soDoDia) {
        linhaNoRodape = null;
        RW.escalasDiaNaGrade.parou(c.unidadeId, c.iso);
        RW.marcarRecalculoPendente();
        RW.drenarRecalculo();
      }
      if (botao) RW.pararCarregando(botao);
    }
    return RW.escalasDados.painelSalvar(c.unidadeId, c.iso, dia, ciclo, extra).then(function (r) {
      var geral = RW.mensagens.geral;
      if (r && r._falha) { terminar(); mudou(); return { ok: false, erro: r._falha === 'conexao' ? geral.semConexao : geral.falhaServidor }; }
      if (!r || !r.success) {
        terminar();
        if (r && r.desatualizado) {
          if (E()) E().descartar();
          redesenharAba();
          mudou();
          return { ok: false, desatualizado: true, erro: msg().diaDesatualizado };
        }
        mudou();
        return { ok: false, erro: msg().painelRecusado((r && r.error) || msg().falhaSalvar) };
      }
      if (E()) E().aposGravar(r);
      if (C()) C().limpar();
      if (X()) X().descartar();   // gravou: a extra é lida de novo, com o que mudou
      if (espera) { clearTimeout(espera); espera = null; }
      mostrado = marcaDaPrevia();   // as telas leem de novo logo abaixo, já sem o que foi gravado
      atualizar();
      etapas.ultima();
      return telasLeem(c, soDoDia, doisDias).then(function () {
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
    if (!c || salvando || (E() && E().travado())) return;
    var dia = E() && E().pendentes() ? E().paraGravar() : null;
    var ciclo = doCiclo(c).length ? C().envio() : null;
    var campo = botao.closest('.escala-rodape-salvar').querySelector('.escala-rodape-motivo input');
    var extra = X() ? X().envio(campo.value.trim()) : null;
    if (!dia && !ciclo && !extra) return;
    enviar(c, dia, ciclo, extra, botao).then(function (res) {
      if (!res.ok) { avisarFalha(res); return; }
      var log = juntarLogs(res.r.logs || []);
      if (log && RW.resumo) RW.resumo.abrirModal(log, { pagina: 'Escala' });
    });
  }

  /* qualquer aviso dos rascunhos (também o painel que abre ou fecha) redesenha o rodapé; as telas, só com mudança */
  window.addEventListener('rosterwork_escala_rascunho', mudou);
  /* fechar ou recarregar o navegador, ou ir para outra página, com mudança no Dia ou no Ciclo: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(pendente);

  RW.escalasPainelSalvar = { rodape: rodape, atualizar: atualizar, contar: contar, contarDoDia: contarDoDia, pendente: pendente,
    descartar: descartar, paraPrevia: paraPrevia, marcado: marcado, mostrarRelendo: mostrarRelendo };
})();
