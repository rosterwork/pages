/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 2, Efetivo
   Um cartão por posto. Fechado, o título traz o nome (e a CNH da
   viatura), os números "Mín. · Ideal · Máx." e, com mínimo 0, o
   selo Reserva com a frase do que isso quer dizer. Aberto, o
   mínimo, o ideal e o máximo (componente geral-posto-editar), o que
   fazer sem gente para o mínimo (sai incompleto ou fica fora da
   escala, com o nível do aviso) e as
   funções agrupadas pelo nível em que entram; o nível sem função
   não aparece, e o posto reserva mostra um grupo só, sem aviso.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  function linhaFuncao(lista, f) {
    var p = P().tpl('funcao');
    p.querySelector('.nova-distribuicao-funcao-nome').textContent = f.rotulo || (f.papel ? f.funcao + ' · ' + f.papel : f.funcao);
    if (f.papel) P().trava(p, f.externa ? M().travaCompanhia : M().travaPapel);
    lista.appendChild(p);
  }

  function cartaoEfetivo(u, ctx, api, item, i, tipo) {
    var nome = item.nome;
    var ef = item.efetivo || [];
    var reserva = ef[0] === 0;
    var funcoes = nome ? ((ctx.calc && ctx.calc.funcoes) || []).filter(function (f) { return f.posto === nome; }) : [];
    var erros = P().erros(ctx, 'efetivo:' + nome);
    var titulo = !nome ? M().semPrefixo : (tipo === 'v' && item.cnh ? P().texto(M().tituloViatura, { nome: nome, cnh: item.cnh }) : nome);
    var completo = ef[0] != null && ef[1] != null && ef[2] != null;
    /* sem gente para o mínimo, fica fora da escala: só com mínimo e sem função especial no posto */
    var podeFora = ef[0] > 0 && !funcoes.some(function (f) { return f.papel; });
    var fora = podeFora && Number(item.sem_minimo) === 1;
    var nivelFora = item.aviso_fora == null ? 1 : Number(item.aviso_fora);
    var linhas = (reserva ? [M().reservaFrase] : []).concat(fora ? [M().semMinimoFrases[nivelFora]] : [])
      .concat(erros.map(function (e) { return { texto: e, falta: true }; }));

    function mudarPosto(fn) {
      api.mudar(ctx.lado, function (x) {
        var alvo = tipo === 'v' ? x.viaturas[i] : x.instalacoes.filter(function (o) { return o.nome === nome; })[0];
        if (alvo) fn(alvo);
      });
    }

    P().cartao(u, api, ctx, 'efetivo-' + tipo + '-' + i, titulo, linhas, function (lugar) {
      var campos = P().tpl('posto-campos');
      var comp = RosterWork.postoEditar.efetivo({ min: ef[0], ideal: ef[1], max: ef[2] }, function (v) {
        mudarPosto(function (alvo) { alvo.efetivo = [v.min, v.ideal, v.max]; });
      });
      comp.el.querySelectorAll('.campo-selecao').forEach(function (b) { b.disabled = ctx.soLeitura; });
      var lugarEfetivo = campos.querySelector('.nova-distribuicao-posto-efetivo');
      lugarEfetivo.appendChild(comp.el);
      erros.forEach(function (e) { P().erroCampo(lugarEfetivo, e); });

      var semMinimo = campos.querySelector('.nova-distribuicao-sem-minimo');
      semMinimo.classList.toggle('oculto', !podeFora);
      if (podeFora) {
        P().bolinhas(semMinimo, 'nova-distribuicao-sem-minimo-' + ctx.lado + '-' + tipo + '-' + i, function (v) {
          return Number(v) === (fora ? 1 : 0);
        }, function (v) {
          mudarPosto(function (alvo) {
            if (v === '1') { alvo.sem_minimo = 1; alvo.aviso_fora = 1; } else { delete alvo.sem_minimo; delete alvo.aviso_fora; }
          });
        }, ctx.soLeitura);
        var linhaAviso = semMinimo.querySelector('.nova-distribuicao-fora-aviso');
        linhaAviso.classList.toggle('oculto', !fora);
        linhaAviso.querySelector('[data-espaco="aviso"]').appendChild(P().selecaoFixa('aviso', nivelFora, function (v) {
          mudarPosto(function (alvo) { alvo.aviso_fora = Number(v); });
        }, ctx.soLeitura));
      }

      campos.querySelectorAll('.nova-distribuicao-nivel').forEach(function (nivel) {
        var qual = nivel.getAttribute('data-nivel');
        var daqui = funcoes.filter(function (f) { return reserva ? qual === 'reserva' : f.nivel === qual; });
        nivel.classList.toggle('oculto', !daqui.length);
        daqui.forEach(function (f) { linhaFuncao(nivel.querySelector('.nova-distribuicao-nivel-lista'), f); });
      });
      lugar.appendChild(campos);
    }, erros.length > 0 || !completo, {
      numeros: completo ? P().texto(M().numeros, { min: ef[0], ideal: ef[1], max: ef[2] }) : M().efetivoFalta,
      reserva: reserva,
      muda: nome ? 'efetivo:' + nome : null
    });
  }

  function efetivo(corpo, ctx, api) {
    corpo.appendChild(P().tpl('nota-efetivo'));
    var u = P().unidade(corpo, ctx);
    var r = ctx.resp;
    if (!(r.instalacoes || []).length && !(r.viaturas || []).length) P().respostas(u, [M().semPostos]);
    (r.instalacoes || []).forEach(function (inst, i) { cartaoEfetivo(u, ctx, api, inst, i, 'i'); });
    (r.viaturas || []).forEach(function (v, i) { cartaoEfetivo(u, ctx, api, v, i, 'v'); });
  }

  window.RosterWork.novaDistribuicaoEfetivo = { efetivo: efetivo };
})();
