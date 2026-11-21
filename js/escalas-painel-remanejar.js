/* ============================================================
   ESCALAS — Mudar de unidade neste dia (o remanejamento; só admin): o
   Enviar (o lápis da aba Militares e o nome na célula da grade) e o
   Trazer de outra unidade (o Editar o dia e o pelotão na célula), na
   sub-tela do painel do dia e na caixa 2 da célula
   (escalas-celula-editar-acoes.js), com as mesmas perguntas e o mesmo
   código.
   Remanejar é levar o serviço do dia de um militar de uma unidade
   da companhia para outra, só naquele dia: Trazer para esta unidade
   (de outra que você administra) ou Enviar daqui para outra. O
   serviço continua sendo dele, com a mesma origem (ciclo, troca,
   pontual ou extra): não é folga nem mexe no banco de horas; a
   extra muda de lugar pela Extrajornada (o relatório de ajustes).
   Em troca, alguém da outra unidade faz o caminho contrário.
   Caixas de pergunta, uma depois da outra (Guia visual › Ações e
   perguntas), só as que valem e sem o que o sistema já sabe (o Enviar
   ou o Trazer vem de onde ela foi aberta): no Enviar, Quem (o Militar,
   com o ícone de origem e o serviço dele; na caixa da célula ele já vem
   escolhido e a caixa não aparece) e Para qual unidade (as outras
   unidades da companhia que você administra; com uma só, ela já vem
   escolhida); no Trazer, Quem vem (quem está de serviço nas outras
   unidades, um grupo por unidade, com o serviço dele). Depois, Em
   troca, Na unidade de origem (sem troca e sem extra: sai ou fica nas
   duas) e um Onde fica para cada militar que entra numa unidade (escalas-painel-onde.js, sem a nota do que acontece com
   quem está em volta: o dia é refeito ao salvar); embaixo, a linha
   Conferindo a mudança e a recusa (escalas-painel-remanejar-conferir.js:
   o banco confere numa prévia das duas unidades). O dia da outra
   unidade vem da mesma
   leitura do painel (ler_distribuicao_dia). As listas ficam em
   escalas-painel-remanejar-listas.js. Sem botão próprio: com tudo
   respondido, o remanejamento entra no rascunho do Dia ao vivo
   (escalas-painel-editar.js › aoVivo); depois da primeira resposta, a
   resposta pela metade e a recusa desligam o Salvar. Depois de salvo, desfaz-se pelo Devolver
   (o lápis de quem foi para outra unidade, na aba Militares) ou pelo
   Remover do dia.
   API: RosterWork.escalasPainelRemanejar.abrir(opcoes) (a sub-tela do
   painel; opcoes = { cpf }: o Enviar, com ele escolhido, o menu da
   linha; { fazer: 'trazer' }: o Trazer, o Editar o dia), criar(opcoes,
   pendurar) (as mesmas perguntas em outro lugar, a caixa 2 da célula:
   pendurar(tela) põe a tela na página; devolve { pelaMetade(),
   marcarFalta() }), podeEnviar(cpf) (ele vai daqui para outra unidade:
   está de serviço aqui, sem estar remanejado, e você administra outra
   unidade da companhia), podeTrazer() (você administra outra unidade
   da companhia: o Trazer do pelotão na célula), prepararUnidades() e
   unidadesProntas() (as unidades da companhia, lidas uma vez, para o
   menu da linha e a caixa da célula).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios e os campos de cada abertura

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

  var unidadesLidas = null;   // as unidades da companhia (uma leitura por sessão), para o menu da linha
  var lendoUnidades = null;   // a leitura em curso (várias linhas pedem ao mesmo tempo: uma leitura só)

  function prepararUnidades() {
    if (unidadesLidas) return Promise.resolve(unidadesLidas);
    if (!lendoUnidades) {
      lendoUnidades = R().lerUnidades().then(function (lista) { lendoUnidades = null; if (lista) unidadesLidas = lista; return lista; });
    }
    return lendoUnidades;
  }

  /* você administra outra unidade da companhia do dia (o Trazer de outra unidade do pelotão na célula da grade) */
  function podeTrazer() {
    var api = ed(), d = api.dados();
    return !!d && !!unidadesLidas && R().outrasDe(unidadesLidas, d.contexto_id, api.unidadeId()).length > 0;
  }

  /* ele vai daqui para outra unidade (o menu da linha só mostra o Mudar de unidade neste dia a quem pode): está de serviço
     aqui, sem estar remanejado, e você administra outra unidade da companhia */
  function podeEnviar(cpf) {
    if (!podeTrazer()) return false;
    return R().deServico(ed().dados()).some(function (i) { return i.cpf === cpf; });
  }

  /* a sub-tela do painel. opcoes = { cpf }: o Enviar, com ele escolhido (o menu da linha); { fazer: 'trazer' }: o Trazer (o
     Trazer de outra unidade do Editar o dia) */
  function abrir(opcoes) {
    if (!ed().dados()) return;
    ed().abrir(function (corpo) { criar(opcoes, function (tela) { corpo.appendChild(tela); }); });
  }

  /* as perguntas numa tela (opcoes como no abrir); pendurar(tela) põe a tela na página (a sub-tela do painel ou a caixa 2
     da célula), antes da primeira resposta. Devolve o que a caixa da célula usa: pelaMetade() (depois da primeira
     resposta, falta uma ou o banco recusa: a caixa segura o clique fora) e marcarFalta() */
  function criar(opcoes, pendurar) {
    var api = ed(), H = api.horas;
    var dados = api.dados();
    if (!dados) return null;
    var uid = api.unidadeId(), iso = api.iso(), companhia = dados.contexto_id;
    var pedidoCpf = (opcoes && opcoes.cpf) || null;   // quem vem escolhido no Quem do Enviar
    /* fazer: 'enviar' | 'trazer' (de onde ela foi aberta); destino: a unidade do Enviar; origem: a de quem vem no Trazer;
       outraDados: a leitura do dia da outra unidade; item: quem vai ou vem; troca: 'sim' | 'nao'; itemTroca: quem faz o
       caminho contrário; sai: 'sai' | 'fica' */
    var est = { fazer: opcoes && opcoes.fazer === 'trazer' ? 'trazer' : 'enviar', destino: null, origem: null, outraDados: null,
      item: null, troca: null, itemTroca: null, sai: null };
    var diasOutras = {};       // o Trazer: a leitura do dia de cada outra unidade (unidade_id -> dados), para o Quem vem
    var respondeu = false;     // a pessoa já respondeu alguma pergunta (antes disso, nada fica pela metade)
    var metade = false, recusa = false;   // a resposta de agora: depois da primeira resposta, falta uma; o banco recusa
    var tela = null, el = {}, combo = null, comboTroca = null, ondes = {}, pedido = 0, aquiNome = '', outras = [], conf = null;
    var unidadesChegaram = false;   // as unidades da companhia já chegaram (antes disso, nem o Para qual unidade nem o aviso)

    function trazer() { return est.fazer === 'trazer'; }
    function outra() { return trazer() ? est.origem : est.destino; }
    /* a lista do Em troca: no Trazer, quem faz o caminho contrário sai daqui; no Enviar, vem da outra unidade */
    function dadosDaTroca() { return trazer() ? dados : est.outraDados; }

    /* ---------- leitura ---------- */

    /* o Enviar: a unidade de destino mudou; lê o dia dela, e quem dependia dela recomeça */
    function lerDestino() {
      var u = est.destino, meu = ++pedido;
      est.outraDados = null;
      recomecarTroca();
      preencherTroca();
      atualizar();
      if (!u) return;
      RosterWork.escalasDados.lerDistribuicaoDia(u.unidade_id, iso).then(function (d) {
        if (meu !== pedido || !tela.isConnected) return;
        if (!d) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); return; }
        est.outraDados = d;
        preencherTroca();
        atualizar();
      });
    }

    /* o Trazer: o dia de cada outra unidade, lidos juntos, para o Quem vem (quem está de serviço lá, um grupo por unidade) */
    function lerOutras() {
      var meu = ++pedido;
      combo.esvaziar();
      combo.habilitar(false);
      combo.definir(L().carregando, true);
      Promise.all(outras.map(function (u) { return RosterWork.escalasDados.lerDistribuicaoDia(u.unidade_id, iso); })).then(function (ds) {
        if (meu !== pedido || !tela.isConnected) return;
        if (ds.some(function (d) { return !d; })) {
          RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar });
          combo.definir(msg().falhaCarregar, true);
          return;
        }
        var lista = [];
        outras.forEach(function (u, i) {
          diasOutras[u.unidade_id] = ds[i];
          var itens = R().deServico(ds[i]).map(function (it) { it.unidade = u; return it; });
          if (itens.length) lista = lista.concat([{ titulo: u.nome }], itens);
        });
        combo.preencher(lista);
        atualizar();
      });
    }

    function recomecarTroca() {
      est.troca = null; est.itemTroca = null; est.sai = null;
      el.marcarTroca(null);
      el.marcarSai(null);
    }

    /* a lista do Em troca, fora quem vai */
    function preencherTroca() {
      var dt = dadosDaTroca();
      if (dt && outra()) comboTroca.preencher(R().deServico(dt).filter(function (i) { return !est.item || i.cpf !== est.item.cpf; }));
      else comboTroca.esvaziar();
    }

    /* ---------- montagem ---------- */

    function criarCombo(caixa, cfg) {
      var inp = caixa.querySelector('input');
      inp.id = 'escala-remanejar-campo-' + (++conta);
      return RosterWork.comboMilitar.criar(inp, caixa.querySelector('.dropdown-menu'), cfg);
    }

    tela = RosterWork.tpl('tpl-escala-remanejar');
    if (!tela) return null;
    var q = function (s) { return tela.querySelector(s); };
    el = {
      vazio: q('.escala-remanejar-vazio'), quem: q('.escala-remanejar-quem'), quemEnviar: q('.escala-remanejar-quem-enviar'),
      quemTrazer: q('.escala-remanejar-quem-trazer'), combo: q('.escala-remanejar-combo'), servico: q('.escala-remanejar-servico'),
      unidade: q('.escala-remanejar-unidade'), unidades: q('.escala-remanejar-unidades'),
      troca: q('.escala-remanejar-troca'), trocaPergunta: q('.escala-remanejar-troca-pergunta'),
      trocaCampo: q('.escala-remanejar-troca-campo'), trocaCombo: q('.escala-remanejar-troca-combo'),
      sai: q('.escala-remanejar-sai'), saiPergunta: q('.escala-remanejar-sai-pergunta'),
      saiSim: q('.escala-remanejar-sai-sim'), saiNao: q('.escala-remanejar-sai-nao'),
      ondes: q('.escala-remanejar-ondes'),
      conferindo: q('.escala-remanejar-conferindo'), erro: q('.escala-remanejar-erro')
    };
    /* o Enviar ou o Trazer, para o desenho (na caixa da célula, o Quem do Enviar não aparece) */
    tela.classList.add(trazer() ? 'escala-remanejar--trazer' : 'escala-remanejar--enviar');
    /* o banco confere (escalas-painel-remanejar-conferir.js) */
    conf = RosterWork.escalasPainelRemanejarConferir.criar({
      el: el, iso: iso, outra: outra,
      outraDados: function () { return est.outraDados; },
      vivo: function () { return tela.isConnected; },
      aoConferir: function () { atualizar(true); }
    });
    el.marcarTroca = ligarRadios(el.troca, function (v) {
      respondeu = true;
      est.troca = v;
      if (v === 'nao') est.itemTroca = null;
      if (v === 'sim') est.sai = null;
      atualizar();
    });
    el.marcarSai = ligarRadios(el.sai, function (v) { respondeu = true; est.sai = v; atualizar(); });
    combo = criarCombo(el.combo, {
      atual: function () { return est.item; },
      aoEscolher: escolherQuem,
      aoPerder: function () { est.item = null; },
      textos: { selecione: L().digiteOuEscolha, semNinguem: trazer() ? L().ninguemDisponivel : L().ninguemNaUnidade,
        filtroVazio: msg().ninguemEncontrado }
    });
    comboTroca = criarCombo(el.trocaCombo, {
      atual: function () { return est.itemTroca; },
      aoEscolher: function (item) { respondeu = true; est.itemTroca = item; atualizar(); },
      aoPerder: function () { est.itemTroca = null; },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemNaUnidade, filtroVazio: msg().ninguemEncontrado }
    });

    /* ---------- as respostas ---------- */

    /* o Quem do Enviar: quem está de serviço aqui, com ele já escolhido (o menu da linha e a célula) */
    function preencherQuem() {
      var itens = R().deServico(dados);
      combo.preencher(itens);
      var ja = pedidoCpf ? itens.filter(function (i) { return i.cpf === pedidoCpf; })[0] : null;
      if (ja) { est.item = ja; combo.mostrarAtual(); }
    }

    /* quem vai (o Enviar: daqui) ou vem (o Trazer: de outra unidade, que passa a ser a origem); o que dependia dele
       recomeça */
    function escolherQuem(item) {
      respondeu = true;
      est.item = item;
      est.itemTroca = null;
      est.sai = null;
      el.marcarSai(null);
      if (trazer()) {
        var outraUnidade = !est.origem || String(est.origem.unidade_id) !== String(item.unidade.unidade_id);
        est.origem = item.unidade;
        est.outraDados = diasOutras[item.unidade.unidade_id] || null;
        if (outraUnidade) { est.troca = null; el.marcarTroca(null); }
      }
      preencherTroca();
      atualizar();
    }

    /* Para qual unidade (o Enviar): uma bolinha por outra unidade da companhia que você administra */
    function montarUnidades() {
      el.unidades.textContent = '';
      outras.forEach(function (u) {
        var op = RosterWork.tpl('tpl-escala-remanejar-unidade');
        if (!op) return;
        op.querySelector('input').value = String(u.unidade_id);
        op.querySelector('.escala-remanejar-unidade-nome').textContent = u.nome;
        el.unidades.appendChild(op);
      });
      el.marcarUnidade = ligarRadios(el.unidades, function (v) {
        respondeu = true;
        est.destino = outras.filter(function (u) { return String(u.unidade_id) === v; })[0] || null;
        lerDestino();
      });
    }

    /* ---------- desenho ---------- */

    /* quem entra em cada unidade, cada um com o seu Onde fica: [{ chave, item, dados, unidade }] */
    function entradas() {
      var lista = [], outraNome = outra() ? outra().nome : '';
      var quemEntra = trazer()
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
            refaz: true,   // o dia é refeito ao salvar: quem está em volta aparece na nota O que mudou da lista
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

    /* o primeiro Onde fica à vista que está pela metade (a caixa), ou null */
    function ondeQueFalta() {
      var k = Object.keys(ondes).filter(function (x) { return ondes[x].caixa.isConnected && ondes[x].comp.falta(); })[0];
      return k ? ondes[k].caixa : null;
    }

    /* redesenha com as respostas de agora; manter: a conta do banco chegou (as listas abertas ficam abertas). Depois da
       primeira resposta, a resposta pela metade e a recusa do banco desligam o Salvar */
    function atualizar(manter) {
      if (!tela.isConnected) return;
      if (manter !== true && RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      ['quem', 'servico', 'unidade', 'troca', 'trocaCampo', 'sai', 'conferindo', 'erro'].forEach(function (k) { mostra(el[k], false); });
      [el.unidade, el.troca, el.sai].forEach(function (c) { c.classList.remove('grupo-caixa--erro'); });
      Object.keys(ondes).forEach(function (k) { ondes[k].caixa.classList.remove('grupo-caixa--erro'); });
      var semOutras = unidadesChegaram && !outras.length;
      mostra(el.vazio, semOutras);
      mostra(el.quemEnviar, !trazer());
      mostra(el.quemTrazer, trazer());
      metade = false;
      recusa = false;
      var lista = [];
      /* falta resposta (true) até o Onde fica */
      var falta = (function () {
        if (semOutras) return true;
        mostra(el.quem, true);
        if (!trazer() && unidadesChegaram) mostra(el.unidade, true);
        if (!est.item) return true;
        var deOnde = trazer() ? (est.origem ? est.origem.nome : '') : aquiNome;
        var servico = est.item.janelas.map(function (j) { return { hi: H.curta(j.hi), hf: H.curta(j.hf), origem: j.origem }; });
        el.servico.textContent = L().remanejarServico(servico, deOnde) + (R().temExtra(est.item) ? ' ' + L().remanejarExtraContinua : '');
        mostra(el.servico, true);
        if (!outra()) { metade = respondeu; return true; }
        if (!est.outraDados) return true;   // a leitura do dia da outra unidade ainda vem
        /* em troca: alguém da outra unidade faz o caminho contrário */
        mostra(el.troca, true);
        el.trocaPergunta.textContent = trazer()
          ? L().remanejarTrocaTrazer(aquiNome, outra().nome) : L().remanejarTrocaEnviar(outra().nome, aquiNome);
        el.marcarTroca(est.troca);
        if (!est.troca) { metade = respondeu; return true; }
        mostra(el.trocaCampo, est.troca === 'sim');
        if (est.troca === 'sim' && !est.itemTroca) { metade = respondeu; return true; }
        /* na unidade de origem: sem troca e sem extra (a de quem vem, no Trazer; esta, no Enviar) */
        if (est.troca === 'nao' && !R().temExtra(est.item)) {
          var nome = nomeDe(est.item), de = trazer() ? outra().nome : aquiNome, para = trazer() ? aquiNome : outra().nome;
          mostra(el.sai, true);
          el.saiPergunta.textContent = L().remanejarSai(nome, de);
          el.saiSim.textContent = L().remanejarSoNa(para);
          el.saiNao.textContent = L().remanejarNasDuas(de, para);
          el.marcarSai(est.sai);
          if (!est.sai) { metade = respondeu; return true; }
        }
        lista = entradas();
        return false;
      })();
      desenharOndes(lista);
      /* o Onde fica de cada um (a caixa nova já entra com a falta dela) */
      if (!falta && ondeQueFalta()) { falta = true; metade = respondeu; }
      if (falta) { api.aoVivo(null, metade); return; }
      /* tudo respondido: o remanejamento entra no rascunho e o banco confere esta resposta (a recusa desliga o Salvar);
         a conta vem meio segundo depois, e até lá fica o Conferindo a mudança */
      var chave = chaveDaResposta(lista), c = conf.resultado(chave);
      recusa = metade = !!c && !!c.erro;
      api.aoVivo(function () { noRascunho(lista); }, recusa);
      conf.mostrar(c);
      if (!c) conf.agendar(chave);
    }

    /* o clique fora com a resposta pela metade (a caixa da célula): a pergunta que falta fica marcada e, sem a recusa do
       banco na tela, a frase de responder ou fechar embaixo; a próxima resposta tira as duas */
    function marcarFalta() {
      if (!metade || !tela.isConnected) return;
      var falta = !outra() ? el.unidade
        : !est.troca || (est.troca === 'sim' && !est.itemTroca) ? el.troca
        : !el.sai.classList.contains('oculto') && !est.sai ? el.sai
        : ondeQueFalta();
      if (falta) falta.classList.add('grupo-caixa--erro');
      if (recusa) return;
      el.erro.querySelector('.nota-texto').textContent = msg().responderOuDesistir;
      mostra(el.erro, true);
    }

    /* a resposta de agora: a conta do banco vale enquanto ela não muda */
    function chaveDaResposta(lista) {
      var u = outra();
      return JSON.stringify([est.fazer, u && u.unidade_id, est.item && est.item.cpf, est.troca, est.itemTroca && est.itemTroca.cpf, est.sai,
        lista.map(function (e) { var comp = ondes[e.chave].comp; return [e.chave, comp.paraBanco(), comp.estado().marcadas]; })]);
    }

    /* ---------- no rascunho ---------- */

    /* os remanejamentos (quem vai ou vem e, em troca, quem faz o caminho contrário); quem sai perde as colocações
       manuais de onde saiu (quem fica nas duas, não), e cada um que entra fica onde foi escolhido */
    function noRascunho(ent) {
      var u = outra(), itens = [];
      var fica = est.troca === 'nao' && !R().temExtra(est.item) && est.sai === 'fica';
      function item(i, origem, destino, dadosOrigem, ficaNasDuas) {
        itens.push({ cpf: i.cpf, origem: Number(origem), destino: Number(destino), fica: ficaNasDuas, dadosOrigem: dadosOrigem });
      }
      if (trazer()) {
        item(est.item, u.unidade_id, uid, est.outraDados, fica);
        if (est.troca === 'sim') item(est.itemTroca, uid, u.unidade_id, dados, false);
      } else {
        item(est.item, uid, u.unidade_id, dados, fica);
        if (est.troca === 'sim') item(est.itemTroca, u.unidade_id, uid, est.outraDados, false);
      }
      itens.forEach(function (i) { if (!i.fica) R().cortarNaOrigem(api.rascunho(), i.cpf, i.dadosOrigem); });
      ent.forEach(function (e) { ondes[e.chave].comp.aplicar(null); });
      api.remanejar(itens.map(function (i) { return { cpf: i.cpf, origem: i.origem, destino: i.destino, fica: i.fica }; }));
    }

    /* ---------- começo ---------- */

    pendurar(tela);
    if (!trazer()) preencherQuem();
    atualizar();
    /* as unidades da companhia (lidas uma vez): no Enviar, as bolinhas do Para qual unidade (com uma só, ela já vem
       escolhida); no Trazer, o dia de cada uma, para o Quem vem */
    R().lerUnidades().then(function (lista) {
      if (!tela.isConnected) return;
      if (!lista) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); return; }
      var aqui = lista.filter(function (u) { return String(u.unidade_id) === String(uid); })[0];
      aquiNome = aqui ? aqui.nome : '';
      outras = R().outrasDe(lista, companhia, uid);
      unidadesChegaram = true;
      if (trazer()) { lerOutras(); atualizar(); return; }
      montarUnidades();
      if (outras.length === 1) { est.destino = outras[0]; el.marcarUnidade(String(outras[0].unidade_id)); lerDestino(); return; }
      atualizar();
    });
    return { pelaMetade: function () { return metade; }, marcarFalta: marcarFalta };
  }

  window.RosterWork.escalasPainelRemanejar = { abrir: abrir, criar: criar, podeEnviar: podeEnviar, podeTrazer: podeTrazer,
    prepararUnidades: prepararUnidades, unidadesProntas: function () { return !!unidadesLidas; } };
})();
