/* ============================================================
   APLICATIVO — o site instalado no celular (fonte única)
   Diz se o aparelho é celular (o lado menor da tela abaixo de 768px,
   a mesma conta que liga o modo celular), se a página está aberta
   como app instalado e guarda a janela de instalação do Android,
   que o navegador oferece uma vez só e o item "Instalar no celular"
   do menu abre. Também liga o armazém do app (service worker) e
   cuida da troca de versão. Roda síncrono no <head> (index.html e
   login.html). Manifesto: aplicativo.webmanifest · ícones:
   logos/aplicativo-*.png · armazém: aplicativo-armazem.js
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var pedidoInstalacao = null;   /* evento beforeinstallprompt do Android, guardado até o toque no menu */
  var foiInstalado = false;      /* instalado agora, nesta aba do navegador */

  function celular() {
    try { return Math.min(screen.width, screen.height) < 768; } catch (e) { return false; }
  }

  function instalado() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    } catch (e) { return false; }
  }

  /* app instalado no celular: o Manter-me conectado vem marcado e dura 30 dias */
  function noCelularInstalado() {
    return celular() && instalado();
  }

  /* o item do menu aparece no celular, fora do app e enquanto não foi instalado nesta aba */
  function podeInstalar() {
    return celular() && !instalado() && !foiInstalado;
  }

  function iphone() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }

  function avisarMudanca() {
    window.dispatchEvent(new Event('rosterwork_instalacao'));
  }

  window.addEventListener('beforeinstallprompt', function (evento) {
    evento.preventDefault();   /* a janela abre só pelo item do menu */
    pedidoInstalacao = evento;
    avisarMudanca();
  });

  window.addEventListener('appinstalled', function () {
    pedidoInstalacao = null;
    foiInstalado = true;
    avisarMudanca();
  });

  /* abre a janela de instalação do Android; resolve false quando o navegador não a ofereceu
     (iPhone, outro navegador ou app já instalado) e a tela mostra o passo a passo */
  function pedirInstalacao() {
    if (!pedidoInstalacao) return Promise.resolve(false);
    var pedido = pedidoInstalacao;
    pedidoInstalacao = null;   /* o navegador deixa usar uma vez só */
    pedido.prompt();
    return pedido.userChoice.then(function () { return true; }, function () { return true; });
  }

  /* ---------- armazém do app (o service worker aplicativo-armazem.js) ----------
     Registra o armazém (só em endereço seguro) e acompanha a versão nova: ela baixa em segundo
     plano e só entra numa troca de página (irPara), nunca no meio de uma tela aberta, para a
     versão velha e a nova não se misturarem. ARMAZEM_LIGADO = false é o botão de emergência
     (REGRAS §8.1): desliga o armazém e apaga o que ele guardou */
  var ARMAZEM_LIGADO = true;
  var TROCA_LIMITE_MS = 3000;   /* sem resposta do armazém na troca de versão, segue mesmo assim */
  var registro = null;
  var trocando = false;

  /* há versão nova baixada, esperando a próxima troca de página? */
  function temVersaoNova() {
    return !!(registro && registro.waiting && navigator.serviceWorker.controller);
  }

  function ligarArmazem() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    if (!ARMAZEM_LIGADO) {
      navigator.serviceWorker.getRegistrations().then(function (lista) {
        lista.forEach(function (r) { r.unregister(); });
      });
      if (window.caches) {
        caches.keys().then(function (nomes) {
          nomes.forEach(function (nome) { if (nome.indexOf('rosterwork-') === 0) caches.delete(nome); });
        });
      }
      return;
    }
    navigator.serviceWorker.register('aplicativo-armazem.js').then(function (r) { registro = r; }).catch(function () {});
    /* o app voltou do fundo: confere se saiu versão nova */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && registro) registro.update().catch(function () {});
    });
  }

  /* abre um endereço do sistema; com versão nova esperando, troca de versão antes (a página
     abre já toda na versão nova) */
  function irPara(destino) {
    if (trocando) return;
    if (!temVersaoNova()) { window.location.href = destino; return; }
    trocando = true;
    function seguir() { window.location.href = destino; }
    navigator.serviceWorker.addEventListener('controllerchange', seguir);
    setTimeout(seguir, TROCA_LIMITE_MS);
    registro.waiting.postMessage('ativar');
  }

  window.addEventListener('load', ligarArmazem);

  RW.aplicativo = {
    celular: celular,
    instalado: instalado,
    noCelularInstalado: noCelularInstalado,
    podeInstalar: podeInstalar,
    iphone: iphone,
    pedirInstalacao: pedirInstalacao,
    temVersaoNova: temVersaoNova,
    irPara: irPara
  };
})();
