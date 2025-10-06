import { DataTypes } from 'sequelize';

export default function(sequelize) {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    payplus_page_uid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
    },
    payment_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'completed', 'failed', 'cancelled']]
      }
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'payplus',
    },
    payplus_response: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    environment: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'production',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'transaction',
    timestamps: false,
    indexes: [
      {
        fields: ['payplus_page_uid'],
        name: 'idx_transaction_payplus_page_uid'
      },
      {
        fields: ['payment_status'],
        name: 'idx_transaction_payment_status'
      },
      {
        fields: ['created_at'],
        name: 'idx_transaction_created_at'
      },
    ],
  });

  Transaction.associate = function(models) {
    // Transaction has many purchases
    Transaction.hasMany(models.Purchase, {
      foreignKey: 'transaction_id',
      as: 'purchases'
    });
  };

  return Transaction;
}