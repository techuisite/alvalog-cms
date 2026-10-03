/**
 * Utility functions for parsing and serializing Astro blog post frontmatter and Markdown body.
 */

export function slugify(text = '') {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

export function parsePost(rawContent = '') {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  
  if (!match) {
    return {
      frontmatter: {
        title: '',
        description: '',
        pubDate: new Date().toISOString(),
        updatedDate: '',
        heroImage: '',
        tags: [],
        featured: false
      },
      content: rawContent
    };
  }

  const rawYaml = match[1];
  const content = match[2];
  const frontmatter = {
    title: '',
    description: '',
    pubDate: new Date().toISOString(),
    updatedDate: '',
    heroImage: '',
    tags: [],
    featured: false
  };

  const lines = rawYaml.split(/\r?\n/);
  let currentKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    // Check list item under currentKey
    if (line.startsWith('- ') && currentKey) {
      const item = line.substring(2).trim().replace(/^['"]|['"]$/g, '');
      if (Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey].push(item);
      }
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      let val = line.substring(colonIndex + 1).trim();

      currentKey = key;

      if (val === '') {
        // Could be start of a list or empty
        if (key === 'tags') frontmatter.tags = [];
        continue;
      }

      // Parse JSON-like arrays: tags: ["Apple", "Tech"]
      if (val.startsWith('[') && val.endsWith(']')) {
        try {
          // Attempt standard JSON parse or regex split
          const inner = val.slice(1, -1);
          frontmatter[key] = inner
            ? inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
            : [];
        } catch {
          frontmatter[key] = [];
        }
        currentKey = null;
        continue;
      }

      // Boolean
      if (val === 'true') {
        frontmatter[key] = true;
        currentKey = null;
        continue;
      }
      if (val === 'false') {
        frontmatter[key] = false;
        currentKey = null;
        continue;
      }

      // Strip outer quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      frontmatter[key] = val;
    }
  }

  if (!Array.isArray(frontmatter.tags)) {
    frontmatter.tags = frontmatter.tags ? [frontmatter.tags] : [];
  }

  return { frontmatter, content };
}

export function serializePost(frontmatter, content = '') {
  const lines = ['---'];

  // Title
  lines.push(`title: "${(frontmatter.title || 'Untitled').replace(/"/g, '\\"')}"`);

  // Description
  if (frontmatter.description) {
    lines.push(`description: "${frontmatter.description.replace(/"/g, '\\"')}"`);
  }

  // pubDate
  let pubDateStr = frontmatter.pubDate;
  if (!pubDateStr) {
    pubDateStr = new Date().toISOString();
  }
  lines.push(`pubDate: "${pubDateStr}"`);

  // updatedDate
  if (frontmatter.updatedDate) {
    lines.push(`updatedDate: "${frontmatter.updatedDate}"`);
  }

  // heroImage
  if (frontmatter.heroImage) {
    lines.push(`heroImage: "${frontmatter.heroImage}"`);
  }

  // tags
  if (frontmatter.tags && frontmatter.tags.length > 0) {
    const formattedTags = frontmatter.tags.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ');
    lines.push(`tags: [${formattedTags}]`);
  } else {
    lines.push('tags: []');
  }

  // featured
  lines.push(`featured: ${frontmatter.featured === true ? 'true' : 'false'}`);

  lines.push('---');
  lines.push('');
  lines.push(content);

  return lines.join('\n');
}
