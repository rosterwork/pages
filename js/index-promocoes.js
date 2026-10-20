/* ============================================================
   DATAS DE PROMOÇÃO — janela ao entrar (shell)
   Uma vez por login, para a praça com data de promoção faltando
   (promocoes_pendentes: o banco decide quem vê e traz os postos,
   do primeiro, que vale pela data de inclusão, ao atual). Abre
   depois da janela dos termos, que tem a vez. Os campos ficam na
   própria janela (exceção à regra do modal, como o Fale conosco):
   "Salvar" habilita quando algo muda e manda as alterações para a
   aprovação (perfil_solicitar, o mesmo caminho do Meus dados);
   com tudo preenchido a janela fecha, senão continua aberta.
   "Preencher depois" desfaz o que não foi salvo e fecha.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var campos = [];   /* [{ el, campo, original }] — um por posto, do primeiro ao atual */
  var veu, salvar;

  function C() { return RosterWork.campos; }
  function V() { return RosterWork.validacoes; }

  /* "uma vez por login": a marca fica no rosterwork_user, que o login grava de novo a cada entrada */
  function jaLembrado() {
    try { return !!JSON.parse(sessionStorage.getItem('rosterwork_user')).promocoesLembradas; } catch (e) { return true; }
  }

  function marcarLembrado() {
    try {
      var usuario = JSON.parse(sessionStorage.getItem('rosterwork_user'));
      usuario.promocoesLembradas = true;
      sessionStorage.setItem('rosterwork_user', JSON.stringify(usuario));
    } catch (e) {}
  }

  function alterados() {
    return campos.filter(function (c) { return c.el.value.trim() !== c.original; });
  }

  function revisar() {
    if (salvar) salvar.disabled = !alterados().length;
  }

  /* um campo por posto, já com a data gravada (ou a enviada e esperando a aprovação) */
  function montar(postos) {
    var lista = document.getElementById('promocoes-lembrete-campos');
    if (!lista) return;
    lista.textContent = '';
    campos = [];
    postos.forEach(function (p) {
      var campo = RosterWork.tpl('tpl-nu-promocao');
      if (!campo) return;
      campo.querySelector('.campo-rotulo').textContent = p.grau_nome;
      var controle = { el: campo.querySelector('.campo-entrada'), campo: p.campo, original: RosterWork.data.isoParaBR(p.data) };
      controle.el.value = controle.original;
      C().ligarData(controle.el);
      controle.el.addEventListener('input', function () { C().limparErro(controle.el); revisar(); });
      lista.appendChild(campo);
      campos.push(controle);
    });
    revisar();
  }

  /* volta ao que está gravado (ou já foi enviado) */
  function restaurar() {
    C().limparErros(veu);
    campos.forEach(function (c) { c.el.value = c.original; });
    revisar();
  }

  function campoDaInclusao() {
    return campos.filter(function (c) { return c.campo === 'data_de_inclusao'; })[0] || null;
  }

  /* data válida e não futura; a preenchida não volta a ficar em branco; as promoções em ordem,
     do posto mais baixo ao mais alto, e nenhuma antes da inclusão (o erro dela fica no primeiro posto) */
  function conferir() {
    var T = RosterWork.mensagens.cadastro, ok = true;
    C().limparErros(veu);
    campos.forEach(function (c) {
      var valor = c.el.value.trim();
      if (!valor) {
        if (c.original) { C().marcarErro(c.el, c.campo === 'data_de_inclusao' ? T.inclusaoVazia : T.promocaoVazia); ok = false; }
        return;
      }
      var data = V().parseData(valor);
      if (!data) { C().marcarErro(c.el, T.dataInvalida); ok = false; return; }
      if (data > new Date()) { C().marcarErro(c.el, RosterWork.mensagens.perfil.dataFutura); ok = false; }
    });
    if (!ok) return false;
    var inclusao = campoDaInclusao();
    var promocoes = campos.filter(function (c) { return c !== inclusao; }).map(function (c) { return c.el; });
    return C().conferirPromocoes(promocoes, inclusao ? V().parseData(inclusao.el.value) : null, inclusao ? inclusao.el : null);
  }

  function enviar() {
    if (!conferir()) return;
    var mudou = alterados().map(function (c) { return { campo: c.campo, valor: V().paraISO(c.el.value.trim()) }; });
    if (!mudou.length) return;
    var M = RosterWork.mensagens;
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(salvar);
    RosterWork.rpc('perfil_solicitar', { p_alteracoes: mudou })
      .then(function (r) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(salvar);
        if (r && r.success) {
          /* o enviado passa a ser o "gravado" da janela; com tudo preenchido ela fecha */
          campos.forEach(function (c) { c.original = c.el.value.trim(); });
          revisar();
          if (campos.every(function (c) { return c.original; }) && RosterWork.fecharModais) RosterWork.fecharModais();
          RosterWork.avisar({ tipo: 'sucesso', mensagem: M.perfil.solicitacaoEnviada });
          return;
        }
        /* o banco recusou: o conflito com a inclusão fica no campo do primeiro posto */
        var erro = (r && r.error) || M.perfil.falhaDados;
        var inclusao = campoDaInclusao();
        if (/[Ii]nclusão/.test(erro) && inclusao) C().marcarErro(inclusao.el, erro);
        else RosterWork.avisar({ tipo: 'erro', mensagem: erro });
      })
      .catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(salvar);
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* abre com o foco no primeiro posto sem data */
  function abrir(postos) {
    montar(postos);
    var vazio = campos.filter(function (c) { return !c.original; })[0];
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-promocoes', vazio ? vazio.el : null);
  }

  function inicializar() {
    veu = document.getElementById('veu-promocoes');
    salvar = document.getElementById('promocoes-lembrete-salvar');
    var depois = document.getElementById('promocoes-lembrete-depois');
    if (!veu || !salvar || !depois) return;
    depois.addEventListener('click', function () {
      restaurar();
      if (RosterWork.fecharModais) RosterWork.fecharModais();
    });
    salvar.addEventListener('click', enviar);

    /* o navegador avisa se fechar com datas digitadas e não salvas */
    if (RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(function () {
        return veu.classList.contains('modal-veu--aberto') && alterados().length > 0;
      });
    }

    if (jaLembrado() || !RosterWork.rpc) return;
    var vez = RosterWork.termos ? RosterWork.termos.liberado : Promise.resolve();
    Promise.all([RosterWork.rpc('promocoes_pendentes').catch(function () { return null; }), vez])
      .then(function (resultado) {
        var r = resultado[0];
        if (!r || !r.success) return;   // falhou: tenta de novo no próximo carregamento
        marcarLembrado();
        if (r.pendente) abrir(r.postos || []);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
