/**
 * 生成「原始日志下载」标注原型（单文件自包含 HTML）。
 *
 * 设计依据：docs/模块1-日志检索与分析/03-原始日志下载.md
 * 视觉令牌：docs/05-视觉与交互规范.md（AntD 5 语汇 · 高级绿 #2F7D5A · 圆角 6px）
 * 生成框架：~/.claude/skills/annotated-prototype（只替换 4 个占位符）
 *
 * 用法：node build-03.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototype, writePrototype } from '/Users/xuejianming/.claude/skills/annotated-prototype/tests/lib/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '原始日志下载-annotated-prototype.html');
const SKILL = 'annotated-prototype/spec@1';

/* ───────────────────────── 列表列定义（唯一事实源：表头 + 规格清单同源）───────────────────────── */
const COLUMNS = [
  { key: 'env', label: 'Environment', align: 'left', format: 'text' },
  { key: 'hostIp', label: 'Host IP', align: 'left', format: 'text' },
  { key: 'serverCategory', label: 'Server Category', align: 'left', format: 'text' },
  { key: 'startTime', label: 'Start Time', align: 'left', format: 'datetime-ms', note: '该文件命中行的最早 LOG_TIME' },
  { key: 'endTime', label: 'End Time', align: 'left', format: 'datetime-ms', note: '该文件命中行的最晚 LOG_TIME' },
  { key: 'fileName', label: 'File Name', align: 'left', format: 'text', note: '行文档 LOG_FILE 原值' },
];

/* ───────────────────────── 候选值与列表假数据 ───────────────────────── */
const HOST_IPS = ['10.18.100.1', '10.18.100.2', '10.18.100.3'];
const CATEGORIES = ['FAB', 'LIST', 'QUERY', 'IDE', 'XSITE'];

const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

/* 文件列表：一个文件一行（聚合键 ENV + HOSTIP + LOG_FINGERPRINT）；命中行的时间范围 */
const ROWS = [
  { env: 'PIRUN', hostIp: '10.20.30.40', serverCategory: 'FAB', fileName: 'DT_PRD_MBX.FABsrv.log.1',
    t0: new Date(2026, 8, 14, 10, 30, 0, 0), t1: new Date(2026, 8, 14, 10, 41, 18, 320) },
  { env: 'PIRUN', hostIp: '10.20.30.40', serverCategory: 'FAB', fileName: 'DT_PRD_MBX.FABsrv.log',
    t0: new Date(2026, 8, 14, 10, 43, 0, 0), t1: new Date(2026, 8, 14, 11, 2, 44, 900) },
  { env: 'PIRUN', hostIp: '10.20.30.41', serverCategory: 'QUERY', fileName: 'DT_PRD_MBX.QUERYsrv.log.2',
    t0: new Date(2026, 8, 14, 10, 32, 10, 100), t1: new Date(2026, 8, 14, 10, 39, 5, 40) },
  { env: 'PROD', hostIp: '10.18.100.1', serverCategory: 'FAB', fileName: 'DT_PRD_MBX.FABsrv.log.7',
    t0: new Date(2026, 8, 14, 10, 15, 33, 200), t1: new Date(2026, 8, 14, 10, 58, 2, 880) },
  { env: 'PROD', hostIp: '10.18.100.2', serverCategory: 'LIST', fileName: 'DT_PRD_MBX.LISTsrv.log',
    t0: new Date(2026, 8, 14, 10, 20, 41, 500), t1: new Date(2026, 8, 14, 10, 49, 17, 60) },
  { env: 'PROD', hostIp: '10.18.100.3', serverCategory: 'IDE', fileName: 'DT_PRD_MBX.IDEsrv.log.1',
    t0: new Date(2026, 8, 14, 10, 28, 9, 700), t1: new Date(2026, 8, 14, 11, 1, 51, 130) },
].map((r, i) => ({ ...r, idx: i + 1, startTime: stamp(r.t0), endTime: stamp(r.t1) }));

