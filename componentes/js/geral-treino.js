/* ============================================================
   TREINO — o modo treino (RosterWork.treino)
   Começar um treino (a página Treinamento) liga o modo no sistema
   inteiro: a moldura azul em volta da tela (#treino-moldura), a barra
   azul no alto (.treino-barra, acima do cabeçalho) com a página, o
   número e o nome do treino, o Treino livre (geral-treino-livre.js), o Recomeçar (geral-guia.js) e o Sair do treino, e a marca data-treino
   no <html>. Nada é gravado: cada
   chamada ao banco passa por passar(caminho, metodo, corpo, buscar),
   no geral-api.js; barrar só deixa ir o que lê (LEITURAS), os ensaios
   (ENSAIOS, com p_ensaio), o plano e o ensaio do Desfazer a troca do
   dia, a prévia do Salvar da Distribuição (p_previa) e o Visto do passo
   a passo. O tema e as unidades valem só durante o
   treino (não gravam e não avisam; voltam ao sair), como as QUIETAS; o resto é
   recusado com o aviso (RosterWork.mensagens.treino). O que não passa
   pelo banco (a senha, os aparelhos, as notificações) pergunta a
   recusar(frase). O que passa
   vai pelos exemplos do treino (geral-treino-cenarios.js): o roteiro
   com data-cenario liga o dele ao começar. No treino da Extrajornada,
   antes de tudo, o mês de treino responde pelas chamadas dela
   (geral-treino-extra.js); nos das trocas com exemplo do banco, o
   exemplo responde pelas leituras delas (geral-treino-banco.js).
   Sai do modo: o Sair do treino e o Voltar aos treinos do fim do
   roteiro (voltam à lista, aberta na linha do último treino escolhido)
   e fechar a aba; recarregar a página, no treino com passo a passo,
   volta à lista (geral-treino-livre.js). O treino livre é o modo
   ligado sem o passo a passo (entrarLivre). O Próximo treino do
   fim do roteiro volta à lista (a tela recomeça limpa) e, quando ela
   abre, começa o próximo. Ao sair, a edição não salva é descartada sem
   perguntar.
   Função de leitura nova chamada pelo site entra em LEITURAS (conferida
   no banco: STABLE, ou sem gravação em tabela de verdade, ou ensaio que
   desfaz tudo).
   ============================================================ */
