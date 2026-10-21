/* ============================================================
   AJUSTES — aba Extrajornada: os prazos da companhia
   Quatro cards (Solicitações, Aviso a quem não respondeu, Envio do
   planejamento e Envio do relatório de ajustes) com o valor no selo
   (escuro quando definido, "Não definido" quando em branco). O
   administrador clica num card e edita os quatro no painel direito
   (extra_prazos_salvar: grava com histórico e abre o resumo).
   Valem para a companhia e os pelotões; aparecem na Extrajornada,
   no sino e nas etapas dos relatórios.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.ajustesExtrajornada.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var CAMPOS = ['solicitacao_dia', 'aviso_dias', 'planejamento_dia', 'relatorio_dia'];

  var el = {};
  var prazos = null;   // o salvo (extra_prazos_carregar)
  var edicao = null;   // { valores, btnSalvar } enquanto o painel está aberto
  var guardaLigada = false;

  function msg() { return RW.mensagens.extrajornada.prazos; }
  function admin() { return RosterWork.sessao.temPapel('pelotao'); }   // a Extrajornada é uma coisa só da companhia: qualquer admin dela
  function valorDe(v) { return v == null ? '' : String(v); }
  function sujo() {
    if (!edicao || !prazos) return false;
    return CAMPOS.some(function (k) { return valorDe(edicao.valores[k]) !== valorDe(prazos[k]); });
  }

  function selo(nome, texto, definido) {
    var s = el.cartoes.querySelector('[data-prazo="' + nome + '"] .ajuste-cartao-valor');
    if (!s) return;
    s.textContent = texto;
    s.classList.toggle('selo--escuro', definido);
  }

  function desenhar() {
    if (!prazos) return;
    el.ajuda.textContent = msg().ajuda(prazos.contexto || '');
    selo('solicitacao', msg().ateDia(prazos.solicitacao_dia), true);
    selo('aviso', msg().diasAntes(prazos.aviso_dias), true);
    selo('planejamento', prazos.planejamento_dia ? msg().dia(prazos.planejamento_dia) : msg().naoDefinido, !!prazos.planejamento_dia);
    selo('relatorio', prazos.relatorio_dia ? msg().dia(prazos.relatorio_dia) : msg().naoDefinido, !!prazos.relatorio_dia);
  }

  function carregar() {
    RW.rpc('extra_prazos_carregar', {}).then(function (r) {
      if (!el.cartoes || !el.cartoes.isConnected) return;
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falha }); return; }
      prazos = r;
      desenhar();
    }, function () { RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  /* ---------- painel direito: editar os prazos (só administrador) ---------- */
  function atualizarSalvar() { if (edicao && edicao.btnSalvar) edicao.btnSalvar.disabled = !sujo(); }

  function tentarFechar() {
    if (!sujo()) { RW.painel.fechar(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.sairSemSalvar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { edicao = null; RW.painel.fechar(); }
    });
  }

  function abrirPainel() {
    if (!prazos || !admin()) return;
    RW.painel.abrir({
      titulo: msg().tituloPainel,
      subtitulo: msg().subtitulo(prazos.contexto || ''),
      aoFechar: function () { edicao = null; },
      aoTentarFechar: function () { if (!sujo()) return false; tentarFechar(); return true; }
    });
    edicao = { valores: {}, btnSalvar: null };
    CAMPOS.forEach(function (k) { edicao.valores[k] = prazos[k]; });
    var corpo = RW.painel.corpo();
    var form = RW.tpl('tpl-ajuste-prazos-editar');
    if (!corpo || !form) return;
    Array.prototype.forEach.call(form.querySelectorAll('[data-campo]'), function (inp) {
      var k = inp.getAttribute('data-campo');
      inp.value = valorDe(prazos[k]);
      inp.addEventListener('input', function () {
        var v = inp.value.replace(/\D/g, '');
        if (v !== inp.value) inp.value = v;
        edicao.valores[k] = v === '' ? null : Number(v);
        atualizarSalvar();
      });
    });
    corpo.appendChild(form);
    var rodape = RW.painel.rodape();
    if (rodape) {
      rodape.appendChild(document.getElementById('tpl-ajuste-painel-acoes').content.cloneNode(true));
      rodape.classList.remove('oculto');
      edicao.btnSalvar = rodape.querySelector('#ajuste-salvar');
      rodape.querySelector('#ajuste-cancelar').addEventListener('click', tentarFechar);
      edicao.btnSalvar.addEventListener('click', salvar);
    }
    if (!guardaLigada && RW.guardaSaida) { RW.guardaSaida.registrar(sujo); guardaLigada = true; }
  }

  function salvar() {
    if (!sujo()) return;
    RW.iniciarCarregando(edicao.btnSalvar);
    RW.rpc('extra_prazos_salvar', { p_dados: edicao.valores }).then(function (r) {
      if (edicao && edicao.btnSalvar) RW.pararCarregando(edicao.btnSalvar);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      edicao = null;
      RW.painel.fechar();
      if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Ajustes' });
      carregar();
    }, function () {
      if (edicao && edicao.btnSalvar) RW.pararCarregando(edicao.btnSalvar);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  function montar(cont) {
    el.cartoes = cont.querySelector('#ajustes-prazos');
    el.ajuda = cont.querySelector('#ajustes-prazos-ajuda');
    prazos = null;
    if (!el.cartoes) return;
    Array.prototype.forEach.call(el.cartoes.querySelectorAll('.ajuste-cartao'), function (card) {
      if (!admin()) return;
      card.classList.add('ajuste-cartao--clicavel');
      card.addEventListener('click', abrirPainel);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPainel(); } });
    });
  }

  function ativar() { carregar(); }

  RW.ajustesExtrajornada = { montar: montar, ativar: ativar };
})();
