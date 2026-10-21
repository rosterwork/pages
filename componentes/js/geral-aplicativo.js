/* ============================================================
   APLICATIVO — o site instalado no celular (fonte única)
   Diz se o aparelho é celular (o lado menor da tela abaixo de 768px,
   a mesma conta que liga o modo celular), se a página está aberta
   como app instalado e guarda a janela de instalação do Android,
   que o navegador oferece uma vez só e o item "Instalar no celular"
   do menu abre. Roda síncrono no <head> (index.html e login.html).
   Manifesto: aplicativo.webmanifest · ícones: logos/aplicativo-*.png
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

  RW.aplicativo = {
    celular: celular,
    instalado: instalado,
    noCelularInstalado: noCelularInstalado,
    podeInstalar: podeInstalar,
    iphone: iphone,
    pedirInstalacao: pedirInstalacao
  };
})();
