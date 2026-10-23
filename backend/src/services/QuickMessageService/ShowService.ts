import QuickMessage from "../../models/QuickMessage";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId?: number
): Promise<QuickMessage> => {
  const record = await QuickMessage.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  if (companyId && Number(record.companyId) !== Number(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return record;
};

export default ShowService;
