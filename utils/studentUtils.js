import models from '../models/index.js';

/**
 * Student utility functions for unified User system
 * All students are now Users with user_type: 'player'
 * This maintains backward compatibility while using the unified system
 */

/**
 * Check if an ID belongs to a Player (legacy function for compatibility)
 * In the unified system, this is determined by user_type, not ID format
 * @param {string} id - The ID to check
 * @returns {boolean} Always returns false in unified system (kept for compatibility)
 */
export function isPlayerId(id) {
  // In unified system, we don't distinguish by ID format
  // All students are users with user_type: 'player'
  return false;
}

/**
 * Get the student entity by ID
 * In unified system, all students are Users with user_type: 'player'
 * @param {string} studentId - The student ID to look up
 * @param {Object} options - Sequelize query options (transaction, include, etc.)
 * @returns {Promise<Object|null>} The User entity, or null if not found
 */
export async function getStudentById(studentId, options = {}) {
  if (!studentId) {
    return null;
  }

  return await models.User.findOne({
    where: {
      id: studentId,
      user_type: 'player'
    },
    ...options
  });
}

/**
 * Get the student entity type (legacy function for compatibility)
 * In unified system, all students are 'player' type users
 * @param {string} studentId - The student ID to analyze
 * @returns {string} Always returns 'player' in unified system
 */
export function getStudentEntityType(studentId) {
  return 'player';
}

/**
 * Get display name for any student
 * @param {string} studentId - The student ID
 * @returns {Promise<string|null>} Display name or null if not found
 */
export async function getStudentDisplayName(studentId, options = {}) {
  const student = await getStudentById(studentId, options);
  if (!student) {
    return null;
  }

  return student.first_name || student.full_name || student.email?.split('@')[0] || 'Student';
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
  if (!teacherId) {
    return false;
  }

  const teacher = await models.User.findOne({
    where: {
      id: teacherId,
      user_type: 'teacher',
      is_active: true
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