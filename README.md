# podejrzyjkota

Gra adopcyjna, w której odkrywasz karty z kotami do adopcji i obstawiasz za **wirtualne punkty, bez pieniędzy**, który kot pierwszy znajdzie dom.

To statyczna strona (HTML + CSS + JS), bez kroku budowania. Działa po otwarciu `index.html` w przeglądarce.

## Struktura

```
index.html        strona (hero, gra, Jak to działa, Dla schronisk, stopka)
css/style.css     style (mobile-first)
js/cats.js        DANE KOTÓW I SCHRONISK: tu podmieniasz koty
js/catart.js      generator ilustracji kotów (SVG z kodu)
js/app.js         logika gry: karty, punkty, zakłady, ranking, odznaki
js/pwa.js         PWA: rejestracja service workera + przycisk „Zainstaluj”
sw.js             service worker (cache offline, wersjonowany: CACHE_VERSION)
manifest.webmanifest  manifest PWA (nazwa, kolory, ikony)
icons/            ikony PWA 192/512 + maskable + apple-touch-icon
download/         plik APK do pobrania ze strony (podejrzyjkota.apk)
js/ads.js         REKLAMY: konfiguracja miejsc reklamowych (AdSense / sponsor / ramki demo)
polityka-prywatnosci.html  polityka prywatności i cookies (RODO), WZÓR: uzupełnij dane
regulamin.html    regulamin serwisu i gry (WZÓR: uzupełnij dane, pokaż prawnikowi)
jak-grac.html     instrukcja gry + FAQ o grze
faq.html          ogólne FAQ (adopcja, koszty, hazard, dodawanie kota, aplikacja, prywatność)
dla-ogloszeniodawcow.html  dla schronisk i osób prywatnych: wymagania, proces, wzory e-maili ze zgodą
kontakt.html      kontakt + formularz (otwiera program pocztowy, nic nie wysyła na serwer)
o-nas.html        misja, Łomża/Podlasie
404.html          strona błędu (ścieżki od „/”, działa na Netlify/GitHub Pages w katalogu głównym)
js/consent.js     BANER ZGODY NA COOKIES + Google Consent Mode v2 (ładowany w <head>)
js/pages.js       kopiowanie wzorów wiadomości, formularz kontaktowy (adres CONTACT_EMAIL)
robots.txt, sitemap.xml, ads.txt   SEO i reklamy (domena: https://podejrzyjkota.pl/)
og-image.png      obrazek do udostępnień (Open Graph, 1200×630)
fonts/            Fraunces + Nunito (SIL OFL, licencje w folderze)
favicon.svg       logo / ikonka
js/config.js      KONTA: adres Supabase + klucz anon (puste = tryb gościa, bez logowania)
js/config.example.js  wzór konfiguracji z opisem
js/account.js     konta: logowanie (Google, link e-mail, hasło), menu konta, profil, eksport, usuwanie
js/vendor/supabase.js  biblioteka supabase-js 2.x (UMD, ładowana tylko gdy konta są włączone)
admin.html, js/admin.js  panel administratora: koty, zdjęcia, oznaczanie adopcji (rozlicza zakłady)
supabase/migrations/  schemat bazy, RLS, funkcje RPC, Storage, dane przykładowe (kolejno 1 → 5)
supabase/setup-all.sql  to samo w jednym pliku, do wklejenia w SQL Editor
supabase/tests/rls_smoke_test.sql  test zabezpieczeń do uruchomienia w SQL Editor (wszystko cofa)
```

## Podmiana kotów na prawdziwe

1. Otwórz `js/cats.js`.
2. Zmień `contactEmail` oraz `shelters` (nazwa, miasto, e-mail). **Obecne adresy `@przyklad.example` są fikcyjne.**
3. Podmień tablicę `cats`. Opis pól jest na górze pliku. Zdjęcie dodajesz polem `photo: "img/nazwa.jpg"`; używaj tylko zdjęć, do których macie prawa. Bez zdjęcia kot dostaje ilustrację z pola `look`.
4. Kota, który znalazł dom, oznacz `status: "adopted"` (opcjonalnie z `adoptedNote`).
5. Usuń z `index.html` pasek „Przykładowe koty, dane demonstracyjne”, a w `js/app.js` etykietę „przykład” (`chip--demo`).

