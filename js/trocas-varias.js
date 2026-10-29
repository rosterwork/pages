/* ============================================================
   TROCAS — o formulário da troca (Solicitar troca e Registrar troca)
   O trocas-solicitar.js abre o painel e chama montar(). Aqui
   ficam o E-protocolo, os militares da troca (no Solicitar, o
   primeiro é quem pede; no Registrar, a lista começa vazia e o admin
   não entra), o rodapé e o envio do pedido (um registro só, com o
   Desfazer no resumo). O calendário é o trocas-varias-calendario.js;
   o resumo dia a dia, com o horário e o lápis, o
   trocas-varias-resumo.js; a Análise e a gravação do Registrar, o
   trocas-varias-registrar.js.
   No Cobrar, o devedor entra sozinho na lista quando aparece na
   unidade escolhida (o resumo põe as horas da dívida no dia dele).
   No Editar de um registro (trocas-varias-editar.js), o formulário
   abre com o plano que vale hoje (os militares, os dias com o
   horário e a Parte); o rodapé é do Editar, que recebe o pedido
   conferido.
   Expõe RosterWork.trocasVarias.{ montar, temDados, planoMudou, enviar, encerrar }
     montar({ corpo, registrar, cobrar, editar, aoSolicitar, aoMudar, cancelar })
       cobrar = { cpf, minutos }
       editar = { registroId, plano, admin, botao, alteracao, aoEnviar(pares, parte, ano, botao) }
   ============================================================ */
