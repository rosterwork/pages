/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 3, Funções especiais
   Onde ficam o Chefe de Socorro (pelotão) e o Oficial de Área, em
   caixas de marcar (vários postos = a mesma pessoa, que acumula).
   O Oficial de Área vem em grupos por unidade: primeiro as outras
   (a companhia e os outros pelotões, travadas), depois os postos da
   unidade escolhida. Também se pode ser condutor e, na companhia,
   quem faz o Oficial de Área sem oficial de serviço. No pelotão, a
   parte da companhia vem junto, sem repetir onde fica o Oficial de
   Área (os postos da companhia se marcam com ela no seletor).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }

  /* onde o Oficial de Área está nas outras unidades: na companhia, os pelotões; no pelotão, a companhia
     (das respostas em edição; ctxs = [companhia, pelotão]) e depois os outros pelotões (do banco) */
  function oficialOutros(ctxs, api) {
    var d = api.dados() || {};
    var outros = (d.oficial_outros || []).filter(function (o) { return (o.postos || []).length; });
    if (ctxs.length < 2) return outros;
    var cia = ctxs[0];
    var ciaId = d.companhia && d.companhia.unidade ? d.companhia.unidade.id : null;
    var pelotoes = outros.filter(function (o) { return o.unidade_id !== ciaId; });
    var daCia = (cia.resp && cia.resp.papel && cia.resp.papel.postos) || [];
    return (daCia.length ? [{ nome: cia.nome, postos: daCia }] : []).concat(pelotoes);
  }

  /* as caixas de marcar: as outras unidades (travadas, com o título de cada uma) e depois os postos da
     unidade escolhida (com o título dela quando há outras antes) */
  function grupos(lugar, ctx, outros, marcados, aoMudar) {
    var opcoes = P().tpl('opcoes');
    function titulo(nome) {
      var t = P().tpl('grupo-titulo');
      t.textContent = nome;
      opcoes.appendChild(t);
    }
    outros.forEach(function (o) {
      titulo(o.nome);
      o.postos.forEach(function (posto) {
        var botao = P().tpl('marca');
        botao.querySelector('.nova-distribuicao-marca-texto').textContent = posto;
        P().marcar(botao, true, null, true);
        P().trava(botao, P().texto(M().travaOutra, { unidade: o.nome }));
        opcoes.appendChild(botao);
      });
    });
    if (outros.length) titulo(ctx.nome);
    ((ctx.calc && ctx.calc.postos) || []).forEach(function (p) {
      var botao = P().tpl('marca');
      botao.querySelector('.nova-distribuicao-marca-texto').textContent = p.nome;
      P().marcar(botao, marcados.indexOf(p.nome) >= 0, function (marcado) { aoMudar(p.nome, marcado); }, ctx.soLeitura);
      opcoes.appendChild(botao);
    });
    lugar.appendChild(opcoes);
  }

  /* a resposta fechada: uma linha por unidade ("2ªCIBM: ABS-0055") */
  function linhasGrupos(ctx, outros, marcados, falta) {
    var linhas = outros.map(function (o) { return P().texto(M().grupoLinha, { unidade: o.nome, postos: o.postos.join(', ') }); });
    var daqui = marcados.length ? marcados.join(', ') : (falta ? M().faltaResponder : M().nenhum);
    linhas.push({ texto: P().texto(M().grupoLinha, { unidade: ctx.nome, postos: daqui }), falta: !marcados.length && falta });
    return linhas;
  }

  /* marca ou desmarca um posto numa lista de postos das respostas */
  function alternar(lista, posto, marcado) {
    var nova = (lista || []).filter(function (n) { return n !== posto; });
    if (marcado) nova.push(posto);
    return nova;
  }

  function funcoes(corpo, ctxs, api) {
    var outros = oficialOutros(ctxs, api);
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
      var nomePapel = calc.papel_funcao;
      var marcados = (r.papel && r.papel.postos) || [];
      var falta = P().pendente(ctx, 'papel_postos');

      if (ctx.ehCia && ctxs.length > 1) {
        /* a companhia vista do pelotão: onde fica o Oficial de Área se responde com ela no seletor */
        if (falta) P().erroCampo(u, P().texto(M().ciaFalta, { unidade: ctx.nome }));
      } else {
        var antes = ctx.ehCia ? outros : [];
        P().cartao(u, api, ctx, 'papel', P().texto(M().ondeFica, { papel: nomePapel }),
          ctx.ehCia ? linhasGrupos(ctx, antes, marcados, true) : (marcados.length ? marcados : [{ texto: M().faltaResponder, falta: true }]),
          function (lugar) {
            grupos(lugar, ctx, antes, marcados, function (posto, marcado) {
              api.mudar(ctx.lado, function (x) { x.papel.postos = alternar(x.papel.postos, posto, marcado); });
            });
            if (marcados.length > 1) P().trava(lugar, M().mesmaPessoa);
          }, falta, { muda: 'papel_postos' });
      }

      if (calc.papel_viatura) {
        var cond = r.papel.condutor;
        /* "só se não houver outro habilitado": a caixa do erro amarelo (vem marcada); "Não, nunca": o aviso do erro vermelho */
        var comAviso = r.papel.condutor_aviso !== false;
        var frasesCond = cond == null ? [{ texto: M().faltaResponder, falta: true }]
          : [M().condutor[cond]].concat(cond === 1 ? [P().texto(comAviso ? M().condutorComAviso : M().condutorSemAviso, { papel: nomePapel })]
            : cond === 2 ? [M().condutorNunca] : []);
        P().cartao(u, api, ctx, 'condutor', P().texto(M().podeConduzir, { papel: nomePapel }), frasesCond, function (lugar) {
          var opcoes = P().bolinhas(P().tpl('condutor'), 'nova-distribuicao-condutor-' + ctx.lado, function (v) { return Number(v) === cond; }, function (v) {
            api.mudar(ctx.lado, function (x) {
              x.papel.condutor = Number(v);
              if (x.papel.condutor !== 1) delete x.papel.condutor_aviso;
            });
          }, ctx.soLeitura);
          var marca = opcoes.querySelector('.nova-distribuicao-condutor-aviso');
          marca.classList.toggle('oculto', cond !== 1);
          marca.querySelector('.nova-distribuicao-condutor-aviso-texto').textContent = P().texto(M().condutorComAviso, { papel: nomePapel });
          P().marcar(marca, comAviso, function (marcado) {
            api.mudar(ctx.lado, function (x) { x.papel.condutor_aviso = marcado; });
          }, ctx.soLeitura);
          var nunca = opcoes.querySelector('.nova-distribuicao-condutor-nunca');
          nunca.classList.toggle('oculto', cond !== 2);
          nunca.querySelector('.nota-texto').textContent = M().condutorNunca;
          lugar.appendChild(opcoes);
        }, P().pendente(ctx, 'papel_condutor'), { muda: 'papel_condutor' });
      }

      if (ctx.ehCia) {
        var sem = r.sem_oficial;
        P().cartao(u, api, ctx, 'sem-oficial', M().semOficial,
          [sem == null ? { texto: M().faltaResponder, falta: true } : M().semOficialOpcoes[sem]], function (lugar) {
            lugar.appendChild(P().bolinhas(P().tpl('sem-oficial'), 'nova-distribuicao-sem-oficial', function (v) { return Number(v) === sem; }, function (v) {
              api.mudar(ctx.lado, function (x) { x.sem_oficial = Number(v); });
            }, ctx.soLeitura));
          }, P().pendente(ctx, 'sem_oficial'), { muda: 'sem_oficial' });
      } else {
        var oa = r.oficial_postos || [];
        P().cartao(u, api, ctx, 'oficial', P().texto(M().ondeFica, { papel: M().oficialArea }), linhasGrupos(ctx, outros, oa, false), function (lugar) {
          grupos(lugar, ctx, outros, oa, function (posto, marcado) {
            api.mudar(ctx.lado, function (x) { x.oficial_postos = alternar(x.oficial_postos, posto, marcado); });
          });
        }, false, { muda: 'oficial_postos' });
      }
    });
  }

  window.RosterWork.novaDistribuicaoFuncoes = { funcoes: funcoes };
})();
