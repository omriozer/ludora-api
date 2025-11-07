/**
 * Israeli User Analytics Service
 *
 * Specialized analytics service for tracking Israeli user behavior,
 * usage patterns, and market-specific metrics for the educational platform.
 *
 * Features:
 * - Israeli timezone-aware analytics
 * - Hebrew content engagement tracking
 * - Educational usage pattern analysis
 * - Mobile usage optimization insights
 * - Israeli holiday/school calendar impact analysis
 * - Performance metrics for Israeli connections
 * - Content preference analytics
 */

import moment from 'moment-timezone';
import crypto from 'crypto';

/**
 * Israeli market analytics constants
 */
const ISRAELI_ANALYTICS_CONFIG = {
  // Israeli timezone for accurate time-based analytics
  TIMEZONE: 'Asia/Jerusalem',

  // Israeli school schedule patterns
  SCHOOL_HOURS: {
    ELEMENTARY: { start: 8, end: 14 },
    HIGH_SCHOOL: { start: 8, end: 16 },
    UNIVERSITY: { start: 9, end: 17 }
  },

  // Israeli peak usage patterns
  USAGE_PATTERNS: {
    MORNING_PEAK: { start: 7, end: 9 },
    SCHOOL_HOURS: { start: 8, end: 16 },
    AFTERNOON_PEAK: { start: 16, end: 18 },
    EVENING_STUDY: { start: 19, end: 22 },
    WEEKEND_STUDY: { start: 10, end: 14 }
  },

  // Hebrew content analytics
  HEBREW_ANALYTICS: {
    RTL_ENGAGEMENT: true,
    READING_PATTERNS: true,
    LANGUAGE_SWITCHING: true
  },

  // Israeli mobile usage (very high in Israel)
  MOBILE_FOCUS: {
    TRACK_DEVICE_TYPE: true,
    TRACK_CONNECTION_TYPE: true,
    TRACK_SCREEN_SIZE: true,
    OPTIMIZE_FOR_MOBILE: true
  }
};

/**
 * Israeli User Analytics Service Class
 */
class IsraeliUserAnalyticsService {
  constructor() {
    this.timezone = ISRAELI_ANALYTICS_CONFIG.TIMEZONE;
    this.analytics = [];
    this.sessionData = new Map();
    this.dailyMetrics = new Map();
    this.hebrewContentMetrics = new Map();
  }

  /**
   * Track Israeli user session start
   */
  trackIsraeliSession(userId, sessionData) {
    const israelTime = moment().tz(this.timezone);
    const sessionId = this.generateSessionId(userId);

    const session = {
      sessionId,
      userId,
      startTime: israelTime.toISOString(),
      israeliLocalTime: israelTime.format('YYYY-MM-DD HH:mm:ss'),
      dayOfWeek: israelTime.format('dddd'),
      hourOfDay: israelTime.hour(),
      isWeekend: israelTime.day() === 5 || israelTime.day() === 6, // Friday/Saturday
      isSchoolHours: this.isSchoolHours(israelTime),
      isHoliday: this.isIsraeliHoliday(israelTime),

      // Device and connection info
      device: {
        type: this.detectDeviceType(sessionData.userAgent),
        isMobile: this.isMobileDevice(sessionData.userAgent),
        os: this.detectOS(sessionData.userAgent),
        browser: this.detectBrowser(sessionData.userAgent)
      },

      // Israeli-specific context
      hebrewInterface: sessionData.language === 'he' || sessionData.locale?.includes('he'),
      rtlMode: sessionData.direction === 'rtl',
      connectionQuality: this.estimateConnectionQuality(sessionData),

      // Educational context
      userType: this.inferUserType(sessionData),
      studyLevel: sessionData.studyLevel || 'unknown',

      // Tracking arrays
      pageViews: [],
      contentInteractions: [],
      hebrewContentViews: [],
      performanceMetrics: []
    };

    this.sessionData.set(sessionId, session);
    this.updateDailyMetrics(israelTime, 'sessionStart');

    return sessionId;
  }

