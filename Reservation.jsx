import React, { useEffect, useMemo, useState } from "react";

const DEMO_DP = 150000;
const escDate = (value) => value || "-";
const rupiah = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

function wibDate(add = 0) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  now.setDate(now.getDate() + add);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function chairs(table) {
  const out = [];
  if (table.shape === "round") {
    const cx = table.x + table.w / 2;
    const cy = table.y + table.h / 2;
    const radius = table.w / 2 + 11;
    for (let i = 0; i < table.cap; i += 1) {
      const angle = (i / table.cap) * Math.PI * 2 - Math.PI / 2;
      out.push(<circle key={`c-${i}`} className="ch" cx={cx + Math.cos(angle) * radius} cy={cy + Math.sin(angle) * radius} r="7" />);
    }
  } else {
    const per = Math.ceil(table.cap / 2);
    for (let i = 0; i < per; i += 1) {
      const x = table.x + ((i + 0.5) * table.w) / per;
      out.push(<rect key={`top-${i}`} className="ch" x={x - 9} y={table.y - 15} width="18" height="9" rx="4.5" />);
      if (i < table.cap - per) out.push(<rect key={`bottom-${i}`} className="ch" x={x - 9} y={table.y + table.h + 6} width="18" height="9" rx="4.5" />);
    }
  }
  return out;
}