const STYLES = `
  :root{
    --stage-max:1180px;
    /* 页面自有令牌（05-视觉与交互规范） */
    --p:#2f7d5a; --p-hover:#3a9169; --p-bg:#eaf4ef;
    --err:#ff4d4f; --err-bg:#fff1f0; --warn:#faad14;
    --t1:rgba(0,0,0,.88); --t2:rgba(0,0,0,.65); --t3:rgba(0,0,0,.45);
    --bd:#d9d9d9; --split:rgba(0,0,0,.06); --fill:#fafafa;
    --r:6px; --r-sm:4px; --r-lg:8px;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  }
  .page-head{margin:0 0 20px;}
  [hidden]{display:none!important;}
  .crumb{font-size:12px;color:var(--t3);margin-bottom:6px;}
  .page-head h1{margin:0 0 6px;font-size:20px;font-weight:600;}
  .page-head .sub{margin:0;font-size:12.5px;color:var(--t2);}
  .card{border:1px solid var(--bd);border-radius:var(--r-lg);background:#fff;margin:0 0 16px;}
  .card-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--split);}
  .card-head h2{margin:0;font-size:15px;font-weight:600;}
  .card-head .hint{margin-left:auto;font-size:12px;color:var(--t3);}

  .filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px 16px;padding:14px 16px;}
  .field{display:flex;flex-direction:column;gap:4px;min-width:0;}
  .field>label{display:flex;align-items:center;gap:4px;font-size:12.5px;line-height:16px;color:var(--t2);white-space:nowrap;}
  .field .req{color:var(--err);font-weight:700;}
  .field .tip{font-size:11.5px;color:var(--t3);font-weight:400;overflow:hidden;text-overflow:ellipsis;}
  .input{font:inherit;font-size:13px;height:32px;padding:0 10px;width:100%;min-width:0;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);}
  .input::placeholder{color:var(--t3);}
  .input:focus{outline:none;border-color:var(--p);box-shadow:0 0 0 2px rgba(47,125,90,.12);}
  .input.invalid{border-color:var(--err);box-shadow:0 0 0 2px rgba(255,77,79,.12);}
  .field .err{min-height:13px;font-size:11px;line-height:13px;color:var(--err);visibility:hidden;}
  .field.invalid .err{visibility:visible;}

  .btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 16px;font:inherit;font-size:13px;
    color:var(--t1);background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;white-space:nowrap;}
  .btn:hover{border-color:var(--p);color:var(--p);}
  .btn.primary{color:#fff;background:var(--p);border-color:var(--p);}
  .btn.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff;}
  .btn:disabled{color:var(--t3);background:var(--fill);border-color:var(--bd);cursor:not-allowed;}
  .btn:disabled:hover{color:var(--t3);border-color:var(--bd);}
  .btn.primary:disabled{color:#fff;background:var(--p);border-color:var(--p);opacity:.45;}
  .btn.primary:disabled:hover{background:var(--p);border-color:var(--p);}
  .actions{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}
  .actions .spacer{flex:1;}

  .table-wrap{position:relative;overflow:auto;border-bottom:1px solid var(--split);}
  table.grid{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;}
  table.grid th,table.grid td{height:40px;padding:0 12px;text-align:left;white-space:nowrap;
    border-bottom:1px solid var(--split);background:transparent;}
  table.grid th{position:sticky;top:0;z-index:3;background:var(--fill);font-size:12.5px;font-weight:600;
    color:var(--t2);border-bottom:1px solid var(--bd);}
  table.grid tbody tr:hover td{background:var(--fill);}
  table.grid tbody tr.checked td{background:var(--p-bg);}
  .sel-col{width:40px;padding:0;text-align:center;}
  table.grid thead td{background:var(--fill);}
  thead .sel-col{position:sticky;top:0;left:0;z-index:5;}
  .row-chk{width:14px;height:14px;accent-color:var(--p);cursor:pointer;vertical-align:middle;}
  .file-name{font-family:var(--mono);font-size:12.5px;}
  .table-overlay{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;
    gap:10px;font-size:13px;color:var(--t2);background:rgba(255,255,255,.72);}
  .spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(47,125,90,.25);
    border-top-color:var(--p);animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:56px 16px;font-size:13px;color:var(--t3);}
  .empty .illu{width:72px;height:48px;border:1px dashed var(--bd);border-radius:var(--r);background:var(--fill);}

  .pager{display:flex;align-items:center;gap:8px;padding:12px 16px;font-size:12.5px;color:var(--t2);}
  .pager .spacer{flex:1;}
  .pg-btn{min-width:28px;height:28px;padding:0 8px;font:inherit;font-size:12.5px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;}
  .pg-btn.active{color:var(--p);background:var(--p-bg);border-color:var(--p);}
  .pg-btn:disabled{color:var(--t3);background:var(--fill);cursor:not-allowed;}
  .page-size{height:28px;padding:0 6px;font:inherit;font-size:12.5px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);}

  .toast{position:fixed;top:16px;left:50%;z-index:11000;padding:9px 16px;font-size:13px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);opacity:0;pointer-events:none;
    transform:translate(-50%,-12px);box-shadow:0 8px 24px -8px rgba(0,0,0,.3);
    transition:opacity .18s,transform .18s;}
  .toast.show{opacity:1;transform:translate(-50%,0);}
  .toast.warn{color:#874d00;background:#fffbe6;border-color:var(--warn);}
`;