  /**
   * Track page view with Israeli-specific analytics
   */
  trackIsraeliPageView(sessionId, pageData) {
    const session = this.sessionData.get(sessionId);
    if (!session) return null;

    const israelTime = moment().tz(this.timezone);
    const pageView = {
      timestamp: israelTime.toISOString(),
      israelTime: israelTime.format('HH:mm:ss'),
      path: pageData.path,
      title: pageData.title,
      hasHebrewContent: this.detectHebrewContent(pageData.content),
      contentType: this.inferContentType(pageData.path),
      isEducationalContent: this.isEducationalContent(pageData),

      // Performance metrics
      loadTime: pageData.loadTime,
      isSlowLoad: pageData.loadTime > 3000, // 3 seconds threshold for Israeli connections

      // Engagement prediction
      expectedEngagementTime: this.predictEngagementTime(pageData, session),

      // Israeli context
      duringPeakHours: this.isDuringPeakHours(israelTime),
      duringStudyHours: this.isDuringStudyHours(israelTime)
    };

    session.pageViews.push(pageView);

    // Track Hebrew content specifically
    if (pageView.hasHebrewContent) {
      this.trackHebrewContentEngagement(sessionId, pageView);
    }

    this.updateDailyMetrics(israelTime, 'pageView');
    return pageView;
  }

  /**
   * Track Hebrew content engagement
   */
  trackHebrewContentEngagement(sessionId, contentData) {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    const hebrewEngagement = {
      timestamp: moment().tz(this.timezone).toISOString(),
      contentId: contentData.contentId,
      contentType: contentData.contentType,
      hebrewCharacterCount: this.countHebrewCharacters(contentData.content),
      rtlFormattingUsed: contentData.isRtl,
      readingPatterns: {
        scrollDirection: contentData.scrollDirection,
        readingSpeed: this.calculateHebrewReadingSpeed(contentData),
        comprehensionIndicators: this.analyzeComprehensionIndicators(contentData)
      },
      accessibilityFeatures: {
        screenReaderUsed: contentData.screenReader,
        fontSizeAdjusted: contentData.fontSizeChange,
        contrastAdjusted: contentData.contrastChange
      }
    };

    session.hebrewContentViews.push(hebrewEngagement);
    this.updateHebrewContentMetrics(hebrewEngagement);
  }

  /**
   * Track educational content interaction
   */
  trackEducationalInteraction(sessionId, interactionData) {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    const israelTime = moment().tz(this.timezone);
    const interaction = {
      timestamp: israelTime.toISOString(),
      israelTime: israelTime.format('HH:mm:ss'),
      type: interactionData.type, // video_play, document_download, exercise_complete
      contentId: interactionData.contentId,
      subject: interactionData.subject,
      difficulty: interactionData.difficulty,

      // Time-based analysis
      timeSpent: interactionData.timeSpent,
      timeOfDay: israelTime.hour(),
      isOptimalStudyTime: this.isOptimalStudyTime(israelTime),

      // Performance indicators
      completionRate: interactionData.completionRate,
      accuracy: interactionData.accuracy,
      needsReview: interactionData.accuracy < 0.7,

      // Israeli educational context
      alignsWithCurriculum: this.checkCurriculumAlignment(interactionData.subject),
      bagrutPreparation: interactionData.subject?.includes('bagrut'),

      // Device performance impact
      devicePerformance: {
        loadTime: interactionData.loadTime,
        bufferingTime: interactionData.bufferingTime,
        errorCount: interactionData.errors?.length || 0
      }
    };

    session.contentInteractions.push(interaction);
    this.analyzeLearningPatterns(sessionId, interaction);
    this.updateDailyMetrics(israelTime, 'educationalInteraction');
  }