(function () {
  'use strict';
  var RW = window.RosterWork = window.RosterWork || {};

  var est = null;          // o estado do formulário aberto

  function C() { return RW.trocasCampos; }
  function M() { return RW.mensagens.trocas.varias; }
  function Cal() { return RW.trocasVariasCalendario; }
  function Res() { return RW.trocasVariasResumo; }
  function Reg() { return RW.trocasVariasRegistrar; }
  function q(sel) { return est && est.raiz ? est.raiz.querySelector(sel) : null; }

  /* ---------- o rodapé: Cancelar e Solicitar troca (ou Registrar troca) ---------- */
  function montarRodape() {
    var rodape = RW.painel.rodape();
    rodape.textContent = '';
    var frag = document.getElementById(est.registrar ? 'tpl-troca-varias-registrar-acoes' : 'tpl-troca-varias-acoes').content.cloneNode(true);
    frag.querySelector('[data-acao="cancelar"]').addEventListener('click', est.cancelar);
    var enviarBtn = frag.querySelector(est.registrar ? '[data-acao="registrar-varias"]' : '[data-acao="solicitar-varias"]');
    enviarBtn.addEventListener('click', function () { enviar(enviarBtn); });
    if (est.registrar) Reg().iniciar(est, enviarBtn);   // a Análise trava o Registrar troca até chegar
    rodape.appendChild(frag);
    rodape.classList.remove('oculto');
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
  /* no Editar, quem tem dia que já passou fica (o dia não muda) */
  function temDiaTravado(cpf) {
    return est.pares.some(function (p) { return (p.trabalha === cpf || p.folga === cpf) && Cal().travado(p.data); });
  }
  function desenharMilitares() {
    var lista = q('#tv-militares'), eu = RW.sessao.cpf();
    lista.textContent = '';
    est.militares.forEach(function (m, i) {
      var linha = RW.tpl('tpl-troca-varias-militar');
      linha.querySelector('.trocas-varias-militar-nome').textContent = m.nome;
      linha.querySelector('.trocas-varias-militar-lotacao').textContent = m.unidade;
      var remover = linha.querySelector('.trocas-varias-remover');
      /* "· você" e sem Remover: no Solicitar, o primeiro (quem pede); no Editar, o militar que edita.
         No Registrar, todos podem sair; no Editar, todos menos quem tem dia que já passou */
      var voce = est.editar ? m.cpf === eu : (i === 0 && !est.registrar);
      if (voce) linha.querySelector('.trocas-varias-militar-voce').classList.remove('oculto');
      if (voce || temDiaTravado(m.cpf)) remover.remove();
      else remover.addEventListener('click', function () { pedirRemover(m); });
      lista.appendChild(linha);
    });
  }
  /* a lista da unidade vem do banco uma vez por unidade e fica guardada */
  function carregarMilitaresDaUnidade() {
    var combo = est.combo;
    if (!est.unidadeSel) return;
    est.listaUnidade = null;
    combo.habilitar(false);
    combo.definir(RW.mensagens.trocas.modalCarregando, true);
    var unidade = est.unidadeSel;
    RW.trocasDados.militares(unidade.unidade_id, null, null, null).then(function (lista) {
      if (!est || est.unidadeSel !== unidade) return;
      est.listaUnidade = Array.isArray(lista) ? lista : [];
      combo.preencher(est.listaUnidade);
      entrarDevedor();
    }).catch(function () {
      if (!est || est.unidadeSel !== unidade) return;
      combo.habilitar(false);
      combo.definir(RW.mensagens.trocas.modalCarregarFalha, true);
    });
  }
  /* cobrança: o devedor entra sozinho assim que aparece na unidade escolhida (uma vez só) */
  function entrarDevedor() {
    if (!est.cobrar || est.cobrar.entrou) return;
    var devedor = est.listaUnidade.filter(function (m) { return m && m.cpf === est.cobrar.cpf; })[0];
    if (!devedor) return;
    est.cobrar.entrou = true;
    adicionar(devedor);
  }
  /* refaz o campo com a lista guardada, sem ir ao banco: quem está na troca fica de fora */
  function atualizarMilitaresDaUnidade() { if (est.listaUnidade) est.combo.preencher(est.listaUnidade); }
  /* escolher já adiciona: o campo volta para "Selecione", pronto para o próximo */
  function adicionar(mil) {
    var novo = militarDe(mil, est.unidadeSel ? est.unidadeSel.nome : '');
    est.militares.push(novo);
    desenharMilitares();
    atualizarMilitaresDaUnidade();   // quem entrou sai da lista
    q('#tv-anuncio').textContent = M().entrou(novo.nome);
    if (!(RW.celular && RW.celular())) q('#tv-militar').focus();   // no computador o cursor fica no campo; no celular a lista só fecha
    Cal().recarregar();
  }
  function remover(m) {
    est.militares = est.militares.filter(function (x) { return x.cpf !== m.cpf; });
    est.pares = est.pares.filter(function (p) { return p.trabalha !== m.cpf && p.folga !== m.cpf; });
    desenharMilitares();
    atualizarMilitaresDaUnidade();
    Cal().recarregar();
    Res().agendar();
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
      atual: function () { return null; },   // nada fica escolhido no campo: quem é escolhido entra na troca
      aoEscolher: adicionar,
      ignorar: function () { return [RW.sessao.cpf()].concat(est.militares.map(function (m) { return m.cpf; })); }   // quem está logado (no Registrar, o admin não entra) e quem já está na troca
    });
    est.combo.habilitar(false);
    est.combo.definir(RW.mensagens.trocas.modalUnidadeAntes, true);
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

  /* ---------- o envio: um registro só; o resumo do banco com o Desfazer (apaga o pedido inteiro) ---------- */
  function enviar(btn) {
    if (!validarParte()) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.camposCorrigir }); return; }
    if (!est.pares.length) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: M().semDias }); return; }
    var parte = parteNumero(), ano = parte ? parteAno() : null, aoSolicitar = est.aoSolicitar, aoMudar = est.aoMudar;
    if (est.registrar) { Reg().registrar(parte, ano); return; }   // confirma e grava já aprovado (trocas-varias-registrar.js)
    if (est.editar) { est.editar.aoEnviar(est.pares.slice(), parte, ano, btn); return; }   // o Editar grava (trocas-varias-editar.js)
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

  /* ---------- o Editar: o plano que vale hoje e o que mudou desde que abriu ---------- */
  function eu() {
    var u = RW.sessao.perfil();
    return militarDe({ cpf: RW.sessao.cpf(), grau_abreviacao: u && u.grau_abreviacao, nome_de_guerra: u && u.nome_de_guerra },
                     (u && u.lotacao_path) ? u.lotacao_path.split(' / ').pop() : '');
  }
  /* os militares do plano; o militar que edita vem primeiro (e entra, se saiu dos dias) */
  function militaresDoPlano(plano) {
    var lista = (plano.militares || []).map(function (m) { return militarDe(m, m.unidade); });
    if (!plano.participa) return lista;
    var meu = RW.sessao.cpf();
    var outros = lista.filter(function (m) { return m.cpf !== meu; });
    return [lista.filter(function (m) { return m.cpf === meu; })[0] || eu()].concat(outros);
  }
  /* cada dia com o horário (vazio = o serviço inteiro): mudar só o horário também é mudar o plano */
  function chavePares() {
    return est.pares.map(function (p) { return [p.data, p.trabalha, p.folga, p.inicio || '', p.fim || ''].join('|'); }).sort().join(',');
  }
  function chaveParte() { var n = q('#tv-parte').value.trim(); return n ? n + '/' + q('#tv-parte-ano').value.trim() : ''; }
  function chaveMilitares() { return est.militares.map(function (m) { return m.cpf; }).sort().join(','); }
  function chaveTudo() { return chavePares() + '#' + chaveParte() + '#' + chaveMilitares(); }
  /* os dias mudaram desde que o Editar abriu (só aí a escala muda e a Análise faz sentido) */
  function planoMudou() { return !!est && !!est.editar && chavePares() !== est.editar.paresAntes; }

  /* ---------- montar, dados e encerrar ---------- */
  function montar(opcoes) {
    var raiz = RW.tpl('tpl-troca-varias');
    if (!raiz) return;
    var registrar = !!opcoes.registrar, ed = opcoes.editar || null;
    opcoes.corpo.appendChild(raiz);
    var plano = ed ? ed.plano : null;
    est = {
      raiz: raiz, corpo: opcoes.corpo, registrar: registrar, aoSolicitar: opcoes.aoSolicitar, aoMudar: opcoes.aoMudar, cancelar: opcoes.cancelar,
      /* no Solicitar, quem pede já entra; no Registrar, a lista começa vazia; no Editar, o plano de hoje */
      militares: plano ? militaresDoPlano(plano) : (registrar ? [] : [eu()]),
      pares: plano ? (plano.dias || []).map(function (d) {
        return { data: String(d.data).slice(0, 10), trabalha: d.trabalha, folga: d.folga, inicio: d.inicio || null, fim: d.fim || null };
      }) : [],
      combo: null, unidadeSel: null, listaUnidade: null, mes: null, ensaio: null,
      cobrar: opcoes.cobrar ? { cpf: opcoes.cobrar.cpf, minutos: opcoes.cobrar.minutos || 0, entrou: false, aplicada: false } : null,
      editar: ed ? { registroId: ed.registroId, admin: !!ed.admin, aoEnviar: ed.aoEnviar, desde: String(plano.editavel_desde).slice(0, 10) } : null
    };
    /* a Análise (ensaio no banco): no Registrar, do registro novo; no Editar do administrador de fora, da alteração */
    if (registrar) est.ensaio = function () { return RW.trocasDados.variasRegistrar(est.pares, null, null, true); };
    else if (ed && ed.admin) est.ensaio = function () { return RW.trocasDados.variasEditar(ed.registroId, est.pares, null, null, true); };
    RW.trocasSolicitar.formulario.mostrarModo(raiz, ed ? 'editar' : (registrar ? 'registrar' : 'solicitar'));   // os textos de cada modo
    if (ed) {
      q('#tv-nota-alteracao').classList.toggle('oculto', !ed.alteracao);
      if (est.ensaio) Reg().iniciar(est, ed.botao);   // a Análise trava o Salvar até chegar
    } else {
      montarRodape();
    }
    q('#tv-parte').value = plano && plano.parte ? String(plano.parte.numero) : '';
    q('#tv-parte-ano').value = String(plano && plano.parte ? plano.parte.ano : new Date().getFullYear());
    RW.trocasSolicitar.formulario.ligarSoNumeros(q('#tv-parte'));
    RW.trocasSolicitar.formulario.ligarSoNumeros(q('#tv-parte-ano'));
    RW.trocasSolicitar.formulario.ligarLimpezaErros(raiz);
    if (est.editar) { est.editar.paresAntes = chavePares(); est.editar.tudoAntes = chaveTudo(); }
    Res().iniciar(est);
    Cal().iniciar(est, Res().agendar);   // antes dos militares: o calendário diz qual dia já passou
    desenharMilitares();
    ligarAdicionar();
    if (est.editar) Res().agendar();   // o resumo do plano de hoje
  }
  /* há algo preenchido? (o X, o Esc, o Cancelar e o navegador pedem para descartar); no Editar, algo mudou */
  function temDados() {
    if (!est) return false;
    if (est.editar) return chaveTudo() !== est.editar.tudoAntes;
    return est.pares.length > 0 || est.militares.length > (est.registrar ? 0 : 1) || !!(q('#tv-parte') && q('#tv-parte').value.trim());
  }
  function encerrar() {
    if (Res()) Res().encerrar();
    if (Cal()) Cal().encerrar();
    if (Reg()) Reg().encerrar();
    est = null;
  }

  RW.trocasVarias = { montar: montar, temDados: temDados, planoMudou: planoMudou, enviar: enviar, encerrar: encerrar };
})();
