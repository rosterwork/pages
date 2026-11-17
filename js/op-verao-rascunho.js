/* ============================================================
   OP. VERÃO — o rascunho dos dias e o rodapé largo
   O que as caixas da grade mudam (op-verao-caixa.js) entra aqui, dia
   por dia (a lista inteira do dia da companhia, com os Oficiais de
   Praia), e a grade mostra na hora (op-verao-celula.js). Cada mudança
   é um passo: o Desfazer e o Refazer do rodapé (também Ctrl+Z e
   Ctrl+Y) andam por eles. O rodapé largo (.op-verao-rodape, no
   escalas.html) aparece com mudança não salva e enquanto há o que
   refazer: a frase com quantas, o Cancelar (pergunta antes de
   descartar) e o Salvar, que grava os dias de cada companhia
   (op_verao_salvar → Histórico → resumo), lê a grade de novo e abre
   o resumo. Fechar ou recarregar o navegador, ou ir para outra
   página, com mudança não salva: o aviso (geral-guarda-saida).
   Não cria HTML nem escreve estilo.
   RosterWork.opVeraoRascunho.{ ligar, mudar, nova, copia }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var feitos = [];      // os passos: { cia, iso, antes (null: o gravado), depois }
  var desfeitos = [];   // os passos desfeitos, que o Refazer refaz
  var seq = 0;          // a chave das linhas novas
  var salvando = false;
  var raiz = null;      // a página aberta (o rodapé dela)

  function C() { return RW.opVeraoCelula; }
  function msg() { return RW.mensagens.opVerao; }
  function rodape() { return raiz && raiz.isConnected ? raiz.querySelector('.op-verao-rodape') : null; }

  /* as linhas de um dia, copiadas (a caixa muda a cópia; o rascunho guarda outra) */
  function copia(linhas) { return (linhas || []).map(function (l) { return Object.assign({}, l); }); }

  /* uma linha nova: sem id, ela entra no Salvar */
  function nova(dados) {
    return Object.assign({ id: null, chave: 'novo-' + (++seq), oficial: false, cpf: null, civil_id: null, posto_id: null,
      posto_nome: null, conflito: null }, dados);
  }

  /* o que se grava de uma linha (para comparar com o gravado) */
  function forma(l) {
    return [l.id || '', l.oficial ? 1 : 0, l.cpf || '', l.civil_id || '', l.inicio, l.fim, l.posto_id || ''].join('|');
  }
  function iguais(a, b) {
    if (a.length !== b.length) return false;
    var fa = a.map(forma).sort(), fb = b.map(forma).sort();
    return fa.every(function (x, i) { return x === fb[i]; });
  }

  /* quantas mudanças o dia tem: cada linha que entra, sai ou muda */
  function contarDia(cia, iso) {
    var g = C().gravadas(cia, iso), a = C().linhasDoDia(cia, iso), n = 0;
    a.forEach(function (l) {
      var o = l.id ? g.filter(function (x) { return x.id === l.id; })[0] : null;
      if (!o || forma(o) !== forma(l)) n++;
    });
    g.forEach(function (o) { if (!a.some(function (l) { return l.id === o.id; })) n++; });
    return n;
  }
  function total() {
    return C().diasComRascunho().reduce(function (n, d) { return n + contarDia(d.cia, d.iso); }, 0);
  }

  /* ---------- os passos ---------- */

  /* a lista do dia vira o rascunho (igual à gravada: o rascunho sai) */
  function aplicar(cia, iso, linhas) {
    C().rascunho(cia, iso, linhas && !iguais(linhas, C().gravadas(cia, iso)) ? copia(linhas) : null);
    atualizar();
  }

  /* uma mudança da caixa: a lista nova do dia inteiro */
  function mudar(cia, iso, linhas) {
    var antes = C().temRascunho(cia, iso) ? copia(C().linhasDoDia(cia, iso)) : null;
    feitos.push({ cia: String(cia), iso: iso, antes: antes, depois: copia(linhas) });
    desfeitos = [];
    aplicar(cia, iso, linhas);
  }

  function voltar(desfazer) {
    var de = desfazer ? feitos : desfeitos, para = desfazer ? desfeitos : feitos;
    var p = de.pop();
    if (!p) return;
    para.push(p);
    if (RW.opVeraoCaixa) RW.opVeraoCaixa.fechar();
    aplicar(p.cia, p.iso, desfazer ? p.antes : p.depois);
  }

  /* ---------- o rodapé ---------- */

  function atualizar() {
    var el = rodape();
    if (!el) return;
    var n = total();
    el.classList.toggle('oculto', !n && !desfeitos.length);
    el.querySelector('.op-verao-rodape-texto').textContent = n ? RW.mensagens.escala.alteracoesNaoSalvas(n) : '';
    el.querySelector('.op-verao-desfazer').disabled = salvando || !feitos.length;
    el.querySelector('.op-verao-refazer').disabled = salvando || !desfeitos.length;
    el.querySelector('.op-verao-cancelar').disabled = salvando;
    el.querySelector('.op-verao-salvar').disabled = salvando || !n;
  }

  /* o Cancelar: sem volta, pergunta antes */
  function descartar() {
    if (RW.opVeraoCaixa) RW.opVeraoCaixa.fechar();
    C().diasComRascunho().forEach(function (d) { C().rascunho(d.cia, d.iso, null); });
    feitos = [];
    desfeitos = [];
    atualizar();
  }
  function cancelar() {
    var n = total();
    if (!n) { descartar(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().descartar(n),
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: descartar
    });
  }

  /* o Salvar: os dias de cada companhia num pedido (quase sempre uma só); no fim, a grade lida de novo e o resumo */
  function salvar() {
    var dias = C().diasComRascunho();
    if (!dias.length || salvando) return;
    if (RW.opVeraoCaixa) RW.opVeraoCaixa.fechar();
    var porCia = {};
    dias.forEach(function (d) {
      (porCia[d.cia] = porCia[d.cia] || []).push({ dia: d.iso, linhas: C().linhasDoDia(d.cia, d.iso).map(function (l) {
        return { id: l.id || null, oficial: !!l.oficial, cpf: l.cpf || null, civil_id: l.civil_id || null, inicio: l.inicio,
          fim: l.fim, posto_id: l.posto_id || null };
      }) });
    });
    var cias = Object.keys(porCia), logs = [];
    salvando = true;
    atualizar();
    var etapas = RW.etapas.acao('opVeraoSalvar', {}, { doServidor: 1, botao: rodape() && rodape().querySelector('.op-verao-salvar') });
    function falhou(texto) {
      salvando = false;
      atualizar();
      /* a companhia que já gravou (mais de uma na tela): a grade lê de novo */
      if (logs.length) window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      etapas.parar();
      RW.avisar({ tipo: 'erro', mensagem: texto });
    }
    function fim() {
      salvando = false;
      feitos = [];
      desfeitos = [];
      atualizar();
      etapas.ultima();
      var leu = C().esperarLeitura();
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      /* a grade nova chegou (ou a leitura demorou demais: o que foi gravado já está na tela) */
      Promise.race([leu, new Promise(function (r) { setTimeout(r, 15000); })]).then(function () {
        etapas.parar();
        if (logs[0] && RW.resumo) RW.resumo.abrirModal(logs[0], { pagina: msg().civil.pagina });
      });
    }
    (function proxima(i) {
      if (i >= cias.length) { fim(); return; }
      RW.rpc('op_verao_salvar', { p_unidade: Number(cias[i]), p_dias: porCia[cias[i]] }).then(function (r) {
        if (!r || !r.success) { falhou((r && r.error) || RW.mensagens.geral.falhaServidor); return; }
        porCia[cias[i]].forEach(function (d) { C().gravou(cias[i], d.dia); });
        if (r.log) logs.push(r.log);
        proxima(i + 1);
      }, function () { falhou(RW.mensagens.geral.semConexao); });
    })(0);
  }

  /* a página abriu (op-verao.js): começa limpa e liga os botões do rodapé dela */
  function ligar(pagina) {
    raiz = pagina;
    feitos = [];
    desfeitos = [];
    salvando = false;
    C().limpar();
    var el = rodape() || (pagina && pagina.querySelector('.op-verao-rodape'));
    if (!el || el.dataset.ligado) return;
    el.dataset.ligado = '1';
    el.querySelector('.op-verao-desfazer').addEventListener('click', function () { voltar(true); });
    el.querySelector('.op-verao-refazer').addEventListener('click', function () { voltar(false); });
    el.querySelector('.op-verao-cancelar').addEventListener('click', cancelar);
    el.querySelector('.op-verao-salvar').addEventListener('click', salvar);
  }

  /* o Ctrl+Z desfaz e o Ctrl+Y (ou o Ctrl+Shift+Z) refaz, fora dos campos de texto e sem janela de aviso aberta */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !C() || !C().ativa() || !rodape() || salvando) return;
    var alvo = e.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
    if (document.querySelector('.modal-veu--aberto')) return;
    var tecla = (e.key || '').toLowerCase();
    var desfazer = tecla === 'z' && !e.shiftKey, refazer = tecla === 'y' || (tecla === 'z' && e.shiftKey);
    if (!desfazer && !refazer) return;
    e.preventDefault();
    voltar(desfazer);
  });

  /* fechar ou recarregar o navegador, ou ir para outra página, com mudança não salva: o aviso */
  if (RW.guardaSaida) RW.guardaSaida.registrar(function () { return !!C() && C().ativa() && !!rodape() && total() > 0; });

  RW.opVeraoRascunho = { ligar: ligar, mudar: mudar, nova: nova, copia: copia };
})();
