/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 9, Conferir
   Três formas, num seletor: Tabela (a partir de N de serviço, N e
   os quatro seguintes, uma coluna cada, com os totais por posto),
   Simular a equipe (quantos de cada graduação) e Um dia real (quem
   está de serviço às 08h numa data, com a CNH e as regras). Nas duas
   últimas, quem senta em cada função (pela cadeira: a mesma pessoa
   ocupa uma só no posto), os avisos de grau e os avisos dos postos.
   As contas são do nova_distribuicao_calcular (conferencia); aqui o
   desenho e a escolha de cada unidade (fica entre as visitas), que
   diz ao calcular o que conferir.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var COLUNAS = 5;
  var escolha = { modo: 'tabela', inicio: {}, equipe: {}, dia: {} };

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

  /* o Chefe de Socorro (ou o Oficial de Área) dirige a viatura dele nesta coluna, sem outro erro no posto */
  function dirige(e, linha, r) {
    return !!e.chefe_condutor && ((r || {}).chefe_condutor || []).some(function (x) { return x.posto === linha.posto; });
  }
  function nomePapel(ctx) { return (ctx.calc && ctx.calc.papel_funcao) || ''; }

  /* o nível da marca e do selo: a vazia e a fora da escala trazem o delas; o dirigindo é amarelo */
  function nivel(e, linha, r) {
    if (e.estado === 'vazia' || e.estado === 'fora') return e.aviso || 0;
    return dirige(e, linha, r) ? 1 : 0;
  }

  /* a dica: a situação (e quem cobre ou acumula), por que fica fora, a consequência ou quem dirige */
  function dica(ctx, e, linha, r) {
    var frase = M().estados[e.estado] || M().estados.vazia;
    if (e.por) frase = P().texto(M().porQuem, { estado: frase, quem: P().completo(ctx, e.por) });
    if (e.estado === 'fora') frase = P().texto(M().foraMotivo, { min: minimoDe(ctx, linha.posto) });
    if (e.causa) frase = P().texto(M().consequencia, { posto: e.causa });
    if (dirige(e, linha, r)) frase = P().texto(M().dirige, { papel: nomePapel(ctx), posto: linha.posto });
    return frase;
  }

  /* a marca da função numa coluna */
  function marca(ctx, e, linha, r) {
    var el = P().tpl('estado-' + e.estado) || P().tpl('estado-vazia');
    var n = nivel(e, linha, r);
    el.classList.toggle('nova-distribuicao-estado--erro', n === 2);
    el.classList.toggle('nova-distribuicao-estado--alerta', n === 1);
    el.setAttribute('data-dica', dica(ctx, e, linha, r));
    return el;
  }

  function tabela(lugar, ctx, api, conf) {
    var t = P().tpl('conferir-tabela');
    var efetivos = conf.modo === 'tabela' ? conf.efetivos || [] : [];
    t.querySelectorAll('.nova-distribuicao-conferir-pracas').forEach(function (el) { el.classList.toggle('oculto', ctx.ehCia); });
    t.querySelectorAll('.nova-distribuicao-conferir-oficiais').forEach(function (el) { el.classList.toggle('oculto', !ctx.ehCia); });
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
      (l.estados || []).slice(0, efetivos.length).forEach(function (e, k) {
        var td = P().tpl('conferir-celula');
        td.appendChild(marca(ctx, e, l, (conf.resumos || [])[k]));
        tr.appendChild(td);
      });
      corpo.appendChild(tr);
    });
    /* os totais: os postos de cada erro (o número, e os nomes na dica, com as pessoas que tem) e quem fica sem função */
    t.querySelectorAll('tfoot tr[data-resumo]').forEach(function (tr) {
      var chave = tr.getAttribute('data-resumo');
      (conf.resumos || []).slice(0, efetivos.length).forEach(function (r) {
        var td = P().tpl('conferir-total');
        var valor = r[chave] || 0;
        td.textContent = String(Array.isArray(valor) ? valor.length : valor);
        if (Array.isArray(valor) && valor.length) {
          td.setAttribute('data-dica', valor.map(function (x) {
            return x.pessoas == null ? x.posto : P().texto(M().postoPessoas, { posto: x.posto, pessoas: x.pessoas, n: x.min != null ? x.min : x.ideal });
          }).join(', '));
        }
        tr.appendChild(td);
      });
    });
    t.querySelector('tfoot tr[data-resumo="fora"]').classList.toggle('oculto', !temFora(ctx));
    t.querySelector('.nova-distribuicao-legenda-fora').classList.toggle('oculto', !temFora(ctx));
    lugar.appendChild(t);
  }

  function situacao(ctx, selo, e, linha, r) {
    selo.textContent = M().estados[e.estado] || M().estados.vazia;
    var n = nivel(e, linha, r);
    if (e.estado === 'tem_gente') selo.classList.add('selo--sucesso');
    if (n === 2) selo.classList.add('selo--erro');
    else if (e.estado === 'coberta' || n === 1) selo.classList.add('selo--alerta');
    if (e.causa || dirige(e, linha, r)) selo.setAttribute('data-dica', dica(ctx, e, linha, r));
  }

  /* os avisos dos postos na equipe: os erros (abaixo do mínimo, sem condutor) e depois os amarelos (abaixo do
     ideal, o Chefe de Socorro dirigindo); os postos fora da escala com o nível escolhido */
  function avisosEquipe(lista, ctx, r) {
    var notas = [];
    (r.abaixo_minimo || []).forEach(function (x) { notas.push([2, P().texto(M().abaixoMinimo, { posto: x.posto, pessoas: x.pessoas, n: x.min })]); });
    (r.sem_condutor || []).forEach(function (x) { notas.push([2, P().texto(M().semCondutor, { posto: x.posto })]); });
    (r.fora || []).filter(function (x) { return x.aviso > 0; }).forEach(function (x) { notas.push([x.aviso, P().texto(M().foraAviso, { posto: x.posto, min: x.min })]); });
    (r.abaixo_ideal || []).forEach(function (x) { notas.push([1, P().texto(M().abaixoIdeal, { posto: x.posto, pessoas: x.pessoas, n: x.ideal })]); });
    (r.chefe_condutor || []).forEach(function (x) { notas.push([1, P().texto(M().dirige, { papel: nomePapel(ctx), posto: x.posto })]); });
    notas.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (n) {
      var nota = P().tpl('nota-equipe');
      nota.classList.add(n[0] === 2 ? 'nota--erro' : 'nota--alerta');
      nota.querySelector('.nota-texto').textContent = n[1];
      lista.appendChild(nota);
    });
    lista.classList.toggle('oculto', !notas.length);
  }

  /* Simular a equipe (as graduações) e Um dia real (a data e quem está de serviço nela) */
  function equipe(lugar, ctx, api, conf, modo) {
    var s = P().tpl('simulacao');
    var total = 0;
    s.querySelector('.nova-distribuicao-graus').classList.toggle('oculto', modo === 'dia');
    s.querySelector('.nova-distribuicao-graus-ajuda').classList.toggle('oculto', modo === 'dia');
    s.querySelector('.nova-distribuicao-dia').classList.toggle('oculto', modo !== 'dia');
    if (modo === 'dia') {
      var campoDia = s.querySelector('.nova-distribuicao-dia-data');
      campoDia.value = RosterWork.data.isoParaBR(api.conferir.dia());
      RosterWork.campos.ligarData(campoDia);
      campoDia.addEventListener('input', function () {
        var iso = campoDia.value.length === 10 ? RosterWork.data.paraISO(campoDia.value) : null;
        if (iso && iso !== api.conferir.dia()) { api.focarDepois('.nova-distribuicao-dia-data'); api.conferir.definirDia(iso); }
      });
      var membros = conf.modo === 'dia' ? conf.equipe || [] : [];
      total = membros.length;
      s.querySelector('.nova-distribuicao-dia-equipe').textContent = membros.map(function (m) {
        return P().texto(m.cnh && m.cnh !== 'Nenhuma' ? M().membroCnh : M().membroSemCnh, { nome: m.nome, cnh: m.cnh });
      }).join(', ');
      s.querySelector('.nova-distribuicao-dia-vazia').classList.toggle('oculto', total > 0 || conf.modo !== 'dia');
    } else {
      var graus = ((ctx.calc && ctx.calc.graus) || {})[ctx.ehCia ? 'oficial' : 'praça'] || [];
      var escolhidos = api.conferir.simulacao();
      graus.slice().reverse().forEach(function (g) {
        var campo = P().tpl('grau');
        campo.querySelector('.campo-rotulo').textContent = g;
        total += escolhidos[g] || 0;
        campo.querySelector('.nova-distribuicao-espaco').appendChild(P().numero(0, 9, escolhidos[g] || 0, function (v) {
          api.conferir.definirSimulacao(g, v);
        }, g));
        s.querySelector('.nova-distribuicao-graus').appendChild(campo);
      });
      s.querySelector('.nova-distribuicao-simulacao-vazia').classList.toggle('oculto', total > 0);
    }
    var tabelaSim = s.querySelector('.nova-distribuicao-simulacao-tabela');
    tabelaSim.classList.toggle('oculto', !total || conf.modo !== modo);

    if (total && conf.modo === modo) {
      var corpo = tabelaSim.querySelector('tbody');
      var r = (conf.resumos || [])[0] || {};
      (conf.linhas || []).forEach(function (l) {
        var e = (l.estados || [])[0] || { estado: 'vazia' };
        var tr = P().tpl('simulacao-linha');
        postoCelula(tr.querySelector('.nova-distribuicao-col-posto'), l.posto);
        /* a função própria aparece pela cadeira da pessoa no posto ("Efetivo 2"; "Efetivo 1 · Chefe de Socorro e Condutor") */
        tr.querySelector('.nova-distribuicao-col-funcao').textContent = e.estado === 'tem_gente' && e.cadeira ? e.cadeira : P().rotulo(ctx, l.nome);
        tr.querySelector('.nova-distribuicao-col-quem').textContent = e.pessoa || '';
        situacao(ctx, tr.querySelector('.nova-distribuicao-situacao'), e, l, r);
        var outro = tr.querySelector('.nova-distribuicao-outro-grau');
        outro.classList.toggle('oculto', !(e.aviso_grau > 0) || e.estado === 'vazia' || e.estado === 'fora');
        outro.classList.toggle('selo--alerta', e.aviso_grau === 1);
        outro.classList.toggle('selo--erro', e.aviso_grau === 2);
        corpo.appendChild(tr);
      });
      avisosEquipe(s.querySelector('.nova-distribuicao-avisos-equipe'), ctx, r);
      var sobra = r.sem_funcao || 0;
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
    /* o dia real começa no próximo serviço */
    if (modo === 'dia' && !api.conferir.dia() && api.dados()) { api.conferir.definirDia(api.dados().proximo_servico || api.dados().hoje); return; }
    if (modo === 'tabela') tabela(lugar, ctx, api, conf);
    else equipe(lugar, ctx, api, conf, modo);
    u.appendChild(caixa);
  }

  /* ---------- a escolha ---------- */

  /* o que pedir ao calcular: os efetivos (tabela), a equipe (simular) ou o dia; sem início ainda, nenhum */
  function parametros(unidadeId) {
    if (escolha.modo === 'simulacao') return { efetivos: null, simulacao: escolha.equipe[unidadeId] || {} };
    if (escolha.modo === 'dia') return { efetivos: null, simulacao: { dia: escolha.dia[unidadeId] || null } };
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
      },
      dia: function () { return escolha.dia[unidadeId()] || null; },
      definirDia: function (iso) { escolha.dia[unidadeId()] = iso; recalcular(); }
    };
  }

  window.RosterWork.novaDistribuicaoConferir = {
    desenhar: desenhar, parametros: parametros, definirInicioPadrao: definirInicioPadrao, api: api
  };
})();
