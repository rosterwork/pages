/* ============================================================
   TROCAS — a aba Várias trocas do Solicitar troca e do Registrar troca
   No Solicitar e no Registrar, o trocas-solicitar.js chama montar():
   as abas Uma troca | Várias trocas na linha das abas do painel; cada
   aba guarda o que foi preenchido, o rodapé muda com ela e a Várias
   trocas abre o painel largo. Aqui ficam o E-protocolo da aba, os
   militares da troca (no Solicitar, o primeiro é quem pede; no
   Registrar, a lista começa vazia e o admin não entra), o resumo que
   o banco monta (fn_trocas_varias_montar: duplas, rodas e o que fica
   sem devolução, com as notas do saldo) e o envio do pedido (um
   registro só, com o Desfazer no resumo). O calendário é o
   trocas-varias-calendario.js; a Análise e a gravação do Registrar,
   o trocas-varias-registrar.js.
   Expõe RosterWork.trocasVarias.{ montar, temDados, encerrar }
     montar({ corpo, registrar, aoSolicitar, aoMudar, cancelar })
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var est = null;          // o estado da aba aberta
  var timerResumo = null;
  var reqResumo = 0;       // token: só o resumo mais recente vale

  function C() { return RW.trocasCampos; }
  function M() { return RW.mensagens.trocas.varias; }
  function Cal() { return RW.trocasVariasCalendario; }
  function Reg() { return RW.trocasVariasRegistrar; }
  function q(sel) { return est && est.raiz ? est.raiz.querySelector(sel) : null; }

  /* ---------- as abas: cada uma guarda os dados; o rodapé e a largura mudam com ela ---------- */
  function mostrarAba(aba) {
    var varias = aba === 'varias';
    est.corpo.querySelector('.troca-solicitar-form').classList.toggle('oculto', varias);
    est.raiz.classList.toggle('oculto', !varias);
    Array.prototype.forEach.call(RW.painel.rodape().children, function (b) {
      b.classList.toggle('oculto', (b.getAttribute('data-aba-rodape') === 'varias') !== varias);
    });
    RW.painel.largo(varias);
  }
  function montarAbas() {
    var linha = RW.painel.linhaAbas();
    var abas = RW.tpl('tpl-troca-solicitar-abas');
    if (!linha || !abas) return;
    linha.textContent = '';
    linha.appendChild(abas);
    linha.classList.remove('oculto');
    if (RW.abas) RW.abas.ligar(abas, function (aba) { mostrarAba(aba.getAttribute('data-aba')); });
  }
  function montarRodape() {
    var rodape = RW.painel.rodape();
    Array.prototype.forEach.call(rodape.children, function (b) { b.setAttribute('data-aba-rodape', 'uma'); });
    var frag = document.getElementById(est.registrar ? 'tpl-troca-varias-registrar-acoes' : 'tpl-troca-varias-acoes').content.cloneNode(true);
    Array.prototype.forEach.call(frag.children, function (b) { b.setAttribute('data-aba-rodape', 'varias'); b.classList.add('oculto'); });
    frag.querySelector('[data-acao="cancelar"]').addEventListener('click', est.cancelar);
    var enviarBtn = frag.querySelector(est.registrar ? '[data-acao="registrar-varias"]' : '[data-acao="solicitar-varias"]');
    enviarBtn.addEventListener('click', function () { enviar(enviarBtn); });
    if (est.registrar) Reg().iniciar(est, enviarBtn);   // a Análise trava o Registrar trocas até chegar
    rodape.appendChild(frag);
  }

  /* ---------- o E-protocolo (as regras da Parte do pedido de uma troca) ---------- */
  function parteNumero() { var v = q('#tv-parte').value; return /^\d{1,7}$/.test(v) && Number(v) > 0 ? Number(v) : null; }
  function parteAno() { var v = q('#tv-parte-ano').value; return /^\d{4}$/.test(v) ? Number(v) : null; }
  function validarParte() {
    var digitada = q('#tv-parte').value.trim() !== '', ok = true;
    if (digitada && !parteNumero()) { C().marcarErro(q('#tv-parte'), RW.mensagens.trocas.novaParte); ok = false; }
    if (digitada && !parteAno()) { C().marcarErro(q('#tv-parte-ano'), RW.mensagens.trocas.novaAno); ok = false; }
    return ok;
  }

  /* ---------- os militares da troca ---------- */
  function militarDe(m, unidade) {
    return { cpf: m.cpf, nome: C().nomeMil(m), nomeGuerra: m.nome_de_guerra || '', unidade: unidade || '' };
  }
  function desenharMilitares() {
    var lista = q('#tv-militares');
    lista.textContent = '';
    est.militares.forEach(function (m, i) {
      var linha = RW.tpl('tpl-troca-varias-militar');
      linha.querySelector('.trocas-varias-militar-nome').textContent = m.nome;
      linha.querySelector('.trocas-varias-militar-lotacao').textContent = m.unidade;
      var remover = linha.querySelector('.trocas-varias-remover');
      /* no Solicitar, o primeiro é quem pede (fica sempre); no Registrar, todos podem sair */
      if (i === 0 && !est.registrar) { linha.querySelector('.trocas-varias-militar-voce').classList.remove('oculto'); remover.remove(); }
      else remover.addEventListener('click', function () { pedirRemover(m); });
      lista.appendChild(linha);
    });
  }
  function carregarMilitaresDaUnidade() {
    var combo = est.combo;
    if (!est.unidadeSel) return;
    combo.habilitar(false);
    combo.definir(RW.mensagens.trocas.modalCarregando, true);
    var unidade = est.unidadeSel;
    RW.trocasDados.militares(unidade.unidade_id, null, null, null).then(function (lista) {
      if (!est || est.unidadeSel !== unidade) return;
      combo.preencher(Array.isArray(lista) ? lista : []);
    }).catch(function () {
      if (!est || est.unidadeSel !== unidade) return;
      combo.habilitar(false);
      combo.definir(RW.mensagens.trocas.modalCarregarFalha, true);
    });
  }
  function adicionar() {
    if (!est.escolhido) return;
    est.militares.push(militarDe(est.escolhido, est.unidadeSel ? est.unidadeSel.nome : ''));
    est.escolhido = null;
    q('#tv-adicionar').disabled = true;
    desenharMilitares();
    carregarMilitaresDaUnidade();   // quem entrou sai da lista
    Cal().recarregar();
  }
  function remover(m) {
    est.militares = est.militares.filter(function (x) { return x.cpf !== m.cpf; });
    est.pares = est.pares.filter(function (p) { return p.trabalha !== m.cpf && p.folga !== m.cpf; });
    desenharMilitares();
    carregarMilitaresDaUnidade();
    Cal().recarregar();
    agendarResumo();
  }
  /* com dias marcados, pergunta antes: os dias dele saem junto */
  function pedirRemover(m) {
    var n = est.pares.filter(function (p) { return p.trabalha === m.cpf || p.folga === m.cpf; }).length;
    if (!n || !RW.confirmar) { remover(m); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: M().removerComDias(m.nome, n),
      textoConfirmar: RW.mensagens.botoes.remover, textoCancelar: RW.mensagens.botoes.cancelar,
      aoConfirmar: function () { remover(m); }
    });
  }
  function ligarAdicionar() {
    var lotacao = RW.sessao.perfil() ? RW.sessao.perfil().lotacao_id : null;
    est.combo = C().comboMilitar(q('#tv-militar'), q('#tv-militar-menu'), {
      atual: function () { return est.escolhido; },
      aoEscolher: function (mil) { est.escolhido = mil; q('#tv-adicionar').disabled = false; },
      aoPerder: function () { est.escolhido = null; q('#tv-adicionar').disabled = true; },
      ignorar: function () { return [RW.sessao.cpf()].concat(est.militares.map(function (m) { return m.cpf; })); }   // quem está logado (no Registrar, o admin não entra) e quem já está na troca
    });
    est.combo.habilitar(false);
    est.combo.definir(RW.mensagens.trocas.modalUnidadeAntes, true);
    q('#tv-adicionar').addEventListener('click', adicionar);
    var meu = est;
    C().carregarGrupo(lotacao).then(function (grupo) {
      if (est !== meu) return;
      var propria = C().preencherUnidades(q('#tv-unidade-menu'), q('#tv-unidade'), grupo, lotacao, function (u) {
        est.unidadeSel = u;
        carregarMilitaresDaUnidade();
      });
      if (propria) { est.unidadeSel = propria; carregarMilitaresDaUnidade(); }
    });
  }

  /* ---------- o resumo: o banco monta (duplas, rodas, sem devolução) e diz o saldo ---------- */
  function agendarResumo() {
    if (est.registrar) Reg().agendarAnalise();   // no Registrar, a Análise acompanha os dias
    if (timerResumo) clearTimeout(timerResumo);
    reqResumo++;
    var carregando = q('#tv-resumo-carregando');
    if (!est.pares.length) { desenharResumo(null); return; }
    limparResumo();
    carregando.textContent = '';
    carregando.appendChild(document.getElementById('carregando-pontos').content.cloneNode(true));
    carregando.classList.remove('oculto');
    timerResumo = setTimeout(montarResumo, 300);
  }
  function montarResumo() {
    var meu = ++reqResumo;
    RW.trocasDados.variasMontar(est.pares).then(function (r) {
      if (!est || meu !== reqResumo) return;
      desenharResumo(r);
    }).catch(function () {
      if (!est || meu !== reqResumo) return;
      desenharResumo(null);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().falhaResumo });
    });
  }
  function limparResumo() {
    ['#tv-duplas', '#tv-sem-devolucao'].forEach(function (s) { q(s).classList.add('oculto'); q(s + ' ol').textContent = ''; });
    q('#tv-rodas').textContent = '';
    q('#tv-notas').textContent = '';
    q('#tv-resumo-vazio').classList.add('oculto');
    q('#tv-resumo-carregando').classList.add('oculto');
  }
  function item(lista, texto) { var li = RW.tpl('tpl-troca-varias-item'); li.textContent = texto; lista.appendChild(li); }
  function nota(molde, texto) { var n = RW.tpl(molde); n.querySelector('.nota-texto').textContent = texto; q('#tv-notas').appendChild(n); }
  function desenharResumo(r) {
    limparResumo();
    if (!r || !est.pares.length) { q('#tv-resumo-vazio').classList.remove('oculto'); return; }
    var nome = function (cpf) { return (r.nomes && r.nomes[cpf]) || ''; };
    var dia = function (d) { return RW.data.isoParaBR(d.data); };
    var frase = function (d) { return M().cumpre(nome(d.trabalha), nome(d.folga), dia(d)); };
    (r.duplas || []).forEach(function (d) { item(q('#tv-duplas ol'), frase(d.servico) + M().devolucao(dia(d.devolucao))); });
    q('#tv-duplas').classList.toggle('oculto', !(r.duplas || []).length);
    (r.rodas || []).forEach(function (roda) {
      var g = RW.tpl('tpl-troca-varias-roda');
      roda.forEach(function (d) { item(g.querySelector('ol'), frase(d)); });
      q('#tv-rodas').appendChild(g);
    });
    (r.sem_devolucao || []).forEach(function (d) { item(q('#tv-sem-devolucao ol'), frase(d)); });
    q('#tv-sem-devolucao').classList.toggle('oculto', !(r.sem_devolucao || []).length);
    var saldos = r.saldos || [];
    if (!saldos.length) {
      var duplas = (r.duplas || []).length > 0, rodas = (r.rodas || []).length > 0;
      nota('tpl-troca-varias-nota-ok', duplas && rodas ? M().fechadoTudo : (rodas ? M().fechadoRodas : M().fechadoDuplas));
      return;
    }
    saldos.forEach(function (s) {
      var semDev = (r.sem_devolucao || []).some(function (d) { return d.folga === s.deve && d.trabalha === s.a; });
      var horas = RW.tempo.horas(s.minutos);
      nota('tpl-troca-varias-nota-saldo', semDev ? M().semDevolucao(nome(s.deve), horas, nome(s.a)) : M().saldo(nome(s.deve), horas, nome(s.a)));
    });
  }

  /* ---------- o envio: um registro só; o resumo do banco com o Desfazer (apaga o pedido inteiro) ---------- */
  function enviar(btn) {
    if (!validarParte()) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    if (!est.pares.length) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().semDias }); return; }
    var parte = parteNumero(), ano = parte ? parteAno() : null, aoSolicitar = est.aoSolicitar, aoMudar = est.aoMudar;
    if (est.registrar) { Reg().registrar(parte, ano); return; }   // confirma e grava já aprovado (trocas-varias-registrar.js)
    if (RW.iniciarCarregando) RW.iniciarCarregando(btn);
    RW.trocasDados.variasSolicitar(est.pares, parte, ano).then(function (r) {
      if (RW.pararCarregando) RW.pararCarregando(btn);
      if (!r || !r.ok) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (r && r.erro) || RW.mensagens.trocas.falhaAcao }); return; }
      RW.painel.fechar();
      if (aoSolicitar) aoSolicitar();
      if (!r.log || !RW.resumo) return;
      RW.resumo.abrirModal(r.log, {
        pagina: 'Trocas',
        desfazer: function () {
          return RW.trocasDados.variasCancelar(r.registro_id, true).then(function (res) {
            if (res && res.ok && aoMudar) aoMudar();
            return res;
          });
        }
      });
    }).catch(function () {
      if (RW.pararCarregando) RW.pararCarregando(btn);
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- montar, dados e encerrar ---------- */
  function montar(opcoes) {
    var raiz = RW.tpl('tpl-troca-varias');
    if (!raiz || !RW.painel.largo) return;
    raiz.classList.add('oculto');
    opcoes.corpo.appendChild(raiz);
    var u = RW.sessao.perfil(), registrar = !!opcoes.registrar;
    est = {
      raiz: raiz, corpo: opcoes.corpo, registrar: registrar, aoSolicitar: opcoes.aoSolicitar, aoMudar: opcoes.aoMudar, cancelar: opcoes.cancelar,
      /* no Solicitar, quem pede já entra; no Registrar, a lista começa vazia */
      militares: registrar ? [] : [militarDe({ cpf: RW.sessao.cpf(), grau_abreviacao: u && u.grau_abreviacao, nome_de_guerra: u && u.nome_de_guerra },
                                             (u && u.lotacao_path) ? u.lotacao_path.split(' / ').pop() : '')],
      pares: [], combo: null, unidadeSel: null, escolhido: null, mes: null
    };
    RW.trocasSolicitar.formulario.mostrarModo(raiz, registrar ? 'registrar' : 'solicitar');   // os textos de cada modo
    montarAbas();
    montarRodape();
    q('#tv-parte-ano').value = String(new Date().getFullYear());
    RW.trocasSolicitar.formulario.ligarSoNumeros(q('#tv-parte'));
    RW.trocasSolicitar.formulario.ligarSoNumeros(q('#tv-parte-ano'));
    RW.trocasSolicitar.formulario.ligarLimpezaErros(raiz);
    desenharMilitares();
    ligarAdicionar();
    Cal().iniciar(est, agendarResumo);
  }
  /* há algo preenchido na aba? (o X, o Esc, o Cancelar e o navegador pedem para descartar) */
  function temDados() {
    if (!est) return false;
    return est.pares.length > 0 || est.militares.length > (est.registrar ? 0 : 1) || !!(q('#tv-parte') && q('#tv-parte').value.trim());
  }
  function encerrar() {
    if (timerResumo) clearTimeout(timerResumo);
    reqResumo++;
    if (Cal()) Cal().encerrar();
    if (Reg()) Reg().encerrar();
    est = null;
  }

  RW.trocasVarias = { montar: montar, temDados: temDados, encerrar: encerrar };
})();
