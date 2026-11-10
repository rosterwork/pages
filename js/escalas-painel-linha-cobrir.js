/* ============================================================
   ESCALAS — o Quem cobre da vaga sem ninguém (o Pôr um militar aqui
   do menu da linha; só admin), dentro do cartão embaixo da linha
   (escalas-painel-linha.js). Cada pergunta numa caixa numerada, só
   as que valem e sem nada marcado:
   - Quem cobre: a Unidade (as que têm alguém que pode, a do painel
     primeiro) e o Militar, só daquela unidade (escalas-painel-quem.js
     › itensCobrir: de folga, aberto; de serviço; não podem);
   - de folga no pelotão do painel: Folga em outro dia (sim, não, ou
     pela Extrajornada para quem pediu o dia); no sim, o Dia da folga
     (o calendário com os dias de serviço dele: o serviço desse dia
     passa para o da vaga, a mudança de dia com o "de"); no não, o
     Banco de horas (o serviço a mais, como o Adicionar militar);
   - de folga em outra unidade: o Banco de horas;
   - de serviço em outra unidade: Na unidade de origem (fica só aqui
     ou nas duas, como o Remanejar), com o motivo escrito pelo
     sistema;
   - de serviço neste dia: o caminho de sempre do cartão (o Horário e
     a troca de lugar), que fica com o escalas-painel-linha.js.
   A resposta completa entra no rascunho ao vivo, pelo cartão, com o
   mesmo código do Adicionar (aplicarColocacao), do Mudar o dia
   (mudarDia) e do Remanejar (cortarNaOrigem e remanejar).
   API: RosterWork.escalasPainelLinhaCobrir.criar(cfg) devolve { jeito(),
   candidato(), horario(), desenhar(), pronto(), aplicar(), efeito() };
   cfg = { q (o seletor do cartão), cfg (o da linha: posto, funcao), original
   (os horários da vaga), unidadeNome, aoDoDia(item) (quem está de serviço
   neste dia: o cartão segue), aoMudar() (redesenha o cartão), sair() (a
   Extrajornada: o cartão fecha e a aba abre) }
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var conta = 0;   // nome único para os rádios de cada cartão

  /* Chefe de Socorro e Oficial de Área: o sistema escolhe quem fica com a função */
  var PAPEL = /^(chefe de socorro|oficial de área)$/i;

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function Q() { return RosterWork.escalasPainelQuem; }
  function R() { return RosterWork.escalasPainelRemanejarListas; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function mostra(no, sim) { no.classList.toggle('oculto', !sim); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diaMes(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function inicioDoMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  /* as bolinhas de uma caixa: cada escolha chama aoEscolher(valor); devolve marcar(valor) */
  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-linha-cobrir-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function (valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  function criar(cfg) {
    var api = ed(), H = api.horas, q = cfg.q, linha = cfg.cfg;
    var uid = String(api.unidadeId()), dia = api.iso(), hoje = iso(new Date());
    var el = {
      titulo: q('.escala-linha-militar-titulo'), tituloCobre: q('.escala-linha-cobre-titulo'), lendo: q('.escala-linha-cobre-carregando'),
      unidadeCampo: q('.escala-linha-unidade-campo'), unidade: q('.escala-linha-unidade'), rotulo: q('.escala-linha-militar-rotulo'),
      folga: q('.escala-linha-folga'), folgaExtra: q('.escala-linha-folga-extra'),
      diaFolga: q('.escala-linha-dia-folga'), mes: q('.escala-linha-mes'), carregando: q('.escala-linha-mes-carregando'),
      anterior: q('.escala-linha-mes-anterior'), proximo: q('.escala-linha-mes-proximo'), calendario: q('.escala-linha-calendario'),
      banco: q('.escala-linha-banco'), contabilizar: q('.escala-linha-contabilizar'),
      origem: q('.escala-linha-origem'), origemPergunta: q('.escala-linha-origem-pergunta'),
      origemSim: q('.escala-linha-origem-sim'), origemNao: q('.escala-linha-origem-nao')
    };
    el.unidadeVazio = el.unidade.querySelector('.campo-selecao-texto').textContent;
    /* os pontos de quem espera o banco: o mês do Dia da folga e o dia da outra unidade */
    [el.carregando, el.lendo].forEach(function (lugar) { var p = RosterWork.tpl('carregando-pontos'); if (p) lugar.appendChild(p); });
    /* resp = a lista do banco; unidade = a escolhida; item/c = quem cobre; jeito = 'folga' | 'dia' | 'outra'; folga = 'sim'
       | 'nao' | null; dia = o dia da folga; banco = 'sim' | 'nao' | null; origem = 'sai' | 'fica' | null; outra = o dia da
       unidade dele (de serviço em outra unidade) e o serviço dele lá; lendoOutra = esse dia ainda não chegou */
    var est = { resp: null, unidades: [], unidade: uid, item: null, c: null, jeito: null, folga: null, dia: null, banco: null,
      origem: null, outra: null, servicoOutra: null, lendoOutra: false, mes: inicioDoMes(dataDeIso(dia)), carregandoMes: false };
    var meses = {}, pedido = 0, pedidoMes = 0, combo = null;

    /* ---------- Quem cobre: a Unidade e o Militar ---------- */

    mostra(el.titulo, false);
    mostra(el.tituloCobre, true);
    mostra(el.unidadeCampo, true);
    mostra(el.rotulo, true);
    var inp = q('.escala-linha-combo input');
    inp.id = 'escala-linha-cobrir-campo-' + (++conta);
    combo = RosterWork.comboMilitar.criar(inp, q('.escala-linha-combo .dropdown-menu'), {
      atual: function () { return est.item; },
      aoEscolher: escolher,
      textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemPode, filtroVazio: msg().ninguemEncontrado }
    });
    combo.habilitar(false);
    combo.definir(L().carregando, true);

    function nomeDaUnidade(id) { return ((est.unidades.filter(function (u) { return u.id === String(id); })[0]) || {}).nome || ''; }

    function montarUnidades() {
      var menu = el.unidade.querySelector('.dropdown-menu');
      menu.textContent = '';
      est.unidades.forEach(function (u) {
        var it = RosterWork.tpl('tpl-escala-unidade-item');
        if (!it) return;
        it.textContent = u.nome;
        it.addEventListener('click', function () {
          if (u.id === est.unidade) return;
          est.unidade = u.id;
          limparEscolha();
          montarUnidades();
          preencherLista();
          cfg.aoMudar();
        });
        menu.appendChild(it);
      });
      var t = el.unidade.querySelector('.campo-selecao-texto');
      var nome = nomeDaUnidade(est.unidade);
      t.textContent = nome || el.unidadeVazio;
      t.classList.toggle('campo-selecao-texto--vazio', !nome);
      el.unidade.querySelector('.campo-selecao').disabled = !est.unidades.length;
    }
    function preencherLista() {
      combo.preencher(Q().itensCobrir(est.resp, est.unidade, uid, nomeDaUnidade(est.unidade)));
    }

    var vaga = { viatura_id: linha.posto.tipo === 'viatura' ? linha.posto.id : null,
      instalacao_id: linha.posto.tipo === 'instalacao' ? linha.posto.id : null, funcao: linha.funcao,
      periodos: cfg.original.map(function (p) { return { hi: p.hi, hf: p.hf }; }), cpf: null };
    RosterWork.escalasDados.disponiveis(uid, dia, uid, vaga).then(function (resp) {
      if (!inp.isConnected) return;
      if (!resp) { combo.definir(msg().falhaCarregar, true); return; }
      est.resp = resp;
      est.unidades = Q().unidadesCobrir(resp, uid, cfg.unidadeNome);
      if (!est.unidades.some(function (u) { return u.id === est.unidade; }) && est.unidades.length) est.unidade = est.unidades[0].id;
      montarUnidades();
      preencherLista();
    });

    /* ---------- a escolha e as perguntas ---------- */

    function limparEscolha() {
      est.item = null; est.c = null; est.jeito = null;
      limparRespostas();
    }
    function limparRespostas() {
      est.folga = null; est.dia = null; est.banco = null; est.origem = null; est.outra = null; est.servicoOutra = null;
      est.lendoOutra = false;
      marcarFolga(null); marcarBanco(null); marcarOrigem(null);
    }
    var marcarFolga = ligarRadios(el.folga, function (v) {
      est.folga = v; est.dia = null; est.banco = null;
      marcarBanco(null);
      if (v === 'extra') { cfg.sair(); return; }
      if (v === 'sim') { est.mes = inicioDoMes(dataDeIso(dia)); lerMes(); }
      cfg.aoMudar();
    });
    var marcarBanco = ligarRadios(el.banco, function (v) { est.banco = v; cfg.aoMudar(); });
    var marcarOrigem = ligarRadios(el.origem, function (v) { est.origem = v; cfg.aoMudar(); });

    /* quem cobre: o de serviço neste dia segue o cartão; o de folga e o de outra unidade, as perguntas daqui */
    function escolher(item) {
      est.item = item; est.c = item.c || null; est.jeito = item.situacao || null;
      limparRespostas();
      if (est.jeito === 'dia') { cfg.aoDoDia(item); return; }
      if (est.jeito === 'outra') lerOutra();
      cfg.aoMudar();
    }

    /* de serviço em outra unidade: o dia de lá (as colocações dele, que saem com ele, e se o serviço é extra) */
    function lerOutra() {
      var meu = ++pedido, cpf = est.item.cpf;
      est.lendoOutra = true;
      RosterWork.escalasDados.lerDistribuicaoDia(est.unidade, dia).then(function (d) {
        if (meu !== pedido || !inp.isConnected || !est.item || est.item.cpf !== cpf) return;
        est.lendoOutra = false;
        if (!d) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); cfg.aoMudar(); return; }
        est.outra = d;
        est.servicoOutra = R().deServico(d).filter(function (i) { return i.cpf === cpf; })[0] || null;
        cfg.aoMudar();
      });
    }
    function extraNaOutra() { return !!est.servicoOutra && R().temExtra(est.servicoOutra); }
    function noPelotao() { return est.unidade === uid; }

    /* ---------- o Dia da folga ---------- */

    function chaveMes(d) { return est.item.cpf + '|' + iso(d).slice(0, 7); }
    function infoDoDia(diaIso) {
      var r = est.item && meses[chaveMes(dataDeIso(diaIso))];
      return r && r.dias ? r.dias[diaIso] || null : null;
    }
    function lerMes() {
      if (!est.item) return;
      var chave = chaveMes(est.mes);
      if (meses[chave]) { est.carregandoMes = false; desenharCalendario(); return; }
      var meu = ++pedidoMes, mes = est.mes, fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
      est.carregandoMes = true;
      desenharCalendario();
      RosterWork.escalasDados.diaDaFolgaDias(uid, est.item.cpf, dia, iso(mes), iso(fim)).then(function (r) {
        if (meu !== pedidoMes || !inp.isConnected) return;
        est.carregandoMes = false;
        if (!r || r.erro) { RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.erro) || msg().falhaCarregar }); desenharCalendario(); return; }
        meses[chave] = r;
        desenharCalendario();
      });
    }
    function trocarMes(passo) { est.mes = new Date(est.mes.getFullYear(), est.mes.getMonth() + passo, 1); lerMes(); }
    el.anterior.addEventListener('click', function () { trocarMes(-1); });
    el.proximo.addEventListener('click', function () { trocarMes(1); });

    function desenharCalendario() {
      if (!est.item || est.folga !== 'sim' || !el.calendario.isConnected) return;
      var r = meses[chaveMes(est.mes)];
      el.mes.textContent = msg().mudarDia.mes(MESES[est.mes.getMonth()], est.mes.getFullYear());
      mostra(el.carregando, est.carregandoMes);
      var limite = r && r.limite ? String(r.limite).slice(0, 10) : null, fim = r && r.fim ? String(r.fim).slice(0, 10) : null;
      el.anterior.disabled = !!limite && est.mes.getTime() <= inicioDoMes(dataDeIso(limite)).getTime();
      el.proximo.disabled = !!fim && est.mes.getTime() >= inicioDoMes(dataDeIso(fim)).getTime();
      RosterWork.miniCalendario.renderizar(el.calendario, {
        dataRef: est.mes,
        aoDia: function (botao, diaIso) { pintarDia(botao, diaIso, r && r.dias ? r.dias[diaIso] : null); }
      });
    }

    /* um dia: o da vaga (tracejado), os dias de serviço dele (o clique escolhe a folga), as vagas sem ninguém (o número
       vermelho); os outros, apagados */
    function pintarDia(botao, diaIso, d) {
      var texto = botao.querySelector('.mini-calendario-texto'), numero = botao.querySelector('.mini-calendario-conta');
      if (diaIso === hoje) botao.classList.add('mini-calendario-dia--hoje');
      var servico = !!d && d.estado === 'servico';
      botao.disabled = !servico;
      if (d && d.faltas > 0) { numero.textContent = String(d.faltas); numero.classList.add('mini-calendario-conta--erro'); }
      if (d && d.estado === 'para') { botao.classList.add('mini-calendario-dia--origem'); texto.textContent = L().diaCobre; return; }
      if (!servico) { botao.classList.add('mini-calendario-dia--inativo'); return; }
      var escolhido = diaIso === est.dia;
      if (escolhido) botao.classList.add('mini-calendario-dia--selecionado');
      texto.textContent = escolhido ? L().diaFolga : L().diaServico;
      botao.addEventListener('click', function () { est.dia = diaIso; desenharCalendario(); cfg.aoMudar(); });
    }

    /* ---------- desenho ---------- */

    function desenhar() {
      var folga = est.jeito === 'folga', perguntaFolga = folga && noPelotao();
      mostra(el.lendo, est.jeito === 'outra' && est.lendoOutra);
      mostra(el.folga, perguntaFolga);
      mostra(el.folgaExtra, perguntaFolga && !!est.c && !!est.c.quer_extra && RosterWork.escalasPainel.temAba('extra'));
      mostra(el.diaFolga, perguntaFolga && est.folga === 'sim');
      mostra(el.banco, folga && (!noPelotao() || est.folga === 'nao'));
      el.contabilizar.textContent = L().bancoSim(H.horasTexto(H.uniao(cfg.original.map(H.faixa)).reduce(function (s, f) { return s + f[1] - f[0]; }, 0)));
      var perguntaOrigem = est.jeito === 'outra' && !!est.outra && !extraNaOutra();
      mostra(el.origem, perguntaOrigem);
      if (perguntaOrigem) {
        var nome = nomeDe(est.item), de = nomeDaUnidade(est.unidade), aqui = cfg.unidadeNome;
        el.origemPergunta.textContent = L().remanejarSai(nome, de);
        el.origemSim.textContent = L().remanejarSoNa(aqui);
        el.origemNao.textContent = L().remanejarNasDuas(de, aqui);
      }
      desenharCalendario();
    }

    /* a resposta está completa (a pergunta pela metade deixa o Salvar desligado) */
    function pronto() {
      if (est.jeito === 'folga') {
        if (!noPelotao()) return !!est.banco;
        return est.folga === 'sim' ? !!est.dia : est.folga === 'nao' && !!est.banco;
      }
      if (est.jeito === 'outra') return !!est.outra && (extraNaOutra() || !!est.origem);
      return false;
    }

    /* as horas da vaga dentro das horas dele (a colocação de quem vem de outra unidade) */
    function horasNaVaga(janelas) {
      var xs = [];
      (janelas || []).forEach(function (j) {
        cfg.original.forEach(function (p) { var x = H.cruza(H.faixa(p), H.faixa(j)); if (x) xs.push(x); });
      });
      return xs.length ? H.uniao(xs).map(H.periodo) : cfg.original.map(function (p) { return { hi: p.hi, hf: p.hf }; });
    }

    /* põe a resposta no rascunho (dentro do ao vivo do cartão), com o código de cada caminho */
    function aplicar() {
      var cpf = est.item.cpf;
      var naFuncao = { tipo: 'funcao', nome_funcao: linha.funcao, viatura_id: linha.posto.tipo === 'viatura' ? linha.posto.id : null,
        instalacao_id: linha.posto.tipo === 'instalacao' ? linha.posto.id : null };
      if (est.jeito === 'folga' && noPelotao() && est.folga === 'sim') {
        /* a folga em outro dia: o serviço do dia escolhido passa para o da vaga, nesta função (só nas horas da vaga, quando
           ela não cobre o serviço todo) */
        var d = infoDoDia(est.dia) || {}, j = H.faixa({ hi: d.hi || '08:00', hf: d.hf || '08:00' }), v = H.uniao(cfg.original.map(H.faixa));
        if (!(v.length === 1 && v[0][0] === j[0] && v[0][1] === j[1])) naFuncao.periodos = cfg.original.map(function (p) { return { hi: p.hi, hf: p.hf }; });
        api.mudarDia({ cpf: cpf, de: est.dia, para: dia, periodos: [], onde: naFuncao });
        return;
      }
      if (est.jeito === 'folga') {
        /* o serviço a mais: entra como no Adicionar militar, na vaga, com o banco de horas */
        api.aplicarColocacao({ cpf: cpf, posto: linha.posto, funcao: linha.funcao, periodos: cfg.original.map(function (p) { return { hi: p.hi, hf: p.hf }; }),
          sistema: false, pontual: { contabilizar: est.banco === 'sim' }, dados: api.dados() });
        return;
      }
      /* de outra unidade: o remanejamento, como no Remanejar (Trazer para esta unidade), já na vaga */
      var fica = est.origem === 'fica' && !extraNaOutra();
      if (!fica) R().cortarNaOrigem(api.rascunho(), cpf, est.outra);
      api.aplicarColocacao({ cpf: cpf, posto: linha.posto, funcao: linha.funcao, periodos: horasNaVaga(est.servicoOutra && est.servicoOutra.janelas),
        sistema: false, pontual: null, dados: api.dados() });
      api.remanejar([{ cpf: cpf, origem: Number(est.unidade), destino: Number(uid), fica: fica,
        motivo: L().motivoCobrir(api.funcaoNoPosto(linha.funcao, linha.posto), diaMes(dia)) }]);
    }

    /* o que acontece, na nota do cartão: { texto, alerta } */
    function efeito() {
      if (!est.item) return null;
      var nome = nomeDe(est.item);
      if (est.jeito === 'folga' && noPelotao() && est.folga === 'sim' && est.dia) {
        var d = infoDoDia(est.dia) || {};
        return { texto: L().efeitoFolgaOutroDia(nome, diaMes(dia), diaMes(est.dia), L().ficamNoDia(d.fica || 0, d.minimo)),
          alerta: !!d.minimo && d.fica < d.minimo };
      }
      if (est.jeito === 'outra' && est.outra && (extraNaOutra() || est.origem)) {
        /* a nota do Remanejar; quem sai da unidade dele deixa lá os lugares vazios */
        var de = nomeDaUnidade(est.unidade), nota = L().remanejarNota(cfg.unidadeNome, de);
        if (est.origem === 'fica' && !extraNaOutra()) return { texto: nota, alerta: false };
        /* o Chefe de Socorro e o Oficial de Área não ficam vazios: o sistema põe outro */
        var deixa = ((est.c && est.c.funcoes) || []).filter(function (f) { return !PAPEL.test(f.funcao); });
        var sai = L().efeitoCobrirSai(nome, Q().lugares(deixa), de);
        return { texto: sai + (extraNaOutra() ? ' ' + L().remanejarExtraContinua : '') + ' ' + nota, alerta: false };
      }
      return null;
    }

    return {
      jeito: function () { return est.jeito; },
      candidato: function () { return est.c; },
      horario: function () { return est.jeito === 'dia'; },
      desenhar: desenhar,
      pronto: pronto,
      aplicar: aplicar,
      efeito: efeito
    };
  }

  window.RosterWork.escalasPainelLinhaCobrir = { criar: criar };
})();
