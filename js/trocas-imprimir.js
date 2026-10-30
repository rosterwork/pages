/* ============================================================
   TROCAS — Imprimir trocas (o botão Imprimir da barra → painel)
   O painel de impressão comum (componentes/js/geral-impressao.js),
   com três caixas: 1. as trocas do mês (as do militar e, para o
   administrador, também as da área dele; todas já marcadas), 2. o
   texto para a Parte (Informo, no passado, ou Solicito, no futuro),
   pronto para copiar, e 3. o Formato do PDF (Lista, Registro técnico
   ou Alterações, que vale para todas as trocas do mês:
   trocas-imprimir-alteracoes.js). A nota, a prévia e o Gerar PDF são
   do painel comum. Os registros das marcadas vêm do banco
   (fn_trocas_impressao), que confere troca a troca quem pode ver;
   são buscados uma vez por escolha e servem ao texto, à prévia e ao
   Gerar PDF. RosterWork.trocasImprimir.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  /* o mês na data da Parte: três letras com ponto; maio não abrevia */
  var MESES_PARTE = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var LETRAS = 'abcdefghijklmnopqrstuvwxyz';
  var SITUACOES = ['pendente_confirmacao', 'pendente_aprovacao', 'aprovada'];   // as trocas que entram na lista
  var ESPERA = 300;               // ms sem mexer antes de buscar os registros e escrever o texto
  var LINHAS_TEXTO = { minimo: 4, maximo: 16 };   // a caixa do texto cresce com ele até o máximo (depois rola)

  var form = null;          // o painel aberto: escolhas, dados e peças
  var token = 0;            // latest-wins do texto
  var espera = null;

  function msg() { return RW.mensagens.trocas.imprimir; }
  function fmt() { return RW.trocasFormato; }
  function doisDig(n) { return n < 10 ? '0' + n : '' + n; }
  function hora(t) { return String(t || '08:00').slice(0, 5); }

  function unidades() {
    try { var p = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); return p && Array.isArray(p.unidades_selecionadas) ? p.unidades_selecionadas : []; } catch (e) { return []; }
  }

  /* ---------- os registros ---------- */
  /* os registros das marcadas, buscados uma vez por escolha (o texto, a prévia e o Gerar PDF usam os mesmos); um
     registro com várias trocas vem uma vez por troca: fica uma vez só. O que falhou é buscado de novo */
  function registros(ids) {
    var chave = ids.join(',');
    if (form.registros && form.registros.chave === chave) return form.registros.promessa;
    var ref = form;
    var pedido = ids.length ? RW.rpc('fn_trocas_impressao', { p_troca_ids: ids }) : Promise.resolve({ ok: true, registros: [], militares: [] });
    var promessa = pedido.then(function (r) {
      if (!r || !r.ok) throw new Error('impressao');
      var vistos = {};
      return {
        registros: (r.registros || []).filter(function (x) {
          var numero = x.registro.numero + '/' + x.registro.ano;
          if (vistos[numero]) return false;
          vistos[numero] = true;
          return true;
        }),
        militares: r.militares || []
      };
    });
    ref.registros = { chave: chave, promessa: promessa };
    promessa.catch(function () { if (ref.registros && ref.registros.promessa === promessa) ref.registros = null; });
    return promessa;
  }

  /* ---------- o texto para a Parte ---------- */
  /* "2026-10-03" → "3 out. 26" */
  function diaDaParte(iso) {
    var p = String(iso).split('-');
    return Number(p[2]) + ' ' + MESES_PARTE[Number(p[1]) - 1] + ' ' + p[0].slice(2);
  }

  /* a., b., ... z., aa., ab. */
  function letra(i) { return (i < LETRAS.length ? '' : LETRAS[Math.floor(i / LETRAS.length) - 1]) + LETRAS[i % LETRAS.length]; }

  /* "A", "A e B", "A, B e C" */
  function juntar(lista) {
    if (lista.length < 2) return lista.join('');
    return lista.slice(0, -1).join(', ') + msg().parte.e + lista[lista.length - 1];
  }

  /* uma linha por dia de serviço (o serviço e a devolução de cada troca), em ordem de data */
  function itensDosRegistros(dados) {
    var itens = [];
    dados.registros.forEach(function (r) { itens = itens.concat(r.itens || []); });
    return itens.sort(function (a, b) {
      return String(a.data).localeCompare(String(b.data)) || hora(a.inicio).localeCompare(hora(b.inicio));
    });
  }

  /* o corpo da Parte: uma linha só vira frase corrida; mais de uma, subitens "a." que terminam em ";" e o último em "." */
  function textoDaParte(dados) {
    var p = msg().parte, tipo = form.texto;
    var frases = itensDosRegistros(dados).map(function (it) {
      var inteiro = hora(it.inicio) === '08:00' && hora(it.fim) === '08:00';
      return p.linha(it.cumpre, p.verbo[tipo], it.no_lugar_de, diaDaParte(it.data),
        inteiro ? '' : p.periodo(RW.horario.curta(hora(it.inicio)), RW.horario.curta(hora(it.fim))));
    });
    if (!frases.length) return '';
    if (frases.length === 1) return tipo === 'informo' ? p.informoUma(frases[0]) : p.solicitoUma(frases[0]);
    var abertura = tipo === 'informo' ? p.informoAbertura(juntar(dados.militares)) : p.solicitoAbertura(dados.registros.length === 1);
    return [abertura].concat(frases.map(function (f, i) { return letra(i) + '. ' + f + (i === frases.length - 1 ? '.' : ';'); })).join('\n');
  }

  function escreverTexto(dados) {
    var caixa = form.caixaTexto;
    caixa.value = dados ? textoDaParte(dados) : '';
    caixa.rows = LINHAS_TEXTO.minimo;
    while (caixa.rows < LINHAS_TEXTO.maximo && caixa.scrollHeight > caixa.clientHeight) caixa.rows++;
  }

  /* busca os registros das marcadas depois da pausa e escreve o texto; a última pedida vale (a falha deixa o texto vazio) */
  function agendarTexto(pausa) {
    var meu = ++token, ref = form;
    clearTimeout(espera);
    espera = setTimeout(function () {
      if (form !== ref || meu !== token) return;
      registros(idsMarcados()).then(function (dados) {
        if (form === ref && meu === token) escreverTexto(dados);
      }, function () {
        if (form === ref && meu === token) escreverTexto(null);
      });
    }, pausa);
  }

  function copiar() {
    var area = form.caixaTexto, botao = form.copiar;
    function falhou() {
      area.select();
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().falhaCopiar });
    }
    if (!area.value) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().nenhumaMarcada }); return; }
    if (!navigator.clipboard || !navigator.clipboard.writeText) { falhou(); return; }
    navigator.clipboard.writeText(area.value).then(function () {
      botao.textContent = msg().textoCopiado;
      setTimeout(function () { botao.textContent = msg().copiarTexto; }, 2000);
    }).catch(falhou);
  }

  /* ---------- a lista do mês ---------- */
  /* as do mês, nas situações que entram, que a pessoa troca ou administra; em ordem de data */
  function trocasDoMes() {
    var cpf = RW.sessao.cpf();
    var mes = form.mes.getFullYear() + '-' + doisDig(form.mes.getMonth() + 1);
    return form.todas.filter(function (t) {
      if (SITUACOES.indexOf(t.status) < 0 || String(t.data_servico_solicitante).slice(0, 7) !== mes) return false;
      return t.solicitante_cpf === cpf || t.parceiro_cpf === cpf || RW.trocasFormato.daMinhaArea(t);
    }).sort(function (a, b) {
      return String(a.data_servico_solicitante).localeCompare(String(b.data_servico_solicitante)) || hora(a.horario_inicio).localeCompare(hora(b.horario_inicio));
    });
  }

  function marcarCaixa(botao, sim) {
    botao.setAttribute('aria-checked', sim ? 'true' : 'false');
    botao.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', sim);
  }

  function montarItem(t) {
    var item = RW.tpl('tpl-troca-imprimir-item');
    if (!item) return null;
    item.querySelector('.troca-item-a').textContent = fmt().nomeMilitar(t.solicitante_grau, t.solicitante_nome);
    item.querySelector('.troca-item-b').textContent = fmt().nomeMilitar(t.parceiro_grau, t.parceiro_nome);
    item.querySelector('.troca-item-meta').textContent = fmt().metaLista(t);
    var info = fmt().situacao(t.status, !!t.substitui_troca_id);
    var selo = item.querySelector('.troca-item-situacao');
    selo.textContent = info.texto;
    selo.classList.add(info.classe);
    item.addEventListener('click', function () {
      form.marcadas[t.troca_id] = !form.marcadas[t.troca_id];
      marcarCaixa(item, form.marcadas[t.troca_id]);
      contar();
      mudou();
    });
    return item;
  }

  /* a contagem e o "Marcar todas" (marcado quando todas estão) */
  function contar() {
    var ids = idsMarcados();
    form.contagem.textContent = msg().contagem(ids.length, form.doMes.length);
    marcarCaixa(form.todasBotao, ids.length === form.doMes.length);
  }

  function idsMarcados() { return form.doMes.filter(function (t) { return form.marcadas[t.troca_id]; }).map(function (t) { return t.troca_id; }); }

  function mostrarNaLista(molde, texto, pontos) {
    form.lista.textContent = '';
    var el = RW.tpl(molde);
    if (!el) return;
    if (texto) el.textContent = texto;
    var pts = pontos && document.getElementById('carregando-pontos');
    if (pts) el.appendChild(pts.content.cloneNode(true));
    form.lista.appendChild(el);
  }

  /* o mês da tela: todas já marcadas */
  function montarMes() {
    form.nomeMes.textContent = msg().mes(MESES[form.mes.getMonth()], form.mes.getFullYear());
    form.doMes = trocasDoMes();
    form.marcadas = {};
    form.doMes.forEach(function (t) { form.marcadas[t.troca_id] = true; });
    form.todasBotao.classList.toggle('oculto', !form.doMes.length);
    form.contagem.classList.toggle('oculto', !form.doMes.length);
    if (!form.doMes.length) mostrarNaLista('tpl-troca-vazio', msg().vazio);
    else {
      form.lista.textContent = '';
      form.doMes.forEach(function (t) { var el = montarItem(t); if (el) form.lista.appendChild(el); });
    }
    contar();
    mudou();
  }

  function andarMes(n) {
    if (!form.todas) return;
    form.mes = new Date(form.mes.getFullYear(), form.mes.getMonth() + n, 1);
    montarMes();
  }

  /* as marcadas mudaram: o texto (depois da pausa) e o painel (a nota e a prévia) */
  function mudou() {
    agendarTexto(ESPERA);
    form.atualizar();
  }

  /* ---------- o que sai ---------- */
  /* o PDF das marcadas no formato da Lista ou do Registro técnico: { arquivo, nome } */
  function arquivoDasMarcadas(formato, regs, mes, ano, nomeMes) {
    if (!regs.length) return Promise.reject({ mensagem: msg().nenhumaMarcada });
    if (formato === 'lista') {
      return RW.trocasRelatorioPdf.arquivo(regs, nomeMes).then(function (arq) { return { arquivo: arq, nome: msg().pdf.arquivo(mes, ano) }; });
    }
    var t = RW.mensagens.trocas.registroPdf;
    return RW.trocasRegistroPdf.arquivo(regs).then(function (arq) {
      return { arquivo: arq, nome: regs.length === 1 ? t.arquivo(regs[0].registro.numero, regs[0].registro.ano) : t.arquivoVarios(mes, ano) };
    });
  }

  /* o estado para o painel comum: sem troca marcada, o aviso (também no Gerar PDF), salvo nas Alterações, que valem para
     todas as trocas do mês; senão a nota, a chave do arquivo e como montá-lo, com as folhas */
  function estado() {
    if (form.falhou) return { erro: msg().falhaLista, avisar: true };
    var alteracoes = form.formato === 'alteracoes';
    var ids = idsMarcados();
    if (!form.todas || (!alteracoes && !ids.length)) return { erro: msg().nenhumaMarcada, avisar: true };
    var formato = form.formato, todas = form.todas, data = form.mes, nomeMes = form.nomeMes.textContent;
    var mes = doisDig(data.getMonth() + 1), ano = data.getFullYear(), nome = MESES[data.getMonth()];
    return {
      resumo: alteracoes ? msg().resumo.alteracoes(nome, ano) : msg().resumo[formato](nome, ano, ids.length),
      chave: formato + '|' + (alteracoes ? ano + '-' + mes : ids.join(',')),
      montar: function () {
        var pedido = alteracoes ? RW.trocasImprimirAlteracoes.arquivo(todas, data, nomeMes)
          : registros(ids).then(function (dados) { return arquivoDasMarcadas(formato, dados.registros, mes, ano, nomeMes); });
        return pedido.then(function (r) {
          return RW.impressao.contarFolhas(r.arquivo).then(function (n) {
            return { arquivo: r.arquivo, nome: r.nome, folhas: RW.mensagens.impressao.folhas(n, false, false) };
          });
        }, function (e) {
          throw e && e.semAlteracoes ? { mensagem: msg().semAlteracoes } : e;
        });
      }
    };
  }

  /* ---------- abrir ---------- */
  function fecharLimpo() {
    token++;
    clearTimeout(espera);
    if (RW.impressao) RW.impressao.esquecer();
    if (RW.trocasImprimirAlteracoes) RW.trocasImprimirAlteracoes.limpar();
    form = null;
  }

  /* as peças das três caixas e o que cada uma faz */
  function ligar(corpo, atualizar) {
    function peca(nome) { return corpo.querySelector('[data-imprimir-' + nome + ']'); }
    form.atualizar = atualizar;
    form.nomeMes = peca('mes');
    form.todasBotao = peca('todas');
    form.lista = peca('lista');
    form.contagem = peca('contagem');
    form.ajudaTexto = peca('texto-ajuda');
    form.caixaTexto = peca('texto-caixa');
    form.copiar = peca('copiar');
    form.ajudaFormato = peca('formato-ajuda');
    form.nomeMes.textContent = msg().mes(MESES[form.mes.getMonth()], form.mes.getFullYear());
    form.ajudaTexto.textContent = msg().ajudaTexto.informo;
    form.ajudaFormato.textContent = msg().ajudaFormato.lista;
    form.todasBotao.classList.add('oculto');
    form.contagem.classList.add('oculto');

    peca('mes-anterior').addEventListener('click', function () { andarMes(-1); });
    peca('mes-proximo').addEventListener('click', function () { andarMes(1); });
    form.todasBotao.addEventListener('click', function () {
      var todas = idsMarcados().length !== form.doMes.length;
      form.doMes.forEach(function (t) { form.marcadas[t.troca_id] = todas; });
      Array.prototype.forEach.call(form.lista.querySelectorAll('[role="checkbox"]'), function (item) { marcarCaixa(item, todas); });
      contar();
      mudou();
    });
    RW.abas.ligar(peca('texto'), function (aba) {
      form.texto = aba.getAttribute('data-texto');
      form.ajudaTexto.textContent = msg().ajudaTexto[form.texto];
      if (form.todas) agendarTexto(0);
    });
    form.copiar.addEventListener('click', copiar);
    /* o formato não busca de novo (os registros são os mesmos) */
    RW.abas.ligar(peca('formato'), function (aba) {
      form.formato = aba.getAttribute('data-formato');
      form.ajudaFormato.textContent = msg().ajudaFormato[form.formato];
      if (form.todas) form.atualizar();
    });
  }

  function abrir() {
    if (!RW.painel || !RW.impressao) return;
    fecharLimpo();
    RW.painel.abrir({ titulo: msg().titulo, subtitulo: msg().subtitulo, aoFechar: fecharLimpo });
    var corpo = RW.painel.corpo();
    if (!corpo) return;
    var hoje = new Date();
    /* as escolhas (mês, marcadas, texto, formato) e os dados */
    form = {
      mes: new Date(hoje.getFullYear(), hoje.getMonth(), 1), texto: 'informo', formato: 'lista',
      todas: null, falhou: false, doMes: [], marcadas: {}, registros: null, atualizar: null
    };
    RW.impressao.montar(corpo, RW.painel.rodape(), {
      molde: 'tpl-troca-imprimir',
      aoSair: function () { RW.painel.fechar(); },
      ligar: function (peca, atualizar) { ligar(corpo, atualizar); },
      estado: estado
    });
    if (!form.lista) return;

    /* as trocas das unidades da tela, uma vez; o mês filtra aqui */
    var ref = form;
    mostrarNaLista('tpl-troca-vazio', '', true);
    RW.trocasDados.listar(unidades()).then(function (todas) {
      if (form !== ref) return;
      if (!Array.isArray(todas)) throw new Error('lista');
      form.todas = todas;
      montarMes();
    }).catch(function () {
      if (form !== ref) return;
      form.falhou = true;
      mostrarNaLista('tpl-troca-vazio', msg().falhaLista);
      form.atualizar();
    });
  }

  RW.trocasImprimir = { abrir: abrir };
})();
