// public/app.js
// SPA vanilla JS sederhana untuk uji fungsional backend mutarlihjatim.
// Tidak pakai framework/build step -- fetch() langsung ke /api/*, render via template string.

const state = { user: null, currentSection: null };

// ---------- Helpers ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || `Request gagal (${res.status})`);
  return data;
}

function toast(message, isError = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// ---------- Auth ----------
async function tryRestoreSession() {
  try {
    const me = await api("/api/me");
    state.user = me;
    showApp();
  } catch {
    showLogin();
  }
}

function showLogin() {
  qs("#login-screen").classList.remove("hidden");
  qs("#app-screen").classList.add("hidden");
}

function showApp() {
  qs("#login-screen").classList.add("hidden");
  qs("#app-screen").classList.remove("hidden");
  qs("#user-info").textContent = `${state.user.username} (${state.user.role === "admin_provinsi" ? "Provinsi" : state.user.kabkota})`;
  renderSidebar();
  const firstModule = MODULES[state.user.role][0].key;
  goToModule(firstModule);
}

qs("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = qs("#login-username").value.trim();
  const password = qs("#login-password").value;
  const errEl = qs("#login-error");
  errEl.textContent = "";
  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    state.user = data;
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

qs("#logout-btn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  state.user = null;
  location.reload();
});

// ---------- Navigasi 2 level: sidebar kiri (modul) + menu atas (tab dalam modul) ----------
const MODULES = {
  admin_kabkota: [
    {
      key: "pemilih",
      label: "Pemutakhiran Data Pemilih",
      tabs: [
        { key: "pemilih-cari", label: "Data Pemilih" },
        { key: "pemilih-input", label: "Input Pemilih Baru" },
        { key: "pemilih-statistik", label: "Statistik" },
        { key: "pemilih-tms", label: "Data TMS" },
      ],
    },
    {
      key: "uji-petik",
      label: "Uji Petik PDPB",
      tabs: [
        { key: "up-checklist", label: "Checklist A-DPB1" },
        { key: "up-rekap", label: "Rekap Triwulan A-DPB2" },
        { key: "up-sampel-tms", label: "Sampel TMS" },
        { key: "up-sampel-ms", label: "Sampel Pemilih Baru" },
        { key: "up-sampel-dpb", label: "Sampel DPB" },
        { key: "up-infografis", label: "Infografis" },
      ],
    },
  ],
  admin_provinsi: [
    {
      key: "provinsi",
      label: "Rekap Provinsi",
      tabs: [{ key: "provinsi-rekap", label: "Rekap Provinsi" }],
    },
  ],
};

function renderSidebar() {
  const modules = MODULES[state.user.role] || [];
  qs("#sidebar").innerHTML = modules
    .map((m) => `<button data-module="${m.key}">${esc(m.label)}</button>`)
    .join("");
  qsa("#sidebar button").forEach((btn) => {
    btn.addEventListener("click", () => goToModule(btn.dataset.module));
  });
}

function goToModule(moduleKey) {
  state.currentModule = moduleKey;
  qsa("#sidebar button").forEach((b) => b.classList.toggle("active", b.dataset.module === moduleKey));

  const module = (MODULES[state.user.role] || []).find((m) => m.key === moduleKey);
  const navEl = qs("#main-nav");

  if (!module || module.tabs.length <= 1) {
    // Modul dengan 1 tab saja (mis. Rekap Provinsi) -- tidak perlu baris menu atas terpisah.
    navEl.innerHTML = "";
    navEl.classList.add("hidden");
    if (module) goToSection(module.tabs[0].key);
    return;
  }

  navEl.classList.remove("hidden");
  navEl.innerHTML = module.tabs.map((t) => `<button data-section="${t.key}">${esc(t.label)}</button>`).join("");
  qsa("#main-nav button").forEach((btn) => {
    btn.addEventListener("click", () => goToSection(btn.dataset.section));
  });
  goToSection(module.tabs[0].key);
}

function goToSection(key) {
  state.currentSection = key;
  qsa("#main-nav button").forEach((b) => b.classList.toggle("active", b.dataset.section === key));
  const renderer = SECTION_RENDERERS[key];
  const content = qs("#main-content");
  content.innerHTML = `<div class="empty-state">Memuat...</div>`;
  if (renderer) renderer(content).catch((err) => {
    content.innerHTML = `<div class="card"><p style="color:#c0392b">${esc(err.message)}</p></div>`;
  });
}

// ================= MODUL PEMILIH =================

async function renderPemilihCari(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Cari / Daftar Pemilih</h2>
      <p class="card-desc">Isi kecamatan untuk lihat daftar, atau isi NIK untuk mencari (boleh tempel banyak NIK sekaligus dipisah baris baru/koma).</p>
      <div class="field-row">
        <div class="field"><label>Kecamatan</label><input id="f-kecamatan" placeholder="mis. Kepanjen" /></div>
        <div class="field"><label>Kelurahan (opsional)</label><input id="f-kelurahan" /></div>
        <div class="field"><label>TPS (opsional)</label><input id="f-tps" /></div>
      </div>
      <div class="field-row">
        <div class="field" style="flex:2"><label>Cari NIK (opsional, boleh banyak)</label><textarea id="f-search" rows="2"></textarea></div>
      </div>
      <button class="btn btn-orange" id="btn-cari">Cari</button>
    </div>
    <div id="hasil-cari"></div>
  `;
  qs("#btn-cari", root).addEventListener("click", async () => {
    const params = new URLSearchParams();
    const kec = qs("#f-kecamatan", root).value.trim();
    const kel = qs("#f-kelurahan", root).value.trim();
    const tps = qs("#f-tps", root).value.trim();
    const search = qs("#f-search", root).value.trim();
    if (kec) params.set("kecamatan", kec);
    if (kel) params.set("kelurahan", kel);
    if (tps) params.set("tps", tps);
    if (search) params.set("search", search);
    const hasilEl = qs("#hasil-cari", root);
    hasilEl.innerHTML = `<div class="empty-state">Mencari...</div>`;
    try {
      const data = await api(`/api/pemilih/data?${params.toString()}`);
      if (data.data.length === 0) {
        hasilEl.innerHTML = `<div class="card"><div class="empty-state">Tidak ada data ditemukan.</div></div>`;
        return;
      }
      hasilEl.innerHTML = `
        <div class="card">
          <h2>Hasil (${data.total} total${data.bulk ? ", mode bulk" : `, halaman ${data.page}`})</h2>
          ${data.notFound && data.notFound.length ? `<p style="color:#c0392b;font-size:12.5px">NIK tidak ditemukan: ${esc(data.notFound.join(", "))}</p>` : ""}
          <div class="table-scroll"><table>
            <thead><tr><th>Nama</th><th>NIK</th><th>Kec.</th><th>Kel.</th><th>TPS</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              ${data.data.map((r) => `
                <tr>
                  <td>${esc(r.nama)}</td><td>${esc(r.nik)}</td><td>${esc(r.kecamatan)}</td>
                  <td>${esc(r.kelurahan)}</td><td>${esc(r.tps)}</td>
                  <td>${r.kode_tms ? `<span class="badge badge-tms">TMS ${esc(r.kode_tms)}</span>` : `<span class="badge badge-ms">MS</span>`}</td>
                  <td>
                    <select data-id="${r.id}" class="tms-select">
                      <option value="">MS (tidak TMS)</option>
                      <option value="1" ${r.kode_tms === "1" ? "selected" : ""}>1 - Meninggal</option>
                      <option value="2" ${r.kode_tms === "2" ? "selected" : ""}>2 - Pindah</option>
                      <option value="3" ${r.kode_tms === "3" ? "selected" : ""}>3 - TNI/Polri</option>
                      <option value="4" ${r.kode_tms === "4" ? "selected" : ""}>4 - Belum 17th</option>
                      <option value="5" ${r.kode_tms === "5" ? "selected" : ""}>5 - Data Ganda</option>
                      <option value="6" ${r.kode_tms === "6" ? "selected" : ""}>6 - Dicabut</option>
                      <option value="7" ${r.kode_tms === "7" ? "selected" : ""}>7 - Bukan WNI</option>
                    </select>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table></div>
        </div>
      `;
      qsa(".tms-select", hasilEl).forEach((sel) => {
        sel.addEventListener("change", async () => {
          try {
            await api("/api/pemilih/data", { method: "POST", body: JSON.stringify({ id: sel.dataset.id, kode_tms: sel.value || null }) });
            toast("Status TMS diperbarui");
          } catch (err) { toast(err.message, true); }
        });
      });
    } catch (err) {
      hasilEl.innerHTML = `<div class="card"><p style="color:#c0392b">${esc(err.message)}</p></div>`;
    }
  });
}

