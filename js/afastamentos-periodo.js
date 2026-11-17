/* ============================================================
   AFASTAMENTOS — o período da barra
   (RosterWork.afastamentosPeriodo)
   O ano (molde #tpl-afastamentos-ano), na barra da aba Ano e no
   subcabeçalho do painel do militar: as setas passam de ano, o ano
   abre a lista (do próximo ano a cinco anos atrás) e o Hoje (só fora
   do ano atual) volta a ele. O mês (molde
   #tpl-afastamentos-periodo-mes), na barra das abas Mês e Calendário:
   as setas passam de mês, o nome abre o calendário de escolher o mês
   (o da Escala, geral-calendario.js) e o Hoje (só fora do mês atual)
   volta a ele. Quem usa guarda o período e muda a tela.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function M() { return RW.mensagens.afastamentos; }
  function anoAtual() { return new Date().getFullYear(); }

  /* o seletor do ano: aoMudar(ano) a cada troca. Devolve { el, definir(ano) } */
  function seletorAno(valor, aoMudar) {
    var el = RW.tpl('tpl-afastamentos-ano');
    if (!el) return null;
    var nome = el.querySelector('[data-ano-nome]');
    var lista = el.querySelector('[data-ano-lista]');
    var hoje = el.querySelector('[data-ano-hoje]');
    var atual = valor;
    function pintar() {
      nome.textContent = String(atual);
      hoje.classList.toggle('oculto', atual === anoAtual());
      lista.textContent = '';
      for (var a = anoAtual() + 1; a >= anoAtual() - 5; a--) {
        var item = RW.tpl('tpl-afastamentos-ano-item');
        if (!item) return;
        item.textContent = String(a);
        item.classList.toggle('dropdown-item--ativo', a === atual);
        item.addEventListener('click', mudar.bind(null, a));
        lista.appendChild(item);
      }
    }
    function mudar(novo) {
      if (novo === atual) return;
      atual = novo;
      pintar();
      aoMudar(atual);
    }
    el.querySelector('[data-ano-anterior]').addEventListener('click', function () { mudar(atual - 1); });
    el.querySelector('[data-ano-proximo]').addEventListener('click', function () { mudar(atual + 1); });
    hoje.addEventListener('click', function () { mudar(anoAtual()); });
    pintar();
    return { el: el, definir: function (a) { atual = a; pintar(); } };
  }

  /* o seletor do mês. opcoes = { obter() -> { ano, mes } (o mês na tela), irPara(ano, mes) (o mês fora do ano passa de
     ano) }. Devolve { el, pintar() } */
  function seletorMes(opcoes) {
    var el = RW.tpl('tpl-afastamentos-periodo-mes');
    if (!el) return null;
    var nome = el.querySelector('[data-mes-nome]');
    var hoje = el.querySelector('[data-mes-hoje]');
    function vai(passo) { var p = opcoes.obter(); opcoes.irPara(p.ano, p.mes + passo); }
    el.querySelector('[data-mes-anterior]').addEventListener('click', function () { vai(-1); });
    el.querySelector('[data-mes-proximo]').addEventListener('click', function () { vai(1); });
    hoje.addEventListener('click', function () { opcoes.irPara(anoAtual(), new Date().getMonth()); });
    if (RW.calendario) {
      RW.calendario.ligar(nome, {
        ancora: el,
        obterModo: function () { return 'mes'; },
        obterData: function () { var p = opcoes.obter(); return new Date(p.ano, p.mes, 1); },
        aoEscolher: function (data) { opcoes.irPara(data.getFullYear(), data.getMonth()); }
      });
    }
    return {
      el: el,
      pintar: function () {
        var p = opcoes.obter();
        nome.textContent = M().periodoMes(p.mes, p.ano);
        hoje.classList.toggle('oculto', p.ano === anoAtual() && p.mes === new Date().getMonth());
      }
    };
  }

  window.RosterWork.afastamentosPeriodo = { seletorAno: seletorAno, seletorMes: seletorMes, anoAtual: anoAtual };
})();
