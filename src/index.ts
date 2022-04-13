import { forEach, map, filter, keys, omit, omitBy, pickBy } from "lodash";
import { Sequelize, Model, ModelAttributes, DataTypes } from "sequelize";
import { ModelDefined } from "sequelize/types/model";
import { createNamespace, getNamespace, Namespace } from "cls-hooked";
import * as jsdiff from "diff";
import helpers from "./helpers";
import { Options, SequelizeRevisionOptions, defaultOptions } from "./options";

export class SequelizeRevision {
  private options: Options;
  private ns: Namespace | undefined;
  private log: (...data: any[]) => void;
  private failHard = false;
  Revision: ModelDefined<any, any>;
  RevisionChange?: ModelDefined<any, any>;

  constructor(
    private sequelize: Sequelize,
    sequelizeRevisionOptions?: SequelizeRevisionOptions
  ) {
    this.options = <Options>{
      ...defaultOptions,
      useJsonDataType: this.sequelize.getDialect() !== "mssql",
      ...sequelizeRevisionOptions,
    };

    if (this.options.continuationNamespace) {
      this.ns = getNamespace(this.options.continuationNamespace);
      if (!this.ns) {
        this.ns = createNamespace(this.options.continuationNamespace);
      }
    }

    if (this.options.underscoredAttributes) {
      helpers.toUnderscored(this.options.defaultAttributes);
    }

    this.log = this.options.log || console.log;

    // Attributes for RevisionModel
    const revisionAttributes: ModelAttributes = {
      model: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      document: {
        type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT,
        allowNull: false,
      },
      [this.options.defaultAttributes.documentId]: {
        type: this.options.UUID ? DataTypes.INTEGER : DataTypes.UUID,
        allowNull: false,
      },
      operation: DataTypes.STRING(7),
      [this.options.revisionAttribute]: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    };

    if (this.options.UUID) {
      revisionAttributes.id = {
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      };
    }

    if (this.options.debug) {
      this.log("attributes", revisionAttributes);
    }

    // Revision model
    this.Revision = this.sequelize.define(
      this.options.revisionModel,
      revisionAttributes,
      {
        underscored: this.options.underscored,
        tableName: this.options.tableName,
      }
    );

    if (this.options.enableRevisionChangeModel) {
      // Attributes for RevisionChangeModel
      const revisionChangeAttributes: ModelAttributes = {
        path: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        document: {
          type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT,
          allowNull: false,
        },
        diff: {
          type: this.options.useJsonDataType ? DataTypes.JSON : DataTypes.TEXT,
          allowNull: false,
        },
      };

      if (this.options.UUID) {
        revisionChangeAttributes.id = {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
        };
      }
      // RevisionChange model
      this.RevisionChange = this.sequelize.define(
        this.options.revisionChangeModel,
        revisionChangeAttributes,
        {
          underscored: this.options.underscored,
          tableName: this.options.changeTableName,
        }
      );
    }
  }

  // Return defineModels()
  public async defineModels(): Promise<{
    Revision: ModelDefined<any, any>;
    RevisionChange?: ModelDefined<any, any>;
  }> {
    if (this.options.userModel) {
      this.Revision.belongsTo(this.sequelize.model(this.options.userModel), {
        foreignKey: this.options.userModelAttribute,
        ...this.options.belongsToUserOptions,
      });
    }

    if (this.options.enableMigration) {
      await this.Revision.sync();
    }

    if (this.RevisionChange) {
      // Set associations
      this.Revision.hasMany(this.RevisionChange, {
        foreignKey: this.options.defaultAttributes.revisionId,
        constraints: false,
      });

      this.RevisionChange.belongsTo(this.Revision, {
        foreignKey: this.options.defaultAttributes.revisionId,
      });

      if (this.options.enableMigration) {
        await this.RevisionChange.sync();
      }

      return { Revision: this.Revision, RevisionChange: this.RevisionChange };
    }

    return { Revision: this.Revision };
  }

