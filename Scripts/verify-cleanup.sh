#!/bin/bash
# =============================================================================
# Appwrite Cleanup Verification Script
# Step 2: Verify no traces remain on the system
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
    local LABEL="$1"
    local CMD="$2"
    local EXPECT_EMPTY="$3"

    RESULT=$(eval "$CMD" 2>/dev/null)

    if [ "$EXPECT_EMPTY" = "true" ]; then
        if [ -z "$RESULT" ]; then
            echo -e "${GREEN}[PASS]${NC} $LABEL"
            PASS=$((PASS+1))
        else
            echo -e "${RED}[FAIL]${NC} $LABEL"
            echo -e "       Found: $RESULT"
            FAIL=$((FAIL+1))
        fi
    fi
}

echo -e "${BLUE}"
echo "============================================="
echo "   Appwrite Cleanup Verification"
echo "   Step 2: Forensics Check"
echo "============================================="
echo -e "${NC}"

# Docker checks
echo -e "${YELLOW}── Docker Resources ──${NC}"
check "No Appwrite containers running"   "docker ps -a --filter name=appwrite -q"               true
check "No Appwrite Docker images"        "docker images | grep -i appwrite"                      true
check "No OpenRuntimes images"           "docker images | grep -i openruntimes"                  true
check "No Appwrite Docker volumes"       "docker volume ls | grep -i appwrite"                   true
check "No Appwrite Docker networks"      "docker network ls | grep -E 'appwrite|runtimes'"       true

# File system checks
echo -e "${YELLOW}── File System ──${NC}"
check "No CLI binary at /usr/local/bin"  "ls /usr/local/bin/appwrite 2>/dev/null"                true
check "No CLI config directory"          "ls $HOME/.appwrite 2>/dev/null"                        true
check "No ./appwrite directory"          "ls ./appwrite 2>/dev/null"                             true
check "No leftover .env file"            "find . -maxdepth 2 -name '.env' 2>/dev/null | grep -i appwrite" true

# Process checks
echo -e "${YELLOW}── Processes ──${NC}"
check "No Appwrite processes running"    "ps aux | grep -v grep | grep -i appwrite"              true
check "No Swoole processes running"      "ps aux | grep -v grep | grep -i swoole"                true

# Network checks
echo -e "${YELLOW}── Network / Ports ──${NC}"
check "Port 9501 not listening"          "ss -tlnp 2>/dev/null | grep ':9501'"                   true
check "Port 9505 not listening"          "ss -tlnp 2>/dev/null | grep ':9505'"                   true

# Cron / Services
echo -e "${YELLOW}── Cron & Services ──${NC}"
check "No Appwrite cron entries"         "crontab -l 2>/dev/null | grep -i appwrite"             true

# Log files
echo -e "${YELLOW}── Log Files ──${NC}"
check "No Appwrite log files in /var/log" "find /var/log -name '*appwrite*' 2>/dev/null"         true
check "No Appwrite files in /tmp"         "find /tmp -name '*appwrite*' 2>/dev/null"             true

# Summary
echo ""
echo "============================================="
echo -e " Results: ${GREEN}$PASS passed${NC} | ${RED}$FAIL failed${NC}"
echo "============================================="

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}✓ System is clean. No Appwrite traces found.${NC}"
else
    echo -e "${RED}✗ $FAIL trace(s) still present. Run cleanup.sh again or remove manually.${NC}"
fi