  /**
   * Track performance metrics for Israeli connections
   */
  trackIsraeliPerformanceMetrics(sessionId, performanceData) {
    const session = this.sessionData.get(sessionId);
    if (!session) return;

    const performance = {
      timestamp: moment().tz(this.timezone).toISOString(),

      // Network performance
      connectionSpeed: performanceData.connectionSpeed,
      latency: performanceData.latency,
      isSlowConnection: performanceData.connectionSpeed < 1000, // < 1 Mbps

      // Content delivery performance
      cdnPerformance: {
        s3LoadTime: performanceData.s3LoadTime,
        imageLoadTime: performanceData.imageLoadTime,
        videoBufferTime: performanceData.videoBufferTime
      },

      // Israeli infrastructure specific
      probableProvider: this.detectIsraeliISP(performanceData.ip),
      regionOptimized: performanceData.region === 'eu-central-1',

      // User experience impact
      ux: {
        pageRenderTime: performanceData.renderTime,
        interactivityDelay: performanceData.interactivityDelay,
        cumulativeLayoutShift: performanceData.cls,
        userFrustrationIndicators: this.detectFrustrationSignals(performanceData)
      }
    };

    session.performanceMetrics.push(performance);
    this.analyzePerformanceOptimization(performance);
  }

  /**
   * End Israeli user session and generate insights
   */
  endIsraeliSession(sessionId) {
    const session = this.sessionData.get(sessionId);
    if (!session) return null;

    const israelTime = moment().tz(this.timezone);
    const sessionDuration = moment(israelTime).diff(moment(session.startTime), 'minutes');

    // Finalize session data
    session.endTime = israelTime.toISOString();
    session.duration = sessionDuration;
    session.engagementScore = this.calculateEngagementScore(session);
    session.learningEffectiveness = this.calculateLearningEffectiveness(session);
    session.devicePerformanceScore = this.calculateDevicePerformanceScore(session);

    // Generate session insights
    const insights = this.generateSessionInsights(session);

    // Store in analytics history
    this.analytics.push({
      ...session,
      insights,
      analyzedAt: israelTime.toISOString()
    });

    // Update daily metrics
    this.updateDailyMetrics(israelTime, 'sessionEnd', {
      duration: sessionDuration,
      engagementScore: session.engagementScore,
      hebrewContentViewed: session.hebrewContentViews.length > 0
    });

    // Clean up session data
    this.sessionData.delete(sessionId);

    return { session, insights };
  }

  /**
   * Generate Israeli user behavior report
   */
  generateIsraeliUserReport(timeframe = 'week') {
    const israelTime = moment().tz(this.timezone);
    const startTime = israelTime.clone().subtract(1, timeframe);

    const relevantSessions = this.analytics.filter(session =>
      moment(session.startTime).isAfter(startTime)
    );

    return {
      generatedAt: israelTime.toISOString(),
      israelTime: israelTime.format('YYYY-MM-DD HH:mm:ss'),
      timeframe,

      // Overview metrics
      overview: {
        totalSessions: relevantSessions.length,
        totalUsers: new Set(relevantSessions.map(s => s.userId)).size,
        averageSessionDuration: this.calculateAverageSessionDuration(relevantSessions),
        totalHebrewContentViews: relevantSessions.reduce((sum, s) => sum + s.hebrewContentViews.length, 0)
      },

      // Israeli-specific insights
      israeliInsights: {
        peakUsageHours: this.analyzePeakUsageHours(relevantSessions),
        schoolHoursUsage: this.analyzeSchoolHoursUsage(relevantSessions),
        weekendVsWeekdayUsage: this.analyzeWeekendUsage(relevantSessions),
        holidayImpact: this.analyzeHolidayImpact(relevantSessions)
      },

      // Hebrew content analytics
      hebrewAnalytics: {
        hebrewContentEngagement: this.analyzeHebrewEngagement(relevantSessions),
        rtlUsagePatterns: this.analyzeRtlUsage(relevantSessions),
        accessibilityUsage: this.analyzeAccessibilityFeatures(relevantSessions)
      },

      // Educational effectiveness
      educationalMetrics: {
        averageEngagementScore: this.calculateAverageEngagement(relevantSessions),
        learningEffectiveness: this.calculateAverageLearningEffectiveness(relevantSessions),
        contentPreferences: this.analyzeContentPreferences(relevantSessions),
        curriculumAlignment: this.analyzeCurriculumAlignment(relevantSessions)
      },

      // Device and performance insights
      deviceInsights: {
        mobileUsagePercentage: this.calculateMobileUsage(relevantSessions),
        devicePerformance: this.analyzeDevicePerformance(relevantSessions),
        connectionQuality: this.analyzeConnectionQuality(relevantSessions)
      },

      // Recommendations for Israeli market optimization
      recommendations: this.generateIsraeliOptimizationRecommendations(relevantSessions)
    };
  }

