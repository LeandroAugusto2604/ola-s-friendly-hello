

# Corrigir URL da Aplicação para VPS

## Problema
O `APP_URL` em `src/config/app.ts` ainda aponta para `https://emprestimo-zl.lovable.app` ao invés do domínio real da sua VPS.

## Mudança

**Arquivo**: `src/config/app.ts`

Atualizar a constante `APP_URL`:

- **Antes**: `"https://emprestimo-zl.lovable.app"`
- **Depois**: `"http://emprestimo.devprod.cloud"`

Isso fará com que todos os links de verificação enviados pelo WhatsApp apontem para o endereço correto da sua VPS.

## Detalhes Técnicos

Apenas uma linha precisa ser alterada no arquivo `src/config/app.ts`. Após a mudança, os links gerados terão o formato:

```
http://emprestimo.devprod.cloud/verify/{token}
```

**Importante**: Após exportar novamente para a VPS, lembre-se de fazer o rebuild (`npm run build`) para que a alteração tenha efeito.

