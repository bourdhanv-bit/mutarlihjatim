// public/app.js
// SPA vanilla JS sederhana untuk uji fungsional backend mutarlihjatim.
// Tidak pakai framework/build step -- fetch() langsung ke /api/*, render via template string.

const state = { user: null, currentSection: null };

// Kategori TMS (8) & Pemilih Baru (5) resmi form A-DPB, dipakai untuk render grid Rekap Triwulan.
// Kode key harus sama persis dengan TMS_CATS/BARU_CATS di backend (lib/labels.js).
const REKAP_TW_CATS = {
  tms: [
    { key: "meninggal", label: "Meninggal Dunia" },
    { key: "ganda", label: "Data Ganda" },
    { key: "belum17", label: "Belum Genap 17 Tahun" },
    { key: "pindah", label: "Pindah Domisili" },
    { key: "tni", label: "TNI Aktif" },
    { key: "polri", label: "Polri Aktif" },
    { key: "wna", label: "WNA" },
    { key: "dicabut", label: "Hak Politik Dicabut" },
  ],
  baru: [
    { key: "genap17", label: "Genap 17 Tahun" },
    { key: "kawin", label: "Sudah Kawin" },
    { key: "tni_polri_sipil", label: "TNI/Polri jadi Sipil" },
    { key: "mantan_terpidana", label: "Mantan Terpidana" },
    { key: "pindah_masuk", label: "Pindah Masuk" },
  ],
};

