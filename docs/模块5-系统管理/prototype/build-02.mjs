/**
 * 生成「System Misc」标注原型（单文件自包含 HTML）。
 *
 * 设计依据：docs/模块5-系统管理/02-System Misc.md（左右布局定稿版）
 * 视觉令牌：docs/05-视觉与交互规范.md（AntD 5 语汇 · 高级绿 #2F7D5A · 圆角 6px）
 * 生成框架：~/.claude/skills/annotated-prototype（只替换 4 个占位符）
 *
 * 用法：node build-02.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototype, writePrototype } from '/Users/xuejianming/.claude/skills/annotated-prototype/tests/lib/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'System-Misc-annotated-prototype.html');
const SKILL = 'annotated-prototype/spec@1';

/* ───────────────────────── 列表列定义（唯一事实源）───────────────────────── */
const COLUMNS = [
  { key: 'item', label: 'Item', align: 'left', format: 'text' },
  { key: 'description', label: 'Description', align: 'left', format: 'text', note: '超长省略号截断' },
  { key: 'category', label: 'Category', align: 'left', format: 'text' },
  { key: 'value', label: 'Value', align: 'left', format: 'json', note: 'JSON 字符串，超长省略号；点击 → 查看弹框' },
  { key: 'updatedAt', label: 'Last Updated Time', align: 'left', format: 'datetime' },
  { key: 'updatedBy', label: 'Last Updated User', align: 'left', format: 'text' },
  { key: 'action', label: 'Action', align: 'center', format: 'action', note: '最右固定：修改 / 删除' },
];

/* ───────────────────────── 假数据（value 覆盖 Single / Multi 全值节点 / Map 节点 / 布尔） ───────────────────────── */
const ROWS = [
  { item: 'env_list', description: '环境名候选（01/02/03 Environment 下拉）', category: 'global', value: ['PROD', 'PIRUN'], updatedAt: '2026-10-08 10:12:31', updatedBy: 'xuejm' },
  { item: 'ip_list', description: 'Host IP 候选，按环境取键（环境联动）', category: 'global', value: [{ PROD: ['10.18.100.1', '10.18.100.2'] }, { PIRUN: ['10.18.200.1'] }], updatedAt: '2026-10-08 10:15:02', updatedBy: 'xuejm' },
  { item: 'server_category_list', description: 'Server Category 候选', category: 'global', value: ['LIST', 'QUERY', 'FAB', 'IDE', 'XSITE'], updatedAt: '2026-10-09 09:30:44', updatedBy: 'wangy' },
  { item: 'rule_result_list', description: 'Rule Result 候选（01 折叠区）', category: 'global', value: ['PASS', 'CANCELRULE'], updatedAt: '2026-10-09 09:32:10', updatedBy: 'wangy' },
  { item: 'hang_scan_interval_sec', description: '派生层 Hang 扫描间隔（秒）', category: 'hang', value: [30], updatedAt: '2026-10-10 14:02:55', updatedBy: 'xuejm' },
  { item: 'hang_max_delay_sec', description: '判定运行允许的最大延迟（秒）', category: 'hang', value: [120.5], updatedAt: '2026-10-10 14:05:19', updatedBy: 'xuejm' },
  { item: 'notify_enabled', description: '告警通知总开关', category: 'misc', value: [true], updatedAt: '2026-10-11 08:44:03', updatedBy: 'liuh' },
  { item: 'retry_policy', description: '失败重试策略（次数 / 退避）', category: 'misc', value: [{ max: [3] }, { backoff_sec: [1, 2, 4] }], updatedAt: '2026-10-11 08:47:26', updatedBy: 'liuh' },
];

