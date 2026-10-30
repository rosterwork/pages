/* ============================================================
   ESCALAS — Remanejar militar (o menu Editar o dia; só admin).
   Remanejar é mandar o serviço do dia de um militar para outra
   unidade da mesma companhia, só naquele dia: ele sai da unidade
   dele ou fica nas duas. O serviço continua sendo dele, com a mesma
   origem (ciclo, troca ou pontual): não é folga nem mexe no banco
   de horas. Sub-tela em caixas de pergunta, uma depois da outra
   (Guia visual › Ações e perguntas): Quem vai (de serviço nesta
   unidade no dia, menos quem já está remanejado), Para qual unidade
   (as outras unidades da companhia, da lista de unidades) e se ele
   sai da unidade de origem. Vai para o rascunho do Dia
   (escalas-painel-editar.js); nada grava até o Salvar do rodapé do
   painel. O desfazer é o Remover militar (Devolver ou Tirar do dia,
   escalas-painel-remover.js).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var conta = 0;          // nome único para os rádios e o campo de cada abertura
  var unidades = null;    // a lista de unidades (buscar_unidades_ordenadas), lida uma vez

  var TIPOS_ESCALA = ['CIA', 'CIBM', 'PEL'];

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }

  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-remanejar-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* a lista de unidades (uma vez por sessão); null em falha */
  function lerUnidades() {
    if (unidades) return Promise.resolve(unidades);
    return RosterWork.rpc('buscar_unidades_ordenadas', {})
      .then(function (lista) { if (Array.isArray(lista)) unidades = lista; return unidades; })
      .catch(function () { return null; });
  }

  /* as unidades para onde ele pode ir: a companhia e os pelotões dela, menos esta */
  function destinosDe(lista, companhia, uid) {
    return (lista || []).filter(function (u) {
      return TIPOS_ESCALA.indexOf(u.tipo) >= 0 && String(u.unidade_id) !== String(uid)
        && (String(u.unidade_id) === String(companhia) || String(u.unidade_pai_id) === String(companhia));
    });
  }

  /* quem está de serviço nesta unidade no dia (nas funções ou sem função), com o serviço dele ("das 08h às 08h, pelo
     ciclo"): fora quem já está remanejado (gravado ou no rascunho) e quem só está aqui pela extra */
  function itensQuem() {
    var api = ed(), H = api.horas, d = api.dados() || {}, noDia = {}, lista = [], visto = {};
    var pendentes = (api.rascunho().remanejar || []).map(function (r) { return r.cpf; });
    (d.postos || []).forEach(function (po) {
      (po.funcoes || []).forEach(function (f) { (f.militares || []).forEach(function (m) { noDia[m.cpf] = true; }); });
    });
    (d.sem_funcao || []).forEach(function (m) { noDia[m.cpf] = true; });
    (d.picker || []).forEach(function (u) {
      (u.militares || []).forEach(function (pm) {
        if (!noDia[pm.cpf] || visto[pm.cpf] || pm.remanejado || pendentes.indexOf(pm.cpf) >= 0) return;
        var mil = api.militarDoDia(pm.cpf);
        if (!mil || !mil.janelas.some(function (j) { return j.origem !== 'extra'; })) return;
        visto[pm.cpf] = true;
        var jan = mil.janelas.slice().sort(function (a, b) { return H.emMin(a.hi) - H.emMin(b.hi); });
        lista.push({ cpf: pm.cpf, grad: pm.grad, nome: pm.nome, mil: mil,
          info: L().servicoTexto(jan.map(function (j) { return { hi: H.curta(j.hi), hf: H.curta(j.hf), origem: j.origem }; })) });
      });
    });
    return lista;
  }

  function abrir() {
    var api = ed();
    if (!api.dados()) return;
    var uid = api.unidadeId(), companhia = (api.dados() || {}).contexto_id;
    var est = { item: null, destino: null, sai: null, origemNome: '', destinos: [] };
    var el = {}, combo = null;

    function escolher(item) {
      est.item = item;
      atualizar();
    }

    function montar(corpo) {
      var tela = RosterWork.tpl('tpl-escala-remanejar');
      if (!tela) return;
      var q = function (s) { return tela.querySelector(s); };
      el = {
        combo: q('.escala-remanejar-combo'), destino: q('.escala-remanejar-destino'), unidades: q('.escala-remanejar-unidades'),
        vazio: q('.escala-remanejar-vazio'), sai: q('.escala-remanejar-sai'), pergunta: q('.escala-remanejar-sai-pergunta'),
        sim: q('.escala-remanejar-sai-sim'), nao: q('.escala-remanejar-sai-nao')
      };
      var inp = el.combo.querySelector('input');
      inp.id = 'escala-remanejar-combo-' + (++conta);
      combo = RosterWork.comboMilitar.criar(inp, el.combo.querySelector('.dropdown-menu'), {
        atual: function () { return est.item; },
        aoEscolher: escolher,
        textos: { selecione: L().digiteOuEscolha, semNinguem: L().ninguemDeServico, filtroVazio: msg().ninguemEncontrado }
      });
      el.marcarSai = ligarRadios(el.sai, function (v) { est.sai = v; atualizar(); });
      corpo.appendChild(tela);
      combo.preencher(itensQuem());
      atualizar();
      /* as unidades da companhia chegam depois: até lá, a lista fica vazia */
      lerUnidades().then(function (lista) {
        if (!el.unidades || !el.unidades.isConnected) return;
        if (!lista) { RosterWork.avisar({ tipo: 'erro', mensagem: msg().falhaCarregar }); return; }
        var aqui = lista.filter(function (u) { return String(u.unidade_id) === String(uid); })[0];
        est.origemNome = aqui ? aqui.nome : '';
        est.destinos = destinosDe(lista, companhia, uid);
        montarDestinos();
        atualizar();
      });
    }

    function montarDestinos() {
      el.unidades.textContent = '';
      el.vazio.classList.toggle('oculto', est.destinos.length > 0);
      var nome = 'escala-remanejar-unidade-' + (++conta);
      est.destinos.forEach(function (u) {
        var op = RosterWork.tpl('tpl-escala-remanejar-unidade');
        if (!op) return;
        var r = op.querySelector('input');
        r.name = nome;
        r.value = String(u.unidade_id);
        r.addEventListener('change', function () { if (r.checked) { est.destino = u; atualizar(); } });
        op.querySelector('.escala-remanejar-unidade-nome').textContent = u.nome;
        el.unidades.appendChild(op);
      });
    }

    /* ---------- desenho ---------- */

    function mostra(caixa, sim) { caixa.classList.toggle('oculto', !sim); }

    function pronto(texto, ligado) {
      api.rotuloAplicar(texto);
      api.travarAplicar(!ligado);
    }

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      mostra(el.destino, false);
      mostra(el.sai, false);
      if (!est.item) { pronto(L().escolhaQuemVai, false); return; }
      mostra(el.destino, true);
      if (!est.destino) { pronto(L().escolhaUnidade, false); return; }
      var nome = nomeDe(est.item), destino = est.destino.nome;
      mostra(el.sai, true);
      el.pergunta.textContent = L().remanejarSai(nome, est.origemNome);
      el.sim.textContent = L().remanejarSoNa(destino);
      el.nao.textContent = L().remanejarNasDuas(est.origemNome, destino);
      el.marcarSai(est.sai);
      if (!est.sai) { pronto(L().escolhaSeSai, false); return; }
      pronto(L().remanejar(nome, destino), true);
    }

    /* ---------- aplicar ---------- */

    function aplicar() {
      if (!est.item || !est.destino || !est.sai) return;   // o botão já fica desligado
      api.remanejar(est.item.cpf, est.destino.unidade_id, est.sai === 'fica');
      api.concluir();
    }

    api.abrir(L().escolhaQuemVai, montar, aplicar);
  }

  window.RosterWork.escalasPainelRemanejar = { abrir: abrir };
})();
