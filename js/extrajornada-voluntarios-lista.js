/* ============================================================
   EXTRAJORNADA — aba Voluntários (desenho)
   A faixa de números, a lista em blocos por unidade (padrão de
   blocos: unidade = bloco cinza, linhas num bloquinho branco, sem
   traços), as listas de quem não é voluntário e de quem não
   respondeu, a busca e o painel com a solicitação do militar
   (caixas e frases). Os dados e o salvar ficam em
   extrajornada-voluntarios.js, que chama este módulo.
   Não cria HTML (clona moldes) nem escreve estilo (só classList e
   textContent).
   RosterWork.extrajornadaVoluntariosLista.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var ref = { estado: null, el: null, acoes: null };   // o último desenho (a busca e o painel releem daqui)
  var busca = { termo: '', modo: 'marcar' };
  var buscaCtrl = null;

  function msg() { return RW.mensagens.extrajornada.voluntarios; }
  function admin() { return RosterWork.sessao.temPapel('pelotao'); }   // a Extrajornada é uma coisa só da companhia: qualquer admin dela
  function tpl(id) { return RosterWork.tpl(id); }
  function soma(arr, f) { var s = 0; arr.forEach(function (x) { s += f(x) || 0; }); return s; }
  function unidade(estado, uid) { for (var i = 0; i < estado.unidades.length; i++) if (estado.unidades[i].unidade_id === uid) return estado.unidades[i]; return null; }

  /* ordem dentro do bloco: quem nunca foi tratado, quem ficou com zero, depois a ordem do banco (taxa, antiguidade) */
  function ordenar(vs) {
    function faixa(v) { return v.novo ? 0 : (v.concedido === 0 ? 1 : 2); }
    return vs.slice().sort(function (a, b) { return (faixa(a) - faixa(b)) || (a.ordem - b.ordem); });
  }

  function estadoTexto(texto) {
    var p = tpl('tpl-extra-estado');
    if (p) p.textContent = texto;
    return p;
  }
  function carregando(el) {
    if (!el.lista) return;
    el.lista.textContent = '';
    var c = tpl('tpl-painel-carregando');
    if (c) el.lista.appendChild(c);
  }
  function mostrarEstado(el, texto) {
    if (!el.lista) return;
    el.lista.textContent = '';
    var p = estadoTexto(texto);
    if (p) el.lista.appendChild(p);
  }

  /* ---------- números do mês (faixa de cima) e o "restam" de cada bloco ---------- */
  function pintarRestam(no, valor) {
    no.textContent = String(valor);
    no.classList.toggle('extra-vol-numero-valor--ok', valor === 0);
    no.classList.toggle('extra-vol-numero-valor--erro', valor < 0);
  }
  function atualizarNumeros(estado, el) {
    var grupo = estado.modo === 'grupo';
    var total = grupo ? estado.totalGrupo : soma(Object.keys(estado.totais), function (k) { return estado.totais[k]; });
    var repartidas = soma(estado.vols, function (v) { return v.concedido; });
    /* o total se edita aqui só no modo grupo (no por unidade, em cada bloco); senão é só o número */
    if (el.totalCampo) el.totalCampo.classList.toggle('oculto', !admin() || !grupo);
    if (el.totalLeitura) el.totalLeitura.classList.toggle('oculto', admin() && grupo);
    if (el.total && document.activeElement !== el.total) el.total.value = String(estado.totalGrupo);
    if (el.totalValor) el.totalValor.textContent = String(total);
    if (el.escopo) Array.prototype.forEach.call(el.escopo.querySelectorAll('input[data-modo]'), function (i) {
      i.checked = i.getAttribute('data-modo') === estado.modo;
    });
    if (el.escopoValor) el.escopoValor.textContent = msg().escopo[estado.modo] || '';
    if (el.repartidas) el.repartidas.textContent = String(repartidas);
    if (el.restam) pintarRestam(el.restam, total - repartidas);
    if (el.naEscala) el.naEscala.textContent = String(soma(estado.vols, function (v) { return v.preenchido; }));
    if (el.lista) Array.prototype.forEach.call(el.lista.querySelectorAll('.extra-vol-bloco[data-unidade]'), function (b) {
      atualizarBloco(estado, b, parseInt(b.dataset.unidade, 10));
    });
  }
  function atualizarBloco(estado, b, uid) {
    if (estado.modo !== 'por_unidade') return;
    var total = estado.totais[String(uid)] || 0;
    var dist = soma(estado.vols.filter(function (v) { return v.unidadeId === uid; }), function (v) { return v.concedido; });
    var rest = b.querySelector('.extra-vol-bloco-restam');
    if (rest) {
      rest.textContent = msg().restam(total - dist);
      rest.classList.toggle('extra-vol-bloco-restam--erro', total - dist < 0);
    }
    b.classList.toggle('extra-vol-bloco--estourado', total - dist < 0);
  }

  /* ---------- seletor da barra (só administrador): os números de cada lista ---------- */
  function atualizarFiltro(estado, el) {
    if (!el.filtro) return;
    var nums = {
      voluntarios: estado.vols.length,
      pendentes: estado.vols.filter(function (v) { return !v.termo; }).length,
      nao: estado.naoVol.length,
      sem: estado.semResp.length
    };
    Array.prototype.forEach.call(el.filtro.querySelectorAll('.aba[data-lista]'), function (a) {
      var nome = a.getAttribute('data-lista');
      a.classList.toggle('aba--ativa', nome === estado.lista);
      var n = a.querySelector('.extra-vol-filtro-num');
      if (n) n.textContent = String(nums[nome] || 0);
    });
  }

  /* ---------- uma linha de voluntário ---------- */
  function corTaxa(t, media) {
    if (t == null) return '';
    return t >= media ? 'verde' : (t <= media / 2 ? 'vermelho' : 'amarelo');
  }
  function opcoesConcedido(v) {
    var arr = [], passo = v.fecha24 ? 4 : 1;
    for (var n = 0; n <= v.pediu; n += passo) arr.push(n);
    return arr.length ? arr : [0];
  }
  function preencherDinamico(l, v) {
    var ehAdmin = admin();
    var conc = l.querySelector('.extra-vol-conc');
    var texto = l.querySelector('.extra-vol-conc-texto');
    if (texto) texto.textContent = String(v.concedido);
    if (conc) conc.classList.toggle('extra-vol-conc--alterado', v.termo && v.concedido !== v.sugerido);
    var escala = l.querySelector('.extra-vol-na-escala');
    if (escala) {
      var fora = !v.termo && ehAdmin;
      escala.textContent = fora ? msg().foraAteTermo : (v.termo ? msg().naEscala(v.preenchido, v.concedido) : '');
      escala.classList.toggle('extra-vol-fora', fora);
    }
    var leitura = l.querySelector('.extra-vol-conc-leitura');
    if (leitura) leitura.textContent = String(v.concedido);
  }
  function montarLinha(estado, v, media, menorSug) {
    var l = tpl('tpl-extra-vol-linha');
    if (!l) return null;
    var ehAdmin = admin();
    l.dataset.cpf = v.cpf;
    l.dataset.busca = RW.busca ? RW.busca.chave({ nome: v.nome, cpf: v.cpf }) : '';
    l.querySelector('.extra-vol-grad').textContent = v.grad || '';
    l.querySelector('.extra-vol-nome').textContent = v.nome || '';
    if (v.fecha24) l.querySelector('.extra-vaga-24h').classList.remove('oculto');
    if (!v.termo) l.querySelector('.extra-vol-pendente').classList.remove('oculto');
    if (v.novo && v.termo && estado.mostrarNovo) l.querySelector('.extra-vol-novo').classList.remove('oculto');
    l.querySelector('.extra-vol-pediu').textContent = String(v.pediu);
    var taxa = l.querySelector('.extra-vol-taxa');
    taxa.textContent = v.taxa == null ? '-' : v.taxa + '%';
    if (corTaxa(v.taxa, media)) taxa.classList.add('extra-vol-taxa--' + corTaxa(v.taxa, media));
    var sug = l.querySelector('.extra-vol-sugerido');
    sug.textContent = String(v.sugerido);
    if (menorSug !== null && v.sugerido > menorSug) sug.classList.add('extra-vol-sugerido--extra');

    var caixa = l.querySelector('.extra-vol-termo-caixa');
    caixa.classList.toggle('caixa-selecao--marcada', v.termo);
    caixa.setAttribute('aria-checked', v.termo ? 'true' : 'false');

    var conc = l.querySelector('.extra-vol-conc');
    if (ehAdmin && v.termo && RW.dropdownNumeros) {
      RW.dropdownNumeros.preencher(l.querySelector('.extra-vol-conc-menu'), {
        opcoes: opcoesConcedido(v), valor: v.concedido,
        aoEscolher: function (n) { ref.acoes.concedido(v.cpf, n); }
      });
    } else if (ehAdmin) {
      l.querySelector('.extra-vol-conc-gatilho').disabled = true;   // termo pendente: fica em 0
    } else {
      conc.classList.add('oculto');   // comum: o número, sem campo
      l.querySelector('.extra-vol-conc-leitura').classList.remove('oculto');
    }
    preencherDinamico(l, v);

    if (ehAdmin) {
      caixa.addEventListener('click', function (e) { e.stopPropagation(); ref.acoes.termo(v.cpf); });
      l.classList.add('extra-vol-linha--clicavel');
      l.addEventListener('click', function (e) {
        if (e.target.closest('.dropdown, .caixa-selecao')) return;
        ref.acoes.abrir(v.cpf);
      });
    }
    return l;
  }

  /* menor sugestão positiva do grupo que reparte (marca em verde quem levou a cota que sobrou) */
  function menorSugestao(vs) {
    var m = null;
    vs.forEach(function (v) { if (v.sugerido > 0 && (m === null || v.sugerido < m)) m = v.sugerido; });
    return m;
  }

  /* ---------- um bloco (unidade) ---------- */
  function montarBloco(estado, u, linhas, qtd) {
    var b = tpl('tpl-extra-vol-bloco');
    if (!b) return null;
    b.dataset.unidade = String(u.unidade_id);
    b.querySelector('.extra-vol-bloco-nome').textContent = u.nome;
    b.querySelector('.extra-vol-bloco-detalhe').textContent = msg().blocoDetalhe(u.cidade, qtd);
    if (estado.modo === 'por_unidade' && estado.lista === 'voluntarios') {
      b.querySelector('.extra-vol-bloco-restam').classList.remove('oculto');
      if (admin()) {
        var campo = b.querySelector('.extra-vol-bloco-cotas');
        var inp = b.querySelector('.extra-vol-bloco-total');
        campo.classList.remove('oculto');
        inp.value = String(estado.totais[String(u.unidade_id)] || 0);
        inp.addEventListener('input', function () {
          var v = inp.value.replace(/\D/g, '');
          if (v !== inp.value) inp.value = v;
          ref.acoes.total(u.unidade_id, v);
        });
      }
      atualizarBloco(estado, b, u.unidade_id);
    }
    var q = b.querySelector('.extra-vol-bloquinho');
    if (!linhas.length) {
      var p = estadoTexto(msg().semNaUnidade);
      if (p) q.appendChild(p);
    }
    linhas.forEach(function (l) { if (l) q.appendChild(l); });
    return b;
  }

  /* lista de quem não é voluntário ou ainda não respondeu */
  function desenharRespostas(estado, el) {
    var gente = estado.lista === 'nao' ? estado.naoVol : estado.semResp;
    if (!gente.length) {
      mostrarEstado(el, estado.lista === 'nao' ? msg().semNaoVoluntarios : msg().semResposta);
      return;
    }
    var cab = tpl('tpl-extra-vol-cab-resposta');
    if (cab) {
      if (estado.lista === 'sem') cab.querySelector('.extra-vol-cab-respondeu').classList.add('oculto');   // quem não respondeu não tem data
      el.lista.appendChild(cab);
    }
    estado.unidades.forEach(function (u) {
      var deles = gente.filter(function (g) { return g.unidade_id === u.unidade_id; });
      if (!deles.length) return;
      var linhas = deles.map(function (g) {
        var l = tpl('tpl-extra-vol-linha-resposta');
        if (!l) return null;
        l.dataset.busca = RW.busca ? RW.busca.chave({ nome: g.nome, cpf: g.cpf }) : '';
        l.querySelector('.extra-vol-grad').textContent = g.grad || '';
        l.querySelector('.extra-vol-nome').textContent = g.nome || '';
        l.querySelector('.extra-vol-respondeu').textContent = g.respondeu_em || '';
        return l;
      });
      var b = montarBloco(estado, u, linhas, deles.length);
      if (b) el.lista.appendChild(b);
    });
  }

  /* ---------- a lista inteira ---------- */
  function desenhar(estado, el, acoes) {
    ref = { estado: estado, el: el, acoes: acoes };
    if (!el.lista) return;
    atualizarFiltro(estado, el);
    atualizarNumeros(estado, el);
    el.lista.textContent = '';
    if (estado.lista === 'nao' || estado.lista === 'sem') {
      desenharRespostas(estado, el);
    } else {
      var vols = estado.lista === 'pendentes' ? estado.vols.filter(function (v) { return !v.termo; }) : estado.vols;
      var porUnidade = estado.modo === 'por_unidade' && estado.lista === 'voluntarios';
      if (!vols.length && !porUnidade) {
        mostrarEstado(el, estado.lista === 'pendentes' ? msg().semPendentes : RW.mensagens.extrajornada.semVoluntarios);
      } else {
        var comTaxa = estado.vols.filter(function (v) { return v.taxa != null; });
        var media = comTaxa.length ? soma(comTaxa, function (v) { return v.taxa; }) / comTaxa.length : 0;
        var menorGrupo = menorSugestao(estado.vols);
        var cab = tpl('tpl-extra-vol-cab');
        if (cab) el.lista.appendChild(cab);
        estado.unidades.forEach(function (u) {
          var deles = vols.filter(function (v) { return v.unidadeId === u.unidade_id; });
          if (!deles.length && !porUnidade) return;
          var menor = estado.modo === 'grupo' ? menorGrupo : menorSugestao(deles);
          var linhas = ordenar(deles).map(function (v) { return montarLinha(estado, v, media, menor); });
          var b = montarBloco(estado, u, linhas, deles.length);
          if (b) el.lista.appendChild(b);
        });
      }
    }
    aplicarBusca();
    marcarSelecionado(estado, el);
    renderPainel();
  }

  /* troca só os números de uma linha (Concedido escolhido), sem redesenhar a lista */
  function atualizarLinha(estado, el, v) {
    var l = el.lista ? el.lista.querySelector('.extra-vol-linha[data-cpf="' + v.cpf + '"]') : null;
    if (l) preencherDinamico(l, v);
    atualizarNumeros(estado, el);
  }

  /* ---------- busca: marca (anel) ou filtra (esconde) as linhas ---------- */
  function aplicarBusca() {
    var el = ref.el;
    if (!el || !el.lista) return;
    var termo = busca.termo;
    Array.prototype.forEach.call(el.lista.querySelectorAll('.extra-vol-linha:not(.extra-vol-cab)'), function (l) {
      var casa = !!termo && RW.busca.casaTexto(termo, l.dataset.busca || '');
      l.classList.toggle('extra-vol-linha--busca', casa && busca.modo === 'marcar');
      l.classList.toggle('oculto', !!termo && busca.modo === 'filtrar' && !casa);
    });
    Array.prototype.forEach.call(el.lista.querySelectorAll('.extra-vol-bloco'), function (b) {
      var visiveis = b.querySelectorAll('.extra-vol-linha:not(.oculto)').length;
      b.classList.toggle('oculto', !!termo && busca.modo === 'filtrar' && !visiveis);
    });
  }

  /* ---------- painel: a solicitação do militar (só administrador) ---------- */
  function marcarSelecionado(estado, el) {
    if (!el || !el.lista) return;
    Array.prototype.forEach.call(el.lista.querySelectorAll('.extra-vol-linha[data-cpf]'), function (l) {
      l.classList.toggle('extra-vol-linha--ativa', l.dataset.cpf === estado.selecionado);
    });
  }
  function dias(lista) { return lista.map(function (d) { return String(d).slice(8, 10); }); }

  function renderPainel() {
    var estado = ref.estado;
    if (!estado || !estado.selecionado || !RW.painel || !RW.painel.estaAberto()) return;
    var v = null;
    estado.vols.forEach(function (x) { if (x.cpf === estado.selecionado) v = x; });
    var corpo = RW.painel.corpo();
    if (!v || !corpo) return;
    var p = tpl('tpl-extra-vol-painel');
    if (!p) return;
    p.querySelector('.extra-vol-p-pedido').textContent = msg().pedido(v.pediu, v.fecha24);
    p.querySelector('.extra-vol-p-enviada').textContent = v.enviadaEm ? msg().enviada(v.enviadaEm) : '';
    p.querySelector('.extra-vol-p-quero').textContent = msg().datas(dias(v.datasQuer));
    p.querySelector('.extra-vol-p-nao').textContent = msg().datas(dias(v.datasNao));
    var botao = p.querySelector('.extra-vol-termo');
    botao.setAttribute('aria-checked', v.termo ? 'true' : 'false');
    p.querySelector('.extra-vol-termo .caixa-selecao').classList.toggle('caixa-selecao--marcada', v.termo);
    botao.addEventListener('click', function () { ref.acoes.termo(v.cpf); });
    p.querySelector('.extra-vol-p-termo').textContent = v.termo !== v.termoSalvo ? msg().termoAoSalvar
      : (v.termo ? msg().termoRecebido(v.termoEm || '', v.termoPor || '') : msg().termoPendente);
    p.querySelector('.extra-vol-p-atendimento').textContent = msg().atendimento(v.meses12, v.pediu12, v.recebeu12);
    corpo.textContent = '';
    corpo.appendChild(p);
  }

  function abrirPainel(estado, comp, acoes) {
    var v = null;
    estado.vols.forEach(function (x) { if (x.cpf === estado.selecionado) v = x; });
    if (!v || !RW.painel) return;
    var u = unidade(estado, v.unidadeId);
    RW.painel.abrir({
      titulo: (v.grad ? v.grad + ' ' : '') + v.nome,
      tituloExtra: u ? '- ' + u.nome : '',
      subtitulo: msg().tituloPainel(MESES[comp.getMonth()], comp.getFullYear()),
      aoFechar: acoes.fechou
    });
    /* rodapé do painel: Cancelar e Salvar valem para a tela toda (o mesmo do rodapé da tabela) */
    var rodape = RW.painel.rodape();
    var t = document.getElementById('tpl-extra-vol-painel-acoes');
    if (rodape && t) {
      rodape.appendChild(t.content.cloneNode(true));
      rodape.classList.remove('oculto');
      rodape.querySelector('.extra-vol-p-cancelar').addEventListener('click', acoes.cancelar);
      rodape.querySelector('.extra-vol-p-salvar').addEventListener('click', acoes.salvar);
    }
    marcarSelecionado(estado, ref.el);
    renderPainel();
    acoes.atualizarRodape();
  }

  /* saiu da aba: fecha o painel do militar e limpa a busca */
  function sair(estado, el) {
    if (estado.selecionado && RW.painel && RW.painel.estaAberto()) RW.painel.fechar();
    if (buscaCtrl) buscaCtrl.limpar();
  }

  function montar(cont, el) {
    if (el.busca && RW.busca) buscaCtrl = RW.busca.criar({ caixa: el.busca, aoBuscar: function (termo, modo) {
      busca = { termo: termo || '', modo: modo || 'marcar' };
      aplicarBusca();
    } });
  }

  RW.extrajornadaVoluntariosLista = { montar: montar, carregando: carregando, mostrarEstado: mostrarEstado,
    desenhar: desenhar, atualizarNumeros: atualizarNumeros, atualizarLinha: atualizarLinha,
    abrirPainel: abrirPainel, marcarSelecionado: marcarSelecionado, sair: sair };
})();
