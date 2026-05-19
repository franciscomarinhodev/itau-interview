#!/bin/bash
set -euo pipefail

ENDPOINT="${COGNITO_ENDPOINT:-http://cognito-local:9229}"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"

# ── Wait for cognito-local ────────────────────────────────────────────────────
echo "→ Waiting for cognito-local at $ENDPOINT..."
for i in $(seq 1 30); do
  aws cognito-idp list-user-pools \
    --max-results 1 \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" \
    --output json > /dev/null 2>&1 && break
  echo "  attempt $i/30 – retrying in 2s..."
  sleep 2
done

# ── User Pool (idempotent) ────────────────────────────────────────────────────
POOL_ID=$(aws cognito-idp list-user-pools \
  --max-results 1 \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION" \
  --query 'UserPools[0].Id' \
  --output text 2>/dev/null || echo "None")

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  echo "→ Creating User Pool..."
  POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "local-pool" \
    --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
    --auto-verified-attributes email \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" \
    --query 'UserPool.Id' \
    --output text)
  echo "  Pool created: $POOL_ID"
else
  echo "→ Pool already exists: $POOL_ID"
fi

# ── App Client — no secret (cognito-local does not require SECRET_HASH) ───────
CLIENT_ID=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id "$POOL_ID" \
  --max-results 1 \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION" \
  --query 'UserPoolClients[0].ClientId' \
  --output text 2>/dev/null || echo "None")

if [ "$CLIENT_ID" = "None" ] || [ -z "$CLIENT_ID" ]; then
  echo "→ Creating App Client..."
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-name "local-client" \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" \
    --query 'UserPoolClient.ClientId' \
    --output text)
  echo "  Client created: $CLIENT_ID"
else
  echo "→ App Client already exists: $CLIENT_ID"
fi

# ── Test user (idempotent) ────────────────────────────────────────────────────
if ! aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "test@example.com" \
  --endpoint-url "$ENDPOINT" \
  --region "$REGION" > /dev/null 2>&1; then

  echo "→ Creating test user..."
  aws cognito-idp admin-create-user \
    --user-pool-id "$POOL_ID" \
    --username "test@example.com" \
    --temporary-password "TempPass123!" \
    --message-action SUPPRESS \
    --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" > /dev/null

  # Set a permanent password — moves status from FORCE_CHANGE_PASSWORD → CONFIRMED
  aws cognito-idp admin-set-user-password \
    --user-pool-id "$POOL_ID" \
    --username "test@example.com" \
    --password "TestPass123!" \
    --permanent \
    --endpoint-url "$ENDPOINT" \
    --region "$REGION" > /dev/null

  echo "  User created: test@example.com / TestPass123!"
else
  echo "→ Test user already exists"
fi

# ── Print env vars to add to .env.local ──────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────────────────┐"
echo "│              Add to .env.local                               │"
echo "├──────────────────────────────────────────────────────────────┤"
printf "│  COGNITO_ENDPOINT=http://localhost:9229                      │\n"
printf "│  COGNITO_USER_POOL_ID=%-39s│\n" "$POOL_ID"
printf "│  COGNITO_CLIENT_ID=%-41s│\n"    "$CLIENT_ID"
printf "│  COGNITO_CLIENT_SECRET=                                      │\n"
echo "└──────────────────────────────────────────────────────────────┘"
