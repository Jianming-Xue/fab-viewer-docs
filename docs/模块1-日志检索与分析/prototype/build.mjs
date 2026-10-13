/**
 * 生成「MES Rule 信息检索」标注原型（单文件自包含 HTML）。
 *
 * 设计依据：docs/模块1-日志检索与分析/01-MES Rule信息检索.md
 * 视觉令牌：docs/05-视觉与交互规范.md（AntD 5 语汇 · 高级绿 #2F7D5A · 圆角 6px）
 * 生成框架：~/.claude/skills/annotated-prototype（只替换 4 个占位符）
 *
 * 用法：node build.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototype, writePrototype } from '/Users/xuejianming/.claude/skills/annotated-prototype/tests/lib/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'MES-Rule信息检索-annotated-prototype.html');
const SKILL = 'annotated-prototype/spec@1';

/* ───────────────────────── 列表列定义（唯一事实源：表头 + 规格清单同源）─────────────────────────
   顺序依 01 文档 §3.2：恒显示 14 列 → 可隐藏 3 列 → 可选列（EXEC_STATUS，运行时注入，不在静态表头）
   → 动态耗时列（运行时注入）→ 固定末列 Server Hang。 */
const COLUMNS = [
  { key: 'env', label: 'Environment', align: 'left', format: 'text' },
  { key: 'hostIp', label: 'Host IP', align: 'left', format: 'text' },
  { key: 'serverId', label: 'Server ID', align: 'left', format: 'text' },
  { key: 'ruleName', label: 'Rule Name', align: 'left', format: 'text' },
  { key: 'requestType', label: 'Request Type', align: 'left', format: 'tag', enum: ['Rule', 'TXN'] },
  { key: 'startTime', label: 'Start Time', align: 'left', format: 'datetime-ms' },
  { key: 'endTime', label: 'End Time', align: 'left', format: 'datetime-ms' },
  { key: 'ruleResult', label: 'Rule Result', align: 'left', format: 'text', note: 'CANCELRULE 单元格标红' },
  { key: 'errorCode', label: 'Error Code', align: 'left', format: 'multi' },
  { key: 'eqpId', label: 'EqpID', align: 'left', format: 'multi' },
  { key: 'lotId', label: 'Lot ID', align: 'left', format: 'multi' },
  { key: 'carrierId', label: 'Carrier ID', align: 'left', format: 'multi' },
  { key: 'userId', label: 'User ID', align: 'left', format: 'multi', note: 'USERID 多值：显示首值 + 角标' },
  { key: 'tid', label: 'TID', align: 'left', format: 'multi' },
  { key: 'totalCostSec', label: 'Total Cost Time', align: 'right', format: 'duration-s' },
  { key: 'itemCostSec', label: 'Item Cost Summary', align: 'right', format: 'duration-s' },
  { key: 'unaccountedSec', label: 'UnAccounted Cost', align: 'right', format: 'duration-s' },
  { key: 'serverHang', label: 'Server Hang', align: 'center', format: 'action' },
];

/* ───────────────────────── 候选值与列表假数据（20 行 = 默认每页 20 条）───────────────────────── */
const CATEGORIES = ['FAB', 'LIST', 'QUERY', 'IDE', 'XSITE'];
const LOCK_OBJECTS = ['EQP', 'CARRIER', 'LOT'];
const CALL_SYS = ['MCS', 'R2R', 'RMS', 'SPC', 'RTD'];
const HOST_IPS = ['10.18.100.1', '10.18.100.2', '10.18.100.3'];

const ROW_SEED = [
  { env: 'PIRUN', hostIp: '10.18.100.1', ruleName: 'POST', requestType: 'Rule', eqp: ['ATTAL01', 'ATTAL02'], lot: ['A031178'], carrier: ['C1200317'], errCode: [], user: ['EAP'] },
  { env: 'PIRUN', hostIp: '10.18.100.2', ruleName: 'LOT_TRACK_IN', requestType: 'Rule', eqp: ['ATNC100'], lot: ['A031179', 'A031180'], carrier: ['C1200318'], errCode: ['E1024'], user: ['OP01', 'OP02'] },
  { env: 'PROD', hostIp: '10.18.100.3', ruleName: 'CARRIER_MOVE', requestType: 'Rule', eqp: ['ATTAL07'], lot: ['A031181'], carrier: ['C1200319'], errCode: [], user: ['EAP'] },
  { env: 'PROD', hostIp: '10.18.100.1', ruleName: 'TXN_PORTER_JOB', requestType: 'TXN', eqp: ['ATTAL08', 'ATTAL09'], lot: ['A031182'], carrier: ['C1200320'], errCode: ['E2201', 'E2202'], user: ['MCS'] },
  { env: 'PIRUN', hostIp: '10.18.100.2', ruleName: 'RECIPE_VERIFY', requestType: 'Rule', eqp: ['ATNC200'], lot: ['A031183'], carrier: [], errCode: [], user: ['EAP', 'OP03'] },
];
const SERVER_IDS = ['FABsrv.25', 'FABsrv.10', 'LISTsrv.3', 'QUERYsrv.7', 'IDEsrv.2', 'XSITEsrv.1'];

const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

const ROWS = Array.from({ length: 20 }, (_, i) => {
  const seed = ROW_SEED[i % ROW_SEED.length];
  const t0 = new Date(2026, 8, 22, 9, 58, 0, 0);
  t0.setSeconds(t0.getSeconds() - i * 97);
  const totalMs = 1200 + ((i * 7919) % 260000);
  const itemMs = totalMs - 380 - ((i * 137) % 900);
  const t1 = new Date(t0.getTime() + totalMs);
  return {
    idx: i + 1,
    ...seed,
    serverId: SERVER_IDS[i % SERVER_IDS.length],
    ruleResult: i === 4 || i === 12 ? 'CANCELRULE' : i === 7 ? 'RETRY' : 'PASS',
    startTime: stamp(t0),
    endTime: stamp(t1),
    userId: seed.user,
    tid: `2026092209${pad(58 - i % 30)}${pad((i * 7) % 60)}.${pad((i * 137) % 1000, 3)}-${pad(i + 1, 4)}`,
    totalMs,
    itemMs,
    unaccountedMs: totalMs - itemMs,
    /* hangCount = page 出参 HANG_LIST 长度；演示用：3 行 > 0（红、可点开弹框），其余 = 0（置灰） */
    hangCount: i % 7 === 3 ? 2 + (i % 2) : 0,
  };
});

