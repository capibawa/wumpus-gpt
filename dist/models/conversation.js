"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const sequelize_1 = require("sequelize");
const sequelize_2 = tslib_1.__importDefault(require("../lib/sequelize"));
class Conversation extends sequelize_1.Model {
}
Conversation.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    interactionId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    channelId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
}, {
    sequelize: sequelize_2.default,
    tableName: 'Conversation',
});
exports.default = Conversation;
