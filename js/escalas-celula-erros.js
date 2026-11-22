/* ============================================================
   ESCALAS — os erros da hora na dica do gráfico
   Embaixo de "8h · 7 militares" (escalas-celula.js › a dica), os
   erros que pintam aquela hora de vermelho ou amarelo, com os textos
   do painel do dia (escalas-painel.js › linhasDoAviso), com os nomes e
   sem os horários. Cada gráfico tem a sua lista: nas grades da Escala,
   a do banco (escala_erros_mes: só os erros principais, sem o abaixo
   do ideal, que o gráfico não pinta), pedida depois da grade numa
   leitura só para as células da tela com vermelho ou amarelo e lida de
   novo quando o gráfico da célula muda; como a grade, o dia que mudou
   e ainda não foi refeito vem da cópia de antes (a borda amarela), e o
   dia que o Salvar acabou de gravar, do dado real; na Extrajornada, quem desenha
   o gráfico entrega a lista (a da escala sem as extras, a de hoje ou a
   do rascunho). Sem a leitura (o banco falhou), a dica fica só com os
   militares.
   Não cria HTML (o escalas-celula.js clona o molde) nem escreve estilo.
   RosterWork.escalasCelulaErros.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var fontes = new WeakMap();   // o gráfico -> a lista dele, ou a função que a devolve (null: ainda não chegou)
  var dados = {};               // 'unidade|dia' -> { lista, marca } (marca: o gráfico da célula quando a lista foi pedida)
  var pendentes = {};           // 'unidade|dia' -> a marca do gráfico, à espera da leitura
  var agendada = false;

  function marca(g) { return (g.dataset.cob || '') + '/' + (g.dataset.erro || ''); }

  /* o gráfico com a sua lista: os erros do dia (as linhas do _escala_problemas_dia) ou a função que os devolve para a
     hora (a do depois das extras muda de hora em hora) */
  function marcar(g, fonte) { if (g) fontes.set(g, fonte); }

  /* os erros escritos como no painel do dia, com os nomes (e sem os horários na dica): [{ nivel, texto }], nivel 'erro'
     ou 'alerta', vermelhos primeiro */
  function textos(lista, semFaixas) {
    var P = RW.escalasPainel && RW.escalasPainel.pecas;
    if (!P || !P.linhasDoAviso || !lista || !lista.length) return [];
    return P.linhasDoAviso(lista, null, [], [], false, { nomes: true, semFaixas: !!semFaixas }).map(function (l) {
      return { nivel: l.def && l.def.nivel === 'alerta' ? 'alerta' : 'erro', texto: l.texto };
    });
  }

  /* a célula acabou de ser feita (escalas-celula.js › preencherCelula): com a lista entregue (a Extrajornada), o gráfico
     fica com ela; sem, os erros vêm do banco, pedidos só quando o gráfico tem vermelho ou amarelo */
  function decorar(cel, fonte) {
    var g = cel.querySelector('.escala-mes-grafico');
    if (!g) return;
    if (fonte !== undefined) { marcar(g, fonte); return; }
    if (!cel.dataset.iso || !cel.dataset.unidadeId) return;
    var k = cel.dataset.unidadeId + '|' + cel.dataset.iso, m = marca(g);
    marcar(g, function () { var d = dados[k]; return d && d.marca === m ? d.lista : null; });
    if (!/[12]/.test(g.dataset.erro || '') || (dados[k] && dados[k].marca === m)) return;
    pendentes[k] = m;
    if (agendada) return;
    agendada = true;
    setTimeout(ler, 0);
  }

  /* lê os erros das células que esperam: as dos dias certos na tela (o Salvar acabou de gravar) com o dado real, as outras
     aceitando a cópia de antes, como a grade (o dia que mudou está com a borda amarela e é lido de novo quando fica pronto) */
  function ler() {
    agendada = false;
    var marcas = pendentes, chaves = Object.keys(marcas);
    pendentes = {};
    if (!chaves.length) return;
    var at = RW.escalaAtualizando;
    var certas = chaves.filter(function (k) { var p = k.split('|'); return !!(at && at.certo(p[0], p[1])); });
    lerGrupo(chaves.filter(function (k) { return certas.indexOf(k) < 0; }), marcas, true);
    lerGrupo(certas, marcas, false);
  }

  /* uma leitura: as unidades das células, do primeiro ao último dia */
  function lerGrupo(chaves, marcas, copia) {
    if (!chaves.length) return;
    var unidades = [], ini = null, fim = null;
    chaves.forEach(function (k) {
      var p = k.split('|'), uid = +p[0], dia = p[1];
      if (unidades.indexOf(uid) < 0) unidades.push(uid);
      if (!ini || dia < ini) ini = dia;
      if (!fim || dia > fim) fim = dia;
    });
    var corpo = { p_unidade_ids: unidades, p_inicio: ini, p_fim: fim };
    /* o modo treino não pede a cópia (escalas-dados.js › carregar) */
    if (copia && !(RW.treino && RW.treino.ligado())) corpo.p_aceita_copia = true;
    RW.rpc('escala_erros_mes', corpo).then(function (r) {
      if (!r) { console.error('[Escala] Erros da dica: a leitura escala_erros_mes não veio'); return; }
      chaves.forEach(function (k) {
        var p = k.split('|');
        dados[k] = { lista: ((r.hoje || {})[p[0]] || {})[p[1]] || [], marca: marcas[k] };
      });
    }).catch(function (e) { console.error('[Escala] Erros da dica: a leitura escala_erros_mes falhou', e); });
  }

  /* os erros da hora h (0 = 08h) do gráfico, na ordem do painel do dia (vermelhos primeiro): [{ nivel, texto }], nivel
     'erro' ou 'alerta'; [] na hora verde ou sem erro; null enquanto a lista não chegou */
  function daHora(g, h) {
    var cor = (g.dataset.erro || '').charAt(h);
    if (cor !== '1' && cor !== '2') return [];
    var f = fontes.get(g), lista = typeof f === 'function' ? f(h) : f;
    if (!lista) return null;
    if (!RW.horario) return [];
    var ini = h * 60, fim = ini + 60;
    return textos(lista.filter(function (p) { var x = RW.horario.faixa(p); return x[0] < fim && x[1] > ini; }), true);
  }

  /* a escala foi salva: os erros guardados saem, e as células refeitas pedem de novo (o mesmo gráfico pode ter outro
     erro, outra pessoa sem função) */
  window.addEventListener('rosterwork_escala_salva', function () { dados = {}; });

  RW.escalasCelulaErros = {
    marcar: marcar,
    decorar: decorar,
    daHora: daHora,
    /* a cópia dos dias ficou pronta (escalas-atualizando.js): a célula refeita lê os erros de novo. chaves = ['unidade|dia'] */
    esquecer: function (chaves) { (chaves || []).forEach(function (k) { delete dados[k]; }); },
    /* os textos de uma lista de erros (o relatório do painel do dia da Extrajornada, com os horários) */
    textos: textos
  };
})();
