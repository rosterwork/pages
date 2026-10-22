/* ============================================================
   ESCALAS — Preencher no SYSBM (o favorito)
   Roda na tela do SYSBM, não no Roster: o favorito "Preencher no
   SYSBM" (montado no painel Enviar para o SYSBM, escalas-sysbm.js)
   carrega este arquivo na página aberta. Ele lê a escala que o
   painel copiou (da área de transferência ou colada na caixa),
   confere o dia, abre a aba do pelotão (pela cidade) e preenche
   pela própria tela do SYSBM, como a pessoa faria:
   - quem já está na aba e está no Roster: ajusta horário e função;
   - quem está numa função que o Roster lança e não está no Roster:
     desmarca (as outras funções ficam como estão);
   - quem falta: entra pela linha de cima e "Adicionar Viatura".
   Nunca clica em Salvar: a pessoa confere e salva. Os textos vêm do
   geral-mensagens.js do Roster, carregado junto; as janelas são as
   do próprio navegador (alert e prompt).
   ============================================================ */
(function () {
  'use strict';

  /* o endereço deste arquivo (no site do Roster), para achar o das mensagens */
  var ESTE_ARQUIVO = document.currentScript ? document.currentScript.src : '';

  function msg() { return window.RosterWork.mensagens.escala.sysbm.favorito; }

  /* ---------- preparação ---------- */
  function carregarMensagens() {
    if (window.RosterWork && window.RosterWork.mensagens) return Promise.resolve();
    return new Promise(function (resolver, rejeitar) {
      var script = document.createElement('script');
      script.src = new URL('../componentes/js/geral-mensagens.js', ESTE_ARQUIVO).href;
      script.onload = resolver;
      script.onerror = rejeitar;
      document.body.appendChild(script);
    });
  }

  /* a tela de cadastro da escala: esta página ou um quadro dela (o SYSBM abre as telas num iframe) */
  function acharTela(janela) {
    try {
      if (janela.document.querySelector('.container_aba') && janela.jQuery) return janela;
    } catch (e) {
      return null;   // quadro de outro site
    }
    for (var i = 0; i < janela.frames.length; i++) {
      var achada = acharTela(janela.frames[i]);
      if (achada) return achada;
    }
    return null;
  }

  /* a escala copiada no Roster ({data, unidade, funcoes_roster, linhas}) ou null */
  function interpretar(texto) {
    try {
      var dados = JSON.parse(texto);
      return dados && dados.unidade && Array.isArray(dados.linhas) && Array.isArray(dados.funcoes_roster) ? dados : null;
    } catch (e) {
      return null;
    }
  }

  /* o texto copiado: da área de transferência ou, se o navegador não deixar, colado na caixa (null = fechou) */
  function lerCopiado() {
    function pedirColar() { return window.prompt(msg().colar); }
    if (!navigator.clipboard || !navigator.clipboard.readText) return Promise.resolve(pedirColar());
    return navigator.clipboard.readText()
      .then(function (texto) { return interpretar(texto) ? texto : pedirColar(); })
      .catch(pedirColar);
  }

  /* para comparar nomes: sem acento, sem espaço e sem hífen, em maiúsculas ("ABS  0055" = "ABS-0055") */
  function chaveNome(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '').toUpperCase();
  }

  function soDigitos(texto) { return String(texto || '').replace(/\D/g, ''); }

  /* ---------- preencher a aba ---------- */
  function preencher(janela, dados) {
    var $ = janela.jQuery;
    var doc = janela.document;
    var m = msg();

    /* o dia pesquisado no SYSBM tem de ser o da escala copiada */
    var campoDia = doc.querySelector('input[name="data_escala_retorno"]');
    if (!campoDia) { window.alert(m.semTela); return; }
    if (campoDia.value !== dados.data) { window.alert(m.outroDia(dados.data, campoDia.value)); return; }

    /* a aba do pelotão, pela cidade ("PB Cruzeiro do Oeste"); abrir a aba só mostra, não salva nada */
    var cidade = chaveNome(dados.unidade.cidade);
    var aba = Array.prototype.filter.call(doc.querySelectorAll('.aba'), function (a) {
      return a.id !== 'aba_obs' && chaveNome(a.textContent).indexOf(cidade) >= 0;
    })[0];
    var posto = aba ? aba.id.replace('aba_', '') : '';
    var tabela = doc.getElementById('posto_' + posto);
    if (!aba || !tabela) { window.alert(m.semAba(dados.unidade.cidade)); return; }
    $(aba).trigger('click');

    /* a viatura (tipo 0) ou a seção (tipo 1) do SYSBM pelo nome; o militar pelo RG (do GB ou do CB) */
    function acharPosto(tipo, nome) {
      var chave = chaveNome(nome);
      var opcao = Array.prototype.filter.call(doc.querySelectorAll('#vtr_secao_' + posto + '_' + tipo + ' option'), function (o) {
        return chaveNome(o.textContent) === chave;
      })[0];
      return opcao ? opcao.value : null;
    }
    function acharMilitar(rg) {
      var procurado = soDigitos(rg);
      var listas = [[janela.lista_rg, janela.lista_nomes], [janela.lista_rg_geral, janela.lista_nomes_geral]];
      for (var k = 0; k < listas.length; k++) {
        var rgs = listas[k][0] || [];
        for (var i = 0; i < rgs.length; i++) {
          if (soDigitos(rgs[i]) === procurado) return { rg: rgs[i], nome: listas[k][1][i] };
        }
      }
      return null;
    }

    /* o que já está na aba: cada militar (a caixinha "inserir_<chave>"), com a viatura e os campos dele */
    function campo(prefixo, chave) { return tabela.querySelector('[name="' + prefixo + chave + '"]'); }
    var existentes = Array.prototype.map.call(tabela.querySelectorAll('input[type="checkbox"][name^="inserir_"]'), function (caixa) {
      var chave = caixa.name.replace('inserir_', '');
      var bloco = caixa.closest('table[id^="controle_"]');
      return {
        caixa: caixa,
        bloco: bloco ? bloco.id.replace('controle_', '') : '',
        rg: soDigitos(caixa.value),
        funcao: campo('funcao_', chave),
        dt_ini: campo('dt_inicial_', chave), hr_ini: campo('hr_inicial_', chave),
        dt_fim: campo('dt_final_', chave), hr_fim: campo('hr_final_', chave),
        usado: false
      };
    });
    var doRoster = dados.funcoes_roster.map(String);
    function daFuncaoDoRoster(e) { return e.funcao && doRoster.indexOf(e.funcao.value) >= 0; }

    /* devolve true se mudou alguma coisa */
    function ajustar(e, linha) {
      var mudou = false;
      function por(el, valor) { if (el && el.value !== valor) { el.value = valor; mudou = true; } }
      if (!e.caixa.checked) { e.caixa.checked = true; mudou = true; }
      por(e.funcao, String(linha.funcao));
      por(e.dt_ini, linha.dt_ini);
      por(e.hr_ini, linha.hr_ini);
      por(e.dt_fim, linha.dt_fim);
      por(e.hr_fim, linha.hr_fim);
      return mudou;
    }

    var n = { adicionados: 0, ajustados: 0, desmarcados: 0, iguais: 0, semPosto: [], semMilitar: [] };
    var faltam = [];
    dados.linhas.forEach(function (linha) {
      var tipo = linha.tipo === 'viatura' ? '0' : '1';
      var idPosto = acharPosto(tipo, linha.posto);
      if (!idPosto) { if (n.semPosto.indexOf(linha.posto) < 0) n.semPosto.push(linha.posto); return; }
      var militar = acharMilitar(linha.rg);
      if (!militar) { if (n.semMilitar.indexOf(linha.militar) < 0) n.semMilitar.push(linha.militar); return; }
      /* a chave da viatura no SYSBM: posto + viatura + tipo */
      var bloco = posto + idPosto + tipo;
      var candidatos = existentes.filter(function (e) {
        return !e.usado && e.bloco === bloco && e.rg === soDigitos(militar.rg) && daFuncaoDoRoster(e);
      });
      var achado = candidatos.filter(function (e) { return e.funcao.value === String(linha.funcao); })[0] || candidatos[0];
      if (!achado) { faltam.push({ linha: linha, tipo: tipo, idPosto: idPosto, militar: militar }); return; }
      achado.usado = true;
      if (ajustar(achado, linha)) n.ajustados++; else n.iguais++;
    });

    /* quem sobrou numa função que o Roster lança não está na escala do Roster */
    existentes.forEach(function (e) {
      if (e.usado || !e.caixa.checked || !daFuncaoDoRoster(e)) return;
      e.caixa.checked = false;
      n.desmarcados++;
    });

    /* quem falta: pela linha de cima, como a pessoa faria (a tela cria a viatura, se ainda não há) */
    var cima = {
      dt_ini: doc.getElementById('dt_ini_' + posto), hr_ini: doc.getElementById('hr_ini_' + posto),
      dt_fim: doc.getElementById('dt_fim_' + posto), hr_fim: doc.getElementById('hr_fim_' + posto),
      funcao: doc.getElementById('funcoes_' + posto)
    };
    var antes = { dt_ini: cima.dt_ini.value, hr_ini: cima.hr_ini.value, dt_fim: cima.dt_fim.value, hr_fim: cima.hr_fim.value, funcao: cima.funcao.value };
    faltam.forEach(function (f) {
      $('.tipo_vtr_' + posto + '[value="' + f.tipo + '"]').prop('checked', true);
      $('#vtr_secao_' + posto + '_' + f.tipo).multipleSelect('setSelects', [f.idPosto]);
      doc.getElementById('nome_efetivo_' + posto).value = f.militar.nome;
      doc.getElementById('rg_efetivo_' + posto).value = f.militar.rg;
      cima.dt_ini.value = f.linha.dt_ini;
      cima.hr_ini.value = f.linha.hr_ini;
      cima.dt_fim.value = f.linha.dt_fim;
      cima.hr_fim.value = f.linha.hr_fim;
      cima.funcao.value = String(f.linha.funcao);
      $('#botao_adicionar_' + posto).trigger('click');
      n.adicionados++;
    });

    /* a linha de cima volta como estava (VTR, nada escolhido) */
    $('#vtr_secao_' + posto + '_0').multipleSelect('setSelects', []);
    $('#vtr_secao_' + posto + '_1').multipleSelect('setSelects', []);
    $('.tipo_vtr_' + posto + '[value="0"]').prop('checked', true).trigger('change');
    Object.keys(antes).forEach(function (k) { cima[k].value = antes[k]; });

    /* a viatura fica marcada se tem alguém marcado nela */
    Array.prototype.forEach.call(tabela.querySelectorAll('table[id^="controle_"]'), function (bloco) {
      var caixaViatura = bloco.querySelector('input[name="viatura[]"]');
      if (caixaViatura) caixaViatura.checked = !!bloco.querySelector('input[type="checkbox"][name^="inserir_"]:checked');
    });

    window.alert(m.resumo(aba.textContent.trim(), n));
  }

  /* ---------- começo ---------- */
  carregarMensagens().then(function () {
    var janela = acharTela(window);
    if (!janela) { window.alert(msg().semTela); return null; }
    return lerCopiado().then(function (texto) {
      if (texto === null) return;
      var dados = interpretar(texto);
      if (!dados) { window.alert(msg().naoEhEscala); return; }
      preencher(janela, dados);
    });
  }).catch(function () {});
})();