  // order in which sequelize processes the hooks
  // (1)
  // beforeBulkCreate(instances, options, fn)
  // beforeBulkDestroy(instances, options, fn)
  // beforeBulkUpdate(instances, options, fn)
  // (2)
  // beforeValidate(instance, options, fn)
  // (-)
  // validate
  // (3)
  // afterValidate(instance, options, fn)
  // - or -
  // validationFailed(instance, options, error, fn)
  // (4)
  // beforeCreate(instance, options, fn)
  // beforeDestroy(instance, options, fn)
  // beforeUpdate(instance, options, fn)
  // (-)
  // create
  // destroy
  // update
  // (5)
  // afterCreate(instance, options, fn)
  // afterDestroy(instance, options, fn)
  // afterUpdate(instance, options, fn)
  // (6)
  // afterBulkCreate(instances, options, fn)
  // afterBulkDestroy(instances, options, fn)
  // afterBulkUpdate(instances, options, fn)

  // Extend model prototype with "trackRevision" function
  // Call model.trackRevision() to enable revisions for model
  public async trackRevision(
    model: ModelDefined<any, any>,
    options: { exclude?: string[] } = {}
  ): Promise<void> {
    if (this.options.debug) {
      this.log("Enabling paper trail on", model.name);
    }

    model.rawAttributes[this.options.revisionAttribute] = {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    model.refreshAttributes();

    if (this.options.enableMigration) {
      const tableName = model.getTableName();

      const queryInterface = this.sequelize.getQueryInterface();

      const attributes = await queryInterface.describeTable(tableName);
      if (!attributes[this.options.revisionAttribute]) {
        if (this.options.debug) {
          this.log("adding revision attribute to the database");
        }

        try {
          await queryInterface.addColumn(
            tableName,
            this.options.revisionAttribute,
            {
              type: DataTypes.INTEGER,
              defaultValue: 0,
            }
          );
        } catch (err) {
          this.log("something went really wrong..", err);
        }
      }
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

    // create association
    model.hasMany(this.sequelize.models[this.options.revisionModel], {
      foreignKey: this.options.defaultAttributes.documentId,
      constraints: false,
      scope: {
        model: model.name,
      },
    });
  }

  /**
   * Throw exceptions when the user identifier from CLS is not set or if the
   * revisionAttribute was not loaded on the model.
   */
  enableFailHard() {
    this.failHard = true;
  }

  private createBeforeHook(operation: string, modelExclude: string[]) {
    const exclude = [...this.options.exclude, ...modelExclude];
    return (instance: any, opt: any) => {
      if (!(instance instanceof Model) && opt.instance instanceof Model) {
        instance = opt.instance;
      }

      if (this.options.debug) {
        this.log("beforeHook called");
        this.log("instance:", instance);
        this.log("opt:", opt);
      }

      if (opt.noRevision) {
        if (this.options.debug) {
          this.log("noRevision opt: is true, not logging");
        }
        return;
      }

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
      previousVersion = omitBy(
        previousVersion,
        (i) => i != null && typeof i === "object" && !(i instanceof Date)
      );
      previousVersion = omit(previousVersion, exclude);

      currentVersion = omitBy(
        currentVersion,
        (i) => i != null && typeof i === "object" && !(i instanceof Date)
      );
      currentVersion = omit(currentVersion, exclude);

      // Disallow change of revision
      instance.set(
        this.options.revisionAttribute,
        instance._previousDataValues[this.options.revisionAttribute]
      );

      // Get diffs
      const delta = helpers.calcDelta(
        previousVersion,
        currentVersion,
        exclude,
        this.options.enableStrictDiff
      );

      const currentRevisionId = instance.get(this.options.revisionAttribute);

      if (this.failHard && !currentRevisionId && opt.type === "UPDATE") {
        throw new Error("Revision Id was undefined");
      }

      if (this.options.debug) {
        this.log("delta:", delta);
        this.log("revisionId", currentRevisionId);
      }
      // Check if all required fields have been provided to the opts / CLS
      if (this.options.metaDataFields) {
        // get all required field keys as an array
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
            this.log(
              "Required fields: ",
              this.options.metaDataFields,
              requiredFields
            );
            this.log(
              "Required fields provided: ",
              metaData,
              requiredFieldsProvided
            );
            throw new Error(
              "Not all required fields are provided to paper trail!"
            );
          }
        }
      }

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

      if (this.options.debug) {
        this.log("end of beforeHook");
      }
    };
  }

