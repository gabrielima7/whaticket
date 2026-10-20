import { Chat, Contact } from "libzapitu-rf";
import { isArray } from "lodash";
import Baileys from "../../models/Baileys";

interface Request {
  whatsappId: number;
  contacts?: Contact[];
  chats?: Chat[];
}

const createOrUpdateBaileysService = async ({
  whatsappId,
  contacts
}: Request): Promise<Baileys> => {
  const baileysExists = await Baileys.findOne({
    where: { whatsappId }
  });

  if (!contacts) {
    return baileysExists;
  }

  const contactMap = new Map<string, Contact>();

  if (baileysExists) {
    const baileysContacts: Contact[] = baileysExists.contacts
      ? JSON.parse(baileysExists.contacts)
      : [];

    if (isArray(baileysContacts)) {
      for (const c of baileysContacts) {
        if (c?.id) {
          contactMap.set(c.id, c);
        }
      }
    }

    if (isArray(contacts)) {
      for (const c of contacts) {
        if (c?.id) {
          const existing = contactMap.get(c.id);
          contactMap.set(c.id, { ...(existing || {}), ...c });
        }
      }
    }

    const uniqueContacts = Array.from(contactMap.values());

    const newBaileys = await baileysExists.update({
      contacts: JSON.stringify(uniqueContacts)
    });

    return newBaileys;
  }

  if (isArray(contacts)) {
    for (const c of contacts) {
      if (c?.id) {
        contactMap.set(c.id, c);
      }
    }
  }

  const baileys = await Baileys.create({
    whatsappId,
    contacts: JSON.stringify(Array.from(contactMap.values()))
  });

  return baileys;
};

export default createOrUpdateBaileysService;
