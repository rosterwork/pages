/* ============================================================
   USUÁRIOS — seção "Acesso ao sistema" da ficha (modo Ver, só admin)
   O administrador gera o link e manda a mensagem pronta no privado
   do militar:
   · sem conta: link de cadastro (a pessoa confere a ficha e cria a conta);
   · com conta: link de nova senha (quem esqueceu a senha pede pessoalmente).
   Um link por vez: enquanto ele vale, a seção mostra só a mensagem,
   "Copiar mensagem" e "Cancelar link". O estado vem de acesso_estado.
   Gerar e cancelar gravam no Histórico, mas não abrem o modal de
   resumo (exceção da REGRAS §8.2: o que importa aqui é a mensagem).
   Clona moldes.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { pessoa, alvo }: a seção da ficha aberta

  function avisarErro(mensagem) {
    if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: mensagem });
  }

  /* "AAAA-MM-DDTHH:MM:SS" (Brasília) -> { data: DD/MM/AAAA, hora: HH:MM, curta: DD/MM HH:MM } */
  function partesDataHora(iso) {
    var partes = String(iso || '').slice(0, 16).split('T');
    var d = partes[0].split('-');
    var hora = partes[1] || '';
    if (d.length !== 3) return { data: '', hora: hora, curta: '' };
    return { data: d[2] + '/' + d[1] + '/' + d[0], hora: hora, curta: d[2] + '/' + d[1] + ' ' + hora };
  }

  /* o endereço da tela que o link abre, ao lado do sistema (serve em qualquer domínio) */
  function enderecoDoLink(link) {
    var pagina = link.tipo === 'senha' ? 'nova-senha.html' : 'criar-conta.html';
    return new URL(pagina + '?codigo=' + encodeURIComponent(link.codigo), window.location.href).href;
  }

  function textoMensagem(nome, link) {
    var T = RosterWork.mensagens.usuarios;
    var q = partesDataHora(link.expira_em);
    var modelo = link.tipo === 'senha' ? T.mensagemSenha : T.mensagemCadastro;
    return modelo(nome, enderecoDoLink(link), q.data, q.hora);
  }

  /* recarrega os cards da lista: o selo do militar acompanha o link */
  function recarregarLista() {
    if (RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.recarregar) RosterWork.arvoreUnidades.recarregar();
  }

  function copiar(area, botao) {
    var B = RosterWork.mensagens.botoes;
    function falhou() {
      area.select();
      avisarErro(RosterWork.mensagens.usuarios.falhaCopiar);
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { falhou(); return; }
    navigator.clipboard.writeText(area.value).then(function () {
      botao.textContent = B.mensagemCopiada;
      setTimeout(function () { botao.textContent = B.copiarMensagem; }, 2000);
    }).catch(falhou);
  }

  /* desenha a seção: sem link, o que fazer + o botão de gerar;
     com link, até quando vale + a mensagem, Copiar mensagem e Cancelar link */
  function desenhar(atual, estado) {
    if (ctx !== atual) return;
    var T = RosterWork.mensagens.usuarios;
    atual.alvo.textContent = '';
    var box = RosterWork.tpl('tpl-usuarios-acesso-estado');
    if (!box) return;
    var texto = box.querySelector('[data-acesso-estado]');
    atual.alvo.appendChild(box);

    if (!estado.link) {
      texto.textContent = estado.tem_conta ? T.acessoComConta : T.acessoSemConta;
      var botao = RosterWork.tpl(estado.tem_conta ? 'tpl-usuarios-link-senha-botao' : 'tpl-usuarios-link-cadastro-botao');
      if (!botao) return;
      botao.addEventListener('click', function () { gerar(atual, botao); });
      atual.alvo.appendChild(botao);
      return;
    }

    var q = partesDataHora(estado.link.expira_em);
    texto.textContent = (estado.link.tipo === 'senha' ? T.linkSenhaAtivo : T.linkCadastroAtivo).replace('{ate}', q.curta);
    var tpl = document.getElementById('tpl-usuarios-acesso-link');
    if (!tpl) return;
    var bloco = tpl.content.cloneNode(true);
    var area = bloco.querySelector('[data-acesso-mensagem]');
    var btnCopiar = bloco.querySelector('[data-acesso-copiar]');
    var btnCancelar = bloco.querySelector('[data-acesso-cancelar]');
    area.value = textoMensagem(estado.nome, estado.link);
    area.addEventListener('focus', function () { area.select(); });
    btnCopiar.addEventListener('click', function () { copiar(area, btnCopiar); });
    btnCancelar.addEventListener('click', function () { cancelar(atual, btnCancelar); });
    atual.alvo.appendChild(bloco);
  }

  /* lê o estado do acesso (tem conta? há link valendo?) e desenha */
  function carregar(atual) {
    RosterWork.apiFetch('/rest/v1/rpc/acesso_estado', { metodo: 'POST', corpo: { p_cpf: atual.pessoa.usuario_id } })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (e) {
        if (ctx !== atual) return;
        if (!e || !e.ok) { avisarErro(RosterWork.mensagens.geral.falhaCarregar); return; }
        desenhar(atual, e);
      })
      .catch(function () { if (ctx === atual) avisarErro(RosterWork.mensagens.geral.erroConexao); });
  }

  function gerar(atual, botao) {
    RosterWork.iniciarCarregando(botao);
    RosterWork.apiFetch('/rest/v1/rpc/acesso_link_gerar', { metodo: 'POST', corpo: { p_cpf: atual.pessoa.usuario_id } })
      .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
      .then(function (r) {
        RosterWork.pararCarregando(botao);
        if (r && r._falha === 'servidor') { avisarErro(RosterWork.mensagens.geral.falhaServidor); return; }
        if (r && r.success) {
          desenhar(atual, {
            tem_conta: r.tipo === 'senha',
            nome: r.nome,
            link: { tipo: r.tipo, codigo: r.codigo, expira_em: r.expira_em }
          });
          recarregarLista();
          return;
        }
        avisarErro((r && r.error) || RosterWork.mensagens.usuarios.falhaLink);
      })
      .catch(function () {
        RosterWork.pararCarregando(botao);
        avisarErro(RosterWork.mensagens.geral.semConexao);
      });
  }

  /* cancela o link que vale (mandou para a pessoa errada, por exemplo); pede confirmação antes */
  function cancelar(atual, botao) {
    var T = RosterWork.mensagens.usuarios, B = RosterWork.mensagens.botoes;
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: T.confirmarCancelarLink,
      textoConfirmar: B.cancelarLink,
      textoCancelar: B.manter,
      confirmarPerigo: true,
      aoConfirmar: function () {
        RosterWork.iniciarCarregando(botao);
        RosterWork.apiFetch('/rest/v1/rpc/acesso_link_cancelar', { metodo: 'POST', corpo: { p_cpf: atual.pessoa.usuario_id } })
          .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
          .then(function (r) {
            RosterWork.pararCarregando(botao);
            if (r && r._falha === 'servidor') { avisarErro(RosterWork.mensagens.geral.falhaServidor); return; }
            if (r && r.success) {
              if (ctx === atual) carregar(atual);
              recarregarLista();
              return;
            }
            avisarErro((r && r.error) || T.falhaCancelarLink);
          })
          .catch(function () {
            RosterWork.pararCarregando(botao);
            avisarErro(RosterWork.mensagens.geral.semConexao);
          });
      }
    });
  }

  /* ---------- seção ---------- */

  function montar(corpo, ficha, pessoa) {
    ctx = null;
    if (!RosterWork.sessao.ehAdmin() || !ficha || !pessoa || pessoa.situacao === 'Inativo') return;
    var secao = RosterWork.painel.criarSecaoColapsavel('Acesso ao sistema', { aberta: true });
    if (!secao) return;
    var atual = { pessoa: pessoa, alvo: secao.querySelector('.painel-secao-corpo') };
    ctx = atual;
    corpo.appendChild(secao);
    carregar(atual);
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelAcesso = { montar: montar, reset: reset };
})();
