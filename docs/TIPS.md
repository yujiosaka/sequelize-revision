# TIPS

- [Migrate from Sequelize Paper Trail](#migrate-from-sequelize-paper-trail)
- [Create model tables](#create-model-tables)
- [Enable debug logging](#enable-debug-logging)
- [User tracking](#user-tracking)
- [Disable logging for a single call](#disable-logging-for-a-single-call)
- [Saving meta data](#saving-meta-data)
- [Exclude attributes](#exclude-attributes)

## Migrate from Sequelize Paper Trail

Sequelize Revision supports most options provided by [Sequelize Paper Trail](https://github.com/nielsgl/sequelize-paper-trail) and you can use the same table schema.

There are 3 steps to complete the migration.

1. First, change the module import and initialization statement.

```typescript
// From:
import * as SequelizePaperTrail from "sequelize-paper-trail";
const sequelizePaperTrail = SequelizePaperTrail.init(sequelize, options);

// To:
import { SequelizeRevision } from "sequelize-revision";
const sequelizeRevision = new SequelizeRevision(sequelize, options);
```

Please note that following two options are not supported by Sequelize Revision.

- **[debug]**: The option is replaced with the [debug](https://github.com/visionmedia/debug) module. See [Enable debug logging](#enable-debug-logging) for the instruction.
- **[defaultAttributes]**: Use **[revisionIdAttribute]** option instead to modify the attribute name of the forein key to the `Revision` model.

Sequelize Revision does not support modifying the attribute name of the document"s foreign key.

2. Then, change the way to access `Revision` and `RevisionChange` models.

```typescript
// From:
const db = {}
sequelizePaperTrail.defineModels(db);
const { Revision, RevisionChange } = db;

// To:
const { Revision, RevisionChange } = sequelizeRevision.defineModels();
```

3. Finally, change the way to track revisions on your models.

```typescript
// From:
Model.hasPaperTrail();

// To:
sequelizeRevision.trackRevision(Model);
```

## Create model tables

Executing `defineModels` function does not trigger table creation migrations.

Call each model"s [sync](https://sequelize.org/api/v6/class/src/model.js~model#static-method-sync) function to order to create tables for `Revision` and `RevisionChange` respectively.

```typescript
const { Revision, RevisionChange } = sequelizeRevision.defineModels();

await Revision.sync();
await RevisionChange.sync();
```

## Enable debug logging

All logs are printed via the [debug](https://github.com/visionmedia/debug) module under the `sequelize-revision` namespace.

```sh
env DEBUG="sequelize-revision:*" node script.js
```

## User tracking

There are 2 steps to enable user tracking, ie, recording the user who created a particular revision.

1. Enable user tracking by passing `userModel` option to the constructor, with the name of the model which stores users in your application as the value.

```typescript
const sequelizeRevision = new SequelizeRevision(sequelize, { userModel: "user" });
```

2. Pass the id of the user who is responsible for the database operation to revisions either by sequelize options or by using [cls-hooked](https://www.npmjs.com/package/cls-hooked).

```typescript
await Model.update({ /* ... */ }, { userId: user.id });
```

OR

```typescript
import { createNamespace } = from "cls-hooked";

const session = createNamespace("my session");
session.set("userId", user.id);

await Model.update({ /* ... */ });
```

To enable cls-hooked set `continuationNamespace` in initialization options.
Additionally, you may also have to call `.run()` or `.bind()` on your cls namespace, as described in the [docs](https://www.npmjs.com/package/cls-hooked).

## Disable logging for a single call

To not log a specific change to a revisioned object, just pass a `noRevision` with `true` value.

```typescript
const instance = await Model.findOne();
await instance.update({ noRevision: true });
```

## Saving meta data

You can save meta data to revisions table in 2 steps Whne revisions table already has additional columns.
1. Pass `metaDataFields` option to the constructor in `{ key: isRequired (boolean) }` format.

```typescript
const sequelizeRevision = new SequelizeRevision(sequelize, { metaDataFields: { userRole: false } });
```

2. Pass the metadata to revisions either by sequelize options or by using [cls-hooked](https://www.npmjs.com/package/cls-hooked).

```typescript
await Model.update({ /* ... */ }, { revisionMetaData: { userRole: "admin" } });
```

OR

```typescript
import { createNamespace } = from "cls-hooked";

const session = createNamespace("my session");
session.set("metaData", { userRole: "admin" });

await Model.update({ /* ... */ });
```

To enable cls-hooked set continuationNamespace in initialization options. Additionally, you may also have to call .run() or .bind() on your cls namespace, as described in the docs.

## Exclude attributes

There are 2 ways to avoid logging revisions for updating specific attributes.

You can pass `exclude` option to the constructor in order to exclude attributes from all models.

```typescript
const sequelizeRevision = new SequelizeRevision(sequelize, { exclude: ["version"] });
sequelizeRevision.defineModels();
```

If you want to exclude attributes specific to eacy model, you can pass `exclude` parameters to the `trackRevision` function.

```typescript
sequelizeRevision.trackRevision(Project, { exclude: ["version"] })
```

Please note that the model level `exclude` does not overwrite the constructor `exclude`. Both `exclude` options are respected.
