#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Publishing ${PACKAGE_NAME} to Nexus${NC}"
echo -e "${GREEN}Version: ${PACKAGE_VERSION}${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}Building library...${NC}"
pnpm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}ERROR: dist directory not found. Build failed.${NC}"; exit 1
fi

if [ -z "${NEXUS_USER:-}" ]; then
  NEXUS_USER=$(whoami)
  echo -e "${YELLOW}NEXUS_USER not set; using current user: $NEXUS_USER${NC}"
fi
if [ -z "${NEXUS_PASSWORD:-}" ]; then
  echo -e "${YELLOW}NEXUS_PASSWORD not set. Prompting...${NC}"; read -s -p "Enter Nexus password: " NEXUS_PASSWORD; echo ""; fi
if [ -z "${NEXUS_PASSWORD:-}" ]; then echo -e "${RED}ERROR: No password provided${NC}"; exit 1; fi

REGISTRY_URL=$(node -p "require('./package.json').publishConfig.registry")
SCOPE_KEY=$(echo "$REGISTRY_URL" | sed -e 's#^https\?://#//#')
AUTH_TOKEN=$(echo -n "$NEXUS_USER:$NEXUS_PASSWORD" | base64)

TEMP_NPMRC=false
if [ ! -f .npmrc ] || ! grep -q "$SCOPE_KEY" .npmrc; then
  cat >> .npmrc <<EOF
registry=$REGISTRY_URL
always-auth=true
$SCOPE_KEY:_auth="$AUTH_TOKEN"
EOF
  TEMP_NPMRC=true
fi

echo -e "${YELLOW}Publishing from repo root (publishConfig.directory=dist)...${NC}"
pnpm publish --no-git-checks --registry="$REGISTRY_URL"

if [ "$TEMP_NPMRC" = true ]; then rm -f .npmrc; fi

echo -e "\n${GREEN}✓ Published ${PACKAGE_NAME}@${PACKAGE_VERSION}${NC}"
echo -e "${GREEN}========================================${NC}"
