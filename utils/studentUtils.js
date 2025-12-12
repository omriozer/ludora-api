import models from '../models/index.js';

/**
 * Student utility functions for handling unified Player/User system
 * Players are anonymous students with privacy codes
 * Users are authenticated students with Firebase/Google accounts
 * Both are functionally equivalent but use different authentication methods
 */

/**
 * Check if an ID belongs to a Player (anonymous student)
 * Player IDs always start with "player_"
 * @param {string} id - The ID to check
 * @returns {boolean} True if the ID is for a Player
 */
export function isPlayerId(id) {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return id.startsWith('player_');
}

/**
 * Get the student entity (Player or User) by ID
 * Automatically detects the type based on ID format and queries appropriate model
 * @param {string} studentId - The student ID to look up
 * @param {Object} options - Sequelize query options (transaction, include, etc.)
 * @returns {Promise<Object|null>} The Player or User entity, or null if not found
 */
export async function getStudentById(studentId, options = {}) {
  if (!studentId) {
    return null;
  }

  if (isPlayerId(studentId)) {
    return await models.Player.findByPk(studentId, options);
  } else {
    return await models.User.findByPk(studentId, options);
  }
}

/**
 * Get the student entity type based on ID
 * @param {string} studentId - The student ID to analyze
 * @returns {string} 'player' or 'user'
 */
export function getStudentEntityType(studentId) {
  return isPlayerId(studentId) ? 'player' : 'user';
}

/**
 * Get display name for any student (Player or User)
 * @param {string} studentId - The student ID
 * @returns {Promise<string|null>} Display name or null if not found
 */
export async function getStudentDisplayName(studentId, options = {}) {
  const student = await getStudentById(studentId, options);
  if (!student) {
    return null;
  }

  return student.display_name || student.name || student.email?.split('@')[0] || 'Student';
}

/**
 * Check if a student ID is valid and exists in the database
 * @param {string} studentId - The student ID to validate
 * @returns {Promise<boolean>} True if the student exists
 */
export async function isValidStudentId(studentId) {
  if (!studentId) {
    return false;
  }

  const student = await getStudentById(studentId);
  return student !== null;
}

/**
 * Get all ClassroomMembership records for a student
 * Works for both Players and Users
 * @param {string} studentId - The student ID (Player or User)
 * @param {Object} options - Sequelize query options
 * @returns {Promise<Array>} Array of ClassroomMembership records
 */
export async function getStudentClassroomMemberships(studentId, options = {}) {
  if (!studentId) {
    return [];
  }

  return await models.ClassroomMembership.findAll({
    where: { student_id: studentId },
    ...options
  });
}

/**
 * Check if a student is already connected to a teacher
 * Looks for ClassroomMembership with NULL classroom_id (teacher connection without specific classroom)
 * @param {string} studentId - The student ID (Player or User)
 * @param {string} teacherId - The teacher's User ID
 * @returns {Promise<Object|null>} ClassroomMembership record if connection exists, null otherwise
 */
export async function getStudentTeacherConnection(studentId, teacherId, options = {}) {
  if (!studentId || !teacherId) {
    return null;
  }

  return await models.ClassroomMembership.findOne({
    where: {
      student_id: studentId,
      teacher_id: teacherId,
      classroom_id: null  // Teacher connection without specific classroom
    },
    ...options
  });
}

/**
 * Get all teachers connected to a student
 * @param {string} studentId - The student ID (Player or User)
 * @returns {Promise<Array>} Array of teacher User objects
 */
export async function getStudentTeachers(studentId, options = {}) {
  if (!studentId) {
    return [];
  }

  const memberships = await models.ClassroomMembership.findAll({
    where: { student_id: studentId },
    include: [{
      model: models.User,
      as: 'Teacher',
      where: { user_type: 'teacher' }
    }],
    ...options
  });

  return memberships.map(m => m.Teacher);
}

/**
 * Validate that a teacher ID belongs to a valid teacher User
 * @param {string} teacherId - The teacher's User ID
 * @returns {Promise<boolean>} True if valid teacher
 */
export async function isValidTeacherId(teacherId) {
  if (!teacherId || isPlayerId(teacherId)) {
    return false; // Teachers are always Users, never Players
  }

  const teacher = await models.User.findOne({
    where: {
      id: teacherId,
      user_type: 'teacher'
    }
  });

  return teacher !== null;
}

export default {
  isPlayerId,
  getStudentById,
  getStudentEntityType,
  getStudentDisplayName,
  isValidStudentId,
  getStudentClassroomMemberships,
  getStudentTeacherConnection,
  getStudentTeachers,
  isValidTeacherId
};