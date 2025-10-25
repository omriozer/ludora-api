import { Sequelize } from 'sequelize';
import databaseConfig from '../config/database.js';

const env = process.env.ENVIRONMENT || 'development';
const config = databaseConfig[env];

// Initialize Sequelize
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, config)
  : new Sequelize(config.database, config.username, config.password, config);

// Import all models
import User from './User.js';
import Settings from './Settings.js';
import Registration from './Registration.js';
import EmailTemplate from './EmailTemplate.js';
import Category from './Category.js';
import Coupon from './Coupon.js';
import Transaction from './Transaction.js';
import SupportMessage from './SupportMessage.js';
import Notification from './Notification.js';
import Purchase from './Purchase.js';
import Product from './Product.js';
import Workshop from './Workshop.js';
import Course from './Course.js';
import File from './File.js';
import Tool from './Tool.js';
import EmailLog from './EmailLog.js';
import Game from './Game.js';
import AudioFile from './AudioFile.js';
import SubscriptionPlan from './SubscriptionPlan.js';
import Subscription from './Subscription.js';
import SubscriptionHistory from './SubscriptionHistory.js';
import School from './School.js';
import Classroom from './Classroom.js';
import StudentInvitation from './StudentInvitation.js';
import ParentConsent from './ParentConsent.js';
import ClassroomMembership from './ClassroomMembership.js';
import Curriculum from './Curriculum.js';
import CurriculumItem from './CurriculumItem.js';
import Logs from './Logs.js';
import WebhookLog from './WebhookLog.js';

// Initialize models
const models = {
  sequelize, // Add sequelize instance
  User: User(sequelize),
  Settings: Settings(sequelize),
  Registration: Registration(sequelize),
  EmailTemplate: EmailTemplate(sequelize),
  Category: Category(sequelize),
  Coupon: Coupon(sequelize),
  Transaction: Transaction(sequelize),
  SupportMessage: SupportMessage(sequelize),
  Notification: Notification(sequelize),
  Purchase: Purchase(sequelize),
  Product: Product(sequelize),
  Workshop: Workshop(sequelize),
  Course: Course(sequelize),
  File: File(sequelize),
  Tool: Tool(sequelize),
  EmailLog: EmailLog(sequelize),
  Game: Game(sequelize),
  AudioFile: AudioFile(sequelize),
  SubscriptionPlan: SubscriptionPlan(sequelize),
  Subscription: Subscription(sequelize),
  SubscriptionHistory: SubscriptionHistory(sequelize),
  School: School(sequelize),
  Classroom: Classroom(sequelize),
  StudentInvitation: StudentInvitation(sequelize),
  ParentConsent: ParentConsent(sequelize),
  ClassroomMembership: ClassroomMembership(sequelize),
  Curriculum: Curriculum(sequelize),
  CurriculumItem: CurriculumItem(sequelize),
  Logs: Logs(sequelize),
  WebhookLog: WebhookLog(sequelize),
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});



// Test database connection
const testDBConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
};

testDBConnection();

export { sequelize };
export default models;