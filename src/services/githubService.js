const https = require('https');

const githubRequest = ({ method = 'GET', path, body }) => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    throw new Error('GitHub integration variables are not configured');
  }

  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          'User-Agent': 'creatoros-backend',
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `GitHub API request failed: ${res.statusCode}`));
          }
        });
      }
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
};

const createBountyIssue = async ({ title, body, labels = ['bounty'] }) => {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  return githubRequest({
    method: 'POST',
    path: `/repos/${owner}/${repo}/issues`,
    body: {
      title,
      body,
      labels
    }
  });
};

const closeIssue = async (issueNumber) => {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  return githubRequest({
    method: 'PATCH',
    path: `/repos/${owner}/${repo}/issues/${issueNumber}`,
    body: { state: 'closed' }
  });
};

module.exports = {
  createBountyIssue,
  closeIssue
};
