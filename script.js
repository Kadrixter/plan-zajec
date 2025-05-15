async function loadPlanFromJson() {
    try {
        const response = await fetch('plan.json');
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        const plan = await response.json();
        return plan;
    } catch (error) {
        console.error('Error fetching or parsing the plan.json:', error);
    }
}

const weekdays = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const today = new Date();
const dayOfWeek = today.getDay();

async function loadPlanForToday() {
    try {
        const plan = await loadPlanFromJson();
        if (!plan) {
            document.getElementById('plan').innerHTML = '<h2>Błąd ładowania planu lekcji</h2>';
            return;
        }

        const currentDayPlan = plan.filter(item => item.weekday === weekdays[dayOfWeek]);

        if (dayOfWeek === 0 || dayOfWeek === 6) {  
            document.getElementById('plan').innerHTML = '<h2>Dziś masz wolne!</h2>';
            document.getElementById('timer-container').style.display = 'none';
            document.getElementById('after-school-message').textContent = '';
            document.getElementById('weekend-message').innerHTML = '<img src="images/bugs-bunny.gif" alt="Bugs Bunny">';
        } else {
            let html = '<table><tr><th>Nr</th><th>Przedmiot</th><th>Godziny</th><th>Nauczyciel</th><th>Sala</th></tr>';
            currentDayPlan.forEach(lesson => {
                html += `<tr data-lesson="${lesson.lessonNumber}" class="lesson">
                    <td>${lesson.lessonNumber}</td>
                    <td>${lesson.subject}</td>
                    <td>${lesson.start} - ${lesson.end}</td>
                    <td>${lesson.teacher}</td>
                    <td>${lesson.room}</td>
                </tr>`;
            });
            html += '</table>';
            document.getElementById('plan').innerHTML = html;
            startTimer(currentDayPlan);
        }
    } catch (error) {
        console.error('Error loading plan for today:', error);
    }
}

function startTimer(currentDayPlan) {
    const now = new Date();
    let nextEndTime = null;
    let currentLesson = null;
    let lastLessonEnd = null;

    currentDayPlan.forEach(lesson => {
        const lessonStart = new Date();
        const [startHours, startMinutes] = lesson.start.split(':');
        lessonStart.setHours(startHours, startMinutes, 0, 0);

        const lessonEnd = new Date();
        const [endHours, endMinutes] = lesson.end.split(':');
        lessonEnd.setHours(endHours, endMinutes, 0, 0);

        if (!lastLessonEnd || lessonEnd > lastLessonEnd) {
            lastLessonEnd = lessonEnd; 
        }

        if (now >= lessonStart && now <= lessonEnd) {
            currentLesson = lesson.lessonNumber;
            document.querySelector(`tr[data-lesson="${lesson.lessonNumber}"]`).classList.add('current-lesson');
        }

        if (now < lessonEnd && (!nextEndTime || lessonEnd < nextEndTime)) {
            nextEndTime = lessonEnd;
        }
    });

    if (now > lastLessonEnd) {
        document.getElementById('timer-container').style.display = 'none';
        document.getElementById('after-school-message').textContent = 'Już po lekcjach';
        document.getElementById('after-school-gif').innerHTML = '<img src="images/pope.gif" alt="Pope">';
    } else if (!currentLesson) {
        document.getElementById('timer-container').style.display = 'none';
    } else {
        document.getElementById('timer-container').style.display = 'block';
        const nextLessonEnd = new Date(nextEndTime);
        document.getElementById('timer').textContent = `${formatTimeDiff(nextLessonEnd - now)}`;

        const interval = setInterval(() => {
            const diff = nextEndTime - new Date();
            if (diff <= 0) {
                clearInterval(interval);

                document.querySelector(`tr[data-lesson="${currentLesson}"]`).classList.remove('current-lesson');

                const nextLesson = currentDayPlan.find(lesson => {
                    const lessonStart = new Date();
                    const [startHours, startMinutes] = lesson.start.split(':');
                    lessonStart.setHours(startHours, startMinutes, 0, 0);
                    return new Date() < lessonStart;
                });

                if (nextLesson) {
                    showNotification(
                        'Zaraz zacznie się lekcja!',
                        `Zaraz zacznie się ${nextLesson.subject} w sali ${nextLesson.room}.`
                    );
                } else {
                    showNotification('Plan zakończony', 'Dzisiaj nie ma więcej lekcji.');
                }
            } else {
                document.getElementById('timer').textContent = `${formatTimeDiff(diff)}`;
            }
        }, 1000);
    }
}

function formatTimeDiff(diff) {
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                localStorage.setItem('notificationsEnabled', 'true');
                document.getElementById('notification-btn').classList.add('hidden');
                showNotification(
                    'Powiadomienia włączone!',
                    'Twoje powiadomienia są aktywne.'
                );
            } else {
                localStorage.setItem('notificationsEnabled', 'false');
            }
        });
    }
}

function showNotification(title, body, icon = '') {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: icon
        });
    }
}

window.onload = () => {
    const notificationsEnabled = localStorage.getItem('notificationsEnabled');
    if (notificationsEnabled !== 'true') {
        document.getElementById('notification-btn').style.display = 'block';
    } else {
        document.getElementById('notification-btn').style.display = 'none';
    }
    loadPlanForToday();
};