/* ───────────────────────── 页面样式（对齐 05 的令牌与组件形态；框架变量不改）───────────────────────── */
const STYLES = `
  :root{
    /* 布局钩子：宽表格（18 列）必须放宽内容区 */
    --stage-max:1440px;
    /* 页面自有令牌（05-视觉与交互规范） */
    --p:#2f7d5a; --p-hover:#3a9169; --p-bg:#eaf4ef;
    --err:#ff4d4f; --err-bg:#fff1f0; --warn:#faad14;
    --t1:rgba(0,0,0,.88); --t2:rgba(0,0,0,.65); --t3:rgba(0,0,0,.45);
    --bd:#d9d9d9; --split:rgba(0,0,0,.06); --fill:#fafafa;
    --r:6px; --r-sm:4px; --r-lg:8px;
    --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  }
  .page-head{margin:0 0 20px;}
  /* 本页多处用 hidden 属性切换显隐（折叠区 / 加载遮罩 / 空态），
     而这些元素自身带 display 声明，必须让 hidden 稳定胜出 */
  [hidden]{display:none!important;}
  .crumb{font-size:12px;color:var(--t3);margin-bottom:6px;}
  .page-head h1{margin:0 0 6px;font-size:20px;font-weight:600;}
  .page-head .sub{margin:0;font-size:12.5px;color:var(--t2);}
  .card{border:1px solid var(--bd);border-radius:var(--r-lg);background:#fff;margin:0 0 16px;}
  .card-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--split);}
  .card-head h2{margin:0;font-size:15px;font-weight:600;}
  .card-head .hint{margin-left:auto;font-size:12px;color:var(--t3);}

  /* 筛选区：平铺 12 项 + 排序开关 = 13 格，每行 5 个 → 5 / 5 / 3 */
  .filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px 16px;padding:14px 16px;}
  .filters.fold{padding-top:0;}
  .field{display:flex;flex-direction:column;gap:4px;min-width:0;}
  .field>label{display:flex;align-items:center;gap:4px;font-size:12.5px;line-height:16px;color:var(--t2);white-space:nowrap;}
  .field .req{color:var(--err);font-weight:700;}
  .field .tip{font-size:11.5px;color:var(--t3);font-weight:400;overflow:hidden;text-overflow:ellipsis;}
  .input{font:inherit;font-size:13px;height:32px;padding:0 10px;width:100%;min-width:0;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);}
  .input::placeholder{color:var(--t3);}
  .input:focus{outline:none;border-color:var(--p);box-shadow:0 0 0 2px rgba(47,125,90,.12);}
  .input:disabled{background:var(--fill);color:var(--t3);cursor:not-allowed;}
  .input.invalid{border-color:var(--err);box-shadow:0 0 0 2px rgba(255,77,79,.12);}
  /* 校验提示常驻占位，只用 visibility 切换，避免高度变化顶走下方按钮 */
  .field .err{min-height:13px;font-size:11px;line-height:13px;color:var(--err);visibility:hidden;}
  .field.invalid .err{visibility:visible;}
  .input-group{display:flex;align-items:center;height:32px;background:#fff;border:1px solid var(--bd);
    border-radius:var(--r);overflow:hidden;}
  .input-group .prefix{display:flex;align-items:center;height:100%;padding:0 8px;font-size:12.5px;
    color:var(--t3);background:var(--fill);border-right:1px solid var(--bd);white-space:nowrap;}
  .input-group .input{border:0;border-radius:0;height:30px;box-shadow:none;}
  .input-group .input:focus{box-shadow:none;}
  .switch{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0;font:inherit;font-size:12.5px;
    color:var(--t2);background:transparent;border:0;cursor:pointer;}
  .switch .track{position:relative;width:36px;height:20px;border-radius:999px;background:rgba(0,0,0,.25);
    transition:background .16s;flex:0 0 auto;}
  .switch .track::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .16s;}
  .switch.on{color:var(--t1);}
  .switch.on .track{background:var(--p);}
  .switch.on .track::after{left:18px;}

  .btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 16px;font:inherit;font-size:13px;
    color:var(--t1);background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;white-space:nowrap;}
  .btn:hover{border-color:var(--p);color:var(--p);}
  .btn.primary{color:#fff;background:var(--p);border-color:var(--p);}
  .btn.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff;}
  .btn.ghost{color:var(--p);background:transparent;border-color:transparent;padding:0 8px;}
  .btn.ghost:hover{background:var(--p-bg);}
  .btn:disabled{color:var(--t3);background:var(--fill);border-color:var(--bd);cursor:not-allowed;}
  .btn:disabled:hover{color:var(--t3);border-color:var(--bd);}
  /* 主按钮禁用：保持主色底 + 降不透明度（05 §4.7） */
  .btn.primary:disabled{color:#fff;background:var(--p);border-color:var(--p);opacity:.45;}
  .btn.primary:disabled:hover{background:var(--p);border-color:var(--p);}
  .actions{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}
  .actions .spacer{flex:1;}
  .vline{width:1px;height:18px;background:var(--split);}
  .arrow{font-size:10px;line-height:1;}

  /* 结果列表 */
  .table-wrap{position:relative;overflow:auto;border-bottom:1px solid var(--split);}
  table.grid{border-collapse:separate;border-spacing:0;width:100%;font-size:13px;}
  table.grid th,table.grid td{height:40px;padding:0 12px;text-align:left;white-space:nowrap;
    border-bottom:1px solid var(--split);background:transparent;}
  table.grid th{position:sticky;top:0;z-index:3;background:var(--fill);font-size:12.5px;font-weight:600;
    color:var(--t2);border-bottom:1px solid var(--bd);}
  table.grid tbody tr:hover td{background:var(--fill);}
  table.grid tbody tr.selected td{background:var(--p-bg);}
  .sel-col{width:40px;padding:0;text-align:center;}
  table.grid thead td{background:var(--fill);}
  /* 左右固定列必须自身不透明，否则横向滚动时下方列会透出来 */
  table.grid td.sticky-left,table.grid td.sticky-right{background:#fff;}
  table.grid tbody tr:hover td.sticky-left,table.grid tbody tr:hover td.sticky-right{background:var(--fill);}
  table.grid tbody tr.selected td.sticky-left,table.grid tbody tr.selected td.sticky-right{background:var(--p-bg);}
  .sticky-left{position:sticky;left:0;z-index:2;box-shadow:1px 0 0 var(--split);}
  thead .sel-col{position:sticky;top:0;left:0;z-index:5;}
  .sticky-right{position:sticky;right:0;z-index:2;box-shadow:-1px 0 0 var(--split);}
  thead .sticky-right{z-index:5;}
  .num{text-align:right;font-variant-numeric:tabular-nums;}
  /* 动态耗时列 / EXEC_STATUS：确认后注入，用左侧分隔线标出新增范围 */
  table.grid th.dyn-col{background:#f4f8f6;box-shadow:inset 1px 0 0 var(--split);}
  table.grid td.dyn-col{box-shadow:inset 1px 0 0 var(--split);}
  .cell-error{color:var(--err);background:var(--err-bg)!important;}
  .cell-hang{text-align:center;}
  .tag{display:inline-block;font-size:11.5px;line-height:18px;padding:0 6px;border-radius:var(--r-sm);
    color:var(--t2);background:var(--fill);border:1px solid var(--bd);}
  .tag.rule{color:#256847;background:var(--p-bg);border-color:rgba(47,125,90,.35);}
  .tag.txn{color:#0958d9;background:#e8f3ff;border-color:rgba(22,119,255,.35);}
  .badge{display:inline-block;margin-left:4px;padding:0 4px;font-size:10.5px;line-height:15px;
    border-radius:999px;color:var(--t2);background:rgba(0,0,0,.06);vertical-align:1px;}
  .row-radio{width:14px;height:14px;accent-color:var(--p);cursor:pointer;vertical-align:middle;}
  .hang-btn{font:inherit;font-size:12px;height:24px;padding:0 8px;border-radius:var(--r-sm);
    color:var(--t3);background:var(--fill);border:1px solid var(--bd);cursor:not-allowed;}
  .hang-btn.hot{color:#fff;background:var(--err);border-color:var(--err);cursor:pointer;}
  .hang-btn.hot:hover{background:#ff7875;border-color:#ff7875;}
  .table-overlay{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;
    gap:10px;font-size:13px;color:var(--t2);background:rgba(255,255,255,.72);}
  .spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(47,125,90,.25);
    border-top-color:var(--p);animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:56px 16px;font-size:13px;color:var(--t3);}
  .empty .illu{width:72px;height:48px;border:1px dashed var(--bd);border-radius:var(--r);background:var(--fill);}

  /* 分页 */
  .pager{display:flex;align-items:center;gap:8px;padding:12px 16px;font-size:12.5px;color:var(--t2);}
  .pager .spacer{flex:1;}
  .pg-btn{min-width:28px;height:28px;padding:0 8px;font:inherit;font-size:12.5px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;}
  .pg-btn.active{color:var(--p);background:var(--p-bg);border-color:var(--p);}
  .pg-btn:disabled{color:var(--t3);background:var(--fill);cursor:not-allowed;}
  .pg-btn.active:disabled{color:var(--t3);background:var(--fill);border-color:var(--bd);}
  .page-size{height:28px;padding:0 6px;font:inherit;font-size:12.5px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);}

  /* 抽屉 / 弹窗 / 遮罩 / 轻提示 */
  .mask{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.45);display:none;}
  .mask.open{display:block;}
  .drawer{position:fixed;top:0;right:0;z-index:9999;display:flex;flex-direction:column;width:400px;height:100vh;
    background:#fff;border-left:1px solid var(--bd);box-shadow:-8px 0 24px rgba(0,0,0,.12);
    transform:translateX(102%);visibility:hidden;transition:transform .24s,visibility .24s;}
  .drawer.open{transform:translateX(0);visibility:visible;}
  .drawer-head{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--split);}
  .drawer-head h3{margin:0;font-size:15px;}
  .drawer-head .icon-btn{margin-left:auto;}
  .icon-btn{width:28px;height:28px;font:inherit;font-size:16px;line-height:1;color:var(--t3);
    background:transparent;border:0;border-radius:var(--r);cursor:pointer;}
  .icon-btn:hover{color:var(--t1);background:var(--fill);}
  .drawer-scope{margin:0;padding:10px 16px;font-size:12px;color:var(--t3);background:var(--fill);
    border-bottom:1px solid var(--split);}
  .drawer-body{flex:1;overflow:auto;padding:16px;}
  .group{margin:0 0 20px;}
  .group-title{margin-bottom:8px;font-size:12.5px;font-weight:600;color:var(--t1);}
  .chk{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;color:var(--t2);cursor:pointer;}
  .chk input{accent-color:var(--p);}
  .chips{display:flex;flex-wrap:wrap;gap:8px;}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;font-size:12.5px;color:var(--t2);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;}
  .chip input{accent-color:var(--p);}
  .chip:has(input:checked){color:var(--p);background:var(--p-bg);border-color:var(--p);}
  .drawer-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}

  .modal{position:fixed;top:50%;left:50%;z-index:10000;display:none;flex-direction:column;
    width:min(1080px,92vw);max-height:86vh;background:#fff;border-radius:var(--r-lg);overflow:hidden;
    transform:translate(-50%,-50%);box-shadow:0 24px 70px -20px rgba(0,0,0,.5);}
  .modal.open{display:flex;}
  .modal-head{display:flex;align-items:baseline;gap:10px;padding:14px 16px;border-bottom:1px solid var(--split);}
  .modal-head h3{margin:0;font-size:15px;font-weight:600;}
  .modal-sub{font-family:var(--mono);font-size:12px;color:var(--t3);}
  .modal-search{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--split);}
  .modal-search .input{max-width:420px;}
  .modal-search .count{font-size:12px;color:var(--t3);}
  .log-view{flex:1;min-height:260px;max-height:52vh;overflow:auto;padding:8px 0;
    font-family:var(--mono);font-size:12px;line-height:20px;color:var(--t1);background:#fbfbfc;}
  /* 日志原文一行一条，长行在显示区内自动换行（保留原文空格，不横向截断） */
  .log-line{padding:0 16px;white-space:pre-wrap;overflow-wrap:anywhere;}
  .log-line.err{color:var(--err);background:var(--err-bg);}
  .log-note{padding:6px 16px;font-family:inherit;font-size:12px;color:var(--t3);text-align:center;}
  .modal-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}
  .modal-foot .spacer{flex:1;}
  /* Server Hang 弹框：日志列换行显示，不横向滚动 */
  .hang-wrap{flex:1;min-height:220px;max-height:60vh;overflow:auto;border-bottom:1px solid var(--split);}
  .hang-wrap table.grid td{white-space:normal;vertical-align:top;height:auto;padding:8px 12px;}
  .hang-wrap .log-cell{font-family:var(--mono);font-size:12px;line-height:18px;overflow-wrap:anywhere;
    min-width:220px;max-width:420px;}
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

const chips = (values) => values
  .map(v => `        <label class="chip"><input type="checkbox" value="${v}">${v}</label>`).join('\n');

const TD_EXTRA = { serverHang: 'cell-hang sticky-right' };
const multi = (arr) => (arr.length === 0 ? '' :
  `${arr[0]}${arr.length > 1 ? `<span class="badge">+${arr.length - 1}</span>` : ''}`);
const sec = (ms) => (ms / 1000).toFixed(3);

const cell = (col, r) => {
  switch (col.key) {
    case 'requestType': return `<span class="tag ${r.requestType === 'TXN' ? 'txn' : 'rule'}">${r.requestType}</span>`;
    case 'errorCode': return multi(r.errCode);
    case 'eqpId': return multi(r.eqp);
    case 'lotId': return multi(r.lot);
    case 'carrierId': return multi(r.carrier);
    case 'tid': return multi([r.tid]);
    case 'totalCostSec': return sec(r.totalMs);
    case 'itemCostSec': return sec(r.itemMs);
    case 'unaccountedSec': return sec(r.unaccountedMs);
    case 'userId': return multi(r.userId);
    case 'serverHang': return r.hangCount > 0
      ? `<button class="hang-btn hot" type="button" data-hang-row="${r.idx}">Hang (${r.hangCount})</button>`
      : '<button class="hang-btn" type="button" disabled>Hang (0)</button>';
    default: return r[col.key];
  }
};

const rowHtml = (r) =>
  `<tr data-row="${r.idx}">` +
  `<td class="sel-col sticky-left"><input type="radio" class="row-radio" name="rowSel" id="row-${r.idx}"></td>` +
  COLUMNS.map(col => {
    const cls = [
      col.align === 'right' ? 'num' : '',
      col.key === 'ruleResult' && r.ruleResult === 'CANCELRULE' ? 'cell-error' : '',
      TD_EXTRA[col.key] || '',
    ].filter(Boolean).join(' ');
    return `<td data-col="${col.key}"${cls ? ` class="${cls}"` : ''}>${cell(col, r)}</td>`;
  }).join('') +
  '</tr>';

const thHtml = () => COLUMNS.map(col => {
  const cls = [col.align === 'right' ? 'num' : '', col.key === 'serverHang' ? 'sticky-right' : '']
    .filter(Boolean).join(' ');
  return `<th data-col="${col.key}"${cls ? ` class="${cls}"` : ''}>${col.label}</th>`;
}).join('');

/* ───────────────────────── 页内行为（演示用；不含真实业务请求）───────────────────────── */
const PAGE_SCRIPT = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DEF = { start: '2026-09-22 09:00', end: '2026-09-22 10:00', min: '0', max: '999' };
  var FOLD_KEY = 'mes-rule-info:fold';
  var TIME_RE = /^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$/;

  /* 状态记忆：本机存储不可用（如沙箱 file://）时静默降级 */
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
    return null;
  }

  var toastEl = $('toast'), toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 2400);
  }

  /* 校验提示：常驻占位，只切 visibility，避免高度变化顶走下方按钮 */
  function setErr(id, msg) {
    var box = document.querySelector('[data-field="' + id + '"]');
    if (!box) return;
    box.classList.toggle('invalid', !!msg);
    var el = $(id);
    if (el) el.classList.toggle('invalid', !!msg);
    var slot = box.querySelector('.err');
    if (slot && msg) slot.textContent = msg;
  }
  function clearErr() {
    var boxes = document.querySelectorAll('.field.invalid');
    for (var i = 0; i < boxes.length; i++) boxes[i].classList.remove('invalid');
    var inputs = document.querySelectorAll('.input.invalid');
    for (var j = 0; j < inputs.length; j++) inputs[j].classList.remove('invalid');
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
    var d = parseTime(t) || new Date(2026, 8, 22, 10, 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    return fmtTime(d);
  }

  /* 折叠区：默认收起；收起那一刻立即清空这 4 项的值 */
  function setFold(open) {
    $('foldPanel').hidden = !open;
    $('btnFold').innerHTML = open ? '收起更多条件<span class="arrow">▲</span>'
      : '展开更多条件<span class="arrow">▼</span>';
    if (!open) {
      $('hostIpSelect').value = '';
      $('userIdInput').value = '';
      $('errorCodeInput').value = '';
      $('ruleResultSelect').value = '';
      setErr('errorCodeInput', '');
    }
    store(FOLD_KEY, open ? '1' : '0');
  }
  $('btnFold').addEventListener('click', function () { setFold($('foldPanel').hidden); });

  /* Server Number 依赖 Server Category：为空置灰并清值，否则拼出 SERVER_ID */
  function syncServer() {
    var cat = $('serverCategorySelect').value;
    var num = $('serverNumberInput');
    num.disabled = !cat;
    if (!cat) num.value = '';
    $('serverNumberPrefix').textContent = (cat || '') + 'srv.';
    $('serverNumberHint').textContent = cat
      ? '→ ' + cat + 'srv.' + (num.value.trim() || '1')
      : '先选 Server Category';
  }
  $('serverCategorySelect').addEventListener('change', syncServer);
  $('serverNumberInput').addEventListener('input', syncServer);

  /* Environment 变化 → 重取 Host IP 候选并清空已选值 */
  $('envSelect').addEventListener('change', function () {
    var had = !!$('hostIpSelect').value;
    $('hostIpSelect').value = '';
    toast('已按 Environment 重取 Host IP 候选' + (had ? '，原已选值已清空' : ''));
  });

  /* 排序开关：只影响排序，不影响过滤 */
  $('descTimeToggle').addEventListener('click', function () {
    var on = this.classList.toggle('on');
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    toast(on ? 'START_TIME 倒排（新 → 旧）' : 'START_TIME 正序（旧 → 新）');
  });

  /* 即时校验：时间 */
  function checkTime() {
    var s = $('startTimeInput').value.trim(), e = $('endTimeInput').value.trim();
    if (!s && !e) { setErr('startTimeInput', '请填写开始时间与结束时间'); return false; }
    if (!TIME_RE.test(s) || !TIME_RE.test(e)) {
      setErr('startTimeInput', '时间格式应为 YYYY-MM-DD HH:mm（精确到分钟）');
      setErr('endTimeInput', '时间格式应为 YYYY-MM-DD HH:mm（精确到分钟）');
      return false;
    }
    var a = parseTime(s), b = parseTime(e);
    if (a > b) { setErr('endTimeInput', '开始时间必须早于或等于结束时间'); return false; }
    if (b - a > 86400000) { setErr('endTimeInput', '起止跨度不能超过 1 天'); return false; }
    setErr('startTimeInput', '');
    setErr('endTimeInput', '');
    return true;
  }
  $('startTimeInput').addEventListener('input', checkTime);
  $('endTimeInput').addEventListener('input', checkTime);
  $('startTimeInput').addEventListener('blur', function () {
    if (!this.value.trim()) { this.value = shiftTime($('endTimeInput').value, -60); checkTime(); }
  });
  $('endTimeInput').addEventListener('blur', function () {
    if (!this.value.trim()) { this.value = shiftTime($('startTimeInput').value, 60); checkTime(); }
  });

  /* 即时校验：星号规则（Rule Name / EQP / Carrier / Lot 四框一致） */
  var STAR = [['ruleNameInput', 'Rule Name'], ['eqpInput', 'EQP'], ['carrierInput', 'Carrier'], ['lotInput', 'Lot']];
  function checkStar(id, label) {
    var v = $(id).value.trim();
    if (!v) { setErr(id, ''); return true; }
    if (!/^[^*,]+$/.test(v) && !/^[^*,]+\\*$/.test(v)) {
      setErr(id, label + '：只支持 ABC 精确匹配或 ABC* 前缀匹配');
      return false;
    }
    setErr(id, '');
    return true;
  }
  STAR.forEach(function (pair) {
    $(pair[0]).addEventListener('input', function () { checkStar(pair[0], pair[1]); });
  });

  /* 即时校验：Min / Max Cost Time（单位秒，入参原样传秒，换算由后端做） */
  function checkCost() {
    var ok = true;
    var min = $('minCostInput').value.trim(), max = $('maxCostInput').value.trim();
    var form = /^\\d{1,5}(\\.\\d{1,2})?$/;
    if (!form.test(min) || Number(min) > 99999.99) { setErr('minCostInput', '取值 0 ~ 99999.99（秒，最多 2 位小数）'); ok = false; }
    else setErr('minCostInput', '');
    if (!form.test(max) || Number(max) > 99999.99) { setErr('maxCostInput', '取值 0 ~ 99999.99（秒，最多 2 位小数）'); ok = false; }
    else setErr('maxCostInput', '');
    if (ok && Number(min) > Number(max)) { setErr('maxCostInput', 'Max Cost Time 不能小于 Min Cost Time'); ok = false; }
    return ok;
  }
  $('minCostInput').addEventListener('input', checkCost);
  $('maxCostInput').addEventListener('input', checkCost);
  $('minCostInput').addEventListener('blur', function () { if (!this.value.trim()) { this.value = '0'; checkCost(); } });
  $('maxCostInput').addEventListener('blur', function () { if (!this.value.trim()) { this.value = '999'; checkCost(); } });

  /* 校验：Server Number（点 Search 那一刻才校验） */
  function checkServerNumber() {
    var v = $('serverNumberInput').value.trim();
    if (!v) { setErr('serverNumberInput', ''); return true; }
    if (/[\\uFF0C\\u3001;\\uFF1B]/.test(v)) { setErr('serverNumberInput', '只认英文逗号，且不能含空段'); return false; }
    var parts = v.split(',');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!/^[0-9]+$/.test(p) || Number(p) < 1 || Number(p) > 1000) {
        setErr('serverNumberInput', '每段须为 1 ~ 1000 的正整数');
        return false;
      }
    }
    setErr('serverNumberInput', '');
    return true;
  }

  /* 列表状态与按钮可用性 */
  var state = { busy: false, hasData: true, selected: null };
  var tbody = $('ruleTableBody');
  function syncActions() {
    $('btnExport').disabled = state.busy || !state.hasData;
    $('btnRuleLog').disabled = state.busy || !state.selected;
    $('btnFullLog').disabled = state.busy || !state.selected;
  }
  /* 分页组件始终显示，但未查询态下不可用、总数为 0 */
  function syncPager() {
    $('pagerTotal').textContent = state.hasData ? '共 128 条' : '共 0 条';
    var btns = $('pager').querySelectorAll('.pg-btn');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = !state.hasData || i === 0;
  }
  function setSelection(tr) {
    var rows = tbody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i] === tr;
      rows[i].classList.toggle('selected', on);
      var radio = rows[i].querySelector('.row-radio');
      if (radio) radio.checked = on;
    }
    state.selected = tr ? tr.getAttribute('data-row') : null;
    syncActions();
  }
  tbody.addEventListener('click', function (ev) {
    var hangBtn = ev.target.closest ? ev.target.closest('.hang-btn.hot') : null;
    if (hangBtn) { openHang(Number(hangBtn.getAttribute('data-hang-row'))); return; }
    var tr = ev.target.closest ? ev.target.closest('tr') : null;
    if (!tr) return;
    setSelection(tr.classList.contains('selected') ? null : tr);
  });

  $('btnSearch').addEventListener('click', function () {
    var ok = checkTime();
    if (!checkServerNumber()) ok = false;
    if (!checkCost()) ok = false;
    STAR.forEach(function (pair) { if (!checkStar(pair[0], pair[1])) ok = false; });
    if (!ok) { toast('条件不合法，已拦住本次检索', 'warn'); return; }
    state.busy = true;
    setSelection(null);
    $('ruleTable').hidden = false;
    $('emptyState').hidden = true;
    $('tableOverlay').hidden = false;
    syncActions();
    setTimeout(function () {
      state.busy = false;
      state.hasData = true;
      $('tableOverlay').hidden = true;
      syncActions();
      syncPager();
      toast('已按当前条件查询第 1 页（共 128 条）');
    }, 800);
  });

  $('btnReset').addEventListener('click', function () {
    ['envSelect', 'serverCategorySelect', 'serverNumberInput', 'ruleNameInput', 'tidInput',
      'eqpInput', 'carrierInput', 'lotInput', 'userIdInput'].forEach(function (id) { $(id).value = ''; });
    $('startTimeInput').value = DEF.start;
    $('endTimeInput').value = DEF.end;
    $('minCostInput').value = DEF.min;
    $('maxCostInput').value = DEF.max;
    $('descTimeToggle').classList.remove('on');
    $('descTimeToggle').setAttribute('aria-pressed', 'false');
    setFold(false);
    clearErr();
    syncServer();
    setSelection(null);
    state.hasData = false;
    $('ruleTable').hidden = true;
    $('emptyState').hidden = false;
    syncActions();
    syncPager();
    toast('条件已恢复默认，列表回到未查询态（不自动查询）');
  });

  $('btnExport').addEventListener('click', function () {
    toast('已导出当前页显示中的列 → RuleInfo_20260922100012.xlsx');
  });
  $('btnFullLog').addEventListener('click', function () {
    toast('已下载该块涉及全部文件的全量日志（zip）');
  });

  /* 列设置抽屉 */
  function openDrawer() {
    $('colDrawer').classList.add('open');
    $('drawerMask').classList.add('open');
  }
  function closeDrawer() {
    $('colDrawer').classList.remove('open');
    $('drawerMask').classList.remove('open');
  }
  $('btnOptionalCols').addEventListener('click', openDrawer);
  $('btnDrawerClose').addEventListener('click', closeDrawer);
  $('btnDrawerClose2').addEventListener('click', closeDrawer);
  $('drawerMask').addEventListener('click', closeDrawer);
  $('btnDrawerConfirm').addEventListener('click', function () {
    applyColumns();
    closeDrawer();
    var shown = document.querySelectorAll('#ruleTable thead tr > *:not([hidden])').length;
    var added = dynColumns().map(function (c) { return c.label; });
    toast('列设置已应用：当前 ' + shown + ' 列' +
      (added.length ? '，已追加 ' + added.join('、') : '，无动态耗时列'));
  });
  function picked(box) {
    var inputs = box.querySelectorAll('input:checked');
    var out = [];
    for (var i = 0; i < inputs.length; i++) out.push(inputs[i].value);
    return out;
  }
  $('lockObjectBox').addEventListener('change', function () {
    var list = picked(this);
    store('mes-rule-info:lock', list.join(','));
    toast(list.length ? '待确认：将追加 ' + list.map(function (v) { return 'Lock ' + v; }).join('、')
      : '待确认：移除全部 Lock 动态列');
  });
  $('callSysBox').addEventListener('change', function () {
    var list = picked(this);
    store('mes-rule-info:call', list.join(','));
    toast(list.length ? '待确认：将追加 ' + list.map(function (v) { return 'Call ' + v; }).join('、')
      : '待确认：移除全部 Call 动态列');
  });

  /* 列设置：确认后按勾选重渲染列表列（静态列显隐 + 动态列增删），不重新查询 */
  var EXEC_STATUS = ['已完成', '已完成', '已完成', '中断', '已完成', '超时封口', '已完成', '已完成'];
  /* 动态耗时列取值 = 块行数据 COST_BREAKDOWN 里 ITEM 与 GROUP 命中那条的 SUM_MS（原型用确定性算法模拟，缺项返回 null） */
  function nameHash(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h += name.charCodeAt(i) * (i + 7);
    return h;
  }
  function breakdownMs(kind, name, i) {
    if (kind === 'lock' && i % 5 === 0) return null;
    if (kind === 'call' && i % 7 === 0) return null;
    return 40 + ((kind === 'lock' ? 251 : 397) + nameHash(name) + i * 53) % 3800;
  }
  function dynColumns() {
    var cols = [];
    if ($('chkExecStatus').checked) {
      cols.push({ label: 'EXEC_STATUS', align: 'center',
        value: function (i) { return EXEC_STATUS[i % EXEC_STATUS.length]; } });
    }
    picked($('lockObjectBox')).forEach(function (obj) {
      cols.push({ label: 'Lock ' + obj, align: 'right', value: function (i) {
        var ms = breakdownMs('lock', obj, i);
        return ms === null ? '' : (ms / 1000).toFixed(3);
      } });
    });
    picked($('callSysBox')).forEach(function (sys) {
      cols.push({ label: 'Call ' + sys, align: 'right', value: function (i) {
        var ms = breakdownMs('call', sys, i);
        return ms === null ? '' : (ms / 1000).toFixed(3);
      } });
    });
    return cols;
  }
  function toggleCol(key, show) {
    var cells = document.querySelectorAll('#ruleTable [data-col="' + key + '"]');
    for (var i = 0; i < cells.length; i++) cells[i].hidden = !show;
  }
  function dynCell(tag, text, align) {
    var el = document.createElement(tag);
    el.setAttribute('data-dyn', '1');
    el.className = 'dyn-col' + (align === 'right' ? ' num' : '');
    el.textContent = text;
    return el;
  }
  function applyColumns() {
    toggleCol('totalCostSec', $('chkTotalCost').checked);
    toggleCol('itemCostSec', $('chkItemCost').checked);
    toggleCol('unaccountedSec', $('chkUnaccounted').checked);
    var stale = document.querySelectorAll('#ruleTable [data-dyn]');
    for (var s = 0; s < stale.length; s++) stale[s].parentNode.removeChild(stale[s]);
    var cols = dynColumns();
    if (!cols.length) return;
    var head = document.querySelector('#ruleTable thead tr');
    var headAt = head.querySelector('[data-col="serverHang"]');
    var rows = tbody.querySelectorAll('tr');
    for (var c = 0; c < cols.length; c++) {
      head.insertBefore(dynCell('th', cols[c].label, cols[c].align), headAt);
      for (var r = 0; r < rows.length; r++) {
        var idx = Number(rows[r].getAttribute('data-row')) - 1;
        var at = rows[r].querySelector('[data-col="serverHang"]');
        rows[r].insertBefore(dynCell('td', cols[c].value(idx), cols[c].align), at);
      }
    }
  }

  /* Rule Info Detail 弹窗：游标式按需加载 */
  var BATCH = 40, MAX_LINES = 120, detail = { lines: 0, done: false, loading: false };
  /* 日志行格式：MM/DD/YY HH:mm:ss.SS + 空格 + Server 名 + 冒号 + 日志原文。
     首行即真实块日志的原文样例，其余行按同一格式续写（同一 Server、时间递增）。 */
  var LOG_SERVER = 'FABsrv.10';
  var LOG_BODY = [
    'FwEventManager:message to process: :>>L FwSrvExecuteRuleTxn subjectName="" msgTag="" sendAck=F systemLevelObjects={ } allReferences={ } dirtySubObjects={ } securityContext="" defaultPartitionId=-1 isSecure=F tid="" ruleName="POST" lotId="A031178" eqpId="ATTAL01" attributes={ { class=ASSOC { class=A1 "FWCLIENT" } { class=A1 "FwSrv" } } { "PLAN" "ATNC100005L1P1A01.2" } { "PRODUCT" "T0314A.2" } { "SEQUENCE" "029500.1.029500" } { "STEP" "S-T-TKAL-B-01.0" } { "TIMESTAMP" "3025" } { "USER" "EAP" } } ',
    'FwSrvRuleRunner:start rule ruleName="POST" tid="20260811172031.05-0001"',
    'FwRuleDataAccess:select rule condition eqpId="ATTAL01" lotId="A031178" carrierId="C1200317"',
    'FwRuleEngine:execute rule "POST" branch 1/3 cost=3ms',
    'FwRuleEngine:execute rule "POST" branch 2/3 cost=6ms',
    'FWLockMgr:lock object LOT key="A031178" hold=8ms',
    'FwCarrierMgr:query carrier by lotId="A031178" result=C1200317 state=LOADED',
    'FwTxnSender:message to send subject="FWCarrierMove" target=MCS ack=F',
    'FWLockMgr:lock object CARRIER key="C1200317" hold=240ms',
    '<ERROR> FwLockMgr:lock object CARRIER timeout after 240ms',
    'FwRuleEngine:execute rule "POST" result=CANCELRULE reason=CARRIER_LOCK_TIMEOUT',
    'FwEventManager:message to process: :>>L FwSrvExecuteRuleTxn subjectName="FWCarrierMove" msgTag="ACK" tid="20260811172031.05-0001" ruleName="POST" lotId="A031178" eqpId="ATTAL01"',
  ];
  function logText(i) {
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    var d = new Date(2026, 7, 11, 17, 20, 31, 50);
    d.setMilliseconds(50 + (i - 1) * 70);
    var cs = ('0' + Math.floor(d.getMilliseconds() / 10)).slice(-2);
    var stamp = z(d.getMonth() + 1) + '/' + z(d.getDate()) + '/' + String(d.getFullYear()).slice(-2) + ' ' +
      z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()) + '.' + cs;
    return stamp + ' ' + LOG_SERVER + ':' + LOG_BODY[(i - 1) % LOG_BODY.length];
  }
  function loadBatch() {
    if (detail.done || detail.loading) return;
    detail.loading = true;
    var list = $('detailLogList');
    var note = document.createElement('div');
    note.className = 'log-note';
    note.textContent = '正在加载下一批日志…';
    list.appendChild(note);
    setTimeout(function () {
      list.removeChild(note);
      for (var i = 0; i < BATCH && detail.lines < MAX_LINES; i++) {
        detail.lines += 1;
        var text = logText(detail.lines);
        var line = document.createElement('div');
        line.className = 'log-line' + (text.indexOf('<ERROR>') >= 0 || text.indexOf('CANCELRULE') >= 0 ? ' err' : '');
        line.textContent = text;
        list.appendChild(line);
      }
      detail.loading = false;
      if (detail.lines >= MAX_LINES) {
        detail.done = true;
        var end = document.createElement('div');
        end.className = 'log-note';
        end.textContent = '—— 搜索完毕 ——';
        list.appendChild(end);
        $('btnFullDownload').hidden = false;
      }
    }, 420);
  }
  function openDetail() {
    detail = { lines: 0, done: false, loading: false };
    $('detailLogList').innerHTML = '';
    $('detailSearch').value = '';
    $('detailSearchCount').textContent = '';
    $('btnFullDownload').hidden = true;
    $('detailModal').classList.add('open');
    $('detailMask').classList.add('open');
    $('detailModal').setAttribute('aria-hidden', 'false');
    loadBatch();
  }
  function closeDetail() {
    $('detailModal').classList.remove('open');
    $('detailMask').classList.remove('open');
    $('detailModal').setAttribute('aria-hidden', 'true');
  }
  $('btnRuleLog').addEventListener('click', openDetail);
  $('btnCloseDetail').addEventListener('click', closeDetail);
  $('detailMask').addEventListener('click', closeDetail);
  $('detailLogList').addEventListener('scroll', function () {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 8) loadBatch();
  });
  $('detailSearch').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var lines = $('detailLogList').querySelectorAll('.log-line');
    var hits = 0;
    for (var i = 0; i < lines.length; i++) {
      var hit = !q || lines[i].textContent.toLowerCase().indexOf(q) >= 0;
      lines[i].style.display = hit ? '' : 'none';
      if (hit && q) hits += 1;
    }
    $('detailSearchCount').textContent = q ? '命中 ' + hits + ' 行（仅过滤已加载部分）' : '';
  });
  $('btnFullDownload').addEventListener('click', function () {
    toast('已下载该块全部日志 → RuleLog_FABsrv.1_20260922100012.log');
  });

  /* Server Hang 弹框：内容 = 10 号接口出参（本地模拟），按开始行时间正序；只有「关闭」 */
  var HANG_SAMPLE = [
    { start: 'FWLockMgr:acquire lock object CARRIER key="C1200317" timeout=30000ms',
      end: 'FWLockMgr:lock object CARRIER acquired key="C1200317"', cost: 31250 },
    { start: 'FWLockMgr:acquire lock object EQP key="ATTAL01" timeout=30000ms',
      end: 'FWLockMgr:lock object EQP acquired key="ATTAL01"', cost: 45380 },
    { start: 'FwTxnSender:wait ack subject="FWCarrierMove" target=MCS timeout=60000ms',
      end: 'FwTxnSender:ack received subject="FWCarrierMove"', cost: 60120 },
  ];
  function hangCountOf(rowIdx) { var i = rowIdx - 1; return i % 7 === 3 ? 2 + (i % 2) : 0; }
  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function logStamp(d) {
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    var cs = ('0' + Math.floor(d.getMilliseconds() / 10)).slice(-2);
    return z(d.getMonth() + 1) + '/' + z(d.getDate()) + '/' + String(d.getFullYear()).slice(-2) + ' ' +
      z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()) + '.' + cs;
  }
  function openHang(rowIdx) {
    var tr = document.querySelector('tr[data-row="' + rowIdx + '"]');
    var txt = function (col) {
      var td = tr.querySelector('td[data-col="' + col + '"]');
      return td ? td.textContent : '';
    };
    var base = new Date(String(txt('startTime')).replace(' ', 'T'));
    if (isNaN(base.getTime())) base = new Date(2026, 8, 22, 9, 58, 0);
    var server = txt('serverId');
    var rows = '';
    for (var k = 0; k < hangCountOf(rowIdx); k++) {
      var s = HANG_SAMPLE[k];
      var t0 = new Date(base.getTime() + 1500 + k * 60000);
      var t1 = new Date(t0.getTime() + s.cost);
      rows += '<tr>' +
        '<td>' + logStamp(t0) + '</td>' +
        '<td>' + logStamp(t1) + '</td>' +
        '<td class="num">' + (s.cost / 1000).toFixed(3) + '</td>' +
        '<td class="log-cell">' + escHtml(logStamp(t0) + ' ' + server + ':' + s.start) + '</td>' +
        '<td class="log-cell">' + escHtml(logStamp(t1) + ' ' + server + ':' + s.end) + '</td>' +
        '</tr>';
    }
    $('hangTableBox').innerHTML = '<table class="grid" id="hangTable"><thead><tr>' +
      '<th>开始行</th><th>结束行</th><th class="num">耗时</th><th>开始行日志</th><th>结束行日志</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
    $('hangModalSub').textContent = txt('ruleName') + ' · ' + txt('startTime') + ' · Hang × ' + hangCountOf(rowIdx);
    $('hangModal').classList.add('open');
    $('hangMask').classList.add('open');
    $('hangModal').setAttribute('aria-hidden', 'false');
  }
  function closeHang() {
    $('hangModal').classList.remove('open');
    $('hangMask').classList.remove('open');
    $('hangModal').setAttribute('aria-hidden', 'true');
  }
  $('btnHangClose').addEventListener('click', closeHang);
  $('hangMask').addEventListener('click', closeHang);

  /* 进页面：折叠区按上次状态还原；Host IP 候选与是否收起无关，照旧先取 */
  setFold(store(FOLD_KEY) === '1');
  syncServer();
  syncActions();
  syncPager();
})();
`;

