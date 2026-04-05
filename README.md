# Appwrite Security Analysis — IDOR / BOLA (Broken Object Level Authorization)

> **Course:** Open Source Security Analysis — Midterm Project
> **Focus Area:** Role Confusion (IDOR / BOLA)
> **Target Repository:** [appwrite/appwrite](https://github.com/appwrite/appwrite)
> **Description:** Appwrite is an open-source Backend-as-a-Service (BaaS) platform — a Firebase alternative providing authentication, databases, storage, functions, and messaging APIs.

---

## Repository Structure

```
Appwrite-Security-Analysis-IDOR-BOLA/
├── README.md                        ← Main analysis report (this file)
├── LICENSE                          ← MIT License
├── .gitignore
│
├── scripts/
│   ├── cleanup.sh                   ← Step 2: Automated Appwrite removal script
│   └── verify-cleanup.sh            ← Step 2: Post-removal verification script
│
├── poc/
│   └── idor-demo.py                 ← Step 5: IDOR/BOLA proof of concept demo
│
└── docs/
    ├── threat-model.md              ← Step 5: Full STRIDE threat model
    └── docker-security-audit.md    ← Step 4: Docker security audit checklist
```

---

## Table of Contents

1. [Step 1: Installation & install.sh Analysis (Reverse Engineering)](#step-1-installation--installsh-analysis-reverse-engineering)
2. [Step 2: Isolation & Trace-Free Cleanup (Forensics & Cleanup)](#step-2-isolation--trace-free-cleanup-forensics--cleanup)
3. [Step 3: CI/CD Pipeline Analysis (.github/workflows)](#step-3-cicd-pipeline-analysis-githubworkflows)
4. [Step 4: Docker Architecture & Container Security](#step-4-docker-architecture--container-security)
5. [Step 5: Source Code & Threat Modeling — AI-Assisted Analysis](#step-5-source-code--threat-modeling--ai-assisted-analysis)
6. [References](#references)

---

## Step 1: Installation & install.sh Analysis (Reverse Engineering)

### 1.1 Overview

Appwrite uses a **two-part installation model**:

| Component | Method | Source |
|-----------|--------|--------|
| **Appwrite CLI** | Shell script (`install.sh`) | `appwrite/sdk-for-cli` repository |
| **Appwrite Server** | Docker-based installation | `appwrite/appwrite` repository |

The CLI install script lives at: `https://github.com/appwrite/sdk-for-cli/blob/master/install.sh`

The backend server is installed via:
```bash
docker run -it --rm \
  --volume /var/run/docker.sock:/var/run/docker.sock \
  --volume "$(pwd)"/appwrite:/usr/src/code/appwrite:rw \
  --entrypoint="install" \
  appwrite/appwrite:latest
```

### 1.2 CLI install.sh — Step-by-Step Reverse Engineering

```
Step 1: Display ASCII art greeting banner
Step 2: Detect OS (Linux, macOS, Windows) and CPU architecture (x64, arm64)
Step 3: Determine if sudo is required (Linux and Apple Silicon)
Step 4: Download precompiled binary from GitHub Releases:
        → https://github.com/appwrite/sdk-for-cli/releases/download/[VERSION]/appwrite-cli-{OS}-{ARCH}
Step 5: Set executable permissions (chmod +x)
Step 6: Copy binary to /usr/local/bin/appwrite
Step 7: Remove temporary downloaded file
```

**Directories Created:**
- `/usr/local/bin/` — installation target (single binary placed here)
- System temp directory — temporary download location (cleaned up after install)

**Permissions Requested:**
- Read/write to `/usr/local/bin/` (may require `sudo` on Linux/macOS)
- Execute permission on the downloaded binary (`chmod +x`)

### 1.3 Security Assessment of the Install Script

#### Hash Verification: NOT IMPLEMENTED

The script does **not** perform any cryptographic verification of downloaded binaries:

- No SHA256/SHA512 checksum validation
- No GPG signature verification
- No comparison against published checksums
- Only check: HTTP "Not Found" response detection

This means the script follows a **"curl | bash" trust model** — it relies entirely on HTTPS transport security and trust in GitHub's CDN. If GitHub's release assets were compromised (supply chain attack), the script would install a malicious binary without detection.

**Comparison with security best practices:**

| Practice | Appwrite CLI | Best Practice |
|----------|-------------|---------------|
| HTTPS download | Yes | Yes |
| Hash verification | No | SHA256 checksum file |
| Signature verification | No | GPG/Sigstore signing |
| Pinned version | Hardcoded version | Configurable with default |
| Rollback capability | No | Previous version retention |

### 1.4 Docker-Based Server Installation — What Happens Under the Hood

When you run the Docker install command, the entrypoint `install` triggers the following:

1. **Interactive configuration wizard** — prompts for HTTP port, hostname, SMTP settings, etc.
2. **Generates `docker-compose.yml`** — creates a Compose file with 40+ services configured based on user input
3. **Generates `.env` file** — stores environment variables including encryption keys, database credentials, and API configuration
4. **Pulls Docker images** — downloads all required container images from Docker Hub
5. **Creates Docker networks** — three isolated networks: `appwrite`, `gateway`, `runtimes`
6. **Creates persistent volumes** — for databases, uploads, cache, certificates, and functions
7. **Starts all services** — launches the full Appwrite stack via Docker Compose

**Directories created on host:**
```
./appwrite/
├── docker-compose.yml
├── .env
└── (volumes managed by Docker)
```

**Docker volumes created:**
```
appwrite-mariadb, appwrite-redis, appwrite-cache, appwrite-uploads,
appwrite-imports, appwrite-certificates, appwrite-functions, appwrite-sites,
appwrite-builds, appwrite-config
```

---

## Step 2: Isolation & Trace-Free Cleanup (Forensics & Cleanup)

> **Recommendation:** Always perform installation and testing in a virtual machine (VM) for safe analysis.

> **Automation:** The cleanup procedure below is fully automated in [`scripts/cleanup.sh`](scripts/cleanup.sh). Run `scripts/verify-cleanup.sh` afterwards to confirm zero residual traces with a pass/fail report.

### 2.1 Complete Removal Procedure

#### Phase 1: Stop All Running Services

```bash
# Navigate to the Appwrite installation directory
cd /path/to/appwrite

# Stop and remove all containers
docker compose down

# Verify no Appwrite containers are running
docker ps -a | grep appwrite
```

#### Phase 2: Remove Docker Resources

```bash
# Remove all Appwrite Docker volumes (persistent data)
docker volume rm appwrite-mariadb appwrite-redis appwrite-cache \
  appwrite-uploads appwrite-imports appwrite-certificates \
  appwrite-functions appwrite-sites appwrite-builds appwrite-config

# Remove Docker networks
docker network rm appwrite gateway runtimes

# Remove Docker images
docker images | grep appwrite | awk '{print $3}' | xargs docker rmi -f
docker images | grep openruntimes | awk '{print $3}' | xargs docker rmi -f
docker images | grep traefik | awk '{print $3}' | xargs docker rmi -f

# Remove any dangling images and build cache
docker system prune -a --volumes
```

#### Phase 3: Remove CLI Binary

```bash
# Remove Appwrite CLI
sudo rm -f /usr/local/bin/appwrite

# Remove CLI configuration
rm -rf ~/.appwrite/
```

#### Phase 4: Remove Installation Files

```bash
# Remove Appwrite directory (docker-compose.yml, .env, etc.)
rm -rf /path/to/appwrite/
```

#### Phase 5: Check for Residual Traces

```bash
# Check for lingering Docker resources
docker ps -a | grep -i appwrite
docker images | grep -i appwrite
docker volume ls | grep -i appwrite
docker network ls | grep -i appwrite

# Check for background processes
ps aux | grep -i appwrite
ps aux | grep -i swoole

# Check for listening ports (Appwrite defaults)
ss -tlnp | grep -E ':(80|443|8080|9501|9505)\b'
# or on macOS:
lsof -i -P | grep -E ':(80|443|8080|9501|9505)\b'

# Check for cron jobs
crontab -l | grep -i appwrite

# Check for systemd services
systemctl list-units | grep -i appwrite

# Check for log files
find /var/log -name "*appwrite*" 2>/dev/null
find /tmp -name "*appwrite*" 2>/dev/null

# Check Docker log directory
ls -la /var/lib/docker/containers/ | head

# Check for DNS resolver changes (CoreDNS container)
cat /etc/resolv.conf
```

### 2.2 Verification Checklist

| Check | Command | Expected Result |
|-------|---------|-----------------|
| No running containers | `docker ps -a \| grep appwrite` | Empty output |
| No Docker images | `docker images \| grep appwrite` | Empty output |
| No Docker volumes | `docker volume ls \| grep appwrite` | Empty output |
| No Docker networks | `docker network ls \| grep appwrite` | Empty output |
| No CLI binary | `which appwrite` | "not found" |
| No listening ports | `ss -tlnp \| grep :9501` | Empty output |
| No background processes | `ps aux \| grep appwrite` | Only grep itself |
| No config files | `ls ~/.appwrite/` | "No such file or directory" |
| No cron entries | `crontab -l \| grep appwrite` | Empty output |
| No systemd services | `systemctl list-units \| grep appwrite` | Empty output |

### 2.3 Why VM Isolation Matters

Running the analysis in a VM provides:

- **Snapshot capability** — take a snapshot before installation, revert after analysis
- **Network isolation** — prevent unintended external connections during testing
- **Complete cleanup guarantee** — destroying the VM ensures zero residual traces
- **Safe exploitation testing** — test IDOR/BOLA attacks without risking production data
- **Reproducibility** — recreate the same environment from snapshot for verification

---

## Step 3: CI/CD Pipeline Analysis (.github/workflows)

> **CI/CD Simulation:** The pipeline analysis below simulates what happens when a developer pushes code — from the moment the `git push` is executed to the Docker image landing in Docker Hub. Each stage is documented as it would appear in the GitHub Actions runner.

### 3.1 Workflow Inventory

The Appwrite repository contains **12+ workflow files**:

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `ci.yml` | Main CI/CD pipeline (testing, security scanning, benchmarks) | Push to main, Pull requests |
| `publish.yml` | Docker image publishing for cloud releases | Tags matching `cl-*` |
| `release.yml` | Official release publishing | New GitHub releases |
| `specs.yml` | API specification generation | Push/PR affecting API specs |
| `nightly.yml` | Daily security vulnerability scanning | Cron (daily at 00:00 UTC) |
| `codeql-analysis.yml` | CodeQL static analysis | Push/PR |
| `sdk-preview.yml` | SDK preview generation | Pull requests |
| `ai-moderator.yml` | AI-powered content moderation | Issues/PR comments |
| `auto-label-issue.yml` | Automatic issue labeling | New issues |
| `cleanup-cache.yml` | PR cache cleanup | PR close events |
| `stale.yml` | Stale issue management | Scheduled |
| `issue-triage.lock.yml` | Complex issue triage automation | Issues |

### 3.2 Deep Dive: ci.yml (Main Pipeline)

The `ci.yml` workflow (23,462 bytes) is the most complex and critical. Here is its execution flow:

```
┌─────────────────────────────────────────────────────────────┐
│                     CI/CD PIPELINE FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. SECURITY & QUALITY PHASE                                │
│     ├── OSV Dependency Scanning (Google)                    │
│     ├── Trivy Vulnerability Scan (CRITICAL/HIGH)            │
│     ├── CodeQL Static Analysis → SARIF Upload               │
│     ├── Composer Validation & Audit                         │
│     ├── PHP Linting (Syntax Check)                          │
│     └── PHPStan v2 Static Analysis (with baseline cache)    │
│                                                              │
│  2. BUILD PHASE                                             │
│     ├── Docker Image Build (development target)             │
│     └── Layer Caching for downstream jobs                   │
│                                                              │
│  3. TESTING PHASE (Parallel)                                │
│     ├── Unit Tests (tests/unit/)                            │
│     ├── E2E General Integration Tests                       │
│     ├── E2E Service Tests (18+ services, matrix):           │
│     │   ├── Account, Avatars, Functions, Databases          │
│     │   ├── Storage, Webhooks, Teams, Messaging, Mail       │
│     │   ├── DB Matrix: MariaDB, MongoDB, PostgreSQL         │
│     │   └── Mode Matrix: dedicated, shared_v1, shared_v2   │
│     ├── E2E Abuse Detection Tests                           │
│     └── E2E Screenshot Tests (Visual Regression)            │
│                                                              │
│  4. PERFORMANCE PHASE                                       │
│     ├── Benchmark (Oha load testing tool)                   │
│     ├── RPS, P99 Latency Measurement                        │
│     └── PR vs. Stable Version Comparison                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Testing Framework:** PHPUnit + Codeception
**Test Execution:** `docker exec appwrite test /usr/src/code/tests/e2e/Services/{ServiceName}`
**Retry Policy:** Max 2 attempts, 60-second wait between retries
**Failure Handling:** Docker logs and service outputs collected as artifacts

### 3.3 What Is a Webhook and How Does Appwrite Use It?

A **webhook** is an HTTP callback — when a specific event occurs, the system sends an HTTP POST request to a pre-configured URL, delivering event data in real-time.

**In the general CI/CD context:**
- GitHub sends webhooks to CI/CD runners when code is pushed or PRs are opened
- The CI/CD system (GitHub Actions) receives the event and triggers the corresponding workflow
- Results can be reported back via status checks and commit statuses

**In Appwrite specifically:**

Appwrite fires webhooks for resource lifecycle events:

| Event Category | Example Events |
|---------------|----------------|
| **Database** | Document create, update, delete; collection operations |
| **Authentication** | User registration, login, logout, password change |
| **Storage** | File upload, update, deletion; bucket operations |
| **Functions** | Function execution start, completion, failure |
| **Teams** | Membership changes, team creation/deletion |
| **Messaging** | Message sent, delivered, failed |

**Webhook Security:**
- Appwrite signs each webhook payload using HMAC-SHA1
- The signature is included in the `X-Appwrite-Webhook-Signature` header
- Recipients should verify the signature before processing the payload to ensure authenticity

**CI/CD Integration Example:**
```
Developer pushes code → GitHub webhook → GitHub Actions runs ci.yml →
Tests pass → Merge to main → publish.yml builds Docker image →
Push to Docker Hub → Deploy webhook triggers production update
```

---

## Step 4: Docker Architecture & Container Security

> **Docker Architecture Simulation:** The analysis below traces exactly what happens from `docker compose up` to a fully running Appwrite stack — which images are pulled, which networks are created, how containers communicate, and where security boundaries exist.
>
> For the full Docker security checklist and production hardening guide, see [`docs/docker-security-audit.md`](docs/docker-security-audit.md).

### 4.1 Dockerfile Analysis

Appwrite uses a **three-stage multi-stage build**:

```
┌───────────────────────────────────────────────────────┐
│ STAGE 1: composer:2.0                                  │
│ Purpose: Resolve PHP dependencies                      │
│ - Conditionally excludes dev dependencies              │
│   when TESTING=false                                   │
└────────────────────┬──────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────┐
│ STAGE 2: appwrite/base:0.10.6                          │
│ Purpose: Base configuration and file structure          │
│ - Creates storage directories (uploads, cache, etc.)   │
│ - Sets www-data ownership with 0755 permissions        │
│ - Includes 30+ executable scripts for migrations,      │
│   workers, queue management                            │
│ - Optionally includes boost libraries (DEBUG=true)     │
└────────────────────┬──────────────────────────────────┘
                     │
┌────────────────────▼──────────────────────────────────┐
│ STAGE 3: Production vs. Development                    │
│ Production removes:                                    │
│   - Spec files, xdebug, static libs (.a), __pycache__ │
│ Development adds:                                      │
│   - Docs, SSH client, GitHub CLI, XDebug               │
│ EXPOSE 80                                              │
│ CMD ["php", "app/http.php"]                            │
└───────────────────────────────────────────────────────┘
```

**Base Image (`appwrite/base`) includes:**
- PHP extensions: swoole, redis, imagick, yaml, mongodb, pdo_mysql, pdo_pgsql, intl, scrypt, maxminddb, sockets
- System packages: PostgreSQL dev tools, ImageMagick, certbot, docker-cli, git
- Multi-stage compiled extensions (debug symbols stripped)

### 4.2 Docker Compose Architecture (40+ Services)

```
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK: gateway                              │
│  ┌──────────────┐                                               │
│  │   Traefik    │ ← Port 80, 443 (public-facing)               │
│  │  (v2.11)     │                                               │
│  └──────┬───────┘                                               │
├─────────┼───────────────────────────────────────────────────────┤
│         │           NETWORK: appwrite (172.16.238.0/24)         │
│  ┌──────▼───────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Appwrite    │  │ Appwrite  │  │ MariaDB  │  │   Redis   │ │
│  │  API Server  │  │ Console   │  │ (v10.11) │  │  (v7.2.4) │ │
│  │ (Port 9501)  │  │ (v7.4.11) │  │          │  │           │ │
│  └──────────────┘  └───────────┘  └──────────┘  └───────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              WORKER SERVICES (12 total)                  │    │
│  │  audits, webhooks, deletes, databases, builds,          │    │
│  │  certificates, functions, mails, messaging,             │    │
│  │  migrations, stats-resources, stats-usage               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌───────────┐  ┌──────────────┐                               │
│  │ Appwrite  │  │   CoreDNS    │                               │
│  │ Realtime  │  │ 172.16.238.100│                              │
│  │ (WS:9505) │  │              │                               │
│  └───────────┘  └──────────────┘                               │
├─────────────────────────────────────────────────────────────────┤
│                    NETWORK: runtimes                             │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  OpenRuntimes    │  │  OpenRuntimes    │                    │
│  │  Executor        │  │  Proxy           │                    │
│  └──────────────────┘  └──────────────────┘                    │
├─────────────────────────────────────────────────────────────────┤
│              DEV-ONLY SERVICES (not for production)             │
│  MailDev(9503) Adminer(9506) RedisInsight(8081)                │
│  RequestCatcher(9504,9507) GraphQL Explorer(9509)              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Container Security Analysis

#### Network Isolation

Three isolated Docker networks provide defense-in-depth:

| Network | Subnet | Purpose |
|---------|--------|---------|
| `gateway` | default | External routing through Traefik reverse proxy |
| `appwrite` | 172.16.238.0/24 | Internal application communication with CoreDNS |
| `runtimes` | separate | Isolated function and site execution environment |

This prevents direct access between application tiers and function runtimes.

#### Docker Socket Exposure — Critical Risk

```yaml
# From docker-compose.yml - Executor service
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

The executor service mounts the host's Docker daemon socket. This allows Appwrite to spawn function runtime containers but introduces a **privilege escalation risk**: a compromised executor could gain full control of the host Docker daemon.

#### Security Strengths and Gaps

| Aspect | Status | Details |
|--------|--------|---------|
| Network segmentation | Implemented | Three isolated networks |
| Multi-stage builds | Implemented | Production strips debug artifacts |
| Non-root user | Implemented | `www-data` user with 0755 permissions |
| Resource limits (CPU/RAM) | **Missing** | No `cpus`/`mem_limit` in Compose |
| Docker socket exposure | **Risk** | `/var/run/docker.sock` mounted in executor |
| Secrets management | **Weak** | Plaintext env vars in docker-compose.yml |
| Rootless Docker | **Not documented** | Supported but not prominently documented |
| TLS configuration | Partial | Let's Encrypt via Traefik, but needs hardening |

### 4.4 Docker vs. Kubernetes vs. VMs

| Feature | Docker (Compose) | Kubernetes | Virtual Machine |
|---------|-------------------|------------|-----------------|
| **Isolation level** | Process-level (shared kernel) | Pod-level (shared kernel) | Full OS-level (hypervisor) |
| **Startup time** | Seconds | Seconds to minutes | Minutes |
| **Resource overhead** | Low (MB per container) | Medium (orchestration overhead) | High (GB per VM) |
| **Scaling** | Manual or Docker Swarm | Automatic (HPA) | Manual |
| **Security boundary** | Namespace + cgroup | Namespace + cgroup + RBAC | Hardware-level |
| **Appwrite compatibility** | Native (recommended) | Community solutions exist | Full support |
| **Function execution** | Docker socket (direct) | Requires OpenRuntimes adapters | Docker inside VM |
| **Best for** | Dev, small deployments | Large-scale production | Maximum isolation |

**Appwrite's recommendation:** Docker Swarm for high-availability deployments (simpler than Kubernetes, maintains Docker socket compatibility). All Appwrite containers are stateless and runner-agnostic.

---

## Step 5: Source Code & Threat Modeling — AI-Assisted Analysis

> **Professor's Note:** *"The actual goal of this assignment is to have a model with reasoning/Antigravity capability do this analysis and learn that discovery technique."*
> This section documents how an AI reasoning model was used to analyze Appwrite's source code and identify security vulnerabilities — including the exact reasoning chain it followed.

---

### 5.0 AI-Assisted Source Code Analysis — Methodology

#### What Was Asked and How the AI Reasoned

A reasoning-capable AI model was prompted to act as a security researcher and analyze the Appwrite repository from scratch. The prompt used was:

```
"You are a security researcher. Analyze the appwrite/appwrite GitHub repository.
Find the entrypoint, locate the authentication mechanism, and identify any
IDOR/BOLA vulnerabilities a hacker could exploit. Explain your reasoning step by step."
```

#### Step-by-Step Reasoning Chain the AI Followed

**Stage 1 — Find the Entrypoint**
```
Reasoning: "When analyzing an unknown PHP application, the entry point is
typically defined in the web server config or a main HTTP handler.
I should look for: index.php, http.php, server.php, or Dockerfile CMD."

Finding: Dockerfile contains → CMD ["php", "app/http.php"]
         Therefore: app/http.php is the HTTP entry point.
```

**Stage 2 — Trace the Initialization**
```
Reasoning: "http.php likely includes an init file. Let me follow the require/include chain."

Finding: app/http.php → requires app/init.php
         app/init.php → registers routes, loads components, configures DB
         Routes → app/controllers/api/*.php
```

**Stage 3 — Locate Authentication**
```
Reasoning: "Authentication is usually in an 'account' or 'auth' controller.
I also need to check for middleware or a shared Auth class."

Finding: app/controllers/api/account.php → handles login, sessions, OAuth
         src/Appwrite/Auth/Auth.php → static auth helper methods
         Three mechanisms: Sessions (cookies), API Keys (header), JWT (token)
```

**Stage 4 — Identify IDOR Attack Surface**
```
Reasoning: "Now I know the auth mechanisms. As a hacker, I ask:
'Are there API endpoints that take a user-controlled ID as a parameter
without verifying that the authenticated user owns that resource?'

I should look for patterns like:
  GET /v1/{resource}/{id}   ← ID is user-controlled
  POST /v1/{resource}       ← data fields may contain spoofable IDs

I'll check: databases.php, storage.php, teams.php, users.php"

Finding: All four controllers follow the pattern {resource}/{id}
         Authorization is based on collection/bucket-level permissions
         → If permissions are misconfigured, IDOR is trivially exploitable
```

**Stage 5 — Find the Missing Server-Side Validation**
```
Reasoning: "For document creation, the client sends a 'data' object.
Does Appwrite validate that fields inside 'data' match the authenticated user?
Let me check the document creation handler."

Finding: No server-side validation of user-controlled fields in document data.
         A client can set data.userId = "any_other_user_id"
         Appwrite stores it without checking.
         → This is the userId spoofing vulnerability (GitHub Issue #10491)
```

**Stage 6 — Identify What Data an Attacker Can Steal**
```
Reasoning: "Given these vulnerabilities, what sensitive data is reachable?
  1. All documents in misconfigured collections → business data, PII
  2. Private files in buckets with weak permissions → uploads, configs
  3. User metadata via /v1/users (Server API) → emails, phone numbers
  4. Team membership info → organizational structure
  5. API keys in leaked environment → full project access"
```

#### Key Insight: Why AI Reasoning Works Better Than Manual Review

Traditional code review would require manually reading thousands of lines of PHP. The AI reasoning model:

1. **Follows logical call chains** automatically (http.php → init.php → controller)
2. **Applies known vulnerability patterns** (OWASP Top 10) to each endpoint
3. **Asks "what if" questions** at each authorization checkpoint
4. **Cross-references multiple files** simultaneously to find missing validations
5. **Maps data flow** from input to storage to identify injection/spoofing points

This is the core technique: instruct the AI to think like an attacker, give it a high-level description of the codebase structure, and let it reason about where authorization checks are absent or incomplete.

---

### 5.1 Understanding IDOR/BOLA

**IDOR (Insecure Direct Object Reference)** and **BOLA (Broken Object Level Authorization)** refer to the same class of vulnerability — ranked **#1 in the OWASP API Security Top 10 (2023)**.

The attack pattern is simple: a user changes an ID parameter in an API request to access resources belonging to another user.

```
Normal request:   GET /api/users/5/invoices    → Returns MY invoices
Attack:           GET /api/users/2/invoices    → Returns CEO's invoices
```

The API checks "does this session exist?" (authentication) but fails to check "does this user have permission to access user 2's data?" (authorization).

### 5.2 Application Entrypoint

```
Entrypoint: app/http.php
    └── Loads: app/init.php
        ├── Configures Swoole HTTP server
        ├── Loads database filters and formats
        ├── Registers components and locales
        └── Initializes resource handlers
            └── Routes to: app/controllers/api/
                ├── account.php    (Authentication)
                ├── databases.php  (Documents/Collections)
                ├── storage.php    (Files/Buckets)
                ├── teams.php      (Team Management)
                ├── users.php      (User Management - Server API)
                └── functions.php  (Serverless Functions)
```

### 5.3 Authentication Mechanisms

Appwrite supports three authentication methods:

| Method | How It Works | Permission Model | Use Case |
|--------|-------------|------------------|----------|
| **Sessions** | HTTP cookies after login | User-level permissions enforced | Web/mobile client apps |
| **API Keys** | `X-Appwrite-Key` header | **Bypasses all user permissions** | Server-to-server |
| **JWT** | Stateless token (15 min TTL) | User-level permissions enforced | Server acting on behalf of user |

**Password Hashing:** Argon2 with salting and configurable work factors.

**Critical Architecture Decision:** API keys operate in "admin mode" — they bypass all user-level permission checks and rely solely on scope restrictions. This means a leaked API key with broad scopes grants unrestricted access to all project resources.

### 5.4 Authorization Model — The IDOR Defense Layer

Appwrite uses a **dual authorization model**:

```
                    ┌─────────────────────┐
                    │   Incoming Request   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Authentication     │
                    │ (Who are you?)       │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │                              │
    ┌───────────▼──────────┐    ┌──────────────▼───────────┐
    │ Client SDK / JWT     │    │ Server SDK + API Key     │
    │                      │    │                          │
    │ Permission-based:    │    │ Scope-based:             │
    │ Check user's perms   │    │ Check API key scopes     │
    │ on specific resource │    │ IGNORES user permissions │
    └───────────┬──────────┘    └──────────────┬───────────┘
                │                              │
                └──────────────┬───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Return Resource     │
                    │  or 401/403 Error    │
                    └─────────────────────┘
```

**Permission Granularity:**

| Level | Description | Example |
|-------|-------------|---------|
| Collection-level | All documents in a collection share same permissions | "All team members can read" |
| Document-level | Individual document has its own permissions | "Only creator can edit" |
| Bucket-level | All files in a bucket share same permissions | "Public read access" |
| File-level | Individual file has its own permissions | "Only uploader can delete" |

**Default Behavior:** Secure by default — no access unless explicitly granted. When using Client SDK, the creator automatically receives read, update, and delete permissions.

### 5.5 IDOR/BOLA Vulnerability Analysis

#### Vulnerability 1: Document Access via ID Manipulation (CRITICAL)

**Endpoint:** `GET /v1/databases/{databaseId}/collections/{collectionId}/documents/{documentId}`

**Attack Scenario:**
```
1. User A creates a document → gets documentId: "doc_abc123"
2. User B discovers or guesses documentId: "doc_abc123"
3. User B sends: GET /v1/databases/db1/collections/col1/documents/doc_abc123
4. If permissions are misconfigured → User B reads User A's data
```

**Appwrite's Defense:** Permission check on each document access. However, if collection-level permissions are set to `any` or `users`, ALL authenticated users can access ALL documents in that collection — a common misconfiguration.

**Risk Level:** CRITICAL — depends entirely on developer's permission configuration.

#### Vulnerability 2: Client-Side userId Spoofing (CRITICAL)

**Endpoint:** `POST /v1/databases/{databaseId}/collections/{collectionId}/documents`

**Attack Scenario:**
```
1. User A creates a document with their userId in a field
2. Attacker intercepts and changes the userId field to another user's ID
3. Document is created under the victim's name
4. If WRITE permissions are linked to userId → attacker gains edit access
```

**Root Cause:** Appwrite does not validate that the `userId` field in document data matches the authenticated user. The client can forge this field.

**Documented in:** GitHub Issue #10491 — "Provide server-side field validation"

**Risk Level:** CRITICAL — no server-side validation of user-controlled identity fields.

#### Vulnerability 3: Unrestricted User Creation (CRITICAL)

**Endpoint:** `POST /v1/users` and `POST /v1/account`

**Attack Scenario:**
```
1. Attacker discovers a project's projectId (often visible in client code)
2. Attacker creates new users in the project via the API
3. These users can then access resources with "users" permission level
```

**Documented in:** GitHub Discussion #6874 — "Any fake app can create new users in my project"

**Mitigation:** Disable client-side account creation and use server-side user creation with API keys. Integrate device attestation (Google Integrity API / Apple App Attest).

#### Vulnerability 4: Storage File Access (HIGH)

**Endpoint:** `GET /v1/storage/buckets/{bucketId}/files/{fileId}`

**Attack Scenario:**
```
1. File uploaded to bucket with weak permissions
2. Attacker enumerates fileIds (or finds them in page source)
3. Attacker accesses private files belonging to other users
```

**Defense:** File-level and bucket-level permission checks. Risk arises from bucket-level permission inheritance — if a bucket allows `any` read, all files are exposed.

#### Vulnerability 5: Team Information Disclosure (HIGH)

**Endpoint:** `GET /v1/teams/{teamId}` and `GET /v1/teams/{teamId}/memberships`

**Attack Scenario:**
```
1. Attacker obtains a teamId (from API responses, client code, or enumeration)
2. Attacker requests team details and membership information
3. Exposes member names, emails, roles
```

#### Vulnerability 6: API Key Scope Inconsistencies (MEDIUM)

**Documented in:** GitHub Issue #10038

**Issue:** API keys configured with "all permissions" sometimes throw authorization errors in certain configurations, while in other cases they grant broader access than intended. Inconsistent enforcement creates unpredictable security boundaries.

### 5.6 Known CVEs

| CVE | Severity | Description | Affected Versions |
|-----|----------|-------------|-------------------|
| CVE-2021-23682 | High | Prototype Pollution via improper query string sanitization | < 0.12.2 |
| CVE-2023-27159 | High | SSRF vulnerability in `/v1/avatars/favicon` endpoint | Multiple versions |

### 5.7 Attack Surface Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    APPWRITE ATTACK SURFACE                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  IDOR/BOLA VECTORS:                                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Document ID enumeration in database endpoints       │  │
│  │ 2. Client-side userId field spoofing                   │  │
│  │ 3. Unrestricted user creation via exposed projectId    │  │
│  │ 4. File ID enumeration in storage endpoints            │  │
│  │ 5. Team ID enumeration for info disclosure             │  │
│  │ 6. API key scope bypass / inconsistencies              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  SENSITIVE DATA AT RISK:                                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ • User PII (emails, phone numbers, preferences)       │  │
│  │ • Database documents (business data, user content)     │  │
│  │ • Private files (uploads, attachments, configs)        │  │
│  │ • Team metadata (members, roles, org structure)        │  │
│  │ • Session data and authentication tokens               │  │
│  │ • Project configuration and API keys                   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  DEFENSE MECHANISMS:                                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ✓ Permission-based authorization (collection/doc/file) │  │
│  │ ✓ Secure-by-default (deny all unless granted)          │  │
│  │ ✓ JWT with 15-minute expiration                        │  │
│  │ ✓ Webhook signature verification (HMAC-SHA1)           │  │
│  │ ✓ Argon2 password hashing                              │  │
│  │ ✗ No server-side userId field validation               │  │
│  │ ✗ No project-level user creation restrictions          │  │
│  │ ✗ No built-in rate limiting on enumeration             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

> **Proof of Concept:** The full IDOR/BOLA attack chain is implemented and documented in [`poc/idor-demo.py`](poc/idor-demo.py) — run it against a local Appwrite instance to see the vulnerabilities in action.
> The full STRIDE threat model is in [`docs/threat-model.md`](docs/threat-model.md).

### 5.8 Recommended Mitigations

1. **Server-side validation in Functions:** Always validate that the authenticated user matches the userId in request data. Never trust client-provided identity fields.

2. **Minimal API key scopes:** Grant only the exact scopes needed. Regularly audit and rotate API keys.

3. **Explicit document-level permissions:** Avoid relying on collection-level "any" or "users" permissions. Set permissions per-document whenever possible.

4. **Disable client-side account creation:** Use server-side user creation with proper validation and device attestation.

5. **Rate limiting:** Implement rate limiting on all endpoints to prevent ID enumeration attacks.

6. **Monitoring and alerting:** Set up audit logging for authorization failures to detect IDOR/BOLA attempts.

7. **Regular security audits:** Review permission configurations periodically. Use Appwrite's built-in audit logs.

8. **Use JWT for constrained access:** When server applications need to act on behalf of users, prefer JWT over API keys to maintain user-level permission enforcement.

---

## References

### Appwrite Documentation
- [Appwrite GitHub Repository](https://github.com/appwrite/appwrite)
- [Appwrite Authentication Docs](https://appwrite.io/docs/products/auth)
- [Appwrite Permissions](https://appwrite.io/docs/advanced/platform/permissions)
- [Appwrite API Keys](https://appwrite.io/docs/advanced/platform/api-keys)
- [Appwrite Webhooks](https://appwrite.io/docs/advanced/platform/webhooks)
- [Appwrite Events](https://appwrite.io/docs/advanced/platform/events)
- [Appwrite Security](https://appwrite.io/docs/advanced/security)
- [Appwrite Self-Hosting](https://appwrite.io/docs/advanced/self-hosting/installation)
- [Appwrite JWT Documentation](https://appwrite.io/docs/products/auth/jwt)
- [Appwrite REST API](https://appwrite.io/docs/apis/rest)

### Security Standards
- [OWASP API Security Top 10 — API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Docker Rootless Mode](https://docs.docker.com/engine/security/rootless/)

### Appwrite GitHub Issues (IDOR/BOLA Related)
- [Issue #10038 — API Key authorization inconsistencies](https://github.com/appwrite/appwrite/issues/10038)
- [Issue #10491 — Server-side field validation request](https://github.com/appwrite/appwrite/issues/10491)
- [Discussion #6874 — Unrestricted user creation](https://github.com/appwrite/appwrite/discussions/6874)

### CVE References
- [CVE-2021-23682 — Prototype Pollution](https://nvd.nist.gov/vuln/detail/CVE-2021-23682)
- [CVE-2023-27159 — SSRF Vulnerability](https://nvd.nist.gov/vuln/detail/CVE-2023-27159)

### Tools & Frameworks
- [Codeception Testing Framework](https://codeception.com/)
- [PHPUnit](https://phpunit.de/)
- [Traefik Reverse Proxy](https://traefik.io/)
- [OpenRuntimes](https://openruntimes.org/)

---

> **Disclaimer:** This analysis is conducted for educational purposes as part of a university midterm project. All vulnerability assessments are based on publicly available source code and documentation. No active exploitation was performed against any production systems.