  private createAfterHook(operation: string, modelExclude: string[]) {
    const exclude = [...this.options.exclude, ...modelExclude];
    return async (instance: any, opt: any) => {
      if (instance instanceof Array) {
        instance = instance[0];
      }

      if (this.options.debug) {
        this.log("afterHook called");
        this.log("instance:", instance);
        this.log("opt:", opt);
        if (this.ns) {
          this.log(
            `CLS ${this.options.continuationKey}:`,
            this.ns.get(this.options.continuationKey)
          );
        }
      }

      const destroyOperation = operation === "destroy";

      if (
        instance.context &&
        ((instance.context.delta && instance.context.delta.length > 0) ||
          destroyOperation)
      ) {
        const Revision = this.sequelize.model(this.options.revisionModel);
        let RevisionChange: ModelDefined<any, any>;

        if (this.options.enableRevisionChangeModel) {
          RevisionChange = this.sequelize.model(
            this.options.revisionChangeModel
          );
        }

        const { delta } = instance.context;

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
        previousVersion = omitBy(
          previousVersion,
          (i) => i != null && typeof i === "object" && !(i instanceof Date)
        );
        previousVersion = omit(previousVersion, exclude);

        currentVersion = omitBy(
          currentVersion,
          (i) => i != null && typeof i === "object" && !(i instanceof Date)
        );
        currentVersion = omit(currentVersion, exclude);

        if (
          this.failHard &&
          this.ns &&
          !this.ns.get(this.options.continuationKey)
        ) {
          throw new Error(
            `The CLS continuationKey ${this.options.continuationKey} was not defined.`
          );
        }

        let document = currentVersion;

        if (!this.options.useJsonDataType) {
          document = JSON.stringify(document);
        }

        // Build revision
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
              if (this.options.debug) {
                this.log(
                  `Adding metaData field to Revision - ${field} => ${value}`
                );
              }
              if (!(field in query)) {
                query[field] = value;
              } else if (this.options.debug) {
                this.log(
                  `Revision object already has a value at ${field} => ${query[field]}`
                );
                this.log("Not overwriting the original value");
              }
            });
          }
        }

        // in case of custom user models that are not 'userId'
        query[this.options.userModelAttribute] =
          (this.ns && this.ns.get(this.options.continuationKey)) || opt.userId;

        query[this.options.defaultAttributes.documentId] = instance.id;

        const revision: any = Revision.build(query);

        revision[this.options.revisionAttribute] = instance.get(
          this.options.revisionAttribute
        );

        // Save revision
        try {
          const objectRevision = await revision.save({
            transaction: opt.transaction,
          });
          // Loop diffs and create a revision-diff for each
          if (this.options.enableRevisionChangeModel) {
            await Promise.all(
              map(delta, async (difference) => {
                const o = helpers.diffToString(
                  difference.item ? difference.item.lhs : difference.lhs
                );
                const n = helpers.diffToString(
                  difference.item ? difference.item.rhs : difference.rhs
                );

                // let document = difference;
                document = difference;
                let diff: any = o || n ? jsdiff.diffChars(o, n) : [];

                if (!this.options.useJsonDataType) {
                  document = JSON.stringify(document);
                  diff = JSON.stringify(diff);
                }

                const d = RevisionChange.build({
                  path: difference.path[0],
                  document,
                  diff,
                  revisionId: objectRevision.id,
                });

                try {
                  const savedD = await d.save({ transaction: opt.transaction });
                  // Add diff to revision
                  objectRevision[
                    `add${helpers.capitalizeFirstLetter(
                      this.options.revisionChangeModel
                    )}`
                  ](savedD);
                } catch (err) {
                  this.log("RevisionChange save error", err);
                  throw err;
                }
              })
            );
          }
        } catch (err) {
          this.log("Revision save error", err);
          throw err;
        }
      }

      if (this.options.debug) {
        this.log("end of afterHook");
      }
    };
  }
}
