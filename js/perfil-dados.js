/* ============================================================
   MEU PERFIL — aba "Meus dados": UM formulário com todos os campos
   corrigíveis. O militar altera quantos quiser e envia um pedido só
   (perfil_solicitar recebe a lista); quem aplica é o administrador.
   Abaixo, "Minhas solicitações", agrupadas por pedido.

   Usa os componentes de formulário do site (RosterWork.campos e
   RosterWork.validacoes): máscaras, calendário nas datas,
   capitalização do nome, campo de seleção e o erro em vermelho
   embaixo do campo. O campo alterado fica em destaque, como as
   Cotas da Extrajornada.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var campos = [];      /* [{ el, campo, formato }] — montado a cada abertura */
  var originais = {};   /* campo -> valor gravado (como aparece no controle) */
  var enviar, desfazer, contagem, lista, formulario;
  var reqMinhas = 0;    /* token de "Minhas solicitações": ignora resposta antiga ao reentrar */

  function C() { return RosterWork.campos; }
  function V() { return RosterWork.validacoes; }


  /* lê o valor do controle (campo de texto ou seletor) */
  function ler(controle) {
    return controle.el.tagName === 'INPUT'
      ? controle.el.value.trim()
      : (controle.el.getAttribute('data-valor') || '');
  }

  /* escreve no controle; no seletor, também no texto visível */
  function escrever(controle, valor) {
    valor = valor || '';
    if (controle.el.tagName === 'INPUT') { controle.el.value = valor; return; }
    C().definirSelecao(controle.el, valor);
  }

  /* só os campos que diferem do que está gravado viram itens do pedido */
  function alterados() {
    var mudou = [];
    for (var i = 0; i < campos.length; i++) {
      if (ler(campos[i]) !== originais[campos[i].campo]) mudou.push(campos[i]);
    }
    return mudou;
  }

  /* o campo alterado fica destacado (mesmo padrão das Cotas da Extrajornada) */
  function destacar() {
    for (var i = 0; i < campos.length; i++) {
      var caixa = campos[i].el.closest('.campo');
      if (caixa) caixa.classList.toggle('campo--alterado', ler(campos[i]) !== originais[campos[i].campo]);
    }
  }

  function revisar() {
    var mudou = alterados();
    destacar();
    if (enviar) enviar.disabled = !mudou.length;
    if (desfazer) desfazer.disabled = !mudou.length;
    if (contagem) {
      contagem.textContent = !mudou.length ? '' : RosterWork.mensagens.perfil.aEnviar(mudou.length);
    }
  }

  /* volta o formulário ao que está gravado no banco */
  function restaurar() {
    C().limparErros(formulario);
    for (var i = 0; i < campos.length; i++) escrever(campos[i], originais[campos[i].campo]);
    revisar();
  }

  function ligarControle(controle) {
    if (controle.el.tagName !== 'INPUT') {
      C().ligarSelecao(controle.el, function () { revisar(); });
      return;
    }
    /* máscara/comportamento padrão conforme o formato declarado no HTML */
    if (controle.formato === 'data') C().ligarData(controle.el);
    else if (controle.formato === 'celular') C().ligarMascara(controle.el, C().mascararCelular);
    else if (controle.formato === 'rg') C().ligarMascara(controle.el, C().mascararRg);
    else if (controle.formato === 'numero') C().ligarMascara(controle.el, function (d) { return d; });
    else if (controle.formato === 'guerra') C().ligarNomeDeGuerra(controle.el);
    else if (controle.formato === 'nome') C().ligarNome(controle.el);
    /* sem formato declarado (e-mail): o texto entra como foi digitado */

    controle.el.addEventListener('input', function () {
      var caixa = controle.el.closest('.campo');
      if (caixa && caixa.classList.contains('campo--erro')) {
        caixa.classList.remove('campo--erro');
        var msg = caixa.querySelector('.campo-erro-texto');
        if (msg) msg.textContent = '';
      }
      revisar();
    });
  }

  /* confere o formulário INTEIRO (não só o que mudou): campo obrigatório vazio
     e formato. Marca o erro embaixo de cada campo, como o Novo usuário.
     Devolve as alterações prontas, ou null quando há erro. */
  function montarAlteracoes() {
    C().limparErros(formulario);
    var T = RosterWork.mensagens.cadastro;
    var alteracoes = [];
    var ok = true;
    var nascimento = null;

    /* o nascimento é lido antes, porque a inclusão precisa dele */
    campos.forEach(function (c) {
      if (c.campo === 'data_de_nascimento') nascimento = V().parseData(ler(c));
    });

    campos.forEach(function (controle) {
      var valor = ler(controle);
      var vazio = valor === '';

      /* nenhum campo pode ficar em branco — vale para o formulário todo, mudado
         ou não (quem não tem carteira escolhe "Nenhuma" na CNH) */
      if (vazio) {
        C().marcarErro(controle.el, {
          nome_completo: T.nomeVazio, rg: T.rgVazio, data_de_nascimento: T.nascimentoVazio,
          celular: T.celularVazio, cnh: T.cnhVazia,
          email: T.emailVazio, nome_de_guerra: T.guerraVazio, tipo: T.setorVazio,
          data_de_inclusao: T.inclusaoVazia, classificacao_cfo_cfp: T.colocacaoVazia
        }[controle.campo] || T.nomeVazio);
        ok = false;
        return;
      }

      /* formato, só de quem está preenchido */
      if (controle.formato === 'data') {
        var data = V().parseData(valor);
        if (!data) { C().marcarErro(controle.el, T.dataInvalida); ok = false; return; }
        if (data > new Date()) { C().marcarErro(controle.el, RosterWork.mensagens.perfil.dataFutura); ok = false; return; }
        if (controle.campo === 'data_de_nascimento' && V().idadeEm(data) < 18) {
          C().marcarErro(controle.el, T.idadeMinima); ok = false; return;
        }
        if (controle.campo === 'data_de_inclusao' && nascimento && data <= nascimento) {
          C().marcarErro(controle.el, T.inclusaoAposNascimento); ok = false; return;
        }
      } else if (controle.formato === 'celular') {
        if (V().soDigitos(valor).length !== 11) { C().marcarErro(controle.el, T.celularInvalido); ok = false; return; }
      } else if (controle.formato === 'rg') {
        if (!V().validarRg(valor)) { C().marcarErro(controle.el, T.rgInvalido); ok = false; return; }
      } else if (controle.campo === 'email') {
        if (!V().validarEmail(valor)) { C().marcarErro(controle.el, T.emailInvalido); ok = false; return; }
      } else if (controle.campo === 'nome_completo' && valor.trim().split(/\s+/).length < 2) {
        C().marcarErro(controle.el, T.nomeIncompleto); ok = false; return;
      }

      /* passou: se mudou, vira item do pedido (já no formato que o banco espera) */
      if (valor === originais[controle.campo]) return;
      if (controle.formato === 'data') valor = V().paraISO(valor);
      else if (controle.formato === 'celular' || controle.formato === 'rg') valor = V().soDigitos(valor);
      alteracoes.push({ campo: controle.campo, valor: valor });
    });

    return ok ? alteracoes : null;
  }

  /* leva o primeiro campo com erro para a tela — senão o vermelho fica fora da vista */
  function mostrarPrimeiroErro() {
    var campo = formulario.querySelector('.campo--erro');
    if (!campo) return;
    campo.scrollIntoView({ block: 'center' });
    var entrada = campo.querySelector('.campo-entrada');
    if (entrada) entrada.focus();
  }

  /* envia TODAS as alterações num pedido só */
  function enviarPedido() {
    var alteracoes = montarAlteracoes();
    var M = RosterWork.mensagens.perfil;
    if (!alteracoes) {
      /* os erros estão nos campos; o modal chama a atenção, como no Novo usuário */
      mostrarPrimeiroErro();
      RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.camposCorrigir });
      return;
    }
    if (!alteracoes.length) return;

    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(enviar);
    RosterWork.apiFetch('/rest/v1/rpc/perfil_solicitar', { metodo: 'POST', corpo: { p_alteracoes: alteracoes } })
      .then(function (resposta) { return resposta.ok ? resposta.json() : { _falha: true }; })
      .then(function (retorno) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(enviar);
        if (retorno && retorno.success) {
          restaurar();      /* o pedido está pendente: o formulário volta ao que está gravado */
          carregarMinhas();
          RosterWork.avisar({ tipo: 'sucesso', mensagem: M.solicitacaoEnviada });
          return;
        }
        /* o banco recusou: mostra no campo quando dá para saber qual é */
        var erro = (retorno && retorno.error) || M.falhaDados;
        var alvo = null;
        if (/[Nn]ome de guerra/.test(erro)) alvo = formulario.querySelector('[data-campo="nome_de_guerra"]');
        else if (/E-mail/.test(erro)) alvo = formulario.querySelector('[data-campo="email"]');
        else if (/RG/.test(erro)) alvo = formulario.querySelector('[data-campo="rg"]');
        else if (/Celular/.test(erro)) alvo = formulario.querySelector('[data-campo="celular"]');
        else if (/CNH/.test(erro)) alvo = formulario.querySelector('[data-campo="cnh"]');
        if (alvo) {
          C().marcarErro(alvo, erro);
          mostrarPrimeiroErro();
          RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.camposCorrigir });
        } else {
          RosterWork.avisar({ tipo: 'erro', mensagem: erro });
        }
      })
      .catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(enviar);
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* ---------- minhas solicitações (agrupadas por pedido) ---------- */
  /* falha na leitura: mostra erro, NÃO finge "nada pendente" (senão o militar reenvia duplicado) */
  function mostrarErroMinhas() {
    if (!lista) return;
    lista.textContent = '';
    var erro = RosterWork.tpl('tpl-pedido-vazio');
    if (erro) { erro.textContent = RosterWork.mensagens.geral.falhaCarregar; lista.appendChild(erro); }
  }
  function carregarMinhas() {
    if (!lista) return;
    var req = ++reqMinhas;
    RosterWork.apiFetch('/rest/v1/rpc/perfil_solicitacoes_minhas', { metodo: 'POST', corpo: {} })
      .then(function (resposta) { if (!resposta.ok) return null; return resposta.json(); })
      .then(function (pedidos) {
        if (req !== reqMinhas) return;   // resposta obsoleta (reentrou na página)
        if (!Array.isArray(pedidos)) { mostrarErroMinhas(); return; }
        renderMinhas(pedidos);
      })
      .catch(function () { if (req === reqMinhas) mostrarErroMinhas(); });
  }

  function seloDoStatus(status) {
    return status === 'aprovada' ? 'selo--sucesso' : (status === 'recusada' ? 'selo--erro' : 'selo--alerta');
  }

  function textoDoStatus(status) {
    return status === 'aprovada' ? 'Aprovada' : (status === 'recusada' ? 'Recusada' : 'Pendente');
  }

  /* faixa "N alterações aguardando…" — nas duas abas (Perfil e Meus dados),
     para o militar ver o que está em aberto de qualquer lado da página */
  function marcarAguardando(pedidos) {
    var pendentes = 0;
    pedidos.forEach(function (pedido) {
      (pedido.itens || []).forEach(function (item) {
        if (item.status === 'pendente') pendentes++;
      });
    });
    var faixas = document.querySelectorAll('[data-perfil-aguardando]');
    for (var i = 0; i < faixas.length; i++) {
      faixas[i].classList.toggle('oculto', pendentes === 0);
      var texto = faixas[i].querySelector('[data-perfil-aguardando-texto]');
      if (texto && pendentes) texto.textContent = RosterWork.mensagens.perfil.aguardando(pendentes);
    }
  }

  function renderMinhas(pedidos) {
    marcarAguardando(pedidos);
    lista.textContent = '';
    if (!pedidos.length) {
      var vazio = RosterWork.tpl('tpl-pedido-vazio');
      if (vazio) { vazio.textContent = RosterWork.mensagens.perfil.semMinhas; lista.appendChild(vazio); }
      return;
    }
    pedidos.forEach(function (pedido) {
      var cartao = RosterWork.tpl('tpl-perfil-meu-pedido');
      if (!cartao) return;
      var itens = pedido.itens || [];
      cartao.querySelector('.pedido-quem').textContent = RosterWork.mensagens.perfil.qtdAlteracoes(itens.length);
      cartao.querySelector('.pedido-meta').textContent = RosterWork.mensagens.perfil.enviadaEm(RosterWork.data.isoParaBR(pedido.solicitado_em));
      var corpo = cartao.querySelector('.pedido-itens');
      itens.forEach(function (item) {
        var linha = RosterWork.tpl('tpl-perfil-meu-item');
        if (!linha) return;
        linha.querySelector('.pedido-item-rotulo').textContent = item.rotulo;
        linha.querySelector('.pedido-item-de').textContent = item.valor_atual || '-';
        linha.querySelector('.pedido-item-para').textContent = item.valor_novo || '-';
        var selo = linha.querySelector('.pedido-item-status');
        selo.textContent = textoDoStatus(item.status);
        selo.classList.add(seloDoStatus(item.status));
        corpo.appendChild(linha);
      });
      lista.appendChild(cartao);
    });
  }

  /* monta o formulário com o que está gravado (a ficha vem de quem chamou) */
  function iniciar(ficha) {
    var pessoais = (ficha && ficha.pessoais) || {};
    var institucionais = (ficha && ficha.institucionais) || {};

    enviar = document.getElementById('perfil-enviar');
    desfazer = document.getElementById('perfil-desfazer');
    contagem = document.getElementById('perfil-contagem');
    lista = document.getElementById('perfil-minhas');
    formulario = document.querySelector('[data-aba-painel="dados"]');
    if (!formulario || !RosterWork.campos) return;

    var gravado = {
      nome_completo: pessoais.nome_completo || '',
      rg: C().mascararRg(V().soDigitos(pessoais.rg)),
      data_de_nascimento: RosterWork.data.isoParaBR(pessoais.data_de_nascimento),
      celular: C().mascararCelular(V().soDigitos(pessoais.celular)),
      email: pessoais.email || '',
      cnh: pessoais.cnh || '',
      nome_de_guerra: institucionais.nome_de_guerra || '',
      tipo: institucionais.tipo || '',
      data_de_inclusao: RosterWork.data.isoParaBR(institucionais.data_de_inclusao),
      classificacao_cfo_cfp: institucionais.classificacao || ''
    };

    campos = [];
    originais = {};
    var controles = formulario.querySelectorAll('[data-campo]');
    for (var i = 0; i < controles.length; i++) {
      var controle = {
        el: controles[i],
        campo: controles[i].getAttribute('data-campo'),
        formato: controles[i].getAttribute('data-formato') || ''
      };
      campos.push(controle);
      originais[controle.campo] = gravado[controle.campo] || '';
      escrever(controle, originais[controle.campo]);
      ligarControle(controle);
    }

    if (desfazer) desfazer.addEventListener('click', restaurar);
    if (enviar) enviar.addEventListener('click', enviarPedido);
    revisar();
    carregarMinhas();
  }

  /* o navegador avisa se sair com correções digitadas e não enviadas
     (só enquanto o formulário está mesmo na tela) */
  if (RosterWork.guardaSaida) {
    RosterWork.guardaSaida.registrar(function () {
      return campos.length > 0 && document.body.contains(campos[0].el) && alterados().length > 0;
    });
  }

  RosterWork.perfilDados = { iniciar: iniciar };
})();
