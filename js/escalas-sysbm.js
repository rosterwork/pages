/* ============================================================
   ESCALAS — Lançar no SYSBM (o bloco do painel do dia)
   No fim da seção Dia do painel (escalas-painel-editar.js), para
   quem administra o pelotão, no computador e no celular: o bloco
   retrátil "Lançar no SYSBM". O envio é só pelo Firefox, com a
   extensão Roster Work (extensao-sysbm, fora do site; publicada
   na loja da Mozilla):
   - fora do Firefox: o título e o aviso de que é só no Firefox;
   - no Firefox sem a extensão: o título e o Instalar a extensão (a
     página dela na loja da Mozilla, noutra aba); instalada com o
     painel aberto, o bloco troca sozinho para o Enviar e confirma;
   - com a extensão: ele lê no banco a escala do pelotão no dia já
     convertida nas linhas do SYSBM (escala_sysbm). A leitura sai
     junto com a do dia do painel (preparar) e fica guardada para
     os redesenhos do Dia; o bloco entra junto com o Dia, com o
     Enviar desligado e respirando até ela chegar. Só no painel do
     pelotão e no dia com escala; se mesmo assim não houver o que
     lançar, a frase no lugar do Enviar. Fechado: o Enviar e, se alguém
     fica de fora, a linha amarela; aberto pelo chevron: o resumo,
     quem fica de fora e por quê e a explicação. Enviar leva a
     escala à extensão, que abre a aba do SYSBM e preenche a tela
     de cadastro depois do login (no celular, sem aba nova: a
     própria tela vai para o SYSBM; lá, o Salvar vira "Voltar para
     RW" e o Salvar e Continuar volta ao Roster depois de salvar).
     No primeiro Enviar de cada
     administrador (e a cada versão nova do termo), a janela do
     termo de responsabilidade: a ciência fica gravada no banco
     (sysbm_dar_ciencia).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var TEMPO_ENVIADO = 2000;     // ms com o "Enviado" no botão
  var ESPERA_EXTENSAO = 10000;  // ms esperando a extensão responder que abriu a aba do SYSBM

  var aguardando = null;        // o bloco que mostra o Instalar a extensão, à espera dela ({partes, unidadeId, iso})
  var observador = null;        // olha a marca da extensão no <html> enquanto há bloco à espera
  var ciente = false;           // quem está logado já deu ciência da versão vigente do termo (sabido nesta página)
  var guardada = null;          // a última leitura: {chave, promessa, chegou, resposta}; renovada a cada leitura do dia gravado

  function msg() { return (RW.mensagens.escala && RW.mensagens.escala.sysbm) || {}; }

  /* o bloco é do pelotão (a unidade de cima é a companhia); sem a árvore de unidades à mão, o banco decide */
  function ePelotao(unidadeId) {
    var A = RW.arvoreUnidades;
    var pai = A && A.pai ? A.pai(unidadeId) : null;
    return !pai || pai.tipo === 'CIA' || pai.tipo === 'CIBM';
  }

  /* ---------- o navegador e a extensão ---------- */
  /* o Firefox, no computador ou no Android (no iPhone ele se chama FxiOS e não aceita extensões) */
  function eFirefox() {
    return /\bFirefox\//.test(navigator.userAgent);
  }

  /* a extensão (extensao-sysbm, ponte-roster.js) marca a página: ela abre e preenche o SYSBM */
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
      }, ESPERA_EXTENSAO);
      window.addEventListener('message', tratar);
      /* no celular (o aparelho, em pé ou deitado), a extensão leva esta mesma aba para o SYSBM (sem aba nova; lá, o
         Salvar vira "Voltar para RW") */
      var mesmaTela = !!(RW.aplicativo && RW.aplicativo.celular());
      window.postMessage({ origem: 'rosterwork-sysbm', id: id, texto: texto, mesmaTela: mesmaTela }, window.location.origin);
    });
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

  /* nada para lançar (ou o banco recusou): a frase no lugar do Enviar e do chevron */
  function mostrarVazio(partes, r) {
    partes.dados = null;
    partes.enviar.classList.add('oculto');
    partes.toggle.classList.add('oculto');
    partes.conteudo.classList.add('oculto');
    partes.fora.classList.add('oculto');
    partes.situacao.textContent = (!r.ok && r.erro) || msg().nadaParaLancar;
    partes.situacao.classList.remove('oculto');
  }

  /* enquanto a leitura não chega: o Enviar desligado, respirando como as formas do carregando (geral-esqueleto.css) */
  function mostrarLendo(partes) {
    partes.enviar.disabled = true;
    partes.enviar.classList.add('esqueleto-conjunto');
  }

  /* a resposta no bloco; o Enviar liga (desligado só com mudança do dia ainda não salva) */
  function aplicar(partes, r) {
    partes.enviar.classList.remove('esqueleto-conjunto');
    partes.enviar.disabled = !!partes.desligado;
    if (r && (!r.ok || !r.linhas.length)) { mostrarVazio(partes, r); return; }
    if (r) preencher(partes, r); else mostrarFalha(partes);
  }

  /* a leitura da escala do pelotão no dia: sai junto com a leitura do dia gravado do painel (a abertura e o Salvar,
     escalas-painel-editar.js) e fica guardada; os redesenhos do Dia (o rascunho, o Desfazer, a outra aba) usam ela */
  function preparar(unidadeId, iso) {
    if (!eFirefox() || !temExtensao() || !ePelotao(unidadeId) || !RW.escalasDados || !RW.escalasDados.lerSysbm) return null;
    var leitura = { chave: unidadeId + '|' + iso, chegou: false, resposta: null };
    leitura.promessa = RW.escalasDados.lerSysbm(unidadeId, iso).then(function (r) {
      leitura.chegou = true;
      leitura.resposta = r;
      return r;
    });
    guardada = leitura;
    return leitura;
  }

  /* a leitura guardada deste dia; sem ela (ou a que falhou), uma nova */
  function leituraDe(unidadeId, iso) {
    var g = guardada;
    if (g && g.chave === unidadeId + '|' + iso && !(g.chegou && !g.resposta)) return g;
    return preparar(unidadeId, iso);
  }

  /* põe a leitura no bloco quando chegar (leitura: a já pedida; sem ela, lê de novo); o bloco que saiu da tela (o Dia
     foi redesenhado) não muda mais */
  function ler(partes, unidadeId, iso, leitura) {
    leitura = leitura || preparar(unidadeId, iso);
    if (!leitura) return Promise.resolve();
    return leitura.promessa.then(function (r) {
      if (!partes.bloco.isConnected) return;
      aplicar(partes, r);
    });
  }

  /* o termo de responsabilidade antes do primeiro Enviar: a situação vem do banco (uma vez por página); se
     falta a ciência da versão vigente, a janela do termo (Concordo grava a ciência e segue; Cancelar não
     envia). Devolve true para seguir com o envio */
  function garantirCiencia(partes, unidadeId) {
    if (ciente) return Promise.resolve(true);
    var m = msg();
    var t = m.termo;
    /* os pontinhos no Enviar na hora e o cartão das etapas só se passar de 1,5 s (também na ciência e na leitura) */
    var espera = RW.etapas.acao('sysbmPreparar', { termo: true }, { doServidor: 1, botao: partes.enviar, atraso: true });
    return RW.escalasDados.sysbmTermo().then(function (r) {
      espera.parar();
      if (!r) {
        if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: m.falhaEnviar });
        return false;
      }
      if (!r.pendente) { ciente = true; return true; }
      return new Promise(function (resolver) {
        RW.confirmar({
          tipo: 'aviso',
          mensagem: t.titulo,
          itens: t.itens.map(function (texto, i) { return { titulo: String(i + 1), texto: texto }; }),
          nota: t.nota,
          semIcone: true,
          textoConfirmar: t.concordo,
          aoConfirmar: function () {
            var ciencia = RW.etapas.acao('cienciaRegistrar', null, { doServidor: 1, botao: partes.enviar, atraso: true });
            RW.escalasDados.sysbmDarCiencia(unidadeId, t.versao).then(function (d) {
              ciencia.parar();
              if (d && d.success) { ciente = true; resolver(true); return; }
              if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: (d && d.error) || t.falha });
              resolver(false);
            });
          },
          aoCancelar: function () { resolver(false); }
        });
      });
    });
  }

  /* Enviar: a escala para a extensão, no formato que o preenchedor lê ({data, unidade, funcoes_roster,
     linhas}); ela abre a aba do SYSBM e preenche depois do login. Antes, a ciência do termo. Depois de uma
     falha na leitura, o Enviar lê de novo */
  function enviar(partes, unidadeId, iso) {
    if (!partes.dados) {
      var lendo = RW.etapas.acao('sysbmPreparar', { termo: false }, { doServidor: 1, botao: partes.enviar, atraso: true });
      ler(partes, unidadeId, iso).then(function () { lendo.parar(); });
      return;
    }
    garantirCiencia(partes, unidadeId).then(function (seguir) {
      if (seguir) mandar(partes);
    });
  }

  /* a escala para a extensão; "Enviado" no botão e o que fazer no SYSBM */
  function mandar(partes) {
    var m = msg();
    var d = partes.dados;
    var texto = JSON.stringify({ data: d.data, unidade: d.unidade, funcoes_roster: d.funcoes_roster, linhas: d.linhas });
    enviarPelaExtensao(texto).then(function () {
      partes.enviar.textContent = m.enviado;
      setTimeout(function () { if (partes.enviar.isConnected) partes.enviar.textContent = m.enviar; }, TEMPO_ENVIADO);
      partes.situacao.textContent = m.instrucao;
      partes.situacao.classList.remove('oculto');
    }).catch(function () {
      if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: m.falhaEnviar });
    });
  }

  /* o bloco com a extensão: o Enviar e o chevron no lugar do Instalar a extensão */
  function ligarEnvio(partes, unidadeId, iso) {
    partes.instalar.classList.add('oculto');
    partes.enviar.classList.remove('oculto');
    partes.toggle.classList.remove('oculto');
    partes.toggle.addEventListener('click', function () {
      var abrir = partes.toggle.getAttribute('aria-expanded') !== 'true';
      partes.toggle.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      partes.conteudo.classList.toggle('oculto', !abrir);
    });
    partes.enviar.addEventListener('click', function () { enviar(partes, unidadeId, iso); });
  }

  /* no Firefox sem a extensão: quando ela marca a página (instalada com a aba aberta), o bloco que mostra o
     Instalar a extensão vira o do envio, lê a escala e confirma. Um observador só, para o último bloco montado */
  function esperarExtensao(partes, unidadeId, iso) {
    aguardando = { partes: partes, unidadeId: unidadeId, iso: iso };
    if (observador) return;
    observador = new MutationObserver(function () {
      if (!temExtensao() || !aguardando) return;
      var a = aguardando;
      aguardando = null;
      observador.disconnect();
      observador = null;
      if (!a.partes.bloco.isConnected) return;
      ligarEnvio(a.partes, a.unidadeId, a.iso);
      mostrarLendo(a.partes);
      ler(a.partes, a.unidadeId, a.iso).then(function () {
        if (!a.partes.dados || !a.partes.bloco.isConnected) return;
        a.partes.situacao.textContent = msg().extensaoInstalada;
        a.partes.situacao.classList.remove('oculto');
      });
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-sysbm-extensao'] });
  }

  /* põe o bloco no fim do corpo do Dia, só no painel do pelotão e no dia com escala. Fora do Firefox, o título e o
     aviso; no Firefox sem a extensão, o título e o Instalar a extensão (até ela chegar); com ela, o bloco inteiro na
     hora, com o Enviar respirando até a leitura chegar (a guardada, quando já chegou, na hora) */
  /* opcoes.desligado: há mudança do dia ainda não salva no painel; o Enviar espera o Salvar (o SYSBM lê a escala gravada).
     opcoes.comEscala: o dia tem alguém na escala */
  function montar(corpo, unidadeId, iso, opcoes) {
    opcoes = opcoes || {};
    if (!opcoes.comEscala || !ePelotao(unidadeId)) return;
    var bloco = RW.tpl('tpl-escala-sysbm');
    if (!bloco || !RW.escalasDados || !RW.escalasDados.lerSysbm) return;
    var partes = {
      bloco: bloco,
      enviar: bloco.querySelector('[data-sysbm-enviar]'),
      instalar: bloco.querySelector('[data-sysbm-instalar]'),
      toggle: bloco.querySelector('[data-sysbm-toggle]'),
      fora: bloco.querySelector('[data-sysbm-fora]'),
      situacao: bloco.querySelector('[data-sysbm-situacao]'),
      conteudo: bloco.querySelector('[data-sysbm-conteudo]'),
      resumo: bloco.querySelector('[data-sysbm-resumo]'),
      avisos: bloco.querySelector('[data-sysbm-avisos]'),
      dados: null,
      desligado: !!opcoes.desligado
    };
    if (!eFirefox() || !temExtensao()) {
      partes.enviar.classList.add('oculto');
      partes.toggle.classList.add('oculto');
      if (eFirefox()) {
        partes.instalar.classList.remove('oculto');
      } else {
        partes.situacao.textContent = msg().soFirefox;
        partes.situacao.classList.remove('oculto');
      }
      corpo.appendChild(bloco);
      if (eFirefox()) esperarExtensao(partes, unidadeId, iso);
      return;
    }
    ligarEnvio(partes, unidadeId, iso);
    if (partes.desligado) partes.enviar.setAttribute('data-dica', msg().salveAntes);
    corpo.appendChild(bloco);
    var leitura = leituraDe(unidadeId, iso);
    if (leitura && leitura.chegou) { aplicar(partes, leitura.resposta); return; }
    mostrarLendo(partes);
    ler(partes, unidadeId, iso, leitura);
  }

  RW.escalasSysbm = { montar: montar, preparar: preparar };
})();
