import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // Two facilities so the cross-facility referral/lookup demo actually has something to show.
  const calinog = await prisma.facility.create({
    data: { name: 'Calinog District Hospital', type: 'hospital', address: 'Calinog, Iloilo' },
  });
  const brgyStation = await prisma.facility.create({
    data: { name: 'Poblacion Ilaya Barangay Health Station', type: 'brgy_health_station', address: 'Brgy. Poblacion Ilaya, Calinog, Iloilo' },
  });

  const passwordHash = await bcrypt.hash('demo1234', 10);

  // One user per archetype so every role's view is demoable at login.
  const drRosario = await prisma.user.create({
    data: {
      email: 'm.rosario@onehealth.demo',
      passwordHash,
      fullName: 'Dr. Maria Rosario',
      title: 'Physician - Internal Medicine',
      role: 'medical',
      archetype: 'clinical',
      facilityId: calinog.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'l.ramos@onehealth.demo',
      passwordHash,
      fullName: 'Liza Ramos',
      title: 'Staff Nurse',
      role: 'medical',
      archetype: 'clinical',
      facilityId: calinog.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'g.domingo@onehealth.demo',
      passwordHash,
      fullName: 'Grace Domingo',
      title: 'Records & Intake Officer',
      role: 'medical',
      archetype: 'records_intake',
      facilityId: calinog.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'j.bautista@onehealth.demo',
      passwordHash,
      fullName: 'Jun Bautista',
      title: 'Laboratory Technician',
      role: 'medical',
      archetype: 'clinical_support',
      facilityId: calinog.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'a.reyes@onehealth.demo',
      passwordHash,
      fullName: 'Ana Reyes',
      title: 'Pharmacist',
      role: 'medical',
      archetype: 'clinical_support',
      facilityId: calinog.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'r.suarez@onehealth.demo',
      passwordHash,
      fullName: 'Dr. Ramon Suarez',
      title: 'Medical Director',
      role: 'medical',
      archetype: 'oversight',
      facilityId: calinog.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'brgy.station@onehealth.demo',
      passwordHash,
      fullName: 'Brgy Health Station Admin',
      title: 'Barangay Health Station Admin',
      role: 'governing',
      facilityId: brgyStation.id,
    },
  });

  // Rooms
  const roomLabels = [
    { label: 'Ward A - Bed 1', roomType: 'Ward' },
    { label: 'Ward A - Bed 2', roomType: 'Ward' },
    { label: 'Private Room 101', roomType: 'Private' },
    { label: 'ICU Bed 1', roomType: 'ICU' },
    { label: 'OR 1', roomType: 'OR' },
  ];
  const rooms = [];
  for (const r of roomLabels) {
    rooms.push(await prisma.room.create({ data: { ...r, facilityId: calinog.id } }));
  }

  // Patients — reuse the same names/demographics style as the frontend mockData.js
  const patientSeeds = [
    { firstName: 'Antonio', lastName: 'Lim', age: 62, sex: 'Male', philhealthNo: 'PH-0001-0062' },
    { firstName: 'Isabel', lastName: 'Navarro', age: 71, sex: 'Female', philhealthNo: 'PH-0001-0071' },
    { firstName: 'Christine Marie', lastName: 'Fernandez', age: 29, sex: 'Female', philhealthNo: 'PH-0001-0029' },
    { firstName: 'Jessica', lastName: 'Gonzales', age: 58, sex: 'Female', philhealthNo: 'PH-0001-0058' },
    { firstName: 'Rosa', lastName: 'Villaruz', age: 34, sex: 'Female', philhealthNo: 'PH-0001-0034' },
  ];

  const patients = [];
  for (const p of patientSeeds) {
    const patient = await prisma.patient.create({
      data: { ...p, homeFacilityId: calinog.id, brgy: 'Brgy. Poblacion Ilaya', municipality: 'Calinog', province: 'Iloilo' },
    });
    patients.push(patient);
  }

  const summaries = [
    { bloodType: 'B-', allergies: ['NSAIDs'], chronicConditions: ['COPD', 'Coronary artery disease'], currentMedications: ['Tiotropium inhaler', 'Aspirin 81mg OD'] },
    { bloodType: 'AB-', allergies: ['Contrast dye'], chronicConditions: ['CHF', 'CKD Stage 3'], currentMedications: ['Furosemide 40mg OD', 'Carvedilol 6.25mg BID'] },
    { bloodType: 'O-', allergies: [], chronicConditions: ['Pregnancy (3rd trimester)'], currentMedications: ['Prenatal vitamins', 'Iron supplements'] },
    { bloodType: 'O+', allergies: [], chronicConditions: ['Type 2 Diabetes', 'Hypertension'], currentMedications: ['Metformin 1000mg BID', 'Telmisartan 40mg OD'] },
    { bloodType: 'A+', allergies: [], chronicConditions: ['UTI (treated)'], currentMedications: [] },
  ];
  for (let i = 0; i < patients.length; i++) {
    const s = summaries[i];
    await prisma.emergencySummary.create({
      data: {
        patientId: patients[i].id,
        bloodType: s.bloodType,
        allergies: JSON.stringify(s.allergies),
        chronicConditions: JSON.stringify(s.chronicConditions),
        currentMedications: JSON.stringify(s.currentMedications),
      },
    });
  }

  // Today's appointments, staggered through the morning/afternoon.
  const today = new Date();
  const apptTimes = [9, 10.5, 13, 14.5];
  for (let i = 0; i < 4; i++) {
    const scheduled = new Date(today);
    scheduled.setHours(Math.floor(apptTimes[i]), (apptTimes[i] % 1) * 60, 0, 0);
    await prisma.appointment.create({
      data: {
        patientId: patients[i].id,
        facilityId: calinog.id,
        scheduledTime: scheduled,
        type: i === 2 ? 'Prenatal checkup' : i === 0 ? 'Cardiac follow-up' : 'Consultation',
        status: 'scheduled',
      },
    });
  }

  // One closed encounter earlier today so the rolling-average ETA calc has real data to chew on.
  const startedAt = new Date(today);
  startedAt.setHours(8, 0, 0, 0);
  const closedAt = new Date(today);
  closedAt.setHours(8, 22, 0, 0);
  await prisma.encounter.create({
    data: {
      patientId: patients[4].id,
      facilityId: calinog.id,
      physicianId: drRosario.id,
      status: 'closed',
      startedAt,
      closedAt,
      diagnoses: JSON.stringify(['UTI']),
      notes: 'Follow-up, resolved.',
    },
  });

  // A pending referral into Calinog from the barangay station for the demo.
  await prisma.referral.create({
    data: {
      patientId: patients[0].id,
      fromFacilityId: brgyStation.id,
      toFacilityId: calinog.id,
      reason: 'Cardiac workup',
      status: 'pending',
    },
  });

  console.log('Done. All demo accounts use password: demo1234');
  console.log('  m.rosario@onehealth.demo     - Physician (clinical)');
  console.log('  l.ramos@onehealth.demo       - Staff Nurse (clinical)');
  console.log('  g.domingo@onehealth.demo     - Records & Intake Officer (records_intake)');
  console.log('  j.bautista@onehealth.demo    - Lab Technician (clinical_support)');
  console.log('  a.reyes@onehealth.demo       - Pharmacist (clinical_support)');
  console.log('  r.suarez@onehealth.demo      - Medical Director (oversight)');
  console.log('  brgy.station@onehealth.demo  - Barangay Health Station Admin (governing)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
