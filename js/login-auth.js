(function () {
  'use strict';

  var SUPABASE_URL = 'https://oadzjrekpuddagfydfzn.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_NKSki2dWOD6k6_jle3Ha7w_uq1nYcXx';
  var LIMITE_ENTRADA_MS = 15000;   /* a entrada pelo login lembrado desiste depois disto (o app nunca trava) */

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

    // evita duplo envio se já está carregando; com a tela "entrando", o formulário nem aparece
    if (btnEntrar && btnEntrar.disabled) return;
    if (document.documentElement.hasAttribute('data-entrando')) return;

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
      var respLookup = await fetch(SUPABASE_URL + '/rest/v1/rpc/fn_login_buscar_email', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
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

      await concluirEntrada(authData, resultado.email);
      window.location.href = 'index.html';

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

  /* depois da senha (ou do login lembrado): guarda a sessão e busca o perfil e as preferências;
     marca a chegada para o sistema abrir coberto pela tela de chegada (index-sessao.js).
     sinal: o limite da entrada pelo login lembrado (cancela as chamadas) */
  async function concluirEntrada(authData, email, sinal) {
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
        body: JSON.stringify({ p_email: email }),
        signal: sinal
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
              body: JSON.stringify({}),
              signal: sinal
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
        body: JSON.stringify({}),
        signal: sinal
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
            body: JSON.stringify({}),
            signal: sinal
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

    sessionStorage.setItem('rosterwork_chegada', '1');
    return !!(perfil && perfil.ok);
  }

  /* a tela "entrando" (html[data-entrando]): o giratório, ou a falha com a frase e o Tentar de novo */
  function mostrarEntrando(mensagem) {
    var bloco = document.querySelector('.login-entrando');
    if (!bloco) return;
    bloco.classList.toggle('login-entrando--falhou', !!mensagem);
    bloco.querySelector('.login-entrando-mensagem').textContent = mensagem || '';
  }

  /* volta ao formulário de login, com a frase do que houve (ou nenhuma) */
  function mostrarFormulario(aviso) {
    document.documentElement.removeAttribute('data-entrando');
    var linha = document.getElementById('login-aviso');
    if (!linha) return;
    linha.textContent = aviso || '';
    linha.classList.toggle('oculto', !aviso);
  }

  /* login lembrado neste aparelho (Manter-me conectado): a tela fica "entrando" (só a logo e o
     giratório) até o sistema abrir. Sem internet, servidor fora ou passou do limite: a frase e o
     Tentar de novo, e o aparelho continua lembrando. Recusado pelo servidor (saiu de todos os
     aparelhos, baixa, senha trocada): esquece e mostra o formulário com o aviso */
  async function entrarLembrado() {
    var M = window.RosterWork.mensagens.login;
    var lembrado = window.RosterWork.conectado.lembrado();
    if (!lembrado) { mostrarFormulario(''); return; }
    mostrarEntrando('');

    var controle = new AbortController();
    var limite = setTimeout(function () { controle.abort(); }, LIMITE_ENTRADA_MS);
    function falhou(mensagem) {
      clearTimeout(limite);
      sessionStorage.clear();
      mostrarEntrando(mensagem);
    }

    var resp;
    try {
      resp = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: lembrado.refresh_token }),
        signal: controle.signal
      });
    } catch (e) {
      falhou(controle.signal.aborted ? M.entrandoTenteDepois : M.entrandoSemInternet);
      return;
    }

    if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
      clearTimeout(limite);
      window.RosterWork.conectado.esquecer();
      mostrarFormulario(M.sessaoTerminou);
      return;
    }
    var authData = resp.ok ? await resp.json().catch(function () { return null; }) : null;
    if (!authData || !authData.access_token) { falhou(M.entrandoTenteDepois); return; }

    window.RosterWork.conectado.atualizar(authData.access_token, authData.refresh_token);
    var entrou = await concluirEntrada(authData, authData.user ? authData.user.email : '', controle.signal);
    if (!entrou || controle.signal.aborted) { falhou(M.entrandoTenteDepois); return; }
    clearTimeout(limite);
    window.location.href = 'index.html';
  }

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.mascaraCpfRg = mascaraCpfRg;
  window.RosterWork.mostrarErroCampo = mostrarErroCampo;
  window.RosterWork.esconderErroCampo = esconderErroCampo;
  window.RosterWork.fazerLogin = fazerLogin;
  window.RosterWork.entrarLembrado = entrarLembrado;

})();
