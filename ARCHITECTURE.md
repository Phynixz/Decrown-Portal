# Backend Architecture

## Decision

The backend will remain a **modular monolith** until the product has a proven need for independently deployed services. Express is the HTTP adapter; it is not the application architecture. Business workflows live in feature modules and are callable from HTTP handlers, migration scripts, and tests without constructing an Express request.

The tenancy model remains **one platform metadata database plus one database per client**. The current shared Mongoose pool with `useDb(dbName, { useCache: true })` is appropriate for the expected 3-10 clients and light workloads. A separate connection pool per tenant is a later capacity decision, not a default abstraction today.

## Target dependency direction

```text
server.js / app.js
  -> feature routes
    -> controllers (HTTP translation only)
      -> application services (use cases and authorization decisions)
        -> repositories / tenant model factory
          -> Mongoose and external providers
```

Dependencies point inward. Services do not import Express `req`/`res`; repositories do not decide HTTP status codes; routes do not contain database queries or business rules.

## Target layout

```text
backend/
  server.js                         # process startup, signals, listen
  app.js                            # Express composition; safe to import in tests
  config/
    env.js                          # validated configuration
    database.js                     # platform connection and tenant DB factory
  infrastructure/
    db/
      schemas/                      # Mongoose schemas, not default-connection models
      tenantModelFactory.js         # models bound to one tenant DB
      tenantContext.js              # request-local tenant identity and models
    http/
      errorHandler.js
      notFound.js
      requestContext.js
    providers/
      emailProvider.js
      fileStorageProvider.js
  middleware/
    resolveTenant.js                # host -> active Client -> tenant context
    authenticatePlatform.js
    authenticateAdmin.js
    authenticateTenant.js
    validate.js
  modules/
    platform/
      platform.routes.js
      platform.controller.js
      platform.service.js
      platform.repository.js
      platform.policy.js
    onboarding/
      onboarding.routes.js
      onboarding.controller.js
      onboarding.service.js
    tenantAuth/
      tenantAuth.routes.js
      tenantAuth.controller.js
      tenantAuth.service.js
    inventory/
      inventory.routes.js
      inventory.controller.js
      inventory.service.js
      inventory.repository.js
    registrations/
      registration.routes.js
      registration.controller.js
      registration.service.js
    tenants/
      tenant.routes.js
      tenant.controller.js
      tenant.service.js
  shared/
    errors.js
    validation.js
    pagination.js
    security.js
  scripts/
    migrateLegacyTenant.js
  tests/
    unit/
    integration/
```

The existing `models/` directory can be migrated incrementally into
`infrastructure/db/schemas/`; compatibility exports may remain temporarily so
legacy tests and scripts do not need a flag-day rewrite.

## Non-negotiable boundaries

1. **Tenant resolution precedes tenant authentication.** A token is valid only when its `clientId` matches the resolved tenant. No tenant route may select a database from request body, query string, or token alone.
2. **Tenant context is explicit at the infrastructure boundary.** The request-local store contains `{ client, dbName, models }`. Application services receive a tenant context or tenant repositories; they do not reach into global model proxies as an accidental dependency.
3. **Platform metadata and tenant data never share repositories.** Platform routes use `Client`, `PlatformAdmin`, `PlatformStaff`, and `PlatformAudit`. Tenant routes use models created by the tenant model factory.
4. **Controllers translate, services decide.** A controller validates the request shape, invokes one service method, and maps the result to a response. It must not contain provisioning loops, occupancy rules, password policy, or audit construction.
5. **One error boundary.** Services throw typed application errors. The HTTP error middleware maps them to status codes. Route-level `try/catch` blocks are removed except where a response must stream or download.
6. **Startup is separate from app construction.** Importing `app.js` must not connect to MongoDB, seed data, start a server, or create an in-memory database. This makes integration tests and health checks deterministic.
7. **Configuration is validated once.** Environment parsing and production requirements belong in `config/env.js`, not at module load across routes and utilities.
8. **External providers are ports.** Email and file storage are injected into services so tests can use fakes and provider changes do not spread through controllers.

## Migration order

1. Add `config/env.js`, `config/database.js`, `app.js`, and a small `server.js` startup wrapper without changing endpoint behavior.
2. Move shared sanitizers, JWT checks, and error handling into `shared/` and `middleware/`; preserve current response contracts.
3. Extract tenant authentication, tenant portal, registration, and inventory routes from `server.js` into feature modules. Keep route paths unchanged.
4. Split `routes/platform.js` into platform onboarding, staff, audit, and cross-tenant management modules. Move provisioning and tenant-management queries into services.
5. Replace the implicit model proxy dependency with an explicit tenant model factory/context API. Keep a compatibility adapter until all routes migrate.
6. Move the legacy migration script to use the same application services and repositories as onboarding.
7. Add contract tests for tenant mismatch, missing tenant context, cross-tenant reads, and service-level authorization.
8. Only then consider separate worker processes for email, exports, and recurring billing.

## What not to introduce yet

- Microservices or a message broker before there are independent scaling or ownership needs.
- A generic `BaseController`, `BaseService`, or `BaseRepository`; those abstractions hide domain differences and create the framework-like coupling we are trying to remove.
- A shared `tenantId` filter as a replacement for database isolation. The current separate-database boundary is stronger for sensitive tenant documents.
- A second authentication provider. Platform staff, tenant admins, and tenant users remain separate principals with separate policies.

## Research basis

- Express recommends mountable `express.Router` modules for modular routing.
- Mongoose documents `useDb(..., { useCache: true })` as the simpler multi-tenant pattern for a small number of light-workload tenants, and recommends schema exports when models span multiple connections.
- Node documents `AsyncLocalStorage.run()` for request-scoped async context and specifically recommends `run()` over `enterWith()` for isolation.
