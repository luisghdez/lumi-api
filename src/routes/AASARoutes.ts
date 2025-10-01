import { FastifyInstance } from "fastify";

async function appleAppSiteAssociationRoutes(fastify: FastifyInstance) {
  // Apple App Site Association (AASA) JSON
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: "D7FAZ4W8U9.com.herlop.lumilearn", // 👈 TeamID.BundleID
          paths: ["/invite/*"],
        },
      ],
    },
  };

  // Serve at /apple-app-site-association
  fastify.route({
    method: "GET",
    url: "/apple-app-site-association",
    handler: async (_, reply) => {
      reply.header("Content-Type", "application/json").send(aasa);
    },
  });

  // Serve at /.well-known/apple-app-site-association
  fastify.route({
    method: "GET",
    url: "/.well-known/apple-app-site-association",
    handler: async (_, reply) => {
      reply.header("Content-Type", "application/json").send(aasa);
    },
  });

  // Optional: Redirect route for when app is not installed
  fastify.route({
    method: "GET",
    url: "/invite/:uid",
    handler: async (request, reply) => {
      const { uid } = request.params as { uid: string };

      // You can log or use uid for analytics if you want
      console.log(`Invite link clicked for UID: ${uid}`);

      // Direct to App Store (replace with your real App Store ID URL)
      const APP_STORE_URL = "https://apps.apple.com/app/idYOUR_APP_STORE_ID";
      reply.redirect(APP_STORE_URL);
    },
  });
}

export default appleAppSiteAssociationRoutes;