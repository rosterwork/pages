/* ============================================================
   ESCALAS — Lançar no SYSBM (o bloco do painel do dia)
   No fim da seção Dia do painel (escalas-painel-editar.js), para
   quem administra o pelotão; no celular, só com a extensão do Firefox: o bloco retrátil
   "Lançar no SYSBM". Ele lê no banco a escala do pelotão no dia já
   convertida nas linhas do SYSBM (escala_sysbm; na CIBM o banco
   recusa, e o dia sem escala não tem o que lançar: nos dois casos
   o bloco não aparece). Fechado: o Enviar e, se alguém fica de
   fora, a linha amarela; aberto pelo chevron: o resumo, quem fica
   de fora e por quê, a explicação e o favorito "Lançar no SYSBM"
   para arrastar até a barra de favoritos. Enviar leva a escala à
   área de transferência e abre a aba do SYSBM, onde o favorito
   (escalas-sysbm-favorito.js) preenche.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var TEMPO_ENVIADO = 2000;   // ms com o "Enviado" no botão
  /* a tela inicial do SYSBM e o nome da aba dele (os mesmos do escalas-sysbm-favorito.js) */
  var ENDERECO_SYSBM = 'https://www.sysbm.bombeiros.pr.gov.br/sysbmnew/menu/';
  var ABA_SYSBM = 'rosterwork-sysbm';

  function msg() { return (RW.mensagens.escala && RW.mensagens.escala.sysbm) || {}; }

  /* ---------- o favorito e a aba do SYSBM ---------- */
  /* o código do favorito: carrega o preenchedor deste site na página aberta (o SYSBM) */
  function codigoFavorito() {
    var endereco = new URL('js/escalas-sysbm-favorito.js', document.baseURI).href;
    return "javascript:(function(){var s=document.createElement('script');s.src='" + endereco
      + "?'+Date.now();document.body.appendChild(s);})();";
  }

  function copiarTexto(texto) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return Promise.reject(new Error('sem área de transferência'));
    return navigator.clipboard.writeText(texto);
  }

  /* a extensão do Firefox (extensao-sysbm, ponte-roster.js) marca a página: ela abre e preenche o SYSBM */
  function temExtensao() {
    return document.documentElement.getAttribute('data-sysbm-extensao') === '1';
  }

  /* manda a escala à extensão e espera a resposta dela (ok = a aba do SYSBM abriu) */
  function enviarPelaExtensao(texto) {
    return new Promise(function (resolver, rejeitar) {
      var id = String(Date.now()) + String(Math.random());
      var espera;
      function tratar(e) {
        if (e.source !== window || !e.data || e.data.origem !== 'rosterwork-sysbm-resposta' || e.data.id !== id) return;
        clearTimeout(espera);
        window.removeEventListener('message', tratar);
        if (e.data.ok) resolver(); else rejeitar(new Error('extensão recusou'));
      }
      espera = setTimeout(function () {
        window.removeEventListener('message', tratar);
        rejeitar(new Error('sem resposta'));
      }, 10000);
      window.addEventListener('message', tratar);
      window.postMessage({ origem: 'rosterwork-sysbm', id: id, texto: texto }, window.location.origin);
    });
  }

  /* a aba do SYSBM: a que o Roster já abriu vem para a frente, sem recarregar (lá é outro site, e ler o
     endereço dela dá erro); sem ela, uma aba nova na tela inicial do SYSBM. false = o navegador bloqueou */
  function abrirSysbm() {
    var aba = window.open('', ABA_SYSBM);
    if (!aba) return false;
    try {
      if (aba.location.href === 'about:blank') aba.location.href = ENDERECO_SYSBM;
    } catch (e) {
      /* já está no SYSBM: só vem para a frente */
    }
    aba.focus();
    return true;
  }

  /* ---------- o bloco ---------- */
  /* quem fica de fora do SYSBM: uma frase por motivo e quantos são */
  function avisosDe(avisos) {
    var m = msg();
    var textos = [], quantos = 0;
    function por(lista, frase) {
      if (!lista || !lista.length) return;
      quantos += lista.length;
      textos.push(frase(m.juntar(lista)));
    }
    por(avisos.sem_rg, m.semRg);
    por((avisos.sem_par || []).map(function (a) { return m.comFuncao(a.militar, a.funcao); }), m.semPar);
    por(avisos.fora, m.fora);
    por(avisos.sem_funcao, m.semFuncao);
    return { textos: textos, quantos: quantos };
  }

  /* a leitura no bloco: o resumo, os motivos (aberto) e a linha amarela (sempre à vista) */
  function preencher(partes, r) {
    var m = msg();
    partes.dados = r;
    partes.situacao.classList.add('oculto');
    partes.resumo.textContent = m.resumo(r.linhas.length);
    var avisos = avisosDe(r.avisos || {});
    partes.avisos.textContent = '';
    avisos.textos.forEach(function (texto) {
      var aviso = RW.tpl('tpl-escala-sysbm-aviso');
      if (!aviso) return;
      aviso.textContent = texto;
      partes.avisos.appendChild(aviso);
    });
    partes.fora.textContent = avisos.quantos ? m.foraResumo(avisos.quantos) : '';
    partes.fora.classList.toggle('oculto', !avisos.quantos);
  }

  /* a leitura falhou: o bloco aparece com o aviso, e o Enviar lê de novo */
  function mostrarFalha(partes) {
    partes.dados = null;
    partes.situacao.textContent = msg().falhaLer;
    partes.situacao.classList.remove('oculto');
  }

  /* lê a escala do pelotão no dia; o bloco que saiu da tela (o Dia foi redesenhado) não muda mais */
  function ler(partes, unidadeId, iso) {
    return RW.escalasDados.lerSysbm(unidadeId, iso).then(function (r) {
      if (!partes.bloco.isConnected) return;
      if (r && (!r.ok || !r.linhas.length)) { partes.bloco.classList.add('oculto'); return; }
      if (r) preencher(partes, r); else mostrarFalha(partes);
      partes.bloco.classList.remove('oculto');
    });
  }

  /* Enviar: a escala para a área de transferência, no formato que o favorito lê ({data, unidade,
     funcoes_roster, linhas}), e a aba do SYSBM na frente. A cópia vem antes: com a aba do SYSBM na frente,
     o Roster perde o foco e não copia mais. Depois de uma falha, o Enviar lê de novo */
  function enviar(partes, unidadeId, iso) {
    var m = msg();
    if (!partes.dados) {
      if (RW.iniciarCarregando) RW.iniciarCarregando(partes.enviar);
      ler(partes, unidadeId, iso).then(function () { if (RW.pararCarregando) RW.pararCarregando(partes.enviar); });
      return;
    }
    var d = partes.dados;
    var texto = JSON.stringify({ data: d.data, unidade: d.unidade, funcoes_roster: d.funcoes_roster, linhas: d.linhas });
    function mostrarEnviado(instrucao) {
      partes.enviar.textContent = m.enviado;
      setTimeout(function () { if (partes.enviar.isConnected) partes.enviar.textContent = m.enviar; }, TEMPO_ENVIADO);
      partes.situacao.textContent = instrucao;
      partes.situacao.classList.remove('oculto');
    }
    function falhou() {
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: m.falhaEnviar });
    }
    if (temExtensao()) {
      enviarPelaExtensao(texto).then(function () { mostrarEnviado(m.instrucaoExtensao); }).catch(falhou);
      return;
    }
    copiarTexto(texto).then(function () {
      mostrarEnviado(m.instrucao);
      if (!abrirSysbm() && RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: m.abaBloqueada });
    }).catch(falhou);
  }

  /* põe o bloco no fim do corpo do Dia (escondido até a leitura chegar). Só no computador */
  function montar(corpo, unidadeId, iso) {
    if (RW.celular && RW.celular() && !temExtensao()) return;
    var bloco = RW.tpl('tpl-escala-sysbm');
    if (!bloco || !RW.escalasDados || !RW.escalasDados.lerSysbm) return;
    bloco.classList.add('oculto');
    var partes = {
      bloco: bloco,
      enviar: bloco.querySelector('[data-sysbm-enviar]'),
      toggle: bloco.querySelector('[data-sysbm-toggle]'),
      fora: bloco.querySelector('[data-sysbm-fora]'),
      situacao: bloco.querySelector('[data-sysbm-situacao]'),
      conteudo: bloco.querySelector('[data-sysbm-conteudo]'),
      resumo: bloco.querySelector('[data-sysbm-resumo]'),
      avisos: bloco.querySelector('[data-sysbm-avisos]'),
      dados: null
    };
    partes.toggle.addEventListener('click', function () {
      var abrir = partes.toggle.getAttribute('aria-expanded') !== 'true';
      partes.toggle.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      partes.conteudo.classList.toggle('oculto', !abrir);
    });
    partes.enviar.addEventListener('click', function () { enviar(partes, unidadeId, iso); });
    /* o favorito: arrastar até a barra de favoritos; clicar nele aqui no Roster só explica */
    var favorito = bloco.querySelector('[data-sysbm-favorito]');
    favorito.setAttribute('href', codigoFavorito());
    favorito.addEventListener('click', function (e) {
      e.preventDefault();
      if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: msg().arrasteFavorito });
    });
    corpo.appendChild(bloco);
    ler(partes, unidadeId, iso);
  }

  RW.escalasSysbm = { montar: montar };
})();
