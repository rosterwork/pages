/* ============================================================
   ESCALAS — o Cancelar a troca da linha riscada de quem saiu numa
   troca, na caixa 2 da célula da grade (escalas-celula-editar-
   acoes.js chama). A caixa abre na hora, com os dias sendo buscados
   (a troca e as outras do mesmo registro: fn_trocas_listar), e mostra
   com quem é a troca e o RW:
   - a troca de um registro só: o dia em que cada um volta a trabalhar
     e o Cancelar a troca, que grava na hora (a confirmação é a
     própria caixa; o Voltar desiste). Sem dia de devolução, a nota de
     que ela sai inteira. Com um dia que já passou, o painel do dia
     abre no Remover deste dia de quem entrou, já nessa troca (as
     perguntas das horas), quando ele está no dia por ela;
   - as várias trocas de um registro: todos os dias (quem no lugar de
     quem), o Cancelar todas e o Mudar só alguns dias, que abre o
     painel da troca direto no Editar (o calendário dos dias, o mesmo
     da página Trocas: trocas-painel-varias.js com ctx.soEditar). Com
     um dia que já passou, só o Mudar só alguns dias (o Editar deixa
     os dias passados como estão).
   A trava dos 7 dias aparece antes (a frase do banco), e com
   alteração do dia não salva, a caixa pede para salvar antes (como o
   Registrar troca). Cancelar grava pelo mesmo código da página
   Trocas (fn_trocas_cancelar ou, no registro de várias trocas,
   fn_trocas_varias_cancelar), com o cartão das etapas na hora (a
   escala é refeita), a grade lida de novo e o resumo.
   Não cria HTML (clona os moldes) nem escreve estilo.
   API: RosterWork.escalasCelulaCancelarTroca.abrir(botao, c)
     c = o contexto da caixa da célula (escalas-celula-editar.js)
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  function api() { return RW.escalasPainelEditar.sub; }
  function L() { return RW.mensagens.escala.linha; }
  function diaMes(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function hoje() { return RW.data.paraIsoDeData(new Date()); }
  function nomeDe(grau, nome) { return ((grau || '') + ' ' + (nome || '')).trim(); }
  /* o texto à vista do item (o título da folha do celular) */
  function textoDo(botao) { var s = botao && botao.querySelector('span'); return s ? (s.innerText || s.textContent).trim() : ''; }

  /* os dias das trocas, em ordem: no serviço, o parceiro trabalha no lugar de quem pediu; na devolução, o contrário.
     horas: só a parte do serviço ("das 08h às 20h"), vazio no dia inteiro */
  function diasDe(trocas) {
    var H = api().horas, dias = [];
    function horas(hi, hf) { return hi && hf && hi !== hf ? RW.mensagens.escala.dasAs(H.curta(hi), H.curta(hf)) : ''; }
    trocas.forEach(function (t) {
      var sol = { cpf: t.solicitante_cpf, grau: t.solicitante_grau, nome: t.solicitante_nome };
      var par = { cpf: t.parceiro_cpf, grau: t.parceiro_grau, nome: t.parceiro_nome };
      if (t.data_servico_solicitante) {
        dias.push({ data: t.data_servico_solicitante, trabalha: par, folga: sol, horas: horas(t.horario_inicio, t.horario_fim) });
      }
      if (t.data_servico_parceiro) {
        dias.push({ data: t.data_servico_parceiro, trabalha: sol, folga: par, horas: horas(t.devolucao_horario_inicio, t.devolucao_horario_fim) });
      }
    });
    return dias.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  }

  /* os outros militares das trocas (fora quem saiu na linha clicada), sem repetir, na ordem em que aparecem */
  function outrosDe(trocas, cpf) {
    var vistos = {}, nomes = [];
    trocas.forEach(function (t) {
      [[t.solicitante_cpf, t.solicitante_grau, t.solicitante_nome], [t.parceiro_cpf, t.parceiro_grau, t.parceiro_nome]].forEach(function (m) {
        if (m[0] === cpf || vistos[m[0]]) return;
        vistos[m[0]] = true;
        nomes.push(nomeDe(m[1], m[2]));
      });
    });
    return nomes;
  }

  /* quem entrou no lugar dele está no dia por essa troca? (o Remover deste dia do painel, já nessa troca, vale) */
  function noPainel(t) {
    var entra = t.entra ? api().militarDoDia(t.entra) : null;
    return !!entra && entra.daUnidade && RW.escalasPainelRemoverListas.partesDe(entra).some(function (p) {
      return p.origem === 'troca' && p.trocaId === t.troca_id;
    });
  }

  function abrir(botao, c) {
    var a = c.a, t = ((a.cfg && a.cfg.trocas) || [])[0], el = RW.tpl('tpl-escala-celula-cancelar-troca');
    if (!t || !el) return;
    var q = function (s) { return el.querySelector(s); };
    var p = {
      com: q('.escala-cancelar-troca-com'), dias: q('.escala-cancelar-troca-dias'), nota: q('.escala-cancelar-troca-nota'),
      alguns: q('.escala-cancelar-troca-alguns'), erro: q('.escala-cancelar-troca-erro'), voltar: q('.escala-cancelar-troca-voltar'),
      uma: q('.escala-cancelar-troca-uma'), todas: q('.escala-cancelar-troca-todas')
    };
    var iso = api().iso();
    a.acao = 'cancelar-troca';
    a.botao = botao;
    a.el2 = el;
    function vale() { return c.a === a && a.el2 === el; }

    function mostrarErro(texto) {
      p.dias.textContent = '';
      p.erro.querySelector('.nota-texto').textContent = texto;
      p.erro.classList.remove('oculto');
    }

    /* o Voltar desiste: a caixa 2 fecha e o menu fica */
    p.voltar.addEventListener('click', function () { if (vale()) { a.acao = null; a.caixa.fecharSegunda(); } });
    RW.etapas.frase(p.dias, 'trocaDias');
    a.caixa.segunda(botao, el, textoDo(botao));

    /* a troca grava fora do rascunho do dia: com alteração não salva, salva antes (como o Registrar troca) */
    if (RW.escalasPainelSalvar && RW.escalasPainelSalvar.contar()) { mostrarErro(L().cancelarTrocaSalveAntes); return; }

    function ler() {
      p.erro.classList.add('oculto');
      RW.etapas.frase(p.dias, 'trocaDias');
      RW.trocasDados.listar([]).then(function (lista) {
        if (!vale()) return;
        var todas = Array.isArray(lista) ? lista : [];
        var esta = todas.filter(function (x) { return x.troca_id === t.troca_id; })[0];
        if (!esta || esta.status !== 'aprovada') { mostrarErro(L().cancelarTrocaNaoVale); return; }
        montar(esta, todas.filter(function (x) { return x.registro_id === esta.registro_id && x.status === 'aprovada'; }));
      }, function () {
        if (!vale()) return;
        p.dias.textContent = '';
        p.dias.appendChild(RW.falha.bloco(RW.mensagens.escala.falhaCarregar, ler));
      });
    }

    function montar(esta, doRegistro) {
      var varias = doRegistro.length > 1, dias = diasDe(doRegistro), hj = hoje(), limite = RW.escalasPainelCiclo.limite();
      var velho = dias.filter(function (d) { return d.data < limite; })[0];
      var passou = dias.some(function (d) { return d.data < hj; });
      /* a troca de um registro só com um dia que já passou: as perguntas das horas, no painel do dia */
      if (!varias && passou && !velho && noPainel(t)) {
        c.fecharTudo('guardar');
        c.abrirPainel(t.entra, { fazerAcao: { acao: 'remover-dia', trocaId: t.troca_id } });
        return;
      }
      var rw = L().trocaRw(esta.registro_numero, esta.registro_ano), outros = outrosDe(doRegistro, t.cpf);
      p.com.textContent = varias ? L().cancelarTrocasCom(outros, rw, dias.length) : L().cancelarTrocaCom(outros, rw);
      p.dias.textContent = '';
      dias.forEach(function (d) {
        var linha = RW.tpl('tpl-escala-remover-troca-dia');
        if (!linha) return;
        linha.classList.toggle('escala-remover-troca-dia--este', d.data === iso);
        linha.querySelector('.escala-remover-troca-dia-data').textContent = diaMes(d.data);
        linha.querySelector('.escala-remover-troca-dia-texto').textContent = varias
          ? L().cancelarTrocaNoLugar(d.trabalha.nome, d.folga.nome, d.horas)
          : L().cancelarTrocaVolta(nomeDe(d.folga.grau, d.folga.nome));
        p.dias.appendChild(linha);
      });
      var nota = varias ? (passou ? L().cancelarTrocasPassou : L().cancelarTrocasTodas) : (dias.length === 1 ? L().cancelarTrocaSemDevolucao : '');
      p.nota.textContent = nota;
      p.nota.classList.toggle('oculto', !nota || !!velho);
      if (velho) {
        p.erro.querySelector('.nota-texto').textContent = L().cancelarTrocaVelha(diaMes(velho.data));
        p.erro.classList.remove('oculto');
      }
      var editar = varias && !!RW.trocasPainelVarias && !!RW.trocasVariasEditar;
      p.alguns.classList.toggle('oculto', !editar);
      p.uma.classList.toggle('oculto', varias);
      p.todas.classList.toggle('oculto', !varias || passou);
      p.uma.disabled = !!velho;
      p.todas.disabled = !!velho;
      p.uma.addEventListener('click', function () { cancelar(esta); });
      p.todas.addEventListener('click', function () { cancelar(esta); });
      p.alguns.addEventListener('click', function () { mudarAlguns(esta); });
    }

    /* grava pelo mesmo código da página Trocas; a escala é refeita: o cartão das etapas na hora */
    function cancelar(esta) {
      if (!vale()) return;
      c.fecharTudo('guardar');
      var espera = RW.etapas.acao('trocaCancelarEscala', null, { doServidor: 2 }), d = RW.trocasDados;
      var pedido = esta.registro_varias ? d.variasCancelar(esta.registro_id) : d.cancelar(esta.troca_id);
      pedido.then(function (r) {
        if (!r || !(r.ok || r.success)) {
          espera.parar();
          RW.avisar({ tipo: 'erro', mensagem: (r && (r.erro || r.error)) || RW.mensagens.geral.falhaServidor });
          return;
        }
        espera.ultima();
        RW.escalasDiaNaGrade.relerPeriodo().then(function () {
          espera.parar();
          if (api().recarregar) api().recarregar();
          if (r.log && RW.resumo) RW.resumo.abrirModal(r.log, { pagina: 'Escala' });
        });
      }, function () {
        espera.parar();
        RW.avisar({ tipo: 'erro', mensagem: RW.mensagens.geral.semConexao });
      });
    }

    /* o painel da troca direto no Editar (o calendário dos dias); salvou: a grade lê de novo */
    function mudarAlguns(esta) {
      if (!vale()) return;
      c.fecharTudo('guardar');
      RW.trocasPainelVarias.abrir(esta, {
        cpf: RW.sessao.cpf(), ehAdmin: RW.sessao.temPapel('pelotao'), soEditar: true,
        aoMudar: function () { RW.escalasDiaNaGrade.relerPeriodo(); }
      });
    }

    ler();
  }

  RW.escalasCelulaCancelarTroca = { abrir: abrir };
})();