/* ───────────────────────── 页面内容 ───────────────────────── */
const CONTENT = `
<div class="page-head">
  <div class="crumb">日志检索与分析 · 模块 1 · 功能 1</div>
  <h1>MES Rule 信息检索</h1>
  <p class="sub">按条件检索已落成的 MES 块日志；Rule / Txn 两类块一并返回，靠 Request Type 列区分</p>
</div>

<section class="card">
  <div class="card-head"><h2>查询条件</h2><span class="hint">12 项平铺 + 4 项折叠 + 1 个排序开关</span></div>
  <div class="filters">
${field('envSelect', 'Environment', select('envSelect', ['PROD', 'PIRUN']))}
${field('serverCategorySelect', 'Server Category', select('serverCategorySelect', CATEGORIES))}
  <div class="field" data-field="serverNumberInput">
    <label for="serverNumberInput">Server Number <span class="tip" id="serverNumberHint">先选 Server Category</span></label>
    <div class="input-group">
      <span class="prefix" id="serverNumberPrefix">srv.</span>
      <input class="input" id="serverNumberInput" type="text" placeholder="1,2" disabled>
    </div>
    <span class="err"></span>
  </div>
${field('startTimeInput', '开始时间', input('startTimeInput', '2026-09-22 09:00', 'YYYY-MM-DD HH:mm'), { req: true, err: true })}
${field('endTimeInput', '结束时间', input('endTimeInput', '2026-09-22 10:00', 'YYYY-MM-DD HH:mm'), { req: true, tip: '（须晚于或等于开始时间）', err: true })}
${field('ruleNameInput', 'Rule Name', input('ruleNameInput', '', 'ABC 或 ABC*'), { err: true })}
${field('tidInput', 'TID', input('tidInput', '', '20260811172031.05-0001'))}
${field('eqpInput', 'EQP', input('eqpInput', '', 'ATTAL01 或 ATTA*'), { err: true })}
${field('carrierInput', 'Carrier', input('carrierInput', '', 'C1200317 或 C1200*'), { err: true })}
${field('lotInput', 'Lot', input('lotInput', '', 'A031178 或 A0311*'), { err: true })}
${field('minCostInput', 'Min Cost Time', input('minCostInput', '0', '0'), { req: true, tip: '（秒）', err: true })}
${field('maxCostInput', 'Max Cost Time', input('maxCostInput', '999', '999'), { req: true, tip: '（秒）', err: true })}
  <div class="field" data-field="descTimeToggle">
    <label>排序</label>
    <button class="switch" id="descTimeToggle" type="button" aria-pressed="false">
      <span class="track"></span><span>Desc Time</span>
    </button>
  </div>
  </div>

  <div class="filters fold" id="foldPanel" hidden>
${field('hostIpSelect', 'Host IP', select('hostIpSelect', HOST_IPS))}
${field('userIdInput', 'User ID', input('userIdInput', '', 'EAP'))}
${field('errorCodeInput', 'Error Code', input('errorCodeInput', '', 'E1024'), { err: true })}
${field('ruleResultSelect', 'Rule Result', select('ruleResultSelect', ['PASS', 'CANCELRULE']))}
  </div>

  <div class="actions">
    <button class="btn ghost" id="btnFold">展开更多条件<span class="arrow">▼</span></button>
    <span class="spacer"></span>
    <button class="btn primary" id="btnSearch">Search</button>
    <button class="btn" id="btnReset">重置</button>
  </div>
</section>

<section class="card">
  <div class="card-head">
    <h2>结果列表</h2>
    <span class="hint">18 列 · 其中 3 列可隐藏、1 列可选（EXEC_STATUS）</span>
  </div>
  <div class="table-wrap">
    <table class="grid" id="ruleTable">
      <thead><tr><td class="sel-col sticky-left"></td>${thHtml()}</tr></thead>
      <tbody id="ruleTableBody">
${ROWS.map(rowHtml).join('\n')}
      </tbody>
    </table>
    <div class="table-overlay" id="tableOverlay" hidden><span class="spinner"></span><span>加载中…</span></div>
    <div class="empty" id="emptyState" hidden><div class="illu"></div><div>暂无数据 —— 填写条件后点 Search 开始检索</div></div>
  </div>
  <div class="pager" id="pager">
    <span id="pagerTotal">共 128 条</span>
    <span class="spacer"></span>
    <select class="page-size" id="pageSize"><option>20</option><option>50</option><option>100</option></select>
    <span>条 / 页</span>
    <button class="pg-btn" disabled>‹</button>
    <button class="pg-btn active">1</button>
    <button class="pg-btn">2</button>
    <button class="pg-btn">3</button>
    <button class="pg-btn">4</button>
    <button class="pg-btn">5</button>
    <button class="pg-btn">6</button>
    <button class="pg-btn">7</button>
    <button class="pg-btn">›</button>
  </div>
  <div class="actions">
    <button class="btn" id="btnExport">Export</button>
    <span class="vline"></span>
    <button class="btn primary" id="btnFullLog" disabled>Full Log</button>
    <button class="btn primary" id="btnRuleLog" disabled>Rule Log</button>
    <span class="spacer"></span>
    <button class="btn" id="btnOptionalCols">可选列</button>
  </div>
</section>

<div class="mask" id="drawerMask"></div>
<aside class="drawer" id="colDrawer" aria-hidden="true">
  <div class="drawer-head">
    <h3>列设置</h3>
    <button class="icon-btn" id="btnDrawerClose" type="button">×</button>
  </div>
  <p class="drawer-scope">本设置作用于本页「结果列表」；点确认即按当前页数据重渲染，不重新查询。</p>
  <div class="drawer-body">
    <div class="group">
      <div class="group-title">可隐藏列（默认显示）</div>
      <label class="chk"><input type="checkbox" id="chkTotalCost" checked> Total Cost Time</label>
      <label class="chk"><input type="checkbox" id="chkItemCost" checked> Item Cost Summary</label>
      <label class="chk"><input type="checkbox" id="chkUnaccounted" checked> UnAccounted Cost</label>
      <label class="chk"><input type="checkbox" id="chkExecStatus"> EXEC_STATUS</label>
    </div>
    <div class="group">
      <div class="group-title">Lock Object（每选中一项追加一列）</div>
      <div class="chips" id="lockObjectBox">
${chips(LOCK_OBJECTS)}
      </div>
    </div>
    <div class="group">
      <div class="group-title">Call Sys（每选中一项追加一列）</div>
      <div class="chips" id="callSysBox">
${chips(CALL_SYS)}
      </div>
    </div>
  </div>
  <div class="drawer-foot">
    <button class="btn" id="btnDrawerClose2" type="button">关闭</button>
    <button class="btn primary" id="btnDrawerConfirm" type="button">确认</button>
  </div>
</aside>

<div class="mask" id="detailMask"></div>
<div class="modal" id="detailModal" role="dialog" aria-hidden="true">
  <div class="modal-head">
    <h3>Rule Info Detail</h3>
    <span class="modal-sub">FABsrv.10 · ruleName POST · lotId A031178 · eqpId ATTAL01</span>
  </div>
  <div class="modal-search">
    <input class="input" id="detailSearch" type="text" placeholder="在已加载的日志行中搜索">
    <span class="count" id="detailSearchCount"></span>
  </div>
  <div class="log-view" id="detailLogList"></div>
  <div class="modal-foot">
    <span class="spacer"></span>
    <button class="btn primary" id="btnFullDownload" type="button" hidden>全量下载</button>
    <button class="btn" id="btnCauseAnalysis" type="button" disabled>成因分析</button>
    <button class="btn" id="btnCloseDetail" type="button">退出</button>
  </div>
</div>

<div class="mask" id="hangMask"></div>
<div class="modal" id="hangModal" role="dialog" aria-hidden="true">
  <div class="modal-head">
    <h3>Server Hang List</h3>
    <span class="modal-sub" id="hangModalSub"></span>
  </div>
  <div class="hang-wrap" id="hangTableBox"></div>
  <div class="modal-foot">
    <span class="spacer"></span>
    <button class="btn" id="btnHangClose" type="button">关闭</button>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
${PAGE_SCRIPT}
</script>
`;

