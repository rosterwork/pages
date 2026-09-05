/* ============================================================
   ATESTADOS — painel "Novo atestado" (modo criação, só admin)
   Abre o painel direito (geral-painel) clonando o formulário:
   Unidade (seletor em árvore, modo único) → Militar (efetivo da
   unidade), Período (início/fim com máscara + calendário) e os
   dados (CID, médico, motivo). Um indicador mostra ao vivo se o
   atestado segue no fluxo (≤15 dias) ou sai dele (≥16). Salva por
   RosterWork.atestadosDados.inserirAtestado e abre o resumo.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var sujo = false;             // há alterações não salvas?
  var guardaLigado = false;     // beforeunload registrado (uma vez só)
  var militarEscolhido = null;  // usuario_id do militar
  var foraDoFluxo = false;      // decisão atual: tira o militar do fluxo da escala?
  var overridePeloAdmin = false;// o admin mexeu no toggle? (aí não re-sugere pelos dias)
  var reqMil = 0;               // token do seletor de militar: ignora resposta antiga ao trocar de unidade rápido

  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* datas (máscara/parse/ISO/BR): consolidadas em componentes/js/geral-data.js (RosterWork.data) */

  /* aplica a máscara preservando a posição do cursor */
  function ligarMascaraData(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var pos = input.selectionStart;
      var digitosAntes = RosterWork.data.soDigitos(input.value.substring(0, pos)).length;
      var formatado = RosterWork.data.mascararData(input.value);
      input.value = formatado;
      var novaPos = 0, cont = 0;
      for (var i = 0; i < formatado.length; i++) {
        if (/\d/.test(formatado[i])) { cont++; if (cont === digitosAntes) { novaPos = i + 1; break; } }
      }
      if (cont < digitosAntes) novaPos = formatado.length;
      input.setSelectionRange(novaPos, novaPos);
    });
  }

  /* abre o calendário (geral-calendario) mantendo a digitação com máscara */
  function ligarCalendarioData(input) {
    if (!input || !RosterWork.calendario) return;
    RosterWork.calendario.ligar(input, {
      obterData: function () { return RosterWork.data.paraData(input.value); },
      aoEscolher: function (data) {
        input.value = RosterWork.data.paraBR(data);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  /* dias entre início e fim (inclusivo) a partir dos inputs; null se inválido/incompleto */
  function calcularDias(raiz) {
    var di = RosterWork.data.paraData(raiz.querySelector('#at-inicio').value);
    var df = RosterWork.data.paraData(raiz.querySelector('#at-fim').value);
    if (!di || !df || df < di) return null;
    return Math.round((df - di) / 86400000) + 1;
  }

  /* Salvar habilita com militar escolhido + datas válidas (início ≤ fim) */
  function atualizarSalvar(raiz) {
    var btn = raiz.querySelector('#at-salvar');
    if (btn) btn.disabled = !(militarEscolhido && calcularDias(raiz) != null);
  }

  /* aplica a decisão (foraDoFluxo) ao indicador: cor, texto e o toggle Sim/Não */
  function aplicarDecisao(raiz) {
    var box = raiz.querySelector('#at-fluxo');
    if (!box) return;
    box.classList.toggle('atestado-fluxo--fora', foraDoFluxo);
    box.classList.toggle('atestado-fluxo--dentro', !foraDoFluxo);
    var texto = raiz.querySelector('#at-fluxo-texto');
    if (texto) texto.textContent = foraDoFluxo
      ? RosterWork.mensagens.atestados.foraDoFluxo
      : RosterWork.mensagens.atestados.segueNoFluxo;
    var botoes = raiz.querySelectorAll('#at-fora-toggle .aba');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.toggle('aba--ativa', (botoes[i].getAttribute('data-fora') === 'sim') === foraDoFluxo);
    }
  }

  /* indicador ao vivo: mostra os dias e sugere fora/segue pela regra dos 16 dias —
     a menos que o admin já tenha decidido no toggle (aí respeita a escolha) */
  function atualizarFluxo(raiz) {
    var dias = calcularDias(raiz);
    var box = raiz.querySelector('#at-fluxo');
    if (box) {
      if (dias == null) {
        box.classList.add('oculto');
      } else {
        box.classList.remove('oculto');
        if (!overridePeloAdmin) foraDoFluxo = dias >= 16;
        var titulo = raiz.querySelector('#at-fluxo-titulo');
        if (titulo) titulo.textContent = dias + (dias === 1 ? ' dia' : ' dias');
        aplicarDecisao(raiz);
      }
    }
    atualizarSalvar(raiz);
  }

  /* popula o militar com o efetivo da unidade escolhida (buscar_efetivo filtrado por lotação) */
  function popularMilitares(raiz, unidadeId) {
    var gatilho = raiz.querySelector('#at-militar');
    var menu = raiz.querySelector('#at-militar-menu');
    if (!gatilho || !menu || !RosterWork.atestadosDados) return;
    militarEscolhido = null;
    gatilho.disabled = true;
    definirTexto(gatilho, 'Carregando…', true);
    menu.textContent = '';
    atualizarSalvar(raiz);
    var req = ++reqMil;
    RosterWork.atestadosDados.buscarEfetivo().then(function (efetivo) {
      if (req !== reqMil) return;   // outra unidade foi escolhida enquanto carregava
      menu.textContent = '';
      if (efetivo == null) {        // falha na leitura (não confundir com unidade vazia)
        gatilho.disabled = true;
        definirTexto(gatilho, 'Erro ao carregar', true);
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        return;
      }
      var daUnidade = efetivo.filter(function (m) { return m.lotacao_atual === unidadeId; });
      var tpl = document.getElementById('tpl-atestado-militar-opcao');
      daUnidade.forEach(function (m) {
        var item = tpl ? tpl.content.cloneNode(true).firstElementChild : null;
        if (!item) return;
        item.textContent = ((m.grau_abreviacao || '') + ' ' + (m.nome_de_guerra || '')).trim();
        item.setAttribute('data-valor', m.usuario_id);
        item.addEventListener('click', function () {
          militarEscolhido = m.usuario_id;
          definirTexto(gatilho, item.textContent);
          atualizarSalvar(raiz);
        });
        menu.appendChild(item);
      });
      gatilho.disabled = daUnidade.length === 0;
      definirTexto(gatilho, daUnidade.length ? 'Selecione' : 'Sem militares na unidade', true);
    });
  }

  /* fecha o painel; confirma o descarte se houver alteração */
  function tentarFechar() {
    if (sujo && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RosterWork.mensagens.botoes.sairSemSalvar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { sujo = false; if (RosterWork.painel) RosterWork.painel.fechar(); }
      });
      return;
    }
    sujo = false;
    if (RosterWork.painel) RosterWork.painel.fechar();
  }

  function salvar(raiz) {
    if (!militarEscolhido || calcularDias(raiz) == null) return;
    var btnSalvar = raiz.querySelector('#at-salvar'); if (btnSalvar) btnSalvar.disabled = true;   // evita duplo-envio (o véu já cobre; defesa a mais)
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    var corpo = {
      p_usuario_id: militarEscolhido,
      p_data_inicio: RosterWork.data.paraISO(raiz.querySelector('#at-inicio').value),
      p_data_fim: RosterWork.data.paraISO(raiz.querySelector('#at-fim').value),
      p_fora_do_fluxo: foraDoFluxo,
      p_cid: raiz.querySelector('#at-cid').value.trim(),
      p_medico: raiz.querySelector('#at-medico').value.trim(),
      p_motivo: raiz.querySelector('#at-motivo').value.trim(),
      p_created_by: RosterWork.sessao.cpf()
    };
    RosterWork.atestadosDados.inserirAtestado(corpo).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      atualizarSalvar(raiz);   // reabilita o Salvar (no sucesso o painel fecha e o botão some)
      if (r && r._falha === 'servidor') {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
      } else if (r && r.success) {
        sujo = false;
        if (RosterWork.painel) RosterWork.painel.fechar();
        if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Afastamentos' });
      } else if (RosterWork.avisar) {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.atestados.falhaSalvar });
      }
    }).catch(function () {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      atualizarSalvar(raiz);
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  /* abre o painel Novo atestado (modo criação): clona o formulário e liga tudo */
  function abrirNovo() {
    if (!RosterWork.painel) return;
    sujo = false;
    militarEscolhido = null;
    foraDoFluxo = false;
    overridePeloAdmin = false;
    RosterWork.painel.abrir({
      titulo: 'Novo atestado',
      aoFechar: function () { sujo = false; },
      aoTentarFechar: function () { if (!sujo) return false; tentarFechar(); return true; }   // X/Esc confirmam o descarte
    });

    var corpo = RosterWork.painel.corpo();
    var rodape = RosterWork.painel.rodape();
    var tplForm = document.getElementById('tpl-atestado-novo');
    var tplAcoes = document.getElementById('tpl-atestado-novo-acoes');
    var secoesForm = [];
    if (corpo && tplForm) {
      var frag = tplForm.content.cloneNode(true);
      secoesForm = Array.prototype.slice.call(frag.children);
      corpo.appendChild(frag);
    }
    if (rodape && tplAcoes) {
      rodape.appendChild(tplAcoes.content.cloneNode(true));
      rodape.classList.remove('oculto');
    }

    var raiz = document.getElementById('painel');
    if (!raiz) return;

    /* datas: máscara + calendário + recálculo do fluxo ao vivo */
    var inicio = raiz.querySelector('#at-inicio');
    var fim = raiz.querySelector('#at-fim');
    ligarMascaraData(inicio);
    ligarMascaraData(fim);
    ligarCalendarioData(inicio);
    ligarCalendarioData(fim);
    if (inicio) inicio.addEventListener('input', function () { atualizarFluxo(raiz); });
    if (fim) fim.addEventListener('input', function () { atualizarFluxo(raiz); });

    /* decisão fora/segue: o admin pode sobrepor a sugestão dos dias */
    var toggle = raiz.querySelector('#at-fora-toggle');
    if (toggle) {
      toggle.addEventListener('click', function (evento) {
        var btn = evento.target.closest('.aba');
        if (!btn) return;
        foraDoFluxo = btn.getAttribute('data-fora') === 'sim';
        overridePeloAdmin = true;
        sujo = true;
        aplicarDecisao(raiz);
      });
    }

    /* unidade (seletor em árvore, modo único) → popula os militares da unidade */
    if (RosterWork.seletorUnidades) {
      var seletor = RosterWork.seletorUnidades.criar({
        modo: 'unico',
        dropdownEl: raiz.querySelector('#at-unidade-dropdown'),
        arvoreEl: raiz.querySelector('#at-unidade-arvore'),
        textoEl: raiz.querySelector('#at-unidade-texto'),
        aoSelecionar: function (unidade) {
          var texto = raiz.querySelector('#at-unidade-texto');
          if (texto) texto.classList.remove('campo-selecao-texto--vazio');
          popularMilitares(raiz, unidade.unidade_id);
        }
      });
      if (seletor) seletor.montarArvore();
    }

    /* marca alterações não salvas nos nós clonados (descartados ao fechar), não no
       corpo do painel — que é singleton compartilhado com as outras telas */
    secoesForm.forEach(function (no) {
      no.addEventListener('input', function () { sujo = true; });
      no.addEventListener('click', function (evento) {
        if (evento.target.closest('.dropdown-item')) sujo = true;
      });
    });

    /* guarda-de-saída: o navegador avisa ao fechar/recarregar com edição não salva */
    if (!guardaLigado && RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(function () { return sujo; });
      guardaLigado = true;
    }

    var btnCancelar = raiz.querySelector('#at-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', tentarFechar);
    var btnSalvar = raiz.querySelector('#at-salvar');
    if (btnSalvar) btnSalvar.addEventListener('click', function () { salvar(raiz); });
  }

  window.RosterWork.atestados = { abrirNovo: abrirNovo };
})();