const STYLES = `
  :root{
    --stage-max:1280px;
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

  /* 左右布局：左 = Category 窄列表，右 = 原三区 */
  .layout{display:grid;grid-template-columns:168px minmax(0,1fr);gap:16px;align-items:start;}
  .cat-card{border:1px solid var(--bd);border-radius:var(--r-lg);background:#fff;overflow:hidden;}
  .cat-head{padding:10px 12px;font-size:12.5px;font-weight:600;color:var(--t2);
    background:var(--fill);border-bottom:1px solid var(--split);}
  .cat-list{list-style:none;margin:0;padding:4px 0;}
  .cat-list li{padding:7px 12px;font-size:13px;color:var(--t2);cursor:pointer;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid transparent;}
  .cat-list li:hover{background:var(--fill);}
  .cat-list li.active{color:var(--p);background:var(--p-bg);border-left-color:var(--p);font-weight:600;}
  .cat-list li.all-item{border-bottom:1px solid var(--split);margin-bottom:4px;}

  .card{border:1px solid var(--bd);border-radius:var(--r-lg);background:#fff;margin:0 0 16px;}
  .card-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--split);}
  .card-head h2{margin:0;font-size:15px;font-weight:600;}
  .card-head .hint{margin-left:auto;font-size:12px;color:var(--t3);}

  .filters{display:flex;gap:10px;padding:14px 16px;align-items:flex-start;}
  .field{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;}
  .field>label{display:flex;align-items:center;gap:4px;font-size:12.5px;line-height:16px;color:var(--t2);white-space:nowrap;}
  .field .tip{font-size:11.5px;color:var(--t3);font-weight:400;}
  .input{font:inherit;font-size:13px;height:32px;padding:0 10px;width:100%;min-width:0;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);}
  .input::placeholder{color:var(--t3);}
  .input:focus{outline:none;border-color:var(--p);box-shadow:0 0 0 2px rgba(47,125,90,.12);}
  .input:disabled{background:var(--fill);color:var(--t3);cursor:not-allowed;}
  .input.invalid{border-color:var(--err);box-shadow:0 0 0 2px rgba(255,77,79,.12);}
  textarea.input{height:auto;min-height:64px;padding:6px 10px;resize:vertical;line-height:20px;}
  .filters .btn{margin-top:22px;}

  .btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 16px;font:inherit;font-size:13px;
    color:var(--t1);background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;white-space:nowrap;}
  .btn:hover{border-color:var(--p);color:var(--p);}
  .btn.primary{color:#fff;background:var(--p);border-color:var(--p);}
  .btn.primary:hover{background:var(--p-hover);border-color:var(--p-hover);color:#fff;}
  .btn:disabled{color:var(--t3);background:var(--fill);border-color:var(--bd);cursor:not-allowed;}
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
  table.grid td.sticky-right{background:#fff;}
  table.grid tbody tr:hover td.sticky-right{background:var(--fill);}
  .sticky-right{position:sticky;right:0;z-index:2;box-shadow:-1px 0 0 var(--split);}
  thead .sticky-right{z-index:5;}
  .mono-cell{font-family:var(--mono);font-size:12px;}
  .value-cell{font-family:var(--mono);font-size:12px;color:var(--p);cursor:pointer;max-width:320px;
    overflow:hidden;text-overflow:ellipsis;}
  .value-cell:hover{text-decoration:underline;}
  .desc-cell{max-width:260px;overflow:hidden;text-overflow:ellipsis;}
  .placeholder-row td{color:var(--t3);font-style:italic;background:#fffbe6!important;}

  .pager{display:flex;align-items:center;gap:8px;padding:12px 16px;font-size:12.5px;color:var(--t2);}
  .pager .spacer{flex:1;}
  .pg-btn{min-width:28px;height:28px;padding:0 8px;font:inherit;font-size:12.5px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);cursor:pointer;}
  .pg-btn.active{color:var(--p);background:var(--p-bg);border-color:var(--p);}
  .pg-btn:disabled{color:var(--t3);background:var(--fill);cursor:not-allowed;}

  /* 三模式弹框 */
  .mask{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,.45);display:none;}
  .mask.open{display:block;}
  .modal{position:fixed;top:50%;left:50%;z-index:10000;display:none;flex-direction:column;
    width:min(720px,94vw);max-height:88vh;background:#fff;border-radius:var(--r-lg);overflow:hidden;
    transform:translate(-50%,-50%);box-shadow:0 24px 70px -20px rgba(0,0,0,.5);}
  .modal.open{display:flex;}
  .modal-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--split);}
  .modal-head h3{margin:0;font-size:15px;font-weight:600;}
  .modal-head .hint{margin-left:auto;font-size:12px;color:var(--t3);}
  .modal-body{flex:1;min-height:0;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:14px;}
  .dlg-field{display:flex;flex-direction:column;gap:4px;}
  .dlg-field>label{font-size:12.5px;color:var(--t2);}
  .dlg-field .req{color:var(--err);font-weight:700;}
  .dlg-field .err{min-height:0;font-size:11px;line-height:13px;color:var(--err);visibility:hidden;}
  .dlg-field.invalid .err{visibility:visible;}
  .dlg-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}

  /* Value 编辑器（Single / Multi） */
  .ve{border:1px solid var(--bd);border-radius:var(--r);background:#fbfcfc;font-family:var(--mono);}
  .ve-bar{display:flex;align-items:center;gap:16px;padding:8px 12px;border-bottom:1px solid var(--split);background:var(--fill);}
  .ve-bar .seg{display:flex;align-items:center;gap:4px;font-size:12.5px;color:var(--t2);font-family:inherit;cursor:pointer;}
  .ve-bar .seg input{accent-color:var(--p);}
  .ve-body{padding:10px 12px;display:flex;flex-direction:column;gap:8px;font-family:inherit;}
  .ve-single-type{display:flex;align-items:center;gap:12px;font-size:12.5px;color:var(--t2);}
  .ve-single-type label{display:flex;align-items:center;gap:4px;cursor:pointer;}
  .ve-single-type input{accent-color:var(--p);}
  .bool-pick{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--t2);}
  .bool-pick label{display:flex;align-items:center;gap:4px;cursor:pointer;}
  .bool-pick input{accent-color:var(--p);}
  .ve input[type=text].ve-input{font:inherit;font-size:12.5px;height:30px;padding:0 8px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r-sm);width:100%;min-width:0;}
  .ve input[type=text].ve-input:focus{outline:none;border-color:var(--p);}
  .node{border:1px solid var(--bd);border-radius:var(--r-sm);background:#fff;padding:8px 10px;display:flex;flex-direction:column;gap:6px;}
  .node-head{display:flex;align-items:center;gap:12px;font-size:12px;color:var(--t2);}
  .node-head .seg{display:flex;align-items:center;gap:3px;cursor:pointer;}
  .node-head .seg input{accent-color:var(--p);}
  .node-head .del{margin-left:auto;font-size:12px;color:var(--err);background:none;border:0;cursor:pointer;padding:0 4px;}
  .map-vals{display:flex;flex-direction:column;gap:4px;padding-left:18px;}
  .map-val{display:flex;align-items:center;gap:6px;}
  .map-val .del{font-size:12px;color:var(--t3);background:none;border:0;cursor:pointer;padding:0 2px;}
  .map-val .del:hover{color:var(--err);}
  .add-mini{align-self:flex-start;font-size:12px;color:var(--p);background:none;border:0;cursor:pointer;padding:0 2px;}
  .add-mini:hover{text-decoration:underline;}
  .ve-foot{display:flex;align-items:center;gap:8px;padding:6px 12px;border-top:1px solid var(--split);font-size:11.5px;color:var(--t3);}
  .ve:disabled .ve-body{opacity:.6;}
  .modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--split);}

  /* 删除确认弹框（复用 modal 样式，小号） */
  .modal.small{width:min(440px,92vw);}
  .modal-body.plain{font-size:13px;color:var(--t2);line-height:20px;}
  .modal-body code{font-family:var(--mono);font-size:12px;color:var(--t1);}

  .toast{position:fixed;top:16px;left:50%;z-index:11000;padding:9px 16px;font-size:13px;color:var(--t1);
    background:#fff;border:1px solid var(--bd);border-radius:var(--r);opacity:0;pointer-events:none;
    transform:translate(-50%,-12px);box-shadow:0 8px 24px -8px rgba(0,0,0,.3);
    transition:opacity .18s,transform .18s;max-width:78vw;}
  .toast.show{opacity:1;transform:translate(-50%,0);}
  .toast.warn{color:#874d00;background:#fffbe6;border-color:var(--warn);}
`;

