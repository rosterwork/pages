/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 8, Conferir
   Duas formas, num seletor: Tabela (a partir de N de serviço, N e
   os quatro seguintes, uma coluna cada, com os totais) e Simular a
   equipe (quantos de cada graduação; quem senta em cada função, os
   avisos de grau e os postos que ficam fora da escala). As contas são do nova_distribuicao_calcular
   (conferencia); aqui o desenho e a escolha de cada unidade (fica
   entre as visitas), que diz ao calcular o que conferir.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var COLUNAS = 5;
  var escolha = { modo: 'tabela', inicio: {}, equipe: {} };

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  function postoCelula(td, posto) {
    td.textContent = P().postoCurto(posto);
    if (P().postoCurto(posto) !== posto) td.setAttribute('data-dica', posto);
  }

  /* o mínimo do posto (o motivo de ficar fora da escala) e se algum posto pode ficar fora */
  function minimoDe(ctx, posto) {
    var item = (ctx.resp.instalacoes || []).concat(ctx.resp.viaturas || []).filter(function (x) { return x.nome === posto; })[0];
    return item && item.efetivo && item.efetivo[0] != null ? item.efetivo[0] : '?';
  }
  function temFora(ctx) {
    return (ctx.resp.instalacoes || []).concat(ctx.resp.viaturas || []).some(function (x) { return Number(x.sem_minimo) === 1; });
  }

  /* a marca da função numa coluna; a dica diz a situação (e quem cobre ou acumula, ou por que fica fora) */
  function marca(ctx, e, linha) {
    var el = P().tpl('estado-' + e.estado) || P().tpl('estado-vazia');
    var frase = M().estados[e.estado] || M().estados.vazia;
    if (e.por) frase = P().texto(M().porQuem, { estado: frase, quem: P().completo(ctx, e.por) });
    var nivel = e.estado === 'fora' ? e.aviso : e.estado === 'vazia' ? linha.aviso : 0;
    el.classList.toggle('nova-distribuicao-estado--erro', nivel === 2);
    el.classList.toggle('nova-distribuicao-estado--alerta', nivel === 1);
    if (e.estado === 'fora') frase = P().texto(M().foraMotivo, { min: minimoDe(ctx, linha.posto) });
    el.setAttribute('data-dica', frase);
    return el;
  }

  function tabela(lugar, ctx, api, conf) {
    var t = P().tpl('conferir-tabela');
    var efetivos = conf.modo === 'tabela' ? conf.efetivos || [] : [];
    t.querySelector('.nova-distribuicao-conferir-pracas').classList.toggle('oculto', ctx.ehCia);
    t.querySelector('.nova-distribuicao-conferir-oficiais').classList.toggle('oculto', !ctx.ehCia);
    t.querySelector('[data-espaco="inicio"]').appendChild(P().numero(ctx.ehCia ? 0 : 1, 20, api.conferir.inicio(), function (v) {
      api.conferir.definirInicio(v);
    }, M().rotuloInicio));

    var cabeca = t.querySelector('thead tr');
    efetivos.forEach(function (n) {
      var th = P().tpl('th');
      th.textContent = String(n);
      cabeca.appendChild(th);
    });
    var corpo = t.querySelector('tbody');
    (conf.linhas || []).forEach(function (l) {
      var tr = P().tpl('conferir-linha');
      postoCelula(tr.querySelector('.nova-distribuicao-col-posto'), l.posto);
      tr.querySelector('.nova-distribuicao-col-funcao').textContent = P().rotulo(ctx, l.nome);
      (l.estados || []).slice(0, efetivos.length).forEach(function (e) {
        var td = P().tpl('conferir-celula');
        td.appendChild(marca(ctx, e, l));
        tr.appendChild(td);
      });
      corpo.appendChild(tr);
    });
    /* os totais; "fora" é a lista dos postos fora da escala (o número, e os nomes na dica) */
    t.querySelectorAll('tfoot tr[data-resumo]').forEach(function (tr) {
      var chave = tr.getAttribute('data-resumo');
      (conf.resumos || []).slice(0, efetivos.length).forEach(function (r) {
        var td = P().tpl('conferir-total');
        var valor = r[chave] || 0;
        td.textContent = String(Array.isArray(valor) ? valor.length : valor);
        if (Array.isArray(valor) && valor.length) td.setAttribute('data-dica', valor.map(function (x) { return x.posto; }).join(', '));
        tr.appendChild(td);
      });
    });
    t.querySelector('tfoot tr[data-resumo="fora"]').classList.toggle('oculto', !temFora(ctx));
    t.querySelector('.nova-distribuicao-legenda-fora').classList.toggle('oculto', !temFora(ctx));
    lugar.appendChild(t);
  }

  function situacao(selo, e, linha) {
    selo.textContent = M().estados[e.estado] || M().estados.vazia;
    if (e.estado === 'tem_gente') selo.classList.add('selo--sucesso');
    if (e.estado === 'coberta') selo.classList.add('selo--alerta');
    if (e.estado === 'vazia' && linha.aviso === 2) selo.classList.add('selo--erro');
    if (e.estado === 'vazia' && linha.aviso === 1) selo.classList.add('selo--alerta');
    if (e.estado === 'fora' && e.aviso === 2) selo.classList.add('selo--erro');
    if (e.estado === 'fora' && e.aviso === 1) selo.classList.add('selo--alerta');
  }

  function simulacao(lugar, ctx, api, conf) {
    var s = P().tpl('simulacao');
    var graus = ((ctx.calc && ctx.calc.graus) || {})[ctx.ehCia ? 'oficial' : 'praça'] || [];
    var equipe = api.conferir.simulacao();
    var total = 0;
    graus.slice().reverse().forEach(function (g) {
      var campo = P().tpl('grau');
      campo.querySelector('.campo-rotulo').textContent = g;
      total += equipe[g] || 0;
      campo.querySelector('.nova-distribuicao-espaco').appendChild(P().numero(0, 9, equipe[g] || 0, function (v) {
        api.conferir.definirSimulacao(g, v);
      }, g));
      s.querySelector('.nova-distribuicao-graus').appendChild(campo);
    });
    s.querySelector('.nova-distribuicao-simulacao-vazia').classList.toggle('oculto', total > 0);
    var tabelaSim = s.querySelector('.nova-distribuicao-simulacao-tabela');
    tabelaSim.classList.toggle('oculto', !total || conf.modo !== 'simulacao');

    if (total && conf.modo === 'simulacao') {
      var corpo = tabelaSim.querySelector('tbody');
      (conf.linhas || []).forEach(function (l) {
        var e = (l.estados || [])[0] || { estado: 'vazia' };
        var tr = P().tpl('simulacao-linha');
        postoCelula(tr.querySelector('.nova-distribuicao-col-posto'), l.posto);
        tr.querySelector('.nova-distribuicao-col-funcao').textContent = P().rotulo(ctx, l.nome);
        tr.querySelector('.nova-distribuicao-col-quem').textContent = e.pessoa || '';
        situacao(tr.querySelector('.nova-distribuicao-situacao'), e, l);
        var outro = tr.querySelector('.nova-distribuicao-outro-grau');
        outro.classList.toggle('oculto', !(e.aviso_grau > 0) || e.estado === 'vazia' || e.estado === 'fora');
        outro.classList.toggle('selo--alerta', e.aviso_grau === 1);
        outro.classList.toggle('selo--erro', e.aviso_grau === 2);
        corpo.appendChild(tr);
      });
      /* cada posto fora da escala com aviso: o motivo, na cor do nível */
      var foraLista = s.querySelector('.nova-distribuicao-fora');
      var foras = (((conf.resumos || [])[0] || {}).fora || []).filter(function (x) { return x.aviso > 0; });
      foras.forEach(function (x) {
        var nota = P().tpl('fora-nota');
        nota.classList.add(x.aviso === 2 ? 'nota--erro' : 'nota--alerta');
        nota.querySelector('.nota-texto').textContent = P().texto(M().foraAviso, { posto: x.posto, min: x.min });
        foraLista.appendChild(nota);
      });
      foraLista.classList.toggle('oculto', !foras.length);
      var sobra = ((conf.resumos || [])[0] || {}).sem_funcao || 0;
      var aviso = s.querySelector('.nova-distribuicao-sobra');
      aviso.textContent = sobra === 1 ? M().sobraUm : P().texto(M().sobraVarios, { n: sobra });
      aviso.classList.toggle('oculto', !sobra);
    }
    lugar.appendChild(s);
  }

  function desenhar(corpo, ctx, api) {
    var conf = (ctx.calc && ctx.calc.conferencia) || {};
    var u = P().unidade(corpo, ctx);
    var caixa = P().tpl('conferir');
    var modo = api.conferir.modo();
    var trilho = caixa.querySelector('.nova-distribuicao-conferir-modo');
    trilho.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === modo);
    });
    RosterWork.abas.ligar(trilho, function (aba) { api.conferir.definirModo(aba.getAttribute('data-valor')); });
    var lugar = caixa.querySelector('.nova-distribuicao-conferir-corpo');
    if (modo === 'simulacao') simulacao(lugar, ctx, api, conf);
    else tabela(lugar, ctx, api, conf);
    u.appendChild(caixa);
  }

  /* ---------- a escolha ---------- */

  /* o que pedir ao calcular: os efetivos (tabela) ou a equipe (simular); sem início ainda, nenhum */
  function parametros(unidadeId) {
    if (escolha.modo === 'simulacao') return { efetivos: null, simulacao: escolha.equipe[unidadeId] || {} };
    var de = escolha.inicio[unidadeId];
    if (de == null) return { efetivos: null, simulacao: null };
    var lista = [];
    for (var k = 0; k < COLUNAS; k++) lista.push(de + k);
    return { efetivos: lista, simulacao: null };
  }

  /* a tabela começa nas funções de mínimo com pessoa própria (as que dão erro vermelho vazias);
     devolve true quando acabou de definir e a tabela precisa ser calculada de novo */
  function definirInicioPadrao(unidadeId, ctx, ehPelotao) {
    if (escolha.inicio[unidadeId] != null) return false;
    var proprias = P().proprias(ctx);
    var n = (ctx.calc.funcoes || []).filter(function (f) { return f.nivel === 'minimo' && proprias.indexOf(f.nome) >= 0; }).length;
    escolha.inicio[unidadeId] = Math.max(n, ehPelotao ? 1 : 0);
    return escolha.modo === 'tabela';
  }

  /* o que os desenhos usam (api.conferir): lê e muda a escolha da unidade e recalcula */
  function api(unidadeId, recalcular) {
    return {
      modo: function () { return escolha.modo; },
      definirModo: function (m) { if (m !== escolha.modo) { escolha.modo = m; recalcular(); } },
      inicio: function () { return escolha.inicio[unidadeId()] || 0; },
      definirInicio: function (n) { escolha.inicio[unidadeId()] = n; recalcular(); },
      simulacao: function () { return escolha.equipe[unidadeId()] || {}; },
      definirSimulacao: function (grau, n) {
        var eq = escolha.equipe[unidadeId()] = escolha.equipe[unidadeId()] || {};
        if (n) eq[grau] = n; else delete eq[grau];
        recalcular();
      }
    };
  }

  window.RosterWork.novaDistribuicaoConferir = {
    desenhar: desenhar, parametros: parametros, definirInicioPadrao: definirInicioPadrao, api: api
  };
})();
