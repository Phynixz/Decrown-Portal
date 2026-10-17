const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");

// End-to-end coverage for two tenant-facing flows that run against the real
// server.js app: document re-upload (previously crashed with a ReferenceError)
// and public registration receipt numbering (previously regressed after
// record deletions).
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Environment must be prepared BEFORE requiring server.js: it decides multer
// storage, email delivery, DB target, and tenant resolution at load time.
process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.JWT_SECRET = "tenant-reupload-test-secret-0123456789";
process.env.PLATFORM_ADMIN_NAME = "Reupload Test Owner";
process.env.PLATFORM_ADMIN_EMAIL = "owner-reupload-test@example.test";
process.env.PLATFORM_ADMIN_PASSWORD = "owner-reupload-test-password";
process.env.PLATFORM_ROOT_DOMAIN = "";
process.env.RESEND_API_KEY = "";
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";

let mongo;
let httpServer;
let baseUrl;
let User;
let Property;
let Settings;
let Unit;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();

  const app = require("../server.js");
  httpServer = await app.startup;
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  User = require("../models/User");
  Property = require("../models/Property");
  Settings = require("../models/Settings");
  Unit = require("../models/Unit");
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

function reuploadForm(field, filename) {
  const form = new FormData();
  form.append("field", field);
  form.append(
    "file",
    new Blob([Buffer.from("fake-image-bytes")], { type: "image/png" }),
    filename,
  );
  return form;
}

test("tenant document re-upload succeeds and logs the change", async () => {
  const user = await new User({
    location: "Malete",
    name: "Reupload Test Tenant",
    email: "reupload-tenant@example.test",
    phone: "080123456789",
    session: "2026/2027",
    roomNo: "Room 99",
    canReuploadPassport: true,
    reuploadExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }).save();

  const token = jwt.sign(
    { id: user._id, email: user.email, type: "tenant" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  const response = await fetch(`${baseUrl}/tenant/reupload`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: reuploadForm("passport", "passport.png"),
  });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.message, "Document updated successfully");

  const updated = await User.findById(user._id);
  assert.equal(updated.canReuploadPassport, false);
  assert.equal(updated.changeLog.length, 1);
  assert.equal(updated.changeLog[0].field, "passport");
  assert.equal(updated.canReuploadPassport, false);
  assert.equal(updated.reuploadExpiresAt, null);

  // The permission flag was consumed — a second upload must be rejected.
  const denied = await fetch(`${baseUrl}/tenant/reupload`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: reuploadForm("passport", "passport-again.png"),
  });
  assert.equal(denied.status, 403);
});

function registrationForm({
  email,
  phone,
  roomNo,
  location = "Malete",
  state = "Kwara",
  lga = "Moro",
}) {
  const form = new FormData();
  form.append("location", location);
  form.append("state", state);
  form.append("lga", lga);
  form.append("name", "Receipt Test Tenant");
  form.append("email", email);
  form.append("phone", phone);
  form.append("guardianName", "Receipt Guardian");
  form.append("guardianPhone", "08098765432");
  form.append("level", "100");
  form.append("roomNo", roomNo);
  form.append("paymentDate", "2026-10-11");
  form.append("termsAccepted", "true");
  for (const field of ["passport", "idCard", "paymentProof"]) {
    form.append(
      field,
      new Blob([Buffer.from("fake-image-bytes")], { type: "image/png" }),
      `${field}.png`,
    );
  }
  return form;
}

test("registration issues monotonic receipt numbers", async () => {
  // Legacy De-Crown campuses must remain selectable without an in-place data
  // migration. Their known geography is supplied by the compatibility layer.
  const configResponse = await fetch(`${baseUrl}/tenant-config`);
  const config = await configResponse.json();
  const malete = config.locations.find((location) => location.name === "Malete");
  assert.equal(malete.state, "Kwara");
  assert.equal(malete.lga, "Moro");

  const year = new Date().getFullYear();

  const first = await fetch(`${baseUrl}/submit`, {
    method: "POST",
    body: registrationForm({
      email: "receipt-one@example.test",
      phone: "08011112222",
      roomNo: "Room 5",
    }),
  });
  const firstBody = await first.json();
  assert.equal(first.status, 200, JSON.stringify(firstBody));

  const second = await fetch(`${baseUrl}/submit`, {
    method: "POST",
    body: registrationForm({
      email: "receipt-two@example.test",
      phone: "08033334444",
      roomNo: "Room 6",
    }),
  });
  const secondBody = await second.json();
  assert.equal(second.status, 200, JSON.stringify(secondBody));

  const User = require("../models/User");
  const one = await User.findOne({ email: "receipt-one@example.test" }).lean();
  const two = await User.findOne({ email: "receipt-two@example.test" }).lean();
  assert.equal(one.receiptNumber, `DCM-${year}-0001`);
  assert.equal(two.receiptNumber, `DCM-${year}-0002`);
});

test("new hostels expose available rooms and accept tenant applications", async () => {
  const property = await Property.create({
    name: "New Flow Test Hostel",
    state: "Kwara",
    lga: "Ilorin West",
    propertyType: "hostel",
    address: "Test Street",
  });
  await Settings.create({
    location: property.name,
    rentAmount: 220000,
    roomCount: 1,
  });
  const unit = await Unit.create({
    propertyId: property._id,
    location: property.name,
    unitCode: "room-1",
    label: "Room 1",
    unitType: "room",
  });

  const configResponse = await fetch(`${baseUrl}/tenant-config`);
  const config = await configResponse.json();
  const listing = config.locations.find(
    (item) => item.name === property.name,
  );
  assert.equal(listing.state, "Kwara");
  assert.equal(listing.lga, "Ilorin West");
  assert.equal(listing.units.find((item) => String(item.id) === String(unit._id)).status, "available");

  const amountResponse = await fetch(
    `${baseUrl}/current-amount?location=${encodeURIComponent(property.name)}&unit=Room%201`,
  );
  assert.equal(amountResponse.status, 200);
  assert.equal((await amountResponse.json()).amount, 220000);

  const submitResponse = await fetch(`${baseUrl}/submit`, {
    method: "POST",
    body: registrationForm({
      email: "new-hostel-tenant@example.test",
      phone: "08055556666",
      roomNo: "Room 1",
      location: property.name,
      state: "Kwara",
      lga: "Ilorin West",
    }),
  });
  const submitBody = await submitResponse.json();
  assert.equal(submitResponse.status, 200, JSON.stringify(submitBody));

  const saved = await User.findOne({ email: "new-hostel-tenant@example.test" });
  assert.equal(String(saved.propertyId), String(property._id));
  assert.equal(String(saved.unitId), String(unit._id));
  assert.equal(saved.amount, 220000);

  const updatedConfig = await (await fetch(`${baseUrl}/tenant-config`)).json();
  const updatedListing = updatedConfig.locations.find(
    (item) => item.name === property.name,
  );
  assert.equal(updatedListing.units[0].status, "occupied");
});
