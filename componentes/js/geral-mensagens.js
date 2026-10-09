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

  window.RosterWork.mensagens = {

    /* meu perfil (pedido de correção de dados + troca de senha) */
    perfil: {
      falhaDados: 'Não foi possível salvar. Tente de novo.',
      solicitacaoEnviada: 'Solicitação enviada para aprovação.',
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
      confirmarRecusar: 'Recusar as alterações selecionadas?',
      semMinhas: 'Você ainda não pediu nenhuma correção.',
      semPedidos: 'Nenhuma solicitação pendente.',
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
      falhaRemoverAviso: 'Não foi possível remover o comunicado. Tente de novo.'
    },

    /* usuários › aprovações › cadastros (quem pediu acesso pela tela pública) */
    cadastros: {
      semCadastros: 'Nenhum cadastro esperando aprovação.',
      jaExiste: 'Já está na ficha',
      jaTemConta: 'Já tem acesso',
      emailEmUso: 'E-mail em uso',
      confirmarRecusar: 'Recusar este cadastro? A pessoa não terá acesso ao sistema.',
      falha: 'Não foi possível concluir. Tente de novo.'
    },

    /* avisos (página das três abas: Para mim · Administração · Comunicados) */
    avisos: {
      semNotificacoes: 'Nada novo por aqui.',
      semAbertos: 'Nada esperando por você.',
      grupoPessoal: 'Para você',
      grupoAdministracao: 'Administração',
      semPendencias: 'Nada esperando por você.',
      semPendenciasAdministracao: 'Nada esperando a sua decisão.',
      semComunicados: 'Nenhum comunicado.',
      carregando: 'Carregando…',
      falhaCarregar: 'Não foi possível carregar.'
    },

    /* criar conta (página standalone, antes da sessão) */
    criarConta: {
      enviado: 'Cadastro enviado. Um administrador vai analisar.',
      falha: 'Não foi possível enviar o cadastro. Tente de novo.',
      falhaOpcoes: 'Não foi possível carregar os postos e as unidades. Verifique a sua internet. A página vai recarregar.',
      jaTemAcesso: 'Esse CPF já tem acesso ao sistema. Vamos abrir a recuperação de senha.',
      contaCriada: 'Conta criada. Você já pode entrar com o seu CPF e a sua senha.',
      contaCriadaComCorrecoes: 'Conta criada. Você já pode entrar. As alterações que você fez vão passar pela aprovação de um administrador.',
      resgateFalha: 'Não foi possível criar a conta. Tente de novo.'
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

    /* esqueci minha senha (páginas standalone recuperar-senha e nova-senha): o pedido vai ao
       administrador, que entrega um link de nova senha */
    recuperacao: {
      identificadorVazio: 'Digite seu CPF ou RG',
      identificadorInvalido: 'CPF ou RG inválido',
      pedidoEnviado: 'Pedido enviado. Fale com um administrador para receber o seu link de nova senha.',
      naoEncontrado: 'CPF ou RG não encontrado',
      semConta: 'Este cadastro ainda não tem acesso liberado. Fale com um administrador.',
      falha: 'Não foi possível enviar o pedido. Tente de novo.',
      erroConexao: 'Erro de conexão. Tente novamente.',
      senhaCurta: 'A senha precisa de ao menos 6 caracteres.',
      senhaNaoConfere: 'A confirmação não bate com a nova senha.',
      senhaIgual: 'A nova senha precisa ser diferente da senha atual.',
      linkInvalido: 'Este link é inválido ou expirou. Peça um novo ao administrador.',
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
      tokenVazio: 'Digite o token de acesso',
      tokenInvalido: 'Token inválido ou expirado',
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
      foraDoFluxo: 'Sai do ciclo por tempo indeterminado; volta quando o administrador o incluir de novo pelos Contínuos.',
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
      selecioneMilitar: 'Selecione um militar',
      deixarVazio: 'Deixar vazio',
      funcaoVaziaExcluir: 'Função manual sem militar será excluída ao salvar. Continuar?',
      sobreposicaoFuncao: 'Dois militares no mesmo horário nesta função',
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
        duasUnidades:        { texto: '{militar} está em duas unidades diferentes ao mesmo tempo ({unidades}){faixas}', faixa: 'das {hi} às {hf}', icone: 'icone-alerta', nivel: 'alerta' }
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
      /* seções Contínuos (ciclo) e Pontuais do painel do dia */
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
      confirmarTirar: 'Tirar {pessoa} do ciclo a partir de {data}? Ele deixa de aparecer na escala automática daqui em diante.',
      pontuaisDoDia: 'Pontuais do dia',
      pontuaisAdicionar: 'Adicionar pontual',
      pontuaisVazio: 'Nenhum pontual neste dia.',
      pontuaisElegiveisVazio: 'Ninguém disponível para inserir.',
      falhaAcaoCiclo: 'Não foi possível alterar o ciclo. Tente de novo.',
      emManutencao: 'Em manutenção',
      /* linha da cadeira vazia (sem ninguém), no lugar do nome do militar */
      vagaVazia: function (motivo) { return motivo === 'trava' ? 'Sem solução automática' : (motivo === 'habilitado' ? 'Vazio por falta de habilitado' : 'Vazio por falta de efetivo'); },
      /* dica do ícone do militar de outra unidade: "Do 2ºPEL" / "Da 2ªCIBM" */
      deOutraUnidade: function (nome) { return (/ª/.test(nome || '') ? 'Da ' : 'Do ') + (nome || ''); },
      /* Observações do dia (trocas, folgas, outra unidade) — o banco manda os dados, aqui vira texto */
      observacoesTitulo: 'Observações',
      observacaoLimite: 200,
      observacaoFalhaSalvar: 'Não foi possível salvar a observação.',
      observacaoFalhaExcluir: 'Não foi possível excluir a observação.',
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

    /* usuários (ficha do militar no painel lateral) */
    usuarios: {
      falhaFicha: 'Não foi possível carregar a ficha.',
      confirmarBaixa: 'Dar baixa em {pessoa} (CPF {cpf})? Ele fica inativo a partir da data escolhida, sai da escala e pode ser readmitido depois.',
      falhaBaixa: 'Não foi possível dar baixa. Tente de novo.',
      falhaSalvar: 'Não foi possível salvar. Tente de novo.',
      confirmarTransferencia: 'Transferir {pessoa} de {origem} para {destino} a partir de {data}? O militar sai da escala da unidade atual nessa data e fica disponível para ser escalado na nova.',
      /* há uma transferência marcada: a nova toma o lugar dela */
      transferenciaSubstitui: ' A transferência marcada para {data} será substituída.',
      falhaTransferencia: 'Não foi possível transferir. Tente de novo.',
      dataFutura: 'A data não pode ser futura.',
      confirmarPromocao: 'Promover {pessoa} a {grau} em {data}?',
      promocaoDataAnterior: 'A data deve ser posterior à última promoção (ou à inclusão no quadro).',
      topoCarreira: 'Já está no topo desta carreira.',
      promocaoTipoInvalida: 'Essa mudança de tipo rebaixaria o militar, não é uma promoção.',
      postoAtualDesconhecido: 'Não foi possível identificar o posto atual deste militar.',
      falhaPromocao: 'Não foi possível promover. Tente de novo.',
      confirmarReadmissao: 'Readmitir {pessoa} ao efetivo? Ele volta como ativo, fora da escala automática (você o recoloca pela seção Contínuos da Escala).',
      falhaReadmissao: 'Não foi possível readmitir. Tente de novo.',
      linkNenhum: 'Nenhum link de nova senha ativo. Se o militar esqueceu a senha, gere um link e entregue a ele.',
      linkAtivo: 'Link de nova senha ativo até {ate}. Se ele perder, gere um novo.',
      falhaLink: 'Não foi possível gerar o link. Tente de novo.',
      falhaCopiar: 'Não foi possível copiar. Selecione o link e copie manualmente.',
      tokenNenhum: 'Este militar ainda não tem conta. Gere um token e entregue a ele para criar o acesso.',
      tokenAtivo: 'Token ativo, expira em {ate}. Entregue ao militar; se ele perder, gere um novo.',
      tokenEmUso: 'Token em uso. O militar tem até {ate} para concluir o cadastro.',
      tokenGerado: 'Entregue este código ao militar para ele criar a conta: {token}. Vale uma vez e expira em 72 horas.',
      falhaToken: 'Não foi possível gerar o token. Tente de novo.'
    },

    /* análise de impacto na escala — componente compartilhado (geral-impacto), usado por Trocas e Folgas */
    impacto: {
      okFrase: 'Sem impacto na escala.',
      alertaFrase: function (n) { return n === 1 ? '1 ponto de atenção.' : n + ' pontos de atenção.'; },
      problemaFrase: function (n) { return n === 1 ? '1 problema impede uma escala segura.' : n + ' problemas impedem uma escala segura.'; },
      vago: 'vago'
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
        rejeitada_admin: 'Rejeitada',
        cancelada: 'Cancelada'
      },
      /* painel de detalhe */
      linhaDia: 'Dia',
      linhaHorario: 'Horário',
      linhaDevolucao: 'Devolução',
      servicoTotal: 'Serviço total · 08h às 08h',
      faixaHorario: function (ini, fim) { return ini + ' às ' + fim; },
      devolucaoPendente: 'Pendente (débito)',
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
      confirmarRecusar: 'Recusar esta troca?',
      confirmarAprovar: 'Aprovar esta troca? A escala será atualizada na hora.',
      confirmarAprovarComProblema: 'A análise apontou problemas que podem quebrar a escala. Aprovar mesmo assim?',
      confirmarForcar: 'Aprovar sem a confirmação do solicitado? A troca é aplicada na escala na hora.',
      confirmarRejeitar: 'Rejeitar esta troca?',
      confirmarCancelar: 'Cancelar esta troca?',
      falhaAcao: 'Não foi possível concluir. Tente de novo.',
      /* título do painel lateral de solicitar */
      tituloPainel: 'Solicitar troca',
      /* Nova troca — validações */
      novaParceiro: 'Selecione o parceiro.',
      novaData: 'Selecione o dia do seu serviço.',
      novaMesmaPessoa: 'Você não pode trocar com você mesmo.',
      novaServicoVazio: 'Ajuste o trecho do serviço na barra.',
      /* componente barra de período (rótulo do topo) */
      barraCobreTudo: 'Serviço inteiro',
      barraTrecho: 'Trecho',
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
      vazioSolicitacoes: 'Nenhuma solicitação de folga pendente.',
      vazioLancamentos: 'Nenhuma folga registrada no período.',
      extratoVazio: 'Sem lançamentos ainda.',
      pickerVazio: 'Selecione unidades no topo para escolher o militar.',
      situacao: { pendente: 'Pendente', aprovada: 'Aprovada', concedida: 'Concedida', recusada: 'Recusada', cancelada: 'Cancelada' },
      origemAjuste: 'Ajuste do admin',
      origemEscala: 'Inserido na escala',
      solicitouFolga: 'solicitou folga',
      pendenteNaoConta: 'não conta no saldo até aprovar',
      diaInteiro: 'Dia inteiro',
      consome: function (label) { return 'Consome ' + label; },
      saldoFicaria: function (saldo) { return 'saldo ficaria em ' + saldo; },
      porNome: function (nome) { return 'por ' + nome; },
      acaoSolicitar: 'Solicitar folga',
      acaoConceder: 'Conceder folga',
      acaoAjuste: 'Ajuste de saldo',
      botaoSolicitar: 'Solicitar',
      botaoConceder: 'Conceder folga',
      botaoAjuste: 'Salvar ajuste',
      formMilitar: 'Selecione o militar.',
      formData: 'Escolha o dia da folga.',
      formPeriodo: 'Ajuste o trecho na barra.',
      formHoras: 'Informe as horas do crédito.',
      formHorasInvalida: 'Horas inválidas.',
      formMotivo: 'Informe o motivo do ajuste.',
      saldoPrefixo: 'Saldo:',
      confirmarAprovar: 'Aprovar esta folga? O saldo do militar será atualizado.',
      confirmarAprovarComProblema: 'A análise apontou problemas que podem quebrar a escala. Aprovar mesmo assim?',
      confirmarRecusar: 'Recusar esta solicitação de folga?',
      confirmarCancelar: 'Cancelar esta folga? O militar volta ao serviço na escala e as horas voltam ao saldo.',
      confirmarCancelarPendente: 'Cancelar esta solicitação de folga?',
      falhaAcao: 'Não foi possível concluir. Tente de novo.',
      /* painel de aprovação (detalhe + análise de impacto) */
      painelFolga: 'Folga',
      painelPendente: 'Pendente',
      linhaDia: 'Dia',
      linhaTrecho: 'Trecho',
      linhaHoras: 'Horas',
      linhaMotivo: 'Motivo',
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
      enviarCadastro: 'Enviar cadastro',
      criarConta: 'Criar conta',
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
      gerarLink: 'Gerar link de nova senha',
      gerarNovoLink: 'Gerar novo link',
      copiarLink: 'Copiar link',
      linkCopiado: 'Link copiado',
      gerarToken: 'Gerar token de acesso',
      gerarNovoToken: 'Gerar novo token',
      salvar: 'Salvar',
      /* modal de resumo — reverter a ação recém-aplicada (última chance) */
      desfazer: 'Desfazer',
      desfazendo: 'Desfazendo…'
    }

  };

  /* frase-resumo do que será cancelado quando um militar sai da escala (trocas/folgas órfãs),
     acoplada ao modal de confirmação da remoção/baixa/transferência. '' quando não há impacto. */
  window.RosterWork.textoImpactoSaida = function (pendencias) {
    if (!pendencias) return '';
    var nT = (pendencias.trocas || []).length;
    var nF = (pendencias.folgas || []).length;
    if (!nT && !nF) return '';
    var itens = [];
    if (nT) itens.push(nT + (nT === 1 ? ' troca' : ' trocas'));
    if (nF) itens.push(nF + (nF === 1 ? ' folga' : ' folgas'));
    return ' Isto também vai cancelar ' + itens.join(' e ') + ', avisando os envolvidos.';
  };
})();
