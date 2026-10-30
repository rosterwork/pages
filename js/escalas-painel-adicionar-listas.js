/* ============================================================
   ESCALAS — as listas do Adicionar militar (escalas-painel-adicionar.js)
   Os itens do campo de militar (geral-combo-militar), com os títulos
   dos grupos: quem entra no dia (horas livres) e no ciclo; e quem sai,
   no "No lugar de outro militar" (quem está numa função no horário
   escolhido).
   RosterWork.escalasPainelAdicionarListas.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Chefe de Socorro e Oficial de Área são do mais antigo do dia: não entram no "De quais funções" */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* no dia: quem tem horas livres, por unidade (a do painel primeiro), fora quem já entrou como pontual */
  function dia(resp) {
    var api = ed(), H = api.horas, ja = {}, lista = [], unidade = null;
    (api.rascunho().pontuais || []).forEach(function (x) { ja[x.cpf] = true; });
    (resp || []).forEach(function (m) {
      if (ja[m.cpf]) return;
      if (m.unidade_id !== unidade) { unidade = m.unidade_id; lista.push({ titulo: m.unidade || '' }); }
      var ocupado = (m.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
      lista.push({ cpf: m.cpf, grad: m.grad, nome: m.nome, info: ocupado.length ? msg().ocupadoNoDia(ocupado) : L().infoLivre, m: m });
    });
    return lista;
  }

  /* no ciclo: fora do ciclo, já no ciclo (todos clicáveis) e, apagados, o afastado e quem já tem a entrada marcada */
  function ciclo(militares) {
    var fora = [], noCiclo = [], naoPodem = [];
    (militares || []).forEach(function (m) {
      var item = { cpf: m.cpf, grad: m.grad, nome: m.nome, m: m };
      if (m.afastamento) { item.inativo = true; item.info = L().infoAfastado(m.afastamento.motivo, diaMes(m.afastamento.ate)); naoPodem.push(item); return; }
      if (m.estado === 'fora') {
        if (m.entra_em) { item.inativo = true; item.info = L().infoEntraEm(diaMes(m.entra_em)); naoPodem.push(item); return; }
        item.info = L().infoFora;
        fora.push(item);
        return;
      }
      item.info = m.serve_hoje ? L().infoServeHoje : m.ultimo_servico ? L().infoUltimo(diaMes(m.ultimo_servico)) : '';
      noCiclo.push(item);
    });
    var lista = [];
    function grupo(titulo, itens) { if (itens.length) lista = lista.concat([{ titulo: titulo }], itens); }
    grupo(L().grupoFora, fora);
    grupo(L().grupoNoCiclo, noCiclo);
    grupo(L().grupoNaoPodem, naoPodem);
    return lista;
  }

  /* quem sai: quem está numa função (fora o Chefe de Socorro e o Oficial de Área) nos horários dados, com o que ele faz
     ali. cpfEntra = quem entra (fica de fora). Itens: { cpf, grad, nome, info, s: { m, funcoes: [{ posto, funcao, x }] } },
     x = os trechos da função dentro dos horários */
  function sai(periodos, cpfEntra) {
    var api = ed(), H = api.horas, janelas = periodos.map(H.faixa), por = {}, ordem = [];
    ((api.dados() || {}).postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        if (BLOQUEADAS.test(f.nome)) return;
        (f.militares || []).forEach(function (m) {
          if (m.cpf === cpfEntra) return;
          var xs = [];
          (m.periodos || []).forEach(function (per) {
            janelas.forEach(function (w) { var x = H.cruza(w, H.faixa(per)); if (x) xs.push(x); });
          });
          if (!xs.length) return;
          if (!por[m.cpf]) { por[m.cpf] = { m: m, funcoes: [] }; ordem.push(m.cpf); }
          por[m.cpf].funcoes.push({ posto: po, funcao: f.nome, x: H.uniao(xs) });
        });
      });
    });
    return ordem.map(function (cpf) {
      var s = por[cpf];
      var lugares = s.funcoes.map(function (f) { return api.funcaoNoPosto(f.funcao, f.posto); });
      return { cpf: cpf, grad: s.m.grad, nome: s.m.nome, info: lugares.join(', '), s: s };
    });
  }

  window.RosterWork.escalasPainelAdicionarListas = { dia: dia, ciclo: ciclo, sai: sai };
})();
