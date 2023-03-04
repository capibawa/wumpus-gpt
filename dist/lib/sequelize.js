"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const sequelize_1 = require("sequelize");
const config_1 = tslib_1.__importDefault(require("../config"));
const sequelize = new sequelize_1.Sequelize(config_1.default.database.url, {
    dialect: 'mysql',
    dialectOptions: {
        ssl: {
            rejectUnauthorized: false,
        },
    },
    logging: false,
});
exports.default = sequelize;
