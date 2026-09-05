/* ============================================================
   TROCAS — aba "Solicitar" (formulário inline, sem modal)
   Dois cartões: Solicitante (unidade/militar em leitura, dia via
   calendário, período na barra) e Solicitado (unidade + parceiro
   do grupo, devolução opcional com toggle pendente/dia + barra).
   Durações diferentes geram saldo (aviso). Ações no rodapé.
   Expõe RosterWork.trocasSolicitar.{ ligar, ativar }.
     ligar(conteudo, { aoSolicitar, aoCancelar }) — a cada exibição
     ativar() — ao entrar na aba Solicitar (reseta e carrega)
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};
  var TOTAL = 1440;

  var guardaLigado = false;
  var ctx = null;
  var timerParceiros = null;
  var reqParceiros = 0;   // token: ignora resposta antiga ao trocar de dia/unidade rápido

  function txt(chave) { return RW.mensagens.trocas[chave]; }
  function perfilLotacao() { var u = RosterWork.sessao.perfil(); return u ? u.lotacao_id : null; }
  function nomeDe(u) { return ((u.grau_abreviacao ? u.grau_abreviacao + ' ' : '') + (u.nome_de_guerra || '')).trim(); }
  function q(sel) { return ctx && ctx.raiz ? ctx.raiz.querySelector(sel) : null; }

  /* datas e horários */
  function isoDe(d) { var m = d.getMonth() + 1, dia = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dia < 10 ? '0' + dia : dia); }
  function dataDeIso(iso) { var p = iso.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }
  function horaParaMin(hhmm) { var h = parseInt(hhmm.substring(0, 2), 10), m = parseInt(hhmm.substring(3, 5), 10); var min = (h - 8) * 60 + m; return min < 0 ? min + TOTAL : min; }
  function limiteDoServico(s) {
    if (!s || !s.horario_inicio || !s.horario_fim) return { inicioMin: 0, fimMin: TOTAL };
    var a = horaParaMin(s.horario_inicio), b = horaParaMin(s.horario_fim);
    if (b <= a) b += TOTAL;
    if (b > TOTAL) b = TOTAL;
    return { inicioMin: a, fimMin: b };
  }
  function servicoDoDia(lista, iso) { for (var i = 0; i < lista.length; i++) if (lista[i].data === iso) return lista[i]; return null; }

  /* campos */
  function definirTexto(g, t, v) { var e = g ? g.querySelector('.campo-selecao-texto') : null; if (!e) return; e.textContent = t; e.classList.toggle('campo-selecao-texto--vazio', !!v); }
  function definirLeitura(sel, t) { var e = q(sel); if (e) e.textContent = t; }
  function limparErro(g) { var c = g ? g.closest('.campo') : null; if (!c) return; c.classList.remove('campo--erro'); var ctl = c.querySelector('input, select, textarea'); if (ctl) ctl.removeAttribute('aria-invalid'); var a = c.querySelector('.campo-erro-texto'); if (a) a.textContent = ''; }
  function marcarErro(g, m) { var c = g ? g.closest('.campo') : null; if (!c) return; c.classList.add('campo--erro'); var ctl = c.querySelector('input, select, textarea'); if (ctl) ctl.setAttribute('aria-invalid', 'true'); var a = c.querySelector('.campo-erro-texto'); if (a) { a.setAttribute('role', 'alert'); a.textContent = m; } }
  function montarOpcoes(menu, itens, aoEscolher) {
    if (!menu) return;
    menu.textContent = '';
    var tpl = document.getElementById('tpl-troca-opcao');
    itens.forEach(function (it) {
      var b = tpl.content.cloneNode(true).firstElementChild;
      b.textContent = it.texto;
      b.addEventListener('click', function () { aoEscolher(it.dado, it.texto); if (RW.fecharDropdowns) RW.fecharDropdowns(); });
      menu.appendChild(b);
    });
  }

  /* unidade do parceiro — limitada ao grupo (CIA/CIBM + PELs) */
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
  function carregarUnidades() {
    RW.apiFetch('/rest/v1/rpc/buscar_unidades_ordenadas', { metodo: 'POST', corpo: {} })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (lista) {
        if (!Array.isArray(lista)) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return; }   // falha: não deixa o seletor de unidade vazio sem aviso
        ctx.unidades = lista; preencherUnidades(calcularGrupo(ctx.unidades, perfilLotacao()));
      })
      .catch(function () { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao }); });
  }
  function preencherUnidades(grupo) {
    var gat = q('#ts-unidade');
    montarOpcoes(q('#ts-unidade-menu'), grupo.map(function (u) { return { texto: u.nome, dado: u }; }), function (u) {
      ctx.unidadeSel = u.unidade_id;
      definirTexto(gat, u.nome, false);
      carregarParceiros();
    });
    var propria = grupo.filter(function (u) { return u.unidade_id === perfilLotacao(); })[0];
    if (propria) { ctx.unidadeSel = propria.unidade_id; definirTexto(gat, propria.nome, false); }
  }

  /* parceiros (ocupados no dia/horário ficam apagados) */
  function agendarParceiros() { if (timerParceiros) clearTimeout(timerParceiros); timerParceiros = setTimeout(carregarParceiros, 350); }
  function carregarParceiros() {
    if (!ctx.unidadeSel) { habilitarParceiro(false); definirParceiro(txt('modalUnidadeAntes'), true); return; }
    if (!ctx.servicoDia || !ctx.servicoSel) { habilitarParceiro(false); definirParceiro(txt('modalDiaAntes'), true); return; }
    habilitarParceiro(false);
    definirParceiro(txt('modalCarregando'), true);
    var req = ++reqParceiros;
    RW.trocasDados.militares(ctx.unidadeSel, ctx.servicoDia, ctx.servicoSel.hi, ctx.servicoSel.hf).then(function (lista) {
      if (req !== reqParceiros) return;   // resposta obsoleta: outro dia/unidade já foi escolhido
      preencherParceiros(Array.isArray(lista) ? lista : []);
    }).catch(function () { if (req !== reqParceiros) return; habilitarParceiro(false); definirParceiro(txt('modalCarregarFalha'), true); });
  }
  function nomeMil(m) { return ((m && m.grau_abreviacao ? m.grau_abreviacao + ' ' : '') + ((m && m.nome_de_guerra) || '')).trim(); }

  /* ---------- campo Militar = COMBOBOX (aparência de seleção + digitação) ----------
     O estado fica no próprio input: value = parceiro escolhido; placeholder = os estados
     ("Escolha o dia antes", "Selecione", "Carregando…"). Escolhe no menu (mouse) OU digita p/ filtrar. */
  function parceiroInput() { return q('#ts-parceiro'); }
  function definirParceiro(texto, vazio) {
    var inp = parceiroInput(); if (!inp) return;
    if (vazio) { inp.value = ''; inp.placeholder = texto || ''; } else { inp.value = texto || ''; }
  }
  function habilitarParceiro(on) {
    var inp = parceiroInput(); if (inp) inp.disabled = !on;
  }
  function filtrarParceiros() {
    var menu = q('#ts-parceiro-menu'), inp = parceiroInput();
    if (!menu || !inp) return;
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
  function mostrarTodosParceiros() {
    var menu = q('#ts-parceiro-menu'); if (!menu) return;
    Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) { it.classList.remove('oculto'); });
    var vazio = menu.querySelector('.troca-parceiro-vazio');
    if (vazio) vazio.classList.add('oculto');
  }
  /* liga o input UMA vez por elemento (a página é remontada a cada visita → a marca fica no elemento) */
  function ligarComboParceiro() {
    var inp = parceiroInput();
    if (!inp || inp.dataset.ligado) return;
    inp.dataset.ligado = '1';
    /* 1º clique seleciona tudo, então digitar substitui o nome (em vez de acrescentar) */
    inp.addEventListener('mousedown', function (e) {
      if (!inp.disabled && document.activeElement !== inp) { e.preventDefault(); inp.focus(); }
    });
    inp.addEventListener('focus', function () { mostrarTodosParceiros(); inp.select(); });
    inp.addEventListener('input', filtrarParceiros);
    inp.addEventListener('blur', function () {   /* saiu sem escolher: volta ao parceiro atual (ou ao placeholder) */
      if (ctx.parceiroSel) definirParceiro(nomeMil(ctx.parceiroSel), false);
      else definirParceiro(txt('modalSelecione'), true);
    });
    inp.addEventListener('keydown', function (e) {   /* Enter escolhe a 1ª opção visível */
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var menu = q('#ts-parceiro-menu');
      var vis = menu && menu.querySelector('.dropdown-item:not(.dropdown-item--inativo):not(.oculto)');
      if (vis) vis.click();
    });
  }

  function preencherParceiros(lista) {
    var menu = q('#ts-parceiro-menu'), meu = RosterWork.sessao.cpf();
    menu.textContent = '';
    ligarComboParceiro();
    var tplOk = document.getElementById('tpl-troca-opcao');
    var tplOc = document.getElementById('tpl-troca-parceiro-ocupado');
    var disponiveis = 0, aindaSelecionado = false;
    lista.forEach(function (mil) {
      if (mil.cpf === meu) return;
      var nome = nomeMil(mil);
      if (mil.ocupado) {
        var oc = tplOc.content.cloneNode(true).firstElementChild;
        oc.querySelector('.troca-parceiro-nome').textContent = nome;
        oc.querySelector('.troca-parceiro-motivo').textContent = txt('parceiroOcupado');
        oc.setAttribute('data-busca', RosterWork.busca.normalizar(nome));
        menu.appendChild(oc);
      } else {
        var b = tplOk.content.cloneNode(true).firstElementChild;
        b.textContent = nome;
        b.setAttribute('data-busca', RosterWork.busca.normalizar(nome));
        b.addEventListener('click', function () {
          ctx.parceiroSel = mil;
          definirParceiro(nome, false);
          limparErro(parceiroInput());
          if (RW.fecharDropdowns) RW.fecharDropdowns();
          aoTrocarParceiro();
        });
        menu.appendChild(b);
        disponiveis++;
        if (ctx.parceiroSel && ctx.parceiroSel.cpf === mil.cpf) aindaSelecionado = true;
      }
    });
    var tplVazio = document.getElementById('tpl-troca-parceiro-vazio');   /* aviso do filtro, oculto até zerar */
    if (tplVazio) { var vm = tplVazio.content.cloneNode(true).firstElementChild; vm.textContent = txt('modalFiltroVazio'); vm.classList.add('oculto'); menu.appendChild(vm); }
    if (ctx.parceiroSel && !aindaSelecionado) { ctx.parceiroSel = null; ctx.parceiroServicos = []; }
    if (disponiveis === 0) { habilitarParceiro(false); definirParceiro(txt('modalParceiroVazio'), true); }
    else {
      habilitarParceiro(true);
      if (ctx.parceiroSel) definirParceiro(nomeMil(ctx.parceiroSel), false);
      else definirParceiro(txt('modalSelecione'), true);
    }
  }

  /* serviço: dia (calendário) + barra */
  /* barra do serviço sempre visível; nasce travada e liga ao escolher o dia */
  function montarBarraServico() {
    var alvo = q('#ts-barra-servico');
    if (!alvo || !RW.barraPeriodo) return;
    alvo.textContent = '';
    ctx.barraServico = RW.barraPeriodo.criar(alvo, {
      desativado: true,
      aoMudar: function (v) { ctx.servicoSel = v; atualizarSaldo(); agendarParceiros(); }
    });
  }
  function escolherDiaServico(data) {
    var iso = isoDe(data);
    var s = servicoDoDia(ctx.meusServicos, iso);
    if (!s) return;
    ctx.servicoDia = iso;
    ctx.servicoCtx = s.contexto_id;
    q('#ts-data').value = RW.trocasFormato.dataNumerica(iso);
    limparErro(q('#ts-data'));
    var lim = limiteDoServico(s);
    if (!ctx.barraServico) montarBarraServico();
    ctx.barraServico.definirLimite(lim.inicioMin, lim.fimMin);
    ctx.barraServico.ativar();
    ctx.servicoSel = ctx.barraServico.valor();
    carregarParceiros();
    atualizarSaldo();
  }

  /* parceiro trocou: carrega os dias dele para a devolução */
  function aoTrocarParceiro() {
    ctx.devDia = null; ctx.devSel = null; ctx.parceiroServicos = [];
    ctx.barraDevolucao = null;
    q('#ts-dev-data').value = '';
    /* no modo "Escolher dia" a barra de devolução volta travada; no "pendente" some */
    var emDia = q('#ts-dev-data') && !q('#ts-dev-data').classList.contains('oculto');
    if (emDia) { montarBarraDevolucao(); q('#ts-periodo-devolucao').classList.remove('oculto'); }
    else { var barra = q('#ts-barra-devolucao'); if (barra) barra.textContent = ''; q('#ts-periodo-devolucao').classList.add('oculto'); }
    atualizarSaldo();
    if (!ctx.parceiroSel) return;
    RW.trocasDados.meusServicos(ctx.parceiroSel.cpf, null).then(function (lista) {
      ctx.parceiroServicos = Array.isArray(lista) ? lista : [];
    }).catch(function () {});
  }

  /* devolução: toggle pendente/dia + calendário + barra */
  function montarBarraDevolucao() {
    var alvo = q('#ts-barra-devolucao');
    if (!alvo || !RW.barraPeriodo) return;
    alvo.textContent = '';
    ctx.barraDevolucao = RW.barraPeriodo.criar(alvo, {
      desativado: true,
      aoMudar: function (v) { ctx.devSel = v; atualizarSaldo(); }
    });
    ctx.devSel = null;
  }
  function ligarDevToggle() {
    var trilho = q('#ts-dev-toggle');
    if (!RW.abas || !trilho) return;
    RW.abas.ligar(trilho, function (aba) {
      var modo = aba.getAttribute('data-dev');
      if (modo === 'pendente') {
        ctx.devDia = null; ctx.devSel = null;
        q('#ts-dev-data').classList.add('oculto');
        q('#ts-periodo-devolucao').classList.add('oculto');
        atualizarSaldo();
      } else {
        q('#ts-dev-data').classList.remove('oculto');
        /* barra travada aparece já no modo "Escolher dia"; liga quando o dia for escolhido */
        montarBarraDevolucao();
        q('#ts-periodo-devolucao').classList.remove('oculto');
      }
    });
  }
  function escolherDiaDevolucao(data) {
    var iso = isoDe(data);
    var s = servicoDoDia(ctx.parceiroServicos, iso);
    if (!s) return;
    ctx.devDia = iso;
    q('#ts-dev-data').value = RW.trocasFormato.dataNumerica(iso);
    var lim = limiteDoServico(s);
    if (!ctx.barraDevolucao) montarBarraDevolucao();
    ctx.barraDevolucao.definirLimite(lim.inicioMin, lim.fimMin);
    ctx.barraDevolucao.ativar();
    ctx.devSel = ctx.barraDevolucao.valor();
    q('#ts-periodo-devolucao').classList.remove('oculto');
    atualizarSaldo();
  }

  /* saldo (durações diferentes) */
  function atualizarSaldo() {
    var elSaldo = q('#ts-saldo'), elTexto = q('#ts-saldo-texto');
    if (!elSaldo || !elTexto) return;
    var m = RW.mensagens.trocas;
    if (!ctx.servicoSel) { elSaldo.classList.add('oculto'); return; }
    var x = ctx.servicoSel.minutos;
    var y = (ctx.devDia && ctx.devSel) ? ctx.devSel.minutos : 0;
    var texto = null;
    if (!ctx.devDia) texto = m.saldoPendente(Math.round(x / 60));
    else if (x > y) texto = m.saldoParceiroDeve(Math.round((x - y) / 60));
    else if (y > x) texto = m.saldoVoceDeve(Math.round((y - x) / 60));
    if (texto) { elTexto.textContent = texto; elSaldo.classList.remove('oculto'); }
    else elSaldo.classList.add('oculto');
  }

  /* validação e envio */
  function validar() {
    var ok = true;
    if (!ctx.servicoDia) { marcarErro(q('#ts-data'), txt('novaData')); ok = false; }
    else if (!ctx.servicoSel || ctx.servicoSel.minutos <= 0) { marcarErro(q('#ts-data'), txt('novaServicoVazio')); ok = false; }
    if (!ctx.parceiroSel) { marcarErro(q('#ts-parceiro'), txt('novaParceiro')); ok = false; }
    if (ctx.parceiroSel && ctx.parceiroSel.cpf === RosterWork.sessao.cpf()) { marcarErro(q('#ts-parceiro'), txt('novaMesmaPessoa')); ok = false; }
    return ok;
  }
  function enviar(btn) {
    if (!validar()) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    var servTotal = ctx.servicoSel.total;
    var devTotal = ctx.devSel ? ctx.devSel.total : true;
    var corpo = {
      p_contexto_id: ctx.servicoCtx,
      p_solicitante_cpf: RosterWork.sessao.cpf(),
      p_parceiro_cpf: ctx.parceiroSel.cpf,
      p_data_servico_solicitante: ctx.servicoDia,
      p_horario_inicio: servTotal ? null : ctx.servicoSel.hi,
      p_horario_fim: servTotal ? null : ctx.servicoSel.hf,
      p_data_servico_parceiro: ctx.devDia || null,
      p_devolucao_horario_inicio: (ctx.devDia && !devTotal) ? ctx.devSel.hi : null,
      p_devolucao_horario_fim: (ctx.devDia && !devTotal) ? ctx.devSel.hf : null
    };
    RW.trocasDados.solicitar(corpo).then(function (r) {
      if (btn && RW.pararCarregando) RW.pararCarregando(btn);
      if (r && r.ok) {
        var trocaId = r.troca_id, meu = RosterWork.sessao.cpf();
        resetCampos();
        if (ctx.aoSolicitar) ctx.aoSolicitar();
        if (r.log && RW.resumo) {
          RW.resumo.abrirModal(r.log, {
            pagina: 'Trocas',
            /* Desfazer = cancelar a troca recém-criada (última chance) */
            desfazer: (trocaId && RW.trocasDados) ? function () {
              return RW.trocasDados.cancelar(trocaId, meu).then(function (res) {
                if (res && res.ok && ctx && ctx.aoMudar) ctx.aoMudar();
                return res;
              });
            } : null
          });
        }
      } else if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || RW.mensagens.trocas.falhaAcao });
    }).catch(function () {
      if (btn && RW.pararCarregando) RW.pararCarregando(btn);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* estado, cancelar, reset */
  function temDados() { return !!(ctx && (ctx.servicoDia || ctx.parceiroSel)); }
  function cancelar() {
    if (temDados() && RW.confirmar) {
      RW.confirmar({
        tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { resetCampos(); if (ctx.aoCancelar) ctx.aoCancelar(); }
      });
      return;
    }
    resetCampos();
    if (ctx.aoCancelar) ctx.aoCancelar();
  }
  function resetCampos() {
    ctx.servicoDia = null; ctx.servicoCtx = null; ctx.servicoSel = null; ctx.barraServico = null;
    ctx.unidadeSel = null; ctx.parceiroSel = null;
    ctx.devDia = null; ctx.devSel = null; ctx.barraDevolucao = null; ctx.parceiroServicos = [];

    if (q('#ts-data')) q('#ts-data').value = '';
    montarBarraServico();   /* barra do serviço volta visível e travada */
    definirTexto(q('#ts-unidade'), txt('modalSelecione'), true);
    var pmenu = q('#ts-parceiro-menu'); if (pmenu) pmenu.textContent = '';
    habilitarParceiro(false); definirParceiro(txt('modalDiaAntes'), true);

    var toggle = q('#ts-dev-toggle');
    if (toggle) {
      var abas = toggle.querySelectorAll('.aba');
      for (var i = 0; i < abas.length; i++) abas[i].classList.toggle('aba--ativa', abas[i].getAttribute('data-dev') === 'pendente');
    }
    if (q('#ts-dev-data')) { q('#ts-dev-data').value = ''; q('#ts-dev-data').classList.add('oculto'); }
    var bd = q('#ts-barra-devolucao'); if (bd) bd.textContent = '';
    if (q('#ts-periodo-devolucao')) q('#ts-periodo-devolucao').classList.add('oculto');
    if (q('#ts-saldo')) q('#ts-saldo').classList.add('oculto');

    if (!ctx.raiz) return;
    var erros = ctx.raiz.querySelectorAll('.trocas-solicitar .campo--erro');
    for (var j = 0; j < erros.length; j++) {
      erros[j].classList.remove('campo--erro');
      var a = erros[j].querySelector('.campo-erro-texto'); if (a) a.textContent = '';
    }
  }

  /* entrar na aba Solicitar */
  function ativar() {
    if (!ctx) return;
    var u = RosterWork.sessao.perfil();
    definirLeitura('#ts-minha-unidade', (u && u.lotacao_path) || '');
    definirLeitura('#ts-meu-nome', u ? nomeDe(u) : '');
    resetCampos();
    RW.trocasDados.meusServicos(RosterWork.sessao.cpf(), null).then(function (l) { ctx.meusServicos = Array.isArray(l) ? l : []; }).catch(function () {});
    carregarUnidades();
  }

  function ligarLimpezaErros(raiz) {
    var corpo = raiz.querySelector('.trocas-solicitar-corpo');
    if (!corpo) return;
    corpo.addEventListener('click', function (ev) {
      var campo = ev.target.closest('.campo');
      if (!campo || !campo.classList.contains('campo--erro')) return;
      campo.classList.remove('campo--erro');
      var alvo = campo.querySelector('.campo-erro-texto');
      if (alvo) alvo.textContent = '';
    });
  }

  /* liga tudo a cada exibição da página (elementos sempre novos) */
  function ligar(conteudo, cbs) {
    ctx = {
      raiz: conteudo, aoSolicitar: cbs && cbs.aoSolicitar, aoCancelar: cbs && cbs.aoCancelar,
      aoMudar: cbs && cbs.aoMudar,
      unidades: [], meusServicos: [], parceiroServicos: [],
      servicoDia: null, servicoSel: null, barraServico: null, unidadeSel: null, parceiroSel: null,
      devDia: null, devSel: null, barraDevolucao: null
    };

    var c = conteudo.querySelector('#ts-cancelar'), s = conteudo.querySelector('#ts-solicitar');
    if (c) c.addEventListener('click', cancelar);
    if (s) s.addEventListener('click', function () { enviar(s); });

    if (RW.calendario) {
      RW.calendario.ligar(conteudo.querySelector('#ts-data'), {
        obterData: function () { return ctx.servicoDia ? dataDeIso(ctx.servicoDia) : (ctx.meusServicos[0] ? dataDeIso(ctx.meusServicos[0].data) : new Date()); },
        permiteDia: function (d) { return !!servicoDoDia(ctx.meusServicos, isoDe(d)); },
        aoEscolher: escolherDiaServico
      });
      RW.calendario.ligar(conteudo.querySelector('#ts-dev-data'), {
        obterData: function () { return ctx.devDia ? dataDeIso(ctx.devDia) : (ctx.parceiroServicos[0] ? dataDeIso(ctx.parceiroServicos[0].data) : new Date()); },
        permiteDia: function (d) { return !!servicoDoDia(ctx.parceiroServicos, isoDe(d)); },
        aoEscolher: escolherDiaDevolucao
      });
    }

    ligarDevToggle();
    ligarLimpezaErros(conteudo);

    if (!guardaLigado && RW.guardaSaida && RW.guardaSaida.registrar) {
      RW.guardaSaida.registrar(temDados);
      guardaLigado = true;
    }
  }

  RW.trocasSolicitar = { ligar: ligar, ativar: ativar, temDados: temDados, descartar: function () { if (ctx) resetCampos(); } };
})();
