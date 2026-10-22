/* ============================================================
   ENTRADA — o acesso vira sessão nesta aba (fonte única)
   concluir(authData, email, sinal): guarda o acesso no sessionStorage e
   busca, ao mesmo tempo, o perfil, se é programador, as preferências e
   as unidades padrão (uma ida e volta só, não quatro). Usado pelo login
   (depois da senha) e pela renovação abaixo.
   renovarLembrado(): o login lembrado no aparelho (Manter-me conectado,
   geral-conectado.js) vira sessão: renova o acesso pela chave guardada
   e conclui a entrada. Resolve { ok: true } ou { falha: 'recusado' |
   'sem_internet' | 'tente_depois' }; recusado (saiu de todos os
   aparelhos, baixa, senha trocada) já esquece o login lembrado. Usado
   pelo sistema ao abrir sem sessão na aba (js/index-sessao.js).
   Roda síncrono no <head> (index.html e login.html), depois do
   geral-conectado.js.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var BANCO_URL = 'https://oadzjrekpuddagfydfzn.supabase.co';
  var BANCO_CHAVE = 'sb_publishable_NKSki2dWOD6k6_jle3Ha7w_uq1nYcXx';
  var LIMITE_MS = 15000;   /* a entrada pelo login lembrado desiste depois disto (o app nunca trava) */

  /* sinal: o limite da entrada pelo login lembrado (cancela as chamadas) */
  async function concluir(authData, email, sinal) {
    sessionStorage.setItem('rosterwork_session', JSON.stringify({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token
    }));

    /* uma chamada de RPC com a sessão nova; a falha (rede, resposta ruim) vira null */
    function chamar(nome, corpo) {
      return fetch(BANCO_URL + '/rest/v1/rpc/' + nome, {
        method: 'POST',
        headers: {
          'apikey': BANCO_CHAVE,
          'Authorization': 'Bearer ' + authData.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(corpo || {}),
        signal: sinal
      }).then(function (resp) { return resp.ok ? resp.json() : null; }).catch(function () { return null; });
    }

    var respostas = await Promise.all([
      chamar('fn_perfil_usuario', { p_email: email }),
      chamar('fn_sou_programador'),
      chamar('fn_preferencias_carregar'),
      chamar('fn_unidades_padrao')
    ]);
    var perfil = respostas[0], programador = respostas[1], prefs = respostas[2], dadosPadrao = respostas[3];

    if (perfil && perfil.ok) {
      /* marca se é programador (vê a seção Programador › Mensagens) */
      perfil.is_programador = programador === true;
      sessionStorage.setItem('rosterwork_user', JSON.stringify(perfil));
    }

    if (prefs) {
      /* tema e menu vêm do banco (lembrados entre logins por CPF);
         a seleção de unidades NÃO persiste: começa no PADRÃO AMPLO da lotação
         (CIA/CIBM + pelotões p/ staff; CIA + o próprio pelotão p/ quem é de pelotão),
         é mantida só na sessão e esquecida no logout */
      var padrao = (perfil && perfil.lotacao_id) ? [perfil.lotacao_id] : [];   // fallback: a própria lotação
      if (dadosPadrao && dadosPadrao.ok && Array.isArray(dadosPadrao.unidades) && dadosPadrao.unidades.length) {
        padrao = dadosPadrao.unidades;
      }
      prefs.unidades_selecionadas = padrao;
      sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs));
    }

    return !!(perfil && perfil.ok);
  }

  /* sem internet, servidor fora ou passou do limite: a falha, e o aparelho continua lembrando.
     Recusado pelo servidor: esquece o login lembrado */
  async function renovarLembrado() {
    var lembrado = RW.conectado ? RW.conectado.lembrado() : null;
    if (!lembrado) return { falha: 'recusado' };

    var controle = new AbortController();
    var limite = setTimeout(function () { controle.abort(); }, LIMITE_MS);
    function falhou(motivo) {
      clearTimeout(limite);
      sessionStorage.clear();
      return { falha: motivo };
    }

    var resp;
    try {
      resp = await fetch(BANCO_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': BANCO_CHAVE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: lembrado.refresh_token }),
        signal: controle.signal
      });
    } catch (e) {
      return falhou(controle.signal.aborted ? 'tente_depois' : 'sem_internet');
    }

    if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
      clearTimeout(limite);
      RW.conectado.esquecer();
      return { falha: 'recusado' };
    }
    var authData = resp.ok ? await resp.json().catch(function () { return null; }) : null;
    if (!authData || !authData.access_token) return falhou('tente_depois');

    RW.conectado.atualizar(authData.access_token, authData.refresh_token);
    var entrou = await concluir(authData, authData.user ? authData.user.email : '', controle.signal);
    if (!entrou || controle.signal.aborted) return falhou('tente_depois');
    clearTimeout(limite);
    return { ok: true };
  }

  RW.entrada = {
    banco: { url: BANCO_URL, chave: BANCO_CHAVE },
    concluir: concluir,
    renovarLembrado: renovarLembrado
  };
})();
