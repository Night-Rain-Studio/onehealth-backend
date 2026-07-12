# OneHealth API (demo build)

Node/Express + Postgres backend replacing the Base44-hosted layer, scoped for
a stakeholder presentation rather than production use. See "Simplified for
this demo" below for what's intentionally left out.

## Quick start (local)

```bash
npm install
cp .env.example .env          # edit DATABASE_URL if not using the compose Postgres
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev                   # http://localhost:4000
```

Demo logins (from the seed script, password `demo1234` for all):

| Email | Role view |
|---|---|
| m.rosario@onehealth.demo | Physician (clinical) |
| l.ramos@onehealth.demo | Staff Nurse (clinical) |
| g.domingo@onehealth.demo | Records & Intake Officer (records_intake) |
| j.bautista@onehealth.demo | Lab Technician (clinical_support) |
| a.reyes@onehealth.demo | Pharmacist (clinical_support) |
| r.suarez@onehealth.demo | Medical Director (oversight) |
| brgy.station@onehealth.demo | Barangay Health Station Admin (governing) |

## Note on "predefined data" vs. this backend

If you're wondering why the frontend still feels static — the frontend
(`mockData.js`) was never pointed at this API. This backend already runs on
a real SQLite database; the remaining step is swapping
`frontend/src/api/base44Client.js` for a client that calls the endpoints
below, and switching each page off `mockData.js` onto `@tanstack/react-query`
calls. That's a frontend change, not a database one — this backend doesn't
need any more migration to be "real."

## Quick start (Docker Compose, e.g. on your VPS)

```bash
docker compose up -d --build
docker compose exec api npm run prisma:seed
```

API will be reachable on port 4000. Point the frontend's API base URL at
`http://<your-vps-ip>:4000` (or put Nginx + a domain + TLS in front of it —
strongly recommended before showing this over a public URL, since login
cookies are involved).

## Wiring up the frontend

Replace `src/api/base44Client.js` in the frontend repo with a client that
calls these endpoints, `credentials: 'include'` on every request so the
httpOnly auth cookie gets sent:

- `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`
- `GET /api/patients/search?q=`, `GET /api/patients/:id/emergency-summary`,
  `GET /api/patients/:id/full-chart`
- `GET /api/appointments?facilityId=`, `POST /api/appointments/:id/check-in`,
  `POST /api/appointments/:id/start-consultation`,
  `POST /api/appointments/encounters/:id/close`,
  `GET /api/appointments/eta/:facilityId`, `POST /api/appointments/delay-event`
- `GET /api/rooms?facilityId=`, `PATCH /api/rooms/:id/status`
- `POST /api/referrals`, `POST /api/referrals/:id/activate`, `GET /api/referrals?facilityId=`

## Simplified for this demo — harden before real patient data

- **Auth**: single JWT, 8h expiry, no refresh-token rotation, no revocation list.
- **No audit log yet**: the full-chart route has a `TODO` where a real
  audit-log write needs to go (who viewed what, under which referral).
- **No file storage**: nothing here handles document/PDF uploads yet
  (lab results, referral attachments) — add a self-hosted MinIO service to
  `docker-compose.yml` when that's needed.
- **No rate limiting** on `/api/auth/*`.
- **Single shared ETA average** across all physicians at a facility in the
  `/api/appointments/eta/:facilityId` endpoint — fine for a one-doctor demo,
  needs to be per-physician for a real multi-provider clinic.
- **JWT_SECRET and Postgres password in `docker-compose.yml` are placeholders.**
  Change both before deploying anywhere reachable from the internet.
