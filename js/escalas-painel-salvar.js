/* ============================================================
   ESCALAS — o Salvar do painel do dia (as abas Dia, Ciclo e
   Extrajornada). As mudanças de cada aba ficam no rascunho dela (o Dia
   em escalas-painel-editar.js, o Ciclo em escalas-painel-ciclo.js, a
   Extrajornada no rascunho do mês, escalas-painel-extra.js); trocar de
   aba não perde nada. O rodapé largo da página
   (.escala-rodape-salvar) mostra "N alterações não
   salvas" (com mudança na extra, também o motivo), o Cancelar (descarta
   tudo, com a confirmação) e o Salvar, que grava as três de uma vez,
   tudo ou nada (escala_painel_salvar):
   o véu, o resumo com o que cada parte gravou e as telas lidas de
   novo. Enquanto há mudança, as telas da Escala mostram o rascunho
   (a prévia, escala_previa, pela escalas-dados.js) e o dia mudado
   leva a borda tracejada; quando o rascunho muda de verdade, as telas são
   avisadas meio segundo depois do último clique
   (rosterwork_escala_previa); abrir, fechar ou trocar de dia ou de
   aba sem mudança não as faz ler de novo. As sub-telas e o lápis põem
   a mudança no rascunho enquanto se responde; com uma pergunta pela
   metade, um conflito ou alguém acima da cota da extra, o Salvar fica
   desligado. A página tem um
   rodapé só: o do painel (fora dele, na largura toda) só aparece no
   que grava na hora (o Remover › por troca), e enquanto aparece o da
   página some; as alterações manuais do dia ficam no fim do corpo do
   Dia.
   API: RosterWork.escalasPainelSalvar.rodape(rodape) limpa e
   esconde o rodapé do painel ao entrar numa aba;
   .atualizar() redesenha o rodapé da página; .contar() soma as
   mudanças das três; .contarDoDia() só as do Dia e do Ciclo;
   .pendente() diz se há mudança no Dia ou no Ciclo; .descartar() tira
   as do Dia e do Ciclo; .paraPrevia() dá o rascunho para a prévia das
   telas (null sem mudança); .marcado(unidade, dia) diz se o dia leva a
   borda.
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
  function X() { return RW.escalasPainelExtra; }
  function contexto() { return RW.escalasPainel && RW.escalasPainel.contexto ? RW.escalasPainel.contexto() : null; }

  /* ---------- o que falta salvar ---------- */

  function doCiclo(c) { return c && C() ? C().doDia(c.unidadeId, c.iso) : []; }
  function contarDoDia() {
    var c = contexto();
    if (!c) return 0;
    return (E() ? E().pendentes() : 0) + doCiclo(c).length;
  }
  function contar() { return contarDoDia() + (contexto() && X() ? X().contar() : 0); }
  /* o Dia e o Ciclo são do dia aberto (trocar de dia, fechar o painel e sair da página perguntam antes); a Extrajornada
     é do mês (trocar de dia não perde nada; fechar o painel e sair da página perguntam) */
  function pendente() { return (E() ? E().pendentes() : 0) > 0 || doCiclo(contexto()).length > 0; }
  function descartar() {
    if (E()) E().descartar();
    if (C()) C().limpar();
  }

  /* o rascunho para a prévia das telas: { unidadeId, iso, dia, ciclo, extra } (cada parte nula sem mudança), ou null.
     Quem passou da cota fica fora: o banco recusaria */
  function paraPrevia() {
    var c = contexto();
    if (!c || !contar()) return null;
    var dia = E() && E().pendentes() ? E().previaDia() : null;
    var ciclo = doCiclo(c).length ? C().envio() : null;
    var extra = X() ? X().paraPrevia() : null;
    if (!dia && !ciclo && !extra) return null;
    return { unidadeId: c.unidadeId, iso: c.iso, dia: dia, ciclo: ciclo, extra: extra };
  }
  /* a borda tracejada: o dia aberto no painel (com mudança no Dia ou no Ciclo) e os dias do rascunho da Extrajornada; sem
     a unidade (null), em qualquer unidade (a Minha escala) */
  function marcado(unidadeId, iso) {
    var c = contexto();
    if (!c) return false;
    if (pendente() && (unidadeId == null || String(c.unidadeId) === String(unidadeId)) && c.iso === iso) return true;
    return !!(X() && X().marcado(unidadeId, iso));
  }

  /* ---------- os rodapés ---------- */

  /* o rodapé do painel ao entrar numa aba: limpo e escondido (o painel não tem rodapé próprio; ele só aparece no que grava
     na hora, e o Salvar é o rodapé largo da página) */
  function rodape(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('oculto');
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
    var passou = X() ? X().passou() : null;
    el.classList.toggle('oculto', !n);
    var texto = el.querySelector('.escala-rodape-salvar-texto');
    texto.textContent = passou ? RW.mensagens.novaExtra.org.passouRodape(passou.nome, passou.n) : n ? msg().alteracoesNaoSalvas(n) : '';
    texto.classList.toggle('escala-extra-rodape-erro', !!passou);
    var motivo = el.querySelector('.escala-rodape-motivo'), comExtra = !!(X() && X().contar());
    motivo.classList.toggle('oculto', !comExtra);
    if (!comExtra) motivo.querySelector('input').value = '';
    el.querySelector('.escala-painel-cancelar').disabled = salvando;
    el.querySelector('.escala-painel-salvar').disabled = salvando || !!passou || !!(E() && E().travado());
  }

  /* o que as telas mostram do rascunho (vazio sem mudança): o Dia e o Ciclo do dia aberto e a Extrajornada, do mês
     (trocar de dia com ela esperando não muda as telas) */
  function marcaDaPrevia() {
    var p = paraPrevia(), extra = X() ? X().marca() : '';
    if (!(p && (p.dia || p.ciclo)) && !extra) return '';
    return JSON.stringify([p && (p.dia || p.ciclo) ? [p.unidadeId, p.iso, p.dia, p.ciclo] : null, extra]);
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
        if (X()) X().descartar();
        redesenharAba();
        mudou();
      }
    });
  }

  /* a aba Ciclo ou Extrajornada aberta lê de novo (o Dia se redesenha sozinho) */
  function redesenharAba() {
    var c = contexto();
    if (c && (c.secao === 'continuos' || c.secao === 'extra') && RW.escalasPainel.recarregarSecao) RW.escalasPainel.recarregarSecao();
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

  /* grava (escala_painel_salvar) com o véu e, gravado, põe o dia gravado no painel e avisa as telas. Devolve uma
     Promise com { ok, r } ou { ok: false, erro, desatualizado } (quem chama avisa). O dia que mudou depois da leitura
     (outro administrador ou o sistema) tira o rascunho do Dia e lê o dia de novo */
  function enviar(c, dia, ciclo, extra, botao) {
    salvando = true;
    atualizar();
    if (botao) RW.iniciarCarregando(botao);
    if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // o ciclo recalcula a escala: círculo e tela travada
    return RW.escalasDados.painelSalvar(c.unidadeId, c.iso, dia, ciclo, extra).then(function (r) {
      salvando = false;
      if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
      if (botao) RW.pararCarregando(botao);
      var geral = RW.mensagens.geral;
      if (r && r._falha) { atualizar(); return { ok: false, erro: r._falha === 'conexao' ? geral.semConexao : geral.falhaServidor }; }
      if (!r || !r.success) {
        if (r && r.desatualizado) {
          if (E()) E().descartar();
          redesenharAba();
          mudou();
          return { ok: false, desatualizado: true, erro: msg().diaDesatualizado };
        }
        atualizar();
        return { ok: false, erro: msg().painelRecusado((r && r.error) || msg().falhaSalvar) };
      }
      if (E()) E().aposGravar(r);
      if (C()) C().limpar();
      if (X()) X().descartar();   // gravou: a extra é lida de novo, com o que mudou
      if (espera) { clearTimeout(espera); espera = null; }
      mostrado = marcaDaPrevia();   // as telas leem de novo logo abaixo, já sem o que foi gravado
      atualizar();
      window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: c.unidadeId, iso: c.iso } }));
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      redesenharAba();
      return { ok: true, r: r };
    });
  }

  function avisarFalha(res) { RW.avisar({ tipo: res.desatualizado ? 'aviso' : 'erro', mensagem: res.erro }); }

  function gravar(botao) {
    var c = contexto();
    if (!c || salvando || (E() && E().travado())) return;
    var dia = E() && E().pendentes() ? E().paraGravar() : null;
    var ciclo = doCiclo(c).length ? C().envio() : null;
    var campo = botao.closest('.escala-rodape-salvar').querySelector('.escala-rodape-motivo input');
    var extra = X() ? X().envio(campo.value.trim()) : null;
    if (!dia && !ciclo && !extra) return;
    enviar(c, dia, ciclo, extra, botao).then(function (res) {
      if (!res.ok) { avisarFalha(res); return; }
      var log = juntarLogs(res.r.logs || []);
      if (log && RW.resumo) RW.resumo.abrirModal(log, { pagina: 'Escala' });
    });
  }

  /* qualquer aviso dos rascunhos (também o painel que abre ou fecha) redesenha o rodapé; as telas, só com mudança */
  window.addEventListener('rosterwork_escala_rascunho', mudou);
  /* fechar ou recarregar o navegador, ou ir para outra página, com mudança no Dia ou no Ciclo: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(pendente);

  RW.escalasPainelSalvar = { rodape: rodape, atualizar: atualizar, contar: contar, contarDoDia: contarDoDia, pendente: pendente,
    descartar: descartar, paraPrevia: paraPrevia, marcado: marcado };
})();
