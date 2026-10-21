"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
module.exports = {
    up: async (queryInterface) => {
        return Promise.all([
            // Tickets indexes
            queryInterface.addIndex("Tickets", ["companyId", "status", "updatedAt"], {
                name: "idx_tickets_company_status_updated"
            }),
            queryInterface.addIndex("Tickets", ["companyId", "contactId", "whatsappId", "status"], {
                name: "idx_tickets_company_contact_whatsapp_status"
            }),
            queryInterface.addIndex("Tickets", ["uuid"], {
                name: "idx_tickets_uuid"
            }),
            // Messages indexes
            queryInterface.addIndex("Messages", ["companyId", "ticketId", "createdAt"], {
                name: "idx_messages_company_ticket_created"
            }),
            queryInterface.addIndex("Messages", ["ticketId", "read"], {
                name: "idx_messages_ticket_read"
            }),
            queryInterface.addIndex("Messages", ["contactId"], {
                name: "idx_messages_contact_id"
            }),
            // TicketTraking indexes
            queryInterface.addIndex("TicketTraking", ["ticketId", "finishedAt"], {
                name: "idx_ticket_traking_ticket_finished"
            }),
            queryInterface.addIndex("TicketTraking", ["companyId", "queuedAt", "finishedAt"], {
                name: "idx_ticket_traking_company_queued_finished"
            }),
            // Contacts indexes
            queryInterface.addIndex("Contacts", ["companyId", "number"], {
                name: "idx_contacts_company_number"
            })
        ]);
    },
    down: async (queryInterface) => {
        return Promise.all([
            queryInterface.removeIndex("Tickets", "idx_tickets_company_status_updated"),
            queryInterface.removeIndex("Tickets", "idx_tickets_company_contact_whatsapp_status"),
            queryInterface.removeIndex("Tickets", "idx_tickets_uuid"),
            queryInterface.removeIndex("Messages", "idx_messages_company_ticket_created"),
            queryInterface.removeIndex("Messages", "idx_messages_ticket_read"),
            queryInterface.removeIndex("Messages", "idx_messages_contact_id"),
            queryInterface.removeIndex("TicketTraking", "idx_ticket_traking_ticket_finished"),
            queryInterface.removeIndex("TicketTraking", "idx_ticket_traking_company_queued_finished"),
            queryInterface.removeIndex("Contacts", "idx_contacts_company_number")
        ]);
    }
};
