/* ============================================================
   COMUNICADOS — criar e remover (só administrador)
   "Novo comunicado" abre o painel direito com o DESTINATÁRIO no
   topo (Unidades · Militares · Todos), o título e a mensagem, e
   grava por fn_avisos_criar; a lixeira remove por
   fn_avisos_desativar. Ambas auditam e abrem o resumo. Quem
   chamou recarrega a lista pelo callback onMudou.
   Uma unidade escolhida alcança as unidades abaixo dela.
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function msg() { return (RW.mensagens && RW.mensagens.inicio) || {}; }

  var sujo = false;
  var alcance = 'unidades';
  var unidades = [];      /* ids escolhidos */
  var militares = [];     /* cpfs escolhidos */


  /* mostra só o controle do alcance escolhido */
  function mostrarDestino(raiz) {
    var blocos = raiz.querySelectorAll('[data-destino]');
    for (var i = 0; i < blocos.length; i++) {
      blocos[i].classList.toggle('oculto', blocos[i].getAttribute('data-destino') !== alcance);
    }
  }

  /* ---------- lista de militares (escolha múltipla, com busca) ---------- */
  function montarMilitares(raiz) {
    var lista = raiz.querySelector('#aviso-militares-lista');
    var busca = raiz.querySelector('#aviso-militares-busca');
    var contagem = raiz.querySelector('#aviso-militares-contagem');
    if (!lista) return;

    function revisar() {
      if (!contagem) return;
      contagem.textContent = !militares.length ? 'Nenhum militar escolhido'
        : (militares.length === 1 ? '1 militar escolhido' : militares.length + ' militares escolhidos');
    }

    function filtrar() {
      var termo = (busca && busca.value ? busca.value : '').trim().toLowerCase();
      var linhas = lista.querySelectorAll('.aviso-militar');
      for (var i = 0; i < linhas.length; i++) {
        linhas[i].classList.toggle('oculto', termo !== '' && linhas[i].getAttribute('data-busca').indexOf(termo) < 0);
      }
    }
    if (busca) busca.addEventListener('input', filtrar);

    Promise.all([
      RW.apiFetch('/rest/v1/rpc/buscar_efetivo', { metodo: 'POST', corpo: {} }).then(function (r) { return r.ok ? r.json() : null; }),
      RW.apiFetch('/rest/v1/rpc/buscar_unidades_ordenadas', { metodo: 'POST', corpo: {} }).then(function (r) { return r.ok ? r.json() : null; })
    ])
      .then(function (retorno) {
        var efetivo = retorno[0];
        if (!Array.isArray(efetivo)) { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return; }   // falha: não deixa a lista de destinatários vazia sem aviso
        var nomeDaUnidade = {};
        (Array.isArray(retorno[1]) ? retorno[1] : []).forEach(function (u) { nomeDaUnidade[u.unidade_id] = u.nome; });
        lista.textContent = '';
        (Array.isArray(efetivo) ? efetivo : []).forEach(function (m) {
          var linha = RosterWork.tpl('tpl-aviso-militar');
          if (!linha) return;
          var nome = ((m.grau_abreviacao || '') + ' ' + (m.nome_de_guerra || '')).trim();
          linha.querySelector('.aviso-militar-nome').textContent = nome;
          linha.querySelector('.aviso-militar-unidade').textContent = nomeDaUnidade[m.lotacao_atual] || '';
          linha.setAttribute('data-cpf', m.usuario_id);
          linha.setAttribute('data-busca', (nome + ' ' + (m.nome_completo || '')).toLowerCase());
          linha.addEventListener('click', function () {
            var marcado = linha.getAttribute('aria-checked') !== 'true';
            linha.setAttribute('aria-checked', marcado ? 'true' : 'false');
            linha.querySelector('.caixa-selecao').classList.toggle('caixa-selecao--marcada', marcado);
            var pos = militares.indexOf(m.usuario_id);
            if (marcado && pos < 0) militares.push(m.usuario_id);
            else if (!marcado && pos >= 0) militares.splice(pos, 1);
            sujo = true;
            revisar();
            validar(raiz);
          });
          lista.appendChild(linha);
        });
        revisar();
      })
      .catch(function () { if (RW.avisar) RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao }); });
  }

  /* ---------- seletor de unidades (árvore, escolha múltipla) ---------- */
  function montarUnidades(raiz) {
    if (!RW.seletorUnidades) return;
    var seletor = RW.seletorUnidades.criar({
      modo: 'multi',
      dropdownEl: raiz.querySelector('#aviso-unidades-dropdown'),
      arvoreEl: raiz.querySelector('#aviso-unidades-arvore'),
      textoEl: raiz.querySelector('#aviso-unidades-texto'),
      contagemEl: raiz.querySelector('#aviso-unidades-contagem'),
      btnAplicarEl: raiz.querySelector('#aviso-unidades-aplicar'),
      aoAplicar: function (ids) {
        unidades = ids || [];
        var texto = raiz.querySelector('#aviso-unidades-texto');
        if (texto) texto.classList.toggle('campo-selecao-texto--vazio', !unidades.length);
        sujo = true;
        validar(raiz);
      }
    });
    if (seletor) seletor.montarArvore();
  }

  function destinoPronto() {
    if (alcance === 'todos') return true;
    if (alcance === 'unidades') return unidades.length > 0;
    return militares.length > 0;
  }

  function validar(raiz) {
    var titulo = raiz.querySelector('#aviso-titulo');
    var mensagem = raiz.querySelector('#aviso-mensagem');
    var salvar = raiz.querySelector('#aviso-salvar');
    var ok = titulo && mensagem && titulo.value.trim() !== '' && mensagem.value.trim() !== '' && destinoPronto();
    if (salvar) salvar.disabled = !ok;
    if (titulo && titulo.value) sujo = true;
    if (mensagem && mensagem.value) sujo = true;
  }

  /* abre o painel de criação; grava e chama onMudou no sucesso */
  function abrirNovo(onMudou, pagina) {
    pagina = pagina || 'Início';
    if (!RW.painel) return;
    RW.painel.abrir({ titulo: 'Novo comunicado', aoFechar: function () { sujo = false; } });
    var corpo = RW.painel.corpo();
    var rodape = RW.painel.rodape();
    var tplForm = document.getElementById('tpl-inicio-aviso-form');
    var tplAcoes = document.getElementById('tpl-inicio-aviso-acoes');
    if (corpo && tplForm) corpo.appendChild(tplForm.content.cloneNode(true));
    if (rodape && tplAcoes) { rodape.appendChild(tplAcoes.content.cloneNode(true)); rodape.classList.remove('oculto'); }

    var raiz = document.getElementById('painel');
    if (!raiz) return;
    sujo = false;
    alcance = 'unidades';
    unidades = [];
    militares = [];

    var titulo = raiz.querySelector('#aviso-titulo');
    var mensagem = raiz.querySelector('#aviso-mensagem');
    var salvar = raiz.querySelector('#aviso-salvar');
    var cancelar = raiz.querySelector('#aviso-cancelar');
    var trilho = raiz.querySelector('#aviso-alcance');

    mostrarDestino(raiz);
    montarUnidades(raiz);
    montarMilitares(raiz);

    if (trilho && RW.abas) {
      RW.abas.ligar(trilho, function (aba) {
        alcance = aba.getAttribute('data-valor') || 'unidades';
        mostrarDestino(raiz);
        sujo = true;
        validar(raiz);
      });
    }
    if (titulo) titulo.addEventListener('input', function () { validar(raiz); });
    if (mensagem) mensagem.addEventListener('input', function () { validar(raiz); });
    if (titulo) titulo.focus();
    validar(raiz);

    if (cancelar) cancelar.addEventListener('click', function () {
      if (sujo && RW.confirmar) {
        RW.confirmar({
          tipo: 'aviso', mensagem: msg().descartarAviso,
          textoConfirmar: RW.mensagens.botoes.descartar,
          textoCancelar: RW.mensagens.botoes.continuarEditando,
          aoConfirmar: function () { sujo = false; RW.painel.fechar(); }
        });
      } else { RW.painel.fechar(); }
    });

    if (salvar) salvar.addEventListener('click', function () {
      if (salvar.disabled) return;
      if (RW.iniciarCarregando) RW.iniciarCarregando(salvar);
      RW.apiFetch('/rest/v1/rpc/fn_avisos_criar', {
        metodo: 'POST',
        corpo: {
          p_titulo: titulo.value.trim(),
          p_mensagem: mensagem.value.trim(),
          p_alcance: alcance,
          p_unidades: alcance === 'unidades' ? unidades : null,
          p_militares: alcance === 'militares' ? militares : null
        }
      })
        .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
        .then(function (r) {
          if (RW.pararCarregando) RW.pararCarregando(salvar);
          if (r && r._falha === 'servidor') { RW.avisar && RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return; }
          if (r && r.success) {
            sujo = false;
            RW.painel.fechar();
            if (onMudou) onMudou();
            if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: pagina });
          } else { RW.avisar && RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaSalvarAviso }); }
        })
        .catch(function () { if (RW.pararCarregando) RW.pararCarregando(salvar); RW.avisar && RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
    });

    if (RW.guardaSaida && RW.guardaSaida.registrar) RW.guardaSaida.registrar(function () { return sujo; });
  }

  /* remove (desativa) um comunicado, com confirmação; chama onMudou no sucesso */
  function desativar(avisoId, onMudou, pagina) {
    pagina = pagina || 'Início';
    if (!RW.confirmar) return;
    var u = RosterWork.sessao.perfil();
    RW.confirmar({
      tipo: 'aviso', mensagem: msg().confirmarRemoverAviso,
      textoConfirmar: RW.mensagens.botoes.remover,
      textoCancelar: RW.mensagens.botoes.cancelar,
      aoConfirmar: function () {
        RW.apiFetch('/rest/v1/rpc/fn_avisos_desativar', { metodo: 'POST', corpo: { p_aviso_id: avisoId, p_por: u && u.cpf } })
          .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
          .then(function (r) {
            if (r && r._falha === 'servidor') { RW.avisar && RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.falhaServidor }); return; }
            if (r && r.success) {
              if (onMudou) onMudou();
              if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: pagina });
            } else { RW.avisar && RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaRemoverAviso }); }
          })
          .catch(function () { RW.avisar && RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao }); });
      }
    });
  }

  RW.inicioAviso = { ehAdmin: RosterWork.sessao.ehAdmin, abrirNovo: abrirNovo, desativar: desativar };
})();
