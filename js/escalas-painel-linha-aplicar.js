/* ============================================================
   ESCALAS — as mudanças da edição da linha no rascunho do Dia
   (escalas-painel-linha.js monta o cartão; aqui, o que cada escolha
   muda, sempre dentro de um mudar() do escalas-painel-editar.js,
   que grava como um passo só):
   - trocar: quem entra (já de serviço no dia) senta na função
     (fixado) e quem estava sai daquele horário; quem entra deixa as
     outras funções do horário, que ficam vazias;
   - o horário nesta função, o "Ninguém" (a função fica vazia no
     horário) e liberar (o ícone da linha).
   cfg = { tipo, posto, funcao, militar, periodos } (a linha)
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function mesmoLugar(e, posto, funcao) { return e.posto.id === posto.id && e.funcao === funcao; }
  function cruzaAlgum(per, periodos) {
    var H = ed().horas, f = H.faixa(per);
    return periodos.some(function (p) { return !!H.cruza(f, H.faixa(p)); });
  }

  /* quem está na função nesses horários (fora quem não conta): [{ m, x: [início, fim] }] */
  function ocupantes(posto, nomeFuncao, periodos, fora) {
    var api = ed(), H = api.horas, r = [], f = api.acharFuncao(posto, nomeFuncao);
    ((f && f.militares) || []).forEach(function (o) {
      if (fora && o.cpf === fora) return;
      (o.periodos || []).forEach(function (per) {
        periodos.forEach(function (w) { var x = H.cruza(H.faixa(w), H.faixa(per)); if (x) r.push({ m: o, x: x }); });
      });
    });
    return r;
  }

  /* as outras funções do militar nesses horários (fora a desta linha) */
  function outrasFuncoes(cpf, cfg, periodos) {
    return ed().funcoesDoMilitar(cpf).filter(function (e) {
      return !(cfg.posto && mesmoLugar(e, cfg.posto, cfg.funcao)) && e.periodos.some(function (p) { return cruzaAlgum(p, periodos); });
    });
  }

  /* trocar: c = quem entra (o que o banco mandou, já de serviço no dia). Ele deixa as outras funções do horário: o
     automático deixa de valer ali (acumula = false) e o que ele tinha fixado sai */
  function trocar(cfg, c, periodos) {
    var api = ed(), H = api.horas, r = api.rascunho();
    api.aplicarColocacao({ cpf: c.cpf, posto: cfg.posto, funcao: cfg.funcao, periodos: periodos, sistema: false, pontual: null });
    if (!(c.funcoes || []).length) return;
    r.ajustes.forEach(function (a) { if (a.acao === 'colocar' && a.cpf === c.cpf && api.noLocal(a, cfg.posto, cfg.funcao)) a.acumula = false; });
    api.funcoesDoMilitar(c.cpf).forEach(function (e) {
      if (!e.fixado || mesmoLugar(e, cfg.posto, cfg.funcao)) return;
      e.periodos.forEach(function (per) {
        periodos.forEach(function (w) { var x = H.cruza(H.faixa(w), H.faixa(per)); if (x) api.deixarFuncao(c.cpf, e.posto, e.funcao, H.periodo(x)); });
      });
    });
  }

  /* o atalho da nota O que mudou: quem saiu e ficou sem função vai para o lugar que quem entrou deixou (só daqui). Sem
     atalho quando quem entrou é o Chefe de Socorro ou o Oficial de Área: o sistema refaz o dia em volta dele */
  function sugestao(cfg, c, textos) {
    var api = ed(), m = cfg.militar;
    if (!c || !m || cfg.tipo !== 'funcao' || c.grupo === 'outro_pelotao' || !(c.funcoes || []).length) return null;
    if (c.funcoes.some(function (f) { return /^(chefe de socorro|oficial de área)$/i.test(f.funcao); })) return null;
    if (outrasFuncoes(m.cpf, cfg, cfg.periodos).length) return null;
    var lugares = [];
    c.funcoes.forEach(function (f) {
      var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
      if (posto) lugares.push({ posto: posto, funcao: f.funcao, periodos: [{ hi: f.hi, hf: f.hf }] });
    });
    if (!lugares.length) return null;
    return { cpf: m.cpf, texto: lugares.length === 1 ? textos.um(lugares[0].funcao) : textos.varios, lugares: lugares };
  }

  /* o "Ninguém": a função fica vazia nos horários dados, ou em todos os dele (ele continua de serviço). Fixado no lugar
     de outro, o outro não volta: sai também */
  function tirarDaFuncao(cfg, periodos) {
    var api = ed(), H = api.horas, r = api.rascunho(), m = cfg.militar;
    (periodos || m.periodos || []).forEach(function (per) {
      if (m.fixado) {
        r.ajustes.filter(function (a) {
          return a.acao === 'colocar' && a.cpf === m.cpf && a.substitui && a.substitui !== m.cpf && api.noLocal(a, cfg.posto, cfg.funcao) && H.cruza(H.faixa(a), H.faixa(per));
        }).forEach(function (a) {
          var pr = H.periodo(H.cruza(H.faixa(a), H.faixa(per)));
          r.ajustes.push({ acao: 'tirar', cpf: a.substitui, nome_funcao: cfg.funcao, viatura_id: a.viatura_id || null, instalacao_id: a.instalacao_id || null, hi: pr.hi, hf: pr.hf });
        });
      }
      api.deixarFuncao(m.cpf, cfg.posto, cfg.funcao, per);
    });
  }

  /* o horário do militar na função mudou: o que saiu deixa de ser dele; quem estava no horário novo sai dali */
  function mudarHorario(cfg, periodos) {
    var api = ed(), H = api.horas, r = api.rascunho(), m = cfg.militar;
    var abertura = r.ajustes.filter(function (a) { return a.acao === 'colocar' && a.cpf === m.cpf && api.noLocal(a, cfg.posto, cfg.funcao); })
      .map(function (a) { return { posto: cfg.posto, funcao: cfg.funcao, hi: a.hi, hf: a.hf, manual: true, subst: a.substitui || null, acumula: a.acumula !== false, intacta: true }; });
    if (!m.fixado) (m.periodos || []).forEach(function (per) {
      abertura.push({ posto: cfg.posto, funcao: cfg.funcao, hi: per.hi, hf: per.hf, manual: false, subst: m.cpf, acumula: true, intacta: true });
    });
    /* ele em outra linha desta função (outro horário, com alguém no meio): as colocações de lá ficam como estão */
    var outras = abertura.filter(function (l) { return l.manual && !cruzaAlgum(l, m.periodos || []); });
    var daLinha = abertura.filter(function (l) { return outras.indexOf(l) < 0; });
    var subst = daLinha.length && daLinha[0].manual ? daLinha[0].subst : m.cpf;
    api.aplicarMilitar(m.cpf, abertura, periodos.map(function (p) {
      return { posto: cfg.posto, funcao: cfg.funcao, hi: p.hi, hf: p.hf, manual: true, subst: subst, acumula: true, intacta: false };
    }).concat(outras));
    ocupantes(cfg.posto, cfg.funcao, periodos, m.cpf).forEach(function (o) { api.deixarFuncao(o.m.cpf, cfg.posto, cfg.funcao, H.periodo(o.x)); });
  }

  /* Liberar para o sistema: o fixado nos horários da linha (ou o tirar que deixou a função vazia) sai; o sistema refaz
     o dia mexendo o mínimo */
  function liberar(cfg) {
    var api = ed(), r = api.rascunho(), m = cfg.militar;
    r.ajustes = r.ajustes.filter(function (a) {
      if (!api.noLocal(a, cfg.posto, cfg.funcao)) return true;
      if (cfg.tipo === 'funcao') return !(a.acao === 'colocar' && a.cpf === m.cpf && cruzaAlgum(a, cfg.periodos));
      return !(a.acao === 'tirar' && cruzaAlgum(a, cfg.periodos));
    });
  }
  /* o Liberar vale para o fixado da linha, ou para o vazio que veio de um tirar */
  function podeLiberar(cfg) {
    var api = ed();
    if (cfg.tipo === 'funcao') return !!cfg.militar.fixado;
    if (cfg.tipo !== 'vaga') return false;
    return api.rascunho().ajustes.some(function (a) { return a.acao === 'tirar' && api.noLocal(a, cfg.posto, cfg.funcao) && cruzaAlgum(a, cfg.periodos); });
  }

  window.RosterWork.escalasPainelLinhaAplicar = {
    ocupantes: ocupantes, outrasFuncoes: outrasFuncoes, trocar: trocar, sugestao: sugestao, tirarDaFuncao: tirarDaFuncao,
    mudarHorario: mudarHorario, liberar: liberar, podeLiberar: podeLiberar
  };
})();
