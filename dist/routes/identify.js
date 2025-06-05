"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, phoneNumber } = req.body;
    if (!email && !phoneNumber) {
        return res.status(400).json({ error: 'email or phoneNumber required' });
    }
    const matchedContacts = yield prisma.contact.findMany({
        where: {
            OR: [
                email && { email },
                phoneNumber && { phoneNumber },
            ].filter(Boolean),
        },
        orderBy: { createdAt: 'asc' }
    });
    console.log(matchedContacts, "MATCHING CONTACTS");
    //Create new primary
    if (matchedContacts.length === 0) {
        const newContact = yield prisma.contact.create({
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
    const relatedIds = new Set();
    for (const contact of matchedContacts) {
        if (contact.linkPrecedence === 'primary') {
            relatedIds.add(contact.id);
        }
        else if (contact.linkedId) {
            relatedIds.add(contact.linkedId);
        }
    }
    const allContacts = yield prisma.contact.findMany({
        where: {
            OR: [
                { id: { in: Array.from(relatedIds) } },
                { linkedId: { in: Array.from(relatedIds) } },
            ],
        },
        orderBy: { createdAt: 'asc' },
    });
    // Find primary contact
    const primary = allContacts.find((c) => c.linkPrecedence === 'primary');
    const secondaryContacts = allContacts.filter((c) => c.id !== primary.id);
    const emails = Array.from(new Set(allContacts.map((c) => c.email).filter(Boolean)));
    const phoneNumbers = Array.from(new Set(allContacts.map((c) => c.phoneNumber).filter(Boolean)));
    const secondaryContactIds = secondaryContacts.map((c) => c.id);
    // Check if this email/phone combo exists, if not, create new secondary
    const alreadyExists = allContacts.some((c) => c.email === email && c.phoneNumber === phoneNumber);
    if (!alreadyExists && (email || phoneNumber)) {
        const newSecondary = yield prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: 'secondary',
                linkedId: primary.id,
            },
        });
        secondaryContactIds.push(newSecondary.id);
        if (email && !emails.includes(email))
            emails.push(email);
        if (phoneNumber && !phoneNumbers.includes(phoneNumber))
            phoneNumbers.push(phoneNumber);
    }
    return res.json({
        contact: {
            primaryContatctId: primary.id,
            emails,
            phoneNumbers,
            secondaryContactIds,
        },
    });
}));
exports.default = router;
