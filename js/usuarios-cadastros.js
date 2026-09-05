/* ============================================================
   USUÁRIOS › Aprovações › Cadastros — quem pediu acesso.
   O militar se cadastrou pela tela pública; aqui o administrador
   ANALISA e CORRIGE antes de liberar. Por isso o clique não abre
   um resumo: abre o MESMO formulário do "Novo usuário", já
   preenchido com o que ele mandou — o administrador ajusta o que
   estiver errado e aprova, ou recusa com um motivo.
   A conta de acesso só nasce na aprovação.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var lista, aoMudar;

  function rpc(nome, corpo) {
    return RW.apiFetch('/rest/v1/rpc/' + nome, { metodo: 'POST', corpo: corpo || {} })
      .then(function (r) { return r.ok ? r.json() : null; });
  }

  /* o que o administrador precisa saber antes de decidir */
  function alerta(c) {
    if (c.ja_tem_conta) return RW.mensagens.cadastros.jaTemConta;
    if (c.ja_existe_pessoa) return RW.mensagens.cadastros.jaExiste;
    if (c.email_em_uso) return RW.mensagens.cadastros.emailEmUso;
    return '';
  }

  function carregar() {
    if (!lista || !document.contains(lista)) return Promise.resolve(0);
    return rpc('cadastros_listar')
      .then(function (itens) {
        itens = Array.isArray(itens) ? itens : [];
        renderizar(itens);
        return itens.length;
      })
      .catch(function () { return 0; });
  }

  function renderizar(itens) {
    lista.textContent = '';
    if (!itens.length) {
      var vazio = RosterWork.tpl('tpl-pedido-vazio');
      if (vazio) { vazio.textContent = RW.mensagens.cadastros.semCadastros; lista.appendChild(vazio); }
      return;
    }
    itens.forEach(function (c) {
      var cartao = RosterWork.tpl('tpl-cadastro-item');
      if (!cartao) return;
      cartao.querySelector('.cadastro-quem').textContent =
        ((c.grau_abreviacao || '') + ' ' + (c.nome_de_guerra || '')).trim();
      cartao.querySelector('.cadastro-meta').textContent =
        [c.lotacao_nome, RW.data.isoParaBR(c.criado_em)].filter(Boolean).join(' · ');
      var selo = cartao.querySelector('.cadastro-alerta');
      var texto = alerta(c);
      selo.textContent = texto;
      selo.classList.toggle('oculto', !texto);
      cartao.addEventListener('click', function () { revisar(c); });
      lista.appendChild(cartao);
    });
  }

  /* abre o pedido no painel: começa em Ver (leitura) e o Editar traz o
     formulário do Novo usuário preenchido, para o administrador corrigir */
  function revisar(c) {
    if (!RW.novoUsuario || !RW.novoUsuario.abrirPainel) return;
    RW.novoUsuario.abrirPainel({
      titulo: 'Revisar cadastro',
      dados: c,
      rotuloSalvar: 'Aprovar',
      rotuloRecusar: 'Recusar',
      aoVer: function (corpo) { montarLeitura(corpo, c); },
      aoSalvar: function (raiz) { aprovar(c, raiz); },
      aoRecusar: function () { recusar(c); }
    });
  }

  /* ---------- modo Ver: o pedido como o militar mandou ---------- */

  function secao(corpo, titulo, linhas) {
    var bloco = RW.painel.criarSecaoColapsavel(titulo, { aberta: true });
    if (!bloco) return;
    var alvo = bloco.querySelector('.painel-secao-corpo');
    linhas.forEach(function (l) {
      var linha = RW.painel.criarLinha(l[0], (l[1] == null || l[1] === '') ? '-' : l[1]);
      if (linha) alvo.appendChild(linha);
    });
    corpo.appendChild(bloco);
  }

  function montarLeitura(corpo, c) {
    var C = RW.campos, D = RW.data;

    /* o alerta vem primeiro: é o que muda a decisão */
    var texto = alerta(c);
    if (texto) {
      var caixa = RW.painel.criarCaixa(texto, true);
      if (caixa) corpo.appendChild(caixa);
    }

    secao(corpo, 'Dados pessoais', [
      ['Nome completo', c.nome_completo],
      ['CPF', C.mascararCpf(String(c.cpf || ''))],
      ['RG', C.mascararRg(String(c.rg || ''))],
      ['Nascimento', D.isoParaBR(c.data_nascimento)],
      ['CNH', c.cnh],
      ['Celular', C.mascararCelular(String(c.celular || ''))],
      ['E-mail', c.email]
    ]);

    secao(corpo, 'Dados institucionais', [
      ['Posto', c.grau_nome],
      ['Nome de guerra', c.nome_de_guerra],
      ['Setor', c.tipo],
      ['Inclusão', D.isoParaBR(c.data_de_inclusao)],
      ['Colocação', c.classificacao],
      ['Lotação', c.lotacao_nome],
      ['Pedido em', D.isoParaBR(c.criado_em)]
    ]);

    var promocoes = c.promocoes || [];
    if (!promocoes.length) return;
    secao(corpo, 'Datas de promoções', promocoes.map(function (iso, i) {
      return [String(i + 1) + 'ª', D.isoParaBR(iso)];
    }));
  }

  /* ---------- decisão ---------- */

  function campo(raiz, id) { var e = raiz.querySelector(id); return e ? (e.value || '').trim() : ''; }
  function selecao(raiz, id) { var e = raiz.querySelector(id); return e ? (e.getAttribute('data-valor') || '') : ''; }

  /* o que vai para o banco: no Editar, o que está no formulário; no Ver (sem
     formulário na tela), o pedido do jeito que o militar mandou */
  function paraEnviar(c, raiz) {
    var V = RW.validacoes;
    if (!raiz || !raiz.querySelector('#nu-nome-completo')) {
      return {
        p_id: c.id,
        p_nome_completo: c.nome_completo,
        p_rg: V.soDigitos(String(c.rg || '')),
        p_data_nascimento: c.data_nascimento,
        p_cnh: c.cnh,
        p_celular: V.soDigitos(String(c.celular || '')),
        p_email: (c.email || '').toLowerCase(),
        p_grau_hierarquico: c.grau_hierarquico,
        p_nome_de_guerra: c.nome_de_guerra,
        p_data_de_inclusao: c.data_de_inclusao,
        p_classificacao: c.classificacao,
        p_lotacao_atual: c.lotacao_atual,
        p_tipo: c.tipo,
        p_promocoes: c.promocoes || []
      };
    }

    var promocoes = [];
    var campos = raiz.querySelectorAll('#nu-promocoes .campo-entrada');
    for (var i = 0; i < campos.length; i++) {
      var iso = V.paraISO(campos[i].value);
      if (iso) promocoes.push(iso);
    }
    return {
      p_id: c.id,
      p_nome_completo: campo(raiz, '#nu-nome-completo'),
      p_rg: V.soDigitos(campo(raiz, '#nu-rg')),
      p_data_nascimento: V.paraISO(campo(raiz, '#nu-nascimento')),
      p_cnh: selecao(raiz, '#nu-cnh'),
      p_celular: V.soDigitos(campo(raiz, '#nu-celular')),
      p_email: campo(raiz, '#nu-email').toLowerCase(),
      p_grau_hierarquico: parseInt(selecao(raiz, '#nu-posto'), 10),
      p_nome_de_guerra: campo(raiz, '#nu-nome-guerra'),
      p_data_de_inclusao: V.paraISO(campo(raiz, '#nu-inclusao')),
      p_classificacao: campo(raiz, '#nu-colocacao'),
      p_lotacao_atual: parseInt(selecao(raiz, '#nu-lotacao'), 10),
      p_tipo: selecao(raiz, '#nu-setor'),
      p_promocoes: promocoes
    };
  }

  function aprovar(c, raiz) {
    var botao = raiz ? raiz.querySelector('#nu-salvar') : null;
    if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
    rpc('cadastro_aprovar', paraEnviar(c, raiz))
      .then(function (r) { concluir(r, botao); })
      .catch(function () { falhar(botao); });
  }

  function recusar(c) {
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.cadastros.confirmarRecusar,
      textoConfirmar: RW.mensagens.botoes.remover,
      textoCancelar: RW.mensagens.botoes.cancelar,
      aoConfirmar: function () {
        rpc('cadastro_recusar', { p_id: c.id, p_motivo: null })
          .then(function (r) { concluir(r, null); })
          .catch(function () { falhar(null); });
      }
    });
  }

  function concluir(r, botao) {
    if (RW.pararCarregando && botao) RW.pararCarregando(botao);
    if (r && r.success) {
      if (RW.novoUsuario.marcarLimpo) RW.novoUsuario.marcarLimpo();
      if (RW.painel) RW.painel.fechar();
      if (aoMudar) aoMudar();
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
      return;
    }
    RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.cadastros.falha });
  }

  function falhar(botao) {
    if (RW.pararCarregando && botao) RW.pararCarregando(botao);
    RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
  }

  function iniciar(conteudo, onMudou) {
    aoMudar = onMudou;
    lista = conteudo.querySelector('#usuarios-cadastros');
  }

  RW.usuariosCadastros = { iniciar: iniciar, carregar: carregar };
})();
