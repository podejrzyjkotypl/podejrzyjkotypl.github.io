/*
 * podejrzyjkota: konfiguracja kont (Supabase). Instrukcja: js/config.example.js i README
 * („Konta i logowanie (Supabase)”).
 * Puste wartości = TRYB GOŚCIA: gra działa jak dotąd, bez logowania, postęp w localStorage.
 * Wklej tu WYŁĄCZNIE klucz anon/public (publishable). Nigdy service_role / secret.
 */
window.PODEJRZYJKOTA_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  auth: { google: true, magicLink: true, password: true }
};
