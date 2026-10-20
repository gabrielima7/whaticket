"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: async (queryInterface) => {
        const tableDescription = await queryInterface.describeTable("Messages");
        if (!tableDescription.isEdited) {
            await queryInterface.addColumn("Messages", "isEdited", {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false,
            });
        }
    },
    down: async (queryInterface) => {
        const tableDescription = await queryInterface.describeTable("Messages");
        if (tableDescription.isEdited) {
            await queryInterface.removeColumn("Messages", "isEdited");
        }
    }
};
