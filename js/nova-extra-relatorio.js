/* ============================================================
   EXTRAJORNADA — passo 5: Relatórios
   À esquerda, as ETAPAS do
   mês em ordem (Pedidos, Termos e cotas, Distribuição e lançamento
   com o Relatório inicial, Ajustes do mês e Relatório de ajustes,
   liberado a partir do dia 1º do mês seguinte); feita = marca verde,
   a de agora = número escuro. À direita, a PRÉVIA do relatório de
   ajustes: quem mudou desde o lançamento (era riscado, ficou, motivo
   e quem ajustou) e as cotas que mudaram.
   Cada etapa tem o seu Imprimir (pedidos, termos e cotas, relatório
   inicial e relatório final), que abre o painel Imprimir relatório
   (nova-extra-imprimir.js), liberado quando o relatório já pode sair.
   A prévia compara os trechos da foto do lançamento com os de agora
   (mudancas, por militar: o que saiu e o que entrou).
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.novaExtraRelatorio.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var INI = ['', '08h', '14h', '20h', '02h'];
  var FIM = ['', '14h', '20h', '02h', '08h'];
  var ETAPAS = ['solicitacoes', 'termos', 'montagem', 'ajustes', 'relatorio'];

  var el = null, r = null, ligado = null;
  var bruto = null;   // o mês como veio do banco (nova_extra_mes), para o painel Imprimir relatório

  function msg() { return RW.mensagens.extrajornada.relatorios; }
  function q(sel) { return el.querySelector(sel); }
  function ddmm(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function dataDe(k) { return new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)); }

  /* as extras { cpf, data, unidade, blocos } em trechos contínuos (a mesma conta dos PDFs) */
  function trechos(lista) { return RW.novaExtraRelatoriosPdf.trechos(lista); }

  /* quem mudou desde o lançamento: o que saiu (era) e o que entrou (ficou), por militar, trecho a trecho */
  function mudancas(dados) {
    var chave = function (x) { return x.cpf + '|' + x.data + '|' + x.uid + '|' + x.b_ini + '|' + x.b_fim; };
    var naBase = {}, noAtual = {}, por = {};
    (dados.base || []).forEach(function (x) { naBase[chave(x)] = true; });
    (dados.atual || []).forEach(function (x) { noAtual[chave(x)] = true; });
    (dados.base || []).forEach(function (x) { if (!noAtual[chave(x)]) (por[x.cpf] = por[x.cpf] || { era: [], ficou: [] }).era.push(x); });
    (dados.atual || []).forEach(function (x) { if (!naBase[chave(x)]) (por[x.cpf] = por[x.cpf] || { era: [], ficou: [] }).ficou.push(x); });
    return por;
  }

  /* os dados do mês no formato dos relatórios (as etapas, a prévia e os PDFs) */
  function montarDados(d) {
    var comp = d.competencia, inicio = dataDe(comp);
    var fim = iso(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0));
    var proximo = iso(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1));
    var vespera = iso(new Date(inicio.getFullYear(), inicio.getMonth(), 0));
    var vols = d.militares.filter(function (m) { return m.voluntario; });
    var cia = d.unidades.filter(function (u) { return u.pelotao === false; })[0];
    var ajustes = {};
    /* os ajustes vêm do mais novo para o mais velho: o primeiro de cada militar é o último que ele teve */
    d.ajustes.forEach(function (j) {
      var x = ajustes[j.cpf];
      if (!x) ajustes[j.cpf] = { cpf: j.cpf, motivo: j.motivo, autor: j.autor, quando: j.em, vezes: 1 };
      else { x.vezes++; if (!x.motivo && j.motivo) x.motivo = j.motivo; }
    });
    var l = d.lancamento;
    return {
      competencia: comp, mes_fim: fim, libera_ajustes: proximo,
      iniciado: !!d.iniciado, terminou: d.hoje >= proximo,
      prazos: {},
      solicitacoes: {
        inicio: d.mes.abre, fim: d.mes.fecha, voluntarios: vols.length,
        nao_voluntarios: d.militares.filter(function (m) { return m.respondeu && !m.voluntario; }).length,
        sem_resposta: d.militares.filter(function (m) { return !m.respondeu; }).length
      },
      termos: { recebidos: vols.filter(function (m) { return m.termo; }).length, pendentes: vols.filter(function (m) { return !m.termo; }).length },
      cotas: {
        recebidas: d.mes.repartir_por === 'por_unidade'
          ? Object.keys(d.mes.cotas_unidades || {}).reduce(function (s, k) { return s + (+d.mes.cotas_unidades[k] || 0); }, 0)
          : (d.mes.cotas_recebidas || 0),
        repartidas: vols.reduce(function (s, m) { return s + (m.concedidas || 0); }, 0)
      },
      lancamento: { lancado: !!l, em: l ? l.lancado_em : '', por: l ? l.por : '', data: l ? l.lancado_em : '', reabrir_ate: ddmm(vespera) },
      ajustes_qtd: d.ajustes.length,
      unidades: d.unidades.map(function (u) {
        return { unidade_id: u.id, nome: u.nome, nome_completo: '', cidade: u.cidade, tipo: u.pelotao === false ? 'CIA' : 'PEL', pai: cia ? cia.nome : '' };
      }),
      militares: d.militares.map(function (m) { return { cpf: m.cpf, grad: m.grad, nome: m.nome, rg: m.rg, unidade_id: m.unidade_id }; }),
      base: trechos(l ? l.foto : []),
      atual: trechos(d.alocacoes),
      ajustes: Object.keys(ajustes).map(function (k) { return ajustes[k]; })
    };
  }

  /* ---------- etapas ---------- */
  function estados(dados, hoje) {
    var e = {};
    var encerradas = hoje > dados.solicitacoes.fim || dados.lancamento.lancado || dados.iniciado;
    e.solicitacoes = encerradas ? 'feita' : (hoje >= dados.solicitacoes.inicio ? 'atual' : 'futura');
    var termosOk = dados.lancamento.lancado || (e.solicitacoes === 'feita' && dados.termos.pendentes === 0 && dados.cotas.repartidas > 0);
    e.termos = termosOk ? 'feita' : (e.solicitacoes === 'feita' ? 'atual' : 'futura');
    e.montagem = dados.lancamento.lancado ? 'feita' : (e.termos === 'feita' ? 'atual' : 'futura');
    e.ajustes = dados.terminou ? 'feita' : (dados.iniciado ? 'atual' : 'futura');
    e.relatorio = dados.terminou ? 'atual' : 'futura';
    return e;
  }

  function desenharEtapas(dados, hoje) {
    var e = estados(dados, hoje);
    ETAPAS.forEach(function (n) {
      var li = q('#p5-lista [data-etapa="' + n + '"]');
      li.classList.toggle('nova-extra-rel-etapa--feita', e[n] === 'feita');
      li.classList.toggle('nova-extra-rel-etapa--atual', e[n] === 'atual');
    });
    var s = dados.solicitacoes, l = dados.lancamento;
    q('#p5-solicitacoes').textContent = msg().solicitacoes(ddmm(s.inicio), ddmm(s.fim), s.voluntarios, s.nao_voluntarios, s.sem_resposta);
    q('#p5-termos').textContent = msg().termos(dados.termos.recebidos, dados.termos.pendentes, dados.cotas.recebidas, dados.cotas.repartidas);
    q('#p5-montagem').textContent = l.lancado ? msg().lancado(l.em, l.por, l.reabrir_ate, dados.iniciado) : msg().naoLancado(l.reabrir_ate);
    /* o Imprimir de cada etapa, liberado quando o relatório já pode sair */
    Array.prototype.forEach.call(el.querySelectorAll('#p5-lista [data-relatorio]'), function (b) {
      b.disabled = !!RW.novaExtraImprimir.motivo(b.getAttribute('data-relatorio'), bruto);
    });
    var qtd = q('#p5-ajustes-qtd');
    qtd.textContent = msg().ajustesQtd(dados.ajustes_qtd);
    qtd.classList.toggle('oculto', !(l.lancado && dados.iniciado));
    q('#p5-ajustes').textContent = RW.mensagens.novaExtra.org.relAjustesPeriodo(ddmm(dados.competencia), ddmm(dados.mes_fim));
    q('#p5-relatorio').textContent = dados.terminou ? msg().relatorioPronto(ddmm(dados.libera_ajustes)) : msg().relatorioDisponivel(ddmm(dados.libera_ajustes));
  }

  /* ---------- prévia do relatório de ajustes ---------- */
  function celulaHorarios(td, lista, vazio) {
    td.textContent = '';
    if (!lista.length) { td.textContent = vazio; td.classList.add('nova-extra-rel-sem'); return; }
    lista.forEach(function (x) {
      var h = RW.tpl('tpl-ne-rel-horario');
      h.textContent = ddmm(x.data) + ', ' + INI[x.b_ini] + ' às ' + FIM[x.b_fim];
      td.appendChild(h);
    });
  }
  function soma(lista) { return lista.reduce(function (s, x) { return s + (x.b_fim - x.b_ini + 1); }, 0); }

  function desenharPrevia(dados) {
    q('#p5-previa-titulo').textContent = dados.terminou ? RW.mensagens.novaExtra.org.relFinal : RW.mensagens.novaExtra.org.relPrevia;
    q('#p5-comparado').textContent = dados.lancamento.lancado ? msg().comparado(String(dados.lancamento.data).slice(0, 5)) : '';
    var linhas = q('#p5-linhas');
    linhas.textContent = '';
    var unidades = {};
    dados.unidades.forEach(function (u) { unidades[u.unidade_id] = u.nome; });
    var mud = mudancas(dados);
    var ajustes = {};
    dados.ajustes.forEach(function (a) { ajustes[a.cpf] = a; });
    var cotas = [], n = 0;
    dados.militares.forEach(function (m) {
      var x = mud[m.cpf];
      if (!x || !dados.lancamento.lancado) return;
      var tr = RW.tpl('tpl-ne-rel-linha');
      n++;
      tr.querySelector('small').textContent = m.grad || '';
      tr.querySelector('b').textContent = m.nome || '';
      tr.querySelector('.nova-extra-rel-unidade').textContent = unidades[m.unidade_id] || '';
      celulaHorarios(tr.querySelector('.nova-extra-rel-era'), x.era, msg().nova);
      celulaHorarios(tr.querySelector('.nova-extra-rel-ficou'), x.ficou, msg().retirada);
      var a = ajustes[m.cpf];
      tr.querySelector('.nova-extra-rel-motivo').textContent = (a && a.motivo) || msg().semMotivo;
      tr.querySelector('.nova-extra-rel-autor').textContent = a ? (a.autor || '') + ', ' + (a.quando || '') : '';
      tr.querySelector('.nova-extra-rel-vezes').textContent = a && a.vezes > 1 ? msg().mudouVezes(a.vezes) : '';
      linhas.appendChild(tr);
      var de = soma(x.era), para = soma(x.ficou);
      if (de !== para) cotas.push(msg().cotasMudaram(((m.grad || '') + ' ' + (m.nome || '')).trim(), de, para));
    });
    var vazio = q('#p5-vazio');
    vazio.textContent = !dados.lancamento.lancado ? msg().semLancamento : msg().semAjustes;
    vazio.classList.toggle('oculto', n > 0);
    q('#p5-tabela').classList.toggle('oculto', n === 0);
    q('#p5-cotas').textContent = cotas.length ? cotas.join(' ') : msg().cotasIguais;
  }

  function mostrar(d, conteudo) {
    el = conteudo;
    if (ligado !== el) {
      ligado = el;
      Array.prototype.forEach.call(el.querySelectorAll('#p5-lista [data-relatorio]'), function (b) {
        b.addEventListener('click', function () { RW.novaExtraImprimir.abrir(b.getAttribute('data-relatorio'), bruto, q('#nova-extra-mes').textContent); });
      });
    }
    bruto = d;
    r = montarDados(d);
    q('#p5-mes').textContent = MESES[dataDe(d.competencia).getMonth()];
    desenharEtapas(r, d.hoje);
    desenharPrevia(r);
  }

  RW.novaExtraRelatorio = { mostrar: mostrar };
})();
