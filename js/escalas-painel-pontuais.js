/* ============================================================
   ESCALA — painel do dia › seção PONTUAIS
   Militar avulso num dia/horário (entra na distribuição do dia,
   sem entrar no ciclo). No modo Editar (admin): lista os pontuais
   do dia com horário editável + ✕ e uma caixa "Adicionar pontual"
   com os elegíveis; Salvar substitui o conjunto da unidade no dia
   e redistribui. No modo Ver é só leitura.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var HORAS = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23'];

  var ctx = null;      // { corpo, rodape, unidadeId, iso, editar, btnSalvar }
  var estado = null;   // [{ cpf, grad, nome, hi, hf }]
  var elegiveis = [];  // [{ cpf, grad, nome }]
  var sujo = false;

  function msg() { return (RosterWork.mensagens && RosterWork.mensagens.escala) || {}; }
  function formatarHora(hhmm) { return hhmm ? (hhmm.split(':')[0] + 'h') : ''; }

  function caixaVazia(caixa, txt) {
    var v = RosterWork.tpl('tpl-escala-secao-vazio');
    if (v) { v.textContent = txt; caixa.appendChild(v); }
  }

  function botao(rotulo, variante, aoClicar) {
    var b = RosterWork.tpl('tpl-escala-secao-botao');
    if (!b) return null;
    b.textContent = rotulo;
    if (variante) b.classList.add(variante);
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* horário só leitura: início → seta → fim (ou "24h" quando hi==hf) */
  function horasVer(entry) {
    var hora = RosterWork.tpl('tpl-escala-distribuicao-hora');
    if (!hora) return null;
    var ini = hora.querySelector('.escala-distribuicao-hora-ini');
    var fim = hora.querySelector('.escala-distribuicao-hora-fim');
    var seta = hora.querySelector('.escala-distribuicao-hora-seta');
    ini.textContent = formatarHora(entry.hi);
    if (entry.hf && entry.hf !== entry.hi) {
      fim.textContent = formatarHora(entry.hf);
    } else {
      fim.classList.add('oculto');
      if (seta) seta.classList.add('oculto');
    }
    return hora;
  }

  /* horário editável: dois dropdowns de hora (00–23) com seta no meio */
  function horasEditar(entry) {
    if (!RosterWork.dropdownNumeros) return horasVer(entry);
    var hed = RosterWork.tpl('tpl-escala-hora-editar');
    if (!hed) return null;
    var formato = function (h) { return h + 'h'; };
    var dropIni = RosterWork.dropdownNumeros.criar({
      opcoes: HORAS, valor: (entry.hi || '08:00').slice(0, 2), formato: formato,
      aoEscolher: function (h) { entry.hi = h + ':00'; marcarSujo(); }
    });
    var dropFim = RosterWork.dropdownNumeros.criar({
      opcoes: HORAS, valor: (entry.hf || '08:00').slice(0, 2), formato: formato,
      aoEscolher: function (h) { entry.hf = h + ':00'; marcarSujo(); }
    });
    if (!dropIni || !dropFim) return horasVer(entry);
    dropIni.classList.add('escala-hora-ini');
    dropFim.classList.add('escala-hora-fim');
    var seta = hed.querySelector('.escala-distribuicao-hora-seta');
    if (seta) hed.insertBefore(dropIni, seta); else hed.appendChild(dropIni);
    hed.appendChild(dropFim);
    return hed;
  }

  function linha(m, horasEl, acaoEl) {
    var el = RosterWork.tpl('tpl-escala-secao-item');
    if (!el) return null;
    el.querySelector('.escala-secao-grad').textContent = m.grad || '';
    el.querySelector('.escala-secao-nome').textContent = m.nome || '';
    if (horasEl) el.querySelector('.escala-secao-extra').appendChild(horasEl);
    if (acaoEl) el.querySelector('.escala-secao-acao').appendChild(acaoEl);
    return el;
  }

  function removerAcao(entry) {
    var a = RosterWork.tpl('tpl-escala-secao-remover');
    if (a) a.addEventListener('click', function (ev) { ev.stopPropagation(); removerPontual(entry); });
    return a;
  }

  function marcarSujo() { sujo = true; atualizarSalvar(); }

  function removerPontual(entry) {
    estado = estado.filter(function (e) { return e !== entry; });
    marcarSujo();
    renderizar();
  }

  function adicionarPontual(m) {
    estado.push({ cpf: m.cpf, grad: m.grad, nome: m.nome, hi: '08:00', hf: '08:00' });
    marcarSujo();
    renderizar();
  }

  function jaNoEstado(cpf) { return estado.some(function (e) { return e.cpf === cpf; }); }

  function renderizar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    corpo.textContent = '';

    var caixas = [];
    if (ctx.editar) RosterWork.escalasPainel.pecas.montarBusca(corpo, caixas);

    var caixa = RosterWork.painel.criarCaixa(msg().pontuaisDoDia);
    if (caixa) {
      if (!estado.length) caixaVazia(caixa, msg().pontuaisVazio);
      estado.forEach(function (e) {
        var horas = ctx.editar ? horasEditar(e) : horasVer(e);
        var acao = ctx.editar ? removerAcao(e) : null;
        caixa.appendChild(linha(e, horas, acao));
      });
      corpo.appendChild(caixa);
      caixas.push(caixa);
    }

    if (ctx.editar) {
      var disp = elegiveis.filter(function (m) { return !jaNoEstado(m.cpf); });
      var caixaAdd = RosterWork.painel.criarCaixa(msg().pontuaisAdicionar);
      if (caixaAdd) {
        if (!disp.length) caixaVazia(caixaAdd, msg().pontuaisElegiveisVazio);
        disp.forEach(function (m) {
          caixaAdd.appendChild(linha(m, null, botao(msg().btnAdicionar, 'botao--primario', function () { adicionarPontual(m); })));
        });
        corpo.appendChild(caixaAdd);
        caixas.push(caixaAdd);
      }
    }
  }

  /* ---------- rodapé (Cancelar / Salvar) ---------- */
  function atualizarSalvar() { if (ctx && ctx.btnSalvar) ctx.btnSalvar.disabled = !sujo; }

  function montarRodape() {
    var rodape = ctx.rodape;
    if (!rodape) return;
    rodape.textContent = '';
    if (!ctx.editar) { rodape.classList.add('oculto'); return; }
    var tpl = document.getElementById('tpl-escala-painel-acoes');
    if (!tpl) { rodape.classList.add('oculto'); return; }
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-painel-cancelar');
    if (cancelar) cancelar.addEventListener('click', aoClicarCancelar);
    ctx.btnSalvar = rodape.querySelector('.escala-painel-salvar');
    if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    atualizarSalvar();
  }

  function aoClicarCancelar() {
    if (sujo && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso', mensagem: RosterWork.mensagens.escala.descartarAlteracoes,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: carregar
      });
    } else {
      carregar();
    }
  }

  function salvar() {
    if (!ctx || !sujo) return;
    var uid = ctx.unidadeId, iso = ctx.iso;
    var entradas = estado.map(function (e) { return { cpf: e.cpf, hi: e.hi, hf: e.hf }; });
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.escalasDados.pontuaisSalvar(uid, iso, entradas, RosterWork.sessao.cpf()).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r._falha === 'conexao') { RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao }); return; }
      if (r && r._falha === 'servidor') { RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor }); return; }
      if (r && r.success) {
        sujo = false;
        window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: uid, iso: iso } }));
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
        carregar();
      } else {
        RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.escala.falhaSalvar });
      }
    });
  }

  /* carrega (ou recarrega) do banco → memória → desenha */
  function carregar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var carregando = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (carregando) corpo.appendChild(carregando);
    RosterWork.escalasDados.pontuaisListar(ctx.unidadeId, ctx.iso).then(function (dados) {
      if (!ctx || ctx.corpo !== corpo) return;
      if (!dados || !dados.ok) {
        corpo.textContent = '';
        var e = RosterWork.tpl('tpl-escala-distribuicao-estado');
        if (e) { e.textContent = msg().falhaCarregar; corpo.appendChild(e); }
        return;
      }
      estado = (dados.pontuais || []).map(function (p) { return { cpf: p.cpf, grad: p.grad, nome: p.nome, hi: p.hi, hf: p.hf }; });
      elegiveis = dados.elegiveis || [];
      sujo = false;
      atualizarSalvar();
      renderizar();
    });
  }

  function montar(corpo, rodape, unidadeId, iso, editar) {
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, editar: !!editar, btnSalvar: null };
    estado = [];
    elegiveis = [];
    sujo = false;
    montarRodape();
    carregar();
  }

  function reset() { ctx = null; estado = null; elegiveis = []; sujo = false; }

  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return sujo; });
  }

  window.RosterWork.escalasPainelPontuais = { montar: montar, reset: reset, estaSujo: function () { return sujo; } };
})();
