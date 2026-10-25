# AutoTuner 3D — Provador de rodas e garagem virtual

Aplicação web mobile-first em português. React 19 + TypeScript, Vite, Tailwind CSS, Lucide e Express. Este projeto agora ocupa a raiz do repositório `robertosugayama/carros`. O RodaBem foi preservado em backup antes da substituição; a integração das suas funções será uma próxima etapa.

## Executar no computador ou ambiente de desenvolvimento

Requer Node.js 24.

```sh
npm ci
npm run dev
```

Servidor Express e frontend na mesma porta, **3000** por padrão. Se estiver ocupada: `PORT=3100 npm run dev`. Para produção em servidor Node: `npm run build` seguido de `npm start`. Em desenvolvimento, use as variáveis já injetadas no processo ou `node --env-file=.env node_modules/tsx/dist/cli.mjs server.ts`; não coloque chaves no frontend.

## Provador fotográfico

O renderizador de rodas desenhadas e o carro ilustrado foram removidos. O estúdio começa pedindo uma foto real do veículo. Além das três opções originais geradas por IA, os 18 modelos de marcas são entradas de catálogo: **fotografias reais dos fabricantes ainda precisam ser obtidas e cadastradas**. Um modelo sem foto informa a pendência; nunca recebe desenho ou foto de outro produto como substituto.

O botão **Enviar foto de roda** está no estúdio. Todo usuário autenticado pode enviar fotos para seu catálogo; o administrador pode aprová-las para publicação compartilhada. É possível criar um novo modelo com nome próprio, sem substituir os existentes. Fonte é opcional para fotos próprias, e o crédito usa o nome do usuário quando não informado. O master também pode cadastrar diretamente em **Admin → Catálogo fotográfico real**. Há enquadramento circular e ajuste de centro/ampliação antes de salvar. PNG, JPEG e WebP são aceitos; imagens são normalizadas a WebP de 800 px com transparência fora do círculo.

- **Somente roda:** a fotografia frontal do fabricante substitui apenas a área do aro; o pneu real da foto do carro continua visível. O ajuste de aro altera a proporção visual da roda mantendo o conjunto externo fixo. Isso é uma estimativa visual, não medição física do pneu.
- **Roda + pneu:** usa a fotografia completa do conjunto, disponível no aro fotografado. Não inventa um pneu em outros perfis.
- Acabamentos só ficam disponíveis se houver fotografia correspondente. Não há filtros de recoloração para imitar cromado ou pintura real.
- As três rodas originais têm 11 cores de pinça e discos perfurados ou lisos. O disco liso usa uma variante fotográfica gerada por IA; a cor é aplicada aos pixels da pinça, preservando sombras. Em fotos enviadas sem separação dos componentes, use **Aplicar freios com IA** e revise o resultado. A simulação de cor não substitui uma amostra física de pintura.
- O recorte mantém a proporção 1:1 e os pixels da foto. Imagens em perspectiva não devem ser cadastradas como frontais: não há achatamento para disfarçar o ângulo.
- Zoom sincronizado, antes/depois, ajuste manual dos centros e diâmetros, câmera/galeria e exportação PNG continuam disponíveis.
- Cada projeto guarda uma cópia da fotografia do produto. Atualizações do catálogo não substituem a fotografia de projetos salvos. Projetos antigos sem foto não recebem um desenho substituto.
- Garagem, manutenção, cadastro/login e administração de contas continuam funcionando. O banco ganha a tabela `wheel_photos` automaticamente.

**Aquisição de fotografias:** a conexão direta com sites de fabricantes retornou bloqueio de rede HTTP 403 neste ambiente. Os domínios necessários foram adicionados ao rascunho de rede do ambiente; isso não aplica a liberação automaticamente nem publica a Vercel. A obtenção e conferência do catálogo fotográfico permanece pendente até o acesso ser liberado. Testes usam imagens técnicas descartáveis e não comprovam realismo de um catálogo comercial ainda ausente.

## Ajustar o tamanho das rodas sobre a foto

Depois de carregar a foto do carro, use **Ajustar tamanho das duas rodas**, logo abaixo da imagem. Um único controle horizontal altera o diâmetro das duas rodas juntas. As posições continuam independentes. Para mover, arraste a roda. Não há alça verde, marcador de centro ou contorno sobre a foto. A barra horizontal também responde às setas do teclado. Projetos antigos e resultados da IA com tamanhos diferentes são equalizados pela média dos diâmetros, sem alterar os centros.

O centro não muda durante o redimensionamento e a roda continua circular, inclusive com zoom. **Referência do aro** descreve o aro da imagem; para conjuntos completos fotografados/gerados ela não é o controle de encaixe na foto. O ajuste não exige cadastrar outra fotografia.

