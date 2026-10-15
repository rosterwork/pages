/* ============================================================
   PENDÊNCIAS — o que espera decisão, num lugar só
   Duas abas, cada uma com um dono claro:
     · Para mim       — o que espera você como militar (a troca
                        que pediram a você)
     · Administração  — só administrador: trocas, folgas e correções
                        para aprovar (com o seletor do tipo na barra)
                        e o "Para corrigir"
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

  var conteudo = null;
  var admin = false;
  var abaAtual = 'paramim';
  var filtro = 'todos';
  var dados = { minhas: [], aprovar: [], corrigir: [] };
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
      } else if (g.tipo === 'manutencao') {
        /* não navega: o conserto é na Escala/Distribuição */
        el = RosterWork.tpl('tpl-pendencias-manutencao');
        if (!el) return;
        itensCorrigir(el, g.viaturas, 'tpl-pendencias-manut-item', function (li, x) {
          li.querySelector('.pendencias-corrigir-nome').textContent = x.viatura || '';
          li.querySelector('.pendencias-corrigir-data').textContent = x.desde || '';
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

  /* ---------- desenho ---------- */
  function desenhar() {
    var m = msg();
    filaMinhas.definir(dados.minhas);
    filaAprovar.definir(filtrados());
    desenharCorrigir(q('#pendencias-corrigir'), dados.corrigir);
    /* o "Para corrigir" não é de nenhum tipo do seletor: só aparece em Todos */
    q('#pendencias-secao-corrigir').classList.toggle('oculto', filtro !== 'todos');
    var total = dados.minhas.length + (admin ? dados.aprovar.length : 0);
    q('#pendencias-contagem').textContent = total ? m.contagem(total) : '';
    escreverSelo('#pendencias-paramim-contagem', dados.minhas.length);
    escreverSelo('#pendencias-administracao-contagem', dados.aprovar.length);
  }

  function falha() {
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
    admin = RosterWork.sessao.ehAdmin();
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
      if (admin && !dados.minhas.length && dados.aprovar.length) clicarAba('administracao');
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
