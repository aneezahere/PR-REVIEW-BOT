import { Octokit } from "@octokit/rest";
import { createNodeMiddleware } from "@octokit/webhooks";
import { WebhookEventMap } from "@octokit/webhooks-definitions/schema";
import * as http from "http";
import { App } from "octokit";
import { Review } from "./constants";
import { env } from "./env";
import { processPullRequest } from "./review-agent";
import { applyReview } from "./reviews";

/**
 * Initialize GitHub App
 */
const reviewApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
  webhooks: {
    secret: env.GITHUB_WEBHOOK_SECRET,
  },
});

/**
 * Fetch File Content
 */
const getFileContent = async (
  octokit: InstanceType<typeof App>["octokit"],
  owner: string,
  repo: string,
  path: string,
  ref: string
) => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    if ("content" in data) {
      // Decode the file content (it's base64-encoded)
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null; // In case the data does not contain content
  } catch (exc) {
    console.error(`Failed to fetch content for ${path}`, exc);
    return null;
  }
};

/**
 * Get Changes with Full Context
 */
const getChangesWithFullContext = async (
  payload: WebhookEventMap["pull_request"]
) => {
  try {
    const octokit = await reviewApp.getInstallationOctokit(
      payload.installation.id
    );

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pull_number: payload.pull_request.number,
    });

    const fileContexts = await Promise.all(
      files.map(async (file) => {
        const content = await getFileContent(
          octokit,
          payload.repository.owner.login,
          payload.repository.name,
          file.filename,
          payload.pull_request.head.sha
        );
        return {
          ...file,
          fullContent: content,
        };
      })
    );

    console.dir({ fileContexts }, { depth: null });
    return fileContexts;
  } catch (exc) {
    console.error("Error fetching files with context:", exc);
    return [];
  }
};

/**
 * Handle Pull Request Opened
 */
async function handlePullRequestOpened({
  octokit,
  payload,
}: {
  octokit: Octokit;
  payload: WebhookEventMap["pull_request"];
}) {
  console.log(
    `Received a pull request event for #${payload.pull_request.number}`
  );

  try {
    console.log("PR info", {
      id: payload.repository.id,
      fullName: payload.repository.full_name,
      url: payload.repository.html_url,
    });

    const fileContexts = await getChangesWithFullContext(payload);

    const review: Review = await processPullRequest(
      octokit,
      payload,
      fileContexts,
      true // Assuming this indicates including full context
    );

    await applyReview({ octokit, payload, review });
    console.log("Review Submitted");
  } catch (exc) {
    console.error("Error handling pull request:", exc);
  }
}

// Set up webhook event listener
//@ts-ignore
reviewApp.webhooks.on("pull_request.opened", handlePullRequestOpened);

const port = process.env.PORT || 3000;
const reviewWebhook = `/api/review`;

// Create middleware for webhook handling
const reviewMiddleware = createNodeMiddleware(reviewApp.webhooks, {
  path: "/api/review",
});

// Create HTTP server
const server = http.createServer((req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);

  if (req.url === reviewWebhook && req.method === "POST") {
    console.log("POST /api/review endpoint hit!");
    reviewMiddleware(req, res);
  } else if (req.url === reviewWebhook && req.method === "GET") {
    console.log("GET /api/review endpoint hit!");
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("GET /api/review is working!");
  } else {
    console.log(`404 Not Found: ${req.method} ${req.url}`);
    res.statusCode = 404;
    res.end("Not Found");
  }
});

// Start server
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
  console.log("Press Ctrl + C to quit.");
});
