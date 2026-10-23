import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import { campaignQueue } from "../../queues";

export async function RestartService(id: number, companyId?: number) {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  if (companyId && Number(campaign.companyId) !== Number(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await campaign.update({ status: "EM_ANDAMENTO" });

  await campaignQueue.add("ProcessCampaign", {
    id: campaign.id,
    delay: 3000
  });
}
