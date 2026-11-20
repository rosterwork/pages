/* ============================================================
   ESCALAS — a volta de férias ou de afastamento (só quem administra
   o pelotão). Quem volta sem guarnição (escala_voltas_pendentes, a
   mesma da Pendências), de 5 dias antes da volta até o administrador
   decidir:
   - a nota amarela no alto da Escala, uma por pelotão e dia, com o
     Simular a escala: o período passa a ser o da volta e o painel do
     dia abre na vista "volta", sem as abas. A Pendências abre a mesma
     vista pela referência ("volta|unidade|dia");
   - a vista do painel: a sugestão de guarnição (escala_volta_sugestao)
     vai para o rascunho das guarnições (escalas-painel-ciclo.js) e as
     telas mostram como fica (a prévia, com a borda tracejada). Caixa
     1, quem volta: a guarnição de cada um (o campo com a lista; trocar
     pede a conta de novo com as escolhas do administrador, e os outros
     se ajustam) e o dia em que entra; caixa 2, como ficam as
     guarnições (as colunas da aba Guarnições, com a conta por
     graduação); caixa 3, as mudanças de guarnição, com o porquê e a
     lixeira. Cada escolha é um passo do Desfazer do rodapé largo; o
     Salvar grava (escala_painel_salvar), o Cancelar descarta e a vista
     fecha nos dois (escalas-painel-salvar.js).
   A tela só desenha: a conta é do banco. No modo treino a nota não
   aparece.
   API: RosterWork.escalasPainelVolta.ligar(lugar, opcoes) ·
   atualizar() · pedida(referencia) · montar(corpo, rodape, unidadeId,
   iso) · reset()
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function M() { return RW.mensagens.escala.volta; }
  function C() { return RW.escalasPainelCiclo; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function noTreino() { return !!(RW.treino && RW.treino.ligado()); }

  /* ---------- a nota ---------- */

  var nota = null;     // { lugar, opcoes: { visivel(), unidades() ([{ id }]), irPara(iso, depois) } }
  var grupos = [];     // a última leitura: [{ unidade_id, unidade, dia, ferias, militares }]
  var lidas = '';      // as unidades da última leitura
  var leitura = 0;     // a última leitura vence
  var pedido = null;   // a volta pedida pela Pendências: { unidadeId, iso }

  /* as unidades na tela que chegam para ele (o admin de pelotão, só o pelotão dele) */
  function idsNaTela() {
    return nota ? (nota.opcoes.unidades() || []).map(function (u) { return Number(u.id); })
      .filter(function (id) { return !!RW.sessao && RW.sessao.acompanha(id); }) : [];
  }

  /* lê as voltas das unidades na tela que ele acompanha (o banco confere de novo a área) */
  function ler() {
    var ids = idsNaTela(), minha = ++leitura;
    lidas = ids.join(',');
    if (!ids.length || noTreino() || !(RW.sessao && RW.sessao.temPapel('pelotao'))) { grupos = []; desenharNota(); return; }
    RW.rpc('escala_voltas_pendentes', { p_unidades: ids }).catch(function () { return null; }).then(function (lista) {
      if (minha !== leitura) return;
      grupos = Array.isArray(lista) ? lista : [];
      desenharNota();
      abrirPedida();
    });
  }

  function desenharNota() {
    if (!nota || !document.contains(nota.lugar)) return;
    var lugar = nota.lugar, ids = idsNaTela();
    lugar.textContent = '';
    if (nota.opcoes.visivel() && !noTreino()) {
      grupos.forEach(function (g) {
        if (ids.indexOf(Number(g.unidade_id)) < 0) return;
        var el = RW.tpl('tpl-escala-volta-aviso');
        if (!el) return;
        el.querySelector('.nota-titulo').textContent = M().notaTitulo((g.militares || []).length, g.unidade, diaMes(g.dia), !!g.ferias);
        el.querySelector('.escala-volta-aviso-texto').textContent = M().notaTexto;
        el.querySelector('.escala-volta-simular').addEventListener('click', function () { simular(g); });
        lugar.appendChild(el);
      });
    }
    lugar.classList.toggle('oculto', !lugar.childElementCount);
  }

  /* o Simular a escala: o período da volta na tela e, com a grade, o painel do dia na vista da volta */
  function simular(g) {
    nota.opcoes.irPara(g.dia, function () { abrir(g); });
  }
  function abrir(g) {
    if (!RW.escalasPainel) return;
    RW.escalasPainel.abrirDia({ unidadeId: String(g.unidade_id), iso: g.dia, unidadeNome: g.unidade, unidadeCidade: '' }, 'volta');
  }
  /* a volta pedida pela Pendências abre quando a leitura a traz (a grade já abriu no mês dela) */
  function abrirPedida() {
    var p = pedido;
    if (!p) return;
    pedido = null;
    var g = grupos.filter(function (x) { return String(x.unidade_id) === p.unidadeId && x.dia === p.iso; })[0];
    if (g) abrir(g);
  }

  /* a página diz o lugar da nota; opcoes = { visivel(), unidades(), irPara(iso, depois) } */
  function ligar(lugar, opcoes) {
    nota = { lugar: lugar, opcoes: opcoes };
    ler();
  }
  /* o período, o modo ou as unidades mudaram: as unidades novas leem de novo; senão, só desenha */
  function atualizar() {
    if (!nota) return;
    if (idsNaTela().join(',') !== lidas) ler();
    else desenharNota();
  }
  /* a referência da Pendências ("volta|143|2026-12-01"): guarda o pedido e devolve a data, para a Escala abrir no mês */
  function pedida(referencia) {
    var p = String(referencia || '').split('|');
    if (p[0] !== 'volta' || p.length !== 3) return null;
    pedido = { unidadeId: p[1], iso: p[2] };
    var d = p[2].split('-');
    return { data: new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2])) };
  }

  /* gravou: as voltas resolvidas saem da nota */
  window.addEventListener('rosterwork_escala_salva', function () { if (nota && document.contains(nota.lugar)) ler(); });

  /* ---------- a vista do painel ---------- */

  var ctx = null;   // { corpo, unidadeId, iso, dados, chave, pedido }

  /* o que está no rascunho das guarnições pela volta: as escolhas que reproduzem a tela ({ voltam, mudancas }), as de quem
     o administrador escolheu (escolhidos) e se há alguma */
  function doRascunho() {
    var voltam = {}, escolhidos = {}, mudancas = [], algum = false;
    C().doDia(ctx.unidadeId, ctx.iso).forEach(function (x) {
      if (!x.volta) return;
      algum = true;
      if (x.tipo === 'entrar') { voltam[x.cpf] = x.letra; if (x.escolhido) escolhidos[x.cpf] = x.letra; }
      else mudancas.push({ cpf: x.cpf, para: x.letra });
    });
    return { escolhas: { voltam: voltam, mudancas: mudancas }, escolhidos: escolhidos, algum: algum };
  }
  /* as escolhas sempre na mesma ordem, para comparar */
  function chaveDe(escolhas) {
    var voltam = {};
    Object.keys(escolhas.voltam).sort().forEach(function (k) { voltam[k] = escolhas.voltam[k]; });
    var mudancas = escolhas.mudancas.slice().sort(function (a, b) { return a.cpf < b.cpf ? -1 : 1; });
    return JSON.stringify({ voltam: voltam, mudancas: mudancas });
  }
  function escolhasDe(d) {
    var voltam = {};
    (d.voltam || []).forEach(function (v) { voltam[v.cpf] = v.letra; });
    return { voltam: voltam, mudancas: (d.mudancas || []).map(function (m) { return { cpf: m.cpf, para: m.para }; }) };
  }

  /* a sugestão no rascunho: cada um que volta entra na guarnição dele (a data é a da entrada) e cada mudança muda a partir
     da data dela; a mudança da volta que saiu da conta sai do rascunho */
  function listaDe(d) {
    var lista = (d.voltam || []).map(function (v) {
      return { cpf: v.cpf, mudanca: { cpf: v.cpf, acao: 'adicionar', tipo: 'entrar', letra: v.letra, data: v.entra_em, itens: [],
        volta: true, escolhido: !!v.escolhido } };
    });
    var novas = {};
    (d.mudancas || []).forEach(function (m) {
      novas[m.cpf] = true;
      lista.push({ cpf: m.cpf, mudanca: { cpf: m.cpf, acao: 'adicionar', tipo: 'mudar', letra: m.para, data: m.data, itens: [], volta: true } });
    });
    C().doDia(ctx.unidadeId, ctx.iso).forEach(function (x) {
      if (x.volta && x.tipo === 'mudar' && !novas[x.cpf]) lista.push({ cpf: x.cpf, mudanca: null });
    });
    return lista;
  }

  /* pede a sugestão; modo: 'preencher' (a primeira, fora do Desfazer), 'passo' (a escolha do administrador) ou nada (só
     mostra o rascunho como está). Enquanto lê, a vista fica apagada */
  function pedir(escolhas, modo) {
    var c = ctx, meu = ++c.pedido;
    if (c.dados) { c.corpo.classList.add('painel-corpo--refazendo'); c.corpo.inert = true; }
    var leituraSugestao = RW.rpc('escala_volta_sugestao', { p_unidade_id: Number(c.unidadeId), p_dia: c.iso, p_escolhas: escolhas })
      .catch(function () { return null; });
    (c.dados ? leituraSugestao : RW.painel.segurar(leituraSugestao)).then(function (d) {
      if (ctx !== c || meu !== c.pedido) return;
      c.corpo.classList.remove('painel-corpo--refazendo');
      c.corpo.inert = false;
      if (!d || !d.ok) { falha(d && d.erro); return; }
      c.dados = d;
      c.chave = chaveDe(escolhasDe(d));
      if (modo === 'preencher') C().porVarias(c.unidadeId, c.iso, listaDe(d));
      else if (modo === 'passo') C().passoVarios(c.unidadeId, c.iso, listaDe(d));
      else {
        /* quem volta e saiu do rascunho por outro caminho volta a ele, na guarnição da conta */
        var falta = (d.voltam || []).filter(function (v) { return !C().marcado(c.unidadeId, c.iso, v.cpf); });
        if (falta.length) C().porVarias(c.unidadeId, c.iso, listaDe({ voltam: falta, mudancas: d.mudancas }));
      }
      desenhar();
    });
  }

  /* o administrador troca a guarnição de quem volta: valem as escolhas dele, e a conta ajusta os outros e as mudanças */
  function escolher(cpf, letra) {
    var r = doRascunho(), voltam = r.escolhidos;
    voltam[cpf] = letra;
    pedir({ voltam: voltam }, 'passo');
  }
  /* a lixeira: a mudança sai do rascunho (um passo do Desfazer); a vista lê de novo pelo aviso do rascunho */
  function tirar(cpf) { C().passoVarios(ctx.unidadeId, ctx.iso, [{ cpf: cpf, mudanca: null }]); }

  /* o rascunho mudou (uma escolha, a lixeira, o Desfazer ou o Refazer): a vista mostra o que ficou */
  window.addEventListener('rosterwork_escala_rascunho', function (e) {
    if (!ctx || !ctx.dados || !e.detail || e.detail.parte !== 'ciclo') return;
    var r = doRascunho();
    if (!r.algum || chaveDe(r.escolhas) === ctx.chave) return;
    pedir(r.escolhas, null);
  });

  /* ---------- o desenho ---------- */

  function nomeEm(el, m) {
    el.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    el.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
  }

  function quemVolta(lugar, d) {
    d.voltam.forEach(function (v) {
      var linha = RW.tpl('tpl-escala-volta-militar');
      if (!linha) return;
      nomeEm(linha, v);
      linha.querySelector('.campo-selecao-texto').textContent = M().guarnicao(v.letra);
      linha.querySelector('.campo-selecao').setAttribute('aria-label', M().guarnicao(v.letra) + ', ' + nomeDe(v));
      var menu = linha.querySelector('.dropdown-menu');
      d.colunas.forEach(function (col) {
        var it = RW.tpl('tpl-escala-unidade-item');
        if (!it) return;
        it.textContent = M().guarnicao(col.letra);
        it.addEventListener('click', function () { if (col.letra !== v.letra) escolher(v.cpf, col.letra); });
        menu.appendChild(it);
      });
      linha.querySelector('.escala-volta-entra').textContent = M().entraEm(diaMes(v.entra_em));
      lugar.appendChild(linha);
    });
  }

  function marcaDe(m) {
    if (m.marca === 'volta') return M().marcaVolta(m.motivo, diaMes(m.entra_em));
    if (m.marca === 'vem') return M().marcaVem(m.de, diaMes(m.entra_em));
    if (m.marca === 'sai') return M().marcaSai(m.para, diaMes(m.entra_em));
    return '';
  }

  function colunas(lugar, d) {
    var G = RW.mensagens.escala.guarnicoes;
    d.colunas.forEach(function (col) {
      var el = RW.tpl('tpl-escala-guarnicoes-coluna');
      if (!el) return;
      el.querySelector('.escala-guarnicoes-coluna-letra').textContent = col.letra;
      el.querySelector('.escala-guarnicoes-coluna-conta').textContent = String(col.conta);
      var lista = el.querySelector('.escala-guarnicoes-coluna-lista');
      if (!col.militares.length) {
        var v = RW.tpl('tpl-escala-guarnicoes-vazio');
        if (v) { v.textContent = G.colunaVazia; lista.appendChild(v); }
      }
      col.militares.forEach(function (m) {
        var n = RW.tpl('tpl-escala-guarnicoes-nome');
        if (!n) return;
        nomeEm(n, m);
        var texto = marcaDe(m), marca = n.querySelector('.escala-guarnicoes-marca');
        if (m.marca) n.classList.add(m.marca === 'sai' ? 'escala-guarnicoes-nome--sai' : 'escala-guarnicoes-nome--entra');
        marca.textContent = texto;
        marca.classList.toggle('oculto', !texto);
        lista.appendChild(n);
      });
      var conta = RW.tpl('tpl-escala-volta-conta');
      if (conta) { conta.textContent = M().contaGrad(col.sgt, col.cb, col.sd); el.appendChild(conta); }
      lugar.appendChild(el);
    });
  }

  function mudancas(el, d) {
    var lista = d.mudancas || [], porque = el.querySelector('.escala-volta-porque'), nenhuma = el.querySelector('.escala-volta-nenhuma');
    var lugar = el.querySelector('.escala-volta-mudancas');
    if (!lista.length) {
      var cols = d.colunas, igual = cols.every(function (c) { return c.conta === cols[0].conta && c.sgt === cols[0].sgt; });
      nenhuma.textContent = d.desequilibrio ? M().nenhumaSemQuem
        : igual && cols.length ? M().nenhumaIgual(cols.length, cols[0].conta, cols[0].sgt) : M().nenhumaPerto;
      nenhuma.classList.remove('oculto');
      return;
    }
    porque.querySelector('.nota-texto').textContent = lista.length === 1 ? M().porque(lista[0].de, lista[0].para, lista[0].porque) : M().porqueVarias;
    porque.classList.remove('oculto');
    lista.forEach(function (m) {
      var linha = RW.tpl('tpl-escala-volta-mudanca');
      if (!linha) return;
      nomeEm(linha, m);
      linha.querySelector('.escala-volta-mudanca-datas').textContent = M().mudanca(m.de, m.para, diaMes(m.ultimo), diaMes(m.entra_em));
      var lixeira = linha.querySelector('.escala-volta-tirar');
      lixeira.setAttribute('aria-label', M().tirarMudanca(nomeDe(m)));
      lixeira.addEventListener('click', function () { tirar(m.cpf); });
      lugar.appendChild(linha);
    });
  }

  function titulos(d) {
    var p = RW.escalasPainel.contexto(), unidade = ((p && p.unidadeNome) || '').split('/').pop().trim();
    RW.painel.definirTitulos(M().titulo(!d || d.ferias), M().subtitulo(unidade, diaMes(ctx.iso), d ? d.voltam.length : 2), '');
  }

  function desenhar() {
    var c = ctx, d = c.dados, rolagem = c.corpo.scrollTop;
    titulos(d);
    c.corpo.textContent = '';
    if (!(d.voltam || []).length) {
      var vazio = RW.painel.criarEstado(M().vazio);
      if (vazio) c.corpo.appendChild(vazio);
      return;
    }
    var el = RW.tpl('tpl-escala-volta');
    if (!el) return;
    quemVolta(el.querySelector('.escala-volta-quem'), d);
    colunas(el.querySelector('.escala-volta-colunas'), d);
    mudancas(el, d);
    c.corpo.appendChild(el);
    c.corpo.scrollTop = rolagem;
  }

  function falha(erro) {
    ctx.corpo.textContent = '';
    var e = RW.painel.criarEstado(erro || RW.mensagens.escala.falhaCarregar);
    if (e) ctx.corpo.appendChild(e);
  }

  /* ---------- montar ---------- */

  /* a vista abre com o rascunho da volta que já existe (a vista reaberta) ou com a sugestão nova; o rodapé é o do Salvar do
     painel */
  function montar(corpo, rodape, unidadeId, iso) {
    reset();
    ctx = { corpo: corpo, unidadeId: String(unidadeId), iso: iso, dados: null, chave: '', pedido: 0 };
    if (rodape && RW.escalasPainelSalvar) RW.escalasPainelSalvar.rodape(rodape);
    titulos(null);
    corpo.textContent = '';
    var carregando = RW.painel.criarCarregando();
    if (carregando) corpo.appendChild(carregando);
    var r = doRascunho();
    pedir(r.algum ? r.escolhas : null, r.algum ? null : 'preencher');
  }

  function reset() {
    if (!ctx) return;
    ctx.corpo.classList.remove('painel-corpo--refazendo');
    ctx.corpo.inert = false;
    ctx = null;
  }

  RW.escalasPainelVolta = { ligar: ligar, atualizar: atualizar, pedida: pedida, montar: montar, reset: reset };
})();