/* ───────────────────────── 控件 HTML 片段 ───────────────────────── */
const field = (id, label, node, opt = {}) => [
  `  <div class="field" data-field="${id}">`,
  `    <label for="${id}">${label}${opt.req ? ' <span class="req">*</span>' : ''}${opt.tip ? ` <span class="tip">${opt.tip}</span>` : ''}</label>`,
  `    ${node}`,
  opt.err ? '    <span class="err"></span>' : '',
  '  </div>',
].filter(Boolean).join('\n');

const input = (id, value = '', placeholder = '') =>
  `<input class="input" id="${id}" type="text" value="${value}" placeholder="${placeholder}">`;

const select = (id, values) =>
  `<select class="input" id="${id}"><option value="">不限制</option>${values.map(v => `<option>${v}</option>`).join('')}</select>`;

const rowHtml = (r) =>
  `<tr data-row="${r.idx}">` +
  `<td class="sel-col"><input type="checkbox" class="row-chk" id="file-${r.idx}" data-file="${r.fileName}"></td>` +
  COLUMNS.map(col => {
    const cls = col.key === 'fileName' ? 'file-name' : '';
    return `<td data-col="${col.key}"${cls ? ` class="${cls}"` : ''}>${r[col.key]}</td>`;
  }).join('') +
  '</tr>';

