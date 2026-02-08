

# Corrigir Erro do Botão WhatsApp

## Problema Identificado
O `APP_URL` em `src/config/app.ts` esta configurado como `http://emprestimo.devprod.cloud`, mas o endereco real da VPS e `http://emprestimo.dev-prod.cloud` (com hifen entre "dev" e "prod").

Alem disso, o erro "Nao foi possivel gerar o link de verificacao" indica que a insercao na tabela `identity_verifications` pode estar falhando. Isso pode ocorrer se o usuario estiver deslogado ou se houver um problema de sessao.

## Mudancas

### 1. Corrigir APP_URL (`src/config/app.ts`)
- **Antes**: `"http://emprestimo.devprod.cloud"`
- **Depois**: `"http://emprestimo.dev-prod.cloud"`

### 2. Melhorar tratamento de erro (`src/components/LoansList.tsx`)
- Adicionar log do erro real no `catch` do `handleSendVerification` para facilitar debug
- Mostrar mensagem de erro mais descritiva no toast (incluindo o motivo real quando disponivel)

## Detalhes Tecnicos

O fluxo do botao WhatsApp e:
1. Gera um UUID como token
2. Insere registro na tabela `identity_verifications` (com RLS ativo -- policy verifica se o loan pertence ao usuario logado)
3. Monta o link `APP_URL/verify/{token}`
4. Abre o WhatsApp com a mensagem

A policy de INSERT exige que o `loan_id` pertenca a um cliente do usuario logado. Se houver problema de sessao, o insert falha e o toast mostra "Erro".

A correcao principal e o endereco da VPS. A melhoria no log ajudara a diagnosticar problemas futuros.

