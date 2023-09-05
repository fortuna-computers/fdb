//
// GLOBALS
// 

let tabSelected = "code";
let memoryPage = 0x0;
let singleCycleCounter = 0;

//
// EVENTS
//

window.addEventListener("load", async (_) => {
    let a = localStorage.getItem("fortuna-show-address");
    if (a === null)
        a = true;
    setShowAddress(a);
    document.getElementById("show-address").checked = a;
    
    await recompileAndReset();
    await reset();
});

document.addEventListener("keydown", async (e) => {
    switch (e.key) {
        case "1": await tabSelect("code"); break;
        case "2": await tabSelect("memory"); break;
        case "3": await tabSelect("selftest"); break;
        case "s": await step(); break;
        case "w": await reset(); break;
        case "x": await recompileAndReset(); break;
    }
});

//
// TABS
//

async function tabSelect(tab) {
    const el = e(`tab-${tab}`);   
    if (el) {
        for (const elem of ["code", "memory", "selftest"]) {
            e(`tab-${elem}`).classList.remove("tab-selected");
            e(elem).style.display = "none";
        }

        el.classList.add("tab-selected");
        e(tab).style.display = "flex";
    }

    tabSelected = tab;

    if (tab === "memory")
        await memoryRequestUpdate();
}

//
// CODE
//

async function uploadRom(rom) {
    const codeDebug = e("code-debug");
    codeDebug.innerHTML = "Uploading ROM ";
    for (let i = 0; i < rom.length; i += 64) {
        codeDebug.innerHTML += ".";
        try {
            await apiMemoryWrite(i, rom.slice(i, i + 64));
        } catch (ex) {
            codeDebug.innerHTML += "X";
        }
    }
    codeDebug.innerHTML += " Done!";
}

function parseLine(line) {
    if (!line.startsWith("Source"))
        line = `<span class="code-line-header">${line.slice(0,33)}</span>${line.slice(33)}`;
    line = line.replace(/Source: "(.+?)"/, `<span class="code-line-filename">$1</span>`);
    line = line.replace(/;(.*?)$/, `<span class="code-line-comment">;$1</span>`);
    return line;
}

function removeCodeLocation() {
    for (let el of document.getElementsByClassName("code-line-pc"))
        el.classList.remove("code-line-pc");
}

function updateCodeLocation(pc) {
    removeCodeLocation();
    const el = e(`code-line-${pc}`);
    if (el) {
        el.classList.add("code-line-pc");
        el.scrollIntoView({ /* behavior: "smooth", */ block: "nearest" });
    }
}

function updateCode(src) {
    const codeDebug = e("code-debug");
    codeDebug.innerHTML = "";

    let parsingLabels = false;
    const labels = {};
    
    for (const line of src.split("\n")) {

        if (line.startsWith("Labels by address")) {
            parsingLabels = true;
            continue;
        }

        if (!parsingLabels) {
            const addr = parseInt(line.slice(3, 7), 16);
            const codeLine = document.createElement("div");
            codeLine.classList.add("code-line");
            if (!isNaN(addr))
                codeLine.id = `code-line-${addr}`;
            if (addr === 0)
                codeLine.classList.add("code-line-pc");
    
            const bkp = document.createElement("div");
            bkp.classList.add("bkp-area");
            if (!isNaN(addr)) {
                bkp.id = `bkp-${addr}`;
                bkp.addEventListener("click", () => swapBreakpoint(addr));
            }
            codeLine.appendChild(bkp);
    
            const lineElement = document.createElement("div");
            lineElement.innerHTML = parseLine(line);
            codeLine.appendChild(lineElement);
            
            codeDebug.appendChild(codeLine);
            
        } else {
            const addr = parseInt(line.slice(0, 4), 16);
            if (!isNaN(addr))
                labels[line.slice(5)] = addr;
        }
    }

    updateLabels(labels);
}

function updateLabels(labels) {
    const options = ["<option>Symbols...</option>"];
    for (const lbl of Object.keys(labels).sort()) {
        options.push(`<option value="${labels[lbl]}">${lbl}</option>`);
    }
    e("symbols").innerHTML = options.join("");
}

