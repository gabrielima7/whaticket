import AppError from "../../errors/AppError";
import ContactList from "../../models/ContactList";

interface Data {
  id: number | string;
  name: string;
  companyId?: number | string;
}

const UpdateService = async (data: Data): Promise<ContactList> => {
  const { id, name, companyId } = data;

  const record = await ContactList.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
  }

  if (companyId && Number(record.companyId) !== Number(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await record.update({
    name
  });

  return record;
};

export default UpdateService;
