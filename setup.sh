#!/bin/bash
# ============================================
# ChessArena - One-Click Setup Script
# ============================================
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================

echo ""
echo "♟️  ChessArena Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check prerequisites
echo "📋 Step 1/5: Checking prerequisites..."

if command -v node &> /dev/null; then
    echo "   ✅ Node.js $(node -v)"
else
    echo "   ❌ Node.js not found! Install from https://nodejs.org"
    exit 1
fi

if command -v bun &> /dev/null; then
    echo "   ✅ Bun found"
    BUN="bun"
elif command -v npm &> /dev/null; then
    echo "   ✅ npm found (using npm instead of bun)"
    BUN="npm"
else
    echo "   ❌ No package manager found! Install Node.js first."
    exit 1
fi

echo ""

# Step 2: Install main dependencies
echo "📦 Step 2/5: Installing main dependencies..."
$BUN install
if [ $? -eq 0 ]; then
    echo "   ✅ Main dependencies installed"
else
    echo "   ❌ Failed to install main dependencies"
    exit 1
fi
echo ""

# Step 3: Install chess server dependencies
echo "📦 Step 3/5: Installing chess server dependencies..."
cd mini-services/chess-server
$BUN install
if [ $? -eq 0 ]; then
    echo "   ✅ Chess server dependencies installed"
else
    echo "   ❌ Failed to install chess server dependencies"
    exit 1
fi
cd ../..
echo ""

# Step 4: Setup environment
echo "⚙️  Step 4/5: Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "   ✅ Created .env from .env.example"
else
    echo "   ℹ️  .env already exists, skipping"
fi
echo ""

# Step 5: Setup Prisma Database
echo "🗄️  Step 5/5: Setting up Prisma database..."
if [ -n "$BUN" ] && [ "$BUN" = "bun" ]; then
    bunx prisma generate
    bunx prisma db push
else
    npx prisma generate
    npx prisma db push
fi

if [ $? -eq 0 ]; then
    echo "   ✅ Database setup complete!"
else
    echo "   ❌ Database setup failed"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo ""
echo "🚀 To start the app:"
echo ""
echo "   Terminal 1 (Chess Server):"
echo "   cd mini-services/chess-server && $BUN run dev"
echo ""
echo "   Terminal 2 (Main App):"
echo "   $BUN run dev"
echo ""
echo "   Then open: http://localhost:3000"
echo ""
echo "📊 To view database:"
echo "   bunx prisma studio"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
