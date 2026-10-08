/* ============================================================
   PROGRAMADOR — BUGS › FORMULÁRIO (novo / editar)
   Monta o formulário do bug no corpo da aba Bugs: título,
   gravidade, Relatado por (seleção com pesquisa entre os
   militares ativos), onde acontece e descrição. Vale para o bug
   novo, para editar e para criar a partir de uma mensagem do
   Fale conosco (já preenchido). Não grava: entrega os dados a
   quem abriu (programador-bugs.js), que chama o bug_salvar.
   Registra o guarda de saída enquanto houver texto não salvo e
   confirma antes de trocar o formulário alterado por outra coisa.
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var formulario = null;
  var relatores = null;
  var guardaLigada = false;

  function M() { return RosterWork.mensagens.programadorBugs; }

  /* "3ºSgt. Meireles · 2ºPEL" (a unidade só quando houver) */
  function rotuloMilitar(titulo, unidade) { return unidade ? titulo + ' · ' + unidade : (titulo || ''); }

  /* "Onde acontece" a partir da tela que o Fale conosco anexou (página › aba) */
  function ondeDoContexto(contexto) {
    if (!contexto || typeof contexto !== 'object') return '';
    var pagina = '';
    if (contexto.pagina) {
      var item = document.querySelector('.menu-item[data-pagina="' + CSS.escape(String(contexto.pagina)) + '"] .menu-item-label');
      pagina = item ? item.textContent.trim() : String(contexto.pagina);
    }
    return [pagina, contexto.aba || ''].filter(Boolean).join(' › ');
  }

  /* há formulário na tela com algo mudado? (o guarda de saída e a troca de bug perguntam) */
  function sujo() {
    return !!(formulario && document.contains(formulario.no) && formulario.sujo());
  }

  function fechar() { formulario = null; }

  /* troca o que está no corpo; com formulário alterado, confirma antes de perder o texto */
  function pedirTroca(continuar) {
    if (!sujo() || !RosterWork.confirmar) { continuar(); return; }
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: RosterWork.mensagens.edicao.sairSemSalvar,
      textoConfirmar: RosterWork.mensagens.botoes.sairSemSalvar,
      textoCancelar: RosterWork.mensagens.botoes.continuarEditando,
      aoConfirmar: function () { fechar(); continuar(); }
    });
  }

  /* nova visita à página: a lista de militares é lida de novo */
  function reiniciar() {
    formulario = null;
    relatores = null;
    if (!guardaLigada && RosterWork.guardaSaida) {
      RosterWork.guardaSaida.registrar(sujo);
      guardaLigada = true;
    }
  }

  /* opcoes: { bug (editar) | recado (criar da mensagem) | nenhum (novo),
               aoCancelar(), aoSalvar(dados, botao) } */
  function abrir(alvo, opcoes) {
    var bug = opcoes.bug || null;
    var recado = opcoes.recado || null;
    alvo.textContent = '';
    var no = RosterWork.tpl('tpl-bug-formulario');
    if (!no) return;

    var editar = !!bug;
    no.querySelector('.bug-form-titulo-novo').classList.toggle('oculto', editar);
    no.querySelector('.bug-form-titulo-editar').classList.toggle('oculto', !editar);
    no.querySelector('#bug-form-criar').classList.toggle('oculto', editar);
    no.querySelector('#bug-form-salvar').classList.toggle('oculto', !editar);

    var inTitulo = no.querySelector('#bug-form-titulo');
    var trilhoGravidade = no.querySelector('#bug-form-gravidade');
    var inOnde = no.querySelector('#bug-form-onde');
    var inDescricao = no.querySelector('#bug-form-descricao');

    var autorRecado = recado ? ((recado.autor_grad ? recado.autor_grad + ' ' : '') + (recado.autor_nome || '')).trim() : '';
    var inicial = {
      titulo: bug ? bug.titulo : (recado ? recado.assunto || '' : ''),
      gravidade: bug ? bug.gravidade : '',
      relator: bug ? (bug.relator_cpf ? { cpf: bug.relator_cpf, titulo: rotuloMilitar(bug.relator_titulo, bug.relator_unidade) } : null)
                   : (recado && recado.autor_cpf ? { cpf: recado.autor_cpf, titulo: autorRecado } : null),
      onde: bug ? bug.onde || '' : (recado ? ondeDoContexto(recado.contexto) : ''),
      descricao: bug ? bug.descricao : (recado ? recado.mensagem || '' : '')
    };
    var estado = { relator: inicial.relator };

    inTitulo.value = inicial.titulo;
    inOnde.value = inicial.onde;
    inDescricao.value = inicial.descricao;
    Array.prototype.forEach.call(trilhoGravidade.querySelectorAll('.aba'), function (b) {
      b.classList.toggle('aba--ativa', b.getAttribute('data-gravidade') === inicial.gravidade);
    });
    ligarRelator(no, estado);

    function gravidadeEscolhida() {
      var ativa = trilhoGravidade.querySelector('.aba--ativa');
      return ativa ? ativa.getAttribute('data-gravidade') : '';
    }
    function cpfRelator(relator) { return relator ? relator.cpf : ''; }

    formulario = {
      no: no,
      sujo: function () {
        return inTitulo.value !== inicial.titulo || gravidadeEscolhida() !== inicial.gravidade ||
          cpfRelator(estado.relator) !== cpfRelator(inicial.relator) ||
          inOnde.value !== inicial.onde || inDescricao.value !== inicial.descricao;
      }
    };

    var campos = RosterWork.campos;
    inTitulo.addEventListener('input', function () { campos.limparErro(inTitulo); });
    inDescricao.addEventListener('input', function () { campos.limparErro(inDescricao); });
    if (RosterWork.abas) RosterWork.abas.ligar(trilhoGravidade, function () { campos.limparErro(trilhoGravidade); });

    no.querySelector('#bug-form-cancelar').addEventListener('click', function () { opcoes.aoCancelar(); });

    function salvar() {
      campos.limparErros(no);
      var titulo = inTitulo.value.trim();
      var gravidade = gravidadeEscolhida();
      var descricao = inDescricao.value.trim();
      if (!titulo) { campos.marcarErro(inTitulo, M().tituloVazio); return; }
      if (!gravidade) { campos.marcarErro(trilhoGravidade, M().gravidadeVazia); return; }
      if (!descricao) { campos.marcarErro(inDescricao, M().descricaoVazia); return; }
      opcoes.aoSalvar({
        p_id: bug ? bug.id : null,
        p_titulo: titulo,
        p_gravidade: gravidade,
        p_onde: inOnde.value.trim() || null,
        p_descricao: descricao,
        p_relator_cpf: cpfRelator(estado.relator) || null,
        p_recado_id: recado ? recado.id : null
      }, this);
    }
    no.querySelector('#bug-form-criar').addEventListener('click', salvar);
    no.querySelector('#bug-form-salvar').addEventListener('click', salvar);

    alvo.appendChild(no);
  }

  /* ---------- campo Relatado por: seleção com pesquisa ---------- */
  function ligarRelator(no, estado) {
    var caixa = no.querySelector('#bug-form-relator-dropdown');
    var entrada = no.querySelector('#bug-form-relator');
    var menu = no.querySelector('#bug-form-relator-menu');

    function mostrarEscolhido() { entrada.value = estado.relator ? estado.relator.titulo : ''; }
    function escolher(relator) {
      estado.relator = relator;
      mostrarEscolhido();
      if (RosterWork.fecharDropdowns) RosterWork.fecharDropdowns();
    }
    function aviso(texto) {
      var item = RosterWork.tpl('tpl-bug-relator-vazio');
      if (item) item.textContent = texto;
      return item;
    }
    function semResultado() { return menu.querySelector('[data-sem-resultado]'); }
    function filtrar(termo) {
      var visiveis = 0;
      Array.prototype.forEach.call(menu.querySelectorAll('[data-busca]'), function (it) {
        var casa = !termo || it.getAttribute('data-busca').indexOf(termo) !== -1;
        it.classList.toggle('oculto', !casa);
        if (casa) visiveis++;
      });
      var vazio = semResultado();
      if (vazio) vazio.classList.toggle('oculto', visiveis > 0);
    }
    function preencher(lista) {
      menu.textContent = '';
      var ninguem = RosterWork.tpl('tpl-bug-relator-ninguem');
      if (ninguem) {
        ninguem.addEventListener('click', function () { escolher(null); });
        menu.appendChild(ninguem);
      }
      lista.forEach(function (militar) {
        var opcao = RosterWork.tpl('tpl-bug-relator-opcao');
        if (!opcao) return;
        var texto = rotuloMilitar(militar.titulo, militar.unidade);
        opcao.textContent = texto;
        opcao.setAttribute('data-busca', RosterWork.busca.normalizar(texto));
        opcao.addEventListener('click', function () { escolher({ cpf: militar.cpf, titulo: texto }); });
        menu.appendChild(opcao);
      });
      var vazio = aviso(M().relatorNenhum);
      if (vazio) {
        vazio.setAttribute('data-sem-resultado', '');
        vazio.classList.add('oculto');
        menu.appendChild(vazio);
      }
    }
    function falhou() {
      menu.textContent = '';
      var item = aviso(M().relatorFalha);
      if (item) menu.appendChild(item);
    }

    mostrarEscolhido();
    if (relatores) {
      preencher(relatores);
    } else {
      var carregando = aviso(M().carregando);
      if (carregando) menu.appendChild(carregando);
      RosterWork.rpc('bug_relatores_listar').then(function (r) {
        if (!Array.isArray(r)) { falhou(); return; }
        relatores = r;
        preencher(relatores);
      }).catch(falhou);
    }

    /* 1º clique seleciona tudo, então digitar substitui o nome em vez de acrescentar */
    entrada.addEventListener('mousedown', function (e) {
      if (document.activeElement !== entrada) { e.preventDefault(); entrada.focus(); }
    });
    entrada.addEventListener('focus', function () { filtrar(''); entrada.select(); });
    entrada.addEventListener('input', function () {
      if (!caixa.classList.contains('dropdown--aberto') && RosterWork.abrirDropdown) RosterWork.abrirDropdown(caixa);
      filtrar(RosterWork.busca.normalizar(entrada.value.trim()));
    });
    /* saiu sem escolher: apagado vira "Ninguém"; senão volta ao escolhido */
    entrada.addEventListener('blur', function () {
      if (!entrada.value.trim()) estado.relator = null;
      mostrarEscolhido();
    });
    /* Enter escolhe o 1º militar à vista */
    entrada.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var primeiro = menu.querySelector('[data-busca]:not(.oculto)');
      if (primeiro) primeiro.click();
    });
  }

  window.RosterWork.programadorBugsFormulario = {
    abrir: abrir,
    sujo: sujo,
    fechar: fechar,
    pedirTroca: pedirTroca,
    reiniciar: reiniciar,
    rotuloMilitar: rotuloMilitar
  };
})();
