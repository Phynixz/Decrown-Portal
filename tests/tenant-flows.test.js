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
let Admin;
let Client;
let getTenantModels;

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
  Admin = require("../models/Admin");
  Client = require("../models/Client");
  ({ getTenantModels } = require("../utils/tenantModels"));
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
  location = "Test Hostel",
  state = "Test State",
  lga = "Test LGA",
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
  const property = await Property.create({
    name: "Test Hostel",
    propertyType: "hostel",
    status: "active",
    state: "Test State",
    lga: "Test LGA",
  });
  await Settings.create({ location: property.name, rentAmount: 100000, roomCount: 2 });
  await Unit.insertMany([
    { propertyId: property._id, location: property.name, unitCode: "room-5", label: "Room 5", unitType: "room" },
    { propertyId: property._id, location: property.name, unitCode: "room-6", label: "Room 6", unitType: "room" },
  ]);

  // Property choices come from persisted property records; no campus defaults
  // are seeded for a fresh database.
  const configResponse = await fetch(`${baseUrl}/tenant-config`);
  const config = await configResponse.json();
  assert.equal(
    config.locations.some((location) => ["Malete", "Ila-Orangun"].includes(location.name)),
    false,
    "fresh test database should not contain hardcoded campus properties",
  );

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
  assert.equal(one.receiptNumber, `TES-${year}-0001`);
  assert.equal(two.receiptNumber, `TES-${year}-0002`);
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

function documentUpload(fields, fileFields) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  for (const field of fileFields) {
    form.append(field, new Blob([Buffer.from("fake-image-bytes")], { type: "image/png" }), `${field}.png`);
  }
  return form;
}

test("tenant account application gates agreement, payment, and allocation", async () => {
  const suffix = Date.now().toString();
  const email = `account-${suffix}@example.test`;
  const signup = await fetch(`${baseUrl}/tenant/account/signup?client=stale-landlord-subdomain`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Account Test Tenant", email, password: "secure-test-password-123" }),
  });
  const signupBody = await signup.json();
  assert.equal(signup.status, 201, JSON.stringify(signupBody));
  assert.ok(signupBody.token);

  const duplicateSignup = await fetch(`${baseUrl}/tenant/account/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Account Test Tenant", email, password: "secure-test-password-123" }),
  });
  assert.equal(duplicateSignup.status, 409);

  const wrongPassword = await fetch(`${baseUrl}/tenant/account/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  assert.equal(wrongPassword.status, 401);

  const property = await Property.create({ name: `Account Flow Hostel ${suffix}`, state: "Kwara", lga: "Ilorin West", propertyType: "hostel" });
  await Settings.create({ location: property.name, rentAmount: 240000, roomCount: 1 });
  const unit = await Unit.create({ propertyId: property._id, location: property.name, unitCode: `account-${suffix}`, label: "Room A1", rentAmount: 240000, status: "available" });
  const token = `Bearer ${signupBody.token}`;
  const applicationResponse = await fetch(`${baseUrl}/tenant/account/applications`, {
    method: "POST", headers: { Authorization: token },
    body: documentUpload({ phone: "08012345678", guardianName: "Test Guardian", guardianPhone: "08098765432", matricNumber: "KWASU/CSC/1234", level: "300", state: "Kwara", lga: "Ilorin West", propertyId: String(property._id), unitId: String(unit._id), termsAccepted: "true" }, ["passport", "idCard"]),
  });
  const applicationBody = await applicationResponse.json();
  assert.equal(applicationResponse.status, 201, JSON.stringify(applicationBody));
  assert.equal(applicationBody.application.status, "under_review");
  assert.equal((await Unit.findById(unit._id)).applicationHoldId, null, "application submission must not reserve or allocate the room");

  const account = await require("../models/TenantAccount").findOne({ email });
  const application = await require("../models/TenantApplication").findOne({ tenantAccountId: account._id });
  const admin = await new Admin({ name: "Application Review Admin", email: `review-${suffix}@example.test`, password: "admin-password-123", role: "admin" }).save();
  const adminToken = `Bearer ${jwt.sign({ id: admin._id, email: admin.email, role: admin.role, type: "admin" }, process.env.JWT_SECRET, { expiresIn: "1h" })}`;

  const lockedPayment = await fetch(`${baseUrl}/tenant/account/applications/${application._id}/payment`, { method: "POST", headers: { Authorization: token }, body: documentUpload({}, ["file"]) });
  assert.equal(lockedPayment.status, 403, "payment must remain locked before agreement review");

  const requestAgreement = await fetch(`${baseUrl}/admin/tenant-applications/${application._id}/status`, { method: "PUT", headers: { Authorization: adminToken, "Content-Type": "application/json" }, body: JSON.stringify({ status: "agreement_requested" }) });
  assert.equal(requestAgreement.status, 200);
  const agreement = await fetch(`${baseUrl}/tenant/account/applications/${application._id}/agreement`, { method: "POST", headers: { Authorization: token }, body: documentUpload({}, ["file"]) });
  assert.equal(agreement.status, 200);
  const unlockPayment = await fetch(`${baseUrl}/admin/tenant-applications/${application._id}/status`, { method: "PUT", headers: { Authorization: adminToken, "Content-Type": "application/json" }, body: JSON.stringify({ status: "payment_unlocked" }) });
  assert.equal(unlockPayment.status, 200);
  assert.ok((await Unit.findById(unit._id)).applicationHoldId, "accepted agreement should hold the room during payment verification");
  const heldListing = await (await fetch(`${baseUrl}/tenant-config`)).json();
  assert.equal(heldListing.locations.find((item) => item.name === property.name).units[0].status, "occupied", "a payment-held room must disappear from public availability");
  const legacyAttempt = await fetch(`${baseUrl}/submit`, { method: "POST", body: registrationForm({ email: `legacy-${suffix}@example.test`, phone: "08055554444", roomNo: "Room A1", location: property.name, state: "Kwara", lga: "Ilorin West" }) });
  assert.equal(legacyAttempt.status, 400, "legacy registration must not bypass an application room hold");

  const payment = await fetch(`${baseUrl}/tenant/account/applications/${application._id}/payment`, { method: "POST", headers: { Authorization: token }, body: documentUpload({ paymentDate: "2026-10-17" }, ["file"]) });
  assert.equal(payment.status, 200);
  assert.equal((await require("../models/TenantApplication").findById(application._id)).status, "payment_submitted");
  assert.equal(await User.countDocuments({ email }), 0, "payment proof upload alone must not create an allocated tenant record");

  const verifyPayment = await fetch(`${baseUrl}/admin/tenant-applications/${application._id}/verify-payment`, { method: "PUT", headers: { Authorization: adminToken } });
  const verifyBody = await verifyPayment.json();
  assert.equal(verifyPayment.status, 200, JSON.stringify(verifyBody));
  assert.equal((await require("../models/TenantApplication").findById(application._id)).status, "allocated");
  assert.equal((await User.findOne({ email })).roomNo, "Room A1");
  assert.equal((await Unit.findById(unit._id)).status, "inactive");
});

