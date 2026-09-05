/* ============================================================
   SELETOR DE UNIDADES — componente compartilhado (fábrica)
   Monta uma árvore de unidades dentro de um dropdown. Dois modos:
     - 'multi' : caixas de seleção + botão Aplicar (filtro do cabeçalho)
     - 'unico' : clicar num item seleciona e fecha (campo de formulário)
   CSS: componentes/css/geral-arvore.css · molde: #tpl-seletor-no
   Instâncias: RosterWork.seletorUnidades.criar(opcoes).
   O init do seletor do cabeçalho (modo multi, com as preferências de
   sessão + o evento rosterwork_units_changed) fica no fim do arquivo.
   ============================================================ */
(function () {
  'use strict';

  /* cache da lista de unidades — todas as instâncias reusam a mesma busca */
  var unidadesCache = null;
  var buscaEmAndamento = null;

  /* busca a hierarquia uma única vez e entrega a todos (Promise) */
  function buscarUnidades() {
    if (unidadesCache) return Promise.resolve(unidadesCache);
    if (buscaEmAndamento) return buscaEmAndamento;
    /* sem sessão TAMBÉM busca: a hierarquia é pública (buscar_unidades_ordenadas
       é SECURITY DEFINER e responde ao anon) porque a tela de Criar conta
       precisa da MESMA árvore de lotação, e quem se cadastra ainda não entrou */
    buscaEmAndamento = RosterWork.apiFetch('/rest/v1/rpc/buscar_unidades_ordenadas', {
      metodo: 'POST',
      corpo: {}
    }).then(function (resp) {
      return resp.ok ? resp.json() : [];
    }).then(function (lista) {
      unidadesCache = Array.isArray(lista) ? lista : [];
      return unidadesCache;
    }).catch(function () {
      return [];
    });
    return buscaEmAndamento;
  }

  /* lista plana -> árvore usando unidade_pai_id */
  function construirArvore(lista) {
    var indice = {};
    var raizes = [];
    var i;
    for (i = 0; i < lista.length; i++) {
      lista[i].filhos = [];
      indice[lista[i].unidade_id] = lista[i];
    }
    for (i = 0; i < lista.length; i++) {
      var item = lista[i];
      if (item.unidade_pai_id && indice[item.unidade_pai_id]) {
        indice[item.unidade_pai_id].filhos.push(item);
      } else {
        raizes.push(item);
      }
    }
    return raizes;
  }

  /* ---------- fábrica de instância ---------- */
  function criar(opcoes) {
    opcoes = opcoes || {};
    var modo = opcoes.modo === 'unico' ? 'unico' : 'multi';
    var arvoreEl = opcoes.arvoreEl;
    var textoEl = opcoes.textoEl;
    var dropdownEl = opcoes.dropdownEl || null;
    var contagemEl = opcoes.contagemEl || null;
    var btnAplicarEl = opcoes.btnAplicarEl || null;

    var nos = [];          /* todos os nós, em lista plana */
    var raizesNos = [];    /* nós do primeiro nível (sanfona do topo) */
    var mapa = {};         /* unidade_id -> nó */
    var selecionados = {}; /* conjunto de unidade_id marcados */

    /* ----- montagem (clona o molde e monta um nó, recursivo) ----- */
    function montarNo(definicao, pai) {
      var tpl = document.getElementById('tpl-seletor-no');
      if (!tpl) return null;
      var el = tpl.content.cloneNode(true).firstElementChild;

      var no = {
        definicao: definicao,
        pai: pai,
        filhos: [],
        elemento: el,
        grupo: el,
        linha: el.querySelector('.arvore-linha'),
        seta: el.querySelector('.arvore-seta'),
        caixa: el.querySelector('.caixa-selecao')
      };

      el.querySelector('.arvore-nome').textContent = definicao.nome;
      el.querySelector('.arvore-detalhe').textContent = definicao.cidade || '';

      /* modo único não usa caixa: ela some e o clique vale na linha inteira */
      if (modo === 'unico') {
        if (no.caixa) no.caixa.classList.add('oculto');
      } else if (no.caixa) {
        no.caixa.setAttribute('aria-label', definicao.nome);
      }

      var filhosContainer = el.querySelector('.arvore-filhos');
      if (definicao.filhos && definicao.filhos.length > 0) {
        for (var i = 0; i < definicao.filhos.length; i++) {
          var filho = montarNo(definicao.filhos[i], no);
          if (filho) {
            no.filhos.push(filho);
            filhosContainer.appendChild(filho.elemento);
          }
        }
      } else {
        /* folha: a seta some (mantém o espaço) e sai da navegação por Tab */
        no.seta.classList.add('arvore-seta--oculta');
        no.seta.removeAttribute('aria-expanded');
      }

      /* seta: expande/recolhe sem mexer na seleção (nos dois modos) */
      no.seta.addEventListener('click', function (e) {
        e.stopPropagation();
        alternarExpansao(no);
      });

      if (modo === 'multi') {
        /* caixa: marca/desmarca só este nó, sem expandir */
        no.caixa.addEventListener('click', function (e) {
          e.stopPropagation();
          alternarSelecao(no);
        });
        /* linha: pais expandem; folhas marcam */
        no.linha.addEventListener('click', function () {
          if (no.filhos.length > 0) {
            alternarExpansao(no);
          } else {
            alternarSelecao(no);
          }
        });
      } else {
        /* modo único: clicar na linha (qualquer nível) seleciona e fecha */
        no.linha.addEventListener('click', function () {
          selecionarUnico(no);
        });
      }

      nos.push(no);
      mapa[definicao.unidade_id] = no;
      return no;
    }

    /* ----- expandir / recolher (sanfona) ----- */
    function recolher(no) {
      no.grupo.classList.remove('arvore-grupo--aberto');
      if (no.filhos.length > 0) no.seta.setAttribute('aria-expanded', 'false');
      for (var i = 0; i < no.filhos.length; i++) recolher(no.filhos[i]);
    }

    function abrirNo(no) {
      no.grupo.classList.add('arvore-grupo--aberto');
      if (no.filhos.length > 0) no.seta.setAttribute('aria-expanded', 'true');
    }

    function alternarExpansao(no) {
      if (no.filhos.length === 0) return;
      /* na lotação (modo único) a raiz (corporação) fica sempre aberta — não recolhe */
      if (modo === 'unico' && !no.pai) return;
      if (no.grupo.classList.contains('arvore-grupo--aberto')) {
        recolher(no);
        return;
      }
      /* sanfona: ao abrir, recolhe os irmãos do mesmo nível */
      var irmaos = no.pai ? no.pai.filhos : raizesNos;
      for (var i = 0; i < irmaos.length; i++) {
        if (irmaos[i] !== no) recolher(irmaos[i]);
      }
      no.grupo.classList.add('arvore-grupo--aberto');
      no.seta.setAttribute('aria-expanded', 'true');
    }

    function abrirCaminhoDosSelecionados() {
      for (var id in selecionados) {
        if (!Object.prototype.hasOwnProperty.call(selecionados, id)) continue;
        var p = mapa[id] ? mapa[id].pai : null;
        while (p) {
          p.grupo.classList.add('arvore-grupo--aberto');
          if (p.filhos.length > 0) p.seta.setAttribute('aria-expanded', 'true');
          p = p.pai;
        }
      }
    }

    /* ao fechar: recolhe tudo e reabre só o caminho do(s) marcado(s) */
    function restaurarArvore() {
      for (var i = 0; i < raizesNos.length; i++) recolher(raizesNos[i]);
      /* a raiz da lotação (modo único) permanece sempre aberta */
      if (modo === 'unico') {
        for (var j = 0; j < raizesNos.length; j++) abrirNo(raizesNos[j]);
      }
      abrirCaminhoDosSelecionados();
    }

    /* ----- seleção MULTI (caminho único; pelotões irmãos somam) ----- */
    function ehAncestral(ancestral, descendente) {
      var p = descendente.pai;
      while (p) {
        if (p === ancestral) return true;
        p = p.pai;
      }
      return false;
    }

    function imporCaminhoUnico(no) {
      var remover = [];
      for (var id in selecionados) {
        if (!Object.prototype.hasOwnProperty.call(selecionados, id)) continue;
        var outro = mapa[id];
        if (!outro || outro === no) continue;
        if (ehAncestral(outro, no)) continue;   /* pai do novo: vira contexto */
        if (ehAncestral(no, outro)) continue;    /* filho do novo: mantém */
        if (no.definicao.tipo === 'PEL' && outro.definicao.tipo === 'PEL' && outro.pai === no.pai) continue;
        remover.push(id);
      }
      for (var i = 0; i < remover.length; i++) delete selecionados[remover[i]];
    }

    function alternarSelecao(no) {
      var id = no.definicao.unidade_id;
      if (selecionados[id]) {
        delete selecionados[id];
      } else {
        selecionados[id] = true;
        imporCaminhoUnico(no);
      }
      atualizarVisual();
    }

    /* estado visual das caixas + contagem (modo multi) */
    function atualizarVisual() {
      var caminho = {};
      for (var id in selecionados) {
        if (!Object.prototype.hasOwnProperty.call(selecionados, id)) continue;
        var p = mapa[id] ? mapa[id].pai : null;
        while (p) {
          caminho[p.definicao.unidade_id] = true;
          p = p.pai;
        }
      }
      for (var i = 0; i < nos.length; i++) {
        var no = nos[i];
        var uid = no.definicao.unidade_id;
        var forte = !!selecionados[uid];
        var noCaminho = !forte && !!caminho[uid];
        if (no.caixa) {
          no.caixa.classList.toggle('caixa-selecao--marcada', forte);
          no.caixa.classList.toggle('caixa-selecao--parcial', noCaminho);
          no.caixa.setAttribute('aria-checked', forte ? 'true' : (noCaminho ? 'mixed' : 'false'));
        }
      }
      var n = contarSelecionados();
      if (contagemEl) {
        contagemEl.textContent = n === 1 ? '1 unidade selecionada' : n + ' unidades selecionadas';
      }
      /* nunca aplicar sem unidade: o botão fica inativo quando nada está marcado */
      if (btnAplicarEl) btnAplicarEl.disabled = (n === 0);
    }

    function contarSelecionados() {
      var n = 0;
      for (var id in selecionados) {
        if (Object.prototype.hasOwnProperty.call(selecionados, id)) n++;
      }
      return n;
    }

    /* ----- seleção ÚNICA (clica e fecha) ----- */
    function selecionarUnico(no) {
      selecionados = {};
      selecionados[no.definicao.unidade_id] = true;
      montarResumo();
      if (window.RosterWork && window.RosterWork.fecharDropdowns) {
        window.RosterWork.fecharDropdowns(null);
      } else if (dropdownEl) {
        dropdownEl.classList.remove('dropdown--aberto');
      }
      if (typeof opcoes.aoSelecionar === 'function') {
        opcoes.aoSelecionar(no.definicao, caminhoTexto(no));
      }
    }

    function caminhoTexto(no) {
      var partes = [];
      var atual = no;
      while (atual) { partes.unshift(atual.definicao.nome); atual = atual.pai; }
      return partes.join(' / ');
    }

    /* ----- resumo no gatilho ----- */
    function profundidade(no) {
      var d = 0;
      var p = no;
      while (p) { d++; p = p.pai; }
      return d;
    }

    function montarResumo() {
      if (!textoEl) return;
      textoEl.textContent = '';

      var sels = [];
      for (var id in selecionados) {
        if (Object.prototype.hasOwnProperty.call(selecionados, id) && mapa[id]) sels.push(mapa[id]);
      }
      if (sels.length === 0) {
        textoEl.textContent = 'Selecione uma unidade';
        return;
      }

      var tpl = document.getElementById('tpl-seletor-trecho');
      function adicionarTrecho(texto, forte) {
        var trecho = tpl.content.cloneNode(true).firstElementChild;
        trecho.textContent = texto;
        if (forte) trecho.classList.add('seletor-trecho--forte');
        textoEl.appendChild(trecho);
      }

      /* modo único: caminho completo do (único) selecionado, último em negrito */
      if (modo === 'unico') {
        var caminhoU = [];
        var atualU = sels[0];
        while (atualU) { caminhoU.unshift(atualU); atualU = atualU.pai; }
        for (var u = 0; u < caminhoU.length; u++) {
          adicionarTrecho(caminhoU[u].definicao.nome, u === caminhoU.length - 1);
        }
        /* cidade da unidade escolhida, após o caminho (visível com o dropdown fechado) */
        var cidadeUnica = sels[0].definicao.cidade;
        var tplCidade = document.getElementById('tpl-seletor-cidade');
        if (cidadeUnica && tplCidade) {
          var elCidade = tplCidade.content.cloneNode(true).firstElementChild;
          elCidade.textContent = cidadeUnica;
          textoEl.appendChild(elCidade);
        }
        return;
      }

      /* modo multi: o selecionado mais profundo define o caminho exibido */
      var maisProfundo = sels[0];
      var maxProf = profundidade(sels[0]);
      for (var i = 1; i < sels.length; i++) {
        var d = profundidade(sels[i]);
        if (d > maxProf) { maxProf = d; maisProfundo = sels[i]; }
      }
      /* quantos marcados há no nível mais profundo (pelotões irmãos) */
      var noNivelMax = 0;
      for (var j = 0; j < sels.length; j++) {
        if (profundidade(sels[j]) === maxProf) noNivelMax++;
      }
      var caminho = [];
      var atual = maisProfundo;
      while (atual) { caminho.unshift(atual); atual = atual.pai; }

      /* mostra só as duas últimas árvores; o que vem antes vira "..." */
      var inicioVisivel = caminho.length > 2 ? caminho.length - 2 : 0;
      if (inicioVisivel > 0) {
        var ocultaMarcada = false;
        for (var o = 0; o < inicioVisivel; o++) {
          if (selecionados[caminho[o].definicao.unidade_id]) { ocultaMarcada = true; break; }
        }
        adicionarTrecho('...', ocultaMarcada);
      }
      for (var k = inicioVisivel; k < caminho.length; k++) {
        var ehUltimo = (k === caminho.length - 1);
        if (ehUltimo && noNivelMax > 1) {
          adicionarTrecho('(' + noNivelMax + ' Pelotões)', true);
        } else {
          adicionarTrecho(caminho[k].definicao.nome, !!selecionados[caminho[k].definicao.unidade_id]);
        }
      }
    }

    /* enquanto busca: "Carregando" + pontos animados (reaproveita #carregando-pontos) */
    function mostrarCarregando() {
      if (!textoEl) return;
      textoEl.textContent = 'Carregando ';
      var tpl = document.getElementById('carregando-pontos');
      if (!tpl) return;
      var pontos = tpl.content.cloneNode(true).firstElementChild;
      if (!pontos) return;
      pontos.setAttribute('aria-hidden', 'true');
      pontos.removeAttribute('aria-label');
      textoEl.appendChild(pontos);
    }

    /* ----- API da instância ----- */
    function idsSelecionados() {
      var ids = [];
      for (var id in selecionados) {
        if (Object.prototype.hasOwnProperty.call(selecionados, id)) ids.push(parseInt(id, 10));
      }
      return ids;
    }

    function aplicarSelecaoPorIds(ids) {
      selecionados = {};
      for (var i = 0; i < ids.length; i++) {
        if (mapa[ids[i]]) selecionados[ids[i]] = true;
      }
      atualizarVisual();
      abrirCaminhoDosSelecionados();
      montarResumo();
    }

    /* busca (se preciso) e desenha a árvore no arvoreEl */
    function montarArvore() {
      return buscarUnidades().then(function (lista) {
        if (!lista || lista.length === 0) return;
        var raizes = construirArvore(lista);
        nos = [];
        raizesNos = [];
        mapa = {};
        if (arvoreEl) arvoreEl.textContent = '';
        for (var i = 0; i < raizes.length; i++) {
          var raiz = montarNo(raizes[i], null);
          if (raiz) {
            raizesNos.push(raiz);
            if (arvoreEl) arvoreEl.appendChild(raiz.elemento);
          }
        }
        /* na lotação (modo único), a raiz já começa expandida (e não recolhe) */
        if (modo === 'unico') {
          for (var r = 0; r < raizesNos.length; r++) abrirNo(raizesNos[r]);
        }
      });
    }

    /* ao fechar o dropdown, restaura a árvore (recolhe e reabre o caminho marcado) */
    if (dropdownEl) {
      var observador = new MutationObserver(function () {
        if (!dropdownEl.classList.contains('dropdown--aberto')) restaurarArvore();
      });
      observador.observe(dropdownEl, { attributes: true, attributeFilter: ['class'] });
    }

    /* botão Aplicar (modo multi) */
    if (btnAplicarEl) {
      btnAplicarEl.addEventListener('click', function () {
        montarResumo();
        if (typeof opcoes.aoAplicar === 'function') opcoes.aoAplicar(idsSelecionados());
        if (window.RosterWork && window.RosterWork.fecharDropdowns) {
          window.RosterWork.fecharDropdowns(null);
        }
      });
    }

    return {
      montarArvore: montarArvore,
      mostrarCarregando: mostrarCarregando,
      montarResumo: montarResumo,
      idsSelecionados: idsSelecionados,
      aplicarSelecaoPorIds: aplicarSelecaoPorIds,
      unidadeSelecionada: function () {
        var lista = idsSelecionados();
        return lista.length ? lista[0] : null;
      }
    };
  }

  /* ---------- seletor do cabeçalho (modo multi, específico do shell) ---------- */
  function salvarPreferencias(ids) {
    var prefs = null;
    try { prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}
    prefs = prefs || {};
    prefs.unidades_selecionadas = ids;
    sessionStorage.setItem('rosterwork_preferencias', JSON.stringify(prefs));
  }

  /* a seleção do cabeçalho vale só para a sessão: começa na lotação a cada login,
     sobrevive a F5/navegação (sessionStorage) e some no logout — nunca vai ao banco */
  function inicializarCabecalho() {
    var dropdownEl = document.getElementById('dropdown-unidades');
    var textoEl = document.getElementById('seletor-unidades-texto');
    var arvoreEl = document.getElementById('arvore-seletor');
    if (!dropdownEl || !textoEl || !arvoreEl) return;

    var inst = criar({
      modo: 'multi',
      dropdownEl: dropdownEl,
      textoEl: textoEl,
      arvoreEl: arvoreEl,
      contagemEl: document.getElementById('seletor-contagem'),
      btnAplicarEl: document.getElementById('btn-aplicar-unidades'),
      aoAplicar: function (ids) {
        salvarPreferencias(ids);
        /* avisa as páginas (usuários, escalas...) que a seleção aplicada mudou */
        window.dispatchEvent(new CustomEvent('rosterwork_units_changed'));
      }
    });

    inst.mostrarCarregando();
    inst.montarArvore().then(function () {
      var prefs = null;
      try { prefs = JSON.parse(sessionStorage.getItem('rosterwork_preferencias')); } catch (e) {}
      if (prefs && prefs.unidades_selecionadas && prefs.unidades_selecionadas.length > 0) {
        inst.aplicarSelecaoPorIds(prefs.unidades_selecionadas);
      } else {
        var perfil = null;
        try { perfil = JSON.parse(sessionStorage.getItem('rosterwork_user')); } catch (e) {}
        if (perfil && perfil.lotacao_id) {
          inst.aplicarSelecaoPorIds([perfil.lotacao_id]);
        } else {
          inst.montarResumo();
        }
      }
    });

    /* expõe a instância do cabeçalho, caso alguma página precise consultá-la */
    window.RosterWork.seletorUnidadesCabecalho = inst;
  }

  window.RosterWork = window.RosterWork || {};
  window.RosterWork.seletorUnidades = { criar: criar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCabecalho);
  } else {
    inicializarCabecalho();
  }
})();
