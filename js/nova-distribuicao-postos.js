/* ============================================================
   NOVA DISTRIBUIÇÃO — blocos 1 (Postos) e 2 (Funções especiais)
   Postos: as instalações e as viaturas (a ordem da lista) e um
   cartão por posto, que fechado mostra as funções e aberto traz o
   prefixo, a CNH e o efetivo (componente geral-posto-editar) e as
   funções por nível. Funções especiais: onde ficam o Chefe de
   Socorro e o Oficial de Área (caixas de marcar; o que é de outra
   unidade aparece marcado e travado), se podem ser condutores e,
   na companhia, quem faz o Oficial de Área sem oficial de serviço.
   Toda mudança passa pelo api.mudar (nova-distribuicao.js).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  /* ---------- 1. Postos ---------- */

  /* a lista de funções do posto, uma por linha, com a trava das que vêm das funções especiais */
  function funcoesDoPosto(ctx, posto) {
    return ((ctx.calc && ctx.calc.funcoes) || []).filter(function (f) { return f.posto === posto; });
  }

  function linhaFuncao(lista, f) {
    var p = P().tpl('funcao');
    p.querySelector('.nova-distribuicao-funcao-nome').textContent = f.papel ? f.funcao + ' · ' + f.papel : f.funcao;
    if (f.papel) P().trava(p, f.externa ? M().travaCompanhia : M().travaPapel);
    lista.appendChild(p);
  }

  function cartaoPosto(u, ctx, api, item, i, tipo) {
    var nome = item.nome;
    var id = 'posto-' + tipo + '-' + i;
    var chaveLocal = ctx.lado + ':viatura:' + i;
    var digitado = tipo === 'v' ? api.invalido(chaveLocal) : null;
    var funcoes = funcoesDoPosto(ctx, nome);
    var errosPosto = P().erros(ctx, 'efetivo:' + nome).concat(P().erros(ctx, (tipo === 'v' ? 'viatura:' : 'instalacao:') + i));
    if (digitado != null) errosPosto.push(M().prefixoInvalido);
    errosPosto = errosPosto.filter(function (e, k) { return errosPosto.indexOf(e) === k; });

    var linhas = funcoes.map(function (f) { return f.papel ? f.funcao + ' · ' + f.papel : f.funcao; });
    if (tipo === 'v' && funcoes.length) linhas.unshift(item.cnh ? P().texto(M().cnhResposta, { cnh: item.cnh }) : { texto: M().cnhFalta, falta: true });
    errosPosto.forEach(function (e) { linhas.push({ texto: e, falta: true }); });

    var caixa = P().cartao(u, api, ctx, id, nome || M().semPrefixo, linhas, function (lugar) {
      var campos = P().tpl('posto-campos');
      if (tipo === 'v') {
        var vt = RosterWork.postoEditar.viatura({
          prefixo: digitado != null ? digitado : nome, cnh: item.cnh,
          aoMudar: function () {
            var cnh = vt.valores().cnh;
            if (cnh !== item.cnh) api.mudar(ctx.lado, function (x) { x.viaturas[i].cnh = cnh; });
          }
        });
        var inp = vt.el.querySelector('[data-viatura-prefixo]');
        inp.disabled = ctx.soLeitura;
        vt.el.querySelectorAll('.aba').forEach(function (b) { b.disabled = ctx.soLeitura; });
        /* o prefixo vale ao sair do campo: fora do formato, fica só no campo, em vermelho */
        inp.addEventListener('change', function () {
          var novo = inp.value.trim().toUpperCase();
          if (novo === nome) { api.invalido(chaveLocal, null); api.redesenhar(); return; }
          if (!P().FORMATO_PREFIXO.test(novo)) { api.invalido(chaveLocal, inp.value); api.redesenhar(); return; }
          api.invalido(chaveLocal, null);
          api.renomear(ctx.lado, i, nome, novo);
        });
        campos.querySelector('.nova-distribuicao-posto-viatura').appendChild(vt.el);
      }
      var ef = RosterWork.postoEditar.efetivo({ min: item.efetivo[0], ideal: item.efetivo[1], max: item.efetivo[2] }, function (v) {
        api.mudar(ctx.lado, function (x) {
          var alvo = tipo === 'v' ? x.viaturas[i] : x.instalacoes.filter(function (o) { return o.nome === nome; })[0];
          if (alvo) alvo.efetivo = [v.min, v.ideal, v.max];
        });
      });
      ef.el.querySelectorAll('.campo-selecao').forEach(function (b) { b.disabled = ctx.soLeitura; });
      campos.querySelector('.nova-distribuicao-posto-efetivo').appendChild(ef.el);
      errosPosto.forEach(function (e) { P().erroCampo(campos.querySelector('.nova-distribuicao-posto-efetivo'), e); });

      campos.querySelectorAll('.nova-distribuicao-nivel').forEach(function (nivel) {
        var lista = nivel.querySelector('.nova-distribuicao-nivel-lista');
        var daqui = funcoes.filter(function (f) { return f.nivel === nivel.getAttribute('data-nivel'); });
        if (!daqui.length) lista.appendChild(P().tpl('nivel-vazio'));
        daqui.forEach(function (f) { linhaFuncao(lista, f); });
      });
      lugar.appendChild(campos);
    }, errosPosto.length > 0);
    if (!nome) caixa.querySelector('.nova-distribuicao-cartao-titulo').classList.add('nova-distribuicao-linha-nome--falta');
  }

  function postos(corpo, ctx, api) {
    var r = ctx.resp;
    var nomesInst = (r.instalacoes || []).map(function (i) { return i.nome; });
    corpo.appendChild(P().tpl('nota-postos'));
    var u = P().unidade(corpo, ctx);

    P().cartao(u, api, ctx, 'instalacoes', ctx.ehCia ? M().instalacoesCompanhia : M().instalacoesPelotao,
      nomesInst.length ? nomesInst : [M().nenhuma], function (lugar) {
        var opcoes = P().tpl('instalacoes');
        opcoes.querySelectorAll('[data-valor]').forEach(function (botao) {
          var nome = botao.getAttribute('data-valor');
          P().marcar(botao, nomesInst.indexOf(nome) >= 0, function (marcado) {
            api.mudar(ctx.lado, function (x) {
              if (marcado) x.instalacoes.push({ nome: nome, efetivo: [null, null, null] });
              else x.instalacoes = x.instalacoes.filter(function (o) { return o.nome !== nome; });
            });
          }, ctx.soLeitura);
        });
        lugar.appendChild(opcoes);
      });

    var vtrs = r.viaturas || [];
    P().cartao(u, api, ctx, 'viaturas', ctx.ehCia ? M().viaturasCompanhia : M().viaturasPelotao,
      vtrs.length ? vtrs.map(function (v, i) { return { texto: (i + 1) + 'º ' + (v.nome || M().semPrefixo), falta: !v.nome }; }) : [M().nenhuma],
      function (lugar) {
        lugar.appendChild(P().tpl('nota-viaturas'));
        vtrs.forEach(function (v, i) {
          var linha = P().tpl('viatura');
          linha.querySelector('.nova-distribuicao-linha-ordem').textContent = (i + 1) + 'º';
          var nome = linha.querySelector('.nova-distribuicao-linha-nome');
          nome.textContent = v.nome || M().semPrefixo;
          nome.classList.toggle('nova-distribuicao-linha-nome--falta', !v.nome);
          P().setas(linha, i, vtrs.length, function (passo) {
            api.esquecerInvalidos(ctx.lado);
            api.mudar(ctx.lado, function (x) { P().mover(x.viaturas, i, passo); });
          }, ctx.soLeitura);
          var remover = linha.querySelector('.nova-distribuicao-remover');
          remover.disabled = ctx.soLeitura;
          remover.addEventListener('click', function () {
            api.esquecerInvalidos(ctx.lado);
            api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); });
          });
          lugar.appendChild(linha);
        });
        var nova = P().tpl('nova-viatura');
        nova.disabled = ctx.soLeitura;
        nova.addEventListener('click', function () {
          api.mudar(ctx.lado, function (x) { x.viaturas.push({ nome: '', cnh: null, efetivo: [null, null, null] }); },
            ctx.lado + ':posto-v-' + vtrs.length);
        });
        lugar.appendChild(nova);
      });

    (r.instalacoes || []).forEach(function (inst, i) { cartaoPosto(u, ctx, api, inst, i, 'i'); });
    vtrs.forEach(function (v, i) { cartaoPosto(u, ctx, api, v, i, 'v'); });
  }

  /* ---------- 2. Funções especiais ---------- */

  /* as caixas de marcar dos postos da unidade e, travadas, as marcações das outras unidades */
  function marcasPostos(lugar, ctx, marcados, aoMudar, outros) {
    var opcoes = P().tpl('opcoes');
    ((ctx.calc && ctx.calc.postos) || []).forEach(function (p) {
      var botao = P().tpl('marca');
      botao.querySelector('.nova-distribuicao-marca-texto').textContent = p.nome;
      P().marcar(botao, marcados.indexOf(p.nome) >= 0, function (marcado) { aoMudar(p.nome, marcado); }, ctx.soLeitura);
      opcoes.appendChild(botao);
    });
    (outros || []).forEach(function (o) {
      o.postos.forEach(function (posto) {
        var botao = P().tpl('marca');
        botao.querySelector('.nova-distribuicao-marca-texto').textContent = posto;
        P().marcar(botao, true, null, true);
        P().trava(botao, P().texto(M().outraUnidade, { unidade: o.nome }));
        opcoes.appendChild(botao);
      });
    });
    lugar.appendChild(opcoes);
  }

  /* onde o Oficial de Área está nas outras unidades, para mostrar travado: na companhia, os pelotões;
     no pelotão, a companhia e os outros pelotões. O que está na tela vem das respostas em edição
     (ctxs = [companhia, pelotão]); o resto, do banco */
  function oficialOutros(ctxs, ctx, api) {
    var d = api.dados() || {};
    var outros = (d.oficial_outros || []).filter(function (o) { return (o.postos || []).length; });
    if (ctxs.length < 2) return outros;
    var cia = ctxs[0], pel = ctxs[1];
    var ciaId = d.companhia && d.companhia.unidade ? d.companhia.unidade.id : null;
    var pelotoes = outros.filter(function (o) { return o.unidade_id !== ciaId; });
    var daqui = ctx === cia ? ((pel.resp && pel.resp.oficial_postos) || []) : ((cia.resp && cia.resp.papel && cia.resp.papel.postos) || []);
    return daqui.length ? [{ nome: ctx === cia ? pel.nome : cia.nome, postos: daqui }].concat(pelotoes) : pelotoes;
  }

  function linhasPostos(marcados, outros) {
    var linhas = marcados.slice();
    (outros || []).forEach(function (o) {
      o.postos.forEach(function (posto) { linhas.push(posto + ' (' + o.nome + ')'); });
    });
    return linhas;
  }

  function funcoes(corpo, ctxs, api) {
    corpo.appendChild(P().tpl('nota-funcoes'));
    ctxs.forEach(function (ctx) {
      var u = P().unidade(corpo, ctx);
      if (ctx.semDados) {
        var vazio = P().tpl('companhia-sem-respostas');
        vazio.querySelector('.nova-distribuicao-copiar').addEventListener('click', function () { api.copiarCompanhia(this); });
        u.appendChild(vazio);
        return;
      }
      var r = ctx.resp;
      var calc = ctx.calc;
      var outros = oficialOutros(ctxs, ctx, api);
      var nomePapel = calc.papel_funcao;
      var marcados = (r.papel && r.papel.postos) || [];

      var linhasPapel = marcados.length ? linhasPostos(marcados, ctx.ehCia ? outros : null)
                                        : [{ texto: M().faltaResponder, falta: true }];
      P().cartao(u, api, ctx, 'papel', P().texto(M().ondeFica, { papel: nomePapel }), linhasPapel, function (lugar) {
        marcasPostos(lugar, ctx, marcados, function (posto, marcado) {
          api.mudar(ctx.lado, function (x) {
            var lista = (x.papel.postos || []).filter(function (n) { return n !== posto; });
            if (marcado) lista.push(posto);
            x.papel.postos = lista;
          });
        }, ctx.ehCia ? outros : null);
        if (marcados.length > 1) P().trava(lugar, M().mesmaPessoa);
      }, P().pendente(ctx, 'papel_postos'));

      if (calc.papel_viatura) {
        var cond = r.papel.condutor;
        P().cartao(u, api, ctx, 'condutor', P().texto(M().podeConduzir, { papel: nomePapel }),
          [cond == null ? { texto: M().faltaResponder, falta: true } : M().condutor[cond]], function (lugar) {
            lugar.appendChild(P().bolinhas(P().tpl('condutor'), 'nova-distribuicao-condutor-' + ctx.lado, function (v) { return Number(v) === cond; }, function (v) {
              api.mudar(ctx.lado, function (x) { x.papel.condutor = Number(v); });
            }, ctx.soLeitura));
          }, P().pendente(ctx, 'papel_condutor'));
      }

      if (ctx.ehCia) {
        var sem = r.sem_oficial;
        P().cartao(u, api, ctx, 'sem-oficial', M().semOficial,
          [sem == null ? { texto: M().faltaResponder, falta: true } : M().semOficialOpcoes[sem]], function (lugar) {
            lugar.appendChild(P().bolinhas(P().tpl('sem-oficial'), 'nova-distribuicao-sem-oficial', function (v) { return Number(v) === sem; }, function (v) {
              api.mudar(ctx.lado, function (x) { x.sem_oficial = Number(v); });
            }, ctx.soLeitura));
          }, P().pendente(ctx, 'sem_oficial'));
      } else {
        var oa = r.oficial_postos || [];
        P().cartao(u, api, ctx, 'oficial', M().ondeFicaOficialPelotao,
          linhasPostos(oa, outros).length ? linhasPostos(oa, outros) : [M().nenhum], function (lugar) {
            marcasPostos(lugar, ctx, oa, function (posto, marcado) {
              api.mudar(ctx.lado, function (x) {
                var lista = (x.oficial_postos || []).filter(function (n) { return n !== posto; });
                if (marcado) lista.push(posto);
                x.oficial_postos = lista;
              });
            }, outros);
          });
      }
    });
  }

  window.RosterWork.novaDistribuicaoPostos = { postos: postos, funcoes: funcoes };
})();