test("landlord can sign in after email verification", async () => {
  const email = `verified-${Date.now()}@example.test`;
  const payload = { contactName: "Verified Landlord", email, password: "landlord-password-123" };
  const signup = await fetch(`${baseUrl}/client/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const created = await signup.json();
  assert.equal(signup.status, 200, JSON.stringify(created));
  const verify = await fetch(`${baseUrl}/client/verify-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: created.clientId, code: created.developmentCode }) });
  assert.equal(verify.status, 200);
  const login = await fetch(`${baseUrl}/admin/login?client=${created.subdomain}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: payload.password }) });
  const result = await login.json();
  assert.equal(login.status, 200, JSON.stringify(result));
  assert.equal(result.role, "owner");
});

test("approved landlord rooms appear in public search and applications use the landlord workspace", async () => {
  const suffix = Date.now().toString();
  const client = await Client.create({
    businessName: `Catalogue Landlord ${suffix}`,
    contactName: "Catalogue Landlord",
    email: `catalogue-${suffix}@example.test`,
    passwordHash: "unused-test-hash",
    subdomain: `catalogue-${suffix}`,
    status: "active",
    verified: true,
    dbName: `tenant_catalogue_${suffix}`,
  });
  const models = getTenantModels(client.dbName);
  const property = await models.Property.create({
    name: `Catalogue Hostel ${suffix}`,
    state: "Kwara",
    lga: "Ilorin West",
    propertyType: "hostel",
    status: "pending_review",
  });
  const unit = await models.Unit.create({
    propertyId: property._id,
    location: property.name,
    unitCode: `catalogue-room-${suffix}`,
    label: "Room C1",
    rentAmount: 150000,
    status: "available",
  });

  const pendingConfig = await (await fetch(`${baseUrl}/tenant-config`)).json();
  assert.equal(pendingConfig.locations.some((item) => item.name === property.name), false, "unapproved properties stay hidden");

  property.status = "active";
  property.reviewedAt = new Date();
  await property.save();
  const publicConfig = await (await fetch(`${baseUrl}/tenant-config`)).json();
  const listed = publicConfig.locations.find((item) => item.name === property.name);
  assert.ok(listed, "approved property should be included in public catalogue");
  assert.equal(String(listed.clientId), String(client._id));
  assert.equal(listed.units[0].label, "Room C1");

  const signup = await fetch(`${baseUrl}/tenant/account/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Catalogue Tenant", email: `tenant-${suffix}@example.test`, password: "catalogue-tenant-password" }),
  });
  const tenant = await signup.json();
  assert.equal(signup.status, 201, JSON.stringify(tenant));
  const application = await fetch(`${baseUrl}/tenant/account/applications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tenant.token}` },
    body: documentUpload({
      phone: "08012345678", guardianName: "Catalogue Guardian", guardianPhone: "08098765432",
      matricNumber: "KWASU/CSC/CATALOGUE", level: "300", state: "Kwara", lga: "Ilorin West",
      propertyId: String(property._id), unitId: String(unit._id), clientId: String(client._id), termsAccepted: "true",
    }, ["passport", "idCard"]),
  });
  const applicationBody = await application.json();
  assert.equal(application.status, 201, JSON.stringify(applicationBody));
  const savedApplication = await require("../models/TenantApplication").findById(applicationBody.application.id);
  assert.equal(String(savedApplication.sourceClientId), String(client._id));

  const admin = await new Admin({ name: "Catalogue Admin", email: `catalogue-admin-${suffix}@example.test`, password: "admin-password-123", role: "admin" }).save();
  const adminToken = `Bearer ${jwt.sign({ id: admin._id, email: admin.email, role: admin.role, type: "admin", clientId: String(client._id) }, process.env.JWT_SECRET, { expiresIn: "1h" })}`;
  const review = await fetch(`${baseUrl}/admin/tenant-applications/${savedApplication._id}/status?client=${client.subdomain}`, {
    method: "PUT",
    headers: { Authorization: adminToken, "Content-Type": "application/json" },
    body: JSON.stringify({ status: "agreement_requested" }),
  });
  assert.equal(review.status, 200, await review.text());
  assert.equal((await models.Unit.findById(unit._id)).applicationHoldId, null, "requesting an agreement must not hold the room yet");
});
