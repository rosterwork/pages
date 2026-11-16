/* ============================================================
   USUÁRIOS — aba Afastamentos: a grade dos 12 meses
   (RosterWork.usuariosAfastamentosGrade)
   Dentro do bloco de cada unidade da árvore, a grade da aba Militares
   da Escala com os meses no lugar dos dias: o cabeçalho dos meses
   (o de hoje escuro, preso no alto ao rolar), a coluna do militar
   (presa à esquerda, com o selo cinza dos dias afastado no ano) e, em
   cada mês, um selo por afastamento: o listrado do afastado, o nome e
   os dias daquele mês ("Férias 14 a 30"; o que passa de um mês ao
   outro aparece nos dois). O que ainda não foi salvo leva a canaleta.
   O clique no militar abre a ficha; na célula, a caixa (quem
   administra o militar; usuarios-afastamentos-celula.js). No celular,
   a lista: o militar e, embaixo, um afastamento do ano por linha.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function M() { return RW.mensagens.afastamentos; }
  function D() { return RW.data; }

  /* as 2 primeiras letras do nome de guerra (o avatar da grade dos Militares) */
  function iniciais(nome) { return String(nome || '').slice(0, 2).toUpperCase(); }
  /* "12345678901" -> "123.456.789-01" */
  function formatarCpf(cpf) {
    var s = String(cpf || '');
    return s.length === 11 ? s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : s;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* "02/10 a 30/11" no ano de referência; a data de outro ano leva o ano ("15/12 a 05/01/2027") */
  function textoDatas(inicio, fim, ano) {
    function uma(iso) {
      var br = D().isoParaBR(iso);
      return Number(String(iso).slice(0, 4)) === ano ? br.slice(0, 5) : br;
    }
    return uma(inicio) + ' a ' + uma(fim);
  }

  /* os dias do afastamento dentro do ano */
  function diasNoAno(afs, ano) {
    var ini = ano + '-01-01', fim = ano + '-12-31', total = 0;
    afs.forEach(function (af) {
      var a = af.inicio > ini ? af.inicio : ini, b = af.fim < fim ? af.fim : fim;
      if (b >= a) total += Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000) + 1;
    });
    return total;
  }

  /* o mês de hoje no ano da tela (-1 em outro ano) */
  function mesAtual(ano) {
    var hoje = new Date();
    return hoje.getFullYear() === ano ? hoje.getMonth() : -1;
  }

  /* um selo por afastamento que toca o mês */
  function preencherCelula(celula, afs, ano, mes) {
    var ini = ano + '-' + p2(mes + 1) + '-01';
    var fim = ano + '-' + p2(mes + 1) + '-' + p2(new Date(ano, mes + 1, 0).getDate());
    afs.forEach(function (af) {
      if (af.fim < ini || af.inicio > fim) return;
      var de = af.inicio > ini ? af.inicio : ini, ate = af.fim < fim ? af.fim : fim;
      var selo = RW.tpl('tpl-afastamentos-selo');
      if (!selo) return;
      selo.querySelector('.afastamentos-selo-nome').textContent = af.nome;
      selo.querySelector('.afastamentos-selo-dias').textContent = M().diasDoMes(de.slice(8, 10), ate.slice(8, 10));
      selo.setAttribute('data-dica', M().dicaSelo(af.nome, D().isoParaBR(af.inicio), D().isoParaBR(af.fim)));
      selo.setAttribute('data-af', af.chave);
      if (af.mudou) selo.classList.add('afastamentos-selo--rascunho');
      celula.appendChild(selo);
    });
  }

  /* a grade da unidade. c = { ano, afastamentos(pessoa), busca(pessoa), podeMudar(pessoa), abrirFicha(el, pessoa),
     marcar(el, pessoa), contar(), aoClicarCelula(celula, pessoa, evento) }. Devolve quantos militares entraram */
  function desenhar(container, pessoas, c) {
    var grade = RW.tpl('tpl-afastamentos-grade');
    if (!grade || !pessoas.length) return 0;
    var cabecalho = grade.querySelector('.afastamentos-grade-cabecalho');
    var atual = mesAtual(c.ano);
    M().meses.forEach(function (nome, i) {
      var mes = RW.tpl('tpl-afastamentos-mes');
      if (!mes) return;
      mes.querySelector('.afastamentos-mes-nome').textContent = nome;
      if (i === atual) mes.classList.add('afastamentos-mes--atual');
      cabecalho.appendChild(mes);
    });
    pessoas.forEach(function (p) {
      var afs = c.afastamentos(p);
      var linha = RW.tpl('tpl-escala-mil-pessoa');
      if (!linha) return;
      linha.setAttribute('data-cpf', p.usuario_id);
      var coluna = linha.querySelector('.escala-mil-pessoa');
      coluna.classList.add('afastamentos-pessoa');
      coluna.setAttribute('role', 'button');
      coluna.setAttribute('tabindex', '0');
      linha.querySelector('.escala-mil-avatar').textContent = iniciais(p.nome_de_guerra);
      linha.querySelector('.escala-mil-pessoa-grad').textContent = p.grau_abreviacao || '';
      linha.querySelector('.escala-mil-pessoa-nome').textContent = p.nome_de_guerra || '';
      linha.querySelector('.escala-mil-pessoa-cpf').textContent = formatarCpf(p.usuario_id);
      var total = diasNoAno(afs, c.ano);
      var selo = linha.querySelector('.escala-mil-pessoa-dias');
      selo.textContent = total ? String(total) : '';
      selo.classList.toggle('oculto', !total);
      if (total) selo.setAttribute('data-dica', M().diasNoAno(total, c.ano));
      var busca = c.busca(p);
      if (busca === 'marcar') coluna.classList.add('linha-militar--marcada');
      if (busca === 'marcar' || busca === 'casa') coluna.classList.add('busca-achado');
      coluna.addEventListener('click', function () { c.abrirFicha(coluna, p); });
      coluna.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); c.abrirFicha(coluna, p); }
      });
      c.marcar(coluna, p);
      var pode = c.podeMudar(p);
      for (var m = 0; m < 12; m++) {
        var celula = RW.tpl('tpl-escala-mil-celula');
        if (!celula) continue;
        celula.classList.add('afastamentos-celula');
        celula.setAttribute('data-cpf', p.usuario_id);
        celula.setAttribute('data-mes', String(m));
        if (m === atual) celula.classList.add('afastamentos-celula--atual');
        if (pode) {
          celula.classList.add('afastamentos-celula--clicavel');
          celula.addEventListener('click', function (ev) { c.aoClicarCelula(ev.currentTarget, p, ev); });
        }
        preencherCelula(celula, afs, c.ano, m);
        linha.appendChild(celula);
      }
      grade.appendChild(linha);
      c.contar();
    });
    container.appendChild(grade);
    return pessoas.length;
  }

  /* no celular: a lista (o militar e, embaixo, um afastamento do ano por linha); o toque abre a ficha */
  function desenharLista(container, pessoas, c) {
    var bloquinho = RW.tpl('tpl-arvore-bloquinho');
    if (!bloquinho || !pessoas.length) return 0;
    pessoas.forEach(function (p) {
      var item = RW.tpl('tpl-usuario-afastamento-item');
      if (!item) return;
      item.querySelector('.usuario-item-grad').textContent = p.grau_abreviacao || '';
      item.querySelector('.usuario-item-nome').textContent = p.nome_de_guerra || '';
      var pilha = item.querySelector('.usuario-afastamento-pilha');
      c.afastamentos(p).forEach(function (af) {
        var l = RW.tpl('tpl-usuario-afastamento-linha');
        if (!l) return;
        l.querySelector('.usuario-afastamento-texto').textContent = af.nome + ' · ' + textoDatas(af.inicio, af.fim, c.ano);
        l.querySelector('.usuario-afastamento-dias').textContent = M().dias(diasNoAno([af], c.ano));
        pilha.appendChild(l);
      });
      if (c.lendo()) pilha.appendChild(RW.tpl('tpl-esqueleto-afastamento'));
      var busca = c.busca(p);
      if (busca === 'marcar') item.classList.add('linha-militar--marcada');
      if (busca === 'marcar' || busca === 'casa') item.classList.add('busca-achado');
      item.classList.add('linha-militar--clicavel');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', function () { c.abrirFicha(item, p); });
      c.marcar(item, p);
      bloquinho.appendChild(item);
      c.contar();
    });
    container.appendChild(bloquinho);
    return pessoas.length;
  }

  window.RosterWork.usuariosAfastamentosGrade = {
    desenhar: desenhar, desenharLista: desenharLista, textoDatas: textoDatas, diasNoAno: diasNoAno
  };
})();
