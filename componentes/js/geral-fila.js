/* ============================================================
   FILA DE PEDIDOS — componente compartilhado (a página Pendências
   e as abas "Pendências" da Trocas, da Folgas e da Usuários)
   O mesmo pedido aparece nos dois lugares com o mesmo cartão e
   abre o mesmo painel de decisão; decidido num, some dos dois.
     · contar()  → os números, sem o detalhe (leitura leve):
                   { minhas: {tipo: n}, aprovar: {tipo: n} }
     · ler()     → o que espera decisão, com o detalhe:
                   { minhas: [], aprovar: [], corrigir: [] }; cada
                   pedido { tipo, id, dado, data, minha }, os de data
                   mais próxima primeiro; null se a leitura falhou
     · doTipo(pedidos, tipos) → só os pedidos desses tipos
     · criar(lista, opcoes) → uma fila na tela: desenha os cartões
                   (geral-pedido, .pedido--linha; nas listas do
                   administrador, com o pelotão), abre o painel do
                   tipo com o "N de M" e, depois de decidir, pede à
                   página para reler (opcoes.recarregar) e abre o
                   pedido que tomou o lugar do decidido.
                   opcoes = { vazio, recarregar() → Promise }
                   devolve { definir(pedidos), abrirId(id), quantos() }
   Os painéis: RosterWork.trocasPainel, .folgasAprovacaoPainel e
   .usuariosCorrecaoPainel (cada página carrega os do seu assunto).
   Clona moldes; não cria HTML.
   RosterWork.fila.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var DECISAO = ['troca', 'folga', 'dados'];
  var ICONES = { troca: 'trocas', folga: 'folgas', dados: 'editar' };

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
    var id = tipo === 'troca' ? d.troca_id : (tipo === 'dados' ? d.solicitacao_id : d.id);
    var data = tipo === 'troca' ? d.data_servico_solicitante
      : tipo === 'folga' ? d.data_ref : d.solicitado_em;
    return { tipo: tipo, id: String(id), dado: d, data: String(data || ''), minha: minha };
  }

  function ler() {
    return RW.rpc('pendencias_listar', { p_detalhe: true }).then(function (grupos) {
      if (!Array.isArray(grupos)) return null;
      var r = { minhas: [], aprovar: [], corrigir: [] };
      grupos.forEach(function (g) {
        if (DECISAO.indexOf(g.tipo) >= 0) {
          (g.itens || []).forEach(function (d) { (g.minha ? r.minhas : r.aprovar).push(pedido(g.tipo, d, !!g.minha)); });
        } else if (!g.minha) {
          r.corrigir.push(g);
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

  /* quem e o quê, a linha de apoio e o selo, por tipo de pedido */
  function textos(p) {
    var m = msg(), d = p.dado;
    if (p.tipo === 'troca') {
      var sol = nome(d.solicitante_grau, d.solicitante_nome), par = nome(d.parceiro_grau, d.parceiro_nome);
      return {
        quem: p.minha ? m.trocaMinha(sol) : m.trocaAdmin(sol, par),
        meta: m.metaServico(RW.data.comDiaCurto(d.data_servico_solicitante), trechoTexto(d.horario_inicio, d.horario_fim)),
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

  function cartao(p, aoAbrir) {
    var el = RosterWork.tpl('tpl-pedido-linha');
    if (!el) return null;
    var t = textos(p);
    el.dataset.pedido = p.tipo + ':' + p.id;
    var uso = el.querySelector('.pedido-linha-icone use');
    if (uso) uso.setAttribute('href', 'icones/icone-' + ICONES[p.tipo] + '.svg#icone-' + ICONES[p.tipo]);
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
      pedidos.forEach(function (p) { var el = cartao(p, abrir); if (el) lista.appendChild(el); });
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
      var admin = RosterWork.sessao.ehAdmin();
      var ctx = {
        cpf: RosterWork.sessao.cpf(),
        ehAdmin: admin,
        admin: admin,
        posicao: { n: indice + 1, total: pedidos.length },
        aoMudar: depoisDeDecidir,
        aoFechar: function () {
          if (aberto !== p) return;   // outro pedido já tomou o painel
          aberto = null;
          marcar();
        }
      };
      if (p.tipo === 'troca' && RW.trocasPainel) RW.trocasPainel.abrir(p.dado, ctx);
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

  RW.fila = { contar: contar, ler: ler, doTipo: doTipo, criar: criar };
})();
