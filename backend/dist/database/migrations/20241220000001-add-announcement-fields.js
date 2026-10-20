"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return Promise.all([
            queryInterface.addColumn("Announcements", "showForSuperAdmin", {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }),
            queryInterface.addColumn("Announcements", "sendToAllCompanies", {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            })
        ]);
    },
    down: (queryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("Announcements", "showForSuperAdmin"),
            queryInterface.removeColumn("Announcements", "sendToAllCompanies")
        ]);
    }
};
