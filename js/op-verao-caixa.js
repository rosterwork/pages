/* ============================================================
   OP. VERÃO — as caixas do clique na grade
   Na página Op. Verão, o clique na célula e no título do dia nunca
   abre o painel do dia (a Escala, escalas-painel.js, pergunta aqui
   antes). Para o administrador da companhia, abre a caixa flutuante
   ao lado (componente geral-caixa-flutuante; no celular, a folha):
   - no dia: Adicionar no dia, com os turnos dos Ajustes e o Horário
     personalizado; a caixa 2 traz o campo de quem trabalha (a lista
     do banco, op_verao_candidatos: quem está em Op. Verão no dia, os
     guarda-vidas civis e os outros militares da companhia) e o
     Cadastrar guarda-vidas civil (o painel direito; cadastrado, ele
     entra no dia);
   - no nome: Pôr num posto (os postos dos Ajustes e o Sem posto),
     Mudar o horário (os turnos e o personalizado) e Remover do dia;
   - no título: no "Sem Oficial de Praia", Adicionar Oficial de Praia
     (os turnos, e a caixa 2 com os oficiais da companhia); no nome
     do Oficial de Praia, Pôr outro no lugar dele, Mudar o horário,
     Adicionar outro Oficial de Praia e Remover do dia.
   O que se escolhe entra no rascunho (op-verao-rascunho.js) e aparece
   na hora; só o Salvar do rodapé largo grava. O dia de mais de 7 dias
   atrás não muda (o aviso). Não cria HTML (clona os moldes do
   escalas.html) nem escreve estilo.
   RosterWork.opVeraoCaixa.{ clique(evento), fechar() }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* o clique numa célula ou num Oficial de Praia é da página (abre outra caixa ou fecha esta): a caixa não fecha por ele */
  var DA_GRADE = '.conteudo .escala-mes-celula, .conteudo .escala-calendario-unidade, .conteudo .op-verao-oficial';
  var TOPO_DIA = 8;   // a caixa do dia abre com o topo 8px abaixo do topo da célula
  var aberta = null;  // { caixa, peca, cia, iso, chave, s (o dia), nome (da companhia) }
  var conta = 0;      // o id de cada campo da caixa 2

  function C() { return RW.opVeraoCelula; }
  function R() { return RW.opVeraoRascunho; }
  function msg() { return RW.mensagens.opVerao; }
  function curta(t) { return RW.horario.curta(t); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function textoDo(b) { var s = b && b.querySelector('span'); return s ? s.textContent.trim() : ''; }
  function nomeDa(l) { return ((l.grad || '') + ' ' + (l.nome || '')).trim(); }

  /* as horas do personalizado, no mesmo dia (como os turnos dos Ajustes): o início de 00 a 22 e o fim de 01 a 23 */
  function horas() {
    var lista = { inicios: [], fins: [] };
    for (var h = 0; h <= 23; h++) {
      var t = ('0' + h).slice(-2);
      if (h < 23) lista.inicios.push(t);
      if (h > 0) lista.fins.push(t);
    }
    return lista;
  }

  /* as linhas de agora do dia aberto e a de uma chave */
  function linhas(a) { return R().copia(C().linhasDoDia(a.cia, a.iso)); }
  function daChave(lista, chave) { return lista.filter(function (l) { return l.chave === chave; })[0] || null; }

  /* ---------- abrir e fechar ---------- */

  function fechar() {
    var a = aberta;
    aberta = null;
    if (a && a.caixa) a.caixa.fechar();
  }

  /* a peça escolhida depois que a grade refez a célula ou o título (o nome tem a mesma chave) */
  function acharDeNovo() {
    var a = aberta;
    if (!a || !a.seletor) return;
    var nova = document.querySelector(a.seletor);
    if (nova) { a.peca = nova; a.caixa.trocarPeca(nova); }
  }

  /* uma mudança do dia: o rascunho (a grade mostra) e a caixa fecha, ou fica com a peça nova (fica: o horário em edição) */
  function mudar(a, lista, fica) {
    R().mudar(a.cia, a.iso, lista);
    if (fica) acharDeNovo();
    else fechar();
  }

  function abrir(a, conteudo, titulo, topo) {
    fechar();
    a.caixa = RW.caixaFlutuante.abrir({ peca: a.peca, titulo: titulo, topo: topo, conteudo: conteudo, ignorar: DA_GRADE,
      aoFechar: function () { if (aberta === a) aberta = null; } });
    if (a.caixa) aberta = a;
  }

  /* ---------- os turnos (as caixas do dia e do título, e o Mudar o horário) ---------- */

  /* um item por turno dos Ajustes e o Horário personalizado; semSeta: o item faz na hora (sem caixa depois) */
  function turnos(lugar, s, aoTurno, aoPersonalizado, semSeta) {
    (s.turnos || []).forEach(function (t) {
      var b = RW.tpl('tpl-op-verao-item-turno');
      if (!b) return;
      b.querySelector('.op-verao-item-texto').textContent = msg().turno(t.nome, curta(t.inicio), curta(t.fim));
      if (semSeta) b.querySelector('.escala-edicao-opcoes-seta').classList.add('oculto');
      b.addEventListener('click', function () { aoTurno(t, b); });
      lugar.appendChild(b);
    });
    var p = RW.tpl('tpl-op-verao-item-personalizado');
    if (!p) return;
    p.addEventListener('click', function () { aoPersonalizado(p); });
    lugar.appendChild(p);
  }

  /* o horário do personalizado começa no do Dia todo (ou no primeiro turno) */
  function horarioPadrao(s) {
    var t = (s.turnos || []).filter(function (x) { return x.chave === 'dia'; })[0] || (s.turnos || [])[0];
    return t ? { inicio: t.inicio, fim: t.fim } : { inicio: '08:00', fim: '19:00' };
  }

  /* ---------- a caixa 2 de quem trabalha ---------- */

  /* o = { item (o da caixa 1), inicio, fim, personalizado, oficial, noLugar (a chave de quem sai) } */
  function quem(a, o) {
    var el = RW.tpl('tpl-op-verao-quem');
    if (!el) return;
    var M = msg(), h = { inicio: o.inicio, fim: o.fim }, pedido = 0;
    var sai = o.noLugar ? daChave(linhas(a), o.noLugar) : null;
    var inp = el.querySelector('input'), menu = el.querySelector('.dropdown-menu');
    inp.id = 'op-verao-quem-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return null; },
      aoEscolher: function (item) { escolher(a, item, h, o); },
      textos: { selecione: sai ? M.escolherNoLugar(nomeDa(sai)) : o.oficial ? M.escolherOficial : M.escolher,
        semNinguem: M.semNinguem, filtroVazio: M.filtroVazio }
    });
    if (!combo) return;
    if (o.personalizado) {
      var lugar = el.querySelector('.op-verao-quem-horario');
      lugar.classList.remove('oculto');
      var linhaH = RW.horario.linha({ hi: h.inicio, hf: h.fim, opcoes: horas(), semAcoes: true,
        aoInicio: function (v) { h.inicio = v; carregar(); }, aoFim: function (v) { h.fim = v; carregar(); } });
      if (linhaH) lugar.appendChild(linhaH);
    }
    if (!o.oficial) {
      var cad = el.querySelector('.op-verao-cadastrar');
      cad.classList.remove('oculto');
      cad.addEventListener('click', function () { cadastrar(a, h); });
    }
    /* a lista do banco para o horário de agora (a última pedida vale) */
    function carregar() {
      var meu = ++pedido;
      combo.habilitar(false);
      if (h.fim <= h.inicio) { combo.definir(M.fimAntes, true); return; }
      combo.definir(M.carregando, true);
      RW.rpc('op_verao_candidatos', { p_unidade: Number(a.cia), p_dia: a.iso, p_inicio: h.inicio, p_fim: h.fim,
        p_oficial: !!o.oficial }).then(function (r) {
        if (meu !== pedido || aberta !== a || !el.isConnected) return;
        if (!r || !r.ok) { combo.definir(M.falhaLista, true); return; }
        if (!combo.preencher(itens(a, r.grupos, h, o.noLugar))) return;
        /* a lista abre sozinha só sem o Cadastrar embaixo do campo (aberta, ela o cobriria) */
        if (!o.personalizado) { inp.focus(); if (o.oficial) combo.abrir(); }
      }, function () {
        if (meu === pedido && aberta === a && el.isConnected) combo.definir(M.falhaLista, true);
      });
    }
    a.caixa.segunda(o.item, el, textoDo(o.item));
    carregar();
  }

  /* a lista do campo: um título por grupo com gente e, em cada um, quem pode (quem já está no dia num horário que cruza
     fica apagado; quem sai do lugar, fora) */
  function itens(a, grupos, h, noLugar) {
    var M = msg(), dia = linhas(a).filter(function (l) { return l.chave !== noLugar; }), lista = [];
    (grupos || []).forEach(function (g) {
      if (!(g.itens || []).length) return;
      lista.push({ titulo: M.grupos[g.grupo] || '', aberto: !lista.length });
      g.itens.forEach(function (m) {
        var civil = m.tipo === 'civil';
        var noDia = dia.some(function (l) {
          return (civil ? l.civil_id === m.id : l.cpf === m.id) && l.inicio < h.fim && h.inicio < l.fim;
        });
        lista.push({ cpf: (civil ? 'civil:' : '') + m.id, tipo: m.tipo, id: m.id, grad: m.grad, nome: m.nome,
          nome_completo: m.nome_completo || null, inativo: noDia,
          info: noDia ? M.info.noDia : m.oa ? M.info.oa : m.servico ? M.info.servico : g.grupo === 'outros' ? (m.unidade || '') : '' });
      });
    });
    return lista;
  }

  /* escolhido o nome: ele entra no dia (no lugar de quem sai, quando é o Pôr outro no lugar dele) */
  function escolher(a, item, h, o) {
    var lista = linhas(a);
    if (o.noLugar) lista = lista.filter(function (l) { return l.chave !== o.noLugar; });
    lista.push(R().nova({ oficial: !!o.oficial, cpf: item.tipo === 'civil' ? null : item.id,
      civil_id: item.tipo === 'civil' ? item.id : null, grad: item.grad, nome: item.nome, nome_completo: item.nome_completo,
      inicio: h.inicio, fim: h.fim }));
    mudar(a, lista);
  }

  /* o Cadastrar guarda-vidas civil: o painel direito; cadastrado, ele entra no dia no horário escolhido */
  function cadastrar(a, h) {
    var hora = { inicio: h.inicio, fim: h.fim };
    fechar();
    RW.opVeraoCivil.abrir({ unidade: Number(a.cia), nome: a.nome, aoMudar: function (id) {
      if (!id) return;
      RW.rpc('guarda_vidas_civis_listar', { p_unidade: Number(a.cia) }).then(function (r) {
        var c = r && r.ok ? (r.civis || []).filter(function (x) { return x.id === id; })[0] : null;
        if (!c || !C().ativa() || hora.fim <= hora.inicio) return;
        escolher(a, { tipo: 'civil', id: id, grad: 'GVC', nome: c.nome, nome_completo: c.nome_completo }, hora, {});
      });
    } });
  }

  /* ---------- as caixas 2 do nome ---------- */

  /* Pôr num posto: os postos dos Ajustes e o Sem posto; o escolhido vale na hora */
  function postos(a, item) {
    var el = RW.tpl('tpl-op-verao-lista');
    if (!el) return;
    (a.s.postos || []).forEach(function (p) {
      var b = RW.tpl('tpl-op-verao-item-posto');
      if (!b) return;
      b.querySelector('.op-verao-item-texto').textContent = p.nome;
      b.addEventListener('click', function () { porNoPosto(a, p); });
      el.appendChild(b);
    });
    var sem = RW.tpl('tpl-op-verao-item-sem-posto');
    if (sem) { sem.addEventListener('click', function () { porNoPosto(a, null); }); el.appendChild(sem); }
    a.caixa.segunda(item, el, textoDo(item));
  }
  function porNoPosto(a, p) {
    var lista = linhas(a), l = daChave(lista, a.chave);
    if (!l) { fechar(); return; }
    l.posto_id = p ? p.id : null;
    l.posto_nome = p ? p.nome : null;
    mudar(a, lista);
  }

  /* Mudar o horário: os turnos valem na hora; o personalizado troca a caixa 2 pelo horário, que muda a cada escolha */
  function mudarHorario(a, item) {
    var el = RW.tpl('tpl-op-verao-lista');
    if (!el) return;
    turnos(el, a.s, function (t) { novoHorario(a, t.inicio, t.fim, false); }, function () {
      var l = daChave(linhas(a), a.chave), caixa = RW.tpl('tpl-op-verao-horario');
      if (!l || !caixa) return;
      var h = { inicio: l.inicio, fim: l.fim };
      var linhaH = RW.horario.linha({ hi: h.inicio, hf: h.fim, opcoes: horas(), semAcoes: true,
        aoInicio: function (v) { h.inicio = v; if (h.fim > h.inicio) novoHorario(a, h.inicio, h.fim, true); },
        aoFim: function (v) { h.fim = v; if (h.fim > h.inicio) novoHorario(a, h.inicio, h.fim, true); } });
      if (linhaH) caixa.querySelector('.op-verao-quem-horario').appendChild(linhaH);
      a.caixa.segunda(item, caixa, textoDo(item));
    }, true);
    a.caixa.segunda(item, el, textoDo(item));
  }
  function novoHorario(a, inicio, fim, fica) {
    var lista = linhas(a), l = daChave(lista, a.chave);
    if (!l) { fechar(); return; }
    l.inicio = inicio;
    l.fim = fim;
    mudar(a, lista, fica);
  }

  function remover(a) {
    mudar(a, linhas(a).filter(function (l) { return l.chave !== a.chave; }));
  }

  /* ---------- as caixas 1 ---------- */

  function ligarAcoes(el, fazer) {
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), b); });
    });
  }

  /* o dia: Adicionar no dia (os turnos; a caixa 2 com quem trabalha) */
  function caixaDia(a) {
    var el = RW.tpl('tpl-op-verao-caixa-dia');
    if (!el) return;
    turnos(el.querySelector('.op-verao-caixa-itens'), a.s, function (t, b) {
      quem(a, { item: b, inicio: t.inicio, fim: t.fim });
    }, function (b) {
      var h = horarioPadrao(a.s);
      quem(a, { item: b, inicio: h.inicio, fim: h.fim, personalizado: true });
    });
    abrir(a, el, RW.mensagens.escala.linha.noDia(a.nome, diaMes(a.iso)), TOPO_DIA);
  }

  /* o nome do guarda-vidas na célula */
  function caixaNome(a) {
    var el = RW.tpl('tpl-op-verao-caixa-nome'), l = daChave(linhas(a), a.chave);
    if (!el || !l) return;
    ligarAcoes(el, function (acao, b) {
      if (acao === 'posto') postos(a, b);
      else if (acao === 'horario') mudarHorario(a, b);
      else remover(a);
    });
    abrir(a, el, RW.mensagens.escala.linha.noDia(nomeDa(l), diaMes(a.iso)));
  }

  /* o título do dia: o "Sem Oficial de Praia" (os turnos e os oficiais) ou o nome de um Oficial de Praia */
  function caixaTitulo(a) {
    var titulo = RW.mensagens.escala.linha.noDia(a.peca.textContent.trim(), diaMes(a.iso));
    var l = a.chave ? daChave(linhas(a), a.chave) : null;
    if (!l) {
      var el = RW.tpl('tpl-op-verao-caixa-titulo');
      if (!el) return;
      a.chave = null;
      turnosDoOficial(a, el.querySelector('.op-verao-caixa-itens'));
      abrir(a, el, titulo);
      return;
    }
    var menu = RW.tpl('tpl-op-verao-caixa-oficial');
    if (!menu) return;
    ligarAcoes(menu, function (acao, b) {
      var agora = daChave(linhas(a), a.chave);
      if (!agora) { fechar(); return; }
      if (acao === 'outro') quem(a, { item: b, inicio: agora.inicio, fim: agora.fim, oficial: true, noLugar: a.chave });
      else if (acao === 'horario') mudarHorario(a, b);
      else if (acao === 'mais') {
        var lista = RW.tpl('tpl-op-verao-lista');
        if (!lista) return;
        turnosDoOficial(a, lista, b);
        a.caixa.segunda(b, lista, textoDo(b));
      } else remover(a);
    });
    abrir(a, menu, titulo);
  }

  /* os turnos de quem entra como Oficial de Praia; escolhido, a caixa 2 com os oficiais (item: o da caixa 1 que fica
     escolhido; sem ele, o turno clicado) */
  function turnosDoOficial(a, lugar, item) {
    turnos(lugar, a.s, function (t, b) {
      quem(a, { item: item || b, inicio: t.inicio, fim: t.fim, oficial: true });
    }, function (b) {
      var h = horarioPadrao(a.s);
      quem(a, { item: item || b, inicio: h.inicio, fim: h.fim, personalizado: true, oficial: true });
    });
  }

  /* ---------- o clique ---------- */

  /* o dia de mais de 7 dias atrás não muda */
  function antigo(iso) {
    if (iso >= C().limite()) return false;
    fechar();
    RW.avisar({ tipo: 'aviso', mensagem: msg().diaAntigo(RW.data.isoParaBR(C().limite())) });
    return true;
  }

  /* o clique delegado da grade (escalas-painel.js › ligar): true quando é da Op. Verão (a célula e o título; o painel do
     dia não abre nesta página) */
  function clique(ev) {
    if (!C() || !C().ativa() || !ev.target.closest) return false;
    var t = ev.target;
    var of = t.closest('.op-verao-oficial[data-companhia]');
    if (of) {
      var ciaT = of.getAttribute('data-companhia'), isoT = of.getAttribute('data-iso');
      if (!C().pode(ciaT)) return true;
      if (aberta && aberta.peca === of) { fechar(); return true; }
      if (antigo(isoT)) return true;
      var sT = diaDaCompanhia(ciaT, isoT);
      if (!sT) return true;
      var chaveT = of.getAttribute('data-op-verao');
      caixaTitulo({ peca: of, cia: ciaT, iso: isoT, s: sT, nome: '', chave: chaveT,
        seletor: chaveT ? '.conteudo .op-verao-oficial[data-op-verao="' + chaveT + '"]' : null });
      return true;
    }
    var alvo = t.closest('.escala-mes-celula, .escala-calendario-unidade');
    var cel = alvo && alvo.classList.contains('escala-calendario-unidade') ? alvo.querySelector('.escala-mes-celula') : alvo;
    if (!cel || !cel.dataset.iso) return false;
    var iso = cel.dataset.iso, s = C().doDia(cel.dataset.unidadeId, iso);
    if (!s || !C().pode(s.companhia_id)) return true;
    var lin = t.closest('.linha-escalado[data-op-verao]');
    var peca = lin || alvo;
    if (aberta && aberta.peca === peca) { fechar(); return true; }
    if (antigo(iso)) return true;
    var a = { peca: peca, cia: String(s.companhia_id), iso: iso, s: s, nome: cel.dataset.unidadeNome || '' };
    if (lin) {
      a.chave = lin.getAttribute('data-op-verao');
      a.seletor = '.conteudo .escala-mes-celula[data-unidade-id="' + cel.dataset.unidadeId + '"][data-iso="' + iso
        + '"] [data-op-verao="' + a.chave + '"]';
      caixaNome(a);
    } else caixaDia(a);
    return true;
  }

  /* o dia da companhia de uma unidade da grade (o título é do dia, não de uma unidade) */
  function diaDaCompanhia(cia, iso) {
    var cels = document.querySelectorAll('.conteudo .escala-mes-celula[data-iso="' + iso + '"]');
    for (var i = 0; i < cels.length; i++) {
      var s = C().doDia(cels[i].dataset.unidadeId, iso);
      if (s && String(s.companhia_id) === String(cia)) return s;
    }
    return null;
  }

  RW.opVeraoCaixa = { clique: clique, fechar: fechar };
})();
