/* ============================================================
   ERROS DA TELA — o erro de JavaScript que acontece na tela de
   alguém vai para o banco (erro_tela_registrar), e o programador vê
   na aba Erros (Programador): quem, quando, em que página e aparelho.
   Pega o erro solto (error) e a promessa recusada que ninguém tratou
   (unhandledrejection), só do código do site: o de extensão do
   navegador e o de outro endereço ficam fora; o erro que o próprio
   código pegou vem por RosterWork.erros.registrar. No máximo 5 por aba,
   sem repetir o mesmo; nada vai no modo treino nem sem login, e a
   falha do envio fica calada. É o primeiro arquivo do carregador
   (js/index-carregar.js), para pegar o erro dos outros; o que chega
   antes do geral-api.js espera o sistema ficar pronto.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var LIMITE_POR_ABA = 5;
  var BASE = new URL('.', location.href).href;   /* a pasta do site: o arquivo é guardado a partir dela */
  var enviados = {};     /* frase + onde já mandados nesta aba */
  var quantos = 0;
  var esperando = [];    /* chegaram antes do geral-api.js */

  /* "js/escalas.js" a partir do endereço do arquivo; null quando o arquivo não é do site */
  function arquivoDoSite(endereco) {
    if (!endereco) return null;
    var semBusca = String(endereco).split(/[?#]/)[0];
    if (semBusca.indexOf(BASE) === 0) return semBusca.slice(BASE.length) || 'index.html';
    if (semBusca.indexOf(location.origin + '/') === 0) return semBusca.slice(location.origin.length + 1);
    return null;
  }

  /* o primeiro ponto do site na pilha da promessa: '' sem ponto nenhum, null quando a pilha só tem código de fora */
  function ondeNaPilha(pilha) {
    if (!pilha) return '';
    var achou, procura = /([a-z][a-z0-9+.-]*:\/\/[^\s()]+?):(\d+):\d+/gi;
    while ((achou = procura.exec(pilha))) {
      var arquivo = arquivoDoSite(achou[1]);
      if (arquivo !== null) return arquivo + ':' + achou[2];
    }
    return /:\d+:\d+/.test(pilha) ? null : '';
  }

  function fraseDo(motivo) {
    if (motivo instanceof Error) return String(motivo);
    if (motivo && typeof motivo.message === 'string') return motivo.message;
    if (typeof motivo === 'string') return motivo;
    try { return JSON.stringify(motivo) || String(motivo); } catch (e) { return String(motivo); }
  }

  function paginaAgora() {
    if (RW.paginaAtual && RW.paginaAtual()) return RW.paginaAtual();
    var rota = location.search.match(/[?&]pagina=([^&]+)/);
    return rota ? decodeURIComponent(rota[1]) : '';
  }

  function enviar(erro) {
    if (RW.treino && RW.treino.ligado && RW.treino.ligado()) return;
    if (!RW.rpc || !(RW.obterToken && RW.obterToken())) return;
    try { RW.rpc('erro_tela_registrar', erro).catch(function () {}); } catch (e) { /* o envio nunca vira outro erro */ }
  }

  /* a página e o aparelho são os da hora do erro */
  function guardar(frase, onde) {
    frase = String(frase || '').replace(/^Uncaught\s+/, '').trim().slice(0, 300);
    if (!frase || quantos >= LIMITE_POR_ABA) return;
    var chave = frase + '|' + onde;
    if (enviados[chave]) return;
    enviados[chave] = true;
    quantos++;
    var erro = {
      p_pagina: paginaAgora(),
      p_mensagem: frase,
      p_onde: onde || null,
      p_aparelho: document.documentElement.hasAttribute('data-celular') ? 'celular' : 'computador'
    };
    if (RW.rpc) enviar(erro);
    else esperando.push(erro);
  }

  window.addEventListener('error', function (evento) {
    var arquivo = arquivoDoSite(evento.filename);
    if (arquivo === null) return;
    guardar(evento.error instanceof Error ? String(evento.error) : evento.message, arquivo + (evento.lineno ? ':' + evento.lineno : ''));
  });

  /* o erro de uma promessa recusada ou o que o próprio código pegou: o lugar vem da pilha */
  function registrar(motivo) {
    var onde = ondeNaPilha(motivo && motivo.stack ? String(motivo.stack) : '');
    if (onde === null) return;
    guardar(fraseDo(motivo), onde);
  }

  window.addEventListener('unhandledrejection', function (evento) { registrar(evento.reason); });

  /* RosterWork.erros.registrar(erro): manda o erro que o código pegou (ex.: a tela que deu erro ao abrir,
     index-navegacao.js), com as mesmas regras */
  RW.erros = { registrar: registrar };

  function enviarEsperando() {
    var lista = esperando;
    esperando = [];
    lista.forEach(enviar);
  }
  if (RW.sistemaPronto && RW.sistemaPronto.then) RW.sistemaPronto.then(enviarEsperando, enviarEsperando);
})();
