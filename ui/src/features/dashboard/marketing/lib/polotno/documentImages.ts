// Pure helper, kept apart from the guard so it never pulls in OpenPolotno.

/** Every image `src` in a Polotno document (page children, any depth). */
export function collectDocumentImageUrls(document: unknown): string[] {
  const urls = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    if (
      (record.type === 'image' || record.type === 'video') &&
      typeof record.src === 'string' &&
      record.src
    ) {
      urls.add(record.src);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') visit(value);
    }
  };
  visit(document);
  return [...urls];
}
