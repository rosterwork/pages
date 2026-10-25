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
     convertida nas linhas do SYSBM (escala_sysbm; na CIBM o banco
     recusa, e o dia sem escala não tem o que lançar: nos dois
     casos o bloco não aparece). Fechado: o Enviar e, se alguém
     fica de fora, a linha amarela; aberto pelo chevron: o resumo,
     quem fica de fora e por quê e a explicação. Enviar leva a
     escala à extensão, que abre a aba do SYSBM e preenche a tela
     de cadastro depois do login. No primeiro Enviar de cada
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

  function msg() { return (RW.mensagens.escala && RW.mensagens.escala.sysbm) || {}; }

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
      window.postMessage({ origem: 'rosterwork-sysbm', id: id, texto: texto }, window.location.origin);
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

  /* lê a escala do pelotão no dia; o bloco que saiu da tela (o Dia foi redesenhado) não muda mais */
  function ler(partes, unidadeId, iso) {
    return RW.escalasDados.lerSysbm(unidadeId, iso).then(function (r) {
      if (!partes.bloco.isConnected) return;
      if (r && (!r.ok || !r.linhas.length)) { partes.bloco.classList.add('oculto'); return; }
      if (r) preencher(partes, r); else mostrarFalha(partes);
      partes.bloco.classList.remove('oculto');
    });
  }

  /* o termo de responsabilidade antes do primeiro Enviar: a situação vem do banco (uma vez por página); se
     falta a ciência da versão vigente, a janela do termo (Concordo grava a ciência e segue; Cancelar não
     envia). Devolve true para seguir com o envio */
  function garantirCiencia(partes, unidadeId) {
    if (ciente) return Promise.resolve(true);
    var m = msg();
    var t = m.termo;
    if (RW.iniciarCarregando) RW.iniciarCarregando(partes.enviar);
    return RW.escalasDados.sysbmTermo().then(function (r) {
      if (RW.pararCarregando) RW.pararCarregando(partes.enviar);
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
          textoConfirmar: t.concordo,
          aoConfirmar: function () {
            if (RW.iniciarCarregando) RW.iniciarCarregando(partes.enviar);
            RW.escalasDados.sysbmDarCiencia(unidadeId, t.versao).then(function (d) {
              if (RW.pararCarregando) RW.pararCarregando(partes.enviar);
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
      if (RW.iniciarCarregando) RW.iniciarCarregando(partes.enviar);
      ler(partes, unidadeId, iso).then(function () { if (RW.pararCarregando) RW.pararCarregando(partes.enviar); });
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
      ler(a.partes, a.unidadeId, a.iso).then(function () {
        if (!a.partes.dados || !a.partes.bloco.isConnected) return;
        a.partes.situacao.textContent = msg().extensaoInstalada;
        a.partes.situacao.classList.remove('oculto');
      });
    });
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-sysbm-extensao'] });
  }

  /* põe o bloco no fim do corpo do Dia. Fora do Firefox, o título e o aviso; no Firefox sem a extensão, o
     título e o Instalar a extensão (até ela chegar); com ela, o bloco inteiro, escondido até a leitura chegar */
  function montar(corpo, unidadeId, iso) {
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
      dados: null
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
    bloco.classList.add('oculto');
    ligarEnvio(partes, unidadeId, iso);
    corpo.appendChild(bloco);
    ler(partes, unidadeId, iso);
  }

  RW.escalasSysbm = { montar: montar };
})();
