const { AsyncLocalStorage } = require("async_hooks");
const mongoose = require("mongoose");

const tenantModelContext = new AsyncLocalStorage();
const modelNames = [
  "User",
  "Admin",
  "Settings",
  "Registration",
  "Property",
  "Unit",
];
const baseModels = Object.fromEntries(
  modelNames.map((name) => [name, require(`../models/${name}`)]),
);

function getActiveModel(name, fallback) {
  return tenantModelContext.getStore()?.[name] || fallback;
}

function createModelProxy(name, fallback) {
  return new Proxy(fallback, {
    get(target, property) {
      const model = getActiveModel(name, target);
      const value = Reflect.get(model, property, model);
      return typeof value === "function" ? value.bind(model) : value;
    },
    construct(_target, args) {
      const Model = getActiveModel(name, fallback);
      return Reflect.construct(Model, args);
    },
  });
}

function createTenantModelProxies() {
  return Object.fromEntries(
    modelNames.map((name) => [name, createModelProxy(name, baseModels[name])]),
  );
}

function getTenantModels(dbName) {
  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(dbName)) {
    throw new Error("Invalid tenant database name");
  }

  const connection = mongoose.connection.useDb(dbName, { useCache: true });
  return Object.fromEntries(
    modelNames.map((name) => {
      const baseModel = baseModels[name];
      const model =
        connection.models[name] ||
        connection.model(name, baseModel.schema, baseModel.collection.name);
      return [name, model];
    }),
  );
}

function runWithTenantModels(models, next) {
  tenantModelContext.run(models, next);
}

module.exports = {
  createTenantModelProxies,
  getTenantModels,
  runWithTenantModels,
};