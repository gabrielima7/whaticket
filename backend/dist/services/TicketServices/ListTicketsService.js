"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const date_fns_1 = require("date-fns");
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const Contact_1 = __importDefault(require("../../models/Contact"));
const Message_1 = __importDefault(require("../../models/Message"));
const Queue_1 = __importDefault(require("../../models/Queue"));
const User_1 = __importDefault(require("../../models/User"));
const ShowUserService_1 = __importDefault(require("../UserServices/ShowUserService"));
const Tag_1 = __importDefault(require("../../models/Tag"));
const TicketTag_1 = __importDefault(require("../../models/TicketTag"));
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const ListTicketsService = async ({ searchParam = "", pageNumber = "1", queueIds, tags, users, status, date, updatedAt, showAll, userId, withUnreadMessages, companyId }) => {
    let whereCondition = {
        [sequelize_1.Op.or]: [{ userId }, { status: "pending" }],
        queueId: { [sequelize_1.Op.or]: [queueIds, null] }
    };
    let includeCondition;
    includeCondition = [
        {
            model: Contact_1.default,
            as: "contact",
            attributes: ["id", "name", "number", "lid", "email", "profilePicUrl"]
        },
        {
            model: Queue_1.default,
            as: "queue",
            attributes: ["id", "name", "color"]
        },
        {
            model: User_1.default,
            as: "user",
            attributes: ["id", "name"]
        },
        {
            model: Tag_1.default,
            as: "tags",
            attributes: ["id", "name", "color"]
        },
        {
            model: Whatsapp_1.default,
            as: "whatsapp",
            attributes: ["name", "pix", "pixMessage"]
        },
    ];
    if (showAll === "true") {
        whereCondition = { queueId: { [sequelize_1.Op.or]: [queueIds, null] } };
    }
    if (status) {
        whereCondition = {
            ...whereCondition,
            status
        };
    }
    if (searchParam) {
        const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();
        includeCondition = [
            ...includeCondition,
            {
                model: Message_1.default,
                as: "messages",
                attributes: ["id", "body"],
                where: {
                    body: (0, sequelize_1.where)((0, sequelize_1.fn)("LOWER", (0, sequelize_1.col)("body")), "LIKE", `%${sanitizedSearchParam}%`)
                },
                required: false,
                duplicating: false
            }
        ];
        whereCondition = {
            ...whereCondition,
            [sequelize_1.Op.or]: [
                {
                    "$contact.name$": (0, sequelize_1.where)((0, sequelize_1.fn)("LOWER", (0, sequelize_1.col)("contact.name")), "LIKE", `%${sanitizedSearchParam}%`)
                },
                { "$contact.number$": { [sequelize_1.Op.like]: `%${sanitizedSearchParam}%` } },
                {
                    "$message.body$": (0, sequelize_1.where)((0, sequelize_1.fn)("LOWER", (0, sequelize_1.col)("body")), "LIKE", `%${sanitizedSearchParam}%`)
                }
            ]
        };
    }
    if (date) {
        whereCondition = {
            ...whereCondition,
            createdAt: {
                [sequelize_1.Op.between]: [+(0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(date)), +(0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(date))]
            }
        };
    }
    if (updatedAt) {
        whereCondition = {
            ...whereCondition,
            updatedAt: {
                [sequelize_1.Op.between]: [
                    +(0, date_fns_1.startOfDay)((0, date_fns_1.parseISO)(updatedAt)),
                    +(0, date_fns_1.endOfDay)((0, date_fns_1.parseISO)(updatedAt))
                ]
            }
        };
    }
    if (withUnreadMessages === "true") {
        const user = await (0, ShowUserService_1.default)(userId);
        const userQueueIds = user.queues.map(queue => queue.id);
        whereCondition = {
            ...whereCondition,
            [sequelize_1.Op.or]: [{ userId }, { status: "pending" }],
            queueId: { [sequelize_1.Op.or]: [userQueueIds, null] },
            unreadMessages: { [sequelize_1.Op.gt]: 0 }
        };
    }
    // ID-039: Eliminar N+1 em tags com query agrupada com HAVING COUNT
    if (Array.isArray(tags) && tags.length > 0) {
        const ticketTags = await TicketTag_1.default.findAll({
            attributes: ["ticketId"],
            where: { tagId: { [sequelize_1.Op.in]: tags } },
            group: ["ticketId"],
            having: (0, sequelize_1.where)((0, sequelize_1.fn)("count", (0, sequelize_1.col)("ticketId")), String(tags.length)),
            raw: true
        });
        const ticketsWithAllTags = ticketTags.map((t) => t.ticketId);
        whereCondition = {
            ...whereCondition,
            id: {
                [sequelize_1.Op.in]: ticketsWithAllTags
            }
        };
    }
    // ID-039: Eliminar N+1 e intersecao vazia substituindo loop por operador Op.in
    if (Array.isArray(users) && users.length > 0) {
        whereCondition = {
            ...whereCondition,
            userId: {
                [sequelize_1.Op.in]: users
            }
        };
    }
    const limit = 40;
    const offset = limit * (+pageNumber - 1);
    whereCondition = {
        ...whereCondition,
        companyId
    };
    const { count, rows: tickets } = await Ticket_1.default.findAndCountAll({
        where: whereCondition,
        include: includeCondition,
        distinct: true,
        limit,
        offset,
        order: [["updatedAt", "DESC"]],
        subQuery: false
    });
    const hasMore = count > offset + tickets.length;
    return {
        tickets,
        count,
        hasMore
    };
};
exports.default = ListTicketsService;
