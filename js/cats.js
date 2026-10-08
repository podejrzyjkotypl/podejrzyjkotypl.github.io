/*
 * podejrzyjkota: DANE KOTÓW
 * ------------------------------------------------------------
 * UWAGA: to są PRZYKŁADOWE koty i FIKCYJNE schroniska (dane demonstracyjne).
 * Żeby podpiąć prawdziwe koty, podmień tablicę `cats` poniżej.
 *
 * Pola kota:
 *   id          unikalny identyfikator (krótki tekst bez spacji)
 *   name        imię
 *   nameAcc     (opcjonalnie) imię w bierniku, np. "Łatkę" (do tekstu „Chcę adoptować Łatkę”)
 *   age         wiek jako tekst do wyświetlenia, np. "2 lata", "8 miesięcy"
 *   sex         "kotka" albo "kocur"
 *   traits      lista cech charakteru (3 to optimum)
 *   shelter     id schroniska z listy `shelters`
 *   story       krótki opis (2–3 zdania)
 *   status      "available" (szuka domu) albo "adopted" (ma dom)
 *   adoptedNote (opcjonalnie) tekst przy kocie z domem, np. "Znalazł dom 3 dni temu"
 *   popularity  1–5, wpływa na kursy w grze (5 = faworyt, 1 = czarny koń)
 *   listingUrl  (opcjonalnie) link do oryginalnego ogłoszenia (tylko http/https), np. z OLX
 *   contactName (opcjonalnie) kontakt do adopcji: imię osoby albo nazwa fundacji
 *   contactPhone, contactEmail (opcjonalnie) telefon / e-mail do adopcji. Gdy jest którykolwiek,
 *               przycisk „Chcę adoptować” używa ich zamiast kontaktu schroniska.
 *   hidden      (opcjonalnie) true = kot ukryty, nie pokazuje się na stronie
 *   photo       (opcjonalnie) ścieżka do zdjęcia, np. "img/pierniczek.jpg".
 *               Gdy jest, zastępuje ilustrację. Używaj tylko zdjęć, do których
 *               schronisko ma prawa!
 *   look        wygląd ilustracji SVG (gdy brak zdjęcia):
 *               pattern: "solid" | "tabby" | "tuxedo" | "calico" | "tortie" | "pointed" | "bicolor"
 *               base, accent, white  kolory futra
 *               eyes                 kolor oczu
 *               bg                   kolor tła ilustracji
 *               extra                "bow" | "collar" | "none"
 */
