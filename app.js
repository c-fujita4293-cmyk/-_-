(() => {
  "use strict";
  const STORAGE_KEY = "fitlog_records_v1";
  const MONTHLY_FEE = 3278;
  const VISIT_FEE = 1650;
  const MONTHLY_TARGET = 8;
  const BODIES = ["脚・お尻", "背中", "胸", "肩・腕", "有酸素", "ストレッチ"];
  const BODY_COLORS = ["#B8F36B", "#70B7FF", "#E8B86D", "#9B94D8", "#74B6A7", "#8290A3"];
  const $ = (id) => document.getElementById(id);
  let records = loadRecords();
  let activeScreen = "home";
  let homeMonth = firstOfMonth(new Date());
  let historyMonth = firstOfMonth(new Date());
  let selectedDate = toISODate(new Date());
  let selectedTime = "夕方", selectedCondition = "良好", selectedMood = "最高";
  let selectedBodies = [];
  let toastTimer = null;

  function loadRecords() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      showToast("保存できませんでした。ブラウザーの保存設定を確認してください。");
      return false;
    }
  }
  function toISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function parseISO(value) {
    const [y,m,d] = value.split("-").map(Number);
    return new Date(y,m-1,d,12);
  }
  function firstOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1, 12); }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
  function monthLabel(date) { return `${date.getFullYear()}年${date.getMonth()+1}月`; }
  function formatDate(value, weekday = true) {
    const d = parseISO(value);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日${weekday ? `（${["日","月","火","水","木","金","土"][d.getDay()]}）` : ""}`;
  }
  function yen(value, signed = false) {
    const n = Math.round(value);
    if (signed && n > 0) return `+¥${n.toLocaleString("ja-JP")}`;
    if (n < 0) return `−¥${Math.abs(n).toLocaleString("ja-JP")}`;
    return `¥${n.toLocaleString("ja-JP")}`;
  }
  function monthRecords(date) { const key = monthKey(date); return records.filter(r => r.date.startsWith(key)); }
  function uniqueVisitCount(list) { return new Set(list.map(r => r.date)).size; }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  }
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function navigate(screen) {
    activeScreen = screen;
    document.querySelectorAll(".screen").forEach(el => el.classList.toggle("active", el.id === `${screen}Screen`));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.screen === screen));
    if (screen === "home") renderHome();
    if (screen === "history") renderHistory();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function setMonth(date, delta) { return new Date(date.getFullYear(), date.getMonth()+delta, 1, 12); }
  function renderHome() {
    const list = monthRecords(homeMonth);
    const visits = uniqueVisitCount(list);
    const targetPct = Math.min(100, Math.round(visits / MONTHLY_TARGET * 100));
    const breakPct = Math.min(100, Math.round(visits * VISIT_FEE / MONTHLY_FEE * 100));
    const diff = visits * VISIT_FEE - MONTHLY_FEE;
    $("homeMonthLabel").textContent = monthLabel(homeMonth);
    $("visitCount").textContent = visits;
    $("targetPercent").textContent = `${targetPct}%`;
    $("targetRing").style.setProperty("--progress", `${targetPct}%`);
    $("targetBar").style.width = `${targetPct}%`;
    $("targetMessage").textContent = visits >= MONTHLY_TARGET ? "今月の目標を達成しました！" : `目標まであと${MONTHLY_TARGET-visits}回。無理のないペースで続けましょう。`;
    $("breakBar").style.width = `${breakPct}%`;
    $("breakCount").textContent = `${Math.min(visits,2)} / 2回`;
    $("breakPercent").textContent = `${breakPct}%`;
    $("breakStatus").textContent = visits >= 2 ? "損益分岐点到達" : `あと${2-visits}回`;
    const diffEl = $("monthlyDiff");
    diffEl.textContent = yen(diff, true);
    diffEl.className = `metric-value ${diff >= 0 ? "positive" : "negative"}`;
    $("unitCost").textContent = visits ? `約¥${Math.round(MONTHLY_FEE/visits).toLocaleString("ja-JP")}` : "—";
    renderMonthlyChart();
    renderAnnual();
    renderRecent();
  }
  function renderMonthlyChart() {
    const el = $("monthlyChart"); el.innerHTML = "";
    const months = [];
    for (let i=5;i>=0;i--) months.push(setMonth(homeMonth,-i));
    const counts = months.map(d => uniqueVisitCount(monthRecords(d)));
    const max = Math.max(1, ...counts);
    months.forEach((d,i) => {
      const count = counts[i], unit = count ? Math.round(MONTHLY_FEE/count) : null;
      const item = document.createElement("div"); item.className = "month-bar-item";
      item.innerHTML = `<span class="bar-value">${count}回</span><div class="bar-track"><div class="bar" style="height:${count/max*100}%"></div></div><span class="bar-month">${d.getMonth()+1}月</span><span class="bar-cost">${unit===null?"—":`¥${unit.toLocaleString("ja-JP")}`}</span>`;
      item.title = `${monthLabel(d)}：${count}回、1回あたり${unit===null?"利用なし":yen(unit)}`;
      el.appendChild(item);
    });
  }
  function renderAnnual() {
    const year = homeMonth.getFullYear();
    const list = records.filter(r => r.date.startsWith(`${year}-`));
    const visits = uniqueVisitCount(list);
    const diff = visits * VISIT_FEE - MONTHLY_FEE * 12;
    $("annualVisits").textContent = `${visits}回`;
    $("annualUnit").textContent = visits ? `約¥${Math.round(MONTHLY_FEE*12/visits).toLocaleString("ja-JP")}` : "—";
    const diffEl = $("annualDiff"); diffEl.textContent = yen(diff,true); diffEl.className = diff >= 0 ? "positive" : "negative";
  }
  function workoutSummary(r) {
    const names = (r.exercises || []).map(x => x.name).filter(Boolean);
    return names.length ? names.join("、") : "種目名なし";
  }
  function renderRecent() {
    const el = $("recentList");
    const list = [...records].sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt||0)-(a.createdAt||0)).slice(0,3);
    if (!list.length) { el.innerHTML = `<div class="empty-state">まだ記録がありません。<br>最初のトレーニングを記録しましょう。</div>`; return; }
    el.innerHTML = list.map(r => `<article class="recent-item"><div class="record-item-top"><span>${escapeHTML(formatDate(r.date))} · ${escapeHTML(r.time||"時間帯なし")}</span><span>${(r.exercises||[]).length}種目</span></div><div class="record-item-title">${escapeHTML(workoutSummary(r))}</div><div class="record-item-meta">${escapeHTML((r.bodies||[]).join("・")||"部位未選択")}　·　体調 ${escapeHTML(r.condition||"—")}　·　気分 ${escapeHTML(r.mood||"—")}</div><div class="history-actions"><button class="text-button" data-edit="${escapeHTML(r.id)}" type="button">編集</button><button class="text-button delete-button" data-delete="${escapeHTML(r.id)}" type="button">削除</button></div></article>`).join("");
  }
  function startNewRecord(date = toISODate(new Date())) {
    $("workoutForm").reset();
    $("recordId").value = "";
    $("workoutDate").value = date;
    $("workoutMemo").value = "";
    selectedTime = "夕方"; selectedCondition = "良好"; selectedMood = "最高"; selectedBodies = [];
    document.querySelectorAll("[data-time]").forEach(b=>b.classList.toggle("selected",b.dataset.time===selectedTime));
    document.querySelectorAll("[data-body]").forEach(b=>b.classList.remove("selected"));
    document.querySelectorAll("[data-condition]").forEach(b=>b.classList.toggle("selected",b.dataset.condition===selectedCondition));
    document.querySelectorAll("[data-mood]").forEach(b=>b.classList.toggle("selected",b.dataset.mood===selectedMood));
    $("exerciseList").innerHTML = "";
    addExerciseRow({name:"",weight:"",reps:"",sets:""});
    $("cancelEditBtn").classList.add("hidden");
    navigate("record");
  }
  function addExerciseRow(values = {}) {
    const row = document.createElement("div"); row.className = "exercise-card";
    row.innerHTML = `<div class="exercise-top"><input class="input exercise-name" type="text" maxlength="80" placeholder="種目名（例：スクワット）" aria-label="種目名" value="${escapeHTML(values.name||"")}"><button type="button" class="remove-exercise" aria-label="この種目を削除" title="削除">×</button></div><div class="exercise-fields"><label>重量（kg・任意）<input class="exercise-weight" type="number" min="0" max="9999" step="0.1" placeholder="—" value="${escapeHTML(values.weight ?? "")}"></label><label>回数<input class="exercise-reps" type="number" min="0" max="9999" step="1" placeholder="10" value="${escapeHTML(values.reps ?? "")}"></label><label>セット数<input class="exercise-sets" type="number" min="0" max="999" step="1" placeholder="3" value="${escapeHTML(values.sets ?? "")}"></label></div>`;
    row.querySelector(".remove-exercise").addEventListener("click", () => {
      if ($("exerciseList").children.length <= 1) { showToast("種目は最低1つ必要です。"); return; }
      row.remove();
    });
    $("exerciseList").appendChild(row);
  }
  function getExercises() {
    return [...$("exerciseList").querySelectorAll(".exercise-card")].map(row => ({
      name: row.querySelector(".exercise-name").value.trim(),
      weight: row.querySelector(".exercise-weight").value === "" ? null : Number(row.querySelector(".exercise-weight").value),
      reps: row.querySelector(".exercise-reps").value === "" ? null : Number(row.querySelector(".exercise-reps").value),
      sets: row.querySelector(".exercise-sets").value === "" ? null : Number(row.querySelector(".exercise-sets").value)
    })).filter(x => x.name || x.weight !== null || x.reps !== null || x.sets !== null);
  }
  function saveWorkout(event) {
    event.preventDefault();
    const date = $("workoutDate").value;
    if (!date) { showToast("日付を入力してください。"); return; }
    const exercises = getExercises();
    if (!exercises.length || !exercises.some(x => x.name)) { showToast("種目名を1つ以上入力してください。"); return; }
    const oldId = $("recordId").value;
    const record = {
      id: oldId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      date, time: selectedTime, bodies: [...selectedBodies], exercises,
      condition: selectedCondition, mood: selectedMood, memo: $("workoutMemo").value.trim(),
      createdAt: oldId ? (records.find(r=>r.id===oldId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now()
    };
    const before = records;
    records = oldId ? records.map(r=>r.id===oldId ? record : r) : [...records, record];
    if (!persist()) { records = before; return; }
    homeMonth = firstOfMonth(parseISO(date)); historyMonth = firstOfMonth(parseISO(date)); selectedDate = date;
    showToast(oldId ? "記録を更新しました。" : "記録を保存しました。");
    navigate("history");
  }
  function editRecord(id) {
    const r = records.find(x=>x.id===id); if (!r) return;
    $("recordId").value = r.id; $("workoutDate").value = r.date;
    selectedTime = r.time || "夕方"; selectedCondition = r.condition || "普通"; selectedMood = r.mood || "普通"; selectedBodies = [...(r.bodies||[])];
    $("workoutMemo").value = r.memo || "";
    document.querySelectorAll("[data-time]").forEach(b=>b.classList.toggle("selected",b.dataset.time===selectedTime));
    document.querySelectorAll("[data-body]").forEach(b=>b.classList.toggle("selected",selectedBodies.includes(b.dataset.body)));
    document.querySelectorAll("[data-condition]").forEach(b=>b.classList.toggle("selected",b.dataset.condition===selectedCondition));
    document.querySelectorAll("[data-mood]").forEach(b=>b.classList.toggle("selected",b.dataset.mood===selectedMood));
    $("exerciseList").innerHTML = "";
    (r.exercises?.length ? r.exercises : [{name:"",weight:"",reps:"",sets:""}]).forEach(addExerciseRow);
    $("cancelEditBtn").classList.remove("hidden");
    navigate("record");
  }
  function deleteRecord(id) {
    const r = records.find(x=>x.id===id); if (!r) return;
    if (!confirm(`${formatDate(r.date)}の記録を削除しますか？この操作は元に戻せません。`)) return;
    const old = records; records = records.filter(x=>x.id!==id);
    if (!persist()) { records = old; return; }
    renderHistory(); renderHome(); showToast("記録を削除しました。");
  }
  function renderHistory() {
    $("historyMonthLabel").textContent = monthLabel(historyMonth);
    $("bodyChartMonth").textContent = monthLabel(historyMonth);
    const list = monthRecords(historyMonth);
    $("calendarCount").textContent = `今月${uniqueVisitCount(list)}日`;
    renderCalendar();
    renderSelectedDay();
    renderBodyChart(list);
  }
  function renderCalendar() {
    const grid = $("calendarDays"); grid.innerHTML = "";
    const year = historyMonth.getFullYear(), month = historyMonth.getMonth();
    const firstDay = new Date(year,month,1).getDay();
    const daysInMonth = new Date(year,month+1,0).getDate();
    const recordDates = new Set(monthRecords(historyMonth).map(r=>r.date));
    for (let i=0;i<firstDay;i++) {
      const blank = document.createElement("button"); blank.className="day-cell"; blank.disabled=true; blank.tabIndex=-1; blank.setAttribute("aria-hidden","true"); grid.appendChild(blank);
    }
    for (let day=1;day<=daysInMonth;day++) {
      const date = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const btn = document.createElement("button"); btn.type="button"; btn.className="day-cell"; btn.textContent=day;
      if (recordDates.has(date)) btn.classList.add("has-record");
      if (date===selectedDate) btn.classList.add("selected");
      if (date===toISODate(new Date())) btn.classList.add("today");
      btn.setAttribute("aria-label",`${formatDate(date)}${recordDates.has(date)?"、記録あり":""}`);
      btn.addEventListener("click",()=>{selectedDate=date;renderHistory();});
      grid.appendChild(btn);
    }
  }
  function renderSelectedDay() {
    $("selectedDateLabel").textContent = formatDate(selectedDate);
    const list = records.filter(r=>r.date===selectedDate).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    $("selectedCount").textContent = `${list.length}件の記録`;
    const el = $("historyList");
    if (!list.length) { el.innerHTML=`<div class="card empty-state">この日の記録はありません。<br>トレーニングした日を選ぶか、記録を追加してください。</div>`; return; }
    el.innerHTML = list.map(r=>`<article class="history-item"><div class="record-item-top"><span>${escapeHTML(r.time||"時間帯なし")}</span><span>${(r.exercises||[]).length}種目</span></div><div class="record-item-title">${escapeHTML(workoutSummary(r))}</div><div class="record-item-meta">${escapeHTML((r.bodies||[]).join("・")||"部位未選択")}</div><div class="record-item-meta">体調：${escapeHTML(r.condition||"—")}　·　気分：${escapeHTML(r.mood||"—")}</div>${r.memo?`<p class="record-item-meta">${escapeHTML(r.memo)}</p>`:""}${(r.exercises||[]).map(x=>`<div class="record-item-meta">${escapeHTML(x.name||"種目名なし")}：${x.weight===null||x.weight===undefined?"自重・重量未入力":`${escapeHTML(x.weight)}kg`} × ${x.reps??"—"}回 × ${x.sets??"—"}セット</div>`).join("")}<div class="history-actions"><button class="text-button" data-edit="${escapeHTML(r.id)}" type="button">編集</button><button class="text-button delete-button" data-delete="${escapeHTML(r.id)}" type="button">削除</button></div></article>`).join("");
  }
  function renderBodyChart(list) {
    const counts = BODIES.map(name=>list.reduce((sum,r)=>sum+(r.bodies||[]).filter(b=>b===name).length,0));
    const total = counts.reduce((a,b)=>a+b,0);
    const donut = $("donutChart");
    if (!total) donut.style.background = "conic-gradient(var(--sub) 0 100%)";
    else {
      let start=0; const parts=counts.map((count,i)=>{const end=start+count/total*100;const segment=`${BODY_COLORS[i]} ${start}% ${end}%`;start=end;return segment;}).filter((_,i)=>counts[i]>0);
      donut.style.background=`conic-gradient(${parts.join(",")})`;
    }
    donut.querySelector("strong").textContent=total;
    $("bodyLegend").innerHTML = total ? BODIES.map((name,i)=>counts[i]?`<div class="legend-row"><span class="legend-swatch" style="background:${BODY_COLORS[i]}"></span><span>${escapeHTML(name)}</span><span class="count">${counts[i]}件</span></div>`:"").join("") : `<p class="muted small">この月の部位記録はまだありません。</p>`;
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({app:"FIT LOG",version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a");a.href=url;a.download=`fit-log-backup-${toISODate(new Date())}.json`;a.click();URL.revokeObjectURL(url);
    showToast("バックアップを書き出しました。");
  }
  function importData(file) {
    const reader=new FileReader();
    reader.onload=()=>{
      try {
        const data=JSON.parse(reader.result);
        const incoming=Array.isArray(data)?data:data.records;
        if (!Array.isArray(incoming) || incoming.some(r=>!r || typeof r.date!=="string" || !Array.isArray(r.exercises))) throw new Error("invalid");
        if (!confirm(`${incoming.length}件の記録を読み込みます。既存記録と同じIDは上書きします。続けますか？`)) return;
        const map=new Map(records.map(r=>[r.id,r]));
        incoming.forEach(r=>map.set(r.id||`${r.date}-${Math.random()}`,r));
        const old=records;records=[...map.values()];
        if(!persist()){records=old;return;}
        renderHome();renderHistory();showToast("バックアップを読み込みました。");
      }catch(e){showToast("ファイルを読み込めませんでした。FIT LOGのバックアップを選んでください。");}
    };
    reader.readAsText(file);
  }

  document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.screen)));
  document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.go)));
  $("addWorkoutBtn").addEventListener("click",()=>startNewRecord());
  $("historyAddBtn").addEventListener("click",()=>startNewRecord(selectedDate));
  $("prevMonth").addEventListener("click",()=>{homeMonth=setMonth(homeMonth,-1);renderHome();});
  $("nextMonth").addEventListener("click",()=>{homeMonth=setMonth(homeMonth,1);renderHome();});
  $("historyPrev").addEventListener("click",()=>{historyMonth=setMonth(historyMonth,-1);selectedDate=`${monthKey(historyMonth)}-${String(Math.min(parseISO(selectedDate).getDate(),new Date(historyMonth.getFullYear(),historyMonth.getMonth()+1,0).getDate())).padStart(2,"0")}`;renderHistory();});
  $("historyNext").addEventListener("click",()=>{historyMonth=setMonth(historyMonth,1);selectedDate=`${monthKey(historyMonth)}-${String(Math.min(parseISO(selectedDate).getDate(),new Date(historyMonth.getFullYear(),historyMonth.getMonth()+1,0).getDate())).padStart(2,"0")}`;renderHistory();});
  $("addExerciseBtn").addEventListener("click",()=>addExerciseRow());
  $("timeChoices").addEventListener("click",e=>{const b=e.target.closest("[data-time]");if(!b)return;selectedTime=b.dataset.time;document.querySelectorAll("[data-time]").forEach(x=>x.classList.toggle("selected",x===b));});
  $("bodyChoices").addEventListener("click",e=>{const b=e.target.closest("[data-body]");if(!b)return;const v=b.dataset.body;selectedBodies=selectedBodies.includes(v)?selectedBodies.filter(x=>x!==v):[...selectedBodies,v];b.classList.toggle("selected",selectedBodies.includes(v));});
  $("conditionChoices").addEventListener("click",e=>{const b=e.target.closest("[data-condition]");if(!b)return;selectedCondition=b.dataset.condition;document.querySelectorAll("[data-condition]").forEach(x=>x.classList.toggle("selected",x===b));});
  $("moodChoices").addEventListener("click",e=>{const b=e.target.closest("[data-mood]");if(!b)return;selectedMood=b.dataset.mood;document.querySelectorAll("[data-mood]").forEach(x=>x.classList.toggle("selected",x===b));});
  $("workoutForm").addEventListener("submit",saveWorkout);
  $("cancelEditBtn").addEventListener("click",()=>startNewRecord());
  document.body.addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit]"); if(edit){editRecord(edit.dataset.edit);return;}
    const del=e.target.closest("[data-delete]"); if(del)deleteRecord(del.dataset.delete);
  });
  $("exportBtn").addEventListener("click",()=>{
    const choice=confirm("OK：記録データをバックアップ書き出し\nキャンセル：バックアップを読み込む");
    if(choice) exportData(); else $("importInput").click();
  });
  $("importInput").addEventListener("change",e=>{const file=e.target.files?.[0];if(file)importData(file);e.target.value="";});
  // Initialize with an empty exercise and today's date; no fake records are inserted.
  $("workoutDate").value=toISODate(new Date());
  addExerciseRow({name:"",weight:"",reps:"",sets:""});
  renderHome();renderHistory();
})();