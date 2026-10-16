/* ============================================================
   EXTRAJORNADA — aba Relatórios (administrador)
   À esquerda, as ETAPAS do mês: 1. Solicitações, 2. Termos e cotas,
   3. Distribuição e lançamento (com o Relatório inicial, que cada
   lançamento refaz), 4. Ajustes do mês (quantos até agora) e
   5. Relatório de ajustes (liberado a partir do dia 1º do mês
   seguinte e não sai mais daqui). Feita = marca verde; a etapa de
   agora = número escuro, e o selo da barra diz qual é. À direita, a
   PRÉVIA do relatório de ajustes: quem mudou desde o lançamento (era
   riscado, ficou, motivo e quem ajustou) e as cotas que mudaram.
   Os PDFs ficam em extrajornada-relatorios-pdf.js.
   Não cria HTML (clona moldes) nem escreve estilo (só classList).
   RosterWork.extrajornadaRelatorios.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var INI = ['', '08h', '14h', '20h', '02h'];
  var FIM = ['', '14h', '20h', '02h', '08h'];
  var ETAPAS = ['solicitacoes', 'termos', 'montagem', 'ajustes', 'relatorio'];

  var el = {};
  var naAba = false;
  var comp = null;
  var seq = 0;
  var dados = null;

  function msg() { return RW.mensagens.extrajornada.relatorios; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ddmm(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function brParaDdmm(s) { return String(s || '').slice(0, 5); }
  /* dia N de um mês (deslocado em meses a partir da competência), em DD/MM */
  function diaDoMes(n, desloc) {
    var d = new Date(comp.getFullYear(), comp.getMonth() + desloc, 1);
    var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return String(Math.min(n, ultimo)).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  /* ---------- etapas ---------- */
  function estados(r) {
    var hoje = iso(new Date());
    var e = {};
    /* depois do lançamento (ou com o mês já começado) as solicitações estão encerradas */
    var encerradas = hoje > r.solicitacoes.fim || r.lancamento.lancado || r.iniciado;
    e.solicitacoes = encerradas ? 'feita' : (hoje >= r.solicitacoes.inicio ? 'atual' : 'futura');
    var termosOk = r.lancamento.lancado || (e.solicitacoes === 'feita' && r.termos.pendentes === 0 && r.cotas.repartidas > 0);
    e.termos = termosOk ? 'feita' : (e.solicitacoes === 'feita' ? 'atual' : 'futura');
    e.montagem = r.lancamento.lancado ? 'feita' : (e.termos === 'feita' ? 'atual' : 'futura');
    e.ajustes = r.terminou ? 'feita' : (r.iniciado ? 'atual' : 'futura');
    e.relatorio = r.terminou ? 'atual' : 'futura';
    return e;
  }

  function desenharEtapas(r) {
    var e = estados(r);
    ETAPAS.forEach(function (n) {
      var li = el.lista.querySelector('[data-etapa="' + n + '"]');
      if (!li) return;
      li.classList.toggle('extra-rel-etapa--feita', e[n] === 'feita');
      li.classList.toggle('extra-rel-etapa--atual', e[n] === 'atual');
    });
    var atual = ETAPAS.filter(function (n) { return e[n] === 'atual'; })[0] || 'solicitacoes';
    el.selo.textContent = msg().etapaAtual[atual];
    el.selo.classList.toggle('oculto', !naAba);

    var s = r.solicitacoes;
    el.solicitacoes.textContent = msg().solicitacoes(ddmm(s.inicio), ddmm(s.fim), s.voluntarios, s.nao_voluntarios, s.sem_resposta);
    el.termos.textContent = msg().termos(r.termos.recebidos, r.termos.pendentes, r.cotas.recebidas, r.cotas.repartidas);
    var l = r.lancamento;
    el.montagem.textContent = (l.lancado ? msg().lancado(l.em, l.por, l.reabrir_ate, r.iniciado) : msg().naoLancado(l.reabrir_ate))
      + (r.prazos.planejamento_dia ? msg().prazoEnvio(diaDoMes(r.prazos.planejamento_dia, -1)) : '');
    el.inicial.disabled = !l.lancado;
    el.ajustesQtd.textContent = msg().ajustesQtd(r.ajustes_qtd || 0);
    el.ajustesQtd.classList.toggle('oculto', !(l.lancado && r.iniciado));
    el.ajustes.textContent = msg().ajustesPeriodo(ddmm(r.competencia), ddmm(r.mes_fim));
    el.relatorio.textContent = (r.terminou ? msg().relatorioPronto(ddmm(r.libera_ajustes)) : msg().relatorioDisponivel(ddmm(r.libera_ajustes)))
      + (r.prazos.relatorio_dia ? msg().prazoEnvio(diaDoMes(r.prazos.relatorio_dia, 1)) : '');
    el.ajustesPdf.disabled = !(r.terminou && l.lancado);
  }

  /* ---------- prévia do relatório de ajustes ---------- */
  function horario(r) { return ddmm(r.data) + ', ' + INI[r.b_ini] + ' às ' + FIM[r.b_fim]; }
  function celulaHorarios(td, lista, vazio) {
    td.textContent = '';
    if (!lista.length) { td.textContent = vazio; td.classList.add('extra-rel-sem'); return; }
    lista.forEach(function (x) {
      var h = RW.tpl('tpl-extra-rel-horario');
      if (!h) return;
      h.textContent = horario(x);
      td.appendChild(h);
    });
  }
  function soma(lista) { return lista.reduce(function (s, x) { return s + (x.b_fim - x.b_ini + 1); }, 0); }

  function desenharPrevia(r) {
    el.previaTitulo.textContent = r.terminou ? msg().relatorioFinal : msg().previa;
    el.comparado.textContent = r.lancamento.lancado ? msg().comparado(brParaDdmm(r.lancamento.data)) : '';
    el.linhas.textContent = '';
    var unidades = {};
    (r.unidades || []).forEach(function (u) { unidades[u.unidade_id] = u.nome; });
    var mud = RW.extrajornadaRelatoriosPdf ? RW.extrajornadaRelatoriosPdf.mudancas(r) : {};
    var ajustes = {};
    (r.ajustes || []).forEach(function (a) { ajustes[a.cpf] = a; });
    var cotas = [];
    var n = 0;
    (r.militares || []).forEach(function (m) {
      var x = mud[m.cpf];
      if (!x || !r.lancamento.lancado) return;
      var tr = RW.tpl('tpl-extra-rel-linha');
      if (!tr) return;
      n++;
      tr.querySelector('.extra-vol-grad').textContent = m.grad || '';
      tr.querySelector('.extra-vol-nome').textContent = m.nome || '';
      tr.querySelector('.extra-rel-unidade').textContent = unidades[m.unidade_id] || '';
      celulaHorarios(tr.querySelector('.extra-rel-era'), x.era, msg().nova);
      celulaHorarios(tr.querySelector('.extra-rel-ficou'), x.ficou, msg().retirada);
      var a = ajustes[m.cpf];
      tr.querySelector('.extra-rel-motivo').textContent = (a && a.motivo) || msg().semMotivo;
      tr.querySelector('.extra-rel-autor').textContent = a ? (a.autor || '') + ', ' + (a.quando || '') : '';
      tr.querySelector('.extra-rel-vezes').textContent = a && a.vezes > 1 ? msg().mudouVezes(a.vezes) : '';
      el.linhas.appendChild(tr);
      var de = soma(x.era), para = soma(x.ficou);
      if (de !== para) cotas.push(msg().cotasMudaram(((m.grad || '') + ' ' + (m.nome || '')).trim(), de, para));
    });
    el.vazio.textContent = !r.lancamento.lancado ? msg().semLancamento : msg().semAjustes;
    el.vazio.classList.toggle('oculto', n > 0);
    el.tabela.classList.toggle('oculto', n === 0);
    el.cotas.textContent = cotas.length ? cotas.join(' ') : msg().cotasIguais;
  }

  function carregar() {
    if (!naAba || !RW.extrajornadaDados || !el.lista || !el.lista.isConnected) return;
    var meu = ++seq;
    var conteudo = el.lista.closest('.pagina');
    if (RW.mostrarVeu && conteudo) RW.mostrarVeu(conteudo);
    RW.extrajornadaDados.carregarRelatorios(iso(comp)).then(function (r) {
      if (RW.esconderVeu && conteudo) RW.esconderVeu(conteudo);
      if (meu !== seq || !naAba) return;
      if (!r || !r.ok) { dados = null; RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falha }); return; }
      dados = r;
      el.mes.textContent = MESES[comp.getMonth()];
      desenharEtapas(r);
      desenharPrevia(r);
    }, function () {
      if (RW.esconderVeu && conteudo) RW.esconderVeu(conteudo);
    });
  }

  function gerar(botao, qual) {
    if (!dados || !RW.extrajornadaRelatoriosPdf) return;
    RW.iniciarCarregando(botao);
    RW.extrajornadaRelatoriosPdf[qual](dados).then(function () { RW.pararCarregando(botao); }, function () {
      RW.pararCarregando(botao);
      RW.avisar({ tipo: 'erro', mensagem: msg().falhaPdf });
    });
  }

  function montar(cont) {
    el.selo = cont.querySelector('#extra-rel-etapa');
    el.mes = cont.querySelector('#extra-rel-mes');
    el.lista = cont.querySelector('.extra-rel-lista');
    el.solicitacoes = cont.querySelector('#extra-rel-solicitacoes');
    el.termos = cont.querySelector('#extra-rel-termos');
    el.montagem = cont.querySelector('#extra-rel-montagem');
    el.inicial = cont.querySelector('#extra-rel-inicial');
    el.ajustesQtd = cont.querySelector('#extra-rel-ajustes-qtd');
    el.ajustes = cont.querySelector('#extra-rel-ajustes');
    el.relatorio = cont.querySelector('#extra-rel-relatorio');
    el.ajustesPdf = cont.querySelector('#extra-rel-ajustes-pdf');
    el.previaTitulo = cont.querySelector('#extra-rel-previa-titulo');
    el.comparado = cont.querySelector('#extra-rel-comparado');
    el.linhas = cont.querySelector('#extra-rel-linhas');
    el.tabela = cont.querySelector('.extra-rel-tabela');
    el.vazio = cont.querySelector('#extra-rel-vazio');
    el.cotas = cont.querySelector('#extra-rel-cotas');
    dados = null;
    if (el.inicial) el.inicial.addEventListener('click', function () { gerar(el.inicial, 'inicial'); });
    if (el.ajustesPdf) el.ajustesPdf.addEventListener('click', function () { gerar(el.ajustesPdf, 'ajustes'); });
  }
  function ativar() { naAba = true; comp = RW.extrajornadaMes.obter(); carregar(); }
  function desativar() { naAba = false; if (el.selo) el.selo.classList.add('oculto'); }
  function renderMes() { comp = RW.extrajornadaMes.obter(); carregar(); }

  RW.extrajornadaRelatorios = { montar: montar, ativar: ativar, desativar: desativar, renderMes: renderMes, recarregar: carregar };
})();
