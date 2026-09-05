/* ============================================================
   LICENÇAS — painel "Nova licença" (modo criação, só admin)
   Espelha o painel de Férias (militar + período): Unidade (seletor
   em árvore, modo único) → Militar (efetivo da unidade) e Período
   (início/fim com máscara + calendário). Salva por
   RosterWork.licencasDados.inserirLicenca e abre o resumo.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var sujo = false;
  var guardaLigado = false;
  var militarEscolhido = null;
  var reqMil = 0;   // token do seletor de militar: ignora resposta antiga ao trocar de unidade rápido

  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* dias entre início e fim (inclusivo); null se inválido/incompleto */
  function calcularDias(raiz) {
    var di = RosterWork.data.paraData(raiz.querySelector('#lic-inicio').value);
    var df = RosterWork.data.paraData(raiz.querySelector('#lic-fim').value);
    if (!di || !df || df < di) return null;
    return Math.round((df - di) / 86400000) + 1;
  }

  function atualizarSalvar(raiz) {
    var btn = raiz.querySelector('#lic-salvar');
    if (btn) btn.disabled = !(militarEscolhido && calcularDias(raiz) != null);
  }

  /* máscara de data preservando a posição do cursor (igual aos Atestados/Férias) */
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

  /* popula o militar com o efetivo da unidade escolhida */
  function popularMilitares(raiz, unidadeId) {
    var gatilho = raiz.querySelector('#lic-militar');
    var menu = raiz.querySelector('#lic-militar-menu');
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
      var tpl = document.getElementById('tpl-licenca-militar-opcao');
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
    var btnSalvar = raiz.querySelector('#lic-salvar'); if (btnSalvar) btnSalvar.disabled = true;   // evita duplo-envio (o véu já cobre; defesa a mais)
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    var corpo = {
      p_usuario_id: militarEscolhido,
      p_data_inicio: RosterWork.data.paraISO(raiz.querySelector('#lic-inicio').value),
      p_data_fim: RosterWork.data.paraISO(raiz.querySelector('#lic-fim').value),
      p_created_by: RosterWork.sessao.cpf()
    };
    RosterWork.licencasDados.inserirLicenca(corpo).then(function (r) {
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
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.geral.falhaServidor });
      }
    }).catch(function () {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      atualizarSalvar(raiz);
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  /* abre o painel Nova licença (modo criação): clona o formulário e liga tudo */
  function abrirNovo() {
    if (!RosterWork.painel) return;
    sujo = false;
    militarEscolhido = null;
    RosterWork.painel.abrir({
      titulo: 'Nova licença',
      aoFechar: function () { sujo = false; },
      aoTentarFechar: function () { if (!sujo) return false; tentarFechar(); return true; }   // X/Esc confirmam o descarte
    });

    var corpo = RosterWork.painel.corpo();
    var rodape = RosterWork.painel.rodape();
    var tplForm = document.getElementById('tpl-licenca-novo');
    var tplAcoes = document.getElementById('tpl-licenca-novo-acoes');
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

    var inicio = raiz.querySelector('#lic-inicio');
    var fim = raiz.querySelector('#lic-fim');
    ligarMascaraData(inicio);
    ligarMascaraData(fim);
    ligarCalendarioData(inicio);
    ligarCalendarioData(fim);
    if (inicio) inicio.addEventListener('input', function () { atualizarSalvar(raiz); });
    if (fim) fim.addEventListener('input', function () { atualizarSalvar(raiz); });

    /* unidade (seletor em árvore, modo único) → popula os militares da unidade */
    if (RosterWork.seletorUnidades) {
      var seletor = RosterWork.seletorUnidades.criar({
        modo: 'unico',
        dropdownEl: raiz.querySelector('#lic-unidade-dropdown'),
        arvoreEl: raiz.querySelector('#lic-unidade-arvore'),
        textoEl: raiz.querySelector('#lic-unidade-texto'),
        aoSelecionar: function (unidade) {
          var texto = raiz.querySelector('#lic-unidade-texto');
          if (texto) texto.classList.remove('campo-selecao-texto--vazio');
          popularMilitares(raiz, unidade.unidade_id);
        }
      });
      if (seletor) seletor.montarArvore();
    }

    secoesForm.forEach(function (no) {
      no.addEventListener('input', function () { sujo = true; });
      no.addEventListener('click', function (evento) {
        if (evento.target.closest('.dropdown-item')) sujo = true;
      });
    });

    if (!guardaLigado && RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(function () { return sujo; });
      guardaLigado = true;
    }

    var btnCancelar = raiz.querySelector('#lic-cancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', tentarFechar);
    var btnSalvar = raiz.querySelector('#lic-salvar');
    if (btnSalvar) btnSalvar.addEventListener('click', function () { salvar(raiz); });
  }

  window.RosterWork.licencas = { abrirNovo: abrirNovo };
})();
