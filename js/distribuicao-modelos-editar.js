/* ============================================================
   DISTRIBUIÇÃO — edição de um modelo
   Estado mutável das vagas do modelo selecionado + renderizar editável
   (perfil, antiguidade, grau ideal e rodízio por clique na célula),
   "Nova função" / remover vaga, Desfazer/Refazer e o rodapé de ações.
   A FUNÇÃO é derivada da posição (não se escolhe). Só admin.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var composicao = null;   /* a unidade do modelo (of/pç), de dist_listar_modelos */
  var estado = null;       /* { modeloId, unidades:[{unidade_id, nome, tipo, chave, postos:[{...vagas}]}] } — uma unidade */
  var graus = [];
  var seq = 0;
  var seqMenu = 0;
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
          efetivo_minimo: p.efetivo_minimo, efetivo_maximo: p.efetivo_maximo,
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
        postos: postos
      };
    });
    /* a chave de cada vaga; resolve acúmulo idSlot→tempId */
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
    var cfg = principalDe(vg);
    [['Pracas', 'Praça'], ['Oficiais', 'Oficial']].forEach(function (o) {
      menu.appendChild(item(o[1], cfg.tipo_contador === o[0], function () { mudarGrupo(vg, function (p) { p.tipo_contador = o[0]; if (p.ideal) { p.ideal = null; p.ideal_calc = null; } }); }));
    });
  }
  /* ---------- antiguidade: numeração sem buracos + auto-reordenação POR UNIDADE/PELOTÃO ----------
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
  /* a antiguidade é de quem senta: cada grupo de acúmulo conta uma vez só (pela principal) */
  function principaisDaUnidade(unidade) {
    return vagasDaUnidade(unidade).filter(function (v) { return !v.acumuloTempId; });
  }
  /* compacta a numeração de UMA unidade/pelotão: papel especial = 1º mais antigo; comuns antigos seguem 2,3…; modernos 1,2… (sem buracos) */
  function compactarUnidade(unidade) {
    if (!unidade) return;
    var vagas = principaisDaUnidade(unidade);
    var temEspecial = vagas.some(function (v) { return v.papel_especial; });
    vagas.forEach(function (v) { if (v.papel_especial) { v.ordem = 1; v.ordemSentido = 'antigo'; } });
    var antigos = vagas.filter(function (v) { return !v.papel_especial && ordemComSinal(v) > 0; })
                       .sort(function (a, b) { return ordemComSinal(a) - ordemComSinal(b); });
    var modernos = vagas.filter(function (v) { return !v.papel_especial && ordemComSinal(v) < 0; })
                        .sort(function (a, b) { return Math.abs(ordemComSinal(a)) - Math.abs(ordemComSinal(b)); });
    var inicioAntigo = temEspecial ? 2 : 1;
    antigos.forEach(function (v, i) { definirOrdem(v, inicioAntigo + i); });
    modernos.forEach(function (v, i) { definirOrdem(v, -(1 + i)); });
    vagas.forEach(sincronizarGrupo);   /* as acumuladas acompanham a principal */
  }
  /* aplica a antiguidade digitada numa unidade/pelotão: empurra os do mesmo sentido com nº ≥ e compacta */
  function reordenarUnidade(unidade, vgInsere, novoSinal) {
    if (novoSinal == null) { definirOrdem(vgInsere, null); compactarUnidade(unidade); return; }
    var vagas = principaisDaUnidade(unidade);
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
    var p = principalDe(vg);   /* vale para o grupo de acúmulo inteiro */
    var u = unidadeDaVaga(p);
    if (u) reordenarUnidade(u, p, sinal); else { definirOrdem(p, sinal); sincronizarGrupo(p); }
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
    var nome = 'antig-' + (++seqMenu);   /* nome próprio por menu: linhas do mesmo grupo editam o mesmo alvo */
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
      var ehOf = (g.tipo === 'Oficial' || g.tipo === 'Oficial Especialista');
      return oficiais ? ehOf : !ehOf;
    });
  }
  /* menu de grau: só "ou +" / "ou −". O grau nasce SEM sentido e a lista de
     graus só habilita depois de escolher o sentido; a lista segue o sentido (Sd.→Sub.Ten. para "+",
     Sub.Ten.→Sd. para "−"). Trocar o sentido atualiza o campo NA HORA, sem fechar o menu. */
  function menuGrau(rolagem, linhaVg) {
    rolagem.textContent = '';
    var vg = principalDe(linhaVg);   /* o grau é do grupo de acúmulo inteiro */
    var ctrl = RosterWork.tpl('tpl-distribuicao-grau-menu');
    var nome = 'grau-' + linhaVg.tempId;
    var rMais = ctrl.querySelector('[data-calc="antigo"]');    /* igual ou mais antigo = '+' */
    var rMenos = ctrl.querySelector('[data-calc="moderno"]');  /* igual ou mais moderno = '-' */
    rMais.name = nome; rMenos.name = nome;
    var lista = ctrl.querySelector('.distribuicao-grau-lista');
    var dica = ctrl.querySelector('.distribuicao-grau-dica');

    if (vg.ideal_calc === '+') rMais.checked = true;
    else if (vg.ideal_calc === '-') rMenos.checked = true;   /* sem sentido = nenhum marcado */

    function sentido() { return rMenos.checked ? '-' : (rMais.checked ? '+' : null); }

    /* grava ideal/calc SEM re-renderizar (o menu fica aberto): atualiza a célula de grau e a cor de
       erro de todas as linhas do grupo, e o rodapé */
    function aplicar(ideal, calc) {
      registrar();
      vg.ideal = ideal; vg.ideal_calc = calc;
      sincronizarGrupo(vg);
      var corpo = document.getElementById('distribuicao-corpo');
      grupoAcumulo(vg).forEach(function (m) {
        var linha = corpo && corpo.querySelector('.distribuicao-vaga[data-tempid="' + m.tempId + '"]');
        if (!linha) return;   /* o Condutor mesclado na linha do papel não tem linha própria */
        gatilho(linha.querySelector('.distribuicao-vaga-grau'), textoGrau(vg), !vg.ideal);
        linha.classList.toggle('distribuicao-vaga--erro', vagaIncompleta(m));
      });
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
  /* mudança de configuração (tipo, grau, rodízio): feita na principal e copiada para o grupo inteiro */
  function mudarGrupo(vg, fn) {
    mudar(vg, function () { var p = principalDe(vg); fn(p); sincronizarGrupo(p); });
  }

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
    var resto = grupoAcumulo(vg).filter(function (v) { return v !== vg; });
    posto.vagas = posto.vagas.filter(function (v) { return v !== vg; });
    /* saiu o papel especial: cada função volta com a configuração que tinha antes de entrar no grupo;
       saiu outra: as demais continuam acumuladas entre si */
    if (vg.papel_especial) resto.forEach(function (v) { v.acumuloTempId = null; v.acumuloOrdem = 0; });
    else if (resto.length) reagruparAcumulo(resto);
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
  /* a configuração (tipo, antiguidade, grau, rodízio) é do GRUPO de acúmulo, porque é uma pessoa só.
     Ela mora na principal: no grupo comum, as outras funções guardam uma cópia igual; no grupo do
     Chefe de Socorro / Oficial de Área, vale a do papel e as outras guardam a própria (que volta
     quando saem do grupo). Qual função é a principal não aparece na tela (o banco põe o Condutor). */
  var CAMPOS_CONFIG = ['tipo_contador', 'ordem', 'ordemSentido', 'ideal', 'ideal_calc', 'rodizio'];
  function principalDe(vg) { return vg.acumuloTempId ? (acharVaga(vg.acumuloTempId) || vg) : vg; }
  function sincronizarGrupo(principal) {
    if (principal.papel_especial) return;
    todasVagas().forEach(function (v) {
      if (v.acumuloTempId === principal.tempId) CAMPOS_CONFIG.forEach(function (c) { v[c] = principal[c]; });
    });
  }
  function temCriterio(vg) { return !!(vg.ordem || vg.ideal); }
  /* grupo de acúmulo, NA ORDEM de entrada (acumuloOrdem). Mesma ordem em toda vaga do grupo. */
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
     exceção à regra "acúmulo só entre postos diferentes" */
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
  /* postos não podem repetir dentro de um grupo, salvo a exceção papel de viatura + Condutor do mesmo posto
     (o papel, se houver, é a âncora do grupo, em qualquer posição) */
  function postosDoGrupoValidos(membros) {
    var anchor = membros.filter(ehPapelViatura)[0] || membros[0], postoAnchor = postoDaVaga(anchor);
    var ordem = [anchor].concat(membros.filter(function (m) { return m !== anchor; }));
    var vistos = [];
    for (var i = 0; i < ordem.length; i++) {
      var p = postoDaVaga(ordem[i]);
      if (vistos.indexOf(p) >= 0) {
        if (!(ehPapelViatura(anchor) && p === postoAnchor && ehCondutor(ordem[i]))) return false;
      } else { vistos.push(p); }
    }
    return true;
  }
  /* v pode entrar no grupo de `membros`? (postos diferentes; mesclar grupos, teto 3) */
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
  /* acumular: junta o grupo da linha (onde se clicou em Acúmulo) com o da função escolhida na lista.
     Vale a configuração de quem já tem; o outro lado copia e vai para o fim. Os dois com configuração:
     vale a do grupo maior (empate: a da função escolhida). O grupo do Chefe de Socorro / Oficial de
     Área sempre manda e o papel fica em 1º; quem entra nele guarda a própria configuração. */
  function juntarAcumulo(linhaVg, escolhida) {
    mudar(escolhida, function () {
      var daLinha = grupoAcumulo(linhaVg), daEscolhida = grupoAcumulo(escolhida);
      var pLinha = principalDe(linhaVg), pEscolhida = principalDe(escolhida);
      var ficaLinha;
      if (pLinha.papel_especial || pEscolhida.papel_especial) ficaLinha = !!pLinha.papel_especial;
      else if (temCriterio(pLinha) !== temCriterio(pEscolhida)) ficaLinha = temCriterio(pLinha);
      else if (temCriterio(pLinha) && daLinha.length !== daEscolhida.length) ficaLinha = daLinha.length > daEscolhida.length;
      else ficaLinha = false;
      var fica = ficaLinha ? daLinha : daEscolhida;
      var entra = ficaLinha ? daEscolhida : daLinha;
      reagruparAcumulo(fica.concat(entra));
      sincronizarGrupo(fica[0]);
      compactarUnidade(unidadeDaVaga(fica[0]));   /* o número de antiguidade de quem entrou fica livre */
    });
  }
  /* tira uma função do grupo (pelo X); vale para qualquer membro (se era a principal, a próxima
     assume). Do grupo comum ela sai com a cópia da configuração, e a antiguidade fica no número
     seguinte ao do grupo; do grupo do papel, volta com a configuração que tinha antes de entrar. */
  function desagruparVaga(s) {
    mudar(s, function () {
      var doPapel = !!principalDe(s).papel_especial;
      var resto = grupoAcumulo(s).filter(function (x) { return x !== s; });
      s.acumuloTempId = null;
      s.acumuloOrdem = 0;
      if (resto.length) reagruparAcumulo(resto);
      var u = unidadeDaVaga(s);
      var n = ordemComSinal(s);
      if (u && n != null) reordenarUnidade(u, s, doPapel ? n : n + (n > 0 ? 1 : -1));
      else compactarUnidade(u);
    });
  }
  /* passar o mouse num chip acende TODOS do mesmo grupo, em qualquer linha */
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
  /* ---------- escada de acúmulo: Posto → Função (só da unidade do modelo) ---------- */
  /* um nó (posto): a linha inteira expande/recolhe em sanfona */
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
      folha.querySelector('.distribuicao-escada-icone').classList.remove('oculto');   /* já em outro grupo */
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
    var unidade = unidadeDaVaga(vg);   /* o acúmulo é só entre postos da própria unidade */
    var algum = false;
    ((unidade && unidade.postos) || []).forEach(function (p) {
      var funcoes = p.vagas.filter(function (v) { return elegivelParaGrupo(membros, v); });
      if (!funcoes.length) return;
      algum = true;
      var postoNo = escadaNo(p.nome || '');
      var filhos = postoNo.querySelector('.arvore-filhos');
      funcoes.forEach(function (v) {
        var grupoV = grupoAcumulo(v);
        filhos.appendChild(escadaFolha(v.nome_funcao || '', grupoV.length > 1, grupoV[0].tempId, menu, function () {
          juntarAcumulo(vg, v);
        }));
      });
      menu.appendChild(postoNo);
    });
    if (!algum) {
      var vazio = RosterWork.tpl('tpl-distribuicao-item');
      vazio.textContent = RosterWork.mensagens.distribuicao.nenhumaFuncaoLivre;
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
  function nomeDoPapel(tipo) { return tipo === 'oficial_area' ? 'Oficial de Área' : 'Chefe de Socorro'; }
  /* funções que o papel acumula em OUTRO posto (o Condutor da própria viatura não conta: nunca vai junto) */
  function acumulosDeFora(atual) {
    return todasVagas().filter(function (v) { return v.acumuloTempId === atual.vaga.tempId && postoDaVaga(v) !== atual.posto; });
  }
  /* o ícone do papel num posto: com acúmulos de outro posto, o modal pergunta se vão junto; sem, move direto */
  function clicarPapel(unidade, posto, tipo) {
    var atual = papelDaUnidade(unidade, tipo);
    if (atual && acumulosDeFora(atual).length) abrirModalPapel(unidade, posto, tipo, atual);
    else moverPapel(unidade, posto, tipo, false);
  }
  function moverPapel(unidade, posto, tipo, trazerAcumulos) {
    registrar();
    var atual = papelDaUnidade(unidade, tipo);
    var levar = [];
    if (atual) {
      grupoAcumulo(atual.vaga).forEach(function (v) {
        if (v === atual.vaga) return;
        /* vão junto (se o admin escolheu) as de outro posto; no posto de destino, só o Condutor dele.
           As demais, e o Condutor da viatura de onde o papel sai, voltam com a configuração que tinham */
        var vaiJunto = trazerAcumulos && postoDaVaga(v) !== atual.posto && (postoDaVaga(v) !== posto || ehCondutor(v));
        if (vaiJunto) levar.push(v);
        else { v.acumuloTempId = null; v.acumuloOrdem = 0; }
      });
      atual.posto.vagas = atual.posto.vagas.filter(function (v) { return v !== atual.vaga; });
      rederivarPosto(atual.posto);
    }
    var nova = {
      tempId: 't' + (seq++), idSlot: null, chave: null,
      nome_funcao: nomeDoPapel(tipo),
      tipo_contador: tipo === 'oficial_area' ? 'Oficiais' : 'Pracas',
      base: null, ideal: null, ideal_calc: null, ordem: 1, ordemSentido: 'antigo', rodizio: false,
      papel_especial: tipo, slot_numero: null, acumuloIdSlot: null, acumuloTempId: null, acumuloOrdem: 0
    };
    posto.vagas.unshift(nova);   /* papel especial vai na 1ª posição */
    if (levar.length) reagruparAcumulo([nova].concat(levar));   /* nova vira principal das que vieram junto */
    rederivarPosto(posto);
    compactarUnidade(unidade);   /* especial ocupa o 1º mais antigo do pelotão; comuns recuam para 2,3… */
    renderizar();
  }
  function abrirModalPapel(unidade, posto, tipo, atual) {
    var M = RosterWork.mensagens.distribuicao;
    var nomePapel = nomeDoPapel(tipo);
    modalPapelCtx = { unidade: unidade, posto: posto, tipo: tipo };
    document.getElementById('distribuicao-papel-titulo').textContent = M.moverPapelTitulo(nomePapel);
    document.getElementById('distribuicao-papel-msg').textContent = M.moverPapelAcumulos(nomePapel, atual.posto.nome || '', posto.nome || '');
    ligarModalPapel();
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-distribuicao-papel');
  }
  function ligarModalPapel() {
    var fechar = function () { if (RosterWork.fecharModais) RosterWork.fecharModais(); };
    document.getElementById('distribuicao-papel-cancelar').onclick = fechar;
    document.getElementById('distribuicao-papel-limpo').onclick = function () { fechar(); moverPapel(modalPapelCtx.unidade, modalPapelCtx.posto, modalPapelCtx.tipo, false); };
    document.getElementById('distribuicao-papel-confirmar').onclick = function () { fechar(); moverPapel(modalPapelCtx.unidade, modalPapelCtx.posto, modalPapelCtx.tipo, true); };
  }

  function textoAntiguidade(vg) {
    if (!vg.ordem) return '';
    return vg.ordem + 'º mais ' + (vg.ordemSentido === 'moderno' ? 'moderno' : 'antigo');
  }
  function textoGrau(vg) {
    if (!vg.ideal) return '';
    return vg.ideal + (vg.ideal_calc === '+' ? ' ou +' : vg.ideal_calc === '-' ? ' ou -' : '');
  }

  /* vaga "incompleta": o grupo dela (não papel especial) não tem antiguidade nem grau — o motor não
     teria critério para escolher quem senta (vira item no rodapé + campos em cor de erro, em todas as
     linhas do grupo) */
  function vagaIncompleta(vg) {
    var p = principalDe(vg);
    return !p.papel_especial && !temCriterio(p);
  }

  function renderVaga(posto, vg) {
    var el = RosterWork.tpl('tpl-distribuicao-vaga-editar');
    el.setAttribute('data-tempid', vg.tempId);
    el.classList.toggle('distribuicao-vaga--erro', vagaIncompleta(vg));
    el.querySelector('.distribuicao-vaga-num').textContent = vg._pv;
    /* a linha mostra a configuração do GRUPO (a da principal). Edita-se em qualquer linha do grupo
       comum; no grupo do papel especial, as funções acumuladas mostram a do papel, travada */
    var cfg = principalDe(vg);
    var travada = !!vg.acumuloTempId && !!cfg.papel_especial;

    /* funções = o grupo de acúmulo na ordem de entrada */
    var funcEl = el.querySelector('.distribuicao-vaga-func');
    var membros = grupoAcumulo(vg);
    var grupoId = membros[0].tempId;   /* âncora do grupo — realça o par no hover */
    membros.forEach(function (s) {
      /* a função desta linha fica só com o nome (sem X, sem ícone); as outras do grupo — as de
         OUTRO posto e, no acúmulo dentro do mesmo posto, o Condutor mesclado na linha do papel —
         levam o X e o ÍCONE de acúmulo (marcam o que foi acumulado). O X no papel especial tira
         do grupo a função desta linha (o papel é o dono do grupo) */
      var deFora = s !== vg;
      var aoRemover = deFora ? function () { desagruparVaga(s.papel_especial ? vg : s); } : null;
      var chipEl = chip(nomeExibir(posto, s) || '-', deFora, null, aoRemover);
      chipEl.setAttribute('data-grupo', grupoId);
      if (membros.length > 1) ligarRealceGrupo(chipEl, grupoId);
      funcEl.appendChild(chipEl);
    });
    if (membros.length < 3) funcEl.appendChild(botaoAcumulo(vg));   /* Acúmulo em qualquer linha (entra no grupo) */

    var perfil = el.querySelector('.distribuicao-vaga-perfil');
    gatilho(perfil, cfg.tipo_contador === 'Oficiais' ? 'Oficial' : 'Praça');
    if (travada) bloquear(perfil); else menuPerfil(perfil.querySelector('.dropdown-menu'), vg);

    var antig = el.querySelector('.distribuicao-vaga-antig');
    gatilho(antig, textoAntiguidade(cfg), !cfg.ordem);
    /* papel especial fica fixo em "1º mais antigo" (não editável), e as funções acumuladas nele também */
    if (travada || vg.papel_especial) bloquear(antig); else menuAntiguidade(antig.querySelector('.dropdown-menu'), cfg, function (s) { aplicarAntiguidade(vg, s); });

    /* grau só quando NÃO há antiguidade (são critérios alternativos); o valor de grau fica guardado mesmo oculto */
    var grau = el.querySelector('.distribuicao-vaga-grau');
    if (cfg.ordem) {
      gatilho(grau, '', true);
      bloquear(grau);
    } else {
      gatilho(grau, textoGrau(cfg), !cfg.ideal);
      if (travada) bloquear(grau); else menuGrau(grau.querySelector('.dropdown-menu'), vg);
    }

    var rod = el.querySelector('.distribuicao-rod-toggle');
    rod.classList.toggle('distribuicao-rod-toggle--on', !!cfg.rodizio);
    rod.querySelector('.icone').classList.toggle('oculto', !cfg.rodizio);
    /* rodízio não se aplica quando a pessoa já é escolhida por antiguidade, nem no papel especial
       (e nas funções acumuladas nele) — desativa de vez (o CSS tira a mãozinha e apaga o campo) */
    if (travada || vg.papel_especial || cfg.ordem) rod.disabled = true;
    else rod.addEventListener('click', function () { mudarGrupo(vg, function (p) { p.rodizio = !p.rodizio; }); });

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
    /* efetivo máximo: com o posto cheio, não cabe mais ninguém (nem nova função, nem o papel especial) */
    var cheio = posto.efetivo_maximo != null && RosterWork.distribuicaoModelos.pessoasDoPosto(posto) >= posto.efetivo_maximo;
    var dicaCheio = RosterWork.mensagens.geral.efetivoMaximo.replace('{n}', posto.efetivo_maximo);
    /* papel especial embaixo da CNH: Oficial de Área (CIA/CIBM) ou Chefe de Socorro (PEL). Selo aceso
       no posto onde ele está; nos outros, o selo "Mover …" que o traz para cá */
    var tipoPapel = (unidade.tipo === 'CIA' || unidade.tipo === 'CIBM') ? 'oficial_area'
                  : (unidade.tipo === 'PEL' ? 'chefe_socorro' : null);
    if (tipoPapel) {
      var aqui = posto.vagas.some(function (v) { return v.papel_especial === tipoPapel; });
      var seloPapel = el.querySelector(aqui ? '.distribuicao-posto-papel' : '.distribuicao-posto-papel-acao');
      seloPapel.querySelector('.distribuicao-posto-papel-nome').textContent = nomeDoPapel(tipoPapel);
      seloPapel.classList.remove('oculto');
      if (!aqui) {
        var mover = seloPapel.querySelector('.distribuicao-posto-papel-mover');
        if (cheio) { mover.disabled = true; seloPapel.setAttribute('data-dica', dicaCheio); }
        else mover.addEventListener('click', function () { clicarPapel(unidade, posto, tipoPapel); });
      }
    }
    var linhas = el.querySelector('.distribuicao-vagas-linhas');
    posto.vagas.forEach(function (vg) {
      if (ehSecundariaMesmoPostoEm(posto, vg)) return;   /* Chefe/OA + Condutor da mesma viatura: uma linha só */
      linhas.appendChild(renderVaga(posto, vg));
    });
    var linhaNova = RosterWork.tpl('tpl-distribuicao-nova-funcao');
    var botaoNova = linhaNova.querySelector('.distribuicao-nova-funcao');
    /* com o posto cheio, a dica fica na linha e o botão desativado */
    if (cheio) {
      botaoNova.disabled = true;
      linhaNova.setAttribute('data-dica', dicaCheio);
    } else {
      botaoNova.addEventListener('click', function () { novaVaga(posto); });
    }
    el.querySelector('.distribuicao-posto-vagas').appendChild(linhaNova);
    return el;
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
    /* rascunho nasce com o Salvar HABILITADO (é o Salvar que confirma o modelo novo), mesmo sem edição;
       período "a revisar" também: salvar sem mudança é o que marca a cópia como revisada */
    rodapeEl.querySelector('.distribuicao-salvar').disabled = !sujo && !ehRascunho() && !(composicao && composicao.a_revisar);
    var st = RosterWork.distribuicaoModelos.validar(unidadesComContagem());
    var itens = st.itens.length ? st.itens
      : [{ nivel: 'ok', texto: RosterWork.mensagens.distribuicao.tudoCerto((estado.unidades[0] && estado.unidades[0].nome) || '') }];
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
  /* confirma o descarte de edição não salva antes de abandonar (trocar de modelo, de unidade, de página, etc.);
     sem alteração, segue direto. Ao confirmar, marca limpo para o aoSair não re-perguntar.
     aoCancelar (opcional) roda quando a pessoa continua editando. levarRascunho: o modelo novo acompanha a
     saída (troca para um período editável), então só as alterações são descartadas. */
  function confirmarSaida(aoSair, aoCancelar, levarRascunho) {
    var rascunho = ehRascunho();
    /* rascunho também conta como "alteração pendente" (o modelo novo some se sair sem Salvar) */
    if (!sujo && (!rascunho || levarRascunho)) { aoSair(); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.distribuicao.descartar,
      textoConfirmar: RosterWork.mensagens.botoes.descartar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: function () {
        sujo = false;
        if (!rascunho || levarRascunho) { aoSair(); return; }
        /* o modelo novo descartado é excluído na hora e sai da lista */
        descartar();
        RosterWork.distribuicaoModelos.descartarRascunho().then(aoSair);
      },
      aoCancelar: aoCancelar
    });
  }
  /* descarta o estado de edição sem perguntar — usado quando a lista recarrega (já passou pela confirmação) */
  function descartar() { sujo = false; pilhaUndo = []; pilhaRedo = []; mostrarHistorico(false); }

  function cancelar() {
    /* cancelar um modelo RASCUNHO (recém-criado, nunca salvo) o exclui (no confirmarSaida); um modelo já salvo só recarrega */
    var souRascunho = ehRascunho();
    confirmarSaida(function () {
      if (!souRascunho) RosterWork.distribuicaoModelos.recarregar();
    });
  }

  /* ---------- API ---------- */
  function abrir(modelo, dados) {
    composicao = modelo;
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
