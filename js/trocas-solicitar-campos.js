/* ============================================================
   TROCAS — campos do formulário Solicitar / Registrar
   As peças que o trocas-solicitar.js monta: datas e horários,
   erros dos campos, as unidades do grupo (CIA/CIBM + PELs), o
   campo Militar (digita para filtrar OU escolhe no menu; quem
   está ocupado aparece apagado com o motivo; quem ainda não tem
   conta aparece marcado e pode ser escolhido) e, ligados ao
   formulário aberto (iniciar), o solicitante (Registrar), o
   solicitado, o dia e o período do serviço, a devolução e os
   avisos de saldo e de "sem conta".
   Expõe RosterWork.trocasCampos.
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  function txt(chave) { return RW.mensagens.trocas[chave]; }

  /* ---------- datas e horários ---------- */
  function isoDe(d) { var m = d.getMonth() + 1, dia = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dia < 10 ? '0' + dia : dia); }
  function dataDeIso(iso) { var p = iso.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  /* o horário do serviço { hi, hf } (sem horário = o dia todo, 08h às 08h) */
  function horarioDoServico(s) {
    if (!s || !s.horario_inicio || !s.horario_fim) return { hi: '08:00', hf: '08:00' };
    return { hi: String(s.horario_inicio).slice(0, 5), hf: String(s.horario_fim).slice(0, 5) };
  }
  function servicoDoDia(lista, iso) { for (var i = 0; i < lista.length; i++) if (lista[i].data === iso) return lista[i]; return null; }
  function nomeMil(m) { return ((m && m.grau_abreviacao ? m.grau_abreviacao + ' ' : '') + ((m && m.nome_de_guerra) || '')).trim(); }

  /* ---------- campos ---------- */
  function definirTexto(g, t, vazio) { var e = g ? g.querySelector('.campo-selecao-texto') : null; if (!e) return; e.textContent = t; e.classList.toggle('campo-selecao-texto--vazio', !!vazio); }
  function limparErro(g) { var c = g ? g.closest('.campo') : null; if (!c) return; c.classList.remove('campo--erro'); var ctl = c.querySelector('input, select, textarea'); if (ctl) ctl.removeAttribute('aria-invalid'); var a = c.querySelector('.campo-erro-texto'); if (a) a.textContent = ''; }
  function marcarErro(g, m) { var c = g ? g.closest('.campo') : null; if (!c) return; c.classList.add('campo--erro'); var ctl = c.querySelector('input, select, textarea'); if (ctl) ctl.setAttribute('aria-invalid', 'true'); var a = c.querySelector('.campo-erro-texto'); if (a) { a.setAttribute('role', 'alert'); a.textContent = m; } }

  /* ---------- unidades do grupo (CIA/CIBM + PELs) da lotação ---------- */
  function calcularGrupo(lista, lotacaoId) {
    var porId = {};
    lista.forEach(function (u) { porId[u.unidade_id] = u; });
    var atual = porId[lotacaoId] || null, raiz = atual;
    while (atual) {
      if (atual.tipo === 'CIA' || atual.tipo === 'CIBM') { raiz = atual; break; }
      raiz = atual;
      atual = atual.unidade_pai_id ? porId[atual.unidade_pai_id] : null;
    }
    if (!raiz) return [];
    var grupo = [raiz];
    lista.forEach(function (u) {
      if (u.unidade_id === raiz.unidade_id) return;
      var p = u.unidade_pai_id ? porId[u.unidade_pai_id] : null;
      while (p) { if (p.unidade_id === raiz.unidade_id) { grupo.push(u); break; } p = p.unidade_pai_id ? porId[p.unidade_pai_id] : null; }
    });
    return grupo;
  }
  /* lê as unidades e devolve (Promise) o grupo da lotação; na falha avisa e devolve [] */
  function carregarGrupo(lotacaoId) {
    return RW.apiFetch('/rest/v1/rpc/buscar_unidades_ordenadas', { metodo: 'POST', corpo: {} })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (lista) {
        if (!Array.isArray(lista)) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return []; }
        return calcularGrupo(lista, lotacaoId);
      })
      .catch(function () { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao }); return []; });
  }
  /* o seletor de unidade: as opções do grupo; já marca a unidade da lotação (devolve a escolhida ou null) */
  function preencherUnidades(menu, gatilho, grupo, lotacaoId, aoEscolher) {
    if (!menu) return null;
    menu.textContent = '';
    var tpl = document.getElementById('tpl-troca-opcao');
    grupo.forEach(function (u) {
      var b = tpl.content.cloneNode(true).firstElementChild;
      b.textContent = u.nome;
      b.addEventListener('click', function () {
        definirTexto(gatilho, u.nome, false);
        if (RW.fecharDropdowns) RW.fecharDropdowns();
        aoEscolher(u);
      });
      menu.appendChild(b);
    });
    var propria = grupo.filter(function (u) { return u.unidade_id === lotacaoId; })[0] || null;
    if (propria) definirTexto(gatilho, propria.nome, false);
    return propria;
  }

  /* ---------- campo Militar = COMBOBOX (aparência de seleção + digitação) ----------
     O estado mostrado fica no próprio input: value = o militar escolhido; placeholder = os estados
     ("Escolha o dia antes", "Selecione", "Carregando…"). Quem guarda a escolha é o formulário:
     opcoes = { atual(), aoEscolher(mil), aoPerder(), ignorar() → [cpf] } */
  function comboMilitar(inp, menu, opcoes) {
    if (!inp || !menu) return null;

    function definir(texto, vazio) { if (vazio) { inp.value = ''; inp.placeholder = texto || ''; } else { inp.value = texto || ''; } }
    function habilitar(ligado) { inp.disabled = !ligado; }
    function mostrarAtual() { var m = opcoes.atual(); if (m) definir(nomeMil(m), false); else definir(txt('modalSelecione'), true); }
    function filtrar() {
      var termo = RosterWork.busca.normalizar(inp.value.trim());
      var visiveis = 0;
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) {
        var casa = !termo || (it.getAttribute('data-busca') || '').indexOf(termo) !== -1;
        it.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      var vazio = menu.querySelector('.troca-parceiro-vazio');   /* aviso quando o filtro não casa com ninguém */
      if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
    }
    function mostrarTodos() {
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) { it.classList.remove('oculto'); });
      var vazio = menu.querySelector('.troca-parceiro-vazio');
      if (vazio) vazio.classList.add('oculto');
    }
    function escolher(mil) {
      definir(nomeMil(mil), false);
      limparErro(inp);
      if (RW.fecharDropdowns) RW.fecharDropdowns();
      opcoes.aoEscolher(mil);
    }

    /* liga o input UMA vez por elemento (a marca fica no elemento) */
    if (!inp.dataset.ligado) {
      inp.dataset.ligado = '1';
      /* 1º clique seleciona tudo, então digitar substitui o nome (em vez de acrescentar) */
      inp.addEventListener('mousedown', function (e) {
        if (!inp.disabled && document.activeElement !== inp) { e.preventDefault(); inp.focus(); }
      });
      inp.addEventListener('focus', function () { mostrarTodos(); inp.select(); });
      inp.addEventListener('input', filtrar);
      inp.addEventListener('blur', mostrarAtual);   /* saiu sem escolher: volta ao escolhido (ou ao placeholder) */
      inp.addEventListener('keydown', function (e) {   /* Enter escolhe a 1ª opção visível */
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var vis = menu.querySelector('.dropdown-item:not(.dropdown-item--inativo):not(.oculto)');
        if (vis) vis.click();
      });
    }

    /* monta a lista; devolve quantos podem ser escolhidos. A escolha que sumiu da lista é desfeita (aoPerder) */
    function preencher(lista) {
      menu.textContent = '';
      var ignorar = opcoes.ignorar ? opcoes.ignorar() : [];
      var atual = opcoes.atual();
      var disponiveis = 0, aindaEscolhido = false;
      lista.forEach(function (mil) {
        if (!mil || ignorar.indexOf(mil.cpf) >= 0) return;
        var nome = nomeMil(mil), item;
        if (mil.ocupado) {
          item = document.getElementById('tpl-troca-parceiro-ocupado').content.cloneNode(true).firstElementChild;
          item.querySelector('.troca-parceiro-nome').textContent = nome;
          /* afastado (férias/licença/dispensa) diz o motivo; senão, já está de serviço no horário */
          item.querySelector('.troca-parceiro-motivo').textContent =
            (mil.afastamento && txt('parceiroAfastado')[mil.afastamento]) || txt('parceiroOcupado');
        } else {
          if (mil.tem_conta === false) {
            item = document.getElementById('tpl-troca-militar-sem-conta').content.cloneNode(true).firstElementChild;
            item.querySelector('.troca-parceiro-nome').textContent = nome;
          } else {
            item = document.getElementById('tpl-troca-opcao').content.cloneNode(true).firstElementChild;
            item.textContent = nome;
          }
          item.addEventListener('click', function () { escolher(mil); });
          disponiveis++;
          if (atual && atual.cpf === mil.cpf) aindaEscolhido = true;
        }
        item.setAttribute('data-busca', RosterWork.busca.normalizar(nome));
        menu.appendChild(item);
      });
      var tplVazio = document.getElementById('tpl-troca-parceiro-vazio');   /* aviso do filtro, oculto até zerar */
      if (tplVazio) { var vm = tplVazio.content.cloneNode(true).firstElementChild; vm.textContent = txt('modalFiltroVazio'); vm.classList.add('oculto'); menu.appendChild(vm); }
      if (atual && !aindaEscolhido && opcoes.aoPerder) opcoes.aoPerder();
      if (disponiveis === 0) { habilitar(false); definir(txt('modalParceiroVazio'), true); }
      else { habilitar(true); mostrarAtual(); }
      return disponiveis;
    }

    return {
      preencher: preencher, definir: definir, habilitar: habilitar, mostrarAtual: mostrarAtual,
      esvaziar: function () { menu.textContent = ''; }
    };
  }

  /* ============================================================
     Campos ligados ao formulário aberto (f = o estado do trocas-solicitar.js),
     definido em iniciar(f, ganchos). ganchos.aoMudarPedido() avisa que o pedido
     mudou (o Registrar refaz a análise).
     ============================================================ */
  var f = null, ganchos = {};
  var timerParceiros = null;
  var reqParceiros = 0, reqSolicitantes = 0;   // tokens: ignoram a resposta antiga ao trocar de dia/unidade rápido

  function iniciar(form, g) { f = form; ganchos = g || {}; }
  function q(sel) { return f && f.raiz ? f.raiz.querySelector(sel) : null; }
  function avisarMudanca() { if (ganchos.aoMudarPedido) ganchos.aoMudarPedido(); }
  /* quem pede: no Registrar, o escolhido; no Solicitar, o logado */
  function cpfSolicitante() { return f.registrar ? (f.solicitanteSel ? f.solicitanteSel.cpf : null) : RosterWork.sessao.cpf(); }
  function devMarcarDia() { var d = q('#ts-dev-data'); return !!d && !d.classList.contains('oculto'); }

  /* ---------- solicitante (só no Registrar): os militares da unidade escolhida ---------- */
  function carregarSolicitantes() {
    var combo = f.comboSolicitante;
    combo.habilitar(false);
    combo.definir(txt('modalCarregando'), true);
    var req = ++reqSolicitantes;
    RW.trocasDados.militares(f.solUnidadeSel, null, null, null).then(function (lista) {
      if (req !== reqSolicitantes || !q('#ts-solicitante-menu')) return;
      combo.preencher(Array.isArray(lista) ? lista : []);
    }).catch(function () {
      if (req !== reqSolicitantes || !q('#ts-solicitante-menu')) return;
      combo.habilitar(false);
      combo.definir(txt('modalCarregarFalha'), true);
    });
  }
  /* o dia, o período e o parceiro dependem de quem pede: recomeça daí */
  function aoTrocarSolicitante() {
    f.servicoDia = null; f.servicoCtx = null; f.servicoSel = null; f.meusServicos = [];
    var data = q('#ts-data');
    data.value = '';
    data.disabled = !f.solicitanteSel;
    data.placeholder = f.solicitanteSel ? txt('modalEscolherDia') : txt('modalSolicitanteAntes');
    if (f.periodoServico) f.periodoServico.limpar();
    if (f.parceiroSel) { f.parceiroSel = null; aoTrocarParceiro(); }
    carregarParceiros();
    atualizarSaldo();
    avisarMudanca();
    if (!f.solicitanteSel) return;
    var cpf = f.solicitanteSel.cpf;
    RW.trocasDados.meusServicos(cpf, null, true).then(function (l) {
      if (f && f.solicitanteSel && f.solicitanteSel.cpf === cpf) f.meusServicos = Array.isArray(l) ? l : [];
    }).catch(function () {});
  }

  /* ---------- solicitado (ocupados no dia/horário ficam apagados) ---------- */
  function agendarParceiros() { if (timerParceiros) clearTimeout(timerParceiros); timerParceiros = setTimeout(carregarParceiros, 350); }
  function carregarParceiros() {
    var combo = f.comboParceiro; if (!combo) return;   // o Editar troca não escolhe o solicitado
    if (!f.unidadeSel) { combo.habilitar(false); combo.definir(txt('modalUnidadeAntes'), true); return; }
    if (!f.servicoDia || !f.servicoSel) { combo.habilitar(false); combo.definir(txt('modalDiaAntes'), true); return; }
    combo.habilitar(false);
    combo.definir(txt('modalCarregando'), true);
    var req = ++reqParceiros;
    RW.trocasDados.militares(f.unidadeSel, f.servicoDia, f.servicoSel.hi, f.servicoSel.hf).then(function (lista) {
      if (req !== reqParceiros || !q('#ts-parceiro-menu')) return;   // resposta obsoleta ou painel fechado
      lista = Array.isArray(lista) ? lista : [];
      var disponiveis = combo.preencher(lista);
      /* cobrança: escolhe o devedor sozinho assim que ele aparece disponível na unidade selecionada */
      if (disponiveis && f.cobrar && !f.parceiroSel) {
        var alvo = lista.filter(function (m) { return m && m.cpf === f.cobrar.cpf && !m.ocupado; })[0];
        if (alvo) { f.parceiroSel = alvo; limparErro(q('#ts-parceiro')); aoTrocarParceiro(); combo.mostrarAtual(); }
      }
    }).catch(function () {
      if (req !== reqParceiros || !q('#ts-parceiro-menu')) return;
      combo.habilitar(false);
      combo.definir(txt('modalCarregarFalha'), true);
    });
  }

  /* ---------- serviço: dia (calendário) + período (Serviço inteiro / Parte do serviço);
     o período fica sempre visível, desligado até escolher o dia ---------- */
  function montarPeriodoServico() {
    f.periodoServico = RosterWork.horario.periodoServico(q('#ts-servico-periodo'), {
      aoMudar: function (v) { f.servicoSel = v; atualizarSaldo(); agendarParceiros(); avisarMudanca(); }
    });
  }
  function escolherDiaServico(data) {
    var iso = isoDe(data);
    var s = servicoDoDia(f.meusServicos, iso);
    if (!s) return;
    f.servicoDia = iso;
    f.servicoCtx = s.contexto_id;
    q('#ts-data').value = RW.trocasFormato.dataNumerica(iso);
    limparErro(q('#ts-data'));
    if (!f.periodoServico) montarPeriodoServico();
    f.periodoServico.definirServico(horarioDoServico(s));
    /* cobrança: o período já vem com as horas da dívida, do início do turno (o turno inteiro, se ela cobre tudo) */
    if (f.cobrar && f.cobrar.minutos > 0) {
      var H = RosterWork.horario, turno = f.periodoServico.valor();
      var ini = H.faixa(turno)[0];
      if (f.cobrar.minutos < turno.minutos) f.periodoServico.definirParte(turno.hi, H.hhmm(ini + f.cobrar.minutos));
    }
    f.servicoSel = f.periodoServico.valor();
    carregarParceiros();
    atualizarSaldo();
    avisarMudanca();
  }

  /* ---------- parceiro trocou: os dias dele para a devolução ---------- */
  function aoTrocarParceiro() {
    f.devDia = null; f.devSel = null; f.parceiroServicos = [];
    q('#ts-dev-data').value = '';
    /* no modo "Marcar dia" o período da devolução volta desligado; no "pendente" some */
    if (f.periodoDevolucao) f.periodoDevolucao.limpar();
    q('#ts-periodo-devolucao').classList.toggle('oculto', !devMarcarDia());
    /* saldo já existente com o parceiro (para o aviso líquido, só no Solicitar); enquanto carrega, os pontinhos */
    f.saldoEntre = null; f.saldoCarregando = false;
    if (f.parceiroSel && !f.registrar) {
      var cpfAlvo = f.parceiroSel.cpf;
      f.saldoCarregando = true;
      RW.trocasDados.saldoEntre(cpfAlvo).then(function (n) {
        if (!f.parceiroSel || f.parceiroSel.cpf !== cpfAlvo) return;   // trocou de parceiro no meio
        f.saldoEntre = Number(n) || 0; f.saldoCarregando = false; atualizarSaldo();
      }).catch(function () {
        if (!f.parceiroSel || f.parceiroSel.cpf !== cpfAlvo) return;
        f.saldoEntre = 0; f.saldoCarregando = false; atualizarSaldo();
      });
    }
    atualizarSaldo();
    atualizarSemConta();
    avisarMudanca();
    if (!f.parceiroSel) return;
    var cpfPar = f.parceiroSel.cpf;
    RW.trocasDados.meusServicos(cpfPar, null, f.registrar).then(function (lista) {
      if (f && f.parceiroSel && f.parceiroSel.cpf === cpfPar) f.parceiroServicos = Array.isArray(lista) ? lista : [];
    }).catch(function () {});
  }

  /* ---------- devolução: toggle pendente/dia + calendário + o mesmo período ---------- */
  function montarPeriodoDevolucao() {
    f.periodoDevolucao = RosterWork.horario.periodoServico(q('#ts-dev-periodo'), {
      aoMudar: function (v) { f.devSel = v; atualizarSaldo(); avisarMudanca(); }
    });
    f.devSel = null;
  }
  function ligarDevToggle() {
    var trilho = q('#ts-dev-toggle');
    if (!RW.abas || !trilho) return;
    RW.abas.ligar(trilho, function (aba) {
      if (aba.getAttribute('data-dev') === 'pendente') {
        f.devDia = null; f.devSel = null;
        q('#ts-dev-data').classList.add('oculto');
        q('#ts-periodo-devolucao').classList.add('oculto');
        limparErro(q('#ts-dev-data'));
        atualizarSaldo();
      } else {
        q('#ts-dev-data').classList.remove('oculto');
        /* o período aparece já no modo "Marcar dia", desligado; liga quando o dia for escolhido */
        if (!f.periodoDevolucao) montarPeriodoDevolucao();
        else f.periodoDevolucao.limpar();
        q('#ts-periodo-devolucao').classList.remove('oculto');
      }
      avisarMudanca();
    });
  }
  function escolherDiaDevolucao(data) {
    var iso = isoDe(data);
    var s = servicoDoDia(f.parceiroServicos, iso);
    if (!s) return;
    f.devDia = iso;
    q('#ts-dev-data').value = RW.trocasFormato.dataNumerica(iso);
    limparErro(q('#ts-dev-data'));
    if (!f.periodoDevolucao) montarPeriodoDevolucao();
    f.periodoDevolucao.definirServico(horarioDoServico(s));
    f.devSel = f.periodoDevolucao.valor();
    q('#ts-periodo-devolucao').classList.remove('oculto');
    atualizarSaldo();
    avisarMudanca();
  }

  /* ---------- avisos do formulário ---------- */
  /* saldo (durações diferentes): só no Solicitar; no Registrar a Análise já mostra o saldo */
  function atualizarSaldo() {
    var elSaldo = q('#ts-saldo'), elTexto = q('#ts-saldo-texto');
    if (!elSaldo || !elTexto) return;
    var m = RW.mensagens.trocas;
    /* o aviso mostra o saldo LÍQUIDO com o parceiro, então depende dos dois: serviço e parceiro */
    if (f.registrar || !f.servicoSel || !f.parceiroSel) { elSaldo.classList.add('oculto'); return; }
    /* ainda buscando o saldo já existente entre os dois: três pontinhos */
    if (f.saldoCarregando || f.saldoEntre === null || f.saldoEntre === undefined) {
      elTexto.textContent = '';
      var pts = document.getElementById('carregando-pontos');
      if (pts) elTexto.appendChild(pts.content.cloneNode(true));
      elSaldo.classList.remove('oculto');
      return;
    }
    var x = f.servicoSel.minutos;
    var y = (f.devDia && f.devSel) ? f.devSel.minutos : 0;
    /* quanto EU fico devendo ao parceiro no fim: (serviço − devolução) menos o que ele já me devia */
    var net = (x - y) - f.saldoEntre;
    var texto;
    if (net > 0) texto = m.saldoVoceDeve(Math.round(net / 60));
    else if (net < 0) texto = m.saldoParceiroDeve(Math.round(-net / 60));
    else if (f.saldoEntre !== 0) texto = m.saldoQuite;   // esta troca zera uma dívida que existia
    else { elSaldo.classList.add('oculto'); return; }     // troca equilibrada, sem dívida prévia: nada a avisar
    elTexto.textContent = texto;
    elSaldo.classList.remove('oculto');
  }
  /* o solicitado ainda não tem conta (só no Solicitar): a troca vai direto para a aprovação */
  function atualizarSemConta() {
    var el = q('#ts-sem-conta');
    if (el) el.classList.toggle('oculto', f.registrar || !(f.parceiroSel && f.parceiroSel.tem_conta === false));
  }

  RW.trocasCampos = {
    isoDe: isoDe, dataDeIso: dataDeIso, servicoDoDia: servicoDoDia, nomeMil: nomeMil,
    definirTexto: definirTexto, limparErro: limparErro, marcarErro: marcarErro,
    carregarGrupo: carregarGrupo, preencherUnidades: preencherUnidades, comboMilitar: comboMilitar,
    iniciar: iniciar, cpfSolicitante: cpfSolicitante, devMarcarDia: devMarcarDia,
    carregarSolicitantes: carregarSolicitantes, aoTrocarSolicitante: aoTrocarSolicitante,
    carregarParceiros: carregarParceiros, aoTrocarParceiro: aoTrocarParceiro,
    montarPeriodoServico: montarPeriodoServico, escolherDiaServico: escolherDiaServico,
    ligarDevToggle: ligarDevToggle, escolherDiaDevolucao: escolherDiaDevolucao
  };
})();
