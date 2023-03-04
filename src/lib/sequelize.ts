import { Sequelize } from 'sequelize';

import config from '@/config';

const sequelize = new Sequelize(config.database.url!, {
  dialect: 'mysql',
  dialectOptions: {
    ssl: {
      rejectUnauthorized: false,
    },
  },
  logging: false,
});

export default sequelize;
