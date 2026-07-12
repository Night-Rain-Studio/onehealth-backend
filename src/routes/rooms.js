import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { facilityId } = req.query;
  const rooms = await prisma.room.findMany({
    where: { facilityId },
    include: { currentEncounter: { include: { patient: true, physician: true } } },
    orderBy: { label: 'asc' },
  });
  res.json(rooms);
});

// Drag-and-drop target — moves a room between Available/Reserved/Occupied/Cleaning.
const VALID_STATUSES = ['available', 'reserved', 'occupied', 'cleaning'];
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  const data = { status };
  if (status === 'available' || status === 'cleaning') data.currentEncounterId = null;

  const room = await prisma.room.update({ where: { id: req.params.id }, data });
  res.json(room);
});

export default router;
