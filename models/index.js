import { Sequelize } from 'sequelize';
import databaseConfig from '../config/database.js';
import { luderror } from '../lib/ludlog.js';

const env = process.env.ENVIRONMENT || 'development';
const config = databaseConfig[env];

// Initialize Sequelize
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, config)
  : new Sequelize(config.database, config.username, config.password, config);

// Import all models
import User from './User.js';
import Settings from './Settings.js';
import EmailTemplate from './EmailTemplate.js';
import Category from './Category.js';
import Coupon from './Coupon.js';
import Transaction from './Transaction.js';
import SupportMessage from './SupportMessage.js';
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
import ClassroomMembership from './ClassroomMembership.js';
import Curriculum from './Curriculum.js';
import CurriculumItem from './CurriculumItem.js';
import CurriculumProduct from './CurriculumProduct.js';
import ContentTopic from './ContentTopic.js';
import LessonPlan from './LessonPlan.js';
import Logs from './Logs.js';
import WebhookLog from './WebhookLog.js';
import EduContent from './EduContent.js';
import EduContentUse from './EduContentUse.js';
import SystemTemplate from './SystemTemplate.js';
import GameLobby from './GameLobby.js';
import GameSession from './GameSession.js';
import RefreshToken from './RefreshToken.js';
import UserSession from './UserSession.js';
import Player from './Player.js';
import SubscriptionPurchase from './SubscriptionPurchase.js';

// Initialize models
const models = {
  sequelize, // Add sequelize instance
  Sequelize, // Add Sequelize constructor for operators
  User: User(sequelize),
  Settings: Settings(sequelize),
  EmailTemplate: EmailTemplate(sequelize),
  Category: Category(sequelize),
  Coupon: Coupon(sequelize),
  Transaction: Transaction(sequelize),
  SupportMessage: SupportMessage(sequelize),
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
  ClassroomMembership: ClassroomMembership(sequelize),
  Curriculum: Curriculum(sequelize),
  CurriculumItem: CurriculumItem(sequelize),
  CurriculumProduct: CurriculumProduct(sequelize),
  ContentTopic: ContentTopic(sequelize),
  LessonPlan: LessonPlan(sequelize),
  Logs: Logs(sequelize),
  WebhookLog: WebhookLog(sequelize),
  EduContent: EduContent(sequelize),
  EduContentUse: EduContentUse(sequelize),
  SystemTemplate: SystemTemplate(sequelize),
  GameLobby: GameLobby(sequelize),
  GameSession: GameSession(sequelize),
  RefreshToken: RefreshToken(sequelize),
  UserSession: UserSession(sequelize),
  Player: Player(sequelize),
  SubscriptionPurchase: SubscriptionPurchase(sequelize),
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
  } catch (err) {
    luderror.system('❌ Unable to connect to the database:', err);
  }
};

testDBConnection();

export { sequelize };
export default models;