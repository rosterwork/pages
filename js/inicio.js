/* ============================================================
   INÍCIO — o calendário do militar, os avisos e as pendências
   À esquerda, o mês de quem está logado (inicio_calendario: a mesma
   leitura do mês da Escala, filtrada por ele) no mês em miniatura do
   Solicitar extra (geral-mini-calendario), com os ícones da Escala em
   cada dia; o clique (ou o toque) escolhe o dia, e o resumo embaixo
   mostra as linhas dele, com o botão que abre o painel do dia (só de
   leitura, com o militar destacado: escalas-painel.js). "Hoje" é o
   dia de serviço (vira às 08h). Ao lado, os avisos (fn_avisos_listar)
   e as pendências: o que espera a sua decisão (a fila da Pendências,
   geral-fila, que abre o painel de decisão), os prazos e os seus
   pedidos em andamento e resolvidos nos últimos 30 dias
   (inicio_meus_pedidos); para o administrador, também a aba
   Administração. Cada lista mostra o que cabe na altura da tela e o
   Ver todos leva ao resto. A página aparece inteira de uma vez (o véu
   espera tudo), e a troca de mês usa o mesmo véu. Só clona moldes.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  /* origem da linha -> ícone (os mesmos da Escala) */
  var ICONE_ORIGEM = {
    base: 'icone-origem-base', saida: 'icone-origem-saida', troca: 'icone-origem-troca', troca_saida: 'icone-origem-troca',
    pontual: 'icone-origem-pontual', sistema: 'icone-origem-sistema', folga: 'icone-folgas', extra: 'icone-extrajornada'
  };
  /* as linhas de quem saiu do serviço (riscadas na Escala) */
  var RISCADA = { folga: true, troca_saida: true };
  /* embaixo do calendário (tela estreita ou celular), cada lista mostra os 3 primeiros */
  var LISTA_EMPILHADA = 3;
  /* o ícone de cada pedido (os mesmos da fila da Pendências) e a cor do selo da correção de dados */
  var ICONE_PEDIDO = { troca: 'trocas', folga: 'folgas', dados: 'editar' };
  var SELO_DADOS = { pendente: 'selo--alerta', aprovada: 'selo--sucesso', recusada: 'selo--erro', parcial: 'selo--alerta' };

  var el = {};
  var conteudo = null;   // o bloco de conteúdo do shell (o véu de carregamento mora nele)
  var estado = { mes: null, dados: null, selecionado: null, pedido: 0 };
  var pend = { aba: 'paramim', filaMinhas: null, filaAprovar: null, pedido: 0 };
  var tamanhoLigado = false;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dataDeIso(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function celular() { return !!(RW.celular && RW.celular()); }
  function hojeIso() { return iso(RW.data.diaDeServico()); }
  function cpfLogado() { var u = RW.sessao.perfil(); return u ? u.cpf : null; }
  function nomeDe(grau, nome) { return ((grau || '') + ' ' + (nome || '')).trim(); }
  function irPara(pagina, aba, referencia) { if (pagina && RW.irParaPagina) RW.irParaPagina(pagina, aba || null, referencia); }

  /* ---------- o dia e o painel do dia ---------- */

  /* as linhas do dia no formato da linha da Escala (escalas-celula.js) */
  function pessoas(linhas) {
    var r = RW.mensagens.inicio.rotulos;
    return linhas.map(function (l) {
      if (l.origem === 'afastamento') return { origem: 'afastamento', afastamento: l.afastamento, ate: l.ate, grad: '', nome: '' };
      return {
        origem: l.origem, origem_base: l.origem_base, grad: '', periodos: l.periodos || [],
        nome: l.origem === 'extra' ? r.extra : (l.origem === 'troca' ? r.troca : r.servico)
      };
    });
  }

  /* as linhas da Escala num lugar; o afastado fica à vista (na Escala, só com o filtro) */
  function preencherLinhas(cont, linhas) {
    RW.escalasCelula.preencherCelula(cont, null, null, pessoas(linhas), 0, []);
    Array.prototype.forEach.call(cont.querySelectorAll('.linha-escalado--afastamento'), function (l) { l.classList.remove('oculto'); });
  }

  /* as linhas agrupadas pela unidade onde ele tira cada uma, na ordem do dia: [{ unidade, linhas }] */
  function porUnidade(linhas) {
    var grupos = [];
    linhas.forEach(function (l) {
      var g = grupos.filter(function (x) { return x.unidade === l.unidade; })[0];
      if (!g) { g = { unidade: l.unidade, linhas: [] }; grupos.push(g); }
      g.linhas.push(l);
    });
    return grupos;
  }

  /* a unidade do painel de um dia: a da primeira linha; sem linha, onde ele está no dia */
  function unidadeDoDia(dia) { return (dia.linhas && dia.linhas.length) ? dia.linhas[0].unidade : dia.unidade; }

  /* põe no elemento o que o painel do dia lê: a unidade (nome e cidade) e o dia */
  function marcarDia(alvo, unidadeId, diaIso, unidades) {
    var u = (unidades && unidades[unidadeId]) || {};
    alvo.dataset.unidadeId = unidadeId;
    alvo.dataset.iso = diaIso;
    alvo.dataset.unidadeNome = u.nome_painel || u.nome || '';
    alvo.dataset.unidadeCidade = u.cidade || '';
  }

  /* o painel do dia, só de leitura, com o militar destacado */
  function abrirPainel(alvo) {
    if (!RW.escalasPainel || !alvo || !alvo.dataset.unidadeId) return;
    RW.escalasPainel.abrir(alvo, null, { leitura: true, destacar: cpfLogado() });
  }

  /* ---------- calendário ---------- */

  function estadoCalendario(idTpl, texto) {
    el.calendario.textContent = '';
    var no = RW.tpl(idTpl);
    if (!no) return;
    if (texto) no.textContent = texto;
    el.calendario.appendChild(no);
  }

  function icone(nome) {
    var svg = RW.tpl('tpl-escala-mes-origem');
    if (svg) svg.querySelector('use').setAttribute('href', 'icones/' + nome + '.svg#' + nome);
    return svg;
  }

  /* um dia no quadradinho: os ícones das linhas dele (folga e troca de saída apagados); o afastado,
     listrado com a sigla (FÉR, LIC, DIS) */
  function desenharDia(botao, diaIso) {
    var dia = estado.dados.dias[diaIso] || { linhas: [] };
    var linhas = dia.linhas || [];
    var texto = botao.querySelector('.mini-calendario-texto');
    if (diaIso === hojeIso()) botao.classList.add('mini-calendario-dia--hoje');
    if (diaIso === estado.selecionado) botao.classList.add('mini-calendario-dia--selecionado');

    var afast = linhas.filter(function (l) { return l.origem === 'afastamento'; })[0];
    if (afast) {
      botao.classList.add('mini-calendario-dia--afastado');
      texto.textContent = String(afast.afastamento || '').slice(0, 3).toUpperCase();
      return;
    }
    linhas.forEach(function (l) {
      var ic = icone(ICONE_ORIGEM[l.origem] || ICONE_ORIGEM.sistema);
      if (!ic) return;
      if (RISCADA[l.origem]) ic.classList.add('inicio-icone--riscado');
      texto.appendChild(ic);
    });
  }

  function desenharMes() {
    RW.miniCalendario.renderizar(el.calendario, { dataRef: estado.mes, aoDia: desenharDia });
    mostrarDia(estado.selecionado);
  }

  /* o dia que o resumo mostra ao abrir o mês: o próximo serviço de hoje em diante; sem ele, hoje; fora do
     mês de hoje, o primeiro dia com algo marcado */
  function diaPadrao() {
    var dias = estado.dados.dias;
    var hoje = hojeIso();
    var chaves = Object.keys(dias).sort();
    function temServico(k) { return (dias[k].linhas || []).some(function (l) { return !RISCADA[l.origem] && l.origem !== 'afastamento'; }); }
    var proximo = chaves.filter(function (k) { return k >= hoje && temServico(k); })[0];
    if (proximo) return proximo;
    if (dias[hoje]) return hoje;
    return chaves.filter(function (k) { return (dias[k].linhas || []).length; })[0] || chaves[0] || null;
  }

  function nomeMes(d) { return MESES[d.getMonth()] + ' ' + d.getFullYear(); }

  /* o nome do mês e o Hoje (só fora do mês do dia de serviço de hoje) */
  function atualizarBarra() {
    var hoje = RW.data.diaDeServico();
    el.mesNome.textContent = nomeMes(estado.mes);
    el.mesHoje.classList.toggle('oculto', estado.mes.getFullYear() === hoje.getFullYear() && estado.mes.getMonth() === hoje.getMonth());
  }

  /* lê e desenha o mês (embaixo do véu: o mês anterior fica até o novo chegar); só a última leitura pedida
     desenha. A promessa sempre se cumpre, com falha também (a mensagem fica no lugar do calendário) */
  function carregarMes() {
    var pedido = ++estado.pedido;
    estado.dados = null;
    atualizarBarra();
    limparDia();
    var fim = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 0);
    return RW.rpc('inicio_calendario', { p_inicio: iso(estado.mes), p_fim: iso(fim) }).then(function (r) {
      if (pedido !== estado.pedido || !el.calendario.isConnected) return;
      if (!r || !r.dias) { estadoCalendario('tpl-escala-estado', RW.mensagens.inicio.falhaCarregar); return; }
      estado.dados = { dias: r.dias, unidades: r.unidades || {} };
      estado.selecionado = diaPadrao();
      desenharMes();
    }, function () {
      if (pedido !== estado.pedido || !el.calendario.isConnected) return;
      estadoCalendario('tpl-escala-estado', RW.mensagens.inicio.falhaCarregar);
    });
  }

  /* troca de mês: o véu cobre a tela até o mês novo chegar, como na troca de página (nada aparece em
     pedaços); só a última troca pedida tira o véu, e só se a página ainda é o Início */
  function irParaMes(d) {
    estado.mes = new Date(d.getFullYear(), d.getMonth(), 1);
    if (RW.mostrarVeu) RW.mostrarVeu(conteudo);
    var leitura = carregarMes();
    var meu = estado.pedido;
    leitura.then(function () {
      if (meu === estado.pedido && el.calendario.isConnected && RW.esconderVeu) RW.esconderVeu(conteudo);
    });
  }

  /* o clique (ou o toque) escolhe o dia; o resumo mostra as linhas dele */
  function aoClicarCalendario(e) {
    var botao = e.target.closest('.mini-calendario-dia');
    if (!botao || !estado.dados) return;
    selecionar(botao.dataset.iso);
  }

  /* ---------- resumo do dia escolhido ---------- */

  function limparDia() {
    el.diaTitulo.textContent = '';
    el.diaLinhas.textContent = '';
    el.diaVazio.classList.add('oculto');
    el.diaEscala.classList.add('oculto');
  }

  function selecionar(diaIso) {
    estado.selecionado = diaIso;
    Array.prototype.forEach.call(el.calendario.querySelectorAll('.mini-calendario-dia--selecionado'), function (b) {
      b.classList.remove('mini-calendario-dia--selecionado');
    });
    var botao = el.calendario.querySelector('.mini-calendario-dia[data-iso="' + diaIso + '"]');
    if (botao) botao.classList.add('mini-calendario-dia--selecionado');
    mostrarDia(diaIso);
  }

  /* o resumo: as linhas por unidade (o bloco do Calendário da Escala) e o botão do painel do dia */
  function mostrarDia(diaIso) {
    limparDia();
    if (!diaIso || !estado.dados) return;
    var d = dataDeIso(diaIso);
    var unidades = estado.dados.unidades;
    var dia = estado.dados.dias[diaIso] || { linhas: [] };
    var linhas = dia.linhas || [];
    el.diaTitulo.textContent = DIAS_CURTOS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    porUnidade(linhas).forEach(function (g) {
      var bloco = RW.tpl('tpl-escala-calendario-unidade');
      if (!bloco) return;
      bloco.querySelector('.escala-calendario-unidade-nome').textContent = (unidades[g.unidade] || {}).nome || '';
      preencherLinhas(bloco.querySelector('.escala-mes-celula'), g.linhas);
      marcarDia(bloco, g.unidade, diaIso, unidades);
      el.diaLinhas.appendChild(bloco);
    });
    el.diaVazio.classList.toggle('oculto', linhas.length > 0);
    var unidade = unidadeDoDia(dia);
    if (unidade) {
      marcarDia(el.diaEscala, unidade, diaIso, unidades);
      el.diaEscala.classList.remove('oculto');
    }
  }

  /* ---------- Legenda: os grupos da Legenda da Escala que aparecem no calendário ---------- */

  function montarLegenda() {
    var lugar = document.getElementById('inicio-legenda');
    var legenda = (lugar && RW.legenda) ? RW.legenda.montar(lugar) : null;
    var alvo = legenda && legenda.querySelector('[data-legenda-conteudo]');
    var molde = document.getElementById('tpl-escala-legenda');
    if (!alvo || !molde) return;
    ['origem', 'riscado'].forEach(function (nome) {
      var grupo = molde.content.querySelector('[data-legenda-grupo="' + nome + '"]');
      if (grupo) alvo.appendChild(grupo.cloneNode(true));
    });
  }

  /* ---------- o que cabe na tela ---------- */

  /* mostra os cartões da lista que cabem nela (ao lado do calendário, até o fim da tela; embaixo dele, os 3
     primeiros) e esconde o resto; o Ver todos aparece quando algum ficou de fora */
  function encaixarLista(lista, botao, aoLado) {
    if (!lista) return;
    var itens = Array.prototype.slice.call(lista.querySelectorAll('.inicio-aviso, .pedido--linha'));
    itens.forEach(function (c) { c.classList.remove('oculto'); });
    var limite = lista.getBoundingClientRect().bottom;
    var escondidos = 0, cheio = false;
    itens.forEach(function (c, i) {
      if (!cheio) cheio = aoLado ? c.getBoundingClientRect().bottom > limite + 1 : i >= LISTA_EMPILHADA;
      if (cheio) { c.classList.add('oculto'); escondidos++; }
    });
    if (botao) botao.classList.toggle('oculto', !escondidos);
  }

  /* ao lado do calendário, avisos e pendências dividem a altura da tela; embaixo dele (tela estreita ou
     celular), cada caixa tem a altura do que mostra */
  function encaixar() {
    if (!el.meio || !el.meio.isConnected) return;
    var aoLado = !celular() && Math.abs(el.meio.getBoundingClientRect().top - el.esquerda.getBoundingClientRect().top) < 4;
    el.meio.classList.toggle('inicio-meio--lado', aoLado);
    encaixarLista(el.avisos, el.avisosTodos, aoLado);
    encaixarLista(el.pendCaixa.querySelector('[data-pend-painel="' + pend.aba + '"]'), el.pendTodos, aoLado);
  }

  /* ---------- avisos ---------- */

  function vazio(container, texto) {
    container.textContent = '';
    var v = RW.tpl('tpl-inicio-vazio');
    if (v) { v.textContent = texto; container.appendChild(v); }
  }

  /* "Cap. Rocha · 20/10" */
  function metaAviso(a) {
    var autor = nomeDe(a.criado_por_grau, a.criado_por_nome);
    var d = a.criado_em ? new Date(a.criado_em) : null;
    var data = (d && !isNaN(d)) ? String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') : '';
    return [autor, data].filter(Boolean).join(' · ');
  }

  /* a caixa só aparece com comunicado ou para o admin; o Ver todos (N) aparece quando algum não cabe */
  function montarAvisos(avisos) {
    var admin = !!(RW.inicioAviso && RW.inicioAviso.ehAdmin());
    el.avisosCaixa.classList.toggle('oculto', !avisos.length && !admin);
    el.avisosTotal.textContent = String(avisos.length);
    el.avisosTodos.classList.add('oculto');
    if (!avisos.length) { vazio(el.avisos, RW.mensagens.avisos.semComunicados); encaixar(); return; }
    el.avisos.textContent = '';
    avisos.forEach(function (a) {
      var cartao = RW.tpl('tpl-inicio-aviso');
      if (!cartao) return;
      cartao.querySelector('.inicio-aviso-titulo').textContent = a.titulo || '';
      cartao.querySelector('.inicio-aviso-msg').textContent = a.mensagem || '';
      cartao.querySelector('.inicio-aviso-meta').textContent = metaAviso(a);
      var remover = cartao.querySelector('.inicio-aviso-remover');
      if (remover && RW.inicioAviso && RW.inicioAviso.podeDesativar(a)) {
        remover.classList.remove('oculto');
        remover.addEventListener('click', function () { RW.inicioAviso.desativar(a.aviso_id, carregarAvisos); });
      }
      el.avisos.appendChild(cartao);
    });
    encaixar();
  }

  /* a promessa sempre se cumpre, com falha também (a mensagem fica na caixa) */
  function carregarAvisos() {
    return RW.rpc('fn_avisos_listar', {})
      .then(function (a) { if (el.avisos.isConnected) montarAvisos(Array.isArray(a) ? a : []); })
      .catch(function () {
        if (!el.avisos.isConnected) return;
        el.avisosCaixa.classList.remove('oculto');
        vazio(el.avisos, RW.mensagens.inicio.falhaCarregar);
      });
  }

  /* ---------- pendências ---------- */

  /* um cartão da Pendências (geral-pedido) com o selo da situação; o clique leva aonde o assunto mora */
  function cartaoPendencia(nomeIcone, quem, meta, selo, aoClicar) {
    var c = RW.tpl('tpl-pedido-linha');
    if (!c) return null;
    var uso = c.querySelector('.pedido-linha-icone use');
    if (uso) uso.setAttribute('href', 'icones/icone-' + nomeIcone + '.svg#icone-' + nomeIcone);
    c.querySelector('.pedido-quem').textContent = quem;
    c.querySelector('.pedido-meta').textContent = meta || '';
    var s = c.querySelector('.pedido-linha-selo');
    s.textContent = selo.texto;
    s.classList.add(selo.classe);
    s.classList.remove('oculto');
    c.addEventListener('click', aoClicar);
    return c;
  }

  /* um pedido seu (em andamento ou resolvido): a frase, o dia e o selo com a situação; leva à página dele */
  function cartaoMeuPedido(p) {
    var M = RW.mensagens, mi = M.inicio, pe = M.pendencias;
    var outro = nomeDe(p.outro_grau, p.outro_nome);
    var resolvido = !p.andamento;
    var meta = pe.metaServico(RW.data.comDiaCurto(p.data), RW.fila.trecho(p.horario_inicio, p.horario_fim));
    if (p.tipo === 'troca') {
      var quem = p.alteracao ? mi.trocaAlteracao(outro)
        : (p.papel === 'solicitante' ? mi.trocaVoce(outro, resolvido) : mi.trocaOutro(outro, resolvido));
      return cartaoPendencia(ICONE_PEDIDO.troca, quem, meta, RW.trocasFormato.situacao(p.situacao, p.alteracao),
        function () { irPara('trocas', 'minhas'); });
    }
    if (p.tipo === 'folga') {
      return cartaoPendencia(ICONE_PEDIDO.folga, mi.folgaVoce, meta,
        { texto: M.folgas.situacao[p.situacao] || '', classe: RW.folgasFormato.situacaoClasse(p.situacao) },
        function () { irPara('folgas', 'minhas'); });
    }
    return cartaoPendencia(ICONE_PEDIDO.dados, mi.dadosVoce, pe.metaDados(p.alteracoes || 0, RW.data.isoParaBR(p.data)),
      { texto: mi.situacaoDados[p.situacao] || '', classe: SELO_DADOS[p.situacao] || 'selo--escuro' },
      function () { irPara('perfil'); });
  }

  /* um prazo seu (ex.: a extra do mês): leva aonde se responde */
  function cartaoPrazo(g) {
    return cartaoPendencia(g.tipo === 'extra_prazo' ? 'extrajornada' : 'alerta', g.texto || '', g.mensagem || '',
      { texto: RW.mensagens.inicio.seloPrazo, classe: 'selo--alerta' },
      function () { irPara(g.pagina, g.aba, g.referencia); });
  }

  /* o que o administrador precisa corrigir: os nomes ficam na página Pendências (ou a tela do conserto) */
  function cartaoCorrigir(g) {
    var mi = RW.mensagens.inicio;
    var meta = g.militares ? mi.metaMilitares(Number(g.contagem) || g.militares.length) : (g.mensagem || '');
    var selo = g.nivel === 'alerta' ? { texto: mi.seloRevisar, classe: 'selo--alerta' } : { texto: mi.seloCorrigir, classe: 'selo--erro' };
    return cartaoPendencia('alerta', g.texto || '', meta, selo, function () {
      if (g.pagina) irPara(g.pagina, g.aba);
      else irPara('pendencias', 'administracao');
    });
  }

  function preencher(lista, itens, montar) {
    lista.textContent = '';
    itens.forEach(function (x) { var c = montar(x); if (c) lista.appendChild(c); });
  }

  /* a fila da Pendências (abre o painel de decisão): vazia, nem aparece */
  function definirFila(fila, lista, pedidos) {
    lista.classList.toggle('oculto', !pedidos.length);
    if (!pedidos.length) { lista.textContent = ''; return; }
    if (fila) fila.definir(pedidos);
  }

  function escreverSelo(selo, n) {
    selo.textContent = n ? String(n) : '';
    selo.classList.toggle('oculto', !n);
  }

  /* o militar: uma lista só, com o título; o administrador: as abas, com o número do que depende dele (a
     mesma conta da página Pendências). A caixa só aparece quando há alguma coisa */
  function montarPendencias(fila, meus) {
    var admin = RW.sessao.temPapel('pelotao');
    var quanto = RW.avisosSino ? RW.avisosSino.quantoSoma : function () { return 0; };
    function somar(grupos) { return grupos.reduce(function (s, g) { return s + quanto(g); }, 0); }
    var temParaMim = fila.minhas.length + fila.prazos.length + meus.length > 0;
    var temAdmin = admin && fila.aprovar.length + fila.corrigir.length > 0;

    el.pendCaixa.classList.toggle('oculto', !temParaMim && !temAdmin);
    el.pendTitulo.classList.toggle('oculto', admin);
    el.pendAbas.classList.toggle('oculto', !admin);
    escreverSelo(el.pendContagemParaMim, fila.minhas.length + somar(fila.prazos));
    escreverSelo(el.pendContagemAdministracao, fila.aprovar.length + somar(fila.corrigir));

    definirFila(pend.filaMinhas, el.pendMinhas, fila.minhas);
    el.pendMeus.textContent = '';
    fila.prazos.forEach(function (g) { var c = cartaoPrazo(g); if (c) el.pendMeus.appendChild(c); });
    meus.forEach(function (p) { var c = cartaoMeuPedido(p); if (c) el.pendMeus.appendChild(c); });
    el.pendVazio.paramim.classList.toggle('oculto', temParaMim);

    if (admin) {
      definirFila(pend.filaAprovar, el.pendAprovar, fila.aprovar);
      preencher(el.pendCorrigir, fila.corrigir, cartaoCorrigir);
      el.pendVazio.administracao.classList.toggle('oculto', temAdmin);
    }
    encaixar();
  }

  /* o que espera a sua decisão e os prazos (a mesma leitura da Pendências) + os seus pedidos; só a última
     leitura pedida desenha; a promessa sempre se cumpre */
  function carregarPendencias() {
    var meu = ++pend.pedido;
    return Promise.all([
      RW.fila ? RW.fila.ler() : Promise.resolve(null),
      RW.rpc('inicio_meus_pedidos', {}).catch(function () { return null; })
    ]).then(function (r) {
      if (meu !== pend.pedido || !el.pendCaixa.isConnected) return;
      montarPendencias(r[0] || { minhas: [], aprovar: [], corrigir: [], prazos: [] }, Array.isArray(r[1]) ? r[1] : []);
    });
  }

  function trocarAba(aba) {
    pend.aba = aba;
    Array.prototype.forEach.call(el.pendCaixa.querySelectorAll('[data-pend-painel]'), function (p) {
      p.classList.toggle('oculto', p.getAttribute('data-pend-painel') !== aba);
    });
    encaixar();
  }

  function ligarPendencias() {
    var porId = function (id) { return document.getElementById(id); };
    el.pendCaixa = porId('inicio-pend-caixa');
    el.pendTitulo = porId('inicio-pend-titulo');
    el.pendAbas = porId('inicio-pend-abas');
    el.pendTodos = porId('inicio-pend-todos');
    el.pendContagemParaMim = porId('inicio-pend-paramim-contagem');
    el.pendContagemAdministracao = porId('inicio-pend-administracao-contagem');
    el.pendMinhas = porId('inicio-pend-minhas');
    el.pendMeus = porId('inicio-pend-meus');
    el.pendAprovar = porId('inicio-pend-aprovar');
    el.pendCorrigir = porId('inicio-pend-corrigir');
    el.pendVazio = {
      paramim: el.pendCaixa.querySelector('[data-pend-painel="paramim"] [data-pend-vazio]'),
      administracao: el.pendCaixa.querySelector('[data-pend-painel="administracao"] [data-pend-vazio]')
    };
    pend.aba = 'paramim';
    /* as filas abrem o painel de decisão no espaço do painel; depois de decidir, as pendências se releem */
    var opcoes = { situacao: true, recarregar: carregarPendencias };
    pend.filaMinhas = RW.fila ? RW.fila.criar(el.pendMinhas, opcoes) : null;
    pend.filaAprovar = (RW.fila && RW.sessao.temPapel('pelotao')) ? RW.fila.criar(el.pendAprovar, opcoes) : null;
    if (RW.abas) RW.abas.ligar(el.pendAbas, function (aba) { trocarAba(aba.getAttribute('data-pend')); });
    el.pendTodos.addEventListener('click', function () { irPara('pendencias', pend.aba); });
  }

  /* ---------- atalhos (computador) ---------- */

  /* Escala de hoje: o painel do dia de serviço de hoje (do mês na tela ou, fora dele, lido à parte) */
  function abrirHoje(botao) {
    var hoje = hojeIso();
    var dia = estado.dados && estado.dados.dias[hoje];
    if (dia) {
      if (unidadeDoDia(dia)) { marcarDia(botao, unidadeDoDia(dia), hoje, estado.dados.unidades); abrirPainel(botao); }
      return;
    }
    RW.rpc('inicio_calendario', { p_inicio: hoje, p_fim: hoje }).then(function (r) {
      var d = r && r.dias && r.dias[hoje];
      if (!d || !unidadeDoDia(d) || !botao.isConnected) return;
      marcarDia(botao, unidadeDoDia(d), hoje, r.unidades || {});
      abrirPainel(botao);
    }).catch(function () {});
  }

  function ligarAtalhos() {
    Array.prototype.forEach.call(document.querySelectorAll('.inicio-atalho'), function (b) {
      b.addEventListener('click', function () {
        var qual = b.getAttribute('data-atalho');
        if (qual === 'hoje') { abrirHoje(b); return; }
        var pagina = { troca: 'trocas', folga: 'folgas', extra: 'extrajornada' }[qual];
        if (pagina) irPara(pagina, null, 'solicitar');
      });
    });
  }

  /* o roteador tira o véu quando a promessa se cumpre: ela espera o mês, os avisos e as pendências, para a
     página aparecer inteira de uma vez */
  function iniciar(conteudoPagina) {
    var u = RW.sessao.perfil();
    if (!u || !u.ok) return Promise.resolve();
    conteudo = conteudoPagina || document.querySelector('.conteudo');

    function porId(id) { return document.getElementById(id); }
    el = {
      calendario: porId('inicio-calendario'), mesNome: porId('inicio-mes-nome'), mesHoje: porId('inicio-mes-hoje'),
      diaTitulo: porId('inicio-dia-titulo'), diaLinhas: porId('inicio-dia-linhas'), diaVazio: porId('inicio-dia-vazio'),
      diaEscala: porId('inicio-dia-escala'), avisosCaixa: porId('inicio-avisos-caixa'), avisos: porId('inicio-avisos'),
      avisosTodos: porId('inicio-avisos-todos'), avisosTotal: porId('inicio-avisos-total'),
      esquerda: document.querySelector('.inicio-esquerda'), meio: document.querySelector('.inicio-meio')
    };
    if (!el.calendario || !RW.rpc || !RW.obterToken || !RW.obterToken()) return Promise.resolve();

    estado.mes = new Date(RW.data.diaDeServico().getFullYear(), RW.data.diaDeServico().getMonth(), 1);
    estado.selecionado = null;

    /* a barra do mês: setas, Hoje e o nome, que abre a escolha do mês */
    porId('inicio-mes-anterior').addEventListener('click', function () { irParaMes(new Date(estado.mes.getFullYear(), estado.mes.getMonth() - 1, 1)); });
    porId('inicio-mes-proximo').addEventListener('click', function () { irParaMes(new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 1)); });
    el.mesHoje.addEventListener('click', function () { irParaMes(RW.data.diaDeServico()); });
    if (RW.calendario) RW.calendario.ligar(el.mesNome, {
      ancora: el.mesNome.closest('.geral-periodo'),
      obterModo: function () { return 'mes'; },
      obterData: function () { return estado.mes; },
      aoEscolher: irParaMes
    });
    montarLegenda();

    el.calendario.addEventListener('click', aoClicarCalendario);
    el.diaLinhas.addEventListener('click', function (e) { abrirPainel(e.target.closest('.escala-calendario-unidade')); });
    el.diaEscala.addEventListener('click', function () { abrirPainel(el.diaEscala); });
    var mes = carregarMes();

    /* os avisos: Ver todos leva aos Comunicados; o grupo Administração (Novo comunicado) só para o admin,
       e no celular é um menu (fecha antes de abrir o painel) */
    el.avisosTodos.addEventListener('click', function () { irPara('avisos', 'comunicados'); });
    var grupoAdmin = document.querySelector('#inicio-avisos-caixa .acoes-admin');
    var btnNovoAviso = porId('btn-novo-aviso');
    if (grupoAdmin && btnNovoAviso && RW.inicioAviso && RW.inicioAviso.ehAdmin()) {
      grupoAdmin.classList.remove('oculto');
      btnNovoAviso.addEventListener('click', function () {
        if (RW.fecharDropdowns) RW.fecharDropdowns();
        RW.inicioAviso.abrirNovo(carregarAvisos);
      });
    }
    var avisos = carregarAvisos();

    ligarPendencias();
    var pendencias = carregarPendencias();

    ligarAtalhos();
    /* a janela mudou de tamanho: refaz a conta do que cabe (liga uma vez só; vale só com o Início na tela) */
    if (!tamanhoLigado) {
      tamanhoLigado = true;
      window.addEventListener('resize', function () { encaixar(); });
    }
    return Promise.all([mes, avisos, pendencias]).then(encaixar);
  }

  RW.paginas.inicio = { iniciar: iniciar };
})();
