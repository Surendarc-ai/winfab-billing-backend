#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill values first."
  exit 1
fi

# Load KEY=VALUE pairs safely (supports quoted values with spaces)
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  key="$(echo "$key" | xargs)"
  if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  export "$key=$value"
done < .env

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"

FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@winfab.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
ADMIN_NAME="${ADMIN_NAME:-WinFab Admin}"
AWS_REGION="${AWS_REGION:-ap-south-1}"

echo "Installing production dependencies..."
rm -rf node_modules
npm ci --omit=dev

echo "Building and deploying SAM stack..."
sam build
sam deploy \
  --region "$AWS_REGION" \
  --parameter-overrides \
    MongoDbUri="$MONGODB_URI" \
    JwtSecret="$JWT_SECRET" \
    FrontendUrl="$FRONTEND_URL" \
    AdminEmail="$ADMIN_EMAIL" \
    AdminPassword="$ADMIN_PASSWORD" \
    AdminName="$ADMIN_NAME"

echo
echo "Deployment complete. Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name winfab-billing-api \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs" \
  --output table

echo
echo "Restoring local node_modules (including devDependencies)..."
npm install