/* ───────────────────────── 规格清单（唯一事实源：人类标注与机器规格都由它派生）───────────────────────── */
const STAR_RULES = [
  'ABC = 精确匹配；ABC* = 前缀匹配（值以 ABC 开头）',
  '星号只允许出现在末尾且只有一个：*、*ABC、AB*C、ABC** 判非法 → 拦住不发请求',
  '即时校验：标红 + 错误文案；点 Search 被拦住（与时间控件同口径）',
  '块侧字段为多值时，命中其中任一即算',
  '留空 = 不过滤',
];

const spec = {
  schema: SKILL,
  title: 'MES Rule 信息检索',
  summary: '三段式整页：上 = 查询条件区（12 项平铺 + 4 项折叠 + 1 个排序开关，装进 POST 的 parameters），' +
    '中 = 结果列表（分页 + 列设置抽屉，列值一律取当前页出参；末列 Server Hang 行内按钮），下 = 针对列表中选中行的操作按钮（Export、Rule Log、Full Log、可选列），' +
    '另含 Rule Info Detail 弹窗（游标式按需加载）与 Server Hang 弹框。接口口径依 01 文档 §5。',
  regions: [
    { id: 'search', label: '查询条件区', role: 'search', desc: '平铺 12 项 + 排序开关共 13 格，每行 5 个 → 5 / 5 / 3；折叠区 4 项默认收起；末尾一行放折叠开关与 Search、重置' },
    { id: 'list', label: '结果列表区', role: 'table', desc: '分页列表 + 分页组件；默认每页 20 条（档位 20、50、100），总条数取出参 total' },
    { id: 'actions', label: '底部操作区', role: 'actions', desc: 'Export、Rule Log、Full Log、可选列' },
    { id: 'drawer', label: '列设置抽屉', role: 'drawer', desc: '可隐藏三列与 EXEC_STATUS 的显隐、Lock Object 与 Call Sys 两个多选；确认后按当前页出参就地重渲染列' },
    { id: 'detail', label: 'Rule Info Detail 弹窗', role: 'detail', desc: '全局搜索行 + 日志行滚动区（游标式按需加载）+ 底部全量下载、成因分析、退出' },
    { id: 'hang', label: 'Server Hang 弹框', role: 'modal', desc: '该块全部 Server Hang List：开始行、结束行、耗时、开始行日志、结束行日志；按开始行时间正序；只有「关闭」' },
  ],
  apis: [
    { id: 'envList', method: 'GET', path: '/log-viewer/api/v1/env/list', desc: 'Environment 候选' },
    { id: 'ipAddressList', method: 'GET', path: '/log-viewer/api/v1/ipaddress/list', desc: 'Host IP 候选（入参 environment 可缺省）' },
    { id: 'serverCategoryList', method: 'GET', path: '/log-viewer/api/v1/server_category/list', desc: 'Server Category 候选' },
    { id: 'ruleResultList', method: 'GET', path: '/log-viewer/api/v1/rule_result/list', desc: 'Rule Result 候选' },
    { id: 'lockObjectList', method: 'GET', path: '/log-viewer/api/v1/lock_object/list', desc: 'Lock Object 多选候选' },
    { id: 'callSysList', method: 'GET', path: '/log-viewer/api/v1/call_sys/list', desc: 'Call Sys 多选候选' },
    { id: 'ruleInfoPage', method: 'POST', path: '/log-viewer/api/v1/rule_info/page', desc: '结果分页查询' },
    { id: 'ruleInfoDetail', method: 'GET', path: '/log-viewer/api/v1/rule_info/detail', desc: 'Rule Info Detail 日志按游标分页' },
    { id: 'ruleInfoFullLog', method: 'POST', path: '/log-viewer/api/v1/rule_info/full_log', desc: '按块涉及的全部文件还原、打包 zip 下载' },
    { id: 'ruleInfoHangList', method: 'GET', path: '/log-viewer/api/v1/rule_info/hang_list', desc: 'Server Hang 弹框明细（该块全部 Hang，不分页）' },
  ],
  controls: [
    {
      selector: '#envSelect', kind: 'select', label: 'Environment', region: '查询条件区',
      param: 'env', options: ['PROD', 'PIRUN'], placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤'],
      on: { load: ['进页面加载候选值'], change: ['重取 Host IP 候选值', '清空已选的 Host IP'] },
      apis: ['envList'],
      apiNotes: [
        '出参：统一响应包里的 `data.env` = 字符串数组（候选值）',
        '入参位置：`parameters.env`（16 项过滤条件都装在 parameters 里）',
        '失败时轻提示错误信息，候选保持为空',
      ],
    },
    {
      selector: '#serverCategorySelect', kind: 'select', label: 'Server Category', region: '查询条件区',
      param: 'serverCategory', options: ['FAB', 'LIST', 'QUERY', 'IDE', 'XSITE'], placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤', '为空时 Server Number 置灰不可输入'],
      on: { change: ['清空时一并清空 Server Number', '改选另一个值时 Server Number 保留原值'] },
      apis: ['serverCategoryList'],
      apiNotes: [
        '出参：`data.serverCategory` = 字符串数组，取值 LIST、QUERY、FAB、IDE、XSITE 这一类服务器类别',
        '入参位置：`parameters.serverCategory`',
      ],
    },
    {
      selector: '#serverNumberInput', kind: 'input', label: 'Server Number', region: '查询条件区',
      param: 'serverId', placeholder: '1,2（英文逗号分隔多值）', format: '每段 1 ~ 1000 的正整数',
      dependsOn: ['Server Category 已有值（无值时本框置灰）'],
      rules: [
        '以 Category 前缀拼成 SERVER_ID：Category + srv. + Number（如 FAB 配 25 得到 FABsrv.25）',
        '点 Search 时才校验：按英文逗号拆分 → 逐段去空格 → 逐段验 1 ~ 1000 正整数 → 去重 → 英文逗号拼回',
        '空段（1, 或 1,,2）与全角逗号（1，2）判非法 → 拦住不发请求',
        'Category 清空则本框值清空；Category 改选则保留原值',
      ],
      notes: ['本框左侧实时显示拼出的前缀（Category + srv.），标签后实时显示拼出的 SERVER_ID 示例，便于核对'],
      apiNotes: ['入参：`parameters.serverId` 是字符串数组，元素是拼好的 ID（如 FABsrv.25）；命中任一即可'],
    },
    {
      selector: '#startTimeInput', kind: 'input', label: '开始时间', region: '查询条件区',
      required: true, param: 'startTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: [
        '区间下界：开始时间 ≤ START_TIME ≤ 结束时间（闭区间）',
        '即时校验：开始时间 ≤ 结束时间（同一分钟判合法）；两者差值 ≤ 1 天',
        '不合法时标红 + 错误文案；点 Search 被拦住、不发请求',
        '清空后自动补为「结束时间 − 1 小时」',
      ],
      notes: ['进页面初值 = 当前时刻 − 1 小时；选择器精确到分钟'],
      apiNotes: [
        '入参：`parameters.startTime`，格式 `yyyyMMddHHmm`（如 202609221543）',
        '页面上按 `YYYY-MM-DD HH:mm` 填，提交前转成上述紧凑格式',
      ],
    },
    {
      selector: '#endTimeInput', kind: 'input', label: '结束时间', region: '查询条件区',
      required: true, param: 'endTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: [
        '区间上界：开始时间 ≤ START_TIME ≤ 结束时间（闭区间）',
        '即时校验口径与开始时间一致（同一分钟判合法、差值 ≤ 1 天）',
        '标签后常显弱提示「（须晚于或等于开始时间）」，不等报错就知道规则',
        '清空后自动补为「开始时间 + 1 小时」',
      ],
      notes: ['进页面初值 = 当前时刻'],
      apiNotes: ['入参：`parameters.endTime`，格式 `yyyyMMddHHmm`'],
    },
    {
      selector: '#ruleNameInput', kind: 'input', label: 'Rule Name', region: '查询条件区',
      param: 'ruleName', placeholder: 'ABC 或 ABC*',
      rules: STAR_RULES,
      apiNotes: ['入参：`parameters.ruleName`；`ABC*` 由后端做前缀匹配'],
    },
    {
      selector: '#tidInput', kind: 'input', label: 'TID', region: '查询条件区',
      param: 'tid', placeholder: '20260811172031.05-0001',
      rules: ['单项值；精确比对，命中任一即算', '星号当普通字符处理，不做前缀语义、不拦', '留空 = 不过滤'],
      apiNotes: ['入参：`parameters.tid`；后端为 keyword，精确比对'],
    },
    {
      selector: '#eqpInput', kind: 'input', label: 'EQP', region: '查询条件区',
      param: 'eqpId', placeholder: 'ATTAL01 或 ATTA*',
      rules: STAR_RULES,
      apiNotes: ['入参：`parameters.eqpId`'],
    },
    {
      selector: '#carrierInput', kind: 'input', label: 'Carrier', region: '查询条件区',
      param: 'carrierId', placeholder: 'C1200317 或 C1200*',
      rules: STAR_RULES,
      apiNotes: ['入参：`parameters.carrierId`'],
    },
    {
      selector: '#lotInput', kind: 'input', label: 'Lot', region: '查询条件区',
      param: 'lotId', placeholder: 'A031178 或 A0311*',
      rules: STAR_RULES,
      apiNotes: ['入参：`parameters.lotId`'],
    },
    {
      selector: '#minCostInput', kind: 'input', label: 'Min Cost Time', region: '查询条件区',
      required: true, param: 'minCost', format: '0 ~ 99999.99（秒，小数点后最多 2 位）',
      rules: [
        '单位秒；入参原样传秒，不做 ×1000 换算 —— 换算由后端做',
        '过滤：Min ≤ TOTAL_COST_MS ≤ Max（后端把秒换算成毫秒后与 TOTAL_COST_MS 比）',
        '即时校验：Min > Max 判不合法，标红 + 错误文案',
        '清空后自动补 0',
      ],
      notes: ['进页面默认值 0'],
      apiNotes: ['入参：`parameters.minCost`，原样传秒（值域 0 ~ 99999.99）'],
    },
    {
      selector: '#maxCostInput', kind: 'input', label: 'Max Cost Time', region: '查询条件区',
      required: true, param: 'maxCost', format: '0 ~ 99999.99（秒，小数点后最多 2 位）',
      rules: [
        '单位秒；入参原样传秒，不做 ×1000 换算 —— 换算由后端做',
        '即时校验：Max < Min 判不合法',
        '清空后自动补 999',
      ],
      notes: ['进页面默认值 999'],
      apiNotes: ['入参：`parameters.maxCost`，原样传秒（值域 0 ~ 99999.99）'],
    },
    {
      selector: '#descTimeToggle', kind: 'toggle', label: '排序开关 Desc Time', region: '查询条件区',
      param: 'descTime',
      rules: [
        '默认关闭',
        '关闭 = 按块文档 START_TIME 正序（旧 → 新）；打开 = 按 START_TIME 倒排（新 → 旧）',
        '只影响排序，不影响过滤',
      ],
      apiNotes: ['入参：`parameters.descTime` 布尔值；true = 倒排（新 → 旧），false = 正序'],
    },
    {
      selector: '#btnFold', kind: 'button', label: '展开更多条件', region: '查询条件区',
      rules: [
        '控制折叠区 4 项（Host IP、User ID、Error Code、Rule Result）的显隐，默认收起',
        '状态记入浏览器本地，下次进页面按上次状态还原',
      ],
      on: { click: ['收起那一刻立即清空这 4 项已填的值（不等点 Search）', '重新展开看到的是空输入'] },
    },
    {
      selector: '#btnSearch', kind: 'button', label: 'Search', region: '查询条件区',
      rules: ['调接口前对全部条件做前置校验，不合法不发请求', '被拦住时给轻提示，按钮不做置灰（置灰会让用户不知道为什么点不了）'],
      on: { click: ['校验通过后把 16 项条件装进 parameters，pageIndex 传 1、pageSize 传 20，查第 1 页', '清空列表的选中行'] },
      apis: ['ruleInfoPage'],
      apiNotes: [
        '入参：`pageIndex` = 1、`pageSize` = 20；16 项过滤条件放在 `parameters` 里，字段名见各条件控件的标注',
        '出参：统一响应包 `{ success, errCode, data }`；`data.total` 给分页器显示「共 N 条」，`data.contents[]` 是当前页行数据',
        '失败时列表区给出错误提示与重试入口',
      ],
    },
    {
      selector: '#btnReset', kind: 'button', label: '重置', region: '查询条件区',
      rules: [
        '条件区恢复进页面默认值：下拉与输入类清空；开始时间 = 当前时刻 − 1 小时、结束时间 = 当前时刻；Min 与 Max Cost Time = 0 与 999；Desc Time 关闭',
        '结果列表清空回到未查询态，Export、Rule Log、Full Log 三个按钮都不可用',
      ],
      on: { click: ['清空列表选中行', '不自动查询'] },
      apiNotes: ['不调接口，纯前端复位'],
    },
    {
      selector: '#hostIpSelect', kind: 'select', label: 'Host IP', region: '查询条件区',
      param: 'ipaddress', placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤', '虽默认收起，进页面照旧先取候选', 'Environment 变化时清空已选值'],
      on: { load: ['进页面调候选接口（不带参）', 'Environment 选值后再调一次并带上 `environment` 参数'] },
      apis: ['ipAddressList'],
      apiNotes: [
        '入参：`environment`（可缺省）；出参：`data.ipaddress` = 字符串数组',
        '提交时键名照原样全小写：`parameters.ipaddress`',
      ],
    },
    {
      selector: '#userIdInput', kind: 'input', label: 'User ID', region: '查询条件区',
      param: 'userId', placeholder: 'EAP',
      rules: ['单项值；精确比对（等值），命中块侧多值字段中任一即算', '星号当普通字符处理，不做前缀语义、不拦', '留空 = 不过滤'],
      apiNotes: ['入参：`parameters.userId`，精确等值'],
    },
    {
      selector: '#errorCodeInput', kind: 'input', label: 'Error Code', region: '查询条件区',
      param: 'errorCode', placeholder: 'E1024',
      rules: ['单项值，不做模糊匹配', '块侧字段为多值时命中其中任一即算', '留空 = 不过滤'],
      apiNotes: ['入参：`parameters.errorCode`'],
    },
    {
      selector: '#ruleResultSelect', kind: 'select', label: 'Rule Result', region: '查询条件区',
      param: 'ruleResult', options: ['PASS', 'CANCELRULE'], placeholder: '不限制',
      rules: ['非必填；不选 = 不过滤', '列表里的标红只认 CANCELRULE，与本筛选项是否选中无关'],
      apis: ['ruleResultList'],
      apiNotes: [
        '出参：`data.ruleResult` = 字符串数组（如 PASS、CANCELRULE）',
        '入参：`parameters.ruleResult`，等值匹配',
      ],
    },
    {
      selector: '#ruleTable', kind: 'table', label: '结果列表', region: '结果列表区',
      rules: [
        '列顺序：14 恒显示 → 3 可隐藏 → EXEC_STATUS → 动态耗时列 → Server Hang 末列',
        '多值字段显示首值 + 角标；耗时三列按秒（3 位小数）；Rule Result = CANCELRULE 标红',
        '行选择单选（行首单选框或点击整行）；翻页保留，重新 Search 或重置清空',
        '空结果 / 加载中：三个操作按钮都不可用；加载中显示加载动画',
      ],
      apis: ['ruleInfoPage'],
      apiNotes: [
        '行数据 = 出参 `data.contents[]`，字段与列同名：env ipaddress serverId ruleName requestType startTime endTime ruleResult errorCode eqpId lotId carrierId userId tid totalCostTime costSummary unaccountedCost execStatus',
        '多值字段出参为数组（errorCode、eqpId、lotId、carrierId、tid）；出参 `id` = 块 _id，不出列，留给 Rule Log 与 Full Log 当入参',
        '动态耗时列取 `costBreakDown[]` 里 `item` 与 `group` 命中那条的 `summary`；出参无 Server Hang 字段',
      ],
    },
    {
      selector: '#pager', kind: 'pager', label: '分页组件', region: '结果列表区',
      rules: ['始终显示（只有一页时也显示）', '默认每页 20 条，档位 20、50、100', '总条数显示「共 N 条」，取自出参 `total`'],
      on: { change: ['切换页码或每页条数后重新请求该页：pageIndex 传目标页、pageSize 传 20 或 50 或 100', '翻页保留已选中的行'] },
      apis: ['ruleInfoPage'],
      apiNotes: ['出参 `data.totalPage` 给页码数量，`data.total` 给总条数；`data.pageIndex` 与 `data.pageSize` 回显当前页'],
    },
    {
      selector: '.hang-btn', kind: 'button', label: 'Server Hang 行内按钮', region: '结果列表区',
      rules: [
        '按钮带数量，如 Hang (3)',
        '数量 > 0：按钮红色、可点击，打开 Server Hang 弹框；数量 ≤ 0：按钮置灰、不可点击',
        '本期 Hang 未落库：按钮按「数量 ≤ 0」渲染（恒置灰、点不开）；落库后启用',
      ],
      notes: ['列位置：列表最后一列，永远最后', '数量 = page 出参 `contents[].hangCount`（HANG_LIST 长度）；列表不带 HANG_LIST 本体'],
      apis: ['ruleInfoHangList'],
      apiNotes: [
        '点击打开弹框时调 GET /log-viewer/api/v1/rule_info/hang_list，入参 `id` = 该行的块 id（page 出参 `contents[].id`）',
        '原型按落库后实态演示：部分行 hangCount > 0（红色可点开弹框）、其余行演示置灰态；本期未落库前线上恒置灰',
      ],
    },
    {
      selector: '#hangModal', kind: 'modal', label: 'Server Hang 弹框', region: 'Server Hang 弹框',
      rules: [
        '列（按序）：开始行、结束行、耗时、开始行日志、结束行日志',
        '开始行 / 结束行 = 该行的日志时间；开始行日志 / 结束行日志 = 该行的日志原文',
        '耗时按秒、3 位小数；列表按开始行时间正序',
        '按钮只有「关闭」一个',
        'Hang Reason 列推后（接口已带回 hangReason 字段，弹框暂不展示）',
      ],
      apis: ['ruleInfoHangList'],
      apiNotes: [
        '出参条目字段：startTime、endTime、hangCostMs、startLineLog、endLineLog、hangReason（推后不出列）、startLineId / endLineId（不出列，跳原文锚备用）',
        '一个块内条数有限，不分页；按 startTime 升序原样输出',
      ],
    },
    {
      selector: '#btnExport', kind: 'button', label: 'Export', region: '底部操作区',
      rules: [
        '列表有值时可用；空结果时不可用',
        '范围 = 当前页的列表内容；目标格式 Excel',
        '只导显示中的列，隐藏列不导出',
        'Server Hang 列不导出（它是按钮，不是数据）',
        '文件名：RuleInfo_导出时刻 yyyyMMddHHmmss.xlsx',
      ],
      apiNotes: ['不调后端：当前页出参在前端生成 Excel；导出接口文档未给出（待确认）'],
    },
    {
      selector: '#btnRuleLog', kind: 'button', label: 'Rule Log', region: '底部操作区',
      dependsOn: ['列表已选中一行'],
      rules: ['选中一行时可用；取消选中则不可用'],
      on: { click: ['用该行的块 _id 拉取日志，打开 Rule Info Detail 弹窗'] },
      apis: ['ruleInfoDetail'],
      apiNotes: ['入参：`id` = 该行的块 `_id`；首次调用 `lastFingerprint` 与 `lastOffset` 留空', '失败时轻提示错误信息'],
    },
    {
      selector: '#btnFullLog', kind: 'button', label: 'Full Log', region: '底部操作区',
      dependsOn: ['列表已选中一行'],
      rules: [
        '选中一行时可用',
        '入参 id = 该行的块 _id；后端由它找出该块涉及的全部文件，逐个做文件级还原，打包成 zip',
        '每个文件一个 .log，文件内按 LOG_OFFSET 升序；块只落在一个文件里时 zip 内就 1 个',
        '与弹窗底部「全量下载」刻意分成两个动作：Full Log 是文件级（块涉及的全部文件、每个文件的全部行，先按文件分组）；全量下载是块级（本块自己的全部行，先按 LOG_FINGERPRINT 分组）',
      ],
      apis: ['ruleInfoFullLog'],
      apiNotes: ['出参是 zip 文件本身（直接下载，不走统一响应包）'],
    },
    {
      selector: '#btnOptionalCols', kind: 'button', label: '可选列', region: '底部操作区',
      on: { click: ['打开列设置抽屉'] },
      apiNotes: ['不调接口（纯前端行为）'],
    },
    {
      selector: '#colDrawer', kind: 'drawer', label: '列设置抽屉', region: '列设置抽屉',
      rules: [
        '内容四项：可隐藏三列显隐（默认勾上）、EXEC_STATUS 显隐（默认不勾）、Lock Object 多选、Call Sys 多选',
        '不做列拖拽排序，也不设「恢复默认」按钮',
        '首行小字写明作用域 = 本页结果主列表',
        '列值一律取当前页接口出参，不额外请求',
      ],
      on: { load: ['进页面取 Lock Object 与 Call Sys 的候选值'] },
      apiNotes: ['Lock Object 与 Call Sys 的勾选记入浏览器本地，下次进页面还原'],
    },
    {
      selector: '#lockObjectBox', kind: 'checkbox', label: 'Lock Object 多选', region: '列设置抽屉',
      rules: [
        '每选中一个锁对象追加一列，列名 = Lock 加一个空格加对象名（如 Lock EQP）',
        '动态耗时列追加在列表最后、Server Hang 列之前；选 N 项追加 N 列',
        '取值：出参 `costBreakDown[]` 里 `item` = LOCK 且 `group` = 本列锁对象那条的 `summary`（秒）；缺该项耗时则单元格显示空',
      ],
      on: { change: ['勾选记入浏览器本地'] },
      apis: ['lockObjectList'],
      apiNotes: ['出参：`data.lockObject` = 字符串数组（如 EQP、CARRIER、LOT）'],
    },
    {
      selector: '#callSysBox', kind: 'checkbox', label: 'Call Sys 多选', region: '列设置抽屉',
      rules: [
        '每选中一个调用系统追加一列，列名 = Call 加一个空格加系统名（如 Call MCS）',
        '取值：出参 `costBreakDown[]` 里 `item` = CALL 且 `group` = 本列被调系统那条的 `summary`（秒）',
        '动态列总条数 N = Lock Object 与 Call Sys 选中项数之和',
      ],
      on: { change: ['勾选记入浏览器本地'] },
      apis: ['callSysList'],
      apiNotes: ['出参：`data.calledSystem` = 字符串数组（如 MCS、R2R、RMS、SPC、RTD）'],
    },
    {
      selector: '#btnDrawerConfirm', kind: 'button', label: '确认（列设置）', region: '列设置抽屉',
      rules: [
        '点确认后关闭抽屉，按当前页已有数据直接重渲染列表的列，不重新查询',
        '可隐藏三列按勾选显隐；EXEC_STATUS 勾上才出现，位置在可隐藏列之后',
        'Lock Object 与 Call Sys 的每个勾选项各追加一列，列名 = Lock 或 Call 加一个空格加选项名，追加在 Server Hang 之前',
        '取消勾选即撤掉对应列；重新勾选再确认即重新追加',
        '列显隐同时影响 Export 的列范围',
      ],
      on: { click: ['应用列显隐与动态耗时列'] },
      apiNotes: ['不调接口：列值一律取当前页出参（`contents[]` 与 `costBreakDown[]`），就地追加或撤掉，行数据不动、不重查'],
    },
    {
      selector: '#detailModal', kind: 'modal', label: 'Rule Info Detail 弹窗', region: 'Rule Info Detail 弹窗',
      rules: [
        '结构自上而下：全局搜索行、日志行滚动区、底部按钮（全量下载、成因分析、退出）',
        '关闭后再打开，从头重新加载（`lastFingerprint` 与 `lastOffset` 重新置空）',
        '日志按原文一行一条显示，不做加工',
        '全局搜索只过滤已加载到前端的那部分日志行',
      ],
      on: { load: ['打开弹窗即按 `id` 拉第一批日志'] },
      apiNotes: ['打开弹窗触发一次日志接口：入参 `id` = 该行块 _id，`lastFingerprint` 与 `lastOffset` 留空'],
    },
    {
      selector: '#detailSearch', kind: 'input', label: '全局搜索行', region: 'Rule Info Detail 弹窗',
      placeholder: '在已加载的日志行中搜索',
      rules: ['只过滤已加载到前端的那部分日志行'],
      on: { input: ['输入即时过滤当前已加载的日志行并给出命中行数'] },
    },
    {
      selector: '#detailLogList', kind: 'other', label: '日志行滚动区', region: 'Rule Info Detail 弹窗',
      rules: [
        '首次入参：`id` = 块 _id，`lastFingerprint` 与 `lastOffset` 留空',
        '返回：`data.raw` = 本次日志原文（多行以换行符拼接成一个字符串），`data.finished` = 是否搜索完毕',
        '每批条数由后端定，前端不传',
        '滚动到最底部时按上一次的 `finished` 决定是否再调；再调带上 `lastFingerprint` = 上次返回的 `fingerprint`、`lastOffset` = 上次返回的 `offset`',
        '新日志追加到最底部；加载中显示加载效果；全部取完后最底部显示「搜索完毕」',
        '日志原文一条一行；超过显示区宽度时自动换行，不横向滚动、不截断',
      ],
      apis: ['ruleInfoDetail'],
      apiNotes: [
        '出参 `data.fingerprint` 与 `data.offset` 是下一批的游标，原样回传给 `lastFingerprint` 与 `lastOffset`',
        '日志还原按 `LOG_FINGERPRINT` + `LOG_OFFSET` 两级排序（04 §5.2.4），游标用 (fingerprint, offset) 这一对',
      ],
    },
    {
      selector: '#btnFullDownload', kind: 'button', label: '全量下载', region: 'Rule Info Detail 弹窗',
      rules: ['全部日志加载完毕后按钮才出现', '把该块全部日志行拼成一个 .log 文件下载'],
      apiNotes: ['不调接口：数据来源 = 已加载的该块全部日志行（前端拼接，不重新请求）'],
    },
    {
      selector: '#btnCauseAnalysis', kind: 'button', label: '成因分析（占位、禁用）', region: 'Rule Info Detail 弹窗',
      rules: ['本期暂存、禁用，为后续的 AI 分析预留'],
      apiNotes: ['分析接口未定（待确认）'],
    },
    {
      selector: '#btnCloseDetail', kind: 'button', label: '退出', region: 'Rule Info Detail 弹窗',
      rules: ['关闭弹窗；再次打开从头重新加载'],
      on: { click: ['关闭弹窗'] },
      apiNotes: ['不调接口（纯前端行为）'],
    },
  ],
  table: {
    selector: '#ruleTable',
    dataApi: 'ruleInfoPage',
    columns: COLUMNS,
    pagination: { api: 'ruleInfoPage', pageParam: 'pageIndex', pageSize: 20, serverSide: true, totalField: 'total' },
    rowSelection: { mode: 'single', requiredBy: ['#btnRuleLog', '#btnFullLog'], clearedOn: ['重新 Search', '点重置'] },
  },
  mock: [
    '所有接口的路径、方法、入参与出参字段依 01 文档 §5；原型不真实发请求，数据全为本地模拟',
    '统一响应包 `{ success, errCode, data }` 未在原型里体现（没有真实请求）；下载类出参不走该包',
    '进页面即呈现「正常态」数据；真实页面进页面是未查询态，点 Search 后才有结果（点重置可看到未查询态、点 Search 可看到加载态）',
    '列表 20 行为本地模拟数据；总条数 128、翻页与每页条数档位均为静态演示',
    '搜索区候选值（Environment、Host IP、Server Category、Rule Result、Lock Object、Call Sys）为本地静态数组，取值集合按文档 §5.3 对齐',
    'Rule Info Detail 的日志行与游标触底加载为前端模拟（每批 40 行、共 120 行后显示搜索完毕）',
    '日志行示例取自真实块日志：格式为 MM/DD/YY HH:mm:ss.SS 加空格加 Server 名加冒号加日志原文；首行是原文样例，其余行按同一格式续写',
    'Export、Full Log、全量下载只弹轻提示，不产生真实文件下载',
    '列设置会真的增删列表列（静态列显隐 + EXEC_STATUS 与动态耗时列注入）；动态耗时列的取值由确定性算法模拟，真实页面取当前页出参 `costBreakDown[]` 里命中那条的 `summary`',
    'Server Hang 原型按落库后实态演示：部分行 hangCount > 0（红色可点开弹框）、其余行演示置灰态；本期未落库前线上按钮恒置灰',
    'Server Hang 弹框内容为本地模拟（耗时、开始/结束行时间由确定性算法生成）；真实数据来自 GET /log-viewer/api/v1/rule_info/hang_list 出参',
  ],
  openQuestions: [
    'Export 的导出接口文档未给出，当前按「前端生成 Excel」实现',
    '弹窗「成因分析」为后续 AI 分析预留，接口未定',
    '01 文档与 05 文档 §4.8 对时间区间口径不一致：01 为「开始 ≤ 结束、同分钟判合法」，05 为「开始 < 结束、同分钟不合法」；本原型依 01',
  ],
};

const html = buildPrototype({ title: spec.title, styles: STYLES, content: CONTENT, spec });
writePrototype(OUT, html);

console.log('生成完成：' + OUT);
console.log('控件 ' + spec.controls.length + ' 个 · 接口 ' + spec.apis.length + ' 个 · 静态列 ' + COLUMNS.length + ' 列');


