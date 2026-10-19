/* ============================================================
   USUÁRIOS — datas de promoção por posto (aba Carreira)
   Leitura: o bloco Datas de promoções, com a data de cada posto da
   carreira (o que falta aparece "-") e o lápis do admin; do
   oficial, o bloco que recolhe com as datas de quando era praça
   (só registro), quando houver alguma. Sub-tela (só admin): um
   campo por posto para inserir, corrigir ou apagar (campo vazio
   apaga), com as de praça no bloco que recolhe; confere a ordem e
   a inclusão, grava por promocoes_salvar e abre o resumo. Quais
   postos ganham campo: RosterWork.campos.postosComData (o mesmo do
   Novo usuário e do Criar conta). Orquestração no usuarios-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { ficha, pessoa, ctl, campos: [{ input, grauId, antes }] }

  function isoParaBR(iso) { return iso ? RosterWork.data.isoParaBR(String(iso).slice(0, 10)) : ''; }

  /* as datas gravadas na ficha, por grau_id (ISO) */
  function datasDaFicha(ficha) {
    var mapa = {};
    ((ficha && ficha.promocoes) || []).forEach(function (pr) { mapa[String(pr.grau_id)] = String(pr.data).slice(0, 10); });
    return mapa;
  }

  /* os postos com data deste militar: os da carreira e, do oficial, os de praça */
  function postosDoMilitar(ficha, graus, datas) {
    var ins = (ficha && ficha.institucionais) || {};
    var inclusao = ins.data_de_inclusao ? RosterWork.validacoes.parseData(isoParaBR(ins.data_de_inclusao)) : null;
    return RosterWork.campos.postosComData(graus, ins.grau_id, inclusao, Object.keys(datas));
  }

  /* ---------- leitura ---------- */

  /* Datas de promoções (com o lápis, se aoCorrigir) e, do oficial, as de praça gravadas (recolhidas) */
  function montarVer(corpo, ficha, graus, aoCorrigir) {
    if (!corpo || !ficha || !RosterWork.usuariosPainelLeitura) return;
    var L = RosterWork.usuariosPainelLeitura;
    var datas = datasDaFicha(ficha);
    var postos = postosDoMilitar(ficha, graus || [], datas);
    if (!postos.carreira.length && !postos.praca.length) {
      /* sem a lista de postos (ou sem a inclusão): as datas gravadas, como estão */
      var gravadas = ficha.promocoes || [];
      if (!gravadas.length) return;
      var g = L.bloco('Datas de promoções');
      gravadas.forEach(function (pr) { L.linha(g, pr.grau, isoParaBR(pr.data)); });
      corpo.appendChild(g);
      return;
    }
    if (postos.carreira.length) {
      var b = L.bloco('Datas de promoções', 'Corrigir datas de promoções', aoCorrigir);
      postos.carreira.forEach(function (p) { L.linha(b, p.grau_abreviacao, isoParaBR(datas[String(p.grau_id)])); });
      corpo.appendChild(b);
    }
    var pracaGravadas = postos.praca.filter(function (p) { return datas[String(p.grau_id)]; });
    if (pracaGravadas.length) {
      var r = L.blocoRecolhivel('Datas como praça (só registro)', false);
      pracaGravadas.forEach(function (p) { L.linha(r.corpo, p.grau_abreviacao, isoParaBR(datas[String(p.grau_id)])); });
      corpo.appendChild(r.bloco);
    }
  }

  /* ---------- sub-tela (só admin) ---------- */

  function mudou(c) { return c.input.value.trim() !== isoParaBR(c.antes); }

  /* quantas datas mudaram; a mudada ganha a canaleta */
  function mudancas() {
    if (!ctx) return 0;
    var n = 0;
    ctx.campos.forEach(function (c) {
      var m = mudou(c);
      c.input.closest('.campo').classList.toggle('ficha-campo--alterado', m);
      if (m) n++;
    });
    return n;
  }

  function campoDeData(alvo, g, iso) {
    var campo = RosterWork.tpl('tpl-nu-promocao');
    if (!campo) return null;
    campo.querySelector('.campo-rotulo').textContent = g.grau_abreviacao;
    var input = campo.querySelector('.campo-entrada');
    input.setAttribute('data-grau', g.grau_id);
    input.value = isoParaBR(iso);
    RosterWork.campos.ligarData(input);
    input.addEventListener('input', function () {
      RosterWork.campos.limparErro(input);
      if (ctx && ctx.ctl) ctx.ctl.aoMudar();
    });
    alvo.appendChild(campo);
    return { input: input, grauId: g.grau_id, antes: iso || '' };
  }

  /* a sub-tela Datas de promoções no corpo; devolve o que o rodapé usa */
  function montarSubtela(corpo, ficha, pessoa, graus, ctl) {
    if (!corpo || !ficha || !RosterWork.usuariosPainelLeitura) return null;
    var L = RosterWork.usuariosPainelLeitura;
    var datas = datasDaFicha(ficha);
    var postos = postosDoMilitar(ficha, graus || [], datas);
    if (!postos.carreira.length && !postos.praca.length) return null;
    var subtela = RosterWork.tpl('tpl-ficha-sub-datas');
    if (!subtela) return null;
    ctx = { ficha: ficha, pessoa: pessoa, ctl: ctl, campos: [] };

    var daCarreira = [], dePraca = [];
    if (postos.carreira.length) {
      var b = L.bloco('Datas de promoções');
      daCarreira = postos.carreira.map(function (g) { return campoDeData(b, g, datas[String(g.grau_id)]); });
      subtela.appendChild(b);
    }
    if (postos.praca.length) {
      /* as de praça abrem já abertas quando alguma está gravada */
      var temPraca = postos.praca.some(function (g) { return datas[String(g.grau_id)]; });
      var r = L.blocoRecolhivel('Datas como praça (só registro)', temPraca);
      dePraca = postos.praca.map(function (g) { return campoDeData(r.corpo, g, datas[String(g.grau_id)]); });
      subtela.appendChild(r.bloco);
    }
    /* na ordem da carreira: as de praça antes das de oficial */
    ctx.campos = dePraca.concat(daCarreira).filter(Boolean);
    corpo.appendChild(subtela);

    var atual = ctx;
    return {
      textoAplicar: RosterWork.mensagens.botoes.salvar,
      mudancas: function () { return ctx === atual ? mudancas() : 0; },
      podeAplicar: function () { return ctx === atual && mudancas() > 0; },
      sujo: function () { return ctx === atual && mudancas() > 0; },
      aplicar: salvar
    };
  }

  function salvar(botao) {
    if (!ctx) return;
    var V = RosterWork.validacoes, C = RosterWork.campos;
    ctx.campos.forEach(function (c) { C.limparErro(c.input); });
    var ins = ctx.ficha.institucionais || {};
    var inclusao = ins.data_de_inclusao ? V.parseData(isoParaBR(ins.data_de_inclusao)) : null;
    if (!C.conferirPromocoes(ctx.campos.map(function (c) { return c.input; }), inclusao, null)) {
      /* o erro pode estar nas datas como praça, recolhidas: abre o bloco para ele aparecer */
      var erro = ctx.campos.filter(function (c) { return c.input.closest('.campo--erro'); })[0];
      var recolhido = erro && erro.input.closest('.ficha-bloco-corpo.oculto');
      if (recolhido) recolhido.parentNode.querySelector('.ficha-bloco-cab--recolhivel').click();
      if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.camposCorrigir });
      return;
    }
    /* só o que mudou; a data vazia apaga a do posto */
    var datas = ctx.campos.filter(mudou).map(function (c) {
      return { grau_id: c.grauId, data: V.paraISO(c.input.value) || '' };
    });
    if (datas.length) gravar(datas, botao);
  }

  function gravar(datas, botao) {
    var atual = ctx;
    if (botao && RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.apiFetch('/rest/v1/rpc/promocoes_salvar', {
      metodo: 'POST',
      corpo: { p_cpf: atual.pessoa.usuario_id, p_datas: datas }
    })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        if (botao && RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          ctx = null;   // gravado: não há mais o que proteger
          atual.ctl.concluir(r);
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaSalvar });
        }
      })
      .catch(function () {
        if (botao && RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  function reset() { ctx = null; }

  window.RosterWork.usuariosPainelDatas = { montarVer: montarVer, montarSubtela: montarSubtela, reset: reset };
})();
