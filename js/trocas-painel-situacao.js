/* ============================================================
   TROCAS — a troca que não vale mais e o motivo da alteração
   O livro de ocorrências do registro no painel da troca
   (trocas-painel.js e trocas-painel-varias.js): a nota cinza no
   alto da troca substituída, cancelada ou expirada (o que
   aconteceu, quando, quem e o motivo, da ocorrência que o
   fn_trocas_listar traz) e, na substituída, o botão que abre a
   troca que vale agora. No Editar das trocas aprovadas
   (trocas-editar.js e trocas-varias-editar.js): o campo "Motivo da
   alteração (opcional)".
   Expõe RosterWork.trocasSituacao.{ nota, motivoAlteracao }
     nota(troca, ctx) → o elemento da nota, ou null
     motivoAlteracao(corpo, troca, aoMudar) → { valor, temTexto }, ou null
     cancelar(troca, partes, ctx, botao) → o Cancelar da troca de uma
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var SITUACOES = ['substituida', 'cancelada', 'expirada'];

  function m() { return RW.mensagens.trocas; }
  function comPonto(t) { t = String(t || '').trim(); return /[.!?]$/.test(t) ? t : t + '.'; }
  function unidades() {
    try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); return p && Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas : []; } catch (e) { return []; }
  }

  /* abre o painel da troca que vale agora (lida na lista das trocas, como as da página) */
  function abrirQueVale(trocaId, ctx, botao) {
    /* os pontinhos no botão na hora e o cartão das etapas só se a leitura passar de 1,5 s */
    var espera = RW.etapas.acao('trocaAbrir', null, { doServidor: 1, botao: botao, atraso: true });
    function parar() { espera.parar(); }
    function falhou() { parar(); if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: m().ocorrencia.falhaAbrir }); }
    RW.trocasDados.listar(unidades()).then(function (todas) {
      var nova = (Array.isArray(todas) ? todas : []).filter(function (t) { return t.troca_id === trocaId; })[0];
      if (!nova) { falhou(); return; }
      parar();
      RW.trocasPainel.abrir(nova, ctx);
    }).catch(falhou);
  }

  /* a nota do alto: o título (o que aconteceu), quando e quem, o motivo e que a troca não vale mais */
  function nota(t, ctx) {
    var oc = t && t.ocorrencia, o = m().ocorrencia;
    if (!oc || SITUACOES.indexOf(t.status) < 0 || !o.titulo[oc.tipo]) return null;
    var el = RW.tpl('tpl-troca-situacao');
    if (!el) return null;
    var novo = oc.registro_numero ? m().registroNumero(oc.registro_numero, oc.registro_ano) : null;
    el.querySelector('.nota-titulo').textContent = oc.tipo === 'substituicao' ? o.titulo.substituicao(novo || '') : o.titulo[oc.tipo];
    var q = oc.quando ? RW.trocasPainel.pecas.quando(oc.quando) : null;
    var frases = [];
    if (q) frases.push(oc.tipo === 'expiracao' ? o.expiracao(q.dia) : o[oc.tipo](q.dia, q.hora, oc.por));
    if (oc.tipo !== 'expiracao') {
      if (oc.motivo) frases.push(comPonto(o.motivo(oc.motivo)));
      frases.push(o.naoVale[t.registro_varias ? 'varias' : 'uma']);
    }
    el.querySelector('[data-situacao-texto]').textContent = frases.join(' ');
    var botao = el.querySelector('[data-acao="abrir-que-vale"]');
    if (oc.tipo === 'substituicao' && oc.troca_id && novo) {
      botao.textContent = o.abrir(novo);
      botao.classList.remove('oculto');
      botao.addEventListener('click', function () { abrirQueVale(oc.troca_id, ctx || {}, botao); });
    }
    return el;
  }

  /* o campo do motivo no fim do Editar da troca aprovada (molde no trocas.html) */
  function motivoAlteracao(corpo, t, aoMudar) {
    if (!corpo || !t || t.status !== 'aprovada') return null;
    var el = RW.tpl('tpl-troca-motivo-alteracao');
    if (!el) return null;
    corpo.appendChild(el);
    var campo = el.querySelector('textarea');
    campo.addEventListener('input', function () {
      if (RW.campos) RW.campos.limparErro(campo);
      if (aoMudar) aoMudar();
    });
    return {
      valor: function () { return campo.value.trim() || null; },
      temTexto: function () { return campo.value.trim() !== ''; }
    };
  }

  /* o Cancelar da troca de uma: o pedido em aberto (quem pediu) só confirma; a aprovada (o administrador) abre o motivo (opcional).
     As duas desfazem na escala o que a troca mudou (o cartão das etapas na hora) */
  function cancelar(t, partes, ctx, btn) {
    var P = RW.trocasPainel.pecas, d = RW.trocasDados;
    if (t.status !== 'aprovada') {
      P.confirmarEntao(m().confirmarCancelar, true, function () { P.executar(d.cancelar(t.troca_id), btn, ctx, null, true, { chave: 'trocaCancelar' }); });
      return;
    }
    RW.decisao.cancelar(partes, function (motivo, botao) { P.executar(d.cancelar(t.troca_id, false, motivo), botao, ctx, null, true, { chave: 'trocaCancelar' }); },
      { titulo: m().cancelarMotivo.tituloUma });
  }

  RW.trocasSituacao = { nota: nota, motivoAlteracao: motivoAlteracao, cancelar: cancelar };
})();
