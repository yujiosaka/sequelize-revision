'use strict';
var sequelizePaperTrailOptions = {
  revisionAttribute: 'revision',
  revisionModel: 'Revisions',
  revisionChangeModel: 'RevisionChange',
  enableRevisionChangeModel: false,
  UUID: false,
  underscored: true,
  underscoredAttributes: true,
  defaultAttributes: {
    documentId: 'document_id',
    revisionId: 'revision_id'
  },
  enableCompression: false,
  enableMigration: false,
  enableStrictDiff: true,
  continuationKey: 'userId',
  // used when associating the revision model to user
  belongsToUserOptions: {
    foreignKey: 'userId',
  },
  // fields which can be provided in either in the opts.extraData
  // OR
  // CLS 'extraData' as object - keys will be looped over, and checked that they don't overwrite any existing ones in the revision model
  // true/false shows whether the key is required or not
  extraDataFields: {
  },
  extraDataContinuationKey: null,
};

module.exports = {
  up: function (queryInterface, Sequelize) {
    // Load default options.
    sequelizePaperTrailOptions.defaultAttributes = {
      documentId: 'document_id',
      revisionId: 'revision_id'
    };

    // Revision model
    var attributes = {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      model: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      document: {
        type: Sequelize.TEXT('MEDIUMTEXT'),
        allowNull: false
      },
      'user_id': {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      operation: {
        type: Sequelize.STRING(7),
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    };
    attributes[sequelizePaperTrailOptions.defaultAttributes.documentId] = {
      type: Sequelize.INTEGER,
      allowNull: false
    };
    attributes[sequelizePaperTrailOptions.revisionAttribute] = {
      type: Sequelize.INTEGER,
      allowNull: false
    };

    queryInterface.createTable(sequelizePaperTrailOptions.revisionModel, attributes);


    attributes = {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      path: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      document: {
        type: Sequelize.TEXT('MEDIUMTEXT'),
        allowNull: false
      },
      diff: {
        type: Sequelize.TEXT('MEDIUMTEXT'),
        allowNull: false
      },
      revision_id: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    };

    // RevisionChange model
    queryInterface.createTable(sequelizePaperTrailOptions.revisionChangeModel, attributes);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.dropTable(sequelizePaperTrailOptions.revisionModel),
      queryInterface.dropTable(sequelizePaperTrailOptions.revisionChangeModel)
    ]);
  }
};
