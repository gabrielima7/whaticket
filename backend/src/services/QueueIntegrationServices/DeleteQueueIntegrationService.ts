import QueueIntegrations from "../../models/QueueIntegrations";
import AppError from "../../errors/AppError";

const DeleteQueueIntegrationService = async (
  id: string,
  companyId?: number
): Promise<void> => {
  const whereCondition: Record<string, any> = { id };
  if (companyId) {
    whereCondition.companyId = companyId;
  }

  const dialogflow = await QueueIntegrations.findOne({
    where: whereCondition
  });

  if (!dialogflow) {
    throw new AppError("ERR_NO_DIALOG_FOUND", 404);
  }

  await dialogflow.destroy();
};

export default DeleteQueueIntegrationService;
