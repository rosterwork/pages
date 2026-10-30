/* ============================================================
   ESCALAS — o Salvar do painel do dia (as abas Dia e Ciclo). As
   mudanças de cada aba ficam no rascunho dela (o Dia em
   escalas-painel-editar.js, o Ciclo em escalas-painel-ciclo.js);
   trocar de aba não perde nada. O rodapé largo da página
   (.escala-rodape-salvar) mostra "N alterações não
   salvas", o Cancelar (descarta tudo, com a confirmação) e o Salvar,
   que grava as duas de uma vez, tudo ou nada (escala_painel_salvar):
   o véu, o resumo com o que cada parte gravou e as telas lidas de
   novo. Enquanto há mudança, as telas da Escala mostram o rascunho
   (a prévia, escala_previa, pela escalas-dados.js) e o dia mudado
   leva a borda tracejada; quando o rascunho muda de verdade, as telas são
   avisadas meio segundo depois do último clique
   (rosterwork_escala_previa); abrir, fechar ou trocar de dia ou de
   aba sem mudança não as faz ler de novo. No painel, o rodapé
   fica com as alterações manuais do dia (no Dia) e com o Cancelar e
   o Aplicar das sub-telas.
   API: RosterWork.escalasPainelSalvar.rodape(rodape, comHistorico)
   monta o rodapé do painel e devolve o lugar do histórico;
   .atualizar() redesenha o rodapé da página; .contar() soma as
   mudanças das duas; .pendente() diz se há mudança no Dia ou no
   Ciclo; .descartar() tira as do Dia e do Ciclo; .paraPrevia() dá o rascunho para a prévia das telas (null
   sem mudança); .marcado(unidade, dia) diz se o dia leva a borda.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var salvando = false;
  var espera = null;   // o aviso às telas, meio segundo depois do último clique
  var mostrado = '';   // o rascunho que as telas mostram (marcaDaPrevia; vazio: o gravado)

  function msg() { return RW.mensagens.escala; }
  function E() { return RW.escalasPainelEditar; }
  function C() { return RW.escalasPainelCiclo; }
  function contexto() { return RW.escalasPainel && RW.escalasPainel.contexto ? RW.escalasPainel.contexto() : null; }

  /* ---------- o que falta salvar ---------- */

  function doCiclo(c) { return c && C() ? C().doDia(c.unidadeId, c.iso) : []; }
  function contar() {
    var c = contexto();
    if (!c) return 0;
    return (E() ? E().pendentes() : 0) + doCiclo(c).length;
  }
  /* o Dia e o Ciclo são do dia aberto (trocar de dia, fechar o painel e sair da página perguntam antes) */
  function pendente() { return (E() ? E().pendentes() : 0) > 0 || doCiclo(contexto()).length > 0; }
  function descartar() {
    if (E()) E().descartar();
    if (C()) C().limpar();
  }

  /* o rascunho para a prévia das telas: { unidadeId, iso, dia, ciclo } (cada parte nula sem mudança), ou null */
  function paraPrevia() {
    var c = contexto();
    if (!c || !contar()) return null;
    return {
      unidadeId: c.unidadeId, iso: c.iso,
      dia: E() && E().pendentes() ? E().previaDia() : null,
      ciclo: doCiclo(c).length ? C().envio() : null
    };
  }
  /* a borda tracejada: o dia aberto no painel (com mudança no Dia ou no Ciclo); sem a unidade (null), em qualquer
     unidade (a Minha escala) */
  function marcado(unidadeId, iso) {
    var c = contexto();
    if (!c) return false;
    return pendente() && (unidadeId == null || String(c.unidadeId) === String(unidadeId)) && c.iso === iso;
  }

  /* ---------- os rodapés ---------- */

  /* o rodapé de uma aba do painel: limpa e põe o lugar do histórico (no Dia); aparece se algo dentro dele aparece */
  function rodape(el, comHistorico) {
    if (!el) return null;
    el.textContent = '';
    var lugar = comHistorico ? RW.tpl('tpl-escala-painel-historico') : null;
    if (lugar) el.appendChild(lugar);
    el.classList.toggle('oculto', !lugar);
    return lugar;
  }
  /* o histórico apareceu ou sumiu: o rodapé do painel acompanha */
  function historicoMudou(el) {
    if (!el) return;
    var algum = [].some.call(el.children, function (f) { return !f.classList.contains('oculto'); });
    el.classList.toggle('oculto', !algum);
  }

  /* o rodapé largo da página (o primeiro da página aberta); os botões ligam uma vez só */
  function rodapePagina() {
    var el = document.querySelector('.conteudo .escala-rodape-salvar');
    if (el && !el.hasAttribute('data-ligado')) {
      el.setAttribute('data-ligado', '');
      el.querySelector('.escala-painel-cancelar').addEventListener('click', perguntarCancelar);
      var salvar = el.querySelector('.escala-painel-salvar');
      salvar.addEventListener('click', function () { gravar(salvar); });
    }
    return el;
  }

  /* depois de uma mudança em qualquer aba: o rodapé da página mostra a conta ou some */
  function atualizar() {
    var el = rodapePagina();
    if (!el) return;
    var n = contar();
    el.classList.toggle('oculto', !n);
    el.querySelector('.escala-rodape-salvar-texto').textContent = n ? msg().alteracoesNaoSalvas(n) : '';
    el.querySelector('.escala-painel-cancelar').disabled = salvando;
    el.querySelector('.escala-painel-salvar').disabled = salvando;
  }

  /* o que as telas mostram do rascunho (vazio sem mudança): o Dia e o Ciclo do dia aberto */
  function marcaDaPrevia() {
    var p = paraPrevia();
    if (!p) return '';
    return JSON.stringify([p.unidadeId, p.iso, p.dia, p.ciclo]);
  }

  /* o rascunho mudou: o rodapé na hora, e as telas meio segundo depois do último clique (cada uma pede a prévia), só se
     o que elas mostram mudou */
  function mudou() {
    atualizar();
    if (espera) clearTimeout(espera);
    espera = setTimeout(function () {
      espera = null;
      var marca = marcaDaPrevia();
      if (marca === mostrado) return;
      mostrado = marca;
      window.dispatchEvent(new CustomEvent('rosterwork_escala_previa'));
    }, 500);
  }

  /* ---------- Cancelar e Salvar ---------- */

  function perguntarCancelar() {
    if (salvando) return;
    RW.confirmar({
      tipo: 'aviso',
      mensagem: msg().painelDescartar(contar()),
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () {
        descartar();
        redesenharAba();
        mudou();
      }
    });
  }

  /* a aba Ciclo aberta lê a lista de novo (o Dia se redesenha sozinho) */
  function redesenharAba() {
    var c = contexto();
    if (c && c.secao === 'continuos' && RW.escalasPainel.recarregarSecao) RW.escalasPainel.recarregarSecao();
  }

  /* os registros das partes num resumo só: as mudanças de todas, com o autor e a hora do primeiro */
  function juntarLogs(logs) {
    if (!logs.length) return null;
    if (logs.length === 1) return logs[0];
    var log = JSON.parse(JSON.stringify(logs[0]));
    log.resumo = { titulo: logs[0].resumo && logs[0].resumo.titulo, alvos: [] };
    logs.forEach(function (l) { log.resumo.alvos = log.resumo.alvos.concat((l.resumo && l.resumo.alvos) || []); });
    return log;
  }

  function gravar(botao) {
    var c = contexto();
    if (!c || salvando) return;
    var dia = E() && E().pendentes() ? E().paraGravar() : null;
    var ciclo = doCiclo(c).length ? C().envio() : null;
    if (!dia && !ciclo) return;
    salvando = true;
    atualizar();
    if (botao) RW.iniciarCarregando(botao);
    if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o ciclo recalcula a escala: círculo e tela travada
    RW.escalasDados.painelSalvar(c.unidadeId, c.iso, dia, ciclo).then(function (r) {
      salvando = false;
      if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
      if (botao) RW.pararCarregando(botao);
      var geral = RW.mensagens.geral;
      if (r && r._falha) { RW.avisar({ tipo: 'erro', mensagem: r._falha === 'conexao' ? geral.semConexao : geral.falhaServidor }); atualizar(); return; }
      if (!r || !r.success) {
        if (r && r.desatualizado) {
          /* o dia mudou depois da leitura (outro administrador ou o sistema): o rascunho do Dia sai e o dia é lido de novo */
          RW.avisar({ tipo: 'aviso', mensagem: msg().diaDesatualizado });
          if (E()) E().descartar();
          redesenharAba();
          mudou();
        } else {
          RW.avisar({ tipo: 'erro', mensagem: msg().painelRecusado((r && r.error) || msg().falhaSalvar) });
          atualizar();
        }
        return;
      }
      if (E()) E().aposGravar(r);
      if (C()) C().limpar();
      if (espera) { clearTimeout(espera); espera = null; }
      mostrado = marcaDaPrevia();   // as telas leem de novo logo abaixo, já sem o que foi gravado
      atualizar();
      window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: c.unidadeId, iso: c.iso } }));
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      var log = juntarLogs(r.logs || []);
      if (log && RW.resumo) RW.resumo.abrirModal(log, { pagina: 'Escala' });
      redesenharAba();
    });
  }

  /* qualquer aviso dos rascunhos (também o painel que abre ou fecha) redesenha o rodapé; as telas, só com mudança */
  window.addEventListener('rosterwork_escala_rascunho', mudou);
  /* fechar ou recarregar o navegador, ou ir para outra página, com mudança no Dia ou no Ciclo: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(pendente);

  RW.escalasPainelSalvar = { rodape: rodape, historicoMudou: historicoMudou, atualizar: atualizar, contar: contar, pendente: pendente,
    descartar: descartar, paraPrevia: paraPrevia, marcado: marcado };
})();
