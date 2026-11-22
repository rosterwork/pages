/* ============================================================
   ESCALAS — Mudar o dia do serviço (só admin): o item do menu do
   militar no painel do dia (a sub-tela) e na caixa da célula da grade
   (a caixa 2, escalas-celula-editar-acoes.js), com as mesmas
   perguntas e o mesmo código.
   O serviço pelo ciclo ou por troca de um militar neste dia passa para
   outro dia, na mesma unidade e no mesmo horário: o serviço inteiro ou
   uma parte; a troca continua valendo (quem ele cobre segue de folga).
   Não é folga: o banco de horas não muda, e o militar é avisado no
   sino. Caixas de pergunta, uma depois da outra (Guia visual › Ações e
   perguntas): Quem (só no painel: o serviço pelo ciclo e, num grupo
   próprio, o por troca; quem está de extra, pontual, remanejado ou já
   veio de outro dia aparece apagado, com o caminho certo; na caixa da
   célula, ele já vem escolhido e fica só a frase do serviço dele), Qual
   parte muda (só com o serviço dividido no dia), Para qual dia (o campo
   de data padrão, geral-calendario: o calendário abre por cima, com
   acesos só os dias em que ele pode ficar, da escala_mudar_dia_dias, e,
   embaixo do campo, a situação do dia escolhido: a folga em volta, ou
   as horas seguidas, e as vagas sem ninguém), Horário (o serviço
   inteiro ou uma parte, geral-horario › periodoServico) e Onde fica
   no dia novo (escalas-painel-onde.js, com as vagas sem ninguém no
   horário, a primeira recomendada). Com tudo respondido, a mudança
   entra no rascunho do Dia ao vivo (escalas-painel-editar.js ›
   aoVivo) e o banco confere numa prévia (escala_previa), com a linha
   Conferindo a mudança: a recusa fica em vermelho e desliga o Salvar
   do rodapé largo; o dia de antes abaixo do mínimo e quem assume o
   Chefe de Socorro ou o Oficial de Área avisam e deixam salvar (a
   conferência fica em escalas-painel-mudar-dia-conferir.js).
   Escolhido o dia novo, a
   resposta pela metade (o horário fora do serviço ou o Onde fica sem a
   escolha) também desliga o Salvar. Depois de salvo, desfaz-se pela
   folga no dia de antes ou pelo Remover do dia no dia novo.
   O Muda para outra data: quem já veio de outro dia (o pontual do dia
   novo, mudancaDe) chega escolhido pelo menu dele ou pelo Remover deste
   dia; o serviço vai inteiro (sem o Horário), o calendário é o da
   mudança dele (a escala_mudar_dia_dias com p_mudanca: o dia de antes
   também é origem) e a resposta vai ao rascunho como remarcar_mudanca
   (o dia de antes continua com a mesma marca). Também pelo dia de
   antes (o Mudar o dia do serviço da linha riscada da mudança,
   mudancaDaFolga): a mudança leva o paraIso (o dia novo dela), que o
   calendário e a frase usam no lugar do dia aberto.
   API: RosterWork.escalasPainelMudarDia.abrir(opcoes) (a sub-tela do
   painel; opcoes = { cpf }: chega com ele escolhido, o menu da linha),
   criar(opcoes, pendurar) (as perguntas em outro lugar, a caixa 2 da
   célula e o Remover deste dia: pendurar(tela) põe a tela na página;
   opcoes.mudanca: o Muda para outra data dessa mudança dele;
   opcoes.dentro: sem o título e sem o Quem, dentro de outra sub-tela;
   devolve { pelaMetade(), marcarFalta() }), podeMudar(cpf) (ele está na
   lista Quem, pelo ciclo ou por troca, ou veio de outro dia),
   mudancaDe(mil) e mudancaDaFolga(f, iso) (a mudança da linha riscada
   do dia de antes, para o opcoes.mudanca).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* as origens do serviço que muda de dia por aqui: pelo ciclo e por troca */
  var MUDAM = ['base', 'saida', 'sistema', 'troca'];
  var LEITURA = 63;            // dias em cada leitura da escala_mudar_dia_dias (o máximo do banco)
  var conta = 0;               // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function M() { return RosterWork.mensagens.escala.mudarDia; }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diaMes(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function somarDias(s, n) { var d = dataDeIso(s); d.setDate(d.getDate() + n); return iso(d); }
  function diasEntre(a, b) { return Math.round((dataDeIso(b) - dataDeIso(a)) / 86400000); }

  /* por que quem está no dia não muda por aqui (o caminho certo) */
  function motivo(mil, daUnidade) {
    var t = M(), js = mil.janelas || [];
    function tem(origem) { return js.filter(function (j) { return j.origem === origem; })[0]; }
    if (mil.remanejado) return t.naoRemanejado;
    if (tem('mudanca')) return t.naoMudou(tem('mudanca').mudanca_de || '');
    if (tem('pontual')) return t.naoPontual;
    if (tem('extra')) return t.naoExtra;
    return daUnidade ? '' : t.naoOutraUnidade;
  }

  /* as horas dele nesta unidade que mudam de dia por aqui, pelo ciclo e por troca (vazio: não muda por aqui) */
  function janelasQueMudam(mil, daUnidade) {
    return daUnidade && !mil.remanejado ? mil.janelas.filter(function (j) { return MUDAM.indexOf(j.origem) >= 0; }) : [];
  }
  /* só por troca (o grupo Por troca e o texto do serviço) */
  function soTroca(janelas) { return janelas.length > 0 && janelas.every(function (j) { return j.origem === 'troca'; }); }

  /* quem está aqui só pelo serviço que veio de outro dia (o pontual do dia novo: uma mudança só, nesta unidade e fora o
     remanejado), que muda de novo pelo Muda para outra data: { id, de ("19/11"), deIso, periodos, janelas, troca (o
     serviço era de troca) }; null nos outros */
  function mudancaDe(mil) {
    if (!mil || mil.remanejado || !mil.daUnidade) return null;
    var partes = RosterWork.escalasPainelRemoverListas.partesDe(mil);
    if (partes.length !== 1 || partes[0].origem !== 'mudanca' || !partes[0].mudancaId) return null;
    var js = mil.janelas.filter(function (j) { return j.origem === 'mudanca'; });
    return { id: partes[0].mudancaId, de: partes[0].mudancaDe, deIso: partes[0].mudancaDeIso, periodos: partes[0].periodos,
      janelas: js, troca: js.some(function (j) { return !!j.mudanca_troca; }) };
  }

  /* a mesma mudança, pelo dia de antes (a linha riscada dela, f = a linha da folga do dia com a mudança; iso = o dia
     aberto): paraIso = o dia novo dela, onde o serviço está agora; grad e nome, porque ele não está de serviço aqui */
  function mudancaDaFolga(f, diaIso) {
    var m = f && f.mudanca;
    if (!m || !f.hi || !f.hf) return null;
    var periodo = { hi: f.hi, hf: f.hf };
    return { id: m.id, de: diaMes(diaIso), deIso: diaIso, paraIso: String(m.para_iso || '').slice(0, 10), periodos: [periodo],
      janelas: [{ hi: f.hi, hf: f.hf, origem: 'mudanca' }], troca: false, grad: f.grad, nome: f.nome };
  }

  /* a lista Quem: quem está de serviço pelo ciclo nesta unidade, depois quem está por troca (o ícone de origem e o
     horário) e, no fim e apagados, quem está no dia de outro jeito, com o caminho certo */
  function itensQuem(dados) {
    var api = ed(), Q = RosterWork.escalasPainelQuem, pode = [], porTroca = [], nao = [], visto = {};
    (dados.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        if (visto[pm.cpf] || !(pm.disp || []).length) return;
        var mil = api.militarDoDia(pm.cpf);
        if (!mil) return;
        visto[pm.cpf] = true;
        var muda = janelasQueMudam(mil, !!u.editando);
        if (muda.length) {
          var item = Q.itemServico({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, disp: muda });
          item.mil = mil;
          (soTroca(muda) ? porTroca : pode).push(item);
          return;
        }
        var porque = motivo(mil, !!u.editando);
        if (!porque) return;
        var apagado = Q.itemServico({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, disp: mil.janelas });
        apagado.inativo = true;
        apagado.info = porque;
        nao.push(apagado);
      });
    });
    var lista = [];
    if (pode.length) lista = lista.concat([{ titulo: M().grupoCiclo }], pode);
    if (porTroca.length) lista = lista.concat([{ titulo: M().grupoTroca }], porTroca);
    if (nao.length) lista = lista.concat([{ titulo: M().grupoNao }], nao);
    return lista;
  }

  /* ele muda o dia por aqui: está na lista Quem, pelo ciclo ou por troca, ou veio de outro dia (o Muda para outra data; o
     menu da linha só mostra o item a quem pode) */
  function podeMudar(cpf) {
    var dados = ed().dados();
    if (!dados) return false;
    return itensQuem(dados).some(function (i) { return i.cpf === cpf && !i.inativo && !i.titulo; })
      || !!mudancaDe(ed().militarDoDia(cpf));
  }

  /* a sub-tela do painel. opcoes = { cpf }: chega com ele escolhido (o menu da linha) */
  function abrir(opcoes) {
    if (!ed().dados()) return;
    ed().abrir(function (corpo) { criar(opcoes, function (tela) { corpo.appendChild(tela); }); });
  }

  /* as perguntas numa tela. opcoes = { cpf }: chega com ele escolhido; pendurar(tela) põe a tela na página (a sub-tela do
     painel ou a caixa 2 da célula), antes da primeira resposta. Devolve o que a caixa da célula usa: pelaMetade() (o dia
     novo escolhido e falta resposta, ou o banco recusa: a caixa segura o clique fora) e marcarFalta() */
  function criar(opcoes, pendurar) {
    var api = ed(), H = api.horas;
    var dados = api.dados();
    if (!dados) return null;
    var uid = api.unidadeId(), deIso = api.iso(), data = diaMes(deIso);
    /* item: quem (o item da lista, com .mil e .janelas = as que mudam); janela: a que muda; para: o dia novo; horario: o
       valor do Serviço inteiro / Parte do serviço */
    var est = { item: null, janela: null, para: null, horario: null };
    var dias = null;         // a situação dele em cada dia que o banco aceita: AAAA-MM-DD -> resposta (null enquanto lê)
    var dadosNovo = {};      // a leitura de cada dia novo: AAAA-MM-DD -> dados
    var metade = false, recusa = false;   // a resposta de agora: escolhido o dia novo, falta resposta; o banco recusa
    var tela = null, el = {}, combo = null, horario = null, onde = null, ondeCaixa = null, conf = null;
    var pedidoDias = 0, pedidoDia = 0, carregandoDias = false, carregandoDia = false;

    /* ---------- montagem ---------- */

    tela = RosterWork.tpl('tpl-escala-mudar-dia');
    if (!tela) return null;
    var q = function (s) { return tela.querySelector(s); };
    el = {
      combo: q('.escala-mudar-dia-combo'), ajuda: q('.escala-mudar-dia-ajuda'), servico: q('.escala-mudar-dia-servico'),
      janelas: q('.escala-mudar-dia-janelas'), janelasLista: q('.escala-mudar-dia-janelas-lista'),
      dia: q('.escala-mudar-dia-dia'), campoDia: q('.escala-mudar-dia-campo-dia'), situacao: q('.escala-mudar-dia-situacao'),
      carregando: q('.escala-mudar-dia-carregando'),
      horario: q('.escala-mudar-dia-horario'), periodo: q('.escala-mudar-dia-periodo'), parte: q('.escala-mudar-dia-parte'),
      onde: q('.escala-mudar-dia-onde'), conferindo: q('.escala-mudar-dia-conferindo'), papel: q('.escala-mudar-dia-papel'),
      minimo: q('.escala-mudar-dia-minimo'), erro: q('.escala-mudar-dia-erro')
    };
    /* dentro de outra sub-tela (o Muda para outra data do Remover deste dia): sem o título e sem o Quem */
    if (opcoes && opcoes.dentro) { mostra(q('.subtela-cab'), false); mostra(q('.escala-mudar-dia-quem'), false); }
    var inp = el.combo.querySelector('input');
    inp.id = 'escala-mudar-dia-campo-' + (++conta);
    combo = RosterWork.comboMilitar.criar(inp, el.combo.querySelector('.dropdown-menu'), {
      atual: function () { return est.item; },
      aoEscolher: escolher,
      aoPerder: function () { est.item = null; },
      textos: { selecione: msg().linha.digiteOuEscolha, semNinguem: M().ninguem, filtroVazio: msg().ninguemEncontrado }
    });
    /* o dia novo: o campo de data padrão, e o calendário abre por cima (dentro da caixa da pergunta, fora do rótulo do
       campo), já no dia escolhido ou no de antes, com acesos só os dias em que ele pode ficar */
    RosterWork.calendario.ligar(el.campoDia, {
      ancora: el.dia,
      obterData: function () { return dataDeIso(est.para || deIso); },
      permiteDia: function (d) { var x = dias && dias[iso(d)]; return !!x && (x.estado === 'pode' || x.estado === 'seguidas'); },
      aoEscolher: function (d) { escolherDia(iso(d)); }
    });
    horario = RosterWork.horario.periodoServico(el.periodo, {
      aoMudar: function (v) { est.horario = v; atualizar(); }
    });
    /* o Onde fica do dia novo, com as vagas sem ninguém no horário */
    ondeCaixa = RosterWork.tpl('tpl-escala-onde-fica');
    el.onde.appendChild(ondeCaixa);
    onde = RosterWork.escalasPainelOnde.criar(ondeCaixa, {
      dados: function () { return est.para ? dadosNovo[est.para] : null; },
      periodos: function () { var p = periodoQueMuda(); return p ? [p] : []; },
      cpf: function () { return est.item ? est.item.cpf : ''; },
      vagas: true,
      aoMudar: atualizar
    });
    /* o banco confere (escalas-painel-mudar-dia-conferir.js) */
    conf = RosterWork.escalasPainelMudarDiaConferir.criar({
      el: el, dados: dados, uid: uid, data: data,
      item: function () { return est.item; },
      dadosNovo: function (dia) { return dadosNovo[dia]; },
      vivo: function () { return tela.isConnected; },
      aoConferir: atualizar
    });

    /* ---------- as respostas ---------- */

    function escolher(item) {
      est.item = item;
      est.janela = item.janelas.length === 1 ? item.janelas[0] : null;
      est.para = null;
      el.campoDia.value = '';
      conf.limpar();
      montarJanelas();
      definirJanela();
      onde.reiniciar();
      lerDias();
      atualizar();
    }

    /* Qual parte muda: só com o serviço pelo ciclo ou por troca dividido no dia (uma parte de cada vez) */
    function montarJanelas() {
      el.janelasLista.textContent = '';
      if (est.item.janelas.length < 2) return;
      var nome = 'escala-mudar-dia-janela-' + (++conta);
      est.item.janelas.forEach(function (j) {
        var op = RosterWork.tpl('tpl-escala-remover-parte');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nome;
        r.addEventListener('change', function () {
          if (!r.checked) return;
          est.janela = j;
          definirJanela();
          onde.reiniciar();
          atualizar();
        });
        op.querySelector('.escala-remover-parte-texto').textContent = msg().linha.parte(j.origem === 'troca' ? 'troca' : 'ciclo', msg().dasAs(H.curta(j.hi), H.curta(j.hf)));
        el.janelasLista.appendChild(op);
      });
    }

    /* o Horário começa com a janela inteira */
    function definirJanela() {
      horario.definirServico(est.janela ? { hi: est.janela.hi, hf: est.janela.hf } : null);
      est.horario = horario.valor();
    }

    /* as horas que mudam (null enquanto o horário não vale) */
    function periodoQueMuda() {
      var v = est.horario;
      return v && v.valido ? { hi: v.hi, hf: v.hf } : null;
    }

    /* ---------- o dia novo ---------- */

    /* a situação dele no dia (a leitura da escala_mudar_dia_dias) */
    function respostaDoDia(diaIso) { return dias ? dias[diaIso] || null : null; }

    /* a situação dele em cada dia que o banco aceita (de hoje − 7 até o fim da escala calculada), lida ao escolher quem
       muda: duas leituras de 63 dias juntas e, se a escala calculada passar delas, as que faltam. O campo do dia liga
       quando tudo chega (o calendário acende só os dias que já conhece) */
    function lerDias() {
      var meu = ++pedidoDias, cpf = est.item.cpf, inicio = somarDias(iso(new Date()), -7), lidos = {};
      dias = null;
      carregandoDias = true;
      function ler(de, ate) {
        var pedidos = [];
        for (var i = de; i < ate; i++) {
          /* o Muda para outra data: o p_de é o dia novo da mudança (o aberto, ou o paraIso, pelo dia de antes) */
          pedidos.push(RosterWork.escalasDados.mudarDiaDias(uid, cpf, (est.item.veio && est.item.veio.paraIso) || deIso,
            somarDias(inicio, i * LEITURA), somarDias(inicio, (i + 1) * LEITURA - 1), est.item.veio ? est.item.veio.id : null));
        }
        Promise.all(pedidos).then(function (rs) {
          if (meu !== pedidoDias || !tela.isConnected) return;
          var ruins = rs.filter(function (r) { return !r || r.erro; });
          if (ruins.length) {
            carregandoDias = false;
            RosterWork.avisar({ tipo: 'erro', mensagem: (ruins[0] && ruins[0].erro) || RosterWork.falha.frase(msg().falhaCarregar) });
            atualizar();
            return;
          }
          rs.forEach(function (r) { Object.keys(r.dias || {}).forEach(function (k) { lidos[k] = r.dias[k]; }); });
          var fim = String(rs[0].fim || '').slice(0, 10), coberto = somarDias(inicio, ate * LEITURA - 1);
          if (fim > coberto) { ler(ate, ate + Math.ceil(diasEntre(coberto, fim) / LEITURA)); return; }
          dias = lidos;
          carregandoDias = false;
          atualizar();
        });
      }
      ler(0, 2);
    }

    /* o dia escolhido no calendário: o campo mostra a data, a leitura dele chega (o Onde fica) e o Onde fica volta ao
       começo. O dia com alteração não salva na mesma unidade (o rascunho de vários dias, escalas-rascunho-dias.js) não
       entra: as duas mudariam o mesmo dia, e ela é gravada antes */
    function escolherDia(diaIso) {
      var G = RosterWork.escalasRascunhoDias;
      if (G && G.porDia().some(function (d) { return String(d.unidadeId) === String(uid) && d.iso === diaIso; })) {
        RosterWork.avisar({ tipo: 'aviso', mensagem: M().salveAntes(diaMes(diaIso)) });
        return;
      }
      est.para = diaIso;
      el.campoDia.value = RosterWork.data.isoParaBR(diaIso);
      conf.limpar();
      onde.reiniciar();
      lerDiaNovo();
      atualizar();
    }

    function lerDiaNovo() {
      var dia = est.para;
      if (!dia || dadosNovo[dia]) { carregandoDia = false; return; }
      var meu = ++pedidoDia;
      carregandoDia = true;
      RosterWork.escalasDados.lerDistribuicaoDia(uid, dia).then(function (d) {
        if (meu !== pedidoDia || !tela.isConnected) return;
        carregandoDia = false;
        if (!d) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.falha.frase(msg().falhaCarregar) });
        else dadosNovo[dia] = d;
        atualizar();
      });
    }

    /* embaixo do campo, a situação dele no dia novo: a folga em volta (ou as horas seguidas, sem ela) e as vagas sem
       ninguém no dia */
    function textoDoDia(d) {
      if (!d) return '';
      var t = d.estado === 'seguidas' ? M().diaSeguidas(d.horas) : M().diaPode;
      return d.faltas > 0 ? t + ' ' + M().diaVagas(d.faltas) : t;
    }

    /* ---------- desenho ---------- */

    /* "das 08h às 08h" (o serviço dele que muda, cada janela) */
    function textoJanelas(js) { return js.map(function (j) { return msg().dasAs(H.curta(j.hi), H.curta(j.hf)); }).join(' e '); }
    /* o serviço dele aqui que fica no dia de antes (fora as horas que mudam): o texto, vazio quando sai todo */
    function textoResto(periodo) {
      var resto = H.menos(H.uniao(est.item.mil.janelas.map(H.faixa)), [H.faixa(periodo)]);
      return resto.length ? H.textoPeriodos(resto.map(H.periodo)) : '';
    }

    /* redesenha com as respostas de agora (também quando chega uma leitura ou a conferência do banco: as listas abertas
       ficam abertas). Escolhido o dia novo, a resposta pela metade (o horário fora do serviço ou o Onde fica sem a
       escolha) e a recusa do banco desligam o Salvar */
    function atualizar() {
      if (!tela.isConnected) return;
      ['janelas', 'dia', 'situacao', 'horario', 'parte', 'conferindo', 'papel', 'minimo', 'erro'].forEach(function (k) { mostra(el[k], false); });
      [el.horario, ondeCaixa].forEach(function (c) { c.classList.remove('grupo-caixa--erro'); });
      mostra(ondeCaixa, false);
      mostra(el.ajuda, !est.item);
      mostra(el.servico, !!est.item);
      mostra(el.carregando, carregandoDias || carregandoDia);
      el.campoDia.disabled = !dias;
      metade = false;
      recusa = false;
      /* falta resposta (true) até o Onde fica */
      var falta = (function () {
        if (!est.item) return true;
        var diaServico = est.item.veio && est.item.veio.paraIso ? diaMes(est.item.veio.paraIso) : data;   // onde ele está de serviço
        el.servico.textContent = M().servico(diaServico, textoJanelas(est.item.janelas), soTroca(est.item.janelas),
          est.item.veio ? est.item.veio.de : '');
        if (est.item.janelas.length > 1) { mostra(el.janelas, true); if (!est.janela) return true; }
        mostra(el.dia, true);
        if (!est.para) return true;
        el.situacao.textContent = textoDoDia(respostaDoDia(est.para));
        mostra(el.situacao, !!el.situacao.textContent);
        /* o Muda para outra data leva o serviço inteiro: sem o Horário */
        mostra(el.horario, !est.item.veio);
        var periodo = periodoQueMuda();
        if (!periodo) { metade = true; return true; }
        /* a frase da parte: só quando muda menos que o serviço (o serviço todo, como no Serviço inteiro, não tem frase) */
        if (H.faixa(periodo).join() !== H.faixa(est.janela).join()) {
          el.parte.textContent = M().parte(diaMes(est.para), H.textoPeriodos([periodo]), data, textoResto(periodo));
          mostra(el.parte, true);
        }
        if (!dadosNovo[est.para]) return true;
        mostra(ondeCaixa, true);
        onde.atualizar();
        metade = onde.falta();
        return metade;
      })();
      if (falta) { api.aoVivo(null, metade); return; }
      var v = est.item.veio;
      var item = { cpf: est.item.cpf, para: est.para, periodos: [periodoQueMuda()], onde: onde.paraBanco() };
      if (v) item.remarcar = v.id;
      var chave = JSON.stringify(item);
      var c = conf.resultado(chave);
      recusa = metade = !!c && !!c.erro;
      api.aoVivo(function () {
        /* pelo dia de antes: o outro dia é o dia novo de agora, e as colocações do dia aberto não mudam */
        if (v) api.remarcarMudanca(v.id, item.para, item.onde, v.paraIso || v.deIso, v.paraIso ? null : item.cpf, v.paraIso ? null : v.periodos);
        else api.mudarDia(item);
      }, recusa);
      conf.mostrar(item, c);
      if (!c) conf.agendar(item, chave);
    }

    /* o clique fora com a resposta pela metade (a caixa da célula): a pergunta que falta fica marcada (o horário fora do
       serviço ou o Onde fica sem a escolha) e, sem a recusa do banco na tela, a frase de responder ou fechar embaixo; a
       próxima resposta tira as duas */
    function marcarFalta() {
      if (!metade || !tela.isConnected) return;
      var falta = !periodoQueMuda() ? el.horario : onde.falta() ? ondeCaixa : null;
      if (falta) falta.classList.add('grupo-caixa--erro');
      if (recusa) return;
      el.erro.querySelector('.nota-texto').textContent = msg().responderOuDesistir;
      mostra(el.erro, true);
    }

    /* ---------- começo ---------- */

    pendurar(tela);
    var itens = itensQuem(dados);
    combo.preencher(itens);
    var pedidoCpf = opcoes && opcoes.cpf;
    /* quem veio de outro dia (o Muda para outra data: opcoes.mudanca, ou ele só está aqui por ela) chega escolhido, e o
       Quem não troca */
    var veio = (opcoes && opcoes.mudanca) || (pedidoCpf ? mudancaDe(api.militarDoDia(pedidoCpf)) : null);
    var ja = pedidoCpf ? itens.filter(function (i) { return i.cpf === pedidoCpf && !i.inativo && !i.titulo; })[0] : null;
    if (veio) {
      /* pelo dia de antes (veio.paraIso), ele não está de serviço aqui: o nome vem da mudança */
      var mil = api.militarDoDia(pedidoCpf) || { cpf: pedidoCpf, grad: veio.grad, nome: veio.nome, janelas: veio.janelas };
      ja = RosterWork.escalasPainelQuem.itemServico({ cpf: mil.cpf, grad: mil.grad, nome: mil.nome, disp: veio.janelas });
      ja.mil = mil;
      ja.janelas = veio.janelas;
      ja.veio = veio;
      inp.disabled = true;
    }
    if (ja) { escolher(ja); combo.mostrarAtual(); }
    else atualizar();
    return { pelaMetade: function () { return metade; }, marcarFalta: marcarFalta };
  }

  window.RosterWork.escalasPainelMudarDia = { abrir: abrir, criar: criar, podeMudar: podeMudar, mudancaDe: mudancaDe,
    mudancaDaFolga: mudancaDaFolga };
})();
