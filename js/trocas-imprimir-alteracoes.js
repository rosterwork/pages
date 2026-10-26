/* ============================================================
   TROCAS — o PDF Alterações do painel Imprimir trocas
   As alterações das trocas do mês, do livro de ocorrências de cada
   registro (correção, alteração do pedido, substituição,
   cancelamento e expiração), com quem fez, quando e o motivo. Não
   depende das trocas marcadas: lê os registros de todas as trocas do
   mês que a pessoa troca ou administra, em qualquer situação
   (fn_trocas_impressao, que confere troca a troca quem pode ver), e
   fica com os que têm alguma alteração. O que leu fica guardado por
   mês até o painel fechar.
   RosterWork.trocasImprimirAlteracoes.{ arquivo, limpar }
     arquivo(todas, mes, nomeMes) → Promise { arquivo, nome }; sem
       alteração no mês, rejeita com { semAlteracoes: true }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ALTERACOES = ['correcao', 'alteracao_pedido', 'substituicao', 'cancelamento', 'expiracao'];
  var lidos = {};   // os registros com alteração, por mês ("2026-10")

  function msg() { return RW.mensagens.trocas.imprimir; }
  function doisDig(n) { return n < 10 ? '0' + n : '' + n; }
  function chaveDoMes(data) { return data.getFullYear() + '-' + doisDig(data.getMonth() + 1); }

  /* uma troca por registro (o fn_trocas_registro lê o registro inteiro), das que a pessoa troca ou administra, em
     ordem de data */
  function trocasDoMes(todas, mes) {
    var cpf = RW.sessao.cpf(), vistos = {};
    return todas.filter(function (t) {
      return String(t.data_servico_solicitante).slice(0, 7) === mes &&
        (t.solicitante_cpf === cpf || t.parceiro_cpf === cpf || RW.trocasFormato.daMinhaArea(t));
    }).sort(function (a, b) {
      return String(a.data_servico_solicitante).localeCompare(String(b.data_servico_solicitante));
    }).filter(function (t) {
      var chave = t.registro_id || t.troca_id;
      if (vistos[chave]) return false;
      vistos[chave] = true;
      return true;
    }).map(function (t) { return t.troca_id; });
  }

  function temAlteracao(r) { return (r.acoes || []).some(function (a) { return ALTERACOES.indexOf(a.acao) >= 0; }); }

  /* os registros do mês com alguma alteração (lidos uma vez por mês) */
  function registros(todas, data) {
    var mes = chaveDoMes(data);
    if (lidos[mes]) return Promise.resolve(lidos[mes]);
    var ids = trocasDoMes(todas || [], mes);
    var promessa = ids.length ? RW.rpc('fn_trocas_impressao', { p_troca_ids: ids }) : Promise.resolve({ ok: true, registros: [] });
    return promessa.then(function (r) {
      if (!r || !r.ok) throw new Error('alteracoes');
      var vistos = {};
      lidos[mes] = (r.registros || []).filter(function (x) {
        var chave = x.registro.numero + '/' + x.registro.ano;
        if (vistos[chave] || !temAlteracao(x)) return false;
        vistos[chave] = true;
        return true;
      });
      return lidos[mes];
    });
  }

  function arquivo(todas, data, nomeMes) {
    return registros(todas, data).then(function (regs) {
      if (!regs.length) return Promise.reject({ semAlteracoes: true });
      return RW.trocasRelatorioPdf.alteracoes(regs, nomeMes).then(function (arq) {
        return { arquivo: arq, nome: msg().alteracoes.arquivo(doisDig(data.getMonth() + 1), data.getFullYear()) };
      });
    });
  }

  function limpar() { lidos = {}; }

  RW.trocasImprimirAlteracoes = { arquivo: arquivo, limpar: limpar };
})();
