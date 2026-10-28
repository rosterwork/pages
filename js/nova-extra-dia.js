/* ============================================================
   NOVA EXTRA — passo 3: o painel do dia (uma unidade num dia)
   Com os moldes da aba Extrajornada do painel do dia da Escala: a
   cobertura (as barras sem extra e com extra e a falta que sobra) e
   a lista em grupos (Neste dia, Querem este dia, Disponíveis, Não
   querem e Indisponíveis), cada militar com as cotas, os outros dias
   dele e os 4 horários deste dia, que marcam e desmarcam. Lê e muda o
   rascunho do passo 3 por RosterWork.novaExtraGrade.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var GRUPOS = ['neste', 'querem', 'disp', 'naoQuerem', 'indisp'];
  var FECHADOS = { naoQuerem: true, indisp: true };

  var aberto = null;       // o painel do dia: { uid, data }
  var abertos = {};        // os outros dias abertos embaixo do nome { cpf: true }
  var gruposAbertos = {};  // os grupos fechados que o Mostrar abriu { grupo: true }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function G() { return RW.novaExtraGrade; }

  function abrir(uid, k) {
    RW.painel.abrir({ titulo: G().dataLonga(k), subtitulo: (u().unidade(uid) || {}).nome || '', largo: true, aoFechar: function () { aberto = null; G().marcarAberto(); } });
    aberto = { uid: uid, data: k };
    abertos = {}; gruposAbertos = {};
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
    G().voluntarios().forEach(function (m) { var g = grupoDe(m, uid, k, alocs); grupos[g.nome].push({ m: m, motivo: g.motivo }); });
    var relatorio = caixaRelatorio(uid, k, alocs, grupos);
    if (relatorio) corpo.appendChild(relatorio);
    corpo.appendChild(caixaCobertura(uid, k, alocs));
    GRUPOS.forEach(function (g) {
      var lista = grupos[g];
      if (!lista.length) return;
      lista.sort(function (x, y) { return (x.m.unidade_id === uid ? 0 : 1) - (y.m.unidade_id === uid ? 0 : 1) || (x.m.ordem || 0) - (y.m.ordem || 0); });
      var caixa = RW.tpl('tpl-escala-extra-grupo');
      caixa.querySelector('.escala-extra-grupo-nome').textContent = msg().grupos[g];
      caixa.querySelector('.escala-extra-grupo-conta').textContent = lista.length;
      var fechado = !!FECHADOS[g] && !gruposAbertos[g];
      caixa.querySelector('.escala-extra-horas').classList.toggle('oculto', g === 'indisp');
      var mostrar = caixa.querySelector('.escala-extra-mostrar');
      mostrar.classList.toggle('oculto', !fechado);
      mostrar.addEventListener('click', function () { gruposAbertos[g] = true; desenhar(); });
      var linhas = caixa.querySelector('.escala-extra-grupo-linhas');
      linhas.classList.toggle('oculto', fechado);
      lista.forEach(function (x) { linhas.appendChild(g === 'indisp' ? linhaIndisponivel(x.m, uid, x.motivo) : linhaMilitar(x.m, uid, k, alocs)); });
      corpo.appendChild(caixa);
    });
  }

  /* em que grupo o militar fica no dia desta unidade */
  function grupoDe(m, uid, k, alocs) {
    var d = G().dados(), a = G().alocDe(m.cpf, k);
    if (a && +a.unidade === uid) return { nome: 'neste' };
    if (a) return { nome: 'indisp', motivo: msg().extraEm((u().unidade(a.unidade) || {}).nome || '') };
    var oc = (m.ocupado || {})[k];
    if (oc) return { nome: 'indisp', motivo: RW.mensagens.novaExtra.motivos[oc] || oc };
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && !livres.length) return { nome: 'indisp', motivo: msg().expedienteDiaTodo };
    if (G().usadas(m.cpf, alocs) >= m.concedidas) return { nome: 'indisp', motivo: msg().semCotas };
    if ((m.nao_posso || []).indexOf(k) >= 0) return { nome: 'naoQuerem' };
    if ((m.quer || []).indexOf(k) >= 0) return { nome: 'querem' };
    return { nome: 'disp' };
  }

  function caixaCobertura(uid, k, alocs) {
    var caixa = RW.painel.criarCaixa(msg().cobertura);
    var falta = G().faltaDoDia(uid, k, alocs);
    var antes = G().antesDe(uid, k);
    if (antes) {
      var cob = RW.tpl('tpl-escala-extra-cobertura');
      var gA = G().grafico(antes, uid, G().erroAntes(uid, k));
      var dep = G().depoisDe(uid, k, alocs, falta);
      var gD = G().grafico(dep.cobertura, uid, dep.erro);
      if (gA) cob.querySelector('.escala-extra-cob-sem').appendChild(gA);
      if (gD) cob.querySelector('.escala-extra-cob-com').appendChild(gD);
      caixa.appendChild(cob);
    }
    if (RW.escalasCelula) setTimeout(function () { RW.escalasCelula.desenharGraficos(caixa); }, 0);
    return caixa;
  }

  /* o relatório do dia: quem o sistema e o administrador colocaram, por quê e o que o militar marcou no pedido;
     depois, o que ainda falta e quem ainda pode (ou por que ninguém mais pode). Sem nada a dizer, não aparece */
  function caixaRelatorio(uid, k, alocs, grupos) {
    var caixa = RW.painel.criarCaixa(msg().relatorioDia);
    var falta = G().faltaDoDia(uid, k, alocs), linhas = 0;
    var aqui = alocs.filter(function (a) { return +a.unidade === uid && a.data === k; })
      .sort(function (x, y) { return Math.min.apply(null, G().blocos(x)) - Math.min.apply(null, G().blocos(y)); });
    var eu = RW.sessao && RW.sessao.perfil ? RW.sessao.perfil() || {} : {};
    aqui.forEach(function (a) {
      var m = u().militar(a.cpf) || { grad: '', nome: a.cpf }, sistema = a.origem === 'sugestao';
      var lin = RW.tpl(sistema ? 'tpl-ne-rd-sistema' : 'tpl-ne-rd-admin');
      lin.querySelector('.ne-rd-ini').textContent = sistema ? msg().rdSistema : msg().rdAdmin(a.por || ((eu.grau_abreviacao || '') + ' ' + (eu.nome_de_guerra || '')).trim());
      lin.querySelector('.ne-rd-nome').textContent = m.grad + ' ' + m.nome;
      Array.prototype.forEach.call(lin.querySelectorAll('.nova-extra-bol i'), function (i, j) { if (G().blocos(a).indexOf(j + 1) >= 0) i.classList.add('nova-extra-bol--on'); });
      lin.querySelector('.ne-rd-fim').textContent = msg().rdHoras(u().horas(a.blocos), paraDe(falta.cobre[a.cpf] || [], sistema)) + ' ' + msg().pref[u().pref(m, k)];
      /* o resto do porquê da sugestão (o que ela cobre e o que ele marcou já estão na frase) */
      var mais = sistema && a.porque ? a.porque.filter(function (p) { return !/^(Cobre|Assume|Completa|É um dia que ele quer|Horário com menos gente)/.test(p); }).map(function (p) { return p.replace(/\.$/, ''); }).join(' · ') : '';
      var pq = lin.querySelector('.ne-rd-mais');
      pq.textContent = mais;
      pq.classList.toggle('oculto', !mais);
      caixa.appendChild(lin);
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
      caixa.appendChild(lin);
      linhas++;
    });
    var tinha = [1, 2, 3, 4].some(function (b) { return falta.base[b] + falta.abase[b] > 0; });
    if (tinha && !frases.length) {
      var ok = RW.tpl('tpl-ne-rd-ok');
      ok.querySelector('.ne-rd-fim').textContent = msg().faltaCoberta;
      caixa.appendChild(ok);
      linhas++;
    }
    return linhas ? caixa : null;
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

  /* os selos do militar no dia: quer o dia (comQuer; no painel o ponto verde já diz), sai e entra no serviço,
     expediente, só 24 h e condutor (quando falta e a CNH serve) */
  function selosDoDia(m, uid, k, marcados, comQuer) {
    var d = G().dados(), selos = RW.tpl('tpl-ne-selos');
    function selo(texto, classe) { var s = RW.tpl('tpl-ne-selo'); s.textContent = texto; if (classe) s.classList.add(classe); selos.appendChild(s); }
    if (comQuer && (m.quer || []).indexOf(k) >= 0) selo(msg().querDia, 'selo--sucesso');
    if (comQuer && (m.nao_posso || []).indexOf(k) >= 0) selo(msg().naoPodeDia, 'selo--erro');
    if ((m.ocupado || {})[G().somaDia(k, -1)] === 'servico') selo(msg().saiServico);
    if ((m.ocupado || {})[G().somaDia(k, 1)] === 'servico') selo(msg().entraServico);
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && livres.length && livres.length < 4) {
      selo(msg().expedienteAte(G().INI[livres[0] - 1]), marcados.some(function (b) { return livres.indexOf(b) < 0; }) ? 'selo--alerta' : '');
    }
    if (m.so24) selo(msg().so24);
    var pedem = [d.falta_condutor, d.falta_amarela_condutor].map(function (mapa) { return ((mapa || {})[String(uid)] || {})[k] || {}; });
    if (pedem.some(function (pede) { return Object.keys(pede).some(function (b) { return pede[b].some(function (c) { return G().conduz(m, c); }); }); })) selo(msg().condutor, 'selo--sucesso');
    return selos;
  }

  function linhaMilitar(m, uid, k, alocs) {
    var lin = RW.tpl('tpl-escala-extra-militar');
    var ponto = lin.querySelector('.escala-extra-ponto');
    if ((m.quer || []).indexOf(k) >= 0) ponto.classList.add('escala-extra-ponto--quer');
    else if ((m.nao_posso || []).indexOf(k) >= 0) ponto.classList.add('escala-extra-ponto--nao');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    if (m.unidade_id !== uid) {
      var un = lin.querySelector('.escala-extra-quem-unidade');
      un.textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      un.classList.remove('oculto');
    }
    var a = G().alocDe(m.cpf, k), marcados = a ? G().blocos(a) : [];
    /* embaixo do nome, na largura toda: os selos e o porquê da sugestão numa frase corrida */
    var fim = lin.querySelector('.escala-extra-outros');
    var selos = selosDoDia(m, uid, k, marcados, false);
    if (selos.children.length) lin.insertBefore(selos, fim);
    if (a && a.origem === 'sugestao' && a.porque && a.porque.length) {
      var porque = RW.tpl('tpl-ne-texto');
      porque.textContent = a.porque.map(function (p) { return p.replace(/\.$/, ''); }).join(' · ');
      lin.insertBefore(porque, fim);
    }

    var outros = alocs.filter(function (x) { return x.cpf === m.cpf && x.data !== k; }).sort(function (x, y) { return x.data < y.data ? -1 : 1; });
    var dias = lin.querySelector('.escala-extra-dias');
    outros.forEach(function (x) {
      var chip = RW.tpl('tpl-escala-extra-dia');
      chip.querySelector('.escala-extra-dia-texto').textContent = msg().diaOutro(x.data.slice(8, 10));
      chip.querySelector('.escala-extra-dia-horas').textContent = msg().horasN(x.blocos.length * 6);
      dias.appendChild(chip);
    });
    dias.disabled = !outros.length;
    var usou = G().usadas(m.cpf, alocs), passou = usou > m.concedidas;
    var cota = lin.querySelector('.escala-extra-cota');
    cota.textContent = msg().deCotas(usou, m.concedidas);
    cota.classList.toggle('escala-extra-cota--erro', passou);
    var aberta = outros.length && (abertos[m.cpf] || passou);
    dias.setAttribute('aria-expanded', aberta ? 'true' : 'false');
    dias.addEventListener('click', function () { abertos[m.cpf] = !aberta; desenhar(); });

    ligarMarcas(lin.querySelector('.escala-extra-marcas'), m, k, marcados, uid);
    var lista = lin.querySelector('.escala-extra-outros');
    if (aberta) {
      lista.classList.remove('oculto');
      outros.forEach(function (x) {
        var o = RW.tpl('tpl-escala-extra-outro');
        o.querySelector('.escala-extra-outro-dia').textContent = msg().diaSemana(x.data.slice(8, 10), G().SEM_CURTA[G().dataDe(x.data).getDay()]);
        ligarMarcas(o.querySelector('.escala-extra-marcas'), m, x.data, G().blocos(x), +x.unidade);
        lista.appendChild(o);
      });
    }
    return lin;
  }

  /* os 4 horários: clicar marca ou desmarca (quem só quer 24 h vai com os 4 juntos) */
  function ligarMarcas(caixa, m, k, marcados, uid) {
    Array.prototype.forEach.call(caixa.querySelectorAll('.escala-extra-marca'), function (bt) {
      var b = +bt.getAttribute('data-bloco'), on = marcados.indexOf(b) >= 0;
      bt.classList.toggle('escala-extra-marca--on', on);
      bt.setAttribute('aria-pressed', on ? 'true' : 'false');
      /* com o pedido aberto só dá para desmarcar */
      bt.disabled = G().travado() && !on;
      bt.addEventListener('click', function () {
        var novo = m.so24 ? (marcados.length ? [] : [1, 2, 3, 4]) : (on ? marcados.filter(function (x) { return x !== b; }) : marcados.concat([b]));
        G().mudar(m, k, novo, uid);
      });
    });
  }

  function linhaIndisponivel(m, uid, motivo) {
    var lin = RW.tpl('tpl-escala-extra-indisponivel');
    lin.querySelector('.escala-distribuicao-grad').textContent = m.grad;
    lin.querySelector('.escala-distribuicao-nome').textContent = m.nome;
    if (m.unidade_id !== uid) {
      var un = lin.querySelector('.escala-extra-quem-unidade');
      un.textContent = (u().unidade(m.unidade_id) || {}).nome || '';
      un.classList.remove('oculto');
    }
    lin.querySelector('.escala-extra-motivo-texto').textContent = motivo || '';
    return lin;
  }

  RW.novaExtraDia = {
    abrir: abrir,
    redesenhar: desenhar,
    aberto: function () { return aberto; },
    fechar: function () { if (aberto && RW.painel.estaAberto()) RW.painel.fechar(); aberto = null; },
    /* as peças que a caixa do quadrado do Por militar também usa */
    selosDoDia: selosDoDia, ligarMarcas: ligarMarcas
  };
})();
