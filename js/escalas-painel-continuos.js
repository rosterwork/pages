/* ============================================================
   ESCALA — painel do dia › seção CONTÍNUOS (ciclo automático)
   Lista os militares operacionais da unidade divididos em
   "Na escala" (no ciclo, com Tirar / Cancelar saída) e
   "Fora da escala" (com Adicionar). No modo Ver é só leitura.
   No modo Editar as mudanças NÃO vão ao banco a cada clique:
   ficam acumuladas na tela (selo "Vai entrar" / "Vai sair") e
   só o Salvar aplica tudo de uma vez, recalculando a escala
   UMA vez (RPC escala_ciclo_salvar_lote). O "Tirar" ainda mostra
   o aviso da cascata (trocas/folgas) na hora do clique.
   Reaproveita as peças do geral-painel e do escalas-painel.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;        // { corpo, rodape, unidadeId, iso, editar, btnSalvar }
  var mils = [];         // militares carregados do banco
  var pendentes = {};    // cpf -> { acao: 'adicionar'|'tirar'|'cancelar_saida', horario? }

  function msg() { return (RosterWork.mensagens && RosterWork.mensagens.escala) || {}; }

  /* "2026-08-01" -> "01/08/2026" */
  function formatarData(iso) {
    var p = (iso || '').split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : (iso || '');
  }
  function texto(t, dados) {
    return (t || '').replace(/\{(\w+)\}/g, function (_, k) { return dados && dados[k] != null ? dados[k] : ''; });
  }

  function botao(rotulo, variante, aoClicar) {
    var b = RosterWork.tpl('tpl-escala-secao-botao');
    if (!b) return null;
    b.textContent = rotulo;
    if (variante) b.classList.add(variante);
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* uma linha da lista: grad + nome + (selo/vazio no extra) + (botão na ação) */
  function linha(m, extraEl, acaoEl) {
    var el = RosterWork.tpl('tpl-escala-secao-item');
    if (!el) return null;
    el.querySelector('.escala-secao-grad').textContent = m.grad || '';
    el.querySelector('.escala-secao-nome').textContent = m.nome || '';
    if (extraEl) el.querySelector('.escala-secao-extra').appendChild(extraEl);
    if (acaoEl) el.querySelector('.escala-secao-acao').appendChild(acaoEl);
    return el;
  }

  function caixaVazia(caixa, txt) {
    var v = RosterWork.tpl('tpl-escala-secao-vazio');
    if (v) { v.textContent = txt; caixa.appendChild(v); }
  }

  function seloTexto(txt) {
    var selo = RosterWork.tpl('tpl-escala-secao-selo');
    if (selo) selo.textContent = txt;
    return selo;
  }

  /* ---------- estado "sujo" (há mudança acumulada) ---------- */
  function sujoAgora() { return Object.keys(pendentes).length > 0; }
  function atualizarSalvar() { if (ctx && ctx.btnSalvar) ctx.btnSalvar.disabled = !sujoAgora(); }
  function marcarSujo() { atualizarSalvar(); }

  function pendenciaDe(cpf) { return pendentes[cpf] || null; }
  function desfazerPendente(cpf) { delete pendentes[cpf]; marcarSujo(); renderizar(); }

  /* ---------- ações: só marcam a intenção na tela ---------- */
  function adicionar(m) {
    pendentes[m.cpf] = { acao: 'adicionar', horario: '08:00' };
    marcarSujo(); renderizar();
  }
  function cancelarSaida(m) {
    pendentes[m.cpf] = { acao: 'cancelar_saida' };
    marcarSujo(); renderizar();
  }
  /* o Tirar ainda avisa da cascata (trocas/folgas) na hora, antes de entrar na lista */
  function tirar(m) {
    var base = texto(msg().confirmarTirar, { pessoa: (m.grad || '') + ' ' + (m.nome || ''), data: formatarData(ctx.iso) });
    RosterWork.escalasDados.cicloRetirarAnalisar(ctx.unidadeId, m.cpf, ctx.iso, RosterWork.sessao.cpf()).then(function (a) {
      var pend = (a && a.success && a.pendencias) || null;
      var mensagem = base + (RosterWork.textoImpactoSaida ? RosterWork.textoImpactoSaida(pend) : '');
      if (RosterWork.confirmar) {
        RosterWork.confirmar({
          tipo: 'aviso', mensagem: mensagem, textoConfirmar: msg().btnTirar,
          aoConfirmar: function () { pendentes[m.cpf] = { acao: 'tirar' }; marcarSujo(); renderizar(); }
        });
      } else {
        pendentes[m.cpf] = { acao: 'tirar' }; marcarSujo(); renderizar();
      }
    });
  }

  /* ---------- desenho ---------- */
  function renderizar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    corpo.textContent = '';

    var caixas = [];
    if (mils.length) RosterWork.escalasPainel.pecas.montarBusca(corpo, caixas);

    /* "Na escala" = só quem o ciclo escala NESTE dia (de serviço ou de folga); os demais do
       ciclo (de descanso do rodízio) não aparecem no dia. "Fora" = quem não está no ciclo.
       As mudanças pendentes NÃO movem o militar de caixa (o rodízio do dia é do banco):
       ele fica no lugar com o selo da intenção, e a posição real vem depois do Salvar. */
    var naEscala = mils.filter(function (m) { return m.estado !== 'fora' && (m.serve_hoje || m.folga_hoje); });
    var fora = mils.filter(function (m) { return m.estado === 'fora'; });

    var caixaNa = RosterWork.painel.criarCaixa(msg().continuosNaEscala);
    if (caixaNa) {
      if (!naEscala.length) caixaVazia(caixaNa, msg().continuosVazioNaEscala);
      naEscala.forEach(function (m) {
        var pend = pendenciaDe(m.cpf);
        var extra = null, acao = null;
        if (pend) {
          extra = seloTexto(pend.acao === 'tirar' ? msg().continuosVaiSair : msg().continuosVaiCancelar);
          if (ctx.editar) acao = botao(msg().continuosDesfazer, null, function () { desfazerPendente(m.cpf); });
        } else {
          if (m.estado === 'saida_marcada') extra = seloTexto(texto(msg().continuosSaiEm, { data: formatarData(m.saida_em) }));
          if (ctx.editar) {
            if (m.estado === 'saida_marcada') acao = botao(msg().btnCancelarSaida, null, function () { cancelarSaida(m); });
            else acao = botao(msg().btnTirar, 'escala-secao-botao--perigo', function () { tirar(m); });
          }
        }
        var el = linha(m, extra, acao);
        if (el && !pend && m.folga_hoje && !m.serve_hoje) {   // é dia dele, mas está de folga: nome riscado
          el.classList.add('escala-secao-item--folga');
          el.setAttribute('data-dica', msg().continuosDeFolga || '');
        }
        if (el) caixaNa.appendChild(el);
      });
      corpo.appendChild(caixaNa);
      caixas.push(caixaNa);
    }

    var caixaFora = RosterWork.painel.criarCaixa(msg().continuosFora);
    if (caixaFora) {
      if (!fora.length) caixaVazia(caixaFora, msg().continuosVazioFora);
      fora.forEach(function (m) {
        var pend = pendenciaDe(m.cpf);   // para um "fora", só faz sentido 'adicionar'
        var extra = null, acao = null;
        if (pend) {
          extra = seloTexto(msg().continuosVaiEntrar);
          if (ctx.editar) acao = botao(msg().continuosDesfazer, null, function () { desfazerPendente(m.cpf); });
        } else if (ctx.editar) {
          acao = botao(msg().btnAdicionar, 'botao--primario', function () { adicionar(m); });
        }
        caixaFora.appendChild(linha(m, extra, acao));
      });
      corpo.appendChild(caixaFora);
      caixas.push(caixaFora);
    }
  }

  /* ---------- rodapé (Cancelar / Salvar), igual aos Pontuais ---------- */
  function montarRodape() {
    var rodape = ctx.rodape;
    if (!rodape) return;
    rodape.textContent = '';
    if (!ctx.editar) { rodape.classList.add('oculto'); return; }
    var tpl = document.getElementById('tpl-escala-painel-acoes');
    if (!tpl) { rodape.classList.add('oculto'); return; }
    rodape.appendChild(tpl.content.cloneNode(true));
    rodape.classList.remove('oculto');
    var cancelar = rodape.querySelector('.escala-painel-cancelar');
    if (cancelar) cancelar.addEventListener('click', aoClicarCancelar);
    ctx.btnSalvar = rodape.querySelector('.escala-painel-salvar');
    if (ctx.btnSalvar) ctx.btnSalvar.addEventListener('click', salvar);
    atualizarSalvar();
  }

  function aoClicarCancelar() {
    if (sujoAgora() && RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso', mensagem: RosterWork.mensagens.escala.descartarAlteracoes,
        textoConfirmar: RosterWork.mensagens.botoes.descartar,
        textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
        aoConfirmar: carregar
      });
    } else {
      carregar();
    }
  }

  function salvar() {
    if (!ctx || !sujoAgora()) return;
    var uid = ctx.unidadeId, iso = ctx.iso;
    var mudancas = Object.keys(pendentes).map(function (cpf) {
      var p = pendentes[cpf];
      var o = { cpf: cpf, acao: p.acao };
      if (p.horario) o.horario = p.horario;
      return o;
    });
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    RosterWork.escalasDados.cicloSalvarLote(uid, iso, mudancas, RosterWork.sessao.cpf()).then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      if (r && r._falha === 'conexao') { RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao }); return; }
      if (r && r._falha === 'servidor') { RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor }); return; }
      if (r && r.success) {
        pendentes = {};
        window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
        if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
        carregar();
      } else {
        RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.escala.falhaSalvar });
      }
    });
  }

  /* carrega (ou recarrega) do banco → memória → desenha (limpa o que estava acumulado) */
  function carregar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var carregando = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (carregando) corpo.appendChild(carregando);

    RosterWork.escalasDados.continuosListar(ctx.unidadeId, ctx.iso).then(function (dados) {
      if (!ctx || ctx.corpo !== corpo) return;
      if (!dados || !dados.ok) {
        corpo.textContent = '';
        var e = RosterWork.tpl('tpl-escala-distribuicao-estado');
        if (e) { e.textContent = msg().falhaCarregar; corpo.appendChild(e); }
        return;
      }
      mils = dados.militares || [];
      pendentes = {};
      atualizarSalvar();
      renderizar();
    });
  }

  function montar(corpo, rodape, unidadeId, iso, editar) {
    ctx = { corpo: corpo, rodape: rodape, unidadeId: unidadeId, iso: iso, editar: !!editar, btnSalvar: null };
    mils = [];
    pendentes = {};
    montarRodape();
    carregar();
  }

  function reset() { ctx = null; mils = []; pendentes = {}; }

  if (RosterWork.guardaSaida && RosterWork.guardaSaida.registrar) {
    RosterWork.guardaSaida.registrar(function () { return sujoAgora(); });
  }

  window.RosterWork.escalasPainelContinuos = { montar: montar, reset: reset, estaSujo: function () { return sujoAgora(); } };
})();
