#!/bin/bash

# Railway Deployment Test Script
# This script tests your Railway Socket.IO server deployment

echo "🧪 Testing Railway Deployment..."
echo ""

RAILWAY_URL="https://bldsty.up.railway.app"

# Test 1: Health Check
echo "📡 Test 1: Health Check Endpoint"
echo "URL: $RAILWAY_URL/health"
HEALTH_RESPONSE=$(curl -s "$RAILWAY_URL/health")
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    exit 1
fi

echo ""

# Test 2: Root Endpoint
echo "📡 Test 2: Root Endpoint"
echo "URL: $RAILWAY_URL/"
ROOT_RESPONSE=$(curl -s "$RAILWAY_URL/")
echo "Response: $ROOT_RESPONSE"

if echo "$ROOT_RESPONSE" | grep -q "Blind Story"; then
    echo "✅ Root endpoint passed!"
else
    echo "❌ Root endpoint failed!"
fi

echo ""

# Test 3: Check CORS Headers
echo "📡 Test 3: CORS Headers"
echo "Testing from https://www.blindlol.com origin..."
CORS_RESPONSE=$(curl -s -I -H "Origin: https://www.blindlol.com" "$RAILWAY_URL/health")
echo "$CORS_RESPONSE" | grep -i "access-control"

if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin"; then
    echo "✅ CORS headers present!"
else
    echo "⚠️  CORS headers not found (may be normal for Socket.IO)"
fi

echo ""
echo "🎉 Testing complete!"
echo ""
echo "Next steps:"
echo "1. If health check passed, your Railway server is running ✅"
echo "2. Check Railway logs for any errors: railway logs"
echo "3. Test Socket.IO connection from your frontend"
echo "4. Verify environment variables in Railway dashboard"
