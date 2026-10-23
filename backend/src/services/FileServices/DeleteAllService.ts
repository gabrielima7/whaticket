import Files from "../../models/Files";
import AppError from "../../errors/AppError";

const DeleteAllService = async (companyId: number): Promise<void> => {
  if (!companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await Files.destroy({ where: { companyId } });
};

export default DeleteAllService;
