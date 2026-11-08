/* ============================================================
   ESCALAS — a folga no dia (o lápis da caixa De folga; só admin)
   Sub-tela do painel do dia: quem está de folga, o horário e a
   pergunta Folga (Manter a folga, já marcada, ou Cancelar a folga,
   com o efeito embaixo). Na folga que veio da mudança de dia
   (escalas-painel-mudar-dia.js), o subtítulo diz para onde o serviço
   passou e a pergunta é Mudança de dia (Manter a mudança, já marcada,
   ou Desfazer a mudança: o serviço volta para este dia e sai do dia
   novo). A resposta entra no rascunho do dia ao vivo
   (escalas-painel-editar.js › aoVivo; grava no Salvar do rodapé
   largo); a saída é o Voltar ao dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* as bolinhas de uma pergunta: começam em "manter", e cada escolha chama aoEscolher(valor) */
  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-folga-dia-' + (++conta);
    [].forEach.call(caixa.querySelectorAll('input[type="radio"]'), function (r) {
      r.name = nome;
      r.checked = r.value === 'manter';
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
  }

  /* id = a folga (lancamento_id); as linhas dela no dia dão o horário */
  function abrirFolga(id) {
    var api = ed(), H = api.horas;
    var linhas = ((api.dados() || {}).folgas || []).filter(function (f) { return f.lancamento_id === id; });
    if (!linhas.length) return;
    var f = linhas[0];
    var contabilizada = !!f.contabilizada;
    var mudanca = f.mudanca || null;   // { id, para: 'DD/MM', para_iso }: a folga veio da mudança de dia

    /* Cancelar a folga: ele volta ao serviço no dia */
    function perguntaFolga(tela) {
      var caixa = tela.querySelector('.escala-folga-dia-pergunta');
      var efeito = caixa.querySelector('.escala-folga-dia-efeito');
      efeito.querySelector('.nota-texto').textContent = msg().cancelarFolgaEfeito(nomeDe(f), contabilizada);
      ligarRadios(caixa, function (valor) {
        var cancelar = valor === 'cancelar';
        efeito.classList.toggle('oculto', !cancelar);
        api.aoVivo(cancelar ? function () { api.cancelarFolga(id); } : null, false);
      });
    }

    /* Desfazer a mudança: o serviço volta para este dia e sai do dia novo */
    function perguntaMudanca(tela) {
      tela.querySelector('.escala-folga-dia-pergunta').classList.add('oculto');
      var caixa = tela.querySelector('.escala-folga-dia-mudanca');
      caixa.classList.remove('oculto');
      var efeito = caixa.querySelector('.escala-folga-dia-mudanca-efeito');
      efeito.querySelector('.nota-texto').textContent = msg().desfazerMudancaEfeito(diaMes(api.iso()), mudanca.para);
      ligarRadios(caixa, function (valor) {
        var desfazer = valor === 'desfazer';
        efeito.classList.toggle('oculto', !desfazer);
        api.aoVivo(desfazer ? function () { api.desfazerMudanca(mudanca.id, String(mudanca.para_iso || '').slice(0, 10)); } : null, false);
      });
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-folga-dia');
      if (!tela) return;
      tela.querySelector('.escala-distribuicao-grad').textContent = f.grad || '';
      tela.querySelector('.escala-militar-nome-texto').textContent = f.nome || '';
      var periodo = f.dia_inteiro ? '' : H.textoPeriodos(linhas);
      tela.querySelector('.escala-folga-dia-periodo').textContent = mudanca
        ? msg().mudancaNoDia(mudanca.para, periodo) : msg().folgaNoDia(periodo, contabilizada);
      if (mudanca) perguntaMudanca(tela);
      else perguntaFolga(tela);
      corpo.appendChild(tela);
    }

    api.abrir(montar);
  }

  window.RosterWork.escalasPainelMilitar = { abrirFolga: abrirFolga };
})();
