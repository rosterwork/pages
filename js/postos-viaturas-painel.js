/* ============================================================
   POSTOS — painel lateral de viatura: editar, criar e excluir (só
   admin). Mesmo padrão da ficha do militar: **título = o prefixo**,
   subtítulo = a unidade, e o sub-cabeçalho traz as abas
   **Dados** e **Manutenções**.
   - Dados: Estado (Ativo/Reserva/Inativo) · CNH · guarnição
     (mín/ideal/máx) + as seções **Transferir**
     (postos-viaturas-transferir.js) e **Excluir viatura**.
   - Manutenções: o histórico de janelas (postos-viaturas-manutencao.js).
   O rodapé Cancelar/Salvar é dos Dados; some na aba Manutenções.

   Estado não tem "Manutenção" — esta é derivada de uma janela ativa e
   aparece no card como "Manutenção até DD/MM" (ou só "Em manutenção",
   quando a janela está em aberto). Grava por inserir_viatura /
   atualizar_viatura / excluir_viatura; no editar atualiza o card
   cirurgicamente, no criar/excluir recarrega a árvore; confirma no
   geral-resumo. A viatura é **única no sistema**: se o prefixo já
   existe em outra unidade, o cadastro oferece a transferência. Na
   criação não há abas, Transferir nem Excluir (só Prefixo + Estado +
   CNH + guarnição).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var secaoAtual = 'dados'; // aba do sub-cabeçalho: 'dados' | 'manutencoes'
  var aoFecharDono = null; // callback da página para tirar o realce do card ao fechar
  var modo = 'editar';     // 'editar' (card existente) | 'novo' (Adicionar viatura)
  var unidadeNova = null;  // no modo 'novo': a unidade que recebe a viatura
  var ctx = null;          // { viatura?, unidade, btnSalvar }
  var valores = null;      // { prefixo?, status, cnh, min, ideal, max } em edição/criação
  var originais = null;    // os mesmos valores ao abrir (só no modo 'editar')
  var sujo = false;

  /* escreve o valor no gatilho .campo-selecao; vazio = estilo placeholder */
  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* ---------- validação ---------- */
  function prefixoValido(p) { return /^[A-Z]+-[0-9]+$/.test(String(p || '').toUpperCase().trim()); }
  function ordemValida() {
    return valores.min != null && valores.ideal != null && valores.max != null &&
           valores.min <= valores.ideal && valores.ideal <= valores.max;
  }
  function dadosValidos() {
    if (modo === 'novo') return prefixoValido(valores.prefixo) && !!valores.cnh && ordemValida();
    return !!valores.cnh && ordemValida();
  }

  /* há alteração não salva? criação = algo preenchido; edição = diferente do original */
  function recalcularSujo() {
    if (modo === 'novo') {
      sujo = !!valores.prefixo || valores.status !== 'Ativo' || !!valores.cnh ||
             valores.min != null || valores.ideal != null || valores.max != null;
      return;
    }
    sujo = valores.status !== originais.status || valores.cnh !== originais.cnh ||
           valores.min !== originais.min || valores.ideal !== originais.ideal || valores.max !== originais.max;
  }

  function atualizarSalvar() {
    if (!ctx || !ctx.btnSalvar) return;
    if (modo === 'novo') ctx.btnSalvar.disabled = !dadosValidos();
    else ctx.btnSalvar.disabled = !sujo || !dadosValidos();
  }

  function aoMudar() {
    recalcularSujo();
    atualizarSalvar();
  }

  /* ---------- linhas editáveis ---------- */

  /* Prefixo (só criação): texto livre em caixa-alta, formato LETRAS-NÚMERO */
  function montarLinhaPrefixo() {
    var linha = RosterWork.tpl('tpl-viatura-editar-prefixo');
    if (!linha) return null;
    var input = linha.querySelector('.viatura-prefixo');
    if (input) {
      input.addEventListener('input', function () {
        var pos = input.selectionStart;
        input.value = input.value.toUpperCase();
        try { input.setSelectionRange(pos, pos); } catch (e) {}
        valores.prefixo = input.value.trim();
        aoMudar();
      });
    }
    return linha;
  }

  /* Estado: três itens fixos (Ativo/Reserva/Inativo) — Manutenção é derivada */
  function montarLinhaStatus() {
    var linha = RosterWork.tpl('tpl-viatura-editar-status');
    if (!linha) return null;
    var gatilho = linha.querySelector('.campo-selecao');
    definirTexto(gatilho, valores.status);
    var itens = linha.querySelectorAll('.dropdown-item');
    for (var i = 0; i < itens.length; i++) {
      (function (item) {
        item.addEventListener('click', function () {
          valores.status = item.getAttribute('data-valor');
          definirTexto(gatilho, valores.status);
          aoMudar();
        });
      })(itens[i]);
    }
    return linha;
  }

  /* CNH exigida: itens fixos A a E */
  function montarLinhaCnh() {
    var linha = RosterWork.tpl('tpl-viatura-editar-cnh');
    if (!linha) return null;
    var gatilho = linha.querySelector('.campo-selecao');
    var vazio = !valores.cnh;
    definirTexto(gatilho, vazio ? 'Selecione' : valores.cnh, vazio);
    var itens = linha.querySelectorAll('.dropdown-item');
    for (var i = 0; i < itens.length; i++) {
      (function (item) {
        item.addEventListener('click', function () {
          valores.cnh = item.getAttribute('data-valor');
          definirTexto(gatilho, valores.cnh);
          aoMudar();
        });
      })(itens[i]);
    }
    return linha;
  }

  /* um efetivo da guarnição: 1 a 10 pelo dropdown de números (reusa o molde das instalações) */
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
        aoEscolher: function (v) { valores[chave] = v; definirTexto(gatilho, String(v)); aoMudar(); }
      });
    }
    return linha;
  }


  /* seção colapsável "Excluir viatura" — grudada no rodapé, começa fechada (só edição) */
  function montarExcluir(corpo) {
    var secao = RosterWork.painel.criarSecaoColapsavel('Excluir viatura', { aberta: false });
    if (!secao) return;
    secao.classList.add('painel-secao--rodape');
    var btn = RosterWork.tpl('tpl-viatura-excluir-botao');
    if (btn) {
      btn.addEventListener('click', confirmarExcluir);
      secao.querySelector('.painel-secao-corpo').appendChild(btn);
    }
    corpo.appendChild(secao);
  }

  /* ---------- montagem do painel ---------- */

  /* "2ªCIBM / 1ºPEL — Umuarama": o lugar da viatura, no subtítulo (o título é o prefixo) */
  function textoLocal(unidade) {
    var nome = tituloUnidade(unidade);
    return unidade && unidade.cidade ? nome + ' - ' + unidade.cidade : nome;
  }

  /* sub-cabeçalho: abas Dados / Manutenções (mesmo componente de Usuários) */
  function montarAbas() {
    var sub = RosterWork.painel.subcabecalho();
    var tpl = document.getElementById('tpl-viatura-painel-secoes');
    if (!sub || !tpl) return;
    sub.appendChild(tpl.content.cloneNode(true));
    sub.classList.remove('oculto');
    var trilho = sub.querySelector('.abas');
    if (trilho && RosterWork.abas) {
      RosterWork.abas.ligar(trilho, function (aba) {
        secaoAtual = aba.getAttribute('data-secao') || 'dados';
        montarCorpo();
        atualizarRodape();
      });
    }
  }

  /* corpo: seção principal (Estado/CNH/guarnição, + Prefixo no criar) e, na edição,
     as seções Manutenção, Transferir e Excluir — todas no mesmo nível */
  /* corpo por aba: Dados (Estado/CNH/guarnição + Transferir/Excluir) | Manutenções (histórico) */
  function montarCorpo() {
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    corpo.textContent = '';

    if (secaoAtual === 'manutencoes') {
      if (RosterWork.postosViaturasManutencao) {
        RosterWork.postosViaturasManutencao.montar(corpo, ctx.viatura, { aoMudar: sincronizarManutencao });
      }
      return;
    }

    var secao = RosterWork.painel.criarSecao('');
    if (secao) {
      var rotulo = secao.querySelector('.rotulo-secao');
      if (rotulo) rotulo.remove();
      var linhas = [];
      if (modo === 'novo') linhas.push(montarLinhaPrefixo());
      linhas.push(montarLinhaStatus());
      linhas.push(montarLinhaCnh());
      linhas.push(montarLinhaEfetivo('Ef. mínimo', 'min'));
      linhas.push(montarLinhaEfetivo('Ef. ideal', 'ideal'));
      linhas.push(montarLinhaEfetivo('Ef. máximo', 'max'));
      linhas.forEach(function (linha) { if (linha) secao.appendChild(linha); });
      corpo.appendChild(secao);
    }
    if (modo === 'editar') {
      if (RosterWork.postosViaturasTransferir) {
        RosterWork.postosViaturasTransferir.montar(corpo, ctx.viatura, ctx.unidade, { aoConcluir: aoTransferido });
      }
      montarExcluir(corpo);
    }
  }

  /* o rodapé Cancelar/Salvar é dos Dados; na aba Manutenções ele some */
  function atualizarRodape() {
    var rodape = RosterWork.painel.rodape();
    if (rodape) rodape.classList.toggle('oculto', secaoAtual !== 'dados');
  }

  /* rodapé Cancelar / Salvar (para os dados do topo — Estado/CNH/guarnição) */
  function montarRodape() {
    var rodape = RosterWork.painel.rodape();
    var tpl = document.getElementById('tpl-viatura-painel-acoes');
    if (!rodape || !tpl) { if (rodape) rodape.classList.add('oculto'); return; }
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.viatura-painel-cancelar');
    if (cancelar) cancelar.addEventListener('click', aoClicarCancelar);
    ctx.btnSalvar = rodape.querySelector('.viatura-painel-salvar');
    if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    atualizarSalvar();
  }

  function aoClicarCancelar() {
    if (sujo && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.postos.descartarViatura,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { RosterWork.painel.fechar(); }
      });
    } else {
      RosterWork.painel.fechar();
    }
  }

  /* ---------- gravação (Estado/CNH/guarnição) ---------- */

  /* aoMarcador (opcional): trata respostas sem success que trazem um marcador
     (ex.: a viatura já existe em outra unidade). Devolve true se tratou. */
  function enviar(endpoint, corpo, msgFalha, aoSucesso, aoMarcador) {
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
        } else if (r && aoMarcador && aoMarcador(r)) {
          return;   /* o chamador cuidou (ex.: perguntou se transfere) */
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || msgFalha });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* data escolhida no modal para o fluxo de adicionar (carrega até o 2º passo da transferência) */
  var recalcDesde = null;

  /* grava a viatura nova; confirmar=true quando o admin aceitou transferir a que já existe */
  function enviarNovo(confirmar) {
    enviar('/rest/v1/rpc/inserir_viatura', {
      p_unidade_id: unidadeNova.unidade_id, p_prefixo: valores.prefixo, p_cnh: valores.cnh,
      p_status: valores.status, p_efetivo_min: valores.min, p_efetivo_ideal: valores.ideal,
      p_efetivo_max: valores.max, p_created_by: RosterWork.sessao.cpf(),
      p_confirmar_transferencia: !!confirmar, p_recalcular_desde: recalcDesde
    }, RosterWork.mensagens.postos.falhaAdicionar, aplicarSucessoNovo, tratarJaExiste);
  }

  /* a viatura é única no sistema: se já está em outra unidade, oferece a transferência */
  function tratarJaExiste(r) {
    if (!r.requer_transferencia) return false;
    var t = RosterWork.mensagens.postos;
    RosterWork.confirmar({
      mensagem: t.viaturaEmOutraUnidade
        .replace('{prefixo}', r.prefixo)
        .replace('{unidade}', r.unidade_atual)
        .replace('{destino}', unidadeNova.nome) + ' ' + t.impactoDistribuicao,
      textoConfirmar: 'Transferir',
      aoConfirmar: function () { enviarNovo(true); }
    });
    return true;
  }

  function salvar() {
    if (!ctx || !dadosValidos()) return;
    if (modo === 'novo') {
      /* postos alimentam a distribuição: pede a data de recálculo antes de gravar */
      RosterWork.pedirData({
        mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
        textoConfirmar: 'Adicionar',
        aoConfirmar: function (iso) { recalcDesde = iso; enviarNovo(false); }
      });
      return;
    }
    if (!sujo) return;
    var v = ctx.viatura;   // referência compartilhada com o card (mutável p/ reabrir o painel já fresco)
    RosterWork.pedirData({
      mensagem: RosterWork.mensagens.postos.impactoDistribuicao,
      textoConfirmar: RosterWork.mensagens.botoes.salvar,
      aoConfirmar: function (iso) {
        enviar('/rest/v1/rpc/atualizar_viatura', {
          p_viatura_id: v.id_viatura, p_status: valores.status, p_cnh: valores.cnh,
          p_efetivo_min: valores.min, p_efetivo_ideal: valores.ideal, p_efetivo_max: valores.max,
          p_atualizado_por: RosterWork.sessao.cpf(), p_recalcular_desde: iso
        }, RosterWork.mensagens.postos.falhaEditar, function (r) { aplicarSucesso(v, r); });
      }
    });
  }

  /* sucesso da edição: atualiza o card cirurgicamente, fecha o painel e mostra o resumo */
  function aplicarSucesso(v, r) {
    var dados = r.viatura;
    if (dados) {
      v.status = dados.status; v.cnh = dados.cnh;
      v.efetivo_minimo = dados.efetivo_minimo; v.efetivo_ideal = dados.efetivo_ideal; v.efetivo_maximo = dados.efetivo_maximo;
      if (RosterWork.paginas && RosterWork.paginas.postosViaturas && RosterWork.paginas.postosViaturas.atualizarCard) {
        RosterWork.paginas.postosViaturas.atualizarCard(v.id_viatura, v);
      }
    }
    RosterWork.painel.fechar();
    if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
  }

  /* sucesso da criação: fecha, recarrega a árvore (o novo card aparece) e mostra o resumo */
  function aplicarSucessoNovo(r) {
    RosterWork.painel.fechar();
    if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
    if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
  }

  /* transferência concluída: fecha e recarrega a árvore (a viatura sai desta unidade) */
  function aoTransferido() {
    RosterWork.painel.fechar();
    if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
  }

  /* agendou/removeu uma janela de manutenção: mantém o objeto e o card em dia
     (a manutenção ativa deixa o card como "Manutenção até DD/MM") */
  function sincronizarManutencao(em, ate) {
    if (!ctx || !ctx.viatura) return;
    ctx.viatura.em_manutencao = em;
    ctx.viatura.manutencao_ate = ate;
    if (RosterWork.paginas && RosterWork.paginas.postosViaturas && RosterWork.paginas.postosViaturas.atualizarCard) {
      RosterWork.paginas.postosViaturas.atualizarCard(ctx.viatura.id_viatura, ctx.viatura);
    }
  }

  /* ---------- excluir (ação crítica) ---------- */

  function confirmarExcluir() {
    if (!ctx || !ctx.viatura || !RosterWork.pedirData) return;
    var msg = RosterWork.mensagens.postos.confirmarExcluirViatura.replace('{prefixo}', ctx.viatura.nome || '')
      + ' ' + RosterWork.mensagens.postos.impactoDistribuicao;
    RosterWork.pedirData({
      mensagem: msg,
      textoConfirmar: RosterWork.mensagens.botoes.excluirViatura,
      confirmarPerigo: true,
      aoConfirmar: function (iso) { excluir(iso); }
    });
  }

  function excluir(recalcularDesde) {
    if (!ctx || !ctx.viatura) return;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // excluir recalcula a escala: círculo + tela travada
    RosterWork.apiFetch('/rest/v1/rpc/excluir_viatura', {
      metodo: 'POST',
      corpo: { p_admin_cpf: RosterWork.sessao.cpf(), p_viatura_id: ctx.viatura.id_viatura, p_recalcular_desde: recalcularDesde || null }
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
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postos.falhaExcluir });
        }
      })
      .catch(function () {
        if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
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
    if (RosterWork.postosViaturasTransferir && RosterWork.postosViaturasTransferir.reset) RosterWork.postosViaturasTransferir.reset();
    if (RosterWork.postosViaturasManutencao && RosterWork.postosViaturasManutencao.reset) RosterWork.postosViaturasManutencao.reset();
  }

  /* título do painel: a unidade marcada; um pelotão mostra a companhia acima */
  function tituloUnidade(unidade) {
    var nome = unidade.nome || unidade.nome_completo || '';
    if (unidade.tipo === 'PEL' && RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.pai) {
      var paiUnidade = RosterWork.arvoreUnidades.pai(unidade.unidade_id);
      if (paiUnidade && paiUnidade.nome) nome = paiUnidade.nome + ' / ' + nome;
    }
    return nome;
  }

  /* abre o painel de edição da viatura clicada (seções Manutenção/Transferir/Excluir) */
  function abrir(unidade, viatura, limparSelecao) {
    if (!RosterWork.painel || !viatura) return;
    modo = 'editar';
    aoFecharDono = (typeof limparSelecao === 'function') ? limparSelecao : null;
    ctx = { viatura: viatura, unidade: unidade, btnSalvar: null };
    valores = { status: viatura.status, cnh: viatura.cnh,
                min: viatura.efetivo_minimo, ideal: viatura.efetivo_ideal, max: viatura.efetivo_maximo };
    originais = { status: valores.status, cnh: valores.cnh, min: valores.min, ideal: valores.ideal, max: valores.max };
    sujo = false;

    /* o título é a viatura (o nome), como em Usuários; a unidade fica no subtítulo */
    RosterWork.painel.abrir({
      titulo: viatura.nome || '',
      subtitulo: textoLocal(unidade),
      aoFechar: aoFechar
    });
    secaoAtual = 'dados';
    montarAbas();
    montarCorpo();
    montarRodape();
  }

  /* abre o painel em modo criação (Adicionar viatura): Prefixo + Estado + CNH + guarnição */
  function abrirNovo(unidade) {
    if (!RosterWork.painel || !unidade) return;
    modo = 'novo';
    unidadeNova = unidade;
    ctx = { unidade: unidade, btnSalvar: null };
    valores = { prefixo: '', status: 'Ativo', cnh: null, min: null, ideal: null, max: null };
    originais = null;
    sujo = false;

    RosterWork.painel.abrir({
      titulo: 'Nova viatura',
      subtitulo: textoLocal(unidade),
      aoFechar: aoFechar
    });
    secaoAtual = 'dados';   /* criar não tem Manutenções: sem abas */
    montarCorpo();
    montarRodape();
  }

  /* guarda-de-saída: o navegador avisa ao fechar/recarregar com alteração não salva */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return sujo; });
  }

  window.RosterWork.postosViaturasPainel = { abrir: abrir, abrirNovo: abrirNovo };
})();