/* ───────────────────────── 页内行为（演示用；不含真实业务请求）───────────────────────── */
const PAGE_SCRIPT = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DEF = { start: '2026-09-14 10:00', end: '2026-09-14 11:00' };
  var TIME_RE = /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/;

  var toastEl = $('toast'), toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 2800);
  }
  function setErr(id, msg) {
    var box = document.querySelector('[data-field="' + id + '"]');
    if (!box) return;
    box.classList.toggle('invalid', !!msg);
    var el = $(id);
    if (el) el.classList.toggle('invalid', !!msg);
    var slot = box.querySelector('.err');
    if (slot && msg) slot.textContent = msg;
  }
  function parseTime(t) {
    if (!TIME_RE.test(t || '')) return null;
    var d = new Date(t.replace(' ', 'T') + ':00');
    return isNaN(d.getTime()) ? null : d;
  }
  function fmtTime(d) {
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' +
      z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function shiftTime(t, minutes) {
    var d = parseTime(t) || new Date(2026, 8, 14, 11, 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    return fmtTime(d);
  }

  /* 时间：即时校验（同 01 §2.2） */
  function checkTime() {
    var s = $('startTimeInput').value.trim(), e = $('endTimeInput').value.trim();
    if (!TIME_RE.test(s) || !TIME_RE.test(e)) {
      setErr('startTimeInput', '时间格式应为 YYYY-MM-DD HH:mm（精确到分钟）');
      return false;
    }
    var a = parseTime(s), b = parseTime(e);
    if (a > b) { setErr('endTimeInput', '开始时间必须早于或等于结束时间'); return false; }
    if (b - a > 86400000) { setErr('endTimeInput', '起止跨度不能超过 1 天'); return false; }
    setErr('startTimeInput', '');
    setErr('endTimeInput', '');
    return true;
  }
  ['startTimeInput', 'endTimeInput'].forEach(function (id) {
    $(id).addEventListener('input', checkTime);
  });
  $('startTimeInput').addEventListener('blur', function () {
    if (!this.value.trim()) { this.value = shiftTime($('endTimeInput').value, -60); checkTime(); }
  });
  $('endTimeInput').addEventListener('blur', function () {
    if (!this.value.trim()) { this.value = shiftTime($('startTimeInput').value, 60); checkTime(); }
  });

  /* 联动：Environment 变更 → 重取 Host IP 候选并清空已选（同 01 §2.7） */
  $('envSelect').addEventListener('change', function () {
    var had = !!$('hostIpSelect').value;
    $('hostIpSelect').value = '';
    toast('已按 Environment 重取 Host IP 候选' + (had ? '，原已选值已清空' : ''));
  });

  /* 多选（复选框）：跨页保留；Download 需 ≥ 1 行选中 */
  function syncDownload() {
    var n = document.querySelectorAll('#fileTableBody .row-chk:checked').length;
    $('btnDownload').disabled = n === 0;
    $('selCount').textContent = n ? '已选 ' + n + ' 个文件' : '';
  }
  $('fileTableBody').addEventListener('change', function (ev) {
    var chk = ev.target;
    if (chk.classList && chk.classList.contains('row-chk')) {
      chk.closest('tr').classList.toggle('checked', chk.checked);
      syncDownload();
    }
  });
  /* 表头全选（演示：当前页全选 / 全不选） */
  $('chkAll').addEventListener('change', function () {
    var chks = document.querySelectorAll('#fileTableBody .row-chk');
    for (var i = 0; i < chks.length; i++) {
      chks[i].checked = this.checked;
      chks[i].closest('tr').classList.toggle('checked', this.checked);
    }
    syncDownload();
  });

  /* Search：校验通过后查第 1 页 */
  $('btnSearch').addEventListener('click', function () {
    if (!checkTime()) { toast('条件不合法，已拦住本次检索', 'warn'); return; }
    document.querySelectorAll('#fileTableBody .row-chk').forEach(function (c) {
      c.checked = false;
      c.closest('tr').classList.remove('checked');
    });
    $('chkAll').checked = false;
    syncDownload();
    $('tableOverlay').hidden = false;
    setTimeout(function () {
      $('tableOverlay').hidden = true;
      toast('已按当前条件查询第 1 页（共 6 条文件）—— 重新 Search 清空已选');
    }, 700);
  });

  /* 重置：条件回默认、列表清空、不自动查询 */
  $('btnReset').addEventListener('click', function () {
    ['envSelect', 'hostIpSelect', 'serverCategorySelect'].forEach(function (id) { $(id).value = ''; });
    $('startTimeInput').value = DEF.start;
    $('endTimeInput').value = DEF.end;
    setErr('startTimeInput', '');
    setErr('endTimeInput', '');
    document.querySelectorAll('#fileTableBody .row-chk').forEach(function (c) {
      c.checked = false;
      c.closest('tr').classList.remove('checked');
    });
    $('chkAll').checked = false;
    syncDownload();
    $('fileTable').hidden = true;
    $('emptyState').hidden = false;
    $('pagerTotal').textContent = '共 0 条';
    $('btnDownload').disabled = true;
    toast('条件已恢复默认，列表回到未查询态（不自动查询）');
  });

  /* Download：选中行的文件 id 数组 → 整文件还原打包 zip */
  $('btnDownload').addEventListener('click', function () {
    var picked = document.querySelectorAll('#fileTableBody .row-chk:checked');
    if (!picked.length) return;
    var parts = [];
    if ($('envSelect').value) parts.push($('envSelect').value);
    if ($('serverCategorySelect').value) parts.push($('serverCategorySelect').value);
    var zip = parts.join('_') + (parts.length ? '_' : '') + '2609141000-09141100.zip';
    toast('已下载 ' + picked.length + ' 个文件（全部原始日志，文件级还原）→ ' + zip);
  });

  syncDownload();
})();
`;

/* ───────────────────────── 页面内容 ───────────────────────── */
const CONTENT = `
<div class="page-head">
  <div class="crumb">日志检索与分析 · 模块 1 · 功能 3</div>
  <h1>原始日志下载</h1>
  <p class="sub">按条件搜出日志文件（不是块、不是行），列表多选后整文件下载（文件级还原）；一个文件一行，聚合键 = ENV + HOSTIP + LOG_FINGERPRINT</p>
</div>

<section class="card">
  <div class="card-head"><h2>查询条件</h2><span class="hint">5 个条件 · 控件与候选接口照搬功能 1</span></div>
  <div class="filters">
