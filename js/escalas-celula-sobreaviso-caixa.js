/* ============================================================
   ESCALAS — o sobreaviso na caixa da célula da grade
   O clique num nome do sobreaviso (na Escala e na página Sobreaviso),
   na linha do que falta ou, na página Sobreaviso, em qualquer lugar
   do dia abre, para quem mexe no sobreaviso (o administrador da
   companhia ou, no sobreaviso de cada pelotão, o do pelotão), a caixa
   ao lado, na edição da célula (escalas-celula-editar.js, a caixa do
   tipo 'sobreaviso'): no nome, Pôr outro no lugar dele e Mudar o
   horário (a caixa 2 ao lado), Remover do sobreaviso (na hora, com o
   Desfazer do rodapé) e Abrir o painel do dia; no dia, Adicionar ao
   sobreaviso e Abrir o painel do dia. O painel só abre pelo item
   dele. O que muda vai para o rascunho do bloco do painel
   (escalas-painel-sobreaviso.js › naCaixa), aparece na grade na hora
   e grava no Salvar do rodapé largo, mesmo com o painel fechado.
   Não cria HTML (clona os moldes do escalas.html) nem escreve estilo.
   Na aba Militares da página Sobreaviso, o telefone abre a mesma caixa
   (abrirFora).
   RosterWork.escalasCelulaSobreavisoCaixa.{ alvo(evento, celula), menu(contexto), abrirFora(o) }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var conta = 0;   // o id de cada campo da caixa 2

  function P() { return RW.escalasPainelSobreaviso.naCaixa; }
  function api() { return RW.escalasPainelEditar.sub; }
  function msg() { return RW.mensagens.escala.sobreaviso; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function textoDo(botao) { var s = botao && botao.querySelector('span'); return s ? (s.innerText || s.textContent).trim() : ''; }

  /* o clique é do sobreaviso? { cpf (o nome clicado; null: o dia), linha (a peça do nome), pode (ele mexe no sobreaviso
     deste dia) }; null: não é (a célula segue como sempre; a linha tracejada de cima do grupo é do dia) */
  function alvo(evento, cel) {
    var campo = evento.target.closest && !evento.target.closest('.escala-grupo-linha') ? evento.target.closest('.escala-sobreaviso') : null;
    var naPagina = !!(RW.paginaSobreaviso && RW.paginaSobreaviso.ativa());
    if (!campo && !naPagina) return null;
    var linha = campo ? evento.target.closest('.linha-escalado--sobreaviso[data-cpf]') : null;
    var s = RW.escalasCelulaSobreaviso.doDia(cel.dataset.unidadeId, cel.dataset.iso);
    var quem = s ? (s.unidade_id ? ['pelotao', s.unidade_id] : ['companhia', s.companhia_id]) : null;
    return { cpf: linha ? linha.getAttribute('data-cpf') : null, linha: linha,
      pode: !!quem && !!RW.sessao && RW.sessao.podeAdministrar(quem[0], quem[1]) };
  }

  /* a caixa 1, quando o dia chega à célula: a do nome (quem ainda está no rascunho) ou a do dia */
  function menu(c) {
    var a = c.a;
    if (!P().preparar((api().dados() || {}).sobreaviso, a.unidadeId, a.iso)) return null;
    var m = a.cpf ? P().militar(a.cpf) : null;
    var el = RW.tpl(m ? 'tpl-escala-celula-sobreaviso' : 'tpl-escala-celula-sobreaviso-dia');
    if (!el) return null;
    [].forEach.call(el.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), b, c); });
    });
    return el;
  }

  function fazer(acao, botao, c) {
    var a = c.a;
    if (!a || !a.caixa || a.sobreavisoItem === botao) return;
    a.caixa.fecharSegunda();
    a.sobreavisoItem = null;
    if (acao === 'painel') { P().pedirBloco(a.cpf); c.fecharTudo('guardar'); c.abrirPainel(null); return; }
    if (acao === 'remover') { P().remover(a.cpf); c.fecharTudo(); return; }
    if (acao === 'horario') { horario(botao, c); return; }
    campo(botao, c, acao === 'por-outro' ? a.cpf : null);
  }

  /* a caixa 2 do Pôr outro no lugar dele (cpf: quem sai) e do Adicionar ao sobreaviso: a lista do banco, na ordem da fila */
  function campo(botao, c, cpf) {
    var a = c.a, M = msg(), el = RW.tpl('tpl-escala-celula-sobreaviso-campo');
    if (!el) return;
    var m = cpf ? P().militar(cpf) : null;
    var inp = el.querySelector('input'), lista = el.querySelector('.dropdown-menu');
    inp.id = 'escala-celula-sobreaviso-campo-' + (++conta);
    var combo = RW.comboMilitar.criar(inp, lista, {
      atual: function () { return null; },
      aoEscolher: function (item) { P().escolher(cpf, item); c.fecharTudo(); },
      textos: { selecione: m ? M.escolherNoLugar(nomeDe(m)) : M.escolherNovo, semNinguem: M.semNinguem, filtroVazio: M.filtroVazio }
    });
    if (!combo) return;
    combo.habilitar(false);
    combo.definir(M.carregando, true);
    a.sobreavisoItem = botao;
    a.caixa.segunda(botao, el, textoDo(botao));
    RW.escalasDados.sobreavisoCandidatos(a.unidadeId, a.iso, cpf).then(function (r) {
      if (c.a !== a || a.sobreavisoItem !== botao || !el.isConnected) return;
      if (!r) { combo.definir(M.falhaLista, true); return; }
      if (!combo.preencher(P().lista(r, cpf))) return;
      inp.focus();
      combo.abrir();
    });
  }

  /* a caixa 2 do Mudar o horário: o horário do site; cada escolha entra no rascunho */
  function horario(botao, c) {
    var a = c.a, m = P().militar(a.cpf), el = RW.tpl('tpl-escala-celula-cartao');
    if (!m || !el) return;
    var linha = RW.horario.linha({ hi: m.horaInicio, hf: m.horaFim, semAcoes: true,
      aoInicio: function (v) { P().horario(a.cpf, 'horaInicio', v); },
      aoFim: function (v) { P().horario(a.cpf, 'horaFim', v); } });
    if (linha) el.querySelector('.escala-celula-cartao-horario').appendChild(linha);
    a.sobreavisoItem = botao;
    a.caixa.segunda(botao, el, textoDo(botao));
  }

  /* a caixa fora da grade de células (a aba Militares da página Sobreaviso): o = { d (o dia: unidadeId, iso, unidadeNome,
     unidadeCidade), peca, cpf, titulo, pode }. Quem não mexe no sobreaviso: o painel do dia no bloco; o dia de mais de 7
     dias atrás: a caixa do aviso, com o Abrir o painel do dia. Com o painel aberto, a caixa abre do mesmo jeito e o painel
     vai junto para o dia (escalas-celula-editar.js › painelNoDia); no celular e no dia antigo, o painel vai para o dia */
  function abrirFora(o) {
    var E = RW.escalasCelulaEditar;
    function painel() { P().pedirBloco(o.cpf); RW.escalasPainel.abrirDia(o.d, null); }
    var painelAberto = !!(RW.painel && RW.painel.estaAberto());
    if (!o.pode || !E || (painelAberto && ((RW.celular && RW.celular()) || o.d.iso < E.limite()))) { painel(); return; }
    if (o.d.iso < E.limite()) {
      RW.caixaFlutuante.aviso({ peca: o.peca, texto: RW.mensagens.escala.diaAntigo, titulo: o.titulo, aoPainel: painel });
      return;
    }
    E.abrirSobreaviso(o.d, o.peca, o.cpf, o.titulo, [], true);
  }

  RW.escalasCelulaSobreavisoCaixa = { alvo: alvo, menu: menu, abrirFora: abrirFora };
})();
