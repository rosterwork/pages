/* ============================================================
   EXTRAJORNADA — o rascunho do mês (Escala e Extrajornada)
   As mudanças de extra que o administrador fez e ainda não salvou,
   para o mês inteiro. Cada mudança é o estado final de um militar
   num dia (a unidade e os horários de 6 h; sem horário, sai do dia).
   Serve à grade da Distribuição e ao painel do dia nas duas páginas:
   trocar de dia não perde nada, e o Salvar grava tudo de uma vez
   (extra_distribuicao_salvar; no painel do dia, o Salvar do rodapé
   grava junto com o Dia e o Ciclo, escala_painel_salvar). Quem desenha escuta o evento
   rosterwork_extra_rascunho. Cada página zera o rascunho ao abrir.
   RosterWork.escalasExtraRascunho.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var comp = null;      // 'AAAA-MM-01' do rascunho
  var mudancas = {};    // 'cpf|iso' → { cpf, data, unidade, blocos, antes: { unidade, blocos } | null, militar: { grad, nome } }
  var motivo = '';

  function chave(cpf, iso) { return cpf + '|' + iso; }
  function ordenar(b) { return (b || []).map(Number).sort(function (x, y) { return x - y; }); }
  function iguais(a, b) { return ordenar(a).join(',') === ordenar(b).join(','); }
  function avisar(detalhe) { window.dispatchEvent(new CustomEvent('rosterwork_extra_rascunho', { detail: detalhe || {} })); }

  /* o mês do rascunho: outro mês começa um rascunho novo */
  function mes(competencia) {
    if (competencia === comp) return;
    comp = competencia;
    mudancas = {};
    motivo = '';
  }

  /* muda um militar num dia; voltar ao que está salvo tira a mudança.
     m = { cpf, data, unidade, blocos, antes: { unidade, blocos } | null, militar: { grad, nome } } */
  function definir(m) {
    mes(String(m.data).slice(0, 8) + '01');
    var k = chave(m.cpf, m.data);
    var antes = mudancas[k] ? mudancas[k].antes : (m.antes || null);
    var blocos = ordenar(m.blocos);
    var igual = antes && antes.blocos && antes.blocos.length
      ? (blocos.length > 0 && String(antes.unidade) === String(m.unidade) && iguais(antes.blocos, blocos))
      : blocos.length === 0;
    if (igual) delete mudancas[k];
    else mudancas[k] = { cpf: m.cpf, data: m.data, unidade: Number(m.unidade), blocos: blocos, antes: antes, militar: m.militar || null };
    avisar({ cpf: m.cpf, data: m.data });
  }

  function obter(cpf, iso) { return mudancas[chave(cpf, iso)] || null; }
  function lista() { return Object.keys(mudancas).map(function (k) { return mudancas[k]; }); }
  function doDia(iso) { return lista().filter(function (m) { return m.data === iso; }); }
  function doMilitar(cpf) { return lista().filter(function (m) { return m.cpf === cpf; }); }
  function contar() { return Object.keys(mudancas).length; }
  function dias() { var d = {}; lista().forEach(function (m) { d[m.data] = true; }); return Object.keys(d).length; }
  function sujo() { return contar() > 0; }

  /* as extras de um militar no mês com o rascunho por cima. salvos = [{ data, unidade_id, unidade_nome, blocos }] */
  function aplicar(cpf, salvos) {
    var porDia = {};
    (salvos || []).forEach(function (e) {
      porDia[e.data] = { data: e.data, unidade_id: Number(e.unidade_id), unidade_nome: e.unidade_nome || '', blocos: ordenar(e.blocos) };
    });
    doMilitar(cpf).forEach(function (m) {
      if (m.blocos.length) porDia[m.data] = { data: m.data, unidade_id: m.unidade, unidade_nome: (porDia[m.data] && porDia[m.data].unidade_id === m.unidade) ? porDia[m.data].unidade_nome : '', blocos: m.blocos };
      else delete porDia[m.data];
    });
    return Object.keys(porDia).sort().map(function (d) { return porDia[d]; });
  }

  function limpar() { mudancas = {}; motivo = ''; avisar({ limpou: true }); }
  /* a página abriu: começa sem rascunho (sair da página com mudança já pediu para descartar) */
  function zerar() { comp = null; mudancas = {}; motivo = ''; }

  /* Cancelar: confirma e descarta tudo; depois roda o "depois" (ex.: fechar o painel) */
  function cancelar(depois) {
    if (!sujo()) { if (depois) depois(); return; }
    RW.confirmar({
      tipo: 'aviso',
      mensagem: RW.mensagens.escala.extraPainel.descartar(contar()),
      textoConfirmar: RW.mensagens.botoes.descartar,
      textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { limpar(); if (depois) depois(); }
    });
  }

  /* grava tudo de uma vez; devolve uma promessa com true quando gravou.
     opcoes.semResumo: não abre o resumo (o Lançar na escala abre o dele logo depois) */
  function salvar(botao, opcoes) {
    opcoes = opcoes || {};
    if (!sujo()) return Promise.resolve(true);
    if (botao) RW.iniciarCarregando(botao);
    var envio = lista().map(function (m) { return { cpf: m.cpf, data: m.data, unidade: m.unidade, blocos: m.blocos }; });
    return RW.rpc('extra_distribuicao_salvar', { p_competencia: comp, p_mudancas: envio, p_motivo: motivo || null }).then(function (r) {
      if (botao) RW.pararCarregando(botao);
      if (!r || !r.success) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return false; }
      mudancas = {};
      motivo = '';
      if (r.log && RW.resumo && !opcoes.semResumo) RW.resumo.abrirModal(r.log, { pagina: 'Extrajornada' });
      avisar({ salvou: true });
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      return true;
    }, function () {
      if (botao) RW.pararCarregando(botao);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      return false;
    });
  }

  /* o Salvar do painel do dia (escalas-painel-salvar.js) grava o rascunho junto com o Dia e o Ciclo: o que vai ao banco
     e, depois de gravar, o rascunho vazio (a página relê) */
  function envio() {
    return { competencia: comp, motivo: motivo || null,
      mudancas: lista().map(function (m) { return { cpf: m.cpf, data: m.data, unidade: m.unidade, blocos: m.blocos }; }) };
  }
  function aposGravar() { mudancas = {}; motivo = ''; avisar({ salvou: true }); }

  /* fechar ou recarregar o navegador com o rascunho: o navegador avisa */
  if (RW.guardaSaida) RW.guardaSaida.registrar(sujo);

  RW.escalasExtraRascunho = {
    mes: mes, definir: definir, obter: obter, lista: lista, doDia: doDia, doMilitar: doMilitar,
    contar: contar, dias: dias, sujo: sujo, aplicar: aplicar, limpar: limpar, zerar: zerar,
    cancelar: cancelar, salvar: salvar, envio: envio, aposGravar: aposGravar,
    motivo: function (v) { if (typeof v === 'string') motivo = v; return motivo; },
    competencia: function () { return comp; }
  };
})();
