/* ============================================================
   DADOS PENDENTES — janela ao entrar (shell)
   Uma vez por login, quando falta algo no cadastro de quem entrou
   (dados_pendentes: o banco decide o que pedir). Para todos, a CNH
   em "Nenhuma" ainda não confirmada; para a praça, a colocação no
   CFP e as datas de promoção (do primeiro posto, que vale pela data
   de inclusão, ao atual). Abre depois da janela dos termos, que tem
   a vez. Os campos ficam na própria janela (exceção à regra do
   modal, como o Fale conosco): "Salvar" habilita quando algo muda e
   manda as alterações por perfil_solicitar (o mesmo caminho do Meus
   dados: vão para a aprovação; "Não tenho CNH" só confirma). Com
   tudo preenchido a janela fecha, senão continua aberta. "Preencher
   depois" desfaz o que não foi salvo e fecha.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var campos = [];   /* [{ el, campo, tipo, original }]: a CNH, a colocação e um por posto */
  var veu, salvar;

  function C() { return RosterWork.campos; }
  function V() { return RosterWork.validacoes; }

  /* "uma vez por login": a marca fica no rosterwork_user, que o login grava de novo a cada entrada */
  function jaLembrado() {
    try { return !!JSON.parse(sessionStorage.getItem('rosterwork_user')).dadosPendentesLembrados; } catch (e) { return true; }
  }

  function marcarLembrado() {
    try {
      var usuario = JSON.parse(sessionStorage.getItem('rosterwork_user'));
      usuario.dadosPendentesLembrados = true;
      sessionStorage.setItem('rosterwork_user', JSON.stringify(usuario));
    } catch (e) {}
  }

  /* a CNH é um seletor (o valor fica em data-valor); a colocação e as datas, campos de texto */
  function ler(c) { return c.tipo === 'cnh' ? (c.el.getAttribute('data-valor') || '') : c.el.value.trim(); }
  function escrever(c, valor) {
    if (c.tipo === 'cnh') C().definirSelecao(c.el, valor);
    else c.el.value = valor;
  }

  function alterados() {
    return campos.filter(function (c) { return ler(c) !== c.original; });
  }

  function revisar() {
    if (salvar) salvar.disabled = !alterados().length;
  }

  function adicionar(c, original) {
    c.original = original || '';
    escrever(c, c.original);
    campos.push(c);
  }

  /* mostra só o que veio do banco: cada item com o valor gravado ou o enviado e esperando a aprovação */
  function montar(r) {
    campos = [];
    C().limparErros(veu);
    var cnh = document.getElementById('dados-pendentes-cnh-campo');
    cnh.classList.toggle('oculto', !r.cnh);
    if (r.cnh) adicionar({ el: document.getElementById('dados-pendentes-cnh'), campo: 'cnh', tipo: 'cnh' }, r.cnh.valor);
    var colocacao = document.getElementById('dados-pendentes-colocacao-campo');
    colocacao.classList.toggle('oculto', !r.colocacao);
    if (r.colocacao) adicionar({ el: document.getElementById('dados-pendentes-colocacao'), campo: 'classificacao_cfo_cfp', tipo: 'colocacao' }, r.colocacao.valor);

    var lista = document.getElementById('dados-pendentes-postos');
    lista.textContent = '';
    (r.postos || []).forEach(function (p) {
      var campo = RosterWork.tpl('tpl-nu-promocao');
      if (!campo) return;
      campo.querySelector('.campo-rotulo').textContent = p.grau_nome;
      var controle = { el: campo.querySelector('.campo-entrada'), campo: p.campo, tipo: 'data' };
      adicionar(controle, RosterWork.data.isoParaBR(p.data));
      C().ligarData(controle.el);
      controle.el.addEventListener('input', function () { C().limparErro(controle.el); revisar(); });
      lista.appendChild(campo);
    });
    lista.classList.toggle('oculto', !lista.children.length);

    /* o endereço do SYSBM só acompanha a colocação e as datas */
    var link = document.querySelectorAll('[data-dados-pendentes-link]');
    for (var i = 0; i < link.length; i++) link[i].classList.toggle('oculto', !r.link);
    revisar();
  }

  /* volta ao que está gravado (ou já foi enviado) */
  function restaurar() {
    C().limparErros(veu);
    campos.forEach(function (c) { escrever(c, c.original); });
    revisar();
  }

  /* o que existia não volta a ficar em branco; a colocação não aceita zero; datas válidas, não futuras,
     em ordem do posto mais baixo ao mais alto e nenhuma antes da inclusão (o erro dela fica no primeiro posto) */
  function conferir() {
    var T = RosterWork.mensagens.cadastro, ok = true;
    C().limparErros(veu);
    campos.forEach(function (c) {
      var valor = ler(c);
      if (!valor) {
        if (!c.original) return;
        var vazio = c.tipo === 'cnh' ? T.cnhVazia : (c.tipo === 'colocacao' ? T.colocacaoVazia
          : (c.campo === 'data_de_inclusao' ? T.inclusaoVazia : T.promocaoVazia));
        C().marcarErro(c.el, vazio);
        ok = false;
        return;
      }
      if (c.tipo === 'colocacao' && !parseInt(valor, 10)) { C().marcarErro(c.el, T.colocacaoZero); ok = false; return; }
      if (c.tipo !== 'data') return;
      var data = V().parseData(valor);
      if (!data) { C().marcarErro(c.el, T.dataInvalida); ok = false; return; }
      if (data > new Date()) { C().marcarErro(c.el, RosterWork.mensagens.perfil.dataFutura); ok = false; }
    });
    if (!ok) return false;
    var datas = campos.filter(function (c) { return c.tipo === 'data'; });
    if (!datas.length) return true;
    var inclusao = datas.filter(function (c) { return c.campo === 'data_de_inclusao'; })[0] || null;
    var promocoes = datas.filter(function (c) { return c !== inclusao; }).map(function (c) { return c.el; });
    return C().conferirPromocoes(promocoes, inclusao ? V().parseData(inclusao.el.value) : null, inclusao ? inclusao.el : null);
  }

  function valorParaEnvio(c) {
    var valor = ler(c);
    return c.tipo === 'data' ? V().paraISO(valor) : valor;
  }

  function enviar() {
    if (!conferir()) return;
    var mudou = alterados().map(function (c) { return { campo: c.campo, valor: valorParaEnvio(c) }; });
    if (!mudou.length) return;
    var M = RosterWork.mensagens;
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(salvar);
    RosterWork.rpc('perfil_solicitar', { p_alteracoes: mudou })
      .then(function (r) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(salvar);
        if (r && r.success) {
          /* o enviado passa a ser o "gravado" da janela; com tudo preenchido ela fecha.
             A própria janela confirma (o aviso), sem o resumo: o pedido ainda vai para a aprovação */
          campos.forEach(function (c) { c.original = ler(c); });
          revisar();
          if (campos.every(function (c) { return c.original; }) && RosterWork.fecharModais) RosterWork.fecharModais();
          RosterWork.avisar({ tipo: 'sucesso', mensagem: r.itens > 0 ? M.perfil.solicitacaoEnviada : M.perfil.dadosSalvos });
          return;
        }
        /* o banco recusou: o conflito com a inclusão fica no primeiro posto e o da colocação no campo dela */
        var erro = (r && r.error) || M.perfil.falhaDados;
        var alvo = campos.filter(function (c) {
          return (/[Ii]nclusão/.test(erro) && c.campo === 'data_de_inclusao') || (/Colocação/.test(erro) && c.tipo === 'colocacao');
        })[0];
        if (alvo) C().marcarErro(alvo.el, erro);
        else RosterWork.avisar({ tipo: 'erro', mensagem: erro });
      })
      .catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(salvar);
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* abre com o foco no primeiro item sem valor */
  function abrir(r) {
    montar(r);
    var vazio = campos.filter(function (c) { return !c.original; })[0];
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-dados-pendentes', vazio ? vazio.el : null);
  }

  /* os campos fixos da janela (a CNH e a colocação) são ligados uma vez; os das datas, a cada montagem */
  function ligarCamposFixos() {
    var cnh = document.getElementById('dados-pendentes-cnh');
    var colocacao = document.getElementById('dados-pendentes-colocacao');
    C().ligarSelecao(cnh, function () { C().limparErro(cnh); revisar(); });
    C().ligarMascara(colocacao, function (d) { return d; });
    colocacao.addEventListener('input', function () { C().limparErro(colocacao); revisar(); });
  }

  function inicializar() {
    veu = document.getElementById('veu-dados-pendentes');
    salvar = document.getElementById('dados-pendentes-salvar');
    var depois = document.getElementById('dados-pendentes-depois');
    if (!veu || !salvar || !depois || !RosterWork.campos) return;
    ligarCamposFixos();
    depois.addEventListener('click', function () {
      restaurar();
      if (RosterWork.fecharModais) RosterWork.fecharModais();
    });
    salvar.addEventListener('click', enviar);

    /* o navegador avisa se fechar com dados digitados e não salvos */
    if (RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(function () {
        return veu.classList.contains('modal-veu--aberto') && alterados().length > 0;
      });
    }

    if (jaLembrado() || !RosterWork.rpc) return;
    var vez = RosterWork.termos ? RosterWork.termos.liberado : Promise.resolve();
    Promise.all([RosterWork.rpc('dados_pendentes').catch(function () { return null; }), vez])
      .then(function (resultado) {
        var r = resultado[0];
        if (!r || !r.success) return;   // falhou: tenta de novo no próximo carregamento
        marcarLembrado();
        if (r.pendente) abrir(r);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
