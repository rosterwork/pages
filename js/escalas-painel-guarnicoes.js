/* ============================================================
   ESCALA — painel do dia › aba GUARNIÇÕES (a seção "continuos"; só
   admin). As guarnições da unidade a partir do dia aberto, em
   períodos iguais para todas (escala_guarnicoes_listar): um período
   começa em todo dia em que alguém entra ou sai de uma guarnição (a
   entrada e a saída da escala, a mudança de guarnição, o começo e a
   volta de férias, licença ou dispensa, e a transferência), até 90
   dias à frente.
   - Cada período é uma caixa que abre e fecha. No título, as datas,
     o selo Hoje (o período do dia de serviço de hoje), o selo Novo (o
     período que o rascunho mexeu), quantos tem cada guarnição e,
     embaixo, o que mudou desde o período de antes. Dentro, as
     guarnições lado a lado (no primeiro período, a de serviço no dia
     aberto com a borda escura): em verde quem entra, volta ou vem de
     outra guarnição, riscado em vermelho quem sai, com a marca embaixo
     do nome; e a faixa de quem está afastado, com a data da volta. O
     primeiro período vem aberto e o mexido pelo rascunho abre sozinho;
     o que o admin abriu ou fechou fica assim até outro dia.
   - No fim, o Fora da escala do dia aberto (quem entra numa guarnição
     entra pelo Adicionar militar, na guarnição do dia).
   Sem o dia da guarnição A da companhia, o aviso no topo e as colunas
   sem letra (no lugar dela, o primeiro dia de cada uma no período).
   A aba é para ver: o único lápis é o Cancelar a saída de quem saiu
   à mão (escalas-painel-guarnicoes-acoes.js), que marca no rascunho
   das guarnições (escalas-painel-ciclo.js); a lista mostra como fica
   (a prévia do banco; enquanto ela lê, a lista fica apagada, com a
   frase por cima). O Desfazer e o Refazer do rodapé largo voltam cada
   passo (escalas-painel-salvar.js), e o Salvar do rodapé grava.
   API: RosterWork.escalasPainelGuarnicoes.montar(corpo, rodape,
   unidadeId, iso), reset(), contexto() ({ unidadeId, iso, dados }),
   verificar() (o próximo passo da aba confere a prévia),
   primeiroDia(dados, indice, desde) e periodoDe(dados, data).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* { corpo, unidadeId, iso, dados, pedido, mexidos, apagada, verificar } */
  var ctx = null;
  var abertos = { chave: '', mapa: {} };   // os períodos que o admin abriu ou fechou (início: true ou false), por unidade e dia

  function msg() { return RosterWork.mensagens.escala.guarnicoes; }
  function C() { return RosterWork.escalasPainelCiclo; }
  function A() { return RosterWork.escalasPainelGuarnicoesAcoes; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* ---------- as datas e as guarnições ---------- */

  function emDias(iso) { var p = String(iso).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function deDias(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }

  /* o primeiro dia de serviço da guarnição (a coluna indice) na data desde ou depois */
  function primeiroDia(d, indice, desde) {
    var g = (d.guarnicoes || [])[indice], n = d.intervalo || 1;
    if (!g || !(g.proximos || []).length) return desde;
    var base = emDias(g.proximos[0]), x = emDias(desde);
    return deDias(x + (((base - x) % n) + n) % n);
  }

  /* o período que tem a data (antes do primeiro, o primeiro; depois do último, o último) */
  function periodoDe(d, data) {
    var lista = d.periodos || [];
    return lista.filter(function (p) { return p.inicio <= data && (!p.fim || data <= p.fim); })[0]
      || (lista.length && data < lista[0].inicio ? lista[0] : lista[lista.length - 1]) || null;
  }

  function letraDe(d, indice) { var g = (d.guarnicoes || [])[indice]; return g ? g.letra : null; }
  function ficam(m) { return m.marca !== 'sai'; }

  /* ---------- as marcas ---------- */

  function textoMarca(m) {
    var M = msg();
    if (m.marca === 'entra') return M.marcaEntra(m.motivo);
    if (m.marca === 'volta') return M.marcaVolta(m.motivo, m.de);
    if (m.marca === 'vem') return M.marcaVem(m.de);
    if (m.marca === 'sai') return M.marcaSai(m.motivo, m.para);
    return '';
  }

  /* o que mudou no período, por tipo e por guarnição, para o resumo do título */
  function marcas(d, p) {
    var r = { entra: [], chega: [], volta: {}, muda: [], sai: {} };
    function por(lista, letra, nome) {
      var g = lista.filter(function (x) { return x.letra === letra; })[0];
      if (!g) { g = { letra: letra, nomes: [] }; lista.push(g); }
      g.nomes.push(nome);
    }
    (p.colunas || []).forEach(function (col) {
      var letra = letraDe(d, col.indice);
      col.militares.forEach(function (m) {
        if (m.marca === 'entra') por(m.motivo === 'transferencia' ? r.chega : r.entra, letra, m.nome);
        else if (m.marca === 'volta') por(r.volta[m.motivo] = r.volta[m.motivo] || [], letra, m.nome);
        else if (m.marca === 'vem') r.muda.push({ nome: m.nome, de: m.de, para: letra });
        /* quem vai para outra guarnição já está no "Muda de guarnição" */
        else if (m.marca === 'sai' && m.motivo) por(r.sai[m.motivo] = r.sai[m.motivo] || [], letra, m.nome);
      });
    });
    return r;
  }

  /* as saídas da escala de cada um, na lista (o começo do período em que ele sai): { cpf: [datas] } */
  function saidasDe(d) {
    var r = {};
    (d.periodos || []).forEach(function (p) {
      (p.colunas || []).forEach(function (col) {
        col.militares.forEach(function (m) {
          if (m.marca === 'sai' && m.motivo === 'saida') (r[m.cpf] = r[m.cpf] || []).push(p.inicio);
        });
      });
    });
    return r;
  }

  /* ---------- o desenho ---------- */

  function vazio(lugar, texto) {
    var v = RosterWork.tpl('tpl-escala-guarnicoes-vazio');
    if (v) { v.textContent = texto; lugar.appendChild(v); }
  }

  function linhaNome(m) {
    var el = RosterWork.tpl('tpl-escala-guarnicoes-nome');
    if (!el) return null;
    el.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    el.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    if (m.marca) el.classList.add(m.marca === 'sai' ? 'escala-guarnicoes-nome--sai' : 'escala-guarnicoes-nome--entra');
    var marca = el.querySelector('.escala-guarnicoes-marca'), texto = textoMarca(m);
    marca.textContent = texto;
    marca.classList.toggle('oculto', !texto);
    el.setAttribute('data-cpf', m.cpf);
    el.setAttribute('data-marca', m.marca || '');
    return el;
  }

  function coluna(d, p, i, col, o) {
    var el = RosterWork.tpl('tpl-escala-guarnicoes-coluna');
    if (!el) return null;
    var letra = letraDe(d, col.indice), cab = el.querySelector('.escala-guarnicoes-coluna-letra');
    cab.textContent = letra || diaMes(primeiroDia(d, col.indice, p.inicio));
    cab.classList.toggle('escala-guarnicoes-coluna-letra--data', !letra);
    el.querySelector('.escala-guarnicoes-coluna-conta').textContent = String(col.militares.filter(ficam).length);
    var doDia = i === 0 && col.indice === d.indice_do_dia;
    el.classList.toggle('escala-guarnicoes-coluna--dia', doDia);
    if (letra) el.setAttribute('data-letra', letra);
    var lista = el.querySelector('.escala-guarnicoes-coluna-lista');
    if (!col.militares.length) vazio(lista, msg().colunaVazia);
    col.militares.forEach(function (m) {
      var linha = linhaNome(m);
      if (!linha) return;
      if (A()) {
        A().lapis(linha, { periodo: p, indice: col.indice, letra: letra, militar: m,
          saida: (o.saidas[m.cpf] || []).filter(function (s) { return s >= p.inicio; })[0] || null });
      }
      lista.appendChild(linha);
    });
    return el;
  }

  /* a faixa de quem está afastado, uma por motivo: por data da volta e, dentro dela, por guarnição */
  function faixas(p) {
    var porMotivo = {}, ordem = [];
    (p.afastados || []).forEach(function (f) {
      if (!porMotivo[f.motivo]) { porMotivo[f.motivo] = []; ordem.push(f.motivo); }
      var blocos = porMotivo[f.motivo], ate = diaMes(f.ate);
      var b = blocos.filter(function (x) { return x.ate === ate; })[0];
      if (!b) { b = { ate: ate, grupos: [] }; blocos.push(b); }
      var g = b.grupos.filter(function (x) { return x.letra === f.guarnicao; })[0];
      if (!g) { g = { letra: f.guarnicao, nomes: [] }; b.grupos.push(g); }
      g.nomes.push(f.nome);
    });
    return ordem.map(function (motivo) {
      var el = RosterWork.tpl('tpl-escala-guarnicoes-afastados');
      if (!el) return null;
      el.querySelector('.escala-guarnicoes-afastados-rotulo').textContent = msg().afastadosRotulo[motivo] || motivo;
      el.querySelector('.escala-guarnicoes-afastados-texto').textContent = msg().afastados(porMotivo[motivo]);
      return el;
    }).filter(Boolean);
  }

  function periodo(d, p, i, o) {
    var el = RosterWork.tpl('tpl-escala-guarnicoes-periodo');
    if (!el) return null;
    var q = function (s) { return el.querySelector(s); };
    el.setAttribute('data-inicio', p.inicio);
    q('.escala-guarnicoes-periodo-datas').textContent = msg().periodo(diaMes(p.inicio), p.fim ? diaMes(p.fim) : '');
    q('.escala-guarnicoes-periodo-hoje').classList.toggle('oculto', !(p.inicio <= o.hoje && (!p.fim || o.hoje <= p.fim)));
    var mexido = (p.colunas || []).some(function (col) {
      return col.militares.some(function (m) { return !!m.marca && !!o.noRascunho[m.cpf]; });
    });
    q('.escala-guarnicoes-periodo-novo').classList.toggle('oculto', !mexido);
    o.mexidos[p.inicio] = mexido;
    q('.escala-guarnicoes-periodo-contas').textContent = msg().contas((p.colunas || []).map(function (col) {
      return msg().conta(letraDe(d, col.indice), col.militares.filter(ficam).length);
    }));
    var resumo = q('.escala-guarnicoes-periodo-resumo'), texto = msg().resumo(marcas(d, p));
    resumo.textContent = texto;
    resumo.classList.toggle('oculto', !texto);
    /* aberto: como o admin deixou; sem isso, só o primeiro. O mexido agora pelo rascunho abre */
    if (mexido && !(ctx.mexidos && ctx.mexidos[p.inicio])) abertos.mapa[p.inicio] = true;
    var guardado = abertos.mapa[p.inicio], cab = q('.grupo-caixa-cabecalho');
    cab.setAttribute('aria-expanded', (guardado != null ? guardado : i === 0) ? 'true' : 'false');
    /* o clique abre ou fecha pela caixa do painel (que roda depois deste): guarda o estado que vai ficar */
    cab.addEventListener('click', function () { abertos.mapa[p.inicio] = cab.getAttribute('aria-expanded') !== 'true'; });
    var colunas = q('.escala-guarnicoes-colunas');
    (p.colunas || []).forEach(function (col) { var c = coluna(d, p, i, col, o); if (c) colunas.appendChild(c); });
    var corpo = q('.grupo-caixa-corpo');
    faixas(p).forEach(function (f) { corpo.appendChild(f); });
    return el;
  }

  /* o Fora da escala do dia aberto: a situação de cada um (só para ver) */
  function fora(d) {
    var lista = d.fora || [];
    var caixa = RosterWork.painel.criarCaixa(msg().fora(lista.length));
    if (!caixa) return null;
    caixa.classList.add('escala-guarnicoes-fora');
    if (!lista.length) { vazio(caixa, msg().foraVazio); return caixa; }
    lista.forEach(function (m) {
      var el = RosterWork.tpl('tpl-escala-guarnicoes-fora-item');
      if (!el) return;
      el.setAttribute('data-cpf', m.cpf);
      el.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
      el.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
      el.querySelector('.escala-guarnicoes-fora-info').textContent = m.entra_em ? msg().foraEntra(m.entra_guarnicao, diaMes(m.entra_em))
        : m.afastamento ? RosterWork.mensagens.escala.linha.infoAfastado(m.afastamento.motivo, diaMes(m.afastamento.ate))
        : m.desde ? msg().foraDesde(diaMes(m.desde)) : '';
      caixa.appendChild(el);
    });
    return caixa;
  }

  function desenhar() {
    var c = ctx, d = c.dados, corpo = c.corpo, rolagem = corpo.scrollTop;
    corpo.textContent = '';
    if (!d.referencia) {
      var aviso = RosterWork.tpl('tpl-escala-guarnicoes-aviso');
      if (aviso) { aviso.querySelector('.nota-texto').textContent = msg().semLetra; corpo.appendChild(aviso); }
    }
    var noRascunho = {};
    C().doDia(c.unidadeId, c.iso).forEach(function (x) { noRascunho[x.cpf] = true; });
    var o = { noRascunho: noRascunho, hoje: RosterWork.data.paraIsoDeData(RosterWork.data.diaDeServico()), saidas: saidasDe(d), mexidos: {} };
    (d.periodos || []).forEach(function (p, i) {
      var el = periodo(d, p, i, o);
      if (el) corpo.appendChild(el);
    });
    c.mexidos = o.mexidos;
    var caixaFora = fora(d);
    if (caixaFora) corpo.appendChild(caixaFora);
    corpo.scrollTop = rolagem;
  }

  /* ---------- a leitura ---------- */

  /* a lista na tela espera a prévia: fica, apagada e sem responder, com a frase por cima (como o Dia) */
  function apagar() {
    if (!ctx || ctx.apagada) return;
    var corpo = ctx.corpo, caixa = RosterWork.tpl('tpl-painel-etapa');
    if (!caixa) return;
    corpo.classList.add('painel-corpo--refazendo');
    corpo.inert = true;
    corpo.setAttribute('aria-busy', 'true');
    corpo.insertBefore(caixa, corpo.firstChild);
    ctx.apagada = { caixa: caixa, frase: RosterWork.etapas.linha(caixa.querySelector('.painel-etapa-caixa'), 'previaGuarnicoes') };
  }
  function acender() {
    if (!ctx || !ctx.apagada) return;
    var a = ctx.apagada;
    ctx.apagada = null;
    a.frase.parar();
    a.caixa.remove();
    ctx.corpo.classList.remove('painel-corpo--refazendo');
    ctx.corpo.inert = false;
    ctx.corpo.removeAttribute('aria-busy');
  }

  function falha() {
    ctx.corpo.textContent = '';
    var e = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (e) { e.textContent = RosterWork.mensagens.escala.falhaCarregar; ctx.corpo.appendChild(e); }
  }

  /* lê as guarnições (com o rascunho, a prévia); a mais nova vale. A prévia que o banco recusa avisa e, se a mudança foi
     desta aba, o passo volta */
  function ler() {
    var c = ctx;
    if (!c) return;
    var meu = ++c.pedido;
    if (c.dados) apagar();
    else {
      c.corpo.textContent = '';
      var carregando = RosterWork.painel.criarCarregando();
      if (carregando) c.corpo.appendChild(carregando);
    }
    RosterWork.painel.segurar(RosterWork.escalasDados.guarnicoesListar(c.unidadeId, c.iso)).then(function (d) {
      if (ctx !== c || meu !== c.pedido) return;
      acender();
      var verificar = c.verificar;
      c.verificar = false;
      if (!d || !d.ok) { falha(); return; }
      if (d.erro_simulacao) {
        RosterWork.avisar({ tipo: 'erro', mensagem: d.erro_simulacao });
        if (verificar && d.erro_parte === 'ciclo' && C().podeDesfazer(c.unidadeId, c.iso)) { C().desfazer(); return; }
      }
      c.dados = d;
      desenhar();
      if (RosterWork.escalasPainel.mostrarGuarnicao) RosterWork.escalasPainel.mostrarGuarnicao(c.unidadeId, c.iso, d.letra_do_dia);
    });
  }

  /* o rascunho das guarnições mudou (um passo, o Desfazer ou o Refazer do rodapé largo, o Salvar): a lista lê de novo */
  window.addEventListener('rosterwork_escala_rascunho', function (e) {
    if (!ctx || !e.detail || e.detail.parte !== 'ciclo') return;
    ler();
  });

  /* ---------- montar ---------- */

  /* o rodapé é o do Salvar do painel (as mudanças de todas as abas) */
  function montar(corpo, rodape, unidadeId, iso) {
    reset();
    ctx = { corpo: corpo, unidadeId: unidadeId, iso: iso, dados: null, pedido: 0, mexidos: null, apagada: null, verificar: false };
    var chave = unidadeId + '|' + iso;   // outro dia (ou outra unidade): os períodos voltam ao padrão
    if (abertos.chave !== chave) abertos = { chave: chave, mapa: {} };
    if (rodape && RosterWork.escalasPainelSalvar) RosterWork.escalasPainelSalvar.rodape(rodape);
    else if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    ler();
  }

  function reset() {
    if (!ctx) return;
    acender();
    ctx = null;
  }

  window.RosterWork.escalasPainelGuarnicoes = {
    montar: montar, reset: reset,
    contexto: function () { return ctx && ctx.dados ? { unidadeId: ctx.unidadeId, iso: ctx.iso, dados: ctx.dados } : null; },
    verificar: function () { if (ctx) ctx.verificar = true; },
    primeiroDia: primeiroDia, periodoDe: periodoDe
  };
})();