${field('envSelect', 'Environment', select('envSelect', ['PROD', 'PIRUN']))}
${field('hostIpSelect', 'Host IP', select('hostIpSelect', HOST_IPS))}
${field('serverCategorySelect', 'Server Category', select('serverCategorySelect', CATEGORIES))}
${field('startTimeInput', '开始时间', input('startTimeInput', '2026-09-14 10:00', 'YYYY-MM-DD HH:mm'), { req: true, err: true })}
${field('endTimeInput', '结束时间', input('endTimeInput', '2026-09-14 11:00', 'YYYY-MM-DD HH:mm'), { req: true, tip: '（须晚于或等于开始时间）', err: true })}
  </div>
  <div class="actions">
    <span class="spacer"></span>
    <button class="btn primary" id="btnSearch">Search</button>
    <button class="btn" id="btnReset">重置</button>
  </div>
</section>

<section class="card">
  <div class="card-head">
    <h2>文件列表</h2>
    <span class="hint">一个文件一行 · 多选（复选框）· 6 列</span>
  </div>
  <div class="table-wrap">
    <table class="grid" id="fileTable">
      <thead><tr>
        <td class="sel-col"><input type="checkbox" class="row-chk" id="chkAll"></td>
${COLUMNS.map(col => `        <th data-col="${col.key}">${col.label}</th>`).join('\n')}
      </tr></thead>
      <tbody id="fileTableBody">
${ROWS.map(rowHtml).join('\n')}
      </tbody>
    </table>
    <div class="table-overlay" id="tableOverlay" hidden><span class="spinner"></span><span>加载中…</span></div>
    <div class="empty" id="emptyState" hidden><div class="illu"></div><div>暂无数据 —— 填写条件后点 Search 开始检索</div></div>
  </div>
  <div class="pager" id="pager">
    <span id="pagerTotal">共 6 条</span>
    <span class="spacer"></span>
    <select class="page-size"><option>20</option><option>50</option><option>100</option></select>
    <span>条 / 页</span>
    <button class="pg-btn" disabled>‹</button>
    <button class="pg-btn active">1</button>
    <button class="pg-btn">›</button>
  </div>
  <div class="actions">
    <span id="selCount"></span>
    <span class="spacer"></span>
    <button class="btn primary" id="btnDownload" disabled>Download</button>
  </div>
</section>

<div class="toast" id="toast"></div>

