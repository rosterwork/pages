/* ============================================================
   ESCALAS — as listas do Remover do dia (escalas-painel-remover.js)
   A origem do serviço de cada um no dia (as partes que saem por
   aqui: pelo ciclo, pontual, por troca ou o serviço que veio de
   outro dia pela mudança de dia; a extra fica de fora) e a
   lista Quem sai: quem está no dia aqui, com o ícone de origem à
   esquerda e só o horário à direita, e quem foi remanejado daqui
   para outra unidade (com o ícone do remanejado). E o pontual que
   sai (tirarDoPontual: a sub-tela e o Remover do dia) e o campo
   Motivo da folga (campoMotivo: o Remover do dia, o Mudar o horário
   do serviço e a célula da grade).
   RosterWork.escalasPainelRemoverListas.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function L() { return RosterWork.mensagens.escala.linha; }

  /* "12/11" no ano mais perto do dia ref (AAAA-MM-DD): a mudança de dia fica a poucos dias do dia novo */
  function isoDoDiaMes(ddmm, ref) {
    var p = String(ddmm || '').split('/'), r = String(ref || '').split('-');
    if (p.length !== 2 || r.length !== 3) return '';
    var alvo = new Date(+r[0], +r[1] - 1, +r[2]).getTime(), melhor = null;
    [-1, 0, 1].forEach(function (d) {
      var ano = +r[0] + d, t = new Date(ano, +p[1] - 1, +p[0]).getTime();
      if (!melhor || Math.abs(t - alvo) < Math.abs(melhor.t - alvo)) melhor = { t: t, iso: ano + '-' + p[1] + '-' + p[0] };
    });
    return melhor.iso;
  }

  /* ---------- de onde ele veio ---------- */

  /* as partes do serviço dele no dia que saem por aqui, pela origem: [{ origem: 'ciclo' | 'pontual' | 'troca' | 'mudanca',
     periodos, trocaId, mudancaId, mudancaDe, mudancaDeIso }] (por troca, uma parte para cada troca; o que veio de outro
     dia, uma parte para cada mudança de dia, com o dia de antes, "12/11" e AAAA-MM-DD; as horas da extra ficam de fora) */
  function partesDe(mil) {
    var api = ed(), H = api.horas;
    var pont = (api.rascunho().pontuais || []).filter(function (x) { return x.cpf === mil.cpf; })[0];
    var doPontual = pont ? H.uniao((pont.periodos || []).map(H.faixa)) : [];
    function janelas(filtro) { return H.uniao(mil.janelas.filter(filtro).map(H.faixa)); }
    var ciclo = H.menos(janelas(function (j) { return ['pontual', 'troca', 'extra', 'mudanca'].indexOf(j.origem) < 0; }), doPontual);
    var r = [], trocas = [], mudancas = [];
    function por(origem, faixas, mais) {
      if (!faixas.length) return;
      mais = mais || {};
      r.push({ origem: origem, periodos: faixas.map(H.periodo), trocaId: mais.trocaId || null, mudancaId: mais.mudancaId || null,
        mudancaDe: mais.mudancaDe || '', mudancaDeIso: mais.mudancaDe ? isoDoDiaMes(mais.mudancaDe, api.iso()) : '' });
    }
    por('ciclo', ciclo);
    por('pontual', doPontual);
    mil.janelas.forEach(function (j) { if (j.origem === 'troca' && trocas.indexOf(j.troca_id) < 0) trocas.push(j.troca_id); });
    trocas.forEach(function (id) { por('troca', janelas(function (j) { return j.origem === 'troca' && j.troca_id === id; }), { trocaId: id }); });
    mil.janelas.forEach(function (j) { if (j.origem === 'mudanca' && j.mudanca_id && mudancas.indexOf(j.mudanca_id) < 0) mudancas.push(j.mudanca_id); });
    mudancas.forEach(function (id) {
      var daMudanca = mil.janelas.filter(function (j) { return j.origem === 'mudanca' && j.mudanca_id === id; });
      por('mudanca', H.uniao(daMudanca.map(H.faixa)), { mudancaId: id, mudancaDe: daMudanca[0].mudanca_de });
    });
    return r;
  }

  /* tem o que tirar por aqui: o remanejado ou alguma parte que não é extra */
  function podeTirar(mil) { return !!mil && (!!mil.remanejado || partesDe(mil).length > 0); }

  /* a frase da folga: "Das 20h às 08h, o Cb. X fica de folga (12 horas)."; o dia todo (sem horário no texto), "em 29/10" */
  function textoFolga(periodos, nome, horas, data) {
    var t = ed().horas.textoPeriodos(periodos);
    return t ? L().folgaParte(t, nome, horas) : L().tirarFolga(nome, data, horas);
  }

  /* o motivo da folga dele que já está no rascunho (o campo começa com ele) */
  function motivoNoRascunho(cpf) {
    var f = (ed().rascunho().folgas || []).filter(function (x) { return x.cpf === cpf && x.motivo; })[0];
    return f ? f.motivo : '';
  }

  /* o campo Motivo da folga (molde tpl-escala-folga-motivo), no fim de onde (a caixa da pergunta, depois das respostas
     do banco de horas): valor = o de começo; aoMudar(texto) a cada letra; aoEnter(), o Enter; pequeno: o campo da célula
     da grade */
  function campoMotivo(onde, valor, aoMudar, aoEnter, pequeno) {
    var el = RosterWork.tpl('tpl-escala-folga-motivo');
    if (!el) return null;
    var inp = el.querySelector('input');
    inp.value = valor || '';
    if (pequeno) inp.classList.add('campo-entrada--pequeno');
    inp.addEventListener('input', function () { aoMudar(inp.value.trim()); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && aoEnter) { e.preventDefault(); aoEnter(); } });
    if (onde) onde.appendChild(el);
    return el;
  }

  /* o pontual como está gravado (o banco diz se as horas dele foram contadas) */
  function pontualSalvo(cpf) {
    var api = ed();
    if (!api.pontualSalvo(cpf)) return null;
    return ((api.dados() || {}).pontuais || []).filter(function (x) { return x.cpf === cpf; })[0] || null;
  }

  /* o pontual que sai (a sub-tela e o Remover do dia): todo sai (com as horas que ele somou, se o admin quis), ou só os
     horários dados */
  function tirarDoPontual(cpf, periodos, todo, estornar) {
    var api = ed(), H = api.horas, r = api.rascunho();
    if (todo) {
      var salvo = pontualSalvo(cpf);
      api.tirarPontual(cpf, !!(salvo && salvo.contabilizado) && estornar);
      return;
    }
    var pont = (r.pontuais || []).filter(function (x) { return x.cpf === cpf; })[0];
    if (!pont) return;
    var salvo2 = pontualSalvo(cpf);
    var sai = periodos.map(H.faixa), ficam = H.menos(H.uniao((pont.periodos || []).map(H.faixa)), sai);
    r.pontuais = r.pontuais.filter(function (x) { return x.cpf !== cpf; })
      .concat([{ cpf: cpf, periodos: ficam.map(H.periodo), contabilizar: !!(salvo2 && salvo2.contabilizado) }]);
    api.cortarAjustes(cpf, sai);
  }

  /* quem está no dia aqui (nas funções ou sem função), com o ícone de origem e o horário ("Das 08h às 08h"), e quem foi
     remanejado daqui para outra unidade (sem serviço aqui no dia) */
  function itensQuem() {
    var api = ed(), Q = RosterWork.escalasPainelQuem, d = api.dados() || {}, noDia = {}, lista = [], uid = String(api.unidadeId());
    (d.postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) { (f.militares || []).forEach(function (m) { noDia[m.cpf] = true; }); });
    });
    (d.sem_funcao || []).forEach(function (m) { noDia[m.cpf] = true; });
    var visto = {};
    (d.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        var rm = pm.remanejado;
        if (rm && !rm.fica && String(rm.de) === uid && !visto[pm.cpf]) {
          var mr = api.militarDoDia(pm.cpf);
          if (!mr) return;
          visto[pm.cpf] = true;
          lista.push({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, mil: mr, icone: 'icone-remanejado', info: L().remanejadoPara(rm.para_nome) });
          return;
        }
        if (!noDia[pm.cpf] || visto[pm.cpf]) return;
        var mil = api.militarDoDia(pm.cpf);
        if (!mil || !mil.janelas.length || !podeTirar(mil)) return;
        visto[pm.cpf] = true;
        var item = Q.itemServico(pm);
        item.mil = mil;
        lista.push(item);
      });
    });
    return lista;
  }

  window.RosterWork.escalasPainelRemoverListas = { partesDe: partesDe, podeTirar: podeTirar, textoFolga: textoFolga,
    motivoNoRascunho: motivoNoRascunho, campoMotivo: campoMotivo,
    pontualSalvo: pontualSalvo, tirarDoPontual: tirarDoPontual, itensQuem: itensQuem };
})();
