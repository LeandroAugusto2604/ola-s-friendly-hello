
# Plano: Verificação de Identidade via WhatsApp (Sem Custo)

## Resumo

Sistema de verificação de identidade onde após cadastrar um empréstimo, você poderá enviar um link de verificação para o cliente. O cliente receberá o link pelo WhatsApp, tirará uma foto segurando o RG, e você poderá visualizar a foto no sistema.

## Como vai funcionar

```text
+------------------+     +------------------+     +------------------+
|  Cadastrar       | --> |  Clique "Enviar  | --> |  WhatsApp abre   |
|  Empréstimo      |     |  Verificação"    |     |  com link pronto |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
+------------------+     +------------------+     +------------------+
|  Você visualiza  | <-- |  Foto armazenada | <-- |  Cliente tira    |
|  foto no sistema |     |  no Supabase     |     |  foto com RG     |
+------------------+     +------------------+     +------------------+
```

## O que será implementado

### 1. Banco de Dados

**Nova tabela `identity_verifications`:**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID único |
| loan_id | uuid | Referência ao empréstimo |
| token | text | Token único para o link |
| status | text | pending, completed, expired |
| photo_url | text | URL da foto no Storage |
| created_at | timestamp | Data de criação |
| verified_at | timestamp | Data da verificação |

**Novo bucket de Storage:**
- `identity-photos` - Bucket público para armazenar as fotos de verificação

### 2. Página Pública de Verificação

Nova rota `/verify/:token` acessível sem login:
- Layout otimizado para celular
- Acesso à câmera do dispositivo
- Upload da foto com RG
- Mensagem de confirmação após envio

### 3. Atualizações na Lista de Empréstimos

Para cada empréstimo, será adicionado:
- **Botão "Enviar Verificação"** - Gera link e abre WhatsApp
- **Status de verificação** - Badge mostrando Pendente/Verificado
- **Visualização da foto** - Modal para ver a foto enviada

### 4. Integração com WhatsApp (Gratuita)

O botão "Enviar Verificação" vai:
1. Gerar um token único para o link
2. Salvar na tabela `identity_verifications`
3. Abrir o WhatsApp Web/App com mensagem pré-preenchida:
   - `Olá! Para confirmar seu empréstimo, acesse: https://emprestimo-zl.lovable.app/verify/TOKEN`

**Alternativa:** Botão para copiar o link caso o WhatsApp não abra automaticamente

## Arquivos que serão criados

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/VerifyIdentity.tsx` | Página pública para cliente tirar foto |
| Migration SQL | Criar tabela e bucket |

## Arquivos que serão modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rota `/verify/:token` |
| `src/components/LoansList.tsx` | Adicionar botão de verificação, status e visualização |
| `src/integrations/supabase/types.ts` | Tipos para nova tabela (gerado automaticamente) |

## Detalhes Técnicos

### Página de Verificação (`/verify/:token`)

```text
+------------------------------------------+
|     Verificação de Identidade            |
+------------------------------------------+
|                                          |
|  Olá! Para confirmar seu empréstimo,     |
|  tire uma foto segurando seu RG.         |
|                                          |
|  +----------------------------------+    |
|  |                                  |    |
|  |     [Preview da câmera]          |    |
|  |                                  |    |
|  +----------------------------------+    |
|                                          |
|  [ Tirar Foto ]    [ Enviar Arquivo ]    |
|                                          |
+------------------------------------------+
```

### Botões na Lista de Empréstimos

Para empréstimos sem verificação:
- Botão verde "Solicitar Verificação" com ícone do WhatsApp

Para empréstimos com verificação pendente:
- Badge amarelo "Aguardando foto"
- Botão para reenviar link

Para empréstimos verificados:
- Badge verde "Verificado"
- Botão para visualizar foto

### Segurança

- Token único de 32 caracteres (UUID) para cada verificação
- Token expira após 7 dias
- RLS policies para proteger os dados
- Bucket público apenas para leitura (upload autenticado via token)

## Fluxo do Usuário

1. **Você cadastra um empréstimo** para o cliente João
2. **Clica em "Solicitar Verificação"** no empréstimo do João
3. **WhatsApp abre** com mensagem pronta para enviar
4. **João recebe o link** e clica nele
5. **João tira foto** segurando o RG
6. **Você vê a foto** na lista de empréstimos com badge "Verificado"

## Custo

**Zero!** Não há integração com serviços pagos. O WhatsApp é aberto diretamente pelo navegador usando deep links.
