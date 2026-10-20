"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: async (queryInterface) => {
        await queryInterface.addColumn("Invoices", "paymentProvider", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true
        });
        await queryInterface.addColumn("Invoices", "providerPaymentId", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true
        });
        await queryInterface.addColumn("Invoices", "pixCopyPaste", {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true
        });
        await queryInterface.addColumn("Invoices", "qrCodeBase64", {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true
        });
        await queryInterface.addColumn("Invoices", "payerEmail", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true
        });
        await queryInterface.addColumn("Subscriptions", "paymentProvider", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true
        });
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn("Invoices", "paymentProvider");
        await queryInterface.removeColumn("Invoices", "providerPaymentId");
        await queryInterface.removeColumn("Invoices", "pixCopyPaste");
        await queryInterface.removeColumn("Invoices", "qrCodeBase64");
        await queryInterface.removeColumn("Invoices", "payerEmail");
        await queryInterface.removeColumn("Subscriptions", "paymentProvider");
    }
};
