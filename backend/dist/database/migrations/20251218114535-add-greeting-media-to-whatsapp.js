"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return Promise.all([
            queryInterface.addColumn("Whatsapps", "greetingMediaPath", {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
                defaultValue: null
            }),
            queryInterface.addColumn("Whatsapps", "greetingMediaName", {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
                defaultValue: null
            }),
            queryInterface.addColumn("Whatsapps", "greetingMediaSendMode", {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
                defaultValue: "caption"
            })
        ]);
    },
    down: (queryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("Whatsapps", "greetingMediaPath"),
            queryInterface.removeColumn("Whatsapps", "greetingMediaName"),
            queryInterface.removeColumn("Whatsapps", "greetingMediaSendMode")
        ]);
    }
};
