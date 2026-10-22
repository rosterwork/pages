/* ============================================================
   NOTIFICAÇÕES NO CELULAR — liga e desliga neste aparelho
   Pede a permissão do aparelho, inscreve o aparelho no serviço de
   envio do navegador (com a chave pública VAPID) e guarda o
   "endereço de entrega" no banco (notificacoes_aparelho_salvar).
   Quem envia é o programa notificacoes-enviar, no Supabase, chamado
   pelo banco a cada aviso pessoal; quem mostra é o armazém do app
   (aplicativo-armazem.js). Ao sair, o aparelho para de receber.
   No app instalado no celular, vêm ligadas por padrão: ao entrar no
   sistema, o aparelho que já permitiu liga sozinho, e o que nunca foi
   perguntado ganha uma pergunta, uma vez só (oferecerNoApp).
   API: RosterWork.notificacoesCelular.situacao() / ativar() /
        desativar() / desligarAoSair() / desligarTodos()
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* a chave pública do par VAPID (a privada fica só nos segredos do Supabase e no SENHAS) */
  var CHAVE_PUBLICA = 'BDbIsSQ1mzMXHIQvc424envBXM9gkwSzAu65FDU988H04_YSKIbP7aot2tZ9bYnW3VD1RmWVAYRIdALE7k9GnKg';
  var LIMITE_SAIR_MS = 1500;   /* ao sair, não espera mais que isto para desligar */
  var CHAVE_PERGUNTADO = 'rosterwork_notificacoes_perguntado';   /* a marca do aparelho: já perguntou (REGRAS §8.1) */
  var ESPERA_PERGUNTA_MS = 3000;   /* a pergunta espera as janelas da entrada (termos, dados pendentes) */

  function suportado() {
    return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function chaveEmBytes(base64url) {
    var base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    var binario = atob(base64 + '==='.slice((base64.length + 3) % 4));
    var bytes = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  /* a inscrição deste aparelho, ou null */
  function inscricaoAtual() {
    if (!suportado()) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function (registro) {
      return registro ? registro.pushManager.getSubscription() : null;
    }).catch(function () { return null; });
  }

  /* 'ativado' · 'desativado' · 'bloqueado' (a pessoa negou a permissão) ·
     'instalar' (iPhone fora do app instalado) · 'indisponivel' (navegador sem notificações) */
  function situacao() {
    var app = RW.aplicativo;
    if (app && app.iphone() && !app.instalado()) return Promise.resolve('instalar');
    if (!suportado()) return Promise.resolve('indisponivel');
    if (Notification.permission === 'denied') return Promise.resolve('bloqueado');
    return inscricaoAtual().then(function (inscricao) { return inscricao ? 'ativado' : 'desativado'; });
  }

  /* liga: permissão, inscrição e o endereço guardado no banco. Resolve a situação final;
     rejeita quando não conseguiu guardar (a inscrição é desfeita) */
  function ativar() {
    return Notification.requestPermission().then(function (permissao) {
      if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desativado';
      return navigator.serviceWorker.ready.then(function (registro) {
        return registro.pushManager.getSubscription().then(function (existente) {
          return existente || registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(CHAVE_PUBLICA) });
        });
      }).then(function (inscricao) {
        var dados = inscricao.toJSON();
        return RW.rpc('notificacoes_aparelho_salvar', { p_endpoint: dados.endpoint, p_p256dh: dados.keys.p256dh, p_auth: dados.keys.auth })
          .then(function (resposta) {
            if (resposta && resposta.ok) return 'ativado';
            return inscricao.unsubscribe().then(function () { throw new Error('não guardou o aparelho'); });
          });
      });
    });
  }

  /* desliga neste aparelho: tira do banco e desfaz a inscrição */
  function desativar() {
    return inscricaoAtual().then(function (inscricao) {
      if (!inscricao) return 'desativado';
      return RW.rpc('notificacoes_aparelho_remover', { p_endpoint: inscricao.endpoint }).catch(function () {})
        .then(function () { return inscricao.unsubscribe(); })
        .then(function () { return 'desativado'; });
    });
  }

  /* o Sair: desliga neste aparelho (computador compartilhado), sem segurar a saída */
  function desligarAoSair() {
    var limite = new Promise(function (resolver) { setTimeout(resolver, LIMITE_SAIR_MS); });
    return Promise.race([desativar().catch(function () {}), limite]);
  }

  /* o Sair de todos os aparelhos: tira todos os aparelhos da pessoa e desfaz a inscrição daqui */
  function desligarTodos() {
    var limite = new Promise(function (resolver) { setTimeout(resolver, LIMITE_SAIR_MS); });
    var tudo = RW.rpc('notificacoes_aparelhos_remover_todos', {}).catch(function () {})
      .then(inscricaoAtual)
      .then(function (inscricao) { return inscricao ? inscricao.unsubscribe() : null; })
      .catch(function () {});
    return Promise.race([tudo, limite]);
  }

  /* a marca do aparelho: só "sim", sem nenhum dado; sem acesso ao armazenamento, conta como já perguntado */
  function jaPerguntou() {
    try { return localStorage.getItem(CHAVE_PERGUNTADO) === 'sim'; } catch (e) { return true; }
  }

  function marcarPerguntado() {
    try { localStorage.setItem(CHAVE_PERGUNTADO, 'sim'); } catch (e) {}
  }

  /* app instalado no celular, ao entrar no sistema: o aparelho que já permitiu liga sozinho; o que
     nunca foi perguntado ganha a pergunta (Ativar · Agora não), uma vez só; o bloqueado, nada.
     Com outra janela da entrada aberta, a pergunta fica para a próxima abertura. O Ativar chama a
     pergunta do celular no próprio toque, como o iPhone exige */
  function oferecerNoApp() {
    var app = RW.aplicativo;
    if (!app || !app.noCelularInstalado() || !suportado()) return;
    situacao().then(function (s) {
      if (s !== 'desativado') return;
      if (Notification.permission === 'granted') { ativar().catch(function () {}); return; }
      if (Notification.permission !== 'default' || jaPerguntou()) return;
      setTimeout(function () {
        if (document.querySelector('.modal-veu--aberto') || !RW.confirmar) return;
        marcarPerguntado();
        var M = RW.mensagens.notificacoesCelular;
        RW.confirmar({
          tipo: 'aviso',
          mensagem: M.pergunta,
          textoConfirmar: M.ativar,
          textoCancelar: M.agoraNao,
          aoConfirmar: function () {
            ativar().catch(function () { RW.avisar({ tipo: 'erro', mensagem: M.falhaAtivar }); });
          }
        });
      }, ESPERA_PERGUNTA_MS);
    });
  }

  /* depois que todo o código do sistema rodou (RosterWork.sistemaPronto, do js/index-carregar.js) */
  (RW.sistemaPronto || Promise.resolve()).then(oferecerNoApp);

  RW.notificacoesCelular = {
    situacao: situacao,
    ativar: ativar,
    desativar: desativar,
    desligarAoSair: desligarAoSair,
    desligarTodos: desligarTodos
  };
})();
