/* ============================================================
   TROCAS — o Registrar da aba Várias trocas (só admin) e a Análise
   No Registrar troca, a aba Várias trocas (trocas-varias.js) chama
   aqui: a Análise do registro inteiro, refeita a cada mudança dos
   dias, com o Registrar trocas travado até ela chegar (igual ao
   Registrar de uma troca); a confirmação (avisa quando a análise
   apontou problema), a gravação já aprovada (véu global) e o resumo
   com o Desfazer (apaga o registro inteiro e volta a escala).
   A Análise é o ensaio que o estado da aba traz (est.ensaio): no
   Registrar, o fn_trocas_varias_registrar; no Editar do administrador
   de fora, o fn_trocas_varias_editar, só quando os dias mudaram, com
   o Salvar travado até ela chegar.
   Expõe RosterWork.trocasVariasRegistrar.{ iniciar, agendarAnalise, registrar, ultima, encerrar }
     iniciar(est, botao) — est = o estado da aba; botao = o Registrar trocas (ou o Salvar do Editar)
     registrar(parte, ano) — confirma e grava (a aba já conferiu a Parte e os dias)
     ultima() — a última análise que chegou (a confirmação do Editar avisa o problema)
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var est = null;          // o estado da aba aberta
  var botao = null;        // o Registrar trocas (travado até a análise chegar)
  var timer = null;
  var req = 0;             // token: só a análise mais recente vale
  var analise = null;      // a última análise que chegou

  function M() { return RW.mensagens.trocas; }
  function partes() {
    var s = est && est.raiz ? est.raiz.querySelector('#tv-analise') : null;
    return s ? { analiseSecao: s, analiseSelo: s.querySelector('.decisao-analise-selo'), analise: s.querySelector('.decisao-analise'), saldo: null } : null;
  }
  function travar(sim) { if (botao) botao.disabled = sim; }

  /* ---------- a Análise: roda quando há dias marcados (no Editar, quando eles mudaram); o botão espera ela chegar ---------- */
  function agendarAnalise() {
    if (!est) return;
    if (timer) clearTimeout(timer);
    req++;   // a análise anterior deixa de valer
    analise = null;
    var p = partes();
    if (!p) return;
    if (!est.pares.length || (est.editar && !RW.trocasVarias.planoMudou())) { p.analiseSecao.classList.add('oculto'); travar(false); return; }
    travar(true);
    RW.decisao.analisando(p);
    timer = setTimeout(analisar, 350);
  }
  function analisar() {
    var meu = ++req, p = partes();
    est.ensaio().then(function (r) {
      if (!est || meu !== req) return;
      analise = r && r.ok ? r : null;
      RW.decisao.analise(p, analise, (r && r.erro) || M().falhaAnalise);
      travar(false);   // chegou: libera o Registrar trocas (o banco ainda decide)
    }).catch(function () {
      if (!est || meu !== req) return;
      RW.decisao.analise(p, null, M().falhaAnalise);
      travar(false);
    });
  }

  /* ---------- registrar: confirma (avisando quando a análise apontou problema) e grava já aprovado ---------- */
  function registrar(parte, ano) {
    var problema = !!(analise && analise.veredito === 'problema');
    if (!RW.confirmar) { gravar(parte, ano); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: problema ? M().confirmarRegistrarComProblema : M().varias.confirmarRegistrar,
      confirmarPerigo: problema, aoConfirmar: function () { gravar(parte, ano); }
    });
  }
  function mostrarVeu() { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
  function esconderVeu() { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); }
  /* grava e refaz a escala de todos os dias (véu global); o resumo traz o Desfazer, que apaga o registro inteiro */
  function gravar(parte, ano) {
    if (!est) return;
    var aoMudar = est.aoMudar;
    mostrarVeu();
    RW.trocasDados.variasRegistrar(est.pares, parte, ano, false).then(function (r) {
      esconderVeu();
      if (!r || !r.ok) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || M().falhaAcao }); return; }
      RW.painel.fechar();
      if (aoMudar) aoMudar();
      if (!r.log || !RW.resumo) return;
      RW.resumo.abrirModal(r.log, {
        pagina: 'Trocas',
        desfazer: function () {
          mostrarVeu();
          return RW.trocasDados.variasCancelar(r.registro_id, true).then(function (res) {
            esconderVeu();
            if (res && res.ok && aoMudar) aoMudar();
            return res;
          }).catch(function (e) { esconderVeu(); throw e; });
        }
      });
    }).catch(function () {
      esconderVeu();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  function iniciar(estado, botaoRegistrar) { est = estado; botao = botaoRegistrar; analise = null; }
  function encerrar() { if (timer) clearTimeout(timer); req++; est = null; botao = null; analise = null; }

  RW.trocasVariasRegistrar = { iniciar: iniciar, agendarAnalise: agendarAnalise, registrar: registrar, ultima: function () { return analise; }, encerrar: encerrar };
})();
