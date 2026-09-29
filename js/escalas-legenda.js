/* ============================================================
   ESCALAS — legenda da grade (botão "Legenda" no sub-cabeçalho)
   O que cada cor, ícone e selo quer dizer, conforme o modo:
     · Mês/Semana/Colunas: cobertura (cores do gráfico), a linha de
       erro e a faixa do horário + os grupos da legenda do painel
       (origem, nome riscado, função fixada)
     · Dia: os grupos da legenda do painel (o desenho é o mesmo)
     · Militares: os selos da célula e o destaque dos dias
   Os grupos compartilhados vêm do molde da legenda do painel
   (#tpl-escala-legenda, no shell): o texto fica num lugar só.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* grupos do molde do painel usados em cada modo (data-legenda-grupo) */
  var GRUPOS_PAINEL = {
    grade: ['origem', 'riscado', 'funcao'],
    dia: ['origem', 'funcao', 'militar', 'observacoes']
  };

  /* copia grupos da legenda do painel; na grade, o "Aviso" não aparece na célula e sai */
  function clonarGruposPainel(alvo, nomes, semAviso) {
    var molde = document.getElementById('tpl-escala-legenda');
    if (!molde) return;
    nomes.forEach(function (nome) {
      var grupo = molde.content.querySelector('[data-legenda-grupo="' + nome + '"]');
      if (!grupo) return;
      var copia = grupo.cloneNode(true);
      if (semAviso) {
        var aviso = copia.querySelector('[data-legenda-item="aviso"]');
        if (aviso) aviso.classList.add('oculto');
      }
      alvo.appendChild(copia);
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
    if (modo === 'dia') { clonarGruposPainel(alvo, GRUPOS_PAINEL.dia, false); return; }
    clonar(alvo, 'tpl-escala-legenda-grade');
    clonarGruposPainel(alvo, GRUPOS_PAINEL.grade, true);
  }

  window.RosterWork.escalasLegenda = { atualizar: atualizar };
})();
