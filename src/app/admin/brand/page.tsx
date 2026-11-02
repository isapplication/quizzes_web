"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerShape } from "@/components/AnswerShape";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { applyIcon, isSchoolAdmin, SchoolBrand, useMe } from "@/lib/me";
import { LoadingState, PageHeader } from "@/components/ui/States";

type Kind = "logo" | "icon" | "terms";

const FILES: { kind: Kind; title: string; hint: string; accept: string }[] = [
  { kind: "logo", title: "Logo", hint: "PNG, JPG or WebP, up to 1 MB. A wide logo on a clear background looks best.", accept: "image/png,image/jpeg,image/webp" },
  { kind: "icon", title: "Browser icon", hint: "PNG or ICO, up to 256 KB. Square, at least 64 × 64 pixels.", accept: "image/png,image/x-icon,.ico" },
  { kind: "terms", title: "Terms and conditions", hint: "PDF, up to 5 MB. Linked at the bottom of every page.", accept: "application/pdf" },
];

/** Defaults shown until the school picks its own: Quizplayo's blue, navy and amber. */
const DEFAULTS = { primary: "#007fff", secondary: "#001b47", accent: "#f28c28" };

/** Brand settings: the school admin's own logo, browser icon, colours and terms. */
export default function BrandPage() {
  return (
    <AppFrame>
      <Brand />
    </AppFrame>
  );
}

