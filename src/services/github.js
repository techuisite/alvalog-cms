/**
 * Direct GitHub REST API client for Alvalog CMS.
 * Runs 100% client-side in the browser.
 */

const STORAGE_KEYS = {
  TOKEN: 'alvalog_gh_token',
  REPO: 'alvalog_gh_repo',
  BRANCH: 'alvalog_gh_branch',
};

const DEFAULT_REPO = 'techuisite/techuisite.github.io';
const DEFAULT_BRANCH = 'main';
const POSTS_PATH = 'src/content/blog';
const DRAFTS_PATH = 'src/content/drafts';
const IMAGES_BASE_PATH = 'public/content/images';

export { POSTS_PATH, DRAFTS_PATH, IMAGES_BASE_PATH };

export function getGithubConfig() {
  return {
    token: localStorage.getItem(STORAGE_KEYS.TOKEN) || '',
    repo: localStorage.getItem(STORAGE_KEYS.REPO) || DEFAULT_REPO,
    branch: localStorage.getItem(STORAGE_KEYS.BRANCH) || DEFAULT_BRANCH,
  };
}

export function saveGithubConfig({ token, repo, branch }) {
  if (token !== undefined) localStorage.setItem(STORAGE_KEYS.TOKEN, token.trim());
  if (repo !== undefined) localStorage.setItem(STORAGE_KEYS.REPO, repo.trim() || DEFAULT_REPO);
  if (branch !== undefined) localStorage.setItem(STORAGE_KEYS.BRANCH, branch.trim() || DEFAULT_BRANCH);
}

function getHeaders(token) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Robust UTF-8 Base64 decoding & encoding for browser
function utf8ToBase64(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

function base64ToUtf8(str) {
  const clean = str.replace(/\n/g, '');
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(clean), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

export async function testConnection(config = null) {
  const cfg = config || getGithubConfig();
  if (!cfg.token) {
    throw new Error('Please enter a GitHub Personal Access Token.');
  }

  const [owner, repoName] = cfg.repo.split('/');
  if (!owner || !repoName) {
    throw new Error('Repository must be in "owner/repo" format (e.g. techuisite/techuisite.github.io).');
  }

  // 1. Check user token
  const userRes = await fetch('https://api.github.com/user', {
    headers: getHeaders(cfg.token)
  });
  if (!userRes.ok) {
    if (userRes.status === 401) throw new Error('Invalid GitHub token. Please verify your token.');
    throw new Error(`GitHub user check failed (status ${userRes.status}).`);
  }
  const user = await userRes.json();

  // 2. Check repo access
  const repoRes = await fetch(`https://api.github.com/repos/${cfg.repo}`, {
    headers: getHeaders(cfg.token)
  });
  if (!repoRes.ok) {
    if (repoRes.status === 404) throw new Error(`Repository "${cfg.repo}" not found or token lacks access.`);
    throw new Error(`Repository access check failed (status ${repoRes.status}).`);
  }
  const repo = await repoRes.json();

  return {
    ok: true,
    user: {
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name
    },
    repo: {
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      permissions: repo.permissions
    }
  };
}

export async function fetchPostFilesList() {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const url = `https://api.github.com/repos/${cfg.repo}/contents/${POSTS_PATH}?ref=${cfg.branch}`;
  const res = await fetch(url, { headers: getHeaders(cfg.token) });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to load posts list (status ${res.status}).`);
  }
  const items = await res.json();
  return items.filter(item => item.type === 'file' && item.name.endsWith('.md'));
}

export async function fetchDraftFilesList() {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const url = `https://api.github.com/repos/${cfg.repo}/contents/${DRAFTS_PATH}?ref=${cfg.branch}`;
  const res = await fetch(url, { headers: getHeaders(cfg.token) });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Failed to load drafts list (status ${res.status}).`);
  }
  const items = await res.json();
  return items.filter(item => item.type === 'file' && item.name.endsWith('.md'));
}

export async function fetchPostContent(filePath) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const url = `https://api.github.com/repos/${cfg.repo}/contents/${filePath}?ref=${cfg.branch}`;
  const res = await fetch(url, { headers: getHeaders(cfg.token) });
  if (!res.ok) {
    throw new Error(`Failed to load post content (status ${res.status}).`);
  }

  const data = await res.json();
  const rawText = base64ToUtf8(data.content);
  return {
    sha: data.sha,
    path: data.path,
    name: data.name,
    rawText
  };
}

export async function savePostToGithub({ filename, contentString, sha = null, commitMessage = null }) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const path = `${POSTS_PATH}/${filename}`;
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  
  const payload = {
    message: commitMessage || (sha ? `Update post: ${filename}` : `Publish post: ${filename}`),
    content: utf8ToBase64(contentString),
    branch: cfg.branch,
  };

  if (sha) {
    payload.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(cfg.token),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to save post (status ${res.status}).`);
  }

  const result = await res.json();
  return {
    sha: result.content.sha,
    path: result.content.path,
    commit: result.commit
  };
}

export async function deletePostFromGithub({ filename, sha, commitMessage = null }) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const path = `${POSTS_PATH}/${filename}`;
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;

  const payload = {
    message: commitMessage || `Delete post: ${filename}`,
    sha: sha,
    branch: cfg.branch,
  };

  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(cfg.token),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to delete post (status ${res.status}).`);
  }

  return await res.json();
}

export async function saveDraftToGithub({ filename, contentString, sha = null, commitMessage = null }) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const path = `${DRAFTS_PATH}/${filename}`;
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  
  const payload = {
    message: commitMessage || (sha ? `Update draft: ${filename}` : `Save draft: ${filename}`),
    content: utf8ToBase64(contentString),
    branch: cfg.branch,
  };

  if (sha) {
    payload.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(cfg.token),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to save draft (status ${res.status}).`);
  }

  const result = await res.json();
  return {
    sha: result.content.sha,
    path: result.content.path,
    commit: result.commit
  };
}

export async function deleteDraftFromGithub({ filename, sha, commitMessage = null }) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const path = `${DRAFTS_PATH}/${filename}`;
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;

  const payload = {
    message: commitMessage || `Delete draft: ${filename}`,
    sha: sha,
    branch: cfg.branch,
  };

  const res = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(cfg.token),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to delete draft (status ${res.status}).`);
  }

  return await res.json();
}

export async function uploadImageToGithub(file, customFilename = null) {
  const cfg = getGithubConfig();
  if (!cfg.token) throw new Error('GitHub token not configured.');

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Sanitize filename
  let filename = customFilename || file.name;
  filename = filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!filename) filename = `image-${Date.now()}`;

  const repoPath = `${IMAGES_BASE_PATH}/${year}/${month}/${filename}`;
  // Public URL that Astro serves:
  const publicUrl = `/content/images/${year}/${month}/${filename}`;

  // Read file as base64
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Check if file already exists to get SHA if overwriting
  let existingSha = null;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${repoPath}?ref=${cfg.branch}`, {
      headers: getHeaders(cfg.token)
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      existingSha = checkData.sha;
    }
  } catch {
    // File doesn't exist, proceed
  }

  const payload = {
    message: `Upload image: ${filename}`,
    content: base64Data,
    branch: cfg.branch,
  };
  if (existingSha) payload.sha = existingSha;

  const uploadRes = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${repoPath}`, {
    method: 'PUT',
    headers: getHeaders(cfg.token),
    body: JSON.stringify(payload)
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.message || `Failed to upload image (status ${uploadRes.status}).`);
  }

  return {
    publicUrl,
    repoPath,
    filename
  };
}
