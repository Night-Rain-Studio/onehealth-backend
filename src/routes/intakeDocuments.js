import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Records/Intake staff digitize a hardcopy. No file storage yet (see README) —
// this stores a transcribed/OCR text field. It's not part of the official
// record until reviewed.
router.post('/', async (req, res) => {
  if (req.user.archetype !== 'records_intake') {
    return res.status(403).json({ error: 'Only Records & Intake staff can log an intake document' });
  }
  const { patientId, sourceNote, ocrText } = req.body || {};
  if (!patientId) return res.status(400).json({ error: 'patientId required' });

  const doc = await prisma.intakeDocument.create({
    data: { patientId, uploadedById: req.user.sub, sourceNote, ocrText, status: 'pending' },
  });
  res.status(201).json(doc);
});

router.get('/patient/:patientId', async (req, res) => {
  const docs = await prisma.intakeDocument.findMany({
    where: { patientId: req.params.patientId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(docs);
});

// Only clinical staff (nurse/physician) can accept a pending document into
// the official record — this is the accountability checkpoint.
router.post('/:id/review', requireRole('medical'), async (req, res) => {
  if (req.user.archetype !== 'clinical') {
    return res.status(403).json({ error: 'Only clinical staff can review intake documents' });
  }
  const { decision } = req.body || {}; // "accepted" | "rejected"
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "accepted" or "rejected"' });
  }
  const doc = await prisma.intakeDocument.update({
    where: { id: req.params.id },
    data: { status: decision, reviewedById: req.user.sub, reviewedAt: new Date() },
  });
  res.json(doc);
});

export default router;
