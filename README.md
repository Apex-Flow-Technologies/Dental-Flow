# Dental Flow v1 — Patient Registry (M01)

Digital replacement for Arun Care Dental Clinic's handwritten patient cards, registration and
medical-history sheets. Built to the *Dental Flow v1 SRS Baseline* (v0.1, 12 Aug 2026), which
specifies **only Module 01 — Patient Registry**, so that later modules can attach without rework.

**React 19 · TypeScript · Vite · Tailwind CSS v4 · Firebase Authentication + Cloud Firestore**

---

## What is built

| SRS ref | Requirement | Where |
|---|---|---|
| FR-M01-01 | "Old Patients" view, search by file number, name, phone, alternate phone | [PatientSearchPage.tsx](src/features/patients/PatientSearchPage.tsx) |
| FR-M01-02 | Create Patient flow with registration date and clinic file number | [PatientCreatePage.tsx](src/features/patients/PatientCreatePage.tsx) |
| FR-M01-03 | Name, age, DOB, sex, referral, guardian, address, phones, email, occupation | [PatientForm.tsx](src/features/patients/PatientForm.tsx) |
| FR-M01-04 | Four medical screening flags, each Yes/No with details when Yes | [YesNoField.tsx](src/components/ui/YesNoField.tsx) |
| FR-M01-05 | Previous dental history and clinical notes as dated, attributed entries | [ClinicalNotesTab.tsx](src/features/patients/tabs/ClinicalNotesTab.tsx) |
| FR-M01-06 | Treatment table linked to the patient (container only — see below) | [TreatmentTab.tsx](src/features/patients/tabs/TreatmentTab.tsx) |
| FR-M01-07 | Duplicate file numbers prevented; likely duplicate patients warned | [patients.ts](src/services/patients.ts) |
| FR-M01-08 | Audit trail for demographic and medical-history changes | [audit.ts](src/services/audit.ts), [AuditTab.tsx](src/features/patients/tabs/AuditTab.tsx) |

### Decisions taken on the SRS §7 open items

The specification lists five items to confirm before build. These were confirmed as:

| Item | Decision |
|---|---|
| **Roles** | One combined doctor/administrator role. Every provisioned user has full access, including user management. |
| **Sign-in** | Email + password, provisioned by an existing user. No public sign-up. |
| **File number** | Auto-suggested from a counter, freely overridable so legacy paper cards keep their original numbers. Uniqueness enforced regardless. |
| **Age** | Date of birth is authoritative and age is calculated from it. An age may be typed *only* when the DOB is unknown; it is then shown with a `~` and labelled as an estimate. |
| **Branches** | One shared clinic-wide registry. Every patient carries a Villivakkam/Mogappair branch tag, so per-branch reporting is possible without splitting a patient who visits both. |
| **Legacy records** | Entered manually — which is the reason the file number is overridable. |

### Deliberately out of scope

SRS §5 defers these to their own modules; nothing here should be read as an incomplete attempt at them:

- Detailed treatment records, diagnosis and treatment plans
- Payments, balances, estimates
- Next visits and follow-up scheduling
- Staff/doctor signatures, consent signatures, attachments, pain scale

The Treatment tab is the FR-M01-06 **container**: it holds the patient link and a minimal row so
that the relationship exists. Extend `TreatmentRecord` in [models.ts](src/types/models.ts) when the
Treatment module is specified, rather than starting a parallel structure.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Connect your Firebase project

Copy your web app config into `.env.local` in the project root (the file is gitignored):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Find them at **Firebase console → Project settings → General → Your apps → Web app → SDK setup and
configuration**. The app shows a setup screen with this checklist until the file is filled in.

> These values ship in the browser bundle and are public by design. Patient data is protected by
> Firebase Authentication and `firestore.rules`, never by keeping the config secret.

### 3. Enable Email/Password sign-in

Firebase console → **Authentication → Sign-in method → Email/Password → Enable**.

### 4. Create the Firestore database

Firebase console → **Build → Firestore Database → Create database**.

- **Location:** pick the region closest to the clinic — `asia-south1` (Mumbai) for Chennai. This is
  **permanent**; moving a database later means exporting and re-importing into a new project.
- **Mode:** choose **production mode** (deny all). The real rules are deployed in the next step.
  Test mode would leave every patient record world-readable for 30 days.

Creating the project does **not** create a database. If you skip this, sign-in succeeds but the app
reports that it cannot reach the patient database — Firestore returns `unavailable` for a project
with no database, which the SDK surfaces as "client is offline".

### 5. Deploy the security rules

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Do this **before** entering real patient data. Firestore's default rules either deny everything or
allow everything, and neither is what this app expects.

### 6. Bootstrap the first user

