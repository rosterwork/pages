/* ============================================================
   AJUSTES — configurações das unidades (NAVEGACAO §4/§5)
   Índice interno à esquerda (seções de ajuste; por ora "Escala →
   Ritmo das unidades") e, no corpo, a árvore de unidades com um
   card do RITMO (escala_config: 24/48 · 24/72 · 12/36) por unidade
   marcada. Admin clica no card → painel direito edita o ritmo
   (ajustes_ritmo_salvar: grava, REGENERA a escala automática dos
   lotados e audita → modal de resumo). Não-admin só visualiza.
   As preferências pessoais (tema) moram no Meu perfil (cabeçalho).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.paginas = window.RosterWork.paginas || {};

  var OPCOES_RITMO = ['24/48', '24/72', '12/36'];

  var ctx = null;           // edição aberta: { unidade, ritmoOriginal, escolhido, btnSalvar }
  var guardaLigada = false;


  /* '24/48' -> '24 h de serviço · 48 h de folga' */
  function descreverRitmo(ritmo) {
    var p = String(ritmo || '').split('/');
    if (p.length !== 2) return '';
    return p[0] + ' h de serviço · ' + p[1] + ' h de folga';
  }

  /* título do painel: o PEL mostra a companhia acima ("2ªCIBM / 1ºPEL") */
  function tituloUnidade(unidade) {
    if (unidade.tipo === 'PEL' && RosterWork.arvoreUnidades) {
      var pai = RosterWork.arvoreUnidades.pai(unidade.unidade_id);
      if (pai) return pai.nome + ' / ' + unidade.nome;
    }
    return unidade.nome;
  }

  function sujo() { return !!(ctx && ctx.escolhido && ctx.escolhido !== ctx.ritmoOriginal); }

  /* ---------- card do ritmo (conteúdo da árvore) ---------- */
  function renderConteudo(container, unidade, itens) {
    var ritmo = itens.length ? itens[0].ritmo : '24/48';
    var card = RosterWork.tpl('tpl-ajuste-ritmo-cartao');
    if (!card) return;
    card.querySelector('.ajuste-cartao-valor').textContent = ritmo;
    card.querySelector('.ajuste-cartao-ajuda').textContent = descreverRitmo(ritmo);
    card.setAttribute('data-unidade-id', unidade.unidade_id);
    if (RosterWork.sessao.ehAdmin()) {
      card.classList.add('ajuste-cartao--clicavel');
      card.addEventListener('click', function () { abrirPainel(unidade, ritmo); });
    }
    container.appendChild(card);
  }

  /* ---------- painel direito: editar o ritmo (só admin) ---------- */
  function aoFechar() { ctx = null; }

  function abrirPainel(unidade, ritmoAtual) {
    if (!RosterWork.painel) return;
    RosterWork.painel.abrir({
      titulo: tituloUnidade(unidade),
      tituloExtra: unidade.cidade ? '- ' + unidade.cidade : '',
      modoFixo: 'editar',
      aoFechar: aoFechar,
      aoTentarFechar: function () { if (!sujo()) return false; tentarFechar(); return true; }   // X/Esc confirmam o descarte
    });
    ctx = { unidade: unidade, ritmoOriginal: ritmoAtual, escolhido: ritmoAtual, btnSalvar: null };

    var corpo = RosterWork.painel.corpo();
    var rodape = RosterWork.painel.rodape();
    if (!corpo) return;

    var secao = RosterWork.painel.criarSecao('Ritmo da escala');
    var linha = RosterWork.tpl('tpl-ajuste-ritmo-editar');
    if (secao && linha) {
      secao.appendChild(linha);
      secao.appendChild(RosterWork.painel.criarLinha('Efeito', 'A escala automática dos militares da unidade é regerada de hoje em diante.'));
      corpo.appendChild(secao);
    }

    var texto = corpo.querySelector('#ajuste-ritmo-texto');
    var menu = corpo.querySelector('#ajuste-ritmo-menu');
    if (texto) texto.textContent = ritmoAtual;
    if (menu) {
      OPCOES_RITMO.forEach(function (opcao) {
        var item = RosterWork.tpl('tpl-ajuste-ritmo-opcao');
        if (!item) return;
        item.textContent = opcao + ' · ' + descreverRitmo(opcao);
        item.addEventListener('click', function () {
          ctx.escolhido = opcao;
          if (texto) texto.textContent = opcao;
          atualizarSalvar();
        });
        menu.appendChild(item);
      });
    }

    if (rodape) {
      rodape.appendChild(document.getElementById('tpl-ajuste-painel-acoes').content.cloneNode(true));
      rodape.classList.remove('oculto');
      ctx.btnSalvar = rodape.querySelector('#ajuste-salvar');
      var btnCancelar = rodape.querySelector('#ajuste-cancelar');
      if (btnCancelar) btnCancelar.addEventListener('click', tentarFechar);
      if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    }

    if (!guardaLigada && RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(sujo);
      guardaLigada = true;
    }
  }

  function atualizarSalvar() {
    if (ctx && ctx.btnSalvar) ctx.btnSalvar.disabled = !sujo();
  }

  function tentarFechar() {
    if (sujo() && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RosterWork.mensagens.botoes.sairSemSalvar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { ctx = null; RosterWork.painel.fechar(); }
      });
      return;
    }
    RosterWork.painel.fechar();
  }

  /* mudar o ritmo regenera o serviço (QUANDO) de todos e recalcula a distribuição:
     pede a data (modal padrão, começa amanhã) e manda como p_recalcular_desde */
  function salvar() {
    if (!sujo()) return;
    RosterWork.pedirData({
      mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
      textoConfirmar: RosterWork.mensagens.botoes.salvar,
      aoConfirmar: function (iso) {
        if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
        RosterWork.apiFetch('/rest/v1/rpc/ajustes_ritmo_salvar', {
          metodo: 'POST',
          corpo: { p_unidade_id: ctx.unidade.unidade_id, p_ritmo: ctx.escolhido, p_por: RosterWork.sessao.cpf(), p_recalcular_desde: iso }
        }).then(function (resp) {
          if (!resp.ok) return { _falha: 'servidor' };
          return resp.json();
        }).then(function (r) {
          if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
          if (r && r._falha === 'servidor') {
            if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
          } else if (r && r.success) {
            ctx = null;
            RosterWork.painel.fechar();
            if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();   // o ritmo muda card + contagem
            if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Ajustes' });
          } else if (RosterWork.avisar) {
            RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.geral.falhaServidor });
          }
        }).catch(function () {
          if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
        });
      }
    });
  }

  /* ---------- entrada da página ---------- */
  function iniciar(conteudo) {
    var container = conteudo.querySelector('#arvore-ajustes');
    if (!container || !RosterWork.arvoreUnidades) return Promise.resolve();
    return RosterWork.arvoreUnidades.montar(container, {
      rpcConteudo: 'ajustes_ritmo_listar',
      chaveUnidade: 'unidade_id',
      textoContagem: function (itens) { return itens.length ? itens[0].ritmo : ''; },
      renderConteudo: renderConteudo
    });
  }

  window.RosterWork.paginas.ajustes = { iniciar: iniciar };
})();
