/* ============================================================
   ESCALAS — as listas do Remanejar militar
   (escalas-painel-remanejar.js): as unidades da companhia que você
   administra, quem está de serviço numa unidade no dia (com o ícone
   de origem e o horário) e as colocações manuais que saem com quem
   sai.
   RosterWork.escalasPainelRemanejarListas.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var unidades = null;   // a lista de unidades (buscar_unidades_ordenadas), lida uma vez

  var TIPOS_ESCALA = ['CIA', 'CIBM', 'PEL'];

  /* a lista de unidades (uma vez por sessão); null em falha */
  function lerUnidades() {
    if (unidades) return Promise.resolve(unidades);
    return RosterWork.rpc('buscar_unidades_ordenadas', {})
      .then(function (lista) { if (Array.isArray(lista)) unidades = lista; return unidades; })
      .catch(function () { return null; });
  }

  /* as outras unidades da companhia que você administra (menos esta) */
  function outrasDe(lista, companhia, uid) {
    return (lista || []).filter(function (u) {
      return TIPOS_ESCALA.indexOf(u.tipo) >= 0 && String(u.unidade_id) !== String(uid)
        && (String(u.unidade_id) === String(companhia) || String(u.unidade_pai_id) === String(companhia))
        && RosterWork.sessao.podeAdministrar('pelotao', u.unidade_id);
    });
  }

  /* quem está de serviço numa unidade no dia (nas funções ou sem função), com o ícone de origem e o horário, fora quem
     já está remanejado. dados = a leitura do dia da unidade */
  function deServico(dados) {
    var Q = RosterWork.escalasPainelQuem, noDia = {}, lista = [], visto = {};
    (dados.postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) { (f.militares || []).forEach(function (m) { noDia[m.cpf] = true; }); });
    });
    (dados.sem_funcao || []).forEach(function (m) { noDia[m.cpf] = true; });
    (dados.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        if (!noDia[pm.cpf] || visto[pm.cpf] || pm.remanejado || !(pm.disp || []).length) return;
        visto[pm.cpf] = true;
        lista.push(Q.itemServico(pm));
      });
    });
    return lista;
  }

  function temExtra(item) { return item.janelas.some(function (j) { return j.origem === 'extra'; }); }

  /* as colocações manuais de quem sai, nos postos da unidade de onde ele sai, ficam de fora */
  function cortarNaOrigem(r, cpf, dadosOrigem) {
    var daOrigem = {};
    ((dadosOrigem || {}).postos || []).forEach(function (po) { daOrigem[po.tipo + ':' + po.id] = true; });
    r.ajustes = r.ajustes.filter(function (a) {
      var chave = a.viatura_id ? 'viatura:' + a.viatura_id : 'instalacao:' + a.instalacao_id;
      return a.cpf !== cpf || !daOrigem[chave];
    });
  }

  window.RosterWork.escalasPainelRemanejarListas = { lerUnidades: lerUnidades, unidadesLidas: function () { return !!unidades; },
    outrasDe: outrasDe, deServico: deServico, temExtra: temExtra, cortarNaOrigem: cortarNaOrigem };
})();
