# MOVIX Studio

Um estúdio independente, em português, para criar imagens por texto, vídeos por texto com **Seedance 2.5** e animações de uma imagem com DoP Turbo usando a API Higgsfield. A interface e as ilustrações de exemplo são originais; este não é o aplicativo oficial Higgsfield.

## Começar

Requisitos: Node.js 24, npm e uma chave da API Higgsfield com acesso aos modelos utilizados. Consulte sua conta no [Higgsfield Open](https://open.higgsfield.ai/). **Cada criação pode ser cobrada.**

```bash
npm install
```

Preencha `HF_CREDENTIALS` **localmente** em `.env.local`, no formato `key-id:key-secret`. Esse arquivo está ignorado pelo Git. Não coloque a chave em uma variável `VITE_`, no código-fonte ou no chat. O servidor lê `.env.local` ao iniciar; reinicie-o se editar o arquivo.

```bash
npm run dev
```

Abra `http://127.0.0.1:5173`. Para executar os arquivos compilados, rode `npm run build` e depois `npm start` (porta padrão `8787`). Se alterar `MOVIX_API_PORT` em `.env.local`, ajuste o destino do proxy em `vite.config.ts` durante o desenvolvimento.

## Seedance 2.5 no site

Na aba **Vídeo**, descreva a cena para criar um vídeo diretamente do texto pelo endpoint `bytedance/seedance-2.5/text-to-video`. O padrão é **5 segundos, 720p, 16:9**, conforme a [referência oficial do modelo](https://console.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference); você pode ajustar duração (4–30 segundos), resolução (480p, 720p ou 1080p) e formato (16:9, 1:1 ou 9:16). A aba **Animar** mantém a criação a partir de imagem com DoP Turbo. A aba **Imagem** usa Flux Pro Kontext Max.

O exemplo isolado em [`index.ts`](index.ts) chama `subscribe` do [SDK oficial](https://docs.higgsfield.ai/docs/how-to/sdk) com o prompt `A cinematic scene at sunset`, duração 5, resolução 720p e formato 16:9. Ele espera a conclusão, imprime a URL do vídeo somente após `completed` e falha com mensagem apropriada se o resultado for cancelado, bloqueado, falhar ou não trouxer URL. **O comando abaixo envia uma solicitação faturável**:

```bash
npm run example
```

## Outros recursos e limites

- Upload de imagem JPEG, PNG ou WebP para **Animar** por URL temporária de upload do provedor. A chave permanece no servidor; o navegador envia somente o arquivo ao armazenamento autorizado. Também é possível informar uma URL HTTPS pública ou usar uma imagem criada anteriormente.
- Histórico persistido localmente em `.data/jobs.json`. No deploy da Vercel, a biblioteca fica no armazenamento **deste navegador**, e a API consulta o status no Higgsfield pelo ID da solicitação; não há sincronização entre dispositivos. Remover um item do histórico não apaga a mídia remota. URLs de mídia dependem da disponibilidade do provedor.
- As cenas de inspiração são **ilustrações SVG locais**, não resultados gerados. Sem chave válida, créditos e acesso ao modelo na conta, nenhuma geração real ocorre.
- Após reinício do servidor, tarefas ainda em execução são marcadas como interrompidas; confira o painel Higgsfield antes de reenviar para evitar cobranças duplicadas.

O navegador se comunica com o servidor Express local ou com as funções Node da Vercel em `/api`. O servidor usa `@higgsfield/client` V2; as credenciais não são incluídas em respostas, no bundle do navegador nem no histórico. Localmente, a API escuta somente `127.0.0.1`. No deploy, as rotas de criação, consulta de resultados e upload exigem um código de acesso separado; mesmo assim, trate esse código como segredo e não distribua a URL ou o acesso publicamente.

## GitHub e Vercel

O repositório GitHub deve ser **privado**; `.env.local`, `.data`, `node_modules` e `dist` estão ignorados pelo Git. A configuração em [`vercel.json`](vercel.json) compila o frontend Vite e as funções em `api/` recebem requisições curtas. A função de criação apenas envia o pedido e devolve um ID; o navegador consulta o resultado em chamadas separadas, evitando ficar preso ao tempo máximo de execução da Vercel.

Antes de ativar o deploy, configure as seguintes **variáveis privadas** no projeto Vercel para o ambiente de produção (e Preview, se usar):

- `HF_CREDENTIALS`: a chave Higgsfield no formato `key-id:key-secret`, somente no servidor.
- `MOVIX_ACCESS_TOKEN`: um código aleatório e privado com **pelo menos 32 caracteres**. Quem souber esse código poderá gerar mídia usando seus créditos. Sem ele, a API publicada recusa pedidos.

Após definir as variáveis, faça um novo deploy. Não grave o código de acesso em arquivos versionados, não use prefixo `VITE_` e não publique capturas de tela ou logs com os segredos. A biblioteca no navegador não é backup: resultados e URLs do provedor podem expirar. Para retenção permanente ou uso multiusuário, adicione banco de dados e armazenamento de mídia; este protótipo não fornece esses serviços.

**Importante:** se uma tentativa de geração retornar erro sem informar um ID, verifique o painel Higgsfield antes de reenviar. A chamada pode ter sido aceita mesmo sem resposta ao aplicativo, e uma repetição pode causar cobrança dupla.

```bash
npm test
```

## Origem e licenças

O repositório público [higgsfield-ai/higgsfield](https://github.com/higgsfield-ai/higgsfield) é infraestrutura de treinamento licenciada em Apache-2.0, não o produto criativo. Este projeto não copia seu código nem o código de [app-templates](https://github.com/higgsfield-ai/app-templates), que não indica licença de reutilização. A dependência `@higgsfield/client` declara licença MIT no [package.json oficial](https://github.com/higgsfield-ai/higgsfield-js/blob/main/package.json). Higgsfield é marca de sua respectiva proprietária; seu nome aqui identifica apenas a integração.
