import { DataTypes, Model } from 'sequelize';

import sequelize from '@/lib/sequelize';

class Conversation extends Model {}

Conversation.init(
  {
    interactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    threadId: {
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
