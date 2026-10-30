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

  /* "A, B e C" */
  function juntarComE(lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); }

  /* a lista com a palavra antes de cada um: lista('no', [A, B]) = "no A e no B" */
  function lista(antes, itens) { return juntarComE(itens.map(function (x) { return antes + ' ' + x; })); }

  window.RosterWork.mensagens = {

    /* meu perfil (e-mail e celular direto, pedido de correção do resto + troca de senha) */
    perfil: {
      falhaDados: 'Não foi possível salvar. Tente de novo.',
      solicitacaoEnviada: 'Solicitação enviada para aprovação.',
      dadosSalvos: 'Dados salvos.',
      /* a janela ao entrar, no modo "Confira o seu cadastro" */
      cadastroConferido: 'Cadastro conferido.',
      cadastroConferidoComPedido: 'Cadastro conferido. Os dados que você preencheu vão para a aprovação de um administrador.',
      demaisParaAprovacao: 'As demais alterações foram enviadas para a aprovação do administrador.',
      /* o painel da pendência da CNH (index-cnh-painel.js) */
      tituloCnh: 'CNH',
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
      rgInvalido: 'O RG deve ter 8 ou 9 dígitos. Na carteira nova, o RG é o próprio CPF.',
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
      semAbertos: 'Nenhum aviso novo.',
      semComunicados: 'Nenhum comunicado.',
      carregando: 'Carregando…',
      falhaCarregar: 'Não foi possível carregar.',
      /* os comunicados: criar e remover (admin; js/avisos-comunicado.js) */
      confirmarRemoverAviso: 'Remover este comunicado? Ele deixa de aparecer para quem o recebeu.',
      descartarAviso: 'Descartar este comunicado não publicado?',
      falhaSalvarAviso: 'Não foi possível publicar o comunicado. Tente de novo.',
      falhaRemoverAviso: 'Não foi possível remover o comunicado. Tente de novo.'
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
      contaCriada: 'Conta criada. Você já pode entrar com o seu CPF e a sua senha.',
      falha: 'Não foi possível criar a conta. Tente de novo.'
    },

    /* login (página standalone, antes da sessão) */
    login: {
      identificadorVazio: 'Digite seu CPF ou RG',
      identificadorInvalido: 'CPF ou RG inválido',
      senhaVazia: 'Digite sua senha',
      erroConexao: 'Erro de conexão',
      naoEncontrado: 'CPF ou RG não encontrado',
      senhaIncorreta: 'Senha incorreta',
      /* entrada pelo login lembrado (Manter-me conectado) */
      entrandoSemInternet: 'Sem conexão com a internet. Confira e tente de novo.',
      entrandoTenteDepois: 'Não foi possível entrar agora. Tente de novo em alguns minutos.',
      sessaoTerminou: 'Sua sessão terminou. Entre de novo com o seu CPF e a sua senha.'
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
      rgInvalido: 'O RG deve ter 8 ou 9 dígitos. Na carteira nova, o RG é o próprio CPF',
      rgDiferenteCpf: 'Na carteira nova, o RG é igual ao CPF. Confira o número',
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
      inclusaoVazia: 'Preencha a data de inclusão',
      inclusaoAposNascimento: 'A data de inclusão deve ser após o nascimento',
      inclusaoDepoisPromocao: 'A data de inclusão não pode ser depois de uma promoção',
      inclusaoSd3: 'Soldado 3ª Classe só para quem foi incluído a partir de 01/11/2024',
      postoAntesInclusao: 'Preencha a data de inclusão antes',
      colocacaoVazia: 'Preencha a colocação',
      lotacaoVazia: 'Selecione a lotação',
      setorVazio: 'Selecione o setor',
      promocaoOrdem: 'Deve ser após a data anterior',
      promocaoAntesInclusao: 'A promoção não pode ser antes da data de inclusão',
      promocaoVazia: 'Preencha a data da promoção',
      colocacaoZero: 'Informe a sua colocação no curso',
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
      /* troca de viatura marcada: para sempre ou com data de volta */
      trocaAPartir: '{prefixo} (CNH {cnh}) a partir de {data}',
      trocaIntervalo: '{prefixo} (CNH {cnh}) de {inicio} a {fim}',
      /* card durante a troca com data: o selo e a viatura que está no lugar */
      substituidaAte: 'Substituída até {data}',
      noLugar: '{prefixo} no lugar',
      /* as viaturas que já serviram neste posto (painel) */
      anteriorPeriodo: '{inicio} a {fim}',
      anteriorViatura: '{prefixo}, CNH {cnh}',
      /* linha do período no card (primeiro e último dia reais do posto) */
      periodoPermanente: 'Permanente',
      periodoDesde: 'desde {data}',
      periodoAte: 'até {data}',
      periodoIntervalo: '{inicio} a {fim}',
      confirmarCancelarMudanca: 'Cancelar a mudança marcada ({mudanca})? A escala é refeita a partir dessa data.',
      /* a mudança abriu um período na Distribuição que já foi revisado: cancelar a descarta */
      descartaAjusteDistribuicao: ' O período da Distribuição que já foi revisado será descartado.',
      falhaCancelarMudanca: 'Não foi possível cancelar a mudança. Tente de novo.',
      falhaTransferir: 'Não foi possível transferir. Tente de novo.',
      falhaExcluir: 'Não foi possível excluir. Tente de novo.',
      falhaExcluirInstalacao: 'Não foi possível excluir a instalação. Tente de novo.',
      /* a viatura é única no sistema: se já existe em outra unidade, oferece a transferência */
      viaturaEmOutraUnidade: 'A viatura {prefixo} já está cadastrada em {unidade}. Deseja transferi-la para {destino} a partir de {data}? Os dados que você digitou serão aplicados a ela.',
      /* ponto crítico: postos alimentam a distribuição da escala */
      impactoDistribuicao: 'Este é um ponto crítico do sistema: as viaturas e instalações alimentam a distribuição da escala. Vá até a Distribuição para conferir os modelos e corrigir o que for necessário.'
    },

    /* edição de posto (componente geral-posto-editar: painel do dia da Escala e painel de Postos) */
    postoEditar: {
      /* o prefixo da troca já está em outro posto naqueles dias (só avisa, não impede de salvar) */
      emUsoDia: '{prefixo} também está em uso em {unidade}, em {data}. Confira antes de salvar.',
      emUsoPeriodo: '{prefixo} também está em uso em {unidade}, de {inicio} a {fim}. Confira antes de salvar.',
      falhaSalvar: 'Não foi possível salvar o posto. Tente de novo.'
    },

    /* afastamentos — abas Férias · Licenças · Dispensas de Usuários e as mesmas abas da ficha */
    afastamentos: {
      /* o tipo por extenso (caixas da ficha e sub-tela) e curto (linha da lista); 'licenca' é o tipo de
         saúde que o banco esconde de quem não administra o militar */
      tipos: {
        ferias: 'Férias', licenca: 'Licença',
        propria_saude: 'Tratamento da própria saúde', saude_familiar: 'Tratamento de saúde de familiar',
        interesses: 'Interesses particulares', especial: 'Especial', capacitacao: 'Capacitação',
        gala: 'Gala (casamento)', nojo: 'Nojo (falecimento)', comum: 'Comum'
      },
      tiposCurtos: {
        licenca: 'Licença', propria_saude: 'Própria saúde', saude_familiar: 'Saúde de familiar',
        interesses: 'Interesses particulares', especial: 'Especial', capacitacao: 'Capacitação',
        gala: 'Gala', nojo: 'Nojo', comum: 'Comum'
      },
      /* filtro Situação e contagem de cada unidade, pela categoria da aba */
      comNoAno: { ferias: 'Com férias no ano', licenca: 'Com licença no ano', dispensa: 'Com dispensa no ano' },
      semNoAno: { ferias: 'Sem férias no ano', licenca: 'Sem licença no ano', dispensa: 'Sem dispensa no ano' },
      contagem: function (n, categoria) {
        return n + (categoria === 'ferias' ? ' com férias' : categoria === 'dispensa' ? ' com dispensa' : ' com licença');
      },
      dias: function (n) { return n === 1 ? '1 dia' : n + ' dias'; },
      seloFora: 'Fora do fluxo',
      seloSegue: 'Segue no fluxo',
      extraFora: 'fora do fluxo',
      /* a situação do período na ficha */
      emCurso: 'Em curso',
      marcado: 'Marcado',
      encerrado: 'Encerrado',
      novo: 'Novo período',
      /* a caixa de um tipo sem período no ano (administrador) e a aba sem nada (quem só lê) */
      vazioTipo: function (categoria, ano) {
        if (categoria === 'ferias') return 'Nenhum período de férias em ' + ano + '.';
        return (categoria === 'dispensa' ? 'Nenhuma dispensa' : 'Nenhuma licença') + ' deste tipo em ' + ano + '.';
      },
      vazioAba: function (categoria, ano) {
        return (categoria === 'ferias' ? 'Nenhum período de férias' : categoria === 'dispensa' ? 'Nenhuma dispensa' : 'Nenhuma licença') + ' em ' + ano + '.';
      },
      subtitulo: function (ano) { return 'Os períodos de ' + ano + '.'; },
      falhaCarregar: 'Não foi possível carregar os afastamentos.',
      /* a decisão do fluxo (licença e dispensa), embaixo do Sim/Não */
      foraDoFluxo: 'Sai do ciclo por tempo indeterminado; volta quando o administrador o incluir de novo pela aba Ciclo da Escala.',
      segueNoFluxo: 'Continua no fluxo, só bloqueia os dias do afastamento.',
      /* o problema de um período (vai para a nota embaixo da lista) */
      fimAntes: 'A data de fim deve ser igual ou depois do início.',
      cruza: function (periodo) { return 'Este período cruza com o de ' + periodo + '.'; },
      limite: function (data) { return 'Só dá para mudar o que vai de ' + data + ' em diante.'; },
      /* aviso antes de gravar: o que o militar já tem nos dias novos e se ele continua fora da escala */
      confirmarTem: 'Nos dias novos, este militar já tem:',
      confirmarSo: 'Confira antes de salvar:',
      itemTroca: function (dia, com) { return 'Cobre o serviço ' + (com ? 'de ' + com + ' ' : '') + 'em ' + dia + '.'; },
      itemExtra: function (dia, unidade) { return 'Em ' + dia + (unidade ? ', n' + artigo(unidade) + ' ' + unidade : '') + '.'; },
      itemFolga: function (dia, situacao) { return 'Em ' + dia + (situacao ? ' (' + situacao + ')' : '') + '.'; },
      itemContinuaFora: function (data) { return 'Continua fora da escala desde ' + data + '. A volta é pela aba Ciclo da Escala.'; },
      notaConfirmar: 'Se você continuar, nada disso é desfeito: o serviço fica em amarelo na escala e a folga continua marcada.'
    },

    /* ajustes — painel do ritmo da unidade (o Salvar pergunta a data a partir da qual o ritmo vale) */
    ajustes: {
      efeitoRitmo: 'A escala automática dos militares da unidade é regerada a partir da data que você escolher ao salvar.',
      /* aba Expediente: o expediente dos administrativos por unidade */
      expediente: {
        motivos: { feriado: 'Feriado', ponto_facultativo: 'Ponto facultativo', recesso: 'Recesso', outro: 'Folga' },
        nacional: 'NACIONAL',
        tituloPadrao: 'Horário padrão',
        horas: function (das, ate) { return das + ' às ' + ate; },
        padrao: function (p, hora) {
          return 'Horário padrão: segunda a sexta ' + hora(p.das) + ' às ' + hora(p.ate) + '; quarta ' + hora(p.quarta_das) + ' às ' + hora(p.quarta_ate)
            + (p.proprio ? '.' : ' (o do ' + p.de_unidade + ').');
        },
        agora: function (texto) { return 'Agora: ' + texto + '.'; },
        diaLongo: function (d) {
          var s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).replace('-feira', '');
          return s.charAt(0).toUpperCase() + s.slice(1);
        },
        travadoDia: function (origem) { return 'Este dia foi marcado por um administrador de nível acima do seu (' + origem + '). Só ele muda este dia.'; },
        travadoPadrao: 'O horário padrão desta unidade foi definido por um administrador de nível acima do seu. Só ele muda.'
      }
    },

    /* extrajornada (nova-extra*.js): a Minha extra, o painel do pedido e o Organizar o mês */
    novaExtra: {
      /* Relatórios › Imprimir: o painel Imprimir relatório (nova-extra-imprimir.js) */
      imprimir: {
        titulo: 'Imprimir relatório',
        /* o Imprimir da grade (nova-extra-imprimir-grade.js): o título do alto da folha e o começo do nome do arquivo */
        grade: { titulo: 'Escala de extrajornada', arquivo: 'Extrajornada', escalaCompleta: 'Escala completa' },
        indisponivel: {
          pedidos: 'Libera quando os pedidos fecharem.',
          termos: 'Libera quando as cotas forem repartidas.',
          inicial: 'Libera depois do lançamento.',
          final: 'Libera no dia 1º do mês seguinte ao da extra.'
        },
        /* a nota do alto do painel ("Será impresso:"): "Relatório inicial de outubro de 2026, todos os pelotões,
           separados por pelotão." */
        resumo: {
          frase: function (relatorio, mes, unidade, modo) { return relatorio + ' de ' + mes + ', ' + unidade + (modo ? ', ' + modo : '') + '.'; },
          relatorios: { pedidos: 'Relatório de pedidos', termos: 'Relatório de termos e cotas', inicial: 'Relatório inicial', final: 'Relatório final' },
          todos: 'todos os pelotões',
          modos: { separar: 'separados por pelotão', unica: 'em lista única' }
        }
      },
      /* os quatro PDFs dos relatórios (nova-extra-relatorios-pdf.js), no padrão do registro RW das trocas */
      relatoriosPdf: {
        titulos: {
          pedidos: 'RELATÓRIO DE PEDIDOS DA EXTRAJORNADA', termos: 'RELATÓRIO DE TERMOS E COTAS DA EXTRAJORNADA',
          inicial: 'RELATÓRIO INICIAL DA EXTRAJORNADA', final: 'RELATÓRIO FINAL DA EXTRAJORNADA'
        },
        arquivos: { pedidos: 'extrajornada-pedidos', termos: 'extrajornada-termos-e-cotas', inicial: 'extrajornada-relatorio-inicial', final: 'extrajornada-relatorio-final' },
        arquivo: function (prefixo, mes, ano, unidade) { return prefixo + '-' + mes + '-' + ano + (unidade ? '-' + unidade : '') + '.pdf'; },
        rotuloMes: 'Mês', rotuloUnidade: 'Unidade', rotuloGerado: 'Gerado em', todos: 'Todos os pelotões',
        gerado: function (data, hora) { return data + ', ' + hora; },
        secao: function (n, titulo) { return n + '. ' + titulo; },
        secoes: {
          resumo: 'RESUMO', pedidos: 'PEDIDOS', termos: 'TERMOS E COTAS', lancadas: 'EXTRAS LANÇADAS',
          comoFicou: 'COMO FICOU NO FIM DO MÊS', mudou: 'O QUE MUDOU DESDE O LANÇAMENTO', observacoes: 'OBSERVAÇÕES'
        },
        ajudaOrdem: 'Em ordem de antiguidade. A última linha de cada tabela é o total.',
        ajudaMudou: 'Só quem mudou. Quem não aparece manteve as datas do lançamento.',
        colunas: {
          militar: 'Militar', cpf: 'CPF', pelotao: 'Pelotão', pedidoEm: 'Pedido em', cotasPedidas: 'Cotas pedidas', termo: 'Termo',
          pediu: 'Pediu', recebeu: 'Recebeu', data: 'Data', horario: 'Horário', cotas: 'Cotas', era: 'Era', ficou: 'Ficou',
          motivo: 'Motivo', ajustadoPor: 'Ajustado por'
        },
        campos: {
          periodo: 'Período dos pedidos', voluntarios: 'Voluntários', cotasPedidas: 'Cotas pedidas', naoQuerem: 'Não querem extra',
          naoResponderam: 'Não responderam', recebidas: 'Cotas recebidas pela companhia', repartidas: 'Cotas repartidas',
          comTermo: 'Com termo', semTermo: 'Sem termo', lancadoEm: 'Lançado na escala em', lancadoPor: 'Lançado por',
          comExtra: 'Voluntários com extra', lancadas: 'Cotas lançadas', noLancamento: 'Cotas no lançamento',
          noFim: 'Cotas no fim do mês', ajustadas: 'Extras ajustadas'
        },
        periodo: function (abre, fecha) { return 'De ' + abre + ' a ' + fecha; },
        cotas: function (n) { return n + (n === 1 ? ' cota' : ' cotas') + ' (' + (n * 6) + ' horas)'; },
        militares: function (n) { return n + (n === 1 ? ' militar' : ' militares'); },
        voluntarios: function (n) { return n + (n === 1 ? ' voluntário' : ' voluntários'); },
        total: function (n) { return 'Total: ' + n + (n === 1 ? ' voluntário' : ' voluntários'); },
        totalAjustadas: function (n) { return 'Total: ' + n + (n === 1 ? ' extra ajustada' : ' extras ajustadas'); },
        horario: function (ini, fim) { return ini + ' às ' + fim; },
        outraUnidade: function (horario, unidade) { return horario + ' (' + unidade + ')'; },
        sim: 'Sim', nao: 'Não', extraNova: 'Extra nova', retirada: 'Retirada', semMotivo: 'Sem motivo',
        obs: {
          cota: 'Cada cota vale 6 horas de serviço.',
          reproduz: 'Este relatório reproduz os dados gravados no sistema e não substitui os documentos oficiais.',
          semTermo: 'Sem o termo entregue, o militar não recebe cota.',
          inicial: 'O relatório inicial é a extrajornada como foi lançada na escala. As mudanças depois do lançamento ficam no relatório final.'
        }
      },
      titulo: function (mes, quem) { return quem + ' · ' + mes; },
      prazoAberto: function (n) { return n === 0 ? 'Último dia para pedir' : 'Faltam ' + n + (n === 1 ? ' dia' : ' dias') + ' para pedir'; },
      prazoAntes: function (abre) { return 'Abre em ' + abre; },
      prazoFechado: function (fecha) { return 'Fechou em ' + fecha; },
      semPedido: function (fecha) { return 'Aberto até ' + fecha + ', às 23h59. Diga se quer tirar extra, quantas cotas e os dias.'; },
      naoAbriu: function (abre) { return 'O pedido abre em ' + abre + '.'; },
      naoPediu: 'Nenhum pedido feito.',
      soPraca: 'A extra é só para praças.',
      pediu: function (p) {
        return 'Pedido enviado em ' + p.enviado_em + ': ' + p.cotas + (p.cotas === 1 ? ' cota' : ' cotas') + (p.so_24h ? ', só 24 h' : '')
          + ', ' + p.quer.length + (p.quer.length === 1 ? ' dia que quer' : ' dias que quer')
          + (p.nao_posso.length ? ', ' + p.nao_posso.length + (p.nao_posso.length === 1 ? ' que não quer' : ' que não quer') : '')
          + '. Termo ' + (p.termo ? 'recebido em ' + p.termo_em : 'pendente') + '.';
      },
      naoQuer: function (em) { return 'Respondeu que não quer extra (' + em + ').'; },
      fazer: 'Fazer o pedido',
      mudar: 'Mudar o pedido',
      ver: 'Ver o pedido',
      fechadoEm: function (fecha) { return 'Fechado em ' + fecha; },
      cotasDepois: function (fecha) { return 'Depois de ' + fecha + ' o administrador reparte as cotas. Quem foi menos atendido recebe primeiro.'; },
      concedidas: function (n) { return 'Recebeu ' + n + (n === 1 ? ' cota.' : ' cotas.'); },
      tituloPainel: function (mes) { return 'Pedido de extra de ' + mes; },
      prazoPainel: function (fecha) { return 'Aberto até ' + fecha + ', às 23h59'; },
      perguntaVol: function (mes) { return 'Quer tirar extra em ' + mes + '?'; },
      contaQuer: function (n) { return 'Quero: ' + n + (n === 1 ? ' dia' : ' dias'); },
      ajudaDias: function (min) { return 'Marque pelo menos ' + min + (min === 1 ? ' dia que você quer' : ' dias que você quer'); },
      contaNao: function (n) { return 'Não quero: ' + n + (n === 1 ? ' dia' : ' dias'); },
      quero: 'Quero',
      naoQuero: 'Não quero',
      motivos: { servico: 'Serviço', troca: 'Troca', folga: 'Folga', ferias: 'Férias', licenca: 'Licença', dispensa: 'Dispensa' },
      expediente: 'Expediente',
      folga: 'Folga',
      desde: function (h) { return 'desde ' + h; },
      falta: function (n) { return (n === 1 ? 'falta ' : 'faltam ') + n; },
      querem: function (n) { return n + (n === 1 ? ' quer' : ' querem'); },
      termoPendente: 'Termo pendente. Mande o termo pelo eProtocolo. Sem o termo recebido, você não entra na repartição das cotas.',
      termoRecebido: function (em) { return 'Termo recebido em ' + em + '.'; },
      semDias: 'Os dias de extra aparecem aqui depois da distribuição.',
      aindaNaoLancado: 'Ainda não lançado na escala.',
      /* Organizar o mês, Calendário e a grade do passo 3 */
      org: {
        p1: function (abre, fecha, resp, total) { return abre + ' a ' + fecha + ' · ' + resp + ' de ' + total + ' responderam'; },
        p2: function (rec, rep) { return rec + ' recebidas · ' + rep + ' repartidas'; },
        p2Depois: 'Depois do pedido',
        p3: function (g, c) { return g + ' de ' + c + ' cotas colocadas'; },
        p4Nao: 'Ainda não lançado',
        p5: function (n) { return n + (n === 1 ? ' ajuste' : ' ajustes'); },
        responderam: function (n, t) { return n + ' de ' + t + ' militares responderam.'; },
        cotas: function (n, so24) { return n + (so24 ? ' (24 h)' : ''); },
        dias: function (n) { return n ? n + (n === 1 ? ' dia' : ' dias') : 'nenhum'; },
        termosMudados: function (n) { return n + (n === 1 ? ' termo mudado, não salvo' : ' termos mudados, não salvos'); },
        fila: function (n) { return n + 'º'; },
        porcento: function (n) { return n + '%'; },
        /* a dica da Sugestão quando ela para no que cabe nos dias livres dele */
        sugCabe: function (n) { return n ? 'Só cabem ' + n + (n === 1 ? ' cota' : ' cotas') + ' nos dias livres dele no mês.' : 'Sem dia livre no mês.'; },
        naoSalvo: 'Mudanças não salvas',
        c1ok: function (f) { return 'Pedidos fechados em ' + f; },
        c1aberto: function (f) { return 'O pedido ainda está aberto até ' + f; },
        c1texto: function (v, t) { return v + (v === 1 ? ' voluntário, ' : ' voluntários, ') + t + ' com o termo recebido.'; },
        c2: function (c, r) { return c + ' cotas repartidas de ' + r + ' recebidas'; },
        c3: function (g, c) { return g + ' de ' + c + ' cotas colocadas'; },
        c4: function (n) { return n + (n === 1 ? ' dia ainda com falta de gente' : ' dias ainda com falta de gente'); },
        c4ok: 'Nenhum dia com falta de gente',
        lancadoTitulo: function (em, por) { return 'Lançado em ' + em + (por ? ', por ' + por : ''); },
        aoLancar: 'Ao lançar',
        /* Ações › Lançar na escala e encerrar (o título do painel) e o que ainda impede um item do menu Ações */
        lancarTitulo: 'Lançar na escala e encerrar',
        /* Relatórios: o título da prévia do que mudou desde o lançamento */
        relPrevia: 'Prévia do relatório final',
        relFinal: 'Relatório final',
        /* Pedidos › Ações › Fechar os pedidos agora */
        confirmarFechar: 'Fechar os pedidos agora? Ninguém mais consegue fazer ou mudar o pedido.',
        fecharPedidos: 'Fechar os pedidos',
        fechadosEm: function (data, por) { return 'Pedidos fechados em ' + data + (por ? ' por ' + por : '') + '.'; },
        /* Distribuição › Ações › Reabrir a distribuição e a nota da Distribuição lançada */
        confirmarReabrir: 'Reabrir a distribuição? Ao lançar de novo, o novo lançamento vira o relatório inicial, e os ajustes feitos até aqui passam a fazer parte dele.',
        reabrir: 'Reabrir',
        distLancada: function (em, por) { return 'Distribuição lançada em ' + em + (por ? ' por ' + por : '') + '. As mudanças agora são feitas em Ajustes.'; },
        acao: {
          pedidosAbertos: 'Libera quando os pedidos fecharem.',
          pedidosNaoAbriram: 'Os pedidos ainda não abriram.',
          pedidosJaFechados: 'Os pedidos já estão fechados.',
          salvarAntes: 'Salve as alterações antes.',
          semExtras: 'Nenhuma extra na distribuição.',
          faltamCotas: function (n) { return 'Faltam ' + n + (n === 1 ? ' cota' : ' cotas') + ' para colocar nas datas.'; },
          mesComecou: 'O mês já começou. As mudanças agora são feitas em Ajustes.',
          jaLancada: 'Já lançada. Para lançar de novo, reabra a distribuição.',
          lancadaFechada: 'Lançada. As mudanças agora são feitas em Ajustes.',
          naoLancada: 'A distribuição ainda não foi lançada.',
          jaReaberta: 'A distribuição já está reaberta.'
        },
        mudouDesde: function (n) { return 'Depois do lançamento, ' + n + (n === 1 ? ' mudança ainda não está na escala:' : ' mudanças ainda não estão na escala:'); },
        nada: 'nada',
        tirado: 'tirado',
        lancarTexto: function (n) { return n + (n === 1 ? ' extra entra na escala.' : ' extras entram na escala.') + ' Fica guardada a foto, que vira o relatório inicial.'; },
        diaAntigo: 'Este dia é de mais de 7 dias atrás. A extra dele não pode mais mudar.',
        relAjustesPeriodo: function (ini, fim) { return ini + ' a ' + fim + '. Feitos em Ajustes, com o motivo.'; },
        colocadas: function (n, t) { return n + ' de ' + t + ' cotas colocadas'; },
        faltaGenteHoras: function (h) { return 'Ainda falta gente de ' + h + '.'; },
        faltaCondutorHoras: function (h, cnh) { return 'Ainda falta condutor de ' + h + (cnh ? ', CNH ' + cnh : '') + '.'; },
        faltaCoberta: 'As extras cobrem a falta deste dia.',
        grupos: { neste: 'Neste dia', querem: 'Querem este dia', disp: 'Sem preferência', naoQuerem: 'Não querem este dia', indisp: 'Indisponíveis' },
        /* o relatório do dia */
        /* a dica do ícone de quem inseriu a extra (calendário, Agenda e Neste dia) */
        origemSistema: 'Inserido pelo sistema', origemAdmin: 'Inserido pelo administrador',
        rdSistema: 'O sistema colocou',
        rdAdmin: function (quem) { return (quem || 'O administrador') + ' colocou'; },
        rdHoras: function (h, para) { return 'das ' + h + (para ? ', para ' + para : '') + '.'; },
        para: { condutorGente: 'cobrir a falta de condutor e de gente', condutor: 'cobrir a falta de condutor', gente: 'cobrir a falta de gente',
          chefe: 'liberar o chefe da direção', ideal: 'completar o efetivo ideal', menosGente: 'usar a cota que sobrou' },
        pref: { quer: 'Marcou Quero neste dia.', nao: 'Marcou Não quero neste dia.', sem: 'Sem preferência neste dia.' },
        aindaPodem: function (q, s) {
          var partes = [];
          if (q) partes.push(q + (q === 1 ? ' que quer o dia' : ' que querem o dia'));
          if (s) partes.push(s + ' sem preferência');
          return 'Ainda podem: ' + partes.join(' e ') + '.';
        },
        ninguemPode: function (nao, semCota, outros) {
          var partes = [];
          if (nao) partes.push(nao + (nao === 1 ? ' marcou Não quero' : ' marcaram Não quero'));
          if (semCota) partes.push(semCota + (semCota === 1 ? ' está sem cota' : ' estão sem cota'));
          if (outros) partes.push(outros + (outros === 1 ? ' está de serviço, de folga ou afastado' : ' estão de serviço, de folga ou afastados'));
          return 'Ninguém mais pode' + (partes.length ? ': ' + (partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0]) : '') + '.';
        },
        /* o Preencher pela sugestão: quando o cálculo completo não termina, e por que alguém ficou com cota */
        reservaUsada: 'O cálculo completo não terminou a tempo. A sugestão usou o cálculo simples.',
        /* a leitura que falhou (a mensagem técnica do banco fica no console) */
        falhaMes: 'Não foi possível ler o mês.',
        falhaEscala: 'Não foi possível ler a escala.',
        falhaSugestao: 'Não foi possível calcular a sugestão.',
        foraMotivo: { solta: 'Sobrou 1 cota sozinha.', nao_quero: 'Só sobrou dia que ele não quer.', sem_dia: 'Sem dia livre com falta ou vaga.' },
        resultadoSugestao: function (c, v, a) {
          var partes = [];
          if (v) partes.push(v + (v === 1 ? ' dia com vermelho' : ' dias com vermelho'));
          if (a) partes.push(a + (v ? ' com amarelo' : (a === 1 ? ' dia com amarelo' : ' dias com amarelo')));
          return 'A sugestão colocou ' + c + (c === 1 ? ' cota. ' : ' cotas. ') + (partes.length ? 'Ficaram ' + partes.join(' e ') + '.' : 'Não ficou dia com erro.')
            + ' Clique no pelotão para ver o relatório do dia.';
        },
        sobramN: function (n) { return 'Sobram ' + n; },
        /* o repartido acima do recebido (a mesma frase do banco) */
        cotasPassaram: function (rep, rec) { return 'Foram repartidas ' + rep + ' cotas, mas a companhia recebeu ' + rec + '.'; },
        cotasPassaramUnidade: function (nome, rep, rec) { return nome + ': foram repartidas ' + rep + ' cotas, mas recebeu ' + rec + '.'; },
        extraEm: function (nome) { return 'Extra no ' + nome; },
        expedienteDiaTodo: 'Expediente o dia todo',
        semCotas: 'Sem cotas sobrando',
        deCotas: function (u, c) { return u + ' de ' + c; },
        so24: 'Só 24 h',
        condutor: 'Condutor',
        horasN: function (n) { return n + 'h'; },
        /* as extras que saem ao salvar (termo desmarcado ou cota abaixo do que está na grade) */
        listaDias: function (dias) { return dias.length > 1 ? dias.slice(0, -1).join(', ') + ' e ' + dias[dias.length - 1] : dias[0]; },
        retiraTermo: function (dias, ajuste) {
          return 'Tem extra em ' + this.listaDias(dias) + '. Ao salvar, ' + (dias.length === 1 ? 'essa extra sai' : 'essas extras saem') + ' da distribuição'
            + (ajuste ? ' e ' + (dias.length === 1 ? 'entra' : 'entram') + ' como ajuste do mês.' : '.');
        },
        retiraCota: function (n, dias, ajuste) {
          return 'Com ' + n + (n === 1 ? ' cota, ' : ' cotas, ') + (dias.length === 1 ? 'a extra de ' : 'as extras de ') + this.listaDias(dias)
            + (dias.length === 1 ? ' sai' : ' saem') + ' ao salvar' + (ajuste ? ' e ' + (dias.length === 1 ? 'entra' : 'entram') + ' como ajuste do mês.' : '.');
        },
        naoSalvoRetira: function (k) { return 'Mudanças não salvas. As extras de ' + k + (k === 1 ? ' militar saem ao salvar.' : ' militares saem ao salvar.'); },
        pedidoAberto: function (fecha) { return 'O pedido está aberto até ' + fecha + '. A distribuição só pode ser salva depois que ele fecha.'; },
        /* passo 3: a lista dos voluntários e a trava das cotas (calendário, lista e painel do dia) */
        diaData: function (sem, dm) { return sem + ' ' + dm; },
        jaEmOutro: function (pel) { return 'Já está de extra no ' + pel + ' neste dia. Para pôr aqui, tire de lá antes.'; },
        focoTexto: function (nome, u, c) { return 'Mostrando os dias de ' + nome + ' · ' + u + ' de ' + c + (c === 1 ? ' cota' : ' cotas'); },
        saiAoSalvar: 'Sai ao salvar',
        cotaCheia: function (nome, n) {
          return nome + (n === 1 ? ' já usou a única cota.' : ' já usou as ' + n + ' cotas.') + ' Para marcar este horário, tire antes um horário de outro dia.';
        },
        cotaCheia24: function (nome) { return nome + ' só aceita 24 h e precisa de 4 cotas livres para este dia. Tire antes os horários de outro dia.'; },
        faltaIdealHoras: function (h) { return 'Ainda falta gente para o ideal de ' + h + '.'; },
        chefeDirigeHoras: function (h, cnh) { return 'O chefe ainda dirige de ' + h + ' por falta de condutor' + (cnh ? ', CNH ' + cnh : '') + '.'; },
        ajusteTexto: function (n) { return n + (n === 1 ? ' ajuste não salvo.' : ' ajustes não salvos.'); },
        alteracoes: function (n) { return n + (n === 1 ? ' alteração não salva' : ' alterações não salvas'); },
        descartarRascunho: 'Descartar as alterações não salvas da distribuição?'
      }
    },

    /* escalas (painel da distribuição e grade do mês) */
    escala: {
      falhaCarregar: 'Não foi possível carregar.',
      falhaCarregarMes: 'Não foi possível carregar a escala.',
      /* Minha escala: o mês sem serviço (o botão leva à aba Mês) */
      minhaSemServico: function (mes) { return 'Você não tem serviço em ' + mes + '. A escala de todos fica na aba Mês.'; },
      selecioneUnidade: 'Selecione uma companhia ou pelotão no seletor de unidades.',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      /* aba Dia: a escala do dia mudou depois que a tela leu (outro administrador ou o sistema) */
      diaDesatualizado: 'A escala deste dia foi alterada por outra pessoa ou pelo sistema. A tela foi atualizada: confira e faça a mudança de novo.',
      /* catálogo de erros/avisos da distribuição na escala — o aviso-lista do topo mostra uma linha
         [ícone + texto] por item presente; nivel 'erro' (vermelho) ou 'alerta' (amarelo) */
      erros: {
        foraDisponibilidade: { texto: 'Funções fora da disponibilidade', icone: 'icone-alerta', nivel: 'erro' },
        semServico:          { texto: 'Militar sem serviço no dia',        icone: 'icone-alerta', nivel: 'erro' },
        sobreposicao:        { texto: 'Dois militares no mesmo horário',    icone: 'icone-alerta', nivel: 'erro' },
        faltaModelo:         { texto: 'Falta modelo de distribuição',       icone: 'icone-alerta', nivel: 'erro' },
        distribuicaoTravada: { texto: 'Distribuição com erro, corrija a distribuição', icone: 'icone-alerta', nivel: 'erro' },
        /* lista do topo: uma linha por trecho, com a composição ("Modelo de distribuição com erro: 2ºPEL: 3 praças, 08h às 08h") */
        modeloComErro:       { texto: 'Modelo de distribuição com erro',    icone: 'icone-alerta', nivel: 'erro' },
        grauRebaixado:       { texto: 'Grau rebaixado por falta de efetivo',  icone: 'icone-alerta', nivel: 'alerta' },
        grauExclusivo:       { texto: 'Grau diferente do ideal (função exclusiva)', icone: 'icone-alerta', nivel: 'alerta' },
        rodizioRepetido:     { texto: 'Rodízio repetido por falta de opção',   icone: 'icone-alerta', nivel: 'alerta' },
        resolvaEscala:       { texto: 'Sem solução automática, precisa de ação do administrador', icone: 'icone-alerta', nivel: 'erro' },
        /* posto travado (uma linha por posto): por regra, ou por falta de CNH para a direção */
        postoSemSolucao:     { texto: 'Sem solução automática, precisa de ação do administrador: {posto}', icone: 'icone-alerta', nivel: 'erro' },
        semCondutorHabilitado: { texto: 'Viatura sem condutor habilitado: {posto} (CNH {cnh})', icone: 'icone-alerta', nivel: 'erro' },
        exclusivoCondutor:   { texto: 'Condutor exclusivo indisponível, motorista substituído', icone: 'icone-alerta', nivel: 'alerta' },
        chefeCondutor:       { texto: 'Chefe assumiu a direção por falta de condutor', icone: 'icone-alerta', nivel: 'alerta' },
        afastadoTroca:       { texto: 'Militar afastado, não vai assumir o serviço', icone: 'icone-alerta', nivel: 'alerta' },
        /* a Central sem Cabo de Dia (só para quem administra; a Distribuição escolhe se dá o erro amarelo) */
        semCaboDia:          { texto: 'Central sem Cabo de Dia: nenhum cabo ou soldado de serviço{faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'alerta' },
        semCondutor:         { texto: 'Viatura sem condutor', icone: 'icone-alerta', nivel: 'erro' },
        /* efetivo da unidade abaixo do mínimo (uma linha só) e o posto que fica fora da escala sem gente para o mínimo
           (uma por posto); a cor vem do banco, pelo aviso escolhido na Distribuição */
        unidadeAbaixoMinimo: { texto: 'Efetivo da unidade abaixo do mínimo: {pessoas} de {minimo}{faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'erro' },
        postoFora:           { texto: '{posto} fora da escala: abaixo do mínimo de {minimo}{faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'erro' },
        /* efetivo do posto fora dos limites (uma linha por posto); {faixas} = ", das 20:00 às 08:00" quando é só parte do dia */
        abaixoMinimo:        { texto: 'Efetivo abaixo do mínimo: {posto} ({pessoas} de {minimo}){faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'erro' },
        abaixoIdeal:         { texto: 'Efetivo abaixo do ideal: {posto} ({pessoas} de {ideal}){faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'alerta' },
        acimaMaximo:         { texto: 'Efetivo acima do máximo: {posto} ({pessoas} de {maximo})', icone: 'icone-alerta', nivel: 'erro' },
        /* militar de serviço sem função com modelo válido (o painel escolhe singular ou plural; o mesmo texto da análise de Trocas e Folgas) */
        semFuncao:           { texto: 'Existe militar sem função', textoPlural: 'Existem militares sem função', icone: 'icone-alerta', nivel: 'erro' },
        /* regras e habilitação, conferidas em toda colocação (automática ou manual); {militar} = grad + nome */
        cnhIncompativel:     { texto: 'Condutor sem a CNH exigida: {militar} em {posto}', icone: 'icone-alerta', nivel: 'erro' },
        regraProibida:       { texto: 'Função proibida pela regra: {militar} em {funcao}', icone: 'icone-alerta', nivel: 'erro' },
        exclusivoFora:       { texto: 'Militar exclusivo fora da sua função: {militar} em {funcao}', icone: 'icone-alerta', nivel: 'alerta' },
        grauDiferente:       { texto: 'Grau diferente do ideal: {militar} em {funcao}', icone: 'icone-alerta', nivel: 'alerta' },
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
      continuosOutros: function (n) { return 'Contínuos em outros ciclos (' + n + ')'; },
      continuosFora: 'Fora da escala',
      continuosVazioNaEscala: 'Nenhum contínuo nesse dia.',
      continuosVazioOutros: 'Nenhum contínuo em outros ciclos.',
      continuosVazioFora: 'Todos os militares já estão no ciclo.',
      continuosSaiEm: 'Sai em {data}',
      continuosAfastadoAte: '{motivo} até {data}',
      continuosEntraEm: 'Entra em {data}',
      continuosDeFolga: 'De folga neste dia',
      btnRemover: 'Remover',
      btnAdicionar: 'Adicionar',
      btnCancelarSaida: 'Cancelar saída',
      btnDesmarcar: 'Desmarcar',
      confirmarRemover: 'Remover {pessoa} do ciclo a partir de {data}? O que vai acontecer:',
      /* o Dia (a lista, a edição da linha, o Adicionar militar e a folga no dia) */
      deFolga: 'De folga',
      semFuncaoRotulo: 'Sem função',
      semNinguemTexto: 'Sem ninguém',
      /* o Cabo de Dia sem ninguém na Central (só para quem administra) */
      semCaboDia: 'Sem cabo ou soldado de serviço',
      /* Funções do posto (o ícone no título do posto, para quem edita o dia): o título do menu, o que vai ao lado da
         função travada e o motivo da caixa desligada */
      funcoesTitulo: function (posto) { return (/^Central/.test(posto || '') ? 'Funções da ' : 'Funções do ') + (posto || ''); },
      funcoesMinimo: 'Mínimo',
      funcoesDicaMinimo: 'É do mínimo do posto e fica sempre na escala.',
      funcoesDicaOcupada: 'Para tirar quem está aqui, use o lápis da linha e escolha Ninguém.',
      funcoesDicaAnterior: 'Marque antes a função anterior.',
      funcoesDicaSeguinte: 'Desmarque antes a função seguinte.',
      funcoesDicaLapis: 'Use o lápis da linha para pôr alguém nela.',
      /* a lista Quem da vaga: quem é o mais antigo (assume o papel sozinho) e o motivo de quem não pode */
      seletorAssume: { chefe_socorro: 'Vai assumir o Chefe de Socorro', oficial_area: 'Vai assumir o Oficial de Área' },
      /* a edição da linha (o lápis), o campo de militar, o Adicionar e o Remover militar, a nota O que mudou e o
         Voltar o dia ao automático */
      linha: {
        diaTodoDica: 'O horário já é o dia todo',
        /* o campo de militar */
        digiteOuEscolha: 'Digite o nome ou escolha',
        carregando: 'Carregando…',
        ninguemPode: 'Ninguém pode entrar nesta função',
        ninguemDisponivel: 'Ninguém disponível',
        grupoAqui: function (unidade) { return 'De serviço no ' + unidade; },
        grupoOutra: 'De serviço em outra unidade',
        grupoFolga: 'De folga',
        grupoNaoPodem: 'Não podem',
        grupoFora: 'Fora do ciclo',
        grupoNoCiclo: 'Já estão no ciclo',
        infoSemFuncao: 'Sem função',
        infoLivre: 'Livre o dia todo',
        infoFora: 'Fora do ciclo',
        infoUltimo: function (data) { return 'Último serviço em ' + data; },
        infoEntraEm: function (data) { return 'Entra no ciclo em ' + data; },
        infoServeHoje: 'De serviço pelo ciclo hoje',
        infoAfastado: function (motivo, data) { return motivo + ' até ' + data; },
        /* os botões que confirmam cada escolha */
        porNaFuncao: function (militar, funcao) { return 'Pôr o ' + militar + ' no ' + funcao; },
        escolhaFuncao: 'Escolha a função',
        salvarHorario: 'Salvar o horário',
        bancoSim: function (horas) { return 'Contabilizar +' + horas; },
        /* o que acontece com quem sai */
        efeitoSemFuncao: function (militar, funcao) { return 'O ' + militar + ' sai do ' + funcao + ' e fica de serviço sem função.'; },
        efeitoContinua: function (militar, funcao, lugares) {
          return 'O ' + militar + ' sai do ' + funcao + ' e continua ' + lista('no', lugares) + '.';
        },
        ninguemMais: 'Ninguém mais muda de lugar.',
        efeitoSai: function (militar, funcao) { return 'O ' + militar + ' sai do ' + funcao + '.'; },
        papelJunto: function (militar, papel) { return 'O ' + militar + ' continua ' + papel + ', e o sistema refaz o dia em volta dele.'; },
        ficaVazio: function (funcao) { return 'O ' + funcao + ' fica vazio.'; },
        /* o serviço no dia: "das 08h às 08h, pelo ciclo"; o pedaço que sai vira folga */
        servicoTexto: function (lista) {
          var por = { pontual: ', pontual', troca: ', por troca', extra: ', de extrajornada' };
          var partes = lista.map(function (p) { return 'das ' + p.hi + ' às ' + p.hf + (por[p.origem] || ', pelo ciclo'); });
          return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : (partes[0] || '');
        },
        folgaParte: function (periodos, militar, horas) {
          return periodos.charAt(0).toUpperCase() + periodos.slice(1) + ', o ' + militar + ' fica de folga (' + horas + '). No banco de horas:';
        },
        descontar: function (horas) { return 'Descontar ' + horas; },
        naoDescontar: 'Não descontar',
        /* Remover do dia */
        tirarFolga: function (militar, data, horas) { return 'O ' + militar + ' fica de folga em ' + data + ' (' + horas + '). No banco de horas:'; },
        tirarPontualTexto: function (militar, horas) { return 'Este pontual somou +' + horas + ' ao banco de horas do ' + militar + '. No banco de horas:'; },
        tirarPontualSim: function (horas) { return 'Tirar as ' + horas; },
        tirarPontualNao: 'Manter as horas',
        erroPeriodos: 'Os horários se cruzam. Ajuste os horários.',
        /* O que mudou: uma frase por militar e o atalho */
        mudouEntrou: function (militar, depois) { return 'O ' + militar + ' entrou ' + lista('no', depois) + '.'; },
        mudouPassou: function (militar, antes, depois) { return 'O ' + militar + ' passou ' + lista('do', antes) + ' para ' + lista('o', depois) + '.'; },
        mudouSemFuncao: function (militar, antes) { return 'O ' + militar + ' saiu ' + lista('do', antes) + ' e ficou sem função.'; },
        mudouSaiu: function (militar, antes) { return 'O ' + militar + ' saiu ' + lista('do', antes) + '.'; },
        mudouHorario: function (militar, periodos) { return 'O ' + militar + ' continua nas mesmas funções, agora ' + (periodos || 'o dia todo') + '.'; },
        mudouDeixou: function (militar, deixou) { return 'O ' + militar + ' deixou ' + lista('o', deixou) + '.'; },
        mudouGanhou: function (militar, ganhou) { return 'O ' + militar + ' passou a fazer também ' + lista('o', ganhou) + '.'; },
        atalho: function (militar, funcao) { return 'Pôr o ' + militar + ' no ' + funcao; },
        atalhoLugar: function (militar, outro) { return 'Pôr o ' + militar + ' no lugar que o ' + outro + ' deixou'; },
        /* Voltar o dia ao automático */
        automaticoConfirmar: function (data) {
          return 'Voltar o dia ' + data + ' ao automático? Os ajustes manuais desta unidade no dia saem e o sistema distribui de novo.';
        },
        automaticoBotao: 'Voltar ao automático',
        /* Adicionar militar: somente no dia ou no ciclo, a partir do dia */
        adicionarNoDia: function (militar, data) { return 'Adicionar o ' + militar + ' em ' + data; },
        ultimoRotulo: function (militar) { return 'Último serviço do ' + militar + ' no ciclo atual'; },
        cicloServeHoje: function (militar, data) {
          return 'O ' + militar + ' já está de serviço pelo ciclo em ' + data + ': começando nesse dia, o ciclo novo cairia nos mesmos dias do atual. Nada muda.';
        },
        cicloRemovido: function (militar, ultimo, saem, novo) {
          return 'O ' + militar + ' será removido do seu ciclo atual depois do serviço de ' + ultimo + '. '
            + (saem.length > 1 ? 'Os serviços de ' + juntarComE(saem) + ' saem da escala dele, e o ciclo novo começa em '
              : saem.length ? 'O serviço de ' + saem[0] + ' sai da escala dele, e o ciclo novo começa em ' : 'O ciclo novo começa em ')
            + novo + '.';
        },
        cicloEscalaUltimo: function (ultimo, data) { return 'O último serviço no ciclo atual é em ' + ultimo + ' e o novo começa em ' + data + '.'; },
        botaoContinuar: 'Continuar',
        botaoMudarCiclo: 'Mudar o ciclo',
        cicloMudar: function (desde, ultimo, novo) {
          return 'No ciclo desde ' + desde + '.' + (ultimo ? ' Último serviço nele: ' + ultimo + '.' : '') + ' O ciclo novo começa em ' + novo + '.';
        },
        cicloMudarAviso: function (ultimo) {
          return 'Ao continuar, você vê o que acontece com as trocas, folgas e extras dele ' + (ultimo ? 'depois de ' + ultimo : 'a partir desse dia') + ', antes de confirmar.';
        },
        cicloEntrar: function (data) { return 'Ele entra no ciclo de serviço a partir de ' + data + ' e segue nos próximos dias.'; },
        /* a linha marcada no rascunho do ciclo (ainda não salva) */
        cicloMarcado: { entrar: 'Entra no ciclo em {data}', sair: 'Sai do ciclo em {data}', mudar: 'Muda de ciclo em {data}', cancelar_saida: 'Saída cancelada' },
        cicloConfirmarMudar: function (militar, data) { return 'Mudar o ciclo do ' + militar + ' a partir de ' + data + '? O que vai acontecer:'; },
        cicloEscalaMudar: function (data) { return 'O ciclo atual termina na véspera e o novo começa em ' + data + '.'; },
        /* Adicionar militar: o botão diz o que falta ou o que vai acontecer */
        escolhaQuem: 'Escolha quem entra',
        escolhaQuemSai: 'Escolha quem sai',
        marqueFuncao: 'Marque uma função',
        porNoLugar: function (entra, sai) { return 'Pôr o ' + entra + ' no lugar do ' + sai; },
        ninguemDeServico: 'Ninguém de serviço nesse horário',
        /* De quais funções: "Efetivo 3 da ABT-14935, das 13h às 20h"; e o que acontece com quem sai */
        funcaoNoHorario: function (lugar, periodos) { return lugar + (periodos ? ', ' + periodos : ''); },
        lugarSaiSem: function (militar, funcoes, periodos) {
          return 'O ' + militar + ' sai ' + lista('do', funcoes) + ' e fica sem função' + (periodos ? ' ' + periodos : '') + '.';
        },
        lugarSaiContinua: function (militar, funcoes, outras) { return 'O ' + militar + ' sai ' + lista('do', funcoes) + ' e continua ' + lista('no', outras) + '.'; },
        /* o lápis: só quem está no dia; "Ninguém" deixa a função vazia */
        ninguem: 'Ninguém',
        ninguemInfo: 'A função fica vazia',
        deixarVazio: function (funcao) { return 'Deixar o ' + funcao + ' vazio'; },
        entraSaiDe: function (militar, lugares) { return 'O ' + militar + ' sai ' + lista('do', lugares) + (lugares.length > 1 ? ', que ficam vazios.' : ', que fica vazio.'); },
        ficaVazioDas: function (funcao, periodos) { return 'O ' + funcao + ' fica vazio ' + periodos + '.'; },
        mudeAlgo: 'Mude o militar ou o horário',
        escolhaQuemFica: 'Escolha quem fica',
        /* Remover militar: a origem de cada parte ("Pelo ciclo, das 08h às 20h") e o botão */
        parte: function (origem, periodos) {
          var nomes = { ciclo: 'Pelo ciclo', pontual: 'Pontual', troca: 'Por troca' };
          return (nomes[origem] || '') + ', ' + periodos;
        },
        escolhaParte: 'Escolha o que sai',
        removerDoDia: function (militar) { return 'Remover o ' + militar + ' do dia'; },
        removerHorario: function (militar) { return 'Remover o ' + militar + ' nesses horários'; },
        /* Remover militar › o remanejado: volta só para a unidade de origem ou sai do dia */
        remanejadoTexto: function (militar, origem, destino, fica, automatico) {
          if (fica) return 'O ' + militar + ' está n' + artigo(origem) + ' ' + origem + ' e n' + artigo(destino) + ' ' + destino + ' neste dia, por remanejamento.';
          if (automatico) {
            return 'O ' + militar + ' foi remanejado d' + artigo(origem) + ' ' + origem + ' para ' + artigo(destino) + ' ' + destino
              + ' pelo sistema, porque não há oficial de serviço. Ao devolver, o Oficial de Área fica vazio.';
          }
          return 'O ' + militar + ' foi remanejado d' + artigo(origem) + ' ' + origem + ' para ' + artigo(destino) + ' ' + destino + ' neste dia.';
        },
        remanejadoPara: function (destino) { return 'Remanejado para ' + artigo(destino) + ' ' + destino; },
        devolverA: function (origem) { return 'Devolver ' + (artigo(origem) === 'a' ? 'à ' : 'ao ') + origem; },
        devolver: function (militar, origem) { return 'Devolver o ' + militar + (artigo(origem) === 'a' ? ' à ' : ' ao ') + origem; },
        /* Remanejar militar: as perguntas e o botão ("Remanejar o 3ºSgt. Ceranto para a 2ªCIBM") */
        escolhaQuemVai: 'Escolha quem vai',
        escolhaUnidade: 'Escolha a unidade',
        escolhaSeSai: 'Escolha se ele sai da unidade de origem',
        remanejarSai: function (militar, origem) { return 'O ' + militar + ' sai d' + artigo(origem) + ' ' + origem + ' neste dia?'; },
        remanejarSoNa: function (destino) { return 'Sim, fica só n' + artigo(destino) + ' ' + destino; },
        remanejarNasDuas: function (origem, destino) { return 'Não, fica n' + artigo(origem) + ' ' + origem + ' e n' + artigo(destino) + ' ' + destino; },
        remanejar: function (militar, destino) { return 'Remanejar o ' + militar + ' para ' + artigo(destino) + ' ' + destino; },
        /* Remover militar › por troca: o documento (RW), os documentos alterados e o que acontece (Como fica) */
        trocaRw: function (numero, ano) { return numero ? 'RW nº ' + numero + '/' + ano : 'Troca'; },
        trocaNoLugar: function (cumpre, noLugarDe) { return cumpre + ' no lugar de ' + noLugarDe; },
        trocaDia: function (data, horas) { return data + ', ' + horas; },
        trocaDoc: function (numero, ano, parteNumero, parteAno) {
          return 'RW nº ' + numero + '/' + ano + (parteNumero ? ', Parte nº ' + parteNumero + '/' + parteAno : ', sem Parte');
        },
        trocaVolta: function (data, horas, militar) { return 'Em ' + data + (horas ? ', ' + horas : '') + ', o ' + militar + ' volta ao serviço.'; },
        trocaDeixa: function (data, sai, volta) { return 'Em ' + data + ', o ' + sai + ' sai do dia e o ' + volta + ' continua de folga.'; },
        trocaSaldo: function (deve, horas, a) { return 'O ' + deve + ' fica devendo ' + horas + ' ao ' + a + '.'; },
        trocaSemSaldo: 'Não fica saldo de horas entre eles.',
        trocaBanco: function (quem, horas, negativo) { return 'O banco de horas do ' + quem + ' perde ' + horas + (negativo ? ' e fica negativo.' : '.'); },
        trocaSemMudanca: 'A troca continua valendo, sem saldo e sem desconto.',
        trocaConflito: function (tipo, quem, data) {
          var t = { ferias: 'está de férias', afastado: 'está de licença ou dispensa', duas_unidades: 'fica em duas unidades ao mesmo tempo',
            sobreposicao: 'fica com dois serviços no mesmo horário' };
          return 'O ' + quem + ' ' + (t[tipo] || 'tem outro compromisso') + ' em ' + data + '.';
        },
        escolhaFazer: 'Escolha o que fazer',
        escolhaTroca: 'Escolha a troca',
        escolhaHoras: 'Escolha para onde vão as horas',
        confirmarCancelamento: 'Confirmar cancelamento',
        erroRemover: 'O horário que sai precisa ficar dentro do serviço que ele tem no dia.'
      },
      seletorMotivo: {
        horario: function (periodos) { return 'De serviço só ' + periodos; },
        regra: function (funcao) { return 'Regra: não pode ser ' + funcao; },
        cnh: function (cnh) { return 'Sem a CNH ' + cnh; }
      },
      /* dia sem ninguém de serviço na unidade */
      semDistribuicao: 'Sem distribuição neste dia.',
      alteracoesNaoSalvas: function (n) { return n === 1 ? '1 alteração não salva' : n + ' alterações não salvas'; },
      /* o Salvar do rodapé largo (as três abas do painel do dia de uma vez): o Cancelar e a recusa */
      painelDescartar: function (n) { return n === 1 ? 'Descartar a alteração não salva?' : 'Descartar as ' + n + ' alterações não salvas?'; },
      painelRecusado: function (erro) { return 'Nada foi salvo. ' + erro; },
      /* "Condutor da AA-01", "Rancheiro do Rancho" */
      funcaoNoPosto: function (funcao, posto, feminino) { return funcao + (feminino ? ' da ' : ' do ') + posto; },
      dasAs: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
      formBotaoAplicar: 'Aplicar',
      ninguemEncontrado: 'Ninguém encontrado.',
      novaFuncao: function (nome) { return 'Nova função: ' + nome; },
      /* situação da função no horário (as listas do Onde) */
      itemVazia: 'vazia',
      itemSai: function (nomes) { return nomes.join(' e ') + (nomes.length > 1 ? ' saem' : ' sai'); },
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
      /* listas do Quem: o que já ocupa o dia de quem tem horas livres ("Extra das 08h às 02h") */
      ocupadoNoDia: function (lista) {
        var nome = { servico: 'serviço', extra: 'extra', pontual: 'pontual', troca: 'troca', folga: 'folga' };
        var partes = lista.map(function (p) { return (nome[p.tipo] || nome.servico) + ' das ' + p.hi + ' às ' + p.hf; });
        var t = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : partes[0];
        return t.charAt(0).toUpperCase() + t.slice(1);
      },
      folgaSiMesmo: 'Você não pode dar folga a si mesmo.',
      /* a folga no dia (o lápis da caixa De folga): o horário, o efeito de cancelar e a confirmação */
      folgaNoDia: function (periodo, contabilizada) {
        return 'De folga ' + (periodo || 'o dia todo') + ', ' + (contabilizada ? 'contabilizada' : 'não contabilizada');
      },
      cancelarFolgaEfeito: function (militar, contabilizada) {
        return 'Ao cancelar, o ' + militar + ' volta ao serviço no dia e a distribuição é refeita. '
          + (contabilizada ? 'Como a folga foi contabilizada, as horas dela voltam ao saldo.' : 'Como a folga não foi contabilizada, o saldo dele não muda.');
      },
      confirmarCancelarFolga: function (militar, data) { return 'Cancelar a folga do ' + militar + ' em ' + data + '?'; },
      falhaAcaoCiclo: 'Não foi possível alterar o ciclo. Tente de novo.',
      /* embaixo do prefixo, na troca de viatura com data */
      noLugarDe: 'No lugar da {prefixo} até {data}',
      /* linha da cadeira vazia (sem ninguém), no lugar do nome do militar */
      /* a cadeira vazia; 'aberta' = a função que o administrador abriu sem ninguém (em cinza, não é erro) */
      vagaVazia: function (motivo) { return motivo === 'aberta' ? 'Vazio' : motivo === 'trava' ? 'Sem solução automática' : (motivo === 'habilitado' ? 'Vazio por falta de habilitado' : 'Vazio por falta de efetivo'); },
      /* dica do ícone do militar de outra unidade: "Do 2ºPEL" / "Da 2ªCIBM" */
      deOutraUnidade: function (nome) { return (/ª/.test(nome || '') ? 'Da ' : 'Do ') + (nome || ''); },
      /* dica do ícone do militar remanejado: "Remanejado do 2ºPEL, só neste dia" */
      remanejadoDe: function (nome) { return 'Remanejado d' + artigo(nome) + ' ' + (nome || '') + ', só neste dia'; },
      /* Observações do dia (notas do admin, trocas, folgas, outra unidade, remanejados) — o banco manda os dados, aqui vira texto */
      observacoesTitulo: 'Observações',
      /* o Copiar do título da caixa: a dica depois de copiar e o aviso quando o navegador não deixa */
      observacoesCopiado: 'Copiado',
      observacoesFalhaCopiar: 'Não foi possível copiar. Tente de novo.',
      /* os grupos, na ordem fixa em que aparecem */
      observacoesGrupos: { admin: 'Administração', troca: 'Trocas', folga: 'Folgas', outra_unidade: 'De outra unidade', remanejado: 'Remanejados' },
      observacaoLimite: 200,
      observacaoTexto: function (o) {
        function hh(t) { return t ? (String(t).slice(3) === '00' ? String(t).slice(0, 2) + 'h' : t) : ''; }
        function quem(g, n) { return ((g ? g + ' ' : '') + (n || '')).trim(); }
        /* "das 08h às 09h", "das 08h às 09h e das 10h às 11h", "das 08h às 09h, das 10h às 11h e das 14h às 15h" */
        function periodos(lista) {
          var t = lista.map(function (p) { return 'das ' + hh(p.hi) + ' às ' + hh(p.hf); });
          return t.length > 1 ? t.slice(0, -1).join(', ') + ' e ' + t[t.length - 1] : t[0];
        }
        if (o.classe === 'admin') return o.texto || '';
        if (o.classe === 'outra_unidade') {
          var de = (/ª/.test(o.de_unidade || '') ? 'da ' : 'do ') + (o.de_unidade || '');
          if (o.hi === o.hf) return quem(o.grad, o.nome) + ' veio ' + de + '.';
          return quem(o.grad, o.nome) + ' veio ' + de + ' das ' + hh(o.hi) + ' às ' + hh(o.hf) + '.';
        }
        if (o.classe === 'remanejado') {
          var noHorario = o.hi === o.hf ? '' : ', das ' + hh(o.hi) + ' às ' + hh(o.hf);
          if (o.fica) {
            return quem(o.grad, o.nome) + ' está n' + artigo(o.de_unidade) + ' ' + (o.de_unidade || '') + ' e n' + artigo(o.para_unidade) + ' '
              + (o.para_unidade || '') + noHorario + ', por remanejamento.';
          }
          return quem(o.grad, o.nome) + ' foi remanejado d' + artigo(o.de_unidade) + ' ' + (o.de_unidade || '') + ' para '
            + artigo(o.para_unidade) + ' ' + (o.para_unidade || '') + noHorario
            + (o.automatico ? ' pelo sistema, porque não há oficial de serviço.' : '.');
        }
        if (o.classe === 'folga') {
          if (o.dia_inteiro || o.hi === o.hf) return quem(o.grad, o.nome) + ' está de folga o dia todo.';
          return quem(o.grad, o.nome) + ' está de folga das ' + hh(o.hi) + ' às ' + hh(o.hf) + '.';
        }
        /* troca: quem cumpre a escala de quem, os períodos (serviço inteiro: sem período), a parte do E-protocolo
           (só quando a troca tem o número) e a devolução; no dia da devolução, a frase invertida com a data da troca de origem */
        var todos = o.periodos || [];
        var comHora = todos.filter(function (p) { return p.hi && p.hf; });
        var inteiro = !comHora.length || comHora.length < todos.length;
        var frase = quem(o.cobre_grad, o.cobre_nome) + ' cumpre a escala de serviço do ' + quem(o.saiu_grad, o.saiu_nome)
                  + (inteiro ? '' : ', no período ' + periodos(comHora))
                  + (o.tipo === 'devolucao' ? ', como devolução da troca de ' + (o.orig_data || '') : '')
                  + (o.parte_numero ? ', conforme a Parte nº ' + o.parte_numero + '/' + o.parte_ano : '') + '.';
        if (o.tipo === 'devolucao') return frase;
        if (o.dev_pendente) return frase + ' As horas entram no saldo de horas entre os dois.';
        if (!o.dev_hi || !o.dev_hf) return frase + ' A devolução ocorrerá no serviço de ' + (o.dev_data || '') + '.';
        return frase + ' A devolução ocorrerá em ' + (o.dev_data || '') + ', das ' + hh(o.dev_hi) + ' às ' + hh(o.dev_hf) + '.';
      },
      /* Imprimir escala (painel → PDF; escalas-impressao.js e escalas-impressao-pdf.js) */
      impressao: {
        titulo: 'Imprimir escala',
        subtitulo: 'Arquivo em PDF, A4 retrato',
        dataInvalida: 'Data inválida.',
        fimAntesInicio: 'A data final não pode ser antes da inicial.',
        limiteDias: 'Escolha até 31 dias por arquivo.',
        /* a nota do alto ("Será impresso:"): "Escala de 21/10/2026, 2ªCIBM e 2ºPEL." */
        resumo: function (periodo, unidades) { return 'Escala de ' + periodo + ', ' + unidades + '.'; },
        /* "21/10/2026", "21/10 a 27/10/2026" ou, entre dois anos, "28/12/2026 a 03/01/2027" (de e ate em dd/mm/aaaa) */
        periodo: function (de, ate) {
          if (de === ate) return de;
          return de.slice(6) === ate.slice(6) ? de.slice(0, 5) + ' a ' + ate : de + ' a ' + ate;
        },
        /* aviso do painel quando algum dia do período tem erro grave (vermelho) */
        avisoTitulo: function (n) { return n === 1 ? 'Erro grave em 1 dia do período' : 'Erro grave em ' + n + ' dias do período'; },
        avisoDescricao: function (lista) { return lista + '. O PDF sai do jeito que está na escala.'; },
        /* dica do Imprimir do painel do dia desligado: o PDF sai do que está gravado */
        salveAntes: 'Salve as alterações antes de imprimir.',
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
        },
        /* painel e PDF das grades: Agenda, Calendário e Colunas (escalas-impressao-grade.js e -grade-pdf.js) */
        grade: {
          titulos: { agenda: 'Imprimir agenda', calendario: 'Imprimir calendário', 'colunas-dias': 'Imprimir colunas', 'colunas-unidades': 'Imprimir colunas' },
          nomes: { agenda: 'Agenda', calendario: 'Calendário', 'colunas-dias': 'Colunas', 'colunas-unidades': 'Colunas' },
          subtitulo: function (paisagem, continua) {
            var folha = 'A4 ' + (paisagem ? 'paisagem' : 'retrato');
            return continua ? 'PDF em página contínua, na largura da ' + folha : 'Arquivo em PDF, ' + folha;
          },
          /* as datas: "4 a 10 de outubro", "1 a 3, 11 a 17 e 25 a 31 de outubro", "outubro de 2026" */
          trecho: function (inicio, fim) { return inicio === fim ? inicio : inicio + ' a ' + fim; },
          juntar: function (lista) { return lista.length > 1 ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1] : (lista[0] || ''); },
          doMes: function (dias, nomeMes) { return dias + ' de ' + nomeMes; },
          comAno: function (texto, ano) { return texto + ' de ' + ano; },
          /* a frase embaixo do período (só quando não sai o mês todo) e o nome de cada botão de semana */
          semanas: function (numeros, datas) {
            var lista = numeros.length > 1 ? numeros.slice(0, -1).join(', ') + ' e ' + numeros[numeros.length - 1] : numeros[0];
            return (numeros.length > 1 ? 'Semanas ' : 'Semana ') + lista + ': ' + datas + '.';
          },
          semanaRotulo: function (n, datas) { return 'Semana ' + n + ', ' + datas; },
          dias: function (n, datas) { return n + (n === 1 ? ' dia: ' : ' dias: ') + datas + '.'; },
          /* a nota do alto ("Será impresso:"): "Calendário de outubro de 2026, 2ªCIBM, 1ºPEL e 2ºPEL, sem filtros." */
          doMesDaTela: function (texto) { return 'de ' + texto; },
          daSemana: function (texto) { return 'da semana de ' + texto; },
          resumo: function (grade, periodo, unidades, filtros) {
            var comFiltros = filtros.length ? (filtros.length > 1 ? 'com os filtros ' : 'com o filtro ') + filtros.join('; ') : 'sem filtros';
            return grade + ' ' + periodo + ', ' + unidades + ', ' + comFiltros + '.';
          },
          longaDemais: 'A página contínua ficou longa demais para os leitores de PDF. Escolha Folhas A4 ou um período menor.',
          arquivo: function (nome, periodo, unidade, prefixo) { return (prefixo || 'Escala') + ' ' + nome.toLowerCase() + ' ' + (unidade ? unidade + ' ' : '') + periodo + '.pdf'; }
        }
      },
      /* Lançar no SYSBM: o bloco do painel do dia (escalas-sysbm.js) e o preenchedor da extensão do Firefox, na tela
         do SYSBM (extensao-sysbm/preencher.js, que leva uma cópia deste arquivo) */
      sysbm: {
        resumo: function (n) { return n === 1 ? '1 linha para lançar.' : n + ' linhas para lançar.'; },
        /* a linha amarela do bloco fechado */
        foraResumo: function (n) { return n === 1 ? '1 militar fica de fora do SYSBM.' : n + ' militares ficam de fora do SYSBM.'; },
        falhaLer: 'Não foi possível ler a escala. Clique em Enviar para tentar de novo.',
        juntar: juntarComE,
        comFuncao: function (militar, funcao) { return militar + ' (' + funcao + ')'; },
        semRg: function (nomes) { return 'Sem RG no cadastro, fica de fora: ' + nomes + '.'; },
        semPar: function (nomes) { return 'Função sem par no SYSBM, fica de fora: ' + nomes + '.'; },
        fora: function (nomes) { return 'Da companhia só vai o Oficial de Área. Fica de fora: ' + nomes + '.'; },
        semFuncao: function (nomes) { return 'Sem função, fica de fora: ' + nomes + '.'; },
        enviar: 'Enviar',
        enviado: 'Enviado',
        /* no bloco, depois do Enviar (a extensão abriu a aba do SYSBM e preenche depois do login) */
        instrucao: 'A aba do SYSBM abriu. Faça seu login, se ele pedir, e a extensão preenche a tela de cadastro. Confira e clique em Salvar.',
        falhaEnviar: 'Não foi possível enviar. Tente de novo.',
        /* no bloco, fora do Firefox (o envio é só pela extensão do Firefox) */
        soFirefox: 'Essa funcionalidade está disponível apenas no navegador Mozilla Firefox.',
        /* o Enviar desligado: há mudança deste dia ainda não salva no painel */
        salveAntes: 'Salve as alterações do dia antes de lançar no SYSBM.',        /* no bloco, quando a extensão é instalada com o painel aberto (o Instalar vira o Enviar) */
        extensaoInstalada: 'Extensão instalada. Já pode enviar.',
        /* o termo de responsabilidade, na janela de confirmação antes do primeiro Enviar de cada administrador.
           versao muda JUNTO com o texto e com _sysbm_termo_versao() do banco (todos dão ciência de novo) */
        termo: {
          versao: 2,
          titulo: 'Termo de responsabilidade do envio ao SYSBM',
          itens: [
            'A extensão Roster Work é uma ferramenta de apoio do Roster Work. Ela não é um sistema oficial do CBMPR nem faz parte do SYSBM.',
            'O envio é para quem administra o pelotão no Roster Work e tem permissão para cadastrar a escala no SYSBM, sempre com o próprio login.',
            'A extensão só preenche a tela de cadastro e nunca salva. Você confere cada linha antes de clicar em Salvar e responde pelo que for salvo no SYSBM.',
            'No celular, o botão Salvar do SYSBM vira Voltar para RW e, depois do Salvar e Continuar, você volta ao Roster.',
            'A escala, com nomes, RG e horários, passa do Roster Work para o SYSBM dentro do seu navegador. A extensão não guarda esses dados nem os envia a outro lugar.',
            'Use o envio de acordo com as normas da corporação e do SYSBM. Se algo for preenchido errado, vale a sua conferência antes de salvar.'
          ],
          nota: 'Ao clicar em Concordo, a sua ciência fica registrada com data e hora.',
          concordo: 'Concordo',
          falha: 'Não foi possível registrar a sua ciência. Tente de novo.'
        },
        /* o preenchedor da extensão, na tela do SYSBM (nas janelas do próprio navegador) */
        extensao: {
          naoEhEscala: 'A escala enviada pelo Roster não pôde ser lida. No Roster, clique em Enviar no painel do dia de novo.',
          semMenu: 'O menu do SYSBM não mostrou o Cadastrar da escala. Confira o seu login e clique em Enviar no Roster de novo.',
          demorou: 'O SYSBM não abriu a tela de cadastro da escala. Confira se você ainda está logado e clique em Enviar no Roster de novo.',
          /* no celular (a aba do Roster foi para o SYSBM), o Salvar da tela de cadastro vira este botão */
          voltarRw: 'Voltar para RW',
          voltarConfirmar: 'Voltar para o Roster Work? O que não foi salvo no SYSBM se perde.',
          trocarDia: function (sysbm, roster) {
            return 'A tela de cadastro do SYSBM está no dia ' + sysbm + '. Pesquisar o dia ' + roster + '? O que não foi salvo nesta tela se perde.';
          },
          semAba: function (cidade) { return 'Esta tela do SYSBM não tem a aba de ' + cidade + '.'; },
          pelonumero: function (roster, sysbm) { return roster + ' na ' + sysbm; },
          /* n: { adicionados, ajustados, desmarcados, iguais, semPosto: [], semMilitar: [], pelonumero: [] } */
          resumo: function (aba, n) {
            var linhas = ['Aba ' + aba + ' preenchida.', '',
              'Adicionados: ' + n.adicionados, 'Ajustados: ' + n.ajustados,
              'Desmarcados: ' + n.desmarcados, 'Já estavam certos: ' + n.iguais];
            if (n.pelonumero.length) linhas.push('', 'Viatura com outro prefixo no SYSBM, lançada pelo número: ' + juntarComE(n.pelonumero) + '.');
            if (n.semPosto.length) linhas.push('', 'Viatura ou seção sem par no SYSBM, lance manualmente: ' + juntarComE(n.semPosto) + '.');
            if (n.semMilitar.length) linhas.push('', 'Militar não achado no SYSBM pelo RG, lance manualmente: ' + juntarComE(n.semMilitar) + '.');
            linhas.push('', 'Confira a aba e clique em Salvar.');
            return linhas.join('\n');
          }
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
      abaixoIdeal: function (unidade, posto, pessoas, ideal) { return unidade + ': efetivo abaixo do ideal em ' + posto + ' (' + pessoas + ' de ' + ideal + ')'; },
      salvarImpacto: 'Salvar este modelo recalcula as escalas já distribuídas que usam esta composição. Continuar?',
      /* papel especial (Chefe de Socorro / Oficial de Área): o modal que pergunta se as funções
         acumuladas em outro posto vão junto quando o papel muda de posto */
      moverPapelTitulo: function (papel) { return 'Mover ' + papel; },
      moverPapelAcumulos: function (papel, origem, destino) {
        return 'Mover o ' + papel + ' de "' + origem + '" para "' + destino + '". Ele tem funções acumuladas. Quer levá-las junto?';
      },
      /* lista do Acúmulo sem nenhuma função que possa entrar no grupo */
      nenhumaFuncaoLivre: 'Nenhuma função livre',
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

    /* Distribuição (nova-distribuicao.html, só administrador): as frases que mudam com a unidade e as respostas.
       {chave} = valor preenchido na hora; os textos fixos ficam em nova-distribuicao.html */
    novaDistribuicao: {
      pagina: 'Distribuição',
      contagem: '{n} de 9 prontos',
      soDeste: 'Só deste pelotão',
      compartilhado: 'Compartilhado com todos os pelotões',
      faltaResponder: 'Falta responder',
      nenhuma: 'Nenhuma',
      nenhum: 'Nenhum',
      escolha: 'Escolha',
      rotuloFuncao: 'Função',
      rotuloGrau: 'Grau',
      rotuloInicio: 'Quantos de serviço',
      /* bloco 1: postos */
      instalacoesPelotao: 'Quais instalações o pelotão tem?',
      instalacoesCompanhia: 'Quais instalações a companhia tem?',
      viaturasPelotao: 'Quais viaturas o pelotão tem?',
      viaturasCompanhia: 'Quais viaturas a companhia tem?',
      semPrefixo: 'Viatura sem prefixo',
      prefixoInvalido: 'Prefixo inválido (use LETRAS-NÚMERO, ex.: ABT-01).',
      prefixoVazio: 'Digite o prefixo da viatura.',
      cnhEscolha: 'Escolha a CNH da viatura.',
      trocaTexto: 'Substituída por {prefixo} (CNH {cnh}) de {inicio} a {fim}',
      trocaMesmoPrefixo: 'Use outro prefixo: este é o da própria viatura.',
      trocaEscolhaCnh: 'Escolha a CNH.',
      trocaErroFim: 'Escolha a data de fim.',
      trocaLimite: 'Só dá para mudar a partir de {data}.',
      trocaUmaPorVez: 'A {viatura} já tem uma substituição temporária.',
      foraTexto: 'Fora de serviço de {inicio} a {fim}',
      foraSemFim: 'Fora de serviço desde {inicio}',
      exclusaoTexto: 'Será removida a partir de {inicio}',
      exclusaoMarcada: 'A exclusão já está marcada.',
      /* bloco 2: efetivo */
      tituloViatura: '{nome} · CNH {cnh}',
      viaturaSemCnh: '{nome} · CNH sem resposta',
      efetivoFalta: 'Efetivo: falta responder',
      reservaFrase: 'Vazia, fica fora da escala. Nunca dá erro nem aviso de efetivo.',
      semMinimoFrases: [
        'Sem o mínimo, fica fora da escala sem aviso.',
        'Sem o mínimo, fica fora da escala com aviso amarelo.',
        'Sem o mínimo, fica fora da escala com erro vermelho.'
      ],
      semPostos: 'Marque as instalações e as viaturas no bloco Postos.',
      travaPapel: 'Escolhido em Funções especiais',
      travaCompanhia: 'Vem da companhia',
      travaSempreEntra: 'Posto do {papel}, sempre entra na escala',
      /* bloco 2: funções especiais */
      ondeFica: 'Onde fica o {papel}?',
      oficialArea: 'Oficial de Área',
      podeConduzir: 'O {papel} pode ser condutor?',
      semOficial: 'Sem oficial de serviço, quem faz o Oficial de Área?',
      condutor: ['Sim, sempre é o condutor da viatura dele', 'Sim, só se não houver outro habilitado', 'Não, nunca'],
      semOficialOpcoes: ['Ninguém, fica vazio com erro vermelho', 'O praça mais antigo da companhia'],
      condutorComAviso: 'Erro amarelo na escala quando o {papel} for condutor',
      condutorSemAviso: 'Sem erro amarelo quando o {papel} for condutor',
      condutorNunca: 'Erro vermelho na escala se não houver condutor',
      mesmaPessoa: 'Nos postos marcados é a mesma pessoa: as funções acumulam (até 3 por pessoa).',
      travaOutra: 'Muda em {unidade}',
      grupoLinha: '{unidade}: {postos}',
      ciaFalta: 'Falta responder onde fica o Oficial de Área na {unidade}: escolha a {unidade} no seletor da barra.',
      /* a Central de Operações do pelotão: quem ela exibe, só para ver (a resposta fechada: os nomes e, com o Cabo de Dia, o
         que fazer sem ninguém disponível, pela opção: 0 não aparece, 1 erro amarelo) */
      centralTitulo: 'Exibir na Central de Operações',
      centralNomes: { oficial: 'Oficial de Área', chefe: 'Chefe de Socorro', cabo: 'Cabo de Dia', extra: 'Extrajornada' },
      centralLinha: function (nomes) { return nomes.length ? juntarComE(nomes) : 'Nenhum'; },
      centralCaboAviso: [
        'Se não houver ninguém disponível, não aparece e não exibe erro.',
        'Se não houver ninguém disponível, aparece com erro amarelo.'
      ],
      /* blocos 3 e 5: acúmulos fixos e por falta */
      opcaoN: '{n}ª opção',
      opcaoLinha: '{n}ª opção {quem}',
      opcaoSemResposta: '{n}ª opção sem resposta',
      tituloFixo: '{funcao} é sempre de quem está em',
      tituloPorFalta: 'Se faltar {funcao}',
      semFuncao: 'Escolha a função',
      opcoesIncompletas: 'Escolha a função e as opções.',
      opcoesVazias: 'Escolha as opções.',
      automaticaSempre: '{funcao} é sempre de quem está em {quem}.',
      /* bloco 6: quem escolher */
      quemSenta: 'Quem senta em {funcao}?',
      ordemMovida: 'Movida para a {n}ª posição.',
      papelFixo: 'Sempre o {perfil} mais antigo de serviço.',
      criterios: [
        'O {perfil} mais antigo que ainda não tem função',
        'O {perfil} mais moderno que ainda não tem função',
        'Um {grau} ou o mais próximo {sentido}',
        'Somente {grau} ou fica vazia'
      ],
      sentidos: ['mais antigo', 'mais moderno'],
      avisos: ['Sem aviso', 'Aviso amarelo', 'Erro vermelho'],
      avisoLinha: ['Sem aviso', 'Com aviso amarelo', 'Com erro vermelho'],
      comCarteira: 'Com a CNH',
      comRodizio: 'Com rodízio',
      /* bloco 7: regras por militar */
      regraIncompleta: 'Escolha o militar, a regra e a função.',
      semMilitar: 'Escolha o militar',
      regraTexto: { proibido: 'Não pode {funcao}', exclusivo: 'Só pode {funcao}' },
      /* bloco 8: conferir */
      estados: { tem_gente: 'Com gente', acumula: 'Acumulada', coberta: 'Coberta', companhia: 'Da companhia', vazia: 'Vazia', fora: 'Fora da escala' },
      porQuem: '{estado} por {quem}',
      sobraUm: '1 militar fica sem função.',
      sobraVarios: '{n} militares ficam sem função.',
      foraMotivo: 'Fora da escala: abaixo do mínimo de {min}.',
      consequencia: 'Vazia por falta de gente no {posto}.',
      dirige: 'O {papel} dirige a {posto}.',
      abaixoMinimo: '{posto} abaixo do mínimo: {pessoas} de {n} pessoas.',
      abaixoIdeal: '{posto} abaixo do ideal: {pessoas} de {n} pessoas.',
      semCondutor: '{posto} sem condutor.',
      postoPessoas: '{posto} ({pessoas} de {n})',
      membroCnh: '{nome} (CNH {cnh})',
      membroSemCnh: '{nome} (sem CNH)',
      foraAviso: '{posto} fora da escala: abaixo do mínimo de {min}.',
      /* a mudança agendada */
      avisoTitulo: 'Mudança agendada para {data}',
      avisoTexto: 'A partir desse dia, a distribuição muda em: {lista}. Os campos que mudam estão marcados com o calendário.',
      avisoTextoGeral: 'A partir desse dia, a distribuição muda. Os campos que mudam estão marcados com o calendário.',
      vendoTitulo: 'Você está vendo a mudança agendada para {data}',
      vendoTexto: 'O que você salvar aqui vale a partir desse dia. Os campos marcados com o calendário são diferentes da distribuição em vigor.',
      mudaEm: 'Muda em {data}: {texto}',
      antes: 'Antes: {texto}',
      blocoMuda: 'Muda em {data}',
      blocoDiferente: 'Diferente da em vigor',
      lista: { e: ' e ', virgula: ', ' },
      salvarTitulo: 'Salvar a distribuição',
      salvarAntes: 'A partir de ',
      salvarDepois: ' (próximo serviço). Para mudar desde o plantão de hoje, escolha outra data.',
      vaiTitulo: 'Vai também para a mudança agendada para {data}:',
      mudarDataTitulo: 'Mudar a data da mudança agendada',
      mudarDataMensagem: 'A partir de quando vale a mudança agendada?',
      cancelarConfirmar: 'Cancelar a mudança agendada para {data}? A distribuição em vigor continua valendo.',
      botaoCancelarMudanca: 'Cancelar a mudança',
      botaoManter: 'Manter',
      botaoSalvar: 'Salvar',
      erroInicio: 'Escolha a data de início.',
      erroOrdemDatas: 'O fim precisa vir depois do início.',
      corrigirAntes: 'Corrija os campos em vermelho antes de salvar.'
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
      /* troca de outros dois militares feita em cima de um serviço que sai (troca em cima de troca):
         "Entre Cb. Veloso e Cb. Mendes, serviço de 22/10/2026 (aprovada): será cancelada junto, porque foi feita sobre um serviço que sai." */
      trocaEmCima: function (entre, servico, devolucao, situacao) {
        return 'Entre ' + entre + ', serviço de ' + servico + (devolucao ? ' e devolução de ' + devolucao : '') +
          (situacao ? ' (' + situacao + ')' : '') + ': será cancelada junto, porque foi feita sobre um serviço que sai.';
      },
      /* troca de outros militares do mesmo pedido de várias trocas, ainda em aberto: cai junto com o registro */
      trocaRegistro: function (entre, servico, devolucao, registro) {
        return 'Entre ' + entre + ', serviço de ' + servico + (devolucao ? ' e devolução de ' + devolucao : '') +
          ': será cancelada junto, porque faz parte do pedido de várias trocas ' + registro + ', que ainda não foi aprovado.';
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
      promocaoDataAnterior: 'A data deve ser posterior à última promoção (ou à data de inclusão).',
      /* a nota da sub-tela Promover: de quando a data tem que ser depois */
      promocaoDepoisUltima: function (data) { return 'A data precisa ser depois de ' + data + ', a última data gravada.'; },
      promocaoDepoisInclusao: function (data) { return 'A data precisa ser depois de ' + data + ', a data de inclusão.'; },
      topoCarreira: 'Já está no topo desta carreira.',
      promocaoTipoInvalida: 'Essa mudança de tipo rebaixaria o militar, não é uma promoção.',
      postoAtualDesconhecido: 'Não foi possível identificar o posto atual deste militar.',
      falhaPromocao: 'Não foi possível promover. Tente de novo.',
      confirmarReadmissao: 'Readmitir {pessoa} ao efetivo? Ele volta como ativo, fora da escala automática (você o recoloca pela aba Ciclo da Escala).',
      falhaReadmissao: 'Não foi possível readmitir. Tente de novo.',
      falhaAdministracao: 'Não foi possível salvar a administração. Tente de novo.',
      /* selo único do card na lista (a situação do militar e, para o administrador, a da conta) */
      seloAtivo: 'Ativo',
      seloInativo: 'Inativo',
      seloInativoDesde: function (data) { return 'Inativo desde ' + data; },
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
    /* a faixa "Esperando a sua resposta" (acima do título de todas as páginas; geral-chamada) */
    chamada: {
      /* o pedido de troca visto por quem responde: o dia que ele tira e o da devolução (o horário, quando é parte do serviço) */
      voceTira: function (dia, trecho) { return 'você tira o serviço em ' + dia + (trecho ? ', ' + trecho : ''); },
      devolucao: function (dia, trecho) { return ' e a devolução é em ' + dia + (trecho ? ', ' + trecho : ''); },
      servicoEm: function (dia, trecho) { return 'o serviço é em ' + dia + (trecho ? ', ' + trecho : ''); },
      /* as várias trocas: quantos serviços dele há no registro e o primeiro dia */
      varias: function (n, dia) { return (n === 1 ? '1 serviço seu' : n + ' serviços seus') + ', o primeiro em ' + dia; },
      aceitarVarias: function (quem) { return 'Aceitar as trocas com ' + quem; },
      /* o selo do prazo */
      faltam: function (n) { return n === 1 ? 'Falta 1 dia' : 'Faltam ' + n + ' dias'; },
      amanha: 'Amanhã',
      hoje: 'Hoje',
      /* a linha do administrador: só o urgente para aprovar */
      admPedidos: function (n) { return n === 1 ? '1 pedido urgente para aprovar' : n + ' pedidos urgentes para aprovar'; },
      admMeta: function (dia) { return 'o mais próximo com serviço em ' + dia; },
      naoAchou: 'Este pedido mudou enquanto você olhava. A faixa foi atualizada.'
    },

    /* Pendências (o que espera decisão: Para mim · Administração) */
    pendencias: {
      contagem: function (n) { return n === 1 ? '1 esperando você' : n + ' esperando você'; },
      /* o cartão de cada pedido: quem e o quê, e a linha de apoio */
      trocaAdmin: function (sol, par) { return sol + ' troca com ' + par; },
      trocaMinha: function (sol) { return sol + ' quer trocar com você'; },
      /* a alteração de uma troca aprovada (quem pediu pode ser o solicitado) */
      trocaAdminAlteracao: function (sol, par) { return 'Alteração da troca de ' + sol + ' com ' + par; },
      trocaMinhaAlteracao: function (quemPediu) { return quemPediu + ' quer alterar uma troca com você'; },
      /* a troca com o seu aceite faltando (aprovada sem ele, registrada pela administração ou alterada direto) */
      trocaAceitar: function (outro) { return 'Aceitar a troca com ' + outro; },
      faltaAceitar: 'Falta aceitar',
      folga: function (nome) { return nome + ' pediu folga'; },
      dados: function (nome) { return nome + ' pediu correção de dados'; },
      metaServico: function (data, trecho) { return 'Serviço de ' + data + ' · ' + trecho; },
      servicoInteiro: 'serviço inteiro',
      trechoHoras: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
      metaDados: function (n, data) { return (n === 1 ? '1 alteração' : n + ' alterações') + ' · pedido em ' + data; },
      /* o resumo do cartão que abre ali mesmo: quem trabalha no lugar de quem (com o horário, quando é parte do serviço)
         e o que passa dos dias mostrados */
      resumoNoLugar: function (quem, deQuem, trecho) { return quem + ' no lugar de ' + deQuem + (trecho ? ', ' + trecho : ''); },
      resumoMais: function (n) { return 'e mais ' + n + (n === 1 ? ' dia' : ' dias'); },
      resumoFalha: 'Não foi possível carregar o resumo. Veja em Ver detalhes.',
      /* a situação de cada alteração de dados (o resumo dos seus pedidos) */
      situacaoAlteracao: { pendente: 'Pendente', aprovada: 'Aprovada', recusada: 'Recusada' },
      /* Para mim › Seus pedidos: os seus pedidos em andamento e os resolvidos nos últimos 30 dias */
      trocaVoce: function (outro, resolvida) { return (resolvida ? 'Você quis trocar com ' : 'Você quer trocar com ') + outro; },
      trocaOutro: function (outro, resolvida) { return outro + (resolvida ? ' quis trocar com você' : ' quer trocar com você'); },
      trocaAlteracao: function (outro) { return 'Alteração da troca com ' + outro; },
      folgaVoce: 'Você pediu folga',
      dadosVoce: 'Você pediu correção de dados',
      situacaoDados: { pendente: 'Aguardando aprovação', aprovada: 'Aprovada', recusada: 'Recusada', parcial: 'Aprovada em parte' },
      /* listas sem nada (página Pendências) */
      vazioFazer: 'Nada esperando você.',
      vazioCorrigir: 'Nada para corrigir.',
      /* listas sem nada (as abas Pendências da Trocas, da Folgas e da Usuários) */
      vazioTrocas: 'Nenhum pedido de troca esperando você.',
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

    /* o painel de impressão comum (componente geral-impressao: Escala e Trocas) */
    impressao: {
      /* embaixo da prévia */
      folhas: function (n, continua, paisagem) {
        return continua ? 'Uma página contínua.' : (n === 1 ? '1 folha' : n + ' folhas') + ', A4 ' + (paisagem ? 'paisagem' : 'retrato') + '.';
      },
      falhaPrevia: 'Não foi possível montar a prévia. Tente de novo.',
      falhaGerar: 'Não foi possível gerar o PDF. Tente de novo.'
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
        'pendentes': 'Nenhum saldo de horas.'
      },
      /* selo de situação (por status da troca) */
      situacao: {
        pendente_confirmacao: 'Aguardando confirmação',
        pendente_aprovacao: 'Aguardando aprovação',
        aprovada: 'Aprovada',
        rejeitada_parceiro: 'Recusada',
        rejeitada_admin: 'Recusada pela administração',
        cancelada: 'Cancelada',
        substituida: 'Substituída',
        expirada: 'Expirada'
      },
      /* selo da alteração de uma troca aprovada (a aprovada vira a troca; a de antes fica "Substituída") */
      situacaoAlteracao: {
        pendente_confirmacao: 'Alteração aguardando confirmação',
        pendente_aprovacao: 'Alteração aguardando aprovação',
        rejeitada_parceiro: 'Alteração recusada',
        rejeitada_admin: 'Alteração recusada pela administração',
        cancelada: 'Alteração cancelada',
        expirada: 'Alteração expirada'
      },
      /* painel da troca (componente geral-decisao) */
      painelTitulo: 'Troca de serviço',
      caixaServico: 'Serviço',
      caixaDevolucao: 'Devolução',
      fraseNoLugar: function (quemTrabalha, quemFolga) { return quemTrabalha + ' trabalha no lugar do ' + quemFolga + '.'; },
      devolucaoNaoMarcada: 'Ainda não marcada.',
      /* a alteração: a caixa com a troca de antes, e o aviso na troca que tem uma alteração esperando */
      caixaAntes: 'Antes',
      antesDevolucao: function (dia, trecho) { return 'Devolução em ' + dia + ', ' + trecho + '.'; },
      antesDevolucaoPendente: 'Devolução pelo saldo de horas.',
      alteracaoAguardando: 'Esta troca tem uma alteração aguardando. Até ela ser aprovada, a troca continua como está.',
      /* a parte do E-protocolo que formaliza a troca (caixa Serviço do painel; sem número, a linha não aparece) */
      parteNumero: function (numero, ano) { return 'Parte nº ' + numero + '/' + ano; },
      /* o registro da troca: "RW nº 1/2026" na linha da lista e "Registro RW nº 1/2026" nas caixas do painel */
      registroNumero: function (numero, ano) { return 'RW nº ' + numero + '/' + ano; },
      registroCaixa: function (numero, ano) { return 'Registro RW nº ' + numero + '/' + ano; },
      /* a caixa "Aceites e aprovação" do painel: os dois militares, cada um com o aceite ou pendente, e a aprovação */
      caixaAceites: 'Aceites e aprovação',
      aceiteSolicitou: function (dia, hora) { return 'Solicitou em ' + dia + ', às ' + hora; },
      aceiteAceitou: function (dia, hora) { return 'Aceitou em ' + dia + ', às ' + hora; },
      aceitePendente: 'Ainda não aceitou',
      aceiteAprovou: function (dia, hora) { return 'Aprovou em ' + dia + ', às ' + hora; },
      aceiteRegistrou: function (dia, hora) { return 'Registrou e aprovou em ' + dia + ', às ' + hora; },
      aceiteAdministracao: 'Administração',
      aceiteAguardandoAprovacao: 'Aguardando aprovação',
      seloAceitou: 'Aceitou',
      seloAceitePendente: 'Pendente',
      /* o militar sem conta no sistema: o aceite dele fica pendente (não tem como aceitar) */
      seloSemConta: 'Sem conta',
      seloAprovou: 'Aprovou',
      /* quem tem o aceite pendente: a nota no alto do painel e a confirmação do Aceitar */
      faltaAceiteAprovada: 'Falta você aceitar a troca. Ela já foi aprovada e vale na escala; o seu aceite fica no registro.',
      faltaAceite: 'Falta você aceitar a troca. O seu aceite fica no registro.',
      confirmarAceitarDepois: 'Aceitar esta troca? O seu aceite fica no registro e a escala não muda.',
      /* a troca que não vale mais (substituída, cancelada ou expirada): a nota do alto do painel */
      ocorrencia: {
        titulo: { substituicao: function (rw) { return 'Substituída pelo ' + rw + '.'; }, cancelamento: 'Cancelada.', expiracao: 'Expirada.' },
        substituicao: function (dia, hora, por) { return 'Em ' + dia + ', às ' + hora + (por ? ', com a aprovação de ' + por : '') + '.'; },
        cancelamento: function (dia, hora, por) { return 'Em ' + dia + ', às ' + hora + (por ? ', por ' + por : '') + '.'; },
        expiracao: function (dia) { return 'Em ' + dia + ', sem resposta até 7 dias depois do primeiro serviço. O pedido não chegou a valer.'; },
        motivo: function (motivo) { return 'Motivo: ' + motivo; },
        naoVale: { uma: 'Esta troca não vale mais.', varias: 'Estas trocas não valem mais.' },
        abrir: function (rw) { return 'Abrir o ' + rw; },
        falhaAbrir: 'Não foi possível abrir a troca que vale agora. Procure por ela na lista.'
      },
      /* o cancelamento da troca aprovada pede o motivo (fica no registro e vai no aviso) */
      cancelarMotivo: { tituloUma: 'Cancelar a troca', tituloVarias: 'Cancelar as trocas', erro: 'Informe o motivo do cancelamento.' },
      /* o Desfazer da aprovação, no resumo logo depois de aprovar */
      motivoDesfazer: 'A aprovação foi desfeita logo depois.',
      motivoAlteracaoErro: 'Informe o motivo da alteração.',
      /* o registro técnico (o PDF do botão Imprimir registro do rodapé do painel) */
      falhaRegistro: 'Não foi possível gerar o registro. Tente de novo.',
      registroPdf: {
        titulo: 'REGISTRO ELETRÔNICO DE TROCA DE SERVIÇO',
        rotuloRegistro: 'Registro',
        rotuloCodigo: 'Código verificador',
        rotuloGerado: 'Gerado em',
        numero: function (numero, ano) { return 'RW nº ' + numero + '/' + ano; },
        secao: function (n, titulo) { return n + '. ' + titulo; },
        secaoIdentificacao: 'IDENTIFICAÇÃO',
        secaoEscalas: 'ESCALAS TROCADAS',
        secaoSaldo: 'SALDO DE HORAS',
        secaoAcoes: 'REGISTRO DAS AÇÕES',
        secaoObservacoes: 'OBSERVAÇÕES',
        origem: 'Origem',
        origens: { pedido: 'Pedido do militar', administracao: 'Registrada pela administração' },
        situacao: 'Situação',
        altera: 'Altera',
        alteraRegistro: function (numero, ano) { return 'O registro RW nº ' + numero + '/' + ano; },
        unidade: 'Unidade',
        documentos: 'Documentos oficiais',
        parte: function (numero, ano) { return 'Parte nº ' + numero + '/' + ano + ' (eProtocolo)'; },
        semDocumento: 'Nenhum informado',
        escalasAjuda: 'Em ordem de data. Cada item é uma escala cumprida por outro militar.',
        itemDia: function (dia, semana, periodo) { return dia + ' (' + semana + '), ' + periodo; },
        servicoInteiro: 'serviço inteiro, das 08h às 08h',
        trecho: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
        itemFrase: function (cumpre, noLugarDe) { return cumpre + ' cumpre a escala de serviço do(a) ' + noLugarDe + '.'; },
        saldoFrase: function (deve, horas, a) { return deve + ' deve ' + horas + ' ao(à) ' + a + '.'; },
        acoesAjuda: 'Em ordem cronológica. Horário de Brasília.',
        colunas: ['Data e hora', 'Ação', 'Militar', 'CPF'],
        acoes: { solicitacao: 'Solicitação (vale como aceite)', aceite: 'Aceite', aprovacao: 'Aprovação',
                 registro_aprovacao: 'Registro e aprovação', recusa: 'Recusa da administração',
                 correcao: 'Correção', alteracao_pedido: 'Alteração do pedido', substituicao: 'Substituição',
                 cancelamento: 'Cancelamento', expiracao: 'Expiração (sem resposta)', aprovacao_alteracao: 'Aprovação da alteração' },
        motivoAcao: function (motivo) { return 'Motivo: ' + motivo; },
        motivoAlteracao: 'Motivo da alteração',
        canceladaEm: function (dia) { return 'Cancelada em ' + dia + '.'; },
        /* o registro que não vale mais: o quadro do alto e a marca d'água das folhas dele */
        encerramento: {
          titulo: { substituicao: function (numero, ano) { return 'SUBSTITUÍDO PELO RW nº ' + numero + '/' + ano; }, cancelamento: 'CANCELADO', expiracao: 'EXPIRADO' },
          marca: { substituicao: 'SUBSTITUÍDO', cancelamento: 'CANCELADO', expiracao: 'EXPIRADO' },
          porQuem: function (quando, militar) { return 'Em ' + quando + ', por ' + militar + '.'; },
          semQuem: function (quando) { return 'Em ' + quando + '.'; },
          pelaRotina: function (quando) { return 'Em ' + quando + ', pela rotina do sistema.'; },
          motivo: function (motivo) { return 'Motivo: ' + motivo; },
          fim: { substituicao: function (numero, ano) { return 'Este registro não vale mais. Vale o RW nº ' + numero + '/' + ano + '.'; },
                 cancelamento: 'Este registro não vale mais. A escala voltou a ser a de antes das trocas.',
                 expiracao: 'Este registro não chegou a valer.' }
        },
        pendente: 'Pendente',
        observacoes: [
          'Cada ação foi feita pelo próprio militar, com o seu acesso pessoal (CPF e senha) ao sistema Roster Work. O IP e o aparelho de cada ação ficam guardados no sistema.',
          'A solicitação vale como aceite de quem solicitou. Cada militar envolvido aceita uma vez o registro inteiro. O aceite dado depois da aprovação é só para registro e não muda a escala.',
          'Este registro reproduz os dados gravados no sistema e não substitui os documentos oficiais.'
        ],
        arquivo: function (numero, ano) { return 'Registro RW ' + numero + '-' + ano + '.pdf'; },
        arquivoVarios: function (mes, ano) { return 'Registros de trocas ' + mes + '-' + ano + '.pdf'; }
      },
      /* o painel Imprimir trocas (o botão Imprimir da barra): as trocas do mês, o texto para a Parte e o PDF */
      imprimir: {
        titulo: 'Imprimir trocas',
        subtitulo: 'Texto para a Parte e PDF',
        mes: function (mes, ano) { return mes.charAt(0).toUpperCase() + mes.slice(1) + ' de ' + ano; },
        contagem: function (marcadas, total) { return marcadas + ' de ' + total + ' ' + (total === 1 ? 'troca' : 'trocas') + ' ' + (marcadas === 1 ? 'marcada.' : 'marcadas.'); },
        ajudaTexto: { informo: 'Informo conta o que já aconteceu (cumpriu).', solicito: 'Solicito pede autorização para o que vai acontecer (cumprirá).' },
        ajudaFormato: { lista: 'Uma linha por troca: os dias, a Parte, os aceites e a aprovação.',
                        registro: 'Uma folha por troca: os dados, a Parte, os aceites e a aprovação, com data e hora.',
                        alteracoes: 'As correções, substituições, cancelamentos e expirações das trocas do mês, com quem fez, quando e o motivo. Vale para todas as trocas do mês, marcadas ou não.' },
        vazio: 'Nenhuma troca neste mês.',
        nenhumaMarcada: 'Marque ao menos uma troca.',
        semAlteracoes: 'Nenhuma alteração nas trocas deste mês.',
        copiarTexto: 'Copiar texto',
        textoCopiado: 'Texto copiado',
        falhaCopiar: 'Não foi possível copiar. O texto ficou selecionado: copie manualmente.',
        falhaLista: 'Não foi possível carregar as trocas. Tente de novo.',
        /* a nota do alto do painel ("Será impresso:"): "Lista de outubro de 2026, 5 trocas." */
        resumo: {
          lista: function (mes, ano, n) { return 'Lista de ' + mes + ' de ' + ano + ', ' + n + (n === 1 ? ' troca.' : ' trocas.'); },
          registro: function (mes, ano, n) { return 'Registro técnico de ' + mes + ' de ' + ano + ', ' + n + (n === 1 ? ' troca.' : ' trocas.'); },
          alteracoes: function (mes, ano) { return 'Alterações das trocas de ' + mes + ' de ' + ano + '.'; }
        },
        /* o texto para a Parte, na norma de correspondência: subitens "a." que terminam em ";" e o último em "." */
        parte: {
          informoAbertura: function (nomes) { return 'Informo a V.S.ª que ' + nomes + ' trocaram suas escalas de serviço nas seguintes datas:'; },
          informoUma: function (frase) { return 'Informo a V.S.ª que ' + frase + '.'; },
          solicitoAbertura: function (umaTroca) { return 'Solicito a V.S.ª autorização para ' + (umaTroca ? 'a seguinte troca de serviço:' : 'as seguintes trocas de serviço:'); },
          solicitoUma: function (frase) { return 'Solicito a V.S.ª autorização para a seguinte troca de serviço: ' + frase + '.'; },
          verbo: { informo: 'cumpriu', solicito: 'cumprirá' },
          linha: function (cumpre, verbo, noLugarDe, dia, periodo) {
            return cumpre + ' ' + verbo + ' a escala de serviço do(a) ' + noLugarDe + ' no dia ' + dia + (periodo ? ', ' + periodo : '');
          },
          periodo: function (hi, hf) { return 'das ' + hi + ' às ' + hf; },
          e: ' e '
        },
        /* o PDF Lista (relatório): uma linha por troca, com os aceites e a aprovação */
        pdf: {
          titulo: 'Relatório de trocas de serviço',
          subtitulo: function (mes, n) { return mes + ' · ' + n + (n === 1 ? ' troca' : ' trocas'); },
          unidadeDetalhe: function (n) { return n === 1 ? '1 troca' : n + ' trocas'; },
          colunas: ['RW nº', 'Serviço e devolução', 'Parte', 'Aceites', 'Aprovação'],
          numero: function (numero, ano) { return numero + '/' + ano; },
          dia: function (dia, periodo) { return dia + ' · ' + periodo; },
          servicoInteiro: 'serviço inteiro',
          trecho: function (hi, hf) { return hi + ' às ' + hf; },
          noLugar: function (cumpre, noLugarDe) { return cumpre + ' no lugar do(a) ' + noLugarDe; },
          parte: function (numero, ano) { return numero + '/' + ano; },
          semParte: 'Sem parte',
          quando: function (dia, hora) { return dia + ', ' + hora; },
          pendente: 'Pendente',
          aguardando: 'Aguardando',
          registrou: 'Registrou a troca',
          recusou: 'Recusou a troca',
          nota: function (dia, hora) { return 'Gerado pelo sistema Roster Work em ' + dia + ', às ' + hora + '. Não substitui os documentos oficiais.'; },
          arquivo: function (mes, ano) { return 'Relatório de trocas ' + mes + '-' + ano + '.pdf'; }
        },
        /* o PDF Alterações: o livro de ocorrências das trocas do mês (o rótulo de cada alteração é o do registro técnico) */
        alteracoes: {
          titulo: 'Relatório de alterações das trocas de serviço',
          subtitulo: function (mes, n) { return mes + ' · ' + n + (n === 1 ? ' alteração' : ' alterações'); },
          unidadeDetalhe: function (n) { return n === 1 ? '1 alteração' : n + ' alterações'; },
          colunas: ['RW nº', 'Serviço e devolução', 'Alteração', 'Quem e quando'],
          rotina: 'Rotina do sistema',
          motivo: function (motivo) { return 'Motivo: ' + motivo; },
          arquivo: function (mes, ano) { return 'Alterações das trocas ' + mes + '-' + ano + '.pdf'; }
        }
      },
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
      confirmarForcar: 'Aprovar com pendências? O solicitado ainda não aceitou. A troca é aplicada na escala na hora, e o aceite dele continua pendente.',
      confirmarCancelar: 'Cancelar esta troca?',
      confirmarCancelarAlteracao: 'Cancelar esta alteração? A troca continua como está.',
      confirmarAprovarAlteracao: 'Aprovar esta alteração? Ela entra no lugar da troca de antes e a escala é atualizada na hora.',
      confirmarEditar: 'Salvar a alteração? Ela entra no lugar da troca de antes e a escala é atualizada na hora.',
      confirmarEditarComProblema: 'A análise apontou problemas que podem quebrar a escala. Salvar mesmo assim?',
      confirmarRegistrar: 'Registrar esta troca? Ela já entra aprovada e a escala é atualizada na hora.',
      confirmarRegistrarComProblema: 'A análise apontou problemas que podem quebrar a escala. Registrar mesmo assim?',
      falhaAcao: 'Não foi possível concluir. Tente de novo.',
      /* título do painel lateral de solicitar e de registrar (só admin) */
      tituloPainel: 'Solicitar troca',
      tituloRegistrar: 'Registrar troca',
      tituloEditar: 'Editar troca',
      /* Nova troca — validações */
      novaParte: 'Informe o número da parte.',
      novaAno: 'Informe o ano com 4 números.',
      novaSolicitante: 'Selecione o solicitante.',
      novaDataRegistrar: 'Selecione o dia do serviço.',
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
      modalSolicitanteAntes: 'Escolha o solicitante antes',
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
      modalDevAjuda: 'Escolha um dia do parceiro, ou marque Saldo de horas.',
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
      extratoFalha: 'Não foi possível carregar o histórico.',
      /* o formulário da troca, no Solicitar troca, no Registrar troca e no Editar do registro (trocas-varias.js,
         trocas-varias-calendario.js, trocas-varias-resumo.js e trocas-varias-registrar.js), e o registro nas listas e no painel */
      varias: {
        /* o resumo do formulário, dia a dia (trocas-varias-resumo.js): o horário e o lápis */
        horarioInteiro: function (hi, hf, horas) { return 'Serviço inteiro, ' + hi + ' às ' + hf + ' (' + horas + ')'; },
        horarioParte: function (hi, hf, horas) { return 'Parte do serviço, ' + hi + ' às ' + hf + ' (' + horas + ')'; },
        horarioEscolha: 'Escolha o horário da troca neste dia.',
        horarioInvalido: 'O fim do horário precisa vir depois do início, dentro do serviço.',
        editarHorario: function (dia) { return 'Editar o horário de ' + dia; },
        fechadoAntes: 'A dívida de horas que já havia fecha. Ninguém fica devendo horas.',
        fechadoDuplas: 'Tudo fechado em duplas. Ninguém fica devendo horas.',
        fechadoRodas: 'Cada um trabalha um serviço e folga um. Ninguém fica devendo horas.',
        fechadoTudo: 'Tudo fechado em duplas e rodas. Ninguém fica devendo horas.',
        saldo: function (deve, horas, a) { return 'O ' + deve + ' fica devendo ' + horas + ' ao ' + a + '.'; },
        noLugarDe: function (trabalha, folga) { return trabalha + ' no lugar de ' + folga; },
        removerComDias: function (nome, n) { return 'Remover o ' + nome + ' tira também ' + (n === 1 ? '1 dia' : n + ' dias') + ' da troca.'; },
        /* o aviso ao leitor de tela quando escolher o militar o põe na troca */
        entrou: function (nome) { return nome + ' entrou na troca.'; },
        semDias: 'Marque pelo menos um dia no calendário.',
        falhaDias: 'Não foi possível carregar os dias.',
        falhaResumo: 'Não foi possível montar o resumo.',
        /* "Cb. Paixão, Cb. Lemos e Cb. Mendes" */
        nomes: function (lista) { return lista.length < 2 ? (lista[0] || '') : lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1]; },
        /* a linha do registro nas listas Todas e Minhas */
        linhaMilitares: function (nomes) { return 'Várias trocas: ' + nomes; },
        linhaMeta: function (rw, n) { return rw + ' · ' + n + ' militares'; },
        /* o painel do registro */
        painelTitulo: 'Várias trocas',
        caixaEscalas: 'Escalas trocadas',
        escalaFrase: function (cumpre, noLugarDe) { return cumpre + ' cumpre a escala de serviço do(a) ' + noLugarDe + '.'; },
        escalaFraseHorario: function (cumpre, noLugarDe, hi, hf) { return cumpre + ' cumpre a escala de serviço do(a) ' + noLugarDe + ', das ' + hi + ' às ' + hf + '.'; },
        saldoRegistro: function (deve, horas, a) { return 'Saldo de horas: ' + deve + ' deve ' + horas + ' a ' + a + '.'; },
        faltaAceite: 'Falta você aceitar as trocas. O pedido vai para a administração quando todos aceitarem.',
        faltaAceiteAprovada: 'Falta você aceitar as trocas. Elas já foram aprovadas e valem na escala; o seu aceite fica no registro.',
        confirmarAceitar: function (rw) { return 'Aceitar as trocas do ' + rw + '? O pedido segue para a administração quando todos aceitarem.'; },
        confirmarAceitarDepois: function (rw) { return 'Aceitar as trocas do ' + rw + '? O seu aceite fica no registro e a escala não muda.'; },
        confirmarAprovar: function (rw) { return 'Aprovar as trocas do ' + rw + '? A escala é atualizada na hora, em todos os dias.'; },
        confirmarForcar: function (rw) { return 'Aprovar as trocas do ' + rw + ' com pendências? Ainda falta o aceite de algum militar. A escala é atualizada na hora, em todos os dias, e os aceites continuam pendentes.'; },
        confirmarCancelar: function (rw) { return 'Cancelar as trocas do ' + rw + '?'; },
        /* o Registrar troca (só admin): as trocas entram já aprovadas */
        confirmarRegistrar: 'Registrar estas trocas? Elas já entram aprovadas e a escala é atualizada na hora, em todos os dias.',
        /* o Editar do administrador de fora, nas trocas aprovadas */
        confirmarEditar: 'Salvar a alteração? Ela entra no lugar das trocas de antes e a escala é atualizada na hora, nos dias que mudam.',
        /* a alteração de outro registro: o aviso nas trocas que têm uma esperando, quem sai da troca nos aceites e as confirmações */
        alteracaoAguardando: 'Estas trocas têm uma alteração aguardando. Até ela ser aprovada, as trocas continuam como estão.',
        aceiteSaiuPendente: 'Sai da troca. Ainda não aceitou',
        aceiteSaiu: function (dia, hora) { return 'Sai da troca. Aceitou em ' + dia + ', às ' + hora; },
        confirmarCancelarAlteracao: 'Cancelar esta alteração? As trocas continuam como estão.',
        confirmarAprovarAlteracao: 'Aprovar esta alteração? Ela entra no lugar das trocas de antes e a escala é atualizada na hora, nos dias que mudam.',
        confirmarForcarAlteracao: 'Aprovar esta alteração com pendências? Ainda falta o aceite de algum militar. Ela entra no lugar das trocas de antes e a escala é atualizada na hora, nos dias que mudam; os aceites continuam pendentes.',
        /* os cartões das Pendências (na alteração, o RW das trocas de antes) */
        filaMinha: function (quem) { return quem + ' pediu trocas de serviço com você'; },
        filaAdmin: function (nomes) { return 'Trocas de serviço: ' + nomes; },
        filaMinhaAlteracao: function (quem, rw) { return quem + ' quer alterar as trocas do ' + rw; },
        filaAdminAlteracao: function (nomes) { return 'Alteração das trocas: ' + nomes; },
        filaAceitar: function (rw) { return 'Aceitar as trocas do ' + rw; },
        filaMeta: function (dia, n, rw) { return 'A partir de ' + dia + ' · ' + n + ' militares · ' + rw; },
        /* o extrato dos Saldos: o dia de uma roda que se compensa */
        rodaCompensada: function (rw) { return 'Compensada na roda do ' + rw; }
      }
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

    /* extrajornada: os Relatórios do Organizar o mês (nova-extra-relatorio.js), as etapas do mês e a prévia do relatório
       de ajustes */
    extrajornada: {
      relatorios: {
        solicitacoes: function (ini, fim, vol, nao, sem) {
          return ini + ' a ' + fim + '. ' + vol + (vol === 1 ? ' voluntário, ' : ' voluntários, ') + nao + (nao === 1 ? ' não voluntário, ' : ' não voluntários, ') + sem + ' sem resposta.';
        },
        termos: function (rec, pend, recebidas, repartidas) {
          return rec + (rec === 1 ? ' termo recebido e ' : ' termos recebidos e ') + pend + (pend === 1 ? ' pendente. ' : ' pendentes. ') + recebidas + ' cotas recebidas, ' + repartidas + ' repartidas.';
        },
        lancado: function (em, por, ate, iniciado) {
          return 'Lançado na escala em ' + em + (por ? ', pelo ' + por : '') + '. ' + (iniciado ? 'Até ' + ate + ' dava para mudar e lançar de novo; cada lançamento refaz o relatório inicial.' : 'Até ' + ate + ' dá para mudar e lançar de novo; cada lançamento refaz o relatório inicial.');
        },
        naoLancado: function (ate) { return 'Ainda não lançado. Até ' + ate + ' a distribuição pode ser lançada e relançada.'; },
        ajustesQtd: function (n) { return n + ' até agora'; },
        relatorioDisponivel: function (dia) { return 'Fica disponível a partir de ' + dia + ' e não sai mais daqui. Até lá, a prévia ao lado mostra como está.'; },
        relatorioPronto: function (dia) { return 'Disponível desde ' + dia + ' e não sai mais daqui.'; },
        comparado: function (dia) { return 'comparado com o lançamento de ' + dia; },
        semLancamento: 'A comparação começa quando a extra for lançada na escala.',
        semAjustes: 'Nenhuma extra mudou desde o lançamento.',
        retirada: 'retirada',
        nova: 'extra nova',
        mudouVezes: function (n) { return 'mudou ' + n + ' vezes'; },
        semMotivo: 'Sem motivo',
        cotasIguais: 'Nenhuma. As cotas de cada militar continuam as do lançamento.',
        cotasMudaram: function (quem, de, para) { return quem + ': de ' + de + ' para ' + para + ' cotas.'; }
      }
    },

    /* edição não salva */
    edicao: {
      sairSemSalvar: 'Você tem alterações não salvas. Se sair agora, elas serão perdidas.'
    },

    /* ajuda da tela (geral-guia): o passo em que a pessoa está no passo a passo */
    guia: {
      contador: function (passo, total) { return passo + ' de ' + total; }
    },

    /* notificações no celular (Meu perfil › Preferências): a ajuda quando não dá para ligar */
    notificacoesCelular: {
      ajuda: {
        bloqueado: 'As notificações estão bloqueadas neste aparelho. Para ligar, libere as notificações do Roster Work nas configurações do navegador ou do celular.',
        instalar: 'No iPhone, as notificações chegam só pelo app: no Safari, toque em Compartilhar e em Adicionar à Tela de Início, abra o app e ligue aqui.',
        indisponivel: 'Este navegador não recebe notificações.'
      },
      falhaAtivar: 'Não foi possível ligar as notificações. Tente de novo.',
      /* administradores: a ajuda do aparelho cita os pedidos; a escolha dos avisos de administração */
      ajudaAdmin: 'Avisa neste aparelho, mesmo com o app fechado, sobre as suas trocas, folgas, extras, os comunicados e os pedidos que esperam a sua aprovação.',
      falhaAdmin: 'Não foi possível salvar a escolha. Tente de novo.',
      /* a pergunta do app instalado no celular, uma vez por aparelho */
      pergunta: 'Receber no celular os avisos das suas trocas, folgas e extras? Você pode mudar quando quiser em Meu perfil.',
      ativar: 'Ativar',
      agoraNao: 'Agora não'
    },

    /* sessão */
    sessao: {
      expirada: 'Sua sessão expirou. Entre novamente.',
      expiradaInatividade: 'Sua sessão expirou por inatividade. Entre novamente.',
      /* Meu perfil › Segurança › Aparelhos */
      sairTodosConfirmar: 'Sair de todos os aparelhos? A sua sessão será encerrada neste e em todos os outros aparelhos, inclusive no app do celular.',
      sairTodosErro: 'Não foi possível sair de todos os aparelhos. Tente de novo.'
    },

    /* app no celular: o passo a passo quando o navegador não abre a janela de instalação */
    aplicativo: {
      telaCheia: 'Tela cheia',
      sairTelaCheia: 'Sair da tela cheia',
      instalarIphone: 'Para instalar no iPhone, abra o sistema no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.',
      instalarAndroid: 'Para instalar, toque no menu do navegador (os três pontos) e depois em Instalar app ou Adicionar à tela inicial. Se o app já estiver instalado, abra pelo ícone Roster Work na tela do celular.'
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
        extra_disponibilidade: 'Pedido de extra',
        extra_prazos: 'Prazo do pedido (extrajornada)',
        atestado: 'Atestado',
        ferias: 'Férias',
        licenca: 'Licença',
        dispensa: 'Dispensa',
        unidade: 'Ajustes da unidade',
        antiguidade: 'Antiguidade'
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
      /* o Supabase recusou a entrada por excesso de entradas do mesmo endereço de internet
         (login e conferência da senha atual na troca de senha) */
      muitasEntradas: 'Muitas entradas seguidas nesta rede. Aguarde alguns minutos e tente de novo.',
      /* confirmação no modal geral-resumo; {pagina} = nome da tela. O título depende
         da ação: exclusão tem texto próprio (senão diria "alterações salvas" para algo apagado) */
      alteracoesSalvas: 'Alterações em {pagina} salvas com sucesso',
      exclusaoConcluida: 'Exclusão em {pagina} concluída',
      /* modal de data — recálculo direcionado ao alterar modelo/regra/viatura/instalação/ritmo */
      recalcularDesde: 'A partir de qual data a escala deve ser recalculada?',
      dataMuitoAntiga: 'A data não pode ser mais de uma semana no passado.',
      /* dica do botão de adicionar desativado quando o posto está cheio (modelo e Editar do dia) */
      efetivoMaximo: 'Efetivo máximo: {n}',
      /* afastamento com data-limite (selo da Usuários, linha da Escala): "Férias até 31/10" */
      afastadoAte: function (situacao, data) { return situacao + ' até ' + data; },
      /* filtro com só as opções à parte marcadas (ex.: "só Afastamentos", "só Inativos"): a etiqueta da linha "Filtros:" */
      filtroSo: function (rotulo) { return 'só ' + rotulo; }
    },

    /* rótulos de botão de avisos e confirmações */
    botoes: {
      continuar: 'Continuar',
      continuarEditando: 'Continuar editando',
      descartar: 'Descartar',
      sairSemSalvar: 'Sair sem salvar',
      irParaLogin: 'Ir para o login',
      sairDeTodos: 'Sair de todos',
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
      cancelarFolga: 'Cancelar folga',
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
      } else if (t.acao === 'cancelar_registro') {
        itens.push({ titulo: S.tituloTroca, texto: S.trocaRegistro(t.entre, t.servico, t.devolucao, t.registro) });
      } else if (t.acao === 'cancelar_em_cima') {
        itens.push({ titulo: S.tituloTroca, texto: S.trocaEmCima(t.entre, t.servico, t.devolucao, (M.trocas.situacao[t.status] || '').toLowerCase()) });
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
