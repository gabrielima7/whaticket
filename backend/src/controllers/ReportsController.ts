import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';

import sequelize from '../database';

type RequestQueryProps = {
  initialDate: string;
  finalDate: string;
};

export const appointmentsAtendent = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { initialDate, finalDate } = req.query as RequestQueryProps;
  const { companyId } = req.user;

  const resultAppointmentsByAttendents = await sequelize.query(
    `
      SELECT 
         u."name" as user_name
        ,COUNT(t.*) as total_tickets
      FROM "Users" u 
      LEFT JOIN "TicketTraking" tt ON tt."userId" = u.id 
      LEFT JOIN "Tickets" t ON t.id = tt."ticketId" AND t."createdAt" BETWEEN :initialDate AND :finalDate
      where u."companyId" = :companyId
      GROUP BY u."name"
      ORDER BY total_tickets ASC
    `,
    {
      replacements: { companyId, initialDate, finalDate },
      type: QueryTypes.SELECT
    },
  );

  const resultTicketsByQueues = await sequelize.query(
    `
      SELECT 
        q."name"
        ,COUNT(DISTINCT t.id) as total_tickets 
      FROM "Queues" q 
      LEFT JOIN "Messages" m ON m."queueId" = q.id 
      LEFt JOIN "Tickets" t ON t.id = m."ticketId" AND t."createdAt" BETWEEN :initialDate AND :finalDate
      WHERE q."companyId" = :companyId
      GROUP BY q."name" 
      ORDER BY total_tickets ASC
    `,
    {
      replacements: { companyId, initialDate, finalDate },
      type: QueryTypes.SELECT
    },
  );

  return res.json({
    appointmentsByAttendents: resultAppointmentsByAttendents,
    ticketsByQueues: resultTicketsByQueues,
  });
};

export const rushHour = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { initialDate, finalDate } = req.query as RequestQueryProps;
  const { companyId } = req.user;

  const resultAppointmentsByHours = await sequelize.query(
    `
      SELECT
        extract (hour from m."createdAt") AS message_hour,
        COUNT(m.id) AS message_count
      FROM "Messages" m
      LEFT JOIN "Tickets" t ON t.id = m."ticketId"
      WHERE t."companyId" = :companyId
        AND m."createdAt" BETWEEN :initialDate AND :finalDate
      GROUP BY
        extract (hour from m."createdAt")
      ORDER BY
        extract (hour from m."createdAt")
    `,
    {
      replacements: { companyId, initialDate, finalDate },
      type: QueryTypes.SELECT
    },
  );

  return res.json(resultAppointmentsByHours);
};

export const departamentRatings = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { initialDate, finalDate } = req.query as RequestQueryProps;
  const { companyId } = req.user;

  const resultDepartamentRating = await sequelize.query(
    `
      SELECT
        m."ticketId"
        ,q."name"
        ,round(avg(ur.rate), 2) AS total_rate
      FROM "Messages" m
      LEFT JOIN "Tickets" t ON t.id = m."ticketId"
      LEFT JOIN "UserRatings" ur ON ur."ticketId" = t.id
      LEFT JOIN "Queues" q ON q.id = m."queueId"
      WHERE m."queueId" IS NOT NULL
        AND m."companyId" = :companyId
        AND ur."createdAt" BETWEEN :initialDate AND :finalDate
      GROUP BY m."ticketId", q."name"
    `,
    {
      replacements: { companyId, initialDate, finalDate },
      type: QueryTypes.SELECT
    },
  );

  return res.json(resultDepartamentRating);
};
