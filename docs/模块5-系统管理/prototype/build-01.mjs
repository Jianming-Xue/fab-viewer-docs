/**
 * 生成「Server Hang Reason Config」标注原型（单文件自包含 HTML）。
 *
 * 设计依据：docs/模块5-系统管理/01-Server Hang Reason Config.md
 * 视觉令牌：docs/05-视觉与交互规范.md（AntD 5 语汇 · 高级绿 #2F7D5A · 圆角 6px）
 * 生成框架：~/.claude/skills/annotated-prototype（只替换 4 个占位符）
 *
 * 用法：node build-01.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototype, writePrototype } from '/Users/xuejianming/.claude/skills/annotated-prototype/tests/lib/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'Server-Hang-Reason-Config-annotated-prototype.html');
const SKILL = 'annotated-prototype/spec@1';

/* ───────────────────────── 列表列定义（唯一事实源：表头 + 规格清单同源）───────────────────────── */
const COLUMNS = [
  { key: 'ruleName', label: 'Rule Name', align: 'left', format: 'text' },
  { key: 'startLineLike', label: 'Start Line Like', align: 'left', format: 'text', note: '带 % 的库中完整值' },
  { key: 'endLineLike', label: 'End Line Like', align: 'left', format: 'text', note: '带 % 的库中完整值' },
  { key: 'hangReason', label: 'Hang Reason', align: 'left', format: 'text' },
  { key: 'enabled', label: 'Enabled', align: 'center', format: 'toggle' },
  { key: 'updatedAt', label: 'Last Updated Time', align: 'left', format: 'datetime' },
  { key: 'updatedBy', label: 'Last Updated User', align: 'left', format: 'text' },
  { key: 'action', label: 'Action', align: 'center', format: 'action', note: '最右固定：删除 / 编辑' },
];

