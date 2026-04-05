# Appwrite Docker Security Audit

## Step 4: Container Security Analysis

This document provides a comprehensive security audit of Appwrite's Docker configuration, covering Dockerfile analysis, Compose architecture, and container hardening recommendations.

---

## Audit Checklist

### 1. Base Image Security

| Check | Status | Finding |
|-------|--------|---------|
| Official base image used | ✅ PASS | `composer:2.0` and `appwrite/base:0.10.6` |
| Base image version pinned | ✅ PASS | Specific version tags used, not `latest` |
| Known vulnerabilities in base | ⚠️ REVIEW | Check `appwrite/base:0.10.6` with Trivy |
| Minimal base image | ⚠️ PARTIAL | Custom base includes many PHP extensions |

**Run image vulnerability scan:**
```bash
# Scan Appwrite image for vulnerabilities
docker pull appwrite/appwrite:latest
trivy image --severity HIGH,CRITICAL appwrite/appwrite:latest
```

---

### 2. Dockerfile Build Process

| Check | Status | Finding |
|-------|--------|---------|
| Multi-stage build | ✅ PASS | 3-stage build: composer → base → production |
| Production strips debug artifacts | ✅ PASS | xdebug, spec files, .a libs removed in prod |
| Build secrets not leaked | ✅ PASS | Build args used for version/config only |
| COPY vs ADD | ✅ PASS | COPY used (safer than ADD) |
| No `curl \| bash` in Dockerfile | ✅ PASS | Dependencies via Composer, not shell pipes |
| Non-root user in container | ✅ PASS | Runs as `www-data` |

---

### 3. Docker Compose Configuration

| Check | Status | Finding |
|-------|--------|---------|
| Network isolation | ✅ PASS | 3 isolated networks (appwrite, gateway, runtimes) |
| Least-privilege ports | ⚠️ WARNING | Dev compose exposes debug ports 9503–9509 |
| Docker socket exposure | ❌ RISK | `/var/run/docker.sock` mounted in executor |
| Resource limits (CPU/RAM) | ❌ MISSING | No `mem_limit` or `cpus` defined |
| Secrets via environment vars | ⚠️ WARNING | Plaintext credentials in docker-compose.yml |
| Read-only filesystem | ❌ MISSING | No `read_only: true` on containers |
| No privileged mode | ✅ PASS | `privileged: true` not used |

---

### 4. Docker Socket Exposure — Detailed Analysis

The executor service mounts the host Docker socket:

```yaml
# docker-compose.yml — executor service
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

**Why this exists:** Appwrite needs to spawn runtime containers for executing user-defined Functions (Node.js, Python, PHP, etc.). It uses the Docker daemon directly for this.

**Security risk:**
```
Attacker compromises executor container
        │
        ▼
Attacker accesses /var/run/docker.sock
        │
        ▼
Attacker runs: docker run -v /:/host --rm -it alpine chroot /host
        │
        ▼
Full host filesystem access — Container escape achieved
```

**Mitigation options:**

| Option | Description | Complexity |
|--------|-------------|------------|
| OpenRuntimes adapter | Decouple function execution from Docker socket | Medium |
| Rootless Docker | Run Docker daemon as non-root user | Medium |
| Docker socket proxy | Use `docker-socket-proxy` to restrict API calls | Low |
| gVisor / Kata Containers | Stronger isolation for runtime containers | High |

**Docker socket proxy example:**
```yaml
# Restrict Docker socket access using tecnativa/docker-socket-proxy
socket-proxy:
  image: tecnativa/docker-socket-proxy
  environment:
    CONTAINERS: 1
    POST: 1
    EXEC: 1
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

---

### 5. Secrets Management

**Current state (insecure for production):**
```yaml
# docker-compose.yml — plaintext secrets
environment:
  _APP_OPENSSL_KEY_V1: your-secret-key-here
  _APP_DB_PASS: appwrite
  _APP_REDIS_PASS: ""
  _APP_SMTP_PASSWORD: ""
```

