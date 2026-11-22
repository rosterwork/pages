/* ============================================================
   FALHA — a leitura que não veio, mesmo depois de o sistema tentar de
   novo sozinho (geral-api.js): o aviso no lugar dos dados, com o
   título da tela ("Não foi possível carregar a escala."), o que fazer
   pelo motivo da falha (sem internet, o sistema demorou ou erro do
   sistema; RosterWork.ultimaFalha) e o Tentar de novo, que refaz a
   mesma leitura. Molde tpl-falha-leitura (index.html), no desenho da
   tela que não abriu (geral-pagina-cabecalho.css).
   RosterWork.falha.bloco(titulo, tentar, { rascunho }): o aviso pronto
   para pôr na tela; rascunho = há mudança esperando o Salvar (a
   prévia), e o aviso diz que ela continua. Sem tentar, sem o botão.
   RosterWork.falha.frase(titulo, { rascunho }): onde não cabe o botão
   (a lista de escolher, o aviso), o título e o que fazer numa frase.
   RosterWork.falha.antes(no, titulo, tentar) / tirarAntes(no): na página
   que esconde o conteúdo enquanto lê, o aviso logo antes dele.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* a falha anotada há mais tempo que isto já não explica a de agora */
  var VALE_MS = 120000;

  function motivo() {
    if (navigator.onLine === false) return 'internet';
    var falha = RW.ultimaFalha && RW.ultimaFalha();
    return falha && Date.now() - falha.quando < VALE_MS ? falha.motivo : 'erro';
  }

  function oQueFazer(opcoes) {
    var M = RW.mensagens.geral, m = motivo();
    var texto = m === 'internet' ? M.falhaInternet : m === 'demorou' ? M.falhaDemorou : M.falhaErro;
    return opcoes && opcoes.rascunho ? texto + ' ' + M.falhaRascunho : texto;
  }

  function bloco(titulo, tentar, opcoes) {
    var no = RW.tpl('tpl-falha-leitura');
    if (!no) return null;
    no.querySelector('.falha-leitura-titulo').textContent = titulo;
    no.querySelector('.falha-leitura-texto').textContent = oQueFazer(opcoes);
    var botao = no.querySelector('.falha-leitura-tentar');
    if (!tentar) botao.classList.add('oculto');
    else botao.addEventListener('click', function () { botao.disabled = true; tentar(); });
    return no;
  }

  function frase(titulo, opcoes) { return titulo + ' ' + oQueFazer(opcoes); }

  /* a página que esconde o conteúdo enquanto lê (os Ajustes): o aviso logo antes dele, um só; o Tentar de novo tira o
     aviso e chama tentar. tirarAntes(no): a leitura nova começou, o aviso de antes sai */
  function tirarAntes(no) {
    var velho = no && no.previousElementSibling;
    if (velho && velho.classList.contains('falha-leitura')) velho.remove();
  }
  function antes(no, titulo, tentar) {
    if (!no || !no.parentNode) return null;
    tirarAntes(no);
    var aviso = bloco(titulo, function () { aviso.remove(); tentar(); });
    if (!aviso) return null;
    aviso.classList.add('falha-leitura--na-pagina');
    no.parentNode.insertBefore(aviso, no);
    return aviso;
  }

  RW.falha = { bloco: bloco, frase: frase, antes: antes, tirarAntes: tirarAntes };
})();
