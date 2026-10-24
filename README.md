# AutoTuner 3D — Provador de rodas e garagem virtual

Aplicação web mobile-first em português. React 19 + TypeScript, Vite, Tailwind CSS, Lucide e Express. Este projeto agora ocupa a raiz do repositório `robertosugayama/carros`. O RodaBem foi preservado em backup antes da substituição; a integração das suas funções será uma próxima etapa.

## Executar no computador ou ambiente de desenvolvimento

Requer Node.js 24.

```sh
npm ci
npm run dev
```

Servidor Express e frontend na mesma porta, **3000** por padrão. Se estiver ocupada: `PORT=3100 npm run dev`. Para produção em servidor Node: `npm run build` seguido de `npm start`. Em desenvolvimento, use as variáveis já injetadas no processo ou `node --env-file=.env node_modules/tsx/dist/cli.mjs server.ts`; não coloque chaves no frontend.

## O que está implementado

- Foto por câmera (`capture="environment"`) ou galeria; JPEG, PNG e WebP. Redimensionamento no dispositivo a até 1800 px, com limite de payload adequado a funções serverless.
- Rodas SVG circulares com `useId()` para gradientes independentes; ambos os centros e diâmetros são ajustáveis por arraste ou sliders. O zoom altera a cena inteira, preservando as proporções 1:1. Visualização original/depois e exportação PNG.
- 18 entradas de catálogo, 7 acabamentos metálicos e 11 cores de pinças. Raios divididos, mesh, turbina e estrela; disco escovado com furos, marcas concêntricas e pinça com identificação BREMBO. Aro de 14 a 22, com pneu de perfil visual variável e diâmetro externo constante.
- Cadastro/login com senha scrypt e salt individual, cookie HttpOnly/SameSite, sessões de sete dias, histórico por usuário, garagem com fotos/configurações/notas e registro de manutenção por veículo.
- Master: listar usuários, bloquear/desbloquear, promover/rebaixar outros administradores e ativar/ocultar as 18 entradas do catálogo. Não há criação de conta master pública nem senha padrão.
- Endpoint real `POST /api/gemini/detect-wheels` usando `@google/genai`, restrito a contas autenticadas. Sem chave, informa indisponibilidade; ajuste manual funciona sem IA. HUD é uma animação de espera indicativa, não telemetria do modelo.

## Primeira conta master

Cadastre sua própria conta no app. No servidor, com o banco correto selecionado:

```sh
npm run admin -- seu-email@exemplo.com
```

Saia e entre ou recarregue a página. O comando também funciona com banco remoto configurando suas variáveis no terminal seguro.

## Gemini

Configure `GEMINI_API_KEY` somente no servidor. O modelo solicitado, `gemini-3.8-flash`, está configurado como padrão, mas **a disponibilidade desse identificador não foi confirmada**. Se ele não existir ou não estiver disponível na sua conta, defina `GEMINI_MODEL` com um identificador compatível disponível no Google AI Studio. Não há fallback silencioso para outro modelo. A ausência da chave e falhas da API são tratadas explicitamente; uma detecção real ainda não foi validada.

A foto enviada é compartilhada com o serviço Gemini quando o usuário escolhe detectar com IA. Fotos manuais não são enviadas ao Gemini. A API valida posições normalizadas, diâmetros e aro retornados; fotos fora de perfil devem ser recusadas pelo modelo. Resultados da IA são estimativas revisáveis pelo usuário.

## Vercel, passo a passo

1. Envie **o conteúdo desta pasta** para o repositório que receberá o AutoTuner. Não misture os arquivos com o RodaBem. Se usar uma subpasta no GitHub, selecione essa subpasta em Root Directory na Vercel.
2. Crie um banco no Turso e obtenha a URL `libsql://…` e um token.
3. Na Vercel, importe o repositório, escolha framework **Vite**, Node **24.x**. `vercel.json` configura `npm run build`, saída `dist` e API Express em `api/index.ts`.
4. Em Settings → Environment Variables, configure `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (sensível). Para usar IA, configure também `GEMINI_API_KEY` (sensível) e confirme `GEMINI_MODEL`. Nunca use prefixo `VITE_` para segredos. Não envie chaves por chat, Git ou capturas de tela.
5. Faça o deploy e cadastre uma conta. Valide login, salvar/reabrir um projeto, registrar manutenção e sair/entrar novamente. Promova sua conta no banco remoto com o comando administrativo acima.

As tabelas são criadas automaticamente. A Vercel exige banco remoto e ativa cookie Secure; nunca armazene a garagem em `/tmp`. Sem URL do banco, o servidor recusa iniciar na Vercel. Em desenvolvimento, o padrão é SQLite local em `data/app.db`; preserve essa pasta e faça backups. Não há migração automática de um banco local existente para o remoto.

**Publicação:** o envio ao GitHub não cria nem confirma um deploy na Vercel. O banco Turso precisa ser configurado, e nenhum link público foi criado por este trabalho. As instruções e a configuração Vercel estão preparadas; publicação remota não foi validada.

## Testes

```sh
npm run build
npm test
node tests/browser.mjs
```

O teste de navegador usa Chromium instalado em `/usr/bin/chromium`; ajuste `executablePath` em outro computador ou instale o navegador do Playwright. Usa servidor e banco temporários próprios. Verifica catálogo, círculos, proporção do zoom, ajuste, antes/depois, celular sem overflow, cadastro, upload, salvar/reabrir projeto e exportar PNG. As imagens `desktop.png` e `mobile.png` são capturas reais da interface durante os testes. Testes de API verificam isolamento entre usuários, manutenção, validações, bloqueio e permissões master. Gemini e Turso remoto não são simulados como funcionando.

## Limites desta versão

O nome 3D descreve o sombreamento visual dos componentes: a montagem sobre a foto é 2D frontal, sem reconstrução tridimensional. Os desenhos de roda são interpretações vetoriais dos estilos do catálogo, não modelos CAD ou reproduções oficiais certificadas dos fabricantes. Uma foto lateral é essencial; não há correção de perspectiva por elipses. A proporção aro/pneu é ilustrativa e não substitui as medidas reais dos pneus.

Antes de ampliar o acesso público: configure rate limiting compartilhado ou WAF (a limitação atual é por instância), política de privacidade/retensão de fotos, backups e recuperação de senha/verificação de e-mail. Múltiplos projetos com fotos são armazenados no banco nesta versão; para grandes catálogos, migre imagens para armazenamento de objetos privado.
