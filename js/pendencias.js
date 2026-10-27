/* ============================================================
   PENDÊNCIAS — o que espera decisão, num lugar só
   Uma lista só, em três seções (o banco diz o bloco de cada
   pendência, se é de administração e quanto soma no número):
     · Precisa de você — o que espera quem lê: a troca para
                         responder, o aceite que falta, o prazo da
                         extra, a CNH (no painel da CNH) e, do
                         administrador (etiqueta ADM), o que aprovar;
                         pelo prazo, o que não tem data no fim
     · Para corrigir   — só administrador: fora da escala, retorno
                         de afastamento e a Distribuição
     · Acompanhando    — o que espera outra pessoa: os seus pedidos
                         (pendencias_meus_pedidos, em andamento e
                         resolvidos nos últimos 30 dias) e, do
                         administrador, as trocas esperando o aceite
                         dos militares; não soma no número
   O ícone de cada cartão diz o assunto. As filas são o componente
   geral-fila com o cartão que abre ali mesmo (o resumo e as ações;
   "Ver detalhes" abre o painel). Quem chega por um aviso abre o
   pedido direto (a referência é o id dele). Aqui ficam as linhas
   que não são pedido, o "Para corrigir" e o número.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  /* a cor do selo da correção de dados (os ícones vêm do mapa único da fila: RosterWork.fila.icone) */
  var SELO_DADOS = { pendente: 'selo--alerta', aprovada: 'selo--sucesso', recusada: 'selo--erro', parcial: 'selo--alerta' };

  var conteudo = null;
  var admin = false;
  var filaFazer = null, filaAcompanhar = null;
  var leitura = 0;     // a última leitura vence

  function msg() { return RW.mensagens.pendencias; }
  function q(sel) { return conteudo ? conteudo.querySelector(sel) : null; }

  /* ---------- "Para corrigir" (só nesta página) ---------- */
  function cabecalhoCorrigir(el, g) {
    el.querySelector('.pendencias-corrigir-contagem').textContent = g.contagem;
    el.querySelector('.pendencias-corrigir-texto').textContent = g.texto || '';
  }

  function itensCorrigir(el, linhas, molde, preencher) {
    var ul = el.querySelector('.pendencias-corrigir-itens');
    (linhas || []).forEach(function (x) {
      var li = RosterWork.tpl(molde);
      if (!li) return;
      preencher(li, x);
      if (ul) ul.appendChild(li);
    });
  }

  function desenharCorrigir(lista, grupos) {
    lista.textContent = '';
    if (!grupos.length) {
      var v = RosterWork.tpl('tpl-pedido-vazio');
      if (v) { v.textContent = msg().vazioCorrigir; lista.appendChild(v); }
      return;
    }
    grupos.forEach(function (g) {
      var el;
      if (g.tipo === 'fora_escala') {
        /* não navega: o conserto é no Contínuos */
        el = RosterWork.tpl('tpl-pendencias-fora');
        if (!el) return;
        itensCorrigir(el, g.militares, 'tpl-pendencias-fora-item', function (li, x) {
          li.querySelector('.pendencias-corrigir-grad').textContent = x.grad || '';
          li.querySelector('.pendencias-corrigir-nome').textContent = x.nome || '';
          li.querySelector('.pendencias-corrigir-unidade').textContent = x.unidade || '';
        });
      } else if (g.tipo === 'retorno_afastamento') {
        /* não navega: a entrada no ciclo se marca no Contínuos */
        el = RosterWork.tpl('tpl-pendencias-retorno');
        if (!el) return;
        itensCorrigir(el, g.militares, 'tpl-pendencias-retorno-item', function (li, x) {
          li.querySelector('.pendencias-corrigir-grad').textContent = x.grad || '';
          li.querySelector('.pendencias-corrigir-nome').textContent = x.nome || '';
          li.querySelector('.pendencias-corrigir-motivo').textContent = x.motivo || '';
          li.querySelector('.pendencias-corrigir-data').textContent = x.volta || '';
          li.querySelector('.pendencias-corrigir-unidade').textContent = x.unidade || '';
        });
      } else {
        /* leva à tela do conserto (ex.: a Distribuição a revisar) */
        el = RosterWork.tpl('tpl-pendencias-corrigir');
        if (!el) return;
        el.addEventListener('click', function () { if (g.pagina && RW.irParaPagina) RW.irParaPagina(g.pagina, g.aba); });
      }
      cabecalhoCorrigir(el, g);
      lista.appendChild(el);
    });
  }

  /* ---------- o que não é pedido (Precisa de você): o prazo da extra e a CNH ---------- */
  /* o mesmo cartão dos pedidos; o prazo leva à tela onde se responde, a CNH abre o painel dela aqui mesmo */
  function linhaGrupo(g) {
    return RW.fila.linha({
      icone: RW.fila.icone(g.tipo), quem: g.texto, meta: g.mensagem,
      aoClicar: function () {
        if (g.tipo === 'cnh') { if (RW.cnhPainel) RW.cnhPainel.abrir({ aoSalvar: carregar }); return; }
        if (g.pagina && RW.irParaPagina) RW.irParaPagina(g.pagina, g.aba, g.referencia);
      }
    });
  }

  /* ---------- os seus pedidos (Acompanhando): em andamento e resolvidos ---------- */
  function irPara(pagina, aba, referencia) { if (pagina && RW.irParaPagina) RW.irParaPagina(pagina, aba || null, referencia); }
  function nomeDe(grau, nome) { return ((grau || '') + ' ' + (nome || '')).trim(); }

  /* um pedido seu: a frase, o dia e o selo com a situação; abre ali mesmo com o resumo e o que você pode fazer
     (Cancelar pedido), e o Ver detalhes leva ao painel da troca ou à página dele */
  function cartaoMeuPedido(p) {
    var M = RW.mensagens, pe = M.pendencias;
    var outro = nomeDe(p.outro_grau, p.outro_nome);
    var resolvido = !p.andamento;
    var meta = pe.metaServico(RW.data.comDiaCurto(p.data), RW.fila.trecho(p.horario_inicio, p.horario_fim));
    var c;
    if (p.tipo === 'troca' && p.varias) {
      /* as várias trocas: um cartão por registro, com os militares (quem pediu primeiro) e o RW nº */
      var mv = M.trocas.varias, nomes = p.militares || [];
      c = { icone: RW.fila.icone('troca'), quem: mv.linhaMilitares(mv.nomes(nomes)), selo: RW.trocasFormato.situacao(p.situacao, !!p.alteracao),
            meta: mv.filaMeta(RW.data.comDiaCurto(p.data), nomes.length, M.trocas.registroNumero(p.registro_numero, p.registro_ano)) };
    } else if (p.tipo === 'troca') {
      c = { icone: RW.fila.icone('troca'), meta: meta, selo: RW.trocasFormato.situacao(p.situacao, p.alteracao),
            quem: p.alteracao ? pe.trocaAlteracao(outro) : (p.papel === 'solicitante' ? pe.trocaVoce(outro, resolvido) : pe.trocaOutro(outro, resolvido)) };
    } else if (p.tipo === 'folga') {
      c = { icone: RW.fila.icone('folga'), quem: pe.folgaVoce, meta: meta,
            selo: { texto: M.folgas.situacao[p.situacao] || '', classe: RW.folgasFormato.situacaoClasse(p.situacao) } };
    } else {
      c = { icone: RW.fila.icone('dados'), quem: pe.dadosVoce, meta: pe.metaDados(p.alteracoes || 0, RW.data.isoParaBR(p.data)),
            selo: { texto: pe.situacaoDados[p.situacao] || '', classe: SELO_DADOS[p.situacao] || 'selo--escuro' } };
    }
    c.montar = function (corpo) {
      RW.filaResumo.meuPedido(corpo, p, { cpf: RW.sessao.cpf(), ehAdmin: admin, admin: admin, aoMudar: carregar }, irPara);
    };
    return RW.fila.expansivel(c);
  }

  /* Acompanhando: em andamento primeiro (as trocas esperando os militares e os seus), pela data mais próxima
     (a correção de dados não tem prazo: vai para o fim); depois os seus resolvidos, do mais recente */
  function itensAcompanhar(acompanhar, meus) {
    function item(p) {
      var data = p.andamento && p.tipo === 'dados' ? '' : String(p.data || '').slice(0, 10);
      return { data: data, desenhar: function () { return cartaoMeuPedido(p); } };
    }
    var andamento = acompanhar.concat(meus.filter(function (p) { return p.andamento; }).map(item));
    var resolvidos = meus.filter(function (p) { return !p.andamento; }).map(item);
    andamento.sort(RW.fila.porPrazo);
    resolvidos.sort(function (a, b) { return a.data < b.data ? 1 : (a.data > b.data ? -1 : 0); });
    return andamento.concat(resolvidos);
  }

  /* ---------- desenho ---------- */
  function desenhar(dados, meus) {
    filaFazer.definir(dados.fazer.map(function (x) {
      return x.grupo ? { tipo: x.tipo, data: x.data, desenhar: function () { return linhaGrupo(x.grupo); } } : x;
    }));
    desenharCorrigir(q('#pendencias-corrigir'), dados.corrigir);
    q('#pendencias-secao-corrigir').classList.toggle('oculto', !admin);
    var acompanhar = itensAcompanhar(dados.acompanhar, meus);
    filaAcompanhar.definir(acompanhar);
    q('#pendencias-secao-acompanhar').classList.toggle('oculto', !acompanhar.length);
    q('#pendencias-contagem').textContent = dados.total ? msg().contagem(dados.total) : '';
  }

  function falha() {
    q('#pendencias-secao-corrigir').classList.add('oculto');
    q('#pendencias-secao-acompanhar').classList.add('oculto');
    var lista = q('#pendencias-fazer');
    if (!lista) return;
    lista.textContent = '';
    var v = RosterWork.tpl('tpl-pedido-vazio');
    if (v) { v.textContent = msg().falhaCarregar; lista.appendChild(v); }
  }

  /* lê tudo de uma vez: a fila e os seus pedidos (a fila também chama depois de cada decisão) */
  function carregar() {
    var minha = ++leitura;
    return Promise.all([
      RW.fila.ler(),
      RW.rpc('pendencias_meus_pedidos', {}).catch(function () { return null; })
    ]).then(function (r) {
      if (minha !== leitura || !conteudo || !document.contains(conteudo)) return;
      if (!r[0]) { falha(); return; }
      desenhar(r[0], Array.isArray(r[1]) ? r[1] : []);
    });
  }

  function iniciar(el) {
    conteudo = el;
    admin = RosterWork.sessao.temPapel('pelotao');   // o de administração vem só com o que este admin pode decidir (o banco filtra)
    /* os cartões abrem ali mesmo (o resumo e as ações); "Ver detalhes" abre o painel */
    filaFazer = RW.fila.criar(q('#pendencias-fazer'), { vazio: msg().vazioFazer, recarregar: carregar, expandir: true });
    filaAcompanhar = RW.fila.criar(q('#pendencias-acompanhar'), { recarregar: carregar, expandir: true });

    var referencia = RW.referenciaPedida ? RW.referenciaPedida('pendencias') : null;
    return carregar().then(function () {
      /* chegou por um aviso: abre o pedido (a aba que ainda venha no link não importa) */
      if (referencia && !filaFazer.abrirId(referencia)) filaAcompanhar.abrirId(referencia);
    });
  }

  /* um pedido decidido fora da página (a faixa "Esperando a sua resposta"): relê, se a página está na tela */
  function recarregar() {
    if (q('#pendencias-fazer')) carregar();
  }

  RW.paginas.pendencias = { iniciar: iniciar, recarregar: recarregar };
})();
