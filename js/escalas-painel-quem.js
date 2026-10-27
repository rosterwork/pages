/* ============================================================
   ESCALAS — as escolhas do painel do dia: quem e onde
   Quem: os itens do campo de militar (o componente geral
   geral-combo-militar) para a vaga de uma função, vindos do banco
   (escala_dia_disponiveis com a vaga), em grupos com títulos fixos:
   de serviço na unidade, de serviço em outra unidade, de folga e,
   no fim e apagados, quem não pode, com o motivo. Ao lado de cada
   nome, o que ele faz hoje.
   Onde: o posto e a função, cada um numa lista; a função traz a
   situação dela no horário ("vazia", "Sd. Godoy sai").
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa: não entram na lista de funções */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function juntar(lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); }
  function minuscula(t) { return t ? t.charAt(0).toLowerCase() + t.slice(1) : ''; }

  /* ---------- Quem ---------- */

  /* as funções de quem já está na escala aqui, em texto: ["Efetivo 3 da ABT-01"] */
  function lugares(funcoes) {
    var api = ed(), nomes = [];
    (funcoes || []).forEach(function (f) {
      var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
      var t = posto ? api.funcaoNoPosto(f.funcao, posto) : msg().funcaoNoPosto(f.funcao, f.posto || '', true);
      if (nomes.indexOf(t) < 0) nomes.push(t);
    });
    return nomes;
  }

  /* o motivo de quem não pode, do código que o banco manda */
  function motivoTexto(c) {
    var mm = msg().seletorMotivo, H = ed().horas, mo = c.motivo || {};
    if (mo.codigo === 'papel') return mm.papel(mo.funcao);
    if (mo.codigo === 'horario') return mm.horario(H.textoPeriodos(mo.servico || []));
    if (mo.codigo === 'ocupado') {
      var ocupado = (mo.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
      return ocupado.length ? msg().ocupadoNoDia(ocupado) : '';
    }
    if (mo.codigo === 'regra') return mm.regra(mo.funcao);
    if (mo.codigo === 'cnh') return mm.cnh(mo.cnh);
    return '';
  }

  /* quem está de folga: a unidade e o que já ocupa o dia dele ("1ºPEL, extra das 08h às 02h"), ou o dia livre */
  function infoFolga(c) {
    var H = ed().horas;
    var ocupado = (c.ocupado || []).map(function (o) { return { hi: H.curta(o.hi), hf: H.curta(o.hf), tipo: o.tipo }; });
    var texto = c.assume ? msg().seletorAssume[c.assume] : ocupado.length ? msg().ocupadoNoDia(ocupado) : L().infoLivre;
    return (c.unidade ? c.unidade + ', ' : '') + minuscula(texto || '');
  }

  /* de serviço em outra unidade: as funções dele lá e a unidade ("Condutor da ABS-0055, 1ºPEL") */
  function infoOutra(c) {
    var fs = c.funcoes || [];
    var unidade = (fs[0] && fs[0].unidade) || c.unidade || '';
    var texto = fs.length ? juntar(lugares(fs)) : L().infoSemFuncao;
    return texto + (unidade ? ', ' + unidade : '');
  }

  /* a lista do banco em itens do campo de militar, com os títulos dos grupos; militar = quem está na linha (fica de
     fora). Cada item: { cpf, grad, nome, info, inativo, c } (c = o que o banco mandou) */
  function itensDaVaga(resp, militar, unidadeNome) {
    var aqui = [], outra = [], folga = [], naoPodem = [];
    (resp || []).forEach(function (c) {
      if (militar && c.cpf === militar.cpf) return;
      var item = { cpf: c.cpf, grad: c.grad, nome: c.nome, c: c };
      if (!c.pode) { item.inativo = true; item.info = motivoTexto(c); naoPodem.push(item); return; }
      if (c.grupo === 'folga') { item.info = infoFolga(c); folga.push(item); return; }
      if (c.grupo === 'outro_pelotao') { item.info = infoOutra(c); outra.push(item); return; }
      item.info = c.grupo === 'sem_funcao' ? L().infoSemFuncao : juntar(lugares(c.funcoes));
      aqui.push(item);
    });
    var lista = [];
    function grupo(titulo, itens) { if (itens.length) lista = lista.concat([{ titulo: titulo }], itens); }
    grupo(L().grupoAqui(unidadeNome), aqui);
    grupo(L().grupoOutra, outra);
    grupo(L().grupoFolga, folga);
    grupo(L().grupoNaoPodem, naoPodem);
    return lista;
  }

  /* ---------- Onde ---------- */

  /* lugar = onde as duas listas entram; cfg = { postos, posto, funcao, situacao(posto, nomeFuncao) -> texto,
     aoMudar(posto, funcao) }. Devolve { valor() -> { posto, funcao } } */
  function onde(lugar, cfg) {
    lugar.textContent = '';
    var el = RosterWork.tpl('tpl-escala-onde');
    if (!el) return null;
    var est = { posto: cfg.posto || null, funcao: cfg.funcao || null };
    var dPosto = el.querySelector('.escala-onde-posto'), dFuncao = el.querySelector('.escala-onde-funcao');
    var vazioPosto = dPosto.querySelector('.campo-selecao-texto').textContent;
    var vazioFuncao = dFuncao.querySelector('.campo-selecao-texto').textContent;

    function item(menu, texto, situacao, aoEscolher) {
      var it = RosterWork.tpl('tpl-escala-onde-item');
      if (!it) return;
      it.querySelector('.escala-onde-item-nome').textContent = texto;
      it.querySelector('.escala-onde-item-situacao').textContent = situacao || '';
      it.addEventListener('click', aoEscolher);
      menu.appendChild(it);
    }
    function texto(dropdown, valor, vazio) {
      var t = dropdown.querySelector('.campo-selecao-texto');
      t.textContent = valor || vazio;
      t.classList.toggle('campo-selecao-texto--vazio', !valor);
    }
    /* a "Nova função" é a próxima numeração do posto, quando ele ainda cabe gente */
    function eNova(nome) {
      return !!(est.posto && est.posto.adicionar && nome === est.posto.adicionar.nome_funcao
        && !(est.posto.funcoes || []).some(function (f) { return f.nome === nome; }));
    }
    function desenhar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var menu = dFuncao.querySelector('.dropdown-menu');
      menu.textContent = '';
      if (est.posto) {
        var nomes = [];
        (est.posto.funcoes || []).forEach(function (f) { if (!BLOQUEADAS.test(f.nome) && nomes.indexOf(f.nome) < 0) nomes.push(f.nome); });
        nomes.forEach(function (nm) { item(menu, nm, cfg.situacao(est.posto, nm), function () { est.funcao = nm; mudou(); }); });
        var nova = est.posto.adicionar && est.posto.adicionar.nome_funcao;
        if (nova && !est.posto.cheio && nomes.indexOf(nova) < 0) {
          item(menu, msg().novaFuncao(nova), msg().itemVazia, function () { est.funcao = nova; mudou(); });
        }
      }
      texto(dPosto, est.posto && est.posto.nome, vazioPosto);
      texto(dFuncao, est.funcao && (eNova(est.funcao) ? msg().novaFuncao(est.funcao) : est.funcao), vazioFuncao);
    }
    function mudou() { desenhar(); if (cfg.aoMudar) cfg.aoMudar(est.posto, est.funcao); }

    var menuPosto = dPosto.querySelector('.dropdown-menu');
    (cfg.postos || []).forEach(function (po) {
      item(menuPosto, po.nome, '', function () { est.posto = po; est.funcao = null; mudou(); });
    });
    lugar.appendChild(el);
    desenhar();
    return { valor: function () { return { posto: est.posto, funcao: est.funcao }; } };
  }

  window.RosterWork.escalasPainelQuem = { itensDaVaga: itensDaVaga, lugares: lugares, onde: onde, nomeDe: nomeDe };
})();
