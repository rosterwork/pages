/* ============================================================
   ESCALAS — Remover militar › por troca (a parte de quem está no
   dia por uma troca; o resto do Remover mora no
   escalas-painel-remover.js). Quem volta é quem foi coberto no
   dia (o dono do serviço). O banco (fn_trocas_cancelar_dia) diz o
   documento (o RW) e as datas futuras de troca entre os dois que
   acertam as horas e, num ensaio, como fica. As perguntas, uma de
   cada vez, sem nada marcado:
     · O que fazer: cancelar uma troca futura entre os dois
       (desligada, com "Não há dia futuro.", quando não há) ou não;
     · Qual troca sai junto: as datas;
     · ou Para onde vão as horas: saldo de horas (quem sai fica
       devendo), banco de horas (desconta de quem volta) ou nenhum;
     · o Motivo, sempre.
   Embaixo, os documentos alterados (o sistema escolhe), a nota
   Como fica e o compromisso de quem volta (avisa, não trava).
   Confirmar grava tudo de uma vez, sem Desfazer: o véu, o resumo e
   o dia lido de novo.
   API: RosterWork.escalasPainelRemoverTroca.criar(cfg) devolve
   { mostrar(mil, parte), esconder(), aplicar() };
   cfg = { raiz, iso, pronto(texto, ligado), aoGravar() }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var conta = 0;               // nome único para os rádios de cada abertura
  var cancelarGuarda = null;   // o guarda de saída do motivo (um Remover aberto por vez)

  function L() { return RW.mensagens.escala.linha; }
  function H() { return RW.escalasPainelEditar.sub.horas; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function mostra(caixa, sim) { caixa.classList.toggle('oculto', !sim); }
  /* só uma parte do serviço (com horário próprio) */
  function parcial(d) { return !!(d.inicio && d.fim && d.inicio !== d.fim); }
  /* "das 08h às 20h" ou, no serviço inteiro, "24 horas" */
  function horasDe(d) { return parcial(d) ? RW.mensagens.escala.dasAs(H().curta(d.inicio), H().curta(d.fim)) : H().horasTexto(d.minutos); }
  /* liga os rádios de uma caixa a um nome só e devolve a função que marca o valor (null: nenhum marcado) */
  function ligarRadios(caixa, nome, aoEscolher) {
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function (valor) { [].forEach.call(radios, function (r) { r.checked = valor !== null && r.value === valor; }); };
  }

  function criar(cfg) {
    var raiz = cfg.raiz;
    var q = function (s) { return raiz.querySelector(s); };
    var el = {
      rw: q('.escala-remover-troca-rw'), dias: q('.escala-remover-troca-dias'),
      fazer: q('.escala-remover-troca-fazer'), semFuturo: q('.escala-remover-troca-sem-futuro'),
      junto: q('.escala-remover-troca-junto'), juntoLista: q('.escala-remover-troca-junto-lista'),
      horas: q('.escala-remover-troca-horas'), horasTotal: q('.escala-remover-troca-horas-total'),
      docs: q('.escala-remover-troca-docs'), docsLista: q('.escala-remover-troca-docs-lista'), motivo: q('.escala-remover-troca-motivo'),
      efeito: q('.escala-remover-troca-efeito'), conflito: q('.escala-remover-troca-conflito'), erro: q('.escala-remover-troca-erro')
    };
    var campo = el.motivo.querySelector('textarea');
    /* fazer: null, 'troca' ou 'outra'; junto: null ou { troca_id, parte }; horas: null, 'saldo', 'banco' ou 'nenhum' */
    var est = { chave: null };
    var visivel = false;
    var pedido = 0;   // vale a resposta mais recente (o plano e cada ensaio)
    var nomeJunto = 'escala-remover-troca-junto-' + (++conta);
    var marcarFazer = ligarRadios(el.fazer, 'escala-remover-troca-fazer-' + (++conta), function (v) { est.fazer = v; ensaiar(); });
    var marcarHoras = ligarRadios(el.horas, 'escala-remover-troca-horas-' + (++conta), function (v) { est.horas = v; ensaiar(); });
    campo.addEventListener('input', function () { if (RW.campos) RW.campos.limparErro(campo); });
    /* o motivo escrito e não enviado: o navegador avisa antes de sair */
    if (cancelarGuarda) cancelarGuarda();
    cancelarGuarda = RW.guardaSaida ? RW.guardaSaida.registrar(function () {
      return document.contains(campo) && visivel && campo.value.trim() !== '';
    }) : null;

    /* a resposta, como o banco entende: 'troca' (com a data), 'saldo', 'banco', 'nenhum' ou null (falta responder) */
    function acao() {
      if (est.fazer === 'troca') return est.junto ? 'troca' : null;
      return est.fazer === 'outra' ? est.horas : null;
    }

    function chamar(extra) {
      var o = { trocaId: est.trocaId, data: cfg.iso, cpf: est.mil.cpf };
      Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
      return RW.trocasDados.cancelarDia(o);
    }

    function mostrar(mil, parte) {
      visivel = true;
      raiz.classList.remove('oculto');
      var chave = parte.trocaId + '|' + mil.cpf;
      if (chave === est.chave && est.plano) { desenhar(); return; }
      est = { chave: chave, mil: mil, trocaId: parte.trocaId, plano: null, fazer: null, junto: null, horas: null, previa: null };
      campo.value = '';
      carregar();
    }

    function esconder() {
      visivel = false;
      raiz.classList.add('oculto');
    }

    /* o plano: o documento, as horas deste dia e as datas futuras que acertam as horas */
    function carregar() {
      var meu = ++pedido;
      ['fazer', 'junto', 'horas', 'docs', 'motivo', 'efeito', 'conflito', 'erro'].forEach(function (k) { mostra(el[k], false); });
      el.rw.textContent = '';
      el.dias.textContent = '';
      var pontos = RW.tpl('carregando-pontos');
      if (pontos) el.dias.appendChild(pontos);
      if (visivel) cfg.pronto(L().escolhaFazer, false);
      chamar().then(function (r) {
        if (meu !== pedido || !raiz.isConnected) return;
        el.dias.textContent = '';
        if (!r || !r.ok) { mostrarErro((r && r.erro) || RW.mensagens.escala.falhaCarregar); return; }
        est.plano = r;
        montarDocumento();
        montarPerguntas();
        desenhar();
      }, function () { if (meu === pedido) mostrarErro(RW.mensagens.geral.semConexao); });
    }

    function mostrarErro(texto) {
      el.erro.querySelector('.nota-texto').textContent = texto;
      mostra(el.erro, true);
    }

    /* o RW e os dias dele (o deste dia em destaque) */
    function montarDocumento() {
      var p = est.plano;
      el.rw.textContent = L().trocaRw(p.registro.numero, p.registro.ano);
      (p.dias || []).forEach(function (d) {
        var linha = RW.tpl('tpl-escala-remover-troca-dia');
        if (!linha) return;
        linha.classList.toggle('escala-remover-troca-dia--este', !!d.este);
        linha.querySelector('.escala-remover-troca-dia-data').textContent = L().trocaDia(diaMes(d.data), horasDe(d));
        linha.querySelector('.escala-remover-troca-dia-texto').textContent = L().trocaNoLugar(d.cumpre, d.no_lugar_de);
        el.dias.appendChild(linha);
      });
    }

    /* as perguntas: sem data futura, a primeira opção fica desligada; as datas; os nomes nas opções das horas */
    function montarPerguntas() {
      var p = est.plano;
      var semData = !p.junto.length;
      el.fazer.querySelector('input[value="troca"]').disabled = semData;
      mostra(el.semFuturo, semData);
      marcarFazer(null);
      marcarHoras(null);
      el.horasTotal.textContent = H().horasTexto(p.minutos);
      [].forEach.call(el.horas.querySelectorAll('.escala-remover-troca-sai'), function (s) { s.textContent = p.sai; });
      [].forEach.call(el.horas.querySelectorAll('.escala-remover-troca-volta'), function (s) { s.textContent = p.volta; });
      el.juntoLista.textContent = '';
      p.junto.forEach(function (j) {
        var op = RW.tpl('tpl-escala-remover-parte');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nomeJunto;
        r.value = j.troca_id + '|' + j.parte;
        r.addEventListener('change', function () { if (r.checked) { est.junto = { troca_id: j.troca_id, parte: j.parte }; ensaiar(); } });
        op.querySelector('.escala-remover-parte-texto').textContent = L().trocaDia(diaMes(j.data), horasDe(j));
        el.juntoLista.appendChild(op);
      });
    }

    /* Como fica: quem volta (ou quem sai e quem continua de folga), o banco de horas e o saldo */
    function textoEfeito(prev, qual) {
      var p = est.plano, frases = [];
      if (qual === 'banco' || qual === 'nenhum') {
        frases.push(L().trocaDeixa(diaMes(cfg.iso), p.sai, p.volta));
        if (prev.banco) frases.push(L().trocaBanco(prev.banco.quem, H().horasTexto(prev.banco.minutos), prev.banco.depois < 0));
        else frases.push(L().trocaSemMudanca);
        return frases.join(' ');
      }
      (prev.dias || []).forEach(function (d) { frases.push(L().trocaVolta(diaMes(d.data), parcial(d) ? horasDe(d) : '', d.volta)); });
      var saldos = prev.saldos || [];
      if (!saldos.length) frases.push(L().trocaSemSaldo);
      saldos.forEach(function (s) { frases.push(L().trocaSaldo(s.deve, H().horasTexto(s.minutos), s.a)); });
      return frases.join(' ');
    }

    function desenhar() {
      var p = est.plano;
      if (!p) return;
      var qual = acao(), prev = qual ? est.previa : null;
      mostra(el.fazer, true);
      mostra(el.junto, est.fazer === 'troca');
      mostra(el.horas, est.fazer === 'outra');
      mostra(el.motivo, !!qual);
      /* os documentos alterados: o sistema escolhe (só quando alguma troca muda) */
      el.docsLista.textContent = '';
      ((prev && !prev.erro && prev.documentos) || []).forEach(function (d) {
        var linha = RW.tpl('tpl-escala-remover-troca-doc-linha');
        if (!linha) return;
        linha.textContent = L().trocaDoc(d.numero, d.ano, d.parte_numero, d.parte_ano);
        el.docsLista.appendChild(linha);
      });
      mostra(el.docs, el.docsLista.children.length > 0);
      mostra(el.erro, !!(prev && prev.erro));
      if (prev && prev.erro) el.erro.querySelector('.nota-texto').textContent = prev.erro;
      if (prev && !prev.erro) el.efeito.querySelector('.nota-texto').textContent = textoEfeito(prev, qual);
      mostra(el.efeito, !!qual && !(prev && prev.erro));
      var conflitos = (prev && !prev.erro && prev.conflitos) || [];
      el.conflito.querySelector('.nota-texto').textContent = conflitos.map(function (c) {
        return L().trocaConflito(c.tipo, c.quem, diaMes(c.data));
      }).join(' ');
      mostra(el.conflito, conflitos.length > 0);
      if (!visivel) return;
      var texto = !est.fazer ? L().escolhaFazer : !qual ? (est.fazer === 'troca' ? L().escolhaTroca : L().escolhaHoras)
        : (qual === 'troca' || qual === 'saldo') ? L().confirmarCancelamento : L().removerDoDia(p.sai);
      cfg.pronto(texto, !!prev && !prev.erro);
    }

    /* o ensaio: o banco faz e desfaz e devolve como fica, ou a recusa */
    function ensaiar() {
      est.previa = null;
      var qual = acao();
      if (!qual) { ++pedido; desenhar(); return; }
      var meu = ++pedido;
      var nota = el.efeito.querySelector('.nota-texto'), pontos = RW.tpl('carregando-pontos');
      desenhar();
      nota.textContent = '';
      if (pontos) nota.appendChild(pontos);
      chamar({ acao: qual, junto: qual === 'troca' ? est.junto : null, ensaio: true }).then(function (r) {
        if (meu !== pedido || !raiz.isConnected) return;
        est.previa = r && r.ok ? r.previa : { erro: (r && r.erro) || RW.mensagens.escala.falhaCarregar };
        desenhar();
      }, function () {
        if (meu !== pedido) return;
        est.previa = { erro: RW.mensagens.geral.semConexao };
        desenhar();
      });
    }

    /* grava de verdade (o motivo é obrigatório) e relê o dia */
    function aplicar() {
      var qual = acao();
      if (!qual || !est.previa || est.previa.erro) return;
      var motivo = campo.value.trim();
      if (!motivo) {
        if (RW.campos) RW.campos.marcarErro(campo, RW.mensagens.trocas.cancelarMotivo.erro);
        campo.focus();
        return;
      }
      if (RW.mostrarVeuGlobal) RW.mostrarVeuGlobal();   // recalcula a escala: círculo e tela travada
      chamar({ acao: qual, junto: qual === 'troca' ? est.junto : null, motivo: motivo }).then(function (r) {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || RW.mensagens.geral.falhaServidor }); return; }
        campo.value = '';
        window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Escala' });
        cfg.aoGravar();
      }, function () {
        if (RW.esconderVeuGlobal) RW.esconderVeuGlobal();
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
    }

    return { mostrar: mostrar, esconder: esconder, aplicar: aplicar };
  }

  RW.escalasPainelRemoverTroca = { criar: criar };
})();
