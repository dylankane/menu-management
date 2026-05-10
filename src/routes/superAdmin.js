const express = require('express');
const prisma   = require('../config/database');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireSuperAdmin);

router.put('/config', async (req, res, next) => {
  try {
    const { has_menu, has_restaurant_hub, has_gourmet_club, max_languages } = req.body;
    const account = await prisma.clientAccount.upsert({
      where:  { id: 1 },
      update: {
        has_menu:           Boolean(has_menu),
        has_restaurant_hub: Boolean(has_restaurant_hub),
        has_gourmet_club:   Boolean(has_gourmet_club),
        max_languages:      Math.max(2, parseInt(max_languages, 10) || 3),
      },
      create: {
        id: 1,
        has_menu:           Boolean(has_menu),
        has_restaurant_hub: Boolean(has_restaurant_hub),
        has_gourmet_club:   Boolean(has_gourmet_club),
        max_languages:      Math.max(2, parseInt(max_languages, 10) || 3),
      },
    });
    res.json({ data: { account } });
  } catch (err) { next(err); }
});

module.exports = router;
