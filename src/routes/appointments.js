import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Rolling average consult duration for a physician, from today's closed encounters.
// Falls back to 15 minutes if there's no data yet.
async function avgConsultMinutes(physicianId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const closed = await prisma.encounter.findMany({
    where: { physicianId, status: 'closed', startedAt: { gte: startOfDay }, closedAt: { not: null } },
  });
  if (!closed.length) return 15;

  const totalMinutes = closed.reduce((sum, e) => sum + (e.closedAt - e.startedAt) / 60000, 0);
  return totalMinutes / closed.length;
}

router.get('/', async (req, res) => {
  const { facilityId, date } = req.query;
  const day = date ? new Date(date) : new Date();
  const start = new Date(day.setHours(0, 0, 0, 0));
  const end = new Date(day.setHours(23, 59, 59, 999));

  const appointments = await prisma.appointment.findMany({
    where: { facilityId, scheduledTime: { gte: start, lte: end } },
    include: { patient: true, encounter: true },
    orderBy: { scheduledTime: 'asc' },
  });

  res.json(appointments);
});

router.post('/:id/check-in', async (req, res) => {
  const appt = await prisma.appointment.update({
    where: { id: req.params.id },
    data: { status: 'checked-in' },
  });
  res.json(appt);
});

// Start consultation — this is the single action that both opens the chart
// AND flips the room, instead of a separate manual occupancy toggle.
router.post('/:id/start-consultation', async (req, res) => {
  const { physicianId, roomId } = req.body || {};
  if (!physicianId) return res.status(400).json({ error: 'physicianId required' });

  const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  const encounter = await prisma.encounter.create({
    data: {
      patientId: appt.patientId,
      facilityId: appt.facilityId,
      physicianId,
      status: 'in-consultation',
      startedAt: new Date(),
    },
  });

  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: 'seen', encounterId: encounter.id },
  });

  if (roomId) {
    await prisma.room.update({ where: { id: roomId }, data: { status: 'occupied', currentEncounterId: encounter.id } });
  }

  res.json({ encounter });
});

// Close consultation — frees the room automatically, no manual toggle.
router.post('/encounters/:encounterId/close', async (req, res) => {
  const encounter = await prisma.encounter.update({
    where: { id: req.params.encounterId },
    data: { status: 'closed', closedAt: new Date() },
  });

  const room = await prisma.room.findUnique({ where: { currentEncounterId: encounter.id } });
  if (room) {
    await prisma.room.update({ where: { id: room.id }, data: { status: 'cleaning', currentEncounterId: null } });
  }

  res.json({ encounter });
});

// Dynamic ETA for every not-yet-seen appointment in a facility's queue today.
router.get('/eta/:facilityId', async (req, res) => {
  const facilityId = req.params.facilityId;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const queue = await prisma.appointment.findMany({
    where: { facilityId, scheduledTime: { gte: startOfDay }, status: { in: ['checked-in', 'scheduled'] } },
    orderBy: { scheduledTime: 'asc' },
  });

  // Demo-scoped: single shared average across all physicians at the facility.
  // Production version should compute per-physician queues separately.
  const physicians = await prisma.user.findMany({ where: { facilityId, role: 'medical' } });
  const avgMinutesPerPhysician = await Promise.all(physicians.map((p) => avgConsultMinutes(p.id)));
  const avgMinutes = avgMinutesPerPhysician.length
    ? avgMinutesPerPhysician.reduce((a, b) => a + b, 0) / avgMinutesPerPhysician.length
    : 15;
  const physicianCount = Math.max(physicians.length, 1);

  const closeTime = new Date();
  closeTime.setHours(17, 0, 0, 0); // demo assumption: clinic closes 5PM

  let cumulativeMinutes = 0;
  const withEta = queue.map((appt, i) => {
    cumulativeMinutes = (i / physicianCount) * avgMinutes;
    const etaTime = new Date(Date.now() + cumulativeMinutes * 60000);
    const atRisk = etaTime > closeTime;
    return { ...appt, etaMinutes: Math.round(cumulativeMinutes), atRisk };
  });

  res.json(withEta);
});

// One-tap delay event — recalculates nothing server-side beyond flagging;
// the ETA endpoint above already recomputes live on every call, so the
// practical effect of a delay event is just logging it + (TODO) notifying patients.
router.post('/delay-event', async (req, res) => {
  const { facilityId, reason } = req.body || {};
  if (!facilityId || !reason) return res.status(400).json({ error: 'facilityId and reason required' });
  // TODO: persist to a DelayEvent table + trigger notifications once a
  // notification channel (SMS/push) is wired up. For the demo, just echo it.
  res.json({ facilityId, reason, loggedAt: new Date().toISOString() });
});

export default router;
