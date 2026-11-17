/* ============================================================
   ESCALAS — Onde fica (a caixa de pergunta do Adicionar militar, do
   Mudar de unidade neste dia, do Mudar o dia do serviço e do Para qual função
   do cartão da linha; molde tpl-escala-onde-fica): onde fica quem
   entra numa unidade no dia.
   - As vagas sem ninguém (só com cfg.vagas: o Mudar o dia do serviço
     e o Para qual função do cartão da linha): uma bolinha por função
     vazia em todo o horário dele, fora o Chefe de Socorro e o Oficial
     de Área; a primeira vem marcada, com o selo Recomendado, até a
     pessoa escolher outra;
   - O sistema distribui: o sistema refaz o dia com ele (quem está
     fixado fica);
   - Escolher a função: o posto e a função (escalas-painel-quem.js),
     cada função com a situação dela no horário; quem está nela sai
     daquele horário;
   - No lugar de outro militar: quem sai (de serviço no horário) e de
     quais funções, todas marcadas; quem fica sem nenhuma vai para
     Sem função.
   - O estagiário (cfg.estagio, as Funções e postos do estágio dele):
     uma caixa de marcar por posto do estágio, todas marcadas no
     começo (o sistema distribui); uma marcada, ele fica nela; duas ou
     mais, o sistema escolhe entre elas; pelo menos uma. Vai para o
     rascunho na chave estagio_onde ({cpf: as linhas marcadas}).
   Embaixo, a nota do que acontece com quem está em volta. Cada
   caixa é de um militar e de uma unidade (a leitura do dia dela),
   com a sua escolha. A escolha do estagiário é a mesma no Mudar onde
   fica da célula (RosterWork.escalasPainelOnde.estagio).
   API: RosterWork.escalasPainelOnde.criar(caixa, cfg) devolve
   { atualizar(), reiniciar(), estado(), respondido(), falta() (a escolha está pela metade),
     quem(texto), dia(texto) (o dia no título: "Onde fica em 13/11"), aplicar(pontual),
     paraBanco() (a escolha no formato do banco: o Mudar o dia grava pelo escala_dia_salvar) };
   cfg = { dados() (a leitura do dia da unidade onde ele entra),
           periodos() (os horários dele), cpf() (quem entra),
           vagas (true: as vagas sem ninguém no horário), so (['funcao']: só as opções da lista, sem o "O sistema
           distribui", que deixa de ser a resposta de começo: o cartão Para qual função),
           estagio() (as Funções e postos do estágio de quem entra, ou nada), aoMudar() }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios e os campos de cada caixa
  /* Chefe de Socorro e Oficial de Área são automáticos por normativa: nunca são vaga para escolher */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* ---------- o estagiário: em quais postos do estágio ele pode ficar no dia ---------- */

  function noPosto(a, po) { return po.tipo === 'viatura' ? a.viatura_id === po.id : a.instalacao_id === po.id; }

  /* os postos das Funções e postos do estágio (linhas), com o posto da leitura do dia: [{ chave, posto, funcao, texto }]
     (o Efetivo, só o nome do posto; outra função, a função no posto) */
  function postos(linhas, dados) {
    var lista = [];
    (linhas || []).forEach(function (l) {
      var po = ed().acharPosto(l.posto, l.posto, dados);
      if (!po || !l.funcao) return;
      lista.push({ chave: po.tipo + ':' + po.id + '|' + l.funcao, posto: po, funcao: l.funcao,
        texto: l.funcao === 'Efetivo' ? po.nome : ed().funcaoNoPosto(l.funcao, po) });
    });
    return lista;
  }

  /* os postos marcados dele no rascunho (os índices de postos()); sem o Onde fica guardado, todos (o sistema distribui) */
  function marcadas(cpf, linhas, dados) {
    var lista = postos(linhas, dados), r = ed().rascunho(), sel = r && r.estagio_onde ? r.estagio_onde[cpf] : null;
    if (!sel || !sel.length) return lista.map(function (v, i) { return i; });
    return lista.map(function (v, i) {
      return sel.some(function (m) { return m.posto === v.posto.id && m.funcao === v.funcao; }) ? i : -1;
    }).filter(function (i) { return i >= 0; });
  }

  /* põe no rascunho os postos marcados dele (todos = o sistema distribui, sem guardar) e tira o fixado dele nos postos do
     estágio (o de antes do Onde fica) */
  function aplicarOnde(cpf, indices, linhas, dados) {
    var r = ed().rascunho(), lista = postos(linhas, dados);
    r.ajustes = r.ajustes.filter(function (a) {
      return !(a.acao === 'colocar' && a.cpf === cpf && lista.some(function (v) { return noPosto(a, v.posto); }));
    });
    r.estagio_onde = r.estagio_onde || {};
    if (!indices || indices.length >= lista.length) delete r.estagio_onde[cpf];
    else r.estagio_onde[cpf] = indices.map(function (i) { return { posto: lista[i].posto.id, funcao: lista[i].funcao }; });
  }

  /* a sub-tela Mudar onde fica (o lápis do estagiário no painel do dia): as mesmas caixas de marcar da célula, a escolha
     ao vivo no rascunho (pelo menos uma) */
  function abrirEstagio(opcoes) {
    var api = ed(), cpf = opcoes && opcoes.cpf, dados = api.dados();
    var linhas = dados && dados.estagios && dados.estagios[cpf], mil = linhas ? api.militarDoDia(cpf) : null;
    if (!mil) return;
    api.abrir(function (corpo) {
      var tela = RosterWork.tpl('tpl-escala-onde-estagio');
      if (!tela) return;
      var p = String(api.iso() || '').split('-');
      tela.querySelector('.escala-onde-estagio-quem').textContent = L().noDia(nomeDe(mil), p.length === 3 ? p[2] + '/' + p[1] : '');
      var lista = postos(linhas, dados), atuais = marcadas(cpf, linhas, dados);
      var marcar = RosterWork.escalasPainelQuem.marcar(tela.querySelector('.escala-marcar-lista'),
        lista.map(function (v, i) { return { texto: v.texto, marcado: atuais.indexOf(i) >= 0 }; }),
        function (indices) {
          if (!indices.length) { marcar(atuais); return; }
          atuais = indices;
          api.aoVivo(function () { aplicarOnde(cpf, indices, linhas, dados); }, false);
        });
      corpo.appendChild(tela);
    });
  }

  function criar(caixa, cfg) {
    var api = ed(), H = api.horas, Q = RosterWork.escalasPainelQuem;
    var listas = RosterWork.escalasPainelAdicionarListas;
    var q = function (s) { return caixa.querySelector(s); };
    var el = {
      quem: q('.escala-onde-fica-quem'), opcoes: q('.escala-onde-fica-opcoes'), funcao: q('.escala-onde-fica-funcao'),
      lugar: q('.escala-onde-fica-lugar'), sai: q('.escala-onde-fica-sai'),
      funcoesRotulo: q('.escala-onde-fica-funcoes-rotulo'), funcoesLista: q('.escala-onde-fica-funcoes'),
      efeito: q('.escala-onde-fica-efeito'), vagas: q('.escala-onde-fica-vagas'), em: q('.escala-onde-fica-em'),
      dia: q('.escala-onde-fica-dia')
    };
    /* onde: 'vaga' | 'sistema' | 'funcao' | 'lugar'; vaga = a vaga sem ninguém escolhida; escolheu = a pessoa já
       respondeu (até lá, a vaga recomendada vem marcada) */
    /* a resposta de começo: o sistema distribui (sem ele nas opções, nenhuma) */
    var padrao = cfg.so && cfg.so.indexOf('sistema') < 0 ? null : 'sistema';
    var est = { onde: padrao, posto: null, funcao: null, sai: null, funcoes: [], vaga: null, marcadas: null, escolheu: false };
    var onde = null, chaveSai = '', marcarOnde = null, comboSai = null;
    var vagas = [], chaveVagas = null;   // as vagas sem ninguém na tela e a marca delas (redesenha só quando mudam)
    var chavePostos = null, marcarPostos = null;   // os postos do estágio de quem entra (o estagiário): a marca e as caixas

    /* as Funções e postos do estágio de quem entra (o estagiário), ou nada */
    function linhasEstagio() { var l = cfg.estagio && cfg.estagio(); return l && l.length ? l : null; }

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

    /* volta ao começo: o sistema distribui, sem função escolhida, sem vaga e sem quem sai */
    function limpar() {
      est.posto = null; est.funcao = null; est.sai = null; est.funcoes = []; est.vaga = null; chaveSai = '';
      if (onde) { el.funcao.textContent = ''; onde = null; }
      montarFuncoes();
    }
    /* o dia ou o horário mudou: tudo volta ao começo (com as vagas, a recomendada volta a vir marcada) */
    function reiniciar() { est.onde = padrao; est.escolheu = false; est.marcadas = null; chaveVagas = null; chavePostos = null; limpar(); }

    /* o estagiário: uma caixa de marcar por posto do estágio dele (redesenhadas só quando a lista muda), as marcadas do
       rascunho (sem elas, todas); desmarcar a última não vale: pelo menos uma */
    function desenharPostos() {
      var linhas = linhasEstagio(), lista = linhas ? postos(linhas, cfg.dados()) : [];
      var chave = lista.map(function (v) { return v.chave; }).join(';');
      if (chave === chavePostos) return;
      chavePostos = chave;
      chaveVagas = null;
      el.vagas.textContent = '';
      marcarPostos = null;
      if (!lista.length) { est.marcadas = null; return; }
      if (!est.marcadas) est.marcadas = marcadas(cfg.cpf(), linhas, cfg.dados());
      marcarPostos = Q.marcar(el.vagas, lista.map(function (v, i) { return { texto: v.texto, marcado: est.marcadas.indexOf(i) >= 0 }; }),
        function (indices) {
          if (!indices.length) { marcarPostos(est.marcadas); return; }
          est.marcadas = indices;
          est.escolheu = true;
          mudou();
        });
    }

    /* as vagas sem ninguém em todo o horário de quem entra, na ordem da lista do dia: [{ chave, posto, funcao }]; o lugar
       que falta até o ideal também é vaga (a função aberta e o lugar do meio, não) */
    function vagasLivres() {
      var horas = H.uniao(cfg.periodos().map(H.faixa)), lista = [];
      if (!horas.length) return lista;
      (((cfg.dados() || {}).postos) || []).forEach(function (po) {
        (po.funcoes || []).forEach(function (f) {
          if (BLOQUEADAS.test(f.nome) || (f.vazio_motivo === 'aberta' && !f.lugar_ideal)) return;
          var vazio = f.vazio ? [[0, 1440]] : H.uniao((f.vao || []).map(H.faixa));
          if (!vazio.length || H.menos(horas, vazio).length) return;
          lista.push({ chave: po.tipo + ':' + po.id + '|' + f.nome, posto: po, funcao: f.nome });
        });
      });
      return lista;
    }

    /* as bolinhas das vagas (redesenhadas só quando a lista muda). A vaga escolhida que não serve mais sai; sem resposta da
       pessoa, a primeira (a recomendada) vem marcada */
    function desenharVagas() {
      if (!cfg.vagas) return;
      var lista = vagasLivres(), chave = lista.map(function (v) { return v.chave; }).join(';');
      if (chave !== chaveVagas) {
        chaveVagas = chave;
        vagas = lista;
        el.vagas.textContent = '';
        vagas.forEach(function (v, i) {
          var op = RosterWork.tpl('tpl-escala-onde-fica-vaga');
          if (!op) return;
          var r = op.querySelector('input');
          r.name = nomeRadios;
          op.querySelector('.escala-onde-fica-vaga-texto').textContent = msg().mudarDia.vaga(api.funcaoNoPosto(v.funcao, v.posto));
          mostra(op.querySelector('.escala-onde-fica-recomendado'), i === 0);
          r.addEventListener('change', function () {
            if (!r.checked) return;
            est.onde = 'vaga';
            limpar();
            est.vaga = v;
            est.escolheu = true;
            mudou();
          });
          v.radio = r;
          el.vagas.appendChild(op);
        });
      }
      var atual = est.vaga && vagas.filter(function (v) { return v.chave === est.vaga.chave; })[0];
      if (est.onde === 'vaga') { est.vaga = atual || null; if (!atual) est.onde = padrao; }
      if (!est.escolheu && est.onde === padrao && vagas.length) { est.onde = 'vaga'; est.vaga = vagas[0]; }
      /* sem vaga e com uma opção só (o cartão Para qual função): ela já vem marcada */
      else if (!est.escolheu && !est.onde && !vagas.length && cfg.so && cfg.so.length === 1) est.onde = cfg.so[0];
    }

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
      /* o estagiário: só as caixas dos postos do estágio dele (sem o sistema distribui, as vagas, a função e o lugar de
         outro: todas marcadas é o sistema distribui) */
      var estagiario = !!linhasEstagio();
      [].forEach.call(radios, function (r) {
        r.closest('.geral-opcao').classList.toggle('oculto', (cfg.so && cfg.so.indexOf(r.value) < 0) || estagiario);
      });
      if (estagiario && est.onde !== 'estagio') { limpar(); est.onde = 'estagio'; }
      if (!estagiario && est.onde === 'estagio') { est.onde = padrao; est.marcadas = null; }
      if (estagiario || chavePostos) desenharPostos();
      if (!estagiario) desenharVagas();
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
      return est.onde === 'sistema' || (est.onde === 'vaga' && !!est.vaga) || (est.onde === 'funcao' && !!est.posto && !!est.funcao)
        || (est.onde === 'lugar' && !!est.sai && est.funcoes.some(Boolean)) || (est.onde === 'estagio' && !!(est.marcadas && est.marcadas.length));
    }
    /* a escolha está pela metade (a vaga, a função, ou quem sai e de quais funções) */
    function falta() {
      if (!est.onde) return true;
      if (est.onde === 'vaga') return !est.vaga;
      if (est.onde === 'estagio') return !(est.marcadas && est.marcadas.length);
      if (est.onde === 'funcao') return !est.funcao;
      if (est.onde === 'lugar') return !est.sai || !est.funcoes.some(Boolean);
      return false;
    }

    /* põe a escolha no rascunho do Dia: o sistema refaz o dia (quem está fixado fica), a vaga ou a função escolhida, ou as
       funções de quem sai, nos trechos delas no horário. pontual = { contabilizar } (o Adicionar no dia) ou null */
    function aplicar(pontual) {
      var cpf = cfg.cpf(), periodos = cfg.periodos(), dados = cfg.dados();
      if (est.onde === 'estagio') {
        /* o estagiário: entra (o sistema refaz o dia) com os postos marcados */
        api.aplicarColocacao({ cpf: cpf, periodos: periodos, sistema: true, refazer: true, pontual: pontual });
        aplicarOnde(cpf, est.marcadas, linhasEstagio(), dados);
      } else if (est.onde === 'vaga') {
        api.aplicarColocacao({ cpf: cpf, posto: est.vaga.posto, funcao: est.vaga.funcao, periodos: periodos, sistema: false, pontual: pontual, dados: dados });
      } else if (est.onde === 'funcao') {
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

    /* a escolha no formato do banco (o Mudar o dia do serviço grava o Onde fica do dia novo pelo escala_dia_salvar):
       { tipo: 'sistema' } | { tipo: 'funcao', nome_funcao, viatura_id, instalacao_id } | { tipo: 'lugar', substitui, funcoes } */
    function paraBanco() {
      function lugar(posto, nome) {
        return { nome_funcao: nome, viatura_id: posto.tipo === 'viatura' ? posto.id : null,
          instalacao_id: posto.tipo === 'instalacao' ? posto.id : null };
      }
      function funcao(posto, nome) { var x = lugar(posto, nome); x.tipo = 'funcao'; return x; }
      if (est.onde === 'vaga' && est.vaga) return funcao(est.vaga.posto, est.vaga.funcao);
      if (est.onde === 'funcao' && est.posto && est.funcao) return funcao(est.posto, est.funcao);
      if (est.onde === 'lugar' && est.sai) {
        return { tipo: 'lugar', substitui: est.sai.cpf, funcoes: est.sai.s.funcoes
          .filter(function (f, i) { return est.funcoes[i]; }).map(function (f) { return lugar(f.posto, f.funcao); }) };
      }
      return { tipo: 'sistema' };
    }

    /* a frase de quem é a caixa ("O 2ºSgt. Deividi, no 1ºPEL."); vazia, some */
    function quem(texto) {
      mostra(el.quem, !!texto);
      el.quem.textContent = texto || '';
    }
    /* o dia no título ("Onde fica em 13/11"); vazio, só "Onde fica" */
    function dia(texto) {
      mostra(el.em, !!texto);
      el.dia.textContent = texto || '';
    }

    /* liga as escolhas */
    var nomeRadios = 'escala-onde-fica-' + (++conta);
    var radios = el.opcoes.querySelectorAll('input[type="radio"]');
    /* só as opções pedidas (cfg.so; o estagiário, só O sistema distribui: atualizar) */
    [].forEach.call(radios, function (r) { if (cfg.so && cfg.so.indexOf(r.value) < 0) r.closest('.geral-opcao').classList.add('oculto'); });
    [].forEach.call(radios, function (r) {
      r.name = nomeRadios;
      r.addEventListener('change', function () {
        if (!r.checked) return;
        est.onde = r.value;
        est.escolheu = true;
        limpar();
        mudou();
      });
    });
    /* as bolinhas fixas e as das vagas (só a vaga escolhida fica marcada) */
    marcarOnde = function (valor) {
      [].forEach.call(radios, function (r) { r.checked = r.value === valor; });
      vagas.forEach(function (v) { if (v.radio) v.radio.checked = valor === 'vaga' && !!est.vaga && v.chave === est.vaga.chave; });
    };
    var inp = el.sai.querySelector('input');
    inp.id = 'escala-onde-fica-sai-' + (++conta);
    comboSai = RosterWork.comboMilitar.criar(inp, el.sai.querySelector('.dropdown-menu'), {
      atual: function () { return est.sai; },
      aoEscolher: function (item) { est.sai = item; montarFuncoes(); mudou(); },
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDeServico, filtroVazio: msg().ninguemEncontrado }
    });

    return {
      atualizar: atualizar, reiniciar: reiniciar, respondido: respondido, falta: falta, aplicar: aplicar, quem: quem,
      dia: dia, paraBanco: paraBanco, estado: function () { return est; }
    };
  }

  window.RosterWork.escalasPainelOnde = {
    criar: criar,
    /* os postos do estagiário (o Mudar onde fica da célula usa o mesmo código) e a sub-tela do lápis dele no painel */
    estagio: { postos: postos, marcadas: marcadas, aplicar: aplicarOnde },
    abrirEstagio: abrirEstagio
  };
})();
