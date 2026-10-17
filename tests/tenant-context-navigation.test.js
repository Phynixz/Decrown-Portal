const test = require("node:test");
const assert = require("node:assert/strict");
const resolveTenant = require("../utils/tenantContext");

test("HTML page navigations bypass stale tenant-cookie resolution", async () => {
  let nextCalls = 0;
  const req = {
    method: "GET",
    path: "/rooms",
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9" },
  };

  await resolveTenant(req, {}, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(req.tenantClient, undefined);
});

test("non-document requests still go through tenant resolution", async () => {
  const previousRootDomain = process.env.PLATFORM_ROOT_DOMAIN;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.PLATFORM_ROOT_DOMAIN;
  process.env.NODE_ENV = "test";

  try {
    let nextCalls = 0;
    const req = {
      method: "GET",
      path: "/tenant-config",
      headers: { accept: "*/*" },
    };

    await resolveTenant(req, {}, () => {
      nextCalls += 1;
    });

    assert.equal(nextCalls, 1);
  } finally {
    if (previousRootDomain === undefined) delete process.env.PLATFORM_ROOT_DOMAIN;
    else process.env.PLATFORM_ROOT_DOMAIN = previousRootDomain;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
