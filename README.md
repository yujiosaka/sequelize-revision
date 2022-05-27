# Sequelize Revision

[![npm-version](https://img.shields.io/npm/v/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![npm-downloads](https://img.shields.io/npm/dt/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![CircleCI](https://circleci.com/gh/yujiosaka/sequelize-revision/tree/master.svg?style=shield)](https://circleci.com/gh/yujiosaka/sequelize-revision/tree/master)
[![license](https://img.shields.io/github/license/yujiosaka/sequelize-revision.svg)](https://github.com/yujiosaka/sequelize-revision/blob/master/LICENSE)

###### [TIPS](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/TIPS.md) | [Troubleshooting](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/TROUBLESHOOTING.md) | [Code of Conduct](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CODE_OF_CONDUCT.md) | [Contributing](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CONTRIBUTING.md) | [Security Policy](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/SECURITY.md) | [Changelog](https://github.com/yujiosaka/sequelize-revision/blob/master/docs/CHANGELOG.md)

> Track revisions of your Sequelize models, revert them to any revision or restore them after being destroyed. Written in TypeScript and can be used with [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript).

Sequelize Revision is a fork from [Sequelize Paper Trail](https://github.com/nielsgl/sequelize-paper-trail) supporting the same options and providing consistent behavior with following improvements:

- Re-written in TypeScript and support type checks
- Working well with or without [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript)
- Tracking users for making changes with [cls-hooked](https://github.com/jeff-lewis/cls-hooked)
- Support JSON data type for storing revisions
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
import Sequelize from "sequelize";

const sequelize = new Sequelize("database", "username", "password");
```

then adding Sequelize Revision is as easy as:

```typescript
import { SequelizeRevision } from "sequelize-revision";

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
import Sequelize from "sequelize";
import { SequelizeRevision } from "sequelize-revision";

const sequelize = new Sequelize("database", "username", "password");
const sequelizeRevision = new SequelizeRevision(sequelize, options || {});
const { Revision, RevisionChanges } = await sequelizeRevision.defineModels();

const User = sequelize.define("User", {
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
  changeTableName: undefined,
  belongsToUserOptions: undefined,
};
```

### Options documentation

| Option                      | Type    | Default Value                                                                                                          | Description                                                                                                                                                                                                                  |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [debug]                     | Boolean | `false`                                                                                                                | Enables logging to the console.                                                                                                                                                                                              |
| [exclude]                   | Array   | `["id", "createdAt", "updatedAt", "deletedAt", "created_at", "updated_at", "deleted_at", [options.revisionAttribute]]` | Array of global attributes to exclude from the Sequelize Revision.                                                                                                                                                           |
| [revisionAttribute]         | String  | `"revision"`                                                                                                           | Name of the attribute in the table that corresponds to the current revision.                                                                                                                                                 |
| [revisionModel]             | String  | `"Revision"`                                                                                                           | Name of the model that keeps the revision models.                                                                                                                                                                            |
| [tableName]                 | String  | `undefined`                                                                                                            | Name of the table that keeps the revision models. Passed to Sequelize.                                                                                                                                                       |
| [changeTableName]           | String  | `undefined`                                                                                                            | Name of the table that keeps the revision change models. Passed to Sequelize. Table is camelCase or PascalCase.                                                                                                              |
| [revisionChangeModel]       | String  | `"RevisionChange"`                                                                                                     | Name of the model that tracks all the attributes that have changed during each create and update call.                                                                                                                       |
| [enableRevisionChangeModel] | Boolean | `false`                                                                                                                | Disable the revision change model to save space.                                                                                                                                                                             |
| [useJsonDataType]           | Boolean | `true` (except for SQL Server)                                                                                         | Whether to use JSON data type for storing attributes and diff.                                                                                                                                                               |
| [UUID]                      | Boolean | `false`                                                                                                                | The [revisionModel] has id attribute of type UUID for PostgreSQL.                                                                                                                                                            |
| [underscored]               | Boolean | `false`                                                                                                                | The [revisionModel] and [revisionChangeModel] have `"createdAt"` and `"updatedAt"` attributes, by default, setting this option to true changes it to `"created_at`" and `"updated_at"`.                                      |
| [underscoredAttributes]     | Boolean | `false`                                                                                                                | The [revisionModel] has a [defaultAttribute] "documentId", and the [revisionChangeModel] has a  [defaultAttribute] `"revisionId`, by default, setting this option to true changes it to `"document_id"` and `"revision_id"`. |
| [defaultAttributes]         | Object  | `{ documentId: "documentId", revisionId: "revisionId" }`                                                               |                                                                                                                                                                                                                              |
| [userModel]                 | String  |                                                                                                                        | Name of the model that stores users in your.                                                                                                                                                                                 |
| [enableCompression]         | Boolean | `false`                                                                                                                | Compresses the revision attribute in the [revisionModel] to only the diff instead of all model attributes.                                                                                                                   |
| [enableMigration]           | Boolean | `false`                                                                                                                | Automatically adds the [revisionAttribute] via a migration to the models that have paper trails enabled.                                                                                                                     |
| [enableStrictDiff]          | Boolean | `true`                                                                                                                 | Reports integers and strings as different, e.g. `3.14` !== `"3.14"`                                                                                                                                                          |
| [continuationNamespace]     | String  |                                                                                                                        | Name of the name space used with the cls-hooked module.                                                                                                                                                                      |
| [continuationKey]           | String  | `"userId"`                                                                                                             | The cls-hooked key that contains the user id.                                                                                                                                                                                |
| [belongsToUserOptions]      | Object  | `undefined`                                                                                                            | The options used for belongsTo between userModel and Revision model                                                                                                                                                          |
| [metaDataFields]            | Object  | `undefined`                                                                                                            | The keys that will be provided in the meta data object. { key: isRequired (boolean)} format. Can be used to privovide additional fields - other associations, dates, etc to the Revision model                               |
| [metaDataContinuationKey]   | String  | `"metaData"`                                                                                                           | The cls-hooked key that contains the meta data object, from where the metaDataFields are extracted.                                                                                                                          |

## Sequelize Models

### Revision

| Attribute                      | Data Type                                                                                                                                            | Description                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                             | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) \| [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid)         | Primary key of the model. Data type is [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) by default, but can be modified to [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid) for PostgreSQL by passing [UUID] option.                                             |
| model                          | [STRING](https://sequelize.org/api/v6/class/src/data-types.js~string)                                                                                | Name of the tracked model.                                                                                                                                                                                                                                                                               |
| document                       | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Attributes of the model after the operation. The entire attributes are saved by default, but can be compresses only to the diff by passing [enableCompression] option.                                                                                                                                   |
| [defaultAttributes.documentId] | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) \| [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid)         | ID of the tracked document. Attribute name is configured by [defaultAttributes.documentId], default to `"documentId"`.                                                                                                                                                                                   |
| operation                      | [STRING](https://sequelize.org/api/v6/class/src/data-types.js~string)                                                                                | Name of the operation such as `"create"`, `"update"` and  `"destroy"`.                                                                                                                                                                                                                                   |
| [revisionAttribute]            | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer)                                                                              | Version of the document starting from `1`. The value is incremented every time when the document is created, updated or deleted. Attribute name is configured by [revisionAttribute], default to `"revision"`. The same value is saved to [revisionAttribute] attribute of the tracked document as well. |
| [userModelAttribute]           | (ID data type of of the user model)                                                                                                                  | Foreign key of the user model. Attribute name is configured by [userModelAttribute], default to `"userId"`.                                                                                                                                                                                              |

### RevisionChnage

| Attribute                      | Data Type                                                                                                                                            | Description                                                                                                                                                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id                             | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) \| [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid)         | Primary key of the model. Data type is [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) by default, but can be modified to [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid) for PostgreSQL by passing [UUID] option. |
| path                           | [TEXT](https://sequelize.org/api/v6/class/src/data-types.js~text)                                                                                    | Modified attribute name.                                                                                                                                                                                                                                     |
| document                       | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Modified attributes.                                                                                                                                                                                                                                         |
| diff                           | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Difference of updated attribute, comparing character by character.                                                                                                                                                                                           |
| [defaultAttributes.revisionId] | (ID data type of of the Revision model)                                                                                                              | Foreign key of the Revision model. Attribute name is configured by [defaultAttributes.revisionId], default to `"revisionId"`.                                                                                                                                |
