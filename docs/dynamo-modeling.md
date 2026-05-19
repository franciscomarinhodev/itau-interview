# Modelagem DynamoDB — Tabela de Mensagens

## Tabela Principal

| Atributo | Tipo | Exemplo |
|---|---|---|
| **PK** | String | `MSG#msg-abc123` |
| `GSI_DATE_PK` | String | `MESSAGES#2025-02-10` |
| `GSI_DATE_SK` | String | `2025-02-10T14:00:00#msg-abc123` |
| `GSI_SENDER_PK` | String | `SENDER#user-xyz` |
| `GSI_SENDER_SK` | String | `2025-02-10T14:00:00#msg-abc123` |
| `id` | String | `msg-abc123` |
| `content` | String | `"Olá!"` |
| `sender` | String | `user-xyz` |
| `sentAt` | String (ISO 8601) | `2025-02-10T14:00:00Z` |
| `status` | String (enum) | `enviado` \| `recebido` \| `lido` |

---

## GSI1 — Busca por Período

| Chave | Formato | Exemplo |
|---|---|---|
| **GSI_DATE_PK** | `MESSAGES#<YYYY-MM-DD>` | `MESSAGES#2025-02-10` |
| **GSI_DATE_SK** | `<timestamp>#<id>` | `2025-02-10T14:00:00#msg-abc123` |

---

## GSI2 — Busca por Remetente

| Chave | Formato | Exemplo |
|---|---|---|
| **GSI_SENDER_PK** | `SENDER#<sender_id>` | `SENDER#user-xyz` |
| **GSI_SENDER_SK** | `<timestamp>#<id>` | `2025-02-10T14:00:00#msg-abc123` |

---