function FloorSVG({ floor, pax, selected, time, busy, onSelect, toast }) {
  if (!floor) return <div className="hint">Denah meja belum tersedia.</div>;
  return (
    <svg className="floor" viewBox={`0 0 ${floor.width} ${floor.height}`} role="img" aria-label="Denah meja reservasi">
      {(floor.zones || []).map((zone) => (
        <g className="zone" key={zone.id}>
          <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx="16" fill={zone.color} />
          <text x={zone.x + 14} y={zone.y + 22}>{String(zone.label || "").toUpperCase()}</text>
        </g>
      ))}
      {(floor.tables || []).map((table) => {
        const isBusy = busy.includes(table.id);
        const isSmall = table.cap < pax;
        const state = isBusy ? "busy" : isSmall ? "small" : selected === table.id ? "sel" : "";
        return (
          <g
            className={`tbl ${state}`}
            data-id={table.id}
            key={table.id}
            role="button"
            tabIndex={isBusy || isSmall ? -1 : 0}
            aria-label={`Meja ${table.id}, ${table.cap} kursi${isBusy ? ", sudah dibooking" : isSmall ? ", kapasitas kurang" : ""}`}
            onClick={() => {
              if (!time) return toast("Pilih jam datang dulu ya");
              if (isBusy) return toast("Meja ini sudah dibooking");
              if (isSmall) return toast(`Kursinya kurang untuk ${pax} orang`);
              onSelect(table.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!isBusy && !isSmall && time) onSelect(table.id);
              }
            }}
          >
            {chairs(table)}
            {table.shape === "round" ? <circle className="t" cx={table.x + table.w / 2} cy={table.y + table.h / 2} r={table.w / 2} /> : <rect className="t" x={table.x} y={table.y} width={table.w} height={table.h} rx="12" />}
            <text x={table.x + table.w / 2} y={table.y + table.h / 2 + 1} textAnchor="middle">{table.id}</text>
            <text className="cap" x={table.x + table.w / 2} y={table.y + table.h / 2 + 16} textAnchor="middle">{table.cap} kursi</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Reservation({ data, onToast }) {
  const branches = data?.branches || [];
  const reservation = data?.reservation || {};
  const floor = data?.floor || { width: 800, height: 480, zones: [], tables: [] };
  const minPax = Number(reservation.minPax || 4);
  const duration = Number(reservation.durationHrs || 2);
  const maxDays = Number(reservation.maxDays || 14);
  const [form, setForm] = useState({
    branch: branches[0]?.id || "",
    date: wibDate(),
    time: "",
    pax: minPax,
    table: "",
    name: "",
    phone: "",
    note: "",
  });
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!modal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event) => { if (event.key === "Escape") setModal(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [modal]);

  const branch = branches.find((item) => item.id === form.branch);
  const slots = useMemo(() => {
    const open = Number.parseInt((branch?.open || "08:00").split(":")[0], 10);
    const closeRaw = Number.parseInt((branch?.close || "23:00").split(":")[0], 10);
    const close = closeRaw <= open ? closeRaw + 24 : closeRaw;
    const start = Math.max(Number(reservation.slotStart ?? 8), open);
    const end = Math.min(Number(reservation.slotEnd ?? 21), close - duration);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => `${String(start + index).padStart(2, "0")}:00`);
  }, [branch, duration, reservation.slotEnd, reservation.slotStart]);

  const busy = useMemo(() => {
    const blocks = reservation.blocks || data?.busy || [];
    if (!form.time) return [];
    const hour = Number.parseInt(form.time, 10);
    return blocks.filter((item) => (!item.branch || item.branch === form.branch) && (!item.date || item.date === form.date) && Math.abs(Number.parseInt(item.time, 10) - hour) < duration).map((item) => item.table);
  }, [data?.busy, duration, form.date, form.branch, form.time, reservation.blocks]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const notify = (message) => onToast?.(message);
  const dateLabel = form.date ? new Date(`${form.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "-";
  const fail = (message) => { setError(message); notify(message); };

  const chooseBranch = (value) => setForm((current) => ({ ...current, branch: value, time: "", table: "" }));
  const chooseDate = (value) => setForm((current) => ({ ...current, date: value, time: "", table: "" }));
  const chooseTime = (value) => setForm((current) => ({ ...current, time: value, table: "" }));
  const slotOff = (slot) => {
    if (form.date !== wibDate()) return false;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    return Number.parseInt(slot, 10) < now.getHours() + now.getMinutes() / 60 + Number(reservation.leadHours || 0);
  };
  const submit = () => {
    if (!form.date) return fail("Pilih tanggal reservasi dulu.");
    if (form.date < wibDate() || form.date > wibDate(maxDays)) return fail("Pilih tanggal dalam rentang reservasi yang tersedia.");
    if (!form.time) return fail("Pilih jam datang dulu.");
    if (slotOff(form.time)) return fail("Jam ini sudah lewat. Pilih jam atau tanggal lain.");
    if (form.pax < minPax) return fail(`Reservasi minimal ${minPax} orang.`);
    if (!form.table) return fail("Pilih meja di denah.");
    if (((floor.tables || []).find((item) => item.id === form.table)?.cap || 0) < form.pax) return fail("Kapasitas meja kurang. Pilih meja lain.");
    if (busy.includes(form.table)) return fail("Meja ini sudah dibooking. Pilih meja lain ya.");
    if (!form.name.trim()) return fail("Isi nama kamu.");
    if (!/^(\+?62|0)8\d{7,12}$/.test(form.phone.replace(/[\s-]/g, ""))) return fail("Nomor WhatsApp belum benar. Contoh: 081234567890");
    setError("");
    setModal(true);
  };

  return (
    <div className="resv-grid">
      <div className="panel rv in">
        <div className="field"><label htmlFor="r-branch"><i>1</i>Pilih cabang</label><select id="r-branch" className="inp" aria-label="Pilih cabang" value={form.branch} onChange={(event) => chooseBranch(event.target.value)}>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label htmlFor="r-date"><i>2</i>Tanggal</label><input id="r-date" type="date" className="inp" aria-label="Tanggal reservasi" min={wibDate()} max={wibDate(maxDays)} value={form.date} onChange={(event) => chooseDate(event.target.value)} /></div>
        <div className="field"><label><i>3</i>Jam datang <span style={{ fontWeight: 500, color: "var(--muted)" }}>· {duration} jam</span></label><div className="slots">{slots.length ? slots.map((slot) => <button type="button" disabled={slotOff(slot)} className={`slot ${form.time === slot ? "on" : ""}`} aria-label={`Pilih jam ${slot}`} key={slot} onClick={() => chooseTime(slot)}>{slot}</button>) : <span className="hint">Tidak ada slot.</span>}</div></div>
        <div className="field"><label><i>4</i>Jumlah orang</label><div className="stepper"><button type="button" aria-label="Kurangi jumlah orang" onClick={() => update("pax", Math.max(1, form.pax - 1))}>−</button><span>{form.pax}</span><button type="button" aria-label="Tambah jumlah orang" onClick={() => { const pax = Math.min(40, form.pax + 1); update("pax", pax); if (form.table && ((floor.tables || []).find((item) => item.id === form.table)?.cap || 0) < pax) update("table", ""); }}>+</button></div><div className={`hint ${form.pax < minPax ? "err" : ""}`}>{form.pax < minPax ? `Reservasi minimal ${minPax} orang ya.` : `Minimal ${minPax} orang ✓`}</div></div>
        <div className="field" style={{ marginBottom: 0 }}><label><i>6</i>Data kamu</label><input className="inp" aria-label="Nama lengkap" placeholder="Nama lengkap" value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" style={{ marginBottom: 8 }} /><input className="inp" aria-label="Nomor WhatsApp" type="tel" inputMode="tel" placeholder="Nomor WhatsApp (08…)" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" style={{ marginBottom: 8 }} /><textarea className="inp" aria-label="Catatan reservasi" rows="2" placeholder="Catatan (opsional): ultah, butuh colokan, dll" value={form.note} onChange={(event) => update("note", event.target.value)} /></div>
      </div>
      <div className="panel white rv in">
        <div className="field" style={{ marginBottom: 10 }}><label><i>5</i>Pilih meja</label><div className="hint" style={{ marginTop: 0 }}>Pilih jam dulu, lalu tap meja yang putih. Geser denah ke samping kalau di HP.</div></div>
        <div className="floor-wrap"><FloorSVG floor={floor} pax={form.pax} selected={form.table} time={form.time} busy={busy} onSelect={(table) => update("table", table)} toast={notify} /></div>
        <div className="legend"><span><i style={{ background: "#fff" }} />Kosong</span><span><i style={{ background: "#EDEAE6", borderColor: "#CFC9C2" }} />Udah dibooking</span><span><i style={{ background: "var(--accent)" }} />Pilihanmu</span></div>
        <div className="summary"><div><small>Cabang</small><b>{branch?.name?.split("–").pop()?.trim() || "-"}</b></div><div><small>Tanggal</small><b>{dateLabel}</b></div><div><small>Jam · Orang</small><b>{form.time || "--:--"} · {form.pax}</b></div><div><small>Meja</small><b>{form.table || "Belum dipilih"}</b></div></div>
        <div className="paybox"><div style={{ flex: 1, minWidth: 220 }}><div className="lbl">7 · Minimum payment (DP) — contoh demo</div><div className="amt">{rupiah(DEMO_DP)}</div><div style={{ fontSize: 13.5, margin: "6px 0 14px", opacity: 0.85 }}>Mode demo — jangan transfer uang<br /><span style={{ opacity: 0.6 }}>Nominal ini hanya contoh dan tidak diproses.</span></div><div className="field" style={{ marginBottom: 0 }}><label htmlFor="r-dp">Nominal contoh</label><input id="r-dp" type="number" className="inp" aria-label="Nominal pembayaran contoh" value={DEMO_DP} readOnly disabled /></div></div></div>
        <div className="hint err" role="alert" style={{ marginTop: 12 }}>{error}</div>
        <button type="button" className="btn btn-accent" aria-label="Buat simulasi reservasi" style={{ width: "100%", marginTop: 8 }} onClick={submit}>Buat simulasi reservasi <span className="arr">→</span></button>
      </div>
      {modal && <div className="modal on" role="dialog" aria-modal="true" aria-labelledby="simulation-title" onClick={(event) => { if (event.target === event.currentTarget) setModal(false); }}><div className="mbox"><button type="button" className="xbtn" aria-label="Tutup simulasi reservasi" onClick={() => setModal(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button><div className="ticket"><div className="ok">✓</div><h3 id="simulation-title">Simulasi reservasi</h3><p style={{ color: "var(--muted)", margin: "10px 0 16px" }}>Belum dikirim ke kafe. Tidak ada meja atau pembayaran yang dikonfirmasi.</p><table><tbody><tr><td>Cabang</td><td>{branch?.name || "-"}</td></tr><tr><td>Tanggal</td><td>{escDate(dateLabel)}</td></tr><tr><td>Jam</td><td>{form.time || "-"} ({duration} jam)</td></tr><tr><td>Jumlah orang</td><td>{form.pax}</td></tr><tr><td>Meja</td><td>{form.table || "-"}</td></tr><tr><td>Nama</td><td>{form.name}</td></tr><tr><td>WhatsApp</td><td>{form.phone}</td></tr>{form.note && <tr><td>Catatan</td><td>{form.note}</td></tr>}</tbody></table><button type="button" className="btn btn-dark" aria-label="Tutup hasil simulasi" onClick={() => setModal(false)}>Tutup</button></div></div></div>}
    </div>
  );
}
