import { Op, Transaction } from "sequelize";
import TicketTraking from "../../models/TicketTraking";

interface Params {
  ticketId: string | number;
  companyId: string | number;
  whatsappId?: string | number;
  userId?: string | number;
  transaction?: Transaction;
}

const FindOrCreateATicketTrakingService = async ({
  ticketId,
  companyId,
  whatsappId,
  userId,
  transaction
}: Params): Promise<TicketTraking> => {
  const ticketTraking = await TicketTraking.findOne({
    where: {
      ticketId,
      finishedAt: {
        [Op.is]: null
      }
    },
    transaction
  });

  if (ticketTraking) {
    return ticketTraking;
  }

  const newRecord = await TicketTraking.create(
    {
      ticketId,
      companyId,
      whatsappId,
      userId
    } as any,
    { transaction }
  );

  return newRecord;
};

export default FindOrCreateATicketTrakingService;
