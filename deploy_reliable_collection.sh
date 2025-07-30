#!/bin/bash
# Deploy Reliable Automatic Collection System
# This script sets up the complete automatic collection pipeline

set -e  # Exit on error

echo "🚀 Deploying Reliable Automatic Collection System..."
echo "=================================================="

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory"
    echo "Please run this script from your project root"
    exit 1
fi

echo "✅ Environment validated"

# 1. Deploy the enhanced Edge Function
echo ""
echo "📦 Deploying enhanced scheduled-collection Edge Function..."
supabase functions deploy scheduled-collection

if [ $? -eq 0 ]; then
    echo "✅ Edge Function deployed successfully"
else
    echo "❌ Edge Function deployment failed"
    exit 1
fi

# 2. Run database migrations
echo ""
echo "🗄️  Applying database migrations..."

# Check if migration files exist
if [ -f "supabase/migrations/20250728000006_fix_collection_constraints.sql" ]; then
    echo "✅ Migration file found"
else
    echo "⚠️  Migration file not found, creating from fix script..."
    cp fix_automatic_collection.sql supabase/migrations/20250728000007_reliable_collection.sql
fi

# Apply migrations
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Database migrations applied"
else
    echo "❌ Database migration failed"
    exit 1
fi

# 3. Instructions for manual configuration
echo ""
echo "⚙️  MANUAL CONFIGURATION REQUIRED"
echo "================================="
echo ""
echo "1. Get your Service Role Key:"
echo "   - Go to Supabase Dashboard → Project Settings → API"
echo "   - Copy the 'service_role' key (not anon key)"
echo ""
echo "2. Update the configuration in your database:"
echo "   Run this SQL in your Supabase SQL Editor:"
echo ""
echo "   UPDATE edge_function_config"
echo "   SET key_value = 'YOUR_ACTUAL_SERVICE_ROLE_KEY'"
echo "   WHERE key_name = 'service_role_key';"
echo ""
echo "3. Verify the setup:"
echo "   Use the monitoring script: monitor_automatic_collection.sql"
echo ""

# 4. Test the setup (optional)
read -p "🧪 Do you want to test the collection system now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🧪 Testing automatic collection..."
    
    # Test Edge Function directly
    echo "Testing Edge Function..."
    curl -X POST \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer $(supabase status --output json | jq -r '.api.anon_key')" \
         "$(supabase status --output json | jq -r '.api.url')/functions/v1/scheduled-collection" \
         -d '{}'
    
    echo ""
    echo "📊 Check results with: SELECT * FROM check_collection_health();"
fi

echo ""
echo "🎉 DEPLOYMENT COMPLETE"
echo "====================="
echo ""
echo "Next Steps:"
echo "1. Configure your service role key (see instructions above)"
echo "2. Monitor with: monitor_automatic_collection.sql"
echo "3. Check health with: SELECT * FROM check_collection_health();"
echo ""
echo "The system will automatically collect data every 10 minutes."
echo "Manual collections via your frontend will continue to work normally."
echo ""

# Summary of what was deployed
echo "📋 DEPLOYED COMPONENTS:"
echo "- Enhanced scheduled-collection Edge Function with better error handling"
echo "- Database functions for monitoring and health checks"
echo "- Cron job configuration with proper authentication"
echo "- Monitoring and debugging tools"
echo ""
echo "Files created:"
echo "- /Users/marsan/Kod-projekt/optimow3/fix_automatic_collection.sql"
echo "- /Users/marsan/Kod-projekt/optimow3/monitor_automatic_collection.sql"
echo "- /Users/marsan/Kod-projekt/optimow3/supabase/migrations/20250728000006_fix_collection_constraints.sql"
echo "- /Users/marsan/Kod-projekt/optimow3/deploy_reliable_collection.sh"