/* ============================================================
   ESCALA — painel do dia › aba EXTRAJORNADA › cobertura e ajustes
   A nota do topo (lançado ou não), a COBERTURA DO DIA (as barras sem
   extra e com extra, por ensaio no motor, já com o rascunho do dia) com
   os avisos (resolvido pelo extra / o que ficou) e os AJUSTES já
   registrados neste dia. Recebe o estado da aba (escalas-painel-extra.js):
   c = { uid, iso, ativo, painel, seqPainel, timer, coberturaEl, ajustesEl }.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.escalasPainelExtraCobertura.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var INI = ['', '08h', '14h', '20h', '02h'];
  var FIM = ['', '14h', '20h', '02h', '08h'];

  function msg() { return RW.mensagens.escala.extraPainel; }
  function R() { return RW.escalasExtraRascunho; }
  function horarios(b) {
    /* "08h às 14h e 20h às 02h" (os blocos vizinhos viram um horário só) */
    var partes = [], ini = null, fim = null;
    (b || []).slice().sort(function (x, y) { return x - y; }).concat([99]).forEach(function (k) {
      if (ini === null) { ini = k; fim = k; return; }
      if (k === fim + 1) { fim = k; return; }
      partes.push(INI[ini] + ' às ' + FIM[fim]);
      ini = k; fim = k;
    });
    return partes.join(' e ');
  }

  /* a nota do topo: lançado ou não, e se o mês já começou */
  function textoNota(c, d) {
    var mes = MESES[Number(c.iso.slice(5, 7)) - 1];
    if (d.iniciado) return d.lancado ? msg().lancadoEm(d.lancado_em) : msg().mesComecou;
    return d.lancado ? msg().lancadoAntes(d.lancado_em) : msg().naoLancado(mes);
  }

  /* ---------- avisos (o mesmo texto da grade) ---------- */
  function textoAviso(a) {
    var rot = (RW.mensagens.extrajornada && RW.mensagens.extrajornada.avisosGrade) || {};
    if (a.tipo === 'sem_funcao') {
      var n = a.quantidade || 1;
      return n === 1 ? (rot.sem_funcao || '') : String(rot.sem_funcao_plural || '').replace('{n}', n);
    }
    return rot[a.tipo] || a.tipo;
  }
  function chaveAviso(a) { return a.tipo + '|' + (a.onde || ''); }
  function linhaAviso(negrito, resto, ok) {
    var l = RW.tpl('tpl-escala-extra-aviso');
    if (!l) return null;
    l.classList.add(ok ? 'escala-extra-aviso--ok' : 'escala-extra-aviso--alerta');
    var pecas = RW.escalasPainel && RW.escalasPainel.pecas;
    if (pecas && !ok) pecas.definirIcone(l.querySelector('.escala-extra-aviso-icone'), 'icone-alerta');
    l.querySelector('.escala-extra-aviso-nome').textContent = negrito || '';
    l.querySelector('.escala-extra-aviso-resto').textContent = resto || '';
    return l;
  }

  /* ---------- cobertura do dia ---------- */
  function grafico(alvo, estadoCob, max) {
    if (!alvo || !estadoCob || !estadoCob.cobertura || !RW.escalasCelula) return;
    var g = RW.escalasCelula.montarGrafico(estadoCob.cobertura, max, estadoCob.erro);
    if (g) alvo.appendChild(g);
  }
  function desenhar(c) {
    var alvo = c.coberturaEl, d = c.painel;
    if (!alvo) return;
    alvo.textContent = '';
    if (!d || !d.ok) return;
    var caixa = RW.painel.criarCaixa(msg().cobertura);
    var cob = RW.tpl('tpl-escala-extra-cobertura');
    if (!caixa || !cob) return;
    var max = 1;
    [d.sem, d.com].forEach(function (e) { ((e && e.cobertura) || []).forEach(function (v) { if (Number(v) > max) max = Number(v); }); });
    grafico(cob.querySelector('.escala-extra-cob-sem'), d.sem, max);
    grafico(cob.querySelector('.escala-extra-cob-com'), d.com, max);
    caixa.appendChild(cob);
    var antes = (d.sem && d.sem.avisos) || [], depois = (d.com && d.com.avisos) || [];
    var noDepois = {};
    depois.forEach(function (a) { noDepois[chaveAviso(a)] = true; });
    var rascunhoHoje = R() && R().doDia(c.iso).length > 0;
    antes.filter(function (a) { return !noDepois[chaveAviso(a)]; }).forEach(function (a) {
      var l = linhaAviso(textoAviso(a), (a.onde ? ': ' + a.onde : '') + ', ' + (rascunhoHoje ? msg().resolvidoRascunho : msg().resolvido) + '.', true);
      if (l) caixa.appendChild(l);
    });
    depois.forEach(function (a) {
      var l = linhaAviso(textoAviso(a), a.onde ? ': ' + a.onde + '.' : '.', false);
      if (l) caixa.appendChild(l);
    });
    alvo.appendChild(caixa);
    if (RW.escalasCelula) RW.escalasCelula.desenharGraficos(caixa);
    desenharAjustes(c);
  }

  /* ---------- ajustes já registrados neste dia ---------- */
  function textoAjuste(a) {
    var era = a.era ? horarios(a.era.blocos) : '', ficou = a.ficou ? horarios(a.ficou.blocos) : '';
    if (a.tipo === 'adicionar') return msg().ajusteAdicionou(a.militar, ficou);
    if (a.tipo === 'tirar') return msg().ajusteTirou(a.militar, era);
    return msg().ajusteHorario(a.militar, era, ficou);
  }
  function desenharAjustes(c) {
    var alvo = c.ajustesEl;
    if (!alvo) return;
    alvo.textContent = '';
    var lista = (c.painel && c.painel.ajustes) || [];
    if (!lista.length) return;
    var caixa = RW.painel.criarCaixa(msg().ajustesDoDia(lista.length));
    if (!caixa) return;
    lista.forEach(function (a) {
      var l = RW.tpl('tpl-escala-extra-ajuste');
      if (!l) return;
      l.querySelector('.escala-extra-ajuste-autor').textContent = a.autor || '';
      l.querySelector('.escala-extra-ajuste-quando').textContent = a.quando || '';
      l.querySelector('.escala-extra-ajuste-texto').textContent = textoAjuste(a) + (a.motivo ? msg().motivoNota(a.motivo) : '');
      caixa.appendChild(l);
    });
    alvo.appendChild(caixa);
  }

  /* ---------- o ensaio: o dia com o rascunho dele ---------- */
  function opsDoDia(iso) {
    return (R() ? R().doDia(iso) : []).map(function (m) {
      var o = { tipo: 'mudar', cpf: m.cpf, de: { data: m.data } };
      if (m.blocos.length) o.para = { data: m.data, unidade: m.unidade, blocos: m.blocos };
      return o;
    });
  }
  function carregar(c) {
    var seq = ++c.seqPainel;
    RW.escalasDados.extraPainel(c.uid, c.iso, opsDoDia(c.iso)).then(function (r) {
      if (!c.ativo || seq !== c.seqPainel) return;
      c.painel = r || { ok: false };
      desenhar(c);
    });
  }
  /* marcar vários horários seguidos ensaia uma vez só, depois que o administrador para */
  function agendar(c) {
    if (c.timer) clearTimeout(c.timer);
    c.timer = setTimeout(function () { if (c.ativo) carregar(c); }, 600);
  }

  RW.escalasPainelExtraCobertura = { textoNota: textoNota, desenhar: desenhar, carregar: carregar, agendar: agendar };
})();
