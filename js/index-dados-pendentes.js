/* ============================================================
   DADOS PENDENTES — janela ao entrar (shell)
   Uma vez por login, depois da janela dos termos, que tem a vez.
   O banco (dados_pendentes) diz o que pedir; a janela tem dois modos:
   - CONFERIR, enquanto o militar não conferiu a ficha que o
     administrador cadastrou: a ficha para leitura (a mesma leitura
     do Meu perfil, buscar_ficha_militar) e, em "Falta preencher",
     o que falta. "Confirmar" envia o preenchido e registra a
     conferência (cadastro_conferir), sem cobrar o que ficou em
     branco; "Corrigir em Meus dados" registra a conferência e leva
     ao Meus dados; "Conferir depois" desfaz e fecha.
   - PENDENTES, com a ficha já conferida, só quando falta algo:
     para todos, a CNH em "Nenhuma" ainda não confirmada; para a
     praça, a colocação no CFP e as datas de promoção (do primeiro
     posto, que vale pela data de inclusão, ao atual). "Salvar"
     habilita quando algo muda; com tudo preenchido a janela fecha,
     senão continua aberta. "Preencher depois" desfaz e fecha.
   O preenchido vai por perfil_solicitar (o mesmo caminho do Meus
   dados: vai para a aprovação; "Não tenho CNH" só confirma). Os
   campos ficam na própria janela (exceção à regra do modal, como
   o Fale conosco).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var campos = [];   /* [{ el, campo, tipo, original }]: a CNH, a colocação e um por posto */
  var veu, salvar, confirmar, corrigirBotao;
  var modo = 'pendentes';   /* 'conferir' ou 'pendentes' */

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

  /* a CNH é um seletor (o valor fica em data-valor); a colocação e as datas, campos de texto */
  function ler(c) { return c.tipo === 'cnh' ? (c.el.getAttribute('data-valor') || '') : c.el.value.trim(); }
  function escrever(c, valor) {
    if (c.tipo === 'cnh') C().definirSelecao(c.el, valor);
    else c.el.value = valor;
  }

  function alterados() {
    return campos.filter(function (c) { return ler(c) !== c.original; });
  }

  /* o Salvar (modo pendentes) só habilita com algo mudado; o Confirmar vale sempre */
  function revisar() {
    if (salvar) salvar.disabled = !alterados().length;
  }

  function adicionar(c, original) {
    c.original = original || '';
    escrever(c, c.original);
    campos.push(c);
  }

  /* o que é de um modo só aparece nele */
  function aplicarModo(novo) {
    modo = novo;
    var deConferir = veu.querySelectorAll('[data-modo-conferir]');
    for (var i = 0; i < deConferir.length; i++) deConferir[i].classList.toggle('oculto', modo !== 'conferir');
    var dePendentes = veu.querySelectorAll('[data-modo-pendentes]');
    for (var j = 0; j < dePendentes.length; j++) dePendentes[j].classList.toggle('oculto', modo !== 'pendentes');
  }

  /* mostra só o que veio do banco: cada item com o valor gravado ou o enviado e esperando a aprovação */
  function montar(r) {
    campos = [];
    C().limparErros(veu);
    var cnh = document.getElementById('dados-pendentes-cnh-campo');
    cnh.classList.toggle('oculto', !r.cnh);
    if (r.cnh) adicionar({ el: document.getElementById('dados-pendentes-cnh'), campo: 'cnh', tipo: 'cnh' }, r.cnh.valor);
    var colocacao = document.getElementById('dados-pendentes-colocacao-campo');
    colocacao.classList.toggle('oculto', !r.colocacao);
    if (r.colocacao) adicionar({ el: document.getElementById('dados-pendentes-colocacao'), campo: 'classificacao_cfo_cfp', tipo: 'colocacao' }, r.colocacao.valor);

    var lista = document.getElementById('dados-pendentes-postos');
    lista.textContent = '';
    (r.postos || []).forEach(function (p) {
      var campo = RosterWork.tpl('tpl-nu-promocao');
      if (!campo) return;
      campo.querySelector('.campo-rotulo').textContent = p.grau_nome;
      var controle = { el: campo.querySelector('.campo-entrada'), campo: p.campo, tipo: 'data' };
      adicionar(controle, RosterWork.data.isoParaBR(p.data));
      C().ligarData(controle.el);
      controle.el.addEventListener('input', function () { C().limparErro(controle.el); revisar(); });
      lista.appendChild(campo);
    });
    lista.classList.toggle('oculto', !lista.children.length);

    /* a caixa do que falta só aparece quando falta algo (o título dela é só do modo conferir) */
    document.getElementById('dados-pendentes-falta').classList.toggle('oculto', !campos.length);

    /* o endereço do SYSBM só acompanha a colocação e as datas */
    var link = document.querySelectorAll('[data-dados-pendentes-link]');
    for (var i = 0; i < link.length; i++) link[i].classList.toggle('oculto', !r.link);
    revisar();
  }

  /* ---------- a ficha para leitura (modo conferir) ---------- */
  function escreverFicha(id, valor) {
    document.getElementById('dados-pendentes-ver-' + id).textContent = valor || '-';
  }

  function preencherFicha(ficha, r) {
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

    /* o que está em "Falta preencher" não se repete na leitura (a inclusão é a data do primeiro posto) */
    var comDatas = (r.postos || []).length > 0;
    document.getElementById('dados-pendentes-dado-cnh').classList.toggle('oculto', !!r.cnh);
    document.getElementById('dados-pendentes-dado-colocacao').classList.toggle('oculto', !!r.colocacao);
    document.getElementById('dados-pendentes-dado-inclusao').classList.toggle('oculto', comDatas);

    var lista = document.getElementById('dados-pendentes-ver-promocoes');
    lista.textContent = '';
    if (!comDatas) {
      (ficha.promocoes || []).forEach(function (promocao) {
        var dado = RosterWork.tpl('tpl-dados-pendentes-promocao');
        if (!dado) return;
        dado.querySelector('.perfil-dado-rotulo').textContent = promocao.grau_nome;
        dado.querySelector('.perfil-dado-valor').textContent = D.isoParaBR(promocao.data);
        lista.appendChild(dado);
      });
    }
    document.getElementById('dados-pendentes-ver-promocoes-secao').classList.toggle('oculto', !lista.children.length);
  }

  /* a mesma leitura da aba Perfil do Meu perfil */
  function lerFicha() {
    var usuario = sessao();
    if (!usuario || !usuario.cpf) return Promise.resolve(null);
    return RosterWork.rpc('buscar_ficha_militar', { p_usuario_id: usuario.cpf }).catch(function () { return null; });
  }

  /* volta ao que está gravado (ou já foi enviado) */
  function restaurar() {
    C().limparErros(veu);
    campos.forEach(function (c) { escrever(c, c.original); });
    revisar();
  }

  /* o que existia não volta a ficar em branco; a colocação não aceita zero; datas válidas, não futuras,
     em ordem do posto mais baixo ao mais alto e nenhuma antes da inclusão (o erro dela fica no primeiro posto) */
  function conferir() {
    var T = RosterWork.mensagens.cadastro, ok = true;
    C().limparErros(veu);
    campos.forEach(function (c) {
      var valor = ler(c);
      if (!valor) {
        if (!c.original) return;
        var vazio = c.tipo === 'cnh' ? T.cnhVazia : (c.tipo === 'colocacao' ? T.colocacaoVazia
          : (c.campo === 'data_de_inclusao' ? T.inclusaoVazia : T.promocaoVazia));
        C().marcarErro(c.el, vazio);
        ok = false;
        return;
      }
      if (c.tipo === 'colocacao' && !parseInt(valor, 10)) { C().marcarErro(c.el, T.colocacaoZero); ok = false; return; }
      if (c.tipo !== 'data') return;
      var data = V().parseData(valor);
      if (!data) { C().marcarErro(c.el, T.dataInvalida); ok = false; return; }
      if (data > new Date()) { C().marcarErro(c.el, RosterWork.mensagens.perfil.dataFutura); ok = false; }
    });
    if (!ok) return false;
    var datas = campos.filter(function (c) { return c.tipo === 'data'; });
    if (!datas.length) return true;
    var inclusao = datas.filter(function (c) { return c.campo === 'data_de_inclusao'; })[0] || null;
    var promocoes = datas.filter(function (c) { return c !== inclusao; }).map(function (c) { return c.el; });
    return C().conferirPromocoes(promocoes, inclusao ? V().parseData(inclusao.el.value) : null, inclusao ? inclusao.el : null);
  }

  function valorParaEnvio(c) {
    var valor = ler(c);
    return c.tipo === 'data' ? V().paraISO(valor) : valor;
  }

  function mudancas() {
    return alterados().map(function (c) { return { campo: c.campo, valor: valorParaEnvio(c) }; });
  }

  /* o banco recusou: o conflito com a inclusão fica no primeiro posto e o da colocação no campo dela */
  function mostrarRecusa(r) {
    var erro = (r && r.error) || RosterWork.mensagens.perfil.falhaDados;
    var alvo = campos.filter(function (c) {
      return (/[Ii]nclusão/.test(erro) && c.campo === 'data_de_inclusao') || (/Colocação/.test(erro) && c.tipo === 'colocacao');
    })[0];
    if (alvo) C().marcarErro(alvo.el, erro);
    else RosterWork.avisar({ tipo: 'erro', mensagem: erro });
  }

  function semConexao(botao) {
    if (RosterWork.pararCarregando) RosterWork.pararCarregando(botao);
    RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
  }

  /* modo pendentes: "Salvar" */
  function enviar() {
    if (!conferir()) return;
    var mudou = mudancas();
    if (!mudou.length) return;
    var M = RosterWork.mensagens;
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(salvar);
    RosterWork.rpc('perfil_solicitar', { p_alteracoes: mudou })
      .then(function (r) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(salvar);
        if (r && r.success) {
          /* o enviado passa a ser o "gravado" da janela; com tudo preenchido ela fecha.
             A própria janela confirma (o aviso), sem o resumo: o pedido ainda vai para a aprovação */
          campos.forEach(function (c) { c.original = ler(c); });
          revisar();
          if (campos.every(function (c) { return c.original; }) && RosterWork.fecharModais) RosterWork.fecharModais();
          RosterWork.avisar({ tipo: 'sucesso', mensagem: r.itens > 0 ? M.perfil.solicitacaoEnviada : M.perfil.dadosSalvos });
          return;
        }
        mostrarRecusa(r);
      })
      .catch(function () { semConexao(salvar); });
  }

  /* modo conferir: "Confirmar" envia o que foi preenchido (o que ficou em branco não é cobrado)
     e registra a conferência; a própria janela confirma (o aviso), sem o resumo */
  function confirmarFicha() {
    if (!conferir()) return;
    var mudou = mudancas();
    var M = RosterWork.mensagens;
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(confirmar);
    var envio = mudou.length
      ? RosterWork.rpc('perfil_solicitar', { p_alteracoes: mudou })
      : Promise.resolve({ success: true, itens: 0 });
    envio
      .then(function (r) {
        if (!r || !r.success) {
          if (RosterWork.pararCarregando) RosterWork.pararCarregando(confirmar);
          mostrarRecusa(r);
          return;
        }
        /* o enviado passa a ser o "gravado": se a conferência falhar, o próximo Confirmar não reenvia */
        campos.forEach(function (c) { c.original = ler(c); });
        return RosterWork.rpc('cadastro_conferir').then(function (conferencia) {
          if (RosterWork.pararCarregando) RosterWork.pararCarregando(confirmar);
          if (!conferencia || !conferencia.success) {
            RosterWork.avisar({ tipo: 'erro', mensagem: (conferencia && conferencia.error) || M.perfil.falhaDados });
            return;
          }
          if (RosterWork.fecharModais) RosterWork.fecharModais();
          RosterWork.avisar({ tipo: 'sucesso', mensagem: r.itens > 0 ? M.perfil.cadastroConferidoComPedido : M.perfil.cadastroConferido });
        });
      })
      .catch(function () { semConexao(confirmar); });
  }

  /* modo conferir: olhar a ficha e achar o erro também é conferir; a correção é feita no Meus dados */
  function corrigir() {
    if (RosterWork.iniciarCarregando) RosterWork.iniciarCarregando(corrigirBotao);
    RosterWork.rpc('cadastro_conferir')
      .then(function (conferencia) {
        if (RosterWork.pararCarregando) RosterWork.pararCarregando(corrigirBotao);
        if (!conferencia || !conferencia.success) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (conferencia && conferencia.error) || RosterWork.mensagens.perfil.falhaDados });
          return;
        }
        restaurar();
        if (RosterWork.fecharModais) RosterWork.fecharModais();
        if (RosterWork.irParaPagina) RosterWork.irParaPagina('perfil', 'dados');
      })
      .catch(function () { semConexao(corrigirBotao); });
  }

  /* abre no modo pedido, com o foco no primeiro item sem valor; sem item vazio, no modo conferir,
     o foco vai para o Confirmar (no rodapé), e a ficha abre do começo */
  function abrir(r, novoModo) {
    aplicarModo(novoModo);
    montar(r);
    var vazio = campos.filter(function (c) { return !c.original; })[0];
    var alvo = vazio ? vazio.el : (modo === 'conferir' ? confirmar : null);
    if (RosterWork.abrirModal) RosterWork.abrirModal('veu-dados-pendentes', alvo);
  }

  /* os campos fixos da janela (a CNH e a colocação) são ligados uma vez; os das datas, a cada montagem */
  function ligarCamposFixos() {
    var cnh = document.getElementById('dados-pendentes-cnh');
    var colocacao = document.getElementById('dados-pendentes-colocacao');
    C().ligarSelecao(cnh, function () { C().limparErro(cnh); revisar(); });
    C().ligarMascara(colocacao, function (d) { return d; });
    colocacao.addEventListener('input', function () { C().limparErro(colocacao); revisar(); });
  }

  /* "Preencher depois" e "Conferir depois": desfaz o que não foi salvo e fecha */
  function fecharDepois() {
    restaurar();
    if (RosterWork.fecharModais) RosterWork.fecharModais();
  }

  function inicializar() {
    veu = document.getElementById('veu-dados-pendentes');
    salvar = document.getElementById('dados-pendentes-salvar');
    confirmar = document.getElementById('dados-pendentes-confirmar');
    corrigirBotao = document.getElementById('dados-pendentes-corrigir');
    var depois = document.getElementById('dados-pendentes-depois');
    var conferirDepois = document.getElementById('dados-pendentes-conferir-depois');
    if (!veu || !salvar || !confirmar || !corrigirBotao || !depois || !conferirDepois || !RosterWork.campos) return;
    ligarCamposFixos();
    depois.addEventListener('click', fecharDepois);
    conferirDepois.addEventListener('click', fecharDepois);
    salvar.addEventListener('click', enviar);
    confirmar.addEventListener('click', confirmarFicha);
    corrigirBotao.addEventListener('click', corrigir);

    /* o navegador avisa se fechar com dados digitados e não salvos */
    if (RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(function () {
        return veu.classList.contains('modal-veu--aberto') && alterados().length > 0;
      });
    }

    if (jaLembrado() || !RosterWork.rpc) return;
    var vez = RosterWork.termos ? RosterWork.termos.liberado : Promise.resolve();
    Promise.all([RosterWork.rpc('dados_pendentes').catch(function () { return null; }), vez])
      .then(function (resultado) {
        var r = resultado[0];
        if (!r || !r.success) return;   // falhou: tenta de novo no próximo carregamento
        marcarLembrado();
        if (!r.conferir) {
          if (r.pendente) abrir(r, 'pendentes');
          return;
        }
        /* sem a ficha não há o que conferir: fica para a próxima entrada (o que falta ainda é pedido) */
        lerFicha().then(function (ficha) {
          if (ficha && ficha.pessoais) {
            preencherFicha(ficha, r);
            abrir(r, 'conferir');
          } else if (r.pendente) {
            abrir(r, 'pendentes');
          }
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
