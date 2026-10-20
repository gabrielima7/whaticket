"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return Promise.all([
            queryInterface.addColumn("Schedules", "repeatEvery", {
                type: sequelize_1.DataTypes.TEXT,
                defaultValue: null,
                allowNull: true
            }),
            queryInterface.addColumn("Schedules", "repeatCount", {
                type: sequelize_1.DataTypes.TEXT,
                defaultValue: null,
                allowNull: true
            }),
            queryInterface.addColumn("Schedules", "selectDaysRecorrenci", {
                type: sequelize_1.DataTypes.STRING,
                defaultValue: null,
                allowNull: true
            })
        ]);
    },
    down: (queryInterface) => {
        return Promise.all([
            queryInterface.removeColumn("Schedules", "repeatEvery"),
            queryInterface.removeColumn("Schedules", "repeatCount"),
            queryInterface.removeColumn("Schedules", "selectDaysRecorrenci")
        ]);
    }
};
