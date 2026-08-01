export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    commit: process.env.DEPLOY_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    deployedAt: process.env.DEPLOY_TIMESTAMP ?? null,
  });
}