function updateRegisters(r) {
    const hx = (n, split) => {
        if (n === undefined) {
            return "";
        } else if (split) {
            const h = hex(n, 4);
            return `<span class="reg-high">${h.substring(0, 2)}</span><span class="reg-low">${h.substring(2, 4)}</span>`;
        } else {
            return hex(n, 4);
        }
    };
    const a = r.af >> 8;
    e("reg-af").innerHTML = `${hex(a, 2)} ${String.fromCharCode(a)}`;
    e("reg-bc").innerHTML = hx(r.bc, true);
    e("reg-de").innerHTML = hx(r.de, true);
    e("reg-hl").innerHTML = hx(r.hl, true);
    e("reg-afx").innerHTML = hx(r.afx, true);
    e("reg-bcx").innerHTML = hx(r.bcx, true);
    e("reg-dex").innerHTML = hx(r.dex, true);
    e("reg-hlx").innerHTML = hx(r.hlx, true);
    e("reg-ix").innerHTML = hx(r.ix, false);
    e("reg-iy").innerHTML = hx(r.iy, false);
    e("reg-sp").innerHTML = hx(r.sp, false);
    e("reg-pc").innerHTML = hx(r.pc, false);

    e("flag-s").checked = r.af & (1 << 7);
    e("flag-z").checked = r.af & (1 << 6);
    e("flag-h").checked = r.af & (1 << 4);
    e("flag-pv").checked = r.af & (1 << 2);
    e("flag-n").checked = r.af & (1 << 1);
    e("flag-c").checked = r.af & 1;

    for (let i = 0; i < 8; ++i)
        e(`stack-${i}`).innerHTML = r.stack ? hx(r.stack[i]) : "----";

    e("bank").innerHTML = r.bank;
    e("ramonly").innerHTML = r.ramonly;
}

function updateBreakpoints(bkps) {
    for (const el of document.getElementsByClassName("bkp")) {
        el.classList.remove("bkp");
    }
    for (const bkp of bkps) {
        let el = e(`bkp-${bkp}`);
        if (el)
            el.classList.add("bkp");
    }
}

//
// CODE (run)
//

async function simpleStep() {
    removeCodeLocation();
    const r = await apiStep(false);
    updateCodeLocation(r.pc);
    updateRegisters(r);
}

async function step() {
    removeCodeLocation();
    const r = await apiStep(true);
    updateCodeLocation(r.pc);
    updateRegisters(r);
}

function startRunning() {
    e("running").style.display = "block";
    removeCodeLocation();
}

async function runnerHandler() {
    const r = await apiRunState();
    if (r.state === "running")
        setTimeout(runnerHandler, 250);
    else if (r.state === "breakpoint-hit")
        stopRunning(r);
}

function stopRunning(r) {
    updateCodeLocation(r.pc);
    updateRegisters(r);
    e("running").style.display = "none";
}

async function startExecution(callback) {
    startRunning();
    const r = await callback();
    if (r.state === "breakpoint-hit")
        stopRunning(r);
    else
        await runnerHandler();
}

async function next() {
    await startExecution(apiNext);
}

async function run() {
    await startExecution(apiRun);
}

async function reset() {
    await apiReset();
    updateCodeLocation(0);
}

async function swapBreakpoint(addr) {
    const r = await apiSwapBreakpoint(addr);
    updateBreakpoints(r);
}

async function recompileAndReset() {
    let r;
    try {
        r = await apiRecompile();
    } catch (ex) {
        r = JSON.parse(ex.message);
        e("error").innerHTML = `<pre>${r.stderr}</pre>`;
        return;
    } finally {
        if (r.stdout) 
            console.log(r.stdout);
        if (r.stderr)
            console.warn(r.stderr);
    }
    
    await apiReset();
    await uploadRom(r.rom);
    updateCode(r.src);
}

//
// CODE (advanced)
//

function showAddressChecked(event) {
    setShowAddress(event.checked);
    localStorage.setItem("fortuna-show-address", event.checked);
}

function setShowAddress(show) {
    document.documentElement.style.setProperty("--display-line-header", show ? "inline-block" : "none");
}

function advancedChecked(event) {
    const elem = e("advancedText");
    elem.style.display = event.checked ? "flex" : "none";
}

async function advancedStepCycle() {
    const ss = await apiStepCycle();
    const row = `<tr>
        <td>${singleCycleCounter++}</td>
        <td>${hex(ss.addr, 4)}</td>
        <td>${hex(ss.data, 2)}</td>
        <td>${!ss.m1 ? "0" : ""}</td>
        <td>${!ss.iorq ? "0" : ""}</td>
        <td>${!ss.busak ? "0" : ""}</td>
        <td>${!ss.wait ? "0" : ""}</td>
        <td>${!ss.int ? "0" : ""}</td>
        <td>${!ss.wr ? "0" : ""}</td>
        <td>${!ss.rd ? "0" : ""}</td>
        <td>${!ss.mreq ? "0" : ""}</td>
    </tr>`;
    e("advanced-body").innerHTML = row + e("advanced-body").innerHTML;
}



//
// MEMORY
//

async function updatePage() {
    const data = prompt(`New page (in hex):`);
    if (data.trim() === "")
        return;
    const value = Number(`0x${data}`);
    if (isNaN(value)) {
        alert("Invalid value.");
        return;
    }
    
    await memorySetPage(value);
}

