/**
 * 生成「MES Rule 实效分析」标注原型（单文件自包含 HTML）。
 *
 * 设计依据：docs/模块1-日志检索与分析/02-MES Rule实效分析.md
 * 视觉令牌：docs/05-视觉与交互规范.md（AntD 5 语汇 · 高级绿 #2F7D5A · 圆角 6px）
 * 生成框架：~/.claude/skills/annotated-prototype（只替换 4 个占位符）
 *
 * 用法：node build-02.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototype, writePrototype } from '/Users/xuejianming/.claude/skills/annotated-prototype/tests/lib/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'MES-Rule实效分析-annotated-prototype.html');
const SKILL = 'annotated-prototype/spec@1';

/* ───────────────────────── 列表列定义（唯一事实源：表头 + 规格清单同源）─────────────────────────
   顺序依 02 文档 §2.3 / §3.7（照 01 §3.2，无 Server Hang 列）：
   恒显示 14 列 → 可隐藏 3 列；EXEC_STATUS 与动态耗时列运行时注入，不在静态表头。
   Source 列表为静态表头；Target 列表由 JS 用同一份列定义渲染（列集合与顺序共用）。 */
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
];

/* ───────────────────────── 候选值与列表假数据 ───────────────────────── */
const LOCK_OBJECTS = ['EQP', 'CARRIER', 'LOT'];
const CALL_SYS = ['MCS', 'R2R', 'RMS', 'SPC', 'RTD'];

