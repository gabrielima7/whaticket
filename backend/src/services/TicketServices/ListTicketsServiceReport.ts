/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable camelcase */
import { QueryTypes } from "sequelize";
import sequelize from "../../database";

export interface DashboardData {
  tickets: any[];
  totalTickets: any;
}

export interface Params {
  searchParam?: string;
  contactId?: string;
  whatsappId?: string[];
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  queueIds?: number[];
  tags?: number[];
  users?: number[];
  userId?: string;
}

export default async function ListTicketsServiceReport(
  companyId: string | number,
  params: Params,
  page: number = 1,
  pageSize: number = 20
): Promise<DashboardData> {
  const safeCompanyId = Number(companyId);
  const safePage = Math.max(Number(page) || 1, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  const offset = (safePage - 1) * safePageSize;

  const replacements: Record<string, any> = {
    companyId: safeCompanyId,
    limit: safePageSize,
    offset
  };

  let where = `WHERE t."companyId" = :companyId`;

  if (params.dateFrom) {
    where += ` AND t."createdAt" >= :dateFrom`;
    replacements.dateFrom = `${params.dateFrom} 00:00:00`;
  }

  if (params.dateTo) {
    where += ` AND t."createdAt" <= :dateTo`;
    replacements.dateTo = `${params.dateTo} 23:59:59`;
  }

  if (Array.isArray(params.whatsappId) && params.whatsappId.length > 0) {
    const validWhatsappIds = params.whatsappId.map(Number).filter(id => !isNaN(id));
    if (validWhatsappIds.length > 0) {
      where += ` AND t."whatsappId" IN (:whatsappIds)`;
      replacements.whatsappIds = validWhatsappIds;
    }
  }

  if (Array.isArray(params.users) && params.users.length > 0) {
    const validUsers = params.users.map(Number).filter(id => !isNaN(id));
    if (validUsers.length > 0) {
      where += ` AND t."userId" IN (:users)`;
      replacements.users = validUsers;
    }
  }

  if (Array.isArray(params.queueIds) && params.queueIds.length > 0) {
    const validQueueIds = params.queueIds.map(Number).filter(id => !isNaN(id));
    if (validQueueIds.length > 0) {
      where += ` AND COALESCE(t."queueId", 0) IN (:queueIds)`;
      replacements.queueIds = validQueueIds;
    }
  }

  if (Array.isArray(params.status) && params.status.length > 0) {
    const validStatus = params.status.map(s => String(s).replace(/[^a-zA-Z]/g, "")).filter(Boolean);
    if (validStatus.length > 0) {
      where += ` AND t."status" IN (:status)`;
      replacements.status = validStatus;
    }
  }

  if (params.contactId !== undefined && params.contactId !== "") {
    const safeContactId = Number(params.contactId);
    if (!isNaN(safeContactId)) {
      where += ` AND t."contactId" = :contactId`;
      replacements.contactId = safeContactId;
    }
  }

  if (params.searchParam && params.searchParam.trim() !== "") {
    where += ` AND (LOWER(c."name") LIKE :searchParam OR c."number" LIKE :searchParam)`;
    replacements.searchParam = `%${params.searchParam.trim().toLowerCase()}%`;
  }

  const query = `
    SELECT 
      t.id,
      w."name" AS "whatsappName",
      c."name" AS "contactName",
      u."name" AS "userName",
      q."name" AS "queueName",
      t."lastMessage",
      t.uuid,
      CASE t.status
        WHEN 'open' THEN 'ABERTO'
        WHEN 'closed' THEN 'FECHADO'
        WHEN 'pending' THEN 'PENDENTE'
        WHEN 'group' THEN 'GRUPO'
      END AS "status",
      TO_CHAR(t."createdAt", 'DD/MM/YYYY HH24:MI') AS "createdAt",
      TO_CHAR(tt."finishedAt", 'DD/MM/YYYY HH24:MI') AS "closedAt"
    FROM "Tickets" t
    LEFT JOIN (
      SELECT DISTINCT ON ("ticketId") *
      FROM "TicketTraking"
      WHERE "companyId" = :companyId
      ORDER BY "ticketId", "id" DESC
    ) tt ON t.id = tt."ticketId"
    INNER JOIN "Contacts" c ON t."contactId" = c.id 
    LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id 
    LEFT JOIN "Users" u ON t."userId" = u.id 
    LEFT JOIN "Queues" q ON t."queueId" = q.id 
    -- filterPeriod
  `;

  const finalQuery = query.replace("-- filterPeriod", where);

  const totalTicketsQuery = `
    SELECT COUNT(*) AS total 
    FROM "Tickets" t
    INNER JOIN "Contacts" c ON t."contactId" = c.id
    ${where}
  `;

  const totalTicketsResult: any = await sequelize.query(totalTicketsQuery, {
    replacements,
    type: QueryTypes.SELECT
  });
  const totalTickets = totalTicketsResult[0] || { total: 0 };

  const paginatedQuery = `${finalQuery} ORDER BY t."createdAt" DESC LIMIT :limit OFFSET :offset`;

  const responseData: any[] = await sequelize.query(paginatedQuery, {
    replacements,
    type: QueryTypes.SELECT
  });

  return { tickets: responseData, totalTickets };
}
