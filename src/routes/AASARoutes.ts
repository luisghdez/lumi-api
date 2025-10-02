import { FastifyInstance } from "fastify";

async function appleAppSiteAssociationRoutes(fastify: FastifyInstance) {
  // AASA content — replace APP_STORE_ID with your real App Store ID
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: "D7FAZ4W8U9.com.herlop.lumilearn", // 👈 TeamID + BundleID
          paths: ["/invite/*", "/course/*"],
        },
      ],
    },
  };

  // Main route: /apple-app-site-association
  fastify.get("/apple-app-site-association", async (_, reply) => {
    reply.header("Content-Type", "application/json").send(aasa);
  });

  // Well-known route: /.well-known/apple-app-site-association
  fastify.get("/.well-known/apple-app-site-association", async (_, reply) => {
    reply.header("Content-Type", "application/json").send(aasa);
  });

  // Optional: /invite/:uid route (redirect to App Store if app not installed)
  fastify.get<{ Params: { uid: string } }>("/invite/:uid", async (req, reply) => {
    const { uid } = req.params;
    console.log(`Invite link clicked for UID: ${uid}`);

    // Replace with your real App Store ID
    const APP_STORE_URL =
      "https://apps.apple.com/app/id6743999003"; // ✅ your app’s URL
    return reply.redirect(APP_STORE_URL);
  });
}

export default appleAppSiteAssociationRoutes;