## Jak działa obstawianie

- Na start jest 100 pkt w localStorage przeglądarki. Bonusy: +2 pkt za każdą nową odkrytą kartę i +20 pkt za odkrycie wszystkich.
- Obstawiać można dopiero po odkryciu karty:
  - **„Pierwszy w domu”**: kot zostanie zaadoptowany jako pierwszy w bieżącej rundzie. Mnożnik to 0,9 × (suma popularności czekających kotów) / popularność kota, w zakresie 1,2–12.
  - **„W ciągu 3 / 7 / 14 dni”**: mnożnik bazowy 4 / 2,5 / 1,6 × (1,3 − 0,1 × popularność).
- Wygrana to stawka × mnożnik. Minimalna stawka to 5 pkt.
- **Tryb demo:** „Symuluj adopcję” przesuwa czas o 1–2 dni i losuje adopcję kota (ważoną popularnością), a potem rozlicza zakłady. „+1 dzień” rozlicza przeterminowane zakłady. Z prawdziwymi danymi adopcje rozliczałby status `adopted` z danych albo z backendu.
- Przy 0 pkt i braku aktywnych zakładów można odebrać „kocią zapomogę” (+30 pkt).
- **Z kontem (Supabase)** te same zasady liczy serwer: kursy, saldo i rozliczenia są w funkcjach SQL, „Symuluj adopcję” znika, a zakłady rozlicza administrator, oznaczając adopcję w `admin.html`. Zakłady „w ciągu N dni” liczą prawdziwe dni. Zapomoga: raz na 24 godziny.
- Bez konta ranking jest lokalny i ma przykładowych rywali (z kontem: ranking globalny, top 50 i Twoja pozycja). Odznaki: Podglądacz, Kocie oko, Pierwszy zakład, Szczęśliwa łapa, Seria ×3, Ambasador adopcji.

## Reklamy

Na stronie jest 5 miejsc reklamowych, każde z podpisem „Reklama” i z zarezerwowanym rozmiarem (bez skakania układu):

| Miejsce | Gdzie | Rozmiar |
|---|---|---|
| `top` | baner pod hero, nad grą | 728×90 (desktop) / 320×100 (telefon) |
| `grid` | karta natywna w siatce kotów, po co 5. kocie (nie da się jej odkryć ani obstawić) | rozmiar karty kota |
| `sidebar` | panel boczny pod rankingiem (na telefonie w tym samym miejscu, pod rankingiem) | 300×250 |
| `footer` | baner nad stopką | 728×90 / 320×50 |
| `result` | mały baner w oknie wyniku symulacji | 320×50 |

Wszystko ustawiasz w **`js/ads.js`**:

- **Tryb demo:** `showPlaceholders: true` pokazuje puste ramki z rozmiarem. Na produkcji ustaw `false`, żeby miejsca bez reklamy znikały.
- **Sponsor bezpośredni** (np. lokalny sklep zoologiczny): wklej HTML do `sponsorHtml` wybranego miejsca, np. `<a href="https://sklep.pl" rel="sponsored noopener" target="_blank"><img src="img/sklep-728x90.png" alt="Sklep XYZ" width="728" height="90"></a>`. Sponsor ma pierwszeństwo przed AdSense.
- **Google AdSense:**
  1. Załóż konto AdSense i zgłoś domenę. Google musi zaakceptować stronę; zwykle wymaga własnej domeny, treści i polityki prywatności.
  2. W `js/ads.js` wpisz swój identyfikator `client: "ca-pub-…"` w miejsce `ca-pub-XXXXXXXXXXXXXXXX` i ustaw `enabled: true`.
  3. W panelu AdSense utwórz jednostki reklamowe i wpisz ich ID w `adsenseSlot` każdego miejsca. Dla karty w siatce najlepsza jest jednostka „In-feed” (ewentualnie `adsenseLayoutKey`).
  4. Dodaj w głównym katalogu plik `ads.txt` z linijką podaną przez AdSense.
