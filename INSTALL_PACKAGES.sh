#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ZEPHYRA PHASE 2 — PACKAGE INSTALLATION SCRIPT
# Run this ONCE from the Zephyra-main folder:
#   cd Zephyra-main
#   bash INSTALL_PACKAGES.sh
# ─────────────────────────────────────────────────────────────────────────────

echo "Installing Phase 2 packages..."

# Core new packages
npx expo install expo-secure-store
npx expo install appwrite

# Already likely installed but confirm:
npx expo install expo-file-system
npx expo install expo-crypto
npx expo install expo-local-authentication
npx expo install expo-clipboard

echo ""
echo "✓ All packages installed!"
echo ""
echo "NEXT STEPS:"
echo "1. Fill in src/services/appwriteConfig.ts with your Appwrite IDs"
echo "2. Fill in src/services/videoCache.ts with your R2 bucket URL"
echo "3. Add QR images to assets/images/qr-groq.png and qr-nvidia.png"
echo "4. Run: npx expo start"
