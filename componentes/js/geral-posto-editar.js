/* ============================================================
   COMPONENTE geral-posto-editar — os campos de edição de um posto
   Usado no Editar posto do painel do dia da Escala e no painel de
   Postos (viatura e instalação). Duas partes; quem usa põe cada
   uma numa caixa e decide quando salvar:
   - efetivo(valores, aoMudar): mínimo, ideal e máximo lado a lado
     (o mínimo vai de 0 a 10; ideal e máximo, de 1 a 10).
   - viatura(opcoes): o prefixo e a CNH (A a E). Com comDatas, o
     "A partir de" e o "Até" aparecem quando um dos dois muda (sem o
     Até, a troca é para sempre); o aviso amarelo diz se o prefixo já
     está em outro posto naqueles dias, em qualquer unidade (RPC
     viatura_prefixo_em_uso; só avisa, não trava).
   Moldes no index.html (#tpl-posto-editar-efetivo e -viatura).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var MINIMOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var DEMAIS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var FORMATO_PREFIXO = /^[A-Z]+-[0-9]+$/;

  function msg() { return RosterWork.mensagens.postoEditar; }

  /* escreve o valor no gatilho .campo-selecao; vazio = estilo placeholder */
  function definirTexto(gatilho, texto, vazio) {
    var alvo = gatilho && gatilho.querySelector('.campo-selecao-texto');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.classList.toggle('campo-selecao-texto--vazio', !!vazio);
  }

  /* ---------- efetivo ---------- */

  /* valores = { min, ideal, max } (null = ainda não escolhido); aoMudar(valores) a cada escolha.
     Devolve { el, valores(), valido() } */
  function efetivo(valores, aoMudar) {
    var atual = { min: valores.min, ideal: valores.ideal, max: valores.max };
    var el = RosterWork.tpl('tpl-posto-editar-efetivo');
    if (!el) return null;
    ['min', 'ideal', 'max'].forEach(function (chave) {
      var campo = el.querySelector('[data-efetivo="' + chave + '"]');
      if (!campo) return;
      var gatilho = campo.querySelector('.campo-selecao');
      var vazio = atual[chave] == null;
      definirTexto(gatilho, vazio ? 'Selecione' : String(atual[chave]), vazio);
      var menu = campo.querySelector('.dropdown-menu');
      if (menu && RosterWork.dropdownNumeros) {
        RosterWork.dropdownNumeros.preencher(menu, {
          opcoes: chave === 'min' ? MINIMOS : DEMAIS,
          valor: atual[chave],
          aoEscolher: function (v) {
            atual[chave] = v;
            definirTexto(gatilho, String(v));
            if (aoMudar) aoMudar(copia());
          }
        });
      }
    });
    function copia() { return { min: atual.min, ideal: atual.ideal, max: atual.max }; }
    /* os três preenchidos e na ordem mínimo ≤ ideal ≤ máximo */
    function valido() {
      return atual.min != null && atual.ideal != null && atual.max != null &&
        atual.min <= atual.ideal && atual.ideal <= atual.max;
    }
    return { el: el, valores: copia, valido: valido };
  }

  /* ---------- viatura ---------- */

  /* opcoes = { viaturaId, prefixo, cnh, comDatas, dataPadrao (AAAA-MM-DD), aoMudar() }.
     Devolve { el, valores(): { prefixo, cnh, inicio, fim, mudou }, valido() } */
  function viatura(opcoes) {
    var inicial = { prefixo: opcoes.prefixo || '', cnh: opcoes.cnh || null };
    var atual = { prefixo: inicial.prefixo, cnh: inicial.cnh };
    var el = RosterWork.tpl('tpl-posto-editar-viatura');
    if (!el) return null;
    var inputPrefixo = el.querySelector('[data-viatura-prefixo]');
    var seletorCnh = el.querySelector('[data-viatura-cnh]');
    var blocoDatas = el.querySelector('[data-viatura-datas]');
    var inputInicio = el.querySelector('[data-viatura-inicio]');
    var inputFim = el.querySelector('[data-viatura-fim]');
    var aviso = el.querySelector('[data-viatura-aviso]');
    var consulta = 0;      // só a última consulta do aviso desenha
    var espera = null;     // a consulta espera o admin parar de digitar

    inputPrefixo.value = atual.prefixo;
    marcarCnh(atual.cnh);

    function marcarCnh(valor) {
      var abas = seletorCnh.querySelectorAll('.aba');
      for (var i = 0; i < abas.length; i++) abas[i].classList.toggle('aba--ativa', abas[i].getAttribute('data-valor') === valor);
    }

    function mudou() { return atual.prefixo !== inicial.prefixo || atual.cnh !== inicial.cnh; }
    function prefixoValido() { return FORMATO_PREFIXO.test(atual.prefixo); }
    function iso(input) { return RosterWork.data.paraISO(input.value); }

    /* as datas aparecem quando o prefixo ou a CNH mudam; na primeira vez, o "A partir de" já vem com a data padrão */
    function mostrarDatas() {
      if (!opcoes.comDatas) return;
      var mostrar = mudou();
      if (mostrar && blocoDatas.classList.contains('oculto') && !inputInicio.value && opcoes.dataPadrao) {
        inputInicio.value = RosterWork.data.isoParaBR(opcoes.dataPadrao);
      }
      blocoDatas.classList.toggle('oculto', !mostrar);
    }

    /* o aviso amarelo: o prefixo novo já está em outro posto em algum dia da troca */
    function conferirUso() {
      var meu = ++consulta;
      if (espera) clearTimeout(espera);
      var inicio = iso(inputInicio), fim = iso(inputFim);
      if (!opcoes.comDatas || atual.prefixo === inicial.prefixo || !prefixoValido() || !inicio) {
        aviso.classList.add('oculto');
        return;
      }
      espera = setTimeout(function () {
        RosterWork.apiFetch('/rest/v1/rpc/viatura_prefixo_em_uso', {
          metodo: 'POST',
          corpo: { p_viatura_id: opcoes.viaturaId || null, p_prefixo: atual.prefixo, p_inicio: inicio, p_fim: fim }
        })
          .then(function (resp) { return resp.ok ? resp.json() : []; })
          .then(function (lista) {
            if (meu !== consulta) return;
            var frases = (lista || []).map(function (u) {
              var unidade = u.unidade || '';
              if (u.inicio === u.fim) {
                return msg().emUsoDia.replace('{prefixo}', atual.prefixo).replace('{unidade}', unidade)
                  .replace('{data}', RosterWork.data.isoParaBR(u.inicio));
              }
              return msg().emUsoPeriodo.replace('{prefixo}', atual.prefixo).replace('{unidade}', unidade)
                .replace('{inicio}', RosterWork.data.isoParaBR(u.inicio)).replace('{fim}', RosterWork.data.isoParaBR(u.fim));
            });
            aviso.querySelector('.nota-texto').textContent = frases.join(' ');
            aviso.classList.toggle('oculto', !frases.length);
          })
          .catch(function () { if (meu === consulta) aviso.classList.add('oculto'); });
      }, 400);
    }

    function mudar() {
      mostrarDatas();
      conferirUso();
      if (opcoes.aoMudar) opcoes.aoMudar();
    }

    /* prefixo: texto livre em caixa-alta, no formato LETRAS-NÚMERO */
    inputPrefixo.addEventListener('input', function () {
      var pos = inputPrefixo.selectionStart;
      inputPrefixo.value = inputPrefixo.value.toUpperCase();
      try { inputPrefixo.setSelectionRange(pos, pos); } catch (e) {}
      atual.prefixo = inputPrefixo.value.trim();
      mudar();
    });
    /* CNH: as cinco letras lado a lado, um clique (a escolhida fica marcada pelo geral-abas) */
    if (RosterWork.abas) {
      RosterWork.abas.ligar(seletorCnh, function (aba) {
        atual.cnh = aba.getAttribute('data-valor');
        mudar();
      });
    }
    /* datas: máscara + calendário, do jeito padrão */
    [inputInicio, inputFim].forEach(function (input) {
      if (RosterWork.campos) RosterWork.campos.ligarData(input);
      input.addEventListener('input', function () { conferirUso(); if (opcoes.aoMudar) opcoes.aoMudar(); });
    });

    function valores() {
      return { prefixo: atual.prefixo, cnh: atual.cnh, inicio: iso(inputInicio), fim: iso(inputFim), mudou: mudou() };
    }
    /* prefixo no formato e CNH escolhida; com troca, o "A partir de" válido e o "Até" vazio ou depois dele */
    function valido() {
      if (!prefixoValido() || !atual.cnh) return false;
      if (!opcoes.comDatas || !mudou()) return true;
      var inicio = iso(inputInicio);
      if (!inicio) return false;
      if (!inputFim.value) return true;
      var fim = iso(inputFim);
      return !!fim && fim >= inicio;
    }
    return { el: el, valores: valores, valido: valido };
  }

  window.RosterWork.postoEditar = { efetivo: efetivo, viatura: viatura };
})();
