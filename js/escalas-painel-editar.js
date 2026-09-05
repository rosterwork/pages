/* ============================================================
   ESCALAS — modo Editar do painel de Distribuição
   Mantém o "rascunho" (Colocar/Tirar) e desenha a distribuição
   editável: postos ativos, funções, militares com ✕ (remover) ou
   ↺ (restaurar). A distribuição automática trocada/removida vem
   numa linha itálica + riscada logo abaixo (valores originais). A
   barra cinza marca só o que foi mexido e ainda não salvo. A cada
   mudança re-simula no banco (ler_distribuicao_dia + rascunho);
   nada grava até Salvar. Reaproveita as peças de escalas-painel.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var rascunho = null;   // ajustes do dia em edição
  var base = null;       // ajustes salvos ao entrar (para marcar o que é "não salvo")
  var sujo = false;
  var ctx = null;        // { corpo, rodape, unidadeId, iso, contextoId, dados, aoCancelar, btnSalvar }
  var pickerAberto = null;
  var novos = {};        // chaves de ajustes do rascunho que não estão no base
  var haConflito = false; // alguma função fora da disponibilidade no desenho atual
  var vagas = [];        // funções adicionadas à mão ainda sem militar (uma por posto)


  /* horas redondas dentro da janela de disponibilidade [hi, hf] (anda no relógio; hi==hf = 24h) */
  function horasNaJanela(hi, hf) {
    var ini = parseInt((hi || '08:00').slice(0, 2), 10);
    var fim = parseInt((hf || '08:00').slice(0, 2), 10);
    var lista = [], h = ini;
    do { lista.push(('0' + h).slice(-2)); h = (h + 1) % 24; } while (h !== fim);
    lista.push(('0' + fim).slice(-2));
    return lista;
  }

  /* opções de início e fim do dropdown: a UNIÃO das horas de TODAS as janelas do militar
     (disponibilidade quebrada) — início nunca na última hora da janela, fim nunca na primeira */
  function horasInicioFim(disp, fallHi, fallHf) {
    var janelas = (disp && disp.length) ? disp : [{ hi: fallHi || '08:00', hf: fallHf || '08:00' }];
    var inis = {}, fins = {};
    janelas.forEach(function (j) {
      var jan = horasNaJanela(j.hi || '08:00', j.hf || '08:00');
      jan.slice(0, -1).forEach(function (h) { inis[h] = true; });
      jan.slice(1).forEach(function (h) { fins[h] = true; });
    });
    var ordenar = function (o) { return Object.keys(o).sort(); };
    return { inicios: ordenar(inis), fins: ordenar(fins) };
  }

  /* o período cabe em ALGUMA janela da disponibilidade? (senão, está fora dela) */
  function periodoForaDaDisponibilidade(per, disp) {
    if (!per || !disp || !disp.length) return false;
    var pi = emMin8(per.hi), pf = emMin8(per.hf); if (pf <= pi) pf += 1440;
    return !disp.some(function (j) {
      var ji = emMin8(j.hi), jf = emMin8(j.hf); if (jf <= ji) jf += 1440;
      return pi >= ji && pf <= jf;
    });
  }

  /* minutos desde 08:00 (régua do turno) */
  function emMin8(t) { var p = (t || '').split(':'); return ((parseInt(p[0], 10) * 60 + parseInt(p[1] || '0', 10)) - 480 + 1440) % 1440; }
  /* duas listas de períodos se cruzam? (na régua 08→08, com virada de meia-noite) */
  function periodosSobrepoem(a, b) {
    function faixas(ps) { return (ps || []).map(function (x) { var s = emMin8(x.hi), e = emMin8(x.hf); if (e <= s) e += 1440; return [s, e]; }); }
    var fa = faixas(a), fb = faixas(b);
    return fa.some(function (x) { return fb.some(function (y) { return x[0] < y[1] && y[0] < x[1]; }); });
  }
  /* cpfs dos militares cuja faixa se sobrepõe a outra na mesma função */
  function cpfsSobrepostos(funcao) {
    var set = {};
    if (!funcao || !funcao.sobreposicao) return set;
    var ms = funcao.militares || [];
    for (var i = 0; i < ms.length; i++) {
      for (var j = i + 1; j < ms.length; j++) {
        if (periodosSobrepoem(ms[i].periodos, ms[j].periodos)) { set[ms[i].cpf] = true; set[ms[j].cpf] = true; }
      }
    }
    return set;
  }

  function pecas() { return (RosterWork.escalasPainel && RosterWork.escalasPainel.pecas) || {}; }

  function vidPosto(posto) { return posto.tipo === 'viatura' ? posto.id : null; }
  function iidPosto(posto) { return posto.tipo === 'instalacao' ? posto.id : null; }

  function mesmoLocal(a, posto, funcao) {
    return a.nome_funcao === funcao.nome
      && (a.viatura_id || null) === vidPosto(posto)
      && (a.instalacao_id || null) === iidPosto(posto);
  }

  /* chave de um ajuste — compara rascunho × base (pega também troca de hora/substituto) */
  function chave(a) {
    return [a.acao, a.cpf, a.nome_funcao, a.viatura_id || '', a.instalacao_id || '', a.substitui || '', a.hi || '', a.hf || ''].join('|');
  }

  /* recalcula quais ajustes do rascunho são novos (não estavam salvos) */
  function calcularNovos() {
    var doBase = {};
    (base || []).forEach(function (a) { doBase[chave(a)] = true; });
    novos = {};
    (rascunho || []).forEach(function (a) { if (!doBase[chave(a)]) novos[chave(a)] = true; });
  }

  function acharAjuste(acaoTipo, cpf, posto, funcao) {
    var lista = rascunho || [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].acao === acaoTipo && lista[i].cpf === cpf && mesmoLocal(lista[i], posto, funcao)) return lista[i];
    }
    return null;
  }

  /* colocar de UM período específico (multi-período) — casa por cpf + local + hi/hf */
  function acharColocarPeriodo(cpf, posto, funcao, per) {
    var lista = rascunho || [];
    for (var i = 0; i < lista.length; i++) {
      var a = lista[i];
      if (a.acao === 'colocar' && a.cpf === cpf && mesmoLocal(a, posto, funcao)
          && a.hi === per.hi && a.hf === per.hf) return a;
    }
    return null;
  }

  /* ✕ num período: tira só o colocar daquele período (manual); auto → tira o militar da função */
  function removerPeriodo(posto, funcao, m, per) {
    if (!rascunho) rascunho = [];
    var col = acharColocarPeriodo(m.cpf, posto, funcao, per);
    if (col) {
      rascunho = rascunho.filter(function (a) { return a !== col; });
    } else {
      // automático → tira SÓ este período (leva hi/hf; o banco suprime a faixa que se sobrepõe)
      rascunho.push({ acao: 'tirar', cpf: m.cpf, nome_funcao: funcao.nome, viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto), hi: per.hi, hf: per.hf });
    }
    sujo = true; desenhar();
  }

  function ehNovo(a) { return !!(a && novos[chave(a)]); }

  /* ---------- ações do rascunho ---------- */

  /* trocar (ou adicionar, quando mAntigo é nulo): vira UM "colocar"; substitui o automático
     trocado ou, na adição de função nova, entra sem substituir ninguém */
  function escolher(posto, funcao, mAntigo, cpfNovo, vaga, dispNovo) {
    if (!rascunho) rascunho = [];
    if (mAntigo && mAntigo.fixado) {
      rascunho = rascunho.filter(function (a) {
        return !(a.acao === 'colocar' && a.cpf === mAntigo.cpf && mesmoLocal(a, posto, funcao));
      });
    }
    var subst = mAntigo ? (mAntigo.fixado ? (mAntigo.substitui || null) : mAntigo.cpf) : null;
    /* trocar: mantém o período do antigo; adicionar: cai no 1º vão da função (cobre o buraco
       sem fundir com período já existente); senão, na disponibilidade do militar */
    var per = (mAntigo && mAntigo.periodos && mAntigo.periodos[0])
              || (funcao && funcao.vao && funcao.vao[0])
              || (dispNovo && dispNovo[0])
              || { hi: '08:00', hf: '08:00' };
    rascunho.push({
      acao: 'colocar', cpf: cpfNovo, nome_funcao: funcao.nome,
      viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto),
      substitui: subst, hi: per.hi, hf: per.hf
    });
    if (vaga) removerVaga(vaga);   // a vaga foi preenchida → sai da lista de pendentes
    sujo = true; fecharPicker(); desenhar();
  }

  /* ✕ num automático puro: vira "tirar" (deixa a vaga vazia) */
  function remover(posto, funcao, m) {
    if (!rascunho) rascunho = [];
    rascunho.push({ acao: 'tirar', cpf: m.cpf, nome_funcao: funcao.nome, viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto) });
    sujo = true; desenhar();
  }

  /* ↺ restaurar: tira o ajuste manual (colocar ou tirar) — o automático volta sozinho */
  function restaurar(posto, funcao, cpf, vazio) {
    if (!rascunho) return;
    var acaoTipo = vazio ? 'tirar' : 'colocar';
    rascunho = rascunho.filter(function (a) {
      return !(a.acao === acaoTipo && a.cpf === cpf && mesmoLocal(a, posto, funcao));
    });
    sujo = true; desenhar();
  }

  /* muda a hora (início/fim) de uma função: cria/atualiza um colocar (sem mutar o base) */
  /* muda a hora (início/fim) de UM período: cria/atualiza o colocar daquele período (por hi/hf) */
  function mudarHora(posto, funcao, m, per, qual, hora) {
    if (!rascunho) rascunho = [];
    var atual = acharColocarPeriodo(m.cpf, posto, funcao, per);
    var novo = {};
    if (atual) {
      for (var k in atual) { if (atual.hasOwnProperty(k)) novo[k] = atual[k]; }
      rascunho = rascunho.filter(function (a) { return a !== atual; });
    } else {
      novo = { acao: 'colocar', cpf: m.cpf, nome_funcao: funcao.nome, viatura_id: vidPosto(posto), instalacao_id: iidPosto(posto), substitui: m.cpf, hi: per.hi, hf: per.hf };
    }
    if (qual === 'hi') novo.hi = hora; else novo.hf = hora;
    rascunho.push(novo);
    sujo = true; desenhar();
  }

  /* ---------- funções adicionadas à mão (vagas) ---------- */

  function vagaDoPosto(posto) {
    var vi = vidPosto(posto), ii = iidPosto(posto);
    return vagas.filter(function (v) { return v.vi === vi && v.ii === ii; });
  }
  function postoTemVaga(posto) { return vagaDoPosto(posto).length > 0; }
  function removerVaga(vaga) { vagas = vagas.filter(function (v) { return v !== vaga; }); }

  /* "Adicionar função": cria uma vaga vazia (uma por posto); o nome vem do banco */
  function adicionarVaga(posto) {
    if (!(posto.adicionar && posto.adicionar.nome_funcao) || postoTemVaga(posto)) return;
    vagas.push({ vi: vidPosto(posto), ii: iidPosto(posto), nome: posto.adicionar.nome_funcao });
    desenhar();   // vaga vazia não é alteração: não marca "sujo"
  }
  function descartarVaga(vaga) { removerVaga(vaga); desenhar(); }

  /* "Deixar vazio" no picker: limpa o militar; a função volta a ser uma vaga vazia */
  function esvaziar(posto, funcao, mAntigo, vaga) {
    if (mAntigo) {
      rascunho = (rascunho || []).filter(function (a) { return !(a.acao === 'colocar' && a.cpf === mAntigo.cpf && mesmoLocal(a, posto, funcao)); });
      if (!vagaDoPosto(posto).some(function (v) { return v.nome === funcao.nome; })) {
        vagas.push({ vi: vidPosto(posto), ii: iidPosto(posto), nome: funcao.nome });
      }
      sujo = true;
    }
    fecharPicker(); desenhar();
  }

  /* ✕ à esquerda: exclui uma função inteira inserida à mão (+ renumera as de cima) */
  function excluirFuncao(posto, funcao) {
    rascunho = (rascunho || []).filter(function (a) { return !(a.acao === 'colocar' && mesmoLocal(a, posto, funcao)); });
    renumerarApos(posto, funcao.nome);
    sujo = true; desenhar();
  }

  /* "Efetivo 5" -> { serie:'Efetivo', num:5 }; sem número -> null */
  function parteNumero(nome) {
    var m = /^(.*) (\d+)$/.exec(nome || '');
    return m ? { serie: m[1], num: parseInt(m[2], 10) } : null;
  }

  /* ao excluir uma adição numerada, as adições acima (colocares + vagas) descem 1 */
  function renumerarApos(posto, nomeRemovido) {
    var pn = parteNumero(nomeRemovido);
    if (!pn) return;
    var vi = vidPosto(posto), ii = iidPosto(posto);
    function rebaixar(nome) {
      var p = parteNumero(nome);
      return (p && p.serie === pn.serie && p.num > pn.num) ? p.serie + ' ' + (p.num - 1) : nome;
    }
    (rascunho || []).forEach(function (a) {
      if (a.acao === 'colocar' && !a.substitui && (a.viatura_id || null) === vi && (a.instalacao_id || null) === ii) a.nome_funcao = rebaixar(a.nome_funcao);
    });
    vagas.forEach(function (v) { if (v.vi === vi && v.ii === ii) v.nome = rebaixar(v.nome); });
  }

  /* ---------- picker (militares do grupo, por unidade) ---------- */

  function fecharPicker() {
    if (!pickerAberto) return;
    if (pickerAberto.desligar) pickerAberto.desligar();
    if (pickerAberto.painel && pickerAberto.painel.parentNode) pickerAberto.painel.parentNode.removeChild(pickerAberto.painel);
    document.removeEventListener('mousedown', pickerAberto.fora, true);
    pickerAberto = null;
  }

  function abrirPicker(linha, posto, funcao, mAntigo, vaga) {
    fecharPicker();
    if (!ctx || !ctx.dados) return;
    var painel = RosterWork.tpl('tpl-escala-picker');
    if (!painel) return;

    /* "Deixar vazio" no topo: só em vaga (preenchendo) ou em função manual (limpa o militar) */
    if (vaga || (funcao && funcao.manual)) {
      var itemVazio = RosterWork.tpl('tpl-escala-picker-vazio');
      if (itemVazio) {
        itemVazio.textContent = RosterWork.mensagens.escala.deixarVazio;
        itemVazio.addEventListener('click', function () { esvaziar(posto, funcao, mAntigo, vaga); });
        painel.appendChild(itemVazio);
      }
    }

    (ctx.dados.picker || []).forEach(function (unidade) {
      var bloco = RosterWork.tpl('tpl-escala-picker-unidade');
      if (!bloco) return;
      var cab = bloco.querySelector('.escala-picker-unidade-cab');
      bloco.querySelector('.escala-picker-unidade-nome').textContent = unidade.unidade_nome || '';
      if (!unidade.editando) cab.setAttribute('aria-expanded', 'false');
      cab.addEventListener('click', function () {
        cab.setAttribute('aria-expanded', cab.getAttribute('aria-expanded') === 'false' ? 'true' : 'false');
      });
      var lista = bloco.querySelector('.escala-picker-militares');
      (unidade.militares || []).forEach(function (mil) {
        if (mAntigo && mil.cpf === mAntigo.cpf) return;
        var item = RosterWork.tpl('tpl-escala-picker-militar');
        if (!item) return;
        if (mil.ocupado) item.classList.add('escala-picker-militar--ocupado');
        item.querySelector('.escala-picker-militar-grad').textContent = mil.grad || '';
        item.querySelector('.escala-picker-militar-nome').textContent = mil.nome || '';
        item.addEventListener('click', function () { escolher(posto, funcao, mAntigo, mil.cpf, vaga, mil.disp); });
        lista.appendChild(item);
      });
      painel.appendChild(bloco);
    });

    document.body.appendChild(painel);
    var desligar = RosterWork.flutuante ? RosterWork.flutuante.ancorar(linha, painel, { aoSair: fecharPicker }) : null;
    function fora(ev) { if (!painel.contains(ev.target) && !linha.contains(ev.target)) fecharPicker(); }
    pickerAberto = { painel: painel, desligar: desligar, fora: fora };
    setTimeout(function () { document.addEventListener('mousedown', fora, true); }, 0);
  }

  /* ---------- montagem das linhas ---------- */

  function preencherHoras(linha, periodos) {
    var p = pecas();
    var horas = linha.querySelector('.escala-distribuicao-horas');
    if (!horas) return;
    (periodos || []).forEach(function (per) {
      var hora = RosterWork.tpl('tpl-escala-distribuicao-hora');
      if (!hora) return;
      hora.querySelector('.escala-distribuicao-hora-ini').textContent = p.formatarHora ? p.formatarHora(per.hi) : '';
      var fim = hora.querySelector('.escala-distribuicao-hora-fim');
      var seta = hora.querySelector('.escala-distribuicao-hora-seta');
      if (per.hf) { fim.textContent = p.formatarHora ? p.formatarHora(per.hf) : ''; }
      else { fim.classList.add('oculto'); if (seta) seta.classList.add('oculto'); }
      horas.appendChild(hora);
    });
  }

  /* horário editável (Editar): início → fim, cada um um dropdown de números (componente
     geral-dropdown-numeros) só com as horas da disponibilidade do militar */
  function preencherHorasEditar(linha, posto, funcao, m) {
    var horas = linha.querySelector('.escala-distribuicao-horas');
    if (!horas) return;
    var p = pecas();
    if (!RosterWork.dropdownNumeros) { preencherHoras(linha, m.periodos); return; }
    /* um par editável POR período (disponibilidade quebrada = vários, empilhados) */
    var periodos = (m.periodos && m.periodos.length) ? m.periodos : [{ hi: '08:00', hf: '08:00' }];
    var opc = horasInicioFim(m.disp, m.disp_hi, m.disp_hf);   // horas de TODAS as janelas dele
    var semDisp = !m.disp || !m.disp.length;
    var formato = function (h) { return p.formatarHora ? p.formatarHora(h + ':00') : (h + 'h'); };
    periodos.forEach(function (per) {
      var hed = RosterWork.tpl('tpl-escala-hora-editar');
      if (!hed) return;
      var dropIni = RosterWork.dropdownNumeros.criar({
        opcoes: opc.inicios, valor: (per.hi || '08:00').slice(0, 2), formato: formato,
        aoEscolher: function (h) { mudarHora(posto, funcao, m, per, 'hi', h + ':00'); }
      });
      var dropFim = RosterWork.dropdownNumeros.criar({
        opcoes: opc.fins, valor: (per.hf || '08:00').slice(0, 2), formato: formato,
        aoEscolher: function (h) { mudarHora(posto, funcao, m, per, 'hf', h + ':00'); }
      });
      if (!dropIni || !dropFim) return;
      dropIni.classList.add('escala-hora-ini');
      dropFim.classList.add('escala-hora-fim');
      var seta = hed.querySelector('.escala-distribuicao-hora-seta');
      if (seta) hed.insertBefore(dropIni, seta); else hed.appendChild(dropIni);
      hed.appendChild(dropFim);
      if (semDisp || periodoForaDaDisponibilidade(per, m.disp)) {   // pinta a faixa errada DESTE período
        dropIni.classList.add('escala-incompativel');
        dropFim.classList.add('escala-incompativel');
      }
      horas.appendChild(hed);
    });
  }

  function acaoRemover(fn) {
    var a = RosterWork.tpl('tpl-escala-edicao-acao');
    var x = a && a.querySelector('.escala-edicao-remover');
    if (x) x.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); });
    return a;
  }
  function acaoRestaurar(fn) {
    var a = RosterWork.tpl('tpl-escala-edicao-restaurar');
    var r = a && a.querySelector('.escala-edicao-restaurar');
    if (r) r.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); });
    return a;
  }
  function acaoVazia() {
    var a = RosterWork.tpl('tpl-escala-edicao-acao');
    var x = a && a.querySelector('.escala-edicao-remover');
    if (x) x.remove();   // coluna reservada, sem botão (CS/OA)
    return a;
  }

  /* coluna de ação com 1 ✕ por período (multi-período): cada ✕ remove só o seu período */
  function acaoPorPeriodos(posto, funcao, m, periodos) {
    var a = RosterWork.tpl('tpl-escala-edicao-acao');
    if (!a) return null;
    var padrao = a.querySelector('.escala-edicao-remover');
    if (padrao) padrao.remove();   // troca o ✕ padrão por um ✕ por período (rótulo vem do molde)
    periodos.forEach(function (per) {
      var x = RosterWork.tpl('tpl-escala-edicao-remover-periodo');
      if (!x) return;
      x.addEventListener('click', function (ev) { ev.stopPropagation(); removerPeriodo(posto, funcao, m, per); });
      a.appendChild(x);
    });
    return a;
  }

  /* pinta o militar cuja faixa se sobrepõe a outra na mesma função (regra: um militar por hora) */
  function marcarSobreposicao(linha) {
    var ic = linha.querySelector('.escala-distribuicao-icones'); if (ic) ic.classList.add('escala-incompativel');
    var bi = linha.querySelector('.escala-hora-ini .dropdown-numeros-btn'); if (bi) bi.classList.add('escala-incompativel');
    var bf = linha.querySelector('.escala-hora-fim .dropdown-numeros-btn'); if (bf) bf.classList.add('escala-incompativel');
    var atual = linha.getAttribute('data-dica');   // pode já trazer o motivo da incompatibilidade
    var txt = RosterWork.mensagens.escala.sobreposicaoFuncao;
    linha.setAttribute('data-dica', atual ? (atual + '\n' + txt) : txt);   // soma à lista (a dica aceita várias linhas)
  }

  /* linha de um militar (ocupante) no Editar */
  function montarOcupante(posto, funcao, m, sobrepoe) {
    var p = pecas();
    var linha = RosterWork.tpl('tpl-escala-distribuicao-escalado');
    if (!linha) return null;
    linha.classList.add('escala-distribuicao-escalado--edicao');
    if (m.fixado && ehNovo(acharAjuste('colocar', m.cpf, posto, funcao))) {
      linha.classList.add('escala-distribuicao-escalado--alterada');
    }
    var icones = linha.querySelector('.escala-distribuicao-icones');
    var origem = RosterWork.tpl('tpl-escala-mes-origem');
    if (origem && p.definirIcone) { p.definirIcone(origem, (p.iconeOrigem && p.iconeOrigem[m.origem]) || (p.iconeOrigem && p.iconeOrigem.sistema)); icones.appendChild(origem); }
    if (m.fixado) { var cad = RosterWork.tpl('tpl-escala-mes-origem'); if (cad && p.definirIcone) { p.definirIcone(cad, 'icone-cadeado'); icones.appendChild(cad); } }
    linha.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    linha.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    if (m.bloqueado) preencherHoras(linha, m.periodos);
    else preencherHorasEditar(linha, posto, funcao, m);
    if (p.marcarConflito) p.marcarConflito(linha, m, null, null);   // ícones + dica; a faixa errada é pintada por período no preencherHorasEditar
    if (sobrepoe) marcarSobreposicao(linha);

    if (!m.bloqueado) {
      linha.classList.add('escala-distribuicao-escalado--clicavel');
      linha.addEventListener('click', function (ev) {
        if (ev.target.closest('.dropdown')) return;   // clique num dropdown de hora não abre o picker
        abrirPicker(linha, posto, funcao, m);
      });
    }
    var acao;
    var nPer = (m.periodos && m.periodos.length) || 0;
    if (!m.bloqueado && nPer >= 2) acao = acaoPorPeriodos(posto, funcao, m, m.periodos);   // 2+ períodos → 1 ✕ por período
    else if (m.bloqueado) acao = acaoVazia();
    else if (funcao.manual) acao = acaoRemover(function () { esvaziar(posto, funcao, m, null); });   // militar de função manual → remove o militar (a função vira vaga)
    else if (m.fixado) acao = acaoRestaurar(function () { restaurar(posto, funcao, m.cpf, false); });  // militar manual em função automática → ↺ restaura o automático
    else acao = acaoRemover(function () { remover(posto, funcao, m); });   // automático → ✕ (vira vaga vazia com cadeado)
    if (acao) linha.appendChild(acao);
    return linha;
  }

  /* linha itálica + riscada com os valores originais (automático trocado/removido) */
  function montarOriginal(orig) {
    var linha = RosterWork.tpl('tpl-escala-edicao-original');
    if (!linha) return null;
    linha.querySelector('.escala-distribuicao-grad').textContent = orig.grad || '';
    linha.querySelector('.escala-distribuicao-nome').textContent = orig.nome || '';
    preencherHoras(linha, orig.periodos);
    return linha;
  }

  /* linha de vaga esvaziada à mão: cadeado, sem nome, com ↺ */
  function montarVazio(posto, funcao, ghost) {
    var p = pecas();
    var linha = RosterWork.tpl('tpl-escala-distribuicao-escalado');
    if (!linha) return null;
    linha.classList.add('escala-distribuicao-escalado--edicao');
    if (ehNovo(acharAjuste('tirar', ghost.cpf, posto, funcao))) linha.classList.add('escala-distribuicao-escalado--alterada');
    var icones = linha.querySelector('.escala-distribuicao-icones');
    var cad = RosterWork.tpl('tpl-escala-mes-origem');
    if (cad && p.definirIcone) { p.definirIcone(cad, 'icone-cadeado'); icones.appendChild(cad); }
    linha.querySelector('.escala-distribuicao-nome').textContent = '';
    linha.appendChild(acaoRestaurar(function () { restaurar(posto, funcao, ghost.cpf, true); }));
    return linha;
  }

  function montarGrupo(posto, funcao) {
    var p = pecas();
    var grupo = RosterWork.tpl('tpl-escala-distribuicao-grupo');
    if (!grupo) return null;
    var fnEl = grupo.querySelector('.escala-distribuicao-funcao');
    fnEl.textContent = p.abreviarFuncao ? p.abreviarFuncao(funcao.nome) : funcao.nome;
    var nf = p.nivelFuncao ? p.nivelFuncao(funcao) : '';
    if (nf) fnEl.classList.add('escala-distribuicao-funcao--' + nf);
    if (funcao.manual) {
      var fx = RosterWork.tpl('tpl-escala-funcao-remover');
      if (fx) { fx.addEventListener('click', function (ev) { ev.stopPropagation(); excluirFuncao(posto, funcao); }); fnEl.insertBefore(fx, fnEl.firstChild); }
    }
    var lista = grupo.querySelector('.escala-distribuicao-militares');
    var ghostPorCpf = {};
    (funcao.ghosts || []).forEach(function (g) { ghostPorCpf[g.cpf] = g; });
    var sobrepostos = cpfsSobrepostos(funcao);
    var usados = {};
    (funcao.militares || []).forEach(function (m) {
      var linha = montarOcupante(posto, funcao, m, !!sobrepostos[m.cpf]);
      if (linha) lista.appendChild(linha);
      if (m.substitui && ghostPorCpf[m.substitui]) {
        var orig = montarOriginal(ghostPorCpf[m.substitui]);
        if (orig) lista.appendChild(orig);
        usados[m.substitui] = true;
      }
    });
    /* ghosts não pareados = remoções (vaga vazia) → linha vazia + original riscado */
    (funcao.ghosts || []).forEach(function (g) {
      if (usados[g.cpf]) return;
      var vazio = montarVazio(posto, funcao, g);
      if (vazio) lista.appendChild(vazio);
      var orig = montarOriginal(g);
      if (orig) lista.appendChild(orig);
    });
    /* função com menos de 24h cobertas: linha "cabe mais" pra somar militar (não apagável) */
    if ((funcao.vao || []).length) {
      var cobertura = montarLinhaCobertura(posto, funcao);
      if (cobertura) lista.appendChild(cobertura);
    }
    return grupo;
  }

  /* linha "cabe mais": vaga de cobertura numa função que ainda não cobre as 24h (08→08) */
  function montarLinhaCobertura(posto, funcao) {
    var linha = RosterWork.tpl('tpl-escala-distribuicao-escalado');
    if (!linha) return null;
    linha.classList.add('escala-distribuicao-escalado--edicao', 'escala-distribuicao-escalado--clicavel', 'escala-distribuicao-escalado--vaga');
    linha.querySelector('.escala-distribuicao-nome').textContent = RosterWork.mensagens.escala.selecioneMilitar;
    linha.addEventListener('click', function () { abrirPicker(linha, posto, funcao, null); });
    linha.appendChild(acaoVazia());
    return linha;
  }

  /* botão "Adicionar função": cria uma vaga vazia no posto; inativo enquanto já houver uma */
  function montarBotaoAdicionar(posto) {
    if (!(posto.adicionar && posto.adicionar.nome_funcao)) return null;
    var botao = RosterWork.tpl('tpl-escala-distribuicao-adicionar');
    if (!botao) return null;
    if (postoTemVaga(posto)) botao.disabled = true;
    else botao.addEventListener('click', function () { adicionarVaga(posto); });
    return botao;
  }

  /* uma vaga vazia: rótulo da função + ✕ à esquerda + linha "Selecione um militar" (clica → picker) */
  function montarVagaPendente(posto, vaga) {
    var p = pecas();
    var grupo = RosterWork.tpl('tpl-escala-distribuicao-grupo');
    if (!grupo) return null;
    var fnEl = grupo.querySelector('.escala-distribuicao-funcao');
    fnEl.textContent = p.abreviarFuncao ? p.abreviarFuncao(vaga.nome) : vaga.nome;
    var fx = RosterWork.tpl('tpl-escala-funcao-remover');
    if (fx) { fx.addEventListener('click', function (ev) { ev.stopPropagation(); descartarVaga(vaga); }); fnEl.insertBefore(fx, fnEl.firstChild); }
    var lista = grupo.querySelector('.escala-distribuicao-militares');
    var linha = RosterWork.tpl('tpl-escala-distribuicao-escalado');
    if (linha) {
      linha.classList.add('escala-distribuicao-escalado--edicao', 'escala-distribuicao-escalado--clicavel', 'escala-distribuicao-escalado--vaga');
      linha.querySelector('.escala-distribuicao-nome').textContent = RosterWork.mensagens.escala.selecioneMilitar;
      linha.addEventListener('click', function () { abrirPicker(linha, posto, { nome: vaga.nome }, null, vaga); });
      linha.appendChild(acaoVazia());
      lista.appendChild(linha);
    }
    return grupo;
  }

  /* (re)desenha o corpo a partir do rascunho — re-simulando no banco */
  function desenhar() {
    if (!ctx) return;
    fecharPicker();
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    atualizarSalvar();
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var carregando = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (carregando) corpo.appendChild(carregando);

    RosterWork.escalasDados.lerDistribuicaoDia(ctx.unidadeId, ctx.iso, rascunho).then(function (dados) {
      if (!ctx || ctx.corpo !== corpo) return;
      corpo.textContent = '';
      if (!dados) {
        var erro = RosterWork.tpl('tpl-escala-distribuicao-estado');
        if (erro) { erro.textContent = RosterWork.mensagens.escala.falhaCarregar; corpo.appendChild(erro); }
        return;
      }
      if (rascunho == null) { rascunho = (dados.ajustes_salvos || []).slice(); base = (dados.ajustes_salvos || []).slice(); }
      ctx.contextoId = dados.contexto_id;
      ctx.dados = dados;
      calcularNovos();
      var p = pecas();
      haConflito = !!(p.temConflito && p.temConflito(dados.postos, true));   // só manual → trava o Salvar
      atualizarSalvar();
      var aviso = p.montarAviso ? p.montarAviso(dados.postos, sujo && haConflito, dados.faltam_modelos, dados.sem_funcao) : null;   // erros + falta-modelo + avisos do motor; "CORRIJA" só quando o manual trava
      if (aviso) corpo.appendChild(aviso);
      var semFuncao = dados.sem_funcao || [];
      if (semFuncao.length) {
        var caixaErro = RosterWork.painel.criarCaixa('Sem função definida', true);
        if (caixaErro) {
          semFuncao.forEach(function (m) { var l = p.linha ? p.linha(m) : null; if (l) caixaErro.appendChild(l); });
          corpo.appendChild(caixaErro);
        }
      }
      (dados.postos || []).forEach(function (posto) {
        var caixa = RosterWork.painel.criarCaixa(posto.nome);
        if (!caixa) return;
        if (posto.em_manutencao) {
          /* viatura em manutenção: caixa amarela + aviso/nota editável; o efetivo FICA nela e o Adicionar segue liberado */
          caixa.classList.add('grupo-caixa--posto-alerta', 'grupo-caixa--manutencao');
          if (p.montarManutencao) { var m = p.montarManutencao(posto, true); if (m) caixa.appendChild(m); }
        } else {
          var np = p.nivelPosto ? p.nivelPosto(posto) : '';
          if (np) caixa.classList.add('grupo-caixa--posto-' + np);
        }
        (posto.funcoes || []).forEach(function (funcao) { var g = montarGrupo(posto, funcao); if (g) caixa.appendChild(g); });
        vagaDoPosto(posto).forEach(function (v) { var g = montarVagaPendente(posto, v); if (g) caixa.appendChild(g); });
        var botaoAdd = montarBotaoAdicionar(posto);
        if (botaoAdd) caixa.appendChild(botaoAdd);
        corpo.appendChild(caixa);
      });

      /* Observações do dia (trocas + folgas automáticas + notas do admin); no Editar o admin
         pode adicionar e excluir as próprias notas */
      var caixaObs = p.observacoes ? p.observacoes(dados.observacoes || [], { editar: true, unidadeId: ctx.unidadeId, iso: ctx.iso }) : null;
      if (caixaObs) corpo.appendChild(caixaObs);
    });
  }

  /* ---------- rodapé (Cancelar / Salvar) ---------- */

  function atualizarSalvar() {
    /* Salvar só habilita com edição E sem conflito (função fora da disponibilidade) */
    if (ctx && ctx.btnSalvar) ctx.btnSalvar.disabled = !sujo || haConflito;
  }

  function montarRodape(rodape) {
    if (!rodape) return;
    rodape.textContent = '';
    var tpl = document.getElementById('tpl-escala-painel-acoes');
    if (!tpl) { rodape.classList.add('oculto'); return; }
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-painel-cancelar');
    if (cancelar) cancelar.addEventListener('click', aoClicarCancelar);
    ctx.btnSalvar = rodape.querySelector('.escala-painel-salvar');
    if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    atualizarSalvar();
  }

  function aoClicarCancelar() {
    if (sujo && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.escala.descartarAlteracoes,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: function () { if (ctx && ctx.aoCancelar) ctx.aoCancelar(); }
      });
    } else if (ctx && ctx.aoCancelar) {
      ctx.aoCancelar();
    }
  }

  function salvar() {
    if (haConflito) return;   // trava: não salva com função fora da disponibilidade
    if (!sujo) { if (ctx && ctx.aoCancelar) ctx.aoCancelar(); return; }
    if (!ctx || ctx.contextoId == null) return;
    /* função manual sem militar (vaga) será excluída ao salvar — confirma antes */
    if (vagas.length && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: RosterWork.mensagens.escala.funcaoVaziaExcluir,
        textoConfirmar: RosterWork.mensagens.botoes.salvar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: gravar
      });
      return;
    }
    gravar();
  }

  function gravar() {
    if (!ctx || ctx.contextoId == null) return;
    /* captura antes do salvar assíncrono (o ctx pode ser zerado ao fechar) */
    var uid = ctx.unidadeId, isoSalvo = ctx.iso, ctxId = ctx.contextoId;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.escalasDados.salvarAjustesDia(ctxId, isoSalvo, rascunho, RosterWork.sessao.cpf()).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r._falha === 'conexao') {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      } else if (r && r._falha === 'servidor') {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
      } else if (r && r.success) {
        sujo = false;
        if (ctx && ctx.aoCancelar) ctx.aoCancelar();
        /* avisa a grade do Mês para atualizar só esta célula (sem re-renderizar tudo) */
        window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: uid, iso: isoSalvo } }));
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
      } else {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.escala.falhaSalvar });
      }
    });
  }

  /* ---------- ciclo de vida ---------- */

  function montar(corpo, rodape, unidadeId, iso, aoCancelar) {
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, contextoId: null, dados: null, aoCancelar: aoCancelar, btnSalvar: null };
    rascunho = null;
    base = null;
    sujo = false;
    novos = {};
    haConflito = false;
    vagas = [];
    montarRodape(rodape);
    desenhar();
  }

  function reset() {
    fecharPicker();
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    ctx = null;
    rascunho = null;
    base = null;
    sujo = false;
    novos = {};
    haConflito = false;
    vagas = [];
  }

  /* guarda-de-saída: o navegador avisa ao fechar/recarregar com alteração não salva */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return sujo; });
  }

  window.RosterWork.escalasPainelEditar = { montar: montar, reset: reset, estaSujo: function () { return sujo; } };
})();
