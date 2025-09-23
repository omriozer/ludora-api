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
import SupportMessage from './SupportMessage.js';
import Notification from './Notification.js';
import SiteText from './SiteText.js';
import Purchase from './Purchase.js';
import Product from './Product.js';
import Workshop from './Workshop.js';
import Course from './Course.js';
import File from './File.js';
import Tool from './Tool.js';
import EmailLog from './EmailLog.js';
import Game from './Game.js';
import AudioFile from './AudioFile.js';
import GameAudioSettings from './GameAudioSettings.js';
import Word from './Word.js';
import WordEN from './WordEN.js';
import Image from './Image.js';
import QA from './QA.js';
import Grammar from './Grammar.js';
import ContentList from './ContentList.js';
import ContentRelationship from './ContentRelationship.js';
import SubscriptionPlan from './SubscriptionPlan.js';
import WebhookLog from './WebhookLog.js';
import PendingSubscription from './PendingSubscription.js';
import SubscriptionHistory from './SubscriptionHistory.js';
import GameSession from './GameSession.js';
import Attribute from './Attribute.js';
import GameContentTag from './GameContentTag.js';
import ContentTag from './ContentTag.js';
import School from './School.js';
import Classroom from './Classroom.js';
import StudentInvitation from './StudentInvitation.js';
import ParentConsent from './ParentConsent.js';
import ClassroomMembership from './ClassroomMembership.js';
import GameContentUsageTemplate from './GameContentUsageTemplate.js';
import GameContentRule from './GameContentRule.js';
import GameContentUsage from './GameContentUsage.js';
import GameContentRuleInstance from './GameContentRuleInstance.js';
import GameTypeContentRestriction from './GameTypeContentRestriction.js';
import Logs from './Logs.js';
import GameScatterSettings from './GameScatterSettings.js';
import GameMemorySettings from './GameMemorySettings.js';
import GameWisdomMazeSettings from './GameWisdomMazeSettings.js';
import MemoryPairingRule from './MemoryPairingRule.js';
import ManualMemoryPair from './ManualMemoryPair.js';

// Initialize models
const models = {
  sequelize, // Add sequelize instance
  User: User(sequelize),
  Settings: Settings(sequelize),
  Registration: Registration(sequelize),
  EmailTemplate: EmailTemplate(sequelize),
  Category: Category(sequelize),
  Coupon: Coupon(sequelize),
  SupportMessage: SupportMessage(sequelize),
  Notification: Notification(sequelize),
  SiteText: SiteText(sequelize),
  Purchase: Purchase(sequelize),
  Product: Product(sequelize),
  Workshop: Workshop(sequelize),
  Course: Course(sequelize),
  File: File(sequelize),
  Tool: Tool(sequelize),
  EmailLog: EmailLog(sequelize),
  Game: Game(sequelize),
  AudioFile: AudioFile(sequelize),
  GameAudioSettings: GameAudioSettings(sequelize),
  Word: Word(sequelize),
  WordEN: WordEN(sequelize),
  Image: Image(sequelize),
  QA: QA(sequelize),
  Grammar: Grammar(sequelize),
  ContentList: ContentList(sequelize),
  ContentRelationship: ContentRelationship(sequelize),
  SubscriptionPlan: SubscriptionPlan(sequelize),
  WebhookLog: WebhookLog(sequelize),
  PendingSubscription: PendingSubscription(sequelize),
  SubscriptionHistory: SubscriptionHistory(sequelize),
  GameSession: GameSession(sequelize),
  Attribute: Attribute(sequelize),
  GameContentTag: GameContentTag(sequelize),
  ContentTag: ContentTag(sequelize),
  School: School(sequelize),
  Classroom: Classroom(sequelize),
  StudentInvitation: StudentInvitation(sequelize),
  ParentConsent: ParentConsent(sequelize),
  ClassroomMembership: ClassroomMembership(sequelize),
  GameContentUsageTemplate: GameContentUsageTemplate(sequelize),
  GameContentRule: GameContentRule(sequelize),
  GameContentUsage: GameContentUsage(sequelize),
  GameContentRuleInstance: GameContentRuleInstance(sequelize),
  GameTypeContentRestriction: GameTypeContentRestriction(sequelize),
  Logs: Logs(sequelize),
  GameScatterSettings: GameScatterSettings(sequelize),
  GameMemorySettings: GameMemorySettings(sequelize),
  GameWisdomMazeSettings: GameWisdomMazeSettings(sequelize),
  MemoryPairingRule: MemoryPairingRule(sequelize),
  ManualMemoryPair: ManualMemoryPair(sequelize),
};

// Define associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});



// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
};

testConnection();

export { sequelize };
export default models;