function Brand() {
  const me = useMe();
  const [brand, setBrand] = useState<SchoolBrand | null>(null);
  const [colors, setColors] = useState(DEFAULTS);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    api<SchoolBrand>("/api/v1/admin/brand")
      .then((b) => {
        setBrand(b);
        setColors({ ...DEFAULTS, ...b.colors });
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your brand settings."));
  }, []);

  if (!isSchoolAdmin(me)) {
    return <div className="alert alert-danger">Brand settings are for your school&apos;s Quizplayo admins.</div>;
  }

  async function run(label: string, work: () => Promise<SchoolBrand>, done: string) {
    setBusy(label);
    setError(null);
    setSaved(null);
    try {
      const b = await work();
      setBrand(b);
      applyIcon(b.iconUrl);
      setSaved(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not save that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function upload(kind: Kind, file: File) {
    const body = new FormData();
    body.append("file", file);
    void run(kind, () => api<SchoolBrand>("/api/v1/admin/brand/" + kind, { method: "POST", body }),
      FILES.find((f) => f.kind === kind)!.title + " saved. Everyone sees it on their next page.");
  }

  function remove(kind: Kind) {
    void run(kind, () => api<SchoolBrand>("/api/v1/admin/brand/" + kind, { method: "DELETE" }),
      FILES.find((f) => f.kind === kind)!.title + " removed.");
  }

  function saveColors() {
    void run("colors", () => api<SchoolBrand>("/api/v1/admin/brand/colors", { method: "PUT", body: colors }),
      "Colours saved. Reload the page to see them everywhere.");
  }

  const url = (kind: Kind) => (brand ? { logo: brand.logoUrl, icon: brand.iconUrl, terms: brand.termsUrl }[kind] : null);

  return (
    <div className="stack">
      <PageHeader title="Brand settings"
                  description={<>Make Quizplayo look like {me.school.name}: your logo, browser icon, colours and terms. Teachers and
                    students see them on every page and on your school&apos;s sign-in page.</>} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {saved && <div className="alert alert-success" role="status">{saved}</div>}
      {!brand && !error && <LoadingState rows={5} label="Loading brand settings" />}

      {brand && (
        <div className="brand-grid">
          <div className="stack">
            {FILES.map((f) => (
              <FileCard key={f.kind} title={f.title} hint={f.hint} accept={f.accept} url={url(f.kind)}
                        kind={f.kind} termsName={brand.termsName} busy={busy === f.kind}
                        onPick={(file) => upload(f.kind, file)} onRemove={() => remove(f.kind)} />
            ))}

            <section className="card stack" aria-labelledby="colours-title">
              <h2 id="colours-title" className="brand-h2">Colours</h2>
              <div className="colour-row">
                <Colour label="Main colour" hint="Buttons and links" value={colors.primary}
                        onChange={(v) => setColors({ ...colors, primary: v })} />
                <Colour label="Top bar colour" hint="Top bar and headings" value={colors.secondary}
                        onChange={(v) => setColors({ ...colors, secondary: v })} />
                <Colour label="Highlight colour" hint="Badges and highlights" value={colors.accent}
                        onChange={(v) => setColors({ ...colors, accent: v })} />
              </div>
              <div className="row">
                <button className="btn btn-primary" type="button" onClick={saveColors} disabled={busy !== null}>
                  {busy === "colors" ? "Saving…" : "Save colours"}
                </button>
                <button className="btn btn-light" type="button" onClick={() => setColors(DEFAULTS)} disabled={busy !== null}>
                  Back to Quizplayo colours
                </button>
              </div>
            </section>
          </div>

          <Preview name={me.school.name} logoUrl={brand.logoUrl} colors={colors} />
        </div>
      )}
    </div>
  );
}

function FileCard(props: {
  title: string; hint: string; accept: string; url: string | null | undefined; kind: Kind; termsName: string | null;
  busy: boolean; onPick: (f: File) => void; onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="card brand-file">
      <div className="brand-thumb" aria-hidden="true">
        {props.url && props.kind !== "terms" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.url} alt="" />
        ) : (
          <span>{props.kind === "terms" ? "PDF" : "—"}</span>
        )}
      </div>
      <div className="brand-file-text">
        <h2 className="brand-h2">{props.title}</h2>
        <p className="hint">{props.hint}</p>
        {props.kind === "terms" && props.url && (
          <p><a href={props.url} target="_blank" rel="noopener">{props.termsName ?? "Terms.pdf"}</a></p>
        )}
      </div>
      <div className="brand-file-actions">
        <input ref={input} type="file" accept={props.accept} hidden
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 e.target.value = "";
                 if (file) props.onPick(file);
               }} />
        <button className="btn btn-primary" type="button" disabled={props.busy} onClick={() => input.current?.click()}>
          {props.busy ? "Uploading…" : props.url ? "Replace" : "Upload"}
        </button>
        {props.url && (
          <button className="btn btn-light" type="button" disabled={props.busy} onClick={props.onRemove}>
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

function Colour({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const id = "colour-" + label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="colour">
      <label htmlFor={id}>{label}</label>
      <div className="colour-input">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="text" aria-label={label + " (hex)"} value={value} maxLength={7}
               onChange={(e) => onChange(e.target.value)} />
      </div>
      <p className="hint">{hint}</p>
    </div>
  );
}

/** How the school's pages will look with these colours and this logo. */
function Preview({ name, logoUrl, colors }: { name: string; logoUrl: string | null; colors: typeof DEFAULTS }) {
  return (
    <aside className="brand-preview" aria-label="Preview">
      <p className="muted">Preview</p>
      <div className="preview-frame">
        <div className="preview-bar" style={{ background: colors.secondary }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          )}
          <strong>{name}</strong>
        </div>
        <div className="preview-body">
          <h3 style={{ color: colors.secondary }}>Grade 8 · Earth in Space</h3>
          <span className="preview-chip" style={{ background: colors.accent }}>Live now</span>
          <div className="preview-answers">
            {["Mercury", "Venus", "Earth", "Mars"].map((a, i) => (
              <div key={a} className={"demo-answer demo-a" + (i + 1)}>
                <AnswerShape index={i} size={18} color="currentColor" />
                <span>{a}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn" style={{ background: colors.primary, color: "#fff" }}>
            Host live game
          </button>
          <p><a href="#" style={{ color: colors.primary }} onClick={(e) => e.preventDefault()}>A link in your colour</a></p>
        </div>
      </div>
    </aside>
  );
}
