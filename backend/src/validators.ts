import { body, query, param } from 'express-validator';

export const password = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters.');

export const birthdate = body('birthdate')
  .optional({ values: 'falsy' })
  .custom((value) => {
    if (!value) return true;
    const date = new Date(value);
    if (isNaN(date.getTime())) {

      throw new Error('Birthdate must be a valid date (YYYY-MM-DD).');
    }
    return true;
  });

export const pagination = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.').toInt(),
];

export const idParam = param('id').trim().notEmpty().withMessage('ID parameter is required.');

// Collector household lookup (?householdId=...): IDs are opaque strings —
// leading zeros are significant, so never coerce to a number here.
export const householdIdQuery = query('householdId')
  .trim()
  .notEmpty()
  .withMessage('Household ID is required.')
  .isLength({ max: 64 })
  .withMessage('Household ID is too long.');

export const login = [
  body('identifier').trim().notEmpty().withMessage('Identifier (Email / ID) is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

export const accountFields = [
  body('householdId').optional().trim(),
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('purok').trim().notEmpty().withMessage('Purok is required.'),
  body('address').optional().trim(),
  birthdate,
];

export const collectorFields = [
  body('collectorId').optional().trim(),
  body('fullName').trim().notEmpty().withMessage('Full name is required.'),
  body('assignedArea').trim().notEmpty().withMessage('Assigned area is required.'),
  body('contactNumber').optional().trim(),
  birthdate,
];

export const notificationFields = [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 120 }).withMessage('Title must be at most 120 characters.'),
  body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 2000 }).withMessage('Message must be at most 2000 characters.'),
  body('recipientType')
    .isIn(['household', 'collector', 'admin', 'all-households', 'all-collectors', 'purok-households', 'purok-collectors'])
    .withMessage('Recipient type must be one of: household, collector, admin, all-households, all-collectors, purok-households, purok-collectors.'),
  body('householdId').optional().trim(),
  body('collectorId').optional().trim(),
  body('reportReason').optional().trim(),
  body('targetPurok').optional().trim().isLength({ max: 100 }).withMessage('Purok name must be at most 100 characters.'),
  body('level').optional().trim(),
];

export const editAnnouncementFields = [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 120 }).withMessage('Title must be at most 120 characters.'),
  body('message').trim().notEmpty().withMessage('Message is required.').isLength({ max: 2000 }).withMessage('Message must be at most 2000 characters.'),
  body('level').optional().trim(),
];

export const collectionFields = [
  body('householdId').trim().notEmpty().withMessage('Household ID is required.'),
  body('segregationStatus').isIn(['segregated', 'not_segregated']).withMessage('Segregation status must be segregated or not_segregated.'),
  body('wasteType')
    .optional({ values: 'falsy' })
    .custom((value, { req }) => {
      if (req.body?.segregationStatus === 'not_segregated') return true;
      if (!value) throw new Error('Choose a waste type.');
      if (!['biodegradable', 'recyclable', 'non_biodegradable'].includes(String(value))) {
        throw new Error('Waste type must be biodegradable, recyclable, or non-biodegradable.');
      }
      return true;
    }),
  body('weightKg').customSanitizer((value) => String(value)).isFloat({ min: 0, max: 15 }).withMessage('Weight must be a number between 0 and 15 kg.').toFloat(),
];
