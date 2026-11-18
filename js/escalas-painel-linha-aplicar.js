/* ============================================================
   ESCALAS — as mudanças da edição da linha no rascunho do Dia
   (escalas-painel-linha.js monta o cartão; aqui, o que cada escolha
   muda, sempre dentro de um mudar() do escalas-painel-editar.js,
   que grava como um passo só):
   - trocar: quem entra (já de serviço no dia) senta na função
     (fixado) e quem estava sai daquele horário; quem entra, pelo Onde
     ele já está, deixa as outras funções do horário, que ficam vazias
     (Sai de lá), ou fica fixado nelas também (Fica também lá);
   - o horário nesta função, o "Ninguém" (a função fica vazia no
     horário; na função que o modelo acumula, o fixado sai e o acúmulo
     volta) e liberar (o ícone da linha).
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

  /* quem está na função nesses horários (fora quem não conta): [{ m, x: [início, fim] }]. dados = a leitura do dia de
     outra unidade (o Remanejar); sem ela, a do painel */
  function ocupantes(posto, nomeFuncao, periodos, fora, dados) {
    var api = ed(), H = api.horas, r = [], f = api.acharFuncao(posto, nomeFuncao, dados);
    ((f && f.militares) || []).forEach(function (o) {
      if (fora && o.cpf === fora) return;
      (o.periodos || []).forEach(function (per) {
        periodos.forEach(function (w) { var x = H.cruza(H.faixa(w), H.faixa(per)); if (x) r.push({ m: o, x: x }); });
      });
    });
    return r;
  }

  /* trocar: c = quem entra (o que o banco mandou, já de serviço no dia). Sai de lá: ele deixa as outras funções do
     horário (o automático deixa de valer ali, acumula = false, e o que ele tinha fixado sai). fica (Fica também lá): ele
     fica fixado também nas outras funções do horário que a pergunta mostrou (as que o banco mandou, desta unidade),
     fora a função especial (vai junto com ele) e o que ele já tem fixado */
  function trocar(cfg, c, periodos, fica) {
    var api = ed(), H = api.horas, r = api.rascunho();
    api.aplicarColocacao({ cpf: c.cpf, posto: cfg.posto, funcao: cfg.funcao, periodos: periodos, sistema: false, pontual: null });
    if (!(c.funcoes || []).length) return;
    if (fica) {
      c.funcoes.forEach(function (f) {
        var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
        if (!posto || mesmoLugar({ posto: posto, funcao: f.funcao }, cfg.posto, cfg.funcao) || /^(chefe de socorro|oficial de área)$/i.test(f.funcao)) return;
        periodos.forEach(function (w) {
          var x = H.cruza(H.faixa(w), H.faixa({ hi: f.hi, hf: f.hf }));
          var ja = !!x && r.ajustes.some(function (a) {
            return a.acao === 'colocar' && a.cpf === c.cpf && api.noLocal(a, posto, f.funcao) && !!H.cruza(H.faixa(a), x);
          });
          if (x && !ja) api.aplicarColocacao({ cpf: c.cpf, posto: posto, funcao: f.funcao, periodos: [H.periodo(x)], sistema: false, pontual: null });
        });
      });
      return;
    }
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
    /* a nota só mostra o atalho se quem saiu ficou sem função (ele pode perder também o acúmulo da cadeira) */
    var lugares = [];
    c.funcoes.forEach(function (f) {
      var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
      if (posto) lugares.push({ posto: posto, funcao: f.funcao, periodos: [{ hi: f.hi, hf: f.hf }] });
    });
    if (!lugares.length) return null;
    return { cpf: m.cpf, texto: lugares.length === 1 ? textos.um(lugares[0].funcao) : textos.varios, lugares: lugares };
  }

  /* o "Ninguém": a função fica vazia nos horários dados, ou em todos os dele (ele continua de serviço). Fixado no lugar
     de outro, o outro não volta: sai também. Na função que o modelo acumula (o Rancho do Efetivo do ABTR), o fixado sai
     e o acúmulo volta para quem está na cadeira */
  function tirarDaFuncao(cfg, periodos) {
    var api = ed(), H = api.horas, r = api.rascunho(), m = cfg.militar;
    var acumulo = !!(api.acharFuncao(cfg.posto, cfg.funcao) || {}).acumulo;
    (periodos || m.periodos || []).forEach(function (per) {
      if (m.fixado && !acumulo) {
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

  /* o Acúmulo (o lápis e o Adicionar militar): as funções que o modelo acumula (acumulo) e que quem sai faz pelo sistema
     (sem fixado) nos horários; com a cadeira, elas vão para quem entra. saem = [cpf]; fora = as funções que não contam
     ({ posto, funcao }: a própria cadeira, ou as que quem entra já leva); dados = a leitura do dia (sem ela, a do painel).
     [{ posto, funcao, periodos }] */
  function acumuladas(saem, periodos, fora, dados) {
    var api = ed(), H = api.horas, r = [], foras = [].concat(fora || []);
    ((dados || api.dados() || {}).postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        if (!f.acumulo || /^(chefe de socorro|oficial de área)$/i.test(f.nome)) return;
        if (foras.some(function (x) { return x.posto.id === po.id && x.funcao === f.nome; })) return;
        var xs = [];
        (f.militares || []).forEach(function (m) {
          if (saem.indexOf(m.cpf) < 0 || m.fixado) return;
          (m.periodos || []).forEach(function (per) {
            periodos.forEach(function (w) { var x = H.cruza(H.faixa(w), H.faixa(per)); if (x) xs.push(x); });
          });
        });
        if (xs.length) r.push({ posto: po, funcao: f.nome, periodos: H.uniao(xs).map(H.periodo) });
      });
    });
    return r;
  }
  /* os textos da pergunta do Acúmulo: o vazio da instalação pelo posto ("o Rancho"), o da viatura pela função ("o Condutor
     da ABT-41") */
  function textosAcumulo(acs) {
    var L = RosterWork.mensagens.escala.linha, funcoes = acs.map(function (a) { return a.funcao; });
    var vazios = acs.map(function (a) { return a.posto.tipo === 'instalacao' ? a.posto.nome : a.funcao + ' da ' + a.posto.nome; });
    return { pergunta: L.acumulaPergunta(funcoes), sim: L.acumulaSim(funcoes), nao: L.acumulaNao(vazios) };
  }

  /* o Deixa vazio do Acúmulo: a função acumulada fica vazia de propósito no horário (o tirar sem militar, que vale para
     quem estiver nela, e o sistema não passa o acúmulo para ninguém). acs = [{ posto, funcao, periodos }] */
  function deixarVazia(acs) {
    var r = ed().rascunho();
    acs.forEach(function (ac) {
      ac.periodos.forEach(function (per) {
        r.ajustes.push({ acao: 'tirar', cpf: '', nome_funcao: ac.funcao, viatura_id: ac.posto.tipo === 'viatura' ? ac.posto.id : null,
          instalacao_id: ac.posto.tipo === 'instalacao' ? ac.posto.id : null, substitui: '', hi: per.hi, hf: per.hf, acumula: true });
      });
    });
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
    ocupantes: ocupantes, trocar: trocar, sugestao: sugestao, tirarDaFuncao: tirarDaFuncao,
    mudarHorario: mudarHorario, acumuladas: acumuladas, textosAcumulo: textosAcumulo, deixarVazia: deixarVazia,
    liberar: liberar, podeLiberar: podeLiberar
  };
})();
