# Higgsfield Video Starter

## Instalação
```bash
npm install
```

## Executar
```bash
npm start
```

O exemplo usa `HF_CREDENTIALS` carregado de `.env.local`.

**Segurança:** não publique `.env.local` nem compartilhe sua chave. O `.gitignore` exclui arquivos `.env*`, mantendo apenas `.env.example`.

**Atenção à credencial:** o exemplo fornecido pela documentação espera `HF_CREDENTIALS=your-api-key-id:your-api-key-secret`. O valor fornecido foi uma única UUID. Se a API retornar erro de autenticação, gere/consulte as credenciais corretas no painel da Higgsfield e informe o par no formato `ID:SECRET`.