/* ───────────────────────── 控件 HTML 片段 ───────────────────────── */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rowHtml = (r) =>
  `<tr data-item="${esc(r.item)}" data-row='${esc(JSON.stringify(r))}'>` +
  `<td data-col="item" class="mono-cell">${esc(r.item)}</td>` +
  `<td data-col="description" class="desc-cell">${esc(r.description)}</td>` +
  `<td data-col="category">${esc(r.category)}</td>` +
  `<td data-col="value"><span class="value-cell" title="点击查看完整 Value">${esc(JSON.stringify(r.value))}</span></td>` +
  `<td data-col="updatedAt">${esc(r.updatedAt)}</td>` +
  `<td data-col="updatedBy">${esc(r.updatedBy)}</td>` +
  `<td class="sticky-right"><button type="button" class="link-btn row-edit">修改</button><button type="button" class="link-btn row-del">删除</button></td>` +
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
    var box = document.querySelector('.dlg-field[data-field="' + id + '"]');
    if (!box) return;
    box.classList.toggle('invalid', !!msg);
    var el = $(id);
    if (el) el.classList.toggle('invalid', !!msg);
    var slot = box.querySelector('.err');
    if (slot && msg) slot.textContent = msg;
  }

  var DATA = ${JSON.stringify(ROWS)}; /* 全量（本地模拟） */
  var view = { cat: '全部', condition: '' };

  /* ── 左列表：数据源 = distinct(category)，字典序；首行恒「全部」 ── */
  function distinctCats() {
    var set = {};
    DATA.forEach(function (r) { set[r.category] = 1; });
    return Object.keys(set).sort();
  }
  function renderCats() {
    var html = '<li class="all-item' + (view.cat === '全部' ? ' active' : '') + '" data-cat="全部">全部</li>';
    distinctCats().forEach(function (c) {
      html += '<li data-cat="' + c + '"' + (view.cat === c ? ' class="active"' : '') + '>' + c + '</li>';
    });
    $('catList').innerHTML = html;
    /* 弹框 Category combobox 候选同源（= distinct(category)） */
    $('catOptions').innerHTML = distinctCats().map(function (c) { return '<option value="' + c + '">'; }).join('');
  }
  function pickCat(cat) {
    var changed = view.cat !== cat;
    view.cat = cat;
    renderCats();
    if (changed) query(true);
  }
  $('catList').addEventListener('click', function (ev) {
    var li = ev.target.closest('li');
    if (li) pickCat(li.getAttribute('data-cat'));
  });

  /* ── 查询：category 等值 + condition 对 item/description/value(JSON 原文) 三栏前后模糊 ── */
  function filterRows() {
    var kw = view.condition.trim().toLowerCase();
    return DATA.filter(function (r) {
      if (view.cat !== '全部' && r.category !== view.cat) return false;
      if (!kw) return true;
      var hay = [r.item, r.description, JSON.stringify(r.value)].join('\\n').toLowerCase();
      return hay.indexOf(kw) >= 0;
    });
  }
  function query(auto) {
    var rows = filterRows();
    var html = rows.map(rowHtmlOut).join('\\n');
    $('miscTableBody').innerHTML = html || '';
    $('emptyState').hidden = rows.length > 0;
    $('pagerTotal').textContent = '共 ' + rows.length + ' 条';
    if (auto && view.cat !== '全部') toast('选中分类「' + view.cat + '」：自动查询第 1 页（带上 Condition 当前值，等值过滤 category）');
  }
  function rowHtmlOut(r) { return rowHtmlInner(r); }
  function rowHtmlInner(r) {
    return '<tr data-item="' + r.item + '" data-row=\\'' + JSON.stringify(r).replace(/'/g, '&#39;') + '\\'>'
      + '<td data-col="item" class="mono-cell">' + r.item + '</td>'
      + '<td data-col="description" class="desc-cell">' + r.description + '</td>'
      + '<td data-col="category">' + r.category + '</td>'
      + '<td data-col="value"><span class="value-cell" title="点击查看完整 Value">' + JSON.stringify(r.value) + '</span></td>'
      + '<td data-col="updatedAt">' + r.updatedAt + '</td>'
      + '<td data-col="updatedBy">' + r.updatedBy + '</td>'
      + '<td class="sticky-right"><button type="button" class="link-btn row-edit">修改</button><button type="button" class="link-btn row-del">删除</button></td>'
      + '</tr>';
  }

  $('conditionInput').addEventListener('input', function () { view.condition = this.value; });
  $('btnSearch').addEventListener('click', function () {
    view.condition = $('conditionInput').value;
    query(false);
    toast('Search：第 1 页 · category=' + (view.cat === '全部' ? '（不带，全部）' : view.cat) +
      ' · condition=「' + (view.condition || '') + '」（item / description / value 三栏 contains）');
  });

  /* ── Value 列点击 → 查看弹框（编辑器只读态） ── */
  $('miscTableBody').addEventListener('click', function (ev) {
    var cell = ev.target.closest('.value-cell');
    if (!cell) return;
    var tr = cell.closest('tr');
    openDialog('view', JSON.parse(tr.getAttribute('data-row')), tr);
  });

  /* ── 行内修改 / 删除 ── */
  var editTr = null, placeholderTr = null;
  $('miscTableBody').addEventListener('click', function (ev) {
    var editBtn = ev.target.closest('.row-edit');
    if (editBtn) {
      var tr = editBtn.closest('tr');
      openDialog('edit', JSON.parse(tr.getAttribute('data-row')), tr);
      return;
    }
    var delBtn = ev.target.closest('.row-del');
    if (delBtn) {
      delTarget = delBtn.closest('tr');
      var row = JSON.parse(delTarget.getAttribute('data-row'));
      $('delBody').innerHTML = '确认删除配置项 <code>' + row.item + '</code>？';
      $('delModal').classList.add('open');
      $('delMask').classList.add('open');
    }
  });
  var delTarget = null;
  $('btnDelCancel').addEventListener('click', closeDel);
  $('delMask').addEventListener('click', closeDel);
  function closeDel() {
    $('delModal').classList.remove('open');
    $('delMask').classList.remove('open');
  }
  $('btnDelOk').addEventListener('click', function () {
    var row = JSON.parse(delTarget.getAttribute('data-row'));
    DATA = DATA.filter(function (r) { return r.item !== row.item; });
    var gone = distinctCats().indexOf(view.cat) < 0 && view.cat !== '全部';
    closeDel();
    renderCats();
    if (gone) { view.cat = '全部'; renderCats(); query(false); toast('删除成功；分类「' + row.category + '」已清空，回落「全部」并重查'); }
    else { query(false); toast('删除成功（DELETE /log-viewer/api/v1/sys_misc，入参仅 item）；已重取 Category 列表'); }
  });

  /* ── 添加：表格第一行插空白行 + 打开新增弹框 ── */
  $('btnAdd').addEventListener('click', function () {
    placeholderTr = document.createElement('tr');
    placeholderTr.className = 'placeholder-row';
    placeholderTr.innerHTML = '<td colspan="7">新增中…（保存成功后本行填充为出参内容；取消 / 失败则移除）</td>';
    $('miscTableBody').insertBefore(placeholderTr, $('miscTableBody').firstChild);
    openDialog('add', null, placeholderTr);
  });

  /* ── 三模式弹框 ── */
  var mode = 'add'; /* view | edit | add */
  function setDisabled(dis) {
    ['dlgItem', 'dlgDesc', 'dlgCategory'].forEach(function (id) { $(id).disabled = dis; });
    $('ve').querySelectorAll('input,button').forEach(function (el) { el.disabled = dis; });
  }
  function openDialog(m, row, tr) {
    mode = m;
    editTr = m === 'view' ? null : tr;
    $('dlgTitle').textContent = m === 'view' ? '查看配置' : m === 'edit' ? '修改配置' : '新增配置';
    $('dlgHint').textContent = m === 'view' ? '只读（编辑器只读态）'
      : m === 'edit' ? 'Item 锁定（定位键）；Category / Description / Value 为新值'
      : 'Item 必填，仅大小写字母 + 数字，长度 ≤ 255；保存成功后填充表格第一行空白行';
    $('btnDlgConfirm').hidden = m === 'view';
    $('btnDlgCancel').hidden = m === 'view';
    $('btnDlgClose').hidden = m !== 'view';
    ['dlgItem', 'dlgDesc', 'dlgCategory'].forEach(function (id) { setErr(id, ''); });
    $('veErr').textContent = '';
    if (row) {
      $('dlgItem').value = row.item;
      $('dlgDesc').value = row.description;
      $('dlgCategory').value = row.category;
      parseToEditor(row.value);
    } else {
      $('dlgItem').value = '';
      $('dlgDesc').value = '';
      $('dlgCategory').value = '';
      resetEditor();
    }
    setDisabled(m === 'view');
    if (m === 'edit') { $('dlgItem').disabled = true; }
    $('miscModal').classList.add('open');
    $('miscMask').classList.add('open');
  }
  function closeDialog(removePlaceholder) {
    $('miscModal').classList.remove('open');
    $('miscMask').classList.remove('open');
    if (removePlaceholder && placeholderTr && placeholderTr.parentNode) {
      placeholderTr.parentNode.removeChild(placeholderTr);
    }
    placeholderTr = null;
  }
  $('btnDlgClose').addEventListener('click', function () { closeDialog(false); });
  $('miscMask').addEventListener('click', function () {
    closeDialog(mode === 'add');
  });

  /* ── Value 编辑器：Single / Multi 节点式 ── */
  function resetEditor() {
    $('modeMulti').checked = true;
    $('nodeList').innerHTML = '';
    syncMode();
  }
  function syncMode() {
    var single = $('modeSingle').checked;
    $('singleBox').hidden = !single;
    $('multiBox').hidden = single;
  }
  ['modeSingle', 'modeMulti'].forEach(function (id) {
    $(id).addEventListener('change', syncMode);
  });
  function syncSingleType() {
    var isBool = $('singleBool').checked;
    $('singleInputBox').hidden = isBool;
    $('singleBoolBox').hidden = !isBool;
  }
  ['singleText', 'singleBool'].forEach(function (id) {
    $(id).addEventListener('change', syncSingleType);
  });

  function scalarNode() {
    var div = document.createElement('div');
    div.className = 'node';
    div.setAttribute('data-kind', 'value');
    div.innerHTML =
      '<div class="node-head">'
      + '<label class="seg"><input type="radio" name="k' + nonce() + '" value="value" checked onchange="void 0">值</label>'
      + '<label class="seg"><input type="radio" name="k' + nonce() + '" value="map" onchange="void 0">Map</label>'
      + '<button type="button" class="del">删除节点</button></div>'
      + '<input type="text" class="ve-input node-value" placeholder="标量（文本 / 数字，禁布尔）">';
    return div;
  }
  function mapNode() {
    var div = document.createElement('div');
    div.className = 'node';
    div.setAttribute('data-kind', 'map');
    div.innerHTML =
      '<div class="node-head">'
      + '<label class="seg"><input type="radio" value="value">值</label>'
      + '<label class="seg"><input type="radio" value="map" checked>Map</label>'
      + '<span>键 = 自由键；值数组禁布尔、深度封顶两层</span>'
      + '<button type="button" class="del">删除节点</button></div>'
      + '<input type="text" class="ve-input node-key" placeholder="键（自由键）">'
      + '<div class="map-vals"></div>'
      + '<button type="button" class="add-mini">+ 添加值</button>';
    return div;
  }
  var nonceSeed = 0;
  function nonce() { return 'n' + (++nonceSeed); }
  /* 节点内 值/Map 切换（事件委托） */
  $('nodeList').addEventListener('change', function (ev) {
    var node = ev.target.closest('.node');
    if (!node || ev.target.name === 'singleType') return;
    if (ev.target.type === 'radio' && (ev.target.value === 'value' || ev.target.value === 'map')) {
      var kind = ev.target.value;
      var fresh = kind === 'value' ? scalarNode() : mapNode();
      node.parentNode.replaceChild(fresh, node);
    }
  });
  $('nodeList').addEventListener('click', function (ev) {
    var node = ev.target.closest('.node');
    if (!node) return;
    if (ev.target.className === 'del') { node.parentNode.removeChild(node); return; }
    if (ev.target.className === 'add-mini') {
      var box = node.querySelector('.map-vals');
      var row = document.createElement('div');
      row.className = 'map-val';
      row.innerHTML = '<input type="text" class="ve-input" placeholder="标量（文本 / 数字，禁布尔）">'
        + '<button type="button" class="del">×</button>';
      box.appendChild(row);
    }
    if (ev.target.classList.contains('del') && ev.target.closest('.map-val')) {
      ev.target.closest('.map-val').remove();
    }
  });
  $('btnAddNode').addEventListener('click', function () {
    $('nodeList').appendChild(scalarNode());
  });

  /* 数字自适应：合法数字存数字，否则文本 */
  function autoScalar(text) {
    return /^-?\\d+(\\.\\d+)?([eE][+-]?\\d+)?$/.test(text) ? Number(text) : text;
  }

  /* 序列化：编辑器 → JSON List */
  function serializeEditor() {
    if ($('modeSingle').checked) {
      if ($('singleBool').checked) return [($('boolTrue').checked)];
      return [autoScalar($('singleInput').value)];
    }
    var out = [];
    var nodes = $('nodeList').querySelectorAll(':scope > .node');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-kind') === 'value') {
        out.push(autoScalar(nodes[i].querySelector('.node-value').value));
      } else {
        var key = nodes[i].querySelector('.node-key').value;
        var vals = [];
        var inputs = nodes[i].querySelectorAll('.map-val .ve-input');
        for (var j = 0; j < inputs.length; j++) vals.push(autoScalar(inputs[j].value));
        var obj = {};
        obj[key] = vals;
        out.push(obj);
      }
    }
    return out;
  }
  /* 反解析：JSON List → 编辑器（长度 1 标量 ⇒ Single；其余 ⇒ Multi） */
  function parseToEditor(value) {
    var single = value.length === 1 && typeof value[0] !== 'object';
    $('modeSingle').checked = single;
    $('modeMulti').checked = !single;
    syncMode();
    if (single) {
      var v = value[0];
      if (typeof v === 'boolean') {
        $('singleBool').checked = true;
        $('boolTrue').checked = v === true;
        $('boolFalse').checked = v === false;
      } else {
        $('singleText').checked = true;
        $('singleInput').value = String(v);
      }
      syncSingleType();
      return;
    }
    $('nodeList').innerHTML = '';
    value.forEach(function (el) {
      if (typeof el === 'object') {
        var node = mapNode();
        node.querySelector('.node-key').value = Object.keys(el)[0];
        var box = node.querySelector('.map-vals');
        el[Object.keys(el)[0]].forEach(function (x) {
          var row = document.createElement('div');
          row.className = 'map-val';
          row.innerHTML = '<input type="text" class="ve-input">'
            + '<button type="button" class="del">×</button>';
          row.querySelector('input').value = String(x);
          box.appendChild(row);
        });
        $('nodeList').appendChild(node);
      } else {
        var node2 = scalarNode();
        node2.querySelector('.node-value').value = String(el);
        $('nodeList').appendChild(node2);
      }
    });
  }
  /* 打开即建一个默认值节点，避免空列表 */
  var booted = false;

  /* ── 弹框校验 + Confirm ── */
  function validate() {
    var ok = true;
    var item = $('dlgItem').value.trim();
    if (!item) { setErr('dlgItem', '必填'); ok = false; }
    else if (!/^[0-9A-Za-z]{1,255}$/.test(item)) { setErr('dlgItem', '仅大小写字母 + 数字，长度 ≤ 255'); ok = false; }
    else setErr('dlgItem', '');
    if (!$('dlgDesc').value.trim()) { setErr('dlgDesc', '必填；多行文本域，长度 ≤ 4000'); ok = false; }
    else if ($('dlgDesc').value.length > 4000) { setErr('dlgDesc', '长度 ≤ 4000'); ok = false; }
    else setErr('dlgDesc', '');
    var cat = $('dlgCategory').value.trim();
    if (!cat) { setErr('dlgCategory', '必填'); ok = false; }
    else if (!/^[0-9A-Za-z]{1,20}$/.test(cat)) { setErr('dlgCategory', '仅大小写字母 + 数字，长度 ≤ 20'); ok = false; }
    else setErr('dlgCategory', '');
    $('veErr').textContent = '';
    if ($('modeSingle').checked) {
      if ($('singleText').checked && !$('singleInput').value.trim()) {
        $('veErr').textContent = 'Value：Single 输入框不能为空'; ok = false;
      }
    } else {
      var nodes = $('nodeList').querySelectorAll(':scope > .node');
      if (!nodes.length) { $('veErr').textContent = 'Value：Multi 至少 1 个节点'; ok = false; }
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].getAttribute('data-kind') === 'value' && !nodes[i].querySelector('.node-value').value.trim()) {
          $('veErr').textContent = 'Value：值节点不能为空'; ok = false; break;
        }
        if (nodes[i].getAttribute('data-kind') === 'map') {
          var key = nodes[i].querySelector('.node-key').value.trim();
          var vals = nodes[i].querySelectorAll('.map-val .ve-input');
          if (!key) { $('veErr').textContent = 'Value：Map 节点键不能为空'; ok = false; break; }
          if (!vals.length) { $('veErr').textContent = 'Value：Map 值数组至少 1 项'; ok = false; break; }
        }
      }
    }
    return ok;
  }
  $('btnDlgConfirm').addEventListener('click', function () {
    if (!validate()) { toast('弹框不合法，已拦住保存', 'warn'); return; }
    var value = serializeEditor();
    var obj = {
      item: $('dlgItem').value.trim(),
      description: $('dlgDesc').value,
      category: $('dlgCategory').value.trim(),
      value: value,
      updatedAt: '2026-10-13 12:00:00',
      updatedBy: 'xuejm'
    };
    var isEdit = mode === 'edit';
    if (isEdit) {
      var old = JSON.parse(editTr.getAttribute('data-row'));
      DATA = DATA.map(function (r) { return r.item === old.item ? obj : r; });
    } else {
      if (DATA.some(function (r) { return r.item === obj.item; })) {
        toast('新增被拒：item「' + obj.item + '」已存在（唯一索引）', 'warn');
        return;
      }
      DATA.unshift(obj);
    }
    closeDialog(false);
    renderCats();
    query(false);
    toast((isEdit ? 'PUT' : 'POST') + ' /log-viewer/api/v1/sys_misc · value=' + JSON.stringify(value).slice(0, 80)
      + (JSON.stringify(value).length > 80 ? '…' : '')
      + '（已重取 Category 列表；' + (isEdit ? '行内容已覆盖' : '空白行已填充') + '）');
  });
  $('btnDlgCancel').addEventListener('click', function () { closeDialog(mode === 'add'); });

  /* ── 进页面：默认选「全部」并查询第 1 页；左列表首建 ── */
  renderCats();
  query(false);
  resetEditor();
  toast('进页面：已取 Category 列表（distinct 字典序），默认选中「全部」并自动查询全部的第 1 页');
})();
`;

/* ───────────────────────── 页面内容 ───────────────────────── */
const CONTENT = `
<div class="page-head">
  <div class="crumb">系统管理 · 模块 5 · 功能 2</div>
  <h1>System Misc · 全局配置</h1>
  <p class="sub">维护全局使用的变量，一处配置、各处消费；候选值接口（env/list 等）的数据源；左侧 Category 窄列表精确过滤，右侧查询 / 列表 / 操作</p>
