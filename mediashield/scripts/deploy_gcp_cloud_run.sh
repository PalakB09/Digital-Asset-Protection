#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
#   PROJECT_ID   - Google Cloud project id
#   REGION       - Google Cloud region (e.g., us-central1)
# Optional env vars:
#   REPOSITORY   - Artifact Registry repo (default: mediashield)
#   BACKEND_SERVICE - Cloud Run service name (default: mediashield-backend)
#   FRONTEND_SERVICE - Cloud Run service name (default: mediashield-frontend)
#   BACKEND_ENV_VARS - Extra backend env vars, comma-separated, e.g. GEMINI_API_KEY=xxx,REDIS_URL=redis://...

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-}"
REPOSITORY="${REPOSITORY:-mediashield}"
BACKEND_SERVICE="${BACKEND_SERVICE:-mediashield-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-mediashield-frontend}"
BACKEND_ENV_VARS="${BACKEND_ENV_VARS:-}"

if [[ -z "$PROJECT_ID" || -z "$REGION" ]]; then
  echo "ERROR: PROJECT_ID and REGION are required."
  echo "Example: PROJECT_ID=my-gcp-project REGION=us-central1 ./scripts/deploy_gcp_cloud_run.sh"
  exit 1
fi

IMAGE_BASE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"
BACKEND_IMAGE="${IMAGE_BASE}/${BACKEND_SERVICE}:latest"
FRONTEND_IMAGE="${IMAGE_BASE}/${FRONTEND_SERVICE}:latest"

echo "==> Configuring gcloud project"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling required services"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com >/dev/null

echo "==> Ensuring Artifact Registry repository exists: ${REPOSITORY}"
if ! gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPOSITORY" \
    --repository-format docker \
    --location "$REGION" \
    --description "MediaShield container images"
fi

echo "==> Building backend image"
gcloud builds submit ./backend --tag "$BACKEND_IMAGE"

echo "==> Deploying backend service"
BACKEND_SET_ENV=""
if [[ -n "$BACKEND_ENV_VARS" ]]; then
  BACKEND_SET_ENV="--set-env-vars=${BACKEND_ENV_VARS}"
fi
# shellcheck disable=SC2086
gcloud run deploy "$BACKEND_SERVICE" \
  --image "$BACKEND_IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --platform managed \
  --port 8080 \
  $BACKEND_SET_ENV

BACKEND_URL="$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --format 'value(status.url)')"

if [[ -z "$BACKEND_URL" ]]; then
  echo "ERROR: Could not determine backend URL"
  exit 1
fi

echo "==> Building frontend image"
gcloud builds submit ./frontend --tag "$FRONTEND_IMAGE"

echo "==> Deploying frontend service with NEXT_PUBLIC_API_BASE=${BACKEND_URL}/api"
gcloud run deploy "$FRONTEND_SERVICE" \
  --image "$FRONTEND_IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --platform managed \
  --port 8080 \
  --set-env-vars "NEXT_PUBLIC_API_BASE=${BACKEND_URL}/api"

FRONTEND_URL="$(gcloud run services describe "$FRONTEND_SERVICE" --region "$REGION" --format 'value(status.url)')"

if [[ -z "$FRONTEND_URL" ]]; then
  echo "ERROR: Could not determine frontend URL"
  exit 1
fi

echo "==> Updating backend CORS_ORIGINS=${FRONTEND_URL}"
if [[ -n "$BACKEND_ENV_VARS" ]]; then
  gcloud run services update "$BACKEND_SERVICE" \
    --region "$REGION" \
    --update-env-vars "CORS_ORIGINS=${FRONTEND_URL},${BACKEND_ENV_VARS}"
else
  gcloud run services update "$BACKEND_SERVICE" \
    --region "$REGION" \
    --update-env-vars "CORS_ORIGINS=${FRONTEND_URL}"
fi

echo ""
echo "Deployment complete"
echo "Frontend URL: ${FRONTEND_URL}"
echo "Backend URL:  ${BACKEND_URL}"
echo ""
echo "IMPORTANT: Cloud Run local filesystem is ephemeral."
echo "For production, move media/database storage to managed services (Cloud SQL + Cloud Storage)."