async function renderPemilihInput(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Input Pemilih Baru</h2>
      <p class="card-desc">Tambah 1 baris data pemilih baru langsung ke database.</p>
      <div class="field-row">
        <div class="field"><label>Kecamatan *</label><input id="i-kecamatan" required /></div>
        <div class="field"><label>Kelurahan</label><input id="i-kelurahan" /></div>
        <div class="field"><label>NIK</label><input id="i-nik" /></div>
        <div class="field"><label>Nama *</label><input id="i-nama" required /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Tempat Lahir</label><input id="i-tempat" /></div>
        <div class="field"><label>Tanggal Lahir (dd/mm/yyyy)</label><input id="i-tgl" placeholder="dd/mm/yyyy" /></div>
        <div class="field"><label>Kelamin</label><select id="i-kelamin"><option value="L">L</option><option value="P">P</option></select></div>
        <div class="field"><label>TPS</label><input id="i-tps" /></div>
      </div>
      <div class="field-row">
        <div class="field" style="flex:2"><label>Alamat</label><input id="i-alamat" /></div>
        <div class="field"><label>RT</label><input id="i-rt" /></div>
        <div class="field"><label>RW</label><input id="i-rw" /></div>
      </div>
      <button class="btn btn-orange" id="btn-simpan-baru">Simpan</button>
    </div>
  `;
  qs("#btn-simpan-baru", root).addEventListener("click", async () => {
    const kecamatan = qs("#i-kecamatan", root).value.trim();
    const nama = qs("#i-nama", root).value.trim();
    if (!kecamatan || !nama) return toast("Kecamatan dan Nama wajib diisi", true);
    // Urutan kolom harus sama persis dengan INPUT_COLS di backend:
    // kelurahan, nkk, nik, nama, tempat_lahir, tanggal_lahir, sts_kawin, kelamin, alamat, rt, rw, disabilitas, ektp, keterangan, sumber, tps
    const row = [
      qs("#i-kelurahan", root).value.trim(), "", qs("#i-nik", root).value.trim(), nama,
      qs("#i-tempat", root).value.trim(), qs("#i-tgl", root).value.trim(), "", qs("#i-kelamin", root).value,
      qs("#i-alamat", root).value.trim(), qs("#i-rt", root).value.trim(), qs("#i-rw", root).value.trim(),
      "", "", "", "", qs("#i-tps", root).value.trim(),
    ];
    try {
      await api("/api/pemilih/pemilih-baru", { method: "POST", body: JSON.stringify({ kecamatan, rows: [row] }) });
      toast("Pemilih baru tersimpan");
      qsa("input", root).forEach((i) => (i.value = ""));
    } catch (err) { toast(err.message, true); }
  });
}

async function renderPemilihStatistik(root) {
  const data = await api("/api/pemilih/statistik/current");
  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${data.totalPemilihMS}</div><div class="label">Total Pemilih MS</div></div>
      <div class="stat-box"><div class="num">${data.totalLaki}</div><div class="label">Laki-laki</div></div>
      <div class="stat-box"><div class="num">${data.totalPerempuan}</div><div class="label">Perempuan</div></div>
      <div class="stat-box"><div class="num">${data.totalTms}</div><div class="label">Total TMS</div></div>
      <div class="stat-box"><div class="num">${data.totalDisabilitas}</div><div class="label">Disabilitas</div></div>
      <div class="stat-box"><div class="num">${data.totalUbahData}</div><div class="label">Ubah Data</div></div>
    </div>
    <div class="card">
      <h2>Per Kecamatan</h2>
      ${data.perKecamatan.length === 0 ? `<div class="empty-state">Belum ada data pemilih.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Kecamatan</th><th>Laki-laki</th><th>Perempuan</th><th>Jumlah</th></tr></thead>
        <tbody>${data.perKecamatan.map((r) => `<tr><td>${esc(r.kecamatan)}</td><td>${r.laki}</td><td>${r.perempuan}</td><td>${r.jumlah}</td></tr>`).join("")}</tbody>
      </table></div>`}
    </div>
    <div class="card">
      <button class="btn" id="btn-generate-snapshot">Generate Snapshot Bulan Ini</button>
    </div>
  `;
  qs("#btn-generate-snapshot", root).addEventListener("click", async () => {
    try { await api("/api/pemilih/statistik/generate", { method: "POST" }); toast("Snapshot dibuat"); }
    catch (err) { toast(err.message, true); }
  });
}

