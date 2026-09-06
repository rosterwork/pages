/* ============================================================
   LICENÇAS — painel "Nova licença" (modo criação, só admin)
   Unidade (seletor em árvore) -> Militar, Tipo (5 tipos; saúde própria
   mostra CID/médico), Período (máscara + calendário) e Motivo. Um
   indicador sugere fora/segue o fluxo pela regra dos 16 dias (o admin
   decide no toggle). Salva por RosterWork.afastamentosDados.inserirLicenca.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var sujo = false;
  var guardaLigado = false;
  var militarEscolhido = null;
  var tipoEscolhido = null;
  var foraDoFluxo = false;
  var overridePeloAdmin = false;
  var reqMil = 0;

  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

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

  function calcularDias(raiz) {
    var di = RosterWork.data.paraData(raiz.querySelector('#lic-inicio').value);
    var df = RosterWork.data.paraData(raiz.querySelector('#lic-fim').value);
    if (!di || !df || df < di) return null;
    return Math.round((df - di) / 86400000) + 1;
  }

  function atualizarSalvar(raiz) {
    var btn = raiz.querySelector('#lic-salvar');
    if (btn) btn.disabled = !(militarEscolhido && tipoEscolhido && calcularDias(raiz) != null);
  }

  /* aplica a decisão (foraDoFluxo) ao indicador: cor, texto e o toggle Sim/Não */
  function aplicarDecisao(raiz) {
    var box = raiz.querySelector('#lic-fluxo');
    if (!box) return;
    box.classList.toggle('atestado-fluxo--fora', foraDoFluxo);
    box.classList.toggle('atestado-fluxo--dentro', !foraDoFluxo);
    var texto = raiz.querySelector('#lic-fluxo-texto');
    if (texto) texto.textContent = foraDoFluxo
      ? RosterWork.mensagens.afastamentos.foraDoFluxo
      : RosterWork.mensagens.afastamentos.segueNoFluxo;
    var botoes = raiz.querySelectorAll('#lic-fora-toggle .aba');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.toggle('aba--ativa', (botoes[i].getAttribute('data-fora') === 'sim') === foraDoFluxo);
    }
  }

  /* indicador ao vivo: mostra os dias e sugere fora/segue pela regra dos 16 dias */
  function atualizarFluxo(raiz) {
    var dias = calcularDias(raiz);
    var box = raiz.querySelector('#lic-fluxo');
    if (box) {
      if (dias == null) {
        box.classList.add('oculto');
      } else {
        box.classList.remove('oculto');
        if (!overridePeloAdmin) foraDoFluxo = dias >= 16;
        var titulo = raiz.querySelector('#lic-fluxo-titulo');
        if (titulo) titulo.textContent = dias + (dias === 1 ? ' dia' : ' dias');
        aplicarDecisao(raiz);
      }
    }
    atualizarSalvar(raiz);
  }

  /* Tipo: dropdown estático (5 tipos); saúde própria revela CID/médico */
  function ligarTipo(raiz) {
    var gatilho = raiz.querySelector('#lic-tipo');
    var saude = raiz.querySelector('#lic-saude');
    var drop = gatilho ? gatilho.closest('.dropdown') : null;
    var itens = drop ? drop.querySelectorAll('.dropdown-item') : [];
    for (var i = 0; i < itens.length; i++) {
      itens[i].addEventListener('click', function (ev) {
        var btn = ev.currentTarget;
        tipoEscolhido = btn.getAttribute('data-tipo');
        definirTexto(gatilho, btn.textContent.trim());
        if (saude) saude.classList.toggle('oculto', tipoEscolhido !== 'propria_saude');
        sujo = true;
        atualizarSalvar(raiz);
      });
    }
  }

  function popularMilitares(raiz, unidadeId) {
    var gatilho = raiz.querySelector('#lic-militar');
    var menu = raiz.querySelector('#lic-militar-menu');
    if (!gatilho || !menu || !RosterWork.afastamentosDados) return;
    militarEscolhido = null;
    gatilho.disabled = true;
    definirTexto(gatilho, 'Carregando…', true);
    menu.textContent = '';
    atualizarSalvar(raiz);
    var req = ++reqMil;
    RosterWork.afastamentosDados.buscarEfetivo().then(function (efetivo) {
      if (req !== reqMil) return;
      menu.textContent = '';
      if (efetivo == null) {
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
    if (!militarEscolhido || !tipoEscolhido || calcularDias(raiz) == null) return;
    var ehSaude = tipoEscolhido === 'propria_saude';
    var btnSalvar = raiz.querySelector('#lic-salvar'); if (btnSalvar) btnSalvar.disabled = true;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();
    var corpo = {
      p_usuario_id: militarEscolhido,
      p_data_inicio: RosterWork.data.paraISO(raiz.querySelector('#lic-inicio').value),
      p_data_fim: RosterWork.data.paraISO(raiz.querySelector('#lic-fim').value),
      p_tipo: tipoEscolhido,
      p_fora_do_fluxo: foraDoFluxo,
      p_cid: ehSaude ? raiz.querySelector('#lic-cid').value.trim() : null,
      p_medico: ehSaude ? raiz.querySelector('#lic-medico').value.trim() : null,
      p_motivo: raiz.querySelector('#lic-motivo').value.trim(),
      p_created_by: RosterWork.sessao.cpf()
    };
    RosterWork.afastamentosDados.inserirLicenca(corpo).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      atualizarSalvar(raiz);
      if (r && r._falha === 'servidor') {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
      } else if (r && r.success) {
        sujo = false;
        if (RosterWork.painel) RosterWork.painel.fechar();
        if (RosterWork.arvoreUnidades) RosterWork.arvoreUnidades.recarregar();
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Afastamentos' });
      } else if (RosterWork.avisar) {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.afastamentos.falhaSalvarLicenca });
      }
    }).catch(function () {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      atualizarSalvar(raiz);
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  function abrirNovo() {
    if (!RosterWork.painel) return;
    sujo = false; militarEscolhido = null; tipoEscolhido = null;
    foraDoFluxo = false; overridePeloAdmin = false;
    RosterWork.afastamentoSujo = function () { return sujo; };
    RosterWork.painel.abrir({
      titulo: 'Nova licença',
      aoFechar: function () { sujo = false; RosterWork.afastamentoSujo = null; },
      aoTentarFechar: function () { if (!sujo) return false; tentarFechar(); return true; }
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
    if (inicio) inicio.addEventListener('input', function () { atualizarFluxo(raiz); });
    if (fim) fim.addEventListener('input', function () { atualizarFluxo(raiz); });

    ligarTipo(raiz);

    var toggle = raiz.querySelector('#lic-fora-toggle');
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
