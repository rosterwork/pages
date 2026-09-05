/* ============================================================
   ESCALAS — modo Militares: painel de detalhe do militar no dia
   Abre a gaveta (geral-painel) ao clicar numa célula: a situação
   do dia (serviço/folga/afastado) e, quando de serviço, o que o
   militar exerce — posto, função e origem — reusando a RPC
   ler_distribuicao_dia (filtrada pelo cpf). Só leitura. Não escreve
   estilo nem cria HTML (clona moldes / usa as peças do geral-painel).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var ORIGEM = { base: 'Escala base', troca: 'Troca de serviço', pontual: 'Inserção pontual', sistema: 'Gerado pelo sistema', extra: 'Extrajornada' };

  function soHora(t) { return t ? t.split(':')[0] : ''; }


  function dataPorExtenso(iso) {
    var p = (iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function dataCurta(iso) {
    var p = (iso || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '';
  }

  /* linha "Horário" com o(s) período(s); a seta entre as horas é o ÍCONE (nunca "→" texto) */
  function linhaHorario(periodos) {
    var linha = RosterWork.painel.criarLinha('Horário', '');
    if (!linha) return null;
    var valor = linha.querySelector('.linha-info-valor');
    valor.textContent = '';
    valor.classList.add('escala-mil-painel-horas');
    (periodos || []).forEach(function (per) {
      if (!per.inicio) return;
      var par = RosterWork.tpl('tpl-escala-mes-hora-par');
      if (!par) return;
      par.querySelector('.linha-escalado-hora-ini').textContent = soHora(per.inicio);
      var fimEl = par.querySelector('.linha-escalado-hora-fim');
      var setaEl = par.querySelector('.linha-escalado-hora-seta');
      if (per.fim) { fimEl.textContent = soHora(per.fim); }
      else { if (fimEl) fimEl.classList.add('oculto'); if (setaEl) setaEl.classList.add('oculto'); }
      valor.appendChild(par);
    });
    return linha;
  }

  function situacaoTexto(estado) {
    if (!estado) return 'Folga';
    if (estado.estado === 'afastado') return (estado.afastamento || 'Afastado') + (estado.ate ? ' até ' + dataCurta(estado.ate) : '');
    if (estado.estado === 'servico') return 'De serviço';
    if (estado.estado === 'trocado') return 'Saiu em troca';
    return 'Folga';
  }

  /* giratório do painel (reusa o molde da Distribuição) */
  function spinner() {
    var tpl = document.getElementById('tpl-escala-distribuicao-carregando');
    return tpl ? tpl.content.cloneNode(true).firstElementChild : null;
  }

  /* preenche a seção Distribuição com o que o militar exerce no dia (retorno de ler_militar_dia).
     funcoes = [{posto, funcao, origem, periodos}] · [] = de serviço sem função · null = falha */
  function preencherDistribuicao(corpoSecao, funcoes) {
    corpoSecao.textContent = '';
    if (funcoes == null) {
      corpoSecao.appendChild(RosterWork.painel.criarEstado(RosterWork.mensagens.escala.falhaCarregar));
      return;
    }
    if (!funcoes.length) {
      corpoSecao.appendChild(RosterWork.painel.criarLinha('Função', 'Sem função definida'));
      return;
    }
    funcoes.forEach(function (f) {
      corpoSecao.appendChild(RosterWork.painel.criarLinha(f.funcao || 'Função', f.posto || ''));
    });
    var origem = funcoes[0] && funcoes[0].origem;
    if (origem) corpoSecao.appendChild(RosterWork.painel.criarLinha('Origem', ORIGEM[origem] || origem));
  }

  function montar(corpo, ctx) {
    corpo.textContent = '';
    var estado = ctx.estado;
    var deServico = estado && estado.estado === 'servico';

    /* Situação do dia */
    var sec = RosterWork.painel.criarSecaoColapsavel('Situação');
    var c = sec.querySelector('.painel-secao-corpo');
    c.appendChild(RosterWork.painel.criarLinha('Unidade', ctx.unidadeNome + (ctx.cidade ? ' - ' + ctx.cidade : '')));
    c.appendChild(RosterWork.painel.criarLinha('Situação', situacaoTexto(estado)));
    if (deServico) { var lh = linhaHorario(estado.periodos); if (lh) c.appendChild(lh); }
    corpo.appendChild(sec);

    if (!deServico) return;   // folga / afastado: sem distribuição

    /* Distribuição do militar no dia (assíncrona) */
    var sec2 = RosterWork.painel.criarSecaoColapsavel('Distribuição no dia');
    var c2 = sec2.querySelector('.painel-secao-corpo');
    var sp = spinner();
    if (sp) c2.appendChild(sp);
    corpo.appendChild(sec2);

    if (!window.RosterWork.escalasDados) return;
    RosterWork.escalasDados.lerMilitarDia(ctx.cpf, ctx.iso).then(function (funcoes) {
      if (!document.contains(c2)) return;   // fechou ou trocou de célula enquanto carregava
      preencherDistribuicao(c2, funcoes);
    });
  }

  /* abre a gaveta para o militar no dia. ctx = { cpf, grad, nome, unidadeNome, cidade, iso, estado, aoFechar } */
  function abrir(ctx) {
    if (!window.RosterWork.painel) return;
    RosterWork.painel.abrir({
      titulo: ((ctx.grad ? ctx.grad + ' ' : '') + (ctx.nome || '')).trim(),
      subtitulo: dataPorExtenso(ctx.iso),
      editavel: false,   // só leitura
      aoFechar: ctx.aoFechar
    });
    var corpo = RosterWork.painel.corpo();
    if (corpo) montar(corpo, ctx);
  }

  window.RosterWork.escalasMilitaresPainel = { abrir: abrir };
})();
