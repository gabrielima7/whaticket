import { subHours } from "date-fns";
import { Op } from "sequelize";
import { Mutex } from "async-mutex";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import Setting from "../../models/Setting";
import Whatsapp from "../../models/Whatsapp";
import sequelize from "../../database";

const ticketMutexes = new Map<string, Mutex>();

const getTicketMutex = (key: string): Mutex => {
  let mutex = ticketMutexes.get(key);
  if (!mutex) {
    mutex = new Mutex();
    ticketMutexes.set(key, mutex);
  }
  return mutex;
};

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  companyId: number,
  groupContact?: Contact,
  openTicketSchedule?: boolean
): Promise<Ticket> => {
  const contactKey = `${companyId}:${groupContact ? groupContact.id : contact.id}`;
  const mutex = getTicketMutex(contactKey);

  const ticketId = await mutex.runExclusive(async () => {
    return await sequelize.transaction(async (transaction) => {
      let ticket = await Ticket.findOne({
        where: {
          status: {
            [Op.or]: ["open", "pending", "closed"]
          },
          contactId: groupContact ? groupContact.id : contact.id,
          companyId,
          whatsappId
        },
        order: [["id", "DESC"]],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (ticket) {
        if (openTicketSchedule) {
          await ticket.update({ status: "open", unreadMessages }, { transaction });
        }
        await ticket.update({ unreadMessages, whatsappId }, { transaction });
      }

      if (ticket?.status === "closed") {
        await ticket.update({ queueId: null, userId: null }, { transaction });
      }

      if (!ticket && groupContact) {
        ticket = await Ticket.findOne({
          where: {
            contactId: groupContact.id,
            companyId
          },
          order: [["updatedAt", "DESC"]],
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (ticket) {
          await ticket.update({
            status: "pending",
            userId: null,
            unreadMessages,
            queueId: null,
            companyId,
            whatsappId
          }, { transaction });

          await FindOrCreateATicketTrakingService({
            ticketId: ticket.id,
            companyId,
            whatsappId,
            userId: ticket.userId,
            transaction
          });
        }
      }

      if (!ticket && !groupContact) {
        ticket = await Ticket.findOne({
          where: {
            updatedAt: {
              [Op.between]: [+subHours(new Date(), 2), +new Date()]
            },
            contactId: contact.id,
            companyId
          },
          order: [["updatedAt", "DESC"]],
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (ticket) {
          await ticket.update({
            status: "pending",
            userId: null,
            unreadMessages,
            queueId: null,
            companyId,
            whatsappId
          }, { transaction });

          await FindOrCreateATicketTrakingService({
            ticketId: ticket.id,
            companyId,
            whatsappId,
            userId: ticket.userId,
            transaction
          });
        }
      }

      const whatsapp = await Whatsapp.findOne({
        where: { id: whatsappId, companyId },
        transaction
      });

      if (!ticket) {
        let queueIdToLink = null;
        if (groupContact) {
          const queueWithLinkToGroup = await Queue.findOne({
            where: {
              companyId,
              linkToGroup: true
            },
            order: [["id", "DESC"]],
            transaction
          });
          if (queueWithLinkToGroup) {
            queueIdToLink = queueWithLinkToGroup.id;
          }
        }

        ticket = await Ticket.create({
          contactId: groupContact ? groupContact.id : contact.id,
          status: "pending",
          isGroup: !!groupContact,
          unreadMessages,
          whatsappId,
          companyId,
          queueId: queueIdToLink
        }, { transaction });

        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId,
          userId: ticket.userId,
          transaction
        });
      } else if (groupContact && ticket.isGroup && !ticket.queueId) {
        const queueWithLinkToGroup = await Queue.findOne({
          where: {
            companyId,
            linkToGroup: true
          },
          order: [["id", "DESC"]],
          transaction
        });
        if (queueWithLinkToGroup) {
          await ticket.update({ queueId: queueWithLinkToGroup.id }, { transaction });
        }
      }

      return ticket.id;
    });
  });

  // Mutex memory cleanup
  if (!mutex.isLocked()) {
    ticketMutexes.delete(contactKey);
  }

  const finalTicket = await ShowTicketService(ticketId, companyId);
  return finalTicket;
};

export default FindOrCreateTicketService;
