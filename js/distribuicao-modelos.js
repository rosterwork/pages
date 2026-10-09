/* ============================================================
   DISTRIBUIÇÃO — aba Modelos (visualização)
   Cada unidade tem os seus modelos: o painel esquerdo lista os modelos
   da unidade escolhida no filtro (a composição por extenso) + corpo (vagas
   do modelo selecionado, com acúmulo espelhado) + rodapé (status).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var grupo = null;      /* { cia, unidades:[{unidade_id, nome, tipo, ...}] } */
  var modelos = [];      /* retorno de dist_listar_modelos (cada modelo tem uma unidade) */
  var unidadeSel = null; /* unidade do filtro do painel: os modelos dela aparecem na lista */
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
    return RosterWork.distribuicaoDados.excluirModelo(id).catch(function () {});
  }

  function unidadeDoGrupo(id) {
    for (var i = 0; i < grupo.unidades.length; i++) {
      if (grupo.unidades[i].unidade_id === id) return grupo.unidades[i];
    }
    return null;
  }

  /* ---- CATÁLOGO DE ERROS da distribuição: a LISTA ÚNICA que define cada erro (código · domínio ·
     severidade). É a "fonte única": `problemasDaUnidade` decide a severidade lendo daqui, e ninguém
     mais decide por conta própria. A MENSAGEM de cada erro fica em geral-mensagens (ligada pelo código). ---- */
  var CATALOGO_ERROS = {
    falta_vaga:        { dominio: 'distribuicao', nivel: 'erro' },
    vaga_a_mais:       { dominio: 'distribuicao', nivel: 'erro' },
    falta_papel:       { dominio: 'distribuicao', nivel: 'erro' },
    vaga_sem_criterio: { dominio: 'distribuicao', nivel: 'erro' },
    /* posto com menos pessoas que o efetivo mínimo: vermelho aqui (igual aos outros), mas o banco não o
       põe na trava — a escala automática continua sendo distribuída */
    abaixo_minimo:     { dominio: 'distribuicao', nivel: 'erro' }
  };

  /* problemas de UMA unidade → [{codigo, nivel, texto}]. É o ÚNICO lugar do FRONTEND que checa as
     condições; o `validar` (rodapé) e o `unidadeNivel` (cor) usam ele — assim nunca divergem entre si.
     AMARRAÇÃO: estas regras DEVEM ser IDÊNTICAS às do juiz do banco `dist_validar_modelo` (o juiz é
     a autoridade — o motor e o salvar obedecem ele; esta cópia existe só para o feedback INSTANTÂNEO da
     tela). Mudou uma regra aqui → mude lá também. */
  function problemasDaUnidade(u) {
    var M = RosterWork.mensagens.distribuicao;
    var ud = unidadeDoGrupo(u.unidade_id);
    var nome = ud ? ud.nome : '';
    var tipo = ud ? ud.tipo : '';
    var lista = [];
    var add = function (codigo, texto) { lista.push({ codigo: codigo, nivel: CATALOGO_ERROS[codigo].nivel, texto: texto }); };
    if ((u.vagas_pracas || 0) < (u.pracas || 0)) add('falta_vaga', M.faltaVagas(nome, u.vagas_pracas || 0, u.pracas || 0, 'praças'));
    if ((u.vagas_oficiais || 0) < (u.oficiais || 0)) add('falta_vaga', M.faltaVagas(nome, u.vagas_oficiais || 0, u.oficiais || 0, 'oficiais'));
    if ((tipo === 'CIA' || tipo === 'CIBM') && (u.oficiais || 0) > 0 && !u.tem_oficial_area) add('falta_papel', M.semPapel(nome, 'Oficial de Área'));
    if (tipo === 'PEL' && (u.pracas || 0) > 0 && !u.tem_chefe_socorro) add('falta_papel', M.semPapel(nome, 'Chefe de Socorro'));
    /* posto abaixo do efetivo mínimo (mínimo 0 nunca entra) */
    (u.abaixoMinimo || []).forEach(function (a) { add('abaixo_minimo', M.abaixoMinimo(nome, a.posto, a.pessoas, a.minimo)); });
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
      (c.abaixoMinimo || []).forEach(function (a) { mp[a.posto] = 'erro'; });
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

  /* pinta a cor das duas colunas (Oficiais · Praças) pelo erro/alerta da unidade do modelo */
  function pintarCelulas(linha, nivel) {
    Array.prototype.forEach.call(linha.querySelectorAll('.distribuicao-modelo-celula'), function (cel) {
      cel.classList.remove('distribuicao-modelo-celula--erro', 'distribuicao-modelo-celula--alerta');
      if (nivel) cel.classList.add('distribuicao-modelo-celula--' + nivel);
    });
  }

  /* pinta o status de UM modelo na lista ao vivo (o editor chama a cada mudança): repinta só o ícone
     geral e a cor das colunas, com a MESMA regra do rodapé (validar/unidadeNivel). Ao cancelar, o
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
    var d = unidadeDados(unidades, unidadeSel);
    pintarCelulas(linha, d ? unidadeNivel(d) : null);
  }

  /* a unidade de um modelo (cada modelo tem uma só) */
  function unidadeDoModelo(m) { return (m && m.unidades && m.unidades[0]) || null; }

  /* modelos da unidade escolhida no filtro, do menor para o maior (oficiais, depois praças) */
  function modelosDaUnidade(unidadeId) {
    return modelos.filter(function (m) { var u = unidadeDoModelo(m); return u && u.unidade_id === unidadeId; })
      .sort(function (a, b) {
        var ua = unidadeDoModelo(a), ub = unidadeDoModelo(b);
        return ((ua.oficiais || 0) - (ub.oficiais || 0)) || ((ua.pracas || 0) - (ub.pracas || 0));
      });
  }

  function renderPainel() {
    var lista = document.getElementById('distribuicao-lista-modelos');
    if (!lista) return;
    lista.textContent = '';
    var daUnidade = modelosDaUnidade(unidadeSel);
    if (!daUnidade.length) {
      var est = RosterWork.tpl('tpl-distribuicao-estado');
      if (est) { est.textContent = RosterWork.mensagens.distribuicao.semModelos; lista.appendChild(est); }
      return;
    }
    daUnidade.forEach(function (m) {
      var linha = RosterWork.tpl('tpl-distribuicao-modelo');
      if (!linha) return;
      linha.setAttribute('data-modelo-id', m.id_grupo_completo);
      var st = validar(m.unidades);
      /* período copiado de uma mudança de posto e ainda não revisado: no mínimo amarelo */
      var nivel = (st.nivel === 'ok' && m.a_revisar) ? 'alerta' : st.nivel;
      if (nivel !== 'ok') {
        var sEl = linha.querySelector('.distribuicao-modelo-status');
        var ok = linha.querySelector('.distribuicao-modelo-ok');
        var er = linha.querySelector('.distribuicao-modelo-erro');
        if (ok) ok.classList.add('oculto');
        if (er) er.classList.remove('oculto');
        if (sEl) sEl.classList.add(nivel === 'erro' ? 'distribuicao-modelo-status--erro' : 'distribuicao-modelo-status--alerta');
      }
      /* composição por extenso, em duas colunas: "Oficiais: N" · "Praças: N" */
      var d = unidadeDoModelo(m);
      linha.querySelector('.distribuicao-modelo-oficiais').textContent = String(d.oficiais || 0);
      linha.querySelector('.distribuicao-modelo-pracas').textContent = String(d.pracas || 0);
      pintarCelulas(linha, unidadeNivel(d));
      if (m.id_grupo_completo === selId) linha.classList.add('lista-item--ativo');
      var area = linha.querySelector('.distribuicao-modelo-area');
      if (area) area.addEventListener('click', function () { pedirSaida(function () { selecionar(m.id_grupo_completo); }); });
      var menu = linha.querySelector('.distribuicao-modelo-menu');
      if (menu) {
        /* editar/excluir: só admin, e não num período que já terminou (só leitura) */
        if (RosterWork.sessao.ehAdmin() && !RosterWork.distribuicaoPeriodos.somenteLeitura()) {
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
    RosterWork.distribuicaoDados.lerModelo(id, RosterWork.distribuicaoPeriodos.data()).then(function (dados) {
      if (selId !== id) return;                /* resposta obsoleta: outro modelo já foi aberto */
      if (!dados) { erroCorpo(); return; }     /* RPC falhou: mostra erro, não deixa o giratório preso */
      var m = modelos.filter(function (x) { return x.id_grupo_completo === id; })[0];
      var comp = {};
      ((m && m.unidades) || []).forEach(function (cu) { comp[cu.unidade_id] = { oficiais: cu.oficiais, pracas: cu.pracas }; });
      var contagem = contarUnidades(dados.unidades, comp);
      var status = statusVisual(contagem);
      var revisar = itensRevisar(dados.unidades, status);
      renderCorpo(dados, status, contagem);   /* clicar = VER (read-only), para todos */
      renderRodape({ itens: validar(contagem).itens.concat(revisar) });
    }).catch(erroCorpo);
  }

  /* pelotões cujo período veio de uma mudança de posto e ainda não foi revisado: linha amarela no
     rodapé e o cabeçalho do pelotão em amarelo (quando não tem erro) */
  function itensRevisar(unidades, status) {
    var periodo = RosterWork.distribuicaoPeriodos.periodo();
    var motivo = periodo && periodo.motivo;
    var itens = [];
    (unidades || []).forEach(function (u) {
      if (!u.a_revisar) return;
      if (!status.unidades[u.unidade_id]) status.unidades[u.unidade_id] = 'alerta';
      itens.push({ codigo: 'revisar', nivel: 'alerta', texto: RosterWork.mensagens.distribuicao.revisarPeriodo(u.nome || '', motivo) });
    });
    return itens;
  }

  /* admin: "Editar" no menu ⋯ abre o modo de edição */
  function editarModelo(id) {
    selId = id;
    marcarAtivo();
    carregandoEm(document.getElementById('distribuicao-corpo'));
    RosterWork.distribuicaoDados.lerModelo(id, RosterWork.distribuicaoPeriodos.data()).then(function (dados) {
      if (selId !== id) return;                /* resposta obsoleta */
      if (!dados) { erroCorpo(); return; }     /* RPC falhou */
      var m = modelos.filter(function (x) { return x.id_grupo_completo === id; })[0];
      if (RosterWork.distribuicaoEditar) RosterWork.distribuicaoEditar.abrir(m, dados);
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
     conta as vagas principais por tipo, detecta os papéis especiais e os postos abaixo do efetivo mínimo (só nas
     unidades que entram no modelo, isto é, com composição > 0). `comp` = { unidade_id: { oficiais, pracas } }. */
  function contarUnidades(unidades, comp) {
    comp = comp || {};
    return (unidades || []).map(function (u) {
      var c = comp[u.unidade_id] || {};
      var alocarOf = c.oficiais || 0;   /* a alocar = a composição do modelo */
      var alocarPc = c.pracas || 0;
      var temComposicao = (c.oficiais || 0) > 0 || (c.pracas || 0) > 0;
      var vof = 0, vpc = 0, oa = false, cs = false, abaixo = [], semCriterio = [];
      (u.postos || []).forEach(function (p) {
        var vagas = p.vagas || [];
        var faltaCriterio = false;
        /* pessoas no posto (a mesma conta do banco): quem acumula duas funções no posto conta uma vez */
        var pessoas = pessoasDoPosto(p);
        var minimo = p.efetivo_minimo || 0;
        if (temComposicao && minimo >= 1 && pessoas < minimo) abaixo.push({ posto: p.nome || '', pessoas: pessoas, minimo: minimo });
        vagas.forEach(function (v) {
          if (v.acumulo_slot_id || v.acumuloTempId) return;   /* só principais */
          if (v.tipo_contador === 'Oficiais') vof++; else vpc++;
          if (v.papel_especial === 'oficial_area') oa = true;
          if (v.papel_especial === 'chefe_socorro') cs = true;
          /* vaga sem critério: nem antiguidade nem grau (papel especial tem antiguidade própria) */
          if (!v.papel_especial && !v.ordem && !v.ideal) faltaCriterio = true;
        });
        if (faltaCriterio) semCriterio.push(p.nome || '');
      });
      return {
        unidade_id: u.unidade_id, oficiais: alocarOf, pracas: alocarPc,
        vagas_oficiais: vof, vagas_pracas: vpc, tem_oficial_area: oa, tem_chefe_socorro: cs,
        abaixoMinimo: abaixo, semCriterio: semCriterio
      };
    });
  }
  /* pessoas de um posto no modelo: cada vaga acumulada conta junto com a sua principal (Ver: ids do banco;
     Editar: ids temporários). Quem acumula uma função num outro posto conta nos dois. */
  function pessoasDoPosto(p) {
    var grupos = {};
    (p.vagas || []).forEach(function (v) { grupos[v.acumuloTempId || v.acumulo_slot_id || v.tempId || v.id_slot] = true; });
    return Object.keys(grupos).length;
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
    var ud = unidadeDoGrupo(unidadeSel);
    var itens = status.itens.length ? status.itens
      : [{ nivel: 'ok', texto: RosterWork.mensagens.distribuicao.tudoCerto(ud ? ud.nome : '') }];
    preencherStatus(rod, itens);
  }

  /* corpo sem modelo aberto: a mensagem "selecione um modelo" e o rodapé vazio */
  function limparCorpo() {
    var corpo = document.getElementById('distribuicao-corpo');
    var rod = document.getElementById('distribuicao-rodape');
    if (rod) rod.textContent = '';
    if (corpo) {
      corpo.textContent = '';
      var est = RosterWork.tpl('tpl-distribuicao-estado');
      if (est) { est.textContent = RosterWork.mensagens.distribuicao.selecioneModelo; corpo.appendChild(est); }
    }
  }

  /* tira a seleção da lista (o Novo modelo ocupa o corpo) */
  function limparSelecao() {
    selId = null;
    marcarAtivo();
    if (RosterWork.distribuicaoEditar && RosterWork.distribuicaoEditar.mostrarHistorico) RosterWork.distribuicaoEditar.mostrarHistorico(false);
  }

  /* troca a unidade do filtro: recarrega a lista (exclui um modelo rascunho deixado sem salvar) */
  function escolherUnidade(unidadeId) {
    return excluirRascunho().then(function () { return carregar(grupo, unidadeId); });
  }

  /* ---- API da página ---- */
  function carregar(g, unidadeId) {
    grupo = g;
    if (unidadeId != null) unidadeSel = unidadeId;
    if (unidadeSel == null || !unidadeDoGrupo(unidadeSel)) unidadeSel = g.unidades[0].unidade_id;
    selId = null;
    /* a lista (re)carregou: não há edição aberta → descarta estado obsoleto do editor (sujo, pilhas) */
    if (RosterWork.distribuicaoEditar && RosterWork.distribuicaoEditar.descartar) RosterWork.distribuicaoEditar.descartar();
    limparCorpo();
    var btnNovo = document.getElementById('distribuicao-novo-modelo');
    if (btnNovo) {
      btnNovo.classList.toggle('oculto', !RosterWork.sessao.ehAdmin());   // só admin cria modelo
      if (RosterWork.sessao.ehAdmin()) {
        btnNovo.disabled = false;
        if (!btnNovo._ligado) {
          btnNovo._ligado = true;
          /* o modelo novo é da unidade do filtro; com edição aberta, confirma antes */
          btnNovo.addEventListener('click', function () {
            pedirSaida(function () { if (RosterWork.distribuicaoCriar) RosterWork.distribuicaoCriar.novo(grupo, unidadeSel); });
          });
        }
      }
    }
    carregandoEm(document.getElementById('distribuicao-lista-modelos'));
    var req = ++seqCarregar;
    var P = RosterWork.distribuicaoPeriodos;
    /* primeiro os períodos (o seletor); depois os modelos do período escolhido */
    return P.carregar(g.cia.unidade_id, recarregar).then(function () {
      if (req !== seqCarregar) return;
      /* período que já terminou é só leitura: não cria modelo */
      if (btnNovo && RosterWork.sessao.ehAdmin()) btnNovo.disabled = P.somenteLeitura();
      return RosterWork.distribuicaoDados.listarModelos(g.cia.unidade_id, P.data()).then(function (lista) {
        if (req !== seqCarregar) return;   /* outra carga (troca de unidade/aba/período) assumiu */
        if (lista == null) { modelos = []; erroLista(); return; }   /* RPC falhou: mostra erro, não mascara como "sem modelos" */
        modelos = Array.isArray(lista) ? lista : [];
        renderPainel();
      });
    });
  }

  window.RosterWork.distribuicaoModelos = {
    carregar: carregar,
    validar: validar,
    recarregar: recarregar,
    recarregarLista: function () { return carregar(grupo); },
    escolherUnidade: escolherUnidade,
    unidadeSelecionada: function () { return unidadeSel; },
    modelosDaUnidade: modelosDaUnidade,
    selecionar: selecionar,
    limparSelecao: limparSelecao,
    limparCorpo: limparCorpo,
    editar: editarModelo,
    nivelStatus: nivelStatus,
    montarItemStatus: montarItemStatus,
    contarUnidades: contarUnidades,
    statusVisual: statusVisual,
    atualizarStatusModelo: atualizarStatusModelo,
    marcar: marcar,
    pessoasDoPosto: pessoasDoPosto,
    preencherContagem: preencherContagem,
    rascunhoId: rascunhoId,
    marcarRascunho: marcarRascunho,
    limparRascunho: limparRascunho,
    excluirRascunho: excluirRascunho,
    contextoId: function () { return grupo ? grupo.cia.unidade_id : null; }
  };
})();
