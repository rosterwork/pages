/* ============================================================
   ESCALAS — o Dia do painel (aba Dia): a lista do dia, a mesma
   para todos. O admin edita nela: o Adicionar militar fica no
   subcabeçalho, cada militar tem o lápis (abre o militar no dia) e
   o ↺ (volta ao automático), o horário sem ninguém vira o botão
   vermelho "Sem ninguém, escolher" e as observações e a nota da
   viatura em manutenção entram no rascunho. Quem não é admin só lê.
   Rascunho do dia: { ajustes, pontuais, estornar, folgas,
   observacoes, manutencao }. A cada mudança a prévia vem do banco
   (escala_dia_simular); nada grava até Salvar (escala_dia_salvar,
   um registro só no histórico). As sub-telas (formulário e militar
   no dia) ficam em escalas-painel-formulario.js e -militar.js e usam
   a API daqui (.sub). A aba Dia da Extrajornada usa o mesmo desenho,
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

  var ctx = null;       // { corpo, rodape, unidadeId, iso, admin, comparar, dados, dadosBase, chaveDados, btnSalvar, info, emSub, comHistorico }
  var rasc = null;      // rascunho do dia
  var base = null;      // o que estava salvo ao entrar: { ajustes, pontuais }
  var anterior = null;  // rascunho antes da última mudança (volta a ele se a prévia recusar)
  var foto = null;      // rascunho ao abrir uma sub-tela (o Cancelar volta a ele)
  var haConflito = false;
  var pedido = 0;       // só a última prévia pedida desenha

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
  function ajusteNovo(filtro) {
    var salvos = contagem(base.ajustes);
    return rasc.ajustes.some(function (a) { return filtro(a) && !salvos[chave(a)]; });
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
  function pontualNovo(cpf) {
    var a = mapaPontuais(base.pontuais), b = mapaPontuais(rasc.pontuais);
    return (cpf in b) && a[cpf] !== b[cpf];
  }

  /* notas da viatura em manutenção que mudaram: [{ id, observacao }] */
  function manutencaoMudada() {
    var lista = [];
    ((ctx && ctx.dados && ctx.dados.postos) || []).forEach(function (po) {
      if (!po.manutencao_id || !(po.manutencao_id in rasc.manutencao)) return;
      if ((rasc.manutencao[po.manutencao_id] || '').trim() !== (po.manutencao_obs || '').trim()) {
        lista.push({ id: po.manutencao_id, observacao: rasc.manutencao[po.manutencao_id] });
      }
    });
    return lista;
  }

  /* alterações não salvas: uma por militar em cada função mexida, mais pontuais, folgas, observações e nota */
  function contarAlteracoes() {
    if (!rasc || !base) return 0;
    var b = contagem(base.ajustes), r = contagem(rasc.ajustes), grupos = {};
    function grupo(a) { return [a.cpf, a.nome_funcao, a.viatura_id || '', a.instalacao_id || ''].join('|'); }
    rasc.ajustes.forEach(function (a) { if ((r[chave(a)] || 0) > (b[chave(a)] || 0)) grupos[grupo(a)] = true; });
    base.ajustes.forEach(function (a) { if ((b[chave(a)] || 0) > (r[chave(a)] || 0)) grupos[grupo(a)] = true; });
    return Object.keys(grupos).length + difPontuais() + rasc.folgas.length
      + rasc.observacoes.adicionar.length + rasc.observacoes.remover.length + manutencaoMudada().length;
  }

  /* o que vai à prévia (só o que muda a escala: observações e nota não pedem nova prévia) */
  function paraPrevia() {
    var r = { ajustes: rasc.ajustes, folgas: rasc.folgas };
    if (difPontuais() > 0) r.pontuais = rasc.pontuais;
    return r;
  }
  /* o que vai ao Salvar */
  function paraSalvar() {
    var r = paraPrevia();
    r.estornar = rasc.estornar;
    r.observacoes = rasc.observacoes;
    r.manutencao = manutencaoMudada();
    return r;
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

  /* o militar de serviço no dia: { cpf, grad, nome, janelas, unidade, daUnidade, origem, pontual } (null se não está de serviço) */
  function militarDoDia(cpf) {
    var d = (ctx && ctx.dados) || {};
    var mil = null;
    (d.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (m) {
        if (m.cpf === cpf) mil = { cpf: cpf, grad: m.grad || '', nome: m.nome || '', janelas: m.disp || [], unidade: u.unidade_nome, daUnidade: !!u.editando, deFolga: false };
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

  /* Tirar do dia (militar do ciclo): folga do dia inteiro; as colocações dele saem */
  function darFolga(cpf, contabilizar) {
    rasc.folgas = rasc.folgas.filter(function (f) { return f.cpf !== cpf; })
      .concat([{ cpf: cpf, hi: null, hf: null, contabilizar: !!contabilizar }]);
    rasc.ajustes = rasc.ajustes.filter(function (a) { return a.cpf !== cpf; });
  }

  /* Tirar do dia (pontual): sai do dia; estornar = as horas que ele somou saem do banco de horas */
  function tirarPontual(cpf, estornar) {
    rasc.pontuais = rasc.pontuais.filter(function (x) { return x.cpf !== cpf; });
    rasc.ajustes = rasc.ajustes.filter(function (a) { return a.cpf !== cpf; });
    if (estornar && rasc.estornar.indexOf(cpf) < 0) rasc.estornar.push(cpf);
  }

  function pontualSalvo(cpf) { return (base.pontuais || []).some(function (x) { return x.cpf === cpf; }); }

  /* uma mudança feita na própria lista: guarda o antes e redesenha */
  function mudar(fn) { anterior = copiar(rasc); fn(); desenhar(); }

  /* ---------- prévia ---------- */

  function mostrarCarregando() {
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (no) ctx.corpo.appendChild(no);
    /* enquanto a prévia carrega, o Salvar (dia) e o Aplicar (sub-tela) ficam desligados */
    var b = ctx.rodape && ctx.rodape.querySelector('.escala-painel-salvar, .escala-sub-aplicar');
    if (b) b.disabled = true;
  }
  function mostrarFalha() {
    ctx.corpo.textContent = '';
    var no = RosterWork.tpl('tpl-escala-distribuicao-estado');
    if (no) { no.textContent = msg().falhaCarregar; ctx.corpo.appendChild(no); }
  }

  /* a prévia recusou (ex.: folga recusada) ou caiu: avisa e volta ao rascunho de antes */
  function falhou(dados) {
    var volta = ctx.emSub ? foto : anterior;
    foto = null; anterior = null; ctx.emSub = false;
    if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: (dados && dados.erro_simulacao) || msg().falhaCarregar });
    if (volta) { rasc = volta; desenhar(); return; }
    mostrarFalha();
  }

  /* o dia como fica com o rascunho atual (reaproveita a última prévia se a escala do rascunho não mudou) */
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

  /* (re)desenha a lista do dia; a 1ª vez lê o salvo e monta o rascunho a partir dele */
  function desenhar() {
    if (!ctx) return;
    ctx.emSub = false;
    foto = null;
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    montarSubcabecalho();
    ctx.comHistorico = false;
    if (rasc) { previa(function (dados) { anterior = null; renderLista(dados); }); return; }
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

  /* o dia lido: guarda o que está salvo, monta o rascunho a partir dele e desenha */
  function comecar(dados) {
    base = {
      ajustes: dados.ajustes_salvos || [],
      pontuais: (dados.pontuais || []).map(function (x) { return { cpf: x.cpf, periodos: x.periodos || [] }; })
    };
    rasc = { ajustes: copiar(base.ajustes), pontuais: copiar(base.pontuais), estornar: [], folgas: [],
      observacoes: { adicionar: [], remover: [] }, manutencao: {} };
    ctx.dados = dados;
    ctx.dadosBase = dados;
    ctx.chaveDados = JSON.stringify(paraPrevia());
    renderLista(dados);
  }

  /* subcabeçalho do Dia: o Adicionar militar (só o admin, só na lista) */
  function montarSubcabecalho() {
    var sub = RosterWork.painel.subcabecalho();
    if (!sub) return;
    sub.textContent = '';
    if (!ctx.admin || ctx.emSub) { sub.classList.add('oculto'); return; }
    var b = RosterWork.tpl('tpl-escala-edicao-adicionar');
    if (b) {
      b.addEventListener('click', function () { abrirFormulario({ modo: 'adicionar' }); });
      sub.appendChild(b);
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

  /* o rótulo da função na 1ª linha dela (dois empilhados quando o mesmo militar acumula);
     nivel 'alerta' = amarelo (ressalva), 'erro' = vermelho */
  function rotular(linha, rotulos, nivel) {
    var fn = linha.querySelector('.escala-edicao-funcao');
    (rotulos || []).forEach(function (nm) {
      var r = RosterWork.tpl('tpl-escala-edicao-funcao-rotulo');
      if (r) { r.textContent = pecas().abreviarFuncao(nm); fn.appendChild(r); }
    });
    if (nivel && rotulos && rotulos.length) fn.classList.add('escala-edicao-funcao--' + nivel);
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

  /* uma linha do dia: rótulo da função (só na 1ª linha dela) · militar · horário · ações.
     op = { ghost, folga, icone, novo, alterada, acoes }: novo = o selo "Novo" e a barra cinza; alterada = só a barra */
  function linhaMilitar(rotulos, nivel, m, op) {
    op = op || {};
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    rotular(linha, rotulos, nivel);
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
  function linhaVazia(rotulos, posto, nomeFuncao, per, texto) {
    var p = pecas();
    var linha = novaLinha();
    if (!linha) return null;
    rotular(linha, rotulos, 'erro');
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

  /* as linhas de uma função: militares, o automático trocado/tirado (riscado, só para o admin) e os horários sem ninguém */
  function linhasFuncao(caixa, posto, f) {
    var p = pecas();
    var temVao = !!f.vazio || (f.vao || []).length > 0;
    var nivel = temVao ? 'erro' : p.nivelFuncao(f);
    var rotulos = (f.nomes && f.nomes.length) ? f.nomes : [f.nome];
    function por(linha) { if (linha) { caixa.appendChild(linha); rotulos = []; } }
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
         sistema remanejou); na edição, o "Novo" vem do rascunho ainda não salvo */
      var novo = ctx.comparar ? !!m.novo : ctx.admin && ((m.fixado && ajusteNovo(function (a) { return a.acao === 'colocar' && a.cpf === m.cpf && noLocal(a, posto, f.nome); }))
        || pontualNovo(m.cpf));
      var linha = linhaMilitar(rotulos, nivel, m, { novo: novo, alterada: ctx.comparar && !!m.mudou, acoes: acoes });
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
        var linha = linhaMilitar(rotulos, nivel, g, { ghost: true, acoes: acoes });
        if (linha && g.motivo === 'tirar' && ajusteNovo(function (a) { return a.acao === 'tirar' && a.cpf === g.cpf && noLocal(a, posto, f.nome); })) {
          linha.classList.add('escala-edicao-linha--alterada');
        }
        por(linha);
      });
    }
    if (f.vazio) por(linhaVazia(rotulos, posto, f.nome, { hi: '08:00', hf: '08:00' }, msg().vazioEscolher));
    (f.vao || []).forEach(function (v) { por(linhaVazia(rotulos, posto, f.nome, v, msg().semNinguem)); });
  }

  function caixaPosto(posto) {
    var p = pecas();
    /* posto sem nenhuma função no dia (reserva sem ninguém) não aparece; o Adicionar militar chega nele pelo Onde */
    if (!(posto.funcoes || []).length && !posto.em_manutencao) return null;
    var caixa = RosterWork.painel.criarCaixa(posto.nome);
    if (!caixa) return null;
    if (posto.em_manutencao) {
      /* viatura em manutenção: caixa amarela + aviso/nota (o admin edita a nota); o efetivo FICA nela */
      caixa.classList.add('grupo-caixa--posto-alerta', 'grupo-caixa--manutencao');
      var valor = posto.manutencao_id && (posto.manutencao_id in rasc.manutencao) ? rasc.manutencao[posto.manutencao_id] : null;
      var man = p.montarManutencao(posto, ctx.admin, function (texto) {
        rasc.manutencao[posto.manutencao_id] = texto;
        atualizarRodape();
      }, valor);
      if (man) caixa.appendChild(man);
    } else {
      var np = p.nivelPosto(posto);
      if (np) caixa.classList.add('grupo-caixa--posto-' + np);
      if (!np && (posto.funcoes || []).some(function (f) { return f.vazio || (f.vao || []).length; })) caixa.classList.add('grupo-caixa--posto-erro');
    }
    p.mesclarFuncoes(posto).forEach(function (f) { linhasFuncao(caixa, posto, f); });
    return caixa;
  }

  /* Sem função: quem está de serviço sem função em algum horário (título vermelho, depois dos postos) */
  function caixaSemFuncao(sem) {
    if (!sem.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().semFuncaoRotulo);
    if (!caixa) return null;
    caixa.classList.add('grupo-caixa--posto-erro');
    sem.forEach(function (m) {
      var acoes = ctx.admin ? [botao('tpl-escala-edicao-lapis', function () { abrirMilitar(m.cpf); })] : [];
      var l = linhaMilitar([], false, m, { novo: ctx.admin && pontualNovo(m.cpf), acoes: acoes });
      if (l) caixa.appendChild(l);
    });
    return caixa;
  }

  /* De folga: nome riscado, ícone de folga e o período; a folga ainda não salva tem o ✕ que a desfaz */
  function caixaFolgas(folgas) {
    if (!folgas.length) return null;
    var caixa = RosterWork.painel.criarCaixa(msg().deFolga);
    if (!caixa) return null;
    folgas.forEach(function (f) {
      var pendente = ctx.admin && rasc.folgas.some(function (x) { return x.cpf === f.cpf; });
      var acoes = pendente ? [botao('tpl-escala-edicao-tirar-folga', function () {
        mudar(function () { rasc.folgas = rasc.folgas.filter(function (x) { return x.cpf !== f.cpf; }); });
      })] : [];
      var linha = linhaMilitar([], false, { cpf: f.cpf, grad: f.grad, nome: f.nome, periodos: [{ hi: f.hi, hf: f.hf }] },
        { folga: true, icone: 'icone-folgas', novo: pendente, acoes: acoes });
      if (linha) caixa.appendChild(linha);
    });
    return caixa;
  }

  /* Observações: as do dia menos as que o admin tirou, mais as que ele escreveu (gravam no Salvar) */
  function caixaObservacoes(dados) {
    var lista = (dados.observacoes || []).filter(function (o) {
      return !(o.classe === 'admin' && rasc.observacoes.remover.indexOf(o.id) >= 0);
    });
    rasc.observacoes.adicionar.forEach(function (texto, i) { lista.push({ classe: 'admin', texto: texto, novo: i }); });
    return pecas().observacoes(lista, {
      editar: ctx.admin,
      aoAdicionar: function (texto) { rasc.observacoes.adicionar.push(texto); desenhar(); },
      aoRemover: function (o) {
        if (o.novo != null) rasc.observacoes.adicionar.splice(o.novo, 1);
        else if (o.id) rasc.observacoes.remover.push(o.id);
        desenhar();
      }
    });
  }

  /* aviso quando o Chefe de Socorro ou o Oficial de Área muda por causa de uma alteração do rascunho */
  function notasPapeis(corpo, dados) {
    var antes = papeis(ctx.dadosBase), agora = papeis(dados);
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
    p.anexarProblemas(dados);   // CNH, regra, exclusivo e grau de cada militar (do banco, sobre o rascunho)
    /* trava o Salvar o vermelho que o manual causou: fora da disponibilidade, sobreposição, acima do máximo,
       condutor sem a CNH exigida, função proibida pela regra e o militar em duas unidades ao mesmo tempo */
    var vermelhoManual = (dados.problemas || []).some(function (pr) {
      return (pr.codigo === 'cnh_incompativel' || pr.codigo === 'regra_proibida' || pr.codigo === 'duas_unidades') && pr.manual;
    });
    haConflito = !!p.temConflito(dados.postos, true) || vermelhoManual;

    if (!ctx.semAvisos) {
      var aviso = p.montarAvisoProblemas(dados.problemas, dados.postos, dados.faltam_modelos, ctx.admin && contarAlteracoes() > 0 && haConflito);
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
    atualizarRodape();
  }

  /* ---------- rodapé do dia: o histórico, ou N alterações · Cancelar · Salvar ---------- */

  function atualizarRodape() {
    if (!ctx || ctx.emSub || !ctx.rodape) return;
    var rodape = ctx.rodape;
    var n = ctx.admin ? contarAlteracoes() : 0;
    if (!n) {
      /* nada a salvar: o rodapé mostra quem já mexeu no dia */
      if (ctx.comHistorico) return;
      ctx.comHistorico = true;
      ctx.btnSalvar = null; ctx.info = null;
      pecas().alteracoes(rodape, ctx.unidadeId, ctx.iso, function () { return !!ctx && ctx.comHistorico && !ctx.emSub; });
      return;
    }
    if (ctx.comHistorico || !ctx.btnSalvar) {
      ctx.comHistorico = false;
      rodape.textContent = '';
      ctx.info = RosterWork.tpl('tpl-escala-edicao-info');
      if (ctx.info) rodape.appendChild(ctx.info);
      var tpl = document.getElementById('tpl-escala-painel-acoes');
      if (tpl) rodape.appendChild(tpl.content.cloneNode(true));
      rodape.classList.remove('oculto');
      var cancelar = rodape.querySelector('.escala-painel-cancelar');
      if (cancelar) cancelar.addEventListener('click', aoClicarCancelar);
      ctx.btnSalvar = rodape.querySelector('.escala-painel-salvar');
      if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    }
    if (ctx.info) ctx.info.textContent = msg().alteracoesNaoSalvas(n);
    if (ctx.btnSalvar) ctx.btnSalvar.disabled = haConflito;
  }

  /* volta ao que está salvo (lê o dia de novo) */
  function recarregar() {
    if (!ctx) return;
    montar(ctx.corpo, ctx.rodape, ctx.unidadeId, ctx.iso, { admin: ctx.admin });
  }

  function aoClicarCancelar() {
    if (contarAlteracoes() > 0 && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: msg().descartarAlteracoes,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: recarregar
      });
    } else {
      recarregar();
    }
  }

  function salvar() {
    if (!ctx || haConflito || !contarAlteracoes()) return;
    /* captura antes do salvar assíncrono */
    var c = ctx, uid = ctx.unidadeId, isoSalvo = ctx.iso;
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // refaz a escala do dia: círculo + tela travada
    RosterWork.escalasDados.salvarDia(uid, isoSalvo, paraSalvar()).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r._falha === 'conexao') {
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      } else if (r && r._falha === 'servidor') {
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
      } else if (r && r.success) {
        if (ctx === c) recarregar();
        /* avisa a grade para atualizar só esta célula (sem re-renderizar tudo) */
        window.dispatchEvent(new CustomEvent('rosterwork_escala_salva', { detail: { unidadeId: uid, iso: isoSalvo } }));
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
      } else {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaSalvar });
      }
    });
  }

  /* ---------- sub-telas (formulário e militar no dia) ---------- */

  /* troca a lista por uma sub-tela: "Voltar ao dia" no topo e Cancelar · Aplicar no rodapé.
     montar(corpo) desenha o conteúdo; aoAplicar() faz a mudança e chama concluirSub() */
  function abrirSub(textoAplicar, montarConteudo, aoAplicar) {
    if (!ctx || !rasc || !ctx.admin) return;
    if (!ctx.emSub) foto = copiar(rasc);   // de uma sub-tela para outra, a foto continua a do dia
    ctx.emSub = true;
    ctx.comHistorico = false;
    ctx.btnSalvar = null;
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
    var tpl = document.getElementById('tpl-escala-sub-acoes');
    if (tpl) rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-sub-cancelar');
    var aplicar = rodape.querySelector('.escala-sub-aplicar');
    if (cancelar) cancelar.addEventListener('click', cancelarSub);
    if (aplicar) { aplicar.textContent = textoAplicar; aplicar.addEventListener('click', function () { aoAplicar(); }); }
  }
  function cancelarSub() { if (!ctx) return; if (foto) rasc = foto; desenhar(); }
  function concluirSub() { if (!ctx) return; anterior = foto; desenhar(); }

  function abrirFormulario(cfg) { if (RosterWork.escalasPainelFormulario) RosterWork.escalasPainelFormulario.abrir(cfg); }
  function abrirMilitar(cpf) { if (RosterWork.escalasPainelMilitar) RosterWork.escalasPainelMilitar.abrir(cpf); }

  /* ---------- ciclo de vida ---------- */

  /* opcoes = { admin, dados, semAvisos }: o admin edita; os outros só leem. dados = o dia já lido
     (não busca no banco); semAvisos = sem a lista de avisos do topo (a página tem a sua).
     Sem rodape, o rodapé não é usado */
  function montar(corpo, rodape, unidadeId, iso, opcoes) {
    opcoes = opcoes || {};
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, admin: !!opcoes.admin, comparar: !!opcoes.comparar,
      dadosProntos: opcoes.dados || null, semAvisos: !!opcoes.semAvisos,
      dados: null, dadosBase: null, chaveDados: null, btnSalvar: null, info: null, emSub: false, comHistorico: false };
    rasc = null; base = null; anterior = null; foto = null; haConflito = false;
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    desenhar();
  }

  function reset() {
    if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    ctx = null; rasc = null; base = null; anterior = null; foto = null; haConflito = false;
    pedido++;
  }

  /* guarda de saída: o navegador avisa ao fechar/recarregar com alteração não salva */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return contarAlteracoes() > 0; });
  }

  window.RosterWork.escalasPainelEditar = {
    montar: montar,
    reset: reset,
    estaSujo: function () { return contarAlteracoes() > 0; },
    /* para as sub-telas (escalas-painel-formulario.js e escalas-painel-militar.js) */
    sub: {
      dados: function () { return ctx && ctx.dados; },
      iso: function () { return ctx && ctx.iso; },
      unidadeId: function () { return ctx && ctx.unidadeId; },
      rascunho: function () { return rasc; },
      abrir: abrirSub,
      concluir: concluirSub,
      cancelar: cancelarSub,
      previa: previa,
      abrirFormulario: abrirFormulario,
      aplicarColocacao: aplicarColocacao,
      aplicarMilitar: aplicarMilitar,
      darFolga: darFolga,
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
