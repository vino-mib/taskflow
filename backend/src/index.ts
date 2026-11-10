import http from "http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { typeDefs } from "./graphql/typeDefs";
import { resolvers } from "./graphql/resolvers";
import { buildContext, Context } from "./graphql/context";

async function main() {
  await connectDB();

  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    introspection: env.NODE_ENV !== "production",
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })], // graceful shutdown
  });
  await server.start();

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(
    "/graphql",
    cors(),
    express.json(),
    expressMiddleware(server, { context: async ({ req }) => buildContext(req) })
  );

  await new Promise<void>((resolve) => httpServer.listen({ port: env.PORT }, resolve));
  console.log(`🚀 GraphQL ready at http://localhost:${env.PORT}/graphql`);
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
