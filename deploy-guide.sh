#!/bin/bash

# Bldsty Deployment Helper Script
# This script helps you deploy Bldsty to Vercel and Railway

set -e

echo "🎮 Bldsty Deployment Helper"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}This script will help you deploy Bldsty to production.${NC}"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo -e "${YELLOW}⚠️  Git repository not initialized. Initializing...${NC}"
    git init
    git add .
    git commit -m "Initial commit for Bldsty game"
    echo -e "${GREEN}✅ Git initialized${NC}"
fi

echo ""
echo -e "${BLUE}Step 1: Push to GitHub${NC}"
echo "--------------------------------------"
echo "Before deploying, you need to push your code to GitHub."
echo ""
read -p "Have you pushed your code to GitHub? (y/n): " pushed_to_github

if [ "$pushed_to_github" != "y" ]; then
    echo ""
    echo "Please push your code to GitHub first:"
    echo "  1. Create a new repository on GitHub"
    echo "  2. Run: git remote add origin <your-repo-url>"
    echo "  3. Run: git push -u origin main"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ GitHub ready${NC}"

echo ""
echo -e "${BLUE}Step 2: Deploy Socket.IO Server to Railway${NC}"
echo "--------------------------------------"
echo "1. Go to https://railway.app"
echo "2. Sign up/Login with GitHub"
echo "3. Click 'New Project'"
echo "4. Select 'Deploy from GitHub repo'"
echo "5. Choose your repository"
echo "6. Add environment variables:"
echo "   - REDIS_URL (your Redis connection string)"
echo "   - ALLOWED_ORIGINS=https://bldsty.vercel.app,http://localhost:3000"
echo "   - PORT=3001"
echo ""
read -p "Have you completed Railway deployment? (y/n): " railway_done

if [ "$railway_done" != "y" ]; then
    echo "Please complete Railway deployment first."
    exit 1
fi

echo ""
read -p "Enter your Railway app URL (e.g., https://your-app.railway.app): " railway_url

if [ -z "$railway_url" ]; then
    echo -e "${YELLOW}⚠️  Railway URL is required${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Railway URL saved: $railway_url${NC}"

echo ""
echo -e "${BLUE}Step 3: Deploy Next.js to Vercel${NC}"
echo "--------------------------------------"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
    echo -e "${GREEN}✅ Vercel CLI installed${NC}"
fi

echo ""
echo "Deploying to Vercel..."
echo ""

# Set environment variable for Vercel
export NEXT_PUBLIC_SOCKET_URL="$railway_url"

# Deploy to Vercel
vercel --prod --yes --name bldsty

echo ""
echo -e "${GREEN}✅ Deployed to Vercel!${NC}"

echo ""
echo -e "${BLUE}Step 4: Update Railway CORS${NC}"
echo "--------------------------------------"
echo "Go back to Railway dashboard and update ALLOWED_ORIGINS to include"
echo "your Vercel URL (it will be shown above in the Vercel deployment output)"
echo ""
read -p "Press Enter when you've updated Railway CORS settings..."

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Your app is now live at:"
echo "  Frontend: https://bldsty.vercel.app"
echo "  Backend:  $railway_url"
echo ""
echo "Next steps:"
echo "  1. Test your app at https://bldsty.vercel.app"
echo "  2. Share with friends!"
echo "  3. Monitor logs in Vercel and Railway dashboards"
echo ""
echo -e "${BLUE}For troubleshooting, see DEPLOYMENT.md${NC}"
echo ""