Every account is created by an existing user — which leaves the first one to create by hand, once:

1. **Authentication → Users → Add user.** Enter an email and password. Copy the generated **User UID**.
2. **Firestore Database → Start collection** `users`, with the **document ID set to that exact UID**:

   | Field | Type | Value |
   |---|---|---|
   | `email` | string | the same email |
   | `displayName` | string | e.g. `Dr. A. Kumar` |
   | `role` | string | `staff` |
   | `active` | boolean | `true` |
   | `createdAt` | timestamp | now |
   | `createdBy` | string | `bootstrap` |

An Auth account **without** this document cannot sign in — that check is the whole of the
"admin-provisioned" model, and it is enforced in `firestore.rules` as well as in the app. Every
account after this one is created from the in-app **Clinic users** screen.

### 7. Run

```bash
npm run dev
```

---

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

```bash
npx tsc -p tsconfig.app.json --noEmit
```

---

## Deploying

Firebase Hosting is already configured in `firebase.json`, is free on the Spark plan, and its
domain is authorised for Firebase Auth automatically:

```bash
npm run build
```

```bash
firebase deploy --only hosting
```

The `VITE_FIREBASE_*` values are read from your local `.env.local` **at build time** — Vite inlines
them into the bundle rather than reading them at run time. So build before deploying, and rebuild
after changing any of them.


---

## Data model

```
patients/{patientId}                    ← patientId is the immutable key of SRS §4.3
  fileNumber, fileNumberSeq, registrationDate, branch
  fullName, nameLower, dob, ageAtRegistration, sex
  phone, altPhone, email, occupation, referral, guardian, address
  medicalHistory { hypertensive, diabetic, otherIllness, medicineAllergy }
                   each { status: boolean, detail: string }
  createdAt, updatedAt, createdBy, updatedBy       ← the SRS §5 integration contract

  clinicalEntries/{entryId}   type, text, authorId, authorName, createdAt   (append-only)
  treatments/{treatmentId}    status, procedure, tooth, notes               (placeholder)

fileNumbers/{fileNumber}      the uniqueness constraint — see below
counters/fileNumber           { next } — drives the suggested file number
users/{uid}                   email, displayName, role, active, createdAt, createdBy
auditLog/{id}                 entity, entityId, patientId, action, changes[], actorId, at
```

### Why `fileNumbers/{fileNumber}` exists

FR-M01-07 requires duplicate file numbers to be *prevented*, not merely warned about, and Firestore
has no unique-constraint feature. Checking whether a number is free and then writing it leaves a
window where two people registering at once both pass the check.

Instead, `createPatient` runs a transaction that reads `fileNumbers/{fileNumber}`, aborts if it
already exists, and otherwise writes the reservation and the patient together. Firestore re-runs the
transaction if that document changed underneath it, so the collision cannot slip through.

Duplicate *patients* are handled the opposite way — as a warning, because families genuinely share a
phone number and names repeat. The front desk sees the matching files and decides.

### Search

Firestore supports neither OR across fields nor substring matching, so `searchPatients` issues one
query per field in parallel and merges the results:

- **file number** — exact, after normalising case and spacing
- **phone / alternate phone** — exact, after stripping `+91` / leading `0`
- **name** — prefix range on `nameLower`

Names therefore match **from the beginning**: "raj" finds "Rajesh Kumar" but not "Neeraj". Full
substring search would need an external index (Algolia, Typesense) and was not in scope.

---

## Project layout

```
src/
  lib/          firebase.ts (SDK setup, secondary-app factory), format.ts (dates, age, phones)
  types/        models.ts — the whole data model, imported by future modules
  auth/         AuthProvider, useAuth, RequireAuth
  services/     every Firestore read and write lives here; no component queries directly
  components/   ui/ primitives and layout/ app shell
  features/     auth/, patients/, admin/, setup/
```

The services layer is the seam future modules should build on: components never import
`firebase/firestore`, so a change to storage does not ripple into the UI.

---

## Notes for the next module

- **Never re-create `patientId` or `fileNumber` downstream** (SRS §5). Read them from `patients`.
- Give every new record `createdAt`, `updatedAt`, `createdBy`, `updatedBy` and the `patientId`, as
  `TreatmentRecord` does.
- Call `writeAudit` from any path that changes clinical or demographic data. The `auditLog`
  collection denies update and delete in the rules, so entries cannot be revised after the fact.
- Brand colours in [index.css](src/index.css) were sampled from clinic artwork because the live site
  could not be loaded when the SRS was written (SRS §3). **Verify them against the live site before
  UI sign-off.**
- Backup and retention policy is still undefined (SRS §6) — Firestore's scheduled backups need the
  Blaze plan.
