# TIPS

- [Define model types](#define-model-types)
- [Enable debug logging](#enable-debug-logging)
- [User tracking](#user-tracking)
- [Disable logging for a single call](#disable-logging-for-a-single-call)
- [Saving meta data](#saving-meta-data)
- [Exclude attributes](#exclude-attributes)

## Define model types

Due to the dynamic nature of [Sequelize](https://github.com/sequelize/sequelize), you have to define the types of `Revision` and `RevisionChnage` models in your application.

Here is the type definitions for the default attribute names.

```typescript
import { ForeignKey, NonAttribute, Sequelize } from "sequelize";
import { Model, InferAttributes, InferCreationAttributes, CreationOptional } from "sequelize";

interface Revision
  extends Model<
    InferAttributes<Revision>,
    InferCreationAttributes<Revision>
  > {
  id: CreationOptional<number>;
  model: string;
  document: object;
  documentId: number;
  operation: string;
  revision: number;
  projects: NonAttribute<RevisionChange[]>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

interface RevisionChange
  extends Model<
    InferAttributes<RevisionChange>,
    InferCreationAttributes<RevisionChange>
  > {
  id: CreationOptional<number>;
  path: string;
  document: object;
  diff: object;
  revisionId: ForeignKey<Revision["id"]>;
  revision: NonAttribute<Revision>;
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
}

const { Revision, RevisionChange } = sequelizeRevision.defineModels<Revision, RevisionChange>();
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
const options = {
  /* ... */
  userModel: 'user',
};
```

2. Pass the id of the user who is responsible for the database operation to revisions either by sequelize options or by using [cls-hooked](https://www.npmjs.com/package/cls-hooked).

```typescript
Model.update({
  /* ... */
}, {
  userId: user.id,
}).then(() {
  /* ... */
});
```

OR

```typescript
import { createNamespace } = from 'cls-hooked';

const session = createNamespace('my session');
session.set('userId', user.id);

Model.update({
  /* ... */
}).then(() {
  /* ... */
});
```

To enable cls-hooked set `continuationNamespace` in initialization options.
Additionally, you may also have to call `.run()` or `.bind()` on your cls namespace, as described in the [docs](https://www.npmjs.com/package/cls-hooked).

## Disable logging for a single call

To not log a specific change to a revisioned object, just pass a `noRevision` with `true` value.

```typescript
const instance = await Model.findOne();
instance.update({ noRevision: true }).then(() {
  /* ... */
});
```

## Saving meta data

You can save meta data to revisions table in 2 steps Whne revisions table already has additional columns.
1. Pass `metaDataFields` option to the constructor in `{ key: isRequired (boolean) }` format.

```typescript
const options = {
  /* ... */
  metaDataFields: { userRole: false },
};
```

2. Pass the metadata to revisions either by sequelize options or by using [cls-hooked](https://www.npmjs.com/package/cls-hooked).

```typescript
Model.update({
  /* ... */
}, {
  revisionMetaData: { userRole: "admin" },
}).then(() {
  /* ... */
});
```

OR

```typescript
import { createNamespace } = from 'cls-hooked';

const session = createNamespace('my session');
session.set("metaData", { userRole: "admin" });

Model.update({
  /* ... */
}).then(() {
  /* ... */
});
```

To enable cls-hooked set continuationNamespace in initialization options. Additionally, you may also have to call .run() or .bind() on your cls namespace, as described in the docs.

## Exclude attributes

There are 2 ways to avoid logging revisions for updating specific attributes.

You can pass `exclude` option to the constructor in order to exclude attributes from all models.

```typescript
const sequelizeRevision = new SequelizeRevision(sequelize, exclude: ["version"]);
sequelizeRevision.defineModels();
```

If you want to exclude attributes specific to eacy model, you can pass `exclude` parameters to the `trackRevision` function.

```typescript
sequelizeRevision.trackRevision(Project, { exclude: ["version"] })
```

Please note that the model level `exclude` does not overwrite the constructor `exclude`. Both `exclude` options are respected.