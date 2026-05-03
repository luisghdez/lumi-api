import { FastifyInstance } from "fastify";

async function appleAppSiteAssociationRoutes(fastify: FastifyInstance) {
  // AASA content — replace APP_STORE_ID with your real App Store ID
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: "D7FAZ4W8U9.com.herlop.lumilearn",
          paths: ["/invite/*", "/course/*", "/video/*"],
          // Add a comment field to change the file
          components: [
            {
              "/": "/invite/*",
              comment: "Friend invites"
            },
            {
              "/": "/course/*", 
              comment: "Course shares"
            },
            {
              "/": "/video/*",
              comment: "Shared video (matches https://www.lumilearnapp.com/video/:videoId)"
            }
          ]
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
    reply
      .header("Content-Type", "application/json")
      .header("Cache-Control", "no-cache, must-revalidate")
      .header("ETag", `"${Date.now()}"`) // forces Apple to see a new version
      .send(aasa);
  });
  

  // Invite route (redirect if app not installed)
  fastify.get<{ Params: { uid: string } }>("/invite/:uid", async (req, reply) => {
    const { uid } = req.params;
    console.log(`Invite link clicked for UID: ${uid}`);

    const APP_STORE_URL = "https://apps.apple.com/app/id6743999003"; // ✅ your app’s URL
    return reply.redirect(APP_STORE_URL);
  });

  // Course route (now identical to invite route)
  fastify.get<{ Params: { courseId: string } }>("/course/:courseId", async (req, reply) => {
    const { courseId } = req.params;
    console.log(`Course link clicked for Course ID: ${courseId}`);

    const APP_STORE_URL = "https://apps.apple.com/app/id6743999003"; // ✅ your app’s URL
    return reply.redirect(APP_STORE_URL);
  });
}

export default appleAppSiteAssociationRoutes;