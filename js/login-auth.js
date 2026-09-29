(function () {
  'use strict';

  var SUPABASE_URL = 'https://dyrroflwjsntlunwteod.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_UsjhNoRoOrKQdNhmt-oj4g_3a7fvl52';

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

    var botaoLinks = document.querySelectorAll('.login-links .botao');

    if (btnEntrar) window.RosterWork.iniciarCarregando(btnEntrar);
    if (inputId) inputId.disabled = true;
    if (inputSenha) inputSenha.disabled = true;
    botaoLinks.forEach(function (b) { b.disabled = true; });

    function desbloquear() {
      if (btnEntrar) window.RosterWork.pararCarregando(btnEntrar);
      if (inputId) inputId.disabled = false;
      if (inputSenha) inputSenha.disabled = false;
      botaoLinks.forEach(function (b) { b.disabled = false; });
    }

    try {
      var respLookup = await fetch(SUPABASE_URL + '/rest/v1/rpc/fn_login_buscar_email', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        /* a senha vai junto: quem se cadastrou e ainda espera aprovação não tem
           conta de acesso, então é o banco quem confere a senha dele. Sem isso o
           estado do cadastro apareceria para qualquer um que digitasse o CPF. */
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

      var respAuth = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: resultado.email, password: senha })
      });

      if (!respAuth.ok) {
        desbloquear();
        mostrarErroCampo(inputSenha, window.RosterWork.mensagens.login.senhaIncorreta);
        return;
      }

      var authData = await respAuth.json();
      sessionStorage.setItem('rosterwork_session', JSON.stringify({
        access_token: authData.access_token,
        refresh_token: authData.refresh_token
      }));

      var perfil = null;
      try {
        var respPerfil = await fetch(SUPABASE_URL + '/rest/v1/rpc/fn_perfil_usuario', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + authData.access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ p_email: resultado.email })
        });
        if (respPerfil.ok) {
          perfil = await respPerfil.json();
          if (perfil.ok) {
            /* marca se é programador (vê a seção Programador › Mensagens) */
            try {
              var respProg = await fetch(SUPABASE_URL + '/rest/v1/rpc/fn_sou_programador', {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': 'Bearer ' + authData.access_token,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
              });
              if (respProg.ok) perfil.is_programador = (await respProg.json()) === true;
            } catch (e) {}
            sessionStorage.setItem('rosterwork_user', JSON.stringify(perfil));
          }
        }
      } catch (e) {}

      try {
        var respPrefs = await fetch(SUPABASE_URL + '/rest/v1/rpc/fn_preferencias_carregar', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + authData.access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (respPrefs.ok) {
          var prefs = await respPrefs.json();
          /* tema e menu vêm do banco (lembrados entre logins por CPF);
             a seleção de unidades NÃO persiste: começa no PADRÃO AMPLO da lotação
             (CIA/CIBM + pelotões p/ staff; CIA + o próprio pelotão p/ quem é de pelotão),
             é mantida só na sessão e esquecida no logout */
          var padrao = (perfil && perfil.lotacao_id) ? [perfil.lotacao_id] : [];   // fallback: a própria lotação
          try {
            var respPadrao = await fetch(SUPABASE_URL + '/rest/v1/rpc/fn_unidades_padrao', {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + authData.access_token,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            });
            if (respPadrao.ok) {
              var dadosPadrao = await respPadrao.json();
              if (dadosPadrao && dadosPadrao.ok && Array.isArray(dadosPadrao.unidades) && dadosPadrao.unidades.length) {
                padrao = dadosPadrao.unidades;
              }
            }
          } catch (e) {}
          prefs.unidades_selecionadas = padrao;
          sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs));
        }
      } catch (e) {}

      window.location.href = 'index.html';

    } catch (e) {
      desbloquear();
      mostrarErroCampo(inputId, window.RosterWork.mensagens.login.erroConexao);
    }
  }

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.mascaraCpfRg = mascaraCpfRg;
  window.RosterWork.mostrarErroCampo = mostrarErroCampo;
  window.RosterWork.esconderErroCampo = esconderErroCampo;
  window.RosterWork.fazerLogin = fazerLogin;

})();
