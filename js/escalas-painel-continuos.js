/* ============================================================
   ESCALA — painel do dia › seção CONTÍNUOS (ciclo automático)
   Lista os militares operacionais da unidade divididos em
   "Na escala" (no ciclo, com Tirar / Cancelar saída) e
   "Fora da escala" (com Adicionar). No modo Ver é só leitura.
   Cada ação chama o banco na hora (valida admin + audita) e,
   no sucesso, abre o resumo e re-renderiza a grade.
   Reaproveita as peças do geral-painel e do escalas-painel.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var ctx = null;   // { corpo, unidadeId, iso, editar }

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

  function seloSaida(dataIso) {
    var selo = RosterWork.tpl('tpl-escala-secao-selo');
    if (selo) selo.textContent = texto(msg().continuosSaiEm, { data: formatarData(dataIso) });
    return selo;
  }

  /* re-renderiza a seção a partir do banco */
  function renderizar() {
    if (!ctx) return;
    var corpo = ctx.corpo;
    corpo.textContent = '';
    var carregando = RosterWork.tpl('tpl-escala-distribuicao-carregando');
    if (carregando) corpo.appendChild(carregando);

    RosterWork.escalasDados.continuosListar(ctx.unidadeId, ctx.iso).then(function (dados) {
      if (!ctx || ctx.corpo !== corpo) return;
      corpo.textContent = '';
      if (!dados || !dados.ok) {
        var e = RosterWork.tpl('tpl-escala-distribuicao-estado');
        if (e) { e.textContent = msg().falhaCarregar; corpo.appendChild(e); }
        return;
      }
      var mils = dados.militares || [];
      /* "Na escala" = só quem o ciclo escala NESTE dia (de serviço ou de folga); os demais do
         ciclo (de descanso do rodízio) não aparecem no dia. "Fora" = quem não está no ciclo. */
      var naEscala = mils.filter(function (m) { return m.estado !== 'fora' && (m.serve_hoje || m.folga_hoje); });
      var fora = mils.filter(function (m) { return m.estado === 'fora'; });

      var caixas = [];
      if (mils.length) RosterWork.escalasPainel.pecas.montarBusca(corpo, caixas);

      var caixaNa = RosterWork.painel.criarCaixa(msg().continuosNaEscala);
      if (caixaNa) {
        if (!naEscala.length) caixaVazia(caixaNa, msg().continuosVazioNaEscala);
        naEscala.forEach(function (m) {
          var extra = (m.estado === 'saida_marcada') ? seloSaida(m.saida_em) : null;
          var acao = null;
          if (ctx.editar) {
            if (m.estado === 'saida_marcada') {
              acao = botao(msg().btnCancelarSaida, null, function () { cancelarSaida(m); });
            } else {
              acao = botao(msg().btnTirar, 'escala-secao-botao--perigo', function () { tirar(m); });
            }
          }
          var el = linha(m, extra, acao);
          if (el && m.folga_hoje && !m.serve_hoje) {   // é dia dele, mas está de folga: nome riscado
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
          var acao = ctx.editar ? botao(msg().btnAdicionar, 'botao--primario', function () { adicionar(m); }) : null;
          caixaFora.appendChild(linha(m, null, acao));
        });
        corpo.appendChild(caixaFora);
        caixas.push(caixaFora);
      }
    });
  }

  /* enquanto o recálculo do ciclo roda no banco (leva alguns segundos): véu com spinner
     sobre a escala + bloqueio de clique da tela toda; liberados quando a ação termina */
  function liberar() { if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal(); }
  function acao(promessa) {
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();
    promessa.then(tratar, liberar);
  }

  /* trata o retorno de uma ação: falha de rede/servidor, erro do banco, ou sucesso (resumo + recarrega) */
  function tratar(r) {
    liberar();
    if (r && r._falha === 'conexao') { RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao }); return; }
    if (r && r._falha === 'servidor') { RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor }); return; }
    if (r && r.success) {
      renderizar();
      window.dispatchEvent(new CustomEvent('rosterwork_escala_recarregar'));
      if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Escala' });
    } else {
      RosterWork.avisar && RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || msg().falhaAcaoCiclo });
    }
  }

  function adicionar(m) {
    acao(RosterWork.escalasDados.cicloAdicionar(ctx.unidadeId, m.cpf, ctx.iso, RosterWork.sessao.cpf()));
  }
  function cancelarSaida(m) {
    acao(RosterWork.escalasDados.cicloCancelarSaida(ctx.unidadeId, m.cpf, ctx.iso, RosterWork.sessao.cpf()));
  }
  function tirar(m) {
    var base = texto(msg().confirmarTirar, { pessoa: (m.grad || '') + ' ' + (m.nome || ''), data: formatarData(ctx.iso) });
    /* analisa antes o que vai quebrar (trocas/folgas) para avisar no modal; se a análise
       falhar, segue com o aviso simples (a remoção no banco é que cancela de fato) */
    RosterWork.escalasDados.cicloRetirarAnalisar(ctx.unidadeId, m.cpf, ctx.iso, RosterWork.sessao.cpf()).then(function (a) {
      var pend = (a && a.success && a.pendencias) || null;
      var mensagem = base + (RosterWork.textoImpactoSaida ? RosterWork.textoImpactoSaida(pend) : '');
      confirmarTirada(m, mensagem);
    });
  }

  function confirmarTirada(m, mensagem) {
    if (RosterWork.confirmar) {
      RosterWork.confirmar({
        tipo: 'aviso', mensagem: mensagem,
        textoConfirmar: msg().btnTirar,
        aoConfirmar: function () { acao(RosterWork.escalasDados.cicloRetirar(ctx.unidadeId, m.cpf, ctx.iso, RosterWork.sessao.cpf())); }
      });
    } else {
      acao(RosterWork.escalasDados.cicloRetirar(ctx.unidadeId, m.cpf, ctx.iso, RosterWork.sessao.cpf()));
    }
  }

  function montar(corpo, rodape, unidadeId, iso, editar) {
    ctx = { corpo: corpo, unidadeId: unidadeId, iso: iso, editar: !!editar };
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }   // ações são inline (salvam na hora)
    renderizar();
  }

  function reset() { ctx = null; }

  window.RosterWork.escalasPainelContinuos = { montar: montar, reset: reset };
})();
