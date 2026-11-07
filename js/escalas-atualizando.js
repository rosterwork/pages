/* ============================================================
   ESCALAS — os dias que ainda podem mudar
   A grade sai na hora e os dias que ainda podem mudar ficam com a
   borda amarela, com a nota no alto. Há dois tipos de dia: na fila
   (o recálculo ainda vai refazer) e já refeito (falta só a cópia
   guardada; o dado real já está certo). Com dia amarelo na tela, a
   conferência (RPC escala_dias_atualizando) volta de tempos em tempos
   e troca só as células que ficaram prontas, sem o círculo e sem
   mexer na rolagem. O dia na fila faz esperar o painel do dia
   (escalas-painel.js) e o Imprimir.
   API: RosterWork.escalaAtualizando.{ ligar, conferir, receberGrade,
   salvou, atualizarCelula, pendente, naFilaNoDia, soCopia, esperar,
   corrigir, aoImprimir, conferirImpressao }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var CONFERIR_MS = 10000;            // de quanto em quanto confere, com dia amarelo na tela
  var CONFERIR_ESPERANDO_MS = 3000;   // com fila, ou com o painel do dia esperando
  var IMPRIMIR_LIMITE_MS = 30000;     // o Imprimir para de esperar e abre avisando

  var tela = null;           // o que a Escala dá: { conteudo, unidades, colunas, modo, data, naTela, redesenhar }
  var dias = {};             // 'unidade|dia': true = na fila; false = já refeito, falta a cópia guardada
  var corrigidos = {};       // os dias que já estão certos na tela (o banco os lista até a cópia ficar pronta)
  var esperas = [];          // [{ vale, resolver }]: o painel do dia esperando a fila
  var conferirToken = 0;     // latest-wins entre as conferências
  var conferirTimer = null;
  var esperaImpressao = 0;   // fechar o painel cancela a espera do Imprimir
  var vigia = null;          // marca as células de cada grade nova (os modos desenham depois de ler)
  var gradeParaReler = false;   // Militares e Minha escala: a fila acabou e a grade ainda vai ler de novo

  function ativa() { return !!tela && tela.naTela(); }
  function chave(unidadeId, iso) { return unidadeId + '|' + iso; }
  function temFila() { return Object.keys(dias).some(function (k) { return dias[k]; }); }

  function pendente(unidadeId, iso) { return ativa() && dias[chave(unidadeId, iso)] === true; }

  function soCopia(unidadeId, iso) {
    var k = chave(unidadeId, iso);
    return ativa() && dias[k] === false && !corrigidos[k];
  }

  function naFilaNoDia(iso) {
    return ativa() && Object.keys(dias).some(function (k) { return dias[k] && k.split('|')[1] === iso; });
  }

  /* o que a tela mostra: as unidades e o mês com folga nas pontas (a semana e a quinzena passam do mês). Na Minha escala,
     a unidade de quem abriu */
  function faixaDaTela() {
    var ref = tela.data();
    var ids = tela.colunas().map(function (c) { return c.id; });
    if (tela.modo() === 'minha') {
      var perfil = RosterWork.sessao && RosterWork.sessao.perfil();
      ids = perfil && perfil.lotacao_id != null ? [perfil.lotacao_id] : [];
    }
    var iso = RosterWork.data.paraIsoDeData;
    return { ids: ids, inicio: iso(new Date(ref.getFullYear(), ref.getMonth(), -13)), fim: iso(new Date(ref.getFullYear(), ref.getMonth() + 1, 21)) };
  }

  function corpoDaTela() { return tela && tela.conteudo.querySelector('.pagina-corpo'); }

  /* a borda amarela: nas grades de célula, todo dia que ainda pode mudar; no Militares e na Minha escala, que leem o dado
     real, só o dia que a fila ainda vai refazer */
  function marcar() {
    var corpo = corpoDaTela();
    if (!corpo) return;
    corpo.querySelectorAll('.escala-mes-celula[data-iso]').forEach(function (cel) {
      var k = chave(cel.dataset.unidadeId, cel.dataset.iso);
      cel.classList.toggle('escala-mes-celula--atualizando', k in dias && !corrigidos[k]);
    });
    corpo.querySelectorAll('.escala-mil-dia[data-iso]').forEach(function (cel) {
      cel.classList.toggle('escala-mil-dia--atualizando', naFilaNoDia(cel.dataset.iso));
    });
    corpo.querySelectorAll('.mini-calendario-dia[data-iso]').forEach(function (cel) {
      cel.classList.toggle('mini-calendario-dia--atualizando', naFilaNoDia(cel.dataset.iso));
    });
  }

  /* a nota do alto só existe com dia amarelo à vista, e diz as unidades desses dias (na Agenda do celular, as células das
     outras unidades ficam escondidas) */
  function mostrarNota() {
    var corpo = corpoDaTela();
    var nota = tela && tela.conteudo.querySelector('.escala-atualizando');
    if (!corpo || !nota) return;
    var porId = {}, nomes = [], vistos = {};
    (tela.unidades() || []).forEach(function (u) { porId[u.unidade_id] = u.nome; });
    function somar(id) { if (porId[id] && nomes.indexOf(porId[id]) < 0) nomes.push(porId[id]); }
    corpo.querySelectorAll('.escala-mes-celula--atualizando').forEach(function (cel) {
      if (cel.getClientRects().length) somar(cel.dataset.unidadeId);
    });
    corpo.querySelectorAll('.escala-mil-dia--atualizando, .mini-calendario-dia--atualizando').forEach(function (cel) { vistos[cel.dataset.iso] = true; });
    Object.keys(dias).forEach(function (k) {
      var p = k.split('|');
      if (dias[k] && vistos[p[1]]) somar(p[0]);
    });
    nota.classList.toggle('oculto', !nomes.length);
    if (nomes.length) nota.querySelector('.escala-atualizando-texto').textContent = RosterWork.mensagens.escala.atualizando(nomes);
  }

  function ligarVigia() {
    if (vigia) vigia.disconnect();
    var corpo = corpoDaTela();
    if (!corpo || !window.MutationObserver) return;
    var pedido = false;
    vigia = new MutationObserver(function () {
      if (pedido || !Object.keys(dias).length) return;
      pedido = true;
      requestAnimationFrame(function () { pedido = false; marcar(); mostrarNota(); });
    });
    vigia.observe(corpo, { childList: true, subtree: true });
  }

  /* a célula de um dia na grade que estiver na tela, pela leitura dada (sem ela, lê o dado real) */
  function atualizarCelula(unidadeId, iso, leitura) {
    ['escalasMes', 'escalasSemana', 'escalasCalendario', 'escalasDia', 'escalasColunas'].forEach(function (nome) {
      var grade = window.RosterWork[nome];
      if (grade && grade.atualizarCelula) grade.atualizarCelula(String(unidadeId), iso, leitura);
    });
  }

  /* ler a grade de novo fecha o painel aberto (a grade refeita não tem mais a célula dele): espera ele fechar */
  function relerGrade() {
    if (!gradeParaReler || (RosterWork.painel && RosterWork.painel.estaAberto())) return;
    gradeParaReler = false;
    tela.redesenhar();
  }

  /* os dias que ficaram prontos: só as células deles mudam. O Militares e a Minha escala não têm célula para trocar: quando
     a fila acaba, leem de novo */
  function redesenharProntos(prontos, filaAcabou) {
    var corpo = corpoDaTela();
    if (!corpo) return;
    if (!corpo.querySelector('.escala-mes-celula[data-iso]')) {
      if (filaAcabou && (tela.modo() === 'militares' || tela.modo() === 'minha')) gradeParaReler = true;
      return;
    }
    var naTela = prontos.filter(function (k) {
      var p = k.split('|');
      return corpo.querySelector('.escala-mes-celula[data-unidade-id="' + p[0] + '"][data-iso="' + p[1] + '"]');
    });
    if (!naTela.length) return;
    var ids = {}, datas = [];
    naTela.forEach(function (k) { var p = k.split('|'); ids[p[0]] = true; datas.push(p[1]); });
    datas.sort();
    var leitura = RosterWork.escalasDados.carregar(Object.keys(ids), datas[0], datas[datas.length - 1], { daTela: true, semAviso: true });
    naTela.forEach(function (k) { var p = k.split('|'); atualizarCelula(p[0], p[1], leitura); });
  }

  function receberDias(lista) {
    var agora = {};
    lista.forEach(function (d) { agora[chave(d.unidade, d.data)] = !!d.fila; });
    var prontos = Object.keys(dias).filter(function (k) { return !(k in agora); });
    var tinhaFila = temFila();
    dias = agora;
    Object.keys(corrigidos).forEach(function (k) { if (!(k in agora)) delete corrigidos[k]; });
    var filaAcabou = tinhaFila && !temFila();
    if (prontos.length || filaAcabou) redesenharProntos(prontos, filaAcabou);
    relerGrade();
    marcar();
    mostrarNota();
    esperas = esperas.filter(function (e) { if (e.vale()) return true; e.resolver(); return false; });
    /* com fila, quem está com a tela aberta ajuda a esvaziar (a tarefa de cada minuto também esvazia); a falha de um bloco
       não some da tela: a próxima conferência ainda vê a fila e tenta de novo */
    if (temFila() && RosterWork.drenarRecalculo && !RosterWork.temRecalculoPendente()) RosterWork.drenarRecalculo();
  }

  function agendar() {
    clearTimeout(conferirTimer);
    if (!Object.keys(dias).length && !esperas.length && !gradeParaReler) return;
    if (document.visibilityState !== 'visible') return;   // volta pelo visibilitychange
    conferirTimer = setTimeout(conferir, (esperas.length || temFila()) ? CONFERIR_ESPERANDO_MS : CONFERIR_MS);
  }

  function conferir() {
    clearTimeout(conferirTimer);
    if (!ativa() || !RosterWork.escalasDados || !tela.data()) return;
    var faixa = faixaDaTela();
    if (!faixa.ids.length) return;
    var meu = ++conferirToken;
    RosterWork.escalasDados.lerDiasAtualizando(faixa.ids, faixa.inicio, faixa.fim).then(function (lista) {
      if (meu !== conferirToken || !ativa()) return;
      if (lista) receberDias(lista);   // sem a leitura (falha), fica como está e tenta de novo
      agendar();
    });
  }

  /* os dias que a grade leu da cópia vêm marcados na mesma leitura: entram na lista mesmo que a conferência já não os veja
     (a cópia pode ter ficado pronta logo depois da leitura) */
  function receberGrade(chaves) {
    if (!ativa() || !chaves || !chaves.length) return;
    chaves.forEach(function (k) {
      if (!(k in dias)) dias[k] = false;
      delete corrigidos[k];
    });
    marcar();
    mostrarNota();
    agendar();
  }

  /* o painel do dia: resolve quando o dia sai da fila */
  function esperar(unidadeId, iso) {
    return new Promise(function (resolver) {
      esperas.push({ vale: function () { return pendente(unidadeId, iso); }, resolver: resolver });
      agendar();
    });
  }

  /* o painel abriu um dia já refeito: ele lê o dado real, e a célula fica igual ao painel */
  function corrigir(unidadeId, iso) {
    corrigidos[chave(unidadeId, iso)] = true;
    atualizarCelula(unidadeId, iso);
    marcar();
    mostrarNota();
  }

  /* o Salvar do painel: a célula lê o dado real (leitura, a do dia em todas as colunas) e não fica amarela enquanto a cópia
     dela é refeita */
  function salvou(unidadeId, iso, leitura) {
    if (ativa()) corrigidos[chave(unidadeId, iso)] = true;
    atualizarCelula(unidadeId, iso, leitura);
    if (!ativa()) return;
    marcar();
    mostrarNota();
  }

  /* ---------- o Imprimir ---------- */

  function filaAte(fila, fim) { return (fila || []).some(function (f) { return f.proxima_data <= fim; }); }

  /* com a fila ainda refazendo dias até o fim do período: o painel mostra a espera e a impressão abre sozinha quando ela
     termina; passando do limite, abre avisando (abrir(true)). O PDF lê o dado real: só a fila faz esperar */
  function aoImprimir(fim, titulo, abrir) {
    if (!RosterWork.lerFilaRecalculo) { abrir(false); return; }
    RosterWork.lerFilaRecalculo().then(function (fila) {
      if (!ativa()) return;
      if (filaAte(fila, fim)) esperarParaImprimir(fim, titulo, abrir);
      else abrir(false);
    });
  }

  function esperarParaImprimir(fim, titulo, abrir) {
    var meu = ++esperaImpressao;
    RosterWork.painel.abrir({ titulo: titulo, aoFechar: function () { if (meu === esperaImpressao) esperaImpressao++; } });
    var corpo = RosterWork.painel.corpo(), rodape = RosterWork.painel.rodape();
    corpo.textContent = '';
    corpo.appendChild(RosterWork.painel.criarAtualizando(RosterWork.mensagens.escala.imprimirAtualizando));
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    var limite = Date.now() + IMPRIMIR_LIMITE_MS;
    if (RosterWork.drenarRecalculo) RosterWork.drenarRecalculo();
    (function conferirFila() {
      setTimeout(function () {
        if (meu !== esperaImpressao || !ativa()) return;
        RosterWork.lerFilaRecalculo().then(function (fila) {
          if (meu !== esperaImpressao || !ativa()) return;
          if (!filaAte(fila, fim)) abrir(false);
          else if (Date.now() >= limite) abrir(true);
          else conferirFila();
        });
      }, CONFERIR_ESPERANDO_MS);
    })();
  }

  /* o aviso do painel de impressão aberto no limite: o erro grave da escala, se houver; senão, que o período ainda pode mudar */
  function conferirImpressao(escolhas, estado) {
    var m = RosterWork.mensagens.escala;
    var erros = RosterWork.escalasImpressao ? RosterWork.escalasImpressao.conferirErros(escolhas, estado) : null;
    return Promise.resolve(erros).then(function (aviso) {
      return aviso || { nivel: 'alerta', titulo: m.imprimirAindaTitulo, descricao: m.imprimirAindaDescricao };
    });
  }

  /* ---------- a página ---------- */

  /* a Escala chama isto a cada visita (o fragmento é novo) */
  function ligar(opcoes) {
    tela = opcoes;
    dias = {};
    corrigidos = {};
    esperas = [];
    gradeParaReler = false;
    esperaImpressao++;
    clearTimeout(conferirTimer);
    ligarVigia();
  }

  /* o celular trocou a unidade da Agenda: a nota fala só do que está à vista */
  window.addEventListener('rosterwork_seletor_unidade', function () { if (ativa()) mostrarNota(); });
  /* a aba voltou a aparecer: confere na hora (escondida, não confere) */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && ativa()) conferir();
  });

  window.RosterWork.escalaAtualizando = {
    ligar: ligar, conferir: conferir, receberGrade: receberGrade, salvou: salvou, atualizarCelula: atualizarCelula,
    pendente: pendente, naFilaNoDia: naFilaNoDia, soCopia: soCopia, esperar: esperar, corrigir: corrigir,
    aoImprimir: aoImprimir, conferirImpressao: conferirImpressao
  };
})();
