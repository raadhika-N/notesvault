#!/usr/bin/env node

const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// GitHub API helper function
function apiRequest(path, page = 1) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `${path}${path.includes('?') ? '&' : '?'}page=${page}&per_page=100`,
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'leaderboard-generator',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            return;
          }
          const jsonData = JSON.parse(data);
          resolve({
            data: jsonData,
            hasNextPage: res.headers.link && res.headers.link.includes('rel="next"')
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Fetch all pages of results with rate limiting
async function fetchAllPages(path, maxPages = 10) {
  let allData = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= maxPages) {
    try {
      console.log(`Fetching page ${page} of ${path}...`);
      const response = await apiRequest(path, page);
      allData = allData.concat(response.data);
      hasNextPage = response.hasNextPage;
      page++;
      
      // Small delay to avoid hitting rate limits
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error.message);
      break;
    }
  }

  return allData;
}

async function generateLeaderboard() {
  try {
    console.log('Fetching closed issues with level labels...');
    
    // Fetch closed issues with level labels - limit to recent issues for performance
    const issues = await fetchAllPages(`/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=closed&sort=updated&direction=desc`, 5);
    
    console.log(`Found ${issues.length} closed issues`);

    // Filter issues by level labels and extract assignee data
    const levelIssues = issues.filter(issue => {
      const labels = issue.labels.map(label => label.name.toLowerCase());
      return labels.some(label => ['level1', 'level2', 'level3'].includes(label));
    });

    console.log(`Found ${levelIssues.length} closed issues with level labels`);

    // Build contributor stats
    const contributorStats = {};

    levelIssues.forEach(issue => {
      const labels = issue.labels.map(label => label.name.toLowerCase());
      const assignees = issue.assignees || [];
      
      assignees.forEach(assignee => {
        const username = assignee.login;
        
        if (!contributorStats[username]) {
          contributorStats[username] = {
            level1: 0,
            level2: 0,
            level3: 0,
            mergedPRs: 0
          };
        }

        // Count level completions
        if (labels.includes('level1')) contributorStats[username].level1++;
        if (labels.includes('level2')) contributorStats[username].level2++;
        if (labels.includes('level3')) contributorStats[username].level3++;
      });
    });

    console.log(`Processing ${Object.keys(contributorStats).length} contributors...`);

    // Fetch merged PRs for each contributor (optimize by checking only contributors with level completions)
    const contributorUsernames = Object.keys(contributorStats);
    if (contributorUsernames.length > 0) {
      console.log('Fetching merged PRs...');
      const prs = await fetchAllPages(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&sort=updated&direction=desc`, 5);
      
      const mergedPRs = prs.filter(pr => pr.merged_at !== null);
      console.log(`Found ${mergedPRs.length} merged PRs`);

      // Count merged PRs for each contributor
      contributorUsernames.forEach(username => {
        const userMergedPRs = mergedPRs.filter(pr => pr.user.login === username);
        contributorStats[username].mergedPRs = userMergedPRs.length;
        console.log(`${username}: ${userMergedPRs.length} merged PRs`);
      });
    }

    // Generate leaderboard markdown
    let leaderboard = `# 🏆 Contributors Leaderboard

This leaderboard tracks contributors who have completed issues labeled as \`level1\`, \`level2\`, or \`level3\`, along with their merged pull requests.

*Last updated: ${new Date().toISOString().split('T')[0]}*

| Username | Level 1 | Level 2 | Level 3 | PRs Merged |
|----------|---------|---------|---------|-------------|
`;

    // Sort contributors by total contributions (sum of all levels + PRs)
    const sortedContributors = Object.entries(contributorStats)
      .map(([username, stats]) => ({
        username,
        ...stats,
        total: stats.level1 + stats.level2 + stats.level3 + stats.mergedPRs
      }))
      .sort((a, b) => b.total - a.total);

    if (sortedContributors.length === 0) {
      leaderboard += '| *No contributors yet* | - | - | - | - |\n';
    } else {
      sortedContributors.forEach(contributor => {
        leaderboard += `| [@${contributor.username}](https://github.com/${contributor.username}) | ${contributor.level1} | ${contributor.level2} | ${contributor.level3} | ${contributor.mergedPRs} |\n`;
      });
    }

    leaderboard += `
---

**Legend:**
- **Level 1/2/3**: Number of completed issues with respective level labels
- **PRs Merged**: Number of merged pull requests
- Contributors are sorted by total contributions (levels + PRs)

*This leaderboard is automatically updated by GitHub Actions.*
`;

    // Write to file
    const fs = require('fs');
    fs.writeFileSync('LEADERBOARD.md', leaderboard);
    
    console.log('✅ LEADERBOARD.md generated successfully!');
    console.log(`📊 Total contributors: ${sortedContributors.length}`);
    
    if (sortedContributors.length > 0) {
      console.log('🏆 Top contributors:');
      sortedContributors.slice(0, 3).forEach((contributor, index) => {
        console.log(`${index + 1}. ${contributor.username} (${contributor.total} total contributions)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating leaderboard:', error);
    process.exit(1);
  }
}

generateLeaderboard();