(function () {
  'use strict';

  var RW = window.RosterWork = window.RosterWork || {};

  /* só leem (STABLE no banco) */
  var LEITURAS = [
    'administradores_listar', 'afastamentos_listar', 'ajustes_ritmo_listar', 'antiguidade_listar', 'bug_relatores_listar', 'bugs_listar',
    'buscar_graus_hierarquicos', 'dados_pendentes', 'erros_tela_contar_novos', 'erros_tela_listar', 'escala_alteracoes_dia', 'escala_dia_arvore',
    'escala_dias_atualizando', 'escala_dia_disponiveis', 'escala_impressao', 'escala_impressao_erros', 'escala_minha_calendario', 'escala_sysbm',
    'expediente_horario', 'expediente_mes', 'ficha_alteracoes', 'fn_sou_programador', 'fn_trocas_impressao',
    'fn_trocas_registro', 'fn_trocas_varias_dias', 'fn_trocas_varias_montar', 'fn_trocas_varias_plano', 'fn_unidades_padrao',
    'ler_distribuicao_dia', 'ler_escala_mes', 'ler_escala_militares', 'ler_militar_dia',
    'manutencao_telas_listar', 'nova_distribuicao_calcular', 'nova_distribuicao_ler', 'extrajornada_minha', 'pendencias_meus_pedidos',
    'recados_contar_pendentes', 'recados_listar', 'sysbm_termo_situacao', 'termos_situacao', 'viatura_prefixo_em_uso',
    /* sem gravação em tabela de verdade (só tabela temporária) */
    'buscar_efetivo', 'buscar_ficha_militar', 'buscar_inativos', 'buscar_unidades_ordenadas', 'escala_ciclo_retirar_analisar',
    'escala_continuos_listar', 'fn_avisos_listar', 'fn_perfil_usuario', 'fn_preferencias_carregar', 'fn_trocas_historico_par',
    'fn_trocas_listar', 'fn_trocas_listar_militares', 'fn_trocas_meus_servicos', 'fn_trocas_pendencias_listar',
    'fn_trocas_saldo_entre', 'folgas_extrato', 'folgas_listar_lancamentos', 'folgas_listar_saldos', 'folgas_servicos_militar',
    'listar_historico', 'notificacoes_admin_celular_ler', 'notificacoes_listar', 'extrajornada_mes', 'extrajornada_sugerir',
    'pendencias_listar', 'perfil_solicitacoes_minhas',
    /* ensaiam e desfazem tudo (a prévia do dia e as análises de impacto) */
    'escala_previa', 'fn_folgas_analisar_impacto', 'fn_trocas_analisar_impacto', 'pedido_escala_comparar',
    /* o mês de treino da Extrajornada e os exemplos do banco (montam, aplicam e leem num ensaio que desfaz tudo;
       geral-treino-extra.js e geral-treino-banco.js) */
    'extrajornada_treino', 'treino_cenario',
    /* o banco em dia: marca como vencido o link que já venceu, e termina o recálculo que já estava na fila; a fila do
       recálculo, só lendo */
    'acesso_estado', 'recalculo_fila_processar', 'recalculo_fila_ler'
  ];
  /* só passam no ensaio (p_ensaio = true: gravam de mentira, leem a Análise e desfazem) */
  var ENSAIOS = ['fn_trocas_varias_registrar', 'fn_trocas_varias_editar'];
  /* não gravam e não avisam: a tela segue como se tivesse gravado */
  var QUIETAS = ['notificacoes_marcar_lidas'];

  var LINHA_LIVRE = 'livre';   // o "último escolhido" de quem entrou no treino livre pela lista, sem treino nenhum

  var ligado = false;
  var livre = false;           // o treino livre: o modo ligado, sem o passo a passo
  var ultimoEscolhido = null;

  function mostrar(sim) {
    ligado = sim;
    document.documentElement.toggleAttribute('data-treino', sim);
    var barra = document.querySelector('.treino-barra');
    var moldura = document.getElementById('treino-moldura');
    if (barra) barra.classList.toggle('oculto', !sim);
    if (moldura) moldura.classList.toggle('oculto', !sim);
  }

  /* a marca no <html> muda a barra (geral-treino.css); o Recomeçar o treino só para quem veio de um treino */
  function marcarLivre(sim) {
    livre = sim;
    document.documentElement.toggleAttribute('data-treino-livre', sim);
    var recomecar = document.querySelector('.treino-barra-recomecar');
    if (recomecar) recomecar.classList.toggle('oculto', sim && ultimoEscolhido === LINHA_LIVRE);
  }

  /* a barra diz onde o treino fica: a página, o número (o mesmo da lista) e o nome */
  function preencherBarra(id, t) {
    var barra = document.querySelector('.treino-barra');
    var onde = t ? RW.guiaRoteiros.ondeFica(id) : null;
    if (!barra || !onde) return;
    Array.prototype.forEach.call(barra.querySelectorAll('.treino-barra-pagina-nome'), function (el) { el.textContent = RW.mensagens.treino.pagina(onde); });
    barra.querySelector('.treino-barra-numero').textContent = onde.numero;
    barra.querySelector('.treino-barra-total').textContent = onde.total;
    barra.querySelector('.treino-barra-nome').textContent = t.getAttribute('data-titulo');
  }

  function comecar(id) {
    ultimoEscolhido = id;
    if (RW.treinoLivre) RW.treinoLivre.guardar(false, id);
    mostrar(true);
    marcarLivre(false);
    /* no celular, o topo pode ter saído com a rolagem da lista: o treino pode começar pelo menu do canto ou pelo sino */
    if (RW.recolherTopo) RW.recolherTopo.mostrar();
    var t = RW.guiaRoteiros ? RW.guiaRoteiros.roteiro(id) : null;
    preencherBarra(id, t);
    if (RW.treinoCenarios) RW.treinoCenarios.ativar(t ? t.getAttribute('data-cenario') : null, id);
    if (RW.guia) RW.guia.iniciar(id, { treino: true });
  }

  /* o treino livre: o passo a passo fecha e o modo continua. daLista: sem treino nenhum, e o exemplo do treino anterior
     sai; senão, na mesma tela, e o exemplo fica */
  function entrarLivre(daLista) {
    if (daLista) {
      ultimoEscolhido = LINHA_LIVRE;
      if (RW.treinoCenarios) RW.treinoCenarios.ativar(null);
    }
    if (RW.treinoLivre) RW.treinoLivre.guardar(true, ultimoEscolhido);
    if (RW.guia) RW.guia.encerrar();
    mostrar(true);
    marcarLivre(true);
    if (RW.recolherTopo) RW.recolherTopo.mostrar();
  }
  /* o treino livre depois de recarregar a página: com os dados de verdade (o exemplo ficou para trás) */
  function continuarLivre(id) {
    ultimoEscolhido = id;
    mostrar(true);
    marcarLivre(true);
  }

  /* o modo desliga na tela em que está (sair da conta é de verdade: o treino termina antes) */
  function apagar() {
    if (RW.guia) RW.guia.encerrar();
    if (RW.treinoCenarios) RW.treinoCenarios.ativar(null);
    mostrar(false);
    marcarLivre(false);
  }

  /* desliga e vai à lista (a edição não salva e o aviso aberto ficam para trás, sem perguntar) */
  function desligar() {
    if (RW.guia) RW.guia.encerrar();
    if (RW.fecharModais) RW.fecharModais();
    apagar();
    if (RW.treinoLivre) RW.treinoLivre.soltar();
    if (RW.guardaSaida) RW.guardaSaida.dispensar();
    if (RW.irParaPagina) RW.irParaPagina('treinamento');
  }

  /* o que não passa pelo banco (a senha, os aparelhos, as notificações): no treino, o aviso e a recusa */
  function recusar(frase) {
    if (!ligado) return false;
    if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: frase, fixo: true });
    return true;
  }

  /* quem sai volta à lista na linha do último treino escolhido; o treinamento.js pede a linha ao abrir (vale uma vez) */
  var linhaParaAbrir = null;
  function voltarAosTreinos() {
    linhaParaAbrir = ultimoEscolhido;
    desligar();
  }
  function pedirLinha(id) { linhaParaAbrir = id; }
  function linhaPedida() {
    var id = linhaParaAbrir;
    linhaParaAbrir = null;
    return id;
  }

  /* o próximo treino começa quando a lista abrir (o treinamento.js chama comecarPendente); vale por 15 s, para a lista
     aberta depois, por outro caminho, não começar sozinha */
  var pendente = null;
  function seguir(id) {
    pendente = { id: id, em: Date.now() };
    desligar();
  }
  function comecarPendente() {
    var p = pendente;
    pendente = null;
    if (p && Date.now() - p.em < 15000) comecar(p.id);
  }

  function resposta(status, corpo) {
    return new Response(JSON.stringify(corpo), { status: status, headers: { 'Content-Type': 'application/json' } });
  }

  function nomeDa(caminho) { var achou = /^\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(caminho); return achou ? achou[1] : ''; }

  /* a chamada ao banco passa (null) ou fica com o treino (a resposta que a tela recebe no lugar) */
  function barrar(caminho, metodo, corpo) {
    if (!ligado || metodo === 'GET') return null;
    var nome = nomeDa(caminho);
    if (LEITURAS.indexOf(nome) >= 0) return null;
    if (ENSAIOS.indexOf(nome) >= 0 && corpo && corpo.p_ensaio === true) return null;
    /* o Desfazer a troca do dia: sem p_acao só lê o plano; com p_ensaio desfaz tudo */
    if (nome === 'fn_trocas_cancelar_dia' && corpo && (corpo.p_acao == null || corpo.p_ensaio === true)) return null;
    /* o Salvar da Distribuição: a prévia (p_previa) só mostra o que muda, e o banco desfaz as mudanças dela */
    if (nome === 'nova_distribuicao_salvar' && corpo && corpo.p_previa === true) return null;
    if (nome === 'fn_preferencias_salvar') {
      var chaves = Object.keys(corpo || {});
      if (chaves.length === 1 && chaves[0] === 'p_ajuda') return null;   // o Visto do passo a passo
      return resposta(200, null);                                          // o tema e as unidades: só nesta sessão
    }
    if (QUIETAS.indexOf(nome) >= 0) return resposta(200, null);
    var frase = livre ? RW.mensagens.treino.livreNaoSalvo : RW.mensagens.treino.naoGrava;
    if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: frase, fixo: true });
    return resposta(403, { code: 'RW_TREINO', message: frase });
  }

  /* a chamada no treino: a recusada recebe a resposta do treino; a que passa vai pelos exemplos, que limpam o pedido
     e põem a situação na resposta. As que ainda não voltaram ficam contadas: o passo a passo espera por elas */
  var noAr = 0;
  function passar(caminho, metodo, corpo, buscar) {
    noAr++;
    function voltou() { noAr--; }
    var chamada = encaminhar(caminho, metodo, corpo, buscar);
    chamada.then(voltou, voltou);
    return chamada;
  }
  function encaminhar(caminho, metodo, corpo, buscar) {
    var nome = nomeDa(caminho);
    if (RW.treinoExtra && RW.treinoExtra.cuida(nome, corpo)) return RW.treinoExtra.responder(nome, corpo);
    if (RW.treinoBanco && RW.treinoBanco.cuida(nome, corpo)) return RW.treinoBanco.responder(nome, corpo, buscar);
    var barrada = barrar(caminho, metodo, corpo);
    if (barrada) return Promise.resolve(barrada);
    return RW.treinoCenarios ? RW.treinoCenarios.passar(nome, corpo, buscar) : buscar(corpo);
  }

  document.addEventListener('click', function (evento) {
    if (evento.target.closest('.treino-barra-sair')) voltarAosTreinos();
  });

  RW.treino = {
    LINHA_LIVRE: LINHA_LIVRE,
    ligado: function () { return ligado; },
    livre: function () { return livre; },
    ultimo: function () { return ultimoEscolhido; },
    noAr: function () { return noAr > 0; },
    comecar: comecar, entrarLivre: entrarLivre, continuarLivre: continuarLivre, apagar: apagar, recusar: recusar,
    voltarAosTreinos: voltarAosTreinos, pedirLinha: pedirLinha, linhaPedida: linhaPedida,
    seguir: seguir, comecarPendente: comecarPendente, passar: passar
  };
})();
