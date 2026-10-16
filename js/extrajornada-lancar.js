/* ============================================================
   EXTRAJORNADA — aba Distribuição › o rodapé (Salvar e Lançar na escala)
   O rodapé da Distribuição diz quantas mudanças faltam salvar e o que
   falta lançar, com o Cancelar e o Salvar do rascunho do mês
   (escalas-extra-rascunho.js) e o Lançar na escala (ativo antes do mês
   começar, com mudança ainda não lançada). O selo da barra conta as
   cotas na grade, já com o rascunho. Lançar com mudança não salva
   salva antes. A confirmação lista os dias em que a distribuição será
   refeita (no relançamento, só os dias que mudaram). O lançamento
   (extra_lancar) põe as extras na escala, guarda a foto (a base do
   relatório inicial e dos ajustes) e abre o resumo. Depois que o mês
   começa, o Salvar põe as mudanças direto na escala.
   Não cria HTML nem escreve estilo.
   RosterWork.extrajornadaLancar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MAX_DIAS = 8;   // dias listados na confirmação (o resto vira "E mais N dias")

  var el = {};
  var naAba = false;
  var comp = null;
  var seq = 0;
  var previa = null;
  var ouvinteLigado = false;

  function msg() { return RW.mensagens.extrajornada.distribuicao; }
  function R() { return RW.escalasExtraRascunho; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function ddmm(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  /* quantas cotas o rascunho põe (ou tira) na grade */
  function saldoRascunho() {
    return R().lista().reduce(function (s, m) { return s + m.blocos.length - ((m.antes && m.antes.blocos) ? m.antes.blocos.length : 0); }, 0);
  }

  function desenhar() {
    var r = previa;
    var n = R().contar();
    if (el.cancelar) el.cancelar.disabled = !n;
    if (el.salvar) el.salvar.disabled = !n;
    if (!r || !r.ok) {
      el.texto.textContent = n ? RW.mensagens.escala.extraPainel.alteracoes(n, R().dias()) + '.' : '';
      el.botao.disabled = true;
      el.selo.classList.add('oculto');
      return;
    }
    el.selo.textContent = msg().selo((r.na_grade || 0) + saldoRascunho(), r.concedidas);
    el.selo.classList.toggle('oculto', !naAba);
    var mudou = (r.dias || []).length > 0;
    var texto;
    if (r.iniciado) texto = msg().iniciado;
    else if (!r.lancado) texto = (r.na_grade || n) ? msg().naoLancada(r.reabrir_ate) : msg().semExtras;
    else texto = mudou ? msg().lancadaMudou(r.reabrir_ate) : msg().lancada(r.lancado_em, r.reabrir_ate);
    el.texto.textContent = (n ? RW.mensagens.escala.extraPainel.alteracoes(n, R().dias()) + '. ' : '') + texto;
    el.botao.disabled = r.iniciado || !(mudou || n);
  }

  function carregar() {
    if (!naAba || !RW.extrajornadaDados || !el.botao || !el.botao.isConnected) return;
    var meu = ++seq;
    el.botao.disabled = true;
    RW.extrajornadaDados.previaLancamento(iso(comp)).then(function (r) {
      if (meu !== seq || !naAba) return;
      previa = r;
      desenhar();
    });
  }

  function lancar() {
    if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o motor refaz a distribuição dos dias: véu global
    RW.extrajornadaDados.lancar(iso(comp)).then(function (r) {
      if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); carregar(); return; }
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Extrajornada' });
      else RW.avisar({ tipo: 'sucesso', mensagem: msg().lancadaOk });
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
    }, function () {
      if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }
  /* com mudança não salva: salva (sem o resumo, o do lançamento vem logo depois) e lança */
  function salvarELancar() {
    if (!R().sujo()) { lancar(); return; }
    R().salvar(el.botao, { semResumo: true }).then(function (ok) { if (ok) lancar(); });
  }

  /* a confirmação: os dias que terão a distribuição refeita (com as unidades), já com os do rascunho */
  function confirmar() {
    if (!previa || !previa.ok || el.botao.disabled) return;
    var porDia = {};
    (previa.dias || []).forEach(function (d) { porDia[d.data] = (d.unidades || []).slice(); });
    R().lista().forEach(function (m) {
      var nomes = porDia[m.data] || (porDia[m.data] = []);
      [m.unidade, m.antes && m.antes.unidade].forEach(function (u) {
        var nome = u && RW.extrajornadaEscala ? RW.extrajornadaEscala.nomeUnidade(u) : '';
        if (nome && nomes.indexOf(nome) < 0) nomes.push(nome);
      });
    });
    var dias = Object.keys(porDia).sort();
    RW.confirmar({
      tipo: 'aviso',
      mensagem: msg().confirmar(MESES[comp.getMonth()]),
      itens: dias.slice(0, MAX_DIAS).map(function (d) { return { titulo: ddmm(d), texto: porDia[d].join(', ') }; }),
      nota: msg().confirmarNota(Math.max(0, dias.length - MAX_DIAS), previa.reabrir_ate),
      textoConfirmar: msg().botao,
      aoConfirmar: salvarELancar
    });
  }

  function montar(cont) {
    el.texto = cont.querySelector('#extra-lancar-texto');
    el.botao = cont.querySelector('#extra-lancar');
    el.cancelar = cont.querySelector('#extra-distribuicao-cancelar');
    el.salvar = cont.querySelector('#extra-distribuicao-salvar');
    el.selo = cont.querySelector('#extra-montagem-selo');
    previa = null;
    if (el.botao) el.botao.addEventListener('click', confirmar);
    if (el.cancelar) el.cancelar.addEventListener('click', function () { R().cancelar(); });
    if (el.salvar) el.salvar.addEventListener('click', function () { R().salvar(el.salvar); });
    /* o rascunho mudou (na grade ou no painel do dia): refaz o texto e os botões */
    if (!ouvinteLigado) {
      ouvinteLigado = true;
      window.addEventListener('rosterwork_extra_rascunho', function () { if (naAba && el.botao && el.botao.isConnected) desenhar(); });
    }
  }
  function ativar() { naAba = true; comp = RW.extrajornadaMes.obter(); carregar(); }
  function desativar() { naAba = false; if (el.selo) el.selo.classList.add('oculto'); }
  function renderMes() { comp = RW.extrajornadaMes.obter(); carregar(); }

  RW.extrajornadaLancar = { montar: montar, ativar: ativar, desativar: desativar, renderMes: renderMes, recarregar: carregar };
})();
