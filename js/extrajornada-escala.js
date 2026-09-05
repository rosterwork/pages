/* ============================================================
   EXTRAJORNADA — aba Escala (organização da extra do mês, admin)
   Reusa a grade compartilhada do Mês (escalas-mes.js, opção
   soCobertura = só as barras, sem a lista de serviço): dias × unidades
   do grupo, cada célula com a cobertura real (antes) + a cobertura
   depois-dos-extras. A colocação é NA CÉLULA: seções de candidatos
   (Interessados / Outros / Não querem, dos candidatos pré-carregados na
   grade, sem chamada ao banco por clique) e o militar escolhido vira uma
   vaga (nome em cima, pelotão + bolinhas embaixo, com X) na própria célula.
   RosterWork.extrajornadaEscala.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var conteudo = null;
  var el = {};
  var comp = null;       // Date do 1º dia do mês
  var unidades = [];     // colunas da grade [{id,nome,cidade}]
  var celulas = {};      // extras SALVOS por unidade×dia { uid: { iso: [ {cpf,grad,nome,blocos,cnh,grau_ant,...} ] } }
  var avisos = {};       // avisos da escala resolvíveis por extra, por unidade×dia { uid: { iso: [ {tipo,onde,necessita,ideal_ant,ideal_nome,sentido} ] } }
  var candidatos = {};   // voluntários por DIA (pré-carregados) { iso: [ {cpf,grad,nome,pref,cota,colocado,fecha24,cnh,grau_ant,bloqueado,unidade_id,unidade_nome} ] }
  var escopo = 'grupo';  // escopo das cotas do mês: 'grupo' (deslocamento, candidatos agrupados por unidade) | 'por_unidade' (só a unidade da célula)
  var pendentes = {};    // extras ESCOLHIDOS mas ainda sem bloco { 'uid|iso': [ {cpf,grad,nome} ] }
  var carregado = false;
  var cargaSeq = 0;          // token de requisição da grade: ignora resposta antiga ao trocar de mês/escopo rápido
  var coberturas = {};       // cobertura (info) de cada célula visível, p/ repintar só os indicadores { 'uid|iso': info }
  var ensaio = {};           // estado pós-motor por célula { 'uid|iso': { antes:{cobertura,erro,avisos}, depois:{cobertura,erro,avisos} } } — antes=base SEM extra, depois=COM extras
  var timersEnsaio = {};     // debounce do ensaio por dia { iso: timer }
  var escalaAplicada = 0;    // pico (max) aplicado a TODAS as barras — inclui os extras; recalculado a cada mudança
  var buscaCtrl = null;      // controle da busca compartilhada (geral-busca)
  var buscaTermo = '';       // termo atual (nome/CPF/RG); vazio = sem busca
  var buscaModo = 'marcar';  // 'marcar' (realça o candidato) | 'filtrar' (esconde quem não casa)
  var ativa = false;         // a aba Escala está ativa? (re-renderiza a grade na troca da seleção de unidades só quando ativa)
  var listenerUnidades = false;   // o ouvinte de rosterwork_units_changed é ligado uma vez só
  var militarSel = null;          // cpf do militar selecionado no painel de Cotas (pinta as células pela preferência)
  var listenerMilitar = false;    // o ouvinte de rosterwork_extra_militar é ligado uma vez só
  var calSeq = 0;                 // token de requisição do modo Calendário (ignora resposta antiga)

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function chaveCel(uid, isoDia) { return uid + '|' + isoDia; }

  /* preferência do militar selecionado (Cotas) para PINTAR esta célula: 'quer'/'nao_quer' só na UNIDADE DELE
     (pelotão, ou CIA se for a lotação); 'inelegivel' quando não é candidato no dia (marca a coluna de data);
     null nas outras unidades ou sem ninguém selecionado (sem cor). A cor é da unidade dele, não muda com o escopo. */
  function prefSelecionadoNaCelula(uid, isoDia) {
    if (!militarSel) return null;
    var lista = candidatos[isoDia] || [];
    var m = null;
    for (var i = 0; i < lista.length; i++) { if (lista[i].cpf === militarSel) { m = lista[i]; break; } }
    if (!m) return 'inelegivel';
    if (m.unidade_id !== uid) return null;   // é candidato no dia, mas esta não é a unidade dele → sem cor
    return m.pref;
  }
  /* o militar selecionado é candidato neste dia? (candidato = voluntário livre com cota). Governa o
     esmaecimento da coluna de data: dia sem candidatura fica marcado como indisponível pra ele. */
  function selCandidatoNoDia(isoDia) {
    var lista = candidatos[isoDia] || [];
    for (var i = 0; i < lista.length; i++) { if (lista[i].cpf === militarSel) return true; }
    return false;
  }
  /* pinta a seleção do militar (Cotas): nas CÉLULAS só verde = quer / vermelho = não quer (dias em que ele é
     candidato; elegível sem preferência fica sem marca); o dia inteiro em que ele NÃO é candidato fica
     esmaecido na COLUNA DE DATA (não enche a grade de fundo). Sem militar selecionado, tudo volta ao normal. */
  function pintarSelecionado() {
    if (!el.cal) return;
    var cels = el.cal.querySelectorAll('.escala-mes-celula');
    for (var i = 0; i < cels.length; i++) {
      var cel = cels[i];
      cel.classList.remove('escala-mes-celula--pref-quer', 'escala-mes-celula--pref-nao');
      var pref = prefSelecionadoNaCelula(parseInt(cel.getAttribute('data-unidade-id'), 10), cel.getAttribute('data-iso'));
      if (pref === 'quer') cel.classList.add('escala-mes-celula--pref-quer');
      else if (pref === 'nao_quer') cel.classList.add('escala-mes-celula--pref-nao');
    }
    if (el.cal.querySelector('.geral-calendario-mes')) {
      /* Calendário: sem coluna de data, marca o NÚMERO do dia */
      var dias = el.cal.querySelectorAll('.geral-calendario-mes-dia');
      for (var k = 0; k < dias.length; k++) {
        var celC = dias[k].querySelector('.escala-mes-celula');   // dias de outro mês não têm célula → nunca marcam
        var isoC = celC ? celC.getAttribute('data-iso') : null;
        dias[k].classList.toggle('geral-calendario-mes-dia--indisponivel', !!(militarSel && isoC && !selCandidatoNoDia(isoC)));
      }
    } else {
      /* Agenda: marca a coluna de data (cabeçalho da linha) */
      var linhas = el.cal.querySelectorAll('.escala-mes-linha');
      for (var j = 0; j < linhas.length; j++) {
        var data = linhas[j].querySelector('.escala-mes-data');
        if (!data) continue;
        var celRef = linhas[j].querySelector('.escala-mes-celula');
        var isoLinha = celRef ? celRef.getAttribute('data-iso') : null;
        data.classList.toggle('escala-mes-data--indisponivel', !!(militarSel && isoLinha && !selCandidatoNoDia(isoLinha)));
      }
    }
  }

  /* ---------- grade (reusa a do Mês, escalas-mes.js) ---------- */
  /* colunas = as unidades da companhia que estão na SELEÇÃO GLOBAL do cabeçalho; o painel de Cotas NÃO
     filtra (usa a lista completa `unidades`). Vazio → escalas-mes mostra "Selecione uma companhia ou pelotão..." */
  function colunasSelecionadas() {
    var sel = null;
    try { if (RW.seletorUnidadesCabecalho && RW.seletorUnidadesCabecalho.idsSelecionados) sel = RW.seletorUnidadesCabecalho.idsSelecionados(); } catch (e) {}
    if (!sel || !sel.length) { try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); sel = (p && p.unidades_selecionadas) || []; } catch (e2) { sel = []; } }   // seletor ainda não pronto → usa a preferência (padrão do login)
    var selStr = (sel || []).map(String);
    return unidades.filter(function (u) { return selStr.indexOf(String(u.id)) >= 0; });
  }
  /* modo da grade lido do toggle (fonte da verdade = DOM; volta a 'agenda' ao remontar o fragmento) */
  function subModoAtual() {
    var at = el.modos && el.modos.querySelector('.aba--ativa');
    return (at && at.getAttribute('data-modo')) || 'agenda';
  }
  function renderGrade() {
    if (subModoAtual() === 'calendario') { renderGradeCalendario(); return; }
    if (!el.cal || !RW.escalasMes) return;
    coberturas = {};   // a passada de renderização repovoa (sobreporCelula guarda a cobertura de cada célula)
    ensaio = {};   // o ensaio de cada dia COM extra repovoa (analisarDiasComExtra, após o render)
    escalaAplicada = 0;   // recalculada no aoTerminar (com as coberturas de todas as células já guardadas)
    RW.escalasMes.renderizar(el.cal, { colunas: colunasSelecionadas(), dataRef: comp, aoCelula: sobreporCelula, soCobertura: true,
      aoTerminar: function () { aplicarEscala(escalaGlobal()); aplicarBuscaGrade(); pintarSelecionado(); } });   // ajusta a escala + reaplica a busca + a pintura da seleção
  }
  /* troca do modo da grade (Agenda ↔ Calendário): o geral-abas já trocou a aba ativa; re-renderiza e
     refaz o ensaio dos dias com extra (renderGrade zera o cache do ensaio) */
  function aplicarSubModo() {
    renderGrade();
    analisarDiasComExtra();
  }
  /* estado vazio / carregando na grade (modo Calendário; reusa os moldes da Escala, que estão no shell) */
  function mostrarEstadoCal(texto) {
    if (!el.cal) return;
    el.cal.textContent = '';
    var n = RosterWork.tpl('tpl-escala-estado'); if (!n) return;
    n.textContent = texto; el.cal.appendChild(n);
  }
  function mostrarCarregandoCal() {
    if (!el.cal) return;
    el.cal.textContent = '';
    var n = RosterWork.tpl('tpl-escala-carregando'); if (n) el.cal.appendChild(n);
  }
  /* modo Calendário: o mês em semanas × 7 dias (componente geral-calendario-mes); dentro de cada dia, por
     unidade, a MESMA célula do modo Agenda (sobreporCelula). Busca a cobertura como o Agenda faz por dentro. */
  function renderGradeCalendario() {
    if (!el.cal) return;
    coberturas = {}; ensaio = {}; escalaAplicada = 0;
    var colunas = colunasSelecionadas();
    if (!colunas.length) { mostrarEstadoCal('Selecione uma companhia ou pelotão no seletor de unidades.'); return; }
    if (!RW.escalasDados || !RW.geralCalendarioMes || !RW.escalasCelula) { mostrarEstadoCal(RW.mensagens.escala.falhaCarregarMes); return; }
    mostrarCarregandoCal();
    var ano = comp.getFullYear(), mes = comp.getMonth();
    var inicio = iso(new Date(ano, mes, 1)), fim = iso(new Date(ano, mes + 1, 0));
    var ids = colunas.map(function (c) { return c.id; });
    var req = ++calSeq;
    RW.escalasDados.carregar(ids, inicio, fim).then(function (r) {
      if (!el.cal || !el.cal.isConnected || req !== calSeq) return;
      var cob = (r && r.cobertura) || {}, err = (r && r.erro) || {}, conf = (r && r.conflito) || {};
      var maxGlobal = RW.escalasCelula.calcularMaxGlobal(cob, ids);
      RW.geralCalendarioMes.renderizar(el.cal, { dataRef: comp, aoDia: function (celulaDia, data, noMes) {
        if (!noMes) return;   // dia de outro mês fica só com o número apagado
        var isoDia = iso(data);
        colunas.forEach(function (c) {
          var bloco = RosterWork.tpl('tpl-extra-calendario-unidade'); if (!bloco) return;
          bloco.querySelector('.extra-calendario-unidade-nome').textContent = c.nome;
          var cel = bloco.querySelector('.escala-mes-celula');
          cel.dataset.iso = isoDia; cel.dataset.unidadeId = c.id;
          cel.dataset.unidadeNome = c.nomePainel || c.nome; cel.dataset.unidadeCidade = c.cidade || '';
          var cobDia = (cob[c.id] && cob[c.id][isoDia]) || null;
          var errDia = (err[c.id] && err[c.id][isoDia]) || null;
          var confDia = !!(conf[c.id] && conf[c.id][isoDia]);
          RW.escalasCelula.preencherCelula(cel, cobDia, errDia, confDia, [], maxGlobal);
          sobreporCelula(cel, c.id, isoDia, cobDia);
          celulaDia.appendChild(bloco);
        });
      } });
      var wrap = el.cal.querySelector('.geral-calendario-mes');
      aplicarEscala(escalaGlobal());
      aplicarBuscaGrade();
      pintarSelecionado();
      if (wrap && RW.escalasCelula) RW.escalasCelula.ativarGraficos(wrap);
    }, function () { if (el.cal && el.cal.isConnected && req === calSeq) mostrarEstadoCal(RW.mensagens.escala.falhaCarregarMes); });
  }

  /* ---------- pendência: há extra colocado (celulas) que ainda não entrou na escala (inserido=false) ---------- */
  function haPendencia() {
    for (var uid in celulas) {
      var dias = celulas[uid];
      for (var d in dias) {
        var arr = dias[d] || [];
        for (var i = 0; i < arr.length; i++) if (!arr[i].inserido || arr[i].removido) return true;   // inclusão OU remoção pendente
      }
    }
    return false;
  }
  /* rodapé "Inserir/Atualizar escala": só p/ admin; ativo só quando há alteração a aplicar (haPendencia) */
  function atualizarInserir() {
    if (el.rodape) el.rodape.classList.toggle('oculto', !RosterWork.sessao.ehAdmin());
    if (el.inserir) el.inserir.disabled = !haPendencia();
  }

  function carregar(silencioso) {
    if (!RW.extrajornadaDados || !conteudo) return Promise.resolve();
    if (!silencioso) RW.mostrarVeu(conteudo);
    var req = ++cargaSeq;
    return RW.extrajornadaDados.carregarEscala(iso(comp)).then(function (r) {
      if (!silencioso) RW.esconderVeu(conteudo);
      if (!el.cal || !el.cal.isConnected || req !== cargaSeq) return;
      r = r || {};
      unidades = r.unidades || [];
      celulas = r.celulas || {};
      avisos = r.avisos || {};
      candidatos = r.candidatos || {};
      escopo = r.escopo || 'grupo';
      renderGrade();
      if (RW.extrajornadaCotasPainel && RW.extrajornadaCotasPainel.atualizarContexto) RW.extrajornadaCotasPainel.atualizarContexto();   // o painel de Cotas mostra a unidade mãe (vem daqui)
      atualizarInserir();
      analisarDiasComExtra();   // ensaia cada dia com extra → antes(base) e depois(com extras) reais na prévia
    }, function () { if (!silencioso) RW.esconderVeu(conteudo); });
  }

  /* ---------- cobertura "depois" (barra 2) ---------- */
  var BLOCO_IDX = { 1: [0, 6], 2: [6, 12], 3: [12, 18], 4: [18, 24] };
  function coberturaDepois(cob, extras) {
    var arr = cob.slice();
    extras.forEach(function (m) {
      /* removido: sai da cobertura "antes" (−1); inserido: já contado na "antes" (0); pendente novo: soma (+1) */
      var delta = m.removido ? -1 : (m.inserido ? 0 : 1);
      if (!delta) return;
      (m.blocos || []).forEach(function (b) {
        var r = BLOCO_IDX[b]; if (!r) return;
        for (var h = r[0]; h < r[1]; h++) arr[h] = Math.max(0, (Number(arr[h]) || 0) + delta);
      });
    });
    return arr;
  }

  /* ---------- escala de altura das barras: pico global (antes + extras) do mês inteiro ---------- */
  /* maior valor de cobertura "depois" em qualquer célula (inclui as sem extra = cobertura antes) */
  function escalaGlobal() {
    var m = 0;
    for (var k in coberturas) {
      var info = coberturas[k]; if (!info || !info.cobertura) continue;
      var p = k.split('|'), uid = p[0], iso = p[1];
      var ens = ensaio[k];   // com ensaio, o pico usa a cobertura REAL do "depois"; senão a aproximação
      var dep = (ens && ens.depois && ens.depois.cobertura) ? ens.depois.cobertura
              : coberturaDepois(info.cobertura, (celulas[uid] && celulas[uid][iso]) || []);
      for (var h = 0; h < dep.length; h++) { var v = Number(dep[h]) || 0; if (v > m) m = v; }
    }
    return m;
  }
  /* aplica um max a TODAS as barras da grade (a mesma escala p/ antes e depois; cabe o maior valor) */
  function aplicarEscala(target) {
    escalaAplicada = target;
    if (!el.cal || !target) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-grafico'), function (g) { g.dataset.max = String(target); });
  }
  /* recalcula o pico; se mudou, re-ajusta todas as barras e re-pinta (senão, não faz nada) */
  function sincronizarEscala() {
    var target = escalaGlobal();
    if (target === escalaAplicada) return;
    aplicarEscala(target);
    if (el.cal && RW.escalasCelula && RW.escalasCelula.desenharGraficos) RW.escalasCelula.desenharGraficos(el.cal);
  }
  /* depois de mudar os blocos de uma célula: re-ajusta a escala global (re-fit se o pico mudou),
     repinta os indicadores da célula e ensaia o dia no motor */
  function aposMudarCelula(celula, uid, isoDia) {
    sincronizarEscala();
    if (celula) repintarIndicadores(celula, uid, isoDia);
    atualizarEnsaioDia(isoDia);
    atualizarInserir();   // colocar/editar/remover muda a pendência → botão do rodapé reage na hora
  }

  function erroMarcas(erro) {
    var s = '';
    for (var h = 0; h < 24; h++) { var e = erro && erro[h]; s += (e === 2 || e === '2') ? '2' : (e ? '1' : '0'); }
    return s;
  }
  function rotulo(txt) { var r = RosterWork.tpl('tpl-extra-cel-rotulo'); if (r) r.textContent = txt; return r; }

  /* ---------- casamento extra × aviso: um extra "cobre" um aviso quando o perfil dele atende a necessidade.
     RESERVADO para a RECOMENDAÇÃO (voluntários que suprem os erros), fase futura — ainda não é chamado. ---------- */
  function satisfazGrau(grauAnt, av) {
    var a = Number(grauAnt), id = Number(av.ideal_ant);   // grau_antiguidade: menor = mais antigo
    if (av.sentido === '+') return a <= id;   // ideal ou mais antigo
    if (av.sentido === '-') return a >= id;   // ideal ou mais moderno
    return a === id;                          // grau exato
  }
  function extraSatisfaz(ex, av) {
    if (av.necessita === 'erro') return false;   // falta de distribuição: extra não resolve (admin cria o modelo)
    if (av.necessita === 'condutor') return /[CDE]/.test(ex.cnh || '');
    if (av.necessita === 'grau') return satisfazGrau(ex.grau_ant, av);
    return true;   // apto: qualquer extra colocado
  }
  /* casamento guloso: aviso mais específico primeiro (condutor, grau), depois apto; cada extra cobre 1 aviso */
  function resolverAvisos(lista, extras) {
    var pool = extras.map(function (e) { return { cnh: e.cnh, grau_ant: e.grau_ant, usado: false }; });
    var ordem = { condutor: 0, grau: 1, apto: 2 };
    var idx = lista.map(function (av, i) { return { av: av, i: i }; });
    idx.sort(function (p, q) { return (ordem[p.av.necessita] || 9) - (ordem[q.av.necessita] || 9); });
    var res = {};
    idx.forEach(function (o) {
      for (var k = 0; k < pool.length; k++) {
        if (!pool[k].usado && extraSatisfaz(pool[k], o.av)) { pool[k].usado = true; res[o.i] = true; break; }
      }
    });
    return res;
  }

  /* insere um nó logo após uma âncora (ou no fim da célula, se não houver) e vira a nova âncora */
  function inserirApos(celula, ancora, node) {
    if (ancora && ancora.insertAdjacentElement) ancora.insertAdjacentElement('afterend', node);
    else celula.appendChild(node);
    return node;
  }

  /* (badgeAviso/inserirAvisos removidos na Fase 3: os avisos da escala saíram da célula
     e agora vivem no painel do dia, gaveta — extrajornada-painel-dia.js) */

  /* indicadores do topo da célula: barra de cobertura "antes" (real) + "depois" (com os extras), cada
     uma SEGUIDA dos SEUS avisos, embaixo dela. Sem "Sem avisos" (barra verde = ok). Os avisos do "depois"
     (resultado REAL do motor: o que sobrou + erro novo, ex.: falta de distribuição) só aparecem quando há
     extra pendente no dia; sem extra, o "depois" = "antes", então mostra só os avisos do "antes". */
  function montarIndicadores(celula, uid, isoDia, info) {
    var real = celula.querySelector('.escala-mes-grafico:not(.escala-mes-grafico--depois)');   // barra "antes" (base, do escalas-celula)
    /* limpa a estrutura anterior de indicadores, PRESERVANDO a barra base 'real' */
    var caixa = celula.querySelector('.extra-cel-barras');
    if (real && caixa && caixa.contains(real)) celula.insertBefore(real, caixa);   // tira a barra base da caixa antiga
    if (caixa && caixa.parentNode) caixa.parentNode.removeChild(caixa);
    var depAntigo = celula.querySelector('.escala-mes-grafico--depois');
    if (depAntigo && depAntigo.parentNode) depAntigo.parentNode.removeChild(depAntigo);
    if (!real) return;

    var salvos = (celulas[uid] && celulas[uid][isoDia]) || [];
    var temExtra = salvos.some(function (m) { return !m.removido; }) || (pendentes[chaveCel(uid, isoDia)] || []).length > 0;
    var ens = ensaio[chaveCel(uid, isoDia)];             // { antes, depois } do motor, ou undefined até o ensaio chegar
    var eAntes = ens && ens.antes, eDepois = ens && ens.depois;
    var cob = info && info.cobertura, max = info && info.maxGlobal;

    /* barra "antes": com ensaio vem da BASE (SEM extras) e SOBRESCREVE o ler_escala_mes — assim um erro
       CAUSADO pelo extra não aparece aqui; sem ensaio ainda, fica o real */
    if (eAntes && eAntes.cobertura) {
      real.dataset.cob = eAntes.cobertura.join(',');
      real.dataset.erro = erroMarcas(eAntes.erro);
    }

    /* caixa em GRADE de 2 colunas (rótulo | barra); SEMPRE as duas linhas, barras alinhadas:
       "antes" = a barra base; "depois" = a barra com extra OU o texto "sem extra" (espaço reservado).
       Os AVISOS saíram da célula: vivem no painel do dia (gaveta). */
    caixa = RosterWork.tpl('tpl-extra-cel-barras');
    if (!caixa) return;
    celula.insertBefore(caixa, real);
    var rA = rotulo('antes'); if (rA) caixa.appendChild(rA);
    caixa.appendChild(real);   // move a barra base para dentro da caixa
    var rD = rotulo('depois'); if (rD) caixa.appendChild(rD);
    if (temExtra && cob && max > 0) {
      var grDepois = RosterWork.tpl('tpl-escala-mes-grafico');
      if (grDepois) {
        grDepois.classList.add('escala-mes-grafico--depois');
        grDepois.dataset.cob = (eDepois && eDepois.cobertura ? eDepois.cobertura : coberturaDepois(cob, salvos)).join(',');
        grDepois.dataset.max = String(escalaAplicada || max);   // escala global (inclui extras)
        grDepois.dataset.erro = erroMarcas(eDepois ? eDepois.erro : info.erro);
        caixa.appendChild(grDepois);
      }
    } else {
      var vazio = RosterWork.tpl('tpl-extra-cel-sem-extra');   // sem extra no dia: texto apagado na coluna da barra
      if (vazio) caixa.appendChild(vazio);
    }
  }

  /* repinta SÓ os indicadores da célula (barra "depois" + avisos), sem recarregar o mês nem reconstruir
     a grade — usado ao ligar/desligar bloco ou remover um extra (acaba o "piscar" da tela) */
  function repintarIndicadores(celula, uid, isoDia) {
    if (!celula) return;
    montarIndicadores(celula, uid, isoDia, coberturas[chaveCel(uid, isoDia)]);   // ele mesmo limpa a caixa/depois e preserva a barra base
    if (RW.escalasCelula && RW.escalasCelula.desenharGraficos) RW.escalasCelula.desenharGraficos(celula);
  }

  /* ---------- ensaio no motor real, por dia (deixa os avisos da prévia fiéis ao que o Inserir faria) ---------- */
  function diaTemExtra(isoDia) {   // qualquer extra no dia (inserido, pendente ou pendência de remoção) → precisa do ensaio antes(base)×depois
    for (var u in celulas) if ((celulas[u][isoDia] || []).length > 0) return true;
    return false;
  }
  function repintarDia(isoDia) {
    if (!el.cal) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-celula[data-iso="' + isoDia + '"]'), function (cel) {
      var uid = parseInt(cel.getAttribute('data-unidade-id'), 10);
      repintarIndicadores(cel, uid, isoDia);
    });
  }
  /* ensaia o dia no motor (com debounce) e repinta os avisos daquele dia com o resultado REAL */
  function analisarDiaEnsaio(isoDia) {
    if (!RosterWork.sessao.ehAdmin() || !RW.extrajornadaDados || !RW.extrajornadaDados.analisarDia) return;
    if (timersEnsaio[isoDia]) clearTimeout(timersEnsaio[isoDia]);
    timersEnsaio[isoDia] = setTimeout(function () {
      delete timersEnsaio[isoDia];
      RW.extrajornadaDados.analisarDia(isoDia).then(function (r) {
        if (!r || !r.ok || !el.cal || !el.cal.isConnected) return;
        var ant = r.antes || {}, dep = r.depois || {};
        unidades.forEach(function (u) {   // guarda antes(base) + depois(com extras) de CADA unidade do dia
          ensaio[chaveCel(u.id, isoDia)] = { antes: ant[String(u.id)] || null, depois: dep[String(u.id)] || null };
        });
        sincronizarEscala();   // o "depois" do ensaio pode mudar o pico → reescala todas as barras
        repintarDia(isoDia);
      });
    }, 400);
  }
  /* dia sem pendente volta a mostrar os avisos ATUAIS (limpa o ensaio guardado) */
  function limparEnsaioDia(isoDia) {
    var mudou = false;
    unidades.forEach(function (u) {
      var k = chaveCel(u.id, isoDia);
      if (k in ensaio) { delete ensaio[k]; mudou = true; }
    });
    if (mudou) { sincronizarEscala(); repintarDia(isoDia); }
  }
  /* o dia mudou (bloco ligado/desligado ou remoção): tem extra → ensaia; não tem → volta ao atual */
  function atualizarEnsaioDia(isoDia) {
    if (diaTemExtra(isoDia)) analisarDiaEnsaio(isoDia);
    else limparEnsaioDia(isoDia);
  }
  /* ao carregar/renderizar: dispara o ensaio de cada dia que tem QUALQUER extra (antes/base × depois) */
  function analisarDiasComExtra() {
    var vistos = {};
    for (var u in celulas) for (var d in celulas[u]) {
      if (!vistos[d] && (celulas[u][d] || []).length > 0) {
        vistos[d] = true; analisarDiaEnsaio(d);
      }
    }
  }

  /* ---------- sobreposição na célula ---------- */
  function sobreporCelula(celula, uid, isoDia, info) {
    coberturas[chaveCel(uid, isoDia)] = info || null;   // guarda p/ repintar só os indicadores depois
    montarIndicadores(celula, uid, isoDia, info);

    /* SELECIONADOS: os extras colocados (salvos com bloco + pendentes sem bloco), dentro da célula */
    var salvos = (celulas[uid] && celulas[uid][isoDia]) || [];
    salvos.forEach(function (m) { if (m.removido) return; var v = montarVaga(m, uid, isoDia, m.blocos || [], !!m.fecha24); if (v) celula.appendChild(v); });
    (pendentes[chaveCel(uid, isoDia)] || []).forEach(function (m) {
      if (salvos.some(function (s) { return s.cpf === m.cpf; })) return;   // já salvo → não duplica
      var v = montarVaga(m, uid, isoDia, [], false); if (v) celula.appendChild(v);
    });

    /* RESUMO dos candidatos (bolinhas + contagem) + o "+" que abre o dropdown com as seções (só admin) */
    var resumo = montarResumo(celula, uid, isoDia); if (resumo) celula.appendChild(resumo);
  }

  /* ---------- seções de candidatos DENTRO da célula (Interessados / Outros / Não querem) ---------- */
  var SECOES_DIA = [
    { nome: 'Interessados', pref: 'quer' },
    { nome: 'Outros', pref: 'neutro' },
    { nome: 'Não querem', pref: 'nao_quer' }
  ];
  var secaoAberta = {};   // estado de aberto/fechado por célula×seção { 'uid|iso|pref': bool }
  function pontoClasse(pref) {
    return pref === 'quer' ? 'extra-dia-ponto--quer' : (pref === 'nao_quer' ? 'extra-dia-ponto--nao' : 'extra-dia-ponto--neutro');
  }
  function balde(pref) { return pref === 'quer' ? 'quer' : (pref === 'nao_quer' ? 'nao_quer' : 'neutro'); }
  /* preferência + unidade de origem de um colocado (busca nos candidatos pré-carregados do dia) */
  function origemDe(cpf, uid, isoDia) {
    var c = (candidatos[isoDia] || []).filter(function (m) { return m.cpf === cpf; })[0];
    if (c) return { pref: c.pref, unidade_id: c.unidade_id, unidade_nome: c.unidade_nome || '' };
    return { pref: 'neutro', unidade_id: uid, unidade_nome: '' };
  }
  function jaColocado(cpf, uid, isoDia) {
    var s = (celulas[uid] && celulas[uid][isoDia]) || [];
    if (s.some(function (m) { return m.cpf === cpf && !m.removido; })) return true;   // 'removido' pendente = livre p/ recolocar
    return (pendentes[chaveCel(uid, isoDia)] || []).some(function (m) { return m.cpf === cpf; });
  }
  /* candidatos de um balde, agrupados por pelotão (o da célula primeiro), tirando os já colocados; respeita o escopo */
  function candidatosBucket(uid, isoDia, pref) {
    var mapa = {};
    (candidatos[isoDia] || []).forEach(function (m) {
      if (balde(m.pref) !== pref) return;
      if (jaColocado(m.cpf, uid, isoDia)) return;
      if (escopo !== 'grupo' && m.unidade_id !== uid) return;
      (mapa[m.unidade_id] = mapa[m.unidade_id] || { id: m.unidade_id, nome: m.unidade_nome || '', mils: [] }).mils.push(m);
    });
    var arr = Object.keys(mapa).map(function (k) { return mapa[k]; });
    arr.sort(function (a, b) { return (b.id === uid ? 1 : 0) - (a.id === uid ? 1 : 0) || String(a.nome).localeCompare(String(b.nome)); });
    arr.forEach(function (g) { g.mils.sort(function (a, b) { return (a.bloqueado ? 1 : 0) - (b.bloqueado ? 1 : 0); }); });   // sem cota vão para o fim de cada unidade
    return arr;
  }
  /* botão de um candidato (reusado nas seções do dropdown e no atalho "Selecionado"): coloca o extra ao clicar */
  function montarCandidato(m, uid, isoDia, celula, pref) {
    var c = RosterWork.tpl('tpl-extra-dia-cand'); if (!c) return null;
    c.querySelector('.extra-dia-ponto').classList.add(pontoClasse(pref || m.pref));
    c.querySelector('.extra-dia-cand-grad').textContent = m.grad || '';
    c.querySelector('.extra-dia-cand-nome').textContent = m.nome || '';
    if (RW.busca) c.setAttribute('data-busca', RW.busca.chave(m));
    if (m.bloqueado) {   // sem cota: botão apagado, não clicável (rede de segurança silenciosa)
      c.classList.add('extra-dia-cand--bloqueado'); c.disabled = true;
      var n = c.querySelector('.extra-dia-cand-nota'); if (n) { n.textContent = 'sem cota'; n.classList.remove('oculto'); }
    } else {
      c.addEventListener('click', function (ev) { ev.stopPropagation(); if (RW.fecharDropdowns) RW.fecharDropdowns(); selecionarCandidato(m, uid, isoDia, celula); });
    }
    return c;
  }
  /* preenche o corpo de uma seção com os candidatos (só quando a seção está aberta) */
  function preencherSecao(corpo, celula, uid, isoDia, sec) {
    corpo.textContent = '';
    candidatosBucket(uid, isoDia, sec.pref).forEach(function (g) {
      var uEl = RosterWork.tpl('tpl-extra-dia-unidade'); if (!uEl) return;
      var rot = uEl.querySelector('.extra-dia-unidade-rotulo');
      if (escopo === 'grupo') rot.textContent = g.nome + (g.id === uid ? ' · esta unidade' : ' · deslocamento');
      else rot.classList.add('oculto');
      var listaEl = uEl.querySelector('.extra-dia-unidade-lista');
      g.mils.forEach(function (m) {
        var c = montarCandidato(m, uid, isoDia, celula, sec.pref);
        if (c) listaEl.appendChild(c);
      });
      corpo.appendChild(uEl);
    });
    if (buscaTermo) aplicarBuscaCelula(celula, uid, isoDia);   // reaplica a busca aos candidatos recém-abertos
  }
  function montarSecoes(celula, uid, isoDia) {
    var wrap = RosterWork.tpl('tpl-extra-dia-secoes'); if (!wrap) return null;
    SECOES_DIA.forEach(function (sec) {
      var grupos = candidatosBucket(uid, isoDia, sec.pref);
      var total = grupos.reduce(function (s, g) { return s + g.mils.length; }, 0);
      var secEl = RosterWork.tpl('tpl-extra-dia-secao'); if (!secEl) return;
      secEl.querySelector('.extra-dia-ponto').classList.add(pontoClasse(sec.pref));
      secEl.querySelector('.extra-dia-secao-nome').textContent = sec.nome;
      secEl.querySelector('.extra-dia-secao-conta').textContent = String(total);
      var chave = chaveCel(uid, isoDia) + '|' + sec.pref;
      var aberta = !!secaoAberta[chave];
      secEl.classList.toggle('extra-dia-secao--fechado', !aberta);
      var topo = secEl.querySelector('.extra-dia-secao-topo');
      topo.setAttribute('aria-expanded', String(aberta));
      var corpo = secEl.querySelector('.extra-dia-secao-corpo');
      if (aberta) preencherSecao(corpo, celula, uid, isoDia, sec);   // candidatos só quando aberta (célula compacta)
      topo.addEventListener('click', function (ev) {
        ev.stopPropagation();
        secaoAberta[chave] = !secaoAberta[chave];
        secEl.classList.toggle('extra-dia-secao--fechado', !secaoAberta[chave]);
        topo.setAttribute('aria-expanded', String(secaoAberta[chave]));
        if (secaoAberta[chave] && !corpo.firstChild) preencherSecao(corpo, celula, uid, isoDia, sec);
      });
      wrap.appendChild(secEl);
    });
    return wrap;
  }
  /* (re)monta o atalho "Selecionado" no topo do menu do "+": o militar escolhido nas Cotas, se for
     candidato LIVRE nesta célula. Chamado quando o dropdown abre (militarSel pode ter mudado desde o render). */
  function atualizarSelecionadoNoMenu(menu, celula, uid, isoDia) {
    if (!menu) return;
    var antigo = menu.querySelector('.extra-dia-unidade--selecionado');
    if (antigo) menu.removeChild(antigo);
    if (!militarSel) return;
    var ms = (candidatos[isoDia] || []).filter(function (x) { return x.cpf === militarSel; })[0];
    if (!ms) return;
    if (escopo !== 'grupo' && ms.unidade_id !== uid) return;
    if (jaColocado(ms.cpf, uid, isoDia)) return;
    var uSel = RosterWork.tpl('tpl-extra-dia-unidade');
    if (!uSel) return;
    uSel.classList.add('extra-dia-unidade--selecionado');
    uSel.querySelector('.extra-dia-unidade-rotulo').textContent = 'Selecionado';
    var cSel = montarCandidato(ms, uid, isoDia, celula, ms.pref);
    if (cSel) uSel.querySelector('.extra-dia-unidade-lista').appendChild(cSel);
    menu.insertBefore(uSel, menu.firstChild);
  }
  /* resumo na célula (bolinhas + contagem por preferência) + o "+" cujo dropdown carrega as seções
     (Interessados/Outros/Não querem). Só admin vê o "+"; o comum vê só as contagens. */
  function montarResumo(celula, uid, isoDia) {
    var wrap = RosterWork.tpl('tpl-extra-cel-resumo');
    if (!wrap) return null;
    var contas = wrap.querySelector('.extra-cel-resumo-contas');
    SECOES_DIA.forEach(function (sec) {
      var grupos = candidatosBucket(uid, isoDia, sec.pref);
      var total = grupos.reduce(function (s, g) { return s + g.mils.length; }, 0);
      var c = RosterWork.tpl('tpl-extra-cel-resumo-conta');
      if (!c) return;
      c.querySelector('.extra-dia-ponto').classList.add(pontoClasse(sec.pref));
      c.querySelector('.extra-cel-resumo-num').textContent = String(total);
      if (contas) contas.appendChild(c);
    });
    var add = wrap.querySelector('.extra-cel-add');
    if (RosterWork.sessao.ehAdmin() && add) {
      var menu = add.querySelector('.dropdown-menu');
      var secs = montarSecoes(celula, uid, isoDia);   // as seções vivem no menu do "+"
      if (secs && menu) menu.appendChild(secs);
      var gatilho = add.querySelector('.extra-cel-add-gatilho');
      if (gatilho) gatilho.addEventListener('click', function (ev) {
        ev.stopPropagation();   // não sobe pra grade (protege a gaveta) nem abre o painel do dia
        if (add.classList.contains('dropdown--aberto')) { if (RW.fecharDropdowns) RW.fecharDropdowns(); return; }
        atualizarSelecionadoNoMenu(menu, celula, uid, isoDia);   // (re)monta o atalho "Selecionado" com o militar atual das Cotas
        if (RW.abrirDropdown) RW.abrirDropdown(add);
      });
    } else if (add && add.parentNode) {
      add.parentNode.removeChild(add);   // comum não coloca extra
    }
    return wrap;
  }
  /* selecionar um candidato: pendente (sem bloco) na célula; fecha 24 h entra já com os 4 blocos, travado, e salva */
  function selecionarCandidato(m, uid, isoDia, celula) {
    if (m.bloqueado) return;   // sem cota: o botão já vem disabled; rede de segurança silenciosa (sem modal)
    if (jaColocado(m.cpf, uid, isoDia)) return;
    if (m.fecha24) {   // fecha 24 h: tudo ou nada — coloca os 4 blocos, trava, e grava (otimista, desfaz se falhar)
      aplicarLocal(m.cpf, uid, isoDia, [1, 2, 3, 4]);
      atualizarCelula(celula, uid, isoDia);
      aposMudarCelula(celula, uid, isoDia);
      function desfazer(msg) { aplicarLocal(m.cpf, uid, isoDia, []); atualizarCelula(celula, uid, isoDia); aposMudarCelula(celula, uid, isoDia); if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg }); }
      RW.extrajornadaDados.definirEscala(m.cpf, isoDia, [1, 2, 3, 4], RosterWork.sessao.cpf(), uid).then(
        function (r) { if (!r || !r.success) desfazer((r && r.error) || RW.mensagens.geral.falhaServidor); },
        function () { desfazer(RW.mensagens.geral.semConexao); });
      return;
    }
    var k = chaveCel(uid, isoDia);
    pendentes[k] = pendentes[k] || [];
    if (!pendentes[k].some(function (x) { return x.cpf === m.cpf; })) {
      pendentes[k].push({ cpf: m.cpf, grad: m.grad, nome: m.nome, cota: m.cota, colocado: m.colocado, fecha24: m.fecha24 });
    }
    atualizarCelula(celula, uid, isoDia);
  }
  /* re-renderiza só as vagas + seções da célula (mantém gráficos e avisos) */
  function atualizarCelula(celula, uid, isoDia) {
    if (RW.fecharDropdowns) RW.fecharDropdowns();   // fecha o "+" (limpa o flutuante) antes de reconstruir
    Array.prototype.forEach.call(celula.querySelectorAll('.extra-vaga, .extra-cel-resumo'), function (e) {
      if (e.parentNode) e.parentNode.removeChild(e);
    });
    var salvos = (celulas[uid] && celulas[uid][isoDia]) || [];
    salvos.forEach(function (m) { if (m.removido) return; var v = montarVaga(m, uid, isoDia, m.blocos || [], !!m.fecha24); if (v) celula.appendChild(v); });
    (pendentes[chaveCel(uid, isoDia)] || []).forEach(function (m) {
      if (salvos.some(function (s) { return s.cpf === m.cpf; })) return;
      var v = montarVaga(m, uid, isoDia, [], false); if (v) celula.appendChild(v);
    });
    var resumo = montarResumo(celula, uid, isoDia); if (resumo) celula.appendChild(resumo);
    if (buscaTermo) aplicarBuscaCelula(celula, uid, isoDia);   // reaplica a busca (acende/apaga a célula conforme os colocados)
  }

  /* ---------- vaga (extra colocado): nome + 4 bolinhas + X ---------- */
  function montarVaga(m, uid, isoDia, blocosAtivos, travado) {
    var vaga = RosterWork.tpl('tpl-extra-vaga');
    if (!vaga) return null;
    vaga.querySelector('.extra-vaga-grad').textContent = m.grad || '';
    vaga.querySelector('.extra-vaga-nome').textContent = m.nome || '';
    var origem = origemDe(m.cpf, uid, isoDia);   // ponto de preferência + pelotão só em deslocamento
    var ponto = vaga.querySelector('.extra-vaga-origem');
    if (ponto) ponto.classList.add(pontoClasse(origem.pref));
    var pelotao = vaga.querySelector('.extra-vaga-pelotao');   // mostra o pelotão SÓ quando é de outra unidade (a coluna já diz a unidade da célula)
    if (pelotao && origem.unidade_id && origem.unidade_id !== uid) { pelotao.textContent = origem.unidade_nome; pelotao.classList.remove('oculto'); }
    if (travado) {   // fecha 24 h: marca visível ("24h") + bolinhas travadas + dica (não só na dica)
      vaga.classList.add('extra-vaga--fecha24');
      var t24 = vaga.querySelector('.extra-vaga-24h'); if (t24) t24.classList.remove('oculto');
      var dica = RW.mensagens && RW.mensagens.extrajornada && RW.mensagens.extrajornada.fecha24Dica;
      if (dica) vaga.setAttribute('title', dica);
    }
    var ativos = (blocosAtivos || []).map(Number);
    var admin = RosterWork.sessao.ehAdmin();
    var cota = (m.cota == null) ? 99 : m.cota;
    /* bolinhas CUMULATIVAS: clicar no bloco N liga 1..N; clicar na maior ligada reduz uma (desliga ela);
       o hover mostra a prévia do que o clique faria (bloco que vai ligar / que vai desligar) */
    var bolinhas = Array.prototype.slice.call(vaga.querySelectorAll('.extra-bolinha'));
    function nivelAtivo() {   // maior bloco ligado (0 = nenhum); os blocos são contíguos 1..N
      var max = 0;
      bolinhas.forEach(function (b) { var n = +b.getAttribute('data-bloco'); if (b.classList.contains('extra-bolinha--ativa') && n > max) max = n; });
      return max;
    }
    function aplicarNivel(nivel) {   // preenche 1..nivel, apaga o resto
      bolinhas.forEach(function (b) { var n = +b.getAttribute('data-bloco'); b.classList.toggle('extra-bolinha--ativa', n <= nivel); });
    }
    function previa(nivel) {   // realça só o que MUDA: vai ligar (previa-on) / vai desligar (previa-off); nivel<0 limpa
      var atual = nivelAtivo();
      bolinhas.forEach(function (b) {
        var n = +b.getAttribute('data-bloco');
        b.classList.remove('extra-bolinha--previa-on', 'extra-bolinha--previa-off');
        if (nivel < 0) return;
        if (n > atual && n <= nivel) b.classList.add('extra-bolinha--previa-on');
        else if (n <= atual && n > nivel) b.classList.add('extra-bolinha--previa-off');
      });
    }
    bolinhas.forEach(function (b) {
      var n = +b.getAttribute('data-bloco');
      if (ativos.indexOf(n) >= 0) b.classList.add('extra-bolinha--ativa');
      if (!admin || travado) { b.disabled = true; return; }   // travado = fecha 24 h (imutável)
      b.addEventListener('mouseenter', function () { if (!b.disabled) previa((n === nivelAtivo()) ? n - 1 : n); });
      b.addEventListener('mouseleave', function () { previa(-1); });
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var atual = nivelAtivo();
        var novo = (n === atual) ? n - 1 : n;   // clicar liga 1..n; na maior ligada, reduz uma
        /* trava de cota (só ao aumentar): total do mês do modelo, trocando o nível atual do dia pelo novo */
        if (novo > atual && (colocadoDe(m.cpf) - atual + novo) > cota) {
          if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.cotaNoLimite });
          return;
        }
        if (novo <= 0) { remover(m.cpf, uid, isoDia, vaga, !!m.inserido); return; }   // zerou os blocos = remove o extra
        aplicarNivel(novo);
        previa(-1);   // o estado real assume; some a prévia
        salvarBlocos(m.cpf, uid, isoDia, blocosDaVaga(vaga), vaga, b);
      });
    });
    var x = vaga.querySelector('.extra-vaga-x');
    if (x) {
      if (!admin) x.classList.add('oculto');   // comum não remove extra: o X nem aparece
      else x.addEventListener('click', function () { remover(m.cpf, uid, isoDia, vaga, !!m.inserido); });
    }
    return vaga;
  }
  function blocosDaVaga(vaga) {
    var arr = [];
    Array.prototype.forEach.call(vaga.querySelectorAll('.extra-bolinha--ativa'), function (b) { arr.push(parseInt(b.getAttribute('data-bloco'), 10)); });
    arr.sort(function (a, b) { return a - b; });
    return arr;
  }

  /* ---------- salvar / remover (extra_escala_definir com a unidade = deslocamento) ---------- */
  function temSalvo(cpf, uid, isoDia) {
    var l = (celulas[uid] && celulas[uid][isoDia]) || [];
    return l.some(function (m) { return m.cpf === cpf; });
  }
  function removerPendente(cpf, uid, isoDia) {
    var k = chaveCel(uid, isoDia);
    if (pendentes[k]) pendentes[k] = pendentes[k].filter(function (m) { return m.cpf !== cpf; });
  }

  /* dados completos de um candidato do dia (grad, nome, cnh, grau_ant, cota, colocado, unidade, fecha24) */
  function dadosCandidato(cpf, isoDia) {
    return (candidatos[isoDia] || []).filter(function (m) { return m.cpf === cpf; })[0] || null;
  }
  /* total de blocos do militar no mês, lido do modelo local (celulas) — fonte da trava de cota, sempre atual */
  function colocadoDe(cpf) {
    var total = 0, u, d;
    for (u in celulas) for (d in celulas[u]) (celulas[u][d] || []).forEach(function (m) {
      if (m.cpf === cpf) total += (m.blocos || []).length;
    });
    return total;
  }
  /* espelha no modelo local (celulas/pendentes) o que o extra_escala_definir fez no banco, para os
     indicadores e re-renders seguintes lerem o estado certo sem recarregar o mês */
  function aplicarLocal(cpf, uid, isoDia, blocos) {
    blocos = blocos || [];
    var dia = ((celulas[uid] = celulas[uid] || {})[isoDia] = celulas[uid][isoDia] || []);
    var ex = dia.filter(function (m) { return m.cpf === cpf; })[0];
    if (blocos.length) {
      if (ex) { ex.blocos = blocos.slice(); ex.inserido = false; ex.removido = false; }   // editou/recolocou → volta a pendente (Atualizar; limpa 'removido')
      else {
        var c = dadosCandidato(cpf, isoDia) || {};
        dia.push({ cpf: cpf, grad: c.grad, nome: c.nome, blocos: blocos.slice(), cnh: c.cnh, grau_ant: c.grau_ant,
          fecha24: c.fecha24, cota: c.cota, unidade_id: c.unidade_id, unidade_nome: c.unidade_nome, inserido: false });
      }
    } else if (ex) {
      celulas[uid][isoDia] = dia.filter(function (m) { return m.cpf !== cpf; });   // 0 blocos: remove (espelha o delete)
    }
    removerPendente(cpf, uid, isoDia);
  }

  function salvarBlocos(cpf, uid, isoDia, blocos, vaga, botao) {
    if (!RW.extrajornadaDados) return;
    var bolinhas = vaga.querySelectorAll('.extra-bolinha');
    Array.prototype.forEach.call(bolinhas, function (b) { b.disabled = true; });
    function destravar() { Array.prototype.forEach.call(bolinhas, function (b) { b.disabled = false; }); }
    RW.extrajornadaDados.definirEscala(cpf, isoDia, blocos, RosterWork.sessao.cpf(), uid).then(function (r) {
      destravar();
      if (r && r.success) {
        aplicarLocal(cpf, uid, isoDia, blocos);   // espelha o banco no modelo local (sem recarregar o mês)
        var celula = vaga && vaga.closest ? vaga.closest('.escala-mes-celula') : null;
        aposMudarCelula(celula, uid, isoDia);   // re-ajusta a escala (re-fit se o pico mudou) + repinta a célula + ensaia
      } else {
        if (botao) botao.classList.toggle('extra-bolinha--ativa');   // desfaz o visual
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
      }
    }, function () {
      destravar();
      if (botao) botao.classList.toggle('extra-bolinha--ativa');
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  function remover(cpf, uid, isoDia, vaga, inserido) {
    /* extra JÁ na escala: analisa o impacto antes; se a remoção abrir furo, confirma com o admin */
    if (inserido && temSalvo(cpf, uid, isoDia) && RW.extrajornadaDados.analisarRemocao) {
      RW.extrajornadaDados.analisarRemocao(cpf, isoDia).then(function (a) {
        if (a && a.ok && a.veredito === 'problema' && RW.confirmar) {
          var av = (a.avisos && a.avisos[0]) || {};
          RW.confirmar({
            tipo: 'aviso',
            mensagem: (av.descricao || av.titulo || RW.mensagens.extrajornada.removerAbreFuro),
            textoConfirmar: RW.mensagens.extrajornada.removerMesmoAssim,
            aoConfirmar: function () { efetuarRemocao(cpf, uid, isoDia, vaga, true); }
          });
        } else { efetuarRemocao(cpf, uid, isoDia, vaga, true); }
      }, function () { efetuarRemocao(cpf, uid, isoDia, vaga, true); });
    } else {
      efetuarRemocao(cpf, uid, isoDia, vaga, inserido);
    }
  }
  /* marca um extra JÁ inserido como remoção PENDENTE (mantém blocos/inserido: a barra "depois" subtrai
     e o "Inserir/Atualizar escala" aplica no lote); o militar some da célula mas não sai da escala ainda */
  function marcarRemovido(cpf, uid, isoDia) {
    var dia = (celulas[uid] && celulas[uid][isoDia]) || [];
    var ex = dia.filter(function (m) { return m.cpf === cpf; })[0];
    if (ex) ex.removido = true;
  }
  function efetuarRemocao(cpf, uid, isoDia, vaga, inserido) {
    var celula = vaga && vaga.closest ? vaga.closest('.escala-mes-celula') : null;
    var eraSalvo = temSalvo(cpf, uid, isoDia);
    removerPendente(cpf, uid, isoDia);
    if (vaga && vaga.parentNode) vaga.parentNode.removeChild(vaga);
    if (!eraSalvo) {   // era só pendente (sem bloco) → nada no banco; devolve o militar às seções
      if (celula) atualizarCelula(celula, uid, isoDia);
      return;
    }
    /* staging da remoção (sem loading): salva 0 blocos e NÃO reconcilia na hora. Vira pendência — extra já
       inserido marca 'removido'; rascunho some de vez — e o "Inserir/Atualizar escala" aplica tudo em lote */
    RW.extrajornadaDados.definirEscala(cpf, isoDia, [], RosterWork.sessao.cpf(), uid).then(function (r) {
      if (!r || !r.success) {   // falhou: restaura a vaga + avisa
        if (celula) atualizarCelula(celula, uid, isoDia);
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
        return;
      }
      if (inserido) marcarRemovido(cpf, uid, isoDia);   // remoção de extra já inserido → pendência de remoção
      else aplicarLocal(cpf, uid, isoDia, []);           // rascunho → some do modelo local
      if (celula) atualizarCelula(celula, uid, isoDia);
      aposMudarCelula(celula, uid, isoDia);   // re-ajusta a escala + repinta + ensaia + o botão do rodapé reage
    }, function () {
      if (celula) atualizarCelula(celula, uid, isoDia);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- "Inserir na escala": efetiva os extras; o motor refaz o "onde" dos dias afetados ---------- */
  function inserirNaEscala() {
    if (!RW.extrajornadaDados) return;
    if (el.inserir) el.inserir.disabled = true;
    if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // efetiva os extras e o motor recalcula a escala: véu global + recálculo pendente
    RW.extrajornadaDados.inserirEscala(iso(comp)).then(function (r) {
      if (el.inserir) el.inserir.disabled = false;
      if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
      if (r && r.ok) {
        carregar(true);   // reload silencioso: barras "depois"/avisos refletem o motor (resolvido ou falta de distribuição)
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Extrajornada' });   // modal de resumo (§8.2)
        else if (RW.avisar) RW.avisar({ tipo: 'sucesso', mensagem: RW.mensagens.extrajornada.inserida });
      } else if (RW.avisar) {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
      }
    }, function () {
      if (el.inserir) el.inserir.disabled = false;
      if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- mês compartilhado (o seletor é do orquestrador) ---------- */
  /* há edição não salva? só o painel de Cotas edita aqui (a grade auto-salva) */
  function estaSujo() {
    var cp = RW.extrajornadaCotasPainel;
    return !!(cp && cp.temEdicaoAberta && cp.temEdicaoAberta());
  }
  /* redesenha o mês compartilhado (o orquestrador chama ao trocar o mês) */
  function renderMes() {
    pendentes = {};
    comp = RW.extrajornadaMes.obter();
    carregar();
    var cp = RW.extrajornadaCotasPainel;
    if (cp && cp.sincronizarMes) cp.sincronizarMes(comp);   // painel de Cotas segue o mesmo mês
  }
  function mesAtual() { return comp; }
  /* nome da unidade mãe (CIA/CIBM): as unidades vêm com ela em primeiro (RPC ordena CIA/CIBM antes) */
  function contextoNome() { return (unidades[0] && unidades[0].nome) || ''; }

  /* ---------- busca de militar (nome/CPF/RG): marca/filtra candidatos + acende células ---------- */
  function aplicarBusca(termo, modo) {
    buscaTermo = termo || '';
    buscaModo = modo || 'marcar';
    aplicarBuscaGrade();
  }
  function casaLinhaBusca(db) { return RW.busca.casaTexto(buscaTermo, db); }   // casa o termo contra o data-busca pré-computado
  function aplicarBuscaCelula(cel, uid, isoDia) {
    var tem = !!buscaTermo;
    var colocadoCasa = tem && ((celulas[uid] && celulas[uid][isoDia]) || []).some(function (m) {
      return !m.removido && RW.busca.casaMilitar(buscaTermo, m);   // (b) acende a célula se um extra COLOCADO ali casa
    });
    cel.classList.toggle('escala-mes-celula--busca', colocadoCasa);
    Array.prototype.forEach.call(cel.querySelectorAll('.extra-dia-cand'), function (row) {   // (a) candidatos das seções abertas
      var casa = casaLinhaBusca(row.getAttribute('data-busca') || '');
      row.classList.toggle('extra-dia-cand--busca', tem && casa && buscaModo === 'marcar');
      row.classList.toggle('oculto', tem && !casa && buscaModo === 'filtrar');
    });
  }
  function aplicarBuscaGrade() {
    if (!el.cal || !RW.busca) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-celula'), function (cel) {
      aplicarBuscaCelula(cel, parseInt(cel.getAttribute('data-unidade-id'), 10), cel.getAttribute('data-iso'));
    });
  }

  /* ---------- montagem ---------- */
  function montar(cont) {
    conteudo = cont;
    comp = RW.extrajornadaMes ? RW.extrajornadaMes.obter() : new Date(new Date().getFullYear(), new Date().getMonth(), 1);   // mês compartilhado com a Disponibilidade
    carregado = false;
    pendentes = {};

    el.cal = cont.querySelector('#extra-escala-cal');
    /* a grade reusa .escala-mes-celula; o clique de célula da ESCALA é delegado no .conteudo do shell
       (escalas-painel.js) e sobrevive à navegação → abriria a gaveta da Escala. Barra aqui: os cliques
       da grade da extra (célula, seções de candidatos, bolinhas, X) não borbulham até esse ouvinte. */
    if (el.cal) el.cal.addEventListener('click', function (ev) { ev.stopPropagation(); });

    el.rodape = cont.querySelector('#extra-escala-rodape');
    el.inserir = cont.querySelector('#extra-escala-inserir');
    if (el.inserir) el.inserir.addEventListener('click', inserirNaEscala);

    el.busca = cont.querySelector('#extra-busca');   // busca de militar (nome/CPF/RG) do sub-cabeçalho, só na aba Escala
    if (el.busca && RW.busca) buscaCtrl = RW.busca.criar({ caixa: el.busca, aoBuscar: aplicarBusca });

    el.modos = cont.querySelector('#extra-escala-modos');   // toggle Agenda/Calendário (só na aba Escala)
    if (el.modos && RW.abas && !el.modos.dataset.ligado) { RW.abas.ligar(el.modos, aplicarSubModo); el.modos.dataset.ligado = '1'; }

    /* trocar a seleção global de unidades (cabeçalho) re-renderiza só as COLUNAS da grade, sem chamar o
       banco (os dados de todas as unidades já vêm carregados). Ligado uma vez (o fragmento remonta a cada
       navegação, mas o ouvinte de window fica; ele lê o estado atual do módulo). */
    if (!listenerUnidades) {
      window.addEventListener('rosterwork_units_changed', function () {
        if (ativa && el.cal && el.cal.isConnected) renderGrade();
      });
      listenerUnidades = true;
    }
    /* o painel de Cotas avisa qual militar foi selecionado → pinta as células pela preferência dele */
    if (!listenerMilitar) {
      window.addEventListener('rosterwork_extra_militar', function (e) {
        militarSel = (e && e.detail && e.detail.cpf) || null;
        pintarSelecionado();
      });
      listenerMilitar = true;
    }
  }

  function ativar() {
    ativa = true;
    if (el.busca) el.busca.classList.remove('oculto');   // busca só aparece na aba Escala
    if (el.modos) el.modos.classList.remove('oculto');   // toggle Agenda/Calendário só na aba Escala
    var alvo = RW.extrajornadaMes ? RW.extrajornadaMes.obter() : comp;
    if (!carregado) { carregado = true; comp = alvo; carregar(); }   // o aviso de pendência (com o Inserir) some/aparece no carregar
    else if (iso(alvo) !== iso(comp)) renderMes();   // a outra aba mudou o mês enquanto esta estava fora
    else renderGrade();   // mesmo mês: a grade foi limpa no desativar, redesenha do estado em cache
  }
  function desativar() {
    ativa = false;
    if (el.busca) el.busca.classList.add('oculto');
    if (el.modos) el.modos.classList.add('oculto');
    if (buscaCtrl) buscaCtrl.limpar();   // limpa a busca ao sair da aba (não deixa filtro velho)
    if (RW.escalasMes && el.cal) RW.escalasMes.limpar(el.cal);   // solta os observers dos gráficos ao sair
  }

  /* recarrega a grade em silêncio (o painel de Cotas chama após salvar: o escopo/cotas mudaram → dropdown atualiza) */
  function recarregar() { return carregado ? carregar(true) : Promise.resolve(); }

  RW.extrajornadaEscala = { montar: montar, ativar: ativar, desativar: desativar, recarregar: recarregar,
    mesAtual: mesAtual, contextoNome: contextoNome, estaSujo: estaSujo, renderMes: renderMes };
})();
