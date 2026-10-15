/* ============================================================
   MENSAGENS — textos condicionais (erro, aviso, validação)
   Fonte única das mensagens que SÓ aparecem por comportamento
   (o JS é que as exibe). Rótulo fixo sempre visível fica no HTML
   (ver REGRAS-DE-CODIGO §3.1). Mudar a palavra aqui muda em todos
   os lugares que usam a mesma constante.
   Exposto em RosterWork.mensagens.
   ============================================================ */
(function () {
  'use strict';

  window.RosterWork = window.RosterWork || {};

  /* o artigo da unidade pelo ordinal do nome: "o 2ºPEL", "a 2ªCIBM" */
  function artigo(unidade) { return /ª/.test(unidade || '') ? 'a' : 'o'; }

  window.RosterWork.mensagens = {

    /* meu perfil (e-mail e celular direto, pedido de correção do resto + troca de senha) */
    perfil: {
      falhaDados: 'Não foi possível salvar. Tente de novo.',
      solicitacaoEnviada: 'Solicitação enviada para aprovação.',
      demaisParaAprovacao: 'As demais alterações foram enviadas para a aprovação do administrador.',
      aguardando: function (n) {
        return n === 1
          ? '1 alteração aguardando a aprovação do administrador.'
          : n + ' alterações aguardando a aprovação do administrador.';
      },
      aEnviar: function (n) { return n === 1 ? '1 alteração a enviar' : n + ' alterações a enviar'; },
      qtdAlteracoes: function (n) { return n === 1 ? '1 alteração' : n + ' alterações'; },
      enviadaEm: function (dataBR) { return 'Enviada em ' + dataBR; },
      dataInvalida: 'Data inválida (use DD/MM/AAAA).',
      dataFutura: 'A data não pode ser futura.',
      celularInvalido: 'Informe o DDD e o número.',
      rgInvalido: 'O RG deve ter 8 ou 9 dígitos.',
      emailInvalido: 'Endereço de e-mail inválido.',
      nomeCurto: 'Nome muito curto.',
      semMinhas: 'Você ainda não pediu nenhuma correção.',
      senhaCurta: 'A senha precisa de ao menos 6 caracteres.',
      senhaNaoConfere: 'A confirmação não bate com a nova senha.',
      senhaIgual: 'A nova senha é igual à atual.',
      senhaAtualErrada: 'Senha atual incorreta.',
      senhaTrocada: 'Senha trocada com sucesso.',
      falhaTrocaSenha: 'Não foi possível trocar a senha. Tente de novo.'
    },

    /* início (comunicados: criar e remover — admin) */
    inicio: {
      carregando: 'Carregando…',
      falhaCarregar: 'Não foi possível carregar.',
      nadaPendente: 'Nada pendente.',
      confirmarRemoverAviso: 'Remover este comunicado? Ele deixa de aparecer para quem o recebeu.',
      descartarAviso: 'Descartar este comunicado não publicado?',
      falhaSalvarAviso: 'Não foi possível publicar o comunicado. Tente de novo.',
      falhaRemoverAviso: 'Não foi possível remover o comunicado. Tente de novo.',
      /* as linhas do cartão de pendências de administração */
      pendTrocas: 'Trocas a aprovar',
      pendFolgas: 'Folgas a aprovar',
      pendCorrecoes: 'Correções de dados',
      pendForaEscala: 'Militares fora da escala'
    },

    /* Pendências › correção de dados (as alterações que o militar pediu na ficha) */
    correcoes: {
      painelTitulo: 'Correção de dados',
      painelSituacao: 'Aguardando aprovação',
      caixaPedido: 'Alterações pedidas',
      frase: function (nome, n, data) { return nome + ' pediu ' + (n === 1 ? '1 alteração' : n + ' alterações') + ' em ' + data + '. Aprovar ou recusar vale para as marcadas.'; }
    },

    /* avisos (a página das duas abas: Para mim · Comunicados; os grupos do sino) */
    avisos: {
      semNotificacoes: 'Nada novo por aqui.',
      semAbertos: 'Nada esperando por você.',
      grupoPessoal: 'Para você',
      grupoAdministracao: 'Administração',
      semComunicados: 'Nenhum comunicado.',
      carregando: 'Carregando…',
      falhaCarregar: 'Não foi possível carregar.'
    },

    /* links de acesso que o administrador gera (páginas standalone criar-conta e nova-senha):
       o que as duas telas dizem sobre o link e a conferência do CPF */
    linkAcesso: {
      conferindo: 'Conferindo o link…',
      cpfVazio: 'Digite o seu CPF',
      cpfInvalido: 'CPF inválido',
      cpfNaoConfere: 'Este CPF não confere com o link.',
      invalido: 'Este link não é mais válido. Peça um novo link ao administrador da sua unidade.',
      erroConexao: 'Erro de conexão. Tente novamente.',
      /* cadastro */
      semLinkCadastro: 'Para criar a sua conta, peça o link de cadastro ao administrador da sua unidade.',
      expiradoCadastro: function (data, hora) { return 'Este link de cadastro expirou em ' + data + ' às ' + hora + '. Peça um novo link ao administrador da sua unidade.'; },
      usadoCadastro: 'Este link já foi usado e a conta já foi criada. Entre com o seu CPF e a sua senha.',
      /* nova senha */
      semLinkSenha: 'Para criar uma nova senha, peça o link ao administrador da sua unidade.',
      expiradoSenha: function (data, hora) { return 'Este link de nova senha expirou em ' + data + ' às ' + hora + '. Peça um novo link ao administrador da sua unidade.'; },
      usadoSenha: 'Este link já foi usado. Entre com o seu CPF e a sua nova senha.'
    },

    /* criar conta (página standalone, aberta pelo link de cadastro) */
    criarConta: {
      falhaOpcoes: 'Não foi possível carregar os postos e as unidades. Verifique a sua internet. A página vai recarregar.',
      contaCriada: 'Conta criada. Você já pode entrar com o seu CPF e a sua senha.',
      contaCriadaComCorrecoes: 'Conta criada. Você já pode entrar. As outras alterações que você fez vão passar pela aprovação de um administrador.',
      falha: 'Não foi possível criar a conta. Tente de novo.'
    },

    /* login (página standalone, antes da sessão) */
    login: {
      identificadorVazio: 'Digite seu CPF ou RG',
      identificadorInvalido: 'CPF ou RG inválido',
      senhaVazia: 'Digite sua senha',
      erroConexao: 'Erro de conexão',
      naoEncontrado: 'CPF ou RG não encontrado',
      senhaIncorreta: 'Senha incorreta'
    },

    /* nova senha (página standalone, aberta pelo link de nova senha que o administrador gera) */
    novaSenha: {
      senhaCurta: 'A senha precisa de ao menos 6 caracteres.',
      senhaNaoConfere: 'A confirmação não bate com a nova senha.',
      senhaIgual: 'A nova senha precisa ser diferente da senha atual.',
      redefinida: 'Senha redefinida com sucesso. Você já pode entrar.',
      falhaRedefinir: 'Não foi possível redefinir a senha. Tente de novo.'
    },

    /* termos de uso e privacidade (Criar conta, janela de ciência ao entrar e Meu perfil) */
    termos: {
      obrigatorio: 'Marque que leu os Termos de uso e privacidade.',
      falhaCiencia: 'Não foi possível registrar a ciência. Tente de novo.',
      pendente: 'Ciência pendente',
      ciente: function (versao, dataBR) { return 'Ciente da versão ' + versao + ' em ' + dataBR; }
    },

    /* fale conosco (modal de recado) */
    faleConosco: {
      assuntoVazio: 'Informe o assunto.',
      selecioneTipo: 'Selecione o tipo.',
      mensagemVazia: 'Escreva sua mensagem.',
      enviado: 'Recado enviado. Obrigado!',
      falha: 'Não foi possível enviar. Tente de novo.'
    },

    /* programador (mensagens: leitura/gestão dos recados) */
    programador: {
      vazioLista: 'Nenhuma mensagem por aqui.',
      vazioDetalhe: 'Selecione uma mensagem à esquerda para ver os detalhes.',
      assuntoVazio: 'Informe o assunto.',
      mensagemVazia: 'Escreva a mensagem.',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      tipos: { sugestao: 'Sugestão', problema: 'Problema', outro: 'Outro', lembrete: 'Lembrete' },
      status: { nao_lido: 'Não lido', lido: 'Lido', resolvido: 'Resolvido' },
      contexto: { pagina: 'Página', aba: 'Aba', unidades: 'Unidades', navegador: 'Navegador', tela: 'Tela', tema: 'Tema', url: 'Endereço' }
    },

    /* programador › bugs (registro e andamento dos bugs a corrigir) */
    programadorBugs: {
      vazioLista: 'Nenhum bug por aqui.',
      vazioDetalhe: 'Selecione um bug à esquerda para ver os detalhes.',
      carregando: 'Carregando…',
      falhaCarregar: 'Não foi possível carregar os bugs. Tente de novo.',
      gravidades: { leve: 'Leve', moderado: 'Moderado', grave: 'Grave' },
      situacoes: { aberto: 'Aberto', em_correcao: 'Em correção', corrigido: 'Corrigido', descartado: 'Descartado' },
      passos: { aberto: 'Aberto por', assumido: 'Assumido por', devolvido: 'Devolvido por', corrigido: 'Corrigido por', descartado: 'Descartado por', reaberto: 'Reaberto por' },
      naoInformado: 'Não informado',
      ninguem: 'Ninguém',
      registro: function (autor, quando) { return 'Registrado por ' + autor + ' em ' + quando; },
      subtitulo: function (n) { return n ? (n === 1 ? '1 bug a corrigir' : n + ' bugs a corrigir') : 'Nenhum bug a corrigir'; },
      tituloVazio: 'Informe o título.',
      gravidadeVazia: 'Escolha a gravidade.',
      descricaoVazia: 'Descreva o problema.',
      motivoVazio: 'Escreva o motivo do descarte.',
      relatorNenhum: 'Nenhum militar encontrado.',
      nenhumAberto: 'Nenhum bug aberto ou em correção.',
      relatorFalha: 'Não foi possível carregar os militares.',
      confirmarCorrigido: 'Marcar este bug como corrigido? As mensagens ligadas passam para Resolvido e quem relatou recebe um aviso.',
      confirmarDescartar: 'Descartar este bug? Ele sai da lista de abertos e ninguém recebe aviso.',
      botaoCorrigido: 'Marcar corrigido',
      botaoDescartar: 'Descartar'
    },

    /* cadastro de usuário (Novo usuário) */
    cadastro: {
      nomeVazio: 'Preencha o nome completo',
      nomeIncompleto: 'Digite o nome completo',
      cpfVazio: 'Preencha o CPF',
      cpfInvalido: 'CPF inválido',
      rgVazio: 'Preencha o RG',
      rgInvalido: 'O RG deve ter 8 ou 9 dígitos',
      nascimentoVazio: 'Preencha a data de nascimento',
      dataInvalida: 'Data inválida (dd/mm/aaaa)',
      idadeMinima: 'Idade mínima de 18 anos',
      cnhVazia: 'Selecione a CNH',
      celularVazio: 'Preencha o celular',
      celularInvalido: 'Celular inválido',
      emailVazio: 'Preencha o email',
      emailInvalido: 'Email inválido',
      tipoVazio: 'Selecione o tipo',
      postoVazio: 'Selecione o posto',
      guerraVazio: 'Preencha o nome de guerra',
      inclusaoVazia: 'Preencha a inclusão no quadro',
      inclusaoAposNascimento: 'A inclusão no quadro deve ser após o nascimento',
      inclusaoDepoisPromocao: 'A inclusão no quadro não pode ser depois da primeira promoção',
      colocacaoVazia: 'Preencha a colocação',
      lotacaoVazia: 'Selecione a lotação',
      setorVazio: 'Selecione o setor',
      promocaoVazia: 'Preencha a data',
      promocaoOrdem: 'Deve ser após a data anterior',
      sucesso: 'Usuário cadastrado com sucesso.',
      falha: 'Não foi possível cadastrar o usuário.'
    },

    /* postos (painel da instalação e da viatura: criar + editar + transferir + excluir) */
    postos: {
      falhaAdicionar: 'Não foi possível adicionar. Tente de novo.',
      falhaEditar: 'Não foi possível salvar. Tente de novo.',
      descartarAlteracoes: 'Descartar as alterações não salvas desta instalação?',
      descartarViatura: 'Descartar as alterações não salvas desta viatura?',
      confirmarTransferirViatura: 'Transferir a viatura {prefixo} de {origem} para {destino}? Ela passa para {destino} a partir desta data. Até a véspera continua em {origem}, e os dias anteriores não mudam.',
      confirmarExcluirViatura: 'Excluir a viatura {prefixo}? A partir desta data o posto sai da escala. Os dias anteriores continuam como estão.',
      confirmarExcluirInstalacao: 'Excluir a instalação {nome}? A partir desta data o posto sai da escala. Os dias anteriores continuam como estão.',
      /* estado e exclusão com data: a data do modal é a data em que a mudança vale */
      novoEstadoVale: 'O novo estado vale a partir desta data. A escala é refeita desse dia em diante.',
      postoComeca: 'O posto começa a valer nesta data.',
      mudancaAPartir: '{estado} a partir de {data}',
      transferenciaAPartir: 'Transferência para {unidade} a partir de {data}',
      /* linha do período no card (primeiro e último dia reais do posto) */
      periodoPermanente: 'Permanente',
      periodoDesde: 'desde {data}',
      periodoAte: 'até {data}',
      periodoIntervalo: '{inicio} a {fim}',
      confirmarCancelarMudanca: 'Cancelar a mudança marcada ({mudanca})? A escala é refeita a partir dessa data.',
      /* a mudança abriu um período na Distribuição que já foi revisado: cancelar a descarta */
      descartaAjusteDistribuicao: ' O período da Distribuição que já foi revisado será descartado.',
      falhaCancelarMudanca: 'Não foi possível cancelar a mudança. Tente de novo.',
      /* seção "Linha do tempo" do painel do posto */
      falhaLinhaTempo: 'Não foi possível carregar a linha do tempo.',
      semLinhaTempo: 'Sem registros.',
      falhaTransferir: 'Não foi possível transferir. Tente de novo.',
      falhaExcluir: 'Não foi possível excluir. Tente de novo.',
      falhaExcluirInstalacao: 'Não foi possível excluir a instalação. Tente de novo.',
      falhaManutencoes: 'Não foi possível carregar as manutenções.',
      falhaAgendarManutencao: 'Não foi possível agendar a manutenção. Tente de novo.',
      falhaEncerrarManutencao: 'Não foi possível encerrar a manutenção. Tente de novo.',
      falhaRemoverManutencao: 'Não foi possível remover. Tente de novo.',
      confirmarRemoverManutencao: 'Remover esta janela de manutenção?',
      confirmarEncerrarManutencao: 'Encerrar a manutenção de {prefixo} agora? A viatura deixa de ser marcada como "Em manutenção" na escala.',
      /* a viatura é única no sistema: se já existe em outra unidade, oferece a transferência */
      viaturaEmOutraUnidade: 'A viatura {prefixo} já está cadastrada em {unidade}. Deseja transferi-la para {destino} a partir de {data}? Os dados que você digitou serão aplicados a ela.',
      /* ponto crítico: postos alimentam a distribuição da escala */
      impactoDistribuicao: 'Este é um ponto crítico do sistema: as viaturas e instalações alimentam a distribuição da escala. Vá até a Distribuição para conferir os modelos e corrigir o que for necessário.'
    },

    /* afastamentos — painéis Nova licença / Nova dispensa (decisão fora do fluxo) */
    afastamentos: {
      foraDoFluxo: 'Sai do ciclo por tempo indeterminado; volta quando o administrador o incluir de novo pela aba Ciclo da Escala.',
      segueNoFluxo: 'Continua no fluxo, só bloqueia os dias do afastamento.',
      falhaSalvarLicenca: 'Não foi possível salvar a licença. Tente de novo.',
      falhaSalvarDispensa: 'Não foi possível salvar a dispensa. Tente de novo.',
      /* aviso ao lançar afastamento sobre um dia coberto por troca aprovada; datas = lista já formatada */
      confirmarTroca: function (datas) { return 'Este militar cobre serviço por troca em ' + datas + '. Se você lançar o afastamento, ele deixa de assumir esse serviço, e a escala vai marcá-lo em amarelo. Continuar?'; }
    },

    /* ajustes — painel do ritmo da unidade (o Salvar pergunta a data a partir da qual o ritmo vale) */
    ajustes: {
      efeitoRitmo: 'A escala automática dos militares da unidade é regerada a partir da data que você escolher ao salvar.'
    },

    /* escalas (painel da distribuição e grade do mês) */
    escala: {
      falhaCarregar: 'Não foi possível carregar.',
      falhaCarregarMes: 'Não foi possível carregar a escala.',
      descartarAlteracoes: 'Descartar as alterações não salvas desta distribuição?',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      /* catálogo de erros/avisos da distribuição na escala — o aviso-lista do topo mostra uma linha
         [ícone + texto] por item presente; nivel 'erro' (vermelho) ou 'alerta' (amarelo) */
      erros: {
        foraDisponibilidade: { texto: 'Funções fora da disponibilidade', icone: 'icone-alerta', nivel: 'erro' },
        semServico:          { texto: 'Militar sem serviço no dia',        icone: 'icone-alerta', nivel: 'erro' },
        sobreposicao:        { texto: 'Dois militares no mesmo horário',    icone: 'icone-alerta', nivel: 'erro' },
        faltaModelo:         { texto: 'Falta modelo de distribuição',       icone: 'icone-alerta', nivel: 'erro' },
        distribuicaoTravada: { texto: 'Distribuição com erro, corrija a distribuição', icone: 'icone-alerta', nivel: 'erro' },
        grauRebaixado:       { texto: 'Grau rebaixado por falta de efetivo',  icone: 'icone-alerta', nivel: 'alerta' },
        grauExclusivo:       { texto: 'Grau diferente do ideal (função exclusiva)', icone: 'icone-alerta', nivel: 'alerta' },
        rodizioRepetido:     { texto: 'Rodízio repetido por falta de opção',   icone: 'icone-alerta', nivel: 'alerta' },
        resolvaEscala:       { texto: 'Sem solução automática, precisa de ação do administrador', icone: 'icone-alerta', nivel: 'erro' },
        exclusivoCondutor:   { texto: 'Condutor exclusivo indisponível, motorista substituído', icone: 'icone-alerta', nivel: 'alerta' },
        chefeCondutor:       { texto: 'Chefe assumiu a direção por falta de condutor', icone: 'icone-alerta', nivel: 'alerta' },
        afastadoTroca:       { texto: 'Militar afastado, não vai assumir o serviço', icone: 'icone-alerta', nivel: 'alerta' },
        semCondutor:         { texto: 'Viatura sem condutor', icone: 'icone-alerta', nivel: 'erro' },
        /* efetivo do posto fora dos limites (uma linha por posto); {faixas} = ", das 20:00 às 08:00" quando é só parte do dia */
        abaixoMinimo:        { texto: 'Efetivo abaixo do mínimo: {posto} ({pessoas} de {minimo}){faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'erro' },
        acimaMaximo:         { texto: 'Efetivo acima do máximo: {posto} ({pessoas} de {maximo})', icone: 'icone-alerta', nivel: 'erro' },
        /* militar de serviço sem função ({n} = quantidade; o painel escolhe singular ou plural) */
        semFuncao:           { texto: 'Militar sem função definida', textoPlural: '{n} militares sem função definida', icone: 'icone-alerta', nivel: 'erro' },
        /* regras e habilitação, conferidas em toda colocação (automática ou manual); {militar} = grad + nome */
        cnhIncompativel:     { texto: 'Condutor sem a CNH exigida: {militar} em {posto}', icone: 'icone-alerta', nivel: 'erro' },
        regraProibida:       { texto: 'Função proibida pela regra: {militar} em {funcao}', icone: 'icone-alerta', nivel: 'erro' },
        exclusivoFora:       { texto: 'Militar exclusivo fora da sua função: {militar} em {funcao}', icone: 'icone-alerta', nivel: 'alerta' },
        grauDiferente:       { texto: 'Grau diferente do ideal: {militar} em {funcao}', icone: 'icone-alerta', nivel: 'alerta' },
        manutencao:          { texto: 'Viatura em manutenção: {posto}', icone: 'icone-alerta', nivel: 'alerta' },
        /* o mesmo militar em funções de duas unidades no mesmo horário; {unidades} = "2ºPEL e 1ºPEL" (a dele primeiro);
           {faixas} = ", das 08:00 às 20:00" quando é só parte do dia */
        duasUnidades:        { texto: '{militar} está em duas unidades diferentes ao mesmo tempo ({unidades}){faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'erro' }
      },
      /* detalhe por militar dos avisos amarelos (expansível sob cada linha do aviso):
         {pessoa} = grad + nome · {funcao} = nome da vaga · {motivo} = a razão (abaixo) */
      avisoDetalhe: {
        linha:           '{pessoa} está de {funcao}, {motivo}',
        motivoGrau:      'faltou {grau}',
        grauMaisAntigo:  '{grau} ou mais antigo',
        grauMaisModerno: '{grau} ou mais moderno',
        motivoExclusivoGrau: 'é o exclusivo dessa função (ideal {grau})',
        motivoRodizio:   'repetiu a função do último serviço',
        motivoExclusivo: 'assumiu no lugar do condutor exclusivo',
        motivoAfastado:  'mas está afastado (férias, licença ou dispensa) e não vai assumir'
      },
      /* dica do ícone de regra na linha do militar (uma regra por linha, via \n) */
      regra: {
        exclusivo: 'Exclusivo: {funcao}',
        proibido:  'Proibido: {funcao}'
      },
      buscaVazia: 'Nenhum militar encontrado.',
      /* aba Ciclo (seção dos contínuos) do painel do dia */
      continuosNaEscala: 'Contínuos do dia',
      continuosFora: 'Fora da escala',
      continuosVazioNaEscala: 'Nenhum contínuo nesse dia.',
      continuosVazioFora: 'Todos os militares já estão no ciclo.',
      continuosSaiEm: 'Sai em {data}',
      continuosDeFolga: 'De folga neste dia',
      continuosVaiEntrar: 'Vai entrar',
      continuosVaiSair: 'Vai sair',
      continuosVaiCancelar: 'Vai cancelar a saída',
      continuosDesfazer: 'Desfazer',
      btnTirar: 'Tirar',
      btnAdicionar: 'Adicionar',
      btnCancelarSaida: 'Cancelar saída',
      confirmarTirar: 'Tirar {pessoa} do ciclo a partir de {data}? O que vai acontecer:',
      /* o Dia (lista, formulário Quem · Quando · Onde e militar no dia) */
      deFolga: 'De folga',
      semFuncaoRotulo: 'Sem função',
      vazioEscolher: 'Vazio, escolher',
      semNinguem: 'Sem ninguém, escolher',
      semNinguemTexto: 'Sem ninguém',
      /* dia sem ninguém de serviço na unidade */
      semDistribuicao: 'Sem distribuição neste dia.',
      alteracoesNaoSalvas: function (n) { return n === 1 ? '1 alteração não salva' : n + ' alterações não salvas'; },
      /* "Condutor da AA-01", "Rancheiro do Rancho" */
      funcaoNoPosto: function (funcao, posto, feminino) { return funcao + (feminino ? ' da ' : ' do ') + posto; },
      dasAs: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
      formAdicionar: 'Adicionar militar ao dia',
      formPreencher: function (lugar) { return 'Quem fica no ' + lugar; },
      formNovaFuncao: function (militar) { return 'Nova função para o ' + militar; },
      formHoje: function (texto) { return 'Hoje: ' + texto; },
      formBotaoAdicionar: 'Adicionar ao dia',
      formBotaoAplicar: 'Aplicar',
      formBotaoNovaFuncao: 'Adicionar função',
      semFuncaoNoDia: 'sem função',
      semFuncaoDas: function (periodos) { return 'sem função ' + periodos; },
      ninguemEncontrado: 'Ninguém encontrado.',
      novaFuncao: function (nome) { return 'Nova função: ' + nome; },
      /* situação da função no horário (lista de funções do formulário) */
      itemVazia: 'vazia',
      itemSai: function (nomes) { return nomes.join(' e ') + (nomes.length > 1 ? ' saem' : ' sai'); },
      /* a Nova função num horário em que ele já tem função: ele acumula (para deixar uma, desmarca-se na tela do militar) */
      vaiAcumular: function (lugares) {
        var lista = lugares.map(function (l) { return 'no ' + l; });
        var texto = lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : lista[0];
        return 'Nesse horário ele também está ' + texto + ' e vai acumular. Para deixar '
          + (lugares.length > 1 ? 'uma delas' : 'essa função') + ', desmarque na tela do militar.';
      },
      /* militar no dia: a função desmarcada (ele deixa) */
      semHorarioLivre: 'O serviço dele já está todo nesta função. Diminua um horário antes de adicionar outro.',
      militarDeixa: function (lugar, periodos) { return 'Deixa esta função: o ' + lugar + ' fica vazio ' + (periodos || 'o dia todo') + '.'; },
      /* o efeito da escolha numa frase: "Sd. Godoy fica sem função das 14h às 20h, e o Sd. Tavares fica sem função das 08h às 14h." */
      avisoSemFuncao: function (militar, hi, hf) { return militar + ' fica sem função das ' + hi + ' às ' + hf; },
      avisoEfeito: function (partes) {
        var t = partes.length > 1 ? partes.slice(0, -1).join(', ') + ', e ' + partes[partes.length - 1] : partes[0];
        return t.charAt(0).toUpperCase() + t.slice(1) + '.';
      },
      /* Chefe de Socorro e Oficial de Área: o mais antigo assume sozinho */
      assumeChefe: function (militar, atual) {
        return militar + ' é a praça mais antiga do dia: assume o Chefe de Socorro automaticamente nesse horário.'
          + (atual ? ' ' + atual + ' deixa de ser o Chefe.' : '');
      },
      assumeOficial: function (militar, atual) {
        return militar + ' é o oficial mais antigo do dia: assume o Oficial de Área automaticamente nesse horário.'
          + (atual ? ' ' + atual + ' deixa de ser o Oficial de Área.' : '');
      },
      assumePapel: function (militar, lugar, periodos, antigos) {
        return militar + ' assume o ' + lugar + (periodos ? ' ' + periodos : '') + (antigos ? ', no lugar do ' + antigos : '') + '.';
      },
      formErroQuem: 'Escolha o militar.',
      formErroOnde: 'Escolha o posto e a função.',
      formErroMesmaFuncao: 'O militar já está nessa função nesse horário.',
      formErroPeriodos: 'Os períodos se cruzam. Ajuste os horários.',
      servico: function (hi, hf, origem) {
        var por = { pontual: ', pontual', troca: ', por troca', extra: ', de extrajornada' }[origem] || ', pelo ciclo';
        return 'De serviço das ' + hi + ' às ' + hf + por;
      },
      semServicoNoDia: 'Sem serviço neste dia.',
      folgaSiMesmo: 'Você não pode dar folga a si mesmo.',
      /* modal do banco de horas (Contabilizar · Não contabilizar · Cancelar) */
      contabilizarPontual: function (militar, horas, data) {
        return 'O ' + militar + ' vai trabalhar ' + horas + ' a mais em ' + data + '. Contabilizar +' + horas + ' no banco de horas dele?';
      },
      contabilizarTirarPontual: function (militar, horas) {
        return 'Este pontual somou +' + horas + ' ao banco de horas do ' + militar + '. Contabilizar −' + horas + ' para desfazer?';
      },
      /* aba Extrajornada do painel do dia */
      extraDoDia: 'Extrajornada do dia',
      extraVazio: 'Ninguém de extrajornada neste dia.',
      falhaAcaoCiclo: 'Não foi possível alterar o ciclo. Tente de novo.',
      emManutencao: 'Em manutenção',
      /* linha da cadeira vazia (sem ninguém), no lugar do nome do militar */
      vagaVazia: function (motivo) { return motivo === 'trava' ? 'Sem solução automática' : (motivo === 'habilitado' ? 'Vazio por falta de habilitado' : 'Vazio por falta de efetivo'); },
      /* dica do ícone do militar de outra unidade: "Do 2ºPEL" / "Da 2ªCIBM" */
      deOutraUnidade: function (nome) { return (/ª/.test(nome || '') ? 'Da ' : 'Do ') + (nome || ''); },
      /* Observações do dia (trocas, folgas, outra unidade) — o banco manda os dados, aqui vira texto */
      observacoesTitulo: 'Observações',
      observacaoLimite: 200,
      observacaoTexto: function (o) {
        function hh(t) { return t ? (String(t).slice(3) === '00' ? String(t).slice(0, 2) + 'h' : t) : ''; }
        function quem(g, n) { return ((g ? g + ' ' : '') + (n || '')).trim(); }
        if (o.classe === 'admin') return o.texto || '';
        if (o.classe === 'outra_unidade') {
          var de = (/ª/.test(o.de_unidade || '') ? 'da ' : 'do ') + (o.de_unidade || '');
          if (o.hi === o.hf) return quem(o.grad, o.nome) + ' veio ' + de + '.';
          return quem(o.grad, o.nome) + ' veio ' + de + ' das ' + hh(o.hi) + ' às ' + hh(o.hf) + '.';
        }
        if (o.classe === 'folga') {
          if (o.dia_inteiro || o.hi === o.hf) return quem(o.grad, o.nome) + ' está de folga o dia todo.';
          return quem(o.grad, o.nome) + ' está de folga das ' + hh(o.hi) + ' às ' + hh(o.hf) + '.';
        }
        var base = quem(o.cobre_grad, o.cobre_nome) + ' trocou o serviço com ' + quem(o.saiu_grad, o.saiu_nome)
                 + ' das ' + hh(o.hi) + ' às ' + hh(o.hf) + '.';
        if (o.tipo === 'devolucao') return base + ' (Devolução da troca de ' + (o.orig_data || '') + '.)';
        if (o.dev_pendente) return base + ' Devolução: a definir.';
        return base + ' Devolução: ' + (o.dev_data || '') + ' das ' + hh(o.dev_hi) + ' às ' + hh(o.dev_hf) + '.';
      },
      /* Imprimir escala (painel → PDF; escalas-impressao.js e escalas-impressao-pdf.js) */
      impressao: {
        titulo: 'Imprimir escala',
        subtitulo: 'Arquivo em PDF',
        dataInvalida: 'Data inválida.',
        fimAntesInicio: 'A data final não pode ser antes da inicial.',
        limiteDias: 'Escolha até 31 dias por arquivo.',
        resumo: function (dias, unidades) {
          return dias + (dias === 1 ? ' dia' : ' dias') + ' · ' + unidades + (unidades === 1 ? ' unidade' : ' unidades');
        },
        /* aviso do painel quando algum dia do período tem erro grave (vermelho) */
        avisoTitulo: function (n) { return n === 1 ? 'Erro grave em 1 dia do período' : 'Erro grave em ' + n + ' dias do período'; },
        avisoDescricao: function (lista) { return lista + '. O PDF sai do jeito que está na escala.'; },
        falhaGerar: 'Não foi possível gerar o PDF. Tente de novo.',
        /* textos de dentro do PDF */
        pdf: {
          titulo: 'Escala de serviço',
          observacoes: 'Observações',
          semFuncao: 'Sem função definida',
          semDistribuicao: 'Sem distribuição neste dia.',
          continuacao: '(continuação)',
          site: 'www.rosterwork.com',
          pagina: function (n, total) { return 'Página ' + n + ' de ' + total; },
          deServico: function (ritmo, n) { return (ritmo ? ritmo + ' · ' : '') + n + ' de serviço'; },
          arquivo: function (periodo, unidade) { return 'Escala ' + (unidade ? unidade + ' ' : '') + periodo + '.pdf'; }
        }
      }
    },

    /* distribuição (aba Modelos — painel, corpo e rodapé de status) */
    distribuicao: {
      selecioneUnidade: 'Selecione pelo menos uma CIA, uma CIBM ou um PEL.',
      semModelos: 'Nenhum modelo cadastrado para esta unidade.',
      selecioneModelo: 'Selecione um modelo à esquerda para ver as vagas.',
      modeloVazio: 'Este modelo ainda não tem vagas.',
      falhaCarregar: 'Não foi possível carregar os modelos.',
      falhaCarregarRegras: 'Não foi possível carregar as regras.',
      faltaVagas: function (unidade, n, total, tipo) { return unidade + ': ' + n + ' de ' + total + ' ' + tipo + ' distribuídos'; },
      excessoVagas: function (unidade, vagas, total, tipo) { return unidade + ': ' + vagas + ' vagas para ' + total + ' ' + tipo + ' (vagas a mais)'; },
      vagaSemCriterio: function (unidade, posto) { return unidade + ': preencha antiguidade ou grau em ' + posto; },
      semPapel: function (unidade, papel) { return unidade + ' sem ' + papel + ' alocado'; },
      tudoCerto: function (unidades) { return unidades + ' com todos os militares distribuídos corretamente'; },
      descartar: 'Descartar as alterações não salvas deste modelo?',
      salvarComErro: 'Este modelo ainda tem erros (em vermelho). Salvar mesmo assim?',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      composicaoVazia: 'Defina pelo menos um militar.',
      modeloJaExiste: function (unidade) { return unidade + ' já tem um modelo com essa composição. Ele foi aberto.'; },
      /* dicas do lápis e da lixeira da linha do modelo, quando inativos */
      periodoSoLeitura: 'Período encerrado, só leitura.',
      modeloEmEdicao: 'Este modelo já está em edição.',
      excluirModelo: 'Excluir este modelo de distribuição? As vagas que ele define serão perdidas.',
      abaixoMinimo: function (unidade, posto, pessoas, minimo) { return unidade + ': efetivo abaixo do mínimo em ' + posto + ' (' + pessoas + ' de ' + minimo + ')'; },
      salvarImpacto: 'Salvar este modelo recalcula as escalas já distribuídas que usam esta composição. Continuar?',
      /* períodos (seletor ‹ período ›): cada mudança de posto com data abre um período novo */
      periodoTodos: 'Todos os dias',
      periodoAte: 'até {data}',
      periodoDesde: 'a partir de {data}',
      periodoIntervalo: '{inicio} a {fim}',
      periodoIntervaloFrase: 'de {inicio} a {fim}',
      revisarPeriodo: function (unidade, motivo) { return unidade + ': revise este período' + (motivo ? ' (' + motivo + ')' : ''); },
      /* salvou um período e a mudança não chegou aos seguintes, que já tinham sido revisados */
      naoAtualizados: function (periodos) {
        if (periodos.length === 1) return 'Esta mudança não vale no período ' + periodos[0] + ', que já foi revisado. Ajuste-o também, se precisar.';
        return 'Esta mudança não vale nos períodos ' + periodos.slice(0, -1).join(', ') + ' e ' + periodos[periodos.length - 1] + ', que já foram revisados. Ajuste-os também, se precisar.';
      }
    },

    /* saída do militar da escala (transferência, Tirar do ciclo e baixa): a lista do aviso,
       um item por troca, folga e extra que a saída cancela (montada em RosterWork.avisoSaida) */
    saida: {
      tituloEscala: 'Escala',
      tituloTroca: 'Troca',
      tituloFolga: 'Folga',
      tituloExtra: 'Extra',
      tituloCotas: 'Cotas',
      escalaTransferencia: function (origem, destino) {
        return 'Sai da escala ' + (origem ? 'd' + artigo(origem) + ' ' + origem + ' ' : '') +
          'nessa data e fica disponível para ser escalado n' + artigo(destino) + ' ' + destino + '.';
      },
      escalaTirar: 'Deixa de aparecer na escala automática daqui em diante.',
      escalaBaixa: 'Fica inativo nessa data, sai da escala e pode ser readmitido depois.',
      /* "Com Sd. Sampaio, serviço de 30/10/2026 (aguardando aprovação): será cancelada." */
      trocaCancelada: function (com, servico, devolucao, situacao) {
        return 'Com ' + com + ', serviço de ' + servico + (devolucao ? ' e devolução de ' + devolucao : '') +
          (situacao ? ' (' + situacao + ')' : '') + ': será cancelada.';
      },
      /* uma parte já aconteceu: só a outra sai, e fica o saldo */
      trocaParte: function (com, dias, parte, diaParte, horas, devedor, credor) {
        return 'Com ' + com + ', de ' + dias + ': ' + (parte === 'devolucao' ? 'a devolução' : 'o serviço') + ' de ' +
          diaParte + ' sai, e fica um saldo de ' + horas + ': o ' + devedor + ' deve ao ' + credor + '.';
      },
      folgaCancelada: function (dia, situacao, horasDeVolta) {
        return 'De ' + dia + (situacao ? ' (' + situacao + ')' : '') + ': será cancelada' +
          (horasDeVolta ? ', e as ' + horasDeVolta + ' voltam ao saldo' : '') + '.';
      },
      extraSai: function (dia, unidade, cotasContinuam) {
        return 'De ' + dia + (unidade ? ' n' + artigo(unidade) + ' ' + unidade : '') + ': sai' +
          (cotasContinuam ? ', e as cotas dele continuam.' : '.');
      },
      cotasBaixa: function (mesAno) { return 'Se estiver disponível para extra, sai da divisão das cotas a partir de ' + mesAno + '.'; },
      notaTransferencia: 'As trocas, folgas e extras canceladas não voltam, mesmo que a transferência seja cancelada depois.',
      notaTirar: 'As trocas, folgas e extras canceladas não voltam, mesmo que ele volte ao ciclo depois.',
      notaBaixa: 'As trocas, folgas e extras canceladas não voltam, mesmo que ele seja readmitido depois.',
      /* a lista não carregou: sem ela, a saída não é feita */
      falhaLista: 'Não foi possível conferir as trocas, folgas e extras deste militar. Tente de novo.'
    },

    /* usuários (ficha do militar no painel lateral) */
    usuarios: {
      falhaFicha: 'Não foi possível carregar a ficha.',
      confirmarBaixa: 'Dar baixa em {pessoa} (CPF {cpf}) a partir de {data}? O que vai acontecer:',
      falhaBaixa: 'Não foi possível dar baixa. Tente de novo.',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      confirmarTransferencia: function (pessoa, origem, destino, data) {
        return 'Transferir ' + pessoa + (origem ? ' d' + artigo(origem) + ' ' + origem : '') +
          ' para ' + artigo(destino) + ' ' + destino + ' a partir de ' + data + '? O que vai acontecer:';
      },
      falhaTransferencia: 'Não foi possível transferir. Tente de novo.',
      dataFutura: 'A data não pode ser futura.',
      confirmarPromocao: 'Promover {pessoa} a {grau} em {data}?',
      promocaoDataAnterior: 'A data deve ser posterior à última promoção (ou à inclusão no quadro).',
      topoCarreira: 'Já está no topo desta carreira.',
      promocaoTipoInvalida: 'Essa mudança de tipo rebaixaria o militar, não é uma promoção.',
      postoAtualDesconhecido: 'Não foi possível identificar o posto atual deste militar.',
      falhaPromocao: 'Não foi possível promover. Tente de novo.',
      confirmarReadmissao: 'Readmitir {pessoa} ao efetivo? Ele volta como ativo, fora da escala automática (você o recoloca pela aba Ciclo da Escala).',
      falhaReadmissao: 'Não foi possível readmitir. Tente de novo.',
      /* selo único do card na lista (a situação do militar e, para o administrador, a da conta) */
      seloAtivo: 'Ativo',
      seloInativo: 'Inativo',
      seloInativoDesde: function (data) { return 'Inativo desde ' + data; },
      seloAfastadoAte: function (situacao, data) { return situacao + ' até ' + data; },
      seloLinkCadastro: function (ate) { return 'Link de cadastro até ' + ate; },
      seloSemConta: 'Sem conta',
      /* seção "Acesso ao sistema" da ficha: o link que o administrador manda no privado do militar */
      acessoSemConta: 'Este militar ainda não tem conta. Gere o link de cadastro e envie a ele.',
      acessoComConta: 'Se o militar esqueceu a senha, confirme que o pedido é mesmo dele e gere o link de nova senha.',
      linkCadastroAtivo: 'Link de cadastro ativo até {ate}. Envie a mensagem no privado do militar, nunca em grupo. O link vale uma vez.',
      linkSenhaAtivo: 'Link de nova senha ativo até {ate}. Envie a mensagem no privado do militar, nunca em grupo. O link vale uma vez.',
      mensagemCadastro: function (nome, link, data, hora) {
        return 'Roster Work: link de cadastro para ' + nome + '.\n\n' +
          'Abra o link para criar a sua senha e conferir os seus dados:\n' + link + '\n\n' +
          'O link é pessoal, vale uma vez e expira em ' + data + ' às ' + hora + '. Não repasse.';
      },
      mensagemSenha: function (nome, link, data, hora) {
        return 'Roster Work: link de nova senha para ' + nome + '.\n\n' +
          'Abra o link para criar a sua nova senha:\n' + link + '\n\n' +
          'O link é pessoal, vale uma vez e expira em ' + data + ' às ' + hora + '. Não repasse.';
      },
      confirmarCancelarLink: 'Cancelar o link? Ele deixa de funcionar na hora.',
      falhaLink: 'Não foi possível gerar o link. Tente de novo.',
      falhaCancelarLink: 'Não foi possível cancelar o link. Tente de novo.',
      falhaCopiar: 'Não foi possível copiar. Selecione a mensagem e copie manualmente.'
    },

    /* análise de impacto na escala — componente compartilhado (geral-impacto), usado por Trocas e Folgas */
    /* Pendências (o que espera decisão: Para mim · Administração) */
    pendencias: {
      contagem: function (n) { return n === 1 ? '1 esperando decisão' : n + ' esperando decisão'; },
      /* o cartão de cada pedido: quem e o quê, e a linha de apoio */
      trocaAdmin: function (sol, par) { return sol + ' troca com ' + par; },
      trocaMinha: function (sol) { return sol + ' quer trocar com você'; },
      folga: function (nome) { return nome + ' pediu folga'; },
      dados: function (nome) { return nome + ' pediu correção de dados'; },
      metaServico: function (data, trecho) { return 'Serviço de ' + data + ' · ' + trecho; },
      servicoInteiro: 'serviço inteiro',
      trechoHoras: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
      metaDados: function (n, data) { return (n === 1 ? '1 alteração' : n + ' alterações') + ' · pedido em ' + data; },
      /* listas sem nada (página Pendências) */
      vazioMinhas: 'Nenhum pedido esperando a sua resposta.',
      vazioAprovar: 'Nenhum pedido para aprovar.',
      vazioFiltro: 'Nenhum pedido deste tipo para aprovar.',
      vazioCorrigir: 'Nada para corrigir.',
      /* listas sem nada (as abas Pendências da Trocas, da Folgas e da Usuários) */
      vazioTrocasMinhas: 'Nenhum pedido de troca esperando a sua resposta.',
      vazioTrocasAprovar: 'Nenhum pedido de troca para aprovar.',
      vazioFolgas: 'Nenhum pedido de folga para aprovar.',
      vazioUsuarios: 'Nenhum pedido de correção para aprovar.',
      falhaCarregar: 'Não foi possível carregar as pendências.'
    },

    /* painel de decisão (Trocas e Folgas): a posição do pedido na fila da Pendências */
    decisao: {
      posicao: function (situacao, n, total) { return situacao + ' · ' + n + ' de ' + total; },
      /* o pelotão no espaço pequeno ao lado do título do painel ("- 2ºPEL", "- 1ºPEL e 2ºPEL") */
      tituloPelotao: function (lista) { return lista && lista.length ? '- ' + lista.join(' e ') : ''; },
      /* o "Como fica a escala" (seção que abre e fecha) */
      comoFicaEscala: 'Como fica a escala',
      diaTitulo: function (titulo, data, unidade) { return [titulo, data, unidade].filter(Boolean).join(' · '); },
      semEscala: 'Não há escala para mostrar neste dia.',
      falhaEscala: 'Não foi possível montar a escala. Feche e abra de novo para tentar outra vez.'
    },

    impacto: {
      okFrase: 'Sem impacto na escala.',
      /* o selo do resultado nos cartões da Pendências */
      seloOk: 'Sem impacto',
      seloAlerta: function (n) { return n === 1 ? '1 ponto de atenção' : n + ' pontos de atenção'; },
      seloProblema: function (n) { return n === 1 ? '1 problema' : n + ' problemas'; }
    },

    /* trocas (lista por abas, painel de detalhe + análise de impacto) */
    trocas: {
      falhaCarregar: 'Não foi possível carregar as trocas.',
      falhaAnalise: 'Não foi possível analisar o impacto desta troca.',
      semUnidade: 'Selecione uma unidade no topo para ver as trocas.',
      analiseVazia: 'Sem análise para esta troca.',
      /* vazio por aba (cada lista sem itens) */
      vazio: {
        'minhas': 'Você ainda não participa de nenhuma troca.',
        'todas': 'Nenhuma troca registrada nesta unidade.',
        'pendentes': 'Nenhuma devolução pendente.'
      },
      /* selo de situação (por status da troca) */
      situacao: {
        pendente_confirmacao: 'Aguardando confirmação',
        pendente_aprovacao: 'Aguardando aprovação',
        aprovada: 'Aprovada',
        rejeitada_parceiro: 'Recusada',
        rejeitada_admin: 'Recusada pela administração',
        cancelada: 'Cancelada'
      },
      /* painel da troca (componente geral-decisao) */
      painelTitulo: 'Troca de serviço',
      caixaServico: 'Serviço',
      caixaDevolucao: 'Devolução',
      fraseNoLugar: function (quemTrabalha, quemFolga) { return quemTrabalha + ' trabalha no lugar do ' + quemFolga + '.'; },
      devolucaoNaoMarcada: 'Ainda não marcada.',
      /* meta da linha na lista */
      metaServico: function (dataCurta) { return 'Serviço ' + dataCurta; },
      meta24h: '24h',
      metaParcial: 'trecho',
      metaDevolve: function (dataCurta) { return 'devolve ' + dataCurta; },
      /* aba Pendências (saldo líquido de horas por par) */
      pendVoceDeve: 'Você deve',
      pendDevemVoce: 'Devem a você',
      pendHoras: function (h) { return h + 'h'; },
      /* confirmações antes de cada ação */
      confirmarAceitar: 'Aceitar esta troca? Ela seguirá para aprovação do administrador.',
      confirmarAprovar: 'Aprovar esta troca? A escala será atualizada na hora.',
      confirmarAprovarComProblema: 'A análise apontou problemas que podem quebrar a escala. Aprovar mesmo assim?',
      confirmarForcar: 'Aprovar sem a confirmação do solicitado? A troca é aplicada na escala na hora.',
      confirmarCancelar: 'Cancelar esta troca?',
      falhaAcao: 'Não foi possível concluir. Tente de novo.',
      /* título do painel lateral de solicitar */
      tituloPainel: 'Solicitar troca',
      /* Nova troca — validações */
      novaParceiro: 'Selecione o parceiro.',
      novaData: 'Selecione o dia do seu serviço.',
      novaMesmaPessoa: 'Você não pode trocar com você mesmo.',
      novaServicoVazio: 'O horário da troca precisa ficar dentro do serviço.',
      novaDevolucaoVazia: 'O horário da devolução precisa ficar dentro do serviço do parceiro.',
      /* estados dos campos */
      parceiroOcupado: 'já de serviço nesse horário',
      /* afastado no dia (a chave é o afastamento que o banco devolve) */
      parceiroAfastado: { 'Férias': 'de férias nesse dia', 'Licença': 'de licença nesse dia', 'Dispensa': 'de dispensa nesse dia' },
      modalUnidadeAntes: 'Selecione a unidade antes',
      modalDiaAntes: 'Escolha o dia antes',
      modalParceiroAntes: 'Selecione o parceiro antes',
      modalSelecione: 'Selecione',
      modalEscolherDia: 'Escolher dia',
      modalCarregando: 'Carregando…',
      modalParceiroVazio: 'Nenhum militar disponível nesta unidade',
      modalFiltroVazio: 'Nenhum militar encontrado',
      modalCarregarFalha: 'Não foi possível carregar',
      modalSemServico: 'Você não tem serviço futuro para trocar',
      modalDevPendente: 'Deixar pendente',
      modalDevAjuda: 'Escolha um dia do parceiro, ou deixe pendente.',
      /* aviso de saldo (quando as durações diferem) */
      saldoParceiroDeve: function (h) { return 'O parceiro fica devendo ' + h + 'h a você.'; },
      saldoVoceDeve: function (h) { return 'Você fica devendo ' + h + 'h ao parceiro.'; },
      saldoQuite: 'Com esta troca, vocês ficam sem dívida de horas.',
      /* aba Pendentes: dica do card + painel de extrato */
      pendResumo: function (n) { return n === 1 ? '1 troca entre vocês' : n + ' trocas entre vocês'; },
      pendenciaTitulo: 'Dívida de horas',
      pendenciaSubtitulo: function (devedor, horas, credor) { return devedor + ' deve ' + horas + ' a ' + credor; },
      extratoMais: 'Ver mais',
      extratoVazio: 'Sem trocas aprovadas entre vocês.',
      extratoFalha: 'Não foi possível carregar o histórico.'
    },

    /* folgas (banco de horas: placar, solicitações, lançamentos e gaveta) */
    folgas: {
      semUnidade: 'Selecione uma unidade no topo para ver os saldos.',
      falhaCarregar: 'Não foi possível carregar as folgas.',
      falhaExtrato: 'Não foi possível carregar o extrato.',
      vazioSaldos: 'Nenhum militar nas unidades selecionadas.',
      vazioLancamentos: 'Nenhuma folga registrada no período.',
      extratoVazio: 'Sem lançamentos ainda.',
      pickerVazio: 'Selecione unidades no topo para escolher o militar.',
      buscaVazia: 'Nenhum militar encontrado.',
      situacao: { pendente: 'Pendente', aprovada: 'Aprovada', concedida: 'Concedida', recusada: 'Recusada', cancelada: 'Cancelada' },
      origemAjuste: 'Ajuste do admin',
      origemPontual: 'Serviço a mais na escala',
      naoContabilizada: 'Não contabilizada',
      /* modal do banco de horas ao conceder folga (Contabilizar · Não contabilizar · Cancelar) */
      contabilizarFolga: function (militar, data, periodo, horas, passado) {
        return 'Dar folga ao ' + militar + ' em ' + data + ', ' + periodo + '.'
          + (passado ? ' Esse dia já passou: a escala dele será refeita.' : '')
          + ' Contabilizar −' + horas + ' no banco de horas dele?';
      },
      periodoDas: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
      horasExtenso: function (h) { return h + (h === 1 ? ' hora' : ' horas'); },
      pendenteNaoConta: 'não conta no saldo até aprovar',
      diaInteiro: 'Dia inteiro',
      /* formulários (sub-tela): o saldo no alto, o serviço do dia, o consumo da folga e o saldo depois do ajuste */
      saldoAtual: function (saldo) { return 'Saldo atual: ' + saldo; },
      deServico: function (hi, hf) { return 'De serviço das ' + hi + ' às ' + hf; },
      consumoSaldo: function (horas, saldo) { return 'Consome ' + horas + ' do banco de horas. O saldo fica em ' + saldo + '.'; },
      saldoPassa: function (de, para) { return 'O saldo passa de ' + de + ' para ' + para + '.'; },
      porNome: function (nome) { return 'por ' + nome; },
      acaoSolicitar: 'Solicitar folga',
      acaoConceder: 'Conceder folga',
      acaoDar: 'Dar folga',
      acaoAjuste: 'Ajustar saldo',
      botaoSolicitar: 'Solicitar',
      botaoConceder: 'Conceder folga',
      botaoDar: 'Dar folga',
      botaoAjuste: 'Salvar ajuste',
      formMilitar: 'Selecione o militar.',
      formData: 'Escolha o dia da folga.',
      formPeriodo: 'O horário da folga precisa ficar dentro do serviço.',
      formHoras: 'Informe as horas do crédito.',
      formHorasInvalida: 'Horas inválidas.',
      formMotivo: 'Informe o motivo do ajuste.',
      confirmarAprovar: 'Aprovar esta folga? O saldo do militar será atualizado.',
      confirmarAprovarComProblema: 'A análise apontou problemas que podem quebrar a escala. Aprovar mesmo assim?',
      confirmarCancelar: 'Cancelar esta folga? O militar volta ao serviço na escala e, se ela foi contabilizada, as horas voltam ao saldo.',
      confirmarCancelarPendente: 'Cancelar esta solicitação de folga?',
      falhaAcao: 'Não foi possível concluir. Tente de novo.',
      /* painel de aprovação (componente geral-decisao) */
      painelFolga: 'Folga',
      painelPendente: 'Aguardando aprovação',
      caixaFolga: 'Folga',
      fraseFolgaInteira: function (nome) { return nome + ' folga no serviço inteiro.'; },
      fraseFolgaParte: function (nome, hi, hf) { return nome + ' folga das ' + hi + ' às ' + hf + '.'; },
      motivoPedido: function (motivo) { return 'Motivo: ' + motivo; },
      falhaAnalise: 'Não foi possível analisar o impacto.'
    },

    /* extrajornada (cotas de hora extra) */
    extrajornada: {
      disponibilidadeSalva: 'Disponibilidade salva.',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      /* dica do dia bloqueado no calendário (o militar já está ocupado, não pode marcar) */
      bloqueadoMotivo: { servico: 'Serviço', troca: 'Troca', folga: 'Folga', ferias: 'Férias', licenca: 'Licença', dispensa: 'Dispensa' },
      quero: 'Quero',
      naoQuero: 'Não quero',
      procuraTotal: 'Total',
      minDatas: function (n) { return 'Marque pelo menos ' + n + ' data(s) em cada coluna (quero e não quero).'; },
      ambosCheios: 'As duas colunas já têm 10 datas.',
      queroCheio: '"Datas que quero" já tem 10, este dia foi para "não quero".',
      naoCheio: '"Datas que não quero" já tem 10 datas.',
      marqueSim: 'Marque "Sim" em "Sou voluntário" para escolher suas cotas e dias.',
      /* janela de edição da disponibilidade (só o próximo mês, até o dia 25) */
      janelaAberta: function (ini, fim) { return 'Alterações permitidas de ' + ini + ' a ' + fim + '.'; },
      janelaEncerrada: function (fim, abre) { return 'Prazo encerrado em ' + fim + '. A próxima declaração abre em ' + abre + '.'; },
      mesEncerrado: 'Mês encerrado, apenas visualização.',
      naoFoiVoluntario: 'Você não foi voluntário neste mês.',
      semDeclaracao: 'Sem declaração de disponibilidade neste mês.',
      prazoEncerrado: 'O prazo para declarar a disponibilidade deste mês está encerrado.',
      resumoRecebeu: function (n) { return 'Você recebeu ' + n + (n === 1 ? ' cota' : ' cotas') + ' neste mês.'; },
      cotasSalvas: 'Cotas repartidas.',
      semCotasMudanca: 'Nenhuma cota foi alterada.',
      semVoluntarios: 'Nenhum voluntário declarou disponibilidade neste mês.',
      falhaCotas: 'Não foi possível carregar as cotas.',
      cotaNoLimite: 'Este militar já atingiu o limite de cotas.',
      fecha24Dica: 'Fecha 24 h, turno fixo (não editável).',
      removerAbreFuro: 'Remover este extra pode deixar um furo na escala.',
      removerMesmoAssim: 'Remover mesmo assim',
      cotaMenor: 'O número de cotas ficou menor do que o que já foi colocado no calendário. Tire alguns extras antes de reduzir o total.',
      cotaEstourada: 'Você distribuiu mais cotas do que o total permite. Reduza o Concedido do grupo em vermelho antes de salvar.',
      escopoTrocar: 'Mudar a forma de repartir altera a distribuição das cotas quando você salvar.',
      /* rótulo de cada unidade na lista do "+" da célula: a da célula ou outra (o extra tira nesta célula) */
      rotuloUnidade: function (nome, daCelula) { return nome + (daCelula ? ' · esta unidade' : ' · deslocamento'); },
      /* "Inserir na escala" (efetiva os extras) */
      inserida: 'Extras inseridos na escala.',
      semExtras: 'Não há extras para inserir.',
      /* rótulos curtos dos avisos da escala que uma extra pode resolver (grade da aba Escala);
         o front acrescenta o local, ex.: "Rodízio repetido: Almoxarife" */
      avisosGrade: {
        sem_condutor: 'Sem condutor',
        chefe_condutor: 'Chefe conduzindo',
        efetivo_vazio: 'Cadeira vazia',
        resolva_escala: 'Sem solução automática',
        grau_por_falta: 'Grau rebaixado',
        rodizio_quebrado: 'Rodízio repetido',
        sem_modelo: 'Falta de distribuição',
        sem_funcao: 'Militar sem função definida',
        sem_funcao_plural: '{n} militares sem função definida'
      },
      avisosTitulo: 'Avisos'
    },

    /* edição não salva */
    edicao: {
      sairSemSalvar: 'Você tem alterações não salvas. Se sair agora, elas serão perdidas.'
    },

    /* sessão */
    sessao: {
      expirada: 'Sua sessão expirou. Entre novamente.',
      expiradaInatividade: 'Sua sessão expirou por inatividade. Entre novamente.'
    },

    /* histórico (página de auditoria, admin) — rótulos legíveis das ações e tipos */
    historico: {
      acoes: {
        criacao: 'Criou',
        atualizacao: 'Editou',
        alteracao: 'Alterou',
        exclusao: 'Excluiu',
        adicao: 'Adicionou',
        remocao: 'Removeu',
        substituicao: 'Substituiu',
        restauracao: 'Restaurou',
        transferencia: 'Transferiu',
        promocao: 'Promoveu',
        aprovacao: 'Aprovou',
        recusa: 'Recusou',
        solicitacao: 'Solicitou',
        concessao: 'Concedeu',
        ajuste: 'Ajustou'
      },
      tipos: {
        instalacao: 'Instalação',
        viatura: 'Viatura',
        escala: 'Escala',
        usuario: 'Usuário',
        preferencias: 'Preferências',
        distribuicao: 'Distribuição',
        regra: 'Regra da distribuição',
        folga: 'Folga',
        extra_cota: 'Cotas (extrajornada)',
        extra_alocacao: 'Extra (escala do mês)',
        atestado: 'Atestado',
        ferias: 'Férias',
        licenca: 'Licença',
        dispensa: 'Dispensa',
        unidade: 'Ajustes da unidade'
      }
    },

    /* gerais (usadas em mais de uma tela) */
    geral: {
      camposCorrigir: 'Há campos a corrigir. Revise os destacados em vermelho.',
      erroConexao: 'Erro de conexão. Tente novamente.',
      falhaCarregar: 'Não foi possível carregar. Tente de novo.',
      /* salvar — três falhas distintas (sem conexão / servidor / banco rejeitou) */
      semConexao: 'Sem conexão. Nada foi salvo. Verifique sua internet e tente de novo.',
      falhaServidor: 'Não foi possível concluir a ação. Atualize a página e tente de novo.',
      /* confirmação no modal geral-resumo; {pagina} = nome da tela. O título depende
         da ação: exclusão tem texto próprio (senão diria "alterações salvas" para algo apagado) */
      alteracoesSalvas: 'Alterações em {pagina} salvas com sucesso',
      exclusaoConcluida: 'Exclusão em {pagina} concluída',
      /* modal de data — recálculo direcionado ao alterar modelo/regra/viatura/instalação/ritmo */
      recalcularDesde: 'A partir de qual data a escala deve ser recalculada?',
      dataMuitoAntiga: 'A data não pode ser mais de uma semana no passado.',
      /* dica do botão de adicionar desativado quando o posto está cheio (modelo e Editar do dia) */
      efetivoMaximo: 'Efetivo máximo: {n}'
    },

    /* rótulos de botão de avisos e confirmações */
    botoes: {
      continuar: 'Continuar',
      continuarEditando: 'Continuar editando',
      descartar: 'Descartar',
      sairSemSalvar: 'Sair sem salvar',
      irParaLogin: 'Ir para o login',
      excluirModelo: 'Excluir modelo',
      excluirViatura: 'Excluir viatura',
      excluirInstalacao: 'Excluir instalação',
      cancelar: 'Cancelar',
      transferir: 'Transferir',
      remover: 'Remover',
      cancelarMudanca: 'Cancelar mudança',
      manter: 'Manter',
      promover: 'Promover',
      readmitir: 'Readmitir',
      darBaixa: 'Dar baixa',
      copiarMensagem: 'Copiar mensagem',
      mensagemCopiada: 'Mensagem copiada',
      cancelarLink: 'Cancelar link',
      salvar: 'Salvar',
      /* modal do banco de horas (folga e pontual) */
      contabilizar: 'Contabilizar',
      naoContabilizar: 'Não contabilizar',
      /* modal de resumo — reverter a ação recém-aplicada (última chance) */
      desfazer: 'Desfazer',
      desfazendo: 'Desfazendo…'
    }

  };

  /* o aviso da saída do militar da escala (transferência, Tirar do ciclo e baixa): a lista do que vai
     acontecer, com o item da escala e um item por troca, folga e extra do plano que a análise
     (escala_ciclo_retirar_analisar) devolve; a nota só quando há o que cancelar.
     opcoes = { tipo: 'transferencia' | 'tirar' | 'baixa', escala: texto do item da escala,
     cotas: texto do item das cotas (só na baixa) }. Devolve { itens: [{ titulo, texto }], nota } */
  window.RosterWork.avisoSaida = function (pendencias, opcoes) {
    var M = window.RosterWork.mensagens;
    var S = M.saida;
    var p = pendencias || {};
    var horas = window.RosterWork.tempo.horas;
    /* "DD/MM/AAAA" -> "AAAAMMDD", para pôr os dias da troca em ordem */
    var ordem = function (d) { return d.split('/').reverse().join(''); };
    var itens = [{ titulo: S.tituloEscala, texto: opcoes.escala }];
    (p.trocas || []).forEach(function (t) {
      if (t.acao === 'tirar_parte') {
        var dias = [t.servico, t.devolucao].filter(Boolean)
          .sort(function (a, b) { return ordem(a).localeCompare(ordem(b)); })
          .map(function (d) { return d.slice(0, 5); }).join(' e ');
        var diaParte = (t.sai === 'devolucao' ? t.devolucao : t.servico) || '';
        itens.push({ titulo: S.tituloTroca, texto: S.trocaParte(t.com, dias, t.sai, diaParte.slice(0, 5), horas(t.minutos), t.devedor, t.credor) });
      } else {
        var situacao = (M.trocas.situacao[t.status] || '').toLowerCase();
        itens.push({ titulo: S.tituloTroca, texto: S.trocaCancelada(t.com, t.servico, t.devolucao, situacao) });
      }
    });
    (p.folgas || []).forEach(function (f) {
      var situacao = f.situacao === 'pendente' ? '' : (M.folgas.situacao[f.situacao] || '').toLowerCase();
      itens.push({ titulo: S.tituloFolga, texto: S.folgaCancelada(f.dia, situacao, f.volta_saldo ? horas(f.minutos) : '') });
    });
    (p.extras || []).forEach(function (e) {
      itens.push({ titulo: S.tituloExtra, texto: S.extraSai(e.dia, e.unidade, opcoes.tipo !== 'baixa') });
    });
    var cancela = itens.length > 1;
    if (opcoes.cotas) itens.push({ titulo: S.tituloCotas, texto: opcoes.cotas });
    var notas = { transferencia: S.notaTransferencia, tirar: S.notaTirar, baixa: S.notaBaixa };
    return { itens: itens, nota: cancela ? (notas[opcoes.tipo] || '') : '' };
  };
})();
