
# Plano: Corrigir Links e Configurações para VPS

## Visão Geral
O projeto exportado não funciona porque contém URLs hardcoded que apontam para a infraestrutura do Lovable/Supabase Cloud. Precisamos tornar essas URLs configuráveis para funcionar na sua VPS.

---

## Mudanças Necessárias

### 1. Criar Configuração de Domínio Centralizada

**Arquivo**: `src/config/app.ts` (novo)

Criar um arquivo de configuração que define o domínio da aplicação:

```text
src/
└── config/
    └── app.ts    ← Novo arquivo com configurações do app
```

Este arquivo conterá:
- URL base da aplicação (seu domínio VPS)
- URL do Supabase (pode ser Cloud ou self-hosted)

---

### 2. Atualizar LoansList.tsx

**Linhas afetadas**: 186, 220, 238

Substituir o domínio hardcoded por uma configuração dinâmica:

**Antes**:
```typescript
const verificationLink = `https://emprestimo-zl.lovable.app/verify/${token}`;
```

**Depois**:
```typescript
import { APP_URL } from "@/config/app";
// ...
const verificationLink = `${APP_URL}/verify/${token}`;
```

---

### 3. Atualizar VerifyIdentity.tsx

**Linhas afetadas**: 13

Substituir a URL do Supabase hardcoded:

**Antes**:
```typescript
const SUPABASE_URL = "https://bpafoiivtwmcqgjvsgjs.supabase.co";
```

**Depois**:
```typescript
import { SUPABASE_URL } from "@/config/app";
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/config/app.ts` | Criar | Configurações centralizadas |
| `src/components/LoansList.tsx` | Editar | Usar APP_URL para links |
| `src/pages/VerifyIdentity.tsx` | Editar | Usar SUPABASE_URL do config |

---

## Detalhes Técnicos

### Arquivo de Configuração (`src/config/app.ts`)

```typescript
// URL base da aplicação - altere para o domínio da sua VPS
export const APP_URL = "https://seu-dominio.com.br";

// URL do Supabase - mantenha se usar Supabase Cloud, 
// ou altere se usar self-hosted
export const SUPABASE_URL = "https://bpafoiivtwmcqgjvsgjs.supabase.co";
```

### Instruções Pós-Deploy na VPS

Após a implementação, você precisará:

1. **Editar `src/config/app.ts`** na VPS com seu domínio real
2. **Fazer rebuild do projeto** (`npm run build`)
3. **Configurar secrets da Edge Function** no Supabase:
   ```bash
   supabase secrets set SUPABASE_URL=sua_url
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_chave
   ```

---

## Resultado Esperado

Após estas mudanças:
- Os links de verificação enviados pelo WhatsApp apontarão para o domínio correto da VPS
- A página de verificação de foto funcionará corretamente
- Será fácil alterar configurações editando um único arquivo