/* ───────────────────────── 假数据（覆盖四式与 enabled 两态） ───────────────────────── */
const ROWS = [
  { id: 'cfg-001', ruleName: 'POST', startLineLike: '%FWLockMgr:acquire lock object%', endLineLike: '%lock object%acquired%', hangReason: 'LOCK_WAIT', enabled: true, updatedAt: '2026-10-08 14:32:05', updatedBy: 'xuejm' },
  { id: 'cfg-002', ruleName: 'POST', startLineLike: 'FwTxnSender:wait ack%', endLineLike: '%ack received%', hangReason: 'ACK_WAIT', enabled: true, updatedAt: '2026-10-08 14:35:41', updatedBy: 'xuejm' },
  { id: 'cfg-003', ruleName: 'CARRIER_MOVE', startLineLike: '%FwCarrierMgr:query carrier%', endLineLike: 'FwCarrierMgr:query carrier done', hangReason: 'CARRIER_QUERY', enabled: false, updatedAt: '2026-10-09 09:12:18', updatedBy: 'wangy' },
  { id: 'cfg-004', ruleName: 'LOT_TRACK_IN', startLineLike: '%RECIPE_VERIFY:step%', endLineLike: '%step%verified%', hangReason: 'RECIPE_STEP', enabled: true, updatedAt: '2026-10-10 16:47:52', updatedBy: 'xuejm' },
  { id: 'cfg-005', ruleName: 'TXN_PORTER_JOB', startLineLike: '%MCS:assign job%', endLineLike: '%job assigned%', hangReason: 'MCS_ASSIGN', enabled: false, updatedAt: '2026-10-11 11:03:29', updatedBy: 'liuh' },
];

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

  .btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 16px;font:inherit;font-size:13px;
    color:var(--t1);background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;white-space:nowrap;}
  .btn:hover{border-color:var(--p);color:var(--p);}
  .btn.primary{color:#fff;background:var(--p);border-color:var(--p);}
  .btn.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff;}
  .btn:disabled{color:var(--t3);background:var(--fill);border-color:var(--bd);cursor:not-allowed;}
  .btn:disabled:hover{color:var(--t3);border-color:var(--bd);}
  .btn.primary:disabled{color:#fff;background:var(--p);border-color:var(--p);opacity:.45;}
  .btn.primary:disabled:hover{background:var(--p);border-color:var(--p);}
  .icon-btn{width:28px;height:28px;font:inherit;font-size:15px;line-height:1;color:var(--t2);
    background:transparent;border:0;border-radius:var(--r);cursor:pointer;}
  .icon-btn:hover{color:var(--p);background:var(--p-bg);}
  .link-btn{font:inherit;font-size:12.5px;color:var(--p);background:transparent;border:0;padding:0 4px;cursor:pointer;}
  .link-btn:hover{text-decoration:underline;}
  .actions{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}

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
  table.grid td.sticky-left,table.grid td.sticky-right{background:#fff;}
  table.grid tbody tr:hover td.sticky-left,table.grid tbody tr:hover td.sticky-right{background:var(--fill);}
  table.grid tbody tr.selected td.sticky-left,table.grid tbody tr.selected td.sticky-right{background:var(--p-bg);}
  .sticky-left{position:sticky;left:0;z-index:2;box-shadow:1px 0 0 var(--split);}
  thead .sel-col{position:sticky;top:0;left:0;z-index:5;}
  .sticky-right{position:sticky;right:0;z-index:2;box-shadow:-1px 0 0 var(--split);}
  thead .sticky-right{z-index:5;}
  .row-radio{width:14px;height:14px;accent-color:var(--p);cursor:pointer;vertical-align:middle;}
  .like-cell{font-family:var(--mono);font-size:12px;}
  .enable-toggle{display:inline-flex;align-items:center;width:36px;height:20px;padding:0;border:0;
    border-radius:999px;background:rgba(0,0,0,.25);cursor:pointer;transition:background .16s;position:relative;}
  .enable-toggle::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .16s;}
  .enable-toggle.on{background:var(--p);}
  .enable-toggle.on::after{left:18px;}

  .pager{display:flex;align-items:center;gap:8px;padding:12px 16px;font-size:12.5px;color:var(--t2);}
  .pager .spacer{flex:1;}
  .pg-btn{min-width:28px;height:28px;padding:0 8px;font:inherit;font-size:12.5px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;}
  .pg-btn.active{color:var(--p);background:var(--p-bg);border-color:var(--p);}
  .pg-btn:disabled{color:var(--t3);background:var(--fill);cursor:not-allowed;}

  /* 配置表单区 */
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;padding:16px;}
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
  .like-field{grid-column:1 / -1;}
  .like-row{display:flex;align-items:center;gap:12px;}
  .like-row .input{flex:1;}
  .match-box{display:flex;align-items:center;gap:2px;padding:2px;background:var(--fill);
    border:1px solid var(--bd);border-radius:var(--r);white-space:nowrap;}
  .match-box input[type=radio]{accent-color:var(--p);margin:0 2px 0 6px;cursor:pointer;}
  .match-box label{font-size:12px;color:var(--t2);cursor:pointer;padding:0 6px 0 2px;line-height:24px;}
  .form-note{margin:0;padding:10px 16px;font-size:12px;color:var(--t3);background:var(--fill);
    border-top:1px solid var(--split);}
  .form-note code{font-family:var(--mono);font-size:11.5px;color:var(--t2);}

  /* 删除确认弹框 */
  .mask{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.45);display:none;}
  .mask.open{display:block;}
  .modal{position:fixed;top:50%;left:50%;z-index:10000;display:none;flex-direction:column;
    width:min(440px,92vw);background:#fff;border-radius:var(--r-lg);overflow:hidden;
    transform:translate(-50%,-50%);box-shadow:0 24px 70px -20px rgba(0,0,0,.5);}
  .modal.open{display:flex;}
  .modal-head{padding:14px 16px;border-bottom:1px solid var(--split);}
  .modal-head h3{margin:0;font-size:15px;font-weight:600;}
  .modal-body{padding:16px;font-size:13px;color:var(--t2);line-height:20px;}
  .modal-body code{font-family:var(--mono);font-size:12px;color:var(--t1);}
  .modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}

  .toast{position:fixed;top:16px;left:50%;z-index:11000;padding:9px 16px;font-size:13px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);opacity:0;pointer-events:none;
    transform:translate(-50%,-12px);box-shadow:0 8px 24px -8px rgba(0,0,0,.3);
    transition:opacity .18s,transform .18s;max-width:80vw;}
  .toast.show{opacity:1;transform:translate(-50%,0);}
  .toast.warn{color:#874d00;background:#fffbe6;border-color:var(--warn);}
`;

/* ───────────────────────── 控件 HTML 片段 ───────────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const matchBox = (pre) => `
      <div class="match-box" id="${pre}Match">
        <input type="radio" name="${pre}Match" id="${pre}MatchBoth" value="both"><label for="${pre}MatchBoth">前后模糊</label>
        <input type="radio" name="${pre}Match" id="${pre}MatchSuffix" value="suffix"><label for="${pre}MatchSuffix">只后模糊</label>
        <input type="radio" name="${pre}Match" id="${pre}MatchPrefix" value="prefix"><label for="${pre}MatchPrefix">只前模糊</label>
        <input type="radio" name="${pre}Match" id="${pre}MatchExact" value="exact" checked><label for="${pre}MatchExact">精确</label>
      </div>`;

const rowHtml = (r) =>
  `<tr data-id="${r.id}" data-row='${esc(JSON.stringify(r))}'>` +
  `<td class="sel-col sticky-left"><input type="radio" class="row-radio" name="cfgSel"></td>` +
  `<td data-col="ruleName">${esc(r.ruleName)}</td>` +
  `<td data-col="startLineLike" class="like-cell">${esc(r.startLineLike)}</td>` +
  `<td data-col="endLineLike" class="like-cell">${esc(r.endLineLike)}</td>` +
  `<td data-col="hangReason">${esc(r.hangReason)}</td>` +
  `<td data-col="enabled" class="center"><button type="button" class="enable-toggle${r.enabled ? ' on' : ''}" aria-pressed="${r.enabled}"></button></td>` +
  `<td data-col="updatedAt">${esc(r.updatedAt)}</td>` +
  `<td data-col="updatedBy">${esc(r.updatedBy)}</td>` +
  `<td class="sticky-right"><button type="button" class="link-btn row-edit">编辑</button><button type="button" class="link-btn row-del">删除</button></td>` +
  '</tr>';

/* ───────────────────────── 页内行为（演示用；不含真实业务请求）───────────────────────── */
const PAGE_SCRIPT = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var toastEl = $('toast'), toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 3200);
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

  /* 表格行选择：单选 */
  var editing = null; /* null = 新增模式；否则 = 编辑中的行 id */
  var tbody = $('cfgTableBody');
  tbody.addEventListener('click', function (ev) {
    if (ev.target.closest('.row-edit') || ev.target.closest('.row-del') || ev.target.closest('.enable-toggle')) return;
    var tr = ev.target.closest('tr');
    if (!tr) return;
    var on = tr.classList.contains('selected');
    var rows = tbody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('selected');
      var radio = rows[i].querySelector('.row-radio');
      if (radio) radio.checked = false;
    }
    if (!on) { tr.classList.add('selected'); tr.querySelector('.row-radio').checked = true; }
  });

  /* 四式拆装：库中带 % 的值 ↔ 输入框文本 + 单选框 */
  function splitLike(v) {
    var head = v.charAt(0) === '%', tail = v.charAt(v.length - 1) === '%' && v.length > 1;
    var text = v.replace(/^%/, '').replace(/%$/, '');
    var mode = head && tail ? 'both' : tail ? 'suffix' : head ? 'prefix' : 'exact';
    return { text: text, mode: mode };
  }
  function joinLike(text, mode) {
    return (mode === 'both' || mode === 'prefix' ? '%' : '') + text +
           (mode === 'both' || mode === 'suffix' ? '%' : '');
  }
  function radioOf(pre) {
    var box = $(pre + 'Match');
    var list = box.querySelectorAll('input[type=radio]');
    for (var i = 0; i < list.length; i++) if (list[i].checked) return list[i].value;
    return 'exact';
  }

  /* Action：编辑 → 回填（拆 % 设单选） */
  tbody.addEventListener('click', function (ev) {
    var editBtn = ev.target.closest('.row-edit');
    if (editBtn) {
      var tr = editBtn.closest('tr');
      var row = JSON.parse(tr.getAttribute('data-row'));
      editing = row.id;
      $('ruleNameInput').value = row.ruleName;
      $('hangReasonInput').value = row.hangReason;
      var s = splitLike(row.startLineLike), e = splitLike(row.endLineLike);
      $('startLineInput').value = s.text;
      $('endLineInput').value = e.text;
      $('startMatch').querySelector('input[value="' + s.mode + '"]').checked = true;
      $('endMatch').querySelector('input[value="' + e.mode + '"]').checked = true;
      ['ruleNameInput', 'hangReasonInput', 'startLineInput', 'endLineInput'].forEach(function (id) { setErr(id, ''); });
      $('formMode').textContent = '编辑模式 · ' + row.ruleName + ' / ' + row.hangReason + '（Confirm 走 PUT，入参 id = ' + row.id + '）';
      toast('已回填选中配置：标志值已拆掉首尾 %，单选框按库中 % 位置设好');
      tr.scrollIntoView({ block: 'nearest' });
    }
  });

  /* Action：删除 → 确认弹框 */
  var delRow = null;
  tbody.addEventListener('click', function (ev) {
    var delBtn = ev.target.closest('.row-del');
    if (!delBtn) return;
    delRow = delBtn.closest('tr');
    var row = JSON.parse(delRow.getAttribute('data-row'));
    $('delBody').innerHTML = '确认删除配置 <code>' + row.ruleName + ' / ' + row.hangReason + '</code>？<br>已产出的历史 Hang 记录不受影响（不回算）。';
    $('delModal').classList.add('open');
    $('delMask').classList.add('open');
  });
  $('btnDelCancel').addEventListener('click', function () {
    $('delModal').classList.remove('open');
    $('delMask').classList.remove('open');
  });
  $('delMask').addEventListener('click', function () {
    $('delModal').classList.remove('open');
    $('delMask').classList.remove('open');
  });
  $('btnDelOk').addEventListener('click', function () {
    var row = JSON.parse(delRow.getAttribute('data-row'));
    delRow.parentNode.removeChild(delRow);
    $('delModal').classList.remove('open');
    $('delMask').classList.remove('open');
    toast('已删除 ' + row.ruleName + ' / ' + row.hangReason + '（历史 Hang 不回算；判定行为最迟 5 分钟生效）');
  });

  /* Enabled 开关 → state 接口，局部更新该行 */
  tbody.addEventListener('click', function (ev) {
    var tgl = ev.target.closest('.enable-toggle');
    if (!tgl) return;
    var on = tgl.classList.toggle('on');
    tgl.setAttribute('aria-pressed', on ? 'true' : 'false');
    var tr = tgl.closest('tr');
    var row = JSON.parse(tr.getAttribute('data-row'));
    row.enabled = on;
    tr.setAttribute('data-row', JSON.stringify(row));
    toast('已切换 enabled = ' + on + '（POST /log-viewer/api/v1/srv_hang_cfg/state，局部更新本行不重拉；最迟 5 分钟生效，历史 Hang 不回算）');
  });

  /* 刷新：重拉第一页 */
  $('btnRefresh').addEventListener('click', function () {
    toast('已重新拉取第一页（GET /log-viewer/api/v1/srv_hang_cfg/page，默认排序 ruleName + hangReason 升序）');
  });

  /* 表单校验（Confirm 时全量；字符集/长度按 §4.2） */
  function checkForm() {
    var ok = true;
    var rn = $('ruleNameInput').value.trim();
    if (!rn) { setErr('ruleNameInput', '必填（编辑时改后不能为空）'); ok = false; }
    else if (!/^[0-9A-Za-z]{1,255}$/.test(rn)) { setErr('ruleNameInput', '仅数字、大小写字母，长度 ≤ 255'); ok = false; }
    else setErr('ruleNameInput', '');
    var hr = $('hangReasonInput').value.trim();
    if (!hr) { setErr('hangReasonInput', '必填'); ok = false; }
    else if (!/^[0-9A-Za-z._\\-]{1,255}$/.test(hr)) { setErr('hangReasonInput', '仅数字、大小写字母、逗号、点、下划线、中划线，长度 ≤ 255'); ok = false; }
    else setErr('hangReasonInput', '');
    ['startLineInput', 'endLineInput'].forEach(function (id) {
      var v = $(id).value;
      if (!v.trim()) { setErr(id, '必填（不限字符，长度 ≤ 4000；% 不进输入框）'); ok = false; }
      else if (v.length > 4000) { setErr(id, '长度 ≤ 4000'); ok = false; }
      else setErr(id, '');
    });
    return ok;
  }

  /* Confirm：双模式 + 提交拼接 */
  $('btnConfirm').addEventListener('click', function () {
    if (!checkForm()) { toast('表单不合法，已拦住提交', 'warn'); return; }
    var sLike = joinLike($('startLineInput').value, radioOf('start'));
    var eLike = joinLike($('endLineInput').value, radioOf('end'));
    if (editing) {
      toast('PUT /log-viewer/api/v1/srv_hang_cfg · id=' + editing + ' · startLineLike=“' + sLike + '” · endLineLike=“' + eLike + '”（% 由单选框拼回首尾）');
    } else {
      toast('POST /log-viewer/api/v1/srv_hang_cfg · id=null · startLineLike=“' + sLike + '” · endLineLike=“' + eLike + '”（新配置插入表格第一行；业务唯一键 ruleName+hangReason 冲突即拒）');
    }
  });

  /* Cancel：清空 + 取消选中（回新增模式） */
  $('btnCancel').addEventListener('click', function () {
    ['ruleNameInput', 'hangReasonInput', 'startLineInput', 'endLineInput'].forEach(function (id) {
      $(id).value = ''; setErr(id, '');
    });
    $('startMatch').querySelector('input[value=exact]').checked = true;
    $('endMatch').querySelector('input[value=exact]').checked = true;
    editing = null;
    var rows = tbody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.remove('selected');
      var radio = rows[i].querySelector('.row-radio');
      if (radio) radio.checked = false;
    }
    $('formMode').textContent = '新增模式（表单为空 · Confirm 走 POST，id 可为空）';
    toast('已清空表单并取消表格选中，回到新增模式');
  });
})();
`;

/* ───────────────────────── 页面内容 ───────────────────────── */
const CONTENT = `
<div class="page-head">
  <div class="crumb">系统管理 · 模块 5 · 功能 1</div>
  <h1>Server Hang Reason Config</h1>
  <p class="sub">第一类 Server Hang 的判定配置：一条配置 = 一个 Rule × 一个 Hang 原因 × 一对开始 / 结束标志；不分环境（PIRUN / PROD 共用），判定与运行归派生服务</p>
</div>

<section class="card">
  <div class="card-head">
    <h2>配置列表</h2>
    <span class="hint">进页面取第一页 · 每页 20 · 默认排序 ruleName + hangReason 升序</span>
    <button class="icon-btn" id="btnRefresh" type="button" title="刷新" aria-label="刷新">⟳</button>
  </div>
  <div class="table-wrap">
    <table class="grid" id="cfgTable">
      <thead><tr>
        <td class="sel-col sticky-left"></td>
${COLUMNS.filter(c => c.key !== 'action').map(c => `        <th data-col="${c.key}">${c.label}</th>`).join('\n')}
        <th class="sticky-right">Action</th>
      </tr></thead>
      <tbody id="cfgTableBody">
${ROWS.map(rowHtml).join('\n')}
      </tbody>
    </table>
  </div>
  <div class="pager" id="pager">
    <span id="pagerTotal">共 ${ROWS.length} 条</span>
    <span class="spacer"></span>
    <button class="pg-btn" disabled>‹</button>
    <button class="pg-btn active">1</button>
    <button class="pg-btn">›</button>
  </div>
</section>

<section class="card">
  <div class="card-head">
    <h2>配置控件</h2>
    <span class="hint" id="formMode">新增模式（表单为空 · Confirm 走 POST，id 可为空）</span>
  </div>
  <div class="form-grid">
    <div class="field" data-field="ruleNameInput">
      <label for="ruleNameInput">Rule Name <span class="req">*</span></label>
      <input class="input" id="ruleNameInput" type="text" placeholder="POST">
      <span class="err"></span>
    </div>
    <div class="field" data-field="hangReasonInput">
      <label for="hangReasonInput">Hang Reason <span class="req">*</span></label>
      <input class="input" id="hangReasonInput" type="text" placeholder="LOCK_WAIT">
      <span class="err"></span>
    </div>
    <div class="field like-field" data-field="startLineInput">
      <label for="startLineInput">Start Line Like <span class="req">*</span> <span class="tip">（只填具体文本，% 不进输入框；匹配方式交给右侧单选框）</span></label>
      <div class="like-row">
        <input class="input" id="startLineInput" type="text" placeholder="FWLockMgr:acquire lock object">
${matchBox('start')}
      </div>
      <span class="err"></span>
    </div>
    <div class="field like-field" data-field="endLineInput">
      <label for="endLineInput">End Line Like <span class="req">*</span> <span class="tip">（与 Start 各自单独配置：文本框 + 单选框各一组）</span></label>
      <div class="like-row">
        <input class="input" id="endLineInput" type="text" placeholder="lock object acquired">
${matchBox('end')}
      </div>
      <span class="err"></span>
    </div>
  </div>
  <p class="form-note">「精确匹配」= 与该行 <code>LOG_BODY</code>（剥掉行首时间戳 / Server ID 前缀后的本体）整串一字不差 —— 不能贴带前缀整行；<code>LOG_BODY</code> 超 4000 字符的行永远配不上；通常优先用前后模糊（包含式）。<code>ruleName</code> 不参与四式，一律精确。</p>
  <div class="actions">
    <span class="spacer"></span>
    <button class="btn" id="btnCancel" type="button">Cancel</button>
    <button class="btn primary" id="btnConfirm" type="button">Confirm</button>
  </div>
</section>

<div class="mask" id="delMask"></div>
<div class="modal" id="delModal" role="dialog" aria-hidden="true">
  <div class="modal-head"><h3>删除配置</h3></div>
  <div class="modal-body" id="delBody"></div>
  <div class="modal-foot">
    <button class="btn" id="btnDelCancel" type="button">取消</button>
    <button class="btn primary" id="btnDelOk" type="button">删除</button>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
${PAGE_SCRIPT}
</script>
`;

/* ───────────────────────── 规格清单（唯一事实源）───────────────────────── */
const MATCH_RULES = [
  '四选一：前后模糊（库中 %ABC%）/ 只后模糊（ABC%）/ 只前模糊（%ABC）/ 精确（ABC）',
  '页面上 % 不进输入框；提交时按单选框把 % 拼回首尾存库，编辑回显时拆开',
  '输入框不限 % 字符；实际执行只看首尾是否含 % 判定匹配方式',
];
const LIKE_RULES = [
  '不限任何字符，长度 ≤ 4000；只填具体文本，% 不进输入框（匹配方式交给单选框）',
  '与另一端各自单独配置（文本框 + 单选框各一组）',
  '按 SQL LIKE 语义匹配块内日志行（LOG_BODY = 剥掉行首时间戳 / Server ID 前缀后的本体）',
];

const spec = {
  schema: SKILL,
  title: 'Server Hang Reason Config',
  summary: '两段式配置页：上 = 配置表格区（进页面取第一页、无搜索框只有刷新图标、单选行、Enabled 开关即切、Action 删除 / 编辑），' +
    '下 = 配置控件区（表单：Rule Name / Hang Reason / Start·End Line Like 各配四式匹配单选、Confirm 双模式新增·编辑、Cancel 清空回新增）。' +
    '一条配置 = 一个 Rule × 一个 Hang 原因 × 一对开始 / 结束标志；不分环境。接口口径依 01 文档 §4.4。',
  regions: [
    { id: 'table', label: '配置表格区', role: 'table', desc: '进页面调 page 取第一页并回显；默认每页 20 条（不分档）；列序与 Action 最右固定' },
    { id: 'form', label: '配置控件区（表单）', role: 'form', desc: '新增 / 编辑共用一套表单；四式匹配用单选框表达、% 不进输入框；Confirm 按模式走 POST / PUT' },
  ],
  apis: [
    { id: 'cfgPage', method: 'GET', path: '/log-viewer/api/v1/srv_hang_cfg/page', desc: '分页取配置（默认排序 ruleName + hangReason 升序）' },
    { id: 'cfgState', method: 'POST', path: '/log-viewer/api/v1/srv_hang_cfg/state', desc: '切换一条配置的 enabled' },
    { id: 'cfgCreate', method: 'POST', path: '/log-viewer/api/v1/srv_hang_cfg', desc: '新增（id 为空）' },
    { id: 'cfgUpdate', method: 'PUT', path: '/log-viewer/api/v1/srv_hang_cfg', desc: '编辑（id = 选中行）' },
    { id: 'cfgDelete', method: 'DELETE', path: '/log-viewer/api/v1/srv_hang_cfg', desc: '删除（仅 id）' },
  ],
  controls: [
    {
      selector: '#btnRefresh', kind: 'button', label: '刷新图标按钮', region: '配置表格区',
      rules: ['页面无搜索框，顶部只有本刷新按钮', '点击重新调 page 取第一页并回显'],
      apis: ['cfgPage'],
      apiNotes: ['入参仅 pageIndex=1、pageSize=20；出参 contents[] 含 id 与全部列字段（startLineLike / endLineLike 为带 % 的库中完整值）'],
    },
    {
      selector: '#cfgTable', kind: 'table', label: '配置表格', region: '配置表格区',
      rules: [
        '列（按序）：Rule Name、Start Line Like、End Line Like、Hang Reason、Enabled、Last Updated Time、Last Updated User + Action（最右固定）',
        'Start / End Line Like 列显示库中带 % 的完整值',
        '行选择单选、不支持多选；点击行选中（Action 与开关不触发选中切换）',
        '翻页按页码再调 page 接口（推定）',
      ],
      apis: ['cfgPage'],
      apiNotes: ['行数据 = page 出参 contents[]；id 不出列，编辑 / 删除 / 切换的入参都用它'],
    },
    {
      selector: '.enable-toggle', kind: 'toggle', label: 'Enabled 行内开关', region: '配置表格区',
      rules: [
        '开关形态、可直接操作：true 打开 / false 关闭',
        '停用即该配置不参与判定（块不再产出该 Reason 的 Hang）；已产出的历史 Hang 不受影响（不回算）',
      ],
      on: { click: ['调 state 接口切换该条 enabled；成功后局部更新该行 Enabled 列，不重拉列表'] },
      apis: ['cfgState'],
      apiNotes: ['入参 { id, enabled }；出参 data 为空只报成败', '判定行为最迟 5 分钟生效（消费方 5min 缓存）'],
    },
    {
      selector: '.row-edit', kind: 'button', label: 'Action · 编辑', region: '配置表格区',
      rules: [
        '将该行内容填充进下方表单：ruleName / hangReason 原样填；startLineLike / endLineLike 拆掉首尾 % 后只填具体文本，并按 % 位置设好两个单选框',
        '编辑时全部输入框都可以改，改后不能为空',
      ],
      on: { click: ['表单进入编辑模式（Confirm 走 PUT）'] },
      apiNotes: ['不调接口（纯前端回填；提交在 Confirm）'],
    },
    {
      selector: '.row-del', kind: 'button', label: 'Action · 删除', region: '配置表格区',
      rules: ['弹框确认后才调 DELETE；成功后表格中删除该行', '已产出的历史 Hang 记录不受影响（不回算）'],
      apis: ['cfgDelete'],
      apiNotes: ['入参仅 id；出参 data 为空只报成败'],
    },
    {
      selector: '#ruleNameInput', kind: 'input', label: 'Rule Name 输入框', region: '配置控件区（表单）',
      required: true, param: 'ruleName', format: '数字、大小写字母，长度 ≤ 255',
      rules: ['精确匹配、不吃 %（不参与四式）；块 RULENAME 业务上单值'],
      apiNotes: ['业务唯一键 = ruleName + hangReason：同一 Rule 可配多个 Reason，同一组合只允许一条，冲突即拒'],
    },
    {
      selector: '#hangReasonInput', kind: 'input', label: 'Hang Reason 输入框', region: '配置控件区（表单）',
      required: true, param: 'hangReason', format: '数字、大小写字母、逗号、点、下划线、中划线，长度 ≤ 255',
      rules: ['人工填写的 Hang 原因，随产出写进块文档 HANG_LIST、模块 1 弹框展示'],
    },
    {
      selector: '#startLineInput', kind: 'input', label: 'Start Line Like 输入框', region: '配置控件区（表单）',
      required: true, param: 'startLineLike', format: '不限任何字符，长度 ≤ 4000',
      rules: LIKE_RULES,
      notes: ['开始行标志：派生服务按配置在该 Rule 的块内瞄定开始行'],
    },
    {
      selector: '#startMatch', kind: 'radio', label: 'Start 匹配方式单选框', region: '配置控件区（表单）',
      options: ['前后模糊', '只后模糊', '只前模糊', '精确'], rules: MATCH_RULES,
      notes: ['Confirm 提交拼接：按本单选框把 % 追加到 Start 文本首尾（只前模糊加头、只后模糊加尾、前后都加、精确不加）'],
      apiNotes: ['不调接口（纯前端行为，值并入 startLineLike 入参）'],
    },
    {
      selector: '#endLineInput', kind: 'input', label: 'End Line Like 输入框', region: '配置控件区（表单）',
      required: true, param: 'endLineLike', format: '不限任何字符，长度 ≤ 4000',
      rules: LIKE_RULES,
      notes: ['结束行标志：时差 > 0 产出一条 Hang 记录（含本配置的 hangReason）'],
    },
    {
      selector: '#endMatch', kind: 'radio', label: 'End 匹配方式单选框', region: '配置控件区（表单）',
      options: ['前后模糊', '只后模糊', '只前模糊', '精确'], rules: MATCH_RULES,
      notes: ['Confirm 提交拼接：按本单选框把 % 追加到 End 文本首尾'],
      apiNotes: ['不调接口（纯前端行为，值并入 endLineLike 入参）'],
    },
    {
      selector: '#btnConfirm', kind: 'button', label: 'Confirm（双模式）', region: '配置控件区（表单）',
      rules: [
        '编辑模式（已点编辑、表单已回填）：调 PUT，入参 id = 选中行的 id；成功后用出参更新选中行每个单元格',
        '新增模式（表单为空）：调 POST，入参 id 可为空；成功后表格第一行插入出参内容',
        '提交前全量校验（各输入框非空 + 字符集 / 长度），不合法拦住',
        '提交拼接：startLineLike / endLineLike 的入参值 = 输入框文本按各自单选框追加 % 后的完整形态',
        'enabled 不入参（新增默认值由后端定，出参回显）',
        '新增 / 修改校验业务唯一键（ruleName + hangReason，冲突即拒）',
      ],
      apis: ['cfgCreate', 'cfgUpdate'],
      apiNotes: ['两接口入参同为 5 字段（id / ruleName / hangReason / startLineLike / endLineLike）；出参 = 单条配置对象'],
    },
    {
      selector: '#btnCancel', kind: 'button', label: 'Cancel', region: '配置控件区（表单）',
      rules: ['清空全部控件值（回到新增模式）+ 取消表格选中'],
      apiNotes: ['不调接口（纯前端行为）'],
    },
    {
      selector: '#pager', kind: 'pager', label: '分页组件', region: '配置表格区',
      rules: ['每页 20 条（不分档）；按页码再调 page 接口', '总条数取出参 total'],
      apis: ['cfgPage'],
      apiNotes: ['翻页传目标 pageIndex'],
    },
    {
      selector: '#delModal', kind: 'modal', label: '删除确认弹框', region: '配置表格区',
      rules: ['展示待删配置的 ruleName / hangReason 与「历史 Hang 不回算」提示；确认后才调 DELETE'],
      apis: ['cfgDelete'],
      apiNotes: ['入参仅 id'],
    },
  ],
  table: {
    selector: '#cfgTable',
    dataApi: 'cfgPage',
    columns: COLUMNS,
    pagination: { api: 'cfgPage', pageParam: 'pageIndex', pageSize: 20, pageSizeFixed: true, serverSide: true, totalField: 'total' },
    rowSelection: { mode: 'single', requiredBy: ['#btnConfirm'], clearedOn: ['点 Cancel', '删除该行'] },
  },
  mock: [
    '所有接口路径、方法、入参与出参依 01 文档 §4.4；原型不真实发请求，数据全为本地模拟',
    '配置列表 5 行为本地模拟，覆盖四式（前后 / 只后 / 只前 / 精确）与 enabled 两态',
    '编辑回填会真的拆 % 设单选框；Confirm 的拼接结果以轻提示展示（不产生真实请求）',
    'Enabled 开关、删除（含确认弹框）、行选中、Cancel 复位均为真实前端行为',
    '新增 Confirm 演示为轻提示（真实页面成功后表格第一行插入出参内容）',
  ],
  openQuestions: [],
};

const html = buildPrototype({ title: spec.title, styles: STYLES, content: CONTENT, spec });
writePrototype(OUT, html);

console.log('生成完成：' + OUT);
console.log('控件 ' + spec.controls.length + ' 个 · 接口 ' + spec.apis.length + ' 个 · 静态列 ' + (COLUMNS.length) + ' 列');
