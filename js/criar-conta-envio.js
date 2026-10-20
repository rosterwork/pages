/* ============================================================
   CRIAR CONTA › regras dos campos, validação e envio.

   A regra de cada campo mora num lugar só (o mapa REGRAS) e é
   usada duas vezes: ao SAIR do campo (o erro aparece perto de
   onde foi cometido) e no ENVIO (que ainda cobra os obrigatórios).
   Sem isso a mesma regra ficaria escrita em dois lugares e um dia
   sairiam diferentes.

   O banco valida tudo de novo: aqui é conveniência, lá é a regra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var C = RW.campos, V = RW.validacoes;

  var rpc = null;

  function el(id) { return document.getElementById(id); }
  function valor(id) { return (el(id).value || '').trim(); }
  function selecao(id) { return el(id).getAttribute('data-valor') || ''; }
  function T() { return RW.mensagens.cadastro; }

  /* a data de nascimento é referência para a inclusão */
  function nascimento() { return V.parseData(valor('cc-nascimento')); }

  /* ---------- as regras ----------
     `vazio`   — mensagem quando o campo é obrigatório e está em branco (só no envio)
     `formato` — confere o que foi digitado; roda também ao sair do campo */
  var REGRAS = {
    'cc-nome-completo': {
      vazio: function () { return T().nomeVazio; },
      formato: function (v) { return v.split(/\s+/).length < 2 ? T().nomeIncompleto : null; }
    },
    'cc-cpf': {
      vazio: function () { return T().cpfVazio; },
      formato: function (v) { return V.validarCpf(v) ? null : T().cpfInvalido; }
    },
    'cc-rg': {
      vazio: function () { return T().rgVazio; },
      formato: function (v) {
        if (V.validarRg(v, valor('cc-cpf'))) return null;
        return V.soDigitos(v).length === 11 ? T().rgDiferenteCpf : T().rgInvalido;
      }
    },
    'cc-nascimento': {
      vazio: function () { return T().nascimentoVazio; },
      formato: function (v) {
        var d = V.parseData(v);
        if (!d) return T().dataInvalida;
        return V.idadeEm(d) < 18 ? T().idadeMinima : null;
      }
    },
    'cc-celular': {
      vazio: function () { return T().celularVazio; },
      formato: function (v) { return V.soDigitos(v).length !== 11 ? T().celularInvalido : null; }
    },
    'cc-email': {
      vazio: function () { return T().emailVazio; },
      formato: function (v) { return V.validarEmail(v) ? null : T().emailInvalido; }
    },
    'cc-nome-guerra': {
      vazio: function () { return T().guerraVazio; }
    },
    'cc-inclusao': {
      vazio: function () { return T().inclusaoVazia; },
      formato: function (v) {
        var d = V.parseData(v);
        if (!d) return T().dataInvalida;
        var nasc = nascimento();
        if (nasc && d <= nasc) return T().inclusaoAposNascimento;
        return C.grauValeNaInclusao(RW.criarConta.nomeDoPosto(), d) ? null : T().inclusaoSd3;
      }
    },
    /* quem a ficha trouxe sem colocação pode deixar em branco (o banco ignora o vazio) */
    'cc-colocacao': {
      vazio: function () { return RW.criarConta.contexto().semColocacao ? null : T().colocacaoVazia; }
    },
    'cc-senha': {
      vazio: function () { return RW.mensagens.perfil.senhaCurta; },
      formato: function (v) { return v.length < 6 ? RW.mensagens.perfil.senhaCurta : null; }
    },
    'cc-senha-confirma': {
      vazio: function () { return RW.mensagens.perfil.senhaNaoConfere; },
      formato: function (v) { return v !== el('cc-senha').value ? RW.mensagens.perfil.senhaNaoConfere : null; }
    }
  };

  /* os de escolha: não têm o que conferir de formato, só se foram escolhidos */
  var ESCOLHAS = {
    'cc-cnh': function () { return T().cnhVazia; },
    'cc-tipo': function () { return T().tipoVazio; },
    'cc-posto': function () { return T().postoVazio; },
    'cc-setor': function () { return T().setorVazio; },
    'cc-lotacao': function () { return T().lotacaoVazia; }
  };

  /* ---------- ao sair do campo ---------- */
  function ligarValidacoes() {
    Object.keys(REGRAS).forEach(function (id) {
      var regra = REGRAS[id];
      if (!regra.formato) return;   /* só cobra "vazio" — e isso é no envio */
      C.ligarValidacao(el(id), regra.formato);
    });
    /* mexer na senha revalida a confirmação — senão ela fica vermelha à toa
       depois que a pessoa corrige a de cima */
    el('cc-senha').addEventListener('blur', function () {
      var conf = el('cc-senha-confirma');
      if (!conf.value.trim()) return;
      var erro = REGRAS['cc-senha-confirma'].formato(conf.value.trim());
      if (erro) C.marcarErro(conf, erro); else C.limparErro(conf);
    });
  }

  /* leva a tela até o primeiro campo vermelho — o erro não pode ficar escondido */
  function mostrarPrimeiroErro() {
    var campo = document.querySelector('.campo--erro');
    if (campo && campo.scrollIntoView) campo.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ---------- o envio: cobra tudo de novo ----------
     valida os campos e devolve se está tudo certo */
  function validarCampos() {
    C.limparErros(el('cc-corpo'));
    var ok = true;
    function erro(elemento, msg) { C.marcarErro(elemento, msg); ok = false; }

    Object.keys(REGRAS).forEach(function (id) {
      var regra = REGRAS[id];
      var v = valor(id);
      if (!v) { var msgVazio = regra.vazio(); if (msgVazio) erro(el(id), msgVazio); return; }
      if (regra.formato) {
        var msg = regra.formato(v);
        if (msg) erro(el(id), msg);
      }
    });

    Object.keys(ESCOLHAS).forEach(function (id) {
      if (!selecao(id)) erro(el(id), ESCOLHAS[id]());
    });

    /* as datas de promoção: a gravada não volta a ficar em branco; todas válidas, em ordem e nenhuma antes da inclusão */
    camposDeData().forEach(function (input) {
      if (input.hasAttribute('data-gravada') && !input.value.trim()) erro(input, T().promocaoVazia);
    });
    if (!C.conferirPromocoes(camposDeData(), V.parseData(valor('cc-inclusao')), el('cc-inclusao'))) ok = false;

    /* a ciência dos termos é obrigatória */
    if (el('cc-termos').getAttribute('aria-checked') !== 'true') erro(el('cc-termos'), RW.mensagens.termos.obrigatorio);

    return ok;
  }

  /* os campos de data de promoção, do posto mais baixo ao mais alto (os de praça primeiro) */
  function camposDeData() {
    var praca = Array.prototype.slice.call(document.querySelectorAll('#cc-promocoes-praca .campo-entrada'));
    return praca.concat(Array.prototype.slice.call(document.querySelectorAll('#cc-promocoes .campo-entrada')));
  }

  /* deixa a colocação no mesmo formato guardado (4 dígitos, zeros à esquerda),
     senão o banco lê como alteração e pede aprovação à toa */
  function colocacaoNormalizada() {
    var v = valor('cc-colocacao');
    if (!v) return '';
    return v.length >= 4 ? v : ('0000' + v).slice(-4);
  }

  /* os campos que a pessoa pode ter corrigido. O banco compara com o valor atual
     e só manda para aprovação o que mudou; e-mail, celular e senha vão fora
     daqui, valem na hora. As datas de promoção vão as preenchidas (promocao_<grau_id>);
     a gravada que não mudou o banco deixa de fora. */
  function montarCorrecoes() {
    var datas = camposDeData().filter(function (input) { return input.value.trim(); })
      .map(function (input) { return { campo: 'promocao_' + input.getAttribute('data-grau'), valor: V.paraISO(input.value.trim()) }; });
    return [
      { campo: 'nome_completo', valor: valor('cc-nome-completo') },
      { campo: 'rg', valor: V.soDigitos(valor('cc-rg')) },
      { campo: 'data_de_nascimento', valor: V.paraISO(valor('cc-nascimento')) },
      { campo: 'cnh', valor: selecao('cc-cnh') },
      { campo: 'nome_de_guerra', valor: valor('cc-nome-guerra') },
      { campo: 'tipo', valor: selecao('cc-setor') },
      { campo: 'data_de_inclusao', valor: V.paraISO(valor('cc-inclusao')) },
      { campo: 'classificacao_cfo_cfp', valor: colocacaoNormalizada() }
    ].concat(datas);
  }

  function irParaLogin() { window.location.href = 'login.html'; }

  /* cria a conta pelo link (acesso_link_criar_conta) */
  function enviar() {
    var botao = el('cc-enviar');
    if (!validarCampos()) {
      mostrarPrimeiroErro();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir });
      return;
    }
    var ctx = RW.criarConta.contexto();
    RW.iniciarCarregando(botao);
    rpc('acesso_link_criar_conta', {
      p_codigo: ctx.codigo,
      p_cpf: ctx.cpf,
      p_email: valor('cc-email').toLowerCase(),
      p_celular: V.soDigitos(valor('cc-celular')),
      p_senha: el('cc-senha').value,
      p_correcoes: montarCorrecoes(),
      p_termos_ciente: true
    })
      .then(function (r) {
        RW.pararCarregando(botao);
        if (r && r.success) {
          /* a conta nasceu: o formulário deixa de ter alterações a proteger,
             senão o guarda de saída barra a ida ao login */
          if (RW.criarConta && RW.criarConta.marcarEnviado) RW.criarConta.marcarEnviado();
          var msg = (r.correcoes_pendentes > 0)
            ? RW.mensagens.criarConta.contaCriadaComCorrecoes
            : RW.mensagens.criarConta.contaCriada;
          RW.avisar({ tipo: 'sucesso', mensagem: msg, aoConfirmar: irParaLogin });
          return;
        }
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.criarConta.falha });
      })
      .catch(function () {
        RW.pararCarregando(botao);
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
  }

  /* ---------- ciência dos termos ----------
     a caixinha marca e desmarca (também pelo texto); "Ler os termos" abre a página
     em outra aba, para o formulário preenchido não se perder */
  function ligarTermos() {
    var caixa = el('cc-termos');
    function alternar() {
      var marcada = caixa.getAttribute('aria-checked') !== 'true';
      caixa.setAttribute('aria-checked', marcada ? 'true' : 'false');
      caixa.classList.toggle('caixa-selecao--marcada', marcada);
      if (marcada) C.limparErro(caixa);
    }
    caixa.addEventListener('click', alternar);
    el('cc-termos-rotulo').addEventListener('click', alternar);
    el('cc-termos-ler').addEventListener('click', function () { window.open('termos.html', '_blank', 'noopener'); });
  }

  function ligar(fnRpc) {
    rpc = fnRpc;
    ligarValidacoes();
    ligarTermos();
    var botao = el('cc-enviar');
    if (botao) botao.addEventListener('click', enviar);
  }

  RW.criarContaEnvio = { ligar: ligar };
})();
