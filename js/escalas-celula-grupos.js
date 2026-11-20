/* ============================================================
   ESCALAS — os grupos da célula da grade (Agenda, Calendário e
   Colunas da Escala)
   O banco (ler_escala_mes) manda quem está no dia já na ordem dos
   grupos, cada um com o "grupo" dele: Guarnição, Trocas, Pontual,
   Remanejados, Extrajornada e Estágio (o riscado fica no grupo de
   onde saiu). Aqui cada grupo vira uma caixa, com a linha tracejada
   em cima; depois vêm o Sobreaviso (escalas-celula-sobreaviso.js) e
   o Fora da escala (escalas-celula-fora.js), nas mesmas caixas. A
   linha só aparece quando há outro grupo à vista antes, e o grupo
   que o filtro esvazia some com ela (escalas-mes.css). Parando o
   mouse na linha, a dica diz o grupo de baixo. Quem está afastado
   (qualquer afastamento) nunca fica na Guarnição: vai
   para o Fora da escala.
   Na página Estágios, a caixa dos estagiários vai por posto (o banco
   manda o "posto" de cada um: a viatura ou a instalação onde ele
   está), cada posto com o título (o mesmo da Op. Verão, tituloPosto);
   quem não está em nenhum fica por último, no Sem posto.
   Fora da Escala (a grade da Extrajornada usa a mesma célula), as
   linhas vão uma embaixo da outra, como sempre.
   Não cria HTML nem escreve estilo.
   RosterWork.escalasCelulaGrupos.{ naEscala, caixa, tituloPosto, preencher }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* a grade da Escala (a Extrajornada desenha a mesma célula) */
  function naEscala(celula) { return !!document.querySelector('.conteudo #escala-modos') && !celula.closest('#p3-cal'); }

  /* a caixa de um grupo (nome: a chave do grupo), com a dica da linha tracejada */
  function caixa(nome) {
    var el = RW.tpl('tpl-escala-grupo');
    if (!el) return null;
    el.setAttribute('data-grupo', nome || '');
    var dica = nome && RW.mensagens.escala.grupoCelula[nome];
    if (dica) el.querySelector('.escala-grupo-linha').setAttribute('data-dica', dica);
    return el;
  }

  /* o título de um posto na célula (sem: o Sem posto, em amarelo); a Op. Verão usa o mesmo (op-verao-celula.js) */
  function tituloPosto(nome, sem) {
    var t = RW.tpl('tpl-escala-mes-posto');
    if (!t) return null;
    t.textContent = nome;
    if (sem) t.classList.add('escala-mes-posto--sem');
    return t;
  }

  /* os estagiários do dia por posto: as viaturas na ordem delas, depois as instalações pelo nome; dentro do posto, a ordem
     do banco (a antiguidade). Quem não está em nenhum fica por último, no Sem posto */
  function porPosto(estagiarios) {
    var postos = [], de = {}, sem = [];
    estagiarios.forEach(function (p) {
      if (!p.posto) { sem.push(p); return; }
      if (!de[p.posto]) { de[p.posto] = { nome: p.posto, ordem: p.posto_ordem, lista: [] }; postos.push(de[p.posto]); }
      de[p.posto].lista.push(p);
    });
    postos.sort(function (a, b) {
      var semA = a.ordem == null ? 1 : 0, semB = b.ordem == null ? 1 : 0;
      if (semA !== semB) return semA - semB;
      if (!semA && a.ordem !== b.ordem) return a.ordem - b.ordem;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
    if (sem.length) postos.push({ nome: RW.mensagens.escala.semPosto(sem.length), sem: true, lista: sem });
    return postos;
  }

  /* na página Estágios, no lugar dos estagiários (o grupo estagio), cada posto: o título ({ titulo, sem }) e quem está nele.
     O dia sem a chave "posto" (a cópia guardada de antes) fica como sempre */
  function comPostos(pessoas) {
    var estagiarios = pessoas.filter(function (p) { return p.grupo === 'estagio'; });
    if (!estagiarios.some(function (p) { return 'posto' in p; })) return pessoas;
    var saida = [], feito = false;
    pessoas.forEach(function (p) {
      if (p.grupo !== 'estagio') { saida.push(p); return; }
      if (feito) return;
      feito = true;
      porPosto(estagiarios).forEach(function (g) {
        saida.push({ grupo: 'estagio', titulo: g.nome, sem: !!g.sem });
        Array.prototype.push.apply(saida, g.lista);
      });
    });
    return saida;
  }

  /* quem está no dia, na ordem do banco: cada grupo seguido numa caixa (curto: o posto curto das células pequenas; D: a
     dica das linhas, escalas-celula-dica.js) */
  function preencher(celula, pessoas, curto, D) {
    var escala = naEscala(celula), atual = null, nome = null;
    var estagios = escala && !!(RW.paginaAtual && RW.paginaAtual() === 'estagios');
    (estagios ? comPostos(pessoas || []) : (pessoas || [])).forEach(function (p) {
      var linha = p.titulo ? tituloPosto(p.titulo, p.sem) : RW.escalasCelula.montarPessoa(p, curto, D);
      if (!linha) return;
      if (!escala) { celula.appendChild(linha); return; }
      var grupo = p.grupo || '';
      if (!atual || grupo !== nome) {
        atual = caixa(grupo);
        nome = grupo;
        if (!atual) return;
        celula.appendChild(atual);
      }
      atual.appendChild(linha);
    });
  }

  RW.escalasCelulaGrupos = { naEscala: naEscala, caixa: caixa, tituloPosto: tituloPosto, preencher: preencher };
})();
