# Messages API

RESTful messaging API built with NestJS, backed by DynamoDB (single-table design) and authenticated via AWS Cognito. Designed to run on AWS EKS/Fargate.

## Architecture

- [Diagram (draw.io)](docs/architecture.drawio) — open with [draw.io](https://app.diagrams.net/) or the VS Code extension
- [Architecture overview](docs/architecture.md)
- [DynamoDB modeling](docs/dynamo-modeling.md)

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| Yarn | ≥ 1.22 |
| Docker + Docker Compose | ≥ 24 |

## Local development setup

### 1. Install dependencies

```bash
yarn install
```

### 2. Start local infrastructure

```bash
docker compose up -d localstack cognito-local
```

This starts:
- **LocalStack** on `localhost:4566` — emulates DynamoDB and creates the `Messages` table automatically
- **cognito-local** on `localhost:9229` — emulates Cognito user pools

### 3. Provision the Cognito user pool

```bash
docker compose run --rm cognito-setup
```

The script is idempotent — safe to run multiple times. At the end it prints the values you need:

```
┌──────────────────────────────────────────────────────────────┐
│              Add to .env.local                               │
├──────────────────────────────────────────────────────────────┤
│  COGNITO_ENDPOINT=http://localhost:9229                      │
│  COGNITO_USER_POOL_ID=local_xxxxxxxx                         │
│  COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx                │
│  COGNITO_CLIENT_SECRET=                                      │
└──────────────────────────────────────────────────────────────┘
```

### 4. Configure environment variables

Copy the printed values into `.env.local`. The file already exists with all other variables pre-filled:

```dotenv
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
DYNAMODB_ENDPOINT=http://localhost:4566
DYNAMODB_TABLE=Messages
PORT=3000
CLUSTER_MODE=false

COGNITO_ENDPOINT=http://localhost:9229
COGNITO_USER_POOL_ID=<value from cognito-setup>
COGNITO_CLIENT_ID=<value from cognito-setup>
COGNITO_CLIENT_SECRET=
```

### 5. Start the application

```bash
yarn start:dev
```

The API will be available at `http://localhost:3000/api/v1`.  
Swagger UI: `http://localhost:3000/api/v1/docs`

---

## Default test user (cognito-local)

Created automatically by `cognito-setup`:

| Field | Value |
|---|---|
| Username / email | `test@example.com` |
| Password | `TestPass123!` |

Login example:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"TestPass123!"}'
```

---

## API reference

All routes are prefixed with `/api/v1`.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Authenticate and receive Cognito tokens |
| POST | `/auth/refresh` | Exchange a refresh token for new access/id tokens |

**POST /auth/login**
```json
// request
{ "username": "test@example.com", "password": "TestPass123!" }

// response 200
{
  "accessToken": "eyJ...",
  "idToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**POST /auth/refresh**
```json
// request
{ "username": "test@example.com", "refreshToken": "eyJ..." }

// response 200
{
  "accessToken": "eyJ...",
  "idToken": "eyJ...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### Messages

| Method | Path | Description |
|---|---|---|
| POST | `/messages` | Create a message |
| GET | `/messages/:id` | Get a message by ID |
| GET | `/messages?sender=<uuid>` | List messages by sender |
| GET | `/messages?startDate=<iso>&endDate=<iso>` | List messages by date range |
| PATCH | `/messages/:id/status` | Update message status |

**Status values:** `sent` · `received` · `read`

The API accepts any valid status value directly — it does not enforce a progression order. Clients are responsible for driving the transition in the intended sequence (`sent → received → read`).

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health/liveness` | Always returns `{ "status": "ok" }` — K8s liveness probe |
| GET | `/health/readiness` | Checks DynamoDB connectivity — K8s readiness probe |

**Kubernetes behaviour:**
- **Liveness** — if this fails, Kubernetes restarts the pod. It intentionally has no external dependency so a transient DynamoDB outage does not trigger unnecessary restarts.
- **Readiness** — if this fails, Kubernetes removes the pod from the service's endpoint list and stops routing traffic to it until the dependency recovers.

---

## End-to-end flow (curl)

```bash
# 1. Authenticate
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"TestPass123!"}' \
  | jq -r '.accessToken')

# 2. Create a message
MESSAGE_ID=$(curl -s -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello, world!","sender":"550e8400-e29b-41d4-a716-446655440000"}' \
  | jq -r '.id')

# 3. Fetch the message
curl -s http://localhost:3000/api/v1/messages/$MESSAGE_ID \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Advance status to received
curl -s -X PATCH http://localhost:3000/api/v1/messages/$MESSAGE_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"received"}' | jq .status

# 5. Advance status to read
curl -s -X PATCH http://localhost:3000/api/v1/messages/$MESSAGE_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"read"}' | jq .status
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AWS_REGION` | yes | — | AWS region |
| `AWS_ACCESS_KEY_ID` | yes | — | AWS credentials (`local` for local dev) |
| `AWS_SECRET_ACCESS_KEY` | yes | — | AWS credentials (`local` for local dev) |
| `DYNAMODB_TABLE` | yes | — | DynamoDB table name |
| `DYNAMODB_ENDPOINT` | no | — | Custom DynamoDB endpoint (local dev only) |
| `COGNITO_CLIENT_ID` | yes | — | Cognito app client ID |
| `COGNITO_CLIENT_SECRET` | no | `""` | Cognito app client secret (leave empty for local dev) |
| `COGNITO_ENDPOINT` | no | — | Custom Cognito endpoint (local dev only) |
| `PORT` | no | `3000` | HTTP port |
| `CLUSTER_MODE` | no | `false` | Set to `true` to fork one worker per CPU core |

---

## Running tests

```bash
# unit tests
yarn test

# unit tests with coverage
yarn test:cov

# e2e tests
yarn test:e2e
```

---

## Clustering

Set `CLUSTER_MODE=true` to enable Node.js cluster mode. The primary process forks one worker per available CPU core (`os.cpus().length`). Workers that crash are restarted automatically.

Recommended for production containers with **≥ 2 vCPU** allocated. For single-vCPU containers, prefer horizontal scaling via Kubernetes HPA instead.

```bash
CLUSTER_MODE=true yarn start:prod
```
