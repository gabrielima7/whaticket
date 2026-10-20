import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";

const DeleteService = async (id: string | number, companyId?: number): Promise<void> => {
  const where: any = { id };
  if (companyId) {
    where.companyId = companyId;
  }

  const tag = await Tag.findOne({
    where
  });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  await tag.destroy();
};

export default DeleteService;
