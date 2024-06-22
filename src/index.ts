import { diffChars } from "diff";
import omit from "lodash.omit";
import omitBy from "lodash.omitby";
import pick from "lodash.pick";
import pickBy from "lodash.pickby";
import snakeCase from "lodash.snakecase";
import { DataTypes, Model, Sequelize } from "sequelize";
import type { ModelAttributes } from "sequelize";
import type { ModelDefined, ModelStatic } from "sequelize/types/model";
import type { F } from "ts-toolbelt";
import { ulid } from "ulid";
import { calcDelta, capitalizeFirstLetter, debugConsole, diffToString } from "./helpers.js";
import type { Revision, RevisionChange } from "./models.js";
import { defaultOptions } from "./options.js";
import type { Options, SequelizeRevisionOptions } from "./options.js";

export class SequelizeRevision<O extends SequelizeRevisionOptions> {
  private options: Options;
  private documentIdAttribute = "documentId";
  private documentIdsAttribute = "documentIds";
  private createdAtAttribute = "createdAt";
  private updatedAtAttribute = "updatedAt";
  private failHard = false;

  constructor(
    private sequelize: Sequelize,
    options?: F.Narrow<O>,
  ) {
    this.options = Object.assign({}, defaultOptions, options);
    if (!["serial", "uuid", "ulid"].includes(this.options.primaryKeyType)) {
      throw new Error(`primaryKeyType: ${this.options.primaryKeyType} is not supported`);
    }
    if (this.options.underscoredAttributes) {
      this.documentIdAttribute = snakeCase(this.documentIdAttribute);
      this.documentIdsAttribute = snakeCase(this.documentIdsAttribute);
      this.createdAtAttribute = snakeCase(this.createdAtAttribute);
      this.updatedAtAttribute = snakeCase(this.updatedAtAttribute);
      this.options.userIdAttribute = snakeCase(this.options.userIdAttribute);
      this.options.revisionIdAttribute = snakeCase(this.options.revisionIdAttribute);
    }
  }

  public defineModels(): O["enableRevisionChangeModel"] extends true
    ? [ModelStatic<Revision<O>>, ModelStatic<RevisionChange<O>>]
    : [ModelStatic<Revision<O>>] {
    const Revision = this.sequelize.define<Revision<O>>(this.options.revisionModel, this.getRevisionAttributes(), {
      tableName: this.options.tableName,
      createdAt: this.createdAtAttribute,
      updatedAt: this.updatedAtAttribute,
      underscored: this.options.underscored,
    });

    if (this.options.userModel) {
      Revision.belongsTo(this.sequelize.model(this.options.userModel), {
        foreignKey: this.options.userIdAttribute,
        ...this.options.belongsToUserOptions,
      });
    }

    if (this.options.enableRevisionChangeModel) {
      const RevisionChange = this.sequelize.define<RevisionChange<O>>(
        this.options.revisionChangeModel,
        this.getRevisionChangeAttributes(),
        {
          tableName: this.options.changeTableName,
          createdAt: this.createdAtAttribute,
          updatedAt: this.updatedAtAttribute,
          underscored: this.options.underscored,
        },
      );

      Revision.hasMany(RevisionChange, {
        foreignKey: this.options.revisionIdAttribute,
        constraints: false,
      });

      RevisionChange.belongsTo(Revision, {
        foreignKey: this.options.revisionIdAttribute,
      });

      return [Revision, RevisionChange] as any;
    }
    return [Revision] as any;
  }

  public trackRevision(
    model: ModelDefined<any, any>,
    options: { exclude?: string[] } = {},
  ): O["enableMigration"] extends true ? Promise<void> : void {
    debugConsole("track revisions on %s", model.name);

    this.addRevisionAttribute(model);
    if (this.options.enableMigration) {
      return this.addRevisionColumn(model).then(() => {
        this.addHooks(model, options.exclude);
      }) as O["enableMigration"] extends true ? Promise<void> : void;
    }

    this.addHooks(model, options.exclude);
    return undefined as O["enableMigration"] extends true ? Promise<void> : void;
  }

  /**
   * Throw exceptions when the user identifier from asyncLocalStorage is not set or if the
   * revisionAttribute was not loaded on the model.
   */
  public enableFailHard() {
    this.failHard = true;
  }

  private addHooks(model: ModelDefined<any, any>, modelExclude: string[] = []) {
    model.addHook("beforeCreate", this.createBeforeHook("create", modelExclude));
    model.addHook("beforeDestroy", this.createBeforeHook("destroy", modelExclude));
    model.addHook("beforeUpdate", this.createBeforeHook("update", modelExclude));
    model.addHook("beforeUpsert", this.createBeforeHook("upsert", modelExclude));
    model.addHook("afterCreate", this.createAfterHook("create", modelExclude));
    model.addHook("afterDestroy", this.createAfterHook("destroy", modelExclude));
    model.addHook("afterUpdate", this.createAfterHook("update", modelExclude));
    model.addHook("afterUpsert", this.createAfterHook("upsert", modelExclude));

    model.hasMany(this.sequelize.models[this.options.revisionModel], {
      foreignKey: this.documentIdAttribute,
      constraints: false,
      scope: {
        model: model.name,
      },
    });
  }

