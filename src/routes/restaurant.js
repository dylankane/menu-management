// src/routes/restaurant.js
const express         = require('express');
const controller      = require('../controllers/restaurant');
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

// Contact
router.get('/contact',     controller.getContact);
router.put('/contact',     controller.updateContact);

// Opening hours
router.get('/opening-hours',  controller.getOpeningHours);
router.put('/opening-hours',  controller.updateOpeningHours);

// Overrides
router.get('/opening-hours/overrides',      controller.getOverrides);
router.post('/opening-hours/overrides',     controller.createOverride);
router.delete('/opening-hours/overrides/:id', controller.deleteOverride);

// Announcement
router.get('/announcement', controller.getAnnouncement);
router.put('/announcement', upload('announcement_image'), controller.updateAnnouncement);

module.exports = router;