  /**
   * Utility: Generate unique session ID
   */
  generateSessionId(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return crypto.createHash('md5').update(`${userId}-${timestamp}-${random}`).digest('hex').substring(0, 16);
  }

  /**
   * Utility: Detect device type from user agent
   */
  detectDeviceType(userAgent) {
    if (!userAgent) return 'unknown';

    if (/Mobile|Android|iPhone/i.test(userAgent)) return 'mobile';
    if (/iPad|Tablet/i.test(userAgent)) return 'tablet';
    if (/Desktop|Windows|Mac|Linux/i.test(userAgent)) return 'desktop';

    return 'unknown';
  }

  /**
   * Utility: Check if mobile device
   */
  isMobileDevice(userAgent) {
    return /Mobile|Android|iPhone|iPod/i.test(userAgent || '');
  }

  /**
   * Utility: Detect Hebrew content
   */
  detectHebrewContent(content) {
    if (!content) return false;
    return /[\u0590-\u05FF]/.test(content);
  }

  /**
   * Utility: Check if during Israeli school hours
   */
  isSchoolHours(time) {
    const hour = time.hour();
    const day = time.day();

    // Not school hours on Friday afternoon/Saturday
    if (day === 5 && hour >= 14) return false; // Friday afternoon
    if (day === 6) return false; // Saturday

    return hour >= 8 && hour <= 16;
  }

  /**
   * Utility: Check if during peak usage hours
   */
  isDuringPeakHours(time) {
    const hour = time.hour();
    const { MORNING_PEAK, AFTERNOON_PEAK, EVENING_STUDY } = ISRAELI_ANALYTICS_CONFIG.USAGE_PATTERNS;

    return (hour >= MORNING_PEAK.start && hour <= MORNING_PEAK.end) ||
           (hour >= AFTERNOON_PEAK.start && hour <= AFTERNOON_PEAK.end) ||
           (hour >= EVENING_STUDY.start && hour <= EVENING_STUDY.end);
  }

  /**
   * Utility: Check if during optimal study hours
   */
  isOptimalStudyTime(time) {
    const hour = time.hour();
    // Based on Israeli educational research - optimal study times
    return (hour >= 9 && hour <= 11) || (hour >= 16 && hour <= 18);
  }

  /**
   * Utility: Check if Israeli holiday (simplified)
   */
  isIsraeliHoliday(time) {
    // Simplified holiday check - in production would use proper Hebrew calendar
    const monthDay = time.format('MM-DD');
    const holidays = ['09-15', '09-16', '09-24', '04-14', '05-04']; // Major holidays
    return holidays.includes(monthDay);
  }

  /**
   * Generate session insights
   */
  generateSessionInsights(session) {
    return {
      engagement: {
        level: session.engagementScore > 0.7 ? 'high' : session.engagementScore > 0.4 ? 'medium' : 'low',
        timeOptimal: session.isSchoolHours || this.isOptimalStudyTime(moment(session.startTime).tz(this.timezone)),
        deviceOptimal: session.device.type === 'desktop' ? 'optimal' : 'mobile-optimized'
      },

      hebrewUsage: {
        hebrewContentEngaged: session.hebrewContentViews.length > 0,
        rtlModeUsed: session.rtlMode,
        languageSwitching: session.hebrewInterface
      },

      performance: {
        connectionQuality: session.performanceMetrics.length > 0 ?
          session.performanceMetrics[0].connectionSpeed > 5000 ? 'good' : 'needs-optimization' : 'unknown',
        loadTimeOptimal: session.performanceMetrics.every(p => p.cdnPerformance.s3LoadTime < 2000)
      },

      recommendations: this.generateSessionRecommendations(session)
    };
  }

