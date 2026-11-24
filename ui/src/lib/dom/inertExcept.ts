/**
 * Make everything inside `root` inert except the branch that leads to `keep`.
 *
 * `inert` is inherited, so a descendant cannot opt out of an inert ancestor. To keep one part of
 * the app live (a toast container) while a full-screen layer covers the rest, every sibling along
 * the path from `keep` up to `root` is made inert instead of `root` itself. When `keep` is missing
 * or outside `root`, the whole of `root` goes inert. Returns a function that undoes exactly what
 * this call changed, leaving anything that was already inert alone.
 */
export function inertExcept(root: HTMLElement, keep: Element | null): () => void {
  const changed: Element[] = [];
  const mark = (element: Element) => {
    if (element.hasAttribute('inert')) return;
    element.setAttribute('inert', '');
    changed.push(element);
  };

  if (!keep || keep === root || !root.contains(keep)) {
    mark(root);
  } else {
    let node: Element = keep;
    while (node !== root && node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node) mark(sibling);
      }
      node = node.parentElement;
    }
  }

  return () => {
    for (const element of changed) element.removeAttribute('inert');
  };
}
