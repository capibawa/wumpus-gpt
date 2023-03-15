import { DataTypes, Model } from 'sequelize';

import sequelize from '@/lib/sequelize';

class Conversation extends Model {
  declare id: number;
  declare interactionId: string;
  declare channelId: string;
  declare expiresAt: Date;
}

Conversation.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    interactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    channelId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'Conversation',
  }
);

export default Conversation;
