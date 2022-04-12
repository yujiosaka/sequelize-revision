# TIPS

- [User tracking](#user-tracking)
- [Disable logging for a single call](#disable-logging-for-a-single-call)
- [Saving meta data](#saving-meta-data)
- [Exclude attributes](#exclude-attributes)

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
await sequelizeRevision.defineModels();
```

If you want to exclude attributes specific to eacy model, you can pass `exclude` parameters to the `trackRevision` function.

```typescript
await sequelizeRevision.trackRevision(Project, { exclude: ["version"] })
```

Please note that the model level `exclude` does not overwrite the constructor `exclude`. Both `exclude` options are respected.