const pad = (n, w = 2) => String(n).padStart(w, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;

/* Source 列表（问题样本：TID 命中多条 —— 不假设 TID 只出一条；正序：越往下越旧） */
const SRC_ROWS = [
  { env: 'PIRUN', hostIp: '10.18.100.2', serverId: 'FABsrv.10', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'CANCELRULE', errCode: ['E1024'], eqp: ['ATTAL01'], lot: ['A031178'], carrier: ['C1200317'],
    user: ['EAP'], tid: '20260922093012.147-0007',
    t0: new Date(2026, 8, 22, 9, 30, 12, 140), totalMs: 61240, itemMs: 4310 },
  { env: 'PIRUN', hostIp: '10.18.100.2', serverId: 'FABsrv.10', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'CANCELRULE', errCode: ['E1024', 'E2201'], eqp: ['ATTAL01'], lot: ['A031178'], carrier: ['C1200317'],
    user: ['EAP'], tid: '20260922093012.147-0007',
    t0: new Date(2026, 8, 22, 9, 12, 40, 20), totalMs: 88310, itemMs: 5120 },
  { env: 'PIRUN', hostIp: '10.18.100.5', serverId: 'FABsrv.22', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031178'], carrier: ['C1200317'],
    user: ['EAP'], tid: '20260922093012.147-0007',
    t0: new Date(2026, 8, 22, 8, 58, 3, 500), totalMs: 52780, itemMs: 4880 },
  { env: 'PIRUN', hostIp: '10.18.100.2', serverId: 'FABsrv.10', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'CANCELRULE', errCode: ['E1024'], eqp: ['ATTAL01'], lot: ['A031178'], carrier: ['C1200317'],
    user: ['OP01'], tid: '20260922093012.147-0007',
    t0: new Date(2026, 8, 22, 8, 31, 55, 700), totalMs: 74190, itemMs: 5020 },
  { env: 'PIRUN', hostIp: '10.18.100.8', serverId: 'FABsrv.31', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031178'], carrier: ['C1200317'],
    user: ['EAP'], tid: '20260922093012.147-0007',
    t0: new Date(2026, 8, 22, 8, 5, 19, 300), totalMs: 45330, itemMs: 4710 },
].map((r, i) => ({
  ...r, idx: i + 1,
  startTime: stamp(r.t0),
  endTime: stamp(new Date(r.t0.getTime() + r.totalMs)),
  itemMs: r.itemMs, unaccountedMs: r.totalMs - r.itemMs,
}));

/* Target 列表（对照基准：倒排 —— 越往下越旧；快速检索取第 1 条） */
const TGT_ROWS = [
  { env: 'PIRUN', hostIp: '10.18.100.3', serverId: 'FABsrv.18', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031180'], carrier: ['C1200319'],
    user: ['EAP'], tid: '20260922093140.012-0011',
    t0: new Date(2026, 8, 22, 9, 31, 40, 10), totalMs: 1120, itemMs: 980 },
  { env: 'PIRUN', hostIp: '10.18.100.3', serverId: 'FABsrv.18', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031180'], carrier: ['C1200319'],
    user: ['EAP'], tid: '20260922092518.330-0009',
    t0: new Date(2026, 8, 22, 9, 25, 18, 330), totalMs: 1310, itemMs: 1105 },
  { env: 'PIRUN', hostIp: '10.18.100.2', serverId: 'FABsrv.10', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL02'], lot: ['A031181'], carrier: ['C1200320'],
    user: ['EAP'], tid: '20260922091907.556-0006',
    t0: new Date(2026, 8, 22, 9, 19, 7, 550), totalMs: 1475, itemMs: 1190 },
  { env: 'PIRUN', hostIp: '10.18.100.5', serverId: 'FABsrv.22', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031180'], carrier: ['C1200319'],
    user: ['EAP'], tid: '20260922091022.801-0003',
    t0: new Date(2026, 8, 22, 9, 10, 22, 800), totalMs: 980, itemMs: 860 },
  { env: 'PIRUN', hostIp: '10.18.100.8', serverId: 'FABsrv.31', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031182'], carrier: ['C1200321'],
    user: ['OP02'], tid: '20260922085844.129-0002',
    t0: new Date(2026, 8, 22, 8, 58, 44, 120), totalMs: 1585, itemMs: 1290 },
  { env: 'PIRUN', hostIp: '10.18.100.8', serverId: 'FABsrv.31', ruleName: 'POST', requestType: 'Rule',
    ruleResult: 'PASS', errCode: [], eqp: ['ATTAL01'], lot: ['A031180'], carrier: ['C1200319'],
    user: ['EAP'], tid: '20260922084730.774-0001',
    t0: new Date(2026, 8, 22, 8, 47, 30, 770), totalMs: 1090, itemMs: 935 },
].map((r, i) => ({
  ...r, idx: i + 1,
  startTime: stamp(r.t0),
  endTime: stamp(new Date(r.t0.getTime() + r.totalMs)),
  itemMs: r.itemMs, unaccountedMs: r.totalMs - r.itemMs,
}));

/* Compare 上框：首行按附录 A 解析出的 KV 集合（两侧按 Key 字典序对齐；含动态键与单侧键） */
const CMP_KV = [
  { k: 'FPB08765', s: '1', t: '' },
  { k: 'PLAN', s: 'ATNC100005L1P1A01.2', t: 'ATNC100005L1P1A01.2' },
  { k: 'PRODUCT', s: 'T0314A.2', t: 'T0314A.2' },
  { k: 'SEQUENCE', s: '029500.1.029500', t: '029500.1.029500' },
  { k: 'STEP', s: 'S-T-TKAL-B-01.0', t: 'S-T-TKAL-B-02.0' },
  { k: 'TIMESTAMP', s: '3025', t: '3025' },
  { k: 'USER', s: 'EAP', t: 'EAP' },
  { k: 'USERID', s: '', t: 'EAP' },
  { k: 'carrierId', s: 'C1200317', t: 'C1200319' },
  { k: 'eqpId', s: 'ATTAL01', t: 'ATTAL01' },
  { k: 'lotId', s: 'A031178', t: 'A031180' },
  { k: 'ruleName', s: 'POST', t: 'POST' },
];

const STYLES = `
  :root{
    /* 布局钩子：宽表格（17 列 × 两个列表）必须放宽内容区 */
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
  [hidden]{display:none!important;}
  .crumb{font-size:12px;color:var(--t3);margin-bottom:6px;}
  .page-head h1{margin:0 0 6px;font-size:20px;font-weight:600;}
  .page-head .sub{margin:0;font-size:12.5px;color:var(--t2);}
  .card{border:1px solid var(--bd);border-radius:var(--r-lg);background:#fff;margin:0 0 16px;}
  .card-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--split);}
  .card-head h2{margin:0;font-size:15px;font-weight:600;}
  .card-head .hint{margin-left:auto;font-size:12px;color:var(--t3);}
  /* 角色标记：Source = 问题样本 / Target = 对照基准 */
  .role{display:inline-flex;align-items:center;height:22px;padding:0 10px;font-size:12px;font-weight:600;
    border-radius:999px;white-space:nowrap;}
  .role.src{color:#874d00;background:#fffbe6;border:1px solid var(--warn);}
  .role.tgt{color:#256847;background:var(--p-bg);border:1px solid rgba(47,125,90,.35);}

  /* 筛选区 */
  .filters{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px 16px;padding:14px 16px;}
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

  /* Same X 开关组：Target 区顶部一行 */
  .same-box{display:flex;flex-wrap:wrap;gap:10px 22px;padding:12px 16px;border-bottom:1px solid var(--split);
    background:#fbfcfb;}
  .switch{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0;font:inherit;font-size:12.5px;
    color:var(--t2);background:transparent;border:0;cursor:pointer;}
  .switch .track{position:relative;width:36px;height:20px;border-radius:999px;background:rgba(0,0,0,.25);
    transition:background .16s;flex:0 0 auto;}
  .switch .track::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .16s;}
  .switch.on{color:var(--t1);}
  .switch.on .track{background:var(--p);}
  .switch.on .track::after{left:18px;}
  .switch .same-val{font-family:var(--mono);font-size:11.5px;color:var(--p);background:var(--p-bg);
    padding:0 6px;border-radius:var(--r-sm);}
  .switch:disabled{color:var(--t3);cursor:not-allowed;opacity:.7;}

  .btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 16px;font:inherit;font-size:13px;
    color:var(--t1);background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;white-space:nowrap;}
  .btn:hover{border-color:var(--p);color:var(--p);}
  .btn.primary{color:#fff;background:var(--p);border-color:var(--p);}
  .btn.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff;}
  .btn.ghost{color:var(--p);background:transparent;border-color:transparent;padding:0 8px;}
  .btn.ghost:hover{background:var(--p-bg);}
  .btn:disabled{color:var(--t3);background:var(--fill);border-color:var(--bd);cursor:not-allowed;}
  .btn:disabled:hover{color:var(--t3);border-color:var(--bd);}
  .btn.primary:disabled{color:#fff;background:var(--p);border-color:var(--p);opacity:.45;}
  .btn.primary:disabled:hover{background:var(--p);border-color:var(--p);}
  .actions{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}
  .actions .spacer{flex:1;}
  .vline{width:1px;height:18px;background:var(--split);}

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
  table.grid td.sticky-left{background:#fff;}
  table.grid tbody tr:hover td.sticky-left{background:var(--fill);}
  table.grid tbody tr.selected td.sticky-left{background:var(--p-bg);}
  .sticky-left{position:sticky;left:0;z-index:2;box-shadow:1px 0 0 var(--split);}
  thead .sel-col{position:sticky;top:0;left:0;z-index:5;}
  .num{text-align:right;font-variant-numeric:tabular-nums;}
  table.grid th.dyn-col{background:#f4f8f6;box-shadow:inset 1px 0 0 var(--split);}
  table.grid td.dyn-col{box-shadow:inset 1px 0 0 var(--split);}
  .cell-error{color:var(--err);background:var(--err-bg)!important;}
  .tag{display:inline-block;font-size:11.5px;line-height:18px;padding:0 6px;border-radius:var(--r-sm);
    color:var(--t2);background:var(--fill);border:1px solid var(--bd);}
  .tag.rule{color:#256847;background:var(--p-bg);border-color:rgba(47,125,90,.35);}
  .tag.txn{color:#0958d9;background:#e8f3ff;border-color:rgba(22,119,255,.35);}
  .badge{display:inline-block;margin-left:4px;padding:0 4px;font-size:10.5px;line-height:15px;
    border-radius:999px;color:var(--t2);background:rgba(0,0,0,.06);vertical-align:1px;}
  .row-radio{width:14px;height:14px;accent-color:var(--p);cursor:pointer;vertical-align:middle;}
  .table-overlay{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;
    gap:10px;font-size:13px;color:var(--t2);background:rgba(255,255,255,.72);}
  .spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(47,125,90,.25);
    border-top-color:var(--p);animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 16px;font-size:13px;color:var(--t3);}
  .empty .illu{width:72px;height:48px;border:1px dashed var(--bd);border-radius:var(--r);background:var(--fill);}

  /* Target 区门禁：未选 Source 行时整体置灰（控件逐个 disabled，容器仍可悬停读标注） */
  .zone-locked .filters,.zone-locked .same-box,.zone-locked .actions{opacity:.55;}
  .gate-tip{display:flex;align-items:center;gap:8px;margin:0;padding:8px 16px;font-size:12px;color:#874d00;
    background:#fffbe6;border-bottom:1px solid var(--split);}
  .gate-tip.ok{color:var(--p);background:var(--p-bg);}

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

  /* Compare 弹窗：上框 KV 比对 + 下框双栏日志 */
  .modal{position:fixed;top:50%;left:50%;z-index:10000;display:none;flex-direction:column;
    width:min(1240px,94vw);max-height:88vh;background:#fff;border-radius:var(--r-lg);overflow:hidden;
    transform:translate(-50%,-50%);box-shadow:0 24px 70px -20px rgba(0,0,0,.5);}
  .modal.open{display:flex;}
  .modal-head{display:flex;align-items:baseline;gap:10px;padding:14px 16px;border-bottom:1px solid var(--split);}
  .modal-head h3{margin:0;font-size:15px;font-weight:600;}
  .modal-sub{font-family:var(--mono);font-size:12px;color:var(--t3);}
  .cmp-sec{display:flex;align-items:center;gap:8px;padding:8px 16px 6px;font-size:12px;color:var(--t2);}
  .cmp-sec b{font-size:12px;font-weight:600;color:var(--t1);}
  .cmp-kv-wrap{max-height:24vh;overflow:auto;border-top:1px solid var(--split);border-bottom:1px solid var(--split);}
  .cmp-kv-wrap table.grid th,.cmp-kv-wrap table.grid td{height:30px;}
  .kv-key{font-family:var(--mono);font-size:12px;}
  .kv-diff{color:var(--err);background:var(--err-bg);}
  /* min-height:0 + minmax(0,1fr)：让日志区按弹窗分配高度固定、内部滚动（否则被内容撑高滚不动） */
  .cmp-logs{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr);gap:0;}
  .cmp-pane{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid var(--split);}
  .cmp-pane:last-child{border-right:0;}
  .cmp-pane-head{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12px;color:var(--t2);
    background:var(--fill);border-bottom:1px solid var(--split);}
  .cmp-pane-head .st{margin-left:auto;font-size:11px;color:var(--t3);}
  .log-view{flex:1;min-height:0;overflow:auto;padding:8px 0;
    font-family:var(--mono);font-size:12px;line-height:20px;color:var(--t1);background:#fbfbfc;}
  .log-line{display:flex;gap:8px;padding:0 12px;white-space:pre-wrap;overflow-wrap:anywhere;}
  .log-line .ln{flex:0 0 34px;text-align:right;color:var(--t3);user-select:none;}
  .log-line .txt{flex:1;min-width:0;}
  .log-line.diff{color:var(--err);background:var(--err-bg);}
  .log-note{padding:6px 16px;font-family:inherit;font-size:12px;color:var(--t3);text-align:center;}
  .modal-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}
  .modal-foot .spacer{flex:1;}
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
    case 'userId': return multi(r.user);
    case 'tid': return r.tid;
    case 'totalCostSec': return sec(r.totalMs);
    case 'itemCostSec': return sec(r.itemMs);
    case 'unaccountedSec': return sec(r.unaccountedMs);
    default: return r[col.key];
  }
};

const rowHtml = (r) =>
  `<tr data-row="${r.idx}">` +
  `<td class="sel-col sticky-left"><input type="radio" class="row-radio" name="rowSelSrc" id="src-row-${r.idx}"></td>` +
  COLUMNS.map(col => {
    const cls = [
      col.align === 'right' ? 'num' : '',
      col.key === 'ruleResult' && r.ruleResult === 'CANCELRULE' ? 'cell-error' : '',
    ].filter(Boolean).join(' ');
    return `<td data-col="${col.key}"${cls ? ` class="${cls}"` : ''}>${cell(col, r)}</td>`;
  }).join('') +
  '</tr>';

const thHtml = () => COLUMNS.map(col =>
  `<th data-col="${col.key}"${col.align === 'right' ? ' class="num"' : ''}>${col.label}</th>`).join('');

/* ───────────────────────── 页内行为（演示用；不含真实业务请求）───────────────────────── */
const PAGE_SCRIPT = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
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
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 2600);
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
  function shiftTime(t, minutes) {
    var d = parseTime(t) || new Date(2026, 8, 22, 10, 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  /* 假数据（构建侧同源生成，嵌入浏览器侧使用） */
  var COLUMNS = ${JSON.stringify(COLUMNS)};
  var SRC_ROWS = ${JSON.stringify(SRC_ROWS)};
  var TGT_ROWS = ${JSON.stringify(TGT_ROWS)};
  var CMP_KV = ${JSON.stringify(CMP_KV)};

  function multiHtml(arr) {
    return arr.length === 0 ? '' : arr[0] + (arr.length > 1 ? '<span class="badge">+' + (arr.length - 1) + '</span>' : '');
  }
  function cellHtml(key, r) {
    switch (key) {
      case 'requestType': return '<span class="tag ' + (r.requestType === 'TXN' ? 'txn' : 'rule') + '">' + r.requestType + '</span>';
      case 'errorCode': return multiHtml(r.errCode);
      case 'eqpId': return multiHtml(r.eqp);
      case 'lotId': return multiHtml(r.lot);
      case 'carrierId': return multiHtml(r.carrier);
      case 'userId': return multiHtml(r.user);
      case 'tid': return r.tid;
      case 'totalCostSec': return (r.totalMs / 1000).toFixed(3);
      case 'itemCostSec': return (r.itemMs / 1000).toFixed(3);
      case 'unaccountedSec': return (r.unaccountedMs / 1000).toFixed(3);
      default: return r[key];
    }
  }

  /* 列设置（Source / Target 共用一份）：当前列集合 = 静态列显隐 + EXEC_STATUS + 动态耗时列 */
  var EXEC_STATUS = ['已完成', '进行中', '已完成', '中断', '已完成', '已完成', '超时封口', '已完成'];
  function nameHash(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h += name.charCodeAt(i) * (i + 7);
    return h;
  }
  function breakdownMs(kind, name, i) {
    if (kind === 'lock' && i % 4 === 0) return null;
    if (kind === 'call' && i % 5 === 0) return null;
    return 40 + ((kind === 'lock' ? 251 : 397) + nameHash(name) + i * 53) % 1200;
  }
  function picked(box) {
    var inputs = box.querySelectorAll('input:checked'), out = [];
    for (var i = 0; i < inputs.length; i++) out.push(inputs[i].value);
    return out;
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
  function visibleStatic() {
    return COLUMNS.filter(function (col) {
      if (col.key === 'totalCostSec') return $('chkTotalCost').checked;
      if (col.key === 'itemCostSec') return $('chkItemCost').checked;
      if (col.key === 'unaccountedSec') return $('chkUnaccounted').checked;
      return true;
    });
  }
  function toggleCol(key, show) {
    var cells = document.querySelectorAll('#srcTable [data-col="' + key + '"]');
    for (var i = 0; i < cells.length; i++) cells[i].hidden = !show;
  }
  function dynCell(tag, text, align) {
    var el = document.createElement(tag);
    el.setAttribute('data-dyn', '1');
    el.className = 'dyn-col' + (align === 'right' ? ' num' : '');
    el.textContent = text;
    return el;
  }

  /* Source 列表渲染（静态表头的显隐 + 动态列注入） */
  function applyColumnsSrc() {
    toggleCol('totalCostSec', $('chkTotalCost').checked);
    toggleCol('itemCostSec', $('chkItemCost').checked);
    toggleCol('unaccountedSec', $('chkUnaccounted').checked);
    var stale = document.querySelectorAll('#srcTable [data-dyn]');
    for (var s = 0; s < stale.length; s++) stale[s].parentNode.removeChild(stale[s]);
    var cols = dynColumns();
    if (!cols.length) return;
    var head = document.querySelector('#srcTable thead tr');
    var rows = $('srcTableBody').querySelectorAll('tr');
    for (var c = 0; c < cols.length; c++) {
      head.appendChild(dynCell('th', cols[c].label, cols[c].align));
      for (var r = 0; r < rows.length; r++) {
        var idx = Number(rows[r].getAttribute('data-row')) - 1;
        rows[r].appendChild(dynCell('td', cols[c].value(idx), cols[c].align));
      }
    }
  }

  /* Target 列表渲染：整表由 JS 按「当前列集合」重建（列集合与顺序与 Source 共用） */
  function renderTargetTable(rows) {
    var tbody = $('tgtTableBody');
    var thead = $('tgtTableHead');
    var cols = visibleStatic();
    var headHtml = '<tr><td class="sel-col sticky-left"></td>';
    cols.forEach(function (col) {
      headHtml += '<th data-col="' + col.key + '"' + (col.align === 'right' ? ' class="num"' : '') + '>' + col.label + '</th>';
    });
    dynColumns().forEach(function (dc) {
      headHtml += '<th class="dyn-col' + (dc.align === 'right' ? ' num' : '') + '">' + dc.label + '</th>';
    });
    thead.innerHTML = headHtml + '</tr>';
    var bodyHtml = '';
    var dynCols = dynColumns();
    rows.forEach(function (r, i) {
      bodyHtml += '<tr data-row="' + (i + 1) + '"><td class="sel-col sticky-left">' +
        '<input type="radio" class="row-radio" name="rowSelTgt"></td>';
      cols.forEach(function (col) {
        var cls = (col.align === 'right' ? 'num' : '') +
          (col.key === 'ruleResult' && r.ruleResult === 'CANCELRULE' ? ' cell-error' : '');
        bodyHtml += '<td data-col="' + col.key + '"' + (cls ? ' class="' + cls.trim() + '"' : '') + '>' + cellHtml(col.key, r) + '</td>';
      });
      dynCols.forEach(function (dc) {
        bodyHtml += '<td class="dyn-col' + (dc.align === 'right' ? ' num' : '') + '">' + dc.value(i) + '</td>';
      });
      bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;
  }

  /* ── Source 列表：单选 ── */
  var srcState = { selected: null };
  function setSrcSelection(tr) {
    var rows = $('srcTableBody').querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i] === tr;
      rows[i].classList.toggle('selected', on);
      var radio = rows[i].querySelector('.row-radio');
      if (radio) radio.checked = on;
    }
    var prev = srcState.selected;
    srcState.selected = tr ? SRC_ROWS[Number(tr.getAttribute('data-row')) - 1] : null;
    if (tr) {
      unlockTarget(prev ? 'reset' : 'unlock');
    } else {
      lockTarget();
    }
  }
  $('srcTableBody').addEventListener('click', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr') : null;
    if (!tr) return;
    setSrcSelection(tr.classList.contains('selected') ? null : tr);
  });

  /* ── Target 区门禁与清理 ── */
  var TGT_IDS = ['tgtEnvSelect', 'tgtStartTime', 'tgtEndTime', 'sameEnv', 'sameHostIp', 'sameServerId',
    'sameEqp', 'sameCarrier', 'sameLot', 'sameRuleResult', 'btnTgtSearch'];
  function lockTarget() {
    $('targetZone').classList.add('zone-locked');
    $('gateTip').className = 'gate-tip';
    $('gateTip').textContent = '先在上方 Source 列表选中 1 条，本区才可用；Target 的筛选建立在选中的 Source 行之上。';
    TGT_IDS.forEach(function (id) { $(id).disabled = true; });
    resetTarget();
  }
  function unlockTarget(mode) {
    $('targetZone').classList.remove('zone-locked');
    $('gateTip').className = 'gate-tip ok';
    $('gateTip').textContent = '已按选中的 Source 行（' + srcState.selected.ruleName + ' · ' + srcState.selected.startTime + '）启用 Target 区。';
    TGT_IDS.forEach(function (id) { $(id).disabled = false; });
    syncSameEnv();
    if (mode === 'reset') {
      resetTarget();
      toast('Source 换选 / 取消选中：Target 区已复位（条件回初始、列表清空、开关全关）');
    } else {
      toast('Target 区已启用');
    }
  }
  function resetTarget() {
    ['tgtEnvSelect'].forEach(function (id) { $(id).value = ''; });
    $('tgtStartTime').value = '2026-09-22 09:00';
    $('tgtEndTime').value = '2026-09-22 10:00';
    document.querySelectorAll('#sameBox .switch').forEach(function (sw) {
      sw.classList.remove('on');
      sw.setAttribute('aria-pressed', 'false');
      var val = sw.querySelector('.same-val');
      if (val) val.remove();
    });
    $('deepSearchToggle').classList.add('on');
    $('deepSearchToggle').setAttribute('aria-pressed', 'true');
    tgtState.rows = [];
    tgtState.selected = null;
    renderTargetTable([]);
    $('tgtEmpty').hidden = false;
    $('tgtOverlay').hidden = true;
    $('tgtPagerTotal').textContent = '共 0 条';
    syncTgtActions();
  }

  /* ── Same X 开关组：勾上即取选中 Source 行的同名字段值 ── */
  var SAME_FIELD = {
    sameEnv: { label: 'ENV', get: function (r) { return r.env; } },
    sameHostIp: { label: 'HOSTIP', get: function (r) { return r.hostIp; } },
    sameServerId: { label: 'SERVER_ID', get: function (r) { return r.serverId; } },
    sameEqp: { label: 'EQPID', get: function (r) { return r.eqp[0]; } },
    sameCarrier: { label: 'CARRIERID', get: function (r) { return r.carrier[0]; } },
    sameLot: { label: 'LOTID', get: function (r) { return r.lot[0]; } },
    sameRuleResult: { label: 'RULE_RESULT', get: function (r) { return r.ruleResult; } },
  };
  function sameRow() { return srcState.selected; }
  document.querySelectorAll('#sameBox .switch').forEach(function (sw) {
    sw.addEventListener('click', function () {
      if (sw.disabled || !sameRow()) return;
      var on = sw.classList.toggle('on');
      sw.setAttribute('aria-pressed', on ? 'true' : 'false');
      var field = SAME_FIELD[sw.id];
      var old = sw.querySelector('.same-val');
      if (old) old.remove();
      if (on) {
        var code = document.createElement('code');
        code.className = 'same-val';
        code.textContent = field.get(sameRow());
        sw.appendChild(code);
        toast('Same ' + sw.getAttribute('data-label') + '：Target 过滤恒带 ' + field.label + ' = ' + field.get(sameRow()));
      }
      if (sw.id === 'sameEnv') syncSameEnv();
    });
  });
  function syncSameEnv() {
    var on = $('sameEnv').classList.contains('on') && sameRow();
    $('tgtEnvSelect').disabled = on || $('targetZone').classList.contains('zone-locked');
    $('tgtEnvSelect').value = on ? sameRow().env : $('tgtEnvSelect').value;
  }

  /* ── 校验 ── */
  function checkTime(pre) {
    var s = $(pre + 'StartTime').value.trim(), e = $(pre + 'EndTime').value.trim();
    if (!TIME_RE.test(s) || !TIME_RE.test(e)) {
      setErr(pre + 'StartTime', '时间格式应为 YYYY-MM-DD HH:mm（精确到分钟）');
      return false;
    }
    var a = parseTime(s), b = parseTime(e);
    if (a > b) { setErr(pre + 'EndTime', '开始时间必须早于或等于结束时间'); return false; }
    if (b - a > 86400000) { setErr(pre + 'EndTime', '起止跨度不能超过 1 天'); return false; }
    setErr(pre + 'StartTime', '');
    setErr(pre + 'EndTime', '');
    return true;
  }
  ['srcStartTime', 'srcEndTime', 'tgtStartTime', 'tgtEndTime'].forEach(function (id) {
    $(id).addEventListener('input', function () { checkTime(id.slice(0, 3) === 'src' ? 'src' : 'tgt'); });
  });
  ['srcStartTime', 'tgtStartTime'].forEach(function (id) {
    $(id).addEventListener('blur', function () {
      if (!this.value.trim()) { this.value = shiftTime($(id.replace('Start', 'End')).value, -60); }
    });
  });
  ['srcEndTime', 'tgtEndTime'].forEach(function (id) {
    $(id).addEventListener('blur', function () {
      if (!this.value.trim()) { this.value = shiftTime($(id.replace('End', 'Start')).value, 60); }
    });
  });

  /* ── Source Search：Environment / TID 为空或时间不合法 → 拦住 ── */
  $('btnSrcSearch').addEventListener('click', function () {
    var ok = true;
    if (!$('srcEnvSelect').value) { setErr('srcEnvSelect', '必选：为空不能 Search'); ok = false; }
    else setErr('srcEnvSelect', '');
    if (!$('srcTidInput').value.trim()) { setErr('srcTidInput', '必填：为空不能 Search'); ok = false; }
    else setErr('srcTidInput', '');
    if (!checkTime('src')) ok = false;
    if (!ok) { toast('条件不合法，已拦住本次检索', 'warn'); return; }
    setSrcSelection(null);
    $('srcOverlay').hidden = false;
    setTimeout(function () {
      $('srcOverlay').hidden = true;
      toast('已按当前条件查询第 1 页（共 ' + SRC_ROWS.length + ' 条，Start Time 正序）');
    }, 700);
  });

  /* ── Target Search：Deep Search 切快速 / 深度 ── */
  $('deepSearchToggle').addEventListener('click', function () {
    if (this.disabled) return;
    var on = this.classList.toggle('on');
    this.setAttribute('aria-pressed', on ? 'true' : 'false');
    toast(on ? '深度检索：结果按分页输出多行，不默认选中'
             : '快速检索：结果只输出第一行（排序同深度检索），并默认选中该行');
  });
  var tgtState = { rows: [], selected: null };
  $('btnTgtSearch').addEventListener('click', function () {
    var ok = true;
    var sameEnvOn = $('sameEnv').classList.contains('on');
    if (!sameEnvOn && !$('tgtEnvSelect').value) { setErr('tgtEnvSelect', '必选（或勾 Same Environment 取 Source 行值）'); ok = false; }
    else setErr('tgtEnvSelect', '');
    if (!checkTime('tgt')) ok = false;
    if (!ok) { toast('条件不合法，已拦住本次检索', 'warn'); return; }
    $('tgtEmpty').hidden = true;
    $('tgtOverlay').hidden = false;
    syncTgtActions();
    setTimeout(function () {
      $('tgtOverlay').hidden = true;
      var deep = $('deepSearchToggle').classList.contains('on');
      tgtState.rows = deep ? TGT_ROWS : TGT_ROWS.slice(0, 1);
      renderTargetTable(tgtState.rows);
      $('tgtPagerTotal').textContent = '共 ' + tgtState.rows.length + ' 条';
      if (!deep && tgtState.rows.length) {
        setTgtSelection($('tgtTableBody').querySelector('tr'));
        toast('快速检索：只输出第一行（Start Time 倒排），已默认选中');
      } else {
        tgtState.selected = null;
        syncTgtActions();
        toast('深度检索：共 ' + tgtState.rows.length + ' 条（Start Time 倒排），不默认选中，请自行选 1 行');
      }
    }, 700);
  });

  /* ── Target 列表：单选（快速检索默认选中、深度不默认） ── */
  function setTgtSelection(tr) {
    var rows = $('tgtTableBody').querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      var on = rows[i] === tr;
      rows[i].classList.toggle('selected', on);
      var radio = rows[i].querySelector('.row-radio');
      if (radio) radio.checked = on;
    }
    tgtState.selected = tr ? tgtState.rows[Number(tr.getAttribute('data-row')) - 1] : null;
    syncTgtActions();
  }
  $('tgtTableBody').addEventListener('click', function (ev) {
    var tr = ev.target.closest ? ev.target.closest('tr') : null;
    if (!tr) return;
    setTgtSelection(tr.classList.contains('selected') ? null : tr);
  });
  function syncTgtActions() {
    var has = tgtState.rows.length > 0, sel = !!tgtState.selected;
    $('btnTgtExport').disabled = !has;
    $('btnDownloadRuleInfo').disabled = !sel;
    $('btnCompare').disabled = !sel;
  }

  /* ── Export：Source_ / Target_ 前缀区分 ── */
  $('btnSrcExport').addEventListener('click', function () {
    toast('已导出当前页显示中的列 → Source_RuleInfo_20260922100012.xlsx');
  });
  $('btnTgtExport').addEventListener('click', function () {
    toast('已导出当前页显示中的列 → Target_RuleInfo_20260922100012.xlsx');
  });

  /* ── Download Rule Info：下载的是 Source 那条 ── */
  $('btnDownloadRuleInfo').addEventListener('click', function () {
    if (!srcState.selected) return;
    var name = srcState.selected.ruleName + '_20260922093012.log';
    toast('已下载 Source 的 Rule 日志 → ' + name);
  });

  /* ── Compare Rule Info：左右比较弹窗 ── */
  function openDrawer() {
    $('colDrawer').classList.add('open');
    $('drawerMask').classList.add('open');
  }
  function closeDrawer() {
    $('colDrawer').classList.remove('open');
    $('drawerMask').classList.remove('open');
  }
  $('btnColSettings').addEventListener('click', openDrawer);
  $('btnDrawerClose').addEventListener('click', closeDrawer);
  $('btnDrawerClose2').addEventListener('click', closeDrawer);
  $('drawerMask').addEventListener('click', closeDrawer);
  $('lockObjectBox').addEventListener('change', function () {
    store('mes-rule-cmp:lock', picked(this).join(','));
  });
  $('callSysBox').addEventListener('change', function () {
    store('mes-rule-cmp:call', picked(this).join(','));
  });
  $('btnDrawerConfirm').addEventListener('click', function () {
    applyColumnsSrc();
    if (tgtState.rows.length) renderTargetTable(tgtState.rows);
    closeDrawer();
    toast('列设置已应用：Source 与 Target 两个列表同时变（列集合与顺序共用一份）');
  });

  /* 上框：首行 KV 集合按 Key 字典序对齐；两侧不一样的做标记 */
  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderKv() {
    var rows = '';
    CMP_KV.forEach(function (row) {
      var diff = row.s !== row.t;
      rows += '<tr>' +
        '<td class="kv-key">' + escHtml(row.k) + '</td>' +
        '<td' + (diff ? ' class="kv-diff"' : '') + '>' + escHtml(row.s) + '</td>' +
        '<td' + (diff ? ' class="kv-diff"' : '') + '>' + escHtml(row.t) + '</td>' +
        '</tr>';
    });
    $('cmpKvBox').innerHTML = '<table class="grid" id="cmpKvTable"><thead><tr>' +
      '<th style="width:190px">Key</th><th>Source 值</th><th>Target 值</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* 下框：两侧各自游标分页拉日志、按原始行号逐行对齐、偏移同步滚动 */
  var LOG_SERVER_S = 'FABsrv.10', LOG_SERVER_T = 'FABsrv.18';
  var LOG_BODY_S = [
    'FwEventManager:message to process: :>>L FwSrvExecuteRuleTxn subjectName="" msgTag="" ruleName="POST" lotId="A031178" eqpId="ATTAL01"',
    'FwSrvRuleRunner:start rule ruleName="POST" tid="20260922093012.147-0007"',
    'FwRuleDataAccess:select rule condition eqpId="ATTAL01" lotId="A031178"',
    'FwRuleEngine:execute rule "POST" branch 1/3 cost=3ms',
    'FWLockMgr:lock object LOT key="A031178" hold=8ms',
    'FwCarrierMgr:query carrier by lotId="A031178" result=C1200317 state=LOADED',
    'FwTxnSender:message to send subject="FWCarrierMove" target=MCS ack=F',
    'FWLockMgr:lock object CARRIER key="C1200317" hold=240ms',
    '<ERROR> FwLockMgr:lock object CARRIER timeout after 30000ms',
    'FwRuleEngine:execute rule "POST" result=CANCELRULE reason=CARRIER_LOCK_TIMEOUT',
    'FwEventManager:message to process: :>>L FwSrvExecuteRuleTxn subjectName="FWCarrierMove" msgTag="ACK"',
  ];
  var LOG_BODY_T = [
    'FwEventManager:message to process: :>>L FwSrvExecuteRuleTxn subjectName="" msgTag="" ruleName="POST" lotId="A031180" eqpId="ATTAL01"',
    'FwSrvRuleRunner:start rule ruleName="POST" tid="20260922093140.012-0011"',
    'FwRuleDataAccess:select rule condition eqpId="ATTAL01" lotId="A031180"',
    'FwRuleEngine:execute rule "POST" branch 1/3 cost=2ms',
    'FWLockMgr:lock object LOT key="A031180" hold=6ms',
    'FwCarrierMgr:query carrier by lotId="A031180" result=C1200319 state=LOADED',
    'FwTxnSender:message to send subject="FWCarrierMove" target=MCS ack=F',
    'FWLockMgr:lock object CARRIER key="C1200319" hold=18ms',
    'FwRuleEngine:execute rule "POST" branch 2/2 result=PASS',
    'FwTxnSender:ack received subject="FWCarrierMove"',
  ];
  var DIFF_LINES = [8, 9]; /* 按原始行号：两侧内容不一样的行 */
  function logLine(side, i) {
    var body = side === 's' ? LOG_BODY_S : LOG_BODY_T;
    var server = side === 's' ? LOG_SERVER_S : LOG_SERVER_T;
    var d = new Date(2026, 8, 22, 9, 30, 12, 100);
    d.setMilliseconds(d.getMilliseconds() + (i - 1) * 90);
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    var cs = ('0' + Math.floor(d.getMilliseconds() / 10)).slice(-2);
    var st = z(d.getMonth() + 1) + '/' + z(d.getDate()) + '/' + String(d.getFullYear()).slice(-2) + ' ' +
      z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()) + '.' + cs;
    return st + ' ' + server + ':' + body[(i - 1) % body.length];
  }
  var BATCH = 40, TOTAL_S = 100, TOTAL_T = 72;
  var panes = {
    s: { el: 'cmpLogS', lines: 0, total: TOTAL_S, loading: false, finished: false },
    t: { el: 'cmpLogT', lines: 0, total: TOTAL_T, loading: false, finished: false },
  };
  var syncOn = true, syncing = false;
  function paneDone(p) { return p.lines >= p.total; }
  function loadPane(side) {
    var p = panes[side];
    if (p.finished || p.loading || paneDone(p)) return;
    p.loading = true;
    var list = $(p.el);
    var note = document.createElement('div');
    note.className = 'log-note';
    note.textContent = '正在加载下一批日志…';
    list.appendChild(note);
    setTimeout(function () {
      list.removeChild(note);
      for (var i = 0; i < BATCH && p.lines < p.total; i++) {
        p.lines += 1;
        var line = document.createElement('div');
        line.className = 'log-line' + (DIFF_LINES.indexOf(p.lines) >= 0 ? ' diff' : '');
        line.innerHTML = '<span class="ln">' + p.lines + '</span><span class="txt">' +
          escHtml(logLine(side, p.lines)) + '</span>';
        list.appendChild(line);
      }
      p.loading = false;
      if (paneDone(p)) {
        p.finished = true;
        var end = document.createElement('div');
        end.className = 'log-note';
        end.textContent = '—— 搜索完毕 ——';
        list.appendChild(end);
      }
      updatePaneStatus();
    }, 380);
  }
  function updatePaneStatus() {
    $('cmpStatS').textContent = panes.s.lines + ' 行' + (panes.s.finished ? ' · 搜索完毕' : '');
    $('cmpStatT').textContent = panes.t.lines + ' 行' + (panes.t.finished ? ' · 搜索完毕' : '');
  }
  function atBottom(el) { return el.scrollTop + el.clientHeight >= el.scrollHeight - 2; }
  function onPaneScroll(side) {
    var el = $(panes[side].el), other = side === 's' ? 't' : 's';
    /* 偏移同步：一侧滚多少另一侧跟同样偏移；某侧 finished 且到底即解除 */
    if (syncOn && !syncing) {
      var p = panes[side];
      if (p.finished && atBottom(el)) {
        syncOn = false;
        toast('一侧已搜索完毕且到底：偏移同步解除，两侧各自滚动');
      } else {
        syncing = true;
        $(panes[other].el).scrollTop = el.scrollTop;
        syncing = false;
      }
    }
    /* 提前预取：距已加载末位约 20 行（约 400px）即触发；只拉 finished = false 的那一侧 */
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) {
      loadPane('s');
      loadPane('t');
    }
  }
  $('cmpLogS').addEventListener('scroll', function () { onPaneScroll('s'); });
  $('cmpLogT').addEventListener('scroll', function () { onPaneScroll('t'); });

  function resetCompare() {
    syncOn = true;
    ['s', 't'].forEach(function (side) {
      panes[side].lines = 0;
      panes[side].loading = false;
      panes[side].finished = false;
      $(panes[side].el).innerHTML = '';
    });
    updatePaneStatus();
  }
  function openCompare() {
    if (!srcState.selected || !tgtState.selected) return;
    $('cmpSub').textContent = srcState.selected.ruleName + ' · Source ' + srcState.selected.tid +
      ' ↔ Target ' + tgtState.selected.tid;
    renderKv();
    resetCompare();
    $('compareModal').classList.add('open');
    $('cmpMask').classList.add('open');
    $('compareModal').setAttribute('aria-hidden', 'false');
    loadPane('s');
    loadPane('t');
  }
  function closeCompare() {
    $('compareModal').classList.remove('open');
    $('cmpMask').classList.remove('open');
    $('compareModal').setAttribute('aria-hidden', 'true');
  }
  $('btnCompare').addEventListener('click', openCompare);
  $('btnCmpClose').addEventListener('click', closeCompare);
  $('cmpMask').addEventListener('click', closeCompare);

  /* 进页面：Source 列表直接呈现正常态数据；Target 区锁定 */
  renderKv();
  applyColumnsSrc();
  lockTarget();
})();
`;

/* ───────────────────────── 页面内容 ───────────────────────── */
const CONTENT = `
<div class="page-head">
  <div class="crumb">日志检索与分析 · 模块 1 · 功能 2</div>
  <h1>MES Rule 实效分析</h1>
  <p class="sub">把两条 Rule Info 日志摆在一起比：Source = 不好的那条（问题样本），Target = 好的那条（对照基准），找出差异</p>
</div>

<section class="card">
  <div class="card-head">
    <h2>Source</h2>
    <span class="role src">Source · 问题样本</span>
    <span class="hint">5 个条件 · Start Time 正序 · 单选 1 条即 Source</span>
  </div>
  <div class="filters">
${field('srcEnvSelect', 'Environment', '<select class="input" id="srcEnvSelect"><option value="">必选</option><option>PROD</option><option>PIRUN</option></select>', { req: true, err: true })}
${field('srcStartTime', '开始时间', input('srcStartTime', '2026-09-22 09:00', 'YYYY-MM-DD HH:mm'), { req: true, err: true })}
${field('srcEndTime', '结束时间', input('srcEndTime', '2026-09-22 10:00', 'YYYY-MM-DD HH:mm'), { req: true, tip: '（须晚于或等于开始时间）', err: true })}
${field('srcRuleNameInput', 'Rule Name', input('srcRuleNameInput', 'POST', 'POST（精确匹配，不支持模糊）'))}
${field('srcTidInput', 'TID', input('srcTidInput', '20260922093012.147-0007', '单项值，精确匹配'), { req: true, err: true })}
  </div>
  <div class="actions">
    <span class="spacer"></span>
    <button class="btn primary" id="btnSrcSearch">Search</button>
  </div>
  <div class="table-wrap">
    <table class="grid" id="srcTable">
      <thead><tr id="srcTableHead"><td class="sel-col sticky-left"></td>${thHtml()}</tr></thead>
      <tbody id="srcTableBody">
${SRC_ROWS.map(rowHtml).join('\n')}
      </tbody>
    </table>
    <div class="table-overlay" id="srcOverlay" hidden><span class="spinner"></span><span>加载中…</span></div>
  </div>
  <div class="pager" id="srcPager">
    <span id="srcPagerTotal">共 ${SRC_ROWS.length} 条</span>
    <span class="spacer"></span>
    <select class="page-size"><option>20</option><option>50</option><option>100</option></select>
    <span>条 / 页</span>
    <button class="pg-btn" disabled>‹</button>
    <button class="pg-btn active">1</button>
    <button class="pg-btn">›</button>
  </div>
  <div class="actions">
    <button class="btn" id="btnSrcExport">Export</button>
    <span class="spacer"></span>
    <button class="btn" id="btnColSettings">可选列</button>
  </div>
</section>

<section class="card" id="targetZone">
  <div class="card-head">
    <h2>Target</h2>
    <span class="role tgt">Target · 对照基准</span>
    <span class="hint">先选 Source 行 → 本区启用 → 检索 → 单选 1 条即 Target · Start Time 倒排</span>
  </div>
  <p class="gate-tip" id="gateTip">先在上方 Source 列表选中 1 条，本区才可用；Target 的筛选建立在选中的 Source 行之上。</p>
  <div class="same-box" id="sameBox">
    <button class="switch" id="sameEnv" type="button" aria-pressed="false" data-label="Environment"><span class="track"></span><span>Same Environment</span></button>
    <button class="switch" id="sameHostIp" type="button" aria-pressed="false" data-label="Host IP"><span class="track"></span><span>Same Host IP</span></button>
    <button class="switch" id="sameServerId" type="button" aria-pressed="false" data-label="ServerID"><span class="track"></span><span>Same ServerID</span></button>
    <button class="switch" id="sameEqp" type="button" aria-pressed="false" data-label="EQP"><span class="track"></span><span>Same EQP</span></button>
    <button class="switch" id="sameCarrier" type="button" aria-pressed="false" data-label="Carrier"><span class="track"></span><span>Same Carrier</span></button>
    <button class="switch" id="sameLot" type="button" aria-pressed="false" data-label="Lot"><span class="track"></span><span>Same Lot</span></button>
    <button class="switch" id="sameRuleResult" type="button" aria-pressed="false" data-label="Rule Result"><span class="track"></span><span>Same Rule Result</span></button>
  </div>
  <div class="filters">
${field('tgtEnvSelect', 'Environment', '<select class="input" id="tgtEnvSelect"><option value="">必选</option><option>PROD</option><option>PIRUN</option></select>', { req: true, tip: '（勾 Same Environment 时取 Source 行值）', err: true })}
${field('tgtStartTime', '开始时间', input('tgtStartTime', '2026-09-22 09:00', 'YYYY-MM-DD HH:mm'), { req: true, tip: '（Target 自己的时间，与 Source 无关）', err: true })}
${field('tgtEndTime', '结束时间', input('tgtEndTime', '2026-09-22 10:00', 'YYYY-MM-DD HH:mm'), { req: true, err: true })}
  </div>
  <div class="actions">
    <button class="switch on" id="deepSearchToggle" type="button" aria-pressed="true"><span class="track"></span><span>Deep Search</span></button>
    <span class="spacer"></span>
    <button class="btn primary" id="btnTgtSearch">Search</button>
  </div>
  <div class="table-wrap">
    <table class="grid" id="tgtTable">
      <thead><tr id="tgtTableHead"></tr></thead>
      <tbody id="tgtTableBody"></tbody>
    </table>
    <div class="table-overlay" id="tgtOverlay" hidden><span class="spinner"></span><span>加载中…</span></div>
    <div class="empty" id="tgtEmpty"><div class="illu"></div><div>Target 列表为空 —— 启用本区后点 Search 检索对照样本</div></div>
  </div>
  <div class="pager" id="tgtPager">
    <span id="tgtPagerTotal">共 0 条</span>
    <span class="spacer"></span>
    <select class="page-size"><option>20</option><option>50</option><option>100</option></select>
    <span>条 / 页</span>
    <button class="pg-btn" disabled>‹</button>
    <button class="pg-btn active">1</button>
    <button class="pg-btn">›</button>
  </div>
  <div class="actions">
    <button class="btn" id="btnTgtExport" disabled>Export</button>
    <span class="vline"></span>
    <button class="btn primary" id="btnDownloadRuleInfo" disabled>Download Rule Info</button>
    <button class="btn primary" id="btnCompare" disabled>Compare Rule Info</button>
  </div>
</section>

<div class="mask" id="drawerMask"></div>
<aside class="drawer" id="colDrawer" aria-hidden="true">
  <div class="drawer-head">
    <h3>列设置</h3>
    <button class="icon-btn" id="btnDrawerClose" type="button">×</button>
  </div>
  <p class="drawer-scope">Source 与 Target 两个列表共用这一份列设置；点确认后两个列表同时变，不重新查询。</p>
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
${LOCK_OBJECTS.map(v => `        <label class="chip"><input type="checkbox" value="${v}">${v}</label>`).join('\n')}
      </div>
    </div>
    <div class="group">
      <div class="group-title">Call Sys（每选中一项追加一列）</div>
      <div class="chips" id="callSysBox">
${CALL_SYS.map(v => `        <label class="chip"><input type="checkbox" value="${v}">${v}</label>`).join('\n')}
      </div>
    </div>
  </div>
  <div class="drawer-foot">
    <button class="btn" id="btnDrawerClose2" type="button">关闭</button>
    <button class="btn primary" id="btnDrawerConfirm" type="button">确认</button>
  </div>
</aside>

<div class="mask" id="cmpMask"></div>
<div class="modal" id="compareModal" role="dialog" aria-hidden="true">
  <div class="modal-head">
    <h3>Compare Rule Info</h3>
    <span class="modal-sub" id="cmpSub"></span>
  </div>
  <div class="cmp-sec"><b>上框</b>请求 message 比对 —— 首行按附录 A 解析成 KV 集合，按 Key 字典序对齐（同 Key 一行；单侧 Key 另一侧留空；两侧不一样的做标记）</div>
  <div class="cmp-kv-wrap" id="cmpKvBox"></div>
  <div class="cmp-sec"><b>下框</b>完整日志比对 —— 左恒 Source、右恒 Target；按原始行号逐行对齐；偏移同步滚动；距末位约 20 行提前预取</div>
  <div class="cmp-logs">
    <div class="cmp-pane">
      <div class="cmp-pane-head"><span class="role src">Source</span><span class="st" id="cmpStatS"></span></div>
      <div class="log-view" id="cmpLogS"></div>
    </div>
    <div class="cmp-pane">
      <div class="cmp-pane-head"><span class="role tgt">Target</span><span class="st" id="cmpStatT"></span></div>
      <div class="log-view" id="cmpLogT"></div>
    </div>
  </div>
  <div class="modal-foot">
    <span class="spacer"></span>
    <button class="btn" id="btnCmpClose" type="button">关闭</button>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
${PAGE_SCRIPT}
</script>
`;

/* ───────────────────────── 规格清单（唯一事实源）───────────────────────── */
const TIME_RULES = [
  '过滤：开始时间 ≤ START_TIME ≤ 结束时间（闭区间）',
  '即时校验：开始 ≤ 结束（同一分钟判合法）且差值 ≤ 1 天；不合法标红 + 错误文案，点 Search 被拦住',
  '清空开始时间自动补为「结束时间 − 1 小时」；清空结束时间自动补为「开始时间 + 1 小时」',
];
const TIME_NOTES = ['进页面默认值：结束 = 当前时刻、开始 = 当前时刻 − 1 小时；选择器精确到分钟'];

const spec = {
  schema: SKILL,
  title: 'MES Rule 实效分析',
  summary: '三段式整页：上 = Source 区（5 条件检索 + 结果列表，单选 1 条即 Source），中 = Target 区（先选 Source 行才启用；' +
    '7 个 Same X 开关 + 自己的 Environment 与时间 + Deep Search 切快速 / 深度检索；单选 1 条即 Target），下 = 对比区动作' +
    '（Download Rule Info 下载 Source 的 Rule 日志；Compare Rule Info 打开左右比较弹窗：上框请求 message KV 比对、下框完整日志联动滚动比对）。' +
    '两个列表共用一份列设置。接口口径依 02 文档 §五。',
  regions: [
    { id: 'source', label: 'Source 区', role: 'search', desc: '问题样本检索：Environment / 时间 / Rule Name / TID 共 5 条件 + Search；结果列表 Start Time 正序，单选 1 条即 Source' },
    { id: 'target', label: 'Target 区', role: 'search', desc: '对照基准：先决条件 = Source 列表已选中 1 条；7 个 Same X 开关 + Environment + 自己的时间 + Deep Search + Search；结果列表 Start Time 倒排，单选 1 条即 Target' },
    { id: 'actions', label: '列表下方按钮', role: 'actions', desc: 'Source：Export、可选列；Target：Export、Download Rule Info、Compare Rule Info' },
    { id: 'drawer', label: '列设置抽屉（共用一份）', role: 'drawer', desc: '两个列表共用：可隐藏三列与 EXEC_STATUS 显隐、Lock Object 与 Call Sys 多选；确认后两个列表同时变' },
    { id: 'compare', label: 'Compare Rule Info 弹窗', role: 'detail', desc: '上框 = 请求 message 比对（首行解析成 KV 集合、按 Key 字典序对齐、差异标记）；下框 = 完整日志左右比对（各自游标分页、原始行号对齐、偏移同步滚动、提前预取）' },
  ],
  apis: [
    { id: 'envList', method: 'GET', path: '/log-viewer/api/v1/env/list', desc: 'Source / Target 的 Environment 候选（同 01 §5.3 第 1 条）' },
    { id: 'lockObjectList', method: 'GET', path: '/log-viewer/api/v1/lock_object/list', desc: '列设置 Lock Object 候选（同 01 §5.3 第 5 条）' },
    { id: 'callSysList', method: 'GET', path: '/log-viewer/api/v1/call_sys/list', desc: '列设置 Call Sys 候选（同 01 §5.3 第 6 条）' },
    { id: 'ruleInfoPage', method: 'POST', path: '/log-viewer/api/v1/rule_info/page', desc: 'Source 与 Target 的检索（同 01 §5.3 第 9 条；本功能调两次，填参差异见各 Search 控件标注）' },
    { id: 'ruleInfoDetail', method: 'GET', path: '/log-viewer/api/v1/rule_info/detail', desc: 'Compare 时两侧分页拉日志（同 01 §5.3 第 7 条；两侧各持一套游标）' },
    { id: 'ruleInfoRuleLog', method: 'POST', path: '/log-viewer/api/v1/rule_info/rule_log', desc: 'Download Rule Info 下载 Rule 日志（本功能新增）' },
  ],
  controls: [
    {
      selector: '#srcEnvSelect', kind: 'select', label: 'Source · Environment', region: 'Source 区',
      required: true, param: 'env', options: ['PROD', 'PIRUN'], placeholder: '必选',
      rules: ['进页面默认不选中；为空则不能 Search（点 Search 拦住并标红）', '等值过滤块文档字段 ENV'],
      on: { load: ['进页面加载候选值'] },
      apis: ['envList'],
      apiNotes: ['出参：`data.env` = 字符串数组', '入参位置：`parameters.env`'],
    },
    {
      selector: '#srcStartTime', kind: 'input', label: 'Source · 开始时间', region: 'Source 区',
      required: true, param: 'startTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: TIME_RULES,
      notes: TIME_NOTES,
      apiNotes: ['入参：`parameters.startTime`，格式 `yyyyMMddHHmm`（如 202609221543）'],
    },
    {
      selector: '#srcEndTime', kind: 'input', label: 'Source · 结束时间', region: 'Source 区',
      required: true, param: 'endTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: TIME_RULES, notes: TIME_NOTES,
      apiNotes: ['入参：`parameters.endTime`，格式 `yyyyMMddHHmm`'],
    },
    {
      selector: '#srcRuleNameInput', kind: 'input', label: 'Source · Rule Name', region: 'Source 区',
      param: 'ruleName', placeholder: 'POST（精确匹配，不支持模糊）',
      rules: ['精确匹配块文档字段 RULENAME，不支持模糊', '星号按普通字符处理：既不做前缀匹配，也不判非法', '留空 = 不过滤'],
      apiNotes: ['入参：`parameters.ruleName`'],
    },
    {
      selector: '#srcTidInput', kind: 'input', label: 'Source · TID', region: 'Source 区',
      required: true, param: 'tid', placeholder: '单项值，精确匹配',
      rules: ['单项值；精确匹配，不支持模糊（星号当普通字符）', '为空则不能 Search（点 Search 拦住并标红）', '命中块侧多值字段中任一即算'],
      apiNotes: ['入参：`parameters.tid`'],
    },
    {
      selector: '#btnSrcSearch', kind: 'button', label: 'Source · Search', region: 'Source 区',
      rules: ['前置校验：Environment 为空 / TID 为空 / 时间不合法 → 拦住，不发请求', '清空 Source 列表选中行'],
      on: { click: ['校验通过后查第 1 页；descTime = false（按 Start Time 正序）'] },
      apis: ['ruleInfoPage'],
      apiNotes: [
        '入参：`pageIndex` = 1、`pageSize` = 20；`parameters` 只填本区条件：env + startTime / endTime + ruleName（非必填）+ tid；其余键一概不传',
        '不假设 TID 只出一条 —— 命中几条就出几条',
      ],
    },
    {
      selector: '#srcTable', kind: 'table', label: 'Source Rule Info 列表', region: 'Source 区',
      rules: [
        '列照 01 §3.2：恒显 14 列 → 可隐藏 3 列 → EXEC_STATUS（可选）→ 动态耗时列；本功能无 Server Hang 列（不消费 Hang）',
        '按 Start Time 正序（旧 → 新），与 Target 列表相反',
        'Rule Result = CANCELRULE 单元格标红；多值字段首值 + 角标；耗时列单位秒',
        '单选 1 条（行首单选框或点击整行）—— 选中的这条即 Source；换选 / 取消选中会复位 Target 区',
      ],
      apis: ['ruleInfoPage'],
      apiNotes: [
        '行数据 = 出参 `data.contents[]`；出参 `id` = 块 _id，不出列，留给 Download Rule Info 与 Compare 当入参',
        '与 Target 列表：列设置共用一份、列的顺序共用、横向滚动同步（列位天然对齐是同时滚动的前提）',
      ],
    },
    {
      selector: '#srcPager', kind: 'pager', label: 'Source 分页组件', region: 'Source 区',
      rules: ['默认每页 20 条，档位 20、50、100；始终显示；总条数取出参 total'],
      apis: ['ruleInfoPage'],
      apiNotes: ['翻页传目标 pageIndex；翻页保留已选中的行'],
    },
    {
      selector: '#btnSrcExport', kind: 'button', label: 'Source · Export', region: '列表下方按钮',
      rules: ['列表有值即可用；范围 = 当前页；只导显示中的列（同 01 §4.1）', '文件名：Source_RuleInfo_导出时刻 yyyyMMddHHmmss.xlsx（加 Source_ 前缀与 Target 区分）'],
      apiNotes: ['不调后端：当前页出参在前端生成 Excel；导出接口文档未给出（待确认）'],
    },
    {
      selector: '#btnColSettings', kind: 'button', label: '可选列（共用一份）', region: '列表下方按钮',
      on: { click: ['打开列设置抽屉'] },
      rules: ['入口只做一份，作用于 Source 与 Target 两个列表（§2.4）'],
      apiNotes: ['不调接口（纯前端行为）'],
    },
    {
      selector: '#colDrawer', kind: 'drawer', label: '列设置抽屉', region: '列设置抽屉（共用一份）',
      rules: [
        '内容同 01 §3.3：可隐藏三列显隐（默认勾上）、EXEC_STATUS（默认不勾）、Lock Object 多选、Call Sys 多选',
        '不做列拖拽排序、不设恢复默认',
        '勾选 / 取消一次，两个列表同时变；列的顺序也共用',
      ],
      on: { load: ['进页面取 Lock Object 与 Call Sys 候选值'] },
      apiNotes: ['Lock Object 与 Call Sys 勾选记入浏览器本地'],
    },
    {
      selector: '#lockObjectBox', kind: 'checkbox', label: 'Lock Object 多选', region: '列设置抽屉（共用一份）',
      rules: ['每选中一项追加一列（Lock + 空格 + 对象名）；两个列表同时追加；缺该项耗时显示空'],
      on: { change: ['勾选记入浏览器本地'] },
      apis: ['lockObjectList'],
      apiNotes: ['出参：`data.lockObject` = 字符串数组；取值取当前页出参 `costBreakDown[]` 命中那条的 summary'],
    },
    {
      selector: '#callSysBox', kind: 'checkbox', label: 'Call Sys 多选', region: '列设置抽屉（共用一份）',
      rules: ['每选中一项追加一列（Call + 空格 + 系统名）；两个列表同时追加'],
      on: { change: ['勾选记入浏览器本地'] },
      apis: ['callSysList'],
      apiNotes: ['出参：`data.calledSystem` = 字符串数组'],
    },
    {
      selector: '#btnDrawerConfirm', kind: 'button', label: '确认（列设置）', region: '列设置抽屉（共用一份）',
      on: { click: ['按当前页已有数据重渲染两个列表的列，不重新查询'] },
      apiNotes: ['不调接口：列值一律取当前页出参，就地追加或撤掉，行数据不动'],
    },
    {
      selector: '#targetZone', kind: 'other', label: 'Target 区启用门禁', region: 'Target 区',
      rules: [
        '先决条件：Source 列表选中 1 条之后，Target 区才可用',
        'Source 未选中：本区所有条件与按钮一律禁用（置灰，不可填、不可点）',
        'Source 换选另一行 / 取消选中：Target 区清空 —— 条件复位到初始态、结果列表清空、7 个开关回到全关',
      ],
      dependsOn: ['Source 列表已选中 1 条'],
      apiNotes: ['不调接口（纯前端门禁）'],
    },
    {
      selector: '#sameBox', kind: 'toggle', label: 'Same X 开关组（7 个）', region: 'Target 区',
      rules: [
        '7 个开关逐一对应选中 Source 行的同名字段：Same Environment / Host IP / ServerID / EQP / Carrier / Lot / Rule Result',
        '进页面默认全部关闭；关闭 = 该字段不参与 Target 的过滤',
        '勾选 = 取选中那条 Source 行的同名字段值作为 Target 的过滤条件（开关后实时显示取到的值）',
        'Source 换选 / 取消选中 → 7 个开关回到全关',
      ],
      notes: ['Rule Name 无开关：Target 过滤恒带选中 Source 行的 RULENAME（不可改）', 'TID 不参与 Target 的过滤（无开关、无输入框，可与 Source 不同）'],
      apiNotes: ['不调接口：值直接取选中的 Source 行'],
    },
    {
      selector: '#tgtEnvSelect', kind: 'select', label: 'Target · Environment', region: 'Target 区',
      required: true, param: 'env', options: ['PROD', 'PIRUN'], placeholder: '必选',
      rules: [
        '未勾 Same Environment：本下拉可用，候选接口与 Source 区相同；为空不能 Search',
        '勾选 Same Environment：本下拉禁用，值直接取选中 Source 行的 ENV',
      ],
      apis: ['envList'],
      apiNotes: ['入参：`parameters.env`（勾 Same Environment 时填 Source 行的 ENV）'],
    },
    {
      selector: '#tgtStartTime', kind: 'input', label: 'Target · 开始时间', region: 'Target 区',
      required: true, param: 'startTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: TIME_RULES.concat(['Target 有自己的时间选择器，与 Source 区的时间各自独立、互不影响；检索一律用 Target 自己的时间']),
      notes: TIME_NOTES,
      apiNotes: ['入参：`parameters.startTime`（Target 自己的时间）'],
    },
    {
      selector: '#tgtEndTime', kind: 'input', label: 'Target · 结束时间', region: 'Target 区',
      required: true, param: 'endTime', format: '页面上 YYYY-MM-DD HH:mm；入参 yyyyMMddHHmm',
      rules: TIME_RULES, notes: TIME_NOTES,
      apiNotes: ['入参：`parameters.endTime`（Target 自己的时间）'],
    },
    {
      selector: '#deepSearchToggle', kind: 'toggle', label: 'Deep Search 开关', region: 'Target 区',
      rules: [
        '进页面默认打开（默认走深度检索）',
        '关闭 = 快速检索：检索条件与排序方法完全相同，只是结果只输出第一行（按 Start Time 倒排、排除 Source 行），Target 列表默认选中这一行',
        '打开 = 深度检索：结果按分页输出多行，不默认选中，由用户自选 1 行',
        '界面不设「搜索耗时上限」输入项（检索超时保护归后端请求超时，不进界面）',
      ],
      apiNotes: ['两种模式调的都是同一个接口，只是输出条数不同'],
    },
    {
      selector: '#btnTgtSearch', kind: 'button', label: 'Target · Search', region: 'Target 区',
      dependsOn: ['Source 列表已选中 1 条（Target 区已启用）'],
      rules: ['前置校验：Environment 为空（未勾 Same Environment 时）/ 时间不合法 → 拦住，不发请求'],
      on: { click: ['查第 1 页；descTime = true（按 Start Time 倒排）；排除选中的 Source 那一行'] },
      apis: ['ruleInfoPage'],
      apiNotes: [
        '入参：`parameters` = env（未勾取本区下拉，勾了取 Source 行 ENV）+ startTime / endTime（Target 自己的）+ ruleName（恒带选中 Source 行的 RULENAME）+ 勾上的 Same X 字段；其余键一概不传',
        '快速检索只取返回的第一行；深度检索多行分页',
      ],
    },
    {
      selector: '#tgtTable', kind: 'table', label: 'Target Rule Info 列表', region: 'Target 区',
      rules: [
        '列与 Source 列表同一套（01 §3.2；无 Server Hang 列）；列设置共用一份、横向滚动同步',
        '按 Start Time 倒排（新 → 旧），与 Source 列表相反',
        '快速检索后只有 1 行且默认选中；深度检索后多行、不默认选中',
        '单选 1 条（行首单选框或点击整行）—— 选中的这条即 Target',
        'Source 换选 / 取消选中 → 本列表清空',
      ],
      apis: ['ruleInfoPage'],
      apiNotes: ['行数据 = 出参 `data.contents[]`；出参 `id` = 块 _id，不出列，留给 Compare 当入参'],
    },
    {
      selector: '#tgtPager', kind: 'pager', label: 'Target 分页组件', region: 'Target 区',
      rules: ['默认每页 20 条，档位 20、50、100；始终显示', '快速检索只输出第一行（不分页多行）'],
      apis: ['ruleInfoPage'],
      apiNotes: ['翻页传目标 pageIndex'],
    },
    {
      selector: '#btnTgtExport', kind: 'button', label: 'Target · Export', region: '列表下方按钮',
      rules: ['列表有值即可用；范围 = 当前页；只导显示中的列', '文件名：Target_RuleInfo_导出时刻 yyyyMMddHHmmss.xlsx（加 Target_ 前缀）'],
      apiNotes: ['不调后端：当前页出参在前端生成 Excel；导出接口文档未给出（待确认）'],
    },
    {
      selector: '#btnDownloadRuleInfo', kind: 'button', label: 'Download Rule Info', region: '列表下方按钮',
      dependsOn: ['Target 列表已选中 1 行'],
      rules: [
        '可用条件：Target 列表选中 1 行之后',
        '下载的是 Source 那条：入参 = 选中 Source 行的块 id（列表出参 id 字段，值 = 块 _id，不出列）',
        '点一次 = 调一次下载接口；产物一个 .log 文件',
        '文件名：RuleName_Start 时间戳.log（时间戳格式 yyyyMMddHHmmss）—— 取选中 Source 行的 RULENAME 与 START_TIME',
        '与 01 Full Log 的区别只在产物：本接口下 Rule 日志（这一次执行）；Full Log 下该块涉及的全部文件（zip）',
      ],
      apis: ['ruleInfoRuleLog'],
      apiNotes: ['入参与 01 的 Full Log 接口完全相同（都是 id = 块 id）；出参是 .log 文件本身，直接下载不走统一响应包'],
    },
    {
      selector: '#btnCompare', kind: 'button', label: 'Compare Rule Info', region: '列表下方按钮',
      dependsOn: ['Target 列表已选中 1 行'],
      rules: [
        '可用条件：Target 列表选中 1 行之后',
        '形态：左右比较（形同 Beyond Compare）—— 左栏恒为 Source、右栏恒为 Target；上下两个比较框',
        '换选 Source 或 Target 行、或再点一次 Compare：两侧已加载内容清空、游标复位，都从第一页重新拉',
      ],
      on: { click: ['分别用选中 Source 行与 Target 行的块 id 打开比较弹窗'] },
      apis: ['ruleInfoDetail'],
      apiNotes: [
        '点 Compare 后两侧分别调 GET /log-viewer/api/v1/rule_info/detail，游标分页拉完各自请求的完整日志（finished = true 为止）',
        '两侧各自独立持游标 (lastFingerprint, lastOffset)，互不影响',
      ],
    },
    {
      selector: '#cmpKvTable', kind: 'table', label: '上框 · 请求 message 比对', region: 'Compare Rule Info 弹窗',
      rules: [
        '取哪一行：各自日志里自上而下第一条含 :>>L 或 :>>T 的行（该块首行 / 消息行）',
        '解析：前端按 06-附录A 的同一套算法解成 KV 集合（:>>L 走附录一 ~ 三；:>>T 走附录 §四）—— 在 UI 端自己实现，不是调派生层拿结果',
        '摆放：左右并排、共一张表、三列 —— Key、Source 中该 Key 的值、Target 中该 Key 的值',
        '行怎么来：两侧条目按 Key 对齐 —— Key 相同合到一行；只有一侧有的 Key 单独占一行、另一侧留空',
        '同 Key 判定：按解析出的原 Key 名严格相等，不按别名表归一（USER 与 USERID 算两个 Key，各占一行、互相留空）',
        '摆哪些键：解析出多少摆多少（含 FPB08765 这类动态键）；行序按 Key 名的字典序',
        '差异标注：两侧不一样的地方都做标记（本原型用红字 + 红底示意）',
        'XML 形态（K = XMLDATA）：只保留 XML 数据，格式化后每个标签一行（值挂开标签行、结构行照占一行），三列同 KV 形态；同一 Rule 两条日志一般同为一种形态，不另设混合形态规则',
      ],
      apis: ['ruleInfoDetail'],
      apiNotes: ['数据来源 = 两侧 detail 接口拉回的首行原文，解析在前端做'],
    },
    {
      selector: '#cmpLogS', kind: 'other', label: '下框 · Source 日志栏', region: 'Compare Rule Info 弹窗',
      rules: [
        '左栏 = Source；复用 01 Rule Info Detail 弹窗的日志文本框呈现（按行原文、长行自动换行）',
        '行对齐：按原始行号逐行对（第 N 行对第 N 行）；两侧行数不一致时短的一侧留空行补齐；长行折行只影响视觉、不算新行',
        '初始加载：打开后拉第一页（首次调用 lastFingerprint / lastOffset 留空）；新日志追加到尾部',
        '提前预取：距已加载内容的末位约 20 行（按原始行计）即触发拉下一页；触发后检查两侧上一轮 finished：为 false 的都继续拉，已为 true 的不再拉',
        '滚动联动：按滚动偏移同步 —— 一侧滚多少另一侧跟同样偏移；短的一侧先到底就停在底、长的一侧继续跟',
        '同步解除：某一侧 finished = true 且已滚到底即解开偏移同步，之后各自滚动（本次对比内不再恢复）',
      ],
      apis: ['ruleInfoDetail'],
      apiNotes: ['差异标注：两侧不一样的行做标记（本原型红字示意）'],
    },
    {
      selector: '#cmpLogT', kind: 'other', label: '下框 · Target 日志栏', region: 'Compare Rule Info 弹窗',
      rules: [
        '右栏 = Target；口径与 Source 日志栏一致（各自独立游标、偏移同步、提前预取）',
        '终止：两侧都 finished = true 后，再滚到底不再触发',
      ],
      apis: ['ruleInfoDetail'],
      apiNotes: ['两侧各自独立持 (lastFingerprint, lastOffset)，互不影响'],
    },
    {
      selector: '#btnCmpClose', kind: 'button', label: '关闭（Compare 弹窗）', region: 'Compare Rule Info 弹窗',
      on: { click: ['关闭弹窗'] },
      rules: ['关闭后再打开（或换选后点 Compare）：两侧清空重取，从第一页重新拉'],
      apiNotes: ['不调接口（纯前端行为）'],
    },
  ],
  table: {
    selector: '#srcTable',
    dataApi: 'ruleInfoPage',
    columns: COLUMNS,
    pagination: { api: 'ruleInfoPage', pageParam: 'pageIndex', pageSize: 20, serverSide: true, totalField: 'total' },
    rowSelection: { mode: 'single', requiredBy: ['#targetZone', '#btnDownloadRuleInfo', '#btnCompare'],
      clearedOn: ['重新 Search', '换选 / 取消选中（触发 Target 区复位）'] },
  },
  mock: [
    '所有接口路径、方法、入参与出参依 02 文档 §五；原型不真实发请求，数据全为本地模拟',
    '进页面 Source 列表直接呈现正常态数据（真实页面进页面是未查询态，点 Search 后才有结果）；Target 区进门即锁定，选中 Source 行后启用',
    'Source 列表 5 行为本地模拟（同一 TID 命中多条的样例）；Target 列表 6 行本地模拟，快速检索演示时只取第 1 行并默认选中',
    'Target 列表整表由 JS 渲染（列集合与顺序与 Source 共用一份列设置）；动态耗时列取值由确定性算法模拟',
    'Compare 上框的 KV 集合为静态样例（含动态键 FPB08765、单侧键 USERID、差异键 STEP / carrierId / lotId）；真实解析在前端按 06-附录A 同一套算法跑',
    'Compare 下框 Source 100 行 / Target 72 行由确定性算法生成；每批 40 行、距末位约 20 行触发预取为演示节奏（真实每批条数由后端定）',
    'Export、Download Rule Info 只弹轻提示，不产生真实文件下载',
    '分页条数档位与页码为静态演示',
  ],
  openQuestions: [
    'Export 的导出接口文档未给出（同 01），当前按「前端生成 Excel」实现',
  ],
};

const html = buildPrototype({ title: spec.title, styles: STYLES, content: CONTENT, spec });
writePrototype(OUT, html);

console.log('生成完成：' + OUT);
console.log('控件 ' + spec.controls.length + ' 个 · 接口 ' + spec.apis.length + ' 个 · 静态列 ' + COLUMNS.length + ' 列');
