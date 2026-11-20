/* ============================================================
   AJUSTES — aba Pontuação: o placar da distribuição da Escala
   O que nunca quebra, a ordem das regras (fixas, no ajustes.html) e a
   balança (pontuacao_escala_ler): trocar de viatura, trocar de função,
   mudar o resto do plantão em curso e a antiguidade dentro da mesma
   graduação, cada uma em Pouco, Normal ou Muito, com a frase do peso
   escolhido (as três frases fixas no HTML). Vale para todas as
   unidades: todo administrador vê; só o administrador geral muda.
   Com a mudança, a prévia dos próximos 14 dias aparece sozinha
   (pontuacao_escala_previa): de cada unidade, duas contas, com os pesos
   que valem (guardada na visita) e com os da tela, e só o que muda. O
   Salvar do rodapé largo pergunta a data (pedirData, já sugerida) e
   grava (pontuacao_escala_salvar → a escala refeita dali → Histórico →
   resumo). RosterWork.ajustesPontuacao.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var el = {};
  var dados = null;      // a resposta do pontuacao_escala_ler
  var pesos = null;      // os pesos em edição: { viatura, funcao, plantao, mesma }
  var inicial = '';      // os gravados, para saber se mudou
  var pedido = 0;        // latest-wins da leitura
  var pedidoPrevia = 0;  // latest-wins da prévia
  var esperaPrevia = null;
  var base = {};         // a foto de cada unidade com os pesos que valem (a 1ª conta da prévia), guardada na visita
  var guardaLigada = false;
  var CHAVES = ['viatura', 'funcao', 'plantao', 'mesma'];

  function msg() { return RW.mensagens.ajustes.pontuacao; }
  function texto(p) { return JSON.stringify(CHAVES.map(function (k) { return p[k]; })); }
  function sujo() { return !!pesos && texto(pesos) !== inicial; }
  function montada() { return !!(el.conteudo && el.conteudo.isConnected); }
  function pode() { return !!(dados && dados.pode_editar); }
  function daLeitura(p) {
    var r = {};
    CHAVES.forEach(function (k) { r[k] = (p || {})[k] === 'pouco' || (p || {})[k] === 'muito' ? p[k] : 'normal'; });
    return r;
  }

  /* ---------- ler ---------- */
  function carregar(gravou) {
    var meu = ++pedido;
    var leitura = RW.rpc('pontuacao_escala_ler', {});
    if (!gravou) {
      el.carregando.classList.remove('oculto');
      el.conteudo.classList.add('oculto');
      el.rodape.classList.add('oculto');
      leitura = RW.etapas.segurarDesde(performance.now(), leitura);
    }
    return leitura.then(function (r) {
      if (meu !== pedido || !montada()) return;
      el.carregando.classList.add('oculto');
      if (!r || !r.ok) { RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor }); return; }
      dados = r;
      pesos = daLeitura(r.pesos);
      inicial = texto(pesos);
      base = {};
      limparPrevia();
      desenhar();
    }, function () {
      if (meu !== pedido) return;
      el.carregando.classList.add('oculto');
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- desenhar: os pesos (com a frase de cada um), a trava e o rodapé ---------- */
  function desenhar() {
    var travado = !pode();
    el.trava.classList.toggle('oculto', !travado);
    el.conteudo.classList.remove('oculto');
    el.balanca.querySelectorAll('.ajustes-balanca-item[data-chave]').forEach(function (item) {
      var valor = pesos[item.getAttribute('data-chave')];
      var gatilho = item.querySelector('.campo-selecao');
      var menu = gatilho.closest('.dropdown').querySelector('.dropdown-menu');
      var escolhido = menu.querySelector('.dropdown-item[data-valor="' + valor + '"]');
      gatilho.querySelector('.campo-selecao-texto').textContent = escolhido ? escolhido.textContent : '';
      gatilho.setAttribute('data-valor', valor);
      menu.querySelectorAll('.dropdown-item').forEach(function (i) { i.classList.toggle('dropdown-item--ativo', i === escolhido); });
      gatilho.disabled = travado;
      item.querySelectorAll('[data-peso]').forEach(function (f) { f.classList.toggle('oculto', f.getAttribute('data-peso') !== valor); });
    });
    el.rodape.classList.toggle('oculto', !(pode() && sujo()));
    el.como.classList.toggle('oculto', !(pode() && sujo()));
  }

  /* ---------- a prévia dos 14 dias: de cada unidade, a foto com os pesos que valem (guardada) e a comparação com os da tela ---------- */
  function limparPrevia() {
    pedidoPrevia++;
    clearTimeout(esperaPrevia);
    if (el.linha) { el.linha.parar(); el.linha = null; }
    el.comoLista.textContent = '';
    el.comoCarregando.textContent = '';
    el.comoNada.classList.add('oculto');
    el.comoFalha.classList.add('oculto');
  }

  function pedirPrevia() {
    limparPrevia();
    if (!pode() || !sujo()) return;
    var meu = pedidoPrevia;
    /* espera um instante: quem troca dois pesos seguidos faz uma conta só */
    esperaPrevia = setTimeout(function () { previa(meu); }, 400);
  }

  function previa(meu) {
    var unidades = (dados.unidades || []).slice(), agora = JSON.parse(JSON.stringify(pesos)), valendo = daLeitura(dados.pesos);
    var semMudanca = [], comMudanca = 0;
    el.linha = RW.etapas.linha(el.comoCarregando, 'pontuacaoPrevia', { unidades: unidades.map(function (u) { return u.nome; }) }, { doServidor: 1 });
    function proxima(i) {
      if (meu !== pedidoPrevia || !montada()) return;
      if (i >= unidades.length) { fim(); return; }
      var u = unidades[i];
      el.linha.ir(i);
      var foto = base[u.id] ? Promise.resolve(base[u.id])
        : RW.rpc('pontuacao_escala_previa', { p_pesos: valendo, p_unidade: u.id }).then(function (r) {
            if (!r || !r.ok) throw r;
            base[u.id] = r.foto;
            return r.foto;
          });
      foto.then(function (f) {
        if (meu !== pedidoPrevia) return null;
        return RW.rpc('pontuacao_escala_previa', { p_pesos: agora, p_unidade: u.id, p_base: f });
      }).then(function (r) {
        if (meu !== pedidoPrevia || r === null) return;
        if (!r || !r.ok) throw r;
        /* com os pedaços juntados, o que só mudou de pedaço não é mudança */
        var mudancas = r.mudancas.filter(function (m) { return lugares(m.depois) !== lugares(m.antes); });
        if (mudancas.length) { comMudanca++; mostrarUnidade(u.nome, mudancas); }
        else semMudanca.push(u.nome);
        proxima(i + 1);
      }).catch(function () {
        if (meu !== pedidoPrevia) return;
        if (el.linha) { el.linha.parar(); el.linha = null; }
        el.comoCarregando.textContent = '';
        el.comoFalha.classList.remove('oculto');
      });
    }
    function fim() {
      if (el.linha) { el.linha.parar(); el.linha = null; }
      el.comoCarregando.textContent = '';
      if (!comMudanca) { el.comoNada.classList.remove('oculto'); return; }
      if (semMudanca.length) {
        var g = RW.tpl('tpl-pontuacao-unidade');
        g.querySelector('.ajustes-pontuacao-unidade').textContent = msg().semMudanca(semMudanca);
        var li = RW.tpl('tpl-pontuacao-mudanca');
        li.textContent = msg().nadaMuda;
        g.querySelector('.ajustes-regras').appendChild(li);
        el.comoLista.appendChild(g);
      }
    }
    proxima(0);
  }

  /* uma unidade com mudança: o nome com os dias e uma linha por militar e dia */
  function mostrarUnidade(nome, mudancas) {
    var dias = {};
    mudancas.forEach(function (m) { dias[m.data] = true; });
    var g = RW.tpl('tpl-pontuacao-unidade');
    g.querySelector('.ajustes-pontuacao-unidade').textContent = msg().unidade(nome, Object.keys(dias).length);
    var lista = g.querySelector('.ajustes-regras');
    mudancas.forEach(function (m) {
      var li = RW.tpl('tpl-pontuacao-mudanca');
      li.textContent = msg().mudanca(RW.data.isoParaBR(m.data).slice(0, 5), (m.grad ? m.grad + ' ' : '') + (m.nome || ''), lugares(m.depois), lugares(m.antes));
      lista.appendChild(li);
    });
    el.comoLista.appendChild(g);
  }

  function lugares(itens) {
    return juntar(itens).map(function (x) { return msg().lugar(x.funcao, x.posto, msg().horas(x.ini, x.fim)); }).join('; ');
  }

  /* os pedaços seguidos na mesma função e posto viram um só (a escala parte o dia em trechos), na ordem do dia de
     serviço, que vira às 08h: 08h às 19h, 19h às 07h e 07h às 08h juntos são o dia todo */
  function juntar(itens) {
    function minutos(t) { var p = String(t || '').split(':'); return (+p[0] * 60 + (+p[1] || 0) - 480 + 1440) % 1440; }
    var juntos = [];
    (itens || []).slice().sort(function (a, b) { return minutos(a.ini) - minutos(b.ini); }).forEach(function (x) {
      var ultimo = juntos[juntos.length - 1];
      if (ultimo && ultimo.funcao === x.funcao && ultimo.posto === x.posto && ultimo.fim === x.ini) ultimo.fim = x.fim;
      else juntos.push({ funcao: x.funcao, posto: x.posto, ini: x.ini, fim: x.fim });
    });
    return juntos;
  }

  /* ---------- editar (as peças fixas no HTML: liga uma vez por visita) ---------- */
  function ligar() {
    el.balanca.querySelectorAll('.ajustes-balanca-item[data-chave]').forEach(function (item) {
      RW.campos.ligarSelecao(item.querySelector('.campo-selecao'), function (valor) {
        pesos[item.getAttribute('data-chave')] = valor;
        desenhar();
        pedirPrevia();
      });
    });
    el.cancelar.addEventListener('click', function () { confirmarDescarte(function () {}); });
    el.salvar.addEventListener('click', salvar);
  }

  /* volta ao que está gravado */
  function descartar() {
    pesos = daLeitura(dados.pesos);
    limparPrevia();
    desenhar();
  }

  /* com edição não salva, pergunta antes de seguir; descartando, volta ao gravado */
  function confirmarDescarte(seguir, ficar) {
    if (!sujo()) { seguir(); return; }
    RW.confirmar({
      tipo: 'aviso', mensagem: RW.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RW.mensagens.botoes.descartar, textoCancelar: RW.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { descartar(); seguir(); }, aoCancelar: ficar
    });
  }

  /* o Salvar: a data em que os pesos novos começam (já sugerida: o próximo dia de serviço) */
  function salvar() {
    if (!sujo()) return;
    RW.pedirData({
      sugerida: true, titulo: msg().salvarTitulo, sugestaoAntes: msg().salvarAntes, sugestaoDepois: msg().salvarDepois,
      textoConfirmar: msg().botaoSalvar,
      aoConfirmar: enviar
    });
  }

  /* grava os pesos; a escala das unidades é refeita dali (o cartão das etapas enquanto grava); no fim, o resumo */
  function enviar(desde) {
    limparPrevia();
    var etapas = RW.etapas.acao('ajustesPontuacao', null, { doServidor: 2 });
    RW.rpc('pontuacao_escala_salvar', { p_pesos: pesos, p_desde: desde }).then(function (r) {
      if (!r || !r.success) {
        etapas.parar();
        RW.avisar({ tipo: 'erro', mensagem: (r && r.error) || RW.mensagens.geral.falhaServidor });
        return;
      }
      etapas.ultima();
      function fim() {
        etapas.parar();
        if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: msg().pagina });
      }
      carregar(true).then(fim, fim);
    }, function () {
      etapas.parar();
      RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
    });
  }

  /* ---------- entrada (a cada visita à página) e a aba ---------- */
  function montar(cont) {
    ['conteudo', 'carregando', 'trava', 'rodape', 'cancelar', 'salvar', 'balanca', 'como', 'como-lista', 'como-nada',
     'como-falha', 'como-carregando'].forEach(function (nome) {
      el[nome.replace(/-(\w)/g, function (x, l) { return l.toUpperCase(); })] = cont.querySelector('#pontuacao-' + nome);
    });
    el.linha = null;
    dados = null;
    pesos = null;
    inicial = '';
    base = {};
    ligar();
    if (!guardaLigada && RW.guardaSaida) {
      RW.guardaSaida.registrar(function () { return montada() && sujo(); });
      guardaLigada = true;
    }
  }

  /* a 1ª vez que a aba abre na visita, lê */
  function ativar() { return dados ? Promise.resolve() : carregar(); }

  RW.ajustesPontuacao = { montar: montar, ativar: ativar, sairDaAba: confirmarDescarte };
})();
