/* ============================================================
   EXTRAJORNADA — aba Distribuição (organização da extra do mês, admin)
   Reusa a grade compartilhada do Mês (escalas-mes.js, com a escala do
   dia sem as extras): dias × unidades do grupo, cada célula com a
   cobertura sem extra (antes) e a escala do dia, a cobertura com as
   extras (depois, por ensaio no motor) e as extras do dia, que o
   administrador mexe ali mesmo: marca e desmarca os horários de 6 h e
   tira do dia (X). Escolher um militar no A escalar põe a vaga apagada
   dele nos dias livres, para marcar direto. Tudo vai para o rascunho do
   mês (escalas-extra-rascunho.js), o mesmo do painel do dia; o Salvar e
   o Lançar na escala ficam no rodapé (extrajornada-lancar.js). Clicar
   na célula (ou no Escalar) abre o painel do dia.
   As peças de dentro da célula ficam em extrajornada-escala-celula.js.
   RosterWork.extrajornadaEscala.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var conteudo = null;
  var el = {};
  var comp = null;       // Date do 1º dia do mês
  var unidades = [];     // colunas da grade [{id,nome,cidade}]
  var celulas = {};      // extras SALVAS por unidade×dia { uid: { iso: [ {cpf,grad,nome,blocos,fecha24,inserido,...} ] } }
  var candidatos = {};   // voluntários livres por DIA { iso: [ {cpf,grad,nome,pref,cota,fecha24,unidade_id,unidade_nome,...} ] }
  var carregado = false;
  var cargaSeq = 0;          // token da grade: ignora resposta antiga ao trocar de mês rápido
  var coberturas = {};       // cobertura (info) de cada célula visível { 'uid|iso': info }
  var ensaio = {};           // estado pós-motor por célula { 'uid|iso': { antes, depois } } (antes = SEM extra, depois = COM extras e rascunho)
  var timersEnsaio = {};     // espera do ensaio por dia { iso: timer }
  var seqEnsaio = {};        // token do ensaio por dia (vale a última resposta)
  var escalaAplicada = {};   // pico aplicado às barras de cada unidade { uid: pico }
  var buscaCtrl = null;
  var buscaTermo = '';
  var buscaModo = 'marcar';
  var ativa = false;
  var ouvintesLigados = false;
  var militarSel = null;     // cpf do militar escolhido no A escalar (pinta as células e põe a vaga apagada dele)
  var calSeq = 0;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function chaveCel(uid, isoDia) { return uid + '|' + isoDia; }
  function C() { return RW.extrajornadaEscalaCelula; }
  function R() { return RW.escalasExtraRascunho; }
  function salvosDia(uid, isoDia) { return (celulas[uid] && celulas[uid][isoDia]) || []; }
  function efetivas(uid, isoDia) { return C().extrasDaCelula(salvosDia(uid, isoDia), uid, isoDia, candidatos[isoDia] || []); }
  function pintarSelecionado() { if (el.cal) C().pintar(el.cal, candidatos, militarSel); }
  function nomeUnidade(uid) { var u = unidades.filter(function (x) { return String(x.id) === String(uid); })[0]; return u ? u.nome : ''; }

  /* o que está salvo de um militar num dia (em qualquer unidade): { unidade, blocos } ou null */
  function salvoDe(cpf, isoDia) {
    for (var u in celulas) {
      var m = (celulas[u][isoDia] || []).filter(function (x) { return x.cpf === cpf; })[0];
      if (m) return { unidade: Number(u), blocos: (m.blocos || []).map(Number) };
    }
    return null;
  }
  /* o militar tem extra no dia (o salvo com o rascunho por cima)? */
  function temExtraNoDia(cpf, isoDia) {
    var mud = R().obter(cpf, isoDia);
    return mud ? mud.blocos.length > 0 : !!salvoDe(cpf, isoDia);
  }

  /* ---------- mexer na célula: vai para o rascunho ---------- */
  function definirNaCelula(m, uid, isoDia, blocos) {
    R().definir({ cpf: m.cpf, data: isoDia, unidade: uid, blocos: blocos, antes: salvoDe(m.cpf, isoDia), militar: { grad: m.grad, nome: m.nome } });
  }
  function marcarNaCelula(m, uid, isoDia, bloco) {
    var atual = (m.blocos || []).slice();
    var i = atual.indexOf(bloco);
    if (m.fecha24) atual = atual.length ? [] : [1, 2, 3, 4];
    else if (i >= 0) atual.splice(i, 1);
    else atual.push(bloco);
    definirNaCelula(m, uid, isoDia, atual);
  }

  /* ---------- grade (reusa a do Mês, escalas-mes.js) ---------- */
  /* colunas = as unidades da companhia que estão na SELEÇÃO do cabeçalho */
  function colunasSelecionadas() {
    var selStr = RW.extrajornadaUnidades.selecionadas();
    /* o painel do dia mostra a companhia acima do pelotão ("2ªCIBM / 2ºPEL"); a companhia vem primeiro */
    var cia = unidades[0];
    return unidades.filter(function (u) { return selStr.indexOf(String(u.id)) >= 0; }).map(function (u) {
      return Object.assign({}, u, { nomePainel: cia && cia.id !== u.id ? cia.nome + ' / ' + u.nome : u.nome });
    });
  }
  function subModoAtual() {
    var at = el.modos && el.modos.querySelector('.aba--ativa');
    return (at && at.getAttribute('data-modo')) || 'agenda';
  }
  function depoisDoRender() { aplicarEscala(escalaPorUnidade()); aplicarBuscaGrade(); pintarSelecionado(); }
  function renderGrade() {
    if (subModoAtual() === 'calendario') { renderGradeCalendario(); return; }
    if (!el.cal || !RW.escalasMes) return;
    coberturas = {}; ensaio = {}; escalaAplicada = {};
    RW.escalasMes.renderizar(el.cal, { colunas: colunasSelecionadas(), dataRef: comp, aoCelula: sobreporCelula, semExtra: true,
      aoTerminar: depoisDoRender });
  }
  function aplicarSubModo() { renderGrade(); analisarDiasComExtra(); }
  function mostrarEstadoCal(texto) {
    if (!el.cal) return;
    el.cal.textContent = '';
    var n = RW.tpl('tpl-escala-estado'); if (!n) return;
    n.textContent = texto; el.cal.appendChild(n);
  }
  /* modo Calendário: o mês em semanas × 7 dias (geral-calendario-mes); dentro de cada dia, por unidade, a MESMA
     célula do modo Agenda (sobreporCelula) */
  function renderGradeCalendario() {
    if (!el.cal) return;
    coberturas = {}; ensaio = {}; escalaAplicada = {};
    var colunas = colunasSelecionadas();
    if (!colunas.length) { mostrarEstadoCal(RW.mensagens.escala.selecioneUnidade); return; }
    if (!RW.escalasDados || !RW.geralCalendarioMes || !RW.escalasCelula) { mostrarEstadoCal(RW.mensagens.escala.falhaCarregarMes); return; }
    el.cal.textContent = '';
    var car = RW.tpl('tpl-escala-carregando'); if (car) el.cal.appendChild(car);
    var ano = comp.getFullYear(), mes = comp.getMonth();
    var ids = colunas.map(function (c) { return c.id; });
    var req = ++calSeq;
    RW.escalasDados.carregar(ids, iso(new Date(ano, mes, 1)), iso(new Date(ano, mes + 1, 0))).then(function (r) {
      if (!el.cal || !el.cal.isConnected || req !== calSeq) return;
      var cob = (r && r.cobertura) || {}, err = (r && r.erro) || {}, mil = (r && r.militares) || {};
      var maxPorUnidade = RW.escalasCelula.calcularMaxPorUnidade(cob, ids);
      RW.geralCalendarioMes.renderizar(el.cal, { dataRef: comp, unidadesPorDia: colunas.length, aoDia: function (celulaDia, data, noMes) {
        if (!noMes) return;
        var isoDia = iso(data);
        colunas.forEach(function (c) {
          var bloco = RW.tpl('tpl-extra-calendario-unidade'); if (!bloco) return;
          bloco.querySelector('.extra-calendario-unidade-nome').textContent = c.nome;
          var cel = bloco.querySelector('.escala-mes-celula');
          cel.dataset.iso = isoDia; cel.dataset.unidadeId = c.id;
          cel.dataset.unidadeNome = c.nomePainel || c.nome; cel.dataset.unidadeCidade = c.cidade || '';
          var cobDia = (cob[c.id] && cob[c.id][isoDia]) || null;
          var errDia = (err[c.id] && err[c.id][isoDia]) || null;
          var pessoas = ((mil[c.id] && mil[c.id][isoDia]) || []).filter(function (p) { return p.origem !== 'extra'; });
          RW.escalasCelula.preencherCelula(cel, cobDia, errDia, pessoas, maxPorUnidade[c.id]);
          sobreporCelula(cel, c.id, isoDia, { cobertura: cobDia, erro: errDia, maxUnidade: maxPorUnidade[c.id] });
          celulaDia.appendChild(bloco);
        });
      } });
      depoisDoRender();
      var wrap = el.cal.querySelector('.geral-calendario-mes');
      if (wrap) RW.escalasCelula.ativarGraficos(wrap);
    }, function () { if (el.cal && el.cal.isConnected && req === calSeq) mostrarEstadoCal(RW.mensagens.escala.falhaCarregarMes); });
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
      candidatos = r.candidatos || {};
      R().mes(iso(comp).slice(0, 8) + '01');
      renderGrade();
      analisarDiasComExtra();
    }, function () { if (!silencioso) RW.esconderVeu(conteudo); });
  }

  /* ---------- altura das barras: o pico de cada unidade (antes + extras) no mês inteiro ---------- */
  function escalaPorUnidade() {
    var picos = {};
    for (var k in coberturas) {
      var info = coberturas[k]; if (!info || !info.cobertura) continue;
      var p = k.split('|'), uid = p[0], d = p[1];
      var ens = ensaio[k];
      var dep = (ens && ens.depois && ens.depois.cobertura) ? ens.depois.cobertura : C().coberturaDepois(info.cobertura, efetivas(uid, d));
      var pico = picos[uid] || 0;
      for (var h = 0; h < dep.length; h++) { var v = Number(dep[h]) || 0; if (v > pico) pico = v; }
      picos[uid] = pico;
    }
    return picos;
  }
  function aplicarEscala(picos) {
    escalaAplicada = picos;
    if (!el.cal) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-grafico'), function (g) {
      var celula = g.closest('.escala-mes-celula');
      var pico = celula && picos[celula.dataset.unidadeId];
      if (pico) g.dataset.max = String(pico);
    });
  }
  function sincronizarEscala() {
    var picos = escalaPorUnidade();
    var ka = Object.keys(picos), kb = Object.keys(escalaAplicada);
    if (ka.length === kb.length && ka.every(function (k) { return picos[k] === escalaAplicada[k]; })) return;
    aplicarEscala(picos);
    if (el.cal && RW.escalasCelula) RW.escalasCelula.desenharGraficos(el.cal);
  }
  function rotulo(txt) { var r = RW.tpl('tpl-extra-cel-rotulo'); if (r) r.textContent = txt; return r; }

  /* o topo da célula, em grade (rótulo | barra): "antes" (sem extra) com a escala do dia embaixo e "depois"
     (com as extras; sem extra, o texto apagado). Refazer preserva a barra base e a escala do dia. */
  function montarIndicadores(celula, uid, isoDia, info, extras) {
    var real = celula.querySelector('.escala-mes-grafico:not(.escala-mes-grafico--depois)');
    var escala = C().escalaDoDia(celula);
    var caixa = celula.querySelector('.extra-cel-barras');
    if (caixa && caixa.parentNode) caixa.parentNode.removeChild(caixa);
    if (!real) { if (escala) celula.insertBefore(escala, celula.firstChild); return; }
    var ens = ensaio[chaveCel(uid, isoDia)];
    var eAntes = ens && ens.antes, eDepois = ens && ens.depois;
    var cob = info && info.cobertura, max = info && info.maxUnidade;
    /* com ensaio, o "antes" vem da base SEM extras (um erro causado pela extra não aparece aqui) */
    if (eAntes && eAntes.cobertura) { real.dataset.cob = eAntes.cobertura.join(','); real.dataset.erro = C().erroMarcas(eAntes.erro); }
    caixa = RW.tpl('tpl-extra-cel-barras');
    if (!caixa) return;
    celula.insertBefore(caixa, celula.firstChild);
    var rA = rotulo('antes'); if (rA) caixa.appendChild(rA);
    caixa.appendChild(real);
    if (escala) caixa.appendChild(escala);
    var rD = rotulo('depois'); if (rD) caixa.appendChild(rD);
    if (extras.length && cob && max > 0) {
      var g = RW.tpl('tpl-escala-mes-grafico');
      if (g) {
        g.classList.add('escala-mes-grafico--depois');
        g.dataset.cob = (eDepois && eDepois.cobertura ? eDepois.cobertura : C().coberturaDepois(cob, extras)).join(',');
        g.dataset.max = String(escalaAplicada[uid] || max);
        g.dataset.erro = C().erroMarcas(eDepois ? eDepois.erro : info.erro);
        caixa.appendChild(g);
      }
    } else {
      var vazio = RW.tpl('tpl-extra-cel-sem-extra');
      if (vazio) caixa.appendChild(vazio);
    }
  }

  /* ---------- a célula: os indicadores, as extras, a vaga apagada do A escalar e o resumo ---------- */
  function sobreporCelula(celula, uid, isoDia, info) {
    coberturas[chaveCel(uid, isoDia)] = info || null;
    Array.prototype.forEach.call(celula.querySelectorAll(':scope > .extra-vaga, :scope > .extra-cel-resumo'), function (n) { n.parentNode.removeChild(n); });
    var extras = efetivas(uid, isoDia);
    var cand = candidatos[isoDia] || [];
    montarIndicadores(celula, uid, isoDia, info, extras);
    extras.forEach(function (m) {
      var v = C().vaga(m, uid, cand, {
        aoMarcar: function (k) { marcarNaCelula(m, uid, isoDia, k); },
        aoTirar: function () { definirNaCelula(m, uid, isoDia, []); }
      });
      if (v) celula.appendChild(v);
    });
    /* quem está sendo escalado: a vaga apagada na unidade dele, nos dias em que ele está livre e sem extra */
    var sel = militarSel && C().candidato(militarSel, cand);
    if (sel && String(sel.unidade_id) === String(uid) && !temExtraNoDia(militarSel, isoDia)) {
      var f = C().vaga({ cpf: sel.cpf, grad: sel.grad, nome: sel.nome, blocos: [], fecha24: !!sel.fecha24 }, uid, cand, {
        fantasma: true, aoMarcar: function (k) { marcarNaCelula({ cpf: sel.cpf, grad: sel.grad, nome: sel.nome, blocos: [], fecha24: !!sel.fecha24 }, uid, isoDia, k); }
      });
      if (f) celula.appendChild(f);
    }
    var resumo = C().resumo(cand, extras); if (resumo) celula.appendChild(resumo);
  }
  function refazerCelula(cel) {
    var uid = parseInt(cel.getAttribute('data-unidade-id'), 10), d = cel.getAttribute('data-iso');
    sobreporCelula(cel, uid, d, coberturas[chaveCel(uid, d)]);
    aplicarBuscaCelula(cel, uid, d);
    if (RW.escalasCelula) RW.escalasCelula.desenharGraficos(cel);
  }
  function refazerDia(isoDia) {
    if (!el.cal) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-celula[data-iso="' + isoDia + '"]'), refazerCelula);
    sincronizarEscala();
  }
  function refazerTudo() {
    if (!el.cal) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-celula[data-iso]'), refazerCelula);
    sincronizarEscala();
    pintarSelecionado();
  }

  /* ---------- ensaio no motor real, por dia, com o rascunho do dia ---------- */
  function analisarDiaEnsaio(isoDia) {
    if (!RosterWork.sessao.ehAdmin() || !RW.extrajornadaDados) return;
    if (timersEnsaio[isoDia]) clearTimeout(timersEnsaio[isoDia]);
    timersEnsaio[isoDia] = setTimeout(function () {
      delete timersEnsaio[isoDia];
      var meu = seqEnsaio[isoDia] = (seqEnsaio[isoDia] || 0) + 1;
      var mudancas = R().doDia(isoDia).map(function (m) { return { cpf: m.cpf, data: m.data, unidade: m.unidade, blocos: m.blocos }; });
      RW.extrajornadaDados.analisarDia(isoDia, mudancas).then(function (r) {
        if (!r || !r.ok || !el.cal || !el.cal.isConnected || meu !== seqEnsaio[isoDia]) return;
        var ant = r.antes || {}, dep = r.depois || {};
        unidades.forEach(function (u) { ensaio[chaveCel(u.id, isoDia)] = { antes: ant[String(u.id)] || null, depois: dep[String(u.id)] || null }; });
        refazerDia(isoDia);
      });
    }, 400);
  }
  /* cada dia com extra (salva ou no rascunho) precisa do ensaio antes × depois */
  function analisarDiasComExtra() {
    var dias = {};
    for (var u in celulas) for (var d in celulas[u]) if ((celulas[u][d] || []).length) dias[d] = true;
    R().lista().forEach(function (m) { dias[m.data] = true; });
    Object.keys(dias).forEach(analisarDiaEnsaio);
  }

  /* ---------- mês compartilhado ---------- */
  function estaSujo() { return R().sujo(); }
  function descartar() { R().limpar(); }
  function renderMes() {
    comp = RW.extrajornadaMes.obter();
    R().zerar();
    carregar();
    if (RW.extrajornadaEscalar) RW.extrajornadaEscalar.sincronizarMes(comp);
  }
  function contextoNome() { return (unidades[0] && unidades[0].nome) || ''; }

  /* ---------- busca de militar (nome/CPF/RG): acende as células onde ele tira extra ---------- */
  function aplicarBusca(termo, modo) { buscaTermo = termo || ''; buscaModo = modo || 'marcar'; aplicarBuscaGrade(); }
  function aplicarBuscaCelula(cel, uid, isoDia) {
    if (!RW.busca) return;
    var tem = !!buscaTermo;
    var lista = efetivas(uid, isoDia);
    var porCpf = {};
    lista.forEach(function (m) { porCpf[m.cpf] = m; });
    cel.classList.toggle('escala-mes-celula--busca', tem && lista.some(function (m) { return RW.busca.casaMilitar(buscaTermo, m); }));
    Array.prototype.forEach.call(cel.querySelectorAll(':scope > .extra-vaga:not(.extra-vaga--fantasma)'), function (v) {
      var m = porCpf[v.dataset.cpf];
      v.classList.toggle('oculto', tem && buscaModo === 'filtrar' && !(m && RW.busca.casaMilitar(buscaTermo, m)));
    });
  }
  function aplicarBuscaGrade() {
    if (!el.cal) return;
    Array.prototype.forEach.call(el.cal.querySelectorAll('.escala-mes-celula[data-iso]'), function (cel) {
      aplicarBuscaCelula(cel, parseInt(cel.getAttribute('data-unidade-id'), 10), cel.getAttribute('data-iso'));
    });
  }

  /* ---------- montagem da aba ---------- */
  function montar(cont) {
    conteudo = cont;
    comp = RW.extrajornadaMes ? RW.extrajornadaMes.obter() : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    carregado = false;
    militarSel = null;
    el.cal = cont.querySelector('#extra-escala-cal');   // o clique na célula abre o painel do dia (escalas-painel.js)
    el.busca = cont.querySelector('#extra-busca');
    if (el.busca && RW.busca) buscaCtrl = RW.busca.criar({ caixa: el.busca, aoBuscar: aplicarBusca });
    el.modos = cont.querySelector('#extra-escala-modos');
    if (el.modos && RW.abas && !el.modos.dataset.ligado) { RW.abas.ligar(el.modos, aplicarSubModo); el.modos.dataset.ligado = '1'; }
    /* ouvintes de window ligados uma vez (o fragmento remonta a cada navegação; eles leem o estado atual) */
    if (ouvintesLigados) return;
    ouvintesLigados = true;
    /* a seleção de unidades do cabeçalho redesenha só as colunas (os dados de todas já vieram) */
    window.addEventListener('rosterwork_units_changed', function () { if (ativa && el.cal && el.cal.isConnected) renderGrade(); });
    /* o A escalar escolheu (ou soltou) um militar: pinta as células e põe a vaga apagada dele */
    window.addEventListener('rosterwork_extra_militar', function (e) {
      militarSel = (e && e.detail && e.detail.cpf) || null;
      if (!ativa || !el.cal || !el.cal.isConnected) return;
      refazerTudo();
    });
    /* o rascunho mudou (aqui ou no painel do dia): refaz o dia e ensaia de novo */
    window.addEventListener('rosterwork_extra_rascunho', function (e) {
      if (!ativa || !el.cal || !el.cal.isConnected) return;
      var d = (e && e.detail) || {};
      if (d.salvou) return;   // a página recarrega (rosterwork_escala_recarregar)
      if (d.limpou) { ensaio = {}; refazerTudo(); analisarDiasComExtra(); return; }
      if (d.data) { refazerDia(d.data); analisarDiaEnsaio(d.data); }
    });
  }

  function ativar() {
    ativa = true;
    if (el.busca) el.busca.classList.remove('oculto');
    if (el.modos) el.modos.classList.remove('oculto');
    var alvo = RW.extrajornadaMes ? RW.extrajornadaMes.obter() : comp;
    if (!carregado) { carregado = true; comp = alvo; carregar(); }
    else if (iso(alvo) !== iso(comp)) renderMes();
    else { renderGrade(); analisarDiasComExtra(); }
  }
  function desativar() {
    ativa = false;
    if (el.busca) el.busca.classList.add('oculto');
    if (el.modos) el.modos.classList.add('oculto');
    if (buscaCtrl) buscaCtrl.limpar();
    if (RW.escalasMes && el.cal) RW.escalasMes.limpar(el.cal);
  }

  /* recarrega a grade em silêncio (depois de salvar, de lançar ou de mudar as cotas) */
  function recarregar() { return carregado ? carregar(true) : Promise.resolve(); }

  RW.extrajornadaEscala = { montar: montar, ativar: ativar, desativar: desativar, recarregar: recarregar,
    contextoNome: contextoNome, estaSujo: estaSujo, descartar: descartar, renderMes: renderMes,
    nomeUnidade: nomeUnidade };
})();
