"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const sequelize_1 = require("sequelize");
const sequelize_2 = tslib_1.__importDefault(require("../lib/sequelize"));
class Conversation extends sequelize_1.Model {
}
Conversation.init({
    interactionId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    threadId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    expiresAt: {
        type: sequelize_1.DataTypes.DATE,
    },
}, { sequelize: sequelize_2.default });
exports.default = Conversation;
