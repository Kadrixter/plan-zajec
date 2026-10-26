const WEEKDAYS = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const TAB_LABELS = { 1: "Pon", 2: "Wt", 3: "Śr", 4: "Czw", 5: "Pt" };
const WEEKDAYS_ACC = { 1: "poniedziałek", 2: "wtorek", 3: "środę", 4: "czwartek", 5: "piątek" };
const NOTIFY_BEFORE_MIN = 5;

// Kolor przedmiotu (odcień HSL). Nieznane przedmioty dostają odcień z hasha nazwy.
const SUBJECT_HUES = [
    ["angielski", 210], ["niemiecki", 45], ["wf", 140], ["polski", 355],
    ["historia", 28], ["matematyka", 262], ["informatyka", 188],
    ["systemy baz danych", 172], ["projektowanie baz danych", 152],
    ["witryny", 290], ["tworzenie stron", 325], ["wychowawcza", 95],
    ["biologia", 120], ["geografia", 78], ["chemia", 340], ["fizyka", 235]
];

let plan = null;
let selectedDay = null;
let userPicked = false;
let lastStatusKey = null;
const notified = new Set();

const $ = id => document.getElementById(id);

/* ---------- dane ---------- */

async function loadPlanFromJson() {
    try {
        const response = await fetch('plan.json', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching or parsing the plan.json:', error);
        return null;
    }
}

function lessonsFor(dayIdx) {
    return plan
        .filter(l => l.weekday === WEEKDAYS[dayIdx])
        .sort((a, b) => a.lessonNumber - b.lessonNumber);
}

function toDate(timeStr, base) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d;
}

function isWeekend(dayIdx) {
    return dayIdx === 0 || dayIdx === 6;
}

function nextSchoolDay(from) {
    let d = from;
    do { d = (d + 1) % 7; } while (isWeekend(d));
    return d;
}

function isAfterSchool(now) {
    const day = now.getDay();
    if (isWeekend(day)) return false;
    const lessons = lessonsFor(day);
    if (!lessons.length) return false;
    return now >= toDate(lessons[lessons.length - 1].end, now);
}

function defaultDay(now) {
    const day = now.getDay();
    if (isWeekend(day) || isAfterSchool(now)) return nextSchoolDay(day);
    return day;
}

function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function subjectHue(subject) {
    const name = subject.toLowerCase();
    const hit = SUBJECT_HUES.find(([key]) => name.startsWith(key));
    if (hit) return hit[1];
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
}

function formatTimeDiff(diff) {
    const total = Math.max(0, Math.floor(diff / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}h ${mm}m ${ss}s` : `${m}m ${ss}s`;
}

/* ---------- render ---------- */

function renderTabs() {
    const today = new Date().getDay();
    $('tabs').innerHTML = [1, 2, 3, 4, 5].map(d => {
        const cls = ['tab', d === selectedDay ? 'active' : '', d === today ? 'today' : ''].join(' ').trim();
        return `<button type="button" class="${cls}" data-day="${d}" aria-pressed="${d === selectedDay}">${TAB_LABELS[d]}</button>`;
    }).join('');
}

function dayHint(d, now) {
    const today = now.getDay();
    if (d === today) return 'dziś';
    if (d === (today + 1) % 7) return 'jutro';
    return '';
}

function lessonCard(l) {
    return `<article class="lesson" data-lesson="${l.lessonNumber}" style="--hue:${subjectHue(l.subject)}">
        <div class="num">${esc(l.lessonNumber)}</div>
        <div class="info">
            <h3>${esc(l.subject)}</h3>
            <div class="meta">
                <span class="time">${esc(l.start)}–${esc(l.end)}</span>
                <span class="teacher">${esc(l.teacher)}</span>
            </div>
        </div>
        <div class="room"><small>sala</small>${esc(l.room)}</div>
    </article>`;
}

function renderPlan() {
    const now = new Date();
    const hint = dayHint(selectedDay, now);
    $('plan-title').textContent = WEEKDAYS[selectedDay] + (hint ? ` (${hint})` : '');

    const lessons = lessonsFor(selectedDay);
    $('lessons').innerHTML = lessons.length
        ? lessons.map(lessonCard).join('')
        : '<p class="empty">Brak lekcji tego dnia.</p>';
}

// Baner o dzisiejszym dniu (gify zostają). Przebudowa tylko przy zmianie stanu,
// żeby gif nie startował od nowa co sekundę.
function renderStatus(now) {
    const day = now.getDay();
    let key = 'school';
    if (isWeekend(day)) key = 'weekend';
    else if (isAfterSchool(now)) key = 'after';
    if (key === lastStatusKey) return;
    lastStatusKey = key;

    const msg = $('after-school-message');
    const afterGif = $('after-school-gif');
    const weekendGif = $('weekend-message');
    msg.textContent = '';
    afterGif.innerHTML = '';
    weekendGif.innerHTML = '';

    if (key === 'weekend') {
        msg.textContent = 'Dziś masz wolne!';
        weekendGif.innerHTML = '<img src="images/bugs-bunny.gif" alt="Bugs Bunny">';
    } else if (key === 'after') {
        msg.textContent = 'Już po lekcjach';
        afterGif.innerHTML = '<img src="images/pope.gif" alt="Pope">';
    }
}

function renderAll() {
    renderTabs();
    renderPlan();
    renderStatus(new Date());
    updateLive(new Date());
}

/* ---------- live: timer, pasek, podświetlenie ---------- */

function updateLive(now) {
    const box = $('timer-container');
    const cards = document.querySelectorAll('#lessons .lesson');
    cards.forEach(el => el.classList.remove('current', 'next'));

    if (selectedDay !== now.getDay()) {
        box.hidden = true;
        return;
    }

    const lessons = lessonsFor(selectedDay);
    let current = null;
    let next = null;

    for (const l of lessons) {
        const start = toDate(l.start, now);
        const end = toDate(l.end, now);
        if (now >= start && now < end) {
            current = { lesson: l, start, end };
        } else if (now < start && !next) {
            next = { lesson: l, start };
        }
    }

    if (!current && !next) {
        box.hidden = true;
        return;
    }

    box.hidden = false;
    const progress = $('progress');

    if (current) {
        document.querySelector(`#lessons .lesson[data-lesson="${current.lesson.lessonNumber}"]`)?.classList.add('current');
        $('timer-text').textContent = 'Do końca lekcji pozostało:';
        $('timer').textContent = formatTimeDiff(current.end - now);
        progress.hidden = false;
        const pct = Math.min(100, Math.max(0, ((now - current.start) / (current.end - current.start)) * 100));
        $('progress-bar').style.width = pct + '%';
    } else {
        const isFirst = next.lesson === lessons[0];
        $('timer-text').textContent = isFirst ? 'Do pierwszej lekcji:' : 'Do następnej lekcji:';
        $('timer').textContent = formatTimeDiff(next.start - now);
        progress.hidden = true;
    }

    if (next) {
        document.querySelector(`#lessons .lesson[data-lesson="${next.lesson.lessonNumber}"]`)?.classList.add('next');
        $('timer-next').textContent = `Dalej: ${next.lesson.subject}, sala ${next.lesson.room}`;
    } else {
        $('timer-next').textContent = 'To ostatnia lekcja na dziś.';
    }
}

