/* ============================================================
   USUÁRIOS — seção "Acesso ao sistema" da ficha (modo Ver, só admin)
   · militar SEM conta: o token para ele criar a conta (convite_gerar);
     o código aparece uma vez num aviso.
   · militar COM conta: o link de nova senha para quem esqueceu a senha
     (senha_link_gerar). O link aparece na própria seção, com "Copiar
     link", para o admin entregar à pessoa; vale uma vez e por 24 horas.
     Grava no Histórico, mas não abre o modal de resumo (exceção
     aprovada: o que importa aqui é copiar o link).
   O estado das duas coisas vem de convite_estado. Clona moldes.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { pessoa, estadoEl, botao, alvo, link: [elementos do link na tela] }

  /* ISO "AAAA-MM-DDTHH:MM:SS" -> "DD/MM HH:MM" */
  function formatarDataHora(iso) {
    if (!iso) return '';
    var partes = String(iso).slice(0, 16).split('T');
    var d = partes[0].split('-');
    if (d.length !== 3) return iso;
    return partes.length < 2 ? d[2] + '/' + d[1] + '/' + d[0] : d[2] + '/' + d[1] + ' ' + partes[1];
  }

  function avisarErro(mensagem) {
    if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: mensagem });
  }

  /* lê o estado (token ou link) e ajusta o texto e o rótulo do botão */
  function atualizarEstado(atual) {
    RosterWork.apiFetch('/rest/v1/rpc/convite_estado', { metodo: 'POST', corpo: { p_cpf: atual.pessoa.usuario_id } })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (e) {
        if (ctx !== atual || !e || !e.ok) return;
        var T = RosterWork.mensagens.usuarios, B = RosterWork.mensagens.botoes;
        if (e.tem_conta) {
          var ativo = e.estado === 'link_ativo';
          atual.estadoEl.textContent = ativo ? T.linkAtivo.replace('{ate}', formatarDataHora(e.ate)) : T.linkNenhum;
          atual.botao.textContent = ativo ? B.gerarNovoLink : B.gerarLink;
        } else if (e.estado === 'ativo') {
          atual.estadoEl.textContent = T.tokenAtivo.replace('{ate}', formatarDataHora(e.ate));
          atual.botao.textContent = B.gerarNovoToken;
        } else if (e.estado === 'em_uso') {
          atual.estadoEl.textContent = T.tokenEmUso.replace('{ate}', formatarDataHora(e.ate));
          atual.botao.textContent = B.gerarNovoToken;
        } else {
          atual.estadoEl.textContent = T.tokenNenhum;
          atual.botao.textContent = B.gerarToken;
        }
      })
      .catch(function () {});
  }

  /* ---------- sem conta: token ---------- */

  function gerarToken(atual) {
    RosterWork.apiFetch('/rest/v1/rpc/convite_gerar', { metodo: 'POST', corpo: { p_cpf: atual.pessoa.usuario_id } })
      .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
      .then(function (r) {
        if (r && r._falha === 'servidor') { avisarErro(RosterWork.mensagens.geral.falhaServidor); return; }
        if (r && r.success) {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'sucesso', mensagem: RosterWork.mensagens.usuarios.tokenGerado.replace('{token}', r.token || '') });
          if (ctx === atual) atualizarEstado(atual);
          return;
        }
        avisarErro((r && r.error) || RosterWork.mensagens.usuarios.falhaToken);
      })
      .catch(function () { avisarErro(RosterWork.mensagens.geral.semConexao); });
  }

  /* ---------- com conta: link de nova senha ---------- */

  /* o endereço completo da tela Nova senha, ao lado do sistema (serve em qualquer domínio) */
  function enderecoDoLink(token) {
    return new URL('nova-senha.html?codigo=' + encodeURIComponent(token), window.location.href).href;
  }

  function copiar(entrada, botao) {
    var B = RosterWork.mensagens.botoes;
    function falhou() {
      entrada.select();
      avisarErro(RosterWork.mensagens.usuarios.falhaCopiar);
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { falhou(); return; }
    navigator.clipboard.writeText(entrada.value).then(function () {
      botao.textContent = B.linkCopiado;
      setTimeout(function () { botao.textContent = B.copiarLink; }, 2000);
    }).catch(falhou);
  }

  /* mostra o link recém-gerado (substitui um anterior que ainda estivesse na tela) */
  function mostrarLink(atual, token) {
    atual.link.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    var tpl = document.getElementById('tpl-usuarios-link-senha');
    if (!tpl) return;
    var bloco = tpl.content.cloneNode(true);
    var entrada = bloco.querySelector('[data-link-senha]');
    var botao = bloco.querySelector('[data-copiar-link]');
    entrada.value = enderecoDoLink(token);
    entrada.addEventListener('focus', function () { entrada.select(); });
    botao.addEventListener('click', function () { copiar(entrada, botao); });
    atual.link = Array.prototype.slice.call(bloco.children);
    atual.alvo.appendChild(bloco);
  }

  function gerarLink(atual) {
    RosterWork.iniciarCarregando(atual.botao);
    RosterWork.apiFetch('/rest/v1/rpc/senha_link_gerar', { metodo: 'POST', corpo: { p_cpf: atual.pessoa.usuario_id } })
      .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
      .then(function (r) {
        RosterWork.pararCarregando(atual.botao);
        if (r && r._falha === 'servidor') { avisarErro(RosterWork.mensagens.geral.falhaServidor); return; }
        if (r && r.success) {
          if (ctx !== atual) return;
          mostrarLink(atual, r.token || '');
          atualizarEstado(atual);
          /* o pedido saiu do sino de todos os administradores */
          if (RosterWork.avisosSino) RosterWork.avisosSino.recarregar();
          return;
        }
        avisarErro((r && r.error) || RosterWork.mensagens.usuarios.falhaLink);
      })
      .catch(function () {
        RosterWork.pararCarregando(atual.botao);
        avisarErro(RosterWork.mensagens.geral.semConexao);
      });
  }

  /* ---------- seção ---------- */

  function montar(corpo, ficha, pessoa) {
    ctx = null;
    if (!RosterWork.sessao.ehAdmin() || !ficha || !pessoa || pessoa.situacao === 'Inativo') return;
    var secao = RosterWork.painel.criarSecaoColapsavel('Acesso ao sistema', { aberta: true });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    var estadoBox = RosterWork.tpl('tpl-usuarios-acesso-estado');
    var temConta = ficha.tem_conta !== false;
    var botao = RosterWork.tpl(temConta ? 'tpl-usuarios-link-botao' : 'tpl-usuarios-token-botao');
    if (!estadoBox || !botao) return;
    var atual = { pessoa: pessoa, estadoEl: estadoBox.querySelector('[data-acesso-estado]'), botao: botao, alvo: alvo, link: [] };
    ctx = atual;
    alvo.appendChild(estadoBox);
    botao.addEventListener('click', function () { if (temConta) gerarLink(atual); else gerarToken(atual); });
    alvo.appendChild(botao);
    corpo.appendChild(secao);
    atualizarEstado(atual);
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelAcesso = { montar: montar, reset: reset };
})();
