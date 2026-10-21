/* ============================================================
   USUÁRIOS — a ficha: abas Férias · Licenças · Dispensas (leitura)
   (RosterWork.usuariosPainelAfastamentos)
   O ano no subcabeçalho do painel (o mesmo seletor da página) e uma
   caixa por tipo (Férias tem uma), com os períodos daquele ano em
   ordem de data: a situação (Em curso, Marcado, Encerrado), as datas
   e os dias (e "fora do fluxo"). Quem administra o militar vê todas
   as caixas, cada uma com o lápis que abre a sub-tela do tipo
   (usuarios-painel-afastamentos-editar.js); quem só lê vê as caixas
   que têm período. Lê tudo do militar uma vez (afastamentos_listar
   sem ano) e guarda enquanto a ficha está aberta: trocar de ano não
   relê; gravar esquece o que foi lido.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var CATEGORIA = { ferias: 'ferias', licencas: 'licenca', dispensas: 'dispensa' };
  var lidos = {};       // categoria -> afastamentos do militar (todos os anos)
  var cpfLido = null;   // de quem são os lidos
  var ano = null;       // o ano da ficha (abre no da página)
  var atual = null;     // a aba desenhada agora: { corpo, ctx }
  var token = 0;        // latest-wins: a resposta de outra aba ou de outra ficha é ignorada

  function M() { return RosterWork.mensagens.afastamentos; }
  function A() { return RosterWork.usuariosAfastamentos; }

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function isoHoje() {
    var d = new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }

  /* "Em curso" | "Marcado" | "Encerrado", pelo dia de hoje */
  function situacao(inicio, fim) {
    var hoje = isoHoje();
    if (String(fim) < hoje) return M().encerrado;
    if (String(inicio) > hoje) return M().marcado;
    return M().emCurso;
  }

  /* os períodos que tocam o ano */
  function doAno(lista, a) {
    var ini = a + '-01-01', fim = a + '-12-31';
    return lista.filter(function (x) { return String(x.data_inicio) <= fim && String(x.data_fim) >= ini; });
  }

  /* os tipos da aba: Férias tem um; Licenças e Dispensas, os fixos e, quando aparece, a "Licença" (o tipo de saúde que o banco esconde) */
  function tiposDaAba(cat, lista) {
    var tipos = A().tiposDe(cat);
    if (cat === 'licenca' && lista.some(function (x) { return x.tipo === 'licenca'; })) tipos.push('licenca');
    return tipos;
  }

  /* uma caixa por tipo: os períodos do ano (situação · datas · dias) e, para quem administra, o lápis */
  function desenhar(corpo, ctx) {
    var cat = CATEGORIA[ctx.secao];
    var L = RosterWork.usuariosPainelLeitura;
    var todos = lidos[cat] || [];
    var noAno = doAno(todos, ano);
    var caixas = 0;
    corpo.textContent = '';
    tiposDaAba(cat, todos).forEach(function (tipo) {
      var doTipo = function (x) { return cat === 'ferias' || x.tipo === tipo; };
      var periodos = noAno.filter(doTipo);
      var podeEditar = ctx.admin && tipo !== 'licenca';
      if (!periodos.length && !podeEditar) return;
      var titulo = M().tipos[tipo];
      var b = L.bloco(titulo, 'Editar ' + titulo, podeEditar ? function () {
        ctx.editar({ categoria: cat, tipo: tipo, rotulo: titulo, ano: ano, periodos: todos.filter(doTipo) });
      } : null);
      if (!b) return;
      if (!periodos.length) {
        var vazio = RosterWork.tpl('tpl-ficha-ajuda');
        if (vazio) { vazio.textContent = M().vazioTipo(cat, ano); b.appendChild(vazio); }
      }
      periodos.forEach(function (x) {
        var extra = M().dias(x.dias) + (x.fora_do_fluxo ? ' · ' + M().extraFora : '');
        L.linha(b, situacao(x.data_inicio, x.data_fim), A().textoDatas(x.data_inicio, x.data_fim, ano), extra);
      });
      corpo.appendChild(b);
      caixas++;
    });
    /* quem só lê e não há nada no ano: a área sem dados */
    if (!caixas) {
      var estado = RosterWork.painel.criarEstado(M().vazioAba(cat, ano));
      if (estado) corpo.appendChild(estado);
    }
  }

  /* o ano no subcabeçalho do painel; trocar de ano redesenha a aba (sem reler) */
  function montarAno(barra) {
    if (!barra) return;
    barra.textContent = '';
    var s = A().seletorAno(ano, function (a) {
      ano = a;
      if (atual) desenhar(atual.corpo, atual.ctx);
    });
    if (!s) return;
    barra.appendChild(s.el);
    barra.classList.remove('oculto');
  }

  /* desenha a aba da ficha. ctx = { secao, pessoa, admin, anoInicial, editar(alvo) } */
  function montar(corpo, barra, ctx) {
    if (!corpo || !ctx || !CATEGORIA[ctx.secao]) return;
    var cat = CATEGORIA[ctx.secao];
    if (cpfLido !== ctx.pessoa.usuario_id) { lidos = {}; cpfLido = ctx.pessoa.usuario_id; }
    if (ano == null) ano = ctx.anoInicial || A().anoAtual();
    atual = { corpo: corpo, ctx: ctx };
    montarAno(barra);
    if (lidos[cat]) { desenhar(corpo, ctx); return; }
    corpo.textContent = '';
    var carregando = RosterWork.painel.criarCarregando();
    if (carregando) corpo.appendChild(carregando);
    var meu = ++token, essa = atual;
    RosterWork.usuariosAfastamentosDados.listar(cat, null, ctx.pessoa.usuario_id).then(function (lista) {
      if (meu !== token || atual !== essa) return;
      if (lista == null) {
        corpo.textContent = '';
        var erro = RosterWork.painel.criarEstado(M().falhaCarregar);
        if (erro) corpo.appendChild(erro);
        return;
      }
      lidos[cat] = lista;
      desenhar(corpo, ctx);
    });
  }

  /* a aba saiu da tela (outra aba, sub-tela ou o painel fechou): respostas atrasadas não desenham */
  function reset() { atual = null; token++; }

  /* outra ficha (sem o ano) ou depois de gravar (mantém o ano): esquece o que foi lido */
  function esquecer(manterAno) {
    lidos = {};
    cpfLido = null;
    if (!manterAno) ano = null;
    reset();
  }

  window.RosterWork.usuariosPainelAfastamentos = {
    montar: montar, reset: reset, esquecer: esquecer, situacao: situacao,
    ehSecao: function (secao) { return !!CATEGORIA[secao]; }
  };
})();
