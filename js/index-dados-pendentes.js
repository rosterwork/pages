/* ============================================================
   CONFIRA O SEU CADASTRO — janela ao entrar (shell)
   Uma vez por login, depois da janela dos termos, que tem a vez,
   enquanto o militar não conferiu a ficha que o administrador
   cadastrou (dados_pendentes: conferir). A ficha é só para
   leitura (a mesma leitura do Meu perfil, buscar_ficha_militar);
   o que está vazio aparece "-". As datas de promoção vão uma por
   posto depois do primeiro (a regra do Meus dados,
   RosterWork.campos.postosComData); no oficial, as de praça só
   as gravadas. Para a praça (dados_pendentes: praca), o endereço
   do SYSBM onde conferir as datas e a colocação.
   "Confirmar" registra a conferência (cadastro_conferir) e a
   janela não abre mais; "Corrigir em Meus dados" também registra
   e leva ao Meus dados; "Conferir depois" fecha, e a janela volta
   na próxima entrada. A CNH que falta é lembrada na Pendências
   (index-cnh-painel.js).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var confirmar, corrigirBotao;

  function C() { return RosterWork.campos; }
  function V() { return RosterWork.validacoes; }

  function sessao() {
    try { return JSON.parse(sessionStorage.getItem('rosterwork_user')); } catch (e) { return null; }
  }

  /* "uma vez por login": a marca fica no rosterwork_user, que o login grava de novo a cada entrada */
  function jaLembrado() {
    var usuario = sessao();
    return usuario ? !!usuario.dadosPendentesLembrados : true;
  }

  function marcarLembrado() {
    try {
      var usuario = JSON.parse(sessionStorage.getItem('rosterwork_user'));
      usuario.dadosPendentesLembrados = true;
      sessionStorage.setItem('rosterwork_user', JSON.stringify(usuario));
    } catch (e) {}
  }

  /* ---------- a ficha para leitura ---------- */
  function escreverFicha(id, valor) {
    document.getElementById('dados-pendentes-ver-' + id).textContent = valor || '-';
  }

  /* uma data por posto depois do primeiro (a data dele é a de inclusão); no oficial, as de praça só as
     gravadas. Sem a lista dos postos (a leitura falhou), só as gravadas */
  function datasDePromocao(ficha, graus) {
    var institucionais = ficha.institucionais || {}, gravadas = {};
    (ficha.promocoes || []).forEach(function (p) { gravadas[String(p.grau_id)] = p.data; });
    var inclusao = V().parseData(RosterWork.data.isoParaBR(institucionais.data_de_inclusao));
    var postos = C().postosComData(Array.isArray(graus) ? graus : [], institucionais.grau_id, inclusao, Object.keys(gravadas));
    var praca = postos.praca.filter(function (g) { return gravadas[String(g.grau_id)]; });
    var lista = praca.concat(postos.carreira);
    if (!lista.length) return ficha.promocoes || [];
    return lista.map(function (g) { return { grau_nome: g.grau_nome, data: gravadas[String(g.grau_id)] }; });
  }

  function preencherFicha(ficha, graus) {
    var pessoais = ficha.pessoais || {}, institucionais = ficha.institucionais || {};
    var D = RosterWork.data;
    escreverFicha('grad', institucionais.grau_abreviacao);
    escreverFicha('guerra', institucionais.nome_de_guerra);
    escreverFicha('lotacao', institucionais.lotacao_nome);
    escreverFicha('nome-completo', pessoais.nome_completo);
    escreverFicha('cpf', C().mascararCpf(C().soDigitos(pessoais.cpf)));
    escreverFicha('rg', C().mascararRg(C().soDigitos(pessoais.rg)));
    escreverFicha('nascimento', D.isoParaBR(pessoais.data_de_nascimento));
    escreverFicha('celular', C().mascararCelular(C().soDigitos(pessoais.celular)));
    escreverFicha('email', pessoais.email);
    escreverFicha('quadro', institucionais.quadro);
    escreverFicha('inclusao', D.isoParaBR(institucionais.data_de_inclusao));
    escreverFicha('posto', institucionais.grau_nome);
    escreverFicha('nome-guerra', institucionais.nome_de_guerra);
    escreverFicha('setor', institucionais.tipo);
    /* "0000" = sem colocação: aparece "-"; o rótulo diz o curso (CFO, CHOE ou CFP), pelo quadro */
    escreverFicha('colocacao', parseInt(String(institucionais.classificacao || '').replace(/\D/g, ''), 10) ? institucionais.classificacao : '');
    escreverFicha('colocacao-rotulo', C().nomeColocacao(institucionais.quadro));
    escreverFicha('cnh', pessoais.cnh);

    var lista = document.getElementById('dados-pendentes-ver-promocoes');
    lista.textContent = '';
    datasDePromocao(ficha, graus).forEach(function (promocao) {
      var dado = RosterWork.tpl('tpl-dados-pendentes-promocao');
      if (!dado) return;
      dado.querySelector('.perfil-dado-rotulo').textContent = promocao.grau_nome;
      dado.querySelector('.perfil-dado-valor').textContent = D.isoParaBR(promocao.data) || '-';
      lista.appendChild(dado);
    });
    document.getElementById('dados-pendentes-ver-promocoes-secao').classList.toggle('oculto', !lista.children.length);
  }

  /* a mesma leitura da aba Perfil do Meu perfil, com a lista dos postos (para as datas de promoção) */
  function lerFicha() {
    var usuario = sessao();
    if (!usuario || !usuario.cpf) return Promise.resolve({ ficha: null });
    return Promise.all([
      RosterWork.rpc('buscar_ficha_militar', { p_usuario_id: usuario.cpf }).catch(function () { return null; }),
      RosterWork.rpc('buscar_graus_hierarquicos').catch(function () { return null; })
    ]).then(function (r) { return { ficha: r[0], graus: r[1] }; });
  }

  /* ---------- os botões ---------- */
  /* registra a conferência (cadastro_conferir); feita, segue para o que o botão faz */
  function registrarConferencia(botao, depois) {
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(botao);
    RosterWork.rpc('cadastro_conferir')
      .then(function (conferencia) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        if (!conferencia || !conferencia.success) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (conferencia && conferencia.error) || RosterWork.mensagens.perfil.falhaDados });
          return;
        }
        if (RosterWork.fecharModais) RosterWork.fecharModais();
        depois();
      })
      .catch(function () {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* "Confirmar": a própria janela confirma (o aviso), sem o resumo */
  function confirmarFicha() {
    registrarConferencia(confirmar, function () {
      RosterWork.avisar({ tipo: 'sucesso', mensagem: RosterWork.mensagens.perfil.cadastroConferido });
    });
  }

  /* "Corrigir em Meus dados": olhar a ficha e achar o erro também é conferir */
  function corrigir() {
    registrarConferencia(corrigirBotao, function () {
      if (RosterWork.irParaPagina) RosterWork.irParaPagina('perfil', 'dados');
    });
  }

  /* o endereço do SYSBM só para a praça */
  function mostrarLink(praca) {
    var link = document.querySelectorAll('[data-dados-pendentes-link]');
    for (var i = 0; i < link.length; i++) link[i].classList.toggle('oculto', !praca);
  }

  function inicializar() {
    var veu = document.getElementById('veu-dados-pendentes');
    var conferirDepois = document.getElementById('dados-pendentes-conferir-depois');
    confirmar = document.getElementById('dados-pendentes-confirmar');
    corrigirBotao = document.getElementById('dados-pendentes-corrigir');
    if (!veu || !confirmar || !corrigirBotao || !conferirDepois || !RosterWork.campos) return;
    conferirDepois.addEventListener('click', function () { if (RosterWork.fecharModais) RosterWork.fecharModais(); });
    confirmar.addEventListener('click', confirmarFicha);
    corrigirBotao.addEventListener('click', corrigir);

    if (jaLembrado() || !RosterWork.rpc) return;
    var vez = RosterWork.termos ? RosterWork.termos.liberado : Promise.resolve();
    Promise.all([RosterWork.rpc('dados_pendentes').catch(function () { return null; }), vez])
      .then(function (resultado) {
        var r = resultado[0];
        if (!r || !r.success) return;   // falhou: tenta de novo no próximo carregamento
        marcarLembrado();
        if (!r.conferir) return;   // a ficha já foi conferida: a janela não abre mais
        /* sem a ficha não há o que conferir: fica para a próxima entrada */
        lerFicha().then(function (lido) {
          if (!lido.ficha || !lido.ficha.pessoais) return;
          preencherFicha(lido.ficha, lido.graus);
          mostrarLink(!!r.praca);
          /* o foco abre no Confirmar (no rodapé), e a ficha abre do começo */
          if (RosterWork.abrirModal) RosterWork.abrirModal('veu-dados-pendentes', confirmar);
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
