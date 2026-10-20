"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AppError_1 = __importDefault(require("../../errors/AppError"));
const Message_1 = __importDefault(require("../../models/Message"));
const ShowTicketService_1 = __importDefault(require("../TicketServices/ShowTicketService"));
const Queue_1 = __importDefault(require("../../models/Queue"));
const ListMessagesService = async ({ pageNumber = "1", ticketId, companyId, queues = [] }) => {
    const ticket = await (0, ShowTicketService_1.default)(ticketId, companyId);
    if (!ticket) {
        throw new AppError_1.default("ERR_NO_TICKET_FOUND", 404);
    }
    // await setMessagesAsRead(ticket);
    const limit = 20;
    const offset = limit * (+pageNumber - 1);
    const options = {
        where: {
            ticketId,
            companyId
        }
    };
    // Remove the queue filtering entirely since we want to show all messages
    // regardless of which queue they were created under
    // if (queues.length > 0) {
    //   options.where["queueId"] = {
    //     [Op.or]: {
    //       [Op.in]: queues,
    //       [Op.eq]: null
    //     }
    //   };
    // }
    const { count, rows: messages } = await Message_1.default.findAndCountAll({
        ...options,
        limit,
        include: [
            "contact",
            {
                model: Message_1.default,
                as: "quotedMsg",
                include: ["contact"]
            },
            {
                model: Queue_1.default,
                as: "queue"
            }
        ],
        offset,
        order: [["createdAt", "DESC"]]
    });
    const hasMore = count > offset + messages.length;
    return {
        messages: messages.reverse(),
        ticket,
        count,
        hasMore
    };
};
exports.default = ListMessagesService;
