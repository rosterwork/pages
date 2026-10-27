/* ============================================================
   TROCAS — o campo Militar (Solicitar, Registrar e Várias trocas)
   O comportamento é o do componente geral (geral-combo-militar:
   digita para filtrar OU escolhe no menu; no celular, só escolhe);
   aqui ficam os itens das Trocas: quem está ocupado aparece apagado
   no lugar dele, com o motivo; quem ainda não tem conta aparece
   marcado e pode ser escolhido.
   Completa RosterWork.trocasCampos com comboMilitar (carrega
   depois do trocas-solicitar-campos.js).
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  function C() { return RW.trocasCampos; }
  function txt(chave) { return RW.mensagens.trocas[chave]; }
  function molde(id) { return document.getElementById(id).content.cloneNode(true).firstElementChild; }

  /* um militar da lista: ocupado (apagado, com o motivo), sem conta (marcado) ou o comum */
  function criarItem(mil) {
    var nome = C().nomeMil(mil), item;
    if (mil.ocupado) {
      item = molde('tpl-troca-parceiro-ocupado');
      item.querySelector('.troca-parceiro-nome').textContent = nome;
      /* afastado (férias/licença/dispensa) diz o motivo; senão, já está de serviço no horário */
      item.querySelector('.troca-parceiro-motivo').textContent =
        (mil.afastamento && txt('parceiroAfastado')[mil.afastamento]) || txt('parceiroOcupado');
    } else if (mil.tem_conta === false) {
      item = molde('tpl-troca-militar-sem-conta');
      item.querySelector('.troca-parceiro-nome').textContent = nome;
    } else {
      item = molde('tpl-troca-opcao');
      item.setAttribute('role', 'option');   /* o molde é o mesmo das listas de Unidade, que não são listbox */
      item.textContent = nome;
    }
    return item;
  }

  /* O estado mostrado fica no próprio input: value = o militar escolhido; placeholder = os estados
     ("Escolha o dia antes", "Selecione", "Carregando…"). Quem guarda a escolha é o formulário:
     opcoes = { atual(), aoEscolher(mil), aoPerder(), ignorar() → [cpf] } */
  function comboMilitar(inp, menu, opcoes) {
    return RW.comboMilitar.criar(inp, menu, {
      atual: opcoes.atual, aoEscolher: opcoes.aoEscolher, aoPerder: opcoes.aoPerder, ignorar: opcoes.ignorar,
      nome: function (mil) { return C().nomeMil(mil); },
      escolhivel: function (mil) { return !mil.ocupado; },
      criarItem: criarItem,
      criarVazio: function () { return molde('tpl-troca-parceiro-vazio'); },
      limparErro: function (el) { C().limparErro(el); },
      textos: { selecione: txt('modalSelecione'), semNinguem: txt('modalParceiroVazio'), filtroVazio: txt('modalFiltroVazio') }
    });
  }

  RW.trocasCampos = RW.trocasCampos || {};
  RW.trocasCampos.comboMilitar = comboMilitar;
})();