</div>

<div class="layout">
  <nav class="cat-card" aria-label="Category 过滤">
    <div class="cat-head">Category</div>
    <ul class="cat-list" id="catList"></ul>
  </nav>

  <div>
    <section class="card">
      <div class="card-head">
        <h2>查询条件</h2>
        <span class="hint">Condition 对 item / description / value 三栏前后模糊</span>
      </div>
      <div class="filters">
        <div class="field">
          <label for="conditionInput">Condition <span class="tip">（item / description / value 三栏 contains，任一命中即返回）</span></label>
          <input class="input" id="conditionInput" type="text" placeholder="如 PROD、lock、10.18">
        </div>
        <button class="btn primary" id="btnSearch" type="button">Search</button>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>配置列表</h2>
        <span class="hint">每页 20 · 行键 = item</span>
      </div>
      <div class="table-wrap">
        <table class="grid" id="miscTable">
          <thead><tr>
${COLUMNS.filter(c => c.key !== 'action').map(c => `            <th data-col="${c.key}">${c.label}</th>`).join('\n')}
            <th class="sticky-right">Action</th>
          </tr></thead>
          <tbody id="miscTableBody">
${ROWS.map(rowHtml).join('\n')}
          </tbody>
        </table>
        <div class="empty" id="emptyState" hidden style="padding:48px 16px;text-align:center;font-size:13px;color:var(--t3);">暂无数据</div>
      </div>
      <div class="pager" id="pager">
        <span id="pagerTotal">共 0 条</span>
        <span class="spacer"></span>
        <button class="pg-btn" disabled>‹</button>
        <button class="pg-btn active">1</button>
        <button class="pg-btn">›</button>
      </div>
      <div class="actions">
        <button class="icon-btn" id="btnAdd" type="button" title="添加" aria-label="添加">＋</button>
        <span style="font-size:12px;color:var(--t3);">添加（表格左下方图标）</span>
      </div>
    </section>
  </div>
