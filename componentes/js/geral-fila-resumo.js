/* ============================================================
   RESUMO DO PEDIDO — o que aparece quando o cartão da fila abre
   ali mesmo (geral-fila, opcoes.expandir: Pendências e as abas Pendências)
   Um resumo curto e as ações, sem abrir o painel; "Ver detalhes"
   abre o painel completo (ou a página do assunto). As ações são as
   do painel (RosterWork.trocasPainel.acao e
   .folgasAprovacaoPainel.acao): a mesma confirmação, o mesmo véu e o
   mesmo resumo com Desfazer.
     · troca: os dias (os 4 primeiros e "e mais N dias"), a análise
       (na troca em aberto) e os aceites (Aceitou, Pendente e, de
       quem não tem conta, também Sem conta)
     · folga: o dia com o horário, o motivo e a análise
     · dados: as alterações (de, seta, para), com a situação de cada uma
   Cada linha com selo tem o texto à esquerda e os selos à direita.
   API: RosterWork.filaResumo.pedido(corpo, p, ctx, aoDetalhes)
          (um pedido da fila: { tipo, dado, minha })
        .meuPedido(corpo, p, ctx, irPara)
          (um pedido do próprio militar, os Seus pedidos da Pendências, de pendencias_meus_pedidos)
        .seloAceites(aceites) → o selo Pendente que abre a lista dos
          aceites (a troca aprovada com aceite faltando, na Trocas)
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var LIMITE_DIAS = 4;   // o resumo é curto: os 4 primeiros dias; o resto fica no Ver detalhes
  var SELO_ALTERACAO = { pendente: 'selo--alerta', aprovada: 'selo--sucesso', recusada: 'selo--erro' };

  function M() { return RW.mensagens; }
  function nome(grau, n) { return ((grau || '') + ' ' + (n || '')).trim(); }
  /* "Cb. QPBM Negrete" → "Cb. Negrete": o registro traz o quadro, o resumo não precisa */
  function semQuadro(n) { return String(n || '').replace(/ Q[A-Z]+ /, ' '); }
  /* "2026-11-01" → "01/11" */
  function dataCurta(iso) { var s = String(iso || ''); return s.slice(8, 10) + '/' + s.slice(5, 7); }
  /* o horário só quando é parte do serviço (início igual ao fim = o serviço inteiro) */
  function trechoParte(hi, hf) {
    var a = String(hi || '').slice(0, 5), b = String(hf || '').slice(0, 5);
    return a && b && a !== b ? RW.fila.trecho(a, b) : '';
  }

  /* ---------- as peças ---------- */
  function secao(c, nomeSecao) {
    var s = c.querySelector('[data-secao="' + nomeSecao + '"]');
    s.classList.remove('oculto');
    return s.querySelector('.pedido-resumo-lista');
  }

  /* uma linha: o texto e até dois selos ({ texto, classe }; sem classe = o selo cinza) */
  function linha(lista, texto, selos) {
    var l = RosterWork.tpl('tpl-pedido-resumo-linha');
    if (!l) return;
    l.querySelector('.pedido-resumo-linha-texto').textContent = texto;
    var vagas = l.querySelectorAll('.selo');
    (selos || []).filter(Boolean).forEach(function (x, i) {
      if (!vagas[i]) return;
      vagas[i].textContent = x.texto;
      if (x.classe) vagas[i].classList.add(x.classe);
      vagas[i].classList.remove('oculto');
    });
    lista.appendChild(l);
  }

  /* os dias: a data e o texto; passou do limite, "e mais N dias" na coluna do texto (a da data vazia) */
  function dia(lista, data, texto) {
    var l = RosterWork.tpl('tpl-pedido-resumo-dia');
    if (!l) return;
    l.querySelector('.pedido-resumo-dia-data').textContent = data;
    l.querySelector('.pedido-resumo-dia-texto').textContent = texto;
    lista.appendChild(l);
  }
  function dias(lista, itens) {
    itens.slice(0, LIMITE_DIAS).forEach(function (x) { dia(lista, dataCurta(x.data), x.texto); });
    if (itens.length > LIMITE_DIAS) dia(lista, '', M().pendencias.resumoMais(itens.length - LIMITE_DIAS));
  }

  /* o aceite: Aceitou, ou Pendente (e Sem conta, de quem não tem como aceitar) */
  function selosAceite(a) {
    var t = M().trocas;
    if (a.aceito_em) return [{ texto: t.seloAceitou, classe: 'selo--sucesso' }];
    return [{ texto: t.seloAceitePendente, classe: 'selo--alerta' }, a.tem_conta === false ? { texto: t.seloSemConta } : null];
  }
  function aceites(lista, todos) {
    todos.forEach(function (a) { linha(lista, a.titulo || '', selosAceite(a)); });
  }

  /* a análise: o resultado no selo da primeira linha e o título de cada nota, uma por linha */
  function analise(lista, r) {
    var notas = (r.avisos || []).length ? r.avisos : (r.verdes || []);
    var titulos = notas.map(function (n) { return n.titulo ? n.titulo + '.' : ''; }).filter(Boolean);
    if (!titulos.length) titulos = [M().impacto.okFrase];
    titulos.forEach(function (t, i) { linha(lista, t, i === 0 ? [RW.impacto.selo(r)] : []); });
  }

  /* uma alteração de dados: o dado, de (seta) para e, nos seus pedidos, a situação */
  function alteracao(lista, item, comSituacao) {
    var l = RosterWork.tpl('tpl-pedido-resumo-alteracao');
    if (!l) return;
    l.querySelector('.pedido-resumo-alteracao-rotulo').textContent = item.rotulo || '';
    l.querySelector('.pedido-item-de').textContent = item.valor_atual || '-';
    l.querySelector('.pedido-item-para').textContent = item.valor_novo || '-';
    if (comSituacao && item.status) {
      var s = l.querySelector('.selo');
      s.textContent = M().pendencias.situacaoAlteracao[item.status] || '';
      s.classList.add(SELO_ALTERACAO[item.status] || 'selo--escuro');
      s.classList.remove('oculto');
    }
    lista.appendChild(l);
  }

  /* as ações: cada botão chama a ação do painel pelo nome (mapa = { botão: ação }); sem ação, o botão some */
  function acoes(c, mapa, executar, aoDetalhes) {
    [].forEach.call(c.querySelectorAll('[data-botao]'), function (b) {
      var botao = b.getAttribute('data-botao');
      if (botao === 'detalhes') { b.addEventListener('click', aoDetalhes); return; }
      var acao = mapa[botao];
      b.classList.toggle('oculto', !acao);
      if (acao) b.addEventListener('click', function () { executar(acao, b); });
    });
  }

  function carregando(corpo) {
    corpo.textContent = '';
    var pts = document.getElementById('carregando-pontos');
    if (pts) corpo.appendChild(pts.content.cloneNode(true));
  }
  function mostrar(corpo, c) { corpo.textContent = ''; corpo.appendChild(c); }

  /* sem o resumo: o aviso e o Ver detalhes */
  function falha(corpo, aoDetalhes) {
    var c = RosterWork.tpl('tpl-pedido-resumo');
    if (!c) return;
    var aviso = RosterWork.tpl('tpl-pedido-resumo-linha');
    if (aviso) { aviso.querySelector('.pedido-resumo-linha-texto').textContent = M().pendencias.resumoFalha; c.insertBefore(aviso, c.firstChild); }
    acoes(c, {}, null, aoDetalhes);
    mostrar(corpo, c);
  }

  /* ---------- troca ---------- */
  /* os dois dias da troca de uma (o serviço e a devolução), na ordem das datas */
  function diasDaTroca(t) {
    var p = M().pendencias, sol = nome(t.solicitante_grau, t.solicitante_nome), par = nome(t.parceiro_grau, t.parceiro_nome);
    var r = [{ data: t.data_servico_solicitante, texto: p.resumoNoLugar(par, sol, trechoParte(t.horario_inicio, t.horario_fim)) }];
    if (t.data_servico_parceiro) {
      r.push({ data: t.data_servico_parceiro, texto: p.resumoNoLugar(sol, par, trechoParte(t.devolucao_horario_inicio, t.devolucao_horario_fim)) });
    }
    return r;
  }

  function troca(corpo, t, ctx, mapa, aoDetalhes) {
    carregando(corpo);
    var emAberto = t.status === 'pendente_confirmacao' || t.status === 'pendente_aprovacao';
    Promise.all([
      t.registro_varias ? RW.trocasDados.registro(t.troca_id) : Promise.resolve(null),
      emAberto ? RW.trocasDados.analisar(t.troca_id).catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (r) {
      var c = RosterWork.tpl('tpl-pedido-resumo');
      if (!c) return;
      var p = M().pendencias;
      var itens = r[0] && r[0].ok && r[0].itens
        ? r[0].itens.map(function (i) { return { data: i.data, texto: p.resumoNoLugar(semQuadro(i.cumpre), semQuadro(i.no_lugar_de), trechoParte(i.inicio, i.fim)) }; })
        : diasDaTroca(t);
      itens.sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
      dias(secao(c, 'trocas'), itens);
      /* a análise também decide a confirmação do Aprovar (o aviso de problema), como no painel */
      if (r[1] && r[1].ok) { t._analise = r[1]; analise(secao(c, 'analise'), r[1]); }
      aceites(secao(c, 'aceites'), t.aceites || []);
      acoes(c, mapa, function (acao, b) { RW.trocasPainel.acao(acao, t, ctx, b); }, aoDetalhes);
      mostrar(corpo, c);
    }).catch(function () { falha(corpo, aoDetalhes); });
  }

  /* o que cada um faz na troca da fila: o administrador aprova (com pendências, se falta aceite); o militar aceita */
  function mapaTroca(p) {
    var t = p.dado;
    if (p.minha) return { aceitar: p.tipo === 'troca_aceite' ? 'aceitar-depois' : 'aceitar' };
    if (t.status === 'pendente_aprovacao') return { aprovar: 'aprovar' };
    if (t.status === 'pendente_confirmacao') return { 'aprovar-forcar': 'aprovar-forcar' };
    return {};
  }

  /* o seu pedido de troca em aberto: quem pediu pode cancelar (na alteração, só a alteração) */
  function mapaMinhaTroca(t, cpf) {
    if (t.status !== 'pendente_confirmacao' && t.status !== 'pendente_aprovacao') return {};
    if (t.registro_varias) {
      var pediu = (t.aceites || []).filter(function (a) { return a.papel === 'pediu'; })[0];
      return pediu && pediu.cpf === cpf ? { cancelar: 'cancelar-pedido' } : {};
    }
    var aceita = t.confirma_cpf || t.parceiro_cpf;
    var quemPediu = aceita === t.solicitante_cpf ? t.parceiro_cpf : t.solicitante_cpf;
    return quemPediu === cpf ? { cancelar: t.substitui_troca_id ? 'cancelar-alteracao' : 'cancelar' } : {};
  }

  /* ---------- folga e correção de dados ---------- */
  function folga(corpo, f, ctx, mapa, aoDetalhes, comAnalise) {
    carregando(corpo);
    (comAnalise ? RW.folgasDados.analisar(f.id).catch(function () { return null; }) : Promise.resolve(null)).then(function (a) {
      var c = RosterWork.tpl('tpl-pedido-resumo');
      if (!c) return;
      var lista = secao(c, 'folga');
      dias(lista, [{ data: f.data_ref, texto: trechoParte(f.horario_inicio, f.horario_fim) || M().pendencias.servicoInteiro }]);
      if (f.motivo) linha(lista, M().folgas.motivoPedido(f.motivo), []);
      if (a && a.ok) { f._analise = a; analise(secao(c, 'analise'), a); }
      acoes(c, mapa, function (acao, b) { RW.folgasAprovacaoPainel.acao(acao, f, ctx, b); }, aoDetalhes);
      mostrar(corpo, c);
    }).catch(function () { falha(corpo, aoDetalhes); });
  }

  /* a correção de dados: decide-se item por item, no painel (o resumo só mostra e leva ao Ver detalhes) */
  function dados(corpo, itens, comSituacao, aoDetalhes) {
    var c = RosterWork.tpl('tpl-pedido-resumo');
    if (!c) return;
    var lista = secao(c, 'alteracoes');
    itens.forEach(function (item) { alteracao(lista, item, comSituacao); });
    acoes(c, {}, null, aoDetalhes);
    mostrar(corpo, c);
  }

  /* ---------- entradas ---------- */
  /* um pedido da fila (Pendências e as abas Pendências) */
  function pedido(corpo, p, ctx, aoDetalhes) {
    if (p.tipo === 'folga') folga(corpo, p.dado, ctx, { aprovar: 'aprovar' }, aoDetalhes, true);
    else if (p.tipo === 'dados') dados(corpo, p.dado.itens || [], false, aoDetalhes);
    else troca(corpo, p.dado, ctx, mapaTroca(p), aoDetalhes);
  }

  /* um pedido do próprio militar (Pendências › Seus pedidos): troca, folga ou correção de dados */
  function meuPedido(corpo, p, ctx, irPara) {
    if (p.tipo === 'troca') {
      carregando(corpo);
      RW.trocasDados.listar([]).then(function (todas) {
        var t = (Array.isArray(todas) ? todas : []).filter(function (x) { return x.troca_id === p.id; })[0];
        if (!t) { falha(corpo, function () { irPara('trocas', 'minhas'); }); return; }
        troca(corpo, t, ctx, mapaMinhaTroca(t, ctx.cpf), function () { RW.trocasPainel.abrir(t, ctx); });
      }).catch(function () { falha(corpo, function () { irPara('trocas', 'minhas'); }); });
    } else if (p.tipo === 'folga') {
      folga(corpo, { id: p.id, data_ref: p.data, horario_inicio: p.horario_inicio, horario_fim: p.horario_fim },
        ctx, p.situacao === 'pendente' ? { cancelar: 'cancelar' } : {}, function () { irPara('folgas', 'minhas'); }, false);
    } else {
      carregando(corpo);
      RW.rpc('perfil_solicitacoes_minhas', {}).then(function (lista) {
        var s = (Array.isArray(lista) ? lista : []).filter(function (x) { return String(x.solicitacao_id) === String(p.id); })[0];
        dados(corpo, s ? s.itens || [] : [], true, function () { irPara('perfil'); });
      }).catch(function () { falha(corpo, function () { irPara('perfil'); }); });
    }
  }

  /* o selo Pendente que abre a lista dos aceites (a troca aprovada com aceite faltando, na lista de Trocas) */
  function seloAceites(todos) {
    var el = RosterWork.tpl('tpl-aceites-pendente');
    if (!el) return null;
    aceites(el.querySelector('.aceites-pendente-lista'), todos || []);
    return el;
  }

  RW.filaResumo = { pedido: pedido, meuPedido: meuPedido, seloAceites: seloAceites };
})();
