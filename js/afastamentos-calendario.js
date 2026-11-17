/* ============================================================
   AFASTAMENTOS — o calendário do mês
   (RosterWork.afastamentosCalendario)
   A aba Calendário: o calendário da Escala (componente
   geral-calendario-mes), no lugar da árvore, com um bloquinho por
   unidade em cada dia (o da Escala, #tpl-escala-calendario-unidade),
   na ordem da árvore, lado a lado ou um embaixo do outro (a escolha da
   Escala), também nos dias de outro mês das pontas (mais escuros; o
   ano vizinho, na virada, é lido junto; o título conta só o mês). Em cada bloquinho, quem está afastado naquele dia, na linha
   da Escala (#tpl-escala-mes-pessoa): o listrado, o posto e o nome sem
   riscar e, à direita, o nome do afastamento (as datas na dica); o que
   não foi salvo leva a canaleta. Enquanto o ano chega, a forma de
   espera em cada bloquinho. Abre rolado na semana de hoje; redesenhado
   no mesmo mês, fica na mesma rolagem. O clique, para quem administra:
   no nome, a caixa do afastamento; no espaço vazio do bloquinho, o
   Adicionar (afastamentos-celula.js). Para quem não
   administra, o clique no nome abre o painel do militar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var chaveDesenhada = null; // o mês, a disposição e as unidades do calendário na tela

  function M() { return RW.mensagens.afastamentos; }
  function D() { return RW.data; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }

  /* a linha do afastado no dia: a da Escala, com o nome do afastamento no lugar do horário */
  function linhaDoAfastado(af, p, c) {
    var l = RW.tpl('tpl-escala-mes-pessoa');
    if (!l) return null;
    l.classList.add('linha-escalado--afastamento', 'afastamentos-linha');
    l.querySelector('.linha-escalado-grad').textContent = p.grau_abreviacao || '';
    l.querySelector('.linha-escalado-nome').textContent = p.nome_de_guerra || '';
    l.querySelector('.linha-escalado-hora').textContent = af.nome;
    l.setAttribute('data-dica', M().dicaSelo(af.nome, D().isoParaBR(af.inicio), D().isoParaBR(af.fim)));
    l.setAttribute('data-cpf', p.usuario_id);
    l.setAttribute('data-af', af.chave);
    l.setAttribute('role', 'button');
    l.setAttribute('tabindex', '0');
    if (af.mudou) l.classList.add('afastamentos-linha--rascunho');
    /* a busca: o nome achado invertido, como na Escala */
    var busca = c.busca(p);
    if (busca === 'marcar') l.classList.add('linha-escalado--busca');
    if (busca === 'marcar' || busca === 'casa') l.classList.add('busca-achado');
    var pode = c.podeMudar(p);
    function clicar(ev) {
      if (pode) c.aoClicarLinha(l, p, ev);
      else c.abrirPainel(l, p);
    }
    l.addEventListener('click', function (ev) { ev.stopPropagation(); clicar(ev); });
    l.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); clicar(ev); }
    });
    return l;
  }

  /* o bloquinho da unidade no dia, com os afastados dele (os da grade inteira, de g.inicio a g.fim); quem administra a
     unidade clica no espaço vazio. Só o dia do mês da tela (doMes) conta no título; o dia do ano que ainda vem do banco
     fica com a forma de espera */
  function blocoDoDia(u, dia, c, contar, g, doMes) {
    var bloco = RW.tpl('tpl-escala-calendario-unidade');
    if (!bloco) return null;
    bloco.classList.add('afastamentos-bloco');
    bloco.setAttribute('data-unidade-id', u.unidade.unidade_id);
    bloco.setAttribute('data-iso', dia);
    bloco.querySelector('.escala-calendario-unidade-nome').textContent = u.unidade.nome || '';
    var cel = bloco.querySelector('.escala-mes-celula');
    var lendo = c.lendoAno(Number(dia.slice(0, 4)));
    if (lendo) {
      cel.appendChild(RW.tpl('tpl-esqueleto-afastamento'));
    } else {
      u.pessoas.forEach(function (p) {
        c.afastamentosEntre(p, g.inicio, g.fim).forEach(function (af) {
          if (af.inicio > dia || af.fim < dia) return;
          var l = linhaDoAfastado(af, p, c);
          if (!l) return;
          cel.appendChild(l);
          if (doMes) contar(p);
          /* o bloquinho com o nome achado ganha o anel da busca, como na Escala */
          if (l.classList.contains('linha-escalado--busca')) cel.classList.add('escala-mes-celula--busca');
        });
      });
    }
    if (!lendo && c.podeAdicionar(u.unidade.unidade_id)) {
      bloco.addEventListener('click', function () { c.aoClicarBloco(bloco, u.unidade, u.efetivo, dia); });
    } else {
      bloco.classList.add('afastamentos-bloco--leitura');
    }
    return bloco;
  }

  /* desenha o mês no corpo. unidades = [{ unidade, pessoas (as que passam, na ordem da tela), efetivo (o da unidade, por
     antiguidade) }]; c = o contexto da página (afastamentos.js). Devolve se desenhou */
  function desenhar(corpo, unidades, c) {
    if (!corpo || !unidades.length || !RW.geralCalendarioMes) return false;
    var lado = !!(RW.visaoGrade && RW.visaoGrade.disposicao() === 'lado');
    var chave = c.ano + '-' + c.mes + '|' + (lado ? 'lado' : 'empilhadas') + '|' +
      unidades.map(function (u) { return u.unidade.unidade_id; }).join(',');
    var antigo = corpo.querySelector('.geral-calendario-mes');
    var rolagem = antigo && chave === chaveDesenhada ? { topo: antigo.scrollTop, esquerda: antigo.scrollLeft } : null;
    /* o título da página conta cada militar que aparece uma vez */
    var contados = {};
    function contar(p) {
      if (contados[p.usuario_id]) return;
      contados[p.usuario_id] = true;
      c.contar();
    }
    /* a grade inteira: os dias de outro mês das pontas também, mais escuros e com o clique de sempre */
    var dataRef = new Date(c.ano, c.mes, 1);
    var faixa = RW.geralCalendarioMes.periodo(dataRef);
    var g = { inicio: iso(faixa.inicio), fim: iso(faixa.fim) };
    RW.geralCalendarioMes.renderizar(corpo, {
      dataRef: dataRef,
      unidadesPorDia: unidades.length,
      ladoALado: lado,
      comDiasDeFora: true,
      aoDia: function (celulaDia, data, noMes) {
        var dia = iso(data);
        unidades.forEach(function (u) {
          var bloco = blocoDoDia(u, dia, c, contar, g, noMes);
          if (bloco) celulaDia.appendChild(bloco);
        });
      }
    });
    chaveDesenhada = chave;
    var wrap = corpo.querySelector('.geral-calendario-mes');
    if (!wrap) return true;
    /* o mesmo mês redesenhado fica na mesma rolagem; outro abre na semana de hoje (com a de antes à vista acima) */
    if (rolagem) {
      wrap.scrollTop = rolagem.topo;
      wrap.scrollLeft = rolagem.esquerda;
      return true;
    }
    var diaHoje = wrap.querySelector('.geral-calendario-mes-dia--hoje:not(.geral-calendario-mes-dia--fora)');
    if (diaHoje && RW.periodo) {
      var semana = diaHoje.closest('.geral-calendario-mes-semana');
      RW.periodo.rolarAteHoje(wrap, semana, semana.previousElementSibling, { fixo: wrap.querySelector('.geral-calendario-mes-cabecalho') });
      RW.periodo.rolarAteHoje(wrap, diaHoje, diaHoje.previousElementSibling, { horizontal: true });
    }
    return true;
  }

  window.RosterWork.afastamentosCalendario = { desenhar: desenhar };
})();
