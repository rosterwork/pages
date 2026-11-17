/* ============================================================
   AFASTAMENTOS — o rascunho
   (RosterWork.afastamentosRascunho)
   O que foi mudado e ainda não foi salvo, de um ou mais militares: a
   as abas da página e o painel do militar usam o mesmo rascunho e
   todos já mostram o resultado. Guarda os afastamentos gravados que
   já foram lidos (conhecer) e, por cima deles, os criados, os mudados
   e os removidos. O rodapé largo da página (#afastamentos-rodape)
   aparece com alteração: Desfazer e Refazer (Ctrl+Z e Ctrl+Y),
   Cancelar (joga fora o que não foi salvo) e Salvar, desligado
   enquanto algum afastamento tem problema (afastamentos_salvar, tudo
   ou nada; os avisos do banco vêm numa lista só, por militar, e o
   administrador decide se segue). Gravou: o que foi lido é esquecido,
   as telas releem e o resumo abre. Sair da página, fechar ou
   recarregar com algo não salvo avisa antes (guarda de saída).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var CAMPOS = ['inicio', 'fim', 'nome', 'padrao', 'gua', 'tro', 'ext', 'sob'];

  var gravados = {};        // cpf -> { id -> afastamento gravado, no formato do rascunho }
  var mudancas = {};        // cpf -> { novos: [afastamento], mudados: { id: afastamento }, removidos: { id: true } }
  var pilhaDesfazer = [];   // o rascunho de antes de cada passo (o Desfazer volta um)
  var pilhaRefazer = [];    // os passos desfeitos
  var ultimaChave = null;   // o campo que está sendo digitado: as letras seguidas são um passo só
  var ouvintes = {};        // quem redesenha a cada mudança: nome -> fn(origem)
  var seq = 0;
  var raiz = null;          // a página Afastamentos
  var salvando = false;
  var setorDe = null;       // cpf -> o setor do militar (da página), para saber se o Salvar refaz a escala
  var teclasLigadas = false;

  function M() { return RW.mensagens.afastamentos; }
  function D() { return RW.data; }

  /* ---------- os afastamentos ---------- */

  /* a linha do banco (afastamentos_ano_listar) no formato do rascunho */
  function doBanco(x) {
    return {
      id: x.afastamento_id, chave: x.afastamento_id, cpf: String(x.usuario_id),
      inicio: String(x.data_inicio || '').slice(0, 10), fim: String(x.data_fim || '').slice(0, 10),
      nome: x.nome || '', padrao: x.padrao || null, gua: !!x.sai_da_guarnicao, tro: !!x.sai_das_trocas,
      ext: !!x.sai_da_extra, sob: !!x.sai_do_sobreaviso, escolheu: true
    };
  }
  function copiar(af) { return JSON.parse(JSON.stringify(af)); }
  function igual(a, b) { return !!a && !!b && CAMPOS.every(function (k) { return a[k] === b[k]; }); }
  /* em branco: sem nome e sem datas, ou só com o dia do clique (o Adicionar do mês e do calendário) */
  function vazio(af) {
    return !af.nome && ((!af.inicio && !af.fim) || (!!af.doDia && af.inicio === af.doDia && af.fim === af.doDia));
  }

  /* os gravados que chegaram do banco (a lista do ano ou a do militar) */
  function conhecer(lista) {
    (lista || []).forEach(function (x) {
      var af = doBanco(x);
      (gravados[af.cpf] = gravados[af.cpf] || {})[af.id] = af;
    });
  }

  function doMilitar(cpf) {
    return mudancas[cpf] = mudancas[cpf] || { novos: [], mudados: {}, removidos: {} };
  }
  function gravado(cpf, chave) { return (gravados[String(cpf)] || {})[chave] || null; }

  /* os afastamentos do militar como ficam (os gravados, com o rascunho por cima), em ordem de data; cada um diz se
     mudou (mudou) ou se é novo (novo) */
  function lista(cpf) {
    cpf = String(cpf);
    var g = gravados[cpf] || {};
    var x = mudancas[cpf] || { novos: [], mudados: {}, removidos: {} };
    var saida = [];
    Object.keys(g).forEach(function (id) {
      if (x.removidos[id]) return;
      var af = x.mudados[id] || g[id];
      saida.push(Object.assign({}, af, { mudou: !!x.mudados[id], novo: false }));
    });
    x.novos.forEach(function (af) { saida.push(Object.assign({}, af, { mudou: !vazio(af), novo: true })); });
    return saida.sort(function (a, b) {
      var ia = a.inicio || '9999', ib = b.inicio || '9999';
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
  }
  function achar(cpf, chave) {
    return lista(cpf).filter(function (af) { return af.chave === chave; })[0] || null;
  }
  /* os militares com afastamento lido ou criado */
  function militares() {
    var cpfs = {};
    Object.keys(gravados).forEach(function (c) { cpfs[c] = true; });
    Object.keys(mudancas).forEach(function (c) { cpfs[c] = true; });
    return Object.keys(cpfs);
  }

  /* ---------- os passos (cada mudança entra no Desfazer) ---------- */

  function foto() { return JSON.stringify(mudancas); }
  function passo(chave) {
    if (chave && chave === ultimaChave) return;
    pilhaDesfazer.push(foto());
    pilhaRefazer = [];
    ultimaChave = chave || null;
  }

  /* um afastamento novo, em branco (não conta nem vai para o banco até ter algo; o primeiro campo é o primeiro passo
     do Desfazer); devolve a chave dele */
  function criar(cpf, dia) {
    cpf = String(cpf);
    var af = { id: null, chave: 'novo-' + (++seq), cpf: cpf, inicio: dia || '', fim: dia || '', nome: '', padrao: null,
      gua: false, tro: true, ext: true, sob: true, escolheu: false, doDia: dia || null };
    doMilitar(cpf).novos.push(af);
    return af.chave;
  }
  /* o novo passa para outro militar (a pergunta Militar do Adicionar do calendário mudou), com o que já tem; é um passo
     do Desfazer quando ele já tem algo */
  function passarNovo(cpfDe, chave, cpfPara, origem) {
    var de = mudancas[String(cpfDe)];
    var af = de ? de.novos.filter(function (a) { return a.chave === chave; })[0] : null;
    if (!af) return;
    if (!vazio(af)) passo();
    de.novos = de.novos.filter(function (a) { return a.chave !== chave; });
    af.cpf = String(cpfPara);
    doMilitar(af.cpf).novos.push(af);
    avisar(origem);
  }
  /* o novo que ficou em branco sai sem deixar passo (a caixa fechou, o painel fechou) */
  function largar(cpf, chave) {
    var x = mudancas[String(cpf)];
    if (!x) return;
    x.novos = x.novos.filter(function (a) { return a.chave !== chave || !vazio(a); });
  }

  /* muda os campos de um afastamento; juntar: o nome do campo que está sendo digitado (um passo só) */
  function mudar(cpf, chave, campos, origem, juntar) {
    cpf = String(cpf);
    var x = doMilitar(cpf);
    var novo = x.novos.filter(function (a) { return a.chave === chave; })[0];
    var base = novo ? null : (x.mudados[chave] || gravado(cpf, chave));
    if (!novo && !base) return;
    passo(juntar ? cpf + '|' + chave + '|' + juntar : null);
    if (novo) {
      Object.assign(novo, campos);
    } else {
      x.mudados[chave] = Object.assign(copiar(base), campos);
      if (igual(x.mudados[chave], gravado(cpf, chave))) delete x.mudados[chave];
    }
    avisar(origem);
  }

  function remover(cpf, chave, origem) {
    cpf = String(cpf);
    var x = doMilitar(cpf);
    passo();
    var i = -1;
    x.novos.forEach(function (a, k) { if (a.chave === chave) i = k; });
    if (i >= 0) {
      x.novos.splice(i, 1);
    } else {
      delete x.mudados[chave];
      x.removidos[chave] = true;
    }
    avisar(origem);
  }

  function desfazer() {
    if (salvando || !pilhaDesfazer.length) return;
    pilhaRefazer.push(foto());
    mudancas = JSON.parse(pilhaDesfazer.pop());
    ultimaChave = null;
    avisar(null);
  }
  function refazer() {
    if (salvando || !pilhaRefazer.length) return;
    pilhaDesfazer.push(foto());
    mudancas = JSON.parse(pilhaRefazer.pop());
    ultimaChave = null;
    avisar(null);
  }
  /* joga fora o que não foi salvo */
  function limpar() {
    mudancas = {};
    pilhaDesfazer = [];
    pilhaRefazer = [];
    ultimaChave = null;
    avisar(null);
  }

  /* quantos afastamentos mudaram (os novos em branco não contam) */
  function contar() {
    var n = 0;
    Object.keys(mudancas).forEach(function (cpf) {
      var x = mudancas[cpf];
      n += Object.keys(x.removidos).length + Object.keys(x.mudados).length;
      n += x.novos.filter(function (a) { return !vazio(a); }).length;
    });
    return n;
  }

  /* ---------- o que está errado ---------- */

  /* meia-noite de hoje − 7 dias: o dia mais antigo que ainda muda (o mesmo limite do banco), e a véspera dele */
  function limite() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d;
  }
  function isoLimite(dias) {
    var d = limite();
    if (dias) d.setDate(d.getDate() + dias);
    return D().paraIsoDeData(d);
  }
  function br(iso) { return D().isoParaBR(iso); }

  /* o problema de um afastamento que mudou (o texto da nota) ou '' */
  function problemaDe(af) {
    if (!af || (!af.mudou && !af.novo) || (af.novo && vazio(af))) return '';
    if (!af.nome) return M().nomeVazio;
    if (!af.inicio || !af.fim) return M().datasVazias;
    if (af.fim < af.inicio) return M().fimAntes;
    var lim = isoLimite(), vespera = isoLimite(-1);
    var g = af.id ? gravado(af.cpf, af.id) : null;
    var aviso = M().limite(br(lim));
    /* nenhum dia de antes do limite entra nem sai; no que começou antes, o início e as marcas ficam */
    if (!g && af.inicio < lim) return aviso;
    if (g) {
      if (g.inicio !== af.inicio && (g.inicio < lim || af.inicio < lim)) return aviso;
      if (g.fim !== af.fim && (g.fim < lim || af.fim < vespera)) return aviso;
      if (g.inicio < lim && (g.gua !== af.gua || g.tro !== af.tro || g.ext !== af.ext || g.sob !== af.sob)) return aviso;
    }
    /* dois do mesmo nome não se cruzam */
    var nome = af.nome.toLowerCase();
    var cruza = lista(af.cpf).filter(function (o) {
      return o.chave !== af.chave && o.inicio && o.fim && o.nome.toLowerCase() === nome && af.inicio <= o.fim && o.inicio <= af.fim;
    })[0];
    if (cruza) return M().cruza(cruza.nome, br(cruza.inicio) + ' a ' + br(cruza.fim));
    return '';
  }
  function problema() {
    var achou = '';
    Object.keys(mudancas).some(function (cpf) {
      return lista(cpf).some(function (af) { achou = problemaDe(af); return !!achou; });
    });
    return achou;
  }

  /* ---------- o rodapé e a gravação ---------- */

  function el(id) { return raiz ? raiz.querySelector('#' + id) : null; }

  function pintarRodape() {
    var rodape = el('afastamentos-rodape');
    if (!rodape) return;
    var n = contar();
    rodape.classList.toggle('oculto', !n);
    el('afastamentos-mudancas').textContent = n ? RW.mensagens.escala.alteracoesNaoSalvas(n) : '';
    el('afastamentos-salvar').disabled = salvando || !n || !!problema();
    el('afastamentos-cancelar').disabled = salvando;
    el('afastamentos-desfazer').disabled = salvando || !pilhaDesfazer.length;
    el('afastamentos-refazer').disabled = salvando || !pilhaRefazer.length;
  }

  /* a gravação de cada militar mexido: os mudados e os novos inteiros e os ids que saem */
  function pedido() {
    return Object.keys(mudancas).map(function (cpf) {
      var x = mudancas[cpf];
      var afs = Object.keys(x.mudados).map(function (id) { return x.mudados[id]; })
        .concat(x.novos.filter(function (a) { return !vazio(a); }))
        .map(function (af) {
          return { afastamento_id: af.id || null, nome: af.nome, padrao: af.padrao, inicio: af.inicio, fim: af.fim,
            sai_da_guarnicao: !!af.gua, sai_das_trocas: !!af.tro, sai_da_extra: !!af.ext, sai_do_sobreaviso: !!af.sob };
        });
      var remover = Object.keys(x.removidos);
      return afs.length || remover.length ? { usuario_id: cpf, afastamentos: afs, remover: remover } : null;
    }).filter(Boolean);
  }

  /* o que o banco pediu para conferir: por militar (o nome dele na frente quando são vários) */
  function confirmarAvisos(lista, aoConfirmar) {
    var S = RW.mensagens.saida, situacoes = RW.mensagens.folgas.situacao;
    var varios = lista.length > 1;
    var itens = [], temServico = false, notaSaida = '';
    lista.forEach(function (r) {
      function de(texto) { return varios ? M().deQuem(r.titulo, texto) : texto; }
      (r.trocas || []).forEach(function (t) { temServico = true; itens.push({ titulo: S.tituloTroca, texto: de(M().itemTroca(t.data, t.com_quem)) }); });
      (r.extras || []).forEach(function (t) { temServico = true; itens.push({ titulo: S.tituloExtra, texto: de(M().itemExtra(t.data, t.unidade)) }); });
      (r.folgas || []).forEach(function (f) {
        temServico = true;
        itens.push({ titulo: S.tituloFolga, texto: de(M().itemFolga(f.data, (situacoes[f.situacao] || '').toLowerCase())) });
      });
      var pend = r.pendencias || {};
      if ((pend.trocas || []).length || (pend.folgas || []).length) {
        var saida = RW.avisoSaida(pend, { tipo: 'licenca', escala: M().itemSaiDaEscala(r.sai_em) });
        if (saida) {
          saida.itens.forEach(function (i) { itens.push({ titulo: i.titulo, texto: de(i.texto) }); });
          notaSaida = saida.nota;
        }
      }
      if (r.continua_fora) itens.push({ titulo: S.tituloEscala, texto: de(M().itemContinuaFora(r.continua_fora)) });
    });
    RW.confirmar({
      tipo: 'aviso', mensagem: temServico && !notaSaida ? M().confirmarTem : M().confirmarSo, itens: itens,
      nota: [temServico ? M().notaConfirmar : '', notaSaida].filter(Boolean).join(' '),
      textoConfirmar: RW.mensagens.botoes.continuar, textoCancelar: RW.mensagens.botoes.cancelar,
      aoConfirmar: aoConfirmar
    });
  }

  /* o banco refaz a escala quando mudam os dias de um afastamento de quem está nela (o operacional), ou a guarnição e
     as trocas dele, até o fim da escala já calculada (hoje + 90 dias); o nome, a extra, o sobreaviso e o que fica
     depois disso só gravam */
  function refazEscala() {
    var fimDaEscala = isoLimite(97);
    function entra(iso) { return !!iso && iso <= fimDaEscala; }
    return Object.keys(mudancas).some(function (cpf) {
      if (setorDe && String(setorDe(cpf) || 'Operacional').toUpperCase() !== 'OPERACIONAL') return false;
      var x = mudancas[cpf], g = gravados[cpf] || {};
      return x.novos.some(function (af) { return !vazio(af) && entra(af.inicio); })
        || Object.keys(x.removidos).some(function (id) { return !!g[id] && entra(g[id].inicio); })
        || Object.keys(x.mudados).some(function (id) {
          var a = g[id], d = x.mudados[id];
          if (!a) return false;
          if (a.inicio !== d.inicio || a.gua !== d.gua || a.tro !== d.tro) return entra(a.inicio < d.inicio ? a.inicio : d.inicio);
          return a.fim !== d.fim && (a.fim < d.fim ? a.fim : d.fim) < fimDaEscala;   // muda do dia seguinte ao fim mais cedo
        });
    });
  }

  function salvar(confirmar) {
    if (salvando || !contar() || problema()) return;
    var militaresMexidos = pedido();
    var refaz = refazEscala();
    salvando = true;
    pintarRodape();
    /* refaz a escala: a caixa na hora; só grava: os pontinhos no Salvar na hora e a caixa se passar de 1,5 s */
    var espera = refaz
      ? RW.etapas.acao('afastamentosSalvar', { refaz: true }, { doServidor: 2 })
      : RW.etapas.acao('afastamentosSalvar', { refaz: false },
        { doServidor: 1, botao: el('afastamentos-salvar'), atraso: true, semFila: true });
    function soltar() {
      var saiu = espera.parar();
      salvando = false;
      pintarRodape();
      return Promise.resolve(saiu);
    }
    RW.afastamentosDados.salvar(militaresMexidos, confirmar).then(function (r) {
      var saiu = soltar();
      if (r && r._falha === 'servidor') {
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor });
      } else if (r && r.precisa_confirmar) {
        saiu.then(function () { confirmarAvisos(r.militares || [], function () { salvar(true); }); });   // depois que a caixa sai
      } else if (r && r.success) {
        concluir(r);
      } else {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
      }
    }).catch(function () {
      soltar();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* gravou: o que foi lido é esquecido, as telas releem (a página e o painel) e o resumo abre */
  function concluir(r) {
    gravados = {};
    mudancas = {};
    pilhaDesfazer = [];
    pilhaRefazer = [];
    ultimaChave = null;
    avisar('gravou');
    if (RW.arvoreUnidades && RW.arvoreUnidades.recarregar) RW.arvoreUnidades.recarregar();
    if (r && r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Afastamentos' });
  }

  /* ---------- os avisos a quem redesenha ---------- */

  function ouvir(nome, fn) { ouvintes[nome] = fn; }
  function avisar(origem) {
    pintarRodape();
    Object.keys(ouvintes).forEach(function (k) { ouvintes[k](origem); });
  }

  /* com algo não salvo, pergunta antes de seguir (Descartar joga fora) */
  function perguntarAntes(seguir) {
    if (!contar()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { limpar(); seguir(); }
    });
  }

  /* Ctrl+Z e Ctrl+Y com a página à mostra (no campo que se digita, ficam com o campo) */
  function teclas(ev) {
    if (!raiz || !raiz.isConnected) return;
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    var alvo = ev.target;
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.modal-veu--aberto')) return;
    if (!pilhaDesfazer.length && !pilhaRefazer.length) return;
    var tecla = (ev.key || '').toLowerCase();
    if (tecla === 'z' && !ev.shiftKey) { ev.preventDefault(); desfazer(); }
    else if (tecla === 'y' || (tecla === 'z' && ev.shiftKey)) { ev.preventDefault(); refazer(); }
  }

  /* a navegação abriu a página: o rascunho começa vazio e o rodapé é ligado (as abas mostram o mesmo rascunho);
     opcoes.setor(cpf) diz o setor de cada militar */
  function iniciar(conteudo, opcoes) {
    raiz = conteudo;
    setorDe = (opcoes && opcoes.setor) || null;
    gravados = {};
    mudancas = {};
    pilhaDesfazer = [];
    pilhaRefazer = [];
    ultimaChave = null;
    salvando = false;
    var ligar = function (id, fn) {
      var b = el(id);
      if (b && !b.dataset.ligado) { b.dataset.ligado = '1'; b.addEventListener('click', fn); }
    };
    ligar('afastamentos-salvar', function () { salvar(false); });
    ligar('afastamentos-cancelar', limpar);
    ligar('afastamentos-desfazer', desfazer);
    ligar('afastamentos-refazer', refazer);
    if (!teclasLigadas) {
      teclasLigadas = true;
      document.addEventListener('keydown', teclas);
    }
    pintarRodape();
  }

  /* fechar ou recarregar com algo não salvo: o navegador avisa */
  if (RW.guardaSaida && RW.guardaSaida.registrar) {
    RW.guardaSaida.registrar(function () { return !!raiz && raiz.isConnected && contar() > 0; });
  }

  window.RosterWork.afastamentosRascunho = {
    iniciar: iniciar, conhecer: conhecer, lista: lista, achar: achar, gravado: gravado, militares: militares,
    criar: criar, passarNovo: passarNovo, largar: largar, mudar: mudar, remover: remover, contar: contar, problemaDe: problemaDe,
    isoLimite: isoLimite, ouvir: ouvir, perguntarAntes: perguntarAntes, salvando: function () { return salvando; }
  };
})();
