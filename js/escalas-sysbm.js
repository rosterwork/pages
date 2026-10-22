/* ============================================================
   ESCALAS — Enviar para o SYSBM (painel)
   O botão do grupo Administração abre o painel direito "Enviar
   para o SYSBM": o dia (já com o dia exibido), uma linha por
   pelotão que a pessoa administra e o favorito. Cada linha lê no
   banco a escala do pelotão já convertida nas linhas do SYSBM
   (escala_sysbm) e mostra o resumo e quem fica de fora; Copiar
   leva essa escala à área de transferência, e o favorito
   "Preencher no SYSBM" (escalas-sysbm-favorito.js) cola lá.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ESPERA_DATA = 400;      // ms sem mexer na data antes de ler de novo
  var TEMPO_COPIADO = 2000;   // ms com o "Copiado" no botão

  var form = null;            // { raiz, data, lista, vazio, linhas: [{ pelotao, el, resumo, avisos, copiar, dados }] }
  var tokenLeitura = 0;       // latest-wins da leitura dos pelotões
  var esperaData = null;

  function msg() { return (RW.mensagens.escala && RW.mensagens.escala.sysbm) || {}; }

  /* ---------- o favorito ---------- */
  /* o código do favorito: carrega o preenchedor deste site na página aberta (o SYSBM) */
  function codigoFavorito() {
    var endereco = new URL('js/escalas-sysbm-favorito.js', document.baseURI).href;
    return "javascript:(function(){var s=document.createElement('script');s.src='" + endereco
      + "?'+Date.now();document.body.appendChild(s);})();";
  }

  /* texto do botão por um instante ("Copiado"), depois o de sempre */
  function trocarTexto(botao, texto, deVolta) {
    botao.textContent = texto;
    setTimeout(function () { if (botao.isConnected) botao.textContent = deVolta; }, TEMPO_COPIADO);
  }

  function copiarTexto(texto) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.reject(new Error('sem área de transferência'));
    return navigator.clipboard.writeText(texto);
  }

  function copiarCodigo(botao) {
    copiarTexto(codigoFavorito()).then(function () {
      trocarTexto(botao, msg().codigoCopiado, msg().copiarCodigo);
    }).catch(function () {
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().falhaCopiar });
    });
  }

  /* ---------- cada pelotão ---------- */
  function mostrarAvisos(linha, avisos) {
    var m = msg();
    linha.avisos.textContent = '';
    if (!avisos) return;
    var textos = [];
    if ((avisos.sem_rg || []).length) textos.push(m.semRg(m.juntar(avisos.sem_rg)));
    if ((avisos.sem_par || []).length) {
      textos.push(m.semPar(m.juntar(avisos.sem_par.map(function (a) { return m.comFuncao(a.militar, a.funcao); }))));
    }
    if ((avisos.fora || []).length) textos.push(m.fora(m.juntar(avisos.fora)));
    if ((avisos.sem_funcao || []).length) textos.push(m.semFuncao(m.juntar(avisos.sem_funcao)));
    textos.forEach(function (texto) {
      var aviso = RW.tpl('tpl-escala-sysbm-aviso');
      if (!aviso) return;
      aviso.textContent = texto;
      linha.avisos.appendChild(aviso);
    });
  }

  /* o resultado da leitura na linha: o resumo, os avisos e o Copiar (que some sem escala) */
  function mostrarLinha(linha, r) {
    var m = msg();
    linha.dados = (r && r.ok) ? r : null;
    if (!r) {
      linha.resumo.textContent = m.falhaLer;
    } else if (!r.ok) {
      linha.resumo.textContent = r.erro || m.falhaLer;
    } else {
      linha.resumo.textContent = r.linhas.length ? m.resumo(r.linhas.length) : m.semEscala;
    }
    mostrarAvisos(linha, r && r.ok ? r.avisos : null);
    linha.copiar.classList.toggle('oculto', !!(r && r.ok && !r.linhas.length));
  }

  /* esvazia as linhas (o dia mudou): o Copiar nunca leva a escala de outro dia */
  function limparLinhas() {
    form.linhas.forEach(function (linha) {
      linha.dados = null;
      linha.resumo.textContent = '';
      linha.avisos.textContent = '';
      linha.copiar.classList.remove('oculto');
    });
  }

  /* cada linha guarda o número do último pedido: só a resposta dele tira os pontinhos (cada
     iniciarCarregando tem o seu pararCarregando, senão a tela fica travada) e, se ainda vale, mostra */
  function lerLinha(linha, iso, token) {
    var pedido = ++linha.pedido;
    if (!linha.carregando) {
      linha.carregando = true;
      if (RW.iniciarCarregando) RW.iniciarCarregando(linha.copiar);
    }
    RW.escalasDados.lerSysbm(linha.pelotao.id, iso).then(function (r) {
      if (pedido !== linha.pedido) return;
      linha.carregando = false;
      if (RW.pararCarregando) RW.pararCarregando(linha.copiar);
      if (token === tokenLeitura && form) mostrarLinha(linha, r);
    });
  }

  /* lê todos os pelotões no dia do campo (a última leitura pedida vale) */
  function lerTodos() {
    if (!form) return;
    var token = ++tokenLeitura;
    limparLinhas();
    var data = RW.data.paraData(form.data.value);
    if (!data) {
      if (RW.campos) RW.campos.marcarErro(form.data, msg().dataInvalida);
      return;
    }
    var iso = RW.data.paraIsoDeData(data);
    form.linhas.forEach(function (linha) { lerLinha(linha, iso, token); });
  }

  /* Copiar: a escala do pelotão para a área de transferência, no formato que o favorito lê
     ({data, unidade, funcoes_roster, linhas}); a linha que falhou lê de novo */
  function copiar(linha) {
    if (!linha.dados) { lerTodos(); return; }
    var d = linha.dados;
    var texto = JSON.stringify({ data: d.data, unidade: d.unidade, funcoes_roster: d.funcoes_roster, linhas: d.linhas });
    copiarTexto(texto).then(function () {
      trocarTexto(linha.copiar, msg().copiado, msg().copiar);
    }).catch(function () {
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: msg().falhaCopiar });
    });
  }

  function montarLinhas(pelotoes) {
    var m = msg();
    form.linhas = [];
    pelotoes.forEach(function (p) {
      var el = RW.tpl('tpl-escala-sysbm-linha');
      if (!el) return;
      var linha = {
        pelotao: p,
        el: el,
        resumo: el.querySelector('.escala-sysbm-resumo'),
        avisos: el.querySelector('.escala-sysbm-avisos'),
        copiar: el.querySelector('[data-sysbm-copiar]'),
        dados: null,
        pedido: 0,
        carregando: false
      };
      el.querySelector('.escala-sysbm-cidade').textContent = m.nomeLinha(p.cidade, p.nome);
      linha.copiar.addEventListener('click', function () { copiar(linha); });
      form.lista.appendChild(el);
      form.linhas.push(linha);
    });
    form.vazio.classList.toggle('oculto', form.linhas.length > 0);
  }

  /* ---------- abrir ---------- */
  /* opcoes: { data } = o dia que a escala mostra; { pelotoes: [{id, nome, cidade}] } = os da Escala que a pessoa administra */
  function abrir(opcoes) {
    if (!RW.painel) return;
    var m = msg();
    RW.painel.abrir({ titulo: m.titulo, subtitulo: m.subtitulo, aoFechar: function () { form = null; tokenLeitura++; clearTimeout(esperaData); } });
    var corpo = RW.painel.corpo();
    var molde = document.getElementById('tpl-escala-sysbm');
    if (!corpo || !molde) return;
    corpo.appendChild(molde.content.cloneNode(true));

    var raiz = document.getElementById('painel');
    form = {
      raiz: raiz,
      data: raiz.querySelector('[data-sysbm-data]'),
      lista: raiz.querySelector('[data-sysbm-lista]'),
      vazio: raiz.querySelector('[data-sysbm-vazio]'),
      linhas: []
    };

    form.data.value = RW.data.paraBR((opcoes && opcoes.data) || new Date());
    if (RW.campos) RW.campos.ligarData(form.data);
    form.data.addEventListener('input', function () {
      if (RW.campos) RW.campos.limparErro(form.data);
      tokenLeitura++;
      limparLinhas();
      clearTimeout(esperaData);
      esperaData = setTimeout(lerTodos, ESPERA_DATA);
    });

    /* o favorito: arrastar até a barra de favoritos (clicar aqui no Roster só explica) e, no celular, copiar o código */
    var favorito = raiz.querySelector('[data-sysbm-favorito]');
    favorito.setAttribute('href', codigoFavorito());
    favorito.addEventListener('click', function (e) {
      e.preventDefault();
      if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: m.arrasteFavorito });
    });
    var codigo = raiz.querySelector('[data-sysbm-codigo]');
    codigo.addEventListener('click', function () { copiarCodigo(codigo); });

    montarLinhas((opcoes && opcoes.pelotoes) || []);
    lerTodos();
  }

  RW.escalasSysbm = { abrir: abrir };
})();
