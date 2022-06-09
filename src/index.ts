import {
  forEach,
  map,
  filter,
  keys,
  omit,
  omitBy,
  pick,
  pickBy,
  isUndefined,
  snakeCase,
} from "lodash";
import { Sequelize, DataTypes, Model, ModelAttributes } from "sequelize";
import { ModelDefined, ModelStatic } from "sequelize/types/model";
import { createNamespace, getNamespace, Namespace } from "cls-hooked";
import * as jsdiff from "diff";
import {
  capitalizeFirstLetter,
  calcDelta,
  diffToString,
  debugConsole,
} from "./helpers";
import { Options, defaultOptions } from "./options";

export class SequelizeRevision {
  private options: Options;
  private ns?: Namespace;
  private documentIdAttribute = "documentId";
  private createdAtAttribute = "createdAt";
  private updatedAtAttribute = "updatedAt";
  private useJsonDataType = false;
  private failHard = false;

  constructor(private sequelize: Sequelize, options?: Partial<Options>) {
    this.options = { ...defaultOptions, ...options };

    if (this.options.continuationNamespace) {
      this.ns = getNamespace(this.options.continuationNamespace);
      if (!this.ns) {
        this.ns = createNamespace(this.options.continuationNamespace);
      }
    }

    if (this.options.underscoredAttributes) {
      this.documentIdAttribute = snakeCase(this.documentIdAttribute);
      this.createdAtAttribute = snakeCase(this.createdAtAttribute);
      this.updatedAtAttribute = snakeCase(this.updatedAtAttribute);
      this.options.userIdAttribute = snakeCase(this.options.userIdAttribute);
      this.options.revisionIdAttribute = snakeCase(
        this.options.revisionIdAttribute
      );
    }

    if (this.sequelize.getDialect() !== "mssql") {
      this.useJsonDataType = true;
    }
  }

  public defineModels<T extends Model = Model, U extends Model = Model>(): {
    Revision: ModelStatic<T>;
    RevisionChange?: ModelStatic<U>;
  } {
    const Revision = this.sequelize.define<T>(
      this.options.revisionModel,
      this.getRevisionAttributes(),
      {
        tableName: this.options.tableName,
        createdAt: this.createdAtAttribute,
        updatedAt: this.updatedAtAttribute,
        underscored: this.options.underscored,
      }
    );

    if (this.options.userModel) {
      Revision.belongsTo(this.sequelize.model(this.options.userModel), {
        foreignKey: this.options.userIdAttribute,
        ...this.options.belongsToUserOptions,
      });
    }

    if (this.options.enableRevisionChangeModel) {
      const RevisionChange = this.sequelize.define<U>(
        this.options.revisionChangeModel,
        this.getRevisionChangeAttributes(),
        {
          tableName: this.options.changeTableName,
          createdAt: this.createdAtAttribute,
          updatedAt: this.updatedAtAttribute,
          underscored: this.options.underscored,
        }
      );

      Revision.hasMany(RevisionChange, {
        foreignKey: this.options.revisionIdAttribute,
        constraints: false,
      });

      RevisionChange.belongsTo(Revision, {
        foreignKey: this.options.revisionIdAttribute,
      });

      return { Revision, RevisionChange };
    }
    return { Revision };
  }

