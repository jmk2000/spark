#!/bin/bash

# ==============================================================================
# Generic Transparent Proxy Test Script (.env enabled)
#
# This script sends a request to the SPARK proxy endpoint. It will automatically
# load settings from a '.env' file in the same directory if it exists.
# ==============================================================================

# --- Configuration ---

# Load variables from .env file if it exists
if [ -f .env ]; then
  # Use a combination of grep and xargs to handle various shell environments
  export $(grep -v '^#' .env | xargs)
fi

# The base URL of your SPARK application. Uses environment variable or a default.
SPARK_URL=${SPARK_URL:-"http://localhost:3000"}

# The path on the TARGET server you want to hit. Uses environment variable or a default.
TARGET_PATH=${TEST_TARGET_PATH:-"api/generate"}

# The model name to use. Uses environment variable or a default.
MODEL_NAME=${TEST_MODEL_NAME:-"llama3"}

# --- Script Logic ---

if [ -z "$1" ]; then
    echo "🔴 Error: Please provide a prompt as an argument."
    echo "   Example: ./test-proxy.sh \"Tell me a fun fact about space.\""
    exit 1
fi

PROMPT=$1

# A sample JSON payload to send, constructed from our variables.
REQUEST_BODY=$(cat <<EOF
{
  "model": "$MODEL_NAME",
  "prompt": "$PROMPT",
  "stream": false
}
EOF
)

echo "▶️  Sending test request to transparent proxy at ${SPARK_URL}/${TARGET_PATH}"
echo "----------------------------------------------------------------------"

# Use curl to send a POST request to the SPARK proxy.
# We use jq to pretty-print the JSON response. If you don't have jq,
# you can remove the '| jq' part. (Install with: brew install jq)
curl -s -X POST "${SPARK_URL}/${TARGET_PATH}" \
-H "Content-Type: application/json" \
-d "${REQUEST_BODY}" | jq

echo -e "\n----------------------------------------------------------------------"
echo "✅ Request complete."
