import AppError from "../../errors/AppError";
import QuickMessage from "../../models/QuickMessage";

interface Data {
  shortcode: string;
  message: string;
  userId: number | string;
  id?: number | string;
  companyId?: number;
  geral?: boolean;
  editBeforeSend?: boolean;
}

const UpdateService = async (data: Data): Promise<QuickMessage> => {
  const { id, shortcode, message, userId, companyId, geral, editBeforeSend } =
    data;

  const record = await QuickMessage.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  if (companyId && Number(record.companyId) !== Number(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await record.update({
    shortcode,
    message,
    userId,
    geral,
    editBeforeSend: editBeforeSend !== undefined ? editBeforeSend : false
  } as any);

  return record;
};

export default UpdateService;
