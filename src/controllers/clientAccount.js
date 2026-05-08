const prisma = require('../config/database');

async function get(req, res, next) {
  try {
    const account = await prisma.clientAccount.findFirst();
    res.json({ data: { account } });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const fields = ['owner_name','owner_email','owner_phone','billing_address','tax_number','plan','notes'];
    const data = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) data[f] = req.body[f] || null;
    });
    const account = await prisma.clientAccount.upsert({
      where: { id: 1 }, update: data, create: { id: 1, ...data },
    });
    res.json({ data: { account } });
  } catch (err) { next(err); }
}

module.exports = { get, update };
