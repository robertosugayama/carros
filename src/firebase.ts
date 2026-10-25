import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { firebaseConfig } from "./firebaseConfig";
const emulator = import.meta.env.VITE_FIREBASE_EMULATORS === "true";
const projectId =
  import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const app = initializeApp({
  ...firebaseConfig,
  projectId,
  storageBucket: emulator
    ? projectId + ".appspot.com"
    : firebaseConfig.storageBucket,
  apiKey: emulator ? "demo-api-key" : firebaseConfig.apiKey,
});
export const auth = getAuth(app),
  firestore = getFirestore(app),
  storage = getStorage(app);
storage.maxUploadRetryTime = 20000;
storage.maxOperationRetryTime = 15000;
if (emulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8089);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
