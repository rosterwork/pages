/* ============================================================
   ESCALAS — formulário Quem · Quando · Onde do Dia (só admin)
   Sub-tela do painel do dia, de três jeitos:
   - adicionar: o botão "Adicionar militar" do subcabeçalho (só quem
     está de folga, de qualquer unidade e setor: a árvore começa na
     unidade do painel e a lista vem por unidade, a escolhida primeiro;
     entra como pontual, com o modal do banco de horas);
   - preencher: o "Sem ninguém, escolher" (posto e função já escolhidos;
     primeiro quem está sem função nesse horário, depois os de folga);
   - nova: a "Nova função" do militar no dia (o militar já escolhido;
     primeiro "Para onde", depois o Quando).
   Quando: um ou mais horários (o Adicionar horário na 1ª linha). Onde:
   o posto e a função (a lista diz a situação de cada função no
   horário); no Adicionar, também "O sistema distribui". Se ele já tem
   função no horário, uma nota avisa que vai acumular (para deixar uma,
   desmarca-se na tela do militar). Quem é o mais antigo assume o Chefe
   de Socorro ou o Oficial de Área sozinho, e a tela avisa. Aplica no
   rascunho (escalas-painel-editar.js) e volta ao dia.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* Chefe de Socorro e Oficial de Área são automáticos por normativa: não entram na lista de funções */
  var BLOQUEADAS = /^(chefe de socorro|oficial de área)$/i;

  function ed() { return RosterWork.escalasPainelEditar.sub; }
  function msg() { return RosterWork.mensagens.escala; }
  function nomeDe(m) { return ((m.grad || '') + ' ' + (m.nome || '')).trim(); }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  /* cfg = { modo: 'adicionar' | 'preencher' | 'nova', posto, funcao, hi, hf, cpf } */
  function abrir(cfg) {
    var api = ed(), H = api.horas;
    var dados = api.dados();
    if (!dados) return;
    var est = {
      mil: cfg.modo === 'nova' ? api.militarDoDia(cfg.cpf) : null,
      periodos: [{ hi: cfg.hi || '08:00', hf: cfg.hf || '08:00' }],
      onde: cfg.modo === 'adicionar' ? 'sistema' : 'funcao',
      posto: cfg.posto || null, funcao: cfg.funcao || null
    };
    var el = {};
    var itens = [];   // botões das listas do Quem (para marcar o escolhido e filtrar)

    /* ---------- leitura do estado ---------- */

    function janelasDoQuando() { return est.periodos.map(H.faixa); }
    function eDestino(e) { return est.posto && e.posto.id === est.posto.id && e.funcao === est.funcao; }

    /* as funções dele nesta unidade que cruzam os horários escolhidos (fora a função de destino) */
    function funcoesAtuais() {
      if (!est.mil || est.mil.deFolga) return [];
      var js = janelasDoQuando();
      return api.funcoesDoMilitar(est.mil.cpf).filter(function (e) {
        if (eDestino(e)) return false;
        return e.periodos.some(function (per) { return js.some(function (w) { return !!H.cruza(w, H.faixa(per)); }); });
      });
    }

    /* ele já está na função de destino nesses horários? */
    function jaNaFuncao() {
      if (!est.mil || !est.posto || !est.funcao) return false;
      var js = janelasDoQuando();
      return api.funcoesDoMilitar(est.mil.cpf).some(function (e) {
        return eDestino(e) && e.periodos.some(function (per) { return js.some(function (w) { return !!H.cruza(w, H.faixa(per)); }); });
      });
    }

    /* quem está numa função do posto nesses horários (fora ele): [{ m, x: [início, fim] }] */
    function ocupantes(posto, funcao) {
      var r = [];
      var f = api.acharFuncao(posto, funcao);
      var js = janelasDoQuando();
      ((f && f.militares) || []).forEach(function (m) {
        if (est.mil && m.cpf === est.mil.cpf) return;
        (m.periodos || []).forEach(function (per) {
          js.forEach(function (w) { var x = H.cruza(w, H.faixa(per)); if (x) r.push({ m: m, x: x }); });
        });
      });
      return r;
    }

    /* o efeito da escolha numa frase: quem fica sem função */
    function partesAviso() {
      var partes = [];
      if (!est.mil) return partes;
      if (est.onde === 'funcao' && est.posto && est.funcao) {
        ocupantes(est.posto, est.funcao).forEach(function (o) {
          var pr = H.periodo(o.x);
          partes.push(msg().avisoSemFuncao(nomeDe(o.m), H.curta(pr.hi), H.curta(pr.hf)));
        });
      }
      return partes;
    }

    /* quem tem hoje o papel que o escolhido vai assumir (só quando é um) */
    function quemTemPapel(papel) {
      var alvo = papel === 'chefe_socorro' ? /^chefe de socorro$/i : /^oficial de área$/i;
      var nomes = {};
      var ps = api.papeis(dados);
      Object.keys(ps).forEach(function (k) {
        if (!alvo.test(ps[k].funcao)) return;
        Object.keys(ps[k].por).forEach(function (cpf) { nomes[ps[k].por[cpf].nome] = true; });
      });
      var lista = Object.keys(nomes);
      return lista.length === 1 ? lista[0] : '';
    }

    /* ---------- montagem ---------- */

    function montar(corpo) {
      var form = RosterWork.tpl('tpl-escala-form');
      if (!form) return;
      el.form = form;
      el.titulo = form.querySelector('.escala-form-titulo');
      el.subtitulo = form.querySelector('.escala-form-subtitulo');
      el.secoes = {};
      ['quem', 'quando', 'onde', 'atual'].forEach(function (k) { el.secoes[k] = form.querySelector('[data-secao="' + k + '"]'); });
      el.assume = form.querySelector('.escala-form-assume');
      el.periodos = form.querySelector('.escala-form-periodos');
      el.regua = RosterWork.horario.criarRegua('afastada');
      if (el.regua) form.querySelector('.escala-form-regua').appendChild(el.regua);
      el.acumula = form.querySelector('.escala-form-acumula');
      el.sistema = form.querySelector('.escala-form-sistema');
      el.selecoes = form.querySelector('.escala-form-selecoes');
      el.posto = form.querySelector('.escala-form-posto');
      el.funcao = form.querySelector('.escala-form-funcao');
      el.postoVazio = el.posto.querySelector('.campo-selecao-texto').textContent;
      el.funcaoVazio = el.funcao.querySelector('.campo-selecao-texto').textContent;
      el.aviso = form.querySelector('.escala-form-aviso');
      el.avisoTexto = el.aviso.querySelector('.nota-texto');

      if (cfg.modo === 'adicionar') {
        el.titulo.textContent = msg().formAdicionar;
        form.querySelector('.escala-form-nota').classList.remove('oculto');
      } else if (cfg.modo === 'preencher') {
        el.titulo.textContent = msg().formPreencher(api.funcaoNoPosto(cfg.funcao, cfg.posto));
        el.subtitulo.textContent = H.textoPeriodos(est.periodos);
      } else {
        el.titulo.textContent = msg().formNovaFuncao(est.mil ? nomeDe(est.mil) : '');
        el.subtitulo.textContent = textoHoje();
        /* na Nova função, primeiro "Para onde", depois o Quando */
        form.insertBefore(el.secoes.onde, el.secoes.quando);
        el.secoes.onde.querySelector('.escala-form-onde-titulo').classList.add('oculto');
        el.secoes.onde.querySelector('.escala-form-onde-titulo--nova').classList.remove('oculto');
      }

      if (cfg.modo === 'nova') el.secoes.quem.classList.add('oculto');
      else montarQuem(form);
      montarPostos();
      [].forEach.call(form.querySelectorAll('input[name="escala-form-onde"]'), function (r) {
        r.addEventListener('change', function () { est.onde = r.value; atualizar(); });
      });
      corpo.appendChild(form);
      atualizar();
    }

    /* "Hoje: Condutor da ABT-01, das 08h às 08h" (Nova função) */
    function textoHoje() {
      if (!est.mil) return '';
      var fs = api.funcoesDoMilitar(est.mil.cpf).map(function (e) { return api.funcaoNoPosto(e.funcao, e.posto); });
      var texto = !fs.length ? msg().semFuncaoNoDia : fs.length === 1 ? fs[0] : fs.slice(0, -1).join(', ') + ' e ' + fs[fs.length - 1];
      var periodos = H.textoPeriodos(est.mil.janelas.length ? est.mil.janelas : [{ hi: '08:00', hf: '08:00' }]);
      return msg().formHoje(texto + ', ' + (periodos || msg().dasAs('08h', '08h')));
    }

    /* um botão de militar numa lista do Quem */
    function itemMilitar(lista, m, extra, aoEscolher) {
      var item = RosterWork.tpl('tpl-escala-form-militar');
      if (!item) return;
      item.querySelector('.escala-distribuicao-grad').textContent = m.grad || '';
      item.querySelector('.escala-distribuicao-nome').textContent = m.nome || '';
      item.querySelector('.escala-form-militar-extra').textContent = extra;
      item.setAttribute('data-busca', RosterWork.busca.chave(m) + ' ' + RosterWork.busca.normalizar(m.grad));
      item.addEventListener('click', aoEscolher);
      itens.push({ cpf: m.cpf, el: item });
      lista.appendChild(item);
      return item;
    }

    function marcarEscolhido() {
      itens.forEach(function (it) { it.el.classList.toggle('escala-form-militar--escolhido', !!est.mil && it.cpf === est.mil.cpf); });
    }

    /* Quem: no "Sem ninguém", primeiro quem está sem função nesse horário; depois (e no Adicionar, só)
       os de folga, pela árvore de unidades + a busca */
    function montarQuem(form) {
      if (cfg.modo === 'preencher') {
        var w = H.faixa(est.periodos[0]);
        var listaServico = form.querySelector('.escala-form-lista--servico');
        var algum = false;
        (dados.sem_funcao || []).forEach(function (m) {
          var trechos = (m.periodos || []).map(H.faixa).map(function (f) { return H.cruza(f, w); }).filter(Boolean);
          if (!trechos.length) return;
          algum = true;
          itemMilitar(listaServico, m, msg().semFuncaoDas(H.textoPeriodos(trechos.map(H.periodo))), function () {
            est.mil = api.militarDoDia(m.cpf);
            atualizar();
          });
        });
        if (algum) {
          form.querySelector('.escala-form-grupo--servico').classList.remove('oculto');
          form.querySelector('.escala-form-grupo-rotulo--folga').classList.remove('oculto');
        }
      }
      el.listaFolga = form.querySelector('.escala-form-lista--folga');

      var pilula = RosterWork.tpl('tpl-escala-secao-busca');
      if (pilula) {
        var entrada = pilula.querySelector('.busca-entrada');
        el.entrada = entrada;
        entrada.addEventListener('input', filtrar);
        pilula.querySelector('.busca-limpar').addEventListener('click', function () { entrada.value = ''; entrada.focus(); filtrar(); });
        el.pilula = pilula;
        form.querySelector('.escala-form-busca').appendChild(pilula);
      }

      /* a árvore de unidades (modo único): começa na unidade do painel */
      var drop = form.querySelector('.escala-form-unidade');
      el.unidadeTexto = drop.querySelector('.campo-selecao-texto');
      var unidadeId = Number(api.unidadeId());
      var seletor = RosterWork.seletorUnidades.criar({
        modo: 'unico',
        dropdownEl: drop,
        arvoreEl: drop.querySelector('.arvore'),
        aoSelecionar: function (unidade) { el.unidadeTexto.textContent = unidade.nome; carregarDisponiveis(unidade.unidade_id); }
      });
      if (seletor) {
        seletor.montarArvore().then(function () {
          seletor.aplicarSelecaoPorIds([unidadeId]);
          var u = seletor.unidadesSelecionadas()[0];
          el.unidadeTexto.textContent = u ? u.nome : '';
        });
      }
      carregarDisponiveis(unidadeId);
    }

    /* quem está de folga na área da unidade escolhida, fora quem já entrou como pontual no rascunho:
       um título por unidade (a escolhida primeiro, na ordem que o banco manda) e os militares embaixo */
    function carregarDisponiveis(unidadeBusca) {
      var lista = el.listaFolga;
      itens = itens.filter(function (it) { return !lista.contains(it.el); });
      lista.textContent = '';
      el.vazio = null;
      el.titulos = [];
      var giro = RosterWork.tpl('tpl-escala-distribuicao-carregando');
      if (giro) lista.appendChild(giro);
      el.buscaUnidade = unidadeBusca;
      RosterWork.escalasDados.disponiveis(api.unidadeId(), api.iso(), unidadeBusca).then(function (resp) {
        if (el.buscaUnidade !== unidadeBusca || !lista.isConnected) return;
        lista.textContent = '';
        var jaPontuais = {};
        (api.rascunho().pontuais || []).forEach(function (x) { jaPontuais[x.cpf] = true; });
        var unidadeAtual = null, grupo = null;
        (resp || []).filter(function (m) { return !jaPontuais[m.cpf]; }).forEach(function (m) {
          if (m.unidade_id !== unidadeAtual) {
            unidadeAtual = m.unidade_id;
            grupo = { el: RosterWork.tpl('tpl-escala-form-unidade'), itens: [] };
            if (grupo.el) {
              grupo.el.textContent = m.unidade || '';
              lista.appendChild(grupo.el);
              el.titulos.push(grupo);
            }
          }
          var item = itemMilitar(lista, m, '', function () {
            est.mil = { cpf: m.cpf, grad: m.grad, nome: m.nome, janelas: [], deFolga: true, assume: m.assume || null };
            atualizar();
          });
          if (item) grupo.itens.push(item);
        });
        var vazio = RosterWork.tpl('tpl-escala-secao-vazio');
        if (vazio) {
          vazio.classList.add('escala-form-vazio');
          vazio.textContent = resp ? msg().ninguemEncontrado : msg().falhaCarregar;
          el.vazio = vazio;
          lista.appendChild(vazio);
        }
        marcarEscolhido();
        filtrar();
      });
    }

    function filtrar() {
      var termo = el.entrada ? el.entrada.value.trim() : '';
      if (el.pilula) el.pilula.classList.toggle('busca--com-texto', !!termo);
      var visiveis = 0;
      itens.forEach(function (it) {
        if (!el.listaFolga || !el.listaFolga.contains(it.el)) return;
        var casa = RosterWork.busca.casaTexto(termo, it.el.getAttribute('data-busca'));
        it.el.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      /* o título da unidade some quando ninguém dela casa com a busca */
      (el.titulos || []).forEach(function (g) {
        g.el.classList.toggle('oculto', !g.itens.some(function (it) { return !it.classList.contains('oculto'); }));
      });
      if (el.vazio) el.vazio.classList.toggle('oculto', visiveis > 0);
    }

    /* "Adicionar horário": o próximo horário livre depois do último (uma hora) */
    function adicionarPeriodo() {
      var livres = H.menos([[0, 1440]], H.uniao(janelasDoQuando()));
      if (!livres.length) return;
      var fimUltimo = H.faixa(est.periodos[est.periodos.length - 1])[1];
      var g = livres.filter(function (x) { return x[0] >= fimUltimo; })[0] || livres[0];
      est.periodos.push(H.periodo([g[0], Math.min(g[0] + 60, g[1])]));
      atualizar();
    }

    /* os horários do Quando (dropdown de números; de serviço, só as horas do serviço dele): o ✕ quando há
       mais de um e o Adicionar horário na 1ª linha */
    function montarPeriodos() {
      el.periodos.textContent = '';
      var opc = H.opcoesHoras(est.mil && !est.mil.deFolga ? est.mil.janelas : null);
      est.periodos.forEach(function (per, i) {
        var linha = RosterWork.horario.linha({
          hi: per.hi, hf: per.hf, opcoes: opc,
          aoInicio: function (h) { per.hi = h; atualizar(); },
          aoFim: function (h) { per.hf = h; atualizar(); },
          aoRemover: est.periodos.length > 1 ? function () { est.periodos.splice(i, 1); atualizar(); } : null,
          aoAdicionar: i === 0 ? adicionarPeriodo : null
        });
        if (linha) el.periodos.appendChild(linha);
      });
    }

    /* um item de lista (Posto ou Função): o nome e a situação (só na Função) */
    function itemMenu(menu, texto, situacao, aoEscolher) {
      var it = RosterWork.tpl('tpl-escala-form-item');
      if (!it) return;
      it.querySelector('.escala-form-item-nome').textContent = texto;
      it.querySelector('.escala-form-item-situacao').textContent = situacao || '';
      it.addEventListener('click', aoEscolher);
      menu.appendChild(it);
    }

    /* o texto do campo de seleção: o escolhido, ou o rótulo vazio do molde ("Posto", "Função") */
    function textoSelecao(dropdown, texto, vazio) {
      var t = dropdown.querySelector('.campo-selecao-texto');
      t.textContent = texto || vazio;
      t.classList.toggle('campo-selecao-texto--vazio', !texto);
    }

    function montarPostos() {
      var menu = el.posto.querySelector('.dropdown-menu');
      (dados.postos || []).forEach(function (po) {
        itemMenu(menu, po.nome, '', function () { est.posto = po; est.funcao = null; atualizar(); });
      });
    }

    /* situação da função nesses horários: "vazia" ou quem sai dela */
    function situacao(nomeFuncao) {
      var nomes = {};
      ocupantes(est.posto, nomeFuncao).forEach(function (o) { nomes[nomeDe(o.m)] = true; });
      var lista = Object.keys(nomes);
      return lista.length ? msg().itemSai(lista) : msg().itemVazia;
    }

    /* as funções do posto escolhido (com a situação) + a "Nova função" (a próxima numeração, quando o posto ainda cabe gente) */
    function montarFuncoes() {
      var menu = el.funcao.querySelector('.dropdown-menu');
      menu.textContent = '';
      if (!est.posto) return;
      var nomes = [];
      (est.posto.funcoes || []).forEach(function (f) {
        if (!BLOQUEADAS.test(f.nome) && nomes.indexOf(f.nome) < 0) nomes.push(f.nome);
      });
      nomes.forEach(function (nm) { itemMenu(menu, nm, situacao(nm), function () { est.funcao = nm; atualizar(); }); });
      var nova = est.posto.adicionar && est.posto.adicionar.nome_funcao;
      if (nova && !est.posto.cheio && nomes.indexOf(nova) < 0) {
        itemMenu(menu, msg().novaFuncao(nova), msg().itemVazia, function () { est.funcao = nova; atualizar(); });
      }
    }

    /* ---------- atualização (a cada escolha) ---------- */

    function atualizar() {
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
      var deServico = est.mil && !est.mil.deFolga;
      marcarEscolhido();

      /* quem é o mais antigo assume o Chefe de Socorro / Oficial de Área sozinho: a tela avisa */
      var assume = est.mil && est.mil.assume;
      el.assume.classList.toggle('oculto', !assume);
      if (assume) {
        el.assume.querySelector('.nota-texto').textContent = assume === 'chefe_socorro'
          ? msg().assumeChefe(nomeDe(est.mil), quemTemPapel(assume))
          : msg().assumeOficial(nomeDe(est.mil), quemTemPapel(assume));
      }

      /* Quando: os horários e a régua (com as funções que ele já tem, se está de serviço) */
      montarPeriodos();
      var pedacos = [];
      if (deServico) {
        api.funcoesDoMilitar(est.mil.cpf).forEach(function (e) {
          e.periodos.forEach(function (per) { pedacos.push({ hi: per.hi, hf: per.hf }); });
        });
      }
      est.periodos.forEach(function (per) { pedacos.push({ hi: per.hi, hf: per.hf, classe: 'novo' }); });
      H.regua(el.regua, pedacos);

      /* Onde: "O sistema distribui" só no Adicionar (quem entra de folga) */
      var podeSistema = cfg.modo === 'adicionar';
      if (!podeSistema) est.onde = 'funcao';
      el.sistema.classList.toggle('oculto', !podeSistema);
      [].forEach.call(el.form.querySelectorAll('input[name="escala-form-onde"]'), function (r) { r.checked = r.value === est.onde; });
      el.selecoes.classList.toggle('oculto', est.onde !== 'funcao');
      montarFuncoes();
      textoSelecao(el.posto, est.posto && est.posto.nome, el.postoVazio);
      var ehNova = est.posto && est.posto.adicionar && est.funcao === est.posto.adicionar.nome_funcao
        && !(est.posto.funcoes || []).some(function (f) { return f.nome === est.funcao; });
      textoSelecao(el.funcao, est.funcao && (ehNova ? msg().novaFuncao(est.funcao) : est.funcao), el.funcaoVazio);

      /* ele já tem função nesse horário: vai acumular (para deixar uma, desmarca-se na tela do militar) */
      var atuais = est.onde === 'funcao' ? funcoesAtuais() : [];
      el.acumula.classList.toggle('oculto', !atuais.length);
      if (atuais.length) {
        el.acumula.querySelector('.nota-texto').textContent =
          msg().vaiAcumular(atuais.map(function (e) { return api.funcaoNoPosto(e.funcao, e.posto); }));
      }

      /* o efeito da escolha numa frase */
      var partes = partesAviso();
      el.aviso.classList.toggle('oculto', !partes.length);
      el.avisoTexto.textContent = partes.length ? msg().avisoEfeito(partes) : '';

      /* numera as seções que aparecem, na ordem da tela */
      var n = 0;
      [].forEach.call(el.form.querySelectorAll('.escala-form-secao'), function (s) {
        if (!s.classList.contains('oculto')) s.querySelector('.escala-form-num').textContent = String(++n);
      });
    }

    /* ---------- aplicar ---------- */

    function aplicar() {
      var js = janelasDoQuando();
      var soma = function (lista) { return lista.reduce(function (s, w) { return s + w[1] - w[0]; }, 0); };
      var erro = !est.mil ? msg().formErroQuem
        : soma(H.uniao(js)) !== soma(js) ? msg().formErroPeriodos
        : (est.onde === 'funcao' && (!est.posto || !est.funcao)) ? msg().formErroOnde
        : (est.onde === 'funcao' && jaNaFuncao()) ? msg().formErroMesmaFuncao : '';
      if (erro) { RosterWork.avisar({ tipo: 'erro', mensagem: erro }); return; }
      var c = {
        cpf: est.mil.cpf, posto: est.posto, funcao: est.funcao,
        periodos: est.periodos.map(function (p) { return { hi: p.hi, hf: p.hf }; }),
        sistema: est.onde === 'sistema', pontual: null
      };
      if (!est.mil.deFolga) { concluir(c); return; }
      /* de folga entra como pontual: pergunta se as horas vão para o banco de horas */
      var botoes = RosterWork.mensagens.botoes;
      RosterWork.confirmar({
        tipo: 'aviso',
        mensagem: msg().contabilizarPontual(nomeDe(est.mil), H.horasTexto(soma(js)), diaMes(api.iso())),
        textoConfirmar: botoes.contabilizar,
        textoAlternativo: botoes.naoContabilizar,
        textoCancelar: botoes.cancelar,
        aoConfirmar: function () { c.pontual = { contabilizar: true }; concluir(c); },
        aoAlternativo: function () { c.pontual = { contabilizar: false }; concluir(c); }
      });
    }

    function concluir(c) { api.aplicarColocacao(c); api.concluir(); }

    api.abrir(cfg.modo === 'adicionar' ? msg().formBotaoAdicionar : cfg.modo === 'nova' ? msg().formBotaoNovaFuncao : msg().formBotaoAplicar,
      montar, aplicar);
  }

  window.RosterWork.escalasPainelFormulario = { abrir: abrir };
})();
