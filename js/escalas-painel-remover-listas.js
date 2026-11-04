/* ============================================================
   ESCALAS — as listas do Remover militar (escalas-painel-remover.js)
   A origem do serviço de cada um no dia (as partes que saem por
   aqui: pelo ciclo, pontual ou por troca; a extra fica de fora) e a
   lista Quem sai: quem está no dia aqui, com o ícone de origem à
   esquerda e só o horário à direita, e quem foi remanejado daqui
   para outra unidade (com o ícone do remanejado).
   RosterWork.escalasPainelRemoverListas.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function L() { return RosterWork.mensagens.escala.linha; }

  /* ---------- de onde ele veio ---------- */

  /* as partes do serviço dele no dia que saem por aqui, pela origem: [{ origem: 'ciclo' | 'pontual' | 'troca', periodos,
     trocaId }] (por troca, uma parte para cada troca; as horas da extra ficam de fora) */
  function partesDe(mil) {
    var api = ed(), H = api.horas;
    var pont = (api.rascunho().pontuais || []).filter(function (x) { return x.cpf === mil.cpf; })[0];
    var doPontual = pont ? H.uniao((pont.periodos || []).map(H.faixa)) : [];
    function janelas(filtro) { return H.uniao(mil.janelas.filter(filtro).map(H.faixa)); }
    var ciclo = H.menos(janelas(function (j) { return ['pontual', 'troca', 'extra'].indexOf(j.origem) < 0; }), doPontual);
    var r = [], trocas = [];
    function por(origem, faixas, trocaId) { if (faixas.length) r.push({ origem: origem, periodos: faixas.map(H.periodo), trocaId: trocaId || null }); }
    por('ciclo', ciclo);
    por('pontual', doPontual);
    mil.janelas.forEach(function (j) { if (j.origem === 'troca' && trocas.indexOf(j.troca_id) < 0) trocas.push(j.troca_id); });
    trocas.forEach(function (id) { por('troca', janelas(function (j) { return j.origem === 'troca' && j.troca_id === id; }), id); });
    return r;
  }

  /* tem o que tirar por aqui: o remanejado ou alguma parte que não é extra */
  function podeTirar(mil) { return !!mil && (!!mil.remanejado || partesDe(mil).length > 0); }

  /* a frase da folga: "Das 20h às 08h, o Cb. X fica de folga (12 horas)."; o dia todo (sem horário no texto), "em 29/10" */
  function textoFolga(periodos, nome, horas, data) {
    var t = ed().horas.textoPeriodos(periodos);
    return t ? L().folgaParte(t, nome, horas) : L().tirarFolga(nome, data, horas);
  }

  /* o pontual como está gravado (o banco diz se as horas dele foram contadas) */
  function pontualSalvo(cpf) {
    var api = ed();
    if (!api.pontualSalvo(cpf)) return null;
    return ((api.dados() || {}).pontuais || []).filter(function (x) { return x.cpf === cpf; })[0] || null;
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
    pontualSalvo: pontualSalvo, itensQuem: itensQuem };
})();
