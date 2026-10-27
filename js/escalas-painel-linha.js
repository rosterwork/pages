/* ============================================================
   ESCALAS — a edição de uma linha do Dia (o lápis; só admin)
   Abre ali mesmo, embaixo da função, uma de cada vez:
   - função: Quem (a lista do banco para a vaga, em grupos), o
     horário Nesta função, o De serviço no dia, Tirar desta função,
     Liberar para o sistema (quem está fixado) e Tirar do dia;
   - horário sem ninguém: Quem e o horário (e o Liberar, quando o
     vazio veio de um Tirar desta função);
   - Chefe de Socorro e Oficial de Área: sempre o mais antigo (o Quem
     fica travado); só o De serviço no dia e o Tirar do dia;
   - sem função: Pôr numa função, o horário, o De serviço e o Tirar.
   Na troca, só aquela função muda: quem entra fica fixado nela e quem
   sai fica sem função (ou continua na outra função dele). Quem entra e
   já tem função no horário sai de lá (que fica vazia) ou faz as duas.
   O Aplicar grava (escalas-painel-editar.js); o Cancelar fecha.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var aberto = null;   // { el, lapis }: a edição aberta na lista
  var conta = 0;       // nome único para os rádios de cada edição
  var pedido = 0;      // só a última lista pedida desenha

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function juntar(lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }

  function fechar() {
    if (!aberto) return;
    if (aberto.el && aberto.el.parentNode) aberto.el.remove();
    if (aberto.lapis) aberto.lapis.classList.remove('escala-edicao-lapis--ativo');
    aberto = null;
    pedido++;
  }

  /* os rádios ganham o mesmo nome (único na tela) e avisam a escolha */
  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-linha-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* as funções de quem entra, em texto: "Efetivo 3 da ABT-01" */
  function lugaresDe(funcoes) { return RosterWork.escalasPainelQuem.lugares(funcoes); }

  /* ---------- a edição ---------- */

  /* cfg = { ancora, lapis, tipo: 'funcao' | 'vaga' | 'papel' | 'sem_funcao', posto, funcao, rotulo, militar, periodos } */
  function abrir(cfg) {
    fechar();
    var api = ed(), H = api.horas;
    var el = RosterWork.tpl('tpl-escala-linha');
    if (!el || !cfg.ancora) return;
    var tipo = cfg.tipo, m = cfg.militar;
    var est = { escolhido: null, saida: 'sai', banco: 'sim', periodos: (cfg.periodos || []).map(copiar), tirando: false, onde: null };
    var periodosAntes = JSON.stringify(est.periodos);
    var q = function (s) { return el.querySelector(s); };
    var ui = {
      blocoQuem: q('.escala-linha-bloco--quem'), blocoOnde: q('.escala-linha-bloco--onde'), blocoHorario: q('.escala-linha-bloco--horario'),
      saida: q('.escala-linha-saida'), banco: q('.escala-linha-banco'), assume: q('.escala-linha-assume'), efeito: q('.escala-linha-efeito'),
      periodos: q('.escala-linha-periodos'), servico: q('.escala-linha-servico'), tirar: q('.escala-linha-tirar'),
      acoes: q('.escala-linha-acoes'), aplicar: q('.escala-linha-aplicar')
    };
    var servico = null, tirar = null, quem = null;

    /* título e situação */
    q('.escala-linha-titulo').textContent = tipo === 'sem_funcao' ? nomeDe(m) : api.funcaoNoPosto(cfg.rotulo || cfg.funcao, cfg.posto);
    var periodosTexto = H.textoPeriodos(est.periodos) || L().diaTodo;
    q('.escala-linha-situacao').textContent = tipo === 'vaga' ? L().situacaoVaga(periodosTexto)
      : tipo === 'papel' ? L().situacaoPapel
      : tipo === 'sem_funcao' ? L().situacaoSemFuncao(periodosTexto)
      : m.fixado ? L().situacaoFixado : L().situacaoSistema;

    /* Quem: a lista da vaga (lida do banco a cada abertura); travado no Chefe de Socorro e no Oficial de Área */
    if (tipo === 'papel') {
      q('.escala-linha-quem').remove();
      q('.escala-linha-travado').classList.remove('oculto');
    } else if (tipo === 'sem_funcao') {
      ui.blocoQuem.classList.add('oculto');
      ui.blocoOnde.classList.remove('oculto');
      RosterWork.escalasPainelQuem.onde(q('.escala-linha-onde'), {
        postos: (api.dados() || {}).postos || [],
        situacao: situacaoDaFuncao,
        aoMudar: function (posto, funcao) { est.onde = posto && funcao ? { posto: posto, funcao: funcao } : null; atualizar(); }
      });
    } else {
      var lugarQuem = q('.escala-linha-quem');
      RosterWork.escalasPainelQuem.carregando(lugarQuem);
      var vaga = { viatura_id: cfg.posto.tipo === 'viatura' ? cfg.posto.id : null, instalacao_id: cfg.posto.tipo === 'instalacao' ? cfg.posto.id : null,
        funcao: cfg.funcao, periodos: est.periodos.map(copiar), cpf: m ? m.cpf : null };
      var meu = ++pedido;
      RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId(), vaga).then(function (resp) {
        if (meu !== pedido || !lugarQuem.isConnected) return;
        if (!resp) { RosterWork.escalasPainelQuem.falha(lugarQuem); return; }
        quem = RosterWork.escalasPainelQuem.montar(lugarQuem, { grupos: RosterWork.escalasPainelQuem.gruposDaVaga(resp, m), foco: true,
          aoEscolher: function (item) { est.escolhido = item.c; atualizar(); } });
      });
    }

    var marcarSaida = ligarRadios(ui.saida, function (v) { est.saida = v; atualizar(); });
    var marcarBanco = ligarRadios(ui.banco, function (v) { est.banco = v; });

    /* De serviço no dia e Tirar do dia: do militar da linha (não há na vaga) */
    if (m && tipo !== 'vaga') servico = RosterWork.escalasPainelServico.servico(ui.servico, m.cpf, atualizar);
    var podeTirar = m && tipo !== 'vaga' && RosterWork.escalasPainelServico.podeTirar(m.cpf);

    /* ações: Tirar desta função (só da função), Liberar (o fixado, ou o vazio que veio de um tirar) e Tirar do dia */
    var btTirarFuncao = q('.escala-linha-tirar-funcao'), btLiberar = q('.escala-linha-liberar'), btTirarDia = q('.escala-linha-tirar-dia');
    if (tipo !== 'funcao') btTirarFuncao.remove();
    else btTirarFuncao.addEventListener('click', function () { api.mudar(tirarDaFuncao); });
    if (podeLiberar()) {
      btLiberar.classList.remove('oculto');
      btLiberar.addEventListener('click', function () { api.mudar(liberar); });
    }
    if (!podeTirar) btTirarDia.remove();
    else btTirarDia.addEventListener('click', function () {
      est.tirando = true;
      tirar = RosterWork.escalasPainelServico.tirar(ui.tirar, m.cpf);
      atualizar();
    });
    if (!ui.acoes.querySelector('.botao:not(.oculto)')) ui.acoes.classList.add('oculto');

    q('.escala-linha-cancelar').addEventListener('click', function () {
      if (est.tirando) { est.tirando = false; tirar = null; ui.tirar.textContent = ''; atualizar(); return; }
      fechar();
    });
    ui.aplicar.addEventListener('click', aplicar);

    /* ---------- leitura do estado ---------- */

    function janelasDoHorario() { return est.periodos.map(H.faixa); }
    function cruzaHorario(per) { var f = H.faixa(per); return janelasDoHorario().some(function (w) { return !!H.cruza(w, f); }); }
    function mesmoLugar(e, posto, funcao) { return e.posto.id === posto.id && e.funcao === funcao; }

    /* situação da função no horário (o Onde do sem função): "vazia" ou quem sai dela */
    function situacaoDaFuncao(posto, nomeFuncao) {
      var nomes = ocupantes(posto, nomeFuncao).map(function (o) { return nomeDe(o.m); });
      nomes = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
      return nomes.length ? msg().itemSai(nomes) : msg().itemVazia;
    }
    /* quem está na função nesses horários (fora o da linha): [{ m, x: [início, fim] }] */
    function ocupantes(posto, nomeFuncao) {
      var r = [], f = api.acharFuncao(posto, nomeFuncao);
      ((f && f.militares) || []).forEach(function (o) {
        if (m && o.cpf === m.cpf) return;
        (o.periodos || []).forEach(function (per) {
          janelasDoHorario().forEach(function (w) { var x = H.cruza(w, H.faixa(per)); if (x) r.push({ m: o, x: x }); });
        });
      });
      return r;
    }
    /* as outras funções do militar nesses horários (fora a desta linha) */
    function outrasFuncoes(cpf) {
      return api.funcoesDoMilitar(cpf).filter(function (e) {
        return !(cfg.posto && mesmoLugar(e, cfg.posto, cfg.funcao)) && e.periodos.some(cruzaHorario);
      });
    }
    /* o Liberar: o fixado da linha, ou o vazio que veio de um tirar */
    function podeLiberar() {
      if (tipo === 'funcao') return !!m.fixado;
      if (tipo !== 'vaga') return false;
      return api.rascunho().ajustes.some(function (a) { return a.acao === 'tirar' && api.noLocal(a, cfg.posto, cfg.funcao) && cruzaHorario(a); });
    }
    /* quem tem hoje o papel que o escolhido vai assumir (só quando é um) */
    function quemTemPapel(papel) {
      var alvo = papel === 'chefe_socorro' ? /^chefe de socorro$/i : /^oficial de área$/i;
      var nomes = {}, ps = api.papeis(api.dados());
      Object.keys(ps).forEach(function (k) {
        if (alvo.test(ps[k].funcao)) Object.keys(ps[k].por).forEach(function (cpf) { nomes[ps[k].por[cpf].nome] = true; });
      });
      var lista = Object.keys(nomes);
      return lista.length === 1 ? lista[0] : '';
    }

    /* ---------- desenho ---------- */

    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(janelasDoHorario()));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      atualizar();
    }

    /* com o De serviço no dia mudado, o horário na função acompanha (o que sobra do serviço novo) */
    function acompanhaServico() {
      var novos = !est.escolhido && servico ? servico.novos() : null;
      if (!novos) return null;
      var r = [];
      (cfg.periodos || []).forEach(function (p) {
        novos.forEach(function (s) { var x = H.cruza(H.faixa(p), H.faixa(s)); if (x) r.push(H.periodo(x)); });
      });
      return r;
    }

    function montarPeriodos() {
      ui.periodos.textContent = '';
      /* as horas de quem fica na função: o serviço dele (de serviço) ou o dia todo (de folga e na vaga sem ninguém) */
      var quemFica = est.escolhido ? (est.escolhido.grupo === 'folga' ? null : api.militarDoDia(est.escolhido.cpf)) : (tipo === 'vaga' ? null : api.militarDoDia(m.cpf));
      var opc = H.opcoesHoras(quemFica && quemFica.janelas.length ? quemFica.janelas : null);
      var acompanha = acompanhaServico(), fixo = tipo === 'papel' || !!acompanha;
      (acompanha || est.periodos).forEach(function (per, i, todos) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, opcoes: opc, fixo: fixo,
          aoInicio: function (h) { per.hi = h; atualizar(); },
          aoFim: function (h) { per.hf = h; atualizar(); },
          aoRemover: !fixo && todos.length > 1 ? function () { est.periodos.splice(i, 1); atualizar(); } : null,
          aoAdicionar: !fixo && i === 0 ? adicionarPeriodo : null,
          semAcoes: fixo
        });
        if (linha) ui.periodos.appendChild(linha);
      });
    }

    function nota(caixa, mostrar, texto) {
      caixa.classList.toggle('oculto', !mostrar);
      if (mostrar && texto != null) caixa.querySelector('.nota-texto').textContent = texto;
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var c = est.escolhido, tirando = est.tirando;
      [ui.blocoQuem, ui.blocoHorario].forEach(function (b) { b.classList.toggle('oculto', tirando || (b === ui.blocoQuem && tipo === 'sem_funcao')); });
      ui.blocoOnde.classList.toggle('oculto', tirando || tipo !== 'sem_funcao');
      /* as ações são de quem está na linha: somem quando outro militar vai entrar */
      ui.acoes.classList.toggle('oculto', tirando || !!est.escolhido || !ui.acoes.querySelector('.botao:not(.oculto)'));
      ui.tirar.classList.toggle('oculto', !tirando);
      ui.aplicar.textContent = tirando ? L().botaoTirarDia : msg().formBotaoAplicar;

      /* quem entra e já tem função no horário: sai de lá (fica vazia) ou faz as duas */
      var lugares = c ? lugaresDe(c.funcoes) : [];
      var mostraSaida = !tirando && lugares.length > 0;
      ui.saida.classList.toggle('oculto', !mostraSaida);
      if (mostraSaida) {
        q('.escala-linha-saida-texto').textContent = L().saidaTexto(nomeDe(c), juntar(lugares));
        q('.escala-linha-saida-sai').textContent = L().saidaSai(lugares);
        marcarSaida(est.saida);
      }
      /* quem entra de folga: entra só neste dia, com a pergunta do banco de horas */
      var deFolga = !tirando && !!c && c.grupo === 'folga';
      ui.banco.classList.toggle('oculto', !deFolga);
      if (deFolga) {
        var minutos = janelasDoHorario().reduce(function (s, w) { return s + w[1] - w[0]; }, 0);
        var horas = H.horasTexto(minutos);
        q('.escala-linha-banco-texto').textContent = L().bancoTexto(nomeDe(c), diaMes(api.iso()), horas);
        q('.escala-linha-banco-sim').textContent = L().bancoSim(horas);
        marcarBanco(est.banco);
      }
      nota(ui.assume, !tirando && !!c && !!c.assume, c && c.assume
        ? (c.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(c), quemTemPapel(c.assume)) : '');
      /* o que acontece com quem sai: fica sem função, ou continua na outra função dele. Ninguém mais muda */
      var efeito = '';
      if (!tirando && c && m && tipo === 'funcao') {
        var outras = outrasFuncoes(m.cpf).map(function (e) { return api.funcaoNoPosto(e.funcao, e.posto); });
        efeito = outras.length ? L().efeitoContinua(nomeDe(m), juntar(outras)) : L().efeitoSemFuncao(nomeDe(m));
      } else if (!tirando && tipo === 'sem_funcao' && est.onde) {
        var partes = ocupantes(est.onde.posto, est.onde.funcao).map(function (o) {
          var pr = H.periodo(o.x);
          return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf));
        });
        efeito = partes.length ? msg().avisoEfeito(partes) : '';
      }
      nota(ui.efeito, !!efeito, efeito);
      montarPeriodos();
      /* o De serviço no dia é de quem está na linha: some quando outro militar vai entrar */
      ui.servico.classList.toggle('oculto', !!c);
    }

    /* ---------- aplicar ---------- */

    /* na troca: quem entra senta na função (fixado) e quem estava sai daquele horário; com "Sai de lá", ele
       deixa as outras funções do horário (que ficam vazias); com "Faz as duas", fica fixado nelas também */
    function trocar() {
      var c = est.escolhido, r = api.rascunho();
      var pontual = c.grupo === 'folga' ? { contabilizar: est.banco === 'sim' } : null;
      api.aplicarColocacao({ cpf: c.cpf, posto: cfg.posto, funcao: cfg.funcao, periodos: est.periodos, sistema: false, pontual: pontual });
      var outras = c.funcoes || [];
      if (!outras.length) return;
      if (est.saida === 'sai') {
        r.ajustes.forEach(function (a) { if (a.acao === 'colocar' && a.cpf === c.cpf && api.noLocal(a, cfg.posto, cfg.funcao)) a.acumula = false; });
        /* o que ele tinha fixado nas outras funções, nesse horário, sai também */
        api.funcoesDoMilitar(c.cpf).forEach(function (e) {
          if (!e.fixado || mesmoLugar(e, cfg.posto, cfg.funcao)) return;
          e.periodos.forEach(function (per) {
            janelasDoHorario().forEach(function (w) { var x = H.cruza(w, H.faixa(per)); if (x) api.deixarFuncao(c.cpf, e.posto, e.funcao, H.periodo(x)); });
          });
        });
        return;
      }
      outras.forEach(function (f) {
        var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
        var ja = r.ajustes.some(function (a) { return a.acao === 'colocar' && a.cpf === c.cpf && posto && api.noLocal(a, posto, f.funcao); });
        if (!posto || ja) return;
        r.ajustes.push({ acao: 'colocar', cpf: c.cpf, nome_funcao: f.funcao, viatura_id: f.viatura_id || null, instalacao_id: f.instalacao_id || null,
          substitui: c.cpf, hi: f.hi, hf: f.hf, acumula: true });
      });
    }

    /* o atalho da nota O que mudou: quem saiu e ficou sem função vai para o lugar que quem entrou deixou */
    function sugestao() {
      var c = est.escolhido;
      if (!c || !m || tipo !== 'funcao' || est.saida !== 'sai' || !(c.funcoes || []).length || outrasFuncoes(m.cpf).length) return null;
      var lugares = [];
      c.funcoes.forEach(function (f) {
        var posto = api.acharPosto(f.viatura_id, f.instalacao_id);
        if (posto) lugares.push({ posto: posto, funcao: f.funcao, periodos: [{ hi: f.hi, hf: f.hf }] });
      });
      if (!lugares.length) return null;
      return { cpf: m.cpf, texto: lugares.length === 1 ? L().atalho(nomeDe(m), lugares[0].funcao) : L().atalhoLugar(nomeDe(m), nomeDe(c)), lugares: lugares };
    }

    /* o horário do militar na função mudou: o que saiu deixa de ser dele; quem estava no horário novo sai dali */
    function mudarHorario() {
      var r = api.rascunho();
      var abertura = r.ajustes.filter(function (a) { return a.acao === 'colocar' && a.cpf === m.cpf && api.noLocal(a, cfg.posto, cfg.funcao); })
        .map(function (a) { return { posto: cfg.posto, funcao: cfg.funcao, hi: a.hi, hf: a.hf, manual: true, subst: a.substitui || null, acumula: a.acumula !== false, intacta: true }; });
      if (!m.fixado) (m.periodos || []).forEach(function (per) {
        abertura.push({ posto: cfg.posto, funcao: cfg.funcao, hi: per.hi, hf: per.hf, manual: false, subst: m.cpf, acumula: true, intacta: true });
      });
      var subst = abertura.length && abertura[0].manual ? abertura[0].subst : m.cpf;
      var linhas = est.periodos.map(function (p) {
        return { posto: cfg.posto, funcao: cfg.funcao, hi: p.hi, hf: p.hf, manual: true, subst: subst, acumula: true, intacta: false };
      });
      api.aplicarMilitar(m.cpf, abertura, linhas);
      ocupantes(cfg.posto, cfg.funcao).forEach(function (o) { api.deixarFuncao(o.m.cpf, cfg.posto, cfg.funcao, H.periodo(o.x)); });
    }

    /* Tirar desta função: a função fica vazia nesse horário (ele continua de serviço). Fixado no lugar de outro,
       o outro não volta: sai também */
    function tirarDaFuncao() {
      var r = api.rascunho();
      (m.periodos || []).forEach(function (per) {
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

    /* Liberar para o sistema: o fixado (ou o tirar) sai; o sistema refaz o dia mexendo o mínimo */
    function liberar() {
      var r = api.rascunho();
      r.ajustes = r.ajustes.filter(function (a) {
        if (!api.noLocal(a, cfg.posto, cfg.funcao)) return true;
        if (tipo === 'funcao') return !(a.acao === 'colocar' && a.cpf === m.cpf);
        return !(a.acao === 'tirar' && cruzaHorario(a));
      });
    }

    function aplicar() {
      if (est.tirando) {
        var e = tirar ? tirar.erro() : '';
        if (e) { RosterWork.avisar({ tipo: 'erro', mensagem: e }); return; }
        if (tirar) tirar.aplicar();
        return;
      }
      var js = janelasDoHorario();
      var soma = function (l) { return l.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
      var horarioMudou = JSON.stringify(est.periodos) !== periodosAntes;
      var erro = soma(H.uniao(js)) !== soma(js) ? L().erroPeriodos
        : (tipo === 'sem_funcao' && !est.onde && horarioMudou) ? L().erroOnde
        : (!est.escolhido && servico && servico.erro()) || '';
      if (erro) { RosterWork.avisar({ tipo: 'erro', mensagem: erro }); return; }
      var atalho = sugestao();
      api.sugerir(atalho);
      /* com o De serviço no dia mudado, o horário na função acompanha pelo sistema (a função não fica fixada) */
      var mudaServico = !est.escolhido && !!servico && servico.mudou();
      api.mudar(function () {
        if (est.escolhido) trocar();
        else if (tipo === 'sem_funcao' && est.onde) {
          api.aplicarColocacao({ cpf: m.cpf, posto: est.onde.posto, funcao: est.onde.funcao, periodos: est.periodos, sistema: false, pontual: null });
        } else if (horarioMudou && tipo === 'funcao' && !mudaServico) mudarHorario();
        if (mudaServico) servico.aplicar();
      });
    }

    cfg.ancora.insertAdjacentElement('afterend', el);
    if (cfg.lapis) cfg.lapis.classList.add('escala-edicao-lapis--ativo');
    aberto = { el: el, lapis: cfg.lapis };
    atualizar();
  }

  window.RosterWork.escalasPainelLinha = { abrir: abrir, fechar: fechar, aberta: function () { return !!aberto; } };
})();
