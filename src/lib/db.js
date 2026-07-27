"use strict";

const { MongoClient } = require("mongodb");

let client = null;
let db = null;

function resolveUri() {
  const raw = process.env.MONGODB_URI;
  if (!raw) {
    throw new Error(
      "MONGODB_URI is missing. Copy atlas-credentials.env values into .env (see .env.example)."
    );
  }
  /* Ensure a database name is present on the connection string */
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/" + (process.env.MONGODB_DB || "ouija");
    }
    if (!url.searchParams.has("retryWrites")) url.searchParams.set("retryWrites", "true");
    if (!url.searchParams.has("w")) url.searchParams.set("w", "majority");
    return url.toString();
  } catch {
    return raw;
  }
}

async function connect() {
  if (db) return db;

  const uri = resolveUri();
  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
  });
  await client.connect();

  const dbName = process.env.MONGODB_DB || "ouija";
  db = client.db(dbName);

  await Promise.all([
    db.collection("users").createIndex({ usernameKey: 1 }, { unique: true }),
    db.collection("users").createIndex({ emailKey: 1 }, { unique: true }),
    db.collection("teams").createIndex({ nameKey: 1 }, { unique: true }),
    db.collection("teams").createIndex({ id: 1 }, { unique: true }),
    db.collection("users").createIndex({ id: 1 }, { unique: true }),
    db.collection("solves").createIndex({ userId: 1, challengeId: 1 }, { unique: true }),
    db.collection("solves").createIndex({ userId: 1 }),
    db.collection("logins").createIndex({ userId: 1, at: -1 }),
    db.collection("logins").createIndex({ at: -1 }),
  ]);

  return db;
}

function getDb() {
  if (!db) throw new Error("MongoDB is not connected yet.");
  return db;
}

function mongoUrl() {
  return resolveUri();
}

async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = { connect, getDb, mongoUrl, close };
