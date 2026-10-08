/*
 * podejrzyjkota: konfiguracja kont (Supabase)
 * ------------------------------------------------------------------
 * 1. Skopiuj ten plik jako js/config.js (albo wklej wartości do istniejącego js/config.js).
 * 2. Wartości znajdziesz w Supabase: Project Settings → API (Data API / API Keys).
 *    - supabaseUrl:     „Project URL”, np. https://abcdefghijklm.supabase.co
 *    - supabaseAnonKey: klucz „anon” / „public” (albo nowy „publishable key”: sb_publishable_...)
 *
 * TEN klucz jest publiczny z założenia: chronią dane polityki RLS w bazie.
 * NIGDY nie wklejaj tu klucza „service_role” ani „secret key” (sb_secret_...).
 * Ten klucz daje pełny dostęp do bazy z pominięciem RLS i nie może trafić do przeglądarki.
 *
 * Puste wartości = tryb gościa (jak dotąd: wszystko w localStorage, bez logowania).
 */
window.PODEJRZYJKOTA_CONFIG = {
  supabaseUrl: "https://TWOJ-PROJEKT.supabase.co",
  supabaseAnonKey: "WKLEJ-TU-KLUCZ-ANON-PUBLIC",

  // metody logowania widoczne w okienku „Zaloguj się”
  auth: {
    google: true,        // wymaga włączenia Google w Supabase (Authentication → Providers)
    magicLink: true,     // link logowania wysyłany e-mailem
    password: true       // opcjonalnie: e-mail + hasło
  }
};
