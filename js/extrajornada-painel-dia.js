/* ============================================================
   EXTRAJORNADA — painel do dia (gaveta), aba Escala
   Clicar numa célula da grade abre a gaveta geral-painel (a mesma da
   Escala), com as abas Ver / Editar iguais às da Escala:
     • Ver   — no topo os AVISOS antes/depois (o que o extra resolveu ✓
               e o que restou ▲) e, abaixo, a DISTRIBUIÇÃO "depois" (com
               os extras), por ENSAIO no motor (RPC extra_distribuicao_dia).
     • Editar— reusa o editor da Escala (escalas-painel-editar): edita a
               distribuição REAL do dia (salvar_ajustes_dia), igual à
               Escala. Só admin.
   Reusa RosterWork.escalasPainel.pecas + os moldes tpl-escala-* (no shell).
   Não cria HTML (clona moldes) nem escreve estilo (só classList/textContent).
   RosterWork.extrajornadaPainelDia.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var celulaSel = null;
  var pCtx = null;              // { uid, iso } do dia aberto
  var guardaModoLigado = false; // guarda das abas Ver/Editar (uma vez)
  var salvaLigado = false;      // ouvinte de 'rosterwork_escala_salva' (uma vez)

  function dataPorExtenso(iso) {
    var p = (iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function resetEditar() {
    if (RW.escalasPainelEditar && RW.escalasPainelEditar.reset) RW.escalasPainelEditar.reset();
  }
  function desmarcar() {
    resetEditar();
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
    corpo.appendChild(caixa);
  }

  /* ---------- distribuição "depois" (reusa as peças do painel da Escala) ---------- */

  function renderDistribuicao(corpo, dados) {
    var pecas = RW.escalasPainel && RW.escalasPainel.pecas;
    if (!pecas) { mostrarEstado(corpo, msgFalha()); return; }
    var postos = (dados && dados.postos) || [];
    var semFuncao = (dados && dados.sem_funcao) || [];
    if (!postos.length && !semFuncao.length) { mostrarEstado(corpo, 'Sem distribuição neste dia.'); return; }

    if (semFuncao.length) {
      var caixaErro = RW.painel.criarCaixa('Sem função definida', true);
      if (caixaErro) {
        semFuncao.forEach(function (m) { var l = pecas.linha(m); if (l) caixaErro.appendChild(l); });
        corpo.appendChild(caixaErro);
      }
    }

    postos.forEach(function (posto) {
      if (!(posto.funcoes && posto.funcoes.length) && !posto.em_manutencao) return;
      var caixa = RW.painel.criarCaixa(posto.nome);
      if (!caixa) return;
      if (posto.em_manutencao) {
        caixa.classList.add('grupo-caixa--posto-alerta', 'grupo-caixa--manutencao');
        var m = pecas.montarManutencao(posto, false);
        if (m) caixa.appendChild(m);
      } else {
        var np = pecas.nivelPosto(posto);
        if (np) caixa.classList.add('grupo-caixa--posto-' + np);
      }
      pecas.mesclarFuncoes(posto).forEach(function (funcao) {
        var g = pecas.grupo(funcao, false);
        if (g) caixa.appendChild(g);
      });
      corpo.appendChild(caixa);
    });

    var caixaObs = pecas.observacoes((dados && dados.observacoes) || [], { editar: false });
    if (caixaObs) corpo.appendChild(caixaObs);
  }

  /* modo Ver: busca a distribuição "depois" + avisos e desenha */
  function renderVer(corpo) {
    if (!pCtx) return;
    var uid = pCtx.uid, iso = pCtx.iso;
    mostrarCarregando(corpo);
    RW.extrajornadaDados.distribuicaoDia(uid, iso).then(function (r) {
      if (!pCtx || pCtx.uid !== uid || pCtx.iso !== iso) return;   // outra célula abriu enquanto carregava
      corpo.textContent = '';
      if (!r || r.ok === false) { mostrarEstado(corpo, msgFalha()); return; }
      renderAvisos(corpo, uid, r);
      renderDistribuicao(corpo, r.distribuicao);
    });
  }

  /* ---------- guarda das abas Ver/Editar (espelha o escalas-painel) ---------- */

  function secaoSuja() {
    return !!(RW.escalasPainelEditar && RW.escalasPainelEditar.estaSujo && RW.escalasPainelEditar.estaSujo());
  }
  function confirmarDescarte(aoConfirmar) {
    if (!RW.confirmar) { aoConfirmar(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.escala.descartarAlteracoes,
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: aoConfirmar
    });
  }
  function tentarFechar() {
    if (!secaoSuja()) return false;
    confirmarDescarte(function () { RW.painel.fechar(); });
    return true;
  }
  function voltarParaVer() {
    resetEditar();
    var abas = document.getElementById('painel-abas');
    var ver = abas ? abas.querySelector('[data-painel-modo="ver"]') : null;
    if (ver) ver.click();
  }
  function ligarGuardaModo() {
    if (guardaModoLigado) return;
    var abas = document.getElementById('painel-abas');
    if (!abas) return;
    guardaModoLigado = true;
    abas.addEventListener('click', function (e) {
      if (!pCtx) return;   // outra tela é a dona do painel
      var aba = e.target.closest('.aba');
      if (!aba || aba.classList.contains('aba--ativa') || !secaoSuja()) return;
      e.preventDefault();
      e.stopPropagation();
      confirmarDescarte(function () { resetEditar(); aba.click(); });
    }, true);   // captura: roda antes do geral-abas
  }
  /* após salvar uma edição, a cobertura da grade muda: recarrega a grade da extra */
  function ligarSalva() {
    if (salvaLigado) return;
    salvaLigado = true;
    window.addEventListener('rosterwork_escala_salva', function () {
      if (RW.extrajornadaEscala && RW.extrajornadaEscala.recarregar) RW.extrajornadaEscala.recarregar();
    });
  }

  /* desenha a aba atual (Ver ou Editar) no corpo/rodapé da gaveta */
  function mostrar() {
    if (!pCtx) return;
    var corpo = RW.painel.corpo();
    if (!corpo) return;
    var rodape = RW.painel.rodape();
    var editar = RW.painel.modo && RW.painel.modo() === 'editar';
    if (editar && RW.escalasPainelEditar) {
      RW.escalasPainelEditar.montar(corpo, rodape, pCtx.uid, pCtx.iso, voltarParaVer);   // editor da Escala (edita o dia real)
    } else {
      resetEditar();
      if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }   // Ver não tem rodapé de ações
      renderVer(corpo);
    }
  }
  function aoMudarModo() { if (pCtx) mostrar(); }

  /* ---------- abrir a gaveta para uma célula ---------- */

  function abrir(celula) {
    if (RW.fecharDropdowns) RW.fecharDropdowns();   // fecha o "+" da célula (a grade isola do fechamento por clique-fora)
    desmarcar();
    celula.classList.add('escala-mes-celula--selecionada');
    celulaSel = celula;
    pCtx = { uid: celula.dataset.unidadeId, iso: celula.dataset.iso };
    var cidade = celula.dataset.unidadeCidade;

    RW.painel.abrir({
      titulo: celula.dataset.unidadeNome || '',
      tituloExtra: cidade ? '- ' + cidade : '',
      subtitulo: dataPorExtenso(pCtx.iso),
      editavel: !!(RW.sessao && RW.sessao.ehAdmin && RW.sessao.ehAdmin()),   // só admin vê a aba Editar (o backend também trava em salvar_ajustes_dia)
      aoMudarModo: aoMudarModo,
      aoFechar: desmarcar,
      aoTentarFechar: tentarFechar   // Esc/X confirmam antes de descartar rascunho
    });
    ligarGuardaModo();
    ligarSalva();
    mostrar();
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
      var cel = t.closest('.escala-mes-celula');
      if (cel && cel.dataset.unidadeId && cel.dataset.iso) abrir(cel);
    });
  }

  function montar(conteudo) { ligar(conteudo); }

  RW.extrajornadaPainelDia = { montar: montar };
})();
