/* ============================================================
   EXTRAJORNADA — a barra de horário de uma extra
   A barra do dia (componente geral-regua) no lugar das 4 bolinhas:
   na linha do painel do dia, nos outros dias dele, nas datas da
   lista dos voluntários e no calendário do militar em foco. As
   regras da extra: o clique entre dois riscos faz o que a bolinha
   fazia (o horário de 6 horas ao lado entra, o da ponta sai, um longe
   faz a faixa crescer até ele, sem buraco; quem pediu 24 horas
   seguidas recebe o dia todo de uma vez); a bolinha do fim anda de 6
   em 6 horas; a do começo para nas divisas de 6 horas e, para o
   administrativo no dia em que o expediente termina antes, na hora
   em que ele termina. Com o pedido aberto só dá para tirar; na
   Distribuição lançada e no dia de mais de 7 dias atrás, só ver. As
   bolinhas de arrastar aparecem com o mouse em cima e na barra
   escolhida (a última mexida ou a linha clicada), que no painel do
   dia também mostra o seletor de horas e, depois dele, o cadeado e a
   lixeira. O cadeado aberto deixa o horário livre: a bolinha e o
   campo do começo andam de hora em hora e levam a extra junto (as
   cotas não mudam), e o clique põe ou tira 6 horas pela ponta mais
   perto; fechado, volta ao horário padrão (o risco mais perto). A
   lixeira tira os horários dele no dia. Muda o rascunho por
   RosterWork.extrajornadaGrade.mudar. RosterWork.extrajornadaBarra.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var escolhida = '';   // 'cpf|data|lugar' da última barra mexida ou escolhida (lugar: painel, lista, calendario ou caixa)
  var livres = {};      // as barras com o cadeado aberto: 'cpf|data' -> true

  function G() { return RW.extrajornadaGrade; }
  function H() { return RW.horario; }
  function msg() { return RW.mensagens.extrajornada.org; }

  /* refaz o lugar de uma barra: o painel do dia, a lista dos voluntários, o dia do calendário ou a caixa da célula */
  function refazer(lugar, k) {
    if (lugar === 'lista') { if (RW.extrajornadaMontar && document.querySelector('#p3-esq')) RW.extrajornadaMontar.redesenhar(true); }
    else if (lugar === 'calendario') { if (RW.extrajornadaPorDia) RW.extrajornadaPorDia.atualizarDia(k); }
    else if (lugar === 'caixa') { if (RW.extrajornadaCelula) RW.extrajornadaCelula.redesenhar(); }
    else if (RW.extrajornadaDia) RW.extrajornadaDia.redesenhar();
  }
  /* a escolha passou para outra barra: o lugar da de antes perde o seletor de horas (o mesmo lugar já foi refeito) */
  function largar(antes, agora) {
    if (!antes || antes === agora) return;
    var a = antes.split('|'), b = agora.split('|');
    if (a[2] === b[2] && (a[2] !== 'calendario' || a[1] === b[1])) return;
    refazer(a[2], a[1]);
  }
  /* a dica da parte acesa da barra: o horário da extra ("10h às 16h"; o dia todo, "08h às 08h") */
  function dicaDaFaixa(f) { return RW.regua.textoHora(f.ini) + ' às ' + RW.regua.textoHora(f.fim); }

  function seguidos(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  /* a hora do relógio ("12:00") em horas desde as 08h */
  function hora(t) { return H().emMin(t) / 60; }
  /* a faixa dos horários: do começo (o fim do expediente ou o primeiro horário), 6 horas por horário */
  function faixaDe(bs, inicio) {
    if (!bs.length) return null;
    var ini = inicio ? hora(inicio) : (bs[0] - 1) * 6;
    return { ini: ini, fim: ini + 6 * bs.length, blocos: bs, inicio: inicio || null };
  }
  /* o começo que o rascunho põe sozinho (o mesmo de quando os horários mudam): com 2 horários, o fim do expediente */
  function inicioPadrao(m, k, bs) {
    var ds = bs.length === 2 ? G().desde(m, k) : null;
    return ds && G().inicioCabe(m, k, bs) ? ds : null;
  }
  /* o começo é uma parada do horário preso: o risco (sem começo próprio) ou o fim do expediente do administrativo */
  function presoNoRisco(m, k, bs, inicio) { return !inicio || (inicio === G().desde(m, k) && G().inicioCabe(m, k, bs)); }
  /* o horário livre: começa em h0 (horas desde as 08h) e dura n cotas; os horários de 6 h vão do risco seguinte em
     diante e o começo fica de 1 a 5 horas antes dele (no risco, sem começo próprio), como o banco guarda */
  function livre(h0, n) {
    var b1 = Math.ceil(h0 / 6) + 1;
    return { ini: h0, fim: h0 + 6 * n, blocos: seguidos(b1, b1 + n - 1), inicio: h0 % 6 ? H().hhmm(h0 * 60) : null };
  }

  /* o que o clique, o arrasto e o teclado fazem com os horários bs (começando em inicio); solto: o cadeado aberto. A
     extra nunca entra nas horas de serviço de parte do dia (o pontual e o que sobra da folga de parte do dia) */
  function regras(m, k, bs, inicio, travado, solto) {
    var ultimo = bs.length ? bs[bs.length - 1] : 0;
    function cabe(f) { return !f || !f.blocos.length || G().foraDoServico(m, k, f.ini, f.fim); }
    /* as paradas da bolinha do começo: as divisas de 6 horas até o último horário e o fim do expediente; livre, toda hora
       em que a extra inteira ainda cabe no dia */
    function comecos() {
      var lista = [];
      if (solto) {
        for (var h0 = 0; bs.length && h0 + 6 * bs.length <= 24; h0++) {
          var l = livre(h0, bs.length);
          if (cabe(l)) lista.push({ pos: h0, blocos: l.blocos, inicio: l.inicio });
        }
        return lista;
      }
      for (var b = 1; b <= ultimo; b++) lista.push({ pos: (b - 1) * 6, blocos: seguidos(b, ultimo), inicio: null });
      var ds = G().desde(m, k);
      for (var c = 1; ds && c <= ultimo; c++) {
        if (G().inicioCabe(m, k, seguidos(c, ultimo))) { lista.push({ pos: hora(ds), blocos: seguidos(c, ultimo), inicio: ds }); break; }
      }
      if (travado) lista = lista.filter(function (x) { return x.blocos.every(function (y) { return bs.indexOf(y) >= 0; }); });
      lista = lista.filter(function (x) { return cabe(faixaDe(x.blocos, x.inicio)); });
      return lista.sort(function (x, y) { return x.pos - y.pos; });
    }
    /* as paradas da bolinha do fim: de 6 em 6 horas desde o começo, até as 08h do dia seguinte (ou até o serviço) */
    function fins(f) {
      var lista = [], max = Math.min(solto ? 4 : 5 - bs[0], Math.floor((24 - f.ini) / 6), travado ? bs.length : 4);
      for (var n = 1; n <= max && G().foraDoServico(m, k, f.ini, f.ini + 6 * n); n++) lista.push(f.ini + 6 * n);
      return lista;
    }
    /* livre: dentro da faixa, sai 6 horas pela ponta mais perto (a última tira ele do dia); fora, ela cresce até a hora
       clicada, 6 horas por vez, no que ainda cabe no dia */
    function cliqueLivre(h) {
      var f = faixaDe(bs, inicio), n = bs.length;
      if (h >= f.ini && h < f.fim) {
        if (n === 1) return { ini: 0, fim: 0, blocos: [], inicio: null, padrao: true };
        return h - f.ini < f.fim - 1 - h ? livre(f.ini + 6, n - 1) : livre(f.ini, n - 1);
      }
      if (travado) return null;
      var maior = null;
      if (h >= f.fim) {
        var depois = Math.min(Math.ceil((h + 1 - f.fim) / 6), Math.floor((24 - f.fim) / 6));
        if (depois > 0) maior = livre(f.ini, n + depois);
      } else {
        var antes = Math.min(Math.ceil((f.ini - h) / 6), Math.floor(f.ini / 6));
        if (antes > 0) maior = livre(f.ini - 6 * antes, n + antes);
      }
      return maior && cabe(maior) ? maior : null;
    }
    var r = {
      comecos: comecos,
      fins: fins,
      clique: function (h) {
        if (solto && bs.length) return cliqueLivre(h);
        var p = Math.floor(h / 6) + 1, novos, poe = bs.indexOf(p) < 0;
        if (!poe) {
          if (p !== bs[0] && p !== ultimo) return null;   // o do meio não abre buraco
          novos = bs.filter(function (x) { return x !== p; });
        } else {
          if (travado) return null;   // com o pedido aberto, só dá para tirar
          var inteiro = m.so24 && !bs.length && (m.concedidas || 0) - G().usadas(m.cpf) >= 4;
          var todos = bs.concat([p]);
          novos = inteiro ? [1, 2, 3, 4] : seguidos(Math.min.apply(null, todos), Math.max.apply(null, todos));
        }
        var f = faixaDe(novos, inicioPadrao(m, k, novos)) || { ini: 0, fim: 0, blocos: [], inicio: null };
        if (poe && !cabe(f)) return null;   // tirar sempre pode; pôr, só fora do serviço
        f.padrao = true;   // o começo fica com o rascunho, como nas bolinhas
        return f;
      },
      arrastar: function (qual, pos, f) {
        if (qual === 'fim') {
          var lista = fins(f), perto = lista.reduce(function (a, x) { return a == null || Math.abs(x - pos) < Math.abs(a - pos) ? x : a; }, null);
          if (perto == null) return null;
          if (solto) return livre(f.ini, (perto - f.ini) / 6);
          var novos = seguidos(bs[0], bs[0] + (perto - f.ini) / 6 - 1);
          return faixaDe(novos, inicio && G().inicioCabe(m, k, novos) ? inicio : null);
        }
        var c = comecos().reduce(function (a, x) { return !a || Math.abs(x.pos - pos) < Math.abs(a.pos - pos) ? x : a; }, null);
        return c ? faixaDe(c.blocos, c.inicio) : null;
      },
      passo: function (qual, dir, f) {
        if (qual === 'fim') return r.arrastar('fim', f.fim + 6 * dir, f);
        var lista = comecos(), i = -1;
        lista.forEach(function (x, j) { if (x.pos === f.ini) i = j; });
        var c = i < 0 ? null : lista[i + dir];
        return c ? faixaDe(c.blocos, c.inicio) : null;
      }
    };
    return r;
  }

  /* a barra na caixa (o lugar das bolinhas). opcoes = { campos (o seletor de horas na barra escolhida), lugar ('painel',
     'lista', 'calendario' ou 'caixa', a caixa 2 da célula; o painel sem ele), linha (o que o clique escolhe; no painel, a
     linha do militar), desligado, semLixeira (a caixa da célula: o Remover fica no menu dela) } */
  function ligar(caixa, m, k, marcados, uid, opcoes) {
    opcoes = opcoes || {};
    var v = G().vagaDe(m.cpf, k);
    var bs = marcados.map(Number).sort(function (a, b) { return a - b; });
    var inicio = v && bs.length ? (v.inicio || null) : null;
    var editavel = !opcoes.desligado && !G().soLeitura() && !G().antigo(k);
    var lugar = opcoes.lugar || 'painel', solta = m.cpf + '|' + k, minha = solta + '|' + lugar, faixa = faixaDe(bs, inicio);
    /* livre: o cadeado aberto, ou o começo fora dos riscos (a extra que já começa em qualquer hora) */
    var solto = !!faixa && (!!livres[solta] || !presoNoRisco(m, k, bs, inicio));
    var rg = regras(m, k, bs, inicio, G().travado(), solto);
    caixa.textContent = '';
    caixa.classList.add('extrajornada-marcas', 'extrajornada-regua');
    caixa.classList.toggle('extrajornada-regua--quieta', escolhida !== minha);
    function aplicar(f) {
      var antes = escolhida;
      escolhida = minha;
      if (f.padrao) G().mudar(m, k, f.blocos, uid);
      else G().mudar(m, k, f.blocos, uid, f.inicio);
      largar(antes, minha);
    }
    function escolher() {
      var antes = escolhida;
      escolhida = minha;
      refazer(lugar, k);
      largar(antes, minha);
    }
    /* nas datas da lista e nas células, a barra compacta (no painel e na caixa, a inteira); os campos de hora (na barra
       escolhida) seguem a bolinha enquanto ela anda */
    var campos = [];
    var barra = RW.regua.criar({ horas: false, regras: rg, aoMudar: aplicar, dicaFaixa: dicaDaFaixa,
      variante: lugar === 'painel' || lugar === 'caixa' ? null : 'compacta',
      aoArrastar: function (f) {
        if (campos.length < 2) return;
        campos[0].textContent = RW.regua.textoHora(f.ini);
        campos[1].textContent = RW.regua.textoHora(f.fim);
      } });
    if (!barra) return;
    /* as horas de serviço de parte do dia no fundo, em cinza (o que já existe no dia) */
    barra.desenhar({ faixa: faixa, editavel: editavel, fundo: G().horasServico(m, k) });
    caixa.appendChild(barra.el);
    /* no calendário e na lista, mexer na barra não abre nem fecha mais nada (os campos de hora seguem o caminho de sempre) */
    caixa.addEventListener('click', function (ev) { if (ev.target.closest('.regua-barra')) ev.stopPropagation(); });
    if (!opcoes.campos || !editavel || !faixa) return;
    /* a barra que não é a escolhida: clicar na linha dela, fora da barra, dos botões e dos outros dias, escolhe a barra
       sem mudar nada */
    if (escolhida !== minha) {
      var lin = opcoes.linha || caixa.closest('.extrajornada-painel-militar');
      if (!lin) return;
      lin.classList.add('extrajornada-escolhivel');
      lin.addEventListener('click', function (ev) {
        if (ev.target.closest('.regua-barra, button, .dropdown, .extrajornada-painel-outros')) return;
        escolher();
      });
      return;
    }
    /* a barra escolhida: o seletor de horas embaixo, com as paradas das bolinhas, e, depois dele, o cadeado e a lixeira,
       que tira os horários dele no dia (fica cinza até o Salvar) */
    var texto = function (h) { return H().hhmm(h * 60).slice(0, 2); };
    var linha = H().linha({
      hi: H().hhmm(faixa.ini * 60), hf: H().hhmm(faixa.fim * 60), semAcoes: true,
      opcoes: { inicios: rg.comecos().map(function (c) { return texto(c.pos); }), fins: rg.fins(faixa).map(texto) },
      aoInicio: function (t) { var f = rg.arrastar('ini', hora(t), faixa); if (f) aplicar(f); },
      aoFim: function (t) { var p = hora(t); if (p <= faixa.ini) p += 24; var f = rg.arrastar('fim', p, faixa); if (f) aplicar(f); }
    });
    if (!linha) return;
    campos = Array.prototype.slice.call(linha.querySelectorAll('.dropdown-numeros-btn'));
    /* o cadeado: aberto, o horário livre; fechado, preso nos riscos. Com o pedido aberto só dá para tirar: sem cadeado */
    var cadeado = G().travado() ? null : RW.tpl('tpl-extrajornada-livre');
    if (cadeado) {
      var dica = solto ? msg().voltarHorarioPadrao : msg().liberarHorario;
      cadeado.setAttribute('aria-label', dica);
      cadeado.setAttribute('data-dica', dica);
      cadeado.querySelector('.extrajornada-painel-livre-preso').classList.toggle('oculto', solto);
      cadeado.querySelector('.extrajornada-painel-livre-solto').classList.toggle('oculto', !solto);
      cadeado.addEventListener('click', function () {
        if (!solto) { livres[solta] = true; escolher(); return; }
        delete livres[solta];
        if (presoNoRisco(m, k, bs, inicio)) { escolher(); return; }
        /* o horário padrão: o começo no risco mais perto, com as mesmas cotas */
        var h0 = Math.min(6 * Math.round(faixa.ini / 6), 24 - 6 * bs.length);
        aplicar({ blocos: seguidos(h0 / 6 + 1, h0 / 6 + bs.length), padrao: true });
      });
      linha.appendChild(cadeado);
    }
    var lixeira = opcoes.semLixeira ? null : RW.tpl('tpl-extrajornada-remover');
    if (lixeira) {
      lixeira.addEventListener('click', function () { aplicar({ blocos: [], padrao: true }); });
      linha.appendChild(lixeira);
    }
    caixa.appendChild(linha);
  }

  RW.extrajornadaBarra = {
    ligar: ligar,
    /* a barra escolhida ('cpf|data|lugar') e a escolha de outra, que tira o seletor de horas da de antes: o cartão aberto
       do militar em foco no calendário (extrajornada-por-dia.js) */
    escolhida: function () { return escolhida; },
    escolher: function (chave) { var antes = escolhida; escolhida = chave; largar(antes, chave); },
    /* outro dia abriu, o Salvar ou o Cancelar: nenhuma barra fica escolhida nem com o cadeado aberto */
    esquecer: function () { escolhida = ''; livres = {}; }
  };
})();
