
const weekList = document.getElementById("week-list");
const dayList = document.getElementById("day-list");
const prayerList = document.getElementById("prayer-list");

const daySection = document.querySelector(".day-section");
const prayerSection = document.querySelector(".prayer-section");

const prayers = ["صبح", "ظهر", "عصر", "مغرب", "عشا"];

daySection.style.display = "none";
prayerSection.style.display = "none";

const persianCalendar = new Intl.DateTimeFormat(
    "fa-IR-u-ca-persian",
    {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        numberingSystem: "latn"
    }
);

function getPersianDate(date) {
    const parts = persianCalendar.formatToParts(date);

    return {
        year: Number(parts.find(p => p.type === "year").value),
        month: Number(parts.find(p => p.type === "month").value),
        day: Number(parts.find(p => p.type === "day").value)
    };
}

function getMonthInfo(date) {
    const current = getPersianDate(date);

    const firstDay = new Date(date);
    firstDay.setDate(date.getDate() - current.day + 1);

    let count = 0;
    let checkDate = new Date(firstDay);

    while (true) {
        const persian = getPersianDate(checkDate);

        if (
            persian.month !== current.month ||
            persian.year !== current.year
        ) {
            break;
        }

        count++;
        checkDate.setDate(checkDate.getDate() + 1);
    }

    return {
        year: current.year,
        month: current.month,
        days: count,
        firstDay: firstDay
    };
}

// ماهی که کاربر در حال مشاهده آن است
let displayedMonth = getMonthInfo(new Date()).firstDay;

let selectedWeek = 1;

// اطلاعات ماه انتخاب‌شده
function getDisplayedMonthInfo() {
    return getMonthInfo(displayedMonth);
}

// نمایش نام ماه
function updateMonthTitle() {
    document.getElementById("current-month").textContent =
        new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            month: "long",
            year: "numeric"
        }).format(displayedMonth);
}

// آمار ماه جاری
function updateMonthlyStats() {
    const info = getMonthInfo(new Date());
    let completed = 0;

    for (let day = 1; day <= info.days; day++) {
        const key = `prayer-${info.year}-${info.month}-${day}`;

        const saved = JSON.parse(
            localStorage.getItem(key) || "[]"
        );

        completed += saved.length;
    }

    const total = info.days * 5;
    const percentage = Math.round((completed / total) * 100);

    document.getElementById("monthly-progress").textContent =
        `${percentage}٪ انجام شده`;

    document.getElementById("progress-fill").style.width =
        `${percentage}%`;
}

// نام روز هفته
function getWeekdayName(day) {
    const info = getDisplayedMonthInfo();

    const date = new Date(info.firstDay);
    date.setDate(date.getDate() + day - 1);

    return new Intl.DateTimeFormat("fa-IR", {
        weekday: "long"
    }).format(date);
}

// نمایش هفته‌ها
function showWeeks() {
    weekList.innerHTML = "";

    const info = getDisplayedMonthInfo();
    const offset = (info.firstDay.getDay() + 1) % 7;

    const totalWeeks = Math.ceil(
        (info.days + offset) / 7
    );

    for (let i = 1; i <= totalWeeks; i++) {
        const button = document.createElement("button");

        button.textContent = `هفته ${i}`;
        button.className = "week-button";

        button.onclick = () => {
            selectedWeek = i;

            showWeeks();

            daySection.style.display = "block";
            prayerSection.style.display = "none";

            showDays();
        };

        if (i === selectedWeek) {
            button.classList.add("active");
        }

        weekList.appendChild(button);
    }
}

