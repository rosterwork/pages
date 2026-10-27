/* ============================================================
   FILA DE PEDIDOS — componente compartilhado (a página Pendências
   e as abas "Pendências" da Trocas, da Folgas e da Usuários)
   O mesmo pedido aparece nos dois lugares com o mesmo cartão e
   abre o mesmo painel de decisão; decidido num, some dos dois.
   Quem diz o bloco de cada grupo, se é de administração e quanto
   soma no número é o banco (pendencias_listar: bloco, adm, soma).
     · contar()  → os números do "fazer", sem o detalhe (leitura leve):
                   { meus: {tipo: n}, adm: {tipo: n} } (o nome do banco)
     · ler()     → as pendências com o detalhe:
                   { fazer: [], corrigir: [], acompanhar: [], total };
                   cada pedido { tipo, id, dado, data, adm }; o grupo que
                   não é pedido (o prazo da extra, a CNH) vem inteiro
                   { grupo, tipo, data, adm }; fazer e acompanhar pelo
                   prazo, o que não tem data no fim; corrigir são os
                   grupos do administrador; total = a soma do número;
                   null se a leitura falhou
     · doTipo(itens, tipos) → só os itens desses tipos
     · porPrazo(a, b) → a ordem pelo prazo (o campo data; sem data no fim)
     · icone(tipo) → o ícone do assunto (o único mapa das pendências)
     · criar(lista, opcoes) → uma fila na tela: desenha os cartões
                   (geral-pedido, .pedido--linha; no pedido de
                   administração, a etiqueta ADM e o pelotão), abre o painel
                   do tipo com o "N de M" e, depois de decidir, pede à
                   página para reler (opcoes.recarregar) e abre o
                   pedido que tomou o lugar do decidido.
                   opcoes = { vazio, recarregar() → Promise, expandir }
                   (expandir: o cartão abre ali mesmo,
                   com o resumo e as ações (geral-fila-resumo), e o
                   "Ver detalhes" abre o painel; Pendências)
                   devolve { definir(itens), abrirId(id), quantos() };
                   no meio dos pedidos, a página pode pôr linhas que ela
                   mesma monta: { desenhar() → elemento }. Com algum
                   pelotão na lista, todos os cartões guardam a coluna
     · linha(c)  → o cartão simples que leva a um lugar:
                   c = { icone, pelotoes, adm, quem, meta, selo, chave, aoClicar }
     · expansivel(c) → o cartão que abre ali mesmo, para quem monta o
                   resumo por conta própria (os "Seus pedidos" da Pendências):
                   c = { icone, pelotoes, adm, quem, meta, selo, chave, montar(corpo) }
     · trecho(hi, hf) → "serviço inteiro" ou "das 08h às 14h"
   Os painéis: RosterWork.trocasPainel, .folgasAprovacaoPainel e
   .usuariosCorrecaoPainel (cada página carrega os do seu assunto).
   Clona moldes; não cria HTML.
   RosterWork.fila.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  /* o ícone de cada assunto das pendências (o único mapa: a fila, a página Pendências e a faixa do topo).
     troca_aceite: a troca com o aceite de quem olha faltando (abre o mesmo painel da troca);
     troca_aceites_pendentes: a troca em aberto esperando o aceite dos militares (o administrador acompanha) */
  var ICONES = { troca: 'trocas', troca_aceite: 'trocas', troca_aceites_pendentes: 'trocas', folga: 'folgas', dados: 'editar',
    extra_prazo: 'extrajornada', cnh: 'editar' };
  function icone(tipo) { return ICONES[tipo] || 'pendencias'; }
  function ehTroca(tipo) { return tipo === 'troca' || tipo === 'troca_aceite' || tipo === 'troca_aceites_pendentes'; }

  function msg() { return RW.mensagens.pendencias; }
  function nome(grau, n) { return ((grau || '') + ' ' + (n || '')).trim(); }

  /* ---------- leitura ---------- */

  function contar() {
    return RW.rpc('pendencias_listar', {}).then(function (grupos) {
      var r = { meus: {}, adm: {} };
      (Array.isArray(grupos) ? grupos : []).forEach(function (g) {
        if (g.bloco !== 'fazer') return;
        var alvo = g.adm ? r.adm : r.meus;
        alvo[g.tipo] = (alvo[g.tipo] || 0) + (Number(g.contagem) || 0);
      });
      return r;
    }).catch(function () { return { meus: {}, adm: {} }; });
  }

  /* um pedido: { tipo, id, dado, data (o prazo, para ordenar; a correção de dados não tem), adm } */
  function pedido(tipo, d, adm) {
    var id = ehTroca(tipo) ? d.troca_id : (tipo === 'dados' ? d.solicitacao_id : d.id);
    var data = d.data_proxima || (ehTroca(tipo) ? d.data_servico_solicitante : (tipo === 'folga' ? d.data_ref : ''));
    return { tipo: tipo, id: String(id), dado: d, data: String(data || ''), adm: adm };
  }

  /* pelo prazo: a data mais próxima primeiro; o que não tem data vai para o fim, na ordem do banco */
  function porPrazo(a, b) {
    if (!a.data || !b.data) return (a.data ? 0 : 1) - (b.data ? 0 : 1);
    return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0);
  }

  function ler() {
    return RW.rpc('pendencias_listar', { p_detalhe: true }).then(function (grupos) {
      if (!Array.isArray(grupos)) return null;
      var r = { fazer: [], corrigir: [], acompanhar: [], total: 0 };
      grupos.forEach(function (g) {
        r.total += Number(g.soma) || 0;
        if (g.bloco === 'corrigir') { r.corrigir.push(g); return; }
        var alvo = g.bloco === 'acompanhar' ? r.acompanhar : r.fazer;
        /* o grupo com os pedidos um a um vira um item por pedido; o que não é pedido vai inteiro */
        if (Array.isArray(g.itens)) g.itens.forEach(function (d) { alvo.push(pedido(g.tipo, d, !!g.adm)); });
        else alvo.push({ grupo: g, tipo: g.tipo, data: String(g.data_proxima || ''), adm: !!g.adm });
      });
      r.fazer.sort(porPrazo);
      r.acompanhar.sort(porPrazo);
      return r;
    }).catch(function () { return null; });
  }

  function doTipo(itens, tipos) {
    return (itens || []).filter(function (p) { return tipos.indexOf(p.tipo) >= 0; });
  }

  /* ---------- o cartão ---------- */

  /* "serviço inteiro" ou "das 08h às 14h" */
  function trechoTexto(hi, hf) {
    if (!hi || !hf || hi === hf) return msg().servicoInteiro;
    return msg().trechoHoras(RW.horario.curta(String(hi).slice(0, 5)), RW.horario.curta(String(hf).slice(0, 5)));
  }

  /* o pelotão do pedido, só no de administração (no seu é sempre o do próprio militar) */
  function pelotoes(p) {
    return p.adm && Array.isArray(p.dado.pelotoes) ? p.dado.pelotoes.filter(Boolean) : [];
  }

  function seloPendente() { return { texto: RW.mensagens.trocas.seloAceitePendente, classe: 'selo--alerta' }; }


  /* "Serviço de 30/10/2026 (sex) · serviço inteiro · RW nº 1/2026" */
  function metaTroca(d) {
    var meta = msg().metaServico(RW.data.comDiaCurto(d.data_servico_solicitante), trechoTexto(d.horario_inicio, d.horario_fim));
    return d.registro_numero ? meta + ' · ' + RW.mensagens.trocas.registroNumero(d.registro_numero, d.registro_ano) : meta;
  }

  /* o registro de várias trocas (um cartão por registro): quem pediu, os militares e o RW nº;
     na alteração de outro registro (original), quem quer alterar as trocas do RW de antes */
  function textosVarias(p, d) {
    var mv = RW.mensagens.trocas.varias, aceites = d.aceites || [];
    var rw = RW.mensagens.trocas.registroNumero(d.registro_numero, d.registro_ano);
    var pediu = aceites.filter(function (a) { return a.papel === 'pediu'; })[0];
    var meta = mv.filaMeta(RW.data.comDiaCurto(d.data_servico_solicitante), aceites.length, rw);
    var nomes = mv.nomes(aceites.map(function (a) { return a.titulo || ''; }));
    var antes = d.original ? RW.mensagens.trocas.registroNumero(d.original.registro_numero, d.original.registro_ano) : null;
    var admin = antes ? mv.filaAdminAlteracao(nomes) : mv.filaAdmin(nomes);
    if (p.tipo === 'troca_aceite') return { quem: mv.filaAceitar(rw), meta: meta, selo: { texto: msg().faltaAceitar, classe: 'selo--alerta' } };
    if (p.tipo === 'troca_aceites_pendentes') return { quem: admin, meta: meta, selo: seloPendente() };
    return {
      quem: p.adm ? admin : (antes ? mv.filaMinhaAlteracao(pediu ? pediu.titulo : '', antes) : mv.filaMinha(pediu ? pediu.titulo : '')),
      meta: meta,
      selo: RW.impacto.selo({ veredito: d.veredito, problemas: d.veredito_problemas, alertas: d.veredito_alertas })
    };
  }

  /* quem e o quê, a linha de apoio e o selo, por tipo de pedido */
  function textos(p) {
    var m = msg(), d = p.dado;
    if (ehTroca(p.tipo) && d.registro_varias) return textosVarias(p, d);
    if (ehTroca(p.tipo)) {
      var sol = nome(d.solicitante_grau, d.solicitante_nome), par = nome(d.parceiro_grau, d.parceiro_nome);
      /* o aceite que falta: o nome é o do outro militar da troca */
      if (p.tipo === 'troca_aceite') {
        var cpf = RW.sessao && RW.sessao.cpf();
        return { quem: m.trocaAceitar(d.solicitante_cpf === cpf ? par : sol), meta: metaTroca(d),
                 selo: { texto: m.faltaAceitar, classe: 'selo--alerta' } };
      }
      /* quem pediu: o solicitante, ou o solicitado quando é ele quem alterou (aí quem aceita é o solicitante) */
      var pediu = d.confirma_cpf && d.confirma_cpf === d.solicitante_cpf ? par : sol;
      var alteracao = !!d.substitui_troca_id;
      return {
        quem: !p.adm ? (alteracao ? m.trocaMinhaAlteracao(pediu) : m.trocaMinha(pediu))
                     : (alteracao ? m.trocaAdminAlteracao(sol, par) : m.trocaAdmin(sol, par)),
        meta: metaTroca(d),
        /* a troca esperando o aceite dos militares: Pendente (a análise aparece ao abrir) */
        selo: p.tipo === 'troca_aceites_pendentes' ? seloPendente()
          : RW.impacto.selo({ veredito: d.veredito, problemas: d.veredito_problemas, alertas: d.veredito_alertas })
      };
    }
    if (p.tipo === 'folga') {
      return {
        quem: m.folga(d.nome || ''),
        meta: m.metaServico(RW.data.comDiaCurto(d.data_ref), trechoTexto(d.horario_inicio, d.horario_fim)),
        selo: RW.impacto.selo({ veredito: d.veredito, problemas: d.veredito_problemas, alertas: d.veredito_alertas })
      };
    }
    return {
      quem: m.dados(nome(d.grad, d.nome)),
      meta: m.metaDados((d.itens || []).length, RW.data.isoParaBR(d.solicitado_em)),
      selo: null
    };
  }

  /* a linha do cartão (os dois moldes): o ícone, o pelotão, a etiqueta ADM, quem e o quê, e o selo */
  function preencher(el, c) {
    var uso = el.querySelector('.pedido-linha-icone use');
    if (uso) uso.setAttribute('href', 'icones/todos.svg#icone-' + c.icone);
    var pel = c.pelotoes || [];
    var colPelotao = el.querySelector('.pedido-linha-pelotao');
    colPelotao.textContent = pel.join('\n');
    colPelotao.classList.toggle('oculto', !pel.length);
    el.querySelector('.etiqueta-adm-linha .etiqueta-adm').classList.toggle('oculto', !c.adm);
    el.querySelector('.pedido-quem').textContent = c.quem || '';
    el.querySelector('.pedido-meta').textContent = c.meta || '';
    var selo = el.querySelector('.pedido-linha-selo');
    if (c.selo) { selo.textContent = c.selo.texto; selo.classList.add(c.selo.classe); }
    selo.classList.toggle('oculto', !c.selo);
  }

  /* o cartão simples, que leva a um lugar (abre o painel do pedido, ou o que a página mandar) */
  function linha(c) {
    var el = RosterWork.tpl('tpl-pedido-linha');
    if (!el) return null;
    if (c.chave) el.dataset.pedido = c.chave;
    preencher(el, c);
    el.addEventListener('click', function () { if (c.aoClicar) c.aoClicar(); });
    return el;
  }

  function cartao(p, aoAbrir) {
    var t = textos(p);
    return linha({ icone: icone(p.tipo), pelotoes: pelotoes(p), adm: p.adm, quem: t.quem, meta: t.meta, selo: t.selo,
      chave: p.tipo + ':' + p.id, aoClicar: function () { aoAbrir(p); } });
  }

  /* ---------- o cartão que abre ali mesmo (Pendências e as abas Pendências) ----------
     A linha é o botão que abre e fecha o resumo (aria-expanded; a seta vira com ele aberto);
     um cartão aberto por vez na tela. O resumo é montado na primeira vez que abre (c.montar). */
  var expandido = null;
  function fecharCartao(el) {
    el.querySelector('.pedido-expansivel-cabeca').setAttribute('aria-expanded', 'false');
    el.querySelector('.pedido-resumo').classList.add('oculto');
  }
  function expansivel(c) {
    var el = RosterWork.tpl('tpl-pedido-expansivel');
    if (!el) return null;
    var cabeca = el.querySelector('.pedido-expansivel-cabeca'), corpo = el.querySelector('.pedido-resumo-corpo');
    if (c.chave) cabeca.dataset.pedido = c.chave;
    preencher(el, c);
    el.querySelector('.pedido-resumo-recuo-pelotao').classList.toggle('oculto', !(c.pelotoes || []).length);
    cabeca.addEventListener('click', function () {
      var abrir = cabeca.getAttribute('aria-expanded') !== 'true';
      if (expandido && expandido !== el && document.contains(expandido)) fecharCartao(expandido);
      if (!abrir) { fecharCartao(el); expandido = null; return; }
      cabeca.setAttribute('aria-expanded', 'true');
      el.querySelector('.pedido-resumo').classList.remove('oculto');
      expandido = el;
      if (!corpo.childElementCount && c.montar) c.montar(corpo);
    });
    return el;
  }

  /* ---------- uma fila na tela ---------- */

  function criar(lista, opcoes) {
    opcoes = opcoes || {};
    var itens = [];      // o que a lista mostra, na ordem: pedidos e as linhas da página
    var pedidos = [];    // só os pedidos (a posição "N de M" e o abrir pelo id)
    var aberto = null;   // o pedido que está no painel agora
    var ultimo = -1;     // a posição do último aberto (para abrir o próximo depois de decidir)

    function marcar() {
      var chave = aberto ? aberto.tipo + ':' + aberto.id : null;
      [].forEach.call(lista.querySelectorAll('.pedido--linha'), function (el) {
        el.classList.toggle('pedido--selecionado', el.dataset.pedido === chave);
      });
    }

    /* com algum pelotão na lista, todos os cartões guardam a coluna dele (os textos ficam alinhados) */
    function alinharPelotoes() {
      var algum = [].some.call(lista.querySelectorAll('.pedido-linha-pelotao'), function (el) { return !!el.textContent; });
      if (!algum) return;
      [].forEach.call(lista.querySelectorAll('.pedido-linha-pelotao, .pedido-resumo-recuo-pelotao'), function (el) {
        el.classList.remove('oculto');
      });
    }

    function desenhar() {
      lista.textContent = '';
      if (!itens.length) {
        var v = RosterWork.tpl('tpl-pedido-vazio');
        if (v) { v.textContent = opcoes.vazio || ''; lista.appendChild(v); }
        return;
      }
      itens.forEach(function (x) {
        var el = x.desenhar ? x.desenhar() : (opcoes.expandir ? cartaoExpansivel(x) : cartao(x, abrir));
        if (el) lista.appendChild(el);
      });
      alinharPelotoes();
      marcar();
    }

    /* o cartão que abre ali mesmo: o resumo e as ações do pedido (geral-fila-resumo); Ver detalhes abre o painel */
    function cartaoExpansivel(p) {
      var t = textos(p);
      return expansivel({ icone: icone(p.tipo), pelotoes: pelotoes(p), adm: p.adm, quem: t.quem, meta: t.meta, selo: t.selo,
        chave: p.tipo + ':' + p.id,
        montar: function (corpo) { RW.filaResumo.pedido(corpo, p, contexto(p), function () { abrir(p); }); } });
    }

    function definir(novos) {
      itens = novos || [];
      pedidos = itens.filter(function (x) { return !!x.dado; });
      desenhar();
    }

    /* depois de decidir: a página relê; se o painel ficou fechado e a fila ainda está
       na tela, abre o pedido que tomou o lugar do decidido (no fim da fila, o primeiro).
       Com o cartão que abre ali mesmo, a fila só se relê */
    function depoisDeDecidir() {
      var pos = ultimo;
      Promise.resolve(opcoes.recarregar ? opcoes.recarregar() : null).then(function () {
        if (RW.avisosSino && RW.avisosSino.recarregar) RW.avisosSino.recarregar();
        if (opcoes.expandir || pos < 0 || !pedidos.length || (RW.painel && RW.painel.estaAberto())) return;
        if (!document.contains(lista) || lista.closest('.oculto')) return;
        abrir(pedidos[pos < pedidos.length ? pos : 0]);
      });
    }

    /* o contexto das ações do pedido (o painel e o cartão que abre ali mesmo) */
    function contexto(p) {
      var indice = -1;
      pedidos.forEach(function (x, i) { if (x.tipo === p.tipo && x.id === p.id) indice = i; });
      var admin = RosterWork.sessao.temPapel('pelotao');   // cada painel ainda confere a área do pedido
      return {
        cpf: RosterWork.sessao.cpf(),
        ehAdmin: admin,
        admin: admin,
        decidir: p.adm,   // o pedido de administração já vem só com o que este admin pode decidir (o banco filtra)
        posicao: { n: indice + 1, total: pedidos.length },
        aoMudar: depoisDeDecidir,
        aoFechar: function () {
          if (aberto !== p) return;   // outro pedido já tomou o painel
          aberto = null;
          marcar();
        }
      };
    }

    function abrir(p) {
      var ctx = contexto(p);
      aberto = p;
      ultimo = Math.max(ctx.posicao.n - 1, 0);
      marcar();
      if (ehTroca(p.tipo) && RW.trocasPainel) RW.trocasPainel.abrir(p.dado, ctx);
      else if (p.tipo === 'folga' && RW.folgasAprovacaoPainel) RW.folgasAprovacaoPainel.abrir(p.dado, ctx);
      else if (p.tipo === 'dados' && RW.usuariosCorrecaoPainel) RW.usuariosCorrecaoPainel.abrir(p.dado, ctx);
    }

    /* chegou por um aviso: abre o pedido daquele id, se ele estiver nesta fila */
    function abrirId(id) {
      var achado = null;
      pedidos.forEach(function (p) { if (p.id === String(id)) achado = p; });
      if (achado) abrir(achado);
      return !!achado;
    }

    return { definir: definir, abrirId: abrirId, quantos: function () { return pedidos.length; } };
  }

  RW.fila = { contar: contar, ler: ler, doTipo: doTipo, porPrazo: porPrazo, icone: icone, criar: criar, linha: linha, expansivel: expansivel, trecho: trechoTexto };
})();