## Primeira conta master

Para criar automaticamente o primeiro master na Vercel, configure **Settings → Environment Variables**:

- `MASTER_EMAIL`: e-mail de login escolhido pelo proprietário.
- `MASTER_PASSWORD`: senha escolhida, marcada como Sensitive. Nunca versione esse valor.

Faça **Redeploy**. Com o banco Turso configurado, a conta é criada como master antes de atender os acessos. Depois entre com esses dados pela tela normal de login. O bootstrap aceita endereços de teste com domínio local e senhas de pelo menos seis caracteres; cadastros públicos continuam exigindo e-mail completo e oito caracteres. Não existe senha padrão no código.

Se o e-mail já existir como usuário comum, a promoção ocorre apenas se a senha configurada corresponder à senha existente. Conflitos preservam a conta e são registrados sem imprimir valores. Master já existente mantém a senha e o status; mudar variáveis não redefine sua senha nem desbloqueia contas. Depois de confirmar o acesso, remova **ambas** as variáveis iniciais da Vercel e faça outro Redeploy: a conta permanece no banco.

Alternativamente, cadastre sua conta normalmente e execute no servidor, com o banco correto:

```sh
npm run admin -- seu-email@exemplo.com
```

## Gemini

Configure `GEMINI_API_KEY` somente no servidor. O modelo solicitado, `gemini-3.8-flash`, está configurado como padrão, mas **a disponibilidade desse identificador não foi confirmada**. Se ele não existir ou não estiver disponível na sua conta, defina `GEMINI_MODEL` com um identificador compatível disponível no Google AI Studio. Não há fallback silencioso para outro modelo. A ausência da chave e falhas da API são tratadas explicitamente; uma detecção real ainda não foi validada.

A foto enviada é compartilhada com o serviço Gemini quando o usuário escolhe detectar com IA. Fotos enviadas manualmente não vão ao Gemini, exceto quando o usuário escolhe **Tratar foto com IA** ou **Aplicar freios com IA**. A API valida posições normalizadas, diâmetros e aro retornados; fotos fora de perfil devem ser recusadas pelo modelo. Resultados da IA são estimativas revisáveis pelo usuário.

## Vercel, passo a passo

1. Envie **o conteúdo desta pasta** para o repositório que receberá o AutoTuner. Não misture os arquivos com o RodaBem. Se usar uma subpasta no GitHub, selecione essa subpasta em Root Directory na Vercel.
2. Crie um banco no Turso e obtenha a URL `libsql://…` e um token.
3. Na Vercel, importe o repositório, escolha framework **Vite**, Node **24.x**. `vercel.json` configura `npm run build`, saída `dist` e API Express em `api/index.ts`.
4. Em Settings → Environment Variables, configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (sensível). Para usar IA, configure também `GEMINI_API_KEY` (sensível). `GEMINI_MODEL` controla detecção, e `GEMINI_IMAGE_MODEL` controla tratamento/edição de imagens (padrão `gemini-2.5-flash-image`; confirme disponibilidade na sua conta). Nunca use prefixo `VITE_` para segredos. Não envie chaves por chat, Git ou capturas de tela.
5. Faça o deploy e cadastre uma conta. Valide login, salvar/reabrir um projeto, registrar manutenção e sair/entrar novamente. Promova sua conta no banco remoto com o comando administrativo acima.

As tabelas são criadas automaticamente. A Vercel exige banco remoto e ativa cookie Secure; nunca armazene a garagem em `/tmp`. Sem URL do banco, o servidor recusa iniciar na Vercel. Em desenvolvimento, o padrão é SQLite local em `data/app.db`; preserve essa pasta e faça backups. Não há migração automática de um banco local existente para o remoto.

**Publicação:** o envio ao GitHub não cria nem confirma um deploy na Vercel. O banco Turso precisa ser configurado, e nenhum link público foi criado por este trabalho. As instruções e a configuração Vercel estão preparadas; publicação remota não foi validada.

## Testes

```sh
npm run build
npm test
node tests/browser.mjs
```

O teste de navegador usa Chromium instalado em `/usr/bin/chromium`; ajuste `executablePath` em outro computador ou instale o navegador do Playwright. Usa servidor e banco temporários próprios. Verifica ausência de desenhos substitutos, cadastro master de fotografia com recorte, uso de pixels da imagem, círculos, zoom, antes/depois, celular sem overflow, projeto salvo/reaberto e PNG. As imagens técnicas dos testes ficam exclusivamente em banco temporário, nunca são publicadas como fotos de fabricantes. As imagens `desktop.png` e `mobile.png` são capturas reais da interface durante os testes. Testes de API verificam isolamento entre usuários, manutenção, validações, bloqueio e permissões master. Gemini e Turso remoto não são simulados como funcionando.

