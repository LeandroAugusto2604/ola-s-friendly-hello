# Deploy na VPS — Gerenciamento de Empréstimos

Este projeto é um site estático (React + Vite). O build gera a pasta `dist/`,
que é servida pelo nginx na VPS. O Supabase (backend) fica na nuvem — nada
precisa ser instalado na VPS além do nginx.

## 1. Enviar o código para o GitHub

No Lovable: **Configurações do projeto → Git → Conectar GitHub**.
Isso cria um repositório privado e envia (push) o projeto inteiro, e mantém
tudo sincronizado automaticamente a cada alteração feita aqui.

> Essa conexão precisa ser feita por você na interface do Lovable
> (precisa de permissão de dono do projeto).

## 2. Primeira instalação na VPS (apenas uma vez)

```bash
# clone o repositório (substitua SEU-USUARIO e NOME-DO-REPO)
cd /opt
git clone https://github.com/SEU-USUARIO/NOME-DO-REPO.git emprestimo
cd emprestimo

# gere e publique o build
./deploy/deploy.sh
```

## 3. Atualizações seguintes

Sempre que quiser atualizar o site, rode na VPS:

```bash
cd /opt/emprestimo
./deploy/deploy.sh
```

O script faz: `git pull` → instala dependências → `build` → copia a pasta
`dist/` para `/var/www/emprestimo` (troque com `WEB_ROOT=/caminho ...` se o
seu nginx usa outro diretório).

## 4. Nginx (SPA)

Garanta que o site raiz aponte para `/var/www/emprestimo` e que rotas
profundas funcionem (refresh não dá 404):

```nginx
server {
    listen 80;
    server_name emprestimo.dev-prod.cloud;
    root /var/www/emprestimo;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Depois de alterar: `sudo nginx -t && sudo systemctl reload nginx`.

## Observações

- As credenciais do Supabase (URL e chave pública) já estão no código, não
  há segredo a configurar na VPS.
- As **migrations do banco** (pasta `supabase/migrations/`) não são aplicadas
  por esse script — o banco é o do Lovable Cloud, já atualizado automaticamente.
- Link de cadastro de clientes: `https://emprestimo.dev-prod.cloud/register`
  (configurado em `src/config/app.ts`).
