
const weekList = document.getElementById("week-list");
const dayList = document.getElementById("day-list");
const prayerList = document.getElementById("prayer-list");

const daySection = document.querySelector(".day-section");
const prayerSection = document.querySelector(".prayer-section");

const prayers = ["صبح", "ظهر", "عصر", "مغرب", "عشا"];

const qazaButton = document.getElementById("qaza-button");
const qazaPanel = document.getElementById("qaza-panel");
const qazaList = document.getElementById("qaza-list");

const validPrayers = ["صبح", "ظهر", "عصر", "مغرب", "عشا"];

const provinceSelect = document.getElementById("province-select");
const citySelect = document.getElementById("city-select");
const selectedLocation = document.getElementById("selected-location");
const openLocationButton = document.getElementById("open-location");
const locationPanel = document.getElementById("location-panel");
const closeLocationButton = document.getElementById("close-location");

// خواندن امن اطلاعات از حافظه مرورگر
function readStorage(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

// اطلاعات نماز قضا
let qazaData = readStorage("qazaData", []);

if (!Array.isArray(qazaData)) {
    qazaData = [];
}

// باز و بسته کردن پنل مکان
openLocationButton.addEventListener("click", () => {
    locationPanel.hidden = false;
});

closeLocationButton.addEventListener("click", () => {
    locationPanel.hidden = true;
});

// اطلاعات استان‌ها و شهرها
let provincesData = [];
let citiesData = [];

async function loadLocationData() {
    try {
        const [provinceResponse, cityResponse] = await Promise.all([
            fetch("./data/provinces.json"),
            fetch("./data/cities-filtered.json")
        ]);

        if (!provinceResponse.ok || !cityResponse.ok) {
            throw new Error("خطا در دریافت فایل‌ها");
        }

        provincesData = await provinceResponse.json();
        citiesData = await cityResponse.json();

        provincesData.sort((a, b) =>
            a.name.localeCompare(b.name, "fa")
        );

        provincesData.forEach(province => {
            const option = document.createElement("option");
            option.value = province.id;
            option.textContent = province.name;
            provinceSelect.appendChild(option);
        });

        const savedProvinceId = localStorage.getItem("selectedProvinceId");
        const savedCityId = localStorage.getItem("selectedCityId");

        if (savedProvinceId && savedCityId) {
            provinceSelect.value = savedProvinceId;
            provinceSelect.dispatchEvent(new Event("change"));

            citySelect.value = savedCityId;

            if (citySelect.value) {
                citySelect.dispatchEvent(new Event("change"));
            }
        }

    } catch (error) {
        console.error("خطا در بارگذاری اطلاعات مکان:", error);
        alert("اطلاعات استان‌ها و شهرها بارگذاری نشد.");
    }
}

loadLocationData();

// انتخاب استان
provinceSelect.addEventListener("change", () => {
    const provinceId = Number(provinceSelect.value);

    citySelect.innerHTML = '<option value="">انتخاب شهر</option>';
    selectedLocation.textContent = "هنوز شهری انتخاب نشده است.";

    if (!provinceId) {
        citySelect.disabled = true;
        return;
    }

    const provinceCities = citiesData
        .filter(city => city.province_id === provinceId)
        .sort((a, b) => a.name.localeCompare(b.name, "fa"));

    provinceCities.forEach(city => {
        const option = document.createElement("option");
        option.value = city.id;
        option.textContent = city.name;
        citySelect.appendChild(option);
    });

    citySelect.disabled = false;
});

// تبدیل نام شهر به مختصات جغرافیایی
async function getCityCoordinates(city, province) {
    const cacheKey = `coordinates-${province.id}-${city.id}`;
    const cached = readStorage(cacheKey, null);

    if (
        cached &&
        cached.latitude != null &&
        cached.longitude != null
    ) {
        return cached;
    }

    const geoUrl = new URL(
        "https://nominatim.openstreetmap.org/search"
    );

    geoUrl.searchParams.set(
        "q",
        `${city.name}, ${province.name}, Iran`
    );
    geoUrl.searchParams.set("format", "jsonv2");
    geoUrl.searchParams.set("limit", "1");
    geoUrl.searchParams.set("countrycodes", "ir");
    geoUrl.searchParams.set("accept-language", "fa");

    const response = await fetch(geoUrl);

    if (!response.ok) {
        throw new Error("خطا در دریافت مختصات شهر");
    }

    const data = await response.json();

    if (!data || data.length === 0) {
        throw new Error("مختصات شهر پیدا نشد");
    }

    const coordinates = {
        latitude: Number(data[0].lat),
        longitude: Number(data[0].lon)
    };

    localStorage.setItem(
        cacheKey,
        JSON.stringify(coordinates)
    );

    return coordinates;
}

// دریافت و نمایش اوقات شرعی
async function loadPrayerTimes(city, province) {
    const timeElements = {
        Fajr: "fajr-time",
        Dhuhr: "dhuhr-time",
        Asr: "asr-time",
        Maghrib: "maghrib-time",
        Isha: "isha-time"
    };

    Object.values(timeElements).forEach(id => {
        document.getElementById(id).textContent = "...";
    });

    try {
        const coordinates = await getCityCoordinates(city, province);

        const dateParts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Tehran",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }).formatToParts(new Date());

        const date = [
            dateParts.find(p => p.type === "day").value,
            dateParts.find(p => p.type === "month").value,
            dateParts.find(p => p.type === "year").value
        ].join("-");

        const prayerUrl = new URL(
            `https://api.aladhan.com/v1/timings/${date}`
        );

        prayerUrl.searchParams.set(
            "latitude",
            coordinates.latitude
        );

        prayerUrl.searchParams.set(
            "longitude",
            coordinates.longitude
        );

        prayerUrl.searchParams.set("method", "7");

        const response = await fetch(prayerUrl);

        if (!response.ok) {
            throw new Error("دریافت اوقات شرعی ناموفق بود");
        }

        const result = await response.json();

        if (result.code !== 200) {
            throw new Error("سرویس اوقات شرعی پاسخ معتبر نداد");
        }

        const timings = result.data.timings;

        Object.entries(timeElements).forEach(([prayer, id]) => {
            document.getElementById(id).textContent =
                timings[prayer].split(" ")[0];
        });

    } catch (error) {
        console.error("خطای واقعی:", error);

        Object.values(timeElements).forEach(id => {
            document.getElementById(id).textContent = "--:--";
        });

        alert("علت خطا: " + error.message);
    }
}

// انتخاب شهر
citySelect.addEventListener("change", async () => {
    const cityId = Number(citySelect.value);

    const city = citiesData.find(item => item.id === cityId);

    const province = provincesData.find(
        item => item.id === Number(provinceSelect.value)
    );

    if (!city || !province) {
        selectedLocation.textContent =
            "هنوز مکانی انتخاب نشده است.";
        return;
    }

    const locationName =
        `${city.name}، استان ${province.name}`;

    selectedLocation.textContent = locationName;

    document.getElementById("header-location").textContent =
        locationName;

    localStorage.setItem("selectedProvinceId", province.id);
    localStorage.setItem("selectedCityId", city.id);

    await loadPrayerTimes(city, province);
});

// مخفی کردن بخش‌های انتخاب روز
daySection.style.display = "none";
prayerSection.style.display = "none";

// تاریخ شمسی
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

// اطلاعات ماه شمسی
function getMonthInfo(date) {
    const current = getPersianDate(date);

    const firstDay = new Date(date);
    firstDay.setDate(date.getDate() - current.day + 1);

    let count = 0;
    const checkDate = new Date(firstDay);

    while (count < 32) {
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
        firstDay
    };
}

// ماه در حال نمایش
let displayedMonth = getMonthInfo(new Date()).firstDay;
let selectedWeek = 1;

function getDisplayedMonthInfo() {
    return getMonthInfo(displayedMonth);
}

// نمایش عنوان ماه
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
        const saved = readStorage(key, []);

        if (!Array.isArray(saved)) continue;

        const validSaved = saved.filter(
            index =>
                Number.isInteger(index) &&
                index >= 0 &&
                index < prayers.length
        );

        completed += new Set(validSaved).size;
    }

    const total = info.days * prayers.length;
    const percentage = total
        ? Math.round((completed / total) * 100)
        : 0;

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

        if (i === selectedWeek) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => {
            selectedWeek = i;

            showWeeks();

            daySection.style.display = "block";
            prayerSection.style.display = "none";

            showDays();
        });

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

        button.addEventListener("click", () => {
            showPrayers(i);
        });

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

    const activeButton = document.querySelector(
        `.day-button[data-day="${day}"]`
    );

    if (activeButton) {
        activeButton.classList.add("active");
    }

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

    const saved = readStorage(storageKey, []);

    const savedPrayers = Array.isArray(saved)
        ? saved.filter(
            index =>
                Number.isInteger(index) &&
                index >= 0 &&
                index < prayers.length
        )
        : [];

    prayers.forEach((prayer, index) => {
        const item = document.createElement("div");
        item.className = "prayer-item";

        const text = document.createElement("span");
        text.textContent = `نماز ${prayer}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = savedPrayers.includes(index);
        checkbox.setAttribute("aria-label", `نماز ${prayer}`);

        checkbox.addEventListener("change", () => {
            let current = readStorage(storageKey, []);

            if (!Array.isArray(current)) {
                current = [];
            }

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

        item.appendChild(text);
        item.appendChild(checkbox);

        prayerList.appendChild(item);
    });
}

// تغییر ماه
function changeMonth(amount) {
    const info = getDisplayedMonthInfo();

    const anchor = new Date(info.firstDay);
    anchor.setDate(anchor.getDate() + 14);

    anchor.setDate(
        anchor.getDate() + (amount > 0 ? 35 : -35)
    );

    displayedMonth = getMonthInfo(anchor).firstDay;

    selectedWeek = 1;

    updateMonthTitle();
    showWeeks();

    daySection.style.display = "none";
    prayerSection.style.display = "none";

    dayList.innerHTML = "";
    prayerList.innerHTML = "";
}

// تغییر ماه قبل و بعد
document.getElementById("prev-month").addEventListener("click", () => {
    changeMonth(-1);
});

document.getElementById("next-month").addEventListener("click", () => {
    changeMonth(1);
});

// ذخیره نماز قضا
function saveQaza() {
    localStorage.setItem(
        "qazaData",
        JSON.stringify(qazaData)
    );
}

// باز و بسته کردن پنل عبادت‌ها
qazaButton.addEventListener("click", () => {
    qazaPanel.hidden = !qazaPanel.hidden;
});

// نمایش نمازهای قضا
function showQaza() {
    qazaList.innerHTML = "";

    const total = qazaData.reduce(
        (sum, item) => sum + item.count,
        0
    );

    document.getElementById("qaza-total").textContent =
        `مجموع نمازهای باقی‌مانده: ${total}`;

    qazaData.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "prayer-item";

        const text = document.createElement("span");
        text.textContent =
            `نماز ${item.prayer}: ${item.count} نماز قضا`;

        const doneButton = document.createElement("button");
        doneButton.type = "button";
        doneButton.textContent = "انجام شد";
        doneButton.className = "done-qaza";

        doneButton.addEventListener("click", () => {
            if (item.count <= 0) return;

            item.count--;

            if (item.count <= 0) {
                qazaData.splice(index, 1);
            }

            saveQaza();
            showQaza();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "حذف";
        deleteButton.className = "delete-qaza";

        deleteButton.addEventListener("click", () => {
            const confirmed = confirm(
                `آیا از حذف نماز قضا ${item.prayer} مطمئنی؟`
            );

            if (!confirmed) return;

            qazaData.splice(index, 1);

            saveQaza();
            showQaza();
        });

        div.appendChild(text);
        div.appendChild(doneButton);
        div.appendChild(deleteButton);

        qazaList.appendChild(div);
    });
}

// ثبت نماز قضا
document.getElementById("add-qaza").addEventListener("click", () => {
    const prayer = document.getElementById("qaza-prayer").value;

    const count = Number(
        document.getElementById("qaza-count").value
    );

    if (!validPrayers.includes(prayer)) {
        alert("نوع نماز معتبر نیست.");
        return;
    }

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

    saveQaza();

    document.getElementById("qaza-count").value = "";

    showQaza();
});

// مدیریت روزه قضا
let fastingCount = Number(
    localStorage.getItem("fastingCount") || 0
);

const fastingTotal = document.getElementById("fasting-total");
const fastingInput = document.getElementById("fasting-count");

function updateFasting() {
    fastingTotal.textContent =
        fastingCount.toLocaleString("fa-IR");

    localStorage.setItem("fastingCount", fastingCount);
}

document.getElementById("add-fasting").addEventListener("click", () => {
    const count = Number(fastingInput.value);

    if (!Number.isInteger(count) || count < 1) {
        alert("لطفاً تعداد معتبر وارد کن.");
        return;
    }

    fastingCount += count;
    fastingInput.value = "";

    updateFasting();
});

document.getElementById("done-fasting").addEventListener("click", () => {
    if (fastingCount <= 0) {
        alert("روزه قضایی باقی نمانده است.");
        return;
    }

    fastingCount--;
    updateFasting();
});

updateFasting();

// مدیریت نمازهای مستحبی
let mustahabPrayers = readStorage("mustahabPrayers", []);

if (!Array.isArray(mustahabPrayers)) {
    mustahabPrayers = [];
}

const mustahabList = document.getElementById("mustahab-list");
const mustahabInput = document.getElementById("mustahab-name");
const mustahabCountInput = document.getElementById("mustahab-count");

function saveMustahab() {
    localStorage.setItem(
        "mustahabPrayers",
        JSON.stringify(mustahabPrayers)
    );
}

function showMustahab() {
    mustahabList.innerHTML = "";

    mustahabPrayers.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "prayer-item";

        const text = document.createElement("span");
        text.textContent =
            `${item.name}: ${item.count} بار باقی‌مانده`;

        const doneButton = document.createElement("button");
        doneButton.type = "button";
        doneButton.textContent = "انجام شد";
        doneButton.className = "done-mustahab";

        doneButton.addEventListener("click", () => {
            if (item.count <= 0) return;

            item.count--;

            if (item.count <= 0) {
                mustahabPrayers.splice(index, 1);
            }

            saveMustahab();
            showMustahab();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "حذف";
        deleteButton.className = "delete-mustahab";

        deleteButton.addEventListener("click", () => {
            const confirmed = confirm(
                `نماز «${item.name}» حذف شود؟`
            );

            if (!confirmed) return;

            mustahabPrayers.splice(index, 1);

            saveMustahab();
            showMustahab();
        });

        div.appendChild(text);
        div.appendChild(doneButton);
        div.appendChild(deleteButton);

        mustahabList.appendChild(div);
    });
}

document.getElementById("add-mustahab").addEventListener("click", () => {
    const name = mustahabInput.value.trim();
    const count = Number(mustahabCountInput.value);

    if (!name) {
        alert("نام نماز مستحبی را وارد کن.");
        return;
    }

    if (!Number.isInteger(count) || count < 1) {
        alert("لطفاً تعداد معتبر وارد کن.");
        return;
    }

    const existing = mustahabPrayers.find(
        item => item.name === name
    );

    if (existing) {
        existing.count += count;
    } else {
        mustahabPrayers.push({
            name: name,
            count: count
        });
    }

    saveMustahab();

    mustahabInput.value = "";
    mustahabCountInput.value = "";

    showMustahab();
});


// فهرست دعاها
const duas = [
    { id: "ziyarat-ashura", name: "زیارت عاشورا" },
    { id: "hadith-kisa", name: "حدیث کسا" },
    { id: "dua-tawassul", name: "دعای توسل" },
    { id: "dua-kumayl", name: "دعای کمیل" },
    { id: "dua-nudba", name: "دعای ندبه" },
    { id: "dua-ahd", name: "دعای عهد" },
    { id: "dua-faraj", name: "دعای فرج" },
    { id: "dua-jawshan-kabir", name: "دعای جوشن کبیر" },
    { id: "dua-mujir", name: "دعای مجیر" },
    { id: "munajat-shabaniyah", name: "مناجات شعبانیه" }
];

const showDuasButton = document.getElementById("show-duas-button");
const duaPanel = document.getElementById("dua-panel");
const duaList = document.getElementById("dua-list");

// باز و بسته کردن فهرست دعاها
showDuasButton.addEventListener("click", () => {
    duaPanel.hidden = !duaPanel.hidden;

    showDuasButton.textContent = duaPanel.hidden
        ? "مشاهده دعاهای من"
        : "بستن فهرست دعاها";
});

// ذخیره متن‌های دریافت‌شده
const duaTexts = new Map();

// ساخت فهرست دعاها
function showDuas() {
    duaList.innerHTML = "";

    duas.forEach(dua => {
        const item = document.createElement("div");
        item.className = "dua-item";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "dua-toggle";

        const name = document.createElement("span");
        name.textContent = dua.name;

        const arrow = document.createElement("span");
        arrow.className = "dua-arrow";
        arrow.textContent = "⌄";

        button.appendChild(name);
        button.appendChild(arrow);

        const content = document.createElement("div");
        content.className = "dua-content";
        content.hidden = true;

        // بخش صوت دعا
        const audioTitle = document.createElement("h3");
        audioTitle.textContent = "صوت دعا";

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.style.width = "100%";

        const source = document.createElement("source");
        source.src = `./audio/${dua.id}.mp3`;
        source.type = "audio/mpeg";

        audio.appendChild(source);

        audio.addEventListener("error", () => {
            audioTitle.textContent = "صوت دعا در دسترس نیست";
        });

        // بخش متن دعا
        const textTitle = document.createElement("h3");
        textTitle.textContent = "متن دعا";

        const textContent = document.createElement("div");
        textContent.className = "dua-text";
        textContent.textContent = "در حال دریافت متن دعا...";

        textContent.style.whiteSpace = "pre-wrap";
        textContent.style.lineHeight = "2.2";
        textContent.style.maxHeight = "500px";
        textContent.style.overflowY = "auto";
        textContent.style.padding = "12px";

        content.appendChild(audioTitle);
        content.appendChild(audio);
        content.appendChild(textTitle);
        content.appendChild(textContent);

        // باز و بسته کردن دعا
        button.addEventListener("click", async () => {
            const isOpen = !content.hidden;

            document.querySelectorAll(".dua-item").forEach(otherItem => {
                otherItem.classList.remove("open");

                const otherContent =
                    otherItem.querySelector(".dua-content");

                otherContent.hidden = true;

                const otherAudio = otherContent.querySelector("audio");
                if (otherAudio) {
                    otherAudio.pause();
                }
            });

            if (!isOpen) {
                content.hidden = false;
                item.classList.add("open");

                if (duaTexts.has(dua.id)) {
                    textContent.textContent = duaTexts.get(dua.id);
                } else {
                    try {
                        const response = await fetch(
                            `./duas/${dua.id}.txt`
                        );

                        if (!response.ok) {
                            throw new Error("فایل متن پیدا نشد");
                        }

                        const text = await response.text();

                        if (!text.trim()) {
                            throw new Error("فایل متن خالی است");
                        }

                        duaTexts.set(dua.id, text);
                        textContent.textContent = text;

                    } catch (error) {
                        textContent.textContent =
                            "متن این دعا هنوز اضافه نشده است.";
                        console.error(error);
                    }
                }
            }
        });

        item.appendChild(button);
        item.appendChild(content);

        duaList.appendChild(item);
    });
}


// اجرای اولیه برنامه
updateMonthTitle();
showWeeks();
showQaza();
showMustahab();
showDuas();
updateMonthlyStats();

// ثبت Service Worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("Service Worker ثبت شد"))
            .catch(error =>
                console.error("خطا در ثبت Service Worker:", error)
            );
    });
}
