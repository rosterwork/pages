/* ============================================================
   NOVA EXTRA — passo 2: Cotas
   As cotas recebidas do comando, como repartir e a lista dos
   voluntários com termo, na ordem da fila. O número de cada um é só
   leitura: clicar no militar abre o painel com o pedido, a sugestão e
   o seletor de números do site (geral-dropdown-numeros). Quem ainda
   não tem cota salva já vem com a sugestão. Tudo fica no rascunho até
   o Salvar (nova_extra_cotas_salvar).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraCotas.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var d = null, el = null, aoSalvar = null, aoMudar = null;
  var p2 = null;           // o rascunho: { recebidas, modo, unidades, conc, sujo }
  var aberto = null;       // o cpf do militar aberto no painel
  var ligado = null;

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function q(sel) { return el.querySelector(sel); }
  function todos(sel, f) { Array.prototype.forEach.call(el.querySelectorAll(sel), f); }
  function vols() { return d.militares.filter(function (m) { return m.voluntario; }); }
  function comTermo() { return vols().filter(function (m) { return m.termo; }).sort(function (a, b) { return a.ordem - b.ordem; }); }
  function conc(m) { return m.cpf in p2.conc ? p2.conc[m.cpf] : (m.concedidas || 0); }
  /* o que ele já tem na distribuição salva: as cotas e os dias (DD/MM) */
  function naGrade(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }
  function diasDe(m) { return d.alocacoes.filter(function (a) { return a.cpf === m.cpf; }).map(function (a) { return a.data; }).sort().map(u().br); }
  /* abaixo do que está na grade, as extras dele saem ao salvar */
  function perde(m) { return conc(m) < naGrade(m); }

  function iniciarRascunho() {
    p2 = { recebidas: d.mes.cotas_recebidas, modo: d.mes.repartir_por || 'grupo', unidades: Object.assign({}, d.mes.cotas_unidades || {}), conc: {}, sujo: false };
    /* quem ainda não tem cota salva já vem com a sugestão */
    comTermo().forEach(function (m) {
      if (m.concedidas == null && (m.sugerido || 0) > 0) { p2.conc[m.cpf] = m.sugerido; p2.sujo = true; }
    });
  }

  function desenhar() {
    if (!p2) iniciarRascunho();
    q('#p2-recebidas').value = p2.recebidas == null ? '' : p2.recebidas;
    q('#p2-recebidas').disabled = p2.modo === 'por_unidade';
    todos('#p2-modo [data-modo]', function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-modo') === p2.modo); });
    var uni = q('#p2-unidades');
    uni.classList.toggle('oculto', p2.modo !== 'por_unidade');
    uni.textContent = '';
    d.unidades.forEach(function (un) {
      var c = RW.tpl('tpl-ne-p2-unidade');
      c.querySelector('span').textContent = un.nome;
      var inp = c.querySelector('input');
      inp.value = p2.unidades[un.id] == null ? '' : p2.unidades[un.id];
      inp.addEventListener('change', function () { p2.unidades[un.id] = inp.value === '' ? 0 : +inp.value; p2.sujo = true; desenhar(); });
      uni.appendChild(c);
    });
    var total = p2.modo === 'por_unidade' ? Object.keys(p2.unidades).reduce(function (s, k) { return s + (+p2.unidades[k] || 0); }, 0) : (+p2.recebidas || 0);
    var lista = comTermo();
    var rep = lista.reduce(function (s, m) { return s + conc(m); }, 0);
    q('#p2-repartidas').textContent = rep;
    q('#p2-sobram').textContent = total - rep;
    q('#p2-sobram').classList.toggle('nova-extra-negativo', total - rep < 0);
    var tb = q('#p2-lista');
    tb.textContent = '';
    lista.forEach(function (m, i) {
      var tr = RW.tpl('tpl-ne-p2-linha');
      tr.querySelector('.nova-extra-fila').textContent = msg().fila(i + 1);
      tr.querySelector('small').textContent = m.grad;
      tr.querySelector('b').textContent = m.nome;
      tr.querySelector('.ne-uni').textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      tr.querySelector('.ne-pediu').textContent = msg().cotas(m.cotas, m.so24);
      tr.querySelector('.ne-hist').textContent = m.pediu12 ? msg().pediuRecebeu(m.pediu12, m.recebeu12) : msg().primeiraVez;
      tr.querySelector('.ne-recebe').textContent = conc(m);
      var sug = tr.querySelector('.ne-sug');
      sug.textContent = msg().sugestaoN(m.sugerido || 0);
      sug.classList.toggle('oculto', conc(m) === (m.sugerido || 0));
      tr.classList.toggle('nova-extra-linha--aberta', aberto === m.cpf);
      tr.setAttribute('aria-label', m.grad + ' ' + m.nome);
      tr.addEventListener('click', function () { abrirPainel(m); });
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrirPainel(m); } });
      tb.appendChild(tr);
    });
    q('#p2-vazio').classList.toggle('oculto', lista.length > 0);
    var perdem = lista.filter(perde).length;
    q('#p2-mudancas').textContent = perdem ? msg().naoSalvoRetira(perdem) : (p2.sujo ? msg().naoSalvo : '');
    q('#p2-salvar').disabled = !p2.sujo;
    if (aberto) preencherPainel();
  }

  /* ---------- o painel do militar ---------- */
  function abrirPainel(m) {
    RW.painel.abrir({ titulo: m.grad + ' ' + m.nome, subtitulo: msg().cotasPainelSub((u().unidade(m.unidade_id) || {}).nome || '', m.ordem),
      aoFechar: function () { aberto = null; marcarAberta(); } });
    aberto = m.cpf;
    marcarAberta();
    preencherPainel();
  }
  function marcarAberta() {
    todos('#p2-lista tr', function (tr) { tr.classList.toggle('nova-extra-linha--aberta', !!aberto && tr.getAttribute('aria-label') === nomeDe(aberto)); });
  }
  function nomeDe(cpf) { var m = u().militar(cpf); return m ? m.grad + ' ' + m.nome : ''; }

  function preencherPainel() {
    var m = u().militar(aberto);
    if (!m) return;
    var corpo = RW.painel.corpo();
    corpo.textContent = '';
    var f = RW.tpl('tpl-ne-cotas-painel');
    f.querySelector('.ne-cp-pediu').textContent = msg().cotasPediu(m.cotas, m.so24);
    f.querySelector('.ne-cp-hist').textContent = m.pediu12 ? msg().pediuRecebeu(m.pediu12, m.recebeu12) : msg().primeiraVez;
    f.querySelector('.ne-cp-sug').textContent = m.sugerido || 0;
    var opcoes = [];
    for (var n = 0; n <= m.cotas; n++) if (!m.so24 || n % 4 === 0) opcoes.push(n);
    var numero = RW.dropdownNumeros.criar({ opcoes: opcoes, valor: conc(m), aoEscolher: function (v) { p2.conc[m.cpf] = v; p2.sujo = true; desenhar(); } });
    f.querySelector('.ne-cp-numero').appendChild(numero);
    var nota = f.querySelector('.ne-cp-nota');
    nota.classList.toggle('oculto', !m.so24);
    nota.querySelector('.nota-texto').textContent = msg().so24Cotas;
    var retira = f.querySelector('.ne-cp-retira');
    retira.classList.toggle('oculto', !perde(m));
    if (perde(m)) retira.querySelector('.nota-texto').textContent = msg().retiraCota(conc(m), diasDe(m), d.iniciado && !!d.lancamento);
    corpo.appendChild(f);
  }

  function salvar(depois) {
    var concedidas = {};
    comTermo().forEach(function (m) { concedidas[m.cpf] = conc(m); });
    RW.rpc('nova_extra_cotas_salvar', {
      p_competencia: d.competencia, p_cotas_recebidas: p2.modo === 'por_unidade' ? null : (p2.recebidas === '' ? null : +p2.recebidas),
      p_repartir_por: p2.modo, p_cotas_unidades: p2.modo === 'por_unidade' ? p2.unidades : null, p_concedidas: concedidas
    }).then(function (r) {
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      RW.novaExtraOrg.resumo(r);
      if (depois) depois(); else aoSalvar();
    });
  }

  function ligar() {
    q('#p2-recebidas').addEventListener('change', function () { p2.recebidas = q('#p2-recebidas').value; p2.sujo = true; desenhar(); });
    todos('#p2-modo [data-modo]', function (b) {
      b.addEventListener('click', function () { if (p2.modo === b.getAttribute('data-modo')) return; p2.modo = b.getAttribute('data-modo'); p2.sujo = true; desenhar(); });
    });
    q('#p2-cancelar').addEventListener('click', function () { p2 = null; desenhar(); });
    q('#p2-salvar').addEventListener('click', function () { salvar(); });
    /* Usar a sugestão: grava as recebidas, relê a sugestão do banco e a põe em todos */
    q('#p2-sugestao').addEventListener('click', function () {
      salvar(function () {
        RW.rpc('nova_extra_mes', { p_competencia: d.competencia }).then(function (r) {
          if (!r || !r.ok) return;
          d = r; iniciarRascunho();
          comTermo().forEach(function (m) { p2.conc[m.cpf] = m.sugerido || 0; });
          p2.sujo = true; desenhar(); if (aoMudar) aoMudar(r);
        });
      });
    });
  }

  function mostrar(dados, conteudo, recarregar, mudou) {
    d = dados; el = conteudo; aoSalvar = recarregar; aoMudar = mudou;
    if (ligado !== el) {
      ligado = el; p2 = null; ligar();
      /* com cotas não salvas, o navegador avisa ao fechar ou recarregar */
      if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return !!(el && el.isConnected && p2 && p2.sujo); });
    }
    desenhar();
  }

  RW.novaExtraCotas = {
    mostrar: mostrar,
    reiniciar: function () { p2 = null; },
    fecharPainel: function () { if (aberto && RW.painel.estaAberto()) RW.painel.fechar(); aberto = null; }
  };
})();
