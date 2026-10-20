"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up: (queryInterface) => {
        // Verificar se a coluna userId já existe antes de adicionar
        return queryInterface.describeTable("Stickers").then((tableDescription) => {
            if (!tableDescription.userId) {
                return queryInterface.addColumn("Stickers", "userId", {
                    type: sequelize_1.DataTypes.INTEGER,
                    references: { model: "Users", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE",
                    allowNull: true
                });
            }
            return Promise.resolve();
        });
    },
    down: (queryInterface) => {
        return queryInterface.removeColumn("Stickers", "userId");
    }
};