- **Wymogi prawne (UE/RODO):** przed włączeniem AdSense uzupełnij dane w `polityka-prywatnosci.html` i `regulamin.html` (zobacz „Dane do uzupełnienia”). Baner zgody jest już na stronie (`js/consent.js`), ale to rozwiązanie tymczasowe. W UE/EOG Google wymaga CMP certyfikowanego przez Google, np. „Prywatność i wiadomości” w panelu AdSense.
- Liczbę kart reklamowych w siatce zmieniasz w `slots.grid.every` (co ile kotów) i `slots.grid.max`.

## Zgoda na cookies (js/consent.js)

- Baner pokazuje się przy pierwszej wizycie na każdej stronie. Kategorie: **Niezbędne** (zawsze), **Statystyki**, **Marketing**. Przyciski „Odrzuć wszystkie” i „Akceptuję wszystkie” są tak samo widoczne.
- Wybór zapisuje się w localStorage (`podejrzyjkota:consent`) na 12 miesięcy. Link **„Ustawienia cookies”** w stopce (każdy element z atrybutem `data-cookie-settings`) otwiera baner ponownie.
- **Google Consent Mode v2:** domyślnie `ad_storage`, `ad_user_data`, `ad_personalization` i `analytics_storage` mają wartość `denied`. Po wyborze wysyłamy `gtag('consent','update', …)`.
- **AdSense ładuje się WYŁĄCZNIE po zgodzie „Marketing”** (`js/ads.js` sprawdza `PodejrzyjkotaConsent.has("marketing")`). Cofnięcie zgody przeładowuje stronę, żeby usunąć skrypt Google.
- Statystyk (np. Google Analytics) obecnie nie ma. Jeśli je dodasz, ładuj je tylko gdy `PodejrzyjkotaConsent.has("statistics")` albo w zdarzeniu `document.addEventListener("podejrzyjkota:consent", …)`, i dopisz je do polityki prywatności.
- W aplikacji Android baner się nie pokazuje (nie ma tam reklam ani plików cookies).
- Po zmianie kategorii lub polityki podbij `VERSION` w `js/consent.js`, a baner pokaże się wszystkim ponownie.

> **WAŻNE:** do wyświetlania reklam Google AdSense użytkownikom z EOG, Wielkiej Brytanii i Szwajcarii Google wymaga **CMP certyfikowanego przez Google** (zgodnego z IAB TCF v2.2). Ten baner jest rozwiązaniem tymczasowym, do czasu włączenia AdSense. Najprościej użyć wbudowanego CMP Google: AdSense › Prywatność i wiadomości › Europejskie przepisy, a wtedy wyłączyć ten baner (usunąć automatyczne otwieranie w `init()`), zostawiając link „Ustawienia cookies” podpięty pod `googlefc.callbackQueue.push(googlefc.showRevocationMessage)`. Można też wybrać płatny certyfikowany CMP, np. Cookiebot czy CookieYes.

## Konta i logowanie (Supabase)

Konta są **opcjonalne**. Dopóki `js/config.js` ma puste wartości, strona działa jak dotąd, w trybie gościa (wszystko w localStorage, bez logowania). Po podpięciu darmowego projektu Supabase strona dalej jest statyczna (Netlify, GitHub Pages), a dochodzą:

- logowanie: **Google**, **link e-mail** (bez hasła) i opcjonalnie **e-mail + hasło**,
- profil: unikalny nick i awatar (jeden z 9 kotów),
- punkty, zakłady, odznaki i serie zapisane na koncie; przy pierwszym logowaniu postęp gościa z tej przeglądarki przenosi się jednorazowo (punkty maks. 300, bez zakładów demo),
- **ranking globalny** (top 50 + Twoja pozycja),
- zakłady sprawdzane **po stronie serwera** (funkcja `place_bet`: blokada wiersza, saldo, kot nie może być zaadoptowany, limit 30 zakładów na godzinę i 20 aktywnych),
- `admin.html`: dodawanie i edycja kotów, zdjęcia (Supabase Storage), oznaczenie adopcji, które **od razu rozlicza zakłady**,
- RODO: „Pobierz moje dane (JSON)” i „Usuń konto” w menu konta; wylogowanie.

