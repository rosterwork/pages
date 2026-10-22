/* ============================================================
   PENDÊNCIAS — o que espera decisão, num lugar só
   Duas abas, cada uma com um dono claro:
     · Para mim       — o que espera você como militar (a troca
                        que pediram a você), os seus "Prazos"
                        (a extra do mês seguinte) e o "Seu
                        cadastro" (a CNH, no painel da CNH)
     · Administração  — só administrador: trocas, folgas e correções
                        para aprovar (com o seletor do tipo na barra)
                        e o "Para corrigir"
   Os selos das abas e o número ao lado do título somam pela mesma
   regra do número do menu (RosterWork.avisosSino.quantoSoma).
   O militar comum não vê abas nem barra. As filas são o componente
   geral-fila (o mesmo das abas Pendências da Trocas, da Folgas e da
   Usuários): o mesmo cartão, o mesmo painel e, depois de decidir, o
   próximo pedido. Quem chega por um aviso abre o pedido direto (a
   referência é o id dele). Aqui ficam o seletor, as contagens e o
   desenho do "Para corrigir".
   Clona moldes; não cria HTML.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};
  RW.paginas = RW.paginas || {};

  var TIPOS_DO_FILTRO = { troca: ['troca'], folga: ['folga'], usuarios: ['dados'] };
  /* o que é do "Seu cadastro" (a fila entrega junto com os prazos) */
  var DO_CADASTRO = { cnh: true };

  var conteudo = null;
  var admin = false;
  var abaAtual = 'paramim';
  var filtro = 'todos';
  var dados = { minhas: [], aprovar: [], corrigir: [], prazos: [] };
  var filaMinhas = null, filaAprovar = null;
  var leitura = 0;     // a última leitura vence

  function msg() { return RW.mensagens.pendencias; }
  function q(sel) { return conteudo ? conteudo.querySelector(sel) : null; }

  function filtrados() {
    return filtro === 'todos' ? dados.aprovar : RW.fila.doTipo(dados.aprovar, TIPOS_DO_FILTRO[filtro]);
  }

  function escreverSelo(sel, n) {
    var s = q(sel);
    if (!s) return;
    s.textContent = n ? String(n) : '';
    s.classList.toggle('oculto', !n);
  }

  /* ---------- "Para corrigir" (só nesta página) ---------- */
  function cabecalhoCorrigir(el, g) {
    el.querySelector('.pendencias-corrigir-contagem').textContent = g.contagem;
    el.querySelector('.pendencias-corrigir-texto').textContent = g.texto || '';
  }

  function itensCorrigir(el, linhas, molde, preencher) {
    var ul = el.querySelector('.pendencias-corrigir-itens');
    (linhas || []).forEach(function (x) {
      var li = RosterWork.tpl(molde);
      if (!li) return;
      preencher(li, x);
      if (ul) ul.appendChild(li);
    });
  }

  function desenharCorrigir(lista, grupos) {
    lista.textContent = '';
    if (!grupos.length) {
      var v = RosterWork.tpl('tpl-pedido-vazio');
      if (v) { v.textContent = msg().vazioCorrigir; lista.appendChild(v); }
      return;
    }
    grupos.forEach(function (g) {
      var el;
      if (g.tipo === 'fora_escala') {
        /* não navega: o conserto é no Contínuos */
        el = RosterWork.tpl('tpl-pendencias-fora');
        if (!el) return;
        itensCorrigir(el, g.militares, 'tpl-pendencias-fora-item', function (li, x) {
          li.querySelector('.pendencias-corrigir-grad').textContent = x.grad || '';
          li.querySelector('.pendencias-corrigir-nome').textContent = x.nome || '';
          li.querySelector('.pendencias-corrigir-unidade').textContent = x.unidade || '';
        });
      } else if (g.tipo === 'retorno_afastamento') {
        /* não navega: a entrada no ciclo se marca no Contínuos */
        el = RosterWork.tpl('tpl-pendencias-retorno');
        if (!el) return;
        itensCorrigir(el, g.militares, 'tpl-pendencias-retorno-item', function (li, x) {
          li.querySelector('.pendencias-corrigir-grad').textContent = x.grad || '';
          li.querySelector('.pendencias-corrigir-nome').textContent = x.nome || '';
          li.querySelector('.pendencias-corrigir-motivo').textContent = x.motivo || '';
          li.querySelector('.pendencias-corrigir-data').textContent = x.volta || '';
          li.querySelector('.pendencias-corrigir-unidade').textContent = x.unidade || '';
        });
      } else {
        /* leva à tela do conserto (ex.: a Distribuição a revisar) */
        el = RosterWork.tpl('tpl-pendencias-corrigir');
        if (!el) return;
        el.addEventListener('click', function () { if (g.pagina && RW.irParaPagina) RW.irParaPagina(g.pagina, g.aba); });
      }
      cabecalhoCorrigir(el, g);
      lista.appendChild(el);
    });
  }

  /* ---------- "Prazos" e "Seu cadastro" (Para mim): o que você responde ---------- */
  /* o prazo leva à tela onde se responde; a CNH abre o painel dela aqui mesmo */
  function desenharPrazos(lista, prazos) {
    lista.textContent = '';
    prazos.forEach(function (g) {
      var el = RosterWork.tpl('tpl-pendencias-prazo');
      if (!el) return;
      el.querySelector('.pendencias-corrigir-texto').textContent = g.texto || '';
      el.querySelector('.pendencias-prazo-mensagem').textContent = g.mensagem || '';
      el.addEventListener('click', function () {
        if (g.tipo === 'cnh') { if (RW.cnhPainel) RW.cnhPainel.abrir({ aoSalvar: carregar }); return; }
        if (g.pagina && RW.irParaPagina) RW.irParaPagina(g.pagina, g.aba, g.referencia);
      });
      lista.appendChild(el);
    });
  }

  /* ---------- contagens (a mesma regra do número do menu) ---------- */
  function somar(grupos) {
    var quanto = RW.avisosSino ? RW.avisosSino.quantoSoma : function () { return 0; };
    return grupos.reduce(function (s, g) { return s + quanto(g); }, 0);
  }

  function contagemParaMim() { return dados.minhas.length + somar(dados.prazos); }
  function contagemAdministracao() { return dados.aprovar.length + somar(dados.corrigir); }

  /* ---------- desenho ---------- */
  function desenhar() {
    var m = msg();
    filaMinhas.definir(dados.minhas);
    filaAprovar.definir(filtrados());
    var prazos = dados.prazos.filter(function (g) { return !DO_CADASTRO[g.tipo]; });
    var cadastro = dados.prazos.filter(function (g) { return DO_CADASTRO[g.tipo]; });
    desenharPrazos(q('#pendencias-prazos'), prazos);
    q('#pendencias-secao-prazos').classList.toggle('oculto', !prazos.length);
    desenharPrazos(q('#pendencias-cadastro'), cadastro);
    q('#pendencias-secao-cadastro').classList.toggle('oculto', !cadastro.length);
    desenharCorrigir(q('#pendencias-corrigir'), dados.corrigir);
    /* o "Para corrigir" não é de nenhum tipo do seletor: só aparece em Todos */
    q('#pendencias-secao-corrigir').classList.toggle('oculto', filtro !== 'todos');
    var total = contagemParaMim() + (admin ? contagemAdministracao() : 0);
    q('#pendencias-contagem').textContent = total ? m.contagem(total) : '';
    escreverSelo('#pendencias-paramim-contagem', contagemParaMim());
    escreverSelo('#pendencias-administracao-contagem', contagemAdministracao());
  }

  function falha() {
    q('#pendencias-secao-prazos').classList.add('oculto');
    q('#pendencias-secao-cadastro').classList.add('oculto');
    ['#pendencias-minhas', '#pendencias-aprovar', '#pendencias-corrigir'].forEach(function (sel) {
      var lista = q(sel);
      if (!lista) return;
      lista.textContent = '';
      var v = RosterWork.tpl('tpl-pedido-vazio');
      if (v) { v.textContent = msg().falhaCarregar; lista.appendChild(v); }
    });
  }

  /* lê tudo de uma vez (a fila também chama depois de cada decisão) */
  function carregar() {
    var minha = ++leitura;
    return RW.fila.ler().then(function (r) {
      if (minha !== leitura || !conteudo || !document.contains(conteudo)) return;
      if (!r) { falha(); return; }
      dados = r;
      desenhar();
    });
  }

  function mostrarAba(aba) {
    abaAtual = aba;
    [].forEach.call(conteudo.querySelectorAll('[data-aba-painel]'), function (p) {
      p.classList.toggle('oculto', p.getAttribute('data-aba-painel') !== aba);
    });
    q('#pendencias-filtro').classList.toggle('oculto', aba !== 'administracao');
  }

  function clicarAba(aba) {
    var b = q('#pendencias-abas .aba[data-aba="' + aba + '"]');
    if (b && aba !== abaAtual) b.click();
  }

  function iniciar(el) {
    conteudo = el;
    admin = RosterWork.sessao.temPapel('pelotao');   // a aba Administração traz só o que este admin pode decidir (o banco filtra)
    abaAtual = 'paramim';
    filtro = 'todos';
    var m = msg();
    filaMinhas = RW.fila.criar(q('#pendencias-minhas'), { vazio: m.vazioMinhas, recarregar: carregar });
    filaAprovar = RW.fila.criar(q('#pendencias-aprovar'), {
      vazio: m.vazioAprovar,
      recarregar: carregar
    });

    /* o militar comum só tem "Para mim": sem abas e sem barra */
    q('#pendencias-abas').classList.toggle('oculto', !admin);
    q('#pendencias-barra').classList.toggle('oculto', !admin);

    if (RW.abas) {
      RW.abas.ligar(q('#pendencias-abas'), function (aba) {
        var nova = aba.getAttribute('data-aba');
        if (nova === abaAtual) return;
        if (RW.painel && RW.painel.estaAberto()) RW.painel.fechar();
        mostrarAba(nova);
      });
      RW.abas.ligar(q('#pendencias-filtro'), function (aba) {
        filtro = aba.getAttribute('data-tipo') || 'todos';
        if (RW.painel && RW.painel.estaAberto() && abaAtual === 'administracao') RW.painel.fechar();
        filaAprovar = RW.fila.criar(q('#pendencias-aprovar'), {
          vazio: filtro === 'todos' ? m.vazioAprovar : m.vazioFiltro,
          recarregar: carregar
        });
        desenhar();
      });
    }
    mostrarAba('paramim');

    var referencia = RW.referenciaPedida ? RW.referenciaPedida('pendencias') : null;
    return carregar().then(function () {
      /* o administrador sem nada "para mim" abre direto na Administração */
      if (admin && !contagemParaMim() && dados.aprovar.length) clicarAba('administracao');
      if (!referencia) return;
      /* chegou por um aviso: vai para a aba onde o pedido está e abre (nessa ordem:
         trocar de aba fecha o painel) */
      var ehMinha = dados.minhas.some(function (p) { return p.id === String(referencia); });
      if (ehMinha) { clicarAba('paramim'); filaMinhas.abrirId(referencia); }
      else if (admin) { clicarAba('administracao'); filaAprovar.abrirId(referencia); }
    });
  }

  RW.paginas.pendencias = { iniciar: iniciar };
})();
