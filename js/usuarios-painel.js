/* ============================================================
   USUÁRIOS — painel lateral com a ficha do militar
   Abre ao clicar num card. Título = graduação + nome de guerra;
   subtítulo = nome completo. Sub-cabeçalho com as abas Dados e
   Carreira; abas Ver/Editar no topo (Editar só admin). Busca a
   ficha pela RPC buscar_ficha_militar. No Editar da Carreira, o
   admin pode dar baixa do militar (confirmação + RPC
   dar_baixa_militar). As peças (seção colapsável, linha, estado)
   vêm de geral-painel.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  var fichaAtual = null;      // ficha carregada (redesenha ao trocar de aba/modo)
  var pessoaAtual = null;     // pessoa do card (título, CPF na baixa)
  var aoFecharPagina = null;  // callback da página (limpa o realce do card)
  var secaoAtual = 'dados';   // aba ativa do sub-cabeçalho

  /* ---------- formatação (só exibição) ---------- */

  function soDigitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  /* 11 dígitos -> XXX.XXX.XXX-XX */
  function formatarCpf(cpf) {
    var n = soDigitos(cpf);
    if (n.length !== 11) return cpf || '';
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /* 9 dígitos -> XX.XXX.XXX-X (8 dígitos fica como veio) */
  function formatarRg(rg) {
    var n = soDigitos(rg);
    if (n.length === 9) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, '$1.$2.$3-$4');
    return rg || '';
  }

  /* 11 dígitos -> (XX) XXXXX-XXXX */
  function formatarCelular(cel) {
    var n = soDigitos(cel);
    if (n.length !== 11) return cel || '';
    return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  /* ISO (AAAA-MM-DD) -> DD/MM/AAAA */
  function formatarData(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  /* "0014" -> "14" (tira os zeros à esquerda da colocação) */
  function formatarColocacao(valor) {
    var n = parseInt(soDigitos(valor), 10);
    return isNaN(n) ? '' : String(n);
  }

  /* data de hoje em DD/MM/AAAA (padrão dos campos "A partir de") */
  function hojeBR() {
    var d = new Date();
    var dia = ('0' + d.getDate()).slice(-2), mes = ('0' + (d.getMonth() + 1)).slice(-2);
    return dia + '/' + mes + '/' + d.getFullYear();
  }

  /* militar veio da lista de inativos (o card carrega situacao='Inativo') */
  function ehInativo() { return !!(pessoaAtual && pessoaAtual.situacao === 'Inativo'); }

  /* "Ativo" | "Inativo desde DD/MM/AAAA" | "Férias até DD/MM/AAAA" */
  function textoSituacao(ins) {
    if (ehInativo()) {
      return pessoaAtual && pessoaAtual.situacao_ate
        ? 'Inativo desde ' + formatarData(pessoaAtual.situacao_ate) : 'Inativo';
    }
    if (ins && ins.situacao === 'Férias') return 'Férias até ' + formatarData(ins.situacao_ate);
    return 'Ativo';
  }

  /* "1ºPEL — Curitiba" (cidade ao lado, quando houver) */
  function textoLotacao(ins) {
    var nome = (ins && ins.lotacao_nome) || '';
    var cidade = (ins && ins.lotacao_cidade) || '';
    return cidade ? nome + ' - ' + cidade : nome;
  }

  /* ---------- seções ---------- */

  /* uma seção colapsável com linhas rótulo/valor (vazio vira "-") */
  function montarSecao(corpo, titulo, linhas, aberta) {
    var secao = RosterWork.painel.criarSecaoColapsavel(titulo, { aberta: aberta });
    if (!secao) return;
    var alvo = secao.querySelector('.painel-secao-corpo');
    linhas.forEach(function (l) {
      var valor = (l.valor == null || l.valor === '') ? '-' : l.valor;
      var linha = RosterWork.painel.criarLinha(l.rotulo, valor);
      if (linha) alvo.appendChild(linha);
    });
    corpo.appendChild(secao);
  }

  /* aba Dados (Ver): só os dados pessoais */
  function montarDados(corpo) {
    var p = (fichaAtual && fichaAtual.pessoais) || {};
    montarSecao(corpo, 'Dados pessoais', [
      { rotulo: 'Nome completo', valor: p.nome_completo },
      { rotulo: 'CPF', valor: formatarCpf(p.cpf) },
      { rotulo: 'RG', valor: formatarRg(p.rg) },
      { rotulo: 'Idade', valor: (p.idade != null ? p.idade + ' anos' : '') },
      { rotulo: 'Nascimento', valor: formatarData(p.data_de_nascimento) },
      { rotulo: 'CNH', valor: p.cnh },
      { rotulo: 'Celular', valor: formatarCelular(p.celular) },
      { rotulo: 'Email', valor: p.email }
    ], true);
  }

  /* seção "Dados institucionais" (Ver) — agora na aba Carreira */
  function montarInstitucionais(corpo) {
    var ins = (fichaAtual && fichaAtual.institucionais) || {};
    montarSecao(corpo, 'Dados institucionais', [
      { rotulo: 'Posto', valor: ins.grau_nome },
      { rotulo: 'Nome de guerra', valor: ins.nome_de_guerra },
      { rotulo: 'Setor', valor: ins.tipo },
      { rotulo: 'Inclusão', valor: formatarData(ins.data_de_inclusao) },
      { rotulo: RosterWork.campos.nomeColocacao(ins.quadro), valor: formatarColocacao(ins.classificacao) },
      { rotulo: 'Antiguidade no sistema', valor: ins.antiguidade_sistema },
      { rotulo: 'Lotação', valor: textoLotacao(ins) },
      { rotulo: 'Situação', valor: textoSituacao(ins) }
    ], true);
  }

  /* aba Carreira (Ver): institucionais + histórico de promoções e transferências */
  function montarCarreira(corpo) {
    montarInstitucionais(corpo);
    var promocoes = (fichaAtual && fichaAtual.promocoes) || [];
    var transferencias = (fichaAtual && fichaAtual.transferencias) || [];
    if (promocoes.length) {
      var linhasP = promocoes.map(function (pr) {
        return { rotulo: pr.grau_nome || pr.grau || '', valor: formatarData(pr.data) };
      });
      montarSecao(corpo, 'Promoções', linhasP, false);
    }
    if (transferencias.length) {
      var linhasT = transferencias.map(function (t) {
        return { rotulo: (t.origem || '?') + ' para ' + (t.destino || '?'), valor: formatarData(t.data) };
      });
      montarSecao(corpo, 'Transferências', linhasT, false);
    }
  }

  /* após promover/transferir: volta ao Ver e recarrega a ficha (grau/lotação/
     histórico mudaram) e a lista de cards (a árvore lê buscar_efetivo, com cache) */
  function aoConcluirCarreira() {
    voltarParaVer();
    if (pessoaAtual) carregarFicha(pessoaAtual.usuario_id);
    if (RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.recarregar) RosterWork.arvoreUnidades.recarregar();
  }

  /* seção "Dar baixa do sistema" — grudada no rodapé, começa fechada */
  var vigenciaEl = null;   /* campo "A partir de" da baixa/readmissão (data escolhida) */

  /* campo de data "A partir de" (padrão hoje, máscara + calendário) no corpo da seção */
  function montarCampoData(corpo) {
    var campo = RosterWork.tpl('tpl-usuarios-data-vigencia');
    if (!campo) return null;
    var input = campo.querySelector('[data-vigencia-data]');
    if (input && RosterWork.campos) {
      RosterWork.campos.ligarMascara(input, RosterWork.campos.mascararData);
      RosterWork.campos.ligarCalendario(input);
      input.value = hojeBR();
    }
    corpo.appendChild(campo);
    return input;
  }

  /* valida o campo "A partir de": devolve o ISO ou null (marca o erro no campo) */
  function dataVigenciaIso() {
    var V = RosterWork.validacoes;
    if (!vigenciaEl || !V) return null;
    var campo = vigenciaEl.closest('.campo');
    var erroEl = campo && campo.querySelector('.campo-erro-texto');
    function erro(m) { if (campo) campo.classList.add('campo--erro'); if (erroEl) erroEl.textContent = m; }
    if (campo) campo.classList.remove('campo--erro');
    var dt = V.parseData(vigenciaEl.value);
    if (!dt) { erro(RosterWork.mensagens.cadastro.dataInvalida); return null; }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    if (dt > hoje) { erro(RosterWork.mensagens.usuarios.dataFutura); return null; }
    return V.paraISO(vigenciaEl.value);
  }

  function montarBaixa(corpo) {
    var secao = RosterWork.painel.criarSecaoColapsavel('Dar baixa do sistema', { aberta: false });
    if (!secao) return;
    secao.classList.add('painel-secao--rodape');
    var alvo = secao.querySelector('.painel-secao-corpo');
    vigenciaEl = montarCampoData(alvo);
    var btn = RosterWork.tpl('tpl-usuarios-baixa-botao');
    if (btn) {
      btn.addEventListener('click', confirmarBaixa);
      alvo.appendChild(btn);
    }
    corpo.appendChild(secao);
  }

  /* seção Readmitir (aba Carreira, modo Editar do admin, militar inativo) */
  function montarReadmitir(corpo) {
    var secao = RosterWork.painel.criarSecaoColapsavel('Readmitir ao efetivo', { aberta: true });
    if (!secao) return;
    secao.classList.add('painel-secao--rodape');
    var alvo = secao.querySelector('.painel-secao-corpo');
    vigenciaEl = montarCampoData(alvo);
    var btn = RosterWork.tpl('tpl-usuarios-readmitir-botao');
    if (btn) {
      btn.addEventListener('click', confirmarReadmissao);
      alvo.appendChild(btn);
    }
    corpo.appendChild(secao);
  }

  function confirmarReadmissao() {
    if (!pessoaAtual || !RosterWork.confirmar) return;
    var ins = (fichaAtual && fichaAtual.institucionais) || {};
    var p = (fichaAtual && fichaAtual.pessoais) || {};
    var pessoa = ((ins.grau_nome || pessoaAtual.grau_nome || '') + ' ' +
                  (p.nome_completo || pessoaAtual.nome_completo || '')).trim();
    var dataIso = dataVigenciaIso();
    if (!dataIso) return;   /* data inválida/futura: o campo já mostra o erro */
    var msg = RosterWork.mensagens.usuarios.confirmarReadmissao.replace('{pessoa}', pessoa);
    RosterWork.confirmar({
      tipo: 'aviso',
      mensagem: msg,
      textoConfirmar: RosterWork.mensagens.botoes.readmitir,
      textoCancelar: RosterWork.mensagens.botoes.cancelar,
      aoConfirmar: function () { readmitir(dataIso); }
    });
  }

  function readmitir(dataIso) {
    if (!pessoaAtual) return;
    RosterWork.apiFetch('/rest/v1/rpc/readmitir_militar', {
      metodo: 'POST',
      corpo: { p_admin_cpf: RosterWork.sessao.cpf(), p_cpf: pessoaAtual.usuario_id, p_data: dataIso }
    })
      .then(function (resp) { return resp.ok ? resp.json() : { _falha: 'servidor' }; })
      .then(function (r) {
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          RosterWork.painel.fechar();
          if (RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.recarregar) RosterWork.arvoreUnidades.recarregar();
          if (RosterWork.paginas && RosterWork.paginas.usuarios && RosterWork.paginas.usuarios.recarregarInativos) RosterWork.paginas.usuarios.recarregarInativos();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Usuários' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaReadmissao });
        }
      })
      .catch(function () {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* modal de confirmação da baixa (texto com o nome e o CPF) */
  function confirmarBaixa() {
    if (!fichaAtual || !pessoaAtual || !RosterWork.confirmar) return;
    var ins = fichaAtual.institucionais || {};
    var p = fichaAtual.pessoais || {};
    var pessoa = ((ins.grau_nome || pessoaAtual.grau_nome || '') + ' ' +
                  (p.nome_completo || pessoaAtual.nome_completo || '')).trim();
    var cpf = formatarCpf(pessoaAtual.usuario_id);
    var dataIso = dataVigenciaIso();
    if (!dataIso) return;   /* data inválida/futura: o campo já mostra o erro */
    var msgBase = RosterWork.mensagens.usuarios.confirmarBaixa
      .replace('{pessoa}', pessoa).replace('{cpf}', cpf);
    /* avisa também das trocas/folgas que a baixa vai cancelar (best-effort: se falhar, aviso simples) */
    RosterWork.apiFetch('/rest/v1/rpc/escala_ciclo_retirar_analisar', {
      metodo: 'POST',
      corpo: { p_admin_cpf: RosterWork.sessao.cpf(), p_unidade_id: Number(ins.lotacao_id) || null, p_cpf: pessoaAtual.usuario_id, p_data: dataIso }
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (a) {
        var pend = (a && a.success && a.pendencias) || null;
        var msg = msgBase + (RosterWork.textoImpactoSaida ? RosterWork.textoImpactoSaida(pend) : '');
        RosterWork.confirmar({
          tipo: 'erro',
          mensagem: msg,
          textoConfirmar: RosterWork.mensagens.botoes.excluir,
          textoCancelar: RosterWork.mensagens.botoes.cancelar,
          confirmarPerigo: true,
          aoConfirmar: function () { darBaixa(dataIso); }
        });
      });
  }

  function darBaixa(dataIso) {
    if (!pessoaAtual) return;
    RosterWork.apiFetch('/rest/v1/rpc/dar_baixa_militar', {
      metodo: 'POST',
      corpo: { p_cpf: pessoaAtual.usuario_id, p_admin_cpf: RosterWork.sessao.cpf(), p_data: dataIso }
    })
      .then(function (resp) {
        if (!resp.ok) return { _falha: 'servidor' };   // servidor/sessão (o 401 já é tratado no apiFetch)
        return resp.json();
      })
      .then(function (r) {
        if (r && r._falha === 'servidor') {
          if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.falhaServidor });
        } else if (r && r.success) {
          RosterWork.painel.fechar();
          if (RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.recarregar) RosterWork.arvoreUnidades.recarregar();
          /* com o filtro Inativos ativo, o recém-baixado passa a aparecer na lista de inativos (espelha o Readmitir) */
          if (RosterWork.paginas && RosterWork.paginas.usuarios && RosterWork.paginas.usuarios.recarregarInativos) RosterWork.paginas.usuarios.recarregarInativos();
          if (r.log && RosterWork.resumo) RosterWork.resumo.abrirModal(r.log, { pagina: 'Usuários' });
        } else if (RosterWork.avisar) {
          RosterWork.avisar({ tipo: 'erro', mensagem: (r && r.error) || RosterWork.mensagens.usuarios.falhaBaixa });
        }
      })
      .catch(function () {
        if (RosterWork.avisar) RosterWork.avisar({ tipo: 'erro', mensagem: RosterWork.mensagens.geral.semConexao });
      });
  }

  /* ---------- estados do corpo ---------- */

  function mostrarErro(corpo) {
    corpo.textContent = '';
    var estado = RosterWork.painel.criarEstado(RosterWork.mensagens.usuarios.falhaFicha);
    if (estado) corpo.appendChild(estado);
  }

  function mostrarCarregando(corpo) {
    var estado = RosterWork.painel.criarCarregando();
    if (estado) corpo.appendChild(estado);
  }

  /* ---------- abas e modo ---------- */

  /* volta para o modo Ver (clica na aba Ver do topo) */
  function voltarParaVer() {
    var abas = document.getElementById('painel-abas');
    var ver = abas ? abas.querySelector('[data-painel-modo="ver"]') : null;
    if (ver) ver.click();
  }

  /* após salvar a edição: volta para Ver e recarrega os dados atualizados */
  function aoSalvarDados() {
    voltarParaVer();
    if (pessoaAtual) carregarFicha(pessoaAtual.usuario_id);
    /* o card na lista mostra grau/nome de guerra/colocação/RG/celular/email — recarrega p/ refletir a edição */
    if (RosterWork.arvoreUnidades && RosterWork.arvoreUnidades.recarregar) RosterWork.arvoreUnidades.recarregar();
  }

  /* desenha o corpo conforme a aba ativa e o modo Ver/Editar */
  /* observação no topo da ficha quando o militar não tem conta de login (item 8) */
  function montarSemConta(corpo) {
    if (!fichaAtual || fichaAtual.tem_conta !== false) return;
    var tpl = document.getElementById('tpl-usuarios-sem-conta');
    if (tpl) corpo.appendChild(tpl.content.cloneNode(true));
  }

  function mostrarSecao() {
    var corpo = RosterWork.painel.corpo();
    if (!corpo || !fichaAtual) return;
    var editar = RosterWork.painel.modo() === 'editar';
    var rodape = RosterWork.painel.rodape();
    if (rodape) { rodape.textContent = ''; rodape.classList.add('oculto'); }
    if (RosterWork.usuariosPainelEditar) RosterWork.usuariosPainelEditar.reset();
    if (RosterWork.usuariosPainelTransferir) RosterWork.usuariosPainelTransferir.reset();
    if (RosterWork.usuariosPainelPromover) RosterWork.usuariosPainelPromover.reset();
    corpo.textContent = '';
    montarSemConta(corpo);

    var admin = editar && RosterWork.sessao.ehAdmin();
    if (secaoAtual === 'carreira') {
      if (admin && ehInativo()) {
        /* inativo: a Carreira/Editar mostra os institucionais (Ver) + a ação Readmitir
           (Promover/Transferir/Baixa não se aplicam a quem está fora do efetivo) */
        montarInstitucionais(corpo);
        montarReadmitir(corpo);
      } else if (admin && RosterWork.usuariosPainelEditar) {
        /* Editar: campos institucionais + as ações (Promover, Transferir, Dar baixa) */
        RosterWork.usuariosPainelEditar.montar(corpo, fichaAtual, pessoaAtual, { aoSalvar: aoSalvarDados, aoVoltar: voltarParaVer }, 'institucionais');
        if (RosterWork.usuariosPainelPromover) RosterWork.usuariosPainelPromover.montar(corpo, fichaAtual, pessoaAtual, { aoConcluir: aoConcluirCarreira });
        if (RosterWork.usuariosPainelTransferir) RosterWork.usuariosPainelTransferir.montar(corpo, fichaAtual, pessoaAtual, { aoConcluir: aoConcluirCarreira });
        montarBaixa(corpo);
      } else {
        montarCarreira(corpo);
      }
    } else {
      if (admin && RosterWork.usuariosPainelEditar) {
        RosterWork.usuariosPainelEditar.montar(corpo, fichaAtual, pessoaAtual, { aoSalvar: aoSalvarDados, aoVoltar: voltarParaVer }, 'pessoais');
      } else {
        montarDados(corpo);
      }
    }
  }

  function aoMudarModo() { mostrarSecao(); }

  /* sub-cabeçalho: abas Dados / Carreira */
  function montarAbas() {
    var sub = RosterWork.painel.subcabecalho();
    var tpl = document.getElementById('tpl-usuarios-painel-secoes');
    if (!sub || !tpl) return;
    sub.appendChild(tpl.content.cloneNode(true));
    sub.classList.remove('oculto');
    var trilho = sub.querySelector('.abas');
    if (trilho && RosterWork.abas) {
      RosterWork.abas.ligar(trilho, function (aba) {
        secaoAtual = aba.getAttribute('data-secao') || 'dados';
        mostrarSecao();
      });
    }
  }

  /* título/subtítulo a partir da ficha carregada (refletem promoção/edição do nome) */
  function atualizarTitulo() {
    if (!fichaAtual || !RosterWork.painel.definirTitulos) return;
    var ins = fichaAtual.institucionais || {};
    var p = fichaAtual.pessoais || {};
    var grad = ins.grau_abreviacao || (pessoaAtual && pessoaAtual.grau_abreviacao) || '';
    var guerra = ins.nome_de_guerra || (pessoaAtual && pessoaAtual.nome_de_guerra) || '';
    RosterWork.painel.definirTitulos((grad + ' ' + guerra).trim(), p.nome_completo || '');
  }

  function carregarFicha(usuarioId) {
    var corpo = RosterWork.painel.corpo();
    if (!corpo) return;
    corpo.textContent = '';
    mostrarCarregando(corpo);
    RosterWork.apiFetch('/rest/v1/rpc/buscar_ficha_militar', {
      metodo: 'POST',
      corpo: { p_usuario_id: usuarioId }
    })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (ficha) {
        if (!RosterWork.painel.estaAberto()) return;
        if (!ficha) { var a = RosterWork.painel.corpo(); if (a) mostrarErro(a); return; }
        fichaAtual = ficha;
        atualizarTitulo();
        mostrarSecao();
      })
      .catch(function () {
        if (!RosterWork.painel.estaAberto()) return;
        var a = RosterWork.painel.corpo(); if (a) mostrarErro(a);
      });
  }

  /* a gaveta foi fechada: zera o estado e avisa a página (limpa o realce) */
  function aoFecharGaveta() {
    if (RosterWork.usuariosPainelEditar) RosterWork.usuariosPainelEditar.reset();
    if (RosterWork.usuariosPainelTransferir) RosterWork.usuariosPainelTransferir.reset();
    if (RosterWork.usuariosPainelPromover) RosterWork.usuariosPainelPromover.reset();
    fichaAtual = null;
    pessoaAtual = null;
    var cb = aoFecharPagina;
    aoFecharPagina = null;
    if (cb) cb();
  }

  /* abre a gaveta para a pessoa clicada. aoFechar = callback da página */
  function abrir(pessoa, aoFechar) {
    if (!RosterWork.painel || !pessoa) return;
    fichaAtual = null;
    pessoaAtual = pessoa;
    aoFecharPagina = aoFechar || null;
    secaoAtual = 'dados';
    var grad = pessoa.grau_abreviacao || '';
    var guerra = pessoa.nome_de_guerra || '';
    RosterWork.painel.abrir({
      titulo: (grad + ' ' + guerra).trim(),
      subtitulo: pessoa.nome_completo || '',
      editavel: RosterWork.sessao.ehAdmin(),
      aoMudarModo: aoMudarModo,
      aoFechar: aoFecharGaveta
    });
    montarAbas();
    carregarFicha(pessoa.usuario_id);
  }

  window.RosterWork.usuariosPainel = { abrir: abrir };
})();
