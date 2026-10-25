# AutoTuner 3D

Provador de rodas em fotos com garagem, manutenção, login e catálogo multiusuário. React/TypeScript, Vite, Tailwind, Express e **Firebase**. O projeto configurado é `carros-ed674`; os identificadores web ficam em `src/firebaseConfig.ts` e são públicos, como em qualquer aplicativo Firebase. A segurança está no Authentication e nas regras de Firestore/Storage, não em esconder a chave web.

## Ativar no Firebase

Use o [console do projeto](https://console.firebase.google.com/project/carros-ed674/overview):

1. **Authentication → Sign-in method → E-mail/senha**: habilite o provedor.
2. **Authentication → Settings → Authorized domains**: adicione `carros-ochre-phi.vercel.app` (e seu domínio próprio, se usar).
3. **Firestore Database → Create database**: crie `(default)` em modo de produção. Na aba **Rules**, publique o conteúdo de [firebase/firestore.rules](firebase/firestore.rules). Não use regras abertas de teste.
4. **Storage → Get started**: habilite o bucket `carros-ed674.firebasestorage.app`. Na aba **Rules**, publique [firebase/storage.rules](firebase/storage.rules). As regras consultam o perfil no Firestore; aceite a permissão entre os serviços se o console solicitar. **O Firebase Storage exige plano Blaze/faturamento para projetos novos.** Confira o plano no console antes de ativar. Login e manutenção usam Auth/Firestore; salvar projetos com fotos e enviar rodas exige Storage.
5. Faça o deploy da versão atual na Vercel e recarregue a página.

Se preferir a CLI, autentique sua conta de proprietário no Firebase e use `firebase deploy --only firestore:rules,storage --project carros-ed674`. Isso publica regras, não ativa automaticamente todos os produtos ou faturamento. Nunca envie arquivos de conta de serviço ou senhas pelo chat ou pelo Git.

A ativação dos produtos e a publicação de regras no projeto real ainda precisam ser feitas pelo proprietário. A configuração web não concede permissão administrativa para realizar essas ações daqui.

## Criar o primeiro master

1. Cadastre sua conta no app com nome, e-mail completo e senha de pelo menos oito caracteres.
2. No Firebase, abra **Firestore Database → Data → users**.
3. Confira o UID e o e-mail da conta que você acabou de cadastrar. Edite **apenas** o campo `role`: de `user` para `master`. Salve.
4. Recarregue o app. A aba **Admin** ficará disponível.

A mudança feita pelo console exige acesso de proprietário ao projeto e não depende de abrir regras públicas. Usuários comuns não conseguem promover a si mesmos. Não existe senha padrão nem conta master criada pelo código do navegador. `MASTER_EMAIL`/`MASTER_PASSWORD` eram usados apenas na versão SQL anterior e **não** criam contas no Firebase. O comando `npm run admin` explica esse procedimento; promoção via CLI SQL só existe com `DATA_PROVIDER=legacy`.

Se o cadastro criou a conta no Authentication, mas falhou porque o Firestore ainda não estava ativo, configure o Firestore/regras e use **Entrar** com os mesmos dados. O perfil será criado no primeiro login bem-sucedido, preservando a conta Auth existente.

## Vercel

Importe `robertosugayama/carros`, framework **Vite**, Node **24.x**, saída `dist`. O padrão de frontend e backend é **Firebase**: não precisa de Turso nem de credencial de conta de serviço para login/dados. Remova valores antigos `DATA_PROVIDER=legacy` ou `VITE_DATA_PROVIDER=legacy`, caso tenham sido configurados.

Para IA, mantenha somente no servidor:

- `GEMINI_API_KEY` (Sensitive).
- `GEMINI_IMAGE_MODEL`: modelo de edição disponível na sua conta; padrão `gemini-2.5-flash-image`.
- `GEMINI_MODEL`: modelo de detecção disponível na sua conta; padrão solicitado `gemini-flash-latest`.

Confirme os identificadores de modelos na sua conta. Não há chamada real Gemini validada nesta sessão. A chave web do Firebase é diferente da chave Gemini. Nunca use `VITE_` para segredos. Alterações de variáveis requerem **Redeploy**.

A API Express `/api/gemini/*` verifica o ID token assinado do Firebase com o projeto correto e lê o perfil autorizado no Firestore. Os certificados de assinatura são públicos; não é necessário colocar uma chave privada de serviço no navegador ou na Vercel para esse fluxo. Perfil bloqueado não pode usar a IA.

## Executar

Node.js 24 ou superior:

```sh
npm ci
npm run dev
```

Express e Vite usam a mesma porta 3000; use `PORT=3100` se necessário. Produção local: `npm run build` e `npm start`. A configuração web já aponta para o projeto fornecido. Para segredos locais, use `node --env-file=.env node_modules/tsx/dist/cli.mjs server.ts`; `.env` não é versionado.

## Seleção e disponibilidade dos modelos Gemini

`geminiGateway.ts` respeita o modelo configurado como primeira opção. Em erro 404 ou incompatibilidade de modalidades, consulta `models.list` com a própria chave e tenta um modelo Gemini compatível listado pelo serviço; não inventa nomes nem usa modelos Imagen na API generateContent. Imagem e visão têm seleção independente, com cache por hash da chave e prazo de cinco minutos. SDK retries ficam desativados para evitar repetições escondidas; há uma repetição controlada em HTTP 500/502/503. O orçamento total do pedido é 85 segundos, dentro dos 120 segundos da Function, respeitando também os sinais de cancelamento de cada etapa. Logs não registram chave nem mensagens brutas do Google. Testes usam SDK real com HTTP simulado para conferir o catálogo REST, a seleção, limites e classificação; a disponibilidade efetiva da conta em produção ainda depende do Gemini.

## Compatibilidade das Functions na Vercel

O runtime está fixado em Node `24.x` e o Firebase Admin em `13.10.0`. A série Admin 14 traz `jwks-rsa` 4, que faz `require()` do módulo ESM `jose` 6; com interoperabilidade `require(ESM)` desativada isso causa `ERR_REQUIRE_ESM` durante a inicialização de todas as rotas da API. Não atualizar essa dependência sem executar `npm test`, que inclui inicialização do handler com `--no-experimental-require-module`. O teste verifica `/api/status` e rejeição de token inválido, sem chave privada ou chamada Gemini.

## Rodas, fotos e freios

- Envie foto lateral do carro a 90°. As rodas permanecem circulares e o zoom acompanha a foto.
- **Ajustar tamanho das duas rodas** altera os dois diâmetros juntos pela barra horizontal. Para posicionar, arraste cada roda. Não há alça verde ou marcadores sobre a imagem.
- Três modelos originais de aparência fotográfica estão prontos: AT Silver Split, AT Graphite Six e AT Bronze Mesh. São **imagens geradas por IA**, não fotografias de produtos de fabricantes. A interface identifica sua origem.
- Os três modelos do app agora têm aros vazados separados dos pneus e freios, com onze cores de pinça e discos lisos/perfurados sem chamada de IA a cada mudança. Os aros e as texturas fotográficas de pneu/disco foram gerados por IA e permanecem identificados como simulação. Os arquivos anteriores continuam disponíveis para compatibilidade.
- **Enviar foto de roda** abre um formulário compacto com nome da roda, fabricante e tamanho do aro. Selecionar a foto inicia automaticamente o tratamento Gemini: remoção de fundo, correção de perspectiva, centralização e recorte. Não há ajustes manuais. O preparo extrai somente o aro; a montagem acrescenta o pneu de perfil selecionado e o freio atrás dos raios. O fabricante é armazenado no campo `credit`, compatível com as regras já publicadas. Salvar exige tratamento concluído; falhas permitem tentar novamente ou trocar a foto. Fotos com ângulo extremo/oclusão podem não permitir correção fiel. Imagens tratadas continuam identificadas como IA; o resultado real depende do modelo e da chave configurados.
- Usuários guardam rodas em catálogo pessoal e submetem à aprovação. O master publica em **Admin → Fotos enviadas por usuários**. A publicação copia a imagem para a área pública do Storage.
- Fotografias de aro vazado recebem disco e pinça em camadas atrás dos raios. O disco usa referência de 280 mm (cerca de 61% de um aro 18), com folga para a borda interna, em vez de preencher todo o aro. Montagens antigas que já têm freios embutidos na foto mantêm seus componentes; o botão de tratamento IA permanece disponível nesses casos.
- As 18 referências de marcas continuam aguardando fotos reais verificadas, sem substituição por desenhos ou fotos de outros modelos.
- Projetos guardam as configurações e cópias das imagens no Storage, com metadados no Firestore. As imagens não são gravadas como Base64 em documentos Firestore, respeitando o limite de 1 MiB.
- Exportação PNG preserva rodas, cor e tipo do disco. A montagem é 2D; não mede furação, offset, folgas ou homologação.

O preparo pede à IA um fundo uniforme magenta e remove essa cor no servidor, inclusive nos vãos dos raios. Isso evita depender de transparência nativa na imagem devolvida pelo Gemini. Se a IA ignorar essa cor, o servidor também reconhece fundos uniformes pelas bordas e remove apenas regiões de cor semelhante conectadas à margem; detalhes claros isolados no interior são preservados. Fundos complexos e resultados sem conteúdo suficiente continuam sendo recusados. A saída intermediária é limitada a 1600 pixels para conter o uso de memória. O servidor valida o resultado e não salva imagens cujo fundo não pôde ser separado. Fotos de rodas com acabamento magenta podem exigir outro tratamento; a fidelidade da perspectiva depende da resposta do modelo.

Quando a remoção por cor não é possível, o preparo faz uma segunda chamada de visão (`GEMINI_WHEEL_VISION_MODEL`, padrão `gemini-flash-latest`) para localizar a face da roda e os espaços de fundo entre raios. O servidor valida as coordenadas/confiança, recorta a face, normaliza a elipse para 800×800 e aplica uma máscara circular com transparência nos vãos identificados. Não há ajustes manuais. Normalmente há uma chamada de imagem e, se necessário, uma de recorte. Em caso de modelo indisponível, o app consulta o catálogo da própria chave e seleciona uma alternativa compatível, priorizando Flash. Cada etapa permite no máximo três tentativas, com uma troca de modelo e uma repetição em falha temporária; chamadas adicionais podem gerar custo Gemini. Chave inválida, cota e entrada inválida não são repetidas automaticamente. A Function tem limite de 120 segundos; os pedidos Gemini têm limites próprios de 45 e 20 segundos. Visão e geração podem errar em fotos com ocultação ou ângulo extremo; os testes locais simulam as respostas Gemini e não comprovam fidelidade em uma foto real ainda não fornecida.

Falhas de IA retornam códigos específicos para chave recusada, acesso negado, cota, modelo indisponível, tempo limite e preparo da imagem. Os logs `AI_IMAGE_FAILURE` registram apenas código e status, sem chave, imagem ou mensagem bruta do provedor. O faturamento Blaze do Firebase não garante cota na API Gemini. Não há chamada real Gemini validada neste ambiente.

### Perfis de pneus e proporções

O seletor oferece Baixo (35%), Médio (50%) e Alto (65%), com largura visual de referência de 225 mm e aros de 14 a 22 polegadas. `src/tyres.ts` calcula diâmetro externo = aro × 25,4 + 2 × largura × perfil. Trocar perfil ou aro redimensiona as duas posições juntas; a barra comum escala pneu, aro, disco e pinça como um único conjunto. São proporções de simulação, não medições de compatibilidade do carro.

`src/wheelAssembly.ts` compõe texturas fotográficas em canvas, com remapeamento radial do pneu para cada altura de flanco, freio atrás dos raios e bordas transparentes. Projetos guardam `tyreProfile`; antigos usam Médio. PNG exportado usa a mesma imagem composta mostrada na tela, sem substituir a montagem pela foto do aro. Perfis e cores não requerem novas chamadas Gemini nem alterações nas regras Firebase. As referências sem fotografia continuam pendentes.

## Regras e dados

`users/{uid}` guarda nome, e-mail, papel, bloqueio e data, sem senhas. Projetos e manutenções são subcoleções do usuário. `wheelPhotos` reúne envios privados/públicos; `catalog` guarda disponibilidade dos modelos. Storage separa pastas de projetos, envios de rodas e catálogo público. URLs de download do Storage contêm tokens de acesso: compartilhe somente quando desejar dar acesso à imagem.

As regras bloqueiam criação/edição de papel master por usuários comuns, acesso a dados alheios e operações privadas de contas bloqueadas. O master gerencia perfis e publicações. Confirme backups, quotas e política de retenção no console antes de ampliar o uso.

## Verificação

```sh
npm run build
npm test
npm run test:firebase
```

`test:firebase` e `test:browser` iniciam **emuladores locais** de Authentication e Firestore com o projeto `demo-autotuner`, sem criar usuários no projeto real. Requerem Java 21, Python 3 e Chromium em `/usr/bin/chromium`. O script obtém o componente oficial do Google Cloud SDK e confere SHA-256 do manifesto, ou aceita `FIRESTORE_EMULATOR_JAR` fornecido pelo operador. Não modifica o JAR nem desativa verificações.

Foram exercitados cadastro/login pelo SDK real contra emuladores, persistência de manutenção, promoção confiável, prevenção de autopromoção, isolamento de dados, bloqueio e verificação do token no backend IA. **Storage e chamadas Gemini reais não foram exercitados**; o download do runtime do emulador Storage foi bloqueado pela rede e a ativação real do Firebase pertence ao proprietário.

O modo anterior permanece preservado em `legacyServer.ts`/`database.ts`. `npm run test:browser:legacy` valida montagem, tratamento simulado, publicação, freios, histórico e PNG usando servidor/banco temporários e uma build separada em `/tmp`, sem alterar a build Firebase de produção. Esse teste não comprova upload remoto no Firebase Storage.

O RodaBem anterior segue no backup verificado `/workspace/rodabem-7j53djxl/rodabem-completo.tar.gz`, para integração futura solicitada pelo proprietário. Não há migração automática de contas SQL para Firebase. A implantação real e seus produtos não foram confirmados nesta sessão.

### CORS de imagens para exportação

A exportação usa canvas no navegador. Se o bucket bloquear leitura entre origens, aplique `firebase/storage.cors.json` no Cloud Shell da sua conta de proprietário:

```sh
gcloud storage buckets update gs://carros-ed674.firebasestorage.app --cors-file=firebase/storage.cors.json
```

Use o arquivo do repositório e adicione seu domínio próprio se necessário. CORS não substitui as regras de autorização. A configuração CORS do bucket real não foi aplicada nem validada nesta sessão.

### Envio de imagens e resíduo de fundo

Após a remoção inicial, o preparo remove resíduos roxos escuros ligados ao exterior transparente. O preparo também remove o magenta solicitado à IA nos vãos fechados entre raios, incluindo variações rosa e roxo escuro. Essa limpeza se aplica somente ao preparo, nunca à troca de cor de freios. Acabamentos reais magenta/roxos podem ser confundidos com o fundo e precisam de validação específica. Fotos com pintura roxa na própria borda exigem conferência visual, pois podem se confundir com o fundo solicitado.

Se o SDK do Storage esgotar as tentativas, o frontend tenta `/api/storage/upload` na mesma origem. A API verifica o ID token e o perfil, restringe destinos ao usuário (ou catálogo para master), e encaminha o mesmo token ao endpoint Firebase Storage; não usa uma conta administrativa nem ignora regras. A imagem tratada permanece no formulário em caso de erro. O retorno distingue bucket ausente, acesso negado e indisponibilidade. Testes locais dessa alternativa usam respostas HTTP simuladas; bucket e regras reais ainda dependem da configuração do proprietário.

### Rodas salvas e carregamento no canvas

As fotos Firebase passam por `POST /api/storage/image` antes da composição. Isso evita depender de cabeçalhos CORS do bucket para miniaturas, montagem, recoloração e exportação. A API só lê imagens do bucket configurado; pastas `catalog` usam regras públicas, pastas `users` exigem ID token válido e UID correspondente. A requisição ao Firebase usa as regras do Storage, sem credencial administrativa e sem reutilizar tokens de download para contornar autorização. Há limite de 4 MB por resposta e tempo de leitura; URLs externas, outros buckets e redirecionamentos são recusados. O frontend compartilha a leitura em cache e mostra carregamento/erro em vez de deixar uma roda silenciosamente em branco. Fotos existentes não precisam ser reenviadas. O teste de navegador usa uma foto remota com acesso direto bloqueado e resposta da API simulada, verificando catálogo e as duas posições; não prova a configuração do bucket real.
