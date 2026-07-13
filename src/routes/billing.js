import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Get all bills for a facility
router.get('/', async (req, res) => {
  const { facilityId } = req.query;
  if (!facilityId) {
    return res.status(400).json({ error: 'facilityId is required' });
  }

  const bills = await prisma.billing.findMany({
    where: { facilityId },
    include: {
      patient: true,
      encounter: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Map database response to match the frontend expectations
  res.json(bills.map(b => ({
    id: b.id,
    encounterId: b.encounterId,
    patientId: b.patientId,
    patientName: `${b.patient.firstName} ${b.patient.lastName}`,
    facilityId: b.facilityId,
    lineItems: JSON.parse(b.lineItems),
    totalAmount: b.totalAmount,
    philHealthClaim: b.philHealthClaim,
    patientPortion: b.patientPortion,
    status: b.status,
    invoiceNumber: b.invoiceNumber,
    paidAt: b.paidAt,
    notes: b.notes,
    createdAt: b.createdAt,
  })));
});

// Create new invoice
router.post('/', async (req, res) => {
  const { patientId, encounterId, facilityId, lineItems, totalAmount, philHealthClaim, patientPortion, status, invoiceNumber, notes } = req.body || {};

  if (!patientId || !facilityId || !invoiceNumber) {
    return res.status(400).json({ error: 'patientId, facilityId, and invoiceNumber are required' });
  }

  try {
    const bill = await prisma.billing.create({
      data: {
        patientId,
        encounterId,
        facilityId,
        lineItems: JSON.stringify(lineItems || []),
        totalAmount: parseFloat(totalAmount) || 0,
        philHealthClaim: parseFloat(philHealthClaim) || 0,
        patientPortion: parseFloat(patientPortion) || 0,
        status: status || 'invoiced',
        invoiceNumber,
        notes,
      },
      include: {
        patient: true,
      }
    });

    res.status(201).json({
      ...bill,
      lineItems: JSON.parse(bill.lineItems),
      patientName: `${bill.patient.firstName} ${bill.patient.lastName}`
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Invoice number already exists' });
    }
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update billing status / mark as paid
router.patch('/:id', async (req, res) => {
  const { status, paidAt, notes } = req.body || {};

  const data = {};
  if (status !== undefined) data.status = status;
  if (paidAt !== undefined) data.paidAt = paidAt ? new Date(paidAt) : null;
  if (notes !== undefined) data.notes = notes;

  try {
    const bill = await prisma.billing.update({
      where: { id: req.params.id },
      data,
      include: {
        patient: true,
      }
    });

    res.json({
      ...bill,
      lineItems: JSON.parse(bill.lineItems),
      patientName: `${bill.patient.firstName} ${bill.patient.lastName}`
    });
  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

export default router;
