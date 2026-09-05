/* ============================================================
   POSTOS — painel lateral de instalação: editar e criar (só admin)
   Editar: clicar num card (abrir). Criar: o botão "+" (abrirNovo,
   Adicionar instalação) — mesmo painel, sem abas, com a linha
   "Instalação" no topo. Título = unidade; uma seção .painel-secao
   com as linhas editáveis (Estado + efetivo mínimo/ideal/máximo)
   como seletores. Rodapé Cancelar/Salvar no padrão do Editar das
   escalas: Salvar só habilita com dado válido e ordem mínimo ≤
   ideal ≤ máximo. Grava pelo RPC atualizar_instalacao (editar) ou
   inserir_instalacao (criar); no editar atualiza o card de forma
   cirúrgica (sem flash), no criar recarrega a árvore; confirma no
   modal geral-resumo com o log do banco.
   Moldes em postos.html; casca da gaveta em geral-painel.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var modo = 'editar';    // 'editar' (card existente) | 'novo' (Adicionar instalação)
  var aoFecharDono = null; // callback da página para tirar o realce do card ao fechar
  var unidadeNova = null; // no modo 'novo': a unidade que recebe a instalação
  var ctx = null;         // { inst?, btnSalvar }
  var valores = null;     // { tipo?, nome?, estado, min, ideal, max } em edição/criação
  var originais = null;   // os mesmos valores ao abrir (só no modo 'editar')
  var sujo = false;
  var elInstalacaoGatilho = null;  // gatilho/menu da linha "Instalação" (modo 'novo')
  var elInstalacaoMenu = null;

  /* escreve o valor no gatilho .campo-selecao; vazio = estilo placeholder ("Selecione") */
  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* ordem obrigatória: mínimo ≤ ideal ≤ máximo (os três precisam estar preenchidos) */
  function ordemValida() {
    return valores.min != null && valores.ideal != null && valores.max != null &&
           valores.min <= valores.ideal && valores.ideal <= valores.max;
  }

  /* há alteração não salva? edição = diferente do original; criação = algo preenchido */
  function recalcularSujo() {
    if (modo === 'novo') {
      sujo = !!valores.tipo || valores.estado !== 'Ativo' ||
             valores.min != null || valores.ideal != null || valores.max != null;
      return;
    }
    sujo = valores.estado !== originais.estado ||
           valores.min !== originais.min ||
           valores.ideal !== originais.ideal ||
           valores.max !== originais.max;
  }

  /* Salvar habilita: edição = com alteração + ordem válida; criação = instalação
     escolhida + ordem válida (espelha o Editar das escalas) */
  function atualizarSalvar() {
    if (!ctx || !ctx.btnSalvar) return;
    if (modo === 'novo') ctx.btnSalvar.disabled = !valores.tipo || !ordemValida();
    else ctx.btnSalvar.disabled = !sujo || !ordemValida();
  }

  function aoMudar() {
    recalcularSujo();
    atualizarSalvar();
  }

  /* linha do Estado: dois itens fixos (Ativo/Inativo) */
  function montarLinhaEstado() {
    var linha = RosterWork.tpl('tpl-posto-editar-estado');
    if (!linha) return null;
    var gatilho = linha.querySelector('.campo-selecao');
    definirTexto(gatilho, valores.estado);
    var itens = linha.querySelectorAll('.dropdown-item');
    for (var i = 0; i < itens.length; i++) {
      (function (item) {
        item.addEventListener('click', function () {
          valores.estado = item.getAttribute('data-valor');
          definirTexto(gatilho, valores.estado);
          aoMudar();
        });
      })(itens[i]);
    }
    return linha;
  }

  /* linha de um efetivo: opções 1 a 10 pelo dropdown de números */
  function montarLinhaEfetivo(rotulo, chave) {
    var linha = RosterWork.tpl('tpl-posto-editar-linha');
    if (!linha) return null;
    linha.querySelector('.campo-rotulo').textContent = rotulo;
    var gatilho = linha.querySelector('.campo-selecao');
    var vazio = valores[chave] == null;
    definirTexto(gatilho, vazio ? 'Selecione' : String(valores[chave]), vazio);
    var menu = linha.querySelector('.dropdown-menu');
    if (menu && RosterWork.dropdownNumeros) {
      RosterWork.dropdownNumeros.preencher(menu, {
        opcoes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        valor: valores[chave],
        aoEscolher: function (v) {
          valores[chave] = v;
          definirTexto(gatilho, String(v));
          aoMudar();
        }
      });
    }
    return linha;
  }

  /* linha "Instalação" (modo criação): o menu é preenchido por popularInstalacoes */
  function montarLinhaInstalacao() {
    var linha = RosterWork.tpl('tpl-posto-novo-instalacao');
    if (!linha) return null;
    elInstalacaoGatilho = linha.querySelector('.campo-selecao');
    elInstalacaoMenu = linha.querySelector('.dropdown-menu');
    return linha;
  }

  /* preenche o seletor com os nomes sugeridos (RPC proximos_numeros_instalacao) */
  function popularInstalacoes(unidadeId) {
    if (!elInstalacaoMenu) return;
    elInstalacaoMenu.textContent = '';
    RosterWork.apiFetch('/rest/v1/rpc/proximos_numeros_instalacao', { metodo: 'POST', corpo: { p_unidade_id: unidadeId } })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (lista) {
        if (!lista) {   // falhou: senão o seletor fica vazio e o Salvar preso, sem explicação
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
          return;
        }
        var tplOp = document.getElementById('tpl-ai-opcao');
        (lista || []).forEach(function (op) {
          var item = tplOp ? tplOp.content.cloneNode(true).firstElementChild : null;
          if (!item) return;
          item.textContent = op.nome_sugerido;
          item.addEventListener('click', function () {
            valores.tipo = op.tipo;
            valores.nome = op.nome_sugerido;
            definirTexto(elInstalacaoGatilho, op.nome_sugerido);
            aoMudar();
          });
          elInstalacaoMenu.appendChild(item);
        });
      })
      .catch(function () {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* subcabeçalho: o nome da instalação (edição) ou "Nova instalação" (criação) */
  function montarSubcabecalho(texto) {
    var sub = RosterWork.painel.subcabecalho();
    if (!sub) return;
    var titulo = RosterWork.tpl('tpl-posto-painel-titulo');
    if (titulo) { titulo.textContent = texto || ''; sub.appendChild(titulo); }
    sub.classList.remove('oculto');
  }

  /* corpo: no modo criação, a linha "Instalação" no topo; depois Estado + efetivos
     (o título/subtítulo fica no subcabeçalho) */
  function montarCorpo() {
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    var secao = RosterWork.painel.criarSecao('');
    if (!secao) return;
    var rotulo = secao.querySelector('.rotulo-secao');
    if (rotulo) rotulo.remove();   // o título subiu para o subcabeçalho
    var linhas = [];
    if (modo === 'novo') linhas.push(montarLinhaInstalacao());
    linhas.push(montarLinhaEstado());
    linhas.push(montarLinhaEfetivo('Ef. mínimo', 'min'));
    linhas.push(montarLinhaEfetivo('Ef. ideal', 'ideal'));
    linhas.push(montarLinhaEfetivo('Ef. máximo', 'max'));
    linhas.forEach(function (linha) { if (linha) secao.appendChild(linha); });
    corpo.appendChild(secao);
    if (modo === 'editar') montarExcluir(corpo);
  }

  /* ---------- excluir instalação (ação crítica, no rodapé do painel; sem data) ---------- */

  function montarExcluir(corpo) {
    var secao = RosterWork.painel.criarSecaoColapsavel('Excluir instalação', { aberta: false });
    if (!secao) return;
    secao.classList.add('painel-secao--rodape');
    var btn = RosterWork.tpl('tpl-instalacao-excluir-botao');
    if (btn) {
      btn.addEventListener('click', confirmarExcluir);
      secao.querySelector('.painel-secao-corpo').appendChild(btn);
    }
    corpo.appendChild(secao);
  }

  function confirmarExcluir() {
    if (!ctx || !ctx.inst || !RosterWork.confirmar) return;
    var t = RosterWork.mensagens.postos;
    RosterWork.pedirData({
      mensagem: t.confirmarExcluirInstalacao.replace('{nome}', ctx.inst.nome || '')
        + ' ' + t.impactoDistribuicao,
      textoConfirmar: RosterWork.mensagens.botoes.excluirInstalacao,
      confirmarPerigo: true,
      aoConfirmar: function (iso) { excluir(iso); }
    });
  }

  function excluir(recalcularDesde) {
    if (!ctx || !ctx.inst) return;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // excluir recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/excluir_instalacao', {
      metodo: 'POST',
      corpo: { p_admin_cpf: RosterWork.sessao.cpf(), p_instalacao_id: ctx.inst.id_instalacao, p_recalcular_desde: recalcularDesde || null }
    })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          sujo = false;
          RosterWork.painel.fechar();
          if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaExcluirInstalacao });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* rodapé: Cancelar / Salvar (Salvar nasce desabilitado) */
  function montarRodape() {
    var rodape = RosterWork.painel.rodape();
    var tpl = document.getElementById('tpl-posto-painel-acoes');
    if (!rodape || !tpl) { if (rodape) rodape.classList.add('oculto'); return; }
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.posto-painel-cancelar');
    if (cancelar) cancelar.addEventListener('click', aoClicarCancelar);
    ctx.btnSalvar = rodape.querySelector('.posto-painel-salvar');
    if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    atualizarSalvar();
  }

  /* Cancelar: confirma o descarte se houver alteração não salva */
  function aoClicarCancelar() {
    if (sujo && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.postos.descartarAlteracoes,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { RosterWork.painel.fechar(); }
      });
    } else {
      RosterWork.painel.fechar();
    }
  }

  /* envia ao banco (insert/update) com loading no botão e os 3 erros distintos */
  function enviar(endpoint, corpo, msgFalha, aoSucesso) {
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.apiFetch(endpoint, { metodo: 'POST', corpo: corpo })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          sujo = false;
          aoSucesso(r);
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || msgFalha });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  function salvar() {
    if (!ctx || !ordemValida()) return;
    if (modo === 'novo') {
      if (!valores.tipo) return;
      RosterWork.pedirData({
        mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
        textoConfirmar: 'Adicionar',
        aoConfirmar: function (iso) {
          enviar('/rest/v1/rpc/inserir_instalacao', {
            p_unidade_id: unidadeNova.unidade_id,
            p_tipo: valores.tipo,
            p_estado: valores.estado,
            p_efetivo_min: valores.min,
            p_efetivo_ideal: valores.ideal,
            p_efetivo_max: valores.max,
            p_created_by: RosterWork.sessao.cpf(),
            p_recalcular_desde: iso
          }, RosterWork.mensagens.postos.falhaAdicionar, aplicarSucessoNovo);
        }
      });
      return;
    }
    if (!sujo) return;
    var inst = ctx.inst;   // referência compartilhada com o card (mutável p/ reabrir o painel já fresco)
    RosterWork.pedirData({
      mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
      textoConfirmar: RosterWork.mensagens.botoes.salvar,
      aoConfirmar: function (iso) {
        enviar('/rest/v1/rpc/atualizar_instalacao', {
          p_instalacao_id: inst.id_instalacao,
          p_estado: valores.estado,
          p_efetivo_min: valores.min,
          p_efetivo_ideal: valores.ideal,
          p_efetivo_max: valores.max,
          p_atualizado_por: RosterWork.sessao.cpf(),
          p_recalcular_desde: iso
        }, RosterWork.mensagens.postos.falhaEditar, function (r) { aplicarSucesso(inst, r); });
      }
    });
  }

  /* sucesso: atualiza o card cirurgicamente (sem flash), fecha o painel e mostra o
     modal de confirmação com o log gravado e devolvido pelo banco */
  function aplicarSucesso(inst, r) {
    var dados = r.instalacao;
    if (dados) {
      /* mantém o objeto do card fresco: reabrir o painel mostra os novos valores */
      inst.status = dados.status;
      inst.efetivo_minimo = dados.efetivo_minimo;
      inst.efetivo_ideal = dados.efetivo_ideal;
      inst.efetivo_maximo = dados.efetivo_maximo;
      if (RosterWork.paginas && RosterWork.paginas.postos && RosterWork.paginas.postos.atualizarCard) {
        RosterWork.paginas.postos.atualizarCard(inst.id_instalacao, {
          status: dados.status,
          min: dados.efetivo_minimo,
          ideal: dados.efetivo_ideal,
          max: dados.efetivo_maximo
        });
      }
    }
    RosterWork.painel.fechar();
    if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
  }

  /* sucesso da criação: fecha o painel, recarrega a árvore (o novo card aparece) e
     abre o modal de confirmação com o log do banco */
  function aplicarSucessoNovo(r) {
    RosterWork.painel.fechar();
    if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
    if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
  }

  /* a gaveta foi fechada: zera o estado (some o "não salvo" do guarda de saída) */
  function aoFechar() {
    if (aoFecharDono) { aoFecharDono(); aoFecharDono = null; }   /* tira o realce do card */
    ctx = null;
    valores = null;
    originais = null;
    sujo = false;
    modo = 'editar';
    unidadeNova = null;
    elInstalacaoGatilho = null;
    elInstalacaoMenu = null;
  }

  /* título do painel: a unidade marcada; um pelotão mostra a companhia acima
     ("1ªCIBM / 2ºPEL"), como nas escalas */
  function tituloUnidade(unidade) {
    var nome = unidade.nome || unidade.nome_completo || '';
    if (unidade.tipo === 'PEL' && RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.pai) {
      var paiUnidade = RosterWork.arvoreUnidades.pai(unidade.unidade_id);
      if (paiUnidade && paiUnidade.nome) nome = paiUnidade.nome + ' / ' + nome;
    }
    return nome;
  }

  /* abre o painel de edição da instalação clicada (a unidade vai no título) */
  function abrir(unidade, inst, limparSelecao) {
    if (!RosterWork.painel || !inst) return;
    modo = 'editar';
    aoFecharDono = (typeof limparSelecao === 'function') ? limparSelecao : null;
    ctx = { inst: inst, btnSalvar: null };
    valores = { estado: inst.status, min: inst.efetivo_minimo, ideal: inst.efetivo_ideal, max: inst.efetivo_maximo };
    originais = { estado: valores.estado, min: valores.min, ideal: valores.ideal, max: valores.max };
    sujo = false;

    RosterWork.painel.abrir({
      titulo: tituloUnidade(unidade),
      tituloExtra: unidade.cidade ? '- ' + unidade.cidade : '',
      modoFixo: 'editar',
      aoFechar: aoFechar
    });
    montarSubcabecalho(inst.nome);
    montarCorpo();
    montarRodape();
  }

  /* abre o painel em modo criação (Adicionar instalação): mesma casca, sem abas
     Ver/Editar, com a linha "Instalação" no topo + Estado/efetivos vazios */
  function abrirNovo(unidade) {
    if (!RosterWork.painel || !unidade) return;
    modo = 'novo';
    unidadeNova = unidade;
    ctx = { btnSalvar: null };
    valores = { tipo: null, nome: null, estado: 'Ativo', min: null, ideal: null, max: null };
    originais = null;
    sujo = false;

    RosterWork.painel.abrir({
      titulo: tituloUnidade(unidade),
      tituloExtra: unidade.cidade ? '- ' + unidade.cidade : '',
      aoFechar: aoFechar
    });
    montarSubcabecalho('Nova instalação');
    montarCorpo();
    montarRodape();
    popularInstalacoes(unidade.unidade_id);
  }

  /* guarda-de-saída: o navegador avisa ao fechar/recarregar com alteração não salva */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return sujo; });
  }

  window.RosterWork.postosPainel = { abrir: abrir, abrirNovo: abrirNovo };
})();