// 40 item checklist A-DPB1 -- teks resmi diambil dari template xlsx Bawaslu Provinsi Jatim.
const CHECKLIST_ITEMS = [
  { n: 1, kategori: 'A. Pengawasan Sinkronisasi', teks: 'Apakah dalam melakukan PDPB, KPU Kabupaten/Kota melakukan pengolahan data yang bersumber dari data hasil sinkronisasi yang dilakukan oleh KPU?' },
  { n: 2, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan Bawaslu Kabupaten/Kota?' },
  { n: 3, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan dinas yang menyelenggarakan urusan di bidang kependudukan dan pencatatan sipil kabupaten/kota?' },
  { n: 4, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan lembaga pemasyarakatan dan/atau rumah tahanan negara?' },
  { n: 5, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan Tentara Nasional Indonesia?' },
  { n: 6, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan Kepolisian Negara Republik Indonesia?' },
  { n: 7, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan pemerintahan tingkat kecamatan atau nama lain?' },
  { n: 8, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan pemerintahan tingkat desa/kelurahan atau sebutan lain?' },
  { n: 9, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan rukun tetangga/rukun warga atau sebutan lain?' },
  { n: 10, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB KPU Kabupaten/Kota melakukan koordinasi dengan instansi terkait lainnya?' },
  { n: 11, kategori: 'B. Pengawasan Koordinasi', teks: 'Apakah dalam melakukan PDPB, KPU Kabupaten/Kota melakukan koordinasi dengan pihak terkait minimal 3 (tiga) bulan sekali?' },
  { n: 12, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal terdapat pemilih yang sudah meninggal dunia namun masih tercatat dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 13, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal terdapat pemilih ganda dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 14, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal terdapat pemilih yang belum genap berumur 17 (tujuh belas) tahun dan belum kawin/menikah pada saat dilakukan PDPB, namun tercatat dalam data yang dimuktahirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 15, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal terdapat pemilih yang sudah pindah domisili namun tercatat dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 16, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal terdapat pemilih yang berubah status menjadi prajurit Tentara Nasional Indonesia namun masih tercatat dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 17, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal terdapat pemilih yang sudah berubah status sebagai anggota Kepolisian Negara Republik Indonesia namun masih tercatat dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 18, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal masih terdapat warga negara asing yang tercatat dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 19, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Dalam hal masih terdapat pemilih yang telah dicabut hak politiknya oleh pengadilan yang telah berkekuatan hukum tetap namun masih tercatat dalam data yang dimutakhirkan, apakah KPU Kabupaten/Kota menandai pemilih tersebut?' },
  { n: 20, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Apakah KPU Kabupaten/Kota dalam melakukan penandaan pemilih tidak memenuhi syarat didasarkan pada adanya dokumen administrasi kependudukan atau dokumen lain yang mendukung?' },
  { n: 21, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Apakah dalam melakukan PDPB, KPU Kabupaten/Kota menambahkan pemilih baru dalam DPB dengan kriteria pemilih yang genap berumur 17 (tujuh belas) tahun pada saat dilakukan PDPB, sudah kawin atau sudah pernah kawin?' },
  { n: 22, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Apakah dalam melakukan PDPB, KPU Kabupaten/Kota menambahkan pemilih baru dalam DPB dengan kriteria pemilih yang telah berubah status dari prajurit Tentara Nasional Indonesia atau anggota Kepolisian Negara Republik Indonesia menjadi sipil?' },
  { n: 23, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Apakah dalam melakukan PDPB, KPU Kabupaten/Kota menambahkan pemilih baru dalam DPB dengan kriteria mantan terpidana yang telah selesai menjalani pidana tambahan pencabutan hak politik?' },
  { n: 24, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Apakah dalam melakukan PDPB, KPU Kabupaten/Kota menambahkan pemilih baru dalam DPB dengan kriteria pemilih pindahan masuk?' },
  { n: 25, kategori: 'C. Pengawasan Pemutakhiran', teks: 'Apakah KPU Kabupaten/Kota dalam melakukan penambahan pemilih baru pada DPB didasarkan pada adanya dokumen administrasi kependudukan atau dokumen lain yang mendukung?' },
  { n: 26, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota melakukan PDPB dan rekapitulasi PDPB?' },
  { n: 27, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah rekapitulasi PDPB dilakukan KPU Kabupaten/Kota dalam rapat pleno terbuka?' },
  { n: 28, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah rekapitulasi hasil PDPB dilakukan KPU Kabupaten/Kota dilakukan paling sedikit setiap 3 (tiga) bulan sekali?' },
  { n: 29, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota dalam melakukan rapat pleno terbuka mengundang Bawaslu Kabupaten/Kota?' },
  { n: 30, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota dalam melakukan rapat pleno terbuka mengundang dinas yang menyelenggarakan urusan di bidang kependudukan dan pencatatan sipil Kabupaten/Kota?' },
  { n: 31, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota dalam melakukan rapat pleno terbuka mengundang instansi terkait lainnya?' },
  { n: 32, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah pada rapat pleno terbuka terdapat masukan dan tanggapan terkait adanya kekeliruan pada proses dan hasil rekapitulasi PDPB?' },
  { n: 33, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Dalam hal terdapat masukan dan tanggapan terkait adanya kekeliruan pada proses dan hasil rekapitulasi PDPB, apakah KPU Kabupaten/Kota melakukan tindak lanjut?' },
  { n: 34, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota menetapkan hasil rekapitulasi PDPB tingkat Kabupaten/Kota dalam Keputusan KPU Kabupaten/Kota?' },
  { n: 35, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota menyampaikan berita acara pleno rekapitulasi kepada Bawaslu Kabupaten/Kota?' },
  { n: 36, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota menyampaikan berita acara pleno rekapitulasi kepada dinas yang menyelenggarakan urusan di bidang kependudukan dan Kabupaten/Kota?' },
  { n: 37, kategori: 'D. Pengawasan Rekapitulasi', teks: 'Apakah KPU Kabupaten/Kota menyampaikan berita acara pleno rekapitulasi kepada instansi terkait lainnya?' },
  { n: 38, kategori: 'E. Pengawasan Pengumuman', teks: 'Apakah KPU Kabupaten/Kota mengumumkan hasil rekapitulasi PDPB tingkat Kabupaten/Kota melalui laman KPU Kabupaten/Kota?' },
  { n: 39, kategori: 'E. Pengawasan Pengumuman', teks: 'Apakah KPU Kabupaten/Kota mengumumkan hasil rekapitulasi PDPB tingkat Kabupaten/Kota melalui media sosial resmi KPU Kabupaten/Kota?' },
  { n: 40, kategori: 'E. Pengawasan Pengumuman', teks: 'Apakah KPU Kabupaten/Kota mengumumkan hasil rekapitulasi PDPB tingkat Kabupaten/Kota melalui aplikasi berbasis teknologi informasi?' },
];

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
  const roleLabel = state.user.role === "admin_provinsi" ? "Provinsi" : state.user.role === "super_admin" ? "Super Admin" : state.user.kabkota;
  qs("#user-info").textContent = `${state.user.username} (${roleLabel})`;

  // Tombol "Kembali ke Super Admin" -- cuma muncul kalau sesi ini hasil "masuk sebagai" dari
  // Super Admin (bukan login langsung sebagai admin_kabkota/admin_provinsi biasa).
  const existingBtn = document.getElementById("btn-return-superadmin");
  if (existingBtn) existingBtn.remove();
  if (state.user.originRole === "super_admin") {
    const btn = document.createElement("button");
    btn.id = "btn-return-superadmin";
    btn.className = "btn-ghost";
    btn.style.marginRight = "8px";
    btn.textContent = "Kembali ke Super Admin";
    btn.addEventListener("click", async () => {
      try { await api("/api/superadmin/return", { method: "POST" }); location.reload(); }
      catch (err) { toast(err.message, true); }
    });
    qs("#user-info").insertAdjacentElement("beforebegin", btn);
  }

  if (state.user.role === "super_admin") {
    renderSuperAdminHome();
    return;
  }

  renderSidebar();
  const firstModule = MODULES[state.user.role][0].key;
  goToModule(firstModule);
}

async function renderSuperAdminHome() {
  qs("#topbar-logo").textContent = "SA";
  qs("#topbar-title").textContent = "SUPER ADMIN";
  qs("#topbar-subtitle").textContent = "Akses semua Kab/Kota & Provinsi";
  qs("#sidebar").innerHTML = "";
  qs("#main-nav").innerHTML = "";
  qs("#main-nav").classList.add("hidden");

  const content = qs("#main-content");
  content.innerHTML = `<div class="empty-state">Memuat daftar kab/kota...</div>`;
  const kabkotaList = await api("/api/master/kabkota");

  content.innerHTML = `
    <div class="card">
      <h2>Pilih Tampilan</h2>
      <p class="card-desc">Klik salah satu untuk masuk sebagai akun itu. Ada tombol "Kembali ke Super Admin" di kanan atas kapan saja untuk balik ke sini tanpa perlu login ulang.</p>
      <button class="btn btn-orange" id="sa-btn-provinsi">Masuk sebagai Provinsi (AWASI MUTARLIH)</button>
    </div>
    <div class="card">
      <h2>Kabupaten/Kota</h2>
      <div class="stat-grid">
        ${kabkotaList.map((k) => `<div class="stat-box sa-kabkota" data-kode="${k.kode}" style="cursor:pointer"><div class="label">${esc(k.nama)}</div></div>`).join("")}
      </div>
    </div>
    <div class="card">
      <h2>Generate Data Pemilih dari Excel (untuk kab/kota manapun)</h2>
      <a class="btn btn-orange" href="/templates/template-import-pemilih.xlsx" download>Unduh Template Excel</a>
      <p class="card-desc" style="margin-top:12px">
        1) Unduh template di atas (bisa diunduh ulang kapan saja kalau lupa formatnya), isi datanya
        di Excel (urutan kolom sudah ditentukan: Kecamatan, Kelurahan, NKK, NIK, Nama, Tempat Lahir,
        Tgl Lahir, Sts Kawin, Kelamin, Alamat, RT, RW, Disabilitas, EKTP, Keterangan, Sumber, TPS).
        2) Upload file yang sudah diisi. 3) Pilih kab/kota tujuan, klik Import -- data langsung
        masuk ke database kab/kota itu.
      </p>
      <div class="field-row">
        <div class="field" style="max-width:320px"><label>Kab/Kota Tujuan *</label>
          <select id="sa-import-kode">${kabkotaList.map((k) => `<option value="${k.kode}">${esc(k.nama)}</option>`).join("")}</select>
        </div>
        <div class="field" style="flex:2"><label>File Excel yang sudah diisi (.xlsx)</label>
          <input id="sa-import-file" type="file" accept=".xlsx,.xls" />
        </div>
        <div class="field" style="align-self:flex-end"><button class="btn btn-orange" id="sa-import-parse">Baca File</button></div>
      </div>
      <div id="sa-import-preview" style="margin-top:16px"></div>
    </div>
  `;

  qs("#sa-btn-provinsi", content).addEventListener("click", () => superadminSwitch("provinsi"));
  qsa(".sa-kabkota", content).forEach((box) => {
    box.addEventListener("click", () => superadminSwitch("kabkota", box.dataset.kode));
  });

  initSuperadminImportUpload(content);
}

async function superadminSwitch(target, kode) {
  try {
    await api("/api/superadmin/switch", { method: "POST", body: JSON.stringify({ target, kode }) });
    location.reload();
  } catch (err) { toast(err.message, true); }
}

// 17 kolom: Kecamatan + 16 kolom yang sama dengan INPUT_COLUMNS milik Input Pemilih Baru.
// Dibuat sebagai function (bukan const langsung) karena INPUT_COLUMNS baru didefinisikan lebih
// bawah di file ini -- evaluasi ditunda sampai benar-benar dipanggil.
function superadminImportColumns() {
  return ["Kecamatan", ...INPUT_COLUMNS.map((c) => c.label)];
}

// Baca file .xlsx yang diupload (pakai SheetJS, dimuat via CDN di index.html), tampilkan
// pratinjau, baru kirim ke backend sebagai JSON kalau tombol Import diklik. Baris 1-2 (judul +
// legenda) dan baris 3 (header) di template otomatis dilewati; baris contoh kuning ikut diimpor
// KECUALI kolom Kecamatan/Nama-nya dikosongkan dulu oleh user (kalau tidak, ikut masuk sebagai
// data biasa -- diberi peringatan di pratinjau).
// Fungsi generik dipakai di 2 tempat: dashboard Super Admin (target kab/kota dipilih manual) dan
// tab Data tiap kab/kota (target otomatis kab/kota yang sedang login, tanpa perlu pilih).
function setupExcelImportUI(root, ids, doImport) {
  let parsedRows = [];

  qs(`#${ids.parseBtnId}`, root).addEventListener("click", () => {
    const file = qs(`#${ids.fileId}`, root).files[0];
    if (!file) return toast("Pilih file Excel dulu", true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

        let startIdx = 0;
        for (let i = 0; i < Math.min(allRows.length, 5); i++) {
          const firstCell = String(allRows[i][0] || "").trim().toLowerCase();
          if (firstCell === "kecamatan" || firstCell.includes("template") || firstCell.includes("isi mulai")) {
            startIdx = i + 1;
          }
        }

        const colCount = superadminImportColumns().length;
        parsedRows = allRows
          .slice(startIdx)
          .map((r) => Array.from({ length: colCount }, (_, i) => String(r[i] ?? "").trim()))
          .filter((r) => r.some((v) => v !== ""));

        renderPreview();
      } catch (err) {
        toast("Gagal membaca file: " + err.message, true);
      }
    };
    reader.readAsArrayBuffer(file);
  });

  function renderPreview() {
    const previewEl = qs(`#${ids.previewId}`, root);
    if (parsedRows.length === 0) {
      previewEl.innerHTML = `<div class="empty-state">Tidak ada baris terbaca dari file ini.</div>`;
      return;
    }
    const valid = parsedRows.filter((r) => r[0] && r[4]);
    const invalidCount = parsedRows.length - valid.length;
    previewEl.innerHTML = `
      <p style="font-size:12.5px;color:var(--muted)">
        ${parsedRows.length} baris terbaca dari file, ${valid.length} baris valid (ada Kecamatan &amp; Nama)${invalidCount ? `, ${invalidCount} baris akan dilewati karena Kecamatan/Nama kosong` : ""}.
      </p>
      <div class="table-scroll" style="max-height:340px"><table>
        <thead><tr>${superadminImportColumns().map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${parsedRows.slice(0, 50).map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      ${parsedRows.length > 50 ? `<p style="font-size:11.5px;color:var(--muted)">Menampilkan 50 baris pertama saja sebagai pratinjau, semua ${parsedRows.length} baris tetap akan diimpor.</p>` : ""}
      <button class="btn btn-orange" id="${ids.previewId}-confirm" style="margin-top:10px">Import ${valid.length} Baris ke Database</button>
    `;
    qs(`#${ids.previewId}-confirm`, previewEl).addEventListener("click", async () => {
      try {
        const data = await doImport(parsedRows);
        toast(`${data.inserted} baris tersimpan${data.dilewati ? `, ${data.dilewati} baris dilewati` : ""}`);
        parsedRows = [];
        qs(`#${ids.fileId}`, root).value = "";
        previewEl.innerHTML = "";
      } catch (err) { toast(err.message, true); }
    });
  }
}

function initSuperadminImportUpload(root) {
  setupExcelImportUI(root, { fileId: "sa-import-file", parseBtnId: "sa-import-parse", previewId: "sa-import-preview" }, (rows) => {
    const kode = qs("#sa-import-kode", root).value;
    return api("/api/superadmin/import-pemilih", { method: "POST", body: JSON.stringify({ kode, rows }) });
  });
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

qs("#ganti-password-btn").addEventListener("click", () => {
  qs("#gp-lama").value = "";
  qs("#gp-baru").value = "";
  qs("#gp-ulangi").value = "";
  qs("#gp-error").textContent = "";
  qs("#ganti-password-modal").classList.remove("hidden");
});
qs("#gp-batal").addEventListener("click", () => qs("#ganti-password-modal").classList.add("hidden"));
qs("#gp-simpan").addEventListener("click", async () => {
  const lama = qs("#gp-lama").value;
  const baru = qs("#gp-baru").value;
  const ulangi = qs("#gp-ulangi").value;
  const errEl = qs("#gp-error");
  errEl.textContent = "";
  if (!lama || !baru || !ulangi) { errEl.textContent = "Semua kolom wajib diisi"; return; }
  if (baru !== ulangi) { errEl.textContent = "Password baru dan ulangi tidak sama"; return; }
  try {
    await api("/api/account/ganti-password", { method: "POST", body: JSON.stringify({ password_lama: lama, password_baru: baru }) });
    qs("#ganti-password-modal").classList.add("hidden");
    toast("Password berhasil diubah");
  } catch (err) { errEl.textContent = err.message; }
});

// ---------- Navigasi 2 level: sidebar kiri (modul) + menu atas (tab dalam modul) ----------
// Label & urutan tab meniru persis 2 aplikasi lama (AWASI MUTARLIH & Uji Petik) supaya
// tampilan familiar bagi petugas yang sudah terbiasa pakai versi Malang.
function formatKabkota(kode) {
  if (!kode) return "";
  const [jenis, ...rest] = kode.split("-");
  const jenisLabel = jenis === "kota" ? "Kota" : "Kabupaten";
  const nama = rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return `${jenisLabel} ${nama}`;
}

const MODULES = {
  admin_kabkota: [
    {
      key: "pemilih",
      sidebarLabel: "Pemutakhiran Data Pemilih",
      logo: "AM",
      title: "AWASI MUTARLIH",
      subtitle: () => `Bawaslu ${formatKabkota(state.user.kabkota)}`,
      tabs: [
        { key: "pemilih-cari", label: "Data" },
        { key: "pemilih-tms", label: "Data TMS" },
        { key: "pemilih-input", label: "Input Pemilih Baru" },
        { key: "pemilih-ms", label: "Pemilih MS" },
        { key: "pemilih-statistik", label: "Infografis" },
      ],
    },
    {
      key: "uji-petik",
      sidebarLabel: "Uji Petik PDPB",
      logo: "UP",
      title: "UJI PETIK",
      subtitle: () => `Bawaslu ${formatKabkota(state.user.kabkota)}`,
      tabs: [
        { key: "up-checklist", label: "1. Checklist Prosedur (A-DPB1)" },
        { key: "up-rekap", label: "2. Rekap Triwulan (A-DPB2/A-DPB3)" },
        { key: "up-sampel-tms", label: "3. Sampel TMS (A-DPB5/A-DPB4)" },
        { key: "up-sampel-ms", label: "4. Sampel Pemilih Baru (A-DPB7/A-DPB6)" },
        { key: "up-sampel-dpb", label: "5. Sampel DPB (A-DPB8)" },
        { key: "up-infografis", label: "6. Infografis" },
      ],
    },
    {
      key: "dokumen",
      sidebarLabel: "Dokumen Pengawasan",
      logo: "DP",
      title: "DOKUMEN PENGAWASAN",
      subtitle: () => `Bawaslu ${formatKabkota(state.user.kabkota)}`,
      tabs: [
        { key: "dok-saran_perbaikan", label: "Saran Perbaikan" },
        { key: "dok-imbauan", label: "Imbauan" },
        { key: "dok-form_a", label: "Form A" },
      ],
    },
  ],
  admin_provinsi: [
    {
      key: "provinsi",
      sidebarLabel: "AWASI MUTARLIH",
      logo: "AM",
      title: "AWASI MUTARLIH",
      subtitle: () => "Bawaslu Provinsi Jawa Timur",
      tabs: [
        { key: "provinsi-rekap", label: "Pemutakhiran Data Pemilih" },
        { key: "provinsi-uji-petik", label: "Uji Petik PDPB" },
        { key: "provinsi-dokumen-rekap", label: "Rekap Dokumen Pengawasan" },
        { key: "provinsi-dokumen-prop", label: "Dokumen Pengawasan Prop" },
      ],
    },
  ],
};

function renderSidebar() {
  const modules = MODULES[state.user.role] || [];
  qs("#sidebar").innerHTML = modules
    .map((m) => `<button data-module="${m.key}">${esc(m.sidebarLabel)}</button>`)
    .join("");
  qsa("#sidebar button").forEach((btn) => {
    btn.addEventListener("click", () => goToModule(btn.dataset.module));
  });
}

function goToModule(moduleKey) {
  state.currentModule = moduleKey;
  qsa("#sidebar button").forEach((b) => b.classList.toggle("active", b.dataset.module === moduleKey));

  const module = (MODULES[state.user.role] || []).find((m) => m.key === moduleKey);
  if (!module) return;

  // Ganti branding topbar (logo/judul/subjudul) sesuai modul aktif, meniru identitas
  // visual aplikasi asalnya (AM = AWASI MUTARLIH, UP = Uji Petik).
  qs("#topbar-logo").textContent = module.logo;
  qs("#topbar-title").textContent = module.title;
  qs("#topbar-subtitle").textContent = module.subtitle();

  const navEl = qs("#main-nav");
  if (module.tabs.length <= 1) {
    navEl.innerHTML = "";
    navEl.classList.add("hidden");
    goToSection(module.tabs[0].key);
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

// Helper: isi dropdown kecamatan lalu berantai ke kelurahan & TPS. Dipakai di beberapa tab
// (Data, Pemilih MS, Input) supaya konsisten dan tidak perlu ketik manual nama kecamatan.
async function populateKecamatanDropdown(selectEl) {
  try {
    // Utamakan daftar RESMI (master data, selalu lengkap dari awal). Kalau kosong (kabkota
    // belum ada di master data / belum jalankan seed-kecamatan), fallback ke kecamatan yang
    // kebetulan sudah punya data pemilih.
    let data = await api("/api/pemilih/kecamatan-resmi");
    if (!data.kecamatan || data.kecamatan.length === 0) {
      data = await api("/api/pemilih/kecamatan");
    }
    selectEl.innerHTML = `<option value="">Pilih kecamatan...</option>` + data.kecamatan.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join("");
  } catch {
    selectEl.innerHTML = `<option value="">(gagal memuat)</option>`;
  }
}
async function populateKelurahanDropdown(selectEl, kecamatan) {
  if (!kecamatan) { selectEl.innerHTML = `<option value="">Semua Desa/Kelurahan</option>`; return; }
  try {
    const data = await api(`/api/pemilih/kelurahan?kecamatan=${encodeURIComponent(kecamatan)}`);
    selectEl.innerHTML = `<option value="">Semua Desa/Kelurahan</option>` + data.kelurahan.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join("");
  } catch {
    selectEl.innerHTML = `<option value="">Semua Desa/Kelurahan</option>`;
  }
}
async function populateTpsDropdown(selectEl, kecamatan, kelurahan) {
  if (!kecamatan) { selectEl.innerHTML = `<option value="">Semua TPS</option>`; return; }
  try {
    const params = new URLSearchParams({ kecamatan });
    if (kelurahan) params.set("kelurahan", kelurahan);
    const data = await api(`/api/pemilih/tps?${params.toString()}`);
    selectEl.innerHTML = `<option value="">Semua TPS</option>` + data.tps.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  } catch {
    selectEl.innerHTML = `<option value="">Semua TPS</option>`;
  }
}

// ---------- Peta Leaflet (choropleth) ----------
// File GeoJSON sudah disederhanakan & dipecah per kabkota (public/geojson/<kode>.geojson) supaya
// ringan -- 1 file provinsi (public/geojson/jatim-kabkota.geojson, 38 batas kab/kota) dipakai di
// dashboard provinsi, dan 1 file per kabkota (cuma kecamatan daerah itu) dipakai di Infografis
// kab/kota. Tidak pernah load file asli 56MB di browser.
const geojsonCache = new Map();
async function loadGeojson(url) {
  if (geojsonCache.has(url)) return geojsonCache.get(url);
  const res = await fetch(url);
  const data = await res.json();
  geojsonCache.set(url, data);
  return data;
}

function colorScale(value, max) {
  if (!max || max <= 0) return "#e7ecf5";
  const ratio = Math.min(1, value / max);
  const from = [231, 236, 245];
  const to = [232, 130, 60];
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * ratio));
  return `rgb(${rgb.join(",")})`;
}

// dataByName: { [namaProperti]: { value, laki, perempuan, ...apapun lain untuk popup } }
// nameProp: field geojson dipakai untuk MATCHING ke key dataByName. displayProp (opsional):
// field lain dipakai untuk judul di popup kalau beda dari nameProp (mis. provinsi pakai "kode"
// untuk matching tapi "kab_kota" untuk ditampilkan).
async function renderChoroplethMap(containerId, geojsonUrl, dataByName, { nameProp, displayProp, onFeatureClick, buttonLabel }) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="empty-state">Memuat peta...</div>`;

  let geojson;
  try {
    geojson = await loadGeojson(geojsonUrl);
  } catch {
    el.innerHTML = `<div class="empty-state">Peta tidak tersedia untuk daerah ini.</div>`;
    return;
  }

  el.innerHTML = "";
  el.classList.add("map-container");
  const map = L.map(el, { scrollWheelZoom: false }).setView([-7.9, 112.6], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 14,
  }).addTo(map);

  const values = Object.values(dataByName).map((d) => d.value || 0);
  const maxVal = values.length ? Math.max(...values) : 0;

  const findData = (matchKey) => {
    const key = Object.keys(dataByName).find((k) => k.toLowerCase().trim() === (matchKey || "").toLowerCase().trim());
    return key ? dataByName[key] : null;
  };

  const layer = L.geoJSON(geojson, {
    style: (feature) => {
      const d = findData(feature.properties[nameProp]);
      return { fillColor: d ? colorScale(d.value, maxVal) : "#e7ecf5", weight: 1, color: "#1e3563", fillOpacity: 0.75 };
    },
    onEachFeature: (feature, lyr) => {
      const matchKey = feature.properties[nameProp];
      const displayNama = displayProp ? feature.properties[displayProp] : matchKey;
      const d = findData(matchKey);
      const popupId = `map-popup-${String(matchKey).replace(/[^a-zA-Z0-9]/g, "")}-${containerId}`;
      lyr.bindPopup(`
        <b>${esc(displayNama)}</b><br/>
        ${d ? `Laki-laki: <b>${(d.laki || 0).toLocaleString("id-ID")}</b><br/>Perempuan: <b>${(d.perempuan || 0).toLocaleString("id-ID")}</b><br/>Total: <b>${(d.value || 0).toLocaleString("id-ID")}</b>` : "Belum ada data"}
        ${onFeatureClick ? `<br/><button id="${popupId}" style="margin-top:6px;background:#e8823c;color:#fff;border:none;border-radius:4px;padding:4px 10px;font-size:12px;cursor:pointer">${esc(buttonLabel || "Lihat Detail")}</button>` : ""}
      `);
      if (onFeatureClick) {
        lyr.on("popupopen", () => {
          const btn = document.getElementById(popupId);
          if (btn) btn.addEventListener("click", () => onFeatureClick(matchKey, d));
        });
      }
    },
  }).addTo(map);

  map.invalidateSize();
  try { map.fitBounds(layer.getBounds(), { padding: [10, 10] }); } catch {}
}

async function renderPemilihCari(root) {
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <h2>Data Pemilih</h2>
        <a class="btn btn-sm" href="/api/pemilih/export?tabel=pemilih">Unduh Excel (CSV)</a>
      </div>
      <div class="field-row">
        <div class="field"><label>Kecamatan</label><select id="f-kecamatan"><option value="">Memuat...</option></select></div>
        <div class="field"><label>Desa/Kelurahan</label><select id="f-kelurahan"><option value="">Semua Desa/Kelurahan</option></select></div>
        <div class="field"><label>TPS</label><select id="f-tps"><option value="">Semua TPS</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Cari Nama</label><input id="f-nama" placeholder="Cari nama..." /></div>
        <div class="field"><label>Cari NIK</label><input id="f-search" placeholder="Cari NIK... (boleh banyak, pisah baris/koma)" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn btn-orange" id="btn-cari">Cari</button></div>
      </div>
    </div>
    <div class="card">
      <h2>Generate Data Pemilih dari Excel</h2>
      <a class="btn btn-orange" href="/templates/template-import-pemilih.xlsx" download>Unduh Template Excel</a>
      <p class="card-desc" style="margin-top:12px">
        1) Unduh template di atas (bisa diunduh ulang kapan saja kalau lupa formatnya), isi datanya
        di Excel (urutan kolom: Kecamatan, Kelurahan, NKK, NIK, Nama, Tempat Lahir, Tgl Lahir,
        Sts Kawin, Kelamin, Alamat, RT, RW, Disabilitas, EKTP, Keterangan, Sumber, TPS -- boleh
        berisi banyak kecamatan sekaligus dalam 1 file). 2) Upload file yang sudah diisi.
        3) Klik Import -- data langsung masuk ke database kecamatan Anda.
      </p>
      <div class="field-row">
        <div class="field" style="flex:2"><label>File Excel yang sudah diisi (.xlsx)</label>
          <input id="pd-import-file" type="file" accept=".xlsx,.xls" />
        </div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="pd-import-parse">Baca File</button></div>
      </div>
      <div id="pd-import-preview" style="margin-top:16px"></div>
    </div>
    <div id="hasil-cari"></div>
  `;
  setupExcelImportUI(root, { fileId: "pd-import-file", parseBtnId: "pd-import-parse", previewId: "pd-import-preview" }, (rows) =>
    api("/api/pemilih/import-excel", { method: "POST", body: JSON.stringify({ rows }) })
  );

  const kecSel = qs("#f-kecamatan", root), kelSel = qs("#f-kelurahan", root), tpsSel = qs("#f-tps", root);
  await populateKecamatanDropdown(kecSel);
  kecSel.addEventListener("change", async () => {
    await populateKelurahanDropdown(kelSel, kecSel.value);
    await populateTpsDropdown(tpsSel, kecSel.value, "");
  });
  kelSel.addEventListener("change", () => populateTpsDropdown(tpsSel, kecSel.value, kelSel.value));

  let currentPage = 1;
  async function doSearch(page = 1) {
    currentPage = page;
    const params = new URLSearchParams();
    const kec = kecSel.value, kel = kelSel.value, tps = tpsSel.value;
    const nama = qs("#f-nama", root).value.trim();
    const search = qs("#f-search", root).value.trim();
    if (kec) params.set("kecamatan", kec);
    if (kel) params.set("kelurahan", kel);
    if (tps) params.set("tps", tps);
    if (nama) params.set("nama", nama);
    if (search) params.set("search", search);
    params.set("page", page);

    const hasilEl = qs("#hasil-cari", root);
    hasilEl.innerHTML = `<div class="empty-state">Mencari...</div>`;
    try {
      const data = await api(`/api/pemilih/data?${params.toString()}`);
      if (data.data.length === 0) {
        hasilEl.innerHTML = `<div class="card"><div class="empty-state">Tidak ada data ditemukan.</div></div>`;
        return;
      }
      const totalPages = Math.max(1, Math.ceil(data.total / (data.pageSize || 50)));
      hasilEl.innerHTML = `
        <div class="card">
          <h2>Daftar Pemilih (By Name)</h2>
          ${data.notFound && data.notFound.length ? `<p style="color:#c0392b;font-size:12.5px">NIK tidak ditemukan: ${esc(data.notFound.join(", "))}</p>` : ""}
          <div class="table-scroll"><table>
            <thead><tr><th>Edit</th><th>Nama</th><th>NKK</th><th>NIK</th><th>Kec.</th><th>Kel.</th><th>TPS</th><th>Alamat</th><th>RT/RW</th><th>Status</th></tr></thead>
            <tbody>
              ${data.data.map((r) => `
                <tr data-row-id="${r.id}">
                  <td><a href="#" class="edit-icon" data-id="${r.id}" title="Edit">&#9998;</a></td>
                  <td>${esc(r.nama)}</td><td>${esc(r.nkk)}</td><td>${esc(r.nik)}</td><td>${esc(r.kecamatan)}</td>
                  <td>${esc(r.kelurahan)}</td><td>${esc(r.tps)}</td><td>${esc(r.alamat)}</td><td>${esc(r.rt)}/${esc(r.rw)}</td>
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
          ${!data.bulk ? `
          <div style="display:flex;align-items:center;gap:12px;margin-top:12px;font-size:12.5px">
            <button class="btn btn-sm" id="btn-prev" ${data.page <= 1 ? "disabled" : ""}>&lsaquo; Sebelumnya</button>
            <span>Halaman ${data.page} dari ${totalPages} (${data.total} baris)</span>
            <button class="btn btn-sm" id="btn-next" ${data.page >= totalPages ? "disabled" : ""}>Berikutnya &rsaquo;</button>
          </div>` : ""}
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
      qsa(".edit-icon", hasilEl).forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          openEditRow(link.dataset.id, data.data.find((r) => String(r.id) === link.dataset.id), link.closest("tr"));
        });
      });
      if (!data.bulk) {
        const prevBtn = qs("#btn-prev", hasilEl), nextBtn = qs("#btn-next", hasilEl);
        if (prevBtn) prevBtn.addEventListener("click", () => doSearch(currentPage - 1));
        if (nextBtn) nextBtn.addEventListener("click", () => doSearch(currentPage + 1));
      }
    } catch (err) {
      hasilEl.innerHTML = `<div class="card"><p style="color:#c0392b">${esc(err.message)}</p></div>`;
    }
  }
  qs("#btn-cari", root).addEventListener("click", () => doSearch(1));
}

function openEditRow(id, row, trEl) {
  if (!row) return;
  const editRow = document.createElement("tr");
  editRow.innerHTML = `
    <td colspan="9">
      <div class="field-row" style="margin:8px 0">
        <div class="field"><label>Nama</label><input class="ed-nama" value="${esc(row.nama)}" /></div>
        <div class="field"><label>NIK</label><input class="ed-nik" value="${esc(row.nik)}" /></div>
        <div class="field"><label>Alamat</label><input class="ed-alamat" value="${esc(row.alamat)}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>RT</label><input class="ed-rt" value="${esc(row.rt)}" /></div>
        <div class="field"><label>RW</label><input class="ed-rw" value="${esc(row.rw)}" /></div>
        <div class="field"><label>TPS</label><input class="ed-tps" value="${esc(row.tps)}" /></div>
      </div>
      <button class="btn btn-orange btn-sm ed-save">Simpan Perubahan</button>
      <button class="btn btn-sm ed-cancel" style="background:#94a3b8">Batal</button>
    </td>
  `;
  trEl.after(editRow);
  editRow.querySelector(".ed-cancel").addEventListener("click", () => editRow.remove());
  editRow.querySelector(".ed-save").addEventListener("click", async () => {
    const changes = {
      nama: editRow.querySelector(".ed-nama").value,
      nik: editRow.querySelector(".ed-nik").value,
      alamat: editRow.querySelector(".ed-alamat").value,
      rt: editRow.querySelector(".ed-rt").value,
      rw: editRow.querySelector(".ed-rw").value,
      tps: editRow.querySelector(".ed-tps").value,
    };
    try {
      const result = await api("/api/pemilih/data/update", { method: "POST", body: JSON.stringify({ id, changes }) });
      toast(result.changed.length ? `${result.changed.length} field diperbarui` : "Tidak ada perubahan");
      editRow.remove();
    } catch (err) { toast(err.message, true); }
  });
}

// 16 kolom sesuai urutan yang dibutuhkan backend (INPUT_COLS di api/handler.js)
const INPUT_COLUMNS = [
  { key: "kelurahan", label: "Kelurahan" },
  { key: "nkk", label: "NKK" },
  { key: "nik", label: "NIK" },
  { key: "nama", label: "Nama" },
  { key: "tempat_lahir", label: "Tempat Lahir" },
  { key: "tanggal_lahir", label: "Tgl Lahir (dd/mm/yyyy)" },
  { key: "sts_kawin", label: "Sts Kawin" },
  { key: "kelamin", label: "Kelamin" },
  { key: "alamat", label: "Alamat" },
  { key: "rt", label: "RT" },
  { key: "rw", label: "RW" },
  { key: "disabilitas", label: "Disabilitas" },
  { key: "ektp", label: "EKTP" },
  { key: "keterangan", label: "Keterangan" },
  { key: "sumber", label: "Sumber" },
  { key: "tps", label: "TPS" },
];
const NAMA_COL_INDEX = INPUT_COLUMNS.findIndex((c) => c.key === "nama");

async function renderPemilihInput(root) {
  const emptyRow = () => new Array(INPUT_COLUMNS.length).fill("");
  let gridRows = Array.from({ length: 8 }, emptyRow);

  root.innerHTML = `
    <div class="card">
      <h2>Input Pemilih Baru</h2>
      <p class="card-desc">
        Tempel data langsung dari Excel/Spreadsheet ke sel manapun di tabel ini (akan otomatis
        mengisi ke kanan &amp; ke bawah sesuai ukuran data yang ditempel, menambah baris kalau perlu).
        Bisa juga diketik/diedit manual per sel. Baris kosong (tanpa Nama) otomatis diabaikan saat disimpan.
      </p>
      <div class="field-row">
        <div class="field" style="max-width:320px">
          <label>Kecamatan tujuan *</label>
          <input id="grid-kecamatan" list="grid-kecamatan-list" placeholder="Ketik atau pilih kecamatan..." />
          <datalist id="grid-kecamatan-list"></datalist>
        </div>
      </div>
      <div class="table-scroll" style="max-height:520px">
        <table>
          <thead><tr><th>No</th>${INPUT_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join("")}<th></th></tr></thead>
          <tbody id="grid-tbody"></tbody>
        </table>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn" id="btn-add-row">+ Tambah Baris</button>
        <button class="btn btn-orange" id="btn-save-grid">Simpan Semua</button>
      </div>
    </div>
  `;

  // Isi datalist kecamatan untuk auto-lengkapi (tapi tetap boleh ketik nama baru, mis. kecamatan
  // yang belum pernah ada datanya sama sekali).
  try {
    const kecData = await api("/api/pemilih/kecamatan");
    qs("#grid-kecamatan-list", root).innerHTML = kecData.kecamatan.map((k) => `<option value="${esc(k)}"></option>`).join("");
  } catch {}

  function renderGrid() {
    const tbody = qs("#grid-tbody", root);
    tbody.innerHTML = gridRows.map((row, ri) => `
      <tr>
        <td>${ri + 1}</td>
        ${row.map((val, ci) => `<td><input type="text" class="grid-cell" data-row="${ri}" data-col="${ci}" value="${esc(val)}" /></td>`).join("")}
        <td><button class="btn btn-sm btn-danger" data-remove-row="${ri}" title="Hapus baris">&times;</button></td>
      </tr>
    `).join("");

    qsa(".grid-cell", tbody).forEach((inp) => {
      inp.addEventListener("input", () => {
        gridRows[+inp.dataset.row][+inp.dataset.col] = inp.value;
      });
      inp.addEventListener("paste", (e) => {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (!text.includes("\t") && !text.includes("\n")) return; // 1 nilai saja -- biarkan paste normal
        e.preventDefault();
        const startRow = +inp.dataset.row, startCol = +inp.dataset.col;
        const lines = text.replace(/\r/g, "").split("\n");
        while (lines.length && lines[lines.length - 1] === "") lines.pop();
        lines.forEach((line, li) => {
          const cells = line.split("\t");
          const targetRow = startRow + li;
          while (gridRows.length <= targetRow) gridRows.push(emptyRow());
          cells.forEach((cellVal, ci) => {
            const targetCol = startCol + ci;
            if (targetCol < INPUT_COLUMNS.length) gridRows[targetRow][targetCol] = cellVal.trim();
          });
        });
        renderGrid();
      });
    });
    qsa("[data-remove-row]", tbody).forEach((btn) => {
      btn.addEventListener("click", () => {
        gridRows.splice(+btn.dataset.removeRow, 1);
        if (gridRows.length === 0) gridRows.push(emptyRow());
        renderGrid();
      });
    });
  }
  renderGrid();

  qs("#btn-add-row", root).addEventListener("click", () => {
    gridRows.push(emptyRow());
    renderGrid();
  });

  qs("#btn-save-grid", root).addEventListener("click", async () => {
    const kecamatan = qs("#grid-kecamatan", root).value.trim();
    if (!kecamatan) return toast("Kecamatan tujuan wajib diisi", true);
    const rows = gridRows.filter((r) => r[NAMA_COL_INDEX] && r[NAMA_COL_INDEX].trim() !== "");
    if (rows.length === 0) return toast("Isi minimal 1 baris dengan Nama", true);
    try {
      const data = await api("/api/pemilih/pemilih-baru", { method: "POST", body: JSON.stringify({ kecamatan, rows }) });
      toast(`${data.inserted} baris tersimpan`);
      gridRows = Array.from({ length: 8 }, emptyRow);
      renderGrid();
    } catch (err) { toast(err.message, true); }
  });
}

async function renderPemilihStatistik(root) {
  root.innerHTML = `<div class="empty-state">Memuat infografis...</div>`;
  const [stat, snapshots] = await Promise.all([
    api("/api/pemilih/statistik/current"),
    api("/api/pemilih/statistik/snapshots"),
  ]);
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:20px;margin-bottom:2px">INFOGRAFIS HASIL PENGAWASAN DATA PEMILIH BERKELANJUTAN</h2>
          <p class="card-desc" style="margin-bottom:0">Bawaslu ${esc(formatKabkota(state.user.kabkota))}</p>
        </div>
        <span class="badge" style="background:#fde8d8;color:var(--orange-600);white-space:nowrap">Data terkini -- ${today}</span>
      </div>
      <div class="field-row" style="margin-top:14px">
        <div class="field"><label>Lihat data</label>
          <select id="snap-select">
            <option value="">Data terkini (live)</option>
            ${snapshots.snapshots.map((s) => `<option value="${esc(s.bulan)}">Snapshot ${esc(s.bulan)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-generate-snapshot">Buat Snapshot Bulan Ini</button></div>
      </div>
    </div>
    <div id="infografis-body"></div>
  `;

  async function renderKabupatenLevel(dataToShow) {
    const body = qs("#infografis-body", root);
    body.innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${dataToShow.totalPemilihMS}</div><div class="label">Total Pemilih (MS)</div></div>
        <div class="stat-box"><div class="num">${dataToShow.totalLaki}</div><div class="label">Laki-laki</div></div>
        <div class="stat-box"><div class="num">${dataToShow.totalPerempuan}</div><div class="label">Perempuan</div></div>
        <div class="stat-box" style="background:#fdeceb"><div class="num" style="color:var(--danger)">${dataToShow.totalTms}</div><div class="label">Total TMS</div></div>
        <div class="stat-box"><div class="num">${dataToShow.totalDisabilitas}</div><div class="label">Total Disabilitas</div></div>
        <div class="stat-box"><div class="num">${dataToShow.totalUbahData}</div><div class="label">Total Ubah Data</div></div>
      </div>
      <div class="card">
        <h2>Sebaran TMS per Kategori (Kabupaten/Kota)</h2>
        ${dataToShow.tmsBreakdown.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : dataToShow.tmsBreakdown.map((t) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12.5px">
            <span style="width:180px">${esc(t.label)}</span>
            <div style="flex:1;background:var(--navy-100);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${Math.min(100, (t.jumlah / (dataToShow.totalTms || 1)) * 100)}%;background:var(--orange-500);height:100%"></div>
            </div>
            <span style="width:50px;text-align:right;font-weight:600">${t.jumlah}</span>
          </div>
        `).join("")}
      </div>
      <div class="card">
        <h2>Sebaran Disabilitas per Jenis (Kabupaten/Kota)</h2>
        ${dataToShow.disabilitasBreakdown.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : dataToShow.disabilitasBreakdown.map((d) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12.5px">
            <span style="width:180px">${esc(d.label)}</span>
            <div style="flex:1;background:var(--navy-100);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${Math.min(100, (d.jumlah / (dataToShow.totalDisabilitas || 1)) * 100)}%;background:var(--navy-700);height:100%"></div>
            </div>
            <span style="width:50px;text-align:right;font-weight:600">${d.jumlah}</span>
          </div>
        `).join("")}
      </div>
      <div class="card">
        <h2>Peta Sebaran Pemilih per Kecamatan</h2>
        <p class="card-desc">Klik kecamatan di peta untuk lihat infografis lengkap kecamatan tersebut.</p>
        <div id="map-kabupaten-pemilih"></div>
      </div>
      <div class="card">
        <h2>Jumlah Pemilih per Kecamatan</h2>
        <p class="card-desc">Klik kecamatan untuk lihat infografis lengkap kecamatan tersebut.</p>
        ${dataToShow.perKecamatan.length === 0 ? `<div class="empty-state">Belum ada data.</div>` : `
        <div class="stat-grid">${dataToShow.perKecamatan.map((k) => `
          <div class="stat-box kec-drill" data-kec="${esc(k.kecamatan)}" style="cursor:pointer">
            <div class="num">${k.jumlah}</div><div class="label">${esc(k.kecamatan)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">L: ${k.laki} / P: ${k.perempuan}</div>
          </div>
        `).join("")}</div>`}
      </div>
    `;

    if (dataToShow.perKecamatan.length > 0) {
      const dataByName = {};
      for (const k of dataToShow.perKecamatan) dataByName[k.kecamatan] = { value: k.jumlah, laki: k.laki, perempuan: k.perempuan };
      renderChoroplethMap(
        "map-kabupaten-pemilih",
        `/geojson/${state.user.kabkota}.geojson`,
        dataByName,
        { nameProp: "kecamatan", onFeatureClick: (nama) => renderKecamatanLevel(nama), buttonLabel: "Lihat Infografis Lengkap" }
      );
    } else {
      qs("#map-kabupaten-pemilih", body).innerHTML = `<div class="empty-state">Belum ada data untuk ditampilkan di peta.</div>`;
    }

    qsa(".kec-drill", body).forEach((box) => {
      box.addEventListener("click", () => renderKecamatanLevel(box.dataset.kec));
    });
  }

  async function renderKecamatanLevel(kecamatan) {
    const body = qs("#infografis-body", root);
    body.innerHTML = `<div class="empty-state">Memuat infografis ${esc(kecamatan)}...</div>`;
    const d = await api(`/api/pemilih/infografis/kecamatan?kecamatan=${encodeURIComponent(kecamatan)}`);
    body.innerHTML = `
      <div class="card">
        <button class="btn btn-sm" id="btn-back-kab" style="margin-bottom:12px">&larr; Kembali ke Kabupaten/Kota</button>
        <h2 style="font-size:18px">INFOGRAFIS KECAMATAN ${esc(kecamatan.toUpperCase())}</h2>
      </div>
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${d.totalPemilih}</div><div class="label">Total Pemilih</div></div>
        <div class="stat-box"><div class="num">${d.totalLaki}</div><div class="label">Laki-laki</div></div>
        <div class="stat-box"><div class="num">${d.totalPerempuan}</div><div class="label">Perempuan</div></div>
        <div class="stat-box" style="background:#fdeceb"><div class="num" style="color:var(--danger)">${d.totalTms}</div><div class="label">Total TMS</div></div>
      </div>
      <div class="card">
        <h2>Jumlah Pemilih per Desa (Laki-laki/Perempuan)</h2>
        ${d.perDesa.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : `
        <div class="stat-grid">${d.perDesa.map((r) => `<div class="stat-box"><div class="num">${r.jumlah}</div><div class="label">${esc(r.kelurahan)}</div><div style="font-size:11px;color:var(--muted)">L:${r.laki} P:${r.perempuan}</div></div>`).join("")}</div>`}
      </div>
      <div class="card">
        <h2>Pemilih Disabilitas per Desa (Total: ${d.totalDisabilitas})</h2>
        ${d.disabilitasPerDesa.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : `
        <div class="stat-grid">${d.disabilitasPerDesa.map((r) => `<div class="stat-box"><div class="num">${r.total}</div><div class="label">${esc(r.kelurahan)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${Object.values(r.breakdown).map((b) => `${esc(b.label)}: ${b.laki + b.perempuan}`).join("<br>")}</div></div>`).join("")}</div>`}
      </div>
      <div class="card">
        <h2>Pemilih Baru Masuk (Input Pemilih Baru) -- Total: ${d.totalPemilihBaru}</h2>
        ${d.pemilihBaruPerDesa.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : `
        <div class="table-scroll"><table><thead><tr><th>Kelurahan</th><th>Jumlah</th></tr></thead>
        <tbody>${d.pemilihBaruPerDesa.map((r) => `<tr><td>${esc(r.kelurahan)}</td><td>${r.jumlah}</td></tr>`).join("")}</tbody></table></div>`}
      </div>
      <div class="card">
        <h2>Sebaran Generasi Pemilih</h2>
        ${d.generasi.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : d.generasi.sort((a, b) => b.jumlah - a.jumlah).map((g) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12.5px">
            <span style="width:110px">${esc(g.label)}</span>
            <div style="flex:1;background:var(--navy-100);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${Math.min(100, (g.jumlah / (d.generasi[0] ? d.generasi[0].jumlah || 1 : 1)) * 100)}%;background:var(--navy-700);height:100%"></div>
            </div>
            <span style="width:50px;text-align:right;font-weight:600">${g.jumlah}</span>
          </div>
        `).join("")}
      </div>
      <div class="card">
        <h2>Desa dengan Aktivitas Tertinggi (Uji Petik, 30 Hari Terakhir)</h2>
        ${d.ujiPetikDesa.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : `
        <div class="table-scroll"><table><thead><tr><th>Kelurahan</th><th>Jumlah Aktivitas</th></tr></thead>
        <tbody>${d.ujiPetikDesa.slice(0, 10).map((r) => `<tr><td>${esc(r.kelurahan)}</td><td>${r.jumlah}</td></tr>`).join("")}</tbody></table></div>`}
      </div>
      <div class="card">
        <h2>Sebaran Pemilih KTP-el vs Non KTP-el per Desa</h2>
        ${d.ektpPerDesa.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : `
        <div class="stat-grid">${d.ektpPerDesa.map((r) => `<div class="stat-box"><div class="num">${r.sudah.laki + r.sudah.perempuan}</div><div class="label">${esc(r.kelurahan)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Belum: ${r.belum.laki + r.belum.perempuan}</div></div>`).join("")}</div>`}
      </div>
      <div class="card">
        <h2>Pemilih Usia &ge;100 Tahun per Desa</h2>
        ${d.pemilih100PerDesa.length === 0 ? `<div class="empty-state">Tidak ada data.</div>` : `
        <div class="table-scroll"><table><thead><tr><th>Kelurahan</th><th>Jumlah</th></tr></thead>
        <tbody>${d.pemilih100PerDesa.map((r) => `<tr><td>${esc(r.kelurahan)}</td><td>${r.jumlah}</td></tr>`).join("")}</tbody></table></div>`}
      </div>
    `;
    qs("#btn-back-kab", body).addEventListener("click", () => renderKabupatenLevel(stat));
  }

  await renderKabupatenLevel(stat);

  qs("#btn-generate-snapshot", root).addEventListener("click", async () => {
    try { await api("/api/pemilih/statistik/generate", { method: "POST" }); toast("Snapshot dibuat"); }
    catch (err) { toast(err.message, true); }
  });
  qs("#snap-select", root).addEventListener("change", async (e) => {
    const bulan = e.target.value;
    if (!bulan) { renderKabupatenLevel(stat); return; }
    try {
      const snap = await api(`/api/pemilih/statistik/snapshot?bulan=${encodeURIComponent(bulan)}`);
      renderKabupatenLevel(snap);
    } catch (err) { toast(err.message, true); }
  });
}

async function renderPemilihTms(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Rekapitulasi TMS per Kecamatan</h2>
      <a class="btn btn-sm" href="/api/pemilih/export?tabel=tms_log" style="float:right;margin-top:-32px">Unduh Riwayat TMS (CSV)</a>
      <div id="tms-rekap-cards"><div class="empty-state">Memuat...</div></div>
    </div>
    <div class="card">
      <h2>Daftar Pemilih TMS (By Name)</h2>
      <div class="field-row">
        <div class="field"><label>Kecamatan</label><select id="tms-kecamatan"><option value="">Memuat...</option></select></div>
        <div class="field"><label>Desa/Kelurahan</label><select id="tms-kelurahan"><option value="">Semua Desa/Kelurahan</option></select></div>
        <div class="field"><label>TPS</label><select id="tms-tps"><option value="">Semua TPS</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Cari Nama</label><input id="tms-nama" placeholder="Cari nama..." /></div>
        <div class="field"><label>Cari NIK</label><input id="tms-nik" placeholder="Cari NIK..." /></div>
        <div class="field" style="align-self:flex-end"><button class="btn btn-orange" id="btn-load-tms-list">Muat</button></div>
      </div>
      <div id="tms-list-body"></div>
    </div>
    <div class="card">
      <h2>Rekapitulasi Ubah Data (Koreksi Data Pemilih)</h2>
      <div id="ubahdata-rekap-body"><div class="empty-state">Memuat...</div></div>
    </div>
    <div class="card">
      <h2>Riwayat Perubahan Data (By Name)</h2>
      <div id="ubahdata-list-body"><div class="empty-state">Memuat...</div></div>
    </div>
    <div class="card">
      <h2>Deteksi Kegandaan NIK (Antar Kecamatan)</h2>
      <p class="card-desc"><b>Cara ringan (disarankan):</b> masukkan 1 NIK spesifik untuk melihat di kecamatan mana saja NIK itu terdaftar.</p>
      <div class="field-row">
        <div class="field"><input id="dedup-nik" placeholder="Masukkan NIK..." /></div>
        <div class="field" style="align-self:flex-end;flex:0"><button class="btn" id="btn-cari-nik">Cari NIK</button></div>
      </div>
      <div id="dedup-satu-hasil"></div>
      <p class="card-desc" style="margin-top:16px"><b>Cara berat:</b> periksa seluruh data sekaligus untuk cari semua NIK yang duplikat secara otomatis. Bisa lambat kalau datanya sangat besar.</p>
      <button class="btn" id="btn-deteksi-semua">Deteksi Semua (Berat)</button>
      <div id="dedup-semua-hasil" style="margin-top:12px"></div>
    </div>
  `;

  // Rekap TMS per kecamatan (card)
  api("/api/pemilih/tms/rekap").then((data) => {
    const el = qs("#tms-rekap-cards", root);
    el.innerHTML = data.rekap.length === 0 ? `<div class="empty-state">Belum ada data TMS.</div>` : `
      <div class="stat-grid">${data.rekap.map((r) => `<div class="stat-box"><div class="num">${r.total}</div><div class="label">${esc(r.kecamatan)}</div></div>`).join("")}</div>
    `;
  });

  // Daftar TMS by name (dropdown + list)
  const kecSel = qs("#tms-kecamatan", root), kelSel = qs("#tms-kelurahan", root), tpsSel = qs("#tms-tps", root);
  await populateKecamatanDropdown(kecSel);
  kecSel.addEventListener("change", async () => {
    await populateKelurahanDropdown(kelSel, kecSel.value);
    await populateTpsDropdown(tpsSel, kecSel.value, "");
  });
  kelSel.addEventListener("change", () => populateTpsDropdown(tpsSel, kecSel.value, kelSel.value));
  qs("#btn-load-tms-list", root).addEventListener("click", async () => {
    const params = new URLSearchParams();
    if (kecSel.value) params.set("kecamatan", kecSel.value);
    if (kelSel.value) params.set("kelurahan", kelSel.value);
    if (tpsSel.value) params.set("tps", tpsSel.value);
    const nama = qs("#tms-nama", root).value.trim();
    const nik = qs("#tms-nik", root).value.trim();
    if (nama) params.set("nama", nama);
    if (nik) params.set("nik", nik);
    const listEl = qs("#tms-list-body", root);
    listEl.innerHTML = `<div class="empty-state">Memuat...</div>`;
    const data = await api(`/api/pemilih/tms/list?${params.toString()}`);
    if (data.data.length === 0) { listEl.innerHTML = `<div class="empty-state">Tidak ada data.</div>`; return; }
    listEl.innerHTML = `
      <p style="font-size:12.5px;color:var(--muted)">Total: ${data.total}</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Nama</th><th>NKK</th><th>NIK</th><th>Kecamatan</th><th>Kelurahan</th><th>Kode TMS</th></tr></thead>
        <tbody>${data.data.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.nkk)}</td><td>${esc(r.nik)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.kelurahan)}</td><td>${esc(r.kode_tms_label)}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  });

  // Rekap ubah data
  api("/api/pemilih/ubah-data/rekap").then((data) => {
    const el = qs("#ubahdata-rekap-body", root);
    el.innerHTML = data.perDesa.length === 0 ? `<div class="empty-state">Belum ada riwayat perubahan data.</div>` : `
      <p style="font-size:13px;margin-bottom:10px">Total data yang pernah dikoreksi: <b>${data.total}</b></p>
      <div class="stat-grid">${data.perDesa.map((r) => `<div class="stat-box"><div class="num">${r.jumlah}</div><div class="label">${esc(r.kelurahan)}</div></div>`).join("")}</div>
    `;
  });

  // Riwayat perubahan data (list)
  api("/api/pemilih/ubah-data/list").then((data) => {
    const el = qs("#ubahdata-list-body", root);
    el.innerHTML = data.data.length === 0 ? `<div class="empty-state">Belum ada riwayat perubahan data.</div>` : `
      <div class="table-scroll"><table>
        <thead><tr><th>NIK</th><th>Nama</th><th>Kecamatan</th><th>Kelurahan</th><th>Field</th><th>Dari</th><th>Menjadi</th><th>Oleh</th><th>Tanggal</th></tr></thead>
        <tbody>${data.data.map((r) => `<tr><td>${esc(r.nik)}</td><td>${esc(r.nama)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.kelurahan)}</td><td>${esc(r.field)}</td><td>${esc(r.nilai_lama)}</td><td>${esc(r.nilai_baru)}</td><td>${esc(r.username)}</td><td>${esc(r.dicatat_pada)}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  });

  // Deteksi kegandaan NIK
  qs("#btn-cari-nik", root).addEventListener("click", async () => {
    const nik = qs("#dedup-nik", root).value.trim();
    if (!nik) return toast("Isi NIK dulu", true);
    const resultEl = qs("#dedup-satu-hasil", root);
    resultEl.innerHTML = `<div class="empty-state">Mencari...</div>`;
    const data = await api(`/api/pemilih/cari-nik-ganda?nik=${encodeURIComponent(nik)}`);
    if (data.records.length === 0) { resultEl.innerHTML = `<div class="empty-state">NIK tidak ditemukan.</div>`; return; }
    resultEl.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>Nama</th><th>Kecamatan</th><th>Kelurahan</th><th>Alamat</th><th>Status</th></tr></thead>
        <tbody>${data.records.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.kelurahan)}</td><td>${esc(r.alamat)}</td><td>${r.kode_tms ? "TMS " + esc(r.kode_tms) : "MS"}</td></tr>`).join("")}</tbody>
      </table></div>
      ${data.records.length > 1 ? `<p style="color:var(--danger);font-size:12.5px;margin-top:8px">NIK ini terdaftar di lebih dari 1 baris -- perlu dicek kegandaannya.</p>` : ""}
    `;
  });
  qs("#btn-deteksi-semua", root).addEventListener("click", async () => {
    const resultEl = qs("#dedup-semua-hasil", root);
    resultEl.innerHTML = `<div class="empty-state">Memproses (bisa lambat)...</div>`;
    try {
      const data = await api("/api/pemilih/deteksi-ganda");
      if (data.groups.length === 0) { resultEl.innerHTML = `<div class="empty-state">Tidak ditemukan NIK ganda.</div>`; return; }
      resultEl.innerHTML = `
        <p style="font-size:12.5px;color:var(--muted)">${data.groups.length} NIK terdeteksi ganda (maks. 150 ditampilkan).</p>
        <div class="table-scroll"><table>
          <thead><tr><th>NIK</th><th>Jumlah Baris</th><th>Detail</th></tr></thead>
          <tbody>${data.groups.map((g) => `<tr><td>${esc(g.nik)}</td><td>${g.records.length}</td><td>${g.records.map((r) => `${esc(r.nama)} (${esc(r.kecamatan)})`).join(", ")}</td></tr>`).join("")}</tbody>
        </table></div>
      `;
    } catch (err) { resultEl.innerHTML = `<p style="color:#c0392b">${esc(err.message)}</p>`; }
  });
}

async function renderPemilihMs(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Rekapitulasi Jumlah Pemilih per Desa</h2>
      <div class="field-row">
        <div class="field"><label>Kecamatan *</label><select id="ms-kecamatan"><option value="">Memuat...</option></select></div>
      </div>
      <div id="ms-rekap-desa"><div class="empty-state">Pilih kecamatan dulu.</div></div>
    </div>
    <div class="card">
      <h2>Rekapitulasi Disabilitas per Desa</h2>
      <div id="ms-rekap-disabilitas"><div class="empty-state">Pilih kecamatan dulu.</div></div>
    </div>
    <div class="card">
      <h2>Daftar Pemilih MS (By Name)</h2>
      <div class="field-row">
        <div class="field"><label>Desa/Kelurahan</label><select id="ms-kelurahan"><option value="">Semua Desa/Kelurahan</option></select></div>
        <div class="field"><label>TPS</label><select id="ms-tps"><option value="">Semua TPS</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Cari Nama</label><input id="ms-nama" placeholder="Cari nama..." /></div>
        <div class="field"><label>Cari NIK</label><input id="ms-nik" placeholder="Cari NIK..." /></div>
        <div class="field" style="align-self:flex-end"><button class="btn btn-orange" id="btn-load-ms">Muat</button></div>
      </div>
      <div id="ms-hasil"></div>
    </div>
  `;
  const kecSel = qs("#ms-kecamatan", root), kelSel = qs("#ms-kelurahan", root), tpsSel = qs("#ms-tps", root);
  await populateKecamatanDropdown(kecSel);

  async function loadKecamatanSummaries() {
    const kecamatan = kecSel.value;
    const desaEl = qs("#ms-rekap-desa", root), disEl = qs("#ms-rekap-disabilitas", root);
    if (!kecamatan) {
      desaEl.innerHTML = `<div class="empty-state">Pilih kecamatan dulu.</div>`;
      disEl.innerHTML = `<div class="empty-state">Pilih kecamatan dulu.</div>`;
      return;
    }
    desaEl.innerHTML = `<div class="empty-state">Memuat...</div>`;
    disEl.innerHTML = `<div class="empty-state">Memuat...</div>`;
    const [rekapDesa, rekapDis] = await Promise.all([
      api(`/api/pemilih/rekap-desa?kecamatan=${encodeURIComponent(kecamatan)}`),
      api(`/api/pemilih/rekap-disabilitas?kecamatan=${encodeURIComponent(kecamatan)}`),
    ]);
    desaEl.innerHTML = rekapDesa.perDesa.length === 0 ? `<div class="empty-state">Belum ada data.</div>` : `
      <div class="stat-grid">${rekapDesa.perDesa.map((d) => `
        <div class="stat-box"><div class="num">${d.jumlah}</div><div class="label">${esc(d.kelurahan)}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:4px">L: ${d.laki} / P: ${d.perempuan}</div></div>
      `).join("")}</div>
    `;
    disEl.innerHTML = rekapDis.rekap.length === 0 ? `<div class="empty-state">Belum ada data disabilitas.</div>` : `
      <div class="stat-grid">${rekapDis.rekap.map((d) => `
        <div class="stat-box"><div class="num">${d.total}</div><div class="label">${esc(d.kelurahan)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${Object.values(d.breakdown).map((b) => `${esc(b.label)}: ${b.laki + b.perempuan}`).join("<br>")}</div></div>
      `).join("")}</div>
    `;
  }
  kecSel.addEventListener("change", async () => {
    await populateKelurahanDropdown(kelSel, kecSel.value);
    await populateTpsDropdown(tpsSel, kecSel.value, "");
    loadKecamatanSummaries();
  });
  kelSel.addEventListener("change", () => populateTpsDropdown(tpsSel, kecSel.value, kelSel.value));

  qs("#btn-load-ms", root).addEventListener("click", async () => {
    const kecamatan = kecSel.value;
    if (!kecamatan) return toast("Kecamatan wajib diisi", true);
    const params = new URLSearchParams({ kecamatan });
    if (kelSel.value) params.set("kelurahan", kelSel.value);
    if (tpsSel.value) params.set("tps", tpsSel.value);
    const nama = qs("#ms-nama", root).value.trim();
    const nik = qs("#ms-nik", root).value.trim();
    if (nama) params.set("nama", nama);
    if (nik) params.set("nik", nik);

    const hasilEl = qs("#ms-hasil", root);
    hasilEl.innerHTML = `<div class="empty-state">Memuat...</div>`;
    try {
      const data = await api(`/api/pemilih/pemilih-ms?${params.toString()}`);
      if (data.data.length === 0) { hasilEl.innerHTML = `<div class="empty-state">Tidak ada data.</div>`; return; }
      hasilEl.innerHTML = `
        <p style="font-size:12.5px;color:var(--muted)">Total: ${data.total} (halaman ${data.page})</p>
        <div class="table-scroll"><table>
          <thead><tr><th>Nama</th><th>NKK</th><th>NIK</th><th>Kelurahan</th><th>TPS</th><th>Kelamin</th></tr></thead>
          <tbody>${data.data.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.nkk)}</td><td>${esc(r.nik)}</td><td>${esc(r.kelurahan)}</td><td>${esc(r.tps)}</td><td>${esc(r.kelamin)}</td></tr>`).join("")}</tbody>
        </table></div>
      `;
    } catch (err) { hasilEl.innerHTML = `<p style="color:#c0392b">${esc(err.message)}</p>`; }
  });
}

// ================= MODUL UJI PETIK =================

async function renderUpChecklist(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Checklist 40 Prosedur (A-DPB1)</h2>
      <a class="btn btn-sm" href="/api/uji-petik/export?tabel=checklist_jawaban" style="float:right;margin-top:-32px">Unduh Excel (CSV)</a>
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

    let rowsHtml = "";
    let lastKategori = null;
    for (const item of CHECKLIST_ITEMS) {
      if (item.kategori !== lastKategori) {
        rowsHtml += `<tr><td colspan="4" style="background:var(--navy-100);font-weight:700;color:var(--navy-900)">${esc(item.kategori)}</td></tr>`;
        lastKategori = item.kategori;
      }
      const existing = data.jawaban[item.n] || {};
      rowsHtml += `<tr>
        <td>${item.n}</td>
        <td style="white-space:normal;min-width:320px">${esc(item.teks)}</td>
        <td><select data-n="${item.n}" class="chk-jawaban"><option value="">-</option><option value="Ya" ${existing.jawaban === "Ya" ? "selected" : ""}>Ya</option><option value="Tidak" ${existing.jawaban === "Tidak" ? "selected" : ""}>Tidak</option></select></td>
        <td><input data-n="${item.n}" class="chk-ket" value="${esc(existing.keterangan || "")}" placeholder="Jelaskan (wajib jika Tidak)" /></td>
      </tr>`;
    }

    body.innerHTML = `
      <div class="table-scroll" style="max-height:600px"><table>
        <thead><tr><th>No</th><th>Pertanyaan</th><th>Jawaban</th><th>Keterangan</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
      <button class="btn btn-orange" id="btn-save-checklist" style="margin-top:12px">Simpan Semua</button>
    `;
    qs("#btn-save-checklist", body).addEventListener("click", async () => {
      const jawaban = CHECKLIST_ITEMS.map((item) => ({
        nomor_item: item.n,
        jawaban: qs(`.chk-jawaban[data-n="${item.n}"]`, body).value || null,
        keterangan: qs(`.chk-ket[data-n="${item.n}"]`, body).value || null,
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
      <a class="btn btn-sm" href="/api/uji-petik/export?tabel=rekap_triwulan" style="float:right;margin-top:-32px">Unduh Excel (CSV)</a>
      <div class="field-row">
        <div class="field"><label>Triwulan</label><input id="up-rk-tw" placeholder="2026-Q1" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-rekap">Muat</button></div>
      </div>
      <div id="rekap-body"></div>
    </div>
    <div class="card">
      <h2>Input / Update Rekap 1 Kecamatan</h2>
      <p class="card-desc">Sesuai form resmi A-DPB2: PDPB Awal, 8 kategori TMS, 5 kategori Pemilih Baru masing-masing 1 angka total (tidak dipecah L/P). "Hasil Akhir" dipecah L/P dan diinput LANGSUNG dari angka resmi KPU (bukan dihitung aplikasi) -- aplikasi akan tampilkan "selisih" kalau angka ini beda dari hasil hitungan Awal-TMS+Baru, sebagai alat verifikasi.</p>
      <div class="field-row">
        <div class="field"><label>Triwulan</label><input id="in-tw" placeholder="2026-Q1" /></div>
        <div class="field"><label>Kecamatan</label><input id="in-kec" /></div>
      </div>
      <div class="table-scroll" style="max-height:none">
        <table id="rekap-grid-table">
          <thead><tr><th>Kategori</th><th>Jumlah</th></tr></thead>
          <tbody>
            <tr><td><b>PDPB Awal</b></td><td><input type="number" class="rk-input" data-field="pdpb_awal" value="0" /></td></tr>
            ${REKAP_TW_CATS.tms.map((c) => `<tr><td>TMS: ${esc(c.label)}</td><td><input type="number" class="rk-input" data-field="tms_${c.key}" value="0" /></td></tr>`).join("")}
            ${REKAP_TW_CATS.baru.map((c) => `<tr><td>Baru: ${esc(c.label)}</td><td><input type="number" class="rk-input" data-field="baru_${c.key}" value="0" /></td></tr>`).join("")}
            <tr><td><b>Hasil Akhir -- Laki-laki</b> (input langsung)</td><td><input type="number" class="rk-input" data-field="hasil_akhir_laki" value="0" /></td></tr>
            <tr><td><b>Hasil Akhir -- Perempuan</b> (input langsung)</td><td><input type="number" class="rk-input" data-field="hasil_akhir_perempuan" value="0" /></td></tr>
          </tbody>
        </table>
      </div>
      <button class="btn btn-orange" id="btn-save-rekap" style="margin-top:14px">Simpan</button>
    </div>
    <div class="card">
      <h2>Masukan &amp; Tanggapan Pleno (A-DPB3)</h2>
      <div class="field-row">
        <div class="field"><label>Triwulan</label><input id="mk-tw" placeholder="2026-Q1" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-masukan">Muat</button></div>
      </div>
      <div id="masukan-body"></div>
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0" />
      <div class="field-row">
        <div class="field"><label>Nama/Instansi/Unsur *</label><input id="mk-instansi" /></div>
        <div class="field" style="flex:2"><label>Masukan dan Tanggapan</label><input id="mk-masukan" /></div>
      </div>
      <div class="field-row">
        <div class="field" style="flex:2"><label>Tindak Lanjut/Tanggapan KPU Kabupaten/Kota</label><input id="mk-tindak" /></div>
        <div class="field"><label>Keterangan</label><input id="mk-ket" /></div>
      </div>
      <button class="btn btn-orange" id="btn-add-masukan">Tambah</button>
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
        <thead><tr><th>Kecamatan</th><th>PDPB Awal</th><th>Total TMS</th><th>Total Baru</th><th>Hasil Hitung</th><th>Hasil Akhir L/P (Total)</th><th>Selisih</th><th>Carry-forward?</th></tr></thead>
        <tbody>${data.rows.map((r) => `
          <tr>
            <td>${esc(r.kecamatan)}</td>
            <td>${r.pdpb_awal_total}</td>
            <td>${r.tms_total}</td>
            <td>${r.baru_total}</td>
            <td>${r.hasil_hitung_total}</td>
            <td>${r.hasil_akhir_laki} / ${r.hasil_akhir_perempuan} (${r.hasil_akhir_total})</td>
            <td style="${r.selisih !== 0 ? "color:var(--danger);font-weight:700" : ""}">${r.selisih}</td>
            <td>${r.carried_forward ? "Ya" : "-"}</td>
          </tr>`).join("")}</tbody>
      </table></div>
      <p style="margin-top:10px;font-size:13px"><b>Grand total Hasil Akhir:</b> ${data.grand.hasil_akhir_laki} L / ${data.grand.hasil_akhir_perempuan} P (${data.grand.hasil_akhir_total} total)</p>
    `;
  });
  qs("#btn-save-rekap", root).addEventListener("click", async () => {
    const triwulan = qs("#in-tw", root).value.trim();
    const kecamatan = qs("#in-kec", root).value.trim();
    if (!triwulan || !kecamatan) return toast("Triwulan dan kecamatan wajib diisi", true);
    const body = { triwulan, kecamatan };
    qsa(".rk-input", root).forEach((inp) => { body[inp.dataset.field] = Number(inp.value) || 0; });
    try {
      await api("/api/uji-petik/rekap-triwulan", { method: "POST", body: JSON.stringify(body) });
      toast("Rekap tersimpan");
    } catch (err) { toast(err.message, true); }
  });

  async function loadMasukan() {
    const tw = qs("#mk-tw", root).value.trim();
    if (!tw) return toast("Isi triwulan dulu", true);
    const data = await api(`/api/uji-petik/rekap-triwulan/masukan?triwulan=${encodeURIComponent(tw)}`);
    const body = qs("#masukan-body", root);
    if (data.data.length === 0) { body.innerHTML = `<div class="empty-state">Belum ada masukan/tanggapan pleno.</div>`; return; }
    body.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>Instansi</th><th>Masukan/Tanggapan</th><th>Tindak Lanjut</th><th>Keterangan</th><th></th></tr></thead>
        <tbody>${data.data.map((r) => `
          <tr>
            <td>${esc(r.nama_instansi)}</td><td>${esc(r.masukan_tanggapan)}</td>
            <td>${esc(r.tindak_lanjut)}</td><td>${esc(r.keterangan)}</td>
            <td><button class="btn btn-sm btn-danger" data-id="${r.id}">Hapus</button></td>
          </tr>`).join("")}</tbody>
      </table></div>
    `;
    qsa("button[data-id]", body).forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/uji-petik/rekap-triwulan/masukan?id=${btn.dataset.id}`, { method: "DELETE" });
          toast("Dihapus"); loadMasukan();
        } catch (err) { toast(err.message, true); }
      });
    });
  }
  qs("#btn-load-masukan", root).addEventListener("click", loadMasukan);
  qs("#btn-add-masukan", root).addEventListener("click", async () => {
    const triwulan = qs("#mk-tw", root).value.trim();
    const nama_instansi = qs("#mk-instansi", root).value.trim();
    if (!triwulan || !nama_instansi) return toast("Triwulan dan nama instansi wajib diisi", true);
    try {
      await api("/api/uji-petik/rekap-triwulan/masukan", {
        method: "POST",
        body: JSON.stringify({
          triwulan, nama_instansi,
          masukan_tanggapan: qs("#mk-masukan", root).value.trim(),
          tindak_lanjut: qs("#mk-tindak", root).value.trim(),
          keterangan: qs("#mk-ket", root).value.trim(),
        }),
      });
      toast("Masukan ditambahkan");
      qs("#mk-instansi", root).value = "";
      qs("#mk-masukan", root).value = "";
      qs("#mk-tindak", root).value = "";
      qs("#mk-ket", root).value = "";
      loadMasukan();
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
        <a class="btn btn-sm" href="/api/uji-petik/export?tabel=${prefix.replace("-", "_")}" style="float:right;margin-top:-32px">Unduh Excel (CSV)</a>
        <div class="field-row">
          <div class="field"><label>Periode (YYYY-MM)</label><input id="sp-periode" placeholder="2026-08" /></div>
          <div class="field"><label>Cari Nama</label><input id="sp-nama" placeholder="Cari nama..." /></div>
          <div class="field"><label>Cari NIK</label><input id="sp-nik" placeholder="Cari NIK..." /></div>
          <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-sampel">Muat</button></div>
        </div>
        <div id="sampel-list"></div>
      </div>
      <div class="card">
        <h2>Tambah Sampel (1 baris)</h2>
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
      <div class="card">
        <h2>Tempel dari Excel (banyak baris sekaligus)</h2>
        <p class="card-desc">Urutan kolom: Periode, Nama, NIK, Alamat, Kelurahan, Kecamatan, Kategori (${kategoriOptions.join("/")}), Status (Sesuai/Tidak Sesuai). Pisah kolom dengan Tab.</p>
        <textarea id="bulk-area" rows="4" placeholder="2026-08&#9;Nama&#9;NIK&#9;Alamat&#9;Kelurahan&#9;Kecamatan&#9;${kategoriOptions[0]}&#9;Sesuai"></textarea>
        <button class="btn" id="btn-preview-bulk" style="margin-top:10px">Pratinjau</button>
        <div id="bulk-preview" style="margin-top:12px"></div>
      </div>
    `;
    async function loadList() {
      const periode = qs("#sp-periode", root).value.trim();
      if (!periode) return toast("Isi periode dulu", true);
      const params = new URLSearchParams({ periode });
      const nama = qs("#sp-nama", root).value.trim();
      const nik = qs("#sp-nik", root).value.trim();
      if (nama) params.set("nama", nama);
      if (nik) params.set("nik", nik);
      const data = await api(`/api/uji-petik/${prefix}?${params.toString()}`);
      const listEl = qs("#sampel-list", root);
      if (data.data.length === 0) { listEl.innerHTML = `<div class="empty-state">Belum ada sampel di periode ini.</div>`; return; }
      listEl.innerHTML = `
        <div class="table-scroll"><table>
          <thead><tr><th>Nama</th><th>NIK</th><th>Kecamatan</th><th>Kategori</th><th>Status</th><th></th></tr></thead>
          <tbody>${data.data.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.nik)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.kategori)}</td><td>${esc(r.status)}</td><td><button class="btn btn-sm btn-danger" data-del="${r.id}">Hapus</button></td></tr>`).join("")}</tbody>
        </table></div>
      `;
      qsa("button[data-del]", listEl).forEach((btn) => {
        btn.addEventListener("click", async () => {
          try { await api(`/api/uji-petik/${prefix}?id=${btn.dataset.del}`, { method: "DELETE" }); toast("Dihapus"); loadList(); }
          catch (err) { toast(err.message, true); }
        });
      });
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

    // ---- Tempel dari Excel ----
    let bulkRows = [];
    qs("#btn-preview-bulk", root).addEventListener("click", () => {
      const raw = qs("#bulk-area", root).value;
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      bulkRows = lines.map((line) => {
        const [periode, nama, nik, alamat, kelurahan, kecamatan, kategori, status] = line.split("\t");
        return { periode, nama, nik, alamat, kelurahan, kecamatan, kategori, status };
      });
      const prevEl = qs("#bulk-preview", root);
      if (bulkRows.length === 0) { prevEl.innerHTML = `<div class="empty-state">Tidak ada baris.</div>`; return; }
      prevEl.innerHTML = `
        <p style="font-size:12.5px;color:var(--muted)">${bulkRows.length} baris siap disimpan (baris dengan kategori tidak valid akan dilewati otomatis).</p>
        <div class="table-scroll"><table>
          <thead><tr><th>Nama</th><th>Kecamatan</th><th>Kategori</th><th>Status</th></tr></thead>
          <tbody>${bulkRows.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.kategori)}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody>
        </table></div>
        <button class="btn btn-orange" id="btn-save-bulk" style="margin-top:10px">Simpan Semua (${bulkRows.length})</button>
      `;
      qs("#btn-save-bulk", prevEl).addEventListener("click", async () => {
        try {
          const data = await api(`/api/uji-petik/${prefix}/bulk`, { method: "POST", body: JSON.stringify({ rows: bulkRows }) });
          toast(`${data.inserted} baris tersimpan`);
          qs("#bulk-area", root).value = "";
          prevEl.innerHTML = "";
        } catch (err) { toast(err.message, true); }
      });
    });
  };
}

async function renderUpSampelDpb(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Sampel DPB (A-DPB8)</h2>
      <a class="btn btn-sm" href="/api/uji-petik/export?tabel=sampel_dpb" style="float:right;margin-top:-32px">Unduh Excel (CSV)</a>
      <div class="field-row">
        <div class="field"><label>Periode (YYYY-MM)</label><input id="dpb-periode" placeholder="2026-08" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-dpb">Muat</button></div>
      </div>
      <div id="dpb-list"></div>
    </div>
    <div class="card">
      <h2>Daftar Sampel DPB (By Name)</h2>
      <div class="field-row">
        <div class="field"><label>Cari Nama</label><input id="dpb-nama" placeholder="Cari nama..." /></div>
        <div class="field"><label>Cari NIK</label><input id="dpb-nik" placeholder="Cari NIK..." /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-dpb-list">Muat</button></div>
      </div>
      <div id="dpb-list-byname"></div>
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
  async function loadDpbList() {
    const periode = qs("#dpb-periode", root).value.trim();
    if (!periode) return toast("Isi periode dulu (di kartu atas)", true);
    const params = new URLSearchParams({ periode });
    const nama = qs("#dpb-nama", root).value.trim();
    const nik = qs("#dpb-nik", root).value.trim();
    if (nama) params.set("nama", nama);
    if (nik) params.set("nik", nik);
    const listEl = qs("#dpb-list-byname", root);
    listEl.innerHTML = `<div class="empty-state">Memuat...</div>`;
    const data = await api(`/api/uji-petik/sampel-dpb?${params.toString()}`);
    if (data.data.length === 0) { listEl.innerHTML = `<div class="empty-state">Belum ada sampel di periode ini.</div>`; return; }
    listEl.innerHTML = `
      <div class="table-scroll"><table>
        <thead><tr><th>Nama</th><th>NIK</th><th>Kecamatan</th><th>Hasil</th><th>Kategori</th><th></th></tr></thead>
        <tbody>${data.data.map((r) => `<tr><td>${esc(r.nama)}</td><td>${esc(r.nik)}</td><td>${esc(r.kecamatan)}</td><td>${esc(r.hasil)}</td><td>${esc(r.kategori_tidak_sesuai)}</td><td><button class="btn btn-sm btn-danger" data-del="${r.id}">Hapus</button></td></tr>`).join("")}</tbody>
      </table></div>
    `;
    qsa("button[data-del]", listEl).forEach((btn) => {
      btn.addEventListener("click", async () => {
        try { await api(`/api/uji-petik/sampel-dpb?id=${btn.dataset.del}`, { method: "DELETE" }); toast("Dihapus"); loadDpbList(); }
        catch (err) { toast(err.message, true); }
      });
    });
  }
  qs("#btn-load-dpb", root).addEventListener("click", loadDpb);
  qs("#btn-load-dpb-list", root).addEventListener("click", loadDpbList);
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
  async function renderKabupatenLevel() {
    const data = await api("/api/uji-petik/infografis/kabupaten");
    root.innerHTML = `
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${data.desaDiujiPetik}</div><div class="label">Desa Diuji Petik</div></div>
        <div class="stat-box"><div class="num">${data.totalMsDiujiPetik}</div><div class="label">Total Sampel MS</div></div>
        <div class="stat-box"><div class="num">${data.totalTmsDiujiPetik}</div><div class="label">Total Sampel TMS</div></div>
      </div>
      <div class="card">
        <h2>Peta Hasil Akhir per Kecamatan (Triwulan Terakhir: ${esc(data.triwulan || "-")})</h2>
        <p class="card-desc">Klik kecamatan di peta untuk lihat detail uji petik kecamatan tersebut.</p>
        <div id="map-kabupaten-ujipetik"></div>
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

    if (data.perKecamatan.length > 0) {
      const dataByName = {};
      for (const k of data.perKecamatan) dataByName[k.kecamatan] = { value: k.total, laki: k.laki, perempuan: k.perempuan };
      renderChoroplethMap(
        "map-kabupaten-ujipetik",
        `/geojson/${state.user.kabkota}.geojson`,
        dataByName,
        { nameProp: "kecamatan", onFeatureClick: (nama) => renderKecamatanLevel(nama), buttonLabel: "Lihat Detail Uji Petik" }
      );
    } else {
      qs("#map-kabupaten-ujipetik", root).innerHTML = `<div class="empty-state">Belum ada data untuk ditampilkan di peta.</div>`;
    }
  }

  async function renderKecamatanLevel(kecamatan) {
    root.innerHTML = `<div class="empty-state">Memuat detail ${esc(kecamatan)}...</div>`;
    const d = await api(`/api/uji-petik/infografis/kecamatan?nama=${encodeURIComponent(kecamatan)}`);
    root.innerHTML = `
      <div class="card">
        <button class="btn btn-sm" id="btn-back-up-kab" style="margin-bottom:12px">&larr; Kembali ke Kabupaten/Kota</button>
        <h2 style="font-size:18px">UJI PETIK KECAMATAN ${esc(kecamatan.toUpperCase())}</h2>
        <p class="card-desc" style="margin-bottom:0">Triwulan terakhir: ${esc(d.triwulan || "-")} -- Hasil Akhir: ${d.laki} L / ${d.perempuan} P (${d.total} total)</p>
      </div>
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${d.desaDiujiPetik}</div><div class="label">Desa Diuji Petik</div></div>
        <div class="stat-box"><div class="num">${d.totalMsDiujiPetik}</div><div class="label">Sampel MS</div></div>
        <div class="stat-box"><div class="num">${d.totalTmsDiujiPetik}</div><div class="label">Sampel TMS</div></div>
      </div>
      <div class="card">
        <h2>Sebaran Sampel TMS per Kategori</h2>
        ${d.kategoriTms.every((k) => k.jumlah === 0) ? `<div class="empty-state">Belum ada data.</div>` : d.kategoriTms.filter((k) => k.jumlah > 0).map((k) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12.5px">
            <span style="width:180px">${esc(k.label)}</span>
            <div style="flex:1;background:var(--navy-100);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${Math.min(100, (k.jumlah / (d.totalTmsDiujiPetik || 1)) * 100)}%;background:var(--danger);height:100%"></div>
            </div>
            <span style="width:50px;text-align:right;font-weight:600">${k.jumlah}</span>
          </div>
        `).join("")}
      </div>
      <div class="card">
        <h2>Sebaran Sampel Pemilih Baru per Kategori</h2>
        ${d.kategoriMs.every((k) => k.jumlah === 0) ? `<div class="empty-state">Belum ada data.</div>` : d.kategoriMs.filter((k) => k.jumlah > 0).map((k) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:12.5px">
            <span style="width:180px">${esc(k.label)}</span>
            <div style="flex:1;background:var(--navy-100);border-radius:4px;height:14px;overflow:hidden">
              <div style="width:${Math.min(100, (k.jumlah / (d.totalMsDiujiPetik || 1)) * 100)}%;background:var(--orange-500);height:100%"></div>
            </div>
            <span style="width:50px;text-align:right;font-weight:600">${k.jumlah}</span>
          </div>
        `).join("")}
      </div>
      <div class="card">
        <h2>Perbandingan Antar Triwulan</h2>
        ${d.triwulanComparison.length === 0 ? `<div class="empty-state">Belum ada data.</div>` : `
        <div class="table-scroll"><table><thead><tr><th>Triwulan</th><th>Laki-laki</th><th>Perempuan</th><th>Total</th></tr></thead>
        <tbody>${d.triwulanComparison.map((t) => `<tr><td>${esc(t.triwulan)}</td><td>${t.laki}</td><td>${t.perempuan}</td><td>${t.total}</td></tr>`).join("")}</tbody></table></div>`}
      </div>
    `;
    qs("#btn-back-up-kab", root).addEventListener("click", renderKabupatenLevel);
  }

  await renderKabupatenLevel();
}

// ================= MODUL PROVINSI =================

async function renderProvinsiRekap(root) {
  root.innerHTML = `<div class="empty-state">Memuat ringkasan seluruh Jawa Timur...</div>`;
  let data;
  try {
    data = await api("/api/provinsi/ringkasan");
  } catch (err) {
    root.innerHTML = `<div class="card"><p style="color:#c0392b">${esc(err.message)}</p></div>`;
    return;
  }

  root.innerHTML = `
    <div class="card">
      <h2 style="font-size:20px">INFOGRAFIS HASIL PENGAWASAN DATA PEMILIH BERKELANJUTAN</h2>
      <p class="card-desc" style="margin-bottom:0">Bawaslu Provinsi Jawa Timur -- agregat langsung dari ${data.jumlahKabkota} kab/kota</p>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${data.totalPemilih.toLocaleString("id-ID")}</div><div class="label">Total Pemilih (MS)</div></div>
      <div class="stat-box"><div class="num">${data.totalLaki.toLocaleString("id-ID")}</div><div class="label">Laki-laki</div></div>
      <div class="stat-box"><div class="num">${data.totalPerempuan.toLocaleString("id-ID")}</div><div class="label">Perempuan</div></div>
      <div class="stat-box" style="background:#fdeceb"><div class="num" style="color:var(--danger)">${data.totalTms.toLocaleString("id-ID")}</div><div class="label">Total TMS</div></div>
      <div class="stat-box"><div class="num">${data.totalDisabilitas.toLocaleString("id-ID")}</div><div class="label">Total Disabilitas</div></div>
    </div>
    ${data.gagal.length ? `
    <div class="card" style="border-color:var(--danger)">
      <p style="color:var(--danger);font-size:12.5px;margin:0">Gagal memuat data dari ${data.gagal.length} kab/kota: ${data.gagal.map((g) => esc(g.nama)).join(", ")}</p>
    </div>` : ""}
    <div class="card">
      <h2>Peta Sebaran Pemilih per Kabupaten/Kota</h2>
      <p class="card-desc">Klik kab/kota di peta untuk lihat ringkasannya.</p>
      <div id="map-provinsi-pemilih"></div>
    </div>
    <div class="card">
      <h2>Sebaran Pemilih per Kabupaten/Kota</h2>
      <p class="card-desc">Diurutkan dari jumlah pemilih terbanyak. Kab/kota yang belum mulai input akan tampil 0.</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Kabupaten/Kota</th><th>Laki-laki</th><th>Perempuan</th><th>Total</th><th>TMS</th></tr></thead>
        <tbody>${data.perKabkota.map((k) => `
          <tr>
            <td>${esc(k.nama)}</td>
            <td>${k.laki.toLocaleString("id-ID")}</td>
            <td>${k.perempuan.toLocaleString("id-ID")}</td>
            <td><b>${(k.laki + k.perempuan).toLocaleString("id-ID")}</b></td>
            <td>${k.tms.toLocaleString("id-ID")}</td>
          </tr>`).join("")}</tbody>
      </table></div>
    </div>
    <div class="card">
      <button class="btn" id="btn-refresh-prov">Muat Ulang</button>
    </div>
  `;
  const dataByKode = {};
  for (const k of data.perKabkota) dataByKode[k.kode] = { value: k.laki + k.perempuan, laki: k.laki, perempuan: k.perempuan };
  renderChoroplethMap("map-provinsi-pemilih", "/geojson/jatim-kabkota.geojson", dataByKode, { nameProp: "kode", displayProp: "kab_kota" });

  qs("#btn-refresh-prov", root).addEventListener("click", () => renderProvinsiRekap(root));
}

function currentTriwulan() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}

function triwulanOptions(fromYear = 2025, fromQ = 1) {
  const [curYear, curQ] = currentTriwulan().split("-Q").map(Number);
  const list = [];
  let y = fromYear, q = fromQ;
  while (y < curYear || (y === curYear && q <= curQ)) {
    list.push(`${y}-Q${q}`);
    q++; if (q > 4) { q = 1; y++; }
  }
  return list.reverse(); // terbaru duluan
}

async function renderProvinsiUjiPetik(root, selectedTriwulan) {
  const triwulan = selectedTriwulan || currentTriwulan();
  root.innerHTML = `<div class="empty-state">Memuat ringkasan Uji Petik triwulan ${esc(triwulan)}...</div>`;
  let data;
  try {
    data = await api(`/api/provinsi/ringkasan-uji-petik?triwulan=${encodeURIComponent(triwulan)}`);
  } catch (err) {
    root.innerHTML = `<div class="card"><p style="color:#c0392b">${esc(err.message)}</p></div>`;
    return;
  }

  const options = triwulanOptions();
  root.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="font-size:20px">REKAP UJI PETIK PDPB</h2>
          <p class="card-desc" style="margin-bottom:0">Bawaslu Provinsi Jawa Timur -- agregat langsung dari ${data.jumlahKabkota} kab/kota</p>
        </div>
        <div class="field" style="max-width:200px">
          <label>Triwulan</label>
          <select id="prov-up-triwulan">
            ${options.map((tw) => `<option value="${tw}" ${tw === triwulan ? "selected" : ""}>${tw}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${data.kabkotaSudahMulaiChecklist} / ${data.jumlahKabkota}</div><div class="label">Kab/Kota Sudah Isi Checklist</div></div>
      <div class="stat-box"><div class="num">${data.totalSampelTms.toLocaleString("id-ID")}</div><div class="label">Total Sampel TMS (A-DPB5)</div></div>
      <div class="stat-box"><div class="num">${data.totalSampelMs.toLocaleString("id-ID")}</div><div class="label">Total Sampel Pemilih Baru (A-DPB7)</div></div>
      <div class="stat-box"><div class="num">${data.totalSampelDpb.toLocaleString("id-ID")}</div><div class="label">Total Sampel DPB (A-DPB8)</div></div>
      <div class="stat-box"><div class="num">${data.totalHasilAkhir.toLocaleString("id-ID")}</div><div class="label">Total Hasil Akhir Triwulan ${esc(triwulan)}</div></div>
    </div>
    ${data.gagal.length ? `
    <div class="card" style="border-color:var(--danger)">
      <p style="color:var(--danger);font-size:12.5px;margin:0">Gagal memuat data dari ${data.gagal.length} kab/kota: ${data.gagal.map((g) => esc(g.nama)).join(", ")}</p>
    </div>` : ""}
    <div class="card">
      <h2>Rincian per Kabupaten/Kota -- Triwulan ${esc(triwulan)}</h2>
      <p class="card-desc">Diurutkan dari total sampel terbanyak di triwulan ini. Sampel TMS/Baru/DPB dihitung dari 3 bulan yang termasuk triwulan ini.</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Kabupaten/Kota</th><th>Checklist Terisi</th><th>Sampel TMS</th><th>Sampel Baru</th><th>Sampel DPB</th><th>Rekap Triwulan?</th><th>Hasil Akhir (L/P)</th></tr></thead>
        <tbody>${data.perKabkota.map((k) => `
          <tr>
            <td>${esc(k.nama)}</td>
            <td>${k.checklistTerisi} / 40</td>
            <td>${k.sampelTms}</td>
            <td>${k.sampelMs}</td>
            <td>${k.sampelDpb} (${k.sampelDpbSesuai} sesuai)</td>
            <td>${k.adaRekapTriwulan ? "Sudah" : "Belum"}</td>
            <td>${k.hasilLaki} / ${k.hasilPerempuan}</td>
          </tr>`).join("")}</tbody>
      </table></div>
    </div>
    <div class="card">
      <button class="btn" id="btn-refresh-prov-up">Muat Ulang</button>
    </div>
  `;
  qs("#prov-up-triwulan", root).addEventListener("change", (e) => renderProvinsiUjiPetik(root, e.target.value));
  qs("#btn-refresh-prov-up", root).addEventListener("click", () => renderProvinsiUjiPetik(root, triwulan));
}

// ---------- Routing table ----------
// ================= MODUL DOKUMEN PENGAWASAN =================

const BULAN_NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DOKUMEN_LABELS = { saran_perbaikan: "Saran Perbaikan", imbauan: "Imbauan", form_a: "Form A" };

async function apiUpload(path, formData) {
  const res = await fetch(path, { method: "POST", credentials: "include", body: formData });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) throw new Error((data && data.error) || `Upload gagal (${res.status})`);
  return data;
}

function formatUkuran(bytes) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderDokumenSection(kategori) {
  return async function (root) {
    const label = DOKUMEN_LABELS[kategori];
    const now = new Date();
    let selectedTahun = now.getFullYear();

    root.innerHTML = `
      <div class="card">
        <h2>Upload Dokumen ${esc(label)}</h2>
        <p class="card-desc">Maksimal 5MB per file. Dokumen otomatis disusun per folder Tahun &gt; Bulan.</p>
        <div class="field-row">
          <div class="field"><label>Tahun</label><input id="dok-up-tahun" type="number" value="${now.getFullYear()}" /></div>
          <div class="field"><label>Bulan</label>
            <select id="dok-up-bulan">${BULAN_NAMA.map((b, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${b}</option>`).join("")}</select>
          </div>
          <div class="field" style="flex:2"><label>Keterangan (opsional)</label><input id="dok-up-keterangan" /></div>
        </div>
        <div class="field-row">
          <div class="field" style="flex:2"><label>File</label><input id="dok-up-file" type="file" /></div>
          <div class="field" style="align-self:flex-end"><button class="btn btn-orange" id="btn-upload-dok">Upload</button></div>
        </div>
      </div>
      <div class="card">
        <h2>Folder Tahun</h2>
        <div class="field-row">
          <div class="field" style="max-width:200px"><label>Pilih Tahun</label><input id="dok-tahun-filter" type="number" value="${now.getFullYear()}" /></div>
          <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-dok-tahun">Muat</button></div>
        </div>
        <div id="dok-bulan-grid"></div>
      </div>
      <div id="dok-file-list"></div>
    `;

    let allDocs = [];
    async function loadTahun() {
      selectedTahun = Number(qs("#dok-tahun-filter", root).value) || now.getFullYear();
      const data = await api(`/api/dokumen?kategori=${kategori}`);
      allDocs = data.data;
      const gridEl = qs("#dok-bulan-grid", root);
      const countByBulan = {};
      for (const d of allDocs) {
        if (d.tahun !== selectedTahun) continue;
        countByBulan[d.bulan] = (countByBulan[d.bulan] || 0) + 1;
      }
      gridEl.innerHTML = `
        <div class="stat-grid">
          ${BULAN_NAMA.map((b, i) => `
            <div class="stat-box folder-bulan" data-bulan="${i + 1}" style="cursor:pointer">
              <div class="num">${countByBulan[i + 1] || 0}</div>
              <div class="label">${b} ${selectedTahun}</div>
            </div>
          `).join("")}
        </div>
      `;
      qsa(".folder-bulan", gridEl).forEach((box) => {
        box.addEventListener("click", () => showFileList(Number(box.dataset.bulan)));
      });
      qs("#dok-file-list", root).innerHTML = "";
    }

    function showFileList(bulan) {
      const files = allDocs.filter((d) => d.tahun === selectedTahun && d.bulan === bulan);
      const listEl = qs("#dok-file-list", root);
      listEl.innerHTML = `
        <div class="card">
          <h2>${esc(label)} -- ${BULAN_NAMA[bulan - 1]} ${selectedTahun}</h2>
          ${files.length === 0 ? `<div class="empty-state">Belum ada dokumen di folder ini.</div>` : `
          <div class="table-scroll"><table>
            <thead><tr><th>Nama File</th><th>Ukuran</th><th>Keterangan</th><th>Diupload Oleh</th><th>Tanggal</th><th></th></tr></thead>
            <tbody>${files.map((f) => `
              <tr>
                <td>${esc(f.nama_file)}</td>
                <td>${formatUkuran(f.ukuran)}</td>
                <td>${esc(f.keterangan || "-")}</td>
                <td>${esc(f.diupload_oleh)}</td>
                <td>${esc(f.diupload_pada)}</td>
                <td>
                  <a class="btn btn-sm" href="/api/dokumen/download?id=${f.id}" target="_blank">Unduh</a>
                  <button class="btn btn-sm btn-danger" data-del-dok="${f.id}">Hapus</button>
                </td>
              </tr>`).join("")}</tbody>
          </table></div>`}
        </div>
      `;
      qsa("[data-del-dok]", listEl).forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await api(`/api/dokumen?id=${btn.dataset.delDok}`, { method: "DELETE" });
            toast("Dokumen dihapus");
            await loadTahun();
            showFileList(bulan);
          } catch (err) { toast(err.message, true); }
        });
      });
    }

    qs("#btn-load-dok-tahun", root).addEventListener("click", loadTahun);
    qs("#btn-upload-dok", root).addEventListener("click", async () => {
      const fileInput = qs("#dok-up-file", root);
      const file = fileInput.files[0];
      if (!file) return toast("Pilih file dulu", true);
      const fd = new FormData();
      fd.append("kategori", kategori);
      fd.append("tahun", qs("#dok-up-tahun", root).value);
      fd.append("bulan", qs("#dok-up-bulan", root).value);
      fd.append("keterangan", qs("#dok-up-keterangan", root).value);
      fd.append("file", file);
      try {
        await apiUpload("/api/dokumen", fd);
        toast("Dokumen berhasil diupload");
        fileInput.value = "";
        qs("#dok-up-keterangan", root).value = "";
        await loadTahun();
      } catch (err) { toast(err.message, true); }
    });

    await loadTahun();
  };
}

async function renderProvinsiDokumen(root) {
  root.innerHTML = `<div class="empty-state">Memuat rekap dokumen seluruh Jawa Timur...</div>`;
  let data;
  try {
    data = await api("/api/provinsi/dokumen-rekap");
  } catch (err) {
    root.innerHTML = `<div class="card"><p style="color:#c0392b">${esc(err.message)}</p></div>`;
    return;
  }

  root.innerHTML = `
    <div class="card">
      <h2 style="font-size:20px">REKAP DOKUMEN PENGAWASAN</h2>
      <p class="card-desc" style="margin-bottom:0">Bawaslu Provinsi Jawa Timur -- jumlah dokumen per kab/kota dari ${data.jumlahKabkota} daerah. Klik angka untuk lihat/unduh dokumennya.</p>
    </div>
    <div class="card">
      <div class="table-scroll"><table>
        <thead><tr><th>No</th><th>Kabupaten/Kota</th><th>Imbauan</th><th>Saran Perbaikan</th><th>Form A</th></tr></thead>
        <tbody>${data.perKabkota.map((k, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(k.nama)}</td>
            <td>${k.imbauan > 0 ? `<a href="#" class="dok-count-link" data-kode="${k.kode}" data-kategori="imbauan" data-nama="${esc(k.nama)}">${k.imbauan}</a>` : "0"}</td>
            <td>${k.saran_perbaikan > 0 ? `<a href="#" class="dok-count-link" data-kode="${k.kode}" data-kategori="saran_perbaikan" data-nama="${esc(k.nama)}">${k.saran_perbaikan}</a>` : "0"}</td>
            <td>${k.form_a > 0 ? `<a href="#" class="dok-count-link" data-kode="${k.kode}" data-kategori="form_a" data-nama="${esc(k.nama)}">${k.form_a}</a>` : "0"}</td>
          </tr>`).join("")}</tbody>
      </table></div>
    </div>
  `;
  qsa(".dok-count-link", root).forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      renderProvinsiDokumenDetail(root, link.dataset.kode, link.dataset.kategori, link.dataset.nama);
    });
  });
}

async function renderProvinsiDokumenDetail(root, kode, kategori, namaKabkota) {
  root.innerHTML = `<div class="empty-state">Memuat dokumen ${esc(namaKabkota)}...</div>`;
  const data = await api(`/api/provinsi/dokumen?kode=${encodeURIComponent(kode)}&kategori=${kategori}`);
  const allDocs = data.data;
  const years = [...new Set(allDocs.map((d) => d.tahun))].sort((a, b) => b - a);
  let selectedTahun = years[0] || new Date().getFullYear();

  root.innerHTML = `
    <div class="card">
      <button class="btn btn-sm" id="btn-back-prov-dok" style="margin-bottom:12px">&larr; Kembali ke Rekap Dokumen</button>
      <h2 style="font-size:18px">${esc(DOKUMEN_LABELS[kategori])} -- ${esc(namaKabkota)}</h2>
      <div class="field-row">
        <div class="field" style="max-width:200px"><label>Pilih Tahun</label>
          <select id="prov-dok-tahun">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>
        </div>
      </div>
      <div id="prov-dok-bulan-grid"></div>
    </div>
    <div id="prov-dok-file-list"></div>
  `;
  qs("#btn-back-prov-dok", root).addEventListener("click", () => renderProvinsiDokumen(root));

  function renderBulanGrid() {
    selectedTahun = Number(qs("#prov-dok-tahun", root).value);
    const countByBulan = {};
    for (const d of allDocs) {
      if (d.tahun !== selectedTahun) continue;
      countByBulan[d.bulan] = (countByBulan[d.bulan] || 0) + 1;
    }
    qs("#prov-dok-bulan-grid", root).innerHTML = `
      <div class="stat-grid">
        ${BULAN_NAMA.map((b, i) => `
          <div class="stat-box folder-bulan" data-bulan="${i + 1}" style="cursor:pointer">
            <div class="num">${countByBulan[i + 1] || 0}</div>
            <div class="label">${b} ${selectedTahun}</div>
          </div>
        `).join("")}
      </div>
    `;
    qsa(".folder-bulan", root).forEach((box) => {
      box.addEventListener("click", () => showFileList(Number(box.dataset.bulan)));
    });
    qs("#prov-dok-file-list", root).innerHTML = "";
  }

  function showFileList(bulan) {
    const files = allDocs.filter((d) => d.tahun === selectedTahun && d.bulan === bulan);
    qs("#prov-dok-file-list", root).innerHTML = `
      <div class="card">
        <h2>${esc(DOKUMEN_LABELS[kategori])} -- ${BULAN_NAMA[bulan - 1]} ${selectedTahun}</h2>
        ${files.length === 0 ? `<div class="empty-state">Belum ada dokumen di folder ini.</div>` : `
        <div class="table-scroll"><table>
          <thead><tr><th>Nama File</th><th>Ukuran</th><th>Keterangan</th><th>Diupload Oleh</th><th>Tanggal</th><th></th></tr></thead>
          <tbody>${files.map((f) => `
            <tr>
              <td>${esc(f.nama_file)}</td>
              <td>${formatUkuran(f.ukuran)}</td>
              <td>${esc(f.keterangan || "-")}</td>
              <td>${esc(f.diupload_oleh)}</td>
              <td>${esc(f.diupload_pada)}</td>
              <td><a class="btn btn-sm" href="/api/provinsi/dokumen/download?kode=${kode}&id=${f.id}" target="_blank">Unduh</a></td>
            </tr>`).join("")}</tbody>
        </table></div>`}
      </div>
    `;
  }

  qs("#prov-dok-tahun", root).addEventListener("change", renderBulanGrid);
  if (years.length === 0) {
    qs("#prov-dok-bulan-grid", root).innerHTML = `<div class="empty-state">Belum ada dokumen.</div>`;
  } else {
    renderBulanGrid();
  }
}

// Dokumen Pengawasan milik PROVINSI sendiri -- 1 halaman, dengan selektor kategori di atas
// (beda dari kab/kota yang punya 3 tab menu atas terpisah per kategori), karena provinsi cuma
// punya 1 slot tab di sidebar untuk ini. Disimpan di database central, bukan kabkota manapun.
async function renderProvinsiDokumenProp(root) {
  let kategori = "saran_perbaikan";
  const now = new Date();
  let selectedTahun = now.getFullYear();
  let allDocs = [];

  async function loadKategori() {
    kategori = qs("#propdok-kategori", root).value;
    const data = await api(`/api/provinsi/dokumen-prop?kategori=${kategori}`);
    allDocs = data.data;
    renderBulanGrid();
  }

  function renderBulanGrid() {
    selectedTahun = Number(qs("#propdok-tahun", root).value) || now.getFullYear();
    const countByBulan = {};
    for (const d of allDocs) {
      if (d.tahun !== selectedTahun) continue;
      countByBulan[d.bulan] = (countByBulan[d.bulan] || 0) + 1;
    }
    qs("#propdok-bulan-grid", root).innerHTML = `
      <div class="stat-grid">
        ${BULAN_NAMA.map((b, i) => `
          <div class="stat-box folder-bulan" data-bulan="${i + 1}" style="cursor:pointer">
            <div class="num">${countByBulan[i + 1] || 0}</div>
            <div class="label">${b} ${selectedTahun}</div>
          </div>
        `).join("")}
      </div>
    `;
    qsa(".folder-bulan", root).forEach((box) => {
      box.addEventListener("click", () => showFileList(Number(box.dataset.bulan)));
    });
    qs("#propdok-file-list", root).innerHTML = "";
  }

  function showFileList(bulan) {
    const files = allDocs.filter((d) => d.tahun === selectedTahun && d.bulan === bulan);
    qs("#propdok-file-list", root).innerHTML = `
      <div class="card">
        <h2>${esc(DOKUMEN_LABELS[kategori])} -- ${BULAN_NAMA[bulan - 1]} ${selectedTahun}</h2>
        ${files.length === 0 ? `<div class="empty-state">Belum ada dokumen di folder ini.</div>` : `
        <div class="table-scroll"><table>
          <thead><tr><th>Nama File</th><th>Ukuran</th><th>Keterangan</th><th>Diupload Oleh</th><th>Tanggal</th><th></th></tr></thead>
          <tbody>${files.map((f) => `
            <tr>
              <td>${esc(f.nama_file)}</td>
              <td>${formatUkuran(f.ukuran)}</td>
              <td>${esc(f.keterangan || "-")}</td>
              <td>${esc(f.diupload_oleh)}</td>
              <td>${esc(f.diupload_pada)}</td>
              <td>
                <a class="btn btn-sm" href="/api/provinsi/dokumen-prop/download?id=${f.id}" target="_blank">Unduh</a>
                <button class="btn btn-sm btn-danger" data-del-propdok="${f.id}">Hapus</button>
              </td>
            </tr>`).join("")}</tbody>
        </table></div>`}
      </div>
    `;
    qsa("[data-del-propdok]", root).forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/api/provinsi/dokumen-prop?id=${btn.dataset.delPropdok}`, { method: "DELETE" });
          toast("Dokumen dihapus");
          await loadKategori();
          showFileList(bulan);
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  root.innerHTML = `
    <div class="card">
      <h2>Upload Dokumen Pengawasan Provinsi</h2>
      <p class="card-desc">Maksimal 5MB per file. Dokumen milik provinsi sendiri, terpisah dari dokumen tiap kab/kota.</p>
      <div class="field-row">
        <div class="field"><label>Kategori</label>
          <select id="propdok-kategori-upload">
            <option value="saran_perbaikan">Saran Perbaikan</option>
            <option value="imbauan">Imbauan</option>
            <option value="form_a">Form A</option>
          </select>
        </div>
        <div class="field"><label>Tahun</label><input id="propdok-up-tahun" type="number" value="${now.getFullYear()}" /></div>
        <div class="field"><label>Bulan</label>
          <select id="propdok-up-bulan">${BULAN_NAMA.map((b, i) => `<option value="${i + 1}" ${i + 1 === now.getMonth() + 1 ? "selected" : ""}>${b}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field" style="flex:2"><label>Keterangan (opsional)</label><input id="propdok-up-keterangan" /></div>
        <div class="field" style="flex:2"><label>File</label><input id="propdok-up-file" type="file" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn btn-orange" id="btn-upload-propdok">Upload</button></div>
      </div>
    </div>
    <div class="card">
      <h2>Lihat Folder</h2>
      <div class="field-row">
        <div class="field"><label>Kategori</label>
          <select id="propdok-kategori">
            <option value="saran_perbaikan">Saran Perbaikan</option>
            <option value="imbauan">Imbauan</option>
            <option value="form_a">Form A</option>
          </select>
        </div>
        <div class="field" style="max-width:200px"><label>Tahun</label><input id="propdok-tahun" type="number" value="${now.getFullYear()}" /></div>
        <div class="field" style="align-self:flex-end"><button class="btn" id="btn-load-propdok">Muat</button></div>
      </div>
      <div id="propdok-bulan-grid"></div>
    </div>
    <div id="propdok-file-list"></div>
  `;

  qs("#btn-load-propdok", root).addEventListener("click", loadKategori);
  qs("#btn-upload-propdok", root).addEventListener("click", async () => {
    const fileInput = qs("#propdok-up-file", root);
    const file = fileInput.files[0];
    if (!file) return toast("Pilih file dulu", true);
    const fd = new FormData();
    fd.append("kategori", qs("#propdok-kategori-upload", root).value);
    fd.append("tahun", qs("#propdok-up-tahun", root).value);
    fd.append("bulan", qs("#propdok-up-bulan", root).value);
    fd.append("keterangan", qs("#propdok-up-keterangan", root).value);
    fd.append("file", file);
    try {
      await apiUpload("/api/provinsi/dokumen-prop", fd);
      toast("Dokumen berhasil diupload");
      fileInput.value = "";
      qs("#propdok-up-keterangan", root).value = "";
      if (qs("#propdok-kategori", root).value === qs("#propdok-kategori-upload", root).value) await loadKategori();
    } catch (err) { toast(err.message, true); }
  });

  await loadKategori();
}

const SECTION_RENDERERS = {
  "pemilih-cari": renderPemilihCari,
  "pemilih-input": renderPemilihInput,
  "pemilih-statistik": renderPemilihStatistik,
  "pemilih-tms": renderPemilihTms,
  "pemilih-ms": renderPemilihMs,
  "up-checklist": renderUpChecklist,
  "up-rekap": renderUpRekap,
  "up-sampel-tms": renderSampelSection("tms"),
  "up-sampel-ms": renderSampelSection("ms"),
  "up-sampel-dpb": renderUpSampelDpb,
  "up-infografis": renderUpInfografis,
  "dok-saran_perbaikan": renderDokumenSection("saran_perbaikan"),
  "dok-imbauan": renderDokumenSection("imbauan"),
  "dok-form_a": renderDokumenSection("form_a"),
  "provinsi-rekap": renderProvinsiRekap,
  "provinsi-uji-petik": renderProvinsiUjiPetik,
  "provinsi-dokumen-rekap": renderProvinsiDokumen,
  "provinsi-dokumen-prop": renderProvinsiDokumenProp,
};

// ---------- Init ----------
tryRestoreSession();
