"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const INSERT_SETTING = `INSERT INTO "Settings" ("key", "value", "companyId", "createdAt", "updatedAt")
VALUES (:key, :value, :companyId, NOW(), NOW());`;
module.exports = {
    up: async (queryInterface) => {
        const companies = await queryInterface.sequelize.query('SELECT id FROM "Companies"', {
            type: sequelize_1.QueryTypes.SELECT
        });
        const templateTransfer = "{{ms}} {{name}}, seu atendimento foi transferido. Departamento: {{queue}}. Atendente: {{agent}}.";
        const templateGreeting = "{{ms}} {{name}}, meu nome é {{agent}} e vou prosseguir com seu atendimento!";
        for (const company of companies) {
            const settingsToEnsure = [
                {
                    key: "sendMsgTransfTicketMessage",
                    value: templateTransfer
                },
                {
                    key: "sendGreetingAcceptedMessage",
                    value: templateGreeting
                }
            ];
            for (const setting of settingsToEnsure) {
                const existingSettings = await queryInterface.sequelize.query('SELECT id FROM "Settings" WHERE "key" = :key AND "companyId" = :companyId', {
                    type: sequelize_1.QueryTypes.SELECT,
                    replacements: {
                        key: setting.key,
                        companyId: company.id
                    }
                });
                if (existingSettings.length === 0) {
                    await queryInterface.sequelize.query(INSERT_SETTING, {
                        replacements: {
                            key: setting.key,
                            value: setting.value,
                            companyId: company.id
                        }
                    });
                }
            }
        }
    },
    down: async (queryInterface) => {
        await queryInterface.bulkDelete("Settings", {
            key: ["sendMsgTransfTicketMessage", "sendGreetingAcceptedMessage"]
        });
    }
};
