#!/bin/bash

# Deploy Supabase Edge Functions for Husqvarna API Integration
# This script deploys both Edge Functions and sets up environment variables

echo "🚀 Deploying Supabase Edge Functions for Husqvarna API Integration"
echo "================================================================="

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ No supabase/config.toml found. Make sure you're in the project root."
    exit 1
fi

echo "📦 Deploying Edge Functions..."

# Deploy OAuth exchange function
echo "  Deploying husqvarna-oauth-exchange..."
if supabase functions deploy husqvarna-oauth-exchange; then
    echo "  ✅ husqvarna-oauth-exchange deployed successfully"
else
    echo "  ❌ Failed to deploy husqvarna-oauth-exchange"
    exit 1
fi

# Deploy token refresh function
echo "  Deploying husqvarna-token-refresh..."
if supabase functions deploy husqvarna-token-refresh; then
    echo "  ✅ husqvarna-token-refresh deployed successfully"
else
    echo "  ❌ Failed to deploy husqvarna-token-refresh"
    exit 1
fi

# Deploy mower discovery function
echo "  Deploying mower-discovery..."
if supabase functions deploy mower-discovery; then
    echo "  ✅ mower-discovery deployed successfully"
else
    echo "  ❌ Failed to deploy mower-discovery"
    exit 1
fi

# Deploy auto-resume monitor function
echo "  Deploying auto-resume-monitor..."
if supabase functions deploy auto-resume-monitor; then
    echo "  ✅ auto-resume-monitor deployed successfully"
else
    echo "  ❌ Failed to deploy auto-resume-monitor"
    exit 1
fi

# Deploy scheduled collection function
echo "  Deploying scheduled-collection..."
if supabase functions deploy scheduled-collection; then
    echo "  ✅ scheduled-collection deployed successfully"
else
    echo "  ❌ Failed to deploy scheduled-collection"
    exit 1
fi

echo ""
echo "🔐 Setting up environment variables..."
echo "Note: You'll need to set these secrets in your Supabase dashboard or via CLI:"
echo ""
echo "supabase secrets set HUSQVARNA_CLIENT_ID=5b7d6709-2df3-40e1-bd9d-f4c0752e94ea"
echo "supabase secrets set HUSQVARNA_CLIENT_SECRET=5ac64870-d246-4685-820b-f34c4d8a4449"
echo "supabase secrets set HUSQVARNA_REDIRECT_URI=http://localhost:5175/auth/callback"
echo "supabase secrets set SUPABASE_SERVICE_ROLE_KEY=\$SUPABASE_SERVICE_ROLE_KEY"
echo ""

echo "✅ Edge Functions deployment completed!"
echo ""
echo "Next steps:"
echo "1. Set the environment variables shown above"
echo "2. Update your frontend .env file with Supabase URL and keys"
echo "3. Test the OAuth flow"
echo ""
echo "For troubleshooting, check the logs with:"
echo "  supabase functions logs husqvarna-oauth-exchange"
echo "  supabase functions logs husqvarna-token-refresh"
echo "  supabase functions logs mower-discovery"
echo "  supabase functions logs auto-resume-monitor"
echo "  supabase functions logs scheduled-collection"