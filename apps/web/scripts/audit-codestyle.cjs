const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..');
const violations = [];
const walk = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', '.cache', '.vite'].includes(entry.name)) {
      return [];
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walk(entryPath);
    }

    return [entryPath];
  });
const files = walk(appRoot).filter(
  file =>
    /\.(?:ts|tsx|js|jsx|cjs|mjs)$/.test(file) &&
    !file.endsWith('.d.ts') &&
    !file.endsWith('routeTree.gen.ts')
);
const report = (source, node, message) => {
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  violations.push(
    `${path.relative(appRoot, source.fileName)}:${line + 1}: ${message}`
  );
};
const containsJsx = node => {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return true;
  }

  return Boolean(ts.forEachChild(node, containsJsx));
};

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const components = [];
  // Route files (.ts or .tsx) export `Route` with inline JSX; they follow TanStack naming, not component naming.
  const isRoute = path
    .relative(appRoot, file)
    .startsWith(path.join('src', 'routes') + path.sep);

  if (path.basename(file) === 'index.tsx') {
    report(
      source,
      source,
      'Use index.ts as an export portal; move components to named .tsx files.'
    );
  }

  if (path.basename(file) === 'index.ts') {
    for (const statement of source.statements) {
      if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
        report(source, statement, 'index.ts must contain re-exports only.');
      }
    }
  }

  const visit = node => {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) {
      report(
        source,
        node,
        'Prefer an arrow function for functions, callbacks and components.'
      );
    }

    if (ts.isIfStatement(node)) {
      if (!ts.isBlock(node.thenStatement)) {
        report(source, node, 'if statements always require a block.');
      }

      if (
        node.elseStatement &&
        !ts.isBlock(node.elseStatement) &&
        !ts.isIfStatement(node.elseStatement)
      ) {
        report(
          source,
          node.elseStatement,
          'else statements always require a block.'
        );
      }
    }

    if (
      !isRoute &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.initializer &&
      containsJsx(node.initializer)
    ) {
      components.push(node);
      const initializer = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0]
        : node.initializer;
      if (
        initializer &&
        ts.isArrowFunction(initializer) &&
        initializer.parameters[0]?.type &&
        ts.isTypeLiteralNode(initializer.parameters[0].type)
      ) {
        report(
          source,
          initializer.parameters[0],
          'Use a named, reusable props interface/type.'
        );
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isCallExpression(node.initializer ?? node) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'useTranslation' &&
      ts.isObjectBindingPattern(node.name)
    ) {
      if (
        node.name.elements.some(
          element =>
            (element.propertyName ?? element.name).getText(source) === 't'
        )
      ) {
        report(
          source,
          node,
          'Use trans from #i18n rather than t from useTranslation.'
        );
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      ['queryFn', 'mutationFn'].includes(node.name.getText(source)) &&
      ts.isArrowFunction(node.initializer)
    ) {
      const parameter = node.initializer.parameters[0];
      if (
        !parameter ||
        !ts.isObjectBindingPattern(parameter.name) ||
        !parameter.name.elements.some(
          element =>
            (element.propertyName ?? element.name).getText(source) ===
            'apiManager'
        )
      ) {
        report(
          source,
          node,
          'Get apiManager from the query/mutation callback context.'
        );
      }

      const checkManager = child => {
        if (ts.isIdentifier(child) && child.text === 'apiManagerInstance') {
          report(
            source,
            child,
            'Do not capture the API singleton in query/mutation callbacks.'
          );
        }
        ts.forEachChild(child, checkManager);
      };
      checkManager(node.initializer.body);
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  if (components.length > 1) {
    report(
      source,
      components[1],
      'Each component must have its own .tsx file.'
    );
  }

  for (const component of components) {
    if (path.basename(file) !== `${component.name.text}.tsx`) {
      report(source, component, 'Name the .tsx file after its component.');
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Codestyle audit passed (${files.length} authored files; generated files excluded).\n`
  );
}
