/* ============================================================
   ESCALAS — Remanejar militar (o menu Editar o dia; só admin).
   Remanejar é levar o serviço do dia de um militar de uma unidade
   da companhia para outra, só naquele dia: Trazer para esta unidade
   (de outra que você administra) ou Enviar daqui para outra. O
   serviço continua sendo dele, com a mesma origem (ciclo, troca,
   pontual ou extra): não é folga nem mexe no banco de horas; a
   extra muda de lugar pela Extrajornada (o relatório de ajustes).
   Em troca, alguém da outra unidade faz o caminho contrário.
   Sub-tela em caixas de pergunta, uma depois da outra (Guia visual
   › Ações e perguntas): O que fazer, Quem (com o ícone de origem e
   o serviço dele), Em troca, Na unidade de origem (só no Enviar,
   sem troca e sem extra), Motivo e um Onde fica para cada militar
   que entra numa unidade (escalas-painel-onde.js), com a nota da
   distribuição. O dia da outra unidade vem da mesma leitura do
   painel (ler_distribuicao_dia). As listas e o caminho de volta
   ficam em escalas-painel-remanejar-listas.js. Só abre sem mudança
   não salva (escalas-painel-editar.js); o Salvar grava na hora
   (escalas-painel-salvar.js › gravarAgora) e o resumo traz o
   Desfazer, que devolve os remanejados e a extra ao lugar de antes.
   Depois, desfaz-se pelo Remover militar (Devolver).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;               // nome único para os rádios e os campos de cada abertura
  var cancelarGuarda = null;   // o guarda de saída do motivo (um Remanejar aberto por vez)

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }

  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-remanejar-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* as listas, as contas e o caminho de volta (escalas-painel-remanejar-listas.js) */
  function R() { return RosterWork.escalasPainelRemanejarListas; }

  function abrir() {
    var api = ed(), H = api.horas;
    var dados = api.dados();
    if (!dados) return;
    var uid = api.unidadeId(), iso = api.iso(), companhia = dados.contexto_id;
    /* fazer: 'trazer' | 'enviar'; destino: a unidade do Enviar; origem: a do Trazer; outraDados: a leitura do dia da
       outra unidade; item: quem vem ou vai; troca: 'sim' | 'nao'; itemTroca: quem faz o caminho contrário; sai: 'sai' |
       'fica' */
    var est = { fazer: null, destino: null, origem: null, outraDados: null, item: null, troca: null, itemTroca: null, sai: null };
    var el = {}, combo = null, comboTroca = null, ondes = {}, pedido = 0, aquiNome = '', outras = [], salvando = false;

    function outra() { return est.fazer === 'enviar' ? est.destino : est.fazer === 'trazer' ? est.origem : null; }
    /* a lista de Quem e a de Em troca: no Trazer, quem vem é da outra unidade; no Enviar, daqui */
    function dadosDeQuem() { return est.fazer === 'trazer' ? est.outraDados : dados; }
    function dadosDaTroca() { return est.fazer === 'trazer' ? dados : est.outraDados; }

    /* ---------- leitura ---------- */

    /* a outra unidade mudou: lê o dia dela, e quem dependia dela recomeça */
    function lerOutra() {
      var u = outra(), meu = ++pedido;
      est.outraDados = null; est.item = null; est.troca = null; est.itemTroca = null; est.sai = null;
      el.marcarTroca(null); el.marcarSai(null);
      preencherListas();
      atualizar();
      if (!u) return;
      RosterWork.escalasDados.lerDistribuicaoDia(u.unidade_id, iso).then(function (d) {
        if (meu !== pedido || !el.combo.isConnected) return;
        if (!d) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); return; }
        est.outraDados = d;
        preencherListas();
        atualizar();
      });
    }

    function preencherListas() {
      var dq = dadosDeQuem(), dt = dadosDaTroca();
      if (!outra()) { combo.esvaziar(); combo.habilitar(false); combo.definir(L().escolhaUnidade, true); }
      else if (!dq) { combo.esvaziar(); combo.habilitar(false); combo.definir(L().carregando, true); }
      else combo.preencher(R().deServico(dq));
      if (dt && outra()) comboTroca.preencher(R().deServico(dt).filter(function (i) { return !est.item || i.cpf !== est.item.cpf; }));
      else comboTroca.esvaziar();
    }

    /* ---------- montagem ---------- */

    function criarCombo(caixa, opcoes) {
      var inp = caixa.querySelector('input');
      inp.id = 'escala-remanejar-campo-' + (++conta);
      return RosterWork.comboMilitar.criar(inp, caixa.querySelector('.dropdown-menu'), opcoes);
    }

    /* uma lista de unidades (o Enviar para e a Unidade do Trazer): escolher põe o nome no campo */
    function montarUnidades(dropdown, aoEscolher) {
      var menu = dropdown.querySelector('.dropdown-menu');
      menu.textContent = '';
      outras.forEach(function (u) {
        var it = RosterWork.tpl('tpl-escala-unidade-item');
        if (!it) return;
        it.textContent = u.nome;
        it.addEventListener('click', function () { aoEscolher(u); });
        menu.appendChild(it);
      });
    }
    function textoUnidade(dropdown, u) {
      var t = dropdown.querySelector('.campo-selecao-texto');
      if (!t.hasAttribute('data-vazio')) t.setAttribute('data-vazio', t.textContent);
      t.textContent = u ? u.nome : t.getAttribute('data-vazio');
      t.classList.toggle('campo-selecao-texto--vazio', !u);
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-remanejar');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      el = {
        fazer: q('.escala-remanejar-fazer'), aqui: q('.escala-remanejar-aqui'), destino: q('.escala-remanejar-destino'),
        vazio: q('.escala-remanejar-vazio'), quem: q('.escala-remanejar-quem'), origemCampo: q('.escala-remanejar-origem-campo'),
        origem: q('.escala-remanejar-origem'), combo: q('.escala-remanejar-combo'), servico: q('.escala-remanejar-servico'),
        troca: q('.escala-remanejar-troca'), trocaPergunta: q('.escala-remanejar-troca-pergunta'),
        trocaCampo: q('.escala-remanejar-troca-campo'), trocaCombo: q('.escala-remanejar-troca-combo'),
        sai: q('.escala-remanejar-sai'), saiPergunta: q('.escala-remanejar-sai-pergunta'),
        saiSim: q('.escala-remanejar-sai-sim'), saiNao: q('.escala-remanejar-sai-nao'),
        motivo: q('.escala-remanejar-motivo'), ondes: q('.escala-remanejar-ondes'), nota: q('.escala-remanejar-nota')
      };
      el.campoMotivo = el.motivo.querySelector('textarea');
      el.radiosFazer = el.fazer.querySelectorAll('input[type="radio"]');
      /* o que fazer: trocar limpa o que dependia dele (o Enviar guarda a unidade escolhida ao lado) */
      el.marcarFazer = ligarRadios(el.fazer, function (v) { est.fazer = v; est.origem = null; textoUnidade(el.origem, null); lerOutra(); });
      el.marcarTroca = ligarRadios(el.troca, function (v) {
        est.troca = v;
        if (v === 'nao') est.itemTroca = null;
        if (v === 'sim') est.sai = null;
        atualizar();
      });
      el.marcarSai = ligarRadios(el.sai, function (v) { est.sai = v; atualizar(); });
      combo = criarCombo(el.combo, {
        atual: function () { return est.item; },
        aoEscolher: function (item) { est.item = item; est.itemTroca = null; est.sai = null; el.marcarSai(null); preencherListas(); atualizar(); },
        aoPerder: function () { est.item = null; },
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemNaUnidade, filtroVazio: msg().ninguemEncontrado }
      });
      comboTroca = criarCombo(el.trocaCombo, {
        atual: function () { return est.itemTroca; },
        aoEscolher: function (item) { est.itemTroca = item; atualizar(); },
        aoPerder: function () { est.itemTroca = null; },
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemNaUnidade, filtroVazio: msg().ninguemEncontrado }
      });
      el.campoMotivo.addEventListener('input', function () { if (RosterWork.campos) RosterWork.campos.limparErro(el.campoMotivo); atualizar(); });
      /* o motivo escrito e não salvo: o navegador avisa antes de sair */
      if (cancelarGuarda) cancelarGuarda();
      var campo = el.campoMotivo;
      cancelarGuarda = RosterWork.guardaSaida ? RosterWork.guardaSaida.registrar(function () {
        return document.contains(campo) && campo.value.trim() !== '';
      }) : null;
      corpo.appendChild(tela);
      preencherListas();
      atualizar();
      /* as unidades da companhia chegam depois: até lá, o O que fazer fica sem escolha */
      R().lerUnidades().then(function (lista) {
        if (!el.fazer || !el.fazer.isConnected) return;
        if (!lista) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); return; }
        var aqui = lista.filter(function (u) { return String(u.unidade_id) === String(uid); })[0];
        aquiNome = aqui ? aqui.nome : '';
        el.aqui.textContent = L().comArtigo(aquiNome);
        outras = R().outrasDe(lista, companhia, uid);
        montarUnidades(el.destino, function (u) {
          est.destino = u;
          textoUnidade(el.destino, u);
          est.fazer = 'enviar';
          el.marcarFazer('enviar');
          lerOutra();
        });
        montarUnidades(el.origem, function (u) { est.origem = u; textoUnidade(el.origem, u); lerOutra(); });
        atualizar();
      });
    }

    /* ---------- desenho ---------- */

    /* quem entra em cada unidade, cada um com o seu Onde fica: [{ chave, item, dados, unidade }] */
    function entradas() {
      var lista = [], outraNome = outra() ? outra().nome : '';
      var quemEntra = est.fazer === 'trazer'
        ? [[est.item, dados, aquiNome], [est.troca === 'sim' ? est.itemTroca : null, est.outraDados, outraNome]]
        : [[est.item, est.outraDados, outraNome], [est.troca === 'sim' ? est.itemTroca : null, dados, aquiNome]];
      quemEntra.forEach(function (x) {
        if (x[0] && x[1]) lista.push({ chave: x[0].cpf + '|' + x[2], item: x[0], dados: x[1], unidade: x[2] });
      });
      return lista;
    }

    /* as caixas Onde fica: uma por quem entra (a escolha de cada um fica enquanto ele continuar entrando ali) */
    function desenharOndes(lista) {
      Object.keys(ondes).forEach(function (k) {
        if (!lista.some(function (e) { return e.chave === k; })) { ondes[k].caixa.remove(); delete ondes[k]; }
      });
      lista.forEach(function (e) {
        var o = ondes[e.chave];
        if (!o) {
          var caixa = RosterWork.tpl('tpl-escala-onde-fica');
          if (!caixa) return;
          o = ondes[e.chave] = { caixa: caixa, e: e };
          o.comp = RosterWork.escalasPainelOnde.criar(caixa, {
            dados: function () { return o.e.dados; },
            periodos: function () { return o.e.item.janelas.map(function (j) { return { hi: j.hi, hf: j.hf }; }); },
            cpf: function () { return o.e.item.cpf; },
            aoMudar: atualizar
          });
        }
        o.e = e;
        el.ondes.appendChild(o.caixa);   // na ordem de quem entra
        mostra(o.caixa, true);
        o.comp.quem(L().ondeFicaQuem(nomeDe(e.item), e.unidade));
        o.comp.atualizar();
      });
    }

    function pronto(texto, ligado) {
      api.rotuloAplicar(texto);
      api.travarAplicar(!ligado || salvando);
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      ['quem', 'servico', 'troca', 'trocaCampo', 'sai', 'motivo', 'nota'].forEach(function (k) { mostra(el[k], false); });
      var semOutras = R().unidadesLidas() && !outras.length;
      mostra(el.vazio, semOutras);
      [].forEach.call(el.radiosFazer, function (r) { r.disabled = semOutras; });
      el.destino.querySelector('.campo-selecao').disabled = semOutras;
      var lista = [];
      var falta = (function () {
        if (!est.fazer) return L().escolhaFazer;
        if (est.fazer === 'enviar' && !est.destino) return L().escolhaUnidade;
        mostra(el.quem, true);
        mostra(el.origemCampo, est.fazer === 'trazer');
        if (!outra()) return L().escolhaUnidade;
        if (!est.item) return est.fazer === 'trazer' ? L().escolhaQuemVem : L().escolhaQuemVai;
        var deOnde = est.fazer === 'trazer' ? outra().nome : aquiNome;
        var servico = est.item.janelas.map(function (j) { return { hi: H.curta(j.hi), hf: H.curta(j.hf), origem: j.origem }; });
        el.servico.textContent = L().remanejarServico(servico, deOnde) + (R().temExtra(est.item) ? ' ' + L().remanejarExtraContinua : '');
        mostra(el.servico, true);
        /* em troca: alguém da outra unidade faz o caminho contrário */
        mostra(el.troca, true);
        el.trocaPergunta.textContent = est.fazer === 'trazer'
          ? L().remanejarTrocaTrazer(aquiNome, outra().nome) : L().remanejarTrocaEnviar(outra().nome, aquiNome);
        el.marcarTroca(est.troca);
        if (!est.troca) return L().escolhaSeTroca;
        mostra(el.trocaCampo, est.troca === 'sim');
        if (est.troca === 'sim' && !est.itemTroca) return L().escolhaMilitarTroca;
        /* na unidade de origem: só no Enviar, sem troca e sem extra */
        if (est.fazer === 'enviar' && est.troca === 'nao' && !R().temExtra(est.item)) {
          var nome = nomeDe(est.item);
          mostra(el.sai, true);
          el.saiPergunta.textContent = L().remanejarSai(nome, aquiNome);
          el.saiSim.textContent = L().remanejarSoNa(outra().nome);
          el.saiNao.textContent = L().remanejarNasDuas(aquiNome, outra().nome);
          el.marcarSai(est.sai);
          if (!est.sai) return L().escolhaSeSai;
        }
        mostra(el.motivo, true);
        lista = entradas();
        if (lista.length) {
          mostra(el.nota, true);
          el.nota.querySelector('.nota-texto').textContent = L().remanejarNota(aquiNome, outra().nome);
        }
        if (!el.campoMotivo.value.trim()) return L().escrevaMotivo;
        var faltaOnde = '';
        lista.forEach(function (e) { faltaOnde = faltaOnde || (ondes[e.chave] ? ondes[e.chave].comp.falta() : ''); });
        return faltaOnde;
      })();
      desenharOndes(lista);
      /* a caixa nova já entra com a falta dela */
      if (!falta) lista.forEach(function (e) { falta = falta || (ondes[e.chave] ? ondes[e.chave].comp.falta() : ''); });
      pronto(falta || RosterWork.mensagens.botoes.salvar, !falta);
    }

    /* ---------- salvar ---------- */

    function aplicar() {
      if (salvando || !est.item || !outra()) return;   // o botão já fica desligado enquanto falta algo
      var motivo = el.campoMotivo.value.trim();
      if (!motivo) {
        if (RosterWork.campos) RosterWork.campos.marcarErro(el.campoMotivo, L().escrevaMotivo);
        el.campoMotivo.focus();
        return;
      }
      var u = outra(), ent = entradas();
      if (ent.some(function (e) { return !ondes[e.chave] || !ondes[e.chave].comp.respondido(); })) return;
      /* os remanejamentos: quem vai ou vem e, em troca, quem faz o caminho contrário */
      var itens = [];
      function item(i, origem, destino, dadosOrigem, fica) {
        itens.push({ cpf: i.cpf, origem: Number(origem), destino: Number(destino), fica: fica, extra: R().temExtra(i), outro: R().temOutro(i), dadosOrigem: dadosOrigem });
      }
      if (est.fazer === 'trazer') {
        item(est.item, u.unidade_id, uid, est.outraDados, false);
        if (est.troca === 'sim') item(est.itemTroca, uid, u.unidade_id, dados, false);
      } else {
        item(est.item, uid, u.unidade_id, dados, est.troca === 'nao' && !R().temExtra(est.item) && est.sai === 'fica');
        if (est.troca === 'sim') item(est.itemTroca, u.unidade_id, uid, est.outraDados, false);
      }
      var ajustesAntes = JSON.parse(JSON.stringify(api.rascunho().ajustes));
      /* o dia a gravar: quem sai perde as colocações manuais de onde saiu, e cada um fica onde foi escolhido */
      var dia = api.paraGravarCom(function (r) {
        itens.forEach(function (i) { if (!i.fica) R().cortarNaOrigem(r, i.cpf, i.dadosOrigem); });
        ent.forEach(function (e) { ondes[e.chave].comp.aplicar(null); });
      });
      dia.remanejar = itens.map(function (i) { return { cpf: i.cpf, origem: i.origem, destino: i.destino, fica: i.fica, motivo: motivo }; });
      salvando = true;
      api.travarAplicar(true);
      RosterWork.escalasPainelSalvar.gravarAgora(dia, R().voltarDe(itens, ajustesAntes, motivo)).then(function (ok) {
        salvando = false;
        if (ok) { el.campoMotivo.value = ''; return; }   // gravou: o painel volta ao dia, já lido de novo
        if (el.fazer.isConnected) api.travarAplicar(false);
      });
    }

    api.abrir(L().escolhaFazer, montar, aplicar);
  }

  window.RosterWork.escalasPainelRemanejar = { abrir: abrir };
})();
