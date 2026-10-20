/* ============================================================
   EXTRAJORNADA — aba Distribuição › o que vai dentro da célula
   Além das barras (extrajornada-escala.js): a escala do dia embaixo
   do "antes", as extras do dia (o salvo com o rascunho por cima) com
   o Tirar deste dia (X), a marca 24h e os 4 horários de 6 h que o
   administrador marca e desmarca, a vaga apagada de quem está sendo
   escalado pelo A escalar, quantos candidatos o dia tem por
   preferência (ponto + número) com o Escalar (abre o painel do dia),
   a cobertura "depois" aproximada (antes do ensaio chegar) e a
   pintura da seleção do A escalar.
   Funções que recebem os dados; a grade chama.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaEscalaCelula.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function R() { return RW.escalasExtraRascunho; }

  /* ---------- candidatos do dia por preferência (querem / sem preferência / não querem) ---------- */
  var PREFS = ['quer', 'neutro', 'nao_quer'];
  function pontoClasse(pref) {
    return pref === 'quer' ? 'extra-dia-ponto--quer' : (pref === 'nao_quer' ? 'extra-dia-ponto--nao' : 'extra-dia-ponto--neutro');
  }
  function balde(pref) { return pref === 'quer' ? 'quer' : (pref === 'nao_quer' ? 'nao_quer' : 'neutro'); }
  function candidato(cpf, candidatosDia) { return candidatosDia.filter(function (m) { return m.cpf === cpf; })[0] || null; }

  /* resumo na célula: quantos candidatos livres o dia tem, por preferência, e o Escalar (o clique sobe até a
     célula, que abre o painel do dia) */
  function resumo(candidatosDia, extrasDia) {
    var wrap = RW.tpl('tpl-extra-cel-resumo');
    if (!wrap) return null;
    var contas = wrap.querySelector('.extra-cel-resumo-contas');
    var colocados = {};
    extrasDia.forEach(function (m) { colocados[m.cpf] = true; });
    PREFS.forEach(function (pref) {
      var total = candidatosDia.filter(function (m) { return balde(m.pref) === pref && !colocados[m.cpf]; }).length;
      var c = RW.tpl('tpl-extra-cel-resumo-conta');
      if (!c) return;
      c.querySelector('.extra-dia-ponto').classList.add(pontoClasse(pref));
      c.querySelector('.extra-cel-resumo-num').textContent = String(total);
      if (contas) contas.appendChild(c);
    });
    return wrap;
  }

  /* ---------- as extras da célula: o salvo com o rascunho por cima ---------- */
  /* salvosDia = as extras salvas desta unidade no dia; devolve [{ cpf, grad, nome, blocos, fecha24, inserido }] */
  function extrasDaCelula(salvosDia, uid, iso, candidatosDia) {
    var lista = [], vistos = {};
    salvosDia.forEach(function (m) {
      vistos[m.cpf] = true;
      var mud = R() && R().obter(m.cpf, iso);
      if (!mud) { lista.push(m); return; }
      if (mud.blocos.length && String(mud.unidade) === String(uid)) {
        lista.push(Object.assign({}, m, { blocos: mud.blocos, inserido: false }));
      }
    });
    (R() ? R().doDia(iso) : []).forEach(function (mud) {
      if (vistos[mud.cpf] || !mud.blocos.length || String(mud.unidade) !== String(uid)) return;
      var c = candidato(mud.cpf, candidatosDia) || {};
      var quem = mud.militar || {};
      lista.push({ cpf: mud.cpf, grad: c.grad || quem.grad || '', nome: c.nome || quem.nome || '', rg: c.rg || '', nome_completo: c.nome_completo || '',
        blocos: mud.blocos, fecha24: !!c.fecha24, inserido: false });
    });
    return lista;
  }

  /* ---------- uma vaga (extra na célula): o nome e o X em cima; o pelotão, o 24h e os horários embaixo ----------
     opcoes = { fantasma, aoMarcar(bloco), aoTirar() } */
  function vaga(m, uid, candidatosDia, opcoes) {
    var v = RW.tpl('tpl-extra-vaga');
    if (!v) return null;
    opcoes = opcoes || {};
    v.dataset.cpf = m.cpf;
    v.querySelector('.extra-vaga-grad').textContent = m.grad || '';
    v.querySelector('.extra-vaga-nome').textContent = m.nome || '';
    var c = candidato(m.cpf, candidatosDia);
    v.querySelector('.extra-vaga-origem').classList.add(pontoClasse(c ? c.pref : 'neutro'));
    var pelotao = v.querySelector('.extra-vaga-pelotao');   // o pelotão SÓ quando é de outra unidade (a coluna já diz a unidade)
    if (c && c.unidade_id && String(c.unidade_id) !== String(uid)) { pelotao.textContent = c.unidade_nome || ''; pelotao.classList.remove('oculto'); }
    if (m.fecha24) {
      v.classList.add('extra-vaga--fecha24');
      v.querySelector('.extra-vaga-24h').classList.remove('oculto');
      var dica = RW.mensagens.extrajornada.fecha24Dica;
      if (dica) v.setAttribute('data-dica', dica);
    }
    var tirar = v.querySelector('.extra-vaga-tirar');
    if (opcoes.fantasma) {
      v.classList.add('extra-vaga--fantasma');
      tirar.classList.add('oculto');
    } else {
      tirar.addEventListener('click', function (e) { e.stopPropagation(); if (opcoes.aoTirar) opcoes.aoTirar(); });
    }
    var ativos = (m.blocos || []).map(Number);
    var doPontual = ((c && c.blocos_pontual) || []).map(Number);   // os horários que um pontual dele ocupa no dia
    Array.prototype.forEach.call(v.querySelectorAll('.escala-extra-marca'), function (b) {
      var k = +b.getAttribute('data-bloco');
      var on = ativos.indexOf(k) >= 0;
      var pontual = !on && doPontual.indexOf(k) >= 0;
      b.classList.toggle('escala-extra-marca--on', on);
      b.classList.toggle('escala-extra-marca--pontual', pontual);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (pontual) {
        b.disabled = true;
        b.setAttribute('data-dica', RW.mensagens.escala.extraPainel.blocoPontual);
      }
      b.addEventListener('click', function (e) { e.stopPropagation(); if (opcoes.aoMarcar) opcoes.aoMarcar(k); });
    });
    return v;
  }

  /* ---------- a escala do dia embaixo do "antes": junta as linhas soltas da célula numa caixa ---------- */
  function escalaDoDia(celula) {
    var caixa = celula.querySelector('.extra-cel-escala');
    if (caixa) return caixa;
    var linhas = celula.querySelectorAll(':scope > .linha-escalado');
    if (!linhas.length) return null;
    caixa = RW.tpl('tpl-extra-cel-escala');
    if (!caixa) return null;
    Array.prototype.forEach.call(linhas, function (l) { caixa.appendChild(l); });
    return caixa;
  }

  /* ---------- cobertura "depois" (barra 2) ---------- */
  var BLOCO_IDX = { 1: [0, 6], 2: [6, 12], 3: [12, 18], 4: [18, 24] };
  function coberturaDepois(cob, extras) {
    var arr = cob.slice();
    extras.forEach(function (m) {
      /* já na escala: contado na cobertura de agora (0); só na distribuição: soma (+1) */
      if (m.inserido) return;
      (m.blocos || []).forEach(function (b) {
        var r = BLOCO_IDX[b]; if (!r) return;
        for (var h = r[0]; h < r[1]; h++) arr[h] = Math.max(0, (Number(arr[h]) || 0) + 1);
      });
    });
    return arr;
  }
  function erroMarcas(erro) {
    var s = '';
    for (var h = 0; h < 24; h++) { var e = erro && erro[h]; s += (e === 2 || e === '2') ? '2' : (e ? '1' : '0'); }
    return s;
  }

  /* preferência do militar selecionado (A escalar) para PINTAR esta célula: 'quer'/'nao_quer' só na UNIDADE DELE
     (pelotão, ou CIA se for a lotação); 'inelegivel' quando não é candidato no dia (marca a coluna de data);
     null nas outras unidades ou sem ninguém selecionado (sem cor). A cor é da unidade dele, não muda com o escopo. */
  function prefSelecionadoNaCelula(candidatos, militarSel, uid, isoDia) {
    if (!militarSel) return null;
    var m = candidato(militarSel, candidatos[isoDia] || []);
    if (!m) return 'inelegivel';
    if (m.unidade_id !== uid) return null;   // é candidato no dia, mas esta não é a unidade dele → sem cor
    return m.pref;
  }
  /* o militar selecionado é candidato neste dia? (candidato = voluntário livre com termo). Governa o
     esmaecimento da coluna de data: dia sem candidatura fica marcado como indisponível para ele. */
  function selCandidatoNoDia(candidatos, militarSel, isoDia) { return !!candidato(militarSel, candidatos[isoDia] || []); }
  /* pinta a seleção do militar (A escalar): nas CÉLULAS só verde = quer / vermelho = não quer (dias em que ele é
     candidato; elegível sem preferência fica sem marca); o dia inteiro em que ele NÃO é candidato fica
     esmaecido na COLUNA DE DATA (não enche a grade de fundo). Sem militar selecionado, tudo volta ao normal. */
  function pintar(cal, candidatos, militarSel) {
    var cels = cal.querySelectorAll('.escala-mes-celula');
    for (var i = 0; i < cels.length; i++) {
      var cel = cels[i];
      cel.classList.remove('escala-mes-celula--pref-quer', 'escala-mes-celula--pref-nao');
      var pref = prefSelecionadoNaCelula(candidatos, militarSel, parseInt(cel.getAttribute('data-unidade-id'), 10), cel.getAttribute('data-iso'));
      if (pref === 'quer') cel.classList.add('escala-mes-celula--pref-quer');
      else if (pref === 'nao_quer') cel.classList.add('escala-mes-celula--pref-nao');
    }
    if (cal.querySelector('.geral-calendario-mes')) {
      /* Calendário: sem coluna de data, marca o NÚMERO do dia */
      var dias = cal.querySelectorAll('.geral-calendario-mes-dia');
      for (var k = 0; k < dias.length; k++) {
        var celC = dias[k].querySelector('.escala-mes-celula');   // dias de outro mês não têm célula → nunca marcam
        var isoC = celC ? celC.getAttribute('data-iso') : null;
        dias[k].classList.toggle('geral-calendario-mes-dia--indisponivel', !!(militarSel && isoC && !selCandidatoNoDia(candidatos, militarSel, isoC)));
      }
    } else {
      /* Agenda: marca a coluna de data (cabeçalho da linha) */
      var linhas = cal.querySelectorAll('.escala-mes-linha');
      for (var j = 0; j < linhas.length; j++) {
        var data = linhas[j].querySelector('.escala-mes-data');
        if (!data) continue;
        var celRef = linhas[j].querySelector('.escala-mes-celula');
        var isoLinha = celRef ? celRef.getAttribute('data-iso') : null;
        data.classList.toggle('escala-mes-data--indisponivel', !!(militarSel && isoLinha && !selCandidatoNoDia(candidatos, militarSel, isoLinha)));
      }
    }
  }

  RW.extrajornadaEscalaCelula = { resumo: resumo, extrasDaCelula: extrasDaCelula, vaga: vaga, escalaDoDia: escalaDoDia,
    coberturaDepois: coberturaDepois, erroMarcas: erroMarcas, pintar: pintar, candidato: candidato };
})();
