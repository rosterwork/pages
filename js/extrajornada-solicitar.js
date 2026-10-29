/* ============================================================
   EXTRAJORNADA — painel Solicitar extra (o mês em aberto)
   O botão da aba Calendário abre SEMPRE o mês em aberto (o próximo
   mês) no painel: 1. voluntário (sim ou não), 2. cotas e o
   fechar 24 h, 3. datas (mini calendário: quero / não posso, com
   quantos querem cada dia no canto, no Total ou na unidade dele) e
   4. o termo do eProtocolo (o administrador marca). Até o prazo da
   companhia dá para enviar e mudar; depois vira Minha solicitação,
   só para ver. Grava em extra_disponibilidade_salvar e abre o resumo.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaSolicitar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MAX = 10;   // datas em cada lista (quero / não posso)

  var info = null;      // a última leitura do mês em aberto (extra_disponibilidade_carregar)
  var aberto = false;   // o painel está aberto por este módulo
  var r = null;         // a leitura que o painel aberto mostra
  var rasc = null;      // { voluntario: null|true|false, cotas, fecha24, quer: [], nao: [] }
  var limpo = null;     // o rascunho como veio do banco (para saber se mudou)
  var escopo = 'total';
  var el = {};
  var guardaLigada = false;

  function msg() { return RW.mensagens.extrajornada.solicitar; }
  function isoMes(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function ddmm(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function mesDe(s) { return MESES[Number(String(s).split('-')[1]) - 1]; }
  function editavel() { return !!r && r.estado_janela === 'editavel'; }
  function retrato() { return JSON.stringify({ v: rasc.voluntario, c: rasc.cotas, f: rasc.fecha24, q: rasc.quer.slice().sort(), n: rasc.nao.slice().sort() }); }
  function sujo() { return aberto && !!rasc && limpo !== null && retrato() !== limpo; }
  function marcacao(dia) { return rasc.quer.indexOf(dia) >= 0 ? 'quer' : (rasc.nao.indexOf(dia) >= 0 ? 'nao_quer' : null); }
  function tirar(lista, dia) { var i = lista.indexOf(dia); if (i >= 0) lista.splice(i, 1); }

  /* o mês em aberto é sempre o próximo (o banco diz se ainda está no prazo) */
  function carregar() {
    var h = new Date();
    var prox = new Date(h.getFullYear(), h.getMonth() + 1, 1);
    if (!RW.extrajornadaDados) return Promise.resolve(null);
    return RW.extrajornadaDados.carregarDisponibilidade(isoMes(prox)).then(function (res) {
      info = res || null;
      return info;
    }, function () { return null; });
  }

  /* ---------- desenho ---------- */
  function marcarSeletor(trilho, valor) {
    Array.prototype.forEach.call(trilho.querySelectorAll('.aba'), function (a) {
      a.classList.toggle('aba--ativa', valor !== null && a.getAttribute('data-valor') === (valor ? 'sim' : 'nao'));
    });
  }

  function desenharCotas() {
    var opcoes = rasc.fecha24 ? [4, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
    if (rasc.cotas < opcoes[0]) rasc.cotas = opcoes[0];
    if (rasc.fecha24 && rasc.cotas % 4 !== 0) rasc.cotas = rasc.cotas - (rasc.cotas % 4) || 4;
    el.cotasTexto.textContent = msg().cotas(rasc.cotas);
    if (RW.dropdownNumeros) RW.dropdownNumeros.preencher(el.cotasMenu, {
      opcoes: opcoes, valor: rasc.cotas, formato: function (v) { return String(v); },
      aoEscolher: function (v) { rasc.cotas = v; el.cotasTexto.textContent = msg().cotas(v); atualizarAcoes(); }
    });
  }

  function contaProcura(dia) {
    var m = (r.procura || {})[dia];
    if (!m) return 0;
    if (escopo === 'total') { var t = 0; for (var k in m) t += m[k]; return t; }
    return m[escopo] || 0;
  }

  function desenharEscopo() {
    el.escopo.textContent = '';
    /* Total e a unidade do militar */
    var propria = (r.procura_unidades || []).filter(function (u) { return String(u.id) === String(r.procura_unidade_propria); })[0];
    var opcoes = [{ id: 'total', nome: msg().total }].concat(propria ? [{ id: String(propria.id), nome: propria.label }] : []);
    opcoes.forEach(function (o) {
      var b = RW.tpl('tpl-extra-procura-aba');
      if (!b) return;
      b.textContent = o.nome;
      b.setAttribute('data-escopo', o.id);
      if (o.id === escopo) b.classList.add('aba--ativa');
      el.escopo.appendChild(b);
    });
  }

  function desenharDatas() {
    el.querNum.textContent = String(rasc.quer.length);
    el.naoNum.textContent = String(rasc.nao.length);
    el.min.textContent = String(r.min_datas == null ? 5 : r.min_datas);
    el.minimo.classList.toggle('oculto', !editavel());
    var comp = new Date(Number(r.competencia.slice(0, 4)), Number(r.competencia.slice(5, 7)) - 1, 1);
    var motivos = RW.mensagens.extrajornada.bloqueadoMotivo || {};
    RW.miniCalendario.renderizar(el.cal, {
      dataRef: comp,
      aoDia: function (botao, dia) {
        var texto = botao.querySelector('.mini-calendario-texto');
        var bloq = (r.bloqueados || {})[dia];
        if (bloq) {
          botao.classList.add('mini-calendario-dia--ocupado');
          botao.disabled = true;
          texto.textContent = motivos[bloq] || '';
          return;
        }
        var m = marcacao(dia);
        if (m === 'quer') botao.classList.add('mini-calendario-dia--quer');
        if (m === 'nao_quer') botao.classList.add('mini-calendario-dia--nao');
        texto.textContent = m ? msg().dia[m] : '';
        botao.querySelector('.mini-calendario-conta').textContent = String(contaProcura(dia));
        if (!editavel()) { botao.disabled = true; return; }
        botao.addEventListener('click', function () { clicarDia(dia); });
      }
    });
  }

  /* o clique gira: vazio → quero → não posso → vazio (cada lista com no máximo 10) */
  function clicarDia(dia) {
    var m = marcacao(dia);
    if (m === null) {
      if (rasc.quer.length < MAX) rasc.quer.push(dia);
      else if (rasc.nao.length < MAX) rasc.nao.push(dia);
      else { RW.avisar({ tipo: 'aviso', mensagem: msg().cheio }); return; }
    } else if (m === 'quer') {
      tirar(rasc.quer, dia);
      if (rasc.nao.length < MAX) rasc.nao.push(dia);
    } else {
      tirar(rasc.nao, dia);
    }
    desenharDatas();
    atualizarAcoes();
  }

  function aplicarVoluntario() {
    Array.prototype.forEach.call(el.corpo.querySelectorAll('.extra-sol-so-voluntario'), function (c) {
      c.classList.toggle('oculto', rasc.voluntario !== true);
    });
    marcarSeletor(el.voluntario, rasc.voluntario);
  }

  function atualizarAcoes() {
    if (!el.enviar) return;
    el.enviar.disabled = !editavel() || rasc.voluntario === null || (r.respondeu && !sujo());
  }

  function montarPainel() {
    var mes = mesDe(r.competencia);
    var ed = editavel();
    RW.painel.abrir({
      titulo: ed ? msg().titulo(mes) : msg().tituloLeitura(mes),
      subtitulo: ((r.grad || '') + ' ' + (r.nome || '')).trim() + (r.unidade ? ' · ' + r.unidade : ''),
      aoFechar: fechou,
      aoTentarFechar: tentarFechar
    });
    aberto = true;
    var corpo = RW.painel.corpo();
    var sol = RW.tpl('tpl-extra-sol');
    if (!corpo || !sol) return;
    corpo.appendChild(sol);
    el.corpo = sol;
    el.voluntario = sol.querySelector('.extra-sol-voluntario');
    el.fecha24 = sol.querySelector('.extra-sol-fecha24');
    el.cotasTexto = sol.querySelector('.extra-sol-cotas-texto');
    el.cotasMenu = sol.querySelector('.extra-sol-cotas-menu');
    el.escopo = sol.querySelector('.extra-sol-escopo');
    el.cal = sol.querySelector('.extra-sol-cal');
    el.querNum = sol.querySelector('.extra-sol-quer-num');
    el.naoNum = sol.querySelector('.extra-sol-nao-num');
    el.min = sol.querySelector('.extra-sol-min');
    el.minimo = sol.querySelector('.extra-sol-minimo');

    /* a nota do prazo */
    sol.querySelector('.extra-sol-prazo').textContent = ed ? msg().prazo(ddmm(r.prazo_fim)) : msg().encerrado(ddmm(r.prazo_fim));
    sol.querySelector('.extra-sol-prazo-texto').textContent = ed ? msg().prazoTexto : (r.respondeu ? msg().encerradoTexto : msg().semResposta);
    sol.querySelector('.extra-sol-mes').textContent = mes;
    if (r.respondeu && r.enviada_em) {
      var env = sol.querySelector('.extra-sol-enviada');
      env.textContent = msg().enviada(r.enviada_em);
      env.classList.remove('oculto');
    }
    var termo = sol.querySelector('.extra-sol-termo');
    termo.textContent = r.termo ? msg().termoRecebido(r.termo_em) : msg().termoPendente;
    termo.classList.add(r.termo ? 'selo--sucesso' : 'selo--alerta');

    /* escolhas */
    escopo = 'total';
    if (RW.abas) {
      RW.abas.ligar(el.voluntario, function (aba) {
        if (!editavel()) { marcarSeletor(el.voluntario, rasc.voluntario); return; }
        rasc.voluntario = aba.getAttribute('data-valor') === 'sim';
        aplicarVoluntario();
        atualizarAcoes();
      });
      RW.abas.ligar(el.fecha24, function (aba) {
        if (!editavel()) { marcarSeletor(el.fecha24, rasc.fecha24); return; }
        rasc.fecha24 = aba.getAttribute('data-valor') === 'sim';
        desenharCotas();
        atualizarAcoes();
      });
      RW.abas.ligar(el.escopo, function (aba) { escopo = aba.getAttribute('data-escopo'); desenharDatas(); });
    }
    if (!ed) sol.querySelector('.extra-sol-cotas-gatilho').disabled = true;
    marcarSeletor(el.fecha24, rasc.fecha24);
    aplicarVoluntario();
    desenharCotas();
    desenharEscopo();
    desenharDatas();
    limpo = retrato();

    /* rodapé: só enquanto está no prazo */
    var rodape = RW.painel.rodape();
    if (ed && rodape) {
      var acoes = document.getElementById('tpl-extra-sol-acoes');
      if (acoes) rodape.appendChild(acoes.content.cloneNode(true));
      rodape.classList.remove('oculto');
      el.enviar = rodape.querySelector('.extra-sol-enviar');
      rodape.querySelector('.extra-sol-cancelar').addEventListener('click', function () { RW.painel.fechar(); });
      el.enviar.addEventListener('click', enviar);
    } else {
      el.enviar = null;
    }
    atualizarAcoes();
  }

  /* ---------- abrir / fechar ---------- */
  function abrir() {
    if (aberto && sujo()) return;
    if (RW.mostrarVeu) RW.mostrarVeu(document.querySelector('.conteudo'));
    carregar().then(function (res) {
      if (RW.esconderVeu) RW.esconderVeu(document.querySelector('.conteudo'));
      if (!res || !res.ok) { RW.avisar({ tipo: 'erro', mensagem: (res && res.error) || RW.mensagens.geral.falhaServidor }); return; }
      r = res;
      var bloq = r.bloqueados || {};
      rasc = {
        voluntario: r.respondeu ? !!r.voluntario : null,
        cotas: r.cotas_pedidas || 0,
        fecha24: !!r.fecha_24h,
        quer: [], nao: []
      };
      /* um dia que virou ocupado não conta mais como marcado */
      (r.datas || []).forEach(function (x) {
        if (bloq[x.data]) return;
        (x.tipo === 'quer' ? rasc.quer : rasc.nao).push(x.data);
      });
      montarPainel();
    });
    if (!guardaLigada && RW.guardaSaida) { RW.guardaSaida.registrar(sujo); guardaLigada = true; }
  }

  function fechou() { aberto = false; r = null; rasc = null; limpo = null; el = {}; }

  /* fechar pelo X ou Esc com mudança não enviada: confirma o descarte */
  function tentarFechar() {
    if (!sujo()) return false;
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { RW.painel.fechar(); }
    });
    return true;
  }

  /* ---------- enviar ---------- */
  function enviar() {
    if (!editavel() || rasc.voluntario === null) return;
    var min = r.min_datas == null ? 5 : r.min_datas;
    if (rasc.voluntario && rasc.quer.length < min) { RW.avisar({ tipo: 'erro', mensagem: msg().minDatas(min) }); return; }
    var datas = [];
    if (rasc.voluntario) {
      rasc.quer.forEach(function (d) { datas.push({ data: d, tipo: 'quer' }); });
      rasc.nao.forEach(function (d) { datas.push({ data: d, tipo: 'nao_quer' }); });
    }
    RW.iniciarCarregando(el.enviar);
    RW.extrajornadaDados.salvarDisponibilidade({
      competencia: r.competencia, voluntario: rasc.voluntario, cotas: rasc.voluntario ? rasc.cotas : 0,
      fecha24h: rasc.voluntario ? rasc.fecha24 : false, datas: datas
    }).then(function (res) {
      if (el.enviar) RW.pararCarregando(el.enviar);
      if (!res || !res.success) { RW.avisar({ tipo: 'erro', mensagem: (res && res.error) || RW.mensagens.geral.falhaServidor }); return; }
      limpo = retrato();
      RW.painel.fechar();
      if (res.log && RW.resumo) RW.resumo.abrirModal(res.log, { pagina: 'Extrajornada' });
      carregar().then(function (novo) { if (RW.extrajornadaCalendario) RW.extrajornadaCalendario.atualizarBarra(novo); });
    }, function () {
      if (el.enviar) RW.pararCarregando(el.enviar);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  RW.extrajornadaSolicitar = { carregar: carregar, abrir: abrir, info: function () { return info; } };
})();
