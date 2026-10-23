import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string,
  companyId?: number
): Promise<void> => {
  const whereCondition: Record<string, any> = { id };
  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const record = await QuickMessage.findOne({
    where: whereCondition
  });

  if (!record) {
    throw new AppError("ERR_NO_QUICKMESSAGE_FOUND", 404);
  }

  await record.destroy();
};

export default DeleteService;
