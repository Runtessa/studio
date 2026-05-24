const inferExportName = (name: string) => {
  const tail = String(name || '')
    .trim()
    .split('/')
    .pop();
  if (!tail) return '';
  return tail
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

export const repairUiCompiledCode = (
  packageName: string,
  compiledCode: string,
  fileExtension?: string | null
) => {
  const code = String(compiledCode || '');
  const ext = String(fileExtension || '')
    .trim()
    .toLowerCase();
  if (!code) return code;
  if (ext !== 'js' && ext !== 'jsx') return code;

  const hasAnyExports =
    code.includes('exports.') ||
    code.includes('module.exports') ||
    code.includes('Object.defineProperty(exports');
  if (hasAnyExports) return code;

  const exportName = inferExportName(packageName);
  if (!exportName) return code;

  const isDeclared =
    new RegExp(`\\bfunction\\s+${exportName}\\b`).test(code) ||
    new RegExp(`\\b(?:var|let|const|class)\\s+${exportName}\\b`).test(code);
  if (!isDeclared) return code;

  const patch = `
;try {
  if (typeof ${exportName} !== 'undefined') {
    if (typeof exports === 'object' && exports) {
      if (typeof exports.default === 'undefined') exports.default = ${exportName};
      if (typeof exports.${exportName} === 'undefined') exports.${exportName} = ${exportName};
    }
  }
} catch (e) {}
`;
  return `${code}\n${patch}`;
};
