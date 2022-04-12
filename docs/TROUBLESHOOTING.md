# Troubleshooting

- [Revisions are not loggeed when running bulk operations](#revisions-are-not-loggeed-when-running-bulk-operations)
- [Revisions are logged for upsert operations even if there is no change in attributes](#revisions-are-logged-for-upsert-operations-even-if-there-is-no-change-in-attributes)
- [Composite key is not supported](#composite-key-is-not-supported)

## Revisions are not loggeed when running bulk operations

Sequelize Revision logs records when [hooks](https://sequelize.org/docs/v6/other-topics/hooks/) (also known as lifecycle events) are triggered in Sequelize.

By default, hooks are not triggered when you run bulk operations as below.

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

## Revisions are logged for upsert operations even if there is no change in attributes

Sequelize Revision supports upsert operations as below.

```typescript
const attributes = { id: 1, name: "sequelize-revision" };
await Model.upsert(attributes);
```

In this example, a project record is either created or updated.

Sequelize Revision does not log revisions for update operations when there is no chnage in attributes.
However, for upsert operations, revisions will be logged regardless of changes in attributes.

If you need to avoid logging revisions when there is no change in attributes,
you need to send send separate queries as below

```typescript
if (attributes.id) {
  const model = await Model.findByPk(attributes.id);
  await model.update(attributes);
} else {
  await model.insert(attributes);
}
```

## Composite key is not supported

Sequelize Revision does not support models with composite primary keys. You can work around using a unique index with multiple fields.