#!/bin/bash

# ==============================================================================
# Enhanced SPARK Proxy Test Script (.env enabled)
#
# This script sends a request to the SPARK proxy endpoint with proper timeout
# handling for LLM responses which can take several minutes.
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

# Timeout for the request (5 minutes for LLM responses)
TIMEOUT_SECONDS=${TEST_TIMEOUT:-300}

# --- Script Logic ---

if [ -z "$1" ]; then
    echo "🔴 Error: Please provide a prompt as an argument."
    echo "   Example: ./test-proxy.sh \"Tell me a fun fact about space.\""
    echo ""
    echo "   Optional: Set TEST_TIMEOUT environment variable for custom timeout (default: 300 seconds)"
    echo "   Example: TEST_TIMEOUT=600 ./test-proxy.sh \"Write a long story about space.\""
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
echo "⏱️  Timeout set to ${TIMEOUT_SECONDS} seconds (normal for LLM responses)"
echo "----------------------------------------------------------------------"

# Use curl with a longer timeout for LLM responses
# Show progress and handle timeouts gracefully
START_TIME=$(date +%s)

curl -s -X POST "${SPARK_URL}/${TARGET_PATH}" \
  -H "Content-Type: application/json" \
  -d "${REQUEST_BODY}" \
  --max-time ${TIMEOUT_SECONDS} \
  --connect-timeout 30 \
  --write-out "\n📊 HTTP Status: %{http_code}\n⏱️  Total Time: %{time_total}s\n" | jq '.' 2>/dev/null || {
    # If jq fails or response isn't JSON, show raw response
    echo "⚠️  Response was not valid JSON or jq is not installed. Raw response above."
  }

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "----------------------------------------------------------------------"
echo "✅ Request complete after ${DURATION} seconds."

if [ $DURATION -gt 60 ]; then
    echo "ℹ️  Note: Long response time is normal for LLM generation."
fi

if [ $DURATION -ge $TIMEOUT_SECONDS ]; then
    echo "⚠️  Request may have timed out. Consider increasing TEST_TIMEOUT if needed."
fi