async function renderPemilihTms(root) {
  const data = await api("/api/pemilih/tms/rekap");
  root.innerHTML = `
    <div class="card">
      <h2>Rekap TMS per Kecamatan</h2>
      ${data.rekap.length === 0 ? `<div class="empty-state">Belum ada data TMS.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Kecamatan</th><th>Total TMS</th></tr></thead>
        <tbody>${data.rekap.map((r) => `<tr><td>${esc(r.kecamatan)}</td><td>${r.total}</td></tr>`).join("")}</tbody>
      </table></div>`}
    </div>
  `;
}

// ================= MODUL UJI PETIK =================

async function renderUpChecklist(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Checklist 40 Prosedur (A-DPB1)</h2>
      <div class="field-row">
        <div class="field"><label>Triwulan (format YYYY-Q1)</label><input id="up-tw" placeholder="2026-Q1" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-checklist">Muat</button></div>
      </div>
      <div id="checklist-body"></div>
    </div>
  `;
  qs("#btn-load-checklist", root).addEventListener("click", async () => {
    const tw = qs("#up-tw", root).value.trim();
    if (!tw) return toast("Isi triwulan dulu", true);
    const data = await api(`/api/uji-petik/checklist?triwulan=${encodeURIComponent(tw)}`);
    const body = qs("#checklist-body", root);
    const items = Array.from({ length: 10 }, (_, i) => i + 1); // contoh 10 dari 40 prosedur untuk uji fungsional
    body.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>No</th><th>Jawaban</th><th>Keterangan</th></tr></thead>
        <tbody>${items.map((n) => {
          const existing = data.jawaban[n] || {};
          return `<tr>
            <td>${n}</td>
            <td><select data-n="${n}" class="chk-jawaban"><option value="">-</option><option value="Ya" ${existing.jawaban === "Ya" ? "selected" : ""}>Ya</option><option value="Tidak" ${existing.jawaban === "Tidak" ? "selected" : ""}>Tidak</option></select></td>
            <td><input data-n="${n}" class="chk-ket" value="${esc(existing.keterangan || "")}" /></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
      <button class="btn btn-orange" id="btn-save-checklist" style="margin-top:12px">Simpan Semua</button>
    `;
    qs("#btn-save-checklist", body).addEventListener("click", async () => {
      const jawaban = items.map((n) => ({
        nomor_item: n,
        jawaban: qs(`.chk-jawaban[data-n="${n}"]`, body).value || null,
        keterangan: qs(`.chk-ket[data-n="${n}"]`, body).value || null,
      }));
      try { await api("/api/uji-petik/checklist", { method: "POST", body: JSON.stringify({ triwulan: tw, jawaban }) }); toast("Checklist tersimpan"); }
      catch (err) { toast(err.message, true); }
    });
  });
}

async function renderUpRekap(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Rekap Triwulan (A-DPB2)</h2>
      <div class="field-row">
        <div class="field"><label>Triwulan</label><input id="up-rk-tw" placeholder="2026-Q1" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-rekap">Muat</button></div>
      </div>
      <div id="rekap-body"></div>
    </div>
    <div class="card">
      <h2>Input / Update Rekap 1 Kecamatan</h2>
      <div class="field-row">
        <div class="field"><label>Triwulan</label><input id="in-tw" placeholder="2026-Q1" /></div>
        <div class="field"><label>Kecamatan</label><input id="in-kec" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>PDPB Awal Laki-laki</label><input id="in-awal-l" type="number" value="0" /></div>
        <div class="field"><label>PDPB Awal Perempuan</label><input id="in-awal-p" type="number" value="0" /></div>
      </div>
      <p class="card-desc">Untuk uji fungsional cepat, form ini cukup PDPB Awal saja (kategori TMS/Baru default 0, bisa dikembangkan di frontend selanjutnya).</p>
      <button class="btn btn-orange" id="btn-save-rekap">Simpan</button>
    </div>
  `;
  qs("#btn-load-rekap", root).addEventListener("click", async () => {
    const tw = qs("#up-rk-tw", root).value.trim();
    if (!tw) return toast("Isi triwulan dulu", true);
    const data = await api(`/api/uji-petik/rekap-triwulan?triwulan=${encodeURIComponent(tw)}`);
    const body = qs("#rekap-body", root);
    if (data.rows.length === 0) {
      body.innerHTML = `<div class="empty-state">Belum ada kecamatan yang diisi di triwulan ini.</div>`;
      return;
    }
    body.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>Kecamatan</th><th>Awal (L/P)</th><th>Total TMS</th><th>Total Baru</th><th>Hasil Akhir (L/P)</th><th>Carry-forward?</th></tr></thead>
        <tbody>${data.rows.map((r) => `
          <tr>
            <td>${esc(r.kecamatan)}</td>
            <td>${r.pdpb_awal_laki} / ${r.pdpb_awal_perempuan}</td>
            <td>${r.tms_total}</td>
            <td>${r.baru_total}</td>
            <td>${r.hasil_laki} / ${r.hasil_perempuan}</td>
            <td>${r.carried_forward ? "Ya" : "-"}</td>
          </tr>`).join("")}</tbody>
      </table></div>
      <p style="margin-top:10px;font-size:13px"><b>Grand total hasil akhir:</b> ${data.grand.hasil_laki} L / ${data.grand.hasil_perempuan} P</p>
    `;
  });
  qs("#btn-save-rekap", root).addEventListener("click", async () => {
    const triwulan = qs("#in-tw", root).value.trim();
    const kecamatan = qs("#in-kec", root).value.trim();
    if (!triwulan || !kecamatan) return toast("Triwulan dan kecamatan wajib diisi", true);
    try {
      await api("/api/uji-petik/rekap-triwulan", {
        method: "POST",
        body: JSON.stringify({
          triwulan, kecamatan,
          pdpb_awal_laki: Number(qs("#in-awal-l", root).value) || 0,
          pdpb_awal_perempuan: Number(qs("#in-awal-p", root).value) || 0,
        }),
      });
      toast("Rekap tersimpan");
    } catch (err) { toast(err.message, true); }
  });
}

function renderSampelSection(kind) {
  // kind: 'tms' | 'ms' -- struktur identik, beda endpoint & label kategori
  const prefix = kind === "tms" ? "sampel-tms" : "sampel-ms";
  const kategoriOptions = kind === "tms"
    ? ["meninggal", "ganda", "belum17", "pindah", "tni", "polri", "wna", "dicabut"]
    : ["genap17", "kawin", "tni_polri_sipil", "mantan_terpidana", "pindah_masuk"];

  return async function (root) {
    root.innerHTML = `
      <div class="card">
        <h2>Sampel ${kind === "tms" ? "TMS (A-DPB5)" : "Pemilih Baru (A-DPB7)"}</h2>
        <div class="field-row">
          <div class="field"><label>Periode (YYYY-MM)</label><input id="sp-periode" placeholder="2026-08" /></div>
          <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-sampel">Muat</button></div>
        </div>
        <div id="sampel-list"></div>
      </div>
      <div class="card">
        <h2>Tambah Sampel</h2>
        <div class="field-row">
          <div class="field"><label>Periode</label><input id="add-periode" placeholder="2026-08" /></div>
          <div class="field"><label>Nama</label><input id="add-nama" /></div>
          <div class="field"><label>NIK</label><input id="add-nik" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Kecamatan</label><input id="add-kec" /></div>
          <div class="field"><label>Kelurahan</label><input id="add-kel" /></div>
          <div class="field"><label>Kategori</label>
            <select id="add-kategori">${kategoriOptions.map((k) => `<option value="${k}">${k}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Status</label>
            <select id="add-status"><option>Sesuai</option><option>Tidak Sesuai</option></select>
          </div>
        </div>
        <button class="btn btn-orange" id="btn-add-sampel">Simpan</button>
      </div>
    `;
    async function loadList() {
      const periode = qs("#sp-periode", root).value.trim();
      if (!periode) return toast("Isi periode dulu", true);
      const data = await api(`/api/uji-petik/${prefix}?periode=${encodeURIComponent(periode)}`);
      const listEl = qs("#sampel-list", root);
      if (data.data.length === 0) { listEl.innerHTML = `<div class="empty-state">Belum ada sampel di periode ini.</div>`; return; }
      listEl.innerHTML = `
        <div class="table-scroll"><table>
          <thead><tr><th>Nama</th><th>NIK</th><th>Kecamatan</th><th>Kategori</th><th>Status</th></tr></thead>
          <tbody>${data.data.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.nik)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.kategori)}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody>
        </table></div>
      `;
    }
    qs("#btn-load-sampel", root).addEventListener("click", loadList);
    qs("#btn-add-sampel", root).addEventListener("click", async () => {
      const periode = qs("#add-periode", root).value.trim();
      const nama = qs("#add-nama", root).value.trim();
      const kecamatan = qs("#add-kec", root).value.trim();
      if (!periode || !nama || !kecamatan) return toast("Periode, nama, kecamatan wajib diisi", true);
      try {
        await api(`/api/uji-petik/${prefix}`, {
          method: "POST",
          body: JSON.stringify({
            periode, nama, kecamatan,
            nik: qs("#add-nik", root).value.trim(),
            kelurahan: qs("#add-kel", root).value.trim(),
            kategori: qs("#add-kategori", root).value,
            status: qs("#add-status", root).value,
          }),
        });
        toast("Sampel tersimpan");
        qs("#sp-periode", root).value = periode;
        loadList();
      } catch (err) { toast(err.message, true); }
    });
  };
}

async function renderUpSampelDpb(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Sampel DPB (A-DPB8)</h2>
      <div class="field-row">
        <div class="field"><label>Periode (YYYY-MM)</label><input id="dpb-periode" placeholder="2026-08" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-dpb">Muat</button></div>
      </div>
      <div id="dpb-list"></div>
    </div>
    <div class="card">
      <h2>Tambah Sampel DPB</h2>
      <div class="field-row">
        <div class="field"><label>Periode</label><input id="dpb-add-periode" placeholder="2026-08" /></div>
        <div class="field"><label>Nama</label><input id="dpb-add-nama" /></div>
        <div class="field"><label>Kecamatan</label><input id="dpb-add-kec" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Hasil</label><select id="dpb-add-hasil"><option>Sesuai</option><option>Tidak Sesuai</option></select></div>
        <div class="field"><label>Kategori (kalau Tidak Sesuai)</label>
          <select id="dpb-add-kategori">
            <option value="meninggal">meninggal</option><option value="ganda">ganda</option>
            <option value="belum17">belum17</option><option value="pindah">pindah</option>
            <option value="tni">tni</option><option value="polri">polri</option>
            <option value="wna">wna</option><option value="dicabut">dicabut</option>
          </select>
        </div>
      </div>
      <button class="btn btn-orange" id="btn-add-dpb">Simpan</button>
    </div>
  `;
  async function loadDpb() {
    const periode = qs("#dpb-periode", root).value.trim();
    if (!periode) return toast("Isi periode dulu", true);
    const data = await api(`/api/uji-petik/sampel-dpb/rekap?periode=${encodeURIComponent(periode)}`);
    qs("#dpb-list", root).innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${data.total}</div><div class="label">Total Sampel</div></div>
        <div class="stat-box"><div class="num">${data.sesuai}</div><div class="label">Sesuai</div></div>
        <div class="stat-box"><div class="num">${data.tidakSesuai}</div><div class="label">Tidak Sesuai</div></div>
      </div>
    `;
  }
  qs("#btn-load-dpb", root).addEventListener("click", loadDpb);
  qs("#btn-add-dpb", root).addEventListener("click", async () => {
    const periode = qs("#dpb-add-periode", root).value.trim();
    const nama = qs("#dpb-add-nama", root).value.trim();
    const kecamatan = qs("#dpb-add-kec", root).value.trim();
    if (!periode || !nama || !kecamatan) return toast("Periode, nama, kecamatan wajib diisi", true);
    const hasil = qs("#dpb-add-hasil", root).value;
    try {
      await api("/api/uji-petik/sampel-dpb", {
        method: "POST",
        body: JSON.stringify({ periode, nama, kecamatan, hasil, kategori_tidak_sesuai: hasil === "Tidak Sesuai" ? qs("#dpb-add-kategori", root).value : null }),
      });
      toast("Sampel DPB tersimpan");
      qs("#dpb-periode", root).value = periode;
      loadDpb();
    } catch (err) { toast(err.message, true); }
  });
}

async function renderUpInfografis(root) {
  const data = await api("/api/uji-petik/infografis/kabupaten");
  root.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${data.desaDiujiPetik}</div><div class="label">Desa Diuji Petik</div></div>
      <div class="stat-box"><div class="num">${data.totalMsDiujiPetik}</div><div class="label">Total Sampel MS</div></div>
      <div class="stat-box"><div class="num">${data.totalTmsDiujiPetik}</div><div class="label">Total Sampel TMS</div></div>
    </div>
    <div class="card">
      <h2>Hasil Akhir per Kecamatan (Triwulan Terakhir: ${esc(data.triwulan || "-")})</h2>
      ${data.perKecamatan.length === 0 ? `<div class="empty-state">Belum ada data rekap triwulan.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>Kecamatan</th><th>Laki-laki</th><th>Perempuan</th><th>Total</th></tr></thead>
        <tbody>${data.perKecamatan.map((r) => `<tr><td>${esc(r.kecamatan)}</td><td>${r.laki}</td><td>${r.perempuan}</td><td>${r.total}</td></tr>`).join("")}</tbody>
      </table></div>`}
    </div>
  `;
}

// ================= MODUL PROVINSI =================

async function renderProvinsiRekap(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Rekap Lintas Kab/Kota</h2>
      <p class="card-desc">Data di sini bersumber dari cron rekap harian (belum berjalan otomatis di versi ini -- lihat README bagian cron).</p>
      <div class="field-row">
        <div class="field"><label>Periode (YYYY-MM)</label><input id="prov-periode" value="${new Date().toISOString().slice(0,7)}" /></div>
        <div class="field"><label>Modul</label><select id="prov-modul"><option value="pemilih">pemilih</option><option value="uji_petik">uji_petik</option></select></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-prov">Muat</button></div>
      </div>
      <div id="prov-body"></div>
    </div>
  `;
  qs("#btn-load-prov", root).addEventListener("click", async () => {
    const periode = qs("#prov-periode", root).value.trim();
    const modul = qs("#prov-modul", root).value;
    const data = await api(`/api/provinsi/rekap?periode=${encodeURIComponent(periode)}&modul=${modul}`);
    const body = qs("#prov-body", root);
    if (data.length === 0) { body.innerHTML = `<div class="empty-state">Belum ada rekap untuk periode ini.</div>`; return; }
    body.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>Kab/Kota</th><th>Terakhir Update</th></tr></thead>
        <tbody>${data.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.updated_at)}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  });
}

// ---------- Routing table ----------
const SECTION_RENDERERS = {
  "pemilih-cari": renderPemilihCari,
  "pemilih-input": renderPemilihInput,
  "pemilih-statistik": renderPemilihStatistik,
  "pemilih-tms": renderPemilihTms,
  "up-checklist": renderUpChecklist,
  "up-rekap": renderUpRekap,
  "up-sampel-tms": renderSampelSection("tms"),
  "up-sampel-ms": renderSampelSection("ms"),
  "up-sampel-dpb": renderUpSampelDpb,
  "up-infografis": renderUpInfografis,
  "provinsi-rekap": renderProvinsiRekap,
};

// ---------- Init ----------
tryRestoreSession();
