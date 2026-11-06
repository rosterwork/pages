/* ============================================================
   COMPONENTE geral-manutencao — o aviso de manutenção das telas
   Uma mudança no banco que quebra a tela antiga grava um aviso em
   manutencao_telas, no mesmo comando, e o código dele entra em
   CODIGOS_NO_SITE, publicado junto com a tela nova (REGRAS §8.5). O
   site antigo não conhece o código e mostra o aviso; o site novo
   conhece e mostra a tela. Cada aparelho decide sozinho, conforme a
   versão nova chega nele.
   Dois níveis: a faixa, acima do título, com a tela funcionando; e o
   bloqueio, no lugar da tela, que abre sozinha quando a versão nova
   chega ou o aviso acaba. Falhou ou demorou a leitura, a tela abre
   normalmente. Uma chamada recusada porque a função do banco mudou
   (quem já estava com a tela aberta) também põe a faixa.
   API: RosterWork.manutencao.ler(pagina) · porFaixa(aviso) ·
   vigiarBloqueio(pagina, aoLiberar) · parar() · funcaoMudou()
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* os códigos dos avisos que este site já resolve; o de aviso vencido pode sair da lista */
  var CODIGOS_NO_SITE = [];

  var LIMITE_LEITURA_MS = 1000;   /* passou disso, a tela abre sem esperar a leitura */
  var CONFERIR_MS = 60000;        /* de quanto em quanto a tela bloqueada confere se já pode abrir */

  var vigia = null;          /* a conferência da tela bloqueada */
  var faixaOculta = false;   /* o X da faixa vale até a próxima troca de página */

  /* o aviso desta página (o bloqueio vale mais que a faixa) ou null; rejeita quando a leitura falha */
  function avisoDaPagina(pagina) {
    return RW.rpc('manutencao_telas_listar').then(function (lista) {
      if (!Array.isArray(lista)) throw new Error('sem leitura');
      var daPagina = lista.filter(function (aviso) {
        return aviso.pagina === pagina && CODIGOS_NO_SITE.indexOf(aviso.codigo) === -1;
      });
      var bloqueio = daPagina.filter(function (aviso) { return aviso.nivel === 'bloqueio'; })[0];
      return bloqueio || daPagina[0] || null;
    });
  }

  /* a leitura de cada troca de página: resolve sempre, para nunca segurar a tela */
  function ler(pagina) {
    var limite = new Promise(function (resolver) {
      setTimeout(function () { resolver(null); }, LIMITE_LEITURA_MS);
    });
    return Promise.race([avisoDaPagina(pagina).catch(function () { return null; }), limite]);
  }

  /* pergunta se saiu a versão nova (ela baixa em segundo plano e entra pelo caminho de sempre) */
  function conferirVersao() {
    if (RW.aplicativo) RW.aplicativo.conferirVersao();
  }

  /* a faixa acima do título, abaixo da "Esperando a sua resposta" (geral-chamada) */
  function porFaixa(aviso) {
    if (faixaOculta || vigia) return;
    var pagina = document.querySelector('.conteudo > .pagina');
    if (!pagina || pagina.querySelector(':scope > .chamada--manutencao')) return;
    var faixa = RW.tpl('tpl-manutencao-faixa');
    if (!faixa) return;
    if (aviso && aviso.parte) faixa.querySelector('[data-manutencao-parte]').textContent = aviso.parte;
    faixa.querySelector('.chamada-fechar').addEventListener('click', function () {
      faixaOculta = true;
      faixa.parentNode.removeChild(faixa);
    });
    pagina.insertBefore(faixa, pagina.querySelector(':scope > .pagina-cabecalho') || pagina.firstChild);
    conferirVersao();
  }

  /* a tela bloqueada não tem nada em uso: a versão nova entra sozinha assim que chegar. O aviso que
     acabou (venceu ou foi apagado) libera a tela. A falha na leitura deixa tudo como está */
  function conferirBloqueio(pagina, aoLiberar, meu) {
    if (RW.aplicativo) RW.aplicativo.trocarSozinho(function () { return true; });
    conferirVersao();
    avisoDaPagina(pagina).then(function (aviso) {
      if (vigia === meu && (!aviso || aviso.nivel !== 'bloqueio')) aoLiberar();
    }).catch(function () {});
  }

  function vigiarBloqueio(pagina, aoLiberar) {
    parar();
    var meu = setInterval(function () { conferirBloqueio(pagina, aoLiberar, meu); }, CONFERIR_MS);
    vigia = meu;
    if (RW.aplicativo) RW.aplicativo.trocarSozinho(function () { return true; });
    conferirVersao();
  }

  /* a troca de página: a tela nova começa sem a conferência e sem o X da anterior */
  function parar() {
    faixaOculta = false;
    if (!vigia) return;
    clearInterval(vigia);
    vigia = null;
    if (RW.aplicativo) RW.aplicativo.trocarSozinho(null);
  }

  /* uma chamada recusada porque a função do banco mudou: a tela aberta ficou velha */
  function funcaoMudou() {
    porFaixa(null);
  }

  RW.manutencao = { ler: ler, porFaixa: porFaixa, vigiarBloqueio: vigiarBloqueio, parar: parar, funcaoMudou: funcaoMudou };
})();
