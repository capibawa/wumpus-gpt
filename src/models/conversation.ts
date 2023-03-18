import { DataTypes, Model } from 'sequelize';

import sequelize from '@/lib/sequelize';

class Conversation extends Model {
  declare id: string;
  declare channelId: string;
  declare messageId: string;
  declare expiresAt?: Date;
}

Conversation.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    channelId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
    },
  },
  { sequelize }
);

export default Conversation;