**Recommended: Docker Secrets (Swarm mode)**
```yaml
services:
  appwrite:
    secrets:
      - app_openssl_key
      - db_password
    environment:
      _APP_OPENSSL_KEY_V1_FILE: /run/secrets/app_openssl_key

secrets:
  app_openssl_key:
    external: true
  db_password:
    external: true
```

---

### 6. Network Architecture Security

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│  NETWORK: gateway                    │
│  ┌─────────┐                        │
│  │ Traefik │ ← ONLY public endpoint │
│  └────┬────┘                        │
└───────┼─────────────────────────────┘
        │ (routes to appwrite network)
        ▼
┌─────────────────────────────────────┐
│  NETWORK: appwrite (172.16.238.0/24)│
│  Internal services only             │
│  CoreDNS at 172.16.238.100          │
└─────────────────────────────────────┘
        │ (function execution isolated)
        ▼
┌─────────────────────────────────────┐
│  NETWORK: runtimes                   │
│  Function containers only           │
└─────────────────────────────────────┘
```

**Security benefit:** Even if a function container is compromised, it cannot directly reach the database or main API — it is isolated to the `runtimes` network.

---

### 7. Resource Limits (Missing — Must Add for Production)

Without resource limits, a single container can consume all host resources (DoS):

```yaml
# Add to each service in docker-compose.yml
services:
  appwrite:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  appwrite-mariadb:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

---

### 8. Docker vs. Kubernetes vs. VM Comparison

| Feature | Docker Compose | Kubernetes | Virtual Machine |
|---------|---------------|------------|-----------------|
| Kernel sharing | Shared with host | Shared with host | Dedicated kernel |
| Isolation level | Namespace + cgroup | Namespace + cgroup + RBAC | Hardware hypervisor |
| Memory overhead | ~50MB per container | ~200MB (control plane) | ~1-4GB per VM |
| Startup time | 1-5 seconds | 5-30 seconds | 30-120 seconds |
| Security boundary | Weak (kernel shared) | Medium (RBAC + NetworkPolicy) | Strong (hypervisor) |
| Appwrite support | Native, recommended | Community adapters exist | Full support |
| Best use case | Dev + small prod | Large-scale production | Max isolation |
| Docker socket issue | Present | Mitigated via CRI | No issue |
| Auto-scaling | Manual (Swarm) | Automatic (HPA) | Manual |

**Appwrite's Recommendation:** Docker Swarm for high-availability — simpler than Kubernetes while maintaining Docker socket compatibility for function execution.

---

### 9. Production Hardening Checklist

Before deploying Appwrite in production, verify the following:

```
Security Checklist:
[ ] Change all default passwords in .env
[ ] Set a strong _APP_OPENSSL_KEY_V1 (32+ random characters)
[ ] Enable HTTPS only (disable HTTP redirect)
[ ] Block all debug ports (9503-9509) at firewall level
[ ] Only expose 80/443 to public internet
[ ] Enable Appwrite's built-in abuse protection
[ ] Set up regular database backups (appwrite-mariadb volume)
[ ] Add resource limits (CPU/RAM) to all services
[ ] Implement Docker socket proxy or rootless Docker
[ ] Regularly update Appwrite images (check SECURITY.md)
[ ] Enable rate limiting at Traefik level
[ ] Configure TLS 1.2+ minimum, disable SSLv3/TLS 1.0/1.1
[ ] Set HSTS headers via Traefik middleware
[ ] Monitor with audit logs enabled
[ ] Set _APP_CONSOLE_WHITELIST_IPS for admin console access
```

---

## References

- [Appwrite Docker Hub](https://hub.docker.com/r/appwrite/appwrite)
- [Appwrite Self-Hosting Security](https://appwrite.io/docs/advanced/self-hosting/production/security)
- [Appwrite Environment Variables](https://appwrite.io/docs/environment-variables)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Docker Rootless Mode](https://docs.docker.com/engine/security/rootless/)
- [Tecnativa Docker Socket Proxy](https://github.com/Tecnativa/docker-socket-proxy)
- [NIST Container Security Guide (SP 800-190)](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-190.pdf)