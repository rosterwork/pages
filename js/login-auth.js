(function () {
  'use strict';

  function mascaraCpfRg(nums) {
    if (nums.length <= 9) {
      if (nums.length <= 1) return nums;
      if (nums.length <= 4) return nums.substring(0, 1) + '.' + nums.substring(1);
      if (nums.length <= 7) return nums.substring(0, 1) + '.' + nums.substring(1, 4) + '.' + nums.substring(4);
      if (nums.length <= 8) return nums.substring(0, 1) + '.' + nums.substring(1, 4) + '.' + nums.substring(4, 7) + '-' + nums.substring(7);
      return nums.substring(0, 2) + '.' + nums.substring(2, 5) + '.' + nums.substring(5, 8) + '-' + nums.substring(8);
    }
    return nums.substring(0, 3) + '.' + nums.substring(3, 6) + '.' + nums.substring(6, 9) + '-' + nums.substring(9, 11);
  }

  function mostrarErroCampo(inputEl, mensagem) {
    var campo = inputEl.closest('.campo');
    if (!campo) return;
    campo.classList.add('campo--erro');
    var erroTexto = campo.querySelector('.campo-erro-texto');
    if (erroTexto) erroTexto.textContent = mensagem;
  }

  function esconderErroCampo(inputEl) {
    var campo = inputEl.closest('.campo');
    if (!campo) return;
    campo.classList.remove('campo--erro');
    var erroTexto = campo.querySelector('.campo-erro-texto');
    if (erroTexto) erroTexto.textContent = '';
  }

  async function fazerLogin() {
    var inputId = document.getElementById('entrada-identificador');
    var inputSenha = document.getElementById('entrada-senha');
    var btnEntrar = document.getElementById('btn-entrar');
    var banco = window.RosterWork.entrada.banco;   /* o endereço e a chave pública do banco (componentes/js/geral-entrada.js) */

    // evita duplo envio se já está carregando
    if (btnEntrar && btnEntrar.disabled) return;

    if (inputId) esconderErroCampo(inputId);
    if (inputSenha) esconderErroCampo(inputSenha);

    var identificador = inputId ? inputId.value.replace(/\D/g, '') : '';
    var senha = inputSenha ? inputSenha.value : '';

    if (!identificador) {
      mostrarErroCampo(inputId, window.RosterWork.mensagens.login.identificadorVazio);
      return;
    }
    if (identificador.length !== 8 && identificador.length !== 9 && identificador.length !== 11) {
      mostrarErroCampo(inputId, window.RosterWork.mensagens.login.identificadorInvalido);
      return;
    }
    if (!senha) {
      mostrarErroCampo(inputSenha, window.RosterWork.mensagens.login.senhaVazia);
      return;
    }

    travarFormulario(true);
    function desbloquear() { travarFormulario(false); }

    try {
      var respLookup = await fetch(banco.url + '/rest/v1/rpc/fn_login_buscar_email', {
        method: 'POST',
        headers: {
          'apikey': banco.chave,
          'Authorization': 'Bearer ' + banco.chave,
          'Content-Type': 'application/json'
        },
        /* a senha vai junto: o banco confere a senha antes de devolver o endereço de
           login da conta (sorteado, diferente do e-mail da ficha), que só serve para entrar. */
        body: JSON.stringify({ p_identificador: identificador, p_senha: senha })
      });

      if (!respLookup.ok) {
        desbloquear();
        mostrarErroCampo(inputId, window.RosterWork.mensagens.login.erroConexao);
        return;
      }

      var resultado = await respLookup.json();
      if (!resultado.ok) {
        desbloquear();
        /* o banco diz em qual campo o erro nasceu: senha errada aparece no campo
           da senha, como em qualquer outro login */
        var campoErro = resultado.campo === 'senha' ? inputSenha : inputId;
        mostrarErroCampo(campoErro, resultado.erro || window.RosterWork.mensagens.login.naoEncontrado);
        return;
      }

      var respAuth = await fetch(banco.url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': banco.chave,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: resultado.email, password: senha })
      });

      if (!respAuth.ok) {
        desbloquear();
        /* 429: o Supabase recusou por excesso de entradas do mesmo endereço de internet */
        if (respAuth.status === 429) mostrarErroCampo(inputId, window.RosterWork.mensagens.geral.muitasEntradas);
        else mostrarErroCampo(inputSenha, window.RosterWork.mensagens.login.senhaIncorreta);
        return;
      }

      var authData = await respAuth.json();

      /* Manter-me conectado: marcada, o aparelho lembra o login; desmarcada, esquece o que houver */
      var caixaConectado = document.getElementById('login-conectado');
      if (caixaConectado && caixaConectado.getAttribute('aria-checked') === 'true') {
        window.RosterWork.conectado.lembrar(authData.access_token, authData.refresh_token);
      } else {
        window.RosterWork.conectado.esquecer();
      }

      await window.RosterWork.entrada.concluir(authData, resultado.email);
      window.RosterWork.aplicativo.irPara('index.html');   /* com versão nova do app esperando, entra já nela */

    } catch (e) {
      desbloquear();
      mostrarErroCampo(inputId, window.RosterWork.mensagens.login.erroConexao);
    }
  }

  /* trava (ou libera) o formulário enquanto entra: o Entrar gira; campos, caixa e links travam */
  function travarFormulario(travar) {
    var btnEntrar = document.getElementById('btn-entrar');
    if (btnEntrar) {
      if (travar) window.RosterWork.iniciarCarregando(btnEntrar);
      else window.RosterWork.pararCarregando(btnEntrar);
    }
    ['entrada-identificador', 'entrada-senha', 'login-conectado'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.disabled = travar;
    });
    document.querySelectorAll('.login-links .botao').forEach(function (b) { b.disabled = travar; });
  }

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.mascaraCpfRg = mascaraCpfRg;
  window.RosterWork.mostrarErroCampo = mostrarErroCampo;
  window.RosterWork.esconderErroCampo = esconderErroCampo;
  window.RosterWork.fazerLogin = fazerLogin;

})();
