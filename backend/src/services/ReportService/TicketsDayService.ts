import sequelize from "../../database/index";
import { QueryTypes } from "sequelize";

interface Return {
  data: {};
  count: number;
}

interface Request {
  initialDate: string;
  finalDate: string;
  companyId: number;
}

interface DataReturn {
  total: number;
  data?: number;
  horario?: string;
}

export const TicketsDayService = async ({
  initialDate,
  finalDate,
  companyId
}: Request): Promise<Return> => {
  let sql = "";
  let count = 0;

  const safeInitialDate = String(initialDate || "").trim();
  const safeFinalDate = String(finalDate || "").trim();

  if (safeInitialDate && safeInitialDate === safeFinalDate) {
    sql = `
    SELECT
      COUNT(*) AS total,
      extract(hour from tick."createdAt") AS horario
    FROM
      "TicketTraking" tick
    WHERE
      tick."companyId" = :companyId
      and DATE(tick."createdAt") >= :startDateTime
      AND DATE(tick."createdAt") <= :endDateTime
    GROUP BY
      extract(hour from tick."createdAt")
    ORDER BY
      horario asc;
    `;
  } else {
    sql = `
    SELECT
      COUNT(*) AS total,
      to_char(DATE(tick."createdAt"), 'dd/mm/YYYY') as data
    FROM
      "TicketTraking" tick
    WHERE
      tick."companyId" = :companyId
      and DATE(tick."createdAt") >= :initialDate
      AND DATE(tick."createdAt") <= :finalDate
    GROUP BY
      to_char(DATE(tick."createdAt"), 'dd/mm/YYYY')
    ORDER BY
      data asc;
    `;
  }

  const data: DataReturn[] = await sequelize.query(sql, {
    replacements: {
      companyId,
      initialDate: safeInitialDate,
      finalDate: safeFinalDate,
      startDateTime: `${safeInitialDate} 00:00:00`,
      endDateTime: `${safeFinalDate} 23:59:59`
    },
    type: QueryTypes.SELECT
  });

  data.forEach(register => {
    count += Number(register.total);
  });

  return { data, count };
};
