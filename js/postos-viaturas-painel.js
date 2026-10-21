/* ============================================================
   POSTOS — painel lateral de viatura: editar, criar e excluir (só
   admin). Mesmo padrão da ficha do militar: **título = o prefixo**,
   subtítulo = a unidade. Sem abas, de cima para baixo:
   - Viatura: prefixo e CNH (componente geral-posto-editar); quando
     um dos dois muda, aparecem "A partir de" e "Até" (sem o Até, a
     troca é para sempre) e o aviso de prefixo em uso em outro posto;
   - Estado (Ativo/Inativo, com data: o pedirData do Salvar);
   - Efetivo: mínimo, ideal e máximo (vale na hora, sem data);
   - Mudanças marcadas (estado, transferência e troca de viatura
     com data futura, com Cancelar — postos-mudancas.js);
   - Anteriores: as viaturas que já serviram neste posto, de X a Y;
   - Transferir (postos-viaturas-transferir.js) e Excluir viatura.
   Grava por inserir_viatura / atualizar_viatura / excluir_viatura;
   no editar atualiza o card cirurgicamente, no criar/excluir recarrega
   a árvore; confirma no geral-resumo. A viatura é **única no
   sistema**: se o prefixo já existe em outra unidade, o cadastro
   oferece a transferência. Na criação: Viatura (prefixo e CNH, sem
   datas) + Estado + Efetivo.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var aoFecharDono = null; // callback da página para tirar o realce do card ao fechar
  var modo = 'editar';     // 'editar' (card existente) | 'novo' (Adicionar viatura)
  var unidadeNova = null;  // no modo 'novo': a unidade que recebe a viatura
  var ctx = null;          // { viatura?, unidade, btnSalvar }
  var campos = null;       // { viatura, efetivo } do componente geral-posto-editar
  var valores = null;      // { status } (o Estado)
  var originais = null;    // { status, min, ideal, max } ao abrir (só no modo 'editar')
  var sujo = false;

  /* escreve o valor no gatilho .campo-selecao; vazio = estilo placeholder */
  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* o dia de serviço em curso (vira às 08h): o "A partir de" da troca já vem com ele */
  function diaDeServico() {
    var d = new Date();
    if (d.getHours() < 8) d.setDate(d.getDate() - 1);
    return RosterWork.data.paraIsoDeData(d);
  }

  /* ---------- validação ---------- */
  function dadosValidos() {
    return !!(campos && campos.viatura && campos.efetivo && campos.viatura.valido() && campos.efetivo.valido());
  }

  function mudouEfetivo() {
    var e = campos.efetivo.valores();
    return e.min !== originais.min || e.ideal !== originais.ideal || e.max !== originais.max;
  }

  /* há alteração não salva? criação = algo preenchido; edição = diferente do original */
  function recalcularSujo() {
    if (!campos || !campos.viatura || !campos.efetivo) { sujo = false; return; }
    if (modo === 'novo') {
      var v = campos.viatura.valores(), e = campos.efetivo.valores();
      sujo = !!v.prefixo || !!v.cnh || valores.status !== 'Ativo' || e.min != null || e.ideal != null || e.max != null;
      return;
    }
    sujo = valores.status !== originais.status || mudouEfetivo() || campos.viatura.valores().mudou;
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

  /* Estado: dois itens fixos (Ativo/Inativo; a reserva é Ativa com mínimo 0) */
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

  /* caixa Viatura: prefixo e CNH; na edição, com as datas da troca (componente geral-posto-editar) */
  function montarCaixaViatura() {
    var v = ctx.viatura || {};
    var caixa = RosterWork.painel.criarCaixa('Viatura');
    campos.viatura = RosterWork.postoEditar.viatura(modo === 'novo'
      ? { prefixo: '', cnh: null, comDatas: false, aoMudar: aoMudar }
      : { viaturaId: v.id_viatura, prefixo: v.hoje_prefixo || v.nome, cnh: v.hoje_cnh || v.cnh,
          comDatas: true, dataPadrao: diaDeServico(), aoMudar: aoMudar });
    if (caixa && campos.viatura) caixa.appendChild(campos.viatura.el);
    return caixa;
  }

  /* caixa Efetivo: mínimo, ideal e máximo lado a lado (o mínimo começa em 0: viatura reserva, sem erro) */
  function montarCaixaEfetivo() {
    var caixa = RosterWork.painel.criarCaixa('Efetivo');
    campos.efetivo = RosterWork.postoEditar.efetivo(modo === 'novo'
      ? { min: null, ideal: null, max: null }
      : { min: originais.min, ideal: originais.ideal, max: originais.max }, aoMudar);
    if (caixa && campos.efetivo) caixa.appendChild(campos.efetivo.el);
    return caixa;
  }

  /* Anteriores: as viaturas que já serviram neste posto, de X a Y (o grupo começa fechado) */
  function montarAnteriores() {
    var lista = (ctx.viatura && ctx.viatura.anteriores) || [];
    if (!lista.length || !RosterWork.anteriores) return null;
    var caixa = RosterWork.tpl('tpl-viatura-anteriores');
    if (!caixa) return null;
    var t = RosterWork.mensagens.postos;
    var itens = lista.map(function (a) {
      var linha = RosterWork.tpl('tpl-viatura-anterior');
      if (!linha) return null;
      linha.querySelector('.linha-info-rotulo').textContent =
        t.anteriorViatura.replace('{prefixo}', a.prefixo || '').replace('{cnh}', a.cnh || '');
      linha.querySelector('.linha-info-valor').textContent =
        t.anteriorPeriodo.replace('{inicio}', RosterWork.data.isoParaBR(a.inicio)).replace('{fim}', RosterWork.data.isoParaBR(a.fim));
      return linha;
    }).filter(Boolean);
    var botao = RosterWork.anteriores.montar(itens, false);
    if (botao) caixa.appendChild(botao);
    itens.forEach(function (el) { caixa.appendChild(el); });
    return caixa;
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

  /* corpo: Viatura · Estado · Efetivo · Mudanças marcadas · Anteriores e, na edição, Transferir e Excluir */
  function montarCorpo() {
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    corpo.textContent = '';
    if (RosterWork.postosViaturasTransferir) RosterWork.postosViaturasTransferir.reset();
    campos = {};

    var secao = RosterWork.painel.criarSecao('');
    if (secao) {
      var rotulo = secao.querySelector('.rotulo-secao');
      if (rotulo) rotulo.remove();
      var linhas = [montarCaixaViatura(), montarLinhaStatus(), montarCaixaEfetivo()];
      if (modo === 'editar') {
        /* as mudanças marcadas (estado, transferência ou troca de viatura com data futura), com Cancelar */
        if (RosterWork.postosMudancas) linhas.push(RosterWork.postosMudancas.criarLista(ctx.viatura, aoCancelarMudanca));
        linhas.push(montarAnteriores());
      }
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

  /* rodapé Cancelar / Salvar */
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

  /* alteração não salva no painel: os campos ou o destino escolhido e ainda não transferido */
  function algoNaoSalvo() {
    var T = RosterWork.postosViaturasTransferir;
    return sujo || !!(T && T.temRascunho && T.temRascunho());
  }

  /* Esc/X do painel: com alteração não salva, faz a mesma pergunta do Cancelar */
  function tentarFecharPainel() {
    if (!algoNaoSalvo()) return false;
    aoClicarCancelar();
    return true;
  }

  function aoClicarCancelar() {
    if (algoNaoSalvo() && RosterWork.confirmar) {
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

  /* ---------- gravação ---------- */

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
    var v = campos.viatura.valores(), e = campos.efetivo.valores();
    enviar('/rest/v1/rpc/inserir_viatura', {
      p_unidade_id: unidadeNova.unidade_id, p_prefixo: v.prefixo, p_cnh: v.cnh,
      p_status: valores.status, p_efetivo_min: e.min, p_efetivo_ideal: e.ideal,
      p_efetivo_max: e.max,
      p_confirmar_transferencia: !!confirmar, p_recalcular_desde: recalcDesde
    }, RosterWork.mensagens.postos.falhaAdicionar, aplicarSucessoNovo, tratarJaExiste);
  }

  /* a viatura é única no sistema: se já está em outra unidade, oferece a transferência
     (a data escolhida no Adicionar é o dia em que ela chega) */
  function tratarJaExiste(r) {
    if (!r.requer_transferencia) return false;
    var t = RosterWork.mensagens.postos;
    var dataChegada = recalcDesde ? String(recalcDesde).slice(0, 10).split('-').reverse().join('/') : '';
    RosterWork.confirmar({
      mensagem: t.viaturaEmOutraUnidade
        .replace('{prefixo}', r.prefixo)
        .replace('{unidade}', r.unidade_atual)
        .replace('{destino}', unidadeNova.nome)
        .replace('{data}', dataChegada) + ' ' + t.impactoDistribuicao,
      textoConfirmar: 'Transferir',
      aoConfirmar: function () { enviarNovo(true); }
    });
    return true;
  }

  /* grava a edição: o estado só vai quando mudou (com a data do modal); o efetivo vale na hora;
     a troca de viatura leva as datas dela */
  function enviarEdicao(v, dataEstado) {
    var e = campos.efetivo.valores();
    var troca = campos.viatura.valores();
    var corpo = {
      p_viatura_id: v.id_viatura,
      p_status: valores.status !== originais.status ? valores.status : null,
      p_efetivo_min: e.min, p_efetivo_ideal: e.ideal, p_efetivo_max: e.max,
      p_recalcular_desde: dataEstado || null
    };
    if (troca.mudou) {
      corpo.p_prefixo = troca.prefixo; corpo.p_cnh = troca.cnh;
      corpo.p_troca_inicio = troca.inicio; corpo.p_troca_fim = troca.fim;
    }
    enviar('/rest/v1/rpc/atualizar_viatura', corpo, RosterWork.mensagens.postos.falhaEditar, function (r) { aplicarSucesso(v, r); });
  }

  function salvar() {
    if (!ctx || !dadosValidos()) return;
    var t = RosterWork.mensagens.postos;
    if (modo === 'novo') {
      /* a data do modal é o primeiro dia da viatura (e refaz a escala a partir dela) */
      RosterWork.pedirData({
        mensagem: t.postoComeca + ' ' + t.impactoDistribuicao,
        textoConfirmar: 'Adicionar',
        aoConfirmar: function (iso) { recalcDesde = iso; enviarNovo(false); }
      });
      return;
    }
    if (!sujo) return;
    var v = ctx.viatura;   // referência compartilhada com o card (mutável p/ reabrir o painel já fresco)
    /* só o estado pede a data (a data em que o novo estado vale); o efetivo e a troca de viatura não */
    if (valores.status !== originais.status) {
      RosterWork.pedirData({
        mensagem: t.novoEstadoVale,
        textoConfirmar: RosterWork.mensagens.botoes.salvar,
        aoConfirmar: function (iso) { enviarEdicao(v, iso); }
      });
      return;
    }
    enviarEdicao(v, null);
  }

  /* sucesso da edição: o banco devolve a viatura fresca (a mesma linha do listar_viaturas); atualiza o card
     cirurgicamente, fecha o painel e mostra o resumo */
  function aplicarSucesso(v, r) {
    if (r.viatura) {
      Object.keys(r.viatura).forEach(function (k) { v[k] = r.viatura[k]; });
      if (RosterWork.paginas && RosterWork.paginas.postosViaturas && RosterWork.paginas.postosViaturas.atualizarCard) {
        RosterWork.paginas.postosViaturas.atualizarCard(v.id_viatura, v);
      }
    }
    RosterWork.painel.fechar();
    if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Postos' });
  }

  /* cancelou uma mudança marcada: atualiza o card, fecha o painel e mostra o resumo (como o Salvar) */
  function aoCancelarMudanca(resumoEstado, log) {
    if (!ctx || !ctx.viatura) return;
    var v = ctx.viatura;
    if (RosterWork.postosMudancas) RosterWork.postosMudancas.aplicarResumo(v, resumoEstado);
    if (RosterWork.paginas && RosterWork.paginas.postosViaturas && RosterWork.paginas.postosViaturas.atualizarCard) {
      RosterWork.paginas.postosViaturas.atualizarCard(v.id_viatura, v);
    }
    sujo = false;
    RosterWork.painel.fechar();
    if (log && RosterWork.resumo) RosterWork.resumo.abrirModal(log, { pagina: 'Postos' });
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

  /* ---------- excluir (ação crítica) ---------- */

  function confirmarExcluir() {
    if (!ctx || !ctx.viatura || !RosterWork.pedirData) return;
    var msg = RosterWork.mensagens.postos.confirmarExcluirViatura.replace('{prefixo}', ctx.viatura.nome || '');
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
      corpo: { p_viatura_id: ctx.viatura.id_viatura, p_recalcular_desde: recalcularDesde || null }
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
    campos = null;
    valores = null;
    originais = null;
    sujo = false;
    modo = 'editar';
    unidadeNova = null;
    if (RosterWork.postosViaturasTransferir && RosterWork.postosViaturasTransferir.reset) RosterWork.postosViaturasTransferir.reset();
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

  /* abre o painel de edição da viatura clicada */
  function abrir(unidade, viatura, limparSelecao) {
    if (!RosterWork.painel || !viatura) return;
    modo = 'editar';
    aoFecharDono = (typeof limparSelecao === 'function') ? limparSelecao : null;
    ctx = { viatura: viatura, unidade: unidade, btnSalvar: null };
    /* o Estado mostra como a viatura fica depois das mudanças marcadas (dá para marcar a volta) */
    valores = { status: viatura.estado_final || viatura.status };
    originais = { status: valores.status, min: viatura.efetivo_minimo, ideal: viatura.efetivo_ideal, max: viatura.efetivo_maximo };
    sujo = false;

    /* o título é a viatura (o nome), como em Usuários; a unidade fica no subtítulo */
    RosterWork.painel.abrir({
      titulo: viatura.nome || '',
      subtitulo: textoLocal(unidade),
      aoFechar: aoFechar,
      aoTentarFechar: tentarFecharPainel
    });
    montarCorpo();
    montarRodape();
  }

  /* abre o painel em modo criação (Adicionar viatura): Viatura (prefixo e CNH) + Estado + Efetivo */
  function abrirNovo(unidade) {
    if (!RosterWork.painel || !unidade) return;
    modo = 'novo';
    unidadeNova = unidade;
    ctx = { unidade: unidade, btnSalvar: null };
    valores = { status: 'Ativo' };
    originais = null;
    sujo = false;

    RosterWork.painel.abrir({
      titulo: 'Nova viatura',
      subtitulo: textoLocal(unidade),
      aoFechar: aoFechar,
      aoTentarFechar: tentarFecharPainel
    });
    montarCorpo();
    montarRodape();
  }

  /* guarda-de-saída: o navegador avisa ao fechar/recarregar com alteração não salva */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return !!(ctx && algoNaoSalvo()); });
  }

  window.RosterWork.postosViaturasPainel = { abrir: abrir, abrirNovo: abrirNovo };
})();