// نمایش روزهای هفته انتخاب‌شده
function showDays() {
    dayList.innerHTML = "";
    prayerList.innerHTML = "";

    prayerSection.style.display = "none";

    const info = getDisplayedMonthInfo();
    const offset = (info.firstDay.getDay() + 1) % 7;

    const startDay = Math.max(
        1,
        (selectedWeek - 1) * 7 - offset + 1
    );

    const endDay = Math.min(
        info.days,
        selectedWeek * 7 - offset
    );

    for (let i = startDay; i <= endDay; i++) {
        const button = document.createElement("button");

        button.textContent = `${getWeekdayName(i)} ${i}`;
        button.className = "day-button";
        button.dataset.day = i;

        button.onclick = () => showPrayers(i);

        dayList.appendChild(button);
    }
}

// نمایش نمازهای یک روز
function showPrayers(day) {
    prayerSection.style.display = "block";
    prayerList.innerHTML = "";

    document.querySelectorAll(".day-button").forEach(button => {
        button.classList.remove("active");
    });

    document.querySelector(
        `.day-button[data-day="${day}"]`
    ).classList.add("active");

    const info = getDisplayedMonthInfo();

    const selectedDate = new Date(info.firstDay);
    selectedDate.setDate(selectedDate.getDate() + day - 1);

    document.getElementById("selected-date").textContent =
        new Intl.DateTimeFormat("fa-IR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(selectedDate);

    const storageKey =
        `prayer-${info.year}-${info.month}-${day}`;

    const savedPrayers = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
    );

    prayers.forEach((prayer, index) => {
        const item = document.createElement("div");
        item.className = "prayer-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = savedPrayers.includes(index);

        checkbox.addEventListener("change", () => {
            let current = JSON.parse(
                localStorage.getItem(storageKey) || "[]"
            );

            if (checkbox.checked) {
                if (!current.includes(index)) {
                    current.push(index);
                }
            } else {
                current = current.filter(i => i !== index);
            }

            localStorage.setItem(
                storageKey,
                JSON.stringify(current)
            );

            updateMonthlyStats();
        });

        item.innerHTML = `<span>نماز ${prayer}</span>`;
        item.appendChild(checkbox);

        prayerList.appendChild(item);
    });
}

// تغییر ماه
function changeMonth(amount) {
    displayedMonth.setMonth(
        displayedMonth.getMonth() + amount
    );

    displayedMonth.setDate(1);

    selectedWeek = 1;

    updateMonthTitle();
    showWeeks();

    daySection.style.display = "none";
    prayerSection.style.display = "none";

    dayList.innerHTML = "";
    prayerList.innerHTML = "";
}

document.getElementById("prev-month").addEventListener(
    "click",
    () => changeMonth(-1)
);

document.getElementById("next-month").addEventListener(
    "click",
    () => changeMonth(1)
);

// مدیریت نمازهای قضا
const qazaButton = document.getElementById("qaza-button");
const qazaPanel = document.getElementById("qaza-panel");
const qazaList = document.getElementById("qaza-list");

let qazaData = JSON.parse(
    localStorage.getItem("qazaData") || "[]"
);

qazaButton.addEventListener("click", () => {
    qazaPanel.style.display =
        qazaPanel.style.display === "none" ? "block" : "none";
});

function showQaza() {
    qazaList.innerHTML = "";
    const total = qazaData.reduce((sum, item) => {
    return sum + item.count;
}, 0);

document.getElementById("qaza-total").textContent =
    `مجموع نمازهای باقی‌مانده: ${total}`;

    qazaData.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "prayer-item";

        const text = document.createElement("span");
        text.textContent =
            `نماز ${item.prayer}: ${item.count} نماز قضا`;

        const doneButton = document.createElement("button");
        doneButton.textContent = "انجام شد";
        doneButton.className = "done-qaza";

        doneButton.addEventListener("click", () => {
            item.count--;

            if (item.count <= 0) {
                qazaData.splice(index, 1);
            }

            localStorage.setItem(
                "qazaData",
                JSON.stringify(qazaData)
            );

            showQaza();
        });
const editButton = document.createElement("button");
editButton.textContent = "ویرایش";
editButton.className = "edit-qaza";

editButton.addEventListener("click", () => {
    const newCount = Number(
        prompt("تعداد جدید نمازهای قضا را وارد کن:", item.count)
    );

    if (!Number.isInteger(newCount) || newCount < 1) {
        alert("لطفاً یک عدد معتبر وارد کن.");
        return;
    }

    item.count = newCount;

    localStorage.setItem(
        "qazaData",
        JSON.stringify(qazaData)
    );

    showQaza();
});
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "حذف";
        deleteButton.className = "delete-qaza";

        deleteButton.addEventListener("click", () => {
            const confirmDelete = confirm(
    `آیا از حذف نماز قضا ${item.prayer} مطمئنی؟`
);

if (!confirmDelete) return;
            qazaData.splice(index, 1);

            localStorage.setItem(
                "qazaData",
                JSON.stringify(qazaData)
            );

            showQaza();
        });

       div.appendChild(text);
div.appendChild(doneButton);
div.appendChild(editButton);
div.appendChild(deleteButton);

        qazaList.appendChild(div);
    });
}