</div>

<div class="mask" id="miscMask"></div>
<div class="modal" id="miscModal" role="dialog" aria-hidden="true">
  <div class="modal-head">
    <h3 id="dlgTitle">配置</h3>
    <span class="hint" id="dlgHint"></span>
  </div>
  <div class="modal-body">
    <div class="dlg-row">
      <div class="dlg-field" data-field="dlgItem">
        <label for="dlgItem">Item <span class="req">*</span> <span style="font-size:11.5px;color:var(--t3);">（唯一索引，接口定位键）</span></label>
        <input class="input" id="dlgItem" type="text" placeholder="env_list">
        <span class="err"></span>
      </div>
      <div class="dlg-field" data-field="dlgCategory">
        <label for="dlgCategory">Category <span class="req">*</span> <span style="font-size:11.5px;color:var(--t3);">（combobox：下拉 + 输入双模式，仅字母数字 ≤ 20）</span></label>
        <input class="input" id="dlgCategory" type="text" list="catOptions" placeholder="global">
        <datalist id="catOptions"></datalist>
        <span class="err"></span>
      </div>
    </div>
    <div class="dlg-field" data-field="dlgDesc">
      <label for="dlgDesc">Description <span class="req">*</span> <span style="font-size:11.5px;color:var(--t3);">（多行文本域，不限字符格式，长度 ≤ 4000）</span></label>
      <textarea class="input" id="dlgDesc" rows="2" placeholder="配置项描述"></textarea>
      <span class="err"></span>
    </div>
    <div class="dlg-field" data-field="ve">
      <label>Value <span class="req">*</span> <span style="font-size:11.5px;color:var(--t3);">（顶层恒为 JSON List · List ≤ 100 · 布尔只许 Single）</span></label>
      <div class="ve" id="ve">
        <div class="ve-bar">
          <label class="seg"><input type="radio" name="veMode" id="modeSingle" value="single">Single Value</label>
          <label class="seg"><input type="radio" name="veMode" id="modeMulti" value="multi" checked>Multi Value</label>
        </div>
        <div class="ve-body">
          <div id="singleBox" hidden>
            <div class="ve-single-type">
              <label><input type="radio" name="singleType" id="singleText" checked>输入框（合法数字存数字，否则文本）</label>
              <label><input type="radio" name="singleType" id="singleBool">布尔选择器</label>
            </div>
            <div id="singleInputBox"><input type="text" class="ve-input" id="singleInput" placeholder="单值（x ∈ 数字 / 文本 / 布尔 —— 全系统唯一允许布尔的形态）"></div>
            <div id="singleBoolBox" class="bool-pick" hidden>
              <label><input type="radio" name="boolVal" id="boolTrue">true</label>
              <label><input type="radio" name="boolVal" id="boolFalse" checked>false</label>
            </div>
          </div>
          <div id="multiBox">
            <div id="nodeList"></div>
            <button type="button" class="add-mini" id="btnAddNode">+ 添加节点（先选：值 | Map）</button>
          </div>
        </div>
        <div class="ve-foot">Multi 节点可混排（值 | Map）；Map = 键 + 值数组（禁布尔），深度封顶两层</div>
      </div>
      <span class="err" id="veErr" style="font-size:11px;color:var(--err);"></span>
    </div>
  </div>
  <div class="modal-foot">
    <button class="btn" id="btnDlgClose" type="button" hidden>关闭</button>
    <button class="btn" id="btnDlgCancel" type="button">Cancel</button>
    <button class="btn primary" id="btnDlgConfirm" type="button">Confirm</button>
  </div>
