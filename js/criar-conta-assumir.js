/* ============================================================
   CRIAR CONTA › passo 1 (identificação pelo CPF).
   A pessoa informa o CPF; o banco (fn_conta_status) diz o caminho,
   sem revelar dado nenhum:
     - tem_acesso    -> já tem conta, manda para "Esqueci minha senha"
     - precisa_token -> o admin já pré-cadastrou: revela o campo de token;
                        com o token certo (convite_resgatar_buscar) a ficha
                        aparece no passo 2 para conferir e criar a senha
     - novo          -> CPF inédito: passo 2 em branco (cadastro que o
                        administrador aprova)
   O preenchimento e a troca de passos ficam no criar-conta.js
   (RosterWork.criarConta.iniciarModoToken / iniciarModoNovo).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var C = RW.campos, V = RW.validacoes;

  /* 'cpf'   — confere o CPF e descobre o caminho
     'token' — o CPF pede token; o Continuar agora valida o token */
  var etapa = 'cpf';

  function el(id) { return document.getElementById(id); }

  function rpc(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  function carregando(botao, ligar) {
    if (ligar && RW.iniciarCarregando) RW.iniciarCarregando(botao);
    if (!ligar && RW.pararCarregando) RW.pararCarregando(botao);
  }

  /* trocar o CPF depois que o token apareceu volta para a etapa do CPF */
  function resetarToken() {
    etapa = 'cpf';
    el('cc-p1-token-campo').classList.add('oculto');
    el('cc-p1-token-nota').classList.add('oculto');
    el('cc-p1-token').value = '';
    C.limparErro(el('cc-p1-token'));
  }

  function validarCpf() {
    C.limparErro(el('cc-p1-cpf'));
    var textos = RW.mensagens.cadastro;
    var cpf = el('cc-p1-cpf').value.trim();
    if (!cpf) { C.marcarErro(el('cc-p1-cpf'), textos.cpfVazio); return false; }
    if (!V.validarCpf(cpf)) { C.marcarErro(el('cc-p1-cpf'), textos.cpfInvalido); return false; }
    return true;
  }

  /* etapa do CPF: pergunta o caminho ao banco */
  function conferirCpf() {
    if (!validarCpf()) return;
    var botao = el('cc-p1-continuar');
    carregando(botao, true);
    var cpf = V.soDigitos(el('cc-p1-cpf').value);

    rpc('fn_conta_status', { p_cpf: cpf })
      .then(function (r) {
        if (!r || r.ok !== true) {
          carregando(botao, false);
          if (r && r.campo === 'cpf') { C.marcarErro(el('cc-p1-cpf'), r.erro); return; }
          RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || RW.mensagens.geral.semConexao });
          return;
        }

        if (r.estado === 'tem_acesso') {
          carregando(botao, false);
          RW.avisar({
            tipo: 'alerta',
            mensagem: RW.mensagens.criarConta.jaTemAcesso,
            aoConfirmar: function () { window.location.href = 'recuperar-senha.html'; }
          });
          return;
        }

        if (r.estado === 'precisa_token') {
          carregando(botao, false);
          etapa = 'token';
          el('cc-p1-token-campo').classList.remove('oculto');
          el('cc-p1-token-nota').classList.remove('oculto');
          el('cc-p1-token').focus();
          return;
        }

        /* novo: precisa dos postos e da árvore carregados antes de mostrar o passo 2 */
        var aguardar = (RW.criarConta && RW.criarConta.aguardarOpcoes)
          ? RW.criarConta.aguardarOpcoes() : Promise.resolve();
        aguardar.then(function () {
          carregando(botao, false);
          if (RW.criarConta) RW.criarConta.iniciarModoNovo(cpf);
        });
      })
      .catch(function () {
        carregando(botao, false);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  /* etapa do token: valida e traz a ficha para conferir */
  function conferirToken() {
    C.limparErro(el('cc-p1-token'));
    var textos = RW.mensagens.cadastro;
    var token = el('cc-p1-token').value.trim();
    if (!token) { C.marcarErro(el('cc-p1-token'), textos.tokenVazio); return; }

    var botao = el('cc-p1-continuar');
    carregando(botao, true);
    var cpf = V.soDigitos(el('cc-p1-cpf').value);

    rpc('convite_resgatar_buscar', { p_cpf: cpf, p_token: token })
      .then(function (r) {
        if (!r || r.ok !== true) {
          carregando(botao, false);
          C.marcarErro(el('cc-p1-token'), (r && r.erro) || textos.tokenInvalido);
          return;
        }
        var aguardar = (RW.criarConta && RW.criarConta.aguardarOpcoes)
          ? RW.criarConta.aguardarOpcoes() : Promise.resolve();
        aguardar.then(function () {
          carregando(botao, false);
          if (RW.criarConta) RW.criarConta.iniciarModoToken(cpf, token, r.dados);
        });
      })
      .catch(function () {
        carregando(botao, false);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  function continuar() {
    if (etapa === 'token') conferirToken();
    else conferirCpf();
  }

  /* mostra o token em MAIÚSCULAS e com o hífen no meio (XXXX-XXXX) */
  function ligarMascaraToken() {
    var campo = el('cc-p1-token');
    if (!campo) return;
    campo.addEventListener('input', function () {
      var bruto = campo.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8);
      campo.value = bruto.length > 4 ? bruto.slice(0, 4) + '-' + bruto.slice(4) : bruto;
    });
  }

  function iniciar() {
    var cpf = el('cc-p1-cpf'), token = el('cc-p1-token'), botao = el('cc-p1-continuar');
    if (!cpf || !botao) return;
    C.ligarMascara(cpf, C.mascararCpf);
    ligarMascaraToken();
    cpf.addEventListener('input', function () { if (etapa === 'token') resetarToken(); });
    botao.addEventListener('click', continuar);
    /* Enter em qualquer um dos campos avança */
    [cpf, token].forEach(function (campo) {
      if (!campo) return;
      campo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); continuar(); }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