document.getElementById("add-qaza").addEventListener("click", () => {
    const prayer = document.getElementById("qaza-prayer").value;
    const count = Number(
        document.getElementById("qaza-count").value
    );

    if (!Number.isInteger(count) || count < 1) {
        alert("لطفاً تعداد معتبر وارد کن.");
        return;
    }

    const existing = qazaData.find(
        item => item.prayer === prayer
    );

    if (existing) {
        existing.count += count;
    } else {
        qazaData.push({ prayer, count });
    }

    localStorage.setItem(
        "qazaData",
        JSON.stringify(qazaData)
    );

    document.getElementById("qaza-count").value = "";

    showQaza();
});

// اجرای اولیه برنامه
updateMonthTitle();
showWeeks();
showQaza();
updateMonthlyStats();
document.getElementById("export-data").addEventListener("click", () => {
    const backup = {};

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key.startsWith("prayer-") || key === "qazaData") {
            backup[key] = localStorage.getItem(key);
        }
    }

    const file = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = "namaz-man-backup.json";
    link.click();

    URL.revokeObjectURL(url);
});
const importButton = document.getElementById("import-data");
const importFile = document.getElementById("import-file");

importButton.addEventListener("click", () => {
    importFile.click();
});

importFile.addEventListener("change", () => {
    const file = importFile.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        try {
            const backup = JSON.parse(reader.result);

            if (
                typeof backup !== "object" ||
                backup === null ||
                Array.isArray(backup)
            ) {
                throw new Error("Invalid backup");
            }

            for (const key in backup) {
                if (
                    !key.startsWith("prayer-") &&
                    key !== "qazaData"
                ) {
                    throw new Error("Invalid key");
                }

                if (typeof backup[key] !== "string") {
                    throw new Error("Invalid data");
                }

                const value = JSON.parse(backup[key]);

                if (key === "qazaData") {
                    if (
                        !Array.isArray(value) ||
                        !value.every(item =>
                            item &&
                            ["صبح", "ظهر", "عصر", "مغرب", "عشا"].includes(item.prayer) &&
                            Number.isInteger(item.count) &&
                            item.count > 0
                        )
                    ) {
                        throw new Error("Invalid qaza data");
                    }
                } else if (
                    !/^prayer-\d+-\d+-\d+$/.test(key) ||
                    !Array.isArray(value) ||
                    !value.every(i => Number.isInteger(i) && i >= 0 && i <= 4)
                ) {
                    throw new Error("Invalid prayer data");
                }
            }

            if (!confirm("اطلاعات فعلی با نسخه پشتیبان جایگزین شوند؟")) {
                return;
            }

            for (const key in backup) {
                localStorage.setItem(key, backup[key]);
            }

            alert("اطلاعات با موفقیت بازیابی شد.");
            location.reload();

        } catch (error) {
            alert("فایل پشتیبان معتبر نیست.");
        }
    };

    reader.readAsText(file);
});
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("Service Worker ثبت شد"))
            .catch(error => console.error("خطا در ثبت Service Worker:", error));
    });
}