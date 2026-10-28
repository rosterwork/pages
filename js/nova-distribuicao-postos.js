/* ============================================================
   NOVA DISTRIBUIÇÃO — bloco 1 (Postos)
   As instalações, uma por linha (o nome; a segunda do mesmo tipo
   com o número, "Central de Operações 2"), com Nova instalação
   pelo tipo; e as viaturas, uma por linha: Nº, prefixo (vale ao
   sair do campo; fora do formato fica só no campo, em vermelho),
   CNH de A a E alinhadas, setas, Substituir temporariamente, Fora
   de serviço e excluir. O posto gravado sai pela exclusão com data
   (a caixa); o novo, ainda não salvo, sai da lista na hora. Embaixo
   de cada posto, os erros, o que muda na mudança agendada e as
   mudanças com data (-caixas).
   ============================================================ */
(function () {
  'use strict';
  window.RosterWork = window.RosterWork || {};

  var TIPOS = ['Central de Operações', 'Rancho', 'Almoxarifado'];

  function M() { return RosterWork.mensagens.novaDistribuicao; }
  function P() { return RosterWork.novaDistribuicaoPecas; }
  function K() { return RosterWork.novaDistribuicaoCaixas; }

  /* o nome da instalação nova do tipo: o tipo, ou o tipo com o primeiro número livre (2, 3...) */
  function nomeNovo(tipo, nomes) {
    if (nomes.indexOf(tipo) < 0) return tipo;
    var n = 2;
    while (nomes.indexOf(tipo + ' ' + n) >= 0) n++;
    return tipo + ' ' + n;
  }

  /* as ações de um posto: Fora de serviço e excluir (o gravado abre a caixa da exclusão; o novo sai da lista);
     só no lado da unidade (os postos da companhia mudam na página da companhia) */
  function acoesPosto(linha, ctx, api, posto, marcas, tirar) {
    var gravado = !!posto.id && ctx.lado === 'unidade';
    var fora = linha.querySelector('.nova-distribuicao-fora');
    fora.disabled = ctx.soLeitura || !gravado;
    fora.addEventListener('click', function () { K().nova(api, 'fora', posto); });
    var remover = linha.querySelector('.nova-distribuicao-remover');
    remover.disabled = ctx.soLeitura || (!!posto.id && (!gravado || !!marcas.excluindo));
    if (marcas.excluindo) remover.setAttribute('data-dica', M().exclusaoMarcada);
    remover.addEventListener('click', function () {
      if (posto.id) K().nova(api, 'exclusao', posto);
      else tirar();
    });
  }

  function linhaInstalacao(lista, ctx, api, inst, i) {
    var linha = P().tpl('instalacao');
    linha.querySelector('.nova-distribuicao-instalacao-nome').textContent = inst.nome;
    var posto = { id: inst.id, nome: inst.nome, cnh: null };
    var subs = linha.querySelector('.nova-distribuicao-viatura-substituicoes');
    var marcas = posto.id && ctx.lado === 'unidade' ? K().listar(subs, api, ctx, posto, 0) : {};
    linha.classList.toggle('nova-distribuicao-viatura--substituindo', !!marcas.aberta);
    acoesPosto(linha, ctx, api, posto, marcas, function () {
      api.mudar(ctx.lado, function (x) { x.instalacoes.splice(i, 1); });
    });
    var extra = linha.querySelector('.nova-distribuicao-viatura-extra');
    P().erros(ctx, 'instalacao:' + i).forEach(function (e) { P().erroCampo(extra, e); });
    P().marcarMuda(extra, ctx, 'instalacao:' + inst.nome);
    extra.classList.toggle('oculto', !extra.children.length);
    subs.classList.toggle('oculto', !subs.children.length);
    lista.appendChild(linha);
  }

  function linhaViatura(lista, ctx, api, v, i, total) {
    var linha = P().tpl('viatura');
    var chave = ctx.lado + ':viatura:' + i;
    var digitado = api.invalido(chave);
    /* a viatura nova sem prefixo só acusa quando o campo fica vazio ao sair (ou no Salvar) */
    var erros = digitado != null ? [digitado ? M().prefixoInvalido : M().prefixoVazio] : (v.nome ? P().erros(ctx, 'viatura:' + i) : []);
    /* a falta da CNH é desta linha (com prefixo repetido, a outra viatura não acende) */
    var faltaCnh = !!v.nome && !v.cnh && P().pendente(ctx, 'carteira:' + v.nome);

    linha.querySelector('.nova-distribuicao-linha-ordem').textContent = (i + 1) + 'º';
    var inp = linha.querySelector('.nova-distribuicao-prefixo');
    inp.id = 'nova-distribuicao-prefixo-' + ctx.lado + '-' + i;
    inp.value = digitado != null ? digitado : v.nome;
    inp.disabled = ctx.soLeitura;
    inp.classList.toggle('nova-distribuicao-entrada--erro', erros.length > 0);
    inp.addEventListener('input', function () {
      var pos = inp.selectionStart;
      inp.value = inp.value.toUpperCase();
      try { inp.setSelectionRange(pos, pos); } catch (e) {}
    });
    inp.addEventListener('change', function () {
      var novo = inp.value.trim().toUpperCase();
      if (novo && novo === v.nome) { api.invalido(chave, null); api.redesenhar(); return; }
      if (!P().FORMATO_PREFIXO.test(novo)) { api.invalido(chave, inp.value.trim()); api.redesenhar(); return; }
      api.invalido(chave, null);
      api.renomear(ctx.lado, i, v.nome, novo);
    });
    /* saiu do campo vazio sem digitar: acusa só nesta linha, sem redesenhar (o clique que tirou o foco
       não se perde); o campo tirado da tela por um redesenho não acusa */
    inp.addEventListener('blur', function () {
      setTimeout(function () {
        if (!inp.isConnected || v.nome || inp.value.trim() || api.invalido(chave) != null) return;
        api.invalido(chave, '');
        inp.classList.add('nova-distribuicao-entrada--erro');
        P().erroCampo(extra, M().prefixoVazio);
        extra.classList.remove('oculto');
      }, 0);
    });

    var cnh = linha.querySelector('.nova-distribuicao-cnh');
    cnh.querySelectorAll('.aba').forEach(function (aba) {
      aba.classList.toggle('aba--ativa', aba.getAttribute('data-valor') === v.cnh);
      aba.disabled = ctx.soLeitura;
    });
    cnh.classList.toggle('nova-distribuicao-espaco--erro', faltaCnh);
    RosterWork.abas.ligar(cnh, function (aba) {
      var c = aba.getAttribute('data-valor');
      if (c !== v.cnh) api.mudar(ctx.lado, function (x) { x.viaturas[i].cnh = c; });
    });

    P().setas(linha, i, total, function (passo) {
      api.esquecerInvalidos(ctx.lado);
      api.mudar(ctx.lado, function (x) { P().mover(x.viaturas, i, passo); });
    }, ctx.soLeitura);

    /* as mudanças com data: só da viatura gravada (a nova espera o Salvar) */
    var posto = { id: v.id, nome: v.nome, cnh: v.cnh };
    var gravada = !!v.id && ctx.lado === 'unidade';
    var subs = linha.querySelector('.nova-distribuicao-viatura-substituicoes');
    var marcas = gravada ? K().listar(subs, api, ctx, posto, i + 1) : {};
    linha.classList.toggle('nova-distribuicao-viatura--substituindo', !!marcas.aberta);
    var trocar = linha.querySelector('.nova-distribuicao-trocar');
    trocar.disabled = ctx.soLeitura || !gravada || digitado != null || marcas.substituindo;
    if (marcas.substituindo) trocar.setAttribute('data-dica', P().texto(M().trocaUmaPorVez, { viatura: v.nome }));
    trocar.addEventListener('click', function () { K().nova(api, 'substituicao', posto); });
    acoesPosto(linha, ctx, api, posto, marcas, function () {
      api.esquecerInvalidos(ctx.lado);
      api.mudar(ctx.lado, function (x) { x.viaturas.splice(i, 1); });
    });

    var extra = linha.querySelector('.nova-distribuicao-viatura-extra');
    erros.forEach(function (e) { P().erroCampo(extra, e); });
    if (faltaCnh) P().erroCampo(extra, M().cnhEscolha);
    if (v.nome) P().marcarMuda(extra, ctx, 'viatura:' + v.nome);
    extra.classList.toggle('oculto', !extra.children.length);
    subs.classList.toggle('oculto', !subs.children.length);
    lista.appendChild(linha);
  }

  function postos(corpo, ctx, api) {
    var r = ctx.resp;
    var insts = r.instalacoes || [];
    var vtrs = r.viaturas || [];
    corpo.appendChild(P().tpl('nota-postos'));
    var u = P().unidade(corpo, ctx);

    P().fixo(u, ctx.ehCia ? M().instalacoesCompanhia : M().instalacoesPelotao, function (lugar) {
      var tabela = P().tpl('instalacoes');
      var lista = tabela.querySelector('.nova-distribuicao-viaturas-lista');
      if (!insts.length) P().respostas(lista, [M().nenhuma]);
      insts.forEach(function (inst, i) { linhaInstalacao(lista, ctx, api, inst, i); });
      lugar.appendChild(tabela);
      /* Nova instalação: o botão abre o menu dos tipos */
      var nova = P().tpl('nova-instalacao');
      nova.querySelector('.botao').disabled = ctx.soLeitura;
      var nomes = insts.map(function (o) { return o.nome; });
      nova.querySelectorAll('.dropdown-item[data-valor]').forEach(function (item) {
        item.addEventListener('click', function () {
          var nome = nomeNovo(item.getAttribute('data-valor'), nomes);
          api.mudar(ctx.lado, function (x) {
            x.instalacoes.push({ nome: nome, efetivo: [null, null, null] });
            x.instalacoes.sort(function (a, b) {
              var ta = TIPOS.indexOf(a.nome.replace(/ \d+$/, '')), tb = TIPOS.indexOf(b.nome.replace(/ \d+$/, ''));
              return ta - tb || (Number((a.nome.match(/ (\d+)$/) || [0, 1])[1]) - Number((b.nome.match(/ (\d+)$/) || [0, 1])[1]));
            });
          });
        });
      });
      lugar.appendChild(nova);
    }, ctx, 'instalacoes');

    P().fixo(u, ctx.ehCia ? M().viaturasCompanhia : M().viaturasPelotao, function (lugar) {
      lugar.appendChild(P().tpl('nota-viaturas'));
      var tabela = P().tpl('viaturas');
      var lista = tabela.querySelector('.nova-distribuicao-viaturas-lista');
      tabela.querySelector('.nova-distribuicao-viaturas-cabecalho').classList.toggle('oculto', !vtrs.length);
      if (!vtrs.length) P().respostas(lista, [M().nenhuma]);
      vtrs.forEach(function (v, i) { linhaViatura(lista, ctx, api, v, i, vtrs.length); });
      lugar.appendChild(tabela);
      var nova = P().tpl('nova-viatura');
      nova.disabled = ctx.soLeitura;
      nova.addEventListener('click', function () {
        api.focarDepois('#nova-distribuicao-prefixo-' + ctx.lado + '-' + vtrs.length);
        api.mudar(ctx.lado, function (x) { x.viaturas.push({ nome: '', cnh: null, efetivo: [null, null, null] }); });
      });
      lugar.appendChild(nova);
    }, ctx, 'viaturas');
  }

  window.RosterWork.novaDistribuicaoPostos = {
    postos: postos,
    /* as viaturas ainda sem prefixo da unidade e da companhia, na chave dos digitados ('lado:viatura:i') */
    semPrefixo: function (resp, respCia) {
      return [['unidade', resp], ['companhia', respCia]].reduce(function (lista, par) {
        return lista.concat(((par[1] && par[1].viaturas) || []).map(function (v, i) { return v.nome ? null : par[0] + ':viatura:' + i; }));
      }, []).filter(Boolean);
    }
  };
})();
