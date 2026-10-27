/* ============================================================
   ESCALAS — a edição de uma linha do Dia (o lápis; só admin)
   Um cartão que engloba a linha: no topo, a própria linha com o X
   que fecha (uma aberta por vez); embaixo, como está hoje, em frases
   (quem escolheu e quem está ali, o serviço no dia e o horário nesta
   função, cada um com o seu Mudar), o Trocar o militar desta função
   (o campo de militar, geral-combo-militar) e as ações, uma embaixo
   da outra e com o nome. Cada escolha abre o seu modo, com o botão
   que diz o que faz e o Cancelar, que volta ao resumo:
   - trocar: a pergunta de quem já tem função (sai ou faz as duas),
     a do banco de horas de quem vem de folga e o efeito em quem sai;
   - mudar: o posto e a função, o efeito e o Trocar os dois de lugar;
   - hora, serviço (escalas-painel-servico.js) e tirar do dia.
   Tipos: função, vaga (sem ninguém), papel (Chefe de Socorro e
   Oficial de Área: sempre o mais antigo, sem o trocar) e sem função.
   O que cada botão muda fica em escalas-painel-linha-aplicar.js.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var aberto = null;   // { el, esconder: [] }: o cartão aberto e o que ele esconde da lista
  var conta = 0;       // nome único para os rádios e o campo de cada cartão

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function A() { return RosterWork.escalasPainelLinhaAplicar; }
  function msg() { return RosterWork.mensagens.escala; }
  function L() { return RosterWork.mensagens.escala.linha; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function juntar(lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); }
  function copiar(p) { return { hi: p.hi, hf: p.hf }; }

  function fechar() {
    if (!aberto) return;
    if (aberto.el.parentNode) aberto.el.remove();
    aberto.esconder.forEach(function (e) { e.classList.remove('oculto'); });
    aberto = null;
  }

  function ligarRadios(caixa, aoEscolher) {
    var nome = 'escala-linha-' + (++conta);
    var radios = caixa.querySelectorAll('input[type="radio"]');
    [].forEach.call(radios, function (r) {
      r.name = nome;
      r.addEventListener('change', function () { if (r.checked) aoEscolher(r.value); });
    });
    return function marcar(valor) { [].forEach.call(radios, function (r) { r.checked = r.value === valor; }); };
  }

  /* cfg = { lapis, grupo, tipo: 'funcao' | 'vaga' | 'papel' | 'sem_funcao', posto, funcao, rotulo, militar, periodos } */
  function abrir(cfg) {
    fechar();
    var api = ed(), H = api.horas;
    var el = RosterWork.tpl('tpl-escala-linha');
    var linhaLista = cfg.lapis && cfg.lapis.closest('.escala-edicao-linha');
    if (!el || !linhaLista || !cfg.grupo) return;
    var tipo = cfg.tipo, m = cfg.militar;
    var est = { modo: 'resumo', escolhido: null, item: null, saida: 'sai', banco: 'sim', periodos: (cfg.periodos || []).map(copiar), onde: null };
    var q = function (s) { return el.querySelector(s); };
    var nome = m ? nomeDe(m) : '';
    var horasTexto = H.textoPeriodos(est.periodos) || msg().dasAs('08h', '08h');
    var servico = null, tirar = null, combo = null;

    /* o topo: a própria linha da lista (a função, o militar e o horário) com o X */
    q('.escala-linha-funcao').textContent = tipo === 'sem_funcao' ? msg().semFuncaoRotulo
      : RosterWork.escalasPainel.pecas.abreviarFuncao(cfg.rotulo || cfg.funcao);
    var pessoa = linhaLista.querySelector('.escala-edicao-pessoa'), horas = linhaLista.querySelector('.escala-distribuicao-horas');
    if (pessoa) q('.escala-linha-pessoa').appendChild(pessoa.cloneNode(true));
    if (horas) q('.escala-linha-horas').appendChild(horas.cloneNode(true));
    q('.escala-linha-fechar').addEventListener('click', fechar);

    /* o resumo, em frases */
    var fraseQuem = q('.escala-linha-frase--quem'), fraseFuncao = q('.escala-linha-frase--funcao');
    if (tipo === 'funcao' || tipo === 'papel') {
      q('.escala-linha-quem-texto').textContent = tipo === 'papel' ? L().oMaisAntigo : m.fixado ? L().escolhidoAdmin : L().escolhidoSistema;
      q('.escala-linha-quem-nome').textContent = nome;
      q('.escala-linha-funcao-horas').textContent = horasTexto;
      if (tipo === 'papel') q('.escala-linha-mudar-hora').remove();
      else q('.escala-linha-mudar-hora').addEventListener('click', function () { est.modo = 'hora'; atualizar(); });
    } else {
      fraseQuem.remove();
      fraseFuncao.remove();
      fraseFuncao = null;
      var frase = q(tipo === 'vaga' ? '.escala-linha-frase--vaga' : '.escala-linha-frase--sem');
      frase.classList.remove('oculto');
      q(tipo === 'vaga' ? '.escala-linha-vaga-horas' : '.escala-linha-sem-horas').textContent = horasTexto;
      if (tipo === 'sem_funcao') q('.escala-linha-sem-nome').textContent = nome;
    }
    function montarServico() {
      if (m && tipo !== 'vaga') servico = RosterWork.escalasPainelServico.servico(q('.escala-linha-servico'), m.cpf, function () {
        if (servico && servico.aberto() && est.modo === 'resumo') est.modo = 'servico';
        atualizar();
      });
    }
    montarServico();

    /* o Trocar o militar (função e vaga): a lista do banco para a vaga, no campo de militar */
    var blocoTrocar = q('.escala-linha-bloco--trocar');
    if (tipo === 'funcao' || tipo === 'vaga') {
      q('.escala-linha-trocar-rotulo').textContent = tipo === 'vaga' ? L().escolherRotulo : L().trocarRotulo;
      var inp = q('.escala-linha-combo input'), menu = q('.escala-linha-combo .dropdown-menu');
      inp.id = 'escala-linha-combo-' + (++conta);
      inp.setAttribute('aria-label', q('.escala-linha-trocar-rotulo').textContent);
      combo = RosterWork.comboMilitar.criar(inp, menu, {
        atual: function () { return est.item; },
        aoEscolher: function (item) { est.item = item; est.escolhido = item.c; est.saida = 'sai'; est.banco = 'sim'; est.modo = 'trocar'; atualizar(); },
        textos: { selecione: m ? L().trocarPlaceholder(nome) : L().digiteOuEscolha, semNinguem: L().ninguemPode, filtroVazio: msg().ninguemEncontrado }
      });
      combo.habilitar(false);
      combo.definir(L().carregando, true);
      var vaga = { viatura_id: cfg.posto.tipo === 'viatura' ? cfg.posto.id : null, instalacao_id: cfg.posto.tipo === 'instalacao' ? cfg.posto.id : null,
        funcao: cfg.funcao, periodos: est.periodos.map(copiar), cpf: m ? m.cpf : null };
      var unidadeNome = ((api.dados().picker || []).filter(function (u) { return u.editando; })[0] || {}).unidade_nome || '';
      RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), api.unidadeId(), vaga).then(function (resp) {
        if (!el.isConnected) return;
        if (!resp) { combo.definir(msg().falhaCarregar, true); return; }
        combo.preencher(RosterWork.escalasPainelQuem.itensDaVaga(resp, m, unidadeNome));
      });
    } else {
      blocoTrocar.remove();
      blocoTrocar = null;
    }

    var marcarSaida = ligarRadios(q('.escala-linha-saida'), function (v) { est.saida = v; atualizar(); });
    var marcarBanco = ligarRadios(q('.escala-linha-banco'), function (v) { est.banco = v; });

    /* as ações, uma embaixo da outra e com o nome */
    var podeTirar = m && tipo !== 'vaga' && RosterWork.escalasPainelServico.podeTirar(m.cpf);
    var botoes = { mudar: q('.escala-linha-mudar'), tirarFuncao: q('.escala-linha-tirar-funcao'), liberar: q('.escala-linha-liberar'), tirarDia: q('.escala-linha-tirar-dia') };
    if (tipo === 'funcao' || tipo === 'sem_funcao') {
      q('.escala-linha-mudar-texto').textContent = tipo === 'funcao' ? L().mudarRotulo(nome) : L().porRotulo(nome);
      botoes.mudar.addEventListener('click', function () { est.modo = 'mudar'; montarOnde(); atualizar(); });
    } else botoes.mudar.remove();
    if (tipo === 'funcao') {
      botoes.tirarFuncao.textContent = L().tirarFuncao(nome);
      botoes.tirarFuncao.addEventListener('click', function () { api.mudar(function () { A().tirarDaFuncao(cfg); }); });
    } else botoes.tirarFuncao.remove();
    if (A().podeLiberar(cfg)) {
      botoes.liberar.textContent = tipo === 'funcao' ? L().liberar(nome) : L().liberarVaga;
      botoes.liberar.addEventListener('click', function () { api.mudar(function () { A().liberar(cfg); }); });
    } else botoes.liberar.remove();
    if (podeTirar) {
      botoes.tirarDia.textContent = L().tirarDia(nome);
      botoes.tirarDia.addEventListener('click', function () { est.modo = 'tirar'; tirar = RosterWork.escalasPainelServico.tirar(q('.escala-linha-tirar'), m.cpf, atualizar); atualizar(); });
    } else botoes.tirarDia.remove();
    var acoes = q('.escala-linha-acoes'), temAcoes = !!acoes.querySelector('.botao');

    /* o Onde do Mudar para outra função / Pôr numa função */
    function montarOnde() {
      est.onde = null;
      q('.escala-linha-onde-rotulo').textContent = tipo === 'funcao' ? L().mudarRotulo(nome) : L().porRotulo(nome);
      RosterWork.escalasPainelQuem.onde(q('.escala-linha-onde'), {
        postos: api.dados().postos || [],
        situacao: function (posto, nf) {
          var nomes = A().ocupantes(posto, nf, est.periodos, m.cpf).map(function (o) { return nomeDe(o.m); });
          nomes = nomes.filter(function (n, i) { return nomes.indexOf(n) === i; });
          return nomes.length ? msg().itemSai(nomes) : msg().itemVazia;
        },
        aoMudar: function (posto, funcao) { est.onde = posto && funcao ? { posto: posto, funcao: funcao } : null; atualizar(); }
      });
    }

    /* ---------- desenho ---------- */

    function nota(caixa, texto) {
      caixa.classList.toggle('oculto', !texto);
      if (texto) caixa.querySelector('.nota-texto').textContent = texto;
    }

    function montarHora() {
      var lugar = q('.escala-linha-bloco--hora .escala-linha-periodos');
      lugar.textContent = '';
      var mil = api.militarDoDia(m.cpf), opc = H.opcoesHoras(mil && mil.janelas.length ? mil.janelas : null);
      var diaTodo = H.uniao(est.periodos.map(H.faixa)).reduce(function (s, f) { return s + f[1] - f[0]; }, 0) >= 1440;
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, opcoes: opc,
          aoInicio: function (h) { per.hi = h; montarHora(); },
          aoFim: function (h) { per.hf = h; montarHora(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); montarHora(); } : null,
          aoAdicionar: i === 0 && !diaTodo ? adicionarPeriodo : null,
          adicionarDesligado: i === 0 && diaTodo ? L().diaTodoDica : null
        });
        if (linha) lugar.appendChild(linha);
      });
    }
    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(est.periodos.map(H.faixa)));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      montarHora();
    }

    var montouHora = false;
    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var modo = est.modo, c = est.escolhido;
      var mostra = function (seletor, sim) { var e = q(seletor); if (e) e.classList.toggle('oculto', !sim); };
      /* o resumo fica sempre; no modo do serviço, a frase da função some; o Mudar do horário só no resumo */
      if (fraseFuncao) fraseFuncao.classList.toggle('oculto', modo === 'hora' || modo === 'servico');
      mostra('.escala-linha-mudar-hora', modo === 'resumo');
      q('.escala-linha-servico').classList.toggle('oculto', modo !== 'resumo' && modo !== 'servico');
      mostra('.escala-linha-bloco--hora', modo === 'hora');
      if (modo === 'hora' && !montouHora) { montouHora = true; montarHora(); }
      if (blocoTrocar) blocoTrocar.classList.toggle('oculto', modo !== 'resumo' && modo !== 'trocar');
      mostra('.escala-linha-bloco--onde', modo === 'mudar');
      mostra('.escala-linha-tirar', modo === 'tirar');
      acoes.classList.toggle('oculto', modo !== 'resumo' || !temAcoes);

      /* trocar: quem entra e já tem função no horário (sai ou faz as duas; de outra unidade, só sai), de folga (o
         banco de horas), quem é o mais antigo (assume o papel) e o que acontece com quem sai */
      var lugares = c ? RosterWork.escalasPainelQuem.lugares(c.funcoes) : [];
      var deOutra = !!c && c.grupo === 'outro_pelotao';
      mostra('.escala-linha-saida', modo === 'trocar' && lugares.length > 0);
      if (modo === 'trocar' && lugares.length) {
        var unidade = (c.funcoes[0] && c.funcoes[0].unidade) || c.unidade || '';
        q('.escala-linha-saida-texto').textContent = deOutra ? L().saidaOutra(nomeDe(c), juntar(lugares), unidade) : L().saidaTexto(nomeDe(c), juntar(lugares));
        q('.escala-linha-saida-sai').textContent = L().saidaSai(lugares);
        q('.escala-linha-saida-duas').textContent = L().saidaDuas(cfg.funcao, c.funcoes.map(function (f) { return f.funcao; }));
        q('.escala-linha-saida-duas-opcao').classList.toggle('oculto', deOutra);
        marcarSaida(deOutra ? 'sai' : est.saida);
      }
      var deFolga = modo === 'trocar' && !!c && c.grupo === 'folga';
      mostra('.escala-linha-banco', deFolga);
      if (deFolga) {
        var horas = H.horasTexto(H.uniao(est.periodos.map(H.faixa)).reduce(function (s, f) { return s + f[1] - f[0]; }, 0));
        q('.escala-linha-banco-texto').textContent = L().bancoTexto(nomeDe(c), diaMes(api.iso()), horas);
        q('.escala-linha-banco-sim').textContent = L().bancoSim(horas);
        marcarBanco(est.banco);
      }
      nota(q('.escala-linha-assume'), modo === 'trocar' && c && c.assume
        ? (c.assume === 'chefe_socorro' ? msg().assumeChefe : msg().assumeOficial)(nomeDe(c), '') : '');
      desenharEfeito(modo, c);
      desenharRodape(modo, c);
    }

    /* o efeito, em uma frase: na troca, o que acontece com quem sai; no mudar, quem sai da função escolhida e a
       função que fica vazia (com o Trocar os dois de lugar, quando é um só) */
    function desenharEfeito(modo, c) {
      var caixa = q('.escala-linha-efeito'), atalho = q('.escala-linha-atalho'), texto = '';
      atalho.classList.add('oculto');
      if (modo === 'trocar' && c && m) {
        var outras = A().outrasFuncoes(m.cpf, cfg, est.periodos).map(function (e) { return api.funcaoNoPosto(e.funcao, e.posto); });
        texto = outras.length ? L().efeitoContinua(nome, cfg.funcao, outras) : L().efeitoSemFuncao(nome, cfg.funcao);
      } else if (modo === 'mudar' && est.onde) {
        var ocup = A().ocupantes(est.onde.posto, est.onde.funcao, est.periodos, m.cpf);
        var partes = ocup.map(function (o) { var pr = H.periodo(o.x); return msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf)); });
        texto = [partes.length ? msg().avisoEfeito(partes) : '', tipo === 'funcao' ? L().ficaVazio(cfg.funcao) : ''].filter(Boolean).join(' ');
        var nomes = ocup.map(function (o) { return o.m.cpf; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
        if (tipo === 'funcao' && nomes.length === 1) {
          atalho.textContent = L().trocarDois(nomeDe(ocup[0].m), cfg.funcao);
          atalho.classList.remove('oculto');
        }
      }
      nota(caixa, texto);
    }

    /* o rodapé dos modos: o botão diz o que faz; sem o que precisa (a função do Mudar), fica desligado */
    function desenharRodape(modo, c) {
      var rodape = q('.escala-linha-rodape'), botao = q('.escala-linha-aplicar');
      rodape.classList.toggle('oculto', modo === 'resumo');
      botao.disabled = false;
      if (modo === 'trocar' && c) botao.textContent = L().porNaFuncao(nomeDe(c), cfg.funcao);
      else if (modo === 'mudar') {
        botao.textContent = est.onde ? (tipo === 'funcao' ? L().mudarPara(nome, est.onde.funcao) : L().porNaFuncao(nome, est.onde.funcao)) : L().escolhaFuncao;
        botao.disabled = !est.onde;
      } else if (modo === 'hora') botao.textContent = L().salvarHorario;
      else if (modo === 'servico') botao.textContent = L().salvarServico;
      else if (modo === 'tirar') botao.textContent = tirar && tirar.alcance() === 'ciclo' ? L().botaoContinuar : L().tirarDia(nome);
    }

    /* ---------- confirmar e cancelar ---------- */

    function voltarAoResumo() {
      est.modo = 'resumo'; est.escolhido = null; est.item = null; est.onde = null;
      est.periodos = (cfg.periodos || []).map(copiar);
      montouHora = false;
      if (combo) combo.mostrarAtual();
      if (servico && servico.aberto()) montarServico();
      tirar = null; q('.escala-linha-tirar').textContent = '';
      atualizar();
    }
    q('.escala-linha-cancelar').addEventListener('click', voltarAoResumo);

    function aplicar(trocarDois) {
      var modo = est.modo, c = est.escolhido;
      if (modo === 'tirar') {
        var e = tirar ? tirar.erro() : '';
        if (e) { RosterWork.avisar({ tipo: 'erro', mensagem: e }); return; }
        if (tirar) tirar.aplicar();
        return;
      }
      if (modo === 'servico') {
        var es = servico && servico.erro();
        if (es) { RosterWork.avisar({ tipo: 'erro', mensagem: es }); return; }
        api.mudar(function () { servico.aplicar(); });
        return;
      }
      if (modo === 'hora') {
        var js = est.periodos.map(H.faixa), soma = function (l) { return l.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
        if (soma(H.uniao(js)) !== soma(js)) { RosterWork.avisar({ tipo: 'erro', mensagem: L().erroPeriodos }); return; }
        api.mudar(function () { A().mudarHorario(cfg, est.periodos); });
        return;
      }
      if (modo === 'mudar' && est.onde) { api.mudar(function () { A().mudarPara(cfg, est.onde, trocarDois); }); return; }
      if (modo === 'trocar' && c) {
        api.sugerir(A().sugestao(cfg, c, est.saida, { um: function (f) { return L().atalho(nome, f); }, varios: L().atalhoLugar(nome, nomeDe(c)) }));
        api.mudar(function () { A().trocar(cfg, c, est.periodos, est.saida, est.banco); });
      }
    }
    q('.escala-linha-aplicar').addEventListener('click', function () { aplicar(false); });
    q('.escala-linha-atalho').addEventListener('click', function () { aplicar(true); });

    /* o cartão entra no lugar da linha: a linha (e a função, se ficou sem outra linha) some da lista */
    var esconder = [linhaLista];
    var outrasLinhas = [].filter.call(cfg.grupo.querySelectorAll('.escala-edicao-linha'), function (l) { return l !== linhaLista && !l.classList.contains('oculto'); });
    if (!outrasLinhas.length) esconder.push(cfg.grupo);
    esconder.forEach(function (e) { e.classList.add('oculto'); });
    cfg.grupo.insertAdjacentElement('afterend', el);
    aberto = { el: el, esconder: esconder };
    atualizar();
  }

  window.RosterWork.escalasPainelLinha = { abrir: abrir, fechar: fechar, aberta: function () { return !!aberto; } };
})();
