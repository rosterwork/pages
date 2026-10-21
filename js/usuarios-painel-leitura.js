/* ============================================================
   USUÁRIOS — a ficha em leitura (os blocos do painel)
   Blocos cinza com as linhas rótulo · valor, no padrão do painel
   da Escala: aba Dados (Dados pessoais) e aba Carreira (Dados
   institucionais, Administração quando o militar tem papel e
   Transferências; as datas de promoção vêm do
   usuarios-painel-datas.js). O lápis do bloco aparece quando a
   página passa a ação de corrigir (só admin). Expõe também as
   peças (bloco, bloco que recolhe, linha) para as sub-telas.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* ---------- formatação (só exibição) ---------- */

  function soDigitos(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

  /* 11 dígitos -> XXX.XXX.XXX-XX */
  function formatarCpf(cpf) {
    var n = soDigitos(cpf);
    if (n.length !== 11) return cpf || '';
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /* 11 dígitos -> (XX) XXXXX-XXXX */
  function formatarCelular(cel) {
    var n = soDigitos(cel);
    if (n.length !== 11) return cel || '';
    return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  function formatarData(iso) { return RosterWork.data.isoParaBR(iso); }

  /* "0014" -> "14"; "0000" = sem colocação (a linha mostra "-") */
  function formatarColocacao(valor) {
    var n = parseInt(soDigitos(valor), 10);
    return (isNaN(n) || n === 0) ? '' : String(n);
  }

  /* "Ativo" | "Inativo desde DD/MM/AAAA" | "Férias/Licença/Dispensa até DD/MM/AAAA" */
  function textoSituacao(ins, pessoa) {
    if (pessoa && pessoa.situacao === 'Inativo') {
      return pessoa.situacao_ate ? 'Inativo desde ' + formatarData(pessoa.situacao_ate) : 'Inativo';
    }
    if (ins && (ins.situacao === 'Férias' || ins.situacao === 'Licença' || ins.situacao === 'Dispensa')) {
      return ins.situacao + ' até ' + formatarData(ins.situacao_ate);
    }
    return 'Ativo';
  }

  /* ---------- as peças ---------- */

  /* um bloco com o título; aoCorrigir (opcional) mostra o lápis, com o nome para o leitor de tela */
  function bloco(titulo, rotuloLapis, aoCorrigir) {
    var b = RosterWork.tpl('tpl-ficha-bloco');
    if (!b) return null;
    b.querySelector('.rotulo-secao').textContent = titulo;
    var lapis = b.querySelector('[data-ficha-lapis]');
    if (aoCorrigir && lapis) {
      lapis.setAttribute('aria-label', rotuloLapis || titulo);
      lapis.classList.remove('oculto');
      lapis.addEventListener('click', aoCorrigir);
    }
    return b;
  }

  /* bloco que recolhe pelo chevron; devolve { bloco, corpo } (o conteúdo vai no corpo) */
  function blocoRecolhivel(titulo, aberto) {
    var b = RosterWork.tpl('tpl-ficha-bloco-recolhivel');
    if (!b) return null;
    b.querySelector('.rotulo-secao').textContent = titulo;
    var cab = b.querySelector('.ficha-bloco-cab--recolhivel');
    var corpo = b.querySelector('.ficha-bloco-corpo');
    function aplicar(abrir) {
      cab.setAttribute('aria-expanded', abrir ? 'true' : 'false');
      corpo.classList.toggle('oculto', !abrir);
    }
    aplicar(!!aberto);
    cab.addEventListener('click', function () { aplicar(cab.getAttribute('aria-expanded') !== 'true'); });
    return { bloco: b, corpo: corpo };
  }

  /* uma linha rótulo · valor no alvo (vazio vira "-" em cinza); extra = o complemento em cinza */
  function linha(alvo, rotulo, valor, extra) {
    var l = RosterWork.tpl('tpl-ficha-linha');
    if (!l || !alvo) return null;
    var vazio = valor == null || valor === '';
    l.querySelector('.ficha-linha-rotulo').textContent = rotulo || '';
    l.querySelector('[data-ficha-valor]').textContent = vazio ? '-' : String(valor);
    var ex = l.querySelector('[data-ficha-extra]');
    if (extra && !vazio) ex.textContent = extra; else ex.classList.add('oculto');
    if (vazio) l.querySelector('.ficha-linha-valor').classList.add('ficha-linha-valor--vazio');
    alvo.appendChild(l);
    return l;
  }

  /* ---------- as abas ---------- */

  /* Dados: a nota de quem não tem conta e os dados pessoais. opcoes.corrigir = abre a correção */
  function montarDados(corpo, ficha, opcoes) {
    if (!corpo || !ficha) return;
    if (ficha.tem_conta === false) {
      var nota = RosterWork.tpl('tpl-usuarios-sem-conta');
      if (nota) corpo.appendChild(nota);
    }
    var p = ficha.pessoais || {};
    var b = bloco('Dados pessoais', 'Corrigir dados pessoais', opcoes && opcoes.corrigir);
    if (!b) return;
    linha(b, 'Nome completo', p.nome_completo);
    linha(b, 'CPF', formatarCpf(p.cpf));
    linha(b, 'RG', p.rg ? RosterWork.campos.mascararRg(soDigitos(p.rg)) : '');
    linha(b, 'Nascimento', formatarData(p.data_de_nascimento), p.idade != null ? p.idade + ' anos' : '');
    linha(b, 'CNH', p.cnh);
    linha(b, 'Celular', formatarCelular(p.celular));
    linha(b, 'E-mail', p.email);
    corpo.appendChild(b);
  }

  /* Administração: o papel, onde vale e quem concedeu (para todos; sem papel, não aparece) */
  function montarAdministracao(corpo, ficha) {
    var adm = ficha.administracao;
    if (!adm || !adm.papel) return;
    var b = bloco('Administração');
    if (!b) return;
    linha(b, 'Papel', adm.rotulo);
    linha(b, 'Vale para', adm.vale_para);
    linha(b, 'Concedido por', adm.concedido_por ? adm.concedido_por + (adm.concedido_em ? ' em ' + formatarData(adm.concedido_em) : '') : '');
    corpo.appendChild(b);
  }

  /* Carreira: os dados institucionais, a administração, as datas de promoção e as transferências.
     opcoes = { corrigirInstitucionais, corrigirDatas } (só admin) */
  function montarCarreira(corpo, ficha, pessoa, graus, opcoes) {
    if (!corpo || !ficha) return;
    opcoes = opcoes || {};
    var ins = ficha.institucionais || {};
    var b = bloco('Dados institucionais', 'Corrigir dados institucionais', opcoes.corrigirInstitucionais);
    if (b) {
      linha(b, 'Quadro', ins.quadro);
      linha(b, 'Posto', ins.grau_nome);
      linha(b, 'Nome de guerra', ins.nome_de_guerra);
      linha(b, 'Setor', ins.tipo);
      linha(b, 'Data de inclusão', formatarData(ins.data_de_inclusao));
      linha(b, RosterWork.campos.nomeColocacao(ins.quadro), formatarColocacao(ins.classificacao));
      linha(b, 'Antiguidade', ins.antiguidade_sistema != null ? ins.antiguidade_sistema + 'º no sistema' : '');
      linha(b, 'Lotação', ins.lotacao_nome, ins.lotacao_cidade);
      linha(b, 'Situação', textoSituacao(ins, pessoa));
      corpo.appendChild(b);
    }
    montarAdministracao(corpo, ficha);
    if (RosterWork.usuariosPainelDatas) RosterWork.usuariosPainelDatas.montarVer(corpo, ficha, graus, opcoes.corrigirDatas);
    var transferencias = ficha.transferencias || [];
    if (transferencias.length) {
      var t = bloco('Transferências');
      if (!t) return;
      transferencias.forEach(function (x) { linha(t, formatarData(x.data), (x.origem || '?') + ' para ' + (x.destino || '?')); });
      corpo.appendChild(t);
    }
  }

  window.RosterWork.usuariosPainelLeitura = {
    montarDados: montarDados, montarCarreira: montarCarreira,
    bloco: bloco, blocoRecolhivel: blocoRecolhivel, linha: linha
  };
})();