  /**
   * Calculate engagement score
   */
  calculateEngagementScore(session) {
    let score = 0;

    // Time spent factor (0-0.4)
    const durationScore = Math.min(session.duration / 30, 1) * 0.4; // Up to 30 minutes
    score += durationScore;

    // Page views factor (0-0.2)
    const pageViewScore = Math.min(session.pageViews.length / 10, 1) * 0.2;
    score += pageViewScore;

    // Content interaction factor (0-0.3)
    const interactionScore = Math.min(session.contentInteractions.length / 5, 1) * 0.3;
    score += interactionScore;

    // Hebrew content engagement bonus (0-0.1)
    if (session.hebrewContentViews.length > 0) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Update daily metrics
   */
  updateDailyMetrics(time, event, data = {}) {
    const day = time.format('YYYY-MM-DD');

    if (!this.dailyMetrics.has(day)) {
      this.dailyMetrics.set(day, {
        date: day,
        sessions: 0,
        pageViews: 0,
        educationalInteractions: 0,
        hebrewContentViews: 0,
        totalDuration: 0,
        totalEngagement: 0
      });
    }

    const dayMetrics = this.dailyMetrics.get(day);

    switch (event) {
      case 'sessionStart':
        dayMetrics.sessions++;
        break;
      case 'pageView':
        dayMetrics.pageViews++;
        break;
      case 'educationalInteraction':
        dayMetrics.educationalInteractions++;
        break;
      case 'sessionEnd':
        dayMetrics.totalDuration += data.duration || 0;
        dayMetrics.totalEngagement += data.engagementScore || 0;
        if (data.hebrewContentViewed) {
          dayMetrics.hebrewContentViews++;
        }
        break;
    }
  }

  /**
   * Generate Israeli optimization recommendations
   */
  generateIsraeliOptimizationRecommendations(sessions) {
    const recommendations = [];

    // Analyze peak usage patterns
    const peakHours = this.analyzePeakUsageHours(sessions);
    if (peakHours.evening > peakHours.morning) {
      recommendations.push({
        type: 'scheduling',
        priority: 'high',
        suggestion: 'Optimize server capacity for evening study hours (19:00-22:00)',
        impact: 'performance'
      });
    }

    // Analyze mobile usage
    const mobilePercentage = this.calculateMobileUsage(sessions);
    if (mobilePercentage > 60) {
      recommendations.push({
        type: 'mobile_optimization',
        priority: 'high',
        suggestion: 'Focus on mobile-first design and performance optimization',
        impact: 'user_experience'
      });
    }

    // Hebrew content recommendations
    const hebrewEngagement = this.analyzeHebrewEngagement(sessions);
    if (hebrewEngagement.averageTime < 5) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        suggestion: 'Improve Hebrew content formatting and accessibility',
        impact: 'engagement'
      });
    }

    return recommendations;
  }

  // Additional utility methods for analytics calculations
  calculateAverageSessionDuration(sessions) {
    if (sessions.length === 0) return 0;
    return sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length;
  }

  analyzePeakUsageHours(sessions) {
    const hourCounts = {};
    sessions.forEach(session => {
      const hour = moment(session.startTime).tz(this.timezone).hour();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return {
      morning: (hourCounts[7] || 0) + (hourCounts[8] || 0) + (hourCounts[9] || 0),
      afternoon: (hourCounts[16] || 0) + (hourCounts[17] || 0) + (hourCounts[18] || 0),
      evening: (hourCounts[19] || 0) + (hourCounts[20] || 0) + (hourCounts[21] || 0)
    };
  }

  calculateMobileUsage(sessions) {
    if (sessions.length === 0) return 0;
    const mobileSessions = sessions.filter(s => s.device.isMobile);
    return (mobileSessions.length / sessions.length) * 100;
  }

  analyzeHebrewEngagement(sessions) {
    const hebrewSessions = sessions.filter(s => s.hebrewContentViews.length > 0);
    if (hebrewSessions.length === 0) return { averageTime: 0, engagement: 0 };

    const avgTime = hebrewSessions.reduce((sum, s) =>
      sum + s.hebrewContentViews.reduce((subSum, hv) => subSum + (hv.timeSpent || 0), 0), 0
    ) / hebrewSessions.length;

    return {
      averageTime: avgTime,
      engagement: hebrewSessions.length / sessions.length,
      sessionsWithHebrew: hebrewSessions.length
    };
  }
}

export default IsraeliUserAnalyticsService;