**Bezpieczeństwo:** RLS jest włączone na **wszystkich** tabelach. Gracz czyta tylko swoje wiersze. Klient nie ma prawa `UPDATE` do punktów ani zakładów: punkty zmieniają wyłącznie funkcje SQL (`security definer`). Koty zmienia tylko admin (tabela `public.admins`). Do przeglądarki trafia **tylko klucz anon/publishable**, a `js/account.js` odmówi działania, jeśli ktoś wklei klucz `service_role`/`secret`.

### Krok po kroku

**1. Projekt Supabase (darmowy)**
1. Załóż konto na [supabase.com](https://supabase.com) → **New project**. Region: **Central EU (Frankfurt)** (dane w UE, wpisz go w polityce prywatności). Hasło bazy zapisz w menedżerze haseł.
2. Poczekaj ok. 2 minut na utworzenie projektu.
3. Darmowy projekt jest **wstrzymywany po tygodniu bez ruchu**. Wznowisz go jednym kliknięciem w panelu. Przy stałym ruchu to nie problem.

**2. Baza danych (migracje)**
- Najprościej: **SQL Editor** → New query → wklej całą zawartość `supabase/setup-all.sql` → **Run**. Uruchom raz, na nowym projekcie.
- Albo Supabase CLI: `supabase init` (w folderze strony, zostaw istniejący `supabase/migrations`), `supabase link --project-ref TWOJ_REF`, `supabase db push`.
- Sprawdzenie: wklej w SQL Editor `supabase/tests/rls_smoke_test.sql` → Run. Wszystkie wiersze powinny mieć **PASS**, a skrypt na końcu wszystko cofa.
- **Advisors → Security Advisor** może pokazać ostrzeżenia, że funkcje `security definer` (np. `place_bet`) są wywoływalne przez zalogowanych. To zamierzone: te funkcje same sprawdzają uprawnienia i saldo. Błędów „RLS disabled” być nie powinno.

**3. Adres strony i przekierowania**
Authentication → **URL Configuration**:
- **Site URL:** `https://podejrzyjkota.pl` (Twoja domena),
- **Redirect URLs:** `https://podejrzyjkota.pl/**`, a do testów lokalnych także `http://localhost:8765/**` (i ewentualnie `https://*.netlify.app/**` dla podglądów Netlify).

**4. Wysyłka e-maili (WAŻNE przed startem)**
Wbudowana poczta Supabase wysyła e-maile **tylko do członków Twojego zespołu w Supabase**. Inni dostaną błąd „Email address not authorized”. Ma też niski limit i angielskie szablony (na darmowym planie bez własnego SMTP nie da się ich zmienić). Dlatego:
1. Załóż darmowe konto u dostawcy e-maili, np. **Resend** (3000 e-maili/mies.) albo **Brevo** (300/dzień). Zweryfikuj domenę (rekordy SPF i DKIM u rejestratora domeny).
2. Authentication → **Emails → SMTP Settings** → włącz Custom SMTP i wpisz host, port, login i hasło od dostawcy. Nadawca: np. `logowanie@podejrzyjkota.pl`, nazwa „podejrzyjkota”.
3. Authentication → **Rate Limits:** podnieś limit e-maili na godzinę (po włączeniu SMTP domyślnie jest 30).
4. Authentication → **Emails → Templates:** przetłumacz szablony. Przykład dla „Magic Link”: temat `Twój link logowania do podejrzyjkota`, treść `<h2>Zaloguj się do podejrzyjkota 🐾</h2><p><a href="{{ .ConfirmationURL }}">Kliknij, żeby się zalogować</a></p><p>Link działa przez godzinę. Jeśli to nie Ty, zignoruj tę wiadomość.</p>`. Podobnie „Confirm signup” i „Reset password”.
5. Wpisz dostawcę e-maili w polityce prywatności (`[DOSTAWCA WYSYŁKI E-MAILI LOGOWANIA…]`).

**5. Logowanie Google**
1. [console.cloud.google.com](https://console.cloud.google.com) → nowy projekt „podejrzyjkota”.
2. **Google Auth Platform → Branding:** nazwa aplikacji, e-mail pomocy, logo (opcjonalnie), link do polityki prywatności i regulaminu. **Authorized domains:** `podejrzyjkota.pl` oraz `TWOJ_REF.supabase.co`.
3. **Audience:** typ *External*, potem **Publish app** („In production”). Przy zakresach email/profile nie trzeba weryfikacji Google.
4. **Clients → Create client → Web application:**
   - Authorized JavaScript origins: `https://podejrzyjkota.pl` (i `http://localhost:8765` do testów),
   - Authorized redirect URIs: adres **Callback URL** z Supabase (Authentication → Sign In / Providers → Google), czyli `https://TWOJ_REF.supabase.co/auth/v1/callback`.
5. Skopiuj **Client ID** i **Client secret** do Supabase: Authentication → Sign In / Providers → **Google** → Enable → Save.
6. Nie chcesz Google? W `js/config.js` ustaw `auth: { google: false, … }` i przycisk zniknie. Tak samo możesz wyłączyć `magicLink` albo `password`.

**6. Klucze w `js/config.js`**
Project Settings → **API Keys** (albo „Data API”): skopiuj **Project URL** i klucz **anon public** (lub nowy **publishable key** `sb_publishable_…`) do `js/config.js`:
```js
window.PODEJRZYJKOTA_CONFIG = {
  supabaseUrl: "https://TWOJ_REF.supabase.co",
  supabaseAnonKey: "eyJ… albo sb_publishable_…",
  auth: { google: true, magicLink: true, password: true }
};
```
**Nigdy nie wklejaj klucza `service_role` ani `secret` (`sb_secret_…`).** Ten klucz omija RLS. Nie może trafić do repozytorium ani na stronę. Klucz anon jest publiczny z założenia, dane chroni RLS. Po zmianie podbij `CACHE_VERSION` w `sw.js` i wdroż stronę.

**7. Zostań administratorem**
1. Wejdź na stronę i zaloguj się swoim kontem (tak, jak gracz).
2. Supabase → SQL Editor:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'twoj@email.pl';
   ```
3. Otwórz `https://podejrzyjkota.pl/admin.html` (link „Panel administratora” pojawi się też w menu konta). Strona bez uprawnień pokazuje Twój identyfikator i gotowe polecenie SQL. Uprawnień nie da się nadać z przeglądarki.
4. Podmień przykładowe koty i schroniska na prawdziwe (albo usuń przykładowe w Table Editor). Oznaczenie „🏠 Oznacz adopcję” rozlicza zakłady i jest nieodwracalne (przywrócenie statusu nie cofa wypłat). Z kontami koty pochodzą z bazy: `js/cats.js` służy już tylko jako zapas offline i źródło awatarów.

**8. Sprawdź na żywo:** zaloguj się linkiem e-mail i Google, postaw zakład, oznacz adopcję w panelu, pobierz dane i usuń testowe konto.

### Dobrze wiedzieć
- **Rozliczenia:** trigger na tabeli `cats` przy zmianie statusu na `adopted` rozlicza wszystkie aktywne „pierwszy w domu” (wygrywa obstawiony kot) i zakłady „w ciągu N dni” na tego kota (wygrana, jeśli przed terminem), a potem zwiększa rundę. Przeterminowane zakłady dniowe rozliczają się jako przegrane przy kolejnym wejściu gracza. Dziennik rozliczeń jest w panelu admina.
- **Limity:** zakłady 30/h i maks. 20 aktywnych, zmiana profilu 10/h, eksport 10/h, zapomoga raz na 24 h. Logowanie e-mailem limituje Supabase (Authentication → Rate Limits).
- **Link do ogłoszenia i kontakt:** w formularzu kota w `admin.html` (sekcja „Ogłoszenie i kontakt do adopcji”). Link tylko http/https, pokazuje się jako „Zobacz ogłoszenie ↗”. Gdy kot ma własny telefon lub e-mail, „Chcę adoptować” używa ich zamiast kontaktu schroniska (e-mail, a gdy jest tylko telefon, link `tel:`). Publikuj kontakt tylko za zgodą ogłoszeniodawcy.
- **Ukryj kota:** przycisk „🙈 Ukryj kota” w panelu (funkcja `admin_set_cat_hidden`, tylko admin). Kot znika ze strony i z gry (RLS: ukryte koty widzi tylko admin), ale zostaje w bazie. Aktywne zakłady na tego kota są anulowane, a stawki **wracają do graczy** (status `void`, wpis `refund` w historii punktów). „👁 Pokaż kota” przywraca go do gry, zwroty zostają. Ukrytego kota nie da się oznaczyć jako adoptowanego (najpierw go pokaż). Przy wycofaniu zgody ogłoszeniodawcy: ukryj kota i wyczyść jego kontakt oraz link.
- **Zdjęcia:** bucket `cat-photos` (publiczny odczyt, zapis tylko admin, JPG/PNG/WebP do 3 MB). Używaj tylko zdjęć, do których macie prawa.
- **Usunięcie konta** kasuje użytkownika z `auth.users`, a kaskadowo profil, zakłady, odznaki i historię punktów. Token sesji w przeglądarce może formalnie żyć do godziny, ale nie ma już żadnych danych.
- **Prawo:** polityka prywatności (punkt 3) i regulamin (§ 6a) opisują konta. Uzupełnij `[REGION PROJEKTU SUPABASE…]`, `[DOSTAWCA WYSYŁKI E-MAILI…]`, okresy przechowywania i wiek (`[16]`). W panelu Supabase zaakceptuj DPA (Organization → Legal Documents).
- **Aplikacja Android:** w aplikacji (Capacitor) logowanie jest celowo **wyłączone**, aplikacja działa w trybie gościa. Logowanie w aplikacji wymaga później: deep linku (np. `pl.podejrzyjkota.app://login`, intent-filter w `AndroidManifest.xml`, wtyczka `@capacitor/app` do odbioru linku), dodania tego adresu w Supabase → Redirect URLs, logowania Google przez przeglądarkę systemową (`@capacitor/browser`), ustawienia `allowInNativeApp: true` w `js/config.js` i **przebudowy APK/AAB** (nowy `versionCode`).

## Dane do uzupełnienia przed publikacją (szukaj w całym folderze)

| Szukaj | Gdzie | Co wpisać |
|---|---|---|
| `[IMIĘ I NAZWISKO / NAZWA]`, `[ADRES]`, `[NIP / REGON, jeśli dotyczy]` | regulamin, polityka, kontakt, o-nas, wzory na dla-ogloszeniodawcow | dane prowadzącego serwis |
| `[E-MAIL KONTAKTOWY]` | regulamin, polityka, kontakt, wzory | adres e-mail do kontaktu |
| `kontakt@przyklad.example` | kontakt.html, `js/pages.js` (CONTACT_EMAIL), index.html | prawdziwy e-mail kontaktowy |
| `schroniska@przyklad.example` | index.html, dla-ogloszeniodawcow.html | e-mail do zgłoszeń kotów |
| `[DATA WEJŚCIA W ŻYCIE]` | regulamin, polityka | data publikacji dokumentów |
| `[DOSTAWCA HOSTINGU …]`, `[DOSTAWCA POCZTY …]`, `[np. 30 dni]`, `[np. 12 miesięcy]`, `[np. 3 miesiącach]` | polityka | faktyczni dostawcy i okresy przechowywania |
| `[PROFILE W MEDIACH SPOŁECZNOŚCIOWYCH …]` | polityka | Twoje profile (Instagram, TikTok…) albo usuń wiersz |
| `[Kilka zdań o sobie …]` | o-nas.html | opis autora |
| `https://podejrzyjkota.pl/` | wszystkie strony (canonical, og:url, og:image), sitemap.xml, robots.txt, wzory e-maili | Twoja domena |
| `pub-XXXXXXXXXXXXXXXX` | ads.txt (odkomentuj), `js/ads.js` | identyfikator wydawcy AdSense |
| `[REGION PROJEKTU SUPABASE …]`, `[DOSTAWCA WYSYŁKI E-MAILI LOGOWANIA …]`, `[zgodnie z planem Supabase …]`, `[np. do 7 dni]` | polityka (punkt 3 i 8) | region projektu, dostawca SMTP, okresy logów i kopii |
| `[16]`, `[24 miesiące]` | regulamin § 6a, polityka | minimalny wiek dla konta, usuwanie nieaktywnych kont |
| `supabaseUrl`, `supabaseAnonKey` | `js/config.js` | adres projektu i klucz anon (zobacz „Konta i logowanie”) |

Usuń też pigułkę „Wzór, przed publikacją uzupełnij dane…” z regulaminu i polityki, kiedy prawnik je sprawdzi. Podstrony mają wspólny nagłówek i stopkę wpisane w każdy plik, więc zmiany w menu trzeba nanieść w każdym pliku HTML.

## Aplikacja mobilna (Android)

**PWA:** strona ma manifest i service worker, więc w Chrome na Androidzie można ją zainstalować („Zainstaluj” w sekcji „Pobierz aplikację” albo menu ⋮ › Zainstaluj aplikację). Działa offline. **Po każdej zmianie plików strony podbij `CACHE_VERSION` w `sw.js`** (HTML, CSS i JS są pobierane najpierw z sieci, a z cache tylko offline; fonty i ikony najpierw z cache), inaczej użytkownicy zobaczą starą wersję z cache. PWA wymaga HTTPS (Netlify i GitHub Pages to zapewniają).

**APK (Capacitor 6):** projekt jest w `/workspace/podejrzyjkota-android/`, poza tym folderem. Cała strona jest wbudowana w aplikację (bez serwera i domeny). Identyfikator to `pl.podejrzyjkota.app`, minimalnie Android 7.0, orientacja pionowa. Jedyne uprawnienie to INTERNET (standardowe, bez pytania użytkownika). Zostawiamy je, bo bez niego WebView na części telefonów pokazuje pusty ekran lub błąd net::ERR_CACHE_MISS, nawet przy plikach wbudowanych w aplikację. Przyda się też pod AdMob. Linki `mailto:` i linki zewnętrzne otwierają się w aplikacji pocztowej lub przeglądarce, a localStorage (punkty) zostaje w telefonie. Nowa wersja:

```
cd podejrzyjkota-android
npm run sync-web && npx cap sync android
# podbij versionCode i versionName w android/app/build.gradle
cd android && JAVA_HOME=/ścieżka/do/jdk17 ANDROID_HOME=/ścieżka/do/sdk ./gradlew assembleRelease bundleRelease
```

Klucz podpisu jest w `podejrzyjkota-android/keystore/`. **Trzeba go zachować**, bo bez niego nie da się wydać aktualizacji.

**Reklamy w aplikacji:** AdSense nie działa w aplikacjach (WebView). W aplikacji ramki „Reklama” zostają jako puste miejsca. Żeby zarabiać w aplikacji, trzeba później podpiąć **Google AdMob** (np. wtyczka `@capacitor-community/admob`) i zgodę UMP/RODO. Uprawnienie INTERNET aplikacja już ma.

**Konta w aplikacji:** aplikacja działa w trybie gościa, nawet gdy `js/config.js` ma klucze Supabase (`js/account.js` wykrywa Capacitor i nie włącza logowania). Logowanie w aplikacji wymaga deep linków i przebudowy, opis w sekcji „Konta i logowanie (Supabase)” → „Dobrze wiedzieć”. Skrypt `npm run sync-web` pomija `supabase/` i `admin.html`.

**Google Play:** plik `podejrzyjkota.aab` jest gotowy do wysłania w Google Play Console. Potrzebne są konto dewelopera (jednorazowo 25 USD), polityka prywatności, opis i zrzuty ekranu.

## Wdrożenie

- **Netlify:** przeciągnij folder na app.netlify.com/drop.
- **GitHub Pages:** wrzuć zawartość folderu do repozytorium i włącz Pages (branch `main`, katalog `/`).
