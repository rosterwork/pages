/* ============================================================
   ESCALAS — Onde fica (a caixa de pergunta do Adicionar militar e
   do Remanejar militar; molde tpl-escala-onde-fica): onde fica quem
   entra numa unidade no dia.
   - O sistema distribui: o sistema refaz o dia com ele (quem está
     fixado fica);
   - Escolher a função: o posto e a função (escalas-painel-quem.js),
     cada função com a situação dela no horário; quem está nela sai
     daquele horário;
   - No lugar de outro militar: quem sai (de serviço no horário) e de
     quais funções, todas marcadas; quem fica sem nenhuma vai para
     Sem função.
   Embaixo, a nota do que acontece com quem está em volta. Cada
   caixa é de um militar e de uma unidade (a leitura do dia dela),
   com a sua escolha.
   API: RosterWork.escalasPainelOnde.criar(caixa, cfg) devolve
   { atualizar(), reiniciar(), estado(), respondido(), falta() (a escolha está pela metade),
     quem(texto), aplicar(pontual) };
   cfg = { dados() (a leitura do dia da unidade onde ele entra),
           periodos() (os horários dele), cpf() (quem entra),
           aoMudar() }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios e os campos de cada caixa

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  function criar(caixa, cfg) {
    var api = ed(), H = api.horas, Q = RosterWork.escalasPainelQuem;
    var listas = RosterWork.escalasPainelAdicionarListas;
    var q = function (s) { return caixa.querySelector(s); };
    var el = {
      quem: q('.escala-onde-fica-quem'), opcoes: q('.escala-onde-fica-opcoes'), funcao: q('.escala-onde-fica-funcao'),
      lugar: q('.escala-onde-fica-lugar'), sai: q('.escala-onde-fica-sai'),
      funcoesRotulo: q('.escala-onde-fica-funcoes-rotulo'), funcoesLista: q('.escala-onde-fica-funcoes'),
      efeito: q('.escala-onde-fica-efeito')
    };
    var est = { onde: 'sistema', posto: null, funcao: null, sai: null, funcoes: [] };
    var onde = null, chaveSai = '', marcarOnde = null, comboSai = null;

    function mudou() { if (cfg.aoMudar) cfg.aoMudar(); }
    function mostra(no, sim) { no.classList.toggle('oculto', !sim); }

    function ocupantes(posto, nf) {
      return RosterWork.escalasPainelLinhaAplicar.ocupantes(posto, nf, cfg.periodos(), cfg.cpf(), cfg.dados());
    }
    function situacao(posto, nf) {
      var nomes = ocupantes(posto, nf).map(function (o) { return nomeDe(o.m); });
      nomes = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
      return nomes.length ? msg().itemSai(nomes) : msg().itemVazia;
    }

    /* volta ao começo: o sistema distribui, sem função escolhida e sem quem sai */
    function limpar() {
      est.posto = null; est.funcao = null; est.sai = null; est.funcoes = []; chaveSai = '';
      if (onde) { el.funcao.textContent = ''; onde = null; }
      montarFuncoes();
    }
    function reiniciar() { est.onde = 'sistema'; limpar(); }

    /* De quais funções: as funções de quem sai no horário, todas marcadas */
    function montarFuncoes() {
      var s = est.sai && est.sai.s;
      el.funcoesLista.textContent = '';
      mostra(el.funcoesRotulo, !!s);
      if (!s) return;
      est.funcoes = s.funcoes.map(function () { return true; });
      Q.marcar(el.funcoesLista, s.funcoes.map(function (f) {
        return { texto: L().funcaoNoHorario(api.funcaoNoPosto(f.funcao, f.posto), H.textoPeriodos(f.x.map(H.periodo))), marcado: true };
      }), function (marcados) {
        est.funcoes = s.funcoes.map(function (f, i) { return marcados.indexOf(i) >= 0; });
        mudou();
      });
    }

    /* Quem sai: a lista acompanha o horário (quem não está mais de serviço nele sai da escolha) */
    function atualizarSai() {
      var chave = JSON.stringify([cfg.periodos(), cfg.cpf()]);
      if (chave === chaveSai) return;
      chaveSai = chave;
      var itens = listas.sai(cfg.periodos(), cfg.cpf(), cfg.dados());
      if (est.sai) { est.sai = itens.filter(function (i) { return i.cpf === est.sai.cpf; })[0] || null; montarFuncoes(); }
      comboSai.preencher(itens);
    }

    /* o que acontece com quem está em volta: quem sai da função escolhida, ou o que sobra para quem sai */
    function efeito() {
      if (est.onde === 'funcao' && est.posto && est.funcao) {
        var partes = ocupantes(est.posto, est.funcao).map(function (o) {
          var pr = H.periodo(o.x);
          return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf));
        });
        return partes.length ? msg().avisoEfeito(partes) : '';
      }
      if (est.onde === 'lugar' && est.sai) {
        var s = est.sai.s, nome = nomeDe(s.m);
        var saem = s.funcoes.filter(function (f, i) { return est.funcoes[i]; });
        if (!saem.length) return '';
        var ficam = s.funcoes.filter(function (f, i) { return !est.funcoes[i]; });
        var nomesSaem = saem.map(function (f) { return api.funcaoNoPosto(f.funcao, f.posto); });
        return ficam.length
          ? L().lugarSaiContinua(nome, nomesSaem, ficam.map(function (f) { return api.funcaoNoPosto(f.funcao, f.posto); }))
          : L().lugarSaiSem(nome, nomesSaem, H.textoPeriodos(cfg.periodos()));
      }
      return '';
    }

    /* redesenha com a escolha de agora (a caixa em si aparece ou some por quem a usa) */
    function atualizar() {
      marcarOnde(est.onde);
      mostra(el.funcao, est.onde === 'funcao');
      if (est.onde === 'funcao' && !onde) {
        onde = Q.onde(el.funcao, { postos: (cfg.dados() || {}).postos || [], situacao: situacao,
          aoMudar: function (posto, funcao) { est.posto = posto; est.funcao = funcao; mudou(); } });
      }
      mostra(el.lugar, est.onde === 'lugar');
      if (est.onde === 'lugar') atualizarSai();
      var texto = efeito();
      mostra(el.efeito, !!texto);
      if (texto) el.efeito.querySelector('.nota-texto').textContent = texto;
    }

    function respondido() {
      return est.onde === 'sistema' || (est.onde === 'funcao' && !!est.posto && !!est.funcao)
        || (est.onde === 'lugar' && !!est.sai && est.funcoes.some(Boolean));
    }
    /* a escolha está pela metade (a função, ou quem sai e de quais funções) */
    function falta() {
      if (est.onde === 'funcao') return !est.funcao;
      if (est.onde === 'lugar') return !est.sai || !est.funcoes.some(Boolean);
      return false;
    }

    /* põe a escolha no rascunho do Dia: o sistema refaz o dia (quem está fixado fica), a função escolhida ou as funções
       de quem sai, nos trechos delas no horário. pontual = { contabilizar } (o Adicionar no dia) ou null */
    function aplicar(pontual) {
      var cpf = cfg.cpf(), periodos = cfg.periodos(), dados = cfg.dados();
      if (est.onde === 'funcao') {
        api.aplicarColocacao({ cpf: cpf, posto: est.posto, funcao: est.funcao, periodos: periodos, sistema: false, pontual: pontual, dados: dados });
      } else if (est.onde === 'lugar') {
        /* entra e senta em cada função marcada de quem sai, nos trechos dela no horário */
        api.aplicarColocacao({ cpf: cpf, periodos: periodos, sistema: true, pontual: pontual });
        est.sai.s.funcoes.forEach(function (f, i) {
          if (!est.funcoes[i]) return;
          api.aplicarColocacao({ cpf: cpf, posto: f.posto, funcao: f.funcao, periodos: f.x.map(H.periodo), sistema: false, pontual: null, dados: dados });
        });
      } else {
        api.aplicarColocacao({ cpf: cpf, periodos: periodos, sistema: true, refazer: true, pontual: pontual });
      }
    }

    /* a frase de quem é a caixa ("O 2ºSgt. Deividi, no 1ºPEL."); vazia, some */
    function quem(texto) {
      mostra(el.quem, !!texto);
      el.quem.textContent = texto || '';
    }

    /* liga as escolhas */
    var nomeRadios = 'escala-onde-fica-' + (++conta);
    var radios = el.opcoes.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nomeRadios;
      r.addEventListener('change', function () {
        if (!r.checked) return;
        est.onde = r.value;
        limpar();
        mudou();
      });
    });
    marcarOnde = function (valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
    var inp = el.sai.querySelector('input');
    inp.id = 'escala-onde-fica-sai-' + (++conta);
    comboSai = RosterWork.comboMilitar.criar(inp, el.sai.querySelector('.dropdown-menu'), {
      atual: function () { return est.sai; },
      aoEscolher: function (item) { est.sai = item; montarFuncoes(); mudou(); },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDeServico, filtroVazio: msg().ninguemEncontrado }
    });

    return {
      atualizar: atualizar, reiniciar: reiniciar, respondido: respondido, falta: falta, aplicar: aplicar, quem: quem,
      estado: function () { return est; }
    };
  }

  window.RosterWork.escalasPainelOnde = { criar: criar };
})();
