import { Sequelize } from 'sequelize';

import config from '@/config';

const sequelize = new Sequelize(config.database.url as string, {
  dialectOptions: {
    ssl: {
      rejectUnauthorized: true,
    },
  },
  logging: false,
});

export default sequelize;
