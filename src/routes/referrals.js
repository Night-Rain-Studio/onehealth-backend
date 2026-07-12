import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { patientId, fromFacilityId, toFacilityId, reason } = req.body || {};
  if (!patientId || !fromFacilityId || !toFacilityId || !reason) {
    return res.status(400).json({ error: 'patientId, fromFacilityId, toFacilityId, reason are required' });
  }
  const referral = await prisma.referral.create({
    data: { patientId, fromFacilityId, toFacilityId, reason, status: 'pending' },
  });
  res.status(201).json(referral);
});

// Receiving facility activates it (stands in for patient consent capture in this demo).
router.post('/:id/activate', async (req, res) => {
  const referral = await prisma.referral.update({
    where: { id: req.params.id },
    data: { status: 'active', consentGrantedAt: new Date() },
  });
  res.json(referral);
});

router.get('/', async (req, res) => {
  const { facilityId } = req.query;
  const referrals = await prisma.referral.findMany({
    where: { OR: [{ fromFacilityId: facilityId }, { toFacilityId: facilityId }] },
    include: { patient: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(referrals);
});

export default router;
