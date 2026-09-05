/* ============================================================
   EXTRAJORNADA — cotas no painel fixo à esquerda (aba Escala, admin)
   O painel fica sempre aberto à esquerda da grade (geral-layout-lateral,
   como a Disponibilidade e a Distribuição): o admin escolhe o escopo (grupo
   inteiro ou por unidade), informa o bolo de cada escopo e o sistema reparte
   por taxa de atendimento (no banco). Cada "Concedido" é editável (respeita o
   pedido e o "fecha 24h"); a lista mostra a cota sugerida e o "feito" (blocos
   já colocados) e a taxa do mês colorida (verde/amarelo/vermelho pela média
   do cartão). Salvar grava, audita e abre o resumo. Comum vê só leitura.
   Não cria HTML (clona moldes) nem escreve estilo (só classList/textContent).
   RosterWork.extrajornadaCotasPainel.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  var conteudo = null;
  var naAba = false;                    // a aba Escala está ativa? (o painel só vale/carrega nela)
  var el = {};                          // elementos fixos do painel esquerdo (consultados no montar)
  var comp = null;                      // Date do 1º dia da competência (mês)
  var estado = { modo: 'grupo', grupos: [] };   // grupos: {unidadeId,nome,bolo,vols:[...]}
  var domGrupos = {};                   // key(unidadeId||'g') -> {boloEl, listaEl}
  var limpo = null;                     // snapshot p/ detectar edição não salva
  var guardaLigada = false;
  var timerSim = null;
  var cargaSeq = 0;                     // token de requisição: ignora resposta antiga (troca rápida de mês/aba)
  var mostrarSeloNovo = false;          // o selo "Novo" só aparece quando há mistura (não na 1ª distribuição, em que todos são novos)
  var selecionado = null;               // cpf do militar selecionado (destaca a linha; pinta a grade na fase futura)

  /* ---------- utilidades ---------- */

  /* comum PODE ver as cotas da unidade (só leitura); admin edita/reparte/salva */
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function competenciaISO() { return iso(comp); }
  function nomeMes() { return MESES[comp.getMonth()]; }
  function rotuloMes() { return nomeMes().charAt(0).toUpperCase() + nomeMes().slice(1) + ' ' + comp.getFullYear(); }
  /* contexto do painel = unidade mãe (CIA/CIBM) selecionada, vinda da aba Escala */
  function unidadeMae() {
    var n = RW.extrajornadaEscala && RW.extrajornadaEscala.contextoNome && RW.extrajornadaEscala.contextoNome();
    return n || '';
  }
  function keyGrupo(g) { return g.unidadeId == null ? 'g' : String(g.unidadeId); }
  /* no modo grupo o título é a unidade mãe (2ªCIBM/CIA); no por_unidade, o nome da unidade */
  function rotuloGrupo(g) { return g.unidadeId == null ? (unidadeMae() || 'Grupo') : (g.nome || 'Unidade'); }

  function boloTotal() {
    var s = 0;
    estado.grupos.forEach(function (g) { s += (g.bolo || 0); });
    return s;
  }
  function snapshot() {
    return JSON.stringify({
      m: estado.modo,
      g: estado.grupos.map(function (g) {
        return { u: g.unidadeId, b: g.bolo, v: g.vols.map(function (v) { return v.cpf + ':' + v.concedido; }) };
      })
    });
  }
  function sujo() { return limpo !== null && snapshot() !== limpo; }
  /* o Salvar só fica ativo quando há edição pendente (sem mudança = desabilitado) */
  function atualizarSalvar() { if (el.salvar) el.salvar.disabled = !sujo(); }
  /* o painel só está "ativo" na aba Escala e com os elementos montados (na tela) */
  function ativo() { return naAba && el.grupos && el.grupos.isConnected; }

  /* menor sugestão positiva do grupo — marca em verde quem recebeu a cota extra */
  function minPosSug(g) {
    var m = null;
    g.vols.forEach(function (v) { if (v.sugerido > 0 && (m === null || v.sugerido < m)) m = v.sugerido; });
    return m;
  }

  /* config para o banco: null carrega o salvo; senão simula sem gravar */
  function montarConfig() {
    if (estado.modo === 'grupo') {
      return { modo: 'grupo', bolo: (estado.grupos[0] ? estado.grupos[0].bolo : 0) };
    }
    var bolos = {};
    estado.grupos.forEach(function (g) { if (g.unidadeId != null) bolos[String(g.unidadeId)] = g.bolo; });
    return { modo: 'por_unidade', bolos: bolos };
  }

  /* ---------- render ---------- */

  function opcoesConcedido(v) {
    var arr = [], passo = v.fecha24 ? 4 : 1;
    for (var n = 0; n <= v.pediu; n += passo) arr.push(n);
    if (!arr.length) arr.push(0);
    return arr;
  }

  /* seleção do militar: destaca a linha (barra de acento); a pintura da grade pela preferência é fase futura */
  function marcarSelecionado() {
    if (!el.grupos) return;
    var itens = el.grupos.querySelectorAll('.extra-cota-item');
    for (var i = 0; i < itens.length; i++) {
      itens[i].classList.toggle('lista-item--ativo', !!selecionado && itens[i].dataset.cpf === selecionado);
    }
  }
  function selecionarMilitar(cpf) {
    selecionado = (selecionado === cpf) ? null : cpf;   // clicar de novo na mesma linha tira a seleção
    marcarSelecionado();
    /* avisa a grade da Escala para pintar as células pela preferência do militar (ou limpar, se null) */
    window.dispatchEvent(new CustomEvent('rosterwork_extra_militar', { detail: { cpf: selecionado } }));
  }

  function montarItem(g, v, mp) {
    var li = RosterWork.tpl('tpl-extra-cota-item');
    if (!li) return null;
    li.querySelector('.extra-cota-grad').textContent = v.grad || '';
    li.querySelector('.extra-cota-nome').textContent = v.nome || '';
    var selo = li.querySelector('.extra-cota-selo-novo');   // "Novo" só p/ quem não foi tratado, e só quando há mistura
    if (selo && v.novo && mostrarSeloNovo) selo.classList.remove('oculto');

    li.querySelector('.extra-cota-pediu').textContent = String(v.pediu);   // a taxa (colorida, ao vivo) é preenchida por atualizarTaxas

    var admin = RosterWork.sessao.ehAdmin();
    var sug = li.querySelector('.extra-cota-sug');
    sug.textContent = String(v.sugerido);
    if (mp !== null && v.sugerido > mp) sug.classList.add('extra-cota-sug--extra');
    if (!admin) { var seg = li.querySelector('.extra-cota-sug-seg'); if (seg) seg.classList.add('oculto'); }   // "sugerido" é número interno do admin
    li.querySelector('.extra-cota-preench').textContent = String(v.preenchido);

    var caixa = li.querySelector('.extra-cota-conc');
    var menu = li.querySelector('.extra-cota-conc-menu');
    var texto = li.querySelector('.extra-cota-conc-texto');
    texto.textContent = String(v.concedido);
    caixa.classList.toggle('extra-cota-conc--alterado', v.concedido !== v.sugerido);
    if (admin && RW.dropdownNumeros) {
      RW.dropdownNumeros.preencher(menu, {
        opcoes: opcoesConcedido(v),
        valor: v.concedido,
        formato: function (n) { return String(n); },
        aoEscolher: function (n) {
          v.concedido = n;
          texto.textContent = String(n);
          caixa.classList.toggle('extra-cota-conc--alterado', v.concedido !== v.sugerido);
          atualizarResumoGrupo(g);
        }
      });
    } else {
      caixa.classList.add('extra-cota-conc--leitura');   // comum: concedido é só leitura (sem seta nem hover)
      var gatilho = li.querySelector('.extra-cota-conc-gatilho');
      if (gatilho) gatilho.disabled = true;
    }

    /* linha clicável = seleciona o militar (destaca); clicar no seletor de Concedido não seleciona a linha */
    li.dataset.cpf = v.cpf || '';
    if (selecionado && li.dataset.cpf === selecionado) li.classList.add('lista-item--ativo');
    li.addEventListener('click', function (e) {
      if (e.target.closest('.extra-cota-conc')) return;
      selecionarMilitar(v.cpf);
    });
    return li;
  }

  function renderLista(g, listaEl) {
    listaEl.textContent = '';
    var mp = minPosSug(g);
    if (!g.vols.length) {
      var vazio = RosterWork.tpl('tpl-extra-cota-vazio');
      if (vazio) listaEl.appendChild(vazio);
      return;
    }
    g.vols.forEach(function (v) {
      var it = montarItem(g, v, mp);
      if (it) listaEl.appendChild(it);
    });
  }

  /* render completo (carga e troca de escopo): estrutura + listas */
  function renderGrupos() {
    if (!el.grupos) return;
    atualizarEscopoBotoes();
    domGrupos = {};
    el.grupos.textContent = '';
    if (!estado.grupos.length) {
      mostrarEstado(RW.mensagens.extrajornada.semVoluntarios);
      return;
    }
    el.grupos.classList.remove('oculto');
    if (el.estado) el.estado.classList.add('oculto');
    estado.grupos.forEach(function (g) {
      var sec = RosterWork.tpl('tpl-extra-cota-grupo');
      if (!sec) return;
      sec.querySelector('.extra-cota-grupo-nome').textContent = rotuloGrupo(g);
      var cidadeEl = sec.querySelector('.extra-cota-grupo-cidade');
      if (cidadeEl && g.cidade) { cidadeEl.textContent = g.cidade; cidadeEl.classList.remove('oculto'); }
      var titulo = sec.querySelector('.extra-cota-grupo-titulo');
      var seta = sec.querySelector('.extra-cota-grupo-seta');
      if (estado.modo === 'grupo') {
        sec.classList.add('extra-cota-grupo--sem-recolher');   // grupo = uma seção só: não recolhe
        if (seta) seta.classList.add('oculto');                // sem chevron
      } else if (titulo) {
        titulo.addEventListener('click', function () {
          var fechado = sec.classList.toggle('extra-cota-grupo--fechado');
          titulo.setAttribute('aria-expanded', String(!fechado));
        });
      }
      var boloEl = sec.querySelector('.extra-cota-grupo-bolo');
      boloEl.value = String(g.bolo);
      var chave = keyGrupo(g);   // o listener busca pela chave (resimular troca os objetos)
      if (RosterWork.sessao.ehAdmin()) {
        boloEl.addEventListener('input', function () { aoBolo(chave, boloEl); });
      } else {
        boloEl.disabled = true;   // comum só vê o modo; o resumo de gestão fica oculto
        var resumoEl = sec.querySelector('.extra-cota-grupo-resumo');
        if (resumoEl) resumoEl.classList.add('oculto');
      }
      var listaEl = sec.querySelector('.extra-cota-grupo-lista');
      domGrupos[keyGrupo(g)] = {
        card: sec,
        boloEl: boloEl,
        listaEl: listaEl,
        resumo: {
          dist: sec.querySelector('.extra-cota-r-dist'),
          restam1: sec.querySelector('.extra-cota-r-restam1'),
          esc: sec.querySelector('.extra-cota-r-esc'),
          restam2: sec.querySelector('.extra-cota-r-restam2')
        }
      };
      renderLista(g, listaEl);
      el.grupos.appendChild(sec);
    });
    atualizarResumos();
  }

  function mostrarEstado(msg) {
    if (el.grupos) el.grupos.classList.add('oculto');
    if (el.estado) { el.estado.textContent = msg; el.estado.classList.remove('oculto'); }
  }

  /* pinta o "restam": zero = verde (nada sobrando), negativo = vermelho (estourou) */
  function pintarRestam(elNum, valor) {
    if (!elNum) return;
    elNum.textContent = String(valor);
    elNum.classList.toggle('extra-cota-r--ok', valor === 0);
    elNum.classList.toggle('extra-cota-r--erro', valor < 0);
  }

  /* resumo de UM grupo: distribuídas/restam (do total daquele grupo) + escaladas/restam.
     O total sai da própria caixa "Cotas" do grupo (g.bolo), nunca de uma soma global. */
  function atualizarResumoGrupo(g) {
    var dom = domGrupos[keyGrupo(g)];
    if (!dom || !dom.resumo) return;
    var total = g.bolo || 0;
    var dist = 0, esc = 0;
    g.vols.forEach(function (v) { dist += (v.concedido || 0); esc += (v.preenchido || 0); });
    dom.resumo.dist.textContent = String(dist);
    dom.resumo.esc.textContent = String(esc);
    pintarRestam(dom.resumo.restam1, total - dist);   // sobra do total (cotas ainda por distribuir)
    pintarRestam(dom.resumo.restam2, dist - esc);      // distribuídas ainda não escaladas
    /* estourou o bolo (distribuiu mais que o total): título do grupo fica vermelho (não há mais caixa externa) */
    if (dom.card) dom.card.classList.toggle('extra-cota-grupo--estourado', (total - dist) < 0);
    atualizarTaxas(g);   // a taxa colorida acompanha o concedido ao vivo (a média do cartão muda a cada edição)
    atualizarSalvar();   // toda edição/render passa por aqui → mantém o Salvar habilitado só quando há mudança
  }

  function atualizarResumos() { estado.grupos.forEach(atualizarResumoGrupo); }

  /* taxa ao vivo (concedido ÷ pedido do mês), colorida em relação à MÉDIA do cartão:
     >= média = verde; metade da média ou menos = vermelho; entre as duas = amarelo (todos iguais = todos verdes) */
  function taxaLive(v) { return v.pediu > 0 ? Math.round((v.concedido || 0) / v.pediu * 100) : null; }
  function atualizarTaxas(g) {
    var dom = domGrupos[keyGrupo(g)];
    if (!dom || !dom.listaEl) return;
    var itens = dom.listaEl.querySelectorAll('.extra-cota-item');
    var taxas = g.vols.map(taxaLive);
    var validas = taxas.filter(function (t) { return t != null; });
    var media = validas.length ? validas.reduce(function (a, b) { return a + b; }, 0) / validas.length : 0;
    g.vols.forEach(function (v, i) {
      var num = itens[i] && itens[i].querySelector('.extra-cota-taxa-num');
      if (!num) return;
      var t = taxas[i];
      num.textContent = (t == null ? '-' : t + '%');
      num.classList.remove('extra-cota-taxa--verde', 'extra-cota-taxa--amarelo', 'extra-cota-taxa--vermelho');
      if (t == null) return;
      num.classList.add('extra-cota-taxa--' + (t >= media ? 'verde' : (t <= media / 2 ? 'vermelho' : 'amarelo')));
    });
  }

  /* estourou = distribuiu mais cotas do que o bolo do grupo (restam < 0) */
  function grupoEstourado(g) {
    var dist = 0;
    g.vols.forEach(function (v) { dist += (v.concedido || 0); });
    return dist > (g.bolo || 0);
  }
  function algumEstourado() {
    for (var i = 0; i < estado.grupos.length; i++) if (grupoEstourado(estado.grupos[i])) return true;
    return false;
  }

  function atualizarEscopoBotoes() {
    if (!el.escopo) return;
    Array.prototype.forEach.call(el.escopo.querySelectorAll('input[data-modo]'), function (inp) {
      inp.checked = (inp.getAttribute('data-modo') === estado.modo);   // marca a bolinha do modo real (desfaz um clique cancelado)
    });
  }

  /* ---------- dados ---------- */

  /* ordem de exibição: 0 = novo (nunca teve cota salva), 1 = zerado (ficou com 0), 2 = o resto */
  function ordemCota(v) { return v.novo ? 0 : (v.zerado ? 1 : 2); }

  /* usarSalvo = true no carregamento (respeita o concedido salvo);
     false ao re-simular / trocar escopo (concedido volta ao sugerido) */
  function aplicarResposta(r, usarSalvo) {
    estado.modo = r.modo || 'grupo';
    estado.temDeslocamento = !!r.tem_deslocamento;   // há extra colocado fora da unidade de origem (trava do escopo)
    estado.grupos = (r.grupos || []).map(function (gr) {
      return {
        unidadeId: (gr.unidade_id == null ? null : gr.unidade_id),
        nome: gr.nome,
        cidade: gr.cidade || '',
        bolo: gr.bolo || 0,
        vols: (gr.voluntarios || []).map(function (v) {
          var sug = v.sugerido || 0;
          var conc = (usarSalvo && v.concedido_salvo != null) ? v.concedido_salvo : sug;
          return {
            cpf: v.cpf, nome: v.nome, grad: v.grad, antig: v.antig, pediu: v.pediu,
            fecha24: !!v.fecha_24h,
            novo: (v.concedido_salvo == null),   // nunca teve cota salva neste mês (não tratado)
            zerado: (conc === 0),                 // ficou com zero cota
            sugerido: sug, concedido: conc, preenchido: (v.preenchido || 0)
          };
        })
      };
    });
    /* ordem: novos, depois zerados, depois a ordem do banco (taxa então antiguidade).
       O sort é ESTÁVEL, então dentro de cada faixa a ordem do banco é preservada. */
    estado.grupos.forEach(function (g) { g.vols.sort(function (a, b) { return ordemCota(a) - ordemCota(b); }); });
    /* o selo "Novo" só quando há mistura (na 1ª distribuição do mês todos são novos → sem selo) */
    mostrarSeloNovo = !estado.grupos.every(function (g) { return g.vols.every(function (v) { return v.novo; }); });
  }

  function carregar() {
    if (!RW.extrajornadaDados || !ativo()) return;
    atualizarContexto();
    /* stale-while-revalidate: spinner só na 1ª carga (painel vazio); a recarga (ativar/mês) mantém
       o conteúdo na tela até a nova resposta chegar — carregamento liso, sem piscar */
    var temConteudo = el.grupos && el.grupos.querySelector('.extra-cota-grupo');
    if (el.grupos && !temConteudo) { el.grupos.textContent = ''; var c = RosterWork.tpl('tpl-painel-carregando'); if (c) el.grupos.appendChild(c); el.grupos.classList.remove('oculto'); }
    if (el.estado) el.estado.classList.add('oculto');
    var req = ++cargaSeq;
    RW.extrajornadaDados.carregarCotas(competenciaISO(), null).then(function (r) {
      if (!ativo() || req !== cargaSeq) return;
      r = r || {};
      if (!r.ok) {
        estado = { modo: 'grupo', grupos: [] };
        mostrarEstado(r.error || RW.mensagens.extrajornada.falhaCotas);
        atualizarEscopoBotoes();
        limpo = snapshot();
        return;
      }
      aplicarResposta(r, true);
      limpo = snapshot();
      renderGrupos();
    }, function () {
      if (!ativo() || req !== cargaSeq) return;
      mostrarEstado(RW.mensagens.extrajornada.falhaCotas);
    });
  }

  /* re-simula a divisão com os bolos digitados (sem gravar); só atualiza as listas */
  function resimular() {
    if (!RW.extrajornadaDados) return;
    RW.extrajornadaDados.carregarCotas(competenciaISO(), montarConfig()).then(function (r) {
      if (!r || !r.ok || !ativo()) return;
      aplicarResposta(r, false);
      estado.grupos.forEach(function (g) {
        var dom = domGrupos[keyGrupo(g)];
        if (!dom) return;
        if (dom.boloEl && document.activeElement !== dom.boloEl) dom.boloEl.value = String(g.bolo);
        renderLista(g, dom.listaEl);
      });
      atualizarResumos();
    });
  }

  function aoBolo(chave, boloEl) {
    var g = null;
    estado.grupos.forEach(function (gg) { if (keyGrupo(gg) === chave) g = gg; });
    if (!g) return;
    var v = boloEl.value.replace(/\D/g, '');
    if (v !== boloEl.value) boloEl.value = v;
    g.bolo = v === '' ? 0 : parseInt(v, 10);
    atualizarResumoGrupo(g);
    if (timerSim) clearTimeout(timerSim);
    timerSim = setTimeout(resimular, 400);
  }

  function trocarEscopo(modo) {
    if (modo === estado.modo || !RW.extrajornadaDados) return;
    /* trava A: só bloqueia ir para "por unidade" havendo extra colocado FORA da unidade de origem (deslocamento) */
    if (modo === 'por_unidade' && estado.temDeslocamento) {
      if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.escopoDeslocamento });
      atualizarEscopoBotoes();   // desfaz a marcação da bolinha (o navegador já marcou no clique; estado.modo não mudou)
      return;
    }
    function aplicar() {
      var config = (modo === 'grupo')
        ? { modo: 'grupo', bolo: boloTotal() }
        : { modo: 'por_unidade', bolos: {} };
      estado.modo = modo;
      atualizarEscopoBotoes();
      RW.extrajornadaDados.carregarCotas(competenciaISO(), config).then(function (r) {
        if (!r || !r.ok || !ativo()) return;
        aplicarResposta(r, false);
        renderGrupos();
      });
    }
    /* trocar a forma de repartir re-roda a divisão: avisa antes (modal, fecha só pelo botão).
       O navegador já marca a bolinha clicada; se cancelar, atualizarEscopoBotoes devolve a
       marcação ao modo atual (estado.modo ainda não mudou). */
    if (RW.confirmar) {
      RW.confirmar({
        tipo: 'aviso',
        mensagem: RW.mensagens.extrajornada.escopoTrocar,
        textoConfirmar: RW.mensagens.botoes.continuar,
        textoCancelar: RW.mensagens.botoes.cancelar,
        aoConfirmar: aplicar,
        aoCancelar: atualizarEscopoBotoes
      });
    } else {
      aplicar();
    }
  }

  function salvar() {
    if (!RW.extrajornadaDados || !el.salvar) return;
    /* trava no front: não salva com grupo estourado (o card já está vermelho); avisa o que corrigir */
    if (algumEstourado()) { RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.cotaEstourada }); return; }
    RW.iniciarCarregando(el.salvar);
    var aloc = [];
    estado.grupos.forEach(function (g) { g.vols.forEach(function (v) { aloc.push({ cpf: v.cpf, cotas: v.concedido }); }); });
    RW.extrajornadaDados.salvarCotas({ competencia: competenciaISO(), config: montarConfig(), alocacoes: aloc }).then(function (r) {
      RW.pararCarregando(el.salvar);
      if (r && r.success) {
        estado.grupos.forEach(function (g) { g.vols.forEach(function (v) { v.sugerido = v.concedido; }); });
        limpo = snapshot();
        renderGrupos();
        if (RW.extrajornadaEscala && RW.extrajornadaEscala.recarregar) RW.extrajornadaEscala.recarregar();   // escopo/cotas mudaram → grade atualiza
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Extrajornada' });
        else RW.avisar({ tipo: 'sucesso', mensagem: RW.mensagens.extrajornada.semCotasMudanca });
      } else if (r && r.cota_estourada) {
        RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.extrajornada.cotaEstourada });   // rede de segurança (o front já trava)
      } else if (r && r.cota_menor) {
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.extrajornada.cotaMenor });   // bolo abaixo do já colocado (C4)
      } else {
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.extrajornada.falhaSalvar });
      }
    }, function () {
      RW.pararCarregando(el.salvar);
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.erroConexao });
    });
  }

  /* ---------- sincronização de mês com a aba Escala ----------
     O seletor único (dono: o orquestrador, #extra-periodo) é a fonte do mês;
     a aba Escala consulta temEdicaoAberta() (avisa antes de descartar, via
     estaSujo) e chama sincronizarMes() no renderMes quando o mês muda. */

  function temEdicaoAberta() { return ativo() && sujo(); }
  /* marca o estado atual como limpo (usado quando o usuário confirma o descarte ao trocar de aba;
     ao voltar à aba, o ativar() recarrega do banco e desfaz a edição de fato) */
  function descartar() { limpo = snapshot(); atualizarSalvar(); }

  function sincronizarMes(nova) {
    if (!ativo() || !nova) return;
    comp = new Date(nova.getFullYear(), nova.getMonth(), 1);
    carregar();
  }

  /* contexto (unidade mãe) ao lado do título; a aba Escala também chama ao terminar a grade
     (as unidades chegam por RPC; sem isto a 1ª pintura poderia ficar sem o nome) */
  function atualizarContexto() {
    var m = unidadeMae();
    if (el.contexto) el.contexto.textContent = m;
    /* no modo grupo o título do grupo É a unidade mãe: preenche quando a grade da Escala chega
       (na 1ª pintura simultânea o contextoNome pode não estar pronto ainda) */
    if (m && estado.modo === 'grupo' && el.grupos) {
      var nomeEl = el.grupos.querySelector('.extra-cota-grupo-nome');
      if (nomeEl) nomeEl.textContent = m;
    }
  }

  /* ---------- montagem da página ---------- */

  function montar(cont) {
    conteudo = cont;
    comp = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);   // provisório; ativar() ajusta ao mês compartilhado

    el.grupos = cont.querySelector('#extra-cota-grupos');
    /* clicar numa área vazia do painel (fora de um militar, faixa ou campo) desseleciona o militar */
    if (el.grupos) el.grupos.addEventListener('click', function (e) {
      if (e.target.closest('.extra-cota-item, button, input, .dropdown, .extra-cota-grupo-cabecalho')) return;
      if (selecionado) selecionarMilitar(selecionado);   // toggle off + avisa a grade
    });
    el.estado = cont.querySelector('#extra-cota-estado');
    el.escopo = cont.querySelector('#extra-cota-escopo');
    el.contexto = cont.querySelector('#extra-cota-contexto');
    el.rodape = cont.querySelector('#extra-cota-rodape');
    el.salvar = cont.querySelector('.extra-cota-salvar');
    el.cancelar = cont.querySelector('.extra-cota-cancelar');

    var admin = RosterWork.sessao.ehAdmin();
    if (el.escopo) {
      if (admin) {
        el.escopo.addEventListener('change', function (ev) {
          var inp = ev.target;
          if (inp && inp.getAttribute && inp.getAttribute('data-modo')) trocarEscopo(inp.getAttribute('data-modo'));
        });
      } else {
        el.escopo.classList.add('extra-cota-escopo--travado');   // comum vê o modo marcado, não troca
        Array.prototype.forEach.call(el.escopo.querySelectorAll('input'), function (i) { i.disabled = true; });   // bloqueia mouse E teclado
      }
    }
    if (admin && el.rodape) {   // comum não tem o que salvar → o rodapé de ações fica oculto
      el.rodape.classList.remove('oculto');
      if (el.salvar) { el.salvar.disabled = true; el.salvar.addEventListener('click', salvar); }   // começa sem mudança
      if (el.cancelar) el.cancelar.addEventListener('click', function () { carregar(); });
    }

    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return ativo() && sujo(); });
      guardaLigada = true;
    }
  }

  /* a aba Escala ficou ativa: o painel passa a valer; recarrega do mês compartilhado (fresco = descarta
     qualquer edição abandonada ao sair da aba) */
  function ativar() {
    naAba = true;
    var m = RW.extrajornadaMes && RW.extrajornadaMes.obter && RW.extrajornadaMes.obter();
    if (m) comp = new Date(m.getFullYear(), m.getMonth(), 1);
    carregar();
  }
  function desativar() { naAba = false; }

  RW.extrajornadaCotasPainel = { montar: montar, ativar: ativar, desativar: desativar,
    temEdicaoAberta: temEdicaoAberta, descartar: descartar, sincronizarMes: sincronizarMes,
    atualizarContexto: atualizarContexto };
})();
