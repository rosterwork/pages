/* ============================================================
   ESCALAS — Preencher no SYSBM (o favorito)
   Roda na tela do SYSBM, não no Roster: o favorito "Preencher no
   SYSBM" (montado no painel Enviar para o SYSBM, escalas-sysbm.js)
   carrega este arquivo na página principal do SYSBM, que abre as
   telas num quadro (iframe) e não recarrega. Ele lê a escala que o
   painel copiou (da área de transferência ou colada na caixa), abre
   o Cadastrar da escala pelo menu, pesquisa o dia, abre a aba do
   pelotão (pela cidade) e preenche pela própria tela, como a pessoa
   faria:
   - quem já está na aba e está no Roster: ajusta horário e função;
   - quem está numa função que o Roster lança (ou no nome antigo
     dela) e não está no Roster: desmarca (as outras ficam);
   - quem falta: entra pela linha de cima e "Adicionar Viatura";
   - as viaturas e as linhas ficam na ordem do Roster.
   Nunca clica em Salvar: a pessoa confere e salva. Os textos vêm do
   geral-mensagens.js do Roster, carregado junto; as janelas são as
   do próprio navegador (alert, confirm e prompt).
   ============================================================ */
(function () {
  'use strict';

  /* o endereço deste arquivo (no site do Roster), para achar o das mensagens */
  var ESTE_ARQUIVO = document.currentScript ? document.currentScript.src : '';
  var ESPERA_MAXIMA = 20000;   // ms esperando o SYSBM abrir ou pesquisar a tela
  var PASSO_ESPERA = 200;
  var EXTRA = '40';            // Voluntário Extrajornada (DEAEV): por último na Central

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

  /* ---------- chegar à tela de cadastro, no dia da escala ---------- */
  /* esta página ou um quadro dela que passa no teste (quadro de outro site não conta) */
  function acharQuadro(janela, teste) {
    try {
      if (teste(janela)) return janela;
    } catch (e) {
      return null;
    }
    for (var i = 0; i < janela.frames.length; i++) {
      var achada = acharQuadro(janela.frames[i], teste);
      if (achada) return achada;
    }
    return null;
  }

  /* a tela de cadastro da escala, já carregada (a busca "Data da escala"; depois de pesquisar, as abas) */
  function eCadastro(janela) {
    return janela.document.readyState === 'complete' && !!janela.jQuery && !!janela.jQuery.fn.multipleSelect
      && !!janela.document.querySelector('input[name="data_escala"]');
  }

  /* o dia que a tela mostra ("" antes de pesquisar) */
  function diaPesquisado(janela) {
    var campo = janela.document.querySelector('input[name="data_escala_retorno"]');
    return campo ? campo.value : '';
  }

  /* repete a condição até ela devolver algo (a resposta) ou o tempo acabar (null) */
  function esperar(condicao) {
    return new Promise(function (resolver) {
      var inicio = Date.now();
      (function olhar() {
        var valor = null;
        try { valor = condicao(); } catch (e) { valor = null; }
        if (valor) { resolver(valor); return; }
        if (Date.now() - inicio > ESPERA_MAXIMA) { resolver(null); return; }
        setTimeout(olhar, PASSO_ESPERA);
      })();
    });
  }

  /* pesquisa o dia (o mesmo que digitar a data e clicar em Pesquisar) e espera as abas desse dia */
  function pesquisar(janela, dia) {
    var campo = janela.document.querySelector('input[name="data_escala"]');
    var rascunho = janela.document.querySelector('input[name="data_rascunho"]');
    campo.value = dia;
    if (rascunho) rascunho.value = '';
    campo.form.submit();
    return esperar(function () {
      return acharQuadro(window, function (j) { return eCadastro(j) && diaPesquisado(j) === dia; });
    });
  }

  /* devolve a tela de cadastro no dia da escala, ou null (já avisou o porquê) */
  function chegarAoCadastro(dia) {
    var m = msg();
    var tela = acharQuadro(window, eCadastro);
    if (tela && diaPesquisado(tela) === dia) return Promise.resolve(tela);
    /* a tela aberta em outro dia: pesquisar perde o que não foi salvo nela */
    if (tela && diaPesquisado(tela) && !window.confirm(m.trocarDia(diaPesquisado(tela), dia))) return Promise.resolve(null);
    var aberta;
    if (tela) {
      aberta = Promise.resolve(tela);
    } else {
      /* o Cadastrar do menu (Guarnição, Gerenciar Escala, Cadastrar): o mesmo clique da pessoa */
      var link = document.querySelector('[item-href*="sc_apl_menu=escala_super"]');
      if (!link) { window.alert(m.semMenu); return Promise.resolve(null); }
      link.click();
      aberta = esperar(function () { return acharQuadro(window, eCadastro); });
    }
    return aberta.then(function (janela) {
      if (!janela) return null;
      return diaPesquisado(janela) === dia ? janela : pesquisar(janela, dia);
    }).then(function (janela) {
      if (!janela) window.alert(m.demorou);
      return janela;
    });
  }

  /* ---------- preencher a aba ---------- */
  function preencher(janela, dados) {
    var $ = janela.jQuery;
    var doc = janela.document;
    var m = msg();

    /* a aba do pelotão, pela cidade ("PB Cruzeiro do Oeste"); abrir a aba só mostra, não salva nada */
    var cidade = chaveNome(dados.unidade.cidade);
    var aba = Array.prototype.filter.call(doc.querySelectorAll('.aba'), function (a) {
      return a.id !== 'aba_obs' && chaveNome(a.textContent).indexOf(cidade) >= 0;
    })[0];
    var posto = aba ? aba.id.replace('aba_', '') : '';
    var tabela = doc.getElementById('posto_' + posto);
    if (!aba || !tabela) { window.alert(m.semAba(dados.unidade.cidade)); return; }
    $(aba).trigger('click');

    var n = { adicionados: 0, ajustados: 0, desmarcados: 0, iguais: 0, semPosto: [], semMilitar: [], pelonumero: [] };

    /* a viatura (tipo 0) ou a seção (tipo 1) do SYSBM pelo nome; a viatura com outro prefixo lá
       (ATP-10732 × ABS 10732) casa pelo número, se só uma viatura do SYSBM tem esse número */
    function acharPosto(tipo, nome) {
      var opcoes = Array.prototype.slice.call(doc.querySelectorAll('#vtr_secao_' + posto + '_' + tipo + ' option'));
      var chave = chaveNome(nome);
      var igual = opcoes.filter(function (o) { return chaveNome(o.textContent) === chave; })[0];
      if (igual) return igual.value;
      var numero = soDigitos(nome);
      if (tipo !== '0' || !numero) return null;
      var mesmoNumero = opcoes.filter(function (o) { return soDigitos(o.textContent) === numero; });
      var ids = mesmoNumero.map(function (o) { return o.value; }).filter(function (v, i, lista) { return lista.indexOf(v) === i; });
      if (ids.length !== 1) return null;
      var aviso = m.pelonumero(nome, mesmoNumero[0].textContent.replace(/\s+/g, ' ').trim());
      if (n.pelonumero.indexOf(aviso) < 0) n.pelonumero.push(aviso);
      return ids[0];
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

    /* o que já está na aba: cada militar (a caixinha "inserir_<chave>"), com a viatura, a linha e os campos dele */
    function campo(prefixo, chave) { return tabela.querySelector('[name="' + prefixo + chave + '"]'); }
    var existentes = Array.prototype.map.call(tabela.querySelectorAll('input[type="checkbox"][name^="inserir_"]'), function (caixa) {
      var chave = caixa.name.replace('inserir_', '');
      var bloco = caixa.closest('table[id^="controle_"]');
      return {
        caixa: caixa,
        tr: caixa.closest('tr'),
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

    /* devolve true se mudou alguma coisa (o Chefe de Linha vira Auxiliar de Guarnição aqui) */
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

    /* cada linha do Roster: a viatura dela no SYSBM e a linha da tela que ela ocupa (achada ou a adicionar) */
    var ordemBlocos = [];
    var doBloco = {};   // chave da viatura → linhas do Roster nela, na ordem do Roster
    var faltam = [];
    dados.linhas.forEach(function (linha) {
      var tipo = linha.tipo === 'viatura' ? '0' : '1';
      var idPosto = acharPosto(tipo, linha.posto);
      if (!idPosto) { if (n.semPosto.indexOf(linha.posto) < 0) n.semPosto.push(linha.posto); return; }
      var militar = acharMilitar(linha.rg);
      if (!militar) { if (n.semMilitar.indexOf(linha.militar) < 0) n.semMilitar.push(linha.militar); return; }
      /* a chave da viatura no SYSBM: posto + viatura + tipo */
      var bloco = posto + idPosto + tipo;
      if (!doBloco[bloco]) { doBloco[bloco] = []; ordemBlocos.push(bloco); }
      var item = { linha: linha, tipo: tipo, idPosto: idPosto, militar: militar, bloco: bloco, tr: null };
      doBloco[bloco].push(item);
      var candidatos = existentes.filter(function (e) {
        return !e.usado && e.bloco === bloco && e.rg === soDigitos(militar.rg) && daFuncaoDoRoster(e);
      });
      var achado = candidatos.filter(function (e) { return e.funcao.value === String(linha.funcao); })[0] || candidatos[0];
      if (!achado) { faltam.push(item); return; }
      achado.usado = true;
      item.tr = achado.tr;
      if (ajustar(achado, linha)) n.ajustados++; else n.iguais++;
    });

    /* quem sobrou numa função que o Roster lança (ou no nome antigo dela) não está na escala do Roster */
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
      /* a linha nova é a última da viatura */
      var tabelaBloco = doc.getElementById('controle_' + f.bloco);
      var linhasBloco = tabelaBloco ? tabelaBloco.tBodies[0].rows : [];
      f.tr = linhasBloco.length ? linhasBloco[linhasBloco.length - 1] : null;
      n.adicionados++;
    });

    /* a linha de cima volta como estava (VTR, nada escolhido) */
    $('#vtr_secao_' + posto + '_0').multipleSelect('setSelects', []);
    $('#vtr_secao_' + posto + '_1').multipleSelect('setSelects', []);
    $('.tipo_vtr_' + posto + '[value="0"]').prop('checked', true).trigger('change');
    Object.keys(antes).forEach(function (k) { cima[k].value = antes[k]; });

    ordenar(tabela, ordemBlocos, doBloco);

    /* a viatura fica marcada se tem alguém marcado nela */
    Array.prototype.forEach.call(tabela.querySelectorAll('table[id^="controle_"]'), function (bloco) {
      var caixaViatura = bloco.querySelector('input[name="viatura[]"]');
      if (caixaViatura) caixaViatura.checked = !!bloco.querySelector('input[type="checkbox"][name^="inserir_"]:checked');
    });

    window.alert(m.resumo(aba.textContent.trim(), n));
  }

  /* ---------- a ordem do Roster ---------- */
  /* as viaturas na ordem do Roster e, no fim, as que ele não conhece; dentro de cada uma, as linhas do Roster,
     depois as que só o SYSBM tem (Cabo de Dia, Sobreaviso), os extras e as desmarcadas. Só move o que já está
     na tela; a primeira linha da viatura leva as células dela (as de "rowspan"), como no arrastar do SYSBM */
  function ordenar(tabela, ordemBlocos, doBloco) {
    var corpo = tabela.tBodies[0];
    if (!corpo) return;
    var linhasViatura = Array.prototype.filter.call(corpo.rows, function (tr) { return tr.querySelector('table[id^="controle_"]'); });
    function chaveDa(tr) { return tr.querySelector('table[id^="controle_"]').id.replace('controle_', ''); }
    var conhecidas = ordemBlocos.map(function (chave) {
      return linhasViatura.filter(function (tr) { return chaveDa(tr) === chave; })[0];
    }).filter(Boolean);
    var outras = linhasViatura.filter(function (tr) { return conhecidas.indexOf(tr) < 0; });
    conhecidas.concat(outras).forEach(function (tr) { corpo.appendChild(tr); });

    conhecidas.forEach(function (tr) {
      var chave = chaveDa(tr);
      var corpoBloco = tr.querySelector('table[id^="controle_"]').tBodies[0];
      var militares = Array.prototype.filter.call(corpoBloco.rows, function (l) { return l.querySelector('input[name^="inserir_"]'); });
      var itens = doBloco[chave] || [];
      var doRoster = itens.filter(function (i) { return i.tr && String(i.linha.funcao) !== EXTRA; }).map(function (i) { return i.tr; });
      var extras = itens.filter(function (i) { return i.tr && String(i.linha.funcao) === EXTRA; }).map(function (i) { return i.tr; });
      var marcada = function (l) { return l.querySelector('input[name^="inserir_"]').checked; };
      var soSysbm = militares.filter(function (l) { return doRoster.indexOf(l) < 0 && extras.indexOf(l) < 0 && marcada(l); });
      var desmarcadas = militares.filter(function (l) { return doRoster.indexOf(l) < 0 && extras.indexOf(l) < 0 && !marcada(l); });
      var nova = doRoster.concat(soSysbm, extras, desmarcadas);
      if (!nova.length) return;
      var celulas = Array.prototype.slice.call(corpoBloco.querySelectorAll('td[class^="rowspan_"]'));
      celulas.forEach(function (td) { td.parentNode.removeChild(td); });
      nova.forEach(function (l) { corpoBloco.appendChild(l); });
      celulas.reverse().forEach(function (td) {
        td.setAttribute('rowspan', String(nova.length));
        nova[0].insertBefore(td, nova[0].firstChild);
      });
    });
  }

  /* ---------- começo ---------- */
  carregarMensagens().then(function () {
    return lerCopiado();
  }).then(function (texto) {
    if (texto === null) return null;
    var dados = interpretar(texto);
    if (!dados) { window.alert(msg().naoEhEscala); return null; }
    return chegarAoCadastro(dados.data).then(function (janela) {
      if (janela) preencher(janela, dados);
    });
  }).catch(function () {});
})();
