/* ============================================================
   TREINO — o modo treino (RosterWork.treino)
   Começar um treino (a página Treinamento) liga o modo no sistema
   inteiro: a moldura azul em volta da tela (#treino-moldura), a barra
   azul no alto (.treino-barra, acima do cabeçalho) com Treinos e Sair
   do treino, e a marca data-treino no <html>. Nada é gravado: antes de
   cada chamada ao banco, o geral-api.js pergunta barrar(caminho,
   metodo, corpo), que só deixa passar o que lê (LEITURAS), os ensaios
   (ENSAIOS, com p_ensaio) e o Visto do passo a passo. O tema e as
   unidades valem só nesta sessão (não gravam e não avisam), como as
   QUIETAS; o resto é recusado com o aviso "No modo treino, nada é
   gravado.".
   Sai do modo: Treinos (volta à lista), Sair do treino (vai à Escala),
   o Voltar aos treinos do fim do roteiro, recarregar ou fechar (o modo
   não fica guardado). Ao sair, a edição não salva é descartada sem
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
    'afastamentos_listar', 'ajustes_ritmo_listar', 'antiguidade_listar', 'bug_relatores_listar', 'bugs_listar',
    'buscar_graus_hierarquicos', 'dados_pendentes', 'dist_ler_modelo', 'dist_listar_modelos', 'dist_listar_periodos',
    'dist_regras_funcoes', 'dist_regras_listar', 'dist_regras_militares', 'escala_alteracoes_dia', 'escala_dia_arvore',
    'escala_dia_disponiveis', 'escala_impressao', 'escala_impressao_erros', 'escala_minha_calendario', 'escala_sysbm',
    'expediente_horario', 'expediente_mes', 'ficha_alteracoes', 'fn_sou_programador', 'fn_trocas_impressao',
    'fn_trocas_registro', 'fn_trocas_varias_dias', 'fn_trocas_varias_montar', 'fn_trocas_varias_plano', 'fn_unidades_padrao',
    'ler_distribuicao_dia', 'ler_escala_mes', 'ler_escala_militares', 'ler_militar_dia', 'listar_instalacoes', 'listar_viaturas',
    'nova_distribuicao_calcular', 'nova_distribuicao_ler', 'nova_extra_minha', 'pendencias_meus_pedidos',
    'recados_contar_pendentes', 'recados_listar', 'sysbm_termo_situacao', 'termos_situacao', 'viatura_prefixo_em_uso',
    /* sem gravação em tabela de verdade (só tabela temporária) */
    'buscar_efetivo', 'buscar_ficha_militar', 'buscar_inativos', 'buscar_unidades_ordenadas', 'escala_ciclo_retirar_analisar',
    'escala_continuos_listar', 'fn_avisos_listar', 'fn_perfil_usuario', 'fn_preferencias_carregar', 'fn_trocas_historico_par',
    'fn_trocas_listar', 'fn_trocas_listar_militares', 'fn_trocas_meus_servicos', 'fn_trocas_pendencias_listar',
    'fn_trocas_saldo_entre', 'folgas_extrato', 'folgas_listar_lancamentos', 'folgas_listar_saldos', 'folgas_servicos_militar',
    'listar_historico', 'notificacoes_admin_celular_ler', 'notificacoes_listar', 'nova_extra_mes', 'nova_extra_sugerir',
    'pendencias_listar', 'perfil_solicitacoes_minhas', 'proximos_numeros_instalacao',
    /* ensaiam e desfazem tudo (a prévia do dia e as análises de impacto) */
    'escala_previa', 'fn_folgas_analisar_impacto', 'fn_trocas_analisar_impacto', 'pedido_escala_comparar',
    /* o banco em dia: marca como vencido o link que já venceu, e termina o recálculo que já estava na fila */
    'acesso_estado', 'recalculo_fila_processar'
  ];
  /* só passam no ensaio (p_ensaio = true: gravam de mentira, leem a Análise e desfazem) */
  var ENSAIOS = ['fn_trocas_varias_registrar', 'fn_trocas_varias_editar'];
  /* não gravam e não avisam: a tela segue como se tivesse gravado */
  var QUIETAS = ['notificacoes_marcar_lidas'];

  var ligado = false;

  function mostrar(sim) {
    ligado = sim;
    document.documentElement.toggleAttribute('data-treino', sim);
    var barra = document.querySelector('.treino-barra');
    var moldura = document.getElementById('treino-moldura');
    if (barra) barra.classList.toggle('oculto', !sim);
    if (moldura) moldura.classList.toggle('oculto', !sim);
  }

  function comecar(id) {
    mostrar(true);
    if (RW.guia) RW.guia.iniciar(id, { treino: true });
  }

  /* desliga e vai à tela (a edição não salva fica para trás, sem perguntar) */
  function sairPara(pagina) {
    if (RW.guia) RW.guia.encerrar();
    mostrar(false);
    if (RW.guardaSaida) RW.guardaSaida.dispensar();
    if (RW.irParaPagina) RW.irParaPagina(pagina);
  }
  function voltarAosTreinos() { sairPara('treinamento'); }
  function sair() { sairPara('escalas'); }

  function resposta(status, corpo) {
    return new Response(JSON.stringify(corpo), { status: status, headers: { 'Content-Type': 'application/json' } });
  }

  /* a chamada ao banco passa (null) ou fica com o treino (a resposta que a tela recebe no lugar) */
  function barrar(caminho, metodo, corpo) {
    if (!ligado || metodo === 'GET') return null;
    var achou = /^\/rest\/v1\/rpc\/([a-z_0-9]+)/.exec(caminho);
    var nome = achou ? achou[1] : '';
    if (LEITURAS.indexOf(nome) >= 0) return null;
    if (ENSAIOS.indexOf(nome) >= 0 && corpo && corpo.p_ensaio === true) return null;
    if (nome === 'fn_preferencias_salvar') {
      var chaves = Object.keys(corpo || {});
      if (chaves.length === 1 && chaves[0] === 'p_ajuda') return null;   // o Visto do passo a passo
      return resposta(200, null);                                          // o tema e as unidades: só nesta sessão
    }
    if (QUIETAS.indexOf(nome) >= 0) return resposta(200, null);
    if (RW.avisar) RW.avisar({ tipo: 'aviso', mensagem: RW.mensagens.treino.naoGrava, fixo: true });
    return resposta(403, { code: 'RW_TREINO', message: RW.mensagens.treino.naoGrava });
  }

  document.addEventListener('click', function (evento) {
    if (evento.target.closest('.treino-barra-treinos')) voltarAosTreinos();
    else if (evento.target.closest('.treino-barra-sair')) sair();
  });

  RW.treino = {
    ligado: function () { return ligado; },
    comecar: comecar, sair: sair, voltarAosTreinos: voltarAosTreinos, barrar: barrar
  };
})();
