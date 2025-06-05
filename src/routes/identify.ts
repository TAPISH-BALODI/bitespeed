import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

router.post('/', async (req:any, res:any) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'email or phoneNumber required' });
  }
 
  const matchedContacts = await prisma.contact.findMany({
    where: {
      OR: [
        email && { email } ,
        phoneNumber && { phoneNumber } ,
      ].filter(Boolean),
    },
    orderBy: { createdAt: 'asc' }
  });
console.log(matchedContacts,"MATCHING CONTACTS");

  //Create new primary
  if (matchedContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'primary',
      },
    });
    return res.json({
      contact: {
        primaryContatctId: newContact.id,
        emails: email ? [email] : [],
        phoneNumbers: phoneNumber ? [phoneNumber] : [],
        secondaryContactIds: [],
      },
    });
  }

  // STEP 3: Gather all related contacts-by linkedId or id
  const relatedIds = new Set<number>();

  for (const contact of matchedContacts) {
    if (contact.linkPrecedence === 'primary') {
      relatedIds.add(contact.id);
    } else if (contact.linkedId) {
      relatedIds.add(contact.linkedId);
    }
  }

  const allContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { id: { in: Array.from(relatedIds) } },
        { linkedId: { in: Array.from(relatedIds) } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  // Find primary contact
  const primary = allContacts.find((c: { linkPrecedence: string; }) => c.linkPrecedence === 'primary')!;
  const secondaryContacts = allContacts.filter((c: { id: any; }) => c.id !== primary.id);

  const emails = Array.from(new Set(allContacts.map((c: { email: any; }) => c.email).filter(Boolean)));
  const phoneNumbers = Array.from(new Set(allContacts.map((c: { phoneNumber: any; }) => c.phoneNumber).filter(Boolean)));
  const secondaryContactIds = secondaryContacts.map((c: { id: any; }) => c.id);

  // Check if this email/phone combo exists, if not, create new secondary
  const alreadyExists = allContacts.some(
    (c: { email: any; phoneNumber: any; }) => c.email === email && c.phoneNumber === phoneNumber
  );

  if (!alreadyExists && (email || phoneNumber)) {
    const newSecondary = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: 'secondary',
        linkedId: primary.id,
      },
    });

    secondaryContactIds.push(newSecondary.id);
    if (email && !emails.includes(email)) emails.push(email);
    if (phoneNumber && !phoneNumbers.includes(phoneNumber)) phoneNumbers.push(phoneNumber);
  }

  return res.json({
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  });
});

export default router;
