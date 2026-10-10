export const buildCssModuleSource = (path: string, cssText: string) => {
  const safeText = JSON.stringify(cssText ?? '');
  const id = JSON.stringify(`shared-style:${path}`);
  return `
const cssText = ${safeText};
if (typeof document !== 'undefined') {
  const attr = 'data-shared-style';
  let style = Array.from(document.querySelectorAll('style[' + attr + ']'))
    .find((node) => node.getAttribute(attr) === ${id});
  if (!style) {
    style = document.createElement('style');
    style.setAttribute(attr, ${id});
    document.head.appendChild(style);
  }
  if (style.textContent !== cssText) {
    style.textContent = cssText;
  }
}
module.exports = cssText;
`;
};
