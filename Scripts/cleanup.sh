#!/bin/bash
# =============================================================================
# Appwrite Complete Removal Script
# Step 2: Isolation & Trace-Free Cleanup
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "============================================="
echo "   Appwrite Complete Removal Script"
echo "   Step 2: Forensics & Cleanup"
echo "============================================="
echo -e "${NC}"

# ─────────────────────────────────────────────
# PHASE 1: Stop all running containers
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 1] Stopping all Appwrite containers...${NC}"

if [ -f "./appwrite/docker-compose.yml" ]; then
    cd ./appwrite
    docker compose down --remove-orphans
    cd ..
    echo -e "${GREEN}✓ Containers stopped${NC}"
else
    echo -e "${YELLOW}⚠ No docker-compose.yml found, checking for running containers...${NC}"
    CONTAINERS=$(docker ps -a --filter "name=appwrite" -q)
    if [ -n "$CONTAINERS" ]; then
        docker stop $CONTAINERS
        docker rm $CONTAINERS
        echo -e "${GREEN}✓ Containers removed${NC}"
    else
        echo -e "${GREEN}✓ No Appwrite containers found${NC}"
    fi
fi

# ─────────────────────────────────────────────
# PHASE 2: Remove Docker volumes
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 2] Removing Docker volumes...${NC}"

VOLUMES=(
    "appwrite-mariadb"
    "appwrite-redis"
    "appwrite-cache"
    "appwrite-uploads"
    "appwrite-imports"
    "appwrite-certificates"
    "appwrite-functions"
    "appwrite-sites"
    "appwrite-builds"
    "appwrite-config"
)

for VOL in "${VOLUMES[@]}"; do
    if docker volume ls -q | grep -q "^${VOL}$"; then
        docker volume rm "$VOL"
        echo -e "${GREEN}✓ Volume removed: $VOL${NC}"
    else
        echo -e "${BLUE}  Skipped (not found): $VOL${NC}"
    fi
done

# ─────────────────────────────────────────────
# PHASE 3: Remove Docker networks
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 3] Removing Docker networks...${NC}"

for NET in "appwrite" "gateway" "runtimes"; do
    if docker network ls --format '{{.Name}}' | grep -q "^${NET}$"; then
        docker network rm "$NET"
        echo -e "${GREEN}✓ Network removed: $NET${NC}"
    else
        echo -e "${BLUE}  Skipped (not found): $NET${NC}"
    fi
done

# ─────────────────────────────────────────────
# PHASE 4: Remove Docker images
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 4] Removing Appwrite Docker images...${NC}"

IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^(appwrite|openruntimes)")
if [ -n "$IMAGES" ]; then
    echo "$IMAGES" | xargs docker rmi -f
    echo -e "${GREEN}✓ Images removed${NC}"
else
    echo -e "${GREEN}✓ No Appwrite images found${NC}"
fi

# ─────────────────────────────────────────────
# PHASE 5: Remove CLI binary
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 5] Removing Appwrite CLI...${NC}"

if [ -f "/usr/local/bin/appwrite" ]; then
    sudo rm -f /usr/local/bin/appwrite
    echo -e "${GREEN}✓ CLI binary removed from /usr/local/bin/appwrite${NC}"
else
    echo -e "${GREEN}✓ CLI binary not found (already removed)${NC}"
fi

if [ -d "$HOME/.appwrite" ]; then
    rm -rf "$HOME/.appwrite"
    echo -e "${GREEN}✓ CLI config directory removed: ~/.appwrite${NC}"
fi

# ─────────────────────────────────────────────
# PHASE 6: Remove installation directory
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 6] Removing Appwrite installation directory...${NC}"

if [ -d "./appwrite" ]; then
    rm -rf ./appwrite
    echo -e "${GREEN}✓ Directory removed: ./appwrite${NC}"
else
    echo -e "${BLUE}  No ./appwrite directory found${NC}"
fi

# ─────────────────────────────────────────────
# PHASE 7: Clean up dangling Docker resources
# ─────────────────────────────────────────────
echo -e "${YELLOW}[PHASE 7] Cleaning up dangling Docker resources...${NC}"
docker system prune -f
echo -e "${GREEN}✓ Docker system pruned${NC}"

echo ""
echo -e "${GREEN}============================================="
echo "   Removal complete!"
echo "   Run verify-cleanup.sh to confirm."
echo -e "=============================================${NC}"
