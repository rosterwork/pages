/* ============================================================
   AFASTAMENTOS — a grade do ano e a do mês
   (RosterWork.afastamentosGrade)
   Dentro do bloco de cada unidade da árvore, a grade da aba Militares
   da Escala: a coluna do militar (presa à esquerda, com o selo cinza
   dos dias afastado no período) e o cabeçalho preso no alto ao rolar.
   No Ano, os meses no lugar dos dias (o de hoje escuro; o nome abre a
   caixa do mês) e, em cada mês, um selo por afastamento: o listrado
   do afastado, o nome e os dias daquele mês ("Férias 14 a 30"; o que
   passa de um mês ao outro aparece nos dois). No Mês, os dias (a sigla
   do dia da semana e o número; hoje no círculo escuro; sábado e
   domingo sombreados) e cada afastamento numa barra contínua, do
   primeiro ao último dia dele no mês, com o nome e os dias (o de 1 ou
   2 dias só com o listrado; dois que se cruzam, um embaixo do outro).
   O que ainda não foi salvo leva a canaleta. O clique no militar abre
   o painel dele; na célula e na barra, a caixa (quem administra o militar;
   afastamentos-celula.js). No celular, a lista: o militar e,
   embaixo, um afastamento do período por linha.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

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

  /* os dias de a até b (as duas datas inclusas) */
  function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000) + 1; }

  /* os dias dos afastamentos dentro do período */
  function diasNoPeriodo(afs, ini, fim) {
    var total = 0;
    afs.forEach(function (af) {
      var a = af.inicio > ini ? af.inicio : ini, b = af.fim < fim ? af.fim : fim;
      if (b >= a) total += diasEntre(a, b);
    });
    return total;
  }
  function diasNoAno(afs, ano) { return diasNoPeriodo(afs, ano + '-01-01', ano + '-12-31'); }
  /* a Autorização de viagem não é afastamento: fica fora dos dias afastado (o selo cinza e o Resumo do ano) */
  function afastado(af) { return af.padrao !== 'viagem'; }
  /* a dica de um afastamento: o nome e as datas inteiras e, embaixo, o que ele deixa nesses dias (as marcas); a da
     autorização de viagem, com os destinos e "Só sai do sobreaviso" */
  function dica(af) {
    if (!afastado(af)) return M().viagem.dica(D().isoParaBR(af.inicio), D().isoParaBR(af.fim), af.destinos);
    return M().dicaSelo(af.nome, D().isoParaBR(af.inicio), D().isoParaBR(af.fim)) + '\n'
      + M().marcas({ escala: true, gua: af.gua, tro: af.tro, ext: af.ext, sob: af.sob });
  }

  /* o mês de hoje no ano da tela (-1 em outro ano) */
  function mesAtual(ano) {
    var hoje = new Date();
    return hoje.getFullYear() === ano ? hoje.getMonth() : -1;
  }

  /* um selo: o nome, os dias no mês e a dica com as datas inteiras e as marcas; a autorização de viagem sem o listrado,
     com o ícone do mapa */
  function selo(af, de, ate) {
    var s = RW.tpl('tpl-afastamentos-selo');
    if (!s) return null;
    s.querySelector('.afastamentos-selo-texto').textContent = af.nome;
    if (!afastado(af)) {
      s.classList.add('afastamentos-selo--viagem');
      s.querySelector('.afastamentos-selo-icone').classList.remove('oculto');
    }
    s.querySelector('.afastamentos-selo-dias').textContent = M().diasDoMes(de.slice(8, 10), ate.slice(8, 10));
    s.setAttribute('data-dica', dica(af));
    s.setAttribute('data-af', af.chave);
    if (af.mudou) s.classList.add('afastamentos-selo--rascunho');
    return s;
  }

  /* um selo por afastamento que toca o mês */
  function preencherCelula(celula, afs, ano, mes) {
    var ini = ano + '-' + p2(mes + 1) + '-01';
    var fim = ano + '-' + p2(mes + 1) + '-' + p2(new Date(ano, mes + 1, 0).getDate());
    afs.forEach(function (af) {
      if (af.fim < ini || af.inicio > fim) return;
      var s = selo(af, af.inicio > ini ? af.inicio : ini, af.fim < fim ? af.fim : fim);
      if (s) celula.appendChild(s);
    });
  }

  /* a coluna do militar: o avatar, o posto e o nome, o CPF e o selo cinza dos dias afastado no período (a dica diz o
     período); o clique abre o painel dele. Devolve a linha da grade, sem as células */
  function linhaDoMilitar(p, c, total, dica) {
    var linha = RW.tpl('tpl-escala-mil-pessoa');
    if (!linha) return null;
    linha.setAttribute('data-cpf', p.usuario_id);
    var coluna = linha.querySelector('.escala-mil-pessoa');
    coluna.classList.add('afastamentos-pessoa');
    coluna.setAttribute('role', 'button');
    coluna.setAttribute('tabindex', '0');
    linha.querySelector('.escala-mil-avatar').textContent = iniciais(p.nome_de_guerra);
    linha.querySelector('.escala-mil-pessoa-grad').textContent = p.grau_abreviacao || '';
    linha.querySelector('.escala-mil-pessoa-nome').textContent = p.nome_de_guerra || '';
    linha.querySelector('.escala-mil-pessoa-cpf').textContent = formatarCpf(p.usuario_id);
    var dias = linha.querySelector('.escala-mil-pessoa-dias');
    dias.textContent = total ? String(total) : '';
    dias.classList.toggle('oculto', !total);
    if (total) dias.setAttribute('data-dica', dica);
    var busca = c.busca(p);
    if (busca === 'marcar') coluna.classList.add('linha-militar--marcada');
    if (busca === 'marcar' || busca === 'casa') coluna.classList.add('busca-achado');
    coluna.addEventListener('click', function () { c.abrirPainel(coluna, p); });
    coluna.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); c.abrirPainel(coluna, p); }
    });
    c.marcar(coluna, p);
    return linha;
  }

  /* a grade do ano da unidade. c = { ano, afastamentos(pessoa), busca(pessoa), podeMudar(pessoa), abrirPainel(el, pessoa),
     marcar(el, pessoa), contar(), aoClicarCelula(celula, pessoa, evento), aoClicarMes(botao, mes) }. Devolve quantos
     militares entraram */
  function desenhar(container, pessoas, c) {
    var grade = RW.tpl('tpl-afastamentos-grade');
    if (!grade || !pessoas.length) return 0;
    var cabecalho = grade.querySelector('.afastamentos-grade-cabecalho');
    var atual = mesAtual(c.ano);
    M().meses.forEach(function (nome, i) {
      var mes = RW.tpl('tpl-afastamentos-mes');
      if (!mes) return;
      var botao = mes.querySelector('.afastamentos-mes-nome');
      botao.textContent = nome;
      botao.addEventListener('click', function () { c.aoClicarMes(botao, i); });
      if (i === atual) mes.classList.add('afastamentos-mes--atual');
      cabecalho.appendChild(mes);
    });
    pessoas.forEach(function (p) {
      var afs = c.afastamentos(p);
      var total = diasNoAno(afs.filter(afastado), c.ano);
      var linha = linhaDoMilitar(p, c, total, M().diasNoAno(total, c.ano));
      if (!linha) return;
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

  /* a faixa de cada barra: a primeira em que ela não cruza com a de antes (dois do mesmo militar que se cruzam ficam um
     embaixo do outro) */
  function emFaixas(barras) {
    var fins = [];
    barras.forEach(function (b) {
      var f = 0;
      while (fins[f] !== undefined && fins[f] >= b.de) f++;
      fins[f] = b.ate;
      b.faixa = f;
    });
    return fins.length;
  }

  /* a grade do mês da unidade (o mesmo c da do ano, com o mes e o periodo). Devolve quantos militares entraram */
  function desenharMes(container, pessoas, c) {
    var grade = RW.tpl('tpl-afastamentos-grade');
    if (!grade || !pessoas.length) return 0;
    grade.classList.add('afastamentos-grade--mes');
    var cabecalho = grade.querySelector('.afastamentos-grade-cabecalho');
    var n = new Date(c.ano, c.mes + 1, 0).getDate();
    var hoje = new Date();
    var diaHoje = hoje.getFullYear() === c.ano && hoje.getMonth() === c.mes ? hoje.getDate() : 0;
    var fds = {};
    for (var d = 1; d <= n; d++) {
      var semana = new Date(c.ano, c.mes, d).getDay();
      fds[d] = semana === 0 || semana === 6;
      var dia = RW.tpl('tpl-escala-mil-dia');
      if (!dia) continue;
      dia.classList.add('afastamentos-dia');
      dia.querySelector('.escala-mil-dia-semana').textContent = SEMANA[semana];
      dia.querySelector('.escala-mil-dia-numero').textContent = String(d);
      if (fds[d]) dia.classList.add('escala-mil-dia--fds');
      if (d === diaHoje) dia.classList.add('escala-mil-dia--hoje');
      cabecalho.appendChild(dia);
    }
    var ini = c.periodo.inicio, fim = c.periodo.fim;
    var prefixo = c.periodo.inicio.slice(0, 8);
    pessoas.forEach(function (p) {
      var afs = c.afastamentos(p);
      var total = diasNoPeriodo(afs.filter(afastado), ini, fim);
      var linha = linhaDoMilitar(p, c, total, M().diasNoMes(total, c.mes));
      if (!linha) return;
      linha.classList.add('afastamentos-linha-mes');
      var coluna = linha.querySelector('.escala-mil-pessoa');
      var pode = c.podeMudar(p);
      for (var k = 1; k <= n; k++) {
        var celula = RW.tpl('tpl-escala-mil-celula');
        if (!celula) continue;
        celula.classList.add('afastamentos-celula');
        celula.setAttribute('data-cpf', p.usuario_id);
        celula.setAttribute('data-dia', prefixo + p2(k));
        if (fds[k]) celula.classList.add('escala-mil-celula--fds');
        if (pode) {
          celula.classList.add('afastamentos-celula--clicavel');
          celula.addEventListener('click', function (ev) { c.aoClicarCelula(ev.currentTarget, p, ev); });
        }
        linha.appendChild(celula);
      }
      /* as barras: do primeiro ao último dia no mês, por cima das células (a coluna e o tamanho em custom properties
         de dado; antes da coluna do militar, que fica por cima ao rolar para o lado) */
      var barras = afs.map(function (af) {
        var de = af.inicio > ini ? af.inicio : ini, ate = af.fim < fim ? af.fim : fim;
        return { af: af, de: Number(de.slice(8, 10)), ate: Number(ate.slice(8, 10)), deIso: de, ateIso: ate };
      }).sort(function (a, b) { return a.de - b.de; });
      linha.style.setProperty('--faixas', String(Math.max(1, emFaixas(barras))));
      barras.forEach(function (b) {
        var s = selo(b.af, b.deIso, b.ateIso);
        if (!s) return;
        s.classList.add('afastamentos-barra');
        if (b.ate - b.de < 2) s.classList.add('afastamentos-barra--curta');
        s.setAttribute('data-dia', b.deIso);
        s.style.setProperty('--barra-coluna', String(b.de + 1));
        s.style.setProperty('--barra-dias', String(b.ate - b.de + 1));
        s.style.setProperty('--barra-faixa', String(b.faixa));
        if (pode) {
          s.classList.add('afastamentos-barra--clicavel');
          s.addEventListener('click', function (ev) { c.aoClicarCelula(s, p, ev); });
        }
        linha.insertBefore(s, coluna);
      });
      grade.appendChild(linha);
      c.contar();
    });
    container.appendChild(grade);
    return pessoas.length;
  }

  /* no celular: a lista (o militar e, embaixo, um afastamento do período por linha); o toque abre o painel dele */
  function desenharLista(container, pessoas, c) {
    var bloquinho = RW.tpl('tpl-arvore-bloquinho');
    if (!bloquinho || !pessoas.length) return 0;
    pessoas.forEach(function (p) {
      var item = RW.tpl('tpl-afastamentos-item');
      if (!item) return;
      item.querySelector('.linha-militar-grad').textContent = p.grau_abreviacao || '';
      item.querySelector('.linha-militar-nome').textContent = p.nome_de_guerra || '';
      var pilha = item.querySelector('.afastamentos-item-pilha');
      c.afastamentos(p).forEach(function (af) {
        var l = RW.tpl('tpl-afastamentos-item-linha');
        if (!l) return;
        l.querySelector('.afastamentos-item-texto').textContent = af.nome + ' · ' + textoDatas(af.inicio, af.fim, c.ano);
        l.querySelector('.afastamentos-item-dias').textContent = M().dias(diasNoPeriodo([af], c.periodo.inicio, c.periodo.fim));
        l.setAttribute('data-dica', dica(af));   // segurando o dedo na linha
        pilha.appendChild(l);
      });
      if (c.lendo()) pilha.appendChild(RW.tpl('tpl-esqueleto-afastamento'));
      var busca = c.busca(p);
      if (busca === 'marcar') item.classList.add('linha-militar--marcada');
      if (busca === 'marcar' || busca === 'casa') item.classList.add('busca-achado');
      item.classList.add('linha-militar--clicavel');
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', function () { c.abrirPainel(item, p); });
      c.marcar(item, p);
      bloquinho.appendChild(item);
      c.contar();
    });
    container.appendChild(bloquinho);
    return pessoas.length;
  }

  window.RosterWork.afastamentosGrade = {
    desenhar: desenhar, desenharMes: desenharMes, desenharLista: desenharLista, textoDatas: textoDatas,
    diasNoAno: diasNoAno, diasNoPeriodo: diasNoPeriodo, afastado: afastado, dica: dica
  };
})();