  private getRevisionAttributes(): ModelAttributes {
    let idType;
    if (this.options.primaryKeyType === "uuid") {
      idType = DataTypes.UUID;
    } else if (this.options.primaryKeyType === "ulid") {
      idType = DataTypes.STRING;
    } else {
      idType = DataTypes.INTEGER;
    }

    const attributes: ModelAttributes = {
      model: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      document: {
        type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
      [this.documentIdAttribute]: {
        type: idType,
        allowNull: false,
      },
      [this.documentIdsAttribute]: {
        type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
      operation: DataTypes.STRING(7),
      [this.options.revisionAttribute]: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    };

    if (this.options.primaryKeyType === "uuid") {
      attributes.id = {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      };
    } else if (this.options.primaryKeyType === "ulid") {
      attributes.id = {
        primaryKey: true,
        type: DataTypes.STRING,
        defaultValue: ulid,
      };
    }

    debugConsole("revision attributes %O", attributes);

    return attributes;
  }

  private getRevisionChangeAttributes(): ModelAttributes {
    const attributes: ModelAttributes = {
      path: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      document: {
        type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
      diff: {
        type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
    };

    if (this.options.primaryKeyType === "uuid") {
      attributes.id = {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      };
    } else if (this.options.primaryKeyType === "ulid") {
      attributes.id = {
        primaryKey: true,
        type: DataTypes.STRING,
        defaultValue: () => ulid(),
      };
    }

    debugConsole("revision change attributes %O", attributes);

    return attributes;
  }

  private addRevisionAttribute(model: ModelDefined<any, any>) {
    model.rawAttributes[this.options.revisionAttribute] = {
      type: DataTypes.INTEGER,
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    model.refreshAttributes();
  }

  private async addRevisionColumn(model: ModelDefined<any, any>): Promise<void> {
    const tableName = model.getTableName();
    const queryInterface = this.sequelize.getQueryInterface();
    const attributes = await queryInterface.describeTable(tableName);
    if (!attributes[this.options.revisionAttribute]) {
      debugConsole("add revision column to %s", tableName);
      try {
        await queryInterface.addColumn(tableName, this.options.revisionAttribute, {
          type: DataTypes.INTEGER,
        });
      } catch (err) {
        debugConsole("failed to add revision column", err);
      }
    }
  }

  private createBeforeHook(operation: string, modelExclude: string[]) {
    const exclude = [...this.options.exclude, ...modelExclude];
    return (instance: any, opt: any) => {
      if (!(instance instanceof Model) && opt.instance instanceof Model) {
        instance = opt.instance;
      }

      debugConsole("beforeHook instance: %O", instance);
      debugConsole("beforeHook opt: %O", opt);

      if (opt.noRevision) {
        debugConsole("noRevision: true");
        return;
      }

      const { previousVersion, currentVersion } = this.getVersions(operation, instance, opt, exclude);

      // Disallow change of revision
      instance.set(this.options.revisionAttribute, instance._previousDataValues[this.options.revisionAttribute]);

      const delta = calcDelta(previousVersion, currentVersion, exclude, this.options.enableStrictDiff);

      const currentRevisionId = instance.get(this.options.revisionAttribute);
      if (this.failHard && !currentRevisionId && opt.type === "UPDATE") {
        throw new Error("Revision Id was undefined");
      }

      debugConsole("delta: %O", delta);
      debugConsole("revisionId: %s", currentRevisionId);

      // Check if all required fields have been provided to the opts / AsyncLocalStorage
      if (this.options.metaDataFields) {
        this.checkRequiredFields(opt);
      }

      const destroyOperation = operation === "destroy";
      if (destroyOperation || (delta && delta.length > 0)) {
        const revisionId = (currentRevisionId || 0) + 1;
        instance.set(this.options.revisionAttribute, revisionId);

        if (!instance.context) {
          instance.context = {};
        }
        instance.context.delta = delta;
      } else {
        if (instance.context) {
          instance.context.delta = null;
        }
      }
      debugConsole("end of beforeHook");
    };
  }

  private checkRequiredFields(opt: any) {
    const requiredFields = Object.keys(pickBy(this.options.metaDataFields, (required) => required));
    if (requiredFields.length) {
      const metaData = {
        ...opt.revisionMetaData,
        ...this.options.metaDataAsyncLocalStorage?.getStore(),
      };
      const requiredFieldsProvided = requiredFields.filter((field) => metaData[field] !== undefined);
      if (requiredFieldsProvided.length !== requiredFields.length) {
        debugConsole("required fields: ", this.options.metaDataFields, requiredFields);
        debugConsole("required fields provided: ", metaData, requiredFieldsProvided);
        throw new Error("Not all required fields are provided");
      }
    }
  }

  private getVersions(
    operation: string,
    instance: any,
    opt: any,
    exclude: string[],
  ): { previousVersion: any; currentVersion: any } {
    const destroyOperation = operation === "destroy";

    let previousVersion = instance._previousDataValues;
    let currentVersion = instance.dataValues;
    if (!destroyOperation && this.options.enableCompression) {
      previousVersion = pick(instance._previousDataValues, opt.defaultFields);
      currentVersion = pick(instance.dataValues, opt.defaultFields);
    }

    // Supported nested models.
    previousVersion = pick(previousVersion, Object.keys(instance.rawAttributes));
    previousVersion = omit(previousVersion, exclude);
    previousVersion = omitBy(previousVersion, (attribute) => attribute === undefined);

    currentVersion = pick(currentVersion, Object.keys(instance.rawAttributes));
    currentVersion = omit(currentVersion, exclude);
    currentVersion = omitBy(currentVersion, (attribute) => attribute === undefined);

    return { previousVersion, currentVersion };
  }

  private createAfterHook(operation: string, modelExclude: string[]) {
    const exclude = [...this.options.exclude, ...modelExclude];
    return async (instance: any, opt: any) => {
      if (instance instanceof Array) {
        instance = instance[0];
      }

      debugConsole("afterHook instance: %O", instance);
      debugConsole("afterHook opt: %O", opt);

      if (this.options.asyncLocalStorage) {
        debugConsole(`AsyncLocalStorage: %s`, this.options.asyncLocalStorage.getStore());
      }

      const destroyOperation = operation === "destroy";

      if (instance.context && ((instance.context.delta && instance.context.delta.length > 0) || destroyOperation)) {
        const { currentVersion } = this.getVersions(operation, instance, opt, exclude);

        this.checkContinuationKey();

        let document = currentVersion;
        if (!this.options.useJsonDataType) {
          document = JSON.stringify(document);
        }

        const query: { [key: string]: any } = {
          model: instance.constructor.name,
          document,
          operation,
        };

        // Add all extra data fields to the query object
        if (this.options.metaDataFields) {
          const metaData = {
            ...opt.revisionMetaData,
            ...this.options.metaDataAsyncLocalStorage?.getStore(),
          };
          if (metaData) {
            Object.keys(this.options.metaDataFields).forEach((field) => {
              const value = metaData[field];
              debugConsole("add metaData to revisions %s: %s", field, value);
              if (!(field in query)) {
                query[field] = value;
              } else {
                debugConsole("revision already has a value %s: %s", field, query[field]);
              }
            });
          }
        }

        // in case of custom user models that are not 'userId'
        query[this.options.userIdAttribute] = this.options.asyncLocalStorage?.getStore() || opt.userId;
        query[this.documentIdAttribute] = instance[instance.constructor.primaryKeyAttribute];
        query[this.documentIdsAttribute] = instance.constructor.primaryKeyAttributes.reduce(
          (documentIds: Record<string, unknown>, attribute: string) => {
            documentIds[attribute] = instance[attribute];
            return documentIds;
          },
          {},
        );
        if (!this.options.useJsonDataType) {
          query[this.documentIdsAttribute] = JSON.stringify(query[this.documentIdsAttribute]);
        }

        const Revision = this.sequelize.model(this.options.revisionModel);
        const revision: any = Revision.build(query);
        revision[this.options.revisionAttribute] = instance.get(this.options.revisionAttribute);

        try {
          const savedRevision = await revision.save({
            transaction: opt.transaction,
          });
          if (this.options.enableRevisionChangeModel) {
            const RevisionChange = this.sequelize.model(this.options.revisionChangeModel);
            if (instance.context.delta) {
              await Promise.all(
                instance.context.delta.map(async (difference: any) => {
                  let document = difference;
                  let diff = this.calcDiff(difference);

                  if (!this.options.useJsonDataType) {
                    document = JSON.stringify(difference);
                    diff = JSON.stringify(diff);
                  }

                  const revisionChange = RevisionChange.build({
                    path: difference.path[0],
                    document,
                    diff,
                    revisionId: savedRevision.id,
                  });

                  try {
                    const savedRevisionChange = await revisionChange.save({
                      transaction: opt.transaction,
                    });
                    savedRevision[`add${capitalizeFirstLetter(this.options.revisionChangeModel)}`](savedRevisionChange);
                  } catch (err) {
                    debugConsole("revision change save error", err);
                    throw err;
                  }
                }),
              );
            }
          }
        } catch (err) {
          debugConsole("revision save error", err);
          throw err;
        }
      }
      debugConsole("end of afterHook");
    };
  }

  private checkContinuationKey() {
    if (this.failHard && this.options.asyncLocalStorage && !this.options.asyncLocalStorage.getStore()) {
      throw new Error(`AsyncLocalStorage ${this.options.asyncLocalStorage.getStore()} was not defined.`);
    }
  }

  private calcDiff(document: any): any {
    const o = diffToString(document.item ? document.item.lhs : document.lhs);
    const n = diffToString(document.item ? document.item.rhs : document.rhs);
    return o || n ? diffChars(o, n) : [];
  }
}

export type { Revision, RevisionChange, SequelizeRevisionOptions };
