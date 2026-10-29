/* ============================================================
   NOVA EXTRA — passo 3: o painel do dia (uma unidade num dia)
   Com os moldes da aba Extrajornada do painel do dia da Escala: a
   Cobertura do dia (as barras sem extra e com extra, sempre à vista,
   e, aberta, o relatório do dia: quem foi colocado, o que ainda falta
   e quem ainda pode) e a lista em grupos (Neste dia, Querem este dia,
   Sem preferência, Não querem e Indisponíveis; menos o Neste dia,
   cada grupo dividido por pelotão), cada militar com as
   cotas e os 4 horários deste dia, que marcam e
   desmarcam. Todas as caixas abrem e fecham pelo título e começam
   abertas ou fechadas pela cor do dia. Lê e muda o
   rascunho do passo 3 por RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var GRUPOS = ['neste', 'querem', 'disp', 'naoQuerem', 'indisp'];

  var aberto = null;       // o painel do dia: { uid, data }
  var caixas = {};         // as caixas abertas do dia aberto { caixa: true }

  /* como as caixas começam ao abrir um dia, pela cor dele: com o que resolver (vermelho ou amarelo), a Cobertura aberta,
     com o relatório; sem (verde ou sem cor), fechada, só com os gráficos. O Neste dia aberto quando tem alguém e fechado
     quando está vazio (até ser aberto ou fechado no clique); os outros grupos, fechados */
  function caixasDoInicio(uid, k) {
    var cor = G().corDe(G().faltaDoDia(uid, k, G().efetivas()));
    return { cobertura: cor === 'erro' || cor === 'alerta', querem: false, disp: false, naoQuerem: false, indisp: false };
  }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }

  /* o que for aberto ou fechado vale enquanto o mesmo dia estiver aberto (mesmo que ele mude de cor); outro dia
     começa pela cor dele. Uma escolha por vez: abrir um dia tira o militar do foco (nova-extra-lista.js); sem espaço, a
     lista recolhe e volta ao fechar o painel */
  function abrir(uid, k) {
    var mesmo = !!aberto && aberto.uid === uid && aberto.data === k;
    if (!mesmo) caixas = caixasDoInicio(uid, k);
    RW.novaExtraLista.sairDoFoco();
    RW.painel.abrir({ titulo: G().dataLonga(k), subtitulo: (u().unidade(uid) || {}).nome || '', aoFechar: function () { aberto = null; G().marcarAberto(); RW.novaExtraLista.devolverLista(); } });
    aberto = { uid: uid, data: k };
    RW.novaExtraLista.recolherSeApertado();
    G().marcarAberto();
    desenhar();
  }

  function desenhar() {
    if (!aberto) return;
    var uid = aberto.uid, k = aberto.data, alocs = G().efetivas();
    var corpo = RW.painel.corpo();
    corpo.textContent = '';
    var grupos = {};
    GRUPOS.forEach(function (g) { grupos[g] = []; });
    G().voluntarios().forEach(function (m) {
      var g = grupoDe(m, uid, k, alocs);
      grupos[g.nome].push({ m: m, motivo: g.motivo });
      /* quem ficou sem nenhum horário (sai ao salvar) fica também no Neste dia, em cinza: devolver a bolinha em
         qualquer um dos dois lugares traz ele de volta */
      var v = G().vagaDe(m.cpf, k);
      if (v && +v.unidade === uid && !v.blocos.length) grupos.neste.push({ m: m, sai: true });
    });
    corpo.appendChild(caixaCobertura(uid, k, alocs, grupos));
    GRUPOS.forEach(function (g) {
      var lista = grupos[g];
      /* o Neste dia aparece sempre (vazio, com o texto); os outros grupos, só com alguém */
      if (!lista.length && g !== 'neste') return;
      lista.sort(function (x, y) { return (x.m.unidade_id === uid ? 0 : 1) - (y.m.unidade_id === uid ? 0 : 1) || (x.m.ordem || 0) - (y.m.ordem || 0); });
      var caixa = RW.tpl('tpl-ne-grupo');
      caixa.querySelector('.ne-grupo-nome').textContent = msg().grupos[g];
      caixa.querySelector('.ne-grupo-conta').textContent = lista.length;
      lembrar(caixa, g, lista.length > 0);
      caixa.querySelector('.nova-extra-grupo-vazio').classList.toggle('oculto', lista.length > 0);
      /* os horários em cima das bolinhas: no Neste dia, no alto do grupo; nos outros, no título de cada pelotão */
      caixa.querySelector('.nova-extra-horas').classList.toggle('oculto', g !== 'neste' || !lista.length);
      var linhas = caixa.querySelector('.escala-extra-grupo-linhas');
      function linha(x, comPelotao) {
        var l = g === 'indisp' ? linhaIndisponivel(x.m, x.motivo) : linhaMilitar(x.m, uid, k, alocs, comPelotao);
        if (x.sai) {
          l.classList.add('escala-extra-militar--sai');
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
  }

  /* as divisões de um grupo, uma por pelotão que tem alguém nele: a do pelotão do dia primeiro ("este pelotão"), depois
     as outras na ordem das unidades. A deste pelotão começa aberta e as outras fechadas; o que for aberto ou fechado
     vale enquanto o mesmo dia estiver aberto */
  function divisoes(lista, g, uid) {
    var ordem = [uid].concat(G().dados().unidades.map(function (un) { return un.id; }).filter(function (id) { return id !== uid; }));
    return ordem.map(function (id) {
      var daqui = lista.filter(function (x) { return x.m.unidade_id === id; });
      if (!daqui.length) return null;
      var el = RW.tpl('tpl-ne-pel'), nome = 'pel-' + g + '-' + id;
      el.querySelector('.nova-extra-pel-nome').textContent = (u().unidade(id) || {}).nome || '';
      el.querySelector('.nova-extra-pel-este').classList.toggle('oculto', id !== uid);
      el.querySelector('.nova-extra-pel-conta').textContent = daqui.length;
      el.querySelector('.nova-extra-horas').classList.toggle('oculto', g === 'indisp');
      var cab = el.querySelector('.nova-extra-pel-titulo');
      if (!(nome in caixas)) caixas[nome] = id === uid;
      cab.setAttribute('aria-expanded', caixas[nome] ? 'true' : 'false');
      cab.addEventListener('click', function () {
        caixas[nome] = !caixas[nome];
        cab.setAttribute('aria-expanded', caixas[nome] ? 'true' : 'false');
      });
      return { el: el, linhas: el.querySelector('.nova-extra-pel-linhas'), lista: daqui };
    }).filter(Boolean);
  }

  /* a caixa abre ou fecha como ficou da última vez (sem escolha ainda, como diz padrao); o clique (o painel troca o
     aria-expanded) guarda a escolha */
  function lembrar(caixa, nome, padrao) {
    var cab = caixa.querySelector('.grupo-caixa-cabecalho');
    cab.setAttribute('aria-expanded', (nome in caixas ? caixas[nome] : padrao) ? 'true' : 'false');
    cab.addEventListener('click', function () { caixas[nome] = cab.getAttribute('aria-expanded') !== 'true'; });
  }

  /* em que grupo o militar fica no dia desta unidade (sem nenhum horário, ele volta para o grupo dele e fica também no
     Neste dia, em cinza, até o Salvar) */
  function grupoDe(m, uid, k, alocs) {
    var a = G().alocDe(m.cpf, k);
    if (a && +a.unidade === uid) return { nome: 'neste' };
    if (a) return { nome: 'indisp', motivo: msg().extraEm((u().unidade(a.unidade) || {}).nome || '') };
    var impede = G().impedimento(m, k);
    if (impede) return { nome: 'indisp', motivo: impede };
    if (G().usadas(m.cpf, alocs) >= m.concedidas) return { nome: 'indisp', motivo: msg().semCotas };
    if ((m.nao_posso || []).indexOf(k) >= 0) return { nome: 'naoQuerem' };
    if ((m.quer || []).indexOf(k) >= 0) return { nome: 'querem' };
    return { nome: 'disp' };
  }

  /* a Cobertura do dia: os dois gráficos sempre à vista e, aberta, o relatório do dia embaixo deles (sem nada a
     dizer, o vazio) */
  function caixaCobertura(uid, k, alocs, grupos) {
    var caixa = RW.tpl('tpl-ne-cobertura');
    lembrar(caixa, 'cobertura');
    var falta = G().faltaDoDia(uid, k, alocs);
    var antes = G().antesDe(uid, k);
    if (antes) {
      var cob = RW.tpl('tpl-escala-extra-cobertura');
      var gA = G().grafico(antes, uid, G().erroAntes(uid, k));
      var dep = G().depoisDe(uid, k, alocs, falta);
      var gD = G().grafico(dep.cobertura, uid, dep.erro);
      if (gA) cob.querySelector('.escala-extra-cob-sem').appendChild(gA);
      if (gD) cob.querySelector('.escala-extra-cob-com').appendChild(gD);
      caixa.querySelector('.nova-extra-cobertura-graficos').appendChild(cob);
    }
    var rel = caixa.querySelector('.nova-extra-cobertura-relatorio');
    rel.querySelector('.nova-extra-cobertura-vazio').classList.toggle('oculto', relatorio(rel, uid, k, alocs, grupos, falta) > 0);
    if (RW.escalasCelula) setTimeout(function () { RW.escalasCelula.desenharGraficos(caixa); }, 0);
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
      var lin = RW.tpl(sistema ? 'tpl-ne-rd-sistema' : 'tpl-ne-rd-admin');
      lin.querySelector('.ne-rd-ini').textContent = sistema ? msg().rdSistema : msg().rdAdmin(a.por || ((eu.grau_abreviacao || '') + ' ' + (eu.nome_de_guerra || '')).trim());
      lin.querySelector('.ne-rd-nome').textContent = m.grad + ' ' + m.nome;
      lin.querySelector('.ne-rd-fim').textContent = msg().rdHoras(u().horas(a.blocos), paraDe(falta.cobre[a.cpf] || [], sistema)) + ' ' + msg().pref[u().pref(m, k)];
      /* o resto do porquê da sugestão (o que ela cobre e o que ele marcou já estão na frase) */
      var mais = sistema && a.porque ? a.porque.filter(function (p) { return !/^(Cobre|Assume|Completa|É um dia que ele quer|Horário com menos gente)/.test(p); }).map(function (p) { return p.replace(/\.$/, ''); }).join(' · ') : '';
      var pq = lin.querySelector('.ne-rd-mais');
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
      var lin = RW.tpl('tpl-ne-rd-falta');
      lin.classList.add('nova-extra-rd-linha--' + f[1]);
      lin.querySelector('.ne-rd-fim').textContent = f[0];
      /* na primeira, quem ainda pode tirar extra no dia (ou por que ninguém mais pode) */
      if (i === 0) {
        var pode = lin.querySelector('.ne-rd-mais');
        pode.textContent = quemPode(grupos);
        pode.classList.remove('oculto');
      }
      dentro.appendChild(lin);
      linhas++;
    });
    var tinha = [1, 2, 3, 4].some(function (b) { return falta.base[b] + falta.abase[b] > 0; });
    if (tinha && !frases.length) {
      var ok = RW.tpl('tpl-ne-rd-ok');
      ok.querySelector('.ne-rd-fim').textContent = msg().faltaCoberta;
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

  /* quem ainda pode tirar extra no dia: os que querem e os sem preferência; se ninguém, por quê */
  function quemPode(grupos) {
    var semCota = grupos.indisp.filter(function (x) { return x.motivo === msg().semCotas; }).length;
    if (grupos.querem.length + grupos.disp.length) return msg().aindaPodem(grupos.querem.length, grupos.disp.length);
    return msg().ninguemPode(grupos.naoQuerem.length, semCota, grupos.indisp.length - semCota);
  }

  /* os selos do militar no dia, embaixo do nome: condutor (quando falta e a CNH serve); o Só 24 h fica na linha do nome */
  function selosDoDia(m, uid, k) {
    var d = G().dados(), selos = RW.tpl('tpl-ne-selos');
    function selo(texto, classe) { var s = RW.tpl('tpl-ne-selo'); s.textContent = texto; if (classe) s.classList.add(classe); selos.appendChild(s); }
    var pedem = [d.falta_condutor, d.falta_amarela_condutor].map(function (mapa) { return ((mapa || {})[String(uid)] || {})[k] || {}; });
    if (pedem.some(function (pede) { return Object.keys(pede).some(function (b) { return pede[b].some(function (c) { return G().conduz(m, c); }); }); })) selo(msg().condutor, 'selo--sucesso');
    return selos;
  }

  function linhaMilitar(m, uid, k, alocs, comPelotao) {
    var lin = RW.tpl('tpl-escala-extra-militar');
    var ponto = lin.querySelector('.escala-extra-ponto');
    if ((m.quer || []).indexOf(k) >= 0) ponto.classList.add('escala-extra-ponto--quer');
    else if ((m.nao_posso || []).indexOf(k) >= 0) ponto.classList.add('escala-extra-ponto--nao');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    /* na linha do nome: o pelotão de quem é de outro e o selo de quem só aceita 24 h */
    var linhaNome = lin.querySelector('.escala-extra-quem-nome');
    if (comPelotao) {
      var un = lin.querySelector('.escala-extra-quem-unidade');
      un.textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      un.classList.remove('oculto');
      linhaNome.appendChild(un);
    }
    if (m.so24) {
      var s24 = RW.tpl('tpl-ne-selo');
      s24.textContent = msg().so24;
      linhaNome.appendChild(s24);
    }
    var a = G().vagaDe(m.cpf, k), marcados = a ? G().blocos(a) : [];
    /* embaixo do nome, na largura toda: os selos. O porquê da sugestão fica no relatório da Cobertura do dia, e os
       outros dias dele, na lista dos voluntários */
    var selos = selosDoDia(m, uid, k);
    if (selos.children.length) lin.insertBefore(selos, lin.querySelector('.escala-extra-outros'));
    lin.querySelector('.escala-extra-dias').classList.add('oculto');
    var usou = G().usadas(m.cpf, alocs);
    var cota = lin.querySelector('.escala-extra-cota');
    cota.textContent = msg().deCotas(usou, m.concedidas);
    cota.classList.toggle('escala-extra-cota--erro', usou > m.concedidas);
    ligarMarcas(lin.querySelector('.escala-extra-marcas'), m, k, marcados, uid);
    return lin;
  }

  /* os 4 horários (a bolinha de 12px na área de 24px): clicar marca ou desmarca (quem só quer 24 h vai com os 4
     juntos); a mesma peça do painel do dia e da lista dos voluntários */
  function ligarMarcas(caixa, m, k, marcados, uid) {
    caixa.classList.add('nova-extra-marcas');
    Array.prototype.forEach.call(caixa.querySelectorAll('.escala-extra-marca'), function (bt) {
      var b = +bt.getAttribute('data-bloco'), on = marcados.indexOf(b) >= 0;
      bt.classList.toggle('escala-extra-marca--on', on);
      bt.setAttribute('aria-pressed', on ? 'true' : 'false');
      /* com o pedido aberto só dá para desmarcar */
      bt.disabled = G().travado() && !on;
      bt.addEventListener('click', function (ev) {
        ev.stopPropagation();   // no calendário, a bolinha não abre o painel do dia
        var novo = m.so24 ? (marcados.length ? [] : [1, 2, 3, 4]) : (on ? marcados.filter(function (x) { return x !== b; }) : marcados.concat([b]));
        G().mudar(m, k, novo, uid);
      });
    });
  }

  function linhaIndisponivel(m, motivo) {
    var lin = RW.tpl('tpl-escala-extra-indisponivel');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    lin.querySelector('.escala-extra-motivo-texto').textContent = motivo || '';
    return lin;
  }

  RW.novaExtraDia = {
    abrir: abrir,
    redesenhar: desenhar,
    aberto: function () { return aberto; },
    fechar: function () { if (aberto && RW.painel.estaAberto()) RW.painel.fechar(); aberto = null; },
    /* os 4 horários, que a lista dos voluntários também usa */
    ligarMarcas: ligarMarcas
  };
})();
