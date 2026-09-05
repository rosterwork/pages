/* ============================================================
   DISTRIBUIÇÃO — criar / excluir modelo (Rodada 2)
   Modal "Novo modelo": contadores de Oficiais/Praças por unidade →
   gera a composição e abre a edição vazia. Excluir confirma
   e chama a RPC. Só admin.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var grupo = null;
  var valores = {};   /* unidade_id → { oficiais, pracas } */


  function abrirModal(grupoAtual, pre) {
    grupo = grupoAtual;
    valores = {};
    var cont = document.getElementById('distribuicao-nm-linhas');
    if (!cont) return;
    cont.textContent = '';
    grupo.unidades.forEach(function (u) {
      var p = (pre && pre[u.unidade_id]) || {};
      valores[u.unidade_id] = { oficiais: p.oficiais || 0, pracas: p.pracas || 0 };
      var linha = RosterWork.tpl('tpl-distribuicao-nm-linha');
      linha.querySelector('.distribuicao-nm-unidade').textContent = u.nome || '';
      Array.prototype.forEach.call(linha.querySelectorAll('.distribuicao-nm-contador'), function (c) {
        var perfil = c.getAttribute('data-perfil');
        var valEl = c.querySelector('.distribuicao-nm-valor');
        valEl.textContent = valores[u.unidade_id][perfil];
        Array.prototype.forEach.call(c.querySelectorAll('.distribuicao-nm-btn'), function (b) {
          b.addEventListener('click', function () {
            var v = Math.max(0, valores[u.unidade_id][perfil] + parseInt(b.getAttribute('data-delta'), 10));
            valores[u.unidade_id][perfil] = v;
            valEl.textContent = v;
          });
        });
      });
      cont.appendChild(linha);
    });
    ligar();
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-distribuicao-novo-modelo');
  }

  function ligar() {
    var fechar = function () { if (RosterWork.fecharModais) RosterWork.fecharModais(); };
    ['distribuicao-nm-fechar', 'distribuicao-nm-cancelar'].forEach(function (id) {
      var b = document.getElementById(id); if (b) b.onclick = fechar;
    });
    var criar = document.getElementById('distribuicao-nm-criar');
    if (criar) criar.onclick = criarModelo;
  }

  /* cria o modelo já SALVO (auto-save) e o abre em edição.
     Salva VINCULANDO só (grupos_parciais vazio): cria o grupo_completo e liga as chaves de composição,
     sem sobrescrever slots — preserva a sincronização (se a composição já existe, o novo modelo a herda). */
  function criarModelo() {
    var temAlgum = Object.keys(valores).some(function (id) { return valores[id].oficiais > 0 || valores[id].pracas > 0; });
    if (!temAlgum) { RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.distribuicao.composicaoVazia }); return; }
    var chaves = [];
    grupo.unidades.forEach(function (u) {
      var v = valores[u.unidade_id] || {};
      if ((v.oficiais || 0) > 0 || (v.pracas || 0) > 0) {
        chaves.push(u.unidade_id + '_' + (v.oficiais || 0) + 'OFC_' + (v.pracas || 0) + 'PRC');
      }
    });
    var payload = {
      ctx: grupo.cia.unidade_id, user: RosterWork.sessao.cpf() || 'sistema',
      id_grupo_completo: null, nome: '', chaves: chaves, grupos_parciais: []
    };
    var botao = document.getElementById('distribuicao-nm-criar');
    if (botao && RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.distribuicaoDados.salvar(payload).then(function (r) {
      /* libera o véu de clique em QUALQUER caso (sucesso ou falha) — senão a tela
         fica bloqueada por baixo do editor que abre em seguida. O modal fecha logo
         depois no sucesso, então restaurar o botão aqui é inofensivo. */
      if (botao && RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      if (r && r.ok && r.id_grupo_completo) {
        /* modelo recém-criado = RASCUNHO: aparece na lista/editor, mas só fica de verdade se o
           usuário clicar em Salvar; sem salvar (cancelar/sair/atualizar) ele é excluído */
        RosterWork.distribuicaoModelos.marcarRascunho(r.id_grupo_completo);
        if (RosterWork.fecharModais) RosterWork.fecharModais();
        /* pré-preenche as vagas (copia de um modelo que caiba, por unidade) ANTES de abrir o editor */
        RosterWork.distribuicaoDados.prefill(r.id_grupo_completo).then(function () {
          return RosterWork.distribuicaoModelos.recarregarLista();
        }).then(function () {
          RosterWork.distribuicaoModelos.editar(r.id_grupo_completo);
        });
      } else {
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.distribuicao.falhaSalvar });
      }
    }).catch(function () {
      if (botao && RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
      RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  function excluir(modeloId) {
    RosterWork.pedirData({
      confirmarPerigo: true,
      mensagem: RosterWork.mensagens.distribuicao.excluirModelo,
      textoConfirmar: RosterWork.mensagens.botoes.excluir,
      aoConfirmar: function (iso) {
        if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
        RosterWork.distribuicaoDados.excluirModelo(modeloId, RosterWork.sessao.cpf(), iso).then(function (r) {
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

  /* aviso de sair sem salvar: o "Novo modelo" é criação em MODAL (exceção documentada da REGRAS §4),
     então ganha a mesma guarda dos painéis — o navegador avisa ao fechar/recarregar/sair com a
     composição preenchida. Registrado uma vez; ativa só com o modal aberto e algum contador > 0. */
  if (RosterWork.guardaSaida) {
    RosterWork.guardaSaida.registrar(function () {
      var veu = document.getElementById('veu-distribuicao-novo-modelo');
      if (!veu || !veu.classList.contains('modal-veu--aberto')) return false;
      return Object.keys(valores).some(function (id) { return valores[id].oficiais > 0 || valores[id].pracas > 0; });
    });
  }

  window.RosterWork.distribuicaoCriar = {
    novo: function (g) { abrirModal(g, null); },
    excluir: excluir
  };
})();
