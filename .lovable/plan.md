

# Adicionar Campo de Multa Diaria por Atraso

## Resumo
Adicionar um campo no formulario de cadastro de emprestimo para definir um valor cobrado por dia de atraso. Esse valor sera salvo no banco de dados e usado para calcular automaticamente o acrescimo nas parcelas vencidas na tela de listagem.

## Mudancas

### 1. Banco de Dados -- Nova coluna na tabela `loans`
- Adicionar coluna `daily_late_fee` (numeric, default 0) na tabela `loans`
- Essa coluna armazena o valor em reais cobrado por cada dia de atraso

### 2. Formulario de Cadastro (`src/components/LoanForm.tsx`)
- Adicionar campo "Multa Diaria por Atraso (R$)" no schema de validacao (valor >= 0)
- Adicionar o input no formulario, ao lado dos campos de juros e parcelas
- Incluir o valor de `daily_late_fee` no insert do emprestimo

### 3. Listagem de Emprestimos (`src/components/LoansList.tsx`)
- Atualizar a interface `Loan` para incluir `daily_late_fee`
- Para parcelas vencidas (nao pagas e com data anterior a hoje), calcular os dias de atraso e exibir o valor acrescido:
  - `valor_com_multa = valor_parcela + (dias_atraso * daily_late_fee)`
- Exibir o valor original e o acrescimo de forma clara na tabela de parcelas
- Atualizar o resumo de atraso para mostrar o valor total com multa

### 4. Exportacao PDF (`src/components/LoansList.tsx`)
- Incluir o valor da multa diaria nas informacoes do emprestimo no PDF
- Mostrar o valor atualizado das parcelas vencidas no PDF

## Detalhes Tecnicos

### Coluna no banco
```sql
ALTER TABLE loans ADD COLUMN daily_late_fee numeric NOT NULL DEFAULT 0;
```

### Calculo do atraso
O calculo sera feito no frontend ao exibir as parcelas:

```text
Para cada parcela nao paga:
  Se due_date < hoje:
    dias_atraso = diferenca em dias entre due_date e hoje
    valor_exibido = amount + (dias_atraso * daily_late_fee)
  Senao:
    valor_exibido = amount (sem acrescimo)
```

O valor original da parcela no banco **nao sera alterado** -- o acrescimo e calculado dinamicamente na exibicao. Isso garante que, se o cliente pagar a parcela em atraso, o valor correto do dia do pagamento seja considerado.

### Campo no formulario
- Label: "Multa Diaria por Atraso (R$)"
- Tipo: number, step 0.01, min 0
- Default: "0"
- Descricao: "Valor cobrado por dia de atraso em cada parcela"

## Arquivos Modificados
- `src/components/LoanForm.tsx` -- novo campo no formulario
- `src/components/LoansList.tsx` -- calculo e exibicao da multa
- Migracao SQL -- nova coluna `daily_late_fee`
