/* ============================================================
   USUÁRIOS — a ficha: os períodos de um tipo de afastamento
   (RosterWork.usuariosPainelAfastamentosEditar)
   A sub-tela do lápis de cada caixa (Férias, um tipo de licença ou
   de dispensa), no lugar da ficha: o tipo e o ano no título e uma
   caixa por período daquele ano, com início → fim e os dias; em
   licença e dispensa, o "Tirar do fluxo da escala?" (sugere Sim a
   partir de 16 dias, até o administrador escolher) e o Motivo. O
   que é de mais de uma semana atrás fica travado (o mesmo limite do
   banco): o período que terminou antes não muda; o que começou antes
   mantém o início e a decisão do fluxo e não sai. Salvar manda a
   lista inteira do tipo, de todos os anos (ferias_salvar ou
   licencas_salvar); o banco avisa antes o que o militar já tem nos
   dias novos e quando ele continua fora da escala, e o
   administrador decide se segue.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var est = null;   // a sub-tela aberta: { ctx, ctl, raiz, linhas, removidos, salvando, problema, incompleta }

  function M() { return RosterWork.mensagens.afastamentos; }
  function D() { return RosterWork.data; }
  function comFluxo() { return est.ctx.categoria !== 'ferias'; }

  /* meia-noite de hoje − 7 dias: o dia mais antigo que ainda muda (o mesmo limite do banco) */
  function limite() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d;
  }

  /* um período gravado vira linha; só os que tocam o ano aparecem (os outros vão junto, como estão) */
  function linhaGravada(x, lim, ano) {
    var ini = D().isoParaBR(x.data_inicio), fim = D().isoParaBR(x.data_fim);
    var fora = x.fora_do_fluxo == null ? null : !!x.fora_do_fluxo;
    return {
      id: x.id, ini: ini, fim: fim, origIni: ini, origFim: fim,
      fora: fora, origFora: fora, escolheu: true, motivo: x.motivo || '', origMotivo: x.motivo || '',
      iniTravado: D().paraData(ini) < lim, fimTravado: D().paraData(fim) < lim,
      situacao: RosterWork.usuariosPainelAfastamentos.situacao(x.data_inicio, x.data_fim),
      visivel: String(x.data_inicio) <= ano + '-12-31' && String(x.data_fim) >= ano + '-01-01'
    };
  }
  function linhaNova() {
    return { id: null, ini: '', fim: '', origIni: '', origFim: '', fora: false, origFora: null, escolheu: false,
      motivo: '', origMotivo: '', iniTravado: false, fimTravado: false, situacao: M().novo, visivel: true };
  }
  function vazia(l) { return !l.id && !l.ini && !l.fim; }

  function alterada(l) {
    if (!l.id) return !vazia(l);
    return l.ini !== l.origIni || l.fim !== l.origFim || l.fora !== l.origFora || l.motivo !== l.origMotivo;
  }
  function mudancas() {
    if (!est) return 0;
    return est.removidos.length + est.linhas.filter(alterada).length;
  }

  /* confere as linhas: os dias, a sugestão do fluxo, o que está errado (o 1º problema vai para a nota) */
  function avaliar() {
    var e = est;
    if (!e) return;
    var lim = limite();
    var vespera = new Date(lim);
    vespera.setDate(vespera.getDate() - 1);
    var problema = '', incompleta = false, validas = [];
    e.linhas.forEach(function (l) {
      l.erro = false;
      l.di = D().paraData(l.ini);
      l.df = D().paraData(l.fim);
      l.dias = l.di && l.df && l.df >= l.di ? Math.round((l.df - l.di) / 86400000) + 1 : 0;
      if (vazia(l)) return;
      if (!l.di || !l.df) { incompleta = true; return; }
      if (l.df < l.di) { l.erro = true; problema = problema || M().fimAntes; return; }
      /* nenhum dia de antes do limite entra nem sai */
      if ((l.ini !== l.origIni && l.di < lim) || (l.fim !== l.origFim && l.df < vespera)) {
        l.erro = true;
        problema = problema || M().limite(D().paraBR(lim));
        return;
      }
      /* sem a escolha do administrador, a regra dos dias: a partir de 16 sai do fluxo */
      if (comFluxo() && !l.escolheu) l.fora = l.dias >= 16;
      validas.push(l);
    });
    /* períodos que se cruzam (os deste tipo, de todos os anos): marca o de baixo */
    validas.forEach(function (l, i) {
      for (var j = 0; j < i; j++) {
        var o = validas[j];
        if (l.di <= o.df && o.di <= l.df) {
          l.erro = true;
          problema = problema || M().cruza(o.ini + ' a ' + o.fim);
          break;
        }
      }
    });
    e.problema = problema;
    e.incompleta = incompleta;
    e.linhas.forEach(pintarLinha);
    var nota = e.raiz.querySelector('[data-periodos-nota]');
    if (nota) {
      nota.querySelector('.nota-texto').textContent = problema;
      nota.classList.toggle('oculto', !problema);
    }
    e.ctl.aoMudar();
  }

  /* os dias, o erro e a decisão do fluxo de uma linha na tela */
  function pintarLinha(l) {
    if (!l.el) return;
    l.el.querySelector('[data-periodo-campo]').classList.toggle('campo--erro', !!l.erro);
    var dias = l.el.querySelector('[data-periodo-dias]');
    dias.textContent = l.dias ? M().dias(l.dias) : '';
    dias.classList.toggle('oculto', !l.dias);
    if (!comFluxo()) return;
    l.el.querySelector('[data-periodo-fluxo]').classList.toggle('oculto', !l.dias);
    Array.prototype.forEach.call(l.el.querySelectorAll('[data-fora]'), function (b) {
      b.classList.toggle('aba--ativa', (b.getAttribute('data-fora') === 'sim') === !!l.fora);
    });
    l.el.querySelector('[data-periodo-fluxo-texto]').textContent = l.fora ? M().foraDoFluxo : M().segueNoFluxo;
  }

  /* um campo de data: travado, ou com máscara e calendário */
  function ligarData(input, l, chave, travado) {
    input.value = l[chave];
    input.disabled = travado;
    if (travado) return;
    RosterWork.campos.ligarData(input);
    input.addEventListener('input', function () { l[chave] = input.value; avaliar(); });
  }

  /* uma caixa por período (molde #tpl-ficha-periodo) */
  function montarLinha(lista, l) {
    var el = RosterWork.tpl('tpl-ficha-periodo');
    if (!el) return;
    el.querySelector('[data-periodo-situacao]').textContent = l.situacao;
    ligarData(el.querySelector('[data-periodo-inicio]'), l, 'ini', l.iniTravado);
    ligarData(el.querySelector('[data-periodo-fim]'), l, 'fim', l.fimTravado);
    var remover = el.querySelector('[data-periodo-remover]');
    if (l.iniTravado) remover.classList.add('oculto');
    else remover.addEventListener('click', function () { removerLinha(l); });
    el.querySelector('[data-periodo-travado]').classList.toggle('oculto', !l.fimTravado);
    if (comFluxo()) {
      Array.prototype.forEach.call(el.querySelectorAll('[data-fora]'), function (b) {
        b.disabled = l.iniTravado;
        b.addEventListener('click', function () {
          l.fora = b.getAttribute('data-fora') === 'sim';
          l.escolheu = true;
          avaliar();
        });
      });
      var motivo = el.querySelector('[data-periodo-motivo]');
      var texto = motivo.querySelector('textarea');
      motivo.classList.remove('oculto');
      texto.value = l.motivo;
      texto.disabled = l.fimTravado;
      texto.addEventListener('input', function () { l.motivo = texto.value; avaliar(); });
    }
    l.el = el;
    lista.appendChild(el);
  }

  /* (re)desenha as caixas dos períodos do ano */
  function desenhar() {
    var lista = est.raiz.querySelector('[data-periodos]');
    if (!lista) return;
    lista.textContent = '';
    est.linhas.forEach(function (l) {
      l.el = null;
      if (l.visivel) montarLinha(lista, l);
    });
    avaliar();
  }

  function removerLinha(l) {
    if (l.id) est.removidos.push(l.id);
    est.linhas.splice(est.linhas.indexOf(l), 1);
    desenhar();
  }

  function adicionarLinha() {
    var nova = linhaNova();
    est.linhas.push(nova);
    desenhar();
    if (nova.el) nova.el.querySelector('[data-periodo-inicio]').focus();
  }

  /* ---------- gravar ---------- */

  /* o que o militar já tem nos dias novos (troca, extra, folga) e se continua fora da escala */
  function itensConfirmar(r) {
    var S = RosterWork.mensagens.saida;
    var situacoes = RosterWork.mensagens.folgas.situacao;
    var itens = [];
    (r.trocas || []).forEach(function (t) { itens.push({ titulo: S.tituloTroca, texto: M().itemTroca(t.data, t.com_quem) }); });
    (r.extras || []).forEach(function (x) { itens.push({ titulo: S.tituloExtra, texto: M().itemExtra(x.data, x.unidade) }); });
    (r.folgas || []).forEach(function (f) {
      itens.push({ titulo: S.tituloFolga, texto: M().itemFolga(f.data, (situacoes[f.situacao] || '').toLowerCase()) });
    });
    return itens;
  }

  function salvar(confirmar) {
    var e = est;
    if (!e || e.salvando) return;
    var c = e.ctx;
    var periodos = e.linhas.filter(function (l) { return !vazia(l); }).map(function (l) {
      if (c.categoria === 'ferias') return { ferias_id: l.id, inicio: D().paraISO(l.ini), fim: D().paraISO(l.fim) };
      return { licenca_id: l.id, inicio: D().paraISO(l.ini), fim: D().paraISO(l.fim), fora_do_fluxo: !!l.fora, motivo: l.motivo };
    });
    var dados = RosterWork.usuariosAfastamentosDados;
    var pedido = c.categoria === 'ferias'
      ? dados.salvarFerias({ p_usuario_id: c.pessoa.usuario_id, p_periodos: periodos, p_confirmar: !!confirmar })
      : dados.salvarLicencas({ p_usuario_id: c.pessoa.usuario_id, p_categoria: c.categoria, p_tipo: c.tipo,
          p_periodos: periodos, p_confirmar: !!confirmar });
    e.salvando = true;
    e.ctl.aoMudar();
    if (RosterWork.mostrarVeuGlobal) RosterWork.mostrarVeuGlobal();   // recalcula a escala: círculo + tela travada
    pedido.then(function (r) {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      e.salvando = false;
      if (est === e) e.ctl.aoMudar();
      if (r && r._falha === 'servidor') {
        RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
      } else if (r && r.precisa_confirmar) {   // ele já tem serviço ou folga nos dias novos, ou continua fora da escala
        var itens = itensConfirmar(r);
        var temServico = itens.length > 0;
        if (r.continua_fora) itens.push({ titulo: RosterWork.mensagens.saida.tituloEscala, texto: M().itemContinuaFora(r.continua_fora) });
        RosterWork.confirmar({
          tipo: 'aviso', mensagem: temServico ? M().confirmarTem : M().confirmarSo, itens: itens,
          nota: temServico ? M().notaConfirmar : '',
          textoConfirmar: RosterWork.mensagens.botoes.continuar, textoCancelar: RosterWork.mensagens.botoes.cancelar,
          aoConfirmar: function () { salvar(true); }
        });
      } else if (r && r.success) {
        e.ctl.concluir(r);
      } else {
        RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.geral.falhaServidor });
      }
    }).catch(function () {
      if (RosterWork.esconderVeuGlobal) RosterWork.esconderVeuGlobal();
      e.salvando = false;
      if (est === e) e.ctl.aoMudar();
      RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
    });
  }

  /* ---------- a sub-tela ---------- */

  /* ctx = { pessoa, categoria, tipo, rotulo, ano, periodos (os do tipo, de todos os anos) };
     ctl = { aoMudar, concluir } (usuarios-painel.js). Devolve a sub-tela para o rodapé */
  function montarSubtela(corpo, ctx, ctl) {
    var raiz = RosterWork.tpl('tpl-ficha-sub-afastamento');
    if (!raiz) return null;
    raiz.querySelector('[data-sub-titulo]').textContent = ctx.rotulo;
    raiz.querySelector('[data-sub-subtitulo]').textContent = M().subtitulo(ctx.ano);
    corpo.appendChild(raiz);
    var lim = limite();
    est = { ctx: ctx, ctl: ctl, raiz: raiz, removidos: [], salvando: false, problema: '', incompleta: false,
      linhas: (ctx.periodos || []).map(function (x) { return linhaGravada(x, lim, ctx.ano); }) };
    /* sem período no ano, já abre com um em branco */
    if (!est.linhas.some(function (l) { return l.visivel; })) est.linhas.push(linhaNova());
    raiz.querySelector('[data-periodo-adicionar]').addEventListener('click', adicionarLinha);
    desenhar();
    var e = est;
    return {
      textoAplicar: RosterWork.mensagens.botoes.salvar,
      mudancas: function () { return est === e ? mudancas() : 0; },
      podeAplicar: function () { return est === e && !e.salvando && mudancas() > 0 && !e.problema && !e.incompleta; },
      sujo: function () { return est === e && mudancas() > 0; },
      aplicar: function () { salvar(false); }
    };
  }

  function reset() { est = null; }

  window.RosterWork.usuariosPainelAfastamentosEditar = { montarSubtela: montarSubtela, reset: reset };
})();
