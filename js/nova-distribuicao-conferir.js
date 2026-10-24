/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 7, Conferir
   Escolhe quantos militares estão de serviço e mostra, posto a
   posto, o que o banco calculou para cada cadeira (conferencia do
   nova_distribuicao_calcular): com gente, acumulada, coberta ou vazia.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }

  /* o selo de cada cadeira: verde com gente; amarelo acumulada, coberta ou vazia com aviso; vermelho vazia com erro */
  function pintar(selo, linha) {
    var P = RosterWork.novaDistribuicaoBlocos.pecas;
    if (linha.estado === 'tem_gente') {
      selo.classList.add('selo--sucesso');
      selo.textContent = M().estados.tem_gente;
    } else if (linha.estado === 'acumula' || linha.estado === 'coberta') {
      selo.classList.add('selo--alerta');
      selo.textContent = P.texto(M().estados[linha.estado], { por: linha.por || '' });
    } else {
      if (linha.gravidade === 0) selo.classList.add('selo--erro');
      if (linha.gravidade === 1) selo.classList.add('selo--alerta');
      selo.textContent = M().vazias[linha.gravidade] || M().vazias[2];
    }
  }

  function desenhar(corpo, ctx, api) {
    var P = RosterWork.novaDistribuicaoBlocos.pecas;
    var calc = ctx.calc || {};
    var conf = calc.conferencia || {};
    var caixa = P.tpl('conferir');
    P.grupo(corpo, ctx);

    caixa.querySelector('.nova-distribuicao-conferir-pracas').classList.toggle('oculto', ctx.ehCia);
    caixa.querySelector('.nova-distribuicao-conferir-oficiais').classList.toggle('oculto', !ctx.ehCia);
    caixa.querySelector('[data-espaco="efetivo"]').appendChild(P.numero(ctx.ehCia ? 0 : 1, ctx.ehCia ? 5 : 12, conf.efetivo || 0, function (v) {
      api.definirEfetivo(v);
    }, ''));

    caixa.querySelectorAll('[data-metrica]').forEach(function (el) {
      el.textContent = String(conf[el.getAttribute('data-metrica')] || 0);
    });
    var sobra = caixa.querySelector('.nova-distribuicao-sobra');
    if (conf.sem_funcao) {
      sobra.textContent = conf.sem_funcao === 1 ? M().sobraUm : P.texto(M().sobraVarios, { n: conf.sem_funcao });
      sobra.classList.remove('oculto');
    }

    var lista = caixa.querySelector('.nova-distribuicao-conferir-lista');
    (calc.postos || []).forEach(function (p) {
      P.posto(lista, p.nome);
      (conf.linhas || []).filter(function (l) { return l.posto === p.nome; }).forEach(function (l) {
        var linha = P.tpl('conferir-linha');
        linha.querySelector('.nova-distribuicao-linha-nome').textContent = l.funcao;
        pintar(linha.querySelector('.nova-distribuicao-estado'), l);
        lista.appendChild(linha);
      });
    });
    corpo.appendChild(caixa);

    if (!ctx.ehCia && ctx.nomeCompanhia) {
      var nota = P.tpl('confere-companhia');
      nota.querySelector('.nova-distribuicao-companhia').textContent = ctx.nomeCompanhia;
      corpo.appendChild(nota);
    }
  }

  window.RosterWork.novaDistribuicaoConferir = { desenhar: desenhar };
})();
