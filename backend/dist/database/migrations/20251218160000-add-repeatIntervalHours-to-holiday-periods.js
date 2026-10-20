"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return queryInterface.addColumn("HolidayPeriods", "repeatIntervalHours", {
            type: sequelize_1.DataTypes.INTEGER,
            defaultValue: 24,
            allowNull: false,
        });
    },
    down: (queryInterface) => {
        return queryInterface.removeColumn("HolidayPeriods", "repeatIntervalHours");
    },
};
