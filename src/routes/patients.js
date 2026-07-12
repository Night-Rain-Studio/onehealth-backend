import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Search-first lookup — used at registration/check-in before assuming "new patient".
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  // Note: `mode: 'insensitive'` is a Postgres-only Prisma option — omitted
  // here since this runs on SQLite for local dev, where `contains` is
  // already case-insensitive for ASCII by default. Re-add it if/when this
  // moves to a Postgres datasource on the VPS.
  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { philhealthNo: { contains: q } },
      ],
    },
    include: { homeFacility: true },
    take: 10,
  });

  res.json(
    patients.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      sex: p.sex,
      homeFacility: p.homeFacility?.name || null,
    }))
  );
});

router.get('/', async (req, res) => {
  const patients = await prisma.patient.findMany({ orderBy: { lastName: 'asc' } });
  res.json(patients);
});

// Emergency Safety Summary — always visible to any authorized facility, no referral needed.
router.get('/:id/emergency-summary', async (req, res) => {
  const summary = await prisma.emergencySummary.findUnique({ where: { patientId: req.params.id } });
  if (!summary) return res.status(404).json({ error: 'No emergency summary on file' });
  res.json(summary);
});

// Full clinical chart — gated behind an active referral to the requesting facility,
// unless the requester is from the patient's home facility.
router.get('/:id/full-chart', async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const requestingFacilityId = req.user.facilityId;
  const isHomeFacility = patient.homeFacilityId && patient.homeFacilityId === requestingFacilityId;

  let referral = null;
  if (!isHomeFacility) {
    referral = await prisma.referral.findFirst({
      where: { patientId: patient.id, toFacilityId: requestingFacilityId, status: 'active' },
    });
    if (!referral) {
      return res.status(403).json({
        error: 'No active referral or home-facility access for this patient.',
      });
    }
  }

  const encounters = await prisma.encounter.findMany({
    where: { patientId: patient.id },
    orderBy: { createdAt: 'desc' },
  });

  // TODO before production: write an audit-log row here (userId, patientId,
  // referralId, timestamp) every time this branch is hit for a non-home facility.

  res.json({ patient, encounters, viaReferral: referral?.id || null });
});

router.post('/', async (req, res) => {
  const { firstName, lastName, age, sex, philhealthNo, homeFacilityId, ...rest } = req.body || {};
  if (!firstName || !lastName || age == null || !sex) {
    return res.status(400).json({ error: 'firstName, lastName, age, sex are required' });
  }
  const patient = await prisma.patient.create({
    data: { firstName, lastName, age, sex, philhealthNo, homeFacilityId, ...rest },
  });
  res.status(201).json(patient);
});

export default router;
