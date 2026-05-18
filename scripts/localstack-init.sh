#!/bin/bash
set -e

TABLE_NAME="${DYNAMODB_TABLE:-Messages}"

echo "Creating DynamoDB table: $TABLE_NAME"

awslocal dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI_DATE_PK,AttributeType=S \
    AttributeName=GSI_DATE_SK,AttributeType=S \
    AttributeName=GSI_SENDER_PK,AttributeType=S \
    AttributeName=GSI_SENDER_SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    '[
      {
        "IndexName": "GSI_DATE",
        "KeySchema": [
          { "AttributeName": "GSI_DATE_PK",   "KeyType": "HASH"  },
          { "AttributeName": "GSI_DATE_SK",   "KeyType": "RANGE" }
        ],
        "Projection": { "ProjectionType": "ALL" }
      },
      {
        "IndexName": "GSI_SENDER",
        "KeySchema": [
          { "AttributeName": "GSI_SENDER_PK", "KeyType": "HASH"  },
          { "AttributeName": "GSI_SENDER_SK", "KeyType": "RANGE" }
        ],
        "Projection": { "ProjectionType": "ALL" }
      }
    ]' \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

echo "Table $TABLE_NAME created successfully"
