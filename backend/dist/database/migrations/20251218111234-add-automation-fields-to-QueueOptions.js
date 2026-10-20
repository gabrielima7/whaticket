"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return Promise.all([
            queryInterface.addColumn("QueueOptions", "queueType", {
                type: sequelize_1.DataTypes.STRING,
                defaultValue: null,
                allowNull: true
            }),
            queryInterface.addColumn("QueueOptions", "queueOptionsId", {
                type: sequelize_1.DataTypes.INTEGER,
                defaultValue: null,
                allowNull: true,
                references: { model: "Queues", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            }),
            queryInterface.addColumn("QueueOptions", "queueUsersId", {
                type: sequelize_1.DataTypes.INTEGER,
                defaultValue: null,
                allowNull: true,
                references: { model: "Users", key: "id" },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            })
        ]);
    },
    down: (queryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("QueueOptions", "queueType"),
            queryInterface.removeColumn("QueueOptions", "queueOptionsId"),
            queryInterface.removeColumn("QueueOptions", "queueUsersId")
        ]);
    }
};
