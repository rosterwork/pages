/* ============================================================
   DISTRIBUIÇÃO — aba Modelos (visualização)
   Painel esquerdo (lista de modelos por composição) + corpo (vagas do
   modelo selecionado, agrupadas por unidade, com acúmulo espelhado) +
   rodapé (status). Edição entra na Rodada 2.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var grupo = null;      /* { cia, unidades:[{unidade_id, nome, tipo, ...}] } */
  var modelos = [];      /* retorno de dist_listar_modelos */
  var selId = null;      /* id_grupo_completo selecionado */
  var seqCarregar = 0;   /* token da lista: ignora resposta antiga ao trocar de unidade rápido */


  /* RASCUNHO: um modelo recém-criado que ainda NÃO foi confirmado com Salvar. Fica marcado na sessão
     (por aba); se o usuário não salvar (cancelar, sair ou atualizar), ele é excluído. */
  var RASCUNHO_KEY = 'rosterwork_modelo_rascunho';
  function rascunhoId() { try { return sessionStorage.getItem(RASCUNHO_KEY); } catch (e) { return null; } }
  function marcarRascunho(id) { try { sessionStorage.setItem(RASCUNHO_KEY, id); } catch (e) {} }
  function limparRascunho() { try { sessionStorage.removeItem(RASCUNHO_KEY); } catch (e) {} }
  function excluirRascunho() {
    var id = rascunhoId();
    if (!id) return Promise.resolve();
    limparRascunho();   /* limpa a marca ANTES do async, para não tentar excluir duas vezes */
    return RosterWork.distribuicaoDados.excluirModelo(id, RosterWork.sessao.cpf()).catch(function () {});
  }

  function unidadeDoGrupo(id) {
    for (var i = 0; i < grupo.unidades.length; i++) {
      if (grupo.unidades[i].unidade_id === id) return grupo.unidades[i];
    }
    return null;
  }

  /* ---- CATÁLOGO DE ERROS da distribuição: a LISTA ÚNICA que define cada erro (código · domínio ·
     severidade). É a "fonte única": `problemasDaUnidade` decide a severidade lendo daqui, e ninguém
     mais decide por conta própria. A MENSAGEM de cada erro fica em geral-mensagens (ligada pelo código).
     Os erros do domínio ESCALA (travar por distribuição vermelha, rebaixou grau, etc.) entram no mesmo
     padrão nas etapas seguintes. ---- */
  var CATALOGO_ERROS = {
    falta_vaga:        { dominio: 'distribuicao', nivel: 'erro' },
    vaga_a_mais:       { dominio: 'distribuicao', nivel: 'erro' },
    excesso_envio:     { dominio: 'distribuicao', nivel: 'erro' },
    falta_papel:       { dominio: 'distribuicao', nivel: 'erro' },
    vaga_sem_criterio: { dominio: 'distribuicao', nivel: 'erro' },
    posto_vazio:       { dominio: 'distribuicao', nivel: 'alerta' }
  };

  /* problemas de UMA unidade → [{codigo, nivel, texto}]. É o ÚNICO lugar do FRONTEND que checa as
     condições; o `validar` (rodapé) e o `unidadeNivel` (cor) usam ele — assim nunca divergem entre si.
     ⚠️ AMARRAÇÃO: estas regras DEVEM ser IDÊNTICAS às do juiz do banco `dist_validar_modelo` (o juiz é
     a autoridade — o motor e o salvar obedecem ele; esta cópia existe só para o feedback INSTANTÂNEO da
     tela). Mudou uma regra aqui → mude lá também. O teste `scratchpad/verificar-etapa3.mjs` quebra se
     divergirem. */
  function problemasDaUnidade(u) {
    var M = RosterWork.mensagens.distribuicao;
    var ud = unidadeDoGrupo(u.unidade_id);
    var nome = ud ? ud.nome : '';
    var tipo = ud ? ud.tipo : '';
    var lista = [];
    var add = function (codigo, texto) { lista.push({ codigo: codigo, nivel: CATALOGO_ERROS[codigo].nivel, texto: texto }); };
    if ((u.vagas_pracas || 0) < (u.pracas || 0)) add('falta_vaga', M.faltaVagas(nome, u.vagas_pracas || 0, u.pracas || 0, 'praças'));
    if ((u.vagas_oficiais || 0) < (u.oficiais || 0)) add('falta_vaga', M.faltaVagas(nome, u.vagas_oficiais || 0, u.oficiais || 0, 'oficiais'));
    if ((u.pracas || 0) < 0 || (u.oficiais || 0) < 0) add('excesso_envio', M.excessoEnvio(nome));   /* reforço demais */
    if ((tipo === 'CIA' || tipo === 'CIBM') && (u.oficiais || 0) > 0 && !u.tem_oficial_area) add('falta_papel', M.semPapel(nome, 'Oficial de Área'));
    if (tipo === 'PEL' && (u.pracas || 0) > 0 && !u.tem_chefe_socorro) add('falta_papel', M.semPapel(nome, 'Chefe de Socorro'));
    /* posto sem efetivo (amarelo): detalhado quando há os nomes (Ver/Editar), genérico no painel */
    if (u.postosVazios && u.postosVazios.length) u.postosVazios.forEach(function (pv) { add('posto_vazio', M.postoVazio(nome, pv)); });
    else if (u.tem_posto_vazio) add('posto_vazio', M.postoVazioUnidade(nome));
    (u.semCriterio || []).forEach(function (posto) { add('vaga_sem_criterio', M.vagaSemCriterio(nome, posto)); });
    if ((u.pracas || 0) >= 0 && (u.vagas_pracas || 0) > (u.pracas || 0)) add('vaga_a_mais', M.excessoVagas(nome, u.vagas_pracas || 0, u.pracas || 0, 'praças'));
    if ((u.oficiais || 0) >= 0 && (u.vagas_oficiais || 0) > (u.oficiais || 0)) add('vaga_a_mais', M.excessoVagas(nome, u.vagas_oficiais || 0, u.oficiais || 0, 'oficiais'));
    return lista;
  }

  /* validação (front): junta os problemas de cada unidade — usada no painel e no rodapé */
  function validar(unidades) {
    var itens = [];
    (unidades || []).forEach(function (u) { itens = itens.concat(problemasDaUnidade(u)); });
    return { nivel: nivelStatus(itens), itens: itens };
  }

  /* nível de UMA unidade (erro > alerta > null) — para a cor do cabeçalho e das células da lista */
  function unidadeNivel(u) {
    var n = nivelStatus(problemasDaUnidade(u));
    return n === 'ok' ? null : n;
  }
  /* status visual por unidade e por posto (mesma fonte do rodapé), para os marcadores.
     devolve { unidades:{id:nivel}, postos:{id:{nome:nivel}} }; vermelho vence amarelo */
  function statusVisual(contagem) {
    var res = { unidades: {}, postos: {} };
    (contagem || []).forEach(function (c) {
      res.unidades[c.unidade_id] = unidadeNivel(c);
      var mp = {};
      (c.postosVazios || []).forEach(function (nome) { mp[nome] = 'alerta'; });
      res.postos[c.unidade_id] = mp;
    });
    return res;
  }
  /* aplica o status (erro/alerta) como classe modificadora no elemento (faixa do pelotão ou o posto) */
  function marcar(el, base, nivel) {
    if (!el || !nivel) return;
    el.classList.add(base + '--' + nivel);
  }

  /* pede confirmação ao editor antes de abandonar uma edição não salva (ou segue direto) */
  function pedirSaida(aoSair) {
    if (RosterWork.distribuicaoEditar && RosterWork.distribuicaoEditar.confirmarSaida) RosterWork.distribuicaoEditar.confirmarSaida(aoSair);
    else aoSair();
  }

  /* ---- painel: lista de modelos ---- */
  function unidadeDados(unidades, unidadeId) {
    for (var i = 0; i < unidades.length; i++) {
      if (unidades[i].unidade_id === unidadeId) return unidades[i];
    }
    return null;
  }

  /* pinta o status de UM modelo na lista ao vivo (o editor chama a cada mudança): repinta só o ícone
     geral e a cor de cada célula, com a MESMA regra do rodapé (validar/unidadeNivel). Ao cancelar, o
     recarregar da lista repõe o estado salvo. Modelo novo (sem linha) é ignorado. */
  function atualizarStatusModelo(modeloId, unidades) {
    var linha = document.querySelector('#distribuicao-lista-modelos [data-modelo-id="' + modeloId + '"]');
    if (!linha || !grupo) return;
    var st = validar(unidades);
    var temErro = st.nivel !== 'ok';
    var sEl = linha.querySelector('.distribuicao-modelo-status');
    var ok = linha.querySelector('.distribuicao-modelo-ok');
    var er = linha.querySelector('.distribuicao-modelo-erro');
    if (ok) ok.classList.toggle('oculto', temErro);
    if (er) er.classList.toggle('oculto', !temErro);
    if (sEl) {
      sEl.classList.remove('distribuicao-modelo-status--erro', 'distribuicao-modelo-status--alerta');
      if (temErro) sEl.classList.add(st.nivel === 'erro' ? 'distribuicao-modelo-status--erro' : 'distribuicao-modelo-status--alerta');
    }
    /* as células seguem a ordem de grupo.unidades (igual ao renderPainel) */
    var celulas = linha.querySelectorAll('.distribuicao-modelo-celula');
    grupo.unidades.forEach(function (u, i) {
      var cel = celulas[i];
      if (!cel) return;
      var d = unidadeDados(unidades, u.unidade_id);
      var niv = d ? unidadeNivel(d) : null;
      cel.classList.remove('distribuicao-modelo-celula--erro', 'distribuicao-modelo-celula--alerta');
      if (niv) cel.classList.add('distribuicao-modelo-celula--' + niv);
    });
  }

  function renderPainel() {
    var lista = document.getElementById('distribuicao-lista-modelos');
    if (!lista) return;
    lista.textContent = '';
    if (!modelos.length) {
      var est = RosterWork.tpl('tpl-distribuicao-estado');
      if (est) { est.textContent = RosterWork.mensagens.distribuicao.semModelos; lista.appendChild(est); }
      return;
    }
    modelos.forEach(function (m) {
      var linha = RosterWork.tpl('tpl-distribuicao-modelo');
      if (!linha) return;
      linha.setAttribute('data-modelo-id', m.id_grupo_completo);
      var st = validar(m.unidades);
      if (st.nivel !== 'ok') {
        var sEl = linha.querySelector('.distribuicao-modelo-status');
        var ok = linha.querySelector('.distribuicao-modelo-ok');
        var er = linha.querySelector('.distribuicao-modelo-erro');
        if (ok) ok.classList.add('oculto');
        if (er) er.classList.remove('oculto');
        if (sEl) sEl.classList.add(st.nivel === 'erro' ? 'distribuicao-modelo-status--erro' : 'distribuicao-modelo-status--alerta');
      }
      var celulas = linha.querySelector('.distribuicao-modelo-celulas');
      grupo.unidades.forEach(function (u) {
        var cel = RosterWork.tpl('tpl-distribuicao-modelo-celula');
        if (!cel) return;
        var d = unidadeDados(m.unidades, u.unidade_id);
        cel.querySelector('.distribuicao-modelo-celula-texto').textContent = d ? (d.oficiais || 0) + '·' + (d.pracas || 0) : '–';
        /* ícone de acúmulo entre unidades quando a unidade está fundida com outra (item 13) */
        if (d && d.acumulada) cel.querySelector('.distribuicao-modelo-celula-acumulo').classList.remove('oculto');
        /* cor do texto da célula pelo erro/alerta DAQUELA unidade (só a unidade com erro fica colorida) */
        var nivCel = d ? unidadeNivel(d) : null;
        if (nivCel) cel.classList.add('distribuicao-modelo-celula--' + nivCel);
        celulas.appendChild(cel);
      });
      if (m.id_grupo_completo === selId) linha.classList.add('lista-item--ativo');
      var area = linha.querySelector('.distribuicao-modelo-area');
      if (area) area.addEventListener('click', function () { pedirSaida(function () { selecionar(m.id_grupo_completo); }); });
      var menu = linha.querySelector('.distribuicao-modelo-menu');
      if (menu) {
        if (RosterWork.sessao.ehAdmin()) {
          var itens = menu.querySelectorAll('.dropdown-item');
          if (itens[0]) itens[0].addEventListener('click', function () { pedirSaida(function () { editarModelo(m.id_grupo_completo); }); });
          if (itens[1]) itens[1].addEventListener('click', function () { pedirSaida(function () { if (RosterWork.distribuicaoCriar) RosterWork.distribuicaoCriar.excluir(m.id_grupo_completo); }); });
        } else {
          menu.classList.add('oculto');
        }
      }
      lista.appendChild(linha);
    });
  }

  function marcarAtivo() {
    var linhas = document.querySelectorAll('.distribuicao-modelo');
    for (var i = 0; i < linhas.length; i++) {
      linhas[i].classList.toggle('lista-item--ativo', linhas[i].getAttribute('data-modelo-id') === selId);
    }
  }

  /* mostra o giratório (clona o template) num container; o render seguinte o substitui (padrão do escalas) */
  function carregandoEm(el) {
    if (!el) return;
    el.textContent = '';
    var c = RosterWork.tpl('tpl-distribuicao-carregando');
    if (c) el.appendChild(c);
  }

  /* mostra estado de falha no corpo (a RPC não respondeu) em vez de travar o giratório */
  function erroCorpo() {
    var corpo = document.getElementById('distribuicao-corpo');
    if (!corpo) return;
    corpo.textContent = '';
    var est = RosterWork.tpl('tpl-distribuicao-estado');
    if (est) { est.textContent = RosterWork.mensagens.distribuicao.falhaCarregar; corpo.appendChild(est); }
  }

  /* mostra estado de falha na lista (a RPC não respondeu) em vez de fingir "sem modelos" */
  function erroLista() {
    var alvo = document.getElementById('distribuicao-lista-modelos');
    if (!alvo) return;
    alvo.textContent = '';
    var est = RosterWork.tpl('tpl-distribuicao-estado');
    if (est) { est.textContent = RosterWork.mensagens.distribuicao.falhaCarregar; alvo.appendChild(est); }
  }

  /* ---- corpo: vagas do modelo selecionado ---- */
  function selecionar(id) {
    selId = id;
    marcarAtivo();
    if (RosterWork.distribuicaoEditar && RosterWork.distribuicaoEditar.mostrarHistorico) RosterWork.distribuicaoEditar.mostrarHistorico(false);   /* Ver: sem desfazer/refazer */
    carregandoEm(document.getElementById('distribuicao-corpo'));
    RosterWork.distribuicaoDados.lerModelo(id).then(function (dados) {
      if (selId !== id) return;                /* resposta obsoleta: outro modelo já foi aberto */
      if (!dados) { erroCorpo(); return; }     /* RPC falhou: mostra erro, não deixa o giratório preso */
      var m = modelos.filter(function (x) { return x.id_grupo_completo === id; })[0];
      var comp = {};
      ((m && m.unidades) || []).forEach(function (cu) { comp[cu.unidade_id] = { oficiais: cu.oficiais, pracas: cu.pracas }; });
      var contagem = contarUnidades(dados.unidades, comp);
      renderCorpo(dados, statusVisual(contagem), contagem);   /* clicar = VER (read-only), para todos */
      renderRodape({ itens: validar(contagem).itens });
    }).catch(erroCorpo);
  }

  /* admin: "Editar" no menu ⋯ abre o modo de edição */
  function editarModelo(id) {
    selId = id;
    marcarAtivo();
    carregandoEm(document.getElementById('distribuicao-corpo'));
    RosterWork.distribuicaoDados.lerModelo(id).then(function (dados) {
      if (selId !== id) return;                /* resposta obsoleta */
      if (!dados) { erroCorpo(); return; }     /* RPC falhou */
      var m = modelos.filter(function (x) { return x.id_grupo_completo === id; })[0];
      if (RosterWork.distribuicaoEditar) RosterWork.distribuicaoEditar.abrir(grupo, m, dados);
    }).catch(erroCorpo);
  }

  /* recarrega a lista e reabre o modelo atual em modo VER (descarta a edição em curso) */
  function recarregar() {
    var id = selId;
    return carregar(grupo).then(function () { if (id) selecionar(id); });
  }

  /* numera os postos (1,2,3…) e as vagas (P.V) na ordem de exibição; mapeia id_slot */
  function indexar(dados) {
    var mapa = {};
    (dados.unidades || []).forEach(function (u) {
      (u.postos || []).forEach(function (p) {
        (p.vagas || []).forEach(function (vg) { mapa[vg.id_slot] = vg; });
      });
    });
    var nPosto = 0;
    (dados.unidades || []).forEach(function (u) {
      (u.postos || []).forEach(function (p) {
        nPosto++;
        p._num = nPosto;
        var v = 0;
        (p.vagas || []).forEach(function (vg) {
          if (secundariaMesmoPosto(p, vg, mapa)) { vg._pv = ''; return; }   /* linha mesclada: sem número próprio */
          v++; vg._pv = nPosto + '.' + v;
        });
      });
    });
    return mapa;
  }

  function renderCorpo(dados, status, contagem) {
    var corpo = document.getElementById('distribuicao-corpo');
    if (!corpo) return;
    corpo.textContent = '';
    if (!dados || !dados.unidades || !dados.unidades.length) {
      var est = RosterWork.tpl('tpl-distribuicao-estado');
      if (est) { est.textContent = RosterWork.mensagens.distribuicao.modeloVazio; corpo.appendChild(est); }
      return;
    }
    var contPorUnidade = {};
    (contagem || []).forEach(function (c) { contPorUnidade[c.unidade_id] = c; });
    var mapaSlots = indexar(dados);
    dados.unidades.forEach(function (u) {
      var sec = RosterWork.tpl('tpl-distribuicao-unidade');
      if (!sec) return;
      sec.querySelector('.distribuicao-unidade-nome').textContent = u.nome || '';
      var cab = sec.querySelector('.distribuicao-unidade-cabecalho');
      marcar(cab, 'distribuicao-unidade-cabecalho', status && status.unidades[u.unidade_id]);
      preencherContagem(cab, contPorUnidade[u.unidade_id]);
      cab.addEventListener('click', function () {
        cab.setAttribute('aria-expanded', cab.getAttribute('aria-expanded') === 'false' ? 'true' : 'false');
      });
      var corpoSec = sec.querySelector('.distribuicao-unidade-corpo');
      var postosStatus = (status && status.postos[u.unidade_id]) || {};
      (u.postos || []).forEach(function (p) { corpoSec.appendChild(renderPosto(p, mapaSlots, postosStatus)); });
      renderVemDeVer(u, corpoSec);   /* bloco de reforço (só-leitura) */
      corpo.appendChild(sec);
    });
  }

  function renderPosto(p, mapaSlots, postosStatus) {
    var el = RosterWork.tpl('tpl-distribuicao-posto');
    el.querySelector('.distribuicao-posto-numero').textContent = p._num;
    el.querySelector('.distribuicao-posto-nome-texto').textContent = p.nome || '';
    marcar(el, 'distribuicao-posto', postosStatus && postosStatus[p.nome || '']);
    if (p.tipo === 'viatura') {
      var uso = el.querySelector('.distribuicao-posto-icone use');
      if (uso) uso.setAttribute('href', 'icones/icone-viatura.svg#icone-viatura');
      el.querySelector('.distribuicao-posto-cnh').textContent = p.cnh ? 'CNH ' + p.cnh : '';
    }
    /* posto sem funções distribuídas: texto no lugar da tabela de vagas */
    if (!(p.vagas && p.vagas.length)) {
      var vagasEl = el.querySelector('.distribuicao-posto-vagas');
      var vazio = RosterWork.tpl('tpl-distribuicao-posto-vazio');
      if (vagasEl && vazio) vagasEl.replaceWith(vazio);
      return el;
    }
    var linhas = el.querySelector('.distribuicao-vagas-linhas');
    (p.vagas || []).forEach(function (vg) {
      if (secundariaMesmoPosto(p, vg, mapaSlots)) return;   /* Chefe/OA + Condutor da mesma viatura: uma linha só */
      linhas.appendChild(renderVaga(vg, mapaSlots, p));
    });
    return el;
  }

  /* bloco de reforço no modo Ver (só-leitura): origem · tipo · antiguidade/grau · rodízio */
  function renderVemDeVer(u, corpoSec) {
    if (!u || !u.vem_de || !u.vem_de.length) return;
    var bloco = RosterWork.tpl('tpl-distribuicao-reforco-bloco');
    if (!bloco) return;
    var linhas = bloco.querySelector('.distribuicao-vagas-linhas');
    u.vem_de.forEach(function (r, i) {
      var el = RosterWork.tpl('tpl-distribuicao-reforco-ver');
      if (!el) return;
      el.querySelector('.distribuicao-vaga-num').textContent = String(i + 1);
      var ud = unidadeDoGrupo(r.origem_unidade_id);
      el.querySelector('.distribuicao-reforco-origem .distribuicao-cel-texto').textContent = ud ? ud.nome : '';
      el.querySelector('.distribuicao-vaga-perfil').textContent = r.tipo_contador === 'Oficiais' ? 'Oficial' : 'Praça';
      el.querySelector('.distribuicao-vaga-antig').textContent = r.ordem ? (r.ordem + 'º mais ' + (r.ordem_sentido === 'moderno' ? 'moderno' : 'antigo')) : '';
      el.querySelector('.distribuicao-vaga-grau').textContent = r.ideal ? (r.ideal + (r.ideal_calc === '+' ? ' ou +' : (r.ideal_calc === '-' ? ' ou -' : ''))) : '';
      if (r.rodizio) { var ic = el.querySelector('.distribuicao-vaga-rod .icone'); if (ic) ic.classList.remove('oculto'); }
      linhas.appendChild(el);
    });
    corpoSec.appendChild(bloco);
  }

  /* grupo de acúmulo do slot: [principal, …dependentes] (principal = 1ª posição) */
  function grupoAcumulo(vg, mapaSlots) {
    var principal = vg.acumulo_slot_id && mapaSlots[vg.acumulo_slot_id] ? mapaSlots[vg.acumulo_slot_id] : vg;
    var deps = [];
    for (var id in mapaSlots) {
      if (Object.prototype.hasOwnProperty.call(mapaSlots, id) && mapaSlots[id].acumulo_slot_id === principal.id_slot) {
        deps.push(mapaSlots[id]);
      }
    }
    deps.sort(function (a, b) { return (a._pv || '').localeCompare(b._pv || ''); });
    return [principal].concat(deps);
  }

  /* acúmulo DENTRO da mesma viatura (Chefe/OA + Condutor do próprio posto): a linha do Condutor
     mescla na do papel especial — sem linha própria nem cadeira na numeração do efetivo */
  function secundariaMesmoPosto(p, vg, mapaSlots) {
    if (!vg.acumulo_slot_id) return false;
    var principal = mapaSlots[vg.acumulo_slot_id];
    return !!principal && (p.vagas || []).indexOf(principal) >= 0;
  }
  function numeroCadeiraVer(p, vg, mapaSlots) {
    var n = 0, vagas = p.vagas || [];
    for (var i = 0; i < vagas.length; i++) {
      if (secundariaMesmoPosto(p, vagas[i], mapaSlots)) continue;
      n++;
      if (vagas[i] === vg) return n;
    }
    return n;
  }
  /* renumera "Efetivo N" pela cadeira visível (Condutor mesclado → Efetivo 3 vira 2) */
  function nomeExibirVer(p, vg, mapaSlots) {
    if (p && p.tipo === 'viatura' && (p.vagas || []).indexOf(vg) >= 0 && /^Efetivo \d+$/.test(vg.nome_funcao || '')) {
      return 'Efetivo ' + numeroCadeiraVer(p, vg, mapaSlots);
    }
    return vg.nome_funcao;
  }

  function chip(texto, ehAcumulo, origem) {
    var c = RosterWork.tpl('tpl-distribuicao-chip');
    c.querySelector('.distribuicao-chip-texto').textContent = texto || '';
    var icone = c.querySelector('.distribuicao-chip-icone');
    var org = c.querySelector('.distribuicao-chip-origem');
    if (ehAcumulo) {
      c.classList.add('distribuicao-chip--acumulo');
      if (icone) icone.classList.remove('oculto');
      if (org) org.textContent = origem || '';
    }
    return c;
  }

  function renderVaga(vg, mapaSlots, posto) {
    var el = RosterWork.tpl('tpl-distribuicao-vaga');
    el.querySelector('.distribuicao-vaga-num').textContent = vg._pv;

    var funcEl = el.querySelector('.distribuicao-vaga-func');
    var membros = grupoAcumulo(vg, mapaSlots);
    if (membros.length <= 1) {
      funcEl.appendChild(chip(nomeExibirVer(posto, vg, mapaSlots), false, null));
    } else {
      membros.forEach(function (s) {
        var acumulada = !!s.acumulo_slot_id;   /* acumulada = amarela em qualquer linha; principal = cinza */
        var mesmoPosto = !!(posto && (posto.vagas || []).indexOf(s) >= 0);   /* mesma viatura → sem badge de origem */
        funcEl.appendChild(chip(nomeExibirVer(posto, s, mapaSlots), acumulada, (acumulada && !mesmoPosto) ? s._pv : null));
      });
    }

    el.querySelector('.distribuicao-vaga-perfil').textContent = (vg.tipo_contador === 'Oficiais') ? 'Oficial' : 'Praça';

    var antig = el.querySelector('.distribuicao-vaga-antig');
    if (vg.ordem != null && vg.ordem > 0) {
      antig.textContent = vg.ordem + 'º mais ' + (vg.ordem_sentido === 'moderno' ? 'moderno' : 'antigo');
      antig.classList.add('distribuicao-vaga-antig--def');
    } else {
      antig.textContent = '';
    }

    /* grau só quando NÃO há antiguidade (critérios alternativos); senão fica vazio */
    var grau = el.querySelector('.distribuicao-vaga-grau');
    if (vg.ordem != null && vg.ordem > 0) {
      grau.textContent = '';
    } else if (vg.ideal) {
      grau.textContent = vg.ideal + (vg.ideal_calc === '+' ? ' ou +' : (vg.ideal_calc === '-' ? ' ou -' : ''));
      grau.classList.add('distribuicao-vaga-grau--def');
    } else {
      grau.textContent = '';
    }

    el.querySelector('.distribuicao-vaga-rod').textContent = vg.rodizio ? 'Sim' : '-';
    return el;
  }

  /* ---- rodapé: status ---- */
  function montarItemStatus(it) {
    var item = RosterWork.tpl('tpl-distribuicao-status-item');
    item.classList.add('distribuicao-status-item--' + it.nivel);
    item.querySelector('.distribuicao-status-texto').textContent = it.texto;
    var uso = item.querySelector('.distribuicao-status-icone use');
    if (uso) uso.setAttribute('href', it.nivel === 'ok' ? 'icones/icone-check.svg#icone-check' : 'icones/icone-alerta.svg#icone-alerta');
    return item;
  }
  function nivelStatus(itens) {
    return itens.some(function (i) { return i.nivel === 'erro'; }) ? 'erro'
         : (itens.some(function (i) { return i.nivel === 'alerta'; }) ? 'alerta' : 'ok');
  }
  /* contagem por unidade a partir dos POSTOS/VAGAS (mesma lógica no Ver e no Editar → erros sincronizados):
     conta as vagas principais por tipo, detecta os papéis especiais e os postos sem efetivo (só nas unidades
     que entram no modelo, isto é, com composição > 0). `comp` = { unidade_id: { oficiais, pracas } }. */
  function contarUnidades(unidades, comp) {
    comp = comp || {};
    /* reforço: quanto cada unidade ENVIA (é origem) e RECEBE (é destino), por tipo */
    var enviados = {}, recebidos = {};
    (unidades || []).forEach(function (u) {
      (u.vemDe || u.vem_de || []).forEach(function (r) {
        var origem = r.origemUnidadeId != null ? r.origemUnidadeId : r.origem_unidade_id;
        var of = r.tipo_contador === 'Oficiais' ? 1 : 0, pc = r.tipo_contador === 'Oficiais' ? 0 : 1;
        recebidos[u.unidade_id] = recebidos[u.unidade_id] || { of: 0, pc: 0 };
        recebidos[u.unidade_id].of += of; recebidos[u.unidade_id].pc += pc;
        if (origem != null) {
          enviados[origem] = enviados[origem] || { of: 0, pc: 0 };
          enviados[origem].of += of; enviados[origem].pc += pc;
        }
      });
    });
    return (unidades || []).map(function (u) {
      var c = comp[u.unidade_id] || {};
      var env = enviados[u.unidade_id] || { of: 0, pc: 0 };
      var rec = recebidos[u.unidade_id] || { of: 0, pc: 0 };
      var alocarOf = (c.oficiais || 0) - env.of + rec.of;   /* a alocar = disponível − enviados + recebidos */
      var alocarPc = (c.pracas || 0) - env.pc + rec.pc;
      var temComposicao = (c.oficiais || 0) > 0 || (c.pracas || 0) > 0;
      var vof = 0, vpc = 0, oa = false, cs = false, vazios = [], semCriterio = [];
      (u.postos || []).forEach(function (p) {
        var vagas = p.vagas || [];
        var faltaCriterio = false;
        vagas.forEach(function (v) {
          if (v.acumulo_slot_id || v.acumuloTempId) return;   /* só principais */
          if (v.tipo_contador === 'Oficiais') vof++; else vpc++;
          if (v.papel_especial === 'oficial_area') oa = true;
          if (v.papel_especial === 'chefe_socorro') cs = true;
          /* vaga sem critério: nem antiguidade nem grau (papel especial tem antiguidade própria) */
          if (!v.papel_especial && !v.ordem && !v.ideal) faltaCriterio = true;
        });
        if (faltaCriterio) semCriterio.push(p.nome || '');
        if (temComposicao && !vagas.length) vazios.push(p.nome || '');
      });
      return {
        unidade_id: u.unidade_id, oficiais: alocarOf, pracas: alocarPc,
        vagas_oficiais: vof, vagas_pracas: vpc, tem_oficial_area: oa, tem_chefe_socorro: cs,
        postosVazios: vazios, semCriterio: semCriterio
      };
    });
  }
  /* preenche o contador "distribuídos/a alocar" no cabeçalho da unidade (esconde se a unidade não entra no modelo) */
  function preencherContagem(cabEl, c) {
    var span = cabEl && cabEl.querySelector('.distribuicao-unidade-contagem');
    if (!span || !c) return;
    var distribuidos = (c.vagas_oficiais || 0) + (c.vagas_pracas || 0);
    var alocar = (c.oficiais || 0) + (c.pracas || 0);
    if (!distribuidos && !alocar) { span.classList.add('oculto'); return; }
    span.querySelector('.distribuicao-unidade-contagem-texto').textContent = distribuidos + '/' + alocar;
  }
  /* resumo de status num container; chevron só com 2+ erros; a lista abre ACIMA do resumo */
  function preencherStatus(container, itens) {
    var resumo = RosterWork.tpl('tpl-distribuicao-status-resumo');
    resumo.classList.add('distribuicao-status-resumo--' + nivelStatus(itens));
    var texto = resumo.querySelector('.distribuicao-status-resumo-texto');
    if (itens.length <= 1) {
      resumo.classList.add('distribuicao-status-resumo--unico');
      texto.textContent = itens[0] ? itens[0].texto : '';
      container.appendChild(resumo);
      return;
    }
    texto.textContent = itens.length + ' problemas';
    resumo.addEventListener('click', function () {
      var aberto = resumo.getAttribute('aria-expanded') === 'true';
      resumo.setAttribute('aria-expanded', aberto ? 'false' : 'true');
      var lista = container.querySelector('.distribuicao-status-lista');
      if (lista) lista.remove();
      if (!aberto) {
        var nova = RosterWork.tpl('tpl-distribuicao-status-lista');
        itens.forEach(function (it) { nova.appendChild(montarItemStatus(it)); });
        container.insertBefore(nova, resumo);
      }
    });
    container.appendChild(resumo);
  }
  function renderRodape(status) {
    var rod = document.getElementById('distribuicao-rodape');
    if (!rod) return;
    rod.textContent = '';
    var itens = status.itens.length ? status.itens
      : [{ nivel: 'ok', texto: RosterWork.mensagens.distribuicao.tudoCerto(listarNomes(grupo.unidades.map(function (u) { return u.nome; }))) }];
    preencherStatus(rod, itens);
  }

  /* "A, B e C" */
  function listarNomes(nomes) {
    if (nomes.length <= 1) return nomes.join('');
    return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
  }

  /* ---- API da página ---- */
  function carregar(g) {
    grupo = g;
    selId = null;
    /* a lista (re)carregou: não há edição aberta → descarta estado obsoleto do editor (sujo, pilhas) */
    if (RosterWork.distribuicaoEditar && RosterWork.distribuicaoEditar.descartar) RosterWork.distribuicaoEditar.descartar();
    var corpo = document.getElementById('distribuicao-corpo');
    var rod = document.getElementById('distribuicao-rodape');
    if (rod) rod.textContent = '';
    if (corpo) {
      corpo.textContent = '';
      var est = RosterWork.tpl('tpl-distribuicao-estado');
      if (est) { est.textContent = RosterWork.mensagens.distribuicao.selecioneModelo; corpo.appendChild(est); }
    }
    var btnNovo = document.getElementById('distribuicao-novo-modelo');
    if (btnNovo && RosterWork.sessao.ehAdmin()) {
      btnNovo.disabled = false;
      if (!btnNovo._ligado) {
        btnNovo._ligado = true;
        btnNovo.addEventListener('click', function () { if (RosterWork.distribuicaoCriar) RosterWork.distribuicaoCriar.novo(grupo); });
      }
    }
    carregandoEm(document.getElementById('distribuicao-lista-modelos'));
    var req = ++seqCarregar;
    return RosterWork.distribuicaoDados.listarModelos(g.cia.unidade_id).then(function (lista) {
      if (req !== seqCarregar) return;   /* outra carga (troca de unidade/aba) assumiu */
      if (lista == null) { modelos = []; erroLista(); return; }   /* RPC falhou: mostra erro, não mascara como "sem modelos" */
      modelos = Array.isArray(lista) ? lista : [];
      renderPainel();
    });
  }

  function desmarcar() { selId = null; marcarAtivo(); }

  window.RosterWork.distribuicaoModelos = {
    carregar: carregar,
    validar: validar,
    recarregar: recarregar,
    recarregarLista: function () { return carregar(grupo); },
    editar: editarModelo,
    desmarcar: desmarcar,
    nivelStatus: nivelStatus,
    montarItemStatus: montarItemStatus,
    contarUnidades: contarUnidades,
    statusVisual: statusVisual,
    atualizarStatusModelo: atualizarStatusModelo,
    marcar: marcar,
    preencherContagem: preencherContagem,
    rascunhoId: rascunhoId,
    marcarRascunho: marcarRascunho,
    limparRascunho: limparRascunho,
    excluirRascunho: excluirRascunho,
    contextoId: function () { return grupo ? grupo.cia.unidade_id : null; }
  };
})();
