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
  Wrench,
  Layers,
  X,
  Search,
  Sparkles,
  LoaderCircle,
} from "lucide-react";
import Wheel from "./Wheel";
import {
  models,
  finishes,
  calipers,
  defaultWheels,
  type Placement,
} from "./catalog";
import { PhotoCatalog, findPhoto, type WheelPhoto } from "./PhotoCatalog";
import PhotoUpload from "./PhotoUpload";
import "./style.css";
type User = { id: number; name: string; role: string };
type Project = { id: number; name: string; created: string; payload: any };
async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch("/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Não foi possível concluir.");
  return d;
}
function App() {
  const [tab, setTab] = useState("studio"),
    [user, setUser] = useState<User | null>(null),
    [auth, setAuth] = useState(false),
    [register, setRegister] = useState(false),
    [message, setMessage] = useState(""),
    [image, setImage] = useState(""),
    [model, setModel] = useState(14),
    [finish, setFinish] = useState(1),
    [caliper, setCaliper] = useState(4),
    [angle, setAngle] = useState(20),
    [size, setSize] = useState(18),
    [zoom, setZoom] = useState(1),
    [wheels, setWheels] = useState<Placement[]>(defaultWheels),
    [selected, setSelected] = useState(0),
    [before, setBefore] = useState(false),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [scanner, setScanner] = useState(0),
    [ai, setAi] = useState(false),
    [query, setQuery] = useState(""),
    [enabled, setEnabled] = useState<number[]>(models.map((m) => m.id)),
    [projects, setProjects] = useState<Project[]>([]),
    [maintenance, setMaintenance] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [notes, setNotes] = useState(""),
    [projectName, setProjectName] = useState("Meu projeto"),
    [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<WheelPhoto[]>([]),
    [savedPhoto, setSavedPhoto] = useState<WheelPhoto | undefined>();
  const activePhoto =
    savedPhoto?.model === model &&
    savedPhoto?.finish === finish &&
    (savedPhoto?.kind === "rim" || savedPhoto?.size === size)
      ? savedPhoto
      : findPhoto(photos, model, finish, size) ||
        photos.find(
          (p) => p.model === model && p.finish === finish && p.kind === "rim",
        );
  function chooseModel(id: number) {
    setModel(id);
    setSavedPhoto(undefined);
    const p = photos.find((p) => p.model === id);
    if (p) {
      setFinish(p.finish);
      setSize(p.size);
    }
  }
  useEffect(() => {
    api("catalog/photos")
      .then(setPhotos)
      .catch((e) => notify(e.message));
  }, []);
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
    api("status").then((d) => setAi(d.aiConfigured));
    api("catalog").then((rows) =>
      setEnabled(rows.filter((r: any) => r.enabled).map((r: any) => r.id)),
    );
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
    if (tab === "admin")
      api("admin/users")
        .then(setUsers)
        .catch((e) => notify(e.message));
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
      setWheels(defaultWheels.map((w) => ({ ...w })));
      setZoom(1);
      setEditing(true);
      notify(
        "Foto carregada. Arraste os centros e ajuste o diâmetro de cada roda.",
      );
    } catch {
      notify("Não foi possível abrir a foto.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function updateWheel(p: Partial<Placement>) {
    setWheels((w) => w.map((v, i) => (i === selected ? { ...v, ...p } : v)));
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
      setWheels(r.wheels);
      setSize(r.baseRim);
      notify(r.recommendations);
      setEditing(true);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!activePhoto)
      return notify(
        "Este modelo ainda precisa de uma fotografia real no catálogo.",
      );
    if (!user) return setAuth(true);
    if (!image) return notify("Carregue sua foto antes de salvar.");
    setSaving(true);
    try {
      await api("projects", {
        name: projectName,
        payload: {
          image,
          model,
          finish,
          caliper,
          angle,
          size,
          wheels,
          notes,
          photo: activePhoto,
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
      if (!before && activePhoto) {
        const svgs = scene.current.querySelectorAll(".wheel-overlay svg");
        for (let i = 0; i < 2; i++) {
          const svg = svgs[i].cloneNode(true) as SVGSVGElement;
          svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          svg.setAttribute("width", "500");
          svg.setAttribute("height", "500");
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
    setModel(d.model);
    setFinish(d.finish);
    setCaliper(d.caliper);
    setAngle(d.angle);
    setSize(d.size);
    setWheels(d.wheels);
    setNotes(d.notes || "");
    setProjectName(p.name);
    setZoom(1);
    setTab("studio");
  }
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
                  Experimente rodas e pneus reais na sua foto. Encontre o setup
                  que tem a sua identidade.
                </p>
              </div>
              <span className="studio-badge">
                <span className="live-dot" /> ESTÚDIO DE PERSONALIZAÇÃO{" "}
                <b>01 / CRIE SEU SETUP</b>
              </span>
            </section>
            <div className="workspace">
              <section className="editor">
                <div className="editor-top">
                  <span>
                    <span className="live-dot" /> PROVADOR VISUAL{" "}
                    <span className="small-label">VISTA LATERAL · 90°</span>
                  </span>
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
                    style={{ width: `${zoom * 100}%` }}
                  >
                    {!image && (
                      <div className="real-photo-empty">
                        <Camera size={34} />
                        <h2>A sua foto é o ponto de partida.</h2>
                        <p>
                          Fotografe o carro de lado e experimente conjuntos
                          reais de rodas e pneus.
                        </p>
                        <button
                          className="primary"
                          onClick={() => gallery.current?.click()}
                        >
                          <ImagePlus size={18} />
                          Carregar foto do carro
                        </button>
                        <span>FOTOGRAFIAS REAIS · SEM DESENHOS</span>
                      </div>
                    )}
                    <div ref={scene} className="scene" hidden={!image}>
                      <img
                        ref={photo}
                        src={image || undefined}
                        alt="Sua foto real de perfil do veículo"
                        draggable={false}
                      />
                      {!before &&
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
                              {...{ model, finish, caliper, angle, size }}
                              photo={activePhoto}
                              mounted
                            />
                            {editing && <span className="center-cross">+</span>}
                          </div>
                        ))}
                    </div>
                  </div>
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
                    onClick={() => setEditing(!editing)}
                  >
                    <Move size={15} />
                    Ajustar rodas
                  </button>
                  <button className="tool" onClick={() => setBefore(!before)}>
                    <Eye size={16} />
                    {before ? "Ver depois" : "Ver original"}
                  </button>
                  <span className="photo-label">
                    {!image ? "CARREGUE SUA FOTO" : "FOTOGRAFIA REAL"}
                  </span>
                </div>
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
                  <button
                    className="ai-button"
                    onClick={detect}
                    disabled={busy}
                  >
                    <Sparkles size={16} />
                    {busy ? "Analisando…" : "Detectar com IA"}
                  </button>
                </div>
                <input
                  ref={camera}
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
                <input
                  ref={gallery}
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
                <div className="hint">
                  <ScanLine size={17} />
                  <p>
                    <b>O melhor ângulo faz a diferença.</b> Use uma foto de
                    lado, a 90°, com as duas rodas visíveis. Ajuste manual
                    disponível a qualquer momento.
                  </p>
                </div>
                {editing && (
                  <section className="manual">
                    <div>
                      <b>Ajuste de precisão</b>
                      <span>Arraste a roda na foto ou use os controles.</span>
                    </div>
                    <div className="segmented">
                      {["Roda esquerda", "Roda direita"].map((s, i) => (
                        <button
                          className={selected === i ? "active" : ""}
                          onClick={() => setSelected(i)}
                          key={s}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {(["x", "y", "diameter"] as const).map((k, i) => (
                      <label key={k}>
                        {
                          [
                            "Centro horizontal",
                            "Centro vertical",
                            "Diâmetro do conjunto",
                          ][i]
                        }{" "}
                        <b>{Math.round(wheels[selected][k] * 100)}%</b>
                        <input
                          type="range"
                          min={k === "diameter" ? 3 : 0}
                          max={k === "diameter" ? 65 : 100}
                          step=".1"
                          value={wheels[selected][k] * 100}
                          onChange={(e) =>
                            updateWheel({ [k]: Number(e.target.value) / 100 })
                          }
                        />
                      </label>
                    ))}
                  </section>
                )}
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
              </section>
              <aside className="config">
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
                            .filter((id) => enabled.includes(id)),
                        ).size
                      }{" "}
                      COM FOTO / {enabled.length} MODELOS
                    </span>
                  </div>
                  <div className="model-current">
                    <div className="wheel-preview">
                      <Wheel
                        {...{ model, finish, caliper, angle, size }}
                        photo={activePhoto}
                      />
                    </div>
                    <div>
                      <h4>{models[model].name}</h4>
                      <p>{models[model].subtitle}</p>
                      <span className="outline-tag">
                        {activePhoto ? "FOTOGRAFIA REAL" : "FOTO PENDENTE"}
                      </span>
                    </div>
                  </div>
                  {activePhoto ? (
                    <p className="photo-source">
                      Foto:{" "}
                      <a
                        href={activePhoto.source}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {activePhoto.credit}
                      </a>{" "}
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
                  <div className="model-grid">
                    {models
                      .filter(
                        (m) =>
                          enabled.includes(m.id) &&
                          (m.name + " " + m.subtitle)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
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
                      <b>03</b> Tamanho do aro
                    </h3>
                    <strong>{size}”</strong>
                  </div>
                  <input
                    aria-label="Tamanho do aro"
                    type="range"
                    min="14"
                    max="22"
                    value={size}
                    disabled={
                      !photos.some(
                        (p) => p.model === model && p.finish === finish,
                      )
                    }
                    onChange={(e) => {
                      const p = findPhoto(
                        photos,
                        model,
                        finish,
                        Number(e.target.value),
                      );
                      if (activePhoto?.kind === "rim") {
                        setSize(Number(e.target.value));
                      } else if (p) {
                        setSavedPhoto(undefined);
                        setSize(p.size);
                      } else
                        notify(
                          "Cadastre uma fotografia real deste aro para manter o pneu e a roda autênticos.",
                        );
                    }}
                  />
                  <div className="range-labels">
                    <span>14”</span>
                    <span>Somente aros com foto cadastrada · 22”</span>
                  </div>
                </section>
                <section>
                  <div className="label-heading">
                    <h3>
                      <b>04</b> Freios da fotografia
                    </h3>
                    <span>ORIGINAIS</span>
                  </div>
                  <p className="photographic-brakes">
                    Os freios são os visíveis na fotografia do conjunto. As
                    cores e os detalhes permanecem originais.
                  </p>
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
                        <div
                          className="project-thumb"
                          onClick={() => openProject(p)}
                        >
                          <img src={p.payload.image} alt={p.name} />
                          {p.payload.wheels.map((w: Placement, i: number) => (
                            <div
                              key={i}
                              style={{
                                left: `${w.x * 100}%`,
                                top: `${w.y * 100}%`,
                                width: `${w.diameter * 100}%`,
                              }}
                            >
                              <Wheel {...p.payload} mounted />
                            </div>
                          ))}
                        </div>
                        <h3>{p.name}</h3>
                        <p>
                          {models[p.payload.model].name} · {p.payload.size}”
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
                  onSave={async (p) => {
                    const result = await api("admin/photos", p);
                    setPhotos((v) => [
                      ...v.filter(
                        (x) =>
                          !(
                            x.model === p.model &&
                            x.finish === p.finish &&
                            x.size === p.size
                          ),
                      ),
                      result,
                    ]);
                  }}
                />
                <h2 className="catalog-title">Catálogo público</h2>
                <p>Ative ou oculte modelos disponíveis no estúdio.</p>
                {models.map((m) => (
                  <label className="catalog-admin" key={m.id}>
                    <input
                      type="checkbox"
                      checked={enabled.includes(m.id)}
                      onChange={async (e) => {
                        const checked = e.target.checked;
                        try {
                          await api("admin/catalog", {
                            id: m.id,
                            enabled: checked,
                          });
                          setEnabled((v) =>
                            checked
                              ? [...v, m.id]
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
                    minLength={8}
                    maxLength={128}
                    required
                  />
                  <small>Mínimo de 8 caracteres.</small>
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
