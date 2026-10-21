import moment from "moment";
import * as Sentry from "@sentry/node";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import ShowTicketService from "./ShowTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import FindOrCreateATicketTrakingService from "./FindOrCreateATicketTrakingService";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { verifyMessage } from "../WbotServices/wbotMessageListener";
import ListSettingsServiceOne from "../SettingServices/ListSettingsServiceOne";
import ShowUserService from "../UserServices/ShowUserService";
import { isNil } from "lodash";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import { buildContactAddress } from "../../utils/global";
import formatBody from "../../helpers/Mustache";
import TicketUser from "../../models/TicketUser";
import sequelize from "../../database";

interface TicketData {
  status?: string;
  userId?: number | null;
  userIds?: number[];
  ticketUsers?: Array<{ userId: number; queueId?: number | null }>;
  queueId?: number | null;
  chatbot?: boolean;
  queueOptionId?: number;
  whatsappId?: string;
  useIntegration?: boolean;
  integrationId?: number | null;
  promptId?: number | null;
  lastMessage?: string;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
  companyId: number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId,
  companyId
}: Request): Promise<Response> => {
  try {
    let { status } = ticketData;
    let { queueId, userId, userIds, ticketUsers, whatsappId, lastMessage = null } = ticketData;
    let chatbot: boolean | null = ticketData.chatbot || false;
    let queueOptionId: number | null = ticketData.queueOptionId || null;
    let promptId: number | null = ticketData.promptId || null;
    let useIntegration: boolean | null = ticketData.useIntegration || false;
    let integrationId: number | null = ticketData.integrationId || null;

    const io = getIO();

    let oldStatus = "";
    let oldUserId: number | undefined = undefined;
    let oldQueueId: number | null | undefined = undefined;
    let hasTicketUsersChanged = false;

    let isEarlyRating = false;
    let ratingMessageToSend: string | null = null;
    let shouldSendCompletion = false;
    let completionMessageToSend: string | null = null;

    // ID-028: Transação ACID com row-level pessimistic locking (FOR UPDATE)
    await sequelize.transaction(async (transaction) => {
      // Isolar o lock pessimista sem include de tabelas associadas para evitar erro 0A000 no PostgreSQL
      const lockedTicket = await Ticket.findOne({
        where: { id: ticketId, companyId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!lockedTicket) {
        throw new AppError("ERR_NO_TICKET_FOUND", 404);
      }

      oldStatus = lockedTicket.status;
      oldUserId = lockedTicket.userId;
      oldQueueId = lockedTicket.queueId;

      if (isNil(whatsappId)) {
        whatsappId = lockedTicket.whatsappId?.toString();
      }

      // Concurrency check: se outro operador já abriu/aceitou o ticket
      if (
        status === "open" &&
        userId &&
        oldStatus === "open" &&
        oldUserId &&
        oldUserId !== userId
      ) {
        const assignedUser = await User.findByPk(oldUserId, {
          attributes: ["id", "name"]
        });
        throw new AppError(
          `TICKET_ALREADY_OPEN|${assignedUser?.name || "Atendente"}|${oldUserId}`,
          409
        );
      }

      const ticketTraking = await FindOrCreateATicketTrakingService({
        ticketId,
        companyId,
        whatsappId: lockedTicket.whatsappId,
        transaction
      });

      if (oldStatus === "closed" || Number(whatsappId) !== lockedTicket.whatsappId) {
        await CheckContactOpenTickets(lockedTicket.contactId, whatsappId, companyId);
        chatbot = null;
        queueOptionId = null;
      }

      if (status === "closed") {
        let queueLinkToGroup = false;
        if (lockedTicket.queueId) {
          const queue = await Queue.findByPk(lockedTicket.queueId, { transaction });
          queueLinkToGroup = queue?.linkToGroup || false;
        }

        const shouldDisableAutomations = lockedTicket.isGroup && queueLinkToGroup;

        if (!shouldDisableAutomations) {
          const { complationMessage, ratingMessage } = lockedTicket.whatsappId
            ? await ShowWhatsAppService(lockedTicket.whatsappId, companyId)
            : { complationMessage: null, ratingMessage: null };

          const settingEvaluation = await ListSettingsServiceOne({
            companyId,
            key: "userRating"
          });

          const contact = await Contact.findByPk(lockedTicket.contactId, {
            attributes: ["id", "isGroup", "disableBot"],
            transaction
          });

          if (
            lockedTicket.status !== "pending" &&
            !lockedTicket.isGroup &&
            !contact?.isGroup &&
            !contact?.disableBot &&
            settingEvaluation?.value === "enabled"
          ) {
            if (ticketTraking.ratingAt == null && ticketTraking.userId !== null) {
              await ticketTraking.update(
                { ratingAt: moment().toDate() },
                { transaction }
              );

              isEarlyRating = true;
              ratingMessageToSend = ratingMessage;
              return;
            }

            ticketTraking.ratingAt = moment().toDate();
            ticketTraking.rated = false;
          } else {
            ticketTraking.finishedAt = moment().toDate();

            if (
              !lockedTicket.isGroup &&
              !contact?.isGroup &&
              !contact?.disableBot &&
              !isNil(complationMessage) &&
              complationMessage !== ""
            ) {
              shouldSendCompletion = true;
              completionMessageToSend = complationMessage;
            }
          }
        } else {
          ticketTraking.finishedAt = moment().toDate();
        }
      }

      await lockedTicket.update(
        {
          promptId: null,
          integrationId: null,
          useIntegration: false,
          typebotStatus: false,
          typebotSessionId: null
        },
        { transaction }
      );

      if (queueId !== undefined && queueId !== null) {
        ticketTraking.queuedAt = moment().toDate();
      }

      // Gerenciar ticketUsers
      if (ticketUsers !== undefined && Array.isArray(ticketUsers)) {
        const currentTicketUsers = await TicketUser.findAll({
          where: { ticketId: lockedTicket.id },
          transaction
        });
        const currentUserIds = currentTicketUsers.map(tu => tu.userId).sort();
        const newUserIds = ticketUsers.map(tu => tu.userId).sort();
        hasTicketUsersChanged =
          JSON.stringify(currentUserIds) !== JSON.stringify(newUserIds);

        await TicketUser.destroy({
          where: { ticketId: lockedTicket.id },
          transaction
        });

        if (ticketUsers.length > 0) {
          await TicketUser.bulkCreate(
            ticketUsers.map(tu => ({
              ticketId: lockedTicket.id,
              userId: tu.userId,
              queueId: tu.queueId || null
            })),
            { transaction }
          );
          userId = ticketUsers[0].userId;
          if (lockedTicket.isGroup && ticketUsers[0].queueId) {
            queueId = ticketUsers[0].queueId;
          }
        } else {
          userId = null;
        }
      } else if (userIds !== undefined && Array.isArray(userIds)) {
        await TicketUser.destroy({
          where: { ticketId: lockedTicket.id },
          transaction
        });

        if (userIds.length > 0) {
          await TicketUser.bulkCreate(
            userIds.map(uId => ({
              ticketId: lockedTicket.id,
              userId: uId,
              queueId: null
            })),
            { transaction }
          );
          userId = userIds[0];
        } else {
          userId = null;
        }
      }

      await lockedTicket.update(
        {
          status,
          queueId,
          userId,
          whatsappId,
          chatbot,
          queueOptionId,
          lastMessage: lastMessage !== null ? lastMessage : lockedTicket.lastMessage
        } as any,
        { transaction }
      );

      if (status === "pending") {
        await ticketTraking.update(
          {
            whatsappId,
            queuedAt: moment().toDate(),
            startedAt: null,
            userId: null
          } as any,
          { transaction }
        );
      }

      if (status === "open") {
        await ticketTraking.update(
          {
            startedAt: moment().toDate(),
            ratingAt: null,
            rated: false,
            whatsappId,
            userId: lockedTicket.userId
          } as any,
          { transaction }
        );
      }

      await ticketTraking.save({ transaction });
    });

    // Se entrou em fluxo de avaliação de satisfação (interrompe o fechamento regular)
    if (isEarlyRating) {
      const ticket = await ShowTicketService(ticketId, companyId);
      const bodyRatingMessage = `${
        ratingMessageToSend ? ratingMessageToSend + "\n\n" : ""
      }Digite de 1 a 5 para qualificar nosso atendimento:\n\n*1* - 😞 _Péssimo_\n*2* - 😕 _Ruim_\n*3* - 😐 _Neutro_\n*4* - 🙂 _Bom_\n*5* - 😊 _Ótimo_`;

      await SendWhatsAppMessage({ body: bodyRatingMessage, ticket });

      io.to(`company-${ticket.companyId}-open`)
        .to(`queue-${ticket.queueId}-open`)
        .to(ticketId.toString())
        .emit(`company-${ticket.companyId}-ticket`, {
          action: "delete",
          ticketId: ticket.id
        });

      return { ticket, oldStatus, oldUserId };
    }

    // Carregar ticket atualizado com todas as associações após o commit da transação
    const ticketWithUsers = await ShowTicketService(ticketId, companyId);

    await SetTicketMessagesAsRead(ticketWithUsers);

    // Enviar mensagem de finalização se aplicável
    if (shouldSendCompletion && completionMessageToSend) {
      const body = `\u200e${completionMessageToSend}`;
      const sentMessage = await SendWhatsAppMessage({ body, ticket: ticketWithUsers });
      await verifyMessage(sentMessage, ticketWithUsers, ticketWithUsers.contact);
    }

    // Notificações de transferência de fila ou atendente
    const settingsTransfTicket = await ListSettingsServiceOne({
      companyId,
      key: "sendMsgTransfTicket"
    });
    const settingsTransfTicketMessage = await ListSettingsServiceOne({
      companyId,
      key: "sendMsgTransfTicketMessage"
    });
    const transferTemplateDefault =
      "{{ms}} {{name}}, seu atendimento foi transferido. Departamento: {{queue}}. Atendente: {{agent}}.";
    const transferTemplate =
      settingsTransfTicketMessage?.value?.trim() || transferTemplateDefault;

    const hasQueueTransfer =
      !isNil(oldQueueId) && !isNil(queueId) && oldQueueId !== queueId;
    const hasAgentTransfer =
      !isNil(oldUserId) && !isNil(userId) && oldUserId !== userId;

    if (
      settingsTransfTicket?.value === "enabled" &&
      transferTemplate &&
      (hasQueueTransfer || hasAgentTransfer) &&
      !ticketWithUsers.isGroup &&
      !ticketWithUsers.contact.isGroup
    ) {
      const queue = !isNil(queueId) ? await Queue.findByPk(queueId) : null;
      const oldQueue = !isNil(oldQueueId) ? await Queue.findByPk(oldQueueId) : null;
      const newAgent = !isNil(userId) ? await ShowUserService(userId) : null;
      const previousAgent = !isNil(oldUserId) ? await ShowUserService(oldUserId) : null;

      const messageBody = formatBody(transferTemplate, ticketWithUsers.contact, {
        queue: queue?.name || "",
        agent: newAgent?.name || "",
        previousAgent: previousAgent?.name || "",
        previousQueue: oldQueue?.name || ""
      });

      if (messageBody.trim()) {
        const wbot = await GetTicketWbot(ticketWithUsers);
        const queueChangedMessage = await wbot.sendMessage(
          buildContactAddress(ticketWithUsers.contact, ticketWithUsers.isGroup),
          {
            text: messageBody
          }
        );
        await verifyMessage(queueChangedMessage, ticketWithUsers, ticketWithUsers.contact);
      }
    }

    // Mensagem de saudação ao aceitar o ticket
    const settingsGreetingAccepted = await ListSettingsServiceOne({
      companyId,
      key: "sendGreetingAccepted"
    });
    const settingsGreetingAcceptedMessage = await ListSettingsServiceOne({
      companyId,
      key: "sendGreetingAcceptedMessage"
    });
    const greetingTemplateDefault =
      "{{ms}} {{name}}, meu nome é {{agent}} e vou prosseguir com seu atendimento!";
    const greetingTemplate =
      settingsGreetingAcceptedMessage?.value?.trim() || greetingTemplateDefault;

    if (status === "open") {
      if (
        settingsGreetingAccepted?.value === "enabled" &&
        greetingTemplate &&
        !ticketWithUsers.isGroup &&
        !ticketWithUsers.contact.isGroup &&
        ticketWithUsers.contact.disableBot !== true &&
        oldStatus !== "open"
      ) {
        const queue = ticketWithUsers.queueId
          ? await Queue.findByPk(ticketWithUsers.queueId)
          : null;
        const newAgent = ticketWithUsers.userId
          ? await ShowUserService(ticketWithUsers.userId)
          : null;
        const greetingBody = formatBody(greetingTemplate, ticketWithUsers.contact, {
          queue: queue?.name || "",
          agent: newAgent?.name || ""
        });

        if (greetingBody.trim()) {
          const wbot = await GetTicketWbot(ticketWithUsers);
          const sentMessage = await wbot.sendMessage(
            buildContactAddress(ticketWithUsers.contact, ticketWithUsers.isGroup),
            {
              text: greetingBody
            }
          );
          await verifyMessage(sentMessage, ticketWithUsers, ticketWithUsers.contact);
        }
      }
    }

    // Emissões via WebSocket
    if (
      ticketWithUsers.status !== oldStatus ||
      ticketWithUsers.user?.id !== oldUserId ||
      hasTicketUsersChanged
    ) {
      io.to(`company-${companyId}-${oldStatus}`)
        .to(`queue-${ticketWithUsers.queueId}-${oldStatus}`)
        .to(`user-${oldUserId}`)
        .emit(`company-${companyId}-ticket`, {
          action: "delete",
          ticketId: ticketWithUsers.id
        });
    }

    const userIdsToNotify = [ticketWithUsers?.userId, oldUserId].filter(Boolean);

    if (ticketWithUsers.ticketUsers && ticketWithUsers.ticketUsers.length > 0) {
      ticketWithUsers.ticketUsers.forEach((tu: any) => {
        if (tu.user && tu.user.id && !userIdsToNotify.includes(tu.user.id)) {
          userIdsToNotify.push(tu.user.id);
        }
      });
    }

    io.to(`company-${companyId}-${ticketWithUsers.status}`)
      .to(`company-${companyId}-notification`)
      .to(`queue-${ticketWithUsers.queueId}-${ticketWithUsers.status}`)
      .to(`queue-${ticketWithUsers.queueId}-notification`)
      .to(ticketId.toString())
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket: ticketWithUsers
      });

    userIdsToNotify.forEach((uid: number) => {
      io.to(`user-${uid}`).emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket: ticketWithUsers
      });
    });

    if (ticketWithUsers.isGroup && hasTicketUsersChanged) {
      io.to(`company-${companyId}-pending`)
        .to(`company-${companyId}-notification`)
        .emit(`company-${companyId}-ticket`, {
          action: "update",
          ticket: ticketWithUsers
        });
    }

    return { ticket: ticketWithUsers, oldStatus, oldUserId };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
};

export default UpdateTicketService;
