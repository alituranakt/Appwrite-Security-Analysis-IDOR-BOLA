# Appwrite Threat Model — IDOR / BOLA

## Overview

This document applies the **STRIDE** threat modeling methodology to the Appwrite BaaS platform, with a focus on **Broken Object Level Authorization (BOLA/IDOR)** vulnerabilities.

**System Under Analysis:** appwrite/appwrite
**Threat Modeling Method:** STRIDE
**Focus:** API Authorization Layer

---

## System Architecture (Data Flow)

```
[Client App]
     │
     │  HTTP/S  (sessions, API keys, JWTs)
     ▼
[Traefik Reverse Proxy]  ← Entry point
     │
     ▼
[Appwrite API Server]   ← PHP + Swoole
     ├── Authentication Controller  (app/controllers/api/account.php)
     ├── Database Controller        (app/controllers/api/databases.php)
     ├── Storage Controller         (app/controllers/api/storage.php)
     ├── Teams Controller           (app/controllers/api/teams.php)
     └── Users Controller           (app/controllers/api/users.php)
           │
           ▼
    [Authorization Check]
    "Does this user have permission to access this resource?"
           │
    ┌──────┴──────┐
    │             │
    YES           NO
    │             │
    ▼             ▼
[Return Data]  [401/403]
```

---

## STRIDE Analysis

| Threat | Category | Description | Risk |
|--------|----------|-------------|------|
| User A accesses User B's documents via ID change | **IDOR** | No per-document ownership check | CRITICAL |
| Client forges `userId` field in document data | **Spoofing** | No server-side user identity validation | CRITICAL |
| Attacker creates users in any project | **Elevation of Privilege** | ProjectId exposed in client code; no creation restriction | CRITICAL |
| Attacker enumerates all documents in collection | **Information Disclosure** | Collection permissions set to `any` or `users` | HIGH |
| API key with broad scopes is leaked | **Information Disclosure** | API key bypasses all user-level permissions | HIGH |
| Attacker accesses private files via fileId | **IDOR** | Bucket permission inheritance allows access | HIGH |
| Session token replay after logout | **Spoofing** | Session invalidation timing issues | MEDIUM |
| Rate limiting bypass on auth endpoints | **Denial of Service** | Enumeration attacks on user creation | MEDIUM |
| SSRF via `/v1/avatars/favicon` endpoint | **SSRF** | CVE-2023-27159, unvalidated URL fetching | HIGH |
| Prototype pollution in query string parsing | **Tampering** | CVE-2021-23682, affects versions <0.12.2 | HIGH |

---

## Attack Tree — IDOR on Document Endpoint

```
Goal: Read another user's private document
│
├─ Path 1: ID Enumeration
│   ├── Discover document ID (from API response, source code, URL)
│   ├── Change documentId in GET request
│   └── If collection permission = "users" → SUCCESS
│
├─ Path 2: userId Spoofing
│   ├── Authenticate as attacker
│   ├── Create document with victim's userId in data field
│   └── If write permission tied to userId → attacker gains access
│
├─ Path 3: API Key Theft
│   ├── Find API key in client-side code, env file, or git history
│   ├── Use key to call GET /v1/databases/{db}/collections/{col}/documents
│   └── API key bypasses all user permissions → read ALL documents
│
└─ Path 4: BOLA via Collection List
    ├── Authenticate as any valid user
    ├── Call GET /v1/databases/{db}/collections/{col}/documents
    └── If collection permission = "users" → list ALL documents
```

---

## Vulnerable Endpoints

| Endpoint | Method | Vulnerability | Severity |
|----------|--------|---------------|----------|
| `/v1/databases/{dbId}/collections/{colId}/documents/{docId}` | GET | IDOR — document access by ID | CRITICAL |
| `/v1/databases/{dbId}/collections/{colId}/documents` | GET | BOLA — list all documents | CRITICAL |
| `/v1/databases/{dbId}/collections/{colId}/documents` | POST | userId spoofing in data field | CRITICAL |
| `/v1/storage/buckets/{bucketId}/files/{fileId}` | GET | IDOR — file access by ID | HIGH |
| `/v1/storage/buckets/{bucketId}/files` | GET | BOLA — list all files in bucket | HIGH |
| `/v1/teams/{teamId}` | GET | IDOR — team metadata exposure | HIGH |
| `/v1/teams/{teamId}/memberships` | GET | Information disclosure — member list | HIGH |
| `/v1/users` | GET | User enumeration (Server API) | HIGH |
| `/v1/users` | POST | Unrestricted user creation | CRITICAL |
| `/v1/avatars/favicon` | GET | SSRF (CVE-2023-27159) | HIGH |

---

## Risk Matrix

```
         │  LOW LIKELIHOOD  │  MED LIKELIHOOD  │  HIGH LIKELIHOOD  │
─────────┼──────────────────┼──────────────────┼───────────────────┤
HIGH     │                  │  API Key Theft   │  userId Spoofing  │
IMPACT   │                  │  SSRF            │  Collection BOLA  │
─────────┼──────────────────┼──────────────────┼───────────────────┤
MED      │  Prototype Poll. │  File IDOR       │  Doc IDOR         │
IMPACT   │                  │  Team Disclosure │  User Enumeration │
─────────┼──────────────────┼──────────────────┼───────────────────┤
LOW      │  Session Replay  │                  │  Rate Limit Abuse │
IMPACT   │                  │                  │                   │
─────────┴──────────────────┴──────────────────┴───────────────────┘
```

---

## Mitigations

| Vulnerability | Mitigation | Implementation |
|--------------|-----------|----------------|
| Document IDOR | Use document-level permissions | `"permissions": ["read(\"user:$userId\")"]` |
| userId Spoofing | Server-side validation in Functions | Validate `$user.$id === request.userId` |
| Unrestricted user creation | Disable client-side account creation | Set `_APP_CONSOLE_WHITELIST_EMAILS` |
| API key exposure | Least-privilege scopes + rotation | Scope to specific resources only |
| Collection BOLA | Explicit per-document permissions | Do not rely on collection-wide `any`/`users` |
| SSRF (favicon) | Upgrade to patched version | Update Appwrite to latest release |
| Prototype pollution | Upgrade to version ≥ 0.12.2 | Update Appwrite |

---

## References

- [OWASP API Security Top 10 — API1:2023 BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [Appwrite Permissions Documentation](https://appwrite.io/docs/advanced/platform/permissions)
- [CVE-2023-27159](https://nvd.nist.gov/vuln/detail/CVE-2023-27159)
- [CVE-2021-23682](https://nvd.nist.gov/vuln/detail/CVE-2021-23682)
- [GitHub Issue #10491 — userId field validation](https://github.com/appwrite/appwrite/issues/10491)
- [STRIDE Threat Modeling — Microsoft](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)