/* ============================================================
   ESCALAS — a folga no dia (o menu da linha da caixa De folga; só admin)
   Sub-tela do painel do dia: quem está de folga, o horário e a
   pergunta Folga (Manter a folga, já marcada, ou Cancelar a folga,
   com o efeito embaixo). Na folga que veio da mudança de dia
   (escalas-painel-mudar-dia.js), o subtítulo diz para onde o serviço
   passou e a pergunta é Mudança de dia (Manter a mudança, já marcada,
   ou Desfazer a mudança: o serviço volta para este dia e sai do dia
   novo). A resposta entra no rascunho do dia ao vivo
   (escalas-painel-editar.js › aoVivo; grava no Salvar do rodapé
   largo); a saída é o Voltar ao dia. O Cancelar a folga e o Desfazer a
   mudança do menu da linha abrem com essa escolha já marcada. As
   perguntas são uma peça só (perguntas), que a caixa flutuante da
   célula da grade (escalas-celula-editar.js) também usa.
   API: RosterWork.escalasPainelMilitar.abrirFolga(id, opcoes)
   (opcoes = { escolha: 'cancelar' | 'desfazer' }) e perguntas(lugar,
   id, escolha).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;   // nome único para os rádios de cada abertura

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* as bolinhas de uma pergunta: começam em "manter" ou na escolha que veio do menu da linha (que já vale), e cada
     escolha chama aoEscolher(valor) */
  function ligarRadios(caixa, aoEscolher, inicial) {
    var nome = 'escala-folga-dia-' + (++conta), comeco = inicial || 'manter';
    [].forEach.call(caixa.querySelectorAll('input[type="radio"]'), function (r) {
      r.name = nome;
      r.checked = r.value === comeco;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    if (comeco !== 'manter') aoEscolher(comeco);
  }

  /* as linhas da folga no dia (o horário) e o que vem com ela; null sem a folga */
  function daFolga(id) {
    var linhas = ((ed().dados() || {}).folgas || []).filter(function (f) { return f.lancamento_id === id; });
    if (!linhas.length) return null;
    /* mudanca = { id, para: 'DD/MM', para_iso }: a folga veio da mudança de dia */
    return { linhas: linhas, f: linhas[0], contabilizada: !!linhas[0].contabilizada, mudanca: linhas[0].mudanca || null };
  }

  /* as perguntas da folga ou da mudança, em lugar (a sub-tela daqui ou a caixa flutuante da célula da grade); escolha =
     a resposta que vem marcada ('cancelar' | 'desfazer'), que já vale. Devolve false sem a folga */
  function perguntas(lugar, id, escolha) {
    var api = ed(), d = daFolga(id), tela = RosterWork.tpl('tpl-escala-folga-dia-perguntas');
    if (!d || !tela) return false;
    var linhas = d.linhas, f = d.f, contabilizada = d.contabilizada, mudanca = d.mudanca;

    /* Cancelar a folga: ele volta ao serviço no dia. Com a extra dele por cima da folga (o banco diz as horas), a nota
       fica amarela: cancelada, ele fica de serviço e de extra no mesmo horário */
    function perguntaFolga(tela) {
      var caixa = tela.querySelector('.escala-folga-dia-pergunta');
      var efeito = caixa.querySelector('.escala-folga-dia-efeito');
      var extras = [];
      linhas.forEach(function (l) {
        (l.extra || []).forEach(function (x) { extras.push([RosterWork.horario.curta(x.hi), RosterWork.horario.curta(x.hf)]); });
      });
      var texto = msg().cancelarFolgaEfeito(nomeDe(f), contabilizada);
      efeito.querySelector('.nota-texto').textContent = extras.length ? texto + ' ' + msg().cancelarFolgaExtra(extras) : texto;
      efeito.classList.toggle('nota--alerta', extras.length > 0);
      ligarRadios(caixa, function (valor) {
        var cancelar = valor === 'cancelar';
        efeito.classList.toggle('oculto', !cancelar);
        api.aoVivo(cancelar ? function () { api.cancelarFolga(id); } : null, false);
      }, escolha === 'cancelar' ? 'cancelar' : null);
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
      }, escolha === 'desfazer' ? 'desfazer' : null);
    }

    lugar.appendChild(tela);
    if (mudanca) perguntaMudanca(tela);
    else perguntaFolga(tela);
    return true;
  }

  /* id = a folga (lancamento_id); as linhas dela no dia dão o horário. opcoes = { escolha }: a resposta que vem marcada */
  function abrirFolga(id, opcoes) {
    var api = ed(), H = api.horas, d = daFolga(id);
    if (!d) return;
    var escolha = (opcoes && opcoes.escolha) || null;   // a resposta que veio do menu da linha

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-folga-dia');
      if (!tela) return;
      var f = d.f, periodo = f.dia_inteiro ? '' : H.textoPeriodos(d.linhas);
      tela.querySelector('.escala-distribuicao-grad').textContent = f.grad || '';
      tela.querySelector('.escala-militar-nome-texto').textContent = f.nome || '';
      tela.querySelector('.escala-folga-dia-periodo').textContent = d.mudanca
        ? msg().mudancaNoDia(d.mudanca.para, periodo) : msg().folgaNoDia(periodo, d.contabilizada);
      corpo.appendChild(tela);
      perguntas(tela, id, escolha);
    }

    api.abrir(montar);
  }

  window.RosterWork.escalasPainelMilitar = { abrirFolga: abrirFolga, perguntas: perguntas };
})();
