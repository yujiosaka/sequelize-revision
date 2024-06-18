# Sequelize Revision

[![npm-version](https://img.shields.io/npm/v/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
[![npm-downloads](https://img.shields.io/npm/dt/sequelize-revision.svg)](https://www.npmjs.org/package/sequelize-revision)
![CI/CD](https://github.com/yujiosaka/sequelize-revision/actions/workflows/ci_cd.yml/badge.svg)
[![license](https://img.shields.io/github/license/yujiosaka/sequelize-revision.svg)](https://github.com/yujiosaka/sequelize-revision/blob/main/LICENSE)

###### [TIPS](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/TIPS.md) \| [Troubleshooting](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/TROUBLESHOOTING.md) \| [Code of Conduct](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/CODE_OF_CONDUCT.md) \| [Contributing](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/CONTRIBUTING.md) \| [Security Policy](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/SECURITY.md) \| [Changelog](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/CHANGELOG.md)

> Track revisions of your Sequelize models, revert them to any revision or restore them after being destroyed. Written in TypeScript and can be used with [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript).

Sequelize Revision is a fork from [Sequelize Paper Trail](https://github.com/nielsgl/sequelize-paper-trail) supporting similar options and providing consistent behavior with following improvements:

- Re-written in TypeScript and support type checks
- Working well with or without [sequelize-typescript](https://github.com/RobinBuschmann/sequelize-typescript)
- Tracking users for making changes with [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- Support JSON data type for storing revisions
- Exclude revision attributes for each model
- Passing revision metadata to operations
- Logging revisions for upsert operations
- Better coverage in unit tests
- Support composite key

## Installation

```bash
$ npm install --save sequelize-revision
```

## Usage

Sequelize Revision assumes that you already set up your [Sequelize](https://github.com/sequelize/sequelize) connection, for example, like this:

```typescript
import { Sequelize } from "sequelize";

const sequelize = new Sequelize("sqlite::memory:");
```

then adding Sequelize Revision is as easy as:

```typescript
import { SequelizeRevision } from "sequelize-revision";

const sequelizeRevision = new SequelizeRevision(sequelize, options);
const [Revision, RevisionChanges] = sequelizeRevision.defineModels();
```

which loads the Sequelize Revision library, and the `defineModels()` method sets up a `Revision` and `RevisionChange` models.

_Note: If you pass `userModel` option to the constructor in order to enable user tracking, `userModel` should be setup before `defineModels()` is called._

Then for each model that you want to keep a paper trail you simply add:

```typescript
sequelizeRevision.trackRevision(Model);
```

## Example

```typescript
import Sequelize from "sequelize";
import { SequelizeRevision } from "sequelize-revision";

const sequelize = new Sequelize("sqlite::memory:");
const sequelizeRevision = new SequelizeRevision(sequelize, options);
const [Revision, RevisionChanges] = sequelizeRevision.defineModels();

const User = sequelize.define("User", { name: Sequelize.STRING });
sequelizeRevision.trackRevision(User);
```

## Options

Sequelize Revision supports various options that can be passed into the initialization. The following are the default options:

### Options documentation

| Option                          | Type              | Default Value                                                                                                          | Description                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **[exclude]**                   | Array             | `["id", "createdAt", "updatedAt", "deletedAt", "created_at", "updated_at", "deleted_at", [options.revisionAttribute]]` | Array of global attributes to exclude from the Sequelize Revision.                                                                                                                                                                                                                                                 |
| **[revisionAttribute]**         | String            | `"revision"`                                                                                                           | Name of the attribute in the table that corresponds to the current revision.                                                                                                                                                                                                                                       |
| **[revisionIdAttribute]**       | String            | `"revisionId"`                                                                                                         | Name of the attribute in the `RevisionChange` model that corresponds to the ID of the `Revision` model. Attribute name can be modified to `"revision_id"` by passing **[underscoredAttributes]** option.                                                                                                           |
| **[revisionModel]**             | String            | `"Revision"`                                                                                                           | Name of the model that keeps the revision models.                                                                                                                                                                                                                                                                  |
| **[tableName]**                 | String            | `undefined`                                                                                                            | Name of the table that keeps the revision models. Passed to [Sequelize](https://github.com/sequelize/sequelize).                                                                                                                                                                                                   |
| **[changeTableName]**           | String            | `undefined`                                                                                                            | Name of the table that keeps the revision change models. Passed to [Sequelize](https://github.com/sequelize/sequelize). Table is camelCase or PascalCase.                                                                                                                                                          |
| **[revisionChangeModel]**       | String            | `"RevisionChange"`                                                                                                     | Name of the model that tracks all the attributes that have changed during each create and update call.                                                                                                                                                                                                             |
| **[enableRevisionChangeModel]** | Boolean           | `false`                                                                                                                | Disable the revision change model to save space.                                                                                                                                                                                                                                                                   |
| **[primaryKeyType]**            | Boolean           | `"serial"`                                                                                                             | The data type of primary keys used in the database. Available values are `"serial"`, `"uuid"` or `"ulid"`.                                                                                                                                                                                                         |
| **[underscored]**               | Boolean           | `false`                                                                                                                | The **[revisionModel]** and **[revisionChangeModel]** have `"createdAt"` and `"updatedAt"` columns, by default, setting this option to `true` changes it to `"created_at`" and `"updated_at"`. Pass `true` to **[underscoredAttributes]** option as well for using underscored attributes to access those columns. |
| **[underscoredAttributes]**     | Boolean           | `false`                                                                                                                | The **[revisionModel]** has `"documentId"`, `"documentIds"` and the **[revisionChangeModel]** has a **[defaultAttributes.revisionId]** `"revisionId`, by default, setting this option to `true` changes it to `"document_id"`, `"document_ids"` and `"revision_id"`.                                               |
| **[userModel]**                 | String            | `undefined`                                                                                                            | Name of the model that stores users in your application.                                                                                                                                                                                                                                                           |
| **[userIdAttribute]**           | String            | `"userId"`                                                                                                             | Name of the attribute in the `RevisionChange` model that corresponds to the ID of the User model. Attribute name can be modified to `"user_id"` by passing **[underscoredAttributes]** option.                                                                                                                     |
| **[enableCompression]**         | Boolean           | `false`                                                                                                                | Compresses the revision attribute in the **[revisionModel]** to only the diff instead of all model attributes.                                                                                                                                                                                                     |
| **[enableMigration]**           | Boolean           | `false`                                                                                                                | Automatically adds the **[revisionAttribute]** via a migration to the models that have paper trails enabled.                                                                                                                                                                                                       |
| **[enableStrictDiff]**          | Boolean           | `true`                                                                                                                 | Reports integers and strings as different, e.g. `3.14` !== `"3.14"`                                                                                                                                                                                                                                                |
| **[asyncLocalStorage]**         | AsyncLocalStorage | `undefined`                                                                                                            | The [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) that contains the user id.                                                                                                                                                                                              |
| **[belongsToUserOptions]**      | Object            | `undefined`                                                                                                            | The options used for belongsTo between userModel and `Revision` model                                                                                                                                                                                                                                              |
| **[metaDataFields]**            | Object            | `undefined`                                                                                                            | The keys that will be provided in the meta data object. `{ key: isRequired (boolean)}` format. Can be used to privovide additional fields - other associations, dates, etc to the `Revision` model                                                                                                                 |
| **[metaDataAsyncLocalStorage]** | AsyncLocalStorage | `undefined`                                                                                                            | The [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) that contains the meta data object, from where the metaDataFields are extracted.                                                                                                                                        |
| **[useJsonDataType]**           | Boolean           | `true`                                                                                                                 | Microsoft SQL Server and old versions of MySQL do not support [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) data type. Setting this option to `false` changes the data type to [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text).                                |

## Sequelize Models

### Revision

| Attribute               | Data Type                                                                                                                                            | Description                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"id"`                  | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) \| [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid)         | Primary key of the model. Data type is [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) by default, but can be modified to [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid) for PostgreSQL by passing `"uuid"` to **[primaryKeyType]** option.                           |
| `"model"`               | [STRING](https://sequelize.org/api/v6/class/src/data-types.js~string)                                                                                | Name of the tracked model.                                                                                                                                                                                                                                                                                       |
| `"document"`            | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Attributes of the model after the operation. The entire attributes are saved by default, but can be compresses only to the diff by passing **[enableCompression]** option.                                                                                                                                       |
| `"documentId"`          | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) \| [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid)         | ID of the tracked document. The first ID is used for a composite key. Attribute name can be modified to `"document_id"` by passing **[underscoredAttributes]** option.                                                                                                                                           |
| `"documentIds"`         | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Composite IDs of the tracked document. Attribute name can be modified to `"document_ids"` by passing **[underscoredAttributes]** option.                                                                                                                                                                         |
| `"operation"`           | [STRING](https://sequelize.org/api/v6/class/src/data-types.js~string)                                                                                | Name of the operation such as `"create"`, `"update"` and `"destroy"`.                                                                                                                                                                                                                                            |
| **[revisionAttribute]** | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer)                                                                              | Version of the document starting from `1`. The value is incremented every time when the document is created, updated or deleted. Attribute name is configured by **[revisionAttribute]**, default to `"revision"`. The same value is saved to **[revisionAttribute]** attribute of the tracked document as well. |
| **[userIdAttribute]**   | (ID data type of of the user model)                                                                                                                  | Foreign key of the user model. Attribute name is configured by **[userIdAttribute]**, default to `"userId"` and modified to `"user_id"` by passing **[underscoredAttributes]** option.                                                                                                                           |

### RevisionChnage

| Attribute                 | Data Type                                                                                                                                            | Description                                                                                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"id"`                    | [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) \| [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid)         | Primary key of the model. Data type is [INTEGER](https://sequelize.org/api/v6/class/src/data-types.js~integer) by default, but can be modified to [UUID](https://sequelize.org/api/v6/class/src/data-types.js~uuid) for PostgreSQL by passing `"uuid"` to **[primaryKeyType]** option. |
| `"path"`                  | [TEXT](https://sequelize.org/api/v6/class/src/data-types.js~text)                                                                                    | Modified attribute name.                                                                                                                                                                                                                                                               |
| `"document"`              | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Modified attributes.                                                                                                                                                                                                                                                                   |
| `"diff"`                  | [JSON](https://sequelize.org/api/v6/class/src/data-types.js~jsontype) \| [TEXT("medium")](https://sequelize.org/api/v6/class/src/data-types.js~text) | Difference of updated attribute, comparing character by character.                                                                                                                                                                                                                     |
| **[revisionIdAttribute]** | (ID data type of of the `Revision` model)                                                                                                            | Foreign key of the `Revision` model. Attribute name is configured by **[revisionIdAttribute]**, default to `"revisionId"` and modified to `"revision_id"` by passing **[underscoredAttributes]** option.                                                                               |

## Migration Guide to 8.x.x

In version 8.x.x, `sequelize-revision` has moved away from using `cls-hooked` (which relies on the deprecated `async_hook` API) to using the more stable `AsyncLocalStorage` API. This change ensures better performance and stability for tracking asynchronous context in Node.js applications.

For more details, refer to the updated [TIPS](https://github.com/yujiosaka/sequelize-revision/blob/main/docs/TIPS.md) section in the README.

### User Tracking

**Before**:

```typescript
import { createNamespace } from "cls-hooked";

const session = createNamespace("my session");
session.set("userId", user.id);

await Model.update({
  /* ... */
});
```

**After**:

```typescript
import { AsyncLocalStorage } from "async_hooks";

const asyncLocalStorage = new AsyncLocalStorage();

await asyncLocalStorage.run(user.id, async () => {
  await Model.update({
    /* ... */
  });
});
```

### Saving Metadata

**Before**:

```typescript
import { createNamespace } from "cls-hooked";

const session = createNamespace("my session");
session.set("metaData", { userRole: "admin" });

await Model.update({
  /* ... */
});
```

**New Code (8.x.x)**:

```typescript
import { AsyncLocalStorage } from "async_hooks";

const metaDataAsyncLocalStorage = new AsyncLocalStorage();

await metaDataAsyncLocalStorage.run({ userRole: "admin" }, async () => {
  await Model.update({
    /* ... */
  });
});
```
