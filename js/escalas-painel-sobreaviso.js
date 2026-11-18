/* ============================================================
   ESCALAS — painel do dia › o bloco Sobreaviso (aba Funções)
   O sobreaviso da companhia no dia (ler_distribuicao_dia ›
   sobreaviso: { companhia_id, unidade_id, falta, militares }; com
   unidade_id, as regras da companhia dizem "de cada pelotão" e é o
   desse pelotão), depois dos Estagiários e antes das viaturas, para
   todos (só na Escala; o
   "Como fica a escala" das Pendências não o mostra). Quem administra
   a companhia (ou o pelotão, no sobreaviso de cada pelotão) tem o
   lápis de cada um (Pôr
   outro no lugar dele, Mudar o horário e Remover do sobreaviso) e o
   Adicionar ao sobreaviso. O rascunho de outro dia fica guardado na
   gaveta (escalas-rascunho-dias.js) e volta com o dia. Cada escolha entra no rascunho daqui na
   hora (o Desfazer e o Refazer da aba Funções passam por aqui antes
   do rascunho do Dia) e só grava no Salvar do rodapé largo
   (escalas-painel-salvar.js manda a parte "sobreaviso" do
   escala_painel_salvar). A lista do Militar vem do banco, na ordem
   da fila (sobreaviso_candidatos), com a conta de cada um (o saldo)
   e quem não pode apagado, com o motivo. Na célula da grade, o clique num nome do sobreaviso abre,
   para quem mexe nele, a caixa ao lado (escalas-celula-sobreaviso-
   caixa.js, pelo naCaixa: o mesmo rascunho, sem o painel); para os
   outros, o painel com o lápis dele aberto. A grade mostra o
   rascunho (escalas-celula-sobreaviso.js › rascunho). Quem o
   administrador pôs ou mudou fica fixado (o sistema não o muda), como
   a função fixada: o selo Fixado para quem mexe, o cadeado para os
   outros e na grade.
   Não cria HTML nem escreve estilo.
   API: RosterWork.escalasPainelSobreaviso.{ montar(corpo, dados, ctx),
   clique(evento), contar(), envio(), descartar(), aposGravar(),
   podeDesfazer(), podeRefazer(), desfazer(), refazer(), aberta(),
   naCaixa }
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var dia = null;          // { chave, companhia, unidadeId, iso, falta, antes, agora }
  var pilha = [];          // os "agora" de antes de cada mudança (o Desfazer volta um)
  var pilhaRefazer = [];   // os desfeitos
  var aberta = null;       // a linha aberta: { cpf (quem sai; null = o Adicionar), modo: 'militar' | 'horario' }
  var tela = null;         // o bloco na tela: { bloco, editavel }
  var menuPedido = null;   // o cpf cujo lápis abre quando o bloco aparecer (o clique na célula da grade)

  function msg() { return RW.mensagens.escala.sobreaviso; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function copia(lista) { return (lista || []).map(function (m) { return Object.assign({}, m); }); }
  function diaMes(iso) { return RW.data.isoParaBR(iso).slice(0, 5); }
  function soHora(t) { return t ? String(t).slice(0, 2) + 'h' : ''; }
  function deAntes(cpf) { return dia.antes.filter(function (x) { return x.cpf === cpf; })[0] || null; }
  function deAgora(cpf) { return dia.agora.filter(function (x) { return x.cpf === cpf; })[0] || null; }
  function naEscala() { return !!document.querySelector('.conteudo #escala-modos'); }

  /* o dia ainda pode mudar: até 7 dias atrás (o banco confere de novo) */
  function noLimite(iso) {
    var d = RW.data.diaDeServico();
    d.setDate(d.getDate() - 7);
    var limite = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return iso >= limite;
  }

  /* ---------- o rascunho ---------- */

  /* o dia d ficou diferente do lido: alguém entrou, saiu ou mudou de horário (d: o de agora ou um guardado na gaveta) */
  function mudouEm(d) {
    if (!d) return false;
    function em(lista, cpf) { return lista.filter(function (x) { return x.cpf === cpf; })[0] || null; }
    return d.agora.some(function (m) {
      var a = em(d.antes, m.cpf);
      return !a || a.horaInicio !== m.horaInicio || a.horaFim !== m.horaFim;
    }) || d.antes.some(function (a) { return !em(d.agora, a.cpf); });
  }
  function mudou() { return mudouEm(dia); }

  /* as alterações não salvas, como no rascunho do Dia: os passos dados (pelo menos 1), só com o dia diferente */
  function contar() { return mudou() ? Math.max(1, pilha.length) : 0; }

  function avisar() {
    naGrade();
    window.dispatchEvent(new CustomEvent('rosterwork_escala_rascunho', { detail: { parte: 'sobreaviso' } }));
  }

  /* o rascunho como vai ficar: quem entra e o horário mudado ficam como do administrador (o cadeado), como no Salvar */
  function comoVaiFicar(d) {
    return copia(d.agora).map(function (m) {
      var a = d.antes.filter(function (x) { return x.cpf === m.cpf; })[0] || null;
      m.origem = !a || a.horaInicio !== m.horaInicio || a.horaFim !== m.horaFim ? 'administrador' : a.origem;
      return m;
    });
  }

  /* a grade mostra o dia como vai ficar (escalas-celula-sobreaviso.js): com mudança, o rascunho; sem, o gravado. gravou: o
     que foi gravado fica na grade até a leitura nova chegar. d: o dia de agora ou um guardado na gaveta */
  function naGradeDe(d, gravou) {
    if (!d || !RW.escalasCelulaSobreaviso) return;
    RW.escalasCelulaSobreaviso.rascunho(d.chave, d.iso, gravou || mudouEm(d) ? comoVaiFicar(d) : null, !!gravou);
  }
  function naGrade(gravou) { naGradeDe(dia, gravou); }

  /* ---------- a gaveta dos dias (escalas-rascunho-dias.js; só na Escala) ---------- */

  function G() { return RW.escalasRascunhoDias || null; }
  /* o dia de agora sai: com mudança ou passo, fica guardado (a grade continua mostrando o rascunho dele) */
  function guardarAgora() {
    if (G() && dia && (mudou() || pilha.length || pilhaRefazer.length)) {
      G().guardar('sobreaviso', { chave: dia.chave, unidadeId: dia.unidadeId, iso: dia.iso,
        estado: { dia: dia, pilha: pilha, pilhaRefazer: pilhaRefazer } });
    }
    dia = null; pilha = []; pilhaRefazer = []; aberta = null;
  }
  function trazerGuardado(chave) {
    var item = G() && G().tirar('sobreaviso', chave);
    if (!item) return;
    dia = item.estado.dia; pilha = item.estado.pilha; pilhaRefazer = item.estado.pilhaRefazer; aberta = null;
  }

  /* uma mudança é um passo do Desfazer (também na ordem dos passos de todos os dias, escalas-rascunho-dias.js) */
  function mudar(fazer) {
    pilha.push(copia(dia.agora));
    pilhaRefazer = [];
    if (G()) G().passou('sobreaviso', dia.chave);
    fazer();
    desenhar();
    avisar();
  }

  /* o que vai para o Salvar: { antes, depois } (cada um [{ cpf, hi, hf }]), ou null sem mudança (d: um dia guardado na
     gaveta; sem ele, o de agora) */
  function envio(d) {
    d = d || dia;
    if (!mudouEm(d)) return null;
    var curto = function (lista) { return lista.map(function (m) { return { cpf: m.cpf, hi: m.horaInicio, hf: m.horaFim }; }); };
    return { antes: curto(d.antes), depois: curto(d.agora) };
  }

  function descartar() {
    if (!dia) return;
    dia.agora = copia(dia.antes);
    pilha = []; pilhaRefazer = []; aberta = null;
    desenhar();
    naGrade();
  }

  /* gravou: o painel lê o dia de novo e o bloco recomeça dele */
  function aposGravar() {
    if (dia && mudou()) naGrade(true);
    dia = null; pilha = []; pilhaRefazer = []; aberta = null;
  }

  function podeDesfazer() { return !!dia && !aberta && pilha.length > 0; }
  function podeRefazer() { return !!dia && !aberta && pilhaRefazer.length > 0; }
  function desfazer() {
    if (!podeDesfazer()) return;
    pilhaRefazer.push(copia(dia.agora));
    dia.agora = pilha.pop();
    desenhar();
    avisar();
  }
  function refazer() {
    if (!podeRefazer()) return;
    pilha.push(copia(dia.agora));
    dia.agora = pilhaRefazer.pop();
    desenhar();
    avisar();
  }

  /* ---------- o bloco ---------- */

  /* o dia do sobreaviso (s: o do ler_distribuicao_dia), do painel ou da caixa da célula: o rascunho de antes fica enquanto
     tem mudança ou passo a refazer no mesmo dia da mesma companhia (no sobreaviso de cada pelotão, do mesmo pelotão) */
  function preparar(s, unidadeId, iso) {
    if (!s) return false;
    var chave = (s.unidade_id || s.companhia_id) + '|' + iso;
    /* outro dia: o de agora, com mudança ou passo, vai para a gaveta (escalas-rascunho-dias.js), e o deste volta dela */
    if (dia && dia.chave !== chave) guardarAgora();
    if (!dia) trazerGuardado(chave);
    if (!dia || dia.chave !== chave || (!contar() && !pilha.length && !pilhaRefazer.length)) {
      dia = { chave: chave, companhia: s.companhia_id, unidadeId: unidadeId, iso: iso, falta: s.falta || 0,
        antes: copia(s.militares), agora: copia(s.militares) };
      pilha = []; pilhaRefazer = []; aberta = null;
    }
    return true;
  }

  /* o bloco no corpo da aba Funções (escalas-painel-editar.js › renderLista) */
  function montar(corpo, dados, ctx) {
    tela = null;
    var s = dados && dados.sobreaviso;
    if (!s || !naEscala()) return;
    preparar(s, ctx.unidadeId, ctx.iso);
    var bloco = RW.tpl('tpl-escala-sobreaviso-bloco');
    if (!bloco) return;
    var quem = s.unidade_id ? ['pelotao', s.unidade_id] : ['companhia', s.companhia_id];
    var editavel = !!ctx.admin && !!(RW.sessao && RW.sessao.podeAdministrar(quem[0], quem[1])) && noLimite(ctx.iso);
    bloco.querySelector('.escala-sobreaviso-adicionar').addEventListener('click', function () {
      aberta = { cpf: null, modo: 'militar' };
      desenhar();
    });
    corpo.appendChild(bloco);
    tela = { bloco: bloco, editavel: editavel };
    desenhar();
    abrirMenuPedido();
  }

  function desenhar() {
    if (!tela || !dia || !tela.bloco.isConnected) return;
    var lista = tela.bloco.querySelector('.escala-sobreaviso-bloco-lista');
    lista.textContent = '';
    var falta = Math.max(0, dia.falta + dia.antes.length - dia.agora.length);
    if (dia.agora.length || falta || aberta) {
      var grupo = RW.tpl('tpl-escala-edicao-grupo'), rotulo = RW.tpl('tpl-escala-edicao-funcao-rotulo');
      rotulo.textContent = msg().dica;
      grupo.querySelector('.escala-edicao-funcao').appendChild(rotulo);
      var linhas = grupo.querySelector('.escala-edicao-linhas');
      dia.agora.forEach(function (m) { linhas.appendChild(aberta && aberta.cpf === m.cpf ? editor(m) : linhaDe(m)); });
      if (falta) linhas.appendChild(linhaFalta(falta));
      if (aberta && !aberta.cpf) linhas.appendChild(editor(null));
      lista.appendChild(grupo);
    }
    tela.bloco.querySelector('.escala-sobreaviso-bloco-acao').classList.toggle('oculto', !tela.editavel || !!aberta);
  }

  /* um ícone na frente do nome */
  function icone(el, nome) {
    var ic = RW.tpl('tpl-escala-mes-origem');
    if (ic) { ic.querySelector('use').setAttribute('href', 'icones/todos.svg#' + nome); el.querySelector('.escala-distribuicao-icones').appendChild(ic); }
  }

  /* a linha de quem está de sobreaviso: o telefone, o nome, o horário e o lápis; "Novo" no que ainda não foi salvo; o nome
     em amarelo no dia em que ele não está livre, com o porquê na dica. O que o administrador pôs ou mudou, como a função
     fixada: para quem mexe, o selo Fixado depois do nome; para quem só lê, o cadeado (na linha com "Novo" ele sai) */
  function linhaDe(m) {
    var el = RW.tpl('tpl-escala-edicao-linha');
    el.setAttribute('data-cpf', m.cpf);
    icone(el, 'icone-sobreaviso');
    el.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
    el.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
    var pessoa = el.querySelector('.escala-edicao-pessoa');
    var a = deAntes(m.cpf);
    if (!a || a.horaInicio !== m.horaInicio || a.horaFim !== m.horaFim) {
      var novo = RW.tpl('tpl-escala-edicao-novo');
      if (novo) pessoa.appendChild(novo);
    } else if (a.origem === 'administrador') {
      if (!tela.editavel) icone(el, 'icone-cadeado');
      else { var selo = RW.tpl('tpl-escala-edicao-fixado'); if (selo) pessoa.appendChild(selo); }
    }
    if (a && m.conflito) {
      el.classList.add('escala-sobreaviso-conflito');
      pessoa.setAttribute('data-dica', msg().conflito[m.conflito]);
    }
    var hora = RW.tpl('tpl-escala-distribuicao-hora');
    if (hora) {
      hora.querySelector('.escala-distribuicao-hora-ini').textContent = soHora(m.horaInicio);
      hora.querySelector('.escala-distribuicao-hora-fim').textContent = soHora(m.horaFim);
      el.querySelector('.escala-distribuicao-horas').appendChild(hora);
    }
    if (tela.editavel) el.querySelector('.escala-edicao-acoes').appendChild(lapis(m));
    return el;
  }

  /* quem falta para a regra da companhia, em amarelo */
  function linhaFalta(n) {
    var el = RW.tpl('tpl-escala-edicao-linha');
    el.classList.add('escala-sobreaviso-falta');
    el.querySelector('.escala-distribuicao-nome').textContent = msg().falta(n);
    return el;
  }

  /* o lápis: o menu com o nome e o dia */
  function lapis(m) {
    var dd = RW.tpl('tpl-escala-sobreaviso-opcoes');
    dd.querySelector('.escala-edicao-opcoes-titulo').textContent = msg().menuTitulo(nomeDe(m), diaMes(dia.iso));
    Array.prototype.forEach.call(dd.querySelectorAll('[data-acao]'), function (b) {
      b.addEventListener('click', function () { fazer(b.getAttribute('data-acao'), m); });
    });
    return dd;
  }

  function fazer(acao, m) {
    if (acao === 'remover') {
      mudar(function () { dia.agora = dia.agora.filter(function (x) { return x.cpf !== m.cpf; }); });
      return;
    }
    aberta = { cpf: m.cpf, modo: acao === 'horario' ? 'horario' : 'militar' };
    desenhar();
  }

  /* a linha aberta: o Militar (o Pôr outro no lugar dele e o Adicionar) ou o Horário; o X fecha */
  function editor(m) {
    var el = RW.tpl('tpl-escala-sobreaviso-editar');
    el.querySelector('.escala-linha-pessoa').textContent = m ? nomeDe(m) : '';
    el.querySelector('.escala-linha-fechar').addEventListener('click', function () { aberta = null; desenhar(); avisar(); });
    var porHorario = aberta.modo === 'horario';
    el.querySelector('.escala-sobreaviso-editar-militar').classList.toggle('oculto', porHorario);
    el.querySelector('.escala-sobreaviso-editar-horario').classList.toggle('oculto', !porHorario);
    if (porHorario) {
      var h = RW.horario.linha({ hi: m.horaInicio, hf: m.horaFim, semAcoes: true,
        aoInicio: function (v) { mudar(function () { deAgora(m.cpf).horaInicio = v; }); },
        aoFim: function (v) { mudar(function () { deAgora(m.cpf).horaFim = v; }); } });
      if (h) el.querySelector('.escala-sobreaviso-editar-periodo').appendChild(h);
    } else {
      campoMilitar(el, m);
    }
    return el;
  }

  /* o campo Militar: a lista do banco, na ordem da fila; quem já está no rascunho do dia fica apagado */
  function campoMilitar(el, m) {
    var M = msg();
    var inp = el.querySelector('.escala-sobreaviso-editar-militar input');
    var menu = el.querySelector('.escala-sobreaviso-editar-militar .dropdown-menu');
    inp.id = 'escala-sobreaviso-militar';
    var campo = RW.comboMilitar.criar(inp, menu, {
      atual: function () { return null; },
      aoEscolher: function (item) { escolher(m, item); },
      textos: { selecione: m ? M.escolherNoLugar(nomeDe(m)) : M.escolherNovo, semNinguem: M.semNinguem, filtroVazio: M.filtroVazio }
    });
    if (!campo) return;
    campo.definir(M.carregando, true);
    campo.habilitar(false);
    var pedido = aberta;
    RW.escalasDados.sobreavisoCandidatos(dia.unidadeId, dia.iso, m ? m.cpf : null).then(function (r) {
      if (aberta !== pedido || !inp.isConnected) return;   // fechou ou abriu outra linha enquanto lia
      if (!r) { campo.definir(M.falhaLista, true); return; }
      campo.preencher(lista(r, m));
    });
  }

  /* os grupos do banco para o campo: os dois primeiros abertos; à direita, a conta (o saldo) com o último sobreaviso ou o
     solto, ou o motivo */
  function lista(r, m) {
    var M = msg(), noDia = dia.agora.map(function (x) { return x.cpf; }), itens = [];
    (r.grupos || []).forEach(function (g) {
      var deles = (g.militares || []).filter(function (x) { return !(m && x.cpf === m.cpf); }).map(function (x) {
        var motivo = x.motivo || (noDia.indexOf(x.cpf) >= 0 ? 'ja_esta' : null);
        var ultimo = x.ultimo ? diaMes(x.ultimo) : '';
        return { cpf: x.cpf, grad: x.grad, nome: x.nome, nome_completo: x.nome_completo, rg: x.rg, inativo: !!motivo,
          info: motivo ? M.motivo[motivo](x.ate ? diaMes(x.ate) : '')
            : x.saldo != null ? M.conta(Number(x.saldo), x.solto, ultimo)
            : (x.solto ? M.solto : M.ultimo)(ultimo) };
      });
      if (!deles.length) return;
      itens.push({ titulo: M.grupos[g.grupo], aberto: g.grupo !== 'nao_podem' });
      itens = itens.concat(deles);
    });
    return itens;
  }

  function escolher(m, item) {
    var novo = { cpf: item.cpf, grad: item.grad, nome: item.nome, nome_completo: item.nome_completo, rg: item.rg,
      horaInicio: m ? m.horaInicio : '08:00', horaFim: m ? m.horaFim : '08:00', conflito: null };
    aberta = null;
    mudar(function () {
      if (m) dia.agora = dia.agora.map(function (x) { return x.cpf === m.cpf ? novo : x; });
      else dia.agora.push(novo);
    });
  }

  /* ---------- o clique na célula da grade ---------- */

  /* o clique num nome do sobreaviso (ou na linha do que falta; na página Sobreaviso, em qualquer lugar da célula) que não
     abriu a caixa da célula (quem não mexe no sobreaviso, o painel aberto): o painel do dia no bloco, com o lápis do nome
     clicado. true diz ao painel que é daqui (a linha tracejada de cima do grupo é do dia: o painel abre como sempre) */
  function clique(evento) {
    var campo = evento.target.closest && !evento.target.closest('.escala-grupo-linha') ? evento.target.closest('.escala-sobreaviso') : null;
    var naPagina = !!(RW.paginaSobreaviso && RW.paginaSobreaviso.ativa());
    if (!campo && !naPagina) return false;
    var linha = evento.target.closest('.linha-escalado[data-cpf]');
    menuPedido = { cpf: linha ? linha.getAttribute('data-cpf') : null };
    return true;
  }

  /* ---------- a caixa da célula (escalas-celula-sobreaviso-caixa.js): o mesmo rascunho, sem o painel ---------- */
  var naCaixa = {
    /* s: o sobreaviso do dia lido pela célula (ler_distribuicao_dia); false: o dia não tem */
    preparar: preparar,
    militar: function (cpf) { return dia ? deAgora(cpf) : null; },
    remover: function (cpf) {
      if (!deAgora(cpf)) return;
      mudar(function () { dia.agora = dia.agora.filter(function (x) { return x.cpf !== cpf; }); });
    },
    /* quem entra no lugar de cpf (sem ele, o Adicionar) */
    escolher: function (cpf, item) { escolher(cpf ? deAgora(cpf) : null, item); },
    horario: function (cpf, campo, valor) {
      if (!deAgora(cpf)) return;
      mudar(function () { deAgora(cpf)[campo] = valor; });
    },
    lista: function (r, cpf) { return lista(r, cpf ? deAgora(cpf) : null); },
    /* o Abrir o painel do dia da caixa: o painel abre com o bloco à vista (cpf: com o lápis dele aberto) */
    pedirBloco: function (cpf) { menuPedido = { cpf: cpf || null }; }
  };

  /* o bloco pedido pelo clique na célula fica à vista, com o lápis dele aberto; o lápis abre depois do clique que o pediu
     (o clique ainda chega ao document e fecharia o menu) */
  function abrirMenuPedido() {
    var pedido = menuPedido, bloco = tela && tela.bloco;
    menuPedido = null;
    if (!pedido || !bloco) return;
    var cpf = pedido.cpf;
    setTimeout(function () {
      if (!bloco.isConnected) return;
      bloco.scrollIntoView({ block: 'nearest' });
      var dd = cpf ? bloco.querySelector('.escala-edicao-linha[data-cpf="' + cpf + '"] .escala-edicao-opcoes') : null;
      if (dd && RW.abrirDropdown) RW.abrirDropdown(dd);
    }, 0);
  }

  RW.escalasPainelSobreaviso = {
    montar: montar, clique: clique, contar: contar, envio: envio, descartar: descartar, aposGravar: aposGravar,
    podeDesfazer: podeDesfazer, podeRefazer: podeRefazer, desfazer: desfazer, refazer: refazer,
    aberta: function () { return !!aberta; }, naCaixa: naCaixa,
    /* para a gaveta dos dias (escalas-rascunho-dias.js) */
    gaveta: {
      vivo: function () {
        return dia && (mudou() || pilha.length || pilhaRefazer.length) ? { chave: dia.chave, unidadeId: dia.unidadeId, iso: dia.iso, vivo: true } : null;
      },
      contar: function (item) { return item.vivo ? contar() : (mudouEm(item.estado.dia) ? Math.max(1, item.estado.pilha.length) : 0); },
      /* o que vai para o Salvar (o de agora ou o guardado) */
      envio: function (item) { return envio(item.vivo ? dia : item.estado.dia); },
      pode: function (item, voltar) {
        if (item.vivo) return voltar ? podeDesfazer() : podeRefazer();
        return (voltar ? item.estado.pilha : item.estado.pilhaRefazer).length > 0;
      },
      andar: function (item, voltar) {
        if (item.vivo) {
          if (voltar) desfazer(); else refazer();
          return true;
        }
        var e = item.estado, de = voltar ? e.pilha : e.pilhaRefazer, para = voltar ? e.pilhaRefazer : e.pilha;
        if (!de.length) return false;
        para.push(copia(e.dia.agora));
        e.dia.agora = de.pop();
        naGradeDe(e.dia);
        return true;
      },
      limparRefazer: function (item) { item.estado.pilhaRefazer = []; },
      /* saiu da gaveta: gravado, a grade mostra o gravado até a leitura nova; descartado, volta ao gravado */
      soltar: function (item, gravou) {
        var d = item.estado.dia;
        if (RW.escalasCelulaSobreaviso) RW.escalasCelulaSobreaviso.rascunho(d.chave, d.iso, gravou && mudouEm(d) ? comoVaiFicar(d) : null, !!gravou);
      }
    }
  };
})();
