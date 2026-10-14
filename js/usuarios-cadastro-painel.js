/* ============================================================
   USUÁRIOS — o painel do cadastro de quem pediu acesso
   O militar se cadastrou pela tela pública; aqui o administrador
   ANALISA e CORRIGE antes de liberar. Por isso o pedido abre o
   MESMO formulário do "Novo usuário" (usuarios-novo-usuario.js),
   começando no Ver (o pedido como ele mandou) e com o Editar para
   corrigir; o rodapé é Recusar / Aprovar. Recusar pede o motivo
   (opcional) no próprio painel (geral-decisao).
   A conta de acesso só nasce na aprovação. Abre pela fila
   (geral-fila) da página Pendências e da aba Pendências da Usuários.
   Expõe: RosterWork.usuariosCadastroPainel.abrir(cadastro, ctx).
   ctx = { posicao?: { n, total }, aoMudar(), aoFechar() }
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ctxAtual = null;

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
      ['Quadro', c.quadro],
      ['Inclusão no quadro', D.isoParaBR(c.data_de_inclusao)],
      ['Posto', c.grau_nome],
      ['Nome de guerra', c.nome_de_guerra],
      ['Setor', c.tipo],
      [C.nomeColocacao(c.quadro), c.classificacao],
      ['Lotação', c.lotacao_nome],
      ['Pedido em', D.isoParaBR(c.criado_em)]
    ]);

    /* as promoções pelo grau (Sd., Cb.…), do posto pedido para baixo: o banco manda o grau de cada data */
    var promocoes = c.promocoes_graus || [];
    if (!promocoes.length) return;
    secao(corpo, 'Datas de promoções', promocoes.map(function (p) {
      return [p.grau, D.isoParaBR(p.data)];
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

  /* Recusar: a caixa do motivo (opcional) no fim do painel; Confirmar recusa grava */
  function recusar(c) {
    var partes = RW.decisao.montarRecusa(RW.painel.corpo());
    RW.decisao.recusar(partes, function (motivo, botao) {
      if (RW.iniciarCarregando) RW.iniciarCarregando(botao);
      rpc('cadastro_recusar', { p_id: c.id, p_motivo: motivo || null })
        .then(function (r) { concluir(r, botao); })
        .catch(function () { falhar(botao); });
    });
  }

  function concluir(r, botao) {
    if (RW.pararCarregando && botao) RW.pararCarregando(botao);
    if (r && r.success) {
      var ctx = ctxAtual;
      if (RW.novoUsuario.marcarLimpo) RW.novoUsuario.marcarLimpo();
      if (RW.painel) RW.painel.fechar();
      if (ctx && ctx.aoMudar) ctx.aoMudar();
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Usuários' });
      return;
    }
    RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.cadastros.falha });
  }

  function falhar(botao) {
    if (RW.pararCarregando && botao) RW.pararCarregando(botao);
    RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
  }

  /* abre o pedido no painel: começa em Ver (leitura) e o Editar traz o
     formulário do Novo usuário preenchido, para o administrador corrigir */
  function abrir(c, ctx) {
    if (!RW.novoUsuario || !RW.novoUsuario.abrirPainel) return;
    ctxAtual = ctx || {};
    var m = RW.mensagens.cadastros;
    RW.novoUsuario.abrirPainel({
      titulo: m.painelTitulo,
      tituloExtra: RW.mensagens.decisao.tituloPelotao(c.pelotoes),
      subtitulo: ctxAtual.posicao ? RW.mensagens.decisao.posicao(m.painelSituacao, ctxAtual.posicao.n, ctxAtual.posicao.total) : m.painelSituacao,
      dados: c,
      rotuloSalvar: m.botaoAprovar,
      rotuloRecusar: m.botaoRecusar,
      aoVer: function (corpo) { montarLeitura(corpo, c); },
      aoSalvar: function (raiz) { aprovar(c, raiz); },
      aoRecusar: function () { recusar(c); },
      aoFechar: function () { if (ctxAtual && ctxAtual.aoFechar) ctxAtual.aoFechar(); }
    });
  }

  RW.usuariosCadastroPainel = { abrir: abrir };
})();
