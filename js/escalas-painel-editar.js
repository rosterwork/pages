/* ============================================================
   ESCALAS — o Dia do painel (aba Dia): a lista do dia, a mesma
   para todos. O admin edita nela: o Adicionar militar (à esquerda)
   e o desfazer/refazer (à direita) ficam no subcabeçalho, cada
   militar tem o lápis (abre o militar no dia) e o ↺ (volta ao
   automático), quem está de folga tem o lápis (abre a folga no dia,
   com o Cancelar folga), o horário sem ninguém vira o botão vermelho "Sem
   ninguém, escolher", e as observações também se editam aqui; o
   título de cada posto tem o Editar posto (escalas-painel-posto.js:
   o efetivo e a troca de viatura, gravados fora do rascunho do dia).
   Quem não é admin só lê.
   Cada mudança grava na hora (escala_dia_salvar, um registro no
   histórico, sem o modal de resumo): o banco devolve o dia gravado e
   a grade atualiza a célula. Rascunho de uma mudança: { ajustes,
   pontuais, estornar, folgas, folgas_cancelar, observacoes }. O desfazer/
   refazer grava o caminho de volta (silencioso: ninguém é avisado).
   As sub-telas (formulário e militar no dia) ficam em
   escalas-painel-formulario.js e -militar.js e usam a API daqui
   (.sub); dentro delas a prévia vem do banco (escala_dia_simular) e
   nada grava até o Aplicar. A aba Dia da Extrajornada usa o mesmo desenho,
   só de leitura, com o dia já lido (opções dados e semAvisos). O
   "Como fica a escala" do painel de decisão (Trocas e Folgas) também,
   no modo comparação (opção comparar): só leitura, com quem saiu
   riscado na função de onde saiu, quem entra pelo pedido com o "Novo"
   e quem o sistema remanejou só com a barra cinza (as marcas vêm do
   banco, pedido_escala_comparar).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;       // { corpo, rodape, unidadeId, iso, admin, comparar, dados, dadosAntes, chaveDados, emSub, comHistorico, salvando }
  var base = null;      // o dia gravado (a última leitura): { dados, ajustes, pontuais }
  var rasc = null;      // a mudança em andamento, sobre o dia gravado
  var foto = null;      // rascunho ao abrir uma sub-tela (o Cancelar volta a ele)
  var pilhaDesfazer = [];  // passos que dá para desfazer: { volta, frente } (os rascunhos que o banco grava)
  var pilhaRefazer = [];   // passos desfeitos: { frente }
  var pedido = 0;       // só a última leitura, prévia ou gravação pedida desenha

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa (o mais antigo do dia) */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function msg() { return RosterWork.mensagens.escala; }
  function pecas() { return (RosterWork.escalasPainel && RosterWork.escalasPainel.pecas) || {}; }
  function copiar(o) { return JSON.parse(JSON.stringify(o)); }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  /* ---------- horas no dia de serviço (minutos desde as 08h): contas do componente geral-horario ---------- */

  var horario = RosterWork.horario;
  var emMin = horario.emMin, faixa = horario.faixa, hhmm = horario.hhmm, periodo = horario.periodo, curta = horario.curta,
    cruza = horario.cruza, menos = horario.menos, uniao = horario.uniao, regua = horario.regua, opcoesHoras = horario.opcoesHoras;

  /* 1440 -> "24 horas"; 90 -> "1h30" (texto dos modais do banco de horas e do total do formulário) */
  function horasTexto(min) {
    return (min % 60 === 0) ? RosterWork.mensagens.folgas.horasExtenso(min / 60) : RosterWork.tempo.horas(min);
  }
  /* "das 20h às 21h e das 00h às 08h" (vazio quando é o dia todo) */
  function textoPeriodos(periodos) {
    if (periodos.length === 1 && periodos[0].hi === periodos[0].hf) return '';
    return periodos.map(function (p) { return msg().dasAs(curta(p.hi), curta(p.hf)); }).join(' e ');
  }

  /* ---------- rascunho ---------- */

  function vidPosto(posto) { return posto.tipo === 'viatura' ? posto.id : null; }
  function iidPosto(posto) { return posto.tipo === 'instalacao' ? posto.id : null; }
  function noLocal(a, posto, nomeFuncao) {
    return a.nome_funcao === nomeFuncao
      && (a.viatura_id || null) === vidPosto(posto)
      && (a.instalacao_id || null) === iidPosto(posto);
  }
  /* "da AA-01", "do Rancho": viatura é feminino; instalação pelo nome */
  function postoFeminino(posto) {
    if (!posto) return false;
    if (posto.tipo === 'viatura') return true;
    return /^(central|sala|base|casa|sede|guarita)/i.test(posto.nome || '') || /a$/i.test(posto.nome || '');
  }
  function funcaoNoPosto(funcao, posto) { return msg().funcaoNoPosto(funcao, posto.nome, postoFeminino(posto)); }

  /* chave de um ajuste (compara rascunho × salvo) */
  function chave(a) {
    return [a.acao, a.cpf, a.nome_funcao, a.viatura_id || '', a.instalacao_id || '', a.substitui || '',
      a.hi || '', a.hf || '', a.acumula === false ? 'deixa' : 'acumula'].join('|');
  }
  function contagem(lista) {
    var c = {};
    lista.forEach(function (a) { var k = chave(a); c[k] = (c[k] || 0) + 1; });
    return c;
  }
  function mesmosAjustes(a, b) {
    var ca = contagem(a), cb = contagem(b), ka = Object.keys(ca);
    return ka.length === Object.keys(cb).length && ka.every(function (k) { return ca[k] === cb[k]; });
  }

  function mapaPontuais(lista) {
    var m = {};
    (lista || []).forEach(function (x) { m[x.cpf] = JSON.stringify(x.periodos || []); });
    return m;
  }
  function difPontuais() {
    var a = mapaPontuais(base.pontuais), b = mapaPontuais(rasc.pontuais), n = 0;
    Object.keys(b).forEach(function (k) { if (a[k] !== b[k]) n++; });
    Object.keys(a).forEach(function (k) { if (!(k in b)) n++; });
    return n;
  }

  /* o rascunho mudou o dia gravado? (funções, pontuais, folgas dadas ou canceladas, ou observações) */
  function haMudanca() {
    if (!rasc || !base) return false;
    return !mesmosAjustes(base.ajustes, rasc.ajustes) || difPontuais() > 0 || rasc.folgas.length > 0
      || rasc.folgas_cancelar.length > 0 || rasc.observacoes.adicionar.length > 0 || rasc.observacoes.remover.length > 0;
  }

  /* o rascunho recomeça do dia gravado */
  function novoRascunho() {
    rasc = { ajustes: copiar(base.ajustes), pontuais: copiar(base.pontuais), estornar: [], folgas: [], folgas_cancelar: [],
      observacoes: { adicionar: [], remover: [] } };
  }

  /* o dia gravado (a leitura, ou o que o banco devolve ao gravar) vira a base */
  function aceitar(dados) {
    base = {
      dados: dados,
      ajustes: dados.ajustes_salvos || [],
      pontuais: (dados.pontuais || []).map(function (x) { return { cpf: x.cpf, periodos: x.periodos || [] }; })
    };
    novoRascunho();
    ctx.dados = dados;
    ctx.chaveDados = JSON.stringify(paraPrevia());
  }

  /* o que vai à prévia das sub-telas (só o que muda a escala: as observações não pedem nova prévia) */
  function paraPrevia() {
    var r = { ajustes: rasc.ajustes, folgas: rasc.folgas };
    if (difPontuais() > 0) r.pontuais = rasc.pontuais;
    return r;
  }
  /* o que vai ao banco quando a mudança grava */
  function paraSalvar() {
    var r = paraPrevia();
    r.estornar = rasc.estornar;
    r.folgas_cancelar = rasc.folgas_cancelar;
    r.observacoes = rasc.observacoes;
    return r;
  }

  /* o caminho de volta de uma mudança gravada sobre "antes": a camada manual e os pontuais como estavam, as
     folgas e as observações que ela criou saem, e as folgas que ela cancelou e as observações que ela tirou voltam.
     Só volta a ter horas no banco de horas o pontual que as perdeu na mudança (o estorno) */
  function inverso(envio, antes, criadas) {
    criadas = criadas || {};
    var dados = antes.dados || {};
    var volta = { ajustes: copiar(antes.ajustes), estornar: [], folgas: [], folgas_cancelar: copiar(criadas.folgas || []),
      observacoes: { adicionar: [], remover: copiar(criadas.observacoes || []) } };
    if (envio.pontuais) {
      var contou = {}, eram = {};
      (dados.pontuais || []).forEach(function (x) { contou[x.cpf] = !!x.contabilizado; });
      antes.pontuais.forEach(function (x) { eram[x.cpf] = true; });
      volta.pontuais = antes.pontuais.map(function (x) {
        return { cpf: x.cpf, periodos: x.periodos, contabilizar: !!contou[x.cpf] && (envio.estornar || []).indexOf(x.cpf) >= 0 };
      });
      volta.estornar = envio.pontuais.filter(function (x) { return !eram[x.cpf] && x.contabilizar; })
        .map(function (x) { return x.cpf; });
    }
    ((envio.observacoes && envio.observacoes.remover) || []).forEach(function (id) {
      var o = (dados.observacoes || []).filter(function (x) { return x.id === id; })[0];
      if (o) volta.observacoes.adicionar.push(o.texto);
    });
    /* a folga cancelada volta como era: o mesmo horário e a mesma escolha do banco de horas */
    (envio.folgas_cancelar || []).forEach(function (id) {
      var linhas = (dados.folgas || []).filter(function (x) { return x.lancamento_id === id; });
      if (!linhas.length) return;
      var f = linhas[0], pr = { hi: null, hf: null };
      if (!f.dia_inteiro) {
        var faixas = linhas.map(faixa);
        pr = periodo([Math.min.apply(null, faixas.map(function (x) { return x[0]; })),
          Math.max.apply(null, faixas.map(function (x) { return x[1]; }))]);
      }
      volta.folgas.push({ cpf: f.cpf, hi: pr.hi, hf: pr.hf, contabilizar: !!f.contabilizada });
    });
    return volta;
  }

  /* a ida de novo, depois de desfeita: as observações que ela tira e as folgas que ela cancela voltaram com outro id */
  function refeito(frente, criadas) {
    var f = copiar(frente);
    if (f.observacoes && f.observacoes.remover.length) f.observacoes.remover = copiar((criadas && criadas.observacoes) || []);
    if (f.folgas_cancelar && f.folgas_cancelar.length) f.folgas_cancelar = copiar((criadas && criadas.folgas) || []);
    return f;
  }

  /* ---------- leitura da prévia ---------- */

  function acharPosto(vi, ii) {
    var lista = (ctx && ctx.dados && ctx.dados.postos) || [];
    for (var i = 0; i < lista.length; i++) {
      var po = lista[i];
      if ((po.tipo === 'viatura' && po.id === vi) || (po.tipo === 'instalacao' && po.id === ii)) return po;
    }
    return null;
  }
  function acharFuncao(posto, nomeFuncao) {
    var po = posto && acharPosto(vidPosto(posto), iidPosto(posto));
    var fs = (po && po.funcoes) || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].nome === nomeFuncao) return fs[i];
    return null;
  }

  /* as funções do militar no dia (prévia atual): [{ posto, funcao, periodos, fixado, bloqueado, m }] */
  function funcoesDoMilitar(cpf, dados) {
    var lista = [];
    (((dados || (ctx && ctx.dados)) || {}).postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        (f.militares || []).forEach(function (m) {
          if (m.cpf === cpf) lista.push({ posto: po, funcao: f.nome, periodos: m.periodos || [], fixado: !!m.fixado, bloqueado: !!m.bloqueado, m: m });
        });
      });
    });
    return lista;
  }

  /* o militar de serviço no dia: { cpf, grad, nome, janelas, unidade, daUnidade, origem, pontual, outraUnidade }
     (null se não está de serviço). janelas = os horários de serviço dele nesta unidade, cada um com a origem;
     outraUnidade = também serve em outra unidade no dia */
  function militarDoDia(cpf) {
    var d = (ctx && ctx.dados) || {};
    var mil = null;
    (d.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (m) {
        if (m.cpf === cpf) mil = { cpf: cpf, grad: m.grad || '', nome: m.nome || '', janelas: m.disp || [], unidade: u.unidade_nome, daUnidade: !!u.editando, deFolga: false,
          outraUnidade: !!m.outra_unidade };
      });
    });
    if (!mil) return null;
    var fs = funcoesDoMilitar(cpf);
    var sf = (d.sem_funcao || []).filter(function (m) { return m.cpf === cpf; })[0];
    mil.origem = (fs[0] && fs[0].m.origem) || (sf && sf.origem) || 'sistema';
    mil.pontual = (rasc.pontuais || []).some(function (x) { return x.cpf === cpf; });
    return mil;
  }

  /* quem ocupa o Chefe de Socorro / Oficial de Área no dia: { "posto|função": { posto, funcao, por: { cpf: { nome, periodos } } } } */
  function papeis(dados) {
    var r = {};
    ((dados && dados.postos) || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) {
        if (!BLOQUEADAS.test(f.nome)) return;
        var k = po.id + '|' + f.nome;
        r[k] = r[k] || { posto: po, funcao: f.nome, por: {} };
        (f.militares || []).forEach(function (m) { r[k].por[m.cpf] = { nome: nomeDe(m), periodos: m.periodos || [] }; });
      });
    });
    return r;
  }

  /* ---------- operações (chamadas pela lista e pelas sub-telas) ---------- */

  function colocacao(c, f, substitui) {
    var pr = periodo(f);
    return { acao: 'colocar', cpf: c.cpf, nome_funcao: c.funcao, viatura_id: vidPosto(c.posto), instalacao_id: iidPosto(c.posto),
      substitui: substitui || null, hi: pr.hi, hf: pr.hf, acumula: true };
  }

  /* corta o trecho x das colocações manuais do militar que passam o filtro */
  function aparar(cpf, filtro, x) {
    var novos = [];
    rasc.ajustes.forEach(function (a) {
      if (a.acao !== 'colocar' || a.cpf !== cpf || !filtro(a) || !cruza(faixa(a), x)) { novos.push(a); return; }
      menos([faixa(a)], [x]).forEach(function (f) {
        var b = copiar(a), pr = periodo(f);
        b.hi = pr.hi; b.hf = pr.hf;
        novos.push(b);
      });
    });
    rasc.ajustes = novos;
  }

  /* põe o militar numa função nos horários escolhidos (formulário). Quem estava lá fica sem função naquele
     trecho: o automático é substituído só naquela parte; a colocação manual é cortada.
     c = { cpf, posto, funcao, periodos, sistema, pontual: { contabilizar } | null } */
  function aplicarColocacao(c) {
    if (c.pontual) {
      rasc.pontuais = rasc.pontuais.filter(function (x) { return x.cpf !== c.cpf; })
        .concat([{ cpf: c.cpf, periodos: c.periodos, contabilizar: !!c.pontual.contabilizar }]);
      rasc.estornar = rasc.estornar.filter(function (x) { return x !== c.cpf; });
    }
    if (c.sistema) return;
    var janelas = c.periodos.map(faixa);
    var alvo = acharFuncao(c.posto, c.funcao);
    janelas.forEach(function (w) {
      var resto = [w];
      ((alvo && alvo.militares) || []).forEach(function (m) {
        if (m.cpf === c.cpf) return;
        (m.periodos || []).forEach(function (per) {
          var x = cruza(w, faixa(per));
          if (!x) return;
          if (m.fixado) {
            aparar(m.cpf, function (a) { return noLocal(a, c.posto, c.funcao); }, x);
            rasc.ajustes.push(colocacao(c, x, m.substitui && m.substitui !== m.cpf ? m.substitui : null));
          } else {
            rasc.ajustes.push(colocacao(c, x, m.cpf));
          }
          resto = menos(resto, [x]);
        });
      });
      resto.forEach(function (x) { rasc.ajustes.push(colocacao(c, x, null)); });
    });
  }

  /* grava no rascunho o que mudou no militar no dia. abertura e linhas =
     [{ posto, funcao, hi, hf, manual, subst, acumula, intacta }]; só mexe nas funções que mudaram */
  function aplicarMilitar(cpf, abertura, linhas) {
    function chaveDe(l) { return l.posto.tipo + ':' + l.posto.id + '|' + l.funcao; }
    function cobertura(ls) { return JSON.stringify(uniao(ls.map(function (l) { return faixa(l); }))); }
    function manuais(ls) { return ls.filter(function (l) { return l.manual; }).map(function (l) { return l.hi + '-' + l.hf + '-' + (l.subst || ''); }).sort().join(','); }
    var refs = {};
    abertura.concat(linhas).forEach(function (l) { refs[chaveDe(l)] = l; });
    Object.keys(refs).forEach(function (k) {
      var ref = refs[k];
      var antes = abertura.filter(function (l) { return chaveDe(l) === k; });
      var depois = linhas.filter(function (l) { return chaveDe(l) === k; });
      /* a mesma cobertura com as mesmas colocações manuais (ex.: só dividiu, sem mudar as horas): nada muda */
      if (cobertura(antes) === cobertura(depois) && manuais(antes) === manuais(depois)) return;
      rasc.ajustes = rasc.ajustes.filter(function (a) {
        return !(a.acao === 'colocar' && a.cpf === cpf && noLocal(a, ref.posto, ref.funcao));
      });
      var mexidas = depois.filter(function (l) { return !l.intacta; });
      depois.forEach(function (l) {
        /* o automático intacto fica como está, a não ser que um trecho mexido passe por cima dele */
        var tocada = mexidas.some(function (x) { return x !== l && cruza(faixa(x), faixa(l)); });
        if (!l.manual && l.intacta && !tocada) return;
        rasc.ajustes.push({ acao: 'colocar', cpf: cpf, nome_funcao: ref.funcao, viatura_id: vidPosto(ref.posto), instalacao_id: iidPosto(ref.posto),
          substitui: l.subst || null, hi: l.hi, hf: l.hf, acumula: l.acumula !== false });
      });
      var cobertas = depois.map(function (l) { return faixa(l); });
      antes.filter(function (l) { return !l.manual; }).forEach(function (l) {
        menos([faixa(l)], cobertas).forEach(function (f) {
          var pr = periodo(f);
          rasc.ajustes.push({ acao: 'tirar', cpf: cpf, nome_funcao: ref.funcao, viatura_id: vidPosto(ref.posto), instalacao_id: iidPosto(ref.posto), hi: pr.hi, hf: pr.hf });
        });
      });
    });
  }

  /* tira das colocações e dos cortes manuais do militar os trechos dados (o resto de cada um continua) */
  function cortarAjustes(cpf, trechos) {
    var novos = [];
    rasc.ajustes.forEach(function (a) {
      if (a.cpf !== cpf) { novos.push(a); return; }
      menos([faixa(a)], trechos).forEach(function (f) {
        var b = copiar(a), pr = periodo(f);
        b.hi = pr.hi; b.hf = pr.hf;
        novos.push(b);
      });
    });
    rasc.ajustes = novos;
  }

  /* Tirar do dia (militar do ciclo): folga do dia inteiro e as colocações dele saem. Com periodos (quem também
     serve em outra unidade no dia), a folga e o corte valem só nesses horários: o serviço de lá não muda */
  function darFolga(cpf, contabilizar, periodos) {
    rasc.folgas = rasc.folgas.filter(function (f) { return f.cpf !== cpf; });
    if (periodos && periodos.length) {
      periodos.forEach(function (p) { rasc.folgas.push({ cpf: cpf, hi: p.hi, hf: p.hf, contabilizar: !!contabilizar }); });
      cortarAjustes(cpf, periodos.map(faixa));
      return;
    }
    rasc.folgas.push({ cpf: cpf, hi: null, hf: null, contabilizar: !!contabilizar });
    rasc.ajustes = rasc.ajustes.filter(function (a) { return a.cpf !== cpf; });
  }

  /* Tirar do dia (pontual): sai do dia; estornar = as horas que ele somou saem do banco de horas.
     Quem tem outro serviço aqui no dia (ex.: a extra) perde só os ajustes manuais das horas do pontual */
  function tirarPontual(cpf, estornar) {
    var mil = militarDoDia(cpf);
    var pont = rasc.pontuais.filter(function (x) { return x.cpf === cpf; })[0];
    var horas = ((pont && pont.periodos) || []).map(faixa);
    var outras = mil ? menos(mil.janelas.map(faixa), horas) : [];
    rasc.pontuais = rasc.pontuais.filter(function (x) { return x.cpf !== cpf; });
    if (outras.length) cortarAjustes(cpf, horas);
    else rasc.ajustes = rasc.ajustes.filter(function (a) { return a.cpf !== cpf; });
    if (estornar && rasc.estornar.indexOf(cpf) < 0) rasc.estornar.push(cpf);
  }

  /* Cancelar folga (a folga no dia): a folga sai e o militar volta ao serviço; o desfazer a dá de novo igual */
  function cancelarFolga(id) {
    if (rasc.folgas_cancelar.indexOf(id) < 0) rasc.folgas_cancelar.push(id);
  }

  function pontualSalvo(cpf) { return (base.pontuais || []).some(function (x) { return x.cpf === cpf; }); }

  /* uma mudança feita na própria lista: grava na hora */
  function mudar(fn) { fn(); desenhar(); }

  /* ---------- prévia e gravação ---------- */

  function mostrarCarregando() {
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (no) ctx.corpo.appendChild(no);
    /* enquanto a prévia carrega, o Aplicar da sub-tela fica desligado */
    var b = ctx.rodape && ctx.rodape.querySelector('.escala-sub-aplicar');
    if (b) b.disabled = true;
  }
  function mostrarFalha() {
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (no) { no.textContent = msg().falhaCarregar; ctx.corpo.appendChild(no); }
  }

  /* a prévia da sub-tela recusou (ex.: períodos que se cruzam) ou caiu: avisa e volta ao dia gravado */
  function falhou(dados) {
    if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: (dados && dados.erro_simulacao) || msg().falhaCarregar });
    cancelarSub();
  }

  /* o dia como fica com o rascunho atual, dentro das sub-telas (reaproveita a última prévia se a escala do rascunho não mudou) */
  function previa(depois) {
    var chaveAgora = JSON.stringify(paraPrevia());
    if (ctx.dados && chaveAgora === ctx.chaveDados) { depois(ctx.dados); return; }
    mostrarCarregando();
    var meu = ++pedido, c = ctx;
    RosterWork.escalasDados.simularDia(ctx.unidadeId, ctx.iso, paraPrevia()).then(function (dados) {
      if (ctx !== c || meu !== pedido) return;
      if (!dados || dados.erro_simulacao) { falhou(dados); return; }
      ctx.dados = dados;
      ctx.chaveDados = chaveAgora;
      depois(dados);
    });
  }

  /* (re)desenha a lista do dia: a mudança feita (na lista ou numa sub-tela) grava na hora; sem mudança, mostra o
     dia gravado. A 1ª vez lê o dia */
  function desenhar() {
    if (!ctx) return;
    ctx.emSub = false;
    foto = null;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    if (base) {
      if (haMudanca()) { gravarMudanca(); return; }
      montarSubcabecalho();
      ctx.dados = base.dados;
      ctx.chaveDados = JSON.stringify(paraPrevia());
      renderLista(base.dados);
      return;
    }
    montarSubcabecalho();
    /* dados já prontos (ex.: o dia com os extras, na Extrajornada): desenha na hora, sem ler o banco */
    if (ctx.dadosProntos) { comecar(ctx.dadosProntos); return; }
    mostrarCarregando();
    var meu = ++pedido, c = ctx;
    RosterWork.escalasDados.lerDistribuicaoDia(ctx.unidadeId, ctx.iso).then(function (dados) {
      if (ctx !== c || meu !== pedido) return;
      if (!dados) { mostrarFalha(); return; }
      comecar(dados);
    });
  }

  /* o dia lido: vira a base e desenha */
  function comecar(dados) {
    aceitar(dados);
    ctx.dadosAntes = dados;
    renderLista(dados);
  }

  /* grava no banco (a mudança, ou o desfazer/refazer) sobre o dia que a tela leu; o banco devolve o dia gravado.
     aoGravar(r, antes) guarda o passo no desfazer/refazer; aoFalhar() devolve o passo à pilha de onde saiu */
  function gravar(envio, aoGravar, aoFalhar) {
    var c = ctx, uid = ctx.unidadeId, iso = ctx.iso, antes = base;
    var corpo = copiar(envio);
    corpo.antes = { ajustes: antes.ajustes, pontuais: antes.pontuais };
    ctx.salvando = true;
    montarSubcabecalho();
    mostrarCarregando();
    /* vindo de uma sub-tela, o rodapé dela (Cancelar · Aplicar) sai; o histórico volta depois de gravar */
    if (!ctx.comHistorico && ctx.rodape) { ctx.rodape.textContent = ''; ctx.rodape.classList.add('oculto'); }
    var meu = ++pedido;
    RosterWork.escalasDados.salvarDia(uid, iso, corpo).then(function (r) {
      var ok = !!(r && r.success);
      /* a grade atualiza só a célula do dia (mesmo que o painel já esteja em outro dia) */
      if (ok) window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: uid, iso: iso } }));
      if (ctx !== c || meu !== pedido) return;
      ctx.salvando = false;
      if (r && r.desatualizado) {
        /* o dia mudou depois da leitura (outro administrador ou o sistema): relê e zera o desfazer/refazer */
        RosterWork.avisar({ tipo: 'aviso', mensagem: msg().diaDesatualizado });
        recarregar();
        return;
      }
      if (!ok) {
        var texto = r && r._falha === 'conexao' ? RosterWork.mensagens.geral.semConexao
          : r && r._falha === 'servidor' ? RosterWork.mensagens.geral.falhaServidor
          : (r && r.error) || msg().falhaSalvar;
        RosterWork.avisar({ tipo: 'erro', mensagem: texto });
        if (aoFalhar) aoFalhar();
        novoRascunho();
        desenhar();
        return;
      }
      var lido = r.dia ? Promise.resolve(r.dia) : RosterWork.escalasDados.lerDistribuicaoDia(uid, iso);
      lido.then(function (dados) {
        if (ctx !== c || meu !== pedido) return;
        if (!dados) { mostrarFalha(); return; }
        aceitar(dados);
        ctx.dadosAntes = antes.dados;   // o aviso de quem assume o Chefe de Socorro compara com o dia antes desta mudança
        if (aoGravar) aoGravar(r, antes);
        ctx.comHistorico = false;       // o rodapé relê o histórico, já com esta mudança
        desenhar();
      });
    });
  }

  /* a mudança do rascunho grava; o passo entra no desfazer e o refazer zera */
  function gravarMudanca() {
    var envio = copiar(paraSalvar());
    gravar(envio, function (r, antes) {
      pilhaDesfazer.push({ volta: inverso(envio, antes, r.criadas), frente: envio });
      pilhaRefazer = [];
    });
  }

  function podeDesfazer() { return !!ctx && ctx.admin && !ctx.emSub && !ctx.salvando && !!base && pilhaDesfazer.length > 0; }
  function podeRefazer() { return !!ctx && ctx.admin && !ctx.emSub && !ctx.salvando && !!base && pilhaRefazer.length > 0; }

  /* desfazer: grava o caminho de volta do último passo, sem avisar ninguém */
  function desfazerPasso() {
    if (!podeDesfazer()) return;
    var passo = pilhaDesfazer.pop();
    var volta = copiar(passo.volta);
    volta.silencioso = true;
    gravar(volta,
      function (r) { pilhaRefazer.push({ frente: refeito(passo.frente, r.criadas) }); },
      function () { pilhaDesfazer.push(passo); });
  }

  /* refazer: grava de novo o passo desfeito, sem avisar ninguém */
  function refazerPasso() {
    if (!podeRefazer()) return;
    var passo = pilhaRefazer.pop();
    var frente = copiar(passo.frente);
    frente.silencioso = true;
    gravar(frente,
      function (r, antes) { pilhaDesfazer.push({ volta: inverso(passo.frente, antes, r.criadas), frente: passo.frente }); },
      function () { pilhaRefazer.push(passo); });
  }

  /* subcabeçalho do Dia (só o admin, só na lista): o Adicionar militar e, à direita, o desfazer/refazer.
     Enquanto grava, os botões ficam desligados */
  function montarSubcabecalho() {
    var sub = RosterWork.painel.subcabecalho();
    if (!sub) return;
    sub.textContent = '';
    if (!ctx.admin || ctx.emSub) { sub.classList.add('oculto'); return; }
    var b = RosterWork.tpl('tpl-escala-edicao-adicionar');
    if (b) {
      b.disabled = !!ctx.salvando;
      b.addEventListener('click', function () { if (ctx && !ctx.salvando) abrirFormulario({ modo: 'adicionar' }); });
      sub.appendChild(b);
    }
    var hist = RosterWork.tpl('tpl-escala-edicao-historico');
    if (hist) {
      var bDesfazer = hist.querySelector('.escala-edicao-historico-desfazer');
      var bRefazer = hist.querySelector('.escala-edicao-historico-refazer');
      bDesfazer.disabled = !podeDesfazer();
      bRefazer.disabled = !podeRefazer();
      bDesfazer.addEventListener('click', desfazerPasso);
      bRefazer.addEventListener('click', refazerPasso);
      sub.appendChild(hist);
    }
    sub.classList.remove('oculto');
  }

  /* ---------- lista do dia ---------- */

  function botao(idTpl, aoClicar) {
    var b = RosterWork.tpl(idTpl);
    if (b) b.addEventListener('click', function (ev) { ev.stopPropagation(); aoClicar(); });
    return b;
  }

  /* o período cabe em alguma janela de serviço do militar? */
  function foraDaDisponibilidade(per, m) {
    var janelas = m.disp || [];
    if (!janelas.length) return true;
    var f = faixa(per);
    return !janelas.some(function (j) { var g = faixa(j); return f[0] >= g[0] && f[1] <= g[1]; });
  }

  /* o bloco de uma função: o rótulo à esquerda, no meio da altura das linhas dela (dois empilhados quando o
     mesmo militar acumula), e o lugar das linhas. nivel 'alerta' = amarelo (ressalva), 'erro' = vermelho.
     Sem rótulos (Sem função, De folga), só alinha as linhas com as das funções. Devolve { el, linhas } */
  function novoGrupo(rotulos, nivel) {
    var el = RosterWork.tpl('tpl-escala-edicao-grupo');
    if (!el) return null;
    var fn = el.querySelector('.escala-edicao-funcao');
    (rotulos || []).forEach(function (nm) {
      var r = RosterWork.tpl('tpl-escala-edicao-funcao-rotulo');
      if (r) { r.textContent = pecas().abreviarFuncao(nm); fn.appendChild(r); }
    });
    if (nivel && rotulos && rotulos.length) fn.classList.add('escala-edicao-funcao--' + nivel);
    return { el: el, linhas: el.querySelector('.escala-edicao-linhas') };
  }

  /* a linha vazia do molde; quem só lê não tem a coluna das ações */
  function novaLinha() {
    var linha = RosterWork.tpl('tpl-escala-edicao-linha');
    if (linha && !ctx.admin) {
      linha.classList.add('escala-edicao-linha--leitura');
      linha.querySelector('.escala-edicao-acoes').remove();
    }
    return linha;
  }

  /* uma linha do dia: militar · horário · ações (a função fica no bloco dela).
     op = { ghost, folga, icone, novo, alterada, acoes }: novo = o selo "Novo" e a barra cinza; alterada = só a barra */
  function linhaMilitar(m, op) {
    op = op || {};
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    var icones = linha.querySelector('.escala-distribuicao-icones');
    var ic = RosterWork.tpl('tpl-escala-mes-origem');
    if (ic) { p.definirIcone(ic, op.icone || p.iconeOrigem[m.origem] || p.iconeOrigem.sistema); icones.appendChild(ic); }
    /* o cadeado marca a colocação manual; na linha com "Novo" ele sai para caber */
    if (m.fixado && !op.novo) {
      var cad = RosterWork.tpl('tpl-escala-mes-origem');
      if (cad) { p.definirIcone(cad, 'icone-cadeado'); icones.appendChild(cad); }
    }
    if (!op.ghost && !op.folga) { p.marcarRegras(linha, m); p.marcarOutraUnidade(linha, m); }
    linha.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    linha.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    if (op.novo) {
      var selo = RosterWork.tpl('tpl-escala-edicao-novo');
      if (selo) linha.querySelector('.escala-edicao-pessoa').appendChild(selo);
    }
    if (op.novo || op.alterada) linha.classList.add('escala-edicao-linha--alterada');
    var horas = linha.querySelector('.escala-distribuicao-horas');
    (m.periodos || []).forEach(function (per) { var h = p.hora(per); if (h) horas.appendChild(h); });
    if (op.ghost) linha.classList.add('escala-edicao-linha--original');
    if (op.folga) linha.classList.add('escala-edicao-linha--folga');
    if (!op.ghost && !op.folga) {
      p.marcarConflito(linha, m, null, null);
      p.marcarAviso(linha, m);
      p.marcarProblemas(linha, m);
    }
    var acoes = linha.querySelector('.escala-edicao-acoes');
    if (acoes) (op.acoes || []).forEach(function (b) { if (b) acoes.appendChild(b); });
    return linha;
  }

  /* horário sem ninguém na função (dentro do que o modelo pede) ou cadeira vazia do motor: para o admin,
     o botão vermelho que abre o formulário já preenchido; para quem só lê, o texto vermelho */
  function linhaVazia(posto, nomeFuncao, per, texto) {
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    var pessoa = linha.querySelector('.escala-edicao-pessoa');
    pessoa.textContent = '';
    if (ctx.admin) {
      var b = RosterWork.tpl('tpl-escala-edicao-vazio');
      if (b) {
        b.textContent = texto;
        b.addEventListener('click', function () {
          abrirFormulario({ modo: 'preencher', posto: posto, funcao: nomeFuncao, hi: per.hi, hf: per.hf });
        });
        pessoa.appendChild(b);
      }
    } else {
      var t = RosterWork.tpl('tpl-escala-edicao-vazio-leitura');
      if (t) { t.textContent = msg().semNinguemTexto; pessoa.appendChild(t); }
    }
    var h = p.hora(per);
    if (h) linha.querySelector('.escala-distribuicao-horas').appendChild(h);
    return linha;
  }

  /* cpfs dos militares cuja faixa se sobrepõe a outra na mesma função */
  function cpfsSobrepostos(funcao) {
    var set = {};
    if (!funcao || !funcao.sobreposicao) return set;
    var ms = funcao.militares || [];
    for (var i = 0; i < ms.length; i++) {
      for (var j = i + 1; j < ms.length; j++) {
        var cruzam = (ms[i].periodos || []).some(function (a) {
          return (ms[j].periodos || []).some(function (b) { return !!cruza(faixa(a), faixa(b)); });
        });
        if (cruzam) { set[ms[i].cpf] = true; set[ms[j].cpf] = true; }
      }
    }
    return set;
  }

  /* o bloco de uma função: militares, o automático trocado/tirado (riscado, só para o admin) e os horários sem
     ninguém, com a função no meio da altura de todas as linhas */
  function linhasFuncao(caixa, posto, f) {
    var p = pecas();
    var temVao = !!f.vazio || (f.vao || []).length > 0;
    var grupo = novoGrupo((f.nomes && f.nomes.length) ? f.nomes : [f.nome], temVao ? 'erro' : p.nivelFuncao(f));
    if (!grupo) return;
    function por(linha) { if (linha) grupo.linhas.appendChild(linha); }
    var sobrepostos = cpfsSobrepostos(f);
    (f.militares || []).forEach(function (m) {
      var acoes = [];
      if (ctx.admin) {
        if (m.fixado && !m.bloqueado) {
          acoes.push(botao('tpl-escala-edicao-desfazer', function () {
            mudar(function () {
              rasc.ajustes = rasc.ajustes.filter(function (a) { return !(a.acao === 'colocar' && a.cpf === m.cpf && noLocal(a, posto, f.nome)); });
            });
          }));
        }
        acoes.push(botao('tpl-escala-edicao-lapis', function () { abrirMilitar(m.cpf); }));
      }
      /* na comparação, as marcas vêm do banco ("Novo" = quem entra pelo pedido; só a barra = quem o
         sistema remanejou); na edição não há marca, porque cada mudança já está gravada */
      var linha = linhaMilitar(m, { novo: !!(ctx.comparar && m.novo), alterada: ctx.comparar && !!m.mudou, acoes: acoes });
      if (linha && (sobrepostos[m.cpf] || (m.periodos || []).some(function (per) { return foraDaDisponibilidade(per, m); }))) {
        linha.classList.add('escala-edicao-linha--erro');
      }
      por(linha);
    });
    /* riscados: na edição, o automático trocado ou tirado (só o admin vê); na comparação, quem saiu */
    if (ctx.admin || ctx.comparar) {
      (f.ghosts || []).forEach(function (g) {
        var acoes = [];
        if (g.motivo === 'tirar') {
          acoes.push(botao('tpl-escala-edicao-desfazer', function () {
            mudar(function () {
              rasc.ajustes = rasc.ajustes.filter(function (a) { return !(a.acao === 'tirar' && a.cpf === g.cpf && noLocal(a, posto, f.nome)); });
            });
          }));
        }
        por(linhaMilitar(g, { ghost: true, acoes: acoes }));
      });
    }
    if (f.vazio) por(linhaVazia(posto, f.nome, { hi: '08:00', hf: '08:00' }, msg().vazioEscolher));
    (f.vao || []).forEach(function (v) { por(linhaVazia(posto, f.nome, v, msg().semNinguem)); });
    if (grupo.linhas.children.length) caixa.appendChild(grupo.el);
  }

  /* o título do posto: quem administra a unidade tem o Editar posto ao lado (o efetivo e, na viatura, a troca
     de prefixo e CNH); na troca de viatura com data, embaixo vem "No lugar da ... até ..." */
  function montarTituloPosto(caixa, posto) {
    var rotulo = caixa.querySelector('.rotulo-secao');
    if (ctx.adminPosto && !ctx.comparar && !ctx.dadosProntos && RosterWork.escalasPainelPosto && rotulo) {
      var cab = RosterWork.tpl('tpl-escala-posto-cab');
      if (cab) {
        cab.querySelector('.rotulo-secao').textContent = posto.nome || '';
        cab.querySelector('.escala-posto-editar').addEventListener('click', function () {
          if (ctx && !ctx.salvando) RosterWork.escalasPainelPosto.abrir(posto);
        });
        rotulo.replaceWith(cab);
        rotulo = cab;
      }
    }
    var noLugar = pecas().noLugar ? pecas().noLugar(posto) : null;
    if (noLugar && rotulo) rotulo.insertAdjacentElement('afterend', noLugar);
  }

  function caixaPosto(posto) {
    var p = pecas();
    /* posto sem nenhuma função no dia (reserva sem ninguém) não aparece; o Adicionar militar chega nele pelo Onde */
    if (!(posto.funcoes || []).length) return null;
    var caixa = RosterWork.painel.criarCaixa(posto.nome);
    if (!caixa) return null;
    montarTituloPosto(caixa, posto);
    /* o vermelho (cadeira vazia ou horário sem ninguém) vence o amarelo */
    var np = p.nivelPosto(posto);
    if (np !== 'erro' && (posto.funcoes || []).some(function (f) { return f.vazio || (f.vao || []).length; })) np = 'erro';
    if (np) caixa.classList.add('grupo-caixa--posto-' + np);
    p.mesclarFuncoes(posto).forEach(function (f) { linhasFuncao(caixa, posto, f); });
    return caixa;
  }

  /* Sem função: quem está de serviço sem função em algum horário (título vermelho, depois dos postos) */
  function caixaSemFuncao(sem) {
    if (!sem.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().semFuncaoRotulo);
    if (!caixa) return null;
    caixa.classList.add('grupo-caixa--posto-erro');
    var grupo = novoGrupo([], null);
    if (!grupo) return caixa;
    sem.forEach(function (m) {
      var acoes = ctx.admin ? [botao('tpl-escala-edicao-lapis', function () { abrirMilitar(m.cpf); })] : [];
      var l = linhaMilitar(m, { acoes: acoes });
      if (l) grupo.linhas.appendChild(l);
    });
    caixa.appendChild(grupo.el);
    return caixa;
  }

  /* De folga: nome riscado, ícone de folga e o período; para o admin, o lápis abre a folga no dia */
  function caixaFolgas(folgas) {
    if (!folgas.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().deFolga);
    if (!caixa) return null;
    var grupo = novoGrupo([], null);
    if (!grupo) return caixa;
    folgas.forEach(function (f) {
      var acoes = ctx.admin && f.lancamento_id ? [botao('tpl-escala-edicao-lapis', function () { abrirFolga(f.lancamento_id); })] : [];
      var linha = linhaMilitar({ cpf: f.cpf, grad: f.grad, nome: f.nome, periodos: [{ hi: f.hi, hf: f.hf }] },
        { folga: true, icone: 'icone-folgas', acoes: acoes });
      if (linha) grupo.linhas.appendChild(linha);
    });
    caixa.appendChild(grupo.el);
    return caixa;
  }

  /* Observações do dia: o admin escreve e tira as dele, e cada uma grava na hora */
  function caixaObservacoes(dados) {
    return pecas().observacoes(dados.observacoes || [], {
      editar: ctx.admin,
      aoAdicionar: function (texto) { mudar(function () { rasc.observacoes.adicionar.push(texto); }); },
      aoRemover: function (o) { if (o.id) mudar(function () { rasc.observacoes.remover.push(o.id); }); }
    });
  }

  /* aviso quando o Chefe de Socorro ou o Oficial de Área muda por causa da última mudança */
  function notasPapeis(corpo, dados) {
    var antes = papeis(ctx.dadosAntes), agora = papeis(dados);
    Object.keys(agora).forEach(function (k) {
      var a = agora[k], b = antes[k] || { por: {} };
      var entram = Object.keys(a.por).filter(function (cpf) { return !b.por[cpf]; });
      if (!entram.length) return;
      var saem = Object.keys(b.por).filter(function (cpf) { return !a.por[cpf]; }).map(function (cpf) { return b.por[cpf].nome; });
      entram.forEach(function (cpf) {
        var nota = RosterWork.tpl('tpl-escala-nota');
        if (!nota) return;
        nota.querySelector('.nota-texto').textContent = msg().assumePapel(a.por[cpf].nome, funcaoNoPosto(a.funcao, a.posto),
          textoPeriodos(a.por[cpf].periodos), saem.join(' e '));
        corpo.appendChild(nota);
      });
    });
  }

  function renderLista(dados) {
    var p = pecas();
    var corpo = ctx.corpo;
    corpo.textContent = '';
    p.anexarProblemas(dados);   // CNH, regra, exclusivo e grau de cada militar (do banco)
    if (!ctx.semAvisos) {
      var aviso = p.montarAvisoProblemas(dados.problemas, dados.postos, dados.faltam_modelos, dados.modelos_com_erro);
      if (aviso) corpo.appendChild(aviso);
    }
    if (ctx.admin) notasPapeis(corpo, dados);
    var alguem = false;
    function por(caixa) { if (caixa) { corpo.appendChild(caixa); alguem = true; } }
    (dados.postos || []).forEach(function (posto) { por(caixaPosto(posto)); });
    por(caixaSemFuncao(dados.sem_funcao || []));
    por(caixaFolgas(dados.folgas || []));
    /* dia sem ninguém: o estado vazio, nunca a tela em branco */
    if (!alguem) {
      var vazio = RosterWork.tpl('tpl-escala-distribuicao-estado');
      if (vazio) { vazio.textContent = msg().semDistribuicao; corpo.appendChild(vazio); }
    }
    var obs = caixaObservacoes(dados);
    if (obs) corpo.appendChild(obs);
    /* Lançar no SYSBM: o último bloco do Dia gravado (não o de dados prontos, como a prévia da Extrajornada),
       para quem administra o pelotão (escalas-sysbm.js) */
    if (ctx.admin && !ctx.dadosProntos && !ctx.comparar && RosterWork.escalasSysbm) RosterWork.escalasSysbm.montar(corpo, ctx.unidadeId, ctx.iso);
    atualizarRodape();
  }

  /* ---------- rodapé do dia: quem já mexeu no dia (relido depois de cada mudança) ---------- */

  function atualizarRodape() {
    if (!ctx || ctx.emSub || !ctx.rodape || ctx.comHistorico) return;
    ctx.comHistorico = true;
    pecas().alteracoes(ctx.rodape, ctx.unidadeId, ctx.iso, function () { return !!ctx && ctx.comHistorico && !ctx.emSub; });
  }

  /* lê o dia de novo e zera o desfazer/refazer */
  function recarregar() {
    if (!ctx) return;
    montar(ctx.corpo, ctx.rodape, ctx.unidadeId, ctx.iso, { admin: ctx.admin, adminPosto: ctx.adminPosto });
  }

  /* relê o dia sem zerar o desfazer/refazer (o Editar posto grava fora do rascunho do dia) */
  function reler() {
    if (!ctx) return;
    if (ctx.rodape) { ctx.rodape.textContent = ''; ctx.rodape.classList.add('oculto'); }
    ctx.comHistorico = false;
    base = null;
    desenhar();
  }

  /* ---------- sub-telas (formulário e militar no dia) ---------- */

  /* troca a lista por uma sub-tela: "Voltar ao dia" no topo e Cancelar · Aplicar no rodapé.
     montar(corpo) desenha o conteúdo; aoAplicar() faz a mudança e chama concluirSub(). Sem textoAplicar (a folga
     no dia, que grava pelo botão dela), a sub-tela fica sem rodapé e a saída é o Voltar ao dia */
  function abrirSub(textoAplicar, montarConteudo, aoAplicar) {
    if (!ctx || !rasc || !ctx.admin || ctx.salvando) return;
    if (!ctx.emSub) foto = copiar(rasc);   // de uma sub-tela para outra, a foto continua a do dia
    ctx.emSub = true;
    ctx.comHistorico = false;
    ctx.aplicarTravado = false;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    montarSubcabecalho();
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var voltar = RosterWork.tpl('tpl-escala-sub-voltar');
    if (voltar) { voltar.addEventListener('click', cancelarSub); corpo.appendChild(voltar); }
    montarConteudo(corpo);
    var rodape = ctx.rodape;
    if (!rodape) return;
    rodape.textContent = '';
    if (!textoAplicar) { rodape.classList.add('oculto'); return; }
    var tpl = document.getElementById('tpl-escala-sub-acoes');
    if (tpl) rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-sub-cancelar');
    var aplicar = rodape.querySelector('.escala-sub-aplicar');
    if (cancelar) cancelar.addEventListener('click', cancelarSub);
    if (aplicar) {
      aplicar.textContent = textoAplicar;
      aplicar.disabled = ctx.aplicarTravado;
      aplicar.addEventListener('click', function () { aoAplicar(); });
    }
  }
  /* a sub-tela desliga o botão de confirmar enquanto há conflito (ex.: horário que cruza o que o militar já tem) */
  function travarAplicar(travado) {
    if (!ctx) return;
    ctx.aplicarTravado = !!travado;
    var aplicar = ctx.rodape && ctx.rodape.querySelector('.escala-sub-aplicar');
    if (aplicar) aplicar.disabled = ctx.aplicarTravado;
  }
  /* Cancelar: volta ao dia gravado, sem gravar nada. Aplicar: a mudança grava (desenhar) */
  function cancelarSub() {
    if (!ctx || ctx.salvando) return;
    if (foto) rasc = foto;
    else if (base) novoRascunho();
    desenhar();
  }
  function concluirSub() { if (!ctx) return; desenhar(); }

  function abrirFormulario(cfg) { if (RosterWork.escalasPainelFormulario) RosterWork.escalasPainelFormulario.abrir(cfg); }
  function abrirMilitar(cpf) { if (RosterWork.escalasPainelMilitar) RosterWork.escalasPainelMilitar.abrir(cpf); }
  function abrirFolga(id) { if (RosterWork.escalasPainelMilitar) RosterWork.escalasPainelMilitar.abrirFolga(id); }

  /* ---------- ciclo de vida ---------- */

  /* opcoes = { admin, adminPosto, dados, semAvisos }: o admin edita o dia; adminPosto (quem administra a
     unidade) tem o Editar posto; os outros só leem. dados = o dia já lido (não busca no banco); semAvisos = sem a
     lista de avisos do topo (a página tem a sua). Sem rodape, o rodapé não é usado */
  function montar(corpo, rodape, unidadeId, iso, opcoes) {
    opcoes = opcoes || {};
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, admin: !!opcoes.admin, adminPosto: !!opcoes.adminPosto,
      comparar: !!opcoes.comparar,
      dadosProntos: opcoes.dados || null, semAvisos: !!opcoes.semAvisos,
      dados: null, dadosAntes: null, chaveDados: null, emSub: false, comHistorico: false, salvando: false };
    rasc = null; base = null; foto = null; pilhaDesfazer = []; pilhaRefazer = [];
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    desenhar();
  }

  function reset() {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    ctx = null; rasc = null; base = null; foto = null; pilhaDesfazer = []; pilhaRefazer = [];
    pedido++;
  }

  /* atalhos: Ctrl+Z desfaz, Ctrl+Y ou Ctrl+Shift+Z refaz. Só na lista do Dia do admin, fora dos campos de texto
     e sem janela de aviso aberta. O keydown vive no document (liga uma vez só) */
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || !ctx || !ctx.admin || ctx.emSub) return;
    var alvo = e.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
    if (document.querySelector('.modal-veu--aberto')) return;
    var sub = RosterWork.painel && RosterWork.painel.subcabecalho();
    if (!RosterWork.painel.estaAberto() || !sub || !sub.querySelector('.escala-edicao-historico')) return;
    var tecla = (e.key || '').toLowerCase();
    if (tecla === 'z' && !e.shiftKey) { e.preventDefault(); desfazerPasso(); }
    else if (tecla === 'y' || (tecla === 'z' && e.shiftKey)) { e.preventDefault(); refazerPasso(); }
  });

  window.RosterWork.escalasPainelEditar = {
    montar: montar,
    reset: reset,
    /* para as sub-telas (escalas-painel-formulario.js, escalas-painel-militar.js e escalas-painel-posto.js) */
    sub: {
      dados: function () { return ctx && ctx.dados; },
      iso: function () { return ctx && ctx.iso; },
      unidadeId: function () { return ctx && ctx.unidadeId; },
      rascunho: function () { return rasc; },
      abrir: abrirSub,
      travarAplicar: travarAplicar,
      concluir: concluirSub,
      cancelar: cancelarSub,
      reler: reler,
      previa: previa,
      abrirFormulario: abrirFormulario,
      aplicarColocacao: aplicarColocacao,
      aplicarMilitar: aplicarMilitar,
      darFolga: darFolga,
      cancelarFolga: cancelarFolga,
      tirarPontual: tirarPontual,
      pontualSalvo: pontualSalvo,
      funcoesDoMilitar: funcoesDoMilitar,
      militarDoDia: militarDoDia,
      acharFuncao: acharFuncao,
      acharPosto: acharPosto,
      papeis: papeis,
      funcaoNoPosto: funcaoNoPosto,
      noLocal: noLocal,
      horas: { emMin: emMin, faixa: faixa, hhmm: hhmm, periodo: periodo, curta: curta, cruza: cruza, menos: menos,
        uniao: uniao, regua: regua, opcoesHoras: opcoesHoras, horasTexto: horasTexto, textoPeriodos: textoPeriodos }
    }
  };
})();
