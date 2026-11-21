/* ============================================================
   AFASTAMENTOS — o painel do militar
   (RosterWork.afastamentosPainel)
   Abre pelo clique no militar (a grade, a lista do celular, o nome
   no calendário de quem não administra, o Abrir o painel da caixa):
   no título, o posto e o nome, com a unidade ao lado, e o nome
   completo embaixo. O ano no subcabeçalho do painel (o mesmo seletor
   da página), o Resumo do ano (os dias de cada nome e o total) e os
   afastamentos que tocam o ano. Quem administra o militar (ativo)
   edita aqui: uma caixa por afastamento, com a situação (Em curso,
   Marcado, Encerrado ou Novo afastamento), a lixeira e os campos
   (afastamentos-campos.js), e o Adicionar afastamento no fim; as
   respostas entram no mesmo rascunho das abas (o rodapé largo da
   página salva). Quem só lê vê um afastamento por linha. O bloco e a
   linha de leitura são os da ficha de Usuários
   (usuarios-painel-leitura.js). Lê tudo do militar uma vez (todos os
   anos) e guarda enquanto o painel está aberto; gravar esquece o que
   foi lido.
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  var ano = null;       // o ano do painel (abre no da página)
  var cpfLido = null;   // de quem já foi lido (todos os anos)
  var atual = null;     // o painel desenhado agora: { corpo, ctx, caixas, resumo }
  var token = 0;        // latest-wins: a resposta de outro militar é ignorada

  function M() { return RW.mensagens.afastamentos; }
  function R() { return RW.afastamentosRascunho; }
  function G() { return RW.afastamentosGrade; }
  function P() { return RW.afastamentosPeriodo; }

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

  /* os afastamentos do militar que tocam o ano (e os novos ainda sem data) */
  function doAno(cpf) {
    var ini = ano + '-01-01', fim = ano + '-12-31';
    return R().lista(cpf).filter(function (af) {
      if (af.novo && (!af.inicio || !af.fim)) return true;
      return af.inicio && af.fim && af.inicio <= fim && af.fim >= ini;
    });
  }

  /* o Resumo do ano: os dias de cada nome e o total (só os que já têm as datas; sem a Autorização de viagem, que não é
     afastamento) */
  function montarResumo(cpf) {
    var L = RW.usuariosPainelLeitura;
    var comDatas = doAno(cpf).filter(function (af) { return af.inicio && af.fim && af.fim >= af.inicio && G().afastado(af); });
    if (!comDatas.length) return null;
    var b = L.bloco(M().resumo(ano), null, null);
    if (!b) return null;
    var porNome = {}, ordem = [];
    comDatas.forEach(function (af) {
      if (!(af.nome in porNome)) { porNome[af.nome] = 0; ordem.push(af.nome); }
      porNome[af.nome] += G().diasNoAno([af], ano);
    });
    ordem.forEach(function (nome) { L.linha(b, nome, M().dias(porNome[nome])); });
    L.linha(b, M().noAno, M().dias(G().diasNoAno(comDatas, ano)));
    return b;
  }
  function pintarResumo() {
    var a = atual;
    if (!a) return;
    var novo = montarResumo(String(a.ctx.pessoa.usuario_id));
    if (a.resumo && novo) a.resumo.replaceWith(novo);
    else if (a.resumo) a.resumo.remove();
    else if (novo) a.corpo.prepend(novo);
    a.resumo = novo;
  }

  /* o afastamento gravado que começou antes do limite (hoje − 7) não sai */
  function comecouAntes(af) {
    var g = af.id ? R().gravado(af.cpf, af.id) : null;
    return !!(g && g.inicio < R().isoLimite());
  }

  /* quem administra: uma caixa por afastamento, com os campos, e o Adicionar */
  function montarCaixas(a, cpf, afs) {
    afs.forEach(function (af) {
      var caixa = RW.tpl('tpl-ficha-afastamento');
      if (!caixa) return;
      caixa.querySelector('[data-af-situacao]').textContent = af.novo ? M().novo : situacao(af.inicio, af.fim);
      if (af.mudou) caixa.classList.add('ficha-periodo--mudou');
      var lixeira = caixa.querySelector('[data-af-remover]');
      if (!comecouAntes(af)) {
        lixeira.classList.remove('oculto');
        lixeira.addEventListener('click', function () { R().remover(cpf, af.chave, null); });
      }
      var campos = RW.afastamentosCampos.montar(caixa.querySelector('[data-af-campos]'),
        { cpf: cpf, chave: af.chave, origem: 'ficha' });
      if (campos) a.caixas.push(campos);
      a.corpo.appendChild(caixa);
    });
    var adicionar = RW.tpl('tpl-ficha-afastamento-adicionar');
    if (!adicionar) return;
    adicionar.querySelector('[data-af-adicionar]').addEventListener('click', function () {
      var chave = R().criar(cpf);
      desenhar();
      var nova = a.corpo.querySelectorAll('.ficha-periodo');
      var ultima = nova.length ? nova[nova.length - 1] : null;
      var campo = ultima ? ultima.querySelector('button:not([disabled]), input:not([disabled])') : null;
      if (campo && chave) campo.focus();
    });
    a.corpo.appendChild(adicionar);
  }

  /* quem só lê: um afastamento por linha (a situação; o nome e as datas; os dias e se sai da guarnição) */
  function montarLeitura(a, afs) {
    var L = RW.usuariosPainelLeitura;
    var b = L.bloco(M().doAno(ano), null, null);
    if (!b) return;
    afs.forEach(function (af) {
      var extra = M().dias(RW.afastamentosCampos.dias(af)) + (af.gua ? ' · ' + M().extraFora : '');
      L.linha(b, situacao(af.inicio, af.fim), af.nome + ' · ' + G().textoDatas(af.inicio, af.fim, ano), extra);
    });
    a.corpo.appendChild(b);
  }

  function desenhar() {
    var a = atual;
    if (!a) return;
    var cpf = String(a.ctx.pessoa.usuario_id);
    var afs = doAno(cpf);
    a.corpo.textContent = '';
    a.caixas = [];
    a.resumo = montarResumo(cpf);
    if (a.resumo) a.corpo.appendChild(a.resumo);
    if (!afs.length && !a.ctx.admin) {
      var estado = RW.painel.criarEstado(M().vazioAno(ano));
      if (estado) a.corpo.appendChild(estado);
    }
    if (a.ctx.admin) montarCaixas(a, cpf, afs);
    else if (afs.length) montarLeitura(a, afs);
  }

  /* o rascunho mudou: o que o painel mesmo respondeu só atualiza o que se vê (sem perder o campo que se digita); o
     resto redesenha; gravou: relê */
  function aoMudarRascunho(origem) {
    var a = atual;
    if (!a) return;
    if (origem === 'gravou') { esquecer(true); return; }
    if (origem === 'ficha') {
      a.caixas.forEach(function (c) { c.pintar(); });
      pintarResumo();
      return;
    }
    desenhar();
  }

  /* o ano no subcabeçalho do painel; trocar de ano redesenha (sem reler) */
  function montarAno(barra) {
    if (!barra) return;
    barra.textContent = '';
    var s = P().seletorAno(ano, function (novo) { ano = novo; desenhar(); });
    if (!s) return;
    barra.appendChild(s.el);
    barra.classList.remove('oculto');
  }

  function ler(cpf) {
    var a = atual;
    a.corpo.textContent = '';
    var carregando = RW.painel.criarCarregando();
    if (carregando) a.corpo.appendChild(carregando);
    var meu = ++token;
    RW.painel.segurar(RW.afastamentosDados.listarAno(null, cpf)).then(function (lista) {
      if (meu !== token || atual !== a) return;
      if (lista == null) {
        a.corpo.textContent = '';
        var erro = RW.painel.criarEstado(M().falhaCarregar);
        if (erro) a.corpo.appendChild(erro);
        return;
      }
      R().conhecer(lista);
      cpfLido = cpf;
      desenhar();
    });
  }

  /* desenha o painel. ctx = { pessoa, anoInicial, admin (pode mudar: administra o militar ativo) } */
  function montar(corpo, barra, ctx) {
    if (!corpo || !ctx || !ctx.pessoa) return;
    var cpf = String(ctx.pessoa.usuario_id);
    if (ano == null) ano = ctx.anoInicial || P().anoAtual();
    atual = { corpo: corpo, ctx: ctx, caixas: [], resumo: null };
    R().ouvir('ficha', aoMudarRascunho);
    montarAno(barra);
    if (cpfLido === cpf) desenhar();
    else ler(cpf);
  }

  /* o painel fechou ou mudou de militar: os novos em branco saem e respostas atrasadas não desenham */
  function reset() {
    if (atual) {
      var cpf = String(atual.ctx.pessoa.usuario_id);
      R().lista(cpf).forEach(function (af) { if (af.novo) R().largar(cpf, af.chave); });
    }
    atual = null;
    token++;
  }

  /* outro militar (sem o ano) ou depois de gravar (mantém o ano e relê o painel aberto) */
  function esquecer(manterAno) {
    var a = atual;
    cpfLido = null;
    if (!manterAno) ano = null;
    if (a && manterAno) { ler(String(a.ctx.pessoa.usuario_id)); return; }
    reset();
  }

  /* abre o painel do militar. opcoes = { ano (o da página), sigla (a unidade, ao lado do nome), aoFechar() (a página
     tira o realce da linha) } */
  function abrir(pessoa, opcoes) {
    if (!RW.painel || !pessoa) return;
    opcoes = opcoes || {};
    esquecer();
    var titulo = ((pessoa.grau_abreviacao || '') + ' ' + (pessoa.nome_de_guerra || '')).trim();
    RW.painel.abrir({
      titulo: titulo, tituloExtra: opcoes.sigla ? '- ' + opcoes.sigla : '', subtitulo: pessoa.nome_completo || '',
      aoFechar: function () {
        esquecer();
        if (opcoes.aoFechar) opcoes.aoFechar();
      }
    });
    var admin = pessoa.situacao !== 'Inativo' && RW.sessao.podeAdministrar('pelotao', pessoa.lotacao_atual);
    montar(RW.painel.corpo(), RW.painel.subcabecalho(), { pessoa: pessoa, anoInicial: opcoes.ano || null, admin: admin });
  }

  window.RosterWork.afastamentosPainel = { abrir: abrir, esquecer: esquecer, situacao: situacao };
})();
