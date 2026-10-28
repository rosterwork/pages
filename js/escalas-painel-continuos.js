/* ============================================================
   ESCALA — painel do dia › aba CICLO (seção "continuos": o ciclo automático)
   No topo, a frase de que as mudanças valem a partir do dia aberto e
   a busca. Os militares operacionais da unidade em três grupos:
   - Fora da escala: com o Adicionar; o afastado no dia e quem já tem
     a entrada marcada ganham só o selo;
   - Contínuos do dia: no ciclo e de serviço (ou de folga) neste dia,
     com o Remover; quem tem a saída marcada ganha o selo e o Cancelar
     saída;
   - Contínuos em outros ciclos (a caixa que abre e fecha, com a
     quantidade; começa fechada, fica como o admin deixou no mesmo dia
     e abre sozinha na busca): no ciclo, mas de serviço em outros
     dias, com o último serviço e o Adicionar, que abre embaixo da
     linha a pergunta única do último serviço no ciclo atual, entre as
     três últimas datas (mudar de ciclo); quem tem a saída marcada
     ganha o selo e o Cancelar saída.
   Cada ação confirma e grava na hora, com o resumo
   (escalas-painel-ciclo.js); o Adicionar de quem estava fora e o
   Cancelar saída têm o Desfazer no resumo. Só o admin vê a seção.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;      // { corpo, unidadeId, iso }
  var mils = [];       // militares carregados do banco
  var cartao = null;   // a pergunta de mudar de ciclo aberta embaixo de uma linha (uma por vez)
  var outros = { chave: '', aberto: false };   // a caixa dos Contínuos em outros ciclos: aberta ou fechada, por unidade e dia

  function msg() { return (RosterWork.mensagens && RosterWork.mensagens.escala) || {}; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function C() { return RosterWork.escalasPainelCiclo; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* "2026-08-01" -> "01/08/2026" */
  function formatarData(iso) {
    var p = (iso || '').split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : (iso || '');
  }
  function texto(t, dados) {
    return (t || '').replace(/\{(\w+)\}/g, function (_, k) { return dados && dados[k] != null ? dados[k] : ''; });
  }

  function botao(rotulo, variante, aoClicar) {
    var b = RosterWork.tpl('tpl-escala-secao-botao');
    if (!b) return null;
    b.textContent = rotulo;
    if (variante) b.classList.add(variante);
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* uma linha da lista: grad + nome + (o que vai no meio: selo e informação) + (um ou mais botões na ação) */
  function linha(m, extras, acoes) {
    var el = RosterWork.tpl('tpl-escala-secao-item');
    if (!el) return null;
    el.querySelector('.escala-secao-grad').textContent = m.grad || '';
    el.querySelector('.escala-secao-nome').textContent = m.nome || '';
    var areaExtra = el.querySelector('.escala-secao-extra');
    [].concat(extras || []).forEach(function (e) { if (e) areaExtra.appendChild(e); });
    var areaAcao = el.querySelector('.escala-secao-acao');
    [].concat(acoes || []).forEach(function (botaoAcao) { if (botaoAcao) areaAcao.appendChild(botaoAcao); });
    return el;
  }

  function caixaVazia(caixa, txt) {
    var v = RosterWork.tpl('tpl-escala-secao-vazio');
    if (v) { v.textContent = txt; caixa.appendChild(v); }
  }

  function seloTexto(txt) {
    var selo = RosterWork.tpl('tpl-escala-secao-selo');
    if (selo) selo.textContent = txt;
    return selo;
  }
  function infoTexto(txt) {
    var info = RosterWork.tpl('tpl-escala-secao-info');
    if (info) info.textContent = txt;
    return info;
  }

  /* depois de gravar ou desfazer: relê a lista, se o painel ainda está no mesmo dia */
  function aoTerminar(iso) { return function () { if (ctx && ctx.iso === iso) carregar(); }; }

  /* ---------- ações: cada uma confirma e grava na hora ---------- */
  function remover(m) {
    var uid = ctx.unidadeId, iso = ctx.iso;
    C().confirmar(uid, iso, m.cpf, {
      mensagem: texto(msg().confirmarRemover, { pessoa: nomeDe(m), data: formatarData(iso) }),
      escala: RosterWork.mensagens.saida.escalaTirar, botao: msg().btnRemover
    }, function () { C().salvar(uid, iso, [{ cpf: m.cpf, acao: 'tirar' }], { aoTerminar: aoTerminar(iso) }); });
  }
  function cancelarSaida(m) {
    var uid = ctx.unidadeId, iso = ctx.iso;
    RosterWork.confirmar({
      tipo: 'aviso', mensagem: L().cicloConfirmarCancelarSaida(nomeDe(m), formatarData(m.saida_em).slice(0, 5)),
      textoConfirmar: msg().btnCancelarSaida,
      aoConfirmar: function () {
        C().salvar(uid, iso, [{ cpf: m.cpf, acao: 'cancelar_saida' }],
          { desfazer: { cpf: m.cpf, acao: 'cancelar_saida', saida_em: m.saida_em }, aoTerminar: aoTerminar(iso) });
      }
    });
  }
  function adicionar(m) { C().entrar(ctx.unidadeId, ctx.iso, m, aoTerminar(ctx.iso)); }

  /* ---------- a pergunta de mudar de ciclo (Contínuos em outros ciclos › Adicionar), embaixo da linha ---------- */
  function fecharCartao() {
    if (cartao && cartao.parentNode) cartao.remove();
    cartao = null;
  }
  function nota(caixa, t) {
    caixa.classList.toggle('oculto', !t);
    if (t) caixa.querySelector('.nota-texto').textContent = t;
  }
  function abrirCartao(m, linhaEl) {
    fecharCartao();
    var el = RosterWork.tpl('tpl-escala-ciclo-mudar');
    if (!el || !linhaEl) return;
    var q = function (s) { return el.querySelector(s); };
    var uid = ctx.unidadeId, iso = ctx.iso;
    var lista = m.ultimos_servicos || [];
    var ultimo = lista.length ? lista[lista.length - 1] : null;   // vem marcada a mais recente
    q('.escala-ciclo-cartao-rotulo').textContent = L().ultimoRotulo(nomeDe(m));
    q('.escala-ciclo-cartao-ultimo').classList.toggle('oculto', !lista.length);
    var marcar = C().datas(q('.escala-ciclo-cartao-datas'), lista, function (d) { ultimo = d; desenhar(); });
    function desenhar() {
      marcar(ultimo);
      var f = C().frasesMudar(m, ultimo, iso);
      nota(q('.escala-ciclo-cartao-mudar'), f.alerta);
      nota(q('.escala-ciclo-cartao-info'), f.info);
    }
    q('.escala-ciclo-cartao-cancelar').addEventListener('click', fecharCartao);
    q('.escala-ciclo-cartao-continuar').addEventListener('click', function () { C().mudar(uid, iso, m, ultimo, aoTerminar(iso)); });
    linhaEl.insertAdjacentElement('afterend', el);
    cartao = el;
    desenhar();
  }

  /* ---------- as linhas de cada grupo ---------- */
  function saidaMarcada(m) { return m.estado === 'saida_marcada'; }
  function seloSaida(m) { return seloTexto(texto(msg().continuosSaiEm, { data: formatarData(m.saida_em) })); }
  function botaoCancelarSaida(m) { return botao(msg().btnCancelarSaida, null, function () { cancelarSaida(m); }); }

  /* do dia: Remover; com a saída marcada, Cancelar saída ou Remover, que traz a saída para este dia */
  function linhaDoDia(m) {
    var acoes = [botao(msg().btnRemover, 'escala-secao-botao--perigo', function () { remover(m); })];
    if (saidaMarcada(m)) acoes.unshift(botaoCancelarSaida(m));
    var el = linha(m, saidaMarcada(m) ? seloSaida(m) : null, acoes);
    if (el && m.folga_hoje && !m.serve_hoje) {   // é dia dele, mas está de folga: nome riscado
      el.classList.add('escala-secao-item--folga');
      el.setAttribute('data-dica', msg().continuosDeFolga || '');
    }
    return el;
  }
  /* em outros ciclos: o último serviço e o Adicionar (mudar para o ciclo deste dia); com a saída marcada, o selo e o
     Cancelar saída */
  function linhaOutros(m) {
    var el = null;
    var extras = [m.ultimo_servico ? infoTexto(L().infoUltimo(formatarData(m.ultimo_servico).slice(0, 5))) : null,
      saidaMarcada(m) ? seloSaida(m) : null];
    var acoes = [saidaMarcada(m) ? botaoCancelarSaida(m) : null,
      botao(msg().btnAdicionar, null, function () { abrirCartao(m, el); })];
    el = linha(m, extras, acoes);
    return el;
  }
  /* fora: Adicionar; o afastado no dia e quem já tem a entrada marcada, só o selo (muda-se pelo Remover no dia da entrada) */
  function linhaFora(m) {
    if (m.afastamento) {
      return linha(m, seloTexto(texto(msg().continuosAfastadoAte, { motivo: m.afastamento.motivo, data: formatarData(m.afastamento.ate).slice(0, 5) })));
    }
    if (m.entra_em) return linha(m, seloTexto(texto(msg().continuosEntraEm, { data: formatarData(m.entra_em).slice(0, 5) })));
    return linha(m, null, botao(msg().btnAdicionar, null, function () { adicionar(m); }));
  }

  /* ---------- desenho ---------- */
  /* a caixa dos Contínuos em outros ciclos fica como o admin deixou, até abrir outro dia */
  function cabecalhoOutros() { return ctx && ctx.corpo.querySelector('.escala-ciclo-outros > .grupo-caixa-cabecalho'); }
  function lembrarOutros() {
    var cab = cabecalhoOutros();
    if (cab) outros.aberto = cab.getAttribute('aria-expanded') === 'true';
  }

  function renderizar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    lembrarOutros();
    corpo.textContent = '';
    cartao = null;

    /* a frase do topo: o que muda aqui vale a partir do dia aberto e segue nos próximos dias */
    var notaTopo = RosterWork.tpl('tpl-escala-ciclo-nota');
    if (notaTopo) {
      notaTopo.querySelector('.escala-ciclo-nota-data').textContent = formatarData(ctx.iso).slice(0, 5);
      corpo.appendChild(notaTopo);
    }

    var caixas = [];
    if (mils.length) {
      RosterWork.escalasPainel.pecas.montarBusca(corpo, caixas);
      var busca = corpo.querySelector('.busca-entrada');
      if (busca) {
        /* a busca mostra e esconde as linhas: o cartão fecha, e a caixa fechada abre para mostrar quem foi encontrado */
        busca.addEventListener('input', function () {
          fecharCartao();
          var cab = cabecalhoOutros();
          if (cab && busca.value.trim()) cab.setAttribute('aria-expanded', 'true');
        });
      }
    }

    /* fora = quem não está no ciclo; do dia = quem o ciclo escala NESTE dia (de serviço ou de folga); outros = no
       ciclo, de serviço em outros dias (na caixa que abre e fecha) */
    var listaOutros = mils.filter(function (m) { return m.estado !== 'fora' && !m.serve_hoje && !m.folga_hoje; });
    var grupos = [
      { titulo: msg().continuosFora, vazio: msg().continuosVazioFora, montar: linhaFora,
        lista: mils.filter(function (m) { return m.estado === 'fora'; }) },
      { titulo: msg().continuosNaEscala, vazio: msg().continuosVazioNaEscala, montar: linhaDoDia,
        lista: mils.filter(function (m) { return m.estado !== 'fora' && (m.serve_hoje || m.folga_hoje); }) },
      { titulo: msg().continuosOutros(listaOutros.length), vazio: msg().continuosVazioOutros, montar: linhaOutros,
        lista: listaOutros, recolhivel: true }
    ];
    grupos.forEach(function (g) {
      var caixa = g.recolhivel ? RosterWork.painel.criarCaixaRecolhivel(g.titulo, { aberta: outros.aberto })
        : RosterWork.painel.criarCaixa(g.titulo);
      if (!caixa) return;
      var destino = caixa;
      if (g.recolhivel) { caixa.classList.add('escala-ciclo-outros'); destino = caixa.querySelector('.grupo-caixa-corpo'); }
      if (!g.lista.length) caixaVazia(destino, g.vazio);
      g.lista.forEach(function (m) { var el = g.montar(m); if (el) destino.appendChild(el); });
      corpo.appendChild(caixa);
      caixas.push(caixa);
    });
  }

  /* carrega (ou recarrega) do banco → memória → desenha */
  function carregar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    lembrarOutros();
    corpo.textContent = '';
    cartao = null;
    var carregando = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (carregando) corpo.appendChild(carregando);

    RosterWork.escalasDados.continuosListar(ctx.unidadeId, ctx.iso).then(function (dados) {
      if (!ctx || ctx.corpo !== corpo) return;
      if (!dados || !dados.ok) {
        corpo.textContent = '';
        var e = RosterWork.tpl('tpl-escala-distribuicao-estado');
        if (e) { e.textContent = msg().falhaCarregar; corpo.appendChild(e); }
        return;
      }
      mils = dados.militares || [];
      renderizar();
    });
  }

  /* sem rodapé: cada ação grava na hora */
  function montar(corpo, rodape, unidadeId, iso) {
    ctx = { corpo: corpo, unidadeId: unidadeId, iso: iso };
    mils = [];
    cartao = null;
    var chave = unidadeId + '|' + iso;   // outro dia (ou outra unidade): a caixa volta fechada
    if (outros.chave !== chave) outros = { chave: chave, aberto: false };
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    carregar();
  }

  function reset() { ctx = null; mils = []; cartao = null; }

  window.RosterWork.escalasPainelContinuos = { montar: montar, reset: reset };
})();
