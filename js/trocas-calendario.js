/* ============================================================
   TROCAS — a aba Calendário
   O mês do período, no mês em miniatura (geral-mini-calendario, com o
   dia como caixa), com as trocas das unidades marcadas no topo (a mesma
   leitura da aba Todas, fn_trocas_listar, com as trocas de todas as
   datas: trocar de mês não lê de novo). Em cada dia, cada troca: quem
   trabalha em cima e quem folga embaixo, riscado (no serviço, o colega
   trabalha no lugar de quem pediu; na devolução, o contrário); verde =
   aprovada, amarelo = aguardando e, com o Filtros, cinza = não vale mais.
   Clicar numa troca escolhe o registro dela: os dias dele ficam com a
   moldura escura e as outras trocas apagadas; os meses que têm dia dele
   abrem ao lado do mês do período, na ordem das datas; e a caixa da
   Escala (geral-caixa-flutuante) abre ao lado da troca clicada, com o
   RW nº, a situação, a análise (na troca aguardando) e as ações de quem
   olha, as mesmas do rodapé do painel e pelo mesmo código
   (RosterWork.trocasPainel.acoesDe e .acao). O que pede resposta
   (Recusar, Cancelar a troca aprovada, Editar) e o Abrir o painel da
   troca abrem o painel nesse passo, e os dias seguem marcados até ele
   fechar; o resto faz na hora, com a confirmação e o resumo de sempre.
   A caixa abre do lado em que não cobre outro dia da troca, quando dá;
   fecha como na Escala (clique fora, Esc, Voltar), e a marcação sai
   junto. A mudança de mês desfaz a escolha. Os dias de outro mês das
   pontas ficam vazios (o mês vizinho abre ao lado). Na barra, só nesta
   aba: o mês com o Hoje, o Filtros (Situação), a busca (marcar ou
   filtrar) e a Legenda. A largura dos meses e a quebra de linha são do
   CSS (trocas-calendario.css).
   Expõe RosterWork.trocasCalendario.{ iniciar, carregar, sair }
     iniciar(conteudo, { contexto, unidades }) — a cada visita da página
     carregar() — ao abrir a aba e ao recarregar (unidades, ações do painel)
     sair() — ao trocar de aba: desfaz a escolha e esconde o Filtros
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* as ações que pedem uma resposta no painel (o motivo, o formulário): abrem o painel já nesse passo */
  var NO_PAINEL = { recusar: true, 'recusar-admin': true, editar: true, 'cancelar-aprovada': true };

  var conteudo = null;
  var contexto = null;        // o do trocas.js: quem olha e o que fazer depois de uma ação
  var lerUnidades = null;     // as unidades marcadas no topo
  var trocas = [];            // as trocas lidas, de todas as datas
  var mesBase = null;         // o 1º dia do mês do período
  var escolhido = null;       // a chave do registro escolhido (registro_id; a troca sem registro, troca_id)
  var caixa = null;           // a caixa aberta (geral-caixa-flutuante)
  var noPainel = null;        // o registro aberto no painel pela caixa: os dias seguem marcados até o painel fechar
  var filtros = null;         // o botão Filtros (geral-filtros)
  var termoBusca = '';
  var modoBusca = 'marcar';
  var leitura = 0;            // a leitura mais recente (a resposta de uma antiga não desenha)
  var espera = null;          // a espera da leitura (geral-etapas)

  function q(sel) { return conteudo ? conteudo.querySelector(sel) : null; }
  function msg() { return RW.mensagens.trocas; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function mesDe(dia) { var p = String(dia).split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, 1); }
  function mesDeHoje() { var h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1); }
  function mesmoMes(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
  function nomeDoMes(d) { return msg().imprimir.mes(MESES[d.getMonth()], d.getFullYear()); }
  function chaveDoRegistro(t) { return t.registro_id || t.troca_id; }

  /* a situação da troca, para a cor e o Filtros: aprovada, aguardando ou não vale mais */
  function situacao(t) {
    if (t.status === 'aprovada') return 'aprovada';
    if (t.status === 'pendente_confirmacao' || t.status === 'pendente_aprovacao') return 'aguardando';
    return 'nao-vale';
  }
  function passa(t) { return !filtros || filtros.passa('situacao', situacao(t)); }

  /* os dias da troca: no serviço, o colega trabalha no lugar de quem pediu; na devolução, o contrário */
  function diasDaTroca(t) {
    var quemPediu = { nome: t.solicitante_nome, grau: t.solicitante_grau, cpf: t.solicitante_cpf };
    var colega = { nome: t.parceiro_nome, grau: t.parceiro_grau, cpf: t.parceiro_cpf };
    var dias = [];
    if (t.data_servico_solicitante) dias.push({ dia: String(t.data_servico_solicitante).slice(0, 10), trabalha: colega, folga: quemPediu });
    if (t.data_servico_parceiro) dias.push({ dia: String(t.data_servico_parceiro).slice(0, 10), trabalha: quemPediu, folga: colega });
    return dias;
  }

  /* as trocas do registro, pela ordem do dia (a primeira é a que a lista mostra e o painel abre) */
  function trocasDoRegistro(chave) {
    return trocas.filter(function (t) { return chaveDoRegistro(t) === chave; }).sort(function (a, b) {
      var da = String(a.data_servico_solicitante), db = String(b.data_servico_solicitante);
      if (da !== db) return da < db ? -1 : 1;
      return a.troca_id < b.troca_id ? -1 : 1;
    });
  }

  /* os meses na tela: o do período e, com uma troca escolhida, os que têm dia do registro dela, na ordem das datas */
  function mesesNaTela() {
    var meses = [mesBase];
    if (escolhido) trocasDoRegistro(escolhido).forEach(function (t) {
      diasDaTroca(t).forEach(function (d) {
        var mes = mesDe(d.dia);
        if (!meses.some(function (x) { return mesmoMes(x, mes); })) meses.push(mes);
      });
    });
    return meses.sort(function (a, b) { return a - b; });
  }

  /* as trocas de cada dia ('AAAA-MM-DD' → [{ troca, dia, trabalha, folga }]), só as que passam no Filtros */
  function trocasPorDia() {
    var porDia = {};
    trocas.forEach(function (t) {
      if (!passa(t)) return;
      diasDaTroca(t).forEach(function (d) {
        (porDia[d.dia] = porDia[d.dia] || []).push({ troca: t, dia: d.dia, trabalha: d.trabalha, folga: d.folga });
      });
    });
    return porDia;
  }

  /* uma troca no dia: o botão com quem trabalha e quem folga, a cor da situação e a busca (marcar: o nome achado
     invertido; filtrar: só as trocas de quem casa). null = fica de fora pela busca */
  function montarPar(p) {
    var achaTrabalha = !!termoBusca && RW.busca.casaTexto(termoBusca, RW.busca.chave(p.trabalha));
    var achaFolga = !!termoBusca && RW.busca.casaTexto(termoBusca, RW.busca.chave(p.folga));
    if (termoBusca && modoBusca === 'filtrar' && !achaTrabalha && !achaFolga) return null;
    var par = RW.tpl('tpl-troca-cal-par');
    if (!par) return null;
    var chave = chaveDoRegistro(p.troca), f = RW.trocasFormato;
    var trabalha = par.querySelector('.trocas-dia-trabalha'), folga = par.querySelector('.trocas-dia-folga');
    trabalha.textContent = p.trabalha.nome || '';
    folga.textContent = p.folga.nome || '';
    par.setAttribute('data-registro', chave);
    par.classList.add('trocas-cal-par--' + situacao(p.troca));
    if (chave === escolhido) par.classList.add('trocas-cal-par--escolhido');
    if (achaTrabalha || achaFolga) par.classList.add('busca-achado');
    if (modoBusca === 'marcar') {
      trabalha.classList.toggle('trocas-cal-nome--busca', achaTrabalha);
      folga.classList.toggle('trocas-cal-nome--busca', achaFolga);
    }
    par.setAttribute('aria-label', msg().varias.noLugarDe(f.nomeMilitar(p.trabalha.grau, p.trabalha.nome), f.nomeMilitar(p.folga.grau, p.folga.nome)));
    par.addEventListener('click', function () { escolher(chave, p.dia); });
    return par;
  }

  /* a grade com datas abre em hoje (geral-periodo): a semana de hoje à vista, com uma ponta da semana de antes */
  function rolarAteHoje(diaHoje) {
    var area = q('.pagina-corpo[data-aba-painel="calendario"]');
    var anterior = diaHoje;
    for (var i = 0; i < 7 && anterior; i++) anterior = anterior.previousElementSibling;
    if (area && anterior && RW.periodo) RW.periodo.rolarAteHoje(area, diaHoje, anterior);
  }

  /* desenha os meses na tela com as trocas de cada dia; abrirEmHoje: com o mês de hoje na tela, rola até a semana dele */
  function desenhar(abrirEmHoje) {
    var alvo = q('#trocas-cal');
    if (!alvo || !mesBase) return;
    var porDia = trocasPorDia();
    var hoje = iso(new Date());
    var diaHoje = null;
    alvo.textContent = '';
    alvo.classList.toggle('trocas-cal--escolha', !!escolhido);
    mesesNaTela().forEach(function (mes) {
      var bloco = RW.tpl('tpl-troca-cal-mes');
      if (!bloco) return;
      bloco.querySelector('.trocas-cal-mes-nome').textContent = nomeDoMes(mes);
      RW.miniCalendario.renderizar(bloco.querySelector('.trocas-cal-mes-grade'), {
        dataRef: mes,
        molde: 'tpl-troca-cal-dia',
        aoDia: function (dia, diaIso) {
          if (diaIso === hoje) { dia.classList.add('mini-calendario-dia--hoje'); diaHoje = dia; }
          (porDia[diaIso] || []).forEach(function (p) {
            var par = montarPar(p);
            if (par) dia.appendChild(par);
          });
        }
      });
      alvo.appendChild(bloco);
    });
    if (abrirEmHoje && diaHoje) rolarAteHoje(diaHoje);
  }

  /* ---------- a escolha e a caixa ---------- */

  /* desfaz a escolha: a marcação sai e os meses de fora fecham */
  function limparEscolha() {
    if (!escolhido) return;
    escolhido = null;
    desenhar();
  }

  /* a página fecha a caixa (o componente só avisa quando quem fecha é a pessoa: o clique fora, o Esc, o Voltar) */
  function fecharCaixa() {
    if (!caixa) return;
    var c = caixa;
    caixa = null;
    c.fechar();
  }

  /* o contexto do painel aberto pela caixa: ao fechar, os dias deixam de ficar marcados */
  function contextoDoPainel(chave) {
    var c = contexto || {};
    return {
      cpf: c.cpf, ehAdmin: c.ehAdmin, aoMudar: c.aoMudar,
      aoFechar: function () {
        if (c.aoFechar) c.aoFechar();
        if (noPainel !== chave) return;
        noPainel = null;
        if (!caixa) limparEscolha();
      }
    };
  }

  /* uma ação da caixa, pelo código do painel: o que pede resposta (e o Abrir o painel) abre o painel nesse passo; o resto
     faz na hora (com a caixa aberta, a confirmação e o resumo de sempre; depois, a leitura nova fecha a caixa) */
  function executarAcao(acao, t, item) {
    if (acao === 'painel' || NO_PAINEL[acao] || (acao === 'cancelar' && t.status === 'aprovada')) {
      var ctx = contextoDoPainel(escolhido);
      noPainel = escolhido;
      fecharCaixa();
      RW.trocasPainel.abrir(t, ctx);
      if (acao !== 'painel') RW.trocasPainel.acao(acao, t, ctx);
      return;
    }
    /* o Aprovar confirma com o aviso de problema quando a análise o achou (a lista já traz o resultado dela) */
    if ((acao === 'aprovar' || acao === 'aprovar-forcar') && t.veredito) t._analise = { veredito: t.veredito };
    RW.trocasPainel.acao(acao, t, contexto, item);
  }

  /* a caixa abre à esquerda quando, à direita, cobriria outro dia da troca e, à esquerda, não. O tamanho é o do leiaute
     (offsetWidth): enquanto abre, a caixa está um pouco encolhida pela animação */
  function ladoSemCobrir(peca, junto, conteudoCaixa) {
    return function () {
      if (!junto.length) return false;
      var p = peca.getBoundingClientRect();
      var el = conteudoCaixa.closest('.caixa-flutuante') || conteudoCaixa;
      var largura = el.offsetWidth + 4, altura = el.offsetHeight;   // + os 4px entre a peça e a caixa
      function cobre(esquerda, direita) {
        return junto.some(function (j) {
          var r = j.getBoundingClientRect();
          return r.left < direita && r.right > esquerda && r.top < p.bottom + altura && r.bottom > p.top - altura;
        });
      }
      return cobre(p.right, p.right + largura) && !cobre(p.left - largura, p.left);
    };
  }

  /* a caixa da troca escolhida, ao lado da troca clicada: o RW nº, a situação, a análise e as ações de quem olha */
  function abrirCaixa(chave, dia) {
    var t = trocasDoRegistro(chave)[0];
    var pares = Array.prototype.slice.call(conteudo.querySelectorAll('.trocas-cal-par[data-registro="' + chave + '"]'));
    var peca = pares.filter(function (p) { return p.closest('.mini-calendario-dia').getAttribute('data-iso') === dia; })[0] || pares[0];
    var el = RW.tpl('tpl-troca-cal-caixa');
    if (!t || !peca || !el || !RW.caixaFlutuante) return;
    var f = RW.trocasFormato, m = msg(), varias = !!t.registro_varias;
    var rw = m.registroNumero(t.registro_numero, t.registro_ano);
    el.querySelector('.trocas-cal-caixa-rw').textContent = rw;
    var info = f.situacao(t.status, !!t.substitui_troca_id || (varias && !!t.original));
    var seloSituacao = el.querySelector('.trocas-cal-caixa-situacao');
    seloSituacao.textContent = info.texto;
    seloSituacao.classList.add(info.classe);
    /* a análise, na troca aguardando: o mesmo selo dos cartões da Pendências */
    var analise = situacao(t) === 'aguardando' && RW.impacto ? RW.impacto.selo({ veredito: t.veredito, problemas: t.veredito_problemas, alertas: t.veredito_alertas }) : null;
    var seloAnalise = el.querySelector('.trocas-cal-caixa-analise');
    seloAnalise.classList.toggle('oculto', !analise);
    if (analise) { seloAnalise.textContent = analise.texto; seloAnalise.classList.add(analise.classe); }
    /* as ações de quem olha (a regra do painel); o Cancelar muda de nome nas várias trocas (data-so) */
    var acoes = RW.trocasPainel.acoesDe(t, contexto || {});
    var tipo = varias ? 'varias' : 'uma', alguma = false;
    Array.prototype.forEach.call(el.querySelectorAll('[data-acao]'), function (item) {
      var acao = item.getAttribute('data-acao'), so = item.getAttribute('data-so');
      var vale = acao === 'painel' || (!!acoes[acao] && (!so || so === tipo));
      if (!vale) { item.parentNode.removeChild(item); return; }
      if (acao !== 'painel') alguma = true;
      item.addEventListener('click', function () { executarAcao(acao, t, item); });
    });
    el.querySelector('[data-divisor-painel]').classList.toggle('oculto', !alguma);
    var junto = pares.filter(function (p) { return p !== peca; });
    caixa = RW.caixaFlutuante.abrir({
      peca: peca, junto: junto, conteudo: el, titulo: rw,
      preferirEsquerda: ladoSemCobrir(peca, junto, el),
      aoFechar: function () {
        caixa = null;
        if (noPainel !== escolhido) limparEscolha();
      }
    });
  }

  /* escolhe o registro da troca clicada e abre a caixa (o painel de outra troca fecha antes: o painel acompanha a tela) */
  function escolher(chave, dia) {
    RW.painel.antesDeMudarTela(function () {
      noPainel = null;
      escolhido = chave;
      desenhar();
      abrirCaixa(chave, dia);
    });
  }

  /* ---------- o mês, o Filtros e a leitura ---------- */

  /* o mês do período e o Hoje (só fora do mês de hoje) */
  function pintarPeriodo() {
    var nome = q('#trocas-cal-mes'), hoje = q('#trocas-cal-hoje');
    if (nome) nome.textContent = nomeDoMes(mesBase);
    if (hoje) hoje.classList.toggle('oculto', mesmoMes(mesBase, mesDeHoje()));
  }

  /* muda o mês do período (as setas e o Hoje): o painel aberto fecha antes, e a escolha se desfaz */
  function irParaMes(mes) {
    RW.painel.antesDeMudarTela(function () {
      mesBase = mes;
      escolhido = null;
      noPainel = null;
      pintarPeriodo();
      desenhar(true);
    });
  }

  /* o Filtros mudou: a escolha que ficou toda de fora se desfaz */
  function aoFiltrar() {
    if (escolhido && !trocasDoRegistro(escolhido).some(passa)) escolhido = null;
    desenhar();
  }

  /* abre a aba: o mês na hora (com as trocas já lidas) e a leitura das trocas, só a mais recente desenha. Depois de uma
     ação, a caixa aberta fecha (a troca mudou) */
  function carregar() {
    var alvo = q('#trocas-cal'), area = q('.pagina-corpo[data-aba-painel="calendario"]');
    if (!alvo || !area) return;
    if (caixa) {
      fecharCaixa();
      if (noPainel !== escolhido) escolhido = null;
    }
    if (filtros) filtros.mostrar(true);
    pintarPeriodo();
    desenhar();
    var minha = ++leitura;
    if (espera) espera.parar();
    espera = RW.etapas.area(area, { etapas: 'trocasCalendario' });
    var esta = espera;
    function falhou() {
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.falha.frase(msg().falhaCarregar) });
    }
    esta.segurar(RW.trocasDados.listar(lerUnidades ? lerUnidades() : [])).then(function (lista) {
      esta.parar();
      if (espera === esta) espera = null;
      if (minha !== leitura || !q('#trocas-cal')) return;
      if (!Array.isArray(lista)) { falhou(); return; }   // null = falha (o banco devolve [] para vazio)
      trocas = lista;
      if (escolhido && !trocasDoRegistro(escolhido).length) { escolhido = null; noPainel = null; }
      desenhar(true);
    }).catch(function () {
      esta.parar();
      if (espera === esta) espera = null;
      if (minha === leitura && q('#trocas-cal')) falhou();
    });
  }

  /* troca de aba: a caixa fecha, a escolha se desfaz e o Filtros (com a linha "Filtros:") sai da barra */
  function sair() {
    noPainel = null;
    fecharCaixa();
    escolhido = null;
    if (espera) { espera.parar(); espera = null; }
    if (filtros) filtros.mostrar(false);
  }

  /* liga o clique uma vez por elemento (a página é nova a cada visita) */
  function ligar(sel, fn) {
    var el = q(sel);
    if (!el || el.dataset.ligado) return;
    el.dataset.ligado = '1';
    el.addEventListener('click', fn);
  }

  /* a cada visita da página: o mês de hoje, o Filtros (a escolha fica na sessão), a busca, a Legenda e as setas */
  function iniciar(conteudoEl, opcoes) {
    conteudo = conteudoEl;
    contexto = (opcoes && opcoes.contexto) || null;
    lerUnidades = (opcoes && opcoes.unidades) || null;
    trocas = [];
    mesBase = mesDeHoje();
    escolhido = null;
    caixa = null;
    noPainel = null;
    termoBusca = '';
    modoBusca = 'marcar';
    leitura++;
    if (espera) { espera.parar(); espera = null; }

    var mc = msg().calendario;
    var caixaFiltros = q('#trocas-cal-filtros');
    filtros = caixaFiltros && RW.filtros ? RW.filtros.criar(caixaFiltros, { aoMudar: aoFiltrar, guardar: 'trocas-calendario' }) : null;
    if (filtros) {
      filtros.definir('situacao', [{ rotulo: mc.aprovadas, valor: 'aprovada' }, { rotulo: mc.aguardando, valor: 'aguardando' },
        { rotulo: mc.naoValem, valor: 'nao-vale', separado: true }]);
      filtros.mostrar(false);
    }
    var caixaBusca = q('#trocas-cal-busca');
    if (caixaBusca && RW.busca) RW.busca.criar({
      caixa: caixaBusca,
      aoBuscar: function (termo, modo) { termoBusca = termo || ''; modoBusca = modo; desenhar(); }
    });
    /* a Legenda: o molde geral troca o lugar pelo botão (fica com o id e as classes; a marca da aba vai de novo) */
    var legenda = RW.legenda ? RW.legenda.montar(q('#trocas-cal-legenda')) : null;
    var moldeLegenda = document.getElementById('tpl-troca-cal-legenda');
    if (legenda) {
      legenda.setAttribute('data-aba-painel', 'calendario');
      var lugar = legenda.querySelector('[data-legenda-conteudo]');
      if (lugar && moldeLegenda && !lugar.children.length) lugar.appendChild(moldeLegenda.content.cloneNode(true));
    }

    ligar('#trocas-cal-anterior', function () { irParaMes(new Date(mesBase.getFullYear(), mesBase.getMonth() - 1, 1)); });
    ligar('#trocas-cal-proximo', function () { irParaMes(new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 1)); });
    ligar('#trocas-cal-hoje', function () { irParaMes(mesDeHoje()); });
  }

  RW.trocasCalendario = { iniciar: iniciar, carregar: carregar, sair: sair };
})();
