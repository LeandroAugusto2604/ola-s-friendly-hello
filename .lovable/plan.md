

# Plano: Adicionar botao de editar dados do cliente

## O que sera feito

Adicionar um botao "Editar" na area de detalhes de cada cliente (dentro do AccordionContent do LoansList) que abre um dialog/modal com os campos editaveis: Nome, Endereco, RG, CPF e Celular. Ao salvar, atualiza o registro no Supabase e recarrega a lista.

## Alteracoes

### 1. Criar componente `EditClientDialog`
- Novo arquivo `src/components/EditClientDialog.tsx`
- Dialog com formulario contendo os campos: Nome Completo, Endereco, RG, CPF, Celular
- Pre-preenchido com os dados atuais do cliente
- Validacao com zod (mesmas regras do LoanForm)
- Formatacao automatica de CPF e telefone
- Ao salvar, faz `supabase.from("clients").update(...)` e chama callback de sucesso

### 2. Atualizar `LoansList.tsx`
- Importar o novo componente `EditClientDialog`
- Adicionar botao "Editar" ao lado dos botoes "PDF" e "Excluir Cliente" (linha ~606-645)
- Icone `Pencil` do lucide-react
- Passar dados do cliente e callbacks (onSuccess -> refetch + onDataChange)

## Fluxo do usuario
1. Expande o accordion de um cliente
2. Clica no botao "Editar"
3. Modal abre com campos pre-preenchidos
4. Edita os campos necessarios
5. Clica "Salvar" -> atualiza no banco -> fecha modal -> lista atualiza

