/* ============================================================
   MANTER-ME CONECTADO — o login lembrado no aparelho (fonte única)
   Quando a pessoa marca "Manter-me conectado neste dispositivo" ao
   entrar (no app instalado no celular a caixa já vem marcada), o
   aparelho guarda só a chave de renovação da sessão (refresh_token),
   de quem ela é, a data do último uso e o prazo: 7 dias sem uso, ou
   30 no app do celular. Perfil, preferências e dados nunca ficam
   guardados: a cada entrada são buscados de novo. É a única chave do
   sistema em localStorage (REGRAS §8.1): vale para todas as abas, que
   renovam a sessão sempre pela chave mais nova guardada aqui.
   Roda síncrono no <head> (index.html e login.html), depois do
   geral-aplicativo.js.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var CHAVE = 'rosterwork_conectado';
  var DIA_MS = 24 * 60 * 60 * 1000;
  var PRAZO_DIAS = 7;        /* computador e navegador comum */
  var PRAZO_DIAS_APP = 30;   /* app instalado no celular */

  /* de quem é a sessão: o "sub" do token (o id da conta) */
  function usuarioDoToken(accessToken) {
    try {
      var parte = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(parte)).sub || null;
    } catch (e) { return null; }
  }

  function esquecer() {
    try { localStorage.removeItem(CHAVE); } catch (e) {}
  }

  /* o login lembrado neste aparelho, ou null; passou do prazo sem uso, apaga */
  function lembrado() {
    var guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) {}
    if (!guardado || !guardado.refresh_token || !guardado.usuario || !guardado.ultimo_uso || !guardado.prazo_dias) return null;
    if (Date.now() - guardado.ultimo_uso > guardado.prazo_dias * DIA_MS) {
      esquecer();
      return null;
    }
    return guardado;
  }

  /* o login lembrado só quando é da mesma conta da sessão desta aba */
  function daSessao(accessToken) {
    var guardado = lembrado();
    if (!guardado || !accessToken) return null;
    return guardado.usuario === usuarioDoToken(accessToken) ? guardado : null;
  }

  function gravar(accessToken, refreshToken, prazoDias) {
    var usuario = usuarioDoToken(accessToken);
    if (!usuario || !refreshToken) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        usuario: usuario,
        refresh_token: refreshToken,
        ultimo_uso: Date.now(),
        prazo_dias: prazoDias
      }));
    } catch (e) {}
  }

  /* entrou com a caixa marcada: começa a lembrar */
  function lembrar(accessToken, refreshToken) {
    var noApp = RW.aplicativo && RW.aplicativo.noCelularInstalado();
    gravar(accessToken, refreshToken, noApp ? PRAZO_DIAS_APP : PRAZO_DIAS);
  }

  /* a sessão renovou: guarda a chave nova e conta o uso (só quando já lembra esta conta) */
  function atualizar(accessToken, refreshToken) {
    var guardado = daSessao(accessToken);
    if (guardado) gravar(accessToken, refreshToken, guardado.prazo_dias);
  }

  RW.conectado = {
    lembrado: lembrado,
    daSessao: daSessao,
    lembrar: lembrar,
    atualizar: atualizar,
    esquecer: esquecer
  };
})();
