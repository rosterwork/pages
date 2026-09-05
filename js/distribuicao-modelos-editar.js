/* ============================================================
   DISTRIBUIÇÃO — edição de um modelo (Rodada 2A)
   Estado mutável das vagas do modelo selecionado + renderizar editável
   (perfil, antiguidade, grau ideal e rodízio por clique na célula),
   "Nova função" / remover vaga, Desfazer/Refazer e o rodapé de ações.
   A FUNÇÃO é derivada da posição (não se escolhe). O acúmulo editável
   e os papéis especiais entram em seguida. Só admin.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var grupo = null;        /* { cia, unidades:[...] } */
  var composicao = null;   /* unidades do modelo (of/pç), de dist_listar_modelos */
  var estado = null;       /* { modeloId, unidades:[{unidade_id, nome, tipo, chave, postos:[{...vagas}]}] } */
  var graus = [];
  var seq = 0;
  var pilhaUndo = [], pilhaRedo = [];
  var sujo = false;

  /* ---------- nome da função derivado da posição ---------- */
  function baseInstalacao(nome) {
    nome = nome || '';
    if (/^Central/i.test(nome)) return 'Rádio Operador';
    if (/^Rancho/i.test(nome)) return 'Rancheiro';
    if (/^Almox/i.test(nome)) return 'Almoxarife';
    return 'Efetivo';
  }
  /* deriva o nome de cada função pela posição (pulando os papéis especiais):
     viatura = 1ª não-especial Condutor, demais "Efetivo n" (n = nº do slot);
     instalação = base, base 2, base 3… (por ordem de ocorrência) */
  function rederivarPosto(posto) {
    var ocorrencia = 0;
    posto.vagas.forEach(function (vg, i) {
      vg.slot_numero = i + 1;
      if (vg.papel_especial) return;
      ocorrencia++;
      if (posto.tipo === 'viatura') {
        vg.nome_funcao = ocorrencia === 1 ? 'Condutor' : 'Efetivo ' + (i + 1);
      } else {
        var base = baseInstalacao(posto.nome);
        vg.nome_funcao = ocorrencia === 1 ? base : base + ' ' + ocorrencia;
      }
    });
  }

  /* ---------- construir o estado a partir das RPCs ---------- */
  function chaveUnidade(u) {
    return u.unidade_id + '_' + (u.oficiais || 0) + 'OFC_' + (u.pracas || 0) + 'PRC';
  }
  function construir(dados, modelo) {
    seq = 0;
    var comp = {};
    (modelo.unidades || []).forEach(function (u) { comp[u.unidade_id] = u; });
    var unidades = (dados.unidades || []).map(function (u) {
      var cu = comp[u.unidade_id] || { oficiais: 0, pracas: 0 };
      var postos = (u.postos || []).map(function (p) {
        return {
          tipo: p.tipo, posto_id: p.posto_id, nome: p.nome, cnh: p.cnh,
          vagas: (p.vagas || []).map(function (vg) {
            return {
              tempId: 't' + (seq++), idSlot: vg.id_slot, chave: vg.chave || null,
              nome_funcao: vg.nome_funcao, tipo_contador: vg.tipo_contador,
              base: vg.base, ideal: vg.ideal, ideal_calc: vg.ideal_calc,
              ordem: vg.ordem, ordemSentido: vg.ordem_sentido || null,
              rodizio: vg.rodizio, papel_especial: vg.papel_especial,
              slot_numero: vg.slot_numero, acumuloIdSlot: vg.acumulo_slot_id, acumuloTempId: null,
              acumuloOrdem: (vg.acumulo_ordem != null ? vg.acumulo_ordem : 0)
            };
          })
        };
      });
      return {
        unidade_id: u.unidade_id, nome: u.nome, tipo: u.tipo,
        oficiais: cu.oficiais || 0, pracas: cu.pracas || 0,
        chave: chaveUnidade({ unidade_id: u.unidade_id, oficiais: cu.oficiais, pracas: cu.pracas }),
        postos: postos,
        vemDe: (u.vem_de || []).map(function (r) {   /* reforços que ENTRAM nesta unidade (origem = de onde vem) */
          return {
            tempId: 't' + (seq++), origemUnidadeId: r.origem_unidade_id,
            tipo_contador: r.tipo_contador, ordem: r.ordem, ordemSentido: r.ordem_sentido || null,
            ideal: r.ideal, ideal_calc: r.ideal_calc, rodizio: !!r.rodizio
          };
        })
      };
    });
    /* a chave de cada vaga (preserva compostas existentes); resolve acúmulo idSlot→tempId */
    var mapa = {};
    unidades.forEach(function (u) {
      u.postos.forEach(function (p) { p.vagas.forEach(function (v) { mapa[v.idSlot] = v.tempId; if (!v.chave) v.chave = u.chave; }); });
    });
    unidades.forEach(function (u) {
      u.postos.forEach(function (p) { p.vagas.forEach(function (v) { if (v.acumuloIdSlot) v.acumuloTempId = mapa[v.acumuloIdSlot] || null; }); });
    });
    return { modeloId: modelo.id_grupo_completo, unidades: unidades };
  }

  /* ---------- undo / sujo ---------- */
  function snapshot() { return JSON.stringify(estado); }
  function registrar() {
    pilhaUndo.push(snapshot());
    pilhaRedo = [];
    sujo = true;
  }
  function aplicar(json) { estado = JSON.parse(json); renderizar(); }
  function desfazer() {
    if (!pilhaUndo.length) return;
    pilhaRedo.push(snapshot());
    aplicar(pilhaUndo.pop());
  }
  function refazer() {
    if (!pilhaRedo.length) return;
    pilhaUndo.push(snapshot());
    aplicar(pilhaRedo.pop());
  }

  /* ---------- desfazer/refazer no subcabeçalho (só aparece durante o Editar) ---------- */
  var elDesfazer = null, elRefazer = null, grupoHist = null, atalhosLigados = false;
  function ligarHistorico() {
    /* a tela é reconstruída a cada entrada na página: recaptura os elementos atuais toda vez */
    grupoHist = document.querySelector('.distribuicao-historico');
    elDesfazer = document.querySelector('.distribuicao-desfazer');
    elRefazer = document.querySelector('.distribuicao-refazer');
    if (!elDesfazer || !elRefazer) return;   /* subcabeçalho ainda não está no DOM */
    if (!elDesfazer.dataset.ligado) {   /* botões novos a cada reconstrução: religa sem duplicar na mesma visita */
      elDesfazer.dataset.ligado = '1';
      elDesfazer.addEventListener('click', desfazer);
      elRefazer.addEventListener('click', refazer);
    }
    /* atalhos: Ctrl+Z desfaz, Ctrl+Y ou Ctrl+Shift+Z refaz — só enquanto edita e fora de campos de texto.
       O keydown vive no document (não é recriado), então liga UMA vez; ele lê o grupoHist atual. */
    if (!atalhosLigados) {
      atalhosLigados = true;
      document.addEventListener('keydown', function (e) {
        if (!grupoHist || grupoHist.classList.contains('oculto')) return;
        var alvo = e.target;
        if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
        if (!(e.ctrlKey || e.metaKey)) return;
        var tecla = (e.key || '').toLowerCase();
        if (tecla === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); }
        else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); }
      });
    }
  }
  function mostrarHistorico(mostrar) {
    ligarHistorico();
    if (grupoHist) grupoHist.classList.toggle('oculto', !mostrar);
    atualizarHistorico();
  }
  function atualizarHistorico() {
    if (elDesfazer) elDesfazer.disabled = !pilhaUndo.length;
    if (elRefazer) elRefazer.disabled = !pilhaRedo.length;
  }

  /* ---------- menus (popula o .dropdown-menu de uma célula) ---------- */
  function item(texto, ativo, aoEscolher) {
    var it = RosterWork.tpl('tpl-distribuicao-item');
    it.textContent = texto;
    if (ativo) it.classList.add('dropdown-item--ativo');
    it.addEventListener('click', function () { aoEscolher(); });
    return it;
  }

  function menuPerfil(menu, vg) {
    menu.textContent = '';
    [['Pracas', 'Praça'], ['Oficiais', 'Oficial']].forEach(function (o) {
      menu.appendChild(item(o[1], vg.tipo_contador === o[0], function () { mudar(vg, function () { vg.tipo_contador = o[0]; if (vg.ideal) { vg.ideal = null; vg.ideal_calc = null; } }); }));
    });
  }
  /* ---------- antiguidade: numeração sem buracos + auto-reordenação POR UNIDADE/PELOTÃO (como no antigo) ----------
     O número é o ranking de antiguidade DENTRO do pelotão (único no pelotão); cada pelotão é independente. */
  function vagasDaUnidade(unidade) {
    var lista = [];
    unidade.postos.forEach(function (p) { p.vagas.forEach(function (v) { lista.push(v); }); });
    return lista;
  }
  function unidadeDaVaga(vg) {
    for (var i = 0; i < estado.unidades.length; i++) {
      var u = estado.unidades[i];
      for (var j = 0; j < u.postos.length; j++) { if (u.postos[j].vagas.indexOf(vg) >= 0) return u; }
    }
    return null;
  }
  function postoDaVaga(vg) {
    for (var i = 0; i < estado.unidades.length; i++) {
      var u = estado.unidades[i];
      for (var j = 0; j < u.postos.length; j++) { if (u.postos[j].vagas.indexOf(vg) >= 0) return u.postos[j]; }
    }
    return null;
  }
  function ordemComSinal(v) { return v.ordem ? (v.ordemSentido === 'moderno' ? -v.ordem : v.ordem) : null; }
  function definirOrdem(v, n) {
    if (n == null || n === 0) { v.ordem = null; v.ordemSentido = null; }
    else if (n < 0) { v.ordem = -n; v.ordemSentido = 'moderno'; }
    else { v.ordem = n; v.ordemSentido = 'antigo'; }
  }
  /* compacta a numeração de UMA unidade/pelotão: papel especial = 1º mais antigo; comuns antigos seguem 2,3…; modernos 1,2… (sem buracos) */
  function compactarUnidade(unidade) {
    if (!unidade) return;
    var vagas = vagasDaUnidade(unidade);
    var temEspecial = vagas.some(function (v) { return v.papel_especial; });
    vagas.forEach(function (v) { if (v.papel_especial) { v.ordem = 1; v.ordemSentido = 'antigo'; } });
    var antigos = vagas.filter(function (v) { return !v.papel_especial && ordemComSinal(v) > 0; })
                       .sort(function (a, b) { return ordemComSinal(a) - ordemComSinal(b); });
    var modernos = vagas.filter(function (v) { return !v.papel_especial && ordemComSinal(v) < 0; })
                        .sort(function (a, b) { return Math.abs(ordemComSinal(a)) - Math.abs(ordemComSinal(b)); });
    var inicioAntigo = temEspecial ? 2 : 1;
    antigos.forEach(function (v, i) { definirOrdem(v, inicioAntigo + i); });
    modernos.forEach(function (v, i) { definirOrdem(v, -(1 + i)); });
  }
  /* aplica a antiguidade digitada numa unidade/pelotão: empurra os do mesmo sentido com nº ≥ e compacta */
  function reordenarUnidade(unidade, vgInsere, novoSinal) {
    if (novoSinal == null) { definirOrdem(vgInsere, null); compactarUnidade(unidade); return; }
    var vagas = vagasDaUnidade(unidade);
    var temEspecial = vagas.some(function (v) { return v !== vgInsere && v.papel_especial; });
    var neg = novoSinal < 0, abs = Math.abs(novoSinal);
    if (temEspecial && abs === 1 && !neg) abs = 2;   /* o 1º mais antigo é do papel especial */
    vagas.forEach(function (v) {
      if (v === vgInsere || v.papel_especial) return;
      var n = ordemComSinal(v); if (n == null) return;
      var mesmoSentido = neg ? (n < 0) : (n > 0); if (!mesmoSentido) return;
      if (Math.abs(n) >= abs) definirOrdem(v, n < 0 ? n - 1 : n + 1);
    });
    definirOrdem(vgInsere, neg ? -abs : abs);
    compactarUnidade(unidade);
  }
  function aplicarAntiguidade(vg, sinal) {
    registrar();
    var u = unidadeDaVaga(vg);
    if (u) reordenarUnidade(u, vg, sinal); else definirOrdem(vg, sinal);
    renderizar();
  }

  /* menu de antiguidade reutilizável: `alvo` tem ordem/ordemSentido; `aoComitar(sinal)` aplica a mudança
     (nas vagas = reordena o pelotão; no reforço = só define quem sai). */
  function menuAntiguidade(menu, alvo, aoComitar) {
    menu.textContent = '';
    var ctrl = RosterWork.tpl('tpl-distribuicao-antig-menu');
    var rVazio = ctrl.querySelector('[data-modo="vazio"]');
    var rAntigo = ctrl.querySelector('[data-modo="antigo"]');
    var rModerno = ctrl.querySelector('[data-modo="moderno"]');
    var sinal = ctrl.querySelector('.distribuicao-antig-sinal');
    var input = ctrl.querySelector('.distribuicao-antig-input');
    var nome = 'antig-' + alvo.tempId;
    [rVazio, rAntigo, rModerno].forEach(function (r) { r.name = nome; });
    var modo = alvo.ordemSentido === 'moderno' ? 'moderno' : (alvo.ordem ? 'antigo' : 'vazio');
    if (modo === 'vazio') { rVazio.checked = true; input.value = ''; input.disabled = true; sinal.classList.add('oculto'); }
    else {
      (modo === 'moderno' ? rModerno : rAntigo).checked = true;
      input.value = alvo.ordem ? String(alvo.ordem) : '';
      input.disabled = false;
      sinal.classList.toggle('oculto', modo !== 'moderno');
    }
    rVazio.addEventListener('change', function (e) { e.stopPropagation(); input.value = ''; input.disabled = true; sinal.classList.add('oculto'); comitar(); });
    rAntigo.addEventListener('change', function (e) { e.stopPropagation(); input.disabled = false; sinal.classList.add('oculto'); input.focus(); });
    rModerno.addEventListener('change', function (e) { e.stopPropagation(); input.disabled = false; sinal.classList.remove('oculto'); input.focus(); });
    input.addEventListener('input', function (e) { e.stopPropagation(); input.value = input.value.replace(/[^0-9]/g, ''); });
    function comitar() {
      var sinalNum = null;
      if (!rVazio.checked) { var num = parseInt(input.value, 10) || 0; if (num > 0) sinalNum = rModerno.checked ? -num : num; }
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      if (sinalNum === ordemComSinal(alvo)) return;   /* nada mudou → só fecha */
      aoComitar(sinalNum);
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); comitar(); } });
    input.addEventListener('blur', function (e) {
      if (e.relatedTarget && ctrl.contains(e.relatedTarget)) return;   /* foco foi a um rádio do mesmo controle → não comita ainda */
      comitar();
    });
    menu.appendChild(ctrl);
  }
  function grausDoPerfil(tipoContador) {
    var oficiais = tipoContador === 'Oficiais';
    return graus.filter(function (g) {
      var ehOf = (g.tipo === 'Oficial' || g.tipo === 'Oficial Especial');
      return oficiais ? ehOf : !ehOf;
    });
  }
  /* menu de grau: só "ou +" / "ou −" (o "somente igual" saiu). O grau nasce SEM sentido e a lista de
     graus só habilita depois de escolher o sentido; a lista segue o sentido (Sd.→Sub.Ten. para "+",
     Sub.Ten.→Sd. para "−"). Trocar o sentido atualiza o campo NA HORA, sem fechar o menu. */
  function menuGrau(rolagem, vg, cel) {
    rolagem.textContent = '';
    var ctrl = RosterWork.tpl('tpl-distribuicao-grau-menu');
    var nome = 'grau-' + vg.tempId;
    var rMais = ctrl.querySelector('[data-calc="antigo"]');    /* igual ou mais antigo = '+' */
    var rMenos = ctrl.querySelector('[data-calc="moderno"]');  /* igual ou mais moderno = '-' */
    rMais.name = nome; rMenos.name = nome;
    var lista = ctrl.querySelector('.distribuicao-grau-lista');
    var dica = ctrl.querySelector('.distribuicao-grau-dica');

    if (vg.ideal_calc === '+') rMais.checked = true;
    else if (vg.ideal_calc === '-') rMenos.checked = true;   /* sem sentido = nenhum marcado */

    function sentido() { return rMenos.checked ? '-' : (rMais.checked ? '+' : null); }

    /* grava ideal/calc SEM re-renderizar (o menu fica aberto): só atualiza a célula e o rodapé */
    function aplicar(ideal, calc) {
      registrar();
      vg.ideal = ideal; vg.ideal_calc = calc;
      gatilho(cel, textoGrau(vg), !vg.ideal);
      var linha = cel.closest('.distribuicao-vaga');   /* tira/põe a cor de erro da linha na hora */
      if (linha) linha.classList.toggle('distribuicao-vaga--erro', vagaIncompleta(vg));
      atualizarRodape();
    }

    /* (re)monta a lista na ordem do sentido; sem sentido → esconde a lista e mostra a dica */
    function montarLista() {
      lista.textContent = '';
      var calc = sentido();
      if (dica) dica.classList.toggle('oculto', !!calc);
      lista.classList.toggle('oculto', !calc);
      if (!calc) return;
      grausDoPerfil(vg.tipo_contador).slice().sort(function (a, b) {
        return calc === '+' ? (b.grau_antiguidade - a.grau_antiguidade)   /* Sd.→Sub.Ten. */
                            : (a.grau_antiguidade - b.grau_antiguidade);   /* Sub.Ten.→Sd. */
      }).forEach(function (g) {
        var it = RosterWork.tpl('tpl-distribuicao-item');
        it.textContent = g.grau_abreviacao;
        if (vg.ideal === g.grau_abreviacao) it.classList.add('dropdown-item--ativo');
        it.addEventListener('click', function (e) {
          e.stopPropagation();                       /* não fecha o menu — pode trocar o sentido depois */
          aplicar(g.grau_abreviacao, sentido());
          lista.querySelectorAll('.dropdown-item').forEach(function (o) {
            o.classList.toggle('dropdown-item--ativo', o.textContent === vg.ideal);
          });
        });
        lista.appendChild(it);
      });
    }

    [rMais, rMenos].forEach(function (r) {
      r.addEventListener('change', function (e) {
        e.stopPropagation();
        if (vg.ideal) aplicar(vg.ideal, sentido());   /* já há grau → troca o sentido na hora */
        montarLista();                                 /* reordena e habilita a lista */
      });
    });

    ctrl.querySelector('[data-acao="vazio"]').addEventListener('click', function (e) {
      e.stopPropagation();
      rMais.checked = false; rMenos.checked = false;
      aplicar(null, null);
      montarLista();
    });

    montarLista();
    rolagem.appendChild(ctrl);
  }

  /* aplica uma mudança numa vaga: registra undo, executa, re-renderiza */
  function mudar(vg, fn) { registrar(); fn(); renderizar(); }

  /* ---------- nova função / remover vaga ---------- */
  function novaVaga(posto) {
    registrar();
    posto.vagas.push({
      tempId: 't' + (seq++), idSlot: null, chave: null,
      nome_funcao: '', tipo_contador: 'Pracas',
      base: null, ideal: null, ideal_calc: null, ordem: null, ordemSentido: null, rodizio: false,
      papel_especial: null, slot_numero: null, acumuloIdSlot: null, acumuloTempId: null, acumuloOrdem: 0
    });
    rederivarPosto(posto);
    renderizar();
  }
  function removerVaga(posto, vg) {
    registrar();
    var unidade = unidadeDaVaga(vg);
    var principal = vg.acumuloTempId ? acharVaga(vg.acumuloTempId) : null;
    todasVagas().forEach(function (v) { if (v.acumuloTempId === vg.tempId) { v.acumuloTempId = null; v.acumuloOrdem = 0; } });   /* se era principal, solta as acumuladas */
    posto.vagas = posto.vagas.filter(function (v) { return v !== vg; });
    if (principal && acharVaga(principal.tempId)) reagruparAcumulo(grupoAcumulo(principal));   /* era dependente: renumera o grupo */
    rederivarPosto(posto);
    compactarUnidade(unidade);   /* sem buracos na antiguidade do pelotão após remover */
    renderizar();
  }

  /* ---------- renderizar ---------- */
  function gatilho(cel, texto, vazio) {
    var g = cel.querySelector('.distribuicao-cel-gatilho');
    g.textContent = texto;
    cel.classList.toggle('distribuicao-cel--vazio', !!vazio);
  }
  function chip(texto, acumulo, origem, aoRemover) {
    var c = RosterWork.tpl('tpl-distribuicao-chip');
    c.querySelector('.distribuicao-chip-texto').textContent = texto || '';
    if (acumulo) {
      c.classList.add('distribuicao-chip--acumulo');
      c.querySelector('.distribuicao-chip-icone').classList.remove('oculto');
      c.querySelector('.distribuicao-chip-origem').textContent = origem || '';
    }
    if (aoRemover) {
      var rem = c.querySelector('.distribuicao-chip-remover');
      if (rem) { rem.classList.remove('oculto'); rem.addEventListener('click', function (e) { e.stopPropagation(); aoRemover(); }); }
    }
    return c;
  }

  /* ---------- acúmulo ---------- */
  function todasVagas() {
    var lista = [];
    estado.unidades.forEach(function (u) { u.postos.forEach(function (p) { p.vagas.forEach(function (v) { lista.push(v); }); }); });
    return lista;
  }
  function acharVaga(tempId) {
    var t = todasVagas();
    for (var i = 0; i < t.length; i++) if (t[i].tempId === tempId) return t[i];
    return null;
  }
  /* grupo de acúmulo, NA ORDEM (acumuloOrdem): a 1ª é a principal. Mesma ordem em toda vaga do grupo. */
  function grupoAcumulo(vg) {
    var principal = vg.acumuloTempId ? (acharVaga(vg.acumuloTempId) || vg) : vg;
    var membros = todasVagas().filter(function (v) { return v === principal || v.acumuloTempId === principal.tempId; });
    membros.sort(function (a, b) {
      var d = (a.acumuloOrdem || 0) - (b.acumuloOrdem || 0);
      if (d !== 0) return d;
      if (a === principal) return -1;
      if (b === principal) return 1;
      return 0;
    });
    return membros;
  }
  /* Chefe de Socorro / Oficial de Área podem acumular o Condutor do PRÓPRIO posto — a única
     exceção à regra "acúmulo só entre postos diferentes" (item 11) */
  function ehPapelViatura(vg) { return vg.papel_especial === 'chefe_socorro' || vg.papel_especial === 'oficial_area'; }
  function ehCondutor(vg) { return /^Condutor/i.test(vg.nome_funcao || ''); }
  /* acúmulo DENTRO da mesma viatura (Chefe/OA + Condutor do próprio posto): a linha do Condutor
     mescla na do papel especial — não ganha linha própria nem conta como cadeira na numeração */
  function ehSecundariaMesmoPostoEm(posto, vg) {
    return !!(vg.acumuloTempId && posto && posto.vagas.some(function (v) { return v.tempId === vg.acumuloTempId; }));
  }
  /* nº da cadeira visível de uma vaga na viatura (pula as secundárias mescladas do mesmo posto) */
  function numeroCadeira(posto, vg) {
    var n = 0;
    for (var i = 0; i < posto.vagas.length; i++) {
      if (ehSecundariaMesmoPostoEm(posto, posto.vagas[i])) continue;
      n++;
      if (posto.vagas[i] === vg) return n;
    }
    return n;
  }
  /* nome exibido: renumera "Efetivo N" pela cadeira visível (Condutor mesclado → Efetivo 3 vira 2) */
  function nomeExibir(posto, vg) {
    if (posto && posto.tipo === 'viatura' && posto.vagas.indexOf(vg) >= 0 && /^Efetivo \d+$/.test(vg.nome_funcao || '')) {
      return 'Efetivo ' + numeroCadeira(posto, vg);
    }
    return vg.nome_funcao;
  }
  /* Condutor é obrigatório enquanto a viatura tiver outra cadeira (só pode excluir quando é o único) */
  function condutorObrigatorio(posto, vg) {
    if (!posto || posto.tipo !== 'viatura' || !ehCondutor(vg)) return false;
    return posto.vagas.filter(function (v) { return !ehSecundariaMesmoPostoEm(posto, v); }).length > 1;
  }
  /* postos não podem repetir dentro de um grupo, salvo a exceção papel de viatura + Condutor do mesmo posto */
  function postosDoGrupoValidos(membros) {
    var vistos = [], anchor = membros[0], postoAnchor = postoDaVaga(anchor);
    for (var i = 0; i < membros.length; i++) {
      var p = postoDaVaga(membros[i]);
      if (vistos.indexOf(p) >= 0) {
        if (!(ehPapelViatura(anchor) && p === postoAnchor && ehCondutor(membros[i]))) return false;
      } else { vistos.push(p); }
    }
    return true;
  }
  /* v pode entrar no grupo de `membros`? (item 11 = postos diferentes; item 17 = mesclar grupos, teto 3) */
  function elegivelParaGrupo(membros, v) {
    if (membros.indexOf(v) >= 0) return false;    /* já está no grupo */
    if (v.papel_especial) return false;           /* função de fora nunca é papel especial */
    var grupoV = grupoAcumulo(v);
    if (membros.length + grupoV.length > 3) return false;   /* teto de 3 por grupo */
    var combinado = membros.concat(grupoV.filter(function (x) { return membros.indexOf(x) < 0; }));
    return postosDoGrupoValidos(combinado);
  }
  /* fixa a ordem do grupo: 1ª vira principal (re-aponta), demais 1..n */
  function reagruparAcumulo(ordenados) {
    if (!ordenados || !ordenados.length) return;
    var princ = ordenados[0];
    ordenados.forEach(function (m, i) {
      m.acumuloOrdem = i;
      m.acumuloTempId = (m === princ) ? null : princ.tempId;
    });
  }
  /* junta v ao grupo do `principal` — serve para função solta OU para MESCLAR outro grupo
     inteiro (item 17); o principal continua sendo a 1ª (âncora) */
  function juntarAcumulo(principal, v) {
    mudar(v, function () {
      var atual = grupoAcumulo(principal);
      var outro = grupoAcumulo(v).filter(function (x) { return atual.indexOf(x) < 0; });
      reagruparAcumulo(atual.concat(outro));
    });
  }
  /* tira uma função do grupo (pelo X); vale para qualquer membro — se era a âncora, o
     próximo assume; o que saiu volta a ser vaga solta */
  function desagruparVaga(s) {
    mudar(s, function () {
      var resto = grupoAcumulo(s).filter(function (x) { return x !== s; });
      s.acumuloTempId = null;
      s.acumuloOrdem = 0;
      if (resto.length) reagruparAcumulo(resto);
    });
  }
  /* passar o mouse num chip acende TODOS do mesmo grupo, em qualquer linha (itens 14/17) */
  function ligarRealceGrupo(chipEl, grupoId) {
    chipEl.addEventListener('mouseenter', function () { realcarGrupo(grupoId, true); });
    chipEl.addEventListener('mouseleave', function () { realcarGrupo(grupoId, false); });
  }
  function realcarGrupo(grupoId, ligar) {
    var corpo = document.getElementById('distribuicao-corpo');
    if (!corpo) return;
    var chips = corpo.querySelectorAll('.distribuicao-chip[data-grupo="' + grupoId + '"]');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('distribuicao-chip--realce', ligar);
  }
  /* arrastar um chip reordena o grupo AO VIVO (os chips deslizam); quem fica em 1º vira a principal */
  var arrastoChip = null;
  function mesmoGrupo(a, b) { return grupoAcumulo(a)[0].tempId === grupoAcumulo(b)[0].tempId; }
  function comitarOrdemChips(funcEl) {
    var ordenados = [];
    funcEl.querySelectorAll('.distribuicao-chip[data-tempid]').forEach(function (el) {
      var m = acharVaga(el.getAttribute('data-tempid'));
      if (m) ordenados.push(m);
    });
    if (ordenados.length < 2) return;
    var atual = grupoAcumulo(ordenados[0]);
    var igual = atual.length === ordenados.length && atual.every(function (m, i) { return m === ordenados[i]; });
    if (igual) return;                       /* nada mudou → não registra nem re-renderiza */
    registrar();
    reagruparAcumulo(ordenados);
    renderizar();
  }
  function ligarArrastoChip(chipEl, membro, funcEl) {
    chipEl.setAttribute('draggable', 'true');
    chipEl.setAttribute('data-tempid', membro.tempId);
    chipEl.addEventListener('dragstart', function (e) {
      arrastoChip = membro;
      chipEl.classList.add('distribuicao-chip--arrastando');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', membro.tempId); } catch (_) {} }
      e.stopPropagation();
    });
    chipEl.addEventListener('dragend', function () {
      chipEl.classList.remove('distribuicao-chip--arrastando');
      if (arrastoChip) { arrastoChip = null; comitarOrdemChips(funcEl); }
    });
    chipEl.addEventListener('dragover', function (e) {
      if (!arrastoChip || arrastoChip === membro || !mesmoGrupo(arrastoChip, membro)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      var arrastadoEl = funcEl.querySelector('.distribuicao-chip--arrastando');
      if (!arrastadoEl || arrastadoEl === chipEl) return;
      var rect = chipEl.getBoundingClientRect();
      var depois = (e.clientX - rect.left) > rect.width / 2;   /* move o chip arrastado para a posição sob o cursor */
      funcEl.insertBefore(arrastadoEl, depois ? chipEl.nextSibling : chipEl);
    });
    chipEl.addEventListener('drop', function (e) { e.preventDefault(); });
  }
  /* ---------- escada de acúmulo: Unidade → Posto → Função (item 3) ---------- */
  /* um nó (unidade ou posto): a linha inteira expande/recolhe em sanfona */
  function escadaNo(nome) {
    var no = RosterWork.tpl('tpl-distribuicao-escada-no');
    no.querySelector('.arvore-nome').textContent = nome || '';
    no.querySelector('.arvore-linha').addEventListener('click', function () { escadaAlternar(no); });
    return no;
  }
  /* uma folha (função elegível): clicar junta/mescla ao grupo; se já agrupada, mostra o ícone */
  function escadaFolha(nome, jaAgrupada, grupoId, menu, aoEscolher) {
    var folha = RosterWork.tpl('tpl-distribuicao-escada-no');
    folha.classList.add('distribuicao-escada-folha');
    folha.querySelector('.arvore-nome').textContent = nome || '';
    folha.querySelector('.arvore-seta').classList.add('arvore-seta--oculta');
    var linha = folha.querySelector('.arvore-linha');
    if (jaAgrupada) {
      folha.querySelector('.distribuicao-escada-icone').classList.remove('oculto');   /* já em outro grupo (item 17) */
      linha.setAttribute('data-grupo', grupoId);
      ligarRealceEscada(linha, menu, grupoId);   /* hover realça o par na lista */
    }
    linha.addEventListener('click', function () { aoEscolher(); });
    return folha;
  }
  /* sanfona: abrir um nó recolhe os irmãos do mesmo nível */
  function escadaAlternar(no) {
    var aberto = no.classList.contains('arvore-grupo--aberto');
    var pai = no.parentElement;
    if (pai) {
      var irmaos = pai.children;
      for (var i = 0; i < irmaos.length; i++) {
        var irmao = irmaos[i];
        if (irmao !== no && irmao.classList && irmao.classList.contains('arvore-grupo')) {
          irmao.classList.remove('arvore-grupo--aberto');
          var s = irmao.querySelector('.arvore-seta');
          if (s) s.setAttribute('aria-expanded', 'false');
        }
      }
    }
    no.classList.toggle('arvore-grupo--aberto', !aberto);
    var seta = no.querySelector('.arvore-seta');
    if (seta) seta.setAttribute('aria-expanded', String(!aberto));
  }
  function ligarRealceEscada(linha, menu, grupoId) {
    linha.addEventListener('mouseenter', function () { marcarParEscada(menu, grupoId, true); });
    linha.addEventListener('mouseleave', function () { marcarParEscada(menu, grupoId, false); });
  }
  function marcarParEscada(menu, grupoId, ligar) {
    var pares = menu.querySelectorAll('.arvore-linha[data-grupo="' + grupoId + '"]');
    for (var i = 0; i < pares.length; i++) pares[i].classList.toggle('distribuicao-escada-linha--par', ligar);
  }
  function botaoAcumulo(vg) {
    var wrap = RosterWork.tpl('tpl-distribuicao-acumulo-add');
    var menu = wrap.querySelector('.dropdown-menu');
    menu.classList.add('distribuicao-escada');
    var membros = grupoAcumulo(vg);
    var uAlvo = unidadeDaVaga(vg);   /* a unidade da vaga atual começa aberta na escada */
    var algum = false;
    estado.unidades.forEach(function (u) {
      var postosEls = [];
      u.postos.forEach(function (p) {
        var funcoes = p.vagas.filter(function (v) { return elegivelParaGrupo(membros, v); });
        if (!funcoes.length) return;
        var postoNo = escadaNo(p.nome || '');
        var filhos = postoNo.querySelector('.arvore-filhos');
        funcoes.forEach(function (v) {
          var grupoV = grupoAcumulo(v);
          filhos.appendChild(escadaFolha(v.nome_funcao || '', grupoV.length > 1, grupoV[0].tempId, menu, function () {
            juntarAcumulo(membros[0], v);
          }));
        });
        postosEls.push(postoNo);
      });
      if (!postosEls.length) return;
      algum = true;
      var uniNo = escadaNo(u.nome || '');
      var uniFilhos = uniNo.querySelector('.arvore-filhos');
      postosEls.forEach(function (pn) { uniFilhos.appendChild(pn); });
      if (u === uAlvo) {   /* item 6.01a: a unidade da vaga atual já nasce expandida */
        uniNo.classList.add('arvore-grupo--aberto');
        var stAlvo = uniNo.querySelector('.arvore-seta');
        if (stAlvo) stAlvo.setAttribute('aria-expanded', 'true');
      }
      menu.appendChild(uniNo);
    });
    if (!algum) {
      var vazio = RosterWork.tpl('tpl-distribuicao-item');
      vazio.textContent = 'Nenhuma função livre';
      vazio.classList.add('dropdown-item--inativo');
      menu.appendChild(vazio);
    }
    return wrap;
  }
  function bloquear(cel) {
    cel.classList.remove('dropdown');
    cel.classList.add('distribuicao-cel--bloqueada');
    var g = cel.querySelector('.distribuicao-cel-gatilho');
    if (g) g.disabled = true;
  }

  /* ---------- papel especial (Oficial de Área / Chefe de Socorro) ---------- */
  var modalPapelCtx = null;
  function papelDaUnidade(unidade, tipo) {
    var achado = null;
    unidade.postos.forEach(function (p) { p.vagas.forEach(function (v) { if (v.papel_especial === tipo) achado = { posto: p, vaga: v }; }); });
    return achado;
  }
  function clicarPapel(unidade, posto, tipo, aqui) {
    if (aqui) { removerPapel(unidade, tipo); return; }   /* "Remover daqui" → tira o papel deste posto */
    abrirModalPapel(unidade, posto, tipo);               /* mover/colocar pede sempre confirmação */
  }
  function moverPapel(unidade, posto, tipo, trazerAcumulos) {
    registrar();
    var atual = papelDaUnidade(unidade, tipo);
    var secundarias = [];
    if (atual) {
      if (trazerAcumulos) secundarias = todasVagas().filter(function (v) { return v.acumuloTempId === atual.vaga.tempId; });
      else todasVagas().forEach(function (v) { if (v.acumuloTempId === atual.vaga.tempId) v.acumuloTempId = null; });
      atual.posto.vagas = atual.posto.vagas.filter(function (v) { return v !== atual.vaga; });
      rederivarPosto(atual.posto);
    }
    var nova = {
      tempId: 't' + (seq++), idSlot: null, chave: null,
      nome_funcao: tipo === 'oficial_area' ? 'Oficial de Área' : 'Chefe de Socorro',
      tipo_contador: tipo === 'oficial_area' ? 'Oficiais' : 'Pracas',
      base: null, ideal: null, ideal_calc: null, ordem: 1, ordemSentido: 'antigo', rodizio: false,
      papel_especial: tipo, slot_numero: null, acumuloIdSlot: null, acumuloTempId: null, acumuloOrdem: 0
    };
    posto.vagas.unshift(nova);   /* papel especial vai na 1ª posição */
    if (secundarias.length) reagruparAcumulo([nova].concat(secundarias));   /* nova vira principal das que vieram junto */
    rederivarPosto(posto);
    compactarUnidade(unidade);   /* especial ocupa o 1º mais antigo do pelotão; comuns recuam para 2,3… */
    renderizar();
  }
  function removerPapel(unidade, tipo) {
    registrar();
    var atual = papelDaUnidade(unidade, tipo);
    if (atual) {
      todasVagas().forEach(function (v) { if (v.acumuloTempId === atual.vaga.tempId) v.acumuloTempId = null; });
      atual.posto.vagas = atual.posto.vagas.filter(function (v) { return v !== atual.vaga; });
      rederivarPosto(atual.posto);
    }
    compactarUnidade(unidade);   /* liberou o 1º mais antigo do pelotão; comuns voltam a 1,2… */
    renderizar();
  }
  function abrirModalPapel(unidade, posto, tipo) {
    var atual = papelDaUnidade(unidade, tipo);
    var temAcumulos = !!(atual && todasVagas().some(function (v) { return v.acumuloTempId === atual.vaga.tempId; }));
    modalPapelCtx = { unidade: unidade, posto: posto, tipo: tipo, comAcumulos: temAcumulos };
    var nomePapel = tipo === 'oficial_area' ? 'Oficial de Área' : 'Chefe de Socorro';
    var origem = atual ? (atual.posto.nome || '') : null;
    var destino = posto.nome || '';
    var titulo = document.getElementById('distribuicao-papel-titulo');
    var msg = document.getElementById('distribuicao-papel-msg');
    var bl = document.getElementById('distribuicao-papel-limpo');
    var bok = document.getElementById('distribuicao-papel-confirmar');
    if (titulo) titulo.textContent = origem ? 'Mover ' + nomePapel : 'Colocar ' + nomePapel;
    if (msg) {
      if (origem && temAcumulos) msg.textContent = 'Mover o ' + nomePapel + ' de "' + origem + '" para "' + destino + '". Ele tem funções acumuladas. Quer levá-las junto?';
      else if (origem) msg.textContent = 'Mover o ' + nomePapel + ' de "' + origem + '" para "' + destino + '"?';
      else msg.textContent = 'Colocar o ' + nomePapel + ' em "' + destino + '"?';
    }
    if (bl) bl.classList.toggle('oculto', !temAcumulos);
    if (bok) bok.textContent = temAcumulos ? 'Levar junto' : (origem ? 'Mover' : 'Colocar');
    ligarModalPapel();
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-distribuicao-papel');
  }
  function ligarModalPapel() {
    var fechar = function () { if (RosterWork.fecharModais) RosterWork.fecharModais(); };
    var bc = document.getElementById('distribuicao-papel-cancelar');
    var bl = document.getElementById('distribuicao-papel-limpo');
    var bok = document.getElementById('distribuicao-papel-confirmar');
    if (bc) bc.onclick = fechar;
    if (bl) bl.onclick = function () { fechar(); moverPapel(modalPapelCtx.unidade, modalPapelCtx.posto, modalPapelCtx.tipo, false); };
    if (bok) bok.onclick = function () { fechar(); moverPapel(modalPapelCtx.unidade, modalPapelCtx.posto, modalPapelCtx.tipo, modalPapelCtx.comAcumulos); };
  }

  function textoAntiguidade(vg) {
    if (!vg.ordem) return '';
    return vg.ordem + 'º mais ' + (vg.ordemSentido === 'moderno' ? 'moderno' : 'antigo');
  }
  function textoGrau(vg) {
    if (!vg.ideal) return '';
    return vg.ideal + (vg.ideal_calc === '+' ? ' ou +' : vg.ideal_calc === '-' ? ' ou -' : '');
  }

  /* vaga "incompleta": principal, não papel especial, sem antiguidade e sem grau — o motor não teria
     critério para escolher quem senta (vira item no rodapé + linha em cor de erro) */
  function vagaIncompleta(vg) {
    return !vg.acumuloTempId && !vg.papel_especial && !vg.ordem && !vg.ideal;
  }

  function renderVaga(posto, vg) {
    var el = RosterWork.tpl('tpl-distribuicao-vaga-editar');
    el.classList.toggle('distribuicao-vaga--erro', vagaIncompleta(vg));
    el.querySelector('.distribuicao-vaga-num').textContent = vg._pv;
    var ehSecundaria = !!vg.acumuloTempId;

    /* funções = o grupo de acúmulo NA ORDEM (1ª = principal); própria cinza, acumuladas amarelas.
       Arrastar um chip reordena o grupo em TODAS as vagas; o 1º vira a principal. */
    var funcEl = el.querySelector('.distribuicao-vaga-func');
    var membros = grupoAcumulo(vg);
    var grupoId = membros[0].tempId;   /* âncora do grupo — realça o par no hover */
    membros.forEach(function (s) {
      /* item 14: a função NATIVA do posto desta linha fica só com o nome (sem X, sem ícone);
         as vindas de OUTRO posto — e, no acúmulo dentro do mesmo posto, a função adicionada —
         levam o X e o ÍCONE de acúmulo (marcam o que foi acumulado) */
      var nativa = posto.vagas.indexOf(s) >= 0;
      var excecaoMesmoPosto = !!s.acumuloTempId && postoDaVaga(s) === postoDaVaga(membros[0]);
      var deFora = !nativa || excecaoMesmoPosto;
      var temIcone = deFora;   /* ícone na função acumulada (a mesma que tem o X) */
      var aoRemover = deFora ? function () { desagruparVaga(s); } : null;
      var chipEl = chip(nomeExibir(posto, s) || '-', temIcone, null, aoRemover);
      chipEl.setAttribute('data-grupo', grupoId);
      if (membros.length > 1) { ligarArrastoChip(chipEl, s, funcEl); ligarRealceGrupo(chipEl, grupoId); }
      funcEl.appendChild(chipEl);
    });
    if (membros.length < 3) funcEl.appendChild(botaoAcumulo(membros[0]));   /* + Acúmulo em qualquer linha (entra no grupo) */

    var perfil = el.querySelector('.distribuicao-vaga-perfil');
    gatilho(perfil, vg.tipo_contador === 'Oficiais' ? 'Oficial' : 'Praça');
    if (ehSecundaria) bloquear(perfil); else menuPerfil(perfil.querySelector('.dropdown-menu'), vg);

    var antig = el.querySelector('.distribuicao-vaga-antig');
    gatilho(antig, textoAntiguidade(vg), !vg.ordem);
    /* papel especial fica fixo em "1º mais antigo" (não editável); acumulada também é bloqueada */
    if (ehSecundaria || vg.papel_especial) bloquear(antig); else menuAntiguidade(antig.querySelector('.dropdown-menu'), vg, function (s) { aplicarAntiguidade(vg, s); });

    /* grau só quando NÃO há antiguidade (são critérios alternativos); o valor de grau fica guardado mesmo oculto */
    var grau = el.querySelector('.distribuicao-vaga-grau');
    if (vg.ordem) {
      gatilho(grau, '', true);
      bloquear(grau);
    } else {
      gatilho(grau, textoGrau(vg), !vg.ideal);
      if (ehSecundaria) bloquear(grau); else menuGrau(grau.querySelector('.dropdown-menu'), vg, grau);
    }

    var rod = el.querySelector('.distribuicao-rod-toggle');
    rod.classList.toggle('distribuicao-rod-toggle--on', !!vg.rodizio);
    rod.querySelector('.icone').classList.toggle('oculto', !vg.rodizio);
    /* rodízio não se aplica quando a pessoa já é escolhida por antiguidade, nem em papel
       especial / vaga acumulada — desativa de vez (o CSS tira a mãozinha e apaga o campo) */
    if (ehSecundaria || vg.papel_especial || vg.ordem) rod.disabled = true;
    else rod.addEventListener('click', function () { mudar(vg, function () { vg.rodizio = !vg.rodizio; }); });

    var btnRemover = el.querySelector('.distribuicao-vaga-remover');
    if (condutorObrigatorio(posto, vg)) btnRemover.classList.add('oculto');   /* não deixa excluir o Condutor obrigatório */
    else btnRemover.addEventListener('click', function () { removerVaga(posto, vg); });
    return el;
  }

  function renderPosto(unidade, posto, postosStatus) {
    var el = RosterWork.tpl('tpl-distribuicao-posto');
    el.querySelector('.distribuicao-posto-numero').textContent = posto._num;
    el.querySelector('.distribuicao-posto-nome-texto').textContent = posto.nome || '';
    RosterWork.distribuicaoModelos.marcar(el, 'distribuicao-posto', postosStatus && postosStatus[posto.nome || '']);
    if (posto.tipo === 'viatura') {
      var uso = el.querySelector('.distribuicao-posto-icone use');
      if (uso) uso.setAttribute('href', 'icones/icone-viatura.svg#icone-viatura');
      el.querySelector('.distribuicao-posto-cnh').textContent = posto.cnh ? 'CNH ' + posto.cnh : '';
    }
    /* papel especial pelo menu no nome do posto: Oficial de Área (CIA/CIBM) ou Chefe de Socorro (PEL) */
    var tipoPapel = (unidade.tipo === 'CIA' || unidade.tipo === 'CIBM') ? 'oficial_area'
                  : (unidade.tipo === 'PEL' ? 'chefe_socorro' : null);
    if (tipoPapel) {
      var wrap = el.querySelector('.distribuicao-posto-nome-wrap');
      var menu = el.querySelector('.distribuicao-posto-menu');
      wrap.classList.add('dropdown');
      var aqui = posto.vagas.some(function (v) { return v.papel_especial === tipoPapel; });
      var nomePapel = tipoPapel === 'oficial_area' ? 'Oficial de Área' : 'Chefe de Socorro';
      menu.appendChild(item(aqui ? 'Remover ' + nomePapel + ' daqui' : 'Mover ' + nomePapel + ' aqui', false,
        function () { clicarPapel(unidade, posto, tipoPapel, aqui); }));
    }
    var linhas = el.querySelector('.distribuicao-vagas-linhas');
    posto.vagas.forEach(function (vg) {
      if (ehSecundariaMesmoPostoEm(posto, vg)) return;   /* Chefe/OA + Condutor da mesma viatura: uma linha só */
      linhas.appendChild(renderVaga(posto, vg));
    });
    var linhaNova = RosterWork.tpl('tpl-distribuicao-nova-funcao');
    linhaNova.querySelector('.distribuicao-nova-funcao').addEventListener('click', function () { novaVaga(posto); });
    el.querySelector('.distribuicao-posto-vagas').appendChild(linhaNova);
    return el;
  }

  /* ---------- "Vem de": reforço que ENTRA na unidade (militar de outra unidade concorre aqui) ----------
     Fica na unidade que RECEBE; a coluna mostra a ORIGEM (de onde o militar sai). Antiguidade = quem sai da origem. */
  function nomeUnidade(id) {
    for (var i = 0; i < estado.unidades.length; i++) if (estado.unidades[i].unidade_id === id) return estado.unidades[i].nome;
    return null;
  }
  /* militares que uma unidade ainda pode ENVIAR de reforço (composição − já enviados), por tipo;
     `exceto` = reforço a desconsiderar (o que está sendo mexido). */
  function disponiveisEnvio(unidadeId, exceto) {
    var of = 0, pc = 0;
    estado.unidades.forEach(function (u) { if (u.unidade_id === unidadeId) { of = u.oficiais || 0; pc = u.pracas || 0; } });
    estado.unidades.forEach(function (d) {
      (d.vemDe || []).forEach(function (r) {
        if (r === exceto || r.origemUnidadeId !== unidadeId) return;
        if (r.tipo_contador === 'Oficiais') of--; else pc--;
      });
    });
    return { of: of, pc: pc };
  }
  /* reforços que SAEM de uma origem (em qualquer destino) — tratados como "slots de saída" do pelotão */
  function reforcosDaOrigem(origemId) {
    var lista = [];
    estado.unidades.forEach(function (u) { (u.vemDe || []).forEach(function (r) { if (r.origemUnidadeId === origemId) lista.push(r); }); });
    return lista;
  }
  /* compacta a antiguidade dos reforços de uma origem (sem repetir): antigos 1,2,3… · modernos 1,2… — igual às vagas */
  function compactarReforcos(origemId) {
    if (origemId == null) return;
    var refs = reforcosDaOrigem(origemId);
    var antigos = refs.filter(function (r) { return ordemComSinal(r) > 0; }).sort(function (a, b) { return ordemComSinal(a) - ordemComSinal(b); });
    var modernos = refs.filter(function (r) { return ordemComSinal(r) < 0; }).sort(function (a, b) { return Math.abs(ordemComSinal(a)) - Math.abs(ordemComSinal(b)); });
    antigos.forEach(function (r, i) { definirOrdem(r, 1 + i); });
    modernos.forEach(function (r, i) { definirOrdem(r, -(1 + i)); });
  }
  /* aplica a antiguidade digitada num reforço: empurra os do mesmo sentido com nº ≥ e compacta (igual reordenarUnidade) */
  function reordenarReforcos(origemId, vdInsere, novoSinal) {
    if (novoSinal == null) { definirOrdem(vdInsere, null); compactarReforcos(origemId); return; }
    var neg = novoSinal < 0, abs = Math.abs(novoSinal);
    reforcosDaOrigem(origemId).forEach(function (r) {
      if (r === vdInsere) return;
      var n = ordemComSinal(r); if (n == null) return;
      var mesmoSentido = neg ? (n < 0) : (n > 0); if (!mesmoSentido) return;
      if (Math.abs(n) >= abs) definirOrdem(r, n < 0 ? n - 1 : n + 1);
    });
    definirOrdem(vdInsere, neg ? -abs : abs);
    compactarReforcos(origemId);
  }
  function menuOrigem(menu, destino, vd) {
    menu.textContent = '';
    estado.unidades.forEach(function (u) {
      if (u.unidade_id === destino.unidade_id) return;   /* a origem é sempre outra unidade */
      var d = disponiveisEnvio(u.unidade_id, vd);
      var temEfetivo = vd.tipo_contador === 'Oficiais' ? d.of > 0 : d.pc > 0;
      if (!temEfetivo && vd.origemUnidadeId !== u.unidade_id) return;   /* some da lista se não tem militar desse tipo pra enviar */
      menu.appendChild(item(u.nome, vd.origemUnidadeId === u.unidade_id, function () {
        mudar(vd, function () {
          var antiga = vd.origemUnidadeId;
          vd.origemUnidadeId = u.unidade_id;
          compactarReforcos(antiga); compactarReforcos(u.unidade_id);   /* reordena a antiguidade nas duas origens */
        });
      }));
    });
  }
  function novoVemDe(unidade) {
    /* nasce numa origem com militar disponível (praça por padrão; senão oficial); se ninguém tem, avisa e não cria */
    var origem = null, tipo = null, fallback = null;
    for (var i = 0; i < estado.unidades.length; i++) {
      var u = estado.unidades[i];
      if (u.unidade_id === unidade.unidade_id) continue;
      var d = disponiveisEnvio(u.unidade_id, null);
      if (d.pc > 0) { origem = u.unidade_id; tipo = 'Pracas'; break; }
      if (d.of > 0 && fallback == null) fallback = u.unidade_id;
    }
    if (origem == null && fallback != null) { origem = fallback; tipo = 'Oficiais'; }
    if (origem == null) { RosterWork.avisar({ tipo: 'aviso', mensagem: RosterWork.mensagens.distribuicao.reforcoSemOrigem }); return; }
    registrar();
    unidade.vemDe.push({
      tempId: 't' + (seq++), origemUnidadeId: origem,
      tipo_contador: tipo, ordem: null, ordemSentido: null, ideal: null, ideal_calc: null, rodizio: false   /* nasce sem critério (igual às vagas) */
    });
    renderizar();
  }
  function removerVemDe(unidade, vd) {
    registrar();
    var origem = vd.origemUnidadeId;
    unidade.vemDe = unidade.vemDe.filter(function (r) { return r !== vd; });
    compactarReforcos(origem);   /* a antiguidade se reordena sem o que saiu */
    renderizar();
  }
  function renderVemDeLinha(unidade, vd) {
    var el = RosterWork.tpl('tpl-distribuicao-reforco-linha');
    el.querySelector('.distribuicao-vaga-num').textContent = vd._pv;

    var origemCel = el.querySelector('.distribuicao-reforco-origem');
    var origemNome = nomeUnidade(vd.origemUnidadeId);
    origemCel.querySelector('.distribuicao-cel-texto').textContent = origemNome || '';
    origemCel.classList.toggle('distribuicao-cel--vazio', !origemNome);
    menuOrigem(origemCel.querySelector('.dropdown-menu'), unidade, vd);

    var perfil = el.querySelector('.distribuicao-vaga-perfil');
    gatilho(perfil, vd.tipo_contador === 'Oficiais' ? 'Oficial' : 'Praça');
    menuPerfil(perfil.querySelector('.dropdown-menu'), vd);

    var antig = el.querySelector('.distribuicao-vaga-antig');
    gatilho(antig, textoAntiguidade(vd), !vd.ordem);
    menuAntiguidade(antig.querySelector('.dropdown-menu'), vd, function (s) { mudar(vd, function () { reordenarReforcos(vd.origemUnidadeId, vd, s); }); });

    /* grau só quando NÃO há antiguidade (critérios alternativos de quem sai), igual às vagas */
    var grau = el.querySelector('.distribuicao-vaga-grau');
    if (vd.ordem) {
      gatilho(grau, '', true);
      bloquear(grau);
    } else {
      gatilho(grau, textoGrau(vd), !vd.ideal);
      menuGrau(grau.querySelector('.dropdown-menu'), vd);
    }

    var rod = el.querySelector('.distribuicao-rod-toggle');
    rod.classList.toggle('distribuicao-rod-toggle--on', !!vd.rodizio);
    rod.querySelector('.icone').classList.toggle('oculto', !vd.rodizio);
    rod.addEventListener('click', function () { mudar(vd, function () { vd.rodizio = !vd.rodizio; }); });

    el.querySelector('.distribuicao-vaga-remover').addEventListener('click', function () { removerVemDe(unidade, vd); });
    return el;
  }
  /* bloco "Vem de" da unidade (só quando há reforço; senão, botão discreto pra criar o 1º).
     Modelo de 1 unidade não tem de onde receber. */
  function renderVemDe(unidade, corpoSec) {
    if (estado.unidades.length < 2) return;
    var maisBtn;
    if (unidade.vemDe && unidade.vemDe.length) {
      var bloco = RosterWork.tpl('tpl-distribuicao-reforco-bloco');
      var linhas = bloco.querySelector('.distribuicao-vagas-linhas');
      unidade.vemDe.forEach(function (vd) { linhas.appendChild(renderVemDeLinha(unidade, vd)); });
      maisBtn = RosterWork.tpl('tpl-distribuicao-nova-reforco');
      maisBtn.querySelector('.distribuicao-nova-funcao').addEventListener('click', function () { novoVemDe(unidade); });
      bloco.querySelector('.distribuicao-posto-vagas').appendChild(maisBtn);
      corpoSec.appendChild(bloco);
    } else {
      maisBtn = RosterWork.tpl('tpl-distribuicao-nova-reforco');
      maisBtn.classList.add('distribuicao-nova-funcao-linha--solta');   /* solto: sem borda dupla com o posto acima */
      maisBtn.querySelector('.distribuicao-nova-funcao').addEventListener('click', function () { novoVemDe(unidade); });
      corpoSec.appendChild(maisBtn);
    }
  }

  function numerar() {
    var n = 0;
    estado.unidades.forEach(function (u) {
      u.postos.forEach(function (p) {
        n++; p._num = n;
        var v = 0;
        p.vagas.forEach(function (vg) {
          if (ehSecundariaMesmoPostoEm(p, vg)) { vg._pv = ''; return; }   /* linha mesclada: sem número próprio */
          v++; vg._pv = n + '.' + v;
        });
      });
      (u.vemDe || []).forEach(function (r, i) { r._pv = String(i + 1); });
    });
  }

  function renderizar() {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();   /* desliga os menus antes de recriar o DOM */
    var corpo = document.getElementById('distribuicao-corpo');
    if (!corpo) return;
    corpo.textContent = '';
    numerar();
    var contagem = unidadesComContagem();
    var status = RosterWork.distribuicaoModelos.statusVisual(contagem);   /* marcadores ao vivo */
    var contPorUnidade = {};
    contagem.forEach(function (c) { contPorUnidade[c.unidade_id] = c; });
    estado.unidades.forEach(function (u) {
      var sec = RosterWork.tpl('tpl-distribuicao-unidade');
      sec.querySelector('.distribuicao-unidade-nome').textContent = u.nome || '';
      var cab = sec.querySelector('.distribuicao-unidade-cabecalho');
      RosterWork.distribuicaoModelos.marcar(cab, 'distribuicao-unidade-cabecalho', status.unidades[u.unidade_id]);
      RosterWork.distribuicaoModelos.preencherContagem(cab, contPorUnidade[u.unidade_id]);
      cab.addEventListener('click', function () { cab.setAttribute('aria-expanded', cab.getAttribute('aria-expanded') === 'false' ? 'true' : 'false'); });
      var corpoSec = sec.querySelector('.distribuicao-unidade-corpo');
      var postosStatus = status.postos[u.unidade_id] || {};
      u.postos.forEach(function (p) { corpoSec.appendChild(renderPosto(u, p, postosStatus)); });
      renderVemDe(u, corpoSec);   /* bloco "Vem de" (ou o botão discreto pra criar o primeiro) */
      corpo.appendChild(sec);
    });
    atualizarRodape();
    /* status da lista da esquerda ao vivo (mesma regra do rodapé): só o modelo em edição */
    if (estado && estado.modeloId && RosterWork.distribuicaoModelos.atualizarStatusModelo)
      RosterWork.distribuicaoModelos.atualizarStatusModelo(estado.modeloId, unidadesComContagem());
  }

  /* ---------- rodapé ---------- */
  var rodapeEl = null;
  function montarRodape() {
    var rod = document.getElementById('distribuicao-rodape');
    rod.textContent = '';
    rodapeEl = RosterWork.tpl('tpl-distribuicao-rodape-edicao');
    rod.appendChild(rodapeEl);
    rodapeEl.querySelector('.distribuicao-cancelar').addEventListener('click', cancelar);
    rodapeEl.querySelector('.distribuicao-salvar').addEventListener('click', salvar);
    var resumo = rodapeEl.querySelector('.distribuicao-status-resumo');
    resumo.addEventListener('click', function () {
      if (resumo.classList.contains('distribuicao-status-resumo--unico')) return;
      resumo.setAttribute('aria-expanded', resumo.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      atualizarRodape();
    });
  }
  /* o modelo em edição é um RASCUNHO (recém-criado, ainda não confirmado com Salvar)? */
  function ehRascunho() {
    return !!(estado && RosterWork.distribuicaoModelos.rascunhoId && RosterWork.distribuicaoModelos.rascunhoId() === estado.modeloId);
  }
  function atualizarRodape() {
    atualizarHistorico();
    if (!rodapeEl) return;
    /* rascunho nasce com o Salvar HABILITADO (é o Salvar que confirma o modelo novo), mesmo sem edição */
    rodapeEl.querySelector('.distribuicao-salvar').disabled = !sujo && !ehRascunho();
    var st = RosterWork.distribuicaoModelos.validar(unidadesComContagem());
    var itens = st.itens.length ? st.itens
      : [{ nivel: 'ok', texto: RosterWork.mensagens.distribuicao.tudoCerto(listarNomes(grupo.unidades.map(function (u) { return u.nome; }))) }];
    var nivel = RosterWork.distribuicaoModelos.nivelStatus(itens);
    var unico = itens.length <= 1;
    var resumo = rodapeEl.querySelector('.distribuicao-status-resumo');
    resumo.classList.remove('distribuicao-status-resumo--ok', 'distribuicao-status-resumo--alerta', 'distribuicao-status-resumo--erro', 'distribuicao-status-resumo--unico');
    resumo.classList.add('distribuicao-status-resumo--' + nivel);
    if (unico) { resumo.classList.add('distribuicao-status-resumo--unico'); resumo.setAttribute('aria-expanded', 'false'); }
    resumo.querySelector('.distribuicao-status-resumo-texto').textContent = unico ? (itens[0] ? itens[0].texto : '') : (itens.length + ' problemas');
    /* lista expandida acima do rodapé (só com 2+ erros e aberto) */
    var rod = document.getElementById('distribuicao-rodape');
    var antiga = rod.querySelector('.distribuicao-status-lista');
    if (antiga) antiga.remove();
    if (!unico && resumo.getAttribute('aria-expanded') === 'true') {
      var lista = RosterWork.tpl('tpl-distribuicao-status-lista');
      itens.forEach(function (it) { lista.appendChild(RosterWork.distribuicaoModelos.montarItemStatus(it)); });
      rod.insertBefore(lista, rodapeEl);
    }
  }
  function listarNomes(nomes) {
    if (nomes.length <= 1) return nomes.join('');
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  }

  /* contagem para o validar — MESMA função usada no modo Ver (sincroniza os erros) */
  function unidadesComContagem() {
    var comp = {};
    estado.unidades.forEach(function (u) { comp[u.unidade_id] = { oficiais: u.oficiais, pracas: u.pracas }; });
    return RosterWork.distribuicaoModelos.contarUnidades(estado.unidades, comp);
  }

  /* ---------- salvar / cancelar ---------- */
  function salvar() {
    if (RosterWork.distribuicaoSalvar) RosterWork.distribuicaoSalvar.salvar(estado, unidadesComContagem());
  }
  /* confirma o descarte de edição não salva antes de abandonar (trocar de modelo, de página, etc.);
     sem alteração, segue direto. Ao confirmar, marca limpo para o aoSair não re-perguntar. */
  function confirmarSaida(aoSair) {
    /* rascunho também conta como "alteração pendente" (o modelo novo some se sair sem Salvar) */
    if (!sujo && !ehRascunho()) { aoSair(); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.distribuicao.descartar,
      textoConfirmar: RosterWork.mensagens.botoes.descartar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { sujo = false; aoSair(); }
    });
  }
  /* descarta o estado de edição sem perguntar — usado quando a lista recarrega (já passou pela confirmação) */
  function descartar() { sujo = false; pilhaUndo = []; pilhaRedo = []; mostrarHistorico(false); }

  function cancelar() {
    /* cancelar um modelo RASCUNHO (recém-criado, nunca salvo) o exclui; um modelo já salvo só recarrega */
    var souRascunho = ehRascunho();
    confirmarSaida(function () {
      if (souRascunho) RosterWork.distribuicaoModelos.excluirRascunho().then(function () { RosterWork.distribuicaoModelos.recarregarLista(); });
      else RosterWork.distribuicaoModelos.recarregar();
    });
  }

  /* ---------- API ---------- */
  function abrir(g, modelo, dados) {
    grupo = g; composicao = modelo;
    pilhaUndo = []; pilhaRedo = []; sujo = false;
    return RosterWork.distribuicaoDados.buscarGraus().then(function (lista) {
      graus = lista || [];
      estado = construir(dados, modelo);
      estado.unidades.forEach(compactarUnidade);   /* normaliza a antiguidade do pelotão (sem buracos, especial = 1º) ao abrir */
      montarRodape();
      renderizar();
      mostrarHistorico(true);
    });
  }

  window.RosterWork.distribuicaoEditar = {
    abrir: abrir,
    estaSujo: function () { return sujo; },
    confirmarSaida: confirmarSaida,
    descartar: descartar,
    mostrarHistorico: mostrarHistorico,
    limpoAposSalvar: function () { RosterWork.distribuicaoModelos.limparRascunho(); sujo = false; pilhaUndo = []; pilhaRedo = []; atualizarRodape(); }
  };
})();
