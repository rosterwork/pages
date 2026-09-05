/* ============================================================
   EXTRAJORNADA — orquestrador da página
   Liga as abas (Escala · Disponibilidade), mostra o painel da aba ativa
   e é o DONO do seletor de mês ÚNICO (compartilhado pelas duas abas): as
   setas andam pelo alcance vindo do banco (extra_nav_meses) — para trás só
   meses com dados, para frente para no próximo mês. A gestão de cotas
   (admin) fica num painel fixo à esquerda da grade, na aba Escala.
   Registra RosterWork.paginas.extrajornada = { iniciar }.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var ABAS = ['escala', 'disponibilidade'];
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var el = {};
  var abaAtual = 'escala';
  var navAnt = null;   // Date do mês anterior alcançável (ou null = seta travada)
  var navProx = null;  // Date do próximo mês alcançável (ou null)
  var mesConfirmado = false;   // o mês de entrada (fuso Brasília) já foi confirmado pelo banco? (só corrige na 1ª carga sem mês salvo)

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; }
  function dataMes(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, 1); }
  function rotuloMes(d) { var n = MESES[d.getMonth()]; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + d.getFullYear(); }

  /* ---------- mês compartilhado pelas duas abas (fonte única) ----------
     Começa no mês atual até o dia 25; do dia 26 em diante, no próximo mês.
     Mudou o mês, as duas abas seguem. */
  var mesComp = null;
  var MES_KEY = 'rosterwork_extra_mes';   // mês escolhido, guardado na sessão: sobrevive ao F5; some no logout (sessionStorage.clear)
  function mesInicial() {
    var hj = new Date();
    return new Date(hj.getFullYear(), hj.getMonth() + (hj.getDate() >= 26 ? 1 : 0), 1);
  }
  RW.extrajornadaMes = {
    obter: function () { if (!mesComp) mesComp = mesInicial(); return new Date(mesComp.getFullYear(), mesComp.getMonth(), 1); },
    definir: function (d) {
      mesComp = new Date(d.getFullYear(), d.getMonth(), 1);
      try { sessionStorage.setItem(MES_KEY, iso(mesComp)); } catch (e) {}   // lembra a escolha na sessão (sobrevive ao F5)
    },
    reiniciar: function () { mesComp = mesInicial(); try { sessionStorage.removeItem(MES_KEY); } catch (e) {} },
    restaurar: function () {   // ao abrir a página: usa o mês guardado (F5); sem nada guardado, cai na regra do mês atual
      var salvo = null; try { salvo = sessionStorage.getItem(MES_KEY); } catch (e) {}
      var d = salvo ? dataMes(salvo) : null;
      var temSalvo = !!(d && !isNaN(d.getTime()));
      mesComp = temSalvo ? new Date(d.getFullYear(), d.getMonth(), 1) : mesInicial();
      mesConfirmado = temSalvo;   // com mês salvo, respeita a escolha; sem, deixa o banco confirmar o mês de entrada
    },
    atualizarSeletor: function () { atualizarSeletor(); }   // uma aba pediu para o seletor refletir o mês atual
  };

  function moduloAtivo() {
    return abaAtual === 'disponibilidade' ? RW.extrajornadaDisponibilidade : RW.extrajornadaEscala;
  }

  /* ---------- seletor de mês (dono: o orquestrador) ---------- */
  function atualizarSeletor() {
    var comp = RW.extrajornadaMes.obter();
    if (el.periodoNome) el.periodoNome.textContent = rotuloMes(comp);
    if (el.ant) el.ant.disabled = true;
    if (el.prox) el.prox.disabled = true;
    if (!RW.extrajornadaDados) return;
    RW.extrajornadaDados.carregarNavMeses(iso(comp)).then(function (r) {
      r = r || {};
      /* mês de entrada é decidido pelo banco (fuso de Brasília): na 1ª carga sem mês salvo,
         corrige o palpite do navegador para o mês certo (vale para as duas abas). */
      if (!mesConfirmado) {
        mesConfirmado = true;
        if (r.mes_entrada && r.mes_entrada !== iso(comp)) {
          RW.extrajornadaMes.definir(dataMes(r.mes_entrada));
          var mod = moduloAtivo();
          if (mod && mod.renderMes) mod.renderMes();
          atualizarSeletor();   // refaz o seletor/nav para o mês corrigido
          return;
        }
      }
      navAnt = r.nav_anterior ? dataMes(r.nav_anterior) : null;
      navProx = r.nav_proximo ? dataMes(r.nav_proximo) : null;
      if (el.ant) el.ant.disabled = !navAnt;
      if (el.prox) el.prox.disabled = !navProx;
    });
  }

  /* troca o mês compartilhado (com guarda de edição não salva da aba ativa) e recarrega a aba */
  function irParaMes(nova) {
    var mod = moduloAtivo();
    function aplicar() {
      RW.extrajornadaMes.definir(nova);
      atualizarSeletor();
      if (mod && mod.renderMes) mod.renderMes();
    }
    if (mod && mod.estaSujo && mod.estaSujo() && RW.confirmar) {
      RW.confirmar({
        tipo: 'aviso',
        mensagem: RW.mensagens.edicao.sairSemSalvar,
        textoConfirmar: RW.mensagens.botoes.descartar,
        textoCancelar: RW.mensagens.botoes.continuarEditando,
        aoConfirmar: aplicar
      });
    } else {
      aplicar();
    }
  }

  function painelVisivel(conteudo, nome, mostra) {
    var e = conteudo.querySelector('.pagina-corpo [data-aba-painel="' + nome + '"]');
    if (e) e.classList.toggle('oculto', !mostra);
  }

  function aoTrocarAba(conteudo, aba) {
    abaAtual = aba ? aba.getAttribute('data-aba') : 'escala';
    ABAS.forEach(function (n) { painelVisivel(conteudo, n, n === abaAtual); });
    if (RW.extrajornadaEscala) {
      if (abaAtual === 'escala') RW.extrajornadaEscala.ativar();
      else RW.extrajornadaEscala.desativar();
    }
    if (RW.extrajornadaDisponibilidade) {
      if (abaAtual === 'disponibilidade') RW.extrajornadaDisponibilidade.ativar();
      else RW.extrajornadaDisponibilidade.desativar();
    }
    if (RW.extrajornadaCotasPainel) {
      if (abaAtual === 'escala') RW.extrajornadaCotasPainel.ativar();
      else RW.extrajornadaCotasPainel.desativar();
    }
  }

  function iniciar(conteudo) {
    var abas = conteudo.querySelector('#extrajornada-abas');
    if (RW.abas && abas) {
      /* sair da aba Escala com o painel de Cotas com edição não salva: confirma o descarte
         antes de trocar. Captura: roda antes de o geral-abas trocar. */
      abas.addEventListener('click', function (e) {
        if (abaAtual !== 'escala') return;
        var aba = e.target.closest('.aba');
        if (!aba || aba.getAttribute('data-aba') === 'escala') return;
        var cp = RW.extrajornadaCotasPainel;
        if (!cp || !cp.temEdicaoAberta || !cp.temEdicaoAberta()) return;
        e.preventDefault();
        e.stopPropagation();
        if (!RW.confirmar) { if (cp.descartar) cp.descartar(); aba.click(); return; }
        RW.confirmar({
          tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
          textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
          aoConfirmar: function () { if (cp.descartar) cp.descartar(); aba.click(); }
        });
      }, true);
      RW.abas.ligar(abas, function (aba) { aoTrocarAba(conteudo, aba); });
    }

    el.periodo = conteudo.querySelector('#extra-periodo');
    el.periodoNome = conteudo.querySelector('#extra-periodo-nome');
    el.ant = conteudo.querySelector('#extra-periodo-anterior');
    el.prox = conteudo.querySelector('#extra-periodo-proximo');
    if (el.ant) el.ant.addEventListener('click', function () { if (navAnt) irParaMes(navAnt); });
    if (el.prox) el.prox.addEventListener('click', function () { if (navProx) irParaMes(navProx); });

    RW.extrajornadaMes.restaurar();   // ao reabrir a página, usa o mês guardado na sessão (F5); sem nada, mês atual
    if (RW.extrajornadaEscala) RW.extrajornadaEscala.montar(conteudo);
    if (RW.extrajornadaDisponibilidade) RW.extrajornadaDisponibilidade.montar(conteudo);
    if (RW.extrajornadaCotasPainel) RW.extrajornadaCotasPainel.montar(conteudo);
    if (RW.extrajornadaPainelDia) RW.extrajornadaPainelDia.montar(conteudo);

    atualizarSeletor();
    var ativa = conteudo.querySelector('#extrajornada-abas .aba--ativa');
    aoTrocarAba(conteudo, ativa || (abas && abas.querySelector('.aba')));

    return Promise.resolve();
  }

  RW.paginas.extrajornada = { iniciar: iniciar };
})();
