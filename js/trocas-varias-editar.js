/* ============================================================
   TROCAS — Editar das várias trocas (no painel do registro, pelo botão Editar)
   A aba Várias trocas (trocas-varias.js) em modo Editar, com o plano
   que vale hoje (fn_trocas_varias_plano: os dias, os militares e a
   Parte). O dia que já passou fica como está: o militar muda de
   amanhã em diante; o administrador de fora, até 7 dias atrás.
   O banco (fn_trocas_varias_editar) decide o caminho: só a Parte
   grava na hora; o pedido em aberto muda e volta para o aceite dos
   outros; nas trocas aprovadas, o militar propõe uma alteração
   (aceite de todos e aprovação); o administrador de fora altera
   direto, com a Análise antes de salvar (trocas-varias-registrar.js)
   e a confirmação. Cancelar volta à leitura; com algo mudado,
   confirma o descarte.
   Expõe RosterWork.trocasVariasEditar.{ abrir, guardaFechar, encerrar }
     abrir(troca, { aoSalvar(r) }) — troca = uma troca do registro
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var aberto = null;         // o Editar aberto: { troca, admin, aoSalvar, montado }
  var guardaLigado = false;

  function M() { return RW.mensagens.trocas; }
  function V() { return RW.trocasVarias; }

  function temMudanca() { return !!aberto && aberto.montado && V().temDados(); }

  /* ---------- salvar: a aba confere a Parte e os dias e devolve o pedido aqui ---------- */
  function aoEnviar(pares, parte, ano, btn) {
    if (!aberto) return;
    /* o administrador de fora muda a escala das trocas aprovadas na hora: confirma antes, como no Registrar */
    if (aberto.admin && aberto.troca.status === 'aprovada' && V().planoMudou() && RW.confirmar) {
      var analise = RW.trocasVariasRegistrar.ultima();
      var problema = !!(analise && analise.veredito === 'problema');
      RW.confirmar({
        tipo: 'aviso', mensagem: problema ? M().confirmarEditarComProblema : M().varias.confirmarEditar,
        confirmarPerigo: problema, aoConfirmar: function () { gravar(pares, parte, ano, null, true); }
      });
      return;
    }
    gravar(pares, parte, ano, btn, false);
  }
  /* comVeu: a escala é refeita (véu global); senão, os pontinhos no botão */
  function gravar(pares, parte, ano, btn, comVeu) {
    var meu = aberto;
    if (!meu) return;
    if (comVeu) { if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal(); }
    else if (btn && RW.iniciarCarregando) RW.iniciarCarregando(btn);
    function parar() { if (comVeu) { if (RW.esconderVeuGlobal) RW.esconderVeuGlobal(); } else if (btn && RW.pararCarregando) RW.pararCarregando(btn); }
    RW.trocasDados.variasEditar(meu.troca.registro_id, pares, parte, ano, false).then(function (r) {
      parar();
      if (r && r.ok) {
        var aoSalvar = meu.aoSalvar;
        encerrar();
        if (aoSalvar) aoSalvar(r);
      } else if (RW.avisar) {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || M().falhaAcao });
      }
    }).catch(function () {
      parar();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- cancelar, fechar, encerrar ---------- */
  function confirmarDescarte(aoConfirmar) {
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: aoConfirmar
    });
  }
  function voltarParaLeitura() { encerrar(); RW.painel.voltarParaLeitura(); }
  function cancelar() {
    if (!temMudanca() || !RW.confirmar) { voltarParaLeitura(); return; }
    confirmarDescarte(voltarParaLeitura);
  }
  /* o X e o Esc do painel durante a edição: segura o fechamento se houver algo mudado */
  function guardaFechar() {
    if (!temMudanca() || !RW.confirmar) return false;
    confirmarDescarte(function () { encerrar(); RW.painel.fechar(); });
    return true;
  }
  function encerrar() {
    if (aberto && aberto.montado && V()) V().encerrar();
    aberto = null;
  }

  /* ---------- montar: a aba em modo Editar e o rodapé Cancelar · Salvar ---------- */
  function montar(plano) {
    var corpo = RW.painel.corpo(), rodape = RW.painel.rodape();
    corpo.textContent = '';
    rodape.textContent = '';
    aberto.admin = !plano.participa;
    var frag = document.getElementById('tpl-troca-editar-acoes').content.cloneNode(true);
    var bSalvar = frag.querySelector('[data-acao="salvar"]');
    frag.querySelector('[data-acao="cancelar"]').addEventListener('click', cancelar);
    bSalvar.addEventListener('click', function () { V().enviar(bSalvar); });
    rodape.appendChild(frag);
    rodape.classList.remove('oculto');
    aberto.montado = true;
    V().montar({
      corpo: corpo,
      editar: {
        registroId: aberto.troca.registro_id, plano: plano, admin: aberto.admin, botao: bSalvar, aoEnviar: aoEnviar,
        /* o militar que muda trocas aprovadas (ou uma alteração que espera) propõe: as de antes valem até a aprovação */
        alteracao: !aberto.admin && (aberto.troca.status === 'aprovada' || !!aberto.troca.original)
      }
    });
  }

  /* ---------- abrir: lê o plano que vale hoje e monta ---------- */
  function abrir(troca, opcoes) {
    if (!RW.painel || !troca || !V()) return;
    opcoes = opcoes || {};
    if (!guardaLigado && RW.guardaSaida && RW.guardaSaida.registrar) { RW.guardaSaida.registrar(temMudanca); guardaLigado = true; }
    encerrar();
    var corpo = RW.painel.corpo(), rodape = RW.painel.rodape(), carregando = RW.painel.criarCarregando();
    corpo.textContent = '';
    if (carregando) corpo.appendChild(carregando);
    rodape.textContent = '';
    rodape.classList.add('oculto');
    RW.painel.largo(true);
    var meu = aberto = { troca: troca, admin: false, aoSalvar: opcoes.aoSalvar, montado: false };
    RW.trocasDados.variasPlano(troca.registro_id).then(function (r) {
      if (aberto !== meu) return;
      if (r && r.ok) { montar(r); return; }
      voltarParaLeitura();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || M().falhaAcao });
    }).catch(function () {
      if (aberto !== meu) return;
      voltarParaLeitura();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  RW.trocasVariasEditar = { abrir: abrir, guardaFechar: guardaFechar, encerrar: encerrar };
})();
