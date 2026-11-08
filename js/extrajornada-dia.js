/* ============================================================
   EXTRAJORNADA — o painel do dia (uma unidade num dia)
   O mesmo na Distribuição, nos Ajustes e na aba Extrajornada do painel
   do dia da Escala: a Cobertura do dia (as barras sem extra e com
   extra, sempre à vista, e, aberta, o relatório do dia: quem foi
   colocado, o que ainda falta e quem ainda pode), a busca e a lista em
   grupos (Neste dia, Querem este dia, Sem preferência, Não querem e
   Indisponíveis; menos o Neste dia, cada grupo dividido por pelotão),
   cada militar com as cotas e os 4 horários deste dia, que marcam e
   desmarcam. Clicar nas cotas abre os outros dias dele
   (extrajornada-dia-outros.js). A linha fica no grupo em que estava até
   o Salvar, para o clique seguinte não cair em outro militar. Todas as
   caixas abrem e fecham pelo título e começam abertas ou fechadas pela
   cor do dia. Lê e muda o rascunho por RosterWork.extrajornadaGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var GRUPOS = ['neste', 'querem', 'disp', 'naoQuerem', 'indisp'];

  var aberto = null;       // o painel do dia: { uid, data }
  var ultimoDia = '';      // o dia das caixas e dos grupos guardados (uid|data)
  var caixas = {};         // as caixas abertas do dia aberto { caixa: true }
  var fixos = {};          // o grupo de cada militar no dia aberto: cpf -> { nome, motivo }
  var buscaTermo = '', buscaModo = 'marcar';   // a busca do painel

  /* como as caixas começam ao abrir um dia, pela cor dele: com o que resolver (vermelho ou amarelo), a Cobertura aberta,
     com o relatório; sem (verde ou sem cor), fechada, só com os gráficos. O Neste dia aberto quando tem alguém e fechado
     quando está vazio (até ser aberto ou fechado no clique); Querem este dia aberto; os outros grupos, fechados */
  function caixasDoInicio(uid, k) {
    var cor = G().corDe(G().faltaDoDia(uid, k, G().efetivas()));
    return { cobertura: cor === 'erro' || cor === 'alerta', querem: true, disp: false, naoQuerem: false, indisp: false };
  }

  function msg() { return RW.mensagens.extrajornada.org; }
  function u() { return RW.extrajornadaUtil; }
  function G() { return RW.extrajornadaGrade; }

  /* o que for aberto ou fechado vale enquanto o mesmo dia estiver aberto (mesmo que ele mude de cor); outro dia
     começa pela cor dele */
  function entrarNoDia(uid, k) {
    var dia = uid + '|' + k;
    if (dia !== ultimoDia) {
      ultimoDia = dia;
      caixas = caixasDoInicio(uid, k);
      reorganizar();
    }
    aberto = { uid: uid, data: k };
  }

  /* os grupos voltam a ser os de agora, e as linhas abertas fecham: outro dia, o Salvar, o Cancelar ou a sugestão */
  function reorganizar() {
    fixos = {};
    if (RW.extrajornadaDiaOutros) RW.extrajornadaDiaOutros.esquecer();
  }

  /* no painel que a Extrajornada abre (Distribuição e Ajustes). Uma escolha por vez: abrir um dia tira o militar do foco
     (extrajornada-lista.js); sem espaço, a lista recolhe e volta ao fechar o painel */
  function abrir(uid, k) {
    RW.extrajornadaLista.sairDoFoco();
    RW.painel.abrir({ titulo: G().dataLonga(k), subtitulo: (u().unidade(uid) || {}).nome || '', aoFechar: function () { aberto = null; RW.extrajornadaPorDia.marcarAberto(); RW.extrajornadaLista.devolverLista(); } });
    entrarNoDia(uid, k);
    RW.extrajornadaLista.recolherSeApertado();
    RW.extrajornadaPorDia.marcarAberto();
    montarBusca();
    desenhar();
    /* o painel abriu e o calendário ficou mais estreito: o bloco do pelotão aberto vai à vista inteira */
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (RW.extrajornadaPorDia) RW.extrajornadaPorDia.mostrarAberto(true); }); });
  }

  /* no painel do dia da Escala, que já está aberto (a aba Extrajornada) */
  function mostrarEm(uid, k) {
    entrarNoDia(uid, k);
    montarBusca();
    desenhar();
  }

  /* a busca do painel, no subcabeçalho */
  function montarBusca() {
    buscaTermo = ''; buscaModo = 'marcar';
    var sub = RW.painel.subcabecalho();
    if (!sub || !RW.busca) return;
    var caixa = RW.tpl('tpl-extrajornada-busca');
    sub.textContent = '';
    sub.appendChild(caixa);
    sub.classList.remove('oculto');
    RW.busca.criar({ caixa: caixa, aoBuscar: function (termo, modo) { buscaTermo = termo || ''; buscaModo = modo || 'marcar'; desenhar(); } });
  }

  /* quem casa fica em destaque (no filtrar, só quem casa fica à vista) e os grupos e pelotões em que ele está abrem */
  function aplicarBusca(corpo) {
    if (!buscaTermo) return;
    var filtrar = buscaModo === 'filtrar';
    Array.prototype.forEach.call(corpo.querySelectorAll('.extrajornada-painel-militar'), function (l) {
      var casa = RW.busca.casaTexto(buscaTermo, l.getAttribute('data-busca'));
      l.classList.toggle('busca-achado', casa);
      l.classList.toggle('oculto', filtrar && !casa);
    });
    Array.prototype.forEach.call(corpo.querySelectorAll('.extrajornada-grupo, .extrajornada-pel'), function (g) {
      var tem = !!g.querySelector('.busca-achado');
      if (tem) g.querySelector('.grupo-caixa-cabecalho, .extrajornada-pel-titulo').setAttribute('aria-expanded', 'true');
      g.classList.toggle('oculto', filtrar && !tem);
    });
  }

  function desenhar() {
    if (!aberto) return;
    var uid = aberto.uid, k = aberto.data, alocs = G().efetivas();
    var corpo = RW.painel.corpo();
    corpo.textContent = '';
    /* nos Ajustes e na Escala: o que a mudança faz; o dia de mais de 7 dias atrás fica só para ver */
    if (G().antigo(k) || (G().modo() === 'ajustes' && G().lancada())) {
      var nota = RW.tpl('tpl-escala-nota');
      nota.querySelector('.nota-texto').textContent = G().antigo(k) ? msg().diaAntigo : msg().notaAjuste;
      corpo.appendChild(nota);
    }
    var grupos = {};
    GRUPOS.forEach(function (g) { grupos[g] = []; });
    G().voluntarios().forEach(function (m) {
      var g = fixos[m.cpf] || (fixos[m.cpf] = grupoDe(m, uid, k));
      /* quem ficou sem nenhum horário (sai ao salvar) fica em cinza no Neste dia, e marcar de novo traz ele de volta;
         quem saiu no rascunho antes de o dia abrir fica no grupo dele e também no Neste dia */
      var v = G().vagaDe(m.cpf, k), sai = !!v && +v.unidade === uid && !v.blocos.length;
      grupos[g.nome].push({ m: m, motivo: g.motivo, sai: sai && g.nome === 'neste' });
      if (sai && g.nome !== 'neste') grupos.neste.push({ m: m, sai: true });
    });
    corpo.appendChild(caixaCobertura(uid, k, alocs, grupos));
    GRUPOS.forEach(function (g) {
      var lista = grupos[g];
      /* o Neste dia aparece sempre (vazio, com o texto); os outros grupos, só com alguém */
      if (!lista.length && g !== 'neste') return;
      lista.sort(function (x, y) { return (x.m.unidade_id === uid ? 0 : 1) - (y.m.unidade_id === uid ? 0 : 1) || (x.m.ordem || 0) - (y.m.ordem || 0); });
      var caixa = RW.tpl('tpl-extrajornada-grupo');
      caixa.setAttribute('data-grupo', g);
      caixa.querySelector('.extrajornada-grupo-nome').textContent = msg().grupos[g];
      caixa.querySelector('.extrajornada-grupo-conta').textContent = lista.length;
      lembrar(caixa, g, lista.length > 0);
      caixa.querySelector('.extrajornada-grupo-vazio').classList.toggle('oculto', lista.length > 0);
      /* os horários em cima das bolinhas: no Neste dia, no alto do grupo; nos outros, no título de cada pelotão */
      caixa.querySelector('.extrajornada-horas').classList.toggle('oculto', g !== 'neste' || !lista.length);
      var linhas = caixa.querySelector('.extrajornada-painel-grupo-linhas');
      function linha(x, comPelotao) {
        var l = g === 'indisp' ? linhaIndisponivel(x.m, x.motivo) : linhaMilitar(x.m, uid, k, alocs, comPelotao);
        l.setAttribute('data-busca', RW.busca ? RW.busca.chave(x.m) : '');
        if (x.sai) {
          l.classList.add('extrajornada-painel-militar--sai');
          l.setAttribute('data-dica', msg().saiAoSalvar);
        }
        return l;
      }
      /* o Neste dia mostra todos juntos (com o pelotão embaixo do nome de quem é de outro); os outros grupos, uma
         divisão por pelotão */
      if (g === 'neste') lista.forEach(function (x) { linhas.appendChild(linha(x, x.m.unidade_id !== uid)); });
      else divisoes(lista, g, uid).forEach(function (dv) {
        dv.lista.forEach(function (x) { dv.linhas.appendChild(linha(x, false)); });
        linhas.appendChild(dv.el);
      });
      corpo.appendChild(caixa);
    });
    aplicarBusca(corpo);
  }

  /* as divisões de um grupo, uma por pelotão que tem alguém nele: a do pelotão do dia primeiro ("este pelotão"), depois
     as outras na ordem das unidades. A deste pelotão começa aberta e as outras fechadas; o que for aberto ou fechado
     vale enquanto o mesmo dia estiver aberto */
  function divisoes(lista, g, uid) {
    var ordem = [uid].concat(G().dados().unidades.map(function (un) { return un.id; }).filter(function (id) { return id !== uid; }));
    return ordem.map(function (id) {
      var daqui = lista.filter(function (x) { return x.m.unidade_id === id; });
      if (!daqui.length) return null;
      var el = RW.tpl('tpl-extrajornada-pel'), nome = 'pel-' + g + '-' + id;
      el.querySelector('.extrajornada-pel-nome').textContent = (u().unidade(id) || {}).nome || '';
      el.querySelector('.extrajornada-pel-este').classList.toggle('oculto', id !== uid);
      el.querySelector('.extrajornada-pel-conta').textContent = daqui.length;
      el.querySelector('.extrajornada-horas').classList.toggle('oculto', g === 'indisp');
      var cab = el.querySelector('.extrajornada-pel-titulo');
      if (!(nome in caixas)) caixas[nome] = id === uid;
      cab.setAttribute('aria-expanded', caixas[nome] ? 'true' : 'false');
      cab.addEventListener('click', function () {
        caixas[nome] = !caixas[nome];
        cab.setAttribute('aria-expanded', caixas[nome] ? 'true' : 'false');
      });
      return { el: el, linhas: el.querySelector('.extrajornada-pel-linhas'), lista: daqui };
    }).filter(Boolean);
  }

  /* a caixa abre ou fecha como ficou da última vez (sem escolha ainda, como diz padrao); o clique (o painel troca o
     aria-expanded) guarda a escolha */
  function lembrar(caixa, nome, padrao) {
    var cab = caixa.querySelector('.grupo-caixa-cabecalho');
    cab.setAttribute('aria-expanded', (nome in caixas ? caixas[nome] : padrao) ? 'true' : 'false');
    cab.addEventListener('click', function () { caixas[nome] = cab.getAttribute('aria-expanded') !== 'true'; });
  }

  /* em que grupo o militar fica no dia desta unidade. Indisponível é só quem tem impedimento de verdade; quem está sem
     cota fica no grupo dele, e ao marcar a linha abre os outros dias para desmarcar */
  function grupoDe(m, uid, k) {
    var a = G().alocDe(m.cpf, k);
    if (a && +a.unidade === uid) return { nome: 'neste' };
    if (a) return { nome: 'indisp', motivo: msg().extraEm((u().unidade(a.unidade) || {}).nome || '') };
    var impede = G().impedimento(m, k);
    if (impede) return { nome: 'indisp', motivo: (m.quer || []).indexOf(k) >= 0 ? msg().querEsteDia(impede) : impede };
    if ((m.nao_posso || []).indexOf(k) >= 0) return { nome: 'naoQuerem' };
    if ((m.quer || []).indexOf(k) >= 0) return { nome: 'querem' };
    return { nome: 'disp' };
  }

  /* a Cobertura do dia: os dois gráficos sempre à vista e, aberta, o relatório do dia embaixo deles (sem nada a
     dizer, o vazio) */
  function caixaCobertura(uid, k, alocs, grupos) {
    var caixa = RW.tpl('tpl-extrajornada-cobertura');
    lembrar(caixa, 'cobertura');
    var falta = G().faltaDoDia(uid, k, alocs);
    var antes = G().antesDe(uid, k);
    if (antes) {
      var cob = RW.tpl('tpl-extrajornada-painel-cobertura');
      var gA = G().grafico(antes, uid, G().erroAntes(uid, k));
      var dep = G().depoisDe(uid, k, alocs, falta);
      var gD = G().grafico(dep.cobertura, uid, dep.erro);
      if (gA) cob.querySelector('.extrajornada-painel-cob-sem').appendChild(gA);
      if (gD) cob.querySelector('.extrajornada-painel-cob-com').appendChild(gD);
      caixa.querySelector('.extrajornada-cobertura-graficos').appendChild(cob);
    }
    var rel = caixa.querySelector('.extrajornada-cobertura-relatorio');
    rel.querySelector('.extrajornada-cobertura-vazio').classList.toggle('oculto', relatorio(rel, uid, k, alocs, grupos, falta) > 0);
    if (RW.escalasCelula) {
      setTimeout(function () { RW.escalasCelula.desenharGraficos(caixa); }, 0);
      RW.escalasCelula.ligarDica(caixa);
    }
    return caixa;
  }

  /* o relatório do dia, no lugar dentro (devolve quantas linhas pôs): quem o sistema e o administrador colocaram, por
     quê e o que o militar marcou no pedido; depois, o que ainda falta e quem ainda pode (ou por que ninguém mais pode) */
  function relatorio(dentro, uid, k, alocs, grupos, falta) {
    var linhas = 0;
    var aqui = alocs.filter(function (a) { return +a.unidade === uid && a.data === k; })
      .sort(function (x, y) { return Math.min.apply(null, G().blocos(x)) - Math.min.apply(null, G().blocos(y)); });
    var eu = RW.sessao && RW.sessao.perfil ? RW.sessao.perfil() || {} : {};
    aqui.forEach(function (a) {
      var m = u().militar(a.cpf) || { grad: '', nome: a.cpf }, sistema = a.origem === 'sugestao';
      var lin = RW.tpl(sistema ? 'tpl-extrajornada-rd-sistema' : 'tpl-extrajornada-rd-admin');
      lin.querySelector('.extrajornada-rd-inicio').textContent = sistema ? msg().rdSistema : msg().rdAdmin(a.por || ((eu.grau_abreviacao || '') + ' ' + (eu.nome_de_guerra || '')).trim());
      lin.querySelector('.extrajornada-rd-nome').textContent = m.grad + ' ' + m.nome;
      lin.querySelector('.extrajornada-rd-fim').textContent = msg().rdHoras(u().horas(a.blocos, a.inicio), paraDe(falta.cobre[a.cpf] || [], sistema)) + ' ' + msg().pref[u().pref(m, k)];
      /* o resto do porquê da sugestão (o que ela cobre e o que ele marcou já estão na frase) */
      var mais = sistema && a.porque ? a.porque.filter(function (p) { return !/^(Cobre|Assume|Completa|É um dia que ele quer|Horário com menos gente)/.test(p); }).map(function (p) { return p.replace(/\.$/, ''); }).join(' · ') : '';
      var pq = lin.querySelector('.extrajornada-rd-mais');
      pq.textContent = mais;
      pq.classList.toggle('oculto', !mais);
      dentro.appendChild(lin);
      linhas++;
    });
    var gente = [], cond = [], ideal = [], chefe = [];
    [1, 2, 3, 4].forEach(function (b) {
      if (falta.total[b] - falta.cond[b] > 0) gente.push(b);
      if (falta.cond[b] > 0) cond.push(b);
      if (falta.atotal[b] - falta.acond[b] > 0) ideal.push(b);
      if (falta.acond[b] > 0) chefe.push(b);
    });
    var frases = [];
    if (gente.length) frases.push([msg().faltaGenteHoras(u().horas(gente)), 'erro']);
    if (cond.length) frases.push([msg().faltaCondutorHoras(u().horas(cond), falta.cnh.join(', ')), 'erro']);
    if (chefe.length) frases.push([msg().chefeDirigeHoras(u().horas(chefe), falta.acnh.join(', ')), 'alerta']);
    if (ideal.length) frases.push([msg().faltaIdealHoras(u().horas(ideal)), 'alerta']);
    frases.forEach(function (f, i) {
      var lin = RW.tpl('tpl-extrajornada-rd-falta');
      lin.classList.add('extrajornada-rd-linha--' + f[1]);
      lin.querySelector('.extrajornada-rd-fim').textContent = f[0];
      /* na primeira, quem ainda pode tirar extra no dia (ou por que ninguém mais pode) */
      if (i === 0) {
        var pode = lin.querySelector('.extrajornada-rd-mais');
        pode.textContent = quemPode(grupos);
        pode.classList.remove('oculto');
      }
      dentro.appendChild(lin);
      linhas++;
    });
    var tinha = [1, 2, 3, 4].some(function (b) { return falta.base[b] + falta.abase[b] > 0; });
    if (tinha && !frases.length) {
      var ok = RW.tpl('tpl-extrajornada-rd-ok');
      ok.querySelector('.extrajornada-rd-fim').textContent = msg().faltaCoberta;
      dentro.appendChild(ok);
      linhas++;
    }
    return linhas;
  }

  /* o que a extra cobriu, numa frase: a falta de condutor e de gente (vermelho), o chefe e o ideal (amarelo) */
  function paraDe(c, sistema) {
    var p = msg().para, partes = [];
    if (c.indexOf('condutor') >= 0 && c.indexOf('gente') >= 0) partes.push(p.condutorGente);
    else if (c.indexOf('condutor') >= 0) partes.push(p.condutor);
    else if (c.indexOf('gente') >= 0) partes.push(p.gente);
    if (c.indexOf('chefe') >= 0) partes.push(p.chefe);
    if (c.indexOf('ideal') >= 0) partes.push(p.ideal);
    if (!partes.length && sistema) partes.push(p.menosGente);
    return partes.join(' e ');
  }

  /* quem ainda pode tirar extra no dia: os que querem e os sem preferência, com cota sobrando; se ninguém, por quê */
  function quemPode(grupos) {
    var alocs = G().efetivas();
    function comCota(x) { return G().usadas(x.m.cpf, alocs) < (x.m.concedidas || 0); }
    var querem = grupos.querem.filter(comCota).length, disp = grupos.disp.filter(comCota).length;
    if (querem + disp) return msg().aindaPodem(querem, disp);
    var naoQuerem = grupos.naoQuerem.filter(comCota).length;
    var semCota = grupos.querem.length + grupos.disp.length + grupos.naoQuerem.length - naoQuerem;
    return msg().ninguemPode(naoQuerem, semCota, grupos.indisp.length);
  }

  /* os selos do militar no dia, embaixo do nome: condutor (quando falta e a CNH serve); o Só 24 h fica na linha do nome */
  function selosDoDia(m, uid, k) {
    var d = G().dados(), selos = RW.tpl('tpl-extrajornada-selos');
    function selo(texto, classe) { var s = RW.tpl('tpl-extrajornada-selo'); s.textContent = texto; if (classe) s.classList.add(classe); selos.appendChild(s); }
    var pedem = [d.falta_condutor, d.falta_amarela_condutor].map(function (mapa) { return ((mapa || {})[String(uid)] || {})[k] || {}; });
    if (pedem.some(function (pede) { return Object.keys(pede).some(function (b) { return pede[b].some(function (c) { return G().conduz(m, c); }); }); })) selo(msg().condutor, 'selo--sucesso');
    return selos;
  }

  function linhaMilitar(m, uid, k, alocs, comPelotao) {
    var lin = RW.tpl('tpl-extrajornada-painel-militar');
    var ponto = lin.querySelector('.extrajornada-painel-ponto');
    if ((m.quer || []).indexOf(k) >= 0) ponto.classList.add('extrajornada-painel-ponto--quer');
    else if ((m.nao_posso || []).indexOf(k) >= 0) ponto.classList.add('extrajornada-painel-ponto--nao');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    /* na linha do nome: o pelotão de quem é de outro e o selo de quem só aceita 24 h */
    var linhaNome = lin.querySelector('.extrajornada-painel-quem-nome');
    if (comPelotao) {
      var un = lin.querySelector('.extrajornada-painel-quem-unidade');
      un.textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      un.classList.remove('oculto');
      linhaNome.appendChild(un);
    }
    if (m.so24) {
      var s24 = RW.tpl('tpl-extrajornada-selo');
      s24.textContent = msg().so24;
      linhaNome.appendChild(s24);
    }
    var a = G().vagaDe(m.cpf, k), marcados = a ? G().blocos(a) : [];
    /* no Neste dia, quem pôs a extra, antes do nome (como a origem na Escala) */
    if (a && +a.unidade === uid) linhaNome.insertBefore(u().origem(a), linhaNome.firstChild);
    /* embaixo do nome, na largura toda: os selos. O porquê da sugestão fica no relatório da Cobertura do dia */
    var selos = selosDoDia(m, uid, k);
    if (selos.children.length) lin.insertBefore(selos, lin.querySelector('.extrajornada-painel-outros'));
    var usou = G().usadas(m.cpf, alocs);
    var cota = lin.querySelector('.extrajornada-painel-cota');
    cota.textContent = msg().deCotas(usou, m.concedidas);
    cota.classList.toggle('extrajornada-painel-cota--erro', usou > m.concedidas);
    ligarMarcas(lin.querySelector('.extrajornada-painel-marcas'), m, k, marcados, uid);
    RW.extrajornadaDiaOutros.ligarInicio(lin, lin.querySelector('.extrajornada-painel-outros'), m, k, uid);
    RW.extrajornadaDiaOutros.preencher(lin, m, k, usou, desenhar);
    return lin;
  }

  /* os 4 horários (a bolinha de 12px na área de 24px): clicar marca ou desmarca (quem pediu 24 horas seguidas: o dia
     vazio recebe os 4 de uma vez, se couberem na cota, e depois cada um por si); a mesma peça do painel do dia e da
     lista dos voluntários */
  function ligarMarcas(caixa, m, k, marcados, uid) {
    caixa.classList.add('extrajornada-marcas');
    Array.prototype.forEach.call(caixa.querySelectorAll('.extrajornada-painel-marca'), function (bt) {
      var b = +bt.getAttribute('data-bloco'), on = marcados.indexOf(b) >= 0;
      bt.classList.toggle('extrajornada-painel-marca--on', on);
      bt.setAttribute('aria-pressed', on ? 'true' : 'false');
      /* com o pedido aberto só dá para desmarcar; na Distribuição já lançada, nada (as mudanças vão pelos Ajustes) */
      bt.disabled = G().soLeitura() || G().antigo(k) || (G().travado() && !on);
      bt.addEventListener('click', function (ev) {
        ev.stopPropagation();   // no calendário, a bolinha não abre o painel do dia
        var inteiro = m.so24 && !marcados.length && (m.concedidas || 0) - G().usadas(m.cpf) >= 4;
        var novo = inteiro ? [1, 2, 3, 4] : (on ? marcados.filter(function (x) { return x !== b; }) : marcados.concat([b]));
        G().mudar(m, k, novo, uid);
      });
    });
  }

  function linhaIndisponivel(m, motivo) {
    var lin = RW.tpl('tpl-extrajornada-painel-indisponivel');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    lin.querySelector('.extrajornada-painel-motivo-texto').textContent = motivo || '';
    return lin;
  }

  RW.extrajornadaDia = {
    abrir: abrir,
    mostrarEm: mostrarEm,
    redesenhar: desenhar,
    reorganizar: reorganizar,
    aberto: function () { return aberto; },
    fechar: function () { if (aberto && RW.painel.estaAberto()) RW.painel.fechar(); aberto = null; },
    /* a aba da Escala saiu da tela: o painel continua aberto, sem o dia */
    soltar: function () { aberto = null; },
    /* os 4 horários, que a lista dos voluntários também usa */
    ligarMarcas: ligarMarcas
  };
})();
