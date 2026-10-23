import ContactListItem from "../../models/ContactListItem";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string,
  companyId?: number
): Promise<void> => {
  const whereCondition: Record<string, any> = { id };
  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const record = await ContactListItem.findOne({
    where: whereCondition
  });

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLISTITEM_FOUND", 404);
  }

  await record.destroy();
};

export default DeleteService;
