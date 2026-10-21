/* ============================================================
   ESCALAS — Editar posto (sub-tela do painel do dia, só admin)
   Abre pelo botão do título de cada posto. Instalação: o efetivo
   (mínimo, ideal e máximo). Viatura: o efetivo e a viatura (prefixo
   e CNH); quando um dos dois muda, aparecem "A partir de" (já com o
   dia do painel) e "Até" (sem ele, a troca é para sempre). Os campos
   vêm do componente geral-posto-editar, os mesmos do painel de Postos.
   O Salvar grava fora do rascunho do dia (atualizar_viatura ou
   atualizar_instalacao, sem mexer no estado), abre o resumo, relê o
   dia e manda a escala recarregar (a troca vale para vários dias).
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var formAberto = null;   // { el, mudou } enquanto a sub-tela está na tela (guarda de saída)

  function ed() { return RosterWork.escalasPainelEditar.sub; }

  /* posto = o posto do dia (ler_distribuicao_dia): id, tipo, nome, cnh e o efetivo */
  function abrir(posto) {
    var api = ed();
    if (!api || !posto) return;
    var ehViatura = posto.tipo === 'viatura';
    var original = { min: posto.efetivo_minimo, ideal: posto.efetivo_ideal, max: posto.efetivo_maximo };
    var efetivo = null, viatura = null;

    function mudouEfetivo() {
      var e = efetivo.valores();
      return e.min !== original.min || e.ideal !== original.ideal || e.max !== original.max;
    }
    function podeSalvar() {
      if (!efetivo || !efetivo.valido()) return false;
      if (viatura && !viatura.valido()) return false;
      return mudouEfetivo() || !!(viatura && viatura.valores().mudou);
    }
    function atualizar() { api.travarAplicar(!podeSalvar()); }

    api.abrir(RosterWork.mensagens.botoes.salvar, function (corpo) {
      var tela = RosterWork.tpl('tpl-escala-posto-form');
      if (!tela) return;
      tela.querySelector('.subtela-subtitulo').textContent = posto.nome || '';
      var caixaEfetivo = RosterWork.painel.criarCaixa('Efetivo');
      efetivo = RosterWork.postoEditar.efetivo(original, atualizar);
      if (caixaEfetivo && efetivo) { caixaEfetivo.appendChild(efetivo.el); tela.appendChild(caixaEfetivo); }
      if (ehViatura) {
        var caixaViatura = RosterWork.painel.criarCaixa('Viatura');
        viatura = RosterWork.postoEditar.viatura({
          viaturaId: posto.id, prefixo: posto.nome, cnh: posto.cnh,
          comDatas: true, dataPadrao: api.iso(), aoMudar: atualizar
        });
        if (caixaViatura && viatura) { caixaViatura.appendChild(viatura.el); tela.appendChild(caixaViatura); }
      }
      corpo.appendChild(tela);
      formAberto = { el: tela, mudou: function () { return mudouEfetivo() || !!(viatura && viatura.valores().mudou); } };
    }, function () { salvar(); });
    atualizar();

    function salvar() {
      if (!podeSalvar()) return;
      var e = efetivo.valores();
      var rota, corpo;
      if (ehViatura) {
        rota = '/rest/v1/rpc/atualizar_viatura';
        corpo = { p_viatura_id: posto.id, p_status: null,
          p_efetivo_min: e.min, p_efetivo_ideal: e.ideal, p_efetivo_max: e.max };
        var v = viatura.valores();
        if (v.mudou) { corpo.p_prefixo = v.prefixo; corpo.p_cnh = v.cnh; corpo.p_troca_inicio = v.inicio; corpo.p_troca_fim = v.fim; }
      } else {
        rota = '/rest/v1/rpc/atualizar_instalacao';
        corpo = { p_instalacao_id: posto.id, p_estado: null,
          p_efetivo_min: e.min, p_efetivo_ideal: e.ideal, p_efetivo_max: e.max };
      }
      /* a troca de CNH refaz a escala: círculo + tela travada */
      if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();
      RosterWork.apiFetch(rota, { metodo: 'POST', corpo: corpo })
        .then(function (resp) { if (!resp.ok) return { _falha: 'servidor' }; return resp.json(); })
        .then(function (r) {
          if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
          if (r && r._falha === 'servidor') {
            RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
            return;
          }
          if (!r || !r.success) {
            RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.postoEditar.falhaSalvar });
            return;
          }
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
          api.reler();
          window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
        })
        .catch(function () {
          if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
          RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
        });
    }
  }

  /* guarda de saída: o navegador avisa ao fechar ou recarregar com o posto alterado e não salvo */
  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return !!(formAberto && formAberto.el.isConnected && formAberto.mudou()); });
  }

  window.RosterWork.escalasPainelPosto = { abrir: abrir };
})();
