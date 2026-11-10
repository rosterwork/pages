/* ============================================================
   TREINO › LIVRE — o treino livre (RosterWork.treinoLivre)
   O modo treino ligado, sem o passo a passo: a pessoa mexe à vontade
   em qualquer tela que o papel dela vê, e nada é gravado
   (geral-treino.js). Três entradas: o botão da barra azul
   (.treino-barra-livre) e o link do balão do fim do treino
   (.guia-balao-livre), na mesma tela, com o painel, o rascunho e o
   exemplo do treino; e a linha da lista do Treinamento (entrar()), que
   leva à Escala, sem exemplo. Na Extrajornada, o treino livre fica
   sempre no mês de treino (geral-treino-extra.js).
   A barra acompanha a página (o <h1> dela). O Recomeçar o treino volta
   ao passo 1 do treino de onde a pessoa saiu. No ?, o treino escolhido
   começa do passo 1, com a tela limpa.
   Vale para todo o modo treino a marca da sessão (sessionStorage,
   rosterwork_treino): quem recarrega a página continua no treino livre,
   com os dados de verdade e o mês de treino de volta aos Pedidos; no
   treino com passo a passo, volta à lista,
   na linha dele. O tema, as unidades, o tamanho dos calendários e o
   Tamanho da tela do celular de quando o modo ligou voltam ao sair
   (soltar).
   API: entrar(), guardar(livre, id), soltar().
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  var CHAVE = 'rosterwork_treino';   // a marca: { cpf, livre, id, tema, unidades, tamanhos }
  var PREFERENCIAS = 'rosterwork_preferencias';

  function ler(chave) { try { return JSON.parse(sessionStorage.getItem(chave)) || null; } catch (e) { return null; } }
  function gravar(chave, valor) { try { sessionStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {} }
  function esquecer() { try { sessionStorage.removeItem(CHAVE); } catch (e) {} }
  function perfil() { return RW.sessao ? RW.sessao.perfil() : null; }

  /* o tamanho dos calendários (computador e celular) e o Tamanho da tela do celular, como estão nas preferências */
  function tamanhosDe(prefs) {
    var visao = prefs.escala_visao || {};
    return { tamanho: visao.tamanho == null ? null : visao.tamanho, tamanho_celular: visao.tamanho_celular == null ? null : visao.tamanho_celular,
      tela_celular: prefs.tela_celular || null };
  }

  /* ---------- a marca da sessão ---------- */
  /* o tema, as unidades e os tamanhos guardados são os de quando o modo ligou */
  function guardar(livre, id) {
    var marca = ler(CHAVE), prefs = ler(PREFERENCIAS) || {}, quem = perfil();
    gravar(CHAVE, {
      cpf: quem ? quem.cpf : null, livre: livre, id: id,
      tema: marca ? marca.tema : (prefs.tema || null),
      unidades: marca ? marca.unidades : (prefs.unidades_selecionadas || null),
      tamanhos: marca && marca.tamanhos ? marca.tamanhos : tamanhosDe(prefs)
    });
  }
  /* saiu do modo: a marca some, e o tema, as unidades e os tamanhos voltam */
  function soltar() {
    var marca = ler(CHAVE);
    if (!marca) return;
    esquecer();
    var prefs = ler(PREFERENCIAS) || {}, quem = perfil();
    var temaMudou = (prefs.tema || null) !== marca.tema;
    var unidadesMudaram = JSON.stringify(prefs.unidades_selecionadas || null) !== JSON.stringify(marca.unidades);
    var tamanhosMudaram = !!marca.tamanhos && JSON.stringify(tamanhosDe(prefs)) !== JSON.stringify(marca.tamanhos);
    if (!temaMudou && !unidadesMudaram && !tamanhosMudaram) return;
    prefs.tema = marca.tema;
    prefs.unidades_selecionadas = marca.unidades;
    if (tamanhosMudaram) {
      var t = marca.tamanhos, visao = prefs.escala_visao || {};
      ['tamanho', 'tamanho_celular'].forEach(function (chave) {
        if (t[chave] == null) delete visao[chave]; else visao[chave] = t[chave];
      });
      prefs.escala_visao = visao;
      if (t.tela_celular == null) delete prefs.tela_celular; else prefs.tela_celular = t.tela_celular;
    }
    gravar(PREFERENCIAS, prefs);
    if (temaMudou && RW.tema) RW.tema.aplicar();
    if (unidadesMudaram && RW.seletorUnidadesCabecalho) {
      RW.seletorUnidadesCabecalho.aplicarSelecaoPorIds(marca.unidades || (quem && quem.lotacao_id ? [quem.lotacao_id] : []));
    }
    if (tamanhosMudaram) {
      if (RW.tamanhoTela) RW.tamanhoTela.aplicar();
      if (RW.calendarioTamanho) RW.calendarioTamanho.aplicarGuardado();
    }
  }
  /* recarregou a página. A marca de outra pessoa, nesta aba, não vale */
  function aoCarregar() {
    var marca = ler(CHAVE), quem = perfil();
    if (!marca) return;
    if (!quem || marca.cpf !== quem.cpf) { esquecer(); return; }
    if (marca.livre) { RW.treino.continuarLivre(marca.id); return; }
    soltar();
    RW.treino.pedirLinha(marca.id);
    history.replaceState(null, '', '?pagina=treinamento');
  }

  /* ---------- a barra acompanha a página ---------- */
  function escreverPagina() {
    var titulo = document.querySelector('.conteudo > .pagina h1');
    var barra = document.querySelector('.treino-barra');
    if (!RW.treino.livre() || !titulo || !barra) return;
    Array.prototype.forEach.call(barra.querySelectorAll('.treino-barra-pagina-nome'), function (el) { el.textContent = titulo.textContent.trim(); });
  }
  function vigiarPaginas() {
    var conteudo = document.querySelector('.conteudo');
    if (conteudo && window.MutationObserver) new MutationObserver(escreverPagina).observe(conteudo, { childList: true });
  }

  /* ---------- as entradas ---------- */
  /* a linha da lista: sem treino nenhum, na Escala */
  function entrar() {
    RW.treino.entrarLivre(true);
    if (RW.irParaPagina) RW.irParaPagina('escalas');
  }

  document.addEventListener('click', function (evento) {
    var alvo = evento.target;
    if (!alvo.closest) return;
    if (alvo.closest('.treino-barra-livre, .guia-balao-livre')) { RW.treino.entrarLivre(false); escreverPagina(); return; }
    if (RW.treino.livre() && alvo.closest('.treino-barra-recomecar')) RW.treino.seguir(RW.treino.ultimo());
  });

  /* no ?, o treino escolhido começa do passo 1, com a tela limpa (na captura da janela, antes do geral-guia.js, que começaria dali) */
  window.addEventListener('click', function (evento) {
    var item = RW.treino.livre() && evento.target.closest ? evento.target.closest('.guia-menu-item') : null;
    if (!item) return;
    evento.stopImmediatePropagation();
    if (RW.fecharDropdowns) RW.fecharDropdowns();
    RW.treino.seguir(item.getAttribute('data-guia'));
  }, true);

  RW.treinoLivre = { entrar: entrar, guardar: guardar, soltar: soltar };

  aoCarregar();
  vigiarPaginas();
})();