async function memoryChangePage(offset) {
    await memorySetPage(memoryPage + offset);
}

async function memorySetPage(page) {
    memoryPage = page;
    if (memoryPage > 0xff)
        memoryPage = 0x0;
    else if (memoryPage < 0x00)
        memoryPage = 0xff;

    e("memory-page").innerHTML = `0x${hex(memoryPage)}`;

    await memoryRequestUpdate();
}

async function memoryRequestSet(address) {
    const data = prompt(`New data for address 0x${hex(address, 4)} (in hex):`);
    if (data.trim() === "")
        return;
    const value = Number(`0x${data}`);
    if (isNaN(value)) {
        alert("Invalid value.");
        return;
    }
    
    await apiMemoryWrite(address, [value]);
    await memoryRequestUpdate();
}

async function memoryRequestUpdate() {
    e("memory-holder").style.visibility = "hidden";
    
    const array = await apiMemoryRead(memoryPage);

    const tbody = e("memory-body");
    tbody.innerHTML = '';
    
    for (let i = 0; i < 16; ++i) {
        const tr = document.createElement("tr");

        const addr = document.createElement("td");
        addr.classList.add("memory-address");
        addr.innerHTML = hex(memoryPage << 8 | (i << 4), 4);
        tr.appendChild(addr);

        for (let j = 0; j < 16; ++j) {
            const data = document.createElement("td");
            data.classList.add("memory-data");
            if (j === 7)
                data.classList.add("memory-data-7");
            data.innerHTML = hex(array[(i * 16) + j]);
            data.addEventListener("dblclick", () => memoryRequestSet((memoryPage << 8) + (i * 16) + j));
            tr.appendChild(data);
        }

        const str = [];
        for (let j = 0; j < 16; ++j) {
            const c = array[(i * 16) + j];
            if (c < 32 || c >= 127)
                str.push('.');
            else
                str.push(String.fromCharCode(c));
        }
        const text = document.createElement("td");
        text.classList.add("memory-text");
        text.innerHTML = str.join("");
        tr.appendChild(text);

        tbody.appendChild(tr);
    }

    e("memory-holder").style.visibility = "visible";
}

function goToAddress(addr) {
    const el = e(`code-line-${addr}`);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

//
// SELF-TEST
//

async function runSelfTest() {
    const text = (await apiSelfTest()).map(r => `${r.test}: ${r.result ? "<span style='color: green;'>OK</span>" : "<span style='color: red;'>ERROR</span>"}`);
    e("selftest-results").innerHTML = text.map(t => `<div>${t}</div>`).join('');
}

//
// CURSOR
//

function setHourglass(v) {
    if (v) {
        document.body.classList.add("executing");
        document.querySelectorAll('button').forEach(t => t.classList.add("executing"));
    } else {
        document.body.classList.remove("executing");
        document.querySelectorAll('button').forEach(t => t.classList.remove("executing"));
    }
}

//
// API
//

const apiUrl = window.location.href.replace(/\/$/, "");

async function callApi(path, options) {
    try {
        setHourglass(true);
        const response = await fetch(apiUrl + path, options);
        if (!response.ok)
            throw new Error(await response.text());

        return await response.json();
    } catch (ex) {
        e("error").style.display = "block";
        e("error").innerHTML = ex.message;
        throw ex;
    } finally {
        setHourglass(false);
    }
}

async function apiMemoryRead(page) {
    return callApi(`/memory/${page}`);
}

async function apiMemoryWrite(page, data) {
    return callApi(`/memory/${page}`, {
        method: "POST",
        body: JSON.stringify({ data })
    });
}

async function apiSelfTest() {
    return callApi(`/post`, { method: "POST" });
}

async function apiStepCycle() {
    return callApi(`/step-cycle`, { method: "POST" });
}

async function apiRecompile() {
    return callApi(`/code`);
}

async function apiReset() {
    return callApi(`/reset`, { method: "POST" });
}

async function apiStep(nmi) {
    return callApi(`/step?nmi=${nmi ? "true" : "false"}`, { method: "POST" });
}

async function apiSwapBreakpoint(addr) {
    return callApi(`/breakpoint/${addr}`, { method: "POST" });
}

async function apiRun() {
    return callApi(`/run`, { method: "POST" });
}

async function apiNext() {
    return callApi(`/next`, { method: "POST" });
}

async function apiRunState() {
    return callApi(`/run-state`);
}

//
// UTILS
//

const e = (id) => document.getElementById(id);
const hex = (num, digits) => (num !== undefined && num !== null) ? num.toString(16).toUpperCase().padStart(digits || 2, '0') : "";