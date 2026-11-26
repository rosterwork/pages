/* ============================================================
   EXTRAJORNADA — os dias que ainda podem mudar
   O mês vem da cópia guardada, como a grade da Escala: o dia que
   mudou há pouco vem da versão de antes. Com dia do mês que ainda vai
   mudar (escala_dias_atualizando: na fila do recálculo ou esperando a
   cópia), a nota amarela no alto e a borda amarela no pelotão do dia,
   a mesma da Escala (escalas-mes.css), nas abas Distribuição, Ajustes
   e Extras do mês. A borda fica até o mês ser lido de novo: a página
   não troca o dia sozinho, lê o mês inteiro quando todos ficam
   prontos, com os rascunhos por cima (extrajornada-organizar.js). A
   releitura espera o que está na mão (a caixa da célula aberta, o
   cursor num campo de texto da página, a sugestão calculando). Com dia
   amarelo, confere de novo a cada CONFERIR_MS, só com a aba do
   navegador à vista; ao voltar para a aba, confere na hora.
   Não cria HTML nem escreve estilo (só classList).
   API: RosterWork.extrajornadaAtualizando.{ ligar, leu, conferir, marcado }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var CONFERIR_MS = 10000;

  var tela = null;     // { pagina, dados(), recarregar() }, da página aberta (extrajornada-organizar.js)
  var dias = {};       // 'unidade|dia': true, os dias que a tela mostra da versão de antes
  var lido = false;    // o mês acabou de ser lido: a próxima conferência diz quais dias ainda são de antes
  var token = 0;       // latest-wins entre as conferências
  var timer = null;

  function chave(uid, k) { return uid + '|' + k; }
  function treinando() { return !!(RW.treino && RW.treino.ligado()); }
  function nota() { return tela && tela.pagina.querySelector('#extrajornada-atualizando'); }
  /* o conteúdo é o do shell, sempre o mesmo: quem diz que a página está na tela é a nota dela */
  function naPagina() { return !!nota(); }
  function fimDoMes(c) { var f = new Date(+c.slice(0, 4), +c.slice(5, 7), 0); return c.slice(0, 8) + String(f.getDate()).padStart(2, '0'); }
  function temDias() { return Object.keys(dias).length > 0; }

  /* o pelotão no dia ainda pode mudar (a célula nasce com a borda: extrajornada-por-dia.js) */
  function marcado(uid, k) { return !!dias[chave(uid, k)]; }

  /* a borda nas células que já estão na tela: o bloco do pelotão no dia (data-uid e data-dia) e a célula dele */
  function marcar() {
    if (!naPagina()) return;
    Array.prototype.forEach.call(tela.pagina.querySelectorAll('[data-uid][data-dia]'), function (b) {
      var cel = b.classList.contains('escala-mes-celula') ? b : b.querySelector('.escala-mes-celula');
      if (cel) cel.classList.toggle('escala-mes-celula--atualizando', marcado(b.getAttribute('data-uid'), b.getAttribute('data-dia')));
    });
    nota().classList.toggle('oculto', !temDias());
  }

  function agendar() {
    clearTimeout(timer);
    if (!temDias() || document.visibilityState !== 'visible') return;   // escondida, volta pelo visibilitychange
    timer = setTimeout(conferir, CONFERIR_MS);
  }

  /* a releitura não tira nada da mão da pessoa: a caixa da célula aberta, o cursor num campo de texto da página ou a
     sugestão calculando */
  function ocupada() {
    var foco = document.activeElement;
    return !!(RW.extrajornadaCelula && RW.extrajornadaCelula.ativo())
      || !!(RW.extrajornadaOtimizador && RW.extrajornadaOtimizador.calculando())
      || !!(foco && tela.pagina.contains(foco) && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' || foco.isContentEditable));
  }

  /* os dias de agora: logo depois de ler o mês, a lista troca a de antes; depois, só soma (a tela não troca o dia que
     ficou pronto, só lê o mês de novo quando todos ficam). Sem nenhum, lê o mês de novo com os rascunhos por cima; com
     algo na mão, confere de novo daqui a pouco */
  function receber(lista) {
    if (lido) { dias = {}; lido = false; }
    var tinha = temDias();
    lista.forEach(function (x) { dias[chave(x.unidade, x.data)] = true; });
    marcar();
    if (lista.length || (tinha && ocupada())) { agendar(); return; }
    if (tinha) tela.recarregar(true);
  }

  function conferir() {
    clearTimeout(timer);
    var d = tela && tela.dados();
    if (!naPagina() || !d || treinando() || !RW.escalasDados) { dias = {}; marcar(); return; }
    var comp = d.competencia, meu = ++token;
    var ids = (d.unidades || []).map(function (x) { return x.id; });
    RW.escalasDados.lerDiasAtualizando(ids, comp, fimDoMes(comp)).then(function (lista) {
      var agora = tela && tela.dados();
      if (meu !== token || !naPagina() || !agora || agora.competencia !== comp) return;
      /* sem a leitura (falha), fica como está e confere de novo */
      if (!lista) { agendar(); return; }
      receber(lista);
    });
  }

  /* a aba voltou a aparecer: confere na hora (escondida, não confere) */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && naPagina()) conferir();
  });

  RW.extrajornadaAtualizando = {
    /* a página é nova (a visita): pagina = o conteúdo, dados() = o mês lido, recarregar() = ler o mês de novo */
    ligar: function (pagina, dados, recarregar) {
      tela = { pagina: pagina, dados: dados, recarregar: recarregar };
      dias = {}; lido = false; token++;
      clearTimeout(timer);
    },
    /* o mês chegou: a borda de antes fica no desenho até a conferência dizer os dias de agora */
    leu: function () { lido = true; },
    conferir: conferir,
    marcado: marcado
  };
})();
