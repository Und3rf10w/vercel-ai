import { createTransformer } from '../lib/create-transformer';

const renameMappings = {
  Message: 'UIMessage',
  CreateMessage: 'CreateUIMessage',
};

export default createTransformer((fileInfo, api, options, context) => {
  const { j, root } = context;

  // Track which identifiers were imported from 'ai' and should be renamed
  const importedFromAi = new Set<string>();

  // Find import declarations from 'ai' and collect the imported names
  root.find(j.ImportDeclaration).forEach(importPath => {
    const node = importPath.node;

    // Check if the source is 'ai'
    if (node.source.value !== 'ai') return;

    // Check named imports and rename them
    const specifiers =
      node.specifiers?.filter(s => j.ImportSpecifier.check(s)) ?? [];

    for (const specifier of specifiers) {
      if (
        specifier.type === 'ImportSpecifier' &&
        specifier.imported.type === 'Identifier' &&
        renameMappings[specifier.imported.name as keyof typeof renameMappings]
      ) {
        const oldName = specifier.imported.name;
        const newName = renameMappings[oldName as keyof typeof renameMappings];

        // Track the local name that should be renamed in the code
        const localName = specifier.local?.name || oldName;
        importedFromAi.add(localName);

        // Update the import name
        specifier.imported.name = newName;

        // If there's no alias, we also need to update the local name
        if (!specifier.local || specifier.local.name === oldName) {
          specifier.local = j.identifier(newName);
        }

        context.hasChanges = true;
      }
    }
  });

  // Only rename identifiers that were imported from 'ai'
  if (importedFromAi.size > 0) {
    root.find(j.Identifier).forEach(identifierPath => {
      const node = identifierPath.node;

      // Only rename if this identifier was imported from 'ai'
      if (
        importedFromAi.has(node.name) &&
        renameMappings[node.name as keyof typeof renameMappings]
      ) {
        // Skip if this identifier is part of an import declaration (already handled above)
        const parent = identifierPath.parent;
        if (
          parent &&
          (j.ImportSpecifier.check(parent.node) ||
            j.ImportDefaultSpecifier.check(parent.node) ||
            j.ImportNamespaceSpecifier.check(parent.node))
        ) {
          return;
        }

        // Skip if this is a property name in an object (e.g., { Message: something })
        if (
          parent &&
          j.Property.check(parent.node) &&
          parent.node.key === node
        ) {
          return;
        }

        // Rename the identifier
        node.name = renameMappings[node.name as keyof typeof renameMappings];
        context.hasChanges = true;
      }
    });
  }
});
