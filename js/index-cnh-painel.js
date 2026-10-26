/* ============================================================
   CNH — o painel da pendência "Preencha a sua CNH" (shell)
   Aberto pela Pendências (seção Seu cadastro), para quem está
   com a CNH em Nenhuma e
   ainda não respondeu (pendencias_listar, tipo 'cnh'). O seletor
   vai por perfil_solicitar, o mesmo caminho do Meus dados: a
   categoria vai para a aprovação (o aviso confirma); "Não tenho
   CNH" só confirma a resposta (abre o resumo). Depois de salvar,
   quem abriu relê a lista e o sino relê o número do menu.
   Moldes no index.html. RosterWork.cnhPainel.abrir({ aoSalvar }).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var edicao = null;   // { selecao, btnSalvar, aoSalvar } enquanto o painel está aberto
  var guardaLigada = false;

  function escolhida() { return edicao ? (edicao.selecao.getAttribute('data-valor') || '') : ''; }
  function sujo() { return !!escolhida(); }

  function tentarFechar() {
    if (!sujo()) { RW.painel.fechar(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.sairSemSalvar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { edicao = null; RW.painel.fechar(); }
    });
  }

  function abrir(opcoes) {
    if (!RW.painel || !RW.campos) return;
    RW.painel.abrir({
      titulo: RW.mensagens.perfil.tituloCnh,
      aoFechar: function () { edicao = null; },
      aoTentarFechar: function () { if (!sujo()) return false; tentarFechar(); return true; }
    });
    var corpo = RW.painel.corpo();
    var rodape = RW.painel.rodape();
    var campo = RW.tpl('tpl-cnh-painel');
    if (!corpo || !rodape || !campo) return;
    corpo.appendChild(campo);
    rodape.appendChild(document.getElementById('tpl-cnh-painel-acoes').content.cloneNode(true));
    rodape.classList.remove('oculto');
    var atual = edicao = {
      selecao: campo.querySelector('#cnh-painel-selecao'),
      btnSalvar: rodape.querySelector('#cnh-painel-salvar'),
      aoSalvar: (opcoes && opcoes.aoSalvar) || null
    };
    /* o Salvar habilita quando há uma escolha */
    RW.campos.ligarSelecao(atual.selecao, function () { atual.btnSalvar.disabled = !sujo(); });
    rodape.querySelector('#cnh-painel-cancelar').addEventListener('click', tentarFechar);
    atual.btnSalvar.addEventListener('click', salvar);
    if (!guardaLigada && RW.guardaSaida) { RW.guardaSaida.registrar(sujo); guardaLigada = true; }
  }

  function salvar() {
    var atual = edicao;
    var valor = escolhida();
    if (!atual || !valor) return;
    var M = RW.mensagens;
    RW.iniciarCarregando(atual.btnSalvar);
    RW.rpc('perfil_solicitar', { p_alteracoes: [{ campo: 'cnh', valor: valor }] }).then(function (r) {
      RW.pararCarregando(atual.btnSalvar);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || M.perfil.falhaDados }); return; }
      edicao = null;
      RW.painel.fechar();
      /* "Não tenho CNH" valeu na hora (o resumo); a categoria foi para a aprovação (o aviso) */
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Meu perfil' });
      if (r.itens > 0) RW.avisar({ tipo: 'sucesso', mensagem: M.perfil.solicitacaoEnviada });
      if (RW.avisosSino) RW.avisosSino.recarregar();
      if (atual.aoSalvar) atual.aoSalvar();
    }, function () {
      RW.pararCarregando(atual.btnSalvar);
      RW.avisar({ tipo: 'erro', mensagem: M.geral.semConexao });
    });
  }

  RW.cnhPainel = { abrir: abrir };
})();
