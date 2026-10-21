/* ============================================================
   CRIAR CONTA — a tela aberta pelo link de cadastro que o
   administrador gera na ficha. Fica fora do sistema (não é
   fragmento da SPA): quem chega aqui ainda não tem acesso.
   O link e o CPF são conferidos no criar-conta-link.js; aqui o
   passo 2 cumprimenta a pessoa (posto e nome) e pede só o
   celular, o e-mail e a senha. A ficha que o administrador
   cadastrou ela confere depois de entrar, na janela dos dados
   pendentes (js/index-dados-pendentes.js).

   Reusa RosterWork.campos (máscara, erro no campo) e
   RosterWork.guardaSaida (não perder o formulário sem querer).
   O envio fica em criar-conta-envio.js.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var C = RW.campos;

  var contexto = { cpf: '', codigo: '' };   /* o CPF conferido e o código do link, que o envio reenvia */

  /* as funções desta tela são públicas (anon); o apiFetch manda a
     chave publicável quando não há sessão, então serve aqui também */
  function rpc(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  /* ---------- há algo digitado? (guarda de saída) ---------- */
  var enviado = false;   /* depois do envio não há mais o que proteger */
  var originais = {};    /* o celular e o e-mail como vieram da ficha: não contam como digitados */

  function temAlgoDigitado() {
    if (enviado) return false;
    var campos = document.querySelectorAll('#cc-corpo .campo-entrada');
    for (var i = 0; i < campos.length; i++) {
      if (campos[i].value.trim() !== (originais[campos[i].id] || '')) return true;
    }
    return false;
  }

  /* ---------- alternar entre os passos ---------- */
  function mostrarPasso2() {
    document.getElementById('cc-passo1').classList.add('oculto');
    document.getElementById('cc-corpo').classList.remove('oculto');
  }
  function voltarPasso1() {
    document.getElementById('cc-corpo').classList.add('oculto');
    document.getElementById('cc-passo1').classList.remove('oculto');
  }

  /* entra no passo 2: a saudação e o contato que o administrador já tiver cadastrado */
  function abrirPasso2(cpf, codigo, dados) {
    dados = dados || {};
    contexto = { cpf: cpf, codigo: codigo };
    document.getElementById('cc-saudacao').textContent = [dados.posto, dados.nome_completo].filter(Boolean).join(' ');
    var celular = document.getElementById('cc-celular');
    var email = document.getElementById('cc-email');
    celular.value = C.mascararCelular(C.soDigitos(dados.celular));
    email.value = dados.email || '';
    originais = { 'cc-celular': celular.value, 'cc-email': email.value };
    mostrarPasso2();
  }

  /* ---------- entrada ----------
     quem já está logado nem chega aqui: o criar-conta-sessao.js (head)
     desviou para o sistema antes do corpo pintar */
  function iniciar() {
    document.getElementById('cc-voltar-login').addEventListener('click', function () {
      window.location.href = 'login.html';
    });
    C.ligarMascara(document.getElementById('cc-celular'), C.mascararCelular);

    /* fechar ou recarregar com o formulário preenchido avisa antes */
    if (RW.guardaSaida) RW.guardaSaida.registrar(temAlgoDigitado);

    var voltar2 = document.getElementById('cc-p2-voltar');
    if (voltar2) voltar2.addEventListener('click', voltarPasso1);

    if (RW.criarContaEnvio) RW.criarContaEnvio.ligar(rpc);
  }

  RW.criarConta = {
    marcarEnviado: function () { enviado = true; },
    abrirPasso2: abrirPasso2,
    contexto: function () { return contexto; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