## Limites desta versão

A montagem é 2D com fotografias reais, sem reconstrução tridimensional. Não verifica furação, offset, folgas ou homologação. Consulte um especialista antes da instalação. O nome de cada produto deve ser conferido na fonte do fabricante antes de cadastrar sua imagem; os nomes existentes no catálogo não comprovam correspondência sem a fotografia.

As fotos completas são armazenadas no banco nesta versão. Para muitos modelos/variantes e alto tráfego, use armazenamento de objetos e miniaturas. Configure backups, rate limiting compartilhado, política de privacidade/retensão e recuperação de senha antes de ampliar o acesso público. Uma detecção Gemini real e o banco Turso remoto continuam sem validação neste ambiente.

## Imagens geradas por IA

O catálogo inclui três conjuntos originais de aparência fotográfica: **AT Silver Split**, **AT Graphite Six** e **AT Bronze Mesh**, com pneus e freios. São imagens geradas por IA, não fotografias de produtos existentes ou de fabricantes. A interface identifica a origem como **GERADA POR IA**. Elas não correspondem aos 18 modelos de marcas do catálogo original e têm IDs próprios (18 a 20).

Os arquivos PNG transparentes estão em `public/wheels`, disponíveis mesmo antes de configurar o banco. Fotos reais cadastradas pelo master são preservadas e podem ampliar o catálogo. Para modelos de fabricantes, ainda faltam as fotos reais verificadas. Os conjuntos gerados representam visualmente aro 18 para a simulação; não certificam dimensão, material ou compatibilidade real.

O catálogo agora reúne 18 referências pendentes de fotos e 3 opções originais prontas. Ao salvar, cada imagem é incorporada ao projeto em WebP; ao exportar PNG, as imagens externas do SVG são incorporadas antes de renderizar para evitar rodas ausentes no arquivo final.

## Tratamento de novas fotos por IA

1. Entre na conta e clique em **Enviar foto de roda**, no estúdio.
2. Dê um nome, selecione uma foto frontal de uma única roda, o conteúdo (aro ou conjunto), aro e acabamento. Fotos próprias não exigem link externo.
3. Clique em **Tratar foto com IA** para remover o fundo e enquadrar. Você também pode enquadrar manualmente, sem IA.
4. Revise a imagem e confirme os dados antes de salvar. Imagens tratadas têm identificação de IA. As imagens originais não são substituídas automaticamente sem a confirmação.
5. Usuários comuns guardam fotos no catálogo pessoal. O master publica os envios em **Admin → Fotos enviadas por usuários**. Usuários não podem sobrescrever o catálogo público de outros.

`POST /api/gemini/edit-wheel` usa `@google/genai` para tratamento ou edição de freios; valida o raster antes da chamada, limita frequência, usa prazo de 45 segundos e normaliza a resposta com Sharp para WebP 800 px. Somente contas autenticadas podem chamar. Não publica automaticamente o resultado; o usuário deve revisar/salvar. Modelos gerados ou tratados por IA podem diferir do produto original, por isso a revisão é necessária.

**Validação:** testes cobrem a ausência de chave e o processamento de uma resposta simulada. Uma chamada real ao Gemini de edição ainda não foi validada porque `GEMINI_API_KEY` não está presente neste ambiente. Ausência de chave, modelo indisponível, limites e falhas são informados; não são apresentados como tratamento bem-sucedido. As três variantes de disco liso já estão incluídas no app e não exigem esse serviço.

## Erros no cadastro na Vercel

A API precisa de `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` em **Production**, além de um novo deploy após configurar as variáveis. A chave Gemini é para IA e não configura nem substitui o banco. Cadastros, logins e master só funcionam com o banco conectado.

`api/index.ts` carrega o Express por meio de `apiRuntime.ts`, que responde JSON com HTTP 503 se faltarem as variáveis, se a URL for inválida ou se a inicialização falhar. Erros de importação de dependências também são tratados. Não há fallback para SQLite temporário na Vercel. O frontend trata respostas em texto/HTML sem mostrar um erro técnico de parse JSON.

Para diagnóstico, abra `/api/status` no domínio do app após o deploy. `DATABASE_NOT_CONFIGURED` indica que faltam variáveis; `INVALID_DATABASE_URL` indica URL inválida; `DATABASE_CONNECTION_FAILED` indica erro ao conectar; `SERVICE_STARTUP_FAILED` pede inspeção dos logs de Functions. O teste local não confirma o estado de uma implantação remota.
