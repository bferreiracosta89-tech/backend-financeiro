# Backend — Controle de Restauração Financeira

Node + Express + Prisma + PostgreSQL. Autenticação via Google OAuth. Deploy 1-clique no Render.

## Endpoints

| Método | Rota                  | Descrição                                  |
|--------|----------------------|--------------------------------------------|
| GET    | /health              | Saúde do serviço                            |
| POST   | /auth/google         | Troca `idToken` do Google por JWT           |
| GET/PUT| /income              | Renda (singleton)                           |
| GET/PUT| /minexist            | Mínimo existencial (singleton)              |
| GET/PUT| /legal               | Plano jurídico (singleton)                  |
| CRUD   | /debts               | Dívidas                                     |
| CRUD   | /card-purchases      | Compras parceladas no cartão                |
| CRUD   | /expenses            | Gastos diários                              |
| CRUD   | /accounts            | Contas e cartões                            |
| CRUD   | /negotiations        | Negociações                                 |
| CRUD   | /reminders           | Lembretes                                   |
| GET/POST/DELETE | /payments   | Pagamentos mensais (com abate automático)   |
| GET    | /payments/matrix?ano=YYYY | Matriz mês-a-mês credor × competência |
| POST   | /sync                | Push + Pull num único request (LWW)         |

Todas exigem header `Authorization: Bearer <jwt>` (exceto `/health` e `/auth/google`).

## Sincronização

O cliente envia:
```json
{
  "since": "2026-05-13T12:00:00.000Z",
  "push": {
    "income":  { "bruto": 11900, "liquido": 9500, "updatedAt": "..." },
    "debts":   [ { "id": "cl..", "credor": "...", "updatedAt": "..." } ],
    "expenses":[ ... ]
  }
}
```
O servidor responde:
```json
{
  "now": "2026-05-13T12:05:00.000Z",
  "pull": {
    "income":   { ... },
    "minExist": { ... },
    "legal":    { ... },
    "debts":    [ ... mudados desde `since` ],
    "expenses": [ ... ]
  }
}
```

**Last-write-wins:** se o `updatedAt` enviado pelo cliente for menor que o do servidor, o servidor ignora aquela escrita.

## Como rodar localmente

```bash
cp .env.example .env
# preencha DATABASE_URL, JWT_SECRET e GOOGLE_CLIENT_IDS
npm install
npx prisma migrate dev --name init
npm run dev
```

## Deploy no Render

1. Crie banco grátis em https://console.neon.tech e copie a connection string (com `?sslmode=require`).
2. Em https://console.cloud.google.com/apis/credentials crie credenciais OAuth (uma para Web no Vercel, uma Android, uma iOS).
3. Suba este repositório no GitHub.
4. No Render: **New > Blueprint**, aponte para o repositório. Ele lê o `render.yaml`.
5. Defina os secrets no painel: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_IDS` (vírgula-separados).
6. Deploy. A URL pública será `https://restauracao-backend.onrender.com` (ou similar).

A primeira request demora ~30s (cold start do plano gratuito). Para eliminar, use o plano **Starter ($7/mês)**.

## Pagamentos mensais (`/payments`)

Cada `Payment` registra o evento financeiro de uma dívida num mês específico.

```json
POST /payments
{
  "id":           "cuid-gerado-no-cliente",
  "debtId":       "id-da-divida",
  "competencia":  "2026-05",
  "dataPagamento":"2026-05-10",
  "valorPago":    1245.00,
  "tipo":         "PARCELA",
  "juros":        0,
  "desconto":     0,
  "observacao":   ""
}
```

**Tipos** e o que cada um faz com o saldo da dívida:

| Tipo         | Saldo devedor       | Parcelas pagas | Status      |
|--------------|---------------------|----------------|-------------|
| PARCELA      | abate `valorPago`   | +1             | inalterado  |
| AMORTIZACAO  | abate `valorPago`   | inalterado     | inalterado  |
| PARCIAL      | abate `valorPago`   | inalterado     | inalterado  |
| LIQUIDACAO   | zera                | inalterado     | QUITADO     |
| NAO_PAGO     | inalterado          | inalterado     | inalterado  |

Ao **excluir** um pagamento (`DELETE /payments/:id`), o efeito é revertido automaticamente.

### Matriz mês a mês

```
GET /payments/matrix?ano=2026
```

Devolve:
```json
{
  "ano": "2026",
  "months": ["2026-01", "2026-02", ..., "2026-12"],
  "debts": [ { "id": "...", "credor": "BB", "parcela": 1245 }, ... ],
  "cells": {
    "<debtId>|2026-01": [ { ...payment } ],
    "<debtId>|2026-02": [ { ...payment } ]
  }
}
```
Cada célula pode ter 0..N pagamentos (pagamento + amortização extra no mesmo mês, por exemplo).

## Aplicando esta versão

Se você já fez deploy da versão anterior (sem `Payment`):

```bash
# Localmente:
npx prisma migrate dev --name add_payment

# Em produção (Render):
# o buildCommand já roda `npx prisma migrate deploy` automaticamente.
# Basta fazer push e ele aplica.
```

## Dashboard com pagamentos reais

```
GET /summary/dashboard?competencia=2026-05
```

Devolve:
```json
{
  "competencia": "2026-05",
  "previsto":    19000.00,
  "pago":         4500.00,
  "amortizado":      0.00,
  "gap":         14500.00,
  "atrasados": [
    { "id": "...", "credor": "BB",
      "parcela": 1245, "ultimoPagamento": "2026-04" }
  ]
}
```

- `previsto`: soma das parcelas das dívidas com status `PAGAR`
- `pago`: payments do mês do tipo PARCELA + PARCIAL + LIQUIDACAO
- `amortizado`: payments do mês do tipo AMORTIZACAO (informativo)
- `gap`: previsto − pago (o quanto ainda falta no mês)
- `atrasados`: dívidas PAGAR sem nenhum payment no mês (nem mesmo NAO_PAGO marcado)

## Endpoints de análise mensal (novos)

### GET /payments/summary?competencia=YYYY-MM

Resumo por dívida para o mês informado.

```json
{
  "competencia": "2026-05",
  "totalPrevisto": 19000.00,
  "totalPago": 4500.00,
  "debts": [
    { "debtId":"...", "credor":"BB", "previsto":1245, "pago":1245, "situacao":"PAGO",     "payments":[...] },
    { "debtId":"...", "credor":"Itaú","previsto":890, "pago":0,    "situacao":"ATRASADO", "payments":[]    },
    { "debtId":"...", "credor":"Caixa","previsto":2300,"pago":500, "situacao":"PARCIAL",  "payments":[...] }
  ]
}
```

Situações: `PAGO` · `PARCIAL` · `ATRASADO` · `NAO_PAGO` · `PENDENTE` · `QUITADO`.

### GET /payments/overdue?months=6

Lista dívidas ativas com meses sem nenhum registro nos últimos N meses (default 6).

```json
{
  "months": ["2026-04","2026-03",...],
  "overdue": [
    { "debtId":"...", "credor":"Nubank", "parcela":680, "mesesEmAtraso":["2026-03","2026-04"] }
  ]
}
```
