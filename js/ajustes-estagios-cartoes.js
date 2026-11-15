/* ============================================================
   AJUSTES — aba Estágios: as regras do estágio escolhido, em cartões
   Os cartões da Distribuição (nova-distribuicao-pecas.js): fechados,
   a resposta embaixo; abertos, as perguntas. Na ordem: Nome do
   estágio · Período (De e Até; sem Até, vale até alguém pôr) · Quem
   participa (nas bolinhas, Por graduação, com as caixas das
   graduações, ou Por nome, com o campo de militar e os escolhidos)
   · Funções e viaturas (uma parte por função: o posto e a função,
   Junto com ou No lugar de quem está na função, e quantos cabem) ·
   Se a viatura sair da escala · Quando não couber nas viaturas
   (ficam sem função ou vão para um posto e função, sempre junto) ·
   Acúmulo de função (a função acumulada e quem a faz) e, no fim, o
   Remover estágio. Cada
   resposta vai para o rascunho da aba (api.mudar, ajustes-estagios.js).
   RosterWork.ajustesEstagiosCartoes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function msg() { return RW.mensagens.ajustes.estagios; }
  function P() { return RW.novaDistribuicaoPecas; }
  function br(iso) { return iso ? RW.data.isoParaBR(iso) : ''; }

  /* ---------- os textos das respostas ---------- */

  function nomePosto(dados, id) {
    var p = (dados.postos || []).filter(function (x) { return x.id === id; })[0];
    return p ? p.nome : '';
  }
  function textoFuncao(dados, posto, funcao) { return nomePosto(dados, posto) + ' · ' + funcao; }

  function textoPeriodo(e) {
    if (!e.inicio) return null;
    return e.fim ? msg().periodoDe(br(e.inicio), br(e.fim)) : msg().periodoDesde(br(e.inicio));
  }

  function nomeMilitar(m) { return (m.grad ? m.grad + ' ' : '') + m.nome; }
  function militarDe(dados, cpf) { return (dados.militares || []).filter(function (m) { return m.cpf === cpf; })[0] || null; }

  /* quem participa: as graduações marcadas (da mais moderna para a mais antiga) ou os nomes */
  function textoQuem(dados, e) {
    if (e.quem === 'graduacao') {
      var graus = (dados.graus || []).filter(function (g) { return e.graus.indexOf(g.nivel) >= 0; });
      return graus.length ? graus.map(function (g) { return g.abrev; }).join(', ') : null;
    }
    var nomes = e.militares.map(function (cpf) {
      var m = militarDe(dados, cpf);
      return m ? nomeMilitar(m) + (m.unidade_id !== dados.unidade.id ? ' · ' + m.unidade : '') : '';
    }).filter(Boolean);
    return nomes.length ? nomes.join(', ') : null;
  }

  /* a contagem embaixo das escolhas: os militares da unidade nas graduações marcadas, ou os escolhidos pelo nome */
  function textoContagem(dados, e) {
    if (e.quem === 'nome') return msg().escolhidos(e.militares.length);
    var n = (dados.graus || []).filter(function (g) { return e.graus.indexOf(g.nivel) >= 0; })
      .reduce(function (s, g) { return s + g.na_unidade; }, 0);
    return msg().naUnidade(n);
  }

  function textoUmaFuncao(dados, f) {
    return msg().funcaoLinha(textoFuncao(dados, f.posto, f.funcao), msg().modos[f.modo], f.quantos);
  }
  function completa(f) { return !!(f.posto && f.funcao); }
  function completo(a) { return !!(a.posto && a.funcao && a.quem_posto && a.quem_funcao); }

  /* a resposta que ainda falta (o que falta só é acusado pelo Salvar, como na regra nova da Distribuição) */
  function falta() { return RW.mensagens.novaDistribuicao.faltaResponder; }

  /* todas as funções da unidade, como "Posto · Função" (o valor é "posto|função") */
  function opcoesFuncoes(dados) {
    var itens = [];
    (dados.postos || []).forEach(function (p) {
      p.funcoes.forEach(function (f) { itens.push({ valor: p.id + '|' + f, texto: p.nome + ' · ' + f }); });
    });
    return itens;
  }
  function partir(valor) { var i = valor.indexOf('|'); return { posto: valor.slice(0, i), funcao: valor.slice(i + 1) }; }

  function traco(lugar) { lugar.appendChild(RW.tpl('tpl-estagios-traco')); }

  /* ---------- 1. Nome ---------- */
  function cartaoNome(u, ctx) {
    var e = ctx.estagio;
    P().cartao(u, ctx.api, { lado: 'e' }, 'nome', msg().tituloNome, [e.nome.trim() || falta()], function (lugar) {
      var c = RW.tpl('tpl-estagios-nome');
      var campo = c.querySelector('.ajustes-estagios-nome');
      campo.value = e.nome;
      campo.addEventListener('input', function () {
        ctx.api.mudar(function (x) { x.nome = campo.value; }, { campo: 'nome', redesenhar: false });
      });
      lugar.appendChild(c);
    });
  }

  /* ---------- 2. Período ---------- */
  function cartaoPeriodo(u, ctx) {
    var e = ctx.estagio;
    var texto = textoPeriodo(e);
    P().cartao(u, ctx.api, { lado: 'e' }, 'periodo', msg().tituloPeriodo, [texto || falta()], function (lugar) {
      var c = RW.tpl('tpl-estagios-periodo');
      c.querySelectorAll('.ajustes-estagios-data').forEach(function (campo) {
        var nome = campo.getAttribute('data-campo');
        campo.value = br(e[nome]);
        RW.campos.ligarData(campo);
        /* vai para o rascunho quando a data fica completa (digitada ou escolhida no calendário) ou o campo esvazia */
        campo.addEventListener('input', function () {
          var valor = campo.value.trim();
          var iso = RW.data.paraISO(valor);
          if (valor && !iso) return;
          ctx.api.mudar(function (x) { x[nome] = iso || (nome === 'fim' ? null : ''); }, { campo: nome, redesenhar: false });
        });
      });
      lugar.appendChild(c);
    });
  }

  /* ---------- 3. Quem participa ---------- */
  function cartaoQuem(u, ctx) {
    var e = ctx.estagio, dados = ctx.dados;
    var texto = textoQuem(dados, e);
    P().cartao(u, ctx.api, { lado: 'e' }, 'quem', msg().tituloQuem, [texto || falta()], function (lugar) {
      var c = RW.tpl('tpl-estagios-quem');
      P().bolinhas(c.querySelector('.nova-distribuicao-opcoes'), 'estagios-quem', function (v) { return v === e.quem; }, function (v) {
        ctx.api.mudar(function (x) { x.quem = v; });
      });
      var graus = c.querySelector('.ajustes-estagios-graus');
      var nomes = c.querySelector('.ajustes-estagios-nomes');
      graus.classList.toggle('oculto', e.quem !== 'graduacao');
      nomes.classList.toggle('oculto', e.quem !== 'nome');
      if (e.quem === 'graduacao') {
        (dados.graus || []).forEach(function (g) {
          var marca = P().tpl('marca');
          marca.querySelector('.nova-distribuicao-marca-texto').textContent = g.abrev;
          P().marcar(marca, e.graus.indexOf(g.nivel) >= 0, function (ligado) {
            ctx.api.mudar(function (x) {
              x.graus = x.graus.filter(function (n) { return n !== g.nivel; });
              if (ligado) x.graus.push(g.nivel);
              x.graus.sort(function (a, b) { return b - a; });
            });
          });
          graus.appendChild(marca);
        });
      } else {
        campoMilitar(nomes, ctx);
      }
      c.querySelector('.ajustes-estagios-contagem').textContent = textoContagem(dados, e);
      lugar.appendChild(c);
    });
  }

  /* o campo de militar (geral-combo-militar): os militares ativos por unidade, a do estágio primeiro e aberta; o
     escolhido entra na lista embaixo, com a lixeira */
  function campoMilitar(nomes, ctx) {
    var e = ctx.estagio, dados = ctx.dados;
    var inp = nomes.querySelector('.campo-combo input');
    var menu = nomes.querySelector('.campo-combo .dropdown-menu');
    inp.id = 'estagios-militar';
    menu.id = 'estagios-militar-menu';
    inp.setAttribute('aria-controls', menu.id);
    var combo = RW.comboMilitar.criar(inp, menu, {
      textos: { selecione: msg().militarPlaceholder, filtroVazio: msg().militarNinguem, semNinguem: msg().militarNinguem },
      atual: function () { return null; },
      ignorar: function () { return e.militares; },
      aoEscolher: function (m) { ctx.api.mudar(function (x) { x.militares.push(m.cpf); }); }
    });
    var lista = [], unidade = null;
    (dados.militares || []).forEach(function (m) {
      if (m.unidade !== unidade) { unidade = m.unidade; lista.push({ titulo: m.unidade || msg().semUnidade, aberto: m.unidade_id === dados.unidade.id }); }
      lista.push(m);
    });
    combo.preencher(lista);
    var escolhidos = nomes.querySelector('.ajustes-estagios-escolhidos');
    e.militares.forEach(function (cpf, i) {
      var m = militarDe(dados, cpf);
      var linha = RW.tpl('tpl-estagios-escolhido');
      linha.querySelector('.ajustes-estagios-escolhido-nome').textContent = m
        ? nomeMilitar(m) + (m.unidade_id !== dados.unidade.id ? ' · ' + m.unidade : '') : msg().militarInativo;
      linha.querySelector('.nova-distribuicao-remover').addEventListener('click', function () {
        ctx.api.mudar(function (x) { x.militares.splice(i, 1); });
      });
      escolhidos.appendChild(linha);
    });
  }

  /* ---------- 4. Funções e viaturas ---------- */
  function cartaoFuncoes(u, ctx) {
    var e = ctx.estagio, dados = ctx.dados;
    var linhas = e.funcoes.filter(completa).map(function (f) { return textoUmaFuncao(dados, f); });
    P().cartao(u, ctx.api, { lado: 'e' }, 'funcoes', msg().tituloFuncoes, linhas.length ? linhas : [falta()], function (lugar) {
      var itens = opcoesFuncoes(dados);
      e.funcoes.forEach(function (f, i) {
        if (i) traco(lugar);
        var parte = RW.tpl('tpl-estagios-funcao');
        var usadas = e.funcoes.map(function (g) { return g.posto + '|' + g.funcao; });
        var atualValor = completa(f) ? f.posto + '|' + f.funcao : null;
        parte.querySelector('[data-espaco="funcao"]').appendChild(P().selecao(itens.filter(function (o) {
          return o.valor === atualValor || usadas.indexOf(o.valor) < 0;
        }), atualValor, function (v) {
          ctx.api.mudar(function (x) { var p = partir(v); x.funcoes[i].posto = p.posto; x.funcoes[i].funcao = p.funcao; });
        }, { rotulo: msg().tituloFuncoes }));
        parte.querySelector('.nova-distribuicao-remover').addEventListener('click', function () {
          ctx.api.mudar(function (x) {
            var saiu = x.funcoes.splice(i, 1)[0];
            /* o acúmulo de quem estava nessa função sai junto */
            x.acumulos = x.acumulos.filter(function (a) { return !(a.quem_posto === saiu.posto && a.quem_funcao === saiu.funcao); });
          });
        });
        P().bolinhas(parte.querySelector('.nova-distribuicao-opcoes'), 'estagios-como-' + i, function (v) { return v === f.modo; }, function (v) {
          ctx.api.mudar(function (x) { x.funcoes[i].modo = v; });
        });
        parte.querySelector('[data-espaco="quantos"]').appendChild(P().numero(1, 10, f.quantos, function (n) {
          ctx.api.mudar(function (x) { x.funcoes[i].quantos = n; });
        }, msg().rotuloQuantos));
        lugar.appendChild(parte);
      });
      var fim = RW.tpl('tpl-estagios-funcoes-fim');
      fim.querySelector('.nova-distribuicao-adicionar').addEventListener('click', function () {
        ctx.api.mudar(function (x) { x.funcoes.push({ posto: null, funcao: null, modo: 'junto', quantos: 1 }); });
      });
      lugar.appendChild(fim);
    });
  }

  /* ---------- 5. Se a viatura sair da escala ---------- */
  function cartaoFora(u, ctx) {
    var e = ctx.estagio;
    P().cartao(u, ctx.api, { lado: 'e' }, 'fora', msg().tituloFora, [msg().fora[e.viatura_fora]], function (lugar) {
      var c = RW.tpl('tpl-estagios-fora');
      P().bolinhas(c.querySelector('.nova-distribuicao-opcoes'), 'estagios-fora', function (v) { return v === e.viatura_fora; }, function (v) {
        ctx.api.mudar(function (x) { x.viatura_fora = v; });
      });
      lugar.appendChild(c);
    });
  }

  /* ---------- 6. Quando não couber nas viaturas: ficam sem função ou vão para um posto e função ---------- */
  function cartaoSobra(u, ctx) {
    var e = ctx.estagio, dados = ctx.dados;
    var escolhida = e.sobra && e.sobra.posto && e.sobra.funcao ? e.sobra.posto + '|' + e.sobra.funcao : null;
    var resposta = !e.sobra ? msg().fora.sem_funcao
      : (escolhida ? msg().sobraVaoPara(textoFuncao(dados, e.sobra.posto, e.sobra.funcao)) : falta());
    P().cartao(u, ctx.api, { lado: 'e' }, 'sobra', msg().tituloSobra, [resposta], function (lugar) {
      var c = RW.tpl('tpl-estagios-sobra');
      c.querySelector('[data-espaco="sobra"]').appendChild(P().selecao(opcoesFuncoes(dados), escolhida, function (v) {
        ctx.api.mudar(function (x) { var p = partir(v); x.sobra = { posto: p.posto, funcao: p.funcao }; });
      }, { rotulo: msg().tituloSobra }));
      P().bolinhas(c.querySelector('.nova-distribuicao-opcoes'), 'estagios-sobra', function (v) {
        return v === (e.sobra ? 'vao_para' : 'sem_funcao');
      }, function (v) {
        ctx.api.mudar(function (x) { x.sobra = v === 'vao_para' ? (x.sobra || { posto: null, funcao: null }) : null; });
      });
      lugar.appendChild(c);
    });
  }

  /* ---------- 7. Acúmulo de função ---------- */
  function cartaoAcumulos(u, ctx) {
    var e = ctx.estagio, dados = ctx.dados;
    var linhas = e.acumulos.filter(completo).map(function (a) {
      return msg().acumuloLinha(textoFuncao(dados, a.posto, a.funcao), textoFuncao(dados, a.quem_posto, a.quem_funcao));
    });
    var faltando = e.acumulos.some(function (a) { return !completo(a); });
    P().cartao(u, ctx.api, { lado: 'e' }, 'acumulos', msg().tituloAcumulos, linhas.length ? linhas : [faltando ? falta() : msg().nenhumAcumulo], function (lugar) {
      var todas = opcoesFuncoes(dados);
      /* quem acumula: quem está numa das funções do estágio */
      var doEstagio = e.funcoes.filter(completa).map(function (f) { return { valor: f.posto + '|' + f.funcao, texto: textoFuncao(dados, f.posto, f.funcao) }; });
      if (!e.acumulos.length) lugar.appendChild(RW.tpl('tpl-estagios-acumulos-vazio'));
      e.acumulos.forEach(function (a, i) {
        if (i) traco(lugar);
        var parte = RW.tpl('tpl-estagios-acumulo');
        var acumula = a.posto && a.funcao ? a.posto + '|' + a.funcao : null;
        var quem = a.quem_posto && a.quem_funcao ? a.quem_posto + '|' + a.quem_funcao : null;
        parte.querySelector('[data-espaco="acumula"]').appendChild(P().selecao(todas.filter(function (o) { return o.valor !== quem; }), acumula, function (v) {
          ctx.api.mudar(function (x) { var p = partir(v); x.acumulos[i].posto = p.posto; x.acumulos[i].funcao = p.funcao; });
        }, { rotulo: msg().rotuloAcumula }));
        parte.querySelector('[data-espaco="quem"]').appendChild(P().selecao(doEstagio.filter(function (o) { return o.valor !== acumula; }), quem, function (v) {
          ctx.api.mudar(function (x) { var p = partir(v); x.acumulos[i].quem_posto = p.posto; x.acumulos[i].quem_funcao = p.funcao; });
        }, { rotulo: msg().rotuloQuemEsta }));
        parte.querySelector('.nova-distribuicao-remover').addEventListener('click', function () {
          ctx.api.mudar(function (x) { x.acumulos.splice(i, 1); });
        });
        lugar.appendChild(parte);
      });
      var fim = RW.tpl('tpl-estagios-acumulos-fim');
      fim.querySelector('.nova-distribuicao-adicionar').addEventListener('click', function () {
        ctx.api.mudar(function (x) { x.acumulos.push({ posto: null, funcao: null, quem_posto: null, quem_funcao: null }); });
      });
      lugar.appendChild(fim);
    });
  }

  /* ---------- tudo: a frase do alto, o bloco cinza da unidade com os cartões e o Remover estágio ---------- */
  function montar(conteudo, ctx) {
    conteudo.appendChild(RW.tpl('tpl-estagios-ajuda'));
    var u = P().unidade(conteudo, { nome: ctx.dados.unidade.nome }, ctx.dados.unidade.cidade);
    cartaoNome(u, ctx);
    cartaoPeriodo(u, ctx);
    cartaoQuem(u, ctx);
    cartaoFuncoes(u, ctx);
    cartaoFora(u, ctx);
    cartaoSobra(u, ctx);
    cartaoAcumulos(u, ctx);
    var remover = RW.tpl('tpl-estagios-remover');
    remover.querySelector('.ajustes-estagios-remover').addEventListener('click', function () { ctx.api.remover(); });
    u.appendChild(remover);
  }

  RW.ajustesEstagiosCartoes = { montar: montar };
})();
