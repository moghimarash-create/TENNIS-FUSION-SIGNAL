# TENNIS-FUSION-SIGNAL

**داشبورد تلفیقی ۲ باکسی ۱۶ حالته تنیس (`Mode 1..16`) برای `ATP` و `WTA` — متصل به تیکرهای Kalshi (`KXATPMATCH` / `KXWTAMATCH`)**

> **قانون معماری قطعی:**  
> ۱) ۱۰۰٪ مبتنی بر **جمتریا نام‌ها (`EnglishGem`) + موقعیت نجومی روز و شهر تورنمنت (`pyswisseph`)** بدون هیچ استفاده‌ای از تاریخ تولد بازیکنان (`BIRTHDATE_USED = False`).  
> ۲) حفظ کامل چیدمان **تمیز و خلوت ۲ باکسی نسخه اصلی `NBA-FUSION-SIGNAL`** (زاویه مکان/تورنمنت `T` در کنار زاویه کورت/کد بازیکن `P`) بدون شلوغی نسخه‌های دیگر.  
> ۳) ایزولاسیون ۱۰۰٪ از مخازن و شیت‌های زنده `NBA-*` و `NHL-*`.

---

## ۱. پارامترهای ثابت نجومی-جمتریا و سوییچرهای بالای صفحه

- **سوییچر تور:** `ATP` (`DEG1 = 121` • `1° LEO` • `FIRE`) | `WTA` (`DEG1 = 47` • `17° TAURUS` • `EARTH`) | `ALL` (`ATP + WTA`)
- **سوییچر ۳ آپشن `DEG3` زاویه اول (`T`):**
  - **`opt3` (`CITY_ONLY` — پیش‌فرض برنده):** `MOD(EnglishGem(City), 360)`
  - **`opt1` (`CITY_PLUS_TOURNAMENT`):** `MOD(EnglishGem(City), 360) + MOD(EnglishGem(Tournament), 360)`
  - **`opt2` (`TOURNAMENT_ONLY`):** `MOD(EnglishGem(Tournament), 360)`
- **زاویه دوم (`P`):** `DEG2 = MOD(EnglishGem(Player_Last_Name), 360)` و `DEG3 = MOD(EnglishGem(Surface), 360) + MOD(EnglishGem(Player_IOC_Code), 360)`
- **تیکرهای بازار زنده Kalshi:** `KXATPMATCH` و `KXWTAMATCH`

---

## ۲. برترین مودهای تلفیقی (`Mode 1..16`) در ۳ فصل کامل `2024–2026` (`16,551` مسابقه • Zero-Lookahead روی `opt3`)

| مود | نام مود | دقت `ATP` (`2024–2026`) | دقت `WTA` (`2024–2026`) | دقت کل `ALL` (`2024–2026`) |
| :---: | :--- | :---: | :---: | :---: |
| **`Mode 13`** | `anti_nobet_smart` (Smart Anti-NO-BET) | **`69.47%`** (`1818/2617`) | **`69.25%`** (`1475/2130`) | **`69.37%`** (`3293/4747`) |
| **`Mode 2`** | `vip_cross` (VIP Cross Lock) | **`65.17%`** (`872/1338`) | **`68.21%`** (`723/1060`) | **`66.51%`** (`1595/2398`) |
| **`Mode 12`** | `tri_gf_ultralock` (3-Number Ultra-Lock) | **`63.74%`** (`515/808`) | **`65.84%`** (`451/685`) | **`64.70%`** (`966/1493`) |
| **`Mode 15`** | `fusion4_elem` (4-Pattern Element × Box-2) | **`64.30%`** (`2892/4498`) | **`64.91%`** (`2512/3870`) | **`64.58%`** (`5404/8368`) |
| **`Mode 14`** | `smart_elem_14` (Total Element Polarity) | **`64.05%`** (`3166/4943`) | **`64.78%`** (`2737/4225`) | **`64.39%`** (`5903/9168`) |
| **`Mode 8`** | `safe_dl_core` (Safe Double-Lock Core) | **`63.67%`** (`764/1200`) | **`64.91%`** (`677/1043`) | **`64.24%`** (`1441/2243`) |
| **`Mode 5`** | `geo_1xxx_lock` (Geomantic `1xxx` Lock) | **`61.73%`** (`492/797`) | **`65.25%`** (`398/610`) | **`63.26%`** (`890/1407`) |
| **`Mode 1`** | `dual_pillar` (Dual Pillar `T ∩ P`) | **`60.93%`** (`1277/2096`) | **`62.62%`** (`1069/1707`) | **`61.69%`** (`2346/3803`) |

---

## ۳. تست تطابق خودکار و اجرای پایپ‌لاین

```bash
python3 artifacts/api-server/python/test_english_gem_parity.py
pnpm run typecheck
```