/* ---------- powiadomienia ---------- */

function updateNotificationButton() {
    const supported = 'Notification' in window;
    const enabled = localStorage.getItem('notificationsEnabled') === 'true' && supported && Notification.permission === 'granted';
    $('notification-btn').classList.toggle('hidden', !supported || enabled);
}

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            localStorage.setItem('notificationsEnabled', 'true');
            updateNotificationButton();
            showNotification(
                'Powiadomienia włączone!',
                `Dam znać ${NOTIFY_BEFORE_MIN} min przed każdą lekcją (gdy strona jest otwarta).`,
                'welcome'
            );
        } else {
            localStorage.setItem('notificationsEnabled', 'false');
        }
    });
}

async function showNotification(title, body, tag = '') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body, icon: 'images/icon-192.png', badge: 'images/icon-192.png', tag };
    try {
        // Na telefonach (Android) `new Notification` nie działa, trzeba przez service worker.
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
        if (reg) {
            await reg.showNotification(title, options);
            return;
        }
    } catch (e) {
        console.warn('SW notification failed, falling back:', e);
    }
    try {
        new Notification(title, options);
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}

function checkNotifications(now) {
    if (localStorage.getItem('notificationsEnabled') !== 'true') return;
    const day = now.getDay();
    if (isWeekend(day)) return;

    for (const l of lessonsFor(day)) {
        const diff = toDate(l.start, now) - now;
        if (diff > 0 && diff <= NOTIFY_BEFORE_MIN * 60000) {
            const key = `${now.toDateString()}-${l.lessonNumber}`;
            if (notified.has(key)) continue;
            notified.add(key);
            showNotification(
                `Za ${Math.ceil(diff / 60000)} min: ${l.subject}`,
                `Sala ${l.room}, ${l.start}. Nauczyciel: ${l.teacher}.`,
                key
            );
        }
    }
}

/* ---------- pętla ---------- */

function tick() {
    const now = new Date();

    // Dopóki nie klikniesz zakładki, plan sam przeskakuje na kolejny dzień po lekcjach.
    if (!userPicked) {
        const d = defaultDay(now);
        if (d !== selectedDay) {
            selectedDay = d;
            renderAll();
            checkNotifications(now);
            return;
        }
    }

    renderStatus(now);
    updateLive(now);
    checkNotifications(now);
}

async function init() {
    updateNotificationButton();

    $('tabs').addEventListener('click', e => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        selectedDay = Number(btn.dataset.day);
        userPicked = true;
        renderAll();
    });

    plan = await loadPlanFromJson();
    if (!plan) {
        $('plan-title').textContent = 'Błąd ładowania planu lekcji';
        return;
    }

    selectedDay = defaultDay(new Date());
    renderAll();
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tick();
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW register failed:', err));
    }
}

window.onload = init;