  public async trackRevision(
    model: ModelDefined<any, any>,
    options: { exclude?: string[] } = {}
  ): Promise<void> {
    debugConsole("track revisions on %s", model.name);

    this.addRevisionAttribute(model);
    if (this.options.enableMigration) {
      await this.addRevisionColumn(model);
    }

    const modelExclude = options.exclude || [];
    model.addHook(
      "beforeCreate",
      this.createBeforeHook("create", modelExclude)
    );
    model.addHook(
      "beforeDestroy",
      this.createBeforeHook("destroy", modelExclude)
    );
    model.addHook(
      "beforeUpdate",
      this.createBeforeHook("update", modelExclude)
    );
    model.addHook(
      "beforeUpsert",
      this.createBeforeHook("upsert", modelExclude)
    );
    model.addHook("afterCreate", this.createAfterHook("create", modelExclude));
    model.addHook(
      "afterDestroy",
      this.createAfterHook("destroy", modelExclude)
    );
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

  /**
   * Throw exceptions when the user identifier from cls-hooked is not set or if the
   * revisionAttribute was not loaded on the model.
   */
  enableFailHard() {
    this.failHard = true;
  }

  private getRevisionAttributes(): ModelAttributes {
    const attributes: ModelAttributes = {
      model: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      document: {
        type: this.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
      [this.documentIdAttribute]: {
        type: this.options.UUID ? DataTypes.UUID : DataTypes.INTEGER,
        allowNull: false,
      },
      operation: DataTypes.STRING(7),
      [this.options.revisionAttribute]: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    };

    if (this.options.UUID) {
      attributes.id = {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
        type: this.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
      diff: {
        type: this.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT("medium"),
        allowNull: false,
      },
    };

    if (this.options.UUID) {
      attributes.id = {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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

  private async addRevisionColumn(
    model: ModelDefined<any, any>
  ): Promise<void> {
    const tableName = model.getTableName();
    const queryInterface = this.sequelize.getQueryInterface();
    const attributes = await queryInterface.describeTable(tableName);
    if (!attributes[this.options.revisionAttribute]) {
      debugConsole("add revision column to %s", tableName);
      try {
        await queryInterface.addColumn(
          tableName,
          this.options.revisionAttribute,
          {
            type: DataTypes.INTEGER,
          }
        );
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

      const { previousVersion, currentVersion } = this.getVersions(
        operation,
        instance,
        opt,
        exclude
      );

      // Disallow change of revision
      instance.set(
        this.options.revisionAttribute,
        instance._previousDataValues[this.options.revisionAttribute]
      );

      const delta = calcDelta(
        previousVersion,
        currentVersion,
        exclude,
        this.options.enableStrictDiff
      );

      const currentRevisionId = instance.get(this.options.revisionAttribute);
      if (this.failHard && !currentRevisionId && opt.type === "UPDATE") {
        throw new Error("Revision Id was undefined");
      }

      debugConsole("delta: %O", delta);
      debugConsole("revisionId: %s", currentRevisionId);

      // Check if all required fields have been provided to the opts / cls-hooked
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
    const requiredFields = keys(
      pickBy(this.options.metaDataFields, (required) => required)
    );
    if (requiredFields && requiredFields.length) {
      const metaData = {
        ...opt.revisionMetaData,
        ...(this.ns && this.ns.get(this.options.metaDataContinuationKey)),
      };
      const requiredFieldsProvided = filter(
        requiredFields,
        (field) => metaData[field] !== undefined
      );
      if (requiredFieldsProvided.length !== requiredFields.length) {
        debugConsole(
          "required fields: ",
          this.options.metaDataFields,
          requiredFields
        );
        debugConsole(
          "required fields provided: ",
          metaData,
          requiredFieldsProvided
        );
        throw new Error("Not all required fields are provided");
      }
    }
  }

  private getVersions(
    operation: string,
    instance: any,
    opt: any,
    exclude: string[]
  ): { previousVersion: any; currentVersion: any } {
    const destroyOperation = operation === "destroy";

    let previousVersion: any = {};
    let currentVersion: any = {};
    if (!destroyOperation && this.options.enableCompression) {
      forEach(opt.defaultFields, (a) => {
        previousVersion[a] = instance._previousDataValues[a];
        currentVersion[a] = instance.dataValues[a];
      });
    } else {
      previousVersion = instance._previousDataValues;
      currentVersion = instance.dataValues;
    }

    // Supported nested models.
    previousVersion = pick(previousVersion, keys(instance.rawAttributes));
    previousVersion = omit(previousVersion, exclude);
    previousVersion = omitBy(previousVersion, isUndefined);

    currentVersion = pick(currentVersion, keys(instance.rawAttributes));
    currentVersion = omit(currentVersion, exclude);
    currentVersion = omitBy(currentVersion, isUndefined);

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

      if (this.ns) {
        debugConsole(
          `cls-hooked ${this.options.continuationKey}: %s`,
          this.ns.get(this.options.continuationKey)
        );
      }

      const destroyOperation = operation === "destroy";

      if (
        instance.context &&
        ((instance.context.delta && instance.context.delta.length > 0) ||
          destroyOperation)
      ) {
        const { currentVersion } = this.getVersions(
          operation,
          instance,
          opt,
          exclude
        );

        this.checkContinuationKey();

        let document = currentVersion;
        if (!this.useJsonDataType) {
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
            ...(this.ns && this.ns.get(this.options.metaDataContinuationKey)),
          };
          if (metaData) {
            forEach(this.options.metaDataFields, (required, field) => {
              const value = metaData[field];
              debugConsole("add metaData to revisions %s: %s", field, value);
              if (!(field in query)) {
                query[field] = value;
              } else {
                debugConsole(
                  "revision already has a value %s: %s",
                  field,
                  query[field]
                );
              }
            });
          }
        }

        // in case of custom user models that are not 'userId'
        query[this.options.userIdAttribute] =
          (this.ns && this.ns.get(this.options.continuationKey)) || opt.userId;
        query[this.documentIdAttribute] = instance.id;

        const Revision = this.sequelize.model(this.options.revisionModel);
        const revision: any = Revision.build(query);
        revision[this.options.revisionAttribute] = instance.get(
          this.options.revisionAttribute
        );

        try {
          const savedRevision = await revision.save({
            transaction: opt.transaction,
          });
          if (this.options.enableRevisionChangeModel) {
            const RevisionChange = this.sequelize.model(
              this.options.revisionChangeModel
            );
            await Promise.all(
              map(instance.context.delta, async (document) => {
                let diff = this.calcDiff(document);

                if (!this.useJsonDataType) {
                  document = JSON.stringify(document);
                  diff = JSON.stringify(diff);
                }

                const revisionChange = RevisionChange.build({
                  path: document.path[0],
                  document,
                  diff,
                  revisionId: savedRevision.id,
                });

                try {
                  const savedRevisionChange = await revisionChange.save({
                    transaction: opt.transaction,
                  });
                  savedRevision[
                    `add${capitalizeFirstLetter(
                      this.options.revisionChangeModel
                    )}`
                  ](savedRevisionChange);
                } catch (err) {
                  debugConsole("revision change save error", err);
                  throw err;
                }
              })
            );
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
    if (
      this.failHard &&
      this.ns &&
      !this.ns.get(this.options.continuationKey)
    ) {
      throw new Error(
        `The cls-hooked continuationKey ${this.options.continuationKey} was not defined.`
      );
    }
  }

  private calcDiff(document: any): any {
    const o = diffToString(document.item ? document.item.lhs : document.lhs);
    const n = diffToString(document.item ? document.item.rhs : document.rhs);
    return o || n ? jsdiff.diffChars(o, n) : [];
  }
}
