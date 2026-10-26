/* ============================================================
   NOVA EXTRA — passo 3: Distribuição (Montar e Revisar)
   Montar: a grade militares × dias (o que cada um quer, não pode ou
   ocupa; a extra com as horas e as bolinhas dos 4 horários, ou a
   sigla quando é em outro pelotão), com "Onde ainda falta gente"
   presa no alto (recolhível). Clicar na casa abre o painel do dia
   (horários, onde, o porquê da sugestão). Tudo fica num rascunho
   até o Salvar (nova_extra_distribuicao_salvar). "Preencher pela
   sugestão" pede o rascunho ao motor (nova_extra_sugerir).
   Revisar: o mês por unidade, com os 4 horários da falta.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraMontar.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var DESDE = ['08h', '14h', '20h', '02h'];

  var d = null, el = null, aoSalvar = null;
  var mud = {};            // rascunho: 'cpf|data' -> { cpf, data, unidade, blocos, origem, porque } (blocos [] = tira)
  var sugeridas = [];      // as chaves que a última sugestão pôs
  var faixaAberta = true;
  var modo = 'montar';
  var casa = null;         // o painel aberto: { cpf, data }

  function msg() { return RW.mensagens.novaExtra.org; }
  function u() { return RW.novaExtraUtil; }
  function q(sel) { return el.querySelector(sel); }
  function chave(cpf, data) { return cpf + '|' + data; }
  function diasDoMes() {
    var c = d.competencia, ultimo = new Date(+c.slice(0, 4), +c.slice(5, 7), 0).getDate(), lista = [];
    for (var i = 1; i <= ultimo; i++) lista.push(c.slice(0, 8) + String(i).padStart(2, '0'));
    return lista;
  }
  function semana(k) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)).getDay(); }
  function somaDia(k, n) { var x = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10) + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }

  /* as alocações como ficam com o rascunho */
  function efetivas() {
    var mapa = {};
    d.alocacoes.forEach(function (a) { mapa[chave(a.cpf, a.data)] = a; });
    Object.keys(mud).forEach(function (k) { mapa[k] = mud[k]; });
    return Object.keys(mapa).map(function (k) { return mapa[k]; }).filter(function (a) { return a.blocos && a.blocos.length; });
  }
  function daCasa(cpf, data) {
    var k = chave(cpf, data);
    if (k in mud) return mud[k].blocos.length ? mud[k] : null;
    return d.alocacoes.filter(function (a) { return a.cpf === cpf && a.data === data; })[0] || null;
  }
  function usadas(cpf) { return efetivas().filter(function (a) { return a.cpf === cpf; }).reduce(function (s, a) { return s + a.blocos.length; }, 0); }

  /* quantos ainda faltam em cada horário (a falta da escala menos as extras da grade naquele lugar) */
  function faltaRestante(uid, k, lista) {
    var base = (d.falta[String(uid)] || {})[k] || {}, r = {};
    var alocs = lista || efetivas();
    [1, 2, 3, 4].forEach(function (b) {
      var cobre = alocs.filter(function (a) { return +a.unidade === +uid && a.data === k && a.blocos.map(Number).indexOf(b) >= 0; }).length;
      r[b] = Math.max(0, (base[String(b)] || 0) - cobre);
    });
    return r;
  }

  function militaresDaGrade() {
    return d.militares.filter(function (m) { return m.voluntario && m.termo && (m.concedidas || 0) > 0; });
  }

  /* ---------- a grade ---------- */
  function desenharGrade() {
    var t = q('#p3-matriz');
    t.textContent = '';
    var dias = diasDoMes(), alocs = efetivas();
    var thead = RW.tpl('tpl-ne-thead');
    var trD = RW.tpl('tpl-ne-linha');
    trD.appendChild(celulaTexto('th', msg().militar, 'ne-col-nome'));
    dias.forEach(function (k) {
      var th = RW.tpl('tpl-ne-th-dia');
      th.querySelector('.ne-sem').textContent = 'DSTQQSS'.charAt(semana(k));
      th.querySelector('.ne-num').textContent = +k.slice(8, 10);
      if (semana(k) === 0 || semana(k) === 6) th.classList.add('ne-fds');
      trD.appendChild(th);
    });
    trD.appendChild(celulaTexto('th', msg().cotasCol, 'ne-col-cota'));
    thead.appendChild(trD);

    var cab = RW.tpl('tpl-ne-falta-cab');
    cab.querySelector('th').setAttribute('colspan', dias.length + 2);
    cab.querySelector('.ne-falta-botao').textContent = faixaAberta ? msg().recolher : msg().porPelotao;
    cab.querySelector('.ne-falta-botao').addEventListener('click', function () { faixaAberta = !faixaAberta; desenharGrade(); });
    thead.appendChild(cab);
    var linhasFalta = faixaAberta ? d.unidades.map(function (x) { return { nome: x.nome, ids: [x.id] }; }) : [{ nome: msg().faltaGente, ids: d.unidades.map(function (x) { return x.id; }) }];
    linhasFalta.forEach(function (lf) {
      var tr = RW.tpl('tpl-ne-linha');
      tr.classList.add('ne-falta-linha');
      tr.appendChild(celulaTexto('th', lf.nome, 'ne-col-nome'));
      var nDias = 0;
      dias.forEach(function (k) {
        var th = celulaTexto('th', '', semana(k) === 0 || semana(k) === 6 ? 'ne-fds' : '');
        var soma = { 1: 0, 2: 0, 3: 0, 4: 0 };
        lf.ids.forEach(function (id) { var r = faltaRestante(id, k, alocs); [1, 2, 3, 4].forEach(function (b) { soma[b] += r[b]; }); });
        if (soma[1] + soma[2] + soma[3] + soma[4] > 0) {
          nDias++;
          var f4 = RW.tpl('tpl-ne-f4');
          Array.prototype.forEach.call(f4.children, function (b, j) { b.classList.toggle('nova-extra-f4--falta', soma[j + 1] > 0); });
          th.appendChild(f4);
        }
        tr.appendChild(th);
      });
      tr.appendChild(celulaTexto('th', nDias ? msg().nDias(nDias) : msg().nenhum, nDias ? 'ne-col-cota ne-falta-conta' : 'ne-col-cota ne-falta-ok'));
      thead.appendChild(tr);
    });
    t.appendChild(thead);

    var tbody = RW.tpl('tpl-ne-tbody');
    var lista = militaresDaGrade();
    d.unidades.forEach(function (un) {
      var daqui = lista.filter(function (m) { return m.unidade_id === un.id; });
      if (!daqui.length) return;
      var g = RW.tpl('tpl-ne-linha');
      g.classList.add('ne-grupo');
      var gc = celulaTexto('td', un.nome + (un.cidade ? ' · ' + un.cidade : ''), '');
      gc.setAttribute('colspan', dias.length + 2);
      g.appendChild(gc);
      tbody.appendChild(g);
      daqui.forEach(function (m) { tbody.appendChild(linhaMilitar(m, dias)); });
    });
    if (!lista.length) {
      var v = RW.tpl('tpl-ne-linha');
      var vc = celulaTexto('td', msg().gradeVazia, 'nova-extra-vazio');
      vc.setAttribute('colspan', dias.length + 2);
      v.appendChild(vc);
      tbody.appendChild(v);
    }
    t.appendChild(tbody);
  }

  function celulaTexto(tag, texto, classe) {
    var c = RW.tpl(tag === 'th' ? 'tpl-ne-th' : 'tpl-ne-td');
    c.textContent = texto;
    if (classe) classe.split(' ').forEach(function (x) { if (x) c.classList.add(x); });
    return c;
  }

  function linhaMilitar(m, dias) {
    var tr = RW.tpl('tpl-ne-linha');
    var nome = RW.tpl('tpl-ne-td-nome');
    nome.querySelector('small').textContent = m.grad;
    nome.querySelector('b').textContent = m.nome;
    nome.querySelector('.ne-selo-24').classList.toggle('oculto', !m.so24);
    nome.querySelector('.ne-selo-exp').classList.toggle('oculto', m.setor !== 'Administrativo');
    tr.appendChild(nome);
    var livres = (d.livres_adm || {})[m.cpf] || null;
    dias.forEach(function (k) {
      var td = RW.tpl('tpl-ne-celula');
      if (semana(k) === 0 || semana(k) === 6) td.classList.add('ne-fds');
      var b = td.querySelector('.nova-extra-cel');
      var oc = (m.ocupado || {})[k];
      if (oc) { b.classList.add('nova-extra-cel--ocupado'); b.disabled = true; b.setAttribute('aria-label', msg().ocupado(u().br(k), oc)); }
      else {
        if (m.quer.indexOf(k) >= 0) b.classList.add('nova-extra-cel--quer');
        else if (m.nao_posso.indexOf(k) >= 0) b.classList.add('nova-extra-cel--nao');
        var lv = livres && livres[k];
        var a = daCasa(m.cpf, k);
        if (a) {
          var chip = RW.tpl('tpl-ne-chip');
          var fora = +a.unidade !== m.unidade_id;
          if (fora) chip.classList.add('nova-extra-chip--fora');
          if (k in mud) chip.classList.add('nova-extra-chip--novo');
          chip.querySelector('.nova-extra-chip-texto').textContent = fora ? (u().unidade(a.unidade) || {}).nome : (a.blocos.length * 6) + 'h';
          Array.prototype.forEach.call(chip.querySelectorAll('.nova-extra-bolas i'), function (i, j) { i.classList.toggle('nova-extra-bola--on', a.blocos.map(Number).indexOf(j + 1) >= 0); });
          b.appendChild(chip);
        } else if (lv && lv.length && lv.length < 4) {
          var dica = RW.tpl('tpl-ne-desde');
          dica.textContent = DESDE[lv[0] - 1];
          b.appendChild(dica);
        }
        b.setAttribute('aria-label', u().nome(m.cpf) + ', ' + u().br(k));
        b.addEventListener('click', function () { abrirCasa(m, k); });
      }
      tr.appendChild(td);
    });
    var usou = usadas(m.cpf);
    tr.appendChild(celulaTexto('td', msg().deCotas(usou, m.concedidas), 'ne-col-cota ' + (usou === m.concedidas ? 'ne-cota-ok' : usou > m.concedidas ? 'ne-cota-passou' : '')));
    return tr;
  }

  /* ---------- o painel da casa (o militar num dia) ---------- */
  function abrirCasa(m, k) {
    casa = { cpf: m.cpf, data: k };
    var dataTxt = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace('-feira', '');
    RW.painel.abrir({ titulo: u().nome(m.cpf), subtitulo: dataTxt + ' · ' + ((u().unidade(m.unidade_id) || {}).nome || ''), aoFechar: function () { casa = null; } });
    desenharCasa();
    var rod = RW.painel.rodape();
    rod.appendChild(document.getElementById('tpl-ne-casa-acoes').content.cloneNode(true));
    rod.classList.remove('oculto');
    rod.querySelector('#ne-casa-tirar').addEventListener('click', function () { mudar(m, k, [], null); RW.painel.fechar(); });
    rod.querySelector('#ne-casa-pronto').addEventListener('click', function () { RW.painel.fechar(); });
  }

  function mudar(m, k, blocos, unidade) {
    var atual = daCasa(m.cpf, k);
    var base = d.alocacoes.filter(function (a) { return a.cpf === m.cpf && a.data === k; })[0];
    var novo = { cpf: m.cpf, data: k, unidade: unidade || (atual ? +atual.unidade : m.unidade_id), blocos: blocos.slice().sort(), origem: 'admin', porque: null };
    if (base && JSON.stringify([+base.unidade, base.blocos.map(Number).sort()]) === JSON.stringify([novo.unidade, novo.blocos])) delete mud[chave(m.cpf, k)];
    else if (!base && !blocos.length) delete mud[chave(m.cpf, k)];
    else mud[chave(m.cpf, k)] = novo;
    redesenhar();
  }

  function desenharCasa() {
    if (!casa) return;
    var m = u().militar(casa.cpf), k = casa.data;
    var a = daCasa(m.cpf, k);
    var blocos = a ? a.blocos.map(Number) : [];
    var corpo = RW.painel.corpo();
    corpo.textContent = '';
    var f = RW.tpl('tpl-ne-casa');
    var selos = f.querySelector('.nova-extra-selos');
    function selo(texto, classe) { var s = RW.tpl('tpl-ne-selo'); s.textContent = texto; if (classe) s.classList.add(classe); selos.appendChild(s); }
    if (m.quer.indexOf(k) >= 0) selo(msg().querDia, 'selo--sucesso');
    if (m.nao_posso.indexOf(k) >= 0) selo(msg().naoPodeDia, 'selo--erro');
    if ((m.ocupado || {})[somaDia(k, -1)] === 'servico') selo(msg().saiServico);
    if ((m.ocupado || {})[somaDia(k, 1)] === 'servico') selo(msg().entraServico);
    var livres = ((d.livres_adm || {})[m.cpf] || {})[k];
    if (livres && livres.length < 4) selo(msg().expediente(livres.length ? DESDE[livres[0] - 1] : ''));
    var avisos = [];
    if (m.nao_posso.indexOf(k) >= 0 && blocos.length) avisos.push(msg().avisoNaoPode);
    if (livres && blocos.some(function (b) { return livres.indexOf(b) < 0; })) avisos.push(msg().avisoExpediente);
    var av = f.querySelector('.ne-aviso');
    av.textContent = avisos.join(' ');
    av.classList.toggle('oculto', !avisos.length);
    Array.prototype.forEach.call(f.querySelectorAll('[data-bloco]'), function (b) {
      var n = +b.getAttribute('data-bloco');
      b.classList.toggle('nova-extra-cota--on', blocos.indexOf(n) >= 0);
      b.addEventListener('click', function () {
        var novo = m.so24 ? (blocos.length ? [] : [1, 2, 3, 4]) : (blocos.indexOf(n) >= 0 ? blocos.filter(function (x) { return x !== n; }) : blocos.concat([n]));
        mudar(m, k, novo, a ? +a.unidade : null);
      });
    });
    var onde = f.querySelector('.ne-onde');
    var uAtual = a ? +a.unidade : m.unidade_id;
    d.unidades.forEach(function (x) {
      var o = RW.tpl('tpl-ne-opcao-uni');
      var r = o.querySelector('input');
      r.checked = x.id === uAtual;
      o.querySelector('span').textContent = x.id === m.unidade_id ? msg().pelotaoDele(x.nome) : x.nome;
      r.addEventListener('change', function () { if (blocos.length) mudar(m, k, blocos, x.id); });
      onde.appendChild(o);
    });
    if (a && a.origem === 'sugestao' && a.porque && a.porque.length) {
      f.querySelector('.ne-porque-sec').classList.remove('oculto');
      a.porque.forEach(function (p) { var t = RW.tpl('tpl-ne-texto'); t.textContent = p; f.querySelector('.ne-porque').appendChild(t); });
    }
    f.querySelector('.ne-cotas-linha').textContent = msg().cotasDele(usadas(m.cpf), m.concedidas);
    corpo.appendChild(f);
  }

  /* ---------- sugestão, salvar e o resto ---------- */
  function sugerir() {
    var btn = q('#p3-sugerir');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_sugerir', { p_competencia: d.competencia, p_atuais: efetivas() }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      sugeridas = [];
      var n24 = 0, emenda = 0, fora = 0, cotas = 0;
      r.propostas.forEach(function (p) {
        var k = chave(p.cpf, p.data);
        mud[k] = { cpf: p.cpf, data: p.data, unidade: p.unidade, blocos: p.blocos, origem: 'sugestao', porque: p.porque };
        sugeridas.push(k);
        cotas += p.blocos.length;
        if (p.blocos.length === 4) n24++;
        if (p.porque.some(function (x) { return /^Emenda/.test(x); })) emenda++;
        if (p.porque.some(function (x) { return /^Em outro/.test(x); })) fora++;
      });
      var sobra = r.nao_coube.map(function (x) { return msg().sobrou(u().nome(x.cpf), x.faltam, x.motivo); }).join(' ');
      q('#p3-nota').textContent = msg().sugestaoFeita(cotas, n24, emenda, fora) + (sobra ? ' ' + sobra : '');
      q('#p3-nota').classList.remove('oculto');
      redesenhar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function desfazerSugestao() {
    sugeridas.forEach(function (k) { if (mud[k] && mud[k].origem === 'sugestao') delete mud[k]; });
    sugeridas = [];
    q('#p3-nota').classList.add('oculto');
    redesenhar();
  }

  function salvar() {
    var btn = q('#p3-salvar');
    RW.iniciarCarregando(btn);
    RW.rpc('nova_extra_distribuicao_salvar', {
      p_competencia: d.competencia,
      p_mudancas: Object.keys(mud).map(function (k) { return mud[k]; }),
      p_motivo: q('#p3-motivo').value || null
    }).then(function (r) {
      RW.pararCarregando(btn);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      mud = {}; sugeridas = [];
      q('#p3-motivo').value = '';
      q('#p3-nota').classList.add('oculto');
      aoSalvar();
    }, function () { RW.pararCarregando(btn); RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
  }

  function redesenhar() {
    var n = Object.keys(mud).length;
    var ajuste = d.iniciado && !!d.lancamento;
    q('#p3-texto').textContent = n ? (ajuste ? msg().ajusteTexto(n) : msg().alteracoes(n)) : (ajuste ? msg().ajusteModo : '');
    q('#p3-motivo-campo').classList.toggle('oculto', !ajuste);
    q('#p3-salvar').disabled = !n;
    q('#p3-cancelar').disabled = !n;
    q('#p3-desfazer-sugestao').classList.toggle('oculto', !sugeridas.length);
    Array.prototype.forEach.call(el.querySelectorAll('#p3-modo [data-modo]'), function (b) { b.classList.toggle('aba--ativa', b.getAttribute('data-modo') === modo); });
    q('#p3-montar').classList.toggle('oculto', modo !== 'montar');
    q('#p3-revisar').classList.toggle('oculto', modo !== 'revisar');
    if (modo === 'montar') desenharGrade();
    else u().mesCalendario(q('#p3-revisar'), efetivas(), true, function (uid, k) { return faltaRestante(uid, k); });
    if (casa) desenharCasa();
  }

  var ligado = null;
  function mostrar(dados, conteudo, recarregar) {
    d = dados; el = conteudo; aoSalvar = recarregar;
    if (ligado !== el) {
      ligado = el; mud = {}; sugeridas = []; modo = 'montar'; faixaAberta = true;
      q('#p3-sugerir').addEventListener('click', sugerir);
      q('#p3-desfazer-sugestao').addEventListener('click', desfazerSugestao);
      q('#p3-salvar').addEventListener('click', salvar);
      q('#p3-cancelar').addEventListener('click', function () {
        RW.confirmar({ tipo: 'aviso', mensagem: msg().descartarRascunho, textoConfirmar: RW.mensagens.botoes.descartar,
          aoConfirmar: function () { mud = {}; sugeridas = []; q('#p3-nota').classList.add('oculto'); redesenhar(); } });
      });
      Array.prototype.forEach.call(el.querySelectorAll('#p3-modo [data-modo]'), function (b) {
        b.addEventListener('click', function () { modo = b.getAttribute('data-modo'); redesenhar(); });
      });
      if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return el && el.isConnected && Object.keys(mud).length > 0; });
    }
    redesenhar();
  }

  /* os dias com falta que sobram (para a conferência do passo 4) */
  function diasComFalta(dados) {
    var guarda = d; d = dados;
    var alocs = efetivas(), lista = [];
    diasDoMes().forEach(function (k) {
      dados.unidades.forEach(function (x) {
        var r = faltaRestante(x.id, k, alocs);
        if (r[1] + r[2] + r[3] + r[4] > 0) lista.push(u().br(k) + ' ' + x.nome);
      });
    });
    d = guarda || dados;
    return lista;
  }

  RW.novaExtraMontar = {
    mostrar: mostrar,
    sujo: function () { return Object.keys(mud).length > 0; },
    descartar: function () { mud = {}; sugeridas = []; },
    diasComFalta: diasComFalta
  };
})();
