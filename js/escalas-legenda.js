/* ============================================================
   ESCALAS — legenda da grade (botão "Legenda" no sub-cabeçalho)
   O que cada cor, ícone e selo quer dizer, conforme o modo:
     · Mês/Semana/Colunas/Calendário: cobertura (cores do gráfico:
       completa, com ressalva, erro grave) e a faixa do horário + os
       grupos dos ícones (origem, nome riscado, função, militar,
       observações). O painel do dia abre de qualquer modo e não tem
       legenda própria, então os ícones dele também ficam aqui
     · Dia: os grupos dos ícones (o desenho é o mesmo)
     · Militares: os selos da célula e o destaque dos dias
   Os grupos compartilhados vêm do molde #tpl-escala-legenda (no
   shell): o texto fica num lugar só. Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* grupos do molde usados em cada modo (data-legenda-grupo) */
  var GRUPOS_PAINEL = {
    grade: ['origem', 'riscado', 'funcao', 'militar', 'observacoes'],
    dia: ['origem', 'funcao', 'militar', 'observacoes']
  };

  /* copia os grupos pedidos do molde */
  function clonarGruposPainel(alvo, nomes) {
    var molde = document.getElementById('tpl-escala-legenda');
    if (!molde) return;
    nomes.forEach(function (nome) {
      var grupo = molde.content.querySelector('[data-legenda-grupo="' + nome + '"]');
      if (grupo) alvo.appendChild(grupo.cloneNode(true));
    });
  }

  function clonar(alvo, id) {
    var t = document.getElementById(id);
    if (t) alvo.appendChild(t.content.cloneNode(true));
  }

  /* preenche a caixa da legenda para o modo da tela */
  function atualizar(conteudo, modo) {
    var alvo = conteudo && conteudo.querySelector('[data-legenda-conteudo]');
    if (!alvo) return;
    alvo.textContent = '';
    if (modo === 'militares') { clonar(alvo, 'tpl-escala-legenda-militares'); return; }
    if (modo === 'dia') { clonarGruposPainel(alvo, GRUPOS_PAINEL.dia); return; }
    clonar(alvo, 'tpl-escala-legenda-grade');
    clonarGruposPainel(alvo, GRUPOS_PAINEL.grade);
  }

  window.RosterWork.escalasLegenda = { atualizar: atualizar };
})();
