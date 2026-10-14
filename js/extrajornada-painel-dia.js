/* ============================================================
   EXTRAJORNADA — painel do dia (gaveta), aba Escala
   Clicar numa célula da grade abre a gaveta geral-painel (a mesma da
   Escala), com duas abas, só de leitura (a escala se edita na Escala):
     • Dia          — no topo os AVISOS antes/depois (o que o extra resolveu ✓
                      e o que restou ▲) e, abaixo, a DISTRIBUIÇÃO "depois" (com
                      os extras), por ENSAIO no motor (RPC extra_distribuicao_dia).
     • Extrajornada — quem está de extra no dia nesta unidade (a mesma aba do
                      painel da Escala: escalas-painel-extra).
   A lista do dia é a mesma do Dia da Escala (escalas-painel-editar, só de
   leitura, com o dia já lido); os avisos reusam RosterWork.escalasPainel.pecas
   e os moldes tpl-escala-* (no shell).
   Não cria HTML (clona moldes) nem escreve estilo (só classList/textContent).
   RosterWork.extrajornadaPainelDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var celulaSel = null;
  var pCtx = null;   // { uid, iso, secao } do dia aberto

  function dataPorExtenso(iso) {
    var p = (iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function desmarcar() {
    if (RW.escalasPainelExtra) RW.escalasPainelExtra.reset();
    if (RW.escalasPainelEditar) RW.escalasPainelEditar.reset();
    if (celulaSel) celulaSel.classList.remove('escala-mes-celula--selecionada');
    celulaSel = null;
    pCtx = null;
  }

  function mostrarCarregando(corpo) {
    corpo.textContent = '';
    var c = RW.tpl('tpl-escala-distribuicao-carregando');
    if (c) corpo.appendChild(c);
  }
  function mostrarEstado(corpo, texto) {
    corpo.textContent = '';
    var e = RW.tpl('tpl-escala-distribuicao-estado');
    if (e) { e.textContent = texto; corpo.appendChild(e); }
  }
  function msgFalha() { return (RW.mensagens.escala && RW.mensagens.escala.falhaCarregar) || 'Falha ao carregar.'; }

  /* ---------- avisos antes/depois (resolvido pelo extra / restou) ---------- */

  function avisosDe(estado, uid) {
    return (estado && estado[uid] && estado[uid].avisos) || [];
  }
  function chave(a) { return a.tipo + '|' + (a.onde || ''); }

  function textoAviso(a) {
    var labels = (RW.mensagens && RW.mensagens.extrajornada && RW.mensagens.extrajornada.avisosGrade) || {};
    if (a.tipo === 'sem_funcao') {
      var n = a.quantidade || 1;
      return n === 1 ? (labels.sem_funcao || 'Aviso') : String(labels.sem_funcao_plural || '').replace('{n}', n);
    }
    var base = labels[a.tipo] || 'Aviso';
    return a.onde ? (base + ': ' + a.onde) : base;
  }

  /* uma linha de aviso: modo 'ok' (resolvido pelo extra), 'alerta' (âmbar) ou 'erro' (vermelho) */
  function linhaAviso(a, modo) {
    var pecas = RW.escalasPainel && RW.escalasPainel.pecas;
    var linha = RW.tpl('tpl-extra-painel-aviso');
    if (!linha) return null;
    linha.classList.add('extra-painel-aviso--' + modo);
    if (pecas) pecas.definirIcone(linha.querySelector('.extra-painel-aviso-icone'), modo === 'ok' ? 'icone-check' : 'icone-alerta');
    linha.querySelector('.extra-painel-aviso-texto').textContent = textoAviso(a);
    if (modo === 'ok') linha.querySelector('.extra-painel-aviso-marca').classList.remove('oculto');
    return linha;
  }

  function renderAvisos(corpo, uid, resp) {
    var antes = avisosDe(resp.antes, uid);
    var depois = avisosDe(resp.depois, uid);
    var chavesDepois = {};
    depois.forEach(function (a) { chavesDepois[chave(a)] = true; });
    var resolvidos = antes.filter(function (a) { return !chavesDepois[chave(a)]; });   // estava no antes, sumiu no depois
    if (!resolvidos.length && !depois.length) return;   // sem avisos: some (como na grade)
    var caixa = RW.painel.criarCaixa((RW.mensagens.extrajornada && RW.mensagens.extrajornada.avisosTitulo) || 'Avisos');
    if (!caixa) return;
    resolvidos.forEach(function (a) { var l = linhaAviso(a, 'ok'); if (l) caixa.appendChild(l); });
    depois.forEach(function (a) { var l = linhaAviso(a, a.necessita === 'erro' ? 'erro' : 'alerta'); if (l) caixa.appendChild(l); });
    corpo.insertBefore(caixa, corpo.firstChild);   // fica no topo, acima da lista do dia
  }

  /* ---------- distribuição "depois": a mesma lista do Dia da Escala, só de leitura ---------- */

  function renderDistribuicao(corpo, uid, iso, dados) {
    if (!RW.escalasPainelEditar) { mostrarEstado(corpo, msgFalha()); return; }
    /* sem a lista de avisos do topo: a caixa Avisos daqui já mostra o que o extra resolveu e o que ficou */
    RW.escalasPainelEditar.montar(corpo, null, uid, iso, { admin: false, dados: dados || {}, semAvisos: true });
  }

  /* aba Dia: busca a distribuição "depois" + avisos e desenha */
  function renderDia(corpo) {
    if (!pCtx) return;
    var uid = pCtx.uid, iso = pCtx.iso;
    mostrarCarregando(corpo);
    RW.extrajornadaDados.distribuicaoDia(uid, iso).then(function (r) {
      if (!pCtx || pCtx.uid !== uid || pCtx.iso !== iso || pCtx.secao !== 'dia') return;   // outra célula ou aba abriu enquanto carregava
      corpo.textContent = '';
      if (!r || r.ok === false) { mostrarEstado(corpo, msgFalha()); return; }
      renderDistribuicao(corpo, uid, iso, r.distribuicao);
      renderAvisos(corpo, uid, r);
    });
  }

  /* desenha a aba escolhida (Dia ou Extrajornada); nenhuma tem rodapé de ações */
  function mostrar(secao) {
    if (!pCtx) return;
    pCtx.secao = secao;
    var corpo = RW.painel.corpo();
    if (!corpo) return;
    var rodape = RW.painel.rodape();
    if (RW.escalasPainelEditar) RW.escalasPainelEditar.reset();
    if (secao === 'extra' && RW.escalasPainelExtra) {
      RW.escalasPainelExtra.montar(corpo, rodape, pCtx.uid, pCtx.iso);
    } else {
      if (RW.escalasPainelExtra) RW.escalasPainelExtra.reset();
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
      renderDia(corpo);
    }
  }

  /* ---------- abrir a gaveta para uma célula ---------- */

  function abrir(celula) {
    if (RW.fecharDropdowns) RW.fecharDropdowns();   // fecha o "+" da célula (a grade isola do fechamento por clique-fora)
    desmarcar();
    celula.classList.add('escala-mes-celula--selecionada');
    celulaSel = celula;
    pCtx = { uid: celula.dataset.unidadeId, iso: celula.dataset.iso, secao: 'dia' };
    var cidade = celula.dataset.unidadeCidade;

    RW.painel.abrir({
      titulo: celula.dataset.unidadeNome || '',
      tituloExtra: cidade ? '- ' + cidade : '',
      subtitulo: dataPorExtenso(pCtx.iso),
      aoFechar: desmarcar
    });
    /* abas Dia e Extrajornada embaixo do título; o geral-abas cuida da troca visual */
    var linha = RW.painel.linhaAbas();
    var tpl = document.getElementById('tpl-extra-painel-secoes');
    if (linha && tpl) {
      linha.appendChild(tpl.content.cloneNode(true));
      linha.classList.remove('oculto');
      var trilho = linha.querySelector('.abas');
      if (trilho && RW.abas) RW.abas.ligar(trilho, function (aba) { mostrar(aba.getAttribute('data-secao')); });
    }
    mostrar('dia');
  }

  /* ---------- ligação: clique numa célula da grade abre a gaveta ---------- */

  function ligar(conteudo) {
    if (!conteudo) return;
    /* Escuta na PRÓPRIA grade (#extra-escala-cal), NÃO no conteudo: a grade tem um
       stopPropagation (extrajornada-escala.js) que impede o clique de subir ao conteudo
       — onde o escalas-painel abriria a gaveta da ESCALA. Como stopPropagation não cancela
       outros listeners do MESMO elemento, o nosso roda aqui e abre a gaveta da extra, e a
       proteção da Escala segue de pé (o clique continua não subindo). */
    var grade = conteudo.querySelector('#extra-escala-cal');
    if (!grade || grade.dataset.painelDiaLigado) return;
    grade.dataset.painelDiaLigado = '1';
    grade.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      /* não rouba o clique dos controles in-cell (candidatos/vagas/+/bolinhas) nem de formulários */
      if (t.closest('button, input, .dropdown, .extra-vaga')) return;
      /* no Calendário, o bloquinho inteiro da unidade (nome incluso) vale como a célula que está dentro dele */
      var alvo = t.closest('.escala-mes-celula, .extra-calendario-unidade');
      var cel = alvo && alvo.classList.contains('extra-calendario-unidade') ? alvo.querySelector('.escala-mes-celula') : alvo;
      if (cel && cel.dataset.unidadeId && cel.dataset.iso) abrir(cel);
    });
  }

  function montar(conteudo) { ligar(conteudo); }

  RW.extrajornadaPainelDia = { montar: montar };
})();
