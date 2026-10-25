import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, firestore, storage } from "./firebase";
import { models, validPlacement } from "./catalog";
import { equalizeWheels } from "./wheelSizing";
function message(cause: any) {
  const code = String(cause?.code || "");
  const messages: Record<string, string> = {
    "auth/operation-not-allowed":
      "Ative E-mail/senha em Authentication → Sign-in method no console do Firebase.",
    "auth/configuration-not-found":
      "Ative o Firebase Authentication e o provedor E-mail/senha no console do projeto.",
    "auth/invalid-api-key":
      "A configuração web do Firebase está inválida. Confira o aplicativo cadastrado no console do projeto.",
    "auth/user-disabled": "Sua conta foi desativada pelo administrador.",
    "auth/invalid-email": "Informe um e-mail válido e completo.",
    "auth/email-already-in-use":
      "Este e-mail já foi cadastrado. Entre na sua conta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/weak-password": "Escolha uma senha mais forte.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente.",
    "auth/unauthorized-domain":
      "Adicione o domínio do app aos domínios autorizados em Authentication → Settings no Firebase.",
    "permission-denied":
      "Sua conta foi autenticada, mas o Firestore negou o acesso aos dados. No projeto carros-ed674, publique as regras do app no banco (default), em Firestore Database → Regras. Não é necessário cadastrar a conta novamente.",
    unavailable:
      "O Firestore está indisponível. Crie o banco no Firebase e verifique a conexão.",
    "not-found":
      "O banco Firestore ainda não está disponível. Crie o banco (default) no console Firebase.",
    "storage/unauthorized":
      "O Storage negou o acesso. Publique as regras de Storage fornecidas com o projeto.",
    "storage/bucket-not-found":
      "Ative o Firebase Storage no console e configure o bucket do projeto.",
    "storage/retry-limit-exceeded":
      "Não foi possível conectar ao Storage. Confira se o bucket está ativo e tente salvar novamente; a foto tratada foi mantida.",
    "storage/unknown":
      "Não foi possível enviar a imagem. Verifique se o Firebase Storage está ativo e suas regras foram publicadas.",
    "auth/network-request-failed":
      "Não foi possível conectar ao Firebase. Verifique a conexão.",
  };
  return Error(
    messages[code] ||
      cause?.message ||
      "Não foi possível concluir a operação no Firebase.",
  );
}
async function current() {
  await auth.authStateReady();
  if (!auth.currentUser) throw Error("Entre na sua conta para continuar.");
  return auth.currentUser;
}
async function profile(name?: string) {
  const user = await current(),
    reference = doc(firestore, "users", user.uid);
  const data = await runTransaction(firestore, async (tx) => {
    const existing = await tx.get(reference);
    if (existing.exists()) return existing.data();
    const value = {
      name:
        name?.trim() ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Usuário",
      email: user.email || "",
      role: "user",
      blocked: false,
      createdAt: serverTimestamp(),
    };
    tx.set(reference, value);
    return value;
  });
  if (
    typeof data.name !== "string" ||
    !["user", "master"].includes(data.role) ||
    typeof data.blocked !== "boolean"
  )
    throw Error(
      "O perfil no Firestore está incompleto. Peça ao administrador para conferir nome, role e blocked.",
    );
  if (data.blocked) {
    await signOut(auth);
    throw Error(
      "Sua conta está bloqueada. Entre em contato com o administrador.",
    );
  }
  return { id: user.uid, name: data.name, email: data.email, role: data.role };
}
export async function firebaseToken() {
  await profile();
  return (await current()).getIdToken();
}
async function upload(image: string, folder: string, files?: string[]) {
  if (!image.startsWith("data:image/")) return image;
  if (
    image.length > 3500000 ||
    !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
  )
    throw Error("Imagem inválida ou muito grande.");
  const path =
    folder +
    "/" +
    crypto.randomUUID() +
    "." +
    (image.startsWith("data:image/png")
      ? "png"
      : image.startsWith("data:image/jpeg")
        ? "jpg"
        : "webp");
  const reference = ref(storage, path);
  try {
    await uploadString(reference, image, "data_url");
    const url = await getDownloadURL(reference);
    files?.push(path);
    return url;
  } catch (cause: any) {
    if (cause?.code !== "storage/retry-limit-exceeded") throw cause;
    const token = await (await current()).getIdToken();
    const response = await fetch("/api/storage/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ path, image }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.image !== "string")
      throw Error(data.error || "Não foi possível salvar a imagem.");
    files?.push(path);
    return data.image;
  }
}
async function uploadPayload(payload: any, uid: string, id: string) {
  const copy = JSON.parse(JSON.stringify(payload)),
    files: string[] = [];
  const folder = `users/${uid}/projects/${id}`;
  copy.image = await upload(copy.image, folder, files);
  if (copy.photo) {
    copy.photo.image = await upload(copy.photo.image, folder, files);
    if (copy.photo.solidImage)
      copy.photo.solidImage = await upload(
        copy.photo.solidImage,
        folder,
        files,
      );
  }
  return { payload: copy, files };
}
function time(value: any) {
  return value?.toDate?.().toISOString() || new Date().toISOString();
}
const rows = (snapshot: any) =>
  snapshot.docs.map((d: any) => ({
    id: d.id,
    ...d.data(),
    created: d.data().createdAt ? time(d.data().createdAt) : "",
  }));
async function isMaster() {
  const user = await profile();
  if (user.role !== "master") throw Error("Acesso exclusivo do administrador.");
  return user;
}
async function photos(shared: boolean) {
  const user = shared ? undefined : await profile();
  const q = shared
    ? query(collection(firestore, "wheelPhotos"), where("public", "==", true))
    : query(
        collection(firestore, "wheelPhotos"),
        where("public", "==", false),
        where("owner_id", "==", user!.id),
      );
  return rows(await getDocs(q));
}
async function savePhoto(body: any, shared: boolean) {
  const user = shared ? await isMaster() : await profile();
  const name = String(body.name || "").trim();
  if (
    !name ||
    name.length > 80 ||
    !Number.isInteger(body.finish) ||
    body.finish < 0 ||
    body.finish > 6 ||
    !Number.isInteger(body.size) ||
    body.size < 14 ||
    body.size > 22 ||
    !["rim", "assembly"].includes(body.kind)
  )
    throw Error("Confira nome, acabamento, aro e conteúdo da fotografia.");
  const existing =
    shared &&
    Number.isInteger(body.model) &&
    body.model >= 0 &&
    body.model < models.length;
  const reference = existing
    ? doc(
        firestore,
        "wheelPhotos",
        `base-${body.model}-${body.finish}-${body.size}`,
      )
    : doc(collection(firestore, "wheelPhotos"));
  const folder = shared ? `catalog/${user.id}` : `users/${user.id}/wheelPhotos`;
  const old = existing ? await getDoc(reference) : undefined;
  if (old?.exists())
    throw Error(
      "Já existe uma imagem para este modelo, acabamento e aro. Envie como novo modelo para preservar o catálogo.",
    );
  const image = await upload(body.image, folder);
  const data = {
    name,
    owner_id: user.id,
    model: existing ? body.model : reference.id,
    finish: body.finish,
    size: body.size,
    image,
    source: String(body.source || ""),
    credit: String(body.credit || user.name),
    kind: body.kind,
    origin: body.origin === "generated" ? "generated" : "photograph",
    public: shared,
    createdAt: serverTimestamp(),
  };
  await setDoc(reference, data);
  return { id: reference.id, ...data, createdAt: undefined };
}
export async function firebaseApi(
  path: string,
  body?: any,
  method?: string,
): Promise<any> {
  try {
    if (path === "auth/register") {
      if (
        !body?.name?.trim() ||
        body.name.length > 80 ||
        body.password?.length < 8
      )
        throw Error("Informe nome e senha de pelo menos oito caracteres.");
      const credential = await createUserWithEmailAndPassword(
        auth,
        body.email.trim(),
        body.password,
      );
      await updateProfile(credential.user, { displayName: body.name.trim() });
      return await profile(body.name);
    }
    if (path === "auth/login") {
      await signInWithEmailAndPassword(auth, body.email.trim(), body.password);
      return await profile();
    }
    if (path === "logout") {
      await signOut(auth);
      return { ok: true };
    }
    if (path === "me") return await profile();
    if (path === "catalog") {
      const values = new Map(
        rows(await getDocs(collection(firestore, "catalog"))).map((d: any) => [
          Number(d.id),
          d.enabled,
        ]),
      );
      return models.map((m) => ({
        id: m.id,
        enabled: values.get(m.id) !== false ? 1 : 0,
      }));
    }
    if (path === "catalog/photos") return await photos(true);
    if (path === "my/photos")
      return await (body ? savePhoto(body, false) : photos(false));
    const user = await profile();
    if (path === "projects" && !body) {
      return rows(
        await getDocs(collection(firestore, "users", user.id, "projects")),
      )
        .map((p: any) => ({
          ...p,
          payload: { ...p.payload, wheels: equalizeWheels(p.payload.wheels) },
        }))
        .sort((a: any, b: any) => b.created.localeCompare(a.created));
    }
    if (path === "projects" && body) {
      if (
        !body.name?.trim() ||
        body.name.length > 80 ||
        !body.payload ||
        !Array.isArray(body.payload.wheels) ||
        body.payload.wheels.length !== 2 ||
        !body.payload.wheels.every(validPlacement)
      )
        throw Error("Confira o nome e os ajustes do projeto.");
      const reference = doc(
        collection(firestore, "users", user.id, "projects"),
      );
      const data = await uploadPayload(
        { ...body.payload, wheels: equalizeWheels(body.payload.wheels) },
        user.id,
        reference.id,
      );
      await setDoc(reference, {
        name: body.name.trim(),
        ...data,
        createdAt: serverTimestamp(),
      });
      return { id: reference.id };
    }
    if (path.startsWith("projects/") && method === "DELETE") {
      const id = path.split("/")[1],
        reference = doc(firestore, "users", user.id, "projects", id),
        value = await getDoc(reference);
      if (!value.exists()) return { ok: true };
      await deleteDoc(reference);
      await Promise.allSettled(
        (value.data().files || [])
          .filter((p: string) =>
            p.startsWith(`users/${user.id}/projects/${id}/`),
          )
          .map((p: string) => deleteObject(ref(storage, p))),
      );
      return { ok: true };
    }
    if (path === "maintenance" && !body)
      return rows(
        await getDocs(collection(firestore, "users", user.id, "maintenance")),
      ).sort((a: any, b: any) => b.date.localeCompare(a.date));
    if (path === "maintenance" && body) {
      if (
        !body.vehicle?.trim() ||
        !["Óleo", "Rodas e pneus", "Freios", "Revisão"].includes(body.kind) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
        !Number.isFinite(body.km) ||
        body.km < 0
      )
        throw Error("Confira os dados da manutenção.");
      await addDoc(collection(firestore, "users", user.id, "maintenance"), {
        ...body,
        vehicle: body.vehicle.trim(),
        notes: body.notes || "",
        createdAt: serverTimestamp(),
      });
      return { ok: true };
    }
    await isMaster();
    if (path === "admin/users" && !body)
      return rows(await getDocs(collection(firestore, "users")));
    if (path === "admin/users" && body) {
      if (
        body.id === user.id ||
        !["user", "master"].includes(body.role) ||
        typeof body.blocked !== "boolean"
      )
        throw Error("Alteração não permitida.");
      await updateDoc(doc(firestore, "users", body.id), {
        role: body.role,
        blocked: body.blocked,
      });
      return { ok: true };
    }
    if (path === "admin/catalog") {
      await setDoc(doc(firestore, "catalog", String(body.id)), {
        enabled: body.enabled,
      });
      return { ok: true };
    }
    if (path === "admin/photos") return await savePhoto(body, true);
    if (path === "admin/photo-submissions")
      return rows(
        await getDocs(
          query(
            collection(firestore, "wheelPhotos"),
            where("public", "==", false),
          ),
        ),
      );
    const publish = path.match(/^admin\/photo-submissions\/([^/]+)\/publish$/);
    if (publish) {
      const reference = doc(firestore, "wheelPhotos", publish[1]),
        photo = await getDoc(reference);
      if (!photo.exists()) throw Error("Envio não encontrado.");
      const data = photo.data();
      const url = new URL(data.image);
      if (
        url.hostname !== "firebasestorage.googleapis.com" &&
        !(
          import.meta.env.VITE_FIREBASE_EMULATORS === "true" &&
          url.hostname === "127.0.0.1"
        )
      )
        throw Error(
          "A imagem precisa estar no Firebase Storage do app para ser publicada.",
        );
      const imageResponse = await fetch(data.image);
      if (!imageResponse.ok)
        throw Error("Não foi possível carregar a imagem para publicar.");
      const blob = await imageResponse.blob();
      const encoded = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const image = await upload(encoded, `catalog/${user.id}`);
      await updateDoc(reference, { public: true, image });
      return { ok: true };
    }
    throw Error("Recurso não encontrado.");
  } catch (cause) {
    throw message(cause);
  }
}
