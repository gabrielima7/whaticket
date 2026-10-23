import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string,
  companyId?: number
): Promise<void> => {
  const whereCondition: Record<string, any> = { id };
  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const record = await Campaign.findOne({
    where: whereCondition
  });

  if (!record) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  if (record.status === "EM_ANDAMENTO") {
    throw new AppError("Não é permitido excluir campanha em andamento", 400);
  }

  await record.destroy();
};

export default DeleteService;
