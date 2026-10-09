/* ============================================================
   DISTRIBUIÇÃO — criar / excluir modelo
   Novo modelo, no corpo: a composição (Oficiais · Praças) da unidade
   escolhida no filtro → cria o modelo e abre a edição. Excluir confirma
   e chama a RPC. Só admin.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var grupo = null;
  var unidade = null;   /* { unidade_id, nome, ... } — a unidade do modelo novo */
  var valores = null;   /* { oficiais, pracas } enquanto o formulário está aberto */

  function abrirFormulario(grupoAtual, unidadeId) {
    grupo = grupoAtual;
    unidade = (grupo.unidades || []).filter(function (u) { return u.unidade_id === unidadeId; })[0] || null;
    var corpo = document.getElementById('distribuicao-corpo');
    var form = RosterWork.tpl('tpl-distribuicao-novo-modelo');
    if (!corpo || !form || !unidade) return;
    RosterWork.distribuicaoModelos.limparSelecao();
    var rod = document.getElementById('distribuicao-rodape');
    if (rod) rod.textContent = '';
    valores = { oficiais: 0, pracas: 0 };
    form.querySelector('.distribuicao-novo-unidade').textContent = unidade.nome || '';
    Array.prototype.forEach.call(form.querySelectorAll('.distribuicao-nm-contador'), function (c) {
      var perfil = c.getAttribute('data-perfil');
      var valEl = c.querySelector('.distribuicao-nm-valor');
      Array.prototype.forEach.call(c.querySelectorAll('.distribuicao-nm-btn'), function (b) {
        b.addEventListener('click', function () {
          valores[perfil] = Math.max(0, valores[perfil] + parseInt(b.getAttribute('data-delta'), 10));
          valEl.textContent = valores[perfil];
        });
      });
    });
    form.querySelector('.distribuicao-novo-cancelar').addEventListener('click', fecharFormulario);
    var criar = form.querySelector('.distribuicao-novo-criar');
    criar.addEventListener('click', function () { criarModelo(criar); });
    corpo.textContent = '';
    corpo.appendChild(form);
  }

  function fecharFormulario() {
    valores = null;
    RosterWork.distribuicaoModelos.limparCorpo();
  }

  /* cria o modelo já SALVO (auto-save) e o abre em edição.
     Salva VINCULANDO só (grupos_parciais vazio): cria o modelo e liga a chave da composição. */
  function criarModelo(botao) {
    var M = RosterWork.mensagens.distribuicao;
    if (!valores || (valores.oficiais === 0 && valores.pracas === 0)) {
      RosterWork.avisar({ tipo: 'erro', mensagem: M.composicaoVazia });
      return;
    }
    /* a unidade já tem um modelo com essa composição: é o mesmo modelo, abre ele */
    var existente = RosterWork.distribuicaoModelos.modelosDaUnidade(unidade.unidade_id).filter(function (m) {
      var u = m.unidades[0];
      return (u.oficiais || 0) === valores.oficiais && (u.pracas || 0) === valores.pracas;
    })[0];
    if (existente) {
      valores = null;
      RosterWork.avisar({ tipo: 'aviso', mensagem: M.modeloJaExiste(unidade.nome || '') });
      RosterWork.distribuicaoModelos.selecionar(existente.id_grupo_completo);
      return;
    }
    var payload = {
      ctx: grupo.cia.unidade_id,
      id_grupo_completo: null, nome: '',
      chaves: [unidade.unidade_id + '_' + valores.oficiais + 'OFC_' + valores.pracas + 'PRC'],
      grupos_parciais: []
    };
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.distribuicaoDados.salvar(payload).then(function (r) {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (r && r.ok && r.id_grupo_completo) {
        valores = null;
        /* modelo recém-criado = RASCUNHO: aparece na lista/editor, mas só fica de verdade se o
           usuário clicar em Salvar; sem salvar (cancelar/sair/atualizar) ele é excluído */
        RosterWork.distribuicaoModelos.marcarRascunho(r.id_grupo_completo);
        /* pré-preenche as vagas (copia de um modelo da mesma unidade que caiba) ANTES de abrir o editor */
        RosterWork.distribuicaoDados.prefill(r.id_grupo_completo).then(function () {
          return RosterWork.distribuicaoModelos.recarregarLista();
        }).then(function () {
          RosterWork.distribuicaoModelos.editar(r.id_grupo_completo);
        });
      } else if (r && r.existe) {
        RosterWork.avisar({ tipo: 'aviso', mensagem: M.modeloJaExiste(unidade.nome || '') });
      } else {
        RosterWork.avisar({ tipo: 'erro', mensagem: M.falhaSalvar });
      }
    }).catch(function () {
      if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  function excluir(modeloId) {
    RosterWork.pedirData({
      confirmarPerigo: true,
      mensagem: RosterWork.mensagens.distribuicao.excluirModelo,
      textoConfirmar: RosterWork.mensagens.botoes.excluirModelo,
      aoConfirmar: function (iso) {
        if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
        RosterWork.distribuicaoDados.excluirModelo(modeloId, iso).then(function (r) {
          if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
          if (r && r.ok) {
            RosterWork.distribuicaoModelos.recarregarLista();
            if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Distribuição' });
          } else {
            RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.distribuicao.falhaSalvar });
          }
        }).catch(function () {
          if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
          RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
        });
      }
    });
  }

  /* aviso de sair sem salvar: com o formulário do Novo modelo aberto e algum contador > 0,
     o navegador avisa ao fechar/recarregar/sair. Registrado uma vez. */
  if (RosterWork.guardaSaida) {
    RosterWork.guardaSaida.registrar(function () {
      if (!valores || !document.querySelector('#distribuicao-corpo .distribuicao-novo')) return false;
      return valores.oficiais > 0 || valores.pracas > 0;
    });
  }

  window.RosterWork.distribuicaoCriar = {
    novo: abrirFormulario,
    excluir: excluir
  };
})();
