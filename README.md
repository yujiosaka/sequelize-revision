# Sequelize Revision

[![npm-version](https://img.shields.io/npm/v/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![npm-downloads](https://img.shields.io/npm/dt/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![CircleCI](https://circleci.com/gh/yujiosaka/sequelize-revision/tree/master.svg?style=shield)](https://circleci.com/gh/yujiosaka/sequelize-revision/tree/master)
[![license](https://img.shields.io/github/license/yujiosaka/sequelize-revision.svg)](https://github.com/yujiosaka/sequelize-revision/blob/master/LICENSE)

###### [Code of Conduct](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CODE_OF_CONDUCT.md) | [Contributing](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CONTRIBUTING.md) | [Changelog](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CHANGELOG.md)

> Track revisions of your Sequelize models, revert them to any revision or restore them after being destroyed. Written in TypeScript and can be used with [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript).

Sequelize Revision a fork from [Sequelize Paper Trail](https://github.com/nielsgl/sequelize-paper-trail) supporting the same options and providing consistent behavior with following improvements:

- Re-written in TypeScript and support type checks
- Working well with or without [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript)
- Allowing to exclude attributes for each model
- Better coverage in unit tests

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
    - [Example](#example)
- [TIPS](#tips)
    - [User tracking](#user-tracking)
    - [Disable logging for a single call](#disable-logging-for-a-single-call)
    - [Exclude attributes](#exclude-attributes)
- [Options](#options)
    - [Default options](#default-options)
    - [Options documentation](#options-documentation)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Testing](#testing)

## Installation

```bash
$ npm install --save sequelize-revision
```

## Usage

Sequelize Revision assumes that you already set up your Sequelize connection, for example, like this:
```typescript
import Sequelize from 'sequelize';

const sequelize = new Sequelize('database', 'username', 'password');
```

then adding Sequelize Revision is as easy as:

```typescript
import { SequelizeRevision } from 'sequelize-revision';

const sequelizeRevision = new SequelizeRevision(sequelize, options);
const { Revision } = await sequelizeRevision.defineModels();
```

which loads the Sequelize Revision library, and the `defineModels()` method sets up a `Revisions` and `RevisionChanges` table.

*Note: If you pass `userModel` option to the constructor in order to enable user tracking, `userModel` should be setup before `defineModels()` is called.*

Then for each model that you want to keep a paper trail you simply add:

```typescript
await sequelizeRevision.trackRevision(Model);
```

### Example

```typescript
import Sequelize from 'sequelize';
import { SequelizeRevision } from 'sequelize-revision';

const sequelize = new Sequelize('database', 'username', 'password');
const sequelizeRevision = new SequelizeRevision(sequelize, options || {});
await sequelizeRevision.defineModels();

const User = sequelize.define('User', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
});

await sequelizeRevision.trackRevision(User);
```

## TIPS

### User tracking

There are 2 steps to enable user tracking, ie, recording the user who created a particular revision.
1. Enable user tracking by passing `userModel` option to the constructor, with the name of the model which stores users in your application as the value.

```typescript
const options = {
  /* ... */
  userModel: 'user',
};
```
2. Pass the id of the user who is responsible for the database operation to `sequelize-revision` either by sequelize options or by using [cls-hooked](https://www.npmjs.com/package/cls-hooked).

```typescript
Model.update({
  /* ... */
}, {
  userId: user.id
}).then(() {
  /* ... */
});
```
OR

```typescript
const createNamespace = require('cls-hooked').createNamespace;
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

### Disable logging for a single call

To not log a specific change to a revisioned object, just pass a `noRevision` with `true` value.

```typescript
const instance = await Model.findOne();
instance.update({ noRevision: true }).then(() {
  /* ... */
});
```

### Exclude attributes

You can pass `exclude` parameters to the constructor in order to avoid logging revisions for updating the attributes for any models.

```typescript
const sequelizeRevision = new SequelizeRevision(sequelize, exclude: ["version"]);
await sequelizeRevision.defineModels();
```

If you want to exclude attributes specific to eacy model, you can pass `exclude` parameters to `trackRevision` function.

```typescript
await sequelizeRevision.trackRevision(Project, { exclude: ["version"] })
```

Please note that the model level `exclude` does not overwrite the constructor `exclude`. Both `exclude` options are respected.

## Options

Sequelize Revision supports various options that can be passed into the initialization. The following are the default options:

### Default options

```typescript
// Default options
  debug: false,
  log: undefined,
  exclude: [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "created_at",
    "updated_at",
    "deleted_at",
    "revision",
  ],
  revisionAttribute: "revision",
  revisionModel: "Revision",
  revisionChangeModel: "RevisionChange",
  enableRevisionChangeModel: false,
  UUID: false,
  underscored: false,
  underscoredAttributes: false,
  defaultAttributes: {
    documentId: "documentId",
    revisionId: "revisionId",
  },
  userModel: undefined,
  userModelAttribute: "userId",
  enableCompression: false,
  enableMigration: false,
  enableStrictDiff: true,
  continuationNamespace: undefined,
  continuationKey: "userId",
  metaDataFields: undefined,
  metaDataContinuationKey: "metaData",
  tableName: undefined,
  belongsToUserOptions: undefined,
```

### Options documentation

| Option                      | Type    | Default Value                                                                                                        | Description                                                                                                                                                                                                            |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [debug]                     | Boolean | false                                                                                                                | Enables logging to the console.                                                                                                                                                                                        |
| [exclude]                   | Array   | ['id', 'createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at', [options.revisionAttribute]] | Array of global attributes to exclude from the paper trail.                                                                                                                                                            |
| [revisionAttribute]         | String  | 'revision'                                                                                                           | Name of the attribute in the table that corresponds to the current revision.                                                                                                                                           |
| [revisionModel]             | String  | 'Revision'                                                                                                           | Name of the model that keeps the revision models.                                                                                                                                                                      |
| [tableName]                 | String  | undefined                                                                                                            | Name of the table that keeps the revision models. Passed to Sequelize. Necessary in Sequelize 5+ when underscored is true and the table is camelCase or PascalCase.                                                    |
| [revisionChangeModel]       | String  | 'RevisionChange'                                                                                                     | Name of the model that tracks all the attributes that have changed during each create and update call.                                                                                                                 |
| [enableRevisionChangeModel] | Boolean | false                                                                                                                | Disable the revision change model to save space.                                                                                                                                                                       |
| [UUID]                      | Boolean | false                                                                                                                | The [revisionModel] has id attribute of type UUID for postgresql.                                                                                                                                                      |
| [underscored]               | Boolean | false                                                                                                                | The [revisionModel] and [revisionChangeModel] have 'createdAt' and 'updatedAt' attributes, by default, setting this option to true changes it to 'created_at' and 'updated_at'.                                        |
| [underscoredAttributes]     | Boolean | false                                                                                                                | The [revisionModel] has a [defaultAttribute] 'documentId', and the [revisionChangeModel] has a  [defaultAttribute] 'revisionId, by default, setting this option to true changes it to 'document_id' and 'revision_id'. |
| [defaultAttributes]         | Object  | { documentId: 'documentId', revisionId: 'revisionId' }                                                               |                                                                                                                                                                                                                        |
| [userModel]                 | String  |                                                                                                                      | Name of the model that stores users in your.                                                                                                                                                                           |
| [enableCompression]         | Boolean | false                                                                                                                | Compresses the revision attribute in the [revisionModel] to only the diff instead of all model attributes.                                                                                                             |
| [enableMigration]           | Boolean | false                                                                                                                | Automatically adds the [revisionAttribute] via a migration to the models that have paper trails enabled.                                                                                                               |
| [enableStrictDiff]          | Boolean | true                                                                                                                 | Reports integers and strings as different, e.g. `3.14` !== `'3.14'`                                                                                                                                                    |
| [continuationNamespace]     | String  |                                                                                                                      | Name of the name space used with the cls-hooked module.                                                                                                                                                |
| [continuationKey]           | String  | 'userId'                                                                                                             | The cls-hooked key that contains the user id.                                                                                                                                                          |
| [belongsToUserOptions]      | Object  | undefined                                                                                                            | The options used for belongsTo between userModel and Revision model                                                                                                                                                    |
| [metaDataFields]            | Object  | undefined                                                                                                            | The keys that will be provided in the meta data object. { key: isRequired (boolean)} format. Can be used to privovide additional fields - other associations, dates, etc to the Revision model                         |
| [metaDataContinuationKey]   | String  | 'metaData'                                                                                                           | The cls-hooked key that contains the meta data object, from where the metaDataFields are extracted.                                                                                                    |

## Troubleshooting

- [Revisions are not loggeed when running bulk operations](#revisions-are-not-loggeed-when-running-bulk-operations)

### Revisions are not loggeed when running bulk operations

Sequelize Revision logs records when [hooks](https://sequelize.org/docs/v6/other-topics/hooks/) (also known as lifecycle events) are triggered in Sequelize.

By default, hooks are not triggered when you run bulk operations as below

```typescript
await Model.bulkCreate([
  { name: "sequelize-paper-trail", version: 1 },
  { name: "sequelize-revision", version: 1 },
]);

await Model.update({ version: 2 }, {
  where: { version: 1 },
});

await Model.destroy({
  where: { version: 1 },
});
```

In order to log revisions for those bulk operations, pass `individualHooks: true` option for triggering hooks.

```typescript
await Model.bulkCreate([
  { name: "sequelize-paper-trail", version: 1 },
  { name: "sequelize-revision", version: 1 },
], { individualHooks: true });

await Model.update({ version: 2 }, {
  where: { version: 1 },
  individualHooks: true
});

await Model.destroy({
  where: { version: 1 },
  individualHooks: true,
});
```

## Limitations

- This project does not support models with composite primary keys. You can work around using a unique index with multiple fields.

## Testing

The tests are designed to run on SQLite3 in-memory tables, built from Sequelize migration files.

```bash
$ npm test
```
