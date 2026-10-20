"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return queryInterface.createTable("HolidayPeriods", {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false,
            },
            startDate: {
                type: sequelize_1.DataTypes.DATEONLY,
                allowNull: false,
            },
            endDate: {
                type: sequelize_1.DataTypes.DATEONLY,
                allowNull: false,
            },
            message: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false,
            },
            active: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            whatsappId: {
                type: sequelize_1.DataTypes.INTEGER,
                references: { model: "Whatsapps", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false,
            },
            companyId: {
                type: sequelize_1.DataTypes.INTEGER,
                references: { model: "Companies", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "CASCADE",
                allowNull: false,
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE(6),
                allowNull: false,
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE(6),
                allowNull: false,
            },
        });
    },
    down: (queryInterface) => {
        return queryInterface.dropTable("HolidayPeriods");
    },
};