<script>
${PAGE_SCRIPT}
</script>
`;

/* ───────────────────────── 规格清单（唯一事实源）───────────────────────── */
const spec = {
  schema: SKILL,
  title: '原始日志下载',
  summary: '两段式整页：上 = 查询条件区（5 个条件：Environment / Host IP / Server Category / 起止时间，只有时间必填），' +
    '下 = 文件列表（一个文件一行，聚合键 ENV + HOSTIP + LOG_FINGERPRINT；多选复选框、跨页保留）+ Download 按钮' +
    '（每个选中文件的全部原始日志按 LOG_OFFSET 拼回文件形态，打包 zip：三级目录 + 防撞名命名）。接口口径依 03 文档 §六。',
  regions: [
    { id: 'search', label: '查询条件区', role: 'search', desc: '5 个条件，每行 5 个；无 Server Number、无折叠区；Search 与重置在栅格后' },
    { id: 'list', label: '文件列表区', role: 'table', desc: '6 列；行粒度 = 文件；多选；分页同 01：默认 20 条、档位 20 / 50 / 100、始终显示、共 N 条' },
    { id: 'actions', label: '底部操作区', role: 'actions', desc: 'Download（唯一按钮，已选 ≥ 1 行才可用）' },
  ],
  apis: [
    { id: 'envList', method: 'GET', path: '/api/v1/env/list', desc: 'Environment 候选（沿用 01 §5.3 第 1 条）' },
    { id: 'ipAddressList', method: 'GET', path: '/api/v1/ipaddress/list', desc: 'Host IP 候选（沿用 01 §5.3 第 2 条；入参 environment 可缺省）' },
    { id: 'serverCategoryList', method: 'GET', path: '/api/v1/server_category/list', desc: 'Server Category 候选（沿用 01 §5.3 第 3 条）' },
    { id: 'rawLogPage', method: 'GET', path: '/api/v1/raw_log/page', desc: '文件分页查询（条件走 URL 参数）' },
    { id: 'rawLogDownload', method: 'POST', path: '/api/v1/raw_log/download', desc: '整文件还原打包 zip 下载' },
  ],
  controls: [
    {
      selector: '#envSelect', kind: 'select', label: 'Environment', region: '查询条件区',
      param: 'env', options: ['PROD', 'PIRUN'], placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤', '等值过滤行文档字段 ENV'],
      on: { load: ['进页面加载候选值'], change: ['重取 Host IP 候选值', '清空已选的 Host IP'] },
      apis: ['envList'],
      apiNotes: ['出参：`data.env` = 字符串数组', '入参：URL 参数 `env`'],
    },
    {
      selector: '#hostIpSelect', kind: 'select', label: 'Host IP', region: '查询条件区',
      param: 'hostIp', options: HOST_IPS, placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤', '等值过滤行文档字段 HOSTIP', 'Environment 变化时重取候选并清空已选值'],
      on: { load: ['进页面调候选接口（不带参）', 'Environment 选值后再调一次并带上 `environment` 参数'] },
      apis: ['ipAddressList'],
      apiNotes: ['入参：`environment`（可缺省）；出参：`data.ipaddress` = 字符串数组', '入参：URL 参数 `hostIp`'],
    },
    {
      selector: '#serverCategorySelect', kind: 'select', label: 'Server Category', region: '查询条件区',
      param: 'serverCategory', options: CATEGORIES, placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤', '等值过滤行文档字段 SERVER_CATEGORY'],
      apis: ['serverCategoryList'],
      apiNotes: ['出参：`data.serverCategory` = 字符串数组', '入参：URL 参数 `serverCategory`'],
    },
    {
      selector: '#startTimeInput', kind: 'input', label: '开始时间', region: '查询条件区',
      required: true, param: 'startTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: [
        '区间下界：开始时间 ≤ LOG_TIME ≤ 结束时间（闭区间）—— 打的是行文档字段 LOG_TIME',
        '即时校验：开始 ≤ 结束（同一分钟判合法）且差值 ≤ 1 天；不合法标红 + 错误文案，点 Search 被拦住',
        '清空后自动补为「结束时间 − 1 小时」',
      ],
      notes: ['进页面默认值 = 当前时刻 − 1 小时；选择器精确到分钟'],
      apiNotes: ['入参：URL 参数 `startTime`，格式 `yyyyMMddHHmm`'],
    },
    {
      selector: '#endTimeInput', kind: 'input', label: '结束时间', region: '查询条件区',
      required: true, param: 'endTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: [
        '区间上界（闭区间，打 LOG_TIME）',
        '即时校验口径与开始时间一致；清空后自动补为「开始时间 + 1 小时」',
      ],
      notes: ['进页面默认值 = 当前时刻'],
      apiNotes: ['入参：URL 参数 `endTime`，格式 `yyyyMMddHHmm`'],
    },
    {
      selector: '#btnSearch', kind: 'button', label: 'Search', region: '查询条件区',
      rules: ['调接口前对条件做前置校验，不合法不发请求', '重新 Search 会清空已选文件（与翻页保留相反）'],
      on: { click: ['查第 1 页：pageIndex 传 1、pageSize 传 20'] },
      apis: ['rawLogPage'],
      apiNotes: [
        '入参：URL 参数 pageIndex / pageSize + 五个可选条件（env、hostIp、serverCategory 等值；startTime / endTime 打 LOG_TIME）',
        '出参：统一响应包 `data` = totalPage / total / pageIndex / pageSize / contents[]',
      ],
    },
    {
      selector: '#btnReset', kind: 'button', label: '重置', region: '查询条件区',
      rules: ['条件区恢复进页面默认值（下拉清空；开始 = 当前时刻 − 1 小时、结束 = 当前时刻）', '结果列表清空回到未查询态；已选文件一并清空'],
      on: { click: ['不自动查询'] },
      apiNotes: ['不调接口，纯前端复位'],
    },
    {
      selector: '#fileTable', kind: 'table', label: '文件列表', region: '文件列表区',
      rules: [
        '行粒度：一个文件一行 —— 搜索窗口内有命中行的文件才进列表；同一文件跨页稳定（聚合键不变）',
        '聚合键 = ENV + HOSTIP + LOG_FINGERPRINT（一个指纹 = 一个物理文件，永不复用）',
        'Start Time / End Time = 该文件中命中搜索条件那些行的 LOG_TIME 最小 / 最大值（不是该文件全部行的时间范围）',
        'File Name = 行文档 LOG_FILE 原值（含滚动序号，如 DT_PRD_MBX.FABsrv.log.1）',
        '行选择多选（复选框，与功能 1 / 2 的单选不同）；跨页保留；重新 Search / 重置一律清空',
        '空结果时 Download 不可用；加载中列表显示动画、Download 置灰',
      ],
      apis: ['rawLogPage'],
      apiNotes: [
        '行数据 = 出参 `data.contents[]`：env、hostIp、serverCategory、startTime、endTime、fileName',
        '出参 `id` = 文件 id（base64url(ENV|HOSTIP|LOG_FINGERPRINT 完整 64 hex)），对客户端不透明、不出列、同一文件恒定；两个文件代 = 两个指纹 = 两个 id，列表天然两行',
      ],
    },
    {
      selector: '#chkAll', kind: 'checkbox', label: '表头全选框', region: '文件列表区',
      rules: ['勾选 = 选中当前页全部行；取消 = 清空当前页全部行的选中', '作用范围 = 当前页；跨页已选不受影响'],
      apiNotes: ['不调接口（纯前端行为）'],
    },
    {
      selector: '#pager', kind: 'pager', label: '分页组件', region: '文件列表区',
      rules: ['始终显示（只有一页时也显示）', '默认每页 20 条，档位 20、50、100', '总条数显示「共 N 条」，取自出参 total', '翻页保留已选文件'],
      on: { change: ['翻页请求目标页：pageIndex 传目标页'] },
      apis: ['rawLogPage'],
      apiNotes: ['出参 `data.totalPage` 给页码数量'],
    },
    {
      selector: '#btnDownload', kind: 'button', label: 'Download', region: '底部操作区',
      dependsOn: ['已选中 ≥ 1 行（空列表 / 未选中不可用）'],
      rules: [
        '入参：选中行的文件 id 数组（page 出参 contents[].id，不出列），至少 1 个',
        '下载什么：每个选中文件的全部原始日志 —— 该指纹在行索引里的全部行（不只命中行）；搜索窗口只负责把文件找出来',
        '后端：逐个 id 解码 → 四 term 查行索引 → 堆内按 LOG_OFFSET 升序拼回 → 每 id 一个 .log → 全部打包 zip（文件级还原）',
        '单个 id 解码失败 / 查无行 ⇒ 整单失败返回错误（不部分下载）',
        '单次上限不设（后端流式生成 zip）',
      ],
      apis: ['rawLogDownload'],
      apiNotes: [
        '入参：`{"ids": ["<文件 id>", "..."]}`；出参是 .zip 文件本身，直接下载不走统一响应包',
        '.log 命名 = 环境-类别-文件首行时间戳（还原后全部行的最早行，yyyyMMddHHmmss）；同目录撞名追加 .1、.2（不覆盖）',
        'zip 内三级目录：环境 → Host IP → Server Category',
        'zip 名 = 本次搜索条件拼接：填了值的条件按表单顺序用 _ 串起（环境 → Host IP → Server Category → 时间），未选不拼；时间为开始-结束一段（yyMMddHHmm）',
      ],
    },
  ],
  table: {
    selector: '#fileTable',
    dataApi: 'rawLogPage',
    columns: COLUMNS,
    pagination: { api: 'rawLogPage', pageParam: 'pageIndex', pageSize: 20, serverSide: true, totalField: 'total' },
    rowSelection: { mode: 'multi', requiredBy: ['#btnDownload'], clearedOn: ['重新 Search', '点重置'] },
  },
  mock: [
    '所有接口路径、方法、入参与出参依 03 文档 §六；原型不真实发请求，数据全为本地模拟',
    '进页面即呈现「正常态」数据（真实页面进页面是未查询态，点 Search 后才有结果；点重置可看到未查询态）',
    '文件列表 6 行为本地模拟（Start Time / End Time 为命中行时间范围样例）；总条数 6、分页档位为静态演示',
    '候选值（Environment、Host IP、Server Category）为本地静态数组',
    'Download 只弹轻提示（zip 名按当前条件拼出演示），不产生真实文件下载',
  ],
  openQuestions: [],
};

const html = buildPrototype({ title: spec.title, styles: STYLES, content: CONTENT, spec });
writePrototype(OUT, html);

console.log('生成完成：' + OUT);
console.log('控件 ' + spec.controls.length + ' 个 · 接口 ' + spec.apis.length + ' 个 · 静态列 ' + COLUMNS.length + ' 列');
