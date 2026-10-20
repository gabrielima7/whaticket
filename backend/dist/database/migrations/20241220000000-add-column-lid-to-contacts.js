"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        return queryInterface.addColumn("Contacts", "lid", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            comment: "LID (Local ID) do contato para identificação única"
        });
    },
    down: (queryInterface) => {
        return queryInterface.removeColumn("Contacts", "lid");
    }
};
