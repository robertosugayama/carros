import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
test("Firestore: cadastro seguro, isolamento, bloqueio, catálogo pessoal e promoção por master", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-autotuner",
    firestore: {
      host: "127.0.0.1",
      port: 8089,
      rules: readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
  try {
    await env.clearFirestore();
    const a = env
        .authenticatedContext("alice", { email: "alice@example.test" })
        .firestore(),
      b = env
        .authenticatedContext("bob", { email: "bob@example.test" })
        .firestore(),
      anonymous = env.unauthenticatedContext().firestore();
    const profile = (name) => ({
      name,
      email: name + "@example.test",
      role: "user",
      blocked: false,
      createdAt: serverTimestamp(),
    });
    await assertFails(
      setDoc(doc(a, "users", "alice"), { ...profile("alice"), role: "master" }),
    );
    await assertSucceeds(setDoc(doc(a, "users", "alice"), profile("alice")));
    await assertSucceeds(setDoc(doc(b, "users", "bob"), profile("bob")));
    await assertFails(updateDoc(doc(a, "users", "alice"), { role: "master" }));
    await assertFails(getDoc(doc(b, "users", "alice")));
    await assertFails(getDocs(collection(a, "users")));
    const project = {
      name: "Projeto",
      payload: { wheels: [{ diameter: 0.2 }, { diameter: 0.2 }] },
      files: [],
      createdAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(a, "users", "alice", "projects", "one"), project),
    );
    await assertFails(getDoc(doc(b, "users", "alice", "projects", "one")));
    await assertFails(
      setDoc(doc(a, "users", "alice", "projects", "bad"), {
        ...project,
        payload: { wheels: [{ diameter: 0.2 }, { diameter: 0.3 }] },
      }),
    );
    const photo = {
      owner_id: "alice",
      model: "private-photo",
      name: "Minha roda",
      finish: 1,
      size: 18,
      image: "https://example.test/photo.webp",
      source: "",
      credit: "Alice",
      kind: "rim",
      origin: "photograph",
      public: false,
      createdAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(a, "wheelPhotos", "private-photo"), photo));
    await assertFails(getDoc(doc(b, "wheelPhotos", "private-photo")));
    await assertFails(
      updateDoc(doc(a, "wheelPhotos", "private-photo"), { public: true }),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(anonymous, "wheelPhotos"),
          where("public", "==", true),
        ),
      ),
    );
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), "users", "bob"), { role: "master" });
    });
    await assertSucceeds(getDocs(collection(b, "users")));
    await assertSucceeds(
      updateDoc(doc(b, "wheelPhotos", "private-photo"), { public: true }),
    );
    await assertSucceeds(
      getDoc(doc(anonymous, "wheelPhotos", "private-photo")),
    );
    await assertFails(updateDoc(doc(b, "users", "bob"), { role: "user" }));
    await assertSucceeds(
      updateDoc(doc(b, "users", "alice"), { blocked: true }),
    );
    await assertFails(getDoc(doc(a, "users", "alice", "projects", "one")));
    await assertSucceeds(getDoc(doc(a, "users", "alice")));
  } finally {
    await env.clearFirestore();
    await env.cleanup();
  }
});
