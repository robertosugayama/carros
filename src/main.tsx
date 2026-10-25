import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  Camera,
  ImagePlus,
  SlidersHorizontal,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ScanLine,
  Save,
  Download,
  Car,
  ChevronRight,
  Check,
  Plus,
  LogOut,
  Shield,
  Move,
  Eye,
  EyeOff,
  Wrench,
  Layers,
  X,
  Search,
  Sparkles,
  LoaderCircle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Wheel from "./Wheel";
import ProjectPreview from "./ProjectPreview";
import { useSavedImage } from "./useSavedImage";
import WheelFitControls from "./WheelFitControls";
import { clampDiameter, equalizeWheels } from "./wheelSizing";
import {
  models as baseModels,
  finishes,
  calipers,
  defaultWheels,
  type Placement,
} from "./catalog";
import { PhotoCatalog, findPhoto, type WheelPhoto } from "./PhotoCatalog";
import PhotoUpload from "./PhotoUpload";
import { hasDiscStyle, type DiscStyle } from "./brakeImages";
import { generatedPhotos, mergePhotos, inlinePhoto } from "./generatedPhotos";
import {
  tyreProfiles,
  type TyreProfile,
  validTyreProfile,
  outerDiameterMm,
} from "./tyres";
import "./style.css";
import { api } from "./api";
type User = { id: number | string; name: string; role: string };
type Project = {
  id: number | string;
  name: string;
  created: string;
  payload: any;
};
function App() {
  const [mobileAdjustmentsVisible, setMobileAdjustmentsVisible] =
    useState(false);
  const [mobileControls, setMobileControls] = useState(
    () => window.matchMedia("(max-width: 780px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 780px)");
    const update = () => setMobileControls(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const [tab, setTab] = useState("studio"),
    [user, setUser] = useState<User | null>(null),
    [auth, setAuth] = useState(false),
    [register, setRegister] = useState(false),
    [message, setMessage] = useState(""),
    [image, setImage] = useState(""),
    [carLoadAttempt, setCarLoadAttempt] = useState(0),
    [model, setModel] = useState<number | string>(18),
    [finish, setFinish] = useState(1),
    [caliper, setCaliper] = useState(4),
    [angle, setAngle] = useState(20),
    [size, setSize] = useState(18),
    [tyreProfile, setTyreProfile] = useState<TyreProfile>("medium"),
    [zoom, setZoom] = useState(1),
    [wheels, setWheels] = useState<Placement[]>(defaultWheels),
    [selected, setSelected] = useState(0),
    [before, setBefore] = useState(false),
    [showWheels, setShowWheels] = useState(true),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [scanner, setScanner] = useState(0),
    [ai, setAi] = useState(false),
    [query, setQuery] = useState(""),
    [enabled, setEnabled] = useState<number[]>(baseModels.map((m) => m.id)),
    [projects, setProjects] = useState<Project[]>([]),
    [maintenance, setMaintenance] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [notes, setNotes] = useState(""),
    [projectName, setProjectName] = useState("Meu projeto"),
    [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<WheelPhoto[]>(generatedPhotos),
    [savedPhoto, setSavedPhoto] = useState<WheelPhoto | undefined>();
  const [uploadOpen, setUploadOpen] = useState(false),
    [discStyle, setDiscStyle] = useState<DiscStyle>("drilled"),
    [brakeBusy, setBrakeBusy] = useState(false),
    [brakesDirty, setBrakesDirty] = useState(false),
    [submissions, setSubmissions] = useState<WheelPhoto[]>([]);
  const models = [
    ...baseModels,
    ...Array.from(
      new Map(
        photos
          .filter((p) => typeof p.model === "string" || p.model >= 1000)
          .map((p) => [
            p.model,
            {
              id: p.model,
              name: p.name || "Roda enviada",
              subtitle: p.credit,
              design: "photo",
              spokes: 0,
              lugs: 0,
            },
          ]),
      ).values(),
    ),
  ];
  const carImage = useSavedImage(image, carLoadAttempt);
  useEffect(() => {
    if (carImage.src && window.innerWidth <= 780)
      requestAnimationFrame(() =>
        document
          .querySelector(".workspace")
          ?.scrollIntoView({ block: "start" }),
      );
  }, [carImage.src]);
  const modelName = (id: number | string) =>
    models.find((m) => m.id === id)?.name || "Roda enviada";
  const activePhoto =
    savedPhoto?.model === model && savedPhoto?.finish === finish
      ? savedPhoto
      : findPhoto(photos, model, finish, size) ||
        photos.find((p) => p.model === model && p.finish === finish);
  function chooseModel(id: number | string) {
    setShowWheels(true);
    setBefore(false);

    setModel(id);
    setBrakesDirty(false);
    setSavedPhoto(undefined);
    const p = photos.find((p) => p.model === id);
    if (p) {
      setFinish(p.finish);
      setSize(p.size);
      setDiscStyle(p.discStyle || "drilled");
      setCaliper(p.caliperHue === 210 ? 5 : 4);
    }
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const publicPhotos = await api("catalog/photos");
        const own = user ? await api("my/photos") : [];
        if (!cancelled) setPhotos(mergePhotos([...own, ...publicPhotos]));
      } catch (e: any) {
        if (!cancelled) notify(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!auth) return;
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAuth(false);
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".auth-modal button,.auth-modal input",
          ),
        ).filter((n) => !n.hasAttribute("disabled"));
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [auth]);
  const photo = useRef<HTMLImageElement>(null),
    scene = useRef<HTMLDivElement>(null),
    gallery = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const drag = useRef<{ index: number; pointer: number } | null>(null);
  function notify(t: string) {
    setMessage(t);
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    api("me")
      .then(setUser)
      .catch(() => {});
    api("status")
      .then((d) => setAi(d.aiConfigured))
      .catch((e) => notify(e.message));
    api("catalog")
      .then((rows) =>
        setEnabled(rows.filter((r: any) => r.enabled).map((r: any) => r.id)),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (busy) {
      const timer = setInterval(() => setScanner((s) => (s + 1) % 3), 1500);
      return () => clearInterval(timer);
    }
  }, [busy]);
  useEffect(() => {
    if (!user) return;
    if (tab === "garage") {
      api("projects")
        .then(setProjects)
        .catch((e) => notify(e.message));
      api("maintenance")
        .then(setMaintenance)
        .catch((e) => notify(e.message));
    }
    if (tab === "admin") {
      api("admin/users")
        .then(setUsers)
        .catch((e) => notify(e.message));
      api("admin/photo-submissions")
        .then(setSubmissions)
        .catch((e) => notify(e.message));
    }
  }, [tab, user]);
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return notify("Escolha uma imagem JPEG, PNG ou WebP.");
    if (file.size > 20000000) return notify("Escolha uma foto com até 20 MB.");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 1800 / img.width, 1800 / img.height);
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      let photoData = c.toDataURL("image/jpeg", 0.88);
      if (photoData.length > 2400000)
        photoData = c.toDataURL("image/jpeg", 0.65);
      if (photoData.length > 2400000) throw Error("Imagem muito grande");
      setImage(photoData);
      setCarLoadAttempt((n) => n + 1);
      setShowWheels(true);
      setBefore(false);
      setWheels(defaultWheels.map((w) => ({ ...w })));
      setZoom(1);
      setEditing(true);
      notify(
        "Foto carregada. Use as setas na foto para posicionar cada roda e os botões + e − para ajustar as duas juntas.",
      );
    } catch {
      notify("Não foi possível abrir a foto.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function changeTyreProfile(next: TyreProfile) {
    const scale =
      outerDiameterMm(size, next) / outerDiameterMm(size, tyreProfile);
    setWheels((old) =>
      equalizeWheels(
        old.map((w) => ({ ...w, diameter: clampDiameter(w.diameter * scale) })),
      ),
    );
    setTyreProfile(next);
  }
  function changeRimSize(next: number) {
    const scale =
      outerDiameterMm(next, tyreProfile) / outerDiameterMm(size, tyreProfile);
    setWheels((old) =>
      equalizeWheels(
        old.map((w) => ({ ...w, diameter: clampDiameter(w.diameter * scale) })),
      ),
    );
    setSize(next);
  }
  function moveSelectedWheel(dx: number, dy: number) {
    setEditing(true);
    const rect = scene.current?.getBoundingClientRect();
    const xStep = 1.5 / Math.max(100, rect?.width || 500),
      yStep = 1.5 / Math.max(100, rect?.height || 300);
    setWheels((old) =>
      old.map((w, i) =>
        i === selected
          ? {
              ...w,
              x: Math.max(0, Math.min(1, w.x + dx * xStep)),
              y: Math.max(0, Math.min(1, w.y + dy * yStep)),
            }
          : w,
      ),
    );
  }
  function resizeBoth(delta: number) {
    setEditing(true);
    setWheels((old) =>
      equalizeWheels(old, clampDiameter(old[0].diameter + delta * 0.002)),
    );
  }
  function pointer(e: React.PointerEvent) {
    if (!drag.current || !scene.current) return;
    const r = scene.current.getBoundingClientRect(),
      index = drag.current.index;
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    setWheels((w) => w.map((v, i) => (i === index ? { ...v, x, y } : v)));
  }
  async function detect() {
    if (!image) return notify("Carregue uma foto real do carro para analisar.");
    if (!user) return setAuth(true);
    if (!ai)
      return notify(
        "Configure GEMINI_API_KEY no servidor. O posicionamento manual está disponível.",
      );
    setBusy(true);
    setScanner(0);
    try {
      const r = await api("gemini/detect-wheels", { image });
      setWheels(equalizeWheels(r.wheels));
      setSize(r.baseRim);
      notify(r.recommendations);
      setEditing(true);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveUploaded(p: Omit<WheelPhoto, "id">) {
    const result = await api(
      user?.role === "master" ? "admin/photos" : "my/photos",
      p,
    );
    setShowWheels(true);
    setPhotos((old) => [
      result,
      ...old.filter(
        (x) =>
          x.model !== result.model ||
          x.finish !== result.finish ||
          x.size !== result.size,
      ),
    ]);
    setModel(result.model);
    setFinish(result.finish);
    setSize(result.size);
    setSavedPhoto(undefined);
    setDiscStyle("drilled");
    setBrakesDirty(false);
    setUploadOpen(false);
    setTab("studio");
  }
  async function treatUpload(image: string, kind: "rim" | "assembly") {
    return (await api("gemini/edit-wheel", { image, kind, action: "prepare" }))
      .image;
  }
  async function applyBrakeAI() {
    if (!activePhoto) return;
    if (!user) {
      setAuth(true);
      return;
    }
    setBrakeBusy(true);
    try {
      const result = await api("gemini/edit-wheel", {
        image: await inlinePhoto(activePhoto.image),
        kind: activePhoto.kind || "assembly",
        action: "brakes",
        caliper,
        discStyle,
      });
      setSavedPhoto({
        ...activePhoto,
        image: result.image,
        solidImage: undefined,
        caliperHue: undefined,
        discStyle,
        origin: "generated",
      });
      setBrakesDirty(false);
      notify("Freios tratados por IA. Confira a prévia antes de salvar.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBrakeBusy(false);
    }
  }
  const canDeleteWheel =
    !!activePhoto &&
    !(typeof activePhoto.id === "number" && activePhoto.id < 0) &&
    !!user &&
    (user.role === "master" ||
      (activePhoto.owner_id === user.id && !activePhoto.public));
  async function deleteWheel() {
    if (!activePhoto || !canDeleteWheel) return;
    if (
      !confirm(
        "Excluir esta roda do catálogo? Os projetos já salvos serão mantidos.",
      )
    )
      return;
    try {
      await api("my/photos/" + activePhoto.id, undefined, "DELETE");
      setPhotos((old) => old.filter((p) => p.id !== activePhoto.id));
      const next = photos.find((p) => p.id !== activePhoto.id);
      if (next) {
        setModel(next.model);
        setFinish(next.finish);
        setSize(next.size);
      }
      setSavedPhoto(undefined);
      setShowWheels(false);
      notify("Roda excluída do catálogo.");
    } catch (cause: any) {
      notify(cause.message);
    }
  }
  function removeCar() {
    setImage("");
    setZoom(1);
    setWheels(defaultWheels.map((w) => ({ ...w })));
    setBefore(false);
    notify(
      "Carro removido desta montagem. Seus projetos salvos continuam na garagem.",
    );
  }
  async function save() {
    if (!activePhoto)
      return notify(
        "Este modelo ainda precisa de uma fotografia real no catálogo.",
      );
    if (
      activePhoto.kind !== "rim" &&
      (!hasDiscStyle(activePhoto, discStyle) ||
        (brakesDirty && activePhoto.caliperHue === undefined))
    )
      return notify("Aplique o tratamento por IA aos freios antes de salvar.");
    if (!user) return setAuth(true);
    if (!image) return notify("Carregue sua foto antes de salvar.");
    setSaving(true);
    try {
      await api("projects", {
        name: projectName,
        payload: {
          image: await inlinePhoto(image),
          showWheels,
          model,
          finish,
          caliper,
          discStyle,
          tyreProfile,
          angle,
          size,
          wheels,
          notes,
          photo: {
            ...activePhoto,
            image: await inlinePhoto(activePhoto.image),
            solidImage: activePhoto.solidImage
              ? await inlinePhoto(activePhoto.solidImage)
              : undefined,
          },
        },
      });
      notify("Projeto salvo na sua garagem.");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function exportImage() {
    if (!image || !photo.current || !scene.current)
      return notify("Carregue uma foto real do seu carro.");
    try {
      const c = document.createElement("canvas"),
        img = photo.current;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      if (!before && showWheels && activePhoto) {
        const svgs = scene.current.querySelectorAll(".wheel-overlay > svg");
        for (let i = 0; i < 2; i++) {
          const svg = svgs[i].cloneNode(true) as SVGSVGElement;
          svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          svg.setAttribute("width", "500");
          svg.setAttribute("height", "500");
          for (const node of svg.querySelectorAll("image")) {
            const source = node.getAttribute("href");
            if (!source)
              throw Error(
                "Aguarde a roda terminar de carregar antes de exportar.",
              );
            node.setAttribute("href", await inlinePhoto(source));
          }
          const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
              type: "image/svg+xml",
            }),
            url = URL.createObjectURL(blob);
          try {
            const wimg = new Image();
            wimg.src = url;
            await wimg.decode();
            const w = wheels[i],
              d = w.diameter * c.width;
            ctx.drawImage(
              wimg,
              w.x * c.width - d / 2,
              w.y * c.height - d / 2,
              d,
              d,
            );
          } finally {
            URL.revokeObjectURL(url);
          }
        }
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${Math.round(c.width / 65)}px sans-serif`;
      ctx.fillText(
        "AutoTuner 3D · Simulação visual",
        c.width * 0.025,
        c.height * 0.96,
      );
      const a = document.createElement("a");
      a.download = "autotuner-projeto.png";
      a.href = c.toDataURL("image/png");
      a.click();
    } catch {
      notify("Não foi possível exportar a imagem.");
    }
  }
  function openProject(p: Project) {
    const d = p.payload;
    setSavedPhoto(d.photo);
    setImage(d.image);
    setCarLoadAttempt((n) => n + 1);
    setShowWheels(d.showWheels !== false);
    setBefore(false);
    setEditing(true);
    setModel(d.model);
    setFinish(d.finish);
    setCaliper(d.caliper);
    setDiscStyle(d.discStyle || "drilled");
    setTyreProfile(validTyreProfile(d.tyreProfile));
    setBrakesDirty(false);
    setAngle(d.angle);
    setSize(d.size);
    setWheels(equalizeWheels(d.wheels));
    setNotes(d.notes || "");
    setProjectName(p.name);
    setZoom(1);
    setTab("studio");
    requestAnimationFrame(() =>
      document.querySelector(".workspace")?.scrollIntoView({ block: "start" }),
    );
  }
  const positionControls = !!carImage.src &&
    showWheels &&
    !before &&
    !!activePhoto && (
      <WheelFitControls
        wheels={wheels}
        selected={selected}
        onSelect={(i) => {
          setSelected(i);
          setEditing(true);
        }}
        onMove={moveSelectedWheel}
        onResize={resizeBoth}
        initialOpen={mobileControls}
        onClose={
          mobileControls ? () => setMobileAdjustmentsVisible(false) : undefined
        }
      />
    );
  const photoActions = !!image && (
    <div
      className="photo-quick-actions"
      role="group"
      aria-label="Ações da foto e das rodas"
    >
      <div>
        <span>Rodas</span>
        <button
          type="button"
          aria-label="Remover rodas"
          title="Remover rodas da foto"
          disabled={!showWheels}
          onClick={() => {
            if (
              confirm(
                "Remover as rodas desta foto? Elas continuarão no catálogo.",
              )
            )
              setShowWheels(false);
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <div>
        <span>Foto</span>
        <button
          type="button"
          aria-label="Trocar foto"
          title="Trocar foto do carro"
          onClick={() => {
            if (confirm("Trocar a foto do carro desta montagem?"))
              gallery.current?.click();
          }}
        >
          <RefreshCw size={17} />
        </button>
        <button
          type="button"
          aria-label="Remover carro"
          title="Remover foto do carro"
          onClick={() => {
            if (
              confirm(
                "Remover a foto desta montagem? Seus projetos salvos serão mantidos.",
              )
            )
              removeCar();
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>
  );
  return (
    <PhotoCatalog.Provider value={photos}>
      <>
        <header>
          <a className="brand" href="/" aria-label="AutoTuner início">
            <span className="brand-icon">
              <Layers size={23} />
            </span>
            AUTO<span>TUNER</span>
            <sup>3D</sup>
          </a>
          <nav aria-label="Navegação principal">
            <button
              className={tab === "studio" ? "active" : ""}
              onClick={() => setTab("studio")}
            >
              <SlidersHorizontal size={16} />
              Estúdio
            </button>
            <button
              className={tab === "garage" ? "active" : ""}
              onClick={() => setTab("garage")}
            >
              <Car size={16} />
              Minha garagem
            </button>
            {user?.role === "master" && (
              <button onClick={() => setTab("admin")}>
                <Shield size={16} />
                Admin
              </button>
            )}
          </nav>
          <button
            className="account"
            onClick={() =>
              user
                ? api("logout", {}).then(() => {
                    setUser(null);
                    setPhotos(generatedPhotos);
                    setTab("studio");
                  })
                : setAuth(true)
            }
          >
            {user ? (
              <>
                <span className="avatar">{user.name[0]}</span>
                <span>{user.name}</span>
                <LogOut size={16} />
              </>
            ) : (
              <>
                Entrar <ArrowUpRight size={16} />
              </>
            )}
          </button>
        </header>
        {tab === "studio" ? (
          <main>
            <section className="intro">
              <div>
                <div className="eyebrow">
                  <i /> SUA GARAGEM. SEM LIMITES.
                </div>
                <h1>
                  Seu carro. <em>Sua próxima versão.</em>
                </h1>
                <p>
                  Experimente rodas e pneus na sua foto. Encontre o setup que
                  tem a sua identidade.
                </p>
              </div>
              <span className="studio-badge">
                <span className="live-dot" /> ESTÚDIO DE PERSONALIZAÇÃO{" "}
                <b>01 / CRIE SEU SETUP</b>
              </span>
            </section>
            <div
              className={`workspace ${carImage.src ? "has-car" : ""}`}
              style={
                {
                  "--car-ratio": carImage.width
                    ? carImage.width / carImage.height
                    : 16 / 9,
                } as React.CSSProperties
              }
            >
              <section className="editor">
                <div className="editor-top">
                  <span>
                    <span className="live-dot" /> PROVADOR VISUAL{" "}
                    <span className="small-label">VISTA LATERAL · 90°</span>
                  </span>
                  {mobileControls && positionControls && (
                    <button
                      type="button"
                      className="toggle-mobile-adjustments"
                      aria-label={
                        mobileAdjustmentsVisible
                          ? "Ocultar ajustes"
                          : "Mostrar ajustes"
                      }
                      title={
                        mobileAdjustmentsVisible
                          ? "Ocultar ajustes"
                          : "Mostrar ajustes"
                      }
                      aria-expanded={mobileAdjustmentsVisible}
                      onClick={() =>
                        setMobileAdjustmentsVisible((value) => !value)
                      }
                    >
                      {mobileAdjustmentsVisible ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                      <span>
                        {mobileAdjustmentsVisible ? "Voltar" : "Ajustar"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setWheels(defaultWheels.map((w) => ({ ...w })));
                      setZoom(1);
                    }}
                    aria-label="Restaurar posição das rodas"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <div className="viewport">
                  <div
                    className="scene-holder"
                    style={{
                      width:
                        carImage.src && zoom === 1
                          ? "min(100%, calc(var(--photo-height, var(--stage-height)) * var(--car-ratio)))"
                          : `${zoom * 100}%`,
                    }}
                  >
                    {!image && (
                      <div className="real-photo-empty">
                        <Camera size={34} />
                        <h2>A sua foto é o ponto de partida.</h2>
                        <p>
                          Fotografe o carro de lado e experimente conjuntos de
                          rodas e pneus.
                        </p>
                        <button
                          className="primary"
                          onClick={() => gallery.current?.click()}
                        >
                          <ImagePlus size={18} />
                          Carregar foto do carro
                        </button>
                        <span>FOTO DO SEU CARRO · CATÁLOGO VISUAL</span>
                      </div>
                    )}
                    <div
                      ref={scene}
                      className="scene"
                      hidden={!image}
                      style={{
                        aspectRatio: carImage.width
                          ? carImage.width / carImage.height
                          : 16 / 9,
                      }}
                    >
                      <img
                        ref={photo}
                        crossOrigin="anonymous"
                        src={carImage.src || undefined}
                        style={{ display: carImage.src ? "block" : "none" }}
                        alt="Sua foto real de perfil do veículo"
                        draggable={false}
                      />
                      {!carImage.src && !!image && (
                        <div className="car-image-status" role="status">
                          {carImage.error || "Carregando foto do carro…"}
                        </div>
                      )}
                      {!!carImage.src &&
                        showWheels &&
                        !before &&
                        !!activePhoto &&
                        wheels.map((w, i) => (
                          <div
                            key={i}
                            className={`wheel-overlay ${editing ? "editable" : ""} ${editing && selected === i ? "selected" : ""}`}
                            style={{
                              left: `${w.x * 100}%`,
                              top: `${w.y * 100}%`,
                              width: `${w.diameter * 100}%`,
                            }}
                            onPointerDown={(e) => {
                              if (!editing) return;
                              setSelected(i);
                              drag.current = { index: i, pointer: e.pointerId };
                              e.currentTarget.setPointerCapture(e.pointerId);
                            }}
                            onPointerMove={pointer}
                            onPointerUp={() => (drag.current = null)}
                            onPointerCancel={() => (drag.current = null)}
                          >
                            <Wheel
                              {...{
                                model,
                                finish,
                                caliper,
                                angle,
                                size,
                                discStyle,
                                tyreProfile,
                              }}
                              photo={activePhoto}
                              mounted
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                  {!mobileControls && (
                    <>
                      {positionControls}
                      {photoActions}
                    </>
                  )}
                  {busy && (
                    <div className="scanner">
                      <div className="scan-line" />
                      <ScanLine size={38} />
                      <b>Analisando sua foto</b>
                      <span>
                        {
                          [
                            "Análise de bordas da carroceria",
                            "Mapeamento dos eixos",
                            "Proporcionalização dos aros",
                          ][scanner]
                        }
                      </span>
                      <small>
                        Etapas visuais indicativas · aguardando resposta da IA
                      </small>
                    </div>
                  )}
                </div>
                {mobileControls &&
                  positionControls &&
                  mobileAdjustmentsVisible && (
                    <div
                      className="mobile-fixed-controls mobile-photo-controls"
                      role="group"
                      aria-label="Ajustes fixos da foto"
                    >
                      {positionControls}
                      <button
                        type="button"
                        className="finish-mobile-adjustments"
                        onClick={() => setMobileAdjustmentsVisible(false)}
                      >
                        Concluir e voltar às ferramentas
                      </button>
                    </div>
                  )}
              </section>
              <aside
                className="config"
                aria-label="Ferramentas de personalização"
              >
                {mobileControls && photoActions && (
                  <div
                    className="mobile-photo-actions"
                    role="group"
                    aria-label="Controles da foto"
                  >
                    {photoActions}
                  </div>
                )}
                <div className="photo-footer">
                  <div className="canvas-toolbar">
                    <div className="zoom-controls">
                      <button
                        onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                        aria-label="Diminuir zoom"
                      >
                        <ZoomOut size={17} />
                      </button>
                      <span>{Math.round(zoom * 100)}%</span>
                      <button
                        onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                        aria-label="Aumentar zoom"
                      >
                        <ZoomIn size={17} />
                      </button>
                    </div>
                    <button
                      className={editing ? "tool selected-tool" : "tool"}
                      onClick={() => {
                        if (mobileControls) {
                          if (!carImage.src || !activePhoto) {
                            notify(
                              "Carregue a foto do carro e selecione uma roda para ajustar.",
                            );
                            return;
                          }
                          setBefore(false);
                          setShowWheels(true);
                          setEditing(true);
                          setMobileAdjustmentsVisible(true);
                        } else setEditing(!editing);
                      }}
                    >
                      <Move size={15} />
                      Ajustar rodas
                    </button>
                    <button className="tool" onClick={() => setBefore(!before)}>
                      <Eye size={16} />
                      {before ? "Ver depois" : "Ver original"}
                    </button>
                    {!!image && (
                      <button
                        type="button"
                        className="tool"
                        disabled={busy}
                        onClick={detect}
                      >
                        <Sparkles size={16} />
                        {busy ? "Analisando…" : "Detectar com IA"}
                      </button>
                    )}
                    <span className="photo-label">
                      {!image ? "CARREGUE SUA FOTO" : "FOTOGRAFIA REAL"}
                    </span>
                  </div>
                </div>
                {!image && (
                  <div className="upload-row">
                    <button
                      className="dark-button"
                      onClick={() => camera.current?.click()}
                    >
                      <Camera size={17} />
                      Tirar foto
                    </button>
                    <button
                      className="light-button"
                      onClick={() => gallery.current?.click()}
                    >
                      <ImagePlus size={17} />
                      Escolher da galeria
                    </button>
                  </div>
                )}
                <input
                  ref={camera}
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={gallery}
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <div className="hint">
                  <ScanLine size={17} />
                  <p>
                    <b>O melhor ângulo faz a diferença.</b> Use uma foto de
                    lado, a 90°, com as duas rodas visíveis. Ajuste manual
                    disponível a qualquer momento.
                  </p>
                </div>
                <div className="setup-summary">
                  <span>
                    <Check size={16} /> Círculos perfeitos
                  </span>
                  <span>
                    <Check size={16} /> Zoom sincronizado
                  </span>
                  <span>
                    <Check size={16} /> Ajuste em tempo real
                  </span>
                </div>

                <div className="config-heading">
                  <div>
                    <SlidersHorizontal size={18} />
                    <h2>Seu setup</h2>
                  </div>
                  <span>AO VIVO</span>
                </div>
                <section>
                  <div className="label-heading">
                    <h3>
                      <b>01</b> Modelo de roda
                    </h3>
                    <span>
                      {
                        new Set(
                          photos
                            .map((p) => p.model)
                            .filter(
                              (id) =>
                                typeof id === "string" ||
                                id >= 1000 ||
                                enabled.includes(id),
                            ),
                        ).size
                      }{" "}
                      COM IMAGEM /{" "}
                      {
                        models.filter(
                          (m) =>
                            typeof m.id === "string" ||
                            m.id >= 1000 ||
                            enabled.includes(m.id),
                        ).length
                      }{" "}
                      MODELOS
                    </span>
                  </div>
                  <button
                    className="light-button studio-upload"
                    onClick={() => (user ? setUploadOpen(true) : setAuth(true))}
                  >
                    <ImagePlus size={17} />
                    Enviar foto de roda
                  </button>
                  <div className="model-current">
                    <div className="wheel-preview">
                      <Wheel
                        {...{
                          model,
                          finish,
                          caliper,
                          angle,
                          size,
                          discStyle,
                          tyreProfile,
                        }}
                        photo={activePhoto}
                      />
                    </div>
                    <div>
                      <h4>{modelName(model)}</h4>
                      <p>{models.find((m) => m.id === model)?.subtitle}</p>
                      <span className="outline-tag">
                        {activePhoto
                          ? activePhoto.origin === "generated"
                            ? "GERADA POR IA"
                            : "FOTOGRAFIA REAL"
                          : "FOTO PENDENTE"}
                      </span>
                    </div>
                  </div>
                  {activePhoto ? (
                    <p className="photo-source">
                      Origem:{" "}
                      {activePhoto.source ? (
                        <a
                          href={activePhoto.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {activePhoto.credit}
                        </a>
                      ) : (
                        <span>{activePhoto.credit}</span>
                      )}{" "}
                      · aro {activePhoto.size}”
                    </p>
                  ) : (
                    <p className="photo-required">
                      Este conjunto ainda não tem fotografia neste acabamento e
                      aro. Escolha um modelo com foto disponível.
                    </p>
                  )}
                  <div className="search">
                    <Search size={15} />
                    <input
                      aria-label="Buscar modelo"
                      placeholder="Encontre seu estilo…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  {canDeleteWheel && (
                    <button
                      type="button"
                      className="delete-catalog-wheel"
                      onClick={deleteWheel}
                    >
                      <Trash2 size={16} />
                      Excluir roda do catálogo
                    </button>
                  )}
                  <div className="model-grid">
                    {models
                      .filter(
                        (m) =>
                          ((typeof m.id === "number" &&
                            enabled.includes(m.id)) ||
                            typeof m.id === "string" ||
                            m.id >= 1000) &&
                          (m.name + " " + m.subtitle)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .sort(
                        (a, b) =>
                          Number(photos.some((p) => p.model === b.id)) -
                          Number(photos.some((p) => p.model === a.id)),
                      )
                      .map((m) => (
                        <button
                          key={m.id}
                          className={model === m.id ? "model active" : "model"}
                          onClick={() => chooseModel(m.id)}
                          aria-pressed={model === m.id}
                        >
                          <Wheel
                            model={m.id}
                            finish={
                              photos.find((p) => p.model === m.id)?.finish ??
                              finish
                            }
                            size={
                              photos.find((p) => p.model === m.id)?.size ?? size
                            }
                          />
                          <span>{m.name}</span>
                          {model === m.id && (
                            <i>
                              <Check size={10} />
                            </i>
                          )}
                        </button>
                      ))}
                  </div>
                </section>
                <section>
                  <div className="label-heading">
                    <h3>
                      <b>02</b> Acabamento
                    </h3>
                    <span>{finishes[finish][0]}</span>
                  </div>
                  <div className="swatches">
                    {finishes.map(([name, color], i) => (
                      <button
                        key={name}
                        aria-label={name}
                        title={name}
                        aria-pressed={finish === i}
                        className={finish === i ? "swatch selected" : "swatch"}
                        style={{
                          background: `linear-gradient(135deg,#ffffff88,${color} 50%,#0008)`,
                        }}
                        disabled={
                          !photos.some(
                            (p) => p.model === model && p.finish === i,
                          )
                        }
                        onClick={() => {
                          setSavedPhoto(undefined);
                          setFinish(i);
                          const p = photos.find(
                            (p) => p.model === model && p.finish === i,
                          );
                          if (p) setSize(p.size);
                        }}
                      >
                        {finish === i && (
                          <Check
                            size={15}
                            color={i < 2 ? "#182225" : "white"}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </section>
                <section>
                  <div className="label-heading">
                    <h3>
                      <b>03</b> Referência do aro
                    </h3>
                    <strong>{size}”</strong>
                  </div>
                  <label>
                    Aro da roda
                    <select
                      aria-label="Tamanho do aro"
                      value={size}
                      disabled={!activePhoto}
                      onChange={(e) => changeRimSize(Number(e.target.value))}
                    >
                      {Array.from({ length: 9 }, (_, i) => (
                        <option key={i} value={i + 14}>
                          {i + 14} polegadas
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="tyre-options">
                    <legend>Perfil do pneu</legend>
                    <div>
                      {tyreProfiles.map((profile) => (
                        <label
                          key={profile.id}
                          className={
                            tyreProfile === profile.id ? "selected" : ""
                          }
                        >
                          <input
                            type="radio"
                            name="tyre-profile"
                            checked={tyreProfile === profile.id}
                            onChange={() => changeTyreProfile(profile.id)}
                          />
                          <b>{profile.name}</b>
                          <span>{profile.aspect}%</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <p className="rim-size-explainer">
                    Roda e pneu mudam juntos nas duas posições. Textura de
                    aparência fotográfica gerada por IA. Perfis ilustrados com
                    largura de referência de 225 mm.
                  </p>
                </section>
                <section>
                  <div className="label-heading">
                    <h3>
                      <b>04</b> Personalizar freios
                    </h3>
                    <span>PRÉVIA VISUAL</span>
                  </div>
                  <label className="brake-color-label">
                    Cor da pinça <b>{calipers[caliper][0]}</b>
                  </label>
                  <div className="swatches calipers">
                    {calipers.map(([name, color], i) => (
                      <button
                        key={name}
                        type="button"
                        aria-label={"Pinça " + name}
                        title={name}
                        aria-pressed={caliper === i}
                        className={caliper === i ? "swatch selected" : "swatch"}
                        style={{ background: color }}
                        onClick={() => {
                          setCaliper(i);
                          setBrakesDirty(true);
                        }}
                      >
                        {caliper === i && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                  <fieldset className="disc-options">
                    <legend>Disco de freio</legend>
                    {(["drilled", "solid"] as const).map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="disc-style"
                          value={value}
                          checked={discStyle === value}
                          onChange={() => {
                            setDiscStyle(value);
                            setBrakesDirty(true);
                          }}
                        />
                        {value === "solid" ? "Liso, sem furos" : "Perfurado"}
                      </label>
                    ))}
                  </fieldset>
                  {activePhoto?.kind === "rim" ||
                  (activePhoto?.caliperHue !== undefined &&
                    hasDiscStyle(activePhoto, discStyle)) ? (
                    <p className="photographic-brakes">
                      Disco proporcional de referência (280 mm), atrás dos
                      raios. Cor e tipo de disco aplicados às duas rodas.
                    </p>
                  ) : (
                    <div className="brake-ai-apply">
                      <p>
                        Para esta foto, aplique as opções com IA e confira a
                        prévia.
                      </p>
                      <button
                        className="light-button"
                        disabled={brakeBusy || !activePhoto}
                        onClick={applyBrakeAI}
                      >
                        {brakeBusy
                          ? "Tratando freios…"
                          : "Aplicar freios com IA"}
                      </button>
                    </div>
                  )}
                </section>
                <div className="save-area">
                  <label>
                    Nome do projeto
                    <input
                      maxLength={80}
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </label>
                  <label>
                    Notas
                    <textarea
                      maxLength={2000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Seu próximo upgrade…"
                    />
                  </label>
                  <button className="primary" disabled={saving} onClick={save}>
                    <Save size={17} />
                    {saving ? "Salvando…" : "Salvar na minha garagem"}
                    <ChevronRight size={17} />
                  </button>
                  <button className="export" onClick={exportImage}>
                    <Download size={15} />
                    Exportar imagem
                  </button>
                </div>
              </aside>
            </div>
            <section className="bottom-note">
              <Shield size={23} />
              <div>
                <b>Visualize primeiro. Transforme depois.</b>
                <p>
                  Fotomontagem com imagens reais, sem reconstrução 3D. Não
                  verifica furação, offset, folgas, homologação ou
                  compatibilidade. Consulte um especialista antes de instalar.
                </p>
              </div>
              <span>
                FEITO PARA QUEM AMA CARROS <ArrowUpRight size={16} />
              </span>
            </section>
          </main>
        ) : (
          <main className="secondary">
            <div className="eyebrow">SEU UNIVERSO AUTOMOTIVO</div>
            <h1>
              {tab === "garage"
                ? "Minha garagem."
                : "Central de administração."}
            </h1>
            {!user ? (
              <div className="empty">
                <Car size={45} />
                <h2>Seus projetos merecem uma garagem.</h2>
                <p>
                  Entre para salvar personalizações e acompanhar manutenções.
                </p>
                <button className="primary" onClick={() => setAuth(true)}>
                  Entrar ou criar conta
                </button>
              </div>
            ) : tab === "garage" ? (
              <>
                <div className="section-title">
                  <h2>
                    Projetos salvos <span>{projects.length}</span>
                  </h2>
                  <button
                    onClick={() => setTab("studio")}
                    className="dark-button"
                  >
                    <Plus size={16} />
                    Novo projeto
                  </button>
                </div>
                <div className="project-grid">
                  {projects.length ? (
                    projects.map((p) => (
                      <article key={p.id} className="project">
                        <ProjectPreview
                          payload={p.payload}
                          name={p.name}
                          onOpen={() => openProject(p)}
                        />
                        <h3>{p.name}</h3>
                        <p>
                          {modelName(p.payload.model)} · {p.payload.size}”
                        </p>
                        <p>{p.payload.notes}</p>
                        <div>
                          <button
                            className="light-button"
                            onClick={() => openProject(p)}
                          >
                            Abrir projeto
                          </button>
                          <button
                            className="text-button"
                            onClick={async () => {
                              if (!confirm("Excluir este projeto?")) return;
                              try {
                                await api(
                                  "projects/" + p.id,
                                  undefined,
                                  "DELETE",
                                );
                                setProjects(
                                  projects.filter((x) => x.id !== p.id),
                                );
                              } catch (e: any) {
                                notify(e.message);
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty">
                      <Layers size={30} />
                      <p>
                        Nenhum projeto ainda. Crie seu primeiro setup no
                        estúdio.
                      </p>
                    </div>
                  )}
                </div>
                <div className="section-title">
                  <h2>
                    <Wrench size={22} /> Histórico de manutenção
                  </h2>
                </div>
                <form
                  className="maintenance-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const values = Object.fromEntries(new FormData(form));
                    try {
                      await api("maintenance", {
                        ...values,
                        km: Number(values.km),
                      });
                      setMaintenance(await api("maintenance"));
                      form.reset();
                      notify("Manutenção registrada.");
                    } catch (e: any) {
                      notify(e.message);
                    }
                  }}
                >
                  <label>
                    Veículo
                    <input
                      name="vehicle"
                      required
                      maxLength={80}
                      placeholder="Ex.: Meu Golf"
                    />
                  </label>
                  <label>
                    Serviço
                    <select name="kind">
                      {["Óleo", "Rodas e pneus", "Freios", "Revisão"].map(
                        (t) => (
                          <option key={t}>{t}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Data
                    <input type="date" name="date" required />
                  </label>
                  <label>
                    Quilometragem
                    <input type="number" name="km" min="0" step="1" required />
                  </label>
                  <label>
                    Notas
                    <input name="notes" maxLength={2000} />
                  </label>
                  <button className="primary">
                    <Plus size={16} />
                    Registrar
                  </button>
                </form>
                <div className="maintenance-list">
                  {maintenance.map((m) => (
                    <article key={m.id}>
                      <Wrench size={20} />
                      <div>
                        <h3>
                          {m.kind} · {m.vehicle}
                        </h3>
                        <p>
                          {new Date(m.date + "T12:00:00").toLocaleDateString(
                            "pt-BR",
                          )}{" "}
                          · {Number(m.km).toLocaleString("pt-BR")} km
                        </p>
                        <p>{m.notes}</p>
                      </div>
                    </article>
                  ))}
                  {!maintenance.length && <p>Nenhuma manutenção registrada.</p>}
                </div>
              </>
            ) : (
              <>
                <h2>Usuários</h2>
                {users.map((u) => (
                  <div className="admin-row" key={u.id}>
                    <div>
                      <b>{u.name}</b>
                      <p>
                        {u.email} · {u.role} ·{" "}
                        {u.blocked ? "Bloqueado" : "Ativo"}
                      </p>
                    </div>
                    {u.id !== user.id && (
                      <div>
                        <button
                          className="light-button"
                          onClick={async () => {
                            try {
                              await api("admin/users", {
                                id: u.id,
                                role: u.role,
                                blocked: !u.blocked,
                              });
                              setUsers(await api("admin/users"));
                            } catch (e: any) {
                              notify(e.message);
                            }
                          }}
                        >
                          {u.blocked ? "Desbloquear" : "Bloquear"}
                        </button>
                        <button
                          className="light-button"
                          onClick={async () => {
                            if (!confirm("Alterar permissão desta conta?"))
                              return;
                            try {
                              await api("admin/users", {
                                id: u.id,
                                role: u.role === "master" ? "user" : "master",
                                blocked: !!u.blocked,
                              });
                              setUsers(await api("admin/users"));
                            } catch (e: any) {
                              notify(e.message);
                            }
                          }}
                        >
                          {u.role === "master"
                            ? "Remover master"
                            : "Promover master"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <PhotoUpload
                  notify={notify}
                  onSave={saveUploaded}
                  onTreat={treatUpload}
                  shared
                />
                <h2>Fotos enviadas por usuários</h2>
                {submissions.length ? (
                  submissions.map((p) => (
                    <article className="submission" key={p.id}>
                      <img src={p.image} alt={p.name || "Roda enviada"} />
                      <div>
                        <b>{p.name}</b>
                        <p>{p.credit}</p>
                        <button
                          className="light-button"
                          onClick={async () => {
                            try {
                              await api(
                                "admin/photo-submissions/" + p.id + "/publish",
                                {},
                              );
                              setSubmissions((old) =>
                                old.filter((x) => x.id !== p.id),
                              );
                              setPhotos(
                                mergePhotos(await api("catalog/photos")),
                              );
                              notify(
                                "Foto publicada no catálogo compartilhado.",
                              );
                            } catch (e: any) {
                              notify(e.message);
                            }
                          }}
                        >
                          Publicar no catálogo
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <p>Nenhum envio aguardando publicação.</p>
                )}
                <h2 className="catalog-title">Catálogo público</h2>
                <p>Ative ou oculte modelos disponíveis no estúdio.</p>
                {models
                  .filter((m) => typeof m.id === "number" && m.id < 1000)
                  .map((m) => (
                    <label className="catalog-admin" key={m.id}>
                      <input
                        type="checkbox"
                        checked={
                          typeof m.id === "number" && enabled.includes(m.id)
                        }
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          try {
                            await api("admin/catalog", {
                              id: m.id,
                              enabled: checked,
                            });
                            setEnabled((v) =>
                              checked
                                ? [...v, Number(m.id)]
                                : v.filter((id) => id !== m.id),
                            );
                          } catch (e: any) {
                            notify(e.message);
                          }
                        }}
                      />
                      {m.name}
                      <span>
                        {m.subtitle} ·{" "}
                        {photos.filter((p) => p.model === m.id).length} fotos
                        reais
                      </span>
                    </label>
                  ))}
              </>
            )}
          </main>
        )}
        <footer>
          <a className="brand" href="/">
            AUTO<span>TUNER</span>
            <sup>3D</sup>
          </a>
          <span>Imagine. Personalize. Faça acontecer.</span>
          <small>ESTÚDIO VIRTUAL AUTOMOTIVO</small>
        </footer>
        {uploadOpen && (
          <div className="modal-backdrop" onClick={() => setUploadOpen(false)}>
            <section
              className="upload-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Enviar foto de roda"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close"
                aria-label="Fechar envio de roda"
                onClick={() => setUploadOpen(false)}
              >
                <X size={20} />
              </button>
              <PhotoUpload
                notify={notify}
                onSave={saveUploaded}
                onTreat={treatUpload}
                shared={user?.role === "master"}
              />
            </section>
          </div>
        )}
        {auth && (
          <div className="modal-backdrop" onClick={() => setAuth(false)}>
            <section
              className="auth-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close"
                aria-label="Fechar"
                onClick={() => setAuth(false)}
              >
                <X size={20} />
              </button>
              <div className="eyebrow">BEM-VINDO À SUA GARAGEM</div>
              <h2 id="auth-title">
                {register
                  ? "Comece sua próxima versão."
                  : "Bom ter você de volta."}
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  try {
                    const u = await api(
                      "auth/" + (register ? "register" : "login"),
                      Object.fromEntries(new FormData(f)),
                    );
                    setUser(u);
                    setAuth(false);
                    notify("Bem-vindo, " + u.name + "!");
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                {register && (
                  <label>
                    Seu nome
                    <input
                      name="name"
                      required
                      maxLength={80}
                      autoComplete="name"
                      autoFocus
                    />
                  </label>
                )}
                <label>
                  E-mail
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus={!register}
                  />
                </label>
                <label>
                  Senha
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    minLength={register ? 8 : 1}
                    maxLength={128}
                    required
                  />
                  <small>
                    {register
                      ? "Mínimo de 8 caracteres."
                      : "Use a senha definida para sua conta."}
                  </small>
                </label>
                <button className="primary">
                  {register ? "Criar minha conta" : "Entrar"}
                </button>
              </form>
              <button
                className="text-button"
                onClick={() => setRegister(!register)}
              >
                {register
                  ? "Já tenho conta"
                  : "Ainda não tenho conta. Quero me cadastrar"}
              </button>
            </section>
          </div>
        )}
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            <button onClick={() => setMessage("")} aria-label="Fechar aviso">
              <X size={17} />
            </button>
          </div>
        )}
      </>
    </PhotoCatalog.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