window.PODEJRZYJKOTA_DATA = {
  // DO PODMIANY: domyślny adres kontaktowy do adopcji (to adres fikcyjny!)
  contactEmail: "adopcje@przyklad.example",

  shelters: {
    "koci-wasik": {
      name: "Schronisko „Pod Kocim Wąsem”",
      city: "Łomża",
      email: "adopcje@przyklad.example" // DO PODMIANY
    },
    "mruczacy-dom": {
      name: "Fundacja „Mruczący Dom”",
      city: "Zambrów",
      email: "adopcje@przyklad.example" // DO PODMIANY
    },
    "narwianska-lapa": {
      name: "Kociarnia „Narwiańska Łapa”",
      city: "Piątnica",
      email: "adopcje@przyklad.example" // DO PODMIANY
    }
  },

  cats: [
    {
      id: "pierniczek",
      name: "Pierniczek",
      nameAcc: "Pierniczka",
      age: "2 lata",
      sex: "kocur",
      traits: ["przytulas", "gaduła", "lubi dzieci"],
      shelter: "koci-wasik",
      story: "Rudy dżentelmen, który wita każdego mruczeniem na cały korytarz. Uwielbia spać na kolanach i komentować wszystko, co się dzieje w kuchni.",
      status: "available",
      popularity: 5,
      look: { pattern: "tabby", base: "#E98A3C", accent: "#B85A1F", white: "#FFF3E2", eyes: "#7BB04A", bg: "#FFE2C2", extra: "collar" }
    },
    {
      id: "smuga",
      name: "Smuga",
      nameAcc: "Smugę",
      age: "4 lata",
      sex: "kotka",
      traits: ["niezależna", "ciekawska", "łowczyni piórek"],
      shelter: "mruczacy-dom",
      story: "Szara pręgowana spryciara. Najpierw obserwuje z bezpiecznej odległości, a potem przychodzi sama i już nie odchodzi. Szuka domu z parapetem z widokiem.",
      status: "available",
      popularity: 3,
      look: { pattern: "tabby", base: "#9A9A9E", accent: "#4F4F57", white: "#F2F0EC", eyes: "#E3B23C", bg: "#DDE7F0", extra: "none" }
    },
    {
      id: "frak",
      name: "Frak",
      nameAcc: "Fraka",
      age: "6 lat",
      sex: "kocur",
      traits: ["elegancki", "spokojny", "kanapowiec"],
      shelter: "koci-wasik",
      story: "Zawsze ubrany jak na galę. Spokojny, zrównoważony, idealny dla zapracowanych: wieczorem wystarczy mu wspólny serial i miska.",
      status: "available",
      popularity: 2,
      look: { pattern: "tuxedo", base: "#26232B", accent: "#26232B", white: "#FBF8F3", eyes: "#9BCB5A", bg: "#E7E1F5", extra: "bow" }
    },
    {
      id: "latka",
      name: "Łatka",
      nameAcc: "Łatkę",
      age: "1 rok",
      sex: "kotka",
      traits: ["energiczna", "psotna", "zna kuwetę"],
      shelter: "narwianska-lapa",
      story: "Trójkolorowy wulkan energii. Biega, skacze, zaczepia i wszystko chce sprawdzić łapką. Najlepiej czuje się w domu, gdzie ktoś ma czas na zabawę.",
      status: "available",
      popularity: 4,
      look: { pattern: "calico", base: "#FFF8EF", accent: "#E5893A", white: "#2B2630", eyes: "#D9A23A", bg: "#FFE7E0", extra: "none" }
    },
    {
      id: "mgielka",
      name: "Mgiełka",
      nameAcc: "Mgiełkę",
      age: "9 lat",
      sex: "kotka",
      traits: ["łagodna", "seniorka", "mruczy na zawołanie"],
      shelter: "mruczacy-dom",
      story: "Dostojna seniorka o błękitnych oczach. Potrzebuje cichego domu i ciepłego koca. W zamian oddaje całe kocie serce i najdelikatniejsze mruczenie świata.",
      status: "available",
      popularity: 1,
      look: { pattern: "pointed", base: "#F3E6D3", accent: "#6B4A3A", white: "#FFF8EE", eyes: "#6FB6E8", bg: "#E3F1EA", extra: "none" }
    },
    {
      id: "wegielek",
      name: "Węgielek",
      nameAcc: "Węgielka",
      age: "8 miesięcy",
      sex: "kocur",
      traits: ["zabawowy", "odważny", "kocha wędki"],
      shelter: "narwianska-lapa",
      story: "Czarny jak noc, wesoły jak poranek. Młodzik, który goni wszystko, co się rusza, a potem zasypia w najdziwniejszych pozycjach.",
      status: "available",
      popularity: 3,
      look: { pattern: "solid", base: "#2A2730", accent: "#2A2730", white: "#2A2730", eyes: "#F2C744", bg: "#FCE8B5", extra: "collar" }
    },
    {
      id: "iskra",
      name: "Iskra",
      nameAcc: "Iskrę",
      age: "5 lat",
      sex: "kotka",
      traits: ["charakterna", "mądra", "jedynaczka"],
      shelter: "koci-wasik",
      story: "Szylkretowa dama z temperamentem. Wie, czego chce, i potrafi to wyegzekwować. Doceni dom bez innych zwierząt i opiekuna z poczuciem humoru.",
      status: "available",
      popularity: 2,
      look: { pattern: "tortie", base: "#3A2E2C", accent: "#D7823A", white: "#F0B05E", eyes: "#E0A23B", bg: "#F6DCCB", extra: "none" }
    },
    {
      id: "karmel",
      name: "Karmel",
      nameAcc: "Karmela",
      age: "3 lata",
      sex: "kocur",
      traits: ["słodziak", "towarzyski", "lubi psy"],
      shelter: "narwianska-lapa",
      story: "Rudo-biały pogodny kocur, który dogada się z każdym, nawet z psem. Już ma swój dom!",
      status: "adopted",
      adoptedNote: "Znalazł dom 3 dni temu",
      popularity: 4,
      look: { pattern: "bicolor", base: "#E4A04F", accent: "#C47A2C", white: "#FFFAF2", eyes: "#C9A13A", bg: "#FFF0C9", extra: "none" }
    },
    {
      id: "pianka",
      name: "Pianka",
      nameAcc: "Piankę",
      age: "2 lata",
      sex: "kotka",
      traits: ["delikatna", "czyścioszka", "puszysta"],
      shelter: "mruczacy-dom",
      story: "Biało-szara chmurka, która zamieszkała u rodziny z Łomży. Podobno już rządzi całym domem.",
      status: "adopted",
      adoptedNote: "Znalazła dom tydzień temu",
      popularity: 3,
      look: { pattern: "bicolor", base: "#8C93A3", accent: "#666D7C", white: "#FFFFFF", eyes: "#E3B23C", bg: "#EAE3F7", extra: "bow" }
    }
  ]
};
