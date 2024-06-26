import { DataTypes, Sequelize } from "sequelize";
import { ulid } from "ulid";
import { beforeEach, describe, expect, it } from "vitest";
import { SequelizeRevision } from "../src/index.js";
import { Project, ProjectSetting, User } from "./models.js";
import "../src/sequelize-extension.js";
import { AsyncLocalStorage } from "async_hooks";

describe.each([["serial"], ["uuid"], ["ulid"]])("SequelizeRevision (primaryKeyType: %s)", (primaryKeyType) => {
  let sequelize: Sequelize;
  let RevisionChange: any;
  let Revision: any;
  let user: User;
  let primaryKeyLength: number;

  beforeEach(async () => {
    sequelize = new Sequelize({
      dialect: "sqlite",
      storage: ":memory:",
      logging: false,
    });

    let id;
    let projectId;
    if (primaryKeyType === "serial") {
      projectId = { type: DataTypes.INTEGER, primaryKey: true };
      id = { ...projectId, autoIncrement: true };
      primaryKeyLength = 1;
    } else if (primaryKeyType === "uuid") {
      projectId = { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 };
      id = { ...projectId };
      primaryKeyLength = 36;
    } else if (primaryKeyType === "ulid") {
      projectId = { type: DataTypes.STRING, primaryKey: true, defaultValue: ulid };
      id = { ...projectId };
      primaryKeyLength = 26;
    } else {
      throw new Error(`primaryKeyType: ${primaryKeyType} is not supported`);
    }

    Project.init(
      {
        id,
        name: {
          type: DataTypes.STRING,
        },
        version: {
          type: DataTypes.BIGINT,
        },
        info: {
          type: DataTypes.JSON,
        },
        revision: {
          type: DataTypes.INTEGER,
        },
      },
      { sequelize },
    );

    ProjectSetting.init(
      {
        project_id: projectId,
        key: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        value: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      { sequelize },
    );

    User.init(
      {
        id,
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      { sequelize },
    );

    await sequelize.sync();

    user = await User.create({ name: "yujiosaka" });
  });

  describe("logging revisions", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("does not log revisions when creating a project and a project setting with noRevision=true", async () => {
      const project = await Project.create({ name: "sequelize-revision", version: 1 }, { noRevision: true });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" }, { noRevision: true });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when creating a project and a project setting", async () => {
      const project = await Project.create({ name: "sequelize-revision", version: 1 });
      expect(project.revision).toBe(1);

      const projectSetting = await ProjectSetting.create({
        project_id: project.id,
        key: "version",
        value: "1",
      });
      expect(projectSetting.revision).toBe(1);

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[0].operation).toBe("create");
      expect(revisions[0].revision).toBe(1);

      expect(revisions[1].model).toBe("ProjectSetting");
      expect(revisions[1].document).toEqual({
        project_id: project.id,
        key: "version",
        value: "1",
      });
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].documentIds).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[1].operation).toBe("create");
      expect(revisions[1].revision).toBe(1);
    });

    it("does not log revisions when updating a project and a project setting with noRevision=true", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: 1 }, { noRevision: true });

      const projectSetting = await ProjectSetting.create(
        { project_id: project.id, key: "version", value: "1" },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" }, { noRevision: true });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("does not log revisions when updating a project and a project setting with the same versions", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: 1 });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "1" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when updating a project and a project setting", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision" });
      await project.update({ version: 2 });
      expect(project.revision).toBe(2);

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" });
      expect(projectSetting.revision).toBe(1);

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);

      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[0].operation).toBe("update");
      expect(revisions[0].revision).toBe(1);

      expect(revisions[1].model).toBe("Project");
      expect(revisions[1].document).toEqual({
        name: "sequelize-revision",
        version: 2,
      });
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[1].operation).toBe("update");
      expect(revisions[1].revision).toBe(2);

      expect(revisions[2].model).toBe("ProjectSetting");
      expect(revisions[2].document).toEqual({
        project_id: project.id,
        key: "version",
        value: "2",
      });
      expect(revisions[2].documentId).toBe(project.id);
      expect(revisions[2].documentIds).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[2].operation).toBe("update");
      expect(revisions[2].revision).toBe(1);
    });

    it("logs revisions when updating a project and a project setting in different types", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: "1" });
      expect(project.revision).toBe(1);

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ key: "sequelize-revision", value: 1 });
      expect(projectSetting.revision).toBe(1);

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        version: "1",
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[0].operation).toBe("update");
      expect(revisions[0].revision).toBe(1);

      expect(revisions[1].model).toBe("ProjectSetting");
      expect(revisions[1].document).toEqual({
        project_id: project.id,
        key: "version",
        value: 1,
      });
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].documentIds).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[1].operation).toBe("update");
      expect(revisions[1].revision).toBe(1);
    });

    it("does not log revisions when failing a transaction", async () => {
      try {
        await sequelize.transaction(async (transaction) => {
          const project = await Project.create({ name: "sequelize-paper-trail", version: 1 }, { transaction });
          await project.update({ name: "sequelize-revision" }, { transaction });
          await project.destroy({ transaction });

          const projectSetting = await ProjectSetting.create(
            { project_id: project.id, key: "version", value: "1" },
            { transaction },
          );
          await projectSetting.update({ value: "2" }, { transaction });
          await projectSetting.destroy({ transaction });

          throw new Error("Transaction is failed");
        });
      } catch {
        // ignore error
      }
      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when deleting a project and a project setting", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.destroy();
      expect(project.revision).toBe(1);

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.destroy();
      expect(projectSetting.revision).toBe(1);

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[0].operation).toBe("destroy");
      expect(revisions[0].revision).toBe(1);

      expect(revisions[1].model).toBe("ProjectSetting");
      expect(revisions[1].document).toEqual({
        project_id: project.id,
        key: "version",
        value: "1",
      });
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].documentIds).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[1].operation).toBe("destroy");
      expect(revisions[1].revision).toBe(1);
    });
  });

  describe("logging revisions for upsert", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("does not log revisions when upserting a project and a project setting with noRevision=true", async () => {
      let [project] = await Project.upsert({ name: "sequelize-revision", version: 1 }, { noRevision: true });
      [project] = await Project.upsert({ id: project.id, version: 2 }, { noRevision: true });

      await ProjectSetting.upsert({ project_id: project.id, key: "version", value: "1" }, { noRevision: true });
      await ProjectSetting.upsert({ project_id: project.id, key: "version", value: "2" }, { noRevision: true });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    // NOTE:
    // sequelize does not read the previous data
    // when a record already exists id during the upsert operation,
    // so both revision.revision and project.revision reset to `1`.
    it("logs revisions when upserting a project and a project setting", async () => {
      let [project] = await Project.upsert({ name: "sequelize-revision", version: 1 });
      expect(project.revision).toBe(1);

      [project] = await Project.upsert({ id: project.id, name: "sequelize-revision", version: 2 });
      expect(project.revision).toBe(1);

      let [projectSetting] = await ProjectSetting.upsert({ project_id: project.id, key: "version", value: "1" });
      expect(project.revision).toBe(1);

      [projectSetting] = await ProjectSetting.upsert({
        project_id: project.id,
        key: "version",
        value: "2",
      });
      expect(projectSetting.revision).toBe(1);

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(4);

      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[0].operation).toBe("upsert");
      expect(revisions[0].revision).toBe(1);

      expect(revisions[1].model).toBe("Project");
      expect(revisions[1].document).toEqual({
        name: "sequelize-revision",
        version: 2,
      });
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].documentIds).toStrictEqual({ id: project.id });
      expect(revisions[1].operation).toBe("upsert");
      expect(revisions[1].revision).toBe(1);

      expect(revisions[2].model).toBe("ProjectSetting");
      expect(revisions[2].document).toEqual({
        project_id: project.id,
        key: "version",
        value: "1",
      });
      expect(revisions[2].documentId).toBe(project.id);
      expect(revisions[2].documentIds).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[2].operation).toBe("upsert");
      expect(revisions[2].revision).toBe(1);

      expect(revisions[3].model).toBe("ProjectSetting");
      expect(revisions[3].document).toEqual({
        project_id: project.id,
        key: "version",
        value: "2",
      });
      expect(revisions[3].documentId).toBe(project.id);
      expect(revisions[3].documentIds).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[3].operation).toBe("upsert");
      expect(revisions[3].revision).toBe(1);
    });

    it("does not log revisions when failing a transaction", async () => {
      try {
        await sequelize.transaction(async (transaction) => {
          let [project] = await Project.upsert(
            {
              name: "sequelize-revision",
              version: 1,
            },
            { transaction },
          );
          [project] = await Project.upsert({ id: project.id, name: "sequelize-revision", version: 2 }, { transaction });

          await ProjectSetting.upsert(
            {
              project_id: project.id,
              key: "version",
              value: "1",
            },
            { transaction },
          );
          await ProjectSetting.upsert(
            {
              project_id: project.id,
              key: "version",
              value: "2",
            },
            { transaction },
          );
          throw new Error("Transaction is failed");
        });
      } catch {
        // ignore error
      }
      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revision changes", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        enableRevisionChangeModel: true,
      });
      [Revision, RevisionChange] = sequelizeRevision.defineModels();

      await Revision.sync();
      await RevisionChange.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("does not log revisionChanges when creating a project and a project setting with noRevision=true", async () => {
      const project = await Project.create({ name: "sequelize-revision", version: 1 }, { noRevision: true });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" }, { noRevision: true });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("logs revision changes when creating a project and a project setting", async () => {
      const project = await Project.create({ name: "sequelize-revision", version: 1 });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(5);

      expect(revisionChanges[0].path).toBe("name");
      expect(revisionChanges[0].document).toEqual({
        kind: "N",
        path: ["name"],
        rhs: "sequelize-revision",
      });
      expect(revisionChanges[0].diff).toEqual([{ added: true, count: 18, value: "sequelize-revision" }]);
      expect(revisionChanges[0].revisionId).toBe(revisions[0].id);

      expect(revisionChanges[1].path).toBe("version");
      expect(revisionChanges[1].document).toEqual({
        kind: "N",
        path: ["version"],
        rhs: 1,
      });
      expect(revisionChanges[1].revisionId).toBe(revisions[0].id);

      expect(revisionChanges[2].path).toBe("project_id");
      expect(revisionChanges[2].document).toEqual({
        kind: "N",
        path: ["project_id"],
        rhs: project.id,
      });
      expect(revisionChanges[2].diff).toEqual([{ added: true, count: primaryKeyLength, value: project.id.toString() }]);
      expect(revisionChanges[2].revisionId).toBe(revisions[1].id);
    });

    it("does not log revisionChanges when updating a project and a project setting with noRevision=true", async () => {
      const project = await Project.create({ name: "sequelize-revision", version: 1 }, { noRevision: true });
      await project.update({ name: "sequelize-revision", version: 1 }, { noRevision: true });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" }, { noRevision: true });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("does not log revisionChanges when updating a project and a project setting with same versions", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: 1 });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "1" });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("logs revision changes when updating a project and a project setting", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision" });
      await project.update({ version: 2 });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(3);

      expect(revisionChanges[0].path).toBe("name");
      expect(revisionChanges[0].document).toEqual({
        kind: "E",
        path: ["name"],
        lhs: "sequelize-paper-trail",
        rhs: "sequelize-revision",
      });
      expect(revisionChanges[0].revisionId).toBe(revisions[0].id);

      expect(revisionChanges[1].path).toBe("version");
      expect(revisionChanges[1].document).toEqual({
        kind: "E",
        path: ["version"],
        lhs: 1,
        rhs: 2,
      });
      expect(revisionChanges[1].revisionId).toBe(revisions[1].id);

      expect(revisionChanges[2].path).toBe("value");
      expect(revisionChanges[2].document).toEqual({
        kind: "E",
        path: ["value"],
        lhs: "1",
        rhs: "2",
      });
      expect(revisionChanges[2].revisionId).toBe(revisions[2].id);
    });

    it("logs revision changes when updating a project and a project setting in different types", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: "1" });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: 1 });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(2);

      expect(revisionChanges[0].path).toBe("version");
      expect(revisionChanges[0].document).toEqual({
        kind: "E",
        path: ["version"],
        lhs: 1,
        rhs: "1",
      });
      expect(revisionChanges[0].revisionId).toBe(revisions[0].id);

      expect(revisionChanges[1].path).toBe("value");
      expect(revisionChanges[1].document).toEqual({
        kind: "E",
        path: ["value"],
        lhs: "1",
        rhs: 1,
      });
      expect(revisionChanges[1].revisionId).toBe(revisions[1].id);
    });

    it("does not log revisionChanges when failing a transaction", async () => {
      try {
        await sequelize.transaction(async (transaction) => {
          const project = await Project.create({ name: "sequelize-paper-trail", version: 1 }, { transaction });
          await project.update({ name: "sequelize-revision" }, { transaction });
          await project.destroy({ transaction });

          const projectSetting = await ProjectSetting.create(
            { project_id: project.id, key: "version", value: "1" },
            { transaction },
          );
          await projectSetting.update({ value: "2" }, { transaction });
          await projectSetting.destroy({ transaction });

          throw new Error("Transaction is failed");
        });
      } catch {
        // ignore error
      }
      const revisions = await RevisionChange.findAll();
      expect(revisions.length).toBe(0);
    });

    it("does not log revisionChanges when deleting a project and a project setting", async () => {
      const project = await Project.create({ name: "sequelize-revision", version: 1 }, { noRevision: true });
      await project.destroy();

      const projectSetting = await ProjectSetting.create(
        { project_id: project.id, key: "version", value: "1" },
        { noRevision: true },
      );
      await projectSetting.destroy();

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });
  });

  describe("logging revisions for JSON attributes", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        enableRevisionChangeModel: true,
      });
      [Revision, RevisionChange] = sequelizeRevision.defineModels();
      await Revision.sync();
      await RevisionChange.sync();
      await sequelizeRevision.trackRevision(Project);
    });

    it("logs revisions when creating a project with a JSON attribute", async () => {
      await Project.create({ name: "sequelize-revision", info: { language: "typescript" } });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(1);

      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        info: { language: "typescript" },
      });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(2);

      expect(revisionChanges[1].path).toBe("info");
      expect(revisionChanges[1].document).toEqual({
        kind: "N",
        path: ["info"],
        rhs: { language: "typescript" },
      });
    });

    it("does not log revisions when updating a project with the same JSON attribute", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          info: { language: "typescript" },
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", info: { language: "typescript" } });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("logs revisions when updating a JSON attribute", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          info: { language: "javascript" },
        },
        { noRevision: true },
      );
      await project.update({ info: { language: "typescript" } });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(1);

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(1);

      expect(revisionChanges[0].path).toBe("info");
      expect(revisionChanges[0].document).toEqual({
        kind: "E",
        path: ["info", "language"],
        lhs: "javascript",
        rhs: "typescript",
      });
    });

    it("does not log revisionChanges when deleting a JSON attribute", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          info: { language: "typescript" },
        },
        { noRevision: true },
      );
      await project.update({ info: null });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(1);

      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        info: null,
      });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(1);

      expect(revisionChanges[0].document).toEqual({
        kind: "E",
        path: ["info"],
        lhs: { language: "typescript" },
        rhs: null,
      });
    });
  });

  describe("tracking users", () => {
    const asyncLocalStorage = new AsyncLocalStorage();

    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        asyncLocalStorage,
        userModel: "User",
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("logs revisions without userId", async () => {
      const project = await Project.create({ name: "sequelize-paper-trail", version: 1 });
      await project.update({ name: "sequelize-revision" });
      await project.destroy();

      const projectSetting = await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });
      await projectSetting.update({ value: "2" });
      await projectSetting.destroy();

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(6);

      expect(revisions.map((revision: any) => revision.userId)).toEqual([null, null, null, null, null, null]);
    });

    it("logs revisions with userId in async local storage", async () => {
      await asyncLocalStorage.run(user.id, async () => {
        const project = await Project.create({ name: "sequelize-paper-trail", version: 1 });
        await project.update({ name: "sequelize-revision" });
        await project.destroy();

        const projectSetting = await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });
        await projectSetting.update({ value: "2" });
        await projectSetting.destroy();

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(6);

        expect(revisions.map((revision: any) => revision.userId)).toEqual([
          user.id,
          user.id,
          user.id,
          user.id,
          user.id,
          user.id,
        ]);
      });
    });

    it("logs revisions with userId in options", async () => {
      const project = await Project.create({ name: "sequelize-paper-trail", version: 1 }, { userId: user.id });
      await project.update({ name: "sequelize-revision" }, { userId: user.id });
      await project.destroy({ userId: user.id });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { userId: user.id },
      );
      await projectSetting.update({ value: "2" }, { userId: user.id });
      await projectSetting.destroy({ userId: user.id });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(6);

      expect(revisions.map((revision: any) => revision.userId)).toEqual([
        user.id,
        user.id,
        user.id,
        user.id,
        user.id,
        user.id,
      ]);
    });
  });

  describe("tracking users with underscored column names", () => {
    const asyncLocalStorage = new AsyncLocalStorage();

    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        asyncLocalStorage,
        userModel: "User",
        underscored: true,
        underscoredAttributes: true,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("logs revisions when creating a project and a project setting", async () => {
      await asyncLocalStorage.run(user.id, async () => {
        const project = await Project.create({ name: "sequelize-revision", version: 1 });

        await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });

        const revisions = await Revision.findAll();

        expect(revisions.length).toBe(2);

        expect(revisions[0].document_id).toBe(project.id);
        expect(revisions[0].document_ids).toStrictEqual({ id: project.id });
        expect(revisions[0].user_id).toBe(user.id);

        expect(revisions[1].document_id).toBe(project.id);
        expect(revisions[1].document_ids).toStrictEqual({ project_id: project.id, key: "version" });
        expect(revisions[1].user_id).toBe(user.id);
      });
    });

    it("logs revisions when updating a project and a project setting", async () => {
      await asyncLocalStorage.run(user.id, async () => {
        const project = await Project.create(
          {
            name: "sequelize-paper-trail",
            version: 1,
          },
          { noRevision: true },
        );
        await project.update({ name: "sequelize-revision" });

        const projectSetting = await ProjectSetting.create(
          {
            project_id: project.id,
            key: "version",
            value: "1",
          },
          { noRevision: true },
        );
        await projectSetting.update({ value: "2" });

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(2);

        expect(revisions[0].document_id).toBe(project.id);
        expect(revisions[0].document_ids).toStrictEqual({ id: project.id });
        expect(revisions[0].user_id).toBe(user.id);

        expect(revisions[1].document_id).toBe(project.id);
        expect(revisions[1].document_ids).toStrictEqual({ project_id: project.id, key: "version" });
        expect(revisions[1].user_id).toBe(user.id);
      });
    });

    it("logs revisions when deleting a project and a project setting", async () => {
      await asyncLocalStorage.run(user.id, async () => {
        const project = await Project.create(
          {
            name: "sequelize-revision",
            version: 1,
          },
          { noRevision: true },
        );
        await project.destroy();

        const projectSetting = await ProjectSetting.create(
          {
            project_id: project.id,
            key: "version",
            value: "1",
          },
          { noRevision: true },
        );
        await projectSetting.destroy();

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(2);

        expect(revisions[0].document_id).toBe(project.id);
        expect(revisions[0].document_ids).toStrictEqual({ id: project.id });
        expect(revisions[0].user_id).toBe(user.id);

        expect(revisions[1].document_id).toBe(project.id);
        expect(revisions[1].document_ids).toStrictEqual({ project_id: project.id, key: "version" });
        expect(revisions[1].user_id).toBe(user.id);
      });
    });
  });

  describe("saving meta data", () => {
    const metaDataAsyncLocalStorage = new AsyncLocalStorage<Record<string, unknown>>();

    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        metaDataAsyncLocalStorage,
        metaDataFields: { userRole: false, server: false },
      });

      [Revision] = sequelizeRevision.defineModels();

      Revision.rawAttributes["userRole"] = {
        type: DataTypes.STRING,
      };
      Revision.rawAttributes["server"] = {
        type: DataTypes.STRING,
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      Revision.refreshAttributes();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("logs revisions without meta data", async () => {
      const project = await Project.create({ name: "sequelize-paper-trail", version: 1 });
      await project.update({ name: "sequelize-revision" });
      await project.destroy();

      const projectSetting = await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });
      await projectSetting.update({ value: "2" });
      await projectSetting.destroy();

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(6);

      expect(revisions.map((revision: any) => revision.userRole)).toEqual([null, null, null, null, null, null]);
    });

    it("logs revisions with meta data in async local storage", async () => {
      await metaDataAsyncLocalStorage.run({ userRole: "admin" }, async () => {
        const project = await Project.create({ name: "sequelize-paper-trail", version: 1 });
        await project.update({ name: "sequelize-revision" });
        await project.destroy();

        const projectSetting = await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });
        await projectSetting.update({ value: "2" });
        await projectSetting.destroy();

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(6);

        expect(revisions.map((revision: any) => revision.userRole)).toEqual([
          "admin",
          "admin",
          "admin",
          "admin",
          "admin",
          "admin",
        ]);
      });
    });

    it("logs revisions with meta data in options", async () => {
      const revisionMetaData = { server: "api" };
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { revisionMetaData },
      );
      await project.update({ name: "sequelize-revision" }, { revisionMetaData });
      await project.destroy({ revisionMetaData });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { revisionMetaData },
      );
      await projectSetting.update({ value: "2" }, { revisionMetaData });
      await projectSetting.destroy({ revisionMetaData });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(6);

      expect(revisions.map((revision: any) => revision.server)).toEqual(["api", "api", "api", "api", "api", "api"]);
    });

    it("logs revisions with meta data in both async local storage and options", async () => {
      await metaDataAsyncLocalStorage.run({ userRole: "admin" }, async () => {
        const revisionMetaData = { server: "api" };
        const project = await Project.create(
          {
            name: "sequelize-paper-trail",
            version: 1,
          },
          { revisionMetaData },
        );
        await project.update({ name: "sequelize-revision" }, { revisionMetaData });
        await project.destroy({ revisionMetaData });

        const projectSetting = await ProjectSetting.create(
          {
            project_id: project.id,
            key: "version",
            value: "1",
          },
          { revisionMetaData },
        );
        await projectSetting.update({ value: "2" }, { revisionMetaData });
        await projectSetting.destroy({ revisionMetaData });

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(6);

        expect(revisions.map((revision: any) => revision.userRole)).toEqual([
          "admin",
          "admin",
          "admin",
          "admin",
          "admin",
          "admin",
        ]);
        expect(revisions.map((revision: any) => revision.server)).toEqual(["api", "api", "api", "api", "api", "api"]);
      });
    });
  });

  describe("logging revisions for excluded attributes", () => {
    const exclude = [
      "id",
      "createdAt",
      "updatedAt",
      "deletedAt",
      "created_at",
      "updated_at",
      "deleted_at",
      "revision",
      "version",
      "value",
    ];

    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        exclude,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("does not log revision when updated attributes are excluded", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: 2 });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revisions for excludeed attributes for each model", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project, { exclude: ["version"] });
      await sequelizeRevision.trackRevision(ProjectSetting, { exclude: ["value"] });
    });

    it("does not log revision when updated attributes are excluded", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: 2 });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revisions with unstrict diff", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        enableStrictDiff: false,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("does not log revision when updating a project and a project setting in different types", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ name: "sequelize-revision", version: "1" });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ version: 1 });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revisions with compression", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        enableMigration: true,
        enableCompression: true,
      });
      [Revision] = sequelizeRevision.defineModels();

      await Revision.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("logs revisions with compressed document when updating a project and a project setting", async () => {
      const project = await Project.create(
        {
          name: "sequelize-revision",
          version: 1,
        },
        { noRevision: true },
      );
      await project.update({ version: 2 });

      const projectSetting = await ProjectSetting.create(
        {
          project_id: project.id,
          key: "version",
          value: "1",
        },
        { noRevision: true },
      );
      await projectSetting.update({ value: "2" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].document).toEqual({
        version: 2,
      });
      expect(revisions[1].document).toEqual({
        value: "2",
      });
    });
  });

  describe("using underscored table names and attributes", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        underscored: true,
        underscoredAttributes: true,
        tableName: "revisions",
        changeTableName: "revision_changes",
        enableMigration: true,
        enableRevisionChangeModel: true,
      });
      [Revision, RevisionChange] = sequelizeRevision.defineModels();

      await Revision.sync();
      await RevisionChange.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("has underscored table names", async () => {
      expect(Revision.tableName).toBe("revisions");
      expect(RevisionChange.tableName).toBe("revision_changes");
    });

    it("has underscored attributes in revisions", async () => {
      const project = await Project.create({ name: "sequelize-revision" });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].document_id).toBe(project.id);
      expect(revisions[0].document_ids).toStrictEqual({ id: project.id });
      expect(revisions[0].created_at).toBeTruthy();
      expect(revisions[0].updated_at).toBeTruthy();

      expect(revisions[1].document_id).toBe(project.id);
      expect(revisions[1].document_ids).toStrictEqual({ project_id: project.id, key: "version" });
      expect(revisions[1].created_at).toBeTruthy();
      expect(revisions[1].updated_at).toBeTruthy();
    });

    it("has underscored attributes in revision changes", async () => {
      const project = await Project.create({ name: "sequelize-revision" });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(4);

      expect(revisionChanges[0].revision_id).toBe(revisions[0].id);
      expect(revisionChanges[0].created_at).toBeTruthy();
      expect(revisionChanges[0].updated_at).toBeTruthy();

      expect(revisionChanges[1].revision_id).toBe(revisions[1].id);
      expect(revisionChanges[1].created_at).toBeTruthy();
      expect(revisionChanges[1].updated_at).toBeTruthy();

      expect(revisionChanges[2].revision_id).toBe(revisions[1].id);
      expect(revisionChanges[2].created_at).toBeTruthy();
      expect(revisionChanges[2].updated_at).toBeTruthy();
    });
  });

  describe("logging revisions without json data type", () => {
    beforeEach(async () => {
      const sequelizeRevision = new SequelizeRevision(sequelize, {
        primaryKeyType: primaryKeyType as "serial" | "uuid" | "ulid",
        useJsonDataType: false,
        enableMigration: true,
        enableRevisionChangeModel: true,
      });
      [Revision, RevisionChange] = sequelizeRevision.defineModels();

      await Revision.sync();
      await RevisionChange.sync();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(ProjectSetting);
    });

    it("has json data type in revisions", async () => {
      const project = await Project.create({ name: "sequelize-revision" });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].document).toBe(JSON.stringify({ name: "sequelize-revision" }));
      expect(revisions[0].documentIds).toBe(JSON.stringify({ id: project.id }));

      expect(revisions[1].document).toBe(JSON.stringify({ project_id: project.id, key: "version", value: "1" }));
      expect(revisions[1].documentIds).toBe(JSON.stringify({ project_id: project.id, key: "version" }));
    });

    it("has json data type in revision changes", async () => {
      const project = await Project.create({ name: "sequelize-revision" });

      await ProjectSetting.create({ project_id: project.id, key: "version", value: "1" });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(4);

      expect(revisionChanges[0].document).toBe(JSON.stringify({ kind: "N", path: ["name"], rhs: "sequelize-revision" }));
      expect(revisionChanges[0].diff).toBe(JSON.stringify([{ count: 18, added: true, value: "sequelize-revision" }]));

      expect(revisionChanges[1].document).toBe(JSON.stringify({ kind: "N", path: ["project_id"], rhs: project.id }));
      expect(revisionChanges[1].diff).toBe(
        JSON.stringify([{ count: primaryKeyLength, added: true, value: project.id.toString() }]),
      );

      expect(revisionChanges[2].document).toBe(JSON.stringify({ kind: "N", path: ["key"], rhs: "version" }));
      expect(revisionChanges[2].diff).toBe(JSON.stringify([{ count: 7, added: true, value: "version" }]));

      expect(revisionChanges[3].document).toBe(JSON.stringify({ kind: "N", path: ["value"], rhs: "1" }));
      expect(revisionChanges[3].diff).toBe(JSON.stringify([{ count: 1, added: true, value: "1" }]));
    });
  });
});
