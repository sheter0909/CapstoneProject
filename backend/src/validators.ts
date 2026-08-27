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

export const login = [
  body('identifier').trim().notEmpty().withMessage('Identifier (Email / ID) is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
];

export const accountFields = [
  body('householdId').trim().notEmpty().withMessage('Household ID is required.'),
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

export const collectionFields = [
  body('householdId').trim().notEmpty().withMessage('Household ID is required.'),
  body('segregationStatus').isIn(['segregated', 'not_segregated']).withMessage('Segregation status must be segregated or not_segregated.'),
  body('wasteType').isIn(['biodegradable', 'recyclable', 'non_biodegradable', 'non-biodegradable']).withMessage('Waste type must be biodegradable, recyclable, or non-biodegradable.'),
  body('weightKg').isFloat({ min: 0, max: 15 }).withMessage('Weight must be a number between 0 and 15 kg.').toFloat(),
];
