const { getTenantModels } = require("./tenantModels");

async function provisionClient(client) {
  const dbName = client.dbName || `tenant_${client.subdomain}`;
  const { Admin, Property, Settings, Unit } = getTenantModels(dbName);

  for (const location of client.locations || []) {
    let property = await Property.findOne({ name: location });
    if (!property) {
      property = await Property.create({
        name: location,
        propertyType: "hostel",
      });
    }

    const existingSettings = await Settings.findOne({ location });
    if (!existingSettings) {
      await Settings.create({ location, rentAmount: 0, roomCount: 10 });
    }

    const unitCount = await Unit.countDocuments({ propertyId: property._id });
    if (unitCount === 0) {
      await Unit.insertMany(
        Array.from({ length: 10 }, (_, index) => ({
          propertyId: property._id,
          location,
          unitCode: `room-${index + 1}`,
          label: `Room ${index + 1}`,
          unitType: "room",
        })),
      );
    }
  }

  let owner = await Admin.findOne({ email: client.email });
  if (!owner) {
    owner = new Admin({
      name: client.contactName,
      email: client.email,
      password: client.passwordHash,
      role: "owner",
    });
    owner.$locals.passwordAlreadyHashed = true;
    await owner.save();
  }

  return dbName;
}

module.exports = provisionClient;
