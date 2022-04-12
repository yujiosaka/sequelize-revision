# Sequelize Revision

[![npm-version](https://img.shields.io/npm/v/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![npm-downloads](https://img.shields.io/npm/dt/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![CircleCI](https://circleci.com/gh/yujiosaka/sequelize-revision/tree/master.svg?style=shield)](https://circleci.com/gh/yujiosaka/sequelize-revision/tree/master)
[![license](https://img.shields.io/github/license/yujiosaka/sequelize-revision.svg)](https://github.com/yujiosaka/sequelize-revision/blob/master/LICENSE)

###### [TIPS](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/TIPS.md) | [Troubleshooting](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/TROUBLESHOOTING.md) | [Code of Conduct](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CODE_OF_CONDUCT.md) | [Contributing](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CONTRIBUTING.md) | [Changelog](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CHANGELOG.md)

> Track revisions of your Sequelize models, revert them to any revision or restore them after being destroyed. Written in TypeScript and can be used with [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript).

Sequelize Revision is a fork from [Sequelize Paper Trail](https://github.com/nielsgl/sequelize-paper-trail) supporting the same options and providing consistent behavior with following improvements:

- Re-written in TypeScript and support type checks
- Working well with or without [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript)
- Exclude revision attributes for each model
- Passing revision metadata to operations
- Logging revisions for upsert operations
- Better coverage in unit tests

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
const { Revision, RevisionChanges } = await sequelizeRevision.defineModels();
```

which loads the Sequelize Revision library, and the `defineModels()` method sets up a `Revisions` and `RevisionChanges` table.

*Note: If you pass `userModel` option to the constructor in order to enable user tracking, `userModel` should be setup before `defineModels()` is called.*

Then for each model that you want to keep a paper trail you simply add:

```typescript
await sequelizeRevision.trackRevision(Model);
```

## Example

```typescript
import Sequelize from 'sequelize';
import { SequelizeRevision } from 'sequelize-revision';

const sequelize = new Sequelize('database', 'username', 'password');
const sequelizeRevision = new SequelizeRevision(sequelize, options || {});
const { Revision, RevisionChanges } = await sequelizeRevision.defineModels();

const User = sequelize.define('User', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
});

const { Revision, RevisionChanges } = await sequelizeRevision.trackRevision(User);

// You can also access to Revision and RevisionChanges via the instance after executing defineModels() function.
sequelizeRevision.Revision;
sequelizeRevision.RevisionChanges
```

## Options

Sequelize Revision supports various options that can be passed into the initialization. The following are the default options:

### Default options

```typescript
// Default options
const options = {
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
};
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
