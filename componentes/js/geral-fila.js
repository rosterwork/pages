/* ============================================================
   FILA DE PEDIDOS — componente compartilhado (a página Pendências
   e as abas "Pendências" da Trocas, da Folgas e da Usuários)
   O mesmo pedido aparece nos dois lugares com o mesmo cartão e
   abre o mesmo painel de decisão; decidido num, some dos dois.
     · contar()  → os números, sem o detalhe (leitura leve):
                   { minhas: {tipo: n}, aprovar: {tipo: n} }
     · ler()     → o que espera decisão, com o detalhe:
                   { minhas: [], aprovar: [], corrigir: [], prazos: [] };
                   cada pedido { tipo, id, dado, data, minha }, os de
                   data mais próxima primeiro; corrigir e prazos são os
                   grupos que não são pedido (do administrador e seus,
                   como o prazo da extra); null se a leitura falhou
     · doTipo(pedidos, tipos) → só os pedidos desses tipos
     · criar(lista, opcoes) → uma fila na tela: desenha os cartões
                   (geral-pedido, .pedido--linha; nas listas do
                   administrador, com o pelotão), abre o painel do
                   tipo com o "N de M" e, depois de decidir, pede à
                   página para reler (opcoes.recarregar) e abre o
                   pedido que tomou o lugar do decidido.
                   opcoes = { vazio, recarregar() → Promise, situacao }
                   (situacao: o selo diz a situação, "Aguardando
                   você" ou "Aguardando aprovação", no lugar do da
                   análise; o Início)
                   devolve { definir(pedidos), abrirId(id), quantos() }
     · trecho(hi, hf) → "serviço inteiro" ou "das 08h às 14h"
   Os painéis: RosterWork.trocasPainel, .folgasAprovacaoPainel e
   .usuariosCorrecaoPainel (cada página carrega os do seu assunto).
   Clona moldes; não cria HTML.
   RosterWork.fila.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  /* troca_aceite: a troca com o aceite de quem olha faltando (abre o mesmo painel da troca) */
  var DECISAO = ['troca', 'troca_aceite', 'folga', 'dados'];
  var ICONES = { troca: 'trocas', troca_aceite: 'trocas', folga: 'folgas', dados: 'editar' };
  function ehTroca(tipo) { return tipo === 'troca' || tipo === 'troca_aceite'; }

  function msg() { return RW.mensagens.pendencias; }
  function nome(grau, n) { return ((grau || '') + ' ' + (n || '')).trim(); }

  /* ---------- leitura ---------- */

  function contar() {
    return RW.rpc('pendencias_listar', {}).then(function (grupos) {
      var r = { minhas: {}, aprovar: {} };
      (Array.isArray(grupos) ? grupos : []).forEach(function (g) {
        if (DECISAO.indexOf(g.tipo) < 0) return;
        var alvo = g.minha ? r.minhas : r.aprovar;
        alvo[g.tipo] = (alvo[g.tipo] || 0) + (Number(g.contagem) || 0);
      });
      return r;
    }).catch(function () { return { minhas: {}, aprovar: {} }; });
  }

  /* um pedido: { tipo, id, dado, data (para ordenar), minha } */
  function pedido(tipo, d, minha) {
    var id = ehTroca(tipo) ? d.troca_id : (tipo === 'dados' ? d.solicitacao_id : d.id);
    var data = ehTroca(tipo) ? d.data_servico_solicitante
      : tipo === 'folga' ? d.data_ref : d.solicitado_em;
    return { tipo: tipo, id: String(id), dado: d, data: String(data || ''), minha: minha };
  }

  function ler() {
    return RW.rpc('pendencias_listar', { p_detalhe: true }).then(function (grupos) {
      if (!Array.isArray(grupos)) return null;
      var r = { minhas: [], aprovar: [], corrigir: [], prazos: [] };
      grupos.forEach(function (g) {
        if (DECISAO.indexOf(g.tipo) >= 0) {
          (g.itens || []).forEach(function (d) { (g.minha ? r.minhas : r.aprovar).push(pedido(g.tipo, d, !!g.minha)); });
        } else {
          (g.minha ? r.prazos : r.corrigir).push(g);
        }
      });
      function porData(a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); }
      r.minhas.sort(porData);
      r.aprovar.sort(porData);
      return r;
    }).catch(function () { return null; });
  }

  function doTipo(pedidos, tipos) {
    return (pedidos || []).filter(function (p) { return tipos.indexOf(p.tipo) >= 0; });
  }

  /* ---------- o cartão ---------- */

  /* "serviço inteiro" ou "das 08h às 14h" */
  function trechoTexto(hi, hf) {
    if (!hi || !hf || hi === hf) return msg().servicoInteiro;
    return msg().trechoHoras(RW.horario.curta(String(hi).slice(0, 5)), RW.horario.curta(String(hf).slice(0, 5)));
  }

  /* o pelotão do pedido, só nas listas do administrador (no "Para mim" é sempre o do próprio militar) */
  function pelotoes(p) {
    return !p.minha && Array.isArray(p.dado.pelotoes) ? p.dado.pelotoes.filter(Boolean) : [];
  }

  /* o selo da situação (opcoes.situacao): tudo o que está na fila espera decisão */
  function seloSituacao(p) {
    var M = RW.mensagens, d = p.dado;
    var texto = p.tipo === 'troca_aceite' ? M.pendencias.faltaAceitar
      : p.minha ? M.pendencias.aguardandoVoce
      : p.tipo === 'troca' ? (d.substitui_troca_id ? M.trocas.situacaoAlteracao : M.trocas.situacao).pendente_aprovacao
      : p.tipo === 'folga' ? M.folgas.situacao.pendente
      : M.correcoes.painelSituacao;
    return { texto: texto, classe: 'selo--alerta' };
  }

  /* quem e o quê, a linha de apoio e o selo, por tipo de pedido */
  function textos(p, situacao) {
    var t = textosAnalise(p);
    if (situacao) t.selo = seloSituacao(p);
    return t;
  }

  /* "Serviço de 30/10/2026 (sex) · serviço inteiro · RW nº 1/2026" */
  function metaTroca(d) {
    var meta = msg().metaServico(RW.data.comDiaCurto(d.data_servico_solicitante), trechoTexto(d.horario_inicio, d.horario_fim));
    return d.registro_numero ? meta + ' · ' + RW.mensagens.trocas.registroNumero(d.registro_numero, d.registro_ano) : meta;
  }

  function textosAnalise(p) {
    var m = msg(), d = p.dado;
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
        quem: p.minha ? (alteracao ? m.trocaMinhaAlteracao(pediu) : m.trocaMinha(pediu))
                      : (alteracao ? m.trocaAdminAlteracao(sol, par) : m.trocaAdmin(sol, par)),
        meta: metaTroca(d),
        selo: RW.impacto.selo({ veredito: d.veredito, problemas: d.veredito_problemas, alertas: d.veredito_alertas })
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

  function cartao(p, aoAbrir, situacao) {
    var el = RosterWork.tpl('tpl-pedido-linha');
    if (!el) return null;
    var t = textos(p, situacao);
    el.dataset.pedido = p.tipo + ':' + p.id;
    var uso = el.querySelector('.pedido-linha-icone use');
    if (uso) uso.setAttribute('href', 'icones/todos.svg#icone-' + ICONES[p.tipo]);
    var pel = pelotoes(p);
    var colPelotao = el.querySelector('.pedido-linha-pelotao');
    colPelotao.textContent = pel.join('\n');
    colPelotao.classList.toggle('oculto', !pel.length);
    el.querySelector('.pedido-quem').textContent = t.quem;
    el.querySelector('.pedido-meta').textContent = t.meta;
    var selo = el.querySelector('.pedido-linha-selo');
    if (t.selo) { selo.textContent = t.selo.texto; selo.classList.add(t.selo.classe); }
    selo.classList.toggle('oculto', !t.selo);
    el.addEventListener('click', function () { aoAbrir(p); });
    return el;
  }

  /* ---------- uma fila na tela ---------- */

  function criar(lista, opcoes) {
    opcoes = opcoes || {};
    var pedidos = [];
    var aberto = null;   // o pedido que está no painel agora
    var ultimo = -1;     // a posição do último aberto (para abrir o próximo depois de decidir)

    function marcar() {
      var chave = aberto ? aberto.tipo + ':' + aberto.id : null;
      [].forEach.call(lista.querySelectorAll('.pedido--linha'), function (el) {
        el.classList.toggle('pedido--selecionado', el.dataset.pedido === chave);
      });
    }

    function desenhar() {
      lista.textContent = '';
      if (!pedidos.length) {
        var v = RosterWork.tpl('tpl-pedido-vazio');
        if (v) { v.textContent = opcoes.vazio || ''; lista.appendChild(v); }
        return;
      }
      pedidos.forEach(function (p) { var el = cartao(p, abrir, !!opcoes.situacao); if (el) lista.appendChild(el); });
      marcar();
    }

    function definir(novos) { pedidos = novos || []; desenhar(); }

    /* depois de decidir: a página relê; se o painel ficou fechado e a fila ainda está
       na tela, abre o pedido que tomou o lugar do decidido (no fim da fila, o primeiro) */
    function depoisDeDecidir() {
      var pos = ultimo;
      Promise.resolve(opcoes.recarregar ? opcoes.recarregar() : null).then(function () {
        if (RW.avisosSino && RW.avisosSino.recarregar) RW.avisosSino.recarregar();
        if (pos < 0 || !pedidos.length || (RW.painel && RW.painel.estaAberto())) return;
        if (!document.contains(lista) || lista.closest('.oculto')) return;
        abrir(pedidos[pos < pedidos.length ? pos : 0]);
      });
    }

    function abrir(p) {
      var indice = -1;
      pedidos.forEach(function (x, i) { if (x.tipo === p.tipo && x.id === p.id) indice = i; });
      aberto = p;
      ultimo = Math.max(indice, 0);
      marcar();
      var admin = RosterWork.sessao.temPapel('pelotao');   // cada painel ainda confere a área do pedido
      var ctx = {
        cpf: RosterWork.sessao.cpf(),
        ehAdmin: admin,
        admin: admin,
        decidir: !p.minha,   // a lista "para aprovar" já vem só com o que este admin pode decidir (o banco filtra)
        posicao: { n: indice + 1, total: pedidos.length },
        aoMudar: depoisDeDecidir,
        aoFechar: function () {
          if (aberto !== p) return;   // outro pedido já tomou o painel
          aberto = null;
          marcar();
        }
      };
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

  RW.fila = { contar: contar, ler: ler, doTipo: doTipo, criar: criar, trecho: trechoTexto };
})();