</div>

<div class="mask" id="delMask"></div>
<div class="modal small" id="delModal" role="dialog" aria-hidden="true">
  <div class="modal-head"><h3>删除配置</h3></div>
  <div class="modal-body plain" id="delBody"></div>
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
const spec = {
  schema: SKILL,
  title: 'System Misc · 全局配置',
  summary: '左右布局配置页：左 = Category 窄列表（distinct 字典序、首行恒「全部」、进页面默认选全部并自动查第 1 页、选中即查、' +
    '增删改后重取、选中项消失回落全部、不做计数）；右 = 查询条件（Condition 对 item / description / value 三栏前后模糊）+ 配置列表' +
    '（七列，Value 点击看详情）+ 行级操作（修改 / 删除确认）+ 添加图标（空白行占位）+ 三模式弹框（查看只读 / 修改锁 Item / 新增，' +
    'Value 编辑器 Single / Multi 节点式）。接口口径依 02 文档 §五。',
  regions: [
    { id: 'catlist', label: 'Category 窄列表（左侧）', role: 'nav', desc: '精确过滤入口；数据源 = distinct(category) 字典序；与右侧条件是同一查询的两个输入面' },
    { id: 'search', label: '查询条件区（右侧）', role: 'search', desc: '仅一个 Condition 输入框 + Search' },
    { id: 'table', label: '配置列表区（右侧）', role: 'table', desc: '七列 + 分页（每页 20 不分档）+ 添加图标（表格左下方）' },
    { id: 'dialog', label: '三模式弹框', role: 'form', desc: '查看 / 修改 / 新增同一组件；Value 结构化编辑（Single / Multi）' },
  ],
  apis: [
    { id: 'sysMiscPage', method: 'GET', path: '/log-viewer/api/v1/sys_misc/page', desc: '分页查询（含 Category 过滤 + Condition 三栏模糊）' },
    { id: 'sysMiscCategoryList', method: 'GET', path: '/log-viewer/api/v1/sys_misc/category/list', desc: 'Category 窄列表候选（distinct(category) 字典序，不分页）' },
    { id: 'sysMiscCreate', method: 'POST', path: '/log-viewer/api/v1/sys_misc', desc: '新增（item 冲突即拒）' },
    { id: 'sysMiscUpdate', method: 'PUT', path: '/log-viewer/api/v1/sys_misc', desc: '修改（item 作定位键）' },
    { id: 'sysMiscDelete', method: 'DELETE', path: '/log-viewer/api/v1/sys_misc', desc: '删除（入参仅 item）' },
  ],
  controls: [
    {
      selector: '#catList', kind: 'other', label: 'Category 窄列表', region: 'Category 窄列表（左侧）',
      rules: [
        '数据源：进页面调 category/list（= 本表 distinct(category)），按字典序展示；空表 ⇒ 只剩「全部」',
        '首行恒显示「全部」，进页面默认选中「全部」⇒ 自动查询全部的第 1 页（无未查询空态）',
        '选中某分类：自动调 page 查第 1 页（带上 Condition 当前值 + 本分类，等值匹配）；选中「全部」不带 category 入参',
        '与 Search 是同一查询的两个输入面：Search 同样结合左列表当前选中项，两侧谁最后变谁触发',
        '增删改成功后重取本列表；当前选中项消失（该分类最后一行被删等）⇒ 回落「全部」并重查',
        '不做条数计数（快节奏轻查询，只出分类名）',
      ],
      apis: ['sysMiscCategoryList', 'sysMiscPage'],
      apiNotes: [
        'category/list 出参：`data = { "category": [ … ] }`，不分页',
        'page 的 category 入参：等值、可空 = 不按分类过滤（左列表选「全部」时不带）',
      ],
    },
    {
      selector: '#conditionInput', kind: 'input', label: 'Condition 输入框', region: '查询条件区（右侧）',
      param: 'condition', placeholder: '如 PROD、lock、10.18',
      rules: [
        '对 item / description / value 三个栏位前后模糊匹配（contains），任一栏位命中即返回',
        'value 按 JSON 字符串原文匹配；不填 = 不过滤',
      ],
      apiNotes: ['入参：URL 参数 `condition`（可空 = 不过滤）'],
    },
    {
      selector: '#btnSearch', kind: 'button', label: 'Search', region: '查询条件区（右侧）',
      rules: ['查第 1 页，结合左列表当前选中项（选「全部」不带 category）'],
      apis: ['sysMiscPage'],
      apiNotes: ['入参：pageIndex=1、pageSize=20、condition、category'],
    },
    {
      selector: '#miscTable', kind: 'table', label: '配置列表', region: '配置列表区（右侧）',
      rules: [
        '列（按序）：Item、Description、Category、Value、Last Updated Time、Last Updated User + Action（最右固定）',
        'Description 超长省略号截断；Value 按 JSON 字符串显示、超长省略号截断、可点击打开查看弹框',
        '行键 = item（id 不出参）；分页每页 20（不分档），总条数取出参 total',
        '新增保存成功 ⇒ 表格第一行空白行填充出参内容；取消 / 失败 ⇒ 移除空白行；修改保存 ⇒ 直接覆盖该行；删除 ⇒ 直接删该行',
      ],
      apis: ['sysMiscPage'],
      apiNotes: ['行数据 = page 出参 contents[]（item / description / category / value / updatedAt / updatedBy）'],
    },
    {
      selector: '.value-cell', kind: 'link', label: 'Value 列（点击查看）', region: '配置列表区（右侧）',
      on: { click: ['打开详情弹框展示完整 Value（只读，即三模式弹框的查看模式）'] },
      apiNotes: ['不调接口（数据已在行内，前端展示）'],
    },
    {
      selector: '.row-edit', kind: 'button', label: 'Action · 修改', region: '配置列表区（右侧）',
      on: { click: ['打开修改弹框（Item 锁定，其余可改）'] },
      apiNotes: ['不调接口（提交在弹框 Confirm）'],
    },
    {
      selector: '.row-del', kind: 'button', label: 'Action · 删除', region: '配置列表区（右侧）',
      rules: ['弹框确认后才调删除接口；成功后直接删除该行', '删除成功后重取 Category 列表（选中项消失 ⇒ 回落「全部」并重查）'],
      apis: ['sysMiscDelete'],
      apiNotes: ['入参仅 item；出参只报成败'],
    },
    {
      selector: '#btnAdd', kind: 'button', label: '添加图标（表格左下方）', region: '配置列表区（右侧）',
      on: { click: ['表格第一行先插入空白行（占位），新增弹框同时打开'] },
      apiNotes: ['不调接口（纯前端行为）'],
    },
    {
      selector: '#pager', kind: 'pager', label: '分页组件', region: '配置列表区（右侧）',
      rules: ['每页 20 条（不分档）；翻页按页码再调 page'],
      apis: ['sysMiscPage'],
      apiNotes: ['翻页传目标 pageIndex'],
    },
    {
      selector: '#miscModal', kind: 'modal', label: '三模式弹框（查看 / 修改 / 新增）', region: '三模式弹框',
      rules: [
        '查看：全字段只读（Value 呈编辑器只读态），底部只有「关闭」',
        '修改：Item 锁定（定位键）；Description / Category / Value 可改；Confirm 走 PUT，成功后出参直接覆盖该行',
        '新增：Item 必填（仅大小写字母 + 数字 ≤ 255）；Confirm 走 POST，item 冲突（唯一索引）拒；成功后空白行填充出参',
        'Cancel：清空全部控件值、关闭弹框（新增模式同时移除空白行）',
        'Category：combobox（下拉 + 输入双模式），候选 = 本表 distinct（与 category/list 同源），仅字母数字 ≤ 20',
        'Description：多行文本域，不限字符格式，长度 ≤ 4000',
      ],
      apis: ['sysMiscCreate', 'sysMiscUpdate'],
      apiNotes: ['POST / PUT 入参四字段（item / category / description / value）；value 接口传入即入库格式，后端零转换'],
    },
    {
      selector: '#ve', kind: 'other', label: 'Value 编辑器（Single / Multi）', region: '三模式弹框',
      rules: [
        '顶层恒为 JSON List；外层单选框定编辑模型',
        'Single Value：输入框 / 布尔选择器二选一 —— 输入框自由输入（合法数字存数字，否则文本）；布尔 = true / false（全系统唯一允许布尔的形态）',
        'Multi Value：节点式列表按节点增加，每个新节点先选「值 | Map」—— 值节点 = 标量输入（文本 / 数字，禁布尔）；Map 节点 = 键 + 值数组（复用值控件增删）；两类节点可混排',
        '深度封顶两层（Map 的值不能再嵌 Map，也不能是 Single 形态）；List ≤ 100（顶层与 Map 值数组同限）',
        '打开时形态识别：长度 1 且元素为标量 ⇒ 按 Single 呈现（等价表示，可切 Multi 继续加节点）；其余 ⇒ Multi',
        '模式切换：Single → Multi 把当前单值转成一个值节点；Multi → Single 清空重选',
        '必填（推定）：Single 输入框非空；Multi 至少 1 个节点且节点完整（值节点非空；Map 节点键与值数组非空）',
      ],
      notes: ['页面呈编辑器样式；视觉细节归 05 / 原型'],
      apiNotes: ['不调接口：value 入参 = 编辑器序列化的 JSON List；后端按同一套类型规则复验（直调绕过编辑器时）'],
    },
    {
      selector: '#btnDlgConfirm', kind: 'button', label: 'Confirm（弹框）', region: '三模式弹框',
      rules: ['提交前校验（Item / Description / Category / Value 全量），不合法拦住', '新增 item 冲突（唯一索引）⇒ 拒（错误码，不覆盖）'],
      apis: ['sysMiscCreate', 'sysMiscUpdate'],
      apiNotes: ['保存成功后页面重取 Category 列表'],
    },
    {
      selector: '#btnDlgCancel', kind: 'button', label: 'Cancel（弹框）', region: '三模式弹框',
      rules: ['关闭弹框；新增模式同时移除表格第一行空白行'],
      apiNotes: ['不调接口（纯前端行为）'],
    },
    {
      selector: '#delModal', kind: 'modal', label: '删除确认弹框', region: '配置列表区（右侧）',
      rules: ['展示待删 item；确认后才调删除接口'],
      apis: ['sysMiscDelete'],
      apiNotes: ['入参仅 item'],
    },
  ],
  table: {
    selector: '#miscTable',
    dataApi: 'sysMiscPage',
    columns: COLUMNS,
    pagination: { api: 'sysMiscPage', pageParam: 'pageIndex', pageSize: 20, pageSizeFixed: true, serverSide: true, totalField: 'total' },
    rowSelection: { mode: 'none' },
  },
  mock: [
    '所有接口路径、方法、入参与出参依 02 文档 §五；原型不真实发请求，数据全为本地模拟（8 行，value 覆盖 Single 数字 / 布尔、Multi 全值节点、Map 节点、Map 混排）',
    '左列表、三栏模糊过滤、编辑器序列化 / 反解析（拆装 % 同理的 JSON 回填）、增删改后的行级行为与 Category 列表刷新均为真实前端行为',
    '进页面默认选「全部」并查询第 1 页（本地数据即全部）',
    'Confirm / 删除的接口调用以轻提示展示（含序列化出的 value JSON），不产生真实请求',
    '分页页码为静态演示',
  ],
  openQuestions: [],
};

const html = buildPrototype({ title: spec.title, styles: STYLES, content: CONTENT, spec });
writePrototype(OUT, html);

console.log('生成完成：' + OUT);
console.log('控件 ' + spec.controls.length + ' 个 · 接口 ' + spec.apis.length + ' 个 · 静态列 ' + COLUMNS.